#!/usr/bin/env node
// austausch.mjs — das Brett, an dem sich ALLE KI-Sitzungen und ihre Unteragenten austauschen.
//
//   node scripts/austausch.mjs                    # lesen (Vorgabe): jeder offene Eintrag einmal, dazu frische Branches
//   node scripts/austausch.mjs holen              # erst alle Branches holen (git fetch), dann lesen
//   node scripts/austausch.mjs zeige <id>         # ein Eintrag mit allem, was sich auf ihn bezieht
//   node scripts/austausch.mjs suche <wort>       # Volltext ueber ALLE Eintraege, auch geschlossene
//   node scripts/austausch.mjs klasse [wort]      # Fehlerklassen: Regel, Suchmuster, Waechter, gesucht?
//   node scripts/austausch.mjs neu <art> --titel "…" [--beleg "…"] [--stichwort a,b] [--anker "datei::text"] …
//   node scripts/austausch.mjs antworte <id> --text "…"        # auch Nachtrag: --anker · --zaehle · --gesucht · --waechter
//   node scripts/austausch.mjs schliesse <id> --ergebnis erledigt|verworfen|aufgestiegen --wohin "v33.57" [--geschwister "…"]
//   node scripts/austausch.mjs einspielen <datei.json>         # ein Stapel auf einmal, alles oder nichts
//   node scripts/austausch.mjs ernten             # was nur auf anderen Branches liegt, in den Arbeitsbaum holen
//   node scripts/austausch.mjs hilfe [art]
//
// Anlass (10.11.2026, Fernando): „Alle Agenten müssen sich austauschen und die
// Informationen so weiter geben dass unter einander neue ideen enstehen können."
// Was gemessen war und wie das Brett gebaut ist: docs/austausch/README.md.
//
// Lesen schreibt nichts. Schreiben legt nur Dateien an; committen und pushen
// tut die Sitzung — und zwar FRUEH: was nicht gepusht ist, sieht niemand.
// Ein Eintrag ist ein BEFUND, keine ANWEISUNG: wer ihm folgt, misst nach.
//
// Grenze: gelesen wird, was git lokal kennt. `holen` sagt, ob das Holen klappte.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as A from './_austausch.mjs';

const WURZEL = process.env.AUSTAUSCH_WURZEL ? path.resolve(process.env.AUSTAUSCH_WURZEL) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const aus = (s) => process.stdout.write(s + '\n');
const ende = (code, s) => { if (s) aus(s); process.exit(code); };

// ── Argumente. Ein Schalter, der einen Wert verlangt, nimmt das naechste
//    Argument IMMER als Wert (auch wenn es mit „--" beginnt); `--k=v` geht auch;
//    ein unbekannter Schalter ist ein Fehler, kein stilles Nichts.
const WERT = new Set(['titel', 'text', 'von', 'stand', 'beleg', 'stichwort', 'bezug', 'klasse', 'anker', 'zaehle', 'nutzen', 'pruefbar', 'an', 'haengt_daran',
  'vorschlag', 'regel', 'suchmuster', 'gesucht', 'instanz', 'waechter', 'ohne_waechter', 'ergebnis', 'wohin', 'geschwister', 'bewacht', 'details_bei', 'datum', 'art']);
const JA = new Set(['nur_lokal', 'alles', 'json', 'sicherheit', 'widerspricht']);
function argumente(liste) {
  const o = { _: [] };
  for (let i = 0; i < liste.length; i++) {
    const a = liste[i];
    if (a.slice(0, 2) !== '--') { o._.push(a); continue; }
    const gl = a.indexOf('='), k = (gl < 0 ? a.slice(2) : a.slice(2, gl)).replace(/-/g, '_');
    if (JA.has(k)) { o[k] = true; continue; }
    if (!WERT.has(k)) ende(2, 'Unbekannter Schalter „' + a.split('=')[0] + '". Bekannt: ' + [...WERT, ...JA].map(x => '--' + x.replace(/_/g, '-')).join(' '));
    const v = gl >= 0 ? a.slice(gl + 1) : liste[++i];
    if (v == null) ende(2, 'Der Schalter „' + a + '" verlangt einen Wert.');
    o[k] = o[k] == null ? v : [].concat(o[k], v);
  }
  return o;
}
const argv = process.argv.slice(2);
const befehl = (argv[0] && argv[0].slice(0, 2) !== '--') ? argv.shift() : 'lesen';
const o = argumente(argv);
const mehrere = (v) => v == null ? [] : [].concat(v);
const knapp = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const liesRel = (rel) => { try { return fs.readFileSync(path.join(WURZEL, rel), 'utf8'); } catch (_) { return null; } };
const quelltext = () => { const a = liesRel('index.html'); return a == null ? null : a + '\n' + (liesRel('sw.js') || ''); };
const laufendeVersion = () => { const m = (liesRel('index.html') || '').match(/\bGS_VERSION\s*=\s*'(v\d+\.\d+)'/); return m ? m[1] : null; };
const brett = () => A.brettLesen(WURZEL, { alleRefs: !o.nur_lokal });

function ich() {
  if (o.von) return String(o.von);
  if (process.env.AUSTAUSCH_VON) return process.env.AUSTAUSCH_VON;
  const b = (A.git(WURZEL, ['rev-parse', '--abbrev-ref', 'HEAD']) || '').trim();
  // „HEAD", „main" sind keine Sitzung: der Schreiber muss sich nennen (losgeloester HEAD, CI, fremde Werkzeuge).
  if (!b || b === 'HEAD' || b === 'main' || b === 'master') ende(2, 'Wer schreibt? Auf „' + (b || 'keinem Branch') + '" laesst sich das nicht ablesen — bitte --von "sitzung/<name>" (kein Personenname).');
  return 'sitzung/' + b;
}
// Eine id darf abgekuerzt werden: die vier Zeichen am Ende reichen, wenn sie eindeutig sind.
function finde(b, kennung) {
  kennung = String(kennung || '').trim();
  if (!kennung) ende(2, 'Welcher Eintrag? Erwartet wird eine id (die vier Zeichen am Ende genuegen).');
  const genau = b.eintraege.find(e => e.id === kennung);
  if (genau) return genau;
  const t = b.eintraege.filter(e => e.id.slice(-kennung.length) === kennung);
  if (t.length === 1) return t[0];
  ende(2, t.length ? '„' + kennung + '" ist nicht eindeutig: ' + t.map(e => e.id).join(', ') : 'Kein Eintrag „' + kennung + '". `node scripts/austausch.mjs suche <wort>` hilft suchen.');
}
function kopf(b, abl) {
  const offen = b.eintraege.filter(e => abl.zustand.get(e.id).z === 'offen').length;
  aus('\n=== Austausch — das Brett   ' + b.eintraege.length + ' Eintraege · ' + offen + ' offen · gelesen: ' + b.quellen.join(', ')
    + (b.gitDa === false ? ' · git nicht verfuegbar: NUR der Arbeitsbaum' : (b.gitDa ? ' · ' + b.refs + ' Remote-Refs' : '')));
  if (b.gitDa && b.refs <= 1) aus('  !! Hoechstens EIN Remote-Ref sichtbar — Eintraege und Arbeit auf anderen Branches sind von hier aus NICHT zu sehen: node scripts/austausch.mjs holen');
  // main ist ungeschuetzt, und nach dem Merge laeuft kein Pruefstand: zwei gruene PRs
  // koennen einen roten Stand hinterlassen. Wer anfaengt, erfaehrt es hier zuerst.
  const lokal = A.brettLesen(WURZEL, { alleRefs: false });
  const rot = A.brettPruefen(lokal).length + A.ankerPruefen(lokal.eintraege, liesRel).verloren.length;
  if (rot) aus('  !! Auf DIESEM Stand ist das Brett schon rot (' + rot + ' Maengel) — geerbt, nicht von dir: node scripts/austausch_check.js zeigt sie');
  if (b.unlesbar.length) aus('  !! ' + b.unlesbar.length + ' unlesbare Datei(en): ' + b.unlesbar.slice(0, 4).map(u => u.datei + ' [' + u.quelle + '] ' + u.grund).join(' · '));
  if (b.abweichend.length) aus('  !! ' + b.abweichend.length + ' Eintrag/Eintraege sehen auf einem Branch anders aus als hier (umgeschrieben?): ' + b.abweichend.slice(0, 4).map(x => x.id + ' — es gilt ' + x.gilt + ', abweichend ' + x.weichtAb).join(' · '));
}
const zeichen = { offen: ' ', beantwortet: '✓', geschlossen: '×', ersetzt: '×', notiz: '·' };

function lesen() {
  const b = brett(), abl = A.ableiten(b.eintraege), src = quelltext();
  if (o.json) return aus(JSON.stringify(b.eintraege.map(e => Object.assign({}, e, { zustand: abl.zustand.get(e.id).z, quelle: e._quelle })), null, 1));
  kopf(b, abl);
  let sicht = b.eintraege.filter(e => abl.zustand.get(e.id).z === 'offen');
  if (o.art) sicht = sicht.filter(e => e.art === o.art);
  if (o.stichwort) { const w = String(o.stichwort).toLowerCase(); sicht = sicht.filter(e => A.alsListe(e.stichworte).some(s => String(s).toLowerCase() === w)); }
  if (o.an) sicht = sicht.filter(e => String(e.an || '').toLowerCase() === String(o.an).toLowerCase());
  const gefiltert = !!(o.art || o.stichwort || o.an), deckel = o.alles ? 1e9 : 12;
  if (!gefiltert) {
    // Was der Code ueber MEHRERE Eintraege hinweg sieht — nur wenn es etwas gibt.
    const an = A.anstoesse(b.eintraege, liesRel);
    let art = null;
    for (const x of an.slice(0, o.alles ? 1e9 : 10)) {
      if (x.art !== art) { art = x.art; aus('\n' + A.ANSTOSS_ARTEN[art].toUpperCase()); }
      aus('  ' + knapp(x.satz, 230));
    }
    if (!o.alles && an.length > 10) aus('  … +' + (an.length - 10) + ' weitere — `--alles`');
  }
  const block = (titel, art) => {
    const l = sicht.filter(e => e.art === art).sort((x, y) => A.ordnung(y).localeCompare(A.ordnung(x)));
    if (!l.length) return;
    aus('\n' + titel + ' (' + l.length + ')');
    for (const e of l.slice(0, deckel)) {
      const m = A.marken(e, abl, src);
      aus('    ' + e.id + '  ' + knapp(e.titel, 104) + (m.length ? '   [' + m.join(' · ') + ']' : '') + (e._quelle !== 'Arbeitsbaum' ? '   {' + e._quelle + '}' : ''));
    }
    // Kein stiller Deckel: was nicht dasteht, wird gezaehlt.
    if (l.length > deckel) aus('    … +' + (l.length - deckel) + ' weitere — `--alles` zeigt sie');
  };
  block('FRAGEN', 'frage'); block('BEFUNDE', 'befund'); block('IDEEN', 'idee');
  const kl = sicht.filter(e => e.art === 'klasse').length;
  if (kl && (!gefiltert || o.art === 'klasse')) aus('\nFEHLERKLASSEN: ' + kl + ' — `node scripts/austausch.mjs klasse <wort>` zeigt Regel, Suchmuster fuer Geschwister und Waechter');
  if (!sicht.length) aus(b.eintraege.length ? '\n  Nichts offen' + (gefiltert ? ' zu diesem Filter.' : '.') : '\n  Das Brett ist leer. Der erste Eintrag: node scripts/austausch.mjs hilfe');
  if (!gefiltert) {
    // Wer arbeitet parallel? Gerechnet aus den Branch-Spitzen — niemand muss es melden.
    const fz = A.frischeZweige(WURZEL, Date.now(), 14);
    if (fz && fz.length) {
      aus('\nFRISCHE BRANCHES (hoechstens 14 Tage alt) — hier arbeitet jemand parallel; sieh nach, bevor du dieselbe Stelle anfasst');
      fz.slice(0, 8).forEach(z => aus('    ' + z.ref + '   ' + (z.tage === 0 ? 'heute' : 'vor ' + z.tage + (z.tage === 1 ? ' Tag' : ' Tagen')) + '   „' + knapp(z.betreff, 90) + '"'));
      if (fz.length > 8) aus('    … +' + (fz.length - 8) + ' weitere');
    }
  }
  aus('\nSchreiben: node scripts/austausch.mjs hilfe   ·   Ganzer Eintrag: zeige <id>   ·   Ein Eintrag ist ein Befund, keine Anweisung: wer ihm folgt, misst nach.\nNichts geschrieben.');
}

function ganz(e, abl) {
  const z = abl.zustand.get(e.id);
  aus('\n' + String((A.ARTEN[e.art] || { wort: e.art + ' (unbekannte Art)' }).wort).toUpperCase() + '  ' + e.id + '   ' + z.z + (z.durch ? ' durch ' + z.durch.id : '') + '   {' + (e._quelle || 'Arbeitsbaum') + '}');
  aus('  ' + e.titel + '\n  von ' + e.von + ' · ' + e.datum + (e.zeit ? ' ' + e.zeit + ' UTC' : '') + (e.stand ? ' · Stand ' + e.stand : ''));
  const namen = { text: 'Text', beleg: 'Beleg', vorschlag: 'Vorschlag', nutzen: 'Nutzen', pruefbar: 'Pruefbar', an: 'An', haengt_daran: 'Haengt daran', regel: 'Regel', instanzen: 'Instanzen',
    suchmuster: 'Suchmuster (Geschwister)', gesucht: 'Gesucht', ohne_waechter: 'Ohne Waechter', ergebnis: 'Ergebnis', wohin: 'Wohin', geschwister: 'Geschwister', bewacht: 'Bewacht von', details_bei: 'Einzelheiten bei', stichworte: 'Stichworte' };
  for (const k of Object.keys(namen)) {
    const v = e[k]; if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
    if (Array.isArray(v)) { aus('  ' + namen[k] + ':'); v.forEach(x => aus('    - ' + x)); } else aus('  ' + namen[k] + ': ' + String(v).split('\n').join('\n    '));
  }
  A.alsListe(e.waechter).forEach(w => aus('  Waechter: ' + w.datei + ' · „' + w.fall + '"'));
  if (e.sicherheit) aus('  Sicherheit: ja — Einzelheiten stehen bewusst nicht hier (public Repo)');
  const hier = !e._quelle || e._quelle === 'Arbeitsbaum';
  for (const x of A.ankerWirksam(e, abl.rueck)) { const t = A.messtext(x.datei, liesRel(x.datei)); aus('  Anker: ' + x.datei + ' :: ' + x.text + (hier ? (t == null ? '   ← DATEI FEHLT' : (t.indexOf(x.text) < 0 ? '   ← STEHT NICHT MEHR DA' : '')) : '')); }
  for (const x of A.zaehleWirksam(e, abl.rueck)) { const h = A.wieOft(A.messtext(x.datei, liesRel(x.datei)), x.text); aus('  Zaehlung: ' + x.datei + ' :: ' + x.text + '  → beim Eintrag ' + x.n + (hier ? ', heute ' + (h == null ? 'nicht lesbar' : h) + (h !== x.n ? '   ← BEWEGT' : '') : '')); }
  for (const bz of A.alsListe(e.bezug)) { const ziel = abl.proId.get(bz.id); aus('  → ' + bz.art + ' ' + bz.id + (ziel ? '  ' + knapp(ziel.titel, 90) : '  (fehlt)')); }
  for (const r of (abl.rueck.get(e.id) || [])) aus('  ← ' + r.art + ' von ' + r.von.id + '  ' + knapp(r.von.titel, 90) + '  [' + r.von.von + ']');
}
function zeige() { const b = brett(), abl = A.ableiten(b.eintraege); if (!o._.length) ende(2, 'Gebrauch: node scripts/austausch.mjs zeige <id>'); for (const k of o._) ganz(finde(b, k), abl); aus('\nNichts geschrieben.'); }
function suche() {
  const w = o._.join(' ').toLowerCase(); if (!w) ende(2, 'Gebrauch: node scripts/austausch.mjs suche <wort>');
  const b = brett(), abl = A.ableiten(b.eintraege), t = b.eintraege.filter(e => A.textVon(e).toLowerCase().indexOf(w) >= 0);
  aus('\n„' + w + '": ' + t.length + ' von ' + b.eintraege.length + ' Eintraegen   (× geschlossen/ersetzt · ✓ beantwortet · · Antwort/Abschluss)');
  t.forEach(e => aus('  ' + zeichen[abl.zustand.get(e.id).z] + ' ' + e.id + '  (' + e.art + ')  ' + knapp(e.titel, 100)));
  aus('\nNichts geschrieben.');
}
function klasse() {
  const w = o._.join(' ').toLowerCase(), b = brett(), abl = A.ableiten(b.eintraege);
  const kl = b.eintraege.filter(e => e.art === 'klasse' && abl.zustand.get(e.id).z === 'offen' && (!w || A.textVon(e).toLowerCase().indexOf(w) >= 0));
  aus('\nFehlerklassen' + (w ? ' zu „' + w + '"' : '') + ': ' + kl.length);
  // Ohne Suchwort die kurze Liste; mit Suchwort (oder --alles) die ganze Karte.
  for (const e of kl) {
    const k = A.klasseWirksam(e, abl.rueck);
    if (!w && !o.alles) { aus('  ' + e.id + '  ' + knapp(e.titel, 84) + '   [' + k.instanzen.length + ' Instanzen' + (k.waechter.length ? '' : ' · ohne Waechter') + (k.gesucht.length ? '' : ' · nie gesucht') + ']'); continue; }
    aus('\n  ' + e.id + '  ' + e.titel + '\n    Regel:      ' + k.regel);
    if (e.text) aus('    Erkennen:   ' + knapp(e.text, 400));
    aus('    Instanzen:  ' + k.instanzen.length + (k.befunde.length ? ' + ' + k.befunde.length + ' auf dem Brett (' + k.befunde.map(x => x.id).join(', ') + ')' : '') + ' — ' + knapp(k.instanzen.join(' | '), o.alles ? 1e5 : 260));
    aus('    Geschwister suchen: ' + (k.suchmuster || '(noch kein Suchmuster — wer eines findet: antworte ' + e.id.slice(-4) + ' --suchmuster "…")'));
    aus('    Waechter:   ' + (k.waechter.length ? k.waechter.map(x => x.datei.replace(/^scripts\//, '') + ' „' + knapp(x.fall, 70) + '"').join(' · ') : 'KEINER — ' + k.ohne_waechter));
    aus('    Gesucht:    ' + (k.gesucht.length ? k.gesucht.join(' · ') : 'nie systematisch — „eine Fehlerklasse ist erst geschlossen, wenn man sie GESUCHT hat"'));
  }
  if (!kl.length && w) aus('  Nichts gefunden. Ist dein Fund die zweite Instanz eines NEUEN Musters? → node scripts/austausch.mjs hilfe klasse');
  aus('\nPasst dein Fund? Das Suchmuster fahren, BEVOR du nur den einen Fall behebst; dann `neu befund … --klasse <id>`.\nGesucht oder einen Waechter gebaut? `antworte <id> --gesucht "vXX.YY: N Stellen, M weitere" [--waechter "scripts/x_check.js::Fallkennung"]`\nNichts geschrieben.');
}

const paar = (w, feld) => { const i = String(w).indexOf('::'); if (i < 0) ende(2, '--' + feld + ' erwartet "datei::text"'); return [String(w).slice(0, i).trim(), String(w).slice(i + 2)]; };
function ausSchaltern(art) {
  const e = { art };
  for (const k of ['titel', 'text', 'stand', 'nutzen', 'pruefbar', 'an', 'haengt_daran', 'vorschlag', 'regel', 'suchmuster', 'gesucht', 'ohne_waechter', 'ergebnis', 'wohin', 'geschwister', 'bewacht', 'details_bei', 'datum']) {
    if (o[k] != null) e[k] = mehrere(o[k]).join('\n');
  }
  if (o.beleg) e.beleg = mehrere(o.beleg);
  const sw = mehrere(o.stichwort).join(',').split(',').map(s => s.trim()).filter(Boolean);
  if (sw.length) e.stichworte = sw;
  if (o.instanz) e.instanzen = mehrere(o.instanz);
  if (o.anker) e.anker = mehrere(o.anker).map(w => { const [datei, text] = paar(w, 'anker'); return { datei, text }; });
  // --zaehle "datei::text" zaehlt selbst (ohne Kommentarzeilen und Changelog); "datei::text::n" wird nachgerechnet.
  if (o.zaehle) e.zaehle = mehrere(o.zaehle).map(w => {
    let [datei, text] = paar(w, 'zaehle'), n = null;
    const m = text.match(/^(.*)::(\d+)$/s);
    if (m) { text = m[1]; n = Number(m[2]); } else { n = A.wieOft(A.messtext(datei, liesRel(datei)), text); if (n == null) n = -1; }
    return { datei, text, n };
  });
  if (o.waechter) e.waechter = mehrere(o.waechter).map(w => { const [datei, fall] = paar(w, 'waechter'); return { datei, fall: fall.trim() }; });
  if (o.sicherheit) e.sicherheit = true;
  if (art === 'klasse' && e.waechter == null) e.waechter = [];
  return e;
}
function bezuege(b) {
  return mehrere(o.klasse).map(k => ({ art: 'gehoert_zu', id: finde(b, k).id })).concat(mehrere(o.bezug).map(x => {
    const i = String(x).indexOf(':'); if (i < 0) ende(2, '--bezug erwartet art:id (z.B. baut_auf:a3f9). Arten: ' + Object.keys(A.BEZUEGE).join(' · '));
    return { art: x.slice(0, i).trim(), id: finde(b, x.slice(i + 1)).id };
  }));
}
function schreiben(e) {
  if (!e.stand) { const v = laufendeVersion(); if (v) e.stand = v; }
  const r = A.einspielen(WURZEL, [e], { von: ich(), datum: e.datum, alleRefs: !o.nur_lokal });
  if (!r.ok) { aus('\nNICHT geschrieben — ' + r.fehler.length + ' Grund/Gruende:'); r.fehler.forEach(f => aus('  !! ' + f.grund)); ende(1, '\nFelder und ein Beispiel: node scripts/austausch.mjs hilfe ' + e.art); }
  const g = r.geschrieben[0];
  aus('\nGeschrieben: ' + g.datei + '\n  ' + g.id + '  ' + g.titel);
  r.mitgenommen.forEach(m => aus('Mitgenommen (lag nur auf ' + m.quelle + ' — der Bezug waere im Arbeitsbaum sonst leer): ' + m.id + '  ' + knapp(m.titel, 80)));
  // Lesen ist ins Schreiben eingebaut: was wissen ANDERE an denselben Stichworten?
  const b2 = brett(), neuE = b2.eintraege.find(x => x.id === g.id);
  if (neuE) {
    const nb = A.nachbarn(neuE, b2.eintraege), offenN = nb.filter(x => !x.irrweg), irr = nb.filter(x => x.irrweg);
    if (offenN.length) { aus('\nNACHBARN — offene Eintraege anderer an denselben Stichworten. Gemeinsame Ursache? Dann `antworte <id>` oder ein Eintrag mit --bezug baut_auf:<id> auf beide:'); offenN.slice(0, 6).forEach(x => aus('  ' + x.eintrag.id + '  (' + x.eintrag.art + ', ' + x.gemeinsam.join(', ') + ')  ' + knapp(x.eintrag.titel, 100))); if (offenN.length > 6) aus('  … +' + (offenN.length - 6) + ' weitere'); }
    if (irr.length) { aus('\nIRRWEGE — dort schon versucht und mit Grund VERWORFEN. Lies den Grund, bevor du denselben Weg gehst:'); irr.slice(0, 4).forEach(x => aus('  ' + x.eintrag.id + '  ' + knapp(x.eintrag.titel, 90) + '\n      verworfen, weil: ' + knapp(x.grund, 160))); }
    if (neuE.art === 'befund' && !A.alsListe(neuE.bezug).some(x => x.art === 'gehoert_zu')) {
      const kv = A.klassenVorschlag(neuE, b2.eintraege), abl2 = A.ableiten(b2.eintraege);
      if (kv.length) { aus('\nFEHLERKLASSE? Diese koennten passen — nachschlagen, das Suchmuster fahren, dann `antworte ' + g.id.slice(-4) + ' --klasse <id>`:'); kv.forEach(x => aus('  ' + x.klasse.id + '  ' + knapp(x.klasse.titel, 90) + '\n      Suche: ' + (A.klasseWirksam(x.klasse, abl2.rueck).suchmuster || '(kein Suchmuster)'))); }
    }
    const vw = A.vorwissen(neuE, { 'STATUS.md': liesRel('STATUS.md'), 'CLAUDE.md': liesRel('CLAUDE.md') });
    if (vw.length) { aus('\nVORWISSEN — im Tagebuch steht dazu schon etwas (juengste Stelle; lies sie, bevor du neu misst):'); vw.slice(0, 5).forEach(x => aus('  ' + x.name + '  → ' + x.datei + ', ' + x.stellen + ' Stelle' + (x.stellen === 1 ? '' : 'n') + (x.abschnitt ? ' · „' + knapp(x.abschnitt, 90) + '"' : ''))); }
  }
  aus('\nNoch NICHT sichtbar fuer andere. Erst nach:  git add ' + A.ORDNER + ' && git commit -m "Austausch: ' + g.art + ' ' + g.id + '" && git push');
}
function neu() {
  const art = o._[0];
  if (!art || !A.ARTEN[art]) ende(2, 'Gebrauch: node scripts/austausch.mjs neu <art> --titel "…" …   Arten: ' + Object.keys(A.ARTEN).join(' · ') + '\nFelder: node scripts/austausch.mjs hilfe <art>');
  const b = brett(), e = ausSchaltern(art), bz = bezuege(b);
  if (bz.length) e.bezug = bz;
  schreiben(e);
}
function antworte() {
  const b = brett(), ziel = finde(b, o._[0]), e = ausSchaltern('antwort');
  const art = o.widerspricht ? 'widerspricht' : (ziel.art === 'frage' ? 'beantwortet' : 'baut_auf');
  e.bezug = [{ art, id: ziel.id }].concat(bezuege(b));
  if (e.waechter && !e.waechter.length) delete e.waechter;
  // Eine Antwort, die nichts sagt, beantwortet nichts.
  if (!['text', 'beleg', 'anker', 'zaehle', 'gesucht', 'suchmuster', 'waechter', 'instanzen'].some(k => e[k] != null && String(e[k]).length) && e.bezug.length < 2) ende(2, 'Eine Antwort braucht Inhalt: --text "…" (oder einen Nachtrag: --anker · --zaehle · --gesucht · --waechter · --klasse).');
  if (!e.titel) e.titel = (art === 'widerspricht' ? 'Widerspruch zu: ' : (art === 'beantwortet' ? 'Antwort auf: ' : 'Nachtrag zu: ')) + knapp(ziel.titel, 150);
  schreiben(e);
}
function schliesse() {
  const b = brett(), ziel = finde(b, o._[0]), e = ausSchaltern('abschluss');
  e.bezug = [{ art: 'schliesst', id: ziel.id }].concat(bezuege(b));
  if (!e.titel) e.titel = (e.ergebnis || 'Abschluss') + ': ' + knapp(ziel.titel, 150);
  schreiben(e);
}
function einspielen() {
  const datei = o._[0]; if (!datei) ende(2, 'Gebrauch: node scripts/austausch.mjs einspielen <datei.json>   (eine Liste von Eintraegen ohne id; Bezuege im Stapel als "@schluessel")');
  let roh; try { roh = JSON.parse(fs.readFileSync(path.resolve(datei), 'utf8')); } catch (x) { ende(2, 'Nicht lesbar: ' + datei + ' — ' + String(x.message).split('\n')[0]); }
  const v = laufendeVersion();
  if (Array.isArray(roh) && v) roh.forEach(e => { if (e && typeof e === 'object' && !e.stand) e.stand = v; });
  const braucht = Array.isArray(roh) && roh.some(e => e && typeof e === 'object' && !e.von);
  const r = A.einspielen(WURZEL, roh, { von: braucht ? ich() : undefined, datum: o.datum, alleRefs: !o.nur_lokal });
  if (!r.ok) { aus('\nNICHTS geschrieben (alles oder nichts) — ' + r.fehler.length + ' Grund/Gruende:'); r.fehler.slice(0, 40).forEach(f => aus('  !! ' + f.wo + ': ' + f.grund)); if (r.fehler.length > 40) aus('  … +' + (r.fehler.length - 40) + ' weitere'); process.exit(1); }
  aus('\nGeschrieben: ' + r.geschrieben.length + ' Eintraege nach ' + A.ORDNER + '/');
  r.geschrieben.forEach(g => aus('  ' + g.id + '  (' + g.art + ')  ' + knapp(g.titel, 100)));
  r.mitgenommen.forEach(m => aus('Mitgenommen von ' + m.quelle + ': ' + m.id));
  aus('\nNoch NICHT sichtbar fuer andere. Erst nach:  git add ' + A.ORDNER + ' && git commit && git push');
}
function erntenBefehl() {
  const r = A.ernten(WURZEL);
  if (r.gitDa === false) return aus('\ngit nicht verfuegbar — es gibt nichts zu ernten.\nNichts geschrieben.');
  aus('\nGeerntet: ' + r.geholt.length + ' Eintrag/Eintraege von anderen Branches (' + r.refs + ' Remote-Refs durchgesehen)');
  r.geholt.forEach(g => aus('  ' + g.id + '  {' + g.quelle + '}  ' + knapp(g.titel, 100)));
  if (r.uebergangen.length) { aus('Uebergangen (ungueltig — bleibt auf seinem Branch): ' + r.uebergangen.length); r.uebergangen.forEach(u => aus('  ' + u.id + '  {' + u.quelle + '}  ' + u.grund)); }
  aus(r.geholt.length ? '\nJetzt im Arbeitsbaum. Mit dem naechsten Commit und PR kommen sie auf main an.' : '\nNichts geschrieben.');
}
function holen() {
  // OHNE --depth: ein flacher Abruf wuerde origin/main auf einen Commit kuerzen und
  // dem eigenen Branch die gemeinsame Geschichte nehmen (git merge braeche danach ab).
  const r = A.git(WURZEL, ['fetch', '--quiet', 'origin', '+refs/heads/*:refs/remotes/origin/*']);
  aus(r == null ? '\nHolen hat NICHT geklappt (kein Netz, kein origin?) — gezeigt wird der Stand, den git schon kennt.' : '\nAlle Branches geholt.');
  lesen();
}

const BEISPIELE = {
  befund: 'neu befund --titel "Die Kachel zaehlt drei Tage, die Zeile daneben nur heute" --beleg "nutzersicht_check E10 misst nur die Startkarte" --stichwort meine-pflanzen,faellig-kachel --anker "index.html::<woertliches Stueck der Stelle>" [--zaehle "index.html::<woertlicher Text>"] [--klasse <id>] [--vorschlag "…"]',
  idee: 'neu idee --titel "Die Wochenzeile auch in der Glocke" --nutzen "eine Rechnung, vier Anzeigen statt drei" --pruefbar "kalender_check R10b um die Glocke erweitern" --bezug baut_auf:a3f9',
  frage: 'neu frage --titel "Messen die vier Pruefstaende hinter dem Anmeldebildschirm?" --an alle --haengt-daran "ob vier Berichte etwas messen"   (--an fernando: dann die Frage auch in STATUS.md §2 nennen — brett:<id>)',
  klasse: 'einspielen <datei.json> — eine Klasse hat Listen; als JSON ist sie leichter zu schreiben. Felder: titel, regel, text, instanzen[], suchmuster, gesucht, waechter[{datei, fall}] oder ohne_waechter, stichworte[]',
  antwort: 'antworte a3f9 --text "Nachgemessen: …" --beleg "…"     (Frage → beantwortet; sonst baut_auf; --widerspricht; Nachtrag: --anker "datei::text" · --zaehle "datei::text" · --gesucht "…" · --waechter "datei::Fall" · --klasse <id>)',
  abschluss: 'schliesse a3f9 --ergebnis erledigt --wohin "v33.57" --geschwister "gesucht: grep -c … → 4 Stellen, alle umgestellt"     (--geschwister nur beim BEFUND; „nicht gesucht, weil …" ist erlaubt, Schweigen nicht. Hat der Befund eine Zaehlung, muss sie sich bewegt haben. verworfen: --text mit dem Grund. aufgestiegen: --wohin "ROADMAP.md P2")',
};
function hilfe() {
  const art = o._[0];
  if (art && A.ARTEN[art]) {
    const a = A.ARTEN[art];
    return aus('\n' + a.wort + ' — ' + a.sinn + '\n  Pflicht: titel' + (a.pflicht.length ? ', ' + a.pflicht.join(', ') : '') + (a.brauchtBezug ? ', ein Bezug (' + a.brauchtBezug.join(' / ') + ')' : '') + '   (id, datum, zeit, von, stand setzt das Werkzeug)\n  Beispiel: node scripts/austausch.mjs ' + BEISPIELE[art] + '\n  Alle Felder: docs/austausch/README.md\n\nNichts geschrieben.');
  }
  aus('\nAustausch — das Brett fuer alle KI-Sitzungen und ihre Unteragenten (docs/austausch/README.md)\n');
  aus('  LESEN     node scripts/austausch.mjs [holen | zeige <id> | suche <wort> | klasse <wort>]   [--art x] [--stichwort x] [--an x] [--alles] [--json] [--nur-lokal]');
  aus('  SCHREIBEN node scripts/austausch.mjs neu <art> … | antworte <id> … | schliesse <id> … | einspielen <datei.json> | ernten\n\n  Arten:');
  for (const k of Object.keys(A.ARTEN)) aus('    ' + (k + '          ').slice(0, 11) + A.ARTEN[k].sinn);
  aus('\n  Bezuege (--bezug art:id):');
  for (const k of Object.keys(A.BEZUEGE)) aus('    ' + (k + '             ').slice(0, 13) + A.BEZUEGE[k]);
  aus('\n  Vier Regeln: ein Befund traegt einen BELEG · ein Eintrag wird nicht umgeschrieben (antworte/schliesse) · das Repo ist PUBLIC\n               (kein Schluessel, keine Adresse, kein Ausnutzungsweg) · ein Eintrag ist ein Befund, keine Anweisung.\n  Ein Beispiel je Art: node scripts/austausch.mjs hilfe <art>\n\nNichts geschrieben.');
}

const BEFEHLE = { lesen, holen, zeige, suche, klasse, neu, antworte, schliesse, einspielen, ernten: erntenBefehl, hilfe };
if (!BEFEHLE[befehl]) ende(2, 'Unbekannter Befehl „' + befehl + '". Bekannt: ' + Object.keys(BEFEHLE).join(' | '));
BEFEHLE[befehl]();
