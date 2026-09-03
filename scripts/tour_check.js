#!/usr/bin/env node
/**
 * tour_check.js — zeigt die App-Tour auf etwas, oder erzählt sie nur?
 *
 * Fernando wollte „eine bessere App Tour". Vor dem Bauen gemessen, und die
 * Zahlen waren eindeutig:
 *
 *   · Karte 2 sagte „Tippe unten auf ‚Scanner'" — und die Tab-Leiste war in
 *     genau diesem Moment **0×0 gross**. Die Karte rief `switchTab('scanner')`,
 *     das setzt `body.gs-scanner-active`, und die Regel dazu blendet die
 *     Leiste aus. Die Tour zeigte auf einen Knopf, den sie selbst versteckt
 *     hatte.
 *   · Kein Zurück-Knopf. Wer eine Karte zu schnell weggetippt hatte, kam
 *     nicht mehr hin.
 *   · Escape schloss nicht, Pfeiltasten taten nichts.
 *   · **Nichts wurde hervorgehoben** — die Tour zeigte auf kein einziges
 *     echtes Element.
 *   · Null Übersetzungsschlüssel, in einer App mit fünf Sprachen.
 *
 * Daraus die Leitregel dieses Prüfstands:
 *
 *   **Eine Tour, die nur erzählt, ist ein Text. Eine Tour, die ZEIGT, ist
 *   eine Tour.** Und was sie zeigt, muss sichtbar sein — sonst zeigt sie
 *   auf nichts.
 *
 * GRENZE: geprüft wird, ob die Tour auf ein sichtbares Element deutet und ob
 * sie bedienbar ist. Ob die Texte GUT sind, kann kein Prüfstand sagen.
 *
 *   node scripts/tour_check.js
 */
const path = require('path');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const SEED = require('./_seed.js');

let kaputt = 0;
const melde = (frage, ok, wie) => {
  if (!ok) kaputt++;
  console.log('  ' + (ok ? 'ok  ' : '!!  ') + ' ' + frage + (ok ? '   [' + wie + ']' : ''));
  if (!ok) console.log('         → ' + wie);
};

(async () => {
  console.log('=== tour_check — zeigt die App-Tour auf etwas, oder erzählt sie nur?');
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 412, height: 915 } })).newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(e.message.split('\n')[0]));
  await page.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.addInitScript(SEED);
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3500);

  const r = await page.evaluate(async () => {
    const aus = {};
    document.documentElement.classList.remove('gs-preauth');
    const warte = (ms) => new Promise(w => setTimeout(w, ms));

    gsTutorial.start();
    await warte(200);
    aus.offen = !!document.getElementById('gs-tutorial');
    aus.schritte = _GS_TUT_STEPS.length;

    // ── 1 · Jede Karte mit Ziel zeigt auf ein SICHTBARES Element ────────
    //
    // Das ist der Kern. Ein Ziel, das im Moment der Karte 0×0 gross ist,
    // ist kein Ziel — genau daran ist die alte Fassung gescheitert.
    aus.ziele = [];
    for (let i = 0; i < _GS_TUT_STEPS.length; i++) {
      gsTutorial._render(i);
      // Der Scheinwerfer GLEITET zum nächsten Element (CSS-Übergang auf
      // top/left/width/height). Wer nach 90 ms misst, misst einen Zwischen-
      // stand: die erste Fassung meldete drei von vier Karten als „passt
      // nicht", obwohl der Ring 300 ms später genau sass. Dieselbe Falle wie
      // in v32.32 — **ein Element, das gerade in Bewegung ist, wird erst nach
      // der Bewegung vermessen.**
      await warte(420);
      const s = _GS_TUT_STEPS[i];
      const spot = document.getElementById('gs-tut-spot');
      const el = s.ziel ? document.querySelector(s.ziel) : null;
      const re = el ? el.getBoundingClientRect() : null;
      const rs = spot ? spot.getBoundingClientRect() : null;
      aus.ziele.push({
        i, ziel: s.ziel || null,
        elDa: !!el,
        elGross: re ? (re.width > 4 && re.height > 4) : null,
        spotSichtbar: spot ? getComputedStyle(spot).display !== 'none' : false,
        // Deckt der Scheinwerfer das Element wirklich ab?
        passt: (re && rs) ? (rs.top <= re.top + 1 && rs.bottom >= re.bottom - 1
                          && rs.left <= re.left + 1 && rs.right >= re.right - 1) : null,
      });
    }

    // ── 2 · Deckt die Karte zu, worauf sie zeigt? ───────────────────────
    //
    // Die Tab-Leiste steht unten, die Karte auch — ohne Ausweichen liegt die
    // Erklärung genau auf dem Erklärten.
    gsTutorial._render(1);
    await warte(120);
    const tab = document.querySelector('#tab-scanner');
    const card = document.getElementById('gs-tut-card');
    const rt = tab.getBoundingClientRect(), rc = card.getBoundingClientRect();
    aus.ueberdeckung = {
      tab: [Math.round(rt.top), Math.round(rt.bottom)],
      karte: [Math.round(rc.top), Math.round(rc.bottom)],
      zielDa: rt.height > 4,
      frei: !(rt.top < rc.bottom && rt.bottom > rc.top),
    };

    // ── 3 · Bedienbar ohne Maus ─────────────────────────────────────────
    gsTutorial._render(2);
    await warte(80);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await warte(80);
    const nachLinks = window._gsTutIdx;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await warte(80);
    const nachRechts = window._gsTutIdx;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await warte(120);
    aus.tastatur = { nachLinks, nachRechts, escapeSchliesst: !document.getElementById('gs-tutorial') };

    // ── 4 · Zurück-Knopf, und nicht auf der ersten Karte ────────────────
    gsTutorial.start();
    await warte(150);
    const knoepfe = (i) => {
      gsTutorial._render(i);
      return Array.from(document.querySelectorAll('#gs-tut-card button')).map(x => x.textContent.trim());
    };
    aus.knoepfe = { erste: knoepfe(0), mitte: knoepfe(2), letzte: knoepfe(_GS_TUT_STEPS.length - 1) };

    // ── 5 · Wechselt die Tour den Bildschirm unter der Erklärung weg? ───
    const tabVor = document.body.className;
    gsTutorial._render(1);
    await warte(120);
    aus.keinTabWechsel = (document.body.className === tabVor);

    // ── 6 · Übersetzbar ────────────────────────────────────────────────
    aus.i18n = {
      mitSchluessel: _GS_TUT_STEPS.filter(s => s.t).length,
      gesamt: _GS_TUT_STEPS.length,
    };
    try { gsTutorial._close(); } catch (_) {}

    // ── 7 · Der Weg zurück: startOnce nur einmal, Neustart immer ────────
    localStorage.removeItem('gs_onboarded_v1');
    aus.einmal = { ersteMal: gsTutorial.startOnce() };
    try { gsTutorial._close(); } catch (_) {}
    aus.einmal.zweitesMal = gsTutorial.startOnce();
    try { gsTutorial._close(); } catch (_) {}
    gsTutorial.start();
    await warte(120);
    aus.einmal.neustartGeht = !!document.getElementById('gs-tutorial');
    try { gsTutorial._close(); } catch (_) {}
    return aus;
  });

  const mitZiel = r.ziele.filter(z => z.ziel);
  const zeigtOk = mitZiel.length >= 3
    && mitZiel.every(z => z.elDa && z.elGross && z.spotSichtbar && z.passt);
  melde('Jede Karte mit Ziel zeigt auf ein SICHTBARES Element', zeigtOk,
    zeigtOk ? mitZiel.length + ' von ' + r.schritte + ' Karten mit Ziel — alle sichtbar und vom Scheinwerfer gedeckt'
      : JSON.stringify(mitZiel) + ' — ein Ziel, das im Moment der Karte 0×0 gross ist, ist kein Ziel; '
        + 'genau daran ist die alte Fassung gescheitert (`switchTab(\'scanner\')` blendet die Tab-Leiste aus)');

  const U = r.ueberdeckung;
  // `zielDa` gehört zwingend dazu: in der Gegenprobe war die Tab-Leiste 0×0,
  // und „kein Überlapp mit einem unsichtbaren Ziel" meldete brav grün. Eine
  // Frage, die im Fehlerfall nicht rot werden kann, prüft nichts.
  // **Wer Überdeckung misst, muss zuerst prüfen, dass es etwas zu überdecken
  // gibt.**
  melde('Die Karte deckt nicht zu, worauf sie zeigt', U.zielDa && U.frei,
    (U.zielDa && U.frei) ? 'Ziel bei ' + U.tab.join('–') + ' px, Karte bei ' + U.karte.join('–') + ' px — kein Überlapp'
      : !U.zielDa ? 'Das Ziel ist ' + U.tab.join('–') + ' px gross, also gar nicht da — '
          + 'ein Überlapp lässt sich damit nicht messen, und „kein Überlapp" wäre eine Falschmeldung'
      : 'Ziel ' + U.tab.join('–') + ' liegt unter der Karte ' + U.karte.join('–')
        + ' — die Erklärung lag auf dem Erklärten');

  const T = r.tastatur;
  const tastOk = T.nachLinks === 1 && T.nachRechts === 2 && T.escapeSchliesst === true;
  melde('Die Tour lässt sich mit der Tastatur bedienen', tastOk,
    tastOk ? '← blättert zurück (2→1), → vor (1→2), Escape schliesst'
      : JSON.stringify(T) + ' — vorher tat die Tastatur gar nichts');

  const K = r.knoepfe;
  const knOk = !K.erste.some(x => /Zurück/.test(x))
    && K.mitte.some(x => /Zurück/.test(x))
    && K.mitte.some(x => /Überspringen/.test(x))
    && !K.letzte.some(x => /Überspringen/.test(x));
  melde('Zurück gibt es ab Karte 2, Überspringen nicht auf der letzten', knOk,
    knOk ? 'erste: ' + K.erste.join(' · ') + ' | mitte: ' + K.mitte.join(' · ') + ' | letzte: ' + K.letzte.join(' · ')
      : JSON.stringify(K) + ' — ohne Zurück kommt niemand zu einer zu schnell weggetippten Karte hin');

  melde('Die Tour zieht den Bildschirm nicht unter der Erklärung weg', r.keinTabWechsel,
    r.keinTabWechsel ? 'kein Tab-Wechsel während einer Karte'
      : 'body.className hat sich beim Rendern geändert — die alte Fassung wechselte auf den Tab, '
        + 'den sie gerade erklärte, und verdeckte damit ihr eigenes Ziel');

  const I = r.i18n;
  melde('Jede Karte ist übersetzbar', I.mitSchluessel === I.gesamt,
    I.mitSchluessel === I.gesamt ? I.gesamt + ' Karten, alle mit Übersetzungsschlüssel'
      : I.mitSchluessel + ' von ' + I.gesamt + ' — in einer App mit fünf Sprachen war die Tour deutsch');

  const E = r.einmal;
  const einmalOk = E.ersteMal === true && E.zweitesMal === false && E.neustartGeht === true;
  melde('Von selbst genau einmal, von Hand immer', einmalOk,
    einmalOk ? 'startOnce: erstes Mal ja, zweites Mal nein · Neustart über die Einstellungen geht immer'
      : JSON.stringify(E) + ' — die letzte Karte verspricht „jederzeit neu starten"');

  console.log('  ---');
  console.log('  Fragen geprueft: 7 · davon rot: ' + kaputt);
  console.log('  JS-Fehler: ' + (fehler.length ? fehler.slice(0, 4).join(' | ') : 'keine'));
  console.log('  Nicht prüfbar von hier: ob die Texte GUT sind. Geprüft ist, dass die');
  console.log('  Tour auf etwas Sichtbares zeigt, es nicht selbst verdeckt und sich');
  console.log('  ohne Maus bedienen lässt.');
  await b.close();
  process.exit(kaputt ? 1 : 0);
})();
