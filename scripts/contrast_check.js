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
  // v33.55: ein Deckel verdeckt nur, was UNTER ihm liegt. `#app` ist selbst
  // ein fester, deckender Kasten ueber dem ganzen Bildschirm — ohne diese
  // Frage galt JEDER Text in einem Dialog, der direkt am <body> haengt
  // (Rueckfragen, Teilen-Vorschau, …), als verdeckt, und keiner davon wurde
  // je vermessen. Zwei feste Schichten auf oberster Ebene ordnet der z-index,
  // bei Gleichstand die Reihenfolge im Dokument. Innerhalb von #app aendert
  // sich nichts: dort liegen Text und Deckel in derselben Schicht.
  const zahl = (e) => { const z = parseInt(getComputedStyle(e).zIndex, 10); return isNaN(z) ? 0 : z; };
  const schicht = (e) => {
    let w = null;
    for (let q = e; q && q !== document.documentElement; q = q.parentElement) if (getComputedStyle(q).position === 'fixed') w = q;
    return w;
  };
  const verdeckt = (el, r) => {
    const sEl = schicht(el);
    return deckel.some(d => {
      if (d.el === el || d.el.contains(el) || el.contains(d.el)) return false;
      if (!(r.left < d.r.right - 1 && r.right > d.r.left + 1 && r.top < d.r.bottom - 1 && r.bottom > d.r.top + 1)) return false;
      if (sEl && !sEl.contains(d.el)) {
        const sD = schicht(d.el) || d.el;
        if (sD !== sEl) {
          const zE = zahl(sEl), zD = zahl(sD);
          if (zE > zD) return false;
          if (zE === zD && (sD.compareDocumentPosition(sEl) & Node.DOCUMENT_POSITION_FOLLOWING)) return false;
        }
      }
      return true;
    });
  };

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
    // v31.78: und was von einem scrollenden Vorfahren ABGESCHNITTEN wird,
    // ebenfalls nicht. `elementFromPoint` hilft hier nicht: es liefert an
    // dieser Stelle den Vorfahren selbst, und der ENTHAELT das Element —
    // die Pruefung oben winkt es also durch. Gemessen wird dann der
    // Modal-Schleier statt der weissen Karte: vier Zeilen des
    // Bluehkalenders kamen so auf 1,2:1, obwohl sie in Wahrheit 18:1 haben.
    for (let q = el.parentElement; q && q !== document.documentElement; q = q.parentElement) {
      const qs = getComputedStyle(q);
      if (qs.overflow === 'visible' && qs.overflowY === 'visible' && qs.overflowX === 'visible') continue;
      const qr = q.getBoundingClientRect();
      if (qr.width < 2 || qr.height < 2) continue;
      if (r.top < qr.top - 1 || r.bottom > qr.bottom + 1 || r.left < qr.left - 1 || r.right > qr.right + 1) return;
    }
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

  // v33.59: dieser Pruefstand URTEILT. Bis v33.56 endete er IMMER mit 0 — er
  // druckte „N Textstellen unter AA" und die Suite meldete trotzdem „rot: 0";
  // in ihrem Auszug (die letzten zwoelf Zeilen) stand die Zahl des Hellmodus
  // nicht einmal. CLAUDE.md §7.1 sagte „soll 0 melden" — und nichts erzwang
  // es. Eine Regel ohne Ausloeser ist eine Bitte (v33.01). Rot ist jetzt:
  // eine Textstelle unter AA, ein von Hand gestelltes Fenster, das nicht
  // aufging, ein dynamischer Dialog, der nicht aufging.
  let unterAA = 0, dynFehler = 0, uebersprungen = [];
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

    // ── Fenster ──────────────────────────────────────────────────────────
    // Was in einem geschlossenen Fenster steckt, sah der Pruefstand bis
    // v31.76 nie. Jedes Fenster hier oeffnet sich selbst, wird ungefaltet
    // gerendert (verborgene Reiter werden nicht gemessen) und in
    // Bildschirmhoehen durchgescrollt.
    const FENSTER = [
      ['planer', ({ plan, agro }) => {
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
        return res;
      }],
      // v31.99: das Scan-Ergebnis. Es ist der Bildschirm, auf dem jemand
      // ueber Giftigkeit liest — dort ist schlechter Kontrast am teuersten,
      // und gemessen wurde er bis hierher nie (er gehoert zu keinem der elf
      // Tabs). Der Fall ist bewusst der gefaehrliche: eine Art, die unsere
      // Liste giftiger fuehrt als die Bestimmung.
      ['scan-ergebnis', () => {
        // Der Scanner-Tab MUSS aktiv sein: `#scan-result` liegt darin, und ein
        // ausgeblendeter Tab hat Hoehe 0 — die Karte war beim ersten Anlauf
        // vollstaendig da (71 Textknoten) und trotzdem unmessbar. Genau
        // deshalb nennt der Bericht je Fenster die Zahl der Stellen.
        try { if (typeof switchTab === 'function') switchTab('scanner'); } catch (_) {}
        window.gsScanStatusShow = () => {}; window.gsStopScanStatus = () => {};
        window.gsScanPersistToCloud = () => Promise.resolve(true);
        window.gsAddToScanHistory = () => {}; window.gsHaptic = () => {};
        // v32.01: so tun, als laege ein erstes Foto vor — sonst rendert der
        // Knopf „Zweites Foto" nicht, und ein neues Bedienelement auf einem
        // Sicherheits-Bildschirm bliebe ungemessen.
        window._gsLastScanB64 = 'AAAA';
        if (typeof showScanResult !== 'function') return 0;
        showScanResult({
          name: 'Herbstzeitlose', latin: 'Colchicum autumnale', family: 'Colchicaceae',
          category: 'wildpflanze', confidence: 71, edible: true, toxic: false, toxicity: 0,
          description: 'Schmale Blätter, im Frühjahr ohne Blüte.',
          habitat: 'Fettwiesen, Auen', season: 'Aug–Okt', uses: '',
          warning: 'Alle Pflanzenteile stark giftig.',
          diagnostic_features: ['Blätter aus dem Boden', 'Kein Knoblauchgeruch', 'Fleischige Blattbasis'],
          next_photo_hint: 'Blattbasis und Zwiebel freilegen',
          alternatives: [
            { name: 'Bärlauch', latin: 'Allium ursinum', confidence: 62, distinguishing_feature: 'Knoblauchgeruch', toxicity: 0, edible: true },
            { name: 'Maiglöckchen', latin: 'Convallaria majalis', confidence: 24, distinguishing_feature: 'Zwei Blätter an einem Stiel', toxicity: 5, edible: false },
          ],
          lookalike_warning: 'Verwechslung mit Bärlauch ist tödlich.',
          _shotCount: 1, _qual: { messbar: true, quality: 44, blur: 38, light: 52, warnings: ['etwas unscharf'] },
        });
        const res = document.getElementById('scan-result');
        if (!res) return 0;
        res.style.display = 'block';
        return res;
      }],
      // v32.08: die Analyse-Ansicht. Man sieht sie mehrere Sekunden lang,
      // waehrend die KI antwortet — und sie war nie vermessen. Der Zustand
      // wird hier von Hand hergestellt (ein abgehakter, ein laufender, ein
      // offener Schritt), damit alle drei Farben vorkommen.
      ['scan-analyse', () => {
        try { if (typeof switchTab === 'function') switchTab('scanner'); } catch (_) {}
        const res = document.getElementById('scan-result');
        if (!res || typeof _gsSchritteHtml !== 'function') return 0;
        res.style.display = 'block';
        res.innerHTML = '<div class="analyzing gs-scanview">' +
          '<div class="gs-scanfoto" id="gs-scanfoto"><canvas class="gs-scangitter"></canvas>' +
          '<span class="gs-scanecke gs-se-lo"></span><span class="gs-scanecke gs-se-ro"></span>' +
          '<span class="gs-scanzahl">2 Fotos</span></div>' +
          _gsSchritteHtml() +
          '<p style="font-size:var(--fs-sm);color:var(--muted);margin-top:2px;">Multi-Shot: 2 Fotos werden kombiniert → höhere Genauigkeit</p>' +
          '</div>';
        gsSchritt('bild', 'fertig', 'Schärfe 72 · Licht 80');
        gsSchritt('ort', 'fertig', 'Juli · Sommer · aus dem Foto');
        gsSchritt('cache', 'fertig', 'kein Treffer');
        gsSchritt('ki', 'laeuft', '6 s');
        return res;
      }],
      // v32.20: „Ohne Netz eingrenzen". Sechs Sicherheitsstufen als farbige
      // Plaketten in einer Liste — genau die Stelle, an der in v31.99 schon
      // einmal 3,27:1 stand, und diesmal in einer anderen Umgebung.
      ['eingrenzen', () => {
        if (typeof gsEingrenzenOeffnen !== 'function') return 0;
        // Ohne Filter bleibt die Liste lang genug, dass alle sechs Stufen
        // vorkommen — mit Filter waere die Messung vom Zufall abhaengig.
        try { localStorage.setItem('gs_eingrenzen', JSON.stringify({ monat: 6, farbe: '', gruppe: '', hoehe: null })); } catch (_) {}
        gsEingrenzenOeffnen();
        const el = document.getElementById('detail-modal');
        if (!el) return 0;
        el.style.display = 'flex';
        return el;
      }],
      // v32.10: die Gegenprobe. Rot auf rot getoent — genau die Kombination,
      // die im Scan-Ergebnis schon einmal 3,27:1 ergab. Gemessen werden BEIDE
      // Zustaende: das Angebot und ein fertiges (widersprechendes) Urteil.
      ['scan-gegenprobe', () => {
        try { if (typeof switchTab === 'function') switchTab('scanner'); } catch (_) {}
        window.gsScanStatusShow = () => {}; window.gsStopScanStatus = () => {};
        window.gsScanPersistToCloud = () => Promise.resolve(true);
        window.gsAddToScanHistory = () => {}; window.gsHaptic = () => {};
        window._gsLastScanB64 = 'AAAA';
        if (typeof showScanResult !== 'function') return 0;
        showScanResult({
          name: 'Bärlauch', latin: 'Allium ursinum', family: 'Amaryllidaceae', category: 'wildpflanze',
          confidence: 84, edible: true, toxic: false, toxicity: 0,
          description: 'Breite Blätter mit Knoblauchgeruch.', habitat: 'Laubwälder', season: 'Apr–Jun',
          diagnostic_features: ['Breite Einzelblätter', 'Knoblauchgeruch'],
          alternatives: [
            { name: 'Herbstzeitlose', latin: 'Colchicum autumnale', confidence: 34, distinguishing_feature: 'Fleischige Blattbasis', toxicity: 5, edible: false },
            { name: 'Maiglöckchen', latin: 'Convallaria majalis', confidence: 21, distinguishing_feature: 'Zwei Blätter an einem Stiel', toxicity: 5, edible: false },
          ],
          _shotCount: 1, _qual: { messbar: true, quality: 70, blur: 66, light: 74, warnings: [] },
        });
        // Und darunter ein fertiges Urteil, damit auch dessen Farben messbar sind.
        const h = document.getElementById('gs-gegenprobe');
        if (h && typeof gsGegenprobeRender === 'function') {
          const zweit = document.createElement('div');
          zweit.className = 'sr2-card gs-gp'; zweit.id = 'gs-gegenprobe-2';
          h.parentNode.insertBefore(zweit, h.nextSibling);
          const echt = h.id; h.id = '_weg'; zweit.id = 'gs-gegenprobe';
          gsGegenprobeRender({ urteil: 'widerlegt', vertrauen: 25,
            dagegen: ['Kein Knoblauchgeruch beschrieben', 'Blattbasis wirkt fleischig'],
            dafuer: ['Blattbreite passt'], fehlend: 'Blattunterseite aus der Nähe',
            bessere_erklaerung: { name: 'Herbstzeitlose', latin: 'Colchicum autumnale', warum: 'Blattform und Standort passen besser' },
            verzehr: 'nein' }, { name: 'Bärlauch' });
          h.id = echt;
        }
        const res = document.getElementById('scan-result');
        if (!res) return 0;
        res.style.display = 'block';
        return res;
      }],
      ['blühkalender', () => {
        localStorage.setItem('gs_bl_month', '5');
        localStorage.setItem('gs_bl_tab', 'all');
        if (typeof openBluehkalender !== 'function') return 0;
        openBluehkalender();
        const dm = document.getElementById('detail-modal');
        if (dm) { dm.style.display = ''; dm.classList.add('active'); }
        return document.getElementById('modal-content');
      }],
      // v33.34: der Kalender MIT einem verletzten Hinweis (KALENDER-V2 §3).
      // Die Beispieldaten tragen keinen Regen — ohne gestellte Daten stuende
      // die neue Hinweiszeile (.gs-kal-hinweis, --c-warn-d als TEXT) in keinem
      // gemessenen Fenster. Ein Pruefstand misst, was er erreicht (v32.12).
      // REGEN und nicht Frost: Aussaatfenster haengen am Monat, der Regen
      // nicht — ein Fall, der nur im Herbst etwas zu messen hat, misst im
      // Sommer nichts und sieht dabei aus wie „keine Funde". Und die 8 mm
      // stehen in Stunde 0, weil gsRegenGefallen nur bis zur AKTUELLEN Stunde
      // zaehlt: ein Lauf um 03:00 nachts haette sonst 0 mm gemessen.
      ['kalender-hinweis', () => {
        if (typeof gsKalenderOeffnenAm !== 'function' || typeof gsHeuteTag !== 'function') return 0;
        const heute = gsHeuteTag();
        // Der Zustand wird HERGESTELLT, und zwar GANZ: dieser Pruefstand hat
        // seinen EIGENEN, winzigen Seed (nur Anmeldung und Sprache) — die
        // Beispieldaten aus scripts/_seed.js liegen hier NICHT. Ein Fall, der
        // `plant_seed_1` sucht, findet nichts und misst nichts (erster Lauf:
        // „Fenster uebersprungen"). Also Garten und Pflanzung selbst anlegen.
        try {
          if (typeof gardens !== 'undefined' && Array.isArray(gardens) && !gardens.some(g => g && g.id === 'g-kontrast'))
            gardens.push({ id: 'g-kontrast', name: 'Balkon', kind: 'balkon' });
          if (typeof plantings !== 'undefined' && Array.isArray(plantings) && !plantings.some(x => x && x.id === 'p-kontrast'))
            plantings.push({ id: 'p-kontrast', gardenId: 'g-kontrast', name: 'Zucchini', date: new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10), added: new Date(Date.now() - 30 * 864e5).toISOString(),
              tasks: { water: { active: true, intervalDays: 2, lastDone: new Date(Date.now() - 3 * 864e5).toISOString() } } });
        } catch (_) {}
        const zeiten = [], regen = [];
        for (let h = 0; h < 24; h++) { zeiten.push(heute + 'T' + String(h).padStart(2, '0') + ':00'); regen.push(h === 0 ? 8 : 0); }
        localStorage.setItem('gs_weather_cache', JSON.stringify({ ts: Date.now(), data: { hourly: { time: zeiten, precipitation: regen } } }));
        gsKalenderOeffnenAm(heute);
        const mc = document.getElementById('modal-content');
        // Grund-Zeilen sind versteckt (hidden) — die Hinweiszeile nicht. Fehlt
        // sie, hat der Fall seinen Zustand nicht hergestellt: dann LAUT sein,
        // nicht still 0 zurueckgeben (ein Fenster ohne Messung sieht sonst aus
        // wie ein Fenster ohne Funde — v32.35).
        if (!mc) throw new Error('kalender-hinweis: kein #modal-content');
        if (!mc.querySelector('.gs-kal-hinweis')) throw new Error('kalender-hinweis: keine .gs-kal-hinweis-Zeile — der Fall stellt seinen Zustand nicht her');
        const dm = document.getElementById('detail-modal');
        if (dm) { dm.style.display = ''; dm.classList.add('active'); }
        return mc;
      }],
      // v33.55: die Vorschau eines geteilten Fotos. Sie ist ein dynamischer
      // Dialog (kein Oeffner mit openModal), der automatische Durchgang sieht
      // sie also nie. Zwei Fotos, damit auch die Hinweiszeile dasteht.
      ['teilen-vorschau', () => {
        const b = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
        const u8 = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u8[i] = b.charCodeAt(i);
        _gsTeilenVorschau(new File([u8], 'geteilt', { type: 'image/png' }), 2);
        const ov = document.getElementById('gs-teilen-vorschau');
        if (!ov) throw new Error('teilen-vorschau: kein #gs-teilen-vorschau');
        if (!/2 Fotos/.test(ov.textContent)) throw new Error('teilen-vorschau: Hinweiszeile fehlt — der Fall stellt seinen Zustand nicht her');
        return ov.firstElementChild;
      }],
      // v33.59: die Rueckfrage. `gsConfirmModal` hat 49 Aufrufstellen und war nie
      // vermessen — sie braucht Parameter, der automatische Durchgang ruft nur
      // Oeffner ohne. Gemessen im Dunkelmodus: Titel, Text und „Abbrechen" mit
      // 1,06:1 (`color:var(--fg,#1a1a1a)`, und `--fg` gab es nie). Jede
      // „Wirklich loeschen?"-Frage der App war schwarz auf schwarz.
      ['rueckfrage', () => {
        gsConfirmModal({ title: 'Pflanze löschen?', message: 'Die Pflanze und ihr Tagebuch werden entfernt. Das lässt sich nicht rückgängig machen.', ok: 'Endgültig löschen', cancel: 'Abbrechen', kind: 'danger' });
        const w = document.getElementById('gs-confirm-modal');
        if (!w || !w.firstElementChild) throw new Error('rueckfrage: kein #gs-confirm-modal');
        if (!/Tagebuch/.test(w.textContent)) throw new Error('rueckfrage: der Text steht nicht da — der Fall stellt seinen Zustand nicht her');
        return w.firstElementChild;
      }],
      ['eingabe', () => {
        gsPromptModal({ title: 'Name der Pflanze', message: 'Wie soll sie heissen?', value: 'Monstera', ok: 'Speichern', cancel: 'Abbrechen' });
        const w = document.getElementById('gs-prompt-modal');
        if (!w || !w.firstElementChild) throw new Error('eingabe: kein #gs-prompt-modal');
        return w.firstElementChild;
      }],
      // Eine Battle-Runde: vier Antwortknoepfe auf `var(--card-bg,#fff)` — auch
      // diesen Namen gab es nie, im Dunkelmodus stand helle Schrift auf Weiss.
      ['battle-runde', () => {
        window.sbFetch = async () => ({ data: [{}] });
        gsBattleStartPlay('b-kontrast', 'challenger', [
          { q: 'Welche dieser Arten ist tödlich giftig?', options: ['Bärlauch', 'Herbstzeitlose', 'Löwenzahn', 'Brennnessel'], correct_idx: 1 },
          { q: 'Zweite Frage', options: ['a', 'b', 'c', 'd'], correct_idx: 0 }]);
        gsBattleRenderRound();
        const m = document.getElementById('gs-nl-modal');
        const b = document.getElementById('gs-nl-body');
        if (!m || !b || !/Herbstzeitlose/.test(b.textContent)) throw new Error('battle-runde: die Runde steht nicht da');
        return b;
      }],
      ['track-wiederherstellen', () => {
        _gsTrackRecoveryChoice(42, 17);
        const w = document.getElementById('gs-track-recover');
        if (!w || !w.firstElementChild) throw new Error('track-wiederherstellen: kein #gs-track-recover');
        return w.firstElementChild;
      }],
    ];

    // v32.25: der Messvorgang als FUNKTION — er wird jetzt von zwei Seiten
    // gebraucht: von der Liste oben (Fenster, die gestellte Daten brauchen)
    // und vom automatischen Durchgang darunter (jeder Oeffner ohne
    // Parameter). Vorher stand er in der Schleife, und ein zweiter Durchgang
    // haette ihn kopiert — zwei Fassungen derselben Messung sind der
    // sicherste Weg zu zwei verschiedenen Ergebnissen.
    async function messeFenster(fname, oeffnenQuelle, arg, deckel) {
      deckel = deckel || 8;
      try {
        const hoch = await p.evaluate(([fn, arg]) => {
          window.__gsBodyVor = [].slice.call(document.body.children);   // v33.59: fuers Aufraeumen danach
          const res = (new Function('return (' + fn + ')'))()(arg);
          if (!res || !res.getBoundingClientRect) return 0;
          let sc = res;
          while (sc && sc !== document.body && sc.scrollHeight <= sc.clientHeight + 4) sc = sc.parentElement;
          window.__gsScroll = (sc && sc !== document.body) ? sc : null;
          return (window.__gsScroll ? window.__gsScroll.scrollHeight : document.body.scrollHeight) || 0;
        }, [oeffnenQuelle, arg]);

        // Ein Fenster faehrt mit einer Animation ein. Wer sofort misst,
        // liest Koordinaten aus dem Dokument und Pixel aus einem Bild, das
        // 120 ms spaeter entstanden ist — und bekommt vier Textstellen
        // gemeldet, die in Wahrheit 18:1 haben. Also erst zur Ruhe kommen
        // lassen.
        await p.waitForTimeout(600);
        const schritte = Math.max(1, Math.min(deckel, Math.ceil(hoch / (H - 120))));
        // Wie viele Stellen dieses Fenster wirklich beigetragen hat. Ohne
        // diese Zahl sieht ein Fenster, das gar nicht aufging, genauso aus
        // wie eines ohne Fehler — naemlich nach „0".
        let _gemessen = 0;
        for (let i = 0; i < schritte; i++) {
          await p.evaluate(y => {
            if (window.__gsScroll) window.__gsScroll.scrollTop = y; else window.scrollTo(0, y);
          }, i * (H - 120));
          await p.waitForTimeout(200);
          const stellen = await p.evaluate(STELLEN);
          if (!stellen.length) continue;
          _gemessen += stellen.length;
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
            if (!gefunden.has(k)) gefunden.set(k, { ...sx, r: Math.round(r*100)/100, min, bg, tab: fname });
          });
        }
        console.log('  Fenster ' + fname + ': ' + _gemessen + ' Textstellen in ' + schritte + ' Abschnitten vermessen');
        // Aufraeumen, aber gezielt. Der erste Anlauf blendete alles mit
        // `[id^="modal-"]` aus — darunter `#modal-content`, den Behaelter,
        // in den der Bluehkalender rendert. Das naechste Fenster mass
        // daraufhin 0 Stellen und sah aus wie „keine Fehler".
        await p.evaluate(() => {
          document.querySelectorAll('.modal.active').forEach(m => { try { m.classList.remove('active'); } catch(_){} });
          ['modal-planner-pro','detail-modal'].forEach(id => {
            const m = document.getElementById(id);
            if (m) { try { m.classList.remove('active'); m.style.display = 'none'; } catch(_){} }
          });
          // v33.55: die Teilen-Vorschau liegt auf z-index 99990 ueber allem —
          // stehen gelassen, verdeckte sie jedes weitere Fenster.
          const tv = document.getElementById('gs-teilen-vorschau');
          if (tv && typeof gsDismissOverlay === 'function') { try { gsDismissOverlay(tv); } catch(_){} }
          // v33.59: Rueckfrage und Eingabe geben ein Promise zurueck — „Abbrechen"
          // loest es sauber auf. Die Battle-Runde schliesst ueber closeModal (das
          // haelt auch ihren Zaehler an, v32.97).
          ['gs-confirm-cancel', 'gs-prompt-cancel'].forEach(id => { const b = document.getElementById(id); if (b) { try { b.click(); } catch(_){} } });
          try { if (typeof closeModal === 'function') closeModal('gs-nl-modal'); } catch(_){}
          // Und alles, was der Oeffner an den <body> gehaengt hat und den
          // Bildschirm ueberdeckt: stehen gelassen, verdeckte es jedes weitere Fenster.
          const vor = window.__gsBodyVor;
          if (vor) {
            [].slice.call(document.body.children).forEach(el => {
              if (vor.indexOf(el) >= 0) return;
              let cs; try { cs = getComputedStyle(el); } catch(_) { return; }
              if (cs.position !== 'fixed') return;
              const r = el.getBoundingClientRect();
              if (r.width * r.height < innerWidth * innerHeight * 0.5) return;
              try { if (typeof gsDismissOverlay === 'function') gsDismissOverlay(el); } catch(_){}
              try { if (el.parentNode) el.parentNode.removeChild(el); } catch(_){}
            });
            window.__gsBodyVor = null;
          }
        });
      } catch (e) {
        console.log('  (Fenster ' + fname + ' uebersprungen: ' + e.message.split('\n')[0] + ')');
        // Ein Fenster, das nicht aufging, ist nicht vermessen — fuer die von Hand
        // gestellten ist das rot (bei den automatisch gefundenen lehnt mancher
        // Oeffner bewusst ab; das zaehlt wiring_check Richtung 3).
        if (deckel === 8) uebersprungen.push((dark ? 'dunkel' : 'hell') + ':' + fname);
      }
    }

    // ── Durchgang 1: die Fenster, die gestellte Daten brauchen ────────────
    for (const [fname, oeffnen] of FENSTER) {
      await messeFenster(fname, oeffnen.toString(), fname === 'planer'
        ? { plan: JSON.parse(JSON.stringify(SEED_MOD.MUSTERPLAN)), agro: SEED_MOD.AGRONOMIE }
        : null);
    }

    // ── Durchgang 2 (v32.25): JEDES Fenster, das sich von allein oeffnet ──
    //
    // Bis v32.24 mass dieser Pruefstand SECHS Fenster. Die App hat rund
    // vierzig. Alles andere stand unter der Ansage aus CLAUDE.md §7.1:
    // „wer Farbe in einem Modal setzt, das der Pruefstand nicht oeffnet,
    // rechnet selbst nach" — und niemand rechnet selbst nach.
    //
    // Die Liste von Hand zu verlaengern waere der falsche Weg: sie veraltet,
    // wie jede gepflegte Liste. Stattdessen dieselbe Entdeckung wie in
    // `wiring_check` Richtung 3 — jeder Oeffner ohne Parameter, dessen Rumpf
    // `openModal(` enthaelt, wird WIRKLICH aufgerufen. Neue Fenster sind
    // damit ab dem Tag ihrer Entstehung vermessen.
    const autoNamen = await p.evaluate((quelleTxt) => {
      const out = [];
      const re = /(?:async\s+)?function\s+((?:gsOpen|open|show|gsShow)[A-Za-z0-9_]*|gs[A-Za-z0-9_]*Oeffnen)\s*\(\s*\)\s*\{/g;
      let m;
      while ((m = re.exec(quelleTxt))) {
        let d = 0, i = re.lastIndex - 1, ende = -1;
        while (i < quelleTxt.length && i < re.lastIndex + 40000) {
          const c = quelleTxt[i];
          if (c === '{') d++;
          else if (c === '}') { d--; if (d === 0) { ende = i; break; } }
          i++;
        }
        if (ende > 0 && quelleTxt.slice(re.lastIndex, ende).indexOf('openModal(') >= 0) out.push(m[1]);
      }
      return [...new Set(out)].sort();
    }, require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8'));

    // Der Oeffner als Quelltext — `messeFenster` fuehrt ihn im Seitenkontext
    // aus und erwartet das Element, in dem gemessen werden soll.
    const AUTO_OEFFNER = `(function(name){
      document.querySelectorAll('.modal-overlay, .overlay-modal').forEach(function(el){
        el.classList.remove('open'); el.style.display = 'none';
      });
      // Sperren ERFUELLEN, nicht umgehen — dieselbe Regel wie in wiring_check.
      window.sbIsLoggedIn = function(){ return true; };
      window.gsIsAdmin = function(){ return true; };
      window.gsIsStaff = function(){ return true; };
      window.gsRequire = function(){ return true; };
      window._sbProfile = window._sbProfile || { id:'u1', email:'p@r.ch', role:'admin' };
      var f = window[name];
      if (typeof f !== 'function') return 0;
      try { f(); } catch(_) { return 0; }
      var offen = [].slice.call(document.querySelectorAll('.modal-overlay, .overlay-modal'))
        .filter(function(el){ return el.classList.contains('open') || el.style.display === 'flex'; })
        .filter(function(el){ return (el.textContent||'').trim().length > 12; });
      return offen.length ? offen[0] : 0;
    })`;

    let autoGemessen = 0, autoLeer = 0;
    for (const name of autoNamen) {
      const vorher = gefunden.size;
      await messeFenster(name, AUTO_OEFFNER, name, 3);
      if (gefunden.size > vorher) autoGemessen++;
      else autoLeer++;
    }
    console.log('  automatisch geoeffnet: ' + autoNamen.length + ' Fenster' +
                (autoGemessen ? ' · davon mit Befund: ' + autoGemessen : ' · ohne Befund'));

    // ── Durchgang 3 (v33.59): Dialoge, die sich SELBST an den <body> haengen ──
    //
    // Durchgang 2 findet nur Oeffner, deren Rumpf `openModal(` enthaelt. Rund
    // ein Dutzend Dialoge bauen ihr Fenster aber selbst (`document.body
    // .appendChild` mit `position:fixed`) — Scan-Tipps, Sprachmodus,
    // Passwort aendern, Konto loeschen, Avatar-Wahl, Wetterwarnungen. Sie
    // waren nie vermessen; der Knopf „Alles klar" der Scan-Tipps stand mit
    // 2,36:1 da. Dieselbe Entdeckung, andere Bauform: jede Funktion OHNE
    // Parameter, deren Rumpf ein festes Fenster an den <body> haengt.
    // Was kein Dialog ist (Start-Routinen, Banner, Abzeichen), steht mit
    // Grund in DYN_AUS — die Liste ist die Pruefung: ein Name darin, den es
    // nicht mehr gibt, wird gemeldet.
    const DYN_AUS = {
      gsCheckPastDueBanner: 'Banner bei ueberfaelliger Zahlung — erscheint nur mit einem Abo-Zustand vom Server',
      loadHomeWeather: 'laedt das Wetter der Startseite; das Fenster darin ist ein Fehlerfall ohne Netz',
      _gsBattleMaybeOfferResume: 'bietet nur an, wenn eine unterbrochene Runde im Speicher liegt',
      _gsInstallInit: 'Start-Routine (Install-Banner)',
      _gsAuthPrompt: 'Anmelde-Aufforderung — erscheint nur ohne Sitzung, der Pruefstand ist angemeldet',
      _gsOfflineEngineInit: 'Start-Routine (Offline-Anzeige)',
      _gsStatusBadgeInit: 'Start-Routine (Status-Abzeichen)',
      ensureBadge: 'Hilfsfunktion des Status-Abzeichens, kein Dialog',
      _gsStorageMgmtInit: 'Start-Routine (Speicherverwaltung)',
      _gsUniversalSearchInit: 'Start-Routine (Suche)',
      _gsWhatsNewInit: 'Start-Routine — den Dialog selbst misst nutzersicht_check E4',
      showWhatsNew: 'innere Funktion von _gsWhatsNewInit, von aussen nicht erreichbar',
      _gsShowRestoreBanner: 'Banner nach einer Wiederherstellung — braucht deren Zustand',
      _gsMaintenanceBannerBoot: 'Start-Routine (Wartungs-Banner)',
      gsPPshow3DCad: 'braucht einen offenen Plan und laedt Three.js — der Planer wird oben von Hand gestellt',
    };
    const dynNamen = await p.evaluate((quelleTxt) => {
      const out = [];
      const re = /(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(\s*\)\s*\{/g;
      let m;
      while ((m = re.exec(quelleTxt))) {
        let d = 0, i = re.lastIndex - 1, ende = -1;
        while (i < quelleTxt.length && i < re.lastIndex + 40000) {
          const c = quelleTxt[i];
          if (c === '{') d++;
          else if (c === '}') { d--; if (d === 0) { ende = i; break; } }
          i++;
        }
        if (ende < 0) continue;
        const rumpf = quelleTxt.slice(re.lastIndex, ende);
        if (/document\.body\.appendChild\(/.test(rumpf) && /position:\s*fixed/.test(rumpf) && rumpf.indexOf('openModal(') < 0) out.push(m[1]);
      }
      return [...new Set(out)].sort();
    }, require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8'));
    const DYN_OEFFNER = `(function(name){
      window.sbIsLoggedIn = function(){ return true; };
      window.gsIsAdmin = function(){ return true; };
      window.gsIsStaff = function(){ return true; };
      window.gsRequire = function(){ return true; };
      window._sbProfile = window._sbProfile || { id:'u1', email:'p@r.ch', role:'admin' };
      var vor = [].slice.call(document.body.children);
      var f = window[name];
      if (typeof f !== 'function') return 0;
      try { f(); } catch(_) { return 0; }
      var neu = [].slice.call(document.body.children).filter(function(el){
        if (vor.indexOf(el) >= 0) return false;
        var cs = getComputedStyle(el);
        return cs.position === 'fixed' && cs.display !== 'none' && (el.textContent||'').trim().length > 12;
      });
      window.__gsDynOffen = neu.length;
      return neu.length ? neu[neu.length - 1] : 0;
    })`;
    const dynUeberholt = Object.keys(DYN_AUS).filter(n => dynNamen.indexOf(n) < 0);
    if (dynUeberholt.length) { console.log('  !! DYN_AUS nennt Namen, die es so nicht mehr gibt: ' + dynUeberholt.join(', ')); dynFehler++; }
    let dynOffen = 0; const dynZu = [];
    for (const name of dynNamen) {
      if (DYN_AUS[name]) continue;
      await messeFenster(name, DYN_OEFFNER, name, 3);
      const n = await p.evaluate(() => { const v = window.__gsDynOffen | 0; window.__gsDynOffen = 0; return v; });
      if (n) dynOffen++; else dynZu.push(name);
    }
    console.log('  dynamische Dialoge: ' + dynNamen.length + ' gefunden · ' + Object.keys(DYN_AUS).length + ' ausgenommen (mit Grund) · ' + dynOffen + ' geoeffnet und vermessen' +
                (dynZu.length ? ' · NICHT aufgegangen: ' + dynZu.join(', ') : ''));
    // Ein Dialog, der nicht aufgeht, ist nicht vermessen — und das ist kein Gruen.
    if (dynZu.length) dynFehler++;


    await ctx.close();

    const liste = [...gefunden.values()].sort((a, b) => a.r - b.r);
    console.log('\n=== ' + (dark ? 'DUNKELMODUS' : 'HELLMODUS') + ' — ' + liste.length + ' Textstellen unter AA');
    liste.slice(0, 70).forEach(o => console.log(
      `  ${String(o.r).padStart(5)}:1 (soll ${o.min})  ${o.tab.padEnd(9)} ${o.sel.slice(0,32).padEnd(33)} ` +
      `rgb(${o.fg})@${o.alpha.toFixed(2)} auf rgb(${o.bg})  „${o.t}"`));
    if (liste.length > 70) console.log(`  … und ${liste.length-70} weitere`);
    unterAA += liste.length;
  }
  await br.close();
  console.log('\n  ---');
  console.log('  unter AA (hell + dunkel): ' + unterAA + ' · von Hand gestellte Fenster nicht aufgegangen: ' + uebersprungen.length +
              (uebersprungen.length ? ' (' + uebersprungen.join(', ') + ')' : '') + ' · dynamische Dialoge nicht vermessen: ' + dynFehler);
  process.exitCode = (unterAA || uebersprungen.length || dynFehler) ? 1 : 0;
})();
