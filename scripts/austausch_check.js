#!/usr/bin/env node
// austausch_check.js — kommt an, was eine KI-Sitzung der naechsten sagt?
//
//   node scripts/austausch_check.js
//
// Alle anderen Pruefstaende fragen, ob die APP stimmt. Dieser fragt, ob das
// stimmt, was die Sitzungen EINANDER hinterlassen: das Brett
// (docs/austausch/eintraege/, Werkzeug scripts/austausch.js) und die Zahlen in
// den Uebergabe-Dokumenten (CLAUDE.md, STATUS.md §1, README.md, docs/memory).
//
// Anlass (10.11.2026, Fernando): „Alle Agenten müssen sich austauschen …".
// Gemessen: genau EINE Uebergabe-Pflicht hatte einen Ausloeser (robust_check
// „Memory", nur Namen). Fuer dieselbe Suite standen 30 · 35 · 38 · 39
// Pruefstaende in sechs Dateien, 219 Migrationen bei 223; CLAUDE.md §5 verwies
// auf vier Abschnitte, die es nie gab; und 125 nie gemergte Branches trugen
// Befunde, die keine andere Sitzung je sah. „Eine Regel ohne Ausloeser ist
// eine Bitte" (CLAUDE.md §3.1, v33.01) — hier ist der Ausloeser.
//
// Drei Gruppen:
//   A · die WARE: das echte Brett (Form, Bezuege, Waechter, Anker und App-Namen, genau eine
//       Uebergabe je Version, kein offener Anspruch im Baum, Verweise aus den Dokumenten)
//   B · die UEBERGABE-DOKUMENTE: Zahlen an einen Befehl gebunden, Suite vollstaendig
//   C · die REGEL selbst: jede Pruefung laeuft gegen einen guten UND einen
//       schlechten gebauten Fall — eine Pruefung, die alles annimmt, wird hier rot.
//
// Grenze: geprueft wird der ARBEITSBAUM. Was nur auf einem anderen Branch
// liegt, sieht dieser Pruefstand nicht (das Werkzeug schon — Fall C5 prueft
// genau das an zwei gebauten Branches). Und: ob ein Eintrag KLUG ist, kann
// niemand rechnen; gerechnet wird, ob er pruefbar, verbunden und ehrlich ist.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const A = require('./_austausch.js');

const WURZEL = path.resolve(__dirname, '..');
const lies = (rel) => fs.readFileSync(path.join(WURZEL, rel), 'utf8');
const gibt = (rel) => fs.existsSync(path.join(WURZEL, rel));
const WERKZEUG = path.join(__dirname, 'austausch.js');

let _src = null;
const quelle = () => (_src == null ? (_src = lies('index.html') + '\n' + (gibt('sw.js') ? lies('sw.js') : '')) : _src);
const tmp = (name) => fs.mkdtempSync(path.join(os.tmpdir(), 'austausch-' + name + '-'));
const weg = (d) => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} };

// ── Was die Uebergabe-Dokumente als GEGENWART nennen. Die Liste ist die
//    Pruefung (Vorbild: risiko_check R3). Jede Stelle ist an ihrem SATZ
//    verankert; wer den Satz umschreibt, zieht den Anker hier nach — sonst
//    meldet der Fall „Anker nicht gefunden", und das ist richtig so.
//    Historische Messungen („31 Pruefstaende", „0 von 4'342") stehen NICHT
//    hier: ein Protokoll wird nicht umgeschrieben (CLAUDE.md v32.94).
const MESSEN = {
  pruefstaende: (w) => (fs.readFileSync(path.join(w, 'scripts/pruefstaende.sh'), 'utf8').match(/^[ \t]*(?:TAILN=\d+[ \t]+)?run[ \t]+\S+/gm) || []).length,
  migrationen: (w) => fs.readdirSync(path.join(w, 'supabase/migrations')).filter(f => /\.sql$/.test(f)).length,
  edge: (w) => fs.readdirSync(path.join(w, 'supabase/functions'), { withFileTypes: true }).filter(d => d.isDirectory() && d.name !== '_shared').length,
  postgres: (w) => fs.readdirSync(path.join(w, 'scripts')).filter(f => /_check\.js$/.test(f) && f !== 'austausch_check.js' && /GS_PG_URL/.test(fs.readFileSync(path.join(w, 'scripts', f), 'utf8'))).length,
  memory: (w) => fs.readdirSync(path.join(w, 'docs/memory')).filter(f => /\.md$/.test(f)).length,
  memory_nummeriert: (w) => fs.readdirSync(path.join(w, 'docs/memory')).filter(f => /^\d\d-.*\.md$/.test(f)).length,
};
const BEFEHL = {
  pruefstaende: 'grep -cE "^[ \\t]*(TAILN=[0-9]+ +)?run " scripts/pruefstaende.sh',
  migrationen: 'ls supabase/migrations/*.sql | wc -l',
  edge: 'ls -d supabase/functions/*/ | grep -vc _shared',
  postgres: 'grep -l GS_PG_URL scripts/*_check.js | grep -vc austausch_check',
  memory: 'ls docs/memory/*.md | wc -l',
  memory_nummeriert: 'ls docs/memory/[0-9][0-9]-*.md | wc -l',
};
const ZAHLEN = [
  { was: 'pruefstaende', datei: 'CLAUDE.md', anker: /# (\d+) Prüfstände \(§7\.1\) \+ pruefstaende\.sh \(fährt alle (\d+)/ },
  { was: 'pruefstaende', datei: 'CLAUDE.md', anker: /# ALLE (\d+) nacheinander, ein Bericht, ein Exit-Code/ },
  { was: 'pruefstaende', datei: 'STATUS.md', von: '## 1 · Aktueller Stand', bis: '\n## 2 · ', anker: /\*\*(\d+)\*\* `\*_check` in `scripts\/`/ },
  { was: 'pruefstaende', datei: 'STATUS.md', von: '## 1 · Aktueller Stand', bis: '\n## 2 · ', anker: /fährt \*\*alle (\d+)\*\*/ },
  { was: 'pruefstaende', datei: 'docs/memory/01-projekt.md', anker: /(\d+) Pruefstaende \+ _seed\.js/ },
  { was: 'pruefstaende', datei: 'docs/memory/04-pruefstaende.md', anker: /^# 04 · Die (\d+) Pruefstaende/m },
  { was: 'pruefstaende', datei: 'docs/memory/04-pruefstaende.md', anker: /Erwartung: "(\d+) Pruefstaende · rot: 0/ },
  { was: 'pruefstaende', datei: 'docs/memory/04-pruefstaende.md', anker: /\| `pruefstaende` \| ALLE (\d+) nacheinander/ },
  { was: 'pruefstaende', datei: 'docs/memory/04-pruefstaende.md', anker: /die Regeln, die alle (\d+) teilen/ },
  { was: 'postgres', datei: 'docs/memory/04-pruefstaende.md', anker: /(\d+) brauchen ein lokales Postgres/ },
  { was: 'postgres', datei: 'docs/memory/README.md', anker: /lokales Postgres fuer (\d+)\s+davon/ },
  { was: 'pruefstaende', datei: 'docs/memory/08-arbeitsweise.md', anker: /Erwartung: „(\d+) Pruefstaende · rot: 0/ },
  { was: 'pruefstaende', datei: 'docs/memory/README.md', anker: /Welcher der (\d+) Pruefstaende/ },
  { was: 'migrationen', datei: 'CLAUDE.md', anker: /# (\d+) SQL-Migrationen/ },
  { was: 'migrationen', datei: 'STATUS.md', von: '## 1 · Aktueller Stand', bis: '\n## 2 · ', anker: /\*\*(\d+) Migrationen\*\* \(/ },
  { was: 'migrationen', datei: 'README.md', anker: /\*\*(\d+) Migrationen\*\*/ },
  { was: 'edge', datei: 'CLAUDE.md', anker: /# (\d+) Edge-Function-Verzeichnisse/ },
  { was: 'edge', datei: 'STATUS.md', von: '## 1 · Aktueller Stand', bis: '\n## 2 · ', anker: /\*\*(\d+) Edge-Function-Verzeichnisse\*\*/ },
  { was: 'edge', datei: 'README.md', anker: /\*\*(\d+)\s+Edge-Function-Verzeichnisse\*\*/ },
  { was: 'memory', datei: 'CLAUDE.md', anker: /`docs\/memory\/`\*\* — (\d+) Dateien/ },
  { was: 'memory_nummeriert', datei: 'docs/memory/README.md', anker: /Diese (\d+) nummerierten Dateien/ },
];
// Die eine Rechnung dahinter — auch der gebaute Fall C6 ruft sie.
function zahlenPruefen(wurzel, liste) {
  const f = []; let stellen = 0;
  const mess = {};
  for (const z of liste) {
    if (!(z.was in mess)) { try { mess[z.was] = MESSEN[z.was](wurzel); } catch (e) { mess[z.was] = null; f.push(z.was + ': nicht messbar (' + String(e.message).split('\n')[0] + ')'); } }
    if (mess[z.was] == null) continue;
    let t;
    try { t = fs.readFileSync(path.join(wurzel, z.datei), 'utf8'); } catch (_) { f.push(z.datei + ': Datei fehlt'); continue; }
    // Ein Abschnitt grenzt ein: STATUS.md §0 ist ein Tagebuch und zitiert alte
    // Staende woertlich — gebunden ist nur §1, die Gegenwart.
    if (z.von) { const a = t.indexOf(z.von); if (a < 0) { f.push(z.datei + ': Abschnitt „' + z.von + '" nicht gefunden'); continue; } const e = z.bis ? t.indexOf(z.bis, a + z.von.length) : -1; t = t.slice(a, e < 0 ? undefined : e); }
    const alle = [...t.matchAll(new RegExp(z.anker.source, z.anker.flags.replace('g', '') + 'g'))];
    if (!alle.length) { f.push(z.datei + ': Anker nicht gefunden (' + z.anker.source.slice(0, 48) + '…) — Satz umgeschrieben? Dann die Stelle in ZAHLEN nachziehen'); continue; }
    // Ein Anker, der zweimal trifft, bindet nichts: welche Stelle gilt?
    if (alle.length > 1) { f.push(z.datei + ': Anker trifft ' + alle.length + ' Stellen (' + z.anker.source.slice(0, 48) + '…) — er muss EINEN Satz meinen'); continue; }
    const m = alle[0];
    for (const g of m.slice(1)) {
      stellen++;
      if (Number(g) !== mess[z.was]) f.push(z.datei + ': nennt ' + g + ' ' + z.was + ', gemessen ' + mess[z.was] + '  [' + BEFEHL[z.was] + ']');
    }
  }
  return { fehler: f, stellen, mess };
}

// ── `brett:<id>` ist die Zitierform ausserhalb des Bretts. Ein Zitat, das auf
//    nichts zeigt, ist ein Verweis ins Leere (dieselbe Klasse wie „Fall 16").
function zitatePruefen(wurzel, ids) {
  const dateien = [];
  const sammle = (rel) => { try { fs.readdirSync(path.join(wurzel, rel)).filter(f => /\.md$/.test(f)).forEach(f => dateien.push(path.posix.join(rel, f))); } catch (_) {} };
  sammle('.'); sammle('docs'); sammle('docs/memory'); sammle('docs/austausch');
  const fehlt = []; let gefunden = 0, mit = 0;
  for (const d of dateien) {
    let t; try { t = fs.readFileSync(path.join(wurzel, d), 'utf8'); } catch (_) { continue; }
    const z = [...t.matchAll(/\bbrett:(\d{4}-\d{2}-\d{2}-[0-9a-f]{4})\b/g)].map(m => m[1]);
    if (z.length) mit++;
    for (const id of z) { gefunden++; if (!ids.has(id)) fehlt.push(d + ' → brett:' + id); }
  }
  return { fehlt, gefunden, dateien: mit };
}
// ── Haelt ein Austausch-Skript eine App-Funktion am Leben? robust_check C2 zaehlt
//    JEDEN Bezeichner in scripts/*.js als Nennung. Geprueft werden Namen mit
//    App-Praefix (gs…, _gs…, dq…, sb…) — die allgemeine Fassung („kein Bezeichner,
//    den die App definiert") ist nicht erfuellbar: die App definiert Funktionen
//    namens k, n, text, regel.
function maskierungPruefen(quelltextApp, skripte) {
  const defs = new Set();
  for (const m of quelltextApp.matchAll(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) defs.add(m[1]);
  for (const m of quelltextApp.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function/g)) defs.add(m[1]);
  const PRAEFIX = /^(_?gs[A-Z]|dq[A-Z]|sb[A-Z]|_gs[a-z])/;
  const treffer = [];
  for (const [name, text] of skripte) {
    // Dieselbe Sicht wie robust_check: ganze Kommentarzeilen zaehlen nicht.
    const t = text.replace(/^[ \t]*\/\/.*$/gm, '');
    for (const w of new Set(t.match(/[A-Za-z_$][\w$]*/g) || [])) if (PRAEFIX.test(w) && defs.has(w)) treffer.push(name + ': ' + w);
  }
  return { treffer, defs: defs.size };
}

// ── Bausteine fuer die gebauten Faelle.
const gut = (extra) => Object.assign({ id: '2026-11-10-aaaa', art: 'befund', datum: '2026-11-10', von: 'pruefstand/a', titel: 'Ein guter Befund', beleg: ['datei.js:12 → 3 Stellen'] }, extra || {});
function brettAus(eintraege) {
  // Ein Brett im Speicher, in der Form, die brettLesen liefert.
  const liste = eintraege.map(e => { const k = Object.assign({}, e); Object.defineProperty(k, '_datei', { value: e.id + '-' + e.art + '-' + A.slug(e.titel) + '.json', enumerable: false }); Object.defineProperty(k, '_quelle', { value: 'Arbeitsbaum', enumerable: false }); return k; });
  return { eintraege: liste, unlesbar: [], doppelt: [], abweichend: [], quellen: ['Arbeitsbaum'] };
}
function werkzeug(wurzel, args, von) {
  const env = Object.assign({}, process.env, { AUSTAUSCH_WURZEL: wurzel, AUSTAUSCH_VON: von || 'pruefstand/a' });
  const r = cp.spawnSync(process.execPath, [WERKZEUG].concat(args), { env, encoding: 'utf8' });
  return { code: r.status, aus: (r.stdout || '') + (r.stderr || '') };
}
function gitIn(dir, args) {
  const r = cp.spawnSync('git', ['-C', dir, '-c', 'user.email=pruefstand@example.com', '-c', 'user.name=pruefstand', '-c', 'commit.gpgsign=false'].concat(args), { encoding: 'utf8' });
  if (r.error || r.status !== 0) throw new Error('git ' + args.join(' ') + ': ' + ((r.stderr || '') + (r.error ? r.error.message : '')).split('\n')[0]);
  return r.stdout;
}
const gitDa = () => { const r = cp.spawnSync('git', ['--version'], { encoding: 'utf8' }); return !r.error && r.status === 0; };

let _brett = null;
const brett = () => (_brett || (_brett = A.brettLesen(WURZEL, { alleRefs: false })));

const FAELLE = [
  // ───────────────────────────── A · die Ware
  {
    name: 'A1 · Das Brett · jeder Eintrag ist lesbar, traegt die Pflichtfelder seiner Art, heisst wie seine id — und nichts darin sieht aus wie ein Geheimnis (das Repo ist public)',
    lauf: () => {
      const b = brett();
      if (!b.eintraege.length && !b.unlesbar.length) return { offen: true, warum: 'docs/austausch/eintraege/ ist leer — es gibt nichts zu pruefen, und das ist kein Gruen' };
      const f = A.brettPruefen(b).filter(x => !/den Eintrag gibt es nicht|zeigt auf/.test(x.grund));
      if (f.length) return { ok: false, warum: f.length + ' Maengel: ' + f.slice(0, 6).map(x => x.wo + ' — ' + x.grund).join(' · ') + (f.length > 6 ? ' · +' + (f.length - 6) + ' weitere (node scripts/austausch.js pruefen)' : '') };
      const proArt = {};
      for (const e of b.eintraege) proArt[e.art] = (proArt[e.art] || 0) + 1;
      return { ok: true, info: b.eintraege.length + ' Eintraege: ' + Object.keys(A.ARTEN).filter(k => proArt[k]).map(k => proArt[k] + ' ' + k).join(' · ') };
    },
  },
  {
    name: 'A2 · Bezuege · jeder Bezug zeigt auf einen Eintrag, den es gibt, und auf die richtige Art (beantwortet → Frage, gehoert_zu → Fehlerklasse, geschlossen wird nie eine Antwort)',
    lauf: () => {
      const b = brett();
      if (!b.eintraege.length) return { offen: true, warum: 'Brett leer' };
      const f = A.brettPruefen(b).filter(x => /den Eintrag gibt es nicht|zeigt auf/.test(x.grund));
      if (f.length) return { ok: false, warum: f.length + ' Bezuege ins Leere oder auf die falsche Art: ' + f.slice(0, 5).map(x => x.wo + ' — ' + x.grund).join(' · ') };
      const n = b.eintraege.reduce((s, e) => s + A.alsListe(e.bezug).length, 0);
      const ab = A.ableiten(b.eintraege);
      const z = {};
      for (const e of b.eintraege) { const k = ab.zustand.get(e.id).z; z[k] = (z[k] || 0) + 1; }
      return { ok: true, info: n + ' Bezuege, alle mit Ziel · Zustand gerechnet: ' + Object.keys(z).sort().map(k => z[k] + ' ' + k).join(' · ') };
    },
  },
  {
    name: 'A3 · Waechter · jede Fehlerklasse nennt als Waechter eine Datei, die es gibt, und eine Fallkennung, die in ihr STEHT — oder sagt ausdruecklich, dass keiner sie bewacht',
    lauf: () => {
      const b = brett(), kl = b.eintraege.filter(e => e.art === 'klasse');
      if (!kl.length) return { offen: true, warum: 'keine Fehlerklasse auf dem Brett' };
      const f = []; let n = 0, ohne = 0;
      const cache = {}, rueck = A.ableiten(b.eintraege).rueck;
      for (const e of kl) {
        // Die Klasse, wie sie heute gilt: mit den Waechtern aus Nachtraegen.
        const w = A.klasseWirksam(e, rueck).waechter;
        if (!w.length) { ohne++; continue; }
        for (const x of w) {
          n++;
          if (!x || !x.datei || !x.fall) continue;   // Form meldet A1
          if (x.fall.trim().length < 3) { f.push(e.id + ': Fallkennung „' + x.fall + '" ist zu kurz, um etwas zu belegen'); continue; }
          if (!gibt(x.datei)) { f.push(e.id + ': ' + x.datei + ' gibt es nicht'); continue; }
          const t = cache[x.datei] || (cache[x.datei] = lies(x.datei));
          if (t.indexOf(x.fall) < 0) f.push(e.id + ': „' + x.fall + '" steht nicht in ' + x.datei);
        }
      }
      // Gegenrichtung: ein Register, in dem KEINE Klasse einen Waechter nennt, waere hier still gruen.
      if (!n) return { ok: false, warum: kl.length + ' Fehlerklassen, aber keine nennt einen Waechter — der Fall haette nichts gemessen' };
      if (f.length) return { ok: false, warum: f.length + ' Waechter ins Leere: ' + f.slice(0, 5).join(' · ') + (f.length > 5 ? ' · +' + (f.length - 5) : '') };
      return { ok: true, info: kl.length + ' Klassen · ' + n + ' Waechter in ' + Object.keys(cache).length + ' Dateien, alle Fallkennungen gefunden · ' + ohne + ' Klassen ausdruecklich OHNE Waechter' };
    },
  },
  {
    name: 'A4 · App-Namen · was ein OFFENER Eintrag als Stichwort ueber den Code sagt, gibt es im Quelltext noch (eine Idee darf etwas nennen, das es noch nicht gibt)',
    lauf: () => {
      const b = brett();
      if (!b.eintraege.length) return { offen: true, warum: 'Brett leer' };
      const ab = A.ableiten(b.eintraege), src = quelle();
      const f = []; let n = 0;
      for (const e of b.eintraege) {
        if (ab.zustand.get(e.id).z !== 'offen' || e.art === 'idee') continue;
        for (const name of A.appNamen(e)) { n++; if (!A.nameImQuelltext(src, name)) f.push(e.id + ': ' + name); }
      }
      if (f.length) return { ok: false, warum: f.length + ' Namen ohne Gegenstueck im Quelltext — der Eintrag ist ueberholt: mit `schliesse <id>` abschliessen oder mit einem neuen ersetzen (' + f.slice(0, 6).join(' · ') + ')' };
      // Gegenrichtung: sieht die Suche ueberhaupt etwas? Ein Name, den es nie gab, muss fehlen.
      if (A.nameImQuelltext(src, 'gsDiesenNamenGibtEsNie')) return { ok: false, warum: 'die Namenssuche findet einen erfundenen Namen — sie misst nichts' };
      return { ok: true, info: n + ' App-Namen in offenen Eintraegen, alle im Quelltext' };
    },
  },
  {
    name: 'A4b · Anker · die Stelle, an die ein OFFENER Eintrag gebunden ist, steht noch woertlich in ihrer Datei — wer sie aendert, liest den Eintrag (und schliesst ihn oder verankert neu)',
    lauf: () => {
      const b = brett();
      if (!b.eintraege.length) return { offen: true, warum: 'Brett leer' };
      const r = A.ankerPruefen(b.eintraege, (rel) => (gibt(rel) ? lies(rel) : null));
      if (r.verloren.length) return { ok: false, warum: r.verloren.length + ' Anker verloren — du hast eine Stelle geaendert, zu der ein offener Eintrag gehoert. Lies ihn (node scripts/austausch.js zeige <id>), dann: `schliesse <id> …` (behoben/ueberholt) oder `antworte <id> --anker "datei::neuer text"` (gilt weiter). ' + r.verloren.slice(0, 5).map(x => x.id + ' „' + String(x.titel).slice(0, 70) + '" — ' + x.datei + ': ' + x.grund).join(' · ') };
      // Gegenrichtung: ein Brett, auf dem KEIN Eintrag einen Anker traegt, haette hier nichts gemessen.
      if (!r.geprueft) return { offen: true, warum: 'kein offener Eintrag traegt einen Anker — es gibt nichts zu pruefen' };
      return { ok: true, info: r.geprueft + ' Anker an ' + r.eintraege + ' offenen Eintraegen, alle stehen woertlich in ihrer Datei' };
    },
  },
  {
    name: 'A5 · Uebergabe · zur laufenden Version gibt es GENAU EINE gueltige Uebergabe (eine ersetzte zaehlt nicht), und sie sagt etwas ueber Offenes — zwei waeren zwei Sitzungen mit derselben Versionsnummer',
    lauf: () => {
      const m = lies('index.html').match(/\bGS_VERSION\s*=\s*'(v\d+\.\d+)'/);
      if (!m) return { ok: false, warum: 'GS_VERSION in index.html nicht gefunden' };
      const b = brett(), zu = A.ableiten(b.eintraege).zustand;
      const ueb = b.eintraege.filter(e => e.art === 'uebergabe' && e.version === m[1] && zu.get(e.id).z === 'notiz');
      if (!ueb.length) return { ok: false, warum: 'keine Uebergabe fuer ' + m[1] + ' — der Bump verlangt sie wie den GS_RELEASES-Eintrag: node scripts/austausch.js hilfe uebergabe' };
      // Fortgezaehlte Versionen kollidieren unter Parallelitaet (v33.08 wurde viermal vergeben).
      // Zwei gueltige Uebergaben fuer EINE Version sind genau dieser Fall — oder eine Korrektur ohne „ersetzt".
      if (ueb.length > 1) return { ok: false, warum: ueb.length + ' gueltige Uebergaben fuer ' + m[1] + ' (' + ueb.map(e => e.id + ' von ' + e.von).join(' · ') + ') — haben zwei Sitzungen dieselbe Version vergeben? Sonst die aeltere ersetzen: neu uebergabe … --bezug ersetzt:<id>' };
      const u = ueb[0];
      const n = ['offen', 'naechster_schritt', 'nicht_geprueft'].reduce((s, k) => s + A.alsListe(u[k]).length, 0);
      return { ok: true, info: m[1] + ' · ' + u.id + ' · ' + (n ? n + ' offene Punkte genannt' : 'nichts offen: ' + String(u.nichts_offen || '').slice(0, 60)) };
    },
  },
  {
    name: 'A6 · Kein offener Anspruch im Baum · „ich bin dran" lebt auf dem Branch der Sitzung; vor dem PR wird er geschlossen — gemergt stuende er fuer immer als „in Arbeit" auf main',
    lauf: () => {
      const b = brett();
      if (!b.eintraege.length) return { offen: true, warum: 'Brett leer' };
      const zu = A.ableiten(b.eintraege).zustand;
      const offen = b.eintraege.filter(e => e.art === 'anspruch' && zu.get(e.id).z === 'offen');
      if (offen.length) return { ok: false, warum: offen.length + ' offene Ansprueche: ' + offen.map(e => e.id + ' „' + String(e.titel).slice(0, 60) + '" (' + e.von + ')').join(' · ') + ' — fertig? `node scripts/austausch.js schliesse <id> --ergebnis erledigt --wohin "vXX.YY"`. Noch dran? Dann ist das hier richtig rot, bis der PR kommt.' };
      const alle = b.eintraege.filter(e => e.art === 'anspruch').length;
      return { ok: true, info: alle + ' Ansprueche im Baum, alle geschlossen' };
    },
  },
  {
    name: 'A7 · Verweise · jedes `brett:<id>` in STATUS.md, ROADMAP.md, CLAUDE.md, docs/ und docs/memory/ meint einen Eintrag, den es gibt',
    lauf: () => {
      const b = brett();
      if (!b.eintraege.length) return { offen: true, warum: 'Brett leer' };
      const r = zitatePruefen(WURZEL, new Set(b.eintraege.map(e => e.id)));
      if (r.fehlt.length) return { ok: false, warum: r.fehlt.length + ' Verweise ins Leere: ' + r.fehlt.slice(0, 6).join(' · ') };
      return { ok: true, info: r.gefunden + ' Verweise in ' + r.dateien + ' Dateien, alle mit Ziel' };
    },
  },
  // ───────────────────────────── B · die Uebergabe-Dokumente
  {
    name: 'B1 · Suite · jeder *_check in scripts/ steht in pruefstaende.sh, und jede run-Zeile nennt ein Skript, das es gibt',
    lauf: () => {
      const sh = lies('scripts/pruefstaende.sh');
      const zeilen = sh.match(/^[ \t]*(?:TAILN=\d+[ \t]+)?run[ \t]+.*$/gm) || [];
      const gefahren = new Set();
      for (const z of zeilen) { const m = z.match(/scripts\/([\w.-]+_check\.(?:js|py))/); if (m) gefahren.add(m[1]); }
      const da = fs.readdirSync(path.join(WURZEL, 'scripts')).filter(f => /_check\.(js|py)$/.test(f));
      const nieGefahren = da.filter(f => !gefahren.has(f)), ohneDatei = [...gefahren].filter(f => da.indexOf(f) < 0);
      const f = [];
      if (nieGefahren.length) f.push('in scripts/, aber in keiner run-Zeile (laeuft nie): ' + nieGefahren.join(', '));
      if (ohneDatei.length) f.push('run-Zeile ohne Datei: ' + ohneDatei.join(', '));
      if (zeilen.length !== gefahren.size) f.push(zeilen.length + ' run-Zeilen, aber ' + gefahren.size + ' verschiedene *_check — eine Zeile doppelt oder ohne Pruefstand');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: da.length + ' Pruefstaende in scripts/ = ' + zeilen.length + ' run-Zeilen' };
    },
  },
  {
    name: 'B2 · Zahlen · was CLAUDE.md, STATUS.md §1, README.md und docs/memory als GEGENWART nennen (Pruefstaende, Migrationen, Edge-Verzeichnisse, Gedaechtnis-Dateien, wie viele ein Postgres brauchen), stimmt mit dem Befehl ueberein',
    lauf: () => {
      const r = zahlenPruefen(WURZEL, ZAHLEN);
      if (r.fehler.length) return { ok: false, warum: r.fehler.length + ' Stellen daneben: ' + r.fehler.join(' · ') };
      return { ok: true, info: r.stellen + ' Zahlen an ' + ZAHLEN.length + ' Stellen · ' + Object.keys(r.mess).map(k => k + ' ' + r.mess[k]).join(' · ') };
    },
  },
  {
    name: 'B3 · Einstieg · jede Datei, mit der eine KI hier anfaengt, nennt das Brett — und docs/austausch/README.md erklaert jede Art und jeden Bezug, die das Werkzeug kennt',
    lauf: () => {
      const f = [];
      for (const d of ['CLAUDE.md', 'AGENTS.md', 'docs/memory/README.md', 'docs/memory/08-arbeitsweise.md', 'docs/memory/09-austausch.md']) {
        if (!gibt(d)) { f.push(d + ' fehlt'); continue; }
        if (lies(d).indexOf('scripts/austausch.js') < 0) f.push(d + ' nennt scripts/austausch.js nicht');
      }
      if (!gibt('docs/austausch/README.md')) f.push('docs/austausch/README.md fehlt');
      else {
        const t = lies('docs/austausch/README.md');
        const fehlt = Object.keys(A.ARTEN).concat(Object.keys(A.BEZUEGE)).filter(k => t.indexOf('`' + k + '`') < 0);
        if (fehlt.length) f.push('docs/austausch/README.md erklaert nicht: ' + fehlt.join(', '));
        // Gegenrichtung: was die Anleitung als Art in der Tabelle fuehrt, muss das Werkzeug kennen.
        const genannt = [...t.matchAll(/^\| `([a-z_]+)` \|/gm)].map(m => m[1]);
        const fremd = genannt.filter(k => !A.ARTEN[k] && !A.BEZUEGE[k]);
        if (fremd.length) f.push('docs/austausch/README.md nennt in einer Tabelle, was das Werkzeug nicht kennt: ' + fremd.join(', '));
        if (genannt.length < Object.keys(A.ARTEN).length) f.push('docs/austausch/README.md: nur ' + genannt.length + ' Tabellenzeilen mit `name` gefunden — das Muster greift nicht');
      }
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: '5 Einstiegsdateien nennen das Werkzeug · Anleitung deckt ' + Object.keys(A.ARTEN).length + ' Arten und ' + Object.keys(A.BEZUEGE).length + ' Bezuege, beide Richtungen' };
    },
  },
  {
    name: 'B4 · Agenten-Runde · der Workflow fuer Unteragenten ist da, laesst sich uebersetzen (meta zuerst, Phasen stimmen, nichts Verbotenes) und endet im Brett',
    lauf: () => {
      const rel = '.claude/workflows/austausch-runde.js';
      if (!gibt(rel)) return { ok: false, warum: rel + ' fehlt' };
      const t = lies(rel);
      const f = [];
      if (!/^export const meta = \{/.test(t)) f.push('beginnt nicht mit `export const meta = {` (erste Zeile, nichts davor) — das Werkzeug fuehrt ihn dann nicht');
      const m = t.match(/export const meta = (\{[\s\S]*?\n\})/);
      let meta = null;
      if (m) { try { meta = (new Function('return (' + m[1] + ')'))(); } catch (e) { f.push('meta ist kein reines Literal: ' + String(e.message).split('\n')[0]); } }
      if (meta) {
        if (meta.name !== 'austausch-runde') f.push('meta.name ist „' + meta.name + '", erwartet austausch-runde');
        const titel = new Set((meta.phases || []).map(p => p.title));
        const gerufen = [...t.matchAll(/\bphase\('([^']+)'\)/g)].map(x => x[1]).concat([...t.matchAll(/phase: '([^']+)'/g)].map(x => x[1]));
        const ohne = [...new Set(gerufen)].filter(p => !titel.has(p));
        if (ohne.length) f.push('Phase ohne Eintrag in meta.phases: ' + ohne.join(', '));
        if (!gerufen.length) f.push('keine phase() gefunden');
      }
      // Ein Workflow-Skript darf die Uhr und den Zufall nicht fragen (sonst laesst er sich nicht fortsetzen).
      const ohneKommentar = t.replace(/^[ \t]*\/\/.*$/gm, '');
      for (const [re, was] of [[/\bDate\.now\s*\(/, 'Date.now()'], [/\bMath\.random\s*\(/, 'Math.random()'], [/\bnew Date\s*\(\s*\)/, 'new Date()'], [/\bimport\s*\(/, 'import()']]) if (re.test(ohneKommentar)) f.push('ruft ' + was);
      if (t.indexOf('scripts/austausch.js') < 0 || t.indexOf('einspielen') < 0) f.push('endet nicht im Brett (kein `scripts/austausch.js einspielen`) — die Runde waere nach der Sitzung verloren');
      // Und er muss sich UEBERSETZEN lassen: als Rumpf einer async-Funktion, so wie das
      // Werkzeug ihn faehrt — ohne ihn auszufuehren. Ein Tippfehler faellt sonst erst auf,
      // wenn eine Sitzung die Runde startet.
      try {
        const Async = Object.getPrototypeOf(async function () {}).constructor;
        new Async('agent', 'parallel', 'pipeline', 'phase', 'log', 'args', 'budget', 'workflow', t.replace(/^export const meta/, 'const meta'));
      } catch (e) { f.push('laesst sich nicht uebersetzen: ' + String(e.message).split('\n')[0]); }
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: rel + ' · ' + (meta.phases || []).length + ' Phasen: ' + (meta.phases || []).map(p => p.title).join(' → ') };
    },
  },
  {
    name: 'B5 · Keine Maskierung · Werkzeug, Modul und Pruefstand nennen keinen Funktionsnamen der App mit App-Praefix (robust_check C2 zaehlt jede Nennung in scripts/ — eine tote Funktion lebte sonst hier weiter)',
    lauf: () => {
      const skripte = ['scripts/austausch.js', 'scripts/_austausch.js', 'scripts/austausch_check.js'].map(d => [d, lies(d)]);
      const r = maskierungPruefen(lies('index.html'), skripte);
      if (r.defs < 1000) return { ok: false, warum: 'nur ' + r.defs + ' Definitionen in index.html gefunden — das Muster greift nicht' };
      if (r.treffer.length) return { ok: false, warum: 'gleichnamig mit App-Funktionen — in den Beispielen und Bausteinen erfundene Namen nehmen: ' + r.treffer.join(' · ') };
      // Gegenrichtung an einem gebauten Skript: ein definierter Name MUSS auffallen, ein erfundener nicht.
      const probe = maskierungPruefen('function gsProbeDefiniert() {}\n'.repeat(1), [['a.js', "x('gsProbeDefiniert'); y('gsProbeErfunden');\n// gsProbeDefiniert in einer Kommentarzeile zaehlt nicht"]]);
      if (probe.treffer.join() !== 'a.js: gsProbeDefiniert') return { ok: false, warum: 'die Rechnung sieht den gebauten Fall nicht: ' + JSON.stringify(probe.treffer) };
      return { ok: true, info: r.defs + ' App-Definitionen · 0 mit App-Praefix in den drei Austausch-Skripten · gebauter Fall: definierter Name gemeldet, erfundener nicht' };
    },
  },
  // ───────────────────────────── C · die Regel selbst
  {
    name: 'C1 · Die Pruefung sieht Fehler · 27 gebaute kaputte Eintraege werden je mit dem RICHTIGEN Grund abgelehnt — und fuenf gute kommen ohne Einwand durch',
    lauf: () => {
      const lang = 'x'.repeat(A.TITEL_MAX + 1);
      const SCHLECHT = [
        ['Befund ohne Beleg', gut({ beleg: undefined }), /Befund ohne „beleg"/],
        ['Beleg leer', gut({ beleg: [] }), /Befund ohne „beleg"/],
        ['Idee ohne pruefbar', gut({ art: 'idee', beleg: undefined, nutzen: 'n' }), /Idee ohne „pruefbar"/],
        ['Art erfunden', gut({ art: 'gedanke' }), /art „gedanke" gibt es nicht/],
        ['Feld vertippt', gut({ belege: ['x'] }), /unbekanntes Feld „belege"/],
        ['id ohne Form', gut({ id: 'befund-1' }), /id fehlt oder hat nicht die Form/],
        ['id passt nicht zum Datum', gut({ datum: '2026-11-09' }), /id beginnt nicht mit dem datum/],
        ['Datum unmoeglich', gut({ id: '2026-02-30-aaaa', datum: '2026-02-30' }), /kein gueltiges JJJJ-MM-TT/],
        ['von fehlt', gut({ von: '' }), /von fehlt/],
        ['Titel zu lang', gut({ titel: lang }), /titel hat \d+ Zeichen/],
        ['Schluessel im Beleg', gut({ beleg: ['Kopfzeile x-api-key: ' + ['sk', 'ant', 'api03', 'AbCdEfGhIjKl'].join('-')] }), /wie ein Anthropic-Schluessel aussieht/],
        ['JWT im Text', gut({ text: 'Token ' + ['eyJ' + 'hbGciOiJIUzI1NiJ9', 'eyJ' + 'zdWIiOiIxMjM0NTY3ODkwIn0', 'abcDEF123456'].join('.') }), /wie ein JWT aussieht/],
        ['Adresse im Text', gut({ text: 'gemeldet von vorname.nachname' + '@' + 'posteo.de' }), /wie eine E-Mail-Adresse aussieht/],
        ['Sicherheit mit Weg', gut({ sicherheit: true, text: 'so geht es', details_bei: 'Fernando' }), /sicherheit: true — kein „text"/],
        ['Sicherheit ohne Ort', gut({ sicherheit: true }), /braucht „details_bei"/],
        ['Antwort ohne Bezug', gut({ art: 'antwort', beleg: undefined }), /Antwort braucht einen Bezug/],
        ['Bezug auf sich selbst', gut({ bezug: [{ art: 'baut_auf', id: '2026-11-10-aaaa' }] }), /bezieht sich nicht auf sich selbst/],
        ['Bezugsart erfunden', gut({ bezug: [{ art: 'mag', id: '2026-11-10-bbbb' }] }), /art „mag" gibt es nicht/],
        ['Abschluss ohne wohin', gut({ art: 'abschluss', beleg: undefined, ergebnis: 'erledigt', bezug: [{ art: 'schliesst', id: '2026-11-10-bbbb' }] }), /erledigt ohne „wohin"/],
        ['Verworfen ohne Grund', gut({ art: 'abschluss', beleg: undefined, ergebnis: 'verworfen', bezug: [{ art: 'schliesst', id: '2026-11-10-bbbb' }] }), /verworfen ohne Grund/],
        ['Uebergabe sagt nichts', gut({ art: 'uebergabe', beleg: undefined, version: 'v33.56' }), /Uebergabe sagt nichts ueber Offenes/],
        ['Uebergabe mit falscher Version', gut({ art: 'uebergabe', beleg: undefined, version: '33.56', offen: ['x'] }), /version hat nicht die Form/],
        ['Klasse ohne Waechter und ohne Grund', gut({ art: 'klasse', beleg: undefined, regel: 'r', instanzen: ['v1 · x'], waechter: [] }), /ohne Waechter braucht „ohne_waechter"/],
        ['Liste mit Zahl', gut({ stichworte: ['a', 3] }), /stichworte muss eine Liste nicht-leerer Texte sein/],
        ['Anker zu kurz', gut({ anker: [{ datei: 'index.html', text: 'x = 1' }] }), /anker\[0\]: text braucht/],
        ['Anker aus dem Repo hinaus', gut({ anker: [{ datei: '../geheim.txt', text: 'ein langes Stueck Text' }] }), /muss ein Pfad im Repo sein/],
        ['Anker an einem Abschluss', gut({ art: 'abschluss', beleg: undefined, ergebnis: 'verworfen', text: 'weil', anker: [{ datei: 'a.js', text: 'ein langes Stueck Text' }], bezug: [{ art: 'schliesst', id: '2026-11-10-bbbb' }] }), /anker gehoert an einen Befund/],
      ];
      const GUT = [
        ['Befund', gut()],
        ['Commit-Hash und noreply-Adresse sind kein Geheimnis', gut({ beleg: ['Commit e74c453a9b1c0d2e3f4a5b6c7d8e9f0a1b2c3d4e auf origin/claude/x', 'git -c user.email="seros@users.noreply.github.com" commit'] })],
        ['Sicherheitsbefund ohne Weg', gut({ sicherheit: true, details_bei: 'docs/FUER-FERNANDO.md §8' })],
        ['Klasse ausdruecklich ohne Waechter', gut({ art: 'klasse', beleg: undefined, regel: 'r', instanzen: ['v1 · x'], waechter: [], ohne_waechter: 'Verfahrensregel, kein Fall' })],
        ['Befund mit Anker', gut({ anker: [{ datei: 'supabase/functions/x/index.ts', text: 'model: "ein-modell-name"' }] })],
      ];
      const f = [];
      for (const [name, e, re] of SCHLECHT) {
        const g = A.eintragPruefen(JSON.parse(JSON.stringify(e)));
        if (!g.some(x => re.test(x))) f.push(name + ' → ' + (g.length ? 'falscher Grund: ' + g[0] : 'ANGENOMMEN'));
      }
      for (const [name, e] of GUT) {
        const g = A.eintragPruefen(JSON.parse(JSON.stringify(e)));
        if (g.length) f.push('guter Eintrag „' + name + '" abgelehnt: ' + g[0]);
      }
      // Der Dateiname gehoert zur Form.
      if (!A.eintragPruefen(gut(), '2026-11-10-bbbb-befund-x.json').some(x => /Dateiname muss mit/.test(x))) f.push('falscher Dateiname ANGENOMMEN');
      if (A.eintragPruefen(gut(), '2026-11-10-aaaa-befund-ein-guter-befund.json').length) f.push('richtiger Dateiname abgelehnt');
      if (f.length) return { ok: false, warum: f.length + ' von ' + (SCHLECHT.length + GUT.length + 2) + ': ' + f.slice(0, 5).join(' · ') };
      return { ok: true, info: SCHLECHT.length + ' kaputte abgelehnt, je mit dem erwarteten Grund · ' + GUT.length + ' gute ohne Einwand · Dateiname in beiden Richtungen' };
    },
  },
  {
    name: 'C2 · Das ganze Brett · ein Bezug ins Leere, „beantwortet" auf einen Befund, dieselbe id in zwei Dateien, eine unlesbare Datei und ein behobener Befund ohne Waechter-Angabe werden gemeldet — ein sauberes Brett nicht',
    lauf: () => {
      const d = tmp('brett');
      try {
        const dir = path.join(d, A.ORDNER); fs.mkdirSync(dir, { recursive: true });
        const schreib = (name, inhalt) => fs.writeFileSync(path.join(dir, name), typeof inhalt === 'string' ? inhalt : JSON.stringify(inhalt));
        const frage = gut({ id: '2026-11-10-f001', art: 'frage', beleg: undefined, an: 'alle', titel: 'Eine Frage' });
        schreib('2026-11-10-aaaa-befund-ein-guter-befund.json', gut());
        schreib('2026-11-10-f001-frage-eine-frage.json', frage);
        schreib('2026-11-10-a001-antwort-ja.json', gut({ id: '2026-11-10-a001', art: 'antwort', beleg: undefined, titel: 'Ja', bezug: [{ art: 'beantwortet', id: '2026-11-10-f001' }] }));
        const sauber = A.brettPruefen(A.brettLesen(d, {}));
        if (sauber.length) return { ok: false, warum: 'sauberes Brett gemeldet: ' + sauber[0].grund };
        schreib('2026-11-10-b001-antwort-leer.json', gut({ id: '2026-11-10-b001', art: 'antwort', beleg: undefined, titel: 'Leer', bezug: [{ art: 'baut_auf', id: '2026-11-10-9999' }] }));
        schreib('2026-11-10-b002-antwort-falsch.json', gut({ id: '2026-11-10-b002', art: 'antwort', beleg: undefined, titel: 'Falsch', bezug: [{ art: 'beantwortet', id: '2026-11-10-aaaa' }] }));
        schreib('2026-11-10-aaaa-befund-zweite-datei.json', gut({ titel: 'Zweite Datei' }));
        schreib('2026-11-10-b003-befund-kaputt.json', '{ "id": ');
        const g = A.brettPruefen(A.brettLesen(d, {})).map(x => x.grund);
        const soll = [/Bezug auf 2026-11-10-9999 — den Eintrag gibt es nicht/, /„beantwortet" zeigt auf 2026-11-10-aaaa, das keine Frage ist/, /dieselbe id 2026-11-10-aaaa in zwei Dateien/, /kein gueltiges JSON/];
        const fehlt = soll.filter(re => !g.some(x => re.test(x)));
        if (fehlt.length) return { ok: false, warum: fehlt.length + ' von 4 nicht gemeldet: ' + fehlt.map(r => r.source.slice(0, 40)).join(' · ') + ' — gemeldet wurde: ' + g.join(' | ').slice(0, 200) };
        // Schliessen ist streng — aber nur beim BEFUND, und nur bei „erledigt".
        const zu = (extra) => gut(Object.assign({ id: '2026-11-10-c001', art: 'abschluss', beleg: undefined, titel: 'zu', ergebnis: 'erledigt', wohin: 'v9', bezug: [{ art: 'schliesst', id: '2026-11-10-aaaa' }] }, extra));
        const idee = gut({ id: '2026-11-10-d001', art: 'idee', beleg: undefined, nutzen: 'n', pruefbar: 'p', titel: 'Eine Idee' });
        const streng = (liste) => A.brettPruefen(brettAus(liste)).map(x => x.grund).filter(x => /braucht „(bewacht|geschwister)"/.test(x)).length;
        const ist = [streng([gut(), zu()]), streng([gut(), zu({ bewacht: 'x_check · Fall', geschwister: 'gesucht: grep → 0' })]), streng([gut(), zu({ bewacht: 'keiner, weil Doku', geschwister: 'nicht gesucht, weil Einzelfall' })]),
          streng([gut(), zu({ ergebnis: 'verworfen', wohin: undefined, text: 'stimmt nicht' })]), streng([idee, zu({ bezug: [{ art: 'schliesst', id: '2026-11-10-d001' }] })])].join(' ');
        if (ist !== '2 0 0 0 0') return { ok: false, warum: 'strenges Schliessen: ' + ist + ' — erwartet 2 0 0 0 0 (behobener Befund ohne Angaben: 2 Maengel · mit Angaben · mit ausgesprochenem „keiner/nicht gesucht" · verworfen · eine Idee: je 0)' };
        return { ok: true, info: 'sauberes Brett: 0 Meldungen · vier eingebaute Schaeden: 4 von 4 gemeldet · behobener Befund ohne „bewacht/geschwister": 2 Maengel, mit: 0, verworfen und Idee: 0' };
      } finally { weg(d); }
    },
  },
  {
    name: 'C3 · Zustand wird gerechnet · Frage mit Antwort ist beantwortet, Befund mit Abschluss geschlossen, ein ersetzter ersetzt — und der unberuehrte Nachbar bleibt offen',
    lauf: () => {
      const b = brettAus([
        gut({ id: '2026-11-10-0001', titel: 'Befund, den jemand schliesst' }),
        gut({ id: '2026-11-10-0002', titel: 'Befund, den niemand anfasst' }),
        gut({ id: '2026-11-10-0003', art: 'frage', beleg: undefined, an: 'alle', titel: 'Frage mit Antwort' }),
        gut({ id: '2026-11-10-0004', art: 'frage', beleg: undefined, an: 'alle', titel: 'Frage ohne Antwort' }),
        gut({ id: '2026-11-10-0005', art: 'idee', beleg: undefined, nutzen: 'n', pruefbar: 'p', titel: 'Idee, die ersetzt wird' }),
        gut({ id: '2026-11-10-0006', art: 'abschluss', beleg: undefined, ergebnis: 'erledigt', wohin: 'v33.57', titel: 'zu', bezug: [{ art: 'schliesst', id: '2026-11-10-0001' }] }),
        gut({ id: '2026-11-10-0007', art: 'antwort', beleg: undefined, titel: 'ja', bezug: [{ art: 'beantwortet', id: '2026-11-10-0003' }] }),
        gut({ id: '2026-11-10-0008', art: 'idee', beleg: undefined, nutzen: 'n', pruefbar: 'p', titel: 'Die bessere Idee', bezug: [{ art: 'ersetzt', id: '2026-11-10-0005' }] }),
      ]);
      const z = A.ableiten(b.eintraege).zustand;
      const ist = ['0001', '0002', '0003', '0004', '0005', '0006', '0007', '0008'].map(k => z.get('2026-11-10-' + k).z).join(' ');
      const soll = 'geschlossen offen beantwortet offen ersetzt notiz notiz offen';
      if (ist !== soll) return { ok: false, warum: 'gerechnet: ' + ist + ' — erwartet: ' + soll };
      return { ok: true, info: ist };
    },
  },
  {
    name: 'C4 · Anstoesse · aus einem gebauten Brett rechnet der Code genau die erwarteten Anstoesse (auch: zwei Schreiber an derselben Stelle) — und KEINEN fuer Geschlossenes, Verbundenes oder denselben Schreiber',
    lauf: () => {
      const src = 'function gsGibtEsHier(){}';
      const b = brettAus([
        gut({ id: '2026-11-10-0001', von: 'a', titel: 'Befund von A', stichworte: ['gsGibtEsHier', 'kachel'] }),
        gut({ id: '2026-11-10-0002', von: 'b', titel: 'Frage von B an derselben Stelle', art: 'frage', beleg: undefined, an: 'alle', stichworte: ['Kachel'] }),
        gut({ id: '2026-11-10-0003', von: 'a', titel: 'Zweiter Befund von A — derselbe Schreiber ist kein zweiter Kopf', stichworte: ['kachel'] }),
        gut({ id: '2026-11-10-0004', von: 'c', titel: 'Geschlossener Befund an derselben Stelle', stichworte: ['kachel'] }),
        gut({ id: '2026-11-10-0005', von: 'c', art: 'abschluss', beleg: undefined, ergebnis: 'erledigt', wohin: 'v1', titel: 'zu', bezug: [{ art: 'schliesst', id: '2026-11-10-0004' }] }),
        gut({ id: '2026-11-10-0006', von: 'd', titel: 'Befund ueber Code, den es nicht mehr gibt', stichworte: ['gsGibtEsNichtMehr'] }),
        gut({ id: '2026-11-10-0007', von: 'd', art: 'idee', beleg: undefined, nutzen: 'n', pruefbar: 'ein Fall', titel: 'Idee, die B schon angesehen hat', stichworte: ['gsKommtErstNoch'] }),
        gut({ id: '2026-11-10-0008', von: 'b', art: 'antwort', beleg: undefined, titel: 'B baut darauf', bezug: [{ art: 'baut_auf', id: '2026-11-10-0007' }] }),
        gut({ id: '2026-11-10-0009', von: 'd', art: 'idee', beleg: undefined, nutzen: 'n', pruefbar: 'ein Fall', titel: 'Idee, die niemand angesehen hat' }),
        gut({ id: '2026-11-10-0010', von: 'e', art: 'klasse', beleg: undefined, regel: 'r', instanzen: ['v1 · x', 'v2 · y'], waechter: [], ohne_waechter: 'nur Prosa', titel: 'Klasse ohne Waechter, nie gesucht' }),
        gut({ id: '2026-11-10-0011', von: 'e', art: 'klasse', beleg: undefined, regel: 'r', instanzen: ['v1 · x', 'v2 · y'], waechter: [{ datei: 'x.js', fall: 'Fall' }], gesucht: 'v3: alle 12 Stellen', titel: 'Klasse mit Waechter, gesucht' }),
        gut({ id: '2026-11-10-0012', von: 'f', art: 'antwort', beleg: ['nachgemessen'], titel: 'F widerspricht A', bezug: [{ art: 'widerspricht', id: '2026-11-10-0003' }] }),
      ]);
      const an = A.anstoesse(b.eintraege, src);
      const ist = an.map(x => x.art + ':' + x.ids.map(i => i.slice(-2)).join('+')).sort().join(' ');
      const soll = ['frage_offen:02', 'beruehrung:01+02', 'beruehrung:02+03', 'befund_ohne:01', 'befund_ohne:06', 'idee_ungeprueft:09',
        'klasse_ohne:10', 'klasse_suchen:10', 'ueberholt:06', 'widerspruch:03+12'].sort().join(' ');
      if (ist !== soll) return { ok: false, warum: 'gerechnet: ' + ist + ' — erwartet: ' + soll };
      // Ohne Quelltext kann „ueberholt" nicht gerechnet werden — dann fehlt der Anstoss, statt zu raten.
      if (A.anstoesse(b.eintraege, null).some(x => x.art === 'ueberholt')) return { ok: false, warum: '„ueberholt" ohne Quelltext behauptet' };
      return { ok: true, info: an.length + ' Anstoesse aus 12 Eintraegen, genau die erwarteten · 01×03 (derselbe Schreiber), 04 (geschlossen), 07 (von B angesehen), 11 (bewacht und gesucht): keiner' };
    },
  },
  {
    name: 'C4b · Nachtrag · eine Klasse wird nie umgeschrieben: eine Antwort mit `gesucht` und `waechter` ergaenzt sie — danach faellt der Anstoss „nie gesucht / ohne Waechter" weg, bei der Nachbarklasse bleibt er',
    lauf: () => {
      const kl = (id, titel) => gut({ id, von: 'e', art: 'klasse', beleg: undefined, regel: 'r', instanzen: ['v1 · x', 'v2 · y'], waechter: [], ohne_waechter: 'nur Prosa', titel });
      const b = brettAus([
        kl('2026-11-10-0001', 'Klasse mit Nachtrag'), kl('2026-11-10-0002', 'Klasse ohne Nachtrag'),
        gut({ id: '2026-11-11-0003', datum: '2026-11-11', von: 'f', art: 'antwort', beleg: undefined, titel: 'gesucht und bewacht', gesucht: 'v9: 12 Stellen, 0 weitere', suchmuster: 'grep -n x', waechter: [{ datei: 'scripts/x_check.js', fall: 'Fall X' }], instanzen: ['v3 · z'], bezug: [{ art: 'baut_auf', id: '2026-11-10-0001' }] }),
        gut({ id: '2026-11-11-0004', datum: '2026-11-11', von: 'g', titel: 'Ein Befund als Instanz', bezug: [{ art: 'gehoert_zu', id: '2026-11-10-0001' }] }),
      ]);
      if (A.brettPruefen(b).length) return { ok: false, warum: 'der Nachtrag wird abgelehnt: ' + A.brettPruefen(b)[0].grund };
      const ab = A.ableiten(b.eintraege);
      const k1 = A.klasseWirksam(b.eintraege[0], ab.rueck), k2 = A.klasseWirksam(b.eintraege[1], ab.rueck);
      const ist = [k1.waechter.length, k1.gesucht.length, k1.suchmuster, k1.instanzen.length, k1.befunde.length, k2.waechter.length, k2.gesucht.length].join('|');
      if (ist !== '1|1|grep -n x|3|1|0|0') return { ok: false, warum: 'wirksame Klasse: ' + ist + ' — erwartet 1|1|grep -n x|3|1|0|0' };
      const an = A.anstoesse(b.eintraege, null).filter(x => /^klasse_/.test(x.art)).map(x => x.art + ':' + x.ids[0].slice(-2)).sort().join(' ');
      if (an !== 'klasse_ohne:02 klasse_suchen:02') return { ok: false, warum: 'Anstoesse: ' + an + ' — erwartet nur fuer 02' };
      // Ein Waechter an einem Befund ist ein Formfehler.
      if (!A.eintragPruefen(gut({ waechter: [{ datei: 'a', fall: 'b' }] })).some(x => /waechter gehoert an eine Fehlerklasse/.test(x))) return { ok: false, warum: 'waechter an einem Befund ANGENOMMEN' };
      return { ok: true, info: 'Klasse 01: 1 Waechter, gesucht, Suchmuster, 3 + 1 Instanzen — aus dem Nachtrag gerechnet, die Datei unveraendert · Klasse 02: beide Anstoesse bleiben' };
    },
  },
  {
    name: 'C4c · Anker · der Text steht in der Datei: still; die Stelle wird geaendert: gemeldet mit id und Titel; der Eintrag wird geschlossen oder neu verankert: wieder still',
    lauf: () => {
      const d = tmp('anker');
      try {
        fs.writeFileSync(path.join(d, 'code.js'), 'const model = "altes-modell-2025";\nconst andere = 1;\n');
        const lesen = (rel) => { try { return fs.readFileSync(path.join(d, rel), 'utf8'); } catch (_) { return null; } };
        const bef = gut({ anker: [{ datei: 'code.js', text: 'model = "altes-modell-2025"' }] });
        const n = (liste) => { const r = A.ankerPruefen(brettAus(liste).eintraege, lesen); return r.geprueft + '/' + r.verloren.length; };
        const vorher = n([bef]);
        fs.writeFileSync(path.join(d, 'code.js'), 'const model = "neues-modell-2026";\nconst andere = 1;\n');
        const geaendert = n([bef]);
        const geschlossen = n([bef, gut({ id: '2026-11-10-c001', art: 'abschluss', beleg: undefined, titel: 'zu', ergebnis: 'erledigt', wohin: 'v9', bewacht: 'x', geschwister: 'y', bezug: [{ art: 'schliesst', id: bef.id }] })]);
        const neuVerankert = n([bef, gut({ id: '2026-11-11-c002', datum: '2026-11-11', art: 'antwort', beleg: undefined, titel: 'gilt weiter', anker: [{ datei: 'code.js', text: 'model = "neues-modell-2026"' }], bezug: [{ art: 'baut_auf', id: bef.id }] })]);
        const dateiWeg = n([gut({ anker: [{ datei: 'gibt-es-nicht.js', text: 'irgendein langer Text' }] })]);
        const ist = [vorher, geaendert, geschlossen, neuVerankert, dateiWeg].join(' ');
        if (ist !== '1/0 1/1 0/0 1/0 1/1') return { ok: false, warum: 'geprueft/verloren: ' + ist + ' — erwartet 1/0 1/1 0/0 1/0 1/1' };
        return { ok: true, info: 'Text da: 1/0 · Stelle geaendert: 1/1 · geschlossen: nicht mehr geprueft · neu verankert per Antwort: 1/0 · Datei weg: 1/1' };
      } finally { weg(d); }
    },
  },
  {
    name: 'C4d · Zitate · ein `brett:<id>` in einem Dokument, das auf einen vorhandenen Eintrag zeigt, ist still — eines ins Leere wird mit Datei und id gemeldet',
    lauf: () => {
      const d = tmp('zitate');
      try {
        fs.mkdirSync(path.join(d, 'docs'));
        fs.writeFileSync(path.join(d, 'STATUS.md'), 'Offen: siehe brett:2026-11-10-aaaa und brett:2026-11-10-9999.\n');
        fs.writeFileSync(path.join(d, 'docs', 'X.md'), 'Kein Verweis hier, nur das Wort brett.\n');
        const r = zitatePruefen(d, new Set(['2026-11-10-aaaa']));
        if (r.gefunden !== 2 || r.fehlt.join() !== 'STATUS.md → brett:2026-11-10-9999') return { ok: false, warum: 'gefunden ' + r.gefunden + ', ins Leere: ' + JSON.stringify(r.fehlt) };
        return { ok: true, info: '2 Zitate gefunden · eines mit Ziel still · eines ins Leere gemeldet' };
      } finally { weg(d); }
    },
  },
  {
    name: 'C5 · Werkzeug · `neu` schreibt einen Eintrag, den die Pruefung annimmt; ohne Beleg schreibt es NICHTS; `einspielen` nimmt einen Stapel mit Bezuegen untereinander ganz oder gar nicht',
    lauf: () => {
      const d = tmp('werkzeug');
      try {
        fs.writeFileSync(path.join(d, 'index.html'), "var GS_VERSION = 'v99.01';\n");
        const dir = path.join(d, A.ORDNER);
        const anzahl = () => (fs.existsSync(dir) ? fs.readdirSync(dir).length : 0);
        let r = werkzeug(d, ['neu', 'befund', '--titel', 'Ohne Beleg', '--nur-lokal']);
        if (r.code !== 1 || anzahl() !== 0) return { ok: false, warum: 'Befund ohne Beleg: Exit ' + r.code + ', ' + anzahl() + ' Dateien geschrieben (erwartet Exit 1, 0 Dateien)' };
        r = werkzeug(d, ['neu', 'befund', '--titel', 'Mit Beleg', '--beleg', 'a.js:1', '--stichwort', 'x,y', '--nur-lokal']);
        if (r.code !== 0 || anzahl() !== 1) return { ok: false, warum: 'guter Befund: Exit ' + r.code + ', ' + anzahl() + ' Dateien — ' + r.aus.slice(0, 160) };
        let b = A.brettLesen(d, {});
        const e = b.eintraege[0];
        if (A.brettPruefen(b).length) return { ok: false, warum: 'das Werkzeug schrieb, was die Pruefung ablehnt: ' + A.brettPruefen(b)[0].grund };
        if (e.stand !== 'v99.01' || e.von !== 'pruefstand/a' || e.stichworte.join() !== 'x,y') return { ok: false, warum: 'Stand/von/Stichworte nicht uebernommen: ' + JSON.stringify({ stand: e.stand, von: e.von, sw: e.stichworte }) };
        // Abkuerzung der id und der Weg „antworte".
        r = werkzeug(d, ['antworte', e.id.slice(-4), '--text', 'Nachgemessen.', '--widerspricht', '--nur-lokal'], 'pruefstand/b');
        if (r.code !== 0 || anzahl() !== 2) return { ok: false, warum: 'antworte: Exit ' + r.code + ' — ' + r.aus.slice(0, 160) };
        // Lesen ist ins Schreiben eingebaut: ein ANDERER Schreiber am selben Stichwort bekommt den Nachbarn gezeigt …
        r = werkzeug(d, ['neu', 'frage', '--titel', 'Frage am selben Stichwort', '--an', 'alle', '--stichwort', 'x', '--nur-lokal'], 'pruefstand/c');
        if (r.code !== 0 || r.aus.indexOf('NACHBARN') < 0 || r.aus.indexOf(e.id) < 0) return { ok: false, warum: 'ein zweiter Schreiber am selben Stichwort bekam den Nachbarn nicht gezeigt: ' + r.aus.slice(0, 200) };
        // … derselbe Schreiber nicht (er kennt seine eigenen Eintraege), und ein fremdes Stichwort auch nicht.
        r = werkzeug(d, ['neu', 'frage', '--titel', 'Frage an anderer Stelle', '--an', 'alle', '--stichwort', 'ganz-woanders', '--nur-lokal'], 'pruefstand/c');
        if (r.code !== 0 || r.aus.indexOf('NACHBARN') >= 0) return { ok: false, warum: 'Nachbarn gezeigt, obwohl kein Stichwort geteilt wird' };
        for (const f of fs.readdirSync(dir)) if (/-frage-/.test(f)) fs.unlinkSync(path.join(dir, f));
        // Stapel: einer kaputt → NICHTS geschrieben.
        const stapel = path.join(d, 'stapel.json');
        fs.writeFileSync(stapel, JSON.stringify([
          { schluessel: 'b1', art: 'befund', titel: 'Stapel-Befund', beleg: ['b.js:2'] },
          { art: 'idee', titel: 'Stapel-Idee ohne pruefbar', nutzen: 'n', bezug: [{ art: 'baut_auf', id: '@b1' }] },
        ]));
        r = werkzeug(d, ['einspielen', stapel, '--nur-lokal']);
        if (r.code !== 1 || anzahl() !== 2) return { ok: false, warum: 'kaputter Stapel: Exit ' + r.code + ', ' + anzahl() + ' Dateien (erwartet Exit 1, weiter 2) — halb geschrieben?' };
        fs.writeFileSync(stapel, JSON.stringify([
          { schluessel: 'b1', art: 'befund', titel: 'Stapel-Befund', beleg: ['b.js:2'] },
          { art: 'idee', titel: 'Stapel-Idee', nutzen: 'n', pruefbar: 'ein Fall', bezug: [{ art: 'baut_auf', id: '@b1' }] },
        ]));
        r = werkzeug(d, ['einspielen', stapel, '--nur-lokal']);
        if (r.code !== 0 || anzahl() !== 4) return { ok: false, warum: 'guter Stapel: Exit ' + r.code + ', ' + anzahl() + ' Dateien — ' + r.aus.slice(0, 200) };
        b = A.brettLesen(d, {});
        const idee = b.eintraege.find(x => x.titel === 'Stapel-Idee'), bef = b.eintraege.find(x => x.titel === 'Stapel-Befund');
        if (!idee || !bef || idee.bezug[0].id !== bef.id) return { ok: false, warum: 'Stapel-Bezug „@b1" nicht auf die vergebene id aufgeloest' };
        if (A.brettPruefen(b).length) return { ok: false, warum: 'Brett nach dem Stapel: ' + A.brettPruefen(b)[0].grund };
        // Lesen schreibt nichts — und sagt es.
        r = werkzeug(d, ['--nur-lokal']);
        if (r.code !== 0 || anzahl() !== 4 || r.aus.indexOf('Nichts geschrieben.') < 0 || r.aus.indexOf('keine Uebergabe') < 0) return { ok: false, warum: 'lesen: Exit ' + r.code + ', ' + anzahl() + ' Dateien, Schlusssatz/Uebergabe-Hinweis fehlt' };
        r = werkzeug(d, ['gibtesnicht']);
        if (r.code !== 2) return { ok: false, warum: 'unbekannter Befehl: Exit ' + r.code + ' (erwartet 2)' };
        return { ok: true, info: 'ohne Beleg: Exit 1, 0 Dateien · neu, antworte (id abgekuerzt), Stapel mit @-Bezug: 4 Dateien, Pruefung still · kaputter Stapel: nichts · lesen schreibt nichts' };
      } finally { weg(d); }
    },
  },
  {
    name: 'C6 · Ueber Branches · ein Eintrag, der NUR auf einem nie gemergten Branch liegt, steht im Brett, gibt mit einem Eintrag von main einen Anstoss und kann beantwortet werden (das Ziel reist dabei mit, der Arbeitsbaum bleibt ohne Bezug ins Leere); `ernten` holt den Rest — ohne die Remote-Refs fehlt alles davon',
    lauf: () => {
      if (!gitDa()) return { offen: true, warum: 'git nicht verfuegbar' };
      const d = tmp('branches');
      try {
        const o = path.join(d, 'origin'), k = path.join(d, 'klon');
        fs.mkdirSync(o);
        gitIn(o, ['init', '-q']); gitIn(o, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
        fs.writeFileSync(path.join(o, 'index.html'), "var GS_VERSION = 'v99.01';\n");
        let r = werkzeug(o, ['neu', 'befund', '--titel', 'Befund auf main', '--beleg', 'a.js:1', '--stichwort', 'gleiche-stelle', '--datum', '2026-11-01', '--nur-lokal'], 'sitzung/haupt');
        if (r.code !== 0) return { ok: false, warum: 'Vorbereitung: ' + r.aus.slice(0, 160) };
        gitIn(o, ['add', '-A']); gitIn(o, ['commit', '-q', '-m', 'main']);
        gitIn(o, ['checkout', '-q', '-b', 'claude/nie-gemergt']);
        r = werkzeug(o, ['neu', 'frage', '--titel', 'Frage nur auf dem Nebenast', '--an', 'alle', '--stichwort', 'gleiche-stelle', '--datum', '2026-11-02', '--nur-lokal'], 'sitzung/neben');
        if (r.code !== 0) return { ok: false, warum: 'Vorbereitung: ' + r.aus.slice(0, 160) };
        r = werkzeug(o, ['neu', 'befund', '--titel', 'Unbeteiligter Befund auf dem Nebenast', '--beleg', 'b.js:2', '--datum', '2026-11-03', '--nur-lokal'], 'sitzung/neben');
        if (r.code !== 0) return { ok: false, warum: 'Vorbereitung: ' + r.aus.slice(0, 160) };
        gitIn(o, ['add', '-A']); gitIn(o, ['commit', '-q', '-m', 'neben']); gitIn(o, ['checkout', '-q', 'main']);
        const cl = cp.spawnSync('git', ['clone', '-q', o, k], { encoding: 'utf8' });
        if (cl.status !== 0) return { ok: false, warum: 'clone: ' + (cl.stderr || '').split('\n')[0] };
        const ohne = A.brettLesen(k, { alleRefs: false }), mit = A.brettLesen(k, { alleRefs: true });
        if (ohne.eintraege.length !== 1) return { ok: false, warum: 'ohne Remote-Refs: ' + ohne.eintraege.length + ' Eintraege (erwartet 1 — der Fall muss den Unterschied zeigen koennen)' };
        if (mit.eintraege.length !== 3) return { ok: false, warum: 'mit Remote-Refs: ' + mit.eintraege.length + ' Eintraege (erwartet 3) — die Eintraege vom Nebenast fehlen' };
        const frage = mit.eintraege.find(e => e.art === 'frage');
        if (!frage || frage._quelle !== 'origin/claude/nie-gemergt') return { ok: false, warum: 'Herkunft der Frage: ' + (frage && frage._quelle) };
        const an = A.anstoesse(mit.eintraege, null).map(x => x.art);
        if (an.indexOf('beruehrung') < 0) return { ok: false, warum: 'kein Anstoss zwischen main und Nebenast: ' + an.join(',') };
        // Antworten ueber die Branch-Grenze: der Bezug zeigt auf einen Eintrag, der im Arbeitsbaum NICHT liegt.
        r = werkzeug(k, ['antworte', frage.id, '--text', 'Ja, nachgemessen.'], 'sitzung/dritte');
        if (r.code !== 0) return { ok: false, warum: 'antworte ueber die Branch-Grenze abgelehnt: ' + r.aus.slice(0, 200) };
        const danach = A.brettLesen(k, { alleRefs: true });
        const z = A.ableiten(danach.eintraege).zustand.get(frage.id).z;
        if (z !== 'beantwortet') return { ok: false, warum: 'Frage vom Nebenast nach der Antwort: ' + z };
        // Der Bezug zeigte auf einen Eintrag, der im Arbeitsbaum NICHT lag. Er muss mitgereist sein —
        // sonst saehe der Pruefstand (und CI) hier einen Bezug ins Leere.
        const baum = A.brettLesen(k, { alleRefs: false });
        const leer = A.brettPruefen(baum).filter(x => /den Eintrag gibt es nicht/.test(x.grund)).length;
        if (baum.eintraege.length !== 3 || leer) return { ok: false, warum: 'nach der Antwort: ' + baum.eintraege.length + ' Eintraege im Arbeitsbaum (erwartet 3: Befund, Antwort, mitgenommene Frage), Bezuege ins Leere: ' + leer };
        r = werkzeug(k, ['ernten'], 'sitzung/dritte');
        const nachher = A.brettLesen(k, { alleRefs: false });
        if (r.code !== 0 || nachher.eintraege.length !== 4 || A.brettPruefen(nachher).length) return { ok: false, warum: 'ernten: Exit ' + r.code + ', ' + nachher.eintraege.length + ' Eintraege im Arbeitsbaum (erwartet 4), Pruefung: ' + (A.brettPruefen(nachher)[0] || { grund: 'still' }).grund };
        return { ok: true, info: 'nur Arbeitsbaum: 1 Eintrag · mit Remote-Refs: 3 (zwei aus origin/claude/nie-gemergt) · Anstoss „dieselbe Stelle" · Antwort ueber die Branch-Grenze nimmt die Frage mit (3 im Baum, 0 Bezuege ins Leere) · ernten holt den vierten' };
      } catch (e) { return { ok: false, warum: 'Ausnahme: ' + String(e.message).split('\n')[0] }; } finally { weg(d); }
    },
  },
  {
    name: 'C7 · Die Zahlenpruefung sieht Fehler · in einem gebauten Repo mit 3 run-Zeilen wird „4 Pruefstaende" gemeldet, „3" nicht — und ein umgeschriebener Satz als fehlender Anker',
    lauf: () => {
      const d = tmp('zahlen');
      try {
        fs.mkdirSync(path.join(d, 'scripts'));
        fs.writeFileSync(path.join(d, 'scripts/pruefstaende.sh'), 'run a node scripts/a_check.js\nTAILN=8 run b node scripts/b_check.js\n  run c node scripts/c_check.js\n# run d — ein Kommentar zaehlt nicht\n');
        const L = [{ was: 'pruefstaende', datei: 'DOKU.md', anker: /alle (\d+) Pruefstaende/ }];
        fs.writeFileSync(path.join(d, 'DOKU.md'), 'Die Suite faehrt alle 3 Pruefstaende.\n');
        const gutR = zahlenPruefen(d, L);
        fs.writeFileSync(path.join(d, 'DOKU.md'), 'Die Suite faehrt alle 4 Pruefstaende.\n');
        const schlechtR = zahlenPruefen(d, L);
        fs.writeFileSync(path.join(d, 'DOKU.md'), 'Die Suite hat viele Pruefstaende.\n');
        const ankerR = zahlenPruefen(d, L);
        if (gutR.fehler.length || gutR.stellen !== 1) return { ok: false, warum: 'richtige Zahl gemeldet: ' + gutR.fehler.join(' ') };
        if (!schlechtR.fehler.some(x => /nennt 4 pruefstaende, gemessen 3/.test(x))) return { ok: false, warum: 'falsche Zahl NICHT gemeldet: ' + JSON.stringify(schlechtR.fehler) };
        if (!ankerR.fehler.some(x => /Anker nicht gefunden/.test(x))) return { ok: false, warum: 'fehlender Anker NICHT gemeldet' };
        return { ok: true, info: '3 run-Zeilen (eine mit TAILN, eine eingerueckt; der Kommentar zaehlt nicht) · „3" still · „4" gemeldet · Satz ohne Zahl: Anker fehlt' };
      } finally { weg(d); }
    },
  },
];

(async () => {
  console.log('\n=== austausch_check — kommt an, was eine KI-Sitzung der naechsten sagt?');
  let kaputt = 0, offen = 0;
  for (const f of FAELLE) {
    let r;
    try { r = await f.lauf(); } catch (e) { r = { ok: false, warum: 'Ausnahme: ' + (e && e.message ? e.message.split('\n')[0] : e) }; }
    if (r && r.offen) { offen++; console.log('  --   ' + f.name + '\n         → nicht pruefbar: ' + ((r && r.warum) || 'unbekannt')); }
    else if (r && r.ok) console.log('  ok   ' + f.name + (r.info ? '   [' + r.info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
  }
  console.log('  ---');
  console.log('  Faelle geprueft: ' + FAELLE.length + ' · davon kaputt: ' + kaputt + (offen ? ' · nicht pruefbar: ' + offen : ''));
  console.log('  Grenze: geprueft wird der Arbeitsbaum — was nur auf einem anderen Branch liegt, zeigt `node scripts/austausch.js holen`.');
  console.log('  Ob ein Eintrag klug ist, rechnet niemand; gerechnet wird, ob er pruefbar, verbunden und ehrlich ist.');
  process.exitCode = kaputt ? 1 : (offen ? 2 : 0);
})();
