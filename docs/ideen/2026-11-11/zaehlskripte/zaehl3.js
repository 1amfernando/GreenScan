const __GS_WURZEL = require('path').resolve(__dirname, '..', '..', '..', '..');   // die Wurzel des Repos (nachgetragen am 11.11.2026: vorher ein fester Pfad der Arbeitsumgebung)
// PLANT_DB, GS_SAE_DB, SEASON_DATA aus index.html lesen und Felder zaehlen (nur lesen)
const fs = require('fs');
const lines = fs.readFileSync((__GS_WURZEL + '/index.html'), 'utf8').split('\n');
function block(startRe, endRe) {
  const s = lines.findIndex(l => startRe.test(l));
  let e = -1;
  for (let i = s + 1; i < lines.length; i++) { if (endRe.test(lines[i])) { e = i; break; } }
  return { s, e, text: lines.slice(s, e + 1).join('\n') };
}
// PLANT_DB
const b1 = block(/^const PLANT_DB = \{/, /^\};/);
const PLANT_DB = new Function(b1.text.replace(/^const PLANT_DB = /, 'return ') )();
const pk = Object.keys(PLANT_DB);
console.log('PLANT_DB Zeilen', b1.s + 1, '-', b1.e + 1, '· Kulturen:', pk.length);
const f = {};
pk.forEach(k => Object.keys(PLANT_DB[k]).forEach(x => { f[x] = (f[x] || 0) + 1; }));
Object.entries(f).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log('   ', k.padEnd(16), n));
const cat = {}; pk.forEach(k => { const c = PLANT_DB[k].category; cat[c] = (cat[c] || 0) + 1; });
console.log('  category:', cat);
const fr = {}; pk.forEach(k => { const c = PLANT_DB[k].frost; fr[c] = (fr[c] || 0) + 1; });
console.log('  frost:', fr);
console.log('  bodentemp (Zahl):', pk.filter(k => typeof PLANT_DB[k].bodentemp === 'number').length, '· lightMin:', pk.filter(k => typeof PLANT_DB[k].lightMin === 'number').length, '· latName:', pk.filter(k => PLANT_DB[k].latName).length, '· waterFrequency:', pk.filter(k => PLANT_DB[k].waterFrequency != null).length);
console.log('  sun:', pk.reduce((a, k) => { a[PLANT_DB[k].sun] = (a[PLANT_DB[k].sun] || 0) + 1; return a; }, {}));
console.log('  water:', pk.reduce((a, k) => { a[PLANT_DB[k].water] = (a[PLANT_DB[k].water] || 0) + 1; return a; }, {}));
console.log('  Namen:', pk.join(', '));
// GS_SAE_DB
const b2 = block(/^var GS_SAE_DB = \[/, /^\];/);
const SAE = new Function(b2.text.replace(/^var GS_SAE_DB = /, 'return '))();
console.log('\nGS_SAE_DB:', SAE.length, 'Kulturen · Felder:', Object.keys(SAE[0]).join(','));
// SEASON_DATA
const b3 = block(/^const SEASON_DATA = \[/, /^\];/);
const SD = new Function(b3.text.replace(/^const SEASON_DATA = /, 'return '))();
console.log('SEASON_DATA:', SD.length, 'Eintraege · cat:', SD.reduce((a, x) => { a[x.cat] = (a[x.cat] || 0) + 1; return a; }, {}), '· Felder:', Object.keys(SD[0]).join(','));
fs.writeFileSync(__dirname + '/plantdb.json', JSON.stringify({ PLANT_DB, SAE, SD }));
