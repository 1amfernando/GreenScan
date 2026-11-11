#!/usr/bin/env node
// sensor_push_check.js — wird aus einem Sensor-Alarm ein Push, und nur einer?
//
//   node scripts/sensor_push_check.js
//
// Prueft die RECHNENDEN Regeln von `sensor-push`
// (supabase/functions/_shared/sensor_push_regeln.mjs) — ohne Deno, ohne
// Datenbank, ohne Abonnement. Anlass (06.09.2026): der Cron `device-alerts`
// schrieb Inbox-Zeilen, und niemand pushte sie — die Bruecke laeuft nur
// push_send_log → notifications. Jede Regel laeuft gegen einen GUTEN und
// einen SCHLECHTEN Fall (CLAUDE.md §4b). Was hier NICHT geprueft wird: ob
// VAPID sendet, ob der Cron wirklich http_post macht, ob die Bruecke live so
// heisst — das braucht die lebende Funktion und die angewandte Migration.
'use strict';
const path = require('path');
const fs = require('fs');

const NOW = Date.UTC(2026, 8, 6, 10, 0, 0);   // feste Serverzeit: 06.09.2026 10:00 UTC → 12:00 Zuerich
const STUNDE = 12;
const iso = (ms) => new Date(ms).toISOString();
const GER = '4b1a7c2e-9d3f-4e6a-8b21-0f5c3d7e9a10';
const meldung = (extra) => Object.assign({
  id: 'n-1', user_id: 'u-1', kind: 'sensor_alert',
  title: '📶 Balkon Süd: Bodenfeuchte unter 25 %', body: 'Zuletzt 22 % um 09:45 — Schwelle 25.',
  link: '/?screen=garden#geraet-' + GER, created_at: iso(NOW - 10 * 60000),
}, extra || {});
const abo = (extra) => Object.assign({
  id: 'a-1', user_id: 'u-1', endpoint: 'https://push.example/e1', p256dh: 'k', auth_secret: 's',
  notify_sensor: true, quiet_start_hour: 22, quiet_end_hour: 7, pause_until: null, push_failure_count: 0,
}, extra || {});
const plan = (R, p) => R.planen(Object.assign({ meldungen: [meldung()], protokoll: [], abos: [abo()], now: NOW, stunde: STUNDE }, p || {}));
const z = (o) => JSON.stringify(o);

const FAELLE = [
  {
    name: 'Guter Fall · eine frische Meldung, ein Abonnement → genau ein Push, mit Anker, Tag je Geraet, Marker im Protokoll',
    lauf: (R) => {
      const p = plan(R);
      if (p.senden.length !== 1 || p.stumm.length || p.uebersprungen.length) return { ok: false, warum: z({ s: p.senden.length, st: p.stumm.length, u: p.uebersprungen }) };
      const n = R.nutzlast(p.senden[0].meldung);
      if (!/#geraet-/.test(n.url) || n.tag !== 'gs-sensor-' + GER) return { ok: false, warum: 'Nutzlast: ' + z(n) };
      const pz = R.protokollZeile(p.senden[0].meldung, p.senden[0].abo, { result: 'sent', status: 201 });
      if (pz.category !== 'sensor_alert' || pz.payload_meta[R.BRIDGE_MARKER] !== 'n-1' || pz.payload_meta.subscription_id !== 'a-1' || pz.result !== 'sent' || pz.http_status !== 201)
        return { ok: false, warum: 'Protokoll: ' + z(pz) };
      return { ok: true, info: '1 Push · url ' + n.url.slice(0, 32) + '… · tag ' + n.tag.slice(0, 18) + '… · Marker ' + R.BRIDGE_MARKER + '=n-1' };
    },
  },
  {
    name: 'Hoechstens einmal · schon protokolliert (auch als Fehlschlag) → kein zweiter Versuch; ein zweites Abonnement desselben Nutzers bekommt seinen',
    lauf: (R) => {
      const a = plan(R, { protokoll: [{ user_id: 'u-1', payload_meta: { notification_id: 'n-1', subscription_id: 'a-1' }, result: 'sent' }] });
      if (a.senden.length !== 0 || !a.uebersprungen.some(u => u.grund === 'schon protokolliert')) return { ok: false, warum: 'gesendet: ' + z(a) };
      const b = plan(R, { protokoll: [{ user_id: 'u-1', payload_meta: { notification_id: 'n-1', subscription_id: 'a-1' }, result: 'failed' }] });
      if (b.senden.length !== 0) return { ok: false, warum: 'Fehlschlag wird wiederholt: ' + z(b.senden.length) };
      const c = plan(R, { abos: [abo(), abo({ id: 'a-2', endpoint: 'https://push.example/e2' })],
        protokoll: [{ user_id: 'u-1', payload_meta: { notification_id: 'n-1', subscription_id: 'a-1' }, result: 'sent' }] });
      if (c.senden.length !== 1 || c.senden[0].abo.id !== 'a-2') return { ok: false, warum: 'zweites Abo: ' + z(c.senden.map(s => s.abo.id)) };
      const d = plan(R, { abos: [abo(), abo({ id: 'a-2', endpoint: 'https://push.example/e2' })],
        protokoll: [{ user_id: 'u-1', payload_meta: { notification_id: 'n-1' }, result: 'sent' }] });
      if (d.senden.length !== 0) return { ok: false, warum: 'alte Zeile ohne subscription_id gilt fuer alle: ' + d.senden.length };
      return { ok: true, info: 'sent → 0 · failed → 0 · zweites Abo → 1 (a-2) · Zeile ohne Abo-Id → 0' };
    },
  },
  {
    name: 'Stille-Zeit · nachts stumm (Vorgabe 22–7), eigenes Fenster gilt, stumm wird protokolliert und nicht gespiegelt',
    lauf: (R) => {
      const a = plan(R, { stunde: 23 });
      if (a.senden.length || a.stumm.length !== 1 || a.stumm[0].grund !== 'stille') return { ok: false, warum: '23 Uhr: ' + z({ s: a.senden.length, st: a.stumm }) };
      const b = plan(R, { stunde: 12, abos: [abo({ quiet_start_hour: 9, quiet_end_hour: 17 })] });
      if (b.senden.length || b.stumm.length !== 1) return { ok: false, warum: 'eigenes Fenster 9–17 um 12: ' + z({ s: b.senden.length, st: b.stumm.length }) };
      const c = plan(R, { stunde: 18, abos: [abo({ quiet_start_hour: 9, quiet_end_hour: 17 })] });
      if (c.senden.length !== 1) return { ok: false, warum: 'eigenes Fenster 9–17 um 18: ' + z(c) };
      const d = plan(R, { stunde: 3, abos: [abo({ quiet_start_hour: null, quiet_end_hour: null })] });
      if (d.senden.length || d.stumm.length !== 1) return { ok: false, warum: 'ohne Angabe gilt die Vorgabe: ' + z({ s: d.senden.length }) };
      const sz = R.stummZeile(a.stumm[0].meldung, a.stumm[0].abo, 'stille');
      if (sz.result !== 'suppressed_quiet' || sz.payload_meta[R.BRIDGE_MARKER] !== 'n-1') return { ok: false, warum: 'stumm-Zeile: ' + z(sz) };
      return { ok: true, info: '23 Uhr stumm · 9–17 um 12 stumm, um 18 gesendet · ohne Angabe Vorgabe · suppressed_quiet mit Marker' };
    },
  },
  {
    name: 'Pause · pause_until in der Zukunft → stumm (protokolliert als suppressed_paused); abgelaufene Pause → gesendet',
    lauf: (R) => {
      const a = plan(R, { abos: [abo({ pause_until: iso(NOW + 3600000) })] });
      if (a.senden.length || a.stumm.length !== 1 || a.stumm[0].grund !== 'pause') return { ok: false, warum: 'Pause: ' + z({ s: a.senden.length, st: a.stumm }) };
      const sz = R.stummZeile(a.stumm[0].meldung, a.stumm[0].abo, 'pause');
      if (sz.result !== 'suppressed_paused') return { ok: false, warum: 'Pause-Zeile: ' + sz.result };
      const b = plan(R, { abos: [abo({ pause_until: iso(NOW - 3600000) })] });
      if (b.senden.length !== 1) return { ok: false, warum: 'abgelaufene Pause: ' + z(b) };
      return { ok: true, info: 'Pause +1 h → stumm (suppressed_paused) · Pause −1 h → gesendet' };
    },
  },
  {
    name: 'Schalter · notify_sensor false → uebersprungen; ohne Spalte (undefined) gilt die Vorgabe „an"; 5 Fehlschlaege → uebersprungen',
    lauf: (R) => {
      const a = plan(R, { abos: [abo({ notify_sensor: false })] });
      if (a.senden.length || !a.uebersprungen.some(u => u.grund === 'abgeschaltet')) return { ok: false, warum: 'aus: ' + z(a) };
      const b = plan(R, { abos: [abo({ notify_sensor: undefined })] });
      if (b.senden.length !== 1) return { ok: false, warum: 'ohne Spalte: ' + z(b) };
      const c = plan(R, { abos: [abo({ push_failure_count: 5 })] });
      if (c.senden.length || !c.uebersprungen.some(u => u.grund === 'zu viele Fehlschlaege')) return { ok: false, warum: '5 Fehlschlaege: ' + z(c) };
      return { ok: true, info: 'false → aus · undefined → an · 5 Fehlschlaege → aus' };
    },
  },
  {
    name: 'Fenster · aelter als 24 h ist Geschichte, andere Art geht nicht hier durch, ohne Abonnement wird es gesagt',
    lauf: (R) => {
      const a = plan(R, { meldungen: [meldung({ created_at: iso(NOW - 25 * 3600000) })] });
      if (a.senden.length || !a.uebersprungen.some(u => u.grund === 'zu alt')) return { ok: false, warum: '25 h: ' + z(a) };
      const a2 = plan(R, { meldungen: [meldung({ created_at: iso(NOW - 23 * 3600000) })] });
      if (a2.senden.length !== 1) return { ok: false, warum: '23 h muss gehen: ' + z(a2) };
      const b = plan(R, { meldungen: [meldung({ kind: 'plant_task' })] });
      if (b.senden.length || !b.uebersprungen.some(u => /andere Art/.test(u.grund))) return { ok: false, warum: 'plant_task: ' + z(b) };
      const c = plan(R, { abos: [] });
      if (c.senden.length || !c.uebersprungen.some(u => u.grund === 'kein Abonnement')) return { ok: false, warum: 'ohne Abo: ' + z(c) };
      return { ok: true, info: '25 h → zu alt · 23 h → gesendet · plant_task → andere Art · ohne Abo → genannt' };
    },
  },
  {
    name: 'Mengen · zwei Meldungen, zwei Abonnements → vier Pushes; derselbe Endpunkt zweimal zaehlt einmal; fremder Nutzer bekommt nichts',
    lauf: (R) => {
      const m2 = meldung({ id: 'n-2', link: '/?screen=garden#geraet-other' });
      const a = plan(R, { meldungen: [meldung(), m2], abos: [abo(), abo({ id: 'a-2', endpoint: 'https://push.example/e2' })] });
      if (a.senden.length !== 4) return { ok: false, warum: '2×2: ' + a.senden.length };
      const paare = new Set(a.senden.map(s => s.meldung.id + '|' + s.abo.id));
      if (paare.size !== 4) return { ok: false, warum: 'Paare doppelt: ' + z([...paare]) };
      const b = plan(R, { abos: [abo(), abo({ id: 'a-dup' })] });
      if (b.senden.length !== 1) return { ok: false, warum: 'gleicher Endpunkt: ' + b.senden.length };
      const c = plan(R, { abos: [abo({ id: 'a-x', user_id: 'u-2', endpoint: 'https://push.example/e9' })] });
      if (c.senden.length || !c.uebersprungen.some(u => u.grund === 'kein Abonnement')) return { ok: false, warum: 'fremder Nutzer: ' + z(c) };
      return { ok: true, info: '2 Meldungen × 2 Abos = 4 · doppelter Endpunkt = 1 · fremder Nutzer = 0' };
    },
  },
  {
    name: 'Eine Inbox-Zeile bleibt eine · der Marker der Protokollzeile ist derselbe Schluessel, den die Bruecke in der Migration prueft',
    lauf: (R) => {
      const sql = fs.readFileSync(path.resolve(__dirname, '..', 'supabase', 'migrations', '20260906_sensor_push.sql'), 'utf8');
      const guard = new RegExp("payload_meta \\? '" + R.BRIDGE_MARKER + "'");
      if (!guard.test(sql)) return { ok: false, warum: 'die Bruecke prueft nicht ' + R.BRIDGE_MARKER };
      if (!/RETURN NEW; END IF;\s*\n\s*INSERT INTO public\.notifications/.test(sql)) return { ok: false, warum: 'die Sperre steht nicht VOR dem Insert' };
      if (!/functions\/v1\/sensor-push/.test(sql) || !/\(r->>'lost'\)::int, 0\) \+ COALESCE\(\(r->>'rules'\)::int, 0\) > 0/.test(sql)) return { ok: false, warum: 'der Cron ruft sensor-push nicht nur bei etwas Neuem' };
      const pz = R.protokollZeile(meldung(), abo(), { result: 'sent' });
      if (!(R.BRIDGE_MARKER in pz.payload_meta)) return { ok: false, warum: 'Protokollzeile ohne Marker: ' + z(pz.payload_meta) };
      const ts = fs.readFileSync(path.resolve(__dirname, '..', 'supabase', 'functions', 'sensor-push', 'index.ts'), 'utf8');
      if (!/protokollZeile\(/.test(ts) || !/stummZeile\(/.test(ts) || !/planen\(/.test(ts)) return { ok: false, warum: 'die Edge-Function benutzt das Modul nicht' };
      return { ok: true, info: 'Bruecke prueft ' + R.BRIDGE_MARKER + ' vor dem Insert · Cron ruft sensor-push nur bei lost+rules > 0 · Edge-Function nutzt planen/protokollZeile/stummZeile' };
    },
  },
  {
    name: 'Nutzlast · ohne Link das Dashboard, Titel und Text durchgereicht und gedeckelt, Tag ohne Geraet allgemein',
    lauf: (R) => {
      const n = R.nutzlast(meldung({ link: null, title: 'T'.repeat(200), body: 'B'.repeat(400) }));
      if (n.url !== R.ZIEL_VORGABE || n.tag !== 'gs-sensor' || n.title.length !== 120 || n.body.length !== 240) return { ok: false, warum: z({ url: n.url, tag: n.tag, t: n.title.length, b: n.body.length }) };
      const m = R.nutzlast(meldung());
      if (m.title !== '📶 Balkon Süd: Bodenfeuchte unter 25 %' || m.body !== 'Zuletzt 22 % um 09:45 — Schwelle 25.') return { ok: false, warum: 'Text veraendert: ' + z(m) };
      return { ok: true, info: 'ohne Link → ' + R.ZIEL_VORGABE + ' · Titel 120, Text 240 · Tag gs-sensor' };
    },
  },
];

(async () => {
  const R = await import(path.resolve(__dirname, '..', 'supabase', 'functions', '_shared', 'sensor_push_regeln.mjs'));
  console.log('\n=== sensor_push_check — wird aus einem Sensor-Alarm ein Push, und nur einer?');
  let kaputt = 0;
  for (const f of FAELLE) {
    let r;
    try { r = f.lauf(R); } catch (e) { r = { ok: false, warum: 'Ausnahme: ' + e.message.split('\n')[0] }; }
    if (r && r.ok) console.log('  ok   ' + f.name + (r.info ? '   [' + r.info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
  }
  console.log('  ---');
  console.log('  Fälle geprueft: ' + FAELLE.length + ' · davon kaputt: ' + kaputt);
  console.log('  Grenze: ohne Deno, ohne Datenbank, ohne Abonnement — geprueft ist die RECHNUNG des');
  console.log('  Pushers (supabase/functions/_shared/sensor_push_regeln.mjs), nicht VAPID, nicht der Cron.');
  process.exitCode = kaputt ? 1 : 0;
})();
