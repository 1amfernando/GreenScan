const __GS_WURZEL = require('path').resolve(__dirname, '..', '..', '..', '..');   // die Wurzel des Repos (nachgetragen am 11.11.2026: vorher ein fester Pfad der Arbeitsumgebung)
// Verwechsler-Graph: loest der Freitext `lookalike` auf Eintraege der Artenliste auf? (nur lesen)
const fs = require('fs'), vm = require('vm');
const sb = { window: {} };
vm.runInNewContext(fs.readFileSync((__GS_WURZEL + '/data/plants.v1.js'), 'utf8'), sb);
const DB = sb.window.DB;
const norm = s => String(s || '').toLowerCase().replace(/ß/g, 'ss').replace(/\s+/g, ' ').trim();
// Namensindex: name → Eintraege, lat → Eintraege
const byName = new Map(), byLat = new Map();
DB.forEach(e => { const n = norm(e.name); if (!byName.has(n)) byName.set(n, []); byName.get(n).push(e); const l = norm(e.lat); if (!byLat.has(l)) byLat.set(l, []); byLat.get(l).push(e); });
// vorsichtigste Einstufung je Binomen (wie _gsVorsichtigste: hoechstes tox der Art)
const toxArt = new Map(); DB.forEach(e => { const l = norm(e.lat); toxArt.set(l, Math.max(toxArt.get(l) || 0, e.tox || 0)); });
const essbarArt = new Map(); DB.forEach(e => { const l = norm(e.lat); if (e.edible) essbarArt.set(l, true); });
function teile(txt) {
  return String(txt).replace(/\([^)]*\)/g, ' ').split(/[,;\/]|\bund\b|\boder\b|\bsowie\b/i).map(s => s.replace(/[!?.⚠️☠️]/g, '').trim()).filter(s => s && s !== '–' && s !== '-');
}
let mitText = 0, teileGes = 0, aufgeloest = 0, eintraegeMitTreffer = 0, eintraegeVoll = 0;
const kanten = [];   // {von, zu, vonE, zuE}
const nichtAufgeloest = new Map();
DB.forEach(e => {
  const t = String(e.lookalike || '').trim();
  if (!t || t === '–' || /^keine\b/i.test(t)) return;
  mitText++;
  const ts = teile(t); let n = 0;
  ts.forEach(x => {
    teileGes++;
    const k = norm(x);
    let ziel = byName.get(k) || byLat.get(k);
    if (!ziel) { // Wortgrenzen-Teiltreffer: „Gefleckter Schierling" exakt; sonst nichts raten
      nichtAufgeloest.set(k, (nichtAufgeloest.get(k) || 0) + 1); return; }
    aufgeloest++; n++;
    ziel.forEach(z => { if (norm(z.lat) !== norm(e.lat)) kanten.push({ von: e, zu: z }); });
  });
  if (n > 0) eintraegeMitTreffer++;
  if (n === ts.length && ts.length) eintraegeVoll++;
});
console.log('Eintraege mit lookalike-Text (ohne "–"/"Keine"):', mitText, 'von', DB.length);
console.log('Namens-Teile gesamt:', teileGes, '· exakt aufgeloest (Name oder Binomen):', aufgeloest, '(' + Math.round(100 * aufgeloest / teileGes) + '%)');
console.log('Eintraege mit >=1 aufgeloestem Verwechsler:', eintraegeMitTreffer, '(' + Math.round(100 * eintraegeMitTreffer / mitText) + '% derer mit Text) · alle Teile aufgeloest:', eintraegeVoll);
// Kanten je Binomen-Paar
const paar = new Map();
kanten.forEach(k => { const key = norm(k.von.lat) + ' → ' + norm(k.zu.lat); if (!paar.has(key)) paar.set(key, k); });
console.log('Kanten (Binomen → Binomen, ohne Selbstbezug):', paar.size);
let gefaehrlich = 0, toedlich = 0; const bsp = [];
paar.forEach((k, key) => {
  const a = norm(k.von.lat), b = norm(k.zu.lat);
  if (essbarArt.get(a) && (toxArt.get(b) || 0) >= 3) { gefaehrlich++; if ((toxArt.get(b) || 0) >= 5) toedlich++; if (bsp.length < 12) bsp.push(k.von.name + ' (' + k.von.cat + ') → ' + k.zu.name + ' tox ' + toxArt.get(b)); }
});
console.log('davon: essbare Art → Verwechsler mit tox>=3:', gefaehrlich, '· mit tox 5:', toedlich);
console.log('Beispiele:', bsp.join(' | '));
const vonArten = new Set(); paar.forEach(k => vonArten.add(norm(k.von.lat)));
const essbareMitGefahr = new Set(); paar.forEach(k => { const a = norm(k.von.lat), b = norm(k.zu.lat); if (essbarArt.get(a) && (toxArt.get(b) || 0) >= 3) essbareMitGefahr.add(a); });
console.log('Binome mit >=1 aufgeloestem Verwechsler:', vonArten.size, '· essbare Binome mit aufgeloestem giftigem (tox>=3) Verwechsler:', essbareMitGefahr.size, 'von', [...essbarArt.keys()].length, 'essbaren Binomen');
// je Kategorie
const kat = {}; paar.forEach(k => { kat[k.von.cat] = (kat[k.von.cat] || 0) + 1; });
console.log('Kanten nach Kategorie der Ausgangsart:', kat);
console.log('haeufigste NICHT aufgeloeste Teile:', [...nichtAufgeloest.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(x => x[0] + ' ×' + x[1]).join(' | '));
console.log('verschiedene nicht aufgeloeste Teile:', nichtAufgeloest.size);
fs.writeFileSync(__dirname + '/kanten.json', JSON.stringify([...paar.values()].map(k => ({ von: k.von.id, zu: k.zu.id }))));
