// Stripe Billing Portal session
// v6 (v33.63, 19.11.2026): EINE Fassung aus main (v33.59) und PR #329 (Auftrag P-C2). Ablauf von #329,
//   Rand von main (exakte Versionen, Fehler nur als KENNUNG — nie die Stripe-Meldung, die u.a. den
//   Modus test/live nennt; Rueckkehr nur auf die eigenen Urspruenge, popup=1 bleibt):
//   • Kunde ueber `kundeFinden` (dieselbe Antwort wie stripe-checkout): Abo-Zeile, sonst Suche bei
//     Stripe; ein Nein der Datenbank ist 500, nicht „nie gekauft" (404).
//   • „Kuendigen" zeigt auf das echte, laufende Abo (`portalZiel`) — nie auf `lifetime_<uuid>`
//     (Stripe: „No such subscription", bis v33.62 500).
//   • „Fortsetzen" oeffnet das gewoehnliche Portal — `subscription_update` ist bei Stripe die Seite
//     zum WECHSELN des Plans.
//   • Lehnt Stripe den direkten Weg ab, oeffnet sich das gewoehnliche Portal.
//   • Kennt Stripe den gemerkten Kunden nicht (geloescht, anderer Modus): suchen, sonst 404 `kunde_unbekannt`.
// v4 (2026-06-01): Kunden-Id aus stripe_subscriptions. v3 (2026-05-10): flow-Parameter.
import "jsr:@supabase/functions-js@2.119.0/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "jsr:@supabase/supabase-js@2.119.0";
import { fehlerCode, kundeFinden, portalZiel, rueckkehrAdresse, stripeKenntNicht, stripeLehntAb, stripeSprache } from "../_shared/zahlung_regeln.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const APP_URL = "https://green-scan.ch";
const antwort = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const nein = (status: number, kennung: string, hint?: string) => antwort(status, { error: kennung, grund: kennung, ...(hint ? { hint } : {}) });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return nein(503, "zahlung_nicht_eingerichtet");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return nein(401, "nicht_angemeldet");

    // Aus der Anfrage: wohin zurueck, ob gekuendigt oder fortgesetzt werden soll, in welcher Sprache.
    const body = await req.json().catch(() => ({}));
    const { return_url, flow, locale } = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    const kunde = await kundeFinden({ admin, stripe, userId: user.id });
    if (!kunde.kundeId && kunde.sucheFehler) {
      console.error("[stripe-portal] Kunde bei Stripe nicht feststellbar: " + kunde.sucheFehler);
      return nein(502, "zahlungsdienst_nicht_erreichbar");
    }
    if (!kunde.kundeId) return nein(404, "kein_kunde", "Noch kein Abo gestartet — das Portal gibt es erst nach dem ersten Kauf.");

    const zurueck = rueckkehrAdresse(return_url, `${APP_URL}/?billing=return`);
    let ziel = portalZiel(kunde.zeilen, flow);
    const oeffne = (kundeId: string, zielAbo: string | null) => {
      const p: Record<string, unknown> = { customer: kundeId, return_url: zurueck, locale: stripeSprache(locale) };
      if (zielAbo) {
        p.flow_data = {
          type: "subscription_cancel",
          subscription_cancel: { subscription: zielAbo },
          after_completion: { type: "redirect", redirect: { return_url: `${APP_URL}/?billing=canceled` } },
        };
      }
      return stripe.billingPortal.sessions.create(p as Stripe.BillingPortal.SessionCreateParams);
    };

    let session;
    try {
      session = await oeffne(kunde.kundeId, ziel);
    } catch (err) {
      if (kunde.quelle === "abo" && stripeKenntNicht(err, "customer")) {
        // Stripe kennt den GEMERKTEN Kunden nicht. Die gemerkten Abos gehoeren zu ihm — also ohne Ziel.
        const zweit = await kundeFinden({ admin, stripe, userId: user.id, ohneGemerkte: true });
        if (!zweit.kundeId && zweit.sucheFehler) {
          console.error("[stripe-portal] Kunde bei Stripe nicht feststellbar: " + zweit.sucheFehler);
          return nein(502, "zahlungsdienst_nicht_erreichbar");
        }
        if (!zweit.kundeId || zweit.kundeId === kunde.kundeId) {
          console.warn("[stripe-portal] Stripe kennt den gemerkten Kunden " + kunde.kundeId + " nicht, und die Suche findet keinen anderen");
          return nein(404, "kunde_unbekannt", "Zu diesem Konto gibt es bei Stripe keinen Kunden (mehr) — bitte melde dich beim Support.");
        }
        console.warn("[stripe-portal] Stripe kennt den gemerkten Kunden " + kunde.kundeId + " nicht — weiter mit " + zweit.kundeId);
        ziel = null;
        session = await oeffne(zweit.kundeId, null);
      } else if (ziel && stripeLehntAb(err)) {
        // Der direkte Weg geht nicht — dann das gewoehnliche Portal, in dem sich dasselbe erledigen laesst.
        console.warn("[stripe-portal] direkter Weg abgelehnt — gewoehnliches Portal", (err as any)?.message ?? err);
        ziel = null;
        session = await oeffne(kunde.kundeId, null);
      } else {
        throw err;
      }
    }
    return antwort(200, { url: session.url, flow: ziel ? flow : "default" });
  } catch (e) {
    console.error("[stripe-portal]", (e as any)?.message ?? e);
    const f = fehlerCode(e, "portal_failed");
    return nein(f.status, f.error);
  }
});
