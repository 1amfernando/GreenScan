// Alle Kalender-Verweise { fn: '<name>' } einsammeln und pruefen, ob es die Funktion gibt (nur lesen).
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
const namen = new Set();
const re = /verweis\s*[:=]\s*(?:\([^?]*\?\s*)?\{\s*fn:\s*'([A-Za-z0-9_]+)'/g;
let m; while ((m = re.exec(src))) namen.add(m[1]);
for (const n of [...namen].sort()) {
  const defs = [
    new RegExp('function\\s+' + n + '\\s*\\('),
    new RegExp('window\\.' + n + '\\s*=\\s*(async\\s+)?function'),
    new RegExp('window\\.' + n + '\\s*=\\s*[A-Za-z_]'),
    new RegExp('(?:var|let|const)\\s+' + n + '\\s*=\\s*(async\\s+)?(function|\\()'),
  ].filter(r => r.test(src)).length;
  const nenn = (src.match(new RegExp('\\b' + n + '\\b', 'g')) || []).length;
  console.log(n.padEnd(28), 'Definitionen:', defs, ' Nennungen:', nenn, defs ? '' : '  <-- KEINE DEFINITION');
}
