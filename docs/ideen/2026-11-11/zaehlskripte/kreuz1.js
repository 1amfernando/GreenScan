// Runde 2: Nachzaehlen der Felder, auf denen die Ideen von A und B stehen (nur lesen)
const vm = require('vm'); const H = require('./harness.js'); const ctx = H.laden(); const DB = ctx.DB;
vm.runInContext('var __o = _gsLinaNorm, __m = new Map(); _gsLinaNorm = function (t) { var k = String(t == null ? "" : t); var v = __m.get(k); if (v === undefined) { v = __o(k); __m.set(k, v); } return v; };', ctx);
const d = require('./plantdb.json'); ctx.PLANT_DB = d.PLANT_DB; ctx.GS_SAE_DB = d.SAE;
vm.runInContext(H.fn('_gsKulturZuPflanze'), ctx);
vm.runInContext(H.va('_GS_SAE_BRUECKE', '{', '}'), ctx); vm.runInContext(H.fn('_gsSaeNorm'), ctx); vm.runInContext(H.fn('_gsSaeZuPflanze'), ctx);
const N = s => ctx._gsNormLat(s || '');
// (1) _unverified wie beim Laden (IIFE in index.html nachgebildet: SATZ + weder warning noch lookalike)
const SATZ = 'Junge Blätter, Blüten oder Samen je nach Art verwendbar';
let unv = 0; DB.forEach(s => { const giftig = (s.toxic === true) || (typeof s.tox === 'number' && s.tox >= 2); const leer = !String(s.warning || '').trim() && !String(s.lookalike || '').trim(); if (leer && String(s.uses || '').indexOf(SATZ) >= 0) { s._unverified = true; unv++; } });
const U = DB.filter(s => s._unverified);
console.log('(1) _unverified beim Laden:', unv, '· davon tox 0:', U.filter(s => !s.tox).length, '· tox>=1:', U.filter(s => s.tox >= 1).length, '· edible:true:', U.filter(s => s.edible).length);
const cats = [...new Set(DB.map(e => e.cat))];
console.log('    je Kategorie:', cats.map(c => c + ' ' + U.filter(s => s.cat === c).length).join(' · '));
const t0 = DB.filter(s => !s.tox); console.log('    tox 0 gesamt:', t0.length, '· davon ungeprueft:', t0.filter(s => s._unverified).length, '(' + Math.round(100 * t0.filter(s => s._unverified).length / t0.length) + '%) · geprueft:', t0.filter(s => !s._unverified).length);
const hp = DB.filter(s => s.cat === 'hauspflanze'); console.log('    hauspflanze:', hp.length, '· tox>=1:', hp.filter(s => s.tox >= 1).length, '· tox>=3:', hp.filter(s => s.tox >= 3).length, '· ungeprueft:', hp.filter(s => s._unverified).length, '· warning beginnt mit Keine/Kein:', hp.filter(s => /^(keine|kein|nein|none|no\b|unbedenklich)/i.test(String(s.warning || '').trim())).length);
// (2) Verwechsler drei Zustaende je Kategorie; essbare ohne jeden lookalike-Text
const memo = new Map(); const tr = t => { let v = memo.get(t); if (!v) { v = ctx._gsArtenTreffer(t); memo.set(t, v); } return v; };
console.log('(2) lookalike drei Zustaende je Kategorie (verletzt = aufgeloeste andere Art tox>=3 · erfuellt = aufgeloest, keine giftig · nicht pruefbar = Text ohne Art · ohne Text):');
cats.forEach(c => { let v = 0, e = 0, n = 0, o = 0; DB.filter(s => s.cat === c).forEach(s => { const t = String(s.lookalike || '').trim(); if (!t || t === '–') { o++; return; } const z = tr(t).arten.filter(a => N(a.lat) !== N(s.lat)); if (!z.length) n++; else if (z.some(a => a.tox >= 3)) v++; else e++; }); console.log('    ', c.padEnd(12), 'verletzt', String(v).padStart(4), '· erfuellt', String(e).padStart(4), '· nicht pruefbar', String(n).padStart(4), '· ohne Text', String(o).padStart(4)); });
const ess = DB.filter(s => ctx._gsArtAnzeige(s).edible);
const essOhne = ess.filter(s => { const t = String(s.lookalike || '').trim(); return !t || t === '–'; });
const essNP = ess.filter(s => { const t = String(s.lookalike || '').trim(); if (!t || t === '–') return false; return !tr(t).arten.filter(a => N(a.lat) !== N(s.lat)).length; });
const essPilz = ess.filter(s => s.cat === 'pilz');
console.log('    essbare Eintraege (nach _gsArtAnzeige):', ess.length, '· ohne jeden Verwechsler-Text:', essOhne.length, '(davon ungeprueft:', essOhne.filter(s => s._unverified).length + ')', '· mit Text, aber keine Art aufgeloest:', essNP.length);
console.log('    essbare PILZ-Eintraege:', essPilz.length, '· mit aufgeloestem giftigem Verwechsler:', essPilz.filter(s => { const t = String(s.lookalike || '').trim(); return t && tr(t).arten.some(a => N(a.lat) !== N(s.lat) && a.tox >= 3); }).length, '· Text ohne aufgeloeste Art:', essPilz.filter(s => { const t = String(s.lookalike || '').trim(); return t && !tr(t).arten.filter(a => N(a.lat) !== N(s.lat)).length; }).length);
// (3) Aussaatkalender: Keimdauer lesbar, Temperatur genannt; Reichweite _gsSaeZuPflanze
const SAE = d.SAE; const span = SAE.filter(s => /(\d+)\s*[–-]\s*(\d+)\s*Tage/.test(s.germ)); const temp = SAE.filter(s => /°C/.test(s.germ));
console.log('(3) GS_SAE_DB germ: Spanne lesbar', span.length, 'von', SAE.length, '· mit Temperatur', temp.length, '· ohne Spanne:', SAE.filter(s => !span.includes(s)).map(s => s.n + ' „' + s.germ + '"').join(' | '));
const g = DB.filter(e => e.cat === 'gemuese'); let sae = 0, kul = 0, beide = 0; const ohneSae = [];
g.forEach(e => { const p = { name: e.name, species: e.lat }; const a = ctx._gsSaeZuPflanze(p), b = ctx._gsKulturZuPflanze(p); if (a) sae++; else ohneSae.push(e.name); if (b) kul++; if (a && b) beide++; });
console.log('    40 Gemuese-Eintraege der Artenliste: erreichen eine Aussaat-Kultur (_gsSaeZuPflanze):', sae, '· eine Kulturdaten-Kultur:', kul, '· beide:', beide, '· ohne Aussaat-Kultur:', ohneSae.join(', '));
const gemKat = ['Fruchtgemüse', 'Blattgemüse', 'Wurzelgemüse', 'Hülsenfrüchte', 'Knollen', 'Kohlgewächse']; console.log('    Aussaat-Kulturen in den sechs Gemuese-Kategorien:', SAE.filter(s => gemKat.includes(s.cat)).length, 'von', SAE.length, '· harvest gefuellt:', SAE.filter(s => (s.harvest || []).length).length);
// Kultur mit Keimdauer UND Bodentemperatur (ueber Namensregel + Bruecke, Richtung PLANT_DB-Name → SAE)
const pk = Object.keys(d.PLANT_DB); const saeMitBT = new Set(); pk.forEach(k => { const s = ctx._gsSaeZuPflanze({ name: k }); if (s && typeof d.PLANT_DB[k].bodentemp === 'number') saeMitBT.add(s.n); });
console.log('    Aussaat-Kulturen mit Keimspanne UND Bodentemperatur:', SAE.filter(s => span.includes(s) && saeMitBT.has(s.n)).length, 'von', SAE.length, '· nur Keimspanne:', SAE.filter(s => span.includes(s) && !saeMitBT.has(s.n)).length);
// (4) Zeigerarten aus IDEE-B (Liste dort aus dem Gedaechtnis): Eintraege und Saisonfeld
[['Hasel', 'Corylus avellana'], ['Huflattich', 'Tussilago farfara'], ['Forsythie', 'Forsythia'], ['Vogelkirsche', 'Prunus avium'], ['Apfel', 'Malus domestica'], ['Schwarzer Holunder', 'Sambucus nigra'], ['Sommerlinde', 'Tilia platyphyllos']].forEach(([n, l]) => { const L = DB.filter(e => N(e.lat) === N(l) || N(e.lat).startsWith(N(l) + ' ')); const s = [...new Set(L.map(e => e.season).filter(Boolean))]; console.log('(4)', n.padEnd(20), L.length, 'Eintraege · blueht-Kategorie:', L.filter(e => ctx.gsBlueht(e)).length, '· season:', s.slice(0, 5).join(' | ') || '—'); });
