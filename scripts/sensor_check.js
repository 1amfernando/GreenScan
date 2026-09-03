#!/usr/bin/env node
// sensor_check.js — funktioniert das Messwerte-Dashboard, bevor es ein Geraet gibt?
//
//   node scripts/sensor_check.js
//
// Entwurf: docs/OEKOSYSTEM-V1.md, Vertrag in §9a. Stufe 0 hat KEINE Hardware —
// die Person ist das erste Geraet (§4). Dieser Stand stellt ein Geraet von
// Hand, traegt Werte ein (plausible, unplausible, bei vollem Speicher), legt
// eine Regel an und liest das gerenderte Dashboard. Regeln aus dem Entwurf,
// die er festhaelt:
//
//   1. Kein Messwert wird verworfen — unplausibel ist eine Qualitaet.
//   2. Eine Regel hat DREI Zustaende; ohne Werte ist sie „nicht pruefbar".
//   3. Kein `if (metric === …)` — alles aus dem Katalog; der Katalog ist nie leer.
//   4. Bei vollem Speicher sagt die Funktion es (CLAUDE.md §3.5) — nicht „gespeichert".
//   5. Die Anzeige wird aus dem HTML gelesen, nicht aus dem Objekt.
//
// Geschrieben VOR dem Code (test-first): der erste Lauf muss rot sein.
'use strict';
const path = require('path');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const SEED = require('./_seed.js');

const HEUTE_MS = 1756684800000 + 12 * 3600 * 1000;   // wie kalender_check: `now` aus _seed.js + 12 h

const FAELLE = [
  {
    name: 'Katalog · ist ohne Netz da und nennt elf Messgrössen mit Einheit und Bereich',
    lauf: () => {
      if (typeof gsMetricKatalog !== 'function') return { ok: false, warum: 'gsMetricKatalog fehlt' };
      const k = gsMetricKatalog();
      if (!Array.isArray(k) || k.length < 11) return { ok: false, warum: 'Katalog hat ' + (k && k.length) + ' Einträge statt ≥ 11' };
      const kaputt = k.filter(m => !m.key || !m.unit || !m.label_de || typeof m.min_valid !== 'number' || typeof m.max_valid !== 'number');
      if (kaputt.length) return { ok: false, warum: kaputt.length + ' Einträge ohne key/unit/label_de/min/max' };
      if (!k.some(m => m.key === 'soil_moisture')) return { ok: false, warum: 'soil_moisture fehlt' };
      return { ok: true, info: k.length + ' Grössen, alle vollständig' };
    },
  },
  {
    name: 'Gerät · von Hand angelegt, „wartet auf Signal" bis zum ersten Wert',
    lauf: () => {
      if (typeof gsGeraetAnlegen !== 'function') return { ok: false, warum: 'gsGeraetAnlegen fehlt' };
      const g = gsGeraetAnlegen({ kind: 'manual', name: 'Hochbeet Nord', garden_id: 'g1' });
      if (!g || !g.id) return { ok: false, warum: 'kein Gerät zurück' };
      window.__G = g.id;
      const alle = gsGeraete();
      if (!alle.some(x => x.id === g.id)) return { ok: false, warum: 'das Gerät steht nicht in gsGeraete()' };
      if (g.status !== 'wartet') return { ok: false, warum: 'Status „' + g.status + '" statt „wartet" — verbunden heisst erst nach dem ersten Wert' };
      return { ok: true, info: g.name + ' · ' + g.kind + ' · ' + g.status };
    },
  },
  {
    name: 'Messwert · plausibel wird angenommen, unplausibel wird NICHT verworfen (quality 1)',
    lauf: () => {
      const a = gsMesswertEintragen(window.__G, 'soil_moisture', 31.5);
      if (!a || !a.ok || a.quality !== 2) return { ok: false, warum: '31.5 % → ' + JSON.stringify(a) };
      const b = gsMesswertEintragen(window.__G, 'soil_moisture', 250);
      if (!b || !b.ok) return { ok: false, warum: '250 % wurde verworfen — ein kaputter Sensor ist eine Information' };
      if (b.quality !== 1) return { ok: false, warum: '250 % hat quality ' + b.quality + ' statt 1' };
      const c = gsMesswertEintragen(window.__G, 'gibt_es_nicht', 1);
      if (!c || c.ok) return { ok: false, warum: 'eine unbekannte Messgrösse wurde angenommen' };
      if (!c.grund || !/Katalog/.test(c.grund)) return { ok: false, warum: 'die Absage nennt den Katalog nicht' };
      const w = gsMesswerte(window.__G, 'soil_moisture');
      if (w.length !== 2) return { ok: false, warum: w.length + ' Werte gespeichert statt 2' };
      const g = gsGeraete().find(x => x.id === window.__G);
      if (!g || g.status !== 'active') return { ok: false, warum: 'nach dem ersten Wert ist das Gerät nicht „active"' };
      return { ok: true, info: '2 Werte, quality 2 und 1 · unbekannte Grösse abgelehnt · Gerät active' };
    },
  },
  {
    name: 'Voller Speicher · die Funktion sagt es, statt „gespeichert" zu melden',
    lauf: () => {
      const orig = localStorage.setItem; window.__LOG = [];
      localStorage.setItem = function (k, v) { window.__LOG.push(String(k)); return false; };
      let r; try { r = gsMesswertEintragen(window.__G, 'soil_temp', 18.2); } finally { localStorage.setItem = orig; }
      if (!window.__LOG.some(k => k === 'gs_messwerte')) return { ok: false, warum: 'kein Schreibversuch auf gs_messwerte — Fall nicht hergestellt' };
      if (!r || r.ok !== false) return { ok: false, warum: 'meldet ' + JSON.stringify(r) + ' bei vollem Speicher' };
      if (!r.grund || !/Speicher/.test(r.grund)) return { ok: false, warum: 'die Absage nennt den Speicher nicht' };
      if (gsMesswerte(window.__G, 'soil_temp').length) return { ok: false, warum: 'der Wert liegt trotzdem im Speicher' };
      return { ok: true, info: 'ok:false · „' + r.grund + '"' };
    },
  },
  {
    name: 'Regel · drei Zustände: verletzt, erfüllt, und ohne Werte „nicht prüfbar"',
    lauf: () => {
      if (typeof gsRegelAnlegen !== 'function' || typeof gsRegelnPruefen !== 'function') return { ok: false, warum: 'gsRegelAnlegen/gsRegelnPruefen fehlen' };
      // verletzt: Feuchte unter 40, letzter plausibler Wert 31.5 (der 250er zählt nicht)
      const r1 = gsRegelAnlegen({ geraet_id: window.__G, metric: 'soil_moisture', op: 'below', threshold: 40, action: 'notify' });
      if (!r1 || !r1.id) return { ok: false, warum: 'Regel nicht angelegt' };
      let z = gsRegelnPruefen(window.__G);
      const a = z.find(x => x.regel_id === r1.id);
      if (!a || a.zustand !== 'verletzt') return { ok: false, warum: 'unter 40 mit 31.5 → ' + (a && a.zustand) + ' (' + (a && a.grund) + ')' };
      if (!a.grund || !/31\.5/.test(a.grund)) return { ok: false, warum: 'der Grund nennt den Wert nicht: ' + a.grund };
      // erfüllt: Schwelle 20
      const r2 = gsRegelAnlegen({ geraet_id: window.__G, metric: 'soil_moisture', op: 'below', threshold: 20, action: 'notify' });
      z = gsRegelnPruefen(window.__G);
      const b = z.find(x => x.regel_id === r2.id);
      if (!b || b.zustand !== 'erfuellt') return { ok: false, warum: 'unter 20 mit 31.5 → ' + (b && b.zustand) };
      // nicht prüfbar: keine Werte für air_temp
      const r3 = gsRegelAnlegen({ geraet_id: window.__G, metric: 'air_temp', op: 'above', threshold: 30, action: 'notify' });
      z = gsRegelnPruefen(window.__G);
      const c = z.find(x => x.regel_id === r3.id);
      if (!c || c.zustand !== 'nicht_pruefbar') return { ok: false, warum: 'ohne Werte → ' + (c && c.zustand) + ' — Stille ist kein „erfüllt"' };
      return { ok: true, info: 'verletzt (31.5 < 40) · erfüllt · nicht prüfbar ohne Werte' };
    },
  },
  {
    name: 'Dashboard · Kacheln, Verlauf und Regeln werden aus dem HTML gelesen',
    lauf: () => {
      if (typeof gsMesswerteOeffnen !== 'function') return { ok: false, warum: 'gsMesswerteOeffnen fehlt' };
      gsMesswerteOeffnen();
      const mc = document.getElementById('modal-content');
      const t = (mc && mc.textContent) || '';
      if (!/Hochbeet Nord/.test(t)) return { ok: false, warum: 'das Gerät steht nicht im Dashboard' };
      if (!/Bodenfeuchte/.test(t)) return { ok: false, warum: 'die Messgrösse heisst nicht nach dem Katalog (Bodenfeuchte)' };
      if (!/31[.,]5/.test(t)) return { ok: false, warum: 'der letzte plausible Wert (31.5) fehlt' };
      if (!/ausserhalb|unplausibel/i.test(t)) return { ok: false, warum: 'der unplausible Wert wird nicht als solcher gezeigt' };
      const cv = mc.querySelector('canvas.gs-mw-verlauf');
      if (!cv) return { ok: false, warum: 'kein Verlaufs-Diagramm (canvas.gs-mw-verlauf)' };
      if (cv.width < 100 || cv.height < 40) return { ok: false, warum: 'Diagramm ' + cv.width + '×' + cv.height };
      if (!cv.getAttribute('aria-label') && !cv.getAttribute('role')) return { ok: false, warum: 'das Diagramm hat keinen Namen für Screenreader' };
      if (!/verletzt|unter 40/i.test(t)) return { ok: false, warum: 'die verletzte Regel steht nicht im Dashboard' };
      if (!/nicht prüfbar/i.test(t)) return { ok: false, warum: 'die nicht prüfbare Regel wird nicht als solche genannt' };
      if (/undefined|NaN|\[object Object\]/.test(t)) return { ok: false, warum: 'Platzhalter im Text' };
      return { ok: true, info: 'Gerät · Bodenfeuchte 31.5 · unplausibel markiert · Diagramm ' + cv.width + '×' + cv.height + ' · Regeln mit Zustand' };
    },
  },
  {
    name: 'Kalender · ein Messwert von Hand ist ein Ereignis der Art „messung", ein Alarm der Art „alarm"',
    lauf: () => {
      const heute = gsHeuteTag();
      const ev = gsKalenderEreignisse(heute, heute);
      const m = ev.filter(e => e.art === 'messung');
      if (!m.length) return { ok: false, warum: 'kein Ereignis der Art messung am heutigen Tag' };
      if (!m[0].grund || !/Hochbeet Nord/.test(m[0].grund + ' ' + m[0].titel)) return { ok: false, warum: 'das Messung-Ereignis nennt das Gerät nicht' };
      const a = ev.find(e => e.art === 'alarm');
      if (!a) return { ok: false, warum: 'die verletzte Regel erscheint nicht als Alarm' };
      if (a.status === 'info') return { ok: false, warum: 'ein Alarm ist keine Info' };
      return { ok: true, info: m.length + ' Messung(en) · 1 Alarm' };
    },
  },
  {
    name: 'Speicherorte · die neuen Schlüssel stehen in den Listen (Abmelden räumt, Katalog bleibt)',
    lauf: () => {
      const user = (typeof GS_USER_KEYS !== 'undefined') ? GS_USER_KEYS : [];
      const keep = (typeof GS_KEEP_ON_LOGOUT !== 'undefined') ? GS_KEEP_ON_LOGOUT : [];
      const fehlt = ['gs_geraete', 'gs_geraete_regeln', 'gs_messwerte'].filter(k => user.indexOf(k) < 0);
      if (fehlt.length) return { ok: false, warum: 'nicht in GS_USER_KEYS: ' + fehlt.join(', ') + ' — überleben das Abmelden auf einem geteilten Gerät' };
      if (keep.indexOf('gs_metric_catalog') < 0) return { ok: false, warum: 'gs_metric_catalog nicht in GS_KEEP_ON_LOGOUT (öffentlicher Katalog)' };
      return { ok: true, info: 'drei Nutzer-Schlüssel, ein bleibender' };
    },
  },
];

(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 412, height: 915 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await p.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await p.clock.setFixedTime(HEUTE_MS);
  await p.addInitScript(SEED);
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForTimeout(4000);
  await p.evaluate(() => {
    document.documentElement.classList.remove('gs-preauth');
    window.gsRequire = () => true;
    window.gsToast = () => {}; window.showProfileToast = () => {}; window.gsHaptic = () => {};
  });

  console.log('\n=== sensor_check — funktioniert das Messwerte-Dashboard, bevor es ein Gerät gibt?');
  let kaputt = 0;
  for (const f of FAELLE) {
    let r;
    try { r = await p.evaluate(new Function('return (' + f.lauf.toString() + ')()')); }
    catch (e) { r = { ok: false, warum: 'Ausnahme: ' + e.message.split('\n')[0] }; }
    if (r && r.ok) console.log('  ok   ' + f.name + (r.info ? '   [' + r.info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
  }
  console.log('  ---');
  console.log('  Fälle geprueft: ' + FAELLE.length + ' · davon kaputt: ' + kaputt);
  console.log('  JS-Fehler waehrend der Pruefung: ' + (errs.length ? errs.length + ' (' + errs.slice(0, 2).join(' | ') + ')' : 'keine'));
  console.log('  Grenze: es gibt hier kein Geraet und keinen Server — geprueft ist der Weg eines');
  console.log('  Messwerts von Hand bis ins Dashboard und in den Kalender (OEKOSYSTEM-V1.md §4).');
  await br.close();
  process.exitCode = kaputt ? 1 : 0;
})();
