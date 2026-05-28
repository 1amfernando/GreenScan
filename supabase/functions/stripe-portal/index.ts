// Stripe Billing Portal session
// v3 (2026-05-10): flow-Parameter für Cancel/Reactivate Direct-Flow + green-scan.ch URL-Fix
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://green-scan.ch";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return new Response(JSON.stringify({ error: "Stripe not configured" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { return_url, flow } = await req.json().catch(() => ({}));
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, svcKey);
    const { data: customer } = await admin.from("stripe_customers").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
    if (!customer) return new Response(JSON.stringify({ error: "No Stripe customer found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    // v3: flow_data für Direct-Cancel/Reactivate
    const portalParams: Stripe.BillingPortal.SessionCreateParams = {
      customer: customer.stripe_customer_id,
      return_url: return_url ?? `${APP_URL}/?billing=return`,
    };

    if (flow === "cancel" || flow === "reactivate") {
      // Hole letzte aktive subscription des Users
      const { data: subs } = await admin
        .from("stripe_subscriptions")
        .select("id, status, cancel_at_period_end")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const sub = subs?.[0];

      if (sub) {
        if (flow === "cancel") {
          (portalParams as any).flow_data = {
            type: "subscription_cancel",
            subscription_cancel: { subscription: sub.id },
            after_completion: { type: "redirect", redirect: { return_url: `${APP_URL}/?billing=canceled` } },
          };
        } else if (flow === "reactivate") {
          (portalParams as any).flow_data = {
            type: "subscription_update",
            subscription_update: { subscription: sub.id },
            after_completion: { type: "redirect", redirect: { return_url: `${APP_URL}/?billing=reactivated` } },
          };
        }
      }
    }

    const session = await stripe.billingPortal.sessions.create(portalParams);

    return new Response(JSON.stringify({ url: session.url, flow: flow || "default" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
