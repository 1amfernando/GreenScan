const __GS_WURZEL = require('path').resolve(__dirname, '..', '..', '..', '..');   // die Wurzel des Repos (nachgetragen am 11.11.2026: vorher ein fester Pfad der Arbeitsumgebung)
// Rezepte/Heilmittel: wie viele mit plantIds, wie viele Arten, Saison der Zielarten (nur lesen)
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync((__GS_WURZEL + '/index.html'), 'utf8');
const sb = { window: {} };
vm.runInNewContext(fs.readFileSync((__GS_WURZEL + '/data/plants.v1.js'), 'utf8'), sb);
const DB = sb.window.DB; const byId = new Map(DB.map(s => [s.id, s]));
function arr(decl) {
  const i = html.indexOf(decl); if (i < 0) return null;
  let j = html.indexOf('[', i), depth = 0, k = j, inS = null, esc = false;
  for (; k < html.length; k++) {
    const c = html[k];
    if (inS) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === inS) inS = null; continue; }
    if (c === '"' || c === "'" || c === '`') { inS = c; continue; }
    if (c === '/' && html[k + 1] === '/') { k = html.indexOf('\n', k); continue; }
    if (c === '/' && html[k + 1] === '*') { k = html.indexOf('*/', k) + 1; continue; }
    if (c === '[') depth++; else if (c === ']') { depth--; if (depth === 0) break; }
  }
  return vm.runInNewContext('(' + html.slice(j, k + 1) + ')');
}
const R = arr('const DEFAULT_RECIPES = ');
let M = null; try { M = arr('const DEFAULT_REMEDIES = '); } catch (e) { console.log('REMEDIES Fehler', e.message); }
console.log('DEFAULT_RECIPES:', R && R.length, '· DEFAULT_REMEDIES:', M && M.length);
const alle = [].concat(R || [], M || []);
const typ = {}; alle.forEach(r => { typ[r.type] = (typ[r.type] || 0) + 1; });
console.log('type:', typ);
const mitIds = alle.filter(r => Array.isArray(r.plantIds) && r.plantIds.length);
console.log('mit plantIds:', mitIds.length, 'von', alle.length, '(' + Math.round(100 * mitIds.length / alle.length) + '%)');
const arten = new Set(); mitIds.forEach(r => r.plantIds.forEach(id => arten.add(id)));
console.log('verschiedene Ziel-Eintraege:', arten.size, '· davon in DB:', [...arten].filter(id => byId.has(id)).length);
const lat = new Set([...arten].map(id => byId.get(id)).filter(Boolean).map(s => s.lat.toLowerCase()));
console.log('verschiedene Binome:', lat.size);
const mitSaison = [...arten].map(id => byId.get(id)).filter(s => s && s.season);
console.log('Zielarten mit season gefuellt:', mitSaison.length, 'von', arten.size);
console.log('Kategorien der Zielarten:', [...arten].map(id => byId.get(id)).filter(Boolean).reduce((a, s) => { a[s.cat] = (a[s.cat] || 0) + 1; return a; }, {}));
const rezepteMitSaison = mitIds.filter(r => r.plantIds.some(id => byId.get(id) && byId.get(id).season)).length;
console.log('Rezepte, deren Zielart eine season traegt:', rezepteMitSaison);
console.log('Felder eines Rezepts:', Object.keys(alle[0]).join(','));
console.log('Felder Heilmittel:', M && M[0] ? Object.keys(M[0]).join(',') : '-');
const feldZ = {}; alle.forEach(r => Object.keys(r).forEach(k => { feldZ[k] = (feldZ[k] || 0) + 1; }));
console.log(feldZ);
