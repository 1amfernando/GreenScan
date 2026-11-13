// Messung (nur lesen): MENU_ITEMS aus index.html herausloesen und die Wertung von searchMenu nachrechnen.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
const a = src.indexOf('const MENU_ITEMS = [');
const b = src.indexOf('];', src.indexOf("label:'📊 Mein Profil'", a)) + 2;
const MENU_ITEMS = new Function(src.slice(a, b).replace('const MENU_ITEMS =', 'return') )();
console.log('Menueeintraege:', MENU_ITEMS.length);
for (const q of process.argv.slice(3)) {
  const treffer = MENU_ITEMS.map(item => {
    let score = 0;
    const label = item.label.toLowerCase(), sub = String(item.sub || '').toLowerCase();
    if (label.includes(q)) score += 10;
    if (sub.includes(q)) score += 5;
    (item.tags || []).forEach(tag => { if (tag.includes(q)) score += 8; if (q.includes(tag)) score += 6; });
    return { item, score };
  }).filter(x => x.score > 0).sort((x, y) => y.score - x.score);
  console.log('Suche "' + q + '" →', treffer.length ? treffer.slice(0, 4).map(t => t.item.label + ' [' + t.score + ']').join(' · ') : 'KEIN Menueeintrag');
}
