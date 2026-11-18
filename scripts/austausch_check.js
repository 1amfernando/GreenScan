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
    klasse: { regel: 'der Leser ist die Regel', instanzen: ['v1.00: eine Stelle'], ohne_waechter: 'noch kein Fall' }, antwort: {},
    lage: { phase: 'laeuft', bis: '2026-01-01T16:00:00Z' }, halt: { text: 'main ist rot', bis: '2026-01-02T10:00:00Z', geltung: ['gsZwei'] }, abschluss: { ergebnis: 'verworfen', text: 'haelt der Messung nicht stand' },
  }[art] || {};
  return Object.assign(basis, je, o || {});
}
const bz = (art, e) => ({ art, id: e.id });
const brettAus = (eintraege) => ({ eintraege, unlesbar: [], doppelt: [], abweichend: [] });
function ablegen(wurzel, e, name) {
  const d = path.join(wurzel, A.ORDNER, e.id ? e.id.slice(0, 7) : '2026-01'); fs.mkdirSync(d, { recursive: true });
  const p = path.join(d, name || (e.id + '-' + e.art + '-x.json')); fs.writeFileSync(p, typeof e === 'string' ? e : JSON.stringify(e, null, 2) + '\n'); return p;
}

// Kritisch erreicht Fernando: EINE Rechnung (A.kritischOhneZitat) fuer die Ware (A7), den gebauten Fall (C11) und `ernten`.
const fernandoWo = () => A.fernandoText(lies('STATUS.md'), gibt('docs/FUER-FERNANDO.md') ? lies('docs/FUER-FERNANDO.md') : '');
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
      const zit = A.zitierteIds(fernandoWo());
      const fragen = b.eintraege.filter(e => e.art === 'frage' && e.an === 'fernando' && abl.zustand.get(e.id).z === 'offen');
      for (const e of fragen) if (!zit.has(e.id)) f.push('die Frage an Fernando ' + e.id + ' („' + kurz(e.titel, 60) + '") steht weder in STATUS.md §2 noch in docs/FUER-FERNANDO.md — er liest das Brett nicht: dort eine Zeile mit brett:' + e.id);
      const dateien = ['STATUS.md', 'ROADMAP.md', 'CLAUDE.md', 'AGENTS.md', 'README.md'].concat(
        ['docs', 'docs/memory', 'docs/austausch'].reduce((l, d) => l.concat(gibt(d) ? fs.readdirSync(path.join(WURZEL, d)).filter(n => /\.md$/.test(n)).map(n => d + '/' + n) : []), []));
      let zitate = 0;
      for (const d of dateien) {
        if (!gibt(d)) continue;
        for (const m of lies(d).matchAll(A.BRETT_ZITAT)) { zitate++; if (!ids.has(m[1])) f.push(d + ' nennt brett:' + m[1] + ' — den Eintrag gibt es nicht'); }
      }
      if (f.length) return { ok: false, warum: f.slice(0, 5).join(' · ') + (f.length > 5 ? ' · +' + (f.length - 5) + ' weitere' : '') };
      return { ok: true, info: fragen.length + ' offene Fragen an Fernando, alle dort zitiert · ' + zitate + ' Zitate in ' + dateien.length + ' Dokumenten, keines ins Leere' };
    },
  },
  {
    name: 'A6 · Waechter · keine Eintragsdatei, die an der ABZWEIGSTELLE lag (lokal merge-base mit origin/main, in CI die Basis-Seite des PR-Merge-Commits), fehlt oder ist umgeschrieben — ausser ihre id steht auf der Grabstein-Liste; die Grabstein-Liste traegt nur id, datum, grund',
    lauf: () => {
      const f = [];
      if (gibt(A.GRABSTEINE)) { const gs = A.grabsteinePruefen(lies(A.GRABSTEINE)); if (gs.fehler.length) f.push(A.GRABSTEINE + ': ' + gs.fehler.slice(0, 3).join(' · ')); }
      // Die Basis: fest, nie die bewegliche Spitze von main (gegen die waeren 15 von 17 frischen Branches rot).
      const wb = A.waechterBasis(WURZEL, process.env);
      if (wb.leer && !f.length) return { ok: true, info: wb.grund };
      if (wb.grund) return f.length ? { ok: false, warum: f.join(' · ') } : { offen: true, warum: wb.grund };
      const basis = wb.basis, woher = wb.woher;
      const lokal = A.brettLesen(WURZEL, { alleRefs: false });
      for (const d of lokal.grabDateien) f.push(d + ' steht auf der Grabstein-Liste und liegt noch im Baum — git rm');
      const r = A.geloeschtSeit(WURZEL, basis);
      if (r.grund) return { offen: true, warum: r.grund };
      if (r.fehlt.length) f.push(r.fehlt.length + ' Eintragsdatei(en) der Abzweigstelle fehlen hier: ' + r.fehlt.slice(0, 3).join(', ') + ' — ein Eintrag wird nie geloescht; was bewusst weg soll (Personenname, Geheimnis), kommt mit id und Grund auf ' + A.GRABSTEINE);
      if (r.anders.length) f.push(r.anders.length + ' Eintragsdatei(en) sind umgeschrieben: ' + r.anders.slice(0, 3).join(', ') + ' — ein Eintrag wird nie umgeschrieben (antworte / schliesse)');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: r.n + ' Eintragsdateien an der Abzweigstelle ' + basis.slice(0, 8) + ' (' + woher + '), alle unveraendert da' };
    },
  },
  {
    name: 'A7 · Kritisch erreicht Fernando · jeder offene KRITISCHE Eintrag im Arbeitsbaum steht mit `brett:<id>` in STATUS.md §2 oder docs/FUER-FERNANDO.md — eine Live-Gefahr, die nur Sitzungen sehen, die nichts anwenden duerfen, erreicht niemanden',
    lauf: () => {
      const b = A.brettLesen(WURZEL, { alleRefs: false }), f = [];
      const { kritisch, ohne } = A.kritischOhneZitat(b.eintraege, fernandoWo());
      for (const e of ohne) f.push(e.id + ' („' + kurz(e.titel, 60) + '") ist kritisch und steht weder in STATUS.md §2 noch in docs/FUER-FERNANDO.md');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: kritisch.length + ' offene kritische Eintraege, alle dort zitiert' };
    },
  },
  {
    name: 'A8 · Halt und dieser Stand · welche WIRKSAMEN Halts im Baum beruehrt dieser Stand (im PR: gegen die Basis-Seite des Merge-Commits)? Ein Bericht, keine Sperre — wer merged, liest hier, worum eine andere Sitzung gebeten hat',
    lauf: () => {
      const wb = A.waechterBasis(WURZEL, process.env);
      if (wb.grund) return { ok: true, info: 'nicht rechenbar: ' + wb.grund };
      const aend = A.eigeneAenderung(WURZEL, process.env.GITHUB_EVENT_NAME === 'pull_request' ? { basis: wb.basis } : {});
      if (aend.grund) return { ok: true, info: 'nicht rechenbar: ' + aend.grund };
      const ich = process.env.GITHUB_HEAD_REF ? 'sitzung/' + process.env.GITHUB_HEAD_REF : null;
      const b = A.brettLesen(WURZEL, { alleRefs: false }), sw = A.schwarm(b.eintraege, Date.now(), { ich });
      const treffer = sw.halts.filter(h => !h.veto && h.e.von !== ich).map(h => ({ h, t: A.haltBeruehrt(h.e, aend) })).filter(x => x.t.length);
      return { ok: true, info: sw.halts.length + ' wirksame Halt(s) im Baum · ' + aend.dateien.length + ' Datei(en), ' + aend.funktionen.length + ' Funktion(en) geaendert' + (aend.bump ? ', mit Bump' : '') + ' · ' + (treffer.length ? '!! BERUEHRT: ' + treffer.map(x => x.h.e.id + ' von ' + x.h.e.von + ' bis ' + x.h.e.bis + ' (' + x.t.slice(0, 3).join(', ') + ') — „' + kurz(x.h.e.text, 80) + '"').join(' | ') : 'keiner beruehrt diesen Stand') };
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
        const worte = Object.keys(A.ARTEN).concat(Object.keys(A.BEZUEGE), A.ERGEBNISSE, A.FELDER.filter(k => k !== 'schluessel'), A.PHASEN, A.DRINGLICHKEIT, A.AN);
        const fehlt = [...new Set(worte)].filter(w => t.indexOf('`' + w + '`') < 0);
        if (fehlt.length) f.push('docs/austausch/README.md erklaert nicht: ' + fehlt.map(w => '`' + w + '`').join(' ') + ' — das Vokabular des Moduls und seine Beschreibung gehoeren zusammen');
        const bm = lies('scripts/austausch.mjs').match(/const BEFEHLE = [^{]*\{([^}]*)\}/);
        const befehle = bm ? bm[1].split(',').map(x => x.split(':')[0].trim()).filter(Boolean) : [];
        if (!befehle.length) f.push('die Befehlsliste (BEFEHLE) in scripts/austausch.mjs ist nicht lesbar');
        const ohneBefehl = befehle.filter(w => w !== 'lesen' && t.indexOf('austausch.mjs ' + w) < 0 && !new RegExp('`' + w + '[` ]').test(t));
        if (ohneBefehl.length) f.push('docs/austausch/README.md nennt die Befehle nicht: ' + ohneBefehl.join(', '));
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
      const idRe = (ohneKommentar.match(/const istId = \(s\) => \/(.+)\/\.test\(/) || [])[1];
      if (idRe !== A.ID_FORM.source) f.push('istId der Runde (' + idRe + ') ist nicht die id-Form des Moduls (' + A.ID_FORM.source + ') — eine Runde, die eine id nicht erkennt, macht aus ihr einen Stapel-Schluessel ins Leere');
      for (const [re, was] of [[/\bDate\.now\s*\(/, 'Date.now()'], [/\bMath\.random\s*\(/, 'Math.random()'], [/\bnew Date\s*\(\s*\)/, 'new Date()'], [/\bimport\s*\(/, 'import()']]) if (re.test(ohneKommentar)) f.push('ruft ' + was + ' (ein Workflow laesst sich sonst nicht fortsetzen)');
      if (ohneKommentar.indexOf('scripts/austausch.mjs einspielen') < 0) f.push('endet nicht im Brett (kein `scripts/austausch.mjs einspielen`) — die Runde waere nach der Sitzung verloren');
      // Jeder Befehl, den die Runde ihre Agenten tippen laesst, muss einer sein, den das Werkzeug kennt.
      const werk = lies('scripts/austausch.mjs'), bm = werk.match(/const BEFEHLE = [^{]*\{([^}]*)\}/);
      const kennt = new Set(bm ? bm[1].split(',').map(s => s.split(':')[0].trim()) : []);
      for (const x of ohneKommentar.matchAll(/scripts\/austausch\.mjs ([a-z]+)/g)) if (!kennt.has(x[1])) f.push('nennt den Befehl „' + x[1] + '", den scripts/austausch.mjs nicht kennt');
      if (/scripts\/austausch\.js\b/.test(ohneKommentar)) f.push('nennt noch scripts/austausch.js (das Werkzeug heisst austausch.mjs)');
      // … und jedes Feld, das der Stapel traegt, eines, das eintragPruefen annimmt.
      const felder = new Set(A.FELDER);
      for (const x of ohneKommentar.matchAll(/stapel\.push\(sauber\(([\s\S]*?)\)\)\n/g)) for (const k of x[1].matchAll(/[{,]\s*([a-z_]+):/g)) if (!felder.has(k[1])) f.push('schreibt das Feld „' + k[1] + '" in den Stapel — das Brett kennt es nicht und lehnt den ganzen Stapel ab');
      // Ein Sicherheitsbefund geht mit Titel und details_bei aufs Brett — nie mit Beleg, Text, Vorschlag, Anker oder dem Urteil des Skeptikers.
      const sich = [...ohneKommentar.matchAll(/stapel\.push\(sauber\(([\s\S]*?)\)\)\n/g)].map(x => x[1]).filter(x => /sicherheit: true/.test(x));
      if (sich.length !== 1) f.push('erwartet genau EINEN eigenen Zweig fuer Sicherheitsbefunde (stapel.push mit sicherheit: true), gefunden ' + sich.length);
      else { const zuviel = ['beleg', 'text', 'vorschlag', 'anker', 'zaehle'].filter(k => new RegExp('[{,]\\s*' + k + '\\s*[:,}]').test(sich[0])); if (zuviel.length) f.push('der Sicherheits-Zweig schreibt ' + zuviel.join(', ') + ' aufs oeffentliche Brett'); }
      if (!/const ua = urteile\.get\(a\.schluessel\)\s*\n\s*if \(!ua \|\| ua\.haelt !== true\) \{[^\n]*continue \}/.test(ohneKommentar)) f.push('Antworten aus der Phase Kreuzen gehen ohne bestaetigendes Urteil des Skeptikers aufs Brett');
      try {
        const Async = Object.getPrototypeOf(async function () {}).constructor;
        new Async('agent', 'parallel', 'pipeline', 'phase', 'log', 'args', 'budget', 'workflow', t.replace(/^export const meta/, 'const meta'));
      } catch (e) { f.push('laesst sich nicht uebersetzen: ' + String(e.message).split('\n')[0]); }
      if (f.length) return { ok: false, warum: [...new Set(f)].join(' · ') };
      return { ok: true, info: rel + ' · ' + meta.phases.length + ' Phasen: ' + meta.phases.map(p => p.title).join(' → ') };
    },
  },
  {
    name: 'C1 · Die Pruefung sieht Fehler · gebaute kaputte Eintraege werden je mit dem RICHTIGEN Grund abgelehnt, gute kommen durch — und jede bekannte Form eines Geheimnisses wird erkannt, auch am Anfang einer Zeile',
    lauf: () => {
      const bf = mk('befund'), fr = mk('frage');
      const gut = [bf, mk('idee'), fr, mk('klasse'), mk('klasse', { ohne_waechter: undefined, waechter: [{ datei: 'scripts/x_check.js', fall: 'E10 · Zahl' }] }),
        mk('antwort', { bezug: [bz('beantwortet', fr)] }), mk('abschluss', { bezug: [bz('schliesst', bf)] }),
        mk('befund', { sicherheit: true, details_bei: 'Fernando', beleg: undefined }), mk('frage', { sicherheit: true, details_bei: 'Fernando' }), mk('antwort', { bezug: [{ art: 'beantwortet', id: fr.id, ref: 'origin/claude/anderswo' }] }), mk('befund', { anker: [{ datei: 'index.html', text: 'function gsEins(){' }], zaehle: [{ datei: 'index.html', text: 'gsEins()', n: 3 }] })];
      for (const e of gut) { const r = A.eintragPruefen(e); if (r.length) return { ok: false, warum: 'ein GUTER Eintrag (' + e.art + ') wird abgelehnt: ' + r[0] }; }
      const schlecht = [
        [mk('befund', { beleg: undefined }), /Befund ohne „beleg"/], [mk('befund', { beleg: [] }), /Befund ohne „beleg"/], [mk('befund', { beleg: ['ok', ' '] }), /beleg muss eine Liste nicht-leerer Texte/],
        [mk('idee', { pruefbar: '' }), /Idee ohne „pruefbar"/], [mk('frage', { an: undefined }), /Frage ohne „an"/], [mk('frage', { an: 'team' }), /an: alle · fernando · koordinator oder sitzung\/<branch>/],
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
        [mk('befund', { sicherheit: true, beleg: undefined, text: 'so geht es', details_bei: 'Fernando' }), /sicherheit: true — nur Titel, Stichworte und „details_bei" .* nicht: text/], [mk('befund', { sicherheit: true, details_bei: 'Fernando' }), /sicherheit: true — nur Titel.* nicht: beleg/],
        [mk('befund', { sicherheit: true, beleg: undefined, details_bei: 'Fernando', vorschlag: 'so schliesst man es', anker: [{ datei: 'index.html', text: 'function gsEins(){' }] }), /nicht: vorschlag, anker/], [mk('befund', { sicherheit: true, beleg: undefined }), /braucht „details_bei"/],
        [mk('klasse', { sicherheit: true, details_bei: 'Fernando' }), /sicherheit: true gibt es nur an einem Befund oder einer Frage/],
        [mk('befund', { art: 'constructor' }), /art „constructor" gibt es nicht/], [mk('befund', { bezug: [{ art: 'toString', id: bf.id }] }), /art „toString" gibt es nicht/], [mk('antwort', { bezug: [{ art: 'baut_auf', id: bf.id, ref: 7 }] }), /ref nennt den Branch/],
        [mk('befund', { text: 'Schluessel sk-ant-' + 'abcdefgh12345678' }), /Anthropic-Schluessel/], [mk('befund', { beleg: ['user ' + '0f8fad5b-d9cb-469f-a165-' + '70867728950e'] }), /UUID/],
        [mk('befund', { text: 'schreib an ' + 'jemand' + '@' + 'firma.ch' }), /E-Mail-Adresse/], [mk('befund', { _x: 'ghp_' + 'a'.repeat(24) }), /GitHub-Token/],
        [mk('befund', { beleg: ['siehe /tmp' + '/lauf/log.txt'] }), /nur auf einer Maschine stimmt/],
      ];
      for (const [e, re] of schlecht) {
        const r = A.eintragPruefen(e);
        if (!r.some(x => re.test(x))) return { ok: false, warum: 'ein kaputter Eintrag wird NICHT mit dem erwarteten Grund abgelehnt (' + re.source + '): ' + (r.length ? r.join(' | ') : 'keine Ablehnung') };
      }
      if (A.eintragPruefen(mk('befund', { text: 'Absender ' + 'noreply' + '@' + 'anthropic.com' })).length) return { ok: false, warum: 'eine erlaubte Adresse (noreply) wird als Geheimnis abgelehnt' };
      // Jede Form, in jeder Stellung: mitten in der Zeile, allein im Feld — und am ANFANG einer Zeile, wie sie in jeder Befehlsausgabe steht.
      const FORMEN = [['sk-ant-' + 'abcdefgh12345678', /Anthropic-Schluessel/], ['eyJ' + 'hbGciOiJIUzI1' + '.' + 'eyJyb2xlIjoi' + '.' + 'c2lnbmF0dXJl', /JWT/], ['sk_' + 'live_' + 'abcdefgh1234', /Stripe-Schluessel/], ['whsec_' + 'abcdefgh1234', /Webhook-Geheimnis/],
        ['sb_' + 'secret_' + 'abcdefgh1234', /Supabase-Geheimnis/], ['ghp_' + 'a'.repeat(24), /GitHub-Token/], ['-----BEGIN ' + 'RSA PRIVATE KEY-----', /privater Schluessel/], ['0f8fad5b-d9cb-469f-a165-' + '70867728950e', /UUID/], ['jemand' + '@' + 'firma.ch', /E-Mail-Adresse/]];
      if (FORMEN.length !== A.GEHEIM_FORMEN()) return { ok: false, warum: 'das Modul kennt ' + A.GEHEIM_FORMEN() + ' Geheimnis-Formen, dieser Fall hat Proben fuer ' + FORMEN.length + ' — eine neue Form braucht hier ihre Probe' };
      const STELLUNGEN = [['mitten in der Zeile', 'siehe '], ['allein im Feld', ''], ['nach einem Zeilenumbruch', 'Ausgabe:\n'], ['nach einem Tabulator', 'Ausgabe:\t'], ['nach CR LF', 'Ausgabe:\r\n']];
      for (const [probe, re] of FORMEN) for (const [wo, davor] of STELLUNGEN) for (const feld of ['beleg', 'text']) {
        const x = A.eintragPruefen(mk('befund', feld === 'beleg' ? { beleg: [davor + probe] } : { text: davor + probe + ' und weiter' }));
        if (!x.some(y => re.test(y))) return { ok: false, warum: 'ein Geheimnis (' + re.source + ') ' + wo + ' im Feld ' + feld + ' geht durch — das Repo ist oeffentlich' };
      }
      for (const wurzel of ['/tmp', '/root', '/home', '/Users', '/var/folders']) for (const davor of ['siehe ', 'Ausgabe:\n', '']) {
        if (!A.eintragPruefen(mk('befund', { beleg: [davor + wurzel + '/lauf/log.txt'] })).some(y => /nur auf einer Maschine stimmt/.test(y))) return { ok: false, warum: 'ein Pfad unter ' + wurzel + ' (' + JSON.stringify(davor) + ' davor) geht als Beleg durch' };
      }
      if (!A.eintragPruefen(bf, 'falsch.json').some(x => /Dateiname muss mit/.test(x)) || A.eintragPruefen(bf, bf.id + '-befund-x.json').length) return { ok: false, warum: 'die Pruefung des Dateinamens greift nicht in beide Richtungen' };
      return { ok: true, info: schlecht.length + ' kaputte je mit dem richtigen Grund abgelehnt · ' + gut.length + ' gute still · ' + FORMEN.length + ' Geheimnis-Formen × 5 Stellungen × 2 Felder und 5 Pfad-Wurzeln erkannt (auch am Zeilenanfang) · ein Sicherheitsbefund traegt nur Titel und details_bei · ein Feld mit Unterstrich ist kein Versteck' };
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
        // Von Hand geschrieben und falsch geformt — jede dieser Dateien liess die erste Fassung mit einem Stacktrace enden.
        const falsch = [{ anker: [null] }, { zaehle: [{ datei: 'a.js', n: 3 }] }, { gesucht: 4 }, { bezug: [{ art: 'baut_auf', id: a.id }, null] }, { stichworte: 'kachel' }, { waechter: [{ datei: 'x.js' }] }, { zaehle: [{ datei: 'a.js', text: 'abc', n: 'drei' }] }, { text: ['ein', 'Feld'] }];
        falsch.forEach((x, i) => ablegen(d, JSON.stringify(Object.assign(mk('antwort', { id: '2026-01-01-f' + String(i).padStart(3, '0'), bezug: [bz('baut_auf', a)] }), x)), '2026-01-01-f' + String(i).padStart(3, '0') + '-antwort-falsch.json'));
        fs.mkdirSync(path.join(d, A.ORDNER, '2026-01', 'ein-ordner.json'));
        const b = A.brettLesen(d, { alleRefs: false }), r = A.brettPruefen(b);
        if (b.eintraege.length !== 1 || b.doppelt.length !== 1 || b.unlesbar.length !== 3 + falsch.length || b.unlesbar.filter(u => /falsch geformt/.test(u.grund)).length !== falsch.length) return { ok: false, warum: 'gebautes Verzeichnis: ' + b.eintraege.length + ' Eintraege (erwartet 1), ' + b.doppelt.length + ' doppelt (1), ' + b.unlesbar.length + ' unlesbar (erwartet ' + (3 + falsch.length) + ': kaputtes JSON, ohne id, ein Ordner namens .json, ' + falsch.length + ' falsch geformte) — ' + b.unlesbar.map(u => u.grund).join(' | ') };
        if (!r.some(x => /dieselbe id/.test(x.grund)) || !r.some(x => /kein gueltiges JSON/.test(x.grund)) || !r.some(x => /ohne id der Form/.test(x.grund))) return { ok: false, warum: 'doppelte id, kaputtes JSON oder fehlende id NICHT gemeldet: ' + r.map(x => x.grund).join(' | ') };
        const ablB = A.ableiten(b.eintraege); A.anstoesse(b.eintraege, liesOderNull(d)); b.eintraege.forEach(e => { A.marken(e, ablB, ''); A.klasseWirksam(e, ablB.rueck); A.nachbarn(e, b.eintraege); });
      } finally { weg(d); }
      return { ok: true, info: faelle.length + ' Regelbrueche je mit Grund gemeldet · zwei Umgehungen des strengen Schliessens wirkungslos · doppelte id, kaputtes JSON, Datei ohne id, ein Ordner namens .json und acht falsch geformte Dateien: gemeldet, kein Absturz' };
    },
  },
  {
    name: 'C3 · Zustand wird gerechnet · Frage mit Antwort ist beantwortet, Befund mit Abschluss geschlossen, ein ersetzter ersetzt; von zwei Nachtraegen am selben Tag gilt der SPAETERE (Uhrzeit, nicht die zufaellige id) — und „erledigt" gilt nur in dem Baum, in dem es liegt',
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
      // Was von einem FREMDEN Branch kommt und einen Baum beschreibt, gilt hier nicht.
      const fremd = (e) => { Object.defineProperty(e, '_quelle', { value: 'origin/claude/anderswo', enumerable: false }); return e; };
      const hier = mk('befund', { anker: [{ datei: 'a.js', text: 'der Anker in diesem Baum' }] }), irr = mk('idee');
      const dort = [fremd(mk('abschluss', { ergebnis: 'erledigt', wohin: 'v9', geschwister: 'gesucht: 0', bezug: [bz('schliesst', hier)] })), fremd(mk('antwort', { zeit: '23:00:00', bezug: [bz('baut_auf', hier)], anker: [{ datei: 'a.js', text: 'der Anker auf dem anderen Branch' }] })), fremd(mk('abschluss', { bezug: [bz('schliesst', irr)] }))];
      const ab2 = A.ableiten([hier, irr].concat(dort)), zh = ab2.zustand.get(hier.id);
      if (zh.z !== 'offen' || !zh.anderswo || ab2.zustand.get(irr.id).z !== 'geschlossen') return { ok: false, warum: 'ein „erledigt" von einem fremden Branch macht den Befund hier „' + zh.z + '" (erwartet offen, mit Hinweis) · ein „verworfen" von dort macht die Idee „' + ab2.zustand.get(irr.id).z + '" (erwartet geschlossen)' };
      if (A.ankerWirksam(hier, ab2.rueck)[0].text !== 'der Anker in diesem Baum' || !A.marken(hier, ab2, '').some(x => /als erledigt geschlossen .* in diesem Baum noch nicht/.test(x))) return { ok: false, warum: 'der Anker-Nachtrag eines fremden Branches gilt in diesem Baum, oder die Marke „anderswo erledigt" fehlt' };
      const selbst = A.ableiten([hier, mk('abschluss', { ergebnis: 'erledigt', wohin: 'v9', geschwister: 'gesucht: 0', bezug: [bz('schliesst', hier)] })]);
      if (selbst.zustand.get(hier.id).z !== 'geschlossen') return { ok: false, warum: 'ein „erledigt" aus DIESEM Baum schliesst nicht mehr' };
      return { ok: true, info: 'sieben Zustaende wie erwartet · der Nachtrag von 15:00 gilt vor dem von 11:00, obwohl seine id kleiner ist · eine Klasse wird durch Antworten ergaenzt · „erledigt" von einem fremden Branch laesst den Befund hier offen (mit Hinweis), aus diesem Baum schliesst es; „verworfen" gilt ueberall' };
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
      // Die zwei Auswege, die A3 der Sitzung nennt — neu verankern, schliessen — in der MESSUNG, nicht nur in der Rechnung:
      const tot = mk('befund', { anker: [{ datei: 'index.html', text: 'function gsWeg(){ return 0; }' }], zaehle: [{ datei: 'index.html', text: 'gsEins()', n: 9 }] });
      const nachtrag = mk('antwort', { zeit: '12:00:00', bezug: [bz('baut_auf', tot)], anker: [{ datei: 'index.html', text: 'function gsZwei(){' }], zaehle: [{ datei: 'index.html', text: 'gsEins()', n: 3 }] });
      const zuZ = mk('befund', { zaehle: [{ datei: 'index.html', text: 'gsEins()', n: 9 }] }), zuA = mk('abschluss', { bezug: [bz('schliesst', zuZ)] });
      if (A.ankerPruefen([tot], l).verloren.length !== 1 || A.zahlenStand([tot], l)[0].heute === A.zahlenStand([tot], l)[0].n) return { ok: false, warum: 'Aufbau: der tote Anker bzw. die falsche Zahl wird ohne Nachtrag nicht gemeldet' };
      const zs = A.zahlenStand([tot, nachtrag, zuZ, zuA], l);
      if (A.ankerPruefen([tot, nachtrag], l).verloren.length !== 0 || zs.length !== 1 || zs[0].n !== 3 || zs[0].heute !== 3) return { ok: false, warum: 'nach dem Nachtrag: ' + A.ankerPruefen([tot, nachtrag], l).verloren.length + ' verlorene Anker (erwartet 0), Zaehlungen: ' + JSON.stringify(zs.map(z => [z.n, z.heute])) + ' (erwartet genau eine, 3/3 — die des geschlossenen Befunds zaehlt nicht mehr)' };
      return { ok: true, info: 'Kommentarzeile und GS_RELEASES-Block zaehlen nicht (js · sql · sh) · vorhandener Anker still · drei verlorene gemeldet · nach einem Nachtrag gilt der neue Anker und die neue Zahl · ein geschlossener Eintrag wird weder am Anker noch an der Zahl gemessen' };
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
          nein([{ art: 'klasse', titel: 'Waechter in fehlender Datei', regel: 'r', instanzen: ['i'], waechter: [{ datei: 'scripts/gibt_es_nicht.js', fall: 'E10 · Zahl' }] }], /scripts\/gibt_es_nicht\.js gibt es nicht/, 'Waechter in einer Datei, die es nicht gibt'),
          nein([{ art: 'befund', titel: 'Token am Zeilenanfang', beleg: ['curl liefert:\n' + 'ghp_' + 'b'.repeat(24)] }], /GitHub-Token/, 'Geheimnis am Zeilenanfang'),
          nein([{ art: 'befund', titel: 'Sicherheit mit Beleg', sicherheit: true, details_bei: 'Fernando', beleg: ['so geht es'] }], /sicherheit: true — nur Titel/, 'Sicherheitsbefund mit Beleg'),
        ].filter(Boolean);
        // Ein Schreibfehler MITTEN im Stapel hinterlaesst keinen halben: der erste Eintrag geht in den Monat 2026-03, der zweite in 2026-05 — und dort liegt eine Datei statt eines Ordners.
        fs.writeFileSync(path.join(d, A.ORDNER, '2026-05'), 'kein Ordner');
        const vorM = A.brettLesen(d, { alleRefs: false }).eintraege.length, halb = A.einspielen(d, [{ art: 'befund', titel: 'Erster im Stapel', beleg: ['x'] }, { art: 'befund', titel: 'Zweiter im Stapel', beleg: ['x'], datum: '2026-05-06' }], o);
        if (halb.ok || !/nichts geschrieben/.test((halb.fehler[0] || {}).grund || '') || A.brettLesen(d, { alleRefs: false }).eintraege.length !== vorM) pruefe.push('Schreibfehler mitten im Stapel: ' + (halb.ok ? 'als geschrieben gemeldet' : (A.brettLesen(d, { alleRefs: false }).eintraege.length - vorM) + ' Datei(en) blieben liegen'));
        fs.unlinkSync(path.join(d, A.ORDNER, '2026-05'));
        const sich = A.einspielen(d, [{ art: 'befund', titel: 'Ein Sicherheitsbefund ohne Einzelheiten', sicherheit: true, details_bei: 'Fernando', stichworte: ['rls'] }], o);
        if (!sich.ok) pruefe.push('ein Sicherheitsbefund NUR mit Titel und details_bei wird abgelehnt: ' + sich.fehler.map(x => x.grund).join(' | '));
        if (pruefe.length) return { ok: false, warum: pruefe.join(' · ') };
        // Die Stelle wird behoben: die Zaehlung bewegt sich, jetzt geht „erledigt" — und der Abschluss traegt die neue Zahl.
        fs.writeFileSync(path.join(d, 'index.html'), QUELLE.replace('return gsEins() + gsEins();', 'return 2;'));
        const zu = A.einspielen(d, [{ art: 'abschluss', titel: 'Behoben', ergebnis: 'erledigt', wohin: 'v1.01', geschwister: 'gesucht: 0 weitere', bezug: [{ art: 'schliesst', id: befund.id }] }], Object.assign({}, o, { zeit: '09:00:00' }));
        const b3 = A.brettLesen(d, { alleRefs: false }), ab = b3.eintraege.find(e => e.art === 'abschluss');
        if (!zu.ok || !ab || !ab.zaehle || ab.zaehle[0].n !== 1 || A.ableiten(b3.eintraege).zustand.get(befund.id).z !== 'geschlossen' || A.brettPruefen(b3).length) return { ok: false, warum: 'nach der Reparatur: ' + (zu.ok ? 'Abschluss ohne neue Zahl oder Befund nicht geschlossen' : zu.fehler.map(x => x.grund).join(' | ')) };
        // Die gezaehlte Datei verschwindet ganz: „erledigt" geht — und der Abschluss traegt KEINE leere Zaehlung (die waere ungueltig).
        fs.writeFileSync(path.join(d, 'alt.txt'), 'alt_eins() alt_eins()\n');
        const altB = A.einspielen(d, [{ art: 'befund', titel: 'Eine alte Hilfsdatei', beleg: ['x'], zaehle: [{ datei: 'alt.txt', text: 'alt_eins()', n: 2 }] }], Object.assign({}, o, { zeit: '10:00:00' }));
        fs.unlinkSync(path.join(d, 'alt.txt'));
        const altZu = A.einspielen(d, [{ art: 'abschluss', titel: 'Datei entfernt', ergebnis: 'erledigt', wohin: 'v1.02', geschwister: 'gesucht: 0 weitere', bezug: [{ art: 'schliesst', id: altB.geschrieben[0].id }] }], Object.assign({}, o, { zeit: '11:00:00' }));
        const b4 = A.brettLesen(d, { alleRefs: false });
        if (!altZu.ok || A.brettPruefen(b4).length || b4.eintraege.some(e => Array.isArray(e.zaehle) && !e.zaehle.length)) return { ok: false, warum: 'die gezaehlte Datei ist geloescht: ' + (altZu.ok ? 'der Abschluss traegt eine leere Zaehlung — ' + ((A.brettPruefen(b4)[0] || {}).grund || '') : altZu.fehler.map(x => x.grund).join(' | ')) };
        return { ok: true, info: 'Stapel von 3 mit @-Bezug geschrieben (eintraege/2026-03/) · vierzehn Maengel je mit Grund abgewiesen, jedes Mal 0 Dateien · ein Schreibfehler mitten im Stapel raeumt den ersten Eintrag wieder weg · ein Sicherheitsbefund nur mit Titel geht · nach der Reparatur schliesst „erledigt" und traegt die neue Zahl (3 → 1) · ist die gezaehlte Datei weg, traegt der Abschluss keine leere Zaehlung' };
      } finally { weg(d); }
    },
  },
  {
    name: 'C7 · Das Werkzeug als Prozess · ein Wert, der mit „--" beginnt, kommt an; `--k=v` geht; gestempelt wird UTC; Fehlbedienung ist Exit 2 und schreibt nichts; `antworte` beantwortet, `--widerspricht` widerspricht, `schliesse` schliesst, `einspielen` ist alles oder nichts; die drei Warnungen im Kopf erscheinen; Lesen schreibt nichts — auch im echten Repo',
    lauf: () => {
      const d = repo('werkzeug'), ex = tmp('stapel');
      try {
        const f = [], dateien = () => { const p = path.join(d, A.ORDNER); return fs.existsSync(p) ? fs.readdirSync(p, { recursive: true }).filter(n => /\.json$/.test(n)).length : 0; };
        const brettD = () => A.brettLesen(d, { alleRefs: false }), zustand = (id) => { const b = brettD(); return (A.ableiten(b.eintraege).zustand.get(id) || {}).z; };
        // In einer Zeitzone 14 Stunden vor UTC gestartet: gestempelt wird trotzdem UTC.
        let r = werkzeug(d, ['neu', 'befund', '--titel', 'Flacher Abruf schneidet die Geschichte ab', '--beleg', '--depth=1 kuerzt origin/main auf einen Commit', '--stichwort=holen,kachel', '--zaehle', 'index.html::gsEins()'], { TZ: 'Pacific/Kiritimati' });
        const e = brettD().eintraege[0];
        if (r.code !== 0 || !e || e.beleg[0].indexOf('--depth=1') !== 0 || e.stichworte.join() !== 'holen,kachel' || e.von !== 'sitzung/claude/arbeit' || e.stand !== 'v1.00' || e.zaehle[0].n !== 3) f.push('neu: Exit ' + r.code + ' · ' + (e ? JSON.stringify({ beleg: e.beleg, stichworte: e.stichworte, von: e.von, stand: e.stand, zaehle: e.zaehle }) : kurz(r.aus, 200)));
        if (e && A.brettPruefen(brettD()).length) f.push('was `neu` schrieb, lehnt die Pruefung ab: ' + A.brettPruefen(brettD())[0].grund);
        const gestempelt = e ? Date.parse(e.datum + 'T' + e.zeit + 'Z') : NaN;
        if (!(Math.abs(Date.now() - gestempelt) < 3 * 60 * 1000)) f.push('Stempel „' + (e && e.datum + ' ' + e.zeit) + '" liegt nicht bei der UTC-Zeit ' + new Date().toISOString().slice(0, 19) + ' (gestartet mit TZ=Pacific/Kiritimati) — zwei Sitzungen in zwei Zeitzonen ordneten sich falsch');
        const vor = dateien();
        r = werkzeug(d, ['neu', 'befund', '--titel', 'x', '--beleg', 'y', '--gibtsnicht', 'z']); if (r.code !== 2 || !/Unbekannter Schalter/.test(r.aus)) f.push('unbekannter Schalter: Exit ' + r.code);
        r = werkzeug(d, ['neu', 'befund', '--titel', 'Ohne Beleg']); if (r.code !== 1 || !/NICHT geschrieben/.test(r.aus) || !/Befund ohne „beleg"/.test(r.aus)) f.push('ohne Beleg: Exit ' + r.code);
        r = werkzeug(d, ['neu', 'befund', '--titel']); if (r.code !== 2) f.push('Schalter ohne Wert: Exit ' + r.code);
        r = werkzeug(d, ['antworte', e ? e.id.slice(-4) : 'x']); if (r.code !== 2 || !/braucht Inhalt/.test(r.aus)) f.push('Antwort ohne Inhalt: Exit ' + r.code);
        r = werkzeug(d, ['wasanderes']); if (r.code !== 2) f.push('unbekannter Befehl: Exit ' + r.code);
        for (const name of ['constructor', 'toString']) {
          r = werkzeug(d, ['hilfe', name]); if (r.code !== 0 || /TypeError/.test(r.aus)) f.push('`hilfe ' + name + '`: Exit ' + r.code + ' (ein geerbter Name ist keine Art)');
          r = werkzeug(d, ['neu', name, '--titel', 'x']); if (r.code !== 2 || /TypeError/.test(r.aus)) f.push('`neu ' + name + '`: Exit ' + r.code);
          r = werkzeug(d, [name]); if (r.code !== 2 || /TypeError/.test(r.aus)) f.push('Befehl `' + name + '`: Exit ' + r.code);
        }
        r = werkzeug(d, ['neu', 'befund', '--titel', 'Bezug mit geerbtem Namen', '--beleg', 'y', '--bezug', 'toString:' + (e ? e.id : 'x')]); if (r.code !== 1 || !/art „toString" gibt es nicht/.test(r.aus)) f.push('Bezug der Art toString: Exit ' + r.code);
        g(d, ['checkout', '-q', '--detach']);
        r = werkzeug(d, ['neu', 'frage', '--titel', 'Wer schreibt hier?', '--an', 'alle']); if (r.code !== 2 || !/Wer schreibt\?/.test(r.aus)) f.push('losgeloester HEAD ohne --von: Exit ' + r.code + ' (ein Schreiber „sitzung/HEAD" sagt nichts)');
        g(d, ['checkout', '-q', '-b', 'main']);
        r = werkzeug(d, ['neu', 'frage', '--titel', 'Wer schreibt hier?', '--an', 'alle']); if (r.code !== 2 || !/Wer schreibt\?/.test(r.aus)) f.push('auf main ohne --von: Exit ' + r.code);
        g(d, ['checkout', '-q', 'claude/arbeit']);
        if (dateien() !== vor) f.push('ein abgelehnter Aufruf hat geschrieben (' + vor + ' → ' + dateien() + ' Dateien)');
        r = werkzeug(d, ['neu', 'frage', '--titel', 'Wer liest die Kachel?', '--an', 'alle', '--stichwort', 'kachel', '--von', 'sitzung/zwei']);
        if (r.code !== 0 || !/NACHBARN/.test(r.aus) || !/Noch NICHT sichtbar/.test(r.aus)) f.push('zweiter Schreiber: Exit ' + r.code + ', Nachbarn ' + (/NACHBARN/.test(r.aus) ? 'gezeigt' : 'NICHT gezeigt'));
        const frage = brettD().eintraege.find(x => x.art === 'frage');
        const stand = dateien();
        for (const a of [[], ['--nur-lokal'], ['zeige', e ? e.id : 'x'], ['suche', 'kachel'], ['klasse'], ['hilfe'], ['hilfe', 'befund'], ['--json']]) {
          r = werkzeug(d, a);
          if (r.code !== 0 || (a[0] !== '--json' && !/Nichts geschrieben\.\s*$/.test(r.aus))) f.push('`' + (a.join(' ') || 'lesen') + '`: Exit ' + r.code + ', Schlusszeile „Nichts geschrieben." ' + (/Nichts geschrieben\./.test(r.aus) ? 'da' : 'fehlt'));
        }
        if (dateien() !== stand) f.push('ein Lese-Befehl hat geschrieben');
        r = werkzeug(d, []);
        if (!/ZWEI KOEPFE, DIESELBE STELLE/.test(r.aus) || !/ohne Antwort/.test(r.aus) || (r.aus.match(/Flacher Abruf schneidet/g) || []).length !== 2) f.push('lesen zeigt den Anstoss, die Marke oder den Befund nicht wie erwartet (einmal im Anstoss, einmal in der Liste)');
        if (!/Hoechstens EIN Remote-Ref/.test(r.aus)) f.push('ohne einen einzigen Remote-Branch fehlt die Warnung „Hoechstens EIN Remote-Ref sichtbar"');
        r = werkzeug(d, ['holen']); if (r.code !== 0 || !/Holen hat NICHT geklappt/.test(r.aus)) f.push('holen ohne origin sagt nicht, dass das Holen nicht geklappt hat (Exit ' + r.code + ')');
        // Was die Befehle BEWIRKEN — zurueckgelesen, nicht geglaubt.
        r = werkzeug(d, ['antworte', frage ? frage.id.slice(-4) : 'x', '--text', 'Gemessen: zwei Anzeigen lesen sie', '--von', 'sitzung/drei']);
        if (r.code !== 0 || zustand(frage && frage.id) !== 'beantwortet') f.push('`antworte` auf eine Frage: Exit ' + r.code + ', Zustand „' + zustand(frage && frage.id) + '" (erwartet beantwortet)');
        r = werkzeug(d, ['antworte', e ? e.id.slice(-4) : 'x', '--widerspricht', '--text', 'Nachgemessen: es bleibt die ganze Geschichte', '--von', 'sitzung/drei']);
        const wid = brettD().eintraege.find(x => x.art === 'antwort' && /^Widerspruch zu:/.test(x.titel));
        if (r.code !== 0 || !wid || wid.bezug[0].art !== 'widerspricht' || !/WIDERSPRUCH OHNE AUFLOESUNG/.test(werkzeug(d, []).aus)) f.push('`antworte --widerspricht`: Exit ' + r.code + ', Bezug „' + (wid ? wid.bezug[0].art : 'kein Eintrag') + '" (erwartet widerspricht, und der Anstoss in lesen)');
        r = werkzeug(d, ['neu', 'idee', '--titel', 'Die Kachel ganz streichen', '--nutzen', 'eine Anzeige weniger', '--pruefbar', 'render_check', '--stichwort', 'kachel', '--von', 'sitzung/zwei']);
        const idee = brettD().eintraege.find(x => x.art === 'idee');
        r = werkzeug(d, ['schliesse', idee ? idee.id.slice(-4) : 'x', '--ergebnis', 'verworfen', '--text', 'sie ist der einzige Weg zur Liste', '--von', 'sitzung/drei']);
        if (r.code !== 0 || zustand(idee && idee.id) !== 'geschlossen') f.push('`schliesse --ergebnis verworfen`: Exit ' + r.code + ', Zustand „' + zustand(idee && idee.id) + '" (erwartet geschlossen)');
        r = werkzeug(d, ['schliesse', e ? e.id.slice(-4) : 'x', '--ergebnis', 'erledigt', '--wohin', 'v1.01', '--von', 'sitzung/drei']);
        if (r.code !== 1 || !/braucht „geschwister"/.test(r.aus) || !/steht unveraendert/.test(r.aus)) f.push('`schliesse --ergebnis erledigt` ohne Geschwister-Suche und bei unveraenderter Zaehlung: Exit ' + r.code + ' (erwartet 1 mit beiden Gruenden)');
        const gut = path.join(ex, 'gut.json'), schlecht = path.join(ex, 'schlecht.json'), n0 = dateien();
        fs.writeFileSync(gut, JSON.stringify([{ schluessel: 'a', art: 'befund', von: 'runde/x', titel: 'Aus dem Stapel', beleg: ['x'] }, { art: 'idee', von: 'runde/x', titel: 'Dazu eine Idee', nutzen: 'n', pruefbar: 'p', bezug: [{ art: 'baut_auf', id: '@a' }] }]));
        fs.writeFileSync(schlecht, JSON.stringify([{ art: 'befund', von: 'runde/x', titel: 'Gut', beleg: ['x'] }, { art: 'befund', von: 'runde/x', titel: 'Ohne Beleg' }]));
        r = werkzeug(d, ['einspielen', schlecht]); if (r.code !== 1 || !/NICHTS geschrieben/.test(r.aus) || dateien() !== n0) f.push('`einspielen` mit einem Mangel: Exit ' + r.code + ', ' + (dateien() - n0) + ' Dateien geschrieben (erwartet Exit 1 und 0)');
        r = werkzeug(d, ['einspielen', gut]); if (r.code !== 0 || dateien() !== n0 + 2 || A.brettPruefen(brettD()).length) f.push('`einspielen` eines guten Stapels: Exit ' + r.code + ', ' + (dateien() - n0) + ' Dateien (erwartet 2), Pruefung: ' + ((A.brettPruefen(brettD())[0] || {}).grund || 'still'));
        // Kein stiller Deckel: 13 offene Fragen → zwoelf stehen da, eine wird gezaehlt.
        const viele = A.einspielen(d, Array.from({ length: 13 }, (_, i) => ({ art: 'frage', an: 'alle', titel: 'Offene Frage Nummer ' + (i + 1) })), { von: 'sitzung/viele', alleRefs: false });
        const offeneFragen = brettD().eintraege.filter(x => x.art === 'frage' && zustand(x.id) === 'offen').length;
        r = werkzeug(d, ['--art', 'frage']);
        if (!viele.ok || offeneFragen <= 12 || !new RegExp('FRAGEN \\(' + offeneFragen + '\\)').test(r.aus) || !new RegExp('\\+' + (offeneFragen - 12) + ' weitere').test(r.aus)) f.push('Deckel: ' + offeneFragen + ' offene Fragen — erwartet „FRAGEN (' + offeneFragen + ')" und „+' + (offeneFragen - 12) + ' weitere" (kein stilles Abschneiden)');
        // Eine Kurz-id, die zwei Eintraege trifft, waehlt keinen aus.
        ablegen(d, mk('befund', { id: '2026-01-01-aa11' })); ablegen(d, mk('befund', { id: '2026-01-02-aa11', datum: '2026-01-02' }));
        r = werkzeug(d, ['zeige', 'aa11']); if (r.code !== 2 || !/nicht eindeutig/.test(r.aus)) f.push('mehrdeutige Kurz-id: Exit ' + r.code + ' (erwartet 2, „nicht eindeutig")');
        // Ein geerbter roter Stand steht im Kopf — bevor die Sitzung etwas anfasst.
        const kaputt = ablegen(d, '{ kaputt', '2026-01-03-dddd-befund-kaputt.json');
        r = werkzeug(d, []); if (r.code !== 0 || !/schon rot/.test(r.aus)) f.push('ein kaputter Eintrag im Arbeitsbaum: lesen sagt nicht „schon rot" (Exit ' + r.code + ')');
        fs.unlinkSync(kaputt);
        // Die Ware: im echten Repo liest das Werkzeug, ohne etwas anzufassen.
        const echt = () => { const p = path.join(WURZEL, A.ORDNER); return fs.existsSync(p) ? fs.readdirSync(p, { recursive: true }).join('|') : ''; };
        const vorher = echt(), w = cp.spawnSync(process.execPath, [WERKZEUG, '--nur-lokal'], { encoding: 'utf8', env: Object.assign({}, process.env, { AUSTAUSCH_WURZEL: '' }) });
        // (Ob das echte Brett rot ist, sagen A1 und A3 — hier zaehlt nur: es liest, und es fasst nichts an.)
        if (w.status !== 0 || !/Nichts geschrieben\.\s*$/.test(w.stdout) || echt() !== vorher) f.push('im echten Repo: Exit ' + w.status + (echt() !== vorher ? ', der Ordner hat sich geaendert' : ''));
        if (f.length) return { ok: false, warum: f.join(' · ') };
        return { ok: true, info: '„--depth=1 …" als Wert · --stichwort=a,b · Stempel in UTC (gestartet 14 h davor) · 14 Fehlbedienungen ohne Datei und ohne Stacktrace · antworte → beantwortet · --widerspricht → Anstoss · schliesse → geschlossen; „erledigt" ohne Suche und Bewegung: nein · einspielen 2/0 Dateien · ' + offeneFragen + ' Fragen: 12 gezeigt, Rest gezaehlt · mehrdeutige Kurz-id: Exit 2 · drei Kopf-Warnungen · im echten Repo unveraendert' };
      } finally { weg(d); weg(ex); }
    },
  },
  {
    name: 'C8 · Ueber Branches · was NUR auf einem nie gemergten Branch liegt, steht im Brett; falsch geformte Dateien dort stuerzen nichts; origin/HEAD ist kein Branch; ein Bezug ueber die Branch-Grenze nennt seinen Branch (nichts wird herueberkopiert); „erledigt" und ein Nachtrag mit Anker gelten nur in IHREM Baum; `ernten` holt, was hier stimmt, und laesst den Arbeitsbaum gruen; `holen` laesst die gemeinsame Geschichte stehen',
    lauf: () => {
      const bare = tmp('origin'), d = tmp('klon');
      try {
        const f = [], lokalL = liesOderNull(d);
        cp.execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare]);
        g(d, ['init', '-q', '-b', 'main', '.']); g(d, ['remote', 'add', 'origin', bare]);
        fs.writeFileSync(path.join(d, 'index.html'), QUELLE);
        const o = { von: 'sitzung/main', datum: '2026-02-01', zeit: '08:00:00', alleRefs: false };
        const r0 = A.einspielen(d, [{ art: 'befund', titel: 'Auf main bekannt', beleg: ['x'], stichworte: ['kachel'], anker: [{ datei: 'index.html', text: 'function gsZwei(){ return gsEins() + gsEins(); }' }] }], o);
        for (let i = 1; i <= 3; i++) { fs.writeFileSync(path.join(d, 'n' + i), String(i)); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'main ' + i]); }
        g(d, ['push', '-q', 'origin', 'main']);
        const id0 = r0.geschrieben[0].id, p0 = path.join(d, r0.geschrieben[0].datei);
        // Branch 1: zwei Eintraege, nie gemergt.
        g(d, ['checkout', '-q', '-b', 'claude/nie-gemergt']);
        const r1 = A.einspielen(d, [{ schluessel: 'f', art: 'frage', titel: 'Wer liest die Kachel?', an: 'alle', stichworte: ['kachel'] }, { art: 'idee', titel: 'Kachel aus einer Funktion', nutzen: 'n', pruefbar: 'p', bezug: [{ art: 'baut_auf', id: '@f' }] }], Object.assign({}, o, { von: 'sitzung/nie-gemergt' }));
        g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'zwei Eintraege']); g(d, ['push', '-q', 'origin', 'claude/nie-gemergt']);
        // Branch 2: fremde Eingabe — von Hand geschriebene Dateien, jede auf ihre Art falsch, und der Eintrag von main umgeschrieben.
        g(d, ['checkout', '-q', '-b', 'claude/kaputt', 'main']);
        const hand = (id, rest) => ablegen(d, JSON.stringify(Object.assign({ id, art: 'antwort', datum: '2026-02-01', von: 'sitzung/hand', titel: 'von Hand', bezug: [{ art: 'baut_auf', id: id0 }] }, rest)), id + '-antwort-hand.json');
        ablegen(d, JSON.stringify({ art: 'befund', titel: 'ohne id' }), 'ohne-id.json');
        hand('2026-02-01-0a01', { anker: [null] }); hand('2026-02-01-0a02', { zaehle: [{ datei: 'index.html', n: 3 }] }); hand('2026-02-01-0a03', { gesucht: 4 });
        hand('2026-02-01-0a04', { bezug: [{ art: 'baut_auf', id: id0 }, null] }); hand('2026-02-01-0a05', { stichworte: 'kachel' });
        ablegen(d, { id: '2026-02-01-0f0f', art: 'zukunft', datum: '2026-02-01', von: 'sitzung/spaeter', titel: 'Eine Art, die dieses Modul noch nicht kennt' });
        ablegen(d, { id: '2026-02-01-0f1f', art: 'constructor', datum: '2026-02-01', von: 'sitzung/spaeter', titel: 'Eine Art mit einem geerbten Namen' });
        fs.writeFileSync(p0, fs.readFileSync(p0, 'utf8').replace('Auf main bekannt', 'Auf main bekannt — nachtraeglich geaendert'));
        g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'kaputt']); g(d, ['push', '-q', 'origin', 'claude/kaputt']);
        // Branch 3: behebt bei SICH, schliesst den Befund von main als erledigt, verankert ihn neu — und traegt einen Befund an Code, den es nur dort gibt.
        g(d, ['checkout', '-q', '-b', 'claude/feature', 'main']);
        fs.writeFileSync(path.join(d, 'index.html'), QUELLE.replace('function gsZwei(){ return gsEins() + gsEins(); }', 'function gsZwei(){ return 2; }\nfunction gsNeueKachel(){ return 7; }'));
        const r3 = A.einspielen(d, [
          { art: 'befund', titel: 'Die neue Kachel zaehlt fest sieben', beleg: ['x'], anker: [{ datei: 'index.html', text: 'function gsNeueKachel(){ return 7; }' }] },
          { art: 'abschluss', titel: 'Behoben auf dem Feature-Branch', ergebnis: 'erledigt', wohin: 'v1.01 (Branch claude/feature)', geschwister: 'gesucht: 0 weitere', bezug: [{ art: 'schliesst', id: id0 }] },
          { art: 'antwort', titel: 'Neu verankert', text: 'die Stelle heisst hier anders', anker: [{ datei: 'index.html', text: 'function gsZwei(){ return 2; }' }], bezug: [{ art: 'baut_auf', id: id0 }] },
          { schluessel: 'irr', art: 'idee', titel: 'Die Kachel cachen', nutzen: 'n', pruefbar: 'p', stichworte: ['kachel'] },
          { art: 'abschluss', titel: 'Verworfen', ergebnis: 'verworfen', text: 'kostet 40 ms je Start', bezug: [{ art: 'schliesst', id: '@irr' }] },
        ], Object.assign({}, o, { von: 'sitzung/feature', zeit: '09:00:00' }));
        if (!r3.ok) return { ok: false, warum: 'Aufbau: der Feature-Branch konnte seine Eintraege nicht schreiben: ' + r3.fehler.map(x => x.grund).join(' | ') };
        g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'feature']); g(d, ['push', '-q', 'origin', 'claude/feature']);
        g(d, ['checkout', '-q', '-b', 'claude/arbeit', 'main']); g(d, ['fetch', '-q', 'origin']); g(d, ['remote', 'set-head', 'origin', 'main']);
        // ── Lesen
        const lokal = A.brettLesen(d, { alleRefs: false }), alle = A.brettLesen(d, { alleRefs: true }), abl = A.ableiten(alle.eintraege);
        if (lokal.eintraege.length !== 1 || alle.eintraege.length !== 10) f.push('nur Arbeitsbaum: ' + lokal.eintraege.length + ' (erwartet 1) · mit Remote-Refs: ' + alle.eintraege.length + ' (erwartet 10: 1 + 2 nie-gemergt + 2 unbekannte Arten + 5 feature)');
        if (alle.refs !== 4) f.push('gezaehlte Remote-Refs: ' + alle.refs + ' (erwartet 4 — origin/HEAD ist kein Branch)');
        if (alle.unlesbar.length !== 6 || !alle.unlesbar.every(u => /ohne id|falsch geformt/.test(u.grund))) f.push('unlesbar: ' + alle.unlesbar.length + ' (erwartet 6: ohne id und fuenf falsch geformte) — ' + alle.unlesbar.map(u => u.grund).join(' | '));
        if (alle.abweichend.length !== 1 || alle.abweichend[0].gilt !== 'Arbeitsbaum') f.push('umgeschriebener Eintrag: ' + alle.abweichend.length + ' gemeldet (erwartet 1, es gilt der Arbeitsbaum)');
        const fz = A.frischeZweige(d, Date.now(), 14) || [];
        if (fz.some(z => z.ref === 'origin' || /HEAD$/.test(z.ref)) || fz.length !== 3) f.push('frische Branches: ' + fz.map(z => z.ref).join(', ') + ' (erwartet die drei Branches, nicht „origin")');
        // main gilt vor einem Branch: fehlt der Eintrag im Arbeitsbaum, gewinnt origin/main gegen die umgeschriebene Fassung.
        fs.unlinkSync(p0);
        const ohne = A.brettLesen(d, { alleRefs: true }), e0 = ohne.eintraege.find(x => x.id === id0);
        if (!e0 || e0._quelle !== 'origin/main' || e0.titel !== 'Auf main bekannt' || (ohne.abweichend[0] || {}).gilt !== 'origin/main') f.push('fehlt der Eintrag im Arbeitsbaum, gilt nicht origin/main, sondern ' + (e0 ? e0._quelle + ' („' + e0.titel + '")' : 'nichts'));
        g(d, ['checkout', '-q', '--', '.']);
        // ── „Erledigt" und ein Nachtrag mit Anker gelten nur in ihrem Baum.
        const z0 = abl.zustand.get(id0), irr = alle.eintraege.find(x => x.titel === 'Die Kachel cachen');
        if (z0.z !== 'offen' || !z0.anderswo || abl.zustand.get(irr.id).z !== 'geschlossen') f.push('der Befund von main ist nach einem „erledigt" auf einem fremden Branch „' + z0.z + '" (erwartet offen, mit Hinweis) · die dort VERWORFENE Idee ist „' + abl.zustand.get(irr.id).z + '" (erwartet geschlossen: verworfen gilt ueberall)');
        if (A.ankerWirksam(alle.eintraege.find(x => x.id === id0), abl.rueck)[0].text.indexOf('gsEins() + gsEins()') < 0) f.push('der Nachtrag vom fremden Branch verankert den Befund in DIESEM Baum neu');
        const an = A.anstoesse(alle.eintraege, lokalL);
        if (an.some(x => x.art === 'anker_verloren' || x.art === 'zahl_bewegt')) f.push('Code eines fremden Branches wird gegen diesen Baum gemessen: ' + an.filter(x => /anker|zahl/.test(x.art)).map(x => kurz(x.satz, 90)).join(' | '));
        let r = werkzeug(d, []);
        if (r.code !== 0 || /TypeError|at file:|\.mjs:\d+/.test(r.aus)) f.push('lesen ueber Branches: Exit ' + r.code + (/TypeError/.test(r.aus) ? ' mit Stacktrace' : ''));
        for (const [re, was] of [[/unlesbare Datei/, 'die unlesbaren Dateien'], [/sehen auf einem Branch anders aus/, 'den abweichenden Eintrag'], [/\{origin\/claude\/nie-gemergt\}/, 'die Herkunft {origin/…}'], [/FRISCHE BRANCHES/, 'die frischen Branches'], [/als erledigt geschlossen \(v1\.01 \(Branch claude\/feature\)\) — in diesem Baum noch nicht/, 'den Hinweis „anderswo erledigt"'], [/· 4 Remote-Refs/, '„4 Remote-Refs"']]) if (!re.test(r.aus)) f.push('lesen nennt ' + was + ' nicht');
        if (/^    origin   /m.test(r.aus) || /Hoechstens EIN/.test(r.aus)) f.push('lesen fuehrt „origin" als frischen Branch oder warnt bei vier Refs vor einem einzigen');
        for (const a of [['klasse'], ['zeige', '0f0f'], ['zeige', '0f1f'], ['zeige', id0], ['suche', 'kachel'], ['--json']]) { const x = werkzeug(d, a); if (x.code !== 0 || /TypeError/.test(x.aus)) f.push('`' + a.join(' ') + '` mit fremder Eingabe auf einem Branch: Exit ' + x.code); }
        if (!/UNBEKANNTE ART/.test(werkzeug(d, ['zeige', '0f0f']).aus)) f.push('`zeige` nennt die unbekannte Art nicht');
        // ── Antwort ueber die Branch-Grenze: der Bezug nennt den Branch, nichts wird kopiert.
        const frageId = r1.geschrieben[0].id;
        r = werkzeug(d, ['antworte', frageId.slice(-4), '--text', 'Gemessen: zwei Anzeigen lesen sie']);
        const nach = A.brettLesen(d, { alleRefs: false }), antw = nach.eintraege.find(x => x.art === 'antwort');
        if (r.code !== 0 || !/Bezug ueber die Branch-Grenze/.test(r.aus) || nach.eintraege.length !== 2 || A.brettPruefen(nach).length || !antw || antw.bezug[0].ref !== 'origin/claude/nie-gemergt') f.push('Antwort ueber die Branch-Grenze: Exit ' + r.code + ', ' + nach.eintraege.length + ' Eintraege im Arbeitsbaum (erwartet 2: Befund und Antwort — die Frage bleibt auf ihrem Branch), ref „' + (antw && antw.bezug[0].ref) + '", Pruefung: ' + ((A.brettPruefen(nach)[0] || {}).grund || 'still'));
        const mit = A.brettLesen(d, { alleRefs: true });
        if (A.ableiten(mit.eintraege).zustand.get(frageId).z !== 'beantwortet') f.push('die Frage auf dem fremden Branch gilt nach der Antwort nicht als beantwortet');
        // Ein Bezug OHNE die Angabe bleibt ein Bezug ins Leere.
        if (!A.brettPruefen(brettAus([Object.assign({}, antw, { bezug: [{ art: 'beantwortet', id: frageId }] })])).some(x => /den Eintrag gibt es nicht/.test(x.grund))) f.push('ein Bezug ohne `ref` auf einen Eintrag, der nicht im Baum liegt, wird nicht gemeldet');
        // ── Ernten: was hier stimmt, kommt; was einen anderen Baum beschreibt, bleibt — und der Arbeitsbaum ist danach gruen.
        r = werkzeug(d, ['ernten']);
        const ge = A.brettLesen(d, { alleRefs: false }), titel = ge.eintraege.map(x => x.titel);
        const soll = ['Auf main bekannt', 'Wer liest die Kachel?', 'Kachel aus einer Funktion', 'Die Kachel cachen', 'Verworfen'], nicht = ['Die neue Kachel zaehlt fest sieben', 'Behoben auf dem Feature-Branch', 'Neu verankert'];
        if (r.code !== 0 || /TypeError/.test(r.aus) || soll.some(t => titel.indexOf(t) < 0) || nicht.some(t => titel.indexOf(t) >= 0) || ge.eintraege.length !== 6) f.push('ernten: Exit ' + r.code + ', im Arbeitsbaum: ' + titel.join(' | ') + ' — erwartet die fuenf, die hier stimmen, plus die Antwort; NICHT: ' + nicht.join(' | '));
        for (const [re, was] of [[/sein Anker steht in diesem Baum nicht/, 'den Befund an fremdem Code'], [/„erledigt" beschreibt den Baum von origin\/claude\/feature/, 'den Abschluss „erledigt"'], [/Nachtrag mit Anker oder Zaehlung beschreibt den Baum/, 'den Nachtrag mit Anker'], [/falsch geformt/, 'die falsch geformten Dateien'], [/art „zukunft" gibt es nicht/, 'die unbekannte Art']]) if (!re.test(r.aus)) f.push('ernten uebergeht ' + was + ' nicht mit Grund');
        if (A.brettPruefen(ge).length || A.ankerPruefen(ge.eintraege, lokalL).verloren.length || A.ableiten(ge.eintraege).zustand.get(id0).z !== 'offen') f.push('nach dem Ernten ist der Arbeitsbaum nicht gruen oder der Befund nicht mehr offen: ' + ((A.brettPruefen(ge)[0] || {}).grund || '') + ' · verlorene Anker: ' + A.ankerPruefen(ge.eintraege, lokalL).verloren.length);
        const md = fs.readFileSync(p0, 'utf8'); werkzeug(d, ['ernten']);
        if (fs.readFileSync(p0, 'utf8') !== md) f.push('ein zweites Ernten hat eine vorhandene Datei ueberschrieben');
        // ── holen: die gemeinsame Geschichte bleibt (ein flacher Abruf wuerde sie kappen).
        const vorher = g(d, ['rev-list', '--count', 'origin/main']).trim();
        r = werkzeug(d, ['holen']);
        const flach = g(d, ['rev-parse', '--is-shallow-repository']).trim(), nachher = g(d, ['rev-list', '--count', 'origin/main']).trim();
        let basis = ''; try { basis = g(d, ['merge-base', 'HEAD', 'origin/main']).trim(); } catch (_) {}
        if (r.code !== 0 || !/Alle Branches geholt/.test(r.aus) || flach !== 'false' || nachher !== vorher || !basis) f.push('holen: Exit ' + r.code + ', flach=' + flach + ', origin/main ' + vorher + ' → ' + nachher + ' Commits, merge-base ' + (basis ? 'da' : 'FEHLT'));
        if (f.length) return { ok: false, warum: f.join(' · ') };
        return { ok: true, info: 'Arbeitsbaum 1 · mit 4 Remote-Refs 10 (origin/HEAD zaehlt nicht) · 6 Dateien fremder Hand unlesbar gemeldet, 2 unbekannte Arten gezeigt, kein Stacktrace · main gilt vor dem Branch · „erledigt" vom Feature-Branch laesst den Befund hier offen (mit Hinweis), „verworfen" schliesst · sein Anker-Nachtrag gilt hier nicht · Antwort nennt den Branch (2 im Baum) · ernten: 4 geholt, 3 bleiben mit Grund, Baum gruen, nichts ueberschrieben · holen: ' + nachher + ' Commits wie zuvor' };
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
  {
    name: 'C10 · Vergebene Nummern · eine Vergabe ist Version + Release-Titel (Kuerzel + Ueberschrift); Vorfahren und Kopien desselben Titels sind EINE Linie; zwei Linien mit demselben Wert sind ein Zusammenstoss; was main schon fuer etwas anderes traegt, ist UEBERHOLT; ein alter Branch und origin/HEAD zaehlen nicht; die naechste freie Nummer liegt hinter allen — und der Arbeitsbaum erfaehrt, ob eine FREMDE Linie seine Nummer traegt',
    lauf: () => {
      const bare = tmp('origin-nr'), d = tmp('klon-nr');
      try {
        const f = [];
        const sw = (v) => "const VERSION = 'gs-" + v + "';\nconst SHELL_CACHE = `${VERSION}-shell`;\n";
        const ix = (v, t) => "<script>\nwindow.GS_RELEASES = [\n  {\n    v: '" + v + "', date: '01.01.2026',\n      headline: '" + t + "',\n  },\n];\n</script>\n";
        const st = (k, v, t) => '# S\n\n## 0 · Routine\n\n### 2026-01-02 (' + k + ') - ' + v + ': ' + t + '\n\n**Offen:** nichts\n**Nicht geprüft:** x\n\n### 2026-01-01 (z) - v0.99: alt\n\n## 1 · Stand\n';
        const stand = (v, k, t) => { fs.writeFileSync(path.join(d, 'sw.js'), sw(v)); fs.writeFileSync(path.join(d, 'index.html'), ix(v, t)); fs.writeFileSync(path.join(d, 'STATUS.md'), st(k, v, t)); };
        const commit = (msg, alt) => { g(d, ['add', '-A']); cp.execFileSync('git', ['-C', d, '-c', 'user.email=p@example.com', '-c', 'user.name=p', '-c', 'commit.gpgsign=false', 'commit', '-q', '--allow-empty', '-m', msg], { env: Object.assign({}, process.env, alt ? { GIT_COMMITTER_DATE: alt, GIT_AUTHOR_DATE: alt } : {}) }); };
        cp.execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare]);
        g(d, ['init', '-q', '-b', 'main', '.']); g(d, ['remote', 'add', 'origin', bare]);
        stand('v1.00', 'aa', 'Start'); commit('main'); g(d, ['push', '-q', 'origin', 'main']);
        const zweig = (name, v, k, t, alt, von) => { g(d, ['checkout', '-q', '-b', name, von || 'main']); stand(v, k, t); commit(name, alt); g(d, ['push', '-q', 'origin', name]); };
        const vor = (h) => new Date(Date.now() - h * 36e5).toISOString();
        // a und a2 sind EINE Linie (a2 baut auf a, mit geaendertem Titel); f traegt denselben Titel wie a
        // (eine Kopie, kein Vorfahr) — auch dieselbe Vergabe. b ist eine ZWEITE Linie auf v1.01.
        // b ist juenger als a: die Ausgabe muss trotzdem alphabetisch sein (frischeZweige liefert neueste zuerst).
        zweig('claude/a', 'v1.01', 'ab', 'Alpha', vor(3)); zweig('claude/a2', 'v1.01', 'ab', 'Alpha weiter', vor(2), 'claude/a');
        zweig('claude/b', 'v1.01', 'ab', 'Beta', vor(1)); zweig('claude/f', 'v1.01', 'ab', 'Alpha');
        zweig('claude/c', 'v1.00', 'aa', 'Start');            // nicht gebumpt: nichts
        zweig('claude/d', 'v1.03', 'ac', 'Delta', vor(5)); zweig('claude/d2', 'v1.03', 'ac', 'Delta zwei', vor(4), 'claude/d');   // EINE Linie, zwei Branches: kein Zusammenstoss
        zweig('claude/e', 'v1.00', 'aa', 'Echo');             // gebumpt auf eine Nummer, die main fuer „Start" traegt: UEBERHOLT
        zweig('claude/alt', 'v1.09', 'az', 'Alt', new Date(Date.now() - 40 * 864e5).toISOString());   // 40 Tage alt: zaehlt nicht
        g(d, ['checkout', '-q', '-b', 'claude/arbeit', 'main']); g(d, ['fetch', '-q', 'origin']); g(d, ['remote', 'set-head', 'origin', 'main']);
        stand('v1.01', 'ae', 'Arbeit');   // der eigene Arbeitsbaum hat schon gebumpt — auf eine Nummer, die zwei fremde Linien tragen
        const m = A.vergebeneMarken(d, Date.now(), 14);
        const ohneO = (r) => r.replace(/^origin\/claude\//, '');
        const kurzG = (l) => (l || []).map(x => x.wert + ':' + x.linien.map(li => li.refs.map(ohneO).join('+')).join('|')).join(' ');
        const vs = m.versionen ? kurzG(m.versionen) : '(' + m.grund + ')', ks = kurzG(m.kuerzel);
        if (vs !== 'v1.01:a+a2+f|b v1.03:d+d2') f.push('Linien je Version: „' + vs + '" — erwartet „v1.01:a+a2+f|b v1.03:d+d2" (a2 baut auf a, f traegt den Titel von a; c hat nicht gebumpt, e ist ueberholt, alt ist 40 Tage alt)');
        if (ks !== 'ab:a+a2+f|b ac:d+d2') f.push('Linien je Kuerzel: „' + ks + '" — erwartet „ab:a+a2+f|b ac:d+d2"');
        else if (false) f.push('Linien je Kuerzel: „' + ks + '" — a2 ist ein Nachfahr von a und gehoert in dieselbe Linie, auch mit anderer Ueberschrift');
        const ue = (m.ueberholt || []).map(u => ohneO(u.ref) + ':' + u.art + ':' + u.wert).join(' ');
        if (ue !== 'e:kuerzel:aa e:version:v1.00') f.push('ueberholt: „' + ue + '" — erwartet „e:kuerzel:aa e:version:v1.00" (claude/e traegt v1.00/(aa), die main fuer „Start" fuehrt; claude/c ist main selbst)');
        // (ae) traegt nur der eigene Arbeitsbaum — sie zaehlt mit: fuer einen WEITEREN Eintrag ist (af) frei.
        if (m.naechsteVersion !== 'v1.04' || m.naechstesKuerzel !== 'af') f.push('naechste freie: ' + m.naechsteVersion + ' / (' + m.naechstesKuerzel + ') — erwartet v1.04 / (af): hinter ALLEN vergebenen und hinter der eigenen (ae), nicht hinter main');
        if (!m.hier || m.hier.version !== 'v1.01' || m.hier.auchAuf.version.map(ohneO).join() !== 'a,a2,b,f' || m.hier.kuerzel !== 'ae' || m.hier.auchAuf.kuerzel.length) f.push('eigener Arbeitsbaum: ' + JSON.stringify(m.hier) + ' — erwartet v1.01, auch auf a, a2, b, f (zwei fremde Linien); (ae) ohne Zusammenstoss');
        if ((m.nachRef || []).some(r => /HEAD$|^origin$|alt$/.test(r.ref))) f.push('origin/HEAD oder der alte Branch zaehlt als Vergabe');
        let r = werkzeug(d, ['naechste']);
        if (r.code !== 0 || !/naechste freie Version: v1\.04/.test(r.aus) || !/STATUS-Kuerzel: \(af\)/.test(r.aus) || !/heisst schon \(ae\) — fuer einen WEITEREN Eintrag \(af\)/.test(r.aus) || !/!! v1\.01 ist auf 2 Linien zugleich vergeben/.test(r.aus) || !/!! UEBERHOLT[^\n]*\n\s+claude\/e\s+\(aa\) \+ v1\.00/.test(r.aus) || !/!! Dein Arbeitsbaum traegt v1\.01/.test(r.aus) || /!! v1\.03|!! \(ac\)/.test(r.aus) || !/Nichts geschrieben\.\s*$/.test(r.aus)) f.push('`naechste` (v1.03 ist EINE Linie aus zwei Branches und darf nicht als Zusammenstoss erscheinen): Exit ' + r.code + ' — ' + kurz(r.aus, 400));
        r = werkzeug(d, []);
        if (r.code !== 0 || !/^VERGEBEN auf frischen Branches/m.test(r.aus) || !/!! \(ab\) ist auf 2 Linien/.test(r.aus) || !/UEBERHOLT/.test(r.aus)) f.push('`lesen` zeigt die vergebenen Nummern nicht (Exit ' + r.code + ')');
        r = werkzeug(d, ['naechste', '--json']); let j = null; try { j = JSON.parse(r.aus); } catch (_) {}
        if (!j || j.naechsteVersion !== 'v1.04') f.push('`naechste --json` ist kein JSON mit naechsteVersion');
        // Der Arbeitsbaum in der EIGENEN Linie (baut auf claude/a): nur b ist fremd.
        g(d, ['stash', '-q', '-u']); g(d, ['checkout', '-q', '-b', 'claude/weiter', 'origin/claude/a']); stand('v1.01', 'ab', 'Alpha drei');   // eigener Titel: nur die ABSTAMMUNG macht a, a2, f zur eigenen Linie
        let m2 = A.vergebeneMarken(d, Date.now(), 14);
        if (m2.hier.auchAuf.version.map(ohneO).join() !== 'b' || m2.hier.auchAuf.kuerzel.map(ohneO).join() !== 'b') f.push('Arbeitsbaum in der Linie von claude/a: auch auf ' + JSON.stringify(m2.hier.auchAuf) + ' — erwartet nur b (a, a2, f sind die eigene Linie)');
        // Der Arbeitsbaum auf einer Nummer, die main fuer etwas anderes traegt.
        stand('v1.00', 'aa', 'Anders'); m2 = A.vergebeneMarken(d, Date.now(), 14);
        if (m2.hier.ueberholt.version !== 'Start' || !/Start/.test(String(m2.hier.ueberholt.kuerzel))) f.push('Arbeitsbaum auf v1.00/(aa) mit anderem Titel: ueberholt ' + JSON.stringify(m2.hier.ueberholt) + ' — erwartet main-Titel „Start" fuer Version und Kuerzel');
        r = werkzeug(d, ['naechste']);
        if (!/!! Dein Arbeitsbaum traegt eine Version, die main schon fuer „Start"/.test(r.aus)) f.push('`naechste` warnt den ueberholten Arbeitsbaum nicht: ' + kurz(r.aus, 200));
        // Ohne origin/main laesst sich nichts rechnen — das wird gesagt, nicht geraten.
        const ohne = repo('ohne-remote');
        try { r = werkzeug(ohne, ['naechste']); if (r.code !== 2 || !/Nicht rechenbar: origin\/main ist nicht bekannt/.test(r.aus)) f.push('ohne origin/main: Exit ' + r.code + ' — erwartet 2 und „Nicht rechenbar"'); r = werkzeug(ohne, []); if (/^VERGEBEN/m.test(r.aus)) f.push('ohne origin/main zeigt `lesen` einen VERGEBEN-Block'); } finally { weg(ohne); }
        // Ein Sprung weit ueber main (gs-v9.99) und eine Commit-Zeit 2099 verschieben „naechste" nicht.
        // (Eigene Linie von claude/a: ihre Kuerzel-Ueberschrift fuegt keine neue Linie hinzu.)
        zweig('claude/sprung', 'v9.99', 'ab', 'Alpha', vor(1), 'origin/claude/a');
        zweig('claude/zukunft', 'v1.05', 'ab', 'Alpha', '2099-01-01T00:00:00Z', 'origin/claude/a');
        g(d, ['checkout', '-q', 'claude/weiter']); g(d, ['fetch', '-q', 'origin']);   // der eigene Branch zaehlt nie als „frisch" — also zurueck
        const m3 = A.vergebeneMarken(d, Date.now(), 14);
        if ((m3.unplausibel || []).map(u => ohneO(u.ref) + ':' + u.wert).join() !== 'sprung:v9.99') f.push('unplausibel: ' + JSON.stringify(m3.unplausibel) + ' — erwartet claude/sprung mit v9.99');
        if ((m3.zukunft || []).map(z => ohneO(z.ref)).join() !== 'zukunft') f.push('Commit-Zeit in der Zukunft: ' + JSON.stringify(m3.zukunft) + ' — erwartet claude/zukunft, nicht als frisch gezaehlt');
        if (m3.naechsteVersion !== 'v1.04') f.push('mit Sprung und Zukunfts-Branch: naechste freie ' + m3.naechsteVersion + ' — erwartet weiter v1.04');
        r = werkzeug(d, ['naechste']);
        if (!/Nicht gezaehlt — mehr als 20 Versionen ueber main[^\n]*claude\/sprung v9\.99/.test(r.aus)) f.push('`naechste` nennt den unplausiblen Sprung nicht');
        // Die Reihenfolge der Kuerzel: a … z, aa … zz.
        const folge = [['z', 'aa'], ['jd', 'je'], ['az', 'ba'], ['zz', 'aaa']].filter(([a, b]) => A.kuerzelNach(a) !== b);
        if (folge.length) f.push('kuerzelNach: ' + folge.map(([a, b]) => a + ' → ' + A.kuerzelNach(a) + ' (erwartet ' + b + ')').join(', '));
        if (f.length) return { ok: false, warum: f.join(' · ') };
        return { ok: true, info: 'acht Branches + origin/HEAD: v1.01 auf zwei Linien (a+a2+f | b), v1.03; claude/e ueberholt (v1.00/(aa) traegt main fuer „Start"); der 40 Tage alte zaehlt nicht · naechste frei v1.04 / (af) (die eigene (ae) zaehlt mit) · Arbeitsbaum: fremde Linien gemeldet, die eigene nicht, ueberholt erkannt · ohne origin/main „nicht rechenbar" · z → aa, zz → aaa' };
      } catch (e) { return { ok: false, warum: 'Ausnahme: ' + String(e.message).split('\n')[0] }; } finally { weg(bare); weg(d); }
    },
  },
  {
    name: 'C11 · Schwarm-Regeln · Dringlichkeit, Lage, Halt, Veto, Aufheben, Lieferung: gute Eintraege kommen durch, schlechte mit dem RICHTIGEN Grund nicht; eine Frist rechnet ab dem eigenen Zeitstempel (nie ab jetzt); WIRKSAM ist nur, was beim Lesen gueltig ist (Zukunftsdatum, bis ohne Z, abgelaufen, Geltung *); die AELTESTE Uebernahme gilt, je Schreiber die juengste Lage; nichts mit Frist aendert den Zustand',
    lauf: () => {
      const f = [];
      const nein = (e, re, was) => { const g = A.eintragPruefen(e); if (!g.some(x => re.test(x))) f.push(was + ': erwartet /' + re.source + '/, bekam ' + JSON.stringify(g)); };
      const gut = (e, was) => { const g = A.eintragPruefen(e); if (g.length) f.push(was + ' sollte gueltig sein: ' + g.join(' · ')); };
      gut(mk('befund', { dringlichkeit: 'kritisch' }), 'kritischer Befund');
      gut(mk('befund', { dringlichkeit: 'kritisch', sicherheit: true, beleg: undefined, details_bei: 'beim Betreiber' }), 'kritischer Sicherheitsbefund ohne Freitext');
      nein(mk('befund', { dringlichkeit: 'sofort' }), /dringlichkeit: kritisch oder dringend/, 'unbekannte Stufe');
      nein(mk('idee', { dringlichkeit: 'dringend' }), /gehoert an einen Befund, eine Frage oder einen Halt/, 'Dringlichkeit an einer Idee');
      nein(mk('frage', { dringlichkeit: 'dringend' }), /haengt_daran/, 'dringliche Frage ohne haengt_daran');
      gut(mk('frage', { dringlichkeit: 'dringend', haengt_daran: 'der Merge von #324' }), 'dringliche Frage mit haengt_daran');
      gut(mk('lage', { phase: 'letzte_runde', runde: '4/5' }), 'Lage');
      nein(mk('lage', { phase: 'bald' }), /phase:/, 'unbekannte Phase');
      nein(mk('lage', { bis: '2026-01-01T16:00:00' }), /Form JJJJ-MM-TTTHH:MM:SSZ/, 'bis ohne Z');
      nein(mk('lage', { bis: '2026-01-02T10:00:01Z' }), /hoechstens 24 h/, 'Lage laenger als 24 h');
      nein(mk('lage', { bis: '2026-01-01T09:00:00Z' }), /nicht nach dem eigenen Zeitstempel/, 'bis vor dem Zeitstempel');
      nein(mk('lage', { zeit: undefined }), /braucht „zeit"/, 'Lage ohne zeit');
      nein(mk('lage', { runde: 'vier' }), /runde hat die Form/, 'Runde als Wort');
      nein(mk('befund', { phase: 'laeuft' }), /phase gehoert an: Lage/, 'phase an einem Befund');
      gut(mk('halt', { geltung: ['sw.js', 'scripts/', 'gsZwei', 'bump', '_headers', './_redirects'] }), 'Halt mit Datei, Verzeichnis, Funktion, bump, Datei ohne Punkt');
      nein(mk('halt', { geltung: ['STATUS.md'] }), /wirkt wie \*/, 'Halt auf STATUS.md (jede Sitzung schreibt dort)');
      nein(mk('halt', { geltung: ['index.html'] }), /Funktionsnamen nennen/, 'Halt auf die ganze App');
      nein(mk('halt', { geltung: ['./'] }), /ganze Repo/, 'Halt auf „./"');
      nein(mk('lage', { zeit: '99:00:00', bis: '2099-01-01T00:00:00Z' }), /zeit ist keine Uhrzeit/, 'Lage mit Zeit 99:00:00');
      nein(mk('halt', { bis: '2026-01-01T99:00:00Z' }), /bis ist kein Zeitpunkt/, 'Halt mit bis 99:00:00');
      gut(mk('frage', { an: 'sitzung/claude/fix-abc' }), 'Frage an eine Sitzung');
      nein(mk('frage', { an: 'Max' }), /an: alle · fernando · koordinator oder sitzung/, 'Frage an einen Namen');
      { const vier = [mk('befund'), mk('befund'), mk('befund'), mk('befund')];
        nein(mk('lage', { bezug: vier.map(x => bz('baut_auf', x)) }), /hoechstens 3/, 'Lage nimmt vier Eintraege');
        nein(mk('halt', { bezug: [bz('ersetzt', mk('halt'))] }), /kein „ersetzt"/, 'Halt ersetzt einen Halt'); }
      nein(mk('halt', { geltung: ['*'] }), /kein Platzhalter/, 'Halt fuer alles');
      nein(mk('halt', { geltung: ['../aussen'] }), /Weg hinaus/, 'Halt ausserhalb des Repos');
      nein(mk('halt', { geltung: undefined }), /braucht „geltung"/, 'Halt ohne Geltung und ohne Veto');
      nein(mk('halt', { bis: '2026-01-04T10:00:01Z' }), /hoechstens 72 h/, 'Halt laenger als 72 h');
      nein(mk('halt', { text: undefined }), /Halt ohne „text"/, 'Halt ohne Grund');
      const ziel = mk('befund'), lieferung = { pfad: 'docs/x.json', commit: 'a'.repeat(40) };
      gut(mk('antwort', { bezug: [bz('baut_auf', ziel)], geliefert: [lieferung] }), 'Lieferung');
      nein(mk('antwort', { bezug: [bz('baut_auf', ziel)], geliefert: [{ pfad: 'docs/x.json', commit: 'abc123' }] }), /volle Commit-Kennung/, 'Lieferung mit kurzem Commit');
      nein(mk('befund', { geliefert: [lieferung] }), /geliefert gehoert an: Antwort/, 'Lieferung an einem Befund');
      // Bezuege: Veto, Uebernahme, Aufheben.
      const h = mk('halt'), antw = mk('antwort', { bezug: [bz('baut_auf', ziel)], text: 'x' });
      const veto = mk('halt', { geltung: undefined, bezug: [bz('widerspricht', ziel)] }), vetoAntw = mk('halt', { geltung: undefined, bezug: [bz('widerspricht', antw)] });
      const nimm = mk('lage', { bezug: [bz('baut_auf', ziel)] }), nimmHalt = mk('lage', { bezug: [bz('baut_auf', h)] });
      const auf = mk('abschluss', { ergebnis: 'aufgehoben', text: 'main ist wieder gruen', bezug: [bz('schliesst', h)] });
      const aufBefund = mk('abschluss', { ergebnis: 'aufgehoben', text: 'x', bezug: [bz('schliesst', ziel)] }), verwHalt = mk('abschluss', { ergebnis: 'verworfen', text: 'x', bezug: [bz('schliesst', h)] });
      gut(veto, 'Veto ohne eigene Geltung');
      nein(mk('abschluss', { ergebnis: 'aufgehoben', text: undefined, bezug: [bz('schliesst', h)] }), /aufgehoben ohne Grund/, 'aufgehoben ohne Grund');
      const proId = new Map([ziel, h, antw, veto, vetoAntw, nimm, nimmHalt, auf, aufBefund, verwHalt].map(e => [e.id, e]));
      const regel = (e, re, was) => { const g = A.bezugsRegeln(e, proId); if (re ? !g.some(x => re.test(x)) : g.length) f.push(was + ': ' + (re ? 'erwartet /' + re.source + '/, bekam ' : 'sollte gehen, bekam ') + JSON.stringify(g)); };
      regel(veto, null, 'Veto gegen einen Befund'); regel(vetoAntw, /richtet sich gegen eine Handlung/, 'Veto gegen eine Antwort');
      regel(nimm, null, 'Uebernahme eines Befunds'); regel(nimmHalt, /eine Lage nimmt/, 'Uebernahme eines Halts');
      regel(auf, null, 'aufgehoben auf einen Halt'); regel(aufBefund, /„aufgehoben" gibt es nur fuer einen Halt/, 'aufgehoben auf einen Befund'); regel(verwHalt, /einen Halt schliesst nur „aufgehoben"/, 'verworfen auf einen Halt');
      // WIRKSAM — mit ausdruecklicher Uhr.
      const T = Date.parse('2026-01-01T12:00:00Z'), w = A.wirksam;
      if (!w(mk('halt'), T).ok) f.push('ein gueltiger Halt (10:00 bis morgen 10:00) wirkt um 12:00 nicht: ' + w(mk('halt'), T).grund);
      if (w(mk('halt'), Date.parse('2026-01-02T10:00:00Z')).ok) f.push('ein Halt wirkt ueber sein bis hinaus');
      const zukunft = mk('halt', { id: '2099-12-31-0aaa', datum: '2099-12-31', bis: '2100-01-01T10:00:00Z' });
      if (w(zukunft, T).ok || !/Zukunft/.test(String(w(zukunft, T).grund))) f.push('ein Halt mit Datum 2099 wirkt: ' + JSON.stringify(w(zukunft, T)));
      if (w(mk('halt', { bis: '2026-01-02T10:00:00' }), T).ok) f.push('ein Halt mit bis ohne Z wirkt');
      if (w(mk('halt', { geltung: ['*'] }), T).ok) f.push('ein ungueltiger Halt (Geltung *) wirkt');
      // Uhr eine Viertelstunde voraus darf sein, mehr nicht.
      if (!w(mk('halt', { zeit: '12:05:00' }), T).ok) f.push('ein Halt 5 min in der Zukunft (Uhr geht vor) wirkt nicht: ' + w(mk('halt', { zeit: '12:05:00' }), T).grund);
      if (w(mk('halt', { zeit: '12:20:00' }), T).ok) f.push('ein Halt 20 min in der Zukunft wirkt (Vorlauf ' + A.VORLAUF_MS / 6e4 + ' min)');
      // Der Schwarm: aelteste Uebernahme, juengste Lage je Schreiber, fertig, aufgehoben, Veto.
      const z2 = mk('befund');
      const l1 = mk('lage', { von: 'sitzung/a', zeit: '10:00:00', bezug: [bz('baut_auf', z2)] }), l2 = mk('lage', { von: 'sitzung/b', zeit: '11:00:00', bis: '2026-01-01T17:00:00Z', bezug: [bz('baut_auf', z2)] });
      const lc1 = mk('lage', { von: 'sitzung/c', zeit: '09:00:00', bis: '2026-01-01T15:00:00Z' }), lc2 = mk('lage', { von: 'sitzung/c', zeit: '11:30:00', bis: '2026-01-01T17:00:00Z', phase: 'letzte_runde', runde: '5/5' });
      const ld1 = mk('lage', { von: 'sitzung/d', zeit: '09:00:00', bis: '2026-01-01T15:00:00Z' }), ld2 = mk('lage', { von: 'sitzung/d', zeit: '11:00:00', bis: '2026-01-01T15:00:00Z', phase: 'fertig' });
      const h2 = mk('halt'), auf2 = mk('abschluss', { ergebnis: 'aufgehoben', text: 'erledigt', bezug: [bz('schliesst', h2)] }), veto2 = mk('halt', { geltung: undefined, bezug: [bz('widerspricht', z2)] });
      // Die juengere Lage steht ZUERST im Satz: gerechnet wird nach Zeit, nicht nach Reihenfolge.
      const satz = [z2, l2, l1, lc2, lc1, ld2, ld1, h2, auf2, veto2, h];
      const sw = A.schwarm(satz, T), u = sw.uebernahme.get(z2.id);
      if (!u || u.lage.e.id !== l1.id || u.auch.map(x => x.e.id).join() !== l2.id) f.push('Uebernahme: ' + (u ? u.lage.e.von + ' (+' + u.auch.length + ')' : 'keine') + ' — erwartet die AELTESTE (sitzung/a), sitzung/b daneben');
      const lv = sw.lagen.map(x => x.e.von).sort().join();
      if (lv !== 'sitzung/a,sitzung/b,sitzung/c' || !sw.lagen.some(x => x.e.id === lc2.id)) f.push('aktive Lagen: ' + lv + ' — erwartet a, b, c (c mit ihrer JUENGSTEN Lage; d hat „fertig" gemeldet)');
      if (sw.halts.some(x => x.e.id === h2.id)) f.push('ein aufgehobener Halt wirkt weiter');
      if (!sw.halts.some(x => x.e.id === h.id)) f.push('ein gueltiger Halt fehlt in der Rechnung');
      if (!sw.vetos.has(z2.id)) f.push('das Veto gegen ' + z2.id + ' fehlt');
      if (A.ableiten(satz).zustand.get(z2.id).z !== 'offen') f.push('Veto oder Uebernahme aendern den Zustand des Ziels');
      const spaet = A.schwarm(satz, Date.parse('2026-01-03T00:00:00Z'));
      if (spaet.halts.length || spaet.lagen.length || spaet.uebernahme.size) f.push('nach Ablauf aller Fristen wirkt noch etwas: ' + spaet.halts.length + ' Halts, ' + spaet.lagen.length + ' Lagen');
      // Uebernahmen je Schreiber UND Ziel: Fortschritt und eine zweite Uebernahme nehmen der ersten nichts;
      // „fertig" mit Bezug gibt genau dieses Ziel frei, ohne Bezug alle — auch nach seiner eigenen Frist.
      { const za = mk('befund'), zb = mk('befund'), zc = mk('befund');
        const x1 = mk('lage', { von: 'sitzung/x', zeit: '10:00:00', bezug: [bz('baut_auf', za)] }), x2 = mk('lage', { von: 'sitzung/x', zeit: '10:20:00', bezug: [bz('baut_auf', zb)] }), x3 = mk('lage', { von: 'sitzung/x', zeit: '10:40:00', runde: '2/3' });
        const y1 = mk('lage', { von: 'sitzung/y', zeit: '10:05:00', bezug: [bz('baut_auf', za), bz('baut_auf', zb)] }), y2 = mk('lage', { von: 'sitzung/y', zeit: '10:10:00', phase: 'fertig', bezug: [bz('baut_auf', za)] });
        const w1 = mk('lage', { von: 'sitzung/w', zeit: '09:00:00', bis: '2026-01-01T20:00:00Z', bezug: [bz('baut_auf', zc)] }), w2 = mk('lage', { von: 'sitzung/w', zeit: '09:30:00', bis: '2026-01-01T09:45:00Z', phase: 'fertig' });
        const s2 = A.schwarm([x3, y2, w2, za, zb, zc, x1, x2, y1, w1], T);
        const ua = s2.uebernahme.get(za.id), ub = s2.uebernahme.get(zb.id);
        if (!ua || ua.lage.e.id !== x1.id || ua.auch.length) f.push('za: ' + (ua ? ua.lage.e.von + ' ' + ua.lage.e.zeit + ' (+' + ua.auch.map(l => l.e.von).join() + ')' : 'frei') + ' — erwartet sitzung/x 10:00 allein (Fortschritt und zweite Uebernahme nehmen nichts; y hat za mit „fertig" freigegeben)');
        if (!ub || ub.lage.e.id !== y1.id || ub.auch.map(l => l.e.id).join() !== x2.id) f.push('zb: ' + (ub ? ub.lage.e.von + ' ' + ub.lage.e.zeit + ' (+' + ub.auch.map(l => l.e.von).join() + ')' : 'frei') + ' — erwartet sitzung/y 10:05 (aelter), daneben sitzung/x 10:20 (das „fertig" von y galt nur fuer za)');
        if (s2.uebernahme.has(zc.id)) f.push('zc ist noch uebernommen — ein „fertig" ohne Bezug gibt alles frei, auch nach seiner eigenen Frist');
        const lx = s2.lagen.find(l => l.e.von === 'sitzung/x');
        if (!lx || lx.e.id !== x3.id) f.push('Fortschritt von sitzung/x: ' + (lx ? lx.e.zeit : 'keine') + ' — erwartet die juengste Lage (10:40, Runde 2/3)');
        // `von` gegen die Quelle: eine Lage mit fremdem Namen wirkt nicht.
        const v1 = mk('lage', { von: 'sitzung/claude/v', bezug: [bz('baut_auf', zc)] }), v2 = mk('lage', { von: 'sitzung/claude/v', zeit: '10:01:00' }), v3 = mk('lage', { von: 'sitzung/claude/v', zeit: '10:02:00' });
        const wo = new Map([[v1.id, new Set(['origin/claude/fremd'])], [v2.id, new Set(['origin/claude/v'])], [v3.id, new Set(['Arbeitsbaum'])]]);
        const s3 = A.schwarm([v1, v2, v3, zc], T, { wo, ich: 'sitzung/claude/v' }), s4 = A.schwarm([v1, v3, zc], T, { wo, ich: 'sitzung/claude/anders' });
        if (s3.uebernahme.has(zc.id) || !s3.unwirksam.some(u => u.e.id === v1.id && /passt nicht/.test(u.grund))) f.push('eine Lage „von sitzung/claude/v", die auf claude/fremd liegt, wirkt (oder wird nicht als unwirksam genannt)');
        if (!s3.lagen.some(l => l.e.id === v3.id)) f.push('die eigene Lage im Arbeitsbaum (von = ich) wirkt nicht');
        if (s4.lagen.some(l => l.e.id === v3.id)) f.push('eine Lage im Arbeitsbaum mit FREMDEM von wirkt');
        // Aufheben nur durch einen GUELTIGEN Abschluss; ersetzt hebt nie auf.
        const h3 = mk('halt'), aufLeer = mk('abschluss', { ergebnis: 'aufgehoben', text: '', bezug: [bz('schliesst', h3)] });
        const h4 = mk('halt'), ers = mk('halt', { bezug: [bz('ersetzt', h4)] });
        const s5 = A.schwarm([h3, aufLeer, h4, ers], T);
        if (!s5.halts.some(x => x.e.id === h3.id)) f.push('ein UNGUELTIGER Abschluss (aufgehoben ohne Grund) hebt einen Halt auf');
        if (!s5.halts.some(x => x.e.id === h4.id) || A.ableiten([h4, ers]).zustand.get(h4.id).z === 'ersetzt') f.push('„ersetzt" hebt einen Halt auf'); }
      // Geltung gegen eine Aenderung, und die Funktionen eines Diffs.
      const tr = A.haltBeruehrt({ geltung: ['scripts/', 'gsZwei', 'bump', 'sw.js', 'gsEins', '_headers', './docs//x.md'] }, { dateien: ['index.html', 'scripts/x_check.js', '_headers', 'docs/x.md'], funktionen: ['gsZwei'], bump: true });
      if (tr.join() !== 'scripts/x_check.js,gsZwei(),bump,_headers,docs/x.md') f.push('haltBeruehrt: „' + tr.join() + '" — erwartet scripts/x_check.js, gsZwei(), bump, _headers, docs/x.md');
      // Funktionen aus ZEILENNUMMERN — auch eingerueckte, auch eine neue am Ende (der Hunk-Kopf kennt nur Spalte 0).
      const altT = 'function gsEins(){\n  return 1;\n}\n  function gsInnen(){\n    return 2;\n  }\nwindow.gsDrei = function () {\n  x();\n};\n';
      const neuT = altT.replace('return 2;', 'return 3;').replace('x();', 'y();') + 'async function gsNeu(){\n  return 4;\n}\n';
      const fn = [...A.funktionenAusDiff('@@ -5 +5 @@ function gsEins(){\n-    return 2;\n+    return 3;\n@@ -8 +8 @@ function gsEins(){\n-  x();\n+  y();\n@@ -10,0 +11,3 @@ window.gsDrei = function () {\n+async function gsNeu(){\n+  return 4;\n+}\n', altT, neuT)].sort().join();
      if (fn !== 'gsDrei,gsInnen,gsNeu') f.push('funktionenAusDiff: „' + fn + '" — erwartet gsDrei, gsInnen, gsNeu (der Hunk-Kopf nennt beide Male gsEins)');
      // Kritisch erreicht Fernando (die Rechnung von A7, an gebauten Eintraegen).
      const kOffen = mk('befund', { dringlichkeit: 'kritisch' }), kZu = mk('befund', { dringlichkeit: 'kritisch' }), kSchluss = mk('abschluss', { bezug: [bz('schliesst', kZu)] }), kNormal = mk('befund');
      const ko = A.kritischOhneZitat([kOffen, kZu, kSchluss, kNormal], '## 2 · Offen\n- brett:' + kNormal.id + '\n');
      if (ko.ohne.map(e => e.id).join() !== kOffen.id) f.push('Kritisch ohne Zitat: ' + ko.ohne.map(e => e.id).join() + ' — erwartet genau den offenen kritischen ' + kOffen.id + ' (der geschlossene und der normale nicht)');
      if (A.kritischOhneZitat([kOffen], 'brett:' + kOffen.id).ohne.length) f.push('ein zitierter kritischer Eintrag gilt als nicht zitiert');
      if (!A.kritischOhneZitat([kOffen], 'brett:' + kOffen.id + 'ab12').ohne.length) f.push('ein Zitat einer LAENGEREN id (…' + kOffen.id.slice(-4) + 'ab12) gilt als Zitat von ' + kOffen.id);
      const fw = A.fernandoText('# S\n## 0 · Neu\nbrett:' + kZu.id + '\n## 2 · Offen\nbrett:' + kNormal.id + '\n## 3 · Rest\n', 'brett:' + kSchluss.id);
      if ([...A.zitierteIds(fw)].sort().join() !== [kNormal.id, kSchluss.id].sort().join()) f.push('fernandoText liest mehr oder weniger als §2 und FUER-FERNANDO: ' + [...A.zitierteIds(fw)].join());
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: '39 Formfaelle · 7 Bezugsregeln · wirksam (gueltig, abgelaufen, 2099, ohne Z, Geltung *, Vorlauf 5/20 min) · aelteste Uebernahme je Schreiber und Ziel, Fortschritt, fertig mit/ohne Bezug, von gegen Quelle, aufgehoben nur gueltig, ersetzt nie · Zustand ohne Uhr · Geltung (Datei ohne Punkt, ./) und Funktionen aus Zeilennummern · Zitate genau' };
    },
  },
  {
    name: 'C12 · Der Schwarm ueber Branches · als PROZESS: ein Halt auf einem fremden Branch, der eine geaenderte Funktion und den Bump beruehrt, steht unter DICH BETREFFEND; `naechste` endet mit Exit 1; `nehme` auf eine schon uebernommene Aufgabe lehnt ab (die aelteste gilt), mit --auch steht man daneben; die Lage steht in der Zeile ihres Branches; ein Branch, der die Stelle eines Befunds aendert, gilt als „in Arbeit"; ein Halt mit Datum 2099 ist UNWIRKSAM; nicht Gepushtes und ein drohender Force-Push werden genannt; aufgehoben wirkt ueber die Branch-Grenze',
    lauf: () => {
      const eltern = tmp('schwarm'), bare = path.join(eltern, 'origin.git'), d = path.join(eltern, 'klon');
      try {
        const f = [];
        cp.execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare]);
        fs.mkdirSync(d); g(d, ['init', '-q', '-b', 'main', '.']); g(d, ['remote', 'add', 'origin', 'file://' + bare]);
        fs.writeFileSync(path.join(d, 'index.html'), QUELLE); fs.writeFileSync(path.join(d, 'sw.js'), "const VERSION = 'gs-v1.00';\n");
        g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'start']);
        const geschrieben = (r) => { const m = r.aus.match(/\n {2}(\d{4}-\d{2}-\d{2}-[0-9a-f]{4,8}) /); return m ? m[1] : null; };
        let r = werkzeug(d, ['neu', 'befund', '--von', 'sitzung/start', '--titel', 'gsZwei rechnet doppelt', '--beleg', 'grep -c gsEins index.html → 3', '--anker', 'index.html::function gsZwei(){ return gsEins() + gsEins(); }']);
        const befund = geschrieben(r); if (!befund) return { ok: false, warum: 'Befund nicht geschrieben: ' + kurz(r.aus, 200) };
        g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'befund']); g(d, ['push', '-q', 'origin', 'main']);
        // Ein fremder Branch: haelt gsZwei und den Bump an, meldet seine Lage, nimmt den Befund.
        g(d, ['checkout', '-q', '-b', 'claude/halter']);
        r = werkzeug(d, ['halt', '--geltung', 'gsZwei,bump', '--bis', '24h', '--text', 'gsZwei wird umgebaut, bis dahin kein Bump']); const halt = geschrieben(r);
        r = werkzeug(d, ['nehme', befund.slice(-4), '--bis', '6h']); const lageH = geschrieben(r);
        if (!halt || !lageH) return { ok: false, warum: 'Halt/Uebernahme nicht geschrieben: ' + kurz(r.aus, 300) };
        g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'halt']); g(d, ['push', '-q', 'origin', 'claude/halter']);
        // Ein Branch aendert die Stelle des Befunds — ohne etwas zu melden.
        g(d, ['checkout', '-q', '-b', 'claude/fix', 'main']);
        fs.writeFileSync(path.join(d, 'index.html'), QUELLE.replace('function gsZwei(){ return gsEins() + gsEins(); }', 'function gsZwei(){ return 2 * gsEins(); }'));
        g(d, ['commit', '-q', '-am', 'fix']); g(d, ['push', '-q', 'origin', 'claude/fix']);
        // Ein Branch mit einem Halt aus der Zukunft (von Hand geschrieben, an jedem Werkzeug vorbei).
        g(d, ['checkout', '-q', '-b', 'claude/zukunft', 'main']);
        ablegen(d, { id: '2099-12-31-0bbb', art: 'halt', datum: '2099-12-31', zeit: '10:00:00', von: 'sitzung/claude/zukunft', titel: 'Halt aus der Zukunft', text: 'alles anhalten', bis: '2100-01-01T10:00:00Z', geltung: ['gsZwei'] }, '2099-12-31-0bbb-halt-x.json');
        g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'zukunft']); g(d, ['push', '-q', 'origin', 'claude/zukunft']);
        // Die eigene Sitzung: aendert gsZwei und bumpt.
        g(d, ['checkout', '-q', '-b', 'claude/arbeit', 'main']); g(d, ['fetch', '-q', 'origin']);
        fs.writeFileSync(path.join(d, 'index.html'), QUELLE.replace('function gsZwei(){ return gsEins() + gsEins(); }', 'function gsZwei(){ return gsEins() * 2; }'));
        fs.writeFileSync(path.join(d, 'sw.js'), "const VERSION = 'gs-v1.01';\n");
        r = werkzeug(d, []);
        const dich = (r.aus.split('\nDICH BETREFFEND\n')[1] || '').split('\n\n')[0];
        if (!new RegExp('HALT ' + halt + '[^\\n]*beruehrt gsZwei\\(\\), bump').test(dich)) f.push('DICH BETREFFEND nennt den Halt auf gsZwei/bump nicht: ' + kurz(dich || r.aus, 300));
        if (/2099-12-31-0bbb/.test(dich)) f.push('der Halt aus der Zukunft steht unter DICH BETREFFEND');
        if (!/UNWIRKSAM[^\n]*2099-12-31-0bbb[^\n]*Zukunft/.test(r.aus)) f.push('der Halt aus der Zukunft wird nicht als UNWIRKSAM genannt');
        if (!new RegExp(befund + '[^\\n]*in Arbeit auf claude/fix \\(Stelle dort geaendert\\)').test(r.aus)) f.push('der Befund traegt nicht „in Arbeit auf claude/fix (Stelle dort geaendert)"');
        if (!new RegExp(befund + '[^\\n]*uebernommen: sitzung/claude/halter').test(r.aus)) f.push('der Befund traegt nicht „uebernommen: sitzung/claude/halter"');
        if (!/origin\/claude\/halter[^\n]*· Lage: laeuft, bis /.test(r.aus)) f.push('die Lage steht nicht in der Zeile von claude/halter');
        r = werkzeug(d, ['naechste']);
        if (r.code !== 1 || !new RegExp('HALT fuer Bumps: ' + halt).test(r.aus)) f.push('`naechste` unter einem Bump-Halt: Exit ' + r.code + ' — ' + kurz(r.aus, 200));
        // nehme: die aelteste Uebernahme gilt.
        r = werkzeug(d, ['nehme', befund.slice(-4)]);
        if (r.code !== 1 || !/schon uebernommen: sitzung\/claude\/halter/.test(r.aus) || geschrieben(r)) f.push('`nehme` auf eine uebernommene Aufgabe: Exit ' + r.code + ' — ' + kurz(r.aus, 200));
        // Zeitstempel haben Sekunden: faellt die eigene Uebernahme in DIESELBE Sekunde wie die fremde,
        // entscheidet die id (fuer alle Leser gleich, aber nicht „die aeltere"). Gemessen: unter Last in
        // 5 von 12 Laeufen dieselbe Sekunde. Also bis zur naechsten Sekunde warten.
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1050 - (Date.now() % 1000));
        r = werkzeug(d, ['nehme', befund.slice(-4), '--auch']);
        if (r.code !== 0 || !geschrieben(r)) f.push('`nehme --auch` schreibt nicht: ' + kurz(r.aus, 200));
        r = werkzeug(d, []);
        if (!/Deine Uebernahme von [^\n]*gilt nicht: sitzung\/claude\/halter war zuerst/.test(r.aus)) {
          const u = A.schwarm(A.brettLesen(d, { alleRefs: true }).eintraege, Date.now()).uebernahme.get(befund);
          f.push('die nachrangige eigene Uebernahme wird nicht gesagt — gerechnet: ' + (u ? u.lage.e.von + ' ' + u.lage.e.zeit + ' {' + u.lage.e._quelle + '}, daneben ' + u.auch.map(x => x.e.von + ' ' + x.e.zeit + ' {' + x.e._quelle + '}').join(', ') : 'keine Uebernahme'));
        }
        if (!/liegen NUR in diesem Arbeitsbaum — nicht gepusht/.test(r.aus)) f.push('der nicht gepushte Eintrag wird nicht genannt');
        // Aufheben (von hier, mit Grund) wirkt ueber die Branch-Grenze; danach laeuft `naechste` wieder.
        r = werkzeug(d, ['aufheben', halt.slice(-4), '--text', 'Umbau ist auf claude/fix fertig']);
        if (r.code !== 0) f.push('`aufheben`: Exit ' + r.code + ' — ' + kurz(r.aus, 200));
        r = werkzeug(d, ['naechste']);
        if (r.code !== 0) f.push('nach dem Aufheben endet `naechste` noch mit Exit ' + r.code);
        if (/HALT /.test((werkzeug(d, []).aus.split('\nDICH BETREFFEND\n')[1] || '').split('\n\n')[0])) f.push('nach dem Aufheben steht der Halt noch unter DICH BETREFFEND');
        r = werkzeug(d, ['aufheben', befund.slice(-4), '--text', 'x']);
        if (r.code !== 2) f.push('`aufheben` auf einen Befund: Exit ' + r.code + ' (erwartet 2)');
        // Ein drohender Force-Push: origin traegt einen Eintrag, den der Arbeitsbaum nicht hat.
        g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'arbeit']); g(d, ['push', '-q', 'origin', 'claude/arbeit']);
        g(d, ['reset', '-q', '--hard', 'HEAD~1']);
        r = werkzeug(d, []);
        if (!/origin\/claude\/arbeit traegt \d+ Eintrag\/Eintraege, die hier fehlen — ein Force-Push wuerde sie loeschen/.test(r.aus)) f.push('der drohende Force-Push wird nicht gesagt: ' + kurz((r.aus.split('\nDICH BETREFFEND\n')[1] || '(kein Block)').split('\n\n')[0], 200));
        if (f.length) return { ok: false, warum: f.join(' · ') };
        return { ok: true, info: 'vier Branches: Halt auf gsZwei+bump → DICH BETREFFEND und `naechste` Exit 1; nehme: aelteste gilt, --auch daneben; Lage in der Branch-Zeile; claude/fix „in Arbeit" ohne Meldung; Halt 2099 unwirksam; nicht gepusht und Force-Push genannt; aufheben wirkt ueber die Grenze' };
      } catch (e) { return { ok: false, warum: 'Ausnahme: ' + String(e.message).split('\n')[0] }; } finally { weg(eltern); }
    },
  },
  {
    name: 'C14 · Eigen ist, was ICH schreibe · als PROZESS: ein Halt, der per Merge auf main und damit in meinen Arbeitsbaum kam, wirkt (DICH BETREFFEND, `naechste` Exit 1); ein Veto gegen MEINEN Eintrag heisst so, eines gegen einen fremden auf main nicht; eine Lieferung auf meine Frage steht da, und ihr `git show` liefert die Datei; `ernten` laesst Halt und Lage liegen, der fremde Halt wirkt weiter; „im Commit genannt" zaehlt nicht den Branch, der den Eintrag angelegt hat',
    lauf: () => {
      const eltern = tmp('eigen'), bare = path.join(eltern, 'origin.git'), d = path.join(eltern, 'klon');
      try {
        const f = [], id = (r) => { const m = r.aus.match(/\n {2}(\d{4}-\d{2}-\d{2}-[0-9a-f]{4,8}) /); return m ? m[1] : null; };
        const push = (zweig, msg) => { g(d, ['add', '-A']); g(d, ['commit', '-q', '--allow-empty', '-m', msg]); g(d, ['push', '-q', 'origin', zweig]); };
        cp.execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare]);
        fs.mkdirSync(d); g(d, ['init', '-q', '-b', 'main', '.']); g(d, ['remote', 'add', 'origin', 'file://' + bare]);
        fs.writeFileSync(path.join(d, 'index.html'), QUELLE); fs.writeFileSync(path.join(d, 'sw.js'), "const VERSION = 'gs-v1.00';\n");
        let r = werkzeug(d, ['neu', 'befund', '--von', 'sitzung/start', '--titel', 'Ein Befund von main', '--beleg', 'gemessen: 1']); const mBefund = id(r);
        push('main', 'start');
        // Ein Branch aendert gsZwei eine Stunde BEVOR jemand einen Befund daran schreibt.
        g(d, ['checkout', '-q', '-b', 'claude/frueh']);
        fs.writeFileSync(path.join(d, 'index.html'), QUELLE.replace('function gsZwei(){ return gsEins() + gsEins(); }', 'function gsZwei(){ return 0; }'));
        { const vorher = new Date(Date.now() - 36e5).toISOString(); g(d, ['add', '-A']); cp.execFileSync('git', ['-C', d, '-c', 'user.email=p@example.com', '-c', 'user.name=p', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'frueh'], { env: Object.assign({}, process.env, { GIT_COMMITTER_DATE: vorher, GIT_AUTHOR_DATE: vorher }) }); g(d, ['push', '-q', 'origin', 'claude/frueh']); }
        // Meine Sitzung: ein Befund (an gsZwei verankert) und eine Frage („Agent sucht diese Datei").
        g(d, ['checkout', '-q', '-b', 'claude/arbeit', 'main']);
        r = werkzeug(d, ['neu', 'befund', '--titel', 'gsEins gibt immer 1', '--beleg', 'grep -c gsEins → 2', '--anker', 'index.html::function gsZwei(){ return gsEins() + gsEins(); }']); const meinB = id(r);
        r = werkzeug(d, ['neu', 'frage', '--an', 'alle', '--titel', 'Agent sucht docs/fund.json — bitte hochladen, falls gefunden']); const meineF = id(r);
        if (!mBefund || !meinB || !meineF) return { ok: false, warum: 'Aufbau: Eintraege nicht geschrieben — ' + kurz(r.aus, 200) };
        push('claude/arbeit', 'Austausch: befund ' + meinB);
        // Der Koordinator haelt gsZwei und den Bump an; der Halt wird nach main gemergt.
        g(d, ['checkout', '-q', '-b', 'claude/koord', 'main']);
        r = werkzeug(d, ['halt', '--geltung', 'gsZwei,bump', '--bis', '24h', '--text', 'gsZwei wird umgebaut']); const koordHalt = id(r);
        r = werkzeug(d, ['halt', '--geltung', 'gsGibtsNicht', '--bis', '24h', '--text', 'x']);
        if (r.code !== 2 || !/traefe nie/.test(r.aus)) f.push('ein Halt auf einen Namen, den es weder als Funktion noch als Datei gibt, wird angenommen (Exit ' + r.code + ')');
        push('claude/koord', 'halt'); g(d, ['checkout', '-q', 'main']); g(d, ['merge', '-q', '--ff-only', 'claude/koord']); g(d, ['push', '-q', 'origin', 'main']);
        // Ein Veto gegen MEINEN Befund und eines gegen den Befund auf main.
        g(d, ['checkout', '-q', '-b', 'claude/vetoer', 'main']); g(d, ['fetch', '-q', 'origin']);
        r = werkzeug(d, ['veto', meinB.slice(-4), '--text', 'gsEins ist richtig so']); const veto1 = id(r);
        r = werkzeug(d, ['veto', mBefund.slice(-4), '--text', 'auch das nicht']); const veto2 = id(r);
        if (!veto1 || !veto2) return { ok: false, warum: 'Aufbau: Veto nicht geschrieben — ' + kurz(r.aus, 200) };
        push('claude/vetoer', 'veto');
        // Jemand liefert die gesuchte Datei.
        g(d, ['checkout', '-q', '-b', 'claude/liefer', 'main']); g(d, ['fetch', '-q', 'origin']);
        fs.mkdirSync(path.join(d, 'docs'), { recursive: true }); fs.writeFileSync(path.join(d, 'docs/fund.json'), '{"gefunden": true}\n'); push('claude/liefer', 'die Datei');
        r = werkzeug(d, ['antworte', meineF.slice(-4), '--text', 'liegt auf claude/liefer', '--geliefert', 'docs/fund.json']);
        if (r.code !== 0) return { ok: false, warum: 'Aufbau: Lieferung nicht geschrieben — ' + kurz(r.aus, 200) };
        push('claude/liefer', 'Austausch: Lieferung');
        // Jemand nennt meinen Befund im Commit; ein anderer legt einen eigenen Befund an (und nennt ihn) und haelt gsEins an.
        // (Ein leerer Branch zaehlt nie: ohne Unterschied zu main ist er gemergt oder hat nichts getan.)
        g(d, ['checkout', '-q', '-b', 'claude/msg', 'main']); fs.writeFileSync(path.join(d, 'notiz.md'), 'erste Schritte\n'); push('claude/msg', 'Arbeite an ' + meinB);
        g(d, ['checkout', '-q', '-b', 'claude/h2', 'main']);
        r = werkzeug(d, ['neu', 'befund', '--titel', 'Ein Befund von h2', '--beleg', 'gemessen: 2']); const h2B = id(r);
        r = werkzeug(d, ['halt', '--geltung', 'gsEins', '--bis', '24h', '--text', 'gsEins wird umgebaut']); const h2Halt = id(r);
        r = werkzeug(d, ['neu', 'befund', '--titel', 'Die Anmeldung ist live kaputt', '--beleg', 'gemessen: 3 von 3', '--dringlichkeit', 'kritisch']); const h2Krit = id(r);
        push('claude/h2', 'Austausch: befund ' + h2B);
        // Zurueck in meiner Sitzung: main holen (bringt den Halt in MEINEN Arbeitsbaum), gsZwei und gsEins aendern, bumpen.
        g(d, ['checkout', '-q', 'claude/arbeit']); g(d, ['fetch', '-q', 'origin']); g(d, ['merge', '-q', '--no-edit', 'origin/main']);
        fs.writeFileSync(path.join(d, 'index.html'), QUELLE.replace('function gsZwei(){ return gsEins() + gsEins(); }', 'function gsZwei(){ return 2; }').replace('function gsEins(){ return 1; }', 'function gsEins(){ return 1.0; }'));
        fs.writeFileSync(path.join(d, 'sw.js'), "const VERSION = 'gs-v1.01';\n");
        r = werkzeug(d, []);
        const dich = (r.aus.split('\nDICH BETREFFEND\n')[1] || '').split('\n\n')[0];
        if (!new RegExp('HALT ' + koordHalt + ' \\{Arbeitsbaum\\}[^\\n]*beruehrt gsZwei\\(\\), bump').test(dich)) f.push('der Halt, der per Merge in meinen Arbeitsbaum kam, steht nicht unter DICH BETREFFEND: ' + kurz(dich || r.aus.slice(0, 300), 300));
        if (!new RegExp('VETO ' + veto1 + '[^\\n]*gegen deinen Eintrag ' + meinB).test(dich)) f.push('das Veto gegen MEINEN Befund steht nicht unter DICH BETREFFEND');
        if (new RegExp('gegen deinen Eintrag ' + mBefund).test(dich)) f.push('ein Veto gegen den Befund von sitzung/start heisst „gegen deinen Eintrag"');
        const gl = dich.match(/GELIEFERT docs\/fund\.json @ [0-9a-f]{12} +→ git fetch origin && git show ([0-9a-f]{40}):docs\/fund\.json/);
        if (!new RegExp('ANTWORT [^\\n]*auf deine Frage ' + meineF).test(dich) || !gl) f.push('die Lieferung auf meine Frage steht nicht unter DICH BETREFFEND: ' + kurz(dich, 300));
        else { let inhalt = ''; try { inhalt = g(d, ['show', gl[1] + ':docs/fund.json']); } catch (_) {} if (inhalt !== '{"gefunden": true}\n') f.push('`git show` der Lieferung liefert nicht die Datei: ' + kurz(inhalt, 80)); }
        if (!new RegExp(meinB + '[^\\n]*in Arbeit auf claude/msg \\(im Commit genannt\\)').test(r.aus)) f.push('mein Befund traegt nicht „in Arbeit auf claude/msg (im Commit genannt)"');
        if (new RegExp(h2B + '[^\\n]*in Arbeit auf claude/h2').test(r.aus)) f.push('der Befund von claude/h2 gilt als „in Arbeit auf claude/h2" — dort wurde er nur ANGELEGT');
        if (new RegExp(meinB + '[^\\n]*in Arbeit auf[^\\n]*claude/frueh').test(r.aus)) f.push('claude/frueh gilt als „in Arbeit" an meinem Befund — es hat die Stelle eine Stunde VOR dem Befund geaendert');
        // --dringlichkeit filtert: nur der kritische Befund, mit seiner Marke.
        const nurK = werkzeug(d, ['--dringlichkeit', 'kritisch']).aus;
        if (!/BEFUNDE \(1\)/.test(nurK) || !new RegExp(h2Krit + '[^\\n]*\\[KRITISCH').test(nurK)) f.push('`--dringlichkeit kritisch` zeigt nicht genau den kritischen Befund mit Marke: ' + kurz(nurK.slice(nurK.indexOf('BEFUNDE')), 200));
        r = werkzeug(d, ['naechste']);
        if (r.code !== 1 || !new RegExp('HALT fuer Bumps: ' + koordHalt).test(r.aus)) f.push('`naechste` unter dem Halt aus meinem Arbeitsbaum: Exit ' + r.code);
        // Ernten: der Halt von claude/h2 kommt nicht mit — und wirkt weiter.
        r = werkzeug(d, ['ernten']);
        if (!new RegExp(h2Halt + '[^\\n]*Absicht').test(r.aus)) f.push('`ernten` sagt nicht, dass es den Halt von claude/h2 liegen laesst: ' + kurz(r.aus, 300));
        if (fs.readdirSync(path.join(d, A.ORDNER), { recursive: true }).some(n => String(n).indexOf(h2Halt) >= 0)) f.push('`ernten` hat einen fremden Halt in meinen Arbeitsbaum geholt');
        if (!new RegExp(h2Krit + '[^\\n]*kritisch, aber in diesem Baum nicht an Fernando').test(r.aus) || A.kritischOhneZitat(A.brettLesen(d, { alleRefs: false }).eintraege, A.fernandoText(liesOderNull(d)('STATUS.md'), '')).ohne.length) f.push('`ernten` holt einen fremden kritischen Befund, den dieser Baum nicht zitiert (A7 waere danach rot)');
        r = werkzeug(d, []);
        if (!new RegExp('HALT ' + h2Halt + '[^\\n]*beruehrt gsEins\\(\\)').test(r.aus)) f.push('nach dem Ernten wirkt der Halt von claude/h2 nicht mehr');
        if (f.length) return { ok: false, warum: f.join(' · ') };
        return { ok: true, info: 'sechs Branches: Halt per Merge im Arbeitsbaum wirkt (DICH, naechste Exit 1) · Veto gegen meinen Eintrag ja, gegen den von main nein · Lieferung + git show · ernten laesst den Halt liegen, er wirkt weiter · Commit-Nennung ja, Anlegen nein · Halt auf unbekannten Namen abgelehnt' };
      } catch (e) { return { ok: false, warum: 'Ausnahme: ' + String(e.message).split('\n')[0] }; } finally { weg(eltern); }
    },
  },
  {
    name: 'C15 · Was DIESE Sitzung geaendert hat · seit dem Abzweigen UND heute anders als main (was main inzwischen selbst geaendert hat, zaehlt nicht), ohne das Brett, eine Umbenennung mit beiden Namen, Funktionen auch eingerueckt, `bump` nur bei einer eigenen Versionsaenderung',
    lauf: () => {
      const eltern = tmp('eigen-aend'), bare = path.join(eltern, 'origin.git'), d = path.join(eltern, 'klon');
      try {
        const f = [];
        const Q = QUELLE + 'var gsBox = {\n  init: function () {\n    return 1;\n  },\n};\n  function gsInnen(){\n    return 2;\n  }\n';
        cp.execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare]);
        fs.mkdirSync(d); g(d, ['init', '-q', '-b', 'main', '.']); g(d, ['remote', 'add', 'origin', 'file://' + bare]);
        fs.mkdirSync(path.join(d, 'scripts')); fs.writeFileSync(path.join(d, 'scripts/x_check.js'), '// Fall\n');
        fs.writeFileSync(path.join(d, 'index.html'), Q); fs.writeFileSync(path.join(d, 'sw.js'), "const VERSION = 'gs-v1.00';\n");
        g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'start']); g(d, ['push', '-q', 'origin', 'main']);
        g(d, ['checkout', '-q', '-b', 'claude/e']);
        // Ein frueher Schritt der Sitzung, den main spaeter per Squash-Merge uebernimmt (gleicher Inhalt, anderer Commit).
        fs.writeFileSync(path.join(d, 'notiz.md'), 'frueher Schritt\n'); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'notiz']);
        // main geht weiter: der Squash der Notiz, gsEins geaendert, Bump auf v1.01 (ein anderer PR).
        g(d, ['checkout', '-q', 'main']);
        fs.writeFileSync(path.join(d, 'notiz.md'), 'frueher Schritt\n');
        fs.writeFileSync(path.join(d, 'index.html'), Q.replace('function gsEins(){ return 1; }', 'function gsEins(){ return 11; }')); fs.writeFileSync(path.join(d, 'sw.js'), "const VERSION = 'gs-v1.01';\n"); g(d, ['add', '-A']);
        g(d, ['commit', '-q', '-am', 'main weiter']); g(d, ['push', '-q', 'origin', 'main']);
        g(d, ['checkout', '-q', 'claude/e']); g(d, ['fetch', '-q', 'origin']);
        // Die Sitzung: gsZwei und die eingerueckte gsInnen, ein Eintrag des Bretts, eine Umbenennung.
        fs.writeFileSync(path.join(d, 'index.html'), Q.replace('function gsZwei(){ return gsEins() + gsEins(); }', 'function gsZwei(){ return 2; }').replace('    return 2;\n  }', '    return 22;\n  }'));
        ablegen(d, mk('idee', { id: '2026-01-01-eeee' }));
        g(d, ['mv', 'scripts/x_check.js', 'scripts/y_check.js']);
        g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'arbeit']);
        let a = A.eigeneAenderung(d);
        if (a.dateien.join() !== 'index.html,scripts/x_check.js,scripts/y_check.js') f.push('dateien: ' + a.dateien.join() + ' — erwartet index.html und BEIDE Namen der Umbenennung (sw.js hat main geaendert, notiz.md steht so schon auf main, das Brett zaehlt nie)');
        if (a.funktionen.join() !== 'gsInnen,gsZwei') f.push('funktionen: ' + a.funktionen.join() + ' — erwartet gsInnen (eingerueckt), gsZwei; nicht gsEins (das hat main geaendert)');
        if (a.bump) f.push('bump: true — die Sitzung hat sw.js nie angefasst, nur main hat gebumpt');
        // Dieselbe Aenderung wie main (z.B. nach einem Merge) ist keine eigene.
        fs.writeFileSync(path.join(d, 'index.html'), fs.readFileSync(path.join(d, 'index.html'), 'utf8').replace('function gsEins(){ return 1; }', 'function gsEins(){ return 11; }'));
        a = A.eigeneAenderung(d);
        if (a.funktionen.indexOf('gsEins') >= 0) f.push('gsEins zaehlt als eigene Aenderung, obwohl sie heute genau so auf main steht');
        // Ein eigener Bump.
        fs.writeFileSync(path.join(d, 'sw.js'), "const VERSION = 'gs-v1.02';\n");
        a = A.eigeneAenderung(d);
        if (!a.bump) f.push('der eigene Bump auf v1.02 zaehlt nicht');
        // Mit fester Basis (im PR): dieselbe Rechnung gegen HEAD^1.
        const p = A.eigeneAenderung(d, { basis: g(d, ['rev-parse', 'origin/main']).trim() });
        if (!p.bump || p.funktionen.indexOf('gsZwei') < 0) f.push('mit fester Basis: ' + JSON.stringify(p));
        if (f.length) return { ok: false, warum: f.join(' · ') };
        return { ok: true, info: 'main gebumpt, gsEins geaendert und einen Schritt der Sitzung squash-gemergt, die Sitzung gsZwei + eingerueckt gsInnen + Umbenennung + Brett: dateien, funktionen, bump stimmen; gleiche Aenderung wie main zaehlt nicht; eigener Bump zaehlt; feste Basis' };
      } catch (e) { return { ok: false, warum: 'Ausnahme: ' + String(e.message).split('\n')[0] }; } finally { weg(eltern); }
    },
  },
  {
    name: 'C13 · Waechter und Sicherung · Waechter 1 rechnet gegen die Abzweigstelle (lokal merge-base, im PR die Basis-Seite des Merge-Commits) und sieht ein geloeschtes oder umgeschriebenes Eintragsfile (ausser per Grabstein); der ECHTE Schritt aus .github/workflows/brett-waechter.yml, gefahren wie auf GitHub (frischer flacher Klon, saubere Shell, Cache als Gedaechtnis): sichert byte-gleich, ohne Geheimnis, aendert auf origin NUR zz-sicherung, wiederholt sich ohne Commit, behaelt die erste Fassung, wird ROT bei einem geloeschten Branch und bei einer zurueckgesetzten Sicherung, und ein Grabstein verschwindet aus dem Branch samt Geschichte',
    lauf: () => {
      const eltern = tmp('waechter'), bare = path.join(eltern, 'origin.git'), d = path.join(eltern, 'klon'), cache = path.join(eltern, 'cache');
      try {
        const f = [];
        const yml = lies('.github/workflows/brett-waechter.yml');
        // Die Action, gelesen.
        if (!/^permissions: \{\}$/m.test(yml)) f.push('brett-waechter.yml: permissions: {} auf Workflow-Ebene fehlt');
        if (!/permissions:\n\s+contents: write\n/.test(yml) || /pull-requests|issues|actions: write/.test(yml)) f.push('brett-waechter.yml: der Job braucht genau contents: write');
        if (!/cron: '\d+ \* \* \* \*'/.test(yml)) f.push('brett-waechter.yml: kein stuendlicher Zeitplan');
        if (!/uses: actions\/checkout@[0-9a-f]{40}[^\n]*\n(?: {8,}[^\n]*\n)*? {10}persist-credentials: false\n/.test(yml)) f.push('brett-waechter.yml: checkout ohne persist-credentials: false — der Token laege in .git/config, waehrend das Werkzeug fremde Branches liest');
        if ([...yml.matchAll(/uses: ([^\s]+)/g)].some(m => !/@[0-9a-f]{40}$/.test(m[1]))) f.push('brett-waechter.yml: eine Action ist nicht auf einen Commit festgelegt');
        if (!/name: Gedaechtnis ablegen\n\s+if: always\(\)\n\s+uses: actions\/cache\/save@/.test(yml) || !/uses: actions\/cache\/restore@/.test(yml)) f.push('brett-waechter.yml: das Gedaechtnis wird nicht geholt oder nicht IMMER abgelegt (auch nach einem Alarm)');
        if (/git config[^\n]*(extraheader|credential)/.test(yml)) f.push('brett-waechter.yml: Zugangsdaten per git config — nur `-c` am einzelnen Aufruf');
        const schritt = ((yml.match(/name: Sicherung schreiben und melden\n(?: +env:\n(?: {10}[^\n]*\n)+)? +run: \|\n((?: {10}[^\n]*\n|\n)+)/) || [])[1] || '').replace(/^ {10}/gm, '');
        const pushes = [...schritt.matchAll(/\bpush\b[^\n]*/g)].map(m => m[0]);
        if (!pushes.length || pushes.some(x => !/--force-with-lease="refs\/heads\/zz-sicherung:\$ALT" origin "\$NEU:refs\/heads\/zz-sicherung"$/.test(x))) f.push('brett-waechter.yml: jeder push geht mit --force-with-lease nach refs/heads/zz-sicherung — gefunden: ' + pushes.join(' | '));
        if (!/commit-tree/.test(schritt)) f.push('brett-waechter.yml: kein Orphan-Commit (commit-tree) — die Sicherung behielte ihre Geschichte, und ein Grabstein bliebe darin lesbar');
        if (!/sichern --nach \.\.\/sicherung --gedaechtnis/.test(schritt)) return { ok: false, warum: f.concat('der Schritt „Sicherung schreiben und melden" ist nicht lesbar').join(' · ') };
        // Ein gebautes origin mit dem ECHTEN Werkzeug auf main.
        cp.execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare]);
        fs.mkdirSync(d); g(d, ['init', '-q', '-b', 'main', '.']); g(d, ['remote', 'add', 'origin', 'file://' + bare]);
        fs.mkdirSync(path.join(d, 'scripts'));
        for (const n of ['austausch.mjs', '_austausch.mjs']) fs.copyFileSync(path.join(__dirname, n), path.join(d, 'scripts', n));
        fs.writeFileSync(path.join(d, 'index.html'), QUELLE);
        const m1 = mk('befund', { id: '2026-01-01-1111', titel: 'Auf main von Anfang an' }), m2 = mk('idee', { id: '2026-01-02-2222', datum: '2026-01-02', titel: 'Spaeter auf main' });
        const s1 = mk('frage', { id: '2026-01-03-3333', datum: '2026-01-03', titel: 'Nur auf claude/s1' }), geheim = mk('frage', { id: '2026-01-03-4444', datum: '2026-01-03', titel: 'Traegt ein Geheimnis', text: 'token ' + 'gh' + 'p_' + 'A'.repeat(24) });
        ablegen(d, m1); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'm1']); g(d, ['push', '-q', 'origin', 'main']);
        g(d, ['checkout', '-q', '-b', 'claude/alt']); g(d, ['push', '-q', 'origin', 'claude/alt']);   // zweigt VOR m2 ab
        g(d, ['checkout', '-q', 'main']); ablegen(d, m2); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'm2']); g(d, ['push', '-q', 'origin', 'main']);
        g(d, ['checkout', '-q', '-b', 'claude/s1']); ablegen(d, s1); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 's1']); g(d, ['push', '-q', 'origin', 'claude/s1']);
        g(d, ['checkout', '-q', '-b', 'claude/geheim', 'main']); ablegen(d, geheim); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'g']); g(d, ['push', '-q', 'origin', 'claude/geheim']);
        g(d, ['checkout', '-q', 'claude/alt']); g(d, ['fetch', '-q', 'origin']);
        // Waechter 1: die Basis.
        // Ein Branch HINTER main ohne eigenen Commit und ohne Aenderung: nichts kann verschwunden sein — keine Aussage.
        let wb = A.waechterBasis(d, {});
        if (!/keine Abzweigstelle/.test(String(wb.grund))) f.push('waechterBasis auf einem sauberen Branch ohne eigenen Commit: keine Aussage erwartet, bekam ' + JSON.stringify(wb));
        g(d, ['checkout', '-q', '-b', 'pr-merge', 'origin/main']); g(d, ['merge', '-q', '--no-ff', '--no-edit', 'origin/claude/s1']);
        wb = A.waechterBasis(d, { GITHUB_EVENT_NAME: 'pull_request' });
        if (wb.basis !== g(d, ['rev-parse', 'HEAD^1']).trim()) f.push('waechterBasis im PR: ' + JSON.stringify(wb) + ' — erwartet HEAD^1 (die Basis-Seite des Merge-Commits)');
        g(d, ['checkout', '-q', '-B', 'main', 'origin/main']);
        if (!/keine Abzweigstelle/.test(String(A.waechterBasis(d, {}).grund))) f.push('waechterBasis auf main ohne Aenderung: keine Aussage erwartet, bekam ' + JSON.stringify(A.waechterBasis(d, {})));
        g(d, ['checkout', '-q', 'claude/alt']);
        const basis = g(d, ['merge-base', 'HEAD', 'origin/main']).trim();
        let w = A.geloeschtSeit(d, basis);
        if (w.n !== 1 || w.fehlt.length || w.anders.length) f.push('Waechter 1 auf einem Branch hinter main: ' + JSON.stringify(w) + ' — erwartet 1 Datei, nichts fehlt (m2 kam nach dem Abzweigen)');
        const p1 = path.join(d, A.ORDNER, '2026-01', '2026-01-01-1111-befund-x.json'), roh1 = fs.readFileSync(p1, 'utf8');
        fs.writeFileSync(p1, roh1.replace('Auf main von Anfang an', 'Umgeschrieben'));
        wb = A.waechterBasis(d, {});
        if (wb.basis !== basis) f.push('waechterBasis mit Aenderung im Brett: ' + JSON.stringify(wb) + ' — erwartet merge-base(HEAD, origin/main)');
        w = A.geloeschtSeit(d, basis); if (w.anders.length !== 1) f.push('Waechter 1 sieht das umgeschriebene Eintragsfile nicht');
        fs.unlinkSync(p1);
        w = A.geloeschtSeit(d, basis); if (w.fehlt.length !== 1) f.push('Waechter 1 sieht das geloeschte Eintragsfile nicht');
        fs.writeFileSync(path.join(d, A.GRABSTEINE), JSON.stringify([{ id: m1.id, datum: '2026-01-04', grund: 'enthielt einen Personennamen' }], null, 2) + '\n');
        w = A.geloeschtSeit(d, basis); if (w.fehlt.length) f.push('Waechter 1 meldet eine Loeschung, die auf der Grabstein-Liste steht');
        fs.writeFileSync(p1, roh1);
        if (!A.brettLesen(d, { alleRefs: false }).grabDateien.length || !A.brettPruefen(A.brettLesen(d, { alleRefs: false })).some(x => /Grabstein-Liste[^]*liegt noch hier/.test(x.grund))) f.push('eine Datei mit Grabstein, die noch im Baum liegt, ist kein Fehler');
        fs.unlinkSync(path.join(d, A.GRABSTEINE));
        if (A.grabsteinePruefen(JSON.stringify([{ id: m1.id, datum: '2026-01-04', grund: 'x', inhalt: 'Max' }])).fehler.length !== 1) f.push('ein Grabstein mit Inhalt wird angenommen');
        // Der Schritt der Action, gefahren wie auf GitHub: frischer flacher Klon von main, saubere Shell,
        // RUNNER_TEMP als Cache (bleibt zwischen den Laeufen, wie actions/cache).
        fs.mkdirSync(cache); const leer = path.join(eltern, 'gitconfig'); fs.writeFileSync(leer, '');
        let lauf = 0;
        const remote = () => g(d, ['ls-remote', 'origin']).split('\n').filter(z => z && !/refs\/heads\/zz-sicherung$/.test(z)).sort().join('\n');
        const action = () => {
          const ws = path.join(eltern, 'lauf' + (++lauf), 'ws'); fs.mkdirSync(ws, { recursive: true });
          const env = Object.assign({}, process.env, { GIT_CONFIG_GLOBAL: leer, GIT_CONFIG_NOSYSTEM: '1', GH_TOKEN: 'unbenutzt', RUNNER_TEMP: cache, GITHUB_STEP_SUMMARY: path.join(eltern, 'zusammenfassung.md'), AUSTAUSCH_WURZEL: '', AUSTAUSCH_VON: '' });
          for (const a of [['init', '-q', '-b', 'main', '.'], ['remote', 'add', 'origin', 'file://' + bare], ['fetch', '-q', '--depth=1', 'origin', '+refs/heads/main:refs/remotes/origin/main'], ['checkout', '-q', '-B', 'main', 'refs/remotes/origin/main']]) cp.execFileSync('git', a, { cwd: ws, env, stdio: 'ignore' });
          const vor = remote();
          const x = cp.spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', schritt], { cwd: ws, encoding: 'utf8', env });
          g(d, ['fetch', '-q', '--prune', 'origin', '+refs/heads/*:refs/remotes/origin/*']);
          if (remote() !== vor) f.push('Lauf ' + lauf + ': auf origin hat sich mehr als zz-sicherung geaendert');
          return { code: x.status, aus: (x.stdout || '') + (x.stderr || '') };
        };
        const zz = (args) => { try { return g(d, args); } catch (_) { return ''; } };
        const gesichert = () => zz(['ls-tree', '-r', '--name-only', 'origin/zz-sicherung']).split('\n').filter(n => /\.json$/.test(n)).map(n => path.posix.basename(n).slice(0, 15)).sort().join();
        let a = action();
        if (a.code !== 0 || gesichert() !== '2026-01-01-1111,2026-01-02-2222,2026-01-03-3333') f.push('erster Lauf: Exit ' + a.code + ', gesichert „' + gesichert() + '" — erwartet m1, m2, s1 (das Geheimnis nicht) · ' + kurz(a.aus, 300));
        if (!/Gedaechtnis neu angelegt/.test(a.aus)) f.push('erster Lauf sagt nicht, dass das Gedaechtnis neu ist');
        if (zz(['show', 'origin/zz-sicherung:' + A.ORDNER + '/2026-01/2026-01-03-3333-frage-x.json']) !== JSON.stringify(s1, null, 2) + '\n') f.push('die Sicherung ist nicht byte-gleich mit dem Eintrag auf claude/s1');
        if (!/Nicht gesichert[^\n]*2026-01-03-4444/.test(a.aus)) f.push('der Eintrag mit Geheimnis wird nicht als „nicht gesichert" genannt');
        const kopf1 = zz(['rev-parse', 'origin/zz-sicherung']).trim();
        a = action();
        if (a.code !== 0 || zz(['rev-parse', 'origin/zz-sicherung']).trim() !== kopf1 || !/Nichts Neues zu sichern/.test(a.aus)) f.push('zweiter Lauf ohne Aenderung: Exit ' + a.code + ' — neuer Commit oder Meldung fehlt · ' + kurz(a.aus, 200));
        // Gelesen wird die Sicherung ZULETZT: was auch auf main liegt, kommt von main.
        const bm = A.brettLesen(d, { alleRefs: true }).eintraege.find(e => e.id === m2.id);
        if (!bm || A.istSicherungsRef(bm._quelle)) f.push('m2 liegt auf main UND in der Sicherung — gelesen wurde ' + (bm ? bm._quelle : 'nichts'));
        // Ein Branch schreibt s1 um: die Sicherung behaelt die erste Fassung und nennt den Eintrag strittig.
        const d2 = path.join(eltern, 'anderer'); cp.execFileSync('git', ['clone', '-q', 'file://' + bare, d2]);
        g(d2, ['checkout', '-q', 'claude/s1']);
        const ps1 = path.join(d2, A.ORDNER, '2026-01', '2026-01-03-3333-frage-x.json'), roh = fs.readFileSync(ps1, 'utf8');
        fs.writeFileSync(ps1, roh.replace('Nur auf claude/s1', 'Umgeschrieben auf claude/s1')); g(d2, ['commit', '-q', '-am', 'umgeschrieben']); g(d2, ['push', '-q', 'origin', 'claude/s1']);
        a = action();
        if (a.code !== 0 || !/Strittig[^\n]*2026-01-03-3333/.test(a.aus) || zz(['show', 'origin/zz-sicherung:' + A.ORDNER + '/2026-01/2026-01-03-3333-frage-x.json']) !== roh) f.push('ein umgeschriebener Eintrag: Exit ' + a.code + ', die erste Fassung bleibt nicht oder „Strittig" fehlt · ' + kurz(a.aus, 200));
        fs.writeFileSync(ps1, roh); g(d2, ['commit', '-q', '-am', 'zurueck']); g(d2, ['push', '-q', 'origin', 'claude/s1']);
        // Ein Branch wird geloescht: ALARM (einmal), sein Eintrag liegt nur noch in der Sicherung.
        g(d2, ['push', '-q', 'origin', '--delete', 'claude/s1']); try { g(d, ['branch', '-q', '-D', 'claude/s1']); } catch (_) {}
        a = action();
        if (a.code !== 3 || !/ALARM:[^\n]*Branch wurde geloescht[^\n]*2026-01-03-3333/.test(a.aus) || !/NUR NOCH IN DER SICHERUNG: 1/.test(a.aus)) f.push('geloeschter Branch: Exit ' + a.code + ' (erwartet 3) — ' + kurz(a.aus, 300));
        a = action();
        if (a.code !== 0) f.push('derselbe Verlust ein zweites Mal: Exit ' + a.code + ' — ein Alarm gilt EINMAL je Verlust');
        g(d, ['checkout', '-q', '-b', 'claude/rettung', 'main']);
        let r = werkzeug(d, ['holen']);
        if (!/GERETTET: 1 Eintrag\/Eintraege liegen NUR noch in der Sicherung/.test(r.aus)) f.push('`holen` sagt nach dem Loeschen von claude/s1 nicht GERETTET');
        // Grabstein NUR auf origin/main (dieser Arbeitsbaum kennt die Liste noch nicht): ernten holt ihn nicht.
        g(d2, ['checkout', '-q', 'main']); g(d2, ['pull', '-q', 'origin', 'main']);
        fs.writeFileSync(path.join(d2, A.GRABSTEINE), JSON.stringify([{ id: s1.id, datum: '2026-01-05', grund: 'Personenname im Titel' }], null, 2) + '\n');
        g(d2, ['add', '-A']); g(d2, ['commit', '-q', '-m', 'grabstein']); g(d2, ['push', '-q', 'origin', 'main']);
        g(d, ['fetch', '-q', 'origin']);
        r = werkzeug(d, ['ernten']);
        if (fs.existsSync(path.join(d, A.ORDNER, '2026-01', '2026-01-03-3333-frage-x.json'))) f.push('`ernten` holt einen Eintrag zurueck, dessen Grabstein nur auf origin/main liegt');
        const blob = cp.execFileSync('git', ['hash-object', '--stdin'], { input: roh, encoding: 'utf8' }).trim();
        a = action();
        if (a.code !== 0 || /2026-01-03-3333/.test(gesichert()) || !/Entfernt \(Grabstein\): 2026-01-03-3333/.test(a.aus)) f.push('Grabstein: Exit ' + a.code + ', s1 noch in der Sicherung oder nicht als entfernt gemeldet · ' + kurz(a.aus, 200));
        if (zz(['rev-list', '--objects', 'origin/zz-sicherung']).indexOf(blob) >= 0) f.push('der Grabstein-Eintrag ist aus zz-sicherung noch ERREICHBAR (Geschichte) — die Sicherung muss je Lauf ein Stand ohne Geschichte sein');
        if (zz(['rev-list', '--count', 'origin/zz-sicherung']).trim() !== '1') f.push('zz-sicherung hat Geschichte: ' + zz(['rev-list', '--count', 'origin/zz-sicherung']).trim() + ' Commits');
        // Die Sicherung wird zurueckgesetzt (geloescht): ALARM, und sie wird neu geschrieben.
        g(d2, ['push', '-q', 'origin', '--delete', 'zz-sicherung']);
        a = action();
        if (a.code !== 3 || !/ALARM:[^\n]*zurueckgesetzt oder geloescht/.test(a.aus) || gesichert() !== '2026-01-01-1111,2026-01-02-2222') f.push('zurueckgesetzte Sicherung: Exit ' + a.code + ' (erwartet 3), neu gesichert „' + gesichert() + '" · ' + kurz(a.aus, 300));
        // Ohne Gedaechtnis (Cache abgelaufen): ein neuer Anfang, kein Alarm.
        fs.rmSync(cache, { recursive: true, force: true }); fs.mkdirSync(cache);
        a = action();
        if (a.code !== 0 || !/Gedaechtnis neu angelegt/.test(a.aus)) f.push('ohne Gedaechtnis: Exit ' + a.code + ' — ' + kurz(a.aus, 200));
        // Hoechstens ein Branch sichtbar: nichts sichern, sondern sagen, dass das Holen nicht geklappt hat.
        const b3 = path.join(eltern, 'eins.git'), d3 = path.join(eltern, 'eins');
        cp.execFileSync('git', ['init', '-q', '--bare', '-b', 'main', b3]); cp.execFileSync('git', ['clone', '-q', 'file://' + bare, d3]); g(d3, ['remote', 'set-url', 'origin', 'file://' + b3]); g(d3, ['push', '-q', 'origin', 'main']);
        for (const ref of g(d3, ['for-each-ref', '--format=%(refname)', 'refs/remotes']).split('\n').filter(x => x && !/origin\/main$/.test(x))) g(d3, ['update-ref', '-d', ref]);
        const r3 = A.sicherungSchreiben(d3, path.join(eltern, 'leer'));
        if (!/hoechstens ein Branch/.test(String(r3.grund))) f.push('mit nur origin/main wird gesichert statt gewarnt: ' + JSON.stringify(r3.grund || r3.neu.length));
        if (f.length) return { ok: false, warum: f.join(' · ') };
        return { ok: true, info: 'Basis lokal/PR/main · Waechter 1 hinter main gruen, geloescht/umgeschrieben/Grabstein-im-Baum rot · ' + lauf + ' Laeufe der Action wie auf GitHub: byte-gleich, Geheimnis nicht, nur zz-sicherung geaendert, Wiederholung ohne Commit, erste Fassung bleibt, Branch geloescht → Alarm einmal, Grabstein ohne Geschichte, Reset → Alarm, ohne Gedaechtnis neu · ein Ref → keine Sicherung' };
      } catch (e) { return { ok: false, warum: 'Ausnahme: ' + String(e.message).split('\n')[0] }; } finally { weg(eltern); }
    },
  },
];

(async function haupt() {
  console.log('\n=== austausch_check — kommt an, was eine KI-Sitzung der naechsten sagt?');
  let kaputt = 0, offen = 0;
  try { A = await import(pathToFileURL(path.join(__dirname, '_austausch.mjs')).href); }
  catch (e) { console.log('  !!   scripts/_austausch.mjs laesst sich nicht laden\n         → ' + String(e && e.message).split('\n')[0]); process.exitCode = 1; return; }
  // AUSTAUSCH_FALL=C12 faehrt nur die Faelle, deren Name so beginnt (zum Eingrenzen; die Suite faehrt alle).
  const nur = process.env.AUSTAUSCH_FALL ? String(process.env.AUSTAUSCH_FALL).split(',') : null;
  let gefahren = 0;
  for (const f of FAELLE) {
    if (nur && !nur.some(k => f.name.indexOf(k + ' ') === 0)) continue;
    gefahren++;
    let r;
    try { r = await f.lauf(); } catch (e) { r = { ok: false, warum: 'Ausnahme: ' + (e && e.message ? e.message.split('\n')[0] : e) }; }
    if (r && r.offen) { offen++; console.log('  --   ' + f.name + '\n         → nicht pruefbar: ' + ((r && r.warum) || 'unbekannt')); }
    else if (r && r.ok) console.log('  ok   ' + f.name + (r.info ? '   [' + r.info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
  }
  console.log('  ---');
  if (nur && !gefahren) { console.log('  --   AUSTAUSCH_FALL=' + process.env.AUSTAUSCH_FALL + ' trifft keinen Fall — nichts gefahren, nichts geprueft'); process.exitCode = 2; return; }
  console.log('  Faelle geprueft: ' + gefahren + (nur ? ' von ' + FAELLE.length + ' (AUSTAUSCH_FALL=' + process.env.AUSTAUSCH_FALL + ')' : '') + ' · davon kaputt: ' + kaputt + (offen ? ' · nicht pruefbar: ' + offen : ''));
  console.log('  Grenze: geprueft wird der Arbeitsbaum — was nur auf einem anderen Branch liegt, zeigt `node scripts/austausch.mjs holen`.');
  console.log('  Ob ein Eintrag klug ist, rechnet niemand; gerechnet wird, ob er pruefbar, verbunden und ehrlich ist.');
  process.exitCode = kaputt ? 1 : (offen ? 2 : 0);
})();
