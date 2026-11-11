// Kulturdaten × Artenliste: erreicht ein Eintrag der Artenliste seine Kultur? (nur lesen)
// Vorher einmal: node zaehl3.js (schreibt plantdb.json)
const vm = require('vm'); const H = require('./harness.js'); const ctx = H.laden(); const DB = ctx.DB;
const d = require('./plantdb.json'); ctx.PLANT_DB = d.PLANT_DB;
vm.runInContext(H.fn('_gsKulturZuPflanze'), ctx);
const P = d.PLANT_DB;
const fehl = Object.keys(P).filter(k => P[k].latName && !DB.some(e => ctx._gsNormLat(e.lat) === ctx._gsNormLat(P[k].latName)));
console.log('Kulturen, deren latName in der Artenliste NICHT vorkommt:', fehl.map(k => k + ' [' + P[k].latName + ']').join(' · '));
const t = (n, s) => { const r = ctx._gsKulturZuPflanze({ name: n, species: s }); console.log('  {name:' + JSON.stringify(n) + ', species:' + JSON.stringify(s) + '} →', r ? (r.name + ' (frost ' + r.k.frost + ', bodentemp ' + r.k.bodentemp + ')') : 'null'); };
t('Tomate', 'Solanum lycopersicum'); t('Fleischtomate', 'Solanum lycopersicum'); t('Tomatenpflanze', 'Solanum lycopersicum'); t('Lauch (Porree)', 'Allium ampeloprasum var. porrum');
const g = DB.filter(e => e.cat === 'gemuese'); let ok = 0; const ohne = [];
g.forEach(e => { const r = ctx._gsKulturZuPflanze({ name: e.name, species: e.lat }); if (r) ok++; else ohne.push(e.name + ' [' + e.lat + ']'); });
console.log('Artenliste cat=gemuese:', g.length, '· finden eine Kultur:', ok, '· ohne:', ohne.length); console.log('  ohne:', ohne.join(' · '));
