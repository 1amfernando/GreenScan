// Gruppe r5 (v33.59) — die letzten Client-Punkte aus den Gegenpruefungen. Jeder
// Fall faehrt die ECHTE Funktion mit einem feindlichen Wert und misst die WIRKUNG
// (den Rumpf, der hinausgeht; den Text auf dem Bildschirm; den Speicher) — und den
// gutartigen Fall daneben (CLAUDE.md §7.1: eine Gegenprobe, die gruen bleibt, misst nichts).
//
//   A  Fotos an die KI-Functions (Doktor, Pilz, Schaedling, Garten-Scan, Tagebuch)
//   B  das Stripe-Fenster kommt zurueck (zwei echte Seiten, ein HTTP-Server)
//   C  Stimme umstimmen (on_conflict) · D Push-Abo (on_conflict + updated_at)
//   E  Plan-Hinweis am Plan · Marktplatz-Status-Codes als Satz
//   F  Tabellen-Nachschlag mit 'constructor' / '__proto__'
//   G  Alt-Plaene ohne uid · _uploadLocalOnly raeumt das alte Foto
//   H  die Admin-Warnung nennt, was zutrifft
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { baueJpegMitExif } = require('../_exifjpeg.js');

const APP1 = Array.from(baueJpegMitExif({ datum: '2026:07:14 09:33:12', lat: 46.8182, lng: 8.2275 })).slice(2, -2);
const NUR_META = Array.from(baueJpegMitExif({ datum: '2026:07:14 09:33:12', lat: 46.8182, lng: 8.2275 }));
const WURZEL = path.resolve(__dirname, '..', '..');

// Ein grosses Kamerafoto (2600x1800, Rauschen) mit GPS-Exif, als File in der Seite.
async function werkzeug(seite) {
  await seite.evaluate(([app1, nurMeta]) => {
    const W = window.__r5 = {};
    W.u8 = (b64) => { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
    W.b64 = (u) => { let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); };
    W.exif = (u) => { for (let i = 0; i + 5 < u.length; i++) if (u[i] === 0x45 && u[i + 1] === 0x78 && u[i + 2] === 0x69 && u[i + 3] === 0x66 && u[i + 4] === 0 && u[i + 5] === 0) return true; return false; };
    W.masse = async (u) => { try { const b = await createImageBitmap(new Blob([u])); return [b.width, b.height]; } catch (e) { return null; } };
    const cv = document.createElement('canvas'); cv.width = 2600; cv.height = 1800;
    const cx = cv.getContext('2d'); const id = cx.createImageData(2600, 1800);
    for (let i = 0; i < id.data.length; i += 4) { const v = (i * 2654435761) >>> 24; id.data[i] = v; id.data[i + 1] = (v * 7) & 255; id.data[i + 2] = (v * 13) & 255; id.data[i + 3] = 255; }
    cx.putImageData(id, 0, 0);
    const roh = W.u8(cv.toDataURL('image/jpeg', 0.97).split(',')[1]);
    const mit = new Uint8Array(roh.length + app1.length);
    mit.set(roh.subarray(0, 2), 0); mit.set(app1, 2); mit.set(roh.subarray(2), 2 + app1.length);
    W.foto = () => new File([mit], 'IMG_0001.jpg', { type: 'image/jpeg' });
    W.fotoN = mit.length;
    W.kaputt = () => new File([new Uint8Array(nurMeta)], 'IMG_0002.jpg', { type: 'image/jpeg' });
    W.raus = [];
    W.alt = { f: window._gsFetch, li: window.sbIsLoggedIn, tok: window._gsFreshToken, toast: window.showProfileToast, gt: window.gsToast };
    window._gsFetch = async (url, init) => {
      W.raus.push({ url: String(url), body: init && typeof init.body === 'string' ? init.body : null });
      return { ok: true, status: 200, json: async () => ({ ok: false, error: 'gestellt' }), text: async () => '' };
    };
    window.sbIsLoggedIn = () => true;
    window._gsFreshToken = async () => 'pruef.stand.token';
    W.saetze = [];
    window.showProfileToast = (m) => { W.saetze.push(typeof m === 'string' ? m : JSON.stringify(m)); };
    window.gsToast = (m) => { W.saetze.push(typeof m === 'string' ? m : JSON.stringify(m)); };
    W.zurueck = () => { window._gsFetch = W.alt.f; window.sbIsLoggedIn = W.alt.li; window._gsFreshToken = W.alt.tok; window.showProfileToast = W.alt.toast; window.gsToast = W.alt.gt; };
    // Prueft das Bild in einem Rumpf (Feld) — Exif, Masse, Groesse.
    W.pruefe = async (body, feld) => {
      let o = null; try { o = JSON.parse(body); } catch (e) { return { fehler: 'kein JSON' }; }
      const b = String(o[feld] || '').replace(/^data:[^,]*,/, '');
      const u = W.u8(b);
      return { exif: W.exif(u), masse: await W.masse(u), b64: b.length };
    };
  }, [APP1, NUR_META]);
}

// Ein winziger HTTP-Server ueber dem Repo (BroadcastChannel braucht DENSELBEN Ursprung,
// file:// reicht nicht) — Vorlage offline_check.
function server() {
  return new Promise((res) => {
    const s = http.createServer((rq, rs) => {
      let p = decodeURIComponent(rq.url.split('?')[0]);
      if (p === '/' || p === '') p = '/index.html';
      const f = path.join(WURZEL, p);
      if (!f.startsWith(WURZEL) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rs.writeHead(404); rs.end(); return; }
      const typ = /\.html$/.test(f) ? 'text/html; charset=utf-8' : /\.js$/.test(f) ? 'text/javascript' : /\.json$/.test(f) ? 'application/json' : /\.txt$/.test(f) ? 'text/plain; charset=utf-8' : 'application/octet-stream';
      rs.writeHead(200, { 'Content-Type': typ }); fs.createReadStream(f).pipe(rs);
    });
    s.listen(0, '127.0.0.1', () => res(s));
  });
}

module.exports = [
  // ── A · Fotos an die KI-Functions ─────────────────────────────────────
  {
    name: 'A · Doktor, Schaedling, Pilz: das Foto geht verkleinert, neu kodiert, OHNE Exif (GPS) an die Function — unter 5 MB Base64',
    lauf: async (seite) => {
      await werkzeug(seite);
      const r = await seite.evaluate(async () => {
        const W = window.__r5, out = [];
        const wege = [
          ['plant-doctor-diagnose', 'photo', () => gsDoctorLoadPhoto({ files: [W.foto()] }), () => gsRunDiagnose()],
          ['pest-identify', 'image_base64', () => gsPestLoadPhoto({ files: [W.foto()] }), () => gsPestRunScan()],
          ['mushroom-identify', 'image_base64', () => gsMushroomLoadPhoto({ files: [W.foto()] }), () => gsMushroomRunScan()],
        ];
        for (const [fn, feld, lade, sende] of wege) {
          W.raus = [];
          await lade(); await sende();
          const hin = W.raus.filter(x => x.url.indexOf('/functions/v1/' + fn) >= 0);
          out.push({ fn, n: hin.length, p: hin[0] ? await W.pruefe(hin[0].body, feld) : null });
        }
        W.zurueck();
        return { out, fotoN: W.fotoN };
      });
      const schlecht = r.out.filter(x => x.n !== 1 || !x.p || x.p.exif || !x.p.masse || Math.max(x.p.masse[0], x.p.masse[1]) > 1920 || x.p.b64 > 5000000);
      if (schlecht.length) return { ok: false, warum: schlecht.map(x => x.fn + ': ' + JSON.stringify({ n: x.n, exif: x.p && x.p.exif, masse: x.p && x.p.masse, b64: x.p && x.p.b64 })).join(' | ') + ' (Original ' + r.fotoN + ' B, 2600x1800, mit Exif)' };
      return { ok: true, info: r.out.map(x => x.fn + ' ' + x.p.masse.join('x') + ' ' + Math.round(x.p.b64 / 1024) + ' KB b64').join(' · ') + ' — ohne Exif' };
    },
  },
  {
    name: 'A · ein unlesbares Bild (nur Metadaten) wird NICHT roh geschickt — ein Satz statt eines Aufrufs; ein vorheriges Foto bleibt nicht stehen',
    lauf: async (seite) => {
      await werkzeug(seite);
      const r = await seite.evaluate(async () => {
        const W = window.__r5, out = [];
        const wege = [
          ['plant-doctor-diagnose', () => gsDoctorLoadPhoto({ files: [W.foto()] }), () => gsDoctorLoadPhoto({ files: [W.kaputt()] }), () => gsRunDiagnose()],
          ['pest-identify', () => gsPestLoadPhoto({ files: [W.foto()] }), () => gsPestLoadPhoto({ files: [W.kaputt()] }), () => gsPestRunScan()],
          ['mushroom-identify', () => gsMushroomLoadPhoto({ files: [W.foto()] }), () => gsMushroomLoadPhoto({ files: [W.kaputt()] }), () => gsMushroomRunScan()],
        ];
        for (const [fn, gut, kaputt, sende] of wege) {
          await gut(); W.raus = []; W.saetze = [];
          await kaputt(); await sende();
          out.push({ fn, raus: W.raus.filter(x => x.url.indexOf('/functions/v1/') >= 0).length, saetze: W.saetze.slice() });
        }
        W.zurueck();
        return out;
      });
      const schlecht = r.filter(x => x.raus !== 0 || !x.saetze.length);
      if (schlecht.length) return { ok: false, warum: schlecht.map(x => x.fn + ': ' + x.raus + ' Aufruf(e), Saetze ' + JSON.stringify(x.saetze)).join(' | ') };
      return { ok: true, info: r.map(x => x.fn + ': 0 Aufrufe, „' + String(x.saetze[0]).slice(0, 40) + '…"').join(' · ') };
    },
  },
  {
    name: 'A · Geschwister: Garten-Scan (garden-scan-analyze) und Tagebuch-Foto halten kein rohes Kamerafoto',
    lauf: async (seite) => {
      await werkzeug(seite);
      const r = await seite.evaluate(async () => {
        const W = window.__r5;
        window._gsGardenScan = window._gsGardenScan || {};
        window._gsGardenScan.photos = [null, null, null]; window._gsGardenScan.busy = false;
        const altRef = window._gsGardenScanRefresh; window._gsGardenScanRefresh = () => {};
        gsGardenScanCapture(0);
        const inp = Array.from(document.querySelectorAll('input[type=file]')).pop();
        await inp.onchange({ target: { files: [W.foto()] } });
        window._gsGardenScanRefresh = altRef;
        const g = window._gsGardenScan.photos[0];
        const gu = g ? W.u8(g.b64) : null;
        window._gsDiaryState = { type: 'general', photoB64: null };
        await gsDiaryLoadPhoto({ files: [W.foto()] });
        const d = window._gsDiaryState.photoB64;
        const du = d ? W.u8(String(d).replace(/^data:[^,]*,/, '')) : null;
        W.zurueck();
        return { g: gu ? { exif: W.exif(gu), masse: await W.masse(gu) } : null, d: du ? { exif: W.exif(du), masse: await W.masse(du) } : null };
      });
      if (!r.g || r.g.exif || !r.g.masse || r.g.masse[0] > 1920) return { ok: false, warum: 'Garten-Scan-Foto: ' + JSON.stringify(r.g) };
      if (!r.d || r.d.exif || !r.d.masse || r.d.masse[0] > 1920) return { ok: false, warum: 'Tagebuch-Foto: ' + JSON.stringify(r.d) };
      return { ok: true, info: 'Garten-Scan ' + r.g.masse.join('x') + ' · Tagebuch ' + r.d.masse.join('x') + ' — ohne Exif' };
    },
  },

  // ── B · Stripe-Fenster ───────────────────────────────────────────────
  {
    name: 'B · Rueckkehr aus Stripe ohne opener (COOP): das Hauptfenster bekommt die Meldung (BroadcastChannel) und ruft _gsBillingPruefen; das Popup schliesst sich bzw. sagt „Du kannst dieses Fenster schliessen" — und laedt die App nicht',
    lauf: async (seite) => {
      const srv = await server();
      const port = srv.address().port, basis = 'http://127.0.0.1:' + port + '/';
      const br = seite.context().browser();
      const ctx = await br.newContext({ serviceWorkers: 'block', viewport: { width: 412, height: 915 } });
      await ctx.route('**', r => r.request().url().startsWith(basis) ? r.continue() : r.abort());
      try {
        const haupt = await ctx.newPage();
        await haupt.goto(basis, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await haupt.waitForTimeout(2500);
        await haupt.evaluate(() => { window.__pruef = []; window._gsBillingPruefen = async () => { window.__pruef.push(Date.now()); return false; }; });
        // (1) per Skript geoeffnet, OHNE opener (wie nach COOP) → schliesst sich
        const zu = ctx.waitForEvent('page');
        await haupt.evaluate((u) => { window.open(u + '?billing=success&popup=1', 'gs_pruef', 'noopener'); }, basis);
        const p1 = await zu;
        const geschlossen = await new Promise(res => { const t = setTimeout(() => res(false), 6000); p1.on('close', () => { clearTimeout(t); res(true); }); });
        const n1 = await haupt.evaluate(() => window.__pruef.length);
        // (2) nicht per Skript geoeffnet (close() wird verweigert) → ruhiger Satz, keine App
        const p2 = await ctx.newPage();
        await p2.goto(basis + 'robots.txt');
        await p2.goto(basis + '?billing=cancel&popup=1', { waitUntil: 'commit' });   // window.stop(): kein domcontentloaded
        await p2.waitForTimeout(2600);
        const z2 = await p2.evaluate(() => ({ text: document.body.innerText, app: !!document.getElementById('app') && document.getElementById('app').getBoundingClientRect().height > 0, tab: !!document.querySelector('.tab-bar, #tab-bar'), spaet: typeof window.gsPlans !== 'undefined' }));   // gsPlans steht in einem SPAETEREN Skript
        const n2 = await haupt.evaluate(() => window.__pruef.length);
        // (3) ohne popup=1 unveraendert: die Seite laedt die App
        const p3 = await ctx.newPage();
        await p3.goto(basis + '?billing=cancel', { waitUntil: 'domcontentloaded', timeout: 120000 });
        await p3.waitForTimeout(1500);
        const z3 = await p3.evaluate(() => ({ app: !!document.getElementById('app'), satz: /dieses Fenster/i.test(document.body.innerText) }));
        const n3 = await haupt.evaluate(() => window.__pruef.length);
        if (!geschlossen) return { ok: false, warum: 'das Popup (per Skript, ohne opener) schloss sich nicht' };
        if (n1 !== 1) return { ok: false, warum: 'Hauptfenster rief _gsBillingPruefen ' + n1 + '× (erwartet 1) — die Meldung kam nicht an' };
        if (!/Du kannst dieses Fenster schlie/i.test(z2.text)) return { ok: false, warum: 'kein Satz, als close() verweigert war: ' + JSON.stringify(z2.text.slice(0, 160)) };
        if (z2.app || z2.spaet) return { ok: false, warum: 'das Popup laedt die ganze App: ' + JSON.stringify(z2) };
        if (n2 !== 1) return { ok: false, warum: 'cancel loeste _gsBillingPruefen aus (' + n2 + ')' };
        if (!z3.app || z3.satz) return { ok: false, warum: 'Gegenrichtung: ohne popup=1 laedt die App nicht wie bisher: ' + JSON.stringify(z3) };
        if (n3 !== 1) return { ok: false, warum: 'ohne popup=1 meldete die Seite ans Hauptfenster' };
        return { ok: true, info: 'success → Hauptfenster 1× _gsBillingPruefen, Popup zu · close() verweigert → Satz, keine App · ohne popup=1 unveraendert' };
      } finally {
        await ctx.close().catch(() => {});
        srv.close();
      }
    },
  },

  // Gegenpruefung: der Rueckfall OHNE Fenster (Popup blockiert, Android-Huelle) navigiert das
  // HAUPTfenster zu Stripe — traegt die Rueckkehr-Adresse dann popup=1, haelt der Handler die
  // App an und sagt „Du kannst dieses Fenster schliessen" im einzigen Fenster der Person.
  {
    name: 'B · ohne Popup (blockiert, Huelle) traegt die Rueckkehr-Adresse KEIN popup=1 — mit Popup schon; Abo-Portal ebenso',
    lauf: async (seite) => {
      const r = await seite.evaluate(async () => {
        const alt = { li: window.sbIsLoggedIn, fe: window._gsCheckoutFenster, sb: window.sbFetch, f: window.fetch, gf: window._gsFetch, cm: window.gsConfirmModal, tok: window._gsFreshToken, t: window.gsToast };
        const koerper = [];
        const falschesFenster = () => ({ closed: false, document: { write() {}, body: {} }, location: {}, close() {} });
        window.sbIsLoggedIn = () => true;
        window._gsFreshToken = async () => 'pruef.token';
        window.gsToast = () => {};
        window.gsConfirmModal = async () => false;
        window.sbFetch = async () => ({ data: [{ id: 'price_x', metadata: { lookup_key: 'pro_monthly' } }], error: null });
        const fang = async (url, init) => { koerper.push({ url: String(url), body: init && init.body }); return { ok: false, status: 500, json: async () => ({}) }; };
        window.fetch = fang; window._gsFetch = fang;
        try {
          for (const mit of [false, true]) {
            window._gsCheckoutFenster = () => (mit ? falschesFenster() : null);
            await gsStartCheckout('pro_monthly');
            await gsOpenBillingPortal();
          }
        } finally {
          window.sbIsLoggedIn = alt.li; window._gsCheckoutFenster = alt.fe; window.sbFetch = alt.sb; window.fetch = alt.f; window._gsFetch = alt.gf; window.gsConfirmModal = alt.cm; window._gsFreshToken = alt.tok; window.gsToast = alt.t;
        }
        return koerper.map(k => { let o = {}; try { o = JSON.parse(k.body); } catch (e) {} return { fn: k.url.split('/functions/v1/')[1], urls: [o.success_url, o.cancel_url, o.return_url].filter(Boolean) }; });
      });
      if (r.length !== 4) return { ok: false, warum: 'erwartet 4 Aufrufe (Checkout+Portal, ohne/mit Fenster), gesehen ' + JSON.stringify(r) };
      const ohne = r.slice(0, 2), mit = r.slice(2);
      const pop = (x) => x.urls.length && x.urls.every(u => /[?&]popup=1(&|$)/.test(u));
      const kein = (x) => x.urls.length && x.urls.every(u => !/popup=1/.test(u));
      if (!ohne.every(kein)) return { ok: false, warum: 'OHNE Fenster kehrt das Hauptfenster mit popup=1 zurueck (die App laedt dann nicht): ' + JSON.stringify(ohne) };
      if (!mit.every(pop)) return { ok: false, warum: 'MIT Fenster fehlt popup=1: ' + JSON.stringify(mit) };
      return { ok: true, info: 'ohne Fenster: ' + ohne.map(x => x.fn + ' ' + x.urls.length + ' Adr. ohne popup=1').join(', ') + ' · mit Fenster: popup=1' };
    },
  },
  {
    name: 'B · das Hauptfenster selbst kommt mit popup=1 zurueck (Popup erst danach geschlossen): die App laedt, kein „Fenster schliessen"',
    lauf: async (seite) => {
      const srv = await server();
      const port = srv.address().port, basis = 'http://127.0.0.1:' + port + '/';
      const br = seite.context().browser();
      const ctx = await br.newContext({ serviceWorkers: 'block', viewport: { width: 412, height: 915 } });
      await ctx.route('**', r => r.request().url().startsWith(basis) ? r.continue() : r.abort());
      try {
        const p = await ctx.newPage();
        await p.goto(basis + 'robots.txt');
        await p.evaluate(() => sessionStorage.setItem('gs_billing_selbes_fenster', '1'));
        await p.goto(basis + '?billing=cancel&popup=1', { waitUntil: 'domcontentloaded', timeout: 120000 });
        await p.waitForTimeout(2600);
        const z = await p.evaluate(() => ({ spaet: typeof window.gsPlans !== 'undefined', satz: /dieses Fenster/i.test(document.body.innerText), rest: sessionStorage.getItem('gs_billing_selbes_fenster') }));
        if (!z.spaet || z.satz) return { ok: false, warum: 'das Hauptfenster laedt die App nicht: ' + JSON.stringify(z) };
        if (z.rest) return { ok: false, warum: 'die Marke bleibt stehen (das naechste Popup erbte sie)' };
        return { ok: true, info: 'Marke gesehen → App geladen, Marke verbraucht' };
      } finally {
        await ctx.close().catch(() => {});
        srv.close();
      }
    },
  },

  // ── C/D · Upserts auf den richtigen Schluessel ──────────────────────
  {
    name: 'C/D · Stimme umstimmen (feedback_votes) und Push-Abo (push_subscriptions) tragen on_conflict auf den UNIQUE-Schluessel; das Abo schickt updated_at',
    lauf: async (seite) => {
      const r = await seite.evaluate(async () => {
        const alt = { sb: window.sbFetch, cfg: window.sbGetConfig };
        const wege = [];
        window.sbFetch = async (p, o) => { wege.push({ p: String(p), m: o && o.method, h: o && o.headers, b: o && o.body }); return { data: [{ id: 'x' }], error: null }; };
        window.sbGetConfig = () => ({ url: 'x', key: 'y' });
        try {
          feedbackItems.length = 0;
          feedbackItems.push({ id: 'fbr5', sb_id: 'f0000000-0000-4000-8000-0000000000r5', title: 'Dunkelmodus', body: 'x', type: 'idea', votes: { up: 0, down: 0 }, ts: Date.now() });
          delete myVotes['fbr5'];
          vote('fbr5', 'up'); vote('fbr5', 'down');
          await new Promise(res => setTimeout(res, 100));
          await gsRegisterPushSubscription({ endpoint: 'https://push.example.invalid/abc', keys: { p256dh: 'p', auth: 'a' } });
        } finally { window.sbFetch = alt.sb; window.sbGetConfig = alt.cfg; }
        return wege.filter(w => /feedback_votes|push_subscriptions/.test(w.p) && w.m === 'POST').map(w => ({ p: w.p, prefer: w.h && w.h.Prefer, b: w.b }));
      });
      const st = r.filter(x => /feedback_votes/.test(x.p));
      const ab = r.filter(x => /push_subscriptions/.test(x.p));
      if (st.length !== 2) return { ok: false, warum: 'erwartet 2 Stimmen-POSTs, gesehen ' + st.length + ' ' + JSON.stringify(r.map(x => x.p)) };
      if (st.some(x => !/[?&]on_conflict=item_id,voter_key(&|$)/.test(x.p))) return { ok: false, warum: 'Stimme ohne on_conflict=item_id,voter_key: ' + st.map(x => x.p).join(' | ') + ' — das Umstimmen kollidiert mit UNIQUE (23505)' };
      if (JSON.parse(st[1].b).dir !== 'down') return { ok: false, warum: 'die zweite Stimme ist kein Umstimmen: ' + st[1].b };
      if (ab.length !== 1 || !/[?&]on_conflict=user_id,endpoint(&|$)/.test(ab[0].p)) return { ok: false, warum: 'Push-Abo ohne on_conflict=user_id,endpoint: ' + JSON.stringify(ab.map(x => x.p)) };
      const b = JSON.parse(ab[0].b);
      if (!b.updated_at || Math.abs(Date.now() - Date.parse(b.updated_at)) > 60000) return { ok: false, warum: 'Push-Abo ohne frisches updated_at: ' + JSON.stringify(b.updated_at) };
      if (!/merge-duplicates/.test(ab[0].prefer) || !/merge-duplicates/.test(st[0].prefer)) return { ok: false, warum: 'kein Upsert mehr (merge-duplicates fehlt)' };
      return { ok: true, info: 'Stimme up→down: 2× ?on_conflict=item_id,voter_key · Abo: ?on_conflict=user_id,endpoint + updated_at' };
    },
  },

  // ── E · Plan-Hinweis und Status-Codes ───────────────────────────────
  {
    name: 'E · Planer-Fehler bei Tageslimit: ein Pro-Kunde liest kein „Mit Pro: unbegrenzt" und keinen Upgrade-Knopf; der Satz des Servers steht da; Free behaelt den Hinweis',
    lauf: async (seite) => {
      const r = await seite.evaluate(async () => {
        const alt = { ai: window.callAI, w: window.gsPPfetchWeather, ag: window.gsPPloadAgronomy, plan: localStorage.getItem('gs_abo_plan') };
        window.gsPPfetchWeather = async () => {}; window.gsPPloadAgronomy = async () => {};
        const lauf = async (plan, fehler) => {
          localStorage.setItem('gs_abo_plan', plan);
          window.callAI = async () => { throw fehler(); };
          try { openModal('modal-planner-pro'); } catch (e) {}
          try { await gsPPrun(); } catch (e) {}
          const el = document.getElementById('pp-plan-result');
          return { text: el ? el.innerText : '', upgrade: !!(el && /Upgrade auf Pro/.test(el.innerText)) };
        };
        const serverPro = () => { const e = new Error('🚫 Tageslimit erreicht (200/200).'); e.code = 'free_quota_reached'; e.quota = { used: 200, limit: 200, tier: 'pro' }; return e; };
        const ohneCode = () => new Error('Quota exceeded');
        const freiApp = () => { const e = new Error('🚫 Tageslimit erreicht — heute 15/15 KI-Aufrufe verbraucht. Mit eigenem Anthropic-Key (Einstellungen → KI & Scanner) entfällt das Limit — oder Pro für unbegrenzte Nutzung.'); e.code = 'free_quota_reached'; return e; };
        const out = {};
        try {
          out.proServer = await lauf('pro', serverPro);
          out.proOhne = await lauf('pro', ohneCode);
          out.freiOhne = await lauf('free', ohneCode);
          out.freiApp = await lauf('free', freiApp);
        } finally {
          window.callAI = alt.ai; window.gsPPfetchWeather = alt.w; window.gsPPloadAgronomy = alt.ag;
          if (alt.plan == null) localStorage.removeItem('gs_abo_plan'); else localStorage.setItem('gs_abo_plan', alt.plan);
          try { closeModal('modal-planner-pro'); } catch (e) {}
        }
        return out;
      });
      for (const k of ['proServer', 'proOhne']) {
        if (/Mit Pro/i.test(r[k].text) || r[k].upgrade) return { ok: false, warum: k + ': ein Pro-Kunde liest „Mit Pro"/Upgrade: ' + JSON.stringify(r[k].text.slice(0, 200)) };
      }
      if (r.proServer.text.indexOf('Tageslimit erreicht (200/200)') < 0) return { ok: false, warum: 'der Satz des Servers fehlt: ' + JSON.stringify(r.proServer.text.slice(0, 200)) };
      if (!/Tageskontingent/.test(r.proOhne.text)) return { ok: false, warum: 'Pro ohne Server-Satz: kein ruhiger Satz: ' + JSON.stringify(r.proOhne.text.slice(0, 200)) };
      if (!/Mit Pro: unbegrenzt/.test(r.freiOhne.text) || !r.freiOhne.upgrade) return { ok: false, warum: 'Gegenrichtung: Free ohne Satz verliert den Hinweis/Knopf: ' + JSON.stringify(r.freiOhne) };
      if (r.freiApp.text.indexOf('15/15 KI-Aufrufe') < 0 || !r.freiApp.upgrade) return { ok: false, warum: 'Free mit App-Satz: ' + JSON.stringify(r.freiApp.text.slice(0, 200)) };
      return { ok: true, info: 'Pro: Server-Satz bzw. „Tageskontingent", 0 Upgrade · Free: Hinweis + Knopf wie bisher' };
    },
  },
  {
    name: 'E · gsMktSetStatus: ein Code des Servers (banned, not_found, …) wird ein eigener Satz (_t), nie der rohe Slug oder Servertext',
    lauf: async (seite) => {
      const r = await seite.evaluate(async () => {
        const alt = { sb: window.sbFetch, t: gsI18n.t, toast: window.gsToast };
        const saetze = [];
        window.gsToast = (m) => saetze.push(String(m));
        gsI18n.t = (k, f) => 'T:' + k;
        const out = [];
        try {
          for (const antwort of [
            { ok: false, code: 'banned', error: 'Dein Konto ist gesperrt – <b>Servertext</b>' },
            { ok: false, error: 'not_found' }, { ok: false, error: 'forbidden' }, { ok: false, error: 'constructor' },
          ]) {
            saetze.length = 0;
            window.sbFetch = async () => ({ data: antwort, error: null });
            await gsMktSetStatus('l1', 'sold');
            out.push(saetze.slice());
          }
        } finally { window.sbFetch = alt.sb; gsI18n.t = alt.t; window.gsToast = alt.toast; }
        return out;
      });
      const soll = ['T:mkt_status_gesperrt', 'T:mkt_status_nicht_gefunden', 'T:err_own_listings_only', 'T:err_generic'];
      for (let i = 0; i < soll.length; i++) {
        if (!r[i].length || r[i][0].indexOf(soll[i]) < 0 || /Servertext|not_found|native code/.test(r[i][0])) return { ok: false, warum: 'Fall ' + i + ': ' + JSON.stringify(r[i]) + ' (erwartet ' + soll[i] + ')' };
      }
      return { ok: true, info: 'banned / not_found / forbidden / unbekannt → ' + soll.join(', ') };
    },
  },

  // ── F · Tabellen-Nachschlag ─────────────────────────────────────────
  {
    name: 'F · Wasser, Besucher, Heilmittel, Rezepte, Pilz-Ampel: mit \'constructor\' / \'__proto__\' als Wert kein Funktions-Quelltext, kein [object Object]; ein gueltiger Schluessel wie vorher',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async () => {
        const warte = (ms) => new Promise(res => setTimeout(res, ms));
        const alt = { sb: window.sbFetch, li: window.sbIsLoggedIn };
        window.sbIsLoggedIn = () => true;
        const SCHLECHT = /native code|\[object Object\]|function Object|function Function/;
        const out = [];
        const zeile = (k) => ({ id: 'r5-' + k, slug: 'r5-' + k, name_de: 'Seerose', common_name_de: 'Igel', scientific_name: 'Nymphaea alba', title: 'Kamillentee',
          feature_type: k, category: k, evidence_level: k, edibility: k, beginner_level: k });
        const el = document.getElementById('wissen-content');
        try {
          for (const k of ['constructor', '__proto__', 'teichpflanze', 'insekt_nuetzling', 'clinical']) {
            window.sbFetch = async (p) => (/\/rest\/v1\//.test(p) ? { data: [zeile(k)], error: null } : { data: null, error: { message: 'gestellt' } });
            for (const s of ['wasser', 'besucher']) {
              window._gsWave9Cache = {}; window._gsWave9Filter = {};
              await window.gsRenderWissenWave9(s); await warte(250);
              out.push({ wo: 'W9 ' + s + ' ' + k, text: el.innerText });
              const karte = el.querySelector('[onclick^="gsWave9OpenDetail"]');
              if (karte) { karte.click(); await warte(400); out.push({ wo: 'W9 ' + s + ' Detail ' + k, text: document.getElementById('modal-content').innerText }); }
              try { closeModal('detail-modal'); } catch (e) {}
            }
            window._gsKbFilters = {};
            await window.gsRenderKnowledge('heilmittel'); await warte(250);
            out.push({ wo: 'KB heilmittel ' + k, text: el.innerText });
            // Rezepte: Karte und Detail
            const rz = { id: 'r5rez-' + k, name: 'Baerlauchpesto', cat: k, diff: k, ingredients: ['Baerlauch'], steps: ['mixen'] };
            out.push({ wo: 'Rezeptkarte ' + k, text: (function () { const d = document.createElement('div'); d.innerHTML = buildRecipeCard(rz, false); return d.innerText; })() });
            recipesData.push(rz);
            try { openRecipeDetail(rz.id); await warte(200); out.push({ wo: 'Rezeptdetail ' + k, text: (document.getElementById('modal-recipe-detail') || document.body).innerText }); } catch (e) { out.push({ wo: 'Rezeptdetail ' + k, text: 'AUSNAHME ' + e.message }); }
            recipesData.splice(recipesData.indexOf(rz), 1);
            try { closeModal('modal-recipe-detail'); } catch (e) {}
          }
        } finally { window.sbFetch = alt.sb; window.sbIsLoggedIn = alt.li; window._gsWave9Cache = {}; window._gsWave9Filter = {}; window._gsKbFilters = {}; }
        // Pilz-Ampel: die Tabelle direkt mit dem Nachschlag der Anzeige (gsRenderRegionalMushrooms-Zweig)
        return { schlecht: out.filter(o => SCHLECHT.test(o.text)).map(o => o.wo + ': ' + (o.text.match(SCHLECHT) || [''])[0]),
          gut: out.filter(o => /teichpflanze|insekt_nuetzling|clinical/.test(o.wo)).map(o => ({ wo: o.wo, text: o.text })) , n: out.length };
      });
      const p = await h.pwned();
      if (p != null) return { ok: false, warum: '__pwned=' + p };
      if (r.schlecht.length) return { ok: false, warum: r.schlecht.slice(0, 8).join(' | ') };
      const gutW = r.gut.find(g => g.wo === 'W9 wasser Detail teichpflanze');
      const gutB = r.gut.find(g => g.wo === 'W9 besucher Detail insekt_nuetzling');
      const gutH = r.gut.find(g => g.wo === 'KB heilmittel clinical');
      if (!gutW || !/Teichpflanze/.test(gutW.text)) return { ok: false, warum: 'gutartig: Wasser-Detail ohne „Teichpflanze"' };
      if (!gutB || !/Nützling-Insekt/.test(gutB.text)) return { ok: false, warum: 'gutartig: Besucher-Detail ohne „Nützling-Insekt"' };
      if (!gutH || !/klinisch belegt/.test(gutH.text)) return { ok: false, warum: 'gutartig: Heilmittel ohne „klinisch belegt"' };
      return { ok: true, info: r.n + ' Ansichten gemessen, 0 Funktions-Quelltext · gueltige Schluessel wie vorher' };
    },
  },
  // Gegenpruefung: dieselbe Bauform als OBJEKT-LITERAL ({…}[wert]) — Marktplatz-Kategorie,
  // Kategorie einer Community-Art, Verwechslungs-Satz. Die Grep-Suche nach TABELLE[zeile.feld] sah sie nicht.
  {
    name: 'F · Objekt-Literale: Markt-Kategorie (_catEmoji/_catLabel), Arten-Kategorie (getCatLabel) — kein Funktions-Quelltext fuer constructor/__proto__',
    lauf: async (seite) => {
      const r = await seite.evaluate(() => {
        const out = {};
        for (const k of ['constructor', '__proto__', 'toString', 'valueOf']) {
          out[k] = [_catEmoji(k), _catLabel(k), getCatLabel(k)].map(v => typeof v + ':' + String(v).slice(0, 40));
        }
        out.gut = [_catEmoji('samen'), _catLabel('samen'), getCatLabel('pilz')].map(String);
        return out;
      });
      const schlecht = Object.keys(r).filter(k => k !== 'gut' && r[k].some(v => !/^string:/.test(v) || /function|\[object/i.test(v)));
      if (schlecht.length) return { ok: false, warum: schlecht.map(k => k + ' → ' + JSON.stringify(r[k])).join(' | ') };
      if (r.gut[0] !== '🌰' || !/Samen/.test(r.gut[1]) || !/Pilz/.test(r.gut[2])) return { ok: false, warum: 'gueltige Schluessel liefern nicht mehr: ' + JSON.stringify(r.gut) };
      return { ok: true, info: 'constructor → ' + r.constructor.join(' / ') + ' · samen → ' + r.gut.join(' / ') };
    },
  },
  {
    name: 'F · _gsNachschlag selbst: nur eigene Eintraege, Rueckfall fuer constructor/__proto__/toString/hasOwnProperty und Objekte',
    lauf: async (seite) => {
      const r = await seite.evaluate(() => {
        const t = { a: 1, leer: 0 };
        return [_gsNachschlag(t, 'a', 'R'), _gsNachschlag(t, 'leer', 'R'), _gsNachschlag(t, 'constructor', 'R'), _gsNachschlag(t, '__proto__', 'R'), _gsNachschlag(t, 'toString', 'R'), _gsNachschlag(t, 'hasOwnProperty', 'R'), _gsNachschlag(t, { toString: () => 'a' }, 'R'), _gsNachschlag(null, 'a', 'R'),
          _gsNachschlag(GS_BEGINNER_AMPEL, 'constructor', null), typeof _gsNachschlag(GS_BEGINNER_AMPEL, Object.keys(GS_BEGINNER_AMPEL)[0], null)];
      });
      const soll = [1, 0, 'R', 'R', 'R', 'R', 'R', 'R', null, 'object'];
      if (JSON.stringify(r) !== JSON.stringify(soll)) return { ok: false, warum: JSON.stringify(r) + ' ≠ ' + JSON.stringify(soll) };
      return { ok: true, info: 'eigene Schluessel (auch 0) · 6 Fallen → Rueckfall · Pilz-Ampel: constructor → null, gueltig → Objekt' };
    },
  },

  // ── H · Admin-Warnung ───────────────────────────────────────────────
  {
    name: 'H · Arten-Vorschlag: das ⛔ nennt, was zutrifft (Name fehlt / Auszeichnung / ueberlang) — dieselbe Regel wie _gsArtEingang',
    lauf: async (seite) => {
      const r = await seite.evaluate(() => {
        const text = (p) => { const d = document.createElement('div'); d.innerHTML = _gsAdminSpeciesProposalHtml([Object.assign({ id: 'p1', latin: 'Allium ursinum', family: 'Amaryllidaceae', data: {} }, p)]); return d.innerText; };
        const faelle = { leer: { name: '   ' }, ohne: { name: null }, markup: { name: '<b>Baerlauch</b>' }, lang: { name: 'B'.repeat(130) }, gut: { name: 'Bärlauch' } };
        const out = {};
        Object.keys(faelle).forEach(k => {
          const t = text(faelle[k]);
          out[k] = { stop: /⛔/.test(t), fehlt: /Name fehlt/.test(t), markup: /Auszeichnung/.test(t), lang: /überlang/.test(t),
            regel: _gsArtEingang({ name: faelle[k].name, lat: 'Allium ursinum', fam: 'Amaryllidaceae' }) === null };
        });
        return out;
      });
      const soll = { leer: 'fehlt', ohne: 'fehlt', markup: 'markup', lang: 'lang' };
      for (const k of Object.keys(soll)) {
        const x = r[k];
        if (!x.stop || !x.regel) return { ok: false, warum: k + ': kein ⛔ bzw. die Regel verwirft nicht: ' + JSON.stringify(x) };
        const an = ['fehlt', 'markup', 'lang'].filter(g => x[g]);
        if (an.length !== 1 || an[0] !== soll[k]) return { ok: false, warum: k + ': nennt ' + JSON.stringify(an) + ' statt ' + soll[k] };
      }
      if (r.gut.stop || r.gut.regel) return { ok: false, warum: 'gutartig: „Bärlauch" bekommt ein ⛔ bzw. wird verworfen' };
      return { ok: true, info: 'leer/null → Name fehlt · <b> → Auszeichnung · 130 Zeichen → überlang · Bärlauch ohne ⛔' };
    },
  },

  // ── G · Alt-Plaene und das alte Fund-Foto ───────────────────────────
  {
    name: 'G · _uploadLocalOnly: ein oeffentlicher Fund mit altem Foto — nach dem Ersetzen wird das alte Objekt entfernt und der Marker zeigt aufs neue',
    lauf: async (seite) => {
      const r = await seite.evaluate(async (app1) => {
        const uid = gsStore.get('gs_sb_uid', null);
        const cv = document.createElement('canvas'); cv.width = 40; cv.height = 30; cv.getContext('2d').fillRect(0, 0, 10, 10);
        const s = atob(cv.toDataURL('image/jpeg', 0.9).split(',')[1]); const roh = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) roh[i] = s.charCodeAt(i);
        const mit = new Uint8Array(roh.length + app1.length); mit.set(roh.subarray(0, 2), 0); mit.set(app1, 2); mit.set(roh.subarray(2), 2 + app1.length);
        const basis = SB_URL + '/storage/v1/object/public/map-find-photos/';
        const altUrl = basis + uid + '/alt_r5.jpg';
        const alt = { f: window._gsFetch, sb: window.sbFetch, tok: window._gsFreshToken, m: localStorage.getItem('greenscan_markers') };
        const ruf = [];
        window._gsFreshToken = async () => 'pruef.stand.token';
        window._gsFetch = async (url, init) => {
          const m = (init && init.method) || 'GET'; ruf.push(m + ' ' + String(url));
          if (m === 'GET') return { ok: true, status: 200, arrayBuffer: async () => mit.buffer.slice(0) };
          return { ok: true, status: 200, text: async () => '', json: async () => ({}) };
        };
        window.sbFetch = async (p, o) => ({ data: [{ id: 'c-r5' }], error: null });
        const marker = { id: 'm-r5', name: 'Morchel', cat: 'pilz', lat: 47.3712, lng: 8.5401, date: Date.now(), is_private: false, photo_url: altUrl };
        localStorage.setItem('greenscan_markers', JSON.stringify([marker]));
        try { await window.gsMapFinds._uploadLocalOnly([marker]); await new Promise(res => setTimeout(res, 200)); }
        finally { window._gsFetch = alt.f; window.sbFetch = alt.sb; window._gsFreshToken = alt.tok; }
        const nachher = JSON.parse(localStorage.getItem('greenscan_markers') || '[]')[0] || {};
        if (alt.m == null) localStorage.removeItem('greenscan_markers'); else localStorage.setItem('greenscan_markers', alt.m);
        return { ruf, altUrl, foto: nachher.photo_url, cloud: nachher.cloud_id };
      }, APP1);
      const del = r.ruf.filter(x => /^DELETE /.test(x));
      const hoch = r.ruf.filter(x => /^POST .*\/storage\/v1\/object\/map-find-photos\//.test(x));
      if (!hoch.length) return { ok: false, warum: 'kein neu kodierter Upload — der Fall misst nichts: ' + JSON.stringify(r.ruf) };
      if (del.length !== 1 || del[0].indexOf('/storage/v1/object/map-find-photos/') < 0 || !/alt_r5\.jpg$/.test(del[0])) return { ok: false, warum: 'altes Objekt (mit Exif) nicht entfernt: ' + JSON.stringify(r.ruf) };
      if (!r.foto || r.foto === r.altUrl) return { ok: false, warum: 'der Marker zeigt weiter auf das entfernte alte Foto' };
      return { ok: true, info: '1 Upload neu, 1 DELETE alt_r5.jpg, Marker → neue Adresse' };
    },
  },
  {
    name: 'G · ein Plan von VOR dem Stempel (ohne uid): A angemeldet → gestempelt; abmelden → geparkt, B sieht ihn nicht; A wieder da → er ist da',
    lauf: async (seite) => {
      const r = await seite.evaluate(async () => {
        const A = gsStore.get('gs_sb_uid', null), B = '00000000-0000-4000-8000-0000000000b2';
        const alt = { sb: window.sbFetch, li: window.sbIsLoggedIn, tok: localStorage.getItem('gs_sb_token') };
        window.sbIsLoggedIn = () => true;
        window.sbFetch = async (p, o) => ((o && o.method) === 'POST' ? { data: null, error: { message: 'offline (gestellt)' } } : { data: [], error: null });
        const titel = (l) => (Array.isArray(l) ? l : []).map(e => e && e.title);
        localStorage.removeItem('gs_plans_wartend');
        localStorage.setItem('gs_plans_v2', JSON.stringify([{ localId: 'l-alt-r5', id: 'l-alt-r5', type: 'garden', title: 'Altplan r5', summary: '', payload: {}, created: new Date().toISOString(), starred: false, cloud: false }]));
        localStorage.setItem('gs_last_active_uid', A);
        const out = {};
        try {
          out.a1 = titel(await gsPlans.list());
          out.stempel = (JSON.parse(localStorage.getItem('gs_plans_v2') || '[]')[0] || {}).uid || null;
          gsClearUserDataKeys();
          out.wartend = (JSON.parse(localStorage.getItem('gs_plans_wartend') || '[]')).map(e => e.uid);
          localStorage.setItem('gs_sb_uid', B); localStorage.setItem('gs_last_active_uid', B); localStorage.setItem('gs_sb_token', alt.tok || 'pruef.stand.token');
          out.b = titel(await gsPlans.list());
          localStorage.setItem('gs_sb_uid', A); localStorage.setItem('gs_last_active_uid', A);
          out.a2 = titel(await gsPlans.list());
        } finally { window.sbFetch = alt.sb; window.sbIsLoggedIn = alt.li; localStorage.setItem('gs_sb_uid', A); if (alt.tok) localStorage.setItem('gs_sb_token', alt.tok); }
        return Object.assign(out, { A });
      });
      if (r.a1.indexOf('Altplan r5') < 0) return { ok: false, warum: 'A sieht den Altplan nicht einmal vor dem Abmelden — der Fall misst nichts: ' + JSON.stringify(r) };
      if (r.stempel !== r.A) return { ok: false, warum: 'beim ersten Lesen nicht gestempelt: uid=' + r.stempel };
      if (r.wartend.indexOf(r.A) < 0) return { ok: false, warum: 'beim Abmelden nicht geparkt (der Plan ging mit gs_plans_v2): ' + JSON.stringify(r) };
      if (r.b.indexOf('Altplan r5') >= 0) return { ok: false, warum: 'B sieht den Plan von A' };
      if (r.a2.indexOf('Altplan r5') < 0) return { ok: false, warum: 'A wieder da — der Plan fehlt: ' + JSON.stringify(r) };
      return { ok: true, info: 'gestempelt → geparkt → B: nicht sichtbar → A: wieder da' };
    },
  },
];
