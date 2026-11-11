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
// v4 (2026-06-01): Kunden-Id aus stripe_subscriptions.stripe_customer_id statt stripe_customers.
// v3 (2026-05-10): flow-Parameter für Cancel/Reactivate Direct-Flow + green-scan.ch URL-Fix
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { APP_URSPRUNG, kundeFinden, portalZiel, rueckkehrAdresse } from "../_shared/stripe_regeln.mjs";

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

    // Aus der Anfrage wird GENAU das gelesen: wohin zurück, und ob gekündigt oder fortgesetzt werden soll.
    const body = await req.json().catch(() => ({}));
    const { return_url, flow } = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

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
    const portalParams: Record<string, unknown> = { customer: kunde.kundeId, return_url: zurueck.url };

    const ziel = portalZiel(kunde.zeilen, flow);
    if (ziel && flow === "cancel") {
      portalParams.flow_data = {
        type: "subscription_cancel",
        subscription_cancel: { subscription: ziel },
        after_completion: { type: "redirect", redirect: { return_url: `${APP_URSPRUNG}/?billing=canceled` } },
      };
    } else if (ziel && flow === "reactivate") {
      portalParams.flow_data = {
        type: "subscription_update",
        subscription_update: { subscription: ziel },
        after_completion: { type: "redirect", redirect: { return_url: `${APP_URSPRUNG}/?billing=reactivated` } },
      };
    }

    const session = await stripe.billingPortal.sessions.create(portalParams as Stripe.BillingPortal.SessionCreateParams);
    return json(200, { url: session.url, flow: ziel ? flow : "default" });
  } catch (e) {
    const text = String((e as { message?: string })?.message ?? e);
    console.error("[stripe-portal] " + text);
    return json(500, { error: text });
  }
});
