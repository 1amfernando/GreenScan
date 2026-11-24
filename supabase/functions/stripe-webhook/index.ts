// Stripe Webhook Handler
// v13 (v33.63, 19.11.2026): EINE Fassung aus main (v33.59) und PR #329 (Auftrag P-C2). Regeln von main:
//   eine Zahlung setzt nie `verified` (W1), Rueckbuchung entzieht eine eindeutig zugeordnete Lifetime
//   (W2), ein unbekannter Preis ist 500 und Stripe wiederholt (W6), Launch am PREIS (W7), Erstattung
//   ueber den PaymentIntent (W8), Signatur ueber constructEventAsync (W9), kontoFehlt + system_events.
//   Aus #329: der Zeitraum eines Abos in beiden API-Formen (aboZeile), die Rechnung findet ihr Abo
//   auch in der Form ab 2025-03-31.basil (aboIdAusRechnung), checkout.session.async_payment_succeeded,
//   ein Lifetime-Kauf beendet ein laufendes Abo zum Periodenende (abosBeenden), die volle Erstattung
//   gibt den Launch-Platz frei, `processed = true` (die Admin-Uebersicht zaehlt sonst alles als
//   „unverarbeitet"), modusPasst (Live-Ereignis an Test-Schluessel wird als Satz gemeldet), die
//   Probezeit-Mitteilung mit dem Schweizer Tag und ohne „Karte hinterlegen", und ein Vermerk in
//   stripe_webhook_events.error, wenn ein Ereignis nicht zuordenbar war. Die Ereignisse stehen in
//   STRIPE_EREIGNISSE — dieselbe Liste abonniert stripe-admin-extend-webhook.
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
import {
  ABO_LAEUFT, aboEndetVonSelbst, aboIdAusRechnung, aboPreisId, aboZeile, ereignisIstNeuer, ereignisWirkung, expertenZahlungFelder, idVon,
  istLaunchPreis, istLifetimePreis, kontoFehlt, ladungVollErstattet, laufendeAboIds, lifetimeZumEntzug, modusPasst, nutzerAusMetadaten,
  probeEndeMitteilung, stripeKenntNicht, istUuid,
} from "../_shared/zahlung_regeln.mjs";

// Was ein Ereignis bewirkt hat — nie Stille: ein Vermerk (nicht zuordenbar, Hinweis) steht danach
// in stripe_webhook_events.error, auch wenn Stripe 200 bekommt. Scheitert etwas, wird GEWORFEN (500).
type Vermerk = string | null;

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, svcKey);

// v33.63: der Wert aus app_settings wird gemerkt — und neu gelesen, wenn eine Signatur nicht passt
// (nach einem Wechsel des Geheimnisses gilt das neue ohne Neustart der Function). Die Umgebung gewinnt;
// passt nur das ANDERE Geheimnis, wird es NICHT angenommen, aber gesagt, dass eines veraltet ist.
let cachedWebhookSecret: string | null = null;
async function dbGeheimnis(frisch: boolean): Promise<string | null> {
  if (cachedWebhookSecret && !frisch) return cachedWebhookSecret;
  const { data, error } = await admin.from("app_settings").select("value").eq("key", "stripe_webhook_secret").maybeSingle();
  if (error) { console.warn("[webhook] app_settings stripe_webhook_secret lesen fehlgeschlagen", error.message ?? error); return cachedWebhookSecret; }
  cachedWebhookSecret = (data && typeof data.value === "string" && data.value) || null;
  return cachedWebhookSecret;
}
async function getWebhookSecret(): Promise<string | null> {
  return Deno.env.get("STRIPE_WEBHOOK_SECRET") || await dbGeheimnis(false);
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
// `anlass`: der Ereignistyp, fuer das Protokoll.
// Wem gehoert das Abo? Die Metadaten des Abos (so legt es stripe-checkout an), sonst die des Kunden.
async function nutzerFuer(stripe: Stripe, obj: { metadata?: unknown; customer?: unknown }): Promise<string | null> {
  const direkt = nutzerAusMetadaten(obj.metadata);
  if (direkt) return direkt;
  const kunde = idVon(obj.customer);
  if (!kunde) return null;
  const c = await stripe.customers.retrieve(kunde);
  return nutzerAusMetadaten((c as { metadata?: unknown })?.metadata);
}

async function upsertSubscription(stripe: Stripe, sub: Stripe.Subscription, stand?: string, anlass?: string): Promise<Vermerk> {
  const userId = await nutzerFuer(stripe, sub);
  if (!userId) return `nicht zuordenbar: Abo ${sub.id} ohne supabase_user_id (weder am Abo noch am Kunden)`;
  const priceId = aboPreisId(sub);
  let tier = "free";
  if (priceId) {
    const preis = await preisZeile(priceId);
    // v33.63 (W6): ein Preis, den stripe_prices nicht kennt, macht keinen zahlenden Kunden still „free".
    // 500 — Stripe wiederholt bis zu drei Tage und heilt, sobald der Preis im Katalog steht.
    if (!preis) throw new Error(`Preis ${priceId} von Abo ${sub.id} steht nicht in stripe_prices — erst den Katalog nachziehen (stripe-bootstrap), Stripe wiederholt`);
    tier = preis.tier ?? "free";
  }
  // v33.63: der Zeitraum in beiden API-Formen (am Abo bis 2025-03-31.basil, seither am Posten).
  const z = aboZeile(sub, { userId, tier, stand: stand ?? new Date().toISOString() });
  if (!z.ok) return "nicht zuordenbar: " + z.grund;
  const abo = await admin.from("stripe_subscriptions").upsert(z.zeile as any, { onConflict: "id" });
  // Gesamtpruefung (16.11.2026, Fund 4): das Konto gibt es nicht mehr — delete-user kuendigt das
  // Abo und loescht danach das Konto, Stripe stellt das Ereignis auch NACH dem Loeschen zu. Die
  // Verletzung des Fremdschluessels auf user_id heilt keine Wiederholung (bisher 500 und drei
  // Tage Neuzustellung): abschliessen, laut (Warnung + system_events, ohne die Kennung des
  // geloeschten Kontos). Jeder andere Fehler — auch 23503 auf price_id, der heilbar ist — wirft.
  if (kontoFehlt(abo.error)) {
    console.warn(`[webhook] ${anlass ?? "abo"} ${sub.id}: das Konto gibt es nicht mehr (23503 auf user_id) — ohne Zeile abgeschlossen`);
    warne(await admin.from("system_events").insert({
      severity: "warn", source: "stripe_webhook", event: "abo_ohne_konto",
      detail: { subscription_id: sub.id, ereignis: anlass ?? null, status: sub.status },
    }), "system_events abo_ohne_konto");
    return null;
  }
  pruefe(abo, "stripe_subscriptions upsert");
  return null;
}

// v33.59 (#11): ein Abo-Ereignis traegt eine Momentaufnahme. Ein verspaetet zugestelltes
// aelteres Ereignis (Stripe stellt nach einer 500 Stunden spaeter neu zu) setzte ein
// gekuendigtes Abo wieder auf active. Jetzt: aelter als der gespeicherte Stand → nichts tun;
// sonst den AKTUELLEN Stand bei Stripe holen (wie invoice.* seit jeher).
async function aboEreignis(stripe: Stripe, event: Stripe.Event): Promise<Vermerk> {
  const sub = event.data.object as Stripe.Subscription;
  const { data: alt, error } = await admin.from("stripe_subscriptions").select("updated_at, metadata").eq("id", sub.id).maybeSingle();
  if (error) throw new Error("stripe_subscriptions lesen: " + error.message);
  // Der Stand der letzten Momentaufnahme; Altzeilen (vor v33.59) haben nur updated_at.
  if (alt && !ereignisIstNeuer(event.created, (alt.metadata as any)?.gs_stripe_stand ?? alt.updated_at)) {
    console.log(`[webhook] ${event.type} ${sub.id} aelter als der gespeicherte Stand — uebersprungen`);
    return null;
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
  return await upsertSubscription(stripe, frisch, stand, event.type);
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
  // v33.63 (aus #329): nach einer Erstattung ist der Platz im Launch-Angebot wieder frei — wer nichts
  // mehr hat, liest sonst „schon genutzt". Nach einer Rueckbuchung NICHT: die kann GreenScan gewinnen.
  if (anlass === "refund") pruefe(await admin.from("launch_offer_usage").delete().eq("user_id", z.user_id), "launch_offer_usage freigeben");
  warne(await admin.from("audit_log").insert({
    actor_id: null, action: "stripe_lifetime_revoked", target_type: "user", target_id: z.user_id,
    diff: { anlass, payment_intent: pi, subscription_id: z.id },
  }), "audit_log lifetime_revoked");
  console.warn(`[webhook] Lifetime entzogen (${anlass}) user=${z.user_id} pi=${pi}`);
}

// v33.63 (aus #329): wer mit laufendem Abo Lifetime kauft, zahlte das Abo weiter. Es endet zum
// Periodenende (die bezahlte Zeit bleibt). Welche Abos, sagen die eigenen Zeilen; ob eines wirklich
// noch laeuft, sagt Stripe. Den neuen Stand schreibt danach customer.subscription.updated.
async function abosBeenden(stripe: Stripe, userId: string): Promise<Vermerk> {
  const { data: zeilen, error } = await admin.from("stripe_subscriptions").select("id, status, cancel_at_period_end").eq("user_id", userId).limit(20);
  if (error) throw new Error("stripe_subscriptions lesen: " + error.message);
  const saetze: string[] = [];
  for (const id of laufendeAboIds(zeilen ?? [], true)) {
    let sub: Stripe.Subscription;
    try {
      sub = await stripe.subscriptions.retrieve(id);
    } catch (e) {
      if (!stripeKenntNicht(e, "subscription")) throw e;   // nicht erreichbar: 500, Stripe wiederholt
      saetze.push(`Abo ${id} kennt Stripe nicht (mehr) — nichts zu beenden`);
      continue;
    }
    if (ABO_LAEUFT.indexOf(sub.status) < 0 || aboEndetVonSelbst(sub)) continue;
    await stripe.subscriptions.update(id, { cancel_at_period_end: true });
    saetze.push(`Abo ${id} endet zum Periodenende (Lifetime gekauft)`);
  }
  return saetze.length ? "Hinweis: " + saetze.join(" · ") : null;
}

async function handleCheckoutCompleted(stripe: Stripe, session: Stripe.Checkout.Session): Promise<Vermerk> {
  if (session.mode === "subscription") {
    // v33.63 (aus #329): ein Abo-Abschluss zieht das Abo sofort nach (nicht erst mit subscription.created).
    const aboId = idVon(session.subscription);
    if (!aboId) return `nicht zuordenbar: Abschluss ${session.id} ohne Abo`;
    const stand = new Date().toISOString();
    return await upsertSubscription(stripe, await stripe.subscriptions.retrieve(aboId), stand, "checkout.session.completed");
  }
  // Bei einer verzoegerten Zahlungsart ist „completed" noch unbezahlt — bezahlt meldet
  // checkout.session.async_payment_succeeded, und das kommt wieder hier an.
  if (session.mode !== "payment" || session.payment_status !== "paid") return null;
  // v33.63: nur eine UUID — mit etwas anderem lehnte die Datenbank bei JEDER Wiederholung ab (22P02).
  const userId = nutzerAusMetadaten(session.metadata);
  if (!userId) return `nicht zuordenbar: Einmalzahlung ${session.id} ohne gueltige supabase_user_id`;

  if (session.metadata?.kind === "expert_verification") {
    const postId = session.metadata.post_id;
    const expertId = session.metadata.expert_id;
    return await expertenGebuehr(postId, expertId, session.amount_total ?? 0, session.payment_intent, session.id);
  }

  {
    const priceId = (session as any).line_items?.data?.[0]?.price?.id ?? null;
    let resolvedPriceId = priceId;
    if (!resolvedPriceId && session.id) {
      const li = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
      resolvedPriceId = li.data[0]?.price?.id ?? null;
    }
    // v33.59: Lifetime nur fuer einen Preis, den der Katalog als Lifetime fuehrt (vorher: jede
    // bezahlte Einmalzahlung, ohne aufloesbaren Preis sogar „pro").
    const zeile = resolvedPriceId ? await preisZeile(resolvedPriceId) : null;
    if (!istLifetimePreis(zeile)) {
      console.error(`[webhook] Einmalzahlung ${session.id} ohne Lifetime-Preis (${resolvedPriceId ?? "unbekannt"}) — nicht freigeschaltet`);
      return `nicht zuordenbar: Einmalzahlung ${session.id} — Preis ${resolvedPriceId ?? "unbekannt"} ist kein Lifetime-Preis in stripe_prices`;
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
    return await abosBeenden(stripe, userId);
  }
}

// v33.59 (W1): nur die Gebuehr — „verified" setzt allein der Experte. v33.63 (aus #329): eine bezahlte
// Gebuehr ohne passende Zeile wird in der Ereigniszeile vermerkt, statt still nichts zu schreiben.
async function expertenGebuehr(postId: unknown, expertId: unknown, betrag: number, paymentIntent: unknown, quelle: string): Promise<Vermerk> {
  // Beide Spalten sind uuid: mit etwas anderem lehnte die Datenbank bei JEDER Wiederholung ab (22P02).
  if (!istUuid(postId) || !istUuid(expertId)) return `nicht zuordenbar: Experten-Gebuehr ${quelle} ohne gueltige post_id/expert_id`;
  const { data: getroffen, error } = await admin.from("expert_verifications")
    .update(expertenZahlungFelder(betrag, idVon(paymentIntent), new Date().toISOString()))
    .eq("post_id", postId).eq("expert_id", expertId).select("post_id");
  pruefe({ error }, "expert_verifications Gebuehr");
  return (getroffen ?? []).length ? null : `nicht zuordenbar: Experten-Gebuehr ${quelle} bezahlt, aber keine Verifikation fuer diesen Beitrag und Experten`;
}

async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent): Promise<Vermerk> {
  if (pi.metadata?.kind !== "expert_verification") return null;
  return await expertenGebuehr(pi.metadata.post_id, pi.metadata.expert_id, pi.amount_received, pi.id, pi.id);
}

// v9/v10: account.updated Handler fuer Marketplace-Connect (v26.6/v26.17).
// v10-Refinements: expliziter Pre-Check, konservativeres disabled-Mapping.
async function handleAccountUpdated(account: Stripe.Account) {
  // Pre-Check: existiert ein marketplace_sellers-Eintrag fuer diesen Account?
  // v33.59 (Brett fe36): ein Lesefehler ist kein „unbekanntes Konto" — werfen, Stripe wiederholt.
  const { data: existing, error: vorErr } = await admin
    .from("marketplace_sellers")
    .select("user_id, status")
    .eq("stripe_account_id", account.id)
    .maybeSingle();
  if (vorErr) throw new Error("marketplace_sellers lesen: " + (vorErr.message ?? vorErr));

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

  // v33.59 (Brett fe36): Pflicht — der Status entscheidet, ob ein Konto verkaufen darf.
  pruefe(await admin.from("marketplace_sellers").update({
    status: newStatus,
    charges_enabled: account.charges_enabled ?? false,
    payouts_enabled: account.payouts_enabled ?? false,
    details_submitted: account.details_submitted ?? false,
    business_type: account.business_type ?? null,
    requirements: requirements as any,
    updated_at: new Date().toISOString(),
  }).eq("stripe_account_id", account.id), "marketplace_sellers account.updated");

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
  // v33.59 (Brett fe36): Pflicht — ein getrenntes Konto darf nicht weiter als aktiv gelten.
  pruefe(await admin.from("marketplace_sellers").update({
    status: "disabled",
    charges_enabled: false,
    payouts_enabled: false,
    updated_at: new Date().toISOString(),
  }).eq("stripe_account_id", acctId), "marketplace_sellers deauthorized");
  console.log(`[webhook] account.application.deauthorized ${acctId} → disabled`);
}

// v26.55 — Trial-Will-End (Stripe sendet ~3 Tage vor Trial-Ende automatisch).
// Wir erzeugen eine Notification + UPDATE stripe_subscriptions.trial_will_end_notified_at.
async function handleTrialWillEnd(stripe: Stripe, sub: Stripe.Subscription): Promise<Vermerk> {
  // v33.63: zuerst die Metadaten des Abos; sonst die NEUESTE eigene Zeile des Kunden (bis v33.62
  // `.maybeSingle()` — bei Lifetime + Abo desselben Kunden zwei Zeilen, Fehler, keine Mitteilung);
  // sonst die Metadaten des Kunden bei Stripe.
  let userId = nutzerAusMetadaten(sub.metadata);
  const customerId = idVon(sub.customer);
  if (!userId && customerId) {
    const { data: zeilen, error: lesErr } = await admin.from("stripe_subscriptions")
      .select("user_id").eq("stripe_customer_id", customerId).order("created_at", { ascending: false }).limit(1);
    warne({ error: lesErr }, "stripe_subscriptions lesen (trial_will_end)");   // Nebenweg: nur die Erinnerung
    userId = zeilen?.[0]?.user_id ?? null;
  }
  if (!userId) userId = await nutzerFuer(stripe, { customer: sub.customer });
  if (!userId) return `nicht zuordenbar: Probezeit-Hinweis fuer Abo ${sub.id} ohne Nutzer`;
  const m = probeEndeMitteilung(sub.trial_end);
  // v33.63: ein Fehler wirft — eine verlorene Erinnerung holt nur Stripes Wiederholung nach (dedup_key: einmal).
  // Ausnahme: das Konto gibt es nicht mehr (kontoFehlt) — dann gibt es niemanden zu erinnern.
  const { error: mErr } = await admin.from("notifications").upsert({
    user_id: userId,
    kind: "trial_ending",
    title: m.title,
    body: m.body,
    dedup_key: `trial_will_end_${sub.id}`,
    link: "/?open=abo",
    created_at: new Date().toISOString(),
  }, { onConflict: "dedup_key" });
  if (kontoFehlt(mErr)) return `nicht zuordenbar: Probezeit-Hinweis fuer Abo ${sub.id} — das Konto gibt es nicht mehr`;
  pruefe({ error: mErr }, "notifications trial_ending");
  return null;
}

// v26.55 — Charge.failed (außerhalb von Subscriptions, z.B. Expert-Verification CHF 0.50).
// Loggen + Admin-Audit. Wenn associated subscription: status synct via separate event.
async function handleChargeFailed(charge: Stripe.Charge) {
  pruefe(await admin.from("audit_log").insert({
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
  }), "audit_log stripe_charge_failed");   // v33.63: pruefe — scheitert das Protokoll, wiederholt Stripe (idempotent ueber processed_at)
  console.log(`[webhook] charge.failed ${charge.id} customer=${charge.customer} reason=${charge.failure_code}`);
}

// v26.55 — Charge.dispute.created (Chargeback eingereicht).
// Admin-Audit + Sub pausieren (manuelle Review-Pflicht).
async function handleChargeDispute(dispute: Stripe.Dispute) {
  pruefe(await admin.from("audit_log").insert({
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
    // W9: die Pruefung bleibt bei Stripes Bibliothek. Passt sie nicht, wird das Geheimnis aus
    // app_settings EINMAL frisch gelesen (es koennte gewechselt worden sein).
    const umgebung = Deno.env.get("STRIPE_WEBHOOK_SECRET") || null;
    const frisch = await dbGeheimnis(true);
    let ok: Stripe.Event | null = null;
    if (frisch && frisch !== webhookSecret) {
      try { ok = await stripe.webhooks.constructEventAsync(body, sig, frisch); } catch (_) { ok = null; }
      if (ok && umgebung) {
        console.error("[webhook] Die Signatur passt zu app_settings.stripe_webhook_secret, aber nicht zu STRIPE_WEBHOOK_SECRET in der Umgebung (die Umgebung gewinnt). Eines der beiden ist veraltet — nur EIN Ort soll das Geheimnis tragen.");
        ok = null;
      }
    }
    if (!ok) return new Response(`Webhook signature verification failed: ${(e as Error).message}`, { status: 400 });
    event = ok;
  }

  // v33.59 (Brett fe36): Duplikat-Blick und Vorab-Eintrag sind Pflicht. Scheitert einer, ist
  // weder „schon verarbeitet" noch das spaetere processed_at verlaesslich — 500 VOR jeder
  // Verbuchung, Stripe stellt erneut zu.
  const { data: existing, error: dupErr } = await admin.from("stripe_webhook_events").select("processed_at").eq("id", event.id).maybeSingle();
  if (dupErr) {
    console.error("[webhook] stripe_webhook_events lesen fehlgeschlagen", dupErr.message ?? dupErr);
    return new Response(JSON.stringify({ error: "event_store_unavailable" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  if (existing?.processed_at) return new Response("Already processed", { status: 200 });
  const vorab = await admin.from("stripe_webhook_events").upsert({ id: event.id, type: event.type, payload: event as any });
  if (vorab.error) {
    console.error("[webhook] stripe_webhook_events eintragen fehlgeschlagen", vorab.error.message ?? vorab.error);
    return new Response(JSON.stringify({ error: "event_store_unavailable" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  try {
    // v33.63 (aus #329): kommt das Ereignis aus demselben Modus wie der Schluessel? Sonst endete jedes
    // Nachschlagen bei Stripe mit „No such …" — und niemand laese daraus den Grund.
    const modus = modusPasst((event as { livemode?: unknown }).livemode, stripeKey);
    if (modus.art === "fehler") throw new Error(modus.text);
    let vermerk: Vermerk = null;
    if (modus.art === "ignorieren") vermerk = "nicht zuordenbar: " + modus.text;
    else if (ereignisWirkung(event.type) === null) vermerk = null;   // nicht abonniert / unbekannt: bestaetigt, ohne Wirkung
    else switch (event.type as string) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        vermerk = await aboEreignis(stripe, event);
        break;
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        vermerk = await handleCheckoutCompleted(stripe, event.data.object as Stripe.Checkout.Session);
        break;
      case "payment_intent.succeeded":
        vermerk = await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case "invoice.paid":
      case "invoice.payment_failed": {
        // v33.63 (aus #329): das Abo steht ab 2025-03-31.basil unter parent.subscription_details.
        const aboId = aboIdAusRechnung(event.data.object);
        if (aboId) {
          const stand = new Date().toISOString();
          const sub = await stripe.subscriptions.retrieve(aboId);
          vermerk = await upsertSubscription(stripe, sub, stand, event.type);
        }
        break;
      }
      case "account.updated":
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      case "account.application.deauthorized":
        await handleAccountDeauthorized(event);
        break;
      case "customer.subscription.trial_will_end":
        vermerk = await handleTrialWillEnd(stripe, event.data.object as Stripe.Subscription);
        break;
      case "charge.failed":
        await handleChargeFailed(event.data.object as Stripe.Charge);
        break;
      case "charge.refunded": {
        // v33.59 (#8): nur eine VOLLE Erstattung entzieht.
        const ch = event.data.object as Stripe.Charge;
        if (ladungVollErstattet(ch)) await lifetimeEntziehen(ch.payment_intent, "refund");
        break;
      }
      case "charge.dispute.created":
        await handleChargeDispute(event.data.object as Stripe.Dispute);
        break;
      case "customer.updated":
        // v33.63: bewusst ohne Wirkung (STRIPE_EREIGNISSE) — profiles.stripe_email gibt es live nicht.
        break;
      case "payment_method.attached":
        pruefe(await admin.from("audit_log").insert({
          actor_id: null,
          action: "stripe_payment_method_attached",
          target_type: "stripe_customer",
          target_id: (event.data.object as Stripe.PaymentMethod).customer as string,
          diff: { event_id: event.id }
        }), "audit_log stripe_payment_method_attached");
        break;
    }
    if (vermerk) console.warn(`[webhook] ${event.type} ${event.id} — ${vermerk}`);
    // v33.59 (Brett fe36): NACH der Verbuchung ist ein Fehler hier ein Nebenweg — 200, aber laut.
    // v33.63: `processed = true` liest die Admin-Uebersicht (fn_admin_stripe_overview), `processed_at` dieser Handler.
    warne(await admin.from("stripe_webhook_events").update({ processed: true, processed_at: new Date().toISOString(), error: vermerk }).eq("id", event.id), "stripe_webhook_events processed_at");
    return new Response(JSON.stringify({ received: true, ...(vermerk ? { vermerk } : {}) }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    warne(await admin.from("stripe_webhook_events").update({ error: String(e) }).eq("id", event.id), "stripe_webhook_events error");
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
