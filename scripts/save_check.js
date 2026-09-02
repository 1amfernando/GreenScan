#!/usr/bin/env node
/**
 * save_check.js — kommt an, was gespeichert wird?
 *
 * Fernando: „Prüfe das Speichern und alles andere im Hintergrund."
 *
 * Die vier bestehenden Pruefstaende messen, wie die App AUSSIEHT, ob ein
 * Tipp ankommt, ob jemand ein Eingabefeld liest und ob die gelesenen Daten
 * existieren. Keiner von ihnen faehrt einen Speicherweg zu Ende. Genau dort
 * lagen aber die teuersten Fehler dieses Meilensteins:
 *
 *   v31.72  Gartenmasse wurden nie geschrieben (Leser da, Schreiber fehlte)
 *   v31.65  gsTwinSave meldete Erfolg, obwohl nichts geschrieben wurde
 *   v31.76  gsPPsavePlan ebenso — der Rettungsweg lag in totem Code
 *
 * Dieser Pruefstand faehrt jeden eingetragenen Weg WIRKLICH: Formular
 * fuellen → Speicherfunktion aufrufen → aus dem localStorage zurueklesen →
 * vergleichen. Was zurueckkommt, muss das sein, was hineingegangen ist.
 *
 * ZWEI DINGE, DIE MAN WISSEN MUSS:
 *
 * 1. `gsRequire('…')` sperrt mehrere Speicherwege ohne echte Anmeldung ab.
 *    Der Pseudo-Token aus _seed.js reicht nicht. Der Pruefstand ueberbrueckt
 *    die Sperre bewusst — sonst misst er eine Funktion, die gar nicht lief.
 *    (Genau das ist mir in v31.82 eine halbe Stunde lang passiert.)
 *
 * 2. Gemeldet wird nur, was hier EINGETRAGEN ist. Ein Speicherweg, der in
 *    der Liste fehlt, faellt nicht auf. Die Liste ist die Pruefung.
 *
 *   node scripts/save_check.js
 */
const path = require('path');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const SEED = require('./_seed.js');

// Jeder Eintrag: Name · was vorher gilt · was gespeichert wird · was danach
// im Speicher stehen MUSS. Die Funktionen laufen IM Browser.
const WEGE = [
  {
    name: 'Garten (Name, Masse, Art, Licht, Boden)',
    lauf: () => {
      const setz = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
      window.editingGardenId = null;
      setz('gard-name', 'Prüfgarten'); setz('gard-loc', 'Testort');
      setz('gard-width', '4'); setz('gard-length', '7');
      setz('gard-kind', 'gewaechshaus'); setz('gard-light', 'full_sun'); setz('gard-soil', 'sand');
      saveGarden();
      const g = (JSON.parse(localStorage.getItem('gs_gardens') || '[]') || []).filter(x => x.name === 'Prüfgarten').pop();
      if (!g) return { ok: false, warum: 'kein Garten mit diesem Namen im Speicher' };
      const soll = { width: 4, length: 7, kind: 'gewaechshaus', light: 'full_sun', soil: 'sand', location: 'Testort' };
      const fehlt = Object.keys(soll).filter(k => String(g[k]) !== String(soll[k]));
      return fehlt.length ? { ok: false, warum: 'nicht gespeichert: ' + fehlt.map(k => k + ' (=' + g[k] + ', erwartet ' + soll[k] + ')').join(', ') } : { ok: true };
    },
  },
  {
    name: 'Pflanzung (Garten, Name, Sorte, Datum, Anzahl, Notiz)',
    lauf: () => {
      const g = (JSON.parse(localStorage.getItem('gs_gardens') || '[]') || [])[0];
      if (!g) return { ok: false, warum: 'kein Garten vorhanden' };
      const setz = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
      const sel = document.getElementById('plant-garden-sel');
      if (sel) { sel.innerHTML = '<option value="' + g.id + '">x</option>'; sel.value = g.id; }
      setz('plant-name', 'Prüf-Tomate'); setz('plant-variety', 'Ochsenherz');
      setz('plant-date', '2026-05-20'); setz('plant-count', '7'); setz('plant-notes', 'Notiz-Text');
      savePlanting();
      const p = (JSON.parse(localStorage.getItem('gs_plantings') || '[]') || []).filter(x => x.name === 'Prüf-Tomate').pop();
      if (!p) return { ok: false, warum: 'keine Pflanzung mit diesem Namen im Speicher' };
      const soll = { variety: 'Ochsenherz', date: '2026-05-20', count: 7, notes: 'Notiz-Text', gardenId: g.id };
      const fehlt = Object.keys(soll).filter(k => String(p[k]) !== String(soll[k]));
      return fehlt.length ? { ok: false, warum: 'nicht gespeichert: ' + fehlt.join(', ') } : { ok: true };
    },
  },
  {
    name: 'Saatgut (Name, Menge, Ablaufdatum)',
    lauf: () => {
      const setz = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
      if (typeof gsOpenSeedInventory === 'function') gsOpenSeedInventory();
      setz('gs-s-name', 'Prüf-Radieschen'); setz('gs-s-qty', '5 g'); setz('gs-s-exp', '2027-04-01');
      if (typeof gsSeedAdd !== 'function') return { ok: false, warum: 'gsSeedAdd fehlt' };
      gsSeedAdd();
      const s = (JSON.parse(localStorage.getItem('gs_seed_inventory') || '[]') || []).filter(x => x.name === 'Prüf-Radieschen').pop();
      if (!s) return { ok: false, warum: 'nicht im Speicher' };
      const fehlt = ['qty', 'expires'].filter(k => String(s[k]) !== String({ qty: '5 g', expires: '2027-04-01' }[k]));
      return fehlt.length ? { ok: false, warum: 'nicht gespeichert: ' + fehlt.join(', ') } : { ok: true };
    },
  },
  {
    name: 'Einstellung (savePref → gs_prefs)',
    lauf: () => {
      if (typeof savePref !== 'function') return { ok: false, warum: 'savePref fehlt' };
      savePref('pruefstandWert', 'abc123');
      const p = JSON.parse(localStorage.getItem('gs_prefs') || '{}') || {};
      return (p.pruefstandWert === 'abc123') ? { ok: true } : { ok: false, warum: 'gs_prefs enthaelt den Wert nicht' };
    },
  },
  {
    name: 'Garten-Zwilling (gsTwinSave → gs_garden_twin)',
    lauf: () => {
      if (typeof gsTwinSave !== 'function') return { ok: false, warum: 'gsTwinSave fehlt' };
      const t = { ts: Date.now(), bed: { width_m: 3, length_m: 4 },
                  plants: [{ name: 'Prüfpflanze', x_m: 1, y_m: 1, w_m: .5, h_m: .5 }], beds: [], zones: [] };
      const r = gsTwinSave(t);
      if (r === false) return { ok: false, warum: 'gsTwinSave meldet false' };
      const g = JSON.parse(localStorage.getItem('gs_garden_twin') || 'null');
      if (!g || !g.plants || !g.plants.length) return { ok: false, warum: 'nichts im Speicher' };
      return (g.plants[0].name === 'Prüfpflanze') ? { ok: true } : { ok: false, warum: 'Pflanzenname weg' };
    },
  },
  {
    name: 'Plan (gsPPsavePlan → gs_garden_plans)',
    lauf: async () => {
      if (typeof gsPPsavePlan !== 'function') return { ok: false, warum: 'gsPPsavePlan fehlt' };
      window.sbIsLoggedIn = function () { return false; };
      window._gsPP = window._gsPP || {};
      _gsPP.plan = { summary: 'Prüfplan-Zusammenfassung', bed: { width_m: 2, length_m: 2 }, plants: [{ name: 'Prüfart', count: 1 }] };
      _gsPP.data = { area: 4 };
      await gsPPsavePlan();
      const l = JSON.parse(localStorage.getItem('gs_garden_plans') || '[]') || [];
      const p = l.filter(x => x.plan && x.plan.summary === 'Prüfplan-Zusammenfassung').pop();
      return p ? { ok: true } : { ok: false, warum: 'Plan nicht im Speicher' };
    },
  },
  {
    name: 'Aufgaben-Fortschritt (_gsPPumgesetztSetz → gs_plan_umgesetzt)',
    lauf: () => {
      if (typeof _gsPPumgesetztSetz !== 'function') return { ok: false, warum: '_gsPPumgesetztSetz fehlt' };
      const r = _gsPPumgesetztSetz('plan_pruef', 2, true);
      if (r === false) return { ok: false, warum: 'meldet false' };
      const a = JSON.parse(localStorage.getItem('gs_plan_umgesetzt') || '{}') || {};
      return (a.plan_pruef && a.plan_pruef['2']) ? { ok: true } : { ok: false, warum: 'nicht im Speicher' };
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
  await p.addInitScript(SEED);
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForTimeout(4000);
  await p.evaluate(() => {
    document.documentElement.classList.remove('gs-preauth');
    const o = document.getElementById('gs-onboarding');
    if (o) o.style.setProperty('display', 'none', 'important');
    // Die Anmelde-Sperre bewusst ueberbruecken — siehe Kopfkommentar.
    window.gsRequire = function () { return true; };
    // Toasts still stellen, sie stoeren die Messung nicht, aber die Ausgabe.
    window.gsToast = function () {}; window.showProfileToast = function () {};
  });

  console.log('\n=== save_check — kommt an, was gespeichert wird?');
  let kaputt = 0;
  for (const w of WEGE) {
    let r;
    try {
      r = await p.evaluate(new Function('return (' + w.lauf.toString() + ')()'));
    } catch (e) { r = { ok: false, warum: 'Ausnahme: ' + e.message.split('\n')[0] }; }
    if (r && r.ok) console.log('  ok   ' + w.name);
    else { kaputt++; console.log('  !!   ' + w.name + '  →  ' + ((r && r.warum) || 'unbekannt')); }
  }
  console.log('  ---');
  console.log('  Speicherwege geprueft: ' + WEGE.length + ' · davon kaputt: ' + kaputt);
  console.log('  JS-Fehler waehrend der Pruefung: ' + (errs.length ? errs.length + ' (' + errs.slice(0, 2).join(' | ') + ')' : 'keine'));
  await br.close();
  process.exitCode = kaputt ? 1 : 0;
})();
