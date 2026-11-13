const __GS_WURZEL = require('path').resolve(__dirname, '..', '..', '..', '..');   // die Wurzel des Repos (nachgetragen am 11.11.2026: vorher ein fester Pfad der Arbeitsumgebung)
const fs = require('fs');
const src = fs.readFileSync((__GS_WURZEL + '/data/plants.v1.js'), 'utf8');
const window = {};
new Function('window', src)(window);
const DB = window.DB;
const g = v => v !== undefined && v !== null && v !== '';
const cats = [...new Set(DB.map(e=>e.cat))];
const felder = ['season','habitat','alt','color','lookalike','warning','medicinalUse','fam','desc','bookRef'];
console.log('Kategorie'.padEnd(14), 'n'.padStart(5), felder.map(f=>f.slice(0,8).padStart(9)).join(''));
cats.forEach(c => {
  const L = DB.filter(e=>e.cat===c);
  console.log(c.padEnd(14), String(L.length).padStart(5), felder.map(f => (Math.round(100*L.filter(e=>g(e[f])).length/L.length)+'%').padStart(9)).join(''));
});
// tox-Verteilung
const tox = {}; DB.forEach(e => { const k = e.cat+'|'+e.tox; tox[k]=(tox[k]||0)+1; });
const t2 = {}; DB.forEach(e => { t2[e.tox] = (t2[e.tox]||0)+1; });
console.log('\ntox gesamt:', t2);
console.log('edible true:', DB.filter(e=>e.edible===true).length, 'toxic true:', DB.filter(e=>e.toxic===true).length, 'protected true:', DB.filter(e=>e.protected===true).length, 'medicinal true:', DB.filter(e=>e.medicinal===true).length);
cats.forEach(c => { const L=DB.filter(e=>e.cat===c); console.log('  ', c.padEnd(13), 'edible', L.filter(e=>e.edible).length, '· tox>=3', L.filter(e=>e.tox>=3).length, '· tox>=1', L.filter(e=>e.tox>=1).length, '· protected', L.filter(e=>e.protected).length, '· medicinal', L.filter(e=>e.medicinal).length); });
// season-Formate
const sf = {};
DB.filter(e=>g(e.season)).forEach(e => {
  const s = String(e.season);
  let form = s.replace(/Jan|Feb|Mär|Mar|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez/g,'M').replace(/\s+/g,' ');
  sf[form] = (sf[form]||0)+1;
});
console.log('\nseason-Formen (Top 40 von', Object.keys(sf).length, '):');
Object.entries(sf).sort((a,b)=>b[1]-a[1]).slice(0,40).forEach(([k,n]) => console.log('  ', String(n).padStart(5), JSON.stringify(k)));
// alt-Formate
const af = {};
DB.filter(e=>g(e.alt)).forEach(e => { const f = String(e.alt).replace(/\d+/g,'N'); af[f]=(af[f]||0)+1; });
console.log('\nalt-Formen (', Object.keys(af).length, '):');
Object.entries(af).sort((a,b)=>b[1]-a[1]).slice(0,25).forEach(([k,n]) => console.log('  ', String(n).padStart(5), JSON.stringify(k)));
