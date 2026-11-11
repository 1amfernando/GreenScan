// ═══════════════════════════════════════════════════════════════════════════
// ingest_regeln.mjs — die RECHNENDEN Regeln des Empfaengers `device-ingest`
// (docs/OEKOSYSTEM-V1.md §3.1, §11 Idee 14; Vertrag: docs/GERAETE-VERTRAG.md)
//
// Warum eine eigene Datei ohne Deno- und ohne Datenbank-Zugriff: Deno ist in
// der Claude-Cloud-Umgebung nicht installiert, die Edge-Function selbst laeuft
// dort nicht. Alles, was sich RECHNEN laesst — Batch pruefen, die Uhr des
// Geraets beurteilen, Qualitaet setzen, Dubletten im Batch, Befehle mit
// Ablauf, Rate-Limit, naechster Kontakt — steht deshalb hier, als reines
// ESM-Modul, das Deno (`device-ingest/index.ts`) UND Node
// (`scripts/ingest_check.js`) importieren. Der Prueftand faehrt jede Regel
// mit einem guten und einem schlechten Batch (CLAUDE.md §4b).
//
// Drei Regeln, die hier festgehalten sind und die der Primaerschluessel
// (device_id, metric, ts) allein NICHT haelt:
//   1. Eine falsche Uhr ist kein Grund zum Verwerfen. Ein ESP32 ohne NTP
//      schickt ts=1970 — mit `on conflict do nothing` ueberlebte davon die
//      ERSTE Zeile, alle weiteren verschwanden lautlos. Jetzt: ts wird aus
//      `age_s` (Alter beim Senden) und der Serverzeit gebaut, das Original
//      bleibt in raw.device_ts, raw.clock sagt 'untrusted'.
//   2. Eine Vorhersage ist kein Messwert — und ein Zeitstempel in der
//      Zukunft (mehr als 5 Minuten) ist eine falsche Uhr, kein Ereignis.
//   3. Kein Messwert wird verworfen: ausserhalb des Bereichs ist quality 1.
//      Verworfen wird nur, was KEIN Messwert ist (unbekannte Groesse, keine
//      Zahl) — und das wird in der Antwort mit Grund genannt.
// ═══════════════════════════════════════════════════════════════════════════

export const VERTRAG_VERSIONEN = [1];
export const BATCH_MAX = 500;                      // Werte je Aufruf — mehr ist ein Fehler im Geraet
export const UHR_FRUEHESTENS = Date.UTC(2024, 0, 1); // vor 2024 gab es keine GreenScan-Geraete
export const UHR_ZUKUNFT_MS = 5 * 60 * 1000;        // mehr als 5 Minuten voraus = falsche Uhr
export const KONTAKT_VORGABE_S = 3600;              // ohne interval_s: einmal je Stunde
export const BEFEHL_VERSUCHE_MAX = 3;               // §3.3: nach 3 Kontakten ohne Ack → failed

function zahl(x) { const n = typeof x === 'number' ? x : parseFloat(x); return Number.isFinite(n) ? n : null; }
function iso(ms) { return new Date(ms).toISOString(); }

/**
 * Prueft einen Batch. Kein Datenbankzugriff — Geraet und Katalog kommen als
 * Kontext herein. Gibt entweder einen Fehler mit HTTP-Status zurueck oder die
 * Zeilen, die eingefuegt werden sollen.
 *
 * @param {object} body       der JSON-Koerper der Anfrage
 * @param {object} ctx        { device: {id, user_id, status, capabilities, last_seen_at},
 *                              katalog: Map<key, {unit, min_valid, max_valid}>,
 *                              now: ms (Serverzeit) }
 * @returns {{ok:false,status:number,error:string,detail?:object}|
 *           {ok:true,rows:object[],rejected:object[],duplikate_im_batch:number,uhr:string,zukunft:number}}
 */
export function pruefeBatch(body, ctx) {
  const now = ctx.now;
  if (!body || typeof body !== 'object') return { ok: false, status: 400, error: 'json' };
  const version = zahl(body.schema_version);
  if (version === null || !VERTRAG_VERSIONEN.includes(version)) {
    return { ok: false, status: 400, error: 'schema_version', detail: { bekannt: VERTRAG_VERSIONEN, geschickt: body.schema_version ?? null } };
  }
  const d = ctx.device;
  if (!d) return { ok: false, status: 401, error: 'token' };
  if (d.status === 'paused') return { ok: false, status: 409, error: 'paused' };
  if (!Array.isArray(body.readings)) return { ok: false, status: 400, error: 'readings' };
  if (body.readings.length > BATCH_MAX) return { ok: false, status: 413, error: 'batch', detail: { max: BATCH_MAX, geschickt: body.readings.length } };

  const rows = [], rejected = [], gesehen = new Set();
  let duplikate = 0, zukunft = 0, uhr = 'ok';
  body.readings.forEach((r, i) => {
    if (!r || typeof r !== 'object') { rejected.push({ index: i, grund: 'kein Objekt' }); return; }
    const k = ctx.katalog.get(String(r.metric || ''));
    if (!k) { rejected.push({ index: i, metric: r.metric ?? null, grund: 'unbekannte Messgroesse — eine neue Sensorart ist eine Zeile in metric_catalog' }); return; }
    const v = zahl(r.value);
    if (v === null) { rejected.push({ index: i, metric: r.metric, grund: 'kein Zahlenwert' }); return; }

    // ── Die Uhr des Geraets ──────────────────────────────────────────────
    const raw = {};
    let ts = null;
    const age = zahl(r.age_s);
    if (age !== null && age >= 0) ts = now - age * 1000;                      // Alter relativ zum Senden: braucht keine Uhr
    else if (r.ts != null) {
      const t = Date.parse(String(r.ts));
      if (Number.isFinite(t) && t >= UHR_FRUEHESTENS && t <= now + UHR_ZUKUNFT_MS) ts = t;
      else { raw.device_ts = r.ts; raw.clock = 'untrusted'; uhr = 'untrusted'; if (Number.isFinite(t) && t > now + UHR_ZUKUNFT_MS) zukunft++; ts = now; }
    } else ts = now;                                                           // weder ts noch age_s: jetzt
    if (r.seq != null) raw.seq = r.seq;
    if (raw.clock === 'untrusted' && age === null) raw.ts_aus = 'received_at';

    // ── Qualitaet: ausserhalb des Bereichs ist eine Information, kein Loeschgrund ──
    let quality = 2;
    if ((typeof k.min_valid === 'number' && v < k.min_valid) || (typeof k.max_valid === 'number' && v > k.max_valid)) quality = 1;
    if (r.error === true) quality = 0;

    // ── Dubletten im selben Batch (der Primaerschluessel faengt die zwischen Batches) ──
    const schl = r.metric + '|' + iso(ts);
    if (gesehen.has(schl)) { duplikate++; return; }
    gesehen.add(schl);
    rows.push({ device_id: d.id, user_id: d.user_id, metric: String(r.metric), ts: iso(ts), value: v, quality, raw: Object.keys(raw).length ? raw : null });
  });
  return { ok: true, rows, rejected, duplikate_im_batch: duplikate, uhr, zukunft };
}

/** Rate-Limit je Geraet: interval_s / 2 als kuerzester Abstand (§3.1). Je AUFRUF, nicht je Wert. */
export function rateLimit(device, now) {
  const iv = zahl(device && device.capabilities && device.capabilities.interval_s);
  if (!iv || iv <= 0 || !device.last_seen_at) return { ok: true, retry_after_s: 0 };
  const last = Date.parse(device.last_seen_at);
  if (!Number.isFinite(last)) return { ok: true, retry_after_s: 0 };
  const mindest = iv / 2 * 1000, seit = now - last;
  return seit >= mindest ? { ok: true, retry_after_s: 0 } : { ok: false, retry_after_s: Math.ceil((mindest - seit) / 1000) };
}

/** Wann sich das Geraet das naechste Mal melden soll — aus seinen Faehigkeiten, sonst Vorgabe. */
export function naechsterKontaktS(device) {
  const iv = zahl(device && device.capabilities && device.capabilities.interval_s);
  return iv && iv > 0 ? Math.round(iv) : KONTAKT_VORGABE_S;
}

/** Wann ein Geraet als verstummt gilt: drei Kontakte ohne Wort (§11 Idee 16). */
export function erwartetBis(receivedAtMs, kontaktS) {
  return iso(receivedAtMs + 3 * kontaktS * 1000);
}

/**
 * Offene Befehle fuer die Antwort aufbereiten (§3.3, §11 Idee 20):
 * abgelaufene werden `failed` und NICHT gesendet; die anderen reisen mit
 * id und Ablauf, ihr Versuchszaehler steigt; nach BEFEHL_VERSUCHE_MAX
 * Versuchen ohne Ack → failed.
 */
export function befehleAufbereiten(commands, now) {
  const senden = [], failed = [];
  (commands || []).forEach((c) => {
    if (!c || (c.status !== 'pending' && c.status !== 'sent')) return;
    const exp = c.expires_at ? Date.parse(c.expires_at) : NaN;
    if (Number.isFinite(exp) && exp <= now) { failed.push({ id: c.id, grund: 'abgelaufen' }); return; }
    const versuche = (c.attempts || 0) + 1;
    if (versuche > BEFEHL_VERSUCHE_MAX) { failed.push({ id: c.id, grund: 'keine Bestaetigung nach ' + BEFEHL_VERSUCHE_MAX + ' Kontakten' }); return; }
    senden.push({ id: c.id, command: c.command, params: c.params || {}, expires_at: c.expires_at || null, attempt: versuche });
  });
  return { senden, failed };
}

/**
 * Bestaetigungen des Geraets (`acks: [{id, ok, message}]`) → welche Befehle
 * `acked` bzw. `failed` werden. Unbekannte ids werden genannt, nicht
 * stillschweigend ignoriert.
 */
export function acksAuswerten(acks, offene) {
  const bekannt = new Map((offene || []).map((c) => [c.id, c]));
  const acked = [], failed = [], unbekannt = [];
  (Array.isArray(acks) ? acks : []).forEach((a) => {
    if (!a || !bekannt.has(a.id)) { unbekannt.push(a && a.id); return; }
    (a.ok === false ? failed : acked).push({ id: a.id, message: a.message || null });
  });
  return { acked, failed, unbekannt };
}

/**
 * Die Antwort an das Geraet (§3.1 Punkt 6, erweitert um §11 Idee 14):
 * accepted und duplicates GETRENNT, server_time fuer Geraete ohne Uhr,
 * next_contact_s, und die Befehle mit Ablauf. `firmware` bleibt null,
 * bis es einen Firmware-Kanal gibt (Idee 18).
 */
export function antwort(pruefung, eingefuegt, ctx) {
  const dupl = Math.max(0, pruefung.rows.length - eingefuegt) + pruefung.duplikate_im_batch;
  const kontakt = naechsterKontaktS(ctx.device);
  return {
    schema_version: 1,
    accepted: eingefuegt,
    duplicates: dupl,
    rejected: pruefung.rejected,
    clock: pruefung.uhr,
    server_time: iso(ctx.now),
    next_contact_s: kontakt,
    commands: (ctx.commands && ctx.commands.senden) || [],
    firmware: null,
  };
}
