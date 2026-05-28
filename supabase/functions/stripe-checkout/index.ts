// Stripe Checkout Session creator
// v6 (2026-05-13): Trial-Cap von max 30 auf max 7 Tage (Fernando-Wunsch). Default-Trial 7 wenn first-sub und kein expliziter trial_days gesetzt.
// v5 (2026-05-10): trial_days-Support fuer First-Subscription
// v4 (2026-05-09): Schema-Fix interval/is_launch_offer, green-scan.ch URLs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://green-scan.ch";
const MAX_TRIAL_DAYS = 7;        // v6: gecappt von 30 auf 7
const DEFAULT_TRIAL_DAYS = 7;    // v6: Default fuer First-Sub

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured. Set STRIPE_SECRET_KEY." }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { price_id, success_url, cancel_url, claim_launch_offer, trial_days } = await req.json();
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

    if (claim_launch_offer) {
      const { data: avail } = await admin.rpc("launch_offer_available");
      if (!avail) return new Response(JSON.stringify({ error: "Launch offer fully booked" }), { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let customerId: string;
    const { data: existing } = await admin.from("stripe_customers").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
    if (existing) {
      customerId = existing.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({ email: user.email ?? undefined, metadata: { supabase_user_id: user.id } });
      customerId = customer.id;
      await admin.from("stripe_customers").insert({ user_id: user.id, stripe_customer_id: customerId, email: user.email });
    }

    const { data: priceRec } = await admin
      .from("stripe_prices")
      .select("recurring, metadata, currency")
      .eq("id", price_id)
      .maybeSingle();

    const interval = (priceRec?.recurring as any)?.interval
                  || (priceRec?.metadata as any)?.interval
                  || "month";
    const isLaunchOffer = (priceRec?.metadata as any)?.is_launch_offer === true
                       || (priceRec?.metadata as any)?.is_launch_offer === "1";
    const mode = interval === "lifetime" ? "payment" : "subscription";

    const currency = (priceRec?.currency || "chf").toLowerCase();
    let payment_method_types: string[] = ["card"];
    if (currency === "chf") payment_method_types.push("twint");
    if (currency === "eur") payment_method_types.push("sepa_debit");

    // v6: Trial-Logic — first-sub-only, Cap auf MAX_TRIAL_DAYS (7)
    let safeTrialDays = 0;
    if (mode === "subscription") {
      const { data: prevSubs } = await admin
        .from("stripe_subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);
      const isFirstSub = !prevSubs || prevSubs.length === 0;
      if (isFirstSub) {
        if (typeof trial_days === "number" && trial_days > 0) {
          safeTrialDays = Math.min(trial_days, MAX_TRIAL_DAYS);
        } else if (trial_days === undefined || trial_days === null) {
          // Default: 7 Tage Trial fuer alle First-Subs (v6 Fernando-Wunsch)
          safeTrialDays = DEFAULT_TRIAL_DAYS;
        }
      }
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode,
      line_items: [{ price: price_id, quantity: 1 }],
      success_url: success_url ?? `${APP_URL}/?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url ?? `${APP_URL}/?billing=cancel`,
      subscription_data: mode === "subscription"
        ? {
            metadata: { supabase_user_id: user.id },
            ...(safeTrialDays > 0 ? { trial_period_days: safeTrialDays } : {}),
          }
        : undefined,
      metadata: { supabase_user_id: user.id, claim_launch_offer: claim_launch_offer ? "1" : "0" },
      allow_promotion_codes: true,
      locale: "de",
      payment_method_types,
    };

    if (payment_method_types.includes("sepa_debit") && mode === "subscription") {
      sessionParams.payment_method_collection = "always";
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(JSON.stringify({
      url: session.url,
      session_id: session.id,
      mode,
      payment_methods: payment_method_types,
      trial_days: safeTrialDays,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
