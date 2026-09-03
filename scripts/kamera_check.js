#!/usr/bin/env node
/**
 * kamera_check.js — stimmt, was der Scanner über seine Kamera behauptet?
 *
 * Anlass ist Fernandos Satz: „immer wenn ich ein Scan machen möchte ist die
 * Kamera in einem Zoom." Sie war es nie. Zwei Ursachen, beide im Code:
 *
 *  1. Die App forderte **1920×1080** an — Querformat — und zeigte es mit
 *     `object-fit: cover` in einem hochkanten Streifen. Nachgerechnet für ein
 *     typisches Telefon: **69 % des Bildwinkels lagen ausserhalb.** Das sieht
 *     aus wie ein Zoom, ist aber ein Zuschnitt.
 *  2. `gsSetZoom` klemmte auf eine **geratene** Spanne 1,0–5,0. Auf Telefonen,
 *     deren Weitwinkel bei `zoom.min = 0.5` beginnt, war der weiteste
 *     Bildwinkel damit unerreichbar — die Klemme schob jeden Versuch zurück.
 *
 * ECHTE HARDWARE lässt sich von hier aus nicht fahren. Die LEITER-LOGIK
 * dagegen vollständig: gestellte `getCapabilities`, gestellte Geräteliste,
 * gestelltes `applyConstraints`. Genau die Rechnung, die entscheidet, was der
 * Nutzer sieht — und die vorher niemand geprüft hat.
 *
 * GRENZE, ehrlich benannt: ob eine bestimmte Kamera das angeforderte
 * Seitenverhältnis wirklich liefert, sagt nur ein Gerät. Geprüft ist, dass
 * die App das RICHTIGE anfordert und die Antwort des Geräts respektiert.
 *
 *   node scripts/kamera_check.js
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
  console.log('=== kamera_check — stimmt, was der Scanner über seine Kamera behauptet?');
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
    // Den Zustand WIRKLICH herstellen — sonst prüft der Lauf etwas anderes,
    // als er behauptet (die Lehre aus v32.13 und v32.22, hier zum dritten Mal):
    //  · Ohne offenen Scanner-Tab hat `.scan-wrap` keine Grösse; `_gsKamMasse`
    //    fällt dann korrekt auf das Fenster zurück — und beide Messungen
    //    liefern denselben Wert, der Fall wäre grün ohne etwas zu zeigen.
    //  · `video.srcObject = …` WIRFT bei einer Attrappe, weil sie kein echter
    //    MediaStream ist. Der Linsenwechsel schlug daran fehl, nicht am Code.
    document.documentElement.classList.remove('gs-preauth');
    try { if (typeof switchTab === 'function') switchTab('scanner'); } catch (_) {}
    const camSec = document.getElementById('cam-section');
    if (camSec) camSec.style.display = 'flex';
    await new Promise(r2 => setTimeout(r2, 300));
    const vEl = document.getElementById('video');
    if (vEl) {
      try {
        Object.defineProperty(vEl, 'srcObject', { configurable: true, get(){ return null; }, set(){} });
        vEl.play = () => Promise.resolve();
      } catch (_) {}
    }

    // ── Eine Kamera-Attrappe, die sich wie eine echte verhält ────────────
    function machTrack(caps, start) {
      let jetzt = start;
      let abgelehnt = false;
      return {
        readyState: 'live',
        _abweisen(v) { abgelehnt = v; },
        getCapabilities: () => JSON.parse(JSON.stringify(caps)),
        getSettings: () => ({ zoom: jetzt, deviceId: caps._id || 'd0' }),
        applyConstraints: async (c) => {
          if (abgelehnt) throw new Error('OverconstrainedError');
          const z = c && c.advanced && c.advanced[0] && c.advanced[0].zoom;
          if (typeof z === 'number') jetzt = z;
        },
        stop() {},
      };
    }
    function machStream(track) {
      return { getVideoTracks: () => [track], getTracks: () => [track] };
    }
    // `stream` ist ein `var` im Skript-Bereich — ohne `window.` zuweisen,
    // sonst legt man eine zweite, unbenutzte Eigenschaft an (Lehre aus v32.24).
    const setzeStream = (t) => { stream = machStream(t); };

    // ── 1 · Der Zuschnitt: folgt das Seitenverhältnis dem Behälter? ──────
    //
    // Der Behälter muss dafür eine MESSBARE Grösse haben. `#cam-section` steht
    // im Ruhezustand auf `display:none` — dann liefert `_gsKamMasse` korrekt
    // den Fensterwert, und beide Messungen wären gleich. Ein Fall, der so
    // grün wird, hat nichts gezeigt: deshalb wird die hergestellte Grösse
    // MITGEMESSEN und der Fall fällt durch, wenn sie 0 ist.
    // Der Behälter hängt unter `#screen-scanner`, und das steht ausserhalb des
    // laufenden Scans auf `display:none` — ein verborgener Vorfahre macht JEDE
    // Grösse zu 0, auch bei `position:fixed`. Für die Messung wandert er
    // deshalb kurz an den Körper und danach zurück. Geprüft wird die FUNKTION,
    // nicht die Bildschirm-Verwaltung.
    const wrap = document.querySelector('.scan-wrap');
    const heim = wrap && wrap.parentElement;
    const platz = wrap && wrap.nextSibling;
    if (wrap) document.body.appendChild(wrap);
    const messeMit = (bw, bh) => {
      wrap.style.cssText = 'position:fixed;left:0;top:0;width:' + bw + 'px;height:' + bh + 'px;min-height:0;';
      const rc = wrap.getBoundingClientRect();
      const q2 = _gsKamMasse();
      return { rect: [Math.round(rc.width), Math.round(rc.height)], q: q2.aspectRatio.ideal,
               w: q2.width.ideal, h: q2.height.ideal };
    };
    let hoch = null, quer = null, zurueck = null;
    if (wrap) {
      const alt = wrap.getAttribute('style') || '';
      hoch = messeMit(400, 800);
      quer = messeMit(800, 300);
      wrap.setAttribute('style', alt);
      if (heim) { if (platz) heim.insertBefore(wrap, platz); else heim.appendChild(wrap); }
      zurueck = _gsKamMasse().aspectRatio.ideal;   // wieder verborgen → Fenster-Rückfall
    }
    aus.masse = hoch; aus.masseQuer = quer; aus.masseRueckfall = zurueck;

    // ── 2/3 · Spanne vom Gerät, weitester Punkt erreichbar ───────────────
    const t1 = machTrack({ zoom: { min: 0.5, max: 8, step: 0.1 }, _id: 'weit' }, 1);
    setzeStream(t1);
    aus.spanne = gsKam.spanne();
    await gsResetZoom();
    aus.nachReset = t1.getSettings().zoom;

    // ── 4/5 · Am Anschlag wechselt die Linse ─────────────────────────────
    const linsen = [
      { deviceId: 'weit',  label: 'Ultraweitwinkel-Kamera', kurz: 'Weit' },
      { deviceId: 'haupt', label: 'Rückkamera',             kurz: 'Haupt' },
      { deviceId: 'tele',  label: 'Teleobjektiv-Kamera',    kurz: 'Tele' },
    ];
    const gewechselt = [];
    gsKam._setLinsen(linsen, 0);
    // Den Linsenwechsel abfangen: echtes getUserMedia gibt es hier nicht.
    navigator.mediaDevices.getUserMedia = async (c) => {
      const id = c && c.video && c.video.deviceId && c.video.deviceId.exact;
      gewechselt.push(id);
      const neu = machTrack({ zoom: { min: 1, max: 4, step: 0.1 }, _id: id }, 1);
      const st = machStream(neu);
      // Die App setzt `stream` selbst — hier nur zurückgeben.
      return st;
    };
    // Auf das obere Ende stellen, dann einen Schritt weiter.
    await gsKam.setzen(8);
    aus.vorWechsel = { zoom: t1.getSettings().zoom, idx: gsKam._idx() };
    await gsKam.schritt(+1);
    aus.nachOben = { idx: gsKam._idx(), gewechseltZu: gewechselt[gewechselt.length - 1], zoom: gsKam.wert() };

    // Und zurück: am unteren Ende auf die vorige Linse.
    await gsKam.setzen(gsKam.spanne().min);
    await gsKam.schritt(-1);
    aus.nachUnten = { idx: gsKam._idx(), gewechseltZu: gewechselt[gewechselt.length - 1] };

    // ── 6 · Ohne Zoom-Fähigkeit sind die Linsen die Stufen (iOS) ─────────
    const ohne = machTrack({ _id: 'haupt' }, 1);   // keine zoom-Fähigkeit
    setzeStream(ohne);
    gsKam._setLinsen(linsen, 1);
    aus.ohneZoomSpanne = gsKam.spanne();
    const vorher = gewechselt.length;
    await gsKam.schritt(+1);
    aus.ohneZoomWechsel = { neu: gewechselt.length > vorher, idx: gsKam._idx() };

    // ── 7 · Die Anzeige nennt nur Bestätigtes ────────────────────────────
    const t2 = machTrack({ zoom: { min: 1, max: 5, step: 0.1 }, _id: 'haupt' }, 2);
    setzeStream(t2);
    gsKam._setLinsen(linsen, 1);
    gsKam.anzeigen();
    const vorAnzeige = (document.getElementById('gs-zoom-label') || {}).textContent;
    t2._abweisen(true);
    const abgelehnt = await gsKam.setzen(4.5);
    aus.abgelehnt = {
      gemeldet: abgelehnt && abgelehnt.ok,
      anzeigeGleich: ((document.getElementById('gs-zoom-label') || {}).textContent === vorAnzeige),
      anzeige: vorAnzeige,
    };
    t2._abweisen(false);

    // ── 8 · Keine Linse mehr da → sagt es, statt still zu bleiben ────────
    let gesagt = null;
    const echt = window.showProfileToast;
    window.showProfileToast = (mm) => { gesagt = typeof mm === 'string' ? mm : ((mm && (mm.title || mm.body)) || 'Meldung'); };
    gsKam._setLinsen(linsen, 2);
    const t3 = machTrack({ zoom: { min: 1, max: 4, step: 0.1 }, _id: 'tele' }, 4);
    setzeStream(t3);
    await gsKam.schritt(+1);
    window.showProfileToast = echt;
    aus.amEnde = gesagt;

    // ── 9 · Die Namen kommen aus der Beschriftung, nicht aus Erfindung ───
    aus.namen = {
      weit:  gsKam.kurz('Ultraweitwinkel-Kamera', 0, 3),
      tele:  gsKam.kurz('Teleobjektiv-Kamera', 2, 3),
      leer:  gsKam.kurz('', 1, 3),
      einzeln: gsKam.kurz('', 0, 1),
    };
    return aus;
  });

  await b.close();

  const H = r.masse, Q = r.masseQuer;
  const gestellt = H && Q && H.rect[0] > 0 && H.rect[1] > 0 && Q.rect[0] > 0;
  const folgt = gestellt && Math.abs(H.q - 0.5) < 0.02 && Math.abs(Q.q - 800 / 300) < 0.05;
  melde('Das angeforderte Seitenverhältnis folgt dem Behälter', folgt,
    folgt ? '400×800 → ' + H.q.toFixed(2) + ' (' + H.w + '×' + H.h + ') · 800×300 → ' + Q.q.toFixed(2) +
            ' · eingeklappt → Fenster-Rückfall ' + Number(r.masseRueckfall).toFixed(2)
      : (!gestellt ? 'der Behälter blieb 0×0 (' + JSON.stringify(H && H.rect) + ') — dann vergleicht dieser Fall zweimal das Fenster und zeigt nichts'
                   : 'hochkant ' + H.q + ' (erwartet 0.50), quer ' + Q.q + ' (erwartet 2.67)'));

  const sp = r.spanne;
  const spOk = sp && sp.min === 0.5 && sp.max === 8;
  melde('Die Zoom-Spanne kommt vom Gerät, nicht aus einer Annahme', spOk,
    spOk ? 'min 0.5 · max 8 · step ' + sp.step : 'gemeldet: ' + JSON.stringify(sp) + ' (erwartet min 0.5 / max 8)');

  const weit = r.nachReset === 0.5;
  melde('Der weiteste Punkt der Linse ist erreichbar', weit,
    weit ? 'gsResetZoom() stellt 0.5×, nicht 1.0×'
      : 'gsResetZoom() landet bei ' + r.nachReset + ' — genau die alte Klemme, die den Weitwinkel unerreichbar machte');

  const oben = r.nachOben.idx === 1 && r.nachOben.gewechseltZu === 'haupt';
  melde('Am oberen Anschlag übernimmt die nächste Linse', oben,
    oben ? 'von Weit (max 8) → Haupt, dort auf deren Minimum'
      : 'nach dem Schritt: Linse ' + r.nachOben.idx + ', gewechselt zu ' + r.nachOben.gewechseltZu);

  const unten = r.nachUnten.idx === 0 && r.nachUnten.gewechseltZu === 'weit';
  melde('Am unteren Anschlag übernimmt die vorige Linse', unten,
    unten ? 'von Haupt (min) → Weit' : 'nach dem Schritt: Linse ' + r.nachUnten.idx + ', gewechselt zu ' + r.nachUnten.gewechseltZu);

  const ios = r.ohneZoomSpanne === null && r.ohneZoomWechsel.neu && r.ohneZoomWechsel.idx === 2;
  melde('Ohne Zoom-Fähigkeit sind die Linsen die Stufen (iOS)', ios,
    ios ? 'keine Spanne gemeldet → + wechselt auf Linse 3'
      : 'Spanne: ' + JSON.stringify(r.ohneZoomSpanne) + ', Wechsel: ' + JSON.stringify(r.ohneZoomWechsel));

  const ehrlich = r.abgelehnt.gemeldet === false && r.abgelehnt.anzeigeGleich;
  melde('Lehnt die Kamera ab, ändert sich die Anzeige nicht', ehrlich,
    ehrlich ? 'Anzeige bleibt bei „' + r.abgelehnt.anzeige + '"'
      : 'gemeldet ok=' + r.abgelehnt.gemeldet + ', Anzeige unverändert=' + r.abgelehnt.anzeigeGleich);

  const sagt = !!(r.amEnde && /nicht|keine|weiter/i.test(r.amEnde));
  melde('Ist keine Linse mehr da, sagt die App das', sagt,
    sagt ? '„' + r.amEnde + '"' : 'es passiert nichts und niemand erfährt warum (' + r.amEnde + ')');

  const n = r.namen;
  const namenOk = n.weit === 'Weit' && n.tele === 'Tele' && n.leer === 'Linse 2' && n.einzeln === 'Kamera';
  melde('Die Objektiv-Namen kommen aus der Beschriftung, sonst eine Nummer', namenOk,
    namenOk ? 'Weit · Tele · ohne Beschriftung „Linse 2" · einzelne „Kamera"' : JSON.stringify(n));

  console.log('  ---');
  console.log('  Fragen geprueft: 9 · davon rot: ' + kaputt);
  console.log('  JS-Fehler: ' + (fehler.length ? fehler.slice(0, 3).join(' | ') : 'keine'));
  console.log('  Nicht prüfbar von hier: ob eine ECHTE Kamera das angeforderte');
  console.log('  Seitenverhältnis liefert. Geprüft ist, dass die App das richtige');
  console.log('  anfordert und die Antwort des Geräts respektiert.');
  process.exitCode = (kaputt || fehler.length) ? 1 : 0;
})();
