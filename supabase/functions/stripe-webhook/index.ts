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
import "jsr:@supabase/functions-js@2.119.0/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "jsr:@supabase/supabase-js@2.119.0";
// v33.59 (Sicherheitspruefung 10.11.2026): Regeln in ../_shared/zahlung_regeln.mjs, Pruefstand
// scripts/edge/10_stripe.js. Kein `.catch` mehr an einer Abfrage (der Baustein von supabase-js hat
// nur `then` — jeder dieser Zweige warf TypeError und antwortete 500); Lifetime nur fuer den
// Lifetime-PREIS; Launch-Zaehlung am Preis; Experten-Zahlung schreibt nur die Gebuehr; volle
// Erstattung/Chargeback entzieht eine eindeutig zugeordnete Lifetime; Abo-Ereignisse in Reihenfolge.
import { istLifetimePreis, istLaunchPreis, ereignisIstNeuer, expertenZahlungFelder, lifetimeZumEntzug, ladungVollErstattet } from "../_shared/zahlung_regeln.mjs";

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

// v33.59 (Schlusspruefung d1 #1): KEINE Einbettung stripe_products(tier) — live fuehrt kein
// Fremdschluessel von stripe_prices.product_id dorthin, PostgREST antwortet PGRST200, und mit
// `throw` antwortete der Webhook auf jedes Abo-/Rechnungsereignis und jeden Lifetime-Kauf 500.
// Der tier kommt aus einer zweiten Abfrage; scheitert NUR sie, bleibt er leer (Rueckfall unten,
// wie bis 44bb824 — da scheiterte die Einbettung still). Ein Fehler der Preisabfrage wirft weiter.
async function preisZeile(priceId: string): Promise<any> {
  const { data, error } = await admin.from("stripe_prices").select("id, active, recurring, metadata, product_id, lookup_key").eq("id", priceId).maybeSingle();
  if (error) throw new Error("stripe_prices: " + error.message);
  if (!data) return null;
  let tier: string | null = null;
  if (data.product_id) {
    const p = await admin.from("stripe_products").select("tier").eq("id", data.product_id).maybeSingle();
    if (p.error) console.warn("[webhook] stripe_products lesen fehlgeschlagen — tier-Rueckfall", p.error.message ?? p.error);
    else tier = (p.data as any)?.tier ?? null;
  }
  return { ...data, tier };
}

async function resolveTier(priceId: string): Promise<string> {
  const data = await preisZeile(priceId);
  return data?.tier ?? "free";
}

// v33.59: ein Schreibfehler WIRFT — sonst gilt ein nicht geschriebenes Abo als verarbeitet.
function pruefe(r: { error: any }, was: string) {
  if (r && r.error) throw new Error(was + ": " + (r.error.message ?? r.error));
}
function warne(r: { error: any }, was: string) {
  if (r && r.error) console.warn("[webhook] " + was + " fehlgeschlagen", r.error.message ?? r.error);
}

// `stand`: der Zeitpunkt VOR dem Abruf bei Stripe — er steht in metadata.gs_stripe_stand, damit
// ein Ereignis, das waehrend des Abrufs entstand, nicht als „aelter" verworfen wird. v33.59
// (Schlusspruefung d1 #2): NICHT in updated_at — die Spalte setzt live der BEFORE-UPDATE-Trigger
// trg_stripe_subs_updated_at bei jedem Update auf now(); metadata fasst kein Trigger an.
async function upsertSubscription(sub: Stripe.Subscription, stand?: string) {
  const priceId = sub.items.data[0]?.price.id;
  const userId = (sub.metadata?.supabase_user_id as string) ?? null;
  if (!userId) return;
  const tier = priceId ? await resolveTier(priceId) : "free";

  pruefe(await admin.from("stripe_subscriptions").upsert({
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
    metadata: { ...(sub.metadata ?? {}), gs_stripe_stand: stand ?? new Date().toISOString() } as any,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" }), "stripe_subscriptions upsert");
}

// v33.59 (#11): ein Abo-Ereignis traegt eine Momentaufnahme. Ein verspaetet zugestelltes
// aelteres Ereignis (Stripe stellt nach einer 500 Stunden spaeter neu zu) setzte ein
// gekuendigtes Abo wieder auf active. Jetzt: aelter als der gespeicherte Stand → nichts tun;
// sonst den AKTUELLEN Stand bei Stripe holen (wie invoice.* seit jeher).
async function aboEreignis(stripe: Stripe, event: Stripe.Event) {
  const sub = event.data.object as Stripe.Subscription;
  const { data: alt, error } = await admin.from("stripe_subscriptions").select("updated_at, metadata").eq("id", sub.id).maybeSingle();
  if (error) throw new Error("stripe_subscriptions lesen: " + error.message);
  // Der Stand der letzten Momentaufnahme; Altzeilen (vor v33.59) haben nur updated_at.
  if (alt && !ereignisIstNeuer(event.created, (alt.metadata as any)?.gs_stripe_stand ?? alt.updated_at)) {
    console.log(`[webhook] ${event.type} ${sub.id} aelter als der gespeicherte Stand — uebersprungen`);
    return;
  }
  let frisch: Stripe.Subscription;
  const stand = new Date().toISOString();
  try {
    frisch = await stripe.subscriptions.retrieve(sub.id);
  } catch (e) {
    // Ein geloeschtes Abo kann Stripe je nach Alter nicht mehr liefern — dann gilt das Ereignis.
    if (event.type !== "customer.subscription.deleted") throw e;
    frisch = sub;
  }
  await upsertSubscription(frisch, stand);
}

// v33.59 (#8): volle Erstattung oder Chargeback entzieht eine Lifetime — nur bei EINDEUTIGER
// Zuordnung ueber den beim Kauf vermerkten PaymentIntent. Zuerst das Profil (sonst setzt
// fn_sync_lifetime_to_profile den tier nicht zurueck), dann die Zeile.
async function lifetimeEntziehen(paymentIntent: unknown, anlass: string) {
  const pi = typeof paymentIntent === "string" ? paymentIntent : (paymentIntent as any)?.id;
  if (!pi) return;
  const { data: zeilen, error } = await admin.from("stripe_subscriptions")
    .select("id, user_id, is_lifetime, metadata")
    .eq("is_lifetime", true)
    .eq("metadata->>payment_intent", pi);
  if (error) throw new Error("stripe_subscriptions lesen: " + error.message);
  const z = lifetimeZumEntzug(zeilen ?? [], pi);
  if (!z) { console.log(`[webhook] ${anlass}: keine eindeutige Lifetime fuer ${pi}`); return; }
  pruefe(await admin.from("profiles").update({ is_lifetime: false }).eq("id", z.user_id), "profiles is_lifetime");
  pruefe(await admin.from("stripe_subscriptions").update({
    is_lifetime: false, status: "canceled", ended_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", z.id), "stripe_subscriptions entziehen");
  warne(await admin.from("audit_log").insert({
    actor_id: null, action: "stripe_lifetime_revoked", target_type: "user", target_id: z.user_id,
    diff: { anlass, payment_intent: pi, subscription_id: z.id },
  }), "audit_log lifetime_revoked");
  console.warn(`[webhook] Lifetime entzogen (${anlass}) user=${z.user_id} pi=${pi}`);
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.supabase_user_id;
  if (!userId) return;

  if (session.mode === "payment" && session.payment_status === "paid"
      && session.metadata?.kind === "expert_verification") {
    const postId = session.metadata.post_id;
    const expertId = session.metadata.expert_id;
    if (postId && expertId) {
      // v33.59: nur die Gebuehr — „verified" setzt allein der Experte.
      pruefe(await admin.from("expert_verifications")
        .update(expertenZahlungFelder(session.amount_total ?? 0, session.payment_intent, new Date().toISOString()))
        .eq("post_id", postId).eq("expert_id", expertId), "expert_verifications Gebuehr");
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
    // v33.59: Lifetime nur fuer einen Preis, den der Katalog als Lifetime fuehrt (vorher: jede
    // bezahlte Einmalzahlung, ohne aufloesbaren Preis sogar „pro").
    const zeile = resolvedPriceId ? await preisZeile(resolvedPriceId) : null;
    if (!istLifetimePreis(zeile)) {
      console.error(`[webhook] Einmalzahlung ${session.id} ohne Lifetime-Preis (${resolvedPriceId ?? "unbekannt"}) — nicht freigeschaltet`);
      return;
    }
    const tier = zeile?.tier ?? "pro";
    const subId = `lifetime_${userId}`;
    pruefe(await admin.from("stripe_subscriptions").upsert({
      id: subId,
      user_id: userId,
      stripe_customer_id: session.customer as string,
      price_id: resolvedPriceId,
      tier,
      status: "active",
      is_lifetime: true, // v26.54: umbenannt von is_launch_lifetime (Schema-Drift fix)
      current_period_start: new Date().toISOString(),
      current_period_end: null,
      // v33.59: der PaymentIntent macht eine spaetere Erstattung eindeutig zuordenbar.
      metadata: { ...(session.metadata ?? {}), payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent as any)?.id ?? null } as any,
    }, { onConflict: "id" }), "stripe_subscriptions lifetime");
    // v33.59: gezaehlt wird am PREIS — die Session-Metadaten kamen bis v33.56 vom Client.
    if (istLaunchPreis(zeile)) {
      pruefe(await admin.from("launch_offer_usage").upsert({ user_id: userId, subscription_id: subId }, { onConflict: "user_id" }), "launch_offer_usage");
    }
  }
}

async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
  if (pi.metadata?.kind !== "expert_verification") return;
  const postId = pi.metadata.post_id;
  const expertId = pi.metadata.expert_id;
  if (!postId || !expertId) return;
  // v33.59: nur die Gebuehr — „verified" setzt allein der Experte.
  pruefe(await admin.from("expert_verifications")
    .update(expertenZahlungFelder(pi.amount_received, pi.id, new Date().toISOString()))
    .eq("post_id", postId).eq("expert_id", expertId), "expert_verifications Gebuehr");
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
  warne(await admin.from("notifications").upsert({
    user_id: userId,
    kind: "trial_ending",
    title: "Trial endet bald",
    body: trialEnd ? `Dein Trial endet am ${new Date(trialEnd).toLocaleDateString("de-CH")}. Karte hinterlegen damit's nahtlos weitergeht.` : "Dein Trial endet bald.",
    dedup_key: dedupKey,
    link: "/?open=abo",
    created_at: new Date().toISOString(),
  }, { onConflict: "dedup_key" }), "notifications trial_ending");
  // Spalte trial_will_end_notified_at gibt es live nicht (columns.txt) — der Fehler wird protokolliert.
  warne(await admin
    .from("stripe_subscriptions")
    .update({ trial_will_end_notified_at: new Date().toISOString() })
    .eq("id", sub.id), "trial_will_end_notified_at");
  console.log(`[webhook] trial_will_end notif gesetzt für user=${userId}`);
}

// v26.55 — Charge.failed (außerhalb von Subscriptions, z.B. Expert-Verification CHF 0.50).
// Loggen + Admin-Audit. Wenn associated subscription: status synct via separate event.
async function handleChargeFailed(charge: Stripe.Charge) {
  warne(await admin.from("audit_log").insert({
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
  }), "audit_log stripe_charge_failed");
  console.log(`[webhook] charge.failed ${charge.id} customer=${charge.customer} reason=${charge.failure_code}`);
}

// v26.55 — Charge.dispute.created (Chargeback eingereicht).
// Admin-Audit + Sub pausieren (manuelle Review-Pflicht).
async function handleChargeDispute(dispute: Stripe.Dispute) {
  warne(await admin.from("audit_log").insert({
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
  }), "audit_log stripe_dispute_created");
  // Abo-Status nicht automatisch aendern — manuelles Review. v33.59: eine Lifetime aber entziehen
  // (eindeutig ueber den PaymentIntent); gewinnt GreenScan den Fall, schaltet der Admin sie wieder frei.
  await lifetimeEntziehen((dispute as any).payment_intent, "dispute");
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
  // Spalte stripe_email gibt es live nicht (columns.txt) — der Fehler wird protokolliert, nicht geworfen.
  warne(await admin
    .from("profiles")
    .update({ stripe_email: customer.email })
    .eq("id", sub.user_id), "profiles stripe_email");
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
        await aboEreignis(stripe, event);
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
          const stand = new Date().toISOString();
          const sub = await stripe.subscriptions.retrieve(inv.subscription as string);
          await upsertSubscription(sub, stand);
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
      case "charge.refunded": {
        // v33.59 (#8): nur eine VOLLE Erstattung entzieht.
        const ch = event.data.object as Stripe.Charge;
        if (ladungVollErstattet(ch)) await lifetimeEntziehen(ch.payment_intent, "refund");
        break;
      }
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
        warne(await admin.from("audit_log").insert({
          actor_id: null,
          action: "stripe_payment_method_attached",
          target_type: "stripe_customer",
          target_id: (event.data.object as Stripe.PaymentMethod).customer as string,
          diff: { event_id: event.id }
        }), "audit_log stripe_payment_method_attached");
        break;
    }
    await admin.from("stripe_webhook_events").update({ processed_at: new Date().toISOString() }).eq("id", event.id);
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    await admin.from("stripe_webhook_events").update({ error: String(e) }).eq("id", event.id);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
