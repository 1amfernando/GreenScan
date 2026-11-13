const d = require('./plantdb.json'); const P = d.PLANT_DB, SAE = d.SAE;
const pk = Object.keys(P);
// yield_kg_m2 lesbar als kg-Spanne?
let kg = 0, st = 0, leer = 0; pk.forEach(k => { const y = P[k].yield_kg_m2; if (y == null) { leer++; return; } if (/Stück/i.test(y)) st++; else if (/^\d+(\.\d+)?(\s*[–-]\s*\d+(\.\d+)?)?$/.test(String(y).trim())) kg++; else console.log('  unlesbar:', k, y); });
console.log('yield_kg_m2: kg-Spanne/-Wert', kg, '· Stück', st, '· ohne', leer, '· von', pk.length);
// GS_SAE_DB × PLANT_DB ueber dieselbe Namensregel wie _gsKulturZuPflanze (exakt, +n, -n)
const lower = pk.map(k => k.toLowerCase());
const treffer = [], ohne = [];
SAE.forEach(s => { const n = s.n.toLowerCase(); const i = lower.findIndex(k => k === n || k === n + 'n' || k + 'n' === n); if (i >= 0) treffer.push(s.n + '→' + pk[i]); else ohne.push(s.n); });
console.log('GS_SAE_DB (' + SAE.length + ') × PLANT_DB ueber die Namensregel von _gsKulturZuPflanze:', treffer.length, 'Treffer');
console.log('  ohne Treffer:', ohne.join(', '));
const mitBT = treffer.filter(t => typeof P[t.split('→')[1]].bodentemp === 'number');
console.log('  davon mit bodentemp (Zahl):', mitBT.length, '· mit outdoor-Fenster:', SAE.filter(s => (s.outdoor || []).length).length, 'von', SAE.length);
console.log('  bodentemp-Werte:', pk.filter(k => typeof P[k].bodentemp === 'number').map(k => P[k].bodentemp).sort((a, b) => a - b).join(','));
console.log('  keimtemp-Beispiele:', pk.slice(0, 6).map(k => k + ': ' + P[k].keimtemp + ' / Boden ' + P[k].bodentemp).join(' | '));
// gut_mit / schlecht_mit
let gm = 0, sm = 0; pk.forEach(k => { gm += (P[k].gut_mit || []).length; sm += (P[k].schlecht_mit || []).length; });
console.log('Mischkultur in PLANT_DB: gut_mit', gm, 'Nennungen · schlecht_mit', sm, 'Nennungen, ueber', pk.filter(k => P[k].gut_mit).length, 'Kulturen');
