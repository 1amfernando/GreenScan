// zahlung_regeln.mjs — was die Zahlungs-Functions RECHNEN (v33.59)
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
export function gratisTage({ wunsch, fruehereAbos, abfrageFehler, max = 7, vorgabe = 7 } = {}) {
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
