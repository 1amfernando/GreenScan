#!/usr/bin/env node
/**
 * contrast_check.js — misst den WCAG-Kontrast jeder sichtbaren Textstelle in
 * beiden Modi.
 *
 * v31.37: misst jetzt PIXELGENAU. Die erste Fassung las die Hintergrundfarbe
 * aus getComputedStyle und stieg dabei die Elternkette hoch — und uebersprang
 * alles mit background-image, also jeden Farbverlauf. Genau dort lag der
 * schlimmste Fall der ganzen App: „Natur entdecken" im Hero der Startseite mit
 * 1,31:1. Das Werkzeug meldete „0 Stellen unter AA", waehrend die Ueberschrift
 * praktisch unsichtbar war.
 *
 * Jetzt: die Seite wird zweimal aufgenommen — einmal normal, einmal mit
 *   *{color:transparent}
 * Das laesst das Layout unveraendert (Text ENTFERNEN liess es umfliessen und
 * lieferte falsche Koordinaten) und zeigt den reinen Hintergrund. Aus dem
 * zweiten Bild wird unter jeder Textstelle der Median eines kleinen Feldes
 * gelesen. Damit sind Verlaeufe, Bilder und halbtransparente Schichten
 * automatisch richtig beruecksichtigt.
 *
 * Bewusst NICHT gemeldet: reine Emoji — deren color-Eigenschaft sagt nichts
 * ueber die Darstellung.
 *
 *   node scripts/contrast_check.js [datei.html]
 */
const path = require('path');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const FILE = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', 'index.html');
const TABS = ['home','garden','wissen','favs','search','social','market','recipes','remedies'];
// v31.77: Fenster mitmessen. Die Grenze aus CLAUDE.md §7.1 („was in einem
// geschlossenen Fenster steckt, sehen sie nicht") hat mich in v31.76 eine
// Aenderung kosten lassen, die eine Falschmeldung war — und den einen echten
// Fund (der Knopf „Plan speichern", weiss auf #f57c00, 2,70:1) monatelang
// verdeckt. Der KI-Planer ist das groesste dieser Fenster; er wird jetzt
// gerendert und in Bildschirmhoehen durchgescrollt.
const SEED_MOD = require('./_seed.js');
const W = 412, H = 915;

const lum = c => { const s = c.map(v => { v /= 255; return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); });
                   return .2126*s[0] + .7152*s[1] + .0722*s[2]; };
const cr = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1,l2)+.05) / (Math.min(l1,l2)+.05); };

const SEED = () => { try {
  const set = (k, v) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  set('gs_sb_token', 'pruefstand');
  set('gs_sb_expires', String(Date.now() + 2592000000));
  set('gs_sb_display_name', 'Testnutzerin');
  set('gs_lang', 'de');
} catch (e) {} };

// Alle Textstellen im sichtbaren Bereich mit Kasten, Farbe und Deckkraft
const STELLEN = () => {
  const out = [];
  // v31.77: alles, was FEST oder KLEBEND ueber dem Inhalt liegt, einmal
  // einsammeln. Hit-Testing allein reicht nicht: eine Kopfleiste mit
  // pointer-events:none faengt keinen Treffer ab, verdeckt den Text aber
  // trotzdem — und dann wird ein Hintergrund gemessen, den es an dieser
  // Stelle gar nicht gibt. Genau so kamen im Planer-Fenster 1,93:1 fuer eine
  // Marke heraus, die in Wahrheit 7:1 hat.
  const deckel = [];
  document.querySelectorAll('*').forEach(el => {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') return;
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return;
    // Nur was wirklich deckt: eine durchsichtige Huelle verdeckt nichts.
    const bg = (cs.backgroundColor.match(/[\d.]+/g) || []);
    const deckend = (bg.length < 4 || +bg[3] > 0.05) || (cs.backgroundImage && cs.backgroundImage !== 'none') || cs.backdropFilter !== 'none';
    if (!deckend) return;
    deckel.push({ el: el, r: r });
  });
  const verdeckt = (el, r) => deckel.some(d =>
    d.el !== el && !d.el.contains(el) && !el.contains(d.el) &&
    r.left < d.r.right - 1 && r.right > d.r.left + 1 && r.top < d.r.bottom - 1 && r.bottom > d.r.top + 1);

  document.querySelectorAll('*').forEach(el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    // v31.37: inaktive Bedienelemente nimmt WCAG 1.4.3 ausdruecklich aus —
    // ein ausgegrauter Knopf SOLL gedaempft aussehen. Ohne diese Ausnahme
    // meldete der Pruefstand den deaktivierten „Teilen"-Knopf als Fehler.
    if (el.disabled || el.closest('[disabled],[aria-disabled="true"]')) return;
    const t = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
    if (t.length < 2) return;
    // Reine Emoji: die color-Eigenschaft sagt nichts ueber die Darstellung.
    if (!/[a-zA-Z0-9À-ɏ]/.test(t)) return;
    const r = el.getBoundingClientRect();
    if (r.width < 6 || r.height < 6 || r.bottom < 0 || r.top > innerHeight) return;
    // v31.37: nur messen, was an seiner eigenen Stelle auch OBENAUF liegt.
    // Ohne diese Pruefung meldete das Werkzeug Text, der hinter der fixierten
    // Navigationsleiste liegt (z.B. „Mein Garten" bei y=906 von 915) — dort
    // wird ein Hintergrund gemessen, den niemand sieht.
    const mx = Math.round(r.left + r.width/2), my = Math.round(r.top + r.height/2);
    if (mx < 0 || my < 0 || mx >= innerWidth || my >= innerHeight) return;
    // v31.77: nicht nur die MITTE pruefen, sondern auch die Ecken. Im
    // Planer-Fenster liegt eine klebende, halbdurchsichtige Kopfleiste ueber
    // dem Inhalt; ein Text, dessen Mitte noch frei ist, dessen Rand aber
    // schon darunter steckt, wurde gegen einen Hintergrund gemessen, den es
    // an dieser Stelle gar nicht gibt — gemeldet wurden 1,93:1 fuer eine
    // Marke, die in Wahrheit 7:1 hat. Wer nicht ganz frei liegt, wird nicht
    // vermessen.
    const meins = (x, y) => {
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false;
      const o = document.elementFromPoint(x, y);
      return !!o && (o === el || el.contains(o) || o.contains(el));
    };
    if (!meins(mx, my)) return;
    if (!meins(Math.round(r.left) + 3, Math.round(r.top) + 2)) return;
    if (!meins(Math.round(r.right) - 3, Math.round(r.bottom) - 2)) return;
    if (verdeckt(el, r)) return;
    // v31.57: Die Pruefung oben nimmt die MITTE, die Messung weiter unten
    // nimmt die GANZE Box. Solange beide nicht dasselbe pruefen, entsteht
    // genau ein Falschalarm: ein Text, dessen Mitte noch frei liegt, dessen
    // untere Kante aber schon unter der fixierten Leiste steckt. Der
    // Median-Hintergrund ueber die Box ist dann halb Leiste — gemessen 1,27:1
    // an einer Stelle, die in Wahrheit unveraendert und lesbar ist (im selben
    // Lauf gegen origin/main nachgewiesen: identische Farben, identische
    // Kachel, nur 158px tiefer). Wer scrollt, sieht sie ganz.
    // Also: was die Leiste ANSCHNEIDET, wird gar nicht erst vermessen.
    const _leiste = document.querySelector('.tabs');
    if (_leiste) {
      const lr = _leiste.getBoundingClientRect();
      if (lr.height > 0 && r.bottom > lr.top + 1) return;
    }
    let op = 1;
    for (let q = el; q && q !== document.documentElement; q = q.parentElement) op *= parseFloat(getComputedStyle(q).opacity || 1);
    const m = (cs.color.match(/[\d.]+/g) || [0,0,0]).map(Number);
    out.push({
      t: t.slice(0, 34),
      x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
      fg: m.slice(0, 3), alpha: (m.length > 3 ? m[3] : 1) * op,
      fs: parseFloat(cs.fontSize), fw: parseInt(cs.fontWeight) || 400,
      sel: el.tagName + (el.id ? '#'+el.id : '') +
           (typeof el.className === 'string' && el.className ? '.'+el.className.trim().split(/\s+/)[0] : ''),
    });
  });
  return out;
};

async function medianFarben(leser, pngBuffer, punkte) {
  // Screenshot in ein Canvas legen und dort auslesen — kein PNG-Dekoder noetig.
  return leser.evaluate(async ({ dataUrl, punkte, W, H }) => {
    const img = new Image();
    await new Promise(res => { img.onload = res; img.src = dataUrl; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const at = (x, y) => { x = Math.min(c.width-1, Math.max(0, x)); y = Math.min(c.height-1, Math.max(0, y));
                           const i = (y*c.width + x) * 4; return [d[i], d[i+1], d[i+2]]; };
    return punkte.map(p => {
      const px = [];
      // Ein Feld statt eines Pixels: Emoji bleiben bei color:transparent
      // sichtbar und wuerden einen Einzelpixel verfaelschen.
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -Math.floor(p.w/2)+2; dx <= Math.floor(p.w/2)-2; dx += Math.max(2, Math.floor(p.w/14)))
          px.push(at(Math.round(p.x + p.w/2 + dx), Math.round(p.y + p.h/2 + dy)));
      if (!px.length) px.push(at(Math.round(p.x + p.w/2), Math.round(p.y + p.h/2)));
      px.sort((a, b) => (0.2126*a[0]+0.7152*a[1]+0.0722*a[2]) - (0.2126*b[0]+0.7152*b[1]+0.0722*b[2]));
      return px[Math.floor(px.length/2)];
    });
  }, { dataUrl: 'data:image/png;base64,' + pngBuffer.toString('base64'), punkte, W, H });
}

(async () => {
  const br = await chromium.launch();
  const leser = await (await br.newContext()).newPage();   // nur zum Pixel-Lesen
  await leser.goto('data:text/html,<title>px</title>');

  for (const dark of [false, true]) {
    const ctx = await br.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    await p.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
    await p.addInitScript(SEED);
    await p.goto('file://' + FILE, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p.waitForTimeout(3500);
    await p.evaluate(d => {
      document.documentElement.classList.remove('gs-preauth');
      const o = document.getElementById('gs-onboarding');
      if (o) o.style.setProperty('display', 'none', 'important');
      document.querySelectorAll('[class*="toast"],[id*="toast"]').forEach(e => e.remove());
      document.body.classList.toggle('dark', d);
    }, dark);

    const gefunden = new Map();
    for (const t of TABS) {
      try { await p.evaluate(t => switchTab(t), t); } catch (e) {}
      await p.waitForTimeout(600);
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.waitForTimeout(150);

      const stellen = await p.evaluate(STELLEN);
      if (!stellen.length) continue;
      const stil = await p.evaluate(() => {
        const s = document.createElement('style');
        s.id = 'gs-nur-hintergrund';
        s.textContent = '*{color:transparent!important;text-shadow:none!important;-webkit-text-fill-color:transparent!important;}';
        document.head.appendChild(s); return true;
      });
      await p.waitForTimeout(120);
      const shot = await p.screenshot({ clip: { x: 0, y: 0, width: W, height: H } });
      await p.evaluate(() => { const s = document.getElementById('gs-nur-hintergrund'); if (s) s.remove(); });

      const bgs = await medianFarben(leser, shot, stellen);
      stellen.forEach((s, i) => {
        const bg = bgs[i];
        const eff = s.fg.map((v, k) => Math.round(s.alpha*v + (1-s.alpha)*bg[k]));
        const r = cr(eff, bg);
        const gross = s.fs >= 24 || (s.fs >= 18.66 && s.fw >= 700);
        const min = gross ? 3 : 4.5;
        if (r >= min) return;
        const k = s.sel + '|' + s.t;
        if (!gefunden.has(k)) gefunden.set(k, { ...s, r: Math.round(r*100)/100, min, bg, tab: t });
      });
    }

    // ── Fenster: der KI-Planer, ungefaltet ────────────────────────────────
    // Bewusst OHNE gsPPTabify: die Reiter verbergen Abschnitte, und was
    // verborgen ist, wird nicht gemessen. Ungefaltet sind alle da.
    try {
      const hoch = await p.evaluate(({ plan, agro }) => {
        window._gsPPagroCache = { ts: Date.now(), rows: agro };
        window._gsPP = window._gsPP || {};
        _gsPP.plan = plan; _gsPP.data = { area: 12, width: 4, length: 3 };
        _gsPP.weather = { location: 'Zürich', totalPrecip14: 18, avgTemp14: 17, avgSunshine14: 6 };
        plan._gespeichert = new Date(Date.now() - 21*86400000).toISOString();
        if (typeof _gsPlanPruefwerk === 'function') _gsPlanPruefwerk(plan, _gsPP.data);
        if (typeof openModal === 'function') openModal('modal-planner-pro');
        if (typeof gsPPgoStep === 'function') gsPPgoStep(5);
        const ld = document.getElementById('pp-plan-loader'); if (ld) ld.style.display = 'none';
        const ac = document.getElementById('pp-plan-actions'); if (ac) ac.classList.remove('hidden');
        const res = document.getElementById('pp-plan-result');
        if (!res) return 0;
        res.style.display = 'block';
        res.innerHTML = gsPPrenderPlan(plan, _gsPP.data);
        // Die Bildlaufflaeche des Fensters finden — sie ist nicht window.
        let sc = res;
        while (sc && sc !== document.body && sc.scrollHeight <= sc.clientHeight + 4) sc = sc.parentElement;
        window.__gsScroll = (sc && sc !== document.body) ? sc : null;
        return (window.__gsScroll ? window.__gsScroll.scrollHeight : document.body.scrollHeight) || 0;
      }, { plan: JSON.parse(JSON.stringify(SEED_MOD.MUSTERPLAN)), agro: SEED_MOD.AGRONOMIE });

      const schritte = Math.max(1, Math.min(8, Math.ceil(hoch / (H - 120))));
      for (let i = 0; i < schritte; i++) {
        await p.evaluate(y => {
          if (window.__gsScroll) window.__gsScroll.scrollTop = y; else window.scrollTo(0, y);
        }, i * (H - 120));
        await p.waitForTimeout(180);
        const stellen = await p.evaluate(STELLEN);
        if (!stellen.length) continue;
        await p.evaluate(() => {
          const st = document.createElement('style');
          st.id = 'gs-nur-hintergrund';
          st.textContent = '*{color:transparent!important;text-shadow:none!important;-webkit-text-fill-color:transparent!important;}';
          document.head.appendChild(st);
        });
        await p.waitForTimeout(120);
        const shot = await p.screenshot({ clip: { x: 0, y: 0, width: W, height: H } });
        await p.evaluate(() => { const st = document.getElementById('gs-nur-hintergrund'); if (st) st.remove(); });
        const bgs = await medianFarben(leser, shot, stellen);
        stellen.forEach((sx, ix) => {
          const bg = bgs[ix];
          const eff = sx.fg.map((v, k) => Math.round(sx.alpha*v + (1-sx.alpha)*bg[k]));
          const r = cr(eff, bg);
          const gross = sx.fs >= 24 || (sx.fs >= 18.66 && sx.fw >= 700);
          const min = gross ? 3 : 4.5;
          if (r >= min) return;
          const k = sx.sel + '|' + sx.t;
          if (!gefunden.has(k)) gefunden.set(k, { ...sx, r: Math.round(r*100)/100, min, bg, tab: 'planer' });
        });
      }
    } catch (e) { console.log('  (Fenster-Durchlauf uebersprungen: ' + e.message.split('\n')[0] + ')'); }

    await ctx.close();

    const liste = [...gefunden.values()].sort((a, b) => a.r - b.r);
    console.log('\n=== ' + (dark ? 'DUNKELMODUS' : 'HELLMODUS') + ' — ' + liste.length + ' Textstellen unter AA');
    liste.slice(0, 24).forEach(o => console.log(
      `  ${String(o.r).padStart(5)}:1 (soll ${o.min})  ${o.tab.padEnd(9)} ${o.sel.slice(0,32).padEnd(33)} ` +
      `rgb(${o.fg})@${o.alpha.toFixed(2)} auf rgb(${o.bg})  „${o.t}"`));
    if (liste.length > 24) console.log(`  … und ${liste.length-24} weitere`);
  }
  await br.close();
})();
