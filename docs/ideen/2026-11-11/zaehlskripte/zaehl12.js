// Befund-Kandidat fuer ARTEN: der Freitext `lookalike` nennt eine ANDERE Art "giftig/toedlich",
// deren eigener Eintrag (nach _gsArtAnzeige, vorsichtigste Angabe der Art) tox 0 fuehrt.
const vm = require('vm'); const H = require('./harness.js'); const ctx = H.laden(); const DB = ctx.DB;
const N = s => ctx._gsNormLat(s || ''); const L = s => ctx._gsLinaNorm(s);
const byName = new Map(); DB.forEach(e => { const k = L(e.name); if (!byName.has(k)) byName.set(k, []); byName.get(k).push(e); });
const maxTox = new Map(), essbar = new Map(); DB.forEach(e => { const a = ctx._gsArtAnzeige(e); const k = N(e.lat); maxTox.set(k, Math.max(maxTox.get(k) || 0, a.tox || 0)); if (a.edible) essbar.set(k, true); });
const funde = new Map(); let teileMitGift = 0, aufgeloest = 0;
DB.forEach(e => {
  const t = String(e.lookalike || ''); if (!t) return;
  // Teile an , ; trennen — aber nicht innerhalb von Klammern
  const teile = []; let tief = 0, akt = '';
  for (const c of t) { if (c === '(') tief++; if (c === ')') tief = Math.max(0, tief - 1); if ((c === ',' || c === ';') && tief === 0) { teile.push(akt); akt = ''; } else akt += c; }
  teile.push(akt);
  teile.forEach(x => {
    const m = x.match(/^\s*([^()]+?)\s*\(([^)]*)\)/); if (!m) return;
    const name = m[1].trim(), kl = m[2];
    if (!/gift|tödlich|toedlich|TÖDLICH/i.test(kl) || /ungiftig|nicht giftig|kein gift/i.test(kl)) return;
    teileMitGift++;
    const ziel = byName.get(L(name)); if (!ziel) return;          // nur WOERTLICHER ganzer Name
    const bins = [...new Set(ziel.map(z => N(z.lat)))]; if (bins.length !== 1) return;   // eindeutig eine Art
    aufgeloest++;
    const k = bins[0]; if (k === N(e.lat)) return;
    if ((maxTox.get(k) || 0) === 0) { const key = ziel[0].name + ' [' + ziel[0].lat + ']' + (essbar.get(k) ? ' — gefuehrt als ESSBAR' : ' — tox 0'); if (!funde.has(key)) funde.set(key, []); funde.get(key).push(e.id + ' ' + e.name + ': "' + x.trim().slice(0, 70) + '"'); }
  });
});
console.log('lookalike-Teile mit Klammerzusatz "giftig/toedlich":', teileMitGift, '· davon woertlich und eindeutig auf EINE Art aufgeloest:', aufgeloest);
console.log('Arten, die ein FREMDER Eintrag "giftig" nennt, deren eigene Einstufung aber tox 0 ist:', funde.size);
[...funde.entries()].sort((a, b) => b[1].length - a[1].length).forEach(([k, v]) => console.log('  •', k, '←', v.length + '×, z.B.', v.slice(0, 2).join(' || ')));
