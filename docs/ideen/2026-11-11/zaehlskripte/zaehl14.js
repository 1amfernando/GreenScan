// Pruefzahlen fuer C1 (Doppelgaenger-Radar), erste Scheibe: nur aufgeloeste Arten mit tox >= 3
const vm = require('vm'); const H = require('./harness.js'); const ctx = H.laden(); const DB = ctx.DB;
vm.runInContext('var __o = _gsLinaNorm, __m = new Map(); _gsLinaNorm = function (t) { var k = String(t == null ? "" : t); var v = __m.get(k); if (v === undefined) { v = __o(k); __m.set(k, v); } return v; };', ctx);
const memo = new Map(); const tr = t => { let v = memo.get(t); if (!v) { v = ctx._gsArtenTreffer(t); memo.set(t, v); } return v; };
let mitText = 0, irgendeine = 0, giftig = 0, keine = 0, nurHarmlos = 0, giftEssbar = 0;
DB.forEach(e => { const t = String(e.lookalike || '').trim(); if (!t || t === '–') return; mitText++;
  const k = ctx._gsNormLat(e.lat); const z = tr(t).arten.filter(a => ctx._gsNormLat(a.lat) !== k);
  if (!z.length) { keine++; return; } irgendeine++;
  if (z.some(a => a.tox >= 3)) { giftig++; if (ctx._gsArtAnzeige(e).edible) giftEssbar++; } else nurHarmlos++; });
console.log('Eintraege mit lookalike-Text:', mitText);
console.log('  verletzt   (>=1 aufgeloeste andere Art mit tox>=3):', giftig, '· davon der Eintrag selbst essbar:', giftEssbar);
console.log('  erfuellt   (aufgeloest, aber keine mit tox>=3):   ', nurHarmlos);
console.log('  nicht pruefbar (Text da, keine Art aufgeloest):   ', keine);
console.log('  Summe:', giftig + nurHarmlos + keine, '· ohne Text:', DB.length - mitText);
