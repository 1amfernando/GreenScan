const __GS_WURZEL = require('path').resolve(__dirname, '..', '..', '..', '..');   // die Wurzel des Repos (nachgetragen am 11.11.2026: vorher ein fester Pfad der Arbeitsumgebung)
// Zaehlt Felddeckung in data/plants.v1.js (nur lesen)
const fs = require('fs');
const src = fs.readFileSync((__GS_WURZEL + '/data/plants.v1.js'), 'utf8');
const window = {};
new Function('window', src)(window);
const DB = window.DB;
console.log('Eintraege roh:', DB.length);
const keys = {};
DB.forEach(e => Object.keys(e).forEach(k => { keys[k] = (keys[k]||0) + 1; }));
console.log('Alle Schluessel (vorhanden):');
Object.entries(keys).sort((a,b)=>b[1]-a[1]).forEach(([k,n]) => console.log('  ', k.padEnd(18), n, (100*n/DB.length).toFixed(1)+'%'));
function gefuellt(v){ return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length===0); }
console.log('\nGefuellt (nicht leer):');
Object.keys(keys).forEach(k => { const n = DB.filter(e => gefuellt(e[k])).length; console.log('  ', k.padEnd(18), n, (100*n/DB.length).toFixed(1)+'%'); });
const cats = {};
DB.forEach(e => { cats[e.cat] = (cats[e.cat]||0)+1; });
console.log('\nKategorien:', cats);
// andere globale
console.log('\nWeitere window-Schluessel:', Object.keys(window));
