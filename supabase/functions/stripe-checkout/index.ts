// Stripe Checkout Session creator
// v8 (2026-06-14): automatic_payment_methods statt expliziter Liste — eine im Dashboard NICHT aktivierte
//   Methode bricht den Checkout nicht mehr ab; aktivierte Methoden (Karte, TWINT für CHF, …) erscheinen
//   automatisch ohne Code-Änderung. Früher: payment_method_types ['card','twint'] → wenn TWINT nicht
//   aktiviert war, schlug der GANZE CHF-Checkout fehl. payment_method_collection='always' für Abos
//   (Karte auch während Trial hinterlegen → nahtlose Verlängerung).
// v6 (2026-05-13): Trial-Cap max 7 Tage. v5: trial_days. v4: Schema-Fix interval/is_launch_offer.
// v33.59 (Sicherheitspruefung 10.11.2026): die Rechnung liegt in ../_shared/zahlung_regeln.mjs
//   (Pruefstand scripts/edge/10_stripe.js) — Rueckkehr-Adressen nur eigene Urspruenge, Preis nur
//   aus dem AKTIVEN Katalog, Launch-Deckel entscheidet der Server (das Flag des Clients ist nur ein
//   Wunsch), Kunden-Id aus stripe_subscriptions (stripe_customers gibt es live nicht), Gratisphase
//   nur bei beantworteter Frage, Fehler als Kennung statt Rohtext.
import "jsr:@supabase/functions-js@2.119.0/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "jsr:@supabase/supabase-js@2.119.0";
import { rueckkehrAdresse, preisErlaubt, preisIntervall, istLaunchPreis, launchDeckel, launchAngebot, gratisTage, kundenId, fehlerCode } from "../_shared/zahlung_regeln.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://green-scan.ch";
const MAX_TRIAL_DAYS = 7;
const DEFAULT_TRIAL_DAYS = 7;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured. Set STRIPE_SECRET_KEY." }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { price_id, success_url, cancel_url, trial_days } = await req.json();
    if (!price_id) return new Response(JSON.stringify({ error: "price_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, svcKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });
    const antwort = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // v33.59: nur ein Preis aus dem AKTIVEN Katalog (vorher: jede price_id, unbekannt → still Monatsabo).
    const { data: priceRow, error: priceErr } = await admin
      .from("stripe_prices")
      .select("id, active, recurring, metadata, currency")
      .eq("id", price_id)
      .eq("active", true)
      .maybeSingle();
    if (priceErr) { console.error("[stripe-checkout] stripe_prices", priceErr.message); return antwort(503, { error: "katalog_nicht_lesbar" }); }
    const priceRec = preisErlaubt(String(price_id), priceRow);
    const interval = preisIntervall(priceRec);
    if (!priceRec || !interval) return antwort(400, { error: "unbekannter_preis" });
    const mode = interval === "lifetime" ? "payment" : "subscription";

    // v33.59: Launch-Angebot entscheidet der SERVER am Preis — gezaehlt mit Service-Role.
    // (launch_offer_available() lieferte ein jsonb-OBJEKT, also immer „wahr", und lief ohne
    // auth.uid() — der Deckel galt nie.)
    const isLaunchOffer = istLaunchPreis(priceRec);
    if (isLaunchOffer) {
      const { count: vergeben, error: cntErr } = await admin.from("launch_offer_usage").select("user_id", { count: "exact", head: true });
      const { data: eigene, error: ownErr } = await admin.from("launch_offer_usage").select("user_id").eq("user_id", user.id).limit(1);
      if (cntErr || ownErr) console.error("[stripe-checkout] launch_offer_usage", (cntErr || ownErr)?.message);
      const lo = launchAngebot({
        preisIstLaunch: true,
        beansprucht: ownErr ? null : (eigene ?? []).length > 0,
        vergeben: cntErr ? null : vergeben,
        deckel: launchDeckel(priceRec),
      });
      if (!lo.erlaubt) return antwort(410, { error: "launch_" + lo.grund });
    }

    // v33.59: Kunden-Id aus den eigenen Abo-Zeilen (stripe_customers existiert live nicht —
    // jeder Aufruf legte einen neuen Stripe-Kunden an). Dieselbe Abfrage beantwortet die Gratisphase.
    const { data: prevSubs, error: subsErr } = await admin
      .from("stripe_subscriptions")
      .select("id, stripe_customer_id, customer_id")
      .eq("user_id", user.id)
      .limit(20);
    if (subsErr) console.error("[stripe-checkout] stripe_subscriptions", subsErr.message);
    let customerId = kundenId(prevSubs ?? []);
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email ?? undefined, metadata: { supabase_user_id: user.id } });
      customerId = customer.id;
    }

    // v6: Trial-Logic — first-sub-only, Cap auf MAX_TRIAL_DAYS (7); v33.59: Abfragefehler → keine Gratisphase
    const safeTrialDays = mode === "subscription"
      ? gratisTage({ wunsch: trial_days, fruehereAbos: subsErr ? null : (prevSubs ?? []), abfrageFehler: subsErr, max: MAX_TRIAL_DAYS, vorgabe: DEFAULT_TRIAL_DAYS })
      : 0;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode,
      line_items: [{ price: price_id, quantity: 1 }],
      success_url: rueckkehrAdresse(success_url, `${APP_URL}/?billing=success&session_id={CHECKOUT_SESSION_ID}`),
      cancel_url: rueckkehrAdresse(cancel_url, `${APP_URL}/?billing=cancel`),
      subscription_data: mode === "subscription"
        ? {
            metadata: { supabase_user_id: user.id },
            ...(safeTrialDays > 0 ? { trial_period_days: safeTrialDays } : {}),
          }
        : undefined,
      metadata: { supabase_user_id: user.id, claim_launch_offer: isLaunchOffer ? "1" : "0" },
      allow_promotion_codes: true,
      locale: "de",
      // v8: Stripe zeigt automatisch alle im Dashboard aktivierten + passenden Methoden (Karte immer,
      // TWINT bei CHF sobald aktiviert, SEPA bei EUR, …). Eine inaktive Methode bricht den Checkout NICHT ab.
      automatic_payment_methods: { enabled: true },
    };
    // Abos: Zahlungsmethode auch bei Gratis-Trial hinterlegen → nahtlose Verlängerung nach Trial-Ende.
    if (mode === "subscription") {
      sessionParams.payment_method_collection = "always";
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(JSON.stringify({
      url: session.url,
      session_id: session.id,
      mode,
      payment_methods: "automatic",
      trial_days: safeTrialDays,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    // v33.59: Rohtext nur ins Protokoll — er nannte Preis-Ids und den Stripe-Modus.
    console.error("[stripe-checkout]", (e as any)?.message ?? e);
    const f = fehlerCode(e, "checkout_failed");
    return new Response(JSON.stringify({ error: f.error }), { status: f.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
