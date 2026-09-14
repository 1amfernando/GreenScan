#!/usr/bin/env node
// quiz_gen_check.js — kommt nur eine Frage in die Tabelle, die man auch
// anzeigen kann?
//
//   node scripts/quiz_gen_check.js
//
// Drei Haelften:
//   A) die RECHNUNG (supabase/functions/_shared/quiz_gen_regeln.mjs, Node) —
//      Struktur, Dubletten im eigenen Stapel, Kategorie, Vorrat;
//   B) das VOKABULAR ueber die Naht: das Modul und die App (index.html)
//      muessen dieselben Kategorien kennen — sonst zeigt die Anzeige nichts
//      fuer einen Slug, den der Generator erlaubt;
//   C) die ANZEIGE (Playwright): ein roher Slug darf den Bildschirm nie
//      erreichen.
//
// Was hier NICHT geprueft wird, ehrlich benannt: ob die Edge-Function das
// Modul wirklich ruft (Deno laeuft hier nicht), ob die KI sich an das
// Vokabular haelt (kein Netz), und ob die Live-Tabelle aufgeraeumt wird (kein
// DDL/DML auf der Produktivdatenbank). Geprueft ist, was VOR dem Insert
// gerechnet wird — und was danach auf dem Bildschirm steht.
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const { spawnSync } = require('child_process');
const SEED = require('./_seed.js');
let __seite = null;

const WURZEL = path.resolve(__dirname, '..');
const INDEX = path.join(WURZEL, 'index.html');

// Die 35 Slugs, die am 14.09.2026 gemessen wurden: 23 aus `daily_quizzes`
// (nur lesend) und 13 aus GS_QUIZ_FALLBACK_POOL. Beide Wege enden in
// derselben Anzeigezeile. Zahl = Fragen im Bestand (Pool ohne Zahl).
const GEMESSEN = {
  culinary: 32, toxicity: 30, identification: 28, season: 21, habitat: 20,
  medicinal: 19, garten: 10, heilpflanzen: 8, foraging: 7, permakultur: 7,
  bestaeuber: 6, pilze: 6, biodiversitaet: 4, wildpflanzen: 4, edible_toxic: 3,
  klima: 2, oekologie: 2, general: 1, mondkalender: 1, naturschutz: 1,
  schaedlinge: 1, sortenvielfalt: 1, species_id: 1,
  wissen: 0, pilz: 0, tier: 0, sicherheit: 0, essbar: 0, baum: 0,
  wildpflanze: 0, saison: 0, kraut: 0, heilpflanze: 0, neophyt: 0, giftig: 0,
};

const opt = (t, ci, kat, frage) => ({
  question: frage || 'Welche Pflanze traegt im Mai weisse Doldenblueten?',
  options: { answers: t, correct: ci, explanation: 'Weil es so ist.', difficulty: 'easy' },
  category: kat || 'identification', xp_reward: 10, is_active: true,
});
const VIER = ['Holunder', 'Baerlauch', 'Giersch', 'Brennnessel'];

// Kommentare abziehen, bevor im Quelltext gesucht wird. Ohne das meldet ein
// Fall, der nach einem Wort sucht, auch dann gruen, wenn der Code
// AUSKOMMENTIERT ist — CLAUDE.md haelt genau diese Falle fuer wiring_check
// fest. Zeichenketten werden mitgefuehrt: `accept="image/*"` enthaelt ein
// `/*`, das nie schliesst.
function ohneKommentare(src) {
  let out = '', i = 0, inStr = null, inZeile = false, inBlock = false;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (inZeile) { if (c === '\n') { inZeile = false; out += c; } i++; continue; }
    if (inBlock) { if (c === '*' && n === '/') { inBlock = false; i += 2; } else i++; continue; }
    if (inStr) {
      out += c;
      if (c === '\\') { out += (n === undefined ? '' : n); i += 2; continue; }
      if (c === inStr) inStr = null;
      i++; continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; out += c; i++; continue; }
    if (c === '/' && n === '/') { inZeile = true; i += 2; continue; }
    if (c === '/' && n === '*') { inBlock = true; i += 2; continue; }
    out += c; i++;
  }
  return out;
}

const FAELLE = [
  {
    name: 'Struktur · eine gute Zeile geht durch, und jede der acht Kaputtheiten faellt EINZELN durch',
    lauf: (R) => {
      const gut = R.quizFrageValide(opt(VIER, 2, 'identification'));
      if (!gut.ok || gut.kategorie !== 'bestimmung') return { ok: false, warum: 'gute Zeile: ' + JSON.stringify(gut) };
      const schlecht = [
        ['drei Optionen', opt(['a', 'b', 'c'], 1)],
        ['Index zu gross', opt(VIER, 7)],
        ['Index negativ', opt(VIER, -1)],
        ['Index keine Zahl', opt(VIER, '2')],
        ['leere Option', opt(['Holunder', '', 'Giersch', 'Efeu'], 0)],
        ['zwei gleiche Optionen', opt(['Holunder', 'holunder', 'Giersch', 'Efeu'], 0)],
        ['Frage zu kurz', opt(VIER, 0, 'identification', 'Was?')],
        ['Kategorie unbekannt', opt(VIER, 0, 'voellig_neu')],
      ];
      const durch = schlecht.filter(([, z]) => R.quizFrageValide(z).ok).map(([n]) => n);
      if (durch.length) return { ok: false, warum: 'durchgewinkt: ' + durch.join(', ') };
      // und ohne Erklaerung
      const ohneExpl = { question: gut === null ? '' : 'Welche Pflanze traegt weisse Doldenblueten im Mai?', options: { answers: VIER, correct: 0 }, category: 'identification' };
      if (R.quizFrageValide(ohneExpl).ok) return { ok: false, warum: 'ohne Erklaerung durchgewunken' };
      return { ok: true, info: '1 gut, 9 schlecht — jede mit eigenem Grund' };
    },
  },
  {
    name: 'Stapel gegen SICH SELBST · zwei gleiche Fragen in EINER Antwort → eine neu, eine Dublette',
    lauf: (R) => {
      const a = opt(VIER, 0, 'identification', 'Wann werden Holunderblueten geerntet?');
      const b = opt(['Mai', 'Juli', 'September', 'Dezember'], 0, 'season', 'Wann werden Holunderblueten geerntet?');
      const r = R.quizStapelFiltern([a, b], new Set());
      if (r.neu.length !== 1) return { ok: false, warum: 'neu: ' + r.neu.length + ' (erwartet 1)' };
      if (r.verworfen.length !== 1 || r.verworfen[0].grund !== 'Dublette') return { ok: false, warum: JSON.stringify(r.verworfen) };
      return { ok: true, info: '2 gleiche → 1 neu, 1 Dublette' };
    },
  },
  {
    name: 'Stapel gegen die DATENBANK · eine bekannte Frage faellt durch, eine neue nicht',
    lauf: (R) => {
      const bekannt = new Set([R.quizNormFrage('Was ist Mykorrhiza?')]);
      const r = R.quizStapelFiltern([
        opt(VIER, 0, 'oekologie', 'Was ist Mykorrhiza?'),
        opt(VIER, 0, 'oekologie', 'Was ist eine Symbiose im Boden?'),
      ], bekannt);
      if (r.neu.length !== 1 || r.verworfen.length !== 1) return { ok: false, warum: JSON.stringify({ neu: r.neu.length, verworfen: r.verworfen }) };
      if (r.neu[0].category !== 'natur') return { ok: false, warum: 'Kategorie nicht kanonisch: ' + r.neu[0].category };
      return { ok: true, info: 'bekannt raus, neu rein, Kategorie kanonisch' };
    },
  },
  {
    name: 'Normalisierung · Gross/klein, Satzzeichen und doppelter Leerraum sind DIESELBE Frage',
    lauf: (R) => {
      const k = R.quizNormFrage('Was ist Mykorrhiza?');
      const gleich = ['was ist mykorrhiza', 'Was  ist   Mykorrhiza ?', 'WAS IST MYKORRHIZA!'];
      const abweichend = gleich.filter((s) => R.quizNormFrage(s) !== k);
      if (abweichend.length) return { ok: false, warum: 'nicht gleich normiert: ' + JSON.stringify(abweichend) };
      // Gegenrichtung: zwei WIRKLICH verschiedene Fragen duerfen nicht kollidieren
      if (R.quizNormFrage('Was ist Mykorrhiza?') === R.quizNormFrage('Was ist Mykorrhiza im Wald?')) return { ok: false, warum: 'verschiedene Fragen gleich normiert' };
      // Umlaute bleiben: „Holunderbluete" ist nicht „Holunderblüte"
      if (R.quizNormFrage('Holunderblüte') === R.quizNormFrage('Holunderbluete')) return { ok: false, warum: 'Umlaut wurde transliteriert' };
      return { ok: true, info: '3 Schreibvarianten gleich · 2 Gegenrichtungen getrennt' };
    },
  },
  {
    name: 'Kategorie · jeder Slug aus Tabelle, Pool UND den Migrationen loest auf, ein erfundener nicht',
    lauf: (R) => {
      // Die abgetippte Liste GEMESSEN deckt zwei Quellen (Live-Tabelle, Pool).
      // Die dritte sind die MIGRATIONEN — eine SQL-Migration geht am Generator
      // vorbei, und 20260827_… liegt mit 43 Fragen bereit. Wuerde der Fall nur
      // die abgetippte Liste lesen, waere er der Vorfall und nicht die Klasse:
      // die naechste Migration braechte wieder unbekannte Slugs mit, ohne dass
      // etwas rot wird. Also werden sie HIER aus den Dateien gezogen.
      // Und die zweite Quelle ebenso aus dem Quelltext: GS_QUIZ_FALLBACK_POOL
      // steht in index.html. Waere sie abgetippt, faende der Fall eine neue
      // Pool-Frage mit neuem Slug nie — dieselbe Luecke wie bei den Migrationen.
      const ausPool = new Set();
      {
        const src0 = fs.readFileSync(INDEX, 'utf8');
        const i0 = src0.indexOf('GS_QUIZ_FALLBACK_POOL = [');
        if (i0 < 0) return { ok: false, warum: 'GS_QUIZ_FALLBACK_POOL nicht gefunden — der Fall misst eine seiner Quellen nicht' };
        const blk0 = src0.slice(i0, src0.indexOf('\n];', i0));
        for (const m of blk0.matchAll(/category:\s*'([a-z_äöü]+)'/g)) ausPool.add(m[1]);
        if (ausPool.size < 5) return { ok: false, warum: 'nur ' + ausPool.size + ' Pool-Kategorien gelesen — die Suche greift nicht mehr' };
      }
      const ausMigrationen = new Set();
      const migDir = path.join(WURZEL, 'supabase', 'migrations');
      for (const f of fs.readdirSync(migDir).filter((n) => /quiz/i.test(n) && n.endsWith('.sql'))) {
        const txt = fs.readFileSync(path.join(migDir, f), 'utf8');
        // Die Bauform der Einfuegungen: '<slug>', <xp>, true
        for (const m of txt.matchAll(/'([a-z_]{3,30})',\s*\d+,\s*true/g)) ausMigrationen.add(m[1]);
      }
      const alleSlugs = [...new Set([...Object.keys(GEMESSEN), ...ausPool, ...ausMigrationen])];
      const offen = alleSlugs.filter((s) => !R.quizKategorie(s));
      if (offen.length) return { ok: false, warum: offen.length + ' ohne Zuordnung (Quelle: Tabelle/Pool/Migrationen): ' + offen.join(', ') };
      if (!ausMigrationen.size) return { ok: false, warum: 'aus den Migrationen kam KEIN Slug — der Fall misst seine dritte Quelle nicht' };
      if (R.quizKategorie('voellig_neu') || R.quizKategorie('') || R.quizKategorie(null)) return { ok: false, warum: 'ein unbekannter Slug wurde aufgeloest' };
      const ziele = new Set(alleSlugs.map((s) => R.quizKategorie(s)));
      const fremd = [...ziele].filter((z) => R.QUIZ_KATEGORIEN.indexOf(z) === -1);
      if (fremd.length) return { ok: false, warum: 'Alias zeigt auf Unbekanntes: ' + fremd.join(', ') };
      // Einzahl/Mehrzahl landen zusammen — der eigentliche Grund fuer den Alias
      const paare = [['pilz', 'pilze'], ['wildpflanze', 'wildpflanzen'], ['heilpflanze', 'heilpflanzen']];
      const getrennt = paare.filter(([a, b]) => R.quizKategorie(a) !== R.quizKategorie(b));
      if (getrennt.length) return { ok: false, warum: 'Einzahl/Mehrzahl getrennt: ' + JSON.stringify(getrennt) };
      return { ok: true, info: alleSlugs.length + ' Slugs (' + Object.keys(GEMESSEN).length + ' gemessen, ' + ausPool.size + ' aus dem Pool, ' + ausMigrationen.size + ' aus Migrationen) → ' + ziele.size + ' Kategorien, 3 Einzahl/Mehrzahl-Paare vereint' };
    },
  },
  {
    name: 'Vorrat · drei Zustaende, und „keine Daten" ist NIE eine 0',
    lauf: (R) => {
      const a = R.quizVorrat({ frei: 181, zulaufProLauf: 12, tageProRotation: 35, verbrauchProTag: 1, heute: '2026-09-14' });
      if (a.tage !== 275 || a.erschoepftAm !== '2027-06-16') return { ok: false, warum: 'gemessener Fall: ' + JSON.stringify(a) };
      const b = R.quizVorrat({ frei: null });
      if (b.tage !== null || !b.grund) return { ok: false, warum: 'ohne Zahl: ' + JSON.stringify(b) };
      const c = R.quizVorrat({ frei: 0, zulaufProLauf: 12, tageProRotation: 35, verbrauchProTag: 1, heute: '2026-09-14' });
      if (c.tage !== 0 || c.erschoepftAm !== '2026-09-14') return { ok: false, warum: 'leer: ' + JSON.stringify(c) };
      const d = R.quizVorrat({ frei: 181, zulaufProLauf: 35, tageProRotation: 35, verbrauchProTag: 1 });
      if (d.tage !== null || !/deckt/.test(d.grund)) return { ok: false, warum: 'ausreichender Zulauf: ' + JSON.stringify(d) };
      return { ok: true, info: '181/12/35 → 275 Tage (16.06.2027) · ohne Zahl null · leer 0 · 35/35 deckt' };
    },
  },
  {
    name: 'Ein kaputter Eintrag haelt den Lauf NICHT auf',
    lauf: (R) => {
      const stapel = [opt(['a', 'b'], 0, 'identification', 'Zu wenige Optionen in dieser Frage?')];
      for (let i = 0; i < 11; i++) stapel.push(opt(VIER, i % 4, 'identification', 'Welche Pflanze ist das, Nummer ' + i + '?'));
      const r = R.quizStapelFiltern(stapel, new Set());
      if (r.neu.length !== 11 || r.verworfen.length !== 1) return { ok: false, warum: JSON.stringify({ neu: r.neu.length, verworfen: r.verworfen.length }) };
      return { ok: true, info: '1 kaputt, 11 neu' };
    },
  },
  {
    name: 'Ein Vokabular · Modul und App kennen DIESELBEN Kategorien und denselben Alias',
    lauf: (R) => {
      const src = fs.readFileSync(INDEX, 'utf8');
      const mKat = src.match(/var\s+GS_QUIZ_KATEGORIEN\s*=\s*\[([\s\S]*?)\];/);
      if (!mKat) return { ok: false, warum: 'GS_QUIZ_KATEGORIEN steht nicht in index.html' };
      const appKat = (mKat[1].match(/'([a-z_]+)'/g) || []).map((s) => s.replace(/'/g, ''));
      const fehlt = R.QUIZ_KATEGORIEN.filter((k) => appKat.indexOf(k) === -1);
      const zuviel = appKat.filter((k) => R.QUIZ_KATEGORIEN.indexOf(k) === -1);
      if (fehlt.length || zuviel.length) return { ok: false, warum: 'Modul↔App: fehlt ' + JSON.stringify(fehlt) + ', zuviel ' + JSON.stringify(zuviel) };

      const mAl = src.match(/var\s+GS_QUIZ_KAT_ALIAS\s*=\s*\{([\s\S]*?)\};/);
      if (!mAl) return { ok: false, warum: 'GS_QUIZ_KAT_ALIAS steht nicht in index.html' };
      const appAlias = {};
      for (const p of (mAl[1].match(/([a-z_]+)\s*:\s*'([a-z_]+)'/g) || [])) {
        const [, k, v] = p.match(/([a-z_]+)\s*:\s*'([a-z_]+)'/);
        appAlias[k] = v;
      }
      const abw = Object.keys(R.QUIZ_KAT_ALIAS).filter((k) => appAlias[k] !== R.QUIZ_KAT_ALIAS[k]);
      const extra = Object.keys(appAlias).filter((k) => !R.QUIZ_KAT_ALIAS[k]);
      if (abw.length || extra.length) return { ok: false, warum: 'Alias weicht ab: ' + JSON.stringify({ abw, extra }) };

      // Und jede Kategorie braucht einen _t-Schluessel, sonst bleibt sie fuer immer deutsch
      const ohneKey = R.QUIZ_KATEGORIEN.filter((k) => src.indexOf("'quiz_kat_" + k + "'") === -1);
      if (ohneKey.length) return { ok: false, warum: 'ohne _t-Schluessel in GS_I18N_JS_STRINGS: ' + ohneKey.join(', ') };

      // CLAUDE.md §7.1 (i18n_check): Tabelle und Aufrufort muessen denselben
      // DEUTSCHEN Text tragen. Nachgeschlagen wird der Tabellenwert; der
      // Rueckfall am Aufrufort erscheint nur auf Deutsch. Gehen sie
      // auseinander, liest ein deutscher Nutzer einen anderen Satz als ein
      // franzoesischer. Der Aufrufort ist hier GS_QUIZ_KAT_DE.
      const mDe = src.match(/var\s+GS_QUIZ_KAT_DE\s*=\s*\{([\s\S]*?)\};/);
      if (!mDe) return { ok: false, warum: 'GS_QUIZ_KAT_DE steht nicht in index.html' };
      const appDe = {};
      for (const pr of (mDe[1].match(/([a-z_]+)\s*:\s*'([^']*)'/g) || [])) {
        const mm = pr.match(/([a-z_]+)\s*:\s*'([^']*)'/); appDe[mm[1]] = mm[2];
      }
      const i18nDe = {};
      for (const pr of (src.match(/'quiz_kat_([a-z_]+)':\s*'([^']*)'/g) || [])) {
        const mm = pr.match(/'quiz_kat_([a-z_]+)':\s*'([^']*)'/); i18nDe[mm[1]] = mm[2];
      }
      const uneins = R.QUIZ_KATEGORIEN.filter((k) => appDe[k] !== i18nDe[k]);
      if (uneins.length) return { ok: false, warum: 'Tabelle und Aufrufort tragen verschiedenen deutschen Text: ' + uneins.map((k) => k + ' (' + JSON.stringify(i18nDe[k]) + ' gegen ' + JSON.stringify(appDe[k]) + ')').join(', ') };
      const ohneDe = R.QUIZ_KATEGORIEN.filter((k) => !appDe[k]);
      if (ohneDe.length) return { ok: false, warum: 'ohne deutschen Rueckfall: ' + ohneDe.join(', ') };
      return { ok: true, info: appKat.length + ' Kategorien, ' + Object.keys(appAlias).length + ' Alias-Eintraege, alle mit _t-Schluessel und gleichem deutschen Text' };
    },
  },
];

FAELLE.push({
  name: 'Umlaute · „küche" ist „kueche", und Modul und App falten GLEICH',
  lauf: (R) => {
    // Das Vokabular ist deutsch in ASCII-Umschrift, der Prompt gibt es so vor —
    // ein Modell, das auf Deutsch schreibt, liefert aber „küche" und
    // „bestäuber". Ohne Falten faellt die Zeile durch, und im schlimmsten Fall
    // der ganze Stapel (12 von 12), waehrend die Antwort ok:true meldet.
    const paare = [['küche', 'kueche'], ['Küche', 'kueche'], ['bestäuber', 'tiere'],
                   ['schädlinge', 'garten'], ['ökologie', 'natur'], ['biodiversität', 'natur']];
    const falsch = paare.filter(([a, soll]) => R.quizKategorie(a) !== soll)
                        .map(([a, soll]) => a + ' → ' + R.quizKategorie(a) + ' (erwartet ' + soll + ')');
    if (falsch.length) return { ok: false, warum: falsch.join(', ') };
    if (R.quizKategorie('völlig_neu')) return { ok: false, warum: 'ein erfundener Slug mit Umlaut wurde aufgeloest' };
    // Und die App muss GENAUSO falten, sonst kennt sie einen Slug nicht, den
    // der Generator durchgelassen hat.
    const src = fs.readFileSync(INDEX, 'utf8');
    const i = src.indexOf('function _gsQuizKatLabel');
    const rumpf = i < 0 ? '' : src.slice(i, i + 1400);
    const fehlt = ['ä', 'ö', 'ü', 'ß'].filter((u) => rumpf.indexOf("replace(/" + u + "/g") === -1);
    if (fehlt.length) return { ok: false, warum: '_gsQuizKatLabel faltet nicht: ' + fehlt.join(' ') };
    return { ok: true, info: '6 Umlaut-Varianten loesen auf · App faltet dieselben vier Zeichen' };
  },
});

FAELLE.push({
  name: 'Die Formen duerfen sich nicht MISCHEN — die Anzeige wandelt nur Zeichenketten um',
  lauf: (R) => {
    const mk = (opts) => ({ question: 'Welche Pflanze traegt weisse Doldenblueten?', options: opts, category: 'identification' });
    const objekte = [{ label: 'Holunder' }, { label: 'Baerlauch' }, { label: 'Giersch' }, { label: 'Brennnessel' }];
    const gut = [
      ['Index + Zeichenketten', mk({ answers: ['Holunder', 'Baerlauch', 'Giersch', 'Brennnessel'], correct: 0, explanation: 'x' })],
      ['Array + Objekte', mk([{ label: 'Holunder', is_correct: true, explanation: 'x' }, { label: 'Baerlauch' }, { label: 'Giersch' }, { label: 'Brennnessel' }])],
    ];
    const abgelehnt = gut.filter(([, z]) => !R.quizFrageValide(z).ok).map(([n, z]) => n + ': ' + R.quizFrageValide(z).grund);
    if (abgelehnt.length) return { ok: false, warum: 'gute Form abgewiesen: ' + abgelehnt.join(' · ') };
    const schlecht = [
      ['Index + Objekte', mk({ answers: objekte, correct: 0, explanation: 'x' })],
      ['Index + gemischt', mk({ answers: ['Holunder', { label: 'Baerlauch' }, { label: 'Giersch' }, { label: 'Brennnessel' }], correct: 0, explanation: 'x' })],
      ['Array + Zeichenketten', mk(['Holunder', 'Baerlauch', 'Giersch', 'Brennnessel'])],
    ];
    const durch = schlecht.filter(([, z]) => R.quizFrageValide(z).ok).map(([n]) => n);
    if (durch.length) return { ok: false, warum: 'durchgewinkt: ' + durch.join(', ') };
    return { ok: true, info: '2 gute Formen gueltig · Index+Objekte, gemischt und Array+Zeichenketten abgewiesen' };
  },
});

FAELLE.push({
  name: 'Normalisierung · dieselbe Frage in NFD ist DIESELBE Frage',
  lauf: (R) => {
    const nfc = 'Wächst Bärlauch im Wald oder auf der Wiese?';
    if (R.quizNormFrage(nfc) !== R.quizNormFrage(nfc.normalize('NFD'))) {
      return { ok: false, warum: 'NFD anders normiert: ' + JSON.stringify(R.quizNormFrage(nfc.normalize('NFD'))) };
    }
    if (!/wächst/.test(R.quizNormFrage(nfc.normalize('NFD')))) {
      return { ok: false, warum: 'der Umlaut zerfaellt: ' + JSON.stringify(R.quizNormFrage(nfc.normalize('NFD'))) };
    }
    return { ok: true, info: 'NFC und NFD ergeben denselben Schluessel, „wächst" bleibt ein Wort' };
  },
});

FAELLE.push({
  name: 'Randfaelle · correct=0 ist GUELTIG, eine Zeichenkette nicht, zwei richtige Antworten nicht',
  lauf: (R) => {
    // Die klassische Falle: `if (!row.options.correct)` haelt die 0 fuer fehlend.
    // Live gemessen (14.09.2026): 150 Fragen tragen {answers,correct}; correct=0
    // ist bei vier Optionen die erste Antwort und voellig normal.
    const V = ['Holunder', 'Baerlauch', 'Giersch', 'Brennnessel'];
    const f = (o) => R.quizFrageValide({ question: 'Welche Pflanze traegt weisse Doldenblueten?', options: o, category: 'identification' });
    const null0 = f({ answers: V, correct: 0, explanation: 'x' });
    if (!null0.ok) return { ok: false, warum: 'correct=0 abgewiesen: ' + null0.grund };
    const schlecht = [
      ['correct als Zeichenkette', f({ answers: V, correct: '2', explanation: 'x' })],
      ['correct null', f({ answers: V, correct: null, explanation: 'x' })],
      ['options null', R.quizFrageValide({ question: 'Welche Pflanze traegt weisse Doldenblueten?', options: null, category: 'x' })],
      ['gar keine Zeile', R.quizFrageValide(undefined)],
      ['Array mit zwei richtigen', f([{ label: 'a', is_correct: true, explanation: 'x' }, { label: 'b', is_correct: true }, { label: 'c' }, { label: 'd' }])],
      ['Array mit keiner richtigen', f([{ label: 'a' }, { label: 'b' }, { label: 'c' }, { label: 'd' }])],
    ];
    const durch = schlecht.filter(([, r]) => r.ok).map(([n]) => n);
    if (durch.length) return { ok: false, warum: 'durchgewinkt: ' + durch.join(', ') };
    // Und die Array-Form MIT genau einer richtigen muss gehen (sonst prueft der Fall nur eine Richtung)
    const arr = f([{ label: 'a', is_correct: true, explanation: 'x' }, { label: 'b' }, { label: 'c' }, { label: 'd' }]);
    if (!arr.ok) return { ok: false, warum: 'gute Array-Form abgewiesen: ' + arr.grund };
    return { ok: true, info: 'correct=0 gueltig · 6 Randfaelle abgewiesen · Array-Form mit einer richtigen gueltig' };
  },
});

FAELLE.push({
  name: 'Der Bestand von heute wuerde die Pruefung BESTEHEN — die Regeln sind an den Daten geeicht',
  lauf: (R) => {
    // Am 14.09.2026 live gemessen: von 215 aktiven Fragen hat KEINE eine andere
    // Optionszahl als vier, keine ein correct ausserhalb des Bereichs, keine ein
    // nicht-numerisches correct, keine eine Frage unter 15 oder ueber 200 Zeichen,
    // und alle 215 haben eine Erklaerung. Eine Regel, die den eigenen Bestand
    // abweisen wuerde, waere zu streng — und der naechste Lauf lieferte 0 Fragen.
    const stichproben = [
      { question: 'Welcher Pilz ist toedlich giftig und wird oft verwechselt?', options: { answers: ['Steinpilz', 'Pfifferling', 'Gruener Knollenblaetterpilz', 'Champignon'], correct: 2, explanation: 'Amanita phalloides.', difficulty: 'easy' }, category: 'toxicity' },
      { question: 'Wann werden Holunderblueten in der Schweiz geerntet?', options: { choices: ['Maerz', 'Mai bis Juni', 'August', 'Oktober'], correct: 1, explanation: 'Zur Vollbluete.' }, category: 'foraging' },
      { question: 'Welche Pflanze gilt als Zeigerpflanze fuer stickstoffreichen Boden?', options: [{ label: 'Brennnessel', is_correct: true, explanation: 'Sie zeigt Stickstoff an.' }, { label: 'Enzian' }, { label: 'Heidekraut' }, { label: 'Sonnentau' }], category: 'habitat' },
    ];
    const raus = stichproben.map((z) => R.quizFrageValide(z));
    const abgelehnt = raus.map((r, i) => [i, r]).filter(([, r]) => !r.ok);
    if (abgelehnt.length) return { ok: false, warum: 'eigener Bestand abgewiesen: ' + JSON.stringify(abgelehnt.map(([i, r]) => i + ': ' + r.grund)) };
    const kat = raus.map((r) => r.kategorie);
    if (kat.join(',') !== 'giftigkeit,sammeln,standort') return { ok: false, warum: 'Kategorien: ' + kat.join(',') };
    return { ok: true, info: 'drei echte Formate (answers · choices · Array) alle gueltig, Kategorien kanonisch' };
  },
});

FAELLE.push({
  name: 'Ein Lauf, der NICHTS liefert, bleibt nicht still — er schreibt nach system_events',
  lauf: (R) => {
    // Die Antwort der Edge-Function liest niemand: fn_knowledge_growth_daily
    // ruft `PERFORM net.http_post(...)` und verwirft das Ergebnis. Ein Lauf,
    // in dem die neue Pruefung alles verwirft, saehe in der Antwort aus wie ein
    // gesunder Lauf ohne Nachschubbedarf ({ok:true, inserted:0}).
    const gen = path.join(WURZEL, 'supabase', 'functions', 'knowledge-bulk-gen', 'index.ts');
    const src = ohneKommentare(fs.readFileSync(gen, 'utf8'));
    const fehlt = [];
    if (!/system_events/.test(src)) fehlt.push('schreibt nicht nach system_events');
    if (!/eintraege_verworfen/.test(src)) fehlt.push('kein eigenes Ereignis');
    if (!/severity/.test(src) || !/"error"/.test(src)) fehlt.push('kein error bei 0 neuen Zeilen');
    if (!/catch \(_\)/.test(src.slice(src.indexOf('system_events')))) fehlt.push('die Meldung kann den Lauf aufhalten');
    if (fehlt.length) return { ok: false, warum: fehlt.join(' · ') };
    // Und der Cron liest die Antwort wirklich nicht — das ist der Grund, warum
    // es die Zeile gibt. Beleg aus der Migration, damit die Begruendung nicht
    // nur ein Kommentar ist.
    const mig = path.join(WURZEL, 'supabase', 'migrations', 'v29_rotate_knowledge_gen_secret.sql');
    if (fs.existsSync(mig)) {
      const m = fs.readFileSync(mig, 'utf8');
      if (!/PERFORM\s+net\.http_post/.test(m)) return { ok: false, warum: 'der Cron-Aufruf sieht nicht mehr aus wie ein PERFORM — Begruendung pruefen' };
    }
    return { ok: true, info: 'system_events · error bei 0 neuen · nicht-blockierend · Cron verwirft die Antwort (PERFORM)' };
  },
});

FAELLE.push({
  name: 'Der Generator BENUTZT das Modul · Import, Vokabular im Prompt, normierte Menge',
  lauf: (R) => {
    const gen = path.join(WURZEL, 'supabase', 'functions', 'knowledge-bulk-gen', 'index.ts');
    const src = ohneKommentare(fs.readFileSync(gen, 'utf8'));
    const fehlt = [];
    if (!/from\s+["']\.\.\/_shared\/quiz_gen_regeln\.mjs["']/.test(src)) fehlt.push('kein Import des Moduls');
    if (!/quizStapelFiltern\s*\(/.test(src)) fehlt.push('quizStapelFiltern wird nicht gerufen');
    if (!/quizNormFrage\s*\(/.test(src)) fehlt.push('die vorhandenen Fragen werden nicht normiert');
    // Der Prompt darf keine EIGENE Kategorienliste tragen — sonst stehen wieder
    // zwei Listen nebeneinander (CLAUDE.md §4a.2: eine Prompt-Zeile ist keine Garantie).
    // NUR die Zeile des Quiz-Themas ansehen. Der erste Anlauf suchte im ganzen
    // Quelltext nach einer Kategorienliste und meldete die von `folk_lore` —
    // die dort voellig richtig steht. Eine Falschmeldung, die man zu ignorieren
    // lernt, macht den Bericht unlesbar (CLAUDE.md §7.1, v32.21).
    const zeile = (src.split('\n').find((l) => /^\s*daily_quizzes:\s*\{/.test(l)) || '');
    if (!zeile) fehlt.push('daily_quizzes steht nicht mehr in SCHEMAS');
    if (!/QUIZ_KATEGORIEN\.join/.test(zeile)) fehlt.push('der Quiz-Prompt nennt nicht das Vokabular des Moduls');
    const eigene = zeile.match(/"category":"[a-z_]+\|[a-z_|]+"/);
    if (eigene) fehlt.push('eigene Kategorienliste im Quiz-Prompt: ' + eigene[0]);
    // Und die Antwort muss sagen, was verworfen wurde: ein Lauf mit 0 neuen
    // Fragen sieht sonst aus wie ein Lauf ohne Nachschubbedarf.
    if (!/rejected/.test(src)) fehlt.push('die Antwort nennt nicht, was verworfen wurde');
    if (fehlt.length) return { ok: false, warum: fehlt.join(' · ') };
    return { ok: true, info: 'Import · quizStapelFiltern · quizNormFrage · Prompt aus dem Vokabular · rejected in der Antwort' };
  },
});


// ── Die VORRATS-RECHNUNG in SQL (lokales Postgres) ────────────────────────
// Die Migration 20260914_quiz_vorrat.sql ist NICHT angewandt. Hier wird ihre
// Rechnung gegen eine Fixture nachgerechnet — mit Reproduktion (ohne die
// 730-Tage-Bedingung zaehlt sie falsch) und Gegenprobe.
const URL0 = process.env.GS_PG_URL || 'postgresql://postgres@127.0.0.1:54329/postgres';
const DBN = 'gs_quiz_gen_check';
function psql(url, args) { return spawnSync('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-F', '\t', ...args], { encoding: 'utf8' }); }
function letzte(r) { return (r.stderr || '').trim().split('\n').filter(Boolean).slice(-2).join(' · '); }
function sql(url, q) { const r = psql(url, ['-c', q]); if (r.status !== 0) throw new Error(letzte(r)); return (r.stdout || '').trim(); }
function sqlFile(url, f) { const r = psql(url, ['-f', f]); if (r.status !== 0) throw new Error(path.basename(f) + ': ' + letzte(r)); }

const FIXTURE = `
-- Supabase-Rollen: die Migration setzt Rechte fuer anon/authenticated/service_role.
-- Auf einem frisch initdb'ten Cluster gibt es die nicht, und das REVOKE auf
-- anon wirft. Bisher lief es nur deshalb, weil pruefstaende.sh quiz VOR quizgen
-- faehrt und quiz_check die Rollen anlegt — Rollen sind clusterweit. Ein
-- Pruefstand darf sich nicht auf die Reihenfolge seiner Nachbarn verlassen.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
create table daily_quizzes (
  id uuid primary key default gen_random_uuid(), day_key date, question text,
  options jsonb, category text, xp_reward int default 10, is_active boolean default true,
  created_at timestamptz default now());
create table daily_quiz_history (day_key date primary key, question_id uuid);
create table system_events (id bigserial primary key, severity text, source text,
  event text, detail jsonb, created_at timestamptz default now());
-- 100 aktive Fragen, 20 davon in den letzten 120 Tagen angelegt
insert into daily_quizzes (question, options, category, created_at)
select 'Frage ' || g, '{"answers":["a","b","c","d"],"correct":0}'::jsonb, 'bestimmung',
       case when g <= 20 then now() - (g || ' days')::interval else now() - interval '400 days' end
from generate_series(1,100) g;
-- 30 Tage gespielt, davon 25 innerhalb des 730-Tage-Fensters und 5 laengst
-- ausserhalb: die fuenf muessen wieder als FREI zaehlen.
insert into daily_quiz_history (day_key, question_id)
select current_date - g, (select id from daily_quizzes order by question limit 1 offset g-1)
from generate_series(1,25) g;
insert into daily_quiz_history (day_key, question_id)
select current_date - 800 - g, (select id from daily_quizzes order by question limit 1 offset 24+g)
from generate_series(1,5) g;
-- Und ZWEI Zeilen an der Grenze. Ohne sie liegt zwischen Tag 26 und Tag 800
-- nichts, und jedes Fenster in diesem Bereich ergibt dieselbe Zahl: der Fall
-- traegt „730" im Namen und wuerde mit 365 genauso gruen melden. Tag 729 muss
-- als verbraucht zaehlen, Tag 731 wieder als frei.
insert into daily_quiz_history (day_key, question_id)
values (current_date - 729, (select id from daily_quizzes order by question limit 1 offset 30)),
       (current_date - 731, (select id from daily_quizzes order by question limit 1 offset 31));
`;

const SQLFAELLE = [];
let MODUL = null;              // wird im Laeufer gesetzt, bevor sqlHaelfte() laeuft
function sqlHaelfte() {
  try { sql(URL0, 'select 1'); }
  catch (e) {
    SQLFAELLE.push({ ok: null, name: 'Vorrats-Rechnung (SQL)', warum: 'lokales Postgres nicht erreichbar unter ' + URL0.replace(/\/\/.*@/, '//…@') + ' — `bash scripts/_pg_local.sh start`' });
    return;
  }
  sql(URL0, `drop database if exists ${DBN}`);
  sql(URL0, `create database ${DBN}`);
  const url = URL0.replace(/\/[^/]*$/, '/' + DBN);
  sql(url, FIXTURE);
  sqlFile(url, path.join(WURZEL, 'supabase', 'migrations', '20260914_quiz_vorrat.sql'));

  SQLFAELLE.push((() => {
    const v = JSON.parse(sql(url, 'select public.fn_quiz_vorrat()'));
    // 100 aktiv · 25 im Fenster verbraucht · 5 ausserhalb zaehlen wieder → 75 frei
    if (v.aktiv !== 100) return { ok: false, name: 'Vorrat · die Zahlen', warum: 'aktiv ' + v.aktiv };
    // 100 aktiv − 25 (letzte 25 Tage) − 1 (Tag 729, GERADE noch im Fenster) = 74.
    // Die 5 bei Tag 801-805 und die eine bei Tag 731 zaehlen wieder als frei.
    // Mit einem 365-Tage-Fenster waeren es 75 — daran faellt die falsche Regel.
    if (v.frei !== 74) return { ok: false, name: 'Vorrat · die Zahlen', warum: 'frei ' + v.frei + ' (erwartet 74; bei 75 rechnet die Funktion mit einem KUERZEREN Fenster als 730 Tagen)' };
    if (v.tage_gespielt !== 32) return { ok: false, name: 'Vorrat · die Zahlen', warum: 'tage_gespielt ' + v.tage_gespielt };
    if (v.zulauf_120t !== 20) return { ok: false, name: 'Vorrat · die Zahlen', warum: 'zulauf_120t ' + v.zulauf_120t };
    return { ok: true, name: 'Vorrat · die Zahlen (aktiv, frei im 730-Tage-Fenster, gespielte Tage, Zulauf)', info: '100 aktiv · 74 frei · 32 Tage · 20 Zulauf · Grenze 729 verbraucht / 731 frei' };
  })());

  SQLFAELLE.push((() => {
    // Die Warnung: bei 75 frei (Schwelle 60) darf NICHTS geschrieben werden.
    sql(url, 'select public.fn_quiz_vorrat_pruefen()');
    const still = parseInt(sql(url, "select count(*) from system_events where source='quiz'"), 10);
    if (still !== 0) return { ok: false, name: 'Vorrat · die Warnung', warum: 'bei 75 frei wurde gewarnt (' + still + ' Zeilen)' };
    // Jetzt 50 weitere Fragen verbrauchen → 25 frei → warn
    sql(url, `insert into daily_quiz_history (day_key, question_id)
              select current_date - 100 - g, (select id from daily_quizzes order by question limit 1 offset 29+g)
              from generate_series(1,50) g`);
    sql(url, 'select public.fn_quiz_vorrat_pruefen()');
    const r1 = sql(url, "select severity, detail->>'frei' from system_events where source='quiz' order by id desc limit 1").split('\t');
    if (r1[0] !== 'warn' || r1[1] !== '25') return { ok: false, name: 'Vorrat · die Warnung', warum: 'bei 25 frei: ' + JSON.stringify(r1) + ' (erwartet warn/25)' };
    // Und unter 14 → error
    sql(url, `insert into daily_quiz_history (day_key, question_id)
              select current_date - 200 - g, (select id from daily_quizzes order by question limit 1 offset 79+g)
              from generate_series(1,15) g`);
    sql(url, 'select public.fn_quiz_vorrat_pruefen()');
    const r2 = sql(url, "select severity, detail->>'frei' from system_events where source='quiz' order by id desc limit 1").split('\t');
    if (r2[0] !== 'error' || r2[1] !== '10') return { ok: false, name: 'Vorrat · die Warnung', warum: 'bei 10 frei: ' + JSON.stringify(r2) + ' (erwartet error/10)' };
    // Entprellung: ein zweiter Aufruf am selben Tag darf KEINE zweite Zeile
    // schreiben — sonst steht die Warnung 60 Tage lang jeden Morgen da.
    const vorher = parseInt(sql(url, "select count(*) from system_events where source='quiz'"), 10);
    sql(url, 'select public.fn_quiz_vorrat_pruefen()');
    sql(url, 'select public.fn_quiz_vorrat_pruefen()');
    const nachher = parseInt(sql(url, "select count(*) from system_events where source='quiz'"), 10);
    if (nachher !== vorher) return { ok: false, name: 'Vorrat · die Warnung', warum: 'zwei weitere Aufrufe schrieben ' + (nachher - vorher) + ' Zeile(n) — keine Entprellung' };
    // Und eine aeltere Zeile derselben Stufe blockiert nicht ewig
    sql(url, "update system_events set created_at = now() - interval '8 days' where source='quiz'");
    sql(url, 'select public.fn_quiz_vorrat_pruefen()');
    const spaeter = parseInt(sql(url, "select count(*) from system_events where source='quiz'"), 10);
    if (spaeter !== nachher + 1) return { ok: false, name: 'Vorrat · die Warnung', warum: 'nach 8 Tagen kam keine neue Meldung (' + nachher + ' → ' + spaeter + ')' };
    return { ok: true, name: 'Vorrat · die Warnung schweigt bei 75, warnt bei 25, alarmiert bei 10 — und entprellt 7 Tage', info: 'Schwelle 60 / 14 · zweimal gerufen = 0 neue Zeilen · nach 8 Tagen wieder' };
  })());

  SQLFAELLE.push((() => {
    // Idempotenz: die Migration zweimal einspielen darf nichts kaputtmachen.
    try { sqlFile(url, path.join(WURZEL, 'supabase', 'migrations', '20260914_quiz_vorrat.sql')); }
    catch (e) { return { ok: false, name: 'Vorrat · Idempotenz', warum: 'zweiter Lauf: ' + e.message }; }
    const v = JSON.parse(sql(url, 'select public.fn_quiz_vorrat()'));
    if (!Number.isInteger(v.frei)) return { ok: false, name: 'Vorrat · Idempotenz', warum: 'nach dem zweiten Lauf: ' + JSON.stringify(v) };
    return { ok: true, name: 'Vorrat · Idempotenz (zweimal eingespielt)', info: 'frei ' + v.frei };
  })());

  SQLFAELLE.push((() => {
    // Die ZWEITE Meinung: `quizVorrat` im Modul und die SQL-Funktion rechnen
    // dieselbe Bilanz. Ohne diesen Fall haette `quizVorrat` ueberhaupt keinen
    // Aufrufer — eine Regel, die nirgends gebraucht wird, altert unbemerkt,
    // waehrend die Doku ihre Zahlen zitiert.
    const v = JSON.parse(sql(url, 'select public.fn_quiz_vorrat()'));
    const js = MODUL.quizVorrat({ frei: v.frei, zulaufProLauf: 12, tageProRotation: 35, verbrauchProTag: 1, heute: v.gemessen_am });
    const erwartet = Math.max(0, Math.floor(v.frei / (1 - 12 / 35)));
    if (js.tage !== erwartet) return { ok: false, name: 'Vorrat · JS und SQL rechnen dasselbe', warum: 'JS ' + js.tage + ', erwartet ' + erwartet + ' (frei ' + v.frei + ')' };
    if (!js.erschoepftAm) return { ok: false, name: 'Vorrat · JS und SQL rechnen dasselbe', warum: 'kein Datum: ' + JSON.stringify(js) };
    return { ok: true, name: 'Vorrat · die Regel im Modul und die in SQL rechnen dieselbe Bilanz', info: 'frei ' + v.frei + ' → ' + js.tage + ' Tage (' + js.erschoepftAm + ')' };
  })());

  SQLFAELLE.push((() => {
    // GEGENPROBE: ohne die 730-Tage-Bedingung zaehlt „frei" jede nie gespielte
    // Frage — die 5 laengst abgelaufenen fehlten dann.
    sql(url, `create or replace function public.fn_quiz_vorrat_falsch() returns int language sql stable as $f$
      select count(*)::int from public.daily_quizzes q where q.is_active
        and not exists (select 1 from public.daily_quiz_history h where h.question_id = q.id) $f$`);
    const falsch = parseInt(sql(url, 'select public.fn_quiz_vorrat_falsch()'), 10);
    const richtig = JSON.parse(sql(url, 'select public.fn_quiz_vorrat()')).frei;
    if (falsch === richtig) return { ok: false, name: 'Vorrat · Gegenprobe', warum: 'die falsche Rechnung liefert dasselbe (' + falsch + ') — der Fall unterscheidet die beiden Regeln nicht' };
    return { ok: true, name: 'Vorrat · Gegenprobe: ohne das 730-Tage-Fenster kommt eine andere Zahl heraus', info: 'richtig ' + richtig + ' gegen falsch ' + falsch };
  })());
}

// ── Die ANZEIGE (Playwright) ───────────────────────────────────────────────
// Das Modul zu pruefen beweist nicht, dass die App es benutzt. Diese Haelfte
// oeffnet das Quizfenster wirklich und liest, was unter der Frage STEHT.
const APP = [
  {
    name: 'Anzeige · ein Datenbank-Slug wird zum Wort, und ein unbekannter zu NICHTS',
    lauf: async () => {
      const r = await __seite.evaluate(() => {
        const raus = [];
        const zeig = (kat) => {
          window.__qg.oeffnen(kat);
          const el = document.getElementById('dq-hint');
          return { kat, text: (el && el.textContent || '').trim(), sichtbar: !!(el && el.style.display !== 'none') };
        };
        ['edible_toxic', 'season', 'bestaeuber', 'wildpflanze', 'general'].forEach(k => raus.push(zeig(k)));
        raus.push(zeig('voellig_neuer_slug'));
        raus.push(zeig(''));
        return raus;
      });
      const roh = r.filter(x => x.text && /_|^[a-z]+$/.test(x.text));
      if (roh.length) return { ok: false, warum: 'roher Slug auf dem Bildschirm: ' + JSON.stringify(roh) };
      const leer = r.slice(0, 5).filter(x => !x.text);
      if (leer.length) return { ok: false, warum: 'bekannter Slug ohne Text: ' + JSON.stringify(leer) };
      const unbekannt = r[5];
      if (unbekannt.text || unbekannt.sichtbar) return { ok: false, warum: 'unbekannter Slug zeigt etwas: ' + JSON.stringify(unbekannt) };
      if (r[6].text || r[6].sichtbar) return { ok: false, warum: 'leerer Slug zeigt etwas: ' + JSON.stringify(r[6]) };
      return { ok: true, info: r.slice(0, 5).map(x => x.kat + '→' + x.text).join(' · ') + ' · unbekannt→leer' };
    },
  },
  {
    name: 'Anzeige · was die Pruefung abweist, waere auf dem Bildschirm wirklich tot',
    lauf: async () => {
      // Die Struktur-Pruefung ist erst dann eine Aussage ueber die ANZEIGE,
      // wenn ein Fall die Anzeige damit fuettert. Beide abgewiesenen Formen
      // werden hier wirklich gerendert — und muessen scheitern.
      const r = await __seite.evaluate(() => {
        const raus = {};
        const meldungen = [];
        const echt = window.showProfileToast;
        window.showProfileToast = (t) => meldungen.push(String(t));
        const zeig = (opts, ci) => {
          meldungen.length = 0;
          try {
            openDailyQuizFromSupa({ id: '00000000-0000-0000-0000-0000000000bb',
              question: 'Welche Pflanze traegt weisse Doldenblueten?',
              options: JSON.parse(JSON.stringify(opts)), correct_idx: ci,
              explanation: 'Der Holunder.', category: 'identification', xp_reward: 10 });
          } catch (e) { meldungen.push('Ausnahme: ' + e.message); }
          return { meldungen: meldungen.slice(), sichtbar: Array.from(document.querySelectorAll('.dq-opt')).map((b) => b.textContent.trim()) };
        };
        raus.objekte = zeig([{ label: 'Holunder' }, { label: 'Baerlauch' }, { label: 'Giersch' }, { label: 'Brennnessel' }], 0);
        raus.gemischt = zeig(['Holunder', { label: 'Baerlauch' }, { label: 'Giersch' }, { label: 'Brennnessel' }], 0);
        raus.gut = zeig(['Holunder', 'Baerlauch', 'Giersch', 'Brennnessel'], 0);
        window.showProfileToast = echt;
        return raus;
      });
      if (!/keine richtige Antwort/.test(r.objekte.meldungen.join(' '))) {
        return { ok: false, warum: 'Index + Objekte brach NICHT ab: ' + JSON.stringify(r.objekte) };
      }
      if (!r.gemischt.sichtbar.some((t) => /\[object Object\]/.test(t))) {
        return { ok: false, warum: 'gemischt zeigte kein [object Object]: ' + JSON.stringify(r.gemischt.sichtbar) };
      }
      if (r.gut.sichtbar.length !== 4 || r.gut.meldungen.length) {
        return { ok: false, warum: 'die GUTE Form rendert nicht: ' + JSON.stringify(r.gut) };
      }
      return { ok: true, info: 'Objekte → „keine richtige Antwort" · gemischt → [object Object] · Zeichenketten → 4 Optionen' };
    },
  },
  {
    name: 'Anzeige · die Uebersetzung kommt an, wenn ein Sprachpaket da ist (sonst bleibt es fuer immer deutsch)',
    lauf: async () => {
      const r = await __seite.evaluate(() => {
        const vorher = _gsQuizKatLabel('toxicity');
        const echt = window.gsI18n && gsI18n.t;
        try {
          window.gsI18n = window.gsI18n || {};
          gsI18n.t = (k, f) => (k === 'quiz_kat_giftigkeit' ? 'Toxicité' : f);
          const nachher = _gsQuizKatLabel('toxicity');
          return { vorher, nachher };
        } finally { if (echt) gsI18n.t = echt; }
      });
      if (r.vorher !== 'Giftigkeit') return { ok: false, warum: 'deutsch: ' + JSON.stringify(r.vorher) };
      if (r.nachher !== 'Toxicité') return { ok: false, warum: 'Uebersetzung kam nicht an: ' + JSON.stringify(r.nachher) };
      return { ok: true, info: 'Giftigkeit → Toxicité' };
    },
  },
];

(async () => {
  const R = await import(path.resolve(WURZEL, 'supabase', 'functions', '_shared', 'quiz_gen_regeln.mjs'));
  MODUL = R;
  console.log('\n=== quiz_gen_check — kommt nur eine Frage in die Tabelle, die man auch anzeigen kann?');
  let kaputt = 0;
  console.log('  [Rechnung — supabase/functions/_shared/quiz_gen_regeln.mjs in Node]');
  for (const f of FAELLE) {
    let r;
    try { r = f.lauf(R); } catch (e) { r = { ok: false, warum: 'Ausnahme: ' + e.message.split('\n')[0] }; }
    if (r && r.ok) console.log('  ok   ' + f.name + (r.info ? '   [' + r.info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
  }

  // Ein Fehler in der SQL-Haelfte darf die Anzeige-Haelfte nicht mitreissen —
  // ein Pruefstand, der abstuerzt, hat nichts gemessen, und die fehlenden
  // Faelle tauchen im Bericht nicht einmal als fehlend auf.
  try { sqlHaelfte(); }
  catch (e) { SQLFAELLE.push({ ok: false, name: 'Vorrats-Haelfte (SQL)', warum: 'abgebrochen: ' + String(e.message).split('\n')[0] }); }
  let offen = 0;
  console.log('  [Vorrat — SQL in einem lokalen Postgres, Migration 20260914_quiz_vorrat.sql NICHT angewandt]');
  for (const f of SQLFAELLE) {
    if (f.ok === null) { offen++; console.log('  ??   ' + f.name + '\n         → ' + f.warum); }
    else if (f.ok) console.log('  ok   ' + f.name + (f.info ? '   [' + f.info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + f.warum); }
  }

  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 412, height: 915 } });
  const p = await ctx.newPage(); __seite = p;
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await p.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await p.addInitScript(SEED);
  await p.goto('file://' + INDEX, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForTimeout(4000);
  await p.evaluate(() => {
    document.documentElement.classList.remove('gs-preauth');
    window.gsRequire = () => true;
    window.gsToast = () => {}; window.showProfileToast = () => {}; window.gsHaptic = () => {};
    window.sbFetch = async () => ({ data: [], error: null });
    window.__qg = {
      oeffnen: (kat) => openDailyQuizFromSupa({
        id: '00000000-0000-0000-0000-0000000000aa',
        question: 'Welche Pflanze traegt im Mai weisse Doldenblueten?',
        options: ['Holunder', 'Baerlauch', 'Giersch', 'Brennnessel'],
        correct_idx: 0, explanation: 'Der Holunder.', category: kat, xp_reward: 10,
      }),
    };
  });
  console.log('  [Anzeige — Playwright, ohne Netz]');
  for (const f of APP) {
    let r;
    try { r = await f.lauf(); } catch (e) { r = { ok: false, warum: 'Ausnahme: ' + e.message.split('\n')[0] }; }
    if (r && r.ok) console.log('  ok   ' + f.name + (r.info ? '   [' + r.info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
  }
  await br.close();

  console.log('  ---');
  console.log('  Fälle geprueft: ' + (FAELLE.length + SQLFAELLE.length + APP.length) + ' · davon kaputt: ' + kaputt + (offen ? ' · nicht pruefbar: ' + offen + ' (Vorrats-Haelfte ohne lokales Postgres)' : ''));
  console.log('  JS-Fehler waehrend der Pruefung: ' + (errs.length ? errs.length + ' (' + errs.slice(0, 2).join(' | ') + ')' : 'keine'));
  console.log('  Grenze: ohne Deno und ohne Netz zur KI. Geprueft ist, was VOR dem Insert gerechnet');
  console.log('  wird und was danach auf dem Bildschirm steht — nicht, ob die KI sich an das');
  console.log('  Vokabular haelt und nicht, ob die Live-Tabelle aufgeraeumt wird (kein DDL/DML).');
  process.exitCode = kaputt ? 1 : (offen ? 2 : 0);
})();
