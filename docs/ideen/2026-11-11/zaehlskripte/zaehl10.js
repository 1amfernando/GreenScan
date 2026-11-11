const fs = require('fs'), vm = require('vm'); const H = require('./harness.js'); const ctx = H.laden(); const DB = ctx.DB;
const d = require('./plantdb.json'); const P = d.PLANT_DB; const gef = require('./gef.json');
const html = H.html;
function arr(decl) { const src = H.quelle(decl, '[', ']'); return vm.runInNewContext('(' + src.slice(src.indexOf('[')) + ')'); }
const R = arr('const DEFAULT_RECIPES = '), M = arr('const DEFAULT_REMEDIES = ');
const alle = R.concat(M); const byId = new Map(DB.map(s => [s.id, s]));
const N = s => ctx._gsNormLat(s || '');
// Rezept-Ziel-Binome
const zielBin = new Map();   // binom → Rezeptzahl
alle.forEach(r => (r.plantIds || []).forEach(id => { const s = byId.get(id); if (!s) return; const k = N(s.lat); zielBin.set(k, (zielBin.get(k) || 0) + 1); }));
console.log('Rezept-Ziel-Binome:', zielBin.size);
// davon mit aufgeloestem giftigem Verwechsler
const gefBin = new Set(gef.map(g => N(g.vonLat)));
const mitGef = [...zielBin.keys()].filter(k => gefBin.has(k));
console.log('  davon mit aufgeloestem giftigem Verwechsler (tox>=3):', mitGef.length, '→ betrifft Rezepte:', mitGef.reduce((a, k) => a + zielBin.get(k), 0));
console.log('  ', mitGef.slice(0, 25).join(', '));
// Garten-Kulturen (PLANT_DB.latName) → Rezept
const pk = Object.keys(P); let mitLat = 0, inDB = 0, mitRezept = 0; const ohneR = [], mitR = [];
pk.forEach(k => { const l = P[k].latName; if (!l) return; mitLat++; const n = N(l); const inDb = DB.some(s => N(s.lat) === n); if (inDb) inDB++; if (zielBin.has(n)) { mitRezept++; mitR.push(k + '(' + zielBin.get(n) + ')'); } else ohneR.push(k); });
console.log('PLANT_DB-Kulturen mit latName:', mitLat, '· Binomen in der Artenliste:', inDB, '· mit >=1 Rezept ueber plantIds:', mitRezept);
console.log('  mit Rezept:', mitR.join(', '));
console.log('  ohne Rezept:', ohneR.join(', '));
// Saisonfenster der Rezept-Zielarten: echtes Fenster?
let fenster = 0; [...zielBin.keys()].forEach(k => { const es = DB.filter(s => N(s.lat) === k); const ms = new Set(); es.forEach(e => (ctx.gsSaisonMonate(e.season) || []).forEach(m => ms.add(m))); if (ms.size > 0 && ms.size < 12) fenster++; });
console.log('Rezept-Ziel-Binome mit echtem Saisonfenster (<12 Monate):', fenster, 'von', zielBin.size);
// Rezepte je Monat (Zielart hat im Monat Saison), Kategorie wild (wildpflanze/pilz/baum/kraut)
const proMonat = new Array(12).fill(0);
alle.forEach(r => { const ms = new Set(); (r.plantIds || []).forEach(id => { const s = byId.get(id); if (!s) return; (ctx.gsSaisonMonate(s.season) || []).forEach(m => ms.add(m)); }); if (ms.size && ms.size < 12) ms.forEach(m => proMonat[m]++); });
console.log('Rezepte mit Saisonfenster je Monat (Jan..Dez):', proMonat.join(' '));
// warning "Keine bekannten Risiken"
const kr = DB.filter(e => /^(keine|kein|nein|none|no\b|unbedenklich)/i.test(String(e.warning || '').trim())).length;
console.log('warning beginnt mit Keine/Kein/…:', kr, 'von', DB.filter(e => String(e.warning || '').trim()).length, 'gefuellten');
// tox-Widersprueche je Binomen
const tb = new Map(); DB.forEach(e => { const k = N(e.lat); if (!k || k.indexOf(' ') < 0) return; if (!tb.has(k)) tb.set(k, new Set()); tb.get(k).add(e.tox); });
const wid = [...tb.entries()].filter(([k, s]) => s.size > 1); const stark = wid.filter(([k, s]) => Math.max(...s) - Math.min(...s) >= 3);
console.log('Binome mit mehreren Eintraegen und verschiedenen tox-Stufen:', wid.length, '· Spanne >= 3 Stufen:', stark.length, '· z.B.', stark.slice(0, 8).map(([k, s]) => k + ' [' + [...s].sort().join(',') + ']').join(' | '));
const mehrfach = [...tb.entries()].length; const multi = new Map(); DB.forEach(e => { const k = N(e.lat); multi.set(k, (multi.get(k) || 0) + 1); });
console.log('Binome gesamt:', multi.size, '· mehrfach gefuehrt:', [...multi.values()].filter(n => n > 1).length);
