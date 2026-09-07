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

/** Ein Push an ein Abonnement. Wirft nie — { ok, status, error? }. */
export async function sendPush(webpush, sub, n, vapid) {
  try {
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    const pushSub = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_secret } };
    const res = await webpush.sendNotification(pushSub, JSON.stringify(pushPayload(n)), { TTL: PUSH_TTL_S });
    return { ok: true, status: res && res.statusCode };
  } catch (e) {
    return { ok: false, status: e && e.statusCode, error: String((e && e.message) || e) };
  }
}
