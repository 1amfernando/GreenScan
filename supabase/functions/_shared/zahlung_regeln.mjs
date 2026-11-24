// zahlung_regeln.mjs — was die Zahlungs-Functions RECHNEN (v33.59, vereint v33.63)
//
// v33.63 (Auftrag P-C2): EIN Modul fuer den Zahlungsweg. PR #329 hatte daneben ein zweites
// (`stripe_regeln.mjs`) mit eigenen Fassungen derselben Regeln — zwei Module fuer eine Frage
// sind die Klasse aus CLAUDE.md §3.3. Dessen Rechenregeln stehen jetzt hier (Abschnitte ab
// „Ereignisse"), gemessen von scripts/stripe_check.js; wo beide etwas anderes sagten, gilt die
// Regel, die hier schon stand (Experten-Zahlung, Rueckbuchung, Kennungen statt Rohtext,
// Ursprünge, Launch am Preis, Erstattung ueber den PaymentIntent — STATUS (jk), W1–W11).
//
// Reines ESM ohne Typen und ohne Importe von aussen, damit Deno (stripe-checkout,
// stripe-portal, stripe-expert-checkout, stripe-webhook, delete-user,
// stripe-create-connect-account, stripe-bootstrap, stripe-admin-extend-webhook)
// und Node (scripts/edge/10_stripe.js) dieselbe Datei laden — dieselbe Bauform
// wie ingest_regeln.mjs. Die index.ts sind nur der Rand darum.
//
// Anlass: die Sicherheitspruefung vom 10.11.2026 (edge-stripe #1–#15). Jede
// Regel hier war vorher eine Zeile im Rand, die niemand ausfuehren konnte:
// eine Rueckkehr-Adresse aus dem Anfrage-Rumpf, ein Launch-Deckel, der an einem
// Wunsch des Clients hing, ein Preis ohne Blick in den Katalog, ein Lifetime fuer
// jede Einmalzahlung, ein Admin-Geheimnis mit `!==`.

import { constantTimeEquals } from './auth_vergleich.mjs';

// ── Rueckkehr-Adressen ────────────────────────────────────────────────────
// Stripe leitet nach Zahlung/Portal auf diese Adresse — eine echte
// checkout.stripe.com-Seite mit unserem Namen davor. Erlaubt sind nur die
// eigenen Urspruenge; alles andere wird zur Vorgabe (nie abgelehnt: der
// Checkout soll laufen, nur nicht woandershin zurueckkehren).
export const EIGENE_URSPRUENGE = ['https://green-scan.ch', 'https://greenscan-app.pages.dev'];
const VORSCHAU = /^[a-z0-9-]+\.greenscan-app\.pages\.dev$/;

export function eigenerUrsprung(u) {
  if (!u || u.protocol !== 'https:' || u.username || u.password || u.port) return false;
  const h = u.hostname.toLowerCase();
  return h === 'green-scan.ch' || h === 'greenscan-app.pages.dev' || VORSCHAU.test(h);
}

export function rueckkehrAdresse(url, vorgabe) {
  if (typeof url !== 'string' || !url || url.length > 2000) return vorgabe;
  // Steuerzeichen und Leerraum sind in einer Adresse aus fremder Hand nie gut gemeint
  // (der URL-Parser streicht Tab/Zeilenumbruch still — Stripe vielleicht nicht).
  if (/[\u0000- \u007f]/.test(url)) return vorgabe;
  let u;
  try { u = new URL(url); } catch (_) { return vorgabe; }
  if (!eigenerUrsprung(u)) return mitPopup(u, vorgabe);
  return u.href;
}

// v33.59 (Schlusspruefung d1 #3): kam die verworfene Adresse aus dem Stripe-FENSTER (popup=1,
// z.B. von der Netlify-Auslieferung oder localhost), traegt die Vorgabe es weiter — sonst laedt
// das Fenster die ganze App, statt sich zu schliessen. Der Rueckkehr-Handler in index.html
// erkennt das Fenster an popup=1 ALLEIN: window.opener ist dort wegen
// Cross-Origin-Opener-Policy same-origin-allow-popups immer null; die Meldung geht ueber
// BroadcastChannel ans Hauptfenster. Uebernommen wird nur dieses eine Merkmal, nie die Adresse.
function mitPopup(u, vorgabe) {
  if (typeof vorgabe !== 'string' || !vorgabe || u.searchParams.get('popup') !== '1') return vorgabe;
  if (/[?&]popup=1(&|$)/.test(vorgabe)) return vorgabe;
  return vorgabe + (vorgabe.indexOf('?') >= 0 ? '&' : '?') + 'popup=1';
}

// Ein Origin-Header (stripe-create-connect-account) ist dieselbe Frage ohne Pfad.
export function rueckkehrUrsprung(origin, vorgabe) {
  const a = rueckkehrAdresse(typeof origin === 'string' ? origin + '/' : origin, null);
  return a ? new URL(a).origin : vorgabe;
}

// ── Katalog ───────────────────────────────────────────────────────────────
const PREIS_ID = /^price_[A-Za-z0-9]{6,64}$/;

// Die Zeile aus stripe_prices, wenn sie diesen Preis traegt UND aktiv ist —
// sonst null. `zeilen`: eine Zeile, eine Liste oder nichts.
export function preisErlaubt(preisId, zeilen) {
  if (typeof preisId !== 'string' || !PREIS_ID.test(preisId)) return null;
  const liste = Array.isArray(zeilen) ? zeilen : (zeilen ? [zeilen] : []);
  const z = liste.find(r => r && r.id === preisId);
  if (!z || z.active === false) return null;
  return z;
}

// month | year | lifetime — oder null (ein Preis ohne Intervall ist kein Angebot,
// bis v33.56 wurde daraus still ein Monatsabo).
export function preisIntervall(zeile) {
  if (!zeile) return null;
  const r = zeile.recurring && zeile.recurring.interval;
  const m = zeile.metadata && zeile.metadata.interval;
  const i = r || m || null;
  return i === 'month' || i === 'year' || i === 'lifetime' ? i : null;
}

export function istLifetimePreis(zeile) {
  return !!zeile && preisIntervall(zeile) === 'lifetime' && !(zeile.recurring && zeile.recurring.interval);
}

function wahr(v) { return v === true || v === '1' || v === 'true'; }
export function istLaunchPreis(zeile) {
  return !!zeile && istLifetimePreis(zeile) && wahr(zeile.metadata && zeile.metadata.is_launch_offer);
}

// Der Deckel aus den Metadaten des Preises (stripe-bootstrap: launch_offer_cap 100).
export function launchDeckel(zeile) {
  const c = Number(zeile && zeile.metadata && zeile.metadata.launch_offer_cap);
  return Number.isInteger(c) && c > 0 ? c : 100;
}

// Das Launch-Angebot entscheidet der SERVER. `vergeben` ist die Zahl der
// Zeilen in launch_offer_usage (Service-Role), `beansprucht`, ob diese Person
// schon eine hat. Ist eine der beiden Zahlen unbekannt, gibt es kein Angebot —
// ein Deckel, den man nicht zaehlen kann, ist keiner.
export function launchAngebot({ preisIstLaunch, beansprucht, vergeben, deckel } = {}) {
  if (!preisIstLaunch) return { erlaubt: true, launch: false, grund: 'kein_launch_preis' };
  if (beansprucht === null || beansprucht === undefined || typeof vergeben !== 'number' || !Number.isFinite(vergeben))
    return { erlaubt: false, launch: true, grund: 'nicht_pruefbar' };
  if (beansprucht) return { erlaubt: false, launch: true, grund: 'schon_beansprucht' };
  const d = Number.isInteger(deckel) && deckel > 0 ? deckel : 100;
  if (vergeben >= d) return { erlaubt: false, launch: true, grund: 'ausverkauft' };
  return { erlaubt: true, launch: true, grund: 'frei' };
}

// Gratisphase: nur fuer das erste Abo, hoechstens `max` Tage — und NUR, wenn die
// Frage nach frueheren Abos beantwortet wurde (ein Abfragefehler war bis v33.56
// ein „erstes Abo").
export const PROBE_TAGE_MAX = 7;
export const PROBE_TAGE_VORGABE = 7;
export function gratisTage({ wunsch, fruehereAbos, abfrageFehler, max = PROBE_TAGE_MAX, vorgabe = PROBE_TAGE_VORGABE } = {}) {
  if (abfrageFehler) return 0;
  if (!Array.isArray(fruehereAbos) || fruehereAbos.length > 0) return 0;
  if (wunsch === undefined || wunsch === null) return Math.min(vorgabe, max);
  const n = Number(wunsch);
  if (typeof wunsch !== 'number' || !Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.floor(n), max);
}

// Die Stripe-Kunden-Id aus den eigenen Abo-Zeilen (stripe_customers gibt es live
// nicht — SW-CHANGELOG v26.68: stripe-portal v4 liest stripe_subscriptions).
export function kundenId(zeilen) {
  for (const z of (Array.isArray(zeilen) ? zeilen : [])) {
    const k = z && (z.stripe_customer_id || z.customer_id);
    if (typeof k === 'string' && /^cus_[A-Za-z0-9]+$/.test(k)) return k;
  }
  return null;
}

// ── Webhook ───────────────────────────────────────────────────────────────
// Ist ein Abo-Ereignis neuer als der gespeicherte Stand? Sekunden (Stripe),
// Millisekunden oder ISO. Ohne gespeicherten Stand: ja. Ohne Ereigniszeit: nein
// (nichts ueberschreiben, was man nicht einordnen kann).
function ms(t) {
  if (t === null || t === undefined || t === '') return null;
  if (typeof t === 'number') return t < 1e12 ? t * 1000 : t;
  const d = Date.parse(String(t));
  return Number.isFinite(d) ? d : null;
}
// Stripe nennt GANZE Sekunden: ein Ereignis mit created=10 kann bei 10,999 s entstanden
// sein. Verglichen wird deshalb mit dem ENDE seiner Sekunde — sonst gilt ein Ereignis,
// das nach dem letzten Abruf entstand, als aelter und geht verloren (Gegenpruefung v33.59).
// Im Zweifel „neuer": ein unnoetiger Abruf schadet nicht, ein verworfenes Ereignis schon.
export function ereignisIstNeuer(ereignisZeit, gespeicherteZeit) {
  let e = ms(ereignisZeit);
  const g = ms(gespeicherteZeit);
  if (typeof ereignisZeit === 'number' && ereignisZeit < 1e12 && e !== null) e += 999;
  if (g === null) return true;
  if (e === null) return false;
  return e >= g;
}

// Eine bezahlte Experten-Anfrage ist eine ZAHLUNG, kein Urteil: der Webhook
// schreibt nur die Gebuehr. „verified" setzt ausschliesslich der Experte selbst
// (RLS expert_verif_update_self / gsSubmitVerification).
export function expertenZahlungFelder(betragRappen, paymentIntent, jetztIso) {
  const chf = Math.max(0, Number(betragRappen) || 0) / 100;
  return { fee_paid_chf: chf, fee_paid_at: jetztIso, stripe_payment_intent_id: paymentIntent ? String(paymentIntent) : null };
}

// Wer darf eine Experten-Verifikation bezahlen? Nur der Autor des Beitrags, nur bei
// einem echten Experten, und nie bei sich selbst.
export function expertenAnfrage({ aufrufer, postAutor, expertId, expertIstExperte } = {}) {
  if (!aufrufer) return { erlaubt: false, status: 401, error: 'nicht_angemeldet' };
  if (!postAutor) return { erlaubt: false, status: 404, error: 'beitrag_unbekannt' };
  if (postAutor !== aufrufer) return { erlaubt: false, status: 403, error: 'nicht_dein_beitrag' };
  if (!expertId || expertId === aufrufer) return { erlaubt: false, status: 403, error: 'experte_unzulaessig' };
  if (!expertIstExperte) return { erlaubt: false, status: 403, error: 'experte_unzulaessig' };
  return { erlaubt: true };
}
export const EXPERTEN_GEBUEHR_RAPPEN = 50;

// Rueckerstattung/Chargeback: welche Lifetime-Zeile ist gemeint? Nur ein
// EINDEUTIGER Treffer ueber den PaymentIntent zaehlt (beim Kauf in metadata
// abgelegt, v33.59) — eine Zuordnung ueber den Kunden koennte eine erstattete
// Monatsrechnung derselben Person treffen.
export function lifetimeZumEntzug(zeilen, paymentIntent) {
  const pi = paymentIntent && typeof paymentIntent === 'object' ? paymentIntent.id : paymentIntent;
  if (typeof pi !== 'string' || !pi) return null;
  const t = (Array.isArray(zeilen) ? zeilen : []).filter(z => z && z.is_lifetime === true
    && z.metadata && z.metadata.payment_intent === pi);
  return t.length === 1 ? t[0] : null;
}
export function ladungVollErstattet(charge) {
  return !!charge && (charge.refunded === true
    || (Number(charge.amount) > 0 && Number(charge.amount_refunded) >= Number(charge.amount)));
}

// Ein Abo-Ereignis fuer ein Konto, das es nicht mehr gibt (Gesamtpruefung 16.11.2026, Fund 4).
// delete-user kuendigt das Abo bei Stripe und loescht danach das Konto; Stripe stellt
// customer.subscription.deleted (und Rechnungsereignisse) asynchron zu — auch NACH dem
// Loeschen. Der Upsert scheitert dann am Fremdschluessel stripe_subscriptions.user_id →
// auth.users (23503), und keine Wiederholung heilt das: das Konto kommt nicht wieder. Mit 500
// stellte Stripe drei Tage lang neu zu, jeder Versuch zaehlte als Webhook-Fehler.
// Erkannt wird NUR diese Verletzung: an den details, die Postgres mit Leserecht schreibt
// (`Key (user_id)=(…) is not present in table "users".`), und nur wenn Postgres die Spalte
// weglaesst (`Key is not present in table "…"`), am Namen des Constraints. Ein 23503 auf
// price_id ist heilbar (der Preis wird in stripe_prices nachgetragen) und bleibt ein Fehler.
export function kontoFehlt(fehler) {
  if (!fehler || typeof fehler !== 'object' || String(fehler.code) !== '23503') return false;
  const spalte = String(fehler.details == null ? '' : fehler.details).match(/\bKey \(([^)]*)\)=/);
  if (spalte) return spalte[1].trim().replace(/^"|"$/g, '') === 'user_id';
  const name = String(fehler.message == null ? '' : fehler.message).match(/foreign key constraint "([^"]+)"/);
  return !!name && /(^|_)user_id(_|$)/.test(name[1]);
}

// ── Konto loeschen ────────────────────────────────────────────────────────
// Welche Abos muessen vor dem Loeschen bei Stripe gekuendigt werden? Laufende,
// echte Stripe-Abos (sub_…), keine Lifetime-Zeilen.
export const LAUFEND = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'];
export function zuKuendigendeAbos(zeilen) {
  return (Array.isArray(zeilen) ? zeilen : [])
    .filter(z => z && z.is_lifetime !== true && typeof z.id === 'string' && /^sub_/.test(z.id)
      && LAUFEND.includes(String(z.status)))
    .map(z => z.id);
}

// ── Geheimnisse und Fehler ────────────────────────────────────────────────
export function adminGeheimnisOk(header, geheimnis) {
  const g = String(geheimnis == null ? '' : geheimnis);
  if (!g) return false;
  return constantTimeEquals(String(header == null ? '' : header), g);
}

// Kein Rohtext an den Aufrufer: Stripe- und Datenbank-Meldungen nennen Preis-Ids,
// Modus (test/live), Spalten. Die Rohmeldung gehoert ins Protokoll der Function.
export function fehlerCode(e, rueckfall = 'zahlung_fehlgeschlagen') {
  const typ = e && typeof e === 'object' ? String(e.type || '') : '';
  const param = e && typeof e === 'object' ? String(e.param || '') : '';
  if (typ === 'StripeInvalidRequestError' && param.indexOf('price') >= 0) return { status: 400, error: 'unbekannter_preis' };
  if (typ === 'StripeCardError') return { status: 402, error: 'karte_abgelehnt' };
  if (typ === 'StripeRateLimitError') return { status: 429, error: 'zu_viele_anfragen' };
  if (typ === 'StripeConnectionError' || typ === 'StripeAPIError') return { status: 502, error: 'zahlungsdienst_nicht_erreichbar' };
  return { status: 500, error: rueckfall };
}


// ══════════════════════════════════════════════════════════════════════════
// v33.63 · aus PR #329 (stripe_regeln.mjs) uebernommen — Ablauf des Zahlungswegs
// ══════════════════════════════════════════════════════════════════════════

// ── Die Datenbank sagt Nein ────────────────────────────────────────────────
// supabase-js wirft nicht: ein abgelehnter Aufruf kommt als { data: null, error }.
// `dbMuss` macht daraus eine Ausnahme mit dem SCHRITT davor (Rohtext nur fuers Protokoll).
export function dbNein(antwort) {
  if (!antwort || typeof antwort !== 'object') return 'keine Antwort der Datenbank';
  const e = antwort.error;
  if (!e) return null;
  const text = (e && (e.message || e.details || e.hint)) || String(e);
  return (e && e.code ? e.code + ' ' : '') + text;
}
export function dbMuss(antwort, schritt) {
  const nein = dbNein(antwort);
  if (nein) {
    const fehler = new Error(String(schritt || 'Datenbank') + ': ' + nein);
    const e = antwort && antwort.error;
    if (e && typeof e === 'object') { fehler.code = e.code || null; fehler.details = e.details || null; fehler.dbMessage = e.message || null; }
    throw fehler;
  }
  return antwort.data;
}

// ── Ereignisse — EINE Liste ────────────────────────────────────────────────
// Was der Webhook behandelt, und mit welcher Wirkung. Dieselbe Liste abonniert
// stripe-admin-extend-webhook am Endpunkt (W11): ein Ereignis, das hier fehlt,
// wird bestaetigt und hat keine Wirkung; eines, das hier steht und nicht
// abonniert ist, kommt nie.
//   abo         der Stand des Abos wird bei Stripe GEHOLT und geschrieben
//   abschluss   Checkout fertig / Zahlung eingegangen (Lifetime, Experten-Gebuehr)
//   entzug      volle Erstattung oder Rueckbuchung nimmt eine eindeutig zugeordnete Lifetime zurueck (W2)
//   mitteilung  eine Zeile in der Inbox der Person
//   protokoll   eine Zeile in audit_log, sonst nichts
//   marktplatz  marketplace_sellers (Stripe Connect)
//   nichts      bewusst ohne Wirkung — mit Grund
export const STRIPE_EREIGNISSE = {
  'checkout.session.completed': { wirkung: 'abschluss' },
  // Bei einer verzoegerten Zahlungsart ist „completed" noch UNBEZAHLT; bezahlt meldet erst dieses
  // Ereignis. Ohne es bliebe ein solcher Lifetime-Kauf bezahlt, aber nie freigeschaltet.
  'checkout.session.async_payment_succeeded': { wirkung: 'abschluss' },
  'customer.subscription.created': { wirkung: 'abo' },
  'customer.subscription.updated': { wirkung: 'abo' },
  'customer.subscription.deleted': { wirkung: 'abo' },
  'invoice.paid': { wirkung: 'abo' },
  'invoice.payment_failed': { wirkung: 'abo' },
  'customer.subscription.trial_will_end': { wirkung: 'mitteilung' },
  'charge.refunded': { wirkung: 'entzug' },
  'charge.dispute.created': { wirkung: 'entzug' },
  'charge.failed': { wirkung: 'protokoll' },
  'payment_method.attached': { wirkung: 'protokoll' },
  'payment_intent.succeeded': { wirkung: 'abschluss' },
  'account.updated': { wirkung: 'marktplatz' },
  'account.application.deauthorized': { wirkung: 'marktplatz' },
  // Schrieb bis v33.62 `profiles.stripe_email` — eine Spalte, die es live nicht gibt und die niemand liest.
  'customer.updated': { wirkung: 'nichts', grund: 'die E-Mail des Stripe-Kunden liest in GreenScan niemand' },
};
export function ereignisWirkung(typ) {
  return Object.prototype.hasOwnProperty.call(STRIPE_EREIGNISSE, typ) ? STRIPE_EREIGNISSE[typ].wirkung : null;
}
export function ereignisListe() { return Object.keys(STRIPE_EREIGNISSE); }

// ── Kleine Leser — Stripe schickt eine Id oder das ganze Objekt ─────────────
export function idVon(x) {
  if (typeof x === 'string' && x) return x;
  if (x && typeof x === 'object' && typeof x.id === 'string' && x.id) return x.id;
  return null;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function istUuid(s) { return typeof s === 'string' && UUID.test(s); }
// `stripe_subscriptions.user_id` ist uuid NOT NULL: was keine UUID ist, lehnt die Datenbank bei
// jeder Wiederholung ab (22P02). Dann lieber „nicht zuordenbar".
export function nutzerAusMetadaten(metadata) {
  const v = metadata && typeof metadata === 'object' ? metadata.supabase_user_id : null;
  return istUuid(v) ? v.toLowerCase() : null;
}
const positiv = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
const isoAus = (sekunden) => (positiv(sekunden) === null ? null : new Date(sekunden * 1000).toISOString());

// ── Das Abo als Zeile in stripe_subscriptions ───────────────────────────────
// Der Zeitraum steht je nach API-Version am Abo (bis 2025-03-31.basil) oder am ersten Posten
// (seither). Wer nur eine Stelle liest, rechnet `new Date(undefined * 1000)` — das wirft.
export function aboZeitraum(sub) {
  const posten = sub && sub.items && Array.isArray(sub.items.data) ? sub.items.data[0] : null;
  const start = positiv(sub && sub.current_period_start) ?? positiv(posten && posten.current_period_start);
  const ende = positiv(sub && sub.current_period_end) ?? positiv(posten && posten.current_period_end);
  return { start: isoAus(start), ende: isoAus(ende) };
}
export function aboPreisId(sub) {
  const posten = sub && sub.items && Array.isArray(sub.items.data) ? sub.items.data[0] : null;
  return posten ? idVon(posten.price) : null;
}
// Endet das Abo von selbst? `cancel_at_period_end` — oder ein gesetztes `cancel_at`
// (so meldet es Stripe in neueren API-Versionen nach einer Kuendigung im Portal).
export function aboEndetVonSelbst(sub) {
  if (!sub) return false;
  if (sub.cancel_at_period_end === true) return true;
  const laeuft = sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due';
  return laeuft && positiv(sub.cancel_at) !== null;
}
// → { ok: true, zeile }  oder  { ok: false, grund }
// Ein Preis, den stripe_prices nicht kennt, ist KEIN Fall fuer diese Rechnung: der Rand wirft
// dann (W6 — 500, Stripe wiederholt, bis der Preis im Katalog steht; ein zahlender Kunde wird
// nicht still `free`).
export function aboZeile(sub, opts) {
  const o = opts || {};
  if (!sub || typeof sub !== 'object' || !idVon(sub)) return { ok: false, grund: 'kein Abo im Ereignis' };
  if (typeof sub.status !== 'string' || !sub.status) return { ok: false, grund: 'Abo ' + sub.id + ' ohne Status' };
  if (!istUuid(o.userId)) return { ok: false, grund: 'Abo ' + sub.id + ' ohne supabase_user_id' };
  const z = aboZeitraum(sub);
  const jetzt = Number.isFinite(o.jetztMs) ? o.jetztMs : Date.now();
  const meta = sub.metadata && typeof sub.metadata === 'object' ? sub.metadata : {};
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
      trial_end: isoAus(sub.trial_end),
      canceled_at: isoAus(sub.canceled_at),
      ended_at: isoAus(sub.ended_at),
      // `gs_stripe_stand`: der Zeitpunkt VOR dem Abruf (ereignisIstNeuer) — nie updated_at, das setzt der Trigger.
      metadata: Object.assign({}, meta, { gs_stripe_stand: typeof o.stand === 'string' ? o.stand : new Date(jetzt).toISOString() }),
      updated_at: new Date(jetzt).toISOString(),
    },
  };
}
// Zu welchem Abo gehoert eine Rechnung? Bis 2025-03-31.basil `invoice.subscription`,
// seither `invoice.parent.subscription_details.subscription`.
export function aboIdAusRechnung(rechnung) {
  if (!rechnung || typeof rechnung !== 'object') return null;
  const direkt = idVon(rechnung.subscription);
  if (direkt) return direkt;
  const eltern = rechnung.parent && rechnung.parent.subscription_details;
  return idVon(eltern && eltern.subscription);
}

// ── Was darf gekauft werden? ───────────────────────────────────────────────
// { preisZeile (aus stripe_prices, schon durch preisErlaubt), launch (Ergebnis von
//   launchAngebot), lifetime, aboLaeuft, wunschProbeTage, fruehereAbos, abfrageFehler }
//   → { ok: true, modus: 'subscription' | 'payment', probeTage, launch }
//   → { ok: false, status, grund }   — `grund` ist eine KENNUNG (W3), nie Rohtext
// Was die Person schon HAT, entscheidet der Server, nicht `gs_abo_plan` im Geraetespeicher:
// kein Abo neben einem laufenden (zwei Abbuchungen), nichts neben Lifetime. Lifetime NEBEN einem
// laufenden Abo ist erlaubt — der Webhook beendet das Abo dann zum Periodenende.
export function checkoutPlan(e) {
  const a = e || {};
  const intervall = preisIntervall(a.preisZeile);
  if (!a.preisZeile || a.preisZeile.active === false || !intervall) return { ok: false, status: 400, grund: 'unbekannter_preis' };
  const modus = intervall === 'lifetime' ? 'payment' : 'subscription';
  const lo = a.launch || { erlaubt: true, launch: false };
  if (!lo.erlaubt) {
    const st = lo.grund === 'ausverkauft' ? 410 : (lo.grund === 'schon_beansprucht' ? 409 : 503);
    return { ok: false, status: st, grund: 'launch_' + (lo.grund || 'nicht_pruefbar') };
  }
  if (a.lifetime === true) return { ok: false, status: 409, grund: 'lifetime_vorhanden' };
  if (modus === 'subscription' && a.aboLaeuft === true) return { ok: false, status: 409, grund: 'abo_laeuft' };
  const probeTage = modus === 'subscription'
    ? gratisTage({ wunsch: a.wunschProbeTage, fruehereAbos: a.fruehereAbos, abfrageFehler: a.abfrageFehler })
    : 0;
  return { ok: true, modus, launch: !!lo.launch, probeTage };
}

// ── Was an Checkout geht ───────────────────────────────────────────────────
// Die Parameter von „Create a Checkout Session", die es in der festgenagelten API-Version
// (2024-12-18.acacia, stripe@17.7.0) UND in der Referenz vom 11.11.2026 gibt: 39.
// `automatic_payment_methods` steht NICHT darin — den gibt es nur an PaymentIntents; an Checkout
// lehnt Stripe ihn mit 400 `parameter_unknown` ab (gefolgert aus der Referenz, nicht gegen Stripe
// gemessen). `payment_method_types` fehlt mit Absicht: ohne ihn zeigt Checkout, was im Dashboard
// eingeschaltet ist und zu Waehrung und Modus passt (Karte; TWINT bei CHF).
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
// Die Sprache der Stripe-Seiten: die der App, wenn sie eine der vier nennt — sonst 'auto'.
export const STRIPE_SPRACHEN = ['de', 'fr', 'it', 'en'];
export function stripeSprache(wunsch) {
  const s = typeof wunsch === 'string' ? wunsch.trim().toLowerCase().slice(0, 2) : '';
  return STRIPE_SPRACHEN.indexOf(s) >= 0 ? s : 'auto';
}
// { kundeId, preisId, modus, probeTage, userId, launch, erfolgUrl, abbruchUrl, sprache }
//   → das Objekt fuer checkout.sessions.create — nur Namen aus CHECKOUT_PARAMETER.
export function checkoutParameter(e) {
  const a = e || {};
  const p = {
    customer: a.kundeId,
    mode: a.modus,
    line_items: [{ price: a.preisId, quantity: 1 }],
    success_url: a.erfolgUrl,
    cancel_url: a.abbruchUrl,
    // claim_launch_offer ist nur ein Vermerk — gezaehlt wird im Webhook am PREIS (W7).
    metadata: { supabase_user_id: a.userId, claim_launch_offer: a.launch ? '1' : '0' },
    allow_promotion_codes: true,
    locale: stripeSprache(a.sprache),
  };
  if (a.modus === 'subscription') {
    p.subscription_data = { metadata: { supabase_user_id: a.userId } };
    if (a.probeTage > 0) p.subscription_data.trial_period_days = a.probeTage;
    // Auch in der Probezeit eine Zahlungsart hinterlegen — sonst endet das Abo mit ihr.
    p.payment_method_collection = 'always';
  } else {
    // Einmalkauf: Nutzer und Art reisen an der Zahlung mit.
    p.payment_intent_data = { metadata: { supabase_user_id: a.userId, kind: 'lifetime' } };
  }
  return p;
}

// ── Welcher Stripe-Kunde ist diese Person? ─────────────────────────────────
// EINE Antwort fuer checkout und portal: die neueste Abo-Zeile mit Kunde, sonst die Suche bei
// Stripe nach dem Kunden mit ihrer Id in den Metadaten. Die Id kommt NIE aus der Anfrage.
// Drei Zustaende: gefunden · nicht gefunden · nicht feststellbar (`sucheFehler`).
// Ein Nein der Datenbank WIRFT (dbMuss) — „nie gekauft" waere geraten.
//   → { kundeId, quelle: 'abo' | 'suche' | null, zeilen, sucheFehler }
// `ohneGemerkte: true` ueberspringt die gemerkte Id — wenn Stripe sie nicht (mehr) kennt.
export async function kundeFinden(e) {
  const a = e || {};
  if (!istUuid(a.userId)) return { kundeId: null, quelle: null, zeilen: [], sucheFehler: null };
  const zeilen = dbMuss(await a.admin
    .from('stripe_subscriptions')
    .select('id, status, cancel_at_period_end, stripe_customer_id, customer_id, is_lifetime, created_at')
    .eq('user_id', a.userId)
    .order('created_at', { ascending: false })
    .limit(20), 'stripe_subscriptions lesen') || [];
  const gemerkt = a.ohneGemerkte === true ? null : kundenId(zeilen);
  if (gemerkt) return { kundeId: gemerkt, quelle: 'abo', zeilen, sucheFehler: null };
  let gefunden = null, sucheFehler = null;
  try {
    const suche = await a.stripe.customers.search({ query: "metadata['supabase_user_id']:'" + a.userId + "'", limit: 1 });
    gefunden = suche && Array.isArray(suche.data) && suche.data[0] ? idVon(suche.data[0]) : null;
  } catch (err) {
    sucheFehler = String((err && err.message) || err);
  }
  return { kundeId: gefunden, quelle: gefunden ? 'suche' : null, zeilen, sucheFehler };
}

// ── Was die Person schon hat — und welches Abo „kuendigen" meint ────────────
export const ABO_LAEUFT = ['active', 'trialing', 'past_due'];
// Die ECHTEN Stripe-Abos (sub_…), die als laufend gefuehrt sind. Die Lifetime-Zeile heisst
// `lifetime_<uuid>` — an Stripe geschickt ist das „No such subscription".
export function laufendeAboIds(zeilen, nurOhneEnde) {
  return (Array.isArray(zeilen) ? zeilen : [])
    .filter((x) => x && typeof x.id === 'string' && /^sub_/.test(x.id) && ABO_LAEUFT.indexOf(x.status) >= 0
      && !(nurOhneEnde === true && x.cancel_at_period_end === true))
    .map((x) => x.id);
}
// Lifetime: `is_lifetime` UND `active`. Nach einem Entzug steht die Zeile auf `canceled`.
export function hatLifetime(zeilen) {
  return (Array.isArray(zeilen) ? zeilen : []).some((x) => x && x.is_lifetime === true && x.status === 'active');
}
// Portal: ein direkter Weg nur fuers KUENDIGEN, und nur auf ein echtes, laufendes Abo, das sich
// noch verlaengert. „Fortsetzen" bekam bis v33.62 `subscription_update` — das ist bei Stripe die
// Seite zum WECHSELN des Plans; eine Kuendigung nimmt man im gewoehnlichen Portal zurueck.
export function portalZiel(zeilen, flow) {
  if (flow !== 'cancel') return null;
  const ids = laufendeAboIds(zeilen, true);
  return ids.length ? ids[0] : null;
}

// ── Die Mitteilung „Probezeit endet" ───────────────────────────────────────
// Der Tag ist der in der Schweiz (die Function laeuft in UTC). „Karte hinterlegen" stimmte nie:
// die Zahlungsart wird beim Abschluss hinterlegt (payment_method_collection 'always').
export function datumSchweiz(sekunden) {
  if (positiv(sekunden) === null) return null;
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

// ── Was Stripe nicht (mehr) kennt, und in welchem Modus gearbeitet wird ─────
// Eine gemerkte Id kann bei Stripe fehlen: im Dashboard geloescht — oder aus dem ANDEREN Modus
// (Test ↔ Live). Erkannt an `code: resource_missing` ODER am Text „No such …" (nicht gegen Stripe
// gemessen). `ding`: 'customer' | 'subscription' | … — ohne Angabe: irgendetwas fehlt.
export function stripeKenntNicht(fehler, ding) {
  if (!fehler || typeof fehler !== 'object') return false;
  const m = /^No such ([a-z_.]+)\b/i.exec(String(fehler.message || ''));
  if (fehler.code !== 'resource_missing' && !m) return false;
  if (!ding) return true;
  const d = String(ding).toLowerCase();
  return m ? m[1].toLowerCase() === d : String(fehler.param || '').toLowerCase() === d;
}
// Hat Stripe die ANFRAGE abgelehnt (im Unterschied zu „nicht erreichbar")?
export function stripeLehntAb(fehler) {
  if (!fehler || typeof fehler !== 'object') return false;
  return fehler.type === 'StripeInvalidRequestError' || fehler.statusCode === 400 || fehler.statusCode === 404;
}
export function schluesselModus(schluessel) {
  const s = typeof schluessel === 'string' ? schluessel : '';
  if (/^(sk|rk)_live_/.test(s)) return 'live';
  if (/^(sk|rk)_test_/.test(s)) return 'test';
  return null;
}
// Passt ein Ereignis zum Schluessel der Function? Stripe schreibt `livemode` an jedes Ereignis.
//   ok · fehler (Live-Ereignis, Test-Schluessel: 500, Stripe wiederholt bis behoben)
//   · ignorieren (Test-Ereignis an Live-Schluessel, z.B. Connect: bestaetigt, nicht verarbeitet)
export function modusPasst(ereignisLivemode, schluessel) {
  const modus = schluesselModus(schluessel);
  if (modus === null || typeof ereignisLivemode !== 'boolean') return { art: 'ok' };
  if ((modus === 'live') === ereignisLivemode) return { art: 'ok' };
  if (!ereignisLivemode) return { art: 'ignorieren', text: 'Test-Ereignis an einem Endpunkt mit Live-Schluessel — nicht verarbeitet' };
  return { art: 'fehler', text: 'Das Ereignis kommt aus dem LIVE-Modus, aber STRIPE_SECRET_KEY ist ein TEST-Schluessel — Endpunkt und Schluessel muessen aus demselben Modus stammen' };
}
