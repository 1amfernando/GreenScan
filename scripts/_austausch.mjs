// _austausch.mjs — das Brett: lesen, pruefen, ableiten. EIN Modul fuer das
// Werkzeug (scripts/austausch.mjs) und den Pruefstand (scripts/austausch_check.js).
//
// Warum ein Modul: Reparatur und Pruefung brauchen DIESELBE Regel (CLAUDE.md
// §7.1, v32.16). Das Werkzeug lehnt mit genau der Pruefung ab, die der
// Pruefstand spaeter faehrt.
//
// Warum .mjs: robust_check C2 zaehlt jeden Bezeichner in scripts/*.js als
// Nennung einer App-Funktion. Diese Datei liegt ausserhalb seines Korpus und
// kann deshalb keine tote Funktion am Leben halten.
//
// Die Bauform (gemessen am 10.11.2026, docs/austausch/README.md):
//   - EINE DATEI JE EINTRAG unter docs/austausch/eintraege/. Zwei Schreiber,
//     zwei Dateien — nie ein Konflikt.
//   - EIN EINTRAG WIRD NICHT UMGESCHRIEBEN. Antwort, Abschluss und Nachtrag
//     sind neue Eintraege mit Bezug; der Zustand wird aus den Bezuegen
//     GERECHNET. Nur so kann eine Sitzung auf einem anderen Branch antworten.
//   - DAS BRETT IST DIE VEREINIGUNG UEBER ALLE BRANCHES: Arbeitsbaum plus
//     jeder Remote-Ref, den git kennt (125 nie gemergte Branches trugen
//     Befunde, die keine andere Sitzung je sah).
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';

export const ORDNER = 'docs/austausch/eintraege';

// ── Das Vokabular. Die Liste ist die Pruefung.
export const ARTEN = Object.assign(Object.create(null), {
  befund:    { wort: 'Befund',       pflicht: ['beleg'], offenbar: true,  sinn: 'etwas GEMESSENES: ein Fehler, eine Luecke, ein Widerspruch — mit Beleg' },
  idee:      { wort: 'Idee',         pflicht: ['nutzen', 'pruefbar'], offenbar: true, sinn: 'ein Vorschlag, der noch keinen Meilenstein verdient — mit Nutzen und woran man ihn pruefen koennte' },
  frage:     { wort: 'Frage',        pflicht: ['an'], offenbar: true,     sinn: 'was die schreibende Sitzung nicht messen oder entscheiden konnte' },
  klasse:    { wort: 'Fehlerklasse', pflicht: ['regel', 'instanzen'], offenbar: true, sinn: 'ein Fehler-MUSTER: Regel, Instanzen, Suchmuster fuer Geschwister, der Pruefstand-Fall, der es bewacht' },
  antwort:   { wort: 'Antwort',      pflicht: [], offenbar: false, brauchtBezug: ['beantwortet', 'baut_auf', 'widerspricht'], sinn: 'Antwort, Ergaenzung, Widerspruch oder Nachtrag (neuer Anker, neue Zaehlung, „gesucht") zu einem Eintrag' },
  abschluss: { wort: 'Abschluss',    pflicht: ['ergebnis'], offenbar: false, brauchtBezug: ['schliesst'], sinn: 'schliesst einen Eintrag: erledigt (wohin) · verworfen (Grund) · aufgestiegen (wohin)' },
});
export const BEZUEGE = Object.assign(Object.create(null), {
  baut_auf:     'nimmt den anderen Eintrag als Grundlage — so entsteht aus zwei Koepfen eine Idee',
  widerspricht: 'haelt den anderen Eintrag fuer falsch oder unvollstaendig, mit Beleg',
  beantwortet:  'beantwortet eine Frage',
  schliesst:    'der andere Eintrag ist erledigt, verworfen oder aufgestiegen (nur ein Abschluss schliesst)',
  ersetzt:      'der andere Eintrag DERSELBEN Art ist ueberholt; dieser gilt an seiner Stelle',
  gehoert_zu:   'ist eine Instanz dieser Fehlerklasse',
});
export const ERGEBNISSE = ['erledigt', 'verworfen', 'aufgestiegen'];
export const AN = ['alle', 'fernando'];
const LISTENFELDER = ['beleg', 'stichworte', 'instanzen'];
const TEXTFELDER = ['titel', 'text', 'von', 'stand', 'zeit', 'nutzen', 'pruefbar', 'an', 'haengt_daran', 'vorschlag', 'regel', 'suchmuster',
  'gesucht', 'ohne_waechter', 'ergebnis', 'wohin', 'geschwister', 'bewacht', 'details_bei'];
const BEKANNT = new Set(['id', 'art', 'datum', 'bezug', 'waechter', 'anker', 'zaehle', 'sicherheit', 'schluessel'].concat(LISTENFELDER, TEXTFELDER));
export const FELDER = [...BEKANNT];
const SICHERHEIT_NICHT = ['text', 'beleg', 'vorschlag', 'anker', 'zaehle', 'haengt_daran', 'nutzen', 'pruefbar', 'regel', 'instanzen', 'suchmuster', 'gesucht', 'geschwister', 'bewacht', 'waechter', 'ohne_waechter', 'wohin'];
export const GEHEIM_FORMEN = () => GEHEIM.length;
export const TITEL_MAX = 200, STUECK_MIN = 8, STUECK_MAX = 300;
export const ID_FORM = /^\d{4}-\d{2}-\d{2}-[0-9a-f]{4}$/;
// Namen, die wie App-Code aussehen — dieselbe Form, die robust_check „Memory" prueft.
export const APP_NAME = /^(_?gs[A-Z]|dq[A-Z]|sb[A-Z]|GS_[A-Z]|_gs[a-z])[\w]*$/;

// ── Was in einem PUBLIC Repo nicht stehen darf: FORMEN bekannter Geheimnisse.
const GEHEIM = [
  [/sk-ant-[A-Za-z0-9_-]{8,}/, 'ein Anthropic-Schluessel'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/, 'ein JWT'],
  [/\b(?:sk|rk)_live_[A-Za-z0-9]{8,}/, 'ein Stripe-Schluessel'],
  [/\bwhsec_[A-Za-z0-9]{8,}/, 'ein Webhook-Geheimnis'],
  [/\bsb_secret_[A-Za-z0-9_-]{8,}/, 'ein Supabase-Geheimnis'],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/, 'ein GitHub-Token'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'ein privater Schluessel'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, 'eine UUID (eine Nutzer- oder Datensatz-Kennung aus der Datenbank?)'],
  [/[A-Za-z0-9._%+-]+@(?!users\.noreply\.github\.com|example\.(?:com|org)|anthropic\.com|greenscan\.ch)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/, 'eine E-Mail-Adresse'],
];

export function slug(s) {
  return String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '') || 'eintrag';
}
export function alsListe(v) { return v == null ? [] : (Array.isArray(v) ? v : [v]); }
// Alles, was an einem Eintrag GELESEN wird — jedes Feld, auch ein unbekanntes
// (ein Geheimnis in `_notiz` ist auch eines).
export function textVon(e) {
  // NICHT JSON.stringify: dort ist ein Zeilenumbruch die zwei Zeichen „\\" und „n" — das n
  // ist ein Wortzeichen, und ein Token am ANFANG einer Zeile (so steht es in jeder
  // Befehlsausgabe) rutschte an jedem Muster mit \b vorbei.
  const teile = [];
  const geh = (v) => {
    if (v == null) return;
    if (typeof v === 'string') teile.push(v);
    else if (Array.isArray(v)) v.forEach(geh);
    else if (typeof v === 'object') for (const k of Object.keys(v)) { teile.push(k); geh(v[k]); }
    else teile.push(String(v));
  };
  geh(e);
  return teile.join('\n');
}
// Was im ARBEITSBAUM liegt. Ein Eintrag von einem fremden Branch beschreibt einen anderen Baum.
function imBaum(e) { return !e._quelle || e._quelle === 'Arbeitsbaum'; }
export function datumGueltig(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d))) return false;
  const [j, m, t] = String(d).split('-').map(Number);
  const x = new Date(Date.UTC(j, m - 1, t));
  return x.getUTCFullYear() === j && x.getUTCMonth() === m - 1 && x.getUTCDate() === t;
}
function imRepo(p) { return typeof p === 'string' && p.trim() && !path.isAbsolute(p) && !/(^|\/)\.\.(\/|$)/.test(p); }
// Die Reihenfolge zweier Eintraege: Datum, dann die Uhrzeit, die das Werkzeug
// setzt, dann die id. (Die id allein ist am selben Tag Zufall.)
export function ordnung(e) { return String(e.datum || '') + 'T' + String(e.zeit || '00:00:00') + ' ' + String(e.id || ''); }

// ── EINE Pruefung je Eintrag. Gruende als Liste; leer = gut.
export function eintragPruefen(e, dateiname) {
  const f = [];
  if (!e || typeof e !== 'object' || Array.isArray(e)) return ['kein JSON-Objekt'];
  for (const k of Object.keys(e)) if (!BEKANNT.has(k)) f.push('unbekanntes Feld „' + k + '" (die Felder stehen in docs/austausch/README.md)');
  const idOk = ID_FORM.test(String(e.id || ''));
  if (!idOk) f.push('id fehlt oder hat nicht die Form JJJJ-MM-TT-xxxx');
  const art = ARTEN[e.art];
  if (!art) f.push('art „' + e.art + '" gibt es nicht (erlaubt: ' + Object.keys(ARTEN).join(' · ') + ')');
  if (!datumGueltig(e.datum)) f.push('datum fehlt oder ist kein gueltiges JJJJ-MM-TT');
  else if (idOk && String(e.id).slice(0, 10) !== e.datum) f.push('id beginnt nicht mit dem datum');
  if (e.zeit != null && !/^\d{2}:\d{2}:\d{2}$/.test(String(e.zeit))) f.push('zeit hat nicht die Form HH:MM:SS');
  if (typeof e.von !== 'string' || !e.von.trim()) f.push('von fehlt (wer schreibt: Sitzung/Branch/Rolle — kein Personenname)');
  if (typeof e.titel !== 'string' || !e.titel.trim()) f.push('titel fehlt');
  else if (e.titel.length > TITEL_MAX) f.push('titel hat ' + e.titel.length + ' Zeichen (hoechstens ' + TITEL_MAX + ' — der Rest gehoert in text)');
  for (const k of TEXTFELDER) if (e[k] != null && typeof e[k] !== 'string') f.push(k + ' muss Text sein');
  for (const k of LISTENFELDER) if (e[k] != null && (!Array.isArray(e[k]) || e[k].some(x => typeof x !== 'string' || !x.trim()))) f.push(k + ' muss eine Liste nicht-leerer Texte sein');
  if (e.sicherheit != null && typeof e.sicherheit !== 'boolean') f.push('sicherheit muss true oder false sein');
  if (dateiname != null && idOk && art && (dateiname.indexOf(e.id + '-' + e.art + '-') !== 0 || !/\.json$/.test(dateiname))) f.push('Dateiname muss mit „' + e.id + '-' + e.art + '-" beginnen und auf .json enden');
  if (e.bezug != null) {
    if (!Array.isArray(e.bezug)) f.push('bezug muss eine Liste sein');
    else e.bezug.forEach((b, i) => {
      if (!b || typeof b !== 'object' || !ID_FORM.test(String(b.id || ''))) f.push('bezug[' + i + ']: id fehlt oder hat die falsche Form');
      else if (b.id === e.id) f.push('bezug[' + i + ']: ein Eintrag bezieht sich nicht auf sich selbst');
      if (!b || !BEZUEGE[b.art]) f.push('bezug[' + i + ']: art „' + (b && b.art) + '" gibt es nicht (erlaubt: ' + Object.keys(BEZUEGE).join(' · ') + ')');
      if (b && b.ref != null && (typeof b.ref !== 'string' || !b.ref.trim())) f.push('bezug[' + i + ']: ref nennt den Branch, auf dem das Ziel liegt (Text)');
    });
  }
  // Anker und Zaehlung: {datei, text[, n]} — ein WOERTLICHES Stueck einer Datei im Repo.
  const stueck = (feld, mitN) => {
    if (e[feld] == null) return;
    if (!Array.isArray(e[feld]) || !e[feld].length) { f.push(feld + ' muss eine nicht-leere Liste von {datei, text' + (mitN ? ', n' : '') + '} sein'); return; }
    e[feld].forEach((x, i) => {
      if (!x || typeof x.datei !== 'string' || typeof x.text !== 'string') { f.push(feld + '[' + i + ']: {datei, text' + (mitN ? ', n' : '') + '} verlangt'); return; }
      if (!imRepo(x.datei)) f.push(feld + '[' + i + ']: datei muss ein Pfad im Repo sein');
      if (x.text.length < (mitN ? 3 : STUECK_MIN) || x.text.length > STUECK_MAX || /\n/.test(x.text)) f.push(feld + '[' + i + ']: text ist EINE Zeile mit ' + (mitN ? 3 : STUECK_MIN) + ' bis ' + STUECK_MAX + ' Zeichen (ein woertliches Stueck, kein Absatz)');
      if (mitN && (!Number.isInteger(x.n) || x.n < 0)) f.push(feld + '[' + i + ']: n ist eine ganze Zahl ab 0');
    });
  };
  stueck('anker', false); stueck('zaehle', true);
  if (e.anker != null && e.art === 'abschluss') f.push('anker gehoert an einen Befund, eine Idee, eine Frage, eine Fehlerklasse — oder an eine Antwort darauf (neu verankern)');
  if (e.waechter != null) {
    if (e.art !== 'klasse' && e.art !== 'antwort') f.push('waechter gehoert an eine Fehlerklasse oder an eine Antwort auf eine');
    if (!Array.isArray(e.waechter)) f.push('waechter muss eine Liste von {datei, fall} sein');
    else e.waechter.forEach((x, i) => { if (!x || !imRepo(x.datei) || typeof x.fall !== 'string' || x.fall.trim().length < 3) f.push('waechter[' + i + ']: {datei, fall} verlangt — eine Datei im Repo und eine Fallkennung mit mindestens 3 Zeichen'); });
  }
  if (!art) return f;
  for (const k of art.pflicht) {
    if (e.sicherheit === true && k === 'beleg') continue;   // der Beleg eines Sicherheitsbefunds steht nicht auf dem Brett
    const v = e[k];
    if (v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)) f.push(art.wort + ' ohne „' + k + '"');
  }
  if (art.brauchtBezug && !alsListe(e.bezug).some(b => b && art.brauchtBezug.indexOf(b.art) >= 0)) f.push(art.wort + ' braucht einen Bezug der Art ' + art.brauchtBezug.join(' / '));
  if (e.art === 'frage' && e.an != null && AN.indexOf(e.an) < 0) f.push('an: ' + AN.join(' oder '));
  if (e.art === 'abschluss') {
    if (e.ergebnis != null && ERGEBNISSE.indexOf(e.ergebnis) < 0) f.push('ergebnis: ' + ERGEBNISSE.join(' · '));
    if (e.ergebnis === 'verworfen' && !(e.text && e.text.trim())) f.push('verworfen ohne Grund (text)');
    if ((e.ergebnis === 'erledigt' || e.ergebnis === 'aufgestiegen') && !(e.wohin && e.wohin.trim())) f.push(e.ergebnis + ' ohne „wohin" (Version, Commit oder Dokument-Stelle)');
  }
  if (e.art === 'klasse' && Array.isArray(e.waechter || []) && !alsListe(e.waechter).length && !(e.ohne_waechter && e.ohne_waechter.trim())) {
    f.push('Fehlerklasse ohne Waechter braucht „ohne_waechter" mit Grund (kein Pruefstand-Fall bewacht sie — das ist eine Aussage, keine Luecke im Formular)');
  }
  // Ein Sicherheitsbefund steht in einem PUBLIC Repo: nur der Titel, kein Weg.
  //   Gesperrt ist jedes Feld, in dem ein Weg stehen kann — nicht nur „text": ein Beleg IST der Weg.
  if (e.sicherheit === true) {
    if (e.art !== 'befund' && e.art !== 'frage') f.push('sicherheit: true gibt es nur an einem Befund oder einer Frage');
    const zuviel = SICHERHEIT_NICHT.filter(k => e[k] != null && !(typeof e[k] === 'string' && !e[k].trim()) && !(Array.isArray(e[k]) && !e[k].length));
    if (zuviel.length) f.push('sicherheit: true — nur Titel, Stichworte und „details_bei" stehen auf dem Brett (das Repo ist public); nicht: ' + zuviel.join(', '));
    if (!(e.details_bei && e.details_bei.trim())) f.push('sicherheit: true braucht „details_bei" (wo die Einzelheiten liegen)');
  }
  const roh = textVon(e);
  for (const [re, was] of GEHEIM) if (re.test(roh)) f.push('enthaelt etwas, das wie ' + was + ' aussieht — das Repo ist public');
  // Ein Beleg, den niemand nachfahren kann, ist keiner: Pfade aus dem Arbeitsverzeichnis EINER Sitzung.
  if (/(^|[\s"'`(=:])\/(tmp|root|home|Users|var\/folders)\//.test(roh)) f.push('nennt einen Pfad, der nur auf einer Maschine stimmt (/tmp, /root, /home …) — Belege nennen Pfade im Repo oder den Befehl mit seiner Zahl');
  return f;
}

// ── Lesen. Arbeitsbaum zuerst, dann (auf Wunsch) jeder Remote-Ref.
export function git(wurzel, args) {
  try { return cp.execFileSync('git', ['-C', wurzel].concat(args), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }); }
  catch (_) { return null; }
}
function lies(roh, datei, quelle, unlesbar) {
  let e;
  try { e = JSON.parse(roh); } catch (x) { unlesbar.push({ datei, quelle, grund: 'kein gueltiges JSON: ' + String(x.message).split('\n')[0] }); return null; }
  if (!e || typeof e !== 'object' || Array.isArray(e)) { unlesbar.push({ datei, quelle, grund: 'kein JSON-Objekt' }); return null; }
  // Ohne brauchbare id kann nichts auf den Eintrag zeigen und nichts ihn ordnen.
  // Ein solcher Eintrag — auch von einem fremden Branch — ist unlesbar, nicht Teil des Bretts.
  if (!ID_FORM.test(String(e.id || '')) || typeof e.art !== 'string') { unlesbar.push({ datei, quelle, grund: 'ohne id der Form JJJJ-MM-TT-xxxx oder ohne art' }); return null; }
  // Falsch geformte Felder (anker: [null], gesucht: 4, bezug: [null] …) wuerden spaeter
  // jede Rechnung abstuerzen lassen — und zwar in JEDER Sitzung, die den Branch liest.
  const ff = formFehler(e);
  if (ff) { unlesbar.push({ datei, quelle, grund: 'falsch geformt: ' + ff }); return null; }
  for (const [k, v] of [['_datei', datei], ['_quelle', quelle], ['_roh', roh]]) Object.defineProperty(e, k, { value: v, enumerable: false });
  return e;
}
function formFehler(e) {
  for (const k of TEXTFELDER) if (e[k] != null && typeof e[k] !== 'string') return k + ' ist kein Text';
  for (const k of LISTENFELDER) if (e[k] != null && (!Array.isArray(e[k]) || e[k].some(x => typeof x !== 'string'))) return k + ' ist keine Liste von Texten';
  if (e.bezug != null && (!Array.isArray(e.bezug) || e.bezug.some(b => !b || typeof b !== 'object' || typeof b.id !== 'string' || typeof b.art !== 'string' || (b.ref != null && typeof b.ref !== 'string')))) return 'bezug ist keine Liste von {art, id}';
  for (const [k, feld] of [['anker', 'text'], ['zaehle', 'text'], ['waechter', 'fall']]) {
    if (e[k] != null && (!Array.isArray(e[k]) || e[k].some(x => !x || typeof x !== 'object' || typeof x.datei !== 'string' || typeof x[feld] !== 'string'))) return k + ' ist keine Liste von {datei, ' + feld + '}';
  }
  if (e.zaehle != null && e.zaehle.some(x => !Number.isInteger(x.n))) return 'zaehle ohne ganze Zahl n';
  return null;
}
export function brettLesen(wurzel, opts) {
  opts = opts || {};
  const aus = { eintraege: [], unlesbar: [], doppelt: [], abweichend: [], quellen: ['Arbeitsbaum'], gitDa: null, refs: 0 };
  const proId = new Map();
  const nimm = (e) => {
    if (!e) return false;
    const vor = proId.get(e.id);
    if (!vor) { proId.set(e.id, e); aus.eintraege.push(e); return true; }
    if (vor._quelle === e._quelle) aus.doppelt.push({ id: e.id, dateien: [vor._datei, e._datei], quelle: e._quelle });
    // Derselbe Eintrag auf einem anderen Branch mit anderem Inhalt: er wurde umgeschrieben.
    else if (vor._roh.trim() !== e._roh.trim()) aus.abweichend.push({ id: e.id, gilt: vor._quelle, weichtAb: e._quelle });
    return false;
  };
  // Ein Unterordner je Monat (eintraege/2026-11/…): das Verzeichnis waechst nur
  // durch Anlegen, und kein Deckel soll je einen Unbeteiligten rot faerben.
  const dir = path.join(wurzel, ORDNER);
  const liesOrdner = (d) => { for (const n of fs.readdirSync(d).sort()) {
    const p = path.join(d, n);
    if (/^\d{4}-\d{2}$/.test(n) && fs.statSync(p).isDirectory()) liesOrdner(p);
    else if (/\.json$/.test(n)) {
      let roh = null;
      try { roh = fs.readFileSync(p, 'utf8'); } catch (x) { aus.unlesbar.push({ datei: n, quelle: 'Arbeitsbaum', grund: 'nicht lesbar: ' + String(x.message).split('\n')[0] }); }
      if (roh != null) nimm(lies(roh, n, 'Arbeitsbaum', aus.unlesbar));
    }
  } };
  if (fs.existsSync(dir)) liesOrdner(dir);
  if (opts.alleRefs) {
    // Der VOLLE Name: `refname:short` macht aus refs/remotes/origin/HEAD den Namen „origin" —
    // der zaehlte dann als eigener Branch (und stand als „frisch" in der Liste).
    const refs = git(wurzel, ['for-each-ref', '--format=%(refname)', 'refs/remotes']);
    aus.gitDa = refs != null;
    if (refs != null) {
      // main zuerst: weicht ein Branch von main ab, gilt main.
      const liste = refs.split('\n').map(s => s.trim()).filter(s => s && !/\/HEAD$/.test(s))
        .sort((a, b) => (/\/main$/.test(b) ? 1 : 0) - (/\/main$/.test(a) ? 1 : 0) || a.localeCompare(b));
      // Derselbe Blob ist derselbe Inhalt: einmal lesen genuegt. (Ohne das kostet das Lesen
      // Branches × Eintraege git-Prozesse, sobald Branches von einem main mit Brett abzweigen.)
      const blobGesehen = new Set();
      for (const voll of liste) {
        const ref = voll.replace(/^refs\/remotes\//, '');
        aus.refs++;
        // -z: Dateinamen mit Sonderzeichen kommen unveraendert an.
        const ls = git(wurzel, ['ls-tree', '-r', '-z', voll, '--', ORDNER + '/']);
        if (!ls) continue;
        let neu = 0;
        for (const zeile of ls.split('\0')) {
          const m = zeile.match(/^\d+ blob ([0-9a-f]+)\t(.+\.json)$/);
          if (!m || blobGesehen.has(m[1])) continue;
          blobGesehen.add(m[1]);
          const name = path.posix.basename(m[2]);
          const roh = git(wurzel, ['cat-file', 'blob', m[1]]);
          if (roh != null && nimm(lies(roh, name, ref, aus.unlesbar))) neu++;
        }
        if (neu) aus.quellen.push(ref + ' (+' + neu + ')');
      }
    }
  }
  aus.eintraege.sort((a, b) => ordnung(a).localeCompare(ordnung(b)));
  return aus;
}
// Wer arbeitet parallel? Gerechnet aus den Branch-Spitzen — niemand muss dafuer
// etwas schreiben (die geplanten Sitzungen, die am 10.09.2026 denselben Fehler
// viermal behoben, haetten keinen Anspruch angelegt). `jetzt` in ms; nur Anzeige.
export function frischeZweige(wurzel, jetzt, tage) {
  const roh = git(wurzel, ['for-each-ref', '--sort=-committerdate', '--format=%(refname)\t%(committerdate:unix)\t%(subject)', 'refs/remotes']);
  if (roh == null) return null;
  const kopf = (git(wurzel, ['rev-parse', '--abbrev-ref', 'HEAD']) || '').trim();
  const aus = [];
  for (const z of roh.split('\n')) {
    const [voll, t, ...rest] = z.split('\t');
    const ref = String(voll || '').replace(/^refs\/remotes\//, '');
    if (!ref || /\/HEAD$/.test(ref) || /\/main$/.test(ref) || ref.replace(/^[^/]+\//, '') === kopf) continue;
    const alter = Math.floor((jetzt - Number(t) * 1000) / 864e5);
    if (alter <= tage) aus.push({ ref, tage: Math.max(0, alter), betreff: rest.join('\t') });
  }
  return aus;
}

// ── Der Zustand wird GERECHNET. Kein Feld „status" — das waere eine zweite Kopie.
export function ableiten(eintraege) {
  const proId = new Map(eintraege.map(e => [e.id, e]));
  const rueck = new Map();
  for (const e of eintraege) for (const b of alsListe(e.bezug)) {
    if (!b || !b.id) continue;
    if (!rueck.has(b.id)) rueck.set(b.id, []);
    rueck.get(b.id).push({ von: e, art: b.art });
  }
  for (const l of rueck.values()) l.sort((x, y) => ordnung(x.von).localeCompare(ordnung(y.von)));
  const zustand = new Map();
  for (const e of eintraege) {
    const r = rueck.get(e.id) || [];
    // Nur ein ABSCHLUSS schliesst; nur ein Eintrag DERSELBEN Art ersetzt.
    // „Erledigt" ist eine Aussage ueber einen BAUM: ein Abschluss „erledigt", der nur auf einem
    // anderen Branch liegt, schliesst hier nichts — sonst meldete das Brett „nichts offen",
    // waehrend der Fehler in diesem Baum steht. „Verworfen" und „aufgestiegen" sind Aussagen
    // ueber die BEHAUPTUNG und gelten ueber alle Branches.
    const schluss = r.filter(x => x.art === 'schliesst' && x.von.art === 'abschluss');
    const zu = schluss.find(x => x.von.ergebnis !== 'erledigt' || imBaum(x.von)), ers = r.find(x => x.art === 'ersetzt' && x.von.art === e.art);
    const anderswo = zu ? null : (schluss.find(x => x.von.ergebnis === 'erledigt') || {}).von || null;
    let z = 'offen', durch = null;
    if (zu) { z = 'geschlossen'; durch = zu.von; }
    else if (ers) { z = 'ersetzt'; durch = ers.von; }
    else if (e.art === 'frage' && r.some(x => x.art === 'beantwortet')) { z = 'beantwortet'; durch = r.find(x => x.art === 'beantwortet').von; }
    else if (!ARTEN[e.art] || !ARTEN[e.art].offenbar) z = 'notiz';
    zustand.set(e.id, { z, durch, anderswo });
  }
  return { proId, rueck, zustand };
}

// ── Was ein Bezug darf — EINE Regel fuer den Pruefstand und fuer das Schreiben.
export function bezugsRegeln(e, proId) {
  const f = [];
  for (const b of alsListe(e.bezug)) {
    const ziel = b && proId.get(b.id);
    if (!ziel) continue;
    if (b.art === 'beantwortet' && ziel.art !== 'frage') f.push('„beantwortet" zeigt auf ' + b.id + ', das keine Frage ist (' + ziel.art + ')');
    if (b.art === 'gehoert_zu' && ziel.art !== 'klasse') f.push('„gehoert_zu" zeigt auf ' + b.id + ', das keine Fehlerklasse ist (' + ziel.art + ')');
    if (b.art === 'schliesst' && e.art !== 'abschluss') f.push('„schliesst" darf nur ein Abschluss tragen (node scripts/austausch.mjs schliesse ' + b.id.slice(-4) + ' …) — sonst waere das strenge Schliessen mit einer Antwort zu umgehen');
    if (b.art === 'ersetzt' && e.art !== ziel.art) f.push('„ersetzt" verlangt dieselbe Art: ' + e.art + ' kann ' + ziel.art + ' ' + b.id + ' nicht ersetzen');
    if ((b.art === 'schliesst' || b.art === 'ersetzt') && (ziel.art === 'abschluss' || ziel.art === 'antwort')) f.push('„' + b.art + '" zeigt auf ' + b.id + ' (' + ziel.art + ') — geschlossen wird der urspruengliche Eintrag, nicht die Antwort darauf');
    // Schliessen ist streng: wer einen BEFUND als erledigt schliesst, sagt, ob er
    // nach Geschwistern gesucht hat. „Eine Fehlerklasse ist erst geschlossen, wenn
    // man sie GESUCHT hat" (v32.87) bekommt hier ihren Ausloeser.
    if (b.art === 'schliesst' && ziel.art === 'befund' && e.art === 'abschluss' && e.ergebnis === 'erledigt' && !(e.geschwister && e.geschwister.trim())) {
      f.push('ein behobener Befund (' + b.id + ') braucht „geschwister": „gesucht: <wie> → N Treffer" — oder „nicht gesucht, weil …"');
    }
  }
  return f;
}
export function brettPruefen(brett) {
  const f = [];
  for (const u of brett.unlesbar) f.push({ wo: u.datei, grund: u.grund });
  for (const d of brett.doppelt) f.push({ wo: d.dateien.join(' + '), grund: 'dieselbe id ' + d.id + ' in zwei Dateien' });
  const proId = new Map(brett.eintraege.map(e => [e.id, e]));
  for (const e of brett.eintraege) {
    for (const g of eintragPruefen(e, e._datei)) f.push({ wo: e._datei || e.id, grund: g });
    for (const b of alsListe(e.bezug)) if (b && ID_FORM.test(String(b.id || '')) && !proId.has(b.id) && !b.ref) f.push({ wo: e._datei || e.id, grund: 'Bezug auf ' + b.id + ' — den Eintrag gibt es nicht' });
    for (const g of bezugsRegeln(e, proId)) f.push({ wo: e._datei || e.id, grund: g });
  }
  return f;
}

// ── Nachtraege: ein Eintrag wird nie umgeschrieben; eine ANTWORT mit `anker`,
//    `zaehle`, `gesucht`, `suchmuster`, `waechter` oder `instanzen` ergaenzt ihn.
//    Es gilt der JUENGSTE Nachtrag (Reihenfolge: Datum, Zeit, id).
//    Ein Nachtrag mit Anker oder Zaehlung beschreibt den Baum, in dem er liegt: einer von
//    einem fremden Branch gilt hier nicht (sonst wuerde dessen Code gegen diesen Baum gemessen).
function nachtraege(e, rueck, feld) {
  return ((rueck && rueck.get(e.id)) || []).filter(r => r.von.art === 'antwort' && imBaum(r.von) && (Array.isArray(r.von[feld]) ? r.von[feld].length : (r.von[feld] && String(r.von[feld]).trim()))).map(r => r.von);
}
export function ankerWirksam(e, rueck) { const n = nachtraege(e, rueck, 'anker'); return n.length ? alsListe(n[n.length - 1].anker) : alsListe(e.anker); }
export function zaehleWirksam(e, rueck) { const n = nachtraege(e, rueck, 'zaehle'); return n.length ? alsListe(n[n.length - 1].zaehle) : alsListe(e.zaehle); }
export function klasseWirksam(e, rueck) {
  const k = { regel: e.regel, suchmuster: e.suchmuster || '', ohne_waechter: e.ohne_waechter || '', gesucht: e.gesucht ? [e.gesucht] : [],
    waechter: alsListe(e.waechter).slice(), instanzen: alsListe(e.instanzen).slice(), befunde: [] };
  for (const r of ((rueck && rueck.get(e.id)) || [])) {
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

// ── Messen gegen den Baum. `liesDatei(rel)` → Text oder null.
// Gemessen wird der Text OHNE ganze Kommentarzeilen und (in index.html) OHNE den
// Block GS_RELEASES: Changelog und Kommentare nennen Code woertlich. Ein Anker,
// der nur noch dort steht, bliebe sonst gruen, obwohl die Stelle weg ist — und
// wuerde zwanzig Bumps spaeter rot, wenn der Changelog-Eintrag ins Archiv
// wandert: im PR eines Unbeteiligten (dieselbe Klasse wie v33.49, „die Suche
// findet zuerst den eigenen Text ueber die Sache").
export function messtext(datei, t) {
  if (t == null) return null;
  if (/\.(js|mjs|ts|java|html)$/.test(datei)) t = t.replace(/^[ \t]*(\/\/|\/\*|\*).*$/gm, '');
  else if (/\.sql$/.test(datei)) t = t.replace(/^[ \t]*--.*$/gm, '');
  else if (/\.(sh|py|yml|yaml)$/.test(datei)) t = t.replace(/^[ \t]*#.*$/gm, '');
  if (/(^|\/)index\.html$/.test(datei)) {
    const a = t.indexOf('window.GS_RELEASES = ['), b = a < 0 ? -1 : t.indexOf('\n];', a);
    if (a >= 0 && b > a) t = t.slice(0, a) + t.slice(b + 3);
  }
  return t;
}
export function wieOft(text, stueck) {
  if (text == null || !stueck) return null;
  let n = 0, i = 0;
  while ((i = text.indexOf(stueck, i)) >= 0) { n++; i += stueck.length; }
  return n;
}
function leser(liesDatei) { const c = new Map(); return (rel) => { if (!c.has(rel)) c.set(rel, messtext(rel, liesDatei(rel))); return c.get(rel); }; }
// Nur was im ARBEITSBAUM liegt, wird gegen den Arbeitsbaum gemessen (imBaum).
export function ankerPruefen(eintraege, liesDatei) {
  const { rueck, zustand } = ableiten(eintraege), lies1 = leser(liesDatei);
  const aus = { geprueft: 0, eintraege: 0, verloren: [] };
  for (const e of eintraege) {
    if (zustand.get(e.id).z !== 'offen' || !imBaum(e)) continue;
    const anker = ankerWirksam(e, rueck);
    if (!anker.length) continue;
    aus.eintraege++;
    for (const x of anker) {
      aus.geprueft++;
      const t = lies1(x.datei);
      if (t == null) aus.verloren.push({ id: e.id, titel: e.titel, datei: x.datei, text: x.text, grund: 'Datei fehlt' });
      else if (t.indexOf(x.text) < 0) aus.verloren.push({ id: e.id, titel: e.titel, datei: x.datei, text: x.text, grund: 'Text steht nicht mehr in der Datei' });
    }
  }
  return aus;
}
export function zahlenStand(eintraege, liesDatei) {
  const { rueck, zustand } = ableiten(eintraege), lies1 = leser(liesDatei), aus = [];
  for (const e of eintraege) {
    if (zustand.get(e.id).z !== 'offen' || !imBaum(e)) continue;
    for (const x of zaehleWirksam(e, rueck)) aus.push({ id: e.id, titel: e.titel, datei: x.datei, text: x.text, n: x.n, heute: wieOft(lies1(x.datei), x.text) });
  }
  return aus;
}
export function appNamen(e) { return alsListe(e.stichworte).map(s => String(s).trim()).filter(s => APP_NAME.test(s)); }
export function nameImQuelltext(quelltext, name) { return new RegExp('(^|[^\\w$])' + name.replace(/[$]/g, '\\$') + '(?![\\w$])').test(quelltext); }
// Welche Waechter einer Klasse zeigen ins Leere?
export function waechterPruefen(waechter, liesDatei) {
  const f = [];
  for (const x of alsListe(waechter)) {
    if (!x || !x.datei || !x.fall) continue;
    // Eine Fallkennung ist eine ADRESSE: sie steht in ihrer Datei genau einmal.
    // („E1" stuende vierzehnmal da — und fiele einer von siebzehn gleichnamigen Faellen weg, bliebe alles gruen.)
    const n = wieOft(liesDatei(x.datei), x.fall);
    if (n == null) f.push(x.datei + ' gibt es nicht');
    else if (n === 0) f.push('„' + x.fall + '" steht nicht in ' + x.datei);
    else if (n > 1) f.push('„' + x.fall + '" steht ' + n + '-mal in ' + x.datei + ' — eine Adresse steht genau einmal da: ein laengeres Stueck vom Namen des Falls nehmen');
  }
  return f;
}

// ── Anstoesse: was der Code ueber MEHRERE Eintraege hinweg sieht. Marken an
//    einem einzelnen Eintrag (Frage ohne Antwort, Befund ohne Echo) stehen in
//    `marken` — die Liste des Offenen nennt jeden Eintrag genau einmal.
export const ANSTOSS_ARTEN = {
  widerspruch:   'Widerspruch ohne Aufloesung',
  beruehrung:    'Zwei Koepfe, dieselbe Stelle',
  zwei_ideen:    'Zwei Ideen auf denselben Fund',
  anker_verloren: 'Die Stelle wurde geaendert',
  zahl_bewegt:   'Eine Zahl hat sich bewegt',
};
export function anstoesse(eintraege, liesDatei) {
  const { rueck, zustand } = ableiten(eintraege);
  const offen = eintraege.filter(e => zustand.get(e.id).z === 'offen');
  const aus = [], zeige = (e) => e.id + ' ' + e.titel;
  const verbunden = (a, b) => alsListe(a.bezug).some(x => x && x.id === b.id) || alsListe(b.bezug).some(x => x && x.id === a.id);
  for (const e of offen) {
    const w = (rueck.get(e.id) || []).filter(x => x.art === 'widerspricht').map(x => x.von.id);
    if (w.length) aus.push({ art: 'widerspruch', ids: [e.id].concat(w), satz: zeige(e) + '  ← widersprochen von ' + w.join(', ') + ' — nachmessen, dann schliessen oder ersetzen' });
  }
  const proWort = new Map();
  for (const e of offen) for (const s of new Set(alsListe(e.stichworte).map(x => String(x).trim().toLowerCase()).filter(Boolean))) {
    if (!proWort.has(s)) proWort.set(s, []);
    proWort.get(s).push(e);
  }
  const paare = new Map();
  for (const [wort, liste] of proWort) for (let i = 0; i < liste.length; i++) for (let j = i + 1; j < liste.length; j++) {
    const a = liste[i], b = liste[j];
    if (a.von === b.von || verbunden(a, b) || a.art === 'klasse' || b.art === 'klasse') continue;
    const k = a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id;
    if (!paare.has(k)) paare.set(k, { a: a.id < b.id ? a : b, b: a.id < b.id ? b : a, worte: [] });
    paare.get(k).worte.push(wort);
  }
  for (const p of paare.values()) aus.push({ art: 'beruehrung', ids: [p.a.id, p.b.id], satz: '„' + p.worte.join(', ') + '": ' + zeige(p.a) + '  ×  ' + zeige(p.b) + ' — gemeinsame Ursache? Dann ein Eintrag mit baut_auf auf beide' });
  for (const [ziel, liste] of rueck) {
    const ideen = liste.filter(x => x.art === 'baut_auf' && x.von.art === 'idee' && zustand.get(x.von.id).z === 'offen').map(x => x.von);
    for (let i = 0; i < ideen.length; i++) for (let j = i + 1; j < ideen.length; j++) {
      const a = ideen[i], b = ideen[j];
      if (a.von !== b.von && !verbunden(a, b)) aus.push({ art: 'zwei_ideen', ids: [a.id, b.id, ziel], satz: zeige(a) + '  ×  ' + zeige(b) + ' — beide bauen auf ' + ziel + ': vertragen sie sich, oder ist eine die bessere?' });
    }
  }
  if (liesDatei) {
    for (const x of ankerPruefen(eintraege, liesDatei).verloren) aus.push({ art: 'anker_verloren', ids: [x.id], satz: x.id + ' ' + x.titel + '  → ' + x.datei + ': ' + x.grund + ' — lies den Eintrag; dann schliessen oder neu verankern' });
    for (const z of zahlenStand(eintraege, liesDatei)) {
      if (z.heute !== z.n) aus.push({ art: 'zahl_bewegt', ids: [z.id], satz: z.id + ' ' + z.titel + '  → „' + z.text.slice(0, 50) + '" in ' + z.datei + ': war ' + z.n + ', heute ' + (z.heute == null ? 'nicht lesbar' : z.heute) + (z.heute === 0 ? ' — behoben? Dann schliessen' : (z.heute > z.n ? ' — neue Geschwister' : '')) });
    }
  }
  const rang = Object.keys(ANSTOSS_ARTEN);
  return aus.sort((x, y) => rang.indexOf(x.art) - rang.indexOf(y.art) || x.ids[0].localeCompare(y.ids[0]));
}
// Marken an EINEM offenen Eintrag (kurz, fuer die Liste).
export function marken(e, abl, quelltext) {
  const r = abl.rueck.get(e.id) || [], m = [], zs = abl.zustand.get(e.id);
  if (zs && zs.anderswo) m.push('auf ' + (zs.anderswo._quelle || 'einem anderen Branch') + ' als erledigt geschlossen (' + (zs.anderswo.wohin || '?') + ') — in diesem Baum noch nicht');
  if (e.art === 'frage') m.push('ohne Antwort' + (e.an === 'fernando' ? ' · an Fernando' : ''));
  // Ein eigener Nachtrag ist kein Echo: es zaehlt, was ein ANDERER schreibt — oder alles ausser einer Antwort.
  if (e.art === 'befund' && !r.some(x => x.von.art !== 'antwort' || x.von.von !== e.von)) m.push('noch niemand dazu');
  if (e.art === 'idee' && !r.some(x => x.von.von !== e.von)) m.push('kein Zweiter hat sie angesehen');
  if (quelltext && e.art !== 'idee' && (!e._quelle || e._quelle === 'Arbeitsbaum')) {
    const weg = appNamen(e).filter(n => !nameImQuelltext(quelltext, n));
    if (weg.length) m.push('nennt Code, den es nicht mehr gibt: ' + weg.join(', '));
  }
  return m;
}

// ── Lesen ist ins Schreiben eingebaut: was wissen ANDERE an denselben Stichworten?
export function nachbarn(e, eintraege) {
  const { zustand } = ableiten(eintraege);
  const meine = new Set(alsListe(e.stichworte).map(x => String(x).trim().toLowerCase()).filter(Boolean));
  if (!meine.size) return [];
  const aus = [];
  for (const x of eintraege) {
    if (x.id === e.id || x.art === 'klasse' || x.art === 'antwort' || x.art === 'abschluss') continue;
    const z = zustand.get(x.id);
    // Ein IRRWEG: dort schon versucht und mit Grund verworfen. Auch dem eigenen Schreiber gezeigt.
    const irrweg = z.z === 'geschlossen' && z.durch && z.durch.ergebnis === 'verworfen';
    if (!irrweg && (z.z !== 'offen' || x.von === e.von)) continue;
    const gemeinsam = alsListe(x.stichworte).map(s => String(s).trim()).filter(s => meine.has(s.toLowerCase()));
    if (gemeinsam.length) aus.push({ eintrag: x, gemeinsam, irrweg, grund: irrweg ? (z.durch.text || '') : '' });
  }
  return aus.sort((a, b) => b.gemeinsam.length - a.gemeinsam.length || b.eintrag.id.localeCompare(a.eintrag.id));
}
const FUELLWORT = new Set('nicht einer eine einem einen eines keine keinen wird werden wurde dass dies diese dieser dieses oder aber auch nach noch sich sind ueber unter durch ohne beim wenn dann statt jede jeder jedes alle allem zwei drei mehr weil immer schon gegen ihre ihren seine seinen kann muss soll sein haben hatte waren wieder dabei damit sonst gibt geht kommt steht zeigt selbst genau gleich neue neuen neuer erst etwas beide beiden'.split(' '));
function worte(t) {
  return new Set(String(t || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .split(/[^a-z0-9_]+/).filter(w => w.length >= 5 && !FUELLWORT.has(w)));
}
// Welche Fehlerklasse koennte es sein? Ein VORSCHLAG zum Nachschlagen, kein Urteil.
export function klassenVorschlag(e, eintraege) {
  const { zustand } = ableiten(eintraege);
  const w = worte([e.titel, e.text, alsListe(e.stichworte).join(' '), e.vorschlag].join(' ')), aus = [];
  for (const k of eintraege) {
    if (k.art !== 'klasse' || zustand.get(k.id).z !== 'offen') continue;
    const kw = worte([k.titel, k.regel, alsListe(k.stichworte).join(' ')].join(' '));
    const gemeinsam = [...w].filter(x => kw.has(x));
    if (gemeinsam.length >= 3) aus.push({ klasse: k, gemeinsam });
  }
  return aus.sort((a, b) => b.gemeinsam.length - a.gemeinsam.length).slice(0, 3);
}
// Vorwissen: das Tagebuch als Suchflaeche. Wo steht ein genannter App-Name schon?
export function vorwissen(e, texte) {
  const aus = [];
  for (const name of new Set(appNamen(e))) for (const datei of Object.keys(texte)) {
    const t = texte[datei]; if (!t) continue;
    const n = wieOft(t, name); if (!n) continue;
    const i = t.indexOf(name), k = Math.max(t.lastIndexOf('\n### ', i), t.lastIndexOf('\n## ', i));
    aus.push({ name, datei, stellen: n, abschnitt: k < 0 ? '' : t.slice(k + 1, t.indexOf('\n', k + 1)).replace(/^#+\s*/, '') });
  }
  return aus.sort((a, b) => a.stellen - b.stellen);
}

// ── Der juengste STATUS-Eintrag sagt, was offen bleibt — in zwei festen Zeilen.
//    Das haengt am einen Ritual, das gemessen haelt (51 von 51 Versionen haben
//    ihren §0-Eintrag), statt eine zweite Uebergabe-Datei daneben zu stellen.
export function statusZeilen(statusText) {
  const a = statusText.indexOf('\n## 0 ');
  const b = a < 0 ? -1 : statusText.indexOf('\n## ', a + 5);
  if (a < 0) return { grund: 'Abschnitt „## 0" nicht gefunden' };
  const s0 = statusText.slice(a, b < 0 ? undefined : b);
  const k = s0.indexOf('\n### ');
  if (k < 0) return { grund: 'kein Eintrag in §0' };
  const ende = s0.indexOf('\n### ', k + 5);
  const eintrag = s0.slice(k + 1, ende < 0 ? undefined : ende);
  const ueberschrift = eintrag.slice(0, eintrag.indexOf('\n')).replace(/^###\s*/, '');
  const offen = eintrag.match(/^\*\*Offen:\*\*[ \t]*(.*)$/m), np = eintrag.match(/^\*\*Nicht geprüft[^*\n]*:\*\*[ \t]*(.*)$/m);
  const ids = offen ? [...offen[1].matchAll(/\bbrett:(\d{4}-\d{2}-\d{2}-[0-9a-f]{4})\b/g)].map(m => m[1]) : [];
  const alleKoepfe = [...s0.matchAll(/^### (.*)$/gm)].map(m => m[1]);
  return { ueberschrift, offen: offen ? offen[1].trim() : null, ids, nichts: !!(offen && /^nichts\b/i.test(offen[1].trim())), nichtGeprueft: np ? np[1].trim() : null, alleKoepfe };
}

// ── Schreiben. Alles oder nichts.
function ablage(dir, id, name) { const d = path.join(dir, id.slice(0, 7)); fs.mkdirSync(d, { recursive: true }); return path.join(d, name); }
// Datum und Zeit in UTC: zwei Sitzungen in verschiedenen Zeitzonen ordnen sich sonst falsch.
export function heute() { const iso = new Date().toISOString(); return { datum: iso.slice(0, 10), zeit: iso.slice(11, 19) }; }
export function einspielen(wurzel, roh, opts) {
  opts = opts || {};
  const brett = brettLesen(wurzel, { alleRefs: opts.alleRefs !== false });
  const belegt = new Set(brett.eintraege.map(e => e.id));
  const jetzt = heute(), datum = opts.datum || jetzt.datum;
  const fehler = [], fertig = [], proSchluessel = new Map(), auswaerts = [];
  if (!Array.isArray(roh) || !roh.length) return { ok: false, fehler: [{ wo: 'Eingabe', grund: 'erwartet wird eine nicht-leere Liste von Eintraegen' }], geschrieben: [], auswaerts: [] };
  roh.forEach((r, i) => {
    const wo = 'Eintrag ' + (i + 1);
    if (!r || typeof r !== 'object' || Array.isArray(r)) { fehler.push({ wo, grund: 'kein JSON-Objekt' }); return; }
    const e = Object.assign({}, r);
    if (!e.datum) e.datum = datum;
    if (!e.zeit) e.zeit = opts.zeit || jetzt.zeit;
    if (!e.von && opts.von) e.von = opts.von;
    if (e.id) fehler.push({ wo, grund: 'eine id vergibt das Werkzeug — ein Eintrag wird nicht umgeschrieben' });
    else {
      for (let n = 0; n < 50 && !e.id; n++) { const id = (datumGueltig(e.datum) ? e.datum : datum) + '-' + crypto.randomBytes(2).toString('hex'); if (!belegt.has(id)) e.id = id; }
      belegt.add(e.id);
    }
    if (e.schluessel != null) {
      if (proSchluessel.has(e.schluessel)) fehler.push({ wo, grund: 'schluessel „' + e.schluessel + '" doppelt im Stapel' });
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
      // Das Ziel liegt nur auf einem anderen Branch: der Bezug sagt es (`ref`). Der Pruefstand
      // sieht nur den Arbeitsbaum — ohne die Angabe waere es dort ein Bezug ins Leere, und das
      // Ziel herueberzukopieren hiesse, den Code EINES ANDEREN Baums gegen diesen zu messen.
      const fremd = b && brett.eintraege.find(x => x.id === b.id);
      if (fremd && !imBaum(fremd)) { if (!auswaerts.some(a => a.id === fremd.id)) auswaerts.push({ id: fremd.id, quelle: fremd._quelle, titel: fremd.titel }); return Object.assign({}, b, { ref: fremd._quelle }); }
      return b;
    });
    delete e.schluessel;
  });
  const alle = brett.eintraege.concat(fertig), proId = new Map(alle.map(e => [e.id, e]));
  const liesRoh = (rel) => { try { return fs.readFileSync(path.join(wurzel, rel), 'utf8'); } catch (_) { return null; } };
  const liesRel = leser(liesRoh);
  const abl = ableiten(alle);
  fertig.forEach((e, i) => {
    const wo = 'Eintrag ' + (i + 1) + ' (' + String(e.titel || '?').slice(0, 50) + ')';
    for (const g of eintragPruefen(e)) fehler.push({ wo, grund: g });
    for (const b of alsListe(e.bezug)) if (b && ID_FORM.test(String(b.id || '')) && !proId.has(b.id)) fehler.push({ wo, grund: 'Bezug auf ' + b.id + ' — den Eintrag gibt es nicht (auch auf keinem Branch, den git kennt)' });
    for (const g of bezugsRegeln(e, proId)) fehler.push({ wo, grund: g });
    // Dieselben Messungen, die der Pruefstand faehrt: was hier durchgeht, nimmt er an.
    for (const a of alsListe(e.anker)) { if (!a || typeof a.text !== 'string') continue; const t = liesRel(a.datei); if (t == null) fehler.push({ wo, grund: 'anker: ' + a.datei + ' ist nicht lesbar' }); else if (t.indexOf(a.text) < 0) fehler.push({ wo, grund: 'anker: „' + a.text.slice(0, 60) + '" steht nicht woertlich in ' + a.datei + ' (mit grep -F pruefen; Kommentarzeilen und der Changelog zaehlen nicht)' }); }
    for (const z of alsListe(e.zaehle)) { if (!z || typeof z.text !== 'string') continue; const ist = wieOft(liesRel(z.datei), z.text); if (ist == null) fehler.push({ wo, grund: 'zaehle: ' + z.datei + ' ist nicht lesbar' }); else if (ist !== z.n) fehler.push({ wo, grund: 'zaehle: „' + z.text.slice(0, 60) + '" steht ' + ist + '-mal in ' + z.datei + ', nicht ' + z.n + '-mal' }); }
    for (const g of waechterPruefen(e.waechter, liesRoh)) fehler.push({ wo, grund: 'waechter: ' + g });
    // „Behoben" ist eine Zaehlung, die sich bewegt hat.
    if (e.art === 'abschluss' && e.ergebnis === 'erledigt') for (const b of alsListe(e.bezug)) {
      const ziel = b && b.art === 'schliesst' && proId.get(b.id);
      if (!ziel || ziel.art !== 'befund' || !imBaum(ziel)) continue;
      const stand = zaehleWirksam(ziel, abl.rueck).map(z => ({ datei: z.datei, text: z.text, n: z.n, heute: wieOft(liesRel(z.datei), z.text) }));
      const neu = stand.filter(z => z.heute != null).map(z => ({ datei: z.datei, text: z.text, n: z.heute }));
      if (stand.length && stand.every(z => z.heute === z.n)) fehler.push({ wo, grund: 'die Zaehlung des Befunds ' + ziel.id + ' steht unveraendert (' + stand.map(z => z.n + '× in ' + z.datei).join(', ') + ') — behoben ist er erst, wenn sie sich bewegt hat' });
      else if (neu.length && !e.zaehle) e.zaehle = neu;   // nie eine leere Liste (die Datei kann ganz weg sein)
    }
  });
  if (fehler.length) return { ok: false, fehler, geschrieben: [], auswaerts: [] };
  const dir = path.join(wurzel, ORDNER), angelegt = [], geschrieben = [];
  try {
    for (const e of fertig) {
      const name = e.id + '-' + e.art + '-' + slug(e.titel) + '.json', geordnet = {};
      for (const k of ['id', 'art', 'datum', 'zeit', 'von', 'stand', 'titel']) if (e[k] != null) geordnet[k] = e[k];
      for (const k of Object.keys(e)) if (!(k in geordnet) && e[k] != null) geordnet[k] = e[k];
      const p = ablage(dir, e.id, name);
      fs.writeFileSync(p, JSON.stringify(geordnet, null, 2) + '\n', { flag: 'wx' }); angelegt.push(p);   // wx: nie ueber eine vorhandene Datei
      geschrieben.push({ id: e.id, datei: path.posix.join(ORDNER, e.id.slice(0, 7), name), art: e.art, titel: e.titel });
    }
  } catch (x) {
    // Alles oder nichts: ein Schreibfehler mitten im Stapel hinterlaesst keinen halben.
    for (const p of angelegt) { try { fs.unlinkSync(p); } catch (_) {} }
    return { ok: false, fehler: [{ wo: 'Schreiben', grund: String(x.message).split('\n')[0] + ' — nichts geschrieben' }], geschrieben: [], auswaerts: [] };
  }
  return { ok: true, fehler: [], geschrieben, auswaerts };
}
// ── Ernten: was nur auf einem anderen Branch liegt, in den Arbeitsbaum holen, damit es
//    mit dem naechsten PR auf main ankommt. Geholt wird WISSEN, das in diesem Baum stimmt:
//    was einen anderen Baum beschreibt („erledigt", ein Nachtrag mit Anker oder Zaehlung,
//    ein Anker auf Code, den es hier nicht gibt), bleibt auf seinem Branch und kommt mit
//    dessen Merge. Danach ist der Arbeitsbaum so gruen wie davor — sonst waere „geerntet" gelogen.
export function ernten(wurzel) {
  const brett = brettLesen(wurzel, { alleRefs: true }), dir = path.join(wurzel, ORDNER);
  const liesRoh = (rel) => { try { return fs.readFileSync(path.join(wurzel, rel), 'utf8'); } catch (_) { return null; } }, liesRel = leser(liesRoh);
  const imTree = new Set(brett.eintraege.filter(imBaum).map(e => e.id)), proId = new Map(brett.eintraege.map(e => [e.id, e]));
  const geholt = [], uebergangen = brett.unlesbar.filter(u => u.quelle !== 'Arbeitsbaum').map(u => ({ id: u.datei, quelle: u.quelle, grund: u.grund }));
  let kand = [];
  for (const e of brett.eintraege) {
    if (imBaum(e)) continue;
    let grund = eintragPruefen(e, e._datei)[0] || bezugsRegeln(e, proId)[0] || null;
    if (!grund && e.art === 'abschluss' && e.ergebnis === 'erledigt') grund = '„erledigt" beschreibt den Baum von ' + e._quelle + ' — es kommt mit dessen Merge, nicht durch Ernten';
    if (!grund && e.art === 'antwort' && (alsListe(e.anker).length || alsListe(e.zaehle).length)) grund = 'ein Nachtrag mit Anker oder Zaehlung beschreibt den Baum von ' + e._quelle;
    if (!grund) for (const a of alsListe(e.anker)) { const t = liesRel(a.datei); if (t == null || t.indexOf(a.text) < 0) { grund = 'sein Anker steht in diesem Baum nicht (' + a.datei + ') — er beschreibt ' + e._quelle; break; } }
    if (!grund) for (const z of alsListe(e.zaehle)) { if (wieOft(liesRel(z.datei), z.text) !== z.n) { grund = 'seine Zaehlung stimmt in diesem Baum nicht (' + z.datei + ') — er beschreibt ' + e._quelle; break; } }
    if (!grund && e.art === 'klasse') { const w = waechterPruefen(e.waechter, liesRoh); if (w.length) grund = 'Waechter: ' + w[0]; }
    if (grund) uebergangen.push({ id: e.id, quelle: e._quelle, grund }); else kand.push(e);
  }
  // Ein Bezug darf nach dem Ernten nicht ins Leere zeigen: sein Ziel liegt im Baum, kommt mit — oder der Bezug nennt seinen Branch.
  for (let weiter = true; weiter;) {
    weiter = false;
    const ids = new Set(kand.map(e => e.id));
    kand = kand.filter(e => {
      const fehlt = alsListe(e.bezug).find(b => !b.ref && !imTree.has(b.id) && !ids.has(b.id));
      if (!fehlt) return true;
      uebergangen.push({ id: e.id, quelle: e._quelle, grund: 'bezieht sich auf ' + fehlt.id + ', der nicht mitkommt' }); weiter = true; return false;
    });
  }
  for (const e of kand) {
    const p = ablage(dir, e.id, e._datei);
    try { fs.writeFileSync(p, e._roh, { flag: 'wx' }); } catch (x) { uebergangen.push({ id: e.id, quelle: e._quelle, grund: 'eine Datei dieses Namens liegt schon im Arbeitsbaum' }); continue; }
    geholt.push({ id: e.id, quelle: e._quelle, datei: path.posix.join(ORDNER, e.id.slice(0, 7), e._datei), titel: e.titel });
  }
  return { geholt, uebergangen, gitDa: brett.gitDa, refs: brett.refs };
}
