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


  // ── v32.78 (Audit E1): kommen Rückmeldungen, placeholder, aria-label, Menü-Labels
  // und Datumsformate in der Sprache der Person an? gsI18n.tText (v30.18) übersetzt
  // per Phrase — aber nur, was auch im Paket steht. Der Sammler liest die Phrasen
  // jetzt aus dem eigenen Quelltext; hier wird (a) der Extraktor gegen die Datei
  // gerechnet und (b) mit einem gestellten Phrasen-Paket in fr gemessen, was die
  // App RENDERT. Deutsch bleibt unberührt (tText gibt bei 'de' das Original zurück).
  const quelle = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const toLocRest = (quelle.match(/toLocale(?:Date|Time|)String\('de-CH'/g) || []).length;
  melde(toLocRest === 0, 'Kein toLocale*String mit festem de-CH mehr — gsLocale() entscheidet',
        toLocRest === 0 ? 'gsLocale() ' + (quelle.match(/gsLocale\(\)/g) || []).length + '× · Definition ' + (quelle.match(/^function gsLocale\(\)/gm) || []).length + '×'
          : toLocRest + ' Stellen mit \'de-CH\'');
  const br3 = await chromium.launch();
  const ctx3 = await br3.newContext({ viewport: { width: 412, height: 915 } });
  const p3 = await ctx3.newPage();
  const errs3 = [];
  p3.on('pageerror', e => errs3.push(e.message.split('\n')[0]));
  await p3.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await p3.addInitScript(SEED);
  await p3.addInitScript(() => {
    try {
      localStorage.setItem('gs_lang', 'fr');
      localStorage.setItem('gs_i18n_bundles', JSON.stringify({ bundles: { fr: { settings_plan_word: 'PRUEFSTAND-FR' } }, ts: { fr: Date.now() } }));
      localStorage.setItem('gs_i18n_srcmaps', JSON.stringify({ fr: {
        'Bild konnte nicht gelesen werden.': 'PRUEFSTAND: image illisible.',
        'Pflanze suchen…': 'PRUEFSTAND: chercher une plante…',
        'Schliessen': 'PRUEFSTAND-Fermer',
        'Messwerte': 'PRUEFSTAND-Mesures',
      } }));
    } catch (e) {}
  });
  await p3.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p3.waitForTimeout(3500);
  const e1 = await p3.evaluate(async (quelltext) => {
    const r = {};
    try { document.documentElement.classList.remove('gs-preauth'); } catch (_) {}
    // (a) Extraktor — reine Funktion, gegen den Dateiinhalt
    const ex = window.gsI18nMeldungenAusQuelltext ? window.gsI18nMeldungenAusQuelltext(quelltext) : null;
    const vals = ex ? Object.values(ex) : [];
    r.extraktor = { n: vals.length, bild: vals.includes('Bild konnte nicht gelesen werden.'), kurz: vals.filter(v => v.length < 2).length, lang: vals.filter(v => v.length >= 120).length };
    const dok = window.gsI18nDokumentPhrasen ? Object.values(window.gsI18nDokumentPhrasen()) : [];
    r.dokument = { n: dok.length, placeholder: dok.includes('Pflanze suchen…'), aria: dok.includes('Schliessen'), menue: dok.includes('Messwerte') };
    // (b) gerendert in fr
    r.lang = window.gsI18n && gsI18n.getLang();
    r.locale = typeof gsLocale === 'function' ? gsLocale() : null;
    r.datum = new Date(2026, 0, 5).toLocaleDateString(r.locale || 'de-CH');
    // Beim Start steht schon ein Toast in der Warteschlange („Sprache: Französisch") — der eigene kommt danach; warten, bis er dran ist
    try { showProfileToast('Bild konnte nicht gelesen werden.'); } catch (_) {}
    r.toast = '';
    for (let i = 0; i < 40; i++) { await new Promise(res => setTimeout(res, 200)); const tb = document.querySelector('.gs-toast .gs-toast-body'); r.toast = tb ? tb.textContent : ''; if (/illisible|Bild konnte/.test(r.toast)) break; }
    const ps = document.getElementById('plants-search'); r.placeholder = ps ? ps.getAttribute('placeholder') : null; r.placeholderOrig = ps ? ps.getAttribute('data-i18n-orig-placeholder') : null;
    r.ariaFermer = document.querySelectorAll('[aria-label="PRUEFSTAND-Fermer"]').length; r.ariaSchliessen = document.querySelectorAll('[aria-label="Schliessen"]').length;
    try { searchMenu('mesures'); } catch (e) { r.menuFehler = e.message; }
    const mr = document.getElementById('menu-search-results'); r.menue = mr ? mr.textContent : '';
    try { clearMenuSearch(); } catch (_) {}
    // v32.79: der Quelltext-Scan gehoert an den Admin-Knopf. Ein Sprachwechsel darf
    // die eigene index.html NICHT erneut holen (5,7 MB, und der Service Worker legt
    // sie ein zweites Mal ab — offline_check „in zwei Caches gleichzeitig").
    const echtFetch = window.fetch, echtGsFetch = window._gsFetch, geholt = [];
    const stub = function (u) { geholt.push(String(u)); return Promise.resolve({ ok: false, status: 599, json: async () => ({}), text: async () => '' }); };
    window.fetch = stub; window._gsFetch = stub;
    try { await gsBuildI18n(['fr']); } catch (_) {}
    r.ohneOpts = geholt.filter(u => /index\.html/.test(u)).length;
    geholt.length = 0;
    try { await gsBuildI18n(['fr'], { ausQuelltext: true }); } catch (_) {}
    r.mitOpts = geholt.filter(u => /index\.html/.test(u)).length;
    window.fetch = echtFetch; window._gsFetch = echtGsFetch;
    // zurück nach Deutsch: das Original steht wieder da
    try { gsI18n.setLang('de'); gsI18n.applyToDOM(); } catch (_) {}
    r.placeholderDe = ps ? ps.getAttribute('placeholder') : null;
    return r;
  }, quelle);
  await br3.close();
  melde(e1.extraktor.n >= 500 && e1.extraktor.bild && e1.extraktor.kurz === 0 && e1.extraktor.lang === 0,
        'Der Sammler liest die Rückmeldungen aus dem eigenen Quelltext (≥ 500 Phrasen, 2–119 Zeichen)',
        e1.extraktor.n + ' Phrasen · Bild-Satz ' + (e1.extraktor.bild ? 'dabei' : 'FEHLT') + ' · zu kurz ' + e1.extraktor.kurz + ' · zu lang ' + e1.extraktor.lang);
  melde(e1.dokument.placeholder && e1.dokument.aria && e1.dokument.menue,
        'Der Sammler nimmt placeholder, aria-label und Menü-Labels mit',
        e1.dokument.n + ' Dokument-Phrasen · placeholder ' + e1.dokument.placeholder + ' · aria ' + e1.dokument.aria + ' · Menü ' + e1.dokument.menue);
  melde(/PRUEFSTAND: image illisible/.test(e1.toast), 'Ein Toast erscheint in der Sprache der Person (Phrase im Paket)', 'Toast: „' + String(e1.toast).slice(0, 60) + '"');
  melde(e1.placeholder === 'PRUEFSTAND: chercher une plante…' && e1.placeholderOrig === 'Pflanze suchen…' && e1.placeholderDe === 'Pflanze suchen…',
        'placeholder wird per Phrase übersetzt — und findet nach Deutsch zurück',
        'fr „' + e1.placeholder + '" · Original „' + e1.placeholderOrig + '" · de „' + e1.placeholderDe + '"');
  melde(e1.ariaFermer > 0 && e1.ariaSchliessen === 0, 'aria-label wird per Phrase übersetzt (alle Schliessen-Knöpfe)', e1.ariaFermer + '× Fermer · ' + e1.ariaSchliessen + '× Schliessen übrig');
  melde(/PRUEFSTAND-Mesures/.test(e1.menue), 'Die Menü-Suche findet und zeigt das übersetzte Label', e1.menuFehler ? 'Fehler: ' + e1.menuFehler : 'Suche „mesures" → ' + (/PRUEFSTAND-Mesures/.test(e1.menue) ? 'Mesures' : String(e1.menue).slice(0, 60)));
  melde(e1.locale === 'fr-CH' && /^05\.01\.2026$/.test(e1.datum), 'gsLocale() folgt der Sprache, das Datum auch', 'Sprache ' + e1.lang + ' → ' + e1.locale + ' · 5. Januar 2026 → „' + e1.datum + '"');
  // Der Admin-Knopf: i18n-translate lässt nur Admins zu, und beim Sprachwechsel läuft gsBuildI18n
  // nur bei fehlendem oder altem Paket — neue Phrasen in einem vorhandenen Paket bestellt sonst niemand.
  const knopf = /onclick="gsAdminBuildI18n\(\)"/.test(quelle) && /^async function gsAdminBuildI18n\(\)/m.test(quelle) && /gsBuildI18n\(\[sprachen\[i\]\], \{ ausQuelltext: true \}\)/.test(quelle);
  melde(knopf && e1.ohneOpts === 0 && e1.mitOpts === 1,
        'Nur der Admin-Knopf liest den Quelltext — ein Sprachwechsel holt die eigene index.html NICHT erneut',
        (knopf ? 'Knopf + Funktion + ausQuelltext-Flag' : 'Knopf/Funktion/Flag fehlt') + ' · Sprachwechsel ' + e1.ohneOpts + '× index.html · Admin-Weg ' + e1.mitOpts + '×');
  if (errs3.length) melde(false, 'Keine JS-Fehler im fr-Lauf', errs3.slice(0, 2).join(' | '));

  console.log('  ---');
  console.log('  Schlüssel: ' + tab.size + ' Einträge · ' + alle.size + ' verwendet');
  console.log('  Nicht geprüft (braucht Netz und Sprachkenntnis): ob die Übersetzung in der');
  console.log('  Datenbank existiert und gut ist. Dieser Stand prüft die SCHICHT.');
  console.log('  JS-Fehler: ' + ((errs.length + errs2.length) ? (errs.length + errs2.length) + ' (' + [...errs, ...errs2].slice(0, 2).join(' | ') + ')' : 'keine'));
  process.exitCode = (rot || errs.length || errs2.length) ? 1 : 0;
})();
