// supabase/functions/_shared/push_helfer.mjs — v32.75 (Audit C4)
//
// Drei Helfer, die vier Push-Sender (daily-push-checker, engagement-push-checker,
// weather-alert-checker, sensor-push) bis v32.74 je als eigene Kopie trugen —
// zwölf Kopien, in drei Varianten auseinandergelaufen (Fehlertexte, Signatur
// von sendPush, tag-Rückfall, und in jeder Kopie eine private E-Mail-Adresse
// als VAPID-Rückfall, die über den Web-Root lesbar war).
//
// Reines ESM ohne Importe: Deno lädt es aus der Edge-Function, Node aus dem
// Prüfstand (robust_check). Abhängigkeiten — Supabase-Client und web-push —
// kommen als PARAMETER, damit der Prüfstand die Rechnung ohne Netz misst.

export const VAPID_SUBJECT_RUECKFALL = 'mailto:info@greenscan.ch';
export const PUSH_ICON = 'https://green-scan.ch/icons/icon-192.png';
export const PUSH_BADGE = 'https://green-scan.ch/icons/icon-96.png';
export const PUSH_TTL_S = 3600;
export const SETTINGS_KEYS = ['vapid_public_key', 'vapid_private_key', 'vapid_subject', 'push_cron_secret'];

/** app_settings → { vapid:{publicKey, privateKey, subject}, cronSecret } — wirft, wenn VAPID fehlt. */
export async function loadSettings(sb) {
  const { data, error } = await sb.from('app_settings').select('key,value').in('key', SETTINGS_KEYS);
  if (error) throw new Error('settings load: ' + (error.message || String(error)));
  const m = {};
  for (const r of data || []) if (r && r.key) m[r.key] = r.value;
  if (!m.vapid_public_key || !m.vapid_private_key) throw new Error('VAPID-Keys fehlen');
  return {
    vapid: { publicKey: m.vapid_public_key, privateKey: m.vapid_private_key, subject: m.vapid_subject || VAPID_SUBJECT_RUECKFALL },
    cronSecret: m.push_cron_secret || null,
  };
}

/** Stunde in Europe/Zurich (0–23) für einen Zeitpunkt (Date, ms oder ISO); ohne Argument jetzt. Rückfall UTC. */
export function zurichHour(now) {
  const d = now instanceof Date ? now : new Date(now === undefined ? Date.now() : now);
  try {
    return Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Europe/Zurich' }).format(d)) % 24;
  } catch (_) {
    return d.getUTCHours();
  }
}

/** Die Nutzlast, die alle Sender schicken — EINE Form an EINEM Ort. */
export function pushPayload(n) {
  const url = (n && n.url) || '/';
  return {
    title: String((n && n.title) || ''),
    body: String((n && n.body) || ''),
    url,
    icon: PUSH_ICON,
    badge: PUSH_BADGE,
    tag: (n && n.tag) || ('gs-' + Date.now()),
    data: { url },
  };
}

// ── v33.59 (Sicherheitspruefung 10.11.2026) ─────────────────────────────────
// Der Endpunkt eines Abonnements schreibt die Person selbst (push_subscriptions,
// RLS nur `auth.uid() = user_id`). Ohne Pruefung schickte jede Function einen
// HTTPS-POST an jede Adresse, die dort steht (SSRF) — und ein Endpunkt, der die
// Verbindung annimmt und nie antwortet, hielt den seriellen Cron fuer ALLE an.

/** Die Push-Dienste, die PushManager.subscribe() real liefert. Ein Eintrag mit
 *  fuehrendem Punkt ist eine Endung (web.push.apple.com, wns2-*.notify.windows.com). */
export const PUSH_HOSTS = [
  'fcm.googleapis.com',                 // Chrome, Android, Samsung, Opera, Brave
  'updates.push.services.mozilla.com',  // Firefox
  '.notify.windows.com',                // Edge (WNS)
  '.push.apple.com',                    // Safari / iOS-Homescreen (web.push.apple.com)
];
export const PUSH_TIMEOUT_MS = 8000;     // je Versand; danach gilt er als gescheitert
// je Nutzer und Lauf hoechstens so viele Abos, neueste zuerst. v33.59: DIESELBE Zahl wie
// der DB-Deckel (fn_push_subs_deckel, OFFSET 9 in 20261110_sicherheit_konto_speicher.sql) —
// mit 5 verlor das 6. bis 10. erlaubte Geraet still jeden Push (edge 30_push haelt beide).
export const ABOS_JE_NUTZER = 10;
export const PARALLEL = 6;               // so viele Abos gleichzeitig in Arbeit
export const LAUF_BUDGET_MS = 110000;    // danach wird nichts Neues begonnen (Wandzeit der Edge-Laufzeit 150 s)

/** Ist das ein Endpunkt eines bekannten Push-Dienstes? Wirft nie — { ok, grund }. */
export function pushEndpunktOk(url) {
  if (typeof url !== 'string' || !url || url.length > 2048) return { ok: false, grund: 'kein Endpunkt' };
  // Gegenpruefung: web-push liest die Adresse mit dem ALTEN url.parse, nicht mit URL —
  // „https://opfer.example;.push.apple.com/" ist fuer URL ein Apple-Host, fuer url.parse
  // „opfer.example". Deshalb zuerst die Rohform: https://<nur a-z0-9.->[:443]/ — dann
  // lesen beide Parser denselben Host.
  const roh = /^https:\/\/([a-z0-9.-]+)(?::443)?\//i.exec(url);
  if (!roh) return { ok: false, grund: 'Adresse nicht in Normalform' };
  let u;
  try { u = new URL(url); } catch (_) { return { ok: false, grund: 'keine Adresse' }; }
  if (u.protocol !== 'https:') return { ok: false, grund: 'nicht https' };
  if (u.username || u.password) return { ok: false, grund: 'Zugangsdaten in der Adresse' };
  if (u.port && u.port !== '443') return { ok: false, grund: 'Port ' + u.port };
  const host = u.hostname.toLowerCase();
  if (host !== roh[1].toLowerCase()) return { ok: false, grund: 'Host mehrdeutig' };
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.indexOf(':') >= 0 || host.charAt(0) === '[') return { ok: false, grund: 'IP-Adresse' };
  const bekannt = PUSH_HOSTS.some((h) => h.charAt(0) === '.'
    ? (host.length > h.length && host.slice(-h.length) === h)
    : host === h);
  if (!bekannt) return { ok: false, grund: 'kein bekannter Push-Dienst: ' + host.slice(0, 80) };
  return { ok: true, grund: null };
}

function _zeit(x) { const t = Date.parse(String(x || '')); return Number.isFinite(t) ? t : 0; }

/**
 * Welche Abos ein Lauf bearbeitet: nur bekannte Push-Dienste, je Nutzer die
 * `jeNutzer` neuesten, und reihum ueber die Nutzer (erst das neueste Abo jedes
 * Nutzers, dann das zweite …) — wer viele Abos hat, drueckt niemanden nach hinten.
 * `gruppen` sind dieselben Abos je Nutzer: wer nach Nutzer dedupliziert
 * (fn_push_already_sent_today), arbeitet die Abos EINES Nutzers nacheinander ab.
 * @returns {{abos:object[], gruppen:object[][], abgewiesen:{id,user_id,grund}[], gedeckelt:number}}
 */
export function abosAuswaehlen(subs, opt) {
  const jeNutzer = (opt && opt.jeNutzer) || ABOS_JE_NUTZER;
  const abgewiesen = [], jeU = new Map();
  (subs || []).forEach((s) => {
    if (!s || !s.user_id) return;
    const e = pushEndpunktOk(s.endpoint);
    if (!e.ok) { abgewiesen.push({ id: s.id, user_id: s.user_id, grund: e.grund }); return; }
    if (!jeU.has(s.user_id)) jeU.set(s.user_id, []);
    jeU.get(s.user_id).push(s);
  });
  let gedeckelt = 0;
  const listen = [];
  jeU.forEach((l) => {
    l.sort((a, b) => (_zeit(b.updated_at || b.created_at) - _zeit(a.updated_at || a.created_at)));
    if (l.length > jeNutzer) { gedeckelt += l.length - jeNutzer; l.length = jeNutzer; }
    listen.push(l);
  });
  const abos = [];
  for (let i = 0; i < jeNutzer; i++) listen.forEach((l) => { if (l[i]) abos.push(l[i]); });
  return { abos, gruppen: listen, abgewiesen, gedeckelt };
}

/** Ein Versprechen mit Frist: nach `ms` gilt es als gescheitert (Fehler mit `frist: true`). */
export function mitFrist(p, ms, grund) {
  let t;
  const frist = new Promise((_, nein) => { t = setTimeout(() => { const e = new Error(grund || ('Frist ' + ms + ' ms')); e.frist = true; nein(e); }, ms); });
  return Promise.race([Promise.resolve(p), frist]).finally(() => clearTimeout(t));
}

/**
 * Arbeitet `liste` mit hoechstens `parallel` gleichzeitigen `fn`-Aufrufen ab; nach
 * `budgetMs` wird nichts Neues mehr begonnen, und nach `budgetMs + nachlaufMs` wird
 * auch auf Haengendes nicht mehr gewartet (es zaehlt als `haengt`). Wirft nie.
 * @returns {Promise<{ergebnisse:{status,value?,reason?}[], erledigt:number, nichtBegonnen:number, haengt:number, abgebrochen:boolean}>}
 */
export async function abarbeiten(liste, fn, opt) {
  const o = opt || {};
  const parallel = Math.max(1, o.parallel || PARALLEL);
  const budget = o.budgetMs == null ? LAUF_BUDGET_MS : o.budgetMs;
  const jetzt = o.jetzt || (() => Date.now());
  const start = jetzt();
  const ergebnisse = new Array(liste.length);
  let naechster = 0, erledigt = 0, abgebrochen = false;
  async function arbeiter() {
    while (naechster < liste.length) {
      if (jetzt() - start >= budget) { abgebrochen = true; return; }
      const i = naechster++;
      try { ergebnisse[i] = { status: 'fulfilled', value: await fn(liste[i], i) }; }
      catch (e) { ergebnisse[i] = { status: 'rejected', reason: String((e && e.message) || e) }; }
      erledigt++;
    }
  }
  const nachlauf = o.nachlaufMs == null ? 20000 : o.nachlaufMs;
  let t;
  const ende = new Promise((ja) => { t = setTimeout(ja, budget + nachlauf); });
  await Promise.race([Promise.all(Array.from({ length: Math.min(parallel, liste.length) }, arbeiter)), ende]);
  clearTimeout(t);
  const begonnen = Math.min(naechster, liste.length);
  const haengt = begonnen - erledigt;
  if (haengt > 0) abgebrochen = true;
  return { ergebnisse, erledigt, nichtBegonnen: liste.length - begonnen, haengt, abgebrochen };
}

/** Ein Push an ein Abonnement. Wirft nie — { ok, status, error?, abgewiesen? }.
 *  v33.59: nur an bekannte Push-Dienste (pushEndpunktOk) und mit Frist (opts.timeoutMs). */
export async function sendPush(webpush, sub, n, vapid, opts) {
  const e = pushEndpunktOk(sub && sub.endpoint);
  if (!e.ok) return { ok: false, status: null, abgewiesen: true, error: 'Endpunkt abgewiesen: ' + e.grund };
  const ms = (opts && opts.timeoutMs) || PUSH_TIMEOUT_MS;
  try {
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    const pushSub = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_secret } };
    const res = await mitFrist(webpush.sendNotification(pushSub, JSON.stringify(pushPayload(n)), { TTL: PUSH_TTL_S, timeout: ms }), ms + 500, 'keine Antwort nach ' + ms + ' ms');
    return { ok: true, status: res && res.statusCode };
  } catch (err) {
    return { ok: false, status: err && err.statusCode, error: String((err && err.message) || err) };
  }
}
