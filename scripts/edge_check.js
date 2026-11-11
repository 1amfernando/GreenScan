#!/usr/bin/env node
// edge_check.js — halten die Edge-Functions, was sie ueber ihre Tore sagen?
//
//   node scripts/edge_check.js             # alle Fall-Dateien
//   node scripts/edge_check.js stripe      # nur Dateien, deren Name passt
//
// Anlass: die Sicherheitspruefung vom 10.11.2026. Deno ist in dieser Umgebung
// nicht installiert, eine Edge-Function laeuft hier also nicht. Deshalb gilt
// dieselbe Aufteilung wie bei device-ingest (ingest_check) und sensor-push:
// was sich RECHNEN laesst (wer darf, welches Kontingent, welche Adresse,
// welcher Preis), steht in einem Modul unter supabase/functions/_shared/*.mjs
// — reines ESM, von Deno UND Node importierbar — und wird hier AUSGEFUEHRT;
// die index.ts ist nur der Rand darum, und der Rand wird am Quelltext geprueft
// (ruft er das Modul wirklich? vor der teuren Arbeit? liest er den Fehler?).
//
// Bauform wie sicherheit_check: die Faelle liegen als Module in
// scripts/edge/*.js, je Themengruppe EINE Datei:
//
//   module.exports = [ { name: '…', lauf: async (h) => ({ ok, info | warum }) }, … ]
//
// Hilfen in `h`:
//   h.lies('ai-proxy/index.ts')       Quelltext einer Datei unter supabase/functions/
//   h.ohneKommentare(text)            entfernt // … und /* … */ (Zeichenketten bleiben)
//   h.modul('_shared/x.mjs')          dynamischer Import eines ESM-Moduls (Promise)
//   h.functions()                     Liste der Function-Verzeichnisse
//   h.repo                            absoluter Pfad des Repos
//
// Regeln fuer jeden Fall: gut UND schlecht (eine Pruefung, die nur die
// Bejahung kennt, ist auch gruen, wenn das Tor fehlt); die Rechnung wird
// ausgefuehrt, nicht nachgebaut; eine Quelltext-Suche ankert an der FORM
// (Aufruf, nicht blosse Erwaehnung) und liest ohne Kommentare.
//
// Grenze: ob die AUSGELIEFERTE Function dem Repo entspricht, sagt nur die
// Auslieferung (docs/FUER-FERNANDO.md). Geprueft ist der Repo-Stand.
'use strict';
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const FN = path.join(REPO, 'supabase', 'functions');
const DIR = path.join(__dirname, 'edge');
const filter = process.argv.slice(2);
const dateien = fs.existsSync(DIR)
  ? fs.readdirSync(DIR).filter(f => /\.js$/.test(f) && !/^_/.test(f)).sort()
      .filter(f => !filter.length || filter.some(w => f.indexOf(w) >= 0))
  : [];

function ohneKommentare(src) {
  let out = '', i = 0, n = src.length, q = null;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (q) {
      out += c;
      if (c === '\\') { out += d === undefined ? '' : d; i += 2; continue; }
      if (c === q) q = null;
      i++; continue;
    }
    if (c === '"' || c === "'" || c === '`') { q = c; out += c; i++; continue; }
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') out += '\n'; i++; } i += 2; continue; }
    out += c; i++;
  }
  return out;
}

const h = {
  repo: REPO,
  lies: (rel) => fs.readFileSync(path.join(FN, rel), 'utf8'),
  gibtEs: (rel) => fs.existsSync(path.join(FN, rel)),
  ohneKommentare,
  modul: (rel) => import(pathToFileURL(path.join(FN, rel)).href),
  functions: () => fs.readdirSync(FN).filter(d => d !== '_shared' && fs.existsSync(path.join(FN, d, 'index.ts'))).sort(),
};

(async () => {
  console.log('\n=== edge_check — halten die Edge-Functions, was sie ueber ihre Tore sagen?');
  if (!dateien.length) { console.log('  keine Fall-Dateien in scripts/edge/' + (filter.length ? ' fuer ' + filter.join(',') : '')); process.exitCode = filter.length ? 1 : 0; return; }
  let n = 0, kaputt = 0;
  for (const d of dateien) {
    let faelle;
    try { faelle = require(path.join(DIR, d)); }
    catch (e) { kaputt++; n++; console.log('  !!   ' + d + ' laesst sich nicht laden\n         → ' + String(e.message).split('\n')[0]); continue; }
    if (!Array.isArray(faelle)) { kaputt++; n++; console.log('  !!   ' + d + ' exportiert keine Liste'); continue; }
    console.log('  — ' + d + ' (' + faelle.length + ')');
    for (const f of faelle) {
      n++;
      let r;
      try { r = await f.lauf(h); } catch (e) { r = { ok: false, warum: 'Ausnahme: ' + String(e && e.message || e).split('\n')[0] }; }
      if (r && r.ok) console.log('  ok   ' + f.name + (r.info ? '   [' + r.info + ']' : ''));
      else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
    }
  }
  console.log('  ---');
  console.log('  Faelle geprueft: ' + n + ' · davon kaputt: ' + kaputt + ' · Dateien: ' + dateien.length);
  console.log('  Grenze: geprueft ist der Repo-Stand (Rechnung ausgefuehrt, Rand am Quelltext) —');
  console.log('  ob die ausgelieferte Function ihm entspricht, sagt nur die Auslieferung.');
  process.exitCode = kaputt ? 1 : 0;
})();
