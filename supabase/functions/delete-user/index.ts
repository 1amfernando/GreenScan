// delete-user — Account-Wipe + auth.users-Delete (Service-Role)
// v23.92.1 (2026-04-28) — audit_log Schema-Fix: details → diff, plus target_type/actor_id
// v4 (2026-06-01, v26.76) — legacy_profiles-Block entfernt (Tabelle via Cleanup-Migration gedroppt).
// v5 (2026-09-10, v33.17) — die Listen und die Rechnung liegen in
//    ../_shared/loeschung_regeln.mjs (Node-pruefbar: scripts/loeschung_check.js).
//    Neu: Sperre fuer Ersteller einer Organisation VOR dem ersten Schritt
//    (organizations.created_by ist NOT NULL + RESTRICT — sonst blieb das Konto
//    stehen, NACHDEM Tabellen und Profil weg waren), Storage-Objekte unter
//    <uid>/ in jedem Bucket (bis dahin blieben Scan-Fotos nach dem Loeschen
//    liegen, waehrend der Dialog „Alle Scans & Bilder" versprach), und zwei
//    Tabellen ohne FK (ai_usage, species_search_log).
//
// v6 (v33.59) — ein laufendes Stripe-Abo wird VOR dem ersten Loeschschritt gekuendigt;
//    scheitert das (oder fehlt der Stripe-Schluessel), 409 abo_kuendigung und NICHTS geloescht
//    (bis dahin buchte Stripe nach dem Loeschen weiter ab). Regeln: zahlung_regeln.mjs
//    zuKuendigendeAbos, loeschung_regeln.mjs aboSperre.
//
// Auth: verify_jwt=true → Authorization-Header muss gültiger JWT sein.
// Sicherheits-Check: body.user_id MUSS == JWT-user.id sein (kein Foreign-Account-Delete).
//
// Reihenfolge:
//   0. Sperre: Ersteller einer Organisation → 409 org_creator, NICHTS geloescht
//   0b. laufende Stripe-Abos kuendigen; scheitert eines → 409 abo_kuendigung, NICHTS geloescht
//   1. Storage: alles unter <uid>/ in jedem Bucket (BUCKETS)
//   2. Tabellen mit user_id-Spalte (USER_TABLES, RLS-bypass via Service-Role)
//   3. profiles (id=uid)
//   4. supabase.auth.admin.deleteUser(uid) — die Kaskaden (FK ON DELETE CASCADE) raeumen den Rest
// Bei Fehlern in einzelnen Tabellen/Buckets: weitermachen, am Ende Counts zurückgeben.

import "jsr:@supabase/functions-js@2.119.0/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "jsr:@supabase/supabase-js@2.119.0";
import { USER_TABLES, BUCKETS, loeschSperre, sperreMeldung, speicherRaeumen, aboSperre, aboSperreMeldung } from "../_shared/loeschung_regeln.mjs";
import { zuKuendigendeAbos } from "../_shared/zahlung_regeln.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    let body: { user_id?: string } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const targetUid = body?.user_id;
    if (!targetUid) {
      return json(400, { error: "user_id required" });
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUid)) {
      return json(400, { error: "user_id must be UUID" });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { error: "Missing Bearer token" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !userData?.user) {
      return json(401, { error: "Not authenticated" });
    }
    const jwtUid = userData.user.id;

    if (jwtUid !== targetUid) {
      return json(403, { error: "Cannot delete another user's account" });
    }

    const admin = createClient(supabaseUrl, svcKey);

    // 0) Sperre — VOR dem ersten Loeschschritt, damit nie ein halbes Konto bleibt.
    try {
      const { data: orgs, error: orgErr } = await admin
        .from("organizations")
        .select("id,name")
        .eq("created_by", targetUid);
      if (!orgErr) {
        const sperre = loeschSperre(orgs ?? []);
        if (sperre.gesperrt) {
          return json(409, {
            ok: false,
            error: sperre.error,
            organizations: sperre.organizations,
            message: sperreMeldung(sperre),   // sbFetch reicht nur `message` weiter
          });
        }
      }
    } catch {
      // Tabelle fehlt → keine Sperre noetig
    }

    // 0b) Laufende Stripe-Abos kuendigen — ebenfalls VOR dem ersten Loeschschritt.
    {
      const { data: abos, error: aboErr } = await admin
        .from("stripe_subscriptions")
        .select("id,status,is_lifetime")
        .eq("user_id", targetUid);
      let offen: string[] = [];
      if (aboErr) {
        // Nicht lesbar heisst nicht „kein Abo" — ausser die Tabelle gibt es gar nicht.
        if (aboErr.code !== "42P01") offen = ["(nicht lesbar)"];
        console.error("[delete-user] stripe_subscriptions", aboErr.message);
      } else {
        offen = zuKuendigendeAbos(abos ?? []);
      }
      const nichtGekuendigt: string[] = [];
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (offen.length && (!stripeKey || aboErr)) {
        nichtGekuendigt.push(...offen);
      } else if (offen.length) {
        const stripe = new Stripe(stripeKey!, { apiVersion: "2024-12-18.acacia" });
        for (const id of offen) {
          try {
            await stripe.subscriptions.cancel(id);
          } catch (e) {
            // schon weg bei Stripe → nichts mehr zu kuendigen
            if ((e as any)?.code === "resource_missing") continue;
            console.error("[delete-user] Kuendigung", id, (e as Error)?.message ?? e);
            nichtGekuendigt.push(id);
          }
        }
      }
      const aboS = aboSperre(nichtGekuendigt);
      if (aboS.gesperrt) {
        return json(409, { ok: false, error: aboS.error, message: aboSperreMeldung(aboS) });
      }
    }

    const counts: Record<string, number | string> = {};

    // 1) Storage: alles unter <uid>/ — seitenweise, bis nichts mehr kommt.
    // v33.59: die Rechnung (auch Unterordner) steht in speicherRaeumen (_shared/loeschung_regeln.mjs).
    for (const bucket of BUCKETS) {
      counts["storage:" + bucket] = await speicherRaeumen(admin.storage, bucket, targetUid);
    }

    // 2) Cleanup aller user-Tabellen
    for (const tbl of USER_TABLES) {
      try {
        const { error, count } = await admin
          .from(tbl)
          .delete({ count: "exact" })
          .eq("user_id", targetUid);
        counts[tbl] = error ? `error: ${error.message}` : (count ?? 0);
      } catch (e) {
        counts[tbl] = `exception: ${(e as Error)?.message ?? e}`;
      }
    }

    // 3) profiles (id=uid)
    try {
      const { error, count } = await admin
        .from("profiles")
        .delete({ count: "exact" })
        .eq("id", targetUid);
      counts["profiles"] = error ? `error: ${error.message}` : (count ?? 0);
    } catch (e) {
      counts["profiles"] = `exception: ${(e as Error)?.message ?? e}`;
    }

    // 4) auth.users via Admin-API
    let authDeleted = false;
    let authError: string | null = null;
    try {
      const { error } = await admin.auth.admin.deleteUser(targetUid);
      if (error) {
        authError = error.message;
      } else {
        authDeleted = true;
      }
    } catch (e) {
      authError = (e as Error)?.message ?? String(e);
    }

    // Audit-Log (Schema: actor_id, action, target_type, target_id, diff, created_at)
    try {
      await admin.from("audit_log").insert({
        actor_id: targetUid,
        action: "delete_user",
        target_type: "user",
        target_id: targetUid,
        diff: { counts, auth_deleted: authDeleted, auth_error: authError },
        created_at: new Date().toISOString(),
      });
    } catch {
      // best-effort — keine Auswirkung auf Delete-Erfolg
    }

    return json(authDeleted ? 200 : 207, {
      ok: authDeleted,
      auth_deleted: authDeleted,
      auth_error: authError,
      tables: counts,
    });
  } catch (e) {
    console.error("[delete-user]", (e as Error)?.message ?? e);
    return json(500, { error: "delete_failed" });
  }
});
