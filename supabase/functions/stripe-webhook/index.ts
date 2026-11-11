// Stripe Webhook Handler
// v13 (2026-11-11): der erste Stand mit einem Prüfstand (scripts/stripe_check.js). Gemessen
//   an v12: `stripe_webhook_events` hat 0 Zeilen, und die eine Abo-Zeile (16.05.2026) steht seit
//   dem Ende ihrer Probezeit auf „trialing" — kein Ereignis hat sie fortgeschrieben. Der Weg
//   konnte auch nicht halten:
//   • Sechsmal hing `.catch()` an einem supabase-js-Bauer. Der hat `then`, aber kein `catch`
//     (gemessen an @supabase/postgrest-js 2.119.0): trial_will_end, charge.failed,
//     charge.dispute.created und payment_method.attached endeten IMMER mit 500.
//   • Kein Schreibaufruf las `error`. supabase-js wirft bei einem Nein der Datenbank nicht —
//     Stripe bekam „ok", das Ereignis galt als verarbeitet, und die Wiederholung wurde als
//     „Already processed" verschluckt: bezahlt, aber nie freigeschaltet (7 von 12 Ereignisarten).
//   • Geschrieben wurde die Momentaufnahme IM Ereignis. Stripe liefert nicht geordnet: ein
//     altes „aktiv" nach der Kündigung schaltete wieder frei, für immer.
//   • Ein Ereignis in der API-Form ab 2025-03-31 (Zeitraum am Posten) warf „Invalid time value".
//   • Jede bezahlte Einmalzahlung galt als Lifetime, und eine Erstattung nahm nichts zurück.
//   Jetzt: die Regeln stehen in ../_shared/stripe_regeln.mjs (in Node geprüft), dieser Handler
//   ist der Rand. Jede Antwort der Datenbank wird gelesen (`dbMuss`); sagt sie Nein, bekommt
//   Stripe 500 und versucht es wieder. Der Stand eines Abos wird bei Stripe GEHOLT.
//   Und gegen die ECHTE Datenbank gehalten (pg_constraint, 11.11.2026), was der erste Entwurf
//   von v13 nur gegen eine Nachbildung mass:
//   • `stripe_subscriptions.price_id` ist ein Fremdschlüssel auf stripe_prices — ein Abo mit
//     einem Preis, den die Tabelle nicht kennt, wäre bei JEDER Wiederholung abgelehnt worden.
//     Jetzt bleibt `price_id` dann leer, und der Grund steht in der Ereigniszeile.
//   • `user_id` verweist auf auth.users: ein spätes Ereignis für ein GELÖSCHTES Konto ist
//     „nicht zuordenbar", kein Fehler, den Stripe drei Tage lang wiederholt.
//   • Die Admin-Übersicht zählt `processed = false` als „unverarbeitet" — das Feld setzte
//     noch nie jemand. Jetzt steht es mit `processed_at`.
//   • Eine verzögerte Zahlungsart meldet „bezahlt" erst mit checkout.session.async_payment_succeeded.
// v11 (2026-05-30): trial_will_end, charge.failed, dispute, customer.updated, payment_method.attached.
// v10 (2026-05-22): account.application.deauthorized; 'disabled' nur bei disabled_reason 'rejected…'.
// v9 (2026-05-22): account.updated für Marketplace-Connect. v7: Experten-Verifikation.
// v5 (2026-05-04): das Geheimnis kann in app_settings.stripe_webhook_secret liegen.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { constantTimeEquals } from "../_shared/auth_vergleich.mjs";
import {
  aboIdAusRechnung, aboPreisId, aboZeile, dbMuss, ereignisWirkung, erstattungWirkung, idVon, istNutzerWeg, istUuid,
  nutzerAusMetadaten, preisIntervall, probeEndeMitteilung, signaturPruefen, SIGNATUR_GRUND_TEXT,
} from "../_shared/stripe_regeln.mjs";

const STRIPE_API = "2024-12-18.acacia";
const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, svcKey);

// Was ein Ereignis bewirkt hat — drei Zustände, nie Stille:
//   ok                 geschrieben (mit `hinweis`, wenn dabei etwas fehlte)
//   nichts             bewusst ohne Wirkung (unbekanntes Ereignis, customer.updated)
//   nicht_zuordenbar   Wiederholen hilft nicht — bestätigt, aber der Grund steht in der Ereigniszeile
// Scheitert etwas (Datenbank, Stripe), wird GEWORFEN: 500, Stripe wiederholt.
type Ergebnis = { art: "ok"; hinweis?: string } | { art: "nichts" } | { art: "nicht_zuordenbar"; grund: string };
const OK: Ergebnis = { art: "ok" };
const NICHTS: Ergebnis = { art: "nichts" };
const ohneZuordnung = (grund: string): Ergebnis => ({ art: "nicht_zuordenbar", grund });
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// ── Das Geheimnis des Endpunkts ──────────────────────────────────────────────
// Aus der Umgebung (STRIPE_WEBHOOK_SECRET), sonst aus app_settings. Der Wert aus
// app_settings wird gemerkt — und neu gelesen, sobald eine Signatur nicht passt:
// nach einem Wechsel gilt das neue Geheimnis ohne Neustart der Function.
let geheimnisAusDb: string | null = null;
async function dbGeheimnis(frisch: boolean): Promise<string | null> {
  if (geheimnisAusDb && !frisch) return geheimnisAusDb;
  try {
    const zeile = dbMuss(await admin.from("app_settings").select("value").eq("key", "stripe_webhook_secret").maybeSingle(), "app_settings lesen");
    geheimnisAusDb = (zeile && typeof zeile.value === "string" && zeile.value) || null;
  } catch (e) {
    console.error("[stripe-webhook] " + String((e as Error).message));
    geheimnisAusDb = null;
  }
  return geheimnisAusDb;
}
async function signaturEntscheid(kopf: string | null, rumpf: Uint8Array): Promise<{ ok: boolean; status: number; text: string }> {
  const umgebung = Deno.env.get("STRIPE_WEBHOOK_SECRET") || null;
  const geheimnis = umgebung || await dbGeheimnis(false);
  if (!geheimnis) return { ok: false, status: 503, text: SIGNATUR_GRUND_TEXT.kein_geheimnis };
  let p = await signaturPruefen({ kopf, rumpf, geheimnis });
  let zusatz = "";
  if (!p.ok && p.grund === "signatur_falsch") {
    const frisch = await dbGeheimnis(true);
    if (!umgebung && frisch && !constantTimeEquals(frisch, geheimnis)) {
      p = await signaturPruefen({ kopf, rumpf, geheimnis: frisch });
    } else if (umgebung && frisch && !constantTimeEquals(frisch, umgebung) && (await signaturPruefen({ kopf, rumpf, geheimnis: frisch })).ok) {
      // Zwei Geheimnisse an zwei Orten, und nur das andere passt. Angenommen wird es NICHT
      // (sonst gälte ein abgelöstes Geheimnis weiter) — aber gesagt, welches veraltet ist.
      zusatz = " — the signature matches app_settings.stripe_webhook_secret, but STRIPE_WEBHOOK_SECRET (environment) wins and differs: one of the two is outdated";
      console.error("[stripe-webhook] Die Signatur passt zum Geheimnis in app_settings.stripe_webhook_secret, aber nicht zu STRIPE_WEBHOOK_SECRET in der Umgebung (die Umgebung gewinnt). Eines der beiden ist veraltet — nur EIN Ort soll das Geheimnis tragen.");
    }
  }
  if (p.ok) return { ok: true, status: 200, text: "" };
  return { ok: false, status: 400, text: "Webhook signature verification failed: " + (SIGNATUR_GRUND_TEXT[p.grund as keyof typeof SIGNATUR_GRUND_TEXT] || p.grund) + zusatz };
}

// ── Wem gehört das? ──────────────────────────────────────────────────────────
// Die Nutzer-Id steht in den Metadaten des Abos (so legt es stripe-checkout an) —
// sonst in denen des Kunden. Nie aus einer Vermutung.
async function nutzerFuer(stripe: Stripe, obj: { metadata?: unknown; customer?: unknown }): Promise<string | null> {
  const direkt = nutzerAusMetadaten(obj.metadata);
  if (direkt) return direkt;
  const kunde = idVon(obj.customer);
  if (!kunde) return null;
  const c = await stripe.customers.retrieve(kunde);
  return nutzerAusMetadaten((c as { metadata?: unknown }).metadata);
}
async function preisZeile(preisId: string) {
  return dbMuss(await admin.from("stripe_prices").select("id, product_id, recurring, metadata").eq("id", preisId).maybeSingle(), "stripe_prices lesen");
}
// Steht der Preis in stripe_prices — und welches Tier hat sein Produkt? Zwei Fragen, weil die
// erste entscheidet, ob `price_id` in die Abo-Zeile darf (Fremdschlüssel).
async function preisUndTier(preisId: string | null): Promise<{ bekannt: boolean; tier: string | null }> {
  if (!preisId) return { bekannt: false, tier: null };
  const preis = await preisZeile(preisId);
  if (!preis) return { bekannt: false, tier: null };
  if (!preis.product_id) return { bekannt: true, tier: null };
  const produkt = dbMuss(await admin.from("stripe_products").select("tier").eq("id", preis.product_id).maybeSingle(), "stripe_products lesen");
  return { bekannt: true, tier: produkt && typeof produkt.tier === "string" && produkt.tier ? produkt.tier : null };
}

// ── Abo: der Stand bei Stripe, nicht der im Ereignis ─────────────────────────
// Stripe liefert Ereignisse nicht in der Reihenfolge, in der sie entstanden sind, und
// wiederholt gescheiterte Stunden später. Wer die Momentaufnahme schreibt, schreibt mit
// einem alten „aktiv" über eine Kündigung. Darum: das Ereignis ist der Anstoss, der Stand
// kommt von Stripe — in der festgenagelten API-Version, gleich wie der Endpunkt eingestellt ist.
async function aboNachziehen(stripe: Stripe, aboId: string): Promise<Ergebnis> {
  const sub = await stripe.subscriptions.retrieve(aboId);
  const userId = await nutzerFuer(stripe, sub);
  if (!userId) return ohneZuordnung(`Abo ${sub.id} ohne supabase_user_id (weder am Abo noch am Kunden)`);
  const preisId = aboPreisId(sub);
  const p = await preisUndTier(preisId);
  const z = aboZeile(sub, { userId, tier: p.tier, preisBekannt: p.bekannt, jetztMs: Date.now() });
  if (!z.ok) return ohneZuordnung(z.grund);
  dbMuss(await admin.from("stripe_subscriptions").upsert(z.zeile, { onConflict: "id" }), "stripe_subscriptions schreiben");
  // Der Status ist eine Tatsache und wird geschrieben. Aber ein Abo, dessen Preis nicht in
  // stripe_prices steht, hat kein Tier — das darf nicht still „free" heissen. Und der fremde
  // Preis steht dann im Hinweis, nicht in der Zeile (dort wäre er ein verletzter Fremdschlüssel).
  if (p.tier) return OK;
  return { art: "ok", hinweis: p.bekannt
    ? `Preis ${preisId} von Abo ${sub.id} hat in stripe_products kein Tier — Zeile ohne Pro geschrieben`
    : `Preis ${preisId} von Abo ${sub.id} steht nicht in stripe_prices — Zeile ohne Preis und ohne Pro geschrieben` };
}

// ── Checkout fertig ──────────────────────────────────────────────────────────
async function abschluss(stripe: Stripe, session: Stripe.Checkout.Session): Promise<Ergebnis> {
  if (session.mode === "subscription") {
    const aboId = idVon(session.subscription);
    return aboId ? await aboNachziehen(stripe, aboId) : ohneZuordnung(`Abschluss ${session.id} ohne Abo`);
  }
  if (session.mode !== "payment") return NICHTS;
  // „unpaid" ist bei einer verzögerten Zahlungsart der gewöhnliche Stand von „completed": bezahlt
  // meldet später checkout.session.async_payment_succeeded — und kommt dann hier wieder an.
  if (session.payment_status !== "paid") return NICHTS;

  if (session.metadata?.kind === "expert_verification") {
    const postId = session.metadata.post_id, expertId = session.metadata.expert_id;
    // Beide Spalten sind uuid: mit etwas anderem lehnte die Datenbank bei jeder Wiederholung ab (22P02).
    if (!istUuid(postId) || !istUuid(expertId)) return ohneZuordnung(`Experten-Gebühr ${session.id} ohne gültige post_id/expert_id`);
    const zeilen = dbMuss(await admin.from("expert_verifications").update({
      status: "verified",
      fee_paid_chf: (session.amount_total ?? 0) / 100,
      fee_paid_at: new Date().toISOString(),
      stripe_payment_intent_id: idVon(session.payment_intent),
    }).eq("post_id", postId).eq("expert_id", expertId).select("post_id"), "expert_verifications schreiben");
    return zeilen && zeilen.length ? OK : ohneZuordnung(`Experten-Gebühr ${session.id} bezahlt, aber keine Verifikation für diesen Beitrag und Experten`);
  }

  const userId = nutzerAusMetadaten(session.metadata);
  if (!userId) return ohneZuordnung(`Einmalzahlung ${session.id} ohne supabase_user_id`);
  const posten = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
  const preisId = idVon(posten.data[0]?.price);
  const preis = preisId ? await preisZeile(preisId) : null;
  // Lifetime gibt es für den Lifetime-PREIS — nicht für jede bezahlte Einmalzahlung.
  if (!preis || preisIntervall(preis) !== "lifetime") return ohneZuordnung(`Einmalzahlung ${session.id}: Preis ${preisId} ist kein Lifetime-Preis in stripe_prices`);
  const tier = (await preisUndTier(preisId)).tier ?? "pro";
  const subId = `lifetime_${userId}`;
  dbMuss(await admin.from("stripe_subscriptions").upsert({
    id: subId,
    user_id: userId,
    stripe_customer_id: idVon(session.customer),
    price_id: preisId,
    tier,
    status: "active",
    is_lifetime: true,
    current_period_start: new Date().toISOString(),
    current_period_end: null,
    // Die Zahlung wird gemerkt: eine Erstattung findet so genau diesen Kauf.
    metadata: { ...(session.metadata ?? {}), payment_intent: idVon(session.payment_intent) },
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" }), "stripe_subscriptions schreiben");
  if (session.metadata?.claim_launch_offer === "1") {
    dbMuss(await admin.from("launch_offer_usage").upsert({ user_id: userId, subscription_id: subId }, { onConflict: "user_id" }), "launch_offer_usage schreiben");
  }
  return OK;
}

// Experten-Gebühr über einen PaymentIntent (ohne Checkout).
async function zahlungGelungen(pi: Stripe.PaymentIntent): Promise<Ergebnis> {
  if (pi.metadata?.kind !== "expert_verification") return NICHTS;
  const postId = pi.metadata.post_id, expertId = pi.metadata.expert_id;
  if (!istUuid(postId) || !istUuid(expertId)) return ohneZuordnung(`Experten-Gebühr ${pi.id} ohne gültige post_id/expert_id`);
  const zeilen = dbMuss(await admin.from("expert_verifications").update({
    status: "verified",
    fee_paid_chf: pi.amount_received / 100,
    fee_paid_at: new Date().toISOString(),
    stripe_payment_intent_id: pi.id,
  }).eq("post_id", postId).eq("expert_id", expertId).select("post_id"), "expert_verifications schreiben");
  return zeilen && zeilen.length ? OK : ohneZuordnung(`Experten-Gebühr ${pi.id} bezahlt, aber keine Verifikation für diesen Beitrag und Experten`);
}

// ── Erstattung ───────────────────────────────────────────────────────────────
async function erstattung(charge: Stripe.Charge): Promise<Ergebnis> {
  const kunde = idVon(charge.customer);
  if (!kunde) return NICHTS;
  const zeilen = dbMuss(await admin.from("stripe_subscriptions").select("id, user_id, metadata, is_lifetime").eq("stripe_customer_id", kunde).eq("is_lifetime", true).limit(1), "stripe_subscriptions lesen");
  const zeile = zeilen && zeilen[0] ? zeilen[0] : null;
  if (!zeile || erstattungWirkung(charge, zeile).wirkung !== "lifetime_zurueck") return NICHTS;
  const jetzt = new Date().toISOString();
  dbMuss(await admin.from("stripe_subscriptions").update({ is_lifetime: false, status: "canceled", ended_at: jetzt, updated_at: jetzt }).eq("id", zeile.id), "stripe_subscriptions schreiben");
  // Der Trigger fn_sync_lifetime_to_profile hat beim Kauf profiles.is_lifetime gesetzt — und
  // nimmt es nie zurück (er setzt nur `tier`, und nur wo is_lifetime schon false ist).
  dbMuss(await admin.from("profiles").update({ is_lifetime: false, tier: "free" }).eq("id", zeile.user_id).eq("is_lifetime", true), "profiles schreiben");
  return OK;
}

// ── Probezeit endet (Stripe schickt das rund drei Tage vorher) ───────────────
async function probeEndet(stripe: Stripe, sub: Stripe.Subscription): Promise<Ergebnis> {
  const userId = await nutzerFuer(stripe, sub);
  if (!userId) return ohneZuordnung(`Probezeit-Hinweis für Abo ${sub.id} ohne supabase_user_id`);
  const m = probeEndeMitteilung(sub.trial_end);
  dbMuss(await admin.from("notifications").upsert({
    user_id: userId,
    kind: "trial_ending",
    title: m.title,
    body: m.body,
    dedup_key: `trial_will_end_${sub.id}`,
    link: "/?open=abo",
    created_at: new Date().toISOString(),
  }, { onConflict: "dedup_key" }), "notifications schreiben");
  return OK;
}

// ── Marketplace (Stripe Connect) ─────────────────────────────────────────────
async function kontoGeaendert(account: Stripe.Account): Promise<Ergebnis> {
  const vorhanden = dbMuss(await admin.from("marketplace_sellers").select("user_id, status").eq("stripe_account_id", account.id).maybeSingle(), "marketplace_sellers lesen");
  if (!vorhanden) return NICHTS;   // ein Konto, das GreenScan nicht kennt
  const requirements = account.requirements ?? {};
  const disabledReason = (requirements as { disabled_reason?: string | null }).disabled_reason ?? null;
  const currentlyDue = (requirements as { currently_due?: string[] | null }).currently_due?.length ?? 0;
  // alle drei an → active · von Stripe abgelehnt → disabled · etwas fehlt → restricted · sonst pending
  let status = "pending";
  if (account.charges_enabled && account.payouts_enabled && account.details_submitted) status = "active";
  else if (disabledReason && disabledReason.startsWith("rejected")) status = "disabled";
  else if (currentlyDue > 0 || disabledReason) status = "restricted";
  dbMuss(await admin.from("marketplace_sellers").update({
    status,
    charges_enabled: account.charges_enabled ?? false,
    payouts_enabled: account.payouts_enabled ?? false,
    details_submitted: account.details_submitted ?? false,
    business_type: account.business_type ?? null,
    requirements: requirements as unknown,
    updated_at: new Date().toISOString(),
  }).eq("stripe_account_id", account.id), "marketplace_sellers schreiben");
  return OK;
}
async function kontoGetrennt(event: Stripe.Event): Promise<Ergebnis> {
  // Bei Connect-Ereignissen steht die Konto-Id oben am Ereignis, je nach API-Version auch im Objekt.
  const konto = idVon((event as { account?: unknown }).account) ?? idVon((event.data.object as { account?: unknown }).account);
  if (!konto) return ohneZuordnung("Konto getrennt, aber ohne Konto-Id");
  dbMuss(await admin.from("marketplace_sellers").update({
    status: "disabled", charges_enabled: false, payouts_enabled: false, updated_at: new Date().toISOString(),
  }).eq("stripe_account_id", konto), "marketplace_sellers schreiben");
  return OK;
}

// ── Protokoll ────────────────────────────────────────────────────────────────
async function protokoll(action: string, targetType: string, targetId: string | null, diff: unknown): Promise<Ergebnis> {
  dbMuss(await admin.from("audit_log").insert({ actor_id: null, action, target_type: targetType, target_id: targetId, diff }), "audit_log schreiben");
  return OK;
}

// Jedes Ereignis aus STRIPE_EREIGNISSE (../_shared/stripe_regeln.mjs) hat hier seinen Zweig —
// stripe_check hält beide Seiten gegeneinander.
async function verarbeite(stripe: Stripe, event: Stripe.Event): Promise<Ergebnis> {
  const o = event.data.object as unknown;
  switch (event.type as string) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const aboId = idVon(o);
      return aboId ? await aboNachziehen(stripe, aboId) : ohneZuordnung("Abo-Ereignis ohne Abo");
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const aboId = aboIdAusRechnung(o);
      return aboId ? await aboNachziehen(stripe, aboId) : NICHTS;   // eine Rechnung ohne Abo (Einmalzahlung)
    }
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return await abschluss(stripe, o as Stripe.Checkout.Session);
    case "payment_intent.succeeded":
      return await zahlungGelungen(o as Stripe.PaymentIntent);
    case "customer.subscription.trial_will_end":
      return await probeEndet(stripe, o as Stripe.Subscription);
    case "charge.refunded":
      return await erstattung(o as Stripe.Charge);
    case "charge.failed": {
      const c = o as Stripe.Charge;
      return await protokoll("stripe_charge_failed", "stripe_charge", c.id, {
        customer: c.customer, amount: c.amount, currency: c.currency,
        failure_code: c.failure_code, failure_message: c.failure_message, payment_intent: c.payment_intent,
      });
    }
    case "charge.dispute.created": {
      // Eine Rückbuchung ändert die Berechtigung nicht von selbst — das entscheidet ein Mensch.
      const d = o as Stripe.Dispute;
      return await protokoll("stripe_dispute_created", "stripe_dispute", d.id, {
        charge: d.charge, amount: d.amount, currency: d.currency, reason: d.reason, status: d.status,
      });
    }
    case "payment_method.attached":
      return await protokoll("stripe_payment_method_attached", "stripe_customer", idVon((o as Stripe.PaymentMethod).customer), { event_id: event.id });
    case "account.updated":
      return await kontoGeaendert(o as Stripe.Account);
    case "account.application.deauthorized":
      return await kontoGetrennt(event);
    case "customer.updated":
      return NICHTS;
    default:
      return NICHTS;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!stripeKey) return new Response("Stripe not configured", { status: 503 });

  // Der ROHE Rumpf: unterschrieben sind die Bytes, nicht ein neu geschriebenes JSON.
  const rumpf = new Uint8Array(await req.arrayBuffer());
  const s = await signaturEntscheid(req.headers.get("stripe-signature"), rumpf);
  if (!s.ok) return new Response(s.text, { status: s.status });

  let event: Stripe.Event;
  try {
    event = JSON.parse(new TextDecoder().decode(rumpf));
  } catch (_) {
    return new Response("Invalid payload", { status: 400 });
  }
  if (!event || typeof event.id !== "string" || !event.id || typeof event.type !== "string" || !event.data) {
    return new Response("Invalid event", { status: 400 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: STRIPE_API });
  try {
    // Dasselbe Ereignis zweimal → eine Wirkung. Ein Ereignis, das beim ersten Mal SCHEITERTE
    // (processed_at leer), wird wieder verarbeitet.
    const vorher = dbMuss(await admin.from("stripe_webhook_events").select("processed_at").eq("id", event.id).maybeSingle(), "stripe_webhook_events lesen");
    if (vorher?.processed_at) return new Response("Already processed", { status: 200 });
    dbMuss(await admin.from("stripe_webhook_events").upsert({ id: event.id, type: event.type, payload: event as unknown }, { onConflict: "id" }), "stripe_webhook_events festhalten");

    let erg: Ergebnis;
    try {
      erg = ereignisWirkung(event.type) === null ? NICHTS : await verarbeite(stripe, event);
    } catch (e) {
      // Das Konto gibt es nicht mehr (gelöscht): die Datenbank lehnt jede Zeile für diese Person ab,
      // heute und bei jeder Wiederholung. Bestätigt wird trotzdem — mit dem Grund in der Ereigniszeile.
      if (!istNutzerWeg(e)) throw e;
      erg = ohneZuordnung("das Konto zu diesem Ereignis gibt es nicht mehr (" + String((e as Error).message) + ")");
    }
    const vermerk = erg.art === "nicht_zuordenbar" ? "nicht zuordenbar: " + erg.grund : (erg.art === "ok" && erg.hinweis ? "Hinweis: " + erg.hinweis : null);
    if (vermerk) console.warn(`[stripe-webhook] ${event.type} ${event.id} — ${vermerk}`);
    // `processed` liest die Admin-Übersicht (fn_admin_stripe_overview: „unverarbeitet"), `processed_at` dieser Handler.
    dbMuss(await admin.from("stripe_webhook_events").update({ processed: true, processed_at: new Date().toISOString(), error: vermerk }).eq("id", event.id), "stripe_webhook_events abschliessen");
    return json(200, { received: true, wirkung: erg.art, ...(vermerk ? { vermerk } : {}) });
  } catch (e) {
    const text = String((e as Error)?.message ?? e);
    console.error(`[stripe-webhook] ${event.type} ${event.id} gescheitert: ${text}`);
    try {
      dbMuss(await admin.from("stripe_webhook_events").update({ error: text }).eq("id", event.id), "stripe_webhook_events Fehler festhalten");
    } catch (f) {
      console.error("[stripe-webhook] " + String((f as Error)?.message ?? f));
    }
    // Kein „ok": Stripe versucht es wieder (bis zu drei Tage).
    return json(500, { error: text });
  }
});
