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
// `von`: wer schreibt — `sitzung/<branch>` (dieselbe Form wie `an`), `runde/<blickwinkel>` (aeltere Eintraege der
// Austausch-Runde, heute steht das in `rolle`) oder eine Rolle wie `koordinator`. Gemessen 18.11.2026 ueber den
// Arbeitsbaum und alle 143 Remote-Refs (806 Eintraege): nur `sitzung/…` und `runde/…`. Gegenpruefung 5: `von` war nur
// „ein nicht leerer Text" — ein `von` mit Zeilenumbruch schrieb ueber die STRITTIG-Zeile einen ganzen gefaelschten
// DICH-BETREFFEND-Block samt GELIEFERT-Befehl in die Ausgabe jedes Lesers. Keine Leer-, Steuer- und Formatzeichen.
export const VON_RUNDE = /^runde\/[A-Za-z0-9_-]{1,60}$/, VON_ROLLE = /^[A-Za-z][A-Za-z0-9_-]{0,59}$/;
export function vonGueltig(v) { return typeof v === 'string' && (AN_SITZUNG.test(v) || VON_RUNDE.test(v) || VON_ROLLE.test(v)); }
export const VON_FORM_TEXT = 'sitzung/<branch>, runde/<blickwinkel> oder eine Rolle wie koordinator — ohne Leer-, Steuer- und Formatzeichen';
// ── Text aus fremder Hand, bevor er GEDRUCKT wird (Gegenpruefung 5). Ein Titel, ein Dateiname, ein Ref-Name, ein Commit-
// Betreff, der Grund einer Zeile, die Felder eines fremden Eintrags: Steuer-, Format- und Bidi-Zeichen (Unicode Cc, Cf,
// Zl, Zp — ESC, Zeilenumbruch, Wagenruecklauf, U+202E …) werden zu sichtbarem Text, die Laenge wird gedeckelt. Vorher
// blendete ein Titel mit ESC[8m im Terminal den ganzen Rest der Ausgabe aus (DICH BETREFFEND, KRITISCH, HALT), ein
// Branch-Name mit U+202E drehte die Zeile um, und ein `von` mit Zeilenumbruch schrieb eigene Zeilen. Die Ersatzform ist
// \uXXXX (ein Zeichen jenseits von U+FFFF als zwei solche): in einer Zeile sichtbar, und in JSON eine gueltige
// Schreibweise DESSELBEN Zeichens — darum taugt sie auch fuer die letzte Wand vor stdout (ausgabeSicher).
// Gegenpruefung 5, Skeptiker (R5b-ausgabe-4): drei Format-Zeichen sind Teil des TEXTES, nicht seiner Steuerung — ZWNJ (U+200C)
// und ZWJ (U+200D) halten Schriftzeichen und Emoji zusammen (Familie, Regenbogenfahne, persische Woerter), der weiche Trennstrich
// (U+00AD) steht in Woertern. Vorher wurde jedes zu seiner Escape-Schreibweise (Backslash, u, 200d), und eine Familie stand als
// drei Koepfe mit Code dazwischen da.
// Harmlos sind sie nur MITTEN im Text: zwischen zwei sichtbaren Zeichen (Buchstabe, Zeichen, Ziffer, Symbol, Satzzeichen). Eine
// Kette solcher Zeichen (ein unsichtbarer Kanal aus ZWJ und ZWNJ) oder eines am Rand bleibt sichtbar gemacht; gefaehrlich bleiben
// Cc, Zl, Zp und jedes andere Cf (Bidi U+061C, U+200E/F, U+202A–202E, U+2066–2069, U+FEFF, die Tag-Zeichen U+E0000–E007F …).
const SICHTBAR = '\\p{L}\\p{M}\\p{N}\\p{S}\\p{P}', HARMLOS = '\\u00AD\\u200C\\u200D';
const unsichtbarMuster = (ausser) => new RegExp((ausser ? '(?![' + ausser + '])' : '') + '(?:[\\p{Cc}\\p{Zl}\\p{Zp}]|(?![' + HARMLOS + '])\\p{Cf}|(?<![' + SICHTBAR + '])[' + HARMLOS + ']|[' + HARMLOS + '](?![' + SICHTBAR + ']))', 'gu');
const UNSICHTBAR = unsichtbarMuster(null);
// Gegenpruefung 5b, Skeptiker (R5c-A1): NAMEN STRENG, PROSA NACHSICHTIG. Die Ausnahme fuer ZWJ, ZWNJ und weichen Trennstrich machte
// Ref-, Datei- und Quellnamen wieder verwechselbar: claude/a<U+200D>b und claude/a<U+00AD>b (git nimmt beide an) standen in `holen`
// als „origin/claude/ab" da — FRISCHE BRANCHES nannte dreimal denselben Namen, und der Schreiber auf claude/ab las „abweichend
// origin/claude/ab" ueber seinen eigenen Branch. Ein Name braucht kein unsichtbares Zeichen: fremd(s, max, { streng: true }) macht
// JEDES sichtbar — jedes Cc/Cf/Cs/Co/Cn, jedes Leerzeichen ausser U+0020 (U+00A0 sieht aus wie eines) und jedes Default-Ignorable-
// Zeichen, auch die, die keine Format-Zeichen sind (U+034F, die Variantenwaehler U+FE00–FE0F und U+E0100–E01EF, die Hangul-Fueller
// U+115F, U+1160, U+3164, U+FFA0). Gemessen 18.11.2026: git nimmt jedes davon in einem Branch-Namen an (check-ref-format --branch),
// und claude/a<U+034F>b sah auch unter c43c306 aus wie claude/ab. Titel und Text bleiben bei der nachsichtigen Regel oben.
const UNSICHTBAR_STRENG = /(?! )[\p{C}\p{Z}\p{Default_Ignorable_Code_Point}]/gu;
const alsEscape = (c) => { let s = ''; for (let i = 0; i < c.length; i++) s += '\\u' + c.charCodeAt(i).toString(16).padStart(4, '0'); return s; };
export function fremd(s, max, opt) {
  let t = String(s == null ? '' : s).replace(opt && opt.streng ? UNSICHTBAR_STRENG : UNSICHTBAR, alsEscape);
  if (max > 0) { const z = [...t]; if (z.length > max) t = z.slice(0, Math.max(0, max - 1)).join('') + '…'; }
  return t;
}
// Die letzte Wand vor stdout (das Werkzeug ruft sie fuer JEDE Zeile): dieselbe Ersetzung, nur Zeilenumbruch und Tabulator
// bleiben (das Werkzeug schreibt mehrzeilige Bloecke und eingerueckte Felder). Das Werkzeug selbst gibt keines dieser
// Zeichen aus — gemessen 18.11.2026: 0 in austausch.mjs und _austausch.mjs, 0 in den Feldern aller 166 Eintrags-Blobs,
// in Dateinamen, Branch-Namen und Commit-Betreffen aller Refs. Sie trifft also nur, was eine andere Stelle uebersah.
// Gegenpruefung 5b, Skeptiker (R5c-A1): die Wand kennt den Zusammenhang nicht — ob eine Zeile Prosa ist oder einen Ref-Namen traegt,
// den eine Stelle nicht streng gemacht hat (ein Befehl, ein Grund, ein `von`). Ein harmloses Zeichen (ZWJ, ZWNJ, SHY) bleibt hier nur
// roh, wenn es zwischen zwei sichtbaren Zeichen steht UND mindestens ein Nachbar ein sichtbares Nicht-ASCII-Zeichen ist (Emoji, die
// arabische, persische, indische Schrift): Familie und Regenbogenfahne bleiben ganz, „claude/a<U+200D>b" wird sichtbar. Ebenso die
// unsichtbaren Zeichen, die keine Format-Zeichen sind (U+034F, Variantenwaehler, Hangul-Fueller): roh nur neben einem sichtbaren
// Nicht-ASCII-Zeichen, das selbst nicht unsichtbar ist (U+2764 + U+FE0F, die Tastenkappe 1 + U+FE0F + U+20E3) — sonst sah ein `von` wie
// sitzung/claude/a<U+034F>b (AN_SITZUNG schliesst nur \p{C} und \p{Z} aus) in jeder Zeile aus wie das Original, und eine Kette
// a<U+034F><U+034F>b trug sich gegenseitig. Der Preis: ein weicher Trennstrich zwischen zwei ASCII-Buchstaben (Bau<U+00AD>stelle)
// steht als \u00ad da. Gemessen 18.11.2026 ueber den Arbeitsbaum und alle 143 Remote-Refs (167 Blobs, 3020 Textfelder): 3 solche
// Zeichen, alle U+FE0F hinter einem Emoji, keines zwischen zwei ASCII-Zeichen; 0 Branch- und 0 Dateinamen mit einem Nicht-ASCII-Zeichen.
const WAND_KANDIDAT = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}]/gu;
const IST_HARMLOS = /^[\u00AD\u200C\u200D]$/, IST_SICHTBAR = new RegExp('^[' + SICHTBAR + ']$', 'u'), IST_DI = /^\p{Default_Ignorable_Code_Point}$/u, IST_CF = /^\p{Cf}$/u;
// Das Zeichen VOR bzw. NACH einer Stelle als ganzer Code-Punkt (ein Emoji sind zwei UTF-16-Einheiten).
const zeichenVor = (t, i) => { if (i <= 0) return ''; const lo = t.charCodeAt(i - 1); if (lo >= 0xDC00 && lo <= 0xDFFF && i >= 2) { const hi = t.charCodeAt(i - 2); if (hi >= 0xD800 && hi <= 0xDBFF) return t.slice(i - 2, i); } return t[i - 1]; };
const zeichenNach = (t, j) => j >= t.length ? '' : String.fromCodePoint(t.codePointAt(j));
const echtNichtAscii = (c) => !!c && c.codePointAt(0) > 0x7f && IST_SICHTBAR.test(c) && !IST_DI.test(c);
function wandRoh(t, c, i) {
  if (c === '\n' || c === '\t') return true;                          // mehrzeilige Bloecke und eingerueckte Felder des Werkzeugs
  const cf = IST_CF.test(c);
  if (!cf && !IST_DI.test(c)) return false;                            // Cc, Zl, Zp
  if (cf && !IST_HARMLOS.test(c)) return false;                        // Bidi, U+FEFF, Tag-Zeichen …
  const a = zeichenVor(t, i), z = zeichenNach(t, i + c.length), nicht = echtNichtAscii(a) || echtNichtAscii(z);
  return cf ? (IST_SICHTBAR.test(a) && IST_SICHTBAR.test(z) && nicht) : nicht;
}
// Gegenpruefung 5, Skeptiker (R5b-ausgabe-3): auf GitHub Actions ist eine Zeile, die (nach Leerraum) mit „::" beginnt, ein BEFEHL
// an den Runner (::error, ::warning, ::add-mask::, ::stop-commands::), und „##[" ist dessen aeltere Form. Der Pruefstand laeuft auf
// jedem PR, der Waechter schreibt seinen Bericht mit `tee` ins Protokoll: ein Halttext „Bitte warten\n::error title=Brett::…" stand
// dort als Annotation im Namen des Pruefstands. Die Wand schreibt das erste „:" bzw. das erste „#" in der Escape-Schreibweise
// (Backslash, u, 003a bzw. 0023) — sichtbar, und in JSON dasselbe Zeichen (eine JSON-Zeile beginnt nie mit „::", und „##[" steht dort
// nur in einer Zeichenkette).
const RUNNER_ZEILE = /^(\s*):(?=:)/gm, RUNNER_ALT = /#(?=#\[)/g;
export function ausgabeSicher(s) { const t = String(s); return t.replace(WAND_KANDIDAT, (c, i) => wandRoh(t, c, i) ? c : alsEscape(c)).replace(RUNNER_ZEILE, '$1\\u003a').replace(RUNNER_ALT, '\\u0023'); }
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
// ── EINZEILIGE Felder (Gegenpruefung 5, Skeptiker, R5b-ausgabe-0): was eine Zeile IST — ein Titel, ein Pfad, ein Name, eine Kennung,
// ein Wort aus einem Vokabular —, traegt kein Zeichen, das fremd() sichtbar machen muesste (Zeilenumbruch, ESC, Bidi, Tag-Zeichen …).
// Vorher pruefte das Lesen nur `von`: ein Halt mit `geltung: ['docs/a.md\n\nDICH BETREFFEND\n  GELIEFERT …']` war gueltig und
// wirksam und schrieb im Block HALT UND VETO einen gefaelschten DICH-BETREFFEND-Block samt GELIEFERT-Befehl in die Ausgabe JEDES
// Lesers; dasselbe ueber Titel, Stichworte und die Felder einer Fehlerklasse. Gemessen 18.11.2026 ueber den Arbeitsbaum und alle 143
// Remote-Refs (167 Blobs unter eintraege/ und fassungen/, dazu 92 Dateien im Arbeitsbaum): KEIN Feld traegt eines dieser Zeichen —
// Zeilenumbrueche stehen nur in `text` (in 28 der 259 Dateien). Mehrzeilig bleiben alle Textfelder ausserhalb dieser Liste (text, beleg, regel, suchmuster, gesucht …):
// sie werden beim Drucken Zeile fuer Zeile sichtbar gemacht und eingerueckt. Dieselbe Regel beim Schreiben (eintragPruefen) und
// beim Lesen (formFehler: die Fassung ist UNLESBAR, mit Grund — nie still weg).
const EINZEILIG = ['titel', 'art', 'datum', 'an', 'rolle', 'stand', 'zeit', 'bis', 'phase', 'runde', 'dringlichkeit', 'ergebnis'];
const EINZEILIG_LISTEN = ['geltung', 'stichworte'];
const EINZEILIG_TEILE = [['bezug', ['id', 'art', 'ref']], ['waechter', ['datei', 'fall']], ['anker', ['datei']], ['zaehle', ['datei']]];
const zeichenCode = (v) => { if (typeof v !== 'string') return null; const i = v.search(UNSICHTBAR); return i < 0 ? null : 'U+' + v.codePointAt(i).toString(16).toUpperCase().padStart(4, '0'); };
// Gruende als Liste; der Wert selbst steht nie darin (nur die Stelle und das erste Zeichen als U+XXXX).
export function einzeiligFehler(e) {
  const f = [], satz = (wo, z) => wo + ' ist EINE Zeile — ein Steuer-, Format- oder Trennzeichen (' + z + ') darf darin nicht stehen (Mehrzeiliges gehoert in text)';
  if (!e || typeof e !== 'object') return f;
  // Auch ein FeldNAME (ein unbekanntes Feld steht im Grund „unbekanntes Feld „…"" — vorher roh, mit Zeilenumbruch darin).
  for (const k of Object.keys(e)) { const z = zeichenCode(k); if (z) f.push(satz('ein Feldname', z)); }
  for (const k of EINZEILIG) { const z = zeichenCode(e[k]); if (z) f.push(satz(k, z)); }
  for (const k of EINZEILIG_LISTEN) if (Array.isArray(e[k])) e[k].forEach((x, i) => { const z = zeichenCode(x); if (z) f.push(satz(k + '[' + i + ']', z)); });
  for (const [k, teile] of EINZEILIG_TEILE) if (Array.isArray(e[k])) e[k].forEach((x, i) => { if (x && typeof x === 'object') for (const t of teile) { const z = zeichenCode(x[t]); if (z) f.push(satz(k + '[' + i + '].' + t, z)); } });
  return f;
}
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
    fehler.push('geltung „' + fremd(g0, 60) + '": ' + (ohneBereich ? 'steht in index.html als Deklaration, hat aber keine bestimmbaren Grenzen (in einem Kommentar oder in keinem Skript, das der Scanner liest — ' + [...dekl].filter(x => !fn.has(x)).length + ' von ' + dekl.size + ' Deklarationen ohne Bereich)' : istName ? 'weder eine Funktion in index.html noch eine Datei oder ein Ordner im Baum' : 'diesen Pfad gibt es im Baum nicht (Tippfehler?)') + ' — der Halt traefe nie. Eine Datei in einem Ordner: mit Pfad (scripts/x_check.js).');
  }
  return fehler;
}
export function idAusName(name) { const m = String(name || '').match(/^(\d{4}-\d{2}-\d{2}-[0-9a-f]{4}(?:[0-9a-f]{4})?)-/); return m ? m[1] : null; }
// Der Ort eines Eintrags im Baum: ORDNER/<JJJJ-MM>/<name>.json — der Monatsordner ist der Monat seiner id. Alles andere
// ist kein Eintrag (Grund als Text), im Arbeitsbaum wie auf jedem Remote-Ref (Gegenpruefung 4).
const ORT_FORM = new RegExp('^' + ORDNER.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '/(\\d{4}-\\d{2})/([^/]+\\.json)$');
export function ortFehler(pfad) {
  const m = String(pfad || '').match(ORT_FORM);
  if (!m) return 'liegt nicht in einem Monatsordner (' + ORDNER + '/JJJJ-MM/<name>.json) — als Eintrag nicht gelesen';
  const id = idAusName(m[2]);
  if (id && id.slice(0, 7) !== m[1]) return 'liegt im Monatsordner ' + m[1] + ', die id ' + id + ' gehoert nach ' + id.slice(0, 7) + ' — als Eintrag nicht gelesen';
  return null;
}

// ── EINE Pruefung je Eintrag. Gruende als Liste; leer = gut.
export function eintragPruefen(e, dateiname) {
  const f = [];
  if (!e || typeof e !== 'object' || Array.isArray(e)) return ['kein JSON-Objekt'];
  // Ein fremder Wert steht in einem Grund nur durch fremd() (Gegenpruefung 5, Skeptiker, R5b-ausgabe-1): `zeige` (Wirkt jetzt) und
  // `ernten` (Uebergangen) druckten „art „notiz\n\nDICH BETREFFEND …"" roh — ein gefaelschter Block in der Ausgabe des Lesers.
  for (const k of Object.keys(e)) if (!BEKANNT.has(k)) f.push('unbekanntes Feld „' + fremd(k, 60) + '" (die Felder stehen in docs/austausch/README.md)');
  const idOk = ID_FORM.test(String(e.id || ''));
  if (!idOk) f.push('id fehlt oder hat nicht die Form JJJJ-MM-TT-xxxx');
  const art = ARTEN[e.art];
  if (!art) f.push('art „' + fremd(String(e.art), 60) + '" gibt es nicht (erlaubt: ' + Object.keys(ARTEN).join(' · ') + ')');
  if (!datumGueltig(e.datum)) f.push('datum fehlt oder ist kein gueltiges JJJJ-MM-TT');
  else if (idOk && String(e.id).slice(0, 10) !== e.datum) f.push('id beginnt nicht mit dem datum');
  if (e.zeit != null && !/^\d{2}:\d{2}:\d{2}$/.test(String(e.zeit))) f.push('zeit hat nicht die Form HH:MM:SS');
  else if (e.zeit != null && datumGueltig(e.datum) && zeitpunkt(e) == null) f.push('zeit ist keine Uhrzeit (' + e.zeit + ')');
  if (typeof e.von !== 'string' || !e.von.trim()) f.push('von fehlt (wer schreibt: Sitzung/Branch/Rolle — kein Personenname)');
  else if (!vonGueltig(e.von)) f.push('von hat keine gueltige Form (' + VON_FORM_TEXT + ')');
  // Die Rolle eines Unteragenten (Austausch-Runde): `von` ist die Sitzung, die die Runde fuhr.
  if (e.rolle != null && !/^runde\/[A-Za-z0-9_-]{1,60}$/.test(String(e.rolle))) f.push('rolle hat die Form runde/<blickwinkel>');
  if (typeof e.titel !== 'string' || !e.titel.trim()) f.push('titel fehlt');
  else if (e.titel.length > TITEL_MAX) f.push('titel hat ' + e.titel.length + ' Zeichen (hoechstens ' + TITEL_MAX + ' — der Rest gehoert in text)');
  for (const k of TEXTFELDER) if (e[k] != null && typeof e[k] !== 'string') f.push(k + ' muss Text sein');
  for (const k of LISTENFELDER) if (e[k] != null && (!Array.isArray(e[k]) || e[k].some(x => typeof x !== 'string' || !x.trim()))) f.push(k + ' muss eine Liste nicht-leerer Texte sein');
  for (const x of einzeiligFehler(e)) f.push(x);
  if (e.sicherheit != null && typeof e.sicherheit !== 'boolean') f.push('sicherheit muss true oder false sein');
  if (dateiname != null && idOk && art && (dateiname.indexOf(e.id + '-' + e.art + '-') !== 0 || !/\.json$/.test(dateiname))) f.push('Dateiname muss mit „' + e.id + '-' + e.art + '-" beginnen und auf .json enden');
  if (e.bezug != null) {
    if (!Array.isArray(e.bezug)) f.push('bezug muss eine Liste sein');
    else e.bezug.forEach((b, i) => {
      if (!b || typeof b !== 'object' || !ID_FORM.test(String(b.id || ''))) f.push('bezug[' + i + ']: id fehlt oder hat die falsche Form');
      else if (b.id === e.id) f.push('bezug[' + i + ']: ein Eintrag bezieht sich nicht auf sich selbst');
      if (!b || !BEZUEGE[b.art]) f.push('bezug[' + i + ']: art „' + fremd(String(b && b.art), 60) + '" gibt es nicht (erlaubt: ' + Object.keys(BEZUEGE).join(' · ') + ')');
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
    for (const g of alsListe(e.geltung)) { const w = geltungFehler(g); if (w) f.push('geltung „' + fremd(g, 60) + '": ' + w); }
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
  // opts.ohneNachladen: GIT_NO_LAZY_FETCH=1 — ein Teilabruf laedt einen fehlenden Baum oder Blob sonst still nach
  // (Gegenpruefung 4: `ls-tree` holte in einem Klon mit --filter=tree:0 jeden Baum vom Server; `--nur-lokal` liess die
  // Packs von 3 auf 8 wachsen). Die Antwort ist dann null wie bei jedem Fehler, und der Aufrufer sagt, was fehlt.
  // opts.eingabe: Text fuer die Standardeingabe (nur mit opts.frist — `fetch --stdin` beim ausdruecklichen Nachladen).
  // opts.bis (ms seit 1970, nur mit opts.frist): eine GESAMTFRIST des Befehls — die Frist dieses Aufrufs ist hoechstens der
  // Rest bis dahin; ist nichts mehr uebrig, laeuft git gar nicht erst (Antwort null, opts.ende = 'frist'). Gegenpruefung 5
  // (R5-lesen-8): `naechste` sagte „20 s", das Nachladen danach lief mit je 120 s — gemessen 140 s gegen einen Remote, der
  // nach dem ersten Abruf hing. Nach dem Aufruf traegt opts.ende, wie er endete: 'ok' · 'frist' · 'fehler' (Exit-Code in
  // opts.code) — damit ein Aufrufer sagen kann, WARUM nichts kam, statt im Kreis zum selben Befehl zu raten (R5-werkzeug-4).
  const env = Object.assign({}, process.env, opts && opts.ohneNachladen ? { GIT_NO_LAZY_FETCH: '1' } : {});
  const voll = ['-C', wurzel, '-c', 'core.quotePath=false'].concat(args);
  if (opts && opts.frist > 0) {
    const frist = opts.bis > 0 ? Math.min(opts.frist, opts.bis - Date.now()) : opts.frist;
    if (!(frist > 0)) { opts.ende = 'frist'; opts.code = null; return null; }
    return gitMitFrist(voll, frist, Object.assign(env, { GIT_TERMINAL_PROMPT: '0' }), opts.eingabe, opts);
  }
  const o = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 };
  if (opts && opts.ohneNachladen) o.env = env;
  try { return cp.execFileSync('git', voll, o); }
  catch (_) { return null; }
}
// Die Frist trifft die ganze PROZESSGRUPPE (Gegenpruefung 4, R4-schwarm-9). Vorher beendete der Ablauf nur git
// selbst: gemessen mit `ext::sh -c sleep 25` blieben nach `naechste` drei Waisen liegen (git remote-ext, sh, sleep —
// Elternprozess 1), bei jedem Aufruf gegen einen haengenden Remote drei mehr. execFileSync kann keine Gruppe beenden;
// deshalb startet eine kleine Huelle (derselbe node, `-e`) git als Fuehrer einer EIGENEN Gruppe (detached), gibt nach
// der Frist SIGTERM an die Gruppe (git raeumt seine .lock-Dateien selbst), nach 2 s SIGKILL und endet mit 124. Die
// Huelle selbst wartet ohne Frist von aussen auf git — nur ein Sicherheitsnetz (Frist + 10 s), falls sie haengt.
//
// Gegenpruefung 5 (R5-lesen-6): die Huelle brach das Abraeumen ab, sobald git selbst endete. Gemessen mit `ext::`-Helfern:
// einer, der SIGTERM ignoriert (`trap "" TERM`), lebte nach der Frist weiter — git starb am SIGTERM, 'close' loeschte den
// SIGKILL-Zeitgeber; einer, der seine Ausgabe schliesst (`exec 1>&-`), liess git nach 40 ms enden, VOR der Frist, und blieb
// liegen (Elternprozess 1); und nach Strg-C endete die Huelle vor dem SIGKILL, weil dessen Zeitgeber `unref()` war. Jetzt
// gilt EINE Regel, gleich wie git endet: lebt danach noch etwas in der Gruppe (process.kill(-pid, 0)), geht SIGTERM an die
// Gruppe; sobald sie leer ist — spaetestens nach 2 s mit SIGKILL — endet die Huelle. Im Normalfall ist die Gruppe leer,
// wenn git endet (git wartet auf seine Kinder), und es kostet nichts. Ein Prozess, der sich selbst eine neue Gruppe gibt
// (setsid, wie `gc --auto` im Hintergrund), wird nicht getroffen — das ist die benannte Grenze (README „Grenzen").
const FRIST_HUELLE = [
  "const cp = require('child_process');",
  "const frist = Number(process.argv[1]), mitEingabe = process.argv[2] === '1';",
  "let c; try { c = cp.spawn('git', process.argv.slice(3), { detached: true, stdio: [mitEingabe ? 'pipe' : 'ignore', 'pipe', 'ignore'] }); } catch (_) { process.exit(127); }",
  "c.on('error', () => process.exit(127));",
  "if (mitEingabe) { c.stdin.on('error', () => {}); process.stdin.pipe(c.stdin); }",
  "c.stdout.pipe(process.stdout);",
  "const gruppe = (sig) => { try { process.kill(-c.pid, sig); return true; } catch (_) { return false; } };",
  // Lebt noch etwas in der Gruppe? kill(-pid, 0) zaehlt auch Zombies — und die holt PID 1 hier erst nach rund 1,8 s ab
  // (gemessen 18.11.2026). Mit /proc zaehlt nur, wer nicht schon tot ist (Zustand Z); ohne /proc entscheidet kill.
  "const lebt = () => {",
  "  if (!gruppe(0)) return false;",
  "  let l; try { l = require('fs').readdirSync('/proc'); } catch (_) { return true; }",
  "  for (const p of l) { if (!/^\\d+$/.test(p)) continue; let s; try { s = require('fs').readFileSync('/proc/' + p + '/stat', 'utf8'); } catch (_) { continue; }",
  "    const r = s.slice(s.lastIndexOf(')') + 2).split(' '); if (Number(r[2]) === c.pid && r[0] !== 'Z' && r[0] !== 'X') return true; }",
  "  return false;",
  "};",
  "let ende = null, zu = false;",
  // Abraeumen mit dem Code, den die Huelle danach traegt (124 Frist · 130 Signal · sonst der von git). Nie zweimal.
  "const abraeumen = (code) => {",
  "  if (ende != null) return;",
  "  ende = code; clearTimeout(t);",
  "  if (!lebt()) { if (zu) process.exit(ende); return; }",
  "  gruppe('SIGTERM');",
  "  const t0 = Date.now();",
  "  const iv = setInterval(() => { if (lebt() && Date.now() - t0 < 2000) return; clearInterval(iv); gruppe('SIGKILL'); if (zu || Date.now() - t0 >= 2000) process.exit(ende); }, 50);",
  "};",
  "const t = setTimeout(() => abraeumen(124), frist);",
  "c.on('close', (code) => { zu = true; if (ende != null) { if (!lebt()) process.exit(ende); return; } clearTimeout(t); const k = code == null ? 1 : code; if (lebt()) abraeumen(k); else process.exitCode = k; });",
  // Strg-C (SIGINT an die Vordergrundgruppe), ein `timeout` (SIGTERM) oder ein geschlossenes Terminal (SIGHUP) treffen die
  // Huelle, nicht die eigene Gruppe von git: ohne Weitergabe lief git samt Remote-Helfer weiter, ganz ohne Frist
  // (Gegenpruefung 4, Skeptiker). Jetzt gehen sie an die Gruppe — mit demselben Abraeumen (SIGTERM, nach 2 s SIGKILL).
  "for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => abraeumen(130));",
].join('\n');
function gitMitFrist(voll, frist, env, eingabe, opts) {
  const mitEingabe = eingabe != null;
  let r = null;
  const vermerk = (ende, code) => { if (opts) { opts.ende = ende; opts.code = code; } };
  try {
    r = cp.spawnSync(process.execPath, ['-e', FRIST_HUELLE, String(frist), mitEingabe ? '1' : '0'].concat(voll),
      { encoding: 'utf8', env, input: mitEingabe ? String(eingabe) : undefined, stdio: [mitEingabe ? 'pipe' : 'ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024, timeout: frist + 10000, killSignal: 'SIGKILL' });
  } catch (_) { vermerk('fehler', null); return null; }
  if (!r || r.error) { vermerk(r && r.error && r.error.code === 'ETIMEDOUT' ? 'frist' : 'fehler', null); return null; }
  vermerk(r.status === 0 ? 'ok' : (r.status === 124 ? 'frist' : 'fehler'), r.status);
  return r.status === 0 ? r.stdout : null;
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
// Die Konfiguration ist aber KEIN Beweis (Gegenpruefung 4, R4-lesen-5): sie sagt nur, womit der NAECHSTE Abruf
// filtert. Gemessen: Klon mit blob:limit=200k, danach `git fetch --filter=blob:none origin` — die Konfiguration
// blieb blob:limit=204800, ein neuer 1-KB-Halt fehlte, und A8 nannte ihn „mindestens 200 KB, also kein gueltiger
// Eintrag". git haelt den Filter eines Abrufs nirgends fest (die .promisor-Datei nennt nur die Refs). Belegt ist die
// Grenze deshalb nur dort, wo JEDER gefilterte Abruf mit genau dieser Konfiguration lief: in der CI (GITHUB_ACTIONS),
// deren Schritt „Branches fuer das Brett" Konfiguration und Abruf mit demselben Filter setzt — austausch_check C18
// liest ihn woertlich. Ueberall sonst: null — ein fehlender Blob koennte ein Eintrag sein.
export function teilabrufGrenze(wurzel, remote, umgebung) {
  if (String((umgebung || process.env).GITHUB_ACTIONS || '') !== 'true') return null;
  const f = (git(wurzel, ['config', '--get', 'remote.' + remote + '.partialclonefilter']) || '').trim();
  const m = f.match(/^blob:limit=(\d+)([kmg]?)$/i);
  return m ? Number(m[1]) * ({ '': 1, k: 1024, m: 1024 * 1024, g: 1024 * 1024 * 1024 })[m[2].toLowerCase()] : null;
}
// ── Fehlt der WURZELBAUM eines Refs? (Klon mit --filter=tree:0: Commits ja, Baeume nein.) Gegenpruefung 4, R4-lesen-1:
//    `ls-tree` auf so einen Ref lieferte ohne GIT_NO_LAZY_FETCH still die Baeume vom Server nach, mit ihm gar nichts —
//    und `(ls || '')` machte daraus „keine Dateien": die Nummern eines Branches fielen still weg (`naechste` vergab
//    v1.01 ein zweites Mal). Gemessen (git 2.43, Klon mit tree:0): `rev-list --objects --missing=print --no-walk
//    --filter=tree:1` nennt einen fehlenden Wurzelbaum als „?<oid>" und laedt NIE nach — auch OHNE die Variable, also
//    auch auf einem git, das sie nicht kennt. `log --format=%T` liest nur den Commit. Ergebnis: Map(Ref → fehlender
//    Baum); null, wenn git die Refs nicht kennt. Ein fehlender TIEFERER Baum faellt erst an `ls-tree` mit ohneNachladen auf.
function commitsVon(wurzel, refs) {
  const commits = (git(wurzel, ['rev-parse'].concat(refs), { ohneNachladen: true }) || '').split('\n').filter(Boolean);
  return commits.length === refs.length ? commits : null;
}
// Fehlende Objekte unter den Commits, OHNE nachzuladen — mit `filter` als Grenze der Suche (tree:1: nur die Wurzelbaeume;
// blob:none: jeder Baum, keine Datei — dann ist jedes „?<oid>" ein BAUM). Set der Kennungen, oder null.
function fehlendUnter(wurzel, commits, filter) {
  let r = null;
  try { r = cp.spawnSync('git', ['-C', wurzel, 'rev-list', '--objects', '--missing=print', '--no-walk', '--filter=' + filter, '--stdin'], { input: [...new Set(commits)].join('\n') + '\n', env: ohneNachladen(), maxBuffer: LESEN_MAX }); } catch (_) {}
  if (!r || r.status !== 0 || r.stdout == null) return null;
  return new Set(String(r.stdout).split('\n').filter(z => z[0] === '?').map(z => z.slice(1).trim()));
}
export function fehlendeWurzelBaeume(wurzel, refs) {
  const aus = new Map();
  refs = [...new Set((refs || []).filter(Boolean))];
  if (!refs.length) return aus;
  const commits = commitsVon(wurzel, refs);
  if (!commits) return null;
  const log = git(wurzel, ['log', '--no-walk=unsorted', '--format=%H %T'].concat([...new Set(commits)]), { ohneNachladen: true });
  if (log == null) return null;
  const baum = new Map(log.split('\n').map(z => z.trim().split(' ')).filter(z => z.length === 2));
  const fehlt = fehlendUnter(wurzel, commits, 'tree:1');
  if (!fehlt) return null;
  refs.forEach((ref, i) => { const t = baum.get(commits[i]); if (t && fehlt.has(t)) aus.set(ref, t); });
  return aus;
}
// ── Ausdruecklich NACHLADEN (Gegenpruefung 4, R4-lesen-0). „Gelesen wird ohne Nachladen" gilt fuer jedes Lesen — aber
//    `holen`, `nehme` und `naechste` HOLEN ohnehin, und in einem Klon mit --filter=blob:none fehlte danach jeder fremde
//    Eintrag: gemessen „0 Eintraege … Das Brett ist leer", kein DICH BETREFFEND, `nehme` schrieb still eine zweite
//    Uebernahme, `naechste` schickte im Kreis zu `holen`. Jetzt holen diese drei danach GEZIELT, was das Brett braucht —
//    wie git selbst beim Nachladen (promisor-remote.c): Verhandlung „noop", keine Tags, kein FETCH_HEAD, `--filter=
//    blob:none --stdin` mit den Kennungen. Ein verlangter Blob kommt so trotzdem; ein verlangter BAUM kommt mit allen
//    Unterbaeumen, ohne Dateien (gemessen: danach `ls-tree -r` ohne Nachladen vollstaendig). Nur in einem Teilabruf
//    (remote.<r>.promisor oder extensions.partialclone) — sonst fehlt nichts, und es geht keine Anfrage hinaus.
export function promisorRemotes(wurzel) {
  const r = [];
  for (const z of (git(wurzel, ['config', '--get-regexp', '^remote\\..*\\.promisor$']) || '').split('\n')) {
    const m = z.trim().match(/^remote\.(.+)\.promisor\s+(\S+)$/i);
    if (m && /^(true|yes|on|1)$/i.test(m[2]) && r.indexOf(m[1]) < 0) r.push(m[1]);
  }
  const ext = (git(wurzel, ['config', '--get', 'extensions.partialclone']) || '').trim();
  if (ext && r.indexOf(ext) < 0) r.push(ext);
  return r;
}
export const NACHLADE_FRIST_MS = 120000;
export function objekteNachladen(wurzel, oids, opts) {
  opts = opts || {};
  const liste = [...new Set((oids || []).filter(x => /^[0-9a-f]{40,64}$/.test(String(x))))];
  if (!liste.length) return true;
  // Nur fuer einen Promisor-Remote: `fetch --filter=…` auf einem VOLLEN Repo schreibt remote.<r>.promisor,
  // partialclonefilter und repositoryformatversion=1 — `naechste` machte so ein volles Repo still zum Teilabruf
  // (Gegenpruefung 4, Skeptiker). Dort fehlt nichts, was ein Abruf holen koennte.
  if (promisorRemotes(wurzel).indexOf(opts.remote || REMOTE) < 0) { opts.ende = 'kein_teilabruf'; return false; }
  // GIT_NO_LAZY_FETCH=1 auch hier: der Abruf selbst darf nichts AUSSER den verlangten Kennungen nachladen (gemessen:
  // der ausdrueckliche Abruf geht mit der Variablen, Exit 0, der Blob liegt danach lokal).
  // `-c remote.<r>.partialclonefilter=blob:none` (Gegenpruefung 5, R5-lesen-10): `fetch --filter` traegt den Filter in die
  // Konfiguration ein, wenn der Promisor-Remote keinen hat (partial_clone_register) — gemessen nach
  // `git config --unset remote.origin.partialclonefilter` (so macht man kuenftige Abrufe wieder voll): `holen` schrieb
  // remote.origin.partialclonefilter=blob:none, und jeder spaetere `git fetch` filterte. Mit dem Filter auf der Befehlszeile
  // findet git ihn schon gesetzt und schreibt nichts (gemessen: `config --list --local` vorher und nachher byte-gleich).
  const r = opts.remote || REMOTE, go = { frist: opts.frist > 0 ? opts.frist : NACHLADE_FRIST_MS, bis: opts.bis, eingabe: liste.join('\n') + '\n', ohneNachladen: true };
  const ok = git(wurzel, ['-c', 'remote.' + r + '.partialclonefilter=blob:none', '-c', 'fetch.negotiationAlgorithm=noop', 'fetch', r, '--no-tags', '--no-write-fetch-head', '--recurse-submodules=no', '--filter=blob:none', '--stdin'], go) != null;
  opts.ende = go.ende; opts.code = go.code;
  return ok;
}
// Die aelteren Fassungen nachladen (Gegenpruefung 5c, Skeptiker R5c-L1). `gruppen`: [{ ref, rest: [Kennung], ende }] in der
// Reihenfolge der Refs; danach traegt jede in `rest`, was noch fehlt, und in `ende`, wie ihr letzter Abruf endete
// ('ok' · 'frist' · 'fehler'). `fristEnde`: ms seit 1970 — kein Abruf laeuft darueber hinaus.
//  1. EIN Abruf fuer alle, mit hoechstens der HAELFTE der verbleibenden Frist. Das ist der Normalfall (gemessen: 26 ehrliche
//     Branches, 0,8 s je Abruf — ein Abruf, alle aelteren Fassungen da). Die Haelfte bleibt fuer den Fall, dass er haengt.
//  2. Nur wenn er an der FRIST scheitert, wird halbierend geteilt: ueber die Branches, bei einem einzigen Branch ueber seine
//     Objekte. Haengt EIN fremder Branch, kostet er log N Runden statt N Latenzen; jede Haelfte ohne ihn kommt in einem Abruf an.
//     Ein Abruf, den der Server ABLEHNT (fehler), wird nicht geteilt und nicht wiederholt (wie vorher; die Antwort ist dann
//     „nicht rechenbar" — die sichere Richtung).
//  Die Frist je Teilabruf: der Rest geteilt durch die Zahl der Abrufe, die das Teilen noch braucht, wenn EIN Teil haengt — die
//  offenen Teile plus zwei je Halbierungsstufe des groessten (len + 2·⌈log2 Umfang⌉). Gemessen (18.11.2026, 12 ehrliche Branches
//  mit berichtigter Lage, ein fremder, dessen aeltere Fassung haengt, 0,3 s je Abruf, Standardfrist): so kamen alle zwoelf (der
//  knappste ehrliche Teil bekam 0,88 s und brauchte 0,38 s; fuenf Abrufe trafen den haengenden: 1 + ⌈log2 13⌉). Bekam jeder Teil
//  stattdessen die Haelfte des Rests, blieben dem letzten ehrlichen 81 ms, und seine aeltere Fassung kam nicht. Haengen MEHRERE
//  Teile, reicht die Rechnung nicht fuer alle — was nicht kommt, ist „nicht rechenbar" (ein Halt wirkt, eine Lage nimmt nichts),
//  nie still falsch.
function aeltereNachladen(wurzel, remote, gruppen, fristEnde, frist) {
  const uebrig = () => fristEnde - Date.now();
  // Ein Teil ist eine Liste von {x, oid}; sein Umfang die Zahl seiner Branches, bei einem einzigen Branch die seiner Objekte.
  const teil = (gs) => gs.flatMap(x => x.rest.map(oid => ({ x, oid })));
  const frisch = (t) => t.filter(u => u.x.rest.indexOf(u.oid) >= 0);
  const umfang = (t) => { const n = new Set(t.map(u => u.x)).size; return n > 1 ? n : t.length; };
  const halbiere = (t) => {
    const refs = [...new Set(t.map(u => u.x))];
    if (refs.length > 1) { const vorn = new Set(refs.slice(0, Math.ceil(refs.length / 2))); return [t.filter(u => vorn.has(u.x)), t.filter(u => !vorn.has(u.x))]; }
    return t.length > 1 ? [t.slice(0, Math.ceil(t.length / 2)), t.slice(Math.ceil(t.length / 2))] : [];
  };
  // Ein Abruf bis `bis` (ganze Millisekunden: spawnSync nimmt als `timeout` nur eine ganze Zahl); danach rechnet jede beteiligte
  // Gruppe nach, was noch fehlt. Was ein frueherer Abruf schon mitbrachte, steht nicht mehr in `rest`.
  const abruf = (t, bis) => {
    const oids = [...new Set(t.map(u => u.oid))], o = { remote, frist, bis: Math.floor(bis) };
    objekteNachladen(wurzel, oids, o);
    const da = blobsDa(wurzel, oids);
    for (const x of new Set(t.map(u => u.x))) {
      const hier = t.filter(u => u.x === x && !da.has(u.oid)).length;
      x.rest = x.rest.filter(b => !da.has(b));
      if (hier) x.ende = o.ende === 'frist' ? 'frist' : 'fehler';
      else if (!x.rest.length) x.ende = 'ok';
    }
    return o.ende;
  };
  const alle = teil(gruppen.filter(x => x.rest.length));
  if (!alle.length) return;
  if (Math.floor(uebrig() / 2) < 1) { for (const x of gruppen) if (x.rest.length) x.ende = 'frist'; return; }
  if (abruf(alle, Date.now() + uebrig() / 2) !== 'frist') return;
  const schlange = halbiere(frisch(alle));
  while (schlange.length) {
    const t = frisch(schlange.shift());
    if (!t.length) continue;
    const offen = [t].concat(schlange.map(frisch).filter(x => x.length));
    const abrufe = offen.length + 2 * Math.ceil(Math.log2(Math.max(...offen.map(umfang))));
    const frist1 = Math.floor(uebrig() / abrufe);
    if (frist1 < 1) break;
    if (abruf(t, Date.now() + frist1) === 'frist') schlange.push(...halbiere(frisch(t)));
  }
}
// Die Eintraege des Bretts (eintraege/**.json und die Grabstein-Liste) auf JEDEM Ref eines Promisor-Remotes: fehlende
// Wurzelbaeume zuerst (tree:0), dann die fehlenden Blobs. Klein: ein Eintrag hat hoechstens 64 KB — groessere Dateien
// unter eintraege/ werden mitgeholt und danach „groesser als 64 KB" genannt (die Frist begrenzt den Abruf).
// Ergebnis: { teilabruf, noetig, geholt, fehlt: [Kennung oder „<ref> (Baum)"], ok } — was danach noch fehlt, nennt
// brettLesen weiter als unlesbar (`.fehlend`), und `nehme` lehnt dann ab.
//
// Gegenpruefung 5 — drei Dinge, die das Brett AUSSER den Spitzen braucht und die vorher fehlten:
//  · Die AELTEREN Fassungen jeder Lage und jedes Halts auf dem Branch ihres Schreibers (R5-lesen-1). Aus ihnen rechnet
//    brettLesen, seit wann derselbe Anspruch dort liegt; fehlten sie, galt eine ehrlich berichtigte Lage nach `holen` als
//    „rueckdatiert" — gemessen: der Halt sperrte nicht, und `nehme` vergab die Uebernahme ein zweites Mal. Die Kennungen
//    kommen aus `log --raw` (nur Baeume, ohne Nachladen), geholt werden nur die fehlenden. Ist die Geschichte selbst nicht
//    lesbar (Klon mit --filter=tree:0: die Baeume der aelteren Commits fehlen), steht der Branch in `geschichte` — dann ist
//    die Ankunft dort nicht rechenbar, und `holen` sagt, welcher Befehl das aendert (R5-lesen-0, gemessen).
//  · Das VERZEICHNIS des Waechters (zz-sicherung:docs/austausch/sicherung.json, R5-lesen-2): ohne es rechnete der Klon die
//    Ankunft aus der Autor-Zeit, einer Selbstauskunft — eine rueckdatierte Lage, die der volle Klon verwarf, stahl dort die
//    Uebernahme, und ein neu angelegter Branch galt wieder als Berichtigung.
//  · Mit opts.aenderung (nur `holen`, vor DICH BETREFFEND) index.html und sw.js von origin/main und der Abzweigstelle: ohne
//    sie ist der Funktions- und Bump-Vergleich von eigeneAenderung nicht rechenbar (R5-lesen-3, eigeneAenderung laedt
//    selbst nichts mehr nach) — seit Gegenpruefung 5b nur die, die dieser Stand geaendert hat (R5b-lesen-2).
// Gegenpruefung 5b (R5b-lesen-0): die Spitzen und das Verzeichnis kommen in EINEM Abruf. Die aelteren Fassungen seit
// Gegenpruefung 5c (Skeptiker R5c-L1) zuerst ebenfalls in EINEM Abruf fuer alle Branches (hoechstens die Haelfte der
// verbleibenden Frist), und nur, wenn der an der Frist scheitert, halbierend geteilt (aeltereNachladen) — die Geschichte eines
// Fremden verbraucht so nicht die Frist aller. `aeltere.refs` nennt die Branches, deren aeltere Fassungen nicht kamen.
// opts.vorAelteren: wird nach den Spitzen und VOR den aelteren Fassungen gerufen (einmal, fuer origin) — `naechste` laedt dort
// die Dateien fuer die Nummern (R5c-L1: danach blieb ihnen keine Zeit).
// opts.bis: die Gesamtfrist des Befehls — jeder Abruf hier bekommt hoechstens den Rest (R5-lesen-8). `grund` sagt, warum
// etwas nicht kam: 'frist' (Frist abgelaufen) oder 'fehler' (der Abruf scheiterte — der Server gab die Objekte nicht).
const BRETT_DIR = path.posix.dirname(ORDNER);
export function eintraegeNachladen(wurzel, opts) {
  opts = opts || {};
  const aus = { teilabruf: false, noetig: 0, geholt: 0, fehlt: [], ok: true, aeltere: { noetig: 0, geholt: 0, fehlt: [], refs: [] }, geschichte: [], verzeichnis: null, aenderung: null, grund: null };
  const NL = { ohneNachladen: true };
  for (const remote of promisorRemotes(wurzel)) {
    aus.teilabruf = true;
    const nl = (oids) => { const o = { remote, frist: opts.frist, bis: opts.bis }; const ok = objekteNachladen(wurzel, oids, o); if (!ok) { aus.ok = false; if (aus.grund !== 'frist') aus.grund = o.ende === 'frist' ? 'frist' : 'fehler'; } return ok; };
    // Holt, was davon fehlt; Ergebnis: was danach noch fehlt.
    const holeFehlende = (liste, baeume) => { const da = blobsDa(wurzel, liste, baeume), fehlen = liste.filter(b => !da.has(b)); if (!fehlen.length) return { fehlen, rest: [] }; nl(fehlen); const danach = blobsDa(wurzel, fehlen, baeume); return { fehlen, rest: fehlen.filter(b => !danach.has(b)) }; };
    const refs = (git(wurzel, ['for-each-ref', '--format=%(refname)', 'refs/remotes/' + remote + '/'], NL) || '').split('\n').filter(x => x && !/\/HEAD$/.test(x));
    // Erst die fehlenden BAEUME jeder Tiefe (tree:0, tree:1 …): ein verlangter Baum kommt mit allen Unterbaeumen. Gemessen:
    // einen Baum, der schon lokal liegt, holt `fetch` NICHT noch einmal (Exit 0, kein Pack) — verlangt werden deshalb die
    // fehlenden selbst; `rev-list --filter=blob:none --missing=print` nennt genau diese und laedt nie nach.
    const commits = refs.length ? commitsVon(wurzel, refs) : [];
    const ohneBaum = commits && commits.length ? fehlendUnter(wurzel, commits, 'blob:none') : null;
    if (ohneBaum && ohneBaum.size) nl([...ohneBaum]);
    const blobs = new Set(), baeume = new Set(), lageHalt = [];   // lageHalt: {ref, pfad, blob} — Spitzen, deren Name lage/halt sagt
    let verzBlob = null;
    const lsAlle = (liste) => liste.filter(ref => {
      const ls = git(wurzel, ['ls-tree', '-r', '-t', '-z', ref, '--', ORDNER + '/', GRABSTEINE, VERZEICHNIS], NL);
      if (ls == null) return true;
      const kurzRef = ref.replace(/^refs\/remotes\//, '');
      for (const z of ls.split('\0')) {
        const t = z.match(/^\d+ tree ([0-9a-f]+)\t(.+)$/);
        if (t) { if (t[2] === BRETT_DIR) baeume.add(t[1]); continue; }
        const m = z.match(/^\d+ blob ([0-9a-f]+)\t(.+)$/);
        if (!m) continue;
        if (m[2] === VERZEICHNIS) { if (istSicherungsRef(kurzRef) && kurzRef.indexOf(remote + '/') === 0) verzBlob = m[1]; continue; }
        if (m[2] === GRABSTEINE || (m[2].indexOf(ORDNER + '/') === 0 && /\.json$/.test(m[2]))) {
          blobs.add(m[1]);
          const nm = path.posix.basename(m[2]).match(NAME_FORM);
          if (nm && (nm[2] === 'lage' || nm[2] === 'halt') && !istMainRef(kurzRef) && !istSicherungsRef(kurzRef)) lageHalt.push({ ref, pfad: m[2], blob: m[1] });
        }
      }
      return false;
    });
    for (const ref of lsAlle(refs)) { aus.fehlt.push(ref.replace(/^refs\/remotes\//, '') + ' (Baum)'); aus.ok = false; }
    // Die Spitzen UND das Verzeichnis des Waechters (R5-lesen-2) in EINEM Abruf (Gegenpruefung 5b, R5b-lesen-0): vorher kam das
    // Verzeichnis in einem eigenen Abruf NACH den Spitzen — gegen einen langsamen Remote traf die Gesamtfrist es zuerst (gemessen:
    // „Das Verzeichnis … kam nicht (Frist abgelaufen)", und jede Lage war „nicht entscheidbar"), und ein Remote, der nach dem
    // zweiten Abruf scheitert, gab die Spitzen, aber nie das Verzeichnis. Eine Runde weniger, und beides kommt oder beides nicht.
    const spitzen = holeFehlende([...blobs].concat(verzBlob && !blobs.has(verzBlob) ? [verzBlob] : []), [...baeume]);
    const ohneVerz = (l) => l.filter(b => b !== verzBlob || blobs.has(b));
    aus.noetig += ohneVerz(spitzen.fehlen).length;
    aus.geholt += ohneVerz(spitzen.fehlen).length - ohneVerz(spitzen.rest).length;
    aus.fehlt.push(...ohneVerz(spitzen.rest));
    if (verzBlob) aus.verzeichnis = spitzen.rest.indexOf(verzBlob) >= 0 ? 'fehlt' : (spitzen.fehlen.indexOf(verzBlob) >= 0 ? 'geholt' : 'da');
    // Was der Befehl selbst braucht, VOR den aelteren Fassungen (Gegenpruefung 5c, Skeptiker R5c-L1): bei `naechste` die Dateien
    // fuer die Nummern. Vorher kamen sie danach — gemessen mit 20 ehrlich berichtigten Halts und 0,8 s je Abruf kamen die aelteren
    // Fassungen gerade noch, fuer die Nummern blieb nichts (Exit 2: „20 Datei(en) … STATUS.md"); und gegen einen haengenden
    // fremden Branch laeuft das Teilen unten bis zur Frist.
    if (typeof opts.vorAelteren === 'function' && remote === REMOTE) opts.vorAelteren();
    // Die aelteren Fassungen jeder Lage und jedes Halts auf dem Branch des Schreibers (R5-lesen-1). Welcher Branch das ist,
    // sagt die Spitze (`von`) — dieselbe Regel wie in brettLesen (istAutorRef); eine Kopie Dritter misst nie.
    const spitzeInhalt = blobsLesen(wurzel, [...new Set(lageHalt.map(x => x.blob))]), jeRef = new Map();
    for (const x of lageHalt) {
      const buf = spitzeInhalt.get(x.blob); if (!buf) continue;
      let e = null; try { e = JSON.parse(buf.toString('utf8')); } catch (_) {}
      if (!e || typeof e !== 'object' || Array.isArray(e) || (e.art !== 'lage' && e.art !== 'halt') || typeof e.von !== 'string') continue;
      if (!istAutorRef(x.ref.replace(/^refs\/remotes\//, ''), autorZweig(e))) continue;
      if (!jeRef.has(x.ref)) jeRef.set(x.ref, new Map());
      jeRef.get(x.ref).set(x.pfad, x.blob);
    }
    const aeltereJe = new Map();   // ref → Set(aeltere Blobs) — je Branch des Schreibers
    // Vorab und billig: fehlt der Wurzelbaum des ELTERN-Commits einer Spitze (Klon mit --filter=tree:0), ist ihre Geschichte nicht
    // lesbar — dann startet kein `log` (er scheitert dort erst nach rund 0,4 s je Branch, R5-lesen-7). Eine Spitze ohne Eltern hat
    // keine aeltere Fassung. Fehlt erst ein tieferer Baum (tree:1), merkt es der `log` selbst.
    const mitEltern = [...jeRef.keys()].filter(ref => git(wurzel, ['rev-parse', '--verify', '--quiet', ref + '^'], NL) != null);
    const elternOhneBaum = mitEltern.length ? (fehlendeWurzelBaeume(wurzel, mitEltern.map(x => x + '^')) || new Map()) : new Map();
    for (const [ref, pfade] of jeRef) {
      if (elternOhneBaum.has(ref + '^')) { aus.geschichte.push(ref.replace(/^refs\/remotes\//, '')); continue; }
      // Dieselbe Abfrage wie brettLesen (verlauf): volle Geschichte des Ordners, Merges gegen den ersten Elternteil.
      const vl = pfadVerlauf(git(wurzel, ['log', '--no-renames', '--diff-merges=first-parent', '--raw', '--no-abbrev', '-z', '--format=%x01%at %ct', ref, '--', ORDNER + '/'], NL));
      if (!vl) { aus.geschichte.push(ref.replace(/^refs\/remotes\//, '')); continue; }
      const s = new Set();
      for (const [pfad, spitze] of pfade) for (const v of (vl.get(pfad) || [])) if (v.blob !== spitze && v.mode === '100644') s.add(v.blob);
      if (s.size) aeltereJe.set(ref, s);
    }
    // Gegenpruefung 5b (R5b-lesen-0) gab jedem Branch des Schreibers einen EIGENEN Abruf mit (Rest der Frist) / (offene Abrufe) als
    // Anteil, damit die aufgeblaehte Geschichte EINES Fremden (eine aeltere Fassung mit 150 MB) nicht die Frist aller verbraucht.
    // Gegenpruefung 5c (Skeptiker R5c-L1) hat gemessen, was das bei ehrlicher Last kostet: 26 ehrlich berichtigte Halts auf eigenen
    // Branches, 0,8 s je Abruf (ext::-Helfer mit `sleep`), Standardfrist 20 s — jeder Anteil war kuerzer als EIN Abruf, alle wurden
    // abgebrochen, und ein abgebrochener `git fetch` speichert nichts: `naechste` endete bei jedem Lauf mit Exit 2, `nehme` sagte
    // „nicht entscheidbar" (bei 20 Branches kamen noch alle, bei 24 keiner — eine Klippe). Der Stand vor 5b rechnete dieselbe Welt
    // in EINEM Abruf richtig. Deshalb jetzt (aeltereNachladen): zuerst EIN Abruf fuer alle, mit hoechstens der Haelfte der
    // verbleibenden Frist; nur wenn er an der Frist scheitert, halbierend geteilt.
    const fristEnde = opts.bis > 0 ? opts.bis : Date.now() + (opts.frist > 0 ? opts.frist : NACHLADE_FRIST_MS);
    const offenJe = [...aeltereJe].map(([ref, s]) => ({ ref, fehlen: [...s], rest: null, ende: null }));
    { const da = blobsDa(wurzel, offenJe.flatMap(x => x.fehlen)); for (const x of offenJe) { x.fehlen = x.fehlen.filter(b => !da.has(b)); x.rest = x.fehlen.slice(); } }
    aeltereNachladen(wurzel, remote, offenJe.filter(x => x.fehlen.length), fristEnde, opts.frist);
    for (const x of offenJe) {
      aus.aeltere.noetig += x.fehlen.length; aus.aeltere.geholt += x.fehlen.length - x.rest.length; aus.aeltere.fehlt.push(...x.rest);
      if (x.rest.length) {
        aus.aeltere.refs.push(x.ref.replace(/^refs\/remotes\//, ''));
        aus.ok = false; if (aus.grund !== 'frist') aus.grund = x.ende === 'frist' ? 'frist' : 'fehler';
      }
    }
    // Was eigeneAenderung braucht (R5-lesen-3): index.html und sw.js auf origin/main und an der Abzweigstelle.
    if (opts.aenderung && remote === REMOTE) {
      const M = 'refs/remotes/' + REMOTE + '/main', mb = (git(wurzel, ['merge-base', 'HEAD', M], NL) || '').trim();
      if (git(wurzel, ['rev-parse', '--verify', '--quiet', M], NL) != null) {
        const revs = [M].concat(/^[0-9a-f]{40,64}$/.test(mb) ? [mb] : []), cs = commitsVon(wurzel, revs);
        const ob = cs ? fehlendUnter(wurzel, cs, 'blob:none') : null;
        if (ob && ob.size) nl([...ob]);
        // Nur, was eigeneAenderung LESEN wird (Gegenpruefung 5b, R5b-lesen-2): index.html bzw. sw.js nur, wenn dieser Stand sie
        // geaendert hat — dieselbe Rechnung wie dort (aenderungDateien, ohne einen Blob von main). Vorher holte jedes `holen` nach
        // jedem Commit auf main beide Dateien von main und der Abzweigstelle (gemessen: Pack 1051 → 2101 KB fuer eine 1,5-MB-
        // index.html, die dieser Stand nie geaendert hatte; im Repo 6,3 MB). Ist die Rechnung hier nicht moeglich (null), werden
        // beide geholt — die sichere Richtung, wie vorher.
        const geaendert = /^[0-9a-f]{40,64}$/.test(mb) ? aenderungDateien(wurzel, mb, M) : null;
        const braucht = ['index.html', 'sw.js'].filter(n => !geaendert || geaendert.indexOf(n) >= 0);
        const dateien = [];
        if (braucht.length) for (const rev of revs) { const ls = git(wurzel, ['ls-tree', '-z', rev, '--'].concat(braucht), NL); for (const z of (ls || '').split('\0')) { const m = z.match(/^\d+ blob ([0-9a-f]+)\t/); if (m) dateien.push(m[1]); } }
        const d = holeFehlende([...new Set(dateien)]);
        aus.aenderung = { noetig: d.fehlen.length, geholt: d.fehlen.length - d.rest.length, fehlt: d.rest, dateien: braucht };
      }
    }
  }
  return aus;
}
function lies(roh, datei, quelle, unlesbar, extra) {
  let e;
  if (Buffer.byteLength(roh, 'utf8') > EINTRAG_MAX_BYTES) { unlesbar.push({ datei, quelle, grund: 'groesser als ' + (EINTRAG_MAX_BYTES / 1024) + ' KB — kein Eintrag' }); return null; }
  // Ohne Ausschnitt des Inhalts (Gegenpruefung 5): die Meldung von JSON.parse zitiert die Datei („"␛[8mkaputt" is not valid
  // JSON") — und die steht im Kopf jedes Lesers, vor DICH BETREFFEND. Genannt wird nur, WO es scheitert.
  try { e = JSON.parse(roh); } catch (x) { const m = String(x && x.message).match(/position (\d+)/); unlesbar.push({ datei, quelle, grund: 'kein gueltiges JSON' + (m ? ' (bei Zeichen ' + m[1] + ')' : (/end of JSON input/.test(String(x && x.message)) ? ' (endet zu frueh)' : '')) }); return null; }
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
  if (!(extra && extra.ohneName) && (!nm || nm[1] !== e.id || nm[2] !== e.art)) { unlesbar.push({ datei, quelle, grund: 'Dateiname passt nicht zu id und art (erwartet ' + e.id + '-' + fremd(e.art, 40) + '-<slug>.json)' }); return null; }
  for (const [k, v] of [['_datei', datei], ['_quelle', quelle], ['_roh', roh], ['_pfad', (extra && extra.pfad) || null], ['_blob', (extra && extra.blob) || null]]) Object.defineProperty(e, k, { value: v, enumerable: false });
  return e;
}
function formFehler(e) {
  for (const k of TEXTFELDER) if (e[k] != null && typeof e[k] !== 'string') return k + ' ist kein Text';
  // Schon beim LESEN (Gegenpruefung 5): eine Fassung mit ungueltigem `von` ist UNLESBAR, nicht Teil des Bretts — vorher
  // machte sie den Eintrag „strittig", und die STRITTIG-Zeile druckte ihr `von` (mit Zeilenumbruch) roh in jeden Kopf.
  // Ein leeres `von` bleibt lesbar (eintragPruefen nennt „von fehlt"). Der Wert selbst steht nicht im Grund.
  if (typeof e.von === 'string' && e.von !== '' && !vonGueltig(e.von)) return 'von hat keine gueltige Form (' + VON_FORM_TEXT + ')';
  for (const k of LISTENFELDER) if (e[k] != null && (!Array.isArray(e[k]) || e[k].some(x => typeof x !== 'string'))) return k + ' ist keine Liste von Texten';
  if (e.bezug != null && (!Array.isArray(e.bezug) || e.bezug.some(b => !b || typeof b !== 'object' || typeof b.id !== 'string' || typeof b.art !== 'string' || (b.ref != null && typeof b.ref !== 'string')))) return 'bezug ist keine Liste von {art, id}';
  for (const [k, feld] of [['anker', 'text'], ['zaehle', 'text'], ['waechter', 'fall']]) {
    if (e[k] != null && (!Array.isArray(e[k]) || e[k].some(x => !x || typeof x !== 'object' || typeof x.datei !== 'string' || typeof x[feld] !== 'string'))) return k + ' ist keine Liste von {datei, ' + feld + '}';
  }
  if (e.zaehle != null && e.zaehle.some(x => !Number.isInteger(x.n))) return 'zaehle ohne ganze Zahl n';
  if (e.geliefert != null && (!Array.isArray(e.geliefert) || e.geliefert.some(x => !x || typeof x !== 'object' || typeof x.pfad !== 'string' || typeof x.commit !== 'string'))) return 'geliefert ist keine Liste von {pfad, commit}';
  // Schon beim LESEN: ein Pfad, der nicht wie ein Repo-Pfad aussieht, wird nie gerechnet und nie als Befehl gedruckt.
  if (e.geliefert != null && e.geliefert.some(x => !lieferPfadOk(x.pfad) || !COMMIT_FORM.test(x.commit))) return 'geliefert nennt einen Pfad, der nicht wie ein Repo-Pfad aussieht, oder keine volle Commit-Kennung (er wuerde als Befehl gedruckt)';
  // Schon beim LESEN (Gegenpruefung 5, Skeptiker, R5b-ausgabe-0): ein einzeiliges Feld mit Zeilenumbruch, ESC, Bidi- oder Tag-Zeichen
  // macht die Fassung UNLESBAR (wie ein ungueltiges `von`) — sie schreibt so keine eigenen Zeilen in die Ausgabe eines Lesers.
  const ez = einzeiligFehler(e);
  if (ez.length) return ez[0];
  return null;
}
// Die Kennung, die git einem Blob gibt (sha1 ueber „blob <n>\0" und den Inhalt) — fuer Dateien des
// Arbeitsbaums, damit eine Fassung ueberall dieselbe Kennung traegt.
export function blobKennung(buf) { return crypto.createHash('sha1').update('blob ' + buf.length + '\0').update(buf).digest('hex'); }
// `git log --raw --no-abbrev -z --format=%x01<at> <ct>`: je Commit ein Kopf, je Datei „:<m1> <m2> <o1> <o2> <S>\0<pfad>\0"
// (gemessen an git 2.43). Ergebnis: Map pfad → [{at, ct, blob, mode}] in Log-Reihenfolge; ein geloeschter Pfad hat keinen Blob.
function pfadVerlauf(out) {
  if (out == null) return null;
  const m = new Map(), t = String(out).split('\0');
  let at = null, ct = null;
  for (let i = 0; i < t.length; i++) {
    const x = t[i].replace(/^\n+/, '');
    if (x[0] === '\x01') { const z = x.slice(1).trim().split(' '); at = Number(z[0]) * 1000; ct = Number(z[1]) * 1000; continue; }
    const r = x.match(/^:\d{6} (\d{6}) [0-9a-f]{40,64} ([0-9a-f]{40,64}) [A-Z]\d*$/);
    if (!r) continue;
    const pfad = t[++i];
    if (pfad == null || /^0+$/.test(r[2]) || !(at > 0)) continue;
    if (!m.has(pfad)) m.set(pfad, []);
    m.get(pfad).push({ at, ct: ct > 0 ? ct : at, blob: r[2], mode: r[1] });
  }
  return m;
}
// Der ANSPRUCH einer Lage oder eines Halts: id, `von`, die Ziele, die die Lage NIMMT (in ihrer Reihenfolge — leer bei
// phase „fertig" oder `mithelfen: true`, und bei einem Halt), und `bis`. Eine Berichtigung des Textes (Titel, Text, Runde)
// behaelt ihn — und damit ihre Zeit (vorher hiess eine ehrliche Berichtigung nach mehr als 6 h „rueckdatiert"); neue Ziele
// sind ein neuer Anspruch (vorher machte ein alter Platzhalter am selben Pfad eine neue Uebernahme alt, Gegenpruefung 3/4).
// Gegenpruefung 5 (R5-fassungen-3, R5-pruefstand-1): der Anspruch kannte weder `mithelfen` noch `phase` noch `bis` noch die
// Reihenfolge — eine harmlose Mithelf-Lage, ein „fertig" oder eine abgelaufene Lage wurde Stunden spaeter per Bearbeitung
// zur Uebernahme MIT ihrer alten Zeit und nahm einem spaeteren Nehmer das Ziel; ein Umordnen der Ziele schob ein Ziel unter
// den Deckel. Jetzt ist jede dieser Aenderungen ein neuer Anspruch mit neuer Ankunft (also „rueckdatiert", wenn der
// Zeitstempel alt bleibt). Eine Verlaengerung ist eine neue Lage (`nehme <id>` erneut — kettenAnfang traegt sie).
// Gegenpruefung 5, Skeptiker (R5b-fassungen-3, D3): ein HALT nimmt nichts — sein Anspruch ist [id, von], ohne `bis`. Mit `bis`
// war ein ehrlich per Bearbeitung verlaengerter Bump-Halt (8 h alt, `bis` von +4 h auf +32 h, innerhalb FRIST_MAX_H) danach
// „rueckdatiert", also unwirksam, und `naechste` gab den Bump frei — die gefaehrliche Richtung. `bis` braucht der Anspruch nur
// dort, wo es etwas NIMMT (Lage: E3).
export function anspruchKennung(e) {
  if (e && e.art === 'halt') return crypto.createHash('sha1').update(JSON.stringify([String(e.id), String(e.von)])).digest('hex').slice(0, 16);
  const nimmtE = !!e && e.art === 'lage' && e.phase !== 'fertig' && e.mithelfen !== true;
  const ziele = nimmtE ? alsListe(e.bezug).filter(b => b && b.art === 'baut_auf').map(b => String(b.id)) : [];
  return crypto.createHash('sha1').update(JSON.stringify([String(e && e.id), String(e && e.von), ziele, e && e.bis != null ? String(e.bis) : null])).digest('hex').slice(0, 16);
}
// Das VERZEICHNIS des Waechters in zz-sicherung: je gesicherter Fassung, wann der Waechter sie zuerst sah (erst) und wann
// zuletzt noch nicht (nichtVor), dazu ihr Anspruch; und die Branches, die verschwanden und NEU ANGELEGT wurden. Zeiten, die
// kein Schreiber setzt — kein Titel, kein Text. Ein Verzeichnis mit einem Stand in der Zukunft gilt nicht (es machte sonst
// jede neue Lage „rueckdatiert"); ein Eintrag mit einer Zeit nach dem Stand ebenso nicht.
export const VERZEICHNIS = 'docs/austausch/sicherung.json';
// Gegenpruefung 5 (E1 des Koordinators): je Fassung zusaetzlich `heimErst` / `heimNichtVor` — die erste Sichtung dieses
// Blobs auf einem Ref, der fuer sein `von` ZU HAUSE ist (origin/<Branch aus von>, nicht neu angelegt, oder origin/main), und
// der Lauf davor. Ergebnis je Blob in ms oder null; `undefined`, wenn das Feld fehlt (altes Format — dann gilt nichtVor wie
// bisher). Dazu je id ALLE `von`, die das Verzeichnis je gesichert hat (auch die nur unter fassungen/: `vonsJeId`, und je Blob
// `fassungenJeId`), die gemerkten Rueckzuege und die verschwundenen Refs. Das alte Feld `entfernt` liest niemand mehr.
const isoMs = (x) => { if (x == null) return null; const t = Date.parse(String(x)); return isNaN(t) ? NaN : t; };
export function verzeichnisPruefen(roh, jetzt) {
  let j; try { j = JSON.parse(roh); } catch (_) { return null; }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return null;
  const stand = Date.parse(String(j.stand || ''));
  if (isNaN(stand) || stand > (jetzt == null ? Date.now() : jetzt) + VORLAUF_MS) return null;
  const je = new Map(), neuAngelegt = new Map(), vonsJeId = new Map(), fassungenJeId = new Map(), fassungInfo = new Map();
  let mitHeim = false;
  for (const x of Array.isArray(j.fassungen) ? j.fassungen : []) {
    if (!x || typeof x !== 'object' || !/^[0-9a-f]{40}$/.test(String(x.blob)) || !ID_FORM.test(String(x.id)) || typeof x.von !== 'string') continue;
    // Gegenpruefung 5, Skeptiker (D7): je Fassung auch `art` und `bis` (der Waechter schreibt sie seit Runde 5b) — damit ein Leser
    // einen strittigen Eintrag, von dem er KEINE Fassung lesen kann (alle Branches weg, nur unter fassungen/), trotzdem nennt und
    // fuer einen Halt „nicht rechenbar" sagt. undefined = altes Format (unbekannt); bis null = ohne Frist.
    const art = typeof x.art === 'string' ? x.art : undefined;
    let bis;
    if (Object.prototype.hasOwnProperty.call(x, 'bis')) { if (x.bis === null) bis = null; else { const t = isoMs(x.bis); bis = t == null || isNaN(t) ? undefined : t; } }
    // Eine BEWAHRTE Fassung (ohne Gedaechtnis in der Sicherung gefunden, keinem Schreiber zuzuordnen) zaehlt fuer die Frage nach
    // dem Schreiber nicht mit — wie beim Waechter (Gegenpruefung 5, „OFFEN laut Reparatur waechter" 6a): sonst machte eine von Hand
    // in zz-sicherung gelegte Datei nach einem Cache-Verlust jeden Eintrag strittig. Ihr `von` (aus dem Inhalt) bleibt je Blob
    // bekannt (fassungInfo) — fuer eine fehlende Kopie desselben Blobs auf einem Branch.
    const bewahrt = x.bewahrt === true;
    fassungInfo.set(x.blob, { id: x.id, von: x.von, art, bis, bewahrt });
    // Wer je eine Fassung dieser id schrieb, zaehlt fuer die Frage nach dem Schreiber — auch ohne gueltige Zeiten (R5-fassungen-1).
    if (!bewahrt) {
      if (!vonsJeId.has(x.id)) { vonsJeId.set(x.id, new Set()); fassungenJeId.set(x.id, new Map()); }
      vonsJeId.get(x.id).add(x.von); fassungenJeId.get(x.id).set(x.blob, x.von);
    }
    if (Object.prototype.hasOwnProperty.call(x, 'heimErst')) mitHeim = true;
    if (!/^[0-9a-f]{16}$/.test(String(x.anspruch))) continue;
    const erst = Date.parse(String(x.erst || '')), nv = x.nichtVor == null ? null : Date.parse(String(x.nichtVor));
    if (isNaN(erst) || erst > stand || (nv != null && (isNaN(nv) || nv > erst))) continue;
    // Heim-Zeiten: unlesbar oder nach dem Stand → „nie zu Hause gesehen" (null); ein nichtVor nach der Sichtung → unbekannt.
    let heimErst, heimNichtVor;
    if (Object.prototype.hasOwnProperty.call(x, 'heimErst')) {
      heimErst = isoMs(x.heimErst);
      if (heimErst != null && (isNaN(heimErst) || heimErst > stand)) heimErst = null;
      heimNichtVor = heimErst == null ? null : isoMs(x.heimNichtVor);
      if (heimNichtVor != null && (isNaN(heimNichtVor) || heimNichtVor > heimErst)) heimNichtVor = null;
    }
    je.set(x.blob, { id: x.id, von: x.von, anspruch: x.anspruch, erst, nichtVor: nv, heimErst, heimNichtVor, bewahrt: x.bewahrt === true });
  }
  const na = j.neuAngelegt && typeof j.neuAngelegt === 'object' && !Array.isArray(j.neuAngelegt) ? j.neuAngelegt : {};
  for (const ref of Object.keys(na)) { const ms = Date.parse(String(na[ref])); if (!isNaN(ms) && ms <= stand && ref.indexOf(REMOTE + '/') === 0 && !istSicherungsRef(ref)) neuAngelegt.set(ref, ms); }
  const weg = new Map(), rueckzuege = [];
  const w0 = j.weg && typeof j.weg === 'object' && !Array.isArray(j.weg) ? j.weg : {};
  for (const ref of Object.keys(w0)) { const ms = Date.parse(String(w0[ref])); if (!isNaN(ms) && ms <= stand && ref.indexOf(REMOTE + '/') === 0) weg.set(ref, ms); }
  for (const r of Array.isArray(j.rueckzuege) ? j.rueckzuege : []) {
    if (!r || typeof r !== 'object' || !ID_FORM.test(String(r.id)) || typeof r.von !== 'string' || typeof r.ref !== 'string' || (r.blob != null && !/^[0-9a-f]{40}$/.test(String(r.blob)))) continue;
    const seit = isoMs(r.seit);
    rueckzuege.push({ id: r.id, blob: r.blob == null ? null : r.blob, von: r.von, ref: r.ref, seit: seit == null || isNaN(seit) ? null : seit });
  }
  return { stand, je, neuAngelegt, vonsJeId, fassungenJeId, fassungInfo, mitHeim, weg, rueckzuege };
}
// Das Verzeichnis aus origin/zz-sicherung, OHNE nachzuladen. Mit `opts.status` kommt { verz, status, grund }:
//   'da' (gelesen und gueltig) · 'fehlt' (kein zz-sicherung) · 'ohne' (zz-sicherung ohne Verzeichnis — ein Waechter vor dem
//   Verzeichnis) · 'ungueltig' (kein JSON, Stand in der Zukunft) · 'unlesbar' (Baum oder Blob nicht im lokalen Objektspeicher).
// Gegenpruefung 5 (R5-lesen-2): im Klon mit --filter=blob:none fehlte der Blob des Verzeichnisses, `show` gab null — und das
// hiess „kein Verzeichnis": die Ankunft kam still aus der Autor-Zeit (einer Selbstauskunft), eine rueckdatierte Lage stahl die
// Uebernahme, die der volle Klon „rueckdatiert" nannte. „Nicht gelesen" ist jetzt ein eigener Zustand (brettLesen: Ankunft offen).
export function verzeichnisLesen(wurzel, jetzt, opts) {
  const ref = 'refs/remotes/' + REMOTE + '/' + SICHERUNG_ZWEIG, NL = { GIT_NO_LAZY_FETCH: '1' };
  const r = (verz, status, grund) => opts && opts.status ? { verz: verz || null, status, grund: grund || null } : (verz || null);
  if (gitRoh(wurzel, ['rev-parse', '--verify', '--quiet', ref + '^{commit}'], NL) == null) return r(null, 'fehlt');
  const ls = gitRoh(wurzel, ['ls-tree', '-z', ref, '--', VERZEICHNIS], NL);
  if (ls == null) return r(null, 'unlesbar', 'der Baum von ' + REMOTE + '/' + SICHERUNG_ZWEIG + ' liegt nicht im lokalen Objektspeicher (Teilabruf)');
  const m = ls.match(/^\d+ blob ([0-9a-f]{40,64})\t/);
  if (!m) return r(null, 'ohne');
  const t = gitRoh(wurzel, ['cat-file', 'blob', m[1]], NL);
  if (t == null) return r(null, 'unlesbar', 'das Verzeichnis des Waechters (' + VERZEICHNIS + ' auf ' + REMOTE + '/' + SICHERUNG_ZWEIG + ') liegt nicht im lokalen Objektspeicher (Teilabruf)');
  const v = verzeichnisPruefen(t, jetzt);
  return v ? r(v, 'da') : r(null, 'ungueltig', 'das Verzeichnis des Waechters ist kein gueltiges JSON oder sein Stand liegt in der Zukunft');
}
// Fehlt die GESCHICHTE (Gegenpruefung 5, R5-lesen-0/-7)? Im Klon mit --filter=tree:0 liegen die Commits da, ihre Baeume nicht —
// `git log --raw` auf einen Branch scheiterte dort je Ref mit 128 (gemessen 0,1–0,4 s je Aufruf, 321 Aufrufe: `naechste` 74 s
// statt 9 s), und jede fremde Lage hiess „Ankunft nicht bestimmbar", waehrend `nehme` eine zweite Uebernahme schrieb. EINMAL je
// Wurzel (und Stand der Refs) erkannt: ein Teilabruf (Promisor-Remote), in dem unter den Spitzen der Remote-Refs ODER ihren
// Eltern ein Wurzelbaum fehlt (`rev-list --missing=print`, laedt nie nach). Ein flacher Klon hat andere Regeln (keine Eltern).
const geschichteMerk = new Map();
export function geschichteFehlt(wurzel) {
  const schluessel = path.resolve(String(wurzel || '.'));
  const promisor = promisorRemotes(wurzel).length > 0;
  if (!promisor) return false;
  const refsRoh = git(wurzel, ['for-each-ref', '--format=%(objectname) %(refname)', 'refs/remotes/'], { ohneNachladen: true });
  if (refsRoh == null) return true;
  const k = schluessel + '\0' + refsRoh;
  if (geschichteMerk.has(k)) return geschichteMerk.get(k);
  const spitzen = [...new Set(refsRoh.split('\n').map(z => z.trim().split(' ')).filter(z => z.length === 2 && !/\/HEAD$/.test(z[1])).map(z => z[0]))];
  let fehlt = false;
  if (spitzen.length) {
    const eltern = git(wurzel, ['log', '--no-walk=unsorted', '--format=%P'].concat(spitzen), { ohneNachladen: true });
    const pruef = eltern == null ? null : [...new Set(spitzen.concat(eltern.split(/\s+/).filter(x => /^[0-9a-f]{40,64}$/.test(x))))];
    // Eltern, die als Commit fehlen (flache Grenze), pruefen wir nicht: nur was da ist, kann einen fehlenden Baum haben.
    const da = pruef ? (git(wurzel, ['rev-list', '--no-walk', '--ignore-missing'].concat(pruef), { ohneNachladen: true }) || '').split('\n').filter(Boolean) : null;
    const f = da && da.length ? fehlendUnter(wurzel, da, 'tree:1') : (da ? new Set() : null);
    fehlt = f == null || f.size > 0;
  }
  geschichteMerk.set(k, fehlt);
  return fehlt;
}
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
  // Die Grabstein-Liste von main nicht gelesen (Teilabruf, R5-lesen-4): sie ist eine ungelesene Datei wie ein Eintrag.
  for (const x of grabG.fehlt || []) { aus.fehlend.push(x); aus.unlesbar.push({ datei: path.posix.basename(GRABSTEINE), quelle: x.quelle, grund: (x.baum ? 'Baum' : 'Blob') + ' nicht im lokalen Objektspeicher (Teilabruf) — was auf main zurueckgezogen ist, ist hier NICHT bekannt' }); }
  aus.doppeltFassungen = [];
  // Jede FASSUNG (Blob) einer id mit allen Quellen, in Lesereihenfolge: Arbeitsbaum, main, Branches, Sicherung.
  const fass = aus.fassungen, jeQuelle = new Map(), neu = new Map();
  // Wer schrieb eine Fassung, die ein Grabstein (je Fassung, mit blob) entfernt hat? Ihr `von` zaehlt fuer die Frage nach
  // dem Schreiber weiter mit: vorher traf ein Grabstein das Original, und die uebrige Faelschung mit fremdem `von` galt
  // allein — als einzige Fassung, ohne jede Pruefung (Gegenpruefung 4).
  const entferntVon = new Map();
  aus.entferntVon = entferntVon;
  // Gegenpruefung 5, Skeptiker (R5b-fassungen-5, D5): auch ein Grabstein je Fassung AUF origin/main entscheidet einen strittigen
  // Eintrag NICHT — das `von` der so entfernten Fassung zaehlt weiter. E2 hatte ihn zur Entscheidung gemacht, und das wirkte in
  // beide Richtungen: ein Grabstein auf das ORIGINAL (etwa wegen eines Namens im Text) machte die Faelschung mit fremdem `von`
  // zur geltenden Fassung („Login geht wieder, alles gut"), und der naechste Waechterlauf sicherte sie dauerhaft. Das
  // Verzeichnis kann nicht sagen, wer zuerst da war (beide Fassungen sind fuer ihr eigenes `von` zu Hause). Strittig endet nur
  // mit einer Fassung auf origin/main, einem Grabstein fuer die GANZE id auf main oder dem Ablauf (Lage/Halt: bis vorbei).
  // mainGrabBlob bleibt fuer die FEHLENDEN Fassungen: eine so entfernte kann nie gelten, aber ihr `von` zaehlt (fehltJeId).
  const mainGrabBlob = new Set();
  if (opts.alleRefs) { const t = gitRoh(wurzel, ['show', 'refs/remotes/' + REMOTE + '/main:' + GRABSTEINE], { GIT_NO_LAZY_FETCH: '1' }); if (t != null) grabsteinePruefen(t).blobs.forEach(b => mainGrabBlob.add(b)); }
  aus.mainGrabBlob = mainGrabBlob;
  const nimm = (e, blob, quelle, pfad) => {
    if (!e) return;
    if (grab.has(e.id) || grabBlob.has(blob)) {
      aus.zurueckgezogen++; if (quelle === 'Arbeitsbaum') aus.grabDateien.push(e._datei);
      if (!grab.has(e.id)) { if (!entferntVon.has(e.id)) entferntVon.set(e.id, new Set()); entferntVon.get(e.id).add(e.von); }
      return;
    }
    if (!jeQuelle.has(quelle)) jeQuelle.set(quelle, new Map());
    const vorDatei = jeQuelle.get(quelle).get(e.id);
    // Zwei Dateien derselben id auf EINEM Branch: fuer Leser zaehlt die erste (genannt als doppelt) — der Waechter
    // sichert auch die zweite (vorher wurde sie nie gesichert und nirgends genannt, Gegenpruefung 3).
    if (vorDatei != null && vorDatei !== pfad) { aus.doppelt.push({ id: e.id, dateien: [path.posix.basename(vorDatei), path.posix.basename(pfad)], quelle }); aus.doppeltFassungen.push({ id: e.id, e, blob, quelle, pfad }); return; }
    jeQuelle.get(quelle).set(e.id, pfad);
    liegt(e.id, quelle);
    let l = fass.get(e.id);
    if (!l) { l = []; fass.set(e.id, l); neu.set(quelle, (neu.get(quelle) || 0) + 1); }
    // Eine Fassung ist ein BLOB. Vorher galt auch „bis auf Leerraum gleich" als dieselbe Fassung — die zuerst gelesene
    // Kopie gab ihr den Namen, und die Sicherung legte das Original unter einem fremd gewaehlten Namen ab (Gegenpruefung 4).
    const gleich = l.find(v => v.blob === blob);
    if (gleich) { gleich.quellen.add(quelle); if (!gleich.pfade.has(quelle)) gleich.pfade.set(quelle, pfad); return; }
    l.push({ e, blob, quellen: new Set([quelle]), pfade: new Map([[quelle, pfad]]) });
  };
  // Ein Unterordner je Monat (eintraege/2026-11/…): das Verzeichnis waechst nur
  // durch Anlegen, und kein Deckel soll je einen Unbeteiligten rot faerben.
  // Der EINE Ort eines Eintrags: eintraege/<JJJJ-MM>/<name>.json, und der Monat ist der seiner id — fuer den Arbeitsbaum
  // UND jeden Remote-Ref (ortFehler). Vorher las der Arbeitsbaum nur die Monatsordner, ein Remote-Ref jede .json in jeder
  // Tiefe: unter eintraege/x/ sah der Pruefstand (A10) einen Eintrag nicht, jeder Leser auf main schon — ein „fertig" im
  // fremden Namen kam so an A10 vorbei, und eine Doppelte unter eintraege/0/ gewann gegen das Original (Gegenpruefung 4).
  const dir = path.join(wurzel, ORDNER);
  const liesOrdner = (d) => { for (const n of fs.readdirSync(d).sort()) {
    const p = path.join(d, n);
    let st = null; try { st = fs.lstatSync(p); } catch (_) { continue; }
    if (st.isDirectory() && /\.json$/.test(n)) { aus.unlesbar.push({ datei: n, quelle: 'Arbeitsbaum', grund: 'nicht lesbar: ein Ordner, keine Datei' }); continue; }
    if (st.isDirectory()) { liesOrdner(p); continue; }
    if (!/\.json$/.test(n)) continue;
    const pfad = path.relative(wurzel, p).split(path.sep).join('/');
    let buf = null;
    try { buf = fs.readFileSync(p); } catch (x) { aus.unlesbar.push({ datei: n, quelle: 'Arbeitsbaum', grund: 'nicht lesbar: ' + String(x.message).split('\n')[0] }); }
    if (buf == null) continue;
    const blob = blobKennung(buf), of = ortFehler(pfad);
    if (of) { aus.unlesbar.push({ datei: n, quelle: 'Arbeitsbaum', grund: of }); aus.unlesbarOrte.push({ quelle: 'Arbeitsbaum', pfad, blob }); continue; }
    const e = lies(buf.toString('utf8'), n, 'Arbeitsbaum', aus.unlesbar, { pfad, blob });
    if (!e) aus.unlesbarOrte.push({ quelle: 'Arbeitsbaum', pfad, blob });
    nimm(e, blob, 'Arbeitsbaum', pfad);
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
        // Ohne Nachladen (GIT_NO_LAZY_FETCH): in einem Teilabruf ohne Baeume (--filter=tree:0) lud ls-tree sie still aus
        // dem Netz — oder, ohne Netz, lieferte es nichts, und die Eintraege dieses Refs verschwanden STILL: A8 sagte
        // „keiner beruehrt", `naechste` vergab eine Nummer doppelt (Gegenpruefung 4). Ein Baum, der fehlt, ist jetzt eine
        // nicht gelesene Quelle (`fehlend`, mit `baum: true`) — wer rechnet, sagt „nicht rechenbar".
        const ls = gitRoh(wurzel, ['ls-tree', '-r', '-t', '-z', voll, '--', ORDNER + '/'], { GIT_NO_LAZY_FETCH: '1' });
        const z = [];
        if (ls == null) { aus.fehlend.push({ quelle: ref, pfad: ORDNER + '/', blob: null, baum: true }); aus.unlesbar.push({ datei: ORDNER + '/', quelle: ref, grund: 'Baum nicht im lokalen Objektspeicher (Teilabruf ohne Baeume?) — die Eintraege dieses Branches sind NICHT gelesen' }); }
        for (const zeile of (ls || '').split('\0')) {
          const t = zeile.match(/^\d+ tree ([0-9a-f]+)\t(.+)$/);
          if (t) { if (t[2] === ORDNER) baeume.add(t[1]); continue; }
          const m = zeile.match(/^\d+ blob ([0-9a-f]+)\t(.+\.json)$/);
          if (!m) continue;
          const of = ortFehler(m[2]);
          if (of) { aus.unlesbar.push({ datei: path.posix.basename(m[2]), quelle: ref, grund: of }); aus.unlesbarOrte.push({ quelle: ref, pfad: m[2], blob: m[1] }); continue; }
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
      // Gegenpruefung 5 (R5-fassungen-2): dieselbe Teilabruf-Grenze wie A8 (aus der uebergebenen Umgebung, sonst process.env).
      // Ein fehlender Blob, der NACHWEISLICH groesser ist als jeder Eintrag (in der CI: blob:limit=200k > 64 KB), ist keine
      // Fassung — er bleibt unlesbar mit Grund, macht die id aber nicht strittig. Vorher legte eine 300-KB-Datei mit dem NAMEN
      // einer Halt-id auf irgendeinem Branch den Halt in der CI lahm (A8: „rechenbar, keiner beruehrt").
      const umg = Object.assign({}, process.env, opts.umgebung || {}), grenzen = new Map();
      const grenzeVon = (quelle) => { const r = String(quelle).split('/')[0]; if (!grenzen.has(r)) grenzen.set(r, teilabrufGrenze(wurzel, r, umg)); return grenzen.get(r); };
      for (const { ref, z } of jeRef) for (const x of z) {
        const name = path.posix.basename(x.pfad), k = x.blob + '\0' + name;
        if (fehlt.has(x.blob)) {
          const gr = grenzeVon(ref), zuGross = gr > EINTRAG_MAX_BYTES;
          aus.fehlend.push(zuGross ? { quelle: ref, pfad: x.pfad, blob: x.blob, zuGross: true, ab: gr } : { quelle: ref, pfad: x.pfad, blob: x.blob });
          aus.unlesbarOrte.push({ quelle: ref, pfad: x.pfad, blob: x.blob });
          if (!gelesen.has(k)) { gelesen.set(k, null); aus.unlesbar.push({ datei: name, quelle: ref, grund: zuGross ? 'Blob nicht im lokalen Objektspeicher (Teilabruf: nicht geholt — nachweislich mindestens ' + Math.round(gr / 1024) + ' KB laut Teilabruf-Grenze der CI, also groesser als ' + (EINTRAG_MAX_BYTES / 1024) + ' KB: kein Eintrag)' : NICHT_GEHOLT }); }
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
          // Rang des Namens: zu Hause (Arbeitsbaum, main, Branch des Schreibers) vor der Sicherung (dort steht der Name, unter
          // dem die Fassung zuletzt galt) vor jeder anderen Kopie — vorher gab eine Kopie unter fremd gewaehltem Namen der
          // geretteten Fassung ihren Namen, und `ernten` legte sie so ab (Gegenpruefung 4).
          const rang = (q, y) => q === 'Arbeitsbaum' || istMainRef(q) || istAutorRef(q, autorZweig(y)) ? 2 : (istSicherungsRef(q) ? 1 : 0);
          const mn = mangel(e), mv = mangel(v.e);
          if (mn < mv || (mn === mv && rang(ref, e) > rang(v.e._quelle, v.e))) v.e = e;
        }
      }
      for (const { ref } of jeRef) if (neu.get(ref)) aus.quellen.push(ref + ' (+' + neu.get(ref) + ')');
    }
  }
  // WELCHE Fassung gilt? (Gegenpruefung 2–5)
  //   1. Ein EIGENER Eintrag (sein `von` ist einer meiner Namen, opts.ich): die Fassung im Arbeitsbaum — ich berichtige sie.
  //      Nur ein eigener: vorher galt JEDE Fassung im Arbeitsbaum, und wer den Branch eines anderen gemergt hatte, hielt
  //      dessen spaeter berichtigten Halt fuer unwirksam, waehrend er fuer alle anderen wirkte (Gegenpruefung 4).
  //   2. Sonst die Fassung auf origin/main (gemergt).
  //   3. Sonst die des SCHREIBERS auf seinem Branch. Der Schreiber ist eine Eigenschaft des EINTRAGS: der der gesicherten
  //      Fassung (unter eintraege/ in zz-sicherung: dort steht, was zuletzt galt), sonst ein einheitliches `von` ALLER
  //      Fassungen — der gelesenen, der vom Schreiber per Grabstein entfernten (entferntVon) und JEDER, die das Verzeichnis des
  //      Waechters je gesichert hat, auch unter fassungen/ (Gegenpruefung 5, R5-fassungen-1: vorher zaehlten nur gelesene; war
  //      der Branch des Originals geloescht, galt die Faelschung allein, und ein kritischer Befund verschwand fuer alle). Auch
  //      eine Fassung, die ein Grabstein je Fassung AUF origin/main entfernt hat, zaehlt mit (D5 — siehe entferntVon).
  //      Tragen sie verschiedene `von`, ist der Eintrag STRITTIG.
  //      Ein Branch, der NEU ANGELEGT wurde, nachdem er verschwunden war (Verzeichnis), ist fuer die ids, die der Waechter
  //      schon VOR dem Neuanlegen sah — gesichert ODER als gemerkter Rueckzug —, nicht mehr das Zuhause ihres Schreibers: seine
  //      Fassung gilt nie als Berichtigung (Gegenpruefung 5, E6), und ist keine gesichert, ist sie dort auch nicht die des
  //      Schreibers (`_nichtZuhause`: vonPasst sagt nein — Skeptiker R5b-waechter-3, D6: ein zurueckgezogener Halt, byte-gleich
  //      auf den neu angelegten Branch gelegt, wirkte vorher wieder fuer alle Leser, nur der Waechter wusste es). Die alte
  //      Ausnahme „seine Geschichte traegt die gesicherte Fassung" ist weg: sie war trivial zu erfuellen (die gesicherte Fassung
  //      byte-gleich aus zz-sicherung committen, dann die Faelschung — R5-fassungen-6) und rechnete im flachen Klon anders als im
  //      vollen (R5-fassungen-7). Gilt deshalb die GESICHERTE Fassung, vertritt sie den Schreiber auf diesem Branch, solange er
  //      dort eine Fassung traegt (`_zuhauseVertreten`, Skeptiker R5b-fassungen-2, D2): vorher wirkte ein ehrlich geloeschter,
  //      neu gepushter und dann berichtigter Halt fuer NIEMANDEN mehr („von passt nicht zum Branch") — mit ihrem Inhalt, nicht
  //      dem der Berichtigung.
  //   4. Sonst die gesicherte; sonst eine einzelne Fassung ohne Widerspruch. Sonst STRITTIG: nicht gerechnet, aber genannt.
  //   Fehlt eine Fassung (Teilabruf: Blob nicht gelesen), entscheidet sie mit, wo sie entscheiden KANN: auf main, auf dem
  //   Branch des Schreibers, und solange der Schreiber nicht feststeht und das Verzeichnis ihr `von` nicht nennt (sonst
  //   entschiede, welcher Blob zufaellig da ist — Gegenpruefung 4). Eine fehlende Fassung auf einem DRITTEN Branch nimmt der
  //   gesicherten oder der beim Schreiber nichts, und ein nachweislich zu grosser Blob ist gar keine (R5-fassungen-2).
  const ichNamen = Array.isArray(opts.ich) ? opts.ich.filter(Boolean) : (opts.ich ? [opts.ich] : (opts.alleRefs && aus.gitDa ? eigeneNamen(eigenerZweig(wurzel)) : []));
  // Der Waechter gibt sein eigenes (frischeres) Verzeichnis mit; alle anderen lesen das aus zz-sicherung — MIT Zustand: liegt
  // zz-sicherung da, ihr Verzeichnis aber nicht im lokalen Objektspeicher, ist offen, was es entscheiden wuerde (R5-lesen-2).
  let verz = null, verzStatus = null;
  if (opts.verzeichnis !== undefined) { verz = opts.verzeichnis || null; verzStatus = verz ? 'da' : 'fehlt'; }
  else if (opts.alleRefs && aus.gitDa) { const vs = verzeichnisLesen(wurzel, opts.jetzt, { status: true }); verz = vs.verz; verzStatus = vs.status; aus.verzeichnisGrund = vs.grund; }
  aus.verzeichnis = verz; aus.verzeichnisStatus = verzStatus;
  const verzUnlesbar = verzStatus === 'unlesbar';
  const fehltJeId = new Map();
  // Ein fehlender Blob, den ein Grabstein auf main entfernt hat, kann nie gelten — aber sein `von` zaehlt (D5): er steht hier mit
  // `entfernt` (vorher fiel er ganz weg, und im Teilabruf galt die Faelschung, die der volle Klon strittig nannte).
  for (const x of aus.fehlend) { const id = x.baum || x.zuGross ? null : idAusName(path.posix.basename(x.pfad)); if (id) { if (!fehltJeId.has(id)) fehltJeId.set(id, []); fehltJeId.get(id).push(mainGrabBlob.has(x.blob) ? Object.assign({}, x, { entfernt: true }) : x); } }
  // Was das Verzeichnis je gesichert hat, je Blob: `von` und id (fassungenJeId; ein Verzeichnis des Waechters selbst traegt nur je).
  // verzBlobVon kennt jeden Blob (auch einen bewahrten: sein `von` steht in seinem Inhalt); verzIdBlobs — wer je eine Fassung
  // dieser id schrieb — nur die nicht bewahrten (Gegenpruefung 5, „OFFEN laut Reparatur waechter" 6a).
  const verzBlobVon = new Map(), verzIdBlobs = new Map();
  const merk = (id, bl, von, bewahrt) => { if (!verzBlobVon.has(bl)) verzBlobVon.set(bl, von); if (bewahrt) return; if (!verzIdBlobs.has(id)) verzIdBlobs.set(id, new Set()); verzIdBlobs.get(id).add(bl); };
  if (verz && verz.fassungInfo instanceof Map) for (const [bl, x] of verz.fassungInfo) merk(x.id, bl, x.von, x.bewahrt);
  if (verz && verz.fassungenJeId instanceof Map) for (const [id, m] of verz.fassungenJeId) for (const [bl, von] of m) merk(id, bl, von, false);
  if (verz && verz.je instanceof Map) for (const [bl, x] of verz.je) merk(x.id, bl, x.von, x.bewahrt === true);
  const verzVons = (id) => {
    const s = new Set();
    // Auch eine per Grabstein auf main entfernte Fassung (D5).
    for (const bl of verzIdBlobs.get(id) || []) s.add(verzBlobVon.get(bl));
    // Ein Verzeichnis, das je id nur die `von` kennt (keine Blobs): ungefiltert — die vorsichtige Richtung.
    if (verz && !verzIdBlobs.has(id) && verz.vonsJeId instanceof Map && verz.vonsJeId.get(id)) for (const v of verz.vonsJeId.get(id)) s.add(v);
    return s;
  };
  // Wann sah der Waechter diese id zuerst (irgendeine Fassung — oder einen gemerkten Rueckzug, D6: dieselbe Regel wie der
  // Waechter, ein Rueckzug ohne Zeit zaehlt als „vorher")? Fuer „neu angelegt" (E6).
  const idErst = (id) => {
    let m = null;
    for (const bl of verzIdBlobs.get(id) || []) { const x = verz.je && verz.je.get(bl); if (x && x.erst != null && (m == null || x.erst < m)) m = x.erst; }
    for (const z of verz && Array.isArray(verz.rueckzuege) ? verz.rueckzuege : []) if (z && z.id === id) { const t = z.seit == null ? -Infinity : z.seit; if (m == null || t < m) m = t; }
    return m;
  };
  // Neu angelegt: laut Verzeichnis — und (D6, Leser) ein Ref, den das Verzeichnis als VERSCHWUNDEN fuehrt (`weg`) und der hier
  // wieder besteht: er wurde nach dem letzten Lauf neu angelegt, der Waechter sagt es erst beim naechsten (vorher wirkte ein
  // zurueckgezogener Halt, byte-gleich auf den neu angelegten Branch gelegt, bis zum naechsten Lauf fuer alle).
  const neuAngelegtRef = new Map(verz && verz.neuAngelegt instanceof Map ? verz.neuAngelegt : []);
  if (verz && verz.weg instanceof Map) { const da = new Set(reihe.map(x => x.ref)); for (const [r, t] of verz.weg) if (da.has(r) && !neuAngelegtRef.has(r)) neuAngelegtRef.set(r, t); }
  const istZuhause = (id, ref) => { if (!neuAngelegtRef.has(ref)) return true; const e0 = idErst(id); return e0 == null || e0 >= neuAngelegtRef.get(ref); };
  // D2: vertritt die gesicherte Fassung g ihren Schreiber auf seinem neu angelegten Branch? Nur, wenn der Waechter sie VOR dem
  // Neuanlegen sah und ihr Schreiber sie nicht vorher zurueckzog — sonst ist sie die Spiegelung dessen, was der Neuanleger hinlegte.
  const vertritt = (g, ref) => {
    const t = neuAngelegtRef.get(ref), x = verz && verz.je instanceof Map ? verz.je.get(g.blob) : null;
    if (t == null || !x || x.erst == null || !(x.erst < t)) return false;
    return !(verz && Array.isArray(verz.rueckzuege) ? verz.rueckzuege : []).some(z => z && z.id === g.e.id && z.von === g.e.von && (z.blob == null || z.blob === g.blob) && (z.seit == null || z.seit < t));
  };
  // Nur bei unlesbarem Verzeichnis: welche Fassungen haelt zz-sicherung unter fassungen/<id>/ (die Baeume liegen im Teilabruf
  // mit blob:none da)? Eine, die hier nicht gelesen ist, koennte ein anderes `von` tragen. null: nicht lesbar.
  let sicherungFassungen;
  const sicherungsBlobs = (id) => {
    if (sicherungFassungen === undefined) {
      const ls = gitRoh(wurzel, ['ls-tree', '-r', '-z', 'refs/remotes/' + REMOTE + '/' + SICHERUNG_ZWEIG, '--', FASSUNGEN + '/'], { GIT_NO_LAZY_FETCH: '1' });
      sicherungFassungen = ls == null ? null : new Map();
      for (const z of (ls || '').split('\0')) {
        const m = z.match(/^\d+ blob ([0-9a-f]{40,64})\t(.+)$/); if (!m) continue;
        const t = m[2].slice(FASSUNGEN.length + 1).split('/');
        if (t.length === 2 && ID_FORM.test(t[0])) { if (!sicherungFassungen.has(t[0])) sicherungFassungen.set(t[0], new Set()); sicherungFassungen.get(t[0]).add(m[1]); }
      }
    }
    return sicherungFassungen === null ? null : (sicherungFassungen.get(id) || new Set());
  };
  // Alle ids unter fassungen/ (Map id → Set(Blob)) oder null (Baum nicht lesbar) — fuer D7 ohne Verzeichnis (R5c-Le4, F5).
  const sicherungAlle = () => { sicherungsBlobs(''); return sicherungFassungen; };
  const flach = opts.alleRefs && aus.gitDa ? (git(wurzel, ['rev-parse', '--is-shallow-repository']) || '').trim() === 'true' : false;
  // Fehlt die Geschichte (Teilabruf ohne Baeume), startet kein `git log` je Ref (R5-lesen-7) — einmal erkannt.
  const histFehlt = opts.alleRefs && aus.gitDa && !flach ? geschichteFehlt(wurzel) : false;
  aus.geschichteFehlt = histFehlt;
  const verlaeufe = new Map();   // ref → Map(pfad → [{at, ct, blob, mode}]) — volle Geschichte des Ordners, neueste zuerst
  const verlauf = (ref) => {
    if (!verlaeufe.has(ref)) verlaeufe.set(ref, flach || histFehlt ? null : pfadVerlauf(gitRoh(wurzel, ['log', '--no-renames', '--diff-merges=first-parent', '--raw', '--no-abbrev', '-z', '--format=%x01%at %ct', 'refs/remotes/' + ref, '--', ORDNER + '/'], { GIT_NO_LAZY_FETCH: '1' })));
    return verlaeufe.get(ref);
  };
  const nichtGelesen = (wo) => 'eine Fassung ist nicht gelesen (Teilabruf: ' + [...new Set(wo)].join(', ') + ') — welche gilt, ist nicht entscheidbar';
  // Fuer eine einzelne, ungesicherte Fassung abseits von main und dem Branch ihres Schreibers (waehle, letzter Schritt): haelt die
  // Sicherung etwas, das statt ihrer gaelte? (a) Die Fassung unter eintraege/ in zz-sicherung ist hier nicht gelesen (Teilabruf) —
  // sie entschiede. (b) Das Verzeichnis kennt eine ANDERE, hier nicht gelesene Fassung desselben `von`, die nicht per Grabstein
  // entfernt ist und die der Waechter zu Hause sah (heimErst; unbekannt im alten Format: zaehlt — die vorsichtige Richtung). Dann
  // ein Grund (nicht entscheidbar), sonst null. Nur fuer Leser (Gegenpruefung 5b, Hinweis der Gruppe waechter, N5).
  const leserOhneGesicherte = (id, schreiber, l, fehlt) => {
    if (opts.verzeichnis !== undefined) return null;
    const gz = fehlt.filter(x => istSicherungsRef(x.quelle));
    if (gz.length) return nichtGelesen(gz.map(x => x.quelle)) + ' (die gesicherte Fassung)';
    if (!verz) return null;
    const bek = new Set(l.map(v => v.blob));
    const heim = [...(verzIdBlobs.get(id) || [])].filter(bl => {
      if (bek.has(bl) || grabBlob.has(bl) || mainGrabBlob.has(bl) || verzBlobVon.get(bl) !== schreiber) return false;
      const x = verz.je instanceof Map ? verz.je.get(bl) : null;
      return !x || x.heimErst === undefined || x.heimErst != null;
    });
    if (!heim.length) return null;
    return 'die Sicherung (' + REMOTE + '/' + SICHERUNG_ZWEIG + ', unter ' + path.posix.basename(FASSUNGEN) + '/) haelt ' + heim.length + ' andere Fassung(en) desselben Schreibers, die der Waechter bei ihm zu Hause sah — die Fassung hier liegt weder auf main noch auf seinem Branch und ist nicht gesichert: welche gilt, ist nicht entscheidbar, bis der Waechter eine sichert (oder eine Fassung auf main liegt)';
  };
  const waehle = (id, l, ohneArbeitsbaum) => {
    const kand = ohneArbeitsbaum ? l.filter(v => [...v.quellen].some(q => q !== 'Arbeitsbaum')) : l;
    if (!kand.length) return { gilt: null, keine: true };
    const main = kand.find(v => [...v.quellen].some(istMainRef));
    if (main) return { gilt: main };
    // `fehltAlle`: auch die per Grabstein auf main entfernten (nur ihr `von` zaehlt, D5); `fehlt`: die, die gelten koennten.
    const fehltAlle = fehltJeId.get(id) || [], fehlt = fehltAlle.filter(x => !x.entfernt);
    if (fehlt.some(x => istMainRef(x.quelle))) return { gilt: null, grund: nichtGelesen(fehlt.filter(x => istMainRef(x.quelle)).map(x => x.quelle)) };
    const gesichert = kand.find(v => [...v.quellen].some(istSicherungsRef)) || null;
    let schreiber;
    if (gesichert) schreiber = gesichert.e.von;
    else {
      // Eine fehlende Fassung, deren `von` das Verzeichnis nennt, zaehlt mit diesem `von`; die uebrigen sind unbekannt.
      const unbekannt = fehltAlle.filter(x => !verzBlobVon.has(x.blob));
      if (unbekannt.length) return { gilt: null, grund: nichtGelesen(unbekannt.map(x => x.quelle)) };
      if (verzUnlesbar) {
        const sb = sicherungsBlobs(id), bek = new Set(l.map(v => v.blob));
        if (sb == null || [...sb].some(bl => !bek.has(bl))) return { gilt: null, grund: 'das Verzeichnis des Waechters ist hier nicht gelesen (Teilabruf) — ob eine gesicherte Fassung ein anderes „von" traegt, ist nicht entscheidbar' };
      }
      const vons = new Set(kand.map(v => v.e.von).concat([...(entferntVon.get(id) || [])], [...verzVons(id)], fehltAlle.map(x => verzBlobVon.get(x.blob))));
      if (vons.size !== 1) return { gilt: null, grund: 'Fassungen mit verschiedenem „von" (' + [...vons].join(', ') + '), keine gesichert' };
      schreiber = [...vons][0];
    }
    const b = autorZweig({ von: schreiber }), ref = b ? REMOTE + '/' + b : null;
    // Eine fehlende Fassung AUF dem Branch des Schreibers: was dort gilt, ist nicht gelesen.
    if (ref && fehlt.some(x => x.quelle === ref)) return { gilt: null, grund: nichtGelesen([ref]) };
    const amOrt = ref ? kand.filter(v => v.e.von === schreiber && v.quellen.has(ref)) : [];
    if (amOrt.length === 1) {
      const c = amOrt[0];
      if (istZuhause(id, ref)) {
        if (!gesichert || c === gesichert) return { gilt: c };
        // Ob der Branch neu angelegt wurde, sagt nur das Verzeichnis — ist es hier nicht gelesen, entscheidet die Fassung nichts.
        if (verzUnlesbar) return { gilt: null, grund: 'ob ' + ref + ' neu angelegt wurde, sagt das Verzeichnis des Waechters — es ist hier nicht gelesen (Teilabruf): ob die Fassung dort eine Berichtigung ist, ist nicht entscheidbar' };
        return { gilt: c };
      }
      // Der Branch wurde NEU ANGELEGT, und die id kannte der Waechter schon vorher (E6).
      // D2: eine gesicherte Fassung, die der Waechter VOR dem Neuanlegen sah und ihr Schreiber nicht zurueckzog, vertritt ihn dort.
      if (gesichert && vertritt(gesichert, ref)) {
        if (c === gesichert) return { gilt: c, vertreten: ref };
        return { gilt: gesichert, vertreten: ref, neuAngelegt: ref, hinweis: ref + ' wurde neu angelegt, nachdem er verschwunden war — seine Fassung ist keine Berichtigung des Schreibers; es gilt (und wirkt) die gesicherte' };
      }
      // D6: sonst ist die Fassung dort nicht die des Schreibers (vonPasst sagt nein) — auch wenn der Waechter sie nach dem
      // Neuanlegen wieder gesichert hat (Skeptiker R5b-waechter-3: ein zurueckgezogener Halt, byte-gleich neu hingelegt, galt
      // danach als gesichert und wirkte wieder). Liegt daneben keine andere Fassung, gilt sie als Text; sonst ist es strittig.
      if (gesichert) return { gilt: gesichert, nichtZuhause: ref };
      if (kand.length === 1) return { gilt: c, nichtZuhause: ref };
      return { gilt: null, grund: ref + ' wurde neu angelegt, nachdem er verschwunden war, und der Waechter kannte diesen Eintrag schon vorher (gesichert oder zurueckgezogen) — die Fassung dort ist nicht die des Schreibers, und keine ist gesichert' };
    }
    if (gesichert) return { gilt: gesichert };
    if (kand.length === 1) {
      // Gegenpruefung 5b, Skeptiker (Hinweis der Gruppe waechter, C34 N5): eine EINZELNE Fassung, die weder auf main noch beim
      // Schreiber liegt und nicht gesichert ist (eine Kopie auf einem DRITTEN Branch), galt still — auch wenn die Sicherung eine
      // ANDERE Fassung desselben Schreibers haelt, die der Waechter zu Hause sah, und die er nur noch nicht unter eintraege/ gelegt
      // hatte. Gemessen im N5-Ablauf: nach dem Loeschen von claude/b5 und EINEM Waechterlauf zeigte `zeige` die „Faelschung im
      // Namen von W5" von claude/c5 statt des kritischen Originals (bis zum naechsten Lauf). Jetzt: nicht entscheidbar, bis eine
      // Fassung gesichert ist oder auf main liegt. Nur fuer Leser — der Waechter rechnet mit seinem eigenen Verzeichnis.
      const anders = leserOhneGesicherte(id, schreiber, l, fehlt);
      if (anders) return { gilt: null, grund: anders };
      return { gilt: kand[0] };
    }
    return { gilt: null, grund: 'mehrere Fassungen, keine auf dem Branch des Schreibers, keine gesichert' };
  };
  aus.gilt = new Map(); aus.giltAndere = new Map(); aus.neuAngelegt = [];
  const nimmtAlle = (e) => e && e.art === 'lage' ? alsListe(e.bezug).filter(x => x && x.art === 'baut_auf').map(x => String(x.id)) : [];
  for (const [id, l] of fass) {
    const ab = l.find(v => v.quellen.has('Arbeitsbaum'));
    const eigen = !!ab && ichNamen.indexOf(ab.e.von) >= 0;
    const w = eigen ? { gilt: ab } : waehle(id, l, false);
    const gilt = w.gilt;
    if (!gilt) {
      // `arten` und `ziele` (jede baut_auf jeder Lage-Fassung): wer rechnet, sagt fuer einen strittigen Halt „nicht rechenbar",
      // fuer die Ziele einer strittigen Lage „nicht entscheidbar" (E2) — vorher fiel ein strittiger Eintrag still weg.
      const fehlNamen = (fehltJeId.get(id) || []).map(x => (path.posix.basename(x.pfad).match(NAME_FORM) || [])[2]).filter(Boolean);
      aus.strittig.push({ id, quellen: [...new Set(l.flatMap(v => [...v.quellen]))], grund: w.grund || null, arten: [...new Set(l.map(v => v.e.art).concat(fehlNamen))], ziele: [...new Set(l.flatMap(v => nimmtAlle(v.e)))] });
      continue;
    }
    if (w.hinweis) aus.neuAngelegt.push({ id, hinweis: w.hinweis });
    for (const v of l) if (v !== gilt) aus.abweichend.push({ id, gilt: [...gilt.quellen][0], weichtAb: [...v.quellen].join(', '), schreiber: v.e.von !== gilt.e.von ? v.e.von : null });
    // Was sehen die ANDEREN? Nur gesagt, wenn ich DIESE Fassung schon gepusht habe — vorher sah der Schreiber „Wirkt
    // jetzt: ja", waehrend fuer alle anderen die alte gesicherte Fassung galt (Gegenpruefung 4).
    if (eigen && [...gilt.quellen].some(q => q !== 'Arbeitsbaum' && !istSicherungsRef(q))) {
      const a = waehle(id, l, true);
      // Gegenpruefung 5b, Skeptiker (R5c-Le3, F4): gilt fuer die anderen eine Fassung mit `nichtZuhause` (D6: der Branch wurde neu
      // angelegt, und der Waechter kannte die id schon vorher), WIRKT ein Halt oder eine Lage fuer sie nicht (vonPasst sagt nein) —
      // auch wenn es DIESELBE Fassung ist wie die eigene. Vorher setzte nur `a.gilt !== gilt` diese Zeile: wer seinen
      // zurueckgezogenen Halt byte-gleich auf seinem neu angelegten Branch wieder hinlegte, sah „Wirkt jetzt: ja" und nichts sonst,
      // waehrend `naechste` der anderen den Bump freigab (still ueberstimmt). Jetzt: `wirktNicht`, mit Grund und dem Weg.
      if (a.gilt && a.nichtZuhause && (gilt.e.art === 'halt' || gilt.e.art === 'lage')) aus.giltAndere.set(id, { quelle: a.gilt !== gilt ? [...a.gilt.quellen].filter(q => q !== 'Arbeitsbaum')[0] || null : null, grund: a.nichtZuhause + ' wurde neu angelegt, nachdem er verschwunden war, und der Waechter kannte diesen Eintrag schon vorher (gesichert oder zurueckgezogen) — dort ist er nicht der des Schreibers', neuAngelegt: a.nichtZuhause, wirktNicht: true });
      // `neuAngelegt` (D2): der Grund ist ein neu angelegter Branch — das Werkzeug gibt dann den passenden Rat (nicht „umziehen").
      else if (a.gilt && a.gilt !== gilt) aus.giltAndere.set(id, { quelle: [...a.gilt.quellen].filter(q => q !== 'Arbeitsbaum')[0] || null, grund: a.hinweis || null, neuAngelegt: a.neuAngelegt || null });
      else if (!a.gilt && !a.keine) aus.giltAndere.set(id, { quelle: null, grund: a.grund });
    }
    Object.defineProperty(gilt.e, '_quellen', { value: gilt.quellen, enumerable: false });
    // D2/D6 fuer vonPasst: die gesicherte Fassung VERTRITT den Schreiber auf seinem neu angelegten Branch; eine ungesicherte dort
    // ist NICHT die seine (`von` passt dann nicht, auch wenn der Name stimmt).
    if (w.vertreten) Object.defineProperty(gilt.e, '_zuhauseVertreten', { value: w.vertreten, enumerable: false, configurable: true });
    if (w.nichtZuhause) Object.defineProperty(gilt.e, '_nichtZuhause', { value: w.nichtZuhause, enumerable: false, configurable: true });
    aus.gilt.set(id, gilt);
    aus.eintraege.push(gilt.e);
  }
  // Gegenpruefung 5, Skeptiker (R5b-waechter-4, D7): ein strittiger Eintrag, von dem hier KEINE Fassung zu lesen ist (alle Branches
  // weg — der Waechter haelt sie nur unter fassungen/, die kein Leser liest), fiel vorher still weg: `holen` zeigte nichts, und
  // ein strittiger Bump-Halt liess `naechste` mit 0 enden. Er steht jetzt in `strittig`, mit `arten` und den Fristen aus dem
  // Verzeichnis (`nurSicherung`, `sicherung`: je Fassung art und bis, undefined = altes Format). Strittig endet nur mit einer
  // Fassung auf main, einem Grabstein fuer die ganze id auf main oder dem Ablauf (Lage/Halt mit bekanntem bis vorbei, D5). Nicht
  // fuer den Waechter (opts.verzeichnis): er rechnet „dasselbe `von`" ueber seine eigenen Fassungen.
  // Gegenpruefung 5b, Skeptiker (R5c-Le4, F5): D7 hing am LESBAREN Verzeichnis. War es nicht gelesen (Teilabruf: sein Blob fehlt;
  // ebenso ungueltig oder fehlend, waehrend zz-sicherung besteht), fiel ein strittiger Bump-Halt, der nur in der Sicherung liegt,
  // weiter still weg: `naechste --nur-lokal` Exit 0, A8 rechenbar mit 0 Treffern (gemessen, Skeptiker a7). Dann liest der Leser
  // die (kleinen) Fassungen unter fassungen/<id>/ selbst — `von`, `art`, `bis` aus ihrem Inhalt — und rechnet dieselbe Regel.
  // Was er auch so nicht lesen kann (der Baum von fassungen/ oder ein Blob fehlt), steht in `sicherungUngelesen` (Form wie
  // `fehlend`): `naechste` sagt „nicht rechenbar", A8 „nicht pruefbar" (haltUngewiss, haltsDiesesStands) — nie still weg. Eine
  // bewahrte Fassung erkennt nur das Verzeichnis: ohne es zaehlt jede (die vorsichtige Richtung).
  aus.sicherungUngelesen = [];
  if (opts.verzeichnis === undefined) {
    const t = opts.jetzt == null ? Date.now() : opts.jetzt, jeIdS = new Map(), ungelesenJeId = new Map();
    if (verz && verz.fassungInfo instanceof Map) {
      for (const [bl, x] of verz.fassungInfo) { if (x.bewahrt) continue; if (!jeIdS.has(x.id)) jeIdS.set(x.id, []); jeIdS.get(x.id).push(Object.assign({ blob: bl }, x)); }
    } else if (!verz && opts.alleRefs && aus.gitDa && (verzStatus === 'unlesbar' || verzStatus === 'ungueltig' || verzStatus === 'ohne')) {
      const alle = sicherungAlle();
      if (alle == null) aus.sicherungUngelesen.push({ quelle: REMOTE + '/' + SICHERUNG_ZWEIG, pfad: FASSUNGEN + '/', blob: null, baum: true, sicherung: true });
      else {
        const offenIds = [...alle.keys()].filter(id => !fass.has(id) && !grab.has(id) && !fehltJeId.has(id));
        const inh = blobsLesen(wurzel, [...new Set(offenIds.flatMap(id => [...alle.get(id)]))]);
        for (const id of offenIds) for (const bl of alle.get(id)) {
          const buf = inh.get(bl);
          // Nicht im lokalen Objektspeicher: unbekannt (es sei denn, ein Grabstein hat genau diese Fassung entfernt — sie kann nie gelten).
          if (!buf) {
            if (grabBlob.has(bl)) continue;
            if (!ungelesenJeId.has(id)) ungelesenJeId.set(id, []);
            ungelesenJeId.get(id).push({ quelle: REMOTE + '/' + SICHERUNG_ZWEIG, pfad: FASSUNGEN + '/' + id + '/' + bl + '.json', blob: bl, sicherung: true });
            continue;
          }
          // Gelesen, aber kein Eintrag dieser id (kein JSON, andere id, kein `von`): keine Fassung — wie eine unlesbare Datei auf einem
          // Branch. Der Waechter legt so etwas nicht ab; es kann nur von Hand in zz-sicherung kommen.
          let y = null; try { y = JSON.parse(buf.toString('utf8')); } catch (_) {}
          if (!y || typeof y !== 'object' || Array.isArray(y) || y.id !== id || typeof y.von !== 'string') continue;
          const tb = typeof y.bis === 'string' ? Date.parse(y.bis) : NaN;
          if (!jeIdS.has(id)) jeIdS.set(id, []);
          jeIdS.get(id).push({ blob: bl, id, von: y.von, art: typeof y.art === 'string' ? y.art : undefined, bis: y.bis === undefined ? (y.art === 'lage' || y.art === 'halt' ? undefined : null) : (isNaN(tb) ? undefined : tb) });
        }
        for (const [id, xs] of ungelesenJeId) { if (!jeIdS.has(id)) aus.sicherungUngelesen.push(...xs); }
      }
    }
    const zeitlich = (x) => x.art === 'lage' || x.art === 'halt';
    for (const [id, xs] of jeIdS) {
      if (fass.has(id) || grab.has(id) || fehltJeId.has(id)) continue;
      const ungelesen = ungelesenJeId.get(id) || [];
      if (!ungelesen.length && xs.every(x => grabBlob.has(x.blob))) continue;   // jede Fassung per Grabstein entfernt: nichts bleibt, das gelten koennte
      const vons = new Set(xs.map(x => x.von).concat([...(entferntVon.get(id) || [])]));
      // Mit ungelesenen Fassungen ist ein einziges `von` keine Entwarnung: sie koennten ein anderes tragen — nicht rechenbar.
      if (vons.size < 2) { if (ungelesen.length) aus.sicherungUngelesen.push(...ungelesen); continue; }
      // Abgelaufen ist nur, was bekannt abgelaufen ist (art lage/halt, bis bekannt und vorbei — ohne Frist wirkt keiner).
      if (!ungelesen.length && xs.every(x => zeitlich(x) && (x.bis === null || (typeof x.bis === 'number' && x.bis <= t)))) continue;
      aus.strittig.push({ id, quellen: [REMOTE + '/' + SICHERUNG_ZWEIG], nurSicherung: true,
        grund: 'nur in der Sicherung (' + REMOTE + '/' + SICHERUNG_ZWEIG + ', unter ' + path.posix.basename(FASSUNGEN) + '/), nicht entscheidbar: Fassungen mit verschiedenem „von" (' + [...vons].join(', ') + '), auf keinem Branch mehr zu lesen' + (verz ? '' : ' (das Verzeichnis des Waechters ist hier nicht gelesen — gelesen aus den Fassungen selbst' + (ungelesen.length ? ', ' + ungelesen.length + ' davon nicht im lokalen Objektspeicher' : '') + ')'),
        arten: [...new Set(xs.map(x => x.art).filter(a => typeof a === 'string'))], ziele: [], sicherung: xs.map(x => ({ blob: x.blob, von: x.von, art: x.art, bis: x.bis })).concat(ungelesen.map(x => ({ blob: x.blob, von: undefined, art: undefined, bis: undefined }))) });
    }
  }
  // Wann kam eine Lage oder ein Halt auf dem Branch ihres SCHREIBERS an? (Gegenpruefung 2–5) Zwei Grenzen:
  //   rueckGrenze — frueher kann der ANSPRUCH (anspruchKennung) nicht dort gewesen sein. Ein Zeitstempel weit davor ist
  //     rueckdatiert (er „stahl" sonst eine Uebernahme: die aelteste gilt).
  //   vorGrenze — spaetestens da war DIESE Fassung dort. Ein Zeitstempel weit danach ist vordatiert.
  // rueckGrenze ist das MAXIMUM aller rechenbaren Grenzen (Gegenpruefung 5, E4 — die strengere gewinnt):
  //   · aus dem VERZEICHNIS des Waechters nur die HEIM-Zeiten (heimNichtVor: der Lauf vor der ersten Sichtung dieses Anspruchs
  //     AUF dem Branch seines Schreibers). Vorher galt jede Sichtung, gleich wo — ein Vorrat auf einem Neben-Branch machte
  //     dieselben Bytes Stunden spaeter beim Schreiber „frueh angekommen" (R5-fassungen-4). Kennt das Verzeichnis den Anspruch
  //     zu Hause nicht, war er bei seinem `stand` nicht da. Altes Format (ohne heimErst): nichtVor wie bisher.
  //   · aus git dazu, wo rechenbar UND das Verzeichnis den Anspruch zu Hause NICHT kennt (kein Eintrag oder alle heimErst null:
  //     dann ist seine Grenze der `stand`; heimNichtVor unbekannt; altes Format): die Autor-Zeit des fruehesten Commits auf dem
  //     Branch des Schreibers, der eine Fassung desselben Anspruchs traegt (volle Geschichte, Merges gegen den ersten Elternteil,
  //     -z). Vorher uebersprang ein Verzeichnis git ganz — und sein `stand` aendert sich nur mit dem Inhalt: auf einem ruhigen
  //     Brett nahm eine normal committete, um 9 h rueckdatierte Lage ein Ziel, die OHNE Verzeichnis rueckdatiert hiess
  //     (R5-pruefstand-0, R5-waechter-5, R5-fassungen-9). Kennt es heimNichtVor, gilt das ALLEIN (Gegenpruefung 5, Skeptiker
  //     R5b-fassungen-4, D4): mit „git IMMER dazu" machte ein ehrlicher Squash des eigenen Branches (`reset --soft` + commit,
  //     derselbe Inhalt) Halt und Lage, die der Waechter laengst zu Hause gesehen hatte, „rueckdatiert" — der Halt fiel weg. Eine
  //     Zeit, die kein Schreiber setzt, wird durch einen spaeteren Commit nicht spaeter: das ist ein Umschreiben, kein Rueckdatieren.
  //   · Der Anspruch eines HALTS ist [id, `von`] (D3): verglichen wird dort das `von` der Verzeichnis-Zeile, nicht ihr vermerkter
  //     Anspruch — ein Verzeichnis aus der Zeit mit `bis` im Halt-Anspruch rechnet so wie ein neues.
  //   · Vertritt die gesicherte Fassung den Schreiber auf seinem NEU ANGELEGTEN Branch (D2), misst nur das Verzeichnis (dort ist
  //     kein Zuhause der Zeiten, E6).
  //   vorGrenze bleibt: erst (Verzeichnis) bzw. die Committer-Zeit des fruehesten Commits mit genau dieser Fassung.
  // Auf origin/main: ein Merge waescht nichts — kennt das Verzeichnis Heim-Zeiten desselben Anspruchs, gelten sie dort auch
  // (R5-fassungen-5: vorher wurde auf main nie gemessen, und eine rueckdatierte Lage wirkte nach dem Merge); sonst wie bisher
  // ungemessen. Im flachen Klon ohne Verzeichnis nicht geprueft (dort traegt jede Datei die Zeit der Branch-Spitze).
  // OFFEN (E5, `_ankunftOffen` mit Grund, `aus.ankunftOffen`): ist zz-sicherung da, aber ihr Verzeichnis nicht gelesen; oder
  // ist keine Grenze rechenbar, weil die Geschichte, aeltere Fassungen (Teilabruf) oder jeder Commit des Anspruchs fehlen.
  // Nie aus einer Teilmenge: fehlt eine aeltere Fassung, koennte sie denselben Anspruch FRUEHER tragen — eine ehrlich
  // berichtigte Lage hiess sonst im blob:none-Klon „rueckdatiert" (R5-lesen-1). Eine offene Lage nimmt nichts, ihre Ziele sind
  // fuer nehme „nicht entscheidbar"; ein offener Halt wirkt (die sichere Richtung).
  aus.ankunftOffen = [];
  if (opts.alleRefs && aus.gitDa) {
    const setze = (e, k, v) => Object.defineProperty(e, k, { value: v, enumerable: false, configurable: true });
    const jeId = new Map();
    if (verz && verz.je instanceof Map) for (const [bl, x] of verz.je) { if (!jeId.has(x.id)) jeId.set(x.id, []); jeId.get(x.id).push(Object.assign({ blob: bl }, x)); }
    const mitHeim = !!verz && (verz.mitHeim != null ? !!verz.mitHeim : [...(verz.je instanceof Map ? verz.je.values() : [])].some(x => x.heimErst !== undefined));
    // Der Anspruch einer gesicherten Fassung aus ihrem INHALT, wo er lokal liegt (zz-sicherung) — sonst der vermerkte. So gilt
    // fuer ein Verzeichnis aus der Zeit vor Gegenpruefung 5 (anderer anspruchKennung) dieselbe Regel wie fuer ein neues.
    const brauche = new Set();
    for (const e of aus.eintraege) if ((e.art === 'halt' || e.art === 'lage') && jeId.has(e.id)) for (const x of jeId.get(e.id)) brauche.add(x.blob);
    const inhVerz = brauche.size ? blobsLesen(wurzel, [...brauche]) : new Map();
    const anspruchVerz = (x) => {
      const buf = inhVerz.get(x.blob);
      if (buf) { let y = null; try { y = JSON.parse(buf.toString('utf8')); } catch (_) {} if (y && typeof y === 'object' && !Array.isArray(y) && !formFehler(y)) return anspruchKennung(y); }
      return x.anspruch;
    };
    for (const e of aus.eintraege) {
      if ((e.art !== 'halt' && e.art !== 'lage') || !e._quellen) continue;
      const q = [...e._quellen], v = aus.gilt.get(e.id), a0 = anspruchKennung(e);
      const gleiche = (jeId.get(e.id) || []).filter(x => e.art === 'halt' ? x.von === e.von : anspruchVerz(x) === a0);
      const heimG = mitHeim ? gleiche.filter(x => x.heimErst != null) : [];
      if (q.some(istMainRef)) {
        if (heimG.length && heimG.every(x => x.heimNichtVor != null)) { setze(e, '_rueckGrenze', Math.min(...heimG.map(x => x.heimNichtVor))); setze(e, '_rueckQuelle', 'heim'); setze(e, '_ankunftWoher', { rueck: 'Waechter', vor: null }); }
        continue;
      }
      const ref = q.find(x => istAutorRef(x, autorZweig(e))) || e._zuhauseVertreten;
      if (!ref) continue;   // nicht auf dem Branch des Schreibers: vonPasst entscheidet — eine Kopie Dritter misst nie
      const pfad = v.pfade.get(ref);
      // Die Grenze des Verzeichnisses. `heimBekannt`: es kennt den Anspruch zu Hause MIT heimNichtVor — dann gilt sie allein (D4).
      let V = null, vor = null, woherV = null, heimBekannt = false;
      if (verz) {
        if (mitHeim) { if (!heimG.length) V = verz.stand; else if (heimG.every(x => x.heimNichtVor != null)) { V = Math.min(...heimG.map(x => x.heimNichtVor)); heimBekannt = true; } }
        else if (!gleiche.length) V = verz.stand;
        else if (gleiche.every(x => x.nichtVor != null)) V = Math.min(...gleiche.map(x => x.nichtVor));
        const je = verz.je instanceof Map ? verz.je.get(v.blob) : null;
        if (je) { vor = je.erst; woherV = 'Waechter'; }
      }
      // Die Grenze aus git — nur auf einem Branch, der fuer diese id ein Zuhause ist (E6), nie im flachen Klon, und nicht, wo das
      // Verzeichnis beide Grenzen schon kennt (D4: dann zaehlt git nicht — auch kein `git log` dafuer).
      let G = null, gitGrund = null;
      if (!flach && istZuhause(e.id, ref) && !(heimBekannt && vor != null)) {
        if (histFehlt) gitGrund = 'die Geschichte der Branches liegt nicht im lokalen Objektspeicher (Teilabruf ohne Baeume)';
        else {
          const h = verlauf(ref);
          if (!h) gitGrund = 'die Geschichte von ' + ref + ' ist nicht lesbar';
          else {
            const liste = (h.get(pfad) || []).filter(x => x.mode === '100644');
            if (vor == null) { const t = liste.filter(x => x.blob === v.blob).map(x => x.ct); if (t.length) { vor = Math.min(...t); woherV = 'git'; } }
            const andere = [...new Set(liste.map(x => x.blob))].filter(bl => bl !== v.blob), inh = blobsLesen(wurzel, andere), gleich = new Set([v.blob]);
            if (inh.fehlt.length) gitGrund = inh.fehlt.length + ' aeltere Fassung(en) auf ' + ref + ' liegen nicht im lokalen Objektspeicher (Teilabruf)';
            else {
              for (const bl of andere) { const buf = inh.get(bl); if (!buf) continue; let y = null; try { y = JSON.parse(buf.toString('utf8')); } catch (_) {} if (y && typeof y === 'object' && !Array.isArray(y) && !formFehler(y) && y.art === e.art && anspruchKennung(y) === a0) gleich.add(bl); }
              const t = liste.filter(x => gleich.has(x.blob)).map(x => x.at);
              if (t.length) G = Math.min(...t); else gitGrund = 'kein Commit mit diesem Anspruch in der Geschichte von ' + ref + ' gefunden';
            }
          }
        }
      }
      let rueck = null, woherR = null, offen = null;
      if (verzUnlesbar) offen = aus.verzeichnisGrund || 'das Verzeichnis des Waechters ist hier nicht gelesen';
      else if (V == null && G == null && gitGrund) offen = gitGrund;
      else if (V != null || G != null) { if (!heimBekannt && G != null && (V == null || G > V)) { rueck = G; woherR = 'git'; } else { rueck = V; woherR = 'Waechter'; } }
      if (rueck != null) setze(e, '_rueckGrenze', rueck);
      // Woher die geltende Rueck-Grenze stammt (Gegenpruefung 5b, Skeptiker R5c-I1, F6): 'heim' (das Verzeichnis kennt den Anspruch
      // ZU HAUSE), 'alt' (altes Verzeichnis-Format, nichtVor), 'git' (git war strenger), 'stand+git' (es kennt ihn zu Hause NICHT —
      // sein Stand, und git rechnete mit) und 'stand' (nur sein Stand: „bei diesem Lauf war er noch nicht da", OHNE git — flacher
      // Klon, aeltere Fassung im Teilabruf nicht da, keine Geschichte). D4: kennt das Verzeichnis den Anspruch zu Hause nicht, soll
      // git mitzaehlen; ein 'stand' nennt A10 deshalb „nicht pruefbar" statt still ok. Und vordatiert misst nur, wer `_vorGrenze` hat.
      if (rueck != null) setze(e, '_rueckQuelle', woherR === 'git' ? 'git' : heimBekannt ? 'heim' : (mitHeim ? !heimG.length : !gleiche.length) ? (G != null ? 'stand+git' : 'stand') : 'alt');
      if (vor != null) setze(e, '_vorGrenze', vor);
      setze(e, '_ankunftWoher', { rueck: woherR, vor: woherV });
      if (offen) { setze(e, '_ankunftOffen', offen); aus.ankunftOffen.push({ id: e.id, ref, art: e.art, grund: offen }); }
    }
  }
  aus.eintraege.sort((a, b) => ordnung(a).localeCompare(ordnung(b)));
  return aus;
}
// Wer arbeitet parallel? Gerechnet aus den Branch-Spitzen — niemand muss dafuer
// etwas schreiben (die geplanten Sitzungen, die am 10.09.2026 denselben Fehler
// viermal behoben, haetten keinen Anspruch angelegt). `jetzt` in ms; nur Anzeige.
// Wer bin ich? Der LOKALE Branch (`branch --show-current` — `rev-parse --abbrev-ref` machte bei einem
// gleichnamigen Tag „heads/<name>" daraus); mitten in einem Rebase (HEAD losgeloest) der Branch, der gerade
// umgebaut wird — er steht in rebase-merge/head-name bzw. rebase-apply/head-name (Gegenpruefung 5: vorher hiess der
// eigene Name dort „nicht dein Branch", mit dem Rat `git switch`, den git mitten im Rebase verweigert). Der Upstream
// wird nur GENANNT, wenn er anders heisst: nach `git branch -m` landen die Pushes auf dem alten Namen, und dort waere
// eine Lage mit dem neuen Namen fuer alle anderen UNWIRKSAM (Gegenpruefung 2). Ihn zur Identitaet zu machen, waere
// falsch: `git checkout -b x origin/main` setzt main als Upstream — und `checkout -b x origin/<fremd>` den fremden.
// Ein Upstream auf einem ANDEREN Remote (branch.<b>.remote ≠ origin) ist nicht origin/<name>: er zaehlt hier nicht.
//
// `alteNamen`: die Namen, die dieser Branch vor einem `git branch -m` trug (Reflog: „Branch: renamed refs/heads/<alt>
// to …"), soweit sein Eigentum POSITIV belegt ist (Gegenpruefung 5) — origin/<alt> besteht, und die AELTESTE Zeile
// seines Reflogs hat diesen Klon den Ref ANLEGEN sehen (alter Wert 0…0) durch den eigenen Push („update by push") oder
// ohne Text (so legt die Claude-Umgebung den Branch ihrer Sitzung an — gemessen 18.11.2026: einer von 143 Remote-Refs,
// genau der Branch der Sitzung; kein Porzellan-Befehl schreibt einen leeren Text). Gemessen, was die Wege zu einem
// FREMDEN Branch dort hinterlassen: `git clone` schreibt fuer refs/remotes gar kein Reflog, `fetch` „fetch …: storing
// head", und ein Push auf einen Branch, den der Klon ungeloggt kannte, beginnt mit dem alten Wert ≠ 0. Vorher (Runde 4)
// zaehlte nur das Reflog des LOKALEN Branches: `fetch origin x:x`, `checkout -b x` + `pull`, `checkout -b x FETCH_HEAD`,
// `clone -b x` und ein zweites Remote machten einen fremden Branch nach dem Umbenennen zum eigenen (sein Bump-Halt
// sperrte nicht mehr, und das Werkzeug schrieb in seinem Namen). Dazu bleibt die Gegenprobe der Runde 4: entstand der
// ERSTE Name der Kette aus einem Remote-Branch gleichen Namens (`branch: Created from <remote>/<name>`, `clone:`,
// `fetch`), ist er fremd. Und ALLE belegten alten Namen zaehlen, nicht nur der jetzige Upstream: wer dem Rat folgte und
// nach origin/<neu> pushte, verlor sonst seinen alten Namen — der Deckel zaehlte 3 + N, der eigene Bump-Halt sperrte
// die Sitzung selbst, und alte Uebernahmen liessen sich nicht mehr freigeben (Gegenpruefung 5).
// Grenzen: nach einem frischen Klon (eine spaetere Sitzung) gibt es fuer refs/remotes kein Reflog — ein alter Name ist
// dort nicht mehr belegt und fremd; ebenso nach `fetch --prune` (der Ref samt Reflog ist weg) und nach Ablauf des
// Reflogs (gc.reflogExpire). Ein von Hand geschriebenes Reflog (`update-ref`) oder ein Force-Push auf einen nie
// geholten fremden Branch belegt Eigentum, das es nicht gibt — ausserhalb dessen, was das Brett misst.
// `umbenannt`: der Upstream ist einer dieser belegten alten Namen.
const NULL_KENNUNG = /^0+$/;
// Die AELTESTE Zeile des Reflogs eines Refs, roh gelesen (das Porzellan nennt den alten Wert eines Eintrags nicht):
// { alt, neu, gs } oder null (kein Reflog — etwa nach `git clone` —, oder ein Speicher ohne Dateien wie reftable).
function reflogAnfang(wurzel, ref) {
  const p = (git(wurzel, ['rev-parse', '--git-path', 'logs/' + ref]) || '').trim();
  if (!p) return null;
  let t = null;
  try { t = fs.readFileSync(path.resolve(wurzel, p), 'utf8'); } catch (_) { return null; }
  const m = (t.split('\n')[0] || '').match(/^([0-9a-f]{40,64}) ([0-9a-f]{40,64}) [^\t]*(?:\t(.*))?$/);
  return m ? { alt: m[1], neu: m[2], gs: m[3] || '' } : null;
}
// Mitten in einem Rebase: der umgebaute Branch (oder null, auch bei „detached HEAD") und ob ueberhaupt einer laeuft.
function rebaseKopf(wurzel) {
  let laeuft = false;
  for (const d of ['rebase-merge', 'rebase-apply']) {
    const p = (git(wurzel, ['rev-parse', '--git-path', d]) || '').trim();
    if (!p || !fs.existsSync(path.resolve(wurzel, p))) continue;
    laeuft = true;
    let t = null;
    try { t = fs.readFileSync(path.resolve(wurzel, p, 'head-name'), 'utf8').trim(); } catch (_) { continue; }
    const m = t.match(/^refs\/heads\/(\S+)$/);
    if (m && git(wurzel, ['rev-parse', '--verify', '--quiet', 'refs/heads/' + m[1]]) != null) return { name: m[1], laeuft };
  }
  return { name: null, laeuft };
}
export function eigenerZweig(wurzel) {
  let lokal = (git(wurzel, ['branch', '--show-current']) || '').trim(), rebase = false;
  if (!lokal) { const r = rebaseKopf(wurzel); if (r.name) { lokal = r.name; rebase = true; } else if (r.laeuft) rebase = 'losgeloest'; }
  if (!lokal) return { lokal: null, name: null, upstream: null, umbenannt: false, alteNamen: [], rebase };
  const merge = (git(wurzel, ['config', '--get', 'branch.' + lokal + '.merge']) || '').trim();
  const remote = (git(wurzel, ['config', '--get', 'branch.' + lokal + '.remote']) || '').trim();
  const up0 = /^refs\/heads\/./.test(merge) ? merge.slice('refs/heads/'.length) : null;
  const up = up0 && remote === REMOTE ? up0 : null;
  const upstream = up && up !== lokal && up !== 'main' && up !== 'master' ? up : null;
  // Die Kette der Namen aus dem Reflog des lokalen Branches (neueste Zeile zuerst; ein Umbenennen nimmt das Reflog mit).
  const log = (git(wurzel, ['reflog', 'show', '--format=%gs', 'refs/heads/' + lokal]) || '').split('\n').filter(Boolean);
  // Branch-Namen haben keine Leerzeichen; verglichen wird der Name GENAU (git unterscheidet Gross und klein).
  const umbenannt0 = log.map(z => z.match(/^branch: renamed refs\/heads\/(\S+) to refs\/heads\/\S+$/i)).filter(Boolean).map(m => m[1]);
  const erster = umbenannt0.length ? umbenannt0[umbenannt0.length - 1] : lokal;
  const anfang = log[log.length - 1] || '';
  const mc = anfang.match(/^branch: created from (?:refs\/remotes\/)?(\S+)$/i);
  const ersterGeholt = /^(clone|fetch|pull)\b/i.test(anfang) || /^branch: created from FETCH_HEAD$/i.test(anfang) || (!!mc && mc[1].replace(/^[^/]+\//, '') === erster && mc[1] !== erster);
  const belegt = (alt) => {
    if (alt === lokal || alt === 'main' || alt === 'master' || (alt === erster && ersterGeholt)) return false;
    const a = reflogAnfang(wurzel, 'refs/remotes/' + REMOTE + '/' + alt);
    return !!a && NULL_KENNUNG.test(a.alt) && (a.gs === 'update by push' || a.gs === '') && git(wurzel, ['rev-parse', '--verify', '--quiet', 'refs/remotes/' + REMOTE + '/' + alt]) != null;
  };
  const alteNamen = [...new Set(umbenannt0)].filter(belegt);
  // Der jetzige Upstream zuerst (auf ihn gehen die Pushes).
  if (upstream && alteNamen.indexOf(upstream) > 0) { alteNamen.splice(alteNamen.indexOf(upstream), 1); alteNamen.unshift(upstream); }
  const umbenannt = !!upstream && alteNamen.indexOf(upstream) >= 0;
  return { lokal, name: lokal, upstream, umbenannt, alteNamen, rebase, hatUpstream: !!up0, upstreamName: up, upstreamRemote: up0 ? remote || null : null, umbenanntAus: [...new Set(umbenannt0)] };
}
// Alle Namen, die „ich" sind (ohne --von): der lokale Branch und die belegten alten Namen (eigenerZweig.alteNamen),
// unter denen er auf origin liegt — der jetzige Upstream zuerst. Der lokale Name steht immer vorn (Aufrufer nehmen [0]).
export function eigeneNamen(ez) {
  const n = [];
  if (ez && ez.name && ez.name !== 'main' && ez.name !== 'master') n.push('sitzung/' + ez.name);
  const alte = ez && Array.isArray(ez.alteNamen) ? ez.alteNamen : (ez && ez.upstream && ez.umbenannt ? [ez.upstream] : []);
  for (const a of alte) if (a && a !== 'main' && a !== 'master' && n.indexOf('sitzung/' + a) < 0) n.push('sitzung/' + a);
  return n;
}
// Wer ist „ich" im PR? GITHUB_HEAD_REF waehlt im PR eines FORKS der Absender frei — mit dem Namen eines fremden
// Branches galten dessen Halts als eigene (A8 schwieg) und eine Lage in seinem Namen als eigene (A10 gruen,
// Gegenpruefung 4). Er gilt nur, wenn der Kopf des PR (HEAD^2 des Merge-Commits, sonst HEAD) die SPITZE von
// origin/<GITHUB_HEAD_REF> ist: dann IST es dieser Branch des Repos. Vorher genuegte ein Vorfahr der Spitze — ein Fork-PR
// auf einem alten Commit von claude/k galt als claude/k, und ein Halt, den claude/k laengst zurueckgezogen hatte, war in
// A10 gruen und haette gemergt wieder gewirkt (Gegenpruefung 5). Folgt waehrend des Laufs ein Push auf den Branch, ist
// niemand „ich" (strenger, nicht lockerer) — der naechste Lauf rechnet wieder.
export function prKopf(wurzel, umgebung) {
  const h = String((umgebung || {}).GITHUB_HEAD_REF || '');
  if (!h) return null;
  const ref = 'refs/remotes/' + REMOTE + '/' + h;
  const spitze = (git(wurzel, ['rev-parse', '--verify', '--quiet', ref + '^{commit}']) || '').trim();
  if (!spitze) return null;
  const kopf = git(wurzel, ['rev-parse', '--verify', '--quiet', 'HEAD^2']) != null ? 'HEAD^2' : 'HEAD';
  // Ein Kopf ohne eigenen Commit (er liegt schon auf main) laege auf JEDEM Branch, der von main abzweigt — er belegt nichts.
  const main = 'refs/remotes/' + REMOTE + '/main';
  if (git(wurzel, ['rev-parse', '--verify', '--quiet', main]) != null && git(wurzel, ['merge-base', '--is-ancestor', kopf, main]) != null) return null;
  return (git(wurzel, ['rev-parse', '--verify', '--quiet', kopf + '^{commit}']) || '').trim() === spitze ? h : null;
}
export function frischeZweige(wurzel, jetzt, tage) {
  const roh = git(wurzel, ['for-each-ref', '--sort=-committerdate', '--format=%(refname)\t%(committerdate:unix)\t%(subject)', 'refs/remotes']);
  if (roh == null) return null;
  // Eigen ist der lokale Name (auf jedem Remote) und jeder belegte alte Name auf origin (eigeneNamen) — vorher nur der lokale:
  // nach einem `git branch -m` stand der eigene alte Branch als fremde Parallelarbeit da und seine Version als VERGEBEN
  // (Gegenpruefung 5). Eine Wahl je Leser: frischeZweige, vergebeneMarken und inArbeitAusGit lesen von hier.
  const ez = eigenerZweig(wurzel), eigen = new Set([ez.lokal].filter(Boolean));
  const eigenAlt = new Set(eigeneNamen(ez).map(n => n.replace(/^sitzung\//, '')).filter(n => n !== ez.lokal).map(n => REMOTE + '/' + n));
  const aus = [];
  aus.zukunft = [];   // Committer-Zeit in der Zukunft: sonst bliebe der Branch fuer immer „frisch“
  for (const z of roh.split('\n')) {
    const [voll, t, ...rest] = z.split('\t');
    const ref = String(voll || '').replace(/^refs\/remotes\//, '');
    if (!ref || /\/HEAD$/.test(ref) || istMainRef(ref) || istSicherungsRef(ref) || eigen.has(ref.replace(/^[^/]+\//, '')) || eigenAlt.has(ref)) continue;
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
  // Jeder Blick in Baum und Blob OHNE Nachladen (Gegenpruefung 4, R4-lesen-1): ein Baum, den der Teilabruf nicht holte,
  // heisst hier „nicht lesbar" (null) — vorher machte `(ls || '')` daraus „keine Dateien", und der Ref fiel still aus
  // der Rechnung (Klon mit tree:0: `naechste` vergab die Nummer eines fremden Branches ein zweites Mal).
  const kennung = new Map();   // Ref → Map(Datei → Blob-Kennung) oder null; ls-tree braucht nur Baeume, nie den Blob
  const kennungen = (ref) => {
    if (!kennung.has(ref)) {
      const roh = git(wurzel, ['ls-tree', '-r', '-z', ref, '--'].concat(MARKEN_DATEIEN), { ohneNachladen: true });
      let m = null;
      if (roh != null) { m = new Map(); for (const z of roh.split('\0')) { const t = z.match(/^\d+ blob ([0-9a-f]+)\t(.+)$/); if (t) m.set(t[2], t[1]); } }
      kennung.set(ref, m);
    }
    return kennung.get(ref);
  };
  const blob = (ref, datei) => git(wurzel, ['show', ref + ':' + datei], { ohneNachladen: true });   // erst NACH dem Blick unten: dann liegt alles lokal
  const zweige = frischeZweige(wurzel, jetzt, tage) || [];
  // Ein Branch mit Commit-Zeit in der Zukunft ist nicht „frisch" (sonst bliebe er es fuer immer) — seine
  // Nummer ist aber vergeben: vorher empfahl `naechste` sie still ein zweites Mal (Gegenpruefung 2).
  const mitZukunft = zweige.concat((zweige.zukunft || []).map(x => ({ ref: x.ref, zukunft: true })));
  {
    // HEAD nur, wenn es einen Commit gibt (ein ungeborener HEAD hat keine Marken — das ist kein fehlender Baum).
    const kopfDa = git(wurzel, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}'], { ohneNachladen: true }) != null;
    const refsAlle = [MAIN].concat(kopfDa ? ['HEAD'] : [], mitZukunft.map(z => 'refs/remotes/' + z.ref));
    const kurzRef = (r) => r.replace(/^refs\/remotes\//, '');
    // Erst die Wurzelbaeume (laedt auch auf einem git ohne GIT_NO_LAZY_FETCH nie nach), dann ls-tree ohne Nachladen.
    const ohneBaum = fehlendeWurzelBaeume(wurzel, refsAlle);
    const unlesbar = refsAlle.filter(r => (ohneBaum ? ohneBaum.has(r) : false) || kennungen(r) == null);
    if (!ohneBaum || unlesbar.length) {
      const was = !ohneBaum ? ['(git kennt einen der Refs nicht)'] : unlesbar.map(kurzRef);
      return { grund: (ohneBaum ? unlesbar.length : '?') + ' Branch(es), deren Dateibaum nicht im lokalen Objektspeicher liegt (Teilabruf ohne Baeume — gelesen wird ohne Nachladen): ' + was.slice(0, 4).join(', ') + (was.length > 4 ? ' … +' + (was.length - 4) : ''),
        fehlt: was.map(r => r + ':(Baum)'), nachladbar: ohneBaum ? [...new Set(unlesbar.map(r => ohneBaum.get(r)).filter(Boolean))] : [] };
    }
    const refsMit = refsAlle.filter(r => kennungen(r).size);
    const noetig = [];
    for (const ref of refsMit) for (const [datei, oid] of kennungen(ref)) noetig.push({ ref, datei, oid });
    const da = blobsDa(wurzel, noetig.map(x => x.oid), refsMit.map(r => r + '^{tree}'));
    const fehlend = noetig.filter(x => !da.has(x.oid)), fehlt = fehlend.map(x => kurzRef(x.ref) + ':' + x.datei);
    if (fehlt.length) return { grund: fehlt.length + ' Datei(en), die die Rechnung braucht, liegen nicht im lokalen Objektspeicher (Teilabruf — gelesen wird ohne Nachladen): ' + fehlt.slice(0, 4).join(', ') + (fehlt.length > 4 ? ' … +' + (fehlt.length - 4) : ''), fehlt, nachladbar: [...new Set(fehlend.map(x => x.oid))] };
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
  const refTitel = (ref, version) => titelAus(() => blob(ref, 'index.html'), (git(wurzel, ['rev-parse', '--verify', '--quiet', ref + ':index.html'], { ohneNachladen: true }) || '').trim(), () => blob(ref, 'data/releases.v1.js'), version);
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
  const kopfMarken = markenAus(blob('HEAD', 'sw.js'), blob('HEAD', 'STATUS.md'));
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
    // Ohne Kuerzel der Grund, als Satz (Gegenpruefung 5, Skeptiker: `naechste` druckte „STATUS-Kuerzel: (null)"). `naechstesKuerzel`
    // bleibt null — wer es als JSON liest, sieht dieselbe Lage wie bisher und daneben, warum.
    naechstesKuerzelGrund: alleK.length ? null : (blob(MAIN, 'STATUS.md') == null ? 'origin/main traegt hier keine lesbare STATUS.md' : 'in STATUS.md auf origin/main steht kein Eintrag mit Kuerzel (Ueberschrift „JJJJ-MM-TT (xy) …"), und weder ein frischer Branch noch dein Arbeitsbaum traegt eines'),
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
// Die Liste auf origin/main wird OHNE Nachladen gelesen (Gegenpruefung 5, R5-lesen-4): vorher lud `git show` sie im
// Teilabruf still nach — ohne Netz war sie still weg, und ein auf main zurueckgezogener Halt wirkte wieder („Wirkt jetzt:
// ja"), waehrend der volle Klon „Kein Eintrag" sagte. Fehlt sie (Baum oder Blob nicht im lokalen Objektspeicher), steht sie in
// `fehlt` ({quelle, pfad, blob, baum?, grabsteine: true}) — brettLesen fuehrt sie unter `fehlend`, und wer rechnet, sagt
// „nicht entscheidbar" statt „nie zurueckgezogen". Gibt es sie auf main nicht, fehlt nichts.
export function grabsteine(wurzel, mitMain) {
  const ids = new Set(), blobs = new Set(), fehler = [], fehlt = [];
  const quellen = [];
  try { quellen.push(fs.readFileSync(path.join(wurzel, GRABSTEINE), 'utf8')); } catch (_) {}
  if (mitMain) {
    const M = 'refs/remotes/' + REMOTE + '/main', NL = { ohneNachladen: true }, q = REMOTE + '/main';
    if (git(wurzel, ['rev-parse', '--verify', '--quiet', M], NL) != null) {
      const ls = git(wurzel, ['ls-tree', '-z', M, '--', GRABSTEINE], NL), m = ls == null ? null : ls.match(/^\d+ blob ([0-9a-f]+)\t/);
      if (ls == null) fehlt.push({ quelle: q, pfad: GRABSTEINE, blob: null, baum: true, grabsteine: true });
      else if (m) { const t = blobsLesen(wurzel, [m[1]]).get(m[1]); if (t) quellen.push(t.toString('utf8')); else fehlt.push({ quelle: q, pfad: GRABSTEINE, blob: m[1], grabsteine: true }); }
    }
  }
  for (const roh of quellen) { const g = grabsteinePruefen(roh); g.ids.forEach(i => ids.add(i)); g.blobs.forEach(b => blobs.add(b)); fehler.push(...g.fehler); }
  return { ids, blobs, fehler, fehlt };
}
// Was hat ein SCHREIBER auf seinem eigenen Branch zurueckgezogen (Grabstein dort, vor dem Merge — README
// Waechter 1)? Entfernt wird erst mit dem Grabstein auf main; bis dahin ist sein Verschwinden kein Verlust
// (vorher: ALARM, und `ernten` holte ihn zurueck — Gegenpruefung 3). Nur der Branch, den `von` nennt:
// ein Grabstein auf einem FREMDEN Branch zieht nichts zurueck.
// Je FASSUNG gerechnet (Gegenpruefung 5): ein Grabstein (id) auf origin/<b> zieht nur die Fassungen dieser id zurueck,
// deren EIGENES `von` sitzung/<b> ist. Vorher galt je id das `von` der zuerst gelesenen Fassung — bei einem strittigen
// Eintrag entschied die Sortierung der Blobs (die der Faelscher mit Leerraum waehlt), wessen Grabstein galt: der echte
// Rueckzug blieb ohne Wirkung (ALARM), und der Grabstein der Faelschung unterdrueckte den ALARM fuer das Original.
// Und ein NEU ANGELEGTER Branch (verschwand und kam wieder, Verzeichnis des Waechters) ist fuer eine id, die schon vorher
// gesichert war, nicht das Zuhause ihres Schreibers: sein Grabstein zieht sie nicht zurueck (Gegenpruefung 5 — ein Dritter
// legte claude/w neu an, nur mit einem Grabstein, und der naechste Lauf nahm die einzige Kopie aus der Sicherung).
//   opts.zuHause(ref, id, von) — wer entscheidet, ob ein Ref fuer diese id zu Hause ist (der Waechter: sein frisches Wissen)
//   opts.verzeichnis           — sonst dieses Verzeichnis (verzeichnisPruefen); fehlt es, liest die Funktion das aus zz-sicherung
// Ergebnis: Map id → ref (eine Fassung dieser id ist zurueckgezogen), .blobs (blob → ref), .jeVon (id → Map von → ref).
export function zurueckgezogenVomSchreiber(wurzel, eintraegeOderVon, opts) {
  opts = opts || {};
  const refs = (git(wurzel, ['for-each-ref', '--format=%(refname)', 'refs/remotes/' + REMOTE + '/']) || '').split('\n').filter(x => x && !/\/HEAD$/.test(x));
  const aus = new Map();   // id → ref
  aus.blobs = new Map();
  aus.jeVon = new Map();
  if (!refs.length) return aus;
  // Erst gelesen, wenn ein Grabstein auf dem Branch eines Schreibers liegt (kein Git-Aufruf, wo nichts zu entscheiden ist).
  let heimFuer = typeof opts.zuHause === 'function' ? opts.zuHause : null;
  const zuHause = (ref, id, von) => {
    if (!heimFuer) {
      const verz = opts.verzeichnis !== undefined ? opts.verzeichnis : verzeichnisLesen(wurzel);
      const na = new Map(verz && verz.neuAngelegt instanceof Map ? verz.neuAngelegt : []);
      // Wie in brettLesen (D6): ein Ref, den das Verzeichnis als verschwunden fuehrt und der wieder besteht, ist neu angelegt.
      if (verz && verz.weg instanceof Map) for (const [r, t] of verz.weg) if (refs.indexOf('refs/remotes/' + r) >= 0 && !na.has(r)) na.set(r, t);
      const idErst = new Map();
      if (verz && verz.je instanceof Map) for (const x of verz.je.values()) if (x && x.id && typeof x.erst === 'number') idErst.set(x.id, Math.min(idErst.has(x.id) ? idErst.get(x.id) : Infinity, x.erst));
      // Auch ein gemerkter Rueckzug (Skeptiker R5b-waechter-3, D6 — wie beim Waechter; ohne Zeit zaehlt er als „vorher"): vorher
      // kannte die Leser-Vorgabe nur gesicherte Fassungen, und ein zurueckgezogener Eintrag war auf dem neu angelegten Branch wieder
      // „zu Hause".
      if (verz && Array.isArray(verz.rueckzuege)) for (const z of verz.rueckzuege) if (z && z.id) idErst.set(z.id, Math.min(idErst.has(z.id) ? idErst.get(z.id) : Infinity, typeof z.seit === 'number' ? z.seit : -Infinity));
      // Eine id, die das Verzeichnis nicht kennt, war vor dem Neuanlegen nicht gesichert — dort ist sie zu Hause.
      heimFuer = (r, i) => !na.has(r) || !idErst.has(i) || idErst.get(i) >= na.get(r);
    }
    return heimFuer(ref, id, von);
  };
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
    jeRef.set(ref, g);
    i = nl + 1 + n + 1;
  }
  const vonsId = new Map(), vonBlob = new Map();   // id → Set(von) — JEDES `von` dieser id, nicht nur das erste
  for (const x of eintraegeOderVon || []) {
    if (!x) continue;
    const von = x.von || (x.e && x.e.von), blob = x.blob || x._blob || null;
    if (x.id && typeof von === 'string') { if (!vonsId.has(x.id)) vonsId.set(x.id, new Set()); vonsId.get(x.id).add(von); }
    if (blob && !vonBlob.has(blob)) vonBlob.set(blob, { id: x.id, von });
  }
  // Auch ein Grabstein je FASSUNG (mit blob) auf dem eigenen Branch zieht zurueck — vorher las diese Funktion nur die ids,
  // und ein solcher Rueckzug ergab ALARM „nur noch in der Sicherung" (Gegenpruefung 4). `aus.blobs`: blob → ref.
  for (const [ref, g] of jeRef) {
    for (const id of g.ids) for (const v of vonsId.get(id) || []) {
      if (!istAutorRef(ref, autorZweig({ von: v })) || !zuHause(ref, id, v)) continue;
      if (!aus.jeVon.has(id)) aus.jeVon.set(id, new Map());
      aus.jeVon.get(id).set(v, ref);
      if (!aus.has(id)) aus.set(id, ref);
    }
    for (const bl of g.blobs) { const x = vonBlob.get(bl); if (x && x.von && istAutorRef(ref, autorZweig({ von: x.von })) && zuHause(ref, x.id, x.von)) aus.blobs.set(bl, ref); }
  }
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
// Gegenpruefung 5, Skeptiker (D2/D6): brettLesen setzt zwei Marken, wenn der Branch des Schreibers NEU ANGELEGT wurde und der
// Waechter die id schon vorher kannte — `_zuhauseVertreten` (die GESICHERTE Fassung gilt und vertritt ihn dort: sie passt, solange
// der Ref besteht und eine Fassung traegt; vorher wirkte ein ehrlich neu gepushter, berichtigter Halt fuer niemanden mehr) und
// `_nichtZuhause` (keine gesichert: die Fassung dort ist nicht die seine — vorher wirkte ein zurueckgezogener Halt, byte-gleich
// auf den neu angelegten Branch gelegt, fuer jeden Leser wieder).
export function vonPasst(e, wo, ich) {
  if (!wo) return true;
  const q = e._quellen || wo.get(e.id) || new Set();
  if ([...q].some(istMainRef)) return true;
  const b = autorZweig(e);
  if (!b) return false;
  if (e._zuhauseVertreten && istAutorRef(e._zuhauseVertreten, b)) return true;
  const istIch = Array.isArray(ich) ? ich.indexOf(e.von) >= 0 : ich === e.von;
  return [...q].some(x => istAutorRef(x, b) && x !== e._nichtZuhause) || (q.has('Arbeitsbaum') && istIch);
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
    if (!vonPasst(e, opts.wo, opts.ich)) { melde('„von" (' + e.von + ') passt nicht zum Branch, auf dem ' + (e.art === 'lage' ? 'die Lage' : 'der Halt') + ' liegt' + (e._nichtZuhause ? ' — ' + e._nichtZuhause + ' wurde neu angelegt, nachdem er verschwunden war, und der Waechter kannte ' + (e.art === 'lage' ? 'diese Lage' : 'diesen Halt') + ' schon vorher (gesichert oder zurueckgezogen): dort ist ' + (e.art === 'lage' ? 'sie' : 'er') + ' nicht ' + (e.art === 'lage' ? 'die' : 'der') + ' des Schreibers' : '')); continue; }
    {
      // Die Grenzen aus brettLesen (_rueckGrenze, _vorGrenze); gebaute Eintraege des Pruefstands tragen _angekommen fuer beide.
      const t0 = zeitpunkt(e), woher = e._ankunftWoher || {};
      const rueck = e._rueckGrenze != null ? e._rueckGrenze : e._angekommen, vor = e._vorGrenze != null ? e._vorGrenze : e._angekommen;
      if (rueck != null && t0 < rueck - RUECKDATIERT_MAX_MS) { melde('rueckdatiert: Zeitstempel ' + fmt(t0) + (woher.rueck === 'Waechter' ? ' — der Waechter sah ' + (e.art === 'lage' ? 'diese Lage' : 'diesen Halt') + ' um ' + fmt(rueck) + ' noch nicht' : ', auf dem Branch erst ' + fmt(rueck))); continue; }
      if (vor != null && t0 > vor + VORLAUF_MS) { melde('vordatiert: Zeitstempel ' + fmt(t0) + (woher.vor === 'Waechter' ? ' — der Waechter sah ' + (e.art === 'lage' ? 'sie' : 'ihn') + ' schon um ' + fmt(vor) : ', auf dem Branch schon ' + fmt(vor))); continue; }
      // Gegenpruefung 5 (E5): Ankunft NICHT RECHENBAR (Teilabruf, Verzeichnis nicht gelesen, kein Commit mit diesem Anspruch) —
      // eine Lage nimmt dann nichts, aber ihre Ziele sind fuer nehme/lage/einspielen „nicht entscheidbar" (uebernahmePruefen);
      // vorher wirkte sie nicht UND niemand sagte es dem naechsten Nehmer, der eine zweite Uebernahme schrieb (R5-lesen-0).
      if (e.art === 'lage' && e._ankunftOffen) { melde('Ankunft nicht rechenbar (' + e._ankunftOffen + ') — eine Lage nimmt nur mit rechenbarer Ankunft; ihre Ziele sind fuer nehme „nicht entscheidbar"'); continue; }
    }
    if (e.art === 'lage') { gueltigeLagen.push({ e, bis: w.ok ? w.bis : Date.parse(e.bis), aktiv: w.ok }); continue; }
    const veto = (alsListe(e.bezug).find(b => b && b.art === 'widerspricht') || {}).id || null;
    // Ein Halt mit nicht rechenbarer Ankunft WIRKT (die sichere Richtung) — `ankunftOffen` nennt den Grund fuer die Anzeige.
    halts.push({ e, bis: w.bis, veto, antworten: (abl.rueck.get(e.id) || []).filter(x => x.von.art === 'antwort').map(x => x.von), ankunftOffen: e._ankunftOffen || null });
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
      // Ein „fertig" in DERSELBEN Sekunde gibt fuer den Deckel frei (<=): vorher galt die neue Uebernahme eines Stapels
      // [fertig, nehme] nie — „mehr als 3", obwohl nichts mehr gehalten wurde (Gegenpruefung 4). Die eben genommene Lage
      // selbst gibt es nicht frei (gibtFrei verlangt einen SPAETEREN Zeitstempel).
      for (const a of angenommen) if (a.l.bis > tMs && !liste.some(f => gibtFrei(f, a.l, a.ziel) && zeitKey(f.e) <= t)) gehalten.add(a.ziel);
      for (const ziel of nimmt(l.e)) {
        if (!gehalten.has(ziel) && gehalten.size >= LAGE_NIMMT_MAX) { if (!zuViel.has(l.e.id)) zuViel.set(l.e.id, { l, z: [] }); zuViel.get(l.e.id).z.push(ziel); continue; }
        gehalten.add(ziel); angenommen.push({ l, ziel });
      }
    }
    // Was gilt JETZT: angenommen, die Lage laeuft noch, und kein spaeteres „fertig" hat sie beendet. Geordnet wird ein
    // Anspruch nach dem BEGINN seiner Kette: eine Uebernahme desselben Ziels, die geschrieben wurde, solange die vorige noch
    // lief (ohne „fertig" dazwischen), setzt sie fort — vorher fiel, wer kurz vor Ablauf verlaengerte, bei Ablauf der alten
    // Lage hinter einen, der spaeter kam (Gegenpruefung 4).
    const kettenAnfang = (a) => {
      let s = a.l;
      for (;;) {
        const vor = angenommen.filter(p => p.ziel === a.ziel && p.l !== s && zeitKey(p.l.e) < zeitKey(s.e) && p.l.bis >= zeitpunkt(s.e) && !liste.some(f => gibtFrei(f, p.l, a.ziel) && zeitKey(f.e) <= zeitKey(s.e)));
        if (!vor.length) return s;
        s = vor.sort((x, y) => lageOrd(x.l.e).localeCompare(lageOrd(y.l.e)))[0].l;
      }
    };
    for (const a of angenommen) if (a.l.aktiv && !liste.some(f => gibtFrei(f, a.l, a.ziel))) ansprueche.push({ ziel: a.ziel, lage: a.l, seit: kettenAnfang(a) });
    for (const { l, z } of zuViel.values()) if (l.aktiv) unwirksam.push({ e: l.e, grund: 'mehr als ' + LAGE_NIMMT_MAX + ' Uebernahmen zugleich — fuer ' + z.join(', ') + ' gilt sie nicht (die aeltesten gelten)', ziele: z, teil: z.length < nimmt(l.e).length });
    // Fortschritt: die juengste Lage des Schreibers, die noch laeuft — oder ein „fertig" (auch abgelaufen), das sie beendet.
    // Vorher verdeckte eine abgelaufene juengste Lage (eine kurze Uebernahme) die laufende Runde (Gegenpruefung 4).
    const neueste = liste.slice().reverse().find(x => x.aktiv || x.e.phase === 'fertig');
    if (neueste && neueste.aktiv && neueste.e.phase !== 'fertig') lagen.push(neueste);
  }
  // Mehrere Schreiber auf dasselbe Ziel: die AELTESTE Uebernahme gilt (Selbstauskunft — README).
  const uebernahme = new Map();
  for (const a of ansprueche.sort((x, y) => lageOrd(x.seit.e).localeCompare(lageOrd(y.seit.e)) || (y.lage.bis - x.lage.bis) || lageOrd(x.lage.e).localeCompare(lageOrd(y.lage.e)))) {
    if (!uebernahme.has(a.ziel)) uebernahme.set(a.ziel, { lage: a.lage, auch: [], seit: a.seit });
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
// of, yield und await sind nur MANCHMAL Schluesselwoerter, sonst gewoehnliche Namen (`function gsA(of) { return of / 2; }`).
// Gegenpruefung 4: sie galten immer als Schluesselwort, `of / 2; } … /` wurde ein Regex, und gsA reichte STILL bis in die
// naechste Funktion (acorn: 2-3, Scanner: 2-5). Was ohne Parser sicher geht, rechnet klammernPaaren (`schluessel`).
// Echte Schluesselwoerter (nie ein Name): nach ihnen beginnt ein Ausdruck.
const RESERVIERT_VOR_AUSDRUCK = new Set(['return', 'typeof', 'instanceof', 'in', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else']);
// Nach der ) dieser Koepfe beginnt eine Anweisung — dort ist / ein Regex (`if (x) /'/.test(y)`), sonst ein Teilen.
const KOPF_WORT = new Set(['if', 'while', 'for', 'with']);
// Hinter diesen steht im for-Kopf der Name, der gebunden wird — auch wenn er `of` heisst (Gegenpruefung 5).
const DEKL_WORT = new Set(['var', 'let', 'const']);
// Leerraum, wie JS ihn kennt: dazu jeder Unicode-Leerraum (Zs). Gegenpruefung 4: ein Geviertleerzeichen (U+2003) vor
// `/[{]/` galt als Buchstabe eines Namens, das / als Teilen, und der Block ging nicht mehr auf.
const LEER = new Set([' ', '\t', '\n', '\r', '\f', '\v', '\u00a0', '\ufeff', '\u2028', '\u2029',
  '\u1680', '\u2000', '\u2001', '\u2002', '\u2003', '\u2004', '\u2005', '\u2006', '\u2007', '\u2008', '\u2009', '\u200a', '\u202f', '\u205f', '\u3000']);
const ZEILENENDE = new Set(['\n', '\r', '\u2028', '\u2029']);
// Das naechste Zeilenende ab `ab` (hoechstens b): ein //-Kommentar, ein <!-- / -->-Kommentar und ein Regex enden an JEDEM
// Zeilenende von JS, nicht nur an \n (Gegenpruefung 4: `// Notiz` + U+2028 + `}` — fuer acorn schloss die } die Funktion).
// Begrenzt auf [ab, b): vorher suchte eine Regex bis zum naechsten Zeilenende der GANZEN Datei — je /*…*/ auf einer langen
// Zeile einmal, also quadratisch (Gegenpruefung 4, Skeptiker: 46× langsamer).
function zeilenEnde(text, ab, b) { for (let j = ab; j < b; j++) if (ZEILENENDE.has(text[j])) return j; return b; }
const ZU = { '{': '}', '(': ')', '[': ']' };
// Ein Name: ASCII, $, _ und (grosszuegig) alles ab U+00C0 — AUSSER dem Leerraum und den Zeilenenden darin (U+1680,
// U+2000–U+200A, U+2028/2029, U+202F, U+205F, U+3000, U+FEFF): sonst hiess `return` + U+3000 + `/x/` ein Wort „return…".
// Dazu (Gegenpruefung 5) die drei Buchstaben vor U+00C0, die JS als Namensanfang kennt (U+00AA, U+00B5, U+00BA: ID_Start),
// und U+00B7 im Namen (ID_Continue): vorher war ein Name aus U+00B5 vor / ein Operator, das / ein Regex, und gsA reichte still
// zwei Zeilen zu weit (acorn: Teilen).
const ID_ANF = /[A-Za-z_$\u00aa\u00b5\u00ba\u00c0-\u167f\u1681-\u1fff\u200b-\u2027\u202a-\u202e\u2030-\u205e\u2060-\u2fff\u3001-\ufefe\uff00-\uffff]/;
const ID_ZEICHEN = /[\w$\u00aa\u00b5\u00b7\u00ba\u00c0-\u167f\u1681-\u1fff\u200b-\u2027\u202a-\u202e\u2030-\u205e\u2060-\u2fff\u3001-\ufefe\uff00-\uffff]/;
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
// Ein Bereich ist [von, bis, modul]: `modul` (true bei type="module") sagt klammernPaaren, dass `<!--` und `-->` dort KEINE
// Kommentare sind (nur das klassische Skript kennt sie) und await/yield immer Schluesselwoerter — Gegenpruefung 4:
// `if (a <!--b) { … }` ist in einem Modul gueltig (a < !(--b)), der Scanner las einen Kommentar und der Block ging nicht auf.
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
    let typ = null;   // der Wert des ERSTEN type-Attributs (ein doppeltes Attribut zaehlt im Browser nicht)
    // Attribute bis zum > ausserhalb von Anfuehrungszeichen.
    while (j < n && klein[j] !== '>') {
      if (/[\s/]/.test(klein[j])) { j++; continue; }
      const a0 = j;
      j++;   // das erste Zeichen eines Namens darf auch = sein
      while (j < n && !/[\s/>=]/.test(klein[j])) j++;
      const aName = klein.slice(a0, j), erstes = !attr.has(aName);
      attr.add(aName);
      while (j < n && /\s/.test(klein[j])) j++;
      if (klein[j] !== '=') continue;
      j++;
      while (j < n && /\s/.test(klein[j])) j++;
      const w0 = j;
      if (klein[j] === '"' || klein[j] === "'") { const q = klein.indexOf(klein[j], j + 1); j = q < 0 ? n : q + 1; }
      else while (j < n && !/[\s>]/.test(klein[j])) j++;
      if (aName === 'type' && erstes) typ = klein.slice(w0, j).replace(/^["']|["']$/g, '');
    }
    const nach = Math.min(n, j + 1);
    if (zu) { i = nach; continue; }
    if (name === 'script') {
      const ende = schlussTag(klein, 'script', nach), b = ende < 0 ? n : ende;
      if (!attr.has('src')) aus.push(typ != null && typ.replace(/^[ \t\n\f\r]+|[ \t\n\f\r]+$/g, '') === 'module' ? [nach, b, true] : [nach, b]);
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
export function klammernPaaren(text, a, b, modul) {
  const paare = new Map(), offen = [], fn = [], st = [];
  let i = a, art = 'start', wort = '', kaputt = false, fehler = null, zeilenAnf = true;
  // Was VOR dem letzten Wort stand (seine `art` und, war es ein Wort, welches): fuer `for await (` und das `of` im for-Kopf.
  let vorArt = 'start', vorWort = '';
  // Ist das letzte Wort das SCHLUESSELWORT `of` eines for-Kopfs? Entschieden, wenn das Wort gelesen wird (Gegenpruefung 5):
  // vorher galt jedes `of` hinter einem Wort als Schluesselwort — `for (const x of of / 2 ? a : b)` las das zweite `of`
  // (ein Name) als Schluesselwort, das / als Regex, und der Block hiess „unsicher" (acorn: Teilen). Je for-Kopf gibt es
  // HOECHSTENS ein Schluesselwort `of`; ein `of` direkt hinter var/let/const ist der Name, der gebunden wird
  // (`for (const of of /x/g…)`: das zweite ist das Schluesselwort).
  let ofKw = false;
  const bruch = (p) => { if (!kaputt) { kaputt = true; fehler = p; } };
  // Ist das letzte Wort ein Schluesselwort, nach dem ein Ausdruck BEGINNT (/ ein Regex, ++ ein Praefix)? Gegenpruefung 4:
  //   of    — ein Schluesselwort nur direkt im Kopf eines for (…) und nur HINTER dem Ziel (Name, ] oder }:
  //           `for (const m of /x/g…)`); ein Name `of` steht dort hinter einem Operator, einer ( oder einem
  //           Schluesselwort (`for (i = of / 2; …)`), ausserhalb eines for-Kopfs immer. Das ist ohne Parser sicher.
  //   yield, await — im Modul immer Schluesselwoerter; im klassischen Skript nur in einer Generator- bzw. async-Funktion,
  //           und die sieht der Scanner nicht. Dann wird der Block `kaputt` (Naeherung, `unsicher`): lieber gesagt
  //           „Grenzen unsicher" als still einer der zwei Lesarten gefolgt (`var x = yield / 2` las er als Regex).
  const schluessel = (p) => {
    if (RESERVIERT_VOR_AUSDRUCK.has(wort)) return true;
    if (!REGEX_NACH_WORT.has(wort)) return false;   // ein gewoehnlicher Name
    if (wort === 'of') return ofKw;
    if (modul) return true;
    bruch(p); return true;
  };
  // `art` ist das Letzte, was vor einem / stand. Ein Regex-Literal ist erlaubt am Anfang, nach einem
  // Operator, nach } (Blockende), nach einem Schluesselwort wie return/typeof und nach der ) eines
  // if/while/for/with-Kopfs. Ein Wort direkt hinter . oder ?. ist eine Eigenschaft (`t.in / t.out`), ebenso ein
  // privater Name hinter # (`this.#in / 2`, Gegenpruefung 4), und ein nachgestelltes ++/-- schliesst einen Wert ab
  // (`erledigt++ / gesamt`) — Runde 3 und 4, je gegen acorn.
  const regexErlaubt = (p) => art === 'start' || art === 'op' || art === 'zu}' || art === 'kopf)' || (art === 'wort' && schluessel(p));
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
    // Kommentare enden an jedem Zeilenende von JS (zeilenEnde), nicht nur an \n.
    if (c === '/' && text[i + 1] === '/') { i = zeilenEnde(text, i, b); continue; }
    if (c === '/' && text[i + 1] === '*') { const n = text.indexOf('*/', i + 2), e = n < 0 || n >= b ? b : n + 2; if (zeilenEnde(text, i, e) < e) zeilenAnf = true; i = e; continue; }
    // `<!--` ueberall und `-->` am Zeilenanfang (davor nur Leerraum und Kommentare) sind NUR im klassischen Skript ein
    // Kommentar bis zum Zeilenende; im Modul sind es Operatoren (a <!--b ist a < !(--b)).
    if (!modul && c === '<' && text.startsWith('<!--', i)) { i = zeilenEnde(text, i, b); continue; }
    if (!modul && c === '-' && zeilenAnf && text.startsWith('-->', i)) { i = zeilenEnde(text, i, b); continue; }
    zeilenAnf = false;
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < b && text[j] !== c && text[j] !== '\n') j += text[j] !== '\\' ? 1 : (text[j + 1] === '\r' && text[j + 2] === '\n' ? 3 : 2);
      if (j >= b || text[j] !== c) bruch(i);
      i = j + 1; art = 'wert'; continue;
    }
    if (c === '`') { const vor = st.length; i = vorlage(i + 1, i); art = st.length > vor ? 'op' : 'wert'; continue; }
    if (c === '/' && regexErlaubt(i)) {
      let j = i + 1, klasse = false, ok = false;
      while (j < b && !ZEILENENDE.has(text[j])) {
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
      vorArt = art; vorWort = wort;
      wort = text.slice(i, j); if (wort === 'function') fn.push(i);
      ofKw = false;
      if (wort === 'of') {
        const top = st[st.length - 1];
        if (top && top.fuer && !top.ofSchon && (vorArt === 'wert' || vorArt === 'zu}' || (vorArt === 'wort' && !RESERVIERT_VOR_AUSDRUCK.has(vorWort) && !DEKL_WORT.has(vorWort)))) { ofKw = true; top.ofSchon = true; }
      }
      art = 'wort'; i = j; continue;
    }
    if ((c >= '0' && c <= '9') || (c === '.' && /\d/.test(text[i + 1] || ''))) { let j = i + 1; while (j < b && /[\w.]/.test(text[j])) j++; i = j; art = 'wert'; continue; }
    if (c === '.') { if (text[i + 1] === '.' && text[i + 2] === '.') { i += 3; art = 'op'; } else { i++; art = 'punkt'; } continue; }
    // Ein privater Name (#in, #for): was folgt, ist ein Name wie hinter einem Punkt — nie ein Schluesselwort.
    if (c === '#' && i + 1 < b && ID_ANF.test(text[i + 1])) { i++; art = 'punkt'; continue; }
    if ((c === '+' || c === '-') && text[i + 1] === c) { i += 2; art = art === 'wert' || (art === 'wort' && !schluessel(i - 2)) ? 'wert' : 'op'; continue; }
    if (c === '{' || c === '(' || c === '[') {
      const k = { ch: c, pos: i };
      if (c === '(' && art === 'wort') {
        if (KOPF_WORT.has(wort)) k.kopf = true;
        // Der Kopf eines for (auch `for await (`): nur direkt darin kann `of` ein Schluesselwort sein.
        if (wort === 'for' || (wort === 'await' && vorArt === 'wort' && vorWort === 'for')) { k.kopf = true; k.fuer = true; }
      }
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
  const bl = jsBereiche(text, modus).map(([a, b, modul]) => Object.assign({ a, b }, klammernPaaren(text, a, b, modul)));
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
// (gegen die Abzweigstelle ODER gegen main), oder der Diff war nicht lesbar — dann gilt jeder Halt auf eine
// Funktion in `namen` als beruehrt. Zu viel melden ist hier besser als schweigen.
// Eine UNSICHERE Seite ist kein Filter (Gegenpruefung 4): die Funktionen sind „seit dem Abzweigen" ∩ „anders als
// main", und in einem Block, dessen Grenzen auf einer Seite nicht bestimmbar sind, gilt dort JEDE seiner Funktionen
// als moeglich. Vorher: main kaputt, die Sitzung loescht eine Zeile in gsA — die Naeherung legte sie auf main in
// einen Helfer, die Schnittmenge verlor gsA, und weil nur EINE Seite unsicher war, stand auch kein „Grenzen unsicher"
// da. Was die GENAUE Seite ausschliesst, bleibt ausgeschlossen; was nur ueber die unsichere Seite hereinkommt,
// steht in `namen` (der Halt sagt „Grenzen unsicher").
// Der Diff laeuft ohne Farbe, ohne externes Diff-Programm und ohne textconv: eine Einstellung der Person
// (color.ui=always, diff.external) machte die Hunk-Koepfe unlesbar, und jeder Funktions-Halt verstummte.
// Gegenpruefung 4, drei weitere: --text (core.bigFileThreshold unter der Dateigroesse oder ein `-diff`-Attribut
// machten index.html „binaer" — kein Hunk-Kopf, JEDER Funktions-Halt „Grenzen unsicher"), --inter-hunk-context=0
// (diff.interHunkContext=60 legte zwei Aenderungen in EINEN Hunk und meldete STILL jede Funktion dazwischen) und
// eine Umgebung ohne GIT_DIFF_OPTS (git 2.43: `GIT_DIFF_OPTS=--unified=12` schlaegt sogar -U0 — zwoelf Zeilen
// Kontext, STILL zwei Funktionen zu viel) und ohne GIT_EXTERNAL_DIFF. git() selbst bleibt unberuehrt.
const DIFF_U0 = ['diff', '--no-color', '--no-ext-diff', '--no-textconv', '--text', '--inter-hunk-context=0', '-U0'];
const DIFF_UMGEBUNG_OHNE = ['GIT_DIFF_OPTS', 'GIT_EXTERNAL_DIFF'];
// Gegenpruefung 5 (R5-lesen-3): eigeneAenderung LAEDT NICHTS NACH. Vorher holten `git diff --name-only`, `git show` und der
// -U0-Diff im Teilabruf still die Blobs von origin/main (gemessen: `lesen --nur-lokal` liess die Packs von 3 auf 5 wachsen,
// und gegen einen haengenden Remote hing `lesen --nur-lokal` 22 s, ohne jede Frist) — obwohl „Lesen laedt nie nach" galt.
// Jetzt laufen alle git-Aufrufe hier mit GIT_NO_LAZY_FETCH=1. Was dann fehlt, wird nicht still zu „nichts geaendert":
//  · Die Liste der Dateien braucht keinen Blob von origin/main: scheitert `diff --name-only <rev>` (es liest die Blobs von
//    <rev> fuer jede Datei, deren Stat-Daten nicht passen — gemessen Exit 128), rechnet dieselbe Frage ohne sie: der Index
//    gegen <rev> (nur Kennungen), der Arbeitsbaum gegen den Index (dessen Blobs liegen lokal), und fuer jede im Arbeitsbaum
//    geaenderte Datei die Kennung, die git ihr gaebe (hash-object), gegen die auf <rev> (ls-tree).
//  · Fehlt der TEXT von index.html (Abzweigstelle oder main), ist der Funktionsvergleich unsicher (`unsicher`): was nur die
//    vorhandene Seite ausschliesst, bleibt ausgeschlossen; fehlen beide, zaehlt jede Funktion. Der Grund nennt den Weg (`holen`
//    laedt beide nach, eintraegeNachladen mit opts.aenderung).
//  · Fehlt sw.js einer Seite, und hat dieser Stand sw.js geaendert, zaehlt die fehlende Seite als „anders" (bump = ja, die
//    sichere Richtung fuer einen Halt), und `bumpUnsicher` sagt warum. Hat er sw.js nicht geaendert, ist bump sicher nein.
// Welche Dateien unterscheiden sich zwischen <rev> und dem Arbeitsbaum — OHNE einen Blob von <rev> zu lesen (Set, oder null:
// nicht lesbar). Herausgeloest aus eigeneAenderung (Gegenpruefung 5b, R5b-lesen-2): eintraegeNachladen fragt dieselbe Frage
// VOR dem Nachladen, damit `holen` index.html und sw.js nur holt, wenn dieser Stand sie geaendert hat. Der direkte Weg
// (`diff --name-only <rev>`) scheitert im Teilabruf an jeder Datei, deren Stat-Daten nicht passen (gemessen Exit 128: eine
// ungespeicherte Aenderung oder nur `touch`, sobald main die Datei seit dem Klonen geaendert hat) — dann der Ersatzweg: der Index
// gegen <rev> (nur Kennungen), der Arbeitsbaum gegen den Index, und je im Arbeitsbaum geaenderter Datei die Kennung, die git ihr
// gaebe (hash-object), gegen die auf <rev> (ls-tree). --no-renames: bei einer Umbenennung zaehlen der alte UND der neue Name.
function dateiNamen(wurzel, args) { const t = git(wurzel, args, { ohneNachladen: true }); return t == null ? null : new Set(t.split('\n').map(x => x.trim()).filter(Boolean)); }
function dateienAnders(wurzel, rev) {
  const direkt = dateiNamen(wurzel, ['diff', '--name-only', '--no-renames', rev]);
  if (direkt) return direkt;
  const idx = dateiNamen(wurzel, ['diff-index', '--cached', '--name-only', '--no-renames', rev, '--']), wt = dateiNamen(wurzel, ['diff', '--name-only', '--no-renames']);
  if (!idx || !wt) return null;
  const aus = new Set([...idx].filter(n => !wt.has(n)));
  for (const n of wt) {
    const ls = git(wurzel, ['ls-tree', rev, '--', n], { ohneNachladen: true });
    if (ls == null) return null;
    const dort = (ls.match(/^\d+ \w+ ([0-9a-f]+)\t/) || [])[1] || null;
    let hier = null;
    if (fs.existsSync(path.join(wurzel, n))) { hier = (git(wurzel, ['hash-object', '--', n], { ohneNachladen: true }) || '').trim(); if (!hier) return null; }
    if (hier !== dort) aus.add(n);
  }
  return aus;
}
// Die Dateien, die DIESER Stand geaendert hat: seit der Basis UND gegen main (dazu jede neue, ungetrackte Datei), ohne die
// Eintraege des Bretts — sie beruehren nie einen Halt (sonst haelt ein Halt auch die Antwort darauf an). null: nicht lesbar.
function aenderungDateien(wurzel, basis, main) {
  const neuDa = dateiNamen(wurzel, ['ls-files', '--others', '--exclude-standard']);
  const seitBasis = dateienAnders(wurzel, basis), gegenMain = main === basis ? seitBasis : dateienAnders(wurzel, main);
  if (!neuDa || !seitBasis || !gegenMain) return null;
  neuDa.forEach(n => { seitBasis.add(n); gegenMain.add(n); });
  return [...seitBasis].filter(n => gegenMain.has(n) && n.indexOf('docs/austausch/') !== 0).sort();
}
export function eigeneAenderung(wurzel, opts) {
  opts = opts || {};
  const NL = { ohneNachladen: true };
  let MAIN = 'refs/remotes/origin/main', basis;
  if (opts.basis) { basis = opts.basis; MAIN = opts.basis; }
  else {
    if (git(wurzel, ['rev-parse', '--verify', '--quiet', MAIN], NL) == null) return { grund: 'origin/main ist nicht bekannt (erst `holen`)' };
    basis = (git(wurzel, ['merge-base', 'HEAD', MAIN], NL) || '').trim();
    if (!basis) return { grund: 'kein gemeinsamer Vorfahr mit origin/main (flacher Klon? `git fetch --unshallow`)' };
  }
  const TEIL = 'nicht im lokalen Objektspeicher (Teilabruf; gelesen wird ohne Nachladen) — `node scripts/austausch.mjs holen` laedt es nach';
  const dateien = aenderungDateien(wurzel, basis, MAIN);
  if (!dateien) return { grund: 'welche Dateien dieser Stand geaendert hat, ist ohne Nachladen nicht lesbar: ein Baum von ' + (opts.basis ? 'der Basis' : 'origin/main oder der Abzweigstelle') + ' liegt ' + TEIL };
  // Der Text einer Datei auf <rev>: {t} (null, wenn es sie dort nicht gibt) oder {fehlt: true} (Baum oder Blob nicht hier).
  const text = (rev, datei) => {
    const ls = git(wurzel, ['ls-tree', '-z', rev, '--', datei], NL);
    if (ls == null) return { t: null, fehlt: true };
    const m = ls.match(/^\d+ blob ([0-9a-f]+)\t/);
    if (!m) return { t: null };
    const b = blobsLesen(wurzel, [m[1]]).get(m[1]);
    return b ? { t: b.toString('utf8') } : { t: null, fehlt: true };
  };
  const seite = (fb, fm) => [fb ? (opts.basis ? 'der Basis' : 'der Abzweigstelle') : null, fm && !opts.basis ? 'origin/main' : null].filter(Boolean).join(' und ');
  let funktionen = [], unsicher = null;
  if (dateien.indexOf('index.html') >= 0) {
    // Der -U0-Diff in einer EIGENEN Umgebung (ohne die zwei Variablen oben, ohne Nachladen); ein Fehler gibt null.
    const diffU0 = (gegen) => {
      const env = Object.assign({}, process.env, { GIT_NO_LAZY_FETCH: '1' });
      for (const k of DIFF_UMGEBUNG_OHNE) delete env[k];
      let r = null;
      try { r = cp.spawnSync('git', ['-C', wurzel, '-c', 'core.quotePath=false'].concat(DIFF_U0, [gegen, '--', 'index.html']), { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024 }); } catch (_) {}
      return r && r.status === 0 ? r.stdout || '' : null;
    };
    let hier = null; try { hier = fs.readFileSync(path.join(wurzel, 'index.html'), 'utf8'); } catch (_) {}
    const xB = text(basis, 'index.html'), xM = opts.basis ? xB : text(MAIN, 'index.html');
    const dB = xB.fehlt ? null : diffU0(basis), dM = opts.basis ? dB : (xM.fehlt ? null : diffU0(MAIN));
    const tBasis = xB.t, tMain = xM.t;
    const fa = dB == null ? null : funktionenAusDiff(dB, tBasis, hier);
    const fm = dM == null ? null : funktionenAusDiff(dM, tMain, hier);
    // Je Seite: die genauen Namen und, ist die Seite unsicher, jede Funktion der beruehrten Bloecke darin.
    const weit = (x) => x.unsicher ? new Set([...x].concat(x.unsicher.namen)) : x;
    if (!fa || !fm) {
      // Eine Seite (oder beide) nicht lesbar: was die LESBARE Seite ausschliesst, bleibt ausgeschlossen; sonst jede Funktion.
      const alle = new Set();
      if (fa || fm) weit(fa || fm).forEach(x => alle.add(x));
      else for (const t of [tBasis, tMain, hier]) if (t) funktionsBereiche(t).bereiche.forEach(x => alle.add(x.name));
      unsicher = { ab: null, grund: 'index.html ' + (seite(!fa, !fm) ? 'von ' + seite(!fa, !fm) + ' ' : '') + TEIL + ' (bis dahin gilt jede Funktion als beruehrt, die die lesbare Seite nicht ausschliesst)', namen: [...alle].sort() };
    } else {
      const wa = weit(fa), wm = weit(fm);
      funktionen = [...wa].filter(x => wm.has(x)).sort();
      if (fa.unlesbar || fm.unlesbar) {
        const alle = new Set();
        for (const t of [tBasis, tMain, hier]) funktionsBereiche(t).bereiche.forEach(x => alle.add(x.name));
        unsicher = { ab: null, grund: 'der Diff von index.html hat keinen lesbaren Hunk-Kopf (liest git die Datei als binaer, oder formt eine Einstellung den Diff um?)', namen: [...alle].sort() };
      } else if (fa.unsicher || fm.unsicher) {
        const seiten = [fa.unsicher, fm.unsicher].filter(Boolean), moeglich = new Set(seiten.flatMap(u => u.namen));
        const un = funktionen.filter(x => moeglich.has(x));
        // Die Zeilen gehoeren zu den Texten DIESES Vergleichs (Abzweigstelle, main oder der Arbeitsbaum) — gesagt, mit welchem.
        const wo = fa.unsicher && fm.unsicher ? '' : (fa.unsicher ? ', im Vergleich mit der Abzweigstelle' : ', im Vergleich mit main');
        if (un.length) unsicher = { ab: Math.min(...seiten.map(u => u.ab)), grund: 'ein <script>-Block geht nicht auf (Zeilen ' + [...new Set(seiten.flatMap(u => u.bloecke))].join(', ') + wo + ')', namen: un };
      }
    }
  }
  const v = (t) => ((t || '').match(SW_VERSION) || [])[1] || null;
  let swHier = null; try { swHier = fs.readFileSync(path.join(wurzel, 'sw.js'), 'utf8'); } catch (_) {}
  // Nur gelesen, wenn dieser Stand sw.js geaendert hat — sonst ist es kein Bump (dieselbe Datei wie an der Abzweigstelle).
  const swGeaendert = dateien.indexOf('sw.js') >= 0;
  const sB = swGeaendert ? text(basis, 'sw.js') : { t: null }, sM = swGeaendert ? (opts.basis ? sB : text(MAIN, 'sw.js')) : { t: null };
  const vHier = v(swHier), vMain = v(sM.t), vBasis = v(sB.t);
  let bump = swGeaendert && !!(vHier && vHier !== vBasis && vHier !== vMain), bumpUnsicher = null;
  if (swGeaendert && vHier && (sB.fehlt || sM.fehlt)) {
    bump = (sB.fehlt || vHier !== vBasis) && (sM.fehlt || vHier !== vMain);
    if (bump) bumpUnsicher = 'sw.js von ' + seite(sB.fehlt, sM.fehlt) + ' ' + TEIL;
  }
  const aus = { basis, dateien, funktionen, unsicher, bump };
  if (bumpUnsicher) aus.bumpUnsicher = bumpUnsicher;
  return aus;
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
// Was am Brett fuer einen HALT ungewiss ist — EINE Rechnung fuer A8 und `naechste` (Gegenpruefung 5):
//   fehlend   ungelesene Eintragsdateien, die ein Halt sein koennen (ihr Name sagt „halt" oder hat nicht die Form eines
//             Eintrags, oder ein ganzer Baum fehlt), ohne die, die nachweislich zu gross fuer einen Eintrag sind
//             (teilabrufGrenze, nur in der CI belegt), und ohne die Grabstein-Liste (sie entfernt Halts, versteckt keinen).
//   strittig  strittige ids, von denen eine gelesene Fassung ein wirksamer Halt ist oder eine ungelesene einer sein kann — mit
//             den Fassungen (`halts`) und der Zahl der ungelesenen. Vorher fiel ein strittiger Halt STILL weg: eine Kopie mit
//             anderem `von` vor dem ersten Waechter-Lauf, und `naechste` endete mit 0 statt 1, A8 sagte „keiner beruehrt
//             diesen Stand" (R5-fassungen-0, R5-fassungen-2).
export function haltUngewiss(wurzel, b, umgebung, jetzt) {
  const umg = Object.assign({}, process.env, umgebung || {}), t = jetzt == null ? Date.now() : jetzt;
  const grenze = new Map(), grenzeVon = (quelle) => { const r = String(quelle).split('/')[0]; if (!grenze.has(r)) grenze.set(r, teilabrufGrenze(wurzel, r, umg)); return grenze.get(r); };
  const zuGross = (x) => !x.baum && grenzeVon(x.quelle) > EINTRAG_MAX_BYTES;
  const kannHalt = (x) => { if (x.baum) return true; if (x.grabsteine) return false; const m = path.posix.basename(String(x.pfad || '')).match(NAME_FORM); return !m || m[2] === 'halt'; };
  // R5c-Le4 (F5): dazu die Fassungen unter fassungen/ in zz-sicherung, die ohne Verzeichnis nicht gelesen sind (sicherungUngelesen).
  const fehlend = (b.fehlend || []).concat(b.sicherungUngelesen || []).filter(x => kannHalt(x) && !zuGross(x));
  const strittig = [];
  for (const s of b.strittig || []) {
    const halts = ((b.fassungen && b.fassungen.get(s.id)) || []).map(v => v.e).filter(e => e.art === 'halt' && wirksam(e, t).ok);
    const ungelesen = (b.fehlend || []).filter(x => !x.baum && !x.grabsteine && idAusName(path.posix.basename(String(x.pfad || ''))) === s.id && kannHalt(x) && !zuGross(x)).length;
    // Nur in der Sicherung (D7, Skeptiker R5b-waechter-4): kein Leser kennt Text oder Geltung — eine Fassung, die ein Halt mit
    // laufender Frist sein KANN (art „halt" mit bis > jetzt, oder art bzw. bis unbekannt: altes Format), ist „nicht rechenbar".
    const nurSicherung = s.nurSicherung ? (s.sicherung || []).filter(x => x.art === undefined || (x.art === 'halt' && (x.bis === undefined || (typeof x.bis === 'number' && x.bis > t)))).length : 0;
    if (halts.length || ungelesen || nurSicherung) strittig.push({ id: s.id, quellen: s.quellen || [], grund: s.grund || null, halts, ungelesen, nurSicherung });
  }
  return { fehlend, strittig, grenzeVon };
}
export function haltsDiesesStands(wurzel, umgebung, jetzt) {
  umgebung = umgebung || {};
  const wb = waechterBasis(wurzel, umgebung);
  // `leer` (HEAD ohne eigenen Commit, Brett unveraendert) ist eine Aussage fuer Waechter 1 — „nichts kann verschwunden
  // sein". Fuer Halts gilt sie nicht: eine UNVERBUCHTE Aenderung an index.html beruehrt sie trotzdem, und A8 schwieg,
  // waehrend DICH BETREFFEND im selben Baum vier Halts nannte (Gegenpruefung 4). eigeneAenderung sieht den Arbeitsbaum.
  if (wb.grund && !wb.leer) return { grund: wb.grund };
  const aend = eigeneAenderung(wurzel, umgebung.GITHUB_EVENT_NAME === 'pull_request' ? { basis: wb.basis } : {});
  if (aend.grund) return { grund: aend.grund };
  // „ich": im PR nur der Branch dieses Repos, der den Kopf traegt (prKopf — ein Fork waehlt GITHUB_HEAD_REF frei);
  // sonst der lokale Branch und sein Upstream nur nach einem belegten Umbenennen (eigeneNamen).
  const ez = eigenerZweig(wurzel), imPR = !!umgebung.GITHUB_HEAD_REF, pk = imPR ? prKopf(wurzel, umgebung) : null;
  const ichNamen = imPR ? (pk ? ['sitzung/' + pk] : []) : eigeneNamen(ez), ich = ichNamen[0] || null;
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
  // Die Teilabruf-Grenze aus der UEBERGEBENEN Umgebung (vor process.env) — vorher entschied process.env allein (Skeptiker).
  const ung = haltUngewiss(wurzel, b, umgebung, jetzt), grenzeVon = ung.grenzeVon;
  // Ein fehlender BAUM ist nie „zu gross": dort fehlen alle Eintraege des Branches (Gegenpruefung 4, --filter=tree:0).
  // Die Grabstein-Liste von main zaehlt hier nicht (Gegenpruefung 5): fehlt sie, kann ein angezeigter Halt zurueckgezogen
  // sein — ein „keiner beruehrt" taeuscht sie nicht vor. Das steht in `grabsteineFehlen`.
  // R5c-Le4 (F5): auch die ungelesenen Fassungen in der Sicherung, wenn ihr Verzeichnis nicht gelesen ist (sicherungUngelesen).
  const offenFehlend = b.fehlend.concat(b.sicherungUngelesen || []).filter(x => !x.grabsteine && (x.baum || !(grenzeVon(x.quelle) > EINTRAG_MAX_BYTES)));
  if (offenFehlend.length) return { grund: offenFehlend.length + ' Eintragsdatei(en) nicht im lokalen Objektspeicher (Teilabruf) und nicht nachweislich zu gross fuer einen Eintrag — darin koennte ein Halt liegen: ' + offenFehlend.slice(0, 3).map(x => x.pfad + ' {' + x.quelle + '}').join(', ') + (offenFehlend.length > 3 ? ' … +' + (offenFehlend.length - 3) : ''), nichtPruefbar: true, refs: b.refs, fehlend: b.fehlend.length };
  const meins = (e) => ichNamen.indexOf(e.von) >= 0 && vonPasst(e, wo, ichNamen);
  // Ein STRITTIGER Halt ist nicht „keiner": beruehrt eine seiner Fassungen (nicht meine) diesen Stand, oder ist eine nicht
  // gelesen, ist A8 nicht pruefbar — mit der id (Gegenpruefung 5, R5-fassungen-0/-2; vorher „rechenbar, treffer []").
  const strittigT = ung.strittig.map(s => ({ s, t: [...new Set(s.halts.filter(e => !meins(e)).flatMap(e => haltBeruehrt(e, aend)))] })).filter(x => x.t.length || x.s.ungelesen || x.s.nurSicherung);
  // Quellen und Grund (er nennt die `von` der Fassungen) kommen aus fremder Hand: eine Zeile, ohne Steuerzeichen (R5-werkzeug-0).
  const zeile = (t, n) => { const s = String(t == null ? '' : t).replace(/[\p{Cc}\p{Cf}\u2028\u2029]+/gu, ' ').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  if (strittigT.length) return { grund: strittigT.length + ' strittige(r) Halt(s), von dem eine Fassung diesen Stand beruehrt oder nicht gelesen ist — welche gilt, ist nicht entscheidbar: ' + strittigT.slice(0, 3).map(x => x.s.id + ' {' + zeile(x.s.quellen.join(', '), 160) + '}' + (x.t.length ? ' (' + x.t.slice(0, 3).join(', ') + ')' : x.s.ungelesen ? ' (' + x.s.ungelesen + ' Fassung(en) nicht gelesen)' : ' (nur in der Sicherung — Geltung nicht lesbar)') + (x.s.grund ? ' — ' + zeile(x.s.grund, 200) : '')).join(' · ') + (strittigT.length > 3 ? ' … +' + (strittigT.length - 3) : ''), nichtPruefbar: true, refs: b.refs, strittig: strittigT.map(x => x.s.id) };
  const sw = schwarm(b.eintraege, jetzt == null ? Date.now() : jetzt, { wo, ich: ichNamen });
  // Ist der Bump nicht sicher (sw.js einer Seite fehlt im Teilabruf), traegt der Treffer „bump" den Grund.
  const markiert = (t) => aend.bumpUnsicher ? t.map(x => x === 'bump' ? 'bump — nicht sicher: ' + aend.bumpUnsicher : x) : t;
  const treffer = sw.halts.filter(h => !h.veto && !meins(h.e)).map(h => ({ h, t: markiert(haltBeruehrt(h.e, aend)) })).filter(x => x.t.length);
  // `unsicher`: die Funktionsgrenzen dort, wo dieser Stand index.html aendert, sind nicht bestimmbar — dann
  // stehen die Halts auf Funktionen darin mit „Grenzen unsicher" unter `treffer`. `fehlend`: Eintragsdateien, deren
  // Blob der Teilabruf nicht holte (alle nachweislich zu gross fuer einen Eintrag — sonst oben „nicht pruefbar").
  const fe = b.fehlend.filter(x => !x.grabsteine);
  return { aend, halts: sw.halts, treffer, refs: b.refs, ich, unsicher: aend.unsicher || null, fehlend: fe.length, fehlendAb: fe.length ? Math.min(...fe.map(x => grenzeVon(x.quelle))) : null, grabsteineFehlen: b.fehlend.length > fe.length };
}
// Wer arbeitet laut git an einem offenen Eintrag? Niemand muss es melden: (a) seine Stelle (der Anker)
// wurde auf einem frischen Branch NACH dem Eintrag geaendert; (b) seine id steht in einer
// Commit-Nachricht eines Branches, auf dem er nicht ANGELEGT wurde.
export const IDS_JE_COMMIT_MAX = 3;
export function inArbeitAusGit(wurzel, eintraege, jetzt, tage, wo) {
  const MAIN = 'refs/remotes/origin/main', aus = new Map(), NL = { ohneNachladen: true };
  if (git(wurzel, ['rev-parse', '--verify', '--quiet', MAIN]) == null) return aus;
  // Gegenpruefung 5 (R5-lesen-7): fehlt die Geschichte (Teilabruf ohne Baeume), scheitert jeder diff/log je frischem Branch
  // (gemessen: je Branch ~0,4 s, linear) — EINMAL erkannt, dann kein git-Aufruf je Ref. „In Arbeit" ist dann nicht messbar.
  if (geschichteFehlt(wurzel)) { aus.grund = 'die Geschichte der Branches liegt nicht im lokalen Objektspeicher (Teilabruf ohne Baeume) — „in Arbeit" ist hier nicht messbar'; return aus; }
  const { rueck, zustand, proId } = ableiten(eintraege);
  const offen = eintraege.filter(e => zustand.get(e.id).z === 'offen' && ['befund', 'idee', 'frage', 'klasse'].indexOf(e.art) >= 0);
  const offenIds = new Set(offen.map(e => e.id));
  // Gemessen wird nur ein Anker, der DIESEN Baum beschreibt (Arbeitsbaum, main): der Anker eines Eintrags
  // von einem fremden Branch nennt dessen Code — und 1 200 solche Eintraege kosteten je 40 ms git (49 s).
  const verankert = offen.filter(e => imBaum(e) || (e._quellen && [...e._quellen].some(istMainRef)));
  const dazu = (id, ref, wie) => { if (!aus.has(id)) aus.set(id, []); if (!aus.get(id).some(x => x.ref === ref)) aus.get(id).push({ ref, wie }); };
  // Je BLOB einmal lesen: viele Branches teilen dieselbe Abzweigstelle.
  const cache = new Map(), zeige = (rev, datei) => {
    // Ohne Nachladen: im Klon mit --filter=blob:none holte das blosse `lesen` sonst je frischem Branch index.html einzeln
    // vom Server (Gegenpruefung 4, Skeptiker). Fehlt der Blob, ist die Stelle hier nicht messbar — null.
    const blob = (git(wurzel, ['rev-parse', '--verify', '--quiet', rev + ':' + datei], NL) || '').trim();
    if (!blob) return null;
    if (!cache.has(blob)) { const inh = git(wurzel, ['cat-file', 'blob', blob], NL); cache.set(blob, inh == null ? null : messtext(datei, inh)); }
    return cache.get(blob);
  };
  for (const z of frischeZweige(wurzel, jetzt, tage) || []) {
    const voll = 'refs/remotes/' + z.ref, mb = (git(wurzel, ['merge-base', MAIN, voll], NL) || '').trim();
    if (!mb) continue;
    // Squash-Merge: ein gemergter, stehengebliebener Branch unterscheidet sich nicht mehr von main.
    const gegenMain = new Set((git(wurzel, ['diff', '--name-only', MAIN, voll], NL) || '').split('\n').filter(Boolean));
    if (!gegenMain.size) continue;
    const geaendert = new Set((git(wurzel, ['diff', '--name-only', mb, voll], NL) || '').split('\n').filter(n => n && gegenMain.has(n)));
    // Je (Branch, Datei) EINMAL die Commits mit Zeit, aelteste zuerst — dann je Eintrag eine Suche darin.
    const commits = new Map(), commitsVon = (datei) => {
      if (!commits.has(datei)) commits.set(datei, (git(wurzel, ['log', '--reverse', '--format=%H %ct', mb + '..' + voll, '--', datei], NL) || '').split('\n').filter(Boolean).map(x => { const [h, t] = x.split(' '); return { h, t: Number(t) * 1000 }; }));
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
    for (const nachricht of (git(wurzel, ['log', '--format=%x00%B', mb + '..' + voll], NL) || '').split('\0')) {
      const ids = [...new Set([...nachricht.matchAll(/\b(\d{4}-\d{2}-\d{2}-[0-9a-f]{4}(?:[0-9a-f]{4})?)\b/g)].map(m => m[1]))];
      if (!ids.length || ids.length > IDS_JE_COMMIT_MAX) continue;
      for (const id of ids) {
        if (!offenIds.has(id)) continue;
        // Ausgenommen ist nur der Branch, auf dem der Eintrag ANGELEGT wurde (an der Abzweigstelle
        // lag er noch nicht) — wer ihn von main erbt, hat ihn nicht geschrieben.
        const w = wo && wo.get(id), e = proId.get(id);
        if (w && w.has(z.ref) && e && e._pfad && git(wurzel, ['cat-file', '-e', mb + ':' + e._pfad], NL) == null) continue;
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
// Wie lange sich der Waechter einen Rueckzug merkt, dessen Branch weg (oder neu angelegt) ist, wenn von der id dieses
// Schreibers nichts mehr gesichert ist und nichts mehr auf einem Branch liegt (Gegenpruefung 5: vorher vergass er ihn, sobald
// die Fassung aus der Sicherung genommen war — ein Dritter legte den Branch mit derselben Fassung neu an, und nach dem
// naechsten Loeschen stand der zurueckgezogene Eintrag als „GERETTET" da).
export const SICHERUNG_RUECKZUG_TAGE = 365;
export function sicherungSchreiben(wurzel, opts) {
  opts = opts || {};
  const jetzt = opts.jetzt != null ? opts.jetzt : Date.now(), jetztIso = new Date(jetzt).toISOString();
  const iso = (x) => { const t = Date.parse(String(x || '')); return isNaN(t) ? null : t; };
  const isoOk = (x) => typeof x === 'string' && iso(x) != null;
  const objekt = (o) => o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  const refForm = (r) => typeof r === 'string' && r.indexOf(REMOTE + '/') === 0 && !istSicherungsRef(r) && !/\/HEAD$/.test(r);
  // Eine Zeit aus dem Gedaechtnis oder dem Verzeichnis: null heisst „bekannt: keine", undefined „unbekannt" (altes Format).
  const zeitFeld = (x, k) => !(k in x) ? undefined : (x[k] === null ? null : (isoOk(x[k]) ? x[k] : undefined));
  // 0. Das Gedaechtnis des letzten erfolgreichen Laufs (ohne Titel: ids, Blobs, Quellen, Zeiten) — aus dem Actions-Cache.
  //    Fehlt es, das VERZEICHNIS im bisherigen Stand (VERZEICHNIS): vorher vernichtete ein Lauf ohne Cache die einzige Kopie
  //    in quarantaene/ als „fremde Datei" (Gegenpruefung 4). Das Verzeichnis kennt keine Orte: ob die Sicherung selbst
  //    zurueckgesetzt wurde, sieht dieser Lauf dann nicht — er sagt es. Es traegt seit Gegenpruefung 5 auch die verschwundenen
  //    Refs (weg) und die gemerkten Rueckzuege: vorher vergass ein Lauf ohne Cache beides — ein neu angelegter Branch galt
  //    wieder als der des Schreibers, und ein zurueckgezogener Eintrag stand als „GERETTET" da.
  let alt = null;
  if (opts.stand) { try { alt = JSON.parse(fs.readFileSync(opts.stand, 'utf8')); } catch (_) {} }
  if (alt && (typeof alt !== 'object' || Array.isArray(alt))) alt = null;
  let altVerz = null;
  if (opts.alt) { const t = gitRoh(wurzel, ['show', opts.alt + ':' + VERZEICHNIS]); if (t != null) { try { const j = JSON.parse(t); if (j && typeof j === 'object' && !Array.isArray(j) && Array.isArray(j.fassungen)) altVerz = j; } catch (_) {} } }
  let ausVerzeichnis = false;
  // Eine Fassung mit `ohneDatei: true` im Verzeichnis ist KEINE gesicherte Datei: nur das `von` einer Fassung, die ein Grabstein
  // je Fassung auf main entfernt hat (D5, Gegenpruefung 5, Skeptiker) — sie zaehlt fuer „dasselbe `von`", nie als Fassung.
  const ohneDatei = (x) => !!x && typeof x === 'object' && x.ohneDatei === true;
  if (!alt && altVerz) {
    alt = { stand: altVerz.stand, fassungen: altVerz.fassungen.filter(x => x && typeof x === 'object' && typeof x.blob === 'string' && !ohneDatei(x)).map(x => ({ id: x.id, blob: x.blob, von: x.von, anspruch: x.anspruch, erst: x.erst, nichtVor: x.nichtVor, heim: x.heim === true,
        heimErst: zeitFeld(x, 'heimErst'), heimNichtVor: zeitFeld(x, 'heimNichtVor'), heimZuletzt: isoOk(x.heimZuletzt) ? x.heimZuletzt : undefined, bewahrt: x.bewahrt === true || undefined })),
      quarantaene: (Array.isArray(altVerz.quarantaene) ? altVerz.quarantaene : []).filter(b => typeof b === 'string').map(b => ({ blob: b, id: null })), neuAngelegt: altVerz.neuAngelegt,
      weg: altVerz.weg, zurueckgezogen: altVerz.rueckzuege, grabVon: altVerz.fassungen.filter(ohneDatei) };
    ausVerzeichnis = true;
  }
  // Wann lief der letzte Lauf? Nur das Gedaechtnis im Cache weiss es. Der `stand` des Verzeichnisses aendert sich nur mit dem
  // Inhalt — als „letzter Lauf" genommen, machte er eine Fassung, die ein Lauf ohne Cache zum ersten Mal sah, Stunden aelter,
  // als sie ist (nichtVor), und eine rueckdatierte Lage wirkte danach dauerhaft (Gegenpruefung 5). Ohne Cache: unbekannt.
  const altLauf = alt && !ausVerzeichnis && isoOk(alt.stand) ? alt.stand : null;
  const ged = new Map();   // blob → { id, von, erst, erstUnbekannt, nichtVor, heim, heimErst, heimNichtVor, heimZuletzt, bewahrt, zuletzt, orte, anspruch }
  // `erstUnbekannt`: ein Gedaechtnis im alten Format (ohne erst) — dann ist die erste Sichtung unbekannt, nicht „jetzt"
  // (vorher bekamen alle Fassungen dasselbe erst, und ein spaeterer Ruecksetzer hiess fuer immer „Nichts verloren").
  if (alt && Array.isArray(alt.fassungen)) for (const x of alt.fassungen) if (x && typeof x === 'object' && typeof x.blob === 'string') ged.set(x.blob, Object.assign({}, x, { erstUnbekannt: x.erstUnbekannt === true || iso(x.erst) == null, heimErst: zeitFeld(x, 'heimErst'), heimNichtVor: zeitFeld(x, 'heimNichtVor'), heimZuletzt: isoOk(x.heimZuletzt) ? x.heimZuletzt : undefined, bewahrt: x.bewahrt === true }));
  const gedQuar = new Set(alt && Array.isArray(alt.quarantaene) ? alt.quarantaene.filter(x => x && x.blob).map(x => x.blob) : []);
  // Bekannt ist auch, was das Verzeichnis im bisherigen Stand nennt: nach einem gescheiterten Ablegen des Caches ist das
  // Gedaechtnis einen Lauf alt — eine dort fehlende, eben gesicherte Fassung waere sonst „fremd" (Gegenpruefung 4).
  const gedBekannt = new Set([...ged.keys(), ...gedQuar].concat(altVerz ? altVerz.fassungen.filter(x => !ohneDatei(x)).map(x => x && x.blob).concat(Array.isArray(altVerz.quarantaene) ? altVerz.quarantaene : []).filter(b => typeof b === 'string') : []));
  const gedDa = !!alt;
  // Gemerkte Rueckzuege (Gedaechtnis, ohne Cache das Verzeichnis) — nur wohlgeformte: das Verzeichnis liegt in zz-sicherung.
  // Und nur, wenn der Ref der Branch ist, den `von` nennt (Gegenpruefung 5, Skeptiker R5b-waechter-1): einen Rueckzug zieht nur
  // der Schreiber auf SEINEM Branch — vorher nahm ein Lauf ohne Cache einen von Hand untergeschobenen Rueckzug mit einem fremden
  // Ref aus dem Verzeichnis, merkte ihn sich, und das naechste Loeschen des Branches nahm die einzige Kopie still heraus.
  const altRz = (alt && Array.isArray(alt.zurueckgezogen) ? alt.zurueckgezogen : []).filter(x => x && typeof x === 'object' && ID_FORM.test(String(x.id)) && typeof x.von === 'string' && refForm(x.ref) && (x.blob == null || /^[0-9a-f]{40}$/.test(String(x.blob)))
    && istAutorRef(x.ref, autorZweig({ von: x.von })))
    .map(x => ({ id: x.id, blob: x.blob == null ? null : x.blob, von: x.von, ref: x.ref, seit: isoOk(x.seit) ? x.seit : null }));
  // Gemerkte `von` der Fassungen, die ein Grabstein JE FASSUNG auf main entfernt hat (D5) — aus dem Gedaechtnis, ohne Cache aus
  // dem Verzeichnis (dort `ohneDatei`). Ob sie noch gelten (Grabstein noch da, Eintrag noch strittig), rechnet Schritt 4.
  const altGrabVon = (alt && Array.isArray(alt.grabVon) ? alt.grabVon : []).filter(x => x && typeof x === 'object' && ID_FORM.test(String(x.id)) && typeof x.von === 'string' && /^[0-9a-f]{40}$/.test(String(x.blob)))
    .map(x => ({ id: x.id, blob: x.blob, von: x.von, art: typeof x.art === 'string' ? x.art : null, bis: typeof x.bis === 'string' ? x.bis : null }));
  // Die Refs JETZT, und welche verschwanden und NEU ANGELEGT wurden (ein Name, den nach dem Loeschen ein anderer neu anlegt,
  // ist nicht mehr der Branch des Schreibers — Gegenpruefung 4). Vorher galt beides SICHERUNG_ABBAU_TAGE lang, auch solange
  // der Branch bestand, und ging mit dem Cache verloren: danach war die Faelschung eines Dritten wieder die des Schreibers
  // (Gegenpruefung 5). Jetzt bleibt beides, solange es etwas schuetzt — eine gesicherte Fassung mit dem `von` dieses Refs,
  // die nicht auf main liegt (beim Neuanlegen: eine, die schon VORHER gesichert war), oder ein gemerkter Rueckzug dort —,
  // und beides steht im Verzeichnis.
  const refsJetzt = (gitRoh(wurzel, ['for-each-ref', '--format=%(refname)', 'refs/remotes/' + REMOTE + '/']) || '').split('\n').map(x => x.replace(/^refs\/remotes\//, '')).filter(x => x && !/\/HEAD$/.test(x) && !istSicherungsRef(x));
  const frisch = (t) => iso(t) != null && jetzt - iso(t) <= SICHERUNG_ABBAU_TAGE * 864e5;
  const vonRef = (von) => { const b = autorZweig({ von }); return b ? REMOTE + '/' + b : null; };
  const gedJeRef = new Map();
  for (const x of ged.values()) { const r = vonRef(x.von); if (r) { if (!gedJeRef.has(r)) gedJeRef.set(r, []); gedJeRef.get(r).push(x); } }
  const gedAufMain = (x) => Array.isArray(x.orte) && x.orte.some(q => istMainRef(q) || q === 'Arbeitsbaum');
  const schuetzt = (r, vor) => (gedJeRef.get(r) || []).some(x => !x.bewahrt && !gedAufMain(x) && (vor == null || x.erstUnbekannt || !(iso(x.erst) >= vor)))
    || altRz.some(z => z.ref === r && (vor == null || !(iso(z.seit) >= vor)));
  const weg = {}, neuAngelegt = {};
  const altWeg = objekt(alt && alt.weg), altNeu = objekt(alt && alt.neuAngelegt);
  for (const r of Object.keys(altNeu)) {
    if (!refForm(r) || !isoOk(altNeu[r])) continue;
    if (refsJetzt.indexOf(r) >= 0) { if (frisch(altNeu[r]) || schuetzt(r, iso(altNeu[r]))) neuAngelegt[r] = altNeu[r]; }
    else weg[r] = jetztIso;   // der neu angelegte Branch ist wieder weg — kommt er ein drittes Mal, ist er wieder neu angelegt
  }
  for (const r of Object.keys(altWeg)) if (refForm(r) && isoOk(altWeg[r]) && !weg[r] && (frisch(altWeg[r]) || schuetzt(r, null))) weg[r] = altWeg[r];
  if (alt && Array.isArray(alt.refs)) for (const r of alt.refs) if (refForm(r) && refsJetzt.indexOf(r) < 0 && !weg[r]) weg[r] = jetztIso;
  // In JEDEM Lauf, auch ohne `refs` im Gedaechtnis (Gegenpruefung 5, Skeptiker R5b-waechter-2): eine gesicherte Fassung, die ihr
  // Schreiber zu Hause hatte (heimErst), nicht auf main liegt und deren Branch JETZT fehlt — dann ist dieser Branch weg. Vorher
  // erfuhr nur ein Lauf mit Cache davon (alt.refs); fiel das Loeschen in eine Cache-Luecke, war `weg` leer, und eine spaetere
  // Neuanlage mit einer Faelschung galt als Berichtigung des Schreibers. Was auf main liegt, ist entschieden (main gilt zuerst).
  const mainBlobs = new Set();
  { const ls = gitRoh(wurzel, ['ls-tree', '-r', '-z', 'refs/remotes/' + REMOTE + '/main', '--', ORDNER + '/']); for (const z of (ls || '').split('\0')) { const m = z.match(/^\d+ blob ([0-9a-f]+)\t/); if (m) mainBlobs.add(m[1]); } }
  for (const x of ged.values()) {
    const r = vonRef(x.von), heimGesehen = typeof x.heimErst === 'string' || (x.heimErst === undefined && x.heim === true);
    if (r && refForm(r) && heimGesehen && !x.bewahrt && !gedAufMain(x) && !mainBlobs.has(x.blob) && refsJetzt.indexOf(r) < 0 && !weg[r]) weg[r] = jetztIso;
  }
  for (const r of refsJetzt) if (weg[r]) { neuAngelegt[r] = jetztIso; delete weg[r]; }
  // Ein neu angelegter Ref ist fuer die Fassungen der ids, die schon VOR dem Neuanlegen gesichert waren (oder deren Rueckzug
  // der Waechter sich vorher gemerkt hat), nicht mehr das Zuhause ihres Schreibers: dort gilt nichts als Berichtigung, ein
  // Grabstein dort zieht nichts zurueck, und dort gibt es keine Heim-Zeit. Eine id, die er erst danach zuerst sah, ist dort
  // zu Hause (E6, Gegenpruefung 5).
  const idErst = new Map();
  const frueher = (id, t) => idErst.set(id, Math.min(idErst.has(id) ? idErst.get(id) : Infinity, t));
  for (const x of ged.values()) if (x.id) frueher(x.id, x.erstUnbekannt ? -Infinity : iso(x.erst));
  for (const z of altRz) frueher(z.id, z.seit == null ? -Infinity : iso(z.seit));
  const vorNeuanlage = (id, ref) => neuAngelegt[ref] != null && idErst.has(id) && idErst.get(id) < iso(neuAngelegt[ref]);
  // „Zu Hause" ist ein Schreiber auf main, im Arbeitsbaum des Waechters (= main) oder auf seinem Branch — dort nicht mehr, wenn
  // ihn jemand NEU ANGELEGT hat (Gegenpruefung 4: dessen Fassung hiess „Berichtigung", und der Waechter meldete „Nichts verloren").
  const zuHause = (q, von, id) => q === 'Arbeitsbaum' || istMainRef(q) || (istAutorRef(q, autorZweig({ von })) && !vorNeuanlage(id, q));
  const gs = grabsteine(wurzel, true), grab = gs.ids, grabBlob = gs.blobs;
  // Welche id nennt ein Grabstein je Fassung zu seinem Blob? Ein gemerktes `von` (D5) zaehlt nur, wenn ein Grabstein auf main GENAU
  // diese Fassung DIESER id nennt — sonst machte ein von Hand ins Verzeichnis gelegter Eintrag mit dem Blob irgendeines Grabsteins
  // jede id strittig (die Liste liegt im Arbeitsbaum = main und auf origin/main; grabsteine() liefert nur die Mengen).
  const grabPaar = new Set();
  for (const t of [(() => { try { return fs.readFileSync(path.join(wurzel, GRABSTEINE), 'utf8'); } catch (_) { return null; } })(), gitRoh(wurzel, ['show', 'refs/remotes/' + REMOTE + '/main:' + GRABSTEINE], { GIT_NO_LAZY_FETCH: '1' })]) {
    let l = null; try { l = t == null ? null : JSON.parse(t); } catch (_) {}
    for (const x of Array.isArray(l) ? l : []) if (x && ID_FORM.test(String(x.id)) && /^[0-9a-f]{40}$/.test(String(x.blob)) && grabBlob.has(x.blob)) grabPaar.add(x.id + '\0' + x.blob);
  }
  const grabNennt = (x) => grabPaar.has(x.id + '\0' + x.blob) && !grab.has(x.id);
  // Das frische Verzeichnis fuer brettLesen — in der Form, die verzeichnisPruefen liefert, mit den Feldern aus Gegenpruefung 5:
  // je Blob heimErst/heimNichtVor (ms, null oder undefined = altes Format) und je id die `von` ALLER gesicherten Fassungen
  // (vonsJeId; nicht die bewahrten, nicht die einer id mit Grabstein auf main). Seit Runde 5b (D5) zaehlt auch das `von` einer
  // Fassung, die ein Grabstein JE FASSUNG auf main entfernt hat (auch die gemerkten, altGrabVon): er entscheidet nichts mehr.
  const verzW = gedDa ? { stand: iso(alt.stand), je: new Map(), neuAngelegt: new Map(Object.keys(neuAngelegt).map(r => [r, iso(neuAngelegt[r])])), vonsJeId: new Map() } : null;
  const vonDazu = (id, von) => { if (!verzW.vonsJeId.has(id)) verzW.vonsJeId.set(id, new Set()); verzW.vonsJeId.get(id).add(von); };
  if (verzW) for (const [b, x] of ged) {
    if (!x.erstUnbekannt && typeof x.anspruch === 'string') verzW.je.set(b, { id: x.id, von: x.von, anspruch: x.anspruch, erst: iso(x.erst), nichtVor: iso(x.nichtVor),
      heimErst: x.heimErst === undefined ? undefined : (x.heimErst === null ? null : iso(x.heimErst)), heimNichtVor: x.heimNichtVor === undefined ? undefined : (x.heimNichtVor === null ? null : iso(x.heimNichtVor)) });
    if (!x.bewahrt && x.id && typeof x.von === 'string' && !grab.has(x.id)) vonDazu(x.id, x.von);
  }
  if (verzW) for (const x of altGrabVon) if (grabNennt(x)) vonDazu(x.id, x.von);
  const brett = brettLesen(wurzel, { alleRefs: true, verzeichnis: verzW, jetzt });
  const aus = { baum: null, neu: [], weitere: [], gleich: 0, uebersprungen: [], entfernt: [], nurHier: [], refs: brett.refs, unlesbar: [], verworfen: [],
    strittig: brett.strittig.map(x => x.id), fehlenInSicherung: [], unwiederbringlich: [], neuVerloren: [], unlesbarWeg: [], unlesbarEntfernt: [], uebersprungenWeg: [],
    zurueckgenommen: [], vomSchreiber: [], zurueckgezogenWeg: [], zurueckgezogenWieder: [], abgelaufenWeg: [], umgelegt: [], abgebaut: [], doppelt: [], bewahrt: [], neuAngelegt: Object.keys(neuAngelegt).sort(),
    alarm: [], erstlauf: false, warnung: null };
  if (!brett.gitDa) return Object.assign(aus, { grund: 'git ist nicht verfuegbar' });
  if (!brett.refs) return Object.assign(aus, { grund: 'kein Remote-Ref sichtbar — nichts geholt, nichts gesichert' });
  const echt = (q) => [...q].filter(x => !istSicherungsRef(x));
  // Welche Blobs liegen JETZT auf einem Branch (gueltig, doppelt oder unlesbar)?
  const aufBranch = new Set();
  for (const liste of brett.fassungen.values()) for (const v of liste) if (echt(v.quellen).length) aufBranch.add(v.blob);
  for (const d of brett.doppeltFassungen || []) if (!istSicherungsRef(d.quelle)) aufBranch.add(d.blob);
  for (const u of brett.unlesbarOrte) if (!istSicherungsRef(u.quelle)) aufBranch.add(u.blob);
  // 1. Der bisherige Stand, ueber git gelesen: nur normale Dateien unter den festen Namen, nur gueltige Eintraege.
  //    Was einmal gesichert war (das Gedaechtnis kennt den Blob), entfernt nur ein Grabstein — oder ein Geheimnis.
  //    Was das Gedaechtnis NICHT kennt und auf keinem Branch liegt, hat nicht der Waechter gesichert: es wird verworfen —
  //    vorher galt eine von Hand auf zz-sicherung gelegte gueltige Datei fuer alle Leser und verdraengte das gerettete
  //    Original (Gegenpruefung 4). Ohne Gedaechtnis bleibt, was sich selbst belegt (Name = Kennung des Inhalts), unter
  //    fassungen/ bzw. quarantaene/ — „bewahrt", aber nie unter eintraege/ befoerdert. Und „bewahrt" steht seit Gegenpruefung 5
  //    im Gedaechtnis und im Verzeichnis: vorher galt es nur fuer EINEN Lauf, und der naechste befoerderte die von Hand gelegte,
  //    selbstbelegende Datei unter eintraege/ — als GERETTETER Eintrag im Namen eines anderen. Es endet erst, wenn dieselbe
  //    Fassung beim Schreiber (sein Branch) oder auf main liegt.
  const vorhanden = new Map();   // blob → { id, pfad, prim, e, bewahrt }
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
      if ((pfad === 'README.md' || pfad === VERZEICHNIS) && mode === '100644') continue;   // werden neu geschrieben
      const prim = pfad.match(new RegExp('^' + ORD + '\\/(\\d{4}-\\d{2})\\/([^/]+)$')), weit = pfad.match(new RegExp('^' + FAS + '\\/([^/]+)\\/([0-9a-f]{40})\\.json$')), quar = pfad.match(new RegExp('^' + QUA + '\\/([0-9a-f]{40})\\.json$'));
      const bekannt = typ === 'blob' && gedBekannt.has(blob);
      if (mode !== '100644' || typ !== 'blob' || !(prim || weit || quar || bekannt)) { aus.verworfen.push({ id: null, blob, grund: mode === '120000' ? 'ein Symlink' : (typ !== 'blob' ? 'kein Blob (' + typ + ')' : 'kein Pfad der Sicherung') }); continue; }
      kand.push({ blob, pfad, prim, weit, quar, bekannt });
    }
    const inhalt = blobsLesen(wurzel, kand.map(k => k.blob)), weg0 = [];
    for (const k of kand) {
      const buf = inhalt.get(k.blob), roh = buf == null ? null : buf.toString('utf8');
      const e = roh == null ? null : lies(roh, k.prim ? k.prim[2] : null, 'zz-sicherung', weg0, { ohneName: true });
      const geheim = roh != null && geheimIn(e, roh, k.prim ? k.prim[2] : '');
      if (geheim) { aus.verworfen.push({ id: e ? e.id : null, blob: k.blob, grund: 'sieht aus wie ' + geheim[1] + ' — entfernt' }); continue; }
      const selbstBelegt = buf != null && blobKennung(buf) === k.blob && ((k.weit && k.weit[2] === k.blob) || (k.quar && k.quar[1] === k.blob));
      const nm = k.prim && e ? String(k.prim[2]).match(NAME_FORM) : null;
      const passt = e && (k.prim ? (k.prim[1] === e.id.slice(0, 7) && nm && nm[1] === e.id && nm[2] === e.art) : (k.weit ? (k.weit[1] === e.id && k.weit[2] === k.blob) : false));
      if (gedDa && !k.bekannt && !aufBranch.has(k.blob)) { aus.verworfen.push({ id: e ? e.id : idAusName(path.posix.basename(k.pfad)), blob: k.blob, grund: 'fremd: nicht vom Waechter gesichert und auf keinem Branch (von Hand auf zz-sicherung gelegt?)' }); continue; }
      // Bewahrt: ohne Gedaechtnis unter fassungen/ gefunden — oder vom Gedaechtnis so vermerkt (auch wenn sie jetzt von Hand
      // unter eintraege/ liegt: sonst machte ein Umbenennen sie zur geltenden Fassung).
      const bew = (!gedDa && !k.prim) || (ged.get(k.blob) || {}).bewahrt === true;
      if (passt) { if (!vorhanden.has(k.blob)) vorhanden.set(k.blob, { id: e.id, pfad: k.pfad, prim: !!k.prim, e, bewahrt: bew }); continue; }
      if (k.bekannt && e && blobKennung(buf) === k.blob) { if (!vorhanden.has(k.blob)) { vorhanden.set(k.blob, { id: e.id, pfad: FASSUNGEN + '/' + e.id + '/' + k.blob + '.json', prim: false, e, bewahrt: (ged.get(k.blob) || {}).bewahrt === true }); aus.umgelegt.push({ id: e.id, blob: k.blob, grund: 'lag an einem falschen Platz der Sicherung' }); } continue; }
      if ((k.bekannt || (!gedDa && selbstBelegt)) && roh != null && blobKennung(buf) === k.blob) { const id = (ged.get(k.blob) || {}).id || (e ? e.id : null); quarantaene.set(k.blob, { id }); if (!k.quar) aus.umgelegt.push({ id, blob: k.blob, grund: 'nach den heutigen Leseregeln kein Eintrag mehr — in die Quarantaene' }); else if (!gedDa) aus.bewahrt.push({ id, blob: k.blob }); continue; }
      aus.verworfen.push({ id: e ? e.id : idAusName(path.posix.basename(k.pfad)), blob: k.blob, grund: 'kein gueltiger Eintrag unter diesem Namen' });
    }
  }
  const idsVorher = new Set([...vorhanden.values()].map(v => v.id));
  // 2. Jede Fassung jedes Branches (und des Arbeitsbaums) — die Sicherung selbst zaehlt nicht als Quelle.
  const sichere = (id, e, blob, quelle) => {
    if (grab.has(id) || grabBlob.has(blob)) return false;
    const geheim = geheimIn(e, e._roh, e._datei);
    if (geheim) { aus.uebersprungen.push({ id, quelle, blob, von: e.von, grund: 'sieht aus wie ' + geheim[1] }); return false; }
    if (vorhanden.has(blob)) { aus.gleich++; return true; }
    if (gitRoh(wurzel, ['cat-file', '-e', blob]) == null) {
      const b = gitRoh(wurzel, ['hash-object', '-w', '--stdin'], null, Buffer.from(e._roh, 'utf8'));
      if (!b || b.trim() !== blob) { aus.uebersprungen.push({ id, quelle, blob, von: e.von, grund: 'Inhalt nicht in die Objekt-Datenbank zu schreiben' }); return false; }
    }
    vorhanden.set(blob, { id, pfad: FASSUNGEN + '/' + id + '/' + blob + '.json', prim: false, e, bewahrt: false });
    (idsVorher.has(id) ? aus.weitere : aus.neu).push({ id, quelle });
    return true;
  };
  for (const [id, liste] of brett.fassungen) for (const v of liste) { const q = echt(v.quellen); if (q.length) sichere(id, v.e, v.blob, q[0]); }
  for (const d of brett.doppeltFassungen || []) if (!istSicherungsRef(d.quelle) && sichere(d.id, d.e, d.blob, d.quelle)) aus.doppelt.push({ id: d.id, quelle: d.quelle });
  // 3. Grabsteine: jede Fassung der id (bzw. genau die genannte Fassung) geht — aus dem neuen Stand, und damit aus dem Branch.
  const entferntBlobs = new Set();
  // Eine Fassung, die ein Grabstein JE FASSUNG (nicht die ganze id) entfernt, geht aus der Sicherung — ihr `von` aber bleibt im
  // Gedaechtnis und im Verzeichnis (grabVon, D5): ein solcher Grabstein entscheidet einen strittigen Eintrag nicht mehr. Vorher
  // machte er die uebrige Fassung zur einzigen — traf er das ORIGINAL, galt die Faelschung (Gegenpruefung 5, R5-fassungen-5).
  const grabVonJetzt = [];
  for (const [b, v] of [...vorhanden]) if (grab.has(v.id) || grabBlob.has(b)) {
    if (grabNennt({ id: v.id, blob: b }) && typeof v.e.von === 'string') grabVonJetzt.push({ id: v.id, blob: b, von: v.e.von, art: typeof v.e.art === 'string' ? v.e.art : null, bis: typeof v.e.bis === 'string' ? v.e.bis : null });
    vorhanden.delete(b); entferntBlobs.add(b); if (aus.entfernt.indexOf(v.id) < 0) aus.entfernt.push(v.id);
  }
  for (const b of [...quarantaene.keys()]) { const q = quarantaene.get(b); if ((q.id && grab.has(q.id)) || grabBlob.has(b)) { quarantaene.delete(b); entferntBlobs.add(b); } }
  // 5. Wo liegt jede Fassung JETZT (ohne die Sicherung)?
  const blobQuellen = new Map();
  for (const liste of brett.fassungen.values()) for (const v of liste) blobQuellen.set(v.blob, echt(v.quellen));
  for (const d of brett.doppeltFassungen || []) if (!istSicherungsRef(d.quelle)) blobQuellen.set(d.blob, (blobQuellen.get(d.blob) || []).concat([d.quelle]));
  // Eine bewahrte Fassung, die jetzt beim Schreiber oder auf main liegt, ist belegt.
  for (const [b, v] of vorhanden) if (v.bewahrt && (blobQuellen.get(b) || []).some(q => zuHause(q, v.e.von, v.id))) v.bewahrt = false;
  const erstVon = (b) => { const g0 = ged.get(b); return g0 && !g0.erstUnbekannt ? g0.erst : (g0 ? null : jetztIso); };
  const heimJe = (b, v) => { const g0 = ged.get(b) || {}; return !!g0.heim || (Array.isArray(g0.orte) ? g0.orte : []).some(q => zuHause(q, v.e.von, v.id)) || (blobQuellen.get(b) || []).some(q => zuHause(q, v.e.von, v.id)); };
  // Die HEIM-Zeiten je Fassung (fuer die Ankunft, die Leser rechnen — E4): wann der Waechter diesen Blob zuerst auf einem Ref sah,
  // der fuer sein `von` zu Hause ist (heimErst), und wann zuletzt noch nicht (heimNichtVor: der Lauf davor; null, wenn
  // unbekannt). Vorher kannte das Verzeichnis keinen Ort: eine Fassung, die vor Stunden auf einem Neben-Branch lag (dort
  // unwirksam), machte dieselben Bytes auf dem Branch des Schreibers „frueh angekommen" (Gegenpruefung 5). Einmal gesetzt,
  // bleibt heimErst. Ein Gedaechtnis ohne das Feld (altes Format): ob und wann sie zu Hause war, ist unbekannt (heimNichtVor null).
  const heimZeiten = new Map();
  const heimZeit = (b, v) => {
    if (heimZeiten.has(b)) return heimZeiten.get(b);
    const g0 = ged.get(b), jetztHeim = (blobQuellen.get(b) || []).some(q => zuHause(q, v.e.von, v.id));
    let z;
    if (g0 && g0.heimErst != null) z = { heimErst: g0.heimErst, heimNichtVor: g0.heimNichtVor != null ? g0.heimNichtVor : null };
    else if (g0 && g0.heimErst === undefined && (g0.heim || jetztHeim)) z = { heimErst: (!g0.erstUnbekannt && isoOk(g0.erst)) ? g0.erst : jetztIso, heimNichtVor: null };
    else if (jetztHeim) z = { heimErst: jetztIso, heimNichtVor: altLauf };
    else z = { heimErst: null, heimNichtVor: null };
    heimZeiten.set(b, z);
    return z;
  };
  // Wann lag diese Fassung ZULETZT zu Hause (Gegenpruefung 5b, Skeptiker R5c-W4, Entscheidung F3)? Unter den Heim-Fassungen desselben
  // `von` gilt die, die der Schreiber zuletzt zu Hause hatte — vorher die frueheste: nach einem Strittig, dem Rueckzug der Faelschung
  // und dem Loeschen beider Branches stand seine ERSTE Fassung unter eintraege/, die Berichtigung nur unter fassungen/ (das kein Leser
  // liest). Die erste Heim-Sichtung (heimErst) allein reicht nicht: setzt der Schreiber per Force-Push auf B1 zurueck, waere B2 die
  // juengere. Jetzt (zu Hause) → dieser Lauf; sonst das Gedaechtnis (je Lauf nachgefuehrt). Ohne Cache das Verzeichnis: dort steht
  // die Zeit nur fuer eine Fassung, die NICHT mehr zu Hause ist (sonst aenderte es sich in jedem Lauf); fehlt sie bei einer, die zu
  // Hause gesehen war, lag sie beim Stand des Verzeichnisses dort. Ein Gedaechtnis im alten Format: lag sie im letzten Lauf zu Hause,
  // dessen Zeit — sonst die erste Heim-Sichtung (eine untere Schranke). Nie zu Hause: null.
  const heimZuletztJe = new Map();
  const heimZuletzt = (b, v) => {
    if (heimZuletztJe.has(b)) return heimZuletztJe.get(b);
    const g0 = ged.get(b), h = heimZeit(b, v).heimErst;
    let z = null;
    if ((blobQuellen.get(b) || []).some(q => zuHause(q, v.e.von, v.id))) z = jetztIso;
    else if (g0 && isoOk(g0.heimZuletzt)) z = g0.heimZuletzt;
    else if (g0 && h != null && ausVerzeichnis) z = isoOk(alt.stand) ? alt.stand : h;
    else if (g0 && h != null && altLauf && (Array.isArray(g0.orte) ? g0.orte : []).some(q => zuHause(q, g0.von, g0.id))) z = altLauf;
    else if (h != null) z = h;
    heimZuletztJe.set(b, z);
    return z;
  };
  // 6a. Rueckzuege des Schreibers (Grabstein auf SEINEM Branch, je id oder je Fassung): festgehalten im Gedaechtnis UND im
  //     Verzeichnis (vorher nur im Cache — ging er verloren, stand ein zurueckgezogener Eintrag fuer immer als „GERETTET" da,
  //     Gegenpruefung 5). Ist sein Branch danach weg (oder neu angelegt), bleibt der Rueckzug — die Fassung wird aus der
  //     Sicherung genommen, statt gerettet (vorher: ALARM, und `ernten` holte sie zurueck, Gegenpruefung 4). Liegt der Grabstein
  //     dort nicht mehr, der Branch aber schon (und er ist sein Zuhause), hat der Schreiber ihn zurueckgenommen.
  //     Je FASSUNG und je `von` (zurueckgezogenVomSchreiber): bei einem strittigen Eintrag zieht der Grabstein des einen
  //     Schreibers nie die Fassung des anderen zurueck (Gegenpruefung 5).
  // Dazu jede nie gesicherte Fassung (Geheimnis-Muster) — auch die des letzten Laufs, die jetzt fehlt: ihr Rueckzug ist
  // ebenso einer (vorher ALARM „nie gesicherte Fassung verschwunden", obwohl der Schreiber getan hatte, was die README sagt).
  const liste4 = [...vorhanden].map(([b, v]) => ({ id: v.id, von: v.e.von, blob: b })).concat(aus.uebersprungen.map(x => ({ id: x.id, von: x.von, blob: x.blob })))
    .concat((alt && Array.isArray(alt.uebersprungen) ? alt.uebersprungen : []).filter(x => x && x.id && x.blob).map(x => ({ id: x.id, von: x.von, blob: x.blob })));
  const vomSchreiber = zurueckgezogenVomSchreiber(wurzel, liste4, { zuHause: (ref, id) => !vorNeuanlage(id, ref) });
  const rueckzuege = [];
  const gleicherRz = (a, b) => a.id === b.id && (a.blob || null) === (b.blob || null) && a.von === b.von;
  const merk = (r) => { if (!rueckzuege.some(y => gleicherRz(y, r))) rueckzuege.push(r); };
  for (const x of liste4) {
    if (typeof x.von !== 'string') continue;
    const r1 = (vomSchreiber.jeVon.get(x.id) || new Map()).get(x.von), r2 = vomSchreiber.blobs.get(x.blob);
    if (!r1 && !r2) continue;
    const r = { id: x.id, blob: r1 ? null : x.blob, von: x.von, ref: r1 || r2 };
    const vorher = altRz.find(y => gleicherRz(y, r) && y.ref === r.ref);
    merk(Object.assign(r, { seit: vorher && vorher.seit ? vorher.seit : jetztIso }));
  }
  // Ein gemerkter Rueckzug bleibt, solange sein Branch nicht wieder sein Zuhause ist — und solange von dieser id dieses
  // Schreibers etwas gesichert ist oder auf einem Branch liegt, sonst SICHERUNG_RUECKZUG_TAGE ab seinem ersten Auftreten.
  const lebtNoch = (id, von) => [...vorhanden.values()].some(v => v.id === id && v.e.von === von) || [...(brett.fassungen.get(id) || [])].some(v => v.e.von === von && echt(v.quellen).length);
  // Liegt eine Fassung dieses Schreibers (id, von) JETZT auf GENAU dem Ref, den der Rueckzug nennt? Dann belegt ein Rueckzug, den
  // nur das Verzeichnis kennt (Lauf ohne Cache), nichts: das Verzeichnis liegt in zz-sicherung, und wer dort schreiben kann, legte
  // mit einem Rueckzug plus einem `weg` auf denselben Ref (dann „neu angelegt") die spaetere stille Entnahme einer Fassung an, die
  // beim Einlesen dort lag (Gegenpruefung 5, Skeptiker R5b-waechter-1). Ein solcher Rueckzug heisst „unbelegt": genannt, nie benutzt.
  // Nur DIESER Ref (Gegenpruefung 5b, Skeptiker R5c-W1, Entscheidung F2): vorher genuegte eine Fassung auf IRGENDEINEM Branch — eine
  // byte-gleiche Kopie auf einem dritten Branch (abgezweigt, `ernten`) machte einen EHRLICHEN Rueckzug in einer Cache-Luecke
  // „unbelegt", er fiel aus dem Verzeichnis, und nach dem Loeschen der Kopie stand der zurueckgezogene Eintrag als ALARM, KRITISCH
  // und GERETTET bei jedem Leser. Der Preis (README-Grenze): ein untergeschobener Rueckzug mit dem RICHTIGEN Ref entfernt eine
  // Fassung, die nur noch als Kopie auf einem dritten Branch liegt, nach deren Loeschen ohne ALARM.
  const aufDemRef = (id, von, ref) => [...(brett.fassungen.get(id) || [])].some(v => v.e.von === von && echt(v.quellen).indexOf(ref) >= 0)
    || (brett.doppeltFassungen || []).some(d => d.id === id && d.e && d.e.von === von && d.quelle === ref);
  aus.rueckzugUnbelegt = [];
  for (const x of altRz) {
    if (refsJetzt.indexOf(x.ref) >= 0 && !vorNeuanlage(x.id, x.ref)) continue;   // sein Branch ist zu Hause: dort steht, was jetzt gilt
    if (ausVerzeichnis && aufDemRef(x.id, x.von, x.ref)) { if (!rueckzuege.some(y => gleicherRz(y, x))) aus.rueckzugUnbelegt.push({ id: x.id, ref: x.ref }); continue; }
    if (lebtNoch(x.id, x.von) || (x.seit != null && jetzt - iso(x.seit) <= SICHERUNG_RUECKZUG_TAGE * 864e5)) merk(x);
  }
  // Ein Rueckzug gilt nur fuer den Ref, den sein `von` nennt (R5b-waechter-1) — auch hier, nicht nur beim Einlesen.
  const zurueck = (id, blob, von) => rueckzuege.find(r => r.id === id && (r.blob == null || r.blob === blob) && r.von === von && istAutorRef(r.ref, autorZweig({ von }))) || null;
  const rzLebt = (rz) => refsJetzt.indexOf(rz.ref) >= 0 && !vorNeuanlage(rz.id, rz.ref);   // sein Branch besteht und ist zu Hause
  for (const [b, v] of vorhanden) { const q = blobQuellen.get(b) || [], rz = q.length ? zurueck(v.id, b, v.e.von) : null; if (rz && !rzLebt(rz)) aus.zurueckgezogenWieder.push({ id: v.id, quelle: q[0] }); }
  // 6b. Was liegt NUR noch hier? Je FASSUNG: verloren ist sie nicht, wenn sie auf einem Branch liegt — oder wenn der
  //     SCHREIBER (dasselbe `von`) seinen Eintrag zu Hause hat. Lag sie selbst zu Hause (das Gedaechtnis haelt es fest, nicht
  //     nur fuer einen Lauf) und ist sie NEUER als alles, was dort jetzt liegt, hat der Schreiber zurueckgenommen (oder ein
  //     Force-Push hat zurueckgesetzt): genannt in JEDEM Lauf und nie abgebaut — vorher erschien „Zurueckgenommen?" einmal,
  //     danach „Nichts verloren", und nach 30 Tagen war die einzige Kopie weg (Gegenpruefung 4). Eine ABGELAUFENE Lage oder
  //     ein abgelaufener Halt ist kein Verlust: sie wirken nicht mehr (vorher: ALARM und dauerhaft „GERETTET"). Eine bewahrte
  //     Fassung ist keinem Schreiber zuzuordnen: genannt als bewahrt, nicht als Verlust.
  for (const [b, v] of [...vorhanden]) {
    if ((blobQuellen.get(b) || []).length) continue;
    const rz = zurueck(v.id, b, v.e.von);
    if (rz) {
      if (rzLebt(rz)) { if (!aus.vomSchreiber.some(x => x.id === v.id)) aus.vomSchreiber.push({ id: v.id, quelle: rz.ref }); }
      else { vorhanden.delete(b); entferntBlobs.add(b); aus.zurueckgezogenWeg.push({ id: v.id, quelle: rz.ref }); }
      continue;
    }
    if ((v.e.art === 'lage' || v.e.art === 'halt') && !(Date.parse(String(v.e.bis || '')) > jetzt)) { aus.abgelaufenWeg.push({ id: v.id, blob: b }); continue; }
    if (v.bewahrt) continue;
    const heim = [...vorhanden].filter(([b2, v2]) => b2 !== b && v2.id === v.id && v2.e.von === v.e.von && (blobQuellen.get(b2) || []).some(q => zuHause(q, v.e.von, v.id))).map(([b2]) => b2);
    if (!heim.length) { aus.nurHier.push({ id: v.id, blob: b }); continue; }
    const e0 = erstVon(b);
    if (heimJe(b, v) && (e0 == null || heim.every(h => erstVon(h) != null && erstVon(h) < e0))) aus.zurueckgenommen.push({ id: v.id, blob: b });
  }
  // 4. Unter eintraege/ liegt je id die Fassung, die GILT — nach EINER Regel (E2, Gegenpruefung 5):
  //    - liegt eine Fassung auf main, sie (main ist entschieden);
  //    - sonst bleibt, was schon unter eintraege/ liegt; ersetzt wird es nur durch eine Fassung DESSELBEN `von` von ihrem
  //      Zuhause (brettLesen: die, die gilt);
  //    - sonst wird befoerdert, nur wenn ALLE gesicherten Fassungen dasselbe `von` tragen (die, die gilt — sonst, nur mit
  //      Gedaechtnis, die frueheste). Tragen sie verschiedene, keine: vorher genuegte, dass brettLesen eine Fassung „gelten"
  //      liess — nach dem Loeschen NUR des Original-Branches war das die Faelschung, und sie stand fuer immer unter eintraege/.
  //    Eine bewahrte Fassung wird nie befoerdert und zaehlt fuer „dasselbe `von`" nicht mit (sie ist keinem zuzuordnen).
  //    Befoerdert wird seit Runde 5b nur eine Fassung, die ZU HAUSE war (Skeptiker R5b-waechter-0): auf main, jetzt auf dem Branch
  //    ihres Schreibers (nicht neu angelegt) oder dort einmal gesehen (heimErst). Vorher genuegte „alle tragen dasselbe `von`":
  //    der Faelscher tauschte seine Kopie auf das `von` des Opfers, legte sie auf einen DRITTEN (oder den neu angelegten) Branch und
  //    zog seine erste Faelschung zurueck — unter eintraege/ stand dann die Faelschung im Namen des Schreibers, und das Original lag
  //    nur unter fassungen/, das kein Leser liest. Ist von dieser id KEINE Fassung je zu Hause gewesen (ein `von` ohne Branch wie
  //    runde/… oder eine Rolle, oder ein Branch, der sie nie trug), gilt die frueheste Sichtung: sonst laege ein ehrlicher Eintrag
  //    der Austausch-Runde nach dem Loeschen seines Branches nur unter fassungen/ — fuer Leser verloren (Schutzziel 1).
  //    Und das `von` einer Fassung, die ein Grabstein JE FASSUNG auf main entfernt hat, zaehlt fuer „dasselbe `von`" weiter (D5).
  const jeId = new Map();
  for (const [b, v] of vorhanden) { if (!jeId.has(v.id)) jeId.set(v.id, []); jeId.get(v.id).push(b); }
  const aufMain = (b) => (blobQuellen.get(b) || []).some(q => istMainRef(q) || q === 'Arbeitsbaum');
  const warHeim = (b) => { const v = vorhanden.get(b); return aufMain(b) || (blobQuellen.get(b) || []).some(q => zuHause(q, v.e.von, v.id)) || heimZeit(b, v).heimErst != null; };
  const frueheste = (l) => l.slice().sort((x, y) => String(erstVon(x) || '9').localeCompare(String(erstVon(y) || '9')) || x.localeCompare(y))[0] || null;
  // Unter den Heim-Fassungen die zuletzt zu Hause gesehene (R5c-W4, F3); bei gleicher Zeit die frueheste (wie vorher).
  const hzMs = (b) => { const t = iso(heimZuletzt(b, vorhanden.get(b))); return t == null ? -Infinity : t; };
  const zuletztHeim = (l) => { if (!l.length) return null; const m = Math.max(...l.map(hzMs)); return frueheste(l.filter(b => hzMs(b) === m)); };
  // Die `von` je id, die ein Grabstein je Fassung auf main entfernt hat: gemerkt (solange der Grabstein dort liegt), in diesem
  // Lauf entfernt, und was brettLesen auf einem Branch als entfernt sah.
  const grabVonKand = altGrabVon.filter(grabNennt).concat(grabVonJetzt);
  const grabVons = (id) => new Set(grabVonKand.filter(x => x.id === id).map(x => x.von).concat([...((brett.entferntVon && brett.entferntVon.get(id)) || [])]));
  for (const [id, blobs] of jeId) {
    const g = brett.gilt.get(id), vonB = (b) => vorhanden.get(b).e.von;
    const zaehlt = blobs.filter(b => !vorhanden.get(b).bewahrt);
    const gB = g && vorhanden.has(g.blob) && !vorhanden.get(g.blob).bewahrt ? g.blob : null;
    const alter = zaehlt.find(b => vorhanden.get(b).prim) || null;
    const einig = new Set(zaehlt.map(vonB).concat([...grabVons(id)])).size === 1;
    let p = null;
    if (gB && aufMain(gB)) p = gB;
    else if (zaehlt.some(aufMain)) p = zaehlt.find(aufMain);
    else if (alter) { p = alter; if (gB && gB !== alter && vonB(gB) === vonB(alter) && (blobQuellen.get(gB) || []).some(q => zuHause(q, vonB(gB), id))) p = gB; }
    else if (einig && !brett.strittig.some(x => x.id === id)) {
      const heim = zaehlt.filter(warHeim);
      if (heim.length) p = gB && heim.indexOf(gB) >= 0 ? gB : (gedDa ? zuletztHeim(heim) : null);
      else p = gedDa ? frueheste(zaehlt) : (zaehlt.length === 1 ? zaehlt[0] : null);
    }
    if (!p && !einig && zaehlt.length && aus.strittig.indexOf(id) < 0) aus.strittig.push(id);
    for (const b of blobs) {
      const v = vorhanden.get(b);
      if (b === p) { const name = (g && g.blob === b && g.e._datei) || (v.prim ? path.posix.basename(v.pfad) : v.e._datei) || (v.e.id + '-' + v.e.art + '-.json'); v.pfad = ORDNER + '/' + id.slice(0, 7) + '/' + name; v.prim = true; }
      else { v.pfad = FASSUNGEN + '/' + id + '/' + b + '.json'; v.prim = false; }
    }
  }
  // 7. Abbau, nach SICHERUNG_ABBAU_TAGE auf keinem Branch: eine ABGELOESTE Fassung (es gibt eine NEUERE zu Hause) eines
  //    Eintrags auf main — nie eine neuere als die zu Hause; und eine abgelaufene Lage/ein abgelaufener Halt, auch ohne main.
  const mainIds = new Set();
  for (const [id, liste] of brett.fassungen) if (liste.some(v => [...v.quellen].some(q => istMainRef(q) || q === 'Arbeitsbaum'))) mainIds.add(id);
  const nurHierB = new Set(aus.nurHier.map(x => x.blob)), zurueckB = new Set(aus.zurueckgenommen.map(x => x.blob)), abgelaufenB = new Set(aus.abgelaufenWeg.map(x => x.blob));
  // Eine Kopie, die nie beim Schreiber lag, ist abgeloest, sobald der Eintrag auf main liegt; eine Fassung, die beim
  // Schreiber lag, nur, wenn dort eine NEUERE liegt (sonst ist sie die Berichtigung, die er zurueckgenommen hat).
  const abgeloest = (id, b, von, heim, e0) => mainIds.has(id) && (!heim || (e0 != null && [...vorhanden].some(([b2, v2]) => b2 !== b && v2.id === id && erstVon(b2) != null && erstVon(b2) > e0 && (blobQuellen.get(b2) || []).some(q => zuHause(q, v2.e.von, v2.id)))));
  for (const [b, v] of [...vorhanden]) {
    if (v.prim || nurHierB.has(b) || zurueckB.has(b) || (blobQuellen.get(b) || []).length) continue;
    const z = (ged.get(b) || {}).zuletzt;
    if (!z || !(jetzt - Date.parse(z) > SICHERUNG_ABBAU_TAGE * 864e5)) continue;
    if (abgeloest(v.id, b, v.e.von, heimJe(b, v), erstVon(b)) || abgelaufenB.has(b)) { vorhanden.delete(b); entferntBlobs.add(b); aus.abgebaut.push({ id: v.id, blob: b }); }
  }
  for (const [b, v] of vorhanden) if (v.bewahrt) aus.bewahrt.push({ id: v.id, blob: b });
  // Die `von` entfernter Fassungen (D5) bleiben, solange sie etwas entscheiden koennen: ihr Grabstein liegt noch auf main, die id
  // hat keinen Grabstein und keine Fassung auf main (dann ist entschieden), von ihr ist noch etwas gesichert oder auf einem Branch,
  // und eine Lage bzw. ein Halt ist nicht abgelaufen (Strittig endet mit dem Ablauf).
  const idLebt = (id) => [...vorhanden.values()].some(v => v.id === id) || brett.fassungen.has(id);
  const grabVonNeu = [];
  for (const x of grabVonKand) {
    if (grabVonNeu.some(y => y.blob === x.blob) || mainIds.has(x.id) || !idLebt(x.id)) continue;
    if ((x.art === 'lage' || x.art === 'halt') && !(Date.parse(String(x.bis || '')) > jetzt)) continue;
    grabVonNeu.push(x);
  }
  grabVonNeu.sort((x, y) => x.id.localeCompare(y.id) || x.blob.localeCompare(y.blob));
  // 8. Unlesbare Dateien: genannt (Quelle, id aus dem Namen, Blob — nie der Dateiname: er traegt den Titel), ins Gedaechtnis.
  //    Im Arbeitsbaum des Waechters liegt main: eine Datei, die auch auf origin/main liegt, steht nur einmal da.
  const gueltigeOrte = new Set();
  for (const liste of brett.fassungen.values()) for (const v of liste) for (const [q, p] of v.pfade) gueltigeOrte.add(ortKennung(q, p));
  const mainUnlesbar = new Set(brett.unlesbarOrte.filter(u => istMainRef(u.quelle)).map(u => u.blob + '\0' + u.pfad));
  for (const u of brett.unlesbarOrte) if (!istSicherungsRef(u.quelle)) {
    if (u.quelle === 'Arbeitsbaum' && mainUnlesbar.has(u.blob + '\0' + u.pfad)) continue;
    const id = idAusName(path.posix.basename(u.pfad));
    if (id && grab.has(id)) continue;
    aus.unlesbar.push({ quelle: u.quelle, id, blob: u.blob, ort: ortKennung(u.quelle, u.pfad) });
  }
  // 9. Der neue Stand: ein leerer Index, README, das Verzeichnis, die Fassungen und die Quarantaene.
  //    Das VERZEICHNIS traegt je Fassung id, `von`, Anspruch, erst und nichtVor (wann der Waechter sie zuerst sah, wann zuletzt
  //    noch nicht), heimErst und heimNichtVor (dasselbe beim Schreiber), heim und bewahrt — fuer jeden Leser die Ankunftszeit,
  //    die kein Schreiber setzt (brettLesen); dazu die neu angelegten und die verschwundenen Branches, die Quarantaene und die
  //    gemerkten Rueckzuege (je id, Blob, `von`, Ref, seit — kein Titel). Was ein Lauf mit Absicht entfernt hat, steht NICHT
  //    mehr darin (nur im Gedaechtnis): wer zz-sicherung von Hand aendern kann, schaltete sonst mit diesem Feld die
  //    Ruecksetz-Erkennung ab (Gegenpruefung 5). Sein `stand` aendert sich nur mit dem Inhalt: sonst gaebe es jede Stunde einen
  //    neuen Baum.
  // Eine unbekannte erste Sichtung bekommt EINMAL einen festen Ersatz (erstUnbekannt bleibt gesetzt, nichtVor null): sonst
  // aenderte sich das Verzeichnis in jedem Lauf.
  const erstFest = (g0) => g0 ? (g0.erstUnbekannt ? (iso(g0.erst) != null ? g0.erst : jetztIso) : g0.erst) : jetztIso;
  const nichtVorVon = (g0) => g0 ? (g0.erstUnbekannt ? null : (g0.nichtVor || null)) : altLauf;
  // Seit Runde 5b (D7) je Fassung auch `art` und `bis` (ISO oder null): ein Leser, der von einem strittigen Eintrag KEINE Fassung
  // lesen kann (alle Branches weg, nur unter fassungen/), weiss damit, ob es ein Halt mit laufender Frist sein kann. Dazu die
  // `von` der per Grabstein je Fassung auf main entfernten Fassungen (D5) als `ohneDatei: true` — ohne Anspruch und Zeiten (sie
  // sind keine Ankunft), nur fuer die Frage, wer diese id schrieb.
  // Seit Runde 5c (R5c-W4) `heimZuletzt` — nur fuer eine Fassung, die zu Hause war und es JETZT nicht ist (eine feste Zeit; eine, die
  // zu Hause liegt, laege sonst in jedem Lauf mit neuer Zeit da, und der Stand aenderte sich stuendlich).
  const hzVerz = (blob, v) => { const z = heimZuletzt(blob, v); return z != null && z !== jetztIso ? { heimZuletzt: z } : {}; };
  const fassM = [...vorhanden].map(([blob, v]) => { const g0 = ged.get(blob); return Object.assign({ id: v.id, blob, von: v.e.von, art: v.e.art, bis: typeof v.e.bis === 'string' ? v.e.bis : null, anspruch: anspruchKennung(v.e), erst: erstFest(g0), nichtVor: nichtVorVon(g0), heim: heimJe(blob, v) || undefined }, heimZeit(blob, v), hzVerz(blob, v), v.bewahrt ? { bewahrt: true } : {}); })
    .concat(grabVonNeu.map(x => ({ id: x.id, blob: x.blob, von: x.von, art: x.art, bis: x.bis, heimErst: null, heimNichtVor: null, ohneDatei: true })))
    .sort((x, y) => x.id.localeCompare(y.id) || x.blob.localeCompare(y.blob));
  const rzSortiert = rueckzuege.map(r => ({ id: r.id, blob: r.blob || null, von: r.von, ref: r.ref, seit: r.seit })).sort((x, y) => x.id.localeCompare(y.id) || x.von.localeCompare(y.von) || String(x.blob).localeCompare(String(y.blob)) || x.ref.localeCompare(y.ref));
  const sortiert = (o) => Object.fromEntries(Object.keys(o).sort().map(r => [r, o[r]]));
  const inhaltM = { fassungen: fassM, quarantaene: [...quarantaene.keys()].sort(), neuAngelegt: sortiert(neuAngelegt), weg: sortiert(weg), rueckzuege: rzSortiert };
  const gleichM = altVerz && JSON.stringify({ fassungen: altVerz.fassungen, quarantaene: altVerz.quarantaene, neuAngelegt: altVerz.neuAngelegt, weg: altVerz.weg, rueckzuege: altVerz.rueckzuege }) === JSON.stringify(inhaltM);
  const verzText = JSON.stringify(Object.assign({ stand: gleichM ? altVerz.stand : jetztIso }, inhaltM), null, 1) + '\n';
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brett-sicherung-')), env = { GIT_INDEX_FILE: path.join(tmp, 'index') };
  try {
    const readme = (gitRoh(wurzel, ['hash-object', '-w', '--stdin'], null, Buffer.from(SICHERUNG_README, 'utf8')) || '').trim();
    const verzB = (gitRoh(wurzel, ['hash-object', '-w', '--stdin'], null, Buffer.from(verzText, 'utf8')) || '').trim();
    const zeilen = ['100644 blob ' + readme + '\tREADME.md'].concat([...vorhanden].map(([b, v]) => [b, v.pfad]).concat([...quarantaene.keys()].map(b => [b, QUARANTAENE + '/' + b + '.json'])).concat([[verzB, VERZEICHNIS]])
      .sort((x, y) => x[1] < y[1] ? -1 : 1).map(([b, p]) => '100644 blob ' + b + '\t' + p));
    if (!readme || !verzB || gitRoh(wurzel, ['read-tree', '--empty'], env) == null || gitRoh(wurzel, ['update-index', '--index-info'], env, zeilen.join('\n') + '\n') == null) return Object.assign(aus, { grund: 'der neue Stand liess sich nicht bauen (git update-index)' });
    aus.baum = (gitRoh(wurzel, ['write-tree'], env) || '').trim() || null;
    if (!aus.baum) return Object.assign(aus, { grund: 'der neue Stand liess sich nicht bauen (git write-tree)' });
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} }
  // 10. Das Gedaechtnis: fehlt vor dem Lauf, was zuletzt gesichert war, wurde die Sicherung zurueckgesetzt — AUSSER dieser Lauf
  //     haette die Fassung nach denselben Regeln selbst entfernt (Grabstein auf main; Rueckzug, dessen Branch weg ist; Abbau
  //     nach SICHERUNG_ABBAU_TAGE). Das deckt auch ein veraltetes Gedaechtnis (Ablegen gescheitert): der Lauf dazwischen hat
  //     nach diesen Regeln entfernt. Vorher stand „was ein Lauf mit Absicht entfernt hat" im Verzeichnis IN zz-sicherung — wer
  //     dort eine gerettete Fassung loeschte und ihren Blob in `entfernt` eintrug, bekam keinen ALARM und keine Wiederherstellung
  //     (Gegenpruefung 5). Das Gedaechtnis traegt `entfernt` weiter (zum Nachlesen); gelesen wird es nicht: was ein Lauf entfernt
  //     hat, steht in SEINEM Gedaechtnis gar nicht mehr unter den Fassungen — und ein veraltetes kennt es nicht.
  const ids = (l) => [...new Set(l.map(x => x.id).filter(Boolean))];
  const zurueckBlob = (x) => !!zurueck(x.id, x.blob, x.von) || vomSchreiber.blobs.has(x.blob) || (vomSchreiber.jeVon.get(x.id) || new Map()).has(x.von);
  if (alt && !ausVerzeichnis && Array.isArray(alt.fassungen)) {
    const nachRegeln = (x) => {
      if ((blobQuellen.get(x.blob) || []).length) return false;
      const rz = typeof x.von === 'string' ? zurueck(x.id, x.blob, x.von) : null;
      if (rz && !rzLebt(rz)) return true;
      const g0 = ged.get(x.blob) || x, z = iso(g0.zuletzt);
      if (z == null || !(jetzt - z > SICHERUNG_ABBAU_TAGE * 864e5)) return false;
      if ((g0.art === 'lage' || g0.art === 'halt') && !(Date.parse(String(g0.bis || '')) > jetzt)) return true;
      const heim = !!g0.heim || g0.heimErst != null || (Array.isArray(g0.orte) ? g0.orte : []).some(q => zuHause(q, g0.von, g0.id));
      return abgeloest(g0.id, x.blob, g0.von, heim, g0.erstUnbekannt ? null : (g0.erst || null));
    };
    aus.fehlenInSicherung = alt.fassungen.concat(Array.isArray(alt.quarantaene) ? alt.quarantaene : []).filter(x => x && x.blob && !vorherRoh.has(x.blob) && !grab.has(x.id) && !grabBlob.has(x.blob) && !nachRegeln(x));
    aus.unwiederbringlich = aus.fehlenInSicherung.filter(x => !vorhanden.has(x.blob) && !quarantaene.has(x.blob));
    const vorherNur = new Set(Array.isArray(alt.nurHier) ? alt.nurHier : []);
    aus.neuVerloren = aus.nurHier.filter(x => !vorherNur.has(x.blob));
    // Eine unlesbare Datei verschwindet: am selben Ort liegt jetzt ein gueltiger Eintrag → repariert (still); ihr Branch
    // besteht noch → vom Schreiber entfernt (ein Hinweis); ihr Branch ist weg und ihr Blob nirgends mehr → ALARM. Verglichen
    // wird je BLOB (vorher je Blob UND Ort: ein umbenannter Branch oder eine Kopie auf einem zweiten Branch hiess „verschwunden"),
    // und der Arbeitsbaum des Waechters (main) besteht immer (Gegenpruefung 4). Ein Blob in der Quarantaene ist gesichert.
    const jetztU = new Set(aus.unlesbar.map(u => u.blob)), refsAlle = new Set(refsJetzt.concat(['Arbeitsbaum']));
    for (const u0 of Array.isArray(alt.unlesbar) ? alt.unlesbar : []) {
      if (!u0) continue;
      const u = Object.assign({}, u0, { ort: u0.ort || (u0.pfad ? ortKennung(u0.quelle, u0.pfad) : null) });
      if (jetztU.has(u.blob) || blobQuellen.has(u.blob) || quarantaene.has(u.blob) || (u.id && grab.has(u.id)) || (u.ort && gueltigeOrte.has(u.ort))) continue;
      if (refsAlle.has(u.quelle) || (u.id && brett.fassungen.has(u.id))) aus.unlesbarEntfernt.push(u); else aus.unlesbarWeg.push(u);
    }
    // Eine Fassung, die wegen eines Geheimnis-Musters NIE gesichert wurde, verschwindet — und der Schreiber hat nichts zu Hause
    // und hat sie nicht zurueckgezogen (vorher: ALARM auch nach einem Rueckzug, wie ihn die README verlangt, Gegenpruefung 4).
    const jetztS = new Set(aus.uebersprungen.map(x => x.blob));
    for (const x of Array.isArray(alt.uebersprungen) ? alt.uebersprungen : []) {
      if (!x || jetztS.has(x.blob) || blobQuellen.has(x.blob) || grab.has(x.id) || grabBlob.has(x.blob) || zurueckBlob(x)) continue;
      const heim = [...brett.fassungen.get(x.id) || []].some(v => v.e.von === x.von && echt(v.quellen).some(q => zuHause(q, x.von, x.id)));
      if (!heim) aus.uebersprungenWeg.push(x);
    }
    // Ist das Verzeichnis juenger als das Gedaechtnis, konnte ein Lauf sein Gedaechtnis nicht ablegen — oder zz-sicherung
    // wurde von Hand geschrieben. Lieber ein Fehlalarm mit diesem Hinweis als Stille.
    const veraltet = altVerz && iso(altVerz.stand) != null && iso(alt.stand) != null && iso(altVerz.stand) > iso(alt.stand);
    if (aus.fehlenInSicherung.length) aus.alarm.push('Die Sicherung wurde zurueckgesetzt oder geloescht: ' + aus.fehlenInSicherung.length + ' gesicherte Fassung(en) fehlten vor diesem Lauf' + (aus.unwiederbringlich.length ? ', davon ' + aus.unwiederbringlich.length + ' auf keinem Branch mehr (verloren): ' + ids(aus.unwiederbringlich).join(', ') : ' (alle wieder gesichert)')
      + (veraltet ? ' — das Gedaechtnis ist aelter als der letzte Stand der Sicherung: konnte ein Lauf es nicht ablegen, ist das womoeglich ein Fehlalarm; sonst wurde zz-sicherung von Hand geaendert. Pruefen.' : ''));
    if (aus.neuVerloren.length) {
      const neuB = [...new Set(aus.neuVerloren.map(x => { const v = vorhanden.get(x.blob); const r = v ? vonRef(v.e.von) : null; return r && neuAngelegt[r] && vorNeuanlage(v.id, r) ? r : null; }).filter(Boolean))];
      aus.alarm.push('Ein Branch wurde geloescht oder zurueckgesetzt: ' + aus.neuVerloren.length + ' Fassung(en) liegen nur noch in der Sicherung: ' + ids(aus.neuVerloren).join(', ')
        + (neuB.length ? ' — ' + neuB.join(', ') + ' wurde neu angelegt: was dort liegt, gilt fuer diese Eintraege nicht als Berichtigung (der Schreiber schreibt neu)' : ''));
    }
    if (aus.unlesbarWeg.length) aus.alarm.push('Unlesbare Datei(en) mit ihrem Branch verschwunden (nicht gesichert — sie waren keine gueltigen Eintraege): ' + aus.unlesbarWeg.map(u => (u.id || 'ohne id') + ' {' + u.quelle + '} Blob ' + String(u.blob).slice(0, 8)).join(', '));
    if (aus.uebersprungenWeg.length) aus.alarm.push('Nie gesicherte Fassung(en) verschwunden (sie trugen etwas wie ein Geheimnis — pruefen, ob es eine Falschmeldung war): ' + aus.uebersprungenWeg.map(x => x.id + ' {' + x.quelle + '}').join(', '));
  } else if (opts.stand) {
    aus.erstlauf = true;
    if (ausVerzeichnis) aus.warnung = 'Kein Gedaechtnis im Cache — gelesen aus dem Verzeichnis der Sicherung selbst: ob seit dem letzten Lauf etwas verloren ging oder die Sicherung zurueckgesetzt wurde, ist in diesem Lauf nicht erkennbar; ab jetzt wieder.'
      + (aus.rueckzugUnbelegt.length ? ' Nicht uebernommen (unbelegt — eine Fassung dieses Schreibers liegt auf dem Branch, den der Rueckzug nennt, und nur das Verzeichnis nennt ihn): ' + [...new Set(aus.rueckzugUnbelegt.map(x => x.id + ' {' + fremd(x.ref, 120) + '}'))].join(', ') + '.' : '');
    else if (!opts.alt) aus.warnung = 'Weder zz-sicherung noch ein Gedaechtnis — der erste Lauf, ODER beides ging verloren: dann ist nicht erkennbar, was fehlt.';
    else aus.warnung = 'Kein Gedaechtnis (Cache abgelaufen?) und kein lesbares Verzeichnis in der Sicherung — ob seit dem letzten Lauf etwas verloren ging, ist nicht erkennbar; ab jetzt wieder.' + (aus.bewahrt.length ? ' Bewahrt (Name belegt den Inhalt, ohne Gedaechtnis nicht zuzuordnen): ' + aus.bewahrt.length + '.' : '');
  }
  if (opts.stand || opts.standNeu) {
    const ziel = opts.standNeu || (opts.stand + '.neu');
    fs.mkdirSync(path.dirname(path.resolve(ziel)), { recursive: true });
    const fass = [...vorhanden].map(([blob, v]) => {
      const q = blobQuellen.get(blob) || [], g0 = ged.get(blob) || null;
      return Object.assign({ id: v.id, blob, von: v.e.von, anspruch: anspruchKennung(v.e), erst: erstFest(g0), erstUnbekannt: g0 && g0.erstUnbekannt ? true : undefined, nichtVor: nichtVorVon(g0),
        heim: heimJe(blob, v) }, heimZeit(blob, v), { heimZuletzt: heimZuletzt(blob, v) }, v.bewahrt ? { bewahrt: true } : {},
        // Fuer die Abbau-Regel ohne die Datei (ein veraltetes Gedaechtnis rechnet nach, ob ein Abbau gerechtfertigt war): Art und
        // Frist einer Lage bzw. eines Halts — kein Titel, kein Text.
        (v.e.art === 'lage' || v.e.art === 'halt') ? { art: v.e.art, bis: typeof v.e.bis === 'string' ? v.e.bis : null } : {},
        { zuletzt: q.length ? jetztIso : (g0 && g0.zuletzt || jetztIso), orte: q.slice().sort() });
    }).sort((x, y) => x.id.localeCompare(y.id) || x.blob.localeCompare(y.blob));
    fs.writeFileSync(ziel, JSON.stringify({ stand: jetztIso, refs: refsJetzt.slice().sort(), weg: sortiert(weg), neuAngelegt: sortiert(neuAngelegt), fassungen: fass, grabVon: grabVonNeu, nurHier: aus.nurHier.map(x => x.blob).sort(),
      zurueckgezogen: rzSortiert, entfernt: [...entferntBlobs].filter(b => vorherRoh.has(b)).sort(),
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
  // „Die vier Zeichen am Ende genuegen" (finde im Werkzeug): eine neue id bekommt keine Endung, die eine bekannte schon
  // traegt — auch keine einer strittigen, abweichenden, doppelten oder unlesbaren Datei (Gegenpruefung 5: zwei Endungen
  // gleich, `veto <4 Zeichen>` endete mit „nicht eindeutig", und C16 wurde in etwa jedem hundertsten Lauf rot). Was eine
  // andere Sitzung gleichzeitig vergibt, sieht diese Pruefung nicht — dann hilft die volle id.
  const endungen = new Set();
  for (const id of [...belegt, ...brett.fassungen.keys(), ...brett.strittig.map(x => x.id), ...brett.doppelt.map(x => x.id), ...brett.unlesbar.map(u => idAusName(path.posix.basename(String(u.datei || ''))))]) if (id) endungen.add(String(id).slice(-4));
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
      for (let n = 0; n < 50 && !e.id; n++) { const id = (datumGueltig(e.datum) ? e.datum : datum) + '-' + crypto.randomBytes(4).toString('hex'); if (!belegt.has(id) && !endungen.has(id.slice(-4))) e.id = id; }
      belegt.add(e.id); endungen.add(String(e.id).slice(-4));
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
