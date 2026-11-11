#!/usr/bin/env node
// datum_check.js — stimmt der TAG, wenn es in der Schweiz nach Mitternacht ist?
//
//   node scripts/datum_check.js
//
// Anlass (v33.59): alle anderen Pruefstaende laufen in der Zeitzone der
// Maschine — hier und auf dem GitHub-Runner ist das UTC. Die Nutzer sitzen in
// der Schweiz (UTC+1 / UTC+2). `new Date().toISOString().slice(0, 10)` ist der
// UTC-Tag: zwischen 00:00 und 02:00 Ortszeit ist das GESTERN. In UTC sind
// „lokaler Tag" und „UTC-Tag" dasselbe — ein Fehler dieser Klasse ist dort
// vorher wie nachher gruen. Zweimal wurde sie einzeln gefunden (Backup-Tag
// v33.26, Quiz-Countdown v33.27); gesucht hat sie nie jemand.
//
// Gemessen am 11.11.2026 (Audit „Datum", jeder Fund gegengeprueft):
//   - Das EXIF-Aufnahmedatum stand IMMER einen Tag zu frueh auf der Scan-Karte
//     und im Auftrag an die KI (lokale Mitternacht → UTC-Tag).
//   - Die Vorgabe im Pflanz- und im Ernteformular war nachts der Vortag.
//   - Die Tagebuch-Serie zaehlte UTC-Tage, der Ernte-Tracker las das Jahr aus
//     dem UTC-Stempel und den Monat aus der Ortszeit.
//   - Eine Ernte mit reinem Datum trug im Kalender eine Uhrzeit, die niemand
//     eingegeben hat (14:00 im Sommer, 13:00 im Winter).
//   - Der Giess-Banner im Garten ist NIE erschienen: ISO-Zeichenkette + Zahl.
//
// Die Uhr wird GESTELLT: 15.07.2026 23:30 UTC = 16.07.2026 01:30 in Zuerich.
// Jeder Fall nennt den Wert, der im Fehlerfall anders waere.
//
// Grenze: geprueft sind die Stellen, die hier stehen, plus ein Deckel auf die
// Zahl der UTC-Tagesschnitte im Quelltext (T0). Ein Deckel ist kein Beweis —
// er zwingt nur, bei jeder NEUEN Stelle zu entscheiden: bewusst UTC (dann die
// Zahl erhoehen und begruenden) oder lokal (`_gsDayKey()` / `_gsKalTag(d)`).
// Die Faelligkeitsrechnung ueber die Zeitumstellung (29.03. / 25.10.) ist
// NICHT geprueft — sie steht als offener Punkt in STATUS Sektion 2.
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const SEED = require('./_seed.js');
const WURZEL = path.resolve(__dirname, '..');
const UHR = new Date('2026-07-15T23:30:00Z');       // 16.07.2026 01:30 Ortszeit
const HEUTE_LOKAL = '2026-07-16', HEUTE_UTC = '2026-07-15';

// ── T0 · der Deckel ─────────────────────────────────────────────────────────
// Jeder `toISOString()`-Tagesschnitt im Quelltext der App (ohne Kommentare und
// ohne GS_RELEASES — der Changelog beschreibt die Sache und enthaelt sie
// deshalb woertlich, v33.49). Gezaehlt am 11.11.2026: 40 vor den Reparaturen,
// 32 danach. Eingeordnet hat sie der Audit „Datum" (jede Stelle mit ihrer
// umschliessenden Funktion gelesen):
//   bewusst UTC (25): der Quiz-Tag und seine Nachbarn (dqDayKey, dqTagDavor,
//     dqSerie … — der Server rotiert mit current_date), Dateinamen von
//     Exporten (Backup, GPX, Plan, CSV), Tages-Riegel, die der Server gegen
//     `sent_at::date` haelt, und der Rueckfall hinter `typeof _gsDayKey`.
//   offen (7): das Wetter-Tagesprotokoll (Datum UTC, Werte Zuercher Tag),
//     gsSnoozeTask, zwei unklare — sie stehen in STATUS Sektion 2.
// Die Zahl darf SINKEN. Steigt sie, ist eine neue Stelle dazugekommen.
const UTC_TAG_DECKEL = 32;

function ohneKommentareUndChangelog(q) {
  const a = q.indexOf('window.GS_RELEASES = [');
  if (a >= 0) { const e = q.indexOf('\n];', a); if (e > a) q = q.slice(0, a) + q.slice(e); }
  return q.replace(/^[ \t]*\/\/.*$/gm, '').replace(/^[ \t]*\*.*$/gm, '');
}
function t0() {
  const q = ohneKommentareUndChangelog(fs.readFileSync(path.join(WURZEL, 'index.html'), 'utf8'));
  const z = q.split('\n');
  const treffer = [];
  z.forEach((l, i) => { const m = l.match(/toISOString\(\)\s*\.\s*(?:slice\(\s*0\s*,\s*10\s*\)|split\(\s*['"]T['"]\s*\)\s*\[\s*0\s*\]|substr\(\s*0\s*,\s*10\s*\))/g); if (m) for (let k = 0; k < m.length; k++) treffer.push(i + 1); });
  if (treffer.length < 5) return { ok: false, warum: 'nur ' + treffer.length + ' Tagesschnitte gefunden — der Fall misst offenbar etwas anderes' };
  if (treffer.length > UTC_TAG_DECKEL) return { ok: false, warum: treffer.length + ' UTC-Tagesschnitte, Deckel ' + UTC_TAG_DECKEL + ' — eine neue Stelle rechnet den Tag in UTC. Lokal gemeint? Dann _gsDayKey() / _gsKalTag(d). Bewusst UTC? Dann den Deckel mit Begruendung erhoehen.' };
  return { ok: true, info: treffer.length + ' UTC-Tagesschnitte im Quelltext (Deckel ' + UTC_TAG_DECKEL + ') — keiner dazugekommen' };
}

const SEITE = [
  {
    name: 'T1 · Die Vorgabe in einem Datumsfeld ist HEUTE — auch um 01:30 nachts: Pflanzung und Ernte tragen den 16.07., nicht den 15.',
    lauf: async () => {
      const r = { lokal: _gsDayKey(), utc: new Date().toISOString().slice(0, 10) };
      try { openAddPlanting(); } catch (e) { r.fehlerP = e.message; }
      await new Promise(res => setTimeout(res, 250));
      const pd = document.getElementById('plant-date'); r.pflanzung = pd ? pd.value : null;
      try { document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id)); } catch (_) {}
      try { openHarvestAddModal((myPlants[0] || {}).id); } catch (e) { r.fehlerE = e.message; }
      await new Promise(res => setTimeout(res, 250));
      const hd = document.getElementById('harvest-date'); r.ernte = hd ? hd.value : null;
      try { document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id)); } catch (_) {}
      return r;
    },
    urteil: (r) => {
      if (r.lokal !== HEUTE_LOKAL || r.utc !== HEUTE_UTC) return { ok: false, warum: 'die gestellte Uhr steht nicht: lokal ' + r.lokal + ', UTC ' + r.utc + ' — der Fall misst nichts' };
      if (r.pflanzung == null || r.ernte == null) return { ok: false, warum: 'ein Feld fehlt (plant-date: ' + r.pflanzung + ', harvest-date: ' + r.ernte + (r.fehlerP ? ' · ' + r.fehlerP : '') + (r.fehlerE ? ' · ' + r.fehlerE : '') + ')' };
      if (r.pflanzung !== HEUTE_LOKAL || r.ernte !== HEUTE_LOKAL) return { ok: false, warum: 'Pflanzung: ' + r.pflanzung + ' · Ernte: ' + r.ernte + ' — es ist der ' + HEUTE_LOKAL };
      return { ok: true, info: 'um 01:30 Ortszeit: Pflanzung ' + r.pflanzung + ' · Ernte ' + r.ernte + ' (der UTC-Tag waere ' + HEUTE_UTC + ')' };
    },
  },
  {
    name: 'T2 · Das Aufnahmedatum aus dem Foto ist der Tag, der im Foto steht — EXIF 15.07. ergibt „2026-07-15", nicht den Vortag',
    lauf: async () => {
      const alt = window._gsScanExif;
      try {
        window._gsScanExif = { datum: new Date(2026, 6, 15) };          // so baut gsExifVonDatei es: lokale Mitternacht
        const c1 = gsBuildScanContext();
        window._gsScanExif = { datum: new Date(2026, 0, 1) };           // Neujahr: Monat UND Jahr daneben
        const c2 = gsBuildScanContext();
        return { a1: c1 && c1.aufnahme, a2: c2 && c2.aufnahme, ausFoto: !!(c1 && c1.ausFoto) };
      } finally { window._gsScanExif = alt; }
    },
    urteil: (r) => {
      if (!r.ausFoto) return { ok: false, warum: 'der Kontext nimmt das Foto-Datum nicht an — der Fall misst nichts' };
      if (r.a1 !== '2026-07-15' || r.a2 !== '2026-01-01') return { ok: false, warum: 'EXIF 15.07.2026 → „' + r.a1 + '" · EXIF 01.01.2026 → „' + r.a2 + '"' };
      return { ok: true, info: 'EXIF 15.07.2026 → ' + r.a1 + ' · EXIF 01.01.2026 → ' + r.a2 };
    },
  },
  {
    name: 'T3 · Die Tagebuch-Serie zaehlt Tage, wie die Person sie erlebt: gestern Abend und heute nach Mitternacht sind ZWEI Tage — zwei Eintraege am selben Abend bleiben einer',
    lauf: async () => {
      const alt = localStorage.getItem('gs_gartentagebuch'), mp0 = JSON.stringify(myPlants);
      const lies = () => { const mc = document.getElementById('modal-content'); const m = mc ? mc.textContent.match(/🔥\s*(\d+)\s*Tage/) : null; return m ? +m[1] : 0; };
      const stell = (liste) => { localStorage.setItem('gs_gartentagebuch', JSON.stringify(liste)); try { window._gsTagebuch = null; } catch (_) {} try { if (typeof gsTagebuchLoad === 'function') gsTagebuchLoad(true); } catch (_) {} };
      try {
        myPlants = myPlants.map(p => Object.assign({}, p, { diary: [] }));     // sonst zaehlen die Abhak-Eintraege der Beispielpflanzen mit
        // 15.07. 20:00 Ortszeit und 16.07. 00:10 Ortszeit — im UTC-Stempel beide „2026-07-15".
        stell([{ id: 'a', ts: '2026-07-15T18:00:00.000Z', text: 'Abend', cat: 'note' }, { id: 'b', ts: '2026-07-15T22:10:00.000Z', text: 'nach Mitternacht', cat: 'note' }]);
        openGartenTagebuch(); await new Promise(res => setTimeout(res, 300));
        const zwei = lies();
        // Gegenrichtung: 15.07. 20:00 und 15.07. 23:00 Ortszeit — EIN Tag, und heute (16.) nichts.
        stell([{ id: 'c', ts: '2026-07-15T18:00:00.000Z', text: 'Abend', cat: 'note' }, { id: 'd', ts: '2026-07-15T21:00:00.000Z', text: 'spaeter Abend', cat: 'note' }]);
        openGartenTagebuch(); await new Promise(res => setTimeout(res, 300));
        const einer = lies();
        return { zwei, einer, da: !!document.getElementById('modal-content') };
      } finally {
        try { myPlants = JSON.parse(mp0); } catch (_) {}
        if (alt == null) localStorage.removeItem('gs_gartentagebuch'); else localStorage.setItem('gs_gartentagebuch', alt);
        try { if (typeof gsTagebuchLoad === 'function') gsTagebuchLoad(true); } catch (_) {}
        try { document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id)); } catch (_) {}
      }
    },
    urteil: (r) => {
      if (!r.da) return { ok: false, warum: 'kein #modal-content' };
      if (r.zwei !== 2) return { ok: false, warum: 'Eintraege am 15.07. abends und am 16.07. nach Mitternacht → Serie ' + (r.zwei || 'keine') + ' statt 2' };
      if (r.einer > 1) return { ok: false, warum: 'zwei Eintraege am SELBEN Abend → Serie ' + r.einer + ' — das ist ein Tag' };
      return { ok: true, info: 'gestern Abend + heute 00:10 → 🔥 2 Tage · zweimal am selben Abend → keine Serie' };
    },
  },
  {
    name: 'T4 · Der Ernte-Tracker ordnet nach dem Tag der Person: eine Ernte an Silvester um 00:30 (Ortszeit 1. Januar) steht im NEUEN Jahr, mit dem Datum 01.01.',
    lauf: async () => {
      const alt = localStorage.getItem('gs_ernte_log'), j0 = localStorage.getItem('gs_ernte_year'), v0 = localStorage.getItem('gs_ernte_view');
      const text = () => { const mc = document.getElementById('modal-content'); return mc ? mc.textContent.replace(/\s+/g, ' ') : ''; };
      try {
        localStorage.setItem('gs_ernte_log', JSON.stringify([{ id: 'e-sil', pflanze: 'Federkohl Prüfstand', emoji: '🥬', menge: 0.8, unit: 'kg', ts: '2026-12-31T23:30:00.000Z' }]));
        window._gsErnteLog = null;
        localStorage.setItem('gs_ernte_view', 'all');          // die Ansicht „Alle" nennt jedes Datum
        localStorage.setItem('gs_ernte_year', '2027');
        openErnteTracking(); await new Promise(res => setTimeout(res, 300));
        const neu = text();
        localStorage.setItem('gs_ernte_year', '2026'); window._gsErnteLog = null;
        openErnteTracking(); await new Promise(res => setTimeout(res, 300));
        const altJahr = text();
        return { in2027: /Federkohl Prüfstand/.test(neu), datum2027: /2027-01-01/.test(neu), datumAlt: /2026-12-31/.test(neu) || /2026-12-31/.test(altJahr), in2026: /Federkohl Prüfstand/.test(altJahr) };
      } finally {
        if (alt == null) localStorage.removeItem('gs_ernte_log'); else localStorage.setItem('gs_ernte_log', alt);
        if (j0 == null) localStorage.removeItem('gs_ernte_year'); else localStorage.setItem('gs_ernte_year', j0);
        if (v0 == null) localStorage.removeItem('gs_ernte_view'); else localStorage.setItem('gs_ernte_view', v0);
        window._gsErnteLog = null;
        try { document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id)); } catch (_) {}
      }
    },
    urteil: (r) => {
      if (!r.in2027) return { ok: false, warum: 'die Ernte vom 01.01.2027 00:30 (Ortszeit) steht NICHT im Jahr 2027' + (r.in2026 ? ' — sie steht in 2026' : '') };
      if (r.in2026) return { ok: false, warum: 'die Ernte steht AUCH in 2026 — ein Eintrag, zwei Jahre' };
      if (r.datumAlt || !r.datum2027) return { ok: false, warum: 'die Liste nennt nicht den 01.01.2027 (sondern den UTC-Tag 31.12.2026)' };
      return { ok: true, info: 'Ernte um 00:30 am 1. Januar → Jahr 2027, Datum 2027-01-01, nicht in 2026' };
    },
  },
  {
    name: 'T5 · Eine Ernte mit reinem Datum hat im Kalender KEINE Uhrzeit — eine mit echter Zeit behaelt sie',
    lauf: async () => {
      const alt = localStorage.getItem('gs_ernte_log'), altF = localStorage.getItem('gs_kal_filter');
      try {
        localStorage.setItem('gs_ernte_log', JSON.stringify([
          { id: 'e-tag', pflanze: 'Zucchini', menge: 1, unit: 'kg', ts: '2026-07-14T12:00:00.000Z' },      // so legt gsHarvestSubmit ein reines Datum ab
          { id: 'e-zeit', pflanze: 'Tomate', menge: 2, unit: 'kg', ts: '2026-07-14T07:41:13.512Z' },     // eine echte Zeit: 09:41 Ortszeit
        ]));
        window._gsErnteLog = null;
        localStorage.setItem('gs_kal_filter', JSON.stringify({ aus: [], garten: null }));
        const ev = gsKalenderEreignisse('2026-07-10', '2026-07-16').filter(e => e.art === 'ernte' && e.quelle === 'hand');
        const z = (t) => { const e = ev.find(x => new RegExp(t).test(x.titel || '')); return e ? { zeit: e.zeit, da: true } : { da: false }; };
        return { n: ev.length, tag: z('Zucchini'), zeit: z('Tomate'), helfer: typeof _gsNurDatum === 'function' };
      } finally {
        if (alt == null) localStorage.removeItem('gs_ernte_log'); else localStorage.setItem('gs_ernte_log', alt);
        if (altF == null) localStorage.removeItem('gs_kal_filter'); else localStorage.setItem('gs_kal_filter', altF);
        window._gsErnteLog = null;
      }
    },
    urteil: (r) => {
      if (r.n !== 2 || !r.tag.da || !r.zeit.da) return { ok: false, warum: r.n + ' Ernte-Ereignisse statt 2 — der Fall stellt seinen Zustand nicht her' };
      if (r.tag.zeit) return { ok: false, warum: 'die Ernte mit reinem Datum traegt die Uhrzeit „' + r.tag.zeit + '" — die hat niemand eingegeben' };
      if (r.zeit.zeit !== '09:41') return { ok: false, warum: 'die Ernte mit echter Zeit zeigt „' + r.zeit.zeit + '" statt 09:41 — dann verschluckt die Regel jede Zeit' };
      return { ok: true, info: 'reines Datum → keine Uhrzeit · echte Zeit → 09:41' };
    },
  },
  {
    name: 'T6 · Der Giess-Banner im Garten beantwortet dieselbe Frage wie „Heute zu tun": er erscheint, nennt genau die heute faelligen Pflanzen — und bleibt weg, wenn nichts faellig ist',
    lauf: async () => {
      const mp0 = JSON.stringify(myPlants), pl0 = JSON.stringify(plantings);
      const banner = document.getElementById('garden-water-banner');
      if (!banner) return { fehlt: true };
      const iso = (tage) => new Date(Date.now() - tage * 864e5).toISOString();
      try {
        plantings = [];
        myPlants = [
          { id: 'w1', name: 'Durstig <b>', tasks: { water: { active: true, intervalDays: 2, lastDone: iso(5) } } },     // seit 3 Tagen faellig, ISO-Zeichenkette
          { id: 'w2', name: 'Heute dran', tasks: { water: { active: true, intervalDays: 3, lastDone: iso(3) } } },
          { id: 'w3', name: 'Versorgt', tasks: { water: { active: true, intervalDays: 7, lastDone: iso(1) } } },
        ];
        gsCheckWaterNeeded();
        const soll = gsGetDueTasks().filter(e => e.key === 'water' && e.days <= 0).length;
        const r = { soll, sichtbar: banner.style.display !== 'none', text: banner.textContent.replace(/\s+/g, ' '), fremd: banner.querySelectorAll('b').length };
        myPlants = [{ id: 'w3', name: 'Versorgt', tasks: { water: { active: true, intervalDays: 7, lastDone: iso(1) } } }];
        gsCheckWaterNeeded();
        r.leerSichtbar = banner.style.display !== 'none';
        return r;
      } finally { try { myPlants = JSON.parse(mp0); plantings = JSON.parse(pl0); } catch (_) {} banner.style.display = 'none'; }
    },
    urteil: (r) => {
      if (r.fehlt) return { ok: false, warum: '#garden-water-banner fehlt' };
      if (r.soll !== 2) return { ok: false, warum: 'gsGetDueTasks nennt ' + r.soll + ' faellige Giess-Aufgaben statt 2 — der Fall stellt seinen Zustand nicht her' };
      if (!r.sichtbar) return { ok: false, warum: 'zwei Pflanzen sind heute faellig, und der Banner erscheint NICHT' };
      if (!/^\D*2 Pflanzen/.test(r.text.trim()) && !/2 Pflanzen giessen/.test(r.text)) return { ok: false, warum: 'der Banner nennt nicht 2: „' + r.text.slice(0, 80) + '"' };
      if (/Versorgt/.test(r.text)) return { ok: false, warum: 'der Banner nennt eine Pflanze, die nicht faellig ist' };
      if (r.fremd) return { ok: false, warum: 'ein Pflanzenname wurde zu einem Element (<b>)' };
      if (r.leerSichtbar) return { ok: false, warum: 'nichts faellig, und der Banner steht trotzdem da' };
      return { ok: true, info: '2 faellig → „' + r.text.slice(0, 44).trim() + '…" · nichts faellig → kein Banner · Name als Text' };
    },
  },
];

(async () => {
  console.log('\n=== datum_check — stimmt der Tag, wenn es in der Schweiz nach Mitternacht ist?');
  let kaputt = 0;
  const melde = (name, r) => {
    if (r && r.ok) console.log('  ok   ' + name + (r.info ? '   [' + r.info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
  };
  let r0; try { r0 = t0(); } catch (e) { r0 = { ok: false, warum: 'Ausnahme: ' + e.message }; }
  melde('T0 · Kein neuer UTC-Tagesschnitt im Quelltext (toISOString().slice(0,10) ist in der Schweiz nachts der Vortag)', r0);

  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 412, height: 915 }, timezoneId: 'Europe/Zurich', locale: 'de-CH' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await p.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await p.clock.setFixedTime(UHR);                     // VOR dem Seed: seine Daten liegen relativ zu dieser Uhr
  await p.addInitScript(SEED);
  await p.goto('file://' + path.join(WURZEL, 'index.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForTimeout(4000);
  await p.evaluate(() => {
    document.documentElement.classList.remove('gs-preauth');
    window.gsRequire = () => true;
    window.gsToast = () => {}; window.showProfileToast = () => {}; window.gsHaptic = () => {};
  });
  const stand = await p.evaluate(() => ({ uhr: new Date().toISOString(), lokal: new Date().toLocaleString('de-CH'), zone: Intl.DateTimeFormat().resolvedOptions().timeZone }));
  console.log('  gestellte Uhr: ' + stand.uhr + ' = ' + stand.lokal + ' (' + stand.zone + ')');
  if (stand.zone !== 'Europe/Zurich') { kaputt++; console.log('  !!   die Zeitzone ist ' + stand.zone + ' — ohne Versatz zu UTC misst dieser Pruefstand nichts'); }
  for (const f of SEITE) {
    let r;
    try { const roh = await p.evaluate(new Function('return (' + f.lauf.toString() + ')()')); r = f.urteil(roh); }
    catch (e) { r = { ok: false, warum: 'Ausnahme: ' + e.message.split('\n')[0] }; }
    melde(f.name, r);
  }
  await br.close();
  console.log('  ---');
  console.log('  Faelle geprueft: ' + (SEITE.length + 1) + ' · davon kaputt: ' + kaputt);
  console.log('  JS-Fehler waehrend der Pruefung: ' + (errs.length ? errs.length + ' (' + errs.slice(0, 2).join(' | ') + ')' : 'keine'));
  console.log('  Grenze: geprueft sind diese sechs Stellen und der Deckel. Die Faelligkeit ueber die Zeitumstellung');
  console.log('  (29.03. / 25.10.) und zwoelf Tages-Riegel in UTC stehen als offene Punkte in STATUS Sektion 2.');
  process.exitCode = (kaputt || errs.length) ? 1 : 0;
})();
