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
  // Der Monatsordner ist der Monat der id — auch fuer eine rohe Zeichenkette (dann aus dem Namen; ohne id: 2026-01).
  const id = typeof e === 'string' ? A.idAusName(name || '') : e.id;
  const d = path.join(wurzel, A.ORDNER, id ? id.slice(0, 7) : '2026-01'); fs.mkdirSync(d, { recursive: true });
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
    name: 'A8 · Halt und dieser Stand · welche WIRKSAMEN Halts — auf main UND auf jedem anderen Branch — beruehrt dieser Stand (im PR: gegen die Basis-Seite des Merge-Commits)? Ein Bericht, keine Sperre — wer merged, liest hier, worum eine andere Sitzung gebeten hat',
    lauf: () => {
      const r = A.haltsDiesesStands(WURZEL, process.env);
      // Nicht pruefbar (Exit 2), wenn „keiner beruehrt" eine Taeuschung waere: kein Branch sichtbar, oder Eintragsdateien
      // fehlen im Teilabruf, die einen Halt tragen koennten (C18). Die uebrigen Gruende sagen: hier gibt es nichts zu rechnen.
      if (r.grund) return r.nichtPruefbar ? { offen: true, warum: r.grund } : { ok: true, info: 'nicht rechenbar: ' + r.grund };
      return { ok: true, info: (r.fehlend ? r.fehlend + ' Eintragsdatei(en) nicht geholt (Teilabruf: je mindestens ' + Math.round(r.fehlendAb / 1024) + ' KB laut Filter des Teilabrufs — groesser, als ein Eintrag sein darf) · ' : '') + r.halts.length + ' wirksame Halt(s) auf ' + r.refs + ' Remote-Refs und im Baum · ' + r.aend.dateien.length + ' Datei(en), ' + r.aend.funktionen.length + ' Funktion(en) geaendert' + (r.aend.bump ? ', mit Bump' : '') + ' · ' + (r.treffer.length ? '!! BERUEHRT: ' + r.treffer.map(x => x.h.e.id + ' {' + x.h.e._quelle + '} von ' + x.h.e.von + ' bis ' + x.h.e.bis + ' (' + x.t.slice(0, 3).join(', ') + ') — „' + kurz(x.h.e.text, 80) + '"').join(' | ') : 'keiner beruehrt diesen Stand') };
    },
  },
  {
    name: 'A9 · Funktionsgrenzen der Ware · in der ECHTEN index.html geht jeder <script>-Block fuer den Klammer-Scanner auf (nicht `unsicher`), und jede Deklaration hat einen Bereich — sonst trifft ein Halt auf eine Funktion nie oder die falsche (Runde 3: eine gueltige Zeile auf main schaltete jeden Funktions-Halt still ab)',
    lauf: () => {
      const t = lies('index.html'), fb = A.funktionsBereiche(t), namen = A.funktionsNamen(t), mit = new Set(fb.bereiche.map(b => b.name)), f = [];
      // Ein unsicherer Block ist kein Fehler im Code der App — der Scanner liest dort eine gueltige Zeile falsch
      // (gegen acorn nachsehen) oder das Skript ist wirklich kaputt. Beides heisst: Funktions-Halts treffen ungenau.
      if (fb.unsicher) f.push('unsicher: ' + fb.unsicherBloecke.map(u => 'der <script>-Block Zeile ' + u.von + '–' + u.bis + ' geht fuer den Scanner ab Zeile ' + u.ab + ' nicht auf').join('; ') + ' — eine Zeile, die der Scanner falsch liest (scripts/_austausch.mjs klammernPaaren, als Fall in C17 nachtragen), oder wirklich kaputtes JS');
      const ohne = [...namen].filter(n => !mit.has(n));
      if (ohne.length) f.push(ohne.length + ' von ' + namen.size + ' Deklarationen ohne Bereich (in einem Kommentar, einer Zeichenkette oder ausserhalb jedes <script>-Blocks — `halt` weist sie ab): ' + ohne.slice(0, 6).join(', '));
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: fb.bereiche.length + ' Funktionsbereiche in ' + A.jsBereiche(t, true).length + ' <script>-Bloecken, jede der ' + namen.size + ' Deklarationen mit Bereich, kein Block unsicher' };
    },
  },
  {
    name: 'A10 · Absichten im Baum · jede wirkende Lage und jeder wirkende Halt im Arbeitsbaum, der noch nicht auf origin/main liegt, traegt als `von` diese Sitzung (im PR: GITHUB_HEAD_REF) — oder liegt byte-gleich auf dem Branch seines Schreibers. Sonst wirkte er nach dem Merge in fremdem Namen (auf main gilt jede): ein „fertig" im Namen eines anderen beendete dessen Uebernahmen',
    lauf: () => {
      const b = A.brettLesen(WURZEL, { alleRefs: true });
      if (!b.gitDa) return { offen: true, warum: 'git ist nicht verfuegbar' };
      if (A.git(WURZEL, ['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main']) == null) return { offen: true, warum: 'origin/main ist nicht bekannt — ohne main laesst sich nicht sagen, was mit dem Merge neu wirkt' };
      // Wer ist „ich"? Im PR GITHUB_HEAD_REF — aber nur, wenn der Kopf des PR auf origin/<HEAD_REF> liegt (A.prKopf):
      // im PR eines Forks waehlt der Absender den Namen frei (Gegenpruefung 4). Ausserhalb des PR der lokale Branch,
      // und sein Upstream nur nach einem belegten `git branch -m` (A.eigeneNamen) — nie ein fremder.
      const ez = A.eigenerZweig(WURZEL), imPR = !!process.env.GITHUB_HEAD_REF, kopf = imPR ? A.prKopf(WURZEL, process.env) : null;
      const namen = imPR ? (kopf ? ['sitzung/' + kopf] : []) : A.eigeneNamen(ez);
      const f = [];
      let n = 0;
      for (const [id, liste] of b.fassungen) for (const v of liste) {
        if (!v.quellen.has('Arbeitsbaum') || (v.e.art !== 'lage' && v.e.art !== 'halt') || [...v.quellen].some(A.istMainRef)) continue;
        // JEDE gueltige Lage und jeder gueltige Halt, auch abgelaufen: eine abgelaufene Lage zaehlt im Deckel ihres
        // Schreibers weiter mit — gemergt kippte eine fremde abgelaufene Lage dessen laufende Uebernahme (Gegenpruefung 4).
        if (A.eintragPruefen(v.e, v.e._datei).length) continue;
        n++;
        if (namen.indexOf(v.e.von) >= 0 || [...v.quellen].some(q => A.istAutorRef(q, A.autorZweig(v.e)))) continue;
        f.push(id + ' (' + v.e.art + ' von ' + v.e.von + ')');
      }
      if (f.length && !namen.length && !imPR) return { offen: true, warum: 'wer schreibt, ist nicht ablesbar (losgeloester HEAD, kein GITHUB_HEAD_REF) — ' + f.length + ' Absicht(en) ungeklaert: ' + f.slice(0, 4).join(', ') };
      if (f.length) return { ok: false, warum: f.length + ' Absicht(en) in fremdem Namen im Baum — gemergt wirkten sie fuer alle: ' + f.slice(0, 6).join(', ') + (imPR && !kopf ? ' (GITHUB_HEAD_REF=' + process.env.GITHUB_HEAD_REF + ' ist kein Branch dieses Repos, der den Kopf des PR traegt — ein Fork?)' : '') + '. Entfernen (git rm) oder vom Schreiber selbst schreiben lassen.' };
      return { ok: true, info: n + ' Lage(n)/Halt(s) im Baum, die nicht schon auf main liegen (auch abgelaufene) — alle von ' + (namen.join(' / ') || 'niemandem') + ' oder vom Branch ihres Schreibers' };
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
        // Ein Sprung weit ueber main (gs-v9.99) verschiebt „naechste" nicht; ein Branch mit Commit-Zeit 2099 ist
        // nicht „frisch" — seine Nummer (v1.05) ist aber VERGEBEN und zaehlt mit (sonst empfahl `naechste` sie
        // still ein zweites Mal — Gegenpruefung 2), und `naechste` sagt es.
        // (Eigene Linie von claude/a: ihre Kuerzel-Ueberschrift fuegt keine neue Linie hinzu.)
        zweig('claude/sprung', 'v9.99', 'ab', 'Alpha', vor(1), 'origin/claude/a');
        zweig('claude/zukunft', 'v1.05', 'ab', 'Alpha', '2099-01-01T00:00:00Z', 'origin/claude/a');
        g(d, ['checkout', '-q', 'claude/weiter']); g(d, ['fetch', '-q', 'origin']);   // der eigene Branch zaehlt nie als „frisch" — also zurueck
        const m3 = A.vergebeneMarken(d, Date.now(), 14);
        if ((m3.unplausibel || []).map(u => ohneO(u.ref) + ':' + u.wert).join() !== 'sprung:v9.99') f.push('unplausibel: ' + JSON.stringify(m3.unplausibel) + ' — erwartet claude/sprung mit v9.99');
        if ((m3.zukunft || []).map(z => ohneO(z.ref)).join() !== 'zukunft') f.push('Commit-Zeit in der Zukunft: ' + JSON.stringify(m3.zukunft) + ' — erwartet claude/zukunft, nicht als frisch gezaehlt');
        if (m3.naechsteVersion !== 'v1.06') f.push('mit Sprung und Zukunfts-Branch: naechste freie ' + m3.naechsteVersion + ' — erwartet v1.06 (v1.05 traegt der Zukunfts-Branch, der Sprung zaehlt nicht)');
        r = werkzeug(d, ['naechste']);
        if (!/Nicht gezaehlt — mehr als 20 Versionen ueber main[^\n]*claude\/sprung v9\.99/.test(r.aus)) f.push('`naechste` nennt den unplausiblen Sprung nicht');
        if (!/!! 1 Branch\(es\) mit Commit-Zeit in der Zukunft — ihre Nummern sind MITGEZAEHLT: claude\/zukunft/.test(r.aus)) f.push('`naechste` verschweigt den Zukunfts-Branch: ' + kurz(r.aus, 200));
        // Der EIGENE Arbeitsbaum mit einem unplausiblen Sprung wird ebenso genannt (nicht still uebergangen).
        stand('v9.98', 'ab', 'Alpha drei'); r = werkzeug(d, ['naechste']);
        if (!/!! Dein Arbeitsbaum traegt v9\.98 — mehr als 20 Versionen ueber main/.test(r.aus)) f.push('`naechste` uebergeht den unplausiblen eigenen Sprung still: ' + kurz(r.aus, 200));
        stand('v1.01', 'ab', 'Alpha drei');
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
      // ── Gegenpruefung 2 (18.11.2026): die Rechnung.
      { // Nur ein GUELTIGER Eintrag schliesst, ersetzt, beantwortet — und ersetzen darf nur, wer geschrieben hat.
        const kb = mk('befund', { dringlichkeit: 'kritisch' }), egal = mk('abschluss', { ergebnis: 'egal', bezug: [bz('schliesst', kb)] });
        const kb2 = mk('befund', { dringlichkeit: 'kritisch' }), ohneBeleg = mk('befund', { beleg: undefined, bezug: [bz('ersetzt', kb2)] });
        const kb3 = mk('befund', { von: 'sitzung/autor' }), fremdErsatz = mk('befund', { von: 'sitzung/fremd', bezug: [bz('ersetzt', kb3)] }), eigenErsatz = mk('befund', { von: 'sitzung/autor', bezug: [bz('ersetzt', kb3)] });
        const fr = mk('frage'), leereAntw = mk('antwort', { titel: undefined, bezug: [bz('beantwortet', fr)] });
        let zs = A.ableiten([kb, egal, kb2, ohneBeleg, kb3, fremdErsatz, fr, leereAntw]).zustand;
        if (zs.get(kb.id).z !== 'offen') f.push('ein ungueltiger Abschluss (ergebnis „egal") schliesst einen kritischen Befund');
        if (zs.get(kb2.id).z !== 'offen') f.push('ein ungueltiger Ersatz (Befund ohne Beleg) versteckt einen kritischen Befund');
        if (zs.get(kb3.id).z !== 'offen') f.push('ein FREMDER Schreiber ersetzt einen Befund');
        if (zs.get(fr.id).z !== 'offen') f.push('eine ungueltige Antwort (ohne Titel) beantwortet eine Frage');
        if (A.ableiten([kb3, eigenErsatz]).zustand.get(kb3.id).z !== 'ersetzt') f.push('der Autor kann seinen Befund nicht mehr ersetzen');
        // Halt und Lage, die eine Bezugsregel verletzen, wirken nicht; ein Veto traegt keine Geltung.
        const zu = mk('abschluss', { bezug: [bz('schliesst', mk('befund'))] }), vetoAbschluss = mk('halt', { geltung: undefined, bezug: [bz('widerspricht', zu)] }), lageAbschluss = mk('lage', { bezug: [bz('baut_auf', zu)] });
        const s6 = A.schwarm([zu, vetoAbschluss, lageAbschluss], T);
        if (s6.halts.length || s6.uebernahme.size || s6.unwirksam.length !== 2) f.push('Veto gegen einen Abschluss / Lage, die einen Abschluss nimmt, wirken (oder werden nicht als unwirksam genannt): ' + s6.halts.length + ' Halts, ' + s6.uebernahme.size + ' Uebernahmen');
        nein(mk('halt', { bezug: [bz('widerspricht', mk('befund'))] }), /Veto[^]*traegt keine „geltung"/, 'Halt mit Geltung UND widerspricht (galt nur als Veto, die Geltung wirkte still nicht)');
        // Gute Grenzfaelle (sonst waere eine zu strenge Regel gruen): Veto gegen Lage und gegen Halt, Halt „dringend",
        // Lage mit genau drei Zielen, Lage mit genau 24 h, Halt mit genau 72 h.
        const gl = mk('lage'), gh = mk('halt'), drei = [mk('befund'), mk('befund'), mk('befund')];
        const vL = mk('halt', { geltung: undefined, bezug: [bz('widerspricht', gl)] }), vH = mk('halt', { geltung: undefined, bezug: [bz('widerspricht', gh)] });
        gut(vL, 'Veto gegen eine Lage'); gut(vH, 'Veto gegen einen Halt');
        const s7 = A.schwarm([gl, gh, vL, vH], T);
        if (!s7.vetos.has(gl.id) || !s7.vetos.has(gh.id)) f.push('ein Veto gegen eine Lage oder einen Halt wirkt nicht');
        gut(mk('halt', { dringlichkeit: 'dringend' }), 'dringender Halt');
        gut(mk('lage', { bezug: drei.map(x => bz('baut_auf', x)) }), 'Lage mit genau drei Zielen');
        gut(mk('lage', { bis: '2026-01-02T10:00:00Z' }), 'Lage mit genau 24 h');
        gut(mk('halt', { bis: '2026-01-04T10:00:00Z' }), 'Halt mit genau 72 h');
        nein(mk('halt', { geltung: ['index.html:gsZwei'] }), /ohne Datei/, 'Geltung „datei:funktion"');
        // `von` gegen die Quelle auch bei Halt und Veto; main traegt jede (gemergt); ein abgelaufener Eintrag wird nicht gemeldet.
        const hf = mk('halt', { von: 'sitzung/claude/opfer' }), lm = mk('lage', { von: 'sitzung/claude/koord', bezug: [bz('baut_auf', zc0())] });
        function zc0() { return mk('befund'); }
        const lAlt = mk('lage', { von: 'sitzung/claude/alt', zeit: '01:00:00', bis: '2026-01-01T02:00:00Z' });
        const wo2 = new Map([[hf.id, new Set(['origin/claude/angreifer'])], [lm.id, new Set(['origin/main'])], [lAlt.id, new Set(['origin/claude/fremd'])]]);   // abgelaufen UND mit fremdem von: trotzdem still
        const s8 = A.schwarm([hf, lm, lAlt], T, { wo: wo2, ich: 'sitzung/claude/opfer' });
        if (s8.halts.some(h0 => h0.e === hf) || !s8.unwirksam.some(u => u.e === hf && /passt nicht/.test(u.grund))) f.push('ein Halt im Namen von claude/opfer, der auf claude/angreifer liegt, wirkt');
        if (s8.uebernahme.size !== 1) f.push('eine Uebernahme, die nach main gemergt wurde (ihr Branch geloescht), gilt nicht mehr — „auf main jede"');
        if (s8.unwirksam.some(u => u.e === lAlt)) f.push('eine ABGELAUFENE Lage wird als unwirksam gemeldet — Laerm bei jedem Lesen');
        // Hoechstens drei Uebernahmen je Schreiber zugleich; „fertig" in derselben Sekunde gibt nichts frei.
        const vierZ = [mk('befund'), mk('befund'), mk('befund'), mk('befund')];
        const ql = vierZ.map((z, i) => mk('lage', { von: 'sitzung/q', zeit: '10:0' + i + ':00', bezug: [bz('baut_auf', z)] }));
        const s9 = A.schwarm(vierZ.concat(ql), T);
        if (s9.uebernahme.size !== 3 || s9.uebernahme.has(vierZ[3].id) || !s9.unwirksam.some(u => u.e === ql[3] && /mehr als 3/.test(u.grund))) f.push('vier Uebernahmen eines Schreibers: ' + s9.uebernahme.size + ' gelten — erwartet die drei aeltesten, die vierte als unwirksam genannt');
        // Der Deckel gilt ZUR ZEIT der Lage (Gegenpruefung 3): eine bei ihrem Schreiben unwirksame vierte Uebernahme wird durch ein
        // spaeteres „fertig" (oder Ablaufen) nicht rueckwirkend gueltig — vorher schlug sie mit ihrem alten Zeitstempel eine spaetere ehrliche.
        { const z = [mk('befund'), mk('befund'), mk('befund'), mk('befund')];
          const w1 = mk('lage', { von: 'sitzung/w', zeit: '08:00:00', bezug: z.slice(0, 3).map(x => bz('baut_auf', x)) }), w2 = mk('lage', { von: 'sitzung/w', zeit: '09:00:00', bezug: [bz('baut_auf', z[3])] });
          const s1 = mk('lage', { von: 'sitzung/s', zeit: '10:00:00', bezug: [bz('baut_auf', z[3])] }), wf = mk('lage', { von: 'sitzung/w', zeit: '11:00:00', phase: 'fertig', bezug: [bz('baut_auf', z[0])] });
          const st = A.schwarm(z.concat([w1, w2, s1, wf]), T), u3 = st.uebernahme.get(z[3].id);
          if (!u3 || u3.lage.e !== s1 || !st.unwirksam.some(u => u.e === w2 && /mehr als 3/.test(u.grund))) f.push('Deckel am Endstand: nach einem spaeteren „fertig" gilt fuer das vierte Ziel ' + (u3 ? u3.lage.e.von + ' ' + u3.lage.e.zeit : 'niemand') + ' — erwartet sitzung/s (die vierte von w lag bei ihrem Schreiben ueber dem Deckel)');
          const wf0 = mk('lage', { von: 'sitzung/w', zeit: '08:30:00', phase: 'fertig', bezug: [bz('baut_auf', z[0])] });
          const u3b = A.schwarm(z.concat([w1, w2, s1, wf0]), T).uebernahme.get(z[3].id);
          if (!u3b || u3b.lage.e !== w2) f.push('ein „fertig" VOR der vierten Uebernahme gibt keinen Platz frei: es gilt ' + (u3b ? u3b.lage.e.von + ' ' + u3b.lage.e.zeit : 'niemand') + ' — erwartet sitzung/w 09:00');
          const v1 = mk('lage', { von: 'sitzung/v', zeit: '06:00:00', bis: '2026-01-01T07:30:00Z', bezug: z.slice(0, 3).map(x => bz('baut_auf', x)) }), v2 = mk('lage', { von: 'sitzung/v', zeit: '07:00:00', bezug: [bz('baut_auf', z[3])] });
          const st5 = A.schwarm(z.concat([v1, v2]), T);
          if (st5.uebernahme.has(z[3].id) || !st5.unwirksam.some(u => u.e === v2 && /mehr als 3/.test(u.grund))) f.push('eine Lage, die bei ihrem Schreiben ueber dem Deckel lag, gilt, sobald die aelteren ABGELAUFEN sind');
          const e1 = mk('lage', { von: 'sitzung/e', zeit: '05:00:00', bis: '2026-01-01T06:00:00Z', bezug: z.slice(0, 3).map(x => bz('baut_auf', x)) }), e2 = mk('lage', { von: 'sitzung/e', zeit: '07:00:00', bezug: [bz('baut_auf', z[3])] });
          const ue = A.schwarm(z.concat([e1, e2]), T).uebernahme.get(z[3].id);
          if (!ue || ue.lage.e !== e2) f.push('drei Uebernahmen, die VOR der vierten abgelaufen waren, belegen bei ihr noch den Deckel');
          // Teilweise: von drei Zielen liegt nur eines ueber dem Deckel — die anderen zwei gelten.
          const p0 = mk('befund'), pz = [mk('befund'), mk('befund'), mk('befund')];
          const pa = mk('lage', { von: 'sitzung/p', zeit: '08:00:00', bezug: [bz('baut_auf', p0)] }), pb = mk('lage', { von: 'sitzung/p', zeit: '08:10:00', bezug: pz.map(x => bz('baut_auf', x)) });
          const st3 = A.schwarm([p0].concat(pz, [pa, pb]), T), ut = st3.unwirksam.find(u => u.e === pb);
          if (!ut || !ut.teil || (ut.ziele || []).join() !== pz[2].id || !st3.uebernahme.has(pz[0].id) || !st3.uebernahme.has(pz[1].id)) f.push('eine Lage, die nur fuer EIN Ziel ueber dem Deckel liegt: ' + JSON.stringify(ut ? { teil: ut.teil, ziele: ut.ziele } : null) + ' — erwartet teilweise, nur das dritte Ziel');
          // Mithelfen ist ein FELD (nicht der Titel): nimmt nichts, belegt keinen Platz, steht nur bei einem GENOMMENEN Ziel daneben.
          const m0 = mk('befund'), mfrei = mk('befund'), own = mk('lage', { von: 'sitzung/o', zeit: '08:00:00', bezug: [bz('baut_auf', m0)] });
          const hlp = mk('lage', { von: 'sitzung/h', zeit: '07:00:00', titel: 'Ich schaue mir die Gegenprobe an', mithelfen: true, bezug: [bz('baut_auf', m0), bz('baut_auf', mfrei)] });
          const hz = [mk('befund'), mk('befund'), mk('befund')], hl = mk('lage', { von: 'sitzung/h', zeit: '09:00:00', bezug: hz.map(x => bz('baut_auf', x)) });
          const titelNur = mk('lage', { von: 'sitzung/t', zeit: '07:30:00', titel: 'Mithelfen: in Wahrheit nehme ich es', bezug: [bz('baut_auf', mfrei)] });
          const st4 = A.schwarm([m0, mfrei, own, hlp, titelNur].concat(hz, [hl]), T), um = st4.uebernahme.get(m0.id), uf = st4.uebernahme.get(mfrei.id);
          if (!um || um.lage.e !== own || !um.auch.some(l => l.e === hlp)) f.push('Mithelfen: Eigentuemer ' + (um ? um.lage.e.von : 'keiner') + ' — erwartet sitzung/o (die aeltere Mithelf-Lage nimmt nichts), sitzung/h daneben');
          if (!uf || uf.lage.e !== titelNur) f.push('ein Titel „Mithelfen: …" ohne das Feld nimmt nichts — der Titel entscheidet, nicht die Absicht');
          if (hz.some(x => !st4.uebernahme.has(x.id)) || st4.unwirksam.some(u => u.e === hl)) f.push('eine Mithelf-Lage belegt Platz im Deckel: die drei Uebernahmen von sitzung/h gelten nicht alle');
          nein(mk('lage', { mithelfen: true }), /mithelfen gehoert an eine Lage mit baut_auf/, 'mithelfen ohne Ziel');
          nein(mk('lage', { mithelfen: 'ja', bezug: [bz('baut_auf', m0)] }), /mithelfen ist true/, 'mithelfen als Text');
          nein(mk('lage', { mithelfen: true, phase: 'fertig', bezug: [bz('baut_auf', m0)] }), /mithelfen gehoert an eine Lage/, 'mithelfen an einem „fertig"');
          nein(mk('befund', { mithelfen: true }), /mithelfen gehoert an eine Lage/, 'mithelfen an einem Befund');
          gut(mk('lage', { mithelfen: true, bezug: [bz('baut_auf', m0)] }), 'Lage mit mithelfen'); }
        const zs1 = mk('befund'), fertigGleich = mk('lage', { von: 'sitzung/r', zeit: '10:00:00', phase: 'fertig' }), nimmGleich = mk('lage', { von: 'sitzung/r', zeit: '10:00:00', bezug: [bz('baut_auf', zs1)] });
        if (!A.schwarm([zs1, nimmGleich, fertigGleich], T).uebernahme.has(zs1.id)) f.push('ein „fertig" in DERSELBEN Sekunde gibt die eben genommene Aufgabe frei');
        // Rueckdatiert (Zeitstempel weit vor dem Commit, der die Lage brachte) und vordatiert: unwirksam.
        const zr = mk('befund'), ehrlich = mk('lage', { von: 'sitzung/e', zeit: '11:00:00', bezug: [bz('baut_auf', zr)] }), rueck = mk('lage', { von: 'sitzung/f', zeit: '01:00:00', bis: '2026-01-02T00:00:00Z', bezug: [bz('baut_auf', zr)] });
        Object.defineProperty(rueck, '_angekommen', { value: Date.parse('2026-01-01T11:30:00Z') });
        const vor0 = mk('halt', { zeit: '11:00:00', bis: '2026-01-03T00:00:00Z' }); Object.defineProperty(vor0, '_angekommen', { value: Date.parse('2026-01-01T09:00:00Z') });
        const s10 = A.schwarm([zr, ehrlich, rueck, vor0], T);
        if ((s10.uebernahme.get(zr.id) || { lage: { e: {} } }).lage.e !== ehrlich || !s10.unwirksam.some(u => u.e === rueck && /rueckdatiert/.test(u.grund))) f.push('eine rueckdatierte Lage (01:00, angekommen 11:30) stiehlt die Uebernahme von 11:00');
        if (s10.halts.some(h0 => h0.e === vor0) || !s10.unwirksam.some(u => u.e === vor0 && /vordatiert/.test(u.grund))) f.push('ein vordatierter Halt (11:00, angekommen 09:00) wirkt');
        // Viele Eintraege an EINEM Stichwort werden gezaehlt, nicht gepaart (2 000: zwei Millionen Paare, 5 000: Speicher voll).
        const viele = Array.from({ length: 2000 }, (_, i) => mk('befund', { von: 'sitzung/v' + i, stichworte: ['kalender'] }));
        const t0 = Date.now(), an0 = A.anstoesse(viele), dauer = Date.now() - t0;
        if (an0.length > 5 || dauer > 3000) f.push('2 000 Befunde an einem Stichwort: ' + an0.length + ' Anstoesse in ' + dauer + ' ms — erwartet EINE Zeile, schnell');
        // Die Suchmuster fuer Geheimnisse bleiben linear: 64 KB „eyJ-" (JWT) und 64 KB ohne „@" (E-Mail).
        for (const [was, text] of [['eyJ-', 'eyJ-'.repeat(16000)], ['ohne @', 'a.'.repeat(32000)]]) {
          const t1 = Date.now(); A.eintragPruefen(mk('befund', { beleg: [text] })); const ms = Date.now() - t1;
          if (ms > 400) f.push('eintragPruefen auf 64 KB „' + was + '": ' + ms + ' ms — ein Muster springt quadratisch zurueck'); }
        // Funktionsgrenzen: eine Zeile gehoert ALLEN umschliessenden Funktionen, eine ausserhalb keiner (CSS, Changelog, Version).
        const html = ['<style>.x { color: red; }</style>', '<script>', "var GS_VERSION = 'v1.00';", 'function gsAussen(von) {', '  var im = function (t) { return t; };', '  var x = 1;', '  return im(x) + "}" + /}/.source;', '}', 'window.GS_RELEASES = [', "  { v: 'v1.00' }", '];', '</script>', ''].join('\n');
        const html2 = html.replace('var x = 1;', 'var x = 2;').replace('color: red', 'color: blue').replace("GS_VERSION = 'v1.00'", "GS_VERSION = 'v1.01'").replace("{ v: 'v1.00' }", "{ v: 'v1.01' }, { v: 'v1.00' }");
        const fa = (zeile) => [...A.funktionenAusDiff('@@ -' + zeile + ' +' + zeile + ' @@\n', html, html2)].sort().join();
        if (fa(6) !== 'gsAussen') f.push('eine Zeile mitten im Rumpf (hinter dem Helfer „im"): „' + fa(6) + '" — erwartet gsAussen');
        if (fa(5) !== 'gsAussen,im') f.push('die Zeile des Helfers: „' + fa(5) + '" — erwartet gsAussen und im');
        if (fa(1) || fa(3) || fa(10)) f.push('CSS, GS_VERSION oder der Changelog gehoeren zu einer Funktion: „' + [fa(1), fa(3), fa(10)].join('|') + '"');
      }
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
        // Wer bewusst mithilft (--auch), weiss, dass ein anderer zuerst war — kein Satz bei jedem Lesen
        // (Gegenpruefung 2). Wer OHNE --auch nachrangig nimmt (gleichzeitig, oder am Werkzeug vorbei), erfaehrt es.
        r = werkzeug(d, ['nehme', befund.slice(-4), '--auch']);
        if (r.code !== 0 || !geschrieben(r)) f.push('`nehme --auch` schreibt nicht: ' + kurz(r.aus, 200));
        r = werkzeug(d, []);
        if (/Deine Uebernahme von [^\n]*gilt nicht/.test(r.aus)) f.push('nach bewusstem --auch steht trotzdem „Deine Uebernahme gilt nicht"');
        { const st = path.join(eltern, 'nachrangig.json'); fs.writeFileSync(st, JSON.stringify([{ art: 'lage', titel: 'Nehme (gleichzeitig)', phase: 'laeuft', bis: new Date(Date.now() + 36e5).toISOString().replace(/\.\d{3}Z$/, 'Z'), bezug: [{ art: 'baut_auf', id: befund }] }]));
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1050 - (Date.now() % 1000));
          werkzeug(d, ['einspielen', st]); }
        r = werkzeug(d, []);
        if (!/Deine Uebernahme von [^\n]*gilt nicht: sitzung\/claude\/halter war zuerst/.test(r.aus)) {
          const u = A.schwarm(A.brettLesen(d, { alleRefs: true }).eintraege, Date.now()).uebernahme.get(befund);
          f.push('die nachrangige eigene Uebernahme (ohne --auch) wird nicht gesagt — gerechnet: ' + (u ? u.lage.e.von + ' ' + u.lage.e.zeit + ' {' + u.lage.e._quelle + '}, daneben ' + u.auch.map(x => x.e.von + ' ' + x.e.zeit + ' {' + x.e._quelle + '}').join(', ') : 'keine Uebernahme'));
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
        // Ein Pfad mit Umlaut und einer mit Leerzeichen kommen ungequotet an (sonst „"docs/pl\\303\\244ne/x.md"", und kein Halt traefe ihn).
        fs.mkdirSync(path.join(d, 'docs', 'pläne'), { recursive: true }); fs.writeFileSync(path.join(d, 'docs', 'pläne', 'x.md'), 'x\n'); fs.writeFileSync(path.join(d, 'docs', 'mein plan.md'), 'y\n');
        a = A.eigeneAenderung(d);
        const ht = A.haltBeruehrt({ geltung: ['docs/pläne/', 'docs/mein plan.md'] }, a);
        if (ht.join() !== 'docs/pläne/x.md,docs/mein plan.md') f.push('Halt auf docs/pläne/ und „docs/mein plan.md": „' + ht.join() + '" — dateien ' + JSON.stringify(a.dateien));
        if (f.length) return { ok: false, warum: f.join(' · ') };
        return { ok: true, info: 'main gebumpt, gsEins geaendert und einen Schritt der Sitzung squash-gemergt, die Sitzung gsZwei + eingerueckt gsInnen + Umbenennung + Brett: dateien, funktionen, bump stimmen; gleiche Aenderung wie main zaehlt nicht; eigener Bump zaehlt; feste Basis; Umlaut- und Leerzeichen-Pfade ungequotet' };
      } catch (e) { return { ok: false, warum: 'Ausnahme: ' + String(e.message).split('\n')[0] }; } finally { weg(eltern); }
    },
  },
  {
    name: 'C16 · Der Schwarm sagt es dem, den es betrifft · als PROZESS ueber vier Branches: was die Austausch-Runde schreibt, ist „meins" (Antworten darauf kommen an); Antworten auf meinen Halt und seine Aufhebung erreichen mich; AN DICH ohne stillen Deckel und nur als ganzes Wort; ein Halt mit fremdem Namen, eine rueckdatierte Lage und eine Lage mit fremdem `von` sind UNWIRKSAM; `zeige` sagt dasselbe wie das Brett; `naechste` holt selbst, nennt das Veto und gilt auch als JSON; die Bloecke KRITISCH, LAGE, HALT UND VETO, „dringend zuerst"; hoechstens drei Uebernahmen; Lieferung, Push-Hinweis, kritisch → STATUS-Zeile; ein Upstream unter anderem Namen und ein geloeschter Branch werden gesagt; `ernten` und A8',
    lauf: () => {
      const eltern = tmp('betrifft'), bare = path.join(eltern, 'origin.git'), d = path.join(eltern, 'klon');
      const id = (r) => { const m = r.aus.match(/\n {2}(\d{4}-\d{2}-\d{2}-[0-9a-f]{4,8}) /); return m ? m[1] : null; };
      const block = (aus, kopf) => { const i = aus.indexOf('\n' + kopf); if (i < 0) return ''; const rest = aus.slice(i + 1), j = rest.slice(1).search(/\n[A-Z][A-Z ]+[A-Z]( \(|\n|$)/); return j < 0 ? rest : rest.slice(0, j + 1); };
      try {
        const f = [];
        const push = (zweig, msg) => { g(d, ['add', '-A']); g(d, ['commit', '-q', '--allow-empty', '-m', msg]); g(d, ['push', '-q', '-u', 'origin', zweig]); };
        const hand = (e, name) => ablegen(d, e, name);
        const jetzt = (dh) => new Date(Date.now() + (dh || 0) * 36e5);
        const stamp = (dt) => ({ datum: dt.toISOString().slice(0, 10), zeit: dt.toISOString().slice(11, 19) });
        const bisIn = (h) => jetzt(h).toISOString().replace(/\.\d{3}Z$/, 'Z');
        cp.execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare]);
        fs.mkdirSync(d); g(d, ['init', '-q', '-b', 'main', '.']); g(d, ['remote', 'add', 'origin', 'file://' + bare]);
        fs.writeFileSync(path.join(d, 'index.html'), QUELLE); fs.writeFileSync(path.join(d, 'sw.js'), "const VERSION = 'gs-v1.00';\n");
        const b = []; for (let i = 0; i < 5; i++) { const r = werkzeug(d, ['neu', 'befund', '--von', 'sitzung/start', '--titel', 'Befund ' + i + ' von main', '--beleg', 'gemessen: ' + i]); b.push(id(r)); }
        let r = werkzeug(d, ['neu', 'befund', '--von', 'sitzung/start', '--dringlichkeit', 'dringend', '--titel', 'Ein dringender aelterer Befund', '--beleg', 'gemessen: d']); const dringend = id(r);
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1100);
        r = werkzeug(d, ['neu', 'befund', '--von', 'sitzung/start', '--titel', 'Ein normaler juengerer Befund', '--beleg', 'gemessen: n']); const normal = id(r);
        if (b.some(x => !x) || !dringend || !normal) return { ok: false, warum: 'Aufbau: Befunde auf main nicht geschrieben — ' + kurz(r.aus, 200) };
        if (!/^\d{4}-\d{2}-\d{2}-[0-9a-f]{8}$/.test(b[0])) f.push('`neu` vergibt keine acht Hexstellen: ' + b[0]);
        push('main', 'start');
        // ── ICH: eine Frage, ein Runden-Stapel, ein Halt, ein Bump-Halt, drei Uebernahmen, ein kritischer Befund.
        g(d, ['checkout', '-q', '-b', 'claude/ich-arbeit', 'main']);
        const runde = path.join(eltern, 'runde.json'); fs.writeFileSync(runde, JSON.stringify([{ art: 'frage', von: 'runde/kalender', an: 'alle', titel: 'Die Runde fragt: wer misst den Kalender?' }]));
        r = werkzeug(d, ['einspielen', runde]); const rF = (r.aus.match(/\n {2}(\d{4}-\d{2}-\d{2}-[0-9a-f]{8}) /) || [])[1];
        const rFDatei = rF && fs.readdirSync(path.join(d, A.ORDNER, rF.slice(0, 7))).find(n => n.indexOf(rF) === 0);
        const rFE = rFDatei ? JSON.parse(fs.readFileSync(path.join(d, A.ORDNER, rF.slice(0, 7), rFDatei), 'utf8')) : {};
        if (rFE.von !== 'sitzung/claude/ich-arbeit' || rFE.rolle !== 'runde/kalender') f.push('ein Runden-Eintrag traegt nicht die Sitzung als `von` und die Runde als `rolle`: ' + JSON.stringify({ von: rFE.von, rolle: rFE.rolle }));
        r = werkzeug(d, ['neu', 'frage', '--an', 'alle', '--titel', 'Eine Frage, die ich spaeter schliesse']); const fZu = id(r);
        r = werkzeug(d, ['halt', '--geltung', 'gsEins', '--bis', '6h', '--text', 'ich baue gsEins um']); const meinHalt = id(r);
        r = werkzeug(d, ['halt', '--geltung', 'bump', '--bis', '6h', '--text', 'ich bumpe gleich selbst']); const meinBump = id(r);
        r = werkzeug(d, ['nehme', b[0].slice(-4), b[1].slice(-4), b[2].slice(-4)]); if (r.code !== 0) f.push('drei Uebernahmen auf einmal: Exit ' + r.code + ' · ' + kurz(r.aus, 200));
        r = werkzeug(d, ['nehme', b[0].slice(-4)]); if (r.code !== 0) f.push('die EIGENE Uebernahme erneut nehmen (verlaengern) wird abgewiesen: Exit ' + r.code + ' · ' + kurz(r.aus, 200));
        const meineLage = id(r);
        // Eine eigene, schon abgelaufene Lage (von Hand: vor 3 h geschrieben, vor 1 h abgelaufen).
        const altLage = mk('lage', Object.assign({ id: stamp(jetzt(-3)).datum + '-f00a0005', von: 'sitzung/claude/ich-arbeit', titel: 'Abgelaufene Lage', bis: bisIn(-1) }, stamp(jetzt(-3)))); hand(altLage);
        r = werkzeug(d, ['nehme', b[3].slice(-4)]); if (r.code !== 1 || !/hoechstens 3 zugleich/.test(r.aus)) f.push('eine vierte Uebernahme zugleich: Exit ' + r.code + ' — erwartet 1 („hoechstens 3 zugleich") · ' + kurz(r.aus, 200));
        r = werkzeug(d, ['nehme', b[3].slice(-4), '--von', 'koordinator']); if (r.code !== 2 || !/passt nicht zum Branch/.test(r.aus)) f.push('`nehme --von koordinator` auf claude/ich-arbeit: Exit ' + r.code + ' — erwartet 2 (sie waere fuer alle UNWIRKSAM)');
        r = werkzeug(d, ['neu', 'befund', '--dringlichkeit', 'kritisch', '--titel', 'Live: der Kalender zaehlt doppelt', '--beleg', 'gemessen: 2 statt 1']); const kritisch = id(r);
        if (!new RegExp('brett:' + kritisch + ' — ').test(r.aus)) f.push('ein kritischer Befund nennt die STATUS-Zeile nicht (A7 wuerde erst in der CI rot)');
        if (!/git push -u origin HEAD/.test(r.aus)) f.push('der Push-Hinweis nennt kein `-u origin HEAD` (scheitert auf einem frischen Branch ohne Upstream)');
        if (!meinHalt || !meinBump || !rF || !kritisch) return { ok: false, warum: f.concat('Aufbau: eigene Eintraege nicht geschrieben — ' + kurz(r.aus, 200)).join(' · ') };
        fs.writeFileSync(path.join(d, 'index.html'), QUELLE.replace('function gsZwei(){ return gsEins() + gsEins(); }', 'function gsZwei(){ return 2 * gsEins(); }'));
        push('claude/ich-arbeit', 'ich');
        r = werkzeug(d, ['naechste']); if (r.code !== 0) f.push('der EIGENE Bump-Halt haelt das eigene `naechste` an (Exit ' + r.code + ')');
        // ── ANDERE: antwortet der Runde und auf meinen Halt, hebt meinen Bump-Halt auf, fragt mich siebenmal, setzt einen
        //    echten Bump-Halt — und legt von Hand drei Faelschungen ab: einen Halt im Namen von DRITT, eine rueckdatierte
        //    Lage auf b0, eine Lage mit fremdem `von` auf b3.
        g(d, ['checkout', '-q', '-b', 'claude/andere', 'main']); g(d, ['fetch', '-q', 'origin']);
        fs.mkdirSync(path.join(d, 'docs'), { recursive: true }); fs.writeFileSync(path.join(d, 'docs', 'messung.csv'), 'tag;n\n1;2\n'); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'messung']);
        r = werkzeug(d, ['antworte', rF.slice(-4), '--text', 'Gemessen: der Kalender laeuft zweimal', '--geliefert', 'docs/messung.csv']); const lieferung = id(r); if (!lieferung) f.push('Antwort auf die Runden-Frage nicht geschrieben: ' + kurz(r.aus, 200));
        r = werkzeug(d, ['antworte', fZu.slice(-4), '--text', 'Dazu weiss ich etwas']);
        // Eine Datei unter fremdem Namen (die id im Namen ist eine andere als im Inhalt): unlesbar, nicht gerechnet.
        { const x = mk('idee', Object.assign({ id: stamp(jetzt()).datum + '-f00a0009', von: 'sitzung/claude/andere', titel: 'Falsch benannt' }, stamp(jetzt()))); hand(x, stamp(jetzt()).datum + '-f00a0010-idee-x.json'); }
        r = werkzeug(d, ['antworte', meinHalt.slice(-4), '--text', 'Ich muss gsEins heute auch anfassen']); if (!id(r)) f.push('Antwort auf meinen Halt nicht geschrieben');
        r = werkzeug(d, ['aufheben', meinBump.slice(-4), '--text', 'main ist wieder gruen, der Bump kann laufen']); const aufhebung = id(r);
        r = werkzeug(d, ['veto', meineLage.slice(-4), '--text', 'b0 gehoert in meinen Umbau']); const vetoLage = id(r);
        r = werkzeug(d, ['veto', altLage.id.slice(-4), '--text', 'die alte Lage war falsch']); const vetoAlt = id(r);
        if (!vetoLage || !vetoAlt) f.push('Aufbau: Vetos gegen meine Lagen nicht geschrieben — ' + kurz(r.aus, 200));
        for (let i = 1; i <= 7; i++) werkzeug(d, ['neu', 'frage', '--an', 'sitzung/claude/ich-arbeit', '--titel', 'Frage ' + i + ' an dich']);
        werkzeug(d, ['neu', 'frage', '--an', 'alle', '--titel', 'Hat claude/ich-arbeit-2 schon gebumpt?']);
        r = werkzeug(d, ['halt', '--geltung', 'gsZwei,bump', '--bis', '6h', '--text', 'andere baut gsZwei um — kein Bump']); const fremdHalt = id(r);
        const fH = mk('halt', Object.assign({ id: stamp(jetzt()).datum + '-f00a0001', von: 'sitzung/claude/dritt', titel: 'Gefaelscht', text: 'im Namen von dritt', geltung: ['bump'], bis: bisIn(5) }, stamp(jetzt())));
        const fL = mk('lage', Object.assign({ id: stamp(jetzt(-23)).datum + '-f00a0002', von: 'sitzung/claude/andere', titel: 'Rueckdatiert', bis: bisIn(0.9), bezug: [{ art: 'baut_auf', id: b[0] }] }, stamp(jetzt(-23))));
        const fV = mk('lage', Object.assign({ id: stamp(jetzt()).datum + '-f00a0003', von: 'sitzung/claude/fremd', titel: 'Fremdes von', bis: bisIn(5), bezug: [{ art: 'baut_auf', id: b[3] }] }, stamp(jetzt())));
        hand(fH); hand(fL); hand(fV);
        // Eine Antwort IN MEINEM NAMEN auf den fremden Halt, abgelegt auf claude/andere: sie ist nicht meine.
        hand(mk('antwort', Object.assign({ id: stamp(jetzt()).datum + '-f00a0004', von: 'sitzung/claude/ich-arbeit', titel: 'Gefaelscht in meinem Namen', text: 'ok von mir', bezug: [{ art: 'baut_auf', id: fremdHalt }] }, stamp(jetzt()))));
        push('claude/andere', 'andere');
        // ── ICH schliesst die Frage, auf die ANDERE geantwortet hat: die Antwort steht danach nicht mehr unter DICH BETREFFEND.
        g(d, ['checkout', '-q', 'claude/ich-arbeit']); g(d, ['fetch', '-q', 'origin']);
        r = werkzeug(d, ['schliesse', fZu.slice(-4), '--ergebnis', 'verworfen', '--text', 'hat sich anders geklaert']); push('claude/ich-arbeit', 'zu');
        // ── DRITT: ein Veto gegen den Bump-Halt von ANDERE.
        g(d, ['checkout', '-q', '-b', 'claude/dritt', 'main']); g(d, ['fetch', '-q', 'origin']);
        r = werkzeug(d, ['veto', fremdHalt.slice(-4), '--text', 'Der Umbau ist schon auf main']); const veto = id(r);
        push('claude/dritt', 'dritt');
        // ── ICH, ohne vorher zu holen: `naechste` holt selbst und haelt am fremden Bump-Halt (mit seinem Veto).
        //    Der Klon kennt claude/andere und claude/dritt noch NICHT (wie eine Sitzung, die nur main geholt hat).
        g(d, ['checkout', '-q', 'claude/ich-arbeit']);
        for (const z of ['claude/andere', 'claude/dritt']) g(d, ['update-ref', '-d', 'refs/remotes/origin/' + z]);
        if (A.brettLesen(d, { alleRefs: true }).eintraege.some(e => e.id === fremdHalt)) f.push('Aufbau: der fremde Halt ist vor `naechste` schon bekannt — der Fall misst das Holen nicht');
        r = werkzeug(d, ['naechste']);
        if (r.code !== 1 || !new RegExp('HALT fuer Bumps: ' + fremdHalt).test(r.aus) || !new RegExp('VETO dagegen: ' + veto).test(r.aus)) f.push('`naechste` ohne vorheriges `holen`: Exit ' + r.code + ' — erwartet 1, mit dem Halt von claude/andere und dem Veto dagegen · ' + kurz(r.aus, 300));
        if (new RegExp(fH.id).test(r.aus)) f.push('`naechste` haelt an einem GEFAELSCHTEN Halt (von claude/dritt, liegt auf claude/andere)');
        r = werkzeug(d, ['naechste', '--json']); let j = null; try { j = JSON.parse(r.aus); } catch (_) {}
        if (r.code !== 1 || !j || !(j.bumpHalt || []).some(h => h.id === fremdHalt && h.vetos.length === 1)) f.push('`naechste --json`: Exit ' + r.code + ', bumpHalt ' + JSON.stringify(j && j.bumpHalt) + ' — erwartet Exit 1 und der Halt mit seinem Veto');
        r = werkzeug(d, ['holen']);
        const dich = block(r.aus, 'DICH BETREFFEND');
        if (!new RegExp('ANTWORT [^\\n]*auf deine Frage ' + rF).test(dich)) f.push('die Antwort auf die Frage der RUNDE erreicht die Sitzung nicht');
        if (!/GELIEFERT docs\/messung\.csv @ [0-9a-f]{12}[^\n]*git show [0-9a-f]{40}:docs\/messung\.csv[^\n]*nach einem Squash-Merge: git show origin\/main:docs\/messung\.csv/.test(dich)) f.push('die Lieferung nennt nicht beide Wege (Commit und, nach einem Squash-Merge, origin/main)');
        if (new RegExp('auf deine Frage ' + fZu).test(dich)) f.push('eine Antwort auf meine GESCHLOSSENE Frage steht weiter unter DICH BETREFFEND');
        if (!/unlesbare Datei[^\n]*f00a0010-idee-x\.json[^\n]*Dateiname passt nicht/.test(r.aus)) f.push('eine Datei, deren Name eine andere id traegt als ihr Inhalt, wird nicht als unlesbar genannt');
        if (!/GEFAEHRDET: \d+ Eintrag\/Eintraege liegen auf nur EINEM Branch/.test(r.aus)) f.push('GEFAEHRDET fehlt, obwohl Eintraege nur auf claude/andere liegen');
        if (!new RegExp('ANTWORT [^\\n]*auf deinen Halt ' + meinHalt).test(dich)) f.push('die Antwort auf meinen Halt steht nicht unter DICH BETREFFEND');
        if (!new RegExp('AUFGEHOBEN dein Halt ' + meinBump + ' durch ' + aufhebung + '[^\\n]*main ist wieder gruen').test(dich)) f.push('die Aufhebung meines Halts (mit Grund) steht nicht unter DICH BETREFFEND');
        if ((dich.match(/AN DICH /g) || []).length !== 6 || !/… \+1 weitere an dich/.test(dich)) f.push('AN DICH: ' + (dich.match(/AN DICH /g) || []).length + ' Zeilen' + (/weitere an dich/.test(dich) ? '' : ', ohne „+N weitere"') + ' — erwartet 6 und „+1 weitere"');
        if (/claude\/ich-arbeit-2/.test(dich)) f.push('AN DICH trifft „claude/ich-arbeit-2" (der eigene Name als Teil eines anderen)');
        if (new RegExp('HALT ' + meinHalt).test(dich)) f.push('der EIGENE Halt steht als fremder unter DICH BETREFFEND');
        if (!new RegExp('VETO ' + vetoLage + '[^\\n]*gegen deinen Eintrag ' + meineLage).test(dich)) f.push('ein Veto gegen meine LAUFENDE Lage steht nicht unter DICH BETREFFEND');
        if (new RegExp('VETO ' + vetoAlt).test(dich)) f.push('ein Veto gegen meine ABGELAUFENE Lage steht weiter unter DICH BETREFFEND');
        if (!new RegExp('HALT ' + fremdHalt + '[^\\n]*beruehrt gsZwei\\(\\)').test(dich)) f.push('der fremde Halt auf gsZwei steht nicht unter DICH BETREFFEND');
        if (new RegExp('HALT ' + fremdHalt + '[^\\n]*du hast geantwortet').test(dich)) f.push('eine Antwort IN MEINEM NAMEN auf einem fremden Branch gilt als meine („du hast geantwortet")');
        const kr = block(r.aus, 'KRITISCH'), la = block(r.aus, 'LAGE'), hv = block(r.aus, 'HALT UND VETO'), be = block(r.aus, 'BEFUNDE');
        if (!new RegExp(kritisch + '[^\\n]*\\[niemand dran\\]').test(kr)) f.push('KRITISCH zeigt den kritischen Befund nicht mit „niemand dran": ' + kurz(kr, 200));
        if (!/sitzung\/claude\/ich-arbeit \(du\)/.test(la)) f.push('LAGE kennzeichnet die eigene Lage nicht: ' + kurz(la, 200));
        if (!new RegExp(fremdHalt + '[^\\n]*Geltung: gsZwei, bump').test(hv) || !new RegExp(veto + '[^\\n]*VETO gegen ' + fremdHalt).test(hv)) f.push('HALT UND VETO zeigt Halt und Veto nicht: ' + kurz(hv, 300));
        if (be.indexOf(dringend) < 0 || be.indexOf(normal) < 0 || be.indexOf(dringend) > be.indexOf(normal)) f.push('„dringend zuerst": der aeltere dringende Befund steht nicht vor dem juengeren normalen');
        if (!/UNWIRKSAM[^\n]*rueckdatiert/.test(r.aus) || !/UNWIRKSAM[^\n]*passt nicht/.test(r.aus)) f.push('die rueckdatierte Lage oder die Lage/der Halt mit fremdem `von` stehen nicht unter UNWIRKSAM: ' + kurz((r.aus.match(/\(\d+ Halt\/Lage UNWIRKSAM[^\n]*/) || [''])[0], 300));
        if (!new RegExp(b[0] + '[^\\n]*uebernommen: sitzung/claude/ich-arbeit').test(r.aus)) f.push('die rueckdatierte Lage stiehlt die Uebernahme von ' + b[0]);
        if (new RegExp(b[3] + '[^\\n]*uebernommen').test(r.aus)) f.push('eine Lage mit fremdem `von` haelt ' + b[3]);
        r = werkzeug(d, ['zeige', meinBump.slice(-4)]); if (!/Wirkt jetzt: nein — aufgehoben durch/.test(r.aus)) f.push('`zeige` sagt fuer den aufgehobenen Halt: ' + ((r.aus.match(/Wirkt jetzt:[^\n]*/) || ['(nichts)'])[0]));
        r = werkzeug(d, ['zeige', fV.id.slice(-4)]); if (!/Wirkt jetzt: nein — „von"/.test(r.aus)) f.push('`zeige` sagt fuer die Lage mit fremdem `von`: ' + ((r.aus.match(/Wirkt jetzt:[^\n]*/) || ['(nichts)'])[0]));
        r = werkzeug(d, ['zeige', fremdHalt.slice(-4)]); if (!/Wirkt jetzt: ja, bis [^\n]*1 Veto/.test(r.aus)) f.push('`zeige` nennt fuer den wirksamen Halt nicht „ja" mit dem Veto: ' + ((r.aus.match(/Wirkt jetzt:[^\n]*/) || ['(nichts)'])[0]));
        r = werkzeug(d, ['zeige', lieferung.slice(-4)]); if (!/Geliefert: docs\/messung\.csv @ [0-9a-f]{40}[^\n]*origin\/main:docs\/messung\.csv/.test(r.aus)) f.push('`zeige` nennt die Lieferung nicht (mit dem Weg ueber origin/main)');
        // Mit Upstream unter anderem Namen (git branch -m nach dem Push) und losgeloest: gesagt.
        g(d, ['branch', '-m', 'claude/ich-umbenannt']);
        r = werkzeug(d, []); if (!/sein Upstream origin\/claude\/ich-arbeit/.test(r.aus)) f.push('ein Upstream unter anderem Namen wird nicht genannt');
        g(d, ['branch', '-m', 'claude/ich-arbeit']);
        g(d, ['checkout', '-q', '--detach']);
        r = werkzeug(d, []); if (!/Wer du bist, ist nicht ablesbar/.test(r.aus)) f.push('losgeloester HEAD: kein Hinweis, dass eigene Eintraege als fremde zaehlen');
        g(d, ['checkout', '-q', 'claude/ich-arbeit']);
        // A8: der fremde Halt auf einem NICHT gemergten Branch, im PR-Merge-Commit gerechnet.
        g(d, ['checkout', '-q', '-b', 'pr-merge', 'origin/main']); g(d, ['merge', '-q', '--no-ff', '--no-edit', 'origin/claude/ich-arbeit']);
        const a8 = A.haltsDiesesStands(d, { GITHUB_EVENT_NAME: 'pull_request', GITHUB_HEAD_REF: 'claude/ich-arbeit' });
        const a8ids = (a8.treffer || []).map(x => x.h.e.id);
        if (a8.grund || a8ids.indexOf(fremdHalt) < 0 || a8ids.indexOf(meinHalt) >= 0 || a8ids.indexOf(veto) >= 0) f.push('A8 im PR: ' + (a8.grund || a8ids.join()) + ' — erwartet der fremde Halt auf claude/andere, nicht der eigene, kein Veto');
        g(d, ['checkout', '-q', 'claude/ich-arbeit']);
        // `ernten`: eine Lage bleibt liegen; ein fremder kritischer Eintrag erst, wenn STATUS §2 ihn zitiert.
        g(d, ['checkout', '-q', 'claude/andere']);
        r = werkzeug(d, ['neu', 'befund', '--dringlichkeit', 'kritisch', '--titel', 'Live: Anmeldung bricht ab', '--beleg', 'gemessen: 3 von 3']); const fremdKrit = id(r);
        push('claude/andere', 'kritisch');
        g(d, ['checkout', '-q', '-b', 'claude/ernte', 'main']); g(d, ['fetch', '-q', 'origin']);
        r = werkzeug(d, ['ernten']);
        if (!new RegExp(fremdKrit + '[^\\n]*kritisch, aber').test(r.aus) || !new RegExp(fL.id + '[^\\n]*Absicht').test(r.aus)) f.push('`ernten` laesst den unzitierten kritischen Eintrag oder die Lage nicht mit Grund liegen · ' + kurz(r.aus, 300));
        fs.writeFileSync(path.join(d, 'STATUS.md'), '# STATUS\n\n## 2 · Offen\n\n- brett:' + fremdKrit + ' — Anmeldung\n');
        r = werkzeug(d, ['ernten']);
        const geerntet = fs.existsSync(path.join(d, A.ORDNER, fremdKrit.slice(0, 7))) && fs.readdirSync(path.join(d, A.ORDNER, fremdKrit.slice(0, 7))).some(n => n.indexOf(fremdKrit + '-') === 0);
        if (!geerntet || new RegExp(fremdKrit + '[^\\n]*kritisch, aber').test(r.aus)) f.push('`ernten` holt den kritischen Eintrag nicht, obwohl STATUS §2 ihn zitiert · ' + kurz(r.aus, 300));
        g(d, ['checkout', '-q', '-f', 'claude/ich-arbeit']); g(d, ['clean', '-q', '-fd']);
        // „in Arbeit": ein squash-gemergter, stehengebliebener Branch zaehlt nicht; ein Commit, der vier ids nennt, auch nicht.
        g(d, ['checkout', '-q', '-b', 'claude/squash', 'main']); fs.writeFileSync(path.join(d, 'notiz.md'), 'x\n');
        g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'Arbeit an ' + b[4]]); g(d, ['push', '-q', 'origin', 'claude/squash']);
        g(d, ['checkout', '-q', 'main']); fs.writeFileSync(path.join(d, 'notiz.md'), 'x\n'); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'squash']); g(d, ['push', '-q', 'origin', 'main']);
        g(d, ['checkout', '-q', '-b', 'claude/liste', 'main']); fs.writeFileSync(path.join(d, 'liste.md'), 'y\n');
        g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'Liste: ' + b.slice(1, 5).join(' ')]); g(d, ['push', '-q', 'origin', 'claude/liste']);
        g(d, ['checkout', '-q', 'claude/ich-arbeit']); g(d, ['fetch', '-q', 'origin']);
        const ia = A.inArbeitAusGit(d, A.brettLesen(d, { alleRefs: true }).eintraege, Date.now(), 14, A.brettLesen(d, { alleRefs: true }).wo);
        const ref = (i) => (ia.get(b[i]) || []).map(x => x.ref).join();
        if (/squash/.test(ref(4))) f.push('ein squash-gemergter, stehengebliebener Branch zaehlt als „in Arbeit" (' + ref(4) + ')');
        if (/liste/.test(ref(1) + ref(2) + ref(3) + ref(4))) f.push('ein Commit, der vier ids nennt, markiert sie als „in Arbeit"');
        // `einspielen`: ein Halt auf einen Namen, den es nicht gibt, und eine Lage mit eigenem Datum werden abgewiesen.
        const st = path.join(eltern, 'stapel.json');
        fs.writeFileSync(st, JSON.stringify([{ art: 'halt', titel: 'Halt ueber einspielen', text: 'x', bis: bisIn(5), geltung: ['gsGibtsNicht'] }]));
        r = werkzeug(d, ['einspielen', st]); if (r.code !== 1 || !/traefe nie/.test(r.aus)) f.push('`einspielen` nimmt einen Halt auf einen Namen an, den es nicht gibt (Exit ' + r.code + ')');
        fs.writeFileSync(st, JSON.stringify([{ art: 'halt', titel: 'Halt mit Tippfehler', text: 'x', bis: bisIn(5), geltung: ['scripts/kalendr_check.js'] }]));
        r = werkzeug(d, ['einspielen', st]); if (r.code !== 1 || !/diesen Pfad gibt es im Baum nicht/.test(r.aus)) f.push('ein Halt auf einen Pfad mit Tippfehler wird angenommen (Exit ' + r.code + ')');
        fs.writeFileSync(st, JSON.stringify([{ art: 'lage', titel: 'Lage mit Datum', phase: 'laeuft', datum: '2026-01-01', zeit: '01:00:00', bis: '2026-01-01T02:00:00Z' }]));
        r = werkzeug(d, ['einspielen', st]); if (r.code !== 1 || !/setzt das Werkzeug/.test(r.aus)) f.push('`einspielen` nimmt eine Lage mit eigenem Datum an (Exit ' + r.code + ')');
        // Laufzeit: 400 verankerte Befunde auf einem fremden Branch, dort index.html geloescht — vorher ein `git log -S` je
        // Eintrag (1 200: 49 s) und 400 falsche „in Arbeit"; ein fremder Anker beschreibt den fremden Baum.
        g(d, ['checkout', '-q', '-b', 'claude/anker', 'main']); g(d, ['rm', '-q', 'index.html']);
        for (let i = 0; i < 400; i++) hand(mk('befund', Object.assign({ id: stamp(jetzt(-1)).datum + '-a' + String(i).padStart(7, '0'), von: 'sitzung/claude/anker', titel: 'Anker ' + i, anker: [{ datei: 'index.html', text: 'function gsZwei(){ return gsEins() + gsEins(); }' }] }, stamp(jetzt(-1)))));
        push('claude/anker', 'anker'); g(d, ['checkout', '-q', 'claude/ich-arbeit']);
        { const t1 = Date.now(), bl = A.brettLesen(d, { alleRefs: true }), ia2 = A.inArbeitAusGit(d, bl.eintraege, Date.now(), 14, bl.wo), ms = Date.now() - t1;
          const falsch = [...ia2].filter(([k, v]) => /-a\d{7}$/.test(k) && v.some(x => /anker/.test(x.ref))).length;
          if (ms > 6000 || falsch) f.push('400 verankerte Eintraege auf einem fremden Branch: ' + ms + ' ms, ' + falsch + '× „in Arbeit auf claude/anker" — erwartet schnell und keiner'); }
        // Der eigene Branch verschwindet auf origin: gesagt — auch wenn eine Sicherungskopie seine Eintraege traegt
        // (sie ist kein Branch und verdeckte sonst „nur in diesem Arbeitsbaum").
        g(d, ['push', '-q', 'origin', 'claude/ich-arbeit:zz-sicherung']);
        g(d, ['push', '-q', 'origin', '--delete', 'claude/ich-arbeit']);
        r = werkzeug(d, ['holen']); if (!/Dein Branch claude\/ich-arbeit fehlt auf origin/.test(r.aus)) f.push('der eigene, auf origin geloeschte Branch wird nicht gesagt');
        if (!/liegen NUR in diesem Arbeitsbaum/.test(r.aus)) f.push('die Sicherungskopie verdeckt „liegen NUR in diesem Arbeitsbaum"');
        // Das Beispiel in `hilfe halt` laesst sich im ECHTEN Repo schreiben (es stand dort „index.html,bump" — abgelehnt).
        const bsp = (werkzeug(WURZEL, ['hilfe', 'halt']).aus.match(/--geltung "([^"]+)"/) || [])[1] || '';
        const bspF = bsp.split(',').map(x => A.geltungFehler(x)).filter(Boolean).concat(A.geltungImBaum(WURZEL, bsp.split(',')));
        if (!bsp || bspF.length) f.push('das Beispiel in `hilfe halt` („' + bsp + '") wird vom Werkzeug abgelehnt: ' + bspF.join(' · '));
        if (f.length) return { ok: false, warum: f.join(' · ') };
        return { ok: true, info: 'vier Branches: Runde → von = Sitzung, rolle = runde/…; Antworten auf Runde und Halt, Aufhebung, AN DICH 6 + „+1", ganzes Wort; gefaelschter Halt, rueckdatierte Lage, fremdes von UNWIRKSAM; zeige = Brett; naechste holt selbst, Veto, JSON Exit 1; KRITISCH/LAGE (du)/HALT UND VETO/dringend zuerst; 3 Uebernahmen, --von koordinator abgewiesen; STATUS-Zeile, push -u; Upstream, losgeloest, geloeschter Branch gesagt; A8 im PR; ernten; in Arbeit (Squash, Liste); einspielen pruefen Geltung und Datum; hilfe-Beispiel schreibbar' };
      } catch (e) { return { ok: false, warum: 'Ausnahme: ' + String(e.message).split('\n')[0] }; } finally { weg(eltern); }
    },
  },
  {
    name: 'C13 · Waechter und Sicherung · Waechter 1 rechnet gegen die Abzweigstelle (lokal merge-base, im PR die Basis-Seite des Merge-Commits) und sieht ein geloeschtes oder umgeschriebenes Eintragsfile (ausser per Grabstein); der ECHTE Schritt aus .github/workflows/brett-waechter.yml, gefahren wie auf GitHub (frischer flacher Klon, saubere Shell, Cache als Gedaechtnis): baut den Stand aus dem Nichts, sichert JEDE Fassung byte-gleich und ohne Geheimnis, aendert auf origin NUR zz-sicherung, wird ROT, wenn eine Fassung nur noch hier liegt (auch wenn eine kaputte oder gefaelschte Kopie anderswo liegt, auch wenn ALLE Branches weg sind) und wenn die Sicherung zurueckgesetzt wurde — nicht nach einem abgelehnten Push; ein Grabstein verschwindet samt Geschichte',
    lauf: () => {
      const eltern = tmp('waechter'), bare = path.join(eltern, 'origin.git'), d = path.join(eltern, 'klon'), cache = path.join(eltern, 'cache');
      try {
        const f = [];
        const yml = lies('.github/workflows/brett-waechter.yml');
        // Die Action, gelesen.
        if (!/^permissions: \{\}$/m.test(yml)) f.push('brett-waechter.yml: permissions: {} auf Workflow-Ebene fehlt');
        if (!/permissions:\n\s+contents: write\n/.test(yml) || /pull-requests|issues|actions: write/.test(yml)) f.push('brett-waechter.yml: der Job braucht genau contents: write');
        if (!/cron: '\d+ \* \* \* \*'/.test(yml)) f.push('brett-waechter.yml: kein stuendlicher Zeitplan');
        // Fuehrende Leerzeichen EINDEUTIG (eine Zeile beginnt mit einem Nicht-Leerzeichen): mit „ {8,}[^\n]*" teilten sich zwei
        // Teile dieselben Leerzeichen, und fehlte die Zeile, sprang der Ausdruck exponentiell zurueck (12 Zeilen: ueber 120 s).
        if (!/uses: actions\/checkout@[0-9a-f]{40}[^\n]*\n(?: {8,}[^ \n][^\n]*\n)*? {10}persist-credentials: false\n/.test(yml)) f.push('brett-waechter.yml: checkout ohne persist-credentials: false — der Token laege in .git/config, waehrend das Werkzeug fremde Branches liest');
        if ([...yml.matchAll(/uses: ([^\s]+)/g)].some(m => !/@[0-9a-f]{40}$/.test(m[1]))) f.push('brett-waechter.yml: eine Action ist nicht auf einen Commit festgelegt');
        if (!/name: Gedaechtnis ablegen\n\s+if: always\(\)\n\s+uses: actions\/cache\/save@/.test(yml) || !/uses: actions\/cache\/restore@/.test(yml)) f.push('brett-waechter.yml: das Gedaechtnis wird nicht geholt oder nicht IMMER abgelegt (auch nach einem Alarm)');
        if (/git config[^\n]*(extraheader|credential)/.test(yml)) f.push('brett-waechter.yml: Zugangsdaten per git config — nur `-c` am einzelnen Aufruf');
        const schritt = ((yml.match(/name: Sicherung schreiben und melden\n(?: +env:\n(?: {10}[^\n]*\n)+)? +run: \|\n((?: {10}[^\n]*\n|\n)+)/) || [])[1] || '').replace(/^ {10}/gm, '');
        const pushes = [...schritt.matchAll(/\bpush\b[^\n]*/g)].map(m => m[0]);
        if (!pushes.length || pushes.some(x => !/--force-with-lease="refs\/heads\/zz-sicherung:\$ALT" origin "\$NEU:refs\/heads\/zz-sicherung"$/.test(x))) f.push('brett-waechter.yml: jeder push geht mit --force-with-lease nach refs/heads/zz-sicherung — gefunden: ' + pushes.join(' | '));
        if (!/commit-tree "\$TREE"/.test(schritt)) f.push('brett-waechter.yml: kein Orphan-Commit (commit-tree) — die Sicherung behielte ihre Geschichte, und ein Grabstein bliebe darin lesbar');
        if (!/node scripts\/austausch\.mjs sichern --alt "\$\{ALT:-leer\}" --baum /.test(schritt)) return { ok: false, warum: f.concat('der Schritt „Sicherung schreiben und melden" ist nicht lesbar').join(' · ') };
        const iUnset = schritt.indexOf('unset GH_TOKEN'), iNode = schritt.indexOf('node scripts/austausch.mjs');
        if (iUnset < 0 || iUnset > iNode) f.push('brett-waechter.yml: GH_TOKEN liegt noch in der Umgebung, wenn das Werkzeug fremde Branches liest');
        const iPush = schritt.indexOf('kopf push'), iMv = schritt.search(/mv "\$RUNNER_TEMP\/brett-stand-neu\.json" "\$STAND"/);
        if (iMv < 0 || iMv < iPush) f.push('brett-waechter.yml: das Gedaechtnis wird VOR dem Push abgelegt — ein abgelehnter Push gaebe beim naechsten Lauf einen Fehlalarm');
        // Ein gebautes origin mit dem ECHTEN Werkzeug auf main.
        cp.execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare]);
        fs.mkdirSync(d); g(d, ['init', '-q', '-b', 'main', '.']); g(d, ['remote', 'add', 'origin', 'file://' + bare]);
        fs.mkdirSync(path.join(d, 'scripts'));
        for (const n of ['austausch.mjs', '_austausch.mjs']) fs.copyFileSync(path.join(__dirname, n), path.join(d, 'scripts', n));
        fs.writeFileSync(path.join(d, 'index.html'), QUELLE);
        const m1 = mk('befund', { id: '2026-01-01-1111', titel: 'Auf main von Anfang an' }), m2 = mk('idee', { id: '2026-01-02-2222', datum: '2026-01-02', titel: 'Spaeter auf main' });
        const s1 = mk('frage', { id: '2026-01-03-3333', datum: '2026-01-03', von: 'sitzung/claude/s1', titel: 'Nur auf claude/s1' }), geheim = mk('frage', { id: '2026-01-03-4444', datum: '2026-01-03', titel: 'Traegt ein Geheimnis', text: 'token ' + 'gh' + 'p_' + 'A'.repeat(24) });
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
        fs.writeFileSync(path.join(d, A.GRABSTEINE), JSON.stringify([{ id: m1.id, blob: cp.execFileSync('git', ['hash-object', '--stdin'], { input: roh1, encoding: 'utf8' }).trim(), datum: '2026-01-04', grund: 'diese eine Fassung' }], null, 2) + '\n');
        w = A.geloeschtSeit(d, basis); if (w.fehlt.length) f.push('Waechter 1 meldet die Loeschung einer Fassung, deren Grabstein (blob) auf der Liste steht');
        if (A.grabsteinePruefen(JSON.stringify([{ id: m1.id, blob: 'abc', datum: '2026-01-04', grund: 'x' }])).fehler.length !== 1) f.push('ein Grabstein mit unvollstaendiger blob-Kennung wird angenommen');
        fs.writeFileSync(p1, roh1);
        if (!A.brettLesen(d, { alleRefs: false }).grabDateien.length || !A.brettPruefen(A.brettLesen(d, { alleRefs: false })).some(x => /Grabstein-Liste[^]*liegt noch hier/.test(x.grund))) f.push('eine Datei mit Grabstein, die noch im Baum liegt, ist kein Fehler');
        fs.unlinkSync(path.join(d, A.GRABSTEINE));
        if (A.grabsteinePruefen(JSON.stringify([{ id: m1.id, datum: '2026-01-04', grund: 'x', inhalt: 'Max' }])).fehler.length !== 1) f.push('ein Grabstein mit Inhalt wird angenommen');
        // Genau EIN Ref ist die Sicherung — nicht jeder Branch, der auf „/zz-sicherung" endet.
        if (!A.istSicherungsRef('origin/zz-sicherung') || A.istSicherungsRef('origin/claude/zz-sicherung') || A.istSicherungsRef('refs/remotes/origin/feature/zz-sicherung')) f.push('istSicherungsRef: claude/zz-sicherung gilt als die Sicherung — seine Eintraege wuerden nie gesichert');
        // Genau origin — ein zweites Remote ist fremde Eingabe; und main ist GENAU origin/main (Gegenpruefung 3: „claude/main" galt als main).
        if (A.istSicherungsRef('fork/zz-sicherung')) f.push('istSicherungsRef: fork/zz-sicherung (ein zweites Remote) gilt als die Sicherung');
        if (!A.istMainRef('origin/main') || !A.istMainRef('refs/remotes/origin/main') || A.istMainRef('origin/claude/main') || A.istMainRef('origin/test/main') || A.istMainRef('fork/main') || A.istMainRef('main')) f.push('istMainRef: ein Branch, der auf „/main" endet, oder fork/main gilt als main — Faelschungen dort gaelten fuer alle Leser');
        // Der Schritt der Action, gefahren wie auf GitHub: frischer flacher Klon von main, saubere Shell,
        // RUNNER_TEMP als Cache (bleibt zwischen den Laeufen, wie actions/cache). Ein `node` vorn im PATH
        // protokolliert, ob das Werkzeug den Token in seiner Umgebung sieht.
        fs.mkdirSync(cache); const leer = path.join(eltern, 'gitconfig'); fs.writeFileSync(leer, '');
        const bin = path.join(eltern, 'bin'), tokenLog = path.join(eltern, 'token.log'); fs.mkdirSync(bin);
        fs.writeFileSync(path.join(bin, 'node'), '#!/bin/bash\nif [ -n "${GH_TOKEN:-}" ]; then echo gesehen >> "' + tokenLog + '"; fi\nexec "' + process.execPath + '" "$@"\n', { mode: 0o755 });
        let lauf = 0;
        const remote = () => g(d, ['ls-remote', 'origin']).split('\n').filter(z => z && !/refs\/heads\/zz-sicherung$/.test(z)).sort().join('\n');
        const action = () => {
          const ws = path.join(eltern, 'lauf' + (++lauf), 'ws'); fs.mkdirSync(ws, { recursive: true });
          const env = Object.assign({}, process.env, { PATH: bin + ':' + process.env.PATH, GIT_CONFIG_GLOBAL: leer, GIT_CONFIG_NOSYSTEM: '1', GH_TOKEN: 'unbenutzt', RUNNER_TEMP: cache, GITHUB_STEP_SUMMARY: path.join(eltern, 'zusammenfassung.md'), AUSTAUSCH_WURZEL: '', AUSTAUSCH_VON: '' });
          for (const a of [['init', '-q', '-b', 'main', '.'], ['remote', 'add', 'origin', 'file://' + bare], ['fetch', '-q', '--depth=1', 'origin', '+refs/heads/main:refs/remotes/origin/main'], ['checkout', '-q', '-B', 'main', 'refs/remotes/origin/main']]) cp.execFileSync('git', a, { cwd: ws, env, stdio: 'ignore' });
          const vor = remote();
          const x = cp.spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', schritt], { cwd: ws, encoding: 'utf8', env });
          g(d, ['fetch', '-q', '--prune', 'origin', '+refs/heads/*:refs/remotes/origin/*']);
          if (remote() !== vor) f.push('Lauf ' + lauf + ': auf origin hat sich mehr als zz-sicherung geaendert');
          return { code: x.status, aus: (x.stdout || '') + (x.stderr || '') };
        };
        const zz = (args) => { try { return g(d, args); } catch (_) { return ''; } };
        const baumZz = () => zz(['ls-tree', '-r', 'origin/zz-sicherung']);
        const gesichert = () => zz(['ls-tree', '-r', '--name-only', 'origin/zz-sicherung', '--', A.ORDNER]).split('\n').filter(n => /\.json$/.test(n)).map(n => path.posix.basename(n).slice(0, 15)).sort().join();
        const fassungen = (id) => zz(['ls-tree', '-r', '--name-only', 'origin/zz-sicherung', '--', A.FASSUNGEN + '/' + id]).split('\n').filter(Boolean);
        const neuerZweig = (name, eintraege, von) => { g(d, ['checkout', '-q', '-B', name, von || 'origin/main']); for (const [e, n] of eintraege) ablegen(d, e, n); g(d, ['add', '-A']); g(d, ['commit', '-q', '--allow-empty', '-m', name]); g(d, ['push', '-q', '-f', 'origin', name]); g(d, ['checkout', '-q', '--detach', 'origin/main']); };   // gelesen wird danach aus einem neutralen Baum
        const loesche = (...namen) => { for (const n of namen) { g(d, ['push', '-q', 'origin', '--delete', n]); } g(d, ['checkout', '-q', '--detach']); for (const n of namen) { try { g(d, ['branch', '-q', '-D', n]); } catch (_) {} } };
        // 1. Erster Lauf: m1, m2, s1 gesichert, das Geheimnis nicht; ohne Sicherung UND ohne Gedaechtnis sagt er es.
        let a = action();
        if (a.code !== 0 || gesichert() !== '2026-01-01-1111,2026-01-02-2222,2026-01-03-3333') f.push('erster Lauf: Exit ' + a.code + ', gesichert „' + gesichert() + '" — erwartet m1, m2, s1 (das Geheimnis nicht) · ' + kurz(a.aus, 300));
        if (!/Weder zz-sicherung noch ein Gedaechtnis/.test(a.aus)) f.push('erster Lauf (weder Sicherung noch Gedaechtnis) sagt nicht, dass dann nicht erkennbar ist, was fehlt');
        if (zz(['show', 'origin/zz-sicherung:' + A.ORDNER + '/2026-01/2026-01-03-3333-frage-x.json']) !== JSON.stringify(s1, null, 2) + '\n') f.push('die Sicherung ist nicht byte-gleich mit dem Eintrag auf claude/s1');
        if (!/Nicht gesichert[^\n]*2026-01-03-4444/.test(a.aus)) f.push('der Eintrag mit Geheimnis wird nicht als „nicht gesichert" genannt');
        if (/Nur auf claude\/s1|Auf main von Anfang an|Spaeter auf main/.test(a.aus)) f.push('der Bericht (oeffentlich: Step-Summary und Log) nennt Titel — ein Grabstein erreicht ihn nicht');
        if (fs.existsSync(tokenLog)) f.push('das Werkzeug sieht GH_TOKEN in seiner Umgebung');
        const kopf1 = zz(['rev-parse', 'origin/zz-sicherung']).trim();
        a = action();
        if (a.code !== 0 || zz(['rev-parse', 'origin/zz-sicherung']).trim() !== kopf1 || !/Nichts Neues zu sichern/.test(a.aus)) f.push('zweiter Lauf ohne Aenderung: Exit ' + a.code + ' — neuer Commit oder Meldung fehlt · ' + kurz(a.aus, 200));
        // Gelesen wird die Sicherung ZULETZT: was auch auf main liegt, kommt von main.
        const bm = A.brettLesen(d, { alleRefs: true }).eintraege.find(e => e.id === m2.id);
        if (!bm || A.istSicherungsRef(bm._quelle)) f.push('m2 liegt auf main UND in der Sicherung — gelesen wurde ' + (bm ? bm._quelle : 'nichts'));
        // 2. Der AUTOR schreibt s1 auf seinem Branch um: fuer Leser gilt seine Fassung (die Sicherung ist keine Partei —
        //    vorher war der Eintrag „strittig" und fuer alle weg); unter eintraege/ liegt jetzt die NEUE (die, die gilt —
        //    vorher die erste, und nach dem Loeschen holte `ernten` den veralteten Stand), die erste unter fassungen/.
        const d2 = path.join(eltern, 'anderer'); cp.execFileSync('git', ['clone', '-q', 'file://' + bare, d2]);
        g(d2, ['checkout', '-q', 'claude/s1']);
        const ps1 = path.join(d2, A.ORDNER, '2026-01', '2026-01-03-3333-frage-x.json'), roh = fs.readFileSync(ps1, 'utf8');
        fs.writeFileSync(ps1, roh.replace('Nur auf claude/s1', 'Umgeschrieben auf claude/s1')); g(d2, ['commit', '-q', '-am', 'umgeschrieben']); g(d2, ['push', '-q', 'origin', 'claude/s1']);
        a = action();
        const umgeschrieben = roh.replace('Nur auf claude/s1', 'Umgeschrieben auf claude/s1'), blobRoh = cp.execFileSync('git', ['hash-object', '--stdin'], { input: roh, encoding: 'utf8' }).trim();
        if (a.code !== 0 || !/Weitere Fassung[^\n]*2026-01-03-3333/.test(a.aus) || zz(['show', 'origin/zz-sicherung:' + A.ORDNER + '/2026-01/2026-01-03-3333-frage-x.json']) !== umgeschrieben || fassungen(s1.id).join() !== A.FASSUNGEN + '/' + s1.id + '/' + blobRoh + '.json') f.push('der Autor schreibt s1 um: Exit ' + a.code + ', unter eintraege/ liegt nicht die NEUE Fassung (die gilt) oder die erste fehlt unter fassungen/ (' + fassungen(s1.id).join() + ') · ' + kurz(a.aus, 200));
        let bl = A.brettLesen(d, { alleRefs: true }), es1 = bl.eintraege.find(e => e.id === s1.id);
        if (!es1 || es1.titel !== 'Umgeschrieben auf claude/s1' || bl.strittig.length) f.push('fuer Leser gilt nach der Berichtigung des Autors ' + (es1 ? '„' + es1.titel + '" {' + es1._quelle + '}' : 'NICHTS') + (bl.strittig.length ? ' (strittig: ' + bl.strittig.map(x => x.id).join() + ')' : '') + ' — erwartet seine Fassung');
        // 3. Eine Kopie mit EINEM geaenderten Byte auf einem DRITTEN Branch nimmt dem Original nichts (vorher: beide weg, fuer alle).
        neuerZweig('claude/0-faelschung', [[roh.replace('Nur auf claude/s1', 'Nur auf claude/s1.'), '2026-01-03-3333-frage-x.json']]);
        // … auch nicht eine, die ihr `von` auf den EIGENEN Branch umschreibt (vorher: das Original STRITTIG, nach dem Loeschen
        // gewann die Faelschung, und der Alarm blieb aus), und nicht eine auf einem Branch namens claude/main (vorher: main).
        neuerZweig('claude/0-faelscher', [[JSON.stringify(Object.assign(JSON.parse(roh), { von: 'sitzung/claude/0-faelscher', titel: 'Gefaelscht mit eigenem von' }), null, 2) + '\n', '2026-01-03-3333-frage-x.json']]);
        neuerZweig('claude/main', [[JSON.stringify(Object.assign(JSON.parse(roh), { titel: 'Gefaelscht auf claude/main' }), null, 2) + '\n', '2026-01-03-3333-frage-x.json']]);
        // … und nicht derselbe Branch-Name auf einem ZWEITEN Remote (fork/claude/s1).
        const forkBare = path.join(eltern, 'fork.git'); cp.execFileSync('git', ['init', '-q', '--bare', '-b', 'main', forkBare]);
        g(d, ['remote', 'add', 'fork', 'file://' + forkBare]);
        g(d, ['checkout', '-q', '-B', 'fork-s1', 'origin/main']); ablegen(d, JSON.parse(roh.replace('Nur auf claude/s1', 'Gefaelscht auf fork')), '2026-01-03-3333-frage-x.json'); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'fork']);
        g(d, ['push', '-q', 'fork', 'fork-s1:claude/s1']); g(d, ['checkout', '-q', '--detach', 'origin/main']); g(d, ['fetch', '-q', 'fork']);
        bl = A.brettLesen(d, { alleRefs: true }); es1 = bl.eintraege.find(e => e.id === s1.id);
        if (!es1 || es1.titel !== 'Umgeschrieben auf claude/s1' || bl.strittig.some(x => x.id === s1.id) || !['0-faelschung', '0-faelscher', 'claude/main', 'fork/claude/s1'].every(n => bl.abweichend.some(x => x.id === s1.id && x.weichtAb.indexOf(n) >= 0))) f.push('Faelschungen (dritter Branch, eigenes von, claude/main, fork/claude/s1): fuer Leser gilt ' + (es1 ? '„' + es1.titel + '" {' + es1._quelle + '}' : 'NICHTS') + (bl.strittig.length ? ' (strittig: ' + bl.strittig.map(x => x.id).join() + ')' : '') + ' — erwartet weiter die Fassung des Autors, jede Faelschung als abweichend genannt');
        g(d, ['remote', 'remove', 'fork']);
        a = action();
        if (a.code !== 0 || fassungen(s1.id).length !== 4) f.push('die gefaelschten Fassungen werden nicht zusaetzlich gesichert (' + fassungen(s1.id).length + ' unter fassungen/, erwartet 4) · Exit ' + a.code);
        loesche('claude/0-faelschung');
        a = action();
        if (a.code !== 0) f.push('die Faelschung verschwindet, der Autor-Branch traegt den Eintrag: Exit ' + a.code + ' — kein Alarm erwartet · ' + kurz(a.aus, 200));
        fs.writeFileSync(ps1, roh); g(d2, ['commit', '-q', '-am', 'zurueck']); g(d2, ['push', '-q', 'origin', 'claude/s1']);
        a = action();
        // Ruecknahme (oder Force-Push auf einen aelteren Stand): kein Alarm — aber gesagt, und nie „Nichts verloren".
        if (a.code !== 0 || !/Zurueckgenommen\?[^\n]*2026-01-03-3333/.test(a.aus) || /Nichts verloren/.test(a.aus)) f.push('der Autor nimmt seine Berichtigung zurueck (oder ein Force-Push setzt zurueck): Exit ' + a.code + ' — erwartet 0, „Zurueckgenommen?" mit der id und KEIN „Nichts verloren" · ' + kurz(a.aus, 200));
        if (zz(['show', 'origin/zz-sicherung:' + A.ORDNER + '/2026-01/2026-01-03-3333-frage-x.json']) !== roh) f.push('nach der Ruecknahme liegt unter eintraege/ nicht die Fassung, die jetzt gilt');
        // Eine abweichende Kopie mit DEMSELBEN von auf einem dritten Branch, die beim Loeschen des Autor-Branches noch liegt.
        neuerZweig('claude/0-kopie', [[roh.replace('Nur auf claude/s1', 'Kopie auf claude/0-kopie'), '2026-01-03-3333-frage-x.json']]);
        a = action();
        // 4. Der Branch des Autors wird geloescht: ALARM (einmal), jede Fassung von s1 liegt nur noch in der Sicherung.
        const s1Kopf = zz(['rev-parse', 'origin/claude/s1']).trim();
        loesche('claude/s1');
        a = action();
        // Die Kopien (gleiches von auf claude/0-kopie, eigenes von auf claude/0-faelscher, claude/main) verdecken den Verlust NICHT,
        // und fuer Leser gilt die Sicherung — nicht strittig, nicht die Faelschung.
        if (a.code !== 3 || !/ALARM:[^\n]*Branch wurde geloescht[^\n]*2026-01-03-3333/.test(a.aus) || !/NUR NOCH IN DER SICHERUNG: 1\b/.test(a.aus)) f.push('geloeschter Branch (Kopien liegen noch auf drei anderen Branches): Exit ' + a.code + ' (erwartet 3) — ' + kurz(a.aus, 300));
        bl = A.brettLesen(d, { alleRefs: true }); es1 = bl.eintraege.find(e => e.id === s1.id);
        if (!es1 || !A.istSicherungsRef(es1._quelle) || es1.titel !== 'Nur auf claude/s1' || bl.strittig.some(x => x.id === s1.id)) f.push('nach dem Loeschen des Autor-Branches gilt fuer Leser ' + (es1 ? '„' + es1.titel + '" {' + es1._quelle + '}' : 'NICHTS') + (bl.strittig.some(x => x.id === s1.id) ? ' (strittig)' : '') + ' — erwartet die gesicherte Fassung');
        loesche('claude/0-kopie', 'claude/0-faelscher', 'claude/main');
        a = action();
        a = action();
        if (a.code !== 0) f.push('derselbe Verlust ein zweites Mal: Exit ' + a.code + ' — ein Alarm gilt EINMAL je Verlust');
        // `holen` holt mit --prune: ein veralteter Ref auf den geloeschten Branch verschwindet, GERETTET erscheint.
        g(d, ['checkout', '-q', '-B', 'claude/rettung', 'origin/main']); g(d, ['update-ref', 'refs/remotes/origin/claude/s1', s1Kopf]);
        let r = werkzeug(d, ['holen']);
        if (!/GERETTET: 1 Eintrag\/Eintraege liegen NUR noch in der Sicherung/.test(r.aus) || zz(['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/claude/s1'])) f.push('`holen` raeumt den veralteten Ref auf claude/s1 nicht ab (--prune) oder sagt nicht GERETTET');
        // Grabstein NUR auf origin/main (dieser Arbeitsbaum kennt die Liste noch nicht): ernten holt ihn nicht.
        g(d2, ['checkout', '-q', 'main']); g(d2, ['pull', '-q', 'origin', 'main']);
        fs.writeFileSync(path.join(d2, A.GRABSTEINE), JSON.stringify([{ id: s1.id, datum: '2026-01-05', grund: 'Personenname im Titel' }], null, 2) + '\n');
        g(d2, ['add', '-A']); g(d2, ['commit', '-q', '-m', 'grabstein']); g(d2, ['push', '-q', 'origin', 'main']);
        g(d, ['fetch', '-q', 'origin']);
        r = werkzeug(d, ['ernten']);
        if (fs.existsSync(path.join(d, A.ORDNER, '2026-01', '2026-01-03-3333-frage-x.json'))) f.push('`ernten` holt einen Eintrag zurueck, dessen Grabstein nur auf origin/main liegt');
        const blob = cp.execFileSync('git', ['hash-object', '--stdin'], { input: roh, encoding: 'utf8' }).trim();
        a = action();
        if (a.code !== 0 || /3333/.test(baumZz()) || !/Entfernt \(Grabstein\): 2026-01-03-3333/.test(a.aus)) f.push('Grabstein: Exit ' + a.code + ', eine Fassung von s1 noch in der Sicherung oder nicht als entfernt gemeldet · ' + kurz(a.aus, 200));
        if (zz(['rev-list', '--objects', 'origin/zz-sicherung']).indexOf(blob) >= 0) f.push('der Grabstein-Eintrag ist aus zz-sicherung noch ERREICHBAR (Geschichte) — die Sicherung muss je Lauf ein Stand ohne Geschichte sein');
        if (zz(['rev-list', '--count', 'origin/zz-sicherung']).trim() !== '1') f.push('zz-sicherung hat Geschichte: ' + zz(['rev-list', '--count', 'origin/zz-sicherung']).trim() + ' Commits');
        // 5. Die Sicherung wird zurueckgesetzt (geloescht): ALARM, und sie wird neu geschrieben.
        g(d2, ['push', '-q', 'origin', '--delete', 'zz-sicherung']);
        a = action();
        if (a.code !== 3 || !/ALARM:[^\n]*zurueckgesetzt oder geloescht/.test(a.aus) || gesichert() !== '2026-01-01-1111,2026-01-02-2222') f.push('zurueckgesetzte Sicherung: Exit ' + a.code + ' (erwartet 3), neu gesichert „' + gesichert() + '" · ' + kurz(a.aus, 300));
        // Ohne Gedaechtnis (Cache abgelaufen): kein Alarm, aber gesagt, dass Verluste so nicht erkennbar sind.
        fs.rmSync(cache, { recursive: true, force: true }); fs.mkdirSync(cache);
        a = action();
        if (a.code !== 0 || !/Kein Gedaechtnis/.test(a.aus)) f.push('ohne Gedaechtnis: Exit ' + a.code + ' — ' + kurz(a.aus, 200));
        // 6. Der Push wird abgelehnt (Ruleset, Lease, Netz): Exit != 0 — und der NAECHSTE Lauf gibt keinen Fehlalarm
        //    (vorher lag das Gedaechtnis schon vor dem Push auf dem neuen Stand).
        const hook = path.join(bare, 'hooks', 'pre-receive');
        fs.writeFileSync(hook, '#!/bin/sh\nwhile read alt neu ref; do [ "$ref" = refs/heads/zz-sicherung ] && exit 1; done\nexit 0\n', { mode: 0o755 });
        const n1 = mk('idee', { id: '2026-01-06-6666', datum: '2026-01-06', von: 'sitzung/claude/neu', titel: 'Neu auf claude/neu' });
        neuerZweig('claude/neu', [[n1]]);
        a = action();
        if (a.code === 0 || a.code === 3) f.push('abgelehnter Push: Exit ' + a.code + ' — erwartet ein Fehler (weder gruen noch Alarm)');
        fs.unlinkSync(hook);
        a = action();
        if (a.code !== 0 || /ALARM/.test(a.aus) || !/2026-01-06-6666/.test(gesichert())) f.push('nach einem abgelehnten Push: Exit ' + a.code + (/ALARM/.test(a.aus) ? ' mit FEHLALARM' : '') + ', n1 gesichert: ' + /2026-01-06-6666/.test(gesichert()) + ' · ' + kurz(a.aus, 200));
        // 7. Fremde Dateien auf zz-sicherung (.gitignore, eine Notiz, ein Symlink) legen den Waechter nicht lahm: der
        //    neue Stand wird aus dem Nichts gebaut, und was er sichert, liegt WIRKLICH im Commit.
        g(d2, ['fetch', '-q', 'origin']); g(d2, ['checkout', '-q', '-B', 'zz', 'origin/zz-sicherung']);
        fs.writeFileSync(path.join(d2, '.gitignore'), '*.json\n'); fs.writeFileSync(path.join(d2, 'NOTIZ.md'), 'von Hand\n');
        fs.symlinkSync('../../..', path.join(d2, A.ORDNER, '2026-02'));
        g(d2, ['add', '-A', '-f']); g(d2, ['commit', '-q', '-m', 'von Hand']); g(d2, ['push', '-q', 'origin', 'zz:zz-sicherung']);
        const n2 = mk('idee', { id: '2026-02-01-7777', datum: '2026-02-01', von: 'sitzung/claude/neu2', titel: 'Neu auf claude/neu2' });
        neuerZweig('claude/neu2', [[n2]]);
        a = action();
        const bz7 = baumZz();
        if (a.code !== 0 || !/2026-02-01-7777/.test(gesichert()) || /\.gitignore|NOTIZ\.md|\b120000\b/.test(bz7) || !/In der Sicherung verworfen/.test(a.aus)) f.push('fremde Dateien auf zz-sicherung: Exit ' + a.code + ', n2 im Commit: ' + /2026-02-01-7777/.test(gesichert()) + ', fremd im neuen Stand: ' + (bz7.match(/\.gitignore|NOTIZ\.md|120000/g) || []).join() + ' · ' + kurz(a.aus, 200));
        // 8. Ein gewoehnlicher Branch namens claude/zz-sicherung ist NICHT die Sicherung: sein Eintrag wird gesichert.
        const z1 = mk('idee', { id: '2026-02-02-8888', datum: '2026-02-02', von: 'sitzung/claude/zz-sicherung', titel: 'Auf claude/zz-sicherung' });
        neuerZweig('claude/zz-sicherung', [[z1]]);
        a = action();
        if (a.code !== 0 || !/2026-02-02-8888/.test(gesichert())) f.push('claude/zz-sicherung: sein Eintrag wird nicht gesichert (Exit ' + a.code + ')');
        // 9. Zwei Fassungen auf zwei Branches, keine zuzuordnen (von nennt keinen von beiden): beide gesichert; der
        //    Branch der einen wird geloescht → ALARM (vorher: still die andere „neu gesichert").
        const x0 = mk('befund', { id: '2026-02-03-9999', datum: '2026-02-03', von: 'sitzung/claude/niemand', titel: 'Fassung eins' });
        neuerZweig('claude/x1', [[x0]]); neuerZweig('claude/x2', [[Object.assign({}, x0, { titel: 'Fassung zwei' })]]);
        a = action();
        // Keine von beiden unter eintraege/: sonst entschiede die Sortierung, wer der Schreiber ist (und damit, wer gilt).
        if (a.code !== 0 || !/Strittig[^\n]*2026-02-03-9999/.test(a.aus) || /2026-02-03-9999/.test(gesichert()) || fassungen(x0.id).length !== 2) f.push('strittig auf zwei Branches: Exit ' + a.code + ', unter eintraege/: ' + /9999/.test(gesichert()) + ', unter fassungen/: ' + fassungen(x0.id).length + ' — erwartet beide unter fassungen/, keine unter eintraege/ · ' + kurz(a.aus, 200));
        loesche('claude/x1');
        a = action();
        if (a.code !== 3 || !/ALARM:[^\n]*2026-02-03-9999/.test(a.aus)) f.push('eine strittige Fassung verschwindet: Exit ' + a.code + ' (erwartet 3) · ' + kurz(a.aus, 200));
        // 10. Eine kaputte Kopie und eine Datei unter fremdem Namen auf einem anderen Branch verdecken den Verlust nicht.
        const c0 = mk('idee', { id: '2026-02-04-aaaa', datum: '2026-02-04', von: 'sitzung/claude/ca', titel: 'Nur auf claude/ca' });
        neuerZweig('claude/ca', [[c0]]);
        a = action();
        neuerZweig('claude/cb', [['<<<<<<< HEAD\n' + JSON.stringify(c0) + '\n=======\n{}\n>>>>>>> x\n', c0.id + '-idee-x.json']]);
        loesche('claude/ca');
        a = action();
        if (a.code !== 3 || !/ALARM:[^\n]*2026-02-04-aaaa/.test(a.aus)) f.push('eine kaputte Kopie auf claude/cb verdeckt den Verlust von claude/ca: Exit ' + a.code + ' · ' + kurz(a.aus, 200));
        // 11. Eine unlesbare Datei (groesser als 64 KB) wird mit Quelle genannt — und ihr Verschwinden gemeldet.
        neuerZweig('claude/gross', [[JSON.stringify(mk('idee', { id: '2026-02-05-bbbb', datum: '2026-02-05', text: 'x'.repeat(70000) })), '2026-02-05-bbbb-idee-x.json']]);
        a = action();
        // Genannt mit Quelle, id und Blob — NIE mit dem Dateinamen: er traegt den Titel, und Bericht und Gedaechtnis sind oeffentlich.
        const standDatei = path.join(cache, 'brett-stand', 'stand.json');
        if (a.code !== 0 || !/Unlesbar[^\n]*2026-02-05-bbbb \{origin\/claude\/gross\} Blob [0-9a-f]{8}/.test(a.aus) || /idee-x\.json/.test(a.aus) || /-idee-x\.json/.test(fs.readFileSync(standDatei, 'utf8'))) f.push('die unlesbare Datei wird nicht mit Quelle, id und Blob genannt — oder mit ihrem Dateinamen (Titel) in Bericht oder Gedaechtnis · ' + kurz(a.aus, 200));
        loesche('claude/gross');
        a = action();
        if (a.code !== 3 || !/Unlesbare Datei\(en\) mit ihrem Branch verschwunden[^\n]*2026-02-05-bbbb/.test(a.aus)) f.push('eine unlesbare Datei verschwindet still mit ihrem Branch: Exit ' + a.code + ' · ' + kurz(a.aus, 200));
        // Repariert der Schreiber seine unlesbare Datei am selben Ort, oder entfernt er sie (der Branch bleibt): kein Alarm.
        const k0 = mk('idee', { id: '2026-02-06-cccc', datum: '2026-02-06', von: 'sitzung/claude/k', titel: 'Repariert' });
        neuerZweig('claude/k', [['<<<<<<< HEAD\n{}\n=======\n{}\n>>>>>>> x\n', k0.id + '-idee-x.json']]);
        neuerZweig('claude/m', [['{"id": "2026-02-06-dddd", "art": "idee", ', '2026-02-06-dddd-idee-x.json']]);
        a = action();
        // (ablegen legt eine ROHE Zeichenkette unter 2026-01/ ab — die Reparatur gehoert an GENAU diesen Ort)
        g(d, ['checkout', '-q', '-B', 'claude/k', 'origin/claude/k']); ablegen(d, JSON.stringify(k0, null, 2) + '\n', k0.id + '-idee-x.json');
        if (A.brettLesen(d, { alleRefs: false }).unlesbar.length) f.push('der Aufbau der Reparatur misslang: die reparierte Datei ist selbst unlesbar'); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'repariert']); g(d, ['push', '-q', 'origin', 'claude/k']);
        g(d, ['checkout', '-q', '-B', 'claude/m', 'origin/claude/m']); g(d, ['rm', '-q', '-r', A.ORDNER]); g(d, ['commit', '-q', '-m', 'entfernt']); g(d, ['push', '-q', 'origin', 'claude/m']); g(d, ['checkout', '-q', '--detach', 'origin/main']);
        a = action();
        if (a.code !== 0 || /ALARM/.test(a.aus) || !/entfernt, ihr Branch besteht[^\n]*2026-02-06-dddd/.test(a.aus) || /entfernt, ihr Branch besteht[^\n]*2026-02-06-cccc/.test(a.aus)) f.push('eine unlesbare Datei, vom Schreiber repariert bzw. entfernt (Branch besteht): Exit ' + a.code + ' — erwartet 0, kein Alarm, die entfernte genannt · ' + kurz(a.aus, 300));
        const aufMain = (fn, msg) => { g(d2, ['fetch', '-q', 'origin']); g(d2, ['checkout', '-q', '-B', 'main', 'origin/main']); fn(); g(d2, ['add', '-A']); g(d2, ['commit', '-q', '--allow-empty', '-m', msg]); g(d2, ['push', '-q', 'origin', 'main']); g(d, ['fetch', '-q', 'origin']); };
        const blobVon = (x) => cp.execFileSync('git', ['hash-object', '--stdin'], { input: typeof x === 'string' ? x : JSON.stringify(x, null, 2) + '\n', encoding: 'utf8' }).trim();
        const gedaechtnis = () => JSON.parse(fs.readFileSync(standDatei, 'utf8'));
        // 13. Ein Grabstein auf dem EIGENEN Branch (vor dem Merge, README Waechter 1): kein Alarm, `ernten` holt ihn nicht
        //     zurueck — einer auf einem FREMDEN Branch zieht nichts zurueck (der Verlust wird gemeldet).
        const gz = mk('idee', { id: '2026-02-07-eeee', datum: '2026-02-07', von: 'sitzung/claude/gz', titel: 'Vom Schreiber zurueckgezogen' });
        const gf = mk('idee', { id: '2026-02-07-ffff', datum: '2026-02-07', von: 'sitzung/claude/gf', titel: 'Fremd zurueckgezogen' });
        neuerZweig('claude/gz', [[gz]]); neuerZweig('claude/gf', [[gf]]);
        a = action();
        g(d, ['checkout', '-q', '-B', 'claude/gz', 'origin/claude/gz']); fs.writeFileSync(path.join(d, A.GRABSTEINE), JSON.stringify([{ id: gz.id, datum: '2026-02-07', grund: 'vom Schreiber zurueckgezogen' }], null, 2) + '\n');
        g(d, ['rm', '-q', '-r', A.ORDNER]); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'zurueckgezogen']); g(d, ['push', '-q', 'origin', 'claude/gz']);
        g(d, ['checkout', '-q', '-B', 'claude/gfremd', 'origin/main']); fs.writeFileSync(path.join(d, A.GRABSTEINE), JSON.stringify([{ id: gf.id, datum: '2026-02-07', grund: 'fremd' }], null, 2) + '\n');
        g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'fremder Grabstein']); g(d, ['push', '-q', 'origin', 'claude/gfremd']); g(d, ['checkout', '-q', '--detach', 'origin/main']);
        loesche('claude/gf');
        a = action();
        const alarmZeilen = a.aus.split('\n').filter(z => /ALARM/.test(z)).join('\n');
        if (a.code !== 3 || !/Vom Schreiber zurueckgezogen[^\n]*2026-02-07-eeee \{origin\/claude\/gz\}/.test(a.aus) || /eeee/.test(alarmZeilen) || !/ffff/.test(alarmZeilen)) f.push('Grabstein auf dem eigenen Branch: Exit ' + a.code + ' — erwartet 3 NUR fuer den Verlust mit fremdem Grabstein (ffff), eeee als „vom Schreiber zurueckgezogen" · ' + kurz(a.aus, 300));
        g(d, ['checkout', '-q', '-B', 'claude/ernter', 'origin/main']); werkzeug(d, ['ernten']);
        const geerntet = fs.existsSync(path.join(d, A.ORDNER, '2026-02', gz.id + '-idee-x.json'));
        g(d, ['checkout', '-q', '-f', '--detach', 'origin/main']); g(d, ['clean', '-fdq']);
        if (geerntet) f.push('`ernten` holt einen Eintrag zurueck, den sein Schreiber auf seinem Branch zurueckgezogen hat');
        loesche('claude/gz', 'claude/gfremd');
        a = action();
        // 14. Zwei Dateien derselben id auf EINEM Branch: beide gesichert (die zweite unter fassungen/), genannt.
        const dp = mk('befund', { id: '2026-02-08-1212', datum: '2026-02-08', von: 'sitzung/claude/dp', titel: 'Alte Fassung' });
        neuerZweig('claude/dp', [[dp, dp.id + '-befund-alt.json'], [Object.assign({}, dp, { titel: 'Neue Fassung mit Beleg' }), dp.id + '-befund-neu.json']]);
        a = action();
        if (a.code !== 0 || !/Doppelt[^\n]*2026-02-08-1212 \{origin\/claude\/dp\}/.test(a.aus) || fassungen(dp.id).length !== 1 || !/2026-02-08-1212/.test(gesichert())) f.push('zwei Dateien derselben id auf einem Branch: Exit ' + a.code + ', unter fassungen/: ' + fassungen(dp.id).length + ' — erwartet beide gesichert und „Doppelt" genannt · ' + kurz(a.aus, 200));
        loesche('claude/dp');
        a = action();
        if (a.code !== 3 || !/ALARM:[^\n]*2 Fassung\(en\)[^\n]*2026-02-08-1212/.test(a.aus)) f.push('der Branch mit den zwei Dateien wird geloescht: Exit ' + a.code + ' — erwartet ALARM mit 2 Fassungen · ' + kurz(a.aus, 200));
        // 15. Eine Fassung mit einem Geheimnis-Muster wird nie gesichert — verschwindet sie, ist das ein ALARM (vorher still,
        //     und eine Falschmeldung des Musters kostete den Eintrag); eine solche Datei, die schon in zz-sicherung liegt, geht.
        const kennung = '123e4567' + '-e89b-12d3-a456-' + '426614174000';
        const gh = mk('befund', { id: '2026-02-09-1313', datum: '2026-02-09', von: 'sitzung/claude/gh', titel: 'Mit einer Kennung im Beleg', beleg: ['Kennung ' + kennung] });
        neuerZweig('claude/gh', [[gh]]);
        a = action();
        if (a.code !== 0 || !/Nicht gesichert[^\n]*2026-02-09-1313/.test(a.aus)) f.push('Geheimnis-Muster: nicht als „Nicht gesichert" genannt · ' + kurz(a.aus, 200));
        loesche('claude/gh');
        a = action();
        if (a.code !== 3 || !/Nie gesicherte Fassung[^\n]*2026-02-09-1313/.test(a.aus) || /Nichts verloren/.test(a.aus)) f.push('eine nie gesicherte Fassung verschwindet still: Exit ' + a.code + ' · ' + kurz(a.aus, 200));
        g(d2, ['fetch', '-q', 'origin']); g(d2, ['checkout', '-q', '-B', 'zz', 'origin/zz-sicherung']);
        ablegen(d2, Object.assign({}, gh, { id: '2026-02-09-1414' }), '2026-02-09-1414-befund-x.json'); g(d2, ['add', '-A']); g(d2, ['commit', '-q', '-m', 'von Hand']); g(d2, ['push', '-q', 'origin', 'zz:zz-sicherung']);
        a = action();
        if (a.code !== 0 || !/verworfen[^\n]*2026-02-09-1414[^\n]*sieht aus wie/.test(a.aus) || /1414/.test(baumZz())) f.push('eine Datei mit Geheimnis-Muster, die schon in zz-sicherung liegt, bleibt dort · Exit ' + a.code + ' · ' + kurz(a.aus, 200));
        // 16. Was einmal gesichert war, entfernt nur ein Grabstein: verschoben → zurueckgelegt; nach den heutigen Regeln kein
        //     Eintrag mehr → Quarantaene (vorher vernichtete der Waechter selbst die einzige Kopie und meldete „zurueckgesetzt").
        const q1 = mk('idee', { id: '2026-02-10-1515', datum: '2026-02-10', von: 'sitzung/claude/q1', titel: 'Einzige Kopie' });
        neuerZweig('claude/q1', [[q1]]); a = action(); loesche('claude/q1'); a = action();
        g(d2, ['fetch', '-q', 'origin']); g(d2, ['checkout', '-q', '-B', 'zz', 'origin/zz-sicherung']);
        fs.mkdirSync(path.join(d2, A.ORDNER, '2026-09'), { recursive: true }); g(d2, ['mv', path.join(A.ORDNER, '2026-02', q1.id + '-idee-x.json'), path.join(A.ORDNER, '2026-09', q1.id + '-idee-x.json')]);
        const kaputtQ = '{"id": "2026-02-10-1616", "art": "idee", "titel": "unter alten Regeln gesichert"';
        fs.writeFileSync(path.join(d2, A.ORDNER, '2026-02', '2026-02-10-1616-idee-x.json'), kaputtQ);
        g(d2, ['add', '-A']); g(d2, ['commit', '-q', '-m', 'verschoben']); g(d2, ['push', '-q', 'origin', 'zz:zz-sicherung']);
        const kq = blobVon(kaputtQ), st16 = gedaechtnis(); st16.fassungen.push({ id: '2026-02-10-1616', blob: kq, erst: '2026-02-10T00:00:00.000Z', zuletzt: '2026-02-10T00:00:00.000Z', orte: [] }); fs.writeFileSync(standDatei, JSON.stringify(st16));
        a = action();
        if (a.code !== 0 || /Sicherung wurde zurueckgesetzt/.test(a.aus) || !/Umgelegt[^\n]*2026-02-10-1515/.test(a.aus) || baumZz().indexOf(blobVon(q1)) < 0 || !/2026-02-10-1515/.test(gesichert()) || baumZz().indexOf(A.QUARANTAENE + '/' + blobVon(q1)) >= 0 || baumZz().indexOf(A.QUARANTAENE + '/' + kq + '.json') < 0) f.push('verschobene bzw. nach heutigen Regeln unlesbare gesicherte Fassung: Exit ' + a.code + ', q1 noch da: ' + (baumZz().indexOf(blobVon(q1)) >= 0) + ', in der Quarantaene: ' + (baumZz().indexOf(kq) >= 0) + ' · ' + kurz(a.aus, 300));
        a = action();
        if (a.code !== 0 || baumZz().indexOf(A.QUARANTAENE + '/' + kq + '.json') < 0) f.push('die Quarantaene haelt nicht ueber den naechsten Lauf (Exit ' + a.code + ')');
        // 17. Ein Grabstein fuer EINE Fassung: die fremde Kopie mit einem Namen geht, das Original auf main bleibt.
        const pb = mk('befund', { id: '2026-02-11-1717', datum: '2026-02-11', von: 'sitzung/claude/pb', titel: 'Original auf main' });
        aufMain(() => ablegen(d2, pb), 'pb');
        const pbKopie = Object.assign({}, pb, { titel: 'Kopie mit einem Namen' });
        neuerZweig('claude/pbk', [[pbKopie]]); a = action(); loesche('claude/pbk');
        a = action();
        if (a.code !== 0) f.push('die Kopie verschwindet, das Original liegt auf main: Exit ' + a.code + ' — kein Alarm erwartet');
        const kopieBlob = blobVon(pbKopie);
        // Ein ANDERER Schreiber (anderes von) mit derselben id auf main ist nicht „zu Hause" fuer den ersten: dessen Fassung ist verloren.
        const fw = mk('idee', { id: '2026-02-11-1919', datum: '2026-02-11', von: 'sitzung/claude/fw', titel: 'Fassung des Schreibers' });
        neuerZweig('claude/fw', [[fw]]); a = action();
        aufMain(() => ablegen(d2, Object.assign({}, fw, { von: 'sitzung/claude/anders', titel: 'Ein anderer Schreiber, dieselbe id' })), 'fw anders');
        loesche('claude/fw'); a = action();
        if (a.code !== 3 || !/ALARM:[^\n]*2026-02-11-1919/.test(a.aus)) f.push('liegt dieselbe id von einem ANDEREN Schreiber auf main, verschwindet die Fassung des ersten still: Exit ' + a.code + ' · ' + kurz(a.aus, 200));
        aufMain(() => { const gp = path.join(d2, A.GRABSTEINE), l = fs.existsSync(gp) ? JSON.parse(fs.readFileSync(gp, 'utf8')) : []; l.push({ id: pb.id, blob: kopieBlob, datum: '2026-02-11', grund: 'eine Kopie mit einem Namen im Text' }); fs.writeFileSync(gp, JSON.stringify(l, null, 2) + '\n'); }, 'grabstein je fassung');
        a = action();
        const pruef17 = A.brettPruefen(A.brettLesen(d2, { alleRefs: false }));
        neuerZweig('claude/pbk', [[pbKopie]]);   // dieselbe Kopie taucht wieder auf: fuer Leser zaehlt sie nicht
        const bl17 = A.brettLesen(d, { alleRefs: true });
        if (bl17.abweichend.some(x => x.id === pb.id) || (bl17.wo.get(pb.id) || new Set()).has('origin/claude/pbk')) f.push('eine Fassung mit Grabstein (blob) zaehlt fuer Leser weiter: ' + JSON.stringify(bl17.abweichend.filter(x => x.id === pb.id)));
        loesche('claude/pbk');
        if (a.code !== 0 || baumZz().indexOf(kopieBlob) >= 0 || !/2026-02-11-1717/.test(gesichert()) || pruef17.some(x => /Grabstein/.test(x.grund))) f.push('Grabstein je Fassung: Exit ' + a.code + ', Kopie noch gesichert: ' + (baumZz().indexOf(kopieBlob) >= 0) + ', Original gesichert: ' + /1717/.test(gesichert()) + ', Pruefung: ' + pruef17.map(x => x.grund).join(' | '));
        // 18. Abbau: eine abgeloeste Fassung eines Eintrags auf main, SICHERUNG_ABBAU_TAGE ohne Branch, geht — still.
        const pbAlt = Object.assign({}, pb, { titel: 'Alte Fassung, laengst abgeloest' });
        neuerZweig('claude/pbalt', [[pbAlt]]); a = action(); loesche('claude/pbalt'); a = action();
        const altB = blobVon(pbAlt), st18 = gedaechtnis(); st18.fassungen.forEach(x => { if (x.blob === altB) x.zuletzt = new Date(Date.now() - (A.SICHERUNG_ABBAU_TAGE + 5) * 864e5).toISOString(); }); fs.writeFileSync(standDatei, JSON.stringify(st18));
        if (baumZz().indexOf(altB) < 0) f.push('die abgeloeste Fassung wurde gar nicht erst gesichert');
        a = action();
        if (a.code !== 0 || baumZz().indexOf(altB) >= 0 || !/Abgebaut[^\n]*2026-02-11-1717/.test(a.aus)) f.push('Abbau nach ' + A.SICHERUNG_ABBAU_TAGE + ' Tagen: Exit ' + a.code + ', noch gesichert: ' + (baumZz().indexOf(altB) >= 0) + ' · ' + kurz(a.aus, 200));
        a = action();
        if (a.code !== 0) f.push('nach dem Abbau: Exit ' + a.code + ' — kein Alarm erwartet');
        // 19. Berichtigt → gemergt → Branch geloescht: kein Alarm — auch wenn der Arbeitsbaum NICHT main ist (dann traegt
        //     origin/main die Berichtigung; vorher bewachte das kein Fall).
        const k1 = mk('idee', { id: '2026-02-12-1818', datum: '2026-02-12', von: 'sitzung/claude/kk', titel: 'Erste Fassung' });
        neuerZweig('claude/kk', [[k1]]); a = action();
        neuerZweig('claude/kk', [[Object.assign({}, k1, { titel: 'Berichtigte Fassung' })]], 'origin/claude/kk'); a = action();
        const vorMerge = zz(['rev-parse', 'origin/main']).trim();
        aufMain(() => g(d2, ['merge', '-q', '--no-edit', 'origin/claude/kk']), 'merge kk');
        loesche('claude/kk');
        a = action();
        if (a.code !== 0 || /ALARM/.test(a.aus)) f.push('berichtigt, gemergt, Branch geloescht: Exit ' + a.code + ' — kein Alarm erwartet · ' + kurz(a.aus, 200));
        g(d, ['checkout', '-q', '--detach', vorMerge]);
        const r19 = A.sicherungSchreiben(d, { alt: zz(['rev-parse', 'origin/zz-sicherung']).trim() });
        g(d, ['checkout', '-q', '--detach', 'origin/main']);
        if (r19.grund || r19.nurHier.some(x => x.id === k1.id)) f.push('mit einem Arbeitsbaum, der NICHT main ist: ' + (r19.grund || 'die erste Fassung gilt als verloren, obwohl origin/main die Berichtigung traegt'));
        // 12. ALLE Arbeits-Branches geloescht (nur main und die Sicherung bleiben): kein „Holen hat nicht geklappt",
        //     sondern ALARM mit dem, was jetzt nur noch hier liegt.
        const rest = g(d, ['ls-remote', '--heads', 'origin']).split('\n').map(z => (z.split('\t')[1] || '').replace(/^refs\/heads\//, '')).filter(n => n && n !== 'main' && n !== 'zz-sicherung');
        loesche(...rest);
        a = action();
        if (a.code !== 3 || !/ALARM:[^\n]*2026-01-06-6666/.test(a.aus) || /Holen aller Branches/.test(a.aus)) f.push('alle Branches geloescht: Exit ' + a.code + ' (erwartet 3, mit n1) · ' + kurz(a.aus, 300));
        if (fs.existsSync(tokenLog)) f.push('das Werkzeug sah GH_TOKEN in seiner Umgebung (' + fs.readFileSync(tokenLog, 'utf8').split('\n').filter(Boolean).length + '×)');
        if (f.length) return { ok: false, warum: f.join(' · ') };
        return { ok: true, info: 'Basis lokal/PR/main · Waechter 1 hinter main gruen, geloescht/umgeschrieben/Grabstein-im-Baum rot · ' + lauf + ' Laeufe der Action wie auf GitHub: byte-gleich, ohne Titel, ohne Token, Geheimnis nicht, nur zz-sicherung geaendert, Wiederholung ohne Commit, Autor berichtigt (gilt, beide Fassungen gesichert), Faelschung nimmt nichts, Branch geloescht → Alarm einmal, GERETTET nach --prune, Grabstein ohne Geschichte, Reset → Alarm, ohne Gedaechtnis gesagt, abgelehnter Push ohne Fehlalarm, fremde Dateien verworfen, claude/zz-sicherung gesichert, strittige und verdeckte Verluste → Alarm, unlesbare genannt und vermisst, alle Branches weg → Alarm' };
      } catch (e) { return { ok: false, warum: 'Ausnahme: ' + String(e.message).split('\n')[0] }; } finally { weg(eltern); }
    },
  },
  {
    name: 'C17 · Der Klammer-Scanner · gebaute Faelle mit acorn-gleichem Soll: Teilen und Regex an gueltigen Stellen (t.in / t.out, erledigt++ / gesamt, if (x) /\'/, -->), Kommentare (// }, /* } */, <!-- } im JS, eine Deklaration im Kommentar, GS_VERSION hinter einer Funktion), HTML um die Skripte (<!-- in Attribut, style, textarea, title; <!-->; data-src; > im Attribut), die Naeherung bei einem kaputten Block (Einrueckung) und `unsicher` bis in den Halt, ein Cache je Modus, das Tor X = X || function, EINE Regel fuer „gibt es diese Funktion", eine ganz geloeschte Funktion — und als PROZESS: Merge-Konflikt, color/diff.external/textconv, eine binaer gelesene index.html',
    lauf: () => {
      const f = [];
      const bereicheVon = (t, html) => A.funktionsBereiche(t, html).bereiche.map(r => r.name + ' ' + r.von + '-' + r.bis).join(', ');
      // 1. Teilen oder Regex — je eine GUELTIGE Zeile im Rumpf von gsMitte (acorn 8.18 bzw. V8: gsVor 1-3, gsMitte 4-7, gsNach 8-10).
      //    Die letzte Zeile ist die Gegenrichtung: nach der ) eines Ausdrucks ist / ein Teilen, kein Regex.
      const mitte = (z) => ['function gsVor(a) {', '  return a;', '}', 'function gsMitte(t, n, erledigt, gesamt, x, y) {', '  ' + z, '  return 1;', '}', 'function gsNach() {', '  return 2;', '}', ''].join('\n');
      for (const z of ["var quote = t.in / t.out, label = 'Ein/Aus';", "var anteil = erledigt++ / gesamt, txt = '1/2';", "var r = n.new / n.all; var s = 'a/b';", "var q = t?.in / n, s = 'x/y';", "var v = erledigt-- / 2, s3 = '1/2';",
        "if (x) /'/.test(y);", "while (x) /'/.test(y);", "--> Ende des Fusses, it's done }", "var w = (n + 1) / 2, s2 = 'x/y';"]) {
        const t = mitte(z), fb = A.funktionsBereiche(t, false), ist = bereicheVon(t, false);
        if (fb.unsicher || ist !== 'gsVor 1-3, gsMitte 4-7, gsNach 8-10') f.push('„' + z + '": ' + ist + (fb.unsicher ? ' (unsicher)' : '') + ' — erwartet gsVor 1-3, gsMitte 4-7, gsNach 8-10, nicht unsicher');
      }
      // Still falsch, ohne `kaputt`: /}/ und /{/ hinter if-Koepfen hielten sich gegenseitig die Waage (Runde 3).
      const gsA = 'function gsA(q, z) {\n  if (q) /}/.test(z);\n  var mitte = 1;\n  if (q) /{/.test(z);\n  return mitte;\n}\n\nfunction gsB() {\n  return 2;\n}\n';
      if (bereicheVon(gsA, false) !== 'gsA 1-6, gsB 8-10' || [...A.funktionenAusDiff('@@ -3 +3 @@\n', gsA, gsA)].join() !== 'gsA') f.push('if (q) /}/ … /{/: ' + bereicheVon(gsA, false) + ', Zeile 3 → „' + [...A.funktionenAusDiff('@@ -3 +3 @@\n', gsA, gsA)].join() + '" — erwartet gsA 1-6, gsB 8-10 und gsA');
      // 2. Kommentare: // }, /* } */ und <!-- } im JS schliessen nichts; eine Deklaration in einem Kommentar hat keinen Bereich;
      //    GS_VERSION HINTER einer Funktion gehoert keiner (die alte Regel „naechste Deklaration davor" gab sie gsZiel).
      const J = ['function gsZiel(a) {', '  // }', '  /* } */', '  x(); <!-- }', '  return a;', '}', '// function gsSchein(){', '/*', 'function gsSchein2() {', '*/', "var GS_VERSION = 'v1.00';", 'function gsDanach() {', '  return 2;', '}', ''].join('\n');
      const fbJ = A.funktionsBereiche(J, false), faJ = (z) => [...A.funktionenAusDiff('@@ -' + z + ' +' + z + ' @@\n', J, J)].join();
      if (fbJ.unsicher || bereicheVon(J, false) !== 'gsZiel 1-6, gsDanach 12-14') f.push('Kommentare: ' + bereicheVon(J, false) + (fbJ.unsicher ? ' (unsicher)' : '') + ' — erwartet gsZiel 1-6, gsDanach 12-14 (gsSchein2 steht in einem Kommentar)');
      if (faJ(4) !== 'gsZiel' || faJ(11) || faJ(9)) f.push('Zeile 4 (<!-- } im Rumpf) → „' + faJ(4) + '", Zeile 11 (GS_VERSION) → „' + faJ(11) + '", Zeile 9 (Deklaration im Kommentar) → „' + faJ(9) + '" — erwartet gsZiel, nichts, nichts');
      // 3. HTML um die Skripte: was vor dem Skript steht, darf es nicht verschlucken; ein Kommentar zaehlt nur im Text.
      const ZIEL = (tag) => (tag || '<script>') + '\nfunction gsZiel(a) {\n  return a;\n}\n</script>\n<p>Fuss <!-- Ende --></p>\n';
      for (const [vorne, tag, soll] of [
        ['<!-->'], ['<!--->'], ['<style>/* <!-- */ .x { color: red; }</style>'], ['<textarea><!-- x</textarea>'], ['<title>A <!-- B</title>'],
        ['<input placeholder="<!-- hier">'], ['<button title="Schliessen <!-- Fuss" onclick="closeModal(\'x\')">x</button>'],
        // Ein > VOR dem <script>: sonst endete auch ein „<!…>" ohne Kommentar-Regel an der richtigen Stelle (Gegenprobe gruen).
        ['<!-- Kopf > Fuss\n<script>\nfunction gsKommentiert() {\n}\n</script>\n-->'],
        ['<p>', '<script data-src="cfg">'], ['<p>', '<script data-hinweis="a>b\'s">'], ['<p>', '<script type="text/javascript" >'],
        ['<p>', '<script src="/x.js">', ''], ['<p>', '<script defer SRC=y.js>', '']]) {
        const t = vorne + '\n' + ZIEL(tag), L = vorne.split('\n').length, fb = A.funktionsBereiche(t, true), ist = bereicheVon(t, true);
        const erwartet = soll === '' ? '' : 'gsZiel ' + (L + 2) + '-' + (L + 4);
        if (fb.unsicher || ist !== erwartet) f.push('HTML „' + kurz(vorne + (tag ? ' ' + tag : ''), 60) + '": ' + (ist || 'kein Bereich') + (fb.unsicher ? ' (unsicher)' : '') + ' — erwartet ' + (erwartet || 'kein Bereich (src: der Browser fuehrt den Inhalt nicht aus)'));
      }
      // 4. Ein Block, der nicht aufgeht (Zeile 4: eine offene Zeichenkette): die Naeherung reicht bis vor die naechste
      //    Deklaration, die NICHT tiefer eingerueckt ist (der Helfer `im` schneidet gsAussen nicht ab) — und sie sagt es.
      const K = ['function gsAussen(a) {', '  var im = function (t) { return t; };', '  var x = 1;', "  return im(x) + '", '}', 'function gsDanach() {', '  return 2;', '}', ''].join('\n');
      const fbK = A.funktionsBereiche(K, false), faK = A.funktionenAusDiff('@@ -3 +3 @@\n', K, K);
      if (bereicheVon(K, false) !== 'gsAussen 1-5, im 2-5, gsDanach 6-9') f.push('Naeherung: ' + bereicheVon(K, false) + ' — erwartet gsAussen 1-5, im 2-5, gsDanach 6-9');
      if (!fbK.unsicher || (fbK.unsicherBloecke[0] || {}).ab !== 4) f.push('kaputter Block: unsicher ' + fbK.unsicher + ', ab Zeile ' + (fbK.unsicherBloecke[0] || {}).ab + ' — erwartet unsicher ab Zeile 4');
      if ([...faK].sort().join() !== 'gsAussen,im' || !faK.unsicher || faK.unsicher.ab !== 4 || faK.unsicher.namen.join() !== 'gsAussen,gsDanach,im') f.push('Zeile 3 im kaputten Block: „' + [...faK].sort().join() + '", unsicher ' + JSON.stringify(faK.unsicher) + ' — erwartet gsAussen,im und unsicher ab 4 mit gsAussen,gsDanach,im');
      const htK = A.haltBeruehrt({ geltung: ['gsDanach', 'gsAussen', '_headers'] }, { dateien: ['index.html'], funktionen: [...faK], unsicher: faK.unsicher, bump: false });
      if (htK.join() !== 'gsDanach() — Grenzen unsicher,gsAussen() — Grenzen unsicher') f.push('Halt im unsicheren Block: „' + htK.join() + '" — erwartet gsDanach() und gsAussen(), beide „Grenzen unsicher", _headers nicht');
      // 5. Der Zwischenspeicher kennt den Modus: html=false sieht ein Wort im HTML-Text als Funktion, html=true nicht.
      const tc = '<p>\nfunction gsHtmlText() { }\n</p>\n<script>\nfunction gsEcht(a) {\n  return a;\n}\n</script>\n<!-- C17 ' + Date.now() + ' -->\n';
      const nJ = A.funktionsBereiche(tc, false).bereiche.map(b => b.name).join(), nH = A.funktionsBereiche(tc, true).bereiche.map(b => b.name).join();
      if (nJ !== 'gsHtmlText,gsEcht' || nH !== 'gsEcht') f.push('Cache je Modus: html=false „' + nJ + '", danach html=true „' + nH + '" — erwartet gsHtmlText,gsEcht und gsEcht');
      // 6. Das Tor `window.X = window.X || async function` (gsUploadImage) und `X = X ?? function` sind Deklarationen.
      const tor = "window.gsTor = window.gsTor || async function(b64, bucket) {\n  return b64;\n};\nvar gsAuch = gsAuch ?? function () {\n  return 1;\n};\n";
      if (bereicheVon(tor, false) !== 'gsTor 1-3, gsAuch 4-6') f.push('X = X || function: ' + (bereicheVon(tor, false) || 'nichts') + ' — erwartet gsTor 1-3, gsAuch 4-6');
      // 7. EINE Regel fuer „gibt es diese Funktion": `halt` nimmt nur an, was einen Bereich hat — dieselbe Rechnung wie der Abgleich.
      const wb = tmp('scanner-geltung');
      try {
        fs.writeFileSync(path.join(wb, 'index.html'), '<script>\n' + J + '</script>\n');
        const gZ = A.geltungImBaum(wb, ['gsZiel']), gS = A.geltungImBaum(wb, ['gsSchein2']), gN = A.geltungImBaum(wb, ['gsGibtsNicht']);
        if (gZ.length || gS.length !== 1 || !/keine bestimmbaren Grenzen/.test(gS[0]) || !/weder eine Funktion/.test(gN[0] || '')) f.push('geltungImBaum: gsZiel ' + JSON.stringify(gZ) + ', gsSchein2 (im Kommentar) ' + kurz(JSON.stringify(gS), 120) + ', gsGibtsNicht ' + kurz(JSON.stringify(gN), 80) + ' — erwartet angenommen, „keine bestimmbaren Grenzen", „weder eine Funktion"');
      } finally { weg(wb); }
      // 8. Eine ganz geloeschte Funktion (der Diff hat nur die alte Seite): ein Halt auf ihren Namen trifft.
      const altW = 'function gsDa() {\n  return 1;\n}\nfunction gsWeg() {\n  return 2;\n}\n', fw = A.funktionenAusDiff('@@ -4,3 +3,0 @@\n-function gsWeg() {\n-  return 2;\n-}\n', altW, 'function gsDa() {\n  return 1;\n}\n');
      if ([...fw].join() !== 'gsWeg' || A.haltBeruehrt({ geltung: ['gsWeg'] }, { dateien: ['index.html'], funktionen: [...fw], bump: false }).join() !== 'gsWeg()') f.push('geloeschte Funktion: „' + [...fw].join() + '" — erwartet gsWeg, und ein Halt auf gsWeg trifft');
      // Kein Hunk-Kopf bei verschiedenen Texten ist „unlesbar" — auch ein LEERER Diff (ein externes Programm, das nichts
      // ausgibt); gleiche Texte mit nur geaendertem Modus sind es nicht.
      const uLeer = A.funktionenAusDiff('', altW, 'x').unlesbar, uModus = A.funktionenAusDiff('diff --git a/index.html b/index.html\nold mode 100644\nnew mode 100755\n', altW, altW).unlesbar;
      if (uLeer !== true || uModus !== false) f.push('unlesbar: leerer Diff bei verschiedenen Texten ' + uLeer + ', nur Modus geaendert ' + uModus + ' — erwartet true und false');
      // 9. Als PROZESS in einem echten Repo: ein fremder Halt auf gsKal und gsNach, die eigene Aenderung in gsKal.
      const eltern = tmp('scanner'), bare = path.join(eltern, 'origin.git'), d = path.join(eltern, 'klon');
      try {
        const KAL = ['<!DOCTYPE html>', '<script>', "var GS_VERSION = 'v1.00';", 'function gsKal(liste) {', '  var out = [];', '  var im = function (t) { return t; };', '  liste.forEach(function (e) {', '    out.push(im(e));', '  });', '  return out;', '}', 'function gsNach() {', '  return 1;', '}', '</script>', ''].join('\n');
        const ZEILE = '  liste.forEach(function (e) {';
        cp.execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare]);
        fs.mkdirSync(d); g(d, ['init', '-q', '-b', 'main', '.']); g(d, ['remote', 'add', 'origin', 'file://' + bare]);
        fs.writeFileSync(path.join(d, 'index.html'), KAL); fs.writeFileSync(path.join(d, 'sw.js'), "const VERSION = 'gs-v1.00';\n");
        g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'start']); g(d, ['push', '-q', 'origin', 'main']);
        g(d, ['checkout', '-q', '-b', 'claude/halter']);
        let r = werkzeug(d, ['halt', '--geltung', 'gsKal,gsNach', '--bis', '24h', '--text', 'gsKal wird umgebaut']);
        const halt = (r.aus.match(/\n {2}(\d{4}-\d{2}-\d{2}-[0-9a-f]{4,8}) /) || [])[1];
        if (!halt) return { ok: false, warum: 'Halt nicht geschrieben: ' + kurz(r.aus, 300) };
        g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'halt']); g(d, ['push', '-q', 'origin', 'claude/halter']);
        g(d, ['checkout', '-q', '-b', 'claude/arbeit', 'main']);
        fs.writeFileSync(path.join(d, 'index.html'), KAL.replace(ZEILE, '  liste.forEach(function (eintrag) { var e = eintrag;')); g(d, ['commit', '-q', '-am', 'arbeit']);
        g(d, ['checkout', '-q', 'main']);
        fs.writeFileSync(path.join(d, 'index.html'), KAL.replace(ZEILE, '  liste.forEach(function (e) { if (!e) return;')); g(d, ['commit', '-q', '-am', 'main weiter']); g(d, ['push', '-q', 'origin', 'main']);
        g(d, ['checkout', '-q', 'claude/arbeit']); g(d, ['fetch', '-q', 'origin']);
        const halten = (a) => A.haltBeruehrt({ geltung: ['gsKal', 'gsNach'] }, a).join();
        let a = A.eigeneAenderung(d);
        if (a.funktionen.join() !== 'gsKal' || a.unsicher) f.push('Kontrolle: funktionen ' + a.funktionen.join() + ', unsicher ' + JSON.stringify(a.unsicher) + ' — erwartet gsKal, sicher');
        // Eine Einstellung der Person aendert nichts an den Hunk-Koepfen (vorher: funktionen [] und jeder Funktions-Halt still).
        for (const [k, v] of [['color.ui', 'always'], ['color.diff', 'always'], ['diff.external', 'true'], ['diff.zaehle.textconv', 'wc -l']]) {
          if (k === 'diff.zaehle.textconv') fs.writeFileSync(path.join(d, '.gitattributes'), 'index.html diff=zaehle\n');
          g(d, ['config', k, v]);
          a = A.eigeneAenderung(d);
          if (a.funktionen.join() !== 'gsKal' || halten(a) !== 'gsKal()') f.push('mit ' + k + '=' + v + ': funktionen „' + a.funktionen.join() + '", Halt „' + halten(a) + '" — erwartet gsKal');
          g(d, ['config', '--unset', k]);
        }
        // git liest index.html als binaer: kein Hunk-Kopf — gesagt, und jeder Funktions-Halt gilt als beruehrt.
        fs.writeFileSync(path.join(d, '.gitattributes'), 'index.html -diff\n');
        a = A.eigeneAenderung(d);
        if (!a.unsicher || !/Hunk-Kopf/.test(a.unsicher.grund) || halten(a) !== 'gsKal() — Grenzen unsicher,gsNach() — Grenzen unsicher') f.push('index.html binaer gelesen: unsicher ' + kurz(JSON.stringify(a.unsicher), 120) + ', Halt „' + halten(a) + '" — erwartet „kein lesbarer Hunk-Kopf" und beide Funktionen „Grenzen unsicher"');
        fs.rmSync(path.join(d, '.gitattributes'));
        // gsNach ganz geloescht (nur die alte Seite im Diff): der Halt trifft sie.
        fs.writeFileSync(path.join(d, 'index.html'), KAL.replace(ZEILE, '  liste.forEach(function (eintrag) { var e = eintrag;').replace('function gsNach() {\n  return 1;\n}\n', ''));
        a = A.eigeneAenderung(d);
        if (halten(a) !== 'gsKal(),gsNach()') f.push('gsNach geloescht: Halt „' + halten(a) + '" — erwartet gsKal(), gsNach()');
        g(d, ['checkout', '-q', '--', 'index.html']);
        // Merge-Konflikt IN der gehaltenen Funktion: der Block geht nicht auf. Vorher hiess die Aenderung `im`, und der Halt schwieg.
        try { g(d, ['merge', '-q', 'origin/main']); } catch (_) { /* Konflikt erwartet */ }
        if (!/^UU index\.html$/m.test(g(d, ['status', '--porcelain']))) return { ok: false, warum: 'der Merge-Konflikt ist nicht hergestellt: ' + g(d, ['status', '--porcelain']) };
        a = A.eigeneAenderung(d);
        if (!a.unsicher || a.unsicher.ab !== 4 || halten(a) !== 'gsKal() — Grenzen unsicher,gsNach() — Grenzen unsicher') f.push('Merge-Konflikt: funktionen ' + a.funktionen.join() + ', unsicher ' + kurz(JSON.stringify(a.unsicher), 120) + ', Halt „' + halten(a) + '" — erwartet unsicher ab Zeile 4 und beide Funktionen „Grenzen unsicher"');
        r = werkzeug(d, []);
        const dich = (r.aus.split('\nDICH BETREFFEND\n')[1] || '').split('\n\n')[0];
        if (!new RegExp('HALT ' + halt + '[^\\n]*beruehrt gsKal\\(\\) — Grenzen unsicher').test(dich) || !/Funktionsgrenzen in index\.html ab Zeile 4 nicht bestimmbar/.test(dich)) f.push('Merge-Konflikt, DICH BETREFFEND: ' + kurz(dich || r.aus, 400) + ' — erwartet den Halt mit „Grenzen unsicher" und die Zeile „Funktionsgrenzen in index.html ab Zeile 4 nicht bestimmbar"');
        // Dieselbe Rechnung im Bericht fuer den, der merged (A8).
        const hs = A.haltsDiesesStands(d, {});
        if (!hs.unsicher || hs.unsicher.ab !== 4 || !(hs.treffer || []).some(x => x.h.e.id === halt && x.t.indexOf('gsKal() — Grenzen unsicher') >= 0)) f.push('Merge-Konflikt, haltsDiesesStands: unsicher ' + kurz(JSON.stringify(hs.unsicher || hs.grund || null), 100) + ', treffer ' + kurz(JSON.stringify((hs.treffer || []).map(x => x.t)), 120) + ' — erwartet unsicher ab Zeile 4 und den Halt mit „gsKal() — Grenzen unsicher"');
        try { g(d, ['merge', '--abort']); } catch (_) {}
      } catch (e) { return { ok: false, warum: 'Ausnahme: ' + String(e.message).split('\n')[0] }; } finally { weg(eltern); }
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: '9 Zeilen Teilen/Regex und /}/…/{/ wie acorn · Kommentare, Deklaration im Kommentar, GS_VERSION hinter der Funktion · 13 HTML-Umgebungen · Naeherung nach Einrueckung, unsicher bis in den Halt · Cache je Modus · X = X || function · geltungImBaum = Bereiche · geloeschte Funktion · Prozess: color.ui, color.diff, diff.external, textconv, binaer, geloescht, Merge-Konflikt → Halt mit „Grenzen unsicher" unter DICH BETREFFEND' };
    },
  },
  {
    name: 'C18 · Lesen im Teilabruf · .github/workflows/pruefstaende.yml, gelesen (checkout mit fetch-depth: 2 und persist-credentials: false, „Branches fuer das Brett" VOR „Prüfstände", ein Filter ueber 64 KB, kein Token, GIT_NO_LAZY_FETCH) und ihr Schritt WOERTLICH in einem nachgebauten PR-Checkout: der C7-Aufruf und `naechste` erzeugen KEIN neues Pack — auch ohne die Variable und mit einem git, das sie nicht kennt; ein fehlender Blob nimmt den anderen nichts (auch ohne erreichbares origin); was fehlt, steht mit Quelle da (unlesbar, `naechste` nicht rechenbar); A8 ist nicht pruefbar ohne Branches oder wenn ein fehlender Blob ein Eintrag sein koennte; dieselben Bytes unter zwei gueltigen Namen sind EINE Fassung mit beiden Quellen, ein falscher Name ist nur an SEINER Stelle unlesbar',
    lauf: () => {
      const eltern = tmp('teilabruf'), bare = path.join(eltern, 'origin.git'), src = path.join(eltern, 'src'), ci = path.join(eltern, 'ci');
      const altPfad = process.env.PATH, altNl = process.env.GIT_NO_LAZY_FETCH;
      // Eingebettete Ausgaben auf EINE Zeile: sonst saehe ein Bericht die Zeile „--   A8 …" eines inneren Laufs als eigenen Fall.
      const kurz1 = (t, m) => kurz(String(t || '').replace(/\s*\n\s*/g, ' ⏎ '), m);
      try {
        const f = [];
        // ── 1. Die Action, gelesen. Ein Schritt ist ein Block, der mit „      - " beginnt.
        const yml = lies('.github/workflows/pruefstaende.yml'), schritte = yml.split(/\n(?= {6}- )/);
        const finde = (re) => schritte.findIndex(s => re.test(s));
        const iCo = finde(/^ {6}- uses: actions\/checkout@[0-9a-f]{40}\b/), iBr = finde(/^ {6}- name: Branches fuer das Brett\b/), iPr = finde(/^ {6}- name: Prüfstände\n/);
        if (iCo < 0 || !/\n {10}persist-credentials: false\n/.test(schritte[iCo] + '\n')) f.push('pruefstaende.yml: actions/checkout ohne persist-credentials: false — der Token laege in .git/config, waehrend Pruefstaende fremde Branches lesen');
        if (iCo < 0 || !/\n {10}fetch-depth: 2\n/.test(schritte[iCo] + '\n')) f.push('pruefstaende.yml: actions/checkout ohne fetch-depth: 2 — ohne HEAD^1 rechnen A6 und A8 nicht (waechterBasis)');
        if (iBr < 0 || iPr < 0 || !(iCo < iBr && iBr < iPr)) f.push('pruefstaende.yml: der Schritt „Branches fuer das Brett" steht nicht zwischen checkout und „Prüfstände" (checkout ' + iCo + ', Branches ' + iBr + ', Prüfstände ' + iPr + ') — ohne ihn sieht A8 nur refs/remotes/pull/<n>/merge');
        const schritt = iBr < 0 ? '' : (((schritte[iBr] + '\n').match(/\n {8}run: \|\n((?: {10}[^\n]*\n|\n)+)/) || [])[1] || '').replace(/^ {10}/gm, '');
        const k1 = (schritt.match(/partialclonefilter 'blob:limit=(\d+)k'/) || [])[1], k2 = (schritt.match(/ --filter=blob:limit=(\d+)k /) || [])[1];
        if (!/git config remote\.origin\.promisor true\n/.test(schritt) || !k1 || k1 !== k2 || !/ --depth=1 /.test(schritt) || !/ origin '\+refs\/heads\/\*:refs\/remotes\/origin\/\*'/.test(schritt)) return { ok: false, warum: f.concat('pruefstaende.yml: der Schritt „Branches fuer das Brett" ist nicht lesbar (promisor, derselbe Filter in config und fetch, --depth=1, alle Branches nach origin/*): ' + kurz1(schritt, 300)).join(' · ') };
        if (!(Number(k1) * 1024 > A.EINTRAG_MAX_BYTES)) f.push('pruefstaende.yml: der Filter blob:limit=' + k1 + 'k laesst Dateien weg, die ein gueltiger Eintrag sein koennen (hoechstens ' + A.EINTRAG_MAX_BYTES + ' Bytes) — A8 waere dann immer „nicht pruefbar"');
        if (/extraheader|credential|GITHUB_TOKEN|GH_TOKEN|secrets\./i.test(schritte[iBr])) f.push('pruefstaende.yml: der Branch-Abruf traegt Zugangsdaten — er liest nur, das Repo ist oeffentlich');
        const nl = iPr < 0 ? null : (schritte[iPr].match(/\n {10}GIT_NO_LAZY_FETCH: '?(1|true)'?\n/) || [])[1];
        if (!nl) f.push('pruefstaende.yml: der Schritt „Prüfstände" setzt GIT_NO_LAZY_FETCH nicht — jedes Lesen einer weggelassenen Datei laedt sie still nach (C7: zwei Nachlade-Prozesse je frischem Branch)');
        const ymlEnv = { GIT_NO_LAZY_FETCH: nl || '' };
        // ── 2. Ein origin mit Teilabruf-Erlaubnis: main, zwei frische Branches mit eigener grosser STATUS.md und index.html
        //       (je ueber 200 KB), ein fremder Halt, eine 230-KB-Eintragsdatei, ein PR als Merge-Ref — und fuer die Namensregel
        //       derselbe Halt byte-gleich unter einem vergifteten Namen (aaa/x, sortiert zuerst), unter einem anderen gueltigen
        //       Namen (aaa/y) und unter einer fremden id (aab/z).
        cp.execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare]); g(bare, ['config', 'uploadpack.allowFilter', 'true']);
        fs.mkdirSync(src); g(src, ['init', '-q', '-b', 'main', '.']); g(src, ['remote', 'add', 'origin', 'file://' + bare]);
        const polster = (wort) => '\n<!-- ' + (wort + ' ').repeat(Math.ceil(220 * 1024 / (wort.length + 1))) + '-->\n';
        const schreib = (rel, t) => { fs.mkdirSync(path.dirname(path.join(src, rel)), { recursive: true }); fs.writeFileSync(path.join(src, rel), t); };
        const push = (zweig, msg) => { g(src, ['add', '-A']); g(src, ['commit', '-q', '--allow-empty', '-m', msg]); g(src, ['push', '-q', '-f', 'origin', 'HEAD:refs/heads/' + zweig]); };
        const zweig = (name) => g(src, ['checkout', '-q', '-B', name, 'main']);
        schreib('index.html', QUELLE + polster('main')); schreib('STATUS.md', '# STATUS' + polster('main')); schreib('sw.js', "const VERSION = 'gs-v1.00';\n");
        push('main', 'start');
        for (const [n, v] of [['claude/eins', '1.01'], ['claude/zwei', '1.02']]) { zweig(n); schreib('index.html', QUELLE + polster(n)); schreib('STATUS.md', '# STATUS' + polster(n)); schreib('sw.js', "const VERSION = 'gs-v" + v + "';\n"); push(n, n); }
        const idAus = (r) => (r.aus.match(/\n {2}(\d{4}-\d{2}-\d{2}-[0-9a-f]{8}) /) || [])[1];
        const datei = (id) => { const d = path.join(src, A.ORDNER, id.slice(0, 7)); return fs.existsSync(d) ? fs.readdirSync(d).find(n => n.indexOf(id) === 0) : null; };
        zweig('claude/andere'); let r = werkzeug(src, ['halt', '--geltung', 'gsZwei', '--bis', '6h', '--text', 'ich baue gsZwei um']); const andere = idAus(r), andereDatei = andere && datei(andere); push('claude/andere', 'halt');
        zweig('claude/v'); r = werkzeug(src, ['halt', '--geltung', 'gsZwei', '--bis', '6h', '--text', 'gsZwei bleibt, wie es ist']); const vHalt = idAus(r), vDatei = vHalt && datei(vHalt); push('claude/v', 'halt v');
        if (!andereDatei || !vDatei) return { ok: false, warum: f.concat('Aufbau: Halts nicht geschrieben — ' + kurz1(r.aus, 200)).join(' · ') };
        const vBytes = g(src, ['cat-file', 'blob', 'HEAD:' + path.posix.join(A.ORDNER, vHalt.slice(0, 7), vDatei)]);
        const giftName = vHalt + '-halt-' + 'sk-' + 'ant-' + 'a'.repeat(12) + '.json', andererName = vHalt + '-halt-anderer-slug.json', fremdName = vHalt.slice(0, 11) + 'ffffffff-halt-x.json';
        for (const [zw, name] of [['aaa/x', giftName], ['aaa/y', andererName], ['aab/z', fremdName]]) { zweig(zw); schreib(path.posix.join(A.ORDNER, vHalt.slice(0, 7), name), vBytes); push(zw, 'kopie'); }
        zweig('claude/gross'); schreib(path.posix.join(A.ORDNER, '2026-01', '2026-01-05-aaaaaaaa-befund-gross.json'), JSON.stringify({ id: '2026-01-05-aaaaaaaa', art: 'befund', titel: 'zu gross', beleg: ['x'.repeat(230 * 1024)] })); push('claude/gross', 'gross');
        zweig('claude/pr'); schreib('index.html', QUELLE.replace('function gsZwei(){ return gsEins() + gsEins(); }', 'function gsZwei(){ return 2 * gsEins(); }') + polster('main')); push('claude/pr', 'pr');
        g(src, ['checkout', '-q', '-B', 'pr-merge', 'main']); g(src, ['merge', '-q', '--no-ff', '--no-edit', 'claude/pr']); g(src, ['push', '-q', 'origin', 'HEAD:refs/pull/1/merge']);
        // ── 3. Der Checkout wie actions/checkout (Merge-Ref, Tiefe 2), in einer sauberen git-Umgebung; danach der Schritt woertlich.
        const leer = path.join(eltern, 'gitconfig'); fs.writeFileSync(leer, '');
        const sauber = Object.assign({}, process.env, { GIT_CONFIG_GLOBAL: leer, GIT_CONFIG_NOSYSTEM: '1' });
        fs.mkdirSync(ci);
        for (const a of [['init', '-q', '.'], ['remote', 'add', 'origin', 'file://' + bare], ['fetch', '-q', '--no-tags', '--depth=2', 'origin', '+refs/pull/1/merge:refs/remotes/pull/1/merge'], ['checkout', '-q', '--detach', 'refs/remotes/pull/1/merge']]) cp.execFileSync('git', a, { cwd: ci, env: sauber, stdio: 'ignore' });
        const ciOhne = path.join(eltern, 'ci-ohne-schritt'); fs.cpSync(ci, ciOhne, { recursive: true });
        const x = cp.spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', schritt], { cwd: ci, encoding: 'utf8', env: sauber });
        const remoteRefs = g(ci, ['for-each-ref', '--format=%(refname)', 'refs/remotes']).split('\n').filter(Boolean);
        if (x.status !== 0 || /::warning::/.test(x.stdout + x.stderr) || remoteRefs.length < 10) return { ok: false, warum: f.concat('der Schritt „Branches fuer das Brett" laeuft im Nachbau nicht: Exit ' + x.status + ', ' + remoteRefs.length + ' Remote-Refs · ' + kurz1(x.stdout + x.stderr, 200)).join(' · ') };
        const packs = (d) => { const p = path.join(d, '.git', 'objects', 'pack'); return fs.existsSync(p) ? fs.readdirSync(p).filter(n => /\.pack$/.test(n)).length : 0; };
        const kennung = (ref, rel) => g(ci, ['rev-parse', ref + ':' + rel]).trim();
        const grossBlob = kennung('refs/remotes/origin/claude/gross', A.ORDNER + '/2026-01/2026-01-05-aaaaaaaa-befund-gross.json');
        const klein1 = kennung('refs/remotes/origin/claude/andere', path.posix.join(A.ORDNER, andere.slice(0, 7), andereDatei)), klein2 = kennung('refs/remotes/origin/claude/v', path.posix.join(A.ORDNER, vHalt.slice(0, 7), vDatei));
        // Kontrolle: der grosse Blob FEHLT wirklich (sonst misst der Rest nichts).
        if (cp.spawnSync('git', ['-C', ci, 'rev-list', '--objects', '--missing=print', 'refs/remotes/origin/claude/gross'], { encoding: 'utf8' }).stdout.indexOf('?' + grossBlob) < 0) return { ok: false, warum: f.concat('Aufbau: der 230-KB-Blob liegt im Nachbau doch lokal — kein Teilabruf').join(' · ') };
        const pr = { GITHUB_EVENT_NAME: 'pull_request', GITHUB_HEAD_REF: 'claude/pr' };
        // ── 4. Der C7-Aufruf und `naechste`, mit der Umgebung aus der Action: kein neues Pack, und was fehlt, wird gesagt.
        let p0 = packs(ci);
        r = werkzeug(ci, ['--nur-lokal'], ymlEnv);
        if (r.code !== 0 || !/Nichts geschrieben\.\s*$/.test(r.aus) || packs(ci) !== p0) f.push('C7-Aufruf (`austausch.mjs --nur-lokal`) im Teilabruf: Exit ' + r.code + ', Packs ' + p0 + ' → ' + packs(ci) + ' (erwartet: keines nachgeladen)');
        // `--nur-lokal` liest das Brett nur im Arbeitsbaum; das gewoehnliche `lesen` (ohne holen) alle Refs, die git kennt.
        r = werkzeug(ci, [], ymlEnv);
        if (r.code !== 0 || packs(ci) !== p0 || !/unlesbare Datei\(en\): [^\n]*2026-01-05-aaaaaaaa-befund-gross\.json \[origin\/claude\/gross\] Blob nicht im lokalen Objektspeicher/.test(r.aus)) f.push('lesen (alle Refs) im Teilabruf: Exit ' + r.code + ', Packs ' + p0 + ' → ' + packs(ci) + ' — nennt die nicht geholte Eintragsdatei nicht mit Quelle und Grund: ' + kurz1((r.aus.match(/!![^\n]*unlesbar[^\n]*/) || ['(keine Zeile)'])[0], 200));
        r = werkzeug(ci, ['naechste', '--nur-lokal'], ymlEnv);
        if (r.code !== 2 || !/Nicht rechenbar: [^\n]*nicht im lokalen Objektspeicher[^\n]*origin\/claude\/eins:STATUS\.md/.test(r.aus) || packs(ci) !== p0) f.push('`naechste` im Teilabruf: Exit ' + r.code + ', Packs ' + p0 + ' → ' + packs(ci) + ' — erwartet Exit 2, „nicht im lokalen Objektspeicher" mit origin/claude/eins:STATUS.md, nichts nachgeladen · ' + kurz1(r.aus, 200));
        // ── 5. Dieselben Lesewege OHNE die Variable — und mit einem git, das sie nicht kennt (eine Huelle, die sie streicht).
        delete process.env.GIT_NO_LAZY_FETCH;
        const lesen = (wo) => {
          const b = A.brettLesen(ci, { alleRefs: true }), m = A.vergebeneMarken(ci, Date.now(), 14), h = A.haltsDiesesStands(ci, pr);
          if (packs(ci) !== p0) f.push(wo + ': brettLesen/vergebeneMarken/haltsDiesesStands haben nachgeladen (Packs ' + p0 + ' → ' + packs(ci) + ')');
          return { b, m, h };
        };
        let { b, m, h } = lesen('ohne GIT_NO_LAZY_FETCH');
        const fehl = b.fehlend.map(y => y.quelle + ':' + path.posix.basename(y.pfad));
        if (fehl.join() !== 'origin/claude/gross:2026-01-05-aaaaaaaa-befund-gross.json' || !b.unlesbar.some(u => u.quelle === 'origin/claude/gross' && /nicht im lokalen Objektspeicher/.test(u.grund))) f.push('brettLesen nennt den fehlenden Blob nicht (genau einer, mit Quelle): ' + JSON.stringify(fehl));
        if (!m.grund || !/nicht im lokalen Objektspeicher/.test(m.grund) || !(m.fehlt || []).some(y => y === 'origin/claude/eins:index.html')) f.push('vergebeneMarken rechnet ohne STATUS.md und index.html der frischen Branches (erwartet „nicht rechenbar" mit origin/claude/eins:index.html): ' + kurz1(m.grund || JSON.stringify(m.versionen), 200));
        const treffer = (y) => (y.treffer || []).map(t => t.h.e.id).sort().join();
        if (h.grund || treffer(h) !== [andere, vHalt].sort().join() || h.fehlend !== 1 || h.fehlendAb !== Number(k1) * 1024) f.push('haltsDiesesStands im PR (Teilabruf): ' + (h.grund || treffer(h)) + ', fehlend ' + h.fehlend + ' ab ' + h.fehlendAb + ' — erwartet beide fremden Halts, 1 fehlende Datei ab ' + k1 + ' KB, rechenbar');
        const bin = path.join(eltern, 'bin'); fs.mkdirSync(bin);
        const echtGit = cp.execFileSync('bash', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
        fs.writeFileSync(path.join(bin, 'git'), '#!/bin/bash\nunset GIT_NO_LAZY_FETCH\nexec "' + echtGit + '" "$@"\n', { mode: 0o755 });
        // Kontrolle: die Huelle macht die Variable wirklich wirkungslos (eine Kopie laedt mit ihr nach).
        const kontrolle = path.join(eltern, 'kontrolle'); fs.cpSync(ci, kontrolle, { recursive: true });
        cp.spawnSync('git', ['-C', kontrolle, 'cat-file', '-e', grossBlob], { env: Object.assign({}, process.env, { PATH: bin + ':' + altPfad, GIT_NO_LAZY_FETCH: '1' }) });
        if (packs(kontrolle) !== p0 + 1) f.push('Aufbau: die git-Huelle ohne GIT_NO_LAZY_FETCH laedt nicht nach (Packs ' + p0 + ' → ' + packs(kontrolle) + ') — der folgende Teil misst nichts');
        process.env.PATH = bin + ':' + altPfad;
        ({ b, m, h } = lesen('mit einem git, das GIT_NO_LAZY_FETCH nicht kennt'));
        process.env.PATH = altPfad;
        if (b.fehlend.length !== 1 || !m.grund || treffer(h) !== [andere, vHalt].sort().join()) f.push('mit einem git, das GIT_NO_LAZY_FETCH nicht kennt: fehlend ' + b.fehlend.length + ', Marken ' + (m.grund ? 'nicht rechenbar' : 'GERECHNET') + ', Treffer ' + treffer(h));
        // ── 6. Ein fehlender Blob nimmt den anderen nichts: auch ohne Baeume (kein Vorab-Blick), ohne erreichbares origin.
        let bl = A.blobsLesen(ci, [klein1, grossBlob, klein2]);
        if (!bl.has(klein1) || !bl.has(klein2) || bl.fehlt.join() !== grossBlob || packs(ci) !== p0) f.push('blobsLesen [klein, fehlend, klein] ohne Baeume: gelesen ' + [klein1, klein2].filter(y => bl.has(y)).length + ' von 2, fehlt ' + bl.fehlt.length + ', Packs ' + p0 + ' → ' + packs(ci) + ' (erwartet 2 gelesen, 1 fehlt, nichts nachgeladen)');
        const ciWeg = path.join(eltern, 'ci-ohne-origin'); fs.cpSync(ci, ciWeg, { recursive: true }); g(ciWeg, ['config', 'remote.origin.url', 'file://' + path.join(eltern, 'gibt-es-nicht.git')]);
        bl = A.blobsLesen(ciWeg, [klein1, grossBlob, klein2]);
        if (!bl.has(klein1) || !bl.has(klein2) || bl.fehlt.join() !== grossBlob) f.push('blobsLesen ohne erreichbares origin: gelesen ' + [klein1, klein2].filter(y => bl.has(y)).length + ' von 2 — ein fehlender Blob nimmt den anderen alles');
        const hWeg = A.haltsDiesesStands(ciWeg, pr);
        if (hWeg.grund || treffer(hWeg) !== [andere, vHalt].sort().join()) f.push('A8-Rechnung ohne erreichbares origin: ' + (hWeg.grund || treffer(hWeg) || 'keiner beruehrt') + ' — erwartet beide fremden Halts');
        // Die Form neuerer git („<oid> missing", Exit 0) — in einem gewoehnlichen Repo ohne Promisor.
        bl = A.blobsLesen(src, [klein1, 'f'.repeat(40), klein2]);
        if (!bl.has(klein1) || !bl.has(klein2) || bl.fehlt.join() !== 'f'.repeat(40)) f.push('blobsLesen mit „<oid> missing": gelesen ' + [klein1, klein2].filter(y => bl.has(y)).length + ' von 2, fehlt ' + JSON.stringify(bl.fehlt));
        // ── 7. A8 ist NICHT PRUEFBAR, wo „keiner beruehrt" eine Taeuschung waere — als Prozess, wie in der CI.
        const a8 = (wo) => {
          fs.mkdirSync(path.join(wo, 'scripts'), { recursive: true });
          for (const n of ['austausch_check.js', '_austausch.mjs', 'austausch.mjs']) fs.copyFileSync(path.join(__dirname, n), path.join(wo, 'scripts', n));
          const y = cp.spawnSync(process.execPath, [path.join(wo, 'scripts', 'austausch_check.js')], { encoding: 'utf8', env: Object.assign({}, process.env, pr, ymlEnv, { AUSTAUSCH_FALL: 'A8' }) });
          return { code: y.status, aus: y.stdout + y.stderr };
        };
        r = a8(ciOhne);
        if (r.code !== 2 || !/--   A8 [^\n]*\n\s*→ nicht pruefbar: nur 1 Remote-Ref/.test(r.aus)) f.push('A8 ohne den Schritt „Branches fuer das Brett" (nur pull/1/merge): Exit ' + r.code + ' — erwartet „nicht pruefbar: nur 1 Remote-Ref" · ' + kurz1((r.aus.match(/ A8 [^\n]*\n[^\n]*/) || [r.aus])[0].replace(/ · [^[]*\[/, ' ['), 200));
        r = a8(ci);
        if (r.code !== 0 || !/ok   A8 [^\n]*\[1 Eintragsdatei\(en\) nicht geholt \(Teilabruf: je mindestens 200 KB[^\n]*!! BERUEHRT: /.test(r.aus) || r.aus.indexOf(andere) < 0) f.push('A8 im Teilabruf mit dem Schritt: Exit ' + r.code + ' — erwartet ok, die Zahl der nicht geholten Dateien und BERUEHRT mit dem fremden Halt · ' + kurz1((r.aus.match(/A8 [^\n]*\[[^\n]*/) || [r.aus])[0].replace(/^A8 [^[]*/, ''), 240));
        const ciNone = path.join(eltern, 'ci-blob-none'); fs.cpSync(ci, ciNone, { recursive: true }); g(ciNone, ['config', 'remote.origin.partialclonefilter', 'blob:none']);
        h = A.haltsDiesesStands(ciNone, pr);
        if (!h.nichtPruefbar || !/koennte ein Halt liegen[^\n]*2026-01-05-aaaaaaaa-befund-gross\.json \{origin\/claude\/gross\}/.test(h.grund || '')) f.push('A8 bei --filter=blob:none (ein fehlender Blob koennte ein Eintrag sein): ' + (h.grund || ('rechenbar, ' + treffer(h))) + ' — erwartet „nicht pruefbar" mit der Datei');
        // ── 8. Dieselben Bytes unter mehreren Namen (gewoehnlicher Klon, damit auch die Ankunftszeit rechnet).
        g(src, ['fetch', '-q', 'origin']); g(src, ['checkout', '-q', '--detach', 'refs/remotes/origin/main']);
        b = A.brettLesen(src, { alleRefs: true });
        const vE = b.eintraege.find(e => e.id === vHalt), q = vE && vE._quellen ? [...vE._quellen].sort().join() : '';
        if (q !== 'origin/aaa/x,origin/aaa/y,origin/claude/v') f.push('derselbe Halt unter drei gueltigen Namen ist nicht EINE Fassung mit drei Quellen: ' + (q || 'nicht im Brett'));
        if (vE && vE._datei === giftName) f.push('die Fassung traegt den vergifteten Namen der Kopie (' + giftName.slice(16) + ') — der Halt waere ungueltig');
        // (Die 230-KB-Datei auf claude/gross ist hier gelesen und unlesbar „groesser als 64 KB" — sie zaehlt hier nicht.)
        const kopien = b.unlesbar.filter(u => u.quelle !== 'origin/claude/gross'), unl = kopien.map(u => u.quelle + ':' + u.datei);
        if (unl.join() !== 'origin/aab/z:' + fremdName || !/Dateiname passt nicht/.test((kopien[0] || {}).grund)) f.push('unlesbar sollte genau die Kopie mit fremder id sein, gemeldet: ' + JSON.stringify(unl));
        const orte = b.unlesbarOrte.filter(u => u.blob === klein2).map(u => u.quelle);
        if (orte.join() !== 'origin/aab/z') f.push('unlesbare Orte der Halt-Bytes: ' + JSON.stringify(orte) + ' — erwartet nur origin/aab/z');
        const sw = A.schwarm(b.eintraege, Date.now(), { wo: b.wo, ich: 'sitzung/claude/leser' });
        if (!sw.halts.some(y => y.e.id === vHalt) || sw.unwirksam.some(y => y.e.id === vHalt)) f.push('der Halt auf claude/v ist trotz byte-gleicher Kopien nicht WIRKSAM: ' + (sw.unwirksam.filter(y => y.e.id === vHalt).map(y => y.grund).join(' | ') || 'nicht unter den Halts'));
        r = werkzeug(src, ['zeige', vHalt.slice(-8)]);
        if (!/Wirkt jetzt: ja, bis/.test(r.aus)) f.push('`zeige` nennt den Halt mit Kopien nicht wirksam: ' + kurz1((r.aus.match(/Wirkt jetzt:[^\n]*/) || ['(nichts)'])[0], 160));
        if (f.length) return { ok: false, warum: f.join(' · ') };
        return { ok: true, info: 'pruefstaende.yml: checkout (Tiefe 2, ohne Token) → Branches (promisor, ' + k1 + 'k > ' + (A.EINTRAG_MAX_BYTES / 1024) + ' KB) → Prüfstände (GIT_NO_LAZY_FETCH=' + nl + ') · Nachbau mit ' + remoteRefs.length + ' Refs: C7-Aufruf und naechste ohne neues Pack, auch ohne Variable und mit einem git, das sie nicht kennt · fehlende Datei mit Quelle genannt, Marken nicht rechenbar · ein fehlender Blob nimmt dem Rest nichts (auch ohne origin, auch „missing") · A8: ohne Branches und bei blob:none nicht pruefbar, sonst BERUEHRT mit 1 nicht geholter Datei · ein Halt unter 3 Namen: eine Fassung, wirksam, nur die fremde id unlesbar' };
      } catch (e) { return { ok: false, warum: 'Ausnahme: ' + String(e.message).split('\n')[0] }; } finally { process.env.PATH = altPfad; if (altNl == null) delete process.env.GIT_NO_LAZY_FETCH; else process.env.GIT_NO_LAZY_FETCH = altNl; weg(eltern); }
    },
  },
  {
    // Gegenpruefung 3 (Linse „werkzeug" R3-29 … R3-43, Linse „pruefstand" R3-54): was das Werkzeug DRUCKT und WEM es
    // etwas sagt. Jede Zeile hat ihre Gegenprobe (eine Regel zurueckgebaut → genau dieser Fall rot).
    name: 'C19 · Was das Werkzeug druckt und wem es etwas sagt · als PROZESS: ein gelieferter Pfad sieht aus wie ein Repo-Pfad (sonst unlesbar und nie roh gedruckt; der gedruckte Befehl laeuft in bash und liefert die Datei, auch mit Umlaut und ungekuerzt); AN DICH nennt einen Halt an dich und deinen Namen auch als sitzung/… und origin/…, nie als Teil eines anderen; `an` folgt git check-ref-format; `naechste --json` endet bei „Nicht rechenbar" mit Exit 2; Holen hat eine Frist; „fehlt auf origin" nur, wenn HEAD nicht in main steht; der Force-Push-Satz nur fuer den Branch, auf den gepusht wird, und ohne Eintraege von main; eigene und abgelaufene Aufhebungen, Antworten auf Abgelaufenes, sieben Antworten, KRITISCH nur gueltig, `nehme` holt vorher',
    lauf: () => {
      const eltern = tmp('werkzeug3'), bare = path.join(eltern, 'origin.git'), d = path.join(eltern, 'klon');
      const id = (r) => { const m = r.aus.match(/\n {2}(\d{4}-\d{2}-\d{2}-[0-9a-f]{4,8}) /); return m ? m[1] : null; };
      const ids = (r) => [...r.aus.matchAll(/\n {2}(\d{4}-\d{2}-\d{2}-[0-9a-f]{8}) {2}\(/g)].map(m => m[1]);   // `einspielen`: in Stapel-Reihenfolge
      const block = (aus, kopf) => { const i = aus.indexOf('\n' + kopf); if (i < 0) return ''; const rest = aus.slice(i + 1), j = rest.slice(1).search(/\n[A-Z][A-Z ]+[A-Z]( \(|\n|$)/); return j < 0 ? rest : rest.slice(0, j + 1); };
      const jetzt = (dh) => new Date(Date.now() + (dh || 0) * 36e5);
      const stamp = (dt) => ({ datum: dt.toISOString().slice(0, 10), zeit: dt.toISOString().slice(11, 19) });
      const bisIn = (h) => jetzt(h).toISOString().replace(/\.\d{3}Z$/, 'Z');
      const push = (zweig, msg) => { g(d, ['add', '-A']); g(d, ['commit', '-q', '--allow-empty', '-m', msg]); g(d, ['push', '-q', '-u', 'origin', zweig]); };
      const stapel = (liste) => { const p = path.join(eltern, 'stapel.json'); fs.writeFileSync(p, JSON.stringify(liste)); return werkzeug(d, ['einspielen', p]); };
      const ICH = 'claude/c19-x-2', ich0 = 'sitzung/' + ICH, ANDERE = 'claude/c19-andere';
      const o2 = repo('werkzeug3-ohne');
      try {
        const f = [];
        cp.execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare]);
        fs.mkdirSync(d); g(d, ['init', '-q', '-b', 'main', '.']); g(d, ['remote', 'add', 'origin', 'file://' + bare]);
        fs.writeFileSync(path.join(d, 'index.html'), QUELLE); fs.writeFileSync(path.join(d, 'sw.js'), "const VERSION = 'gs-v1.00';\n");
        let r = werkzeug(d, ['neu', 'befund', '--von', 'sitzung/start', '--titel', 'Ein Befund zum Nehmen', '--beleg', 'gemessen: 1']); const b0 = id(r);
        push('main', 'start');
        // ── ICH: zwei Fragen, zwei Halts (einen hebe ich selbst auf), eine laufende Lage; von Hand zwei abgelaufene Halts
        //    und eine abgelaufene Lage (vor 3 h geschrieben, vor 1 h abgelaufen).
        g(d, ['checkout', '-q', '-b', ICH, 'main']);
        r = stapel([
          { art: 'frage', an: 'alle', titel: 'Frage mit sieben Antworten' },
          { art: 'frage', an: 'alle', titel: 'Agent sucht die Messreihe — bitte liefern' },
          { schluessel: 'h1', art: 'halt', geltung: ['gsEins'], bis: bisIn(6), titel: 'Halt, den ich selbst aufhebe', text: 'ich baue gsEins um' },
          { art: 'halt', geltung: ['gsEins'], bis: bisIn(6), titel: 'Halt, den ein anderer aufhebt', text: 'ich baue gsEins weiter um' },
          { art: 'lage', phase: 'laeuft', bis: bisIn(3), titel: 'Laufende Lage' },
          { art: 'abschluss', ergebnis: 'aufgehoben', text: 'selbst erledigt', titel: 'Aufgehoben: mein eigener Halt', bezug: [{ art: 'schliesst', id: '@h1' }] },
        ]);
        const [f7, fl, h1, h3, l1] = ids(r);
        const alt = stamp(jetzt(-3));
        const h2 = mk('halt', Object.assign({ id: alt.datum + '-f19a0002', von: ich0, titel: 'Abgelaufener Halt, aufgehoben', text: 'war einmal', bis: bisIn(-1) }, alt));
        const h4 = mk('halt', Object.assign({ id: alt.datum + '-f19a0004', von: ich0, titel: 'Abgelaufener Halt mit Antwort', text: 'war auch einmal', bis: bisIn(-1) }, alt));
        const l2 = mk('lage', Object.assign({ id: alt.datum + '-f19a0005', von: ich0, titel: 'Abgelaufene Lage', bis: bisIn(-1) }, alt));
        [h2, h4, l2].forEach(e => ablegen(d, e));
        if (!b0 || !f7 || !fl || !h1 || !h3 || !l1) return { ok: false, warum: 'Aufbau: eigene Eintraege nicht geschrieben — ' + kurz(r.aus, 300) };
        push(ICH, 'ich');
        // ── W4: sieben Antworten auf meine Frage → 6 Zeilen und „+1 weitere".
        g(d, ['checkout', '-q', '-b', ANDERE, 'main']); g(d, ['fetch', '-q', 'origin']);
        r = stapel(Array.from({ length: 7 }, (_, i) => ({ art: 'antwort', titel: 'Antwort ' + (i + 1), text: 'Gemessen: ' + (i + 1), bezug: [{ art: 'beantwortet', id: f7 }] })));
        if (ids(r).length !== 7) return { ok: false, warum: 'Aufbau: sieben Antworten nicht geschrieben — ' + kurz(r.aus, 300) };
        push(ANDERE, 'sieben Antworten');
        g(d, ['checkout', '-q', ICH]);
        let dich = block(werkzeug(d, ['holen']).aus, 'DICH BETREFFEND');
        const n7 = (dich.match(new RegExp('ANTWORT [^\\n]*auf deine Frage ' + f7, 'g')) || []).length;
        if (n7 !== 6 || !/… \+1 weitere Antworten auf deine Eintraege/.test(dich)) f.push('W4 · sieben Antworten auf meine Frage: ' + n7 + ' Zeilen' + (/\+1 weitere Antworten/.test(dich) ? '' : ', ohne „+1 weitere"') + ' — erwartet 6 und „+1 weitere"');
        // ── ANDERE: Antworten auf meine abgelaufenen und die laufende Lage, zwei Aufhebungen, ein Halt AN MICH, sechs
        //    Fragen mit meinem Namen (drei Schreibweisen, drei Mal als Teil von claude/c19-x-22), ein gueltiger und ein
        //    ungueltiger kritischer Befund, Fragen an Sitzungen mit Namen, die git annimmt — und zwei Lieferungen: eine
        //    mit Umlaut (lang genug, dass 260 Zeichen sie abschnitten), eine von Hand mit $(…) im Pfad.
        g(d, ['checkout', '-q', ANDERE]);
        const lang = 'docs/pläne/lange-messreihe-vom-kalender-und-der-wochenzeile-heute.md', boese = 'docs/mess.md$(touch ZZ_PWNED)';
        fs.mkdirSync(path.join(d, 'docs', 'pläne'), { recursive: true }); fs.writeFileSync(path.join(d, lang), 'gemessen: 3\n'); fs.writeFileSync(path.join(d, boese), 'x\n');
        g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'Dateien']);
        const kopfA = g(d, ['rev-parse', 'HEAD']).trim();
        r = werkzeug(d, ['antworte', fl, '--text', 'liegt da', '--geliefert', boese]);
        if (r.code !== 2 || !/sieht nicht aus wie ein Repo-Pfad/.test(r.aus)) f.push('R3-29 · `antworte --geliefert` nimmt einen Pfad mit $(…) an (Exit ' + r.code + ')');
        r = stapel([
          { art: 'antwort', titel: 'Antwort auf den abgelaufenen Halt', text: 'zu spaet', bezug: [{ art: 'baut_auf', id: h4.id }] },
          { art: 'antwort', titel: 'Antwort auf die abgelaufene Lage', text: 'zu spaet', bezug: [{ art: 'baut_auf', id: l2.id }] },
          { art: 'antwort', titel: 'Antwort auf die laufende Lage', text: 'rechtzeitig', bezug: [{ art: 'baut_auf', id: l1 }] },
          { art: 'abschluss', ergebnis: 'aufgehoben', titel: 'Aufgehoben: der abgelaufene', text: 'war ohnehin vorbei', bezug: [{ art: 'schliesst', id: h2.id }] },
          { art: 'abschluss', ergebnis: 'aufgehoben', titel: 'Aufgehoben: der laufende', text: 'main ist wieder gruen', bezug: [{ art: 'schliesst', id: h3 }] },
          { art: 'halt', geltung: ['sw.js'], an: ich0, bis: bisIn(5), titel: 'Halt an dich', text: 'bitte sw.js nicht anfassen' },
          { art: 'frage', an: 'alle', titel: 'Bitte sitzung/' + ICH + ': misst du die Kachel?' },
          { art: 'frage', an: 'alle', titel: 'Den Fall aus origin/' + ICH + ' nach main holen?' },
          { art: 'frage', an: 'alle', titel: 'Bitte ' + ICH + ': misst du noch einmal?' },
          { art: 'frage', an: 'alle', titel: 'Hat ' + ICH + '2 schon gemessen?' },
          { art: 'frage', an: 'alle', titel: 'Fragt sitzung/' + ICH + '2 noch?' },
          { art: 'frage', an: 'alle', titel: 'Liegt es auf origin/' + ICH + '2?' },
          { art: 'befund', dringlichkeit: 'kritisch', titel: 'Live: der Kalender zaehlt doppelt', beleg: ['gemessen: 2 statt 1'] },
        ]);
        const p2 = ids(r);
        if (p2.length !== 13) return { ok: false, warum: f.concat('Aufbau: der zweite Stapel wurde nicht geschrieben (' + p2.length + ' von 13) — ' + kurz(r.aus, 400)).join(' · ') };
        r = stapel([{ art: 'frage', an: 'sitzung/claude/fix(2)', titel: 'Eine Frage an fix(2)' }, { art: 'frage', an: 'sitzung/claude/' + 'l'.repeat(130), titel: 'Eine Frage an einen langen Branch-Namen' }]);
        if (r.code !== 0 || ids(r).length !== 2) f.push('R3-38 · `an: sitzung/claude/fix(2)` und ein Branch-Name mit 137 Zeichen (git nimmt beide an) werden abgewiesen: ' + kurz(r.aus.replace(/\s+/g, ' '), 200));
        const [haltAn, s1, s2, s3, x1, x2, x3, krit] = p2.slice(5, 13);
        const kaputtK = mk('befund', Object.assign({ id: stamp(jetzt()).datum + '-f19a0007', von: 'sitzung/' + ANDERE, titel: 'Kritisch, aber ohne Beleg', dringlichkeit: 'kritisch' }, stamp(jetzt())));
        delete kaputtK.beleg; ablegen(d, kaputtK);
        const boeseA = mk('antwort', Object.assign({ id: stamp(jetzt()).datum + '-f19a0008', von: 'sitzung/' + ANDERE, titel: 'Geliefert (boese)', text: 'liegt da', bezug: [{ art: 'beantwortet', id: fl, ref: 'origin/' + ICH }], geliefert: [{ pfad: boese, commit: kopfA }] }, stamp(jetzt())));
        ablegen(d, boeseA);
        r = werkzeug(d, ['neu', 'frage', '--an', 'sitzung/claude/fix+v2.1@team', '--titel', 'Kann fix+v2.1 die Kachel messen?']); const anFix = id(r);
        if (r.code !== 0 || !anFix) f.push('R3-38 · `--an sitzung/claude/fix+v2.1@team` (git nimmt den Namen an) wird abgewiesen (Exit ' + r.code + ')');
        r = werkzeug(d, ['neu', 'frage', '--an', 'sitzung/claude/a..b', '--titel', 'Eine Frage an einen unmoeglichen Namen']);
        if (r.code !== 1 || !/NICHT geschrieben[\s\S]*an: alle/.test(r.aus)) f.push('R3-38 · `--an sitzung/claude/a..b` (git weist den Namen ab) wird angenommen (Exit ' + r.code + ')');
        r = werkzeug(d, ['antworte', fl, '--text', 'liegt auf ' + ANDERE, '--geliefert', lang]); const lief = id(r);
        if (r.code !== 0 || !lief) f.push('R3-29 · eine Lieferung mit Umlaut im Pfad wird abgewiesen (Exit ' + r.code + ') · ' + kurz(r.aus, 200));
        push(ANDERE, 'andere');
        // R3-29 im Modul: jede Form eines Shell-Wegs ist ungueltig, ein Repo-Pfad (auch mit Umlaut) gueltig — und keine
        // Datei des echten Repos ist zu eng gefasst.
        const lieferung = (pfad, commit) => mk('antwort', { bezug: [{ art: 'beantwortet', id: fl }], geliefert: [{ pfad, commit: commit || kopfA }] });
        for (const p of [boese, 'docs/a`id`.md', 'docs/a;b.md', 'docs/a|b.md', 'docs/a&b.md', 'docs/a b.md', "docs/a'b.md", 'docs/a"b.md', 'docs/a\\b.md', 'docs/a>b.md', 'docs/a\nb.md', '-x', 'docs/-x', '../x', '/etc/x', 'docs//x'])
          if (!A.eintragPruefen(lieferung(p)).some(x => /^geliefert\[0\]/.test(x))) f.push('R3-29 · eintragPruefen nimmt den gelieferten Pfad ' + JSON.stringify(p) + ' an');
        if (!A.eintragPruefen(lieferung('docs/x.md', '$(touch ZZ_PWNED)' + '0'.repeat(23))).some(x => /^geliefert\[0\]/.test(x))) f.push('R3-29 · eintragPruefen nimmt einen Commit an, der keine 40 Hexstellen sind');
        for (const p of [lang, '.github/workflows/brett-waechter.yml']) { const w = A.eintragPruefen(lieferung(p)); if (w.length) f.push('R3-29 · ein gueltiger Pfad (' + p + ') wird abgewiesen: ' + w[0]); }
        const zuEng = g(WURZEL, ['-c', 'core.quotePath=false', 'ls-files']).split('\n').filter(Boolean).filter(p => !A.lieferPfadOk(p));
        if (zuEng.length) f.push('R3-29 · ' + zuEng.length + ' Datei(en) des echten Repos waeren nicht lieferbar (die Liste ist zu eng): ' + zuEng.slice(0, 3).join(', '));
        // ── ICH liest: alles, was mich betrifft — und nichts, was mich nicht (mehr) betrifft.
        g(d, ['checkout', '-q', ICH]);
        r = werkzeug(d, ['holen', '--alles']); const ichSicht = r.aus;
        dich = block(r.aus, 'DICH BETREFFEND');
        if (r.aus.indexOf('$(touch') >= 0) f.push('R3-29 · der Pfad mit $(…) steht in der Ausgabe');
        if (!/unlesbare Datei[^\n]*f19a0008-antwort-x\.json \[origin\/claude\/c19-andere\] falsch geformt: geliefert/.test(r.aus)) f.push('R3-29 · die Lieferung mit $(…) im Pfad wird beim Lesen nicht als unlesbar genannt');
        const gl = dich.split('\n').filter(z => /GELIEFERT /.test(z));
        const umlaut = gl.find(z => z.indexOf(lang) >= 0) || '';
        if (!/GELIEFERT docs\/pläne\/[^ ]+ @ [0-9a-f]{12} +→ git fetch origin && git show '[0-9a-f]{40}:docs\/pläne\/[^']+\.md' +\(nach einem Squash-Merge: git show 'origin\/main:docs\/pläne\/[^']+\.md'\)$/.test(umlaut)) f.push('R3-29 · die Lieferung mit Umlaut steht nicht ungekuerzt und gequotet da: ' + kurz(umlaut || '(keine Zeile)', 200));
        for (const z of gl) {   // jeder gedruckte Befehl, so gefahren, wie eine Sitzung ihn kopiert
          const bef = (z.match(/→ (.*?) {3}\(nach einem Squash-Merge/) || [])[1];
          let aus = null; try { aus = bef ? cp.execFileSync('bash', ['-c', bef], { cwd: d, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) : null; } catch (_) {}
          if (z === umlaut && aus !== 'gemessen: 3\n') f.push('R3-29 · der gedruckte Befehl liefert die Datei nicht: ' + kurz(bef, 160) + ' → ' + JSON.stringify(aus));
        }
        if (fs.existsSync(path.join(d, 'ZZ_PWNED'))) f.push('R3-29 · ein gedruckter Befehl hat $(touch ZZ_PWNED) ausgefuehrt');
        r = werkzeug(d, ['zeige', lief]);
        if (!/Geliefert: docs\/pläne\/[^ ]+ @ [0-9a-f]{40} +→ git show '[0-9a-f]{40}:docs\/pläne\/[^']+' +\(nach einem Squash-Merge: git show 'origin\/main:docs\/pläne\/[^']+'\)/.test(r.aus)) f.push('R3-29 · `zeige` quotet den gelieferten Pfad nicht: ' + kurz((r.aus.match(/Geliefert:[^\n]*/) || ['(nichts)'])[0], 200));
        if (new RegExp('auf deinen Halt ' + h4.id).test(dich) || new RegExp('auf deine Lage ' + l2.id).test(dich)) f.push('W5 · eine Antwort auf meinen ABGELAUFENEN Halt oder meine abgelaufene Lage steht unter DICH BETREFFEND');
        if (!new RegExp('ANTWORT [^\\n]*auf deine Lage ' + l1).test(dich)) f.push('W5 · die Antwort auf meine LAUFENDE Lage fehlt (der Fall misst sonst nichts)');
        if (new RegExp('AUFGEHOBEN dein Halt ' + h1).test(dich)) f.push('W2 · meine EIGENE Aufhebung steht als AUFGEHOBEN unter DICH BETREFFEND');
        if (new RegExp('AUFGEHOBEN dein Halt ' + h2.id).test(dich)) f.push('W3 · ein aufgehobener, inzwischen ABGELAUFENER Halt steht weiter unter DICH BETREFFEND');
        if (!new RegExp('AUFGEHOBEN dein Halt ' + h3 + ' durch [^\\n]*main ist wieder gruen').test(dich)) f.push('W2/W3 · die Aufhebung meines LAUFENDEN Halts durch einen anderen fehlt (der Fall misst sonst nichts)');
        if (!new RegExp('AN DICH ' + haltAn + ' \\{origin/claude/c19-andere\\} von sitzung/claude/c19-andere: HALT bis ').test(dich)) f.push('R3-36 · ein wirksamer Halt mit an: ' + ich0 + ' steht nicht unter AN DICH');
        for (const [x, wie] of [[s1, 'sitzung/<branch>'], [s2, 'origin/<branch>'], [s3, '<branch>']]) if (!new RegExp('AN DICH ' + x + ' ').test(dich)) f.push('R3-37 · AN DICH erkennt den eigenen Namen als ' + wie + ' nicht');
        for (const [x, wie] of [[x1, ICH + '2'], [x2, 'sitzung/' + ICH + '2'], [x3, 'origin/' + ICH + '2']]) if (new RegExp('AN DICH ' + x + ' ').test(dich)) f.push('R3-37 · AN DICH trifft „' + wie + '" (der eigene Name als Teil eines anderen)');
        const kr = block(ichSicht, 'KRITISCH');
        if (kr.indexOf(krit) < 0 || kr.indexOf(kaputtK.id) >= 0) f.push('W13 · KRITISCH zeigt ' + (kr.indexOf(krit) < 0 ? 'den gueltigen kritischen Befund nicht' : 'einen UNGUELTIGEN kritischen Befund (ohne Beleg)') + ': ' + kurz(kr, 200));
        // ── R3-38: eine Sitzung auf claude/fix+v2.1@team liest die Frage an sich; `an` folgt git check-ref-format.
        g(d, ['checkout', '-q', '--no-track', '-b', 'claude/fix+v2.1@team', 'origin/main']);
        if (!new RegExp('AN DICH ' + anFix + ' ').test(block(werkzeug(d, []).aus, 'DICH BETREFFEND'))) f.push('R3-38 · die Sitzung auf claude/fix+v2.1@team liest die Frage an sich nicht unter AN DICH');
        for (const n of ['claude/fix+v2.1@team', 'claude/fix(2)', 'c'.repeat(200), 'claude/a$b', 'pläne/x', 'claude/HEAD', 'claude/x.lock.y', 'claude/a..b', 'claude/x y', 'claude/x~1', 'claude/x^1', 'claude/x:y', 'claude/x?', 'claude/x*', 'claude/x[1', 'claude/x\\y', 'claude/x@{1}', '-x', 'claude/x.lock', 'claude/.x', 'claude/x.', 'claude/x/', '/x', 'a//b', 'HEAD', 'a\u0001b']) {
          let gitOk = true; try { cp.execFileSync('git', ['check-ref-format', '--branch', n], { cwd: d, stdio: 'ignore' }); } catch (_) { gitOk = false; }
          if (A.anGueltig('sitzung/' + n) !== gitOk) f.push('R3-38 · an: sitzung/' + JSON.stringify(n.length > 30 ? n.slice(0, 20) + '…' : n) + ' ist ' + (gitOk ? 'abgewiesen' : 'angenommen') + ', git sagt ' + (gitOk ? 'ja' : 'nein'));
        }
        for (const n of ['claude/x\u202eb', 'claude/x\u00a0b', 'c'.repeat(256)]) if (A.anGueltig('sitzung/' + n)) f.push('R3-38 · an: ein Name mit Format-/Trennzeichen aus Unicode oder ueber 255 Zeichen wird angenommen (bewusst strenger als git)');
        // ── R3-42: der eigene Branch ist auf origin weg — nach einem Merge still, nach einem Squash-Merge eine Frage, sonst ein Alarm.
        g(d, ['fetch', '-q', 'origin']);
        g(d, ['checkout', '-q', '--no-track', '-b', 'claude/c19-gemergt', 'origin/main']); fs.writeFileSync(path.join(d, 'gemergt.md'), 'g\n'); push('claude/c19-gemergt', 'gemergt');
        g(d, ['push', '-q', 'origin', 'HEAD:main']); g(d, ['push', '-q', 'origin', '--delete', 'claude/c19-gemergt']);
        r = werkzeug(d, ['holen']);
        if (/Dein Branch claude\/c19-gemergt (fehlt auf origin|ist auf origin nicht mehr da)/.test(r.aus)) f.push('R3-42 · nach einem normalen Merge (HEAD steht in origin/main) wird der geloeschte Branch gemeldet: ' + kurz((r.aus.match(/[^\n]*Dein Branch claude\/c19-gemergt[^\n]*/) || [''])[0], 160));
        g(d, ['checkout', '-q', '--no-track', '-b', 'claude/c19-squash', 'origin/main']); fs.writeFileSync(path.join(d, 'squash.md'), 's\n'); push('claude/c19-squash', 'squash-arbeit');
        g(d, ['checkout', '-q', '--detach', 'origin/main']); fs.writeFileSync(path.join(d, 'squash.md'), 's\n'); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'Squash']); g(d, ['push', '-q', 'origin', 'HEAD:main']);
        g(d, ['push', '-q', 'origin', '--delete', 'claude/c19-squash']); g(d, ['checkout', '-q', 'claude/c19-squash']);
        r = werkzeug(d, ['holen']);
        if (/!! Dein Branch claude\/c19-squash/.test(r.aus) || !/Dein Branch claude\/c19-squash ist auf origin nicht mehr da[^\n]*squash-gemergt\?/.test(r.aus)) f.push('R3-42 · nach einem Squash-Merge: ' + kurz((r.aus.match(/[^\n]*Dein Branch claude\/c19-squash[^\n]*/) || ['(keine Zeile)'])[0], 160) + ' — erwartet die Frage „squash-gemergt?", kein Alarm');
        g(d, ['checkout', '-q', '--no-track', '-b', 'claude/c19-weg', 'origin/main']); fs.writeFileSync(path.join(d, 'weg.md'), 'w\n'); push('claude/c19-weg', 'weg');
        g(d, ['push', '-q', 'origin', '--delete', 'claude/c19-weg']);
        r = werkzeug(d, ['holen']);
        if (!/!! Dein Branch claude\/c19-weg fehlt auf origin/.test(r.aus)) f.push('R3-42 · ein geloeschter, NICHT gemergter Branch wird nicht mehr gemeldet');
        // ── W6: der Force-Push-Satz zaehlt nur, was ausser auf dem Branch nirgends liegt — nicht, was auf main liegt.
        g(d, ['checkout', '-q', '--no-track', '-b', 'claude/c19-fp', 'origin/main']);
        const basisFp = g(d, ['rev-parse', 'HEAD']).trim();
        r = werkzeug(d, ['neu', 'idee', '--titel', 'Idee, die auch auf main liegt', '--nutzen', 'eins', '--pruefbar', 'ein Fall']); const e1 = id(r);
        push('claude/c19-fp', 'e1'); g(d, ['push', '-q', 'origin', 'HEAD:main']);
        r = werkzeug(d, ['neu', 'idee', '--titel', 'Idee nur auf dem Branch', '--nutzen', 'zwei', '--pruefbar', 'ein Fall']); const e2 = id(r);
        push('claude/c19-fp', 'e2');
        g(d, ['reset', '-q', '--hard', basisFp]);
        const fp = (werkzeug(d, []).aus.match(/!! origin\/claude\/c19-fp traegt[^\n]*/) || [''])[0];
        if (!e1 || !e2 || !/traegt 1 Eintrag/.test(fp) || fp.indexOf(e2) < 0 || fp.indexOf(e1) >= 0) f.push('W6 · Force-Push-Satz: ' + (fp || '(keine Zeile)') + ' — erwartet 1 Eintrag (' + e2 + '), nicht den, der auf main liegt');
        // ── W7 / R3-43: ein Upstream unter anderem Namen (ein fremder Branch). push.default simple: dorthin geht kein Push —
        //    kein Force-Push-Satz, EINE ruhige Zeile (auch mit --von). push.default upstream: dorthin geht er — der Satz steht da.
        g(d, ['checkout', '-q', '--no-track', '-b', 'claude/c19-feat', 'origin/main']);
        werkzeug(d, ['neu', 'idee', '--titel', 'Idee eins auf feat', '--nutzen', 'eins', '--pruefbar', 'ein Fall']); push('claude/c19-feat', 'i1');
        g(d, ['checkout', '-q', '-b', 'claude/c19-hilfe', 'origin/claude/c19-feat']);
        g(d, ['checkout', '-q', 'claude/c19-feat']);
        r = werkzeug(d, ['neu', 'idee', '--titel', 'Idee zwei auf feat, spaeter', '--nutzen', 'zwei', '--pruefbar', 'ein Fall']); const i2 = id(r); push('claude/c19-feat', 'i2');
        g(d, ['checkout', '-q', 'claude/c19-hilfe']);
        const upZeilen = (t) => t.split('\n').filter(z => z.indexOf('origin/claude/c19-feat') >= 0);
        dich = block(werkzeug(d, []).aus, 'DICH BETREFFEND');
        if (/!! origin\/claude\/c19-feat traegt/.test(dich) || upZeilen(dich).length !== 1) f.push('R3-43 · fremder Upstream, push.default simple: ' + upZeilen(dich).length + ' Zeile(n) dazu' + (/!! origin\/claude\/c19-feat traegt/.test(dich) ? ', darunter der Force-Push-Satz' : '') + ' — erwartet EINE ruhige');
        dich = block(werkzeug(d, [], { AUSTAUSCH_VON: 'sitzung/claude/c19-hilfe' }).aus, 'DICH BETREFFEND');
        if (upZeilen(dich).length !== 1 || !/Dein Upstream origin\/claude\/c19-feat ist ein anderer Branch[^\n]*git push -u origin HEAD/.test(dich)) f.push('R3-43 · fremder Upstream mit --von: ' + upZeilen(dich).length + ' Zeile(n) — erwartet die eine ruhige Zeile „git push -u origin HEAD"');
        g(d, ['config', 'push.default', 'upstream']);
        dich = block(werkzeug(d, []).aus, 'DICH BETREFFEND');
        g(d, ['config', '--unset', 'push.default']);
        if (!i2 || !new RegExp('!! origin/claude/c19-feat traegt 1 Eintrag[^\\n]*' + i2).test(dich)) f.push('W7 · push.default upstream (der Push ginge nach origin/claude/c19-feat): der Force-Push-Satz fehlt');
        // ── W16: `nehme` holt vorher — eine Uebernahme, die erst nach dem letzten fetch gepusht wurde, wird gesehen.
        g(d, ['checkout', '-q', '--no-track', '-b', 'claude/c19-nehmer', 'origin/main']);
        r = werkzeug(d, ['nehme', b0]); if (r.code !== 0) return { ok: false, warum: f.concat('Aufbau: `nehme` auf claude/c19-nehmer: Exit ' + r.code + ' · ' + kurz(r.aus, 200)).join(' · ') };
        push('claude/c19-nehmer', 'nehme');
        g(d, ['checkout', '-q', '--no-track', '-b', 'claude/c19-zweit', 'origin/main']); g(d, ['update-ref', '-d', 'refs/remotes/origin/claude/c19-nehmer']);
        if (A.brettLesen(d, { alleRefs: true }).eintraege.some(e => e.art === 'lage' && e.von === 'sitzung/claude/c19-nehmer')) f.push('Aufbau W16: die Uebernahme ist vor `nehme` schon bekannt — der Fall misst das Holen nicht');
        r = werkzeug(d, ['nehme', b0]);
        if (r.code !== 1 || !/schon uebernommen: sitzung\/claude\/c19-nehmer/.test(r.aus)) f.push('W16 · `nehme` ohne vorheriges Holen: Exit ' + r.code + ' — erwartet 1 („schon uebernommen" von claude/c19-nehmer)');
        // ── R3-39 und R3-40 in einem Repo OHNE origin, dann mit einem Remote, der haengt (`ext::sh -c sleep 8`).
        r = werkzeug(o2, ['naechste', '--json']); let j = null; try { j = JSON.parse(r.aus); } catch (_) {}
        if (r.code !== 2 || !j || !j.grund) f.push('R3-39 · `naechste --json` ohne origin: Exit ' + r.code + (j && j.grund ? '' : ', ohne „grund"') + ' — erwartet 2 wie im Text');
        g(o2, ['remote', 'add', 'origin', 'ext::sh -c sleep% 8']); g(o2, ['config', 'protocol.ext.allow', 'always']);
        for (const [args, satz] of [[['naechste'], /Holen hat nicht geklappt/], [['holen'], /Holen hat NICHT geklappt/]]) {
          const t0 = Date.now(); r = werkzeug(o2, args, { AUSTAUSCH_HOLEN_FRIST_MS: '1000' }); const ms = Date.now() - t0;
          if (ms < 900) f.push('Aufbau R3-40: `' + args[0] + '` endete nach ' + ms + ' ms — der Remote haengt nicht, der Fall misst die Frist nicht');
          else if (ms > 5000 || !satz.test(r.aus)) f.push('R3-40 · `' + args[0] + '` gegen einen haengenden Remote (Frist 1 s): ' + ms + ' ms' + (satz.test(r.aus) ? '' : ', ohne „Holen hat nicht geklappt"') + ' — erwartet hoechstens 5 s');
        }
        if (f.length) return { ok: false, warum: f.join(' · ') };
        return { ok: true, info: 'Lieferpfad: $(…) ` ; | & Leerraum Anfuehrung \\ - .. und kurzer Commit ungueltig, beim Lesen unlesbar, nie in der Ausgabe; Umlaut gueltig, gequotet, ungekuerzt, in bash gefahren = die Datei; alle Repo-Dateien lieferbar · AN DICH: Halt an dich, drei Schreibweisen, x-22 nicht · an = git check-ref-format (26 Namen) · naechste --json Exit 2 · Frist 1 s statt 8 s · fehlt auf origin: Merge still, Squash Frage, sonst Alarm · Force-Push ohne main, fremder Upstream nur mit push.default upstream · W2 W3 W4 W5 W13 W16' };
      } catch (e) { return { ok: false, warum: 'Ausnahme: ' + String(e.message).split('\n')[0] }; } finally { weg(eltern); weg(o2); }
    },
  },
  {
    name: 'C20 · Der Kern ueber Branches (Gegenpruefung 3) · als PROZESS: main ist GENAU origin/main (eine Kopie auf claude/main loescht keinen Halt, faelscht keinen, versteckt keinen Befund); ersetzen darf nur der Branch des Schreibers; die Ankunft rechnet nach Rebase richtig (Autor-Zeit), und ein Merge-Commit, ein `git mv` oder das Umschreiben eines alten Pfads machen eine rueckdatierte Lage NICHT wirksam; ein flacher Klon prueft nicht; die eigene Sicht nennt dieselbe Rueckdatierung wie die der anderen; nach `git branch -m` bleibt der eigene Halt eigen; Lage und Halt nur von einem eigenen Branch; einspielen schreibt keine Absicht in fremdem Namen; `nehme --auch` belegt keinen Platz, `lage --bezug baut_auf:` prueft wie `nehme`; `zeige` sagt „teilweise"',
    lauf: () => {
      const eltern = tmp('kern'), bare = path.join(eltern, 'origin.git'), d = path.join(eltern, 'klon');
      const id = (r) => { const m = r.aus.match(/\n {2}(\d{4}-\d{2}-\d{2}-[0-9a-f]{4,8}) /); return m ? m[1] : null; };
      try {
        const f = [];
        const jetzt = (dh) => new Date(Date.now() + (dh || 0) * 36e5);
        const stamp = (dt) => ({ datum: dt.toISOString().slice(0, 10), zeit: dt.toISOString().slice(11, 19) });
        const bisIn = (h) => jetzt(h).toISOString().replace(/\.\d{3}Z$/, 'Z');
        // git mit festen Zeiten (Autor UND Committer) — so faelscht und so arbeitet man ehrlich.
        const gz = (dir, args, t) => cp.execFileSync('git', ['-C', dir, '-c', 'user.email=pruefstand@example.com', '-c', 'user.name=pruefstand', '-c', 'commit.gpgsign=false'].concat(args), { encoding: 'utf8', env: Object.assign({}, process.env, t ? { GIT_AUTHOR_DATE: t.toISOString(), GIT_COMMITTER_DATE: t.toISOString() } : {}) });
        const zweig = (name, von, eintraege, t) => { g(d, ['checkout', '-q', '-B', name, von || 'origin/main']); for (const [e, n] of eintraege) ablegen(d, e, n); g(d, ['add', '-A']); gz(d, ['commit', '-q', '--allow-empty', '-m', name], t); g(d, ['push', '-q', '-f', 'origin', name]); g(d, ['checkout', '-q', '--detach', 'origin/main']); };
        const lesen = () => { g(d, ['fetch', '-q', '--prune', 'origin', '+refs/heads/*:refs/remotes/origin/*']); const b = A.brettLesen(d, { alleRefs: true }); return { b, sw: A.schwarm(b.eintraege, Date.now(), { wo: b.wo, ich: 'sitzung/claude/leser' }), abl: A.ableiten(b.eintraege) }; };
        const halt = (o) => mk('halt', Object.assign({ text: 'bitte warten', geltung: ['bump'] }, o));
        const lage = (o) => mk('lage', Object.assign({ phase: 'laeuft' }, o));
        cp.execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare]);
        fs.mkdirSync(d); g(d, ['init', '-q', '-b', 'main', '.']); g(d, ['remote', 'add', 'origin', 'file://' + bare]);
        fs.writeFileSync(path.join(d, 'index.html'), QUELLE); fs.writeFileSync(path.join(d, 'sw.js'), "const VERSION = 'gs-v1.00';\n");
        const t0 = stamp(jetzt(-30));
        const ziel = mk('befund', Object.assign({ id: t0.datum + '-b0000001', von: 'sitzung/start', titel: 'Ein Befund, den mehrere nehmen wollen' }, t0));
        const krit = mk('befund', Object.assign({ id: t0.datum + '-b0000002', von: 'sitzung/claude/opfer', dringlichkeit: 'kritisch', titel: 'Kritisch: der Kalender zaehlt doppelt' }, t0));
        const freie = [3, 4, 5, 6, 7, 8].map(i => mk('befund', Object.assign({ id: t0.datum + '-b000000' + i, von: 'sitzung/start', titel: 'Freier Befund ' + i }, t0)));
        for (const e of [ziel].concat(freie)) ablegen(d, e);
        g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'start']); g(d, ['push', '-q', 'origin', 'main']);
        zweig('claude/opfer', 'origin/main', [[krit]]);
        // 0. Der Arbeitsbaum gilt vor origin/main — fuer einen EIGENEN Eintrag (dort berichtigt ihn diese Sitzung gerade).
        //    Fuer einen FREMDEN gilt main: eine alte Kopie im eigenen Baum verdeckte sonst dessen Berichtigung (Gegenpruefung 4).
        { const pz = path.join(d, A.ORDNER, ziel.id.slice(0, 7), ziel.id + '-befund-x.json'); g(d, ['checkout', '-q', '--detach', 'origin/main']); fs.writeFileSync(pz, JSON.stringify(Object.assign({}, ziel, { titel: 'Im Arbeitsbaum berichtigt' }), null, 2) + '\n');
          const b0 = A.brettLesen(d, { alleRefs: true, ich: ['sitzung/start'] }), z0 = b0.eintraege.find(e => e.id === ziel.id);
          if (!z0 || z0.titel !== 'Im Arbeitsbaum berichtigt' || !b0.abweichend.some(x => x.id === ziel.id && /origin\/main/.test(x.weichtAb))) f.push('der Arbeitsbaum gilt nicht vor origin/main (eigener Eintrag): ' + (z0 ? '„' + z0.titel + '" {' + z0._quelle + '}' : 'nichts'));
          const b1 = A.brettLesen(d, { alleRefs: true, ich: ['sitzung/claude/jemand'] }), z1 = b1.eintraege.find(e => e.id === ziel.id);
          if (!z1 || z1.titel === 'Im Arbeitsbaum berichtigt') f.push('fuer einen FREMDEN Eintrag gilt die Kopie im Arbeitsbaum vor origin/main: ' + (z1 ? '„' + z1.titel + '"' : 'nichts'));
          g(d, ['checkout', '-q', '--', '.']); }
        // … und die Sicherung ist NIE der Branch eines Schreibers: ein Halt mit von = sitzung/zz-sicherung, den der Waechter
        // kopiert hat (hier: von Hand auf zz-sicherung gelegt), wirkt nicht.
        zweig('zz-sicherung', 'origin/main', [[halt(Object.assign({ id: stamp(jetzt(-1)).datum + '-c0000040', von: 'sitzung/zz-sicherung', bis: bisIn(6) }, stamp(jetzt(-1))))]]);
        // 1. main ist GENAU origin/main.
        const h1 = halt(Object.assign({ id: stamp(jetzt(-1)).datum + '-c0000001', von: 'sitzung/claude/opfer', bis: bisIn(6) }, stamp(jetzt(-1))));
        zweig('claude/opfer', 'origin/claude/opfer', [[h1]]);
        zweig('claude/main', 'origin/main', [[Object.assign({}, h1, { bis: bisIn(-0.5) })], [halt(Object.assign({ id: stamp(jetzt(-30)).datum + '-c0000002', von: 'sitzung/claude/jemand', bis: bisIn(20) }, stamp(jetzt(-30))))],
          [mk('befund', Object.assign({ id: stamp(jetzt(-1)).datum + '-c0000003', von: 'sitzung/claude/opfer', titel: 'Harmlos: alles gut', bezug: [{ art: 'ersetzt', id: krit.id }] }, stamp(jetzt(-1))))]]);
        let L = lesen();
        if (!L.sw.halts.some(h => h.e.id === h1.id)) f.push('eine abgelaufene Kopie des Halts auf claude/main loescht den echten Halt (main ist nicht GENAU origin/main)');
        if (L.sw.halts.some(h => h.e.id.slice(-8) === 'c0000002')) f.push('ein Halt im fremden Namen auf claude/main wirkt');
        if (L.sw.halts.some(h => h.e.id.slice(-8) === 'c0000040')) f.push('ein Halt mit von = sitzung/zz-sicherung auf der Sicherung wirkt — die Sicherung gilt als Branch eines Schreibers');
        if (L.abl.zustand.get(krit.id).z !== 'offen') f.push('ein „ersetzt" im Namen des Opfers auf claude/main versteckt dessen kritischen Befund');
        let r = werkzeug(d, ['naechste'], { AUSTAUSCH_VON: 'sitzung/claude/leser' });
        if (r.code !== 1) f.push('`naechste` sieht den Bump-Halt nicht (Exit ' + r.code + ') — die Kopie auf claude/main verdeckt ihn');
        // 2. Ersetzen darf nur der Branch des Schreibers (herkunftOk): ein Ersatz im fremden Namen auf einem fremden Branch nicht, auf seinem eigenen schon.
        zweig('claude/angreifer', 'origin/main', [[mk('befund', Object.assign({ id: stamp(jetzt(-1)).datum + '-c0000004', von: 'sitzung/claude/opfer', titel: 'Harmlos', bezug: [{ art: 'ersetzt', id: krit.id }] }, stamp(jetzt(-1))))]]);
        L = lesen();
        r = werkzeug(d, ['lesen', '--nur-lokal'], { AUSTAUSCH_VON: 'sitzung/claude/leser' });
        g(d, ['checkout', '-q', '-B', 'claude/leser', 'origin/main']); r = werkzeug(d, []); g(d, ['checkout', '-q', '--detach', 'origin/main']);
        if (L.abl.zustand.get(krit.id).z !== 'offen' || !/KRITISCH \(1\)[^]*Kalender zaehlt doppelt/.test(r.aus)) f.push('ein Ersatz im Namen des Opfers auf claude/angreifer versteckt dessen kritischen Befund: ' + L.abl.zustand.get(krit.id).z);
        zweig('claude/opfer', 'origin/claude/opfer', [[mk('befund', Object.assign({ id: stamp(jetzt(-1)).datum + '-c0000005', von: 'sitzung/claude/opfer', titel: 'Berichtigt: doch nur einmal', bezug: [{ art: 'ersetzt', id: krit.id }] }, stamp(jetzt(-1))))]]);
        L = lesen();
        if (L.abl.zustand.get(krit.id).z !== 'ersetzt') f.push('der Schreiber selbst kann seinen Befund auf seinem Branch nicht mehr ersetzen');
        // 3. Ankunft: ehrlich vor 7 h geschrieben und committet, dann rebased — wirkt weiter (Autor-Zeit).
        const t7 = jetzt(-7), h3 = halt(Object.assign({ id: stamp(t7).datum + '-c0000006', von: 'sitzung/claude/halter', geltung: ['gsEins'], bis: bisIn(10) }, stamp(t7)));
        g(d, ['checkout', '-q', '-B', 'claude/halter', 'origin/main']); ablegen(d, h3); g(d, ['add', '-A']); gz(d, ['commit', '-q', '-m', 'halt'], t7);
        fs.writeFileSync(path.join(d, 'notiz.txt'), 'weiter\n'); g(d, ['add', '-A']); gz(d, ['commit', '-q', '-m', 'weiter'], jetzt(-6)); g(d, ['push', '-q', '-f', 'origin', 'claude/halter']);
        g(d, ['checkout', '-q', '-B', 'main', 'origin/main']); fs.writeFileSync(path.join(d, 'main.txt'), 'main bewegt sich\n'); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'main']); g(d, ['push', '-q', 'origin', 'main']);
        g(d, ['checkout', '-q', 'claude/halter']); g(d, ['-c', 'user.email=x@example.com', 'rebase', '-q', 'origin/main']);
        fs.writeFileSync(path.join(d, 'notiz.txt'), 'jetzt\n'); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'jetzt']);   // die Spitze ist JETZT: im flachen Klon traegt jede Datei diese Zeit
        g(d, ['push', '-q', '-f', 'origin', 'claude/halter']); g(d, ['checkout', '-q', '--detach', 'origin/main']);
        L = lesen();
        if (!L.sw.halts.some(h => h.e.id === h3.id)) f.push('ein ehrlicher Halt wird nach `git rebase` „rueckdatiert": ' + ((L.sw.unwirksam.find(u => u.e.id === h3.id) || {}).grund || 'fehlt'));
        // … und im flachen Klon (CI) wird nicht geprueft: dort traegt jede Datei die Zeit der Branch-Spitze.
        const flach = path.join(eltern, 'flach'); cp.execFileSync('git', ['clone', '-q', '--depth=1', '--no-single-branch', 'file://' + bare, flach]);
        { const bf = A.brettLesen(flach, { alleRefs: true }), sf = A.schwarm(bf.eintraege, Date.now(), { wo: bf.wo, ich: 'sitzung/claude/leser' });
          if (!sf.halts.some(h => h.e.id === h3.id)) f.push('im flachen Klon heisst ein aelterer Halt „rueckdatiert": ' + ((sf.unwirksam.find(u => u.e.id === h3.id) || {}).grund || 'fehlt')); }
        // 4. Rueckdatiert bleibt rueckdatiert: per Merge-Commit, per `git mv`, als Umschreibung eines alten Pfads.
        const ehrlich = lage(Object.assign({ id: stamp(jetzt(-1)).datum + '-c0000007', von: 'sitzung/claude/ehrlich', bis: bisIn(5), bezug: [{ art: 'baut_auf', id: ziel.id }] }, stamp(jetzt(-1))));
        zweig('claude/ehrlich', 'origin/main', [[ehrlich]]);
        const t12 = jetzt(-12), rueck = (n, wer) => lage(Object.assign({ id: stamp(t12).datum + '-c000001' + n, von: 'sitzung/' + wer, bis: bisIn(8), bezug: [{ art: 'baut_auf', id: ziel.id }] }, stamp(t12)));
        // a) im Merge-Commit
        g(d, ['checkout', '-q', '-B', 'claude/seite', 'origin/main']); fs.writeFileSync(path.join(d, 'seite.txt'), 's\n'); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'seite']);
        g(d, ['checkout', '-q', '-B', 'claude/merger', 'origin/main']); fs.writeFileSync(path.join(d, 'basis.txt'), 'b\n'); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'basis']);
        g(d, ['-c', 'user.email=x@example.com', 'merge', '-q', '--no-ff', '--no-commit', 'claude/seite']); const ra = rueck('1', 'claude/merger'); ablegen(d, ra); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'merge mit Lage']); g(d, ['push', '-q', '-f', 'origin', 'claude/merger']);
        // b) per git mv
        g(d, ['checkout', '-q', '-B', 'claude/mover', 'origin/main']); const rb = rueck('2', 'claude/mover'); const pb = ablegen(d, rb); const umweg = path.join(d, A.ORDNER, 'tmp'); fs.mkdirSync(umweg, { recursive: true }); fs.renameSync(pb, path.join(umweg, path.basename(pb)));
        g(d, ['add', '-A']); gz(d, ['commit', '-q', '-m', 'umweg'], t12); g(d, ['mv', path.relative(d, path.join(umweg, path.basename(pb))), path.relative(d, pb)]); g(d, ['commit', '-q', '-m', 'an den Platz']); g(d, ['push', '-q', '-f', 'origin', 'claude/mover']);
        // c) einen alten Pfad umschreiben (vor 19 h als harmlose Lage ohne Bezug angelegt, JETZT mit Bezug)
        g(d, ['checkout', '-q', '-B', 'claude/umschreiber', 'origin/main']); const t19 = jetzt(-19); const rc = lage(Object.assign({ id: stamp(t19).datum + '-c0000013', von: 'sitzung/claude/umschreiber', bis: bisIn(4) }, stamp(t19)));
        const pc = ablegen(d, rc); g(d, ['add', '-A']); gz(d, ['commit', '-q', '-m', 'platzhalter'], t19); ablegen(d, Object.assign({}, rc, { bezug: [{ art: 'baut_auf', id: ziel.id }] }), path.basename(pc)); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'jetzt mit Bezug']); g(d, ['push', '-q', '-f', 'origin', 'claude/umschreiber']);
        g(d, ['checkout', '-q', '--detach', 'origin/main']);
        L = lesen();
        const u0 = L.sw.uebernahme.get(ziel.id);
        if (!u0 || u0.lage.e.id !== ehrlich.id) f.push('eine rueckdatierte Lage stiehlt die Uebernahme: es gilt ' + (u0 ? u0.lage.e.von : 'niemand') + ' — erwartet sitzung/claude/ehrlich');
        for (const [x, wie] of [[ra, 'per Merge-Commit'], [rb, 'per git mv'], [rc, 'als Umschreibung eines alten Pfads']]) if (!L.sw.unwirksam.some(u => u.e.id === x.id && /rueckdatiert/.test(u.grund))) { const e0 = L.b.eintraege.find(e => e.id === x.id); f.push('eine rueckdatierte Lage ' + wie + ' wird nicht als rueckdatiert erkannt (' + (e0 ? 'angekommen ' + (e0._angekommen ? new Date(e0._angekommen).toISOString() : '—') + ', ' + ((L.sw.unwirksam.find(u => u.e.id === x.id) || {}).grund || 'wirksam') : 'nicht gelesen: ' + JSON.stringify(L.b.unlesbar.filter(u => u.datei.indexOf(x.id) >= 0)) + ' refs ' + L.b.refs + ' strittig ' + JSON.stringify(L.b.strittig)) + ')'); }
        // 5. Die eigene Sicht nennt dieselbe Rueckdatierung wie die der anderen (vorher: „Wirkt jetzt: ja" beim Schreiber).
        g(d, ['checkout', '-q', '-B', 'claude/spaet', 'origin/main']);
        r = werkzeug(d, ['nehme', freie[0].id, '--bis', '9h']); const spaet = id(r);
        if (!spaet) return { ok: false, warum: f.concat('Aufbau: nehme auf claude/spaet schrieb nichts — ' + kurz(r.aus, 300)).join(' · ') };
        g(d, ['add', '-A']); gz(d, ['commit', '-q', '-m', 'spaet'], jetzt(7)); g(d, ['push', '-q', '-u', 'origin', 'claude/spaet']);
        r = werkzeug(d, ['zeige', String(spaet)]);
        if (!spaet || !/Wirkt jetzt: nein — vordatiert|Wirkt jetzt: nein — rueckdatiert/.test(r.aus)) f.push('der Schreiber sieht seine (fuer andere UNWIRKSAME) Lage als wirksam: ' + kurz((r.aus.match(/Wirkt jetzt:[^\n]*/) || [''])[0], 120));
        r = werkzeug(d, []); if (!new RegExp('DEINE LAGE ' + spaet + ' wirkt fuer die anderen NICHT: (rueck|vor)datiert').test(r.aus)) f.push('DICH BETREFFEND sagt dem Schreiber nicht, dass seine Lage fuer die anderen nicht wirkt');
        g(d, ['checkout', '-q', '--detach', 'origin/main']);
        // 6. Nach `git branch -m`: der eigene Bump-Halt bleibt EIGEN (`naechste` nicht angehalten), --von <alter Name> geht.
        g(d, ['checkout', '-q', '-B', 'claude/s6-alt', 'origin/main']);
        r = werkzeug(d, ['halt', '--geltung', 'bump', '--bis', '3h', '--text', 'ich bumpe selbst']); const hb = id(r);
        g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'halt']); g(d, ['push', '-q', '-u', 'origin', 'claude/s6-alt']); g(d, ['branch', '-q', '-m', 'claude/s6-neu']);
        r = werkzeug(d, ['naechste', '--nur-lokal']); if (!hb || r.code !== 0) f.push('nach `git branch -m` haelt der EIGENE Bump-Halt das eigene `naechste` an (Exit ' + r.code + ')');
        r = werkzeug(d, ['--nur-lokal']); if (!/Upstream origin\/claude\/s6-alt[^\n]*erloeschen deine Lagen und Halts unter sitzung\/claude\/s6-alt/.test(r.aus)) f.push('DICH BETREFFEND sagt nach `git branch -m` nicht, dass Lagen und Halts unter dem alten Namen erloeschen, wenn man nach dem neuen pusht');
        r = werkzeug(d, ['halt', '--geltung', 'gsEins', '--bis', '2h', '--text', 'noch einer']); if (!/erloeschen deine Lagen und Halts unter dem alten Namen/.test(r.aus)) f.push('der Hinweis nach `git branch -m` sagt nicht, dass Lagen und Halts unter dem alten Namen erloeschen');
        g(d, ['checkout', '-q', '-f', '.']); g(d, ['clean', '-fdq']);
        r = werkzeug(d, ['nehme', freie[1].id, '--von', 'sitzung/claude/s6-alt']); if (r.code !== 0) f.push('`nehme --von sitzung/<Upstream>` nach `git branch -m` wird abgewiesen (Exit ' + r.code + ') — genau das nennt das Werkzeug als Abhilfe');
        r = werkzeug(d, ['halt', '--geltung', 'bump', '--bis', '2h', '--text', 'x', '--von', 'sitzung/claude/fremd']); if (r.code !== 2 || !/UNWIRKSAM/.test(r.aus)) f.push('`halt --von sitzung/claude/fremd` schreibt einen Halt, der fuer alle unwirksam waere (Exit ' + r.code + ')');
        g(d, ['checkout', '-q', '-f', '.']); g(d, ['clean', '-fdq']);
        // 7. Lage und Halt nur von einem eigenen Branch — auf main eine klare Meldung (vorher zwei, die im Kreis verwiesen).
        g(d, ['checkout', '-q', '-B', 'main', 'origin/main']);
        r = werkzeug(d, ['--nur-lokal']); if (!/Du arbeitest auf main/.test(r.aus) || /losgeloester HEAD/.test(r.aus)) f.push('auf main heisst DICH BETREFFEND „losgeloester HEAD" (oder sagt nichts)');
        for (const args of [['halt', '--geltung', 'bump', '--bis', '2h', '--text', 'x'], ['halt', '--geltung', 'bump', '--bis', '2h', '--text', 'x', '--von', 'sitzung/koordinator'], ['lage', '--phase', 'laeuft']]) {
          r = werkzeug(d, args); if (r.code !== 2 || !/nur von einem EIGENEN Branch/.test(r.aus)) f.push('auf main `' + args.slice(0, 2).join(' ') + (args.indexOf('--von') >= 0 ? ' --von' : '') + '`: Exit ' + r.code + ' — erwartet 2 mit „nur von einem EIGENEN Branch" · ' + kurz(r.aus, 160));
        }
        // 8. einspielen schreibt keine Lage und keinen Halt in fremdem Namen (vorher still — und gemergt beendete ein „fertig" fremde Uebernahmen).
        g(d, ['checkout', '-q', '-B', 'claude/stapler', 'origin/main']);
        const st = path.join(eltern, 'stapel.json');
        fs.writeFileSync(st, JSON.stringify([{ art: 'lage', von: 'sitzung/claude/ehrlich', phase: 'fertig', titel: 'Lage: fertig' }]));
        r = werkzeug(d, ['einspielen', st]); if (r.code !== 1 || !/im Namen eines anderen/.test(r.aus)) f.push('einspielen schreibt eine Lage im Namen von claude/ehrlich (Exit ' + r.code + ')');
        fs.writeFileSync(st, JSON.stringify([{ art: 'halt', von: 'sitzung/koordinator', geltung: ['bump'], bis: bisIn(3), titel: 'Halt', text: 'x' }]));
        r = werkzeug(d, ['einspielen', st]); if (r.code !== 1) f.push('einspielen schreibt einen Halt mit von = sitzung/koordinator (Exit ' + r.code + ')');
        r = werkzeug(d, ['einspielen', st], { AUSTAUSCH_VON: 'sitzung/fremder' }); if (r.code === 0) f.push('einspielen mit AUSTAUSCH_VON=sitzung/fremder schreibt eine Absicht in fremdem Namen');
        if (fs.existsSync(path.join(d, A.ORDNER, stamp(jetzt()).datum.slice(0, 7))) && fs.readdirSync(path.join(d, A.ORDNER, stamp(jetzt()).datum.slice(0, 7))).some(n => /-lage-|-halt-/.test(n))) f.push('einspielen hat trotz Abweisung eine Datei geschrieben');
        fs.writeFileSync(st, JSON.stringify([{ art: 'lage', phase: 'laeuft', bis: bisIn(3), titel: 'Eigene Lage per Stapel' }]));
        r = werkzeug(d, ['einspielen', st]); if (r.code !== 0) f.push('einspielen einer eigenen Lage (ohne von) wird abgewiesen: Exit ' + r.code + ' · ' + kurz(r.aus, 300));
        g(d, ['checkout', '-q', '-f', '--detach', 'origin/main']); g(d, ['clean', '-fdq']);
        // 9. `nehme --auch` belegt keinen Platz (eine Rechnung mit dem Brett), --auch auf ein freies Ziel geht nicht, `lage --bezug baut_auf:` prueft wie `nehme`.
        g(d, ['checkout', '-q', '-B', 'claude/o', 'origin/main']);
        r = werkzeug(d, ['nehme', freie[2].id, freie[3].id, freie[4].id]); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'o']); g(d, ['push', '-q', '-u', 'origin', 'claude/o']);
        g(d, ['checkout', '-q', '-B', 'claude/w', 'origin/main']);
        r = werkzeug(d, ['nehme', freie[2].id, freie[3].id, freie[4].id, '--auch']); if (r.code !== 0) f.push('`nehme … --auch` auf drei genommene Ziele: Exit ' + r.code + ' · ' + kurz(r.aus, 160));
        r = werkzeug(d, ['nehme', freie[5].id]); const w4 = id(r);
        if (r.code !== 0 || !w4) f.push('nach drei Mithelf-Zielen wird eine eigene Uebernahme abgewiesen (Exit ' + r.code + ') — Mithelfen belegt keinen Platz');
        r = werkzeug(d, ['zeige', String(w4)]); if (!/Wirkt jetzt: ja[^\n]*uebernimmt/.test(r.aus)) f.push('die Uebernahme neben drei Mithelf-Lagen wirkt nicht: ' + kurz((r.aus.match(/Wirkt jetzt:[^\n]*/) || [''])[0], 140));
        r = werkzeug(d, ['nehme', ziel.id, '--auch', '--titel', 'Ich schaue mir die Gegenprobe an']); if (r.code !== 0) f.push('`nehme --auch --titel …` auf ein von claude/ehrlich genommenes Ziel: Exit ' + r.code);
        r = werkzeug(d, ['nehme', freie[1].id, '--auch']); if (r.code !== 1 || !/ist frei/.test(r.aus)) f.push('`nehme --auch` auf ein FREIES Ziel: Exit ' + r.code + ' — erwartet 1 („ist frei — ohne --auch")');
        r = werkzeug(d, ['lage', '--bezug', 'baut_auf:' + freie[2].id]); if (r.code !== 1 || !/schon uebernommen/.test(r.aus)) f.push('`lage --bezug baut_auf:<genommen>` geht an der Pruefung von `nehme` vorbei (Exit ' + r.code + ')');
        g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'w']); g(d, ['push', '-q', '-u', 'origin', 'claude/w']);
        r = werkzeug(d, []); if (/Deine Uebernahme von [^\n]* gilt nicht/.test(r.aus)) f.push('Mithelfen (das Feld) gibt bei jedem Lesen „Deine Uebernahme … gilt nicht"');
        g(d, ['checkout', '-q', '--detach', 'origin/main']);
        // 10. `zeige` sagt „teilweise", wenn eine Lage nur fuer EIN Ziel ueber dem Deckel liegt (von Hand gebaut: das Werkzeug weist so etwas ab).
        const tz = stamp(jetzt(-2)), tz2 = stamp(jetzt(-1));
        const p1 = lage(Object.assign({ id: tz.datum + '-c0000021', von: 'sitzung/claude/teil', bis: bisIn(4), bezug: [{ art: 'baut_auf', id: freie[0].id }] }, tz));
        const p2 = lage(Object.assign({ id: tz2.datum + '-c0000022', von: 'sitzung/claude/teil', bis: bisIn(4), bezug: [freie[1], freie[3], ziel].map(x => ({ art: 'baut_auf', id: x.id })) }, tz2));
        zweig('claude/teil', 'origin/main', [[p1], [p2]]);
        g(d, ['checkout', '-q', '-B', 'claude/teil', 'origin/claude/teil']);
        r = werkzeug(d, []); if (!/DEINE LAGE [0-9-]+c0000022 wirkt nur teilweise/.test(r.aus)) f.push('DICH BETREFFEND sagt dem Schreiber nicht, dass seine Lage nur teilweise wirkt');
        r = werkzeug(d, ['zeige', 'c0000022']); if (!/Wirkt jetzt: teilweise[^\n]*NICHT/.test(r.aus)) f.push('`zeige` einer Lage, die zwei von drei Zielen wirksam nimmt: ' + kurz((r.aus.match(/Wirkt jetzt:[^\n]*/) || [''])[0], 160) + ' — erwartet „teilweise … NICHT"');
        // 11. A10 im PR: eine wirkende Lage in fremdem Namen im Baum ist ROT; dieselbe Lage byte-gleich vom Branch ihres
        //     Schreibers und eine eigene sind es nicht (der Pruefstand selbst, in einem Klon gefahren).
        // (die Lage im fremden Namen auf einem DRITTEN Branch zuerst — zweig() committet alles Unversionierte mit)
        const fremd = lage(Object.assign({ id: stamp(jetzt(-1)).datum + '-c0000033', von: 'sitzung/claude/nirgends', phase: 'fertig', bis: bisIn(3) }, stamp(jetzt(-1))));
        g(d, ['clean', '-fdq']); zweig('claude/dritter', 'origin/main', [[fremd]]);
        g(d, ['checkout', '-q', '-f', '-B', 'claude/pr', 'origin/main']); g(d, ['clean', '-fdq']);
        // Ein PR aus DIESEM Repo: sein Kopf (ein eigener Commit) liegt auf origin/claude/pr (A.prKopf prueft das — ein
        // Fork-PR hat dort nichts; ein Kopf ohne eigenen Commit laege auf JEDEM Branch, der von main abzweigt).
        fs.writeFileSync(path.join(d, 'pr-marke.txt'), 'pr\n'); g(d, ['add', 'pr-marke.txt']); g(d, ['commit', '-q', '-m', 'pr']);
        g(d, ['push', '-q', '-u', 'origin', 'claude/pr']);
        fs.mkdirSync(path.join(d, 'scripts'), { recursive: true });
        for (const n of ['austausch.mjs', '_austausch.mjs', 'austausch_check.js']) fs.copyFileSync(path.join(__dirname, n), path.join(d, 'scripts', n));
        const a10 = () => cp.spawnSync(process.execPath, [path.join(d, 'scripts', 'austausch_check.js')], { encoding: 'utf8', env: Object.assign({}, process.env, { AUSTAUSCH_FALL: 'A10', GITHUB_HEAD_REF: 'claude/pr' }) });
        g(d, ['fetch', '-q', 'origin']);
        ablegen(d, JSON.parse(g(d, ['show', 'origin/claude/ehrlich:' + A.ORDNER + '/' + ehrlich.id.slice(0, 7) + '/' + ehrlich.id + '-lage-x.json'])));   // byte-gleich
        let x10 = a10(); if (x10.status !== 0) f.push('A10: die byte-gleiche Lage vom Branch ihres Schreibers ist rot · ' + kurz(x10.stdout, 200));
        ablegen(d, lage(Object.assign({ id: stamp(jetzt(-1)).datum + '-c0000031', von: 'sitzung/claude/pr', bis: bisIn(3) }, stamp(jetzt(-1)))));
        x10 = a10(); if (x10.status !== 0) f.push('A10: die eigene Lage (von = GITHUB_HEAD_REF) ist rot · ' + kurz(x10.stdout, 200));
        ablegen(d, lage(Object.assign({ id: stamp(jetzt(-1)).datum + '-c0000032', von: 'sitzung/claude/ehrlich', phase: 'fertig', bis: bisIn(3) }, stamp(jetzt(-1)))));
        x10 = a10(); if (x10.status !== 1 || !/c0000032[^\n]*sitzung\/claude\/ehrlich/.test(x10.stdout)) f.push('A10: ein „fertig" im Namen von claude/ehrlich im Baum ist nicht rot (Exit ' + x10.status + ')');
        { fs.unlinkSync(path.join(d, A.ORDNER, stamp(jetzt(-1)).datum.slice(0, 7), stamp(jetzt(-1)).datum + '-c0000032-lage-x.json'));
          ablegen(d, fremd);   // byte-gleich auf claude/dritter — NICHT dem Branch ihres Schreibers
          x10 = a10(); if (x10.status !== 1 || !/c0000033/.test(x10.stdout)) f.push('A10: eine Lage im fremden Namen, byte-gleich auf einem DRITTEN Branch, ist nicht rot (Exit ' + x10.status + ')'); }
        // 11b. Eine ABGELAUFENE Lage im fremden Namen ist rot: sie zaehlt gemergt im Deckel ihres Schreibers (Gegenpruefung 4).
        { const tAb = stamp(jetzt(-3));
          ablegen(d, lage(Object.assign({ id: tAb.datum + '-c0000035', von: 'sitzung/claude/ehrlich', phase: 'laeuft', bis: bisIn(-1), bezug: [freie[1], freie[3], freie[5]].map(x => ({ art: 'baut_auf', id: x.id })) }, tAb)));
          x10 = a10(); if (x10.status !== 1 || !/c0000035/.test(x10.stdout)) f.push('A10: eine ABGELAUFENE Lage im Namen von claude/ehrlich im Baum ist nicht rot (Exit ' + x10.status + ')'); }
        // 11c. Fork: GITHUB_HEAD_REF nennt einen fremden Branch, der den Kopf dieses PR nicht traegt — eine Lage in dessen
        //      Namen ist ROT, und A8 nennt dessen Halts (vorher waehlte der Absender eines Fork-PR seine Identitaet frei).
        { ablegen(d, lage(Object.assign({ id: stamp(jetzt(-1)).datum + '-c0000034', von: 'sitzung/claude/ehrlich', phase: 'fertig', bis: bisIn(3) }, stamp(jetzt(-1)))));
          const xf = cp.spawnSync(process.execPath, [path.join(d, 'scripts', 'austausch_check.js')], { encoding: 'utf8', env: Object.assign({}, process.env, { AUSTAUSCH_FALL: 'A10', GITHUB_HEAD_REF: 'claude/ehrlich' }) });
          if (xf.status !== 1 || !/c0000034/.test(xf.stdout) || !/Fork/.test(xf.stdout)) f.push('A10 mit GITHUB_HEAD_REF=claude/ehrlich (der Kopf liegt nicht auf origin/claude/ehrlich): eine Lage in dessen Namen ist nicht rot (Exit ' + xf.status + ') · ' + kurz(xf.stdout, 200));
          if (A.prKopf(d, { GITHUB_HEAD_REF: 'claude/ehrlich' }) !== null) f.push('A.prKopf nimmt einen fremden Branch als „ich", dessen Spitze den Kopf nicht traegt');
          if (A.prKopf(d, { GITHUB_HEAD_REF: 'claude/pr' }) !== 'claude/pr') f.push('A.prKopf erkennt den eigenen, gepushten PR-Branch nicht'); }
        g(d, ['checkout', '-q', '-f', '--detach', 'origin/main']); g(d, ['clean', '-fdq']);
        if (f.length) return { ok: false, warum: f.join(' · ') };
        return { ok: true, info: 'claude/main ist nicht main (Halt-Kopie, fremder Halt, Ersatz) · Ersatz nur vom Branch des Schreibers · Rebase (Autor-Zeit) und flacher Klon wirken · Merge-Commit, git mv, umgeschriebener Pfad: rueckdatiert · eigene Sicht = fremde · branch -m: eigener Halt bleibt eigen, --von <alt> geht, --von fremd nicht · auf main eine Meldung · einspielen ohne fremdes von · --auch belegt keinen Platz, frei → abgewiesen, lage --bezug geprueft · zeige teilweise' };
      } catch (e) { return { ok: false, warum: 'Ausnahme: ' + String(e.message).split('\n')[0] }; } finally { weg(eltern); }
    },
  },
  {
    name: 'C24 · Kern und Identitaet (Gegenpruefung 4) · als PROZESS: ein fremder Upstream ist nicht „ich" (sein Bump-Halt sperrt, sein Halt steht unter DICH BETREFFEND, in seinem Namen schreibt man nicht), ein losgeloester HEAD schreibt nicht im Namen eines fremden Branches; die Ankunft misst nur der Branch des Schreibers (eine Kopie mit frueherer Zeit nimmt nichts), eine ehrliche Berichtigung, ein Merge mit main vorn und ein Amend bleiben wirksam, das Verzeichnis des Waechters macht ein Amend in einen alten Commit „rueckdatiert"; verschiedene `von` ohne Sicherung sind strittig (auch nach einem Grabstein auf das Original und bei fehlendem Blob); fuer fremde Eintraege gilt nicht die alte Kopie im eigenen Baum; nur Monatsordner; der Name kommt nicht von einer Kopie; ein neu angelegter Branch berichtigt nichts; der Schreiber erfaehrt, was die anderen sehen; eine Verlaengerung behaelt den Platz, „fertig" in derselben Sekunde gibt frei, eine abgelaufene juengste Lage verdeckt nichts; A8 sieht unverbuchte Aenderungen',
    lauf: () => {
      const eltern = tmp('kern4'), bare = path.join(eltern, 'origin.git'), d = path.join(eltern, 'klon');
      try {
        const f = [];
        const jetzt = (dh) => new Date(Date.now() + (dh || 0) * 36e5);
        const stamp = (dt) => ({ datum: dt.toISOString().slice(0, 10), zeit: dt.toISOString().slice(11, 19) });
        const bisIn = (h) => jetzt(h).toISOString().replace(/\.\d{3}Z$/, 'Z');
        const gz = (dir, args, t, nurAutor) => cp.execFileSync('git', ['-C', dir, '-c', 'user.email=pruefstand@example.com', '-c', 'user.name=pruefstand', '-c', 'commit.gpgsign=false'].concat(args), { encoding: 'utf8', env: Object.assign({}, process.env, t ? (nurAutor ? { GIT_AUTHOR_DATE: t.toISOString() } : { GIT_AUTHOR_DATE: t.toISOString(), GIT_COMMITTER_DATE: t.toISOString() }) : {}) });
        const zweig = (name, von, eintraege, t) => { g(d, ['checkout', '-q', '-B', name, von || 'origin/main']); for (const [e, n] of eintraege) ablegen(d, e, n); g(d, ['add', '-A']); gz(d, ['commit', '-q', '--allow-empty', '-m', name], t); g(d, ['push', '-q', '-f', 'origin', name]); g(d, ['checkout', '-q', '--detach', 'origin/main']); };
        const holen = () => g(d, ['fetch', '-q', '--prune', 'origin', '+refs/heads/*:refs/remotes/origin/*']);
        const lesen = (ich) => { holen(); const b = A.brettLesen(d, { alleRefs: true, ich: ich || ['sitzung/claude/leser'] }); return { b, sw: A.schwarm(b.eintraege, Date.now(), { wo: b.wo, ich: ich || ['sitzung/claude/leser'] }) }; };
        const halt = (o) => mk('halt', Object.assign({ text: 'bitte warten', geltung: ['bump'] }, o));
        const lage = (o) => mk('lage', Object.assign({ phase: 'laeuft' }, o));
        const blobVon = (e) => cp.execFileSync('git', ['hash-object', '--stdin'], { input: JSON.stringify(e, null, 2) + '\n', encoding: 'utf8' }).trim();
        cp.execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare]);
        cp.execFileSync('git', ['-C', bare, 'config', 'uploadpack.allowFilter', 'true']);
        fs.mkdirSync(d); g(d, ['init', '-q', '-b', 'main', '.']); g(d, ['remote', 'add', 'origin', 'file://' + bare]);
        fs.writeFileSync(path.join(d, 'index.html'), QUELLE); fs.writeFileSync(path.join(d, 'sw.js'), "const VERSION = 'gs-v1.00';\n");
        fs.mkdirSync(path.join(d, 'scripts'));
        for (const n of ['austausch.mjs', '_austausch.mjs', 'austausch_check.js']) fs.copyFileSync(path.join(__dirname, n), path.join(d, 'scripts', n));
        const t0 = stamp(jetzt(-30));
        const ziele = [1, 2, 3, 4, 5, 6].map(i => mk('befund', Object.assign({ id: t0.datum + '-d000000' + i, von: 'sitzung/start', titel: 'Ziel ' + i }, t0)));
        for (const e of ziele) ablegen(d, e);
        g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'start']); g(d, ['push', '-q', 'origin', 'main']);
        // 1. Ein FREMDER Upstream (`git checkout -b x origin/<fremd>`) ist nicht „ich" (Runde 3 nahm jeden Upstream).
        const tH = stamp(jetzt(-1));
        const hBump = halt(Object.assign({ id: tH.datum + '-e0000001', von: 'sitzung/claude/fremd', geltung: ['bump'], bis: bisIn(8) }, tH));
        const hZwei = halt(Object.assign({ id: tH.datum + '-e0000002', von: 'sitzung/claude/fremd', geltung: ['gsZwei'], bis: bisIn(8) }, tH));
        zweig('claude/fremd', 'origin/main', [[hBump], [hZwei]]);
        g(d, ['checkout', '-q', '-b', 'claude/s', 'origin/claude/fremd']);
        fs.writeFileSync(path.join(d, 'index.html'), QUELLE.replace('return gsEins() + gsEins();', 'return 2;')); g(d, ['commit', '-q', '-am', 'gsZwei']);
        { const ez = A.eigenerZweig(d), nm = A.eigeneNamen(ez);
          if (nm.join() !== 'sitzung/claude/s' || ez.umbenannt) f.push('nach `checkout -b claude/s origin/claude/fremd`: eigene Namen ' + JSON.stringify(nm) + ' — erwartet nur sitzung/claude/s');
          let r = werkzeug(d, ['naechste', '--json']); if (r.code !== 1) f.push('der Bump-Halt des fremden Upstreams sperrt `naechste` nicht (Exit ' + r.code + ')');
          r = werkzeug(d, []); if (!new RegExp('HALT ' + hZwei.id).test(r.aus) || /Entweder weiter als --von sitzung\/claude\/fremd/.test(r.aus)) f.push('DICH BETREFFEND: der fremde Halt fehlt oder der Rat, im fremden Namen zu schreiben, steht da');
          r = werkzeug(d, ['halt', '--geltung', 'gsEins', '--von', 'sitzung/claude/fremd', '--text', 'im fremden Namen']); if (r.code !== 2) f.push('`halt --von sitzung/<fremder Upstream>` wird geschrieben (Exit ' + r.code + ')');
          // A10 lokal: eine Lage im Namen des fremden Upstreams ist rot.
          ablegen(d, lage(Object.assign({ id: tH.datum + '-e0000003', von: 'sitzung/claude/fremd', phase: 'fertig', bis: bisIn(3) }, tH)));
          const x = cp.spawnSync(process.execPath, [path.join(d, 'scripts', 'austausch_check.js')], { encoding: 'utf8', env: Object.assign({}, process.env, { AUSTAUSCH_FALL: 'A10', GITHUB_HEAD_REF: '' }) });
          if (x.status !== 1 || !/e0000003/.test(x.stdout)) f.push('A10 lokal: eine Lage im Namen des fremden Upstreams ist nicht rot (Exit ' + x.status + ')');
          g(d, ['checkout', '-q', '-f', '--detach', 'origin/main']); g(d, ['clean', '-fdq', A.ORDNER]); }
        // … und nach einem BELEGTEN Umbenennen ist der alte Name meiner.
        g(d, ['checkout', '-q', '-b', 'claude/alt', 'origin/main']); g(d, ['push', '-q', '-u', 'origin', 'claude/alt']); g(d, ['branch', '-m', 'claude/neu']);
        if (A.eigeneNamen(A.eigenerZweig(d)).join() !== 'sitzung/claude/neu,sitzung/claude/alt') f.push('nach `git branch -m` fehlt der alte Name unter den eigenen: ' + JSON.stringify(A.eigeneNamen(A.eigenerZweig(d))));
        g(d, ['checkout', '-q', '--detach', 'origin/main']);
        // 2. Losgeloester HEAD: nicht im Namen eines Branches, von dem dieser Stand nicht abstammt.
        { let r = werkzeug(d, ['lage', '--phase', 'fertig', '--von', 'sitzung/claude/fremd', '--titel', 'fertig im fremden Namen']); if (r.code !== 2) f.push('losgeloester HEAD schreibt eine Lage im Namen von claude/fremd (Exit ' + r.code + ')');
          r = werkzeug(d, ['lage', '--phase', 'laeuft', '--von', 'sitzung/claude/ganz-neu', '--titel', 'neuer Branch']); if (r.code !== 0) f.push('losgeloester HEAD mit einem Namen, den es auf origin nicht gibt, wird abgewiesen (Exit ' + r.code + ')');
          g(d, ['clean', '-fdq', A.ORDNER]); }
        // 3. Die Ankunft misst nur der Branch des Schreibers: eine byte-gleiche Kopie mit FRUEHERER Autor-Zeit auf einem dritten Branch.
        const tA = stamp(jetzt(0));
        const hA = halt(Object.assign({ id: tA.datum + '-e0000010', von: 'sitzung/claude/a', geltung: ['gsEins'], bis: bisIn(8) }, tA));
        zweig('claude/a', 'origin/main', [[hA]]); zweig('claude/evil', 'origin/main', [[hA]], jetzt(-3));
        { const L = lesen(); if (!L.sw.halts.some(h => h.e.id === hA.id)) f.push('eine Kopie mit frueherer Autor-Zeit auf einem dritten Branch macht den Halt „vordatiert": ' + ((L.sw.unwirksam.find(u => u.e.id === hA.id) || {}).grund || 'fehlt')); }
        // 4. Ehrliche Ablaeufe ohne Verzeichnis: Berichtigung nach 7 h, Merge mit main als erstem Elternteil, Amend in einen alten Commit.
        const t8 = jetzt(-8), lw = lage(Object.assign({ id: stamp(t8).datum + '-e0000020', von: 'sitzung/claude/w', bis: bisIn(10), bezug: [{ art: 'baut_auf', id: ziele[0].id }] }, stamp(t8)));
        zweig('claude/w', 'origin/main', [[lw]], t8);
        g(d, ['checkout', '-q', '-B', 'claude/w', 'origin/claude/w']); ablegen(d, Object.assign({}, lw, { titel: 'Berichtigt nach 7 h' })); g(d, ['add', '-A']); gz(d, ['commit', '-q', '-m', 'berichtigt'], jetzt(-1)); g(d, ['push', '-q', '-f', 'origin', 'claude/w']);
        g(d, ['checkout', '-q', '-B', 'claude/w2', 'origin/main']); g(d, ['merge', '-q', '--no-ff', '--no-edit', 'origin/claude/w']); g(d, ['push', '-q', '-f', 'origin', 'claude/w2:claude/w']);
        const hJ = halt(Object.assign({ id: stamp(jetzt(0)).datum + '-e0000021', von: 'sitzung/claude/h', geltung: ['gsEins'], bis: bisIn(6) }, stamp(jetzt(0))));
        zweig('claude/h', 'origin/main', [], jetzt(-10)); g(d, ['checkout', '-q', '-B', 'claude/h', 'origin/claude/h']); ablegen(d, hJ); g(d, ['add', '-A']); gz(d, ['commit', '-q', '--amend', '--no-edit'], jetzt(-10), true); g(d, ['push', '-q', '-f', 'origin', 'claude/h']); g(d, ['checkout', '-q', '--detach', 'origin/main']);
        { const L = lesen();
          const u = L.sw.uebernahme.get(ziele[0].id); if (!u || u.lage.e.id !== lw.id) f.push('eine ehrlich berichtigte, per Merge (main vorn) aktualisierte Lage gilt nicht: ' + ((L.sw.unwirksam.find(x => x.e.id === lw.id) || {}).grund || 'keine Uebernahme'));
          if (!L.sw.halts.some(h => h.e.id === hJ.id)) f.push('ein ehrlicher Halt per Amend in einen alten Commit heisst „vordatiert": ' + ((L.sw.unwirksam.find(x => x.e.id === hJ.id) || {}).grund || 'fehlt')); }
        // 5. Ohne Verzeichnis ist die Autor-Zeit eine Selbstauskunft (Grenze) — MIT Verzeichnis ist ein Amend in einen 20 h alten
        //    Commit rueckdatiert: der Waechter hat die Lage bei seinem letzten Lauf nicht gesehen.
        const t20 = jetzt(-20), le = lage(Object.assign({ id: stamp(t20).datum + '-e0000022', von: 'sitzung/claude/e', bis: bisIn(3), bezug: [{ art: 'baut_auf', id: ziele[0].id }] }, stamp(t20)));
        zweig('claude/e', 'origin/main', [], t20); g(d, ['checkout', '-q', '-B', 'claude/e', 'origin/claude/e']); ablegen(d, le); g(d, ['add', '-A']); gz(d, ['commit', '-q', '--amend', '--no-edit'], t20, true); g(d, ['push', '-q', '-f', 'origin', 'claude/e']); g(d, ['checkout', '-q', '--detach', 'origin/main']);
        const lwJetzt = JSON.parse(g(d, ['show', 'origin/claude/w:' + A.ORDNER + '/' + lw.id.slice(0, 7) + '/' + lw.id + '-lage-x.json']));
        const verz = { stand: jetzt(-0.5).toISOString(), fassungen: [{ id: lw.id, blob: blobVon(lwJetzt), von: lw.von, anspruch: A.anspruchKennung(lw), erst: jetzt(-7.5).toISOString(), nichtVor: jetzt(-8.5).toISOString() }], quarantaene: [], neuAngelegt: {}, entfernt: [] };
        g(d, ['checkout', '-q', '--orphan', 'zzbau']); g(d, ['rm', '-rqf', '.']); fs.mkdirSync(path.join(d, 'docs', 'austausch'), { recursive: true }); fs.writeFileSync(path.join(d, A.VERZEICHNIS), JSON.stringify(verz, null, 1) + '\n'); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'zz']); g(d, ['push', '-q', '-f', 'origin', 'zzbau:zz-sicherung']); g(d, ['checkout', '-q', '-f', '--detach', 'origin/main']); g(d, ['branch', '-q', '-D', 'zzbau']);
        { const L = lesen(); const u = L.sw.uebernahme.get(ziele[0].id), ue = L.sw.unwirksam.find(x => x.e.id === le.id);
          if (!u || u.lage.e.id !== lw.id || !ue || !/rueckdatiert[^]*Waechter/.test(ue.grund)) f.push('mit Verzeichnis: die per Amend in einen 20 h alten Commit gelegte Lage ' + (ue ? 'ist „' + ue.grund + '"' : 'wirkt') + ', es gilt ' + (u ? u.lage.e.von : 'niemand') + ' — erwartet sitzung/claude/w und „rueckdatiert … Waechter"'); }
        // … ohne Verzeichnis: bekannte Grenze (die Autor-Zeit) — gemessen, damit niemand mehr behauptet.
        g(d, ['push', '-q', 'origin', '--delete', 'zz-sicherung']);
        { const L = lesen(); const u = L.sw.uebernahme.get(ziele[0].id); if (!u) f.push('ohne Verzeichnis: keine Uebernahme mehr fuer ' + ziele[0].id); }
        // 6. Verschiedene `von` ohne Sicherung: strittig (nach `git branch -m` verlor das Original sonst gegen eine Faelschung).
        const tK = stamp(jetzt(-1)), kB = mk('befund', Object.assign({ id: tK.datum + '-e0000030', von: 'sitzung/claude/neu', dringlichkeit: 'kritisch', titel: 'Login geht nicht mehr' }, tK));
        zweig('claude/alt', 'origin/main', [[kB]]); zweig('claude/evil', 'origin/main', [[Object.assign({}, kB, { von: 'sitzung/claude/evil', titel: 'Login geht wieder', dringlichkeit: undefined })]]);
        { const L = lesen(); const e = L.b.eintraege.find(x => x.id === kB.id); if (e || !L.b.strittig.some(x => x.id === kB.id && /verschiedenem/.test(x.grund || ''))) f.push('verschiedene `von`, nichts gesichert: es gilt ' + (e ? '„' + e.titel + '" von ' + e.von : 'nichts, aber nicht als strittig mit Grund')); }
        // 7. Ein Grabstein (blob) auf das Original laesst die Faelschung nicht allein gelten.
        const kO = mk('befund', Object.assign({ id: tK.datum + '-e0000031', von: 'sitzung/claude/orig', titel: 'Original' }, tK));
        zweig('claude/orig', 'origin/main', [[kO]]); zweig('claude/evil', 'origin/claude/evil', [[Object.assign({}, kO, { von: 'sitzung/claude/evil', titel: 'Faelschung' })]]);
        g(d, ['checkout', '-q', '-B', 'main', 'origin/main']); fs.writeFileSync(path.join(d, A.GRABSTEINE), JSON.stringify([{ id: kO.id, blob: blobVon(kO), datum: tK.datum, grund: 'ein Name im Text' }], null, 2) + '\n'); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'grab']); g(d, ['push', '-q', 'origin', 'main']); g(d, ['checkout', '-q', '--detach', 'origin/main']);
        { const L = lesen(); const e = L.b.eintraege.find(x => x.id === kO.id); if (e) f.push('nach einem Grabstein auf das Original gilt die Faelschung allein: „' + e.titel + '" von ' + e.von); }
        // 8. Fuer einen FREMDEN Halt gilt nicht die alte Kopie im eigenen Baum: der Schreiber berichtigt ihn auf seinem Branch.
        const hM = halt(Object.assign({ id: tA.datum + '-e0000040', von: 'sitzung/claude/fremd2', geltung: ['bump'], bis: bisIn(8) }, tA));
        zweig('claude/fremd2', 'origin/main', [[hM]]);
        g(d, ['checkout', '-q', '-B', 'claude/m', 'origin/main']); g(d, ['merge', '-q', '--no-edit', 'origin/claude/fremd2']);
        zweig('claude/fremd2', 'origin/claude/fremd2', [[Object.assign({}, hM, { text: 'bitte warten — Migration laeuft' })]]);
        g(d, ['checkout', '-q', 'claude/m']);
        { const L = lesen(['sitzung/claude/m']); if (!L.sw.halts.some(h => h.e.id === hM.id)) f.push('nach dem Merge eines fremden Halts und dessen Berichtigung haelt diese Sitzung ihn fuer unwirksam: ' + ((L.sw.unwirksam.find(x => x.e.id === hM.id) || {}).grund || 'fehlt')); }
        g(d, ['checkout', '-q', '-f', '--detach', 'origin/main']);
        // 9. Nur Monatsordner — fuer den Arbeitsbaum UND jeden Remote-Ref (eintraege/x/ sah der Pruefstand nicht, jeder Leser schon).
        const lX = lage(Object.assign({ id: tA.datum + '-e0000050', von: 'sitzung/claude/ehrlich', phase: 'fertig', bis: bisIn(3) }, tA));
        zweig('claude/ordner', 'origin/main', []); g(d, ['checkout', '-q', '-B', 'claude/ordner', 'origin/claude/ordner']);
        fs.mkdirSync(path.join(d, A.ORDNER, 'x'), { recursive: true }); fs.writeFileSync(path.join(d, A.ORDNER, 'x', lX.id + '-lage-x.json'), JSON.stringify(lX, null, 2) + '\n');
        fs.mkdirSync(path.join(d, A.ORDNER, 'a"b'), { recursive: true }); fs.writeFileSync(path.join(d, A.ORDNER, 'a"b', tA.datum + '-e0000051-lage-x.json'), JSON.stringify(Object.assign({}, lX, { id: tA.datum + '-e0000051' }), null, 2) + '\n');
        { const lo = A.brettLesen(d, { alleRefs: false }); if (lo.unlesbar.filter(u => /Monatsordner/.test(u.grund)).length !== 2 || lo.eintraege.some(e => /e000005/.test(e.id))) f.push('Arbeitsbaum: Dateien ausserhalb der Monatsordner werden nicht als unlesbar genannt: ' + JSON.stringify(lo.unlesbar.map(u => u.grund))); }
        g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'ordner']); g(d, ['push', '-q', '-f', 'origin', 'claude/ordner']); g(d, ['checkout', '-q', '-f', '--detach', 'origin/main']);
        { const L = lesen(); if (L.b.eintraege.some(e => /e000005/.test(e.id)) || L.b.unlesbar.filter(u => u.quelle === 'origin/claude/ordner' && /Monatsordner/.test(u.grund)).length !== 2) f.push('Remote-Ref: eine Datei ausserhalb der Monatsordner gilt als Eintrag'); }
        // 10. Der Name kommt nicht von einer Kopie: das Original nur in der Sicherung, eine byte-gleiche Kopie unter anderem Namen.
        const kN = mk('befund', Object.assign({ id: tA.datum + '-e0000060', von: 'sitzung/claude/weg', titel: 'Ein Befund' }, tA));
        g(d, ['checkout', '-q', '--orphan', 'zzbau']); g(d, ['rm', '-rqf', '.']); ablegen(d, kN, kN.id + '-befund-ein-befund.json'); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'zz']); g(d, ['push', '-q', '-f', 'origin', 'zzbau:zz-sicherung']); g(d, ['checkout', '-q', '-f', '--detach', 'origin/main']); g(d, ['branch', '-q', '-D', 'zzbau']);
        zweig('claude/0-kopie', 'origin/main', [[kN, kN.id + '-befund-ein-vorname-nachname.json']]);
        { const L = lesen(); const v = L.b.gilt.get(kN.id); if (!v || v.e._datei !== kN.id + '-befund-ein-befund.json') f.push('die gerettete Fassung traegt den Namen einer Kopie: ' + (v ? v.e._datei : 'nichts')); }
        // 11. Ein NEU ANGELEGTER Branch (laut Verzeichnis) berichtigt nichts; ohne den Vermerk gilt seine Fassung (Gegenprobe).
        const kR = mk('befund', Object.assign({ id: tA.datum + '-e0000070', von: 'sitzung/claude/r', dringlichkeit: 'kritisch', titel: 'Login geht nicht mehr' }, tA));
        const zzMit = (na) => { g(d, ['checkout', '-q', '--orphan', 'zzbau']); g(d, ['rm', '-rqf', '.']); ablegen(d, kR); fs.mkdirSync(path.join(d, 'docs', 'austausch'), { recursive: true }); fs.writeFileSync(path.join(d, A.VERZEICHNIS), JSON.stringify({ stand: jetzt(-0.5).toISOString(), fassungen: [{ id: kR.id, blob: blobVon(kR), von: kR.von, anspruch: A.anspruchKennung(kR), erst: jetzt(-5).toISOString(), nichtVor: jetzt(-6).toISOString() }], quarantaene: [], neuAngelegt: na, entfernt: [] }, null, 1) + '\n'); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'zz']); g(d, ['push', '-q', '-f', 'origin', 'zzbau:zz-sicherung']); g(d, ['checkout', '-q', '-f', '--detach', 'origin/main']); g(d, ['branch', '-q', '-D', 'zzbau']); };
        zweig('claude/r', 'origin/main', [[Object.assign({}, kR, { titel: 'Login geht wieder', dringlichkeit: undefined })]]);
        zzMit({ 'origin/claude/r': jetzt(-1).toISOString() });
        { const L = lesen(); const e = L.b.eintraege.find(x => x.id === kR.id); if (!e || e.titel !== 'Login geht nicht mehr' || !(L.b.neuAngelegt || []).some(x => x.id === kR.id)) f.push('ein neu angelegter Branch „berichtigt" den gesicherten Eintrag: es gilt ' + (e ? '„' + e.titel + '" {' + e._quelle + '}' : 'nichts')); }
        zzMit({});
        { const L = lesen(); const e = L.b.eintraege.find(x => x.id === kR.id); if (!e || e.titel !== 'Login geht wieder') f.push('Gegenprobe: ohne Vermerk „neu angelegt" gilt die Berichtigung des Schreibers nicht: ' + (e ? '„' + e.titel + '"' : 'nichts')); }
        // 12. Der Schreiber erfaehrt, was die anderen sehen: gepushte Fassung mit berichtigtem `von`, die Sicherung haelt die alte.
        const kT = halt(Object.assign({ id: tA.datum + '-e0000080', von: 'sitzung/claude/t-tippfehler', geltung: ['gsEins'], bis: bisIn(8) }, tA));
        g(d, ['checkout', '-q', '--orphan', 'zzbau']); g(d, ['rm', '-rqf', '.']); ablegen(d, kT); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'zz']); g(d, ['push', '-q', '-f', 'origin', 'zzbau:zz-sicherung']); g(d, ['checkout', '-q', '-f', '--detach', 'origin/main']); g(d, ['branch', '-q', '-D', 'zzbau']);
        zweig('claude/t', 'origin/main', [[Object.assign({}, kT, { von: 'sitzung/claude/t' })]]); g(d, ['checkout', '-q', '-B', 'claude/t', 'origin/claude/t']); holen();
        { const b = A.brettLesen(d, { alleRefs: true, ich: ['sitzung/claude/t'] }); if (!b.giltAndere.has(kT.id)) f.push('der Schreiber erfaehrt nicht, dass fuer die anderen eine andere Fassung seines Halts gilt');
          const r = werkzeug(d, []); if (!new RegExp('DEIN EINTRAG ' + kT.id + ': du siehst deine Fassung').test(r.aus)) f.push('DICH BETREFFEND sagt dem Schreiber nicht, dass die anderen eine andere Fassung sehen'); }
        g(d, ['checkout', '-q', '-f', '--detach', 'origin/main']);
        // 13. Fehlt der Blob des Originals (Teilabruf), gilt nicht die umgeschriebene Kopie eines DRITTEN.
        const kG = mk('befund', Object.assign({ id: tA.datum + '-e0000090', von: 'sitzung/claude/schreiber', titel: 'Giftstufe falsch' }, tA));
        zweig('claude/schreiber', 'origin/main', [[kG]]); zweig('claude/dritter', 'origin/main', [[Object.assign({}, kG, { titel: 'Alles in Ordnung' })]]);
        { const tc = path.join(eltern, 'teil'); cp.execFileSync('git', ['clone', '-q', '--filter=blob:none', '--no-checkout', 'file://' + bare, tc], { stdio: 'ignore' });
          g(tc, ['checkout', '-q', 'origin/claude/dritter']); g(tc, ['checkout', '-q', '-b', 'claude/leser', 'origin/main']);
          const b = A.brettLesen(tc, { alleRefs: true }), e = b.eintraege.find(x => x.id === kG.id);
          if (e || !b.strittig.some(x => x.id === kG.id)) f.push('fehlt der Blob des Originals, gilt ' + (e ? '„' + e.titel + '" {' + e._quelle + '}' : 'nichts — aber nicht strittig')); }
        // 14. Der Schwarm: Verlaengern, „fertig" in derselben Sekunde, abgelaufene juengste Lage (gebaute Lagen, Uhr gestellt).
        { const T = Date.parse('2026-03-01T00:00:00Z'), at = (h) => { const x = new Date(T + h * 36e5).toISOString(); return { datum: x.slice(0, 10), zeit: x.slice(11, 19) }; }, bis = (h) => new Date(T + h * 36e5).toISOString().replace(/\.\d{3}Z$/, 'Z');
          const X = mk('befund', Object.assign({ id: '2026-02-27-f0000001' }, at(-48))), Y = [2, 3, 4, 5].map(i => mk('befund', Object.assign({ id: '2026-02-27-f000000' + i }, at(-48))));
          const L = (id, von, h, b, ziele, extra) => mk('lage', Object.assign({ id, von, phase: 'laeuft', bis: bis(b) }, (ziele || []).length ? { bezug: ziele.map(z => ({ art: 'baut_auf', id: z.id })) } : {}, at(h), extra || {}));
          const p1 = L('2026-03-01-f1000001', 'sitzung/p', 0, 6, [X]), q1 = L('2026-03-01-f1000002', 'sitzung/q', 1, 7, [X]), p2 = L('2026-03-01-f1000003', 'sitzung/p', 5.83, 11.83, [X]);
          const s1 = A.schwarm([X, p1, q1, p2], T + 6.02 * 36e5, {}), u1 = s1.uebernahme.get(X.id);
          if (!u1 || u1.lage.e.von !== 'sitzung/p') f.push('wer kurz vor Ablauf verlaengert, verliert die Uebernahme an ' + (u1 ? u1.lage.e.von : 'niemanden'));
          const h3 = L('2026-03-01-f2000001', 'sitzung/r', 10, 20, Y.slice(0, 3)), fe = L('2026-03-01-f2000002', 'sitzung/r', 11, 12, [], { phase: 'fertig' }), n4 = L('2026-03-01-f2000003', 'sitzung/r', 11, 15, [Y[3]]);
          const s2 = A.schwarm(Y.concat([h3, fe, n4]), T + 11.5 * 36e5, {}), u2 = s2.uebernahme.get(Y[3].id);
          if (!u2 || u2.lage.e.id !== n4.id) f.push('„fertig" und eine neue Uebernahme in derselben Sekunde: die neue gilt nicht — ' + ((s2.unwirksam.find(x => x.e === n4) || {}).grund || ''));
          const ra = L('2026-03-01-f3000001', 'sitzung/s', 0, 20, [], { phase: 'letzte_runde', runde: '5/5' }), rb = L('2026-03-01-f3000002', 'sitzung/s', 0.01, 1.5, [X]);
          const s3 = A.schwarm([X, ra, rb], T + 2 * 36e5, {});
          if (!s3.lagen.some(l => l.e.id === ra.id)) f.push('eine abgelaufene juengste Lage verdeckt die laufende Runde');
          // Eine Lage, deren Ankunft in einem vollen Klon nicht bestimmbar ist, wirkt nicht (brettLesen setzt _ankunftUnbekannt).
          const lu = L('2026-03-01-f4000001', 'sitzung/u', 0, 10, [Y[0]]); Object.defineProperty(lu, '_ankunftUnbekannt', { value: true });
          const s4 = A.schwarm(Y.concat([lu]), T + 36e5, {}); if (!s4.unwirksam.some(x => x.e === lu && /nicht bestimmbar/.test(x.grund)) || s4.uebernahme.has(Y[0].id)) f.push('eine Lage mit unbestimmbarer Ankunft nimmt ihr Ziel'); }
        // 15. A8 lokal mit einer UNVERBUCHTEN Aenderung: der fremde Halt auf gsZwei beruehrt sie.
        g(d, ['checkout', '-q', '-B', 'claude/y', 'origin/main']); fs.writeFileSync(path.join(d, 'index.html'), QUELLE.replace('return gsEins() + gsEins();', 'return 3;'));
        { const h = A.haltsDiesesStands(d, {}); if (h.grund || !(h.treffer || []).some(x => x.h.e.id === hZwei.id)) f.push('A8 lokal bei einer unverbuchten Aenderung: ' + (h.grund || 'kein Treffer auf ' + hZwei.id)); }
        g(d, ['checkout', '-q', '-f', '--detach', 'origin/main']);
        if (f.length) return { ok: false, warum: f.join(' · ') };
        return { ok: true, info: 'fremder Upstream ≠ ich (naechste 1, HALT, --von abgewiesen, A10 rot), branch -m belegt · losgeloester HEAD nur eigener Name · Kopie mit frueherer Zeit nimmt nichts · Berichtigung, Merge main-vorn, Amend wirken · mit Verzeichnis: Amend-Rueckdatierung erkannt · verschiedene von / Grabstein / fehlender Blob: strittig · fremder Halt nach Merge berichtigt wirkt · nur Monatsordner · Name aus der Sicherung · neu angelegt berichtigt nichts (Gegenprobe) · DEIN EINTRAG · Verlaengern, fertig in derselben Sekunde, abgelaufene juengste Lage · A8 unverbucht' };
      } catch (e) { return { ok: false, warum: 'Ausnahme: ' + String(e.message).split('\n')[0] }; } finally { weg(eltern); }
    },
  },
  {
    name: 'C25 · Waechter (Gegenpruefung 4) · der ECHTE Schritt aus brett-waechter.yml: ein Rueckzug des Schreibers (je id oder je Fassung) gilt auch, nachdem sein Branch geloescht ist — kein Alarm, nicht mehr gesichert; eine neuere Berichtigung, die nur noch hier liegt, heisst in JEDEM Lauf „Zurueckgenommen?" und wird nie abgebaut; ohne Cache bleibt die Quarantaene (aus dem Verzeichnis, sonst weil der Name den Inhalt belegt); ein strittiger Eintrag wird nach dem Loeschen beider Branches nicht nach der Sortierung befoerdert; eine von Hand auf zz-sicherung gelegte Datei wird verworfen; ein unlesbarer Blob, der auf einem anderen Branch weiterlebt, ist kein Verlust; ein Rueckzug einer nie gesicherten Fassung ist kein Alarm; abgelaufene Lagen eines geloeschten Branches sind kein Verlust und kein „GERETTET"; ein veraltetes Gedaechtnis meldet einen Abbau nicht als Verlust; das Verzeichnis traegt erst/nichtVor und bleibt ohne Aenderung gleich',
    lauf: () => {
      const eltern = tmp('waechter4'), bare = path.join(eltern, 'origin.git'), d = path.join(eltern, 'klon'), cache = path.join(eltern, 'cache');
      try {
        const f = [];
        const yml = lies('.github/workflows/brett-waechter.yml');
        const schritt = ((yml.match(/name: Sicherung schreiben und melden\n(?: +env:\n(?: {10}[^\n]*\n)+)? +run: \|\n((?: {10}[^\n]*\n|\n)+)/) || [])[1] || '').replace(/^ {10}/gm, '');
        if (!schritt) return { ok: false, warum: 'der Schritt „Sicherung schreiben und melden" ist nicht lesbar' };
        cp.execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare]);
        fs.mkdirSync(d); g(d, ['init', '-q', '-b', 'main', '.']); g(d, ['remote', 'add', 'origin', 'file://' + bare]);
        fs.mkdirSync(path.join(d, 'scripts'));
        for (const n of ['austausch.mjs', '_austausch.mjs']) fs.copyFileSync(path.join(__dirname, n), path.join(d, 'scripts', n));
        fs.writeFileSync(path.join(d, 'index.html'), QUELLE);
        const m1 = mk('befund', { id: '2026-01-01-1111', titel: 'Auf main' });
        ablegen(d, m1); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'm1']); g(d, ['push', '-q', 'origin', 'main']);
        fs.mkdirSync(cache); const leer = path.join(eltern, 'gitconfig'); fs.writeFileSync(leer, '');
        let lauf = 0;
        const action = () => {
          const ws = path.join(eltern, 'lauf' + (++lauf), 'ws'); fs.mkdirSync(ws, { recursive: true });
          const env = Object.assign({}, process.env, { GIT_CONFIG_GLOBAL: leer, GIT_CONFIG_NOSYSTEM: '1', GH_TOKEN: 'unbenutzt', RUNNER_TEMP: cache, GITHUB_STEP_SUMMARY: path.join(eltern, 'zusammenfassung.md'), AUSTAUSCH_WURZEL: '', AUSTAUSCH_VON: '' });
          for (const a of [['init', '-q', '-b', 'main', '.'], ['remote', 'add', 'origin', 'file://' + bare], ['fetch', '-q', '--depth=1', 'origin', '+refs/heads/main:refs/remotes/origin/main'], ['checkout', '-q', '-B', 'main', 'refs/remotes/origin/main']]) cp.execFileSync('git', a, { cwd: ws, env, stdio: 'ignore' });
          const x = cp.spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', schritt], { cwd: ws, encoding: 'utf8', env });
          g(d, ['fetch', '-q', '--prune', 'origin', '+refs/heads/*:refs/remotes/origin/*']);
          return { code: x.status, aus: (x.stdout || '') + (x.stderr || '') };
        };
        const zz = (args) => { try { return g(d, args); } catch (_) { return ''; } };
        const baumZz = () => zz(['ls-tree', '-r', 'origin/zz-sicherung']);
        const standDatei = path.join(cache, 'brett-stand', 'stand.json'), gedaechtnis = () => JSON.parse(fs.readFileSync(standDatei, 'utf8'));
        const blobVon = (e) => cp.execFileSync('git', ['hash-object', '--stdin'], { input: typeof e === 'string' ? e : JSON.stringify(e, null, 2) + '\n', encoding: 'utf8' }).trim();
        const neuerZweig = (name, eintraege, von) => { g(d, ['checkout', '-q', '-B', name, von || 'origin/main']); for (const [e, n] of eintraege) ablegen(d, e, n); g(d, ['add', '-A']); g(d, ['commit', '-q', '--allow-empty', '-m', name]); g(d, ['push', '-q', '-f', 'origin', name]); g(d, ['checkout', '-q', '--detach', 'origin/main']); };
        const aufZweig = (name, tun) => { g(d, ['checkout', '-q', '-B', name, 'origin/' + name]); tun(); g(d, ['add', '-A']); g(d, ['commit', '-q', '--allow-empty', '-m', 'aenderung']); g(d, ['push', '-q', '-f', 'origin', name]); g(d, ['checkout', '-q', '--detach', 'origin/main']); };
        const loesche = (...namen) => { for (const n of namen) g(d, ['push', '-q', 'origin', '--delete', n]); g(d, ['checkout', '-q', '--detach']); for (const n of namen) { try { g(d, ['branch', '-q', '-D', n]); } catch (_) {} } };
        const pfadVon = (e) => path.join(d, A.ORDNER, e.id.slice(0, 7), e.id + '-' + e.art + '-x.json');
        let a = action();
        if (a.code !== 0) return { ok: false, warum: 'Aufbau: erster Lauf Exit ' + a.code + ' · ' + kurz(a.aus, 300) };
        // 0. Das Verzeichnis: in zz-sicherung, mit erst/nichtVor; ein Lauf ohne Aenderung schreibt keinen neuen Stand.
        { const v = A.verzeichnisPruefen(zz(['show', 'origin/zz-sicherung:' + A.VERZEICHNIS]));
          if (!v || !v.je.has(blobVon(m1))) f.push('das Verzeichnis fehlt in zz-sicherung oder nennt m1 nicht');
          const k = zz(['rev-parse', 'origin/zz-sicherung']).trim(); a = action();
          if (a.code !== 0 || zz(['rev-parse', 'origin/zz-sicherung']).trim() !== k || !/Nichts Neues zu sichern/.test(a.aus)) f.push('ein Lauf ohne Aenderung schreibt einen neuen Stand (das Verzeichnis aendert sich in jedem Lauf?)'); }
        // 1. Rueckzug auf dem eigenen Branch (je id), danach Branch geloescht: kein Alarm, nicht mehr gesichert, nicht „GERETTET".
        const x1 = mk('befund', { id: '2026-01-04-dddd', datum: '2026-01-04', von: 'sitzung/claude/x', titel: 'Mit einem Namen (soll weg)' });
        neuerZweig('claude/x', [[x1]]); a = action();
        aufZweig('claude/x', () => { fs.unlinkSync(pfadVon(x1)); fs.writeFileSync(path.join(d, A.GRABSTEINE), JSON.stringify([{ id: x1.id, datum: '2026-01-04', grund: 'ein Name im Text' }], null, 2) + '\n'); });
        a = action(); if (a.code !== 0 || !/zurueckgezogen[^\n]*2026-01-04-dddd/.test(a.aus)) f.push('Rueckzug je id: Exit ' + a.code + ' · ' + kurz(a.aus, 200));
        loesche('claude/x'); a = action();
        if (a.code !== 0 || /ALARM/.test(a.aus) || baumZz().indexOf(blobVon(x1)) >= 0) f.push('Rueckzug, danach Branch geloescht: Exit ' + a.code + (/ALARM/.test(a.aus) ? ', ALARM' : '') + (baumZz().indexOf(blobVon(x1)) >= 0 ? ', noch gesichert' : '') + ' · ' + kurz(a.aus, 200));
        { const r = werkzeug(d, ['holen']); if (/GERETTET/.test(r.aus)) f.push('ein zurueckgezogener Eintrag eines geloeschten Branches steht als „GERETTET" da'); }
        // … je Fassung (Grabstein mit blob auf dem eigenen Branch): kein Alarm schon beim Rueckzug.
        const y1 = mk('befund', { id: '2026-01-05-eeee', datum: '2026-01-05', von: 'sitzung/claude/y', titel: 'Diese Fassung soll weg' });
        neuerZweig('claude/y', [[y1]]); a = action();
        aufZweig('claude/y', () => { fs.unlinkSync(pfadVon(y1)); fs.writeFileSync(path.join(d, A.GRABSTEINE), JSON.stringify([{ id: y1.id, blob: blobVon(y1), datum: '2026-01-05', grund: 'diese Fassung' }], null, 2) + '\n'); });
        a = action(); if (a.code !== 0 || /ALARM/.test(a.aus)) f.push('Rueckzug je Fassung (Grabstein mit blob auf dem eigenen Branch): Exit ' + a.code + ' · ' + kurz(a.aus, 200));
        loesche('claude/y'); a = action(); if (a.code !== 0 || baumZz().indexOf(blobVon(y1)) >= 0) f.push('Rueckzug je Fassung, Branch geloescht: Exit ' + a.code + ', noch gesichert: ' + (baumZz().indexOf(blobVon(y1)) >= 0));
        // 2. Eine neuere Berichtigung nur noch hier: „Zurueckgenommen?" in JEDEM Lauf, nie „Nichts verloren", nie abgebaut.
        const f1 = mk('idee', { id: '2026-01-09-9999', datum: '2026-01-09', von: 'sitzung/claude/b', titel: 'Fassung 1' }), f2 = Object.assign({}, f1, { titel: 'Fassung 2' });
        neuerZweig('claude/b', [[f1]]); a = action();
        g(d, ['checkout', '-q', '-B', 'main', 'origin/main']); ablegen(d, f1); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'squash']); g(d, ['push', '-q', 'origin', 'main']); g(d, ['checkout', '-q', '--detach', 'origin/main']);
        aufZweig('claude/b', () => ablegen(d, f2)); a = action();
        loesche('claude/b'); a = action();
        if (!/Zurueckgenommen\?[^\n]*2026-01-09-9999/.test(a.aus)) f.push('neuere Berichtigung nur noch hier: kein „Zurueckgenommen?" · ' + kurz(a.aus, 200));
        a = action(); if (!/Zurueckgenommen\?[^\n]*2026-01-09-9999/.test(a.aus) || /Nichts verloren/.test(a.aus)) f.push('im Lauf DANACH: ' + (/Nichts verloren/.test(a.aus) ? '„Nichts verloren"' : 'kein „Zurueckgenommen?"'));
        { const st = gedaechtnis(); st.fassungen.forEach(x => { if (x.blob === blobVon(f2)) x.zuletzt = new Date(Date.now() - (A.SICHERUNG_ABBAU_TAGE + 1) * 864e5).toISOString(); }); fs.writeFileSync(standDatei, JSON.stringify(st)); }
        a = action(); if (baumZz().indexOf(blobVon(f2)) < 0) f.push('die neuere Berichtigung (einzige Kopie) wurde nach ' + A.SICHERUNG_ABBAU_TAGE + ' Tagen abgebaut');
        // 3. Strittig, beide Branches geloescht: keine Fassung unter eintraege/ (sonst entschiede die Sortierung der Blobs).
        const s0 = mk('befund', { id: '2026-01-08-8888', datum: '2026-01-08', von: 'sitzung/claude/s-a', titel: 'Original' });
        neuerZweig('claude/s-a', [[s0]]); neuerZweig('claude/s-b', [[Object.assign({}, s0, { von: 'sitzung/claude/s-b', titel: 'Faelschung' })]]);
        a = action(); loesche('claude/s-a', 'claude/s-b'); a = action();
        if (zz(['ls-tree', '-r', '--name-only', 'origin/zz-sicherung', '--', A.ORDNER]).indexOf('2026-01-08-8888') >= 0) f.push('ein strittiger Eintrag wurde nach dem Loeschen beider Branches unter eintraege/ befoerdert');
        // 4. Eine von Hand auf zz-sicherung gelegte gueltige Datei: verworfen, nicht befoerdert.
        { const h = mk('befund', { id: '2026-01-06-f00d', datum: '2026-01-06', von: 'sitzung/claude/opfer', titel: 'Untergeschoben' }), hb = blobVon(h);
          g(d, ['checkout', '-q', '-B', 'zzhand', 'origin/zz-sicherung']); const hp = path.join(d, A.FASSUNGEN, h.id); fs.mkdirSync(hp, { recursive: true }); fs.writeFileSync(path.join(hp, hb + '.json'), JSON.stringify(h, null, 2) + '\n');
          g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'hand']); g(d, ['push', '-q', '-f', 'origin', 'zzhand:zz-sicherung']); g(d, ['checkout', '-q', '-f', '--detach', 'origin/main']); g(d, ['branch', '-q', '-D', 'zzhand']);
          a = action(); if (baumZz().indexOf(hb) >= 0 || !/fremd[^\n]*2026-01-06-f00d|2026-01-06-f00d[^\n]*fremd/.test(a.aus)) f.push('eine von Hand auf zz-sicherung gelegte Datei wird uebernommen: Exit ' + a.code + ', noch da: ' + (baumZz().indexOf(hb) >= 0) + ' · ' + kurz(a.aus, 200)); }
        // 5. Ohne Cache: die Quarantaene bleibt (aus dem Verzeichnis; ohne Verzeichnis, weil der Name den Inhalt belegt).
        { const roh = '{"id": "2026-01-02-bbbb", "art": "befund", "kaputt": ', qb = blobVon(roh);
          g(d, ['checkout', '-q', '-B', 'zzhand', 'origin/zz-sicherung']); fs.mkdirSync(path.join(d, A.QUARANTAENE), { recursive: true }); fs.writeFileSync(path.join(d, A.QUARANTAENE, qb + '.json'), roh);
          const vp = path.join(d, A.VERZEICHNIS), v = JSON.parse(fs.readFileSync(vp, 'utf8')); v.quarantaene = (v.quarantaene || []).concat([qb]).sort(); fs.writeFileSync(vp, JSON.stringify(v, null, 1) + '\n');
          g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'quar']); g(d, ['push', '-q', '-f', 'origin', 'zzhand:zz-sicherung']); g(d, ['checkout', '-q', '-f', '--detach', 'origin/main']); g(d, ['branch', '-q', '-D', 'zzhand']);
          fs.rmSync(path.join(cache, 'brett-stand'), { recursive: true, force: true });
          a = action(); if (baumZz().indexOf(qb) < 0 || !/gelesen aus dem Verzeichnis der Sicherung/.test(a.aus)) f.push('ohne Cache (Verzeichnis da): die Quarantaene ' + (baumZz().indexOf(qb) < 0 ? 'ist vernichtet' : 'blieb, aber nicht ueber das Verzeichnis') + ' · ' + kurz(a.aus, 200));
          g(d, ['checkout', '-q', '-B', 'zzhand', 'origin/zz-sicherung']); g(d, ['rm', '-q', A.VERZEICHNIS]); g(d, ['commit', '-q', '-m', 'ohne verzeichnis']); g(d, ['push', '-q', '-f', 'origin', 'zzhand:zz-sicherung']); g(d, ['checkout', '-q', '-f', '--detach', 'origin/main']); g(d, ['branch', '-q', '-D', 'zzhand']);
          fs.rmSync(path.join(cache, 'brett-stand'), { recursive: true, force: true });
          a = action(); if (baumZz().indexOf(qb) < 0) f.push('ohne Cache und ohne Verzeichnis vernichtet der Waechter die Quarantaene (der Name belegt den Inhalt) · ' + kurz(a.aus, 200)); }
        // 6. Ein unlesbarer Blob, der auf einem anderen Branch weiterlebt (umbenannt, abgezweigt), ist kein Verlust.
        { neuerZweig('claude/u', [['{"id": "2026-01-14-1414", "art": "idee", ', '2026-01-14-1414-idee-x.json']]); a = action();
          neuerZweig('claude/u2', [], 'origin/claude/u'); loesche('claude/u'); a = action();
          if (a.code !== 0 || /Unlesbare Datei\(en\) mit ihrem Branch verschwunden/.test(a.aus)) f.push('ein unlesbarer Blob, der auf einem anderen Branch weiterlebt, heisst „verschwunden": Exit ' + a.code + ' · ' + kurz(a.aus, 200));
          // … und eine unlesbare Datei auf main, die dort entfernt wird: main besteht (der Arbeitsbaum des Waechters IST main).
          g(d, ['checkout', '-q', '-B', 'main', 'origin/main']); ablegen(d, '<<<<<<< HEAD\n{}\n=======\n{}\n>>>>>>> x\n', '2026-01-18-1818-idee-x.json'); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'konflikt']); g(d, ['push', '-q', 'origin', 'main']);
          a = action(); g(d, ['rm', '-q', path.join(A.ORDNER, '2026-01', '2026-01-18-1818-idee-x.json')]); g(d, ['commit', '-q', '-m', 'weg']); g(d, ['push', '-q', 'origin', 'main']); g(d, ['checkout', '-q', '--detach', 'origin/main']);
          a = action(); if (a.code !== 0 || /Unlesbare Datei\(en\) mit ihrem Branch verschwunden/.test(a.aus)) f.push('eine auf main entfernte unlesbare Datei ergibt ALARM (der Arbeitsbaum zaehlte nie als bestehend): Exit ' + a.code + ' · ' + kurz(a.aus, 200)); }
        // 7. Rueckzug einer wegen eines Geheimnis-Musters NIE gesicherten Fassung: kein Alarm.
        { const z = mk('befund', { id: '2026-01-11-1111', datum: '2026-01-11', von: 'sitzung/claude/z', titel: 'nur Nullen ' + ['00000000', '0000', '0000', '0000', '000000000000'].join('-') });
          neuerZweig('claude/z', [[z]]); a = action();
          if (!/Nicht gesichert[^\n]*2026-01-11-1111/.test(a.aus)) f.push('Aufbau: die Fassung mit Geheimnis-Muster wurde gesichert');
          aufZweig('claude/z', () => { fs.unlinkSync(pfadVon(z)); fs.writeFileSync(path.join(d, A.GRABSTEINE), JSON.stringify([{ id: z.id, datum: '2026-01-11', grund: 'Falschmeldung des Musters' }], null, 2) + '\n'); });
          a = action(); if (a.code !== 0 || /Nie gesicherte Fassung/.test(a.aus)) f.push('ein Rueckzug nach README einer nie gesicherten Fassung ergibt ALARM: Exit ' + a.code + ' · ' + kurz((a.aus.match(/ALARM[^\n]*/g) || [a.aus]).join(' | '), 400)); }
        // 8. Abgelaufene Lagen eines geloeschten Branches: kein Alarm, kein „GERETTET".
        { const tv = new Date(Date.now() - 30 * 36e5), st = { datum: tv.toISOString().slice(0, 10), zeit: tv.toISOString().slice(11, 19) }, bis = new Date(Date.now() - 26 * 36e5).toISOString().replace(/\.\d{3}Z$/, 'Z');
          neuerZweig('claude/abl', [[mk('lage', Object.assign({ id: st.datum + '-1919', von: 'sitzung/claude/abl', phase: 'laeuft', bis }, st))], [mk('lage', Object.assign({ id: st.datum + '-2020', von: 'sitzung/claude/abl', phase: 'fertig', bis }, st))]]);
          a = action(); loesche('claude/abl'); a = action();
          if (a.code !== 0 || /ALARM/.test(a.aus)) f.push('abgelaufene Lagen eines geloeschten Branches ergeben ALARM: Exit ' + a.code + ' · ' + kurz(a.aus, 200));
          const r = werkzeug(d, ['holen']); if (/GERETTET/.test(r.aus)) f.push('abgelaufene Lagen eines geloeschten Branches stehen als „GERETTET" da'); }
        // 9. Ein veraltetes Gedaechtnis (Ablegen gescheitert) meldet einen Abbau nicht als Verlust.
        { const alt = mk('idee', { id: '2026-01-17-1717', datum: '2026-01-17', von: 'sitzung/claude/v', titel: 'Alte Fassung' }), neu = Object.assign({}, alt, { titel: 'Neue Fassung' });
          neuerZweig('claude/v', [[alt]]); a = action();
          g(d, ['checkout', '-q', '-B', 'main', 'origin/main']); ablegen(d, neu); g(d, ['add', '-A']); g(d, ['commit', '-q', '-m', 'neu auf main']); g(d, ['push', '-q', 'origin', 'main']); g(d, ['checkout', '-q', '--detach', 'origin/main']);
          aufZweig('claude/v', () => ablegen(d, neu)); a = action(); loesche('claude/v'); a = action();
          const st = gedaechtnis(); st.fassungen.forEach(x => { if (x.blob === blobVon(alt)) x.zuletzt = new Date(Date.now() - (A.SICHERUNG_ABBAU_TAGE + 1) * 864e5).toISOString(); }); fs.writeFileSync(standDatei, JSON.stringify(st));
          const vorher = fs.readFileSync(standDatei, 'utf8');
          a = action(); if (!/Abgebaut[^\n]*2026-01-17-1717/.test(a.aus)) f.push('Aufbau: die abgeloeste Fassung wurde nicht abgebaut · ' + kurz(a.aus, 200));
          fs.writeFileSync(standDatei, vorher);   // wie nach einem gescheiterten actions/cache/save
          a = action(); if (a.code !== 0 || /verloren\): 2026-01-17-1717/.test(a.aus)) f.push('ein veraltetes Gedaechtnis meldet den Abbau als Verlust: Exit ' + a.code + ' · ' + kurz(a.aus, 200)); }
        // 10. Ein Branch-Name, der verschwand und NEU ANGELEGT wird: der Waechter merkt es; die Fassung dort ist keine
        //     Berichtigung, „Nichts verloren" steht nicht da, und das Verzeichnis nennt den Branch fuer alle Leser.
        { const k = mk('befund', { id: '2026-01-21-2121', datum: '2026-01-21', von: 'sitzung/claude/k', dringlichkeit: 'kritisch', titel: 'Login geht nicht mehr' });
          neuerZweig('claude/k', [[k]]); a = action(); loesche('claude/k'); a = action();
          neuerZweig('claude/k', [[Object.assign({}, k, { titel: 'Login geht wieder', dringlichkeit: undefined })]]); a = action();
          const v = A.verzeichnisPruefen(zz(['show', 'origin/zz-sicherung:' + A.VERZEICHNIS]));
          const prim = zz(['show', 'origin/zz-sicherung:' + A.ORDNER + '/2026-01/2026-01-21-2121-befund-x.json']);
          if (!/Neu angelegt[^\n]*claude\/k/.test(a.aus) || /Nichts verloren/.test(a.aus) || !v || !v.neuAngelegt.has('origin/claude/k') || prim.indexOf('Login geht nicht mehr') < 0) f.push('ein neu angelegter Branch-Name: ' + [!/Neu angelegt[^\n]*claude\/k/.test(a.aus) ? 'nicht gemeldet' : '', /Nichts verloren/.test(a.aus) ? '„Nichts verloren"' : '', !v || !v.neuAngelegt.has('origin/claude/k') ? 'nicht im Verzeichnis' : '', prim.indexOf('Login geht nicht mehr') < 0 ? 'unter eintraege/ liegt die neue Fassung' : ''].filter(Boolean).join(', '));
          const bl = A.brettLesen(d, { alleRefs: true }), e = bl.eintraege.find(x => x.id === k.id);
          if (!e || e.titel !== 'Login geht nicht mehr') f.push('fuer Leser gilt nach dem Neuanlegen ' + (e ? '„' + e.titel + '" {' + e._quelle + '}' : 'nichts') + ' — erwartet die gesicherte Fassung'); }
        // 11. Ein Gedaechtnis im alten Format (ohne erst): kein Absturz, kein Alarm — die erste Sichtung heisst „unbekannt"
        //     (nichtVor leer), nicht „jetzt".
        { const st = gedaechtnis(); st.fassungen.forEach(x => { delete x.erst; delete x.nichtVor; delete x.heim; delete x.anspruch; }); delete st.refs; fs.writeFileSync(standDatei, JSON.stringify(st));
          a = action(); const v = A.verzeichnisPruefen(zz(['show', 'origin/zz-sicherung:' + A.VERZEICHNIS]));
          if (a.code !== 0 || !v || ![...v.je.values()].some(x => x.nichtVor == null) || !gedaechtnis().fassungen.some(x => x.erstUnbekannt === true)) f.push('Gedaechtnis im alten Format: Exit ' + a.code + ', nichtVor leer im Verzeichnis: ' + !!(v && [...v.je.values()].some(x => x.nichtVor == null)) + ' · ' + kurz(a.aus, 200)); }
        if (f.length) return { ok: false, warum: f.join(' · ') };
        return { ok: true, info: 'Verzeichnis da, ein Lauf ohne Aenderung schreibt nichts · Rueckzug je id und je Fassung, Branch geloescht: kein Alarm, nicht gesichert, nicht GERETTET · neuere Berichtigung: jeder Lauf „Zurueckgenommen?", nie abgebaut · strittig nicht befoerdert · Handarbeit auf zz-sicherung verworfen · Quarantaene ohne Cache bewahrt (zweifach) · unlesbarer Blob lebt weiter: kein Alarm · Rueckzug nie gesicherter Fassung · abgelaufene Lagen · veraltetes Gedaechtnis · neu angelegter Branch gemeldet und im Verzeichnis · altes Gedaechtnisformat' };
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
