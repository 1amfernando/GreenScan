// stripe_regeln.mjs — was sich am Zahlungsweg RECHNEN lässt, für stripe-webhook,
// stripe-checkout und stripe-portal.
//
// Reines ESM ohne Typen, damit Deno (Edge-Functions) und Node (Prüfstand
// `stripe_check`) dieselbe Datei laden — dasselbe Muster wie modelle.mjs.
//
// Anlass (11.11.2026, gemessen): der Zahlungsweg ist nie Ende-zu-Ende gelaufen
// (`stripe_webhook_events`: 0 Zeilen), und er konnte es auch nicht:
//   • stripe-checkout schickte `automatic_payment_methods` an Checkout — den
//     Parameter gibt es dort nicht (API-Referenz „Create a Checkout Session":
//     0 Treffer; stripe@17.7.0 `types/Checkout/SessionsResource.d.ts`: 0 Treffer,
//     er gehört zu PaymentIntents). Stripe lehnt Unbekanntes mit 400 ab — seit
//     dem 14.06.2026 endete jeder Kauf mit 500.
//   • stripe-webhook hängte sechsmal `.catch()` an einen supabase-js-Bauer. Der
//     hat `then`, aber kein `catch` (gemessen an @supabase/postgrest-js 2.119.0:
//     „TypeError: … .catch is not a function") — fünf Ereignisarten endeten
//     IMMER mit 500, darunter `payment_method.attached`, das bei jedem ersten
//     Kauf kommt.
//   • Kein einziger Schreibaufruf las `error`. supabase-js wirft bei einem Nein
//     der Datenbank nicht — Stripe bekam „ok", wiederholte nicht, und die Zahlung
//     wäre bezahlt, aber nicht freigeschaltet gewesen.
//   • checkout und portal lasen `stripe_customers` — die Tabelle gibt es nicht.
//
// Regel: was hier steht, entscheidet. Die drei Functions sind der Rand darum
// (Anmeldung, Datenbank, Stripe). Wer eine Regel ändert, ändert sie hier und im
// Prüfstand — nie im Rand.

import { constantTimeEquals } from './auth_vergleich.mjs';

// ── 0 · Die Datenbank sagt Nein ──────────────────────────────────────────────
// supabase-js wirft nicht: ein abgelehnter Aufruf kommt als { data: null, error }.
// `dbMuss` macht daraus eine Ausnahme mit dem SCHRITT davor — der Webhook
// antwortet dann 500, und Stripe versucht es wieder (bis zu drei Tage).
export function dbNein(antwort) {
  if (!antwort || typeof antwort !== 'object') return 'keine Antwort der Datenbank';
  const e = antwort.error;
  if (!e) return null;
  const text = (e && (e.message || e.details || e.hint)) || String(e);
  return (e && e.code ? e.code + ' ' : '') + text;
}
export function dbMuss(antwort, schritt) {
  const nein = dbNein(antwort);
  if (nein) throw new Error(String(schritt || 'Datenbank') + ': ' + nein);
  return antwort.data;
}

// ── 1 · Signatur ─────────────────────────────────────────────────────────────
// Stripes Verfahren (docs.stripe.com/webhooks, „Verify webhook signatures
// manually"): Kopfzeile `Stripe-Signature: t=<Sekunden>,v1=<hex>[,v1=…]`,
// unterschrieben ist `<t>.<roher Rumpf>` mit HMAC-SHA256 und dem Geheimnis des
// Endpunkts. Mehrere v1 kommen, solange ein Geheimnis rotiert wird — eines muss
// passen. Ein Zeitstempel, der älter ist als die Toleranz, wird abgelehnt
// (sonst liesse sich eine mitgeschnittene Anfrage beliebig später wiederholen).
// Wie Stripes eigene Bibliothek: erst die Signatur, dann das Alter; ein
// Zeitstempel in der Zukunft ist kein Grund (er ist mitunterschrieben).
export const SIGNATUR_TOLERANZ_S = 300;
const HEX64 = /^[0-9a-f]{64}$/;

export function signaturKopfLesen(kopf) {
  const aus = { t: null, v1: [] };
  if (typeof kopf !== 'string' || !kopf) return aus;
  for (const teil of kopf.split(',')) {
    const i = teil.indexOf('=');
    if (i < 0) continue;
    const k = teil.slice(0, i).trim(), v = teil.slice(i + 1).trim();
    if (k === 't' && /^\d{1,12}$/.test(v)) aus.t = Number(v);
    else if (k === 'v1' && HEX64.test(v)) aus.v1.push(v);
  }
  return aus;
}

async function hmacHex(geheimnis, bytes) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(String(geheimnis)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, bytes));
  let hex = '';
  for (let i = 0; i < sig.length; i++) hex += (sig[i] < 16 ? '0' : '') + sig[i].toString(16);
  return hex;
}

// { kopf, rumpf (Uint8Array oder Zeichenkette — der ROHE Rumpf), geheimnis, jetztS?, toleranzS? }
//   → { ok: true, t, alterS }  oder  { ok: false, grund }
// Gründe: kein_geheimnis · kein_kopf · kopf_unlesbar · kein_rumpf · signatur_falsch · zu_alt
export async function signaturPruefen(e) {
  const a = e || {};
  if (!a.geheimnis || typeof a.geheimnis !== 'string') return { ok: false, grund: 'kein_geheimnis' };
  if (!a.kopf) return { ok: false, grund: 'kein_kopf' };
  const k = signaturKopfLesen(a.kopf);
  if (k.t === null || !k.v1.length) return { ok: false, grund: 'kopf_unlesbar' };
  const rumpf = typeof a.rumpf === 'string' ? new TextEncoder().encode(a.rumpf) : a.rumpf;
  if (!(rumpf instanceof Uint8Array)) return { ok: false, grund: 'kein_rumpf' };
  const vorn = new TextEncoder().encode(k.t + '.');
  const alles = new Uint8Array(vorn.length + rumpf.length);
  alles.set(vorn, 0); alles.set(rumpf, vorn.length);
  const soll = await hmacHex(a.geheimnis, alles);
  let passt = false;
  for (const v of k.v1) if (constantTimeEquals(v, soll)) passt = true;   // ohne frühen Ausstieg
  if (!passt) return { ok: false, grund: 'signatur_falsch' };
  const tol = Number.isFinite(a.toleranzS) ? a.toleranzS : SIGNATUR_TOLERANZ_S;
  const jetzt = Number.isFinite(a.jetztS) ? a.jetztS : Date.now() / 1000;
  const alterS = Math.floor(jetzt) - k.t;
  if (tol > 0 && alterS > tol) return { ok: false, grund: 'zu_alt', alterS };
  return { ok: true, t: k.t, alterS };
}

export const SIGNATUR_GRUND_TEXT = {
  kein_geheimnis: 'Webhook secret not configured',
  kein_kopf: 'Missing signature',
  kopf_unlesbar: 'Unreadable Stripe-Signature header (expected t=…,v1=…)',
  kein_rumpf: 'Missing body',
  signatur_falsch: 'No signature matches the configured webhook secret',
  zu_alt: 'Timestamp outside the tolerance zone',
};

// ── 2 · Ereignisse — EINE Liste ──────────────────────────────────────────────
// Was der Webhook behandelt, und mit welcher Art Wirkung. Die Liste ist auch
// die Liste der Ereignisse, die am Endpunkt im Stripe-Dashboard abonniert
// werden (docs/FUER-FERNANDO): ein Ereignis, das hier fehlt, wird bestätigt und
// hat keine Wirkung; eines, das hier steht und nicht abonniert ist, kommt nie.
//   abo         der Stand des Abos wird bei Stripe GEHOLT und geschrieben
//   abschluss   Checkout fertig: Abo nachziehen bzw. Einmalkauf (Lifetime, Experten-Gebühr)
//   erstattung  volle Erstattung des Lifetime-Kaufs nimmt Lifetime zurück
//   mitteilung  eine Zeile in der Inbox der Person
//   protokoll   eine Zeile in audit_log, sonst nichts
//   marktplatz  marketplace_sellers (Stripe Connect)
//   nichts      bewusst ohne Wirkung — mit Grund
export const STRIPE_EREIGNISSE = {
  'checkout.session.completed': { wirkung: 'abschluss' },
  'customer.subscription.created': { wirkung: 'abo' },
  'customer.subscription.updated': { wirkung: 'abo' },
  'customer.subscription.deleted': { wirkung: 'abo' },
  'invoice.paid': { wirkung: 'abo' },
  'invoice.payment_failed': { wirkung: 'abo' },
  'customer.subscription.trial_will_end': { wirkung: 'mitteilung' },
  'charge.refunded': { wirkung: 'erstattung' },
  'charge.failed': { wirkung: 'protokoll' },
  'charge.dispute.created': { wirkung: 'protokoll' },
  'payment_method.attached': { wirkung: 'protokoll' },
  'payment_intent.succeeded': { wirkung: 'abschluss' },
  'account.updated': { wirkung: 'marktplatz' },
  'account.application.deauthorized': { wirkung: 'marktplatz' },
  // Schrieb bis zum 11.11.2026 `profiles.stripe_email` — eine Spalte, die niemand
  // liest (0 Leser in App, Migrationen, Functions) und die es vielleicht nie gab.
  'customer.updated': { wirkung: 'nichts', grund: 'die E-Mail des Stripe-Kunden liest in GreenScan niemand' },
};
export function ereignisWirkung(typ) {
  return Object.prototype.hasOwnProperty.call(STRIPE_EREIGNISSE, typ) ? STRIPE_EREIGNISSE[typ].wirkung : null;
}

// ── 3 · Kleine Leser — Stripe schickt eine Id oder das ganze Objekt ───────────
export function idVon(x) {
  if (typeof x === 'string' && x) return x;
  if (x && typeof x === 'object' && typeof x.id === 'string' && x.id) return x.id;
  return null;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function istUuid(s) { return typeof s === 'string' && UUID.test(s); }
// `stripe_subscriptions.user_id` ist uuid NOT NULL: was keine UUID ist, lehnt die
// Datenbank ab (22P02) — und zwar bei jeder Wiederholung. Dann lieber „nicht zuordenbar".
export function nutzerAusMetadaten(metadata) {
  const v = metadata && typeof metadata === 'object' ? metadata.supabase_user_id : null;
  return istUuid(v) ? v.toLowerCase() : null;
}
const zahl = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
const iso = (sekunden) => (zahl(sekunden) === null ? null : new Date(sekunden * 1000).toISOString());

// ── 4 · Das Abo als Zeile in stripe_subscriptions ────────────────────────────
// Der Zeitraum steht je nach API-Version am Abo (bis 2025-03-31.basil) oder am
// ersten Posten (seither). Wer nur eine Stelle liest, rechnet bei der anderen
// `new Date(undefined * 1000).toISOString()` — das wirft („Invalid time value"),
// und jedes Abo-Ereignis endete mit 500.
export function aboZeitraum(sub) {
  const posten = sub && sub.items && Array.isArray(sub.items.data) ? sub.items.data[0] : null;
  const start = zahl(sub && sub.current_period_start) ?? zahl(posten && posten.current_period_start);
  const ende = zahl(sub && sub.current_period_end) ?? zahl(posten && posten.current_period_end);
  return { start: iso(start), ende: iso(ende) };
}
export function aboPreisId(sub) {
  const posten = sub && sub.items && Array.isArray(sub.items.data) ? sub.items.data[0] : null;
  return posten ? idVon(posten.price) : null;
}
// Endet das Abo von selbst? `cancel_at_period_end` — oder ein gesetztes `cancel_at`
// (so meldet es Stripe in neueren API-Versionen, wenn im Portal gekündigt wird).
// Die App zeigt daran „Endet am …" statt „Aktiv".
export function aboEndetVonSelbst(sub) {
  if (!sub) return false;
  if (sub.cancel_at_period_end === true) return true;
  const laeuft = sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due';
  return laeuft && zahl(sub.cancel_at) !== null;
}
// → { ok: true, zeile }  oder  { ok: false, grund }
export function aboZeile(sub, opts) {
  const o = opts || {};
  if (!sub || typeof sub !== 'object' || !idVon(sub)) return { ok: false, grund: 'kein Abo im Ereignis' };
  if (typeof sub.status !== 'string' || !sub.status) return { ok: false, grund: 'Abo ' + sub.id + ' ohne Status' };
  if (!istUuid(o.userId)) return { ok: false, grund: 'Abo ' + sub.id + ' ohne supabase_user_id' };
  const z = aboZeitraum(sub);
  const jetzt = Number.isFinite(o.jetztMs) ? o.jetztMs : Date.now();
  return {
    ok: true,
    zeile: {
      id: sub.id,
      user_id: o.userId,
      stripe_customer_id: idVon(sub.customer),
      price_id: aboPreisId(sub),
      tier: typeof o.tier === 'string' && o.tier ? o.tier : 'free',
      status: sub.status,
      cancel_at_period_end: aboEndetVonSelbst(sub),
      current_period_start: z.start,
      current_period_end: z.ende,
      trial_end: iso(sub.trial_end),
      canceled_at: iso(sub.canceled_at),
      ended_at: iso(sub.ended_at),
      metadata: sub.metadata && typeof sub.metadata === 'object' ? sub.metadata : {},
      updated_at: new Date(jetzt).toISOString(),
    },
  };
}
// Zu welchem Abo gehört eine Rechnung? Bis 2025-03-31.basil `invoice.subscription`,
// seither `invoice.parent.subscription_details.subscription`.
export function aboIdAusRechnung(rechnung) {
  if (!rechnung || typeof rechnung !== 'object') return null;
  const direkt = idVon(rechnung.subscription);
  if (direkt) return direkt;
  const eltern = rechnung.parent && rechnung.parent.subscription_details;
  return idVon(eltern && eltern.subscription);
}

// ── 5 · Der Preis — aus der eigenen Tabelle, nie aus der Anfrage ──────────────
// `stripe_prices`: recurring {interval} bei Abos, sonst metadata.interval = 'lifetime'.
export function preisIntervall(preisZeile) {
  if (!preisZeile || typeof preisZeile !== 'object') return null;
  const r = preisZeile.recurring && typeof preisZeile.recurring === 'object' ? preisZeile.recurring.interval : null;
  if (typeof r === 'string' && r) return r;
  const m = preisZeile.metadata && typeof preisZeile.metadata === 'object' ? preisZeile.metadata.interval : null;
  return typeof m === 'string' && m ? m : null;
}
export function istLaunchAngebot(preisZeile) {
  const v = preisZeile && preisZeile.metadata && typeof preisZeile.metadata === 'object' ? preisZeile.metadata.is_launch_offer : null;
  return v === true || v === '1' || v === 'true';
}

export const PROBE_TAGE_MAX = 7;
export const PROBE_TAGE_VORGABE = 7;
// Probezeit nur beim ERSTEN Abo; die Anfrage darf sie kürzen oder abwählen (0),
// nie verlängern. Ohne Angabe gilt die Vorgabe.
export function probeTage(e) {
  const a = e || {};
  if (a.modus !== 'subscription' || !a.ersterAbschluss) return 0;
  if (a.wunsch === undefined || a.wunsch === null) return PROBE_TAGE_VORGABE;
  if (typeof a.wunsch !== 'number' || !Number.isFinite(a.wunsch) || a.wunsch <= 0) return 0;
  return Math.min(Math.floor(a.wunsch), PROBE_TAGE_MAX);
}

// Was darf gekauft werden, und wie? { preisZeile, wunschProbeTage, ersterAbschluss, launchFrei }
//   → { ok: true, modus: 'subscription' | 'payment', probeTage, launch }
//   → { ok: false, status, grund, text }
// `launchFrei` ist die Antwort von rpc/launch_offer_available — gefragt wird sie
// anhand des PREISES, nicht anhand eines Feldes der Anfrage: wer `claim_launch_offer`
// wegliess, kaufte das Launch-Angebot bisher auch nach dem hundertsten Mal.
export function checkoutPlan(e) {
  const a = e || {};
  const p = a.preisZeile;
  if (!p || typeof p !== 'object' || !idVon(p)) return { ok: false, status: 400, grund: 'preis_unbekannt', text: 'Unknown price' };
  if (p.active !== true) return { ok: false, status: 400, grund: 'preis_inaktiv', text: 'This price is no longer offered' };
  const intervall = preisIntervall(p);
  if (!intervall) return { ok: false, status: 400, grund: 'preis_ohne_intervall', text: 'Price has no interval' };
  const modus = intervall === 'lifetime' ? 'payment' : 'subscription';
  const launch = istLaunchAngebot(p);
  if (launch && a.launchFrei !== true) return { ok: false, status: 410, grund: 'launch_ausverkauft', text: 'Launch offer fully booked' };
  return { ok: true, modus, launch, probeTage: probeTage({ modus, ersterAbschluss: a.ersterAbschluss === true, wunsch: a.wunschProbeTage }) };
}

// ── 6 · Was an Checkout geht ─────────────────────────────────────────────────
// Die Parameter von „Create a Checkout Session", die es in der festgenagelten
// API-Version (2024-12-18.acacia, stripe@17.7.0) UND in der heutigen Referenz
// (2026-10-28.endive, gelesen am 11.11.2026) gibt: 39. `payment_method_types`
// fehlt mit Absicht — ohne ihn zeigt Checkout, was im Dashboard eingeschaltet
// ist und zu Währung, Betrag und Modus passt (Karte; TWINT bei CHF, seit dem
// 27.05.2026 auch im Abo), und ab 2026-09-30.endive ist er ganz gestrichen.
export const CHECKOUT_PARAMETER = [
  'adaptive_pricing', 'after_expiration', 'allow_promotion_codes', 'automatic_tax', 'billing_address_collection',
  'cancel_url', 'client_reference_id', 'consent_collection', 'currency', 'custom_fields', 'custom_text', 'customer',
  'customer_creation', 'customer_email', 'customer_update', 'discounts', 'expires_at', 'invoice_creation', 'line_items',
  'locale', 'metadata', 'mode', 'payment_intent_data', 'payment_method_collection', 'payment_method_configuration',
  'payment_method_data', 'payment_method_options', 'phone_number_collection', 'redirect_on_completion', 'return_url',
  'saved_payment_method_options', 'setup_intent_data', 'shipping_address_collection', 'shipping_options', 'submit_type',
  'subscription_data', 'success_url', 'tax_id_collection', 'ui_mode',
];
export function checkoutParameterFremd(params) {
  return Object.keys(params || {}).filter((k) => params[k] !== undefined && CHECKOUT_PARAMETER.indexOf(k) < 0);
}
// { kundeId, preisId, modus, probeTage, userId, launch, erfolgUrl, abbruchUrl } → das Objekt für checkout.sessions.create
export function checkoutParameter(e) {
  const a = e || {};
  const p = {
    customer: a.kundeId,
    mode: a.modus,
    line_items: [{ price: a.preisId, quantity: 1 }],
    success_url: a.erfolgUrl,
    cancel_url: a.abbruchUrl,
    metadata: { supabase_user_id: a.userId, claim_launch_offer: a.launch ? '1' : '0' },
    allow_promotion_codes: true,
    locale: 'de',
  };
  if (a.modus === 'subscription') {
    p.subscription_data = { metadata: { supabase_user_id: a.userId } };
    if (a.probeTage > 0) p.subscription_data.trial_period_days = a.probeTage;
    // Auch in der Probezeit eine Zahlungsart hinterlegen — sonst endet das Abo mit ihr.
    p.payment_method_collection = 'always';
  } else {
    // Einmalkauf: Nutzer und Art reisen an der Zahlung mit — eine Erstattung
    // (charge.refunded) findet so den Kauf, den sie zurücknimmt.
    p.payment_intent_data = { metadata: { supabase_user_id: a.userId, kind: 'lifetime' } };
  }
  return p;
}

// ── 7 · Rückkehr-Adressen — nur auf den eigenen Ursprung ─────────────────────
// success_url, cancel_url und return_url kommen aus der Anfrage des Browsers und
// gingen ungeprüft an Stripe: wer einen Checkout-Link weitergibt, konnte die
// zahlende Person danach auf jede beliebige Seite schicken. Gilt die Adresse
// nicht, gilt die Vorgabe — der Kauf scheitert daran nie.
export const APP_URSPRUNG = 'https://green-scan.ch';
// Netlify nur mit der genauen Adresse der Auslieferung: eine Vorschau heisst dort
// `<etwas>--<site>.netlify.app`, und ob ein FREMDER einen Site-Namen mit „--"
// anlegen kann, ist hier nicht gemessen. Eine Vorschau bekommt die Vorgabe —
// das Zahlungsfenster schliesst sich trotzdem, und die App fragt danach selbst nach.
const URSPRUENGE_FEST = [APP_URSPRUNG, 'https://www.green-scan.ch', 'https://green-scanswitzerland.netlify.app'];
const URSPRUENGE_MUSTER = [
  /^https:\/\/([a-z0-9-]+\.)?greenscan-app\.pages\.dev$/,                 // Cloudflare Pages: Auslieferung und Vorschauen (nur das eigene Projekt)
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/,                        // Entwicklung
];
export function ursprungErlaubt(ursprung) {
  if (typeof ursprung !== 'string' || !ursprung) return false;
  if (URSPRUENGE_FEST.indexOf(ursprung) >= 0) return true;
  return URSPRUENGE_MUSTER.some((re) => re.test(ursprung));
}
// → { url, ersetzt, grund }
export function rueckkehrAdresse(wunsch, vorgabe) {
  if (wunsch === undefined || wunsch === null || wunsch === '') return { url: vorgabe, ersetzt: false, grund: 'keine Adresse verlangt' };
  if (typeof wunsch !== 'string' || wunsch.length > 2000) return { url: vorgabe, ersetzt: true, grund: 'keine brauchbare Adresse' };
  let u;
  try { u = new URL(wunsch); } catch (_) { return { url: vorgabe, ersetzt: true, grund: 'keine vollständige Adresse' }; }
  if (u.username || u.password) return { url: vorgabe, ersetzt: true, grund: 'Adresse mit Zugangsdaten' };
  if (!ursprungErlaubt(u.origin)) return { url: vorgabe, ersetzt: true, grund: 'fremder Ursprung' };
  // Die GELESENE Form geht weiter, nicht die Zeichenkette aus der Anfrage: so sieht
  // Stripe dieselbe Adresse, die hier geprüft wurde (Tabulatoren, „\" statt „/").
  return { url: u.href, ersetzt: false, grund: '' };
}

// ── 8 · Welcher Stripe-Kunde ist diese Person? ───────────────────────────────
// EINE Antwort für checkout und portal. Die Tabelle `stripe_customers`, die beide
// bis zum 11.11.2026 lasen, gibt es nicht (gemessen: information_schema, 0 Tabellen)
// — der Fehler wurde verschluckt, checkout legte bei jedem Versuch einen NEUEN
// Kunden an. Jetzt: die neueste Abo-Zeile der Person, sonst die Suche bei Stripe
// nach dem Kunden, der ihre Id in den Metadaten trägt. Die Id kommt NIE aus der
// Anfrage. `admin` ist ein supabase-js-Client (Service-Role), `stripe` der Stripe-Client.
// Drei Zustände: gefunden · nicht gefunden · NICHT FESTSTELLBAR (`sucheFehler` — die Suche bei
// Stripe ist gescheitert). Der Kauf geht dann trotzdem weiter (ein neuer Kunde), das Portal
// sagt den Fehler — „nie gekauft" wäre geraten.
//   → { kundeId, quelle: 'abo' | 'suche' | null, zeilen, sucheFehler }
export async function kundeFinden(e) {
  const a = e || {};
  if (!istUuid(a.userId)) return { kundeId: null, quelle: null, zeilen: [], sucheFehler: null };
  const zeilen = dbMuss(await a.admin
    .from('stripe_subscriptions')
    .select('id, status, cancel_at_period_end, stripe_customer_id, is_lifetime, created_at')
    .eq('user_id', a.userId)
    .order('created_at', { ascending: false })
    .limit(10), 'stripe_subscriptions lesen') || [];
  const mitKunde = zeilen.find((z) => z && typeof z.stripe_customer_id === 'string' && z.stripe_customer_id);
  if (mitKunde) return { kundeId: mitKunde.stripe_customer_id, quelle: 'abo', zeilen, sucheFehler: null };
  let gefunden = null, sucheFehler = null;
  try {
    const suche = await a.stripe.customers.search({ query: "metadata['supabase_user_id']:'" + a.userId + "'", limit: 1 });
    gefunden = suche && Array.isArray(suche.data) && suche.data[0] ? idVon(suche.data[0]) : null;
  } catch (err) {
    sucheFehler = String((err && err.message) || err);
  }
  return { kundeId: gefunden, quelle: gefunden ? 'suche' : null, zeilen, sucheFehler };
}

// ── 9 · Portal: welches Abo meint „kündigen" / „fortsetzen"? ─────────────────
// Nur ein ECHTES, laufendes Stripe-Abo der Person. Die Lifetime-Zeile heisst
// `lifetime_<uuid>` — als Abo-Id an Stripe geschickt ist das „No such subscription".
const LAEUFT = ['active', 'trialing', 'past_due'];
export function portalZiel(zeilen, flow) {
  if (flow !== 'cancel' && flow !== 'reactivate') return null;
  const z = (Array.isArray(zeilen) ? zeilen : []).find((x) => x && typeof x.id === 'string' && /^sub_/.test(x.id)
    && LAEUFT.indexOf(x.status) >= 0
    && (flow === 'cancel' ? x.cancel_at_period_end !== true : x.cancel_at_period_end === true));
  return z ? z.id : null;
}

// ── 10 · Erstattung ──────────────────────────────────────────────────────────
// Eine VOLLE Erstattung des Lifetime-Kaufs nimmt Lifetime zurück. Eine
// Teil-Erstattung nicht (Kulanz), und die Erstattung einer Abo-Rechnung ändert
// am Abo nichts — dessen Stand kommt von Stripe (customer.subscription.*).
//   → { wirkung: 'lifetime_zurueck' }  oder  { wirkung: 'keine', grund }
export function erstattungWirkung(charge, lifetimeZeile) {
  if (!charge || typeof charge !== 'object') return { wirkung: 'keine', grund: 'keine Zahlung im Ereignis' };
  if (charge.refunded !== true) return { wirkung: 'keine', grund: 'Teil-Erstattung — die Berechtigung bleibt' };
  if (!lifetimeZeile || lifetimeZeile.is_lifetime !== true) return { wirkung: 'keine', grund: 'kein Lifetime-Kauf dieses Kunden — ein Abo ändert sich nur über Stripe' };
  const zahlung = idVon(charge.payment_intent);
  const gemerkt = lifetimeZeile.metadata && typeof lifetimeZeile.metadata === 'object' ? lifetimeZeile.metadata.payment_intent : null;
  if (gemerkt) {
    return zahlung && zahlung === gemerkt
      ? { wirkung: 'lifetime_zurueck' }
      : { wirkung: 'keine', grund: 'die erstattete Zahlung ist nicht der Lifetime-Kauf' };
  }
  const art = charge.metadata && typeof charge.metadata === 'object' ? charge.metadata.kind : null;
  return art === 'lifetime'
    ? { wirkung: 'lifetime_zurueck' }
    : { wirkung: 'keine', grund: 'die erstattete Zahlung ist nicht als Lifetime-Kauf gekennzeichnet' };
}

// ── 11 · Die Mitteilung „Probezeit endet" ────────────────────────────────────
// Der Tag ist der in der Schweiz — die Function läuft in UTC, und ein Ende um
// 23:30 UTC ist hier schon der nächste Tag. Und der Satz verlangt nichts, was
// längst geschehen ist: die Zahlungsart wird beim Abschluss hinterlegt
// (payment_method_collection 'always') — „Karte hinterlegen" stimmte nie, und mit
// TWINT erst recht nicht.
export function datumSchweiz(sekunden) {
  if (zahl(sekunden) === null) return null;
  return new Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich', day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date(sekunden * 1000));
}
export function probeEndeMitteilung(trialEndSekunden) {
  const tag = datumSchweiz(trialEndSekunden);
  const danach = 'Danach verlängert sich dein Abo automatisch — kündigen kannst du jederzeit unter «Abo verwalten».';
  return {
    title: 'Deine Probezeit endet bald',
    body: (tag ? 'Deine Probezeit endet am ' + tag + '. ' : 'Deine Probezeit endet bald. ') + danach,
  };
}
