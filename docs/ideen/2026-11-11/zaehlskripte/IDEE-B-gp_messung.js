// Messung (nur lesen): gsGegenprobeRender aus index.html herausloesen und mit
// WIDERSPRUECHLICHEN KI-Antworten fahren. Kein Eingriff ins Repo.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
const a = src.indexOf('function gsGegenprobeRender(g, r) {');
const b = src.indexOf('window.gsGegenprobeRender = gsGegenprobeRender;', a);
if (a < 0 || b < 0) { console.log('Funktion nicht gefunden'); process.exit(2); }
const fn = src.slice(a, b);
const host = { innerHTML: '' };
const document = { getElementById: (id) => (id === 'gs-gegenprobe' ? host : null) };
const window = {};
const render = new Function('document', 'window', fn + '\nreturn gsGegenprobeRender;')(document, window);
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const faelle = [
  { name: 'widerlegt + verzehr ja', g: { urteil: 'widerlegt', vertrauen: 20, dagegen: ['Blattbasis fleischig'], dafuer: [], verzehr: 'ja' } },
  { name: 'zweifel + verzehr ja',   g: { urteil: 'zweifel',   vertrauen: 50, dagegen: [], dafuer: [], verzehr: 'ja' } },
  { name: 'bestaetigt + verzehr ja (Pilz)', g: { urteil: 'bestaetigt', vertrauen: 90, dagegen: [], dafuer: [], verzehr: 'ja' }, r: { name: 'Wiesenchampignon', category: 'pilz', cat: 'pilz' } },
  { name: 'bestaetigt + verzehr JA (Grossschreibung)', g: { urteil: 'Bestaetigt', vertrauen: 90, verzehr: 'JA' } },
  { name: 'unbekanntes urteil + verzehr ja', g: { urteil: 'ok', verzehr: 'ja' } },
];
for (const f of faelle) {
  host.innerHTML = '';
  render(f.g, f.r || { name: 'Bärlauch' });
  const t = text(host.innerHTML);
  const kopf = t.slice(0, 60);
  const zusage = /Verzehr für vertretbar/.test(t);
  const verbot = /Iss das nicht|nicht verzehren/i.test(t);
  console.log(`${f.name.padEnd(46)} | Kopf: ${kopf.padEnd(60)} | Zusage "vertretbar": ${zusage} | Verbot im selben Text: ${verbot}`);
}
