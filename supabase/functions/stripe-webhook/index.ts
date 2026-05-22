// Stripe Webhook Handler
// v9 (2026-05-22): + account.updated Handler fuer v26.6 Marketplace-Connect.
//   Syncen marketplace_sellers.status / charges_enabled / payouts_enabled /
//   details_submitted / requirements bei jedem Stripe-Account-Update.
// v8 (2026-05-15): cache-bust deploy nach Webhook-Secret-Rotation (we_1TXfAuJnN3SSU2QNYb56og3J)
// v7: Expert-Verification fee_paid Handling fuer v25.26 Community-Feature.
// v6: cache-bust deploy nach Webhook-Secret-Rotation.
// v5 (2026-05-04): STRIPE_WEBHOOK_SECRET kann aus app_settings.stripe_webhook_secret gelesen werden.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { createClient } from "jsr:@supabase/supabase-js@2";

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, svcKey);

let cachedWebhookSecret: string | null = null;
async function getWebhookSecret(): Promise<string | null> {
  if (cachedWebhookSecret) return cachedWebhookSecret;
  const fromEnv = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (fromEnv) { cachedWebhookSecret = fromEnv; return fromEnv; }
  try {
    const { data } = await admin.from("app_settings").select("value").eq("key", "stripe_webhook_secret").maybeSingle();
    if (data?.value) { cachedWebhookSecret = data.value; return data.value; }
  } catch (_) {}
  return null;
}

async function resolveTier(priceId: string): Promise<string> {
  const { data } = await admin.from("stripe_prices").select("product_id, stripe_products(tier)").eq("id", priceId).maybeSingle();
  // @ts-ignore
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

  if (session.mode === "payment" && session.payment_status === "paid"
      && session.metadata?.kind === "expert_verification") {
    const postId = session.metadata.post_id;
    const expertId = session.metadata.expert_id;
    if (postId && expertId) {
      const amountChf = (session.amount_total ?? 0) / 100;
      await admin.from("expert_verifications").update({
        status: "verified",
        fee_paid_chf: amountChf,
        fee_paid_at: new Date().toISOString(),
        stripe_payment_intent_id: session.payment_intent as string
      }).eq("post_id", postId).eq("expert_id", expertId);
    }
    return;
  }

  if (session.mode === "payment" && session.payment_status === "paid") {
    const priceId = (session as any).line_items?.data?.[0]?.price?.id ?? null;
    let resolvedPriceId = priceId;
    if (!resolvedPriceId && session.id) {
      const stripe = new Stripe(stripeKey!, { apiVersion: "2024-12-18.acacia" });
      const li = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
      resolvedPriceId = li.data[0]?.price?.id ?? null;
    }
    const tier = resolvedPriceId ? await resolveTier(resolvedPriceId) : "pro";
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

async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
  if (pi.metadata?.kind !== "expert_verification") return;
  const postId = pi.metadata.post_id;
  const expertId = pi.metadata.expert_id;
  if (!postId || !expertId) return;
  const amountChf = pi.amount_received / 100;
  await admin.from("expert_verifications").update({
    status: "verified",
    fee_paid_chf: amountChf,
    fee_paid_at: new Date().toISOString(),
    stripe_payment_intent_id: pi.id
  }).eq("post_id", postId).eq("expert_id", expertId);
}

// v9 NEU: account.updated Handler fuer Marketplace-Connect (v26.6).
// Wird gefired bei jedem Stripe-Connect-Account-Change (Onboarding-Step,
// Requirement-Update, Capability-Aktivierung). Syncen marketplace_sellers
// damit die Settings-Row + Modal immer den korrekten Status zeigen.
async function handleAccountUpdated(account: Stripe.Account) {
  const userId = (account.metadata?.gs_user_id as string) ?? null;
  if (!userId) {
    // Fallback: Lookup via stripe_account_id falls metadata fehlt
    const { data: row } = await admin.from("marketplace_sellers")
      .select("user_id").eq("stripe_account_id", account.id).maybeSingle();
    if (!row?.user_id) {
      console.warn("[account.updated] no user_id for account", account.id);
      return;
    }
  }

  const chargesEnabled = !!account.charges_enabled;
  const payoutsEnabled = !!account.payouts_enabled;
  const detailsSubmitted = !!account.details_submitted;
  const currentlyDue = (account.requirements?.currently_due || []).length;
  const disabledReason = account.requirements?.disabled_reason;

  // Status-Mapping:
  //   - alle 3 enabled + 0 due  → active
  //   - details_submitted=false → pending (Onboarding noch nicht durch)
  //   - currently_due > 0       → restricted (Info fehlt)
  //   - disabled_reason gesetzt → disabled (Stripe hat Account gesperrt)
  let status: string;
  if (disabledReason) status = "disabled";
  else if (chargesEnabled && payoutsEnabled && detailsSubmitted && currentlyDue === 0) status = "active";
  else if (!detailsSubmitted) status = "pending";
  else status = "restricted";

  const patch: any = {
    status,
    charges_enabled: chargesEnabled,
    payouts_enabled: payoutsEnabled,
    details_submitted: detailsSubmitted,
    requirements: account.requirements ?? {},
    business_type: account.business_type ?? null,
    updated_at: new Date().toISOString(),
  };

  // Wenn wir einen gs_user_id im metadata haben: by user_id patchen.
  // Sonst: by stripe_account_id (account.id ist eindeutig in DB).
  if (userId) {
    await admin.from("marketplace_sellers")
      .update(patch).eq("user_id", userId);
  } else {
    await admin.from("marketplace_sellers")
      .update(patch).eq("stripe_account_id", account.id);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!stripeKey) return new Response("Stripe not configured", { status: 503 });
  const webhookSecret = await getWebhookSecret();
  if (!webhookSecret) return new Response("Webhook secret not configured", { status: 503 });

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
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
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
      case "account.updated":
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;
    }
    await admin.from("stripe_webhook_events").update({ processed_at: new Date().toISOString() }).eq("id", event.id);
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    await admin.from("stripe_webhook_events").update({ error: String(e) }).eq("id", event.id);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
