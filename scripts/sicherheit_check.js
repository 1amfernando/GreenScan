#!/usr/bin/env node
// sicherheit_check.js — kommt Fremdes als TEXT an, ueber ALLE Wege?
//
//   node scripts/sicherheit_check.js            # alle Fall-Dateien
//   node scripts/sicherheit_check.js scan markt # nur Dateien, deren Name passt
//
// Anlass: die Sicherheitspruefung vom 10.11.2026 (27 Suchlaeufe ueber
// index.html, sw.js, die Edge-Functions, die Live-Datenbank und die
// Android-Huelle). escape_check (v32.66) deckt die Stellen aus dem Audit vom
// 06.09. — hier stehen die Wege, die seither niemand gerendert hat: die
// Pflanzenkarte mit einem Emoji aus der KI, der Scan-Verlauf, die Karte mit
// dem Fund eines FREMDEN, die Marktplatz-Galerie, gespeicherte Plaene, der
// Pflanzendoktor, Uebersetzungen aus der Datenbank, ein Backup aus fremder
// Hand, ein Link mit einem untergeschobenen Token.
//
// Bauform: die Faelle liegen als Module in scripts/sicherheit/*.js — je
// Themengruppe EINE Datei, damit mehrere Reparaturen nebeneinander entstehen
// koennen, ohne dieselbe Datei anzufassen. Jedes Modul exportiert
//
//   module.exports = [ { name: '…', lauf: async (seite, h) => ({ ok, info | warum }) }, … ]
//
// `seite` ist die geladene App (file://, Beispieldaten aus _seed.js, kein Netz),
// `h` traegt Hilfen:
//   h.BOESE        '<img src=x onerror="window.__pwned=1">'
//   h.OC           "x');window.__pwned=1;//"          (bricht einen '-JS-String)
//   h.OCQ          'x&#39;);window.__pwned=1;//'      (bricht ihn NACH dem HTML-Parser)
//   h.ATTR         '" onmouseover="window.__pwned=1'   (bricht ein "-Attribut)
//   h.warte(ms)    Promise
//   h.pwned()      liest window.__pwned (undefined = nichts lief) und setzt es zurueck
//   h.anfragen()   alle Adressen, die die Seite seit dem letzten Aufruf anfragen WOLLTE
//   h.frisch()     laedt die App neu (fuer Faelle, die den Zustand verbiegen)
//
// Regeln fuer jeden Fall (CLAUDE.md §4b, §7.1):
//   1. Er RENDERT die echte Funktion mit einem feindlichen Wert — keine Attrappe.
//   2. Er misst die WIRKUNG (window.__pwned, gestellte Anfragen, das DOM), nicht den Text.
//   3. Beide Richtungen: der feindliche Wert bleibt Text bzw. faellt weg, UND
//      der gutartige Wert rendert weiter (ein Escaper, der alles verschluckt,
//      waere sonst auch gruen).
//   4. `onerror` feuert erst, wenn das Bild wirklich fehlschlaegt — vor dem
//      Messen von __pwned warten (h.warte(350)).
//
// Grenze: geprueft ist der CLIENT. Was der Server annimmt (RLS, RPCs,
// Edge-Functions), pruefen rls_check / edge_check bzw. nur die lebende Datenbank.
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const SEED = require('./_seed.js');

const DIR = path.join(__dirname, 'sicherheit');
const filter = process.argv.slice(2);
const dateien = fs.existsSync(DIR)
  ? fs.readdirSync(DIR).filter(f => /\.js$/.test(f) && !/^_/.test(f)).sort()
      .filter(f => !filter.length || filter.some(w => f.indexOf(w) >= 0))
  : [];

(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 412, height: 915 } });
  let seite = null;
  const errs = [];
  let anfragen = [];
  async function laden() {
    if (seite) { try { await seite.close(); } catch (e) {} }
    seite = await ctx.newPage();
    seite.on('pageerror', e => errs.push(String(e.message).split('\n')[0]));
    seite.on('request', rq => { anfragen.push(rq.url()); });
    seite.on('dialog', d => { d.dismiss().catch(() => {}); });
    await seite.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
    await seite.addInitScript(SEED);
    // Die angemeldete Sitzung kommt seit v33.59 aus scripts/_seed.js (Token in JWT-Form,
    // uid, E-Mail) — vorher musste dieser Pruefstand sie selbst nachlegen, weil der Seed-Token
    // nach 500 ms abgeraeumt wurde.
    await seite.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await seite.waitForTimeout(4000);
    await seite.evaluate(() => {
      document.documentElement.classList.remove('gs-preauth');
      window.gsRequire = () => true;
      window.gsHaptic = () => {};
      delete window.__pwned;
    });
    anfragen = [];
    return seite;
  }
  const h = {
    BOESE: '<img src=x onerror="window.__pwned=1">',
    OC: "x');window.__pwned=1;//",
    OCQ: 'x&#39;);window.__pwned=1;//',
    ATTR: '" onmouseover="window.__pwned=1',
    warte: (ms) => new Promise(r => setTimeout(r, ms)),
    pwned: async () => seite.evaluate(() => { const v = window.__pwned; delete window.__pwned; return v === undefined ? null : v; }),
    anfragen: () => { const a = anfragen.filter(u => !u.startsWith('file:')); anfragen = []; return a; },
    frisch: async () => laden(),
    seite: () => seite,
  };

  console.log('\n=== sicherheit_check — kommt Fremdes als Text an, ueber alle Wege?');
  if (!dateien.length) { console.log('  keine Fall-Dateien in scripts/sicherheit/' + (filter.length ? ' fuer ' + filter.join(',') : '')); await br.close(); process.exitCode = filter.length ? 1 : 0; return; }
  await laden();
  let n = 0, kaputt = 0;
  for (const d of dateien) {
    let faelle;
    try { faelle = require(path.join(DIR, d)); }
    catch (e) { kaputt++; n++; console.log('  !!   ' + d + ' laesst sich nicht laden\n         → ' + String(e.message).split('\n')[0]); continue; }
    if (!Array.isArray(faelle)) { kaputt++; n++; console.log('  !!   ' + d + ' exportiert keine Liste'); continue; }
    console.log('  — ' + d + ' (' + faelle.length + ')');
    // Jede Fall-Datei beginnt mit einer FRISCH geladenen App. Die Dateien stammen
    // aus verschiedenen Haenden, und ein Fall, der window.sbFetch / callAI stellt
    // und nicht zuruecknimmt, faerbt sonst die naechste Datei: gemessen 10.11.2026 —
    // die Wissens-Suche „ohne Netz" bekam einen gestellten Server und wurde rot,
    // ohne dass am Code etwas falsch war (CLAUDE.md §7.1: wer einen Zustand
    // braucht, stellt ihn HER).
    if (d !== dateien[0]) await laden();
    for (const f of faelle) {
      n++;
      let r;
      try { r = await f.lauf(seite, h); } catch (e) { r = { ok: false, warum: 'Ausnahme: ' + String(e.message).split('\n')[0] }; }
      if (r && r.ok) console.log('  ok   ' + f.name + (r.info ? '   [' + r.info + ']' : ''));
      else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
      // Ein Fall, der Code ausgefuehrt hat, darf den naechsten nicht faerben.
      try { await seite.evaluate(() => { delete window.__pwned; }); } catch (e) { await laden(); }
    }
  }
  await br.close();
  console.log('  ---');
  console.log('  Faelle geprueft: ' + n + ' · davon kaputt: ' + kaputt + ' · Dateien: ' + dateien.length);
  console.log('  JS-Fehler waehrend der Pruefung: ' + (errs.length ? errs.length + ' (' + errs.slice(0, 3).join(' | ') + ')' : 'keine'));
  console.log('  Grenze: geprueft ist der Client mit gestellten Daten — was der Server annimmt,');
  console.log('  pruefen rls_check und edge_check bzw. nur die lebende Datenbank.');
  process.exitCode = kaputt ? 1 : 0;
})();
