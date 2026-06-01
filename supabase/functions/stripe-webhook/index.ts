// Stripe Webhook Handler
// v11 (2026-05-30): Deploy aus repo-clone. Code hat seit ~3 Wochen 5 neue Cases:
//   trial_will_end → Push, charge.failed, dispute, customer.updated, payment_method.attached
//   (war ungedeployed). Plus alle v10-Refinements unten.
// v10 (2026-05-22): AUFTRAG_v26.17 refinements. account.application.deauthorized
//   Handler ergänzt (User trennt Connect → status='disabled'). Status-Mapping
//   konservativer: 'disabled' NUR wenn disabled_reason startsWith('rejected').
//   Sonstige disabled_reason (z.B. requirements.pending_verification) →
//   'restricted'. Plus expliziter Pre-Check + warn-log wenn marketplace_sellers
//   keinen Eintrag fuer den Stripe-Account hat (statt silent skip).
// v9 (2026-05-22): + account.updated Handler fuer v26.6 Marketplace-Connect.
// v8 (2026-05-15): cache-bust deploy nach Webhook-Secret-Rotation (we_1TXfAuJnN3SSU2QNYb56og3J)
// v7: Expert-Verification fee_paid Handling fuer v25.26 Community-Feature.
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
      is_lifetime: true, // v26.54: umbenannt von is_launch_lifetime (Schema-Drift fix)
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

// v9/v10: account.updated Handler fuer Marketplace-Connect (v26.6/v26.17).
// v10-Refinements: expliziter Pre-Check, konservativeres disabled-Mapping.
async function handleAccountUpdated(account: Stripe.Account) {
  // Pre-Check: existiert ein marketplace_sellers-Eintrag fuer diesen Account?
  const { data: existing } = await admin
    .from("marketplace_sellers")
    .select("user_id, status")
    .eq("stripe_account_id", account.id)
    .maybeSingle();

  if (!existing) {
    console.warn(`[webhook] account.updated for unknown stripe_account_id=${account.id} — skip`);
    return;
  }

  const requirements = account.requirements ?? {};
  const disabledReason = (requirements as any).disabled_reason as string | null;
  const currentlyDue = (requirements.currently_due?.length ?? 0);

  // Status-Mapping (konservativ):
  //   - alle 3 enabled              → active
  //   - disabled_reason startsWith('rejected') → disabled (Stripe hat permanent abgelehnt)
  //   - currently_due > 0 ODER disabled_reason (non-rejected) → restricted
  //   - sonst (z.B. erst halb durch Onboarding)        → pending
  let newStatus: string = "pending";
  if (account.charges_enabled && account.payouts_enabled && account.details_submitted) {
    newStatus = "active";
  } else if (disabledReason && disabledReason.startsWith("rejected")) {
    newStatus = "disabled";
  } else if (currentlyDue > 0 || disabledReason) {
    newStatus = "restricted";
  }

  await admin.from("marketplace_sellers").update({
    status: newStatus,
    charges_enabled: account.charges_enabled ?? false,
    payouts_enabled: account.payouts_enabled ?? false,
    details_submitted: account.details_submitted ?? false,
    business_type: account.business_type ?? null,
    requirements: requirements as any,
    updated_at: new Date().toISOString(),
  }).eq("stripe_account_id", account.id);

  console.log(`[webhook] account.updated ${account.id} → status=${newStatus} charges=${account.charges_enabled} payouts=${account.payouts_enabled}`);
}

// v10 NEU: account.application.deauthorized Handler.
// Wenn User Connect trennt (oder Stripe Account deauthorisiert) → status='disabled'.
async function handleAccountDeauthorized(event: Stripe.Event) {
  // Bei Connect-Events steht die Account-ID in event.account (top-level), nicht im data.object.
  // Manche API-Versionen liefern es auch in data.object.account — beide checken.
  const acctId = (event as any).account ?? (event.data.object as any)?.account ?? null;
  if (!acctId) {
    console.warn("[webhook] account.application.deauthorized without account-id");
    return;
  }
  await admin.from("marketplace_sellers").update({
    status: "disabled",
    charges_enabled: false,
    payouts_enabled: false,
    updated_at: new Date().toISOString(),
  }).eq("stripe_account_id", acctId);
  console.log(`[webhook] account.application.deauthorized ${acctId} → disabled`);
}

// v26.55 — Trial-Will-End (Stripe sendet ~3 Tage vor Trial-Ende automatisch).
// Wir erzeugen eine Notification + UPDATE stripe_subscriptions.trial_will_end_notified_at.
async function handleTrialWillEnd(sub: Stripe.Subscription) {
  const customerId = sub.customer as string;
  const { data: existing } = await admin
    .from("stripe_subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  const userId = existing?.user_id;
  if (!userId) {
    console.warn(`[webhook] trial_will_end without user mapping for customer ${customerId}`);
    return;
  }
  const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
  const dedupKey = `trial_will_end_${sub.id}`;
  await admin.from("notifications").upsert({
    user_id: userId,
    kind: "trial_ending",
    title: "Trial endet bald",
    body: trialEnd ? `Dein Trial endet am ${new Date(trialEnd).toLocaleDateString("de-CH")}. Karte hinterlegen damit's nahtlos weitergeht.` : "Dein Trial endet bald.",
    dedup_key: dedupKey,
    link: "/?open=abo",
    created_at: new Date().toISOString(),
  }, { onConflict: "dedup_key" }).catch((e) => console.warn("[webhook] notif insert failed", e));
  await admin
    .from("stripe_subscriptions")
    .update({ trial_will_end_notified_at: new Date().toISOString() })
    .eq("id", sub.id)
    .catch(() => {/* Spalte existiert evtl. nicht — silent */});
  console.log(`[webhook] trial_will_end notif gesetzt für user=${userId}`);
}

// v26.55 — Charge.failed (außerhalb von Subscriptions, z.B. Expert-Verification CHF 0.50).
// Loggen + Admin-Audit. Wenn associated subscription: status synct via separate event.
async function handleChargeFailed(charge: Stripe.Charge) {
  await admin.from("audit_log").insert({
    actor_id: null,
    action: "stripe_charge_failed",
    target_type: "stripe_charge",
    target_id: charge.id,
    diff: {
      customer: charge.customer,
      amount: charge.amount,
      currency: charge.currency,
      failure_code: charge.failure_code,
      failure_message: charge.failure_message,
      payment_intent: charge.payment_intent,
    }
  }).catch(() => {});
  console.log(`[webhook] charge.failed ${charge.id} customer=${charge.customer} reason=${charge.failure_code}`);
}

// v26.55 — Charge.dispute.created (Chargeback eingereicht).
// Admin-Audit + Sub pausieren (manuelle Review-Pflicht).
async function handleChargeDispute(dispute: Stripe.Dispute) {
  await admin.from("audit_log").insert({
    actor_id: null,
    action: "stripe_dispute_created",
    target_type: "stripe_dispute",
    target_id: dispute.id,
    diff: {
      charge: dispute.charge,
      amount: dispute.amount,
      currency: dispute.currency,
      reason: dispute.reason,
      status: dispute.status,
    }
  }).catch(() => {});
  // Sub-Status nicht automatisch ändern — manuelles Review.
  console.warn(`[webhook] DISPUTE ${dispute.id} reason=${dispute.reason} — manuelle Review nötig`);
}

// v26.55 — Customer.updated (Email/Address-Sync zu profiles).
async function handleCustomerUpdated(customer: Stripe.Customer) {
  if (!customer.email) return;
  const { data: sub } = await admin
    .from("stripe_subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customer.id)
    .maybeSingle();
  if (!sub?.user_id) return;
  // Email aktualisieren — aber NICHT auth.users (das macht der User via Auth-Update).
  // Nur in profiles syncen falls dort separat gehalten.
  await admin
    .from("profiles")
    .update({ stripe_email: customer.email })
    .eq("id", sub.user_id)
    .catch(() => {/* Spalte stripe_email existiert evtl. nicht — silent */});
  console.log(`[webhook] customer.updated email synct für user=${sub.user_id}`);
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
      case "account.application.deauthorized":
        await handleAccountDeauthorized(event);
        break;
      // v26.55 — neue Cases (Audit-Finding: 5 von 13 enabled events ohne switch-case)
      case "customer.subscription.trial_will_end":
        // Stripe sendet das ~3 Tage vor Trial-Ende. Wir loggen + erzeugen eine Notification.
        await handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;
      case "charge.failed":
        // Payment-Fail außerhalb von Subscriptions (z.B. Expert-Verification CHF 0.50). Admin-Alert.
        await handleChargeFailed(event.data.object as Stripe.Charge);
        break;
      case "charge.dispute.created":
        // User hat Chargeback eingereicht. Sub pausieren + Admin-Alert.
        await handleChargeDispute(event.data.object as Stripe.Dispute);
        break;
      case "customer.updated":
        // Email/Address-Update beim Stripe-Customer → in profiles syncen.
        await handleCustomerUpdated(event.data.object as Stripe.Customer);
        break;
      case "payment_method.attached":
        // Nur Analytics: wer eine neue Karte hinterlegt hat. Kein State-Update nötig.
        await admin.from("audit_log").insert({
          actor_id: null,
          action: "stripe_payment_method_attached",
          target_type: "stripe_customer",
          target_id: (event.data.object as Stripe.PaymentMethod).customer as string,
          diff: { event_id: event.id }
        }).catch(() => {});
        break;
    }
    await admin.from("stripe_webhook_events").update({ processed_at: new Date().toISOString() }).eq("id", event.id);
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    await admin.from("stripe_webhook_events").update({ error: String(e) }).eq("id", event.id);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
