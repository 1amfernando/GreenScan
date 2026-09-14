// ═══════════════════════════════════════════════════════════════════════════
// quiz_gen_regeln.mjs — die RECHNENDEN Regeln fuer neue Quizfragen.
//
// Warum eine eigene Datei ohne Deno: Deno ist in der Claude-Cloud-Umgebung
// nicht installiert, `knowledge-bulk-gen` laeuft dort nicht. Alles, was sich
// RECHNEN laesst — Struktur einer Frage, Dubletten (auch im eigenen Stapel),
// Kategorie, Vorrat — steht deshalb hier, als reines ESM-Modul, das Deno
// (`knowledge-bulk-gen/index.ts`) UND Node (`scripts/quiz_gen_check.js`)
// importieren. Bauform wie ingest_regeln.mjs / loeschung_regeln.mjs.
//
// Vier Regeln, die hier festgehalten sind und die vorher NIRGENDS standen —
// alle vier am 14.09.2026 nur lesend an der Live-Datenbank gemessen:
//
//   1. Eine Kategorie ist ein EINTRAG im Vokabular, keine Prompt-Zeile.
//      Der Prompt nannte sechs Kategorien, die Tabelle fuehrte 23 in zwei
//      Sprachen, und der Rueckfall-Pool in der App noch einmal 13 eigene —
//      35 verschiedene Slugs fuer dieselbe eine Anzeigezeile, darunter drei
//      Einzahl/Mehrzahl-Paare (pilz/pilze, wildpflanze/wildpflanzen,
//      heilpflanze/heilpflanzen). CLAUDE.md §4a.2: eine Prompt-Zeile ist
//      keine Garantie.
//
//   2. Der Stapel wird gegen SICH SELBST geprueft. Die alte Pruefung baute
//      ihre Menge EINMAL aus der Datenbank und zog sie beim Einfuegen nie
//      nach — zwei gleiche Fragen aus EINER KI-Antwort kamen beide durch.
//      (Die zwei Dubletten im Bestand stammen nicht daher, sondern aus einem
//      Massen-Import vom 29.04.2026 ganz ohne Pruefung. Das Loch hat also noch
//      nie zugeschlagen; es ist trotzdem eines.)
//
//   3. Eine kaputte Zeile verwirft die ZEILE, nie den Lauf. Das Einfuegen ist
//      schon heute Zeile fuer Zeile mit geschlucktem Fehler — richtig so.
//
//   4. Der Vorrat ist eine ZAHL mit drei Zustaenden, nie eine 0 fuer
//      „keine Daten". Gemessen: 215 Fragen, 181 davon im 730-Tage-Fenster
//      noch nie dran; Zulauf 12 Fragen je 35 Tage (die Cron-Rotation
//      `knowledge-growth-daily` hat 35 Themen), Verbrauch 1 je Tag. Bilanz
//      −0,657/Tag → erschoepft in ~275 Tagen. Danach wiederholt
//      `fn_get_daily_quiz` ueber ihren Rueckfall, ohne dass etwas meldet.
// ═══════════════════════════════════════════════════════════════════════════

// ── Vokabular ──────────────────────────────────────────────────────────────
// Zwoelf Kategorien. Die App spiegelt diese Liste in GS_QUIZ_KATEGORIEN /
// GS_QUIZ_KAT_ALIAS; `quiz_gen_check` Fall „Ein Vokabular" haelt beide
// gegeneinander — die Bindung ist der Pruefstand, nicht der gute Wille.
export const QUIZ_KATEGORIEN = [
  'bestimmung', 'giftigkeit', 'kueche', 'heilkunde', 'standort', 'saison',
  'sammeln', 'garten', 'pilze', 'tiere', 'natur', 'wissen',
];

// Jeder der 35 am 14.09.2026 gemessenen Slugs loest hier auf: 23 aus
// `daily_quizzes`, 13 aus GS_QUIZ_FALLBACK_POOL (`garten` in beiden).
// Kanonische Namen stehen NICHT im Alias — `quizKategorie` prueft sie zuerst.
export const QUIZ_KAT_ALIAS = {
  identification: 'bestimmung', species_id: 'bestimmung',
  toxicity: 'giftigkeit', edible_toxic: 'giftigkeit', giftig: 'giftigkeit', sicherheit: 'giftigkeit',
  culinary: 'kueche', essbar: 'kueche',
  medicinal: 'heilkunde', heilpflanzen: 'heilkunde', heilpflanze: 'heilkunde', kraut: 'heilkunde',
  habitat: 'standort', klima: 'standort',
  season: 'saison',
  foraging: 'sammeln', wildpflanzen: 'sammeln', wildpflanze: 'sammeln',
  permakultur: 'garten', mondkalender: 'garten', schaedlinge: 'garten', sortenvielfalt: 'garten',
  pilz: 'pilze',
  bestaeuber: 'tiere', tier: 'tiere',
  biodiversitaet: 'natur', oekologie: 'natur', naturschutz: 'natur', neophyt: 'natur', baum: 'natur',
  general: 'wissen',
  // Aus der bereitliegenden Migration 20260827_quiz_bilder_und_fragen_v30_85.sql
  // (43 Fragen, NICHT angewandt — STATUS fuehrt sie als offen). Eine
  // SQL-Migration geht am Generator vorbei: waeren diese zwoelf nicht hier,
  // haetten 38 der 43 Fragen nach dem Anwenden GAR KEINE Kategoriezeile.
  mushroom_safety: 'pilze', mushroom_id: 'pilze',
  tree_id: 'bestimmung', trees: 'natur',
  wild_herbs: 'sammeln',
  garden_helpers: 'garten', garden_care: 'garten', soil: 'garten',
  ecology: 'natur', safety: 'giftigkeit', birds: 'tiere', alpine: 'standort',
};

export const QUIZ_OPTIONEN = 4;          // genau vier, nicht „mindestens zwei"
// Gemessen: von den 215 Fragen in der Datenbank ist keine kuerzer als 15 —
// die 50 Fragen des Rueckfall-Pools in der App aber schon: „Was ist VAPKO?"
// hat 14 Zeichen. Eine Regel, die den eigenen Bestand abweist, ist zu streng;
// die Grenze liegt deshalb unter dem kuerzesten, was die App selbst ausliefert.
export const QUIZ_FRAGE_MIN = 12;
export const QUIZ_FRAGE_MAX = 200;       // gemessen: 0 von 215 sind laenger
export const QUIZ_OPTION_MAX = 120;
export const QUIZ_ROTATION_THEMEN = 35;  // fn_knowledge_growth_daily: 35 Themen, eines je Tag

/**
 * Kanonische Kategorie oder null. Ein `null` wird NICHT geraten — die Zeile
 * faellt durch, und der Grund steht in der Antwort.
 */
export function quizKategorie(slug) {
  // Umlaute falten. Das Vokabular ist deutsch in ASCII-Umschrift (`kueche`,
  // `bestaeuber`) — ein Modell, das auf Deutsch schreibt, liefert aber
  // natuerlich `küche` und `bestäuber`. Ohne das Falten faellt so eine Zeile
  // durch, und im schlimmsten Fall der GANZE Stapel: der Lauf liefert 0 neue
  // Fragen, waehrend die Antwort `ok: true` meldet. Das alte Vokabular war
  // reines ASCII-Englisch und hatte dieses Risiko nicht — es kommt mit der
  // deutschen Liste herein, also wird es hier abgefangen.
  const s = String(slug == null ? '' : slug).trim().toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  if (!s) return null;
  if (QUIZ_KATEGORIEN.indexOf(s) !== -1) return s;
  return Object.prototype.hasOwnProperty.call(QUIZ_KAT_ALIAS, s) ? QUIZ_KAT_ALIAS[s] : null;
}

/**
 * Schluessel einer Frage fuer den Dublettenvergleich: klein geschrieben,
 * Satzzeichen weg, Leerraum auf eins. Umlaute bleiben — „Holunderbluete" und
 * „Holunderblüte" sind zwei Woerter, nicht eine Schreibvariante.
 */
export function quizNormFrage(s) {
  // NFC zuerst: dieselbe Frage kann als „ä" (ein Zeichen) oder als „a" + 
  // Kombinationszeichen ankommen. Ohne das Zusammenziehen faellt das
  // Kombinationszeichen der Satzzeichen-Regel zum Opfer, aus „Wächst" wird
  // „wa chst", und dieselbe Frage gilt zweimal als neu.
  return String(s == null ? '' : s)
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Prueft eine gemappte Zeile (so, wie sie in `daily_quizzes` ginge).
 * @returns {{ok:true, kategorie:string}|{ok:false, grund:string}}
 */
export function quizFrageValide(row) {
  if (!row || typeof row !== 'object') return { ok: false, grund: 'keine Zeile' };
  const frage = String(row.question == null ? '' : row.question).trim();
  if (!frage) return { ok: false, grund: 'Frage leer' };
  if (frage.length < QUIZ_FRAGE_MIN) return { ok: false, grund: 'Frage zu kurz (' + frage.length + ' < ' + QUIZ_FRAGE_MIN + ')' };
  if (frage.length > QUIZ_FRAGE_MAX) return { ok: false, grund: 'Frage zu lang (' + frage.length + ' > ' + QUIZ_FRAGE_MAX + ')' };

  const o = row.options;
  if (!o || typeof o !== 'object') return { ok: false, grund: 'options fehlt' };
  const liste = Array.isArray(o) ? o : (Array.isArray(o.answers) ? o.answers : (Array.isArray(o.choices) ? o.choices : null));
  if (!liste) return { ok: false, grund: 'options ohne answers/choices' };
  if (liste.length !== QUIZ_OPTIONEN) return { ok: false, grund: 'Optionen: ' + liste.length + ', erwartet ' + QUIZ_OPTIONEN };

  const texte = liste.map(function (x) {
    if (x == null) return '';
    if (typeof x === 'string') return x.trim();
    return String(x.label != null ? x.label : (x.text != null ? x.text : '')).trim();
  });
  if (texte.some(function (t) { return !t; })) return { ok: false, grund: 'leere Option' };
  if (texte.some(function (t) { return t.length > QUIZ_OPTION_MAX; })) return { ok: false, grund: 'Option zu lang' };
  const klein = texte.map(function (t) { return t.toLowerCase(); });
  if (new Set(klein).size !== klein.length) return { ok: false, grund: 'zwei gleiche Optionen' };

  // Die richtige Antwort: entweder ein Index (answers/choices) oder ein
  // is_correct an genau EINER Option (Array-Form). Beide Formen kommen im
  // Bestand vor (150 + 60 gegen 5), also kennt die Pruefung beide.
  //
  // Und die Formen duerfen sich NICHT mischen — das ist keine Pedanterie,
  // sondern das, was die Anzeige kann: `openDailyQuizFromSupa` baut aus einem
  // Index nur dann Optionen, wenn `typeof quiz.options[0] === 'string'`.
  // Sind alle Optionen Objekte, findet sie danach keine richtige Antwort und
  // bricht mit „⚠️ Quiz hat keine richtige Antwort markiert" ab — das
  // Tagesquiz waere an diesem Tag fuer ALLE aus. Ist nur die ERSTE eine
  // Zeichenkette, greift die Umwandlung und die Person waehlt zwischen drei
  // „[object Object]". Beides gemessen (Node + Playwright, 14.09.2026).
  const alleText = liste.every(function (x) { return typeof x === 'string'; });
  const alleObj = liste.every(function (x) { return x && typeof x === 'object' && !Array.isArray(x); });
  if (!alleText && !alleObj) return { ok: false, grund: 'Optionen gemischt (Zeichenketten und Objekte)' };

  if (Array.isArray(o)) {
    if (!alleObj) return { ok: false, grund: 'Array-Form braucht Objekt-Optionen mit is_correct' };
    const n = liste.filter(function (x) { return x && x.is_correct === true; }).length;
    if (n !== 1) return { ok: false, grund: 'is_correct ' + n + '-mal, erwartet genau einmal' };
  } else {
    if (!alleText) return { ok: false, grund: 'Index-Form braucht Zeichenketten-Optionen (die Anzeige wandelt nur Zeichenketten um)' };
    const ci = o.correct;
    if (!Number.isInteger(ci)) return { ok: false, grund: 'correct ist kein ganzzahliger Index' };
    if (ci < 0 || ci >= liste.length) return { ok: false, grund: 'correct ' + ci + ' ausserhalb 0…' + (liste.length - 1) };
  }

  const expl = Array.isArray(o)
    ? (liste.find(function (x) { return x && x.is_correct === true; }) || {}).explanation
    : o.explanation;
  if (!String(expl == null ? '' : expl).trim()) return { ok: false, grund: 'keine Erklaerung' };

  const kat = quizKategorie(row.category);
  if (!kat) return { ok: false, grund: 'Kategorie unbekannt: ' + JSON.stringify(row.category) };

  return { ok: true, kategorie: kat };
}

/**
 * Filtert einen Stapel gemappter Zeilen. `vorhanden` ist ein Set der bereits
 * bekannten normierten Fragen (aus der Datenbank); es WAECHST hier mit, damit
 * zwei gleiche Fragen aus derselben Antwort nicht beide durchkommen.
 *
 * Die Kategorie wird auf die kanonische gesetzt — einheitlich geschrieben ist
 * die Bedingung dafuer, dass die Anzeige sie uebersetzen kann.
 *
 * @returns {{neu:object[], verworfen:{grund:string, frage:string}[]}}
 */
export function quizStapelFiltern(zeilen, vorhanden) {
  const bekannt = vorhanden instanceof Set ? vorhanden : new Set(vorhanden || []);
  const neu = [];
  const verworfen = [];
  for (const row of (Array.isArray(zeilen) ? zeilen : [])) {
    const frage = String((row && row.question) == null ? '' : row.question).trim();
    const v = quizFrageValide(row);
    if (!v.ok) { verworfen.push({ grund: v.grund, frage: frage.slice(0, 80) }); continue; }
    const key = quizNormFrage(frage);
    if (bekannt.has(key)) { verworfen.push({ grund: 'Dublette', frage: frage.slice(0, 80) }); continue; }
    bekannt.add(key);                       // ← Regel 2: der Stapel sieht sich selbst
    neu.push(Object.assign({}, row, { category: v.kategorie }));
  }
  return { neu, verworfen };
}

/**
 * Wie lange reicht der Vorrat? Drei Zustaende, nie eine 0 fuer „keine Daten".
 *
 * @param {object} z  { frei, zulaufProLauf, tageProRotation, verbrauchProTag, heute }
 * @returns {{tage:number|null, erschoepftAm:string|null, bilanzProTag:number|null, grund:string}}
 */
export function quizVorrat(z) {
  const o = z || {};
  const frei = Number.isFinite(o.frei) ? o.frei : null;
  const verbrauch = Number.isFinite(o.verbrauchProTag) ? o.verbrauchProTag : 1;
  if (frei === null) return { tage: null, erschoepftAm: null, bilanzProTag: null, grund: 'Zahl der freien Fragen unbekannt' };
  if (verbrauch <= 0) return { tage: null, erschoepftAm: null, bilanzProTag: null, grund: 'kein Verbrauch angegeben' };

  const zulauf = Number.isFinite(o.zulaufProLauf) ? o.zulaufProLauf : null;
  const rotation = Number.isFinite(o.tageProRotation) ? o.tageProRotation : null;
  if (zulauf === null || rotation === null || rotation <= 0) {
    // Ohne Zulauf laesst sich nur sagen, wie lange es OHNE Nachschub reicht.
    const t = Math.max(0, Math.floor(frei / verbrauch));
    return { tage: t, erschoepftAm: _tagPlus(o.heute, t), bilanzProTag: -verbrauch, grund: 'ohne Nachschub: ' + frei + ' frei bei ' + verbrauch + '/Tag' };
  }

  const bilanz = (zulauf / rotation) - verbrauch;
  if (bilanz >= 0) {
    return { tage: null, erschoepftAm: null, bilanzProTag: bilanz, grund: 'Zulauf deckt den Verbrauch (' + _r(zulauf / rotation) + '/Tag gegen ' + verbrauch + '/Tag)' };
  }
  const tage = Math.max(0, Math.floor(frei / -bilanz));
  return {
    tage,
    erschoepftAm: _tagPlus(o.heute, tage),
    bilanzProTag: bilanz,
    grund: frei + ' frei, ' + _r(bilanz) + '/Tag (' + zulauf + ' je ' + rotation + ' Tage gegen ' + verbrauch + '/Tag)',
  };
}

function _r(n) { return (Math.round(n * 1000) / 1000).toString().replace('.', ','); }
function _tagPlus(heute, tage) {
  // Wirft nie. Das ganze Modul verspricht drei Zustaende und keinen Absturz —
  // und es laeuft in einer Edge-Function, wo eine Ausnahme den ganzen Lauf mit
  // 500 beendet. `toISOString` wirft RangeError, sobald das Datum ausserhalb
  // des darstellbaren Bereichs liegt (bei einem absurd grossen `tage`).
  try {
    if (!heute) return null;
    const d = new Date(String(heute).slice(0, 10) + 'T00:00:00Z');
    if (isNaN(d.getTime())) return null;
    if (!Number.isFinite(tage) || Math.abs(tage) > 3650000) return null;   // ~10'000 Jahre
    d.setUTCDate(d.getUTCDate() + tage);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch (_) { return null; }
}
