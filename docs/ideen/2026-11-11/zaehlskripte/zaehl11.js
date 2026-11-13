const vm = require('vm'); const H = require('./harness.js'); const ctx = H.laden(); const DB = ctx.DB;
vm.runInContext('var __o = _gsLinaNorm, __m = new Map(); _gsLinaNorm = function (t) { var k = String(t == null ? "" : t); var v = __m.get(k); if (v === undefined) { v = __o(k); __m.set(k, v); } return v; };', ctx);
const N = s => ctx._gsNormLat(s || '');
const zeig = (lat) => { const es = DB.filter(e => N(e.lat) === N(lat) && e.lookalike); const seen = new Set();
  es.forEach(e => { if (seen.has(e.lookalike)) return; seen.add(e.lookalike); const r = ctx._gsArtenTreffer(e.lookalike); console.log('  ', e.id, e.name, '· lookalike:', JSON.stringify(e.lookalike), '→', r.arten.filter(a => N(a.lat) !== N(e.lat)).map(a => a.name + ' tox' + a.tox + (a.nurTeilname ? ' (nur Teilname)' : '')).join(' | ') || '—'); }); };
['Solanum lycopersicum', 'Allium sativum', 'Boletus edulis', 'Vaccinium myrtillus', 'Humulus lupulus', 'Cantharellus cibarius', 'Macrolepiota procera', 'Agaricus campestris'].forEach(l => { console.log(l + ':'); zeig(l); });
// Wie viele gefaehrliche Kanten kommen NUR ueber die Teilnamen-/Familien-Regel?
const gef = require('./gef.json');
// Praezision grob: Anteil der gefaehrlichen Kanten, deren Zielname WOERTLICH im lookalike-Text steht
let woertlich = 0, ges = 0; const nichtW = [];
const byId = new Map(DB.map(e => [e.id, e]));
gef.forEach(k => { ges++; const e = byId.get(k.von); const q = ' ' + ctx._gsLinaNorm(e.lookalike) + ' '; if (q.indexOf(' ' + ctx._gsLinaNorm(k.zu) + ' ') >= 0) woertlich++; else if (nichtW.length < 14) nichtW.push(e.name + ' ["' + e.lookalike + '"] → ' + k.zu + ' tox' + k.tox); });
console.log('\ngefaehrliche Kanten:', ges, '· Zielname steht WOERTLICH im Text:', woertlich, '(' + Math.round(100 * woertlich / ges) + '%) · ueber Familien-/Teilnamen-Regel:', ges - woertlich);
console.log('Beispiele NICHT woertlich:'); nichtW.forEach(x => console.log('  ', x));
