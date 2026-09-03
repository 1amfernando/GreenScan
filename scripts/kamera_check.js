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
 *
 *     v32.29 hat daraufhin ein hochkantes Seitenverhältnis ANGEFORDERT — und
 *     damit dasselbe noch einmal getan, nur früher: eine Kamera kann ihren
 *     Bildwinkel nicht vergrössern, ein schmales Format schneidet den SENSOR
 *     zu. Es wurde schlimmer, weil nun auch das Foto beschnitten war.
 *     **Ein Zuschnitt in der Anzeige ist umkehrbar, einer in der Quelle nicht.**
 *     Seit v32.30: kein Seitenverhältnis anfordern, und `object-fit: contain`.
 *  2. `gsSetZoom` klemmte auf eine **geratene** Spanne 1,0–5,0. Auf Telefonen,
 *     deren Weitwinkel bei `zoom.min = 0.5` beginnt, war der weiteste
 *     Bildwinkel damit unerreichbar — die Klemme schob jeden Versuch zurück.
 *
 * v32.32 kamen drei Fragen dazu bzw. wurden geschärft — alle drei Fehler waren
 * auf EINER Aufnahme von Fernandos Telefon zu sehen: eine tote schwarze Fläche
 * unter den Bedienelementen, eine Objektiv-Leiste „Linse 1–4" neben einem
 * Zoom-Regler, der dasselbe schon konnte, und „1.0×" am weitesten Punkt einer
 * Kamera, die dort 0,5× steht.
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

    // ── 1 · Verlangt die App der Kamera etwas Schmales ab? ───────────────
    //
    // v32.29 tat genau das — und schnitt damit den SENSOR zu (31 % Restwinkel
    // bei 16:9). Eine Kamera kann ihren Bildwinkel nicht vergrössern; jedes
    // vorgegebene Seitenverhältnis ist ein Zuschnitt-Auftrag. Diese Frage
    // hält das fest, damit es niemand zurückbaut.
    const m = _gsKamMasse();
    aus.masse = {
      hatAspect: Object.prototype.hasOwnProperty.call(m, 'aspectRatio'),
      w: m.width && m.width.ideal, h: m.height && m.height.ideal,
      exact: JSON.stringify(m).indexOf('exact') >= 0,
    };

    // ── 1b · Beschneidet die Vorschau? ──────────────────────────────────
    const vid = document.getElementById('video');
    aus.anzeige = vid ? getComputedStyle(vid).objectFit : '(kein Video-Element)';

    // ── 1c · Ist das Bild so gross wie möglich UND nie beschnitten? ─────
    //
    // Die Frage hiess bis v32.33 „nimmt der Rahmen das Format des Bildes an?"
    // und mass eine CSS-Variable, die die App aus `videoWidth/videoHeight`
    // schrieb. Die Variable gibt es nicht mehr: `object-fit: contain` in einem
    // bildschirmfüllenden Kasten leistet dasselbe ohne bewegliche Teile.
    //
    // Gemessen wird deshalb, was WIRKLICH zählt — und zwar gerechnet, nicht
    // aus einer Eigenschaft abgelesen: für drei Seitenverhältnisse (quer,
    // hochkant, sehr breit) muss das dargestellte Bild
    //   a) VOLLSTÄNDIG in den Kasten passen  (sonst ist es beschnitten)
    //   b) mindestens eine Kante BERÜHREN    (sonst ist es kleiner als nötig)
    // Beides zusammen ist genau „ganz und so gross wie möglich".
    //
    // Warum drei und nicht eines: mit einem einzigen Verhältnis wäre ein fest
    // verdrahteter Wert nicht von einem rechnenden zu unterscheiden.
    const camSec2 = document.getElementById('cam-section');
    if (camSec2) camSec2.style.setProperty('display', 'flex', 'important');
    const wrap2 = document.querySelector('.scan-wrap');
    const vid2 = document.getElementById('video');
    const fit = getComputedStyle(vid2).objectFit;
    const rw2 = wrap2.getBoundingClientRect();
    const rv2 = vid2.getBoundingClientRect();
    const rechne = (w, h) => {
      // Was der Browser bei diesem `object-fit` mit einem w×h-Bild macht.
      const sx = rv2.width / w, sy = rv2.height / h;
      const sk = (fit === 'cover') ? Math.max(sx, sy)
               : (fit === 'contain') ? Math.min(sx, sy) : null;
      if (sk === null) return { fit, ganz: false, gross: false };
      const bw = w * sk, bh = h * sk;
      return {
        bild: [Math.round(bw), Math.round(bh)],
        ganz:  bw <= rv2.width + 1 && bh <= rv2.height + 1,
        gross: Math.abs(bw - rv2.width) < 1 || Math.abs(bh - rv2.height) < 1,
      };
    };
    aus.bild = {
      kasten: [Math.round(rv2.width), Math.round(rv2.height)],
      rahmen: [Math.round(rw2.width), Math.round(rw2.height)],
      fuellt: Math.abs(rv2.width - rw2.width) < 1 && Math.abs(rv2.height - rw2.height) < 1,
      quer:     rechne(4, 3),
      hochkant: rechne(3, 4),
      breit:    rechne(16, 9),
    };

    // ── 1d · Bleibt unten eine tote Fläche? ─────────────────────────────
    //
    // v32.31 hat den RAHMEN aufs Bildformat geschrumpft. Die Bedienelemente
    // hängen aber mit `position:absolute; bottom:0` an ihm — sie rutschten
    // also mit nach oben, und darunter blieb ein Viertel des Bildschirms
    // schwarz und leer. Auf einer Aufnahme von Fernandos Telefon sofort zu
    // sehen, in keinem Prüfstand.
    //
    // **Ein Rahmen, an dem etwas anderes hängt, darf sich nicht nach seinem
    // Inhalt richten.**
    //
    // Der BEZUG ist die Stelle, an der ich mich dreimal vertan habe:
    //  · Rahmen gegen Abschnitt — beide schrumpfen gemeinsam, immer erfüllt.
    //  · Knöpfe gegen die Tab-Leiste — die ist auf dem Scanner ausgeblendet
    //    (`body.gs-scanner-active .tabs{display:none}`), ihr Rechteck ist
    //    0×0, und die Frage rechnete mit lauter Nullen: grün ohne Aussage.
    //  · Knöpfe gegen den Bildschirm, SOLANGE der Ausweich-Block
    //    „Foto hochladen" sichtbar ist — der erscheint nur, wenn die Kamera
    //    NICHT läuft, und verschiebt alles darunter.
    //  · Knöpfe gegen `#screen-scanner` — der Kasten ist genau dann richtig,
    //    wenn der Fehler NICHT da ist: mit dem v32.31-Zustand schrumpft er
    //    selbst auf 389 px mit, und die gemeldete Lücke wäre 80 statt 470 px.
    //    Ein Bezug, der mit dem Fehler mitwandert, verharmlost ihn.
    // Richtig ist der einzige Kasten, der nie mitwandert: `#app` ist
    // `position:fixed` über den ganzen Bildschirm. Seine Unterkante IST die
    // Unterkante des Geräts.
    const upl = document.getElementById('upload-section');
    if (upl) upl.style.display = 'none';
    // Die Eintritts-Animation (`.screen.active > *`, .42s, `both`) startet in
    // dem Moment, in dem der Abschnitt sichtbar wird, und beginnt bei
    // `translateY(12px)`. Wer sofort misst, misst einen KEYFRAME und liest
    // 16 px Versatz, die es eine halbe Sekunde später nicht mehr gibt.
    await new Promise(r3 => setTimeout(r3, 700));
    const app = document.getElementById('app');
    const rcS = app ? app.getBoundingClientRect()
                    : { bottom: window.innerHeight, height: window.innerHeight, top: 0 };
    const rcC = document.getElementById('cam-section').getBoundingClientRect();
    const rcB = document.querySelector('.scan-ctrls').getBoundingClientRect();
    aus.flaeche = {
      luecke: Math.round(rcS.bottom - rcB.bottom),
      schirm: Math.round(rcS.height),
      belegt: Math.round(rcB.bottom - rcC.top),
    };

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

  const M = r.masse;
  const frei = M && !M.hatAspect && !M.exact;
  melde('Die App verlangt der Kamera KEIN Seitenverhältnis ab', frei,
    frei ? 'nur ein Auflösungswunsch ' + M.w + '×' + M.h + ' (4:3, nativ), kein aspectRatio, kein exact'
      : 'angefordert wird ' + JSON.stringify(M) + ' — ein vorgegebenes Seitenverhältnis ist ein '
        + 'Zuschnitt-Auftrag an den Sensor und nimmt Bildwinkel WEG (v32.29-Fehler)');

  const B = r.bild;
  const ganzUndGross = B && B.fuellt
    && B.quer.ganz && B.quer.gross
    && B.hochkant.ganz && B.hochkant.gross
    && B.breit.ganz && B.breit.gross;
  melde('Das Bild ist ganz zu sehen und so gross wie der Bildschirm es zulässt', ganzUndGross,
    ganzUndGross ? 'Rahmen ' + B.rahmen.join('×') + ' voll genutzt · quer ' + B.quer.bild.join('×')
      + ' · hochkant ' + B.hochkant.bild.join('×') + ' · breit ' + B.breit.bild.join('×')
      + ' — jedes passt ganz hinein und berührt eine Kante'
      : JSON.stringify(B) + ' — „ganz" heisst: nichts ragt über den Kasten hinaus (sonst beschnitten). '
        + '„So gross wie möglich" heisst: mindestens eine Kante wird berührt (sonst kleiner als nötig)');

  const F = r.flaeche;
  const kein_loch = F && Math.abs(F.luecke) <= 4;
  melde('Unter den Bedienelementen bleibt keine tote Fläche', kein_loch,
    kein_loch ? 'Kamerabereich ' + F.belegt + ' px hoch, Knöpfe an der Unterkante des '
      + F.schirm + '-px-Bildschirms'
      : F.luecke + ' px leer unter den Knöpfen (belegt ' + F.belegt + ' von '
        + F.schirm + ' px) — ein Rahmen, an dem etwas hängt, darf sich nicht '
        + 'nach seinem Inhalt richten (v32.31-Fehler)');

  const ganz = r.anzeige === 'contain';
  melde('Die Vorschau zeigt das ganze Bild, statt es zu beschneiden', ganz,
    ganz ? 'object-fit: contain — dunkle Ränder statt fehlendem Bildwinkel'
      : 'object-fit: ' + r.anzeige + ' — „cover" füllt den Rahmen, indem es beschneidet (auf einem '
        + 'hochkanten Telefon 69 % des Bildwinkels)');

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
  console.log('  Fragen geprueft: 12 · davon rot: ' + kaputt);
  console.log('  JS-Fehler: ' + (fehler.length ? fehler.slice(0, 3).join(' | ') : 'keine'));
  console.log('  Nicht prüfbar von hier: wie breit der Bildwinkel einer ECHTEN');
  console.log('  Kamera ausfällt. Geprüft ist, dass die App ihn nirgends WEGNIMMT');
  console.log('  — weder durch eine Anforderung noch durch die Anzeige.');
  process.exitCode = (kaputt || fehler.length) ? 1 : 0;
})();
