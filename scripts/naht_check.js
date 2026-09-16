#!/usr/bin/env node
// naht_check.js — passen App, Empfaenger, Cron und Pusher zusammen?
//
//   node scripts/naht_check.js
//
// Die Sensor-Kette hat vier Teile, die einander nie sehen: die App
// (index.html) schreibt in `devices` und `device_rules` und liest
// `device_readings`; der Empfaenger (device-ingest) schreibt `device_readings`
// und aktualisiert `devices`; der Cron (fn_device_alerts, SQL) liest Regeln
// und Werte und schreibt `notifications`; der Pusher (sensor-push) liest
// `notifications` und `push_subscriptions` und schreibt `push_send_log`.
// Jeder Teil nennt Spalten und Schluessel der anderen — und nichts prueft, ob
// sie uebereinstimmen. Eine umbenannte Spalte faellt hier nicht auf: PostgREST
// meldet einen Fehler, die App faengt ihn ab, die Kachel bleibt leer.
//
// Dieser Pruefstand liest die NAHT: Spaltenlisten aus den Migrationen (fuer
// alles, was ein Repo-Skript anlegt) und aus einer datierten Momentaufnahme
// (docs/naht-spalten.json, fuer die drei Live-Tabellen, die kein Skript hier
// anlegt) — und haelt dagegen, was jeder Teil im Quelltext benutzt. Dazu zwei
// Rechnungen, die wirklich laufen: der Token-Hash der App gegen den des
// Empfaengers, und die Batch-Zeilen des Empfaengers gegen die Tabelle.
// Wie backend_check: ohne Netz und ohne Zugangsdaten — mit EINER Ausnahme
// seit v33.41 (KALENDER-V2 Scheibe 7): der Fall „App und Sicht zaehlen
// dieselben Aufgaben" RECHNET `v_plant_tasks_due` in einem lokalen Postgres
// nach (wie quiz_check und backup_check). Ohne Postgres meldet er „nicht
// pruefbar" (Exit 2), nie gruen — die anderen Faelle laufen weiter ohne.
//
// Drei Klassen, nicht zwei: live (Momentaufnahme) · per Migration vorbereitet
// (nicht angewandt) · fehlt nirgends. Nur das Letzte ist rot.
'use strict';
const fs = require('fs');
const path = require('path');
const nodeCrypto = require('crypto');
const { spawnSync } = require('child_process');
// v33.41: die SQL-Haelfte (siehe Kopf). Dieselbe Bauform wie backup_check.
const PG_URL = process.env.GS_PG_URL || 'postgresql://postgres@127.0.0.1:54329/postgres';
const PG_DB = 'gs_naht_check';
function psql(url, args) { return spawnSync('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-F', '\t', ...args], { encoding: 'utf8' }); }
function pgLetzte(r) {
  const z = String((r.stderr || r.stdout || '')).trim().split('\n').map(x => x.trim()).filter(Boolean);
  return (z.find(x => /^(ERROR|FEHLER|DETAIL|HINT)/i.test(x)) || z[0] || '').slice(0, 200);
}
function pgSql(url, q) { const r = psql(url, ['-c', q]); if (r.status !== 0) throw new Error(pgLetzte(r)); return (r.stdout || '').trim(); }
function pgDa() { const r = psql(PG_URL, ['-c', 'select 1']); return r.status === 0; }

const WURZEL = path.resolve(__dirname, '..');
const lies = (p) => fs.readFileSync(path.join(WURZEL, p), 'utf8');
const INDEX = lies('index.html');
const MIG_GERAETE = lies('supabase/migrations/20260903_oekosystem_v1_geraete.sql');
const MIG_DAILY = lies('supabase/migrations/20260905_device_daily.sql');
const MIG_ALERTS = lies('supabase/migrations/20260905_device_alerts_cron.sql');
const MIG_PUSH = lies('supabase/migrations/20260906_sensor_push.sql');
const INGEST_TS = lies('supabase/functions/device-ingest/index.ts');
const PUSH_TS = lies('supabase/functions/sensor-push/index.ts');
const DELETE_TS = lies('supabase/functions/delete-user/index.ts');
// v33.17: die Liste liegt im Modul (loeschung_regeln.mjs) — die Edge-Function
// importiert sie nur noch. Der Fall las sie bis dahin aus der Edge-Function
// und meldete nach dem Umzug alle fuenf Geraetetabellen als „fehlt", waehrend
// loeschung_check daneben gruen war: die Kopie, auf der v33.17 geprueft wurde,
// hatte naht_check nicht mitgefahren. Wer eine Liste umzieht, sucht ihre Leser.
let LOESCH_MJS = '';
try { LOESCH_MJS = lies('supabase/functions/_shared/loeschung_regeln.mjs'); } catch (_) { LOESCH_MJS = ''; }
const SNAP = JSON.parse(lies('docs/naht-spalten.json'));

// ── Spalten aus `create table if not exists public.X ( … );` ────────────────
function tabellenSpalten(sql, name) {
  const re = new RegExp('create table if not exists public\\.' + name + '\\s*\\(([\\s\\S]*?)\\n\\);', 'i');
  const m = re.exec(sql);
  if (!m) return null;
  const spalten = [];
  m[1].split('\n').forEach((zeile) => {
    const z = zeile.replace(/--.*$/, '').trim();
    if (!z) return;
    const w = /^([a-z_][a-z0-9_]*)\s+[a-z]/i.exec(z);
    if (!w) return;
    const k = w[1].toLowerCase();
    if (['primary', 'constraint', 'check', 'unique', 'foreign', 'references'].indexOf(k) >= 0) return;
    spalten.push(k);
  });
  return spalten;
}
// Spalten, die eine Migration einer LIVE-Tabelle hinzufuegt (add column if not exists …)
const ALLE_MIGRATIONEN = fs.readdirSync(path.join(WURZEL, 'supabase', 'migrations')).filter((f) => /\.sql$/.test(f)).map((f) => lies('supabase/migrations/' + f)).join('\n');
function nachgeruesteteSpalten(sql, tabelle) {
  const out = [];
  const re = new RegExp('alter table (?:if exists )?public\\.' + tabelle + '\\s+add column if not exists ([a-z_]+)', 'gi');
  let m; while ((m = re.exec(sql))) out.push(m[1].toLowerCase());
  return out;
}
const TABELLEN = {
  metric_catalog: { spalten: tabellenSpalten(MIG_GERAETE, 'metric_catalog'), quelle: 'Migration 20260903 (nicht angewandt)' },
  devices: { spalten: tabellenSpalten(MIG_GERAETE, 'devices'), quelle: 'Migration 20260903 (nicht angewandt)' },
  device_readings: { spalten: tabellenSpalten(MIG_GERAETE, 'device_readings'), quelle: 'Migration 20260903 (nicht angewandt)' },
  device_rules: { spalten: tabellenSpalten(MIG_GERAETE, 'device_rules'), quelle: 'Migration 20260903 (nicht angewandt)' },
  device_commands: { spalten: tabellenSpalten(MIG_GERAETE, 'device_commands'), quelle: 'Migration 20260903 (nicht angewandt)', nachgeruestet: nachgeruesteteSpalten(ALLE_MIGRATIONEN, 'device_commands') },
  device_daily: { spalten: tabellenSpalten(MIG_DAILY, 'device_daily'), quelle: 'Migration 20260905 (nicht angewandt)' },
  notifications: { spalten: SNAP.notifications, quelle: 'live ' + SNAP.stand },
  push_send_log: { spalten: SNAP.push_send_log, quelle: 'live ' + SNAP.stand },
  push_subscriptions: { spalten: SNAP.push_subscriptions, quelle: 'live ' + SNAP.stand, nachgeruestet: nachgeruesteteSpalten(ALLE_MIGRATIONEN, 'push_subscriptions') },
};

// Vergleich: benutzte Namen gegen Tabelle — drei Klassen
function pruefe(benutzt, tabelle) {
  const t = TABELLEN[tabelle];
  if (!t || !t.spalten) return { ok: false, warum: 'Tabelle ' + tabelle + ' nirgends definiert' };
  const fehlt = [], vorbereitet = [];
  benutzt.forEach((s) => {
    if (t.spalten.indexOf(s) >= 0) return;
    if (t.nachgeruestet && t.nachgeruestet.indexOf(s) >= 0) { vorbereitet.push(s); return; }
    fehlt.push(s);
  });
  return { ok: fehlt.length === 0, fehlt, vorbereitet, n: benutzt.length };
}
// Schluessel eines Objekt-Literals im Quelltext — ohne die Schluessel verschachtelter { … }
function objektSchluessel(src, start, ende) {
  const a = src.indexOf(start); if (a < 0) return null;
  const b = src.indexOf(ende, a); if (b < 0) return null;
  let s = src.slice(a + start.length, b);
  let vorher; do { vorher = s; s = s.replace(/\{[^{}]*\}/g, ' '); } while (s !== vorher);   // innere Literale weg
  const out = []; const re = /(?:^|[\s,{])([a-z_][a-z0-9_]*)\s*:/g; let m;
  while ((m = re.exec(s))) if (out.indexOf(m[1]) < 0 && ['null', 'true', 'false', 'undefined'].indexOf(m[1]) < 0) out.push(m[1]);   // `x == null ? null : …` ist kein Schluessel
  return out;
}
const selectListe = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
const eindeutig = (a) => a.filter((x, i) => a.indexOf(x) === i);
const z = (o) => JSON.stringify(o);
function bericht(r, was) {
  if (!r.ok) return { ok: false, warum: (r.warum || (was + ' — fehlt: ' + z(r.fehlt))) };
  return { ok: true, info: was + ': ' + r.n + ' Spalten' + (r.vorbereitet && r.vorbereitet.length ? ' (per Migration vorbereitet: ' + r.vorbereitet.join(', ') + ')' : '') };
}

const FAELLE = [
  {
    name: 'Grundlage · alle Tabellen der Kette haben eine Spaltenliste (Migration oder datierte Momentaufnahme)',
    lauf: () => {
      const ohne = Object.keys(TABELLEN).filter((k) => !TABELLEN[k].spalten || !TABELLEN[k].spalten.length);
      if (ohne.length) return { ok: false, warum: 'ohne Spalten: ' + ohne.join(', ') };
      const dev = TABELLEN.devices.spalten;
      if (dev.indexOf('token_hash') < 0 || dev.indexOf('capabilities') < 0) return { ok: false, warum: 'devices ohne token_hash/capabilities — der Parser liest falsch: ' + z(dev) };
      return { ok: true, info: Object.keys(TABELLEN).map((k) => k + ' ' + TABELLEN[k].spalten.length).join(' · ') + ' · Live-Stand ' + SNAP.stand };
    },
  },
  {
    name: 'App → devices · der Koppel-Satz (gsGeraetKoppeln) nennt nur Spalten, die es gibt — und token_hash, nie token',
    lauf: () => {
      const keys = objektSchluessel(INDEX, 'var satz = { id: cloudId', '};');
      if (!keys || keys.length < 5) return { ok: false, warum: 'Koppel-Satz nicht gefunden: ' + z(keys) };
      if (keys.indexOf('token_hash') < 0 || keys.indexOf('token') >= 0) return { ok: false, warum: 'Satz: ' + z(keys) };
      return bericht(pruefe(keys, 'devices'), 'Koppel-Satz');
    },
  },
  {
    name: 'App → device_rules · der Regel-Satz (_gsRegelSatz) nennt nur Spalten der Tabelle',
    lauf: () => {
      const keys = objektSchluessel(INDEX, 'function _gsRegelSatz(r, g, uid) {\n  return {', '};');
      if (!keys || keys.length < 8) return { ok: false, warum: 'Regel-Satz nicht gefunden: ' + z(keys) };
      return bericht(pruefe(keys, 'device_rules'), 'Regel-Satz');
    },
  },
  {
    name: 'App ← devices / device_readings · die select-Listen des Cloud-Abgleichs stehen in den Tabellen',
    lauf: () => {
      const a = /\/rest\/v1\/devices\?select=([a-z_,]+)&id=/.exec(INDEX);
      const b = /\/rest\/v1\/device_readings\?select=([a-z_,]+)&device_id=/.exec(INDEX);
      if (!a || !b) return { ok: false, warum: 'select-Listen nicht gefunden' };
      const r1 = pruefe(selectListe(a[1]), 'devices'), r2 = pruefe(selectListe(b[1]), 'device_readings');
      if (!r1.ok) return bericht(r1, 'devices');
      if (!r2.ok) return bericht(r2, 'device_readings');
      // und was die App aus einer Zeile LIEST (z.value, z.quality …) muss in der select-Liste stehen
      const gelesen = eindeutig((INDEX.match(/\(je\[z\.device_id\][\s\S]{0,200}?\}\)/) || [''])[0].match(/z\.([a-z_]+)/g) || []).map((x) => x.slice(2));
      const nicht = gelesen.filter((g) => selectListe(b[1]).indexOf(g) < 0);
      if (!gelesen.length || nicht.length) return { ok: false, warum: 'gelesen, aber nicht angefordert: ' + z(nicht) + ' (gelesen: ' + z(gelesen) + ')' };
      // v32.64: die Rueckrichtung der Regeln und der PATCH beim Pausieren
      const c = /\/rest\/v1\/device_rules\?select=([a-z_,]+)&device_id=/.exec(INDEX);
      if (!c) return { ok: false, warum: 'device_rules-Select des Abgleichs nicht gefunden' };
      const r3 = pruefe(selectListe(c[1]), 'device_rules'); if (!r3.ok) return bericht(r3, 'device_rules');
      const gelesenR = eindeutig((INDEX.match(/\bsv\.([a-z_]+)/g) || []).map((x) => x.slice(3)));
      const nichtR = gelesenR.filter((g) => selectListe(c[1]).indexOf(g) < 0);
      if (!gelesenR.length || nichtR.length) return { ok: false, warum: 'aus device_rules gelesen, aber nicht angefordert: ' + z(nichtR) };
      const patch = objektSchluessel(INDEX, "body: JSON.stringify({ status: ziel", '})');
      const r4 = pruefe(['status'].concat(patch || []), 'devices'); if (!r4.ok) return bericht(r4, 'Pausieren-PATCH');
      return { ok: true, info: 'devices ' + r1.n + ' · device_readings ' + r2.n + ' · gelesen ' + gelesen.join(',') + ' · device_rules ' + r3.n + ' (gelesen ' + gelesenR.join(',') + ') · PATCH status' };
    },
  },
  {
    name: 'Empfänger → device_readings · die Zeilen aus pruefeBatch (wirklich gerechnet) passen in die Tabelle; devices-Patch und -Select ebenso',
    lauf: async () => {
      const R = await import(path.join(WURZEL, 'supabase', 'functions', '_shared', 'ingest_regeln.mjs'));
      const p = R.pruefeBatch({ schema_version: 1, readings: [{ metric: 'soil_moisture', age_s: 10, value: 31.5, seq: 1 }, { metric: 'soil_moisture', ts: '1970-01-01T00:00:00Z', value: 30 }] },
        { device: { id: 'd', user_id: 'u', status: 'active', capabilities: {} }, katalog: new Map([['soil_moisture', { unit: '%', min_valid: 0, max_valid: 100 }]]), now: Date.UTC(2026, 8, 6) });
      if (!p.ok || p.rows.length !== 2) return { ok: false, warum: 'pruefeBatch: ' + z(p) };
      const keys = eindeutig(p.rows.flatMap((r) => Object.keys(r)));
      const r1 = pruefe(keys, 'device_readings'); if (!r1.ok) return bericht(r1, 'Batch-Zeile');
      const sel = /from\('devices'\)\s*\.select\('([a-z_,]+)'\)/.exec(INGEST_TS);
      if (!sel) return { ok: false, warum: 'devices-Select im Empfaenger nicht gefunden' };
      const patchKeys = eindeutig((INGEST_TS.match(/patch\.([a-z_]+)\s*=/g) || []).map((x) => x.replace(/patch\.|\s*=/g, '')).concat(objektSchluessel(INGEST_TS, 'const patch: Record<string, unknown> = {', '};') || []));
      const r2 = pruefe(selectListe(sel[1]).concat(['token_hash']), 'devices'); if (!r2.ok) return bericht(r2, 'devices-Select');
      const r3 = pruefe(patchKeys, 'devices'); if (!r3.ok) return bericht(r3, 'devices-Patch');
      const kat = /from\('metric_catalog'\)\.select\('([a-z_,]+)'\)/.exec(INGEST_TS);
      const r4 = pruefe(selectListe(kat ? kat[1] : ''), 'metric_catalog'); if (!r4.ok) return bericht(r4, 'metric_catalog-Select');
      const cmdSel = /from\('device_commands'\)\s*\.select\('([a-z_,]+)'\)/.exec(INGEST_TS);
      const cmdUpd = eindeutig((INGEST_TS.match(/from\('device_commands'\)\.update\(\{.*?\}\)\.eq/g) || []).flatMap((s) => objektSchluessel(s, '.update({', '}).eq') || []));
      const r5 = pruefe(selectListe(cmdSel ? cmdSel[1] : '').concat(cmdUpd), 'device_commands'); if (!r5.ok) return bericht(r5, 'device_commands');
      return { ok: true, info: 'Batch-Zeile ' + keys.join(',') + ' · devices Select ' + r2.n + ' / Patch ' + patchKeys.join(',') + ' · metric_catalog ' + r4.n + ' · device_commands ' + r5.n };
    },
  },
  {
    name: 'Token · die App hasht, wie der Empfänger sucht — beide Rechnungen laufen hier, dasselbe Token, derselbe SHA-256 als Hex',
    lauf: async () => {
      const erz = /function _gsTokenErzeugen\(\) \{[\s\S]*?\n\}/.exec(INDEX);
      const hsh = /function _gsSha256Hex\(text\) \{[\s\S]*?\n\}/.exec(INDEX);
      const ing = /async function sha256Hex\(s: string\): Promise<string> \{[\s\S]*?\n\}/.exec(INGEST_TS);
      if (!erz || !hsh || !ing) return { ok: false, warum: 'Funktionen nicht gefunden: ' + z({ erz: !!erz, hsh: !!hsh, ing: !!ing }) };
      const app = new Function('crypto', 'btoa', 'TextEncoder', erz[0] + '\n' + hsh[0] + '\nreturn { _gsTokenErzeugen, _gsSha256Hex };')(globalThis.crypto, (s) => Buffer.from(s, 'binary').toString('base64'), TextEncoder);
      const ingest = new Function('crypto', 'TextEncoder', ing[0].replace(/: string\)/, ')').replace(/\): Promise<string>/, ')') + '\nreturn sha256Hex;')(globalThis.crypto, TextEncoder);
      const token = app._gsTokenErzeugen();
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { ok: false, warum: 'Token-Form: ' + token };
      const a = await app._gsSha256Hex(token), b = await ingest(token), c = nodeCrypto.createHash('sha256').update(token).digest('hex');
      if (a !== b || a !== c) return { ok: false, warum: 'Hashes verschieden: App ' + a.slice(0, 12) + '… Empfänger ' + b.slice(0, 12) + '… Node ' + c.slice(0, 12) + '…' };
      const t2 = app._gsTokenErzeugen();
      if (t2 === token) return { ok: false, warum: 'zwei Tokens gleich' };
      return { ok: true, info: 'Token 43 Zeichen base64url · App = Empfänger = Node (' + a.slice(0, 16) + '…) · zwei Tokens verschieden' };
    },
  },
  {
    name: 'Cron → notifications · fn_device_alerts schreibt nur Live-Spalten; und was er aus devices, device_rules, device_readings liest, gibt es',
    lauf: () => {
      const inserts = MIG_ALERTS.match(/insert into public\.notifications \(([^)]+)\)/g) || [];
      if (inserts.length < 2) return { ok: false, warum: 'Inserts nicht gefunden' };
      const cols = eindeutig(inserts.flatMap((s) => selectListe(/\(([^)]+)\)/.exec(s)[1])));
      const r1 = pruefe(cols, 'notifications'); if (!r1.ok) return bericht(r1, 'notifications-Insert');
      const lost = /fn_devices_mark_lost\(\)[\s\S]*?\$\$;/.exec(MIG_ALERTS)[0];
      const dCols = eindeutig((lost.match(/\bd\.([a-z_]+)/g) || []).map((x) => x.slice(2)).concat(['status', 'updated_at']));
      const r2 = pruefe(dCols, 'devices'); if (!r2.ok) return bericht(r2, 'mark_lost liest devices');
      const alerts = /function public\.fn_device_alerts\(\)[\s\S]*?\n\$\$;/.exec(MIG_ALERTS)[0];
      const rlCols = eindeutig((alerts.match(/\brl\.([a-z_]+)/g) || []).map((x) => x.slice(3)).concat((alerts.match(/\br\.([a-z_]+)/g) || []).map((x) => x.slice(2))).filter((c) => ['geraet_name', 'owner', 'unit', 'label_de'].indexOf(c) < 0));
      const r3 = pruefe(rlCols.concat(['last_fired_at', 'updated_at']), 'device_rules'); if (!r3.ok) return bericht(r3, 'fn_device_alerts liest device_rules');
      const devCols = eindeutig((alerts.match(/\bdev\.([a-z_]+)/g) || []).map((x) => x.slice(4)));
      const r4 = pruefe(devCols, 'devices'); if (!r4.ok) return bericht(r4, 'fn_device_alerts liest devices');
      const rdStmts = alerts.match(/from public\.device_readings[\s\S]*?;/g) || [];
      const rdCols = eindeutig(rdStmts.flatMap((s) => (s.match(/\b(value|ts|quality|device_id|metric|user_id|raw|id)\b/g) || [])));
      const r5 = pruefe(rdCols, 'device_readings'); if (!r5.ok) return bericht(r5, 'fn_device_alerts liest device_readings');
      const kat = eindeutig((alerts.match(/\bc\.([a-z_]+)/g) || []).map((x) => x.slice(2)));
      const r6 = pruefe(kat, 'metric_catalog'); if (!r6.ok) return bericht(r6, 'fn_device_alerts liest metric_catalog');
      const cap = /capabilities->>'expected_by'/.test(MIG_ALERTS) && /cap\.expected_by = /.test(INGEST_TS);
      if (!cap) return { ok: false, warum: 'expected_by: Cron liest es, Empfänger schreibt es — eines fehlt' };
      return { ok: true, info: 'notifications ' + cols.join(',') + ' · devices ' + eindeutig(dCols.concat(devCols)).length + ' · device_rules ' + rlCols.length + ' · device_readings ' + rdCols.join(',') + ' · expected_by beidseitig' };
    },
  },
  {
    name: 'Pusher ↔ notifications / push_send_log / push_subscriptions · liest Live-Spalten, schreibt Live-Spalten, und notify_sensor ist per Migration vorbereitet',
    lauf: async () => {
      const nSel = /from\("notifications"\)\s*\.select\("([a-z_,]+)"\)/.exec(PUSH_TS);
      const lSel = /from\("push_send_log"\)\s*\.select\("([a-z_,]+)"\)/.exec(PUSH_TS);
      if (!nSel || !lSel) return { ok: false, warum: 'Selects im Pusher nicht gefunden' };
      const r1 = pruefe(selectListe(nSel[1]).concat(['kind', 'created_at']), 'notifications'); if (!r1.ok) return bericht(r1, 'Pusher liest notifications');
      const r2 = pruefe(selectListe(lSel[1]).concat(['category', 'sent_at']), 'push_send_log'); if (!r2.ok) return bericht(r2, 'Pusher liest push_send_log');
      const M = await import(path.join(WURZEL, 'supabase', 'functions', '_shared', 'sensor_push_regeln.mjs'));
      const zeile = M.protokollZeile({ id: 'n', user_id: 'u', title: 't', body: 'b', link: '/?screen=garden#geraet-x' }, { id: 'a' }, { result: 'sent', status: 201 });
      const r3 = pruefe(Object.keys(zeile), 'push_send_log'); if (!r3.ok) return bericht(r3, 'Protokollzeile');
      const aboFelder = eindeutig((lies('supabase/functions/_shared/sensor_push_regeln.mjs').match(/\ba\.([a-z_]+)/g) || []).map((x) => x.slice(2)));
      const r4 = pruefe(aboFelder, 'push_subscriptions'); if (!r4.ok) return bericht(r4, 'Pusher liest push_subscriptions');
      if (!r4.vorbereitet || r4.vorbereitet.indexOf('notify_sensor') < 0) return { ok: false, warum: 'notify_sensor müsste als „per Migration vorbereitet" erscheinen: ' + z(r4) };
      const ketten = PUSH_TS.match(/from\("push_subscriptions"\)[^\n]*/g) || [];
      const abo = eindeutig(ketten.flatMap((k) => (k.match(/\.(?:eq|lt|in|gte|neq)\("([a-z_]+)"/g) || []).map((x) => /"([a-z_]+)"/.exec(x)[1])));
      const r5 = pruefe(abo, 'push_subscriptions'); if (!r5.ok) return bericht(r5, 'Pusher filtert push_subscriptions');
      const upd = eindeutig(ketten.filter((k) => /\.update\(\{/.test(k)).flatMap((k) => objektSchluessel(k, '.update({', '})') || []));
      if (!upd.length) return { ok: false, warum: 'kein update-Objekt am Abonnement gefunden' };
      const r6 = pruefe(upd, 'push_subscriptions'); if (!r6.ok) return bericht(r6, 'Pusher schreibt push_subscriptions');
      return { ok: true, info: 'liest notifications ' + r1.n + ', push_send_log ' + r2.n + ' · schreibt push_send_log ' + Object.keys(zeile).join(',') + ' · Abo-Felder ' + aboFelder.join(',') + ' (notify_sensor vorbereitet)' };
    },
  },
  {
    name: 'Brücke · Marker der Protokollzeile = Schlüssel der Sperre; Anker des Crons = Muster der App = Tag des Pushers',
    lauf: async () => {
      const M = await import(path.join(WURZEL, 'supabase', 'functions', '_shared', 'sensor_push_regeln.mjs'));
      if (!new RegExp("payload_meta \\? '" + M.BRIDGE_MARKER + "'").test(MIG_PUSH)) return { ok: false, warum: 'Sperre prüft nicht ' + M.BRIDGE_MARKER };
      const link = (/'\/\?screen=garden#geraet-' \|\| d\.id/.test(MIG_ALERTS) && /'\/\?screen=garden#geraet-' \|\| r\.device_id/.test(MIG_ALERTS));
      if (!link) return { ok: false, warum: 'der Cron schreibt den Anker nicht wie erwartet' };
      const muster = /roh\.match\((\/\^geraet-.*?\/)\);/.exec(INDEX);
      if (!muster) return { ok: false, warum: 'Anker-Muster der App nicht gefunden' };
      const re = new Function('return ' + muster[1])();
      const uuid = '4b1a7c2e-9d3f-4e6a-8b21-0f5c3d7e9a10';
      if (!re.test('geraet-' + uuid)) return { ok: false, warum: 'das Muster der App nimmt keine UUID an: ' + muster[1] };
      const n = M.nutzlast({ link: '/?screen=garden#geraet-' + uuid });
      if (n.tag !== 'gs-sensor-' + uuid) return { ok: false, warum: 'Tag des Pushers: ' + n.tag };
      // Routing: die Art sensor_alert kennt ein Ziel in GS_NOTIF_ZIELE, und der Anker-Leser kennt geraet
      if (!/sensor_alert:\s*\{ fn: 'gsMesswerteOeffnen' \}/.test(INDEX)) return { ok: false, warum: 'GS_NOTIF_ZIELE kennt sensor_alert nicht' };
      if (!/GS_ANKER_ARTEN = \[[^\]]*'geraet'/.test(INDEX)) return { ok: false, warum: 'GS_ANKER_ARTEN kennt geraet nicht' };
      return { ok: true, info: 'Marker ' + M.BRIDGE_MARKER + ' · Anker #geraet-<uuid> passt zum Muster · Tag gs-sensor-<uuid> · sensor_alert → gsMesswerteOeffnen' };
    },
  },
  {
    name: 'Tagesaggregat · fn_device_daily_aggregate schreibt nur Spalten von device_daily und liest aggregation aus metric_catalog',
    lauf: () => {
      const ins = /insert into public\.device_daily \(([^)]+)\)/.exec(MIG_DAILY);
      if (!ins) return { ok: false, warum: 'Insert nicht gefunden' };
      const r1 = pruefe(selectListe(ins[1]), 'device_daily'); if (!r1.ok) return bericht(r1, 'device_daily-Insert');
      const rCols = eindeutig((MIG_DAILY.match(/\br\.([a-z_]+)/g) || []).map((x) => x.slice(2)));
      const r2 = pruefe(rCols, 'device_readings'); if (!r2.ok) return bericht(r2, 'liest device_readings');
      const cCols = eindeutig((MIG_DAILY.match(/\bc\.([a-z_]+)/g) || []).map((x) => x.slice(2)));
      const r3 = pruefe(cCols, 'metric_catalog'); if (!r3.ok) return bericht(r3, 'liest metric_catalog');
      return { ok: true, info: 'schreibt ' + r1.n + ' · liest device_readings ' + rCols.join(',') + ' · metric_catalog ' + cCols.join(',') };
    },
  },
  {
    name: 'Löschen · delete-user kennt jede Gerätetabelle mit user_id — und keine ohne',
    lauf: () => {
      const liste = (LOESCH_MJS.match(/export const USER_TABLES = \[([\s\S]*?)\];/) || DELETE_TS.match(/const USER_TABLES = \[([\s\S]*?)\];/) || [])[1] || '';
      const genannt = (liste.replace(/\/\/.*$/gm, '').match(/['"]([a-z_]+)['"]/g) || []).map((x) => x.slice(1, -1));
      if (!genannt.length) return { ok: false, warum: 'keine USER_TABLES gefunden — weder im Modul noch in der Edge-Function' };
      const mitUser = Object.keys(TABELLEN).filter((t) => /^device|^metric/.test(t) && TABELLEN[t].spalten.indexOf('user_id') >= 0);
      const ohneUser = Object.keys(TABELLEN).filter((t) => /^device|^metric/.test(t) && TABELLEN[t].spalten.indexOf('user_id') < 0);
      const fehlt = mitUser.filter((t) => genannt.indexOf(t) < 0);
      const falsch = ohneUser.filter((t) => genannt.indexOf(t) >= 0);
      if (fehlt.length || falsch.length) return { ok: false, warum: z({ fehlt, faelschlich: falsch }) };
      return { ok: true, info: 'genannt: ' + mitUser.join(', ') + ' · ohne user_id (richtig nicht genannt): ' + ohneUser.join(', ') };
    },
  },
  {
    name: 'Gegenrichtung · eine erfundene Spalte im Koppel-Satz wird gemeldet (der Prüfstand sieht etwas)',
    lauf: () => {
      const r = pruefe(['id', 'user_id', 'token_klartext'], 'devices');
      if (r.ok || !r.fehlt || r.fehlt[0] !== 'token_klartext') return { ok: false, warum: 'eine erfundene Spalte ging durch: ' + z(r) };
      const r2 = pruefe(['notify_sensor'], 'push_subscriptions');
      if (!r2.ok || !r2.vorbereitet || r2.vorbereitet[0] !== 'notify_sensor') return { ok: false, warum: 'die mittlere Klasse fehlt: ' + z(r2) };
      return { ok: true, info: 'token_klartext → gemeldet · notify_sensor → „vorbereitet", nicht rot' };
    },
  },
  // ═══ KALENDER-V2 · Scheibe 7 (v33.41): das Backend ═══════════════════════
  {
    name: 'Katalog · der saisonale Push filtert eine Spalte, die es GIBT — `priority` existiert nicht, `importance` schon',
    lauf: () => {
      // Live gemessen am 16.09.2026 (nur lesend): `garden_tasks_catalog` hat
      // 189 Zeilen, Spalten … importance, data — KEIN `priority`, auch nicht
      // als jsonb-Schluessel (0 von 189). PostgREST antwortet auf
      // `.eq("priority","high")` mit 42703; `data` ist null, und der Fehler
      // wurde wegdestrukturiert. Die saisonale Erinnerung hat seit dem Bau
      // keine einzige Zeile gehabt, und nichts hat es gesagt.
      const DPC = lies('supabase/functions/daily-push-checker/index.ts');
      const block = (DPC.match(/from\("garden_tasks_catalog"\)[\s\S]{0,420}?\.limit\(\d+\)/) || [''])[0];
      if (!block) return { ok: false, warum: 'der Katalog-Aufruf ist nicht auffindbar' };
      const klagen = [];
      if (/priority/.test(block)) klagen.push('filtert weiter auf `priority` — die Spalte gibt es nicht: ' + block.replace(/\s+/g, ' ').slice(0, 150));
      if (!/importance/.test(block)) klagen.push('nennt `importance` nicht — das ist die Spalte, die der Generator schreibt');
      // Und der Fehler wird GESAGT, nicht verschluckt (dieselbe Klasse wie _gsSchreibOk)
      // Das Fenster beginnt an der DESTRUKTURIERUNG — sie steht VOR der Zeile
      // mit dem Tabellennamen. Ein Fenster, das am Tabellennamen anfaengt,
      // sieht das `error:` nie und meldet immer rot (erster Lauf: genau so).
      const umfeld = (DPC.match(/const \{[^}]*\}\s*=\s*await sb[\s\S]{0,900}?garden_tasks_catalog[\s\S]{0,900}?if \(tasks &&/) || [''])[0];
      if (!/error:\s*\w+/.test(umfeld)) klagen.push('der Fehler wird wegdestrukturiert — „keine Aufgabe diesen Monat" sieht dann aus wie „die Abfrage ist kaputt"');
      else if (!/console\.error|system_events|logSend/.test(umfeld)) klagen.push('der Fehler wird gelesen, aber nirgends gesagt');
      // Die Werte muessen die des Generators sein
      const GEN = lies('supabase/functions/knowledge-bulk-gen/index.ts');
      const werte = Array.from(new Set((GEN.match(/kritisch|wichtig|optional/g) || [])));
      if (werte.length && !/kritisch/.test(block)) klagen.push('der Filter nennt keinen Wert des Generators (' + werte.join('|') + ')');
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: 'filtert `importance` in (kritisch, wichtig) · der Fehler wird gesagt · Generator-Werte: ' + werte.join(', ') };
    },
  },
  {
    name: 'Sicht · v_plant_tasks_due liest BEIDE Pflanzenlisten (Migration, nicht angewandt) — user_gardens.plantings kommt vor',
    lauf: () => {
      const MIG = lies('supabase/migrations/20260916_plant_tasks_due_plantings.sql');
      const klagen = [];
      if (!/user_gardens/.test(MIG)) klagen.push('die Migration nennt `user_gardens` nicht');
      if (!/'plantings'/.test(MIG)) klagen.push("die Migration liest `data -> 'plantings'` nicht");
      if (!/union all/i.test(MIG)) klagen.push('die zwei Quellen sind nicht mit UNION ALL vereint — die Rechnung stuende dann zweimal da');
      // Die Rechnung steht GENAU EINMAL
      const n = (MIG.match(/GREATEST\(/g) || []).length;
      if (n !== 1) klagen.push('die Faelligkeits-Rechnung steht ' + n + '-mal — sie muss EINMAL dastehen (hinter dem UNION)');
      for (const sp of ['liste', 'garden_id', 'garden_name']) {
        if (!new RegExp('\\b' + sp + '\\b').test(MIG)) klagen.push('Spalte `' + sp + '` fehlt — ein Push soll sagen koennen, WO die Pflanze steht');
      }
      if (!/security_invoker\s*=\s*true/.test(MIG)) klagen.push('security_invoker fehlt — ohne ihn sieht jeder alles');
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: 'UNION ALL beider Listen · die Rechnung genau einmal · liste/garden_id/garden_name · security_invoker' };
    },
  },
  {
    name: 'App und Sicht zählen dieselben Aufgaben — im lokalen Postgres nachgerechnet, mit Reproduktion und Gegenprobe',
    lauf: () => {
      if (!pgDa()) return { offen: true, warum: 'kein lokales Postgres erreichbar (GS_PG_URL) — die Sicht wurde NICHT nachgerechnet' };
      const U = '33333333-3333-4333-8333-000000000041';
      const HEUTE = "now() - interval '9 days'";   // lastDone: 9 Tage her, Intervall 7 → faellig
      try {
        pgSql(PG_URL, 'drop database if exists ' + PG_DB + ' with (force)');
        pgSql(PG_URL, 'create database ' + PG_DB);
      } catch (e) { return { offen: true, warum: 'Datenbank nicht anlegbar: ' + e.message }; }
      const U2 = PG_URL.replace(/\/[^/]*$/, '/' + PG_DB);
      try {
        // Die zwei Tabellen wie live (ohne auth.users-FK, ohne RLS) + der Zeit-Parser
        pgSql(U2, `
          create table public.user_plants  (user_id uuid primary key, data jsonb not null);
          create table public.user_gardens (user_id uuid primary key, data jsonb not null);
          create or replace function public._gs_parse_ts_flex(t text) returns timestamptz
            language plpgsql immutable as $f$
            begin
              if t is null or t = '' then return null; end if;
              begin return t::timestamptz; exception when others then null; end;
              begin return to_timestamp((t)::numeric / 1000); exception when others then null; end;
              return null;
            end $f$;
          do $$ begin
            if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
          end $$;`);
        // EINE Pflanze in „Meine Pflanzen", ZWEI Garten-Pflanzungen — alle drei faellig
        pgSql(U2, `
          insert into public.user_plants (user_id, data) values ('${U}', jsonb_build_object(
            'plants', jsonb_build_array(jsonb_build_object(
              'id','p1','name','Basilikum','emoji','🌿',
              'tasks', jsonb_build_object('water', jsonb_build_object(
                'active', true, 'intervalDays', 7, 'lastDone', to_char(${HEUTE}, 'YYYY-MM-DD"T"HH24:MI:SSOF')))))));
          insert into public.user_gardens (user_id, data) values ('${U}', jsonb_build_object(
            'gardens', jsonb_build_array(jsonb_build_object('id','g1','name','Balkon Süd')),
            'plantings', jsonb_build_array(
              jsonb_build_object('id','pl1','name','Zucchini','gardenId','g1',
                'tasks', jsonb_build_object('water', jsonb_build_object(
                  'active', true, 'intervalDays', 7, 'lastDone', to_char(${HEUTE}, 'YYYY-MM-DD"T"HH24:MI:SSOF')))),
              jsonb_build_object('id','pl2','name','Tomate','gardenId','g1',
                'tasks', jsonb_build_object('fertilize', jsonb_build_object(
                  'active', true, 'intervalDays', 7, 'lastDone', to_char(${HEUTE}, 'YYYY-MM-DD"T"HH24:MI:SSOF')))))));`);
        // ── REPRODUKTION: die ALTE Sicht (v32.53) sieht nur EINE Liste
        const ALT = lies('supabase/migrations/20260904_plant_tasks_due_vorgezogen.sql');
        pgSql(U2, ALT);
        const alt = Number(pgSql(U2, `select count(*) from public.v_plant_tasks_due where user_id = '${U}' and is_due_now`));
        if (alt !== 1) return { ok: false, warum: 'Reproduktion misslungen: die alte Sicht zaehlt ' + alt + ' statt 1 — der Fall misst nichts' };
        // ── Die neue Sicht
        pgSql(U2, lies('supabase/migrations/20260916_plant_tasks_due_plantings.sql'));
        const neu = Number(pgSql(U2, `select count(*) from public.v_plant_tasks_due where user_id = '${U}' and is_due_now`));
        const klagen = [];
        if (neu !== 3) klagen.push('die neue Sicht zaehlt ' + neu + ' statt 3 (1 aus „Meine Pflanzen" + 2 Garten-Pflanzungen)');
        const zeilen = pgSql(U2, `select liste || '|' || coalesce(garden_name,'-') || '|' || plant_name || '|' || task_key
                                    from public.v_plant_tasks_due where user_id = '${U}' order by plant_name`).split('\n');
        if (zeilen.indexOf('plantings|Balkon Süd|Tomate|fertilize') < 0) klagen.push('die Pflanzung traegt ihren Gartennamen nicht: ' + JSON.stringify(zeilen));
        if (zeilen.indexOf('myPlants|-|Basilikum|water') < 0) klagen.push('„Meine Pflanzen" traegt faelschlich einen Garten: ' + JSON.stringify(zeilen));
        // ── Dieselbe Rechnung: snoozedUntil verschiebt auch eine Pflanzung
        pgSql(U2, `update public.user_gardens set data = jsonb_set(data,
                     '{plantings,0,tasks,water,snoozedUntil}',
                     to_jsonb(to_char(now() + interval '3 days', 'YYYY-MM-DD"T"HH24:MI:SSOF')))
                   where user_id = '${U}'`);
        const nachSnooze = Number(pgSql(U2, `select count(*) from public.v_plant_tasks_due where user_id = '${U}' and is_due_now`));
        if (nachSnooze !== 2) klagen.push('snoozedUntil wirkt an einer Pflanzung nicht: ' + nachSnooze + ' statt 2 — zwei Rechnungen fuer eine Frage');
        // ── Gegenprobe: ohne plantings-Zweig faellt sie auf 1 zurueck
        // Der Schnitt sitzt am SQL-Schluesselwort in seiner Einrueckung, nicht
        // am ersten Vorkommen der Zeichenkette: „UNION ALL" steht auch im
        // KOMMENTAR der Migration, und der erste Anlauf hat deshalb von dort
        // bis zum `expanded` geschnitten — mitsamt `CREATE VIEW`. Dieselbe
        // Klasse wie die Jargon-Suche, die ihre eigenen Notizen findet (v32.70).
        const ohne = lies('supabase/migrations/20260916_plant_tasks_due_plantings.sql')
          .replace(/^ {2}UNION ALL$[\s\S]*?^\), expanded AS \($/m, '), expanded AS (');
        pgSql(U2, ohne);
        const zurueck = Number(pgSql(U2, `select count(*) from public.v_plant_tasks_due where user_id = '${U}' and is_due_now`));
        if (zurueck !== 1) klagen.push('Gegenprobe misslungen: ohne den plantings-Zweig zaehlt sie ' + zurueck + ' statt 1');
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: 'alt 1 → neu 3 (1 myPlants + 2 plantings) · Gartenname dabei · snoozedUntil wirkt auch dort (3 → 2) · Gegenprobe 1' };
      } catch (e) {
        return { ok: false, warum: 'SQL: ' + (e && e.message ? e.message : e) };
      } finally {
        try { pgSql(PG_URL, 'drop database if exists ' + PG_DB + ' with (force)'); } catch (_) {}
      }
    },
  },

  {
    name: 'Migration · jede Sicht-Migration lässt sich WIRKLICH anwenden (CREATE OR REPLACE VIEW darf Spalten nur anhängen)',
    lauf: () => {
      // Gemessen am 16.09.2026: `20260903_plant_tasks_due_snooze.sql` fuegt
      // `snoozed_until` VOR `next_due_at` ein. Gegen die Sicht, wie sie live
      // steht (v26_93, zehn Spalten), antwortet Postgres:
      //   ERROR: cannot change name of view column "next_due_at" to "snoozed_until"
      // Beide Dateien standen seit Tagen als „bereit" in der Liste der offenen
      // Migrationen — und waeren beim Anwenden gescheitert. Eine Migration, die
      // man nicht ANWENDET, hat man nicht geprueft (dieselbe Lehre wie v32.65,
      // eine Ebene hoeher). Nichts haengt an der Sicht (pg_depend live: 0),
      // deshalb DROP + CREATE.
      if (!pgDa()) return { offen: true, warum: 'kein lokales Postgres erreichbar (GS_PG_URL) — die Migrationen wurden NICHT angewandt' };
      const DATEIEN = ['20260903_plant_tasks_due_snooze.sql',
                       '20260904_plant_tasks_due_vorgezogen.sql',
                       '20260916_plant_tasks_due_plantings.sql'];
      const DB = PG_DB + '_mig';
      try { pgSql(PG_URL, 'drop database if exists ' + DB + ' with (force)'); pgSql(PG_URL, 'create database ' + DB); }
      catch (e) { return { offen: true, warum: 'Datenbank nicht anlegbar: ' + e.message }; }
      const U2 = PG_URL.replace(/\/[^/]*$/, '/' + DB);
      try {
        // Der Stand, wie er LIVE ist: die Sicht aus v26_93 (zehn Spalten).
        pgSql(U2, `
          create table public.user_plants  (user_id uuid primary key, data jsonb not null);
          create table public.user_gardens (user_id uuid primary key, data jsonb not null);
          create or replace function public._gs_parse_ts_flex(t text) returns timestamptz
            language sql immutable as $f$ select null::timestamptz $f$;
          do $$ begin
            if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
          end $$;
          create view public.v_plant_tasks_due with (security_invoker = true) as
            select up.user_id, 'x'::text as plant_id, 'x'::text as plant_name, 'x'::text as emoji,
                   'x'::text as task_key, 1 as interval_days, now() as last_done,
                   now() as next_due_at, true as is_due_now, 'x'::text as task_label
            from public.user_plants up;`);
        const klagen = [];
        DATEIEN.forEach((d) => {
          try { pgSql(U2, lies('supabase/migrations/' + d)); }
          catch (e) { klagen.push(d + ': ' + String(e.message).slice(0, 120)); }
        });
        // Und zweimal hintereinander — eine Migration ist idempotent
        try { DATEIEN.forEach((d) => pgSql(U2, lies('supabase/migrations/' + d))); }
        catch (e) { klagen.push('zweiter Durchlauf (Idempotenz): ' + String(e.message).slice(0, 120)); }
        // Die Gegenprobe: mit CREATE OR REPLACE muss es scheitern
        const mitReplace = lies('supabase/migrations/20260903_plant_tasks_due_snooze.sql')
          .replace(/DROP VIEW IF EXISTS public\.v_plant_tasks_due;\s*\n\s*CREATE VIEW/, 'CREATE OR REPLACE VIEW');
        pgSql(U2, 'drop view if exists public.v_plant_tasks_due');
        pgSql(U2, `create view public.v_plant_tasks_due with (security_invoker = true) as
                     select up.user_id, 'x'::text as plant_id, 'x'::text as plant_name, 'x'::text as emoji,
                            'x'::text as task_key, 1 as interval_days, now() as last_done,
                            now() as next_due_at, true as is_due_now, 'x'::text as task_label
                     from public.user_plants up;`);
        let gescheitert = false;
        try { pgSql(U2, mitReplace); } catch (_) { gescheitert = true; }
        if (!gescheitert) klagen.push('Gegenprobe: mit CREATE OR REPLACE ging es durch — dann misst der Fall nichts');
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: DATEIEN.length + ' Migrationen gegen die LIVE-Sicht angewandt, zweimal (idempotent) · Gegenprobe mit CREATE OR REPLACE scheitert wie erwartet' };
      } catch (e) {
        return { ok: false, warum: 'SQL: ' + (e && e.message ? e.message : e) };
      } finally {
        try { pgSql(PG_URL, 'drop database if exists ' + DB + ' with (force)'); } catch (_) {}
      }
    },
  },

];

(async () => {
  console.log('\n=== naht_check — passen App, Empfaenger, Cron und Pusher zusammen?');
  let kaputt = 0, offen = 0;
  for (const f of FAELLE) {
    let r;
    try { r = await f.lauf(); } catch (e) { r = { ok: false, warum: 'Ausnahme: ' + (e && e.message ? e.message.split('\n')[0] : e) }; }
    // v33.41: die dritte Klasse. „Nicht pruefbar" ist nie gruen — ohne
    // Postgres wurde die Sicht NICHT nachgerechnet, und das steht da.
    if (r && r.offen) { offen++; console.log('  --   ' + f.name + '\n         → nicht pruefbar: ' + ((r && r.warum) || 'unbekannt')); }
    else if (r && r.ok) console.log('  ok   ' + f.name + (r.info ? '   [' + r.info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
  }
  console.log('  ---');
  console.log('  Naehte geprueft: ' + FAELLE.length + ' · davon kaputt: ' + kaputt + (offen ? ' · nicht pruefbar: ' + offen + ' (die Sicht braucht ein lokales Postgres, GS_PG_URL)' : ''));
  console.log('  Live-Momentaufnahme: docs/naht-spalten.json vom ' + SNAP.stand + ' (nur notifications, push_send_log, push_subscriptions).');
  console.log('  Grenze: Spalten und Schluessel, nicht Typen und nicht RLS — ob eine Zeile ANGENOMMEN wird, sagt nur der lebende Server.');
  process.exitCode = kaputt ? 1 : (offen ? 2 : 0);
})();
