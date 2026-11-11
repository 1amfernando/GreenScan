// ═══════════════════════════════════════════════════════════════════════════
// sensor_push_regeln.mjs — die RECHNENDEN Regeln des Pushers `sensor-push`
// (docs/OEKOSYSTEM-V1.md §3.4, §11 Idee 16)
//
// Der Fund (06.09.2026): der Cron `device-alerts` schreibt Zeilen in
// `notifications` (Art `sensor_alert`) — und NIEMAND pusht sie. Die Bruecke
// aus 20260826_push_to_inbox_bridge.sql laeuft in EINE Richtung:
// push_send_log → notifications. Eine Inbox-Zeile wird nie zum Push. Der
// Entwurf (§3.4) versprach „Push ueber denselben Weg wie heute" und §11.3j
// behauptete, daily-push-checker lese `notifications` — das tut er nicht;
// er rechnet seine Pushes selbst (Frost, Saison, Aufgaben, Quiz) und die
// Bruecke spiegelt sie in die Inbox.
//
// Deshalb dieses Modul: die Edge-Function `sensor-push` (vom Cron
// `device-alerts` aufgerufen, sobald er etwas Neues gemeldet hat) nimmt die
// frischen `sensor_alert`-Zeilen und pusht sie ueber das daily-push-Muster
// — VAPID, Stille-Zeit, Pause, `notify_sensor`, push_send_log. Was hier
// steht, ist die Rechnung; scripts/sensor_push_check.js faehrt jede Regel
// mit einem guten und einem schlechten Fall (CLAUDE.md §4b).
//
// Drei Regeln, die das Modul haelt:
//   1. EINE Inbox-Zeile bleibt EINE. Die Protokollzeile in push_send_log
//      traegt `payload_meta.notification_id`; die Bruecke (seit
//      20260906_sensor_push.sql) spiegelt solche Zeilen NICHT — sonst staende
//      jeder Alarm zweimal in der Inbox.
//   2. Jede Meldung wird je Abonnement HOECHSTENS EINMAL versucht. Der
//      Marker ist das Protokoll (notification_id + subscription_id), nicht
//      eine Spalte in `notifications` (die Live-Tabelle hat keine, und ein
//      Push ist ein Ereignis am Abonnement, nicht an der Meldung).
//   3. Stumm ist nicht weg. In der Stille-Zeit oder waehrend einer Pause
//      wird protokolliert (`suppressed_quiet` / `suppressed_paused`) und
//      NICHT nachgeholt — die Inbox hat die Zeile laengst, und ein Alarm von
//      23:30 um 07:00 als Push waere eine Nachricht ueber gestern.
// ═══════════════════════════════════════════════════════════════════════════

export const KATEGORIE = 'sensor_alert';                 // notifications.kind UND push_send_log.category
export const FENSTER_MS = 24 * 60 * 60 * 1000;           // nur Meldungen der letzten 24 h — Aelteres ist Geschichte, kein Alarm
export const STILLE_VORGABE = { von: 22, bis: 7 };       // dieselbe Vorgabe wie daily-push-checker
export const FEHLSCHLAEGE_MAX = 5;                       // dieselbe Grenze wie engagement-push-checker (lt 5)
export const ZIEL_VORGABE = '/?screen=garden';           // ohne Link: das Dashboard
export const BRIDGE_MARKER = 'notification_id';          // der Schluessel in payload_meta, den die Bruecke prueft

function ms(x) { const t = Date.parse(String(x || '')); return Number.isFinite(t) ? t : NaN; }

/** Stille-Zeit — dieselbe Rechnung wie inQuietHours in daily-push-checker. */
export function inStille(stunde, von, bis) {
  const qs = von == null ? STILLE_VORGABE.von : Number(von);
  const qe = bis == null ? STILLE_VORGABE.bis : Number(bis);
  if (qs === qe) return false;
  if (qs < qe) return stunde >= qs && stunde < qe;
  return stunde >= qs || stunde < qe;
}

/**
 * Plant, welche Meldung an welches Abonnement geht. Kein Datenbankzugriff.
 *
 * @param {object} p
 * @param {object[]} p.meldungen   notifications-Zeilen {id, user_id, kind, title, body, link, created_at}
 * @param {object[]} p.protokoll   push_send_log-Zeilen der Kategorie (Fenster) {user_id, payload_meta, result}
 * @param {object[]} p.abos        push_subscriptions-Zeilen {id, user_id, endpoint, notify_sensor,
 *                                 quiet_start_hour, quiet_end_hour, pause_until, push_failure_count}
 * @param {number}   p.now         Serverzeit in ms
 * @param {number}   p.stunde      lokale Stunde (Europe/Zurich), 0–23
 * @returns {{senden:{meldung,abo}[], stumm:{meldung,abo,grund}[], uebersprungen:{meldung_id,abo_id?,grund}[]}}
 */
export function planen(p) {
  const now = p.now, stunde = p.stunde;
  const senden = [], stumm = [], uebersprungen = [];

  // Was schon versucht wurde — je Meldung und Abonnement; eine alte Zeile
  // ohne subscription_id gilt fuer alle Abonnements dieses Nutzers.
  const schon = new Set();
  (p.protokoll || []).forEach((z) => {
    const m = z && z.payload_meta;
    if (!m || !m[BRIDGE_MARKER]) return;
    schon.add(m[BRIDGE_MARKER] + '|' + (m.subscription_id || '*'));
  });

  // Abonnements je Nutzer, jeder Endpunkt nur einmal.
  const aboJeNutzer = new Map(), endpunkte = new Set();
  (p.abos || []).forEach((a) => {
    if (!a || !a.user_id || !a.endpoint || endpunkte.has(a.endpoint)) return;
    endpunkte.add(a.endpoint);
    if (!aboJeNutzer.has(a.user_id)) aboJeNutzer.set(a.user_id, []);
    aboJeNutzer.get(a.user_id).push(a);
  });

  (p.meldungen || []).forEach((m) => {
    if (!m || !m.id) return;
    if (m.kind !== KATEGORIE) { uebersprungen.push({ meldung_id: m.id, grund: 'andere Art: ' + m.kind }); return; }
    const alter = now - ms(m.created_at);
    if (!Number.isFinite(alter) || alter > FENSTER_MS) { uebersprungen.push({ meldung_id: m.id, grund: 'zu alt' }); return; }
    const liste = aboJeNutzer.get(m.user_id) || [];
    if (!liste.length) { uebersprungen.push({ meldung_id: m.id, grund: 'kein Abonnement' }); return; }
    liste.forEach((a) => {
      if (schon.has(m.id + '|' + a.id) || schon.has(m.id + '|*')) { uebersprungen.push({ meldung_id: m.id, abo_id: a.id, grund: 'schon protokolliert' }); return; }
      if (a.notify_sensor === false) { uebersprungen.push({ meldung_id: m.id, abo_id: a.id, grund: 'abgeschaltet' }); return; }
      if ((a.push_failure_count || 0) >= FEHLSCHLAEGE_MAX) { uebersprungen.push({ meldung_id: m.id, abo_id: a.id, grund: 'zu viele Fehlschlaege' }); return; }
      const pause = ms(a.pause_until);
      if (Number.isFinite(pause) && pause > now) { stumm.push({ meldung: m, abo: a, grund: 'pause' }); return; }
      if (inStille(stunde, a.quiet_start_hour, a.quiet_end_hour)) { stumm.push({ meldung: m, abo: a, grund: 'stille' }); return; }
      senden.push({ meldung: m, abo: a });
    });
  });
  return { senden, stumm, uebersprungen };
}

/** Was im Push steht: Titel und Text der Inbox-Zeile, der Link mit dem Anker, ein Tag je Geraet. */
export function nutzlast(m) {
  const url = (m.link && String(m.link).trim()) || ZIEL_VORGABE;
  const g = /#geraet-([A-Za-z0-9_-]{1,64})/.exec(url);
  return {
    title: String(m.title || '').slice(0, 120),
    body: String(m.body || '').slice(0, 240),
    url,
    tag: g ? 'gs-sensor-' + g[1] : 'gs-sensor',   // gleiches Geraet = gleicher Tag: das Betriebssystem ersetzt, statt zu stapeln
  };
}

/** Die Protokollzeile fuer push_send_log — mit dem Marker, den die Bruecke prueft. */
export function protokollZeile(m, a, ergebnis) {
  const n = nutzlast(m);
  const meta = { subscription_id: a.id, url: n.url };
  meta[BRIDGE_MARKER] = m.id;
  return {
    user_id: m.user_id, category: KATEGORIE, title: n.title, body: n.body,
    payload_meta: meta,
    result: ergebnis.result,
    http_status: ergebnis.status == null ? null : ergebnis.status,
    error_msg: ergebnis.error == null ? null : String(ergebnis.error).slice(0, 300),
  };
}

/** Stumm protokollieren — damit es beim naechsten Lauf nicht nachgeholt wird. */
export function stummZeile(m, a, grund) {
  return protokollZeile(m, a, { result: grund === 'pause' ? 'suppressed_paused' : 'suppressed_quiet' });
}
