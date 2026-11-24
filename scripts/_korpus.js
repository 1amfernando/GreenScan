// _korpus.js — der eine Text, in dem eine NENNUNG gezaehlt wird.
//
// Zwei Pruefstaende stellen dieselbe Frage von zwei Seiten:
//   robust_check C2   — hat eine Funktion ueberhaupt eine zweite Nennung?
//   statik_check S5   — stehen ALLE weiteren Nennungen im eigenen Rumpf?
// Beide muessen denselben Korpus zaehlen, sonst sind es zwei Rechnungen fuer
// eine Frage (CLAUDE.md §7.1, v33.40). Bis v33.56 stand er inline in
// robust_check; die Regeln darin sind unveraendert uebernommen:
//
//   - index.html ganz (Quelltext, onclick-Zeichenketten, MENU_ITEMS, …),
//     dazu sw.js, die zwei kleinen Seiten, scripts/*.js|py, alle Migrationen,
//     die Java-Quellen der Android-Huelle (sie ruft Funktionen der Seite per
//     evaluateJavascript, v33.53) und jede Edge-Function.
//   - `ohne` nimmt Dateien heraus: ein Pruefstand, der Namen in einer Liste
//     DEKLARIERT, waere sonst seine eigene zweite Nennung (v32.96).
//   - NUR ganze Kommentarzeilen werden gestrichen. Ein `/*` in einer
//     Zeichenkette (accept="image/*") liesse einen Block-Kommentar-Streicher
//     den halben Rest verschlucken.
//   - `window.X = X;` ist keine Nennung — die eigene Ausfuhr nennt den Namen
//     zweimal in einer Zeile (v32.96).
'use strict';
const fs = require('fs');
const path = require('path');

function ohneKommentarzeilen(s) {
  return s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/^[ \t]*\*.*$/gm, '');
}
function ohneEigeneAusfuhr(s) {
  return s.replace(/window\.([A-Za-z_$][\w$]*)\s*=\s*\1\s*;?/g, '');
}
function bereinigt(s) { return ohneEigeneAusfuhr(ohneKommentarzeilen(s)); }

// → { korpus, dateien, zaehl }  (zaehl: Map Name → Anzahl im bereinigten Korpus)
function nennungsKorpus(wurzel, ohne) {
  const aus = new Set((ohne || []).map(f => path.normalize(f)));
  const idx = fs.readFileSync(path.join(wurzel, 'index.html'), 'utf8');
  const dateien = ['sw.js', 'install.html', 'offline.html'];
  const sammle = (d, re) => { try { fs.readdirSync(path.join(wurzel, d)).filter(f => re.test(f)).forEach(f => dateien.push(path.join(d, f))); } catch (_) {} };
  sammle('scripts', /\.(js|py)$/);
  sammle(path.join('supabase', 'migrations'), /\.sql$/);
  sammle(path.join('android', 'src', 'ch', 'greenscan', 'app'), /\.java$/);
  for (let i = dateien.length - 1; i >= 0; i--) if (aus.has(path.normalize(dateien[i]))) dateien.splice(i, 1);
  try {
    fs.readdirSync(path.join(wurzel, 'supabase', 'functions')).forEach(f => {
      const p = path.join('supabase', 'functions', f, 'index.ts');
      if (fs.existsSync(path.join(wurzel, p))) dateien.push(p);
    });
  } catch (_) {}
  let korpus = idx;
  for (const f of dateien) { try { korpus += '\n' + fs.readFileSync(path.join(wurzel, f), 'utf8'); } catch (_) {} }
  korpus = bereinigt(korpus);
  const zaehl = new Map();
  for (const m of korpus.matchAll(/[A-Za-z_$][\w$]*/g)) zaehl.set(m[0], (zaehl.get(m[0]) || 0) + 1);
  return { korpus, dateien, zaehl, index: idx };
}

module.exports = { nennungsKorpus, bereinigt };
