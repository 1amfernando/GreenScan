const vm = require('vm'); const H = require('./harness.js'); const ctx = H.laden();
const DB = ctx.DB; const gef = require('./gef.json');
const mon = e => ctx.gsSaisonMonate(e.season);
const byLat = new Map(); DB.forEach(e => { const k = ctx._gsNormLat(e.lat); if (!byLat.has(k)) byLat.set(k, []); byLat.get(k).push(e); });
const monArt = lat => { const s = new Set(); (byLat.get(ctx._gsNormLat(lat)) || []).forEach(e => (mon(e) || []).forEach(m => s.add(m))); return s; };
const seen = new Set(); const ohne = [];
gef.forEach(k => { const pk = ctx._gsNormLat(k.vonLat) + '→' + ctx._gsNormLat(k.zuLat); if (seen.has(pk)) return; seen.add(pk);
  const a = monArt(k.vonLat), b = monArt(k.zuLat);
  if (a.size && b.size && a.size < 12 && b.size < 12 && ![...a].some(m => b.has(m))) ohne.push(k.vonName + ' [' + [...a].map(m => m + 1).join(',') + '] × ' + k.zu + ' tox' + k.tox + ' [' + [...b].map(m => m + 1).join(',') + ']'); });
console.log('Paare essbar × giftig OHNE Saison-Ueberlappung (' + ohne.length + '):'); ohne.forEach(x => console.log('  ', x));
// Herbstzeitlose / Baerlauch ausdruecklich
const hz = DB.find(e => e.id === 'P031'), bl = DB.find(e => e.id === 'P001');
console.log('\nBärlauch season:', bl.season, '· Herbstzeitlose season:', hz.season, '· Maiglöckchen season:', DB.find(e => e.id === 'P030').season);
