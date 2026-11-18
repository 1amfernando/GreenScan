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
import os from 'node:os';

export const ORDNER = 'docs/austausch/eintraege';

// ── Das Vokabular. Die Liste ist die Pruefung.
export const ARTEN = Object.assign(Object.create(null), {
  befund:    { wort: 'Befund',       pflicht: ['beleg'], offenbar: true,  sinn: 'etwas GEMESSENES: ein Fehler, eine Luecke, ein Widerspruch — mit Beleg' },
  idee:      { wort: 'Idee',         pflicht: ['nutzen', 'pruefbar'], offenbar: true, sinn: 'ein Vorschlag, der noch keinen Meilenstein verdient — mit Nutzen und woran man ihn pruefen koennte' },
  frage:     { wort: 'Frage',        pflicht: ['an'], offenbar: true,     sinn: 'was die schreibende Sitzung nicht messen oder entscheiden konnte' },
  klasse:    { wort: 'Fehlerklasse', pflicht: ['regel', 'instanzen'], offenbar: true, sinn: 'ein Fehler-MUSTER: Regel, Instanzen, Suchmuster fuer Geschwister, der Pruefstand-Fall, der es bewacht' },
  antwort:   { wort: 'Antwort',      pflicht: [], offenbar: false, brauchtBezug: ['beantwortet', 'baut_auf', 'widerspricht'], sinn: 'Antwort, Ergaenzung, Widerspruch oder Nachtrag (neuer Anker, neue Zaehlung, „gesucht") zu einem Eintrag' },
  abschluss: { wort: 'Abschluss',    pflicht: ['ergebnis'], offenbar: false, brauchtBezug: ['schliesst'], sinn: 'schliesst einen Eintrag: erledigt (wohin) · verworfen (Grund) · aufgestiegen (wohin) · aufgehoben (ein Halt, mit Grund)' },
  // ── Seit 18.11.2026 (Fernando: Fortschrittskontrolle, Halt und Veto). Beide tragen eine FRIST
  //    (`bis`), relativ zum eigenen Zeitstempel geprueft; ob sie JETZT wirken, rechnet nur das
  //    Werkzeug (`wirksam`), nie der Pruefstand — sonst haenge ein Fall an der Uhr.
  lage:      { wort: 'Lage',         pflicht: ['phase', 'bis'], offenbar: false, bedingt: 'bezug baut_auf:<id> nur bei einer Uebernahme (hoechstens 3); „fertig" gibt sie frei — ohne Bezug alle, mit Bezug genau diese', sinn: 'woran eine Sitzung gerade arbeitet und bis wann: Phase (laeuft · letzte_runde · fertig), optional Runde „4/5"; mit Bezug baut_auf:<id> nimmt sie diesen Eintrag (Uebernahme)' },
  halt:      { wort: 'Halt',         pflicht: ['text', 'bis'], offenbar: false, bedingt: 'geltung (Pfade, Funktionsnamen aus index.html, bump; nicht STATUS.md, nicht index.html als Ganzes) — ausser beim Veto (bezug widerspricht:<id>)', sinn: 'ein Halt fuer den Schwarm: Grund, Geltung (Pfade, Funktionsnamen, bump) und Frist; mit Bezug widerspricht:<id> ein VETO gegen diesen Eintrag. Eine Pflicht zur Kenntnisnahme, keine Sperre' },
});
export const BEZUEGE = Object.assign(Object.create(null), {
  baut_auf:     'nimmt den anderen Eintrag als Grundlage — so entsteht aus zwei Koepfen eine Idee',
  widerspricht: 'haelt den anderen Eintrag fuer falsch oder unvollstaendig, mit Beleg',
  beantwortet:  'beantwortet eine Frage',
  schliesst:    'der andere Eintrag ist erledigt, verworfen oder aufgestiegen (nur ein Abschluss schliesst)',
  ersetzt:      'der andere Eintrag DERSELBEN Art ist ueberholt; dieser gilt an seiner Stelle',
  gehoert_zu:   'ist eine Instanz dieser Fehlerklasse',
});
export const ERGEBNISSE = ['erledigt', 'verworfen', 'aufgestiegen', 'aufgehoben'];
export const AN = ['alle', 'fernando', 'koordinator'];
// `sitzung/<branch>`: der Branch-Name so, wie `git check-ref-format --branch` ihn annimmt (gemessen 18.11.2026:
// „claude/fix+v2.1@team", „claude/fix(2)" und 300 Zeichen gehen dort — die alte Form [A-Za-z0-9._/+-]{1,120}
// wies sie ab, solche Sitzungen waren nicht adressierbar). Nicht: Steuer- und Leerzeichen, ~ ^ : ? * [ \, „..",
// „@{", „//", / am Anfang oder Ende, . am Ende, eine Komponente, die mit . beginnt oder auf .lock endet, - am
// Anfang, „HEAD" oder „@" allein. Strenger als git, mit Absicht: kein Format- oder Trennzeichen aus Unicode
// (U+202E dreht die Anzeige um, U+00A0 sieht aus wie ein Leerzeichen — git nimmt beide) und hoechstens 255
// Zeichen ({1,255}). `an` wird nur angezeigt und verglichen, nie als Befehl gedruckt.
export const AN_SITZUNG = /^sitzung\/(?![-/.])(?!(?:HEAD|@)$)(?!.*\/\.)(?!.*\.\.)(?!.*@\{)(?!.*\/\/)(?!.*\/$)(?!.*\.$)(?!.*\.lock(?:\/|$))[^\p{C}\p{Z}\s~^:?*[\\]{1,255}$/u;
export function anGueltig(a) { return AN.indexOf(a) >= 0 || (typeof a === 'string' && AN_SITZUNG.test(a)); }
export const DRINGLICHKEIT = ['kritisch', 'dringend'];
export const PHASEN = ['laeuft', 'letzte_runde', 'fertig'];
// Hoechstdauer je Art (ab dem eigenen Zeitstempel): eine Lage ist ein Arbeitsschub, ein Halt
// eine Atempause — beides endet von selbst, auch wenn die Sitzung nie wiederkommt.
export const FRIST_MAX_H = { lage: 24, halt: 72 };
export const LAGE_NIMMT_MAX = 3;
const LISTENFELDER = ['beleg', 'stichworte', 'instanzen', 'geltung'];
const TEXTFELDER = ['titel', 'text', 'von', 'rolle', 'stand', 'zeit', 'nutzen', 'pruefbar', 'an', 'haengt_daran', 'vorschlag', 'regel', 'suchmuster',
  'gesucht', 'ohne_waechter', 'ergebnis', 'wohin', 'geschwister', 'bewacht', 'details_bei', 'dringlichkeit', 'bis', 'phase', 'runde'];
const BEKANNT = new Set(['id', 'art', 'datum', 'bezug', 'waechter', 'anker', 'zaehle', 'sicherheit', 'schluessel', 'geliefert', 'mithelfen'].concat(LISTENFELDER, TEXTFELDER));
export const FELDER = [...BEKANNT];
const SICHERHEIT_NICHT = ['text', 'beleg', 'vorschlag', 'anker', 'zaehle', 'haengt_daran', 'nutzen', 'pruefbar', 'regel', 'instanzen', 'suchmuster', 'gesucht', 'geschwister', 'bewacht', 'waechter', 'ohne_waechter', 'wohin', 'geliefert'];
export const GEHEIM_FORMEN = () => GEHEIM.length;
export const TITEL_MAX = 200, STUECK_MIN = 8, STUECK_MAX = 300;
// Vier Hexstellen bis 17.11.2026, acht seither: am 11.11. entstanden 131 Eintraege an EINEM Tag —
// bei 4 Stellen 12 % Wahrscheinlichkeit, dass zwei Sitzungen ohne Abgleich dieselbe id ziehen.
export const ID_FORM = /^\d{4}-\d{2}-\d{2}-[0-9a-f]{4}(?:[0-9a-f]{4})?$/;
export const BIS_FORM = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
// Grabsteine: was bewusst vom Brett genommen wurde (Personenname, Geheimnis, falscher Inhalt) — nur
// id, Datum, Grund, NIE der Inhalt. Ohne diese Liste holte die Vereinigung den Eintrag von jedem
// aelteren Branch zurueck (`ernten`, nachgestellt 17.11.2026), und die Sicherung haette ihn verewigt.
export const GRABSTEINE = 'docs/austausch/zurueckgezogen.json';
// Die Sicherung des Waechters: ein Branch mit Z-Praefix. Er sortiert hinter allen anderen und wird
// deshalb nur gelesen, wo kein Original mehr liegt (brettLesen liest main zuerst, dann alphabetisch).
export const SICHERUNG_ZWEIG = 'zz-sicherung';
// Das EINE Remote, gegen das gemessen wird: dorthin pusht und von dort holt das Werkzeug, dort laeuft der Waechter.
export const REMOTE = 'origin';
// Genau DIESER eine Ref — nicht jeder Name mit „zz-“ (claude/zz-kalender-aufraeumen ist ein Arbeitszweig).
// Genau EIN Ref: origin/zz-sicherung. Vorher galt jeder Branch, dessen Name auf „/zz-sicherung" endet
// (claude/zz-sicherung), als die Sicherung — seine Eintraege wurden nie gesichert (Gegenpruefung 2); und
// jedes Remote (fork/zz-sicherung) — ein zweites Remote ist fremde Eingabe (Gegenpruefung 3).
export const istSicherungsRef = (ref) => new RegExp('^(refs/remotes/)?' + REMOTE + '/' + SICHERUNG_ZWEIG + '$').test(String(ref || ''));
// main ist GENAU origin/main. Vorher galt jeder Ref, der auf „/main" endet: ein pushbarer Branch
// „claude/main" (oder fork/main) trug dann Faelschungen, die fuer alle Leser galten — ein Halt im
// fremden Namen wirkte, ein „ersetzt" versteckte einen kritischen Befund (Gegenpruefung 3).
export const istMainRef = (ref) => new RegExp('^(refs/remotes/)?' + REMOTE + '/main$').test(String(ref || ''));
// Der Branch des Schreibers als Ref: origin/<b> — nie derselbe Name auf einem anderen Remote, und NIE die Sicherung:
// ein Eintrag mit `von: sitzung/zz-sicherung` waere sonst, sobald der Waechter ihn kopiert hat, „von seinem Branch".
export const istAutorRef = (ref, b) => !!b && !istSicherungsRef(ref) && String(ref || '') === REMOTE + '/' + b;
export const FASSUNGEN = 'docs/austausch/fassungen';
// Groesser ist kein Eintrag (der groesste vom 18.11.2026 hat 7 KB) — und eine 600-KB-Datei auf einem
// fremden Branch legte `holen` fuer drei Minuten lahm (Gegenpruefung: quadratische Suche).
export const EINTRAG_MAX_BYTES = 64 * 1024;
export const NAME_FORM = /^(\d{4}-\d{2}-\d{2}-[0-9a-f]{4}(?:[0-9a-f]{4})?)-([a-z]+)-([a-z0-9-]*)\.json$/;
export const BRETT_ZITAT = /\bbrett:(\d{4}-\d{2}-\d{2}-[0-9a-f]{4}(?:[0-9a-f]{4})?)\b/g;
export function zitierteIds(text) { return new Set([...String(text || '').matchAll(BRETT_ZITAT)].map(m => m[1])); }
// Wo Fernando liest: STATUS.md §2 und docs/FUER-FERNANDO.md — nicht der Rest von STATUS.md.
export function fernandoText(statusText, fuerFernandoText) {
  const st = String(statusText || ''), a2 = st.indexOf('\n## 2 '), e2 = a2 < 0 ? -1 : st.indexOf('\n## ', a2 + 5);
  return (a2 < 0 ? '' : st.slice(a2, e2 < 0 ? undefined : e2)) + '\n' + String(fuerFernandoText || '');
}
// Kritisch erreicht Fernando: EINE Rechnung fuer den Pruefstand (A7, C11) und fuers Ernten.
export function kritischOhneZitat(eintraege, wo) {
  const abl = ableiten(eintraege), ids = zitierteIds(wo);
  const kritisch = eintraege.filter(e => e.dringlichkeit === 'kritisch' && abl.zustand.get(e.id).z === 'offen');
  return { kritisch, ohne: kritisch.filter(e => !ids.has(e.id)) };
}
// Namen, die wie App-Code aussehen — dieselbe Form, die robust_check „Memory" prueft.
export const APP_NAME = /^(_?gs[A-Z]|dq[A-Z]|sb[A-Z]|GS_[A-Z]|_gs[a-z])[\w]*$/;

// ── Was in einem PUBLIC Repo nicht stehen darf: FORMEN bekannter Geheimnisse.
const GEHEIM = [
  [/sk-ant-[A-Za-z0-9_-]{8,}/, 'ein Anthropic-Schluessel'],
  // Begrenzt: unbegrenzt sprang das Muster auf 60 KB „eyJ-eyJ-…" quadratisch zurueck (1,1 s je Eintrag,
  // zehn solche Eintraege legten `holen` 20 s lahm — Gegenpruefung 2). Ein echter Kopf hat rund 36 Zeichen.
  [/\beyJ[A-Za-z0-9_-]{8,512}\.[A-Za-z0-9_-]{8,4096}\.[A-Za-z0-9_-]{4}/, 'ein JWT'],
  [/\b(?:sk|rk)_live_[A-Za-z0-9]{8,}/, 'ein Stripe-Schluessel'],
  [/\bwhsec_[A-Za-z0-9]{8,}/, 'ein Webhook-Geheimnis'],
  [/\bsb_secret_[A-Za-z0-9_-]{8,}/, 'ein Supabase-Geheimnis'],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/, 'ein GitHub-Token'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'ein privater Schluessel'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, 'eine UUID (eine Nutzer- oder Datensatz-Kennung aus der Datenbank?)'],
  // Begrenzte Wiederholungen: mit „+" suchte das Muster in einem langen Text ohne @ quadratisch (600 KB: 3 min).
  [/[A-Za-z0-9._%+-]{1,64}@(?!users\.noreply\.github\.com|example\.(?:com|org)|anthropic\.com|greenscan\.ch)[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,8}\.[A-Za-z]{2,24}/, 'eine E-Mail-Adresse'],
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
// Ein GELIEFERTER Pfad kommt aus fremder Hand und wird als Befehl gedruckt (`git show <commit>:<pfad>`): er darf
// nur aussehen wie ein Repo-Pfad. Vorher reichte imRepo — `docs/mess.md$(touch X)` war gueltig, und wer den
// gedruckten Befehl fuhr, fuhr das `touch` mit (Gegenpruefung 3). Gemessen 18.11.2026: alle 710 Dateien des Repos
// bestehen aus [A-Za-z0-9._/-]; Umlaute sind zugelassen (ein Halt nimmt sie auch). Nie: $ ` ; | & < > ( ) ' " \,
// Leerraum, Steuerzeichen, ein Segment, das leer ist, „." oder „.." heisst oder mit - beginnt.
export const LIEFER_PFAD_MAX = 255;
export function lieferPfadOk(p) {
  if (typeof p !== 'string' || !p || p.length > LIEFER_PFAD_MAX || !/^[\p{L}\p{M}\p{N}._\/-]+$/u.test(p)) return false;
  return p.split('/').every(t => t && t !== '.' && t !== '..' && t[0] !== '-');
}
export const COMMIT_FORM = /^[0-9a-f]{40}$/;
// Die Reihenfolge zweier Eintraege: Datum, dann die Uhrzeit, die das Werkzeug
// setzt, dann die id. (Die id allein ist am selben Tag Zufall.)
export function ordnung(e) { return String(e.datum || '') + 'T' + String(e.zeit || '00:00:00') + ' ' + String(e.id || ''); }

// Der Zeitstempel eines Eintrags in ms (UTC) — oder null, wenn er keine Uhrzeit traegt.
export function zeitpunkt(e) { if (!e || !datumGueltig(e.datum) || !/^\d{2}:\d{2}:\d{2}$/.test(String(e.zeit || ''))) return null; const t = Date.parse(e.datum + 'T' + e.zeit + 'Z'); return isNaN(t) ? null : t; }
// Was ein Halt anhalten darf: einen Pfad (Datei oder Verzeichnis mit /), einen Funktionsnamen oder
// `bump` (keine neue Version). Kein `*`: ein Halt fuer alles, gesetzt von einer fluechtigen Sitzung,
// haelt den ganzen Schwarm an, und niemand ist da, der ihn aufhebt.
export function geltungNorm(g) { return String(g == null ? '' : g).trim().replace(/^(\.\/)+/, '').replace(/\/{2,}/g, '/'); }
// Dateien, die (fast) jede Sitzung anfasst: eine Geltung darauf wirkt wie * (gemessen 17.11.2026:
// von 16 frischen Branches aendern 12 STATUS.md und 12 index.html). Fuer die App: Funktionsnamen.
export const ZU_BREIT = {
  'STATUS.md': 'jede Sitzung schreibt dort ihren Eintrag (CLAUDE.md §5) — das wirkt wie *',
  'index.html': 'die App als Ganzes wirkt wie * — Funktionsnamen nennen (z.B. gsEscHtml, _gsArtAnzeige)',
};
export function geltungFehler(g0) {
  const g = geltungNorm(g0);
  if (!g) return String(g0 == null ? '' : g0).trim() ? 'das ist das ganze Repo — wie *' : 'leer';
  if (g === 'bump') return null;
  if (/[*?]/.test(g)) return 'kein Platzhalter (* oder ?) — einen Pfad, einen Funktionsnamen oder bump nennen';
  if (g === '.' || g === '/' || /(^|\/)\.{1,2}(\/|$)/.test(g)) return 'das ist das ganze Repo oder ein Weg hinaus — wie *';
  const b = g.replace(/\/+$/, '');
  if (ZU_BREIT[b]) return ZU_BREIT[b];
  if (/:/.test(g)) return 'eine Funktion nennt man ohne Datei (gsKalenderEreignisse, nicht index.html:gsKalenderEreignisse) — Funktionsnamen gelten fuer index.html';
  if (/^[A-Za-z_$][\w$]*$/.test(g)) return null;   // ein Funktionsname ODER eine Datei ohne Punkt (_headers)
  if (imRepo(g) && /[/.]/.test(g)) return null;
  return 'weder bump noch ein Pfad im Repo noch ein Funktionsname';
}
// Gibt es, was eine Geltung nennt — eine Funktion in index.html, eine Datei oder ein Ordner im Baum?
// EINE Regel fuer `halt` und `einspielen` (vorher galt sie nur am CLI und nur fuer Namen ohne Punkt:
// `scripts/kalendr_check.js` wurde angenommen und traf nie — Gegenpruefung 2). Eine Funktion „gibt es",
// wenn sie einen BEREICH hat — dieselbe Rechnung, mit der der Abgleich (funktionenAusDiff) sie trifft. Eine
// Deklaration ohne Bereich (in einem Kommentar, in einem Skript, das der Scanner nicht als Skript liest) traefe
// nie und wird mit diesem Grund abgewiesen (Runde 3: `halt` nahm sie an, der Abgleich traf sie nie).
export function geltungImBaum(wurzel, liste) {
  const fehler = [];
  let fn = null, dekl = null, dateien = null;
  for (const g0 of alsListe(liste)) {
    const g = geltungNorm(g0);
    if (g === 'bump' || geltungFehler(g)) continue;   // die Form meldet eintragPruefen
    if (!fn) {
      let t = null; try { t = fs.readFileSync(path.join(wurzel, 'index.html'), 'utf8'); } catch (_) {}
      fn = new Set(funktionsBereiche(t || '').bereiche.map(x => x.name)); dekl = funktionsNamen(t || '');
      dateien = new Set(((git(wurzel, ['ls-files']) || '') + '\n' + (git(wurzel, ['ls-files', '--others', '--exclude-standard']) || '')).split('\n').map(x => x.trim()).filter(Boolean));
    }
    const pre = g.replace(/\/+$/, ''), istName = /^[A-Za-z_$][\w$]*$/.test(g);
    if ((istName && fn.has(g)) || dateien.has(pre) || [...dateien].some(d => d.indexOf(pre + '/') === 0)) continue;
    const ohneBereich = istName && dekl.has(g);
    fehler.push('geltung „' + g0 + '": ' + (ohneBereich ? 'steht in index.html als Deklaration, hat aber keine bestimmbaren Grenzen (in einem Kommentar oder in keinem Skript, das der Scanner liest — ' + [...dekl].filter(x => !fn.has(x)).length + ' von ' + dekl.size + ' Deklarationen ohne Bereich)' : istName ? 'weder eine Funktion in index.html noch eine Datei oder ein Ordner im Baum' : 'diesen Pfad gibt es im Baum nicht (Tippfehler?)') + ' — der Halt traefe nie. Eine Datei in einem Ordner: mit Pfad (scripts/x_check.js).');
  }
  return fehler;
}
export function idAusName(name) { const m = String(name || '').match(/^(\d{4}-\d{2}-\d{2}-[0-9a-f]{4}(?:[0-9a-f]{4})?)-/); return m ? m[1] : null; }

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
  else if (e.zeit != null && datumGueltig(e.datum) && zeitpunkt(e) == null) f.push('zeit ist keine Uhrzeit (' + e.zeit + ')');
  if (typeof e.von !== 'string' || !e.von.trim()) f.push('von fehlt (wer schreibt: Sitzung/Branch/Rolle — kein Personenname)');
  // Die Rolle eines Unteragenten (Austausch-Runde): `von` ist die Sitzung, die die Runde fuhr.
  if (e.rolle != null && !/^runde\/[A-Za-z0-9_-]{1,60}$/.test(String(e.rolle))) f.push('rolle hat die Form runde/<blickwinkel>');
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
  if (e.an != null && !anGueltig(e.an)) f.push('an: ' + AN.join(' · ') + ' oder sitzung/<branch>');
  if (e.an != null && ['frage', 'befund', 'idee', 'halt'].indexOf(e.art) < 0) f.push('an gehoert an eine Frage, einen Befund, eine Idee oder einen Halt');
  if (e.art === 'abschluss') {
    if (e.ergebnis != null && ERGEBNISSE.indexOf(e.ergebnis) < 0) f.push('ergebnis: ' + ERGEBNISSE.join(' · '));
    if (e.ergebnis === 'verworfen' && !(e.text && e.text.trim())) f.push('verworfen ohne Grund (text)');
    if ((e.ergebnis === 'erledigt' || e.ergebnis === 'aufgestiegen') && !(e.wohin && e.wohin.trim())) f.push(e.ergebnis + ' ohne „wohin" (Version, Commit oder Dokument-Stelle)');
  }
  if (e.art === 'abschluss' && e.ergebnis === 'aufgehoben' && !(e.text && e.text.trim())) f.push('aufgehoben ohne Grund (text) — wer einen Halt aufhebt, sagt warum; der Aussteller liest es');
  // ── Dringlichkeit, Frist, Lage, Halt, Lieferung (seit 18.11.2026).
  if (e.dringlichkeit != null) {
    if (DRINGLICHKEIT.indexOf(e.dringlichkeit) < 0) f.push('dringlichkeit: ' + DRINGLICHKEIT.join(' oder ') + ' (normal ist: keine Angabe)');
    if (['befund', 'frage', 'halt'].indexOf(e.art) < 0) f.push('dringlichkeit gehoert an einen Befund, eine Frage oder einen Halt');
    // Kein eigenes Grund-Feld: bei einem Sicherheitsbefund waere es ein Kanal fuer den Weg. Der Grund
    // steht, wo er schon steht — im Beleg des Befunds, bei der Frage in haengt_daran.
    if (e.art === 'frage' && e.sicherheit !== true && !(e.haengt_daran && String(e.haengt_daran).trim())) f.push('eine dringliche Frage sagt in „haengt_daran", was daran haengt');
  }
  if (e.bis != null || e.art === 'lage' || e.art === 'halt') {
    if (e.art !== 'lage' && e.art !== 'halt') f.push('bis gehoert an eine Lage oder einen Halt');
    else {
      if (e.zeit == null) f.push(ARTEN[e.art].wort + ' braucht „zeit" — die Frist rechnet ab dem eigenen Zeitstempel');
      if (!BIS_FORM.test(String(e.bis || ''))) f.push('bis hat nicht die Form JJJJ-MM-TTTHH:MM:SSZ (UTC, mit Z)');
      else if (isNaN(Date.parse(e.bis)) || new Date(Date.parse(e.bis)).toISOString().slice(0, 19) + 'Z' !== e.bis) f.push('bis ist kein Zeitpunkt (' + e.bis + ')');
      else {
        const t0 = zeitpunkt(e), t1 = Date.parse(e.bis);
        // Relativ zum EIGENEN Zeitstempel, nie zu „jetzt": sonst haenge der Pruefstand an der Uhr.
        if (t0 != null && !isNaN(t1)) {
          const h = (t1 - t0) / 36e5;
          if (h <= 0) f.push('bis liegt nicht nach dem eigenen Zeitstempel');
          else if (h > FRIST_MAX_H[e.art]) f.push('bis liegt ' + Math.round(h) + ' h nach dem eigenen Zeitstempel — hoechstens ' + FRIST_MAX_H[e.art] + ' h: ' + ARTEN[e.art].wort + ' endet von selbst, auch wenn niemand zurueckkommt');
        }
      }
    }
  }
  for (const [k, arten] of [['phase', ['lage']], ['runde', ['lage']], ['geltung', ['halt']], ['geliefert', ['antwort']]]) if (e[k] != null && arten.indexOf(e.art) < 0) f.push(k + ' gehoert an: ' + arten.map(a => ARTEN[a].wort).join(' / '));
  if (e.phase != null && PHASEN.indexOf(e.phase) < 0) f.push('phase: ' + PHASEN.join(' · '));
  if (e.runde != null && !/^\d{1,3}(\/\d{1,3})?$/.test(String(e.runde))) f.push('runde hat die Form „4" oder „4/5"');
  if (e.art === 'lage' && alsListe(e.bezug).filter(b => b && b.art === 'baut_auf').length > LAGE_NIMMT_MAX) f.push('eine Lage nimmt hoechstens ' + LAGE_NIMMT_MAX + ' Eintraege — wer mehr nimmt, haelt sie fest, ohne daran zu arbeiten');
  // Mithelfen ist eine ABSICHT, kein Titel (Gegenpruefung 3: der Praefix „Mithelfen: " entschied — ein eigener
  // Titel gab bei jedem Lesen einen Fehlalarm, der Praefix allein verschluckte eine echte Warnung).
  if (e.mithelfen != null) {
    if (e.mithelfen !== true) f.push('mithelfen ist true oder fehlt');
    if (e.art !== 'lage' || e.phase === 'fertig' || !alsListe(e.bezug).some(b => b && b.art === 'baut_auf')) f.push('mithelfen gehoert an eine Lage mit baut_auf:<id>, die nicht „fertig" ist (nehme <id> --auch)');
  }
  if ((e.art === 'lage' || e.art === 'halt') && alsListe(e.bezug).some(b => b && b.art === 'ersetzt')) f.push(ARTEN[e.art].wort + ' traegt kein „ersetzt" — ' + (e.art === 'halt' ? 'ein Halt wird mit Grund aufgehoben (aufheben <id>)' : 'eine Lage endet mit --phase fertig'));
  if (e.art === 'halt') {
    const veto = alsListe(e.bezug).some(b => b && b.art === 'widerspricht');
    if (!veto && !alsListe(e.geltung).length) f.push('ein Halt ohne Bezug widerspricht:<id> (Veto) braucht „geltung": Pfade, Funktionsnamen oder bump');
    // Beides zugleich galt nur als Veto, die Geltung (auch bump) wirkte still nicht (Gegenpruefung 2).
    if (veto && alsListe(e.geltung).length) f.push('ein Veto (widerspricht:<id>) traegt keine „geltung" — Halt und Veto sind zwei Eintraege (halt --geltung … und veto <id>)');
    for (const g of alsListe(e.geltung)) { const w = geltungFehler(g); if (w) f.push('geltung „' + g + '": ' + w); }
  }
  if (e.geliefert != null) {
    if (!Array.isArray(e.geliefert) || !e.geliefert.length) f.push('geliefert muss eine nicht-leere Liste von {pfad, commit} sein');
    else e.geliefert.forEach((x, i) => { if (!x || !lieferPfadOk(x.pfad) || !COMMIT_FORM.test(String(x.commit || ''))) f.push('geliefert[' + i + ']: {pfad, commit} — ein Pfad im Repo (Buchstaben, Ziffern, . _ - /: kein Shell-Zeichen, kein Leerraum, kein ..) und die volle Commit-Kennung (40 Zeichen): jeder kann `git show <commit>:<pfad>` fahren'); });
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
  // Gesucht wird auch im ROHEN Text und im Dateinamen: bei doppelten JSON-Schluesseln behaelt
  // JSON.parse nur den letzten Wert — das Geheimnis im ersten stand sonst unbemerkt in der Datei.
  const roh = textVon(e) + '\n' + (e._roh || '') + '\n' + (e._datei || dateiname || '');
  for (const [re, was] of GEHEIM) if (re.test(roh)) f.push('enthaelt etwas, das wie ' + was + ' aussieht — das Repo ist public');
  // Ein Beleg, den niemand nachfahren kann, ist keiner: Pfade aus dem Arbeitsverzeichnis EINER Sitzung.
  if (/(^|[\s"'`(=:])\/(tmp|root|home|Users|var\/folders)\//.test(roh)) f.push('nennt einen Pfad, der nur auf einer Maschine stimmt (/tmp, /root, /home …) — Belege nennen Pfade im Repo oder den Befehl mit seiner Zahl');
  return f;
}

// ── Lesen. Arbeitsbaum zuerst, dann (auf Wunsch) jeder Remote-Ref.
export function git(wurzel, args, opts) {
  // core.quotePath=false: sonst kommt ein Pfad mit Umlaut als „"docs/pl\303\244ne/x.md"" an, und kein Halt
  // auf docs/pläne/ traefe ihn je (Gegenpruefung 2).
  // opts.frist (ms): ein Abruf haengt, solange der Remote haengt (Gegenpruefung 3: `naechste` wartete 20 s auf
  // `ext::sh -c sleep 20`) — nach der Frist wird git beendet (SIGTERM: git raeumt seine .lock-Dateien selbst),
  // die Antwort ist null wie bei jedem Fehler. Dazu GIT_TERMINAL_PROMPT=0: eine Passwortfrage waere dasselbe Haengen.
  const o = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 };
  if (opts && opts.frist > 0) Object.assign(o, { timeout: opts.frist, env: Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: '0' }) });
  try { return cp.execFileSync('git', ['-C', wurzel, '-c', 'core.quotePath=false'].concat(args), o); }
  catch (_) { return null; }
}
// ── Blobs lesen, OHNE nachzuladen. In einem Teilabruf (CI: promisor, --filter=blob:limit=200k) fehlt ein
//    grosser Blob im lokalen Objektspeicher. Gemessen am 18.11.2026 (git 2.43.0-1ubuntu7.4, gebauter Klon):
//    `cat-file --batch` und `--batch-check` laden einen fehlenden Promisor-Blob STILL nach (ein neues Pack je
//    Blob); scheitert das, endet der Prozess mit 128, und alles, was in der Eingabe danach kam, fehlte in der
//    Ausgabe — ein einziger fehlender Blob liess ALLE fremden Eintraege verschwinden (Gegenpruefung 3).
//    GIT_NO_LAZY_FETCH=1 kennt diese Version (aus den Sicherheits-Nachtraegen): sie laedt nicht nach, bricht
//    aber an dem fehlenden Blob trotzdem mit 128 ab. Deshalb drei Schichten:
//      1. Wer die Baeume kennt, gibt sie mit: `rev-list --objects --missing=print` nennt fehlende Objekte als
//         „?<oid>" und laedt NIE nach — auch auf einem git, das GIT_NO_LAZY_FETCH nicht kennt.
//      2. cat-file laeuft mit GIT_NO_LAZY_FETCH=1.
//      3. Endet cat-file vorzeitig, ist der erste unbeantwortete Blob der fehlende; der Rest wird neu gelesen.
//    Gelesen wird, was git LOKAL hat (README „Lesen": ohne `holen` liest der Befehl, was git lokal kennt) —
//    ein Lesen ohne Netz. Was fehlt, steht in `.fehlt` (Liste der oids) und wird vom Aufrufer GENANNT.
const LESEN_MAX = 1024 * 1024 * 1024;
const ohneNachladen = () => Object.assign({}, process.env, { GIT_NO_LAZY_FETCH: '1' });
function objekteLesen(wurzel, shas, inhalt, baeume) {
  const aus = new Map(); aus.fehlt = [];
  let rest = [...new Set((shas || []).filter(Boolean))];
  if (!rest.length) return aus;
  const env = ohneNachladen();
  if (baeume && baeume.length) {
    let r = null;
    try { r = cp.spawnSync('git', ['-C', wurzel, 'rev-list', '--objects', '--missing=print', '--stdin'], { input: [...new Set(baeume)].join('\n') + '\n', env, maxBuffer: LESEN_MAX }); } catch (_) {}
    if (r && r.status === 0 && r.stdout) {
      const fehlt = new Set(), da = new Set();
      for (const z of String(r.stdout).split('\n')) { const m = z.match(/^(\?)?([0-9a-f]{40,64})\b/); if (m) (m[1] ? fehlt : da).add(m[2]); }
      rest = rest.filter(s => { if (fehlt.has(s)) { aus.fehlt.push(s); return false; } return true; });
      // Nur die Groesse gefragt: was rev-list gesehen hat, ist da — kein cat-file noetig.
      if (!inhalt) rest = rest.filter(s => { if (da.has(s)) { aus.set(s, true); return false; } return true; });
    }
    // rev-list gescheitert (ein Baum unbekannt): dann entscheiden die Schichten 2 und 3.
  }
  while (rest.length) {
    let r = null;
    try { r = cp.spawnSync('git', ['-C', wurzel, 'cat-file', inhalt ? '--batch' : '--batch-check'], { input: rest.join('\n') + '\n', env, maxBuffer: LESEN_MAX }); } catch (_) {}
    if (!r || r.error || r.status == null) { aus.fehlt.push(...rest); break; }   // kein git: nichts lesbar
    const b = r.stdout || Buffer.alloc(0);
    let i = 0, beantwortet = 0;
    while (i < b.length && beantwortet < rest.length) {
      const nl = b.indexOf(10, i);
      if (nl < 0) break;
      const kopf = b.slice(i, nl).toString('utf8').split(' ');
      if (kopf.length < 3) { aus.fehlt.push(rest[beantwortet]); beantwortet++; i = nl + 1; continue; }   // „<oid> missing“ (neuere git) · „ambiguous“
      const n = Number(kopf[2]);
      if (!inhalt) { if (kopf[1] === 'blob') aus.set(kopf[0], n); beantwortet++; i = nl + 1; continue; }
      if (!(n >= 0) || nl + 1 + n > b.length) break;   // abgeschnitten: gilt als unbeantwortet
      if (kopf[1] === 'blob') aus.set(kopf[0], b.slice(nl + 1, nl + 1 + n));
      beantwortet++; i = nl + 1 + n + 1;
    }
    if (beantwortet >= rest.length) break;
    if (r.status === 0) { aus.fehlt.push(...rest.slice(beantwortet)); break; }   // nichts mehr gesagt: nicht lesbar
    // Abgebrochen (128): der erste unbeantwortete ist der fehlende — mit dem Rest geht es weiter.
    aus.fehlt.push(rest[beantwortet]);
    rest = rest.slice(beantwortet + 1);
  }
  return aus;
}
// Viele Blobs in EINEM Prozess, als Puffer (byte-gleich, auch ausserhalb von UTF-8). Fehlende in `.fehlt`.
export function blobsLesen(wurzel, shas, baeume) { return objekteLesen(wurzel, shas, true, baeume); }
// Welche Blobs liegen im lokalen Objektspeicher? (Ohne sie zu lesen — eine index.html hat 6 MB.)
export function blobsDa(wurzel, shas, baeume) { return objekteLesen(wurzel, shas, false, baeume); }
// Wie gross ist ein Blob mindestens, der in einem Teilabruf FEHLT? `--filter=blob:limit=<n>[kmg]` laesst jeden
// Blob mit n Bytes oder mehr weg (list-objects-filter: aufgenommen wird nur, was kleiner ist). Gelesen aus
// remote.<name>.partialclonefilter — sonst (blob:none, tree:0, combine:…, kein Teilabruf) null: unbekannt.
export function teilabrufGrenze(wurzel, remote) {
  const f = (git(wurzel, ['config', '--get', 'remote.' + remote + '.partialclonefilter']) || '').trim();
  const m = f.match(/^blob:limit=(\d+)([kmg]?)$/i);
  return m ? Number(m[1]) * ({ '': 1, k: 1024, m: 1024 * 1024, g: 1024 * 1024 * 1024 })[m[2].toLowerCase()] : null;
}
function lies(roh, datei, quelle, unlesbar, extra) {
  let e;
  if (Buffer.byteLength(roh, 'utf8') > EINTRAG_MAX_BYTES) { unlesbar.push({ datei, quelle, grund: 'groesser als ' + (EINTRAG_MAX_BYTES / 1024) + ' KB — kein Eintrag' }); return null; }
  try { e = JSON.parse(roh); } catch (x) { unlesbar.push({ datei, quelle, grund: 'kein gueltiges JSON: ' + String(x.message).split('\n')[0] }); return null; }
  if (!e || typeof e !== 'object' || Array.isArray(e)) { unlesbar.push({ datei, quelle, grund: 'kein JSON-Objekt' }); return null; }
  // Ohne brauchbare id kann nichts auf den Eintrag zeigen und nichts ihn ordnen.
  // Ein solcher Eintrag — auch von einem fremden Branch — ist unlesbar, nicht Teil des Bretts.
  if (!ID_FORM.test(String(e.id || '')) || typeof e.art !== 'string') { unlesbar.push({ datei, quelle, grund: 'ohne id der Form JJJJ-MM-TT-xxxx oder ohne art' }); return null; }
  // Falsch geformte Felder (anker: [null], gesucht: 4, bezug: [null] …) wuerden spaeter
  // jede Rechnung abstuerzen lassen — und zwar in JEDER Sitzung, die den Branch liest.
  const ff = formFehler(e);
  if (ff) { unlesbar.push({ datei, quelle, grund: 'falsch geformt: ' + ff }); return null; }
  // Der Name ist die Adresse: `<id>-<art>-<slug>.json`. Eine Datei, deren Name eine andere id
  // traegt als ihr Inhalt, legte den Waechter dauerhaft lahm (EEXIST) und verwirrt jede Zuordnung.
  const nm = String(datei).match(NAME_FORM);
  if (!(extra && extra.ohneName) && (!nm || nm[1] !== e.id || nm[2] !== e.art)) { unlesbar.push({ datei, quelle, grund: 'Dateiname passt nicht zu id und art (erwartet ' + e.id + '-' + e.art + '-<slug>.json)' }); return null; }
  for (const [k, v] of [['_datei', datei], ['_quelle', quelle], ['_roh', roh], ['_pfad', (extra && extra.pfad) || null], ['_blob', (extra && extra.blob) || null]]) Object.defineProperty(e, k, { value: v, enumerable: false });
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
  if (e.geliefert != null && (!Array.isArray(e.geliefert) || e.geliefert.some(x => !x || typeof x !== 'object' || typeof x.pfad !== 'string' || typeof x.commit !== 'string'))) return 'geliefert ist keine Liste von {pfad, commit}';
  // Schon beim LESEN: ein Pfad, der nicht wie ein Repo-Pfad aussieht, wird nie gerechnet und nie als Befehl gedruckt.
  if (e.geliefert != null && e.geliefert.some(x => !lieferPfadOk(x.pfad) || !COMMIT_FORM.test(x.commit))) return 'geliefert nennt einen Pfad, der nicht wie ein Repo-Pfad aussieht, oder keine volle Commit-Kennung (er wuerde als Befehl gedruckt)';
  return null;
}
// Die Kennung, die git einem Blob gibt (sha1 ueber „blob <n>\0" und den Inhalt) — fuer Dateien des
// Arbeitsbaums, damit eine Fassung ueberall dieselbe Kennung traegt.
export function blobKennung(buf) { return crypto.createHash('sha1').update('blob ' + buf.length + '\0').update(buf).digest('hex'); }
// Der Branch, den `von` nennt („sitzung/claude/x" → „claude/x"), oder null.
export function autorZweig(e) { const m = String((e && e.von) || '').match(/^sitzung\/(.+)$/); return m ? m[1] : null; }
export function brettLesen(wurzel, opts) {
  opts = opts || {};
  const aus = { eintraege: [], unlesbar: [], doppelt: [], abweichend: [], strittig: [], quellen: ['Arbeitsbaum'], gitDa: null, refs: 0, wo: new Map(), zurueckgezogen: 0, grabDateien: [],
    fassungen: new Map(), unlesbarOrte: [], fehlend: [] };
  // Wo liegt jede id? Nur GUELTIG gelesene Kopien zaehlen: eine kaputte oder falsch benannte Kopie
  // auf einem anderen Branch verdeckte sonst den Verlust des Originals (Gegenpruefung 2).
  const liegt = (id, quelle) => { if (!id) return; if (!aus.wo.has(id)) aus.wo.set(id, new Set()); aus.wo.get(id).add(quelle); };
  const grabG = grabsteine(wurzel, !!opts.alleRefs), grab = grabG.ids, grabBlob = grabG.blobs;
  aus.doppeltFassungen = [];
  // Jede FASSUNG (Blob) einer id mit allen Quellen, in Lesereihenfolge: Arbeitsbaum, main, Branches, Sicherung.
  const fass = aus.fassungen, jeQuelle = new Map(), neu = new Map();
  const nimm = (e, blob, quelle, pfad) => {
    if (!e) return;
    if (grab.has(e.id) || grabBlob.has(blob)) { aus.zurueckgezogen++; if (quelle === 'Arbeitsbaum') aus.grabDateien.push(e._datei); return; }
    if (!jeQuelle.has(quelle)) jeQuelle.set(quelle, new Map());
    const vorDatei = jeQuelle.get(quelle).get(e.id);
    // Zwei Dateien derselben id auf EINEM Branch: fuer Leser zaehlt die erste (genannt als doppelt) — der Waechter
    // sichert auch die zweite (vorher wurde sie nie gesichert und nirgends genannt, Gegenpruefung 3).
    if (vorDatei != null && vorDatei !== pfad) { aus.doppelt.push({ id: e.id, dateien: [path.posix.basename(vorDatei), path.posix.basename(pfad)], quelle }); aus.doppeltFassungen.push({ id: e.id, e, blob, quelle, pfad }); return; }
    jeQuelle.get(quelle).set(e.id, pfad);
    liegt(e.id, quelle);
    let l = fass.get(e.id);
    if (!l) { l = []; fass.set(e.id, l); neu.set(quelle, (neu.get(quelle) || 0) + 1); }
    const gleich = l.find(v => v.blob === blob || v.e._roh.trim() === e._roh.trim());
    if (gleich) { gleich.quellen.add(quelle); if (!gleich.pfade.has(quelle)) gleich.pfade.set(quelle, pfad); return; }
    l.push({ e, blob, quellen: new Set([quelle]), pfade: new Map([[quelle, pfad]]) });
  };
  // Ein Unterordner je Monat (eintraege/2026-11/…): das Verzeichnis waechst nur
  // durch Anlegen, und kein Deckel soll je einen Unbeteiligten rot faerben.
  const dir = path.join(wurzel, ORDNER);
  const liesOrdner = (d) => { for (const n of fs.readdirSync(d).sort()) {
    const p = path.join(d, n);
    if (/^\d{4}-\d{2}$/.test(n) && fs.statSync(p).isDirectory()) liesOrdner(p);
    else if (/\.json$/.test(n)) {
      let buf = null;
      try { buf = fs.readFileSync(p); } catch (x) { aus.unlesbar.push({ datei: n, quelle: 'Arbeitsbaum', grund: 'nicht lesbar: ' + String(x.message).split('\n')[0] }); }
      if (buf == null) continue;
      const pfad = path.relative(wurzel, p).split(path.sep).join('/'), blob = blobKennung(buf);
      const e = lies(buf.toString('utf8'), n, 'Arbeitsbaum', aus.unlesbar, { pfad, blob });
      if (!e) aus.unlesbarOrte.push({ quelle: 'Arbeitsbaum', pfad, blob });
      nimm(e, blob, 'Arbeitsbaum', pfad);
    }
  } };
  if (fs.existsSync(dir)) liesOrdner(dir);
  const reihe = [];   // [{ref, voll}] in Lesereihenfolge
  if (opts.alleRefs) {
    // Der VOLLE Name: `refname:short` macht aus refs/remotes/origin/HEAD den Namen „origin" —
    // der zaehlte dann als eigener Branch (und stand als „frisch" in der Liste).
    const refs = git(wurzel, ['for-each-ref', '--format=%(refname)', 'refs/remotes']);
    aus.gitDa = refs != null;
    if (refs != null) {
      // main zuerst, die Sicherung ausdruecklich zuletzt: sie wird nur dort gelesen, wo kein Original mehr liegt.
      const rang = (x) => istMainRef(x) ? 0 : (istSicherungsRef(x) ? 2 : 1);
      const liste = refs.split('\n').map(x => x.trim()).filter(x => x && !/\/HEAD$/.test(x)).sort((a, b) => rang(a) - rang(b) || (a < b ? -1 : a > b ? 1 : 0));
      // Erst alle Baeume, dann EIN `git cat-file --batch` fuer alle Blobs (vorher ein Prozess je Blob:
      // 3 000 Eintraege auf einem Branch kosteten 9 s). Derselbe Blob ist derselbe Inhalt — er wird
      // EINMAL gelesen und gilt fuer jeden Ref, der ihn traegt.
      const jeRef = [], blobs = new Set(), baeume = new Set();
      for (const voll of liste) {
        const ref = voll.replace(/^refs\/remotes\//, '');
        aus.refs++; reihe.push({ ref, voll });
        // -z: Sonderzeichen kommen unveraendert an. -t: auch die Baeume — der Baum des Ordners geht an
        // blobsLesen, damit fehlende Blobs VORAB genannt werden, ohne nachzuladen.
        const ls = git(wurzel, ['ls-tree', '-r', '-t', '-z', voll, '--', ORDNER + '/']);
        const z = [];
        for (const zeile of (ls || '').split('\0')) {
          const t = zeile.match(/^\d+ tree ([0-9a-f]+)\t(.+)$/);
          if (t) { if (t[2] === ORDNER) baeume.add(t[1]); continue; }
          const m = zeile.match(/^\d+ blob ([0-9a-f]+)\t(.+\.json)$/);
          if (!m) continue;
          z.push({ blob: m[1], pfad: m[2] });
          blobs.add(m[1]);
        }
        jeRef.push({ ref, z });
      }
      const inhalt = blobsLesen(wurzel, [...blobs], [...baeume]), fehlt = new Set(inhalt.fehlt);
      // Je Blob UND Name einmal gelesen — die Namenspruefung gilt je VORKOMMEN. Vorher galt der Name des
      // ERSTEN Vorkommens fuer jeden Ref, der denselben Blob traegt: eine byte-gleiche Kopie unter anderem
      // Namen auf einem frueher sortierenden Branch machte das Original „unlesbar", und jeder Halt und jede
      // Lage darin war fuer alle UNWIRKSAM (Gegenpruefung 3). Zwei gueltige Namen desselben Blobs sind zwei
      // Quellen derselben Fassung; ein falscher Name ist unlesbar — nur dieses Vorkommen.
      const gelesen = new Map();   // blob + NUL + Name → Eintrag oder null (unlesbar)
      const NICHT_GEHOLT = 'Blob nicht im lokalen Objektspeicher (Teilabruf: nicht geholt, nicht nachgeladen)';
      for (const { ref, z } of jeRef) for (const x of z) {
        const name = path.posix.basename(x.pfad), k = x.blob + '\0' + name;
        if (fehlt.has(x.blob)) {
          aus.fehlend.push({ quelle: ref, pfad: x.pfad, blob: x.blob });
          aus.unlesbarOrte.push({ quelle: ref, pfad: x.pfad, blob: x.blob });
          if (!gelesen.has(k)) { gelesen.set(k, null); aus.unlesbar.push({ datei: name, quelle: ref, grund: NICHT_GEHOLT }); }
          continue;
        }
        if (!gelesen.has(k)) {
          const buf = inhalt.get(x.blob);
          gelesen.set(k, buf == null ? null : lies(buf.toString('utf8'), name, ref, aus.unlesbar, { pfad: x.pfad, blob: x.blob }));
        }
        const e = gelesen.get(k);
        if (!e) { aus.unlesbarOrte.push({ quelle: ref, pfad: x.pfad, blob: x.blob }); continue; }
        nimm(e, x.blob, ref, x.pfad);
        // Dieselben Bytes unter ZWEI gueltigen Namen sind eine Fassung — aber ihr Eintrag traegt EINEN Namen, und
        // der Name zaehlt fuer die Pruefung mit (ein Geheimnis-Muster im Namen macht den Eintrag ungueltig). Die
        // Fassung behaelt deshalb den Namen, der nichts verdirbt, bei Gleichstand den vom Branch des Schreibers:
        // sonst nahm eine Kopie unter einem vergifteten Namen auf einem frueher sortierenden Branch dem Original
        // seine Wirkung ueber den Umweg der Gueltigkeit.
        const v = (fass.get(e.id) || []).find(w => w.blob === x.blob && w.pfade.get(ref) === x.pfad);
        if (v && v.e !== e && v.e._datei !== e._datei) {
          const mangel = (y) => eintragPruefen(y, y._datei).length;
          const vomAutor = (q, y) => q === 'Arbeitsbaum' || istMainRef(q) || istAutorRef(q, autorZweig(y));
          const mn = mangel(e), mv = mangel(v.e);
          if (mn < mv || (mn === mv && vomAutor(ref, e) && !vomAutor(v.e._quelle, v.e))) v.e = e;
        }
      }
      for (const { ref } of jeRef) if (neu.get(ref)) aus.quellen.push(ref + ' (+' + neu.get(ref) + ')');
    }
  }
  // WELCHE Fassung gilt? Der Arbeitsbaum, sonst origin/main, sonst die des SCHREIBERS auf seinem Branch
  // (der Autor darf seinen ungemergten Eintrag berichtigen), sonst die gesicherte (origin/zz-sicherung).
  // Eine Kopie auf einem DRITTEN Branch nimmt dem Original nichts — vorher fielen beide Fassungen weg, und
  // ein Byte genuegte, um jeden Halt fuer alle Leser zu loeschen (Gegenpruefung 2).
  // Der Schreiber ist eine Eigenschaft des EINTRAGS, nicht jeder Fassung: steht er in der Sicherung, gilt
  // dessen `von`; sonst, wenn alle Fassungen dasselbe `von` tragen, dieses. Vorher zaehlte jede Fassung,
  // deren EIGENES `von` zu ihrem Branch passte — eine Kopie, die ihr `von` auf den eigenen Branch
  // umschrieb, machte das Original STRITTIG, und nach dem Loeschen gewann sie gegen die Sicherung
  // (Gegenpruefung 3). Lassen sich die Fassungen so nicht entscheiden, ist der Eintrag STRITTIG: nicht
  // gerechnet, aber genannt — bis der Waechter eine Fassung gesichert hat (stuendlich).
  aus.gilt = new Map();
  for (const [id, l] of fass) {
    let gilt = null;
    if (l.length === 1) gilt = l[0];
    else {
      gilt = l.find(v => v.quellen.has('Arbeitsbaum')) || l.find(v => [...v.quellen].some(istMainRef)) || null;
      if (!gilt) {
        const gesichert = l.find(v => [...v.quellen].some(istSicherungsRef)) || null;
        const vons = new Set(l.map(v => v.e.von));
        const schreiber = gesichert ? gesichert.e.von : (vons.size === 1 ? [...vons][0] : null);
        const autor = l.filter(v => (schreiber == null || v.e.von === schreiber) && [...v.quellen].some(q => istAutorRef(q, autorZweig(v.e))));
        if (autor.length === 1) gilt = autor[0];
        else if (!autor.length) gilt = gesichert;
      }
      if (!gilt) { aus.strittig.push({ id, quellen: [...new Set(l.flatMap(v => [...v.quellen]))] }); continue; }
      for (const v of l) if (v !== gilt) aus.abweichend.push({ id, gilt: [...gilt.quellen][0], weichtAb: [...v.quellen].join(', '), schreiber: v.e.von !== gilt.e.von ? v.e.von : null });
    }
    Object.defineProperty(gilt.e, '_quellen', { value: gilt.quellen, enumerable: false });
    aus.gilt.set(id, gilt);
    aus.eintraege.push(gilt.e);
  }
  // Wann kam eine Lage oder ein Halt auf seinem Branch an? (git log, ein Aufruf je Branch.) Ein Zeitstempel
  // weit vor dem Commit, der DIESEN Inhalt an diesen Pfad brachte, ist rueckdatiert — damit „stahl" eine
  // spaeter geschriebene Lage die Uebernahme (die aelteste gilt); einer weit danach ist vordatiert.
  // Gemessen wird die JUENGSTE Aenderung des Pfads auf der Erst-Eltern-Linie, Merges gegen ihren ersten
  // Elternteil, ohne Umbenennungserkennung — vorher (nur „hinzugefuegt", mit Umbenennung) kam eine
  // rueckdatierte Lage per Merge-Commit, per `git mv` oder als Umschreibung eines alten Pfads ohne Zeit
  // davon (Gegenpruefung 3). Und die AUTOR-Zeit (%at): `git rebase`, `cherry-pick` und `commit --amend`
  // behalten sie — mit der Committer-Zeit wurde jeder ehrliche Halt nach einem Rebase „rueckdatiert".
  // Beide Zeiten sind eine Selbstauskunft des Commits: das macht das Faelschen muehsamer, nicht unmoeglich.
  // Gerechnet wird auch, wenn die Fassung zugleich im Arbeitsbaum liegt (aus den Remote-Quellen) — sonst
  // hielt der Schreiber seine Lage fuer wirksam, waehrend alle anderen sie rueckdatiert nannten.
  // Nicht gerechnet: auf origin/main (gemergt) und in einem flachen Klon (CI: --depth=1 — dort traegt jede
  // Datei die Zeit der Branch-Spitze, und jeder aeltere Halt hiesse „rueckdatiert").
  if (opts.alleRefs && aus.gitDa && (git(wurzel, ['rev-parse', '--is-shallow-repository']) || '').trim() !== 'true') {
    const mainDa = git(wurzel, ['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main']) != null;
    const ankunft = new Map();   // ref → Map(pfad → Zeit der juengsten Aenderung in ms)
    const zeitAuf = (ref, pfad) => {
      if (!ankunft.has(ref)) {
        const m = new Map(), log = git(wurzel, ['log', '--first-parent', '--diff-merges=first-parent', '--no-renames', '--diff-filter=AM', '--format=%x00%at', '--name-only', 'refs/remotes/' + ref]
          .concat(mainDa ? ['--not', 'refs/remotes/origin/main'] : []).concat(['--', ORDNER + '/'])) || '';
        for (const block of log.split('\0')) { const z = block.split('\n').map(x => x.trim()).filter(Boolean); const t = Number(z[0]) * 1000; if (!t) continue; for (const p of z.slice(1)) if (!m.has(p)) m.set(p, t); }   // juengste zuerst: sie gewinnt
        ankunft.set(ref, m);
      }
      return ankunft.get(ref).get(pfad);
    };
    for (const e of aus.eintraege) {
      if ((e.art !== 'halt' && e.art !== 'lage') || !e._quellen) continue;
      const q = [...e._quellen];
      if (q.some(istMainRef)) continue;
      const l = aus.fassungen.get(e.id).find(v => v.e === e);
      const zeiten = q.filter(x => x !== 'Arbeitsbaum' && !istSicherungsRef(x)).map(x => zeitAuf(x, l.pfade.get(x))).filter(Boolean);
      if (zeiten.length) Object.defineProperty(e, '_angekommen', { value: Math.min(...zeiten), enumerable: false });
    }
  }
  aus.eintraege.sort((a, b) => ordnung(a).localeCompare(ordnung(b)));
  return aus;
}
// Wer arbeitet parallel? Gerechnet aus den Branch-Spitzen — niemand muss dafuer
// etwas schreiben (die geplanten Sitzungen, die am 10.09.2026 denselben Fehler
// viermal behoben, haetten keinen Anspruch angelegt). `jetzt` in ms; nur Anzeige.
// Wer bin ich? Der LOKALE Branch (`branch --show-current` — `rev-parse --abbrev-ref` machte bei einem
// gleichnamigen Tag „heads/<name>" daraus). Der Upstream wird nur GENANNT, wenn er anders heisst: nach
// `git branch -m` landen die Pushes auf dem alten Namen, und dort waere eine Lage mit dem neuen Namen
// fuer alle anderen UNWIRKSAM (Gegenpruefung 2). Ihn zur Identitaet zu machen, waere falsch: `git
// checkout -b x origin/main` setzt main als Upstream — und `checkout -b x origin/<fremd>` den fremden.
export function eigenerZweig(wurzel) {
  const lokal = (git(wurzel, ['branch', '--show-current']) || '').trim();
  if (!lokal) return { lokal: null, name: null, upstream: null };
  const merge = (git(wurzel, ['config', '--get', 'branch.' + lokal + '.merge']) || '').trim();
  const up = /^refs\/heads\/./.test(merge) ? merge.slice('refs/heads/'.length) : null;
  return { lokal, name: lokal, upstream: up && up !== lokal && up !== 'main' && up !== 'master' ? up : null, hatUpstream: !!up, upstreamName: up };
}
export function frischeZweige(wurzel, jetzt, tage) {
  const roh = git(wurzel, ['for-each-ref', '--sort=-committerdate', '--format=%(refname)\t%(committerdate:unix)\t%(subject)', 'refs/remotes']);
  if (roh == null) return null;
  const ez = eigenerZweig(wurzel), eigen = new Set([ez.lokal].filter(Boolean));
  const aus = [];
  aus.zukunft = [];   // Committer-Zeit in der Zukunft: sonst bliebe der Branch fuer immer „frisch“
  for (const z of roh.split('\n')) {
    const [voll, t, ...rest] = z.split('\t');
    const ref = String(voll || '').replace(/^refs\/remotes\//, '');
    if (!ref || /\/HEAD$/.test(ref) || istMainRef(ref) || istSicherungsRef(ref) || eigen.has(ref.replace(/^[^/]+\//, ''))) continue;
    if (Number(t) * 1000 > jetzt + VORLAUF_MS) { aus.zukunft.push({ ref, zeit: new Date(Number(t) * 1000).toISOString() }); continue; }
    const alter = Math.floor((jetzt - Number(t) * 1000) / 864e5);
    if (alter <= tage) aus.push({ ref, tage: Math.max(0, alter), betreff: rest.join('\t') });
  }
  return aus;
}

// ── Vergebene Versionen und STATUS-Kuerzel. Gemessen am 16.11.2026: v33.59 war auf
//    VIER Branches zugleich vergeben, v33.61 auf zwei, das Kuerzel (je) auf sechs —
//    jede Sitzung nahm „die naechste nach main", keine sah die anderen. Wer als
//    Zweiter merged, nummeriert um (fuenf Marken und der Eintrag in GS_RELEASES).
//    Gerechnet aus den Spitzen der frischen Branches; niemand muss etwas melden.
//    Gelesen werden nur sw.js (klein, traegt die Version, robust_check haelt sie mit
//    GS_VERSION gleich) und der juengste Kopf in STATUS.md §0.
const SW_VERSION = /\bVERSION\s*=\s*'gs-(v\d+\.\d+)'/;
// Mehr als 20 Versionen ueber main ist kein Bump, sondern ein Tippfehler oder ein Angriff
// (gemessen: ein Branch mit gs-v99.99 liess `naechste` fuer immer v100.00 empfehlen).
export const SPRUNG_MAX = 20;
const KOPF_KUERZEL = /^\d{4}-\d{2}-\d{2} \(([a-z]{1,3})\)/;
export function versionNr(v) { const m = /^v(\d+)\.(\d+)$/.exec(String(v || '')); return m ? Number(m[1]) * 100 + Number(m[2]) : null; }
function versionAus(n) { return 'v' + Math.floor(n / 100) + '.' + String(n % 100).padStart(2, '0'); }
// Kuerzel laufen a … z, aa … zz: erst die Laenge, dann das Alphabet.
function kuerzelVor(a, b) { return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0); }
export function kuerzelNach(k) {
  const z = String(k).split('');
  for (let i = z.length - 1; i >= 0; i--) { if (z[i] !== 'z') { z[i] = String.fromCharCode(z[i].charCodeAt(0) + 1); return z.join(''); } z[i] = 'a'; }
  return 'a' + z.join('');
}
export function markenAus(swText, statusText) {
  const version = swText ? ((swText.match(SW_VERSION) || [])[1] || null) : null;
  let kuerzel = null, alle = [];
  if (statusText) {
    const s = statusZeilen(statusText);
    if (!s.grund) {
      kuerzel = (s.ueberschrift.match(KOPF_KUERZEL) || [])[1] || null;
      alle = s.alleKoepfe.map(h => (h.match(KOPF_KUERZEL) || [])[1]).filter(Boolean);
    }
  }
  return { version, kuerzel, alle };
}
// Der Titel des Release-Eintrags zu einer Version — aus der Inline-Liste in index.html oder
// aus dem Archiv (data/releases.v1.js). Er ist die IDENTITAET einer Vergabe: dieselbe Version
// mit demselben Titel ist derselbe Release (eine Kopie, ein Vorfahr, der squash-gemergte Stand);
// dieselbe Version mit einem anderen Titel ist ein Zusammenstoss.
export function releaseTitel(texte, version) {
  if (!version) return null;
  const re = new RegExp("\\bv:\\s*'" + version.replace(/\./g, '\\.') + "'[\\s\\S]{0,600}?\\bheadline:\\s*'((?:[^'\\\\\\n]|\\\\.)*)'");
  for (const [t, kopf] of texte) {
    if (!t) continue;
    const i = t.indexOf(kopf);
    if (i < 0) continue;
    const m = t.slice(i).match(re);
    if (m) return m[1];
  }
  return null;
}
// Rechnet gegen origin/main. Gemessen am 17.11.2026 (Koordinations-Sitzung, nachgemessen):
// die erste Fassung zaehlte BRANCHES — „v33.61 ×4" waren drei Vorfahren und ihr Nachfahre,
// EINE Linie. Und sie sah nur Versionen UEBER main: zwei Branches, die auf v33.59 gebumpt
// hatten, waehrend main v33.59 fuer einen ANDEREN Release bekam, meldete sie gar nicht.
// Jetzt: eine Vergabe ist (Version, Release-Titel) bzw. (Kuerzel, Ueberschrift); Branches
// derselben Linie (Vorfahr/Nachfahr) oder mit demselben Titel sind EINE Vergabe; und was
// main fuer etwas anderes traegt, ist UEBERHOLT — dieser Branch muss umnummerieren.
// `hier` sind die Marken des Arbeitsbaums (eigene Vergabe — sie zaehlt nicht gegen sich selbst).
// Erst ein Blick OHNE Nachladen (blobsDa), dann gelesen: in der CI (Teilabruf ohne Blobs ab 200 KB) lud
// `git show` je frischem Branch STATUS.md (1,1 MB) und index.html (6,4 MB) still vom Promisor nach — 12
// Nachlade-Prozesse bei sechs Branches, auch mit `--nur-lokal` (Gegenpruefung 3). Fehlt eine Datei, die die
// Rechnung braucht, ist sie NICHT rechenbar, und `grund` nennt Branch und Datei: eine Nummer ohne STATUS.md
// oder Titel waere still falsch (kein Kuerzel, kein „ueberholt").
const MARKEN_DATEIEN = ['sw.js', 'STATUS.md', 'index.html', 'data/releases.v1.js'];
export function vergebeneMarken(wurzel, jetzt, tage) {
  const MAIN = 'refs/remotes/origin/main';
  if (git(wurzel, ['rev-parse', '--verify', '--quiet', MAIN]) == null) return { grund: 'origin/main ist nicht bekannt (kein Remote oder nie geholt) — vergebene Nummern lassen sich nicht rechnen' };
  const kennung = new Map();   // Ref → Map(Datei → Blob-Kennung); ls-tree braucht nur Baeume, nie den Blob
  const kennungen = (ref) => {
    if (!kennung.has(ref)) {
      const m = new Map();
      for (const z of (git(wurzel, ['ls-tree', '-r', '-z', ref, '--'].concat(MARKEN_DATEIEN)) || '').split('\0')) { const t = z.match(/^\d+ blob ([0-9a-f]+)\t(.+)$/); if (t) m.set(t[2], t[1]); }
      kennung.set(ref, m);
    }
    return kennung.get(ref);
  };
  const blob = (ref, datei) => git(wurzel, ['show', ref + ':' + datei]);   // erst NACH dem Blick unten: dann liegt alles lokal
  const zweige = frischeZweige(wurzel, jetzt, tage) || [];
  // Ein Branch mit Commit-Zeit in der Zukunft ist nicht „frisch" (sonst bliebe er es fuer immer) — seine
  // Nummer ist aber vergeben: vorher empfahl `naechste` sie still ein zweites Mal (Gegenpruefung 2).
  const mitZukunft = zweige.concat((zweige.zukunft || []).map(x => ({ ref: x.ref, zukunft: true })));
  {
    const refsAlle = [MAIN, 'HEAD'].concat(mitZukunft.map(z => 'refs/remotes/' + z.ref)).filter(r => kennungen(r).size);
    const noetig = [];
    for (const ref of refsAlle) for (const [datei, oid] of kennungen(ref)) noetig.push({ ref, datei, oid });
    const da = blobsDa(wurzel, noetig.map(x => x.oid), refsAlle.map(r => r + '^{tree}'));
    const fehlt = noetig.filter(x => !da.has(x.oid)).map(x => x.ref.replace(/^refs\/remotes\//, '') + ':' + x.datei);
    if (fehlt.length) return { grund: fehlt.length + ' Datei(en), die die Rechnung braucht, liegen nicht im lokalen Objektspeicher (Teilabruf — gelesen wird ohne Nachladen): ' + fehlt.slice(0, 4).join(', ') + (fehlt.length > 4 ? ' … +' + (fehlt.length - 4) : ''), fehlt };
  }
  const basis = markenAus(blob(MAIN, 'sw.js'), blob(MAIN, 'STATUS.md'));
  if (versionNr(basis.version) == null) return { grund: 'auf origin/main steht in sw.js keine Version der Form gs-vXX.YY' };
  // index.html ist gross (~6 MB): je Blob nur einmal lesen — viele Branches tragen denselben.
  const titelCache = new Map();
  const titelAus = (holeIndex, blobId, holeArchiv, version) => {
    const k = (blobId || '?') + '|' + version;
    if (blobId && titelCache.has(k)) return titelCache.get(k);
    const t = releaseTitel([[holeIndex(), 'window.GS_RELEASES = ['], [holeArchiv(), 'GS_RELEASES_ARCHIVE']], version);
    if (blobId) titelCache.set(k, t);
    return t;
  };
  const refTitel = (ref, version) => titelAus(() => blob(ref, 'index.html'), (git(wurzel, ['rev-parse', '--verify', '--quiet', ref + ':index.html']) || '').trim(), () => blob(ref, 'data/releases.v1.js'), version);
  const mainTitel = (version) => refTitel(MAIN, version);
  const mainKopf = new Map();   // Kuerzel → Ueberschrift auf main
  { const st = blob(MAIN, 'STATUS.md'), s = st ? statusZeilen(st) : null; if (s && !s.grund) for (const h of s.alleKoepfe) { const k = (h.match(KOPF_KUERZEL) || [])[1]; if (k && !mainKopf.has(k)) mainKopf.set(k, h.trim()); } }
  const lies = (rel) => { try { return fs.readFileSync(path.join(wurzel, rel), 'utf8'); } catch (_) { return null; } };
  const hier = markenAus(lies('sw.js'), lies('STATUS.md'));
  const hierKopf = (() => { const t = lies('STATUS.md'), s = t ? statusZeilen(t) : null; return s && !s.grund ? s.ueberschrift.trim() : null; })();
  const hierTitel = hier.version ? releaseTitel([[lies('index.html'), 'window.GS_RELEASES = ['], [lies('data/releases.v1.js'), 'GS_RELEASES_ARCHIVE']], hier.version) : null;
  const vorfahr = (a, b) => git(wurzel, ['merge-base', '--is-ancestor', a, b]) != null;
  const eineLinie = (a, b) => vorfahr(a, b) || vorfahr(b, a);
  const vGruppen = new Map(), kGruppen = new Map(), ueberholt = [], nachRef = [], unplausibel = [];
  const dazu = (m, wert, eintrag) => { if (!m.has(wert)) m.set(wert, []); m.get(wert).push(eintrag); };
  for (const z of mitZukunft) {
    const voll = 'refs/remotes/' + z.ref;
    const m = markenAus(blob(voll, 'sw.js'), blob(voll, 'STATUS.md'));
    let v = null, k = null;
    if (versionNr(m.version) != null) {
      const titel = refTitel(voll, m.version);
      if (versionNr(m.version) > versionNr(basis.version) + SPRUNG_MAX) unplausibel.push({ ref: z.ref, wert: m.version });
      else if (versionNr(m.version) > versionNr(basis.version)) { v = m.version; dazu(vGruppen, v, { ref: z.ref, voll, titel }); }
      else {
        // Gleich oder kleiner als main: nur ein Zusammenstoss, wenn main fuer DIESE Version einen
        // anderen Release traegt. Unbekannter Titel auf einer Seite: keine Behauptung.
        const mt = mainTitel(m.version);
        if (titel && mt && titel !== mt) ueberholt.push({ ref: z.ref, art: 'version', wert: m.version, titel, mainTitel: mt });
      }
    }
    const st = blob(voll, 'STATUS.md'), s = st ? statusZeilen(st) : null, kopfText = s && !s.grund ? s.ueberschrift.trim() : null;
    if (m.kuerzel) {
      if (mainKopf.has(m.kuerzel)) { if (kopfText && mainKopf.get(m.kuerzel) !== kopfText) ueberholt.push({ ref: z.ref, art: 'kuerzel', wert: m.kuerzel, titel: kopfText, mainTitel: mainKopf.get(m.kuerzel) }); }
      else { k = m.kuerzel; dazu(kGruppen, k, { ref: z.ref, voll, titel: kopfText }); }
    }
    if (v || k) nachRef.push({ ref: z.ref, version: v, kuerzel: k });
  }
  // Linien: Vorfahr/Nachfahr ODER derselbe Titel ist dieselbe Vergabe (Union-Find je Wert).
  const linienAus = (liste) => {
    const eltern = liste.map((_, i) => i), wurzelVon = (i) => (eltern[i] === i ? i : (eltern[i] = wurzelVon(eltern[i])));
    for (let i = 0; i < liste.length; i++) for (let j = i + 1; j < liste.length; j++) {
      if (wurzelVon(i) === wurzelVon(j)) continue;
      if ((liste[i].titel && liste[i].titel === liste[j].titel) || eineLinie(liste[i].voll, liste[j].voll)) eltern[wurzelVon(i)] = wurzelVon(j);
    }
    const proWurzel = new Map();
    liste.forEach((x, i) => { const w = wurzelVon(i); if (!proWurzel.has(w)) proWurzel.set(w, []); proWurzel.get(w).push(x); });
    // Der Titel einer Linie: der des alphabetisch ersten Branches, der einen hat (nicht der juengste —
    // die Reihenfolge von frischeZweige ist bei gleicher Sekunde Zufall). Verglichen wird mit ALLEN.
    return [...proWurzel.values()].map(l => { const g = l.slice().sort((a, b) => a.ref.localeCompare(b.ref)); return { refs: g.map(x => x.ref), titel: (g.find(x => x.titel) || {}).titel || null, titelAlle: [...new Set(g.map(x => x.titel).filter(Boolean))], voll: g.map(x => x.voll) }; }).sort((a, b) => a.refs[0].localeCompare(b.refs[0]));
  };
  const gruppe = (m, vor) => [...m.entries()].sort((a, b) => vor(a[0], b[0])).map(([wert, liste]) => { const linien = linienAus(liste); return { wert, refs: liste.map(x => x.ref).sort(), linien: linien.map(l => ({ refs: l.refs, titel: l.titel })), _voll: linien.map(l => l.voll), _titel: linien.map(l => l.titelAlle) }; });
  const versionen = gruppe(vGruppen, (a, b) => versionNr(a) - versionNr(b)), kuerzel = gruppe(kGruppen, kuerzelVor);
  // Der Arbeitsbaum: eine FREMDE Linie mit seinem Wert ist ein Zusammenstoss. Die eigene Linie
  // ist HEAD (Vorfahr oder Nachfahr) oder ein Branch mit demselben Titel.
  // Vorfahr sein reicht nicht: ein HEAD ohne eigenen Commit IST main und damit Vorfahr jedes
  // Branches. Ein Nachfahr von HEAD gehoert nur dann zur eigenen Linie, wenn HEAD die Nummer
  // schon COMMITTET traegt; ein Vorfahr von HEAD (HEAD enthaelt ihn) immer.
  const kopfMarken = markenAus(git(wurzel, ['show', 'HEAD:sw.js']), git(wurzel, ['show', 'HEAD:STATUS.md']));
  const eigeneLinie = (v, wert, art) => vorfahr(v, 'HEAD') || ((art === 'version' ? kopfMarken.version : kopfMarken.kuerzel) === wert && vorfahr('HEAD', v));
  const fremdeLinien = (g, titel, art) => !g ? [] : g.linien.filter((l, i) => !(titel && g._titel[i].indexOf(titel) >= 0) && !g._voll[i].some(v => eigeneLinie(v, g.wert, art))).map(l => l.refs).flat().sort();
  const hierV = versionNr(hier.version) > versionNr(basis.version) && versionNr(hier.version) <= versionNr(basis.version) + SPRUNG_MAX ? hier.version : null;
  const hierK = hier.kuerzel && !mainKopf.has(hier.kuerzel) ? hier.kuerzel : null;
  const auchAuf = { version: fremdeLinien(versionen.find(x => x.wert === hierV), hierTitel, 'version'), kuerzel: fremdeLinien(kuerzel.find(x => x.wert === hierK), hierKopf, 'kuerzel') };
  const hierUeberholt = { version: null, kuerzel: null };
  if (hier.version && !hierV) { const mt = mainTitel(hier.version); if (hierTitel && mt && hierTitel !== mt) hierUeberholt.version = mt; }
  if (hier.kuerzel && mainKopf.has(hier.kuerzel) && hierKopf && mainKopf.get(hier.kuerzel) !== hierKopf) hierUeberholt.kuerzel = mainKopf.get(hier.kuerzel);
  for (const g of versionen.concat(kuerzel)) { delete g._voll; delete g._titel; }
  // Die eigenen Marken zaehlen mit: wer (jg) schon traegt, bekommt fuer einen WEITEREN Eintrag (jh).
  const maxV = Math.max(versionNr(basis.version), ...versionen.map(x => versionNr(x.wert)), hierV ? versionNr(hierV) : 0);
  const alleK = basis.alle.concat(kuerzel.map(x => x.wert), hierK ? [hierK] : []).sort(kuerzelVor);
  return {
    basis: { version: basis.version, kuerzel: basis.kuerzel },
    hier: { version: hierV, kuerzel: hierK, auchAuf, ueberholt: hierUeberholt, unplausibel: versionNr(hier.version) > versionNr(basis.version) + SPRUNG_MAX ? hier.version : null },
    versionen, kuerzel, ueberholt: ueberholt.sort((a, b) => a.ref.localeCompare(b.ref) || a.art.localeCompare(b.art)), nachRef, unplausibel, zukunft: zweige.zukunft || [],
    naechsteVersion: versionAus(maxV + 1), naechstesKuerzel: alleK.length ? kuerzelNach(alleK[alleK.length - 1]) : null,
  };
}

// Ist die Form eines gelesenen Eintrags gueltig? Gemerkt je Objekt: ableiten laeuft je Lesen mehrmals.
const formCache = new WeakMap();
function formOk(e) {
  if (!e || !e._roh) return !eintragPruefen(e, e && e._datei).length;   // gebaut, nicht gelesen: nicht merken
  if (!formCache.has(e)) formCache.set(e, !eintragPruefen(e, e._datei).length);
  return formCache.get(e);
}
// Stammt ein Eintrag von dort, wo sein Schreiber schreibt? Der Arbeitsbaum und main gelten (dort liegt,
// was hier gemergt ist); auf einem Branch nur der Branch, den `von` nennt. Ohne Herkunft (gebaut): ja.
function herkunftOk(e) {
  const q = e && e._quellen;
  if (!q) return true;
  if (q.has('Arbeitsbaum') || [...q].some(istMainRef)) return true;
  const b = autorZweig(e);
  return [...q].some(x => istAutorRef(x, b));
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
    // Nur ein GUELTIGER Eintrag wirkt auf einen anderen: ein Abschluss mit Ergebnis „egal" oder ein Ersatz
    // ohne Beleg von einem fremden Branch schloss bzw. versteckte sonst jeden Eintrag, auch einen
    // kritischen (Gegenpruefung 2). Ersetzen darf nur, wer den Eintrag geschrieben hat.
    const gilt = (x) => formOk(x) && !bezugsRegeln(x, proId).length;
    const schluss = r.filter(x => x.art === 'schliesst' && x.von.art === 'abschluss' && gilt(x.von));
    const zu = schluss.find(x => x.von.ergebnis !== 'erledigt' || imBaum(x.von)), ers = (e.art === 'halt' || e.art === 'lage') ? null : r.find(x => x.art === 'ersetzt' && x.von.art === e.art && x.von.von === e.von && herkunftOk(x.von) && gilt(x.von));
    const anderswo = zu ? null : (schluss.find(x => x.von.ergebnis === 'erledigt') || {}).von || null;
    let z = 'offen', durch = null;
    if (zu) { z = 'geschlossen'; durch = zu.von; }
    else if (ers) { z = 'ersetzt'; durch = ers.von; }
    else if (e.art === 'frage' && r.some(x => x.art === 'beantwortet' && gilt(x.von))) { z = 'beantwortet'; durch = r.find(x => x.art === 'beantwortet' && gilt(x.von)).von; }
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
    // Ein Halt wird AUFGEHOBEN (mit Grund) — und nur ein Halt.
    if (b.art === 'schliesst' && e.art === 'abschluss' && (e.ergebnis === 'aufgehoben') !== (ziel.art === 'halt')) f.push(ziel.art === 'halt' ? 'einen Halt schliesst nur „aufgehoben" (mit Grund) — ' + b.id : '„aufgehoben" gibt es nur fuer einen Halt, nicht fuer ' + ziel.art + ' ' + b.id);
    // Ein Veto (Halt mit widerspricht) richtet sich gegen eine HANDLUNG — nicht gegen eine Antwort oder einen Abschluss (dafuer: antworte --widerspricht).
    if (e.art === 'halt' && b.art === 'widerspricht' && (ziel.art === 'antwort' || ziel.art === 'abschluss')) f.push('ein Veto richtet sich gegen eine Handlung (Befund, Idee, Lage, Halt …), nicht gegen ' + ziel.art + ' ' + b.id + ' — dort: antworte ' + b.id.slice(-4) + ' --widerspricht');
    // Eine Uebernahme (Lage mit baut_auf) nimmt Arbeit: einen Befund, eine Idee, eine Frage, eine Fehlerklasse.
    if (e.art === 'lage' && b.art === 'baut_auf' && ['befund', 'idee', 'frage', 'klasse'].indexOf(ziel.art) < 0) f.push('eine Lage nimmt einen Befund, eine Idee, eine Frage oder eine Fehlerklasse — nicht ' + ziel.art + ' ' + b.id);
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
  for (const d of brett.grabDateien || []) f.push({ wo: d, grund: 'steht auf der Grabstein-Liste (' + GRABSTEINE + ') und liegt noch hier — die Datei gehoert entfernt (git rm)' });
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
export const PAARE_JE_WORT_MAX = 12;
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
  // Ein Stichwort mit sehr vielen offenen Eintraegen wird GEZAEHLT, nicht gepaart: 2 000 Eintraege an
  // einem Wort ergaben zwei Millionen Paare (7 s), 5 000 legten `holen` mit „heap out of memory" fuer
  // JEDE Sitzung lahm — ein einziger Push genuegte (Gegenpruefung 2).
  const paare = new Map();
  for (const [wort, liste] of proWort) if (liste.length > PAARE_JE_WORT_MAX) aus.push({ art: 'beruehrung', ids: liste.slice(0, 3).map(e => e.id), satz: '„' + wort + '": ' + liste.length + ' offene Eintraege an diesem Stichwort — zu viele, um sie paarweise zu nennen: `--stichwort ' + wort + '`' });
  for (const [wort, liste] of proWort) if (liste.length <= PAARE_JE_WORT_MAX) for (let i = 0; i < liste.length; i++) for (let j = i + 1; j < liste.length; j++) {
    const a = liste[i], b = liste[j];
    if (a.von === b.von || verbunden(a, b) || a.art === 'klasse' || b.art === 'klasse') continue;
    const k = a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id;
    if (!paare.has(k)) paare.set(k, { a: a.id < b.id ? a : b, b: a.id < b.id ? b : a, worte: [] });
    paare.get(k).worte.push(wort);
  }
  for (const p of paare.values()) aus.push({ art: 'beruehrung', ids: [p.a.id, p.b.id], satz: '„' + p.worte.join(', ') + '": ' + zeige(p.a) + '  ×  ' + zeige(p.b) + ' — gemeinsame Ursache? Dann ein Eintrag mit baut_auf auf beide' });
  for (const [ziel, liste] of rueck) {
    const ideen = liste.filter(x => x.art === 'baut_auf' && x.von.art === 'idee' && zustand.get(x.von.id).z === 'offen').map(x => x.von);
    if (ideen.length > PAARE_JE_WORT_MAX) { aus.push({ art: 'zwei_ideen', ids: [ziel].concat(ideen.slice(0, 2).map(x => x.id)), satz: ideen.length + ' offene Ideen bauen auf ' + ziel + ' — welche sind die besseren? (`zeige ' + ziel.slice(-4) + '`)' }); continue; }
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
  const ids = offen ? [...offen[1].matchAll(BRETT_ZITAT)].map(m => m[1]) : [];
  const alleKoepfe = [...s0.matchAll(/^### (.*)$/gm)].map(m => m[1]);
  return { ueberschrift, offen: offen ? offen[1].trim() : null, ids, nichts: !!(offen && /^nichts\b/i.test(offen[1].trim())), nichtGeprueft: np ? np[1].trim() : null, alleKoepfe };
}

// ── Der Schwarm (seit 18.11.2026, Fernando: Dringlichkeit, Aufgabenzuweisung, Fortschritt,
//    Waechter und Sicherung, Halt und Veto). Was git schon weiss, wird GERECHNET (gemessen:
//    widerspricht 0×, ernten 0×, „frage an alle" 1× ohne Antwort — was eine Sitzung von sich aus
//    melden muss, meldet sie nicht). Gemeldet wird nur die ABSICHT: Lage, Halt, Veto.

// Grabsteine (docs/austausch/zurueckgezogen.json): [{id, datum, grund}] — nie der Inhalt. Mit `blob` (40 Hex,
// die Kennung EINER Fassung) gilt er nur fuer diese Fassung: eine fremde Kopie mit einem Namen im Text liess
// sich vorher nur mit der ganzen id entfernen — samt dem legitimen Original (Gegenpruefung 3).
export function grabsteinePruefen(roh) {
  const fehler = [], ids = new Set(), blobs = new Set();
  let l;
  try { l = JSON.parse(roh); } catch (x) { return { ids, blobs, fehler: ['kein gueltiges JSON'] }; }
  if (!Array.isArray(l)) return { ids, blobs, fehler: ['keine Liste'] };
  l.forEach((x, i) => {
    if (!x || typeof x !== 'object' || Array.isArray(x)) { fehler.push('[' + i + '] kein Objekt'); return; }
    for (const k of Object.keys(x)) if (['id', 'datum', 'grund', 'blob'].indexOf(k) < 0) fehler.push('[' + i + '] Feld „' + k + '" — ein Grabstein traegt nur id, datum, grund (und fuer eine einzelne Fassung blob), nie den Inhalt');
    const blobOk = x.blob == null || /^[0-9a-f]{40}$/.test(String(x.blob));
    if (!blobOk) fehler.push('[' + i + '] blob ist die volle Kennung einer Fassung (40 Zeichen, git hash-object)');
    if (!ID_FORM.test(String(x.id || ''))) fehler.push('[' + i + '] id fehlt oder hat die falsche Form'); else if (x.blob == null) ids.add(x.id); else if (blobOk) blobs.add(x.blob);
    if (!datumGueltig(x.datum)) fehler.push('[' + i + '] datum fehlt');
    if (typeof x.grund !== 'string' || !x.grund.trim()) fehler.push('[' + i + '] grund fehlt');
    for (const [re, was] of GEHEIM) if (re.test(textVon(x))) fehler.push('[' + i + '] enthaelt etwas, das wie ' + was + ' aussieht');
  });
  return { ids, blobs, fehler };
}
export function grabsteine(wurzel, mitMain) {
  const ids = new Set(), blobs = new Set(), fehler = [];
  const quellen = [];
  try { quellen.push(fs.readFileSync(path.join(wurzel, GRABSTEINE), 'utf8')); } catch (_) {}
  if (mitMain) { const t = git(wurzel, ['show', 'refs/remotes/origin/main:' + GRABSTEINE]); if (t != null) quellen.push(t); }
  for (const roh of quellen) { const g = grabsteinePruefen(roh); g.ids.forEach(i => ids.add(i)); g.blobs.forEach(b => blobs.add(b)); fehler.push(...g.fehler); }
  return { ids, blobs, fehler };
}
// Was hat ein SCHREIBER auf seinem eigenen Branch zurueckgezogen (Grabstein dort, vor dem Merge — README
// Waechter 1)? Entfernt wird erst mit dem Grabstein auf main; bis dahin ist sein Verschwinden kein Verlust
// (vorher: ALARM, und `ernten` holte ihn zurueck — Gegenpruefung 3). Nur der Branch, den `von` nennt:
// ein Grabstein auf einem FREMDEN Branch zieht nichts zurueck.
export function zurueckgezogenVomSchreiber(wurzel, eintraegeOderVon) {
  const refs = (git(wurzel, ['for-each-ref', '--format=%(refname)', 'refs/remotes/' + REMOTE + '/']) || '').split('\n').filter(x => x && !/\/HEAD$/.test(x));
  const aus = new Map();   // id → ref
  if (!refs.length) return aus;
  let r;
  try { r = cp.spawnSync('git', ['-C', wurzel, 'cat-file', '--batch'], { input: refs.map(x => x + ':' + GRABSTEINE).join('\n') + '\n', maxBuffer: 256 * 1024 * 1024, env: Object.assign({}, process.env, { GIT_NO_LAZY_FETCH: '1' }) }); } catch (_) { return aus; }
  const b = r && r.stdout; if (!b) return aus;
  let i = 0, k = 0;
  const jeRef = new Map();
  while (i < b.length && k < refs.length) {
    const nl = b.indexOf(10, i); if (nl < 0) break;
    const kopf = b.slice(i, nl).toString('utf8').split(' ');
    const ref = refs[k++].replace(/^refs\/remotes\//, '');
    if (kopf[1] !== 'blob') { i = nl + 1; continue; }
    const n = Number(kopf[2]);
    const g = grabsteinePruefen(b.slice(nl + 1, nl + 1 + n).toString('utf8'));
    jeRef.set(ref, g.ids);
    i = nl + 1 + n + 1;
  }
  const vonId = new Map();
  for (const x of eintraegeOderVon) if (x && x.id && !vonId.has(x.id)) vonId.set(x.id, x.von || (x.e && x.e.von));
  for (const [ref, ids] of jeRef) for (const id of ids) { const v = vonId.get(id); if (v && istAutorRef(ref, autorZweig({ von: v }))) aus.set(id, ref); }
  return aus;
}

// WIRKT ein zeitgebundener Eintrag JETZT? Nur, was beim LESEN gueltig ist: ein fremder Branch ist
// fremde Eingabe, und ein Eintrag mit Datum 2099 oder einem `bis` ohne Z haelt sonst den Schwarm an.
export const VORLAUF_MS = 15 * 60e3;   // so weit darf eine Uhr vorgehen
export function wirksam(e, jetzt) {
  const f = eintragPruefen(e, e._datei);
  if (f.length) return { ok: false, grund: 'ungueltig: ' + f[0] };
  const t0 = zeitpunkt(e), t1 = Date.parse(String(e.bis || ''));
  if (t0 == null || isNaN(t1)) return { ok: false, grund: 'ohne lesbare Zeit' };
  if (t0 > jetzt + VORLAUF_MS) return { ok: false, grund: 'Zeitstempel in der Zukunft (' + e.datum + ' ' + e.zeit + ' UTC) — falsche Uhr oder gefaelscht' };
  if (t1 <= jetzt) return { ok: false, abgelaufen: true, grund: 'abgelaufen (' + e.bis + ')' };
  return { ok: true, bis: t1 };
}
// Nur ein GUELTIGER Eintrag wirkt auf einen anderen (Gegenpruefung: ein fremder Abschluss mit
// Ergebnis „egal" hob jeden Halt auf).
function gueltig(e, proId) { return !eintragPruefen(e, e._datei).length && !bezugsRegeln(e, proId).length; }
// `von` ist freier Text — gegen die Quelle gehalten: ein Eintrag von „sitzung/<b>" zaehlt als seiner nur,
// wenn seine Fassung auf origin/<b> liegt (nie derselbe Name auf einem anderen Remote), im Arbeitsbaum,
// wenn <b> der eigene Branch ist, oder auf origin/main (dort liegt, was jemand gemergt hat — README „auf
// main jede"; vorher verfiel eine Uebernahme mit dem Merge und dem Loeschen des Branches mitten in ihrer
// Frist). Die Sicherung zaehlt nie. Ohne `wo` (gebaute Eintraege ohne git) wird nicht geprueft. Gilt fuer
// Lage, Halt, Veto — und fuer „meins". `ich`: ein Name oder eine Liste (nach `git branch -m` zaehlt auch
// der Name, unter dem der Branch auf origin liegt — Gegenpruefung 3).
export function vonPasst(e, wo, ich) {
  if (!wo) return true;
  const q = e._quellen || wo.get(e.id) || new Set();
  if ([...q].some(istMainRef)) return true;
  const b = autorZweig(e);
  if (!b) return false;
  const istIch = Array.isArray(ich) ? ich.indexOf(e.von) >= 0 : ich === e.von;
  return [...q].some(x => istAutorRef(x, b)) || (q.has('Arbeitsbaum') && istIch);
}
// So weit darf der Zeitstempel einer Lage oder eines Halts VOR dem Commit liegen, der ihn auf seinen
// Branch brachte (schreiben, weiterarbeiten, committen). Was weiter zurueckliegt, ist rueckdatiert.
export const RUECKDATIERT_MAX_MS = 6 * 36e5;
// Reihenfolge der Lagen: Zeit, bei gleicher Sekunde „fertig" zuletzt, dann die id.
const lageOrd = (e) => String(e.datum) + 'T' + String(e.zeit) + (e.phase === 'fertig' ? '~' : ' ') + e.id;
const nimmt = (e) => alsListe(e.bezug).filter(b => b && b.art === 'baut_auf').map(b => b.id);
// Halts, Vetos, Lagen, Uebernahmen — mit AUSDRUECKLICHER Uhr. Nichts davon aendert `zustand`
// (offen/geschlossen): die Faelle des Pruefstands haengen so nie an der Uhr.
//   opts.wo  — Map id → Quellen (brettLesen), fuer die Pruefung von `von`
//   opts.ich — „sitzung/<eigener Branch>"
export function schwarm(eintraege, jetzt, opts) {
  opts = opts || {};
  const abl = ableiten(eintraege), proId = abl.proId;
  const halts = [], unwirksam = [], gueltigeLagen = [], aufgehoben = [];
  const fmt = (ms) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  // Ein Halt endet durch Ablauf oder einen GUELTIGEN Abschluss „aufgehoben" — nie durch `ersetzt`.
  const aufhebung = (e) => ((abl.rueck.get(e.id) || []).find(x => x.art === 'schliesst' && x.von.art === 'abschluss' && x.von.ergebnis === 'aufgehoben' && gueltig(x.von, proId)) || {}).von || null;
  for (const e of eintraege) {
    if (e.art !== 'halt' && e.art !== 'lage') continue;
    if (e.art === 'halt') { const a = aufhebung(e); if (a) { aufgehoben.push({ e, durch: a }); continue; } }
    const w = wirksam(e, jetzt);
    // Eine ABGELAUFENE Lage zaehlt still weiter mit: ein „fertig" beendet auch nach seiner eigenen Frist, und
    // was eine Lage zu IHRER Zeit hielt, belegte damals den Deckel (Gegenpruefung 3).
    const abgelaufen = e.art === 'lage' && w.abgelaufen === true;
    if (!w.ok && !abgelaufen) { if (!w.abgelaufen) unwirksam.push({ e, grund: w.grund }); continue; }
    // Erst jetzt, was nur fuer WIRKENDE zaehlt: ein abgelaufener Eintrag wird nie mehr gemeldet.
    const melde = (grund) => { if (!abgelaufen) unwirksam.push({ e, grund }); };
    const bz = bezugsRegeln(e, proId);
    if (bz.length) { melde('ungueltig: ' + bz[0]); continue; }
    if (!vonPasst(e, opts.wo, opts.ich)) { melde('„von" (' + e.von + ') passt nicht zum Branch, auf dem ' + (e.art === 'lage' ? 'die Lage' : 'der Halt') + ' liegt'); continue; }
    if (e._angekommen != null) {
      const t0 = zeitpunkt(e);
      if (t0 < e._angekommen - RUECKDATIERT_MAX_MS) { melde('rueckdatiert: Zeitstempel ' + fmt(t0) + ', auf dem Branch erst ' + fmt(e._angekommen)); continue; }
      if (t0 > e._angekommen + VORLAUF_MS) { melde('vordatiert: Zeitstempel ' + fmt(t0) + ', auf dem Branch schon ' + fmt(e._angekommen)); continue; }
    }
    if (e.art === 'lage') { gueltigeLagen.push({ e, bis: w.ok ? w.bis : Date.parse(e.bis), aktiv: w.ok }); continue; }
    const veto = (alsListe(e.bezug).find(b => b && b.art === 'widerspricht') || {}).id || null;
    halts.push({ e, bis: w.bis, veto, antworten: (abl.rueck.get(e.id) || []).filter(x => x.von.art === 'antwort').map(x => x.von) });
  }
  // Je Schreiber: JEDE gueltige Lage mit baut_auf ist eine Uebernahme, bis eine spaetere „fertig"
  // desselben Schreibers sie beendet (ohne Bezug: alle; mit Bezug: genau diese). „Spaeter" heisst: mit
  // spaeterem Zeitstempel — ein „fertig" in derselben Sekunde gab sonst die eben genommene Aufgabe frei.
  // Und hoechstens LAGE_NIMMT_MAX Uebernahmen je Schreiber zugleich (die aeltesten gelten): sonst hielt
  // einer mit vierzehn Lagen 42 Eintraege fest (Gegenpruefung 2). Der Deckel gilt ZUR ZEIT DER LAGE: was
  // beim eigenen Zeitstempel ueber dem Deckel lag, bleibt fuer dieses Ziel unwirksam — ein spaeteres „fertig"
  // (oder Ablaufen) gibt nur fuer SPAETERE Lagen Platz frei. Vorher wurde am Endstand gerechnet, und eine
  // bei ihrem Schreiben unwirksame vierte Uebernahme eroberte mit ihrem alten Zeitstempel ein Ziel zurueck
  // (Gegenpruefung 3). Mithelfen (`mithelfen: true`) nimmt nichts und belegt keinen Platz.
  const proVon = new Map();
  for (const l of gueltigeLagen) { if (!proVon.has(l.e.von)) proVon.set(l.e.von, []); proVon.get(l.e.von).push(l); }
  const ansprueche = [], lagen = [], helfer = [], zeitKey = (e) => String(e.datum) + 'T' + String(e.zeit);
  const gibtFrei = (f, l, ziel) => f.e.phase === 'fertig' && zeitKey(f.e) > zeitKey(l.e) && (!nimmt(f.e).length || nimmt(f.e).indexOf(ziel) >= 0);
  for (const liste of proVon.values()) {
    liste.sort((a, b) => lageOrd(a.e).localeCompare(lageOrd(b.e)));
    const angenommen = [], zuViel = new Map();
    for (const l of liste) {
      if (l.e.phase === 'fertig') continue;   // ein „fertig" mit Bezug GIBT frei, es nimmt nicht
      if (l.e.mithelfen === true) { helfer.push(l); continue; }
      const t = zeitKey(l.e), tMs = zeitpunkt(l.e);
      // Was hielt dieser Schreiber, als er DIESE Lage schrieb? Angenommene Ziele frueherer Lagen, deren Frist
      // da noch lief und die kein „fertig" vor diesem Zeitstempel freigab.
      const gehalten = new Set();
      for (const a of angenommen) if (a.l.bis > tMs && !liste.some(f => gibtFrei(f, a.l, a.ziel) && zeitKey(f.e) < t)) gehalten.add(a.ziel);
      for (const ziel of nimmt(l.e)) {
        if (!gehalten.has(ziel) && gehalten.size >= LAGE_NIMMT_MAX) { if (!zuViel.has(l.e.id)) zuViel.set(l.e.id, { l, z: [] }); zuViel.get(l.e.id).z.push(ziel); continue; }
        gehalten.add(ziel); angenommen.push({ l, ziel });
      }
    }
    // Was gilt JETZT: angenommen, die Lage laeuft noch, und kein spaeteres „fertig" hat sie beendet.
    for (const a of angenommen) if (a.l.aktiv && !liste.some(f => gibtFrei(f, a.l, a.ziel))) ansprueche.push({ ziel: a.ziel, lage: a.l });
    for (const { l, z } of zuViel.values()) if (l.aktiv) unwirksam.push({ e: l.e, grund: 'mehr als ' + LAGE_NIMMT_MAX + ' Uebernahmen zugleich — fuer ' + z.join(', ') + ' gilt sie nicht (die aeltesten gelten)', ziele: z, teil: z.length < nimmt(l.e).length });
    // Fortschritt: die juengste Lage des Schreibers; „fertig" beendet die Anzeige.
    const neueste = liste[liste.length - 1];
    if (neueste && neueste.aktiv && neueste.e.phase !== 'fertig') lagen.push(neueste);
  }
  // Mehrere Schreiber auf dasselbe Ziel: die AELTESTE Uebernahme gilt (Selbstauskunft — README).
  const uebernahme = new Map();
  for (const a of ansprueche.sort((x, y) => lageOrd(x.lage.e).localeCompare(lageOrd(y.lage.e)))) {
    if (!uebernahme.has(a.ziel)) uebernahme.set(a.ziel, { lage: a.lage, auch: [] });
    else { const u = uebernahme.get(a.ziel); if (u.lage.e.von !== a.lage.e.von && u.auch.indexOf(a.lage) < 0) u.auch.push(a.lage); }   // jede nachrangige Lage
  }
  // Wer mithilft, steht daneben — nur bei einem Ziel, das jemand anderes genommen hat, und solange seine Lage laeuft.
  for (const l of helfer) {
    if (!l.aktiv) continue;
    const eigeneListe = proVon.get(l.e.von) || [];
    for (const ziel of nimmt(l.e)) {
      const u = uebernahme.get(ziel);
      if (!u || u.lage.e.von === l.e.von || u.auch.indexOf(l) >= 0 || eigeneListe.some(f => gibtFrei(f, l, ziel))) continue;
      u.auch.push(l);
    }
  }
  const vetos = new Map();
  for (const h of halts) if (h.veto) { if (!vetos.has(h.veto)) vetos.set(h.veto, []); vetos.get(h.veto).push(h); }
  return { halts, lagen, uebernahme, vetos, unwirksam, aufgehoben };
}

// Funktionen einer Aenderung aus ZEILENNUMMERN — und zwar ueber die GRENZEN jeder Funktion: eine Zeile
// gehoert ALLEN Funktionen, die sie umschliessen (der aeusseren und jedem Helfer darin), eine Zeile
// ausserhalb jeder Funktion (CSS, HTML, `var GS_VERSION`, der Changelog) keiner. Vorher galt „die naechste
// Deklaration davor": eine Aenderung mitten in gsKalenderEreignisse hiess dort `im` (ein Einzeiler im
// Rumpf), ein Bump hiess closeAbout (Gegenpruefung 2). Ein kleiner Scanner, kein Parser (das Werkzeug
// laeuft ohne npm): Zeichenketten, Vorlagen, Kommentare und Regex-Literale werden uebersprungen, die
// Klammern gepaart. Geht ein <script>-Block nicht auf, gilt dort eine Naeherung (bis zur naechsten
// Deklaration, die nicht tiefer eingerueckt ist) — und die Aenderung sagt es: `unsicher` mit der Zeile, ab
// der der Scanner scheitert, und jeder Halt auf eine Funktion dieses Blocks gilt als beruehrt (Runde 3:
// `unsicher` wurde gerechnet und nirgends gelesen — eine gueltige Zeile auf main schaltete jeden
// Funktions-Halt still ab, ebenso ein Merge-Konflikt in der gehaltenen Funktion).
// Deklarationen: `function X`, `X = function`, `window.X = function` — und das Tor `window.X = window.X ||
// function` (gsUploadImage, gsCompressImage: vorher „weder eine Funktion in index.html …", Runde 3).
const DEKLARATION = /^[ \t]*(?:async[ \t]+)?function[ \t*]+([A-Za-z_$][\w$]*)|^[ \t]*(?:window\.|var[ \t]+|let[ \t]+|const[ \t]+)?([A-Za-z_$][\w$]*)[ \t]*=[ \t]*(?:(?:window\.)?\2[ \t]*(?:\|\||\?\?)[ \t]*)?(?:async[ \t]+)?function\b/;
function deklarationen(text) {
  const aus = [];
  if (!text) return aus;
  const z = text.split('\n');
  for (let i = 0; i < z.length; i++) { const m = DEKLARATION.exec(z[i]); if (m) aus.push({ zeile: i + 1, name: m[1] || m[2], einzug: /^[ \t]*/.exec(z[i])[0].length }); }
  return aus;
}
export function funktionsNamen(text) { return new Set(deklarationen(text).map(d => d.name)); }
const REGEX_NACH_WORT = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
// Nach der ) dieser Koepfe beginnt eine Anweisung — dort ist / ein Regex (`if (x) /'/.test(y)`), sonst ein Teilen.
const KOPF_WORT = new Set(['if', 'while', 'for', 'with']);
const LEER = new Set([' ', '\t', '\n', '\r', '\f', '\v', '\u00a0', '\ufeff', '\u2028', '\u2029']);
const ZEILENENDE = new Set(['\n', '\r', '\u2028', '\u2029']);
const ZU = { '{': '}', '(': ')', '[': ']' };
const ID_ANF = /[A-Za-z_$\u00c0-\uffff]/, ID_ZEICHEN = /[\w$\u00c0-\uffff]/;
// Elemente, deren Inhalt der Browser als TEXT liest: ein „<!--" oder „<script>" darin oeffnet nichts.
const ROHTEXT = new Set(['style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript', 'plaintext']);
// Wo endet ein Element mit Rohtext? Am naechsten </name, dem Leerraum, / oder > folgt (nie an </scripts).
function schlussTag(klein, name, ab) {
  for (let j = klein.indexOf('</' + name, ab); j >= 0; j = klein.indexOf('</' + name, j + 1)) if (/[\s/>]/.test(klein[j + 2 + name.length] || '>')) return j;
  return -1;
}
// JS-Bereiche [von, bis) eines Textes: in einer .html-Datei die <script>-Bloecke ohne src, sonst alles.
// Gelesen wie ein Browser, nur grob: ein Kommentar zaehlt nur im TEXT zwischen den Tags (nicht in einem
// Attributwert, nicht in style/textarea/title), `<!-->` und `<!--->` sind leere Kommentare, ein `>` in
// Anfuehrungszeichen beendet kein Tag, und `src` zaehlt nur als ganzes Attribut (nicht `data-src`). Vorher
// verschluckte `<button title="Schliessen <!-- Fuss">` vor dem Hauptskript 2 644 von 2 799 Funktionen (Runde 3).
export function jsBereiche(text, html) {
  if (!html) return [[0, text.length]];
  const klein = text.toLowerCase(), n = text.length, aus = [];
  let i = 0;
  while ((i = klein.indexOf('<', i)) >= 0) {
    if (klein.startsWith('<!--', i)) {
      if (klein[i + 4] === '>') { i += 5; continue; }
      if (klein.startsWith('->', i + 4)) { i += 6; continue; }
      // Ende: das erste --> oder --!> (je Kommentar nur bis dorthin gesucht — eine Suche nach --!> ueber den
      // ganzen Rest kostete 600 ms bei 457 Kommentaren).
      let z = n;
      for (let p = klein.indexOf('--', i + 4); p >= 0; p = klein.indexOf('--', p + 1)) {
        if (klein[p + 2] === '>') { z = p + 3; break; }
        if (klein[p + 2] === '!' && klein[p + 3] === '>') { z = p + 4; break; }
      }
      i = z; continue;
    }
    if (klein[i + 1] === '!' || klein[i + 1] === '?') { const z = klein.indexOf('>', i + 2); i = z < 0 ? n : z + 1; continue; }   // <!DOCTYPE …>, <?…>
    const zu = klein[i + 1] === '/', j0 = i + (zu ? 2 : 1);
    if (!/[a-z]/.test(klein[j0] || '')) { i++; continue; }   // ein „<" im Text
    let j = j0;
    while (j < n && !/[\s/>]/.test(klein[j])) j++;
    const name = klein.slice(j0, j), attr = new Set();
    // Attribute bis zum > ausserhalb von Anfuehrungszeichen.
    while (j < n && klein[j] !== '>') {
      if (/[\s/]/.test(klein[j])) { j++; continue; }
      const a0 = j;
      j++;   // das erste Zeichen eines Namens darf auch = sein
      while (j < n && !/[\s/>=]/.test(klein[j])) j++;
      attr.add(klein.slice(a0, j));
      while (j < n && /\s/.test(klein[j])) j++;
      if (klein[j] !== '=') continue;
      j++;
      while (j < n && /\s/.test(klein[j])) j++;
      if (klein[j] === '"' || klein[j] === "'") { const q = klein.indexOf(klein[j], j + 1); j = q < 0 ? n : q + 1; }
      else while (j < n && !/[\s>]/.test(klein[j])) j++;
    }
    const nach = Math.min(n, j + 1);
    if (zu) { i = nach; continue; }
    if (name === 'script') {
      const ende = schlussTag(klein, 'script', nach), b = ende < 0 ? n : ende;
      if (!attr.has('src')) aus.push([nach, b]);
      i = b; continue;
    }
    if (ROHTEXT.has(name)) { const ende = name === 'plaintext' ? -1 : schlussTag(klein, name, nach); i = ende < 0 ? n : ende; continue; }
    i = nach;
  }
  return aus;
}
// Klammern paaren in text[a, b). Gibt die Paare (Position der oeffnenden → schliessende), die oeffnenden
// Klammern in Reihenfolge, die Positionen von `function` — ob der Bereich aufging und, wenn nicht, ab wo
// (`fehler`: die erste Stelle, an der es nicht weiterging, oder die erste Klammer, die nie zuging).
export function klammernPaaren(text, a, b) {
  const paare = new Map(), offen = [], fn = [], st = [];
  let i = a, art = 'start', wort = '', kaputt = false, fehler = null, zeilenAnf = true;
  const bruch = (p) => { if (!kaputt) { kaputt = true; fehler = p; } };
  // `art` ist das Letzte, was vor einem / stand. Ein Regex-Literal ist erlaubt am Anfang, nach einem
  // Operator, nach } (Blockende), nach einem Schluesselwort wie return/typeof und nach der ) eines
  // if/while/for/with-Kopfs. Ein Wort direkt hinter . oder ?. ist eine Eigenschaft (`t.in / t.out`), und
  // ein nachgestelltes ++/-- schliesst einen Wert ab (`erledigt++ / gesamt`) — Runde 3, je gegen acorn.
  const regexErlaubt = () => art === 'start' || art === 'op' || art === 'zu}' || art === 'kopf)' || (art === 'wort' && REGEX_NACH_WORT.has(wort));
  // Eine Vorlage `…${…}…` ab j (hinter dem oeffnenden ` oder einer schliessenden } eines ${): bis zum ` oder zum naechsten ${.
  const vorlage = (j, anf) => {
    while (j < b) {
      const c = text[j];
      if (c === '\\') { j += 2; continue; }
      if (c === '`') return j + 1;
      if (c === '$' && text[j + 1] === '{') { st.push({ ch: '${', pos: j }); return j + 2; }
      j++;
    }
    bruch(anf); return b;
  };
  while (i < b) {
    const c = text[i];
    if (LEER.has(c)) { if (ZEILENENDE.has(c)) zeilenAnf = true; i++; continue; }
    if (c === '/' && text[i + 1] === '/') { const n = text.indexOf('\n', i); i = n < 0 || n > b ? b : n; continue; }
    if (c === '/' && text[i + 1] === '*') { const n = text.indexOf('*/', i + 2), e = n < 0 || n >= b ? b : n + 2, nl = text.indexOf('\n', i); if (nl >= 0 && nl < e) zeilenAnf = true; i = e; continue; }
    if (c === '<' && text.startsWith('<!--', i)) { const n = text.indexOf('\n', i); i = n < 0 || n > b ? b : n; continue; }
    // `-->` am Zeilenanfang (davor nur Leerraum und Kommentare) ist im klassischen Skript ein Kommentar bis zum Zeilenende.
    if (c === '-' && zeilenAnf && text.startsWith('-->', i)) { const n = text.indexOf('\n', i); i = n < 0 || n > b ? b : n; continue; }
    zeilenAnf = false;
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < b && text[j] !== c && text[j] !== '\n') j += text[j] !== '\\' ? 1 : (text[j + 1] === '\r' && text[j + 2] === '\n' ? 3 : 2);
      if (j >= b || text[j] !== c) bruch(i);
      i = j + 1; art = 'wert'; continue;
    }
    if (c === '`') { const vor = st.length; i = vorlage(i + 1, i); art = st.length > vor ? 'op' : 'wert'; continue; }
    if (c === '/' && regexErlaubt()) {
      let j = i + 1, klasse = false, ok = false;
      while (j < b && text[j] !== '\n') {
        const d = text[j];
        if (d === '\\') { j += 2; continue; }
        if (d === '[') klasse = true; else if (d === ']') klasse = false; else if (d === '/' && !klasse) { ok = true; break; }
        j++;
      }
      if (ok) { j++; while (j < b && /[a-z]/i.test(text[j])) j++; i = j; art = 'wert'; continue; }
      i++; art = 'op'; continue;   // kein Literal: ein Teilen
    }
    if (ID_ANF.test(c)) {
      let j = i + 1;
      while (j < b && ID_ZEICHEN.test(text[j])) j++;
      if (art === 'punkt') { i = j; art = 'wert'; continue; }   // eine Eigenschaft: kein Schluesselwort, kein `function`
      wort = text.slice(i, j); if (wort === 'function') fn.push(i); art = 'wort'; i = j; continue;
    }
    if ((c >= '0' && c <= '9') || (c === '.' && /\d/.test(text[i + 1] || ''))) { let j = i + 1; while (j < b && /[\w.]/.test(text[j])) j++; i = j; art = 'wert'; continue; }
    if (c === '.') { if (text[i + 1] === '.' && text[i + 2] === '.') { i += 3; art = 'op'; } else { i++; art = 'punkt'; } continue; }
    if ((c === '+' || c === '-') && text[i + 1] === c) { i += 2; art = art === 'wert' || (art === 'wort' && !REGEX_NACH_WORT.has(wort)) ? 'wert' : 'op'; continue; }
    if (c === '{' || c === '(' || c === '[') {
      const k = { ch: c, pos: i };
      if (c === '(' && art === 'wort' && KOPF_WORT.has(wort)) k.kopf = true;
      st.push(k); offen.push(k); i++; art = 'op'; continue;
    }
    if (c === '}' || c === ')' || c === ']') {
      const top = st.pop();
      if (!top) { bruch(i); i++; continue; }
      if (top.ch === '${') { if (c !== '}') bruch(i); const vor = st.length; i = vorlage(i + 1, i); art = st.length > vor ? 'op' : 'wert'; continue; }
      if (ZU[top.ch] !== c) bruch(i);
      paare.set(top.pos, i);
      i++; art = c === '}' ? 'zu}' : (top.kopf ? 'kopf)' : 'wert'); continue;
    }
    i++; art = 'op';
  }
  if (st.length) { if (!kaputt || st[0].pos < fehler) fehler = st[0].pos; kaputt = true; }
  return { paare, offen, fn, kaputt, fehler };
}
// Je Deklaration ihr Zeilenbereich [von, bis]. Ein Block, der nicht aufgeht: bis vor die naechste Deklaration
// mit GLEICHER ODER KLEINERER Einrueckung (sonst schnitte ein innerer Helfer die aeussere Funktion ab — der
// „im"-Fehler aus Runde 2), hoechstens bis zum Blockende; der Block steht dann in `unsicherBloecke`.
// Zwischengespeichert je Modus (html ja/nein) UND Text: ein zweiter Aufruf mit anderem Modus rechnet neu.
const bereichCache = { h: new Map(), j: new Map() };
export function funktionsBereiche(text, html) {
  if (!text) return { bereiche: [], innen: [], eltern: [], unsicher: false, unsicherBloecke: [] };
  const modus = html === undefined ? /<script\b/i.test(text) : !!html, cache = bereichCache[modus ? 'h' : 'j'];
  if (cache.has(text)) return cache.get(text);
  const zeilenAnf = [0];
  for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) zeilenAnf.push(i + 1);
  const zeileVon = (pos) => { let lo = 0, hi = zeilenAnf.length - 1; while (lo < hi) { const mi = (lo + hi + 1) >> 1; if (zeilenAnf[mi] <= pos) lo = mi; else hi = mi - 1; } return lo + 1; };
  const dekl = deklarationen(text), bereiche = [], unsicherBl = new Map();
  // Je Deklaration die naechste, die nicht tiefer eingerueckt ist (ein Durchgang von hinten).
  const naechsteGleich = new Int32Array(dekl.length).fill(-1);
  for (let k = dekl.length - 1, sk = []; k >= 0; k--) {
    while (sk.length && dekl[sk[sk.length - 1]].einzug > dekl[k].einzug) sk.pop();
    naechsteGleich[k] = sk.length ? sk[sk.length - 1] : -1; sk.push(k);
  }
  const bl = jsBereiche(text, modus).map(([a, b]) => Object.assign({ a, b }, klammernPaaren(text, a, b)));
  const erste = (liste, pos) => { let lo = 0, hi = liste.length; while (lo < hi) { const mi = (lo + hi) >> 1; if (liste[mi].pos > pos) hi = mi; else lo = mi + 1; } return lo; };
  dekl.forEach((d, k) => {
    const anf = zeilenAnf[d.zeile - 1], naechste = d.zeile < zeilenAnf.length ? zeilenAnf[d.zeile] : text.length;
    const blk = bl.find(x => x.a <= anf + 1 && anf < x.b) || bl.find(x => anf <= x.a && x.a < naechste);
    if (!blk) return;   // ausserhalb jedes Skripts (ein Wort in HTML oder CSS)
    let bis = null;
    if (!blk.kaputt) {
      const f = blk.fn.find(p => p >= anf && p < naechste);
      if (f == null) return;   // die Zeile sieht nur so aus: sie steht in einem Kommentar oder einer Zeichenkette
      const iP = erste(blk.offen, f), par = blk.offen[iP];
      const zuP = par && par.ch === '(' ? blk.paare.get(par.pos) : null;
      if (zuP != null) { const iB = erste(blk.offen, zuP), kb = blk.offen[iB]; const zuB = kb && kb.ch === '{' ? blk.paare.get(kb.pos) : null; if (zuB != null) bis = zeileVon(zuB); }
    }
    if (bis == null) {
      const ende = zeileVon(blk.b), m = naechsteGleich[k];
      bis = m >= 0 ? Math.max(d.zeile, Math.min(ende, dekl[m].zeile - 1)) : Math.max(d.zeile, ende);
      let u = unsicherBl.get(blk);
      if (!u) unsicherBl.set(blk, u = { von: zeileVon(blk.a), bis: ende, ab: blk.kaputt ? zeileVon(blk.fehler) : d.zeile, namen: [] });
      u.namen.push(d.name);
    }
    bereiche.push({ von: d.zeile, bis, name: d.name });
  });
  bereiche.sort((x, y) => x.von - y.von || y.bis - x.bis);
  // Je Zeile die innerste Funktion, je Funktion die umschliessende — ein Durchgang.
  const n = zeilenAnf.length, innen = new Int32Array(n + 2).fill(-1), eltern = new Int32Array(bereiche.length).fill(-1), st = [];
  let r = 0;
  for (let z = 1; z <= n; z++) {
    while (r < bereiche.length && bereiche[r].von === z) {
      while (st.length && bereiche[st[st.length - 1]].bis < z) st.pop();
      eltern[r] = st.length ? st[st.length - 1] : -1; st.push(r); r++;
    }
    while (st.length && bereiche[st[st.length - 1]].bis < z) st.pop();
    innen[z] = st.length ? st[st.length - 1] : -1;
  }
  const unsicherBloecke = [...unsicherBl.values()];
  const aus = { bereiche, innen, eltern, unsicher: unsicherBloecke.length > 0, unsicherBloecke };
  if (cache.size > 4) cache.delete(cache.keys().next().value);
  cache.set(text, aus);
  return aus;
}
function namenDerZeile(fb, zeile) { const n = []; for (let k = fb.innen[zeile] == null ? -1 : fb.innen[zeile]; k >= 0; k = fb.eltern[k]) n.push(fb.bereiche[k].name); return n; }
// Die Funktionen eines Diffs (-U0): je Hunk die Zeilen der ALTEN Seite (eine ganz geloeschte Funktion zaehlt)
// und die der NEUEN. Eine Menge — mit zwei Angaben daran: `hunks` (wie viele Koepfe gelesen wurden) und
// `unsicher` (beruehrte Bloecke, die nicht aufgehen: ab welcher Zeile, welche Funktionen darin).
export function funktionenAusDiff(diff, altText, neuText) {
  const alt = funktionsBereiche(altText), neu = funktionsBereiche(neuText), aus = new Set(), beruehrt = new Set();
  let hunks = 0;
  const zeile = (fb, z) => {
    namenDerZeile(fb, z).forEach(x => aus.add(x));
    for (const u of fb.unsicherBloecke) if (z >= u.von && z <= u.bis) beruehrt.add(u);
  };
  for (const m of String(diff).matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)) {
    hunks++;
    const a = +m[1], an = m[2] == null ? 1 : +m[2], c = +m[3], cn = m[4] == null ? 1 : +m[4];
    for (let i = 0; i < an; i++) zeile(alt, a + i);
    for (let i = 0; i < cn; i++) zeile(neu, c + i);
  }
  aus.hunks = hunks;
  aus.unsicher = beruehrt.size ? { ab: Math.min(...[...beruehrt].map(u => u.ab)), bloecke: [...beruehrt].map(u => u.von + '–' + u.bis), namen: [...new Set([...beruehrt].flatMap(u => u.namen))].sort() } : null;
  // Kein Kopf gelesen, und die Seiten unterscheiden sich: der Diff ist nicht lesbar (Farbe, binaer, ein externes
  // Diff-Programm, das auch NICHTS ausgeben kann) — gesagt, nie still „keine Funktion". Gleiche Texte (nur der
  // Modus geaendert) sind keine Aenderung.
  aus.unlesbar = !hunks && (altText || '') !== (neuText || '');
  return aus;
}
// Was hat DIESE Sitzung geaendert? Seit dem Abzweigen UND heute anders als main — sonst zaehlt ein
// weiterbenutzter, squash-gemergter Branch alles mit, was laengst auf main liegt (gemessen: 240
// Dateien statt 0). Fuer index.html auf FUNKTIONEN. `bump` nur, wenn die Version SEIT DEM ABZWEIGEN
// geaendert ist — sonst „bumpte" jede Sitzung, hinter der main weitergezaehlt hat.
//   opts.basis: eine feste Basis (im PR die Basis-Seite des Merge-Commits, waechterBasis) — dann ist sie
//   zugleich „main"; sonst merge-base mit origin/main.
// `unsicher` ({ab, grund, namen}): die eigene Aenderung liegt in einem <script>-Block, der nicht aufgeht
// (gegen die Abzweigstelle UND gegen main), oder der Diff war nicht lesbar — dann gilt jeder Halt auf eine
// Funktion in `namen` als beruehrt. Zu viel melden ist hier besser als schweigen.
// Der Diff laeuft ohne Farbe, ohne externes Diff-Programm und ohne textconv: eine Einstellung der Person
// (color.ui=always, diff.external) machte die Hunk-Koepfe unlesbar, und jeder Funktions-Halt verstummte.
const DIFF_U0 = ['diff', '--no-color', '--no-ext-diff', '--no-textconv', '-U0'];
export function eigeneAenderung(wurzel, opts) {
  opts = opts || {};
  let MAIN = 'refs/remotes/origin/main', basis;
  if (opts.basis) { basis = opts.basis; MAIN = opts.basis; }
  else {
    if (git(wurzel, ['rev-parse', '--verify', '--quiet', MAIN]) == null) return { grund: 'origin/main ist nicht bekannt (erst `holen`)' };
    basis = (git(wurzel, ['merge-base', 'HEAD', MAIN]) || '').trim();
    if (!basis) return { grund: 'kein gemeinsamer Vorfahr mit origin/main (flacher Klon? `git fetch --unshallow`)' };
  }
  const namen = (args) => new Set((git(wurzel, args) || '').split('\n').map(x => x.trim()).filter(Boolean));
  const neuDa = namen(['ls-files', '--others', '--exclude-standard']);
  // --no-renames: bei einer Umbenennung zaehlen der alte UND der neue Name.
  const seitBasis = namen(['diff', '--name-only', '--no-renames', basis]), gegenMain = namen(['diff', '--name-only', '--no-renames', MAIN]);
  neuDa.forEach(n => { seitBasis.add(n); gegenMain.add(n); });
  // Eintraege des Bretts beruehren nie einen Halt — sonst haelt ein Halt auch die Antwort darauf an.
  const dateien = [...seitBasis].filter(n => gegenMain.has(n) && n.indexOf('docs/austausch/') !== 0).sort();
  let funktionen = [], unsicher = null;
  if (dateien.indexOf('index.html') >= 0) {
    let hier = null; try { hier = fs.readFileSync(path.join(wurzel, 'index.html'), 'utf8'); } catch (_) {}
    const tBasis = git(wurzel, ['show', basis + ':index.html']), tMain = git(wurzel, ['show', MAIN + ':index.html']);
    const fa = funktionenAusDiff(git(wurzel, DIFF_U0.concat([basis, '--', 'index.html'])) || '', tBasis, hier);
    const fm = funktionenAusDiff(git(wurzel, DIFF_U0.concat([MAIN, '--', 'index.html'])) || '', tMain, hier);
    funktionen = [...fa].filter(x => fm.has(x)).sort();
    if (fa.unlesbar || fm.unlesbar) {
      const alle = new Set();
      for (const t of [tBasis, tMain, hier]) funktionsBereiche(t).bereiche.forEach(x => alle.add(x.name));
      unsicher = { ab: null, grund: 'der Diff von index.html hat keinen lesbaren Hunk-Kopf (liest git die Datei als binaer, oder formt eine Einstellung den Diff um?)', namen: [...alle].sort() };
    } else if (fa.unsicher && fm.unsicher) {
      unsicher = { ab: Math.min(fa.unsicher.ab, fm.unsicher.ab), grund: 'ein <script>-Block geht nicht auf (Zeilen ' + [...new Set(fa.unsicher.bloecke.concat(fm.unsicher.bloecke))].join(', ') + ')', namen: [...new Set(fa.unsicher.namen.concat(fm.unsicher.namen))].sort() };
    }
  }
  const v = (t) => ((t || '').match(SW_VERSION) || [])[1] || null;
  let swHier = null; try { swHier = fs.readFileSync(path.join(wurzel, 'sw.js'), 'utf8'); } catch (_) {}
  const vHier = v(swHier), vMain = v(git(wurzel, ['show', MAIN + ':sw.js'])), vBasis = v(git(wurzel, ['show', basis + ':sw.js']));
  return { basis, dateien, funktionen, unsicher, bump: !!(vHier && vHier !== vBasis && vHier !== vMain) };
}
// Welche Geltung eines Halts beruehrt diese Aenderung? Ein Name ohne / und ohne Punkt kann eine
// Funktion ODER eine Datei sein (`_headers`, `_redirects`) — beides zaehlt. Liegt die Aenderung in einem
// Block, dessen Grenzen nicht bestimmbar sind, gilt jede Funktion darin als beruehrt — gekennzeichnet.
export function haltBeruehrt(h, aend) {
  if (!aend || aend.grund) return [];
  const t = [];
  for (const g0 of alsListe(h.geltung)) {
    const g = geltungNorm(g0);
    if (g === 'bump') { if (aend.bump) t.push('bump'); continue; }
    if (/^[A-Za-z_$][\w$]*$/.test(g)) {
      const unsicher = !!aend.unsicher && alsListe(aend.unsicher.namen).indexOf(g) >= 0;
      if (unsicher || aend.funktionen.indexOf(g) >= 0) t.push(g + '()' + (unsicher ? ' — Grenzen unsicher' : ''));
    }
    const pre = g.replace(/\/+$/, '');
    for (const d of aend.dateien) if (d === pre || d.indexOf(pre + '/') === 0) t.push(d);
  }
  return [...new Set(t)];
}

// Welche WIRKSAMEN Halts beruehrt DIESER Stand — die auf main UND die auf jedem anderen Branch, den git
// kennt (ein Halt einer laufenden Sitzung liegt auf deren Branch und kommt nie in den Baum eines fremden
// PR: `ernten` holt ihn nicht)? Im PR gegen die Basis-Seite des Merge-Commits; der eigene PR-Branch
// (GITHUB_HEAD_REF) ist „ich". Ein Bericht fuer den, der merged (austausch_check A8) — keine Sperre.
export function haltsDiesesStands(wurzel, umgebung, jetzt) {
  umgebung = umgebung || {};
  const wb = waechterBasis(wurzel, umgebung);
  if (wb.grund) return { grund: wb.grund };
  const aend = eigeneAenderung(wurzel, umgebung.GITHUB_EVENT_NAME === 'pull_request' ? { basis: wb.basis } : {});
  if (aend.grund) return { grund: aend.grund };
  const ez = eigenerZweig(wurzel), ich = umgebung.GITHUB_HEAD_REF ? 'sitzung/' + umgebung.GITHUB_HEAD_REF : (ez.name ? 'sitzung/' + ez.name : null);
  const b = brettLesen(wurzel, { alleRefs: true }), wo = b.gitDa ? b.wo : null;
  // NICHT RECHENBAR (nichtPruefbar) ist, was ein „keiner beruehrt diesen Stand" vortaeuschen wuerde:
  // (1) Kein einziger Branch sichtbar — im PR-Checkout nur refs/remotes/pull/<n>/merge, wenn der Schritt
  //     „Branches fuer das Brett" fehlt oder scheitert. Gemessen (Gegenpruefung 3): „ok A8 … 0 wirksame
  //     Halt(s) auf 1 Remote-Refs … keiner beruehrt diesen Stand", waehrend auf claude/andere ein Halt lag.
  // (2) Eintragsdateien, deren Blob fehlt (Teilabruf), wenn nicht feststeht, dass sie zu gross fuer einen
  //     Eintrag sind: `--filter=blob:limit=<n>` laesst nur Blobs ab n Bytes weg — liegt n ueber
  //     EINTRAG_MAX_BYTES, waere jede fehlende Datei ohnehin unlesbar („groesser als 64 KB — kein Eintrag")
  //     und kann keinen Halt tragen. Bei blob:none, unbekanntem Filter oder n ≤ 64 KB koennte sie es.
  const zweige = (git(wurzel, ['for-each-ref', '--format=%(refname)', 'refs/remotes']) || '').split('\n').filter(x => x && !/\/HEAD$/.test(x) && !/^refs\/remotes\/pull\//.test(x));
  if (b.gitDa && !zweige.length) return { grund: 'nur ' + b.refs + ' Remote-Ref(s) sichtbar und kein Branch — Halts auf anderen Branches sind von hier nicht zu sehen (in der CI fehlt der Schritt „Branches fuer das Brett" oder er scheiterte; lokal: git fetch origin)', nichtPruefbar: true, refs: b.refs };
  const grenze = new Map(), grenzeVon = (quelle) => { const r = String(quelle).split('/')[0]; if (!grenze.has(r)) grenze.set(r, teilabrufGrenze(wurzel, r)); return grenze.get(r); };
  const offenFehlend = b.fehlend.filter(x => !(grenzeVon(x.quelle) > EINTRAG_MAX_BYTES));
  if (offenFehlend.length) return { grund: offenFehlend.length + ' Eintragsdatei(en) nicht im lokalen Objektspeicher (Teilabruf) und nicht nachweislich zu gross fuer einen Eintrag — darin koennte ein Halt liegen: ' + offenFehlend.slice(0, 3).map(x => x.pfad + ' {' + x.quelle + '}').join(', ') + (offenFehlend.length > 3 ? ' … +' + (offenFehlend.length - 3) : ''), nichtPruefbar: true, refs: b.refs, fehlend: b.fehlend.length };
  const sw = schwarm(b.eintraege, jetzt == null ? Date.now() : jetzt, { wo, ich });
  const meins = (e) => !!ich && e.von === ich && vonPasst(e, wo, ich);
  const treffer = sw.halts.filter(h => !h.veto && !meins(h.e)).map(h => ({ h, t: haltBeruehrt(h.e, aend) })).filter(x => x.t.length);
  // `unsicher`: die Funktionsgrenzen dort, wo dieser Stand index.html aendert, sind nicht bestimmbar — dann
  // stehen die Halts auf Funktionen darin mit „Grenzen unsicher" unter `treffer`. `fehlend`: Eintragsdateien, deren
  // Blob der Teilabruf nicht holte (alle nachweislich zu gross fuer einen Eintrag — sonst oben „nicht pruefbar").
  return { aend, halts: sw.halts, treffer, refs: b.refs, ich, unsicher: aend.unsicher || null, fehlend: b.fehlend.length, fehlendAb: b.fehlend.length ? Math.min(...b.fehlend.map(x => grenzeVon(x.quelle))) : null };
}
// Wer arbeitet laut git an einem offenen Eintrag? Niemand muss es melden: (a) seine Stelle (der Anker)
// wurde auf einem frischen Branch NACH dem Eintrag geaendert; (b) seine id steht in einer
// Commit-Nachricht eines Branches, auf dem er nicht ANGELEGT wurde.
export const IDS_JE_COMMIT_MAX = 3;
export function inArbeitAusGit(wurzel, eintraege, jetzt, tage, wo) {
  const MAIN = 'refs/remotes/origin/main', aus = new Map();
  if (git(wurzel, ['rev-parse', '--verify', '--quiet', MAIN]) == null) return aus;
  const { rueck, zustand, proId } = ableiten(eintraege);
  const offen = eintraege.filter(e => zustand.get(e.id).z === 'offen' && ['befund', 'idee', 'frage', 'klasse'].indexOf(e.art) >= 0);
  const offenIds = new Set(offen.map(e => e.id));
  // Gemessen wird nur ein Anker, der DIESEN Baum beschreibt (Arbeitsbaum, main): der Anker eines Eintrags
  // von einem fremden Branch nennt dessen Code — und 1 200 solche Eintraege kosteten je 40 ms git (49 s).
  const verankert = offen.filter(e => imBaum(e) || (e._quellen && [...e._quellen].some(istMainRef)));
  const dazu = (id, ref, wie) => { if (!aus.has(id)) aus.set(id, []); if (!aus.get(id).some(x => x.ref === ref)) aus.get(id).push({ ref, wie }); };
  // Je BLOB einmal lesen: viele Branches teilen dieselbe Abzweigstelle.
  const cache = new Map(), zeige = (rev, datei) => {
    const blob = (git(wurzel, ['rev-parse', '--verify', '--quiet', rev + ':' + datei]) || '').trim();
    if (!blob) return null;
    if (!cache.has(blob)) cache.set(blob, messtext(datei, git(wurzel, ['cat-file', 'blob', blob])));
    return cache.get(blob);
  };
  for (const z of frischeZweige(wurzel, jetzt, tage) || []) {
    const voll = 'refs/remotes/' + z.ref, mb = (git(wurzel, ['merge-base', MAIN, voll]) || '').trim();
    if (!mb) continue;
    // Squash-Merge: ein gemergter, stehengebliebener Branch unterscheidet sich nicht mehr von main.
    const gegenMain = new Set((git(wurzel, ['diff', '--name-only', MAIN, voll]) || '').split('\n').filter(Boolean));
    if (!gegenMain.size) continue;
    const geaendert = new Set((git(wurzel, ['diff', '--name-only', mb, voll]) || '').split('\n').filter(n => n && gegenMain.has(n)));
    // Je (Branch, Datei) EINMAL die Commits mit Zeit, aelteste zuerst — dann je Eintrag eine Suche darin.
    const commits = new Map(), commitsVon = (datei) => {
      if (!commits.has(datei)) commits.set(datei, (git(wurzel, ['log', '--reverse', '--format=%H %ct', mb + '..' + voll, '--', datei]) || '').split('\n').filter(Boolean).map(x => { const [h, t] = x.split(' '); return { h, t: Number(t) * 1000 }; }));
      return commits.get(datei);
    };
    for (const e of verankert) for (const a of ankerWirksam(e, rueck)) {
      if (!geaendert.has(a.datei)) continue;
      const vor = zeige(mb, a.datei), nach = zeige(voll, a.datei);
      if (!(vor != null && vor.indexOf(a.text) >= 0 && (nach == null || nach.indexOf(a.text) < 0))) continue;
      // Nur eine Aenderung NACH dem Eintrag ist Arbeit daran — stand die Stelle beim letzten Commit VOR
      // dem Eintrag noch da (oder gab es keinen), wurde sie danach geaendert.
      const t0 = zeitpunkt(e) || Date.parse(e.datum + 'T00:00:00Z');
      const liste = commitsVon(a.datei), vorher = liste.filter(c => c.t < t0 - 1000).pop();
      if (!liste.some(c => c.t >= t0 - 1000)) continue;
      const damals = vorher ? zeige(vorher.h, a.datei) : vor;
      if (damals == null || damals.indexOf(a.text) < 0) continue;
      dazu(e.id, z.ref, 'Stelle dort geaendert'); break;
    }
    // Eine Commit-Nachricht, die viele ids nennt, ist eine Liste, keine Arbeit: sonst markierte EIN Commit
    // „Arbeit an <alle ids>" alles als „in Arbeit", und KRITISCH sagte nie mehr „niemand dran".
    for (const nachricht of (git(wurzel, ['log', '--format=%x00%B', mb + '..' + voll]) || '').split('\0')) {
      const ids = [...new Set([...nachricht.matchAll(/\b(\d{4}-\d{2}-\d{2}-[0-9a-f]{4}(?:[0-9a-f]{4})?)\b/g)].map(m => m[1]))];
      if (!ids.length || ids.length > IDS_JE_COMMIT_MAX) continue;
      for (const id of ids) {
        if (!offenIds.has(id)) continue;
        // Ausgenommen ist nur der Branch, auf dem der Eintrag ANGELEGT wurde (an der Abzweigstelle
        // lag er noch nicht) — wer ihn von main erbt, hat ihn nicht geschrieben.
        const w = wo && wo.get(id), e = proId.get(id);
        if (w && w.has(z.ref) && e && e._pfad && git(wurzel, ['cat-file', '-e', mb + ':' + e._pfad]) == null) continue;
        dazu(id, z.ref, 'im Commit genannt');
      }
    }
  }
  return aus;
}

// ── Waechter 1: nichts verschwindet, nichts wird umgeschrieben — gegen die ABZWEIGSTELLE (lokal
//    merge-base mit origin/main, in CI die Basis-Seite des PR-Merge-Commits), nie gegen die
//    bewegliche Spitze von main: gegen die waeren 15 von 17 frischen Branches rot gewesen, ohne
//    etwas geloescht zu haben (gemessen 17.11.2026). Erlaubt: was auf der Grabstein-Liste steht.
export function waechterBasis(wurzel, umgebung) {
  const ist = (args) => { const x = git(wurzel, args); return x == null ? null : x.trim(); };
  if ((umgebung || {}).GITHUB_EVENT_NAME === 'pull_request') {
    const b = ist(['rev-parse', '--verify', '--quiet', 'HEAD^1']);
    return b ? { basis: b, woher: 'HEAD^1 (Basis des PR-Merge-Commits)' } : { grund: 'HEAD^1 fehlt — actions/checkout braucht fetch-depth: 2' };
  }
  if (ist(['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main']) == null) return { grund: 'origin/main ist nicht bekannt (`git fetch origin main`) — ohne Abzweigstelle laesst sich nicht sagen, was verschwunden ist' };
  const b = ist(['merge-base', 'HEAD', 'refs/remotes/origin/main']);
  if (!b) return { grund: 'kein gemeinsamer Vorfahr mit origin/main (flacher Klon)' };
  // Basis == HEAD bei sauberem Baum: es gibt nichts, was verschwunden sein koennte — das ist keine Aussage.
  const kopf = ist(['rev-parse', 'HEAD']), sauber = (git(wurzel, ['status', '--porcelain', '--', ORDNER]) || '').trim() === '';
  if (b === kopf && sauber) return { leer: true, grund: 'keine Abzweigstelle: HEAD hat keinen eigenen Commit, und im Brett ist nichts geaendert — nichts kann verschwunden sein' };
  return { basis: b, woher: 'merge-base(HEAD, origin/main)' };
}
export function geloeschtSeit(wurzel, basis) {
  const ls = git(wurzel, ['ls-tree', '-r', '-z', basis, '--', ORDNER + '/']);
  if (ls == null) return { grund: 'Basis ' + basis + ' ist nicht lesbar' };
  const gs = grabsteine(wurzel, false), grab = gs.ids, fehlt = [], anders = [];
  let n = 0;
  const z = ls.split('\0').map(x => x.match(/^\d+ blob ([0-9a-f]+)\t(.+\.json)$/)).filter(Boolean);
  const inhalt = blobsLesen(wurzel, z.map(m => m[1]));
  for (const m of z) {
    n++;
    let hier = null; try { hier = fs.readFileSync(path.join(wurzel, m[2])); } catch (_) {}
    if (hier == null) { if (!grab.has(idAusName(path.posix.basename(m[2]))) && !gs.blobs.has(m[1])) fehlt.push(m[2]); continue; }
    const alt = inhalt.get(m[1]);
    if (alt != null && !alt.equals(hier)) anders.push(m[2]);
  }
  return { n, fehlt, anders };
}

// ── Die Sicherung: was der Waechter (eine Action, ohne Sitzung) stuendlich nach `zz-sicherung` schreibt.
//    Jeder Lauf baut den Stand AUS DEM NICHTS — ein leerer Index, nur gepruefte Dateien unter festen Namen,
//    gelesen ueber git, nie ueber ein ausgechecktes Verzeichnis: vorher uebernahm er den Baum der Sicherung
//    ungeprueft, und eine .gitignore, ein Symlink oder eine fremde Datei dort legte ihn lahm oder machte
//    „gesichert" zur blossen Behauptung (Gegenpruefung 2). Gesichert wird JEDE Fassung eines Eintrags —
//    byte-gleich, ohne Geheimnisse, ohne Grabsteine: unter eintraege/ die Fassung, die in diesem Lauf fuer
//    Leser GILT (vorher die erste — nach dem Loeschen des Branches holte `ernten` still den veralteten Stand
//    zurueck, Gegenpruefung 3), jede andere unter fassungen/<id>/<blob>.json. Was NUR noch hier liegt, hat
//    ein Branch verloren.
//      opts.alt      — der bisherige Stand (Commit von zz-sicherung) oder null
//      opts.stand    — das Gedaechtnis des letzten ERFOLGREICHEN Laufs (ausserhalb der Sicherung: Actions-Cache)
//      opts.standNeu — wohin das neue Gedaechtnis geht; die Action legt es erst nach dem Push ab
//      opts.jetzt    — die Uhr (ms), fuer den Pruefstand
export const SICHERUNG_README = ['# zz-sicherung — die Sicherung des Bretts', '', 'Geschrieben vom Brett-Waechter (.github/workflows/brett-waechter.yml auf main).',
  'Byte-gleiche Kopien jeder Eintragsdatei jedes Branches, je Lauf EIN Stand ohne Geschichte. Nie von Hand aendern — der naechste Lauf baut den Stand neu.',
  'Unter eintraege/ liegt je id die Fassung, die zuletzt fuer Leser galt; unter fassungen/ jede weitere (umgeschrieben, oder auf zwei Branches verschieden);',
  'unter quarantaene/ eine einmal gesicherte Fassung, die die heutigen Leseregeln nicht mehr annehmen.', 'Regeln: docs/austausch/README.md auf main.', ''].join('\n');
export const QUARANTAENE = 'docs/austausch/quarantaene';
// Eine abgeloeste Fassung, deren Eintrag auf main liegt und die so lange auf keinem Branch mehr lag, wird abgebaut —
// sonst blieb jede Berichtigung fuer immer (Gegenpruefung 3: fuenf Kopien einer id nach Merge und Loeschen).
export const SICHERUNG_ABBAU_TAGE = 30;
function gitRoh(wurzel, args, env, input) {
  const r = cp.spawnSync('git', ['-C', wurzel, '-c', 'core.quotePath=false'].concat(args), { input, env: Object.assign({}, process.env, env || {}), maxBuffer: 256 * 1024 * 1024 });
  return r && r.status === 0 ? String(r.stdout) : null;
}
const geheimIn = (e, roh, datei) => GEHEIM.find(([re]) => re.test((e ? textVon(e) : '') + '\n' + (roh || '') + '\n' + (datei || '')));
const ortKennung = (quelle, pfad) => crypto.createHash('sha1').update(String(quelle) + '\0' + String(pfad)).digest('hex').slice(0, 16);
export function sicherungSchreiben(wurzel, opts) {
  opts = opts || {};
  const jetzt = opts.jetzt != null ? opts.jetzt : Date.now(), jetztIso = new Date(jetzt).toISOString();
  const brett = brettLesen(wurzel, { alleRefs: true });
  const aus = { baum: null, neu: [], weitere: [], gleich: 0, uebersprungen: [], entfernt: [], nurHier: [], refs: brett.refs, unlesbar: [], verworfen: [],
    strittig: brett.strittig.map(x => x.id), fehlenInSicherung: [], unwiederbringlich: [], neuVerloren: [], unlesbarWeg: [], unlesbarEntfernt: [], uebersprungenWeg: [],
    zurueckgenommen: [], vomSchreiber: [], umgelegt: [], abgebaut: [], doppelt: [], alarm: [], erstlauf: false, warnung: null };
  if (!brett.gitDa) return Object.assign(aus, { grund: 'git ist nicht verfuegbar' });
  if (!brett.refs) return Object.assign(aus, { grund: 'kein Remote-Ref sichtbar — nichts geholt, nichts gesichert' });
  const gs = grabsteine(wurzel, true), grab = gs.ids, grabBlob = gs.blobs;
  // 0. Das Gedaechtnis des letzten erfolgreichen Laufs (ohne Titel: ids, Blobs, Quellen, Zeiten).
  let alt = null;
  if (opts.stand) { try { alt = JSON.parse(fs.readFileSync(opts.stand, 'utf8')); } catch (_) {} }
  const ged = new Map();   // blob → { id, erst, zuletzt, orte }
  if (alt && Array.isArray(alt.fassungen)) for (const x of alt.fassungen) if (x && typeof x.blob === 'string') ged.set(x.blob, x);
  const gedQuar = new Set(alt && Array.isArray(alt.quarantaene) ? alt.quarantaene.filter(x => x && x.blob).map(x => x.blob) : []);
  // 1. Der bisherige Stand, ueber git gelesen: nur normale Dateien unter den festen Namen, nur gueltige Eintraege.
  //    Was einmal gesichert war (das Gedaechtnis kennt den Blob), entfernt nur ein Grabstein — oder ein Geheimnis:
  //    liegt es verschoben, wird es an seinen Platz gelegt; nehmen es die heutigen Leseregeln nicht mehr an, kommt
  //    es in die Quarantaene (vorher vernichtete der Waechter selbst die einzige Kopie, Gegenpruefung 3).
  const vorhanden = new Map();   // blob → { id, pfad, prim, e }
  const vorherRoh = new Set();   // jeder Blob, der im alten Stand lag (gleich wo)
  const quarantaene = new Map(); // blob → { id }
  if (opts.alt) {
    const ls = gitRoh(wurzel, ['ls-tree', '-r', '-z', opts.alt]);
    if (ls == null) return Object.assign(aus, { grund: 'der bisherige Stand ' + opts.alt + ' ist nicht lesbar' });
    const kand = [];
    const ORD = ORDNER.replace(/\//g, '\\/'), FAS = FASSUNGEN.replace(/\//g, '\\/'), QUA = QUARANTAENE.replace(/\//g, '\\/');
    for (const z of ls.split('\0').filter(Boolean)) {
      const m = z.match(/^(\d+) (\w+) ([0-9a-f]+)\t(.+)$/);
      if (!m) continue;
      const [, mode, typ, blob, pfad] = m;
      if (typ === 'blob') vorherRoh.add(blob);
      if (pfad === 'README.md' && mode === '100644') continue;   // wird neu geschrieben
      const prim = pfad.match(new RegExp('^' + ORD + '\\/(\\d{4}-\\d{2})\\/([^/]+)$')), weit = pfad.match(new RegExp('^' + FAS + '\\/([^/]+)\\/([0-9a-f]{40})\\.json$')), quar = pfad.match(new RegExp('^' + QUA + '\\/([0-9a-f]{40})\\.json$'));
      const bekannt = typ === 'blob' && (ged.has(blob) || gedQuar.has(blob));
      if (mode !== '100644' || typ !== 'blob' || !(prim || weit || quar || bekannt)) { aus.verworfen.push({ id: null, blob, grund: mode === '120000' ? 'ein Symlink' : (typ !== 'blob' ? 'kein Blob (' + typ + ')' : 'kein Pfad der Sicherung') }); continue; }
      kand.push({ blob, pfad, prim, weit, quar, bekannt });
    }
    const inhalt = blobsLesen(wurzel, kand.map(k => k.blob)), weg = [];
    for (const k of kand) {
      const buf = inhalt.get(k.blob), roh = buf == null ? null : buf.toString('utf8');
      const e = roh == null ? null : lies(roh, k.prim ? k.prim[2] : null, 'zz-sicherung', weg, { ohneName: true });
      const geheim = roh != null && geheimIn(e, roh, k.prim ? k.prim[2] : '');
      if (geheim) { aus.verworfen.push({ id: e ? e.id : null, blob: k.blob, grund: 'sieht aus wie ' + geheim[1] + ' — entfernt' }); continue; }
      const nm = k.prim && e ? String(k.prim[2]).match(NAME_FORM) : null;
      const passt = e && (k.prim ? (k.prim[1] === e.id.slice(0, 7) && nm && nm[1] === e.id && nm[2] === e.art) : (k.weit ? (k.weit[1] === e.id && k.weit[2] === k.blob) : false));
      if (passt) { if (!vorhanden.has(k.blob)) vorhanden.set(k.blob, { id: e.id, pfad: k.pfad, prim: !!k.prim, e }); continue; }
      if (k.bekannt && e && blobKennung(buf) === k.blob) { if (!vorhanden.has(k.blob)) { vorhanden.set(k.blob, { id: e.id, pfad: FASSUNGEN + '/' + e.id + '/' + k.blob + '.json', prim: false, e }); aus.umgelegt.push({ id: e.id, blob: k.blob, grund: 'lag an einem falschen Platz der Sicherung' }); } continue; }
      if (k.bekannt && roh != null && blobKennung(buf) === k.blob) { const id = (ged.get(k.blob) || {}).id || null; quarantaene.set(k.blob, { id }); if (!k.quar) aus.umgelegt.push({ id, blob: k.blob, grund: 'nach den heutigen Leseregeln kein Eintrag mehr — in die Quarantaene' }); continue; }
      aus.verworfen.push({ id: e ? e.id : idAusName(path.posix.basename(k.pfad)), blob: k.blob, grund: 'kein gueltiger Eintrag unter diesem Namen' });
    }
  }
  const idsVorher = new Set([...vorhanden.values()].map(v => v.id));
  // 2. Jede Fassung jedes Branches (und des Arbeitsbaums) — die Sicherung selbst zaehlt nicht als Quelle.
  const echt = (q) => [...q].filter(x => !istSicherungsRef(x));
  const sichere = (id, e, blob, quelle) => {
    if (grab.has(id) || grabBlob.has(blob)) return false;
    const geheim = geheimIn(e, e._roh, e._datei);
    if (geheim) { aus.uebersprungen.push({ id, quelle, blob, von: e.von, grund: 'sieht aus wie ' + geheim[1] }); return false; }
    if (vorhanden.has(blob)) { aus.gleich++; return true; }
    // Ein Blob aus dem Arbeitsbaum muss erst in die Objekt-Datenbank (hash-object -w).
    if (gitRoh(wurzel, ['cat-file', '-e', blob]) == null) {
      const b = gitRoh(wurzel, ['hash-object', '-w', '--stdin'], null, Buffer.from(e._roh, 'utf8'));
      if (!b || b.trim() !== blob) { aus.uebersprungen.push({ id, quelle, blob, von: e.von, grund: 'Inhalt nicht in die Objekt-Datenbank zu schreiben' }); return false; }
    }
    vorhanden.set(blob, { id, pfad: FASSUNGEN + '/' + id + '/' + blob + '.json', prim: false, e });
    (idsVorher.has(id) ? aus.weitere : aus.neu).push({ id, quelle });
    return true;
  };
  for (const [id, liste] of brett.fassungen) for (const v of liste) { const q = echt(v.quellen); if (q.length) sichere(id, v.e, v.blob, q[0]); }
  for (const d of brett.doppeltFassungen || []) if (!istSicherungsRef(d.quelle) && sichere(d.id, d.e, d.blob, d.quelle)) aus.doppelt.push({ id: d.id, quelle: d.quelle });
  // 3. Grabsteine: jede Fassung der id (bzw. genau die genannte Fassung) geht — aus dem neuen Stand, und damit aus dem Branch.
  for (const [b, v] of [...vorhanden]) if (grab.has(v.id) || grabBlob.has(b)) { vorhanden.delete(b); if (aus.entfernt.indexOf(v.id) < 0) aus.entfernt.push(v.id); }
  for (const b of [...quarantaene.keys()]) { const q = quarantaene.get(b); if ((q.id && grab.has(q.id)) || grabBlob.has(b)) quarantaene.delete(b); }
  // 4. Unter eintraege/ liegt je id die Fassung, die GILT (brettLesen); sonst die bisherige; ist der Eintrag strittig
  //    und war nie eine gesichert, keine (alle unter fassungen/) — sonst entschiede die Sortierung, wer der Schreiber ist.
  const jeId = new Map();
  for (const [b, v] of vorhanden) { if (!jeId.has(v.id)) jeId.set(v.id, []); jeId.get(v.id).push(b); }
  for (const [id, blobs] of jeId) {
    const g = brett.gilt.get(id), alter = blobs.find(b => vorhanden.get(b).prim);
    let p = g && vorhanden.has(g.blob) ? g.blob : (alter || null);
    if (!p && !brett.strittig.some(x => x.id === id) && blobs.length) p = blobs.slice().sort((x, y) => String((ged.get(x) || {}).erst || '9').localeCompare(String((ged.get(y) || {}).erst || '9')) || x.localeCompare(y))[0];
    for (const b of blobs) {
      const v = vorhanden.get(b);
      if (b === p) { const name = (g && g.blob === b && g.e._datei) || (v.prim ? path.posix.basename(v.pfad) : v.e._datei) || (v.e.id + '-' + v.e.art + '-.json'); v.pfad = ORDNER + '/' + id.slice(0, 7) + '/' + name; v.prim = true; }
      else { v.pfad = FASSUNGEN + '/' + id + '/' + b + '.json'; v.prim = false; }
    }
  }
  // 5. Wo liegt jede Fassung JETZT (ohne die Sicherung)?
  const blobQuellen = new Map();
  for (const liste of brett.fassungen.values()) for (const v of liste) blobQuellen.set(v.blob, echt(v.quellen));
  for (const d of brett.doppeltFassungen || []) if (!istSicherungsRef(d.quelle)) blobQuellen.set(d.blob, (blobQuellen.get(d.blob) || []).concat([d.quelle]));
  const vomSchreiber = zurueckgezogenVomSchreiber(wurzel, [...vorhanden.values()].map(v => ({ id: v.id, von: v.e.von })));
  // 6. Was liegt NUR noch hier? Je FASSUNG v: verloren ist sie nicht, wenn sie auf einem Branch liegt — oder wenn der
  //    SCHREIBER (dasselbe `von`) seinen Eintrag zu Hause hat: auf main, im Arbeitsbaum oder auf seinem Branch
  //    (origin/<b>). Eine Kopie anderswo rettet nichts — auch nicht eine, die ihr `von` auf den eigenen Branch
  //    umschrieb (Gegenpruefung 3). Lag v selbst zu Hause und ist alles, was dort jetzt liegt, AELTER als v, hat
  //    der Schreiber zurueckgenommen (oder ein Force-Push hat zurueckgesetzt): ein Hinweis, kein Alarm, aber nie
  //    „Nichts verloren".
  const erstVon = (b) => (ged.get(b) || {}).erst || null;
  const zuHause = (q, von) => q === 'Arbeitsbaum' || istMainRef(q) || istAutorRef(q, autorZweig({ von }));
  for (const [b, v] of vorhanden) {
    if ((blobQuellen.get(b) || []).length) continue;
    const vs = vomSchreiber.get(v.id);
    if (vs) { if (!aus.vomSchreiber.some(x => x.id === v.id)) aus.vomSchreiber.push({ id: v.id, quelle: vs }); continue; }
    const heim = [...vorhanden].filter(([b2, v2]) => b2 !== b && v2.id === v.id && v2.e.von === v.e.von && (blobQuellen.get(b2) || []).some(q => zuHause(q, v.e.von))).map(([b2]) => b2);
    if (!heim.length) { aus.nurHier.push({ id: v.id, blob: b }); continue; }
    const warZuHause = ((ged.get(b) || {}).orte || []).some(q => zuHause(q, v.e.von)), e0 = erstVon(b);
    if (warZuHause && e0 && heim.every(h => erstVon(h) && erstVon(h) < e0)) aus.zurueckgenommen.push({ id: v.id, blob: b });
  }
  // 7. Abbau: abgeloeste Fassungen eines Eintrags, der auf main liegt, nach SICHERUNG_ABBAU_TAGE ohne Branch.
  const mainIds = new Set();
  for (const [id, liste] of brett.fassungen) if (liste.some(v => [...v.quellen].some(q => istMainRef(q) || q === 'Arbeitsbaum'))) mainIds.add(id);
  const nurHierB = new Set(aus.nurHier.map(x => x.blob));
  for (const [b, v] of [...vorhanden]) {
    if (v.prim || !mainIds.has(v.id) || nurHierB.has(b) || (blobQuellen.get(b) || []).length) continue;
    const z = (ged.get(b) || {}).zuletzt;
    if (z && jetzt - Date.parse(z) > SICHERUNG_ABBAU_TAGE * 864e5) { vorhanden.delete(b); aus.abgebaut.push({ id: v.id, blob: b }); }
  }
  // 8. Unlesbare Dateien: genannt (Quelle, id aus dem Namen, Blob — nie der Dateiname: er traegt den Titel), ins Gedaechtnis.
  const gueltigeOrte = new Set();
  for (const liste of brett.fassungen.values()) for (const v of liste) for (const [q, p] of v.pfade) gueltigeOrte.add(ortKennung(q, p));
  for (const u of brett.unlesbarOrte) if (!istSicherungsRef(u.quelle)) {
    const id = idAusName(path.posix.basename(u.pfad));
    if (id && grab.has(id)) continue;
    aus.unlesbar.push({ quelle: u.quelle, id, blob: u.blob, ort: ortKennung(u.quelle, u.pfad) });
  }
  // 9. Der neue Stand: ein leerer Index, README, die Fassungen und die Quarantaene.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brett-sicherung-')), env = { GIT_INDEX_FILE: path.join(tmp, 'index') };
  try {
    const readme = (gitRoh(wurzel, ['hash-object', '-w', '--stdin'], null, Buffer.from(SICHERUNG_README, 'utf8')) || '').trim();
    const zeilen = ['100644 blob ' + readme + '\tREADME.md'].concat([...vorhanden].map(([b, v]) => [b, v.pfad]).concat([...quarantaene.keys()].map(b => [b, QUARANTAENE + '/' + b + '.json']))
      .sort((x, y) => x[1] < y[1] ? -1 : 1).map(([b, p]) => '100644 blob ' + b + '\t' + p));
    if (!readme || gitRoh(wurzel, ['read-tree', '--empty'], env) == null || gitRoh(wurzel, ['update-index', '--index-info'], env, zeilen.join('\n') + '\n') == null) return Object.assign(aus, { grund: 'der neue Stand liess sich nicht bauen (git update-index)' });
    aus.baum = (gitRoh(wurzel, ['write-tree'], env) || '').trim() || null;
    if (!aus.baum) return Object.assign(aus, { grund: 'der neue Stand liess sich nicht bauen (git write-tree)' });
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} }
  // 10. Das Gedaechtnis: fehlt vor dem Lauf, was zuletzt gesichert war, wurde die Sicherung zurueckgesetzt.
  const ids = (l) => [...new Set(l.map(x => x.id).filter(Boolean))];
  if (alt && Array.isArray(alt.fassungen)) {
    aus.fehlenInSicherung = alt.fassungen.concat(Array.isArray(alt.quarantaene) ? alt.quarantaene : []).filter(x => x && x.blob && !vorherRoh.has(x.blob) && !grab.has(x.id) && !grabBlob.has(x.blob));
    aus.unwiederbringlich = aus.fehlenInSicherung.filter(x => !vorhanden.has(x.blob) && !quarantaene.has(x.blob));
    const vorherNur = new Set(Array.isArray(alt.nurHier) ? alt.nurHier : []);
    aus.neuVerloren = aus.nurHier.filter(x => !vorherNur.has(x.blob));
    // Eine unlesbare Datei verschwindet: am selben Ort liegt jetzt ein gueltiger Eintrag → repariert (still); ihr Branch
    // besteht noch → vom Schreiber entfernt (ein Hinweis); ihr Branch ist weg und ihr Eintrag nirgends → ALARM.
    const jetztU = new Set(aus.unlesbar.map(u => u.blob + u.ort)), refsJetzt = new Set((git(wurzel, ['for-each-ref', '--format=%(refname)', 'refs/remotes']) || '').split('\n').map(x => x.replace(/^refs\/remotes\//, '')).filter(Boolean));
    for (const u of Array.isArray(alt.unlesbar) ? alt.unlesbar : []) {
      if (!u || jetztU.has(u.blob + u.ort) || blobQuellen.has(u.blob) || (u.id && grab.has(u.id)) || gueltigeOrte.has(u.ort)) continue;
      if (refsJetzt.has(u.quelle) || (u.id && brett.fassungen.has(u.id))) aus.unlesbarEntfernt.push(u); else aus.unlesbarWeg.push(u);
    }
    // Eine Fassung, die wegen eines Geheimnis-Musters NIE gesichert wurde, verschwindet — und der Schreiber hat nichts zu Hause.
    const jetztS = new Set(aus.uebersprungen.map(x => x.blob));
    for (const x of Array.isArray(alt.uebersprungen) ? alt.uebersprungen : []) {
      if (!x || jetztS.has(x.blob) || blobQuellen.has(x.blob) || grab.has(x.id) || grabBlob.has(x.blob)) continue;
      const heim = [...brett.fassungen.get(x.id) || []].some(v => v.e.von === x.von && echt(v.quellen).some(q => zuHause(q, x.von)));
      if (!heim) aus.uebersprungenWeg.push(x);
    }
    if (aus.fehlenInSicherung.length) aus.alarm.push('Die Sicherung wurde zurueckgesetzt oder geloescht: ' + aus.fehlenInSicherung.length + ' gesicherte Fassung(en) fehlten vor diesem Lauf' + (aus.unwiederbringlich.length ? ', davon ' + aus.unwiederbringlich.length + ' auf keinem Branch mehr (verloren): ' + ids(aus.unwiederbringlich).join(', ') : ' (alle wieder gesichert)'));
    if (aus.neuVerloren.length) aus.alarm.push('Ein Branch wurde geloescht oder zurueckgesetzt: ' + aus.neuVerloren.length + ' Fassung(en) liegen nur noch in der Sicherung: ' + ids(aus.neuVerloren).join(', '));
    if (aus.unlesbarWeg.length) aus.alarm.push('Unlesbare Datei(en) mit ihrem Branch verschwunden (nicht gesichert — sie waren keine gueltigen Eintraege): ' + aus.unlesbarWeg.map(u => (u.id || 'ohne id') + ' {' + u.quelle + '} Blob ' + String(u.blob).slice(0, 8)).join(', '));
    if (aus.uebersprungenWeg.length) aus.alarm.push('Nie gesicherte Fassung(en) verschwunden (sie trugen etwas wie ein Geheimnis — pruefen, ob es eine Falschmeldung war): ' + aus.uebersprungenWeg.map(x => x.id + ' {' + x.quelle + '}').join(', '));
  } else if (opts.stand) {
    aus.erstlauf = true;
    if (!opts.alt) aus.warnung = 'Weder zz-sicherung noch ein Gedaechtnis — der erste Lauf, ODER beides ging verloren: dann ist nicht erkennbar, was fehlt.';
    else aus.warnung = 'Kein Gedaechtnis (Cache abgelaufen?) — ob seit dem letzten Lauf etwas verloren ging, ist nicht erkennbar; ab jetzt wieder.';
  }
  if (opts.stand || opts.standNeu) {
    const ziel = opts.standNeu || (opts.stand + '.neu');
    fs.mkdirSync(path.dirname(path.resolve(ziel)), { recursive: true });
    const fass = [...vorhanden].map(([blob, v]) => {
      const q = blobQuellen.get(blob) || [], g0 = ged.get(blob) || {};
      return { id: v.id, blob, von: v.e.von, erst: g0.erst || jetztIso, zuletzt: q.length ? jetztIso : (g0.zuletzt || jetztIso), orte: q.slice().sort() };
    }).sort((x, y) => x.id.localeCompare(y.id) || x.blob.localeCompare(y.blob));
    fs.writeFileSync(ziel, JSON.stringify({ stand: jetztIso, fassungen: fass, nurHier: aus.nurHier.map(x => x.blob).sort(),
      unlesbar: aus.unlesbar.map(u => ({ quelle: u.quelle, id: u.id, blob: u.blob, ort: u.ort })),
      uebersprungen: aus.uebersprungen.map(x => ({ id: x.id, quelle: x.quelle, blob: x.blob, von: x.von })),
      quarantaene: [...quarantaene].map(([blob, q]) => ({ id: q.id, blob })) }, null, 1) + '\n');
  }
  return aus;
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
    // Ein zeitgebundener Eintrag mit selbst gewaehltem Datum (2099) wirkte sonst unbegrenzt.
    if ((e.art === 'lage' || e.art === 'halt') && (r.datum || r.zeit || opts.datum)) fehler.push({ wo, grund: 'Datum und Zeit einer ' + (e.art === 'lage' ? 'Lage' : 'Halts') + ' setzt das Werkzeug (die Frist rechnet ab dem Schreiben)' });
    if (!e.datum) e.datum = datum;
    if (!e.zeit) e.zeit = opts.zeit || jetzt.zeit;
    if (!e.von && opts.von) e.von = opts.von;
    // Ein Unteragent schreibt im Namen der Sitzung, die die Runde fuhr — sonst war, was die Runde
    // schrieb, fuer niemanden „eigen", und Antworten darauf erreichten keinen (Gegenpruefung 2).
    if (/^runde\//.test(String(e.von || '')) && opts.sitzung) { e.rolle = e.von; e.von = opts.sitzung; }
    // Eine Lage oder ein Halt im Namen eines ANDEREN ist fuer alle anderen unwirksam — und gemergt (auf main traegt
    // jede) wirkte sie in fremdem Namen: ein „fertig" beendete dessen Uebernahmen (Gegenpruefung 3).
    //   opts.absichtVon — die Namen, die diese Sitzung fuer Lage und Halt tragen darf (das Werkzeug rechnet sie)
    if (opts.absichtVon && (e.art === 'lage' || e.art === 'halt') && opts.absichtVon.indexOf(e.von) < 0) fehler.push({ wo, grund: ARTEN[e.art].wort + ' von „' + e.von + '": hier schreibt ' + opts.absichtVon.join(' oder ') + ' — eine Absicht im Namen eines anderen wirkt fuer niemanden, und gemergt wirkte sie in fremdem Namen' });
    if (e.id) fehler.push({ wo, grund: 'eine id vergibt das Werkzeug — ein Eintrag wird nicht umgeschrieben' });
    else {
      for (let n = 0; n < 50 && !e.id; n++) { const id = (datumGueltig(e.datum) ? e.datum : datum) + '-' + crypto.randomBytes(4).toString('hex'); if (!belegt.has(id)) e.id = id; }
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
    if (e.art === 'halt') for (const g of geltungImBaum(wurzel, e.geltung)) fehler.push({ wo, grund: g });
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
  const zitiert = zitierteIds(fernandoText(liesRoh('STATUS.md'), liesRoh('docs/FUER-FERNANDO.md')));
  const vomSchreiber = brett.gitDa ? zurueckgezogenVomSchreiber(wurzel, brett.eintraege) : new Map();
  const geholt = [], uebergangen = brett.unlesbar.filter(u => u.quelle !== 'Arbeitsbaum').map(u => ({ id: u.datei, quelle: u.quelle, grund: u.grund }));
  let kand = [];
  for (const e of brett.eintraege) {
    if (imBaum(e)) continue;
    let grund = eintragPruefen(e, e._datei)[0] || bezugsRegeln(e, proId)[0] || null;
    // Vom Schreiber auf seinem Branch zurueckgezogen (Grabstein dort): nicht zurueckholen (Gegenpruefung 3).
    if (!grund && vomSchreiber.has(e.id)) grund = 'vom Schreiber zurueckgezogen (Grabstein auf ' + vomSchreiber.get(e.id) + ')';
    if (!grund && (e.art === 'halt' || e.art === 'lage')) grund = ARTEN[e.art].wort + ' ist eine Absicht von ' + e.von + ' auf Zeit, kein Wissen — er wirkt von seinem Branch aus und kommt nicht mit';
    if (!grund && e.dringlichkeit === 'kritisch' && !zitiert.has(e.id)) grund = 'kritisch, aber in diesem Baum nicht an Fernando weitergegeben — erst eine Zeile mit brett:' + e.id + ' in STATUS.md §2, dann ernten (sonst wird austausch_check A7 rot)';
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
