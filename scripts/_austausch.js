// _austausch.js — das Brett: lesen, pruefen, ableiten. EIN Modul fuer das
// Werkzeug (scripts/austausch.js) und den Pruefstand (scripts/austausch_check.js).
//
// Warum ein Modul: Reparatur und Pruefung brauchen DIESELBE Regel (CLAUDE.md
// §7.1, v32.16). `neu` lehnt mit genau der Pruefung ab, die der Pruefstand
// spaeter faehrt — sonst nimmt das Werkzeug an, was die Suite verwirft.
//
// Die Bauform des Bretts, gemessen am 10.11.2026 (docs/austausch/README.md):
//   - EINE DATEI JE EINTRAG unter docs/austausch/eintraege/. Zwei Sitzungen,
//     die gleichzeitig schreiben, legen zwei Dateien an — nie ein Konflikt.
//     (STATUS.md haengt jeder oben an Zeile 13 an; das ging nur gut, weil
//     318 von 319 PRs aus EINER Sitzungslinie kamen.)
//   - EIN EINTRAG WIRD NICHT UMGESCHRIEBEN. Antwort, Abschluss und Korrektur
//     sind neue Eintraege mit einem Bezug. Der Zustand (offen · beantwortet ·
//     geschlossen · ersetzt) wird aus den Bezuegen GERECHNET, nie daneben
//     gefuehrt — eine Zahl, die kein Befehl erzeugt, driftet.
//   - DAS BRETT IST DIE VEREINIGUNG UEBER ALLE BRANCHES. 125 nie gemergte
//     Branches trugen Befunde, die keine andere Sitzung je sah; eine Datei im
//     Arbeitsbranch ist kein Kanal. Gelesen wird der Arbeitsbaum PLUS jeder
//     Remote-Ref, den git kennt.
//
// Namen in dieser Datei tragen bewusst KEIN App-Praefix: robust_check zaehlt
// jeden Bezeichner in scripts/*.js als Nennung, und „Memory" verlangt fuer
// jeden Namen mit App-Praefix in docs/memory eine Definition in index.html.
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto');

const ORDNER = 'docs/austausch/eintraege';

// ── Das Vokabular. Die Liste ist die Pruefung: eine Art, die hier nicht steht,
//    gibt es nicht; ein Pflichtfeld, das hier steht, wird verlangt.
const ARTEN = {
  befund:    { wort: 'Befund',      pflicht: ['beleg'], offenbar: true,
               sinn: 'etwas GEMESSENES: ein Fehler, eine Luecke, ein Widerspruch — mit Beleg' },
  idee:      { wort: 'Idee',        pflicht: ['nutzen', 'pruefbar'], offenbar: true,
               sinn: 'ein Vorschlag, der noch keinen Meilenstein verdient — mit Nutzen und der Angabe, woran man ihn pruefen koennte' },
  frage:     { wort: 'Frage',       pflicht: ['an'], offenbar: true,
               sinn: 'etwas, das die schreibende Sitzung nicht messen oder entscheiden konnte' },
  anspruch:  { wort: 'In Arbeit',   pflicht: ['bereich'], offenbar: true,
               sinn: '„ich bin dran" — VOR dem ersten Code-Commit gepusht, damit eine parallele Sitzung es sieht' },
  klasse:    { wort: 'Fehlerklasse', pflicht: ['regel', 'instanzen'], offenbar: true,
               sinn: 'ein Fehler-MUSTER mit Regel, Instanzen, Suchmuster fuer Geschwister und dem Pruefstand-Fall, der es bewacht' },
  uebergabe: { wort: 'Uebergabe',   pflicht: ['version'], offenbar: false,
               sinn: 'was eine Auslieferung OFFEN laesst: naechster Schritt, nicht Geprueftes, Nebenfunde' },
  antwort:   { wort: 'Antwort',     pflicht: [], offenbar: false, brauchtBezug: ['beantwortet', 'baut_auf', 'widerspricht'],
               sinn: 'eine Antwort, eine Ergaenzung oder ein Widerspruch zu einem anderen Eintrag' },
  abschluss: { wort: 'Abschluss',   pflicht: ['ergebnis'], offenbar: false, brauchtBezug: ['schliesst', 'ersetzt'],
               sinn: 'schliesst einen Eintrag: erledigt (mit Version/Commit), verworfen (mit Grund) oder aufgestiegen (wohin)' },
};
const BEZUEGE = {
  baut_auf:     'nimmt den anderen Eintrag als Grundlage (so entsteht aus zwei Koepfen eine Idee)',
  widerspricht: 'haelt den anderen Eintrag fuer falsch oder unvollstaendig — mit Beleg',
  beantwortet:  'beantwortet eine Frage',
  schliesst:    'der andere Eintrag ist erledigt, verworfen oder aufgestiegen',
  ersetzt:      'der andere Eintrag ist ueberholt; dieser gilt an seiner Stelle',
  gehoert_zu:   'ist eine Instanz dieser Fehlerklasse',
};
const ERGEBNISSE = ['erledigt', 'verworfen', 'aufgestiegen'];
const AUFWAND = ['klein', 'mittel', 'gross'];
const LISTENFELDER = ['beleg', 'stichworte', 'instanzen', 'offen', 'naechster_schritt', 'nicht_geprueft'];
const TEXTFELDER = ['titel', 'text', 'von', 'stand', 'nutzen', 'pruefbar', 'falle', 'aufwand', 'an', 'haengt_daran', 'vorschlag',
  'bereich', 'branch', 'regel', 'suchmuster', 'gesucht', 'ohne_waechter', 'version', 'gebaut', 'nichts_offen', 'ergebnis', 'wohin', 'details_bei', 'bewacht', 'geschwister', 'ohne_klasse'];
const BEKANNT = new Set(['id', 'art', 'datum', 'bezug', 'waechter', 'anker', 'zaehle', 'sicherheit', 'schluessel'].concat(LISTENFELDER, TEXTFELDER));
const ANKER_MIN = 8, ANKER_MAX = 300;
const TITEL_MAX = 200;
const ID_FORM = /^\d{4}-\d{2}-\d{2}-[0-9a-f]{4}$/;
// Namen, die wie App-Code aussehen — dieselbe Form, die robust_check „Memory" prueft.
const APP_NAME = /^(_?gs[A-Z]|dq[A-Z]|sb[A-Z]|GS_[A-Z]|_gs[a-z])[\w]*$/;

// ── Was in einem PUBLIC Repo nicht stehen darf. Bewusst FORMEN bekannter
//    Geheimnisse, keine Verbotsliste von Woertern (v33.54: eine Verbotsliste
//    auf Rohtext haelt nicht). Commit-Hashes (7–40 hex) sind erlaubt.
const GEHEIM = [
  [/sk-ant-[A-Za-z0-9_-]{8,}/, 'ein Anthropic-Schluessel'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/, 'ein JWT'],
  [/\b(?:sk|rk)_live_[A-Za-z0-9]{8,}/, 'ein Stripe-Schluessel'],
  [/\bwhsec_[A-Za-z0-9]{8,}/, 'ein Webhook-Geheimnis'],
  [/\bsb_secret_[A-Za-z0-9_-]{8,}/, 'ein Supabase-Geheimnis'],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/, 'ein GitHub-Token'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'ein privater Schluessel'],
  [/[A-Za-z0-9._%+-]+@(?!users\.noreply\.github\.com|example\.(?:com|org)|anthropic\.com|greenscan\.ch)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/, 'eine E-Mail-Adresse'],
];

function slug(s) {
  return String(s || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '') || 'eintrag';
}
function alsListe(v) { return v == null ? [] : (Array.isArray(v) ? v : [v]); }
function textVon(e) {
  // Alles, was ein Mensch oder eine KI an diesem Eintrag LIEST — fuer die
  // Geheimnis-Suche und die Volltextsuche.
  const teile = [];
  for (const k of Object.keys(e)) {
    if (k[0] === '_') continue;
    const v = e[k];
    if (typeof v === 'string') teile.push(v);
    else if (Array.isArray(v)) v.forEach(x => teile.push(typeof x === 'string' ? x : JSON.stringify(x)));
  }
  return teile.join('\n');
}
function datumGueltig(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d))) return false;
  const [j, m, t] = String(d).split('-').map(Number);
  const x = new Date(Date.UTC(j, m - 1, t));
  return x.getUTCFullYear() === j && x.getUTCMonth() === m - 1 && x.getUTCDate() === t;
}

// ── EINE Pruefung je Eintrag. Gibt eine Liste von Gruenden zurueck; leer = gut.
//    `dateiname` ist optional (beim Anlegen gibt es ihn noch nicht).
function eintragPruefen(e, dateiname) {
  const f = [];
  if (!e || typeof e !== 'object' || Array.isArray(e)) return ['kein JSON-Objekt'];
  for (const k of Object.keys(e)) if (k[0] !== '_' && !BEKANNT.has(k)) f.push('unbekanntes Feld „' + k + '" (Tippfehler? Die Felder stehen in docs/austausch/README.md)');
  if (!ID_FORM.test(String(e.id || ''))) f.push('id fehlt oder hat nicht die Form JJJJ-MM-TT-xxxx');
  const art = ARTEN[e.art];
  if (!art) f.push('art „' + e.art + '" gibt es nicht (erlaubt: ' + Object.keys(ARTEN).join(' · ') + ')');
  if (!datumGueltig(e.datum)) f.push('datum fehlt oder ist kein gueltiges JJJJ-MM-TT');
  else if (ID_FORM.test(String(e.id || '')) && String(e.id).slice(0, 10) !== e.datum) f.push('id beginnt nicht mit dem datum');
  if (typeof e.von !== 'string' || !e.von.trim()) f.push('von fehlt (wer schreibt: Sitzung/Branch/Rolle — kein Personenname)');
  if (typeof e.titel !== 'string' || !e.titel.trim()) f.push('titel fehlt');
  else if (e.titel.length > TITEL_MAX) f.push('titel hat ' + e.titel.length + ' Zeichen (hoechstens ' + TITEL_MAX + ' — der Rest gehoert in text)');
  for (const k of TEXTFELDER) if (e[k] != null && typeof e[k] !== 'string') f.push(k + ' muss Text sein');
  for (const k of LISTENFELDER) {
    if (e[k] == null) continue;
    if (!Array.isArray(e[k]) || e[k].some(x => typeof x !== 'string' || !x.trim())) f.push(k + ' muss eine Liste nicht-leerer Texte sein');
  }
  if (e.sicherheit != null && typeof e.sicherheit !== 'boolean') f.push('sicherheit muss true oder false sein');
  if (dateiname != null && ID_FORM.test(String(e.id || '')) && art) {
    const soll = e.id + '-' + e.art + '-';
    if (dateiname.indexOf(soll) !== 0 || !/\.json$/.test(dateiname)) f.push('Dateiname muss mit „' + soll + '" beginnen und auf .json enden');
  }
  // Bezuege: Form. Ob das Ziel existiert, sieht erst das ganze Brett.
  if (e.bezug != null) {
    if (!Array.isArray(e.bezug)) f.push('bezug muss eine Liste sein');
    else e.bezug.forEach((b, i) => {
      if (!b || typeof b !== 'object' || !ID_FORM.test(String(b.id || ''))) f.push('bezug[' + i + ']: id fehlt oder hat die falsche Form');
      else if (b.id === e.id) f.push('bezug[' + i + ']: ein Eintrag bezieht sich nicht auf sich selbst');
      if (!b || !BEZUEGE[b.art]) f.push('bezug[' + i + ']: art „' + (b && b.art) + '" gibt es nicht (erlaubt: ' + Object.keys(BEZUEGE).join(' · ') + ')');
    });
  }
  if (!art) return f;
  // Pflichtfelder der Art.
  for (const k of art.pflicht) {
    const v = e[k];
    const leer = v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);
    if (leer) f.push(art.wort + ' ohne „' + k + '"');
  }
  if (art.brauchtBezug) {
    const hat = alsListe(e.bezug).some(b => b && art.brauchtBezug.indexOf(b.art) >= 0);
    if (!hat) f.push(art.wort + ' braucht einen Bezug der Art ' + art.brauchtBezug.join(' / '));
  }
  if (e.art === 'idee' && e.aufwand != null && AUFWAND.indexOf(e.aufwand) < 0) f.push('aufwand: ' + AUFWAND.join(' · '));
  if (e.art === 'abschluss') {
    if (e.ergebnis != null && ERGEBNISSE.indexOf(e.ergebnis) < 0) f.push('ergebnis: ' + ERGEBNISSE.join(' · '));
    if (e.ergebnis === 'verworfen' && !(e.text && e.text.trim())) f.push('verworfen ohne Grund (text)');
    if ((e.ergebnis === 'erledigt' || e.ergebnis === 'aufgestiegen') && !(e.wohin && e.wohin.trim())) f.push(e.ergebnis + ' ohne „wohin" (Version, Commit oder Dokument-Stelle)');
  }
  if (e.art === 'uebergabe') {
    if (e.version != null && !/^v\d+\.\d+$/.test(e.version)) f.push('version hat nicht die Form vNN.NN');
    const sagtEtwas = ['offen', 'naechster_schritt', 'nicht_geprueft'].some(k => alsListe(e[k]).length) || (e.nichts_offen && e.nichts_offen.trim());
    if (!sagtEtwas) f.push('Uebergabe sagt nichts ueber Offenes: offen / naechster_schritt / nicht_geprueft — oder nichts_offen mit Grund');
  }
  // Ein ANKER bindet einen Eintrag an eine Stelle im Repo: {datei, text}, der
  // Text steht WOERTLICH in der Datei. Wer die Stelle aendert, entfernt den
  // Anker — und der Pruefstand wird in SEINEM Lauf rot, mit id und Titel. Das
  // ist der eine Ausloeser, der zum LESEN zwingt (Entwurf „Ausloeser zuerst").
  if (e.anker != null) {
    if (!Array.isArray(e.anker) || !e.anker.length) f.push('anker muss eine nicht-leere Liste von {datei, text} sein');
    else e.anker.forEach((x, i) => {
      if (!x || typeof x.datei !== 'string' || typeof x.text !== 'string' || !x.datei.trim()) { f.push('anker[' + i + ']: {datei, text} verlangt'); return; }
      if (/(^|\/)\.\.(\/|$)/.test(x.datei) || path.isAbsolute(x.datei)) f.push('anker[' + i + ']: datei muss ein Pfad im Repo sein');
      if (x.text.length < ANKER_MIN || x.text.length > ANKER_MAX) f.push('anker[' + i + ']: text braucht ' + ANKER_MIN + ' bis ' + ANKER_MAX + ' Zeichen (ein woertliches Stueck der Stelle, kein ganzer Absatz)');
      if (/\n/.test(x.text)) f.push('anker[' + i + ']: text ist EINE Zeile');
    });
    if (e.art === 'abschluss' || e.art === 'uebergabe' || e.art === 'anspruch') f.push('anker gehoert an einen Befund, eine Idee, eine Frage, eine Fehlerklasse — oder an eine Antwort darauf (neu verankern)');
  }
  // Eine ZAEHLUNG ist die eine Angabe, die das Werkzeug nachrechnen kann:
  // {datei, text, n} — wie oft steht `text` WOERTLICH in `datei`? Bewusst kein
  // Regex und kein Befehl: ein Eintrag ist Text aus fremder Hand, und nichts
  // daraus wird ausgefuehrt. Beim Schreiben wird nachgezaehlt (eine falsche
  // Zahl wird mit der echten abgewiesen); spaeter meldet ein Anstoss, wenn sie
  // sich bewegt hat.
  if (e.zaehle != null) {
    if (!Array.isArray(e.zaehle) || !e.zaehle.length) f.push('zaehle muss eine nicht-leere Liste von {datei, text, n} sein');
    else e.zaehle.forEach((x, i) => {
      if (!x || typeof x.datei !== 'string' || typeof x.text !== 'string' || !x.datei.trim()) { f.push('zaehle[' + i + ']: {datei, text, n} verlangt'); return; }
      if (/(^|\/)\.\.(\/|$)/.test(x.datei) || path.isAbsolute(x.datei)) f.push('zaehle[' + i + ']: datei muss ein Pfad im Repo sein');
      if (x.text.length < 3 || x.text.length > ANKER_MAX || /\n/.test(x.text)) f.push('zaehle[' + i + ']: text ist EINE Zeile mit 3 bis ' + ANKER_MAX + ' Zeichen');
      if (!Number.isInteger(x.n) || x.n < 0) f.push('zaehle[' + i + ']: n ist eine ganze Zahl ab 0');
    });
    if (e.art === 'abschluss' || e.art === 'uebergabe' || e.art === 'anspruch') f.push('zaehle gehoert an einen Befund, eine Idee, eine Frage, eine Fehlerklasse — oder an eine Antwort darauf (neu gezaehlt)');
  }
  // Ein Waechter steht an einer Fehlerklasse — oder an einer ANTWORT darauf
  // (Nachtrag: die Klasse selbst wird nicht umgeschrieben, siehe klasseWirksam).
  if (e.waechter != null) {
    if (e.art !== 'klasse' && e.art !== 'antwort') f.push('waechter gehoert an eine Fehlerklasse oder an eine Antwort auf eine');
    if (!Array.isArray(e.waechter)) f.push('waechter muss eine Liste von {datei, fall} sein');
    else e.waechter.forEach((x, i) => { if (!x || typeof x.datei !== 'string' || typeof x.fall !== 'string' || !x.datei.trim() || !x.fall.trim()) f.push('waechter[' + i + ']: {datei, fall} verlangt'); });
  }
  if (e.art === 'klasse' && Array.isArray(e.waechter || []) && !alsListe(e.waechter).length && !(e.ohne_waechter && e.ohne_waechter.trim())) {
    f.push('Fehlerklasse ohne Waechter braucht „ohne_waechter" mit Grund (kein Pruefstand-Fall bewacht sie — das ist eine Aussage, keine Luecke im Formular)');
  }
  // Ein Sicherheitsbefund steht in einem PUBLIC Repo: nur der Titel, kein Weg.
  if (e.sicherheit === true) {
    if (e.text && e.text.trim()) f.push('sicherheit: true — kein „text" (das Repo ist public; Details gehen an Fernando, nicht aufs Brett)');
    if (!(e.details_bei && e.details_bei.trim())) f.push('sicherheit: true braucht „details_bei" (wo die Einzelheiten liegen)');
  }
  const roh = textVon(e);
  for (const [re, was] of GEHEIM) if (re.test(roh)) f.push('enthaelt etwas, das wie ' + was + ' aussieht — das Repo ist public');
  return f;
}

// ── Lesen. Arbeitsbaum zuerst, dann (auf Wunsch) jeder Remote-Ref.
function git(wurzel, args) {
  try {
    return cp.execFileSync('git', ['-C', wurzel].concat(args), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
  } catch (_) { return null; }
}
function lies(roh, datei, quelle, unlesbar) {
  let e;
  try { e = JSON.parse(roh); } catch (x) { unlesbar.push({ datei, quelle, grund: 'kein gueltiges JSON: ' + String(x.message).split('\n')[0] }); return null; }
  if (!e || typeof e !== 'object' || Array.isArray(e)) { unlesbar.push({ datei, quelle, grund: 'kein JSON-Objekt' }); return null; }
  Object.defineProperty(e, '_datei', { value: datei, enumerable: false });
  Object.defineProperty(e, '_quelle', { value: quelle, enumerable: false });
  Object.defineProperty(e, '_roh', { value: roh, enumerable: false });
  return e;
}
function brettLesen(wurzel, opts) {
  opts = opts || {};
  const aus = { eintraege: [], unlesbar: [], doppelt: [], abweichend: [], quellen: ['Arbeitsbaum'], gitDa: null, refs: 0 };
  const proId = new Map();
  const nimm = (e) => {
    if (!e) return;
    const vor = proId.get(e.id);
    if (!vor) { proId.set(e.id, e); aus.eintraege.push(e); return; }
    // Dieselbe id ein zweites Mal: im SELBEN Baum ist das ein Fehler (zwei
    // Dateien, eine id); ueber Branches hinweg ist es derselbe Eintrag — und
    // weicht er ab, wurde er umgeschrieben, was das Brett nicht vorsieht.
    if (vor._quelle === e._quelle) aus.doppelt.push({ id: e.id, dateien: [vor._datei, e._datei], quelle: e._quelle });
    else if (JSON.stringify(vor) !== JSON.stringify(e)) aus.abweichend.push({ id: e.id, gilt: vor._quelle, weichtAb: e._quelle });
  };
  const dir = path.join(wurzel, ORDNER);
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).sort()) {
      if (!/\.json$/.test(f)) continue;
      nimm(lies(fs.readFileSync(path.join(dir, f), 'utf8'), f, 'Arbeitsbaum', aus.unlesbar));
    }
  }
  if (opts.alleRefs) {
    const refs = git(wurzel, ['for-each-ref', '--format=%(refname:short)', 'refs/remotes']);
    aus.gitDa = refs != null;
    if (refs != null) {
      // main zuerst: weicht ein Branch von main ab, gilt main.
      const liste = refs.split('\n').map(s => s.trim()).filter(s => s && !/\/HEAD$/.test(s))
        .sort((a, b) => (/\/main$/.test(b) ? 1 : 0) - (/\/main$/.test(a) ? 1 : 0) || a.localeCompare(b));
      for (const ref of liste) {
        const ls = git(wurzel, ['ls-tree', '-r', '--name-only', ref, '--', ORDNER + '/']);
        aus.refs++;
        if (!ls) continue;
        const dateien = ls.split('\n').filter(p => /\.json$/.test(p));
        if (!dateien.length) continue;
        let neu = 0;
        for (const p of dateien) {
          const name = path.posix.basename(p), id = name.slice(0, 15);
          const vor = proId.get(id);
          // Schon aus dem Arbeitsbaum oder main bekannt UND gleicher Dateiname:
          // der Inhalt wird nur geholt, wenn er abweichen KOENNTE (eigener Baum
          // gewinnt ohnehin) — bei 125 Branches spart das fast jeden Aufruf.
          if (vor && vor._datei === name && !opts.gruendlich) continue;
          const roh = git(wurzel, ['show', ref + ':' + p]);
          if (roh == null) continue;
          const vorher = aus.eintraege.length;
          nimm(lies(roh, name, ref, aus.unlesbar));
          if (aus.eintraege.length > vorher) neu++;
        }
        if (neu) aus.quellen.push(ref + ' (+' + neu + ')');
      }
    }
  }
  aus.eintraege.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return aus;
}

// ── Der Zustand wird GERECHNET. Kein Feld „status" — das waere eine zweite Kopie.
function ableiten(eintraege) {
  const proId = new Map(eintraege.map(e => [e.id, e]));
  const rueck = new Map();   // id → [{von: Eintrag, art}]
  for (const e of eintraege) for (const b of alsListe(e.bezug)) {
    if (!b || !b.id) continue;
    if (!rueck.has(b.id)) rueck.set(b.id, []);
    rueck.get(b.id).push({ von: e, art: b.art });
  }
  const zustand = new Map();
  for (const e of eintraege) {
    const r = rueck.get(e.id) || [];
    const zu = r.find(x => x.art === 'schliesst'), ers = r.find(x => x.art === 'ersetzt');
    let z = 'offen', durch = null;
    if (zu) { z = 'geschlossen'; durch = zu.von; }
    else if (ers) { z = 'ersetzt'; durch = ers.von; }
    else if (e.art === 'frage' && r.some(x => x.art === 'beantwortet')) { z = 'beantwortet'; durch = r.find(x => x.art === 'beantwortet').von; }
    else if (!ARTEN[e.art] || !ARTEN[e.art].offenbar) z = 'notiz';   // Antwort, Abschluss, Uebergabe: kein offener Punkt
    zustand.set(e.id, { z, durch });
  }
  return { proId, rueck, zustand };
}

// ── Was ein Bezug darf — EINE Regel fuer den Pruefstand und fuer das Schreiben.
function bezugsRegeln(e, proId) {
  const f = [];
  for (const b of alsListe(e.bezug)) {
    const ziel = b && proId.get(b.id);
    if (!ziel) continue;
    if (b.art === 'beantwortet' && ziel.art !== 'frage') f.push('„beantwortet" zeigt auf ' + b.id + ', das keine Frage ist (' + ziel.art + ')');
    if (b.art === 'gehoert_zu' && ziel.art !== 'klasse') f.push('„gehoert_zu" zeigt auf ' + b.id + ', das keine Fehlerklasse ist (' + ziel.art + ')');
    if ((b.art === 'schliesst' || b.art === 'ersetzt') && (ziel.art === 'abschluss' || ziel.art === 'antwort')) f.push('„' + b.art + '" zeigt auf ' + b.id + ' (' + ziel.art + ') — geschlossen wird der urspruengliche Eintrag, nicht die Antwort darauf');
    // Schliessen ist streng: ein BEHOBENER Befund nennt, welcher Pruefstand-Fall
    // ihn kuenftig bewacht, und ob nach Geschwistern gesucht wurde. „Eine
    // Fehlerklasse ist erst geschlossen, wenn man sie GESUCHT hat" (v32.87) —
    // hier bekommt der Satz seinen Ausloeser. Ein ausgesprochenes „keiner, weil …"
    // bzw. „nicht gesucht, weil …" ist erlaubt; Schweigen nicht.
    if (b.art === 'schliesst' && ziel.art === 'befund' && e.art === 'abschluss' && e.ergebnis === 'erledigt') {
      if (!(e.bewacht && e.bewacht.trim())) f.push('ein behobener Befund (' + b.id + ') braucht „bewacht": welcher Pruefstand-Fall haelt ihn kuenftig — oder „keiner, weil …"');
      if (!(e.geschwister && e.geschwister.trim())) f.push('ein behobener Befund (' + b.id + ') braucht „geschwister": „gesucht: <wie> → N Treffer" — oder „nicht gesucht, weil …"');
    }
  }
  return f;
}

// ── Das ganze Brett pruefen (Bezuege, Dubletten). Einzelpruefung je Eintrag
//    kommt aus eintragPruefen.
function brettPruefen(brett) {
  const f = [];
  for (const u of brett.unlesbar) f.push({ wo: u.datei, grund: u.grund });
  for (const d of brett.doppelt) f.push({ wo: d.dateien.join(' + '), grund: 'dieselbe id ' + d.id + ' in zwei Dateien' });
  const ids = new Set(brett.eintraege.map(e => e.id));
  for (const e of brett.eintraege) {
    for (const g of eintragPruefen(e, e._datei)) f.push({ wo: e._datei || e.id, grund: g });
    for (const b of alsListe(e.bezug)) {
      if (b && ID_FORM.test(String(b.id || '')) && !ids.has(b.id)) f.push({ wo: e._datei || e.id, grund: 'Bezug auf ' + b.id + ' — den Eintrag gibt es nicht' });
    }
  }
  const proId = new Map(brett.eintraege.map(e => [e.id, e]));
  for (const e of brett.eintraege) for (const g of bezugsRegeln(e, proId)) f.push({ wo: e._datei || e.id, grund: g });
  return f;
}

// ── Eine Fehlerklasse, wie sie HEUTE gilt: der Eintrag plus seine Nachtraege.
//    Wer eine Klasse gesucht, einen Waechter gebaut oder eine Instanz gefunden
//    hat, schreibt eine ANTWORT auf die Klasse mit `gesucht`, `waechter`,
//    `suchmuster` oder `instanzen` — die Klasse selbst bleibt, wie sie ist.
//    (Eine veraenderliche Karte waere die eine Datei, an der zwei Sitzungen
//    kollidieren koennen.)
function klasseWirksam(e, rueck) {
  const k = { regel: e.regel, suchmuster: e.suchmuster || '', ohne_waechter: e.ohne_waechter || '', gesucht: e.gesucht ? [e.gesucht] : [],
    waechter: alsListe(e.waechter).slice(), instanzen: alsListe(e.instanzen).slice(), befunde: [] };
  const nach = ((rueck && rueck.get(e.id)) || []).slice().sort((a, b) => String(a.von.id).localeCompare(String(b.von.id)));
  for (const r of nach) {
    const x = r.von;
    if (r.art === 'gehoert_zu') { k.befunde.push(x); continue; }
    if (x.art !== 'antwort') continue;
    if (x.suchmuster && x.suchmuster.trim()) k.suchmuster = x.suchmuster;
    if (x.gesucht && x.gesucht.trim()) k.gesucht.push(x.gesucht);
    for (const w of alsListe(x.waechter)) if (w && !k.waechter.some(v => v.datei === w.datei && v.fall === w.fall)) k.waechter.push(w);
    for (const i of alsListe(x.instanzen)) if (k.instanzen.indexOf(i) < 0) k.instanzen.push(i);
  }
  return k;
}

// ── Die Anker, wie sie HEUTE gelten: die juengste Antwort, die welche traegt,
//    ersetzt die des Eintrags (neu verankern, ohne den Eintrag umzuschreiben).
function ankerWirksam(e, rueck) {
  let a = alsListe(e.anker);
  const nach = ((rueck && rueck.get(e.id)) || []).filter(r => r.von.art === 'antwort' && alsListe(r.von.anker).length)
    .sort((x, y) => String(x.von.id).localeCompare(String(y.von.id)));
  if (nach.length) a = alsListe(nach[nach.length - 1].von.anker);
  return a;
}
// Welche Anker offener Eintraege stehen nicht mehr an ihrer Stelle?
// `liesDatei(rel)` gibt den Text zurueck oder null (Datei fehlt).
function ankerPruefen(eintraege, liesDatei) {
  const { rueck, zustand } = ableiten(eintraege);
  const aus = { geprueft: 0, eintraege: 0, verloren: [] };
  const cache = new Map();
  for (const e of eintraege) {
    if (zustand.get(e.id).z !== 'offen') continue;
    const anker = ankerWirksam(e, rueck);
    if (!anker.length) continue;
    aus.eintraege++;
    for (const x of anker) {
      aus.geprueft++;
      if (!cache.has(x.datei)) cache.set(x.datei, liesDatei(x.datei));
      const t = cache.get(x.datei);
      if (t == null) aus.verloren.push({ id: e.id, titel: e.titel, datei: x.datei, text: x.text, grund: 'Datei fehlt' });
      else if (t.indexOf(x.text) < 0) aus.verloren.push({ id: e.id, titel: e.titel, datei: x.datei, text: x.text, grund: 'Text steht nicht mehr in der Datei' });
    }
  }
  return aus;
}

// ── Zaehlungen. `wieOft` zaehlt woertliche, nicht ueberlappende Vorkommen.
function wieOft(text, stueck) {
  if (text == null || !stueck) return null;
  let n = 0, i = 0;
  while ((i = text.indexOf(stueck, i)) >= 0) { n++; i += stueck.length; }
  return n;
}
function zaehleWirksam(e, rueck) {
  let z = alsListe(e.zaehle);
  const nach = ((rueck && rueck.get(e.id)) || []).filter(r => r.von.art === 'antwort' && alsListe(r.von.zaehle).length)
    .sort((x, y) => String(x.von.id).localeCompare(String(y.von.id)));
  if (nach.length) z = alsListe(nach[nach.length - 1].von.zaehle);
  return z;
}
// Fuer jeden OFFENEN Eintrag: was sagt die Zaehlung, was steht heute da?
function zahlenStand(eintraege, liesDatei) {
  const { rueck, zustand } = ableiten(eintraege);
  const aus = [], cache = new Map();
  for (const e of eintraege) {
    if (zustand.get(e.id).z !== 'offen') continue;
    for (const x of zaehleWirksam(e, rueck)) {
      if (!cache.has(x.datei)) cache.set(x.datei, liesDatei(x.datei));
      aus.push({ id: e.id, titel: e.titel, datei: x.datei, text: x.text, n: x.n, heute: wieOft(cache.get(x.datei), x.text) });
    }
  }
  return aus;
}

// ── Lesen ist ins Schreiben eingebaut: wer einen Eintrag anlegt, bekommt die
//    offenen Eintraege ANDERER Schreiber mit denselben Stichworten gezeigt —
//    ohne eigene Lesepflicht. (Gemessen: „beim Start lesen" war eine Bitte,
//    und 0 von 312 STATUS-Eintraegen nennen eine andere Sitzung.)
function nachbarn(e, eintraege) {
  const { zustand } = ableiten(eintraege);
  const meine = new Set(alsListe(e.stichworte).map(x => String(x).trim().toLowerCase()).filter(Boolean));
  if (!meine.size) return [];
  const aus = [];
  for (const x of eintraege) {
    if (x.id === e.id || x.art === 'klasse' || x.art === 'antwort' || x.art === 'abschluss' || x.art === 'uebergabe') continue;
    const z = zustand.get(x.id);
    // Ein IRRWEG ist ein Eintrag, den jemand mit Grund verworfen hat — „schon
    // versucht, darum nicht". Er wird auch dem eigenen Schreiber gezeigt.
    const irrweg = z.z === 'geschlossen' && z.durch && z.durch.ergebnis === 'verworfen';
    if (!irrweg && (z.z !== 'offen' || x.von === e.von)) continue;
    const gemeinsam = alsListe(x.stichworte).map(s => String(s).trim()).filter(s => meine.has(s.toLowerCase()));
    if (gemeinsam.length) aus.push({ eintrag: x, gemeinsam, irrweg, grund: irrweg ? (z.durch.text || '') : '' });
  }
  return aus.sort((a, b) => b.gemeinsam.length - a.gemeinsam.length || b.eintrag.id.localeCompare(a.eintrag.id));
}
// Welche Fehlerklasse koennte es sein? Wortueberdeckung zwischen dem Eintrag
// und der Klasse — ein VORSCHLAG zum Nachschlagen, kein Urteil.
const FUELLWORT = new Set('nicht einer eine einem einen eines keine keinen wird werden wurde dass dies diese dieser dieses oder aber auch nach noch nur sich sind ueber unter durch ohne beim wenn dann statt jede jeder jedes alle allem zwei drei mehr weil immer schon gegen ihre ihren seine seinen kann muss soll sein haben hatte waren wieder dabei damit sonst gibt geht kommt steht zeigt selbst genau gleich neue neuen neuer erst etwas beide beiden'.split(' '));
function worte(t) {
  return new Set(String(t || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .split(/[^a-z0-9_]+/).filter(w => w.length >= 5 && !FUELLWORT.has(w)));
}
function klassenVorschlag(e, eintraege) {
  const { zustand } = ableiten(eintraege);
  const w = worte([e.titel, e.text, alsListe(e.stichworte).join(' '), e.vorschlag].join(' '));
  const aus = [];
  for (const k of eintraege) {
    if (k.art !== 'klasse' || zustand.get(k.id).z !== 'offen') continue;
    const kw = worte([k.titel, k.regel, alsListe(k.stichworte).join(' ')].join(' '));
    const gemeinsam = [...w].filter(x => kw.has(x));
    if (gemeinsam.length >= 2) aus.push({ klasse: k, gemeinsam });
  }
  return aus.sort((a, b) => b.gemeinsam.length - a.gemeinsam.length).slice(0, 3);
}

// ── Ernten: was nur auf einem anderen Branch liegt, in den Arbeitsbaum holen,
//    damit es mit dem naechsten PR auf main ankommt. Ein Eintrag wird nie
//    umgeschrieben — die Kopie ist deshalb gefahrlos. Ungueltiges bleibt, wo es ist.
function ernten(wurzel) {
  const brett = brettLesen(wurzel, { alleRefs: true });
  const dir = path.join(wurzel, ORDNER);
  const geholt = [], uebergangen = [];
  const zustandAlle = ableiten(brett.eintraege).zustand;
  for (const e of brett.eintraege) {
    if (e._quelle === 'Arbeitsbaum') continue;
    // Ein offener Anspruch gehoert auf den Branch seiner Sitzung, nie nach main:
    // gemergt stuende er dort fuer immer als „in Arbeit".
    if (e.art === 'anspruch' && zustandAlle.get(e.id).z === 'offen') { uebergangen.push({ id: e.id, quelle: e._quelle, grund: 'offener Anspruch — bleibt auf seinem Branch' }); continue; }
    const g = eintragPruefen(e, e._datei);
    if (g.length) { uebergangen.push({ id: e.id, quelle: e._quelle, grund: g[0] }); continue; }
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, e._datei), e._roh);
    geholt.push({ id: e.id, quelle: e._quelle, datei: ORDNER + '/' + e._datei, titel: e.titel });
  }
  return { geholt, uebergangen, gitDa: brett.gitDa, refs: brett.refs };
}

// ── App-Namen aus den Stichworten. Eine IDEE darf etwas nennen, das es noch
//    nicht gibt; alles andere beschreibt den Code, wie er ist.
function appNamen(e) {
  return alsListe(e.stichworte).map(s => String(s).trim()).filter(s => APP_NAME.test(s));
}
function nameImQuelltext(quelltext, name) {
  // Wortgrenze von Hand: `$` und `_` gehoeren zu einem JS-Bezeichner.
  const re = new RegExp('(^|[^\\w$])' + name.replace(/[$]/g, '\\$') + '(?![\\w$])');
  return re.test(quelltext);
}

// ── Anstoesse. Das ist die Stelle, an der aus dem Wissen des einen beim
//    anderen eine Idee werden kann — und der Code RECHNET, wohin zu sehen ist
//    (CLAUDE.md §4b: was der Code ausrechnen kann, entscheidet nie die KI allein).
//    Jeder Anstoss nennt seine Eintraege und EINEN Satz, was zu tun waere.
const ANSTOSS_ARTEN = {
  frage_offen:        'Frage ohne Antwort',
  widerspruch:        'Widerspruch ohne Aufloesung',
  anspruch_kollision: 'Zwei Sitzungen an derselben Stelle',
  beruehrung:         'Zwei Koepfe, dieselbe Stelle',
  zwei_ideen:         'Zwei Ideen auf denselben Fund',
  zahl_bewegt:        'Eine Zahl hat sich bewegt',
  befund_ohne:        'Befund, auf den niemand baut',
  idee_ungeprueft:    'Idee, die noch kein Zweiter angesehen hat',
  klasse_ohne:        'Fehlerklasse ohne Waechter',
  klasse_suchen:      'Fehlerklasse nie gesucht',
  ueberholt:          'Nennt Code, den es nicht mehr gibt',
  ohne_klasse:        'Befund ohne Fehlerklasse',
};
function anstoesse(eintraege, quelltext, liesDatei) {
  const { rueck, zustand } = ableiten(eintraege);
  const offen = eintraege.filter(e => zustand.get(e.id).z === 'offen');
  const aus = [];
  const zeige = (e) => e.id + ' ' + e.titel;
  const verbunden = (a, b) => alsListe(a.bezug).some(x => x && x.id === b.id) || alsListe(b.bezug).some(x => x && x.id === a.id);

  for (const e of offen) {
    const r = rueck.get(e.id) || [];
    if (e.art === 'frage') aus.push({ art: 'frage_offen', ids: [e.id], satz: zeige(e) + (e.an ? '  → an: ' + e.an : '') });
    // Ein Widerspruch, auf den der Urheber nie geantwortet hat.
    if (r.some(x => x.art === 'widerspricht')) {
      const w = r.filter(x => x.art === 'widerspricht').map(x => x.von.id);
      aus.push({ art: 'widerspruch', ids: [e.id].concat(w), satz: zeige(e) + '  ← widersprochen von ' + w.join(', ') + ' — nachmessen und abschliessen oder ersetzen' });
    }
    // Ein eigener Nachtrag (Anker gesetzt, neu gezaehlt) ist kein „jemand baut darauf":
    // es zaehlt, was ein ANDERER dazu schreibt, oder alles ausser einer Antwort (Idee, Abschluss, Anspruch).
    if (e.art === 'befund' && !r.some(x => x.von.art !== 'antwort' || x.von.von !== e.von)) aus.push({ art: 'befund_ohne', ids: [e.id], satz: zeige(e) + (e.vorschlag ? '  (Vorschlag steht dabei)' : '') });
    // Die Klassenfrage gehoert zum Fund: Instanz einer Klasse (gehoert_zu) — oder ausgesprochen keine.
    if (e.art === 'befund' && !alsListe(e.bezug).some(b => b && b.art === 'gehoert_zu') && !(e.ohne_klasse && e.ohne_klasse.trim()) &&
        !r.some(x => x.von.art === 'antwort' && (alsListe(x.von.bezug).some(b => b && b.art === 'gehoert_zu') || (x.von.ohne_klasse && x.von.ohne_klasse.trim())))) {
      aus.push({ art: 'ohne_klasse', ids: [e.id], satz: zeige(e) + '  → `klasse <wort>` nachschlagen; dann `antworte ' + e.id.slice(-4) + ' --klasse <id>` oder `--ohne-klasse "Einzelfall, weil …"`' });
    }
    if (e.art === 'idee' && !r.some(x => x.von.von !== e.von)) aus.push({ art: 'idee_ungeprueft', ids: [e.id], satz: zeige(e) + '  → pruefbar: ' + (e.pruefbar || '?') });
    if (e.art === 'klasse') {
      const k = klasseWirksam(e, rueck), n = k.instanzen.length + k.befunde.length;
      if (!k.waechter.length) aus.push({ art: 'klasse_ohne', ids: [e.id], satz: zeige(e) + '  (' + n + ' Instanzen) — Kandidat fuer einen Pruefstand-Fall' });
      if (!k.gesucht.length && n >= 2) aus.push({ art: 'klasse_suchen', ids: [e.id], satz: zeige(e) + (k.suchmuster ? '  → Suche: ' + k.suchmuster : '  (noch kein Suchmuster)') });
    }
    if (quelltext && e.art !== 'idee') {
      const weg = appNamen(e).filter(n => !nameImQuelltext(quelltext, n));
      if (weg.length) aus.push({ art: 'ueberholt', ids: [e.id], satz: zeige(e) + '  → nicht mehr im Quelltext: ' + weg.join(', ') });
    }
  }
  // Eine Zaehlung, die heute etwas anderes ergibt als beim Schreiben: behoben? gewachsen?
  if (liesDatei) for (const z of zahlenStand(eintraege, liesDatei)) {
    if (z.heute == null) aus.push({ art: 'zahl_bewegt', ids: [z.id], satz: z.id + ' ' + z.titel + '  → ' + z.datei + ' ist nicht mehr lesbar (gezaehlt waren ' + z.n + ')' });
    else if (z.heute !== z.n) aus.push({ art: 'zahl_bewegt', ids: [z.id], satz: z.id + ' ' + z.titel + '  → „' + z.text.slice(0, 50) + '" in ' + z.datei + ': war ' + z.n + ', heute ' + z.heute + ' — ' + (z.heute === 0 ? 'behoben? Dann schliessen' : (z.heute > z.n ? 'gewachsen: neue Geschwister' : 'geschrumpft: der Rest steht noch')) });
  }
  // Zwei Ideen verschiedener Schreiber bauen auf DENSELBEN Eintrag und kennen einander nicht.
  for (const [ziel, liste] of rueck) {
    const ideen = liste.filter(x => x.art === 'baut_auf' && x.von.art === 'idee' && zustand.get(x.von.id).z === 'offen').map(x => x.von);
    for (let i = 0; i < ideen.length; i++) for (let j = i + 1; j < ideen.length; j++) {
      const a = ideen[i], b = ideen[j];
      if (a.von === b.von || verbunden(a, b)) continue;
      aus.push({ art: 'zwei_ideen', ids: [a.id, b.id, ziel], satz: zeige(a) + '  ×  ' + zeige(b) + ' — beide bauen auf ' + ziel + ': vertragen sie sich, oder ist eine die bessere?' });
    }
  }
  // Zwei offene Ansprueche verschiedener Sitzungen am selben Stichwort: genau der Fall
  // vom 10.09.2026 (derselbe Fehler viermal behoben), diesmal sichtbar, BEVOR beide fertig sind.
  const anspr = offen.filter(e => e.art === 'anspruch');
  for (let i = 0; i < anspr.length; i++) for (let j = i + 1; j < anspr.length; j++) {
    const a = anspr[i], b = anspr[j];
    if (a.von === b.von) continue;
    const sa = new Set(alsListe(a.stichworte).map(x => String(x).trim().toLowerCase()).filter(Boolean));
    const gem = alsListe(b.stichworte).map(x => String(x).trim()).filter(x => sa.has(x.toLowerCase()));
    if (gem.length) aus.push({ art: 'anspruch_kollision', ids: [a.id, b.id], satz: '„' + gem.join(', ') + '": ' + zeige(a) + ' [' + a.von + ']  ×  ' + zeige(b) + ' [' + b.von + '] — absprechen, bevor beide dasselbe bauen' });
  }
  // Beruehrung: zwei offene Eintraege VERSCHIEDENER Schreiber teilen ein
  // Stichwort und kennen einander nicht. Uebergaben zaehlen nicht (sie nennen
  // alles, was eine Scheibe beruehrt hat).
  const proWort = new Map();
  for (const e of offen) {
    if (e.art === 'anspruch') continue;
    for (const s of new Set(alsListe(e.stichworte).map(x => String(x).trim().toLowerCase()).filter(Boolean))) {
      if (!proWort.has(s)) proWort.set(s, []);
      proWort.get(s).push(e);
    }
  }
  const gesehen = new Set();
  for (const [wort, liste] of proWort) {
    for (let i = 0; i < liste.length; i++) for (let j = i + 1; j < liste.length; j++) {
      const a = liste[i], b = liste[j];
      if (a.von === b.von || verbunden(a, b)) continue;
      const k = a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id;
      if (gesehen.has(k)) continue;
      gesehen.add(k);
      aus.push({ art: 'beruehrung', ids: [a.id, b.id], wort, satz: '„' + wort + '": ' + zeige(a) + '  ×  ' + zeige(b) + ' — gemeinsame Ursache? Dann ein Eintrag mit baut_auf auf beide' });
    }
  }
  const rang = Object.keys(ANSTOSS_ARTEN);
  aus.sort((x, y) => rang.indexOf(x.art) - rang.indexOf(y.art) || x.ids[0].localeCompare(y.ids[0]));
  return aus;
}

// ── Schreiben. Alles oder nichts: erst pruefen, dann anlegen.
function neueId(datum, belegt) {
  for (let i = 0; i < 50; i++) {
    const id = datum + '-' + crypto.randomBytes(2).toString('hex');
    if (!belegt.has(id)) return id;
  }
  throw new Error('keine freie id gefunden');
}
function heute() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
// Nimmt rohe Eintraege (ohne id), vergibt ids, loest Stapel-Bezuege („@schluessel")
// auf, prueft ALLES gegen das vorhandene Brett und schreibt erst dann.
function einspielen(wurzel, roh, opts) {
  opts = opts || {};
  const brett = brettLesen(wurzel, { alleRefs: opts.alleRefs !== false });
  const belegt = new Set(brett.eintraege.map(e => e.id));
  const datum = opts.datum || heute();
  const fehler = [], fertig = [], proSchluessel = new Map();
  if (!Array.isArray(roh) || !roh.length) return { ok: false, fehler: [{ wo: 'Eingabe', grund: 'erwartet wird eine nicht-leere Liste von Eintraegen' }], geschrieben: [] };
  roh.forEach((r, i) => {
    const e = Object.assign({}, r);
    if (!e.datum) e.datum = datum;
    if (!e.von && opts.von) e.von = opts.von;
    if (!e.id) { e.id = neueId(datumGueltig(e.datum) ? e.datum : datum, belegt); }
    else if (belegt.has(e.id)) fehler.push({ wo: 'Eintrag ' + (i + 1), grund: 'id ' + e.id + ' ist schon vergeben — ein Eintrag wird nicht umgeschrieben' });
    belegt.add(e.id);
    if (e.schluessel != null) {
      if (proSchluessel.has(e.schluessel)) fehler.push({ wo: 'Eintrag ' + (i + 1), grund: 'schluessel „' + e.schluessel + '" doppelt im Stapel' });
      proSchluessel.set(e.schluessel, e.id);
    }
    fertig.push(e);
  });
  fertig.forEach((e, i) => {
    if (Array.isArray(e.bezug)) e.bezug = e.bezug.map(b => {
      if (b && typeof b.id === 'string' && b.id[0] === '@') {
        const ziel = proSchluessel.get(b.id.slice(1));
        if (!ziel) { fehler.push({ wo: 'Eintrag ' + (i + 1), grund: 'Stapel-Bezug ' + b.id + ' zeigt auf keinen Eintrag dieses Stapels' }); return b; }
        return Object.assign({}, b, { id: ziel });
      }
      return b;
    });
    delete e.schluessel;
  });
  const alle = brett.eintraege.concat(fertig);
  const ids = new Set(alle.map(e => e.id));
  fertig.forEach((e, i) => {
    for (const g of eintragPruefen(e)) fehler.push({ wo: 'Eintrag ' + (i + 1) + ' (' + (e.titel || '?').slice(0, 50) + ')', grund: g });
    for (const b of alsListe(e.bezug)) if (b && ID_FORM.test(String(b.id || '')) && !ids.has(b.id)) fehler.push({ wo: 'Eintrag ' + (i + 1), grund: 'Bezug auf ' + b.id + ' — den Eintrag gibt es nicht (auch auf keinem Branch, den git kennt)' });
  });
  // Eine Zaehlung wird beim Schreiben NACHGERECHNET. Wer eine falsche Zahl
  // eintraegt, bekommt die echte — das Tor gegen „Aussage ohne Messung",
  // die ein Austausch zwischen Agenten sonst nur schneller verbreitet.
  fertig.forEach((e, i) => alsListe(e.zaehle).forEach((z, k) => {
    if (!z || typeof z.datei !== 'string' || typeof z.text !== 'string') return;
    let t = null; try { t = fs.readFileSync(path.join(wurzel, z.datei), 'utf8'); } catch (_) {}
    const ist = wieOft(t, z.text);
    if (ist == null) fehler.push({ wo: 'Eintrag ' + (i + 1), grund: 'zaehle[' + k + ']: ' + z.datei + ' ist nicht lesbar' });
    else if (ist !== z.n) fehler.push({ wo: 'Eintrag ' + (i + 1), grund: 'zaehle[' + k + ']: „' + z.text.slice(0, 60) + '" steht ' + ist + '-mal in ' + z.datei + ', nicht ' + z.n + '-mal' });
  }));
  if (!fehler.length) {
    // Die Bezugs-Regeln des ganzen Bretts (beantwortet → Frage, strenges Schliessen) gelten auch hier.
    const proId = new Map(alle.map(e => [e.id, e]));
    fertig.forEach((e, i) => bezugsRegeln(e, proId).forEach(g => fehler.push({ wo: 'Eintrag ' + (i + 1), grund: g })));
  }
  if (fehler.length) return { ok: false, fehler, geschrieben: [] };
  const dir = path.join(wurzel, ORDNER);
  fs.mkdirSync(dir, { recursive: true });
  // Ein Bezug ueber die Branch-Grenze nimmt sein Ziel MIT: der Pruefstand (und
  // CI) sieht nur den Arbeitsbaum, und ein Bezug auf einen Eintrag, der nur
  // auf einem anderen Branch liegt, waere dort ein Bezug ins Leere. Auch das
  // Ziel des Ziels — bis der Arbeitsbaum unter seinen Bezuegen abgeschlossen ist.
  const mitgenommen = [];
  const proIdAlt = new Map(brett.eintraege.map(e => [e.id, e]));
  const offenIds = fertig.reduce((l, e) => l.concat(alsListe(e.bezug).map(b => b.id)), []);
  const gesehen = new Set();
  while (offenIds.length) {
    const id = offenIds.pop();
    if (gesehen.has(id)) continue;
    gesehen.add(id);
    const ziel = proIdAlt.get(id);
    if (!ziel) continue;
    alsListe(ziel.bezug).forEach(b => { if (b && b.id) offenIds.push(b.id); });
    if (ziel._quelle === 'Arbeitsbaum' || !ziel._roh) continue;
    fs.writeFileSync(path.join(dir, ziel._datei), ziel._roh);
    mitgenommen.push({ id: ziel.id, quelle: ziel._quelle, datei: ORDNER + '/' + ziel._datei, titel: ziel.titel });
  }
  const geschrieben = [];
  for (const e of fertig) {
    const name = e.id + '-' + e.art + '-' + slug(e.titel) + '.json';
    // Feste Feldreihenfolge: das Wichtige oben, damit ein Diff lesbar bleibt.
    const vorn = ['id', 'art', 'datum', 'von', 'stand', 'titel'];
    const geordnet = {};
    for (const k of vorn) if (e[k] != null) geordnet[k] = e[k];
    for (const k of Object.keys(e)) if (!(k in geordnet) && e[k] != null) geordnet[k] = e[k];
    fs.writeFileSync(path.join(dir, name), JSON.stringify(geordnet, null, 2) + '\n');
    geschrieben.push({ id: e.id, datei: ORDNER + '/' + name, art: e.art, titel: e.titel });
  }
  return { ok: true, fehler: [], geschrieben, mitgenommen };
}

module.exports = {
  ORDNER, ARTEN, BEZUEGE, ERGEBNISSE, AUFWAND, ANSTOSS_ARTEN, ID_FORM, APP_NAME, TITEL_MAX,
  slug, alsListe, textVon, datumGueltig, eintragPruefen, brettLesen, brettPruefen, ableiten,
  appNamen, nameImQuelltext, anstoesse, einspielen, heute, git, klasseWirksam, nachbarn, klassenVorschlag, ernten,
  ankerWirksam, ankerPruefen, bezugsRegeln, ANKER_MIN, ANKER_MAX, wieOft, zaehleWirksam, zahlenStand,
};
