// delete-user — Account-Wipe + auth.users-Delete (Service-Role)
// v23.92.1 (2026-04-28) — audit_log Schema-Fix: details → diff, plus target_type/actor_id
// v4 (2026-06-01, v26.76) — legacy_profiles-Block entfernt (Tabelle via Cleanup-Migration gedroppt).
//
// Auth: verify_jwt=true → Authorization-Header muss gültiger JWT sein.
// Sicherheits-Check: body.user_id MUSS == JWT-user.id sein (kein Foreign-Account-Delete).
//
// Cleanup-Reihenfolge:
//   1. 35 Tabellen mit user_id-Spalte (defensive, RLS-bypass via Service-Role)
//   2. profiles (id=uid)
//   3. supabase.auth.admin.deleteUser(uid)
// Bei Fehlern in einzelnen Tabellen: weitermachen, am Ende Counts zurückgeben.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 35 Tabellen mit user_id-Spalte — verifiziert via information_schema.columns
const USER_TABLES = [
  "abo_events",
  "ai_queries",
  "book_ingest_jobs",
  "feedback_items",
  "friendships",
  "garden_diary",
  "garden_harvests",
  "garden_plantings",
  "garden_tasks",
  "gardens",
  "launch_offer_usage",
  "marketplace_listings",
  "notifications",
  "plant_diagnoses",
  "post_comments",
  "post_likes",
  "push_subscriptions",
  "quiz_answers",
  "quiz_ranking",
  "scan_corrections",
  "scan_events",
  "sensor_alerts",
  "sensor_devices",
  "sensor_readings",
  "social_posts",
  "species_proposals",
  "species_watchlist",
  "stripe_subscriptions",
  "user_gardens",
  "user_plants",
  "user_preferences",
  "user_quest_progress",
  "user_scans",
  "user_species",
  "user_submissions",
];

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
      return json(400, { error: "Invalid JSON body" });
    }
    const targetUid = (body.user_id || "").trim();
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

    // 1) Cleanup aller user-Tabellen
    const counts: Record<string, number | string> = {};
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

    // 2) profiles (id=uid)
    try {
      const { error, count } = await admin
        .from("profiles")
        .delete({ count: "exact" })
        .eq("id", targetUid);
      counts["profiles"] = error ? `error: ${error.message}` : (count ?? 0);
    } catch (e) {
      counts["profiles"] = `exception: ${(e as Error)?.message ?? e}`;
    }

    // 3) auth.users via Admin-API
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
    return json(500, { error: String((e as Error)?.message ?? e) });
  }
});
