// Stripe Billing Portal session
// v6 (2026-11-11): der erste Stand mit einem Prüfstand (scripts/stripe_check.js) — und das Repo
//   holt die ausgelieferte Fassung ein. Im Repo stand bis heute v3, live läuft seit dem
//   01.06.2026 v4/v5: ein Deploy aus dem Repo hätte den Fehler zurückgebracht, den v4 behoben hat
//   (`stripe_customers` gibt es nicht → 404 „No Stripe customer found" für JEDEN).
//   Neu gegenüber der ausgelieferten v5:
//   • Kunde und Rückkehr-Adresse kommen aus ../_shared/stripe_regeln.mjs — dieselbe Antwort wie
//     in stripe-checkout. Die Kunden-Id kommt nie aus der Anfrage.
//   • `return_url` ging ungeprüft an Stripe. Jetzt nur der eigene Ursprung, sonst die Vorgabe.
//   • „Kündigen" zeigte auf die NEUESTE Zeile der Person — nach einem Lifetime-Kauf ist das
//     `lifetime_<uuid>`, und Stripe antwortet „No such subscription" (500). Jetzt: das echte,
//     laufende Abo, sonst das Portal ohne Ziel.
//   • Sagt die Datenbank Nein, ist das ein Fehler (500) — kein „nie gekauft" (404).
//   • „Fortsetzen" öffnete die Seite zum WECHSELN des Plans (`subscription_update`) — so nennt
//     Stripe sie selbst; eine Kündigung nimmt man dort nicht zurück. Jetzt das gewöhnliche Portal.
//   • Lehnt Stripe den direkten Weg ab (Portal-Einstellung, das Abo sieht dort anders aus),
//     öffnet sich das gewöhnliche Portal statt einer Fehlermeldung.
//   • Kennt Stripe den gemerkten Kunden nicht (gelöscht, oder aus dem anderen Modus Test ↔ Live),
//     wird dort gesucht — und sonst gesagt, dass es keinen gibt (404), nicht 500.
// v4 (2026-06-01): Kunden-Id aus stripe_subscriptions.stripe_customer_id statt stripe_customers.
// v3 (2026-05-10): flow-Parameter für Cancel/Reactivate Direct-Flow + green-scan.ch URL-Fix
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  APP_URSPRUNG, kundeFinden, portalZiel, rueckkehrAdresse, stripeKenntNicht, stripeLehntAb, stripeSprache,
} from "../_shared/stripe_regeln.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json(503, { error: "Stripe not configured" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json(401, { error: "Not authenticated" });

    // Aus der Anfrage wird GENAU das gelesen: wohin zurück, ob gekündigt oder fortgesetzt werden soll,
    // und in welcher Sprache das Portal erscheint (de · fr · it · en, sonst die des Browsers).
    const body = await req.json().catch(() => ({}));
    const { return_url, flow, locale } = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    // Der Kunde der ANGEMELDETEN Person: aus ihren Abo-Zeilen, sonst über die Suche bei Stripe.
    const kunde = await kundeFinden({ admin, stripe, userId: user.id });
    if (!kunde.kundeId && kunde.sucheFehler) {
      // Keine Abo-Zeile, und die Suche bei Stripe ist gescheitert: das ist nicht „nie gekauft".
      console.error("[stripe-portal] Kunde bei Stripe nicht feststellbar: " + kunde.sucheFehler);
      return json(502, { error: "Stripe customer lookup failed", detail: kunde.sucheFehler });
    }
    if (!kunde.kundeId) {
      return json(404, { error: "No Stripe customer found", hint: "Noch kein Abo gestartet — das Portal gibt es erst nach dem ersten Kauf." });
    }

    const zurueck = rueckkehrAdresse(return_url, `${APP_URSPRUNG}/?billing=return`);
    if (zurueck.ersetzt) console.warn(`[stripe-portal] Rückkehr-Adresse ersetzt (${zurueck.grund})`);
    // Der direkte Weg gibt es nur fürs Kündigen (portalZiel); alles andere ist das gewöhnliche Portal.
    let ziel = portalZiel(kunde.zeilen, flow);
    const oeffne = (kundeId: string, zielAbo: string | null) => {
      const p: Record<string, unknown> = { customer: kundeId, return_url: zurueck.url, locale: stripeSprache(locale) };
      if (zielAbo) {
        p.flow_data = {
          type: "subscription_cancel",
          subscription_cancel: { subscription: zielAbo },
          after_completion: { type: "redirect", redirect: { return_url: `${APP_URSPRUNG}/?billing=canceled` } },
        };
      }
      return stripe.billingPortal.sessions.create(p as Stripe.BillingPortal.SessionCreateParams);
    };

    let session;
    try {
      session = await oeffne(kunde.kundeId, ziel);
    } catch (err) {
      if (kunde.quelle === "abo" && stripeKenntNicht(err, "customer")) {
        // Stripe kennt den GEMERKTEN Kunden nicht. Die gemerkten Abos gehören zu ihm — also ohne Ziel.
        const zweit = await kundeFinden({ admin, stripe, userId: user.id, ohneGemerkte: true });
        if (!zweit.kundeId && zweit.sucheFehler) {
          console.error("[stripe-portal] Kunde bei Stripe nicht feststellbar: " + zweit.sucheFehler);
          return json(502, { error: "Stripe customer lookup failed", detail: zweit.sucheFehler });
        }
        if (!zweit.kundeId || zweit.kundeId === kunde.kundeId) {
          console.warn("[stripe-portal] Stripe kennt den gemerkten Kunden " + kunde.kundeId + " nicht, und die Suche findet keinen anderen");
          return json(404, { error: "No Stripe customer found", grund: "kunde_unbekannt", hint: "Zu diesem Konto gibt es bei Stripe keinen Kunden (mehr) — bitte melde dich beim Support." });
        }
        console.warn("[stripe-portal] Stripe kennt den gemerkten Kunden " + kunde.kundeId + " nicht — weiter mit " + zweit.kundeId);
        ziel = null;
        session = await oeffne(zweit.kundeId, null);
      } else if (ziel && stripeLehntAb(err)) {
        // Der direkte Weg geht nicht — dann das gewöhnliche Portal, in dem sich dasselbe erledigen lässt.
        console.warn("[stripe-portal] direkter Weg „" + String(flow) + "\" abgelehnt (" + String((err as { message?: string })?.message ?? err) + ") — gewöhnliches Portal");
        ziel = null;
        session = await oeffne(kunde.kundeId, null);
      } else {
        throw err;
      }
    }
    return json(200, { url: session.url, flow: ziel ? flow : "default" });
  } catch (e) {
    const text = String((e as { message?: string })?.message ?? e);
    console.error("[stripe-portal] " + text);
    return json(500, { error: text });
  }
});
