#!/usr/bin/env node
// rezept_link_check.js — zeigt ein Rezept auf die Art, die gemeint ist, und nie auf eine giftige? (seit v33.58)
//
//   node scripts/rezept_link_check.js                         # index.html + data/plants.v1.js des Repos
//   node scripts/rezept_link_check.js <index.html> <plants.js> [--verbose]
//
// Anlass (Wochenplan KW45/2026, P0 3): die Verknuepfung Rezept → Art lief ueber eine
// Namens-Teilsuche. Gemessen an v33.56: 524 Eintraege, bei 239 zeigte der Link auf eine
// andere Art als die Hauptzutat, bei 84 auf eine als giftig gefuehrte, 17 davon mit
// Giftstufe >= 3 (Pfifferling-Rahmsauce → Maigloeckchen, Morchel → Herbstzeitlose).
// Gegen v33.56 meldet dieser Pruefstand 699 Verstoesse, gegen v33.58 keinen.
//
// Exit 0 = alles gut, Exit 1 = Verstoss gefunden, Exit 2 = Dateien nicht lesbar.
// Geprueft wird jedes Rezept aus DEFAULT_RECIPES und DEFAULT_REMEDIES:
//   • Rezept-Ids eindeutig
//   • plantIds vorhanden (sonst laeuft die Verknuepfung ueber Name/Alt-plantId) –
//     in dem Fall wird das Alt-Ziel (plantId) auf Giftigkeit geprueft
//   • jede plantId existiert in der Artenliste
//   • Lebensmittel-Rezept: Ziel nicht giftig (toxic===true / tox>=3, auch nicht
//     ueber einen anderen Eintrag derselben Art) und edible===true
//   • Heilmittel zum Einnehmen (type 'remedies'): Ziel nicht giftig
//   • aeusserliche Anwendung (type 'remedy'): Ziel tox<3
//   • aeusserliche Anwendungen (Salbe, Kompresse, Bad …) nicht als Lebensmittel gefuehrt
//   • Code: keine Namens-Verknuepfung mehr, Sperrfunktion vorhanden
//
// Grenze: er prueft, dass ein Link auf keine giftige und auf eine essbare Art zeigt — ob es
// die botanisch GEMEINTE Art ist, sagt nur die Zuordnungstabelle im Quelltext (plantIds),
// und die hat ein Mensch mit einer Flora zu bestaetigen.
'use strict';
const fs = require('fs');
const vm = require('vm');

const argv = process.argv.slice(2);
const verbose = argv.includes('--verbose');
const files = argv.filter(a => !a.startsWith('--'));
// Ohne Angabe: die zwei Dateien des Repos — aufgeloest aus dem Ort dieses Skripts, nie aus
// einer Maschine (CLAUDE.md §7.1, field_check: 32 von 32 CI-Laeufen rot an einem festen Pfad).
if (files.length === 0) {
  const pfad = require('path');
  files.push(pfad.join(__dirname, '..', 'index.html'), pfad.join(__dirname, '..', 'data', 'plants.v1.js'));
}
if (files.length < 2) {
  console.error('Aufruf: node scripts/rezept_link_check.js [<index.html> <plants.js>] [--verbose]');
  process.exit(2);
}
let html, plantsSrc;
try {
  html = fs.readFileSync(files[0], 'utf8');
  plantsSrc = fs.readFileSync(files[1], 'utf8');
} catch (e) { console.error('Datei nicht lesbar: ' + e.message); process.exit(2); }

// ---- DB laden
const sandbox = { window: {} };
try { vm.runInNewContext(plantsSrc, sandbox, { filename: files[1] }); } catch (e) { console.error('plants.js nicht ausführbar: ' + e.message); process.exit(2); }
const DB = Array.isArray(sandbox.window.DB) ? sandbox.window.DB : (Array.isArray(sandbox.DB) ? sandbox.DB : null);
if (!DB || !DB.length) { console.error('window.DB leer/fehlt in ' + files[1]); process.exit(2); }
const byId = new Map(DB.map(s => [s.id, s]));

// ---- Rezept-Arrays aus index.html extrahieren (string-/kommentar-bewusst)
function arrayLiteral(src, decl) {
  const k = src.indexOf(decl);
  if (k < 0 || src.indexOf(decl, k + 1) >= 0) throw new Error('"' + decl + '" nicht genau einmal gefunden');
  let i = src.indexOf('[', k), depth = 0;
  const start = i;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      const q = c; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
    } else if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; }
    else if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 1; }
    else if (c === '[' || c === '{' || c === '(') depth++;
    else if (c === ']' || c === '}' || c === ')') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error('Ende von ' + decl + ' nicht gefunden');
}
let RECIPES, REMEDIES;
try {
  RECIPES = vm.runInNewContext('(' + arrayLiteral(html, 'const DEFAULT_RECIPES = [') + ')');
  REMEDIES = vm.runInNewContext('(' + arrayLiteral(html, 'const DEFAULT_REMEDIES = [') + ')');
} catch (e) { console.error('Rezepte nicht lesbar: ' + e.message); process.exit(2); }

// ---- Regeln (identisch zur Laufzeit-Sperre in index.html)
const binom = lat => {
  let n = String(lat || '').toLowerCase().replace(/×/g, 'x').replace(/\s+/g, ' ').trim();
  if (n.indexOf('rosmarinus officinalis') === 0) n = 'salvia rosmarinus';
  return n.replace(/ x /, ' ').split(' ').slice(0, 2).join(' ');
};
const entryUnsafe = s => !!s && (s.toxic === true || (Number(s.tox) || 0) >= 3);
const unsafeBinom = new Set(DB.filter(s => s && s.lat && entryUnsafe(s)).map(s => binom(s.lat)));
const speciesUnsafe = s => entryUnsafe(s) || (!!s.lat && unsafeBinom.has(binom(s.lat)));
const kindOf = r => r.type === 'remedy' ? 'remedy' : (r.type === 'remedies' ? 'remedy-internal' : 'food');
const desc = s => s.id + ' ' + s.name + ' (' + (s.lat || '?') + ', tox=' + s.tox + (s.toxic ? ', toxic' : '') + (s.edible ? '' : ', nicht essbar') + ')';
const EXTERNAL_RE = /salbe(?!i)|kompresse|umschlag|fussbad|vollbad|dampfbad|augenbad|babybad|-bad\b|\bbad\b|inhalation|gesichts|massageöl|massage-öl|wund|einreib|äusserlich|haarspül|kissen|bade-öl|rotöl/i;

const errors = {};
const add = (cat, msg) => { (errors[cat] = errors[cat] || []).push(msg); };

const all = RECIPES.map((r, i) => ({ r, where: 'DEFAULT_RECIPES[' + i + ']' }))
  .concat(REMEDIES.map((r, i) => ({ r, where: 'DEFAULT_REMEDIES[' + i + ']' })));

// IDs eindeutig
const idCount = new Map();
all.forEach(({ r }) => idCount.set(r.id, (idCount.get(r.id) || 0) + 1));
for (const [id, n] of idCount) if (n > 1) add('ID doppelt', id + ' (' + n + '×)');

let foodN = 0, remIntN = 0, remExtN = 0, linked = 0;
all.forEach(({ r, where }) => {
  const kind = kindOf(r);
  if (kind === 'food') foodN++; else if (kind === 'remedy') remExtN++; else remIntN++;
  const tag = r.id + ' «' + r.title + '» [' + where + ', ' + kind + ']';
  if (kind === 'food' && EXTERNAL_RE.test(r.title || '')) add('äusserliche Anwendung als Lebensmittel', tag);
  if (!Array.isArray(r.plantIds)) {
    add('plantIds fehlt (Verknüpfung über Name/Alt-plantId)', tag);
    // Alt-Ziel prüfen: das hat die alte Logik geöffnet
    const old = byId.get(r.plantId);
    if (old && kind !== 'remedy' && speciesUnsafe(old)) add(entryUnsafe(old) && (Number(old.tox) || 0) >= 3 ? 'GIFTLINK tox>=3 (Alt-plantId)' : 'Giftlink toxic (Alt-plantId)', tag + ' → ' + desc(old));
    else if (old && kind === 'food' && old.edible !== true) add('Ziel nicht essbar (Alt-plantId)', tag + ' → ' + desc(old));
    else if (old && kind === 'remedy' && (Number(old.tox) || 0) >= 3) add('GIFTLINK tox>=3 (Alt-plantId)', tag + ' → ' + desc(old));
    else if (r.plantId && !old) add('Ziel-ID existiert nicht (Alt-plantId)', tag + ' → ' + r.plantId);
    return;
  }
  if (r.plantIds.length) linked++;
  const blocked = Array.isArray(r.plantIdsBlocked) ? r.plantIdsBlocked : [];
  r.plantIds.forEach(pid => {
    const s = byId.get(pid);
    if (!s) { add('Ziel-ID existiert nicht', tag + ' → ' + pid); return; }
    if (blocked.includes(pid)) add('ID zugleich verlinkt und gesperrt', tag + ' → ' + pid);
    if (kind === 'remedy') {
      if ((Number(s.tox) || 0) >= 3) add('GIFTLINK tox>=3', tag + ' → ' + desc(s));
    } else {
      if (speciesUnsafe(s)) add((Number(s.tox) || 0) >= 3 ? 'GIFTLINK tox>=3' : 'Giftlink toxic', tag + ' → ' + desc(s));
      if (kind === 'food' && s.edible !== true) add('Ziel nicht essbar', tag + ' → ' + desc(s));
    }
  });
  if (r.plantId && r.plantIds.length && r.plantId !== r.plantIds[0]) add('Alt-plantId ≠ plantIds[0]', tag + ' → ' + r.plantId);
  if (r.plantId && !r.plantIds.length) add('Alt-plantId gesetzt ohne geprüfte plantIds', tag + ' → ' + r.plantId);
});

// Code-Prüfungen: Verknüpfung nur per ID + Sperre vorhanden
const codeRules = [
  [!/function _gsRecipeTargetAllowed\s*\(/.test(html), 'Sperrfunktion _gsRecipeTargetAllowed fehlt'],
  [/GS_ING_LINK_MAP/.test(html), 'Namens-Verknüpfung GS_ING_LINK_MAP noch vorhanden'],
  [/inp\.value\s*=\s*plantId;\s*doSearch\(\)/.test(html), '_openPlantFromRecipe fällt noch auf Textsuche zurück'],
  [/r\.plant\s*===\s*sp\.name/.test(html), 'Rezepte-Button der Artansicht vergleicht noch Namen'],
  [/onclick="_openPlantFromRecipe\(/.test(html), 'inline onclick für Rezept→Art im generierten HTML'],
];
codeRules.forEach(([bad, msg]) => { if (bad) add('Code', msg); });

// ---- Ausgabe
const cats = Object.keys(errors);
const total = cats.reduce((n, c) => n + errors[c].length, 0);
console.log('Rezept-Link-Check: ' + all.length + ' Einträge (Lebensmittel ' + foodN + ', Heilmittel innerlich ' + remIntN + ', äusserlich ' + remExtN + '), mit Art-Link: ' + linked + ', DB: ' + DB.length + ' Arten');
if (!total) { console.log('OK – keine Fehler.'); process.exit(0); }
const always = /GIFT|Giftlink|Code|doppelt/;
cats.sort((a, b) => (always.test(b) ? 1 : 0) - (always.test(a) ? 1 : 0));
for (const c of cats) {
  const list = errors[c];
  console.log('\n✗ ' + c + ': ' + list.length);
  const show = (verbose || always.test(c)) ? list : list.slice(0, 5);
  show.forEach(m => console.log('   - ' + m));
  if (show.length < list.length) console.log('   … ' + (list.length - show.length) + ' weitere (--verbose)');
}
console.log('\nFEHLER: ' + total);
process.exit(1);
