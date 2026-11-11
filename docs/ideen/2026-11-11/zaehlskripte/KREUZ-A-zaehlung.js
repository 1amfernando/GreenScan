const __GS_WURZEL = require('path').resolve(__dirname, '..', '..', '..', '..');   // die Wurzel des Repos (nachgetragen am 11.11.2026: vorher ein fester Pfad der Arbeitsumgebung)
// KREUZ-A-zaehlung.js — Zaehlungen zu K3 „Rueckruf" und zum Befund „Verlaufs-Detail".
// Aufruf:  node docs/ideen/2026-11-11/zaehlskripte/KREUZ-A-zaehlung.js [repo]
// Liest nur data/plants.v1.js, schreibt nichts. Die Funktionen unten sind
// WOERTLICH aus index.html uebernommen (v33.58): deduplicateDB, _gsNormLat,
// _gsHatQualifier, _gsVorsichtigste (ohne die Laufzeit-Marken _unverified /
// _warning_tpl / _lookalike_tpl — die stehen nicht in der Datei).
const fs = require('fs'), vm = require('vm');
const REPO = process.argv[2] || __GS_WURZEL;
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(REPO + '/data/plants.v1.js', 'utf8'), ctx);
const DB = ctx.window.DB;
const roh = DB.length;

// deduplicateDB (von hinten; gleiche ID ODER gleicher Name + gleiches Latein)
(function () {
  const ids = new Set(), nl = new Set();
  for (let i = DB.length - 1; i >= 0; i--) {
    const e = DB[i];
    if (!e || !e.id || !e.name) { DB.splice(i, 1); continue; }
    const n = (e.name || '').trim().toLowerCase(), l = (e.lat || '').trim().toLowerCase(), k = n + '||' + l;
    const dn = (n.length > 1 && l.length > 3) && nl.has(k);
    if (ids.has(e.id) || dn) DB.splice(i, 1);
    else { ids.add(e.id); if (n.length > 1 && l.length > 3) nl.add(k); }
  }
})();

// Lade-Korrektur aus index.html („was nie geprueft wurde, soll es auch sagen"):
// giftige Eintraege mit dem generischen Satz bekommen _uses_korrigiert; Eintraege
// ohne warning UND ohne lookalike mit diesem Satz gelten als _unverified.
(function () {
  const SATZ = 'Junge Blätter, Blüten oder Samen je nach Art verwendbar';
  DB.forEach(function (s) {
    const giftig = (s.toxic === true) || (typeof s.tox === 'number' && s.tox >= 2);
    if (!giftig) return;
    if (String(s.uses || '').indexOf(SATZ) < 0) return;
    s._uses_korrigiert = true;
  });
  DB.forEach(function (s) {
    const leer = !String(s.warning || '').trim() && !String(s.lookalike || '').trim();
    if (!leer) return;
    if (String(s.uses || '').indexOf(SATZ) < 0 && !s._uses_korrigiert) return;
    s._unverified = true;
  });
})();

function normLat(s) {
  return String(s || '').toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(ssp|subsp|var|f|agg|cv|sp|spp)\.?\b/g, ' ')
    .replace(/[×x]\s/g, ' ')
    .replace(/[^a-zäöü ]/g, ' ')
    .replace(/ö/g, 'o').replace(/ä/g, 'a').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ').trim()
    .split(' ').slice(0, 2).join(' ');
}
function hatQ(sp) { return /\b(ssp|subsp|var|f|agg|cv)\.?\s/i.test(String((sp && sp.lat) || '') + ' '); }
function vorsichtigste(t) {
  if (!t || !t.length) return null;
  if (t.length === 1) return t[0];
  return t.slice().sort(function (a, b) {
    const ta = Number(a.tox) || 0, tb = Number(b.tox) || 0;
    if (tb !== ta) return tb - ta;
    const ua = a._unverified ? 1 : 0, ub = b._unverified ? 1 : 0;
    if (ua !== ub) return ua - ub;
    const wa = a.warning ? 1 : 0, la = a.lookalike ? 1 : 0, wb = b.warning ? 1 : 0, lb = b.lookalike ? 1 : 0;
    const ra = (wa || la) ? 1 : 0, rb = (wb || lb) ? 1 : 0;
    if (ra !== rb) return rb - ra;
    const fa = wa + la + (a.desc ? 1 : 0), fb = wb + lb + (b.desc ? 1 : 0);
    const ea = a.edible ? 1 : 0, eb = b.edible ? 1 : 0;
    if (ea !== eb) return ea - eb;
    return fb - fa;
  })[0];
}

// Index wie _gsLatIndex (Dateireihenfolge bleibt erhalten)
const idx = {};
for (const x of DB) { if (!x || !x.lat) continue; const k = normLat(x.lat); if (!k || k.indexOf(' ') < 0) continue; (idx[k] || (idx[k] = [])).push(x); }
// Gruppe einer Anfrage OHNE Qualifier (so kommt ein Scan-Latein in aller Regel an)
function gruppe(k) { const g = idx[k] || []; const reine = g.filter(x => !hatQ(x)); return reine.length ? reine : g; }
function heute(k) { return vorsichtigste(gruppe(k)); }

const arten = Object.keys(idx);
console.log('Eintraege roh:', roh, '· nach deduplicateDB:', DB.length, '· Arten (Binomen):', arten.length);

// ── Teil 1 · K3 „Rueckruf": wo sind sich die Eintraege EINER Art ueber die Schwelle 3 uneins? ──
let uneins = [], uneinsEssbar = [];
for (const k of arten) {
  const G = gruppe(k); if (G.length < 2) continue;
  const tx = G.map(x => Number(x.tox) || 0), mn = Math.min(...tx), mx = Math.max(...tx);
  if (mn < 3 && mx >= 3) { uneins.push(k); if (G.some(x => x.edible)) uneinsEssbar.push(k); }
}
console.log('Eintraege, die beim Laden als ungeprueft gelten:', DB.filter(x => x._unverified).length,
  '· davon mit tox >= 1:', DB.filter(x => x._unverified && (Number(x.tox) || 0) >= 1).length);
console.log('\n[K3] Arten, deren Eintraege (ohne Unterarten/Formen) ueber die Schwelle 3 uneins sind:', uneins.length);
let uneinsGeprueft = 0, heuteUngeprueft = 0;
for (const k of uneins) {
  const Gp = gruppe(k).filter(x => !x._unverified);
  const tx = Gp.map(x => Number(x.tox) || 0);
  if (Gp.length >= 2 && Math.min(...tx) < 3 && Math.max(...tx) >= 3) uneinsGeprueft++;
  if (heute(k)._unverified) heuteUngeprueft++;
}
console.log('[K3] davon uneins auch unter den GEPRUEFTEN Eintraegen allein:', uneinsGeprueft,
  '· der vorsichtigste Eintrag ist selbst ungeprueft:', heuteUngeprueft);
console.log('[K3] davon mit mindestens einem Eintrag „essbar":', uneinsEssbar.length);
for (const k of uneinsEssbar) {
  const g = idx[k];
  console.log('   ', k, '→ heute Stufe', heute(k).tox, '(' + heute(k).id + ')', '· Eintraege in Dateireihenfolge:',
    g.map(x => x.id + ':tox' + (Number(x.tox) || 0) + (x.edible ? '/essbar' : '') + (hatQ(x) ? '/QUALIFIER' : '')).join(' '));
}
// Fuer die Gegenprobe „erster Eintrag statt vorsichtigster": erster in Dateireihenfolge milder als die Art heute
const kand = uneins.filter(k => { const g = idx[k]; return !hatQ(g[0]) && (Number(g[0].tox) || 0) < 3; });
console.log('[K3] davon: der ERSTE Eintrag der Datei ist milder (< 3) als die Art heute (>= 3):', kand.length);
console.log('     Beispiele:', kand.slice(0, 12).map(k => k + ' [' + idx[k][0].id + ' ' + idx[k][0].name + ' tox' + (Number(idx[k][0].tox) || 0) + (idx[k][0].edible ? '/essbar' : '') + ' → ' + heute(k).id + ' tox' + heute(k).tox + ']').join(' · '));

// Zur Kontrolle: der Perlpilz. Die Form (f.) zaehlt bei einer Anfrage ohne Qualifier NICHT mit.
const pk = normLat('Amanita rubescens');
console.log('\n[K3] Amanita rubescens:', (idx[pk] || []).map(x => x.id + ' „' + x.lat + '" tox' + (Number(x.tox) || 0) + (x.edible ? '/essbar' : '') + (hatQ(x) ? ' QUALIFIER' : '')).join(' · '));
console.log('     heute (Anfrage ohne Qualifier): Stufe', heute(pk).tox, '(' + heute(pk).id + ')');

// ── Teil 2 · Befund „Verlaufs-Detail": openScanHistoryDetail sucht mit eigenem DB.find ──
//   sp = DB.find(s => name gleich ODER lat gleich)   — erster Treffer in Dateireihenfolge.
// Selbstabfrage wie in v32.43: jeder Eintrag als Verlaufszeile mit eigenem name + lat.
function histFind(name, latin) {
  const n = String(name || '').toLowerCase(), l = String(latin || '').toLowerCase();
  return DB.find(s => (s.name || '').toLowerCase() === n || (s.lat || '').toLowerCase() === l) || null;
}
let mit = 0, andereArt = 0, andererEintrag = 0, milder = 0, milderSchwelle = [], essbarStattNicht = 0;
let andereArtOhneFD = 0, essbarBeispiele = [];
for (const X of DB) {
  if (!X.name || !X.lat) continue; const kx = normLat(X.lat); if (!kx || kx.indexOf(' ') < 0) continue; mit++;
  const H = histFind(X.name, X.lat); if (!H) continue;
  if (H.id !== X.id) andererEintrag++;
  const kh = normLat(H.lat);
  if (kh !== kx) {
    andereArt++;
    if (!/^FD/.test(X.id)) andereArtOhneFD++;
    const tx = Number(heute(kx).tox) || 0, th = (kh && idx[kh]) ? (Number(heute(kh).tox) || 0) : (Number(H.tox) || 0);
    if (th < tx) milder++;
    if (tx >= 3 && th < 3) milderSchwelle.push(X.id + ' ' + X.name + ' / ' + X.lat + ' (heute ' + tx + ') → ' + H.id + ' ' + H.lat + ' (' + th + ')');
    const ex = !!heute(kx).edible, eh = (kh && idx[kh]) ? !!heute(kh).edible : !!H.edible;
    if (!ex && eh) { essbarStattNicht++; if (!/^FD/.test(X.id) && essbarBeispiele.length < 8) essbarBeispiele.push(X.id + ' ' + X.name + ' / ' + X.lat + ' (heute tox ' + tx + ', nicht essbar) → ' + H.id + ' ' + H.name + ' / ' + H.lat + ' (tox ' + th + ', essbar)'); }
  }
}
console.log('\n[Verlauf] Selbstabfrage ueber', mit, 'Eintraege mit Name + Binomen:');
console.log('   landet auf einem ANDEREN Eintrag:', andererEintrag);
console.log('   landet auf einer ANDEREN ART:', andereArt);
console.log('   davon die andere Art heute MILDER eingestuft:', milder);
console.log('   davon ueber die Schwelle (gemeinte Art >= 3, geoeffnete < 3):', milderSchwelle.length);
for (const z of milderSchwelle.slice(0, 15)) console.log('      ', z);
console.log('   davon gemeinte Art heute NICHT essbar, geoeffnete essbar:', essbarStattNicht);
for (const z of essbarBeispiele) console.log('      ', z);
console.log('   von den', andereArt, 'stammen NICHT aus der Buch-Einlese (Kennung ohne FD):', andereArtOhneFD);
const leerLat = DB.filter(s => !(s.lat || '').trim());
console.log('   Eintraege mit LEEREM lat (ein Verlaufseintrag ohne lateinischen Namen trifft den ersten davon):', leerLat.length,
  leerLat.slice(0, 3).map(s => s.id + ' ' + s.name).join(' · '));
