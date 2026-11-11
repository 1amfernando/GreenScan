#!/usr/bin/env node
// austausch_check.js — kommt an, was eine KI-Sitzung der naechsten sagt?
//
//   node scripts/austausch_check.js
//
// Alle anderen Pruefstaende fragen, ob die APP stimmt. Dieser fragt, ob das
// stimmt, was die Sitzungen EINANDER hinterlassen: das Brett
// (docs/austausch/eintraege/, Werkzeug scripts/austausch.mjs) und die zwei
// Stellen in STATUS.md, an denen eine Sitzung der naechsten etwas uebergibt.
//
// Anlass (10.11.2026, Fernando): „Alle Agenten müssen sich austauschen und die
// Informationen so weiter geben dass unter einander neue ideen enstehen können."
// Gemessen: fuer dieselbe Suite standen 35 · 38 · 39 · 41 Pruefstaende in
// sechs Dateien; 125 nie gemergte Branches trugen Befunde, die keine andere
// Sitzung je sah; in 312 Routine-Eintraegen gab es keine feste Zeile fuer
// „was bleibt offen". „Eine Regel ohne Ausloeser ist eine Bitte" (CLAUDE.md
// §3.1, v33.01) — hier ist der Ausloeser.
//
// Drei Gruppen:
//   A · die WARE: das echte Brett im Arbeitsbaum und die Uebergabe in STATUS.md
//   B · der EINSTIEG: Suite vollstaendig, Zahlen an EINER Stelle, Wegweiser, Agenten-Runde
//   C · die REGEL selbst: jede Pruefung laeuft gegen einen guten UND einen
//       schlechten gebauten Fall — eine Pruefung, die alles annimmt, wird hier rot.
//
// Grenze: geprueft wird der ARBEITSBAUM. Was nur auf einem anderen Branch
// liegt, sieht dieser Pruefstand nicht (das Werkzeug schon — C8 prueft genau
// das an gebauten Branches). Und: ob ein Eintrag KLUG ist, rechnet niemand;
// gerechnet wird, ob er pruefbar, verbunden und ehrlich ist.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { pathToFileURL } = require('url');

const WURZEL = path.resolve(__dirname, '..');
const WERKZEUG = path.join(__dirname, 'austausch.mjs');
const lies = (rel, w) => fs.readFileSync(path.join(w || WURZEL, rel), 'utf8');
const gibt = (rel, w) => fs.existsSync(path.join(w || WURZEL, rel));
const liesOderNull = (w) => (rel) => { try { return fs.readFileSync(path.join(w, rel), 'utf8'); } catch (_) { return null; } };
const tmp = (name) => fs.mkdtempSync(path.join(os.tmpdir(), 'austausch-' + name + '-'));
const weg = (d) => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} };
const kurz = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
let A = null;   // das Modul (ESM) — in `haupt` geladen

// ── Das Werkzeug als PROZESS: was eine Sitzung wirklich tippt.
function werkzeug(wurzel, args, env) {
  const r = cp.spawnSync(process.execPath, [WERKZEUG].concat(args), { encoding: 'utf8', env: Object.assign({}, process.env, { AUSTAUSCH_WURZEL: wurzel, AUSTAUSCH_VON: '' }, env || {}) });
  return { code: r.status, aus: (r.stdout || '') + (r.stderr || '') };
}
function g(dir, args) {
  return cp.execFileSync('git', ['-C', dir, '-c', 'user.email=pruefstand@example.com', '-c', 'user.name=pruefstand', '-c', 'commit.gpgsign=false'].concat(args), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
const QUELLE = "var GS_VERSION = 'v1.00';\nfunction gsEins(){ return 1; }\n// gsNurImKommentar() steht nur hier\nfunction gsZwei(){ return gsEins() + gsEins(); }\nwindow.GS_RELEASES = [\n  { v: 'v1.00', summary: 'gsNurImChangelog() entfernt' }\n];\n";
function repo(name, zweig) {
  const d = tmp(name);
  g(d, ['init', '-q', '-b', zweig || 'claude/arbeit', '.']);
  fs.writeFileSync(path.join(d, 'index.html'), QUELLE);
  g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'start']);
  return d;
}

// ── Gebaute Eintraege fuer die C-Faelle.
let _n = 0;
function mk(art, o) {
  const id = '2026-01-01-' + (++_n).toString(16).padStart(4, '0');
  const basis = { id, art, datum: '2026-01-01', zeit: '10:00:00', von: 'sitzung/a', titel: 'Gebauter Eintrag ' + _n };
  const je = {
    befund: { beleg: ['grep -c x datei → 3'] }, idee: { nutzen: 'eine Rechnung statt zwei', pruefbar: 'ein Fall in x_check' }, frage: { an: 'alle' },
    klasse: { regel: 'der Leser ist die Regel', instanzen: ['v1.00: eine Stelle'], ohne_waechter: 'noch kein Fall' }, antwort: {}, abschluss: { ergebnis: 'verworfen', text: 'haelt der Messung nicht stand' },
  }[art] || {};
  return Object.assign(basis, je, o || {});
}
const bz = (art, e) => ({ art, id: e.id });
const brettAus = (eintraege) => ({ eintraege, unlesbar: [], doppelt: [], abweichend: [] });
function ablegen(wurzel, e, name) {
  const d = path.join(wurzel, A.ORDNER, e.id ? e.id.slice(0, 7) : '2026-01'); fs.mkdirSync(d, { recursive: true });
  const p = path.join(d, name || (e.id + '-' + e.art + '-x.json')); fs.writeFileSync(p, typeof e === 'string' ? e : JSON.stringify(e, null, 2) + '\n'); return p;
}

// ── Die Uebergabe in STATUS.md: EINE Rechnung fuer die Ware (A4) und fuer die gebauten Faelle (C9).
function statusPruefen(statusText, version, ids) {
  const f = [], s = A.statusZeilen(statusText);
  if (s.grund) return ['STATUS.md: ' + s.grund];
  const wo = 'der juengste Eintrag in STATUS.md §0 („' + kurz(s.ueberschrift, 70) + '")';
  if (s.offen == null) f.push(wo + ' hat keine Zeile `**Offen:** …` — dort steht, was die naechste Sitzung uebernimmt: `**Offen:** brett:<id>, brett:<id>` (Eintraege des Bretts) oder `**Offen:** nichts`');
  else if (!s.ids.length && !s.nichts) f.push(wo + ': die Zeile `**Offen:**` nennt weder einen Eintrag (`brett:<id>`) noch `nichts` — offene Arbeit steht auf dem Brett, damit die naechste Sitzung sie FINDET: node scripts/austausch.mjs neu befund|frage|idee …');
  for (const id of s.ids) if (!ids.has(id)) f.push(wo + ' nennt brett:' + id + ' — den Eintrag gibt es im Arbeitsbaum nicht (mit `node scripts/austausch.mjs ernten` holen oder die id berichtigen)');
  if (s.nichtGeprueft == null || !s.nichtGeprueft) f.push(wo + ' hat keine Zeile `**Nicht geprüft:** …` — was von hier aus nicht messbar war (oder „nichts ausgelassen")');
  if (version && !s.alleKoepfe.some(k => k.indexOf(version) >= 0)) f.push('die laufende Version ' + version + ' hat keinen Eintrag in STATUS.md §0');
  return f;
}
// ── Die Zahlen der Suite stehen an EINER Stelle (STATUS.md §1). Jede andere Datei nennt keine.
const ZAHLEN = [
  { was: 'Pruefstaende (*_check in scripts/)', re: /\*\*(\d+)\*\* `\*_check` in `scripts\/`/, miss: (w) => fs.readdirSync(path.join(w, 'scripts')).filter(n => /_check\.(js|py)$/.test(n)).length, befehl: 'ls scripts | grep -cE "_check\\.(js|py)$"' },
  { was: 'run-Zeilen in pruefstaende.sh', re: /fährt \*\*alle (\d+)\*\*/, miss: (w) => runZeilen(w).length, befehl: 'grep -cE "^[ \\t]*(TAILN=[0-9]+ +)?run " scripts/pruefstaende.sh' },
  { was: 'Migrationen', re: /\*\*(\d+) Migrationen\*\*/, miss: (w) => fs.readdirSync(path.join(w, 'supabase/migrations')).filter(n => /\.sql$/.test(n)).length, befehl: 'ls supabase/migrations/*.sql | wc -l' },
  { was: 'Edge-Function-Verzeichnisse', re: /\*\*(\d+) Edge-Function-Verzeichnisse\*\*/, miss: (w) => fs.readdirSync(path.join(w, 'supabase/functions'), { withFileTypes: true }).filter(d => d.isDirectory() && d.name !== '_shared').length, befehl: 'ls -d supabase/functions/*/ | grep -vc _shared' },
];
function runZeilen(w) { return (lies('scripts/pruefstaende.sh', w).match(/^[ \t]*(?:TAILN=\d+[ \t]+)?run[ \t]+\S+.*$/gm) || []); }
function zahlenPruefen(w, liste) {
  const t = lies('STATUS.md', w), a = t.indexOf('\n## 1 '), b = a < 0 ? -1 : t.indexOf('\n## ', a + 5);
  if (a < 0) return { fehler: ['STATUS.md: Abschnitt „## 1" nicht gefunden'], stellen: 0 };
  const s1 = t.slice(a, b < 0 ? undefined : b), f = [];
  let stellen = 0;
  for (const z of liste) {
    const m = s1.match(z.re);
    if (!m) { f.push('STATUS.md §1: die Stelle fuer „' + z.was + '" ist nicht zu finden (' + z.re.source + ') — wer den Satz umschreibt, zieht ihn in ZAHLEN nach'); continue; }
    stellen++;
    const ist = z.miss(w);
    if (Number(m[1]) !== ist) f.push('STATUS.md §1 nennt ' + m[1] + ' ' + z.was + ', gemessen ' + ist + '  (' + z.befehl + ')');
  }
  return { fehler: f, stellen };
}

const FAELLE = [
  {
    name: 'A1 · Das Brett · es gibt Eintraege; jeder ist lesbar, traegt die Pflichtfelder seiner Art, heisst wie seine id, zeigt mit jedem Bezug auf einen vorhandenen Eintrag der richtigen Art — und nichts darin sieht aus wie ein Geheimnis',
    lauf: () => {
      const b = A.brettLesen(WURZEL, { alleRefs: false });
      // Ein leeres Brett ist ROT, nicht „nicht pruefbar": sonst waere ein geloeschter Ordner gruen.
      if (!b.eintraege.length && !b.unlesbar.length) return { ok: false, warum: A.ORDNER + '/ ist leer oder fehlt — das Brett ist die Messgrundlage dieses Pruefstands' };
      const f = A.brettPruefen(b);
      if (f.length) return { ok: false, warum: f.length + ' Maengel: ' + f.slice(0, 6).map(x => x.wo + ' — ' + x.grund).join(' · ') + (f.length > 6 ? ' · +' + (f.length - 6) + ' weitere' : '') };
      const n = {}; b.eintraege.forEach(e => { n[e.art] = (n[e.art] || 0) + 1; });
      const abl = A.ableiten(b.eintraege), offen = b.eintraege.filter(e => abl.zustand.get(e.id).z === 'offen').length;
      return { ok: true, info: b.eintraege.length + ' Eintraege (' + Object.keys(n).map(k => n[k] + ' ' + k).join(' · ') + ') · ' + offen + ' offen' };
    },
  },
  {
    name: 'A2 · Waechter · jede offene Fehlerklasse nennt als Waechter eine Datei, die es gibt, und eine Fallkennung, die darin GENAU EINMAL steht — oder sagt ausdruecklich, dass kein Fall sie bewacht',
    lauf: () => {
      const b = A.brettLesen(WURZEL, { alleRefs: false }), abl = A.ableiten(b.eintraege), f = [];
      let klassen = 0, waechter = 0, ohne = 0;
      for (const e of b.eintraege) {
        if (e.art !== 'klasse' || abl.zustand.get(e.id).z !== 'offen') continue;
        klassen++;
        const k = A.klasseWirksam(e, abl.rueck);
        if (!k.waechter.length) { ohne++; continue; }
        waechter += k.waechter.length;
        for (const x of A.waechterPruefen(k.waechter, liesOderNull(WURZEL))) f.push(e.id + ' („' + kurz(e.titel, 50) + '"): ' + x);
      }
      if (f.length) return { ok: false, warum: f.slice(0, 5).join(' · ') + (f.length > 5 ? ' · +' + (f.length - 5) + ' weitere' : '') + ' — der Fall wurde umbenannt oder entfernt: `node scripts/austausch.mjs antworte <id> --waechter "datei::neue Kennung"` oder die Klasse ersetzen' };
      return { ok: true, info: klassen + ' Fehlerklassen · ' + waechter + ' Waechter-Adressen, jede genau einmal in ihrer Datei · ' + ohne + ' ausdruecklich ohne Waechter' };
    },
  },
  {
    name: 'A3 · Die Stelle · woran ein OFFENER Eintrag gebunden ist, steht noch woertlich in seiner Datei (Anker), und was er gezaehlt hat, ergibt heute dieselbe Zahl — wer die Stelle aendert, liest den Eintrag',
    lauf: () => {
      const b = A.brettLesen(WURZEL, { alleRefs: false }), l = liesOderNull(WURZEL), f = [];
      const a = A.ankerPruefen(b.eintraege, l), z = A.zahlenStand(b.eintraege, l);
      for (const x of a.verloren) f.push(x.id + ' „' + kurz(x.titel, 60) + '" → ' + x.datei + ': ' + x.grund + ' („' + kurz(x.text, 50) + '")');
      for (const x of z) if (x.heute !== x.n) f.push(x.id + ' „' + kurz(x.titel, 60) + '" → „' + kurz(x.text, 40) + '" in ' + x.datei + ': war ' + x.n + ', heute ' + (x.heute == null ? 'nicht lesbar' : x.heute));
      if (f.length) return { ok: false, warum: f.slice(0, 5).join(' · ') + (f.length > 5 ? ' · +' + (f.length - 5) + ' weitere' : '') + ' — das ist der Ausloeser, kein Unfall: `node scripts/austausch.mjs zeige <id>` lesen; behoben → `schliesse <id> --ergebnis erledigt --wohin … --geschwister …`; nur verschoben → `antworte <id> --anker "datei::neuer Text"` bzw. `--zaehle "datei::text"`' };
      return { ok: true, info: a.geprueft + ' Anker an ' + a.eintraege + ' offenen Eintraegen stehen woertlich da · ' + z.length + ' Zaehlungen unveraendert (ohne Kommentarzeilen und Changelog gemessen)' };
    },
  },
  {
    name: 'A4 · Uebergabe · der juengste Eintrag in STATUS.md §0 sagt in zwei festen Zeilen, was offen bleibt (`**Offen:**` mit brett:<id> oder „nichts") und was nicht geprueft wurde — und die laufende Version hat ihren Eintrag',
    lauf: () => {
      const b = A.brettLesen(WURZEL, { alleRefs: false }), ids = new Set(b.eintraege.map(e => e.id));
      const m = lies('index.html').match(/\bGS_VERSION\s*=\s*'(v\d+\.\d+)'/);
      if (!m) return { ok: false, warum: 'GS_VERSION nicht in index.html gefunden' };
      const f = statusPruefen(lies('STATUS.md'), m[1], ids);
      if (f.length) return { ok: false, warum: f.join(' · ') };
      const s = A.statusZeilen(lies('STATUS.md'));
      return { ok: true, info: '„' + kurz(s.ueberschrift, 60) + '" · offen: ' + (s.nichts ? 'nichts' : s.ids.length + ' Eintraege des Bretts') + ' · ' + m[1] + ' hat ihren Eintrag' };
    },
  },
  {
    name: 'A5 · Zitate · jede offene Frage an Fernando steht mit `brett:<id>` dort, wo er liest (STATUS.md §2 oder docs/FUER-FERNANDO.md) — und jedes `brett:<id>` in den Dokumenten meint einen Eintrag, den es gibt',
    lauf: () => {
      const b = A.brettLesen(WURZEL, { alleRefs: false }), abl = A.ableiten(b.eintraege), ids = new Set(b.eintraege.map(e => e.id)), f = [];
      const st = lies('STATUS.md'), a2 = st.indexOf('\n## 2 '), e2 = a2 < 0 ? -1 : st.indexOf('\n## ', a2 + 5);
      const wo = (a2 < 0 ? '' : st.slice(a2, e2 < 0 ? undefined : e2)) + '\n' + (gibt('docs/FUER-FERNANDO.md') ? lies('docs/FUER-FERNANDO.md') : '');
      const fragen = b.eintraege.filter(e => e.art === 'frage' && e.an === 'fernando' && abl.zustand.get(e.id).z === 'offen');
      for (const e of fragen) if (wo.indexOf('brett:' + e.id) < 0) f.push('die Frage an Fernando ' + e.id + ' („' + kurz(e.titel, 60) + '") steht weder in STATUS.md §2 noch in docs/FUER-FERNANDO.md — er liest das Brett nicht: dort eine Zeile mit brett:' + e.id);
      const dateien = ['STATUS.md', 'ROADMAP.md', 'CLAUDE.md', 'AGENTS.md', 'README.md'].concat(
        ['docs', 'docs/memory', 'docs/austausch'].reduce((l, d) => l.concat(gibt(d) ? fs.readdirSync(path.join(WURZEL, d)).filter(n => /\.md$/.test(n)).map(n => d + '/' + n) : []), []));
      let zitate = 0;
      for (const d of dateien) {
        if (!gibt(d)) continue;
        for (const m of lies(d).matchAll(/\bbrett:(\d{4}-\d{2}-\d{2}-[0-9a-f]{4})\b/g)) { zitate++; if (!ids.has(m[1])) f.push(d + ' nennt brett:' + m[1] + ' — den Eintrag gibt es nicht'); }
      }
      if (f.length) return { ok: false, warum: f.slice(0, 5).join(' · ') + (f.length > 5 ? ' · +' + (f.length - 5) + ' weitere' : '') };
      return { ok: true, info: fragen.length + ' offene Fragen an Fernando, alle dort zitiert · ' + zitate + ' Zitate in ' + dateien.length + ' Dokumenten, keines ins Leere' };
    },
  },
  {
    name: 'B1 · Suite und Zahlen · jeder *_check in scripts/ steht in pruefstaende.sh, jede run-Zeile nennt ein Skript, das es gibt — und die vier Zahlen in STATUS.md §1 (Pruefstaende, run-Zeilen, Migrationen, Edge-Verzeichnisse) sind die gemessenen',
    lauf: () => {
      const zeilen = runZeilen(WURZEL), sh = zeilen.join('\n'), f = [];
      for (const n of fs.readdirSync(path.join(WURZEL, 'scripts')).filter(x => /_check\.(js|py)$/.test(x))) if (sh.indexOf('scripts/' + n) < 0) f.push('scripts/' + n + ' steht in keiner run-Zeile von pruefstaende.sh — er laeuft weder lokal noch in der CI mit');
      for (const z of zeilen) { const m = z.match(/scripts\/[\w.-]+/); if (m && !gibt(m[0])) f.push('pruefstaende.sh ruft ' + m[0] + ' — die Datei gibt es nicht'); }
      const r = zahlenPruefen(WURZEL, ZAHLEN);
      f.push(...r.fehler);
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: zeilen.length + ' run-Zeilen, jede mit Skript · ' + r.stellen + ' Zahlen in STATUS.md §1 stimmen mit ihrem Befehl' };
    },
  },
  {
    name: 'B2 · Einstieg · jede Datei, mit der eine KI hier anfaengt, nennt das Werkzeug — und docs/austausch/README.md erklaert jede Art, jeden Bezug, jedes Ergebnis und jedes Feld, das das Modul kennt',
    lauf: () => {
      const f = [];
      for (const d of ['CLAUDE.md', 'AGENTS.md', 'docs/memory/README.md', 'docs/memory/08-arbeitsweise.md']) {
        if (!gibt(d)) f.push(d + ' fehlt'); else if (lies(d).indexOf('scripts/austausch.mjs') < 0) f.push(d + ' nennt `node scripts/austausch.mjs` nicht — wer dort anfaengt, erfaehrt vom Brett nichts');
      }
      if (!gibt('docs/austausch/README.md')) f.push('docs/austausch/README.md fehlt');
      else {
        const t = lies('docs/austausch/README.md');
        const worte = Object.keys(A.ARTEN).concat(Object.keys(A.BEZUEGE), A.ERGEBNISSE, A.FELDER.filter(k => k !== 'schluessel'));
        const fehlt = [...new Set(worte)].filter(w => t.indexOf('`' + w + '`') < 0);
        if (fehlt.length) f.push('docs/austausch/README.md erklaert nicht: ' + fehlt.map(w => '`' + w + '`').join(' ') + ' — das Vokabular des Moduls und seine Beschreibung gehoeren zusammen');
      }
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'vier Einstiegsdateien nennen das Werkzeug · README deckt ' + Object.keys(A.ARTEN).length + ' Arten, ' + Object.keys(A.BEZUEGE).length + ' Bezuege, ' + A.ERGEBNISSE.length + ' Ergebnisse, ' + (A.FELDER.length - 1) + ' Felder' };
    },
  },
  {
    name: 'B3 · Agenten-Runde · der Workflow fuer Unteragenten ist da, laesst sich uebersetzen (meta zuerst, Phasen stimmen, weder Uhr noch Zufall), kennt nur Felder, die das Brett annimmt, und endet im Brett',
    lauf: () => {
      const rel = '.claude/workflows/austausch-runde.js';
      if (!gibt(rel)) return { ok: false, warum: rel + ' fehlt' };
      const t = lies(rel), f = [];
      if (!/^export const meta = \{/.test(t)) f.push('beginnt nicht mit `export const meta = {` (erste Zeile, nichts davor)');
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
      const ohneKommentar = t.replace(/^[ \t]*\/\/.*$/gm, '');
      for (const [re, was] of [[/\bDate\.now\s*\(/, 'Date.now()'], [/\bMath\.random\s*\(/, 'Math.random()'], [/\bnew Date\s*\(\s*\)/, 'new Date()'], [/\bimport\s*\(/, 'import()']]) if (re.test(ohneKommentar)) f.push('ruft ' + was + ' (ein Workflow laesst sich sonst nicht fortsetzen)');
      if (ohneKommentar.indexOf('scripts/austausch.mjs einspielen') < 0) f.push('endet nicht im Brett (kein `scripts/austausch.mjs einspielen`) — die Runde waere nach der Sitzung verloren');
      // Jeder Befehl, den die Runde ihre Agenten tippen laesst, muss einer sein, den das Werkzeug kennt.
      const werk = lies('scripts/austausch.mjs'), bm = werk.match(/const BEFEHLE = \{([^}]*)\}/);
      const kennt = new Set(bm ? bm[1].split(',').map(s => s.split(':')[0].trim()) : []);
      for (const x of ohneKommentar.matchAll(/scripts\/austausch\.mjs ([a-z]+)/g)) if (!kennt.has(x[1])) f.push('nennt den Befehl „' + x[1] + '", den scripts/austausch.mjs nicht kennt');
      if (/scripts\/austausch\.js\b/.test(ohneKommentar)) f.push('nennt noch scripts/austausch.js (das Werkzeug heisst austausch.mjs)');
      // … und jedes Feld, das der Stapel traegt, eines, das eintragPruefen annimmt.
      const felder = new Set(A.FELDER);
      for (const x of ohneKommentar.matchAll(/stapel\.push\(sauber\(([\s\S]*?)\)\)\n/g)) for (const k of x[1].matchAll(/[{,]\s*([a-z_]+):/g)) if (!felder.has(k[1])) f.push('schreibt das Feld „' + k[1] + '" in den Stapel — das Brett kennt es nicht und lehnt den ganzen Stapel ab');
      try {
        const Async = Object.getPrototypeOf(async function () {}).constructor;
        new Async('agent', 'parallel', 'pipeline', 'phase', 'log', 'args', 'budget', 'workflow', t.replace(/^export const meta/, 'const meta'));
      } catch (e) { f.push('laesst sich nicht uebersetzen: ' + String(e.message).split('\n')[0]); }
      if (f.length) return { ok: false, warum: [...new Set(f)].join(' · ') };
      return { ok: true, info: rel + ' · ' + meta.phases.length + ' Phasen: ' + meta.phases.map(p => p.title).join(' → ') };
    },
  },
  {
    name: 'C1 · Die Pruefung sieht Fehler · gebaute kaputte Eintraege werden je mit dem RICHTIGEN Grund abgelehnt — und sechs gute (einer je Art) kommen ohne Grund durch',
    lauf: () => {
      const bf = mk('befund'), fr = mk('frage');
      const gut = [bf, mk('idee'), fr, mk('klasse'), mk('klasse', { ohne_waechter: undefined, waechter: [{ datei: 'scripts/x_check.js', fall: 'E10 · Zahl' }] }),
        mk('antwort', { bezug: [bz('beantwortet', fr)] }), mk('abschluss', { bezug: [bz('schliesst', bf)] }),
        mk('befund', { sicherheit: true, details_bei: 'Fernando' }), mk('befund', { anker: [{ datei: 'index.html', text: 'function gsEins(){' }], zaehle: [{ datei: 'index.html', text: 'gsEins()', n: 3 }] })];
      for (const e of gut) { const r = A.eintragPruefen(e); if (r.length) return { ok: false, warum: 'ein GUTER Eintrag (' + e.art + ') wird abgelehnt: ' + r[0] }; }
      const schlecht = [
        [mk('befund', { beleg: undefined }), /Befund ohne „beleg"/], [mk('befund', { beleg: [] }), /Befund ohne „beleg"/], [mk('befund', { beleg: ['ok', ' '] }), /beleg muss eine Liste nicht-leerer Texte/],
        [mk('idee', { pruefbar: '' }), /Idee ohne „pruefbar"/], [mk('frage', { an: undefined }), /Frage ohne „an"/], [mk('frage', { an: 'team' }), /an: alle oder fernando/],
        [mk('klasse', { ohne_waechter: undefined }), /Fehlerklasse ohne Waechter braucht „ohne_waechter"/], [mk('klasse', { instanzen: [] }), /Fehlerklasse ohne „instanzen"/],
        [mk('klasse', { waechter: [{ datei: '../x.js', fall: 'E1 Fall' }] }), /waechter\[0\]/], [mk('befund', { waechter: [{ datei: 'a.js', fall: 'Fall 1' }] }), /waechter gehoert an eine Fehlerklasse/],
        [mk('antwort'), /Antwort braucht einen Bezug/], [mk('antwort', { bezug: [bz('gehoert_zu', bf)] }), /Antwort braucht einen Bezug/], [mk('abschluss', { bezug: [bz('baut_auf', bf)] }), /Abschluss braucht einen Bezug der Art schliesst/],
        [mk('abschluss', { ergebnis: 'fertig', bezug: [bz('schliesst', bf)] }), /ergebnis: erledigt · verworfen · aufgestiegen/], [mk('abschluss', { text: '', bezug: [bz('schliesst', bf)] }), /verworfen ohne Grund/],
        [mk('abschluss', { ergebnis: 'erledigt', bezug: [bz('schliesst', bf)] }), /erledigt ohne „wohin"/],
        [mk('befund', { art: 'notiz' }), /art „notiz" gibt es nicht/], [mk('befund', { id: 'abc' }), /id fehlt oder hat nicht die Form/], [mk('befund', { datum: '2026-02-30', id: '2026-02-30-00aa' }), /kein gueltiges JJJJ-MM-TT/],
        [mk('befund', { datum: '2026-01-02' }), /id beginnt nicht mit dem datum/], [mk('befund', { zeit: '9 Uhr' }), /zeit hat nicht die Form/], [mk('befund', { von: '' }), /von fehlt/], [mk('befund', { titel: 'x'.repeat(201) }), /titel hat 201 Zeichen/],
        [mk('befund', { notiz: 'x' }), /unbekanntes Feld „notiz"/], [mk('befund', { _intern: 'x' }), /unbekanntes Feld „_intern"/],
        [mk('befund', { bezug: [{ art: 'mag', id: bf.id }] }), /art „mag" gibt es nicht/], [mk('befund', { bezug: [{ art: 'baut_auf', id: 'x' }] }), /id fehlt oder hat die falsche Form/],
        [mk('befund', { anker: [{ datei: 'index.html', text: 'kurz' }] }), /anker\[0\]: text ist EINE Zeile mit 8 bis 300/], [mk('befund', { anker: [{ datei: '/etc/passwd', text: 'ein langes Stueck' }] }), /datei muss ein Pfad im Repo sein/],
        [mk('befund', { zaehle: [{ datei: 'index.html', text: 'gsEins()', n: -1 }] }), /n ist eine ganze Zahl ab 0/], [mk('abschluss', { bezug: [bz('schliesst', bf)], anker: [{ datei: 'index.html', text: 'function gsEins(){' }] }), /anker gehoert an einen Befund/],
        [mk('befund', { sicherheit: true, text: 'so geht es', details_bei: 'Fernando' }), /sicherheit: true — kein „text"/], [mk('befund', { sicherheit: true }), /braucht „details_bei"/],
        [mk('befund', { text: 'Schluessel sk-ant-' + 'abcdefgh12345678' }), /Anthropic-Schluessel/], [mk('befund', { beleg: ['user ' + '0f8fad5b-d9cb-469f-a165-' + '70867728950e'] }), /UUID/],
        [mk('befund', { text: 'schreib an ' + 'jemand' + '@' + 'firma.ch' }), /E-Mail-Adresse/], [mk('befund', { _x: 'ghp_' + 'a'.repeat(24) }), /GitHub-Token/],
        [mk('befund', { beleg: ['siehe /tmp' + '/lauf/log.txt'] }), /nur auf einer Maschine stimmt/],
      ];
      for (const [e, re] of schlecht) {
        const r = A.eintragPruefen(e);
        if (!r.some(x => re.test(x))) return { ok: false, warum: 'ein kaputter Eintrag wird NICHT mit dem erwarteten Grund abgelehnt (' + re.source + '): ' + (r.length ? r.join(' | ') : 'keine Ablehnung') };
      }
      if (A.eintragPruefen(mk('befund', { text: 'Absender ' + 'noreply' + '@' + 'anthropic.com' })).length) return { ok: false, warum: 'eine erlaubte Adresse (noreply) wird als Geheimnis abgelehnt' };
      if (!A.eintragPruefen(bf, 'falsch.json').some(x => /Dateiname muss mit/.test(x)) || A.eintragPruefen(bf, bf.id + '-befund-x.json').length) return { ok: false, warum: 'die Pruefung des Dateinamens greift nicht in beide Richtungen' };
      return { ok: true, info: schlecht.length + ' kaputte je mit dem richtigen Grund abgelehnt · ' + gut.length + ' gute still · ein Feld mit Unterstrich ist kein Versteck (unbekannt UND durchsucht)' };
    },
  },
  {
    name: 'C2 · Das ganze Brett · Bezug ins Leere, „beantwortet" auf einen Befund, „schliesst" an einer Antwort, „ersetzt" ueber Arten hinweg, ein behobener Befund ohne Geschwister-Suche, dieselbe id zweimal, eine unlesbare Datei, eine ohne id — alles gemeldet, nichts stuerzt ab; das gute Brett bleibt still',
    lauf: () => {
      const bf = mk('befund'), fr = mk('frage'), kl = mk('klasse'), id2 = mk('idee');
      const gut = [bf, fr, kl, id2, mk('antwort', { bezug: [bz('beantwortet', fr)] }), mk('befund', { bezug: [bz('gehoert_zu', kl)] }), mk('befund', { bezug: [bz('ersetzt', bf)] }),
        mk('abschluss', { ergebnis: 'erledigt', wohin: 'v1.01', geschwister: 'gesucht: grep -c → 2 Stellen, beide umgestellt', bezug: [bz('schliesst', bf)] }), mk('abschluss', { bezug: [bz('schliesst', id2)] })];
      const g0 = A.brettPruefen(brettAus(gut));
      if (g0.length) return { ok: false, warum: 'das GUTE Brett wird beanstandet: ' + g0[0].grund };
      const faelle = [
        [[bf, mk('antwort', { bezug: [{ art: 'baut_auf', id: '2026-01-01-ffff' }] })], /den Eintrag gibt es nicht/],
        [[bf, mk('antwort', { bezug: [bz('beantwortet', bf)] })], /„beantwortet" zeigt auf .* das keine Frage ist/],
        [[bf, mk('befund', { bezug: [bz('gehoert_zu', bf)] })], /„gehoert_zu" zeigt auf .* das keine Fehlerklasse ist/],
        [[bf, mk('antwort', { bezug: [bz('baut_auf', bf), bz('schliesst', bf)] })], /„schliesst" darf nur ein Abschluss tragen/],
        [[bf, mk('idee', { bezug: [bz('ersetzt', bf)] })], /„ersetzt" verlangt dieselbe Art/],
        [[bf, mk('abschluss', { ergebnis: 'erledigt', wohin: 'v1.01', bezug: [bz('schliesst', bf)] })], /braucht „geschwister"/],
      ];
      for (const [liste, re] of faelle) { const r = A.brettPruefen(brettAus(liste)); if (!r.some(x => re.test(x.grund))) return { ok: false, warum: 'NICHT gemeldet (' + re.source + '): ' + (r.map(x => x.grund).join(' | ') || 'still') }; }
      // Und was das Schliessen WIRKT: eine Antwort mit „schliesst" und ein „ersetzt" aus fremder Art lassen den Befund OFFEN.
      const b2 = mk('befund'), um = [b2, mk('antwort', { bezug: [bz('baut_auf', b2), bz('schliesst', b2)] }), mk('idee', { bezug: [bz('ersetzt', b2)] })];
      if (A.ableiten(um).zustand.get(b2.id).z !== 'offen') return { ok: false, warum: 'das strenge Schliessen laesst sich umgehen: ein Befund gilt nach einer Antwort mit „schliesst" bzw. einem „ersetzt" aus fremder Art als ' + A.ableiten(um).zustand.get(b2.id).z };
      const d = tmp('brett');
      try {
        const a = mk('befund'), c = mk('befund');
        ablegen(d, a); ablegen(d, Object.assign({}, c, { id: a.id }), a.id + '-befund-y.json');
        ablegen(d, '{ kaputt', '2026-01-01-eeee-befund-z.json'); ablegen(d, JSON.stringify({ art: 'befund', titel: 'ohne id' }), 'ohne-id.json');
        const b = A.brettLesen(d, { alleRefs: false }), r = A.brettPruefen(b);
        if (b.eintraege.length !== 1 || b.doppelt.length !== 1 || b.unlesbar.length !== 2) return { ok: false, warum: 'gebautes Verzeichnis: ' + b.eintraege.length + ' Eintraege (erwartet 1), ' + b.doppelt.length + ' doppelt (1), ' + b.unlesbar.length + ' unlesbar (2)' };
        if (!r.some(x => /dieselbe id/.test(x.grund)) || !r.some(x => /kein gueltiges JSON/.test(x.grund)) || !r.some(x => /ohne id der Form/.test(x.grund))) return { ok: false, warum: 'doppelte id, kaputtes JSON oder fehlende id NICHT gemeldet: ' + r.map(x => x.grund).join(' | ') };
        A.ableiten(b.eintraege); A.anstoesse(b.eintraege, liesOderNull(d));
      } finally { weg(d); }
      return { ok: true, info: faelle.length + ' Regelbrueche je mit Grund gemeldet · zwei Umgehungen des strengen Schliessens wirkungslos · doppelte id, kaputtes JSON, Datei ohne id: gemeldet, kein Absturz' };
    },
  },
  {
    name: 'C3 · Zustand wird gerechnet · Frage mit Antwort ist beantwortet, Befund mit Abschluss geschlossen, ein ersetzter ersetzt, Antwort und Abschluss sind Notizen — und von zwei Nachtraegen am selben Tag gilt der SPAETERE (Uhrzeit, nicht die zufaellige id)',
    lauf: () => {
      const fr = mk('frage'), bf = mk('befund'), alt = mk('idee'), offen = mk('befund', { anker: [{ datei: 'a.js', text: 'der erste Anker' }], zaehle: [{ datei: 'a.js', text: 'abc', n: 1 }] });
      const an = mk('antwort', { bezug: [bz('beantwortet', fr)] }), zu = mk('abschluss', { bezug: [bz('schliesst', bf)] }), neu = mk('idee', { bezug: [bz('ersetzt', alt)] });
      // Der SPAETERE Nachtrag traegt die KLEINERE id — nur die Uhrzeit kann richtig entscheiden.
      const spaet = mk('antwort', { id: '2026-01-01-0001', zeit: '15:00:00', bezug: [bz('baut_auf', offen)], anker: [{ datei: 'a.js', text: 'der spaetere Anker' }], zaehle: [{ datei: 'a.js', text: 'abc', n: 5 }] });
      const frueh = mk('antwort', { id: '2026-01-01-fff0', zeit: '11:00:00', bezug: [bz('baut_auf', offen)], anker: [{ datei: 'a.js', text: 'der fruehere Anker' }], zaehle: [{ datei: 'a.js', text: 'abc', n: 3 }] });
      const alle = [fr, bf, alt, offen, an, zu, neu, frueh, spaet], abl = A.ableiten(alle), z = (e) => abl.zustand.get(e.id).z;
      const ist = [z(fr), z(bf), z(alt), z(offen), z(an), z(zu), z(neu)].join(' '), soll = 'beantwortet geschlossen ersetzt offen notiz notiz offen';
      if (ist !== soll) return { ok: false, warum: 'Zustaende: ' + ist + ' — erwartet: ' + soll };
      const ank = A.ankerWirksam(offen, abl.rueck)[0].text, n = A.zaehleWirksam(offen, abl.rueck)[0].n;
      if (ank !== 'der spaetere Anker' || n !== 5) return { ok: false, warum: 'von zwei Nachtraegen am selben Tag gilt „' + ank + '" / n=' + n + ' — erwartet der von 15:00 (die id entscheidet nicht)' };
      const kl = mk('klasse'), k = A.klasseWirksam(kl, A.ableiten([kl, mk('antwort', { bezug: [bz('baut_auf', kl)], gesucht: 'v1.01: 4 Stellen', waechter: [{ datei: 'scripts/x_check.js', fall: 'E10 · Zahl' }], suchmuster: 'grep -n x' }), mk('befund', { bezug: [bz('gehoert_zu', kl)] })]).rueck);
      if (k.gesucht.length !== 1 || k.waechter.length !== 1 || k.suchmuster !== 'grep -n x' || k.befunde.length !== 1) return { ok: false, warum: 'der Nachtrag an einer Fehlerklasse kommt nicht an: ' + JSON.stringify({ gesucht: k.gesucht, waechter: k.waechter.length, suchmuster: k.suchmuster, befunde: k.befunde.length }) };
      return { ok: true, info: 'sieben Zustaende wie erwartet · der Nachtrag von 15:00 gilt vor dem von 11:00, obwohl seine id kleiner ist · eine Klasse wird durch Antworten ergaenzt, nie umgeschrieben' };
    },
  },
  {
    name: 'C4 · Anstoesse · aus einem gebauten Brett rechnet der Code genau die erwarteten: Widerspruch, zwei Koepfe an derselben Stelle (nie derselbe Schreiber), zwei Ideen auf einen Fund, verlorener Anker, bewegte Zahl — ein Eintrag von einem FREMDEN Branch wird nicht gegen diesen Baum gemessen; dazu Marken, Nachbarn mit Irrweg, Klassenvorschlag',
    lauf: () => {
      const datei = { 'a.js': 'function gsEins(){ return 1; }\ngsEins(); gsEins();\n' }, l = (rel) => (rel in datei ? datei[rel] : null);
      const b1 = mk('befund', { stichworte: ['kachel', 'gsEins'] }), f2 = mk('frage', { von: 'sitzung/b', stichworte: ['Kachel'] }), b3 = mk('befund', { stichworte: ['gsEins'] });
      const w = mk('antwort', { von: 'sitzung/b', bezug: [bz('widerspricht', b1)] });
      const i1 = mk('idee', { bezug: [bz('baut_auf', b3)] }), i2 = mk('idee', { von: 'sitzung/b', bezug: [bz('baut_auf', b3)] });
      const ank = mk('befund', { anker: [{ datei: 'a.js', text: 'function gsWeg(){' }] }), zahl = mk('befund', { zaehle: [{ datei: 'a.js', text: 'gsEins()', n: 5 }] });
      const still = mk('befund', { anker: [{ datei: 'a.js', text: 'function gsEins(){' }], zaehle: [{ datei: 'a.js', text: 'gsEins()', n: 3 }] });
      const fremd = mk('befund', { anker: [{ datei: 'a.js', text: 'steht nur auf dem anderen Branch' }], zaehle: [{ datei: 'a.js', text: 'gsEins()', n: 9 }] });
      Object.defineProperty(fremd, '_quelle', { value: 'origin/claude/anderswo', enumerable: false });
      const alle = [b1, f2, b3, w, i1, i2, ank, zahl, still, fremd], an = A.anstoesse(alle, l);
      const arten = an.map(x => x.art).join(' '), soll = 'widerspruch beruehrung zwei_ideen anker_verloren zahl_bewegt';
      if (arten !== soll) return { ok: false, warum: 'Anstoesse: „' + arten + '" — erwartet: „' + soll + '" (' + an.map(x => kurz(x.satz, 60)).join(' | ') + ')' };
      if (an[1].ids.join() !== [b1.id, f2.id].sort().join()) return { ok: false, warum: 'die Beruehrung verbindet ' + an[1].ids.join(' + ') + ' — erwartet b1 und f2 (b1 und b3 stammen vom SELBEN Schreiber)' };
      if (an.some(x => x.ids.indexOf(fremd.id) >= 0)) return { ok: false, warum: 'ein Eintrag von einem fremden Branch wird gegen den LOKALEN Baum gemessen' };
      // Marken: ein eigener Nachtrag ist kein Echo; die Antwort eines anderen schon.
      const eigen = mk('antwort', { bezug: [bz('baut_auf', b3)], anker: [{ datei: 'a.js', text: 'function gsEins(){' }] });
      const m3 = A.marken(b3, A.ableiten([b3, eigen]), datei['a.js']), m1 = A.marken(b1, A.ableiten(alle), datei['a.js']), mx = A.marken(mk('befund', { stichworte: ['gsWeg'] }), A.ableiten(alle), datei['a.js']);
      if (m3.indexOf('noch niemand dazu') < 0 || m1.indexOf('noch niemand dazu') >= 0 || !mx.some(x => /nennt Code, den es nicht mehr gibt: gsWeg/.test(x))) return { ok: false, warum: 'Marken: eigener Nachtrag → ' + JSON.stringify(m3) + ' · fremde Antwort → ' + JSON.stringify(m1) + ' · fehlender Name → ' + JSON.stringify(mx) };
      // Nachbarn: der offene Eintrag eines ANDEREN — und ein verworfener als Irrweg mit seinem Grund.
      const irr = mk('idee', { von: 'sitzung/c', stichworte: ['kachel'] }), zu = mk('abschluss', { von: 'sitzung/c', text: 'kostet 40 ms je Start', bezug: [bz('schliesst', irr)] });
      const neu = mk('befund', { von: 'sitzung/neu', stichworte: ['kachel'] }), nb = A.nachbarn(neu, [b1, f2, irr, zu, neu]);
      if (nb.length !== 3 || !nb.some(x => x.irrweg && /40 ms/.test(x.grund)) || A.nachbarn(mk('befund', { stichworte: ['kachel'] }), [b1, b3]).length) return { ok: false, warum: 'Nachbarn: ' + nb.length + ' (erwartet 3, einer davon ein Irrweg mit Grund; und keiner beim SELBEN Schreiber)' };
      const kl = mk('klasse', { titel: 'Zwei Rechnungen fuer dieselbe Frage', regel: 'eine Kachel und eine Zeile zaehlen dasselbe aus einer Funktion' });
      const kv = A.klassenVorschlag(mk('befund', { titel: 'Die Kachel zaehlt drei Tage, die Zeile daneben nur heute', text: 'zwei Rechnungen' }), [kl]);
      if (kv.length !== 1 || kv[0].klasse.id !== kl.id) return { ok: false, warum: 'kein Klassenvorschlag fuer einen Befund mit den Worten der Klasse' };
      return { ok: true, info: 'fuenf Anstoesse in fester Reihenfolge · der Eintrag vom fremden Branch bleibt ungemessen · eigener Nachtrag ist kein Echo · 3 Nachbarn, davon 1 Irrweg mit Grund · Klassenvorschlag' };
    },
  },
  {
    name: 'C5 · Gemessen wird die SACHE, nicht der Text ueber sie · ein Stueck, das nur in einer Kommentarzeile oder im Changelog-Block steht, zaehlt nicht; ein geschlossener Eintrag wird nicht mehr gemessen',
    lauf: () => {
      const t = A.messtext('index.html', QUELLE);
      if (t.indexOf('gsNurImKommentar') >= 0 || t.indexOf('gsNurImChangelog') >= 0 || t.indexOf('function gsZwei(){') < 0) return { ok: false, warum: 'messtext laesst Kommentar oder Changelog stehen (oder nimmt Code weg)' };
      if (A.wieOft(t, 'gsEins()') !== 3 || A.wieOft(A.messtext('x.sql', '-- drop view v\ncreate view v as select 1;\n'), 'view v') !== 1 || A.wieOft(A.messtext('x.sh', '# run a\nrun a node x\n'), 'run a') !== 1) return { ok: false, warum: 'Zaehlung ohne Kommentarzeilen stimmt nicht (js/sql/sh)' };
      const l = (rel) => (rel === 'index.html' ? QUELLE : null);
      const da = mk('befund', { anker: [{ datei: 'index.html', text: 'function gsEins(){' }] }), kom = mk('befund', { anker: [{ datei: 'index.html', text: 'gsNurImKommentar()' }] });
      const log = mk('befund', { anker: [{ datei: 'index.html', text: 'gsNurImChangelog()' }] }), fehlt = mk('befund', { anker: [{ datei: 'gibt-es-nicht.js', text: 'irgendein Stueck' }] });
      const zuB = mk('befund', { anker: [{ datei: 'index.html', text: 'laengst entfernt' }] }), zu = mk('abschluss', { bezug: [bz('schliesst', zuB)] });
      const r = A.ankerPruefen([da, kom, log, fehlt, zuB, zu], l), ids = r.verloren.map(x => x.id).sort().join();
      if (ids !== [kom.id, log.id, fehlt.id].sort().join() || r.geprueft !== 4) return { ok: false, warum: 'verloren gemeldet: ' + r.verloren.map(x => x.text).join(' | ') + ' (erwartet: Kommentar, Changelog, fehlende Datei — nicht der vorhandene, nicht der geschlossene)' };
      return { ok: true, info: 'Kommentarzeile und GS_RELEASES-Block zaehlen nicht (js · sql · sh) · vorhandener Anker still · drei verlorene gemeldet · der geschlossene Eintrag bleibt ungemessen' };
    },
  },
  {
    name: 'C6 · Schreiben · ein Stapel mit Bezuegen untereinander kommt an (Monatsordner, vom Pruefstand angenommen); ein einziger Mangel schreibt NICHTS; Anker, Zahl und Waechter werden beim Schreiben gegen den Baum gemessen; „erledigt" geht erst, wenn die Zaehlung sich bewegt hat',
    lauf: () => {
      const d = tmp('schreiben');
      try {
        fs.writeFileSync(path.join(d, 'index.html'), QUELLE); fs.mkdirSync(path.join(d, 'scripts'));
        fs.writeFileSync(path.join(d, 'scripts/x_check.js'), "// Faelle\n{ name: 'E10 · Zahl der Pflanzen' },\n{ name: 'E1 · eins' }, { name: 'E1 · zwei' },\n");
        const o = { von: 'sitzung/a', datum: '2026-03-04', zeit: '08:00:00', alleRefs: false };
        const stapel = [
          { schluessel: 'b', art: 'befund', titel: 'Zwei Rechnungen fuer die Kachel', beleg: ['grep -c "gsEins()" index.html → 3'], anker: [{ datei: 'index.html', text: 'function gsEins(){ return 1; }' }], zaehle: [{ datei: 'index.html', text: 'gsEins()', n: 3 }] },
          { schluessel: 'i', art: 'idee', titel: 'Eine Funktion fuer beide', nutzen: 'eine Rechnung', pruefbar: 'x_check E10', bezug: [{ art: 'baut_auf', id: '@b' }] },
          { art: 'klasse', titel: 'Zwei Rechnungen', regel: 'eine Frage, eine Funktion', instanzen: ['v1.00: Kachel'], waechter: [{ datei: 'scripts/x_check.js', fall: 'E10 · Zahl' }] },
        ];
        const r = A.einspielen(d, stapel, o);
        if (!r.ok) return { ok: false, warum: 'ein guter Stapel wird abgelehnt: ' + r.fehler.map(x => x.grund).join(' | ') };
        const b = A.brettLesen(d, { alleRefs: false });
        if (b.eintraege.length !== 3 || A.brettPruefen(b).length || !r.geschrieben.every(x => x.datei.indexOf(A.ORDNER + '/2026-03/2026-03-04-') === 0 && gibt(x.datei, d))) return { ok: false, warum: 'nach dem Einspielen: ' + b.eintraege.length + ' Eintraege, Pruefung: ' + ((A.brettPruefen(b)[0] || {}).grund || 'still') + ', Dateien: ' + r.geschrieben.map(x => x.datei).join(', ') };
        const befund = b.eintraege.find(e => e.art === 'befund'), idee = b.eintraege.find(e => e.art === 'idee');
        if (idee.bezug[0].id !== befund.id || 'schluessel' in idee) return { ok: false, warum: 'der Stapel-Bezug @b wurde nicht zur id des Befunds (oder der schluessel blieb im Eintrag)' };
        const nein = (roh, re, was) => { const vor = A.brettLesen(d, { alleRefs: false }).eintraege.length, x = A.einspielen(d, roh, o), nach = A.brettLesen(d, { alleRefs: false }).eintraege.length;
          return (x.ok || nach !== vor || !x.fehler.some(y => re.test(y.grund))) ? was + ': ' + (x.ok ? 'angenommen' : (nach !== vor ? 'abgelehnt, aber ' + (nach - vor) + ' Datei(en) geschrieben' : 'falscher Grund: ' + x.fehler.map(y => y.grund).join(' | '))) : null; };
        const gutB = { art: 'befund', titel: 'Ein guter neben einem schlechten', beleg: ['x'] };
        const pruefe = [
          nein([gutB, { art: 'befund', titel: 'Ohne Beleg' }], /Befund ohne „beleg"/, 'alles oder nichts'),
          nein([{ art: 'befund', titel: 'Mit eigener id', beleg: ['x'], id: '2026-03-04-aaaa' }], /eine id vergibt das Werkzeug/, 'mitgebrachte id'),
          nein([{ art: 'befund', titel: 'Anker daneben', beleg: ['x'], anker: [{ datei: 'index.html', text: 'function gsDrei(){' }] }], /steht nicht woertlich in index\.html/, 'Anker, der nicht dasteht'),
          nein([{ art: 'befund', titel: 'Anker im Changelog', beleg: ['x'], anker: [{ datei: 'index.html', text: 'gsNurImChangelog()' }] }], /steht nicht woertlich/, 'Anker nur im Changelog'),
          nein([{ art: 'befund', titel: 'Falsch gezaehlt', beleg: ['x'], zaehle: [{ datei: 'index.html', text: 'gsEins()', n: 7 }] }], /steht 3-mal in index\.html, nicht 7-mal/, 'falsche Zahl'),
          nein([{ art: 'klasse', titel: 'Waechter mehrdeutig', regel: 'r', instanzen: ['i'], waechter: [{ datei: 'scripts/x_check.js', fall: 'E1 ·' }] }], /steht 2-mal in scripts\/x_check\.js/, 'mehrdeutiger Waechter'),
          nein([{ art: 'klasse', titel: 'Waechter fehlt', regel: 'r', instanzen: ['i'], waechter: [{ datei: 'scripts/x_check.js', fall: 'E99 · nie' }] }], /steht nicht in scripts\/x_check\.js/, 'Waechter ins Leere'),
          nein([{ art: 'antwort', titel: 'Bezug ins Leere', text: 't', bezug: [{ art: 'baut_auf', id: '2026-03-04-ffff' }] }], /den Eintrag gibt es nicht/, 'Bezug ins Leere'),
          nein([{ art: 'antwort', titel: 'Schliesst als Antwort', text: 't', bezug: [{ art: 'baut_auf', id: befund.id }, { art: 'schliesst', id: befund.id }] }], /„schliesst" darf nur ein Abschluss tragen/, 'Schliessen mit einer Antwort'),
          nein([{ art: 'abschluss', titel: 'Behoben', ergebnis: 'erledigt', wohin: 'v1.01', geschwister: 'gesucht: 0 weitere', bezug: [{ art: 'schliesst', id: befund.id }] }], /Zaehlung des Befunds .* steht unveraendert/, 'erledigt bei unveraenderter Zaehlung'),
          nein([{ art: 'befund', titel: 'Feld mit Unterstrich', beleg: ['x'], _notiz: 'x' }], /unbekanntes Feld „_notiz"/, 'Feld mit Unterstrich'),
        ].filter(Boolean);
        if (pruefe.length) return { ok: false, warum: pruefe.join(' · ') };
        // Die Stelle wird behoben: die Zaehlung bewegt sich, jetzt geht „erledigt" — und der Abschluss traegt die neue Zahl.
        fs.writeFileSync(path.join(d, 'index.html'), QUELLE.replace('return gsEins() + gsEins();', 'return 2;'));
        const zu = A.einspielen(d, [{ art: 'abschluss', titel: 'Behoben', ergebnis: 'erledigt', wohin: 'v1.01', geschwister: 'gesucht: 0 weitere', bezug: [{ art: 'schliesst', id: befund.id }] }], Object.assign({}, o, { zeit: '09:00:00' }));
        const b3 = A.brettLesen(d, { alleRefs: false }), ab = b3.eintraege.find(e => e.art === 'abschluss');
        if (!zu.ok || !ab || !ab.zaehle || ab.zaehle[0].n !== 1 || A.ableiten(b3.eintraege).zustand.get(befund.id).z !== 'geschlossen' || A.brettPruefen(b3).length) return { ok: false, warum: 'nach der Reparatur: ' + (zu.ok ? 'Abschluss ohne neue Zahl oder Befund nicht geschlossen' : zu.fehler.map(x => x.grund).join(' | ')) };
        return { ok: true, info: 'Stapel von 3 mit @-Bezug geschrieben (eintraege/2026-03/) · elf Maengel je mit Grund abgewiesen, jedes Mal 0 Dateien · nach der Reparatur schliesst „erledigt" und traegt die neue Zahl (3 → 1)' };
      } finally { weg(d); }
    },
  },
  {
    name: 'C7 · Das Werkzeug als Prozess · ein Wert, der mit „--" beginnt, kommt an; `--k=v` geht; ein unbekannter Schalter ist Exit 2; ohne erkennbaren Schreiber wird nicht geschrieben; eine Antwort ohne Inhalt auch nicht; Lesen schreibt nichts — auch im echten Repo',
    lauf: () => {
      const d = repo('werkzeug');
      try {
        const f = [], dateien = () => { const p = path.join(d, A.ORDNER); return fs.existsSync(p) ? fs.readdirSync(p, { recursive: true }).filter(n => /\.json$/.test(n)).length : 0; };
        let r = werkzeug(d, ['neu', 'befund', '--titel', 'Flacher Abruf schneidet die Geschichte ab', '--beleg', '--depth=1 kuerzt origin/main auf einen Commit', '--stichwort=holen,kachel', '--zaehle', 'index.html::gsEins()']);
        const b = A.brettLesen(d, { alleRefs: false }), e = b.eintraege[0];
        if (r.code !== 0 || !e || e.beleg[0].indexOf('--depth=1') !== 0 || e.stichworte.join() !== 'holen,kachel' || e.von !== 'sitzung/claude/arbeit' || e.stand !== 'v1.00' || e.zaehle[0].n !== 3) f.push('neu: Exit ' + r.code + ' · ' + (e ? JSON.stringify({ beleg: e.beleg, stichworte: e.stichworte, von: e.von, stand: e.stand, zaehle: e.zaehle }) : kurz(r.aus, 200)));
        if (e && A.brettPruefen(b).length) f.push('was `neu` schrieb, lehnt die Pruefung ab: ' + A.brettPruefen(b)[0].grund);
        const vor = dateien();
        r = werkzeug(d, ['neu', 'befund', '--titel', 'x', '--beleg', 'y', '--gibtsnicht', 'z']); if (r.code !== 2 || !/Unbekannter Schalter/.test(r.aus)) f.push('unbekannter Schalter: Exit ' + r.code);
        r = werkzeug(d, ['neu', 'befund', '--titel', 'Ohne Beleg']); if (r.code !== 1 || !/NICHT geschrieben/.test(r.aus) || !/Befund ohne „beleg"/.test(r.aus)) f.push('ohne Beleg: Exit ' + r.code);
        r = werkzeug(d, ['neu', 'befund', '--titel']); if (r.code !== 2) f.push('Schalter ohne Wert: Exit ' + r.code);
        r = werkzeug(d, ['antworte', e ? e.id.slice(-4) : 'x']); if (r.code !== 2 || !/braucht Inhalt/.test(r.aus)) f.push('Antwort ohne Inhalt: Exit ' + r.code);
        r = werkzeug(d, ['wasanderes']); if (r.code !== 2) f.push('unbekannter Befehl: Exit ' + r.code);
        g(d, ['checkout', '-q', '--detach']);
        r = werkzeug(d, ['neu', 'frage', '--titel', 'Wer schreibt hier?', '--an', 'alle']); if (r.code !== 2 || !/Wer schreibt\?/.test(r.aus)) f.push('losgeloester HEAD ohne --von: Exit ' + r.code + ' (ein Schreiber „sitzung/HEAD" sagt nichts)');
        if (dateien() !== vor) f.push('ein abgelehnter Aufruf hat geschrieben (' + vor + ' → ' + dateien() + ' Dateien)');
        r = werkzeug(d, ['neu', 'frage', '--titel', 'Wer liest die Kachel?', '--an', 'alle', '--stichwort', 'kachel', '--von', 'sitzung/zwei']);
        if (r.code !== 0 || !/NACHBARN/.test(r.aus) || !/Noch NICHT sichtbar/.test(r.aus)) f.push('zweiter Schreiber: Exit ' + r.code + ', Nachbarn ' + (/NACHBARN/.test(r.aus) ? 'gezeigt' : 'NICHT gezeigt'));
        const stand = dateien();
        for (const a of [[], ['--nur-lokal'], ['zeige', e ? e.id : 'x'], ['suche', 'kachel'], ['klasse'], ['hilfe'], ['hilfe', 'befund'], ['--json']]) {
          r = werkzeug(d, a);
          if (r.code !== 0 || (a[0] !== '--json' && !/Nichts geschrieben\.\s*$/.test(r.aus))) f.push('`' + (a.join(' ') || 'lesen') + '`: Exit ' + r.code + ', Schlusszeile „Nichts geschrieben." ' + (/Nichts geschrieben\./.test(r.aus) ? 'da' : 'fehlt'));
        }
        if (dateien() !== stand) f.push('ein Lese-Befehl hat geschrieben');
        r = werkzeug(d, []); if (!/ZWEI KOEPFE, DIESELBE STELLE/.test(r.aus) || !/ohne Antwort/.test(r.aus) || (r.aus.match(/Flacher Abruf schneidet/g) || []).length !== 2) f.push('lesen zeigt den Anstoss, die Marke oder den Befund nicht wie erwartet (einmal im Anstoss, einmal in der Liste)');
        // Die Ware: im echten Repo liest das Werkzeug, ohne etwas anzufassen.
        const echt = () => { const p = path.join(WURZEL, A.ORDNER); return fs.existsSync(p) ? fs.readdirSync(p, { recursive: true }).join('|') : ''; };
        const vorher = echt(), w = cp.spawnSync(process.execPath, [WERKZEUG, '--nur-lokal'], { encoding: 'utf8', env: Object.assign({}, process.env, { AUSTAUSCH_WURZEL: '' }) });
        if (w.status !== 0 || !/Nichts geschrieben\.\s*$/.test(w.stdout) || echt() !== vorher) f.push('im echten Repo: Exit ' + w.status + (echt() !== vorher ? ', der Ordner hat sich geaendert' : ''));
        if (f.length) return { ok: false, warum: f.join(' · ') };
        return { ok: true, info: '„--depth=1 …" als Wert angekommen · --stichwort=a,b · Zaehlung selbst gerechnet (3) · sechs Fehlbedienungen mit Exit 2 bzw. 1 und 0 Dateien · acht Lese-Befehle enden mit „Nichts geschrieben." · im echten Repo unveraendert' };
      } finally { weg(d); }
    },
  },
  {
    name: 'C8 · Ueber Branches · ein Eintrag, der NUR auf einem nie gemergten Branch liegt, steht im Brett; eine Datei ohne id oder mit einer unbekannten Art auf einem fremden Branch stuerzt nichts; ein dort umgeschriebener Eintrag wird gemeldet; eine Antwort ueber die Branch-Grenze nimmt ihr Ziel mit; `ernten` holt den Rest; `holen` laesst die gemeinsame Geschichte stehen',
    lauf: () => {
      const bare = tmp('origin'), d = tmp('klon');
      try {
        cp.execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare]);
        g(d, ['init', '-q', '-b', 'main', '.']); g(d, ['remote', 'add', 'origin', bare]);
        fs.writeFileSync(path.join(d, 'index.html'), QUELLE);
        const o = { von: 'sitzung/main', datum: '2026-02-01', zeit: '08:00:00', alleRefs: false };
        const r0 = A.einspielen(d, [{ art: 'befund', titel: 'Auf main bekannt', beleg: ['x'], stichworte: ['kachel'] }], o);
        for (let i = 1; i <= 3; i++) { fs.writeFileSync(path.join(d, 'n' + i), String(i)); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'main ' + i]); }
        g(d, ['push', '-q', 'origin', 'main']);
        // Branch 1: zwei Eintraege, nie gemergt.
        g(d, ['checkout', '-q', '-b', 'claude/nie-gemergt']);
        const r1 = A.einspielen(d, [{ schluessel: 'f', art: 'frage', titel: 'Wer liest die Kachel?', an: 'alle', stichworte: ['kachel'] }, { art: 'idee', titel: 'Kachel aus einer Funktion', nutzen: 'n', pruefbar: 'p', bezug: [{ art: 'baut_auf', id: '@f' }] }], Object.assign({}, o, { von: 'sitzung/nie-gemergt' }));
        g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'zwei Eintraege']); g(d, ['push', '-q', 'origin', 'claude/nie-gemergt']);
        // Branch 2: eine Datei ohne id — und der Eintrag von main, umgeschrieben.
        g(d, ['checkout', '-q', '-b', 'claude/kaputt', 'main']);
        ablegen(d, JSON.stringify({ art: 'befund', titel: 'ohne id' }), 'ohne-id.json');
        ablegen(d, { id: '2026-02-01-0f0f', art: 'zukunft', datum: '2026-02-01', von: 'sitzung/spaeter', titel: 'Eine Art, die dieses Modul noch nicht kennt' });
        const p0 = path.join(d, r0.geschrieben[0].datei); fs.writeFileSync(p0, fs.readFileSync(p0, 'utf8').replace('Auf main bekannt', 'Auf main bekannt — nachtraeglich geaendert'));
        g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'kaputt']); g(d, ['push', '-q', 'origin', 'claude/kaputt']);
        g(d, ['checkout', '-q', '-b', 'claude/arbeit', 'main']); g(d, ['fetch', '-q', 'origin']);
        const lokal = A.brettLesen(d, { alleRefs: false }), alle = A.brettLesen(d, { alleRefs: true });
        if (lokal.eintraege.length !== 1 || alle.eintraege.length !== 4) return { ok: false, warum: 'nur Arbeitsbaum: ' + lokal.eintraege.length + ' (erwartet 1) · mit Remote-Refs: ' + alle.eintraege.length + ' (erwartet 4)' };
        const zk = werkzeug(d, ['zeige', '0f0f']);
        if (zk.code !== 0 || !/UNBEKANNTE ART/.test(zk.aus)) return { ok: false, warum: 'ein Eintrag mit einer unbekannten Art von einem fremden Branch: `zeige` endet mit Exit ' + zk.code + ' — ' + kurz(zk.aus, 160) };
        if (alle.unlesbar.length !== 1 || alle.abweichend.length !== 1 || alle.abweichend[0].gilt !== 'Arbeitsbaum') return { ok: false, warum: 'Datei ohne id: ' + alle.unlesbar.length + ' unlesbar (erwartet 1) · umgeschriebener Eintrag: ' + alle.abweichend.length + ' gemeldet (erwartet 1, es gilt der Arbeitsbaum)' };
        let r = werkzeug(d, []);
        if (r.code !== 0 || !/unlesbare Datei/.test(r.aus) || !/sehen auf einem Branch anders aus/.test(r.aus) || !/\{origin\/claude\/nie-gemergt\}/.test(r.aus) || !/FRISCHE BRANCHES/.test(r.aus)) return { ok: false, warum: 'lesen ueber Branches: Exit ' + r.code + ' — erwartet Hinweise auf die unlesbare Datei, den abweichenden Eintrag, die Herkunft {origin/…} und die frischen Branches: ' + kurz(r.aus, 300) };
        const frageId = r1.geschrieben[0].id;
        r = werkzeug(d, ['antworte', frageId.slice(-4), '--text', 'Gemessen: zwei Anzeigen lesen sie']);
        const nach = A.brettLesen(d, { alleRefs: false });
        if (r.code !== 0 || !/Mitgenommen/.test(r.aus) || nach.eintraege.length !== 3 || A.brettPruefen(nach).length) return { ok: false, warum: 'Antwort ueber die Branch-Grenze: Exit ' + r.code + ', ' + nach.eintraege.length + ' Eintraege im Arbeitsbaum (erwartet 3: Befund, mitgenommene Frage, Antwort), Pruefung: ' + ((A.brettPruefen(nach)[0] || {}).grund || 'still') };
        r = werkzeug(d, ['ernten']);
        const geerntet = A.brettLesen(d, { alleRefs: false });
        if (r.code !== 0 || geerntet.eintraege.length !== 4 || A.brettPruefen(geerntet).length || (r.aus.match(/^  \S+  \{origin\/claude\/kaputt\}/gm) || []).length !== 2) return { ok: false, warum: 'ernten: Exit ' + r.code + ', ' + geerntet.eintraege.length + ' Eintraege (erwartet 4: die unbekannte Art und die Datei ohne id bleiben auf ihrem Branch), die Datei ohne id ' + (/Uebergangen/.test(r.aus) ? 'uebergangen' : 'NICHT als uebergangen genannt') };
        // holen: die gemeinsame Geschichte bleibt (ein flacher Abruf wuerde sie kappen).
        const vorher = g(d, ['rev-list', '--count', 'origin/main']).trim();
        r = werkzeug(d, ['holen']);
        const flach = g(d, ['rev-parse', '--is-shallow-repository']).trim(), nachher = g(d, ['rev-list', '--count', 'origin/main']).trim();
        let basis = ''; try { basis = g(d, ['merge-base', 'HEAD', 'origin/main']).trim(); } catch (_) {}
        if (r.code !== 0 || !/Alle Branches geholt/.test(r.aus) || flach !== 'false' || nachher !== vorher || !basis) return { ok: false, warum: 'holen: Exit ' + r.code + ', flach=' + flach + ', origin/main ' + vorher + ' → ' + nachher + ' Commits, merge-base ' + (basis ? 'da' : 'FEHLT') };
        return { ok: true, info: 'Arbeitsbaum 1 · mit Remote-Refs 4 · Datei ohne id und eine unbekannte Art: gemeldet bzw. gezeigt, kein Absturz · umgeschriebener Eintrag gemeldet (es gilt der Arbeitsbaum) · Antwort nimmt die Frage mit · ernten holt den vierten · holen: ' + nachher + ' Commits auf origin/main wie zuvor, merge-base da' };
      } catch (e) { return { ok: false, warum: 'Ausnahme: ' + String(e.message).split('\n')[0] }; } finally { weg(bare); weg(d); }
    },
  },
  {
    name: 'C9 · Uebergabe und Zahlen sehen Fehler · ein gebauter STATUS-Eintrag ohne `**Offen:**`, mit leerem Offen, mit einer id ins Leere, ohne „Nicht geprüft" oder ohne Eintrag zur laufenden Version wird gemeldet, vier gute Formen nicht; in einem gebauten Repo mit 3 run-Zeilen wird „4" gemeldet, „3" nicht',
    lauf: () => {
      const S = (zeilen, kopf) => '# Status\n\n## 0 · Routine\n\n> Hinweis\n\n### 2026-03-05 (zz) - ' + (kopf || 'v1.00: neu') + '\n\nText.\n\n' + zeilen + '\n\n### 2026-03-01 (zy) - v0.99: alt\n\n**Offen:** nichts\n**Nicht geprüft:** alt\n\n## 1 · Stand\n';
      const ids = new Set(['2026-03-04-00aa', '2026-03-04-00bb']);
      const gut = ['**Offen:** brett:2026-03-04-00aa, brett:2026-03-04-00bb — beide warten auf eine Messung\n**Nicht geprüft:** der echte Server', '**Offen:** nichts\n**Nicht geprüft von hier:** das Telefon',
        '**Nicht geprüft, ehrlich:** hier laeuft kein Android\n\n**Offen:** nichts — alles geschlossen', '**Offen:** brett:2026-03-04-00aa\n**Nicht geprüft:** nichts ausgelassen'];
      for (const z of gut) { const r = statusPruefen(S(z), 'v1.00', ids); if (r.length) return { ok: false, warum: 'eine GUTE Uebergabe wird beanstandet: ' + r[0] }; }
      const schlecht = [
        ['**Nicht geprüft:** der Server', /hat keine Zeile `\*\*Offen:\*\*/], ['**Offen:** einiges, siehe oben\n**Nicht geprüft:** x', /nennt weder einen Eintrag/],
        ['**Offen:** brett:2026-03-04-00cc\n**Nicht geprüft:** x', /nennt brett:2026-03-04-00cc — den Eintrag gibt es im Arbeitsbaum nicht/], ['**Offen:** nichts', /hat keine Zeile `\*\*Nicht geprüft:\*\*/],
        ['**Offen:** nichts\n**Nicht geprüft:**', /hat keine Zeile `\*\*Nicht geprüft:\*\*/], ['Offen: nichts\nNicht geprüft: x', /hat keine Zeile `\*\*Offen:\*\*/],
      ];
      for (const [z, re] of schlecht) { const r = statusPruefen(S(z), 'v1.00', ids); if (!r.some(x => re.test(x))) return { ok: false, warum: 'NICHT gemeldet (' + re.source + '): ' + (r.join(' | ') || 'still') }; }
      // Der AELTERE Eintrag hat die Zeilen — gemessen wird der juengste.
      if (!statusPruefen(S('Kein Wort dazu.'), 'v1.00', ids).length) return { ok: false, warum: 'die Zeilen eines AELTEREN Eintrags werden dem juengsten angerechnet' };
      if (!statusPruefen(S(gut[1]), 'v1.01', ids).some(x => /laufende Version v1\.01 hat keinen Eintrag/.test(x)) || statusPruefen(S(gut[1], 'kein Bump: Doku'), 'v0.99', ids).length) return { ok: false, warum: 'die laufende Version ohne §0-Eintrag wird nicht gemeldet (oder ein Eintrag ohne Bump verlangt faelschlich einen)' };
      const d = tmp('zahlen');
      try {
        fs.mkdirSync(path.join(d, 'scripts'));
        fs.writeFileSync(path.join(d, 'scripts/pruefstaende.sh'), 'run a node scripts/a_check.js\nTAILN=8 run b node scripts/b_check.js\n  run c node scripts/c_check.js\n# run d — ein Kommentar zaehlt nicht\n');
        const L = [{ was: 'run-Zeilen', re: /fährt \*\*alle (\d+)\*\*/, miss: (w) => runZeilen(w).length, befehl: 'grep -c' }];
        const st = (n) => fs.writeFileSync(path.join(d, 'STATUS.md'), '## 0 · x\n\n## 1 · Stand\n\n- die Suite fährt **alle ' + n + '**.\n\n## 2 · Offen\n\nfährt **alle 9** (steht in §2 und zaehlt nicht)\n');
        st(3); const a = zahlenPruefen(d, L); st(4); const b = zahlenPruefen(d, L);
        fs.writeFileSync(path.join(d, 'STATUS.md'), '# S\n\n## 1 · Stand\n\n- viele Pruefstaende.\n'); const c = zahlenPruefen(d, L);
        if (a.fehler.length || a.stellen !== 1) return { ok: false, warum: 'die richtige Zahl wird gemeldet: ' + a.fehler.join(' ') };
        if (!b.fehler.some(x => /nennt 4 run-Zeilen, gemessen 3/.test(x))) return { ok: false, warum: 'die falsche Zahl wird NICHT gemeldet: ' + JSON.stringify(b.fehler) };
        if (!c.fehler.some(x => /ist nicht zu finden/.test(x))) return { ok: false, warum: 'ein umgeschriebener Satz wird nicht als fehlende Stelle gemeldet' };
      } finally { weg(d); }
      return { ok: true, info: 'vier gute Formen still (auch „Nicht geprüft von hier:" und „Offen: nichts — …") · sechs schlechte je mit Grund · gemessen wird der JUENGSTE Eintrag · Version ohne Eintrag gemeldet · 3 run-Zeilen: „3" still, „4" gemeldet, Satz ohne Zahl: Stelle fehlt' };
    },
  },
];

(async function haupt() {
  console.log('\n=== austausch_check — kommt an, was eine KI-Sitzung der naechsten sagt?');
  let kaputt = 0, offen = 0;
  try { A = await import(pathToFileURL(path.join(__dirname, '_austausch.mjs')).href); }
  catch (e) { console.log('  !!   scripts/_austausch.mjs laesst sich nicht laden\n         → ' + String(e && e.message).split('\n')[0]); process.exitCode = 1; return; }
  for (const f of FAELLE) {
    let r;
    try { r = await f.lauf(); } catch (e) { r = { ok: false, warum: 'Ausnahme: ' + (e && e.message ? e.message.split('\n')[0] : e) }; }
    if (r && r.offen) { offen++; console.log('  --   ' + f.name + '\n         → nicht pruefbar: ' + ((r && r.warum) || 'unbekannt')); }
    else if (r && r.ok) console.log('  ok   ' + f.name + (r.info ? '   [' + r.info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
  }
  console.log('  ---');
  console.log('  Faelle geprueft: ' + FAELLE.length + ' · davon kaputt: ' + kaputt + (offen ? ' · nicht pruefbar: ' + offen : ''));
  console.log('  Grenze: geprueft wird der Arbeitsbaum — was nur auf einem anderen Branch liegt, zeigt `node scripts/austausch.mjs holen`.');
  console.log('  Ob ein Eintrag klug ist, rechnet niemand; gerechnet wird, ob er pruefbar, verbunden und ehrlich ist.');
  process.exitCode = kaputt ? 1 : (offen ? 2 : 0);
})();
