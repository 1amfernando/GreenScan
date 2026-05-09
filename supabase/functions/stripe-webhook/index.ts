// Stripe Webhook Handler — receives subscription events and syncs to DB
// v5 (2026-05-04): STRIPE_WEBHOOK_SECRET kann aus app_settings.stripe_webhook_secret gelesen werden
//                  (Fallback Env) — ermöglicht voll-automatischen Setup ohne UI-Eingriff.
// Cowork-deployed via Supabase MCP 2026-05-04 — ersetzt vorherige Audit-only-Version.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { createClient } from "jsr:@supabase/supabase-js@2";

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, svcKey);

// Cache für webhook secret — ein 1× Lookup pro Process-Lifetime
let cachedWebhookSecret: string | null = null;
async function getWebhookSecret(): Promise<string | null> {
  if (cachedWebhookSecret) return cachedWebhookSecret;
  // 1) Env-Variable hat Vorrang
  const fromEnv = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (fromEnv) { cachedWebhookSecret = fromEnv; return fromEnv; }
  // 2) Fallback: app_settings.stripe_webhook_secret (von stripe-setup-webhook gepflegt)
  try {
    const { data } = await admin.from("app_settings").select("value").eq("key", "stripe_webhook_secret").maybeSingle();
    if (data?.value) { cachedWebhookSecret = data.value; return data.value; }
  } catch (_) { /* swallow */ }
  return null;
}

async function resolveTier(priceId: string): Promise<string> {
  const { data } = await admin.from("stripe_prices").select("product_id, stripe_products(tier)").eq("id", priceId).maybeSingle();
  // @ts-ignore nested return
  return data?.stripe_products?.tier ?? "free";
}

async function upsertSubscription(sub: Stripe.Subscription) {
  const priceId = sub.items.data[0]?.price.id;
  const userId = (sub.metadata?.supabase_user_id as string) ?? null;
  if (!userId) return;
  const tier = priceId ? await resolveTier(priceId) : "free";

  await admin.from("stripe_subscriptions").upsert({
    id: sub.id,
    user_id: userId,
    stripe_customer_id: sub.customer as string,
    price_id: priceId ?? null,
    tier,
    status: sub.status,
    cancel_at_period_end: sub.cancel_at_period_end,
    current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
    ended_at: sub.ended_at ? new Date(sub.ended_at * 1000).toISOString() : null,
    metadata: sub.metadata as any,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.supabase_user_id;
  if (!userId) return;

  if (session.mode === "payment" && session.payment_status === "paid") {
    const priceId = (session as any).line_items?.data?.[0]?.price?.id ?? null;
    let resolvedPriceId = priceId;
    if (!resolvedPriceId && session.id) {
      const stripe = new Stripe(stripeKey!, { apiVersion: "2024-12-18.acacia" });
      const li = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
      resolvedPriceId = li.data[0]?.price?.id ?? null;
    }
    const tier = resolvedPriceId ? await resolveTier(resolvedPriceId) : "plus";

    const subId = `lifetime_${userId}`;
    await admin.from("stripe_subscriptions").upsert({
      id: subId,
      user_id: userId,
      stripe_customer_id: session.customer as string,
      price_id: resolvedPriceId,
      tier,
      status: "active",
      is_launch_lifetime: true,
      current_period_start: new Date().toISOString(),
      current_period_end: null,
      metadata: session.metadata as any,
    }, { onConflict: "id" });

    if (session.metadata?.claim_launch_offer === "1") {
      await admin.from("launch_offer_usage").upsert({ user_id: userId, subscription_id: subId }, { onConflict: "user_id" });
    }
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!stripeKey) return new Response("Stripe not configured", { status: 503 });
  const webhookSecret = await getWebhookSecret();
  if (!webhookSecret) return new Response("Webhook secret not configured (set STRIPE_WEBHOOK_SECRET env or app_settings.stripe_webhook_secret)", { status: 503 });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (e) {
    return new Response(`Webhook signature verification failed: ${(e as Error).message}`, { status: 400 });
  }

  // Idempotency check
  const { data: existing } = await admin.from("stripe_webhook_events").select("processed_at").eq("id", event.id).maybeSingle();
  if (existing?.processed_at) return new Response("Already processed", { status: 200 });
  await admin.from("stripe_webhook_events").upsert({ id: event.id, type: event.type, payload: event as any });

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await upsertSubscription(event.data.object as Stripe.Subscription);
        break;
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "invoice.paid":
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        if (inv.subscription) {
          const sub = await stripe.subscriptions.retrieve(inv.subscription as string);
          await upsertSubscription(sub);
        }
        break;
      }
    }
    await admin.from("stripe_webhook_events").update({ processed_at: new Date().toISOString() }).eq("id", event.id);
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    await admin.from("stripe_webhook_events").update({ error: String(e) }).eq("id", event.id);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
