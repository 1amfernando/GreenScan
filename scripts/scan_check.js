#!/usr/bin/env node
/**
 * scan_check.js — glaubt der Scanner der KI aufs Wort?
 *
 * Fernando: „Bessere und zuverlässigere Scans sowie Resultate … besser als
 * Google Lens."
 *
 * Die Antwort darauf steht in docs/SCANNER-V3.md §2 und ist keine bessere
 * Bilderkennung — die gibt es hier nicht zu gewinnen. Es ist das PRÜFEN:
 * 4'342 kuratierte Arten, der Monat, der Kanton, die gemessene Bildqualität.
 * Eine reine Bilderkennung hat nichts davon.
 *
 * Dieser Prüfstand fährt `_gsScanPruefwerk` gegen konstruierte Antworten und
 * liest, was danach auf der Karte steht. Zwei Regeln, wie überall:
 *
 *   1. Jede Regel läuft gegen eine GUTE Antwort (darf nichts melden) UND
 *      gegen eine schlechte (muss melden).
 *   2. Was die Anzeige zeigt, wird aus dem gerenderten HTML gelesen, nicht
 *      aus dem Objekt (Lehre aus v31.90).
 *
 * Der wichtigste Fall ist die Sicherheits-Korrektur: sagt das Modell
 * „essbar, ungiftig" über eine Art, die unsere Liste als tödlich führt, MUSS
 * die vorsichtigere Angabe gewinnen — und zwar sichtbar.
 *
 *   node scripts/scan_check.js
 */
const path = require('path');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const SEED = require('./_seed.js');

const FAELLE = [
  {
    name: 'S2 · tödliche Art als „essbar" gemeldet → Korrektur nach oben',
    lauf: () => {
      // Herbstzeitlose steht in unserer Liste mit tox 5. Das Modell behauptet
      // das Gegenteil — genau der Fall, in dem jemand stirbt.
      const r = {
        name: 'Herbstzeitlose', latin: 'Colchicum autumnale', confidence: 88,
        edible: true, toxic: false, toxicity: 0, alternatives: [],
      };
      const pw = _gsScanPruefwerk(r, null);
      if (r.toxicity !== 5) return { ok: false, warum: 'Giftigkeit nicht korrigiert (ist ' + r.toxicity + ', erwartet 5)' };
      if (r.edible !== false) return { ok: false, warum: 'gilt weiterhin als essbar' };
      if (!pw.regeln.some(x => x.id === 'gift' && x.zustand === 'warn')) return { ok: false, warum: 'kein Vorbehalt bei der Sicherheit' };
      return { ok: true, info: '0 → 5, essbar → nein' };
    },
  },
  {
    name: 'S2 · Anzeige: die Korrektur steht wirklich auf der Karte',
    lauf: () => {
      const r = {
        name: 'Herbstzeitlose', latin: 'Colchicum autumnale', confidence: 88,
        edible: true, toxic: false, toxicity: 0, alternatives: [], description: 'x',
      };
      showScanResult(r);
      const el = document.getElementById('scan-result');
      const txt = (el && el.textContent) || '';
      if (!/giftiger ein/.test(txt)) return { ok: false, warum: 'die Korrektur wird nicht genannt' };
      if (!/Gegengeprüft/.test(txt)) return { ok: false, warum: 'die Prüftafel fehlt auf der Karte' };
      if (/undefined|NaN|\[object Object\]/.test(txt)) return { ok: false, warum: 'Platzhalter im Text' };
      if (/✅ Essbar/.test(txt)) return { ok: false, warum: 'zeigt weiterhin „Essbar"' };
      return { ok: true, info: (txt.match(/Unsere Artenliste stuft[^.]*\./) || ['gefunden'])[0].slice(0, 80) };
    },
  },
  {
    name: 'Gute Antwort · Bärlauch im Mai → kein einziger Vorbehalt',
    lauf: () => {
      const r = {
        name: 'Bärlauch', latin: 'Allium ursinum', confidence: 92,
        edible: true, toxic: false, toxicity: 0,
        alternatives: [{ name: 'Maiglöckchen', latin: 'Convallaria majalis', confidence: 28 }],
        _shotCount: 2,
      };
      const pw = _gsScanPruefwerk(r, { messbar: true, quality: 78, blur: 70, light: 80, warnings: [] });
      const warn = pw.regeln.filter(x => x.zustand === 'warn');
      // Die Saison-Regel darf melden, WENN der Prüfstand ausserhalb Apr–Jun läuft.
      const echte = warn.filter(x => x.id !== 'saison');
      if (echte.length) return { ok: false, warum: 'meldet ' + echte.map(x => x.id + ': ' + x.text.slice(0, 50)).join(' | ') };
      if (r.toxicity !== 0 || r.edible !== true) return { ok: false, warum: 'hat eine korrekte Angabe verändert' };
      return { ok: true, info: pw.ok + ' erfüllt, ' + pw.unbekannt + ' offen, Stufe „' + pw.stufe.label + '"' };
    },
  },
  {
    name: 'S1 · erfundene Art → als nicht bekannt gemeldet',
    lauf: () => {
      const r = { name: 'Zzz Fantasiekraut', latin: 'Zzzus fantasticus', confidence: 80, alternatives: [] };
      const pw = _gsScanPruefwerk(r, null);
      const a = pw.regeln.find(x => x.id === 'art');
      if (!a || a.zustand !== 'warn') return { ok: false, warum: 'nicht als unbekannt gemeldet: ' + (a && a.zustand) };
      return { ok: true, info: a.text.slice(0, 60) };
    },
  },
  {
    name: 'S4 · knapper Abstand zum Zweitbesten wird benannt',
    lauf: () => {
      const r = {
        name: 'Bärlauch', latin: 'Allium ursinum', confidence: 52, edible: true, toxicity: 0,
        alternatives: [{ name: 'Maiglöckchen', latin: 'Convallaria majalis', confidence: 48 }],
      };
      const pw = _gsScanPruefwerk(r, null);
      const a = pw.regeln.find(x => x.id === 'abstand');
      if (!a || a.zustand !== 'warn') return { ok: false, warum: '4 Punkte Abstand gelten als deutlich' };
      if (!/Maiglöckchen/.test(a.text)) return { ok: false, warum: 'nennt die zweite Möglichkeit nicht beim Namen' };
      return { ok: true, info: a.text.replace(/<[^>]+>/g, '').slice(0, 70) };
    },
  },
  {
    name: 'S4 · deutlicher Abstand meldet NICHTS',
    lauf: () => {
      const r = {
        name: 'Bärlauch', latin: 'Allium ursinum', confidence: 92, edible: true, toxicity: 0,
        alternatives: [{ name: 'Maiglöckchen', latin: 'Convallaria majalis', confidence: 20 }],
      };
      const pw = _gsScanPruefwerk(r, null);
      const a = pw.regeln.find(x => x.id === 'abstand');
      if (!a || a.zustand !== 'ok') return { ok: false, warum: '72 Punkte Abstand gelten als knapp' };
      return { ok: true, info: a.text };
    },
  },
  {
    name: 'S5 · dünne Bildgrundlage wird benannt, gute nicht',
    lauf: () => {
      const mach = q => _gsScanPruefwerk(
        { name: 'Bärlauch', latin: 'Allium ursinum', confidence: 90, toxicity: 0, alternatives: [] }, q
      ).regeln.find(x => x.id === 'grundlage');
      const schlecht = mach({ messbar: true, quality: 30, blur: 20, light: 40, warnings: [] });
      const gut = mach({ messbar: true, quality: 80, blur: 75, light: 85, warnings: [] });
      if (!schlecht || schlecht.zustand !== 'warn') return { ok: false, warum: 'Qualität 30 gilt als brauchbar' };
      if (!gut || gut.zustand !== 'ok') return { ok: false, warum: 'Qualität 80 gilt als dünn' };
      return { ok: true, info: '30 → Vorbehalt, 80 → in Ordnung' };
    },
  },
  {
    name: 'Anzeige · die gesehenen Merkmale stehen auf der Karte',
    lauf: () => {
      const r = {
        name: 'Bärlauch', latin: 'Allium ursinum', confidence: 92, edible: true, toxicity: 0,
        alternatives: [{ name: 'Maiglöckchen', latin: 'Convallaria majalis', confidence: 20 }],
        diagnostic_features: ['Breite Einzelblätter', 'Glänzend grün', 'Stiel direkt aus dem Boden'],
        next_photo_hint: 'Blattunterseite aus der Nähe',
      };
      showScanResult(r);
      const el = document.getElementById('scan-result');
      const txt = (el && el.textContent) || '';
      if (!/Das habe ich im Foto gesehen/.test(txt)) return { ok: false, warum: 'die Merkmals-Karte fehlt' };
      const fehlend = r.diagnostic_features.filter(m => txt.indexOf(m) < 0);
      if (fehlend.length) return { ok: false, warum: 'diese Merkmale fehlen: ' + fehlend.join(', ') };
      if (!/Blattunterseite/.test(txt)) return { ok: false, warum: 'der Hinweis auf das nächste Foto fehlt' };
      const li = el.querySelectorAll('.sr2-merkmale li');
      if (li.length !== 3) return { ok: false, warum: 'erwartet 3 Merkmale, gerendert ' + li.length };
      return { ok: true, info: li.length + ' Merkmale + Foto-Hinweis' };
    },
  },
  {
    name: 'Anzeige · ohne Merkmale wird nichts erfunden',
    lauf: () => {
      const r = { name: 'Bärlauch', latin: 'Allium ursinum', confidence: 92, edible: true, toxicity: 0, alternatives: [] };
      showScanResult(r);
      const el = document.getElementById('scan-result');
      const li = el.querySelectorAll('.sr2-merkmale li');
      if (li.length) return { ok: false, warum: 'zeigt ' + li.length + ' Merkmale, obwohl keine geliefert wurden' };
      const txt = (el && el.textContent) || '';
      if (/undefined|NaN|\[object Object\]/.test(txt)) return { ok: false, warum: 'Platzhalter im Text' };
      return { ok: true, info: 'keine Merkmale, keine erfundenen' };
    },
  },
  {
    name: 'Drei Zustände · ohne Artenliste ist nichts „in Ordnung"',
    lauf: () => {
      const echt = window.DB;
      window.DB = [];
      const pw = _gsScanPruefwerk({ name: 'Bärlauch', latin: 'Allium ursinum', confidence: 90, alternatives: [] }, null);
      window.DB = echt;
      const ok = pw.regeln.filter(x => x.zustand === 'ok');
      if (ok.length) return { ok: false, warum: 'meldet ' + ok.length + '× „erfüllt" ohne jede Datengrundlage: ' + ok.map(x => x.id).join(',') };
      if (pw.stufe && pw.stufe.schl === 'stark') return { ok: false, warum: 'Stufe „gut belegt" ohne Belege' };
      if (!pw.regeln.every(x => x.text && x.text.length > 10)) return { ok: false, warum: 'eine Regel nennt keinen Grund' };
      return { ok: true, info: pw.regeln.length + ' Regeln, alle mit Grund, Stufe „' + (pw.stufe && pw.stufe.label) + '"' };
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
    window.gsRequire = () => true;
    window.gsToast = () => {}; window.showProfileToast = () => {};
    window.gsScanStatusShow = () => {}; window.gsStopScanStatus = () => {};
    window.gsScanPersistToCloud = () => Promise.resolve(true);
    window.gsAddToScanHistory = () => {};
    window.gsHaptic = () => {};
  });

  console.log('\n=== scan_check — glaubt der Scanner der KI aufs Wort?');
  const da = await p.evaluate(() => (typeof DB !== 'undefined' && DB && DB.length) ? DB.length : 0);
  console.log('  Artenliste geladen: ' + da + ' Arten' + (da ? '' : '  ← ohne sie prueft dieser Stand nichts'));
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
  await br.close();
  process.exitCode = (kaputt || !da) ? 1 : 0;
})();
