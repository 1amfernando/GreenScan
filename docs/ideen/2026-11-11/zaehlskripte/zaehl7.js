// Messung mit den ECHTEN App-Funktionen: Saison, Hoehenband, Verwechsler-Graph (nur lesen)
const vm = require('vm'); const H = require('./harness.js'); const ctx = H.laden();
// Memo um _gsLinaNorm (aendert nichts an der Semantik, nur an der Laufzeit)
vm.runInContext('var __o = _gsLinaNorm, __m = new Map(); _gsLinaNorm = function (t) { var k = String(t == null ? "" : t); var v = __m.get(k); if (v === undefined) { v = __o(k); __m.set(k, v); } return v; };', ctx);
const DB = ctx.DB;
const cats = [...new Set(DB.map(e => e.cat))];
const mon = e => ctx.gsSaisonMonate(e.season);
const band = e => ctx._gsHoehenband(e);
console.log('A/B · Saison lesbar (gsSaisonMonate) und Hoehenband lesbar (_gsHoehenband), je Kategorie:');
cats.forEach(c => { const L = DB.filter(e => e.cat === c); const a = L.filter(e => (mon(e) || []).length).length, b = L.filter(e => band(e)).length, ab = L.filter(e => (mon(e) || []).length && band(e)).length;
  console.log('  ', c.padEnd(12), String(L.length).padStart(5), '· Saison', String(a).padStart(4), (Math.round(100 * a / L.length) + '%').padStart(5), '· Hoehe', String(b).padStart(4), (Math.round(100 * b / L.length) + '%').padStart(5), '· beides', String(ab).padStart(4), (Math.round(100 * ab / L.length) + '%').padStart(5)); });
const A = DB.filter(e => (mon(e) || []).length).length, B = DB.filter(e => band(e)).length, AB = DB.filter(e => (mon(e) || []).length && band(e)).length;
console.log('   GESAMT       ', DB.length, '· Saison', A, Math.round(100 * A / DB.length) + '%', '· Hoehe', B, Math.round(100 * B / DB.length) + '%', '· beides', AB, Math.round(100 * AB / DB.length) + '%');
const ganz = DB.filter(e => (mon(e) || []).length === 12).length;
console.log('   davon Saison = alle 12 Monate (ganzjaehrig, sagt nichts ueber "jetzt"):', ganz, '→ Saison mit echtem Fenster:', A - ganz, Math.round(100 * (A - ganz) / DB.length) + '%');
cats.forEach(c => { const L = DB.filter(e => e.cat === c); const f = L.filter(e => { const m = mon(e) || []; return m.length > 0 && m.length < 12; }).length; console.log('     ', c.padEnd(12), 'echtes Fenster:', f, Math.round(100 * f / L.length) + '%'); });
// C · Verwechsler-Graph ueber _gsArtenTreffer
const t0 = Date.now(); const memo = new Map();
const tr = txt => { let v = memo.get(txt); if (!v) { v = ctx._gsArtenTreffer(txt); memo.set(txt, v); } return v; };
let mitText = 0, mitTreffer = 0, kanten = 0; const gef = [], alle = [];
const essbarB = new Set(), essbarMitGef = new Set(), binMitTreffer = new Set();
DB.forEach(e => {
  const an = ctx._gsArtAnzeige(e);
  const key = ctx._gsNormLat(e.lat);
  if (an.edible && !e._unverified) essbarB.add(key);
  const t = String(e.lookalike || '').trim();
  if (!t || t === '–') return; mitText++;
  const r = tr(t); if (!r.zahl) return;
  const ziele = r.arten.filter(a => ctx._gsNormLat(a.lat) !== key);
  if (!ziele.length) return;
  mitTreffer++; binMitTreffer.add(key);
  ziele.forEach(z => { kanten++; alle.push({ von: e, zu: z }); if (an.edible && z.tox >= 3) { gef.push({ von: e, zu: z }); essbarMitGef.add(key); } });
});
console.log('\nC · Verwechsler ueber _gsArtenTreffer(lookalike) —', Math.round((Date.now() - t0) / 1000), 's,', memo.size, 'verschiedene Texte');
console.log('   Eintraege mit lookalike-Text:', mitText, '· mit >=1 aufgeloester ANDERER Art:', mitTreffer, '(' + Math.round(100 * mitTreffer / mitText) + '% derer mit Text, ' + Math.round(100 * mitTreffer / DB.length) + '% der Liste)');
console.log('   Binome mit aufgeloestem Verwechsler:', binMitTreffer.size);
console.log('   Kanten (Eintrag → Art):', kanten, '· davon essbarer Eintrag → Art mit tox>=3:', gef.length);
console.log('   essbare Binome (nach _gsArtAnzeige):', essbarB.size, '· davon mit aufgeloestem giftigem Verwechsler (tox>=3):', essbarMitGef.size, '(' + Math.round(100 * essbarMitGef.size / essbarB.size) + '%)');
const gk = {}; gef.forEach(k => { gk[k.von.cat] = (gk[k.von.cat] || 0) + 1; }); console.log('   gefaehrliche Kanten nach Kategorie:', gk);
// D · Saison-Ueberschneidung essbar × giftiger Verwechsler
const byLat = new Map(); DB.forEach(e => { const k = ctx._gsNormLat(e.lat); if (!byLat.has(k)) byLat.set(k, []); byLat.get(k).push(e); });
const monArt = lat => { const s = new Set(); (byLat.get(ctx._gsNormLat(lat)) || []).forEach(e => (mon(e) || []).forEach(m => s.add(m))); return s; };
const bandArt = lat => { for (const e of (byLat.get(ctx._gsNormLat(lat)) || [])) { const b = band(e); if (b) return b; } return null; };
let beideSaison = 0, ueberlappt = 0, keineUeb = 0, beideHoehe = 0; const paarSet = new Set(); const bsp = [];
gef.forEach(k => { const pk = ctx._gsNormLat(k.von.lat) + '→' + ctx._gsNormLat(k.zu.lat); if (paarSet.has(pk)) return; paarSet.add(pk);
  const a = monArt(k.von.lat), b = monArt(k.zu.lat);
  if (a.size && b.size && a.size < 12 && b.size < 12) { beideSaison++; const u = [...a].filter(m => b.has(m)); if (u.length) { ueberlappt++; if (bsp.length < 10) bsp.push(k.von.name + ' × ' + k.zu.name + ' (tox ' + k.zu.tox + '): gemeinsame Monate ' + u.map(m => m + 1).join(',')); } else keineUeb++; }
  if (bandArt(k.von.lat) && bandArt(k.zu.lat)) beideHoehe++; });
console.log('\nD · gefaehrliche Paare (Binom → Binom):', paarSet.size, '· beide mit echtem Saisonfenster:', beideSaison, '· davon ueberlappend:', ueberlappt, '· ohne Ueberlappung:', keineUeb, '· beide mit Hoehenband:', beideHoehe);
console.log('   Beispiele:', bsp.join(' | '));
require('fs').writeFileSync(__dirname + '/gef.json', JSON.stringify(gef.map(k => ({ von: k.von.id, vonName: k.von.name, vonLat: k.von.lat, cat: k.von.cat, zu: k.zu.name, zuLat: k.zu.lat, tox: k.zu.tox }))));
