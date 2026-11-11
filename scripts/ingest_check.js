#!/usr/bin/env node
// ingest_check.js — rechnet der Empfaenger, was der Vertrag verspricht?
//
//   node scripts/ingest_check.js
//
// Prueft die RECHNENDEN Regeln von `device-ingest`
// (supabase/functions/_shared/ingest_regeln.mjs) — ohne Deno, ohne Datenbank,
// ohne Geraet. Der Vertrag steht in docs/GERAETE-VERTRAG.md. Jede Regel
// laeuft gegen einen GUTEN Batch (darf nichts melden) und einen SCHLECHTEN
// (muss melden) — CLAUDE.md §4b. Was hier NICHT geprueft wird, ehrlich
// benannt: ob Supabase das Token findet, ob der Insert wirklich
// `on conflict do nothing` macht, ob die Antwort das Geraet erreicht. Das
// braucht die lebende Funktion.
'use strict';
const path = require('path');

const NOW = Date.UTC(2026, 8, 5, 12, 0, 0);   // feste Serverzeit: 05.09.2026 12:00 UTC
const KATALOG = new Map([
  ['soil_moisture', { unit: '%', min_valid: 0, max_valid: 100 }],
  ['soil_temp', { unit: '°C', min_valid: -20, max_valid: 60 }],
  ['battery', { unit: '%', min_valid: 0, max_valid: 100 }],
]);
const GERAET = { id: 'dev-1', user_id: 'user-1', status: 'active', capabilities: { metrics: ['soil_moisture'], interval_s: 1800, commands: ['valve'] }, last_seen_at: null };
const ctx = (extra) => Object.assign({ device: GERAET, katalog: KATALOG, now: NOW }, extra || {});
const iso = (ms) => new Date(ms).toISOString();

const FAELLE = [
  {
    name: 'Guter Batch · drei Werte, richtige Uhr → alle angenommen, quality 2, Uhr „ok", nichts abgelehnt',
    lauf: (R) => {
      const b = { schema_version: 1, readings: [
        { metric: 'soil_moisture', ts: iso(NOW - 60000), value: 31.5 },
        { metric: 'soil_temp', ts: iso(NOW - 60000), value: 18.2 },
        { metric: 'battery', ts: iso(NOW - 60000), value: 87 } ] };
      const p = R.pruefeBatch(b, ctx());
      if (!p.ok) return { ok: false, warum: JSON.stringify(p) };
      if (p.rows.length !== 3 || p.rejected.length || p.duplikate_im_batch || p.uhr !== 'ok') return { ok: false, warum: JSON.stringify({ rows: p.rows.length, rejected: p.rejected, dupl: p.duplikate_im_batch, uhr: p.uhr }) };
      if (p.rows.some(r => r.quality !== 2 || r.raw !== null || r.device_id !== 'dev-1' || r.user_id !== 'user-1')) return { ok: false, warum: 'Zeilen: ' + JSON.stringify(p.rows) };
      return { ok: true, info: '3 Zeilen, quality 2, raw leer, Uhr ok' };
    },
  },
  {
    name: 'Vertrag · unbekannte schema_version → 400 mit der Nummer und der Liste der bekannten',
    lauf: (R) => {
      const p = R.pruefeBatch({ schema_version: 7, readings: [] }, ctx());
      if (p.ok || p.status !== 400 || p.error !== 'schema_version' || !p.detail || p.detail.geschickt !== 7 || !Array.isArray(p.detail.bekannt)) return { ok: false, warum: JSON.stringify(p) };
      const p2 = R.pruefeBatch({ readings: [] }, ctx());
      if (p2.ok || p2.error !== 'schema_version') return { ok: false, warum: 'ohne Version durchgewinkt: ' + JSON.stringify(p2) };
      return { ok: true, info: '7 → 400, bekannt ' + JSON.stringify(p.detail.bekannt) + ' · ohne Version → 400' };
    },
  },
  {
    name: 'Geraet · pausiert → 409, kein Token → 401, mehr als 500 Werte → 413 mit Grenze',
    lauf: (R) => {
      const a = R.pruefeBatch({ schema_version: 1, readings: [] }, ctx({ device: Object.assign({}, GERAET, { status: 'paused' }) }));
      if (a.ok || a.status !== 409) return { ok: false, warum: 'pausiert: ' + JSON.stringify(a) };
      const b = R.pruefeBatch({ schema_version: 1, readings: [] }, ctx({ device: null }));
      if (b.ok || b.status !== 401) return { ok: false, warum: 'ohne Geraet: ' + JSON.stringify(b) };
      const viele = Array.from({ length: 501 }, (_, i) => ({ metric: 'soil_moisture', age_s: i, value: 30 }));
      const c = R.pruefeBatch({ schema_version: 1, readings: viele }, ctx());
      if (c.ok || c.status !== 413 || !c.detail || c.detail.max !== 500) return { ok: false, warum: '501 Werte: ' + JSON.stringify(c) };
      const d = R.pruefeBatch({ schema_version: 1, readings: viele.slice(0, 500) }, ctx());
      if (!d.ok || d.rows.length !== 500) return { ok: false, warum: '500 Werte muessen gehen: ' + JSON.stringify(d.ok ? d.rows.length : d) };
      return { ok: true, info: 'pausiert 409 · ohne Token 401 · 501 → 413 (max 500) · 500 gehen' };
    },
  },
  {
    name: 'Kein Messwert wird verworfen · ausserhalb des Bereichs ist quality 1, Geraetefehler quality 0 — und beide werden angenommen',
    lauf: (R) => {
      const p = R.pruefeBatch({ schema_version: 1, readings: [
        { metric: 'soil_moisture', ts: iso(NOW - 1000), value: 250 },
        { metric: 'soil_temp', ts: iso(NOW - 1000), value: -35 },
        { metric: 'battery', ts: iso(NOW - 1000), value: 50, error: true } ] }, ctx());
      if (!p.ok || p.rows.length !== 3) return { ok: false, warum: JSON.stringify(p) };
      const q = p.rows.map(r => r.quality);
      if (JSON.stringify(q) !== '[1,1,0]') return { ok: false, warum: 'quality ' + JSON.stringify(q) + ' (erwartet [1,1,0])' };
      return { ok: true, info: '250 % → 1 · −35 °C → 1 · error:true → 0 · alle drei angenommen' };
    },
  },
  {
    name: 'Abgelehnt wird nur, was kein Messwert ist · unbekannte Groesse und Nicht-Zahl mit Grund, der Rest bleibt',
    lauf: (R) => {
      const p = R.pruefeBatch({ schema_version: 1, readings: [
        { metric: 'co2', ts: iso(NOW - 1000), value: 600 },
        { metric: 'soil_moisture', ts: iso(NOW - 1000), value: 'nass' },
        { metric: 'soil_moisture', ts: iso(NOW - 2000), value: 33 },
        null ] }, ctx());
      if (!p.ok || p.rows.length !== 1 || p.rejected.length !== 3) return { ok: false, warum: JSON.stringify({ rows: p.rows && p.rows.length, rejected: p.rejected }) };
      if (!/unbekannte Messgroesse/.test(p.rejected[0].grund) || p.rejected[0].metric !== 'co2') return { ok: false, warum: 'Grund unbekannte Groesse: ' + JSON.stringify(p.rejected[0]) };
      if (!/kein Zahlenwert/.test(p.rejected[1].grund) || p.rejected[1].index !== 1) return { ok: false, warum: 'Grund Nicht-Zahl: ' + JSON.stringify(p.rejected[1]) };
      return { ok: true, info: 'co2 abgelehnt (Katalog), „nass" abgelehnt (Zahl), null abgelehnt · 33 % bleibt' };
    },
  },
  {
    name: 'Die Uhr · ts=1970 wird NICHT verworfen: Serverzeit minus age_s, Original in raw.device_ts, clock untrusted; ohne age_s → received_at',
    lauf: (R) => {
      const p = R.pruefeBatch({ schema_version: 1, readings: [
        { metric: 'soil_moisture', ts: '1970-01-01T00:05:00Z', age_s: 600, value: 30, seq: 41 },
        { metric: 'soil_moisture', ts: '1970-01-01T00:10:00Z', value: 31 },
        { metric: 'soil_temp', age_s: 0, value: 18 } ] }, ctx());
      if (!p.ok || p.rows.length !== 3) return { ok: false, warum: JSON.stringify(p) };
      const [a, b, c] = p.rows;
      if (a.ts !== iso(NOW - 600000) || !a.raw || a.raw.seq !== 41) return { ok: false, warum: 'mit age_s: ' + JSON.stringify(a) + ' (erwartet ts = jetzt − 600 s, raw.seq 41)' };
      if (b.ts !== iso(NOW) || !b.raw || b.raw.clock !== 'untrusted' || b.raw.device_ts !== '1970-01-01T00:10:00Z' || b.raw.ts_aus !== 'received_at') return { ok: false, warum: 'ohne age_s: ' + JSON.stringify(b) };
      if (c.ts !== iso(NOW) || c.raw !== null) return { ok: false, warum: 'age_s 0 ohne ts: ' + JSON.stringify(c) };
      if (p.uhr !== 'untrusted') return { ok: false, warum: 'die Antwort sagt nicht, dass die Uhr falsch ging: ' + p.uhr };
      return { ok: true, info: 'age_s → jetzt − 600 s · 1970 ohne age_s → received_at, raw.device_ts + clock untrusted · age_s 0 → jetzt · Antwort: untrusted' };
    },
  },
  {
    name: 'Die Uhr · mehr als 5 Minuten in der Zukunft ist eine falsche Uhr (untrusted, gezaehlt), 4 Minuten voraus gehen durch',
    lauf: (R) => {
      const p = R.pruefeBatch({ schema_version: 1, readings: [
        { metric: 'soil_moisture', ts: iso(NOW + 4 * 60000), value: 30 },
        { metric: 'soil_moisture', ts: iso(NOW + 3600000), value: 31 } ] }, ctx());
      if (!p.ok || p.rows.length !== 2) return { ok: false, warum: JSON.stringify(p) };
      if (p.rows[0].ts !== iso(NOW + 4 * 60000) || p.rows[0].raw !== null) return { ok: false, warum: '4 Minuten voraus wurde angetastet: ' + JSON.stringify(p.rows[0]) };
      if (p.rows[1].ts !== iso(NOW) || !p.rows[1].raw || p.rows[1].raw.clock !== 'untrusted' || p.zukunft !== 1) return { ok: false, warum: 'eine Stunde voraus: ' + JSON.stringify({ row: p.rows[1], zukunft: p.zukunft }) };
      return { ok: true, info: '+4 min bleibt · +60 min → received_at, untrusted, zukunft 1' };
    },
  },
  {
    name: 'Dubletten im Batch · derselbe Wert zweimal → eine Zeile, die zweite gezaehlt; Antwort nennt accepted und duplicates GETRENNT',
    lauf: (R) => {
      const b = { schema_version: 1, readings: [
        { metric: 'soil_moisture', ts: iso(NOW - 1000), value: 30 },
        { metric: 'soil_moisture', ts: iso(NOW - 1000), value: 30 },
        { metric: 'soil_moisture', ts: iso(NOW - 2000), value: 29 } ] };
      const p = R.pruefeBatch(b, ctx());
      if (!p.ok || p.rows.length !== 2 || p.duplikate_im_batch !== 1) return { ok: false, warum: JSON.stringify({ rows: p.rows.length, dupl: p.duplikate_im_batch }) };
      // Der Server fuegte nur 1 ein (die andere war schon in der Datenbank): accepted 1, duplicates 1 (Batch) + 1 (Datenbank) = 2
      const a = R.antwort(p, 1, ctx());
      if (a.accepted !== 1 || a.duplicates !== 2 || a.schema_version !== 1) return { ok: false, warum: 'Antwort: ' + JSON.stringify(a) };
      if (!a.server_time || a.server_time !== iso(NOW)) return { ok: false, warum: 'server_time fehlt oder falsch: ' + a.server_time };
      if (a.next_contact_s !== 1800) return { ok: false, warum: 'next_contact_s ' + a.next_contact_s + ' (erwartet interval_s 1800)' };
      if (a.firmware !== null) return { ok: false, warum: 'firmware muss null sein, solange es keinen Kanal gibt' };
      return { ok: true, info: '2 Zeilen aus 3 · Antwort accepted 1, duplicates 2, server_time, next_contact_s 1800, firmware null' };
    },
  },
  {
    name: 'Rate-Limit je Aufruf · schneller als interval_s/2 → abgelehnt mit retry_after; ohne interval_s oder ohne letzten Kontakt → frei',
    lauf: (R) => {
      const zuFrueh = R.rateLimit(Object.assign({}, GERAET, { last_seen_at: iso(NOW - 600000) }), NOW);   // 10 min seit dem letzten, Mindestabstand 15 min
      if (zuFrueh.ok || zuFrueh.retry_after_s !== 300) return { ok: false, warum: 'zu frueh: ' + JSON.stringify(zuFrueh) + ' (erwartet retry_after 300)' };
      const ok = R.rateLimit(Object.assign({}, GERAET, { last_seen_at: iso(NOW - 900000) }), NOW);
      if (!ok.ok) return { ok: false, warum: 'genau 15 min muss gehen: ' + JSON.stringify(ok) };
      const frei = R.rateLimit(Object.assign({}, GERAET, { capabilities: { interval_s: null }, last_seen_at: iso(NOW - 1000) }), NOW);
      const erster = R.rateLimit(GERAET, NOW);
      if (!frei.ok || !erster.ok) return { ok: false, warum: 'ohne interval_s / erster Kontakt: ' + JSON.stringify([frei, erster]) };
      return { ok: true, info: '10 min → nein, retry 300 s · 15 min → ja · ohne interval_s → ja · erster Kontakt → ja' };
    },
  },
  {
    name: 'Befehle · abgelaufene werden failed und NICHT gesendet; offene reisen mit id, Ablauf und Versuch; nach 3 Kontakten ohne Ack → failed',
    lauf: (R) => {
      const cmds = [
        { id: 'c1', command: 'valve', params: { on: true, max_on_s: 120 }, status: 'pending', attempts: 0, expires_at: iso(NOW + 3600000) },
        { id: 'c2', command: 'valve', params: { on: true }, status: 'pending', attempts: 0, expires_at: iso(NOW - 1000) },
        { id: 'c3', command: 'ping', params: {}, status: 'sent', attempts: 3, expires_at: null },
        { id: 'c4', command: 'ping', params: {}, status: 'acked', attempts: 1, expires_at: null } ];
      const r = R.befehleAufbereiten(cmds, NOW);
      if (r.senden.length !== 1 || r.senden[0].id !== 'c1' || r.senden[0].attempt !== 1 || !r.senden[0].expires_at) return { ok: false, warum: 'senden: ' + JSON.stringify(r.senden) };
      if (r.failed.length !== 2 || !r.failed.find(f => f.id === 'c2' && /abgelaufen/.test(f.grund)) || !r.failed.find(f => f.id === 'c3' && /3 Kontakten/.test(f.grund))) return { ok: false, warum: 'failed: ' + JSON.stringify(r.failed) };
      const acks = R.acksAuswerten([{ id: 'c1', ok: true }, { id: 'c9', ok: true }, { id: 'c1', ok: false, message: 'Ventil klemmt' }], cmds);
      if (acks.acked.length !== 1 || acks.failed.length !== 1 || acks.unbekannt.length !== 1 || acks.unbekannt[0] !== 'c9') return { ok: false, warum: 'acks: ' + JSON.stringify(acks) };
      return { ok: true, info: 'c1 gesendet (Versuch 1, mit Ablauf) · c2 abgelaufen → failed · c3 nach 3 Kontakten → failed · c4 (acked) unberuehrt · Ack: 1 ok, 1 failed, c9 unbekannt' };
    },
  },
  {
    name: 'Verstummt · erwartet_bis = received_at + 3 × next_contact_s, Vorgabe 3600 s ohne interval_s',
    lauf: (R) => {
      if (R.naechsterKontaktS({ capabilities: {} }) !== 3600) return { ok: false, warum: 'Vorgabe ' + R.naechsterKontaktS({ capabilities: {} }) };
      if (R.naechsterKontaktS(GERAET) !== 1800) return { ok: false, warum: 'interval_s 1800 → ' + R.naechsterKontaktS(GERAET) };
      const bis = R.erwartetBis(NOW, 1800);
      if (bis !== iso(NOW + 3 * 1800 * 1000)) return { ok: false, warum: 'erwartet_bis ' + bis };
      return { ok: true, info: 'ohne interval_s 3600 · mit 1800 → erwartet bis +90 min' };
    },
  },
];

(async () => {
  const R = await import(path.resolve(__dirname, '..', 'supabase', 'functions', '_shared', 'ingest_regeln.mjs'));
  console.log('\n=== ingest_check — rechnet der Empfaenger, was der Vertrag verspricht?');
  let kaputt = 0;
  for (const f of FAELLE) {
    let r;
    try { r = f.lauf(R); } catch (e) { r = { ok: false, warum: 'Ausnahme: ' + e.message.split('\n')[0] }; }
    if (r && r.ok) console.log('  ok   ' + f.name + (r.info ? '   [' + r.info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
  }
  console.log('  ---');
  console.log('  Fälle geprueft: ' + FAELLE.length + ' · davon kaputt: ' + kaputt);
  console.log('  Grenze: ohne Deno, ohne Datenbank, ohne Geraet — geprueft ist die RECHNUNG des');
  console.log('  Empfaengers (supabase/functions/_shared/ingest_regeln.mjs), nicht die lebende Funktion.');
  process.exitCode = kaputt ? 1 : 0;
})();
