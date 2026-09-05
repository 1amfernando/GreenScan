#!/usr/bin/env node
/**
 * i18n_check.js — kommt in vier Sprachen an, was auf Deutsch dasteht?
 *
 * GreenScan führt fünf Sprachen (DE/EN/ES/FR/IT). Die Übersetzungen liegen in
 * Supabase und werden über die DEUTSCHE PHRASE nachgeschlagen:
 *
 *     keyBundle[key] = srcMap[ GS_I18N_JS_STRINGS[key] ]
 *
 * Daraus folgt die Regel, um die es hier geht: **ein Schlüssel ohne Eintrag in
 * `GS_I18N_JS_STRINGS` wird nie nachgeschlagen.** Er zeigt in allen vier
 * Sprachen seinen deutschen Rückfalltext — für immer, ohne Fehlermeldung,
 * ohne Lücke im Layout. Genau die Sorte Fehler, die diese Session immer
 * wieder gefunden hat: Arbeit, die getan wurde und dann verstummt.
 *
 * Erster Lauf (v32.17): **45 solcher Schlüssel**, darunter der ganze
 * Bildschirm „Mein Naturjahr", die Garten-Bibliothek und die
 * Giftigkeits-Einstufungen. Und acht der ersten fünfzehn geprüften Phrasen
 * waren in der Datenbank längst in allen vier Sprachen übersetzt — die Arbeit
 * war getan, nur gefragt hat niemand.
 *
 * Vier Fragen:
 *
 *   1. Hat jeder `_t(key, …)`-Aufruf einen Eintrag?
 *   2. Stimmt der deutsche Text am Aufrufort mit dem in der Tabelle überein?
 *   3. Hat jedes `data-i18n`-Element einen deutschen Rückfall?
 *   4. Kommt eine Übersetzung wirklich an, wenn es eine gibt? (am laufenden
 *      Programm, mit gestelltem Sprachpaket)
 *
 * **Was er NICHT prüft:** ob die Übersetzung in der Datenbank existiert oder
 * gut ist. Das braucht Netz und einen Menschen, der die Sprache spricht. Er
 * prüft die SCHICHT — ob eine vorhandene Übersetzung überhaupt ankommen kann.
 *
 *   node scripts/i18n_check.js
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const SEED = require('./_seed.js');

const QUELLE = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

function tabelle() {
  const i = QUELLE.indexOf('window.GS_I18N_JS_STRINGS = {');
  const j = QUELLE.indexOf('\n};', i);
  const blk = QUELLE.slice(i, j);
  const m = new Map();
  for (const x of blk.matchAll(/^\s*'([^']+)':\s*'((?:[^'\\]|\\.)*)'/gm)) m.set(x[1], x[2]);
  return m;
}

// Aufrufe MIT Zeichenketten-Rückfall. Ein Aufruf mit berechnetem Rückfall
// (`n === 1 ? … : …`) hat keine EINE deutsche Phrase und ist deshalb gar
// nicht nachschlagbar — er wird unten getrennt gemeldet.
function aufrufe() {
  const mit = new Map();
  for (const x of QUELLE.matchAll(/_t\(\s*'([^']+)'\s*,\s*'((?:[^'\\]|\\.)*)'/g)) {
    if (!mit.has(x[1])) mit.set(x[1], new Set());
    mit.get(x[1]).add(x[2]);
  }
  const alle = new Set([...QUELLE.matchAll(/_t\(\s*'([^']+)'/g)].map(x => x[1]));
  return { mit, alle };
}

(async () => {
  console.log('\n=== i18n_check — kommt in vier Sprachen an, was auf Deutsch dasteht?');
  let rot = 0;
  const melde = (ok, name, info) => {
    if (ok) console.log('  ok   ' + name + (info ? '   [' + info + ']' : ''));
    else { rot++; console.log('  !!   ' + name + '\n         → ' + info); }
  };

  const tab = tabelle();
  const { mit, alle } = aufrufe();

  // ── 1 · Jeder Schlüssel braucht einen Eintrag ────────────────────────
  const ohneEintrag = [...alle].filter(k => !tab.has(k));
  melde(ohneEintrag.length === 0, 'Jeder _t()-Schlüssel hat einen Eintrag in GS_I18N_JS_STRINGS',
        ohneEintrag.length ? ohneEintrag.length + ' ohne Eintrag → in allen vier Sprachen dauerhaft deutsch: ' +
          ohneEintrag.slice(0, 8).join(', ') + (ohneEintrag.length > 8 ? ' …' : '')
        : tab.size + ' Einträge decken ' + alle.size + ' Schlüssel');

  // ── 1b · Datenstrukturen mit BERECHNETEN Schlüsseln ──────────────────
  //
  // `_GS_TUT_STEPS` (die App-Tour) trägt seine Schlüssel als Feld `t` und
  // baut daraus `t + '_title'` / `t + '_body'`. Eine Textsuche nach `_t('…')`
  // sieht davon nichts — dieselbe Lücke wie bei `MENU_ITEMS` und
  // `GS_NOTIF_ZIELE` in `wiring_check`.
  //
  // **Was nur als Datenstruktur existiert, entzieht sich jeder Prüfung, die
  // bloss nach Aufrufen sucht.** Also wird sie hier ausdrücklich eingetragen.
  // Wer eine weitere solche Liste baut, trägt sie ebenso ein.
  const DATENLISTEN = [
    { name: '_GS_TUT_STEPS', feld: 't', endungen: ['_title', '_body'] },
    // v32.55: der Startbestand des Messgroessen-Katalogs — `_gsMetricLabel` baut
    // daraus `metric_<key>` (OEKOSYSTEM-V1.md §11 Idee 22). Praefix statt Endung.
    { name: 'GS_METRIC_KATALOG_START', feld: 'key', endungen: [''], praefix: 'metric_' },
  ];
  const listenLuecken = [];
  let listenSchluessel = 0;
  for (const L of DATENLISTEN) {
    const i2 = QUELLE.indexOf('var ' + L.name + ' = [');
    if (i2 < 0) { listenLuecken.push(L.name + ' (Liste nicht gefunden)'); continue; }
    const blk = QUELLE.slice(i2, QUELLE.indexOf('\n];', i2));
    for (const m of blk.matchAll(new RegExp("\\b" + L.feld + ":\\s*'([^']+)'", 'g'))) {
      for (const e of L.endungen) {
        listenSchluessel++;
        if (!tab.has((L.praefix || '') + m[1] + e)) listenLuecken.push((L.praefix || '') + m[1] + e);
      }
    }
  }
  melde(listenLuecken.length === 0 && listenSchluessel > 0,
        'Auch berechnete Schlüssel aus Datenlisten haben einen Eintrag',
        listenLuecken.length ? listenLuecken.length + ' ohne Eintrag: ' + listenLuecken.slice(0, 8).join(', ')
        : listenSchluessel + ' Schlüssel aus ' + DATENLISTEN.length + ' Datenliste(n) geprüft');

  // ── 2 · Derselbe deutsche Text hier wie dort ─────────────────────────
  // Kein Fehler, der etwas kaputt macht: nachgeschlagen wird über den
  // TABELLENwert, der Rückfall am Aufrufort erscheint nur ohne Übersetzung.
  // Aber ein Widerspruch im deutschen Wortlaut ist einer.
  const entkoppelt = () => (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
                                   .replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  const gleich = entkoppelt();
  const abweichend = [];
  for (const [k, s] of mit) {
    if (!tab.has(k)) continue;
    const soll = gleich(tab.get(k));
    for (const v of s) if (gleich(v) !== soll) { abweichend.push(k + ': Tabelle „' + soll.slice(0, 28) + '" vs Aufruf „' + gleich(v).slice(0, 28) + '"'); break; }
  }
  melde(abweichend.length === 0, 'Der deutsche Text stimmt zwischen Tabelle und Aufrufort überein',
        abweichend.length ? abweichend.length + ' weichen ab (kein Absturz, aber zwei Wahrheiten): ' + abweichend.slice(0, 4).join(' · ')
                          : mit.size + ' Aufrufe geprüft');

  // ── 3 · Aufrufe ohne EINE deutsche Phrase ───────────────────────────
  const berechnet = [...alle].filter(k => !mit.has(k) && tab.has(k));
  const berechnetOhne = [...alle].filter(k => !mit.has(k) && !tab.has(k));
  melde(berechnetOhne.length === 0, 'Kein Schlüssel mit berechnetem Rückfall ohne Eintrag',
        berechnetOhne.length ? berechnetOhne.join(', ') + ' — ein Schlüssel mit zwei möglichen deutschen Texten (Einzahl/Mehrzahl) braucht ZWEI Schlüssel'
                             : berechnet.length + ' Schlüssel ohne Zeichenketten-Rückfall, alle mit Eintrag');

  // ── 4 · Am laufenden Programm ───────────────────────────────────────
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 412, height: 915 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await p.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await p.addInitScript(SEED);
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForTimeout(3500);
  await p.evaluate(() => {
    try { document.documentElement.classList.remove('gs-preauth'); } catch (e) {}
    const o = document.getElementById('gs-onboarding');
    if (o) o.style.setProperty('display', 'none', 'important');
  });

  // data-i18n ohne deutschen Rückfall
  const ohneFallback = await p.evaluate(() => {
    const raus = [];
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const fb = el.getAttribute('data-i18n-fallback');
      const txt = (el.textContent || '').trim();
      if (!fb && !txt) raus.push(el.getAttribute('data-i18n'));
    });
    return raus;
  });
  melde(ohneFallback.length === 0, 'Jedes data-i18n-Element hat einen deutschen Rückfall',
        ohneFallback.length ? ohneFallback.length + ' ohne: ' + ohneFallback.slice(0, 6).join(', ')
                            : 'alle data-i18n-Elemente tragen einen');
  await br.close();

  // ── 5 · Trägt die Schicht wirklich? ─────────────────────────────────
  //
  // Alles darüber liest den QUELLTEXT. Dieser Fall lädt die App ein zweites
  // Mal — mit untergeschobenem Sprachpaket im Cache, den die App beim Start
  // ohnehin liest — und fragt die Anzeige, nicht das Objekt.
  //
  // Zwei Richtungen, und die zweite ist die wichtigere: ein Schlüssel MIT
  // Übersetzung muss sie zeigen, ein Schlüssel OHNE muss sauber auf Deutsch
  // zurückfallen statt den rohen Schlüssel zu zeigen. Ohne die zweite
  // Richtung wäre eine Schicht, die alles auf den Schlüsselnamen wirft,
  // ebenfalls grün.
  const br2 = await chromium.launch();
  const ctx2 = await br2.newContext({ viewport: { width: 412, height: 915 } });
  const p2 = await ctx2.newPage();
  const errs2 = [];
  p2.on('pageerror', e => errs2.push(e.message.split('\n')[0]));
  await p2.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await p2.addInitScript(SEED);
  await p2.addInitScript(() => {
    try {
      localStorage.setItem('gs_lang', 'en');
      localStorage.setItem('gs_i18n_bundles', JSON.stringify({
        bundles: { en: { settings_plan_word: 'PRUEFSTAND-EN' } },
        ts: { en: Date.now() },
      }));
    } catch (e) {}
  });
  await p2.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p2.waitForTimeout(3500);
  const schicht = await p2.evaluate(() => {
    // Die oeffentliche Schnittstelle ist `gsI18n.t`. Ein globales `_t` gibt es
    // NICHT — jede Funktion legt sich einen eigenen, gegen einen noch nicht
    // fertigen `gsI18n` abgesicherten Alias an. Das ist richtig so; wer hier
    // `window._t` prueft, prueft eine Variable, die es nie gab.
    const t = window.gsI18n && window.gsI18n.t;
    if (typeof t !== 'function') return { fehler: 'gsI18n.t nicht erreichbar' };
    return {
      fehler: null,
      mit: t('settings_plan_word', 'Plan'),
      ohne: t('gibt_es_nicht_pruefstand', 'Deutscher Rückfall'),
      rohSchluessel: t('auch_das_gibt_es_nicht', ''),
    };
  });
  await br2.close();

  if (schicht.fehler) {
    melde(false, 'Eine vorhandene Übersetzung kommt an', schicht.fehler);
  } else {
    melde(schicht.mit === 'PRUEFSTAND-EN', 'Eine vorhandene Übersetzung kommt an',
          schicht.mit === 'PRUEFSTAND-EN' ? 'Schlüssel mit Paket → „' + schicht.mit + '"'
            : 'liefert „' + schicht.mit + '" statt der Übersetzung — die Schicht trägt nicht');
    melde(schicht.ohne === 'Deutscher Rückfall', 'Ein Schlüssel ohne Übersetzung fällt auf Deutsch zurück',
          schicht.ohne === 'Deutscher Rückfall' ? 'kein roher Schlüssel in der Anzeige'
            : 'liefert „' + schicht.ohne + '" statt des deutschen Rückfalls');
  }

  console.log('  ---');
  console.log('  Schlüssel: ' + tab.size + ' Einträge · ' + alle.size + ' verwendet');
  console.log('  Nicht geprüft (braucht Netz und Sprachkenntnis): ob die Übersetzung in der');
  console.log('  Datenbank existiert und gut ist. Dieser Stand prüft die SCHICHT.');
  console.log('  JS-Fehler: ' + ((errs.length + errs2.length) ? (errs.length + errs2.length) + ' (' + [...errs, ...errs2].slice(0, 2).join(' | ') + ')' : 'keine'));
  process.exitCode = (rot || errs.length || errs2.length) ? 1 : 0;
})();
