#!/usr/bin/env node
// arten_quellen_vergleich.js — die zwei BELEGTEN Datensaetze im Repo gegen
// die Artenliste halten. Nur lesend; schreibt nichts.
//
//   node scripts/arten_quellen_vergleich.js
//
// Anlass (v32.43, docs/ARTEN-DATEN.md §3.3): `data/plants.v1.js` traegt bei
// 3'375 von 4'342 Arten weder Farbe noch Hoehe. Im Repo liegen aber zwei
// Datensaetze mit NAMENTLICHER Quelle je Zeile — das Pilz-Register
// (v29.88, VAPKO/SwissFungi/…) und die Baum-Spezifikationen (v30.00,
// BAFU/Flora Helvetica). Dieser Stand misst drei Dinge:
//
//   1. Wie viele der Luecken liessen sich daraus fuellen?
//   2. Wo BEIDE etwas sagen: stimmen sie ueberein?
//   3. Wenn nicht — in welche Richtung, und ist es systematisch?
//
// Der erste Lauf: 2 von 122 Pilz-Hoehen identisch, weil das Register die
// Untergrenze auf 300 m setzt und die Liste auf 0. Zwei Konventionen, keine
// benannt. **Deshalb wird hier nichts uebernommen** — die Uebernahme braucht
// zuerst die Entscheidung, welche Konvention gilt (ARTEN-DATEN.md §7).
//
// Grenze: der Abgleich laeuft ueber das normalisierte Binomen (Gattung+Art,
// wie `_gsNormLat` in index.html). Unterarten und Synonyme fallen durch.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
global.window = {};
require(path.join(ROOT, 'data', 'plants.v1.js'));
const DB = global.window.DB;

// Dieselbe Normalisierung wie `_gsNormLat` in index.html — bewusst kopiert,
// nicht importiert: index.html ist kein Modul, und die Regel darf hier nicht
// stillschweigend abweichen. Wer sie dort aendert, aendert sie auch hier.
function nl(s) {
  return String(s || '').toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(ssp|subsp|var|f|agg|cv|sp|spp)\.?\b/g, ' ')
    .replace(/[×x]\s/g, ' ')
    .replace(/[^a-zäöü ]/g, ' ')
    .replace(/ö/g, 'o').replace(/ä/g, 'a').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ').trim()
    .split(' ').slice(0, 2).join(' ');
}

// Ein SQL-Tupel `( 'a', 'b''c', NULL, '{x,y}' )` in Felder zerlegen.
// Zustandsautomat statt Regex: Kommas stehen auch IN den Werten.
function parseTuple(line) {
  const f = []; let cur = '', inS = false, depth = 0;
  for (let i = 1; i < line.length; i++) {
    const c = line[i];
    if (inS) {
      if (c === "'") { if (line[i + 1] === "'") { cur += "'"; i++; } else inS = false; }
      else cur += c;
      continue;
    }
    if (c === "'") { inS = true; continue; }
    if (c === '(') depth++;
    if (c === ')') { if (depth === 0) { f.push(cur.trim()); break; } depth--; }
    if (c === ',' && depth === 0) { f.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  return f;
}

function ladeSnapshot(datei) {
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', datei), 'utf8');
  const m = sql.match(/\(([^)]+)\) values/);
  if (!m) throw new Error(datei + ': keine Spaltenliste gefunden');
  const cols = m[1].split(',').map(s => s.trim());
  const rows = sql.split('\n').filter(l => l.startsWith('(')).map(parseTuple);
  const idx = (n) => { const i = cols.indexOf(n); if (i < 0) throw new Error(datei + ': Spalte ' + n + ' fehlt'); return i; };
  return { cols, rows, idx };
}

const byLat = {};
DB.forEach(s => { const k = nl(s.lat); if (k.indexOf(' ') > 0) (byLat[k] = byLat[k] || []).push(s); });
const band = (s) => { const m = String(s.alt || '').match(/(\d{1,4})\s*[–\-—]\s*(\d{1,4})/); return m ? { von: Number(m[1]), bis: Number(m[2]) } : null; };
const tsd = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '’');

console.log('\n=== arten_quellen_vergleich — was die zwei belegten Repo-Datensaetze zur Liste sagen');
console.log('  Artenliste: ' + tsd(DB.length) + ' Eintraege · ohne Farbe UND Hoehe: ' + tsd(DB.filter(s => !String(s.color || '').trim() && !String(s.alt || '').trim()).length));

// ── 1 · Pilz-Register ──────────────────────────────────────────────────────
{
  const R = ladeSnapshot('v29_88_mushroom_register_snapshot.sql');
  const iS = R.idx('scientific_name'), iMin = R.idx('altitude_m_min'), iMax = R.idx('altitude_m_max'), iCol = R.idx('cap_color'), iSrc = R.idx('source');
  let treffer = 0, beide = 0, gleich = 0, ueberlapp = 0, weit = 0, fuellH = 0, fuellF = 0, registerHoeher = 0, listeHoeher = 0;
  const bsp = [];
  const quellen = {};
  R.rows.forEach(r => {
    const k = nl(r[iS]); const g = byLat[k];
    String(r[iSrc] || '').split(/[,;]/).map(x => x.trim()).filter(Boolean).forEach(q => { const key = q.replace(/\s*\(.*$/, '').slice(0, 24); quellen[key] = (quellen[key] || 0) + 1; });
    if (!g) return;
    treffer++;
    const mn = r[iMin] === 'NULL' ? null : Number(r[iMin]), mx = r[iMax] === 'NULL' ? null : Number(r[iMax]);
    const hatFarbe = r[iCol] !== 'NULL' && r[iCol].trim() !== '';
    g.forEach(s => {
      const b = band(s);
      if (!b) { if (mx != null) fuellH++; if (hatFarbe && !String(s.color || '').trim()) fuellF++; return; }
      if (mx == null) return;
      beide++;
      const lo = mn == null ? 0 : mn;
      if (b.von === lo && b.bis === mx) gleich++;
      else {
        if (Math.max(b.von, lo) <= Math.min(b.bis, mx)) ueberlapp++; else weit++;
        if (lo > b.von) registerHoeher++; else if (lo < b.von) listeHoeher++;
        if (bsp.length < 5) bsp.push('    ' + s.name + ' (' + k + '): Liste ' + b.von + '–' + b.bis + ' · Register ' + lo + '–' + mx);
      }
    });
  });
  console.log('\n  Pilz-Register (v29.88): ' + R.rows.length + ' Zeilen · Treffer in der Liste: ' + treffer);
  console.log('    Luecken, die sich fuellen liessen: Farbe ' + fuellF + ' · Hoehe ' + fuellH);
  console.log('    beide haben eine Hoehe: ' + beide + ' · identisch: ' + gleich + ' · ueberlappend: ' + ueberlapp + ' · getrennt: ' + weit);
  console.log('    Richtung der Abweichung: Register-Untergrenze hoeher in ' + registerHoeher + ' Faellen, Liste hoeher in ' + listeHoeher + (registerHoeher > 5 * Math.max(1, listeHoeher) ? '  ← SYSTEMATISCH, nicht zufaellig' : ''));
  bsp.forEach(x => console.log(x));
  const top = Object.entries(quellen).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0] + ' (' + x[1] + ')').join(', ');
  console.log('    haeufigste Quellen: ' + top);
}

// ── 2 · Baum-Spezifikationen ───────────────────────────────────────────────
{
  const B = ladeSnapshot('v30_00_tree_planting_specs_snapshot.sql');
  const iS = B.idx('scientific_name'), iMax = B.idx('altitude_max_m'), iSrc = B.idx('source');
  let treffer = 0, beide = 0, gleich = 0, nah = 0, weit = 0, fuell = 0, snapHoeher = 0, listeHoeher = 0;
  const bsp = [];
  B.rows.forEach(r => {
    const k = nl(r[iS]); const g = byLat[k]; if (!g) return;
    treffer++;
    const mx = r[iMax] === 'NULL' ? null : Number(r[iMax]);
    g.forEach(s => {
      const b = band(s);
      if (!b) { if (mx != null) fuell++; return; }
      if (mx == null) return;
      beide++;
      if (b.bis === mx) gleich++;
      else {
        if (Math.abs(b.bis - mx) <= 300) nah++; else weit++;
        if (mx > b.bis) snapHoeher++; else listeHoeher++;
        if (bsp.length < 5 && Math.abs(b.bis - mx) > 300) bsp.push('    ' + s.name + ' (' + k + '): Liste bis ' + b.bis + ' · Snapshot bis ' + mx);
      }
    });
  });
  console.log('\n  Baum-Spezifikationen (v30.00): ' + B.rows.length + ' Zeilen · Treffer in der Liste: ' + treffer);
  console.log('    Luecken, die sich fuellen liessen: Hoehe ' + fuell + ' (keine Farbspalte)');
  console.log('    beide haben eine Obergrenze: ' + beide + ' · identisch: ' + gleich + ' · bis 300 m auseinander: ' + nah + ' · weiter: ' + weit);
  console.log('    Richtung: Snapshot hoeher in ' + snapHoeher + ', Liste hoeher in ' + listeHoeher + '  (keine klare Richtung = zwei Quellen, nicht eine Konvention)');
  bsp.forEach(x => console.log(x));
}

console.log('\n  Nichts geschrieben. Die Uebernahme braucht zuerst die Entscheidung, welche');
console.log('  Hoehen-Konvention gilt — siehe docs/ARTEN-DATEN.md §3.3 und §7.\n');
