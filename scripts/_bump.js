#!/usr/bin/env node
// scripts/_bump.js — die Versionsnummer einer Scheibe setzen oder umnummerieren, als SKRIPT statt
// Handarbeit (docs/WARTESCHLANGE.md §1 Punkt 6; CLAUDE.md §3.1). Ein Helfer, kein Pruefstand (`_`).
//
//   node scripts/_bump.js --von v33.70 --nach v33.71 [--kennung jr:ju] [--datum 2026-11-24]
//                         [--basis origin/main] [--trocken]
//
// Was es tut, in dieser Reihenfolge:
//   1. Sicherung: `--von` und die alte Kennung duerfen auf `--basis` (Vorgabe origin/main) NICHT
//      vorkommen — sonst gehoeren Nennungen einem anderen und das Skript bricht ab. Eine Nummer,
//      die die Basis schon traegt, nummeriert man nicht blind um.
//   2. Jede versionierte Textdatei (git ls-files) ausser den Brett-Eintraegen (docs/austausch/
//      eintraege — ein Eintrag wird nie umgeschrieben) und dem Changelog-Archiv: `vA.B` → neu
//      (nur ganze Nummern: v33.70 trifft nicht v33.701), `gs-vA.B`, die Kennung `(alt)` → `(neu)`.
//   3. `<meta name="app-version" content="A.B.JJJJMMTT">` bekommt Nummer UND Datum.
//   4. Inline-Changelog auf den Deckel (20): die aeltesten wandern an den ANFANG von
//      data/releases.v1.js (CLAUDE.md §3.1), keine Dublette.
//   5. Pruefen: GS_VERSION === GS_RELEASES[0].v === 'v' + meta === sw.js VERSION ohne „gs-".
// `--trocken` zaehlt nur und schreibt nichts.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const W = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (n, vorgabe) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : vorgabe; };
const TROCKEN = args.includes('--trocken');
const VON = opt('von'), NACH = opt('nach');
const KENNUNG = opt('kennung', '');
const BASIS = opt('basis', 'origin/main');
const heute = new Date();
const DATUM = (opt('datum', heute.toISOString().slice(0, 10)) || '').replace(/-/g, '');   // bewusst UTC: ein Stempel, kein Kalendertag
const DECKEL = 20;

function stirb(m) { console.error('!! ' + m); process.exit(1); }
if (!/^v\d+\.\d+$/.test(VON || '') || !/^v\d+\.\d+$/.test(NACH || '')) stirb('--von und --nach als vA.B angeben');
if (!/^\d{8}$/.test(DATUM)) stirb('--datum als JJJJ-MM-TT');
const [kAlt, kNeu] = KENNUNG ? KENNUNG.split(':') : ['', ''];
if (KENNUNG && (!/^[a-z]{1,3}$/.test(kAlt) || !/^[a-z]{1,3}$/.test(kNeu))) stirb('--kennung alt:neu, z. B. jr:ju');

const git = (...a) => execFileSync('git', a, { cwd: W, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const reVon = new RegExp('(?<![\\d.])' + esc(VON) + '(?![\\d])', 'g');
const reKen = kAlt ? new RegExp('\\(' + esc(kAlt) + '\\)', 'g') : null;
const nurZahl = (v) => v.slice(1);

// 1 · Gehoert die alte Nummer schon einem anderen?
function aufBasis(text, re) {
  let zeilen = [];
  try { zeilen = git('grep', '-n', '-F', text, BASIS, '--', '.').split('\n').filter(Boolean); }
  catch (e) { zeilen = []; }   // git grep endet mit 1, wenn nichts gefunden wurde
  return zeilen.filter(z => { re.lastIndex = 0; return re.test(z); });
}
const fremd = aufBasis(VON, new RegExp(reVon.source)).concat(kAlt ? aufBasis('(' + kAlt + ')', new RegExp(reKen.source)) : []);
if (fremd.length) stirb(BASIS + ' traegt ' + VON + (kAlt ? ' bzw. (' + kAlt + ')' : '') + ' schon (' + fremd.length + ' Stellen, z. B. ' + fremd[0].slice(0, 120) + ') — nicht blind umnummerieren');

// 2 · Ersetzen
const AUS = [/^docs\/austausch\/eintraege\//, /^data\/releases\.v1\.js$/, /(^|\/)node_modules\//, /^scripts\/_bump\.js$/];
const dateien = git('ls-files').split('\n').filter(Boolean).filter(f => !AUS.some(r => r.test(f)));
let nV = 0, nK = 0; const geaendert = [];
for (const f of dateien) {
  const p = path.join(W, f);
  let buf;
  try { buf = fs.readFileSync(p); } catch (_) { continue; }
  if (buf.includes(0)) continue;                        // binaer
  const s = buf.toString('utf8');
  let t = s.replace(reVon, () => { nV++; return NACH; });
  if (reKen) t = t.replace(reKen, () => { nK++; return '(' + kNeu + ')'; });
  if (t !== s) { geaendert.push(f); if (!TROCKEN) fs.writeFileSync(p, t); }
}

// 3 · meta app-version mit Datum
const IDX = path.join(W, 'index.html');
let idx = fs.readFileSync(IDX, 'utf8');
const metaRe = /<meta name="app-version" content="(\d+\.\d+)\.(\d{8})">/;
if (!metaRe.test(idx)) stirb('meta app-version nicht gefunden');
idx = idx.replace(metaRe, '<meta name="app-version" content="' + nurZahl(NACH) + '.' + DATUM + '">');

// 4 · Deckel des Inline-Changelogs
const ARCH = path.join(W, 'data', 'releases.v1.js');
let arch = fs.readFileSync(ARCH, 'utf8');
const lade = (quelle, name) => { const w = {}; new Function('window', quelle)(w); return w[name]; };
const kopfRe = 'window.GS_RELEASES = [';
let verschoben = [];
for (;;) {
  const a = idx.indexOf(kopfRe); const ende = idx.indexOf('\n];', a);
  if (a < 0 || ende < 0) stirb('window.GS_RELEASES nicht gefunden');
  const liste = lade(idx.slice(a, ende + 3), 'GS_RELEASES');
  if (liste.length <= DECKEL) break;
  const letzte = liste[liste.length - 1].v;
  const i = idx.indexOf("    v: '" + letzte + "'", a);
  const start = idx.lastIndexOf('\n  {\n', i);
  if (i < 0 || start < a) stirb('aeltesten Eintrag ' + letzte + ' nicht sauber gefunden');
  let eintrag = idx.slice(start + 1, ende).replace(/\s+$/, '');
  if (!eintrag.endsWith(',')) eintrag += ',';
  const archListe = lade(arch, 'GS_RELEASES_ARCHIVE');
  if (archListe.some(x => x.v === letzte)) stirb(letzte + ' steht schon im Archiv — Dublette');
  idx = idx.slice(0, start) + idx.slice(ende);
  const k = arch.indexOf('window.GS_RELEASES_ARCHIVE = [\n') + 'window.GS_RELEASES_ARCHIVE = [\n'.length;
  arch = arch.slice(0, k) + eintrag + '\n' + arch.slice(k);
  verschoben.push(letzte);
}
if (!TROCKEN) { fs.writeFileSync(IDX, idx); fs.writeFileSync(ARCH, arch); }

// 5 · Pruefen
const pruef = TROCKEN ? null : (() => {
  const h = fs.readFileSync(IDX, 'utf8');
  const gv = (h.match(/var GS_VERSION = '(v[\d.]+)'/) || [])[1];
  const meta = (h.match(metaRe) || [])[1];
  const a = h.indexOf(kopfRe), e = h.indexOf('\n];', a);
  const r0 = lade(h.slice(a, e + 3), 'GS_RELEASES')[0].v;
  const sw = (fs.readFileSync(path.join(W, 'sw.js'), 'utf8').match(/const VERSION = 'gs-(v[\d.]+)'/) || [])[1];
  return { gv, meta: 'v' + meta, r0, sw };
})();
console.log((TROCKEN ? '(trocken) ' : '') + VON + ' → ' + NACH + ': ' + nV + ' Nennungen' + (kAlt ? ' · (' + kAlt + ') → (' + kNeu + '): ' + nK : '') + ' · ' + geaendert.length + ' Dateien · meta ' + nurZahl(NACH) + '.' + DATUM + (verschoben.length ? ' · ins Archiv: ' + verschoben.join(', ') : ''));
if (pruef) {
  const gleich = [pruef.gv, pruef.meta, pruef.r0, pruef.sw].every(x => x === NACH);
  console.log('  GS_VERSION ' + pruef.gv + ' · meta ' + pruef.meta + ' · GS_RELEASES[0] ' + pruef.r0 + ' · sw.js ' + pruef.sw + (gleich ? ' — passt' : ' — PASST NICHT'));
  if (!gleich) process.exit(1);
}
