// Gruppe k7 — Sitzung und Start (v33.59): ein Token aus dem Link, die
// Backend-Adresse aus dem Speicher, Start-Parameter, gespeicherte Plaene nach
// dem Abmelden, ein Link auf einen tieferen Pfad.
//
// Jeder Fall faehrt die ECHTE Funktion und misst die WIRKUNG: was danach in
// gs_sb_token steht, wohin die Anfrage wirklich geht, welcher Bildschirm
// sichtbar ist, was nach dem Abmelden noch im Speicher liegt, wie viele Arten
// die App unter /a/b hat. Gestellt wird nur der Server (fetch).
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');

const WURZEL = path.resolve(__dirname, '..', '..');
const OPFER_UID = '00000000-0000-4000-8000-000000000001';
const FREMD_UID = '11111111-1111-4111-8111-111111111111';
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXI';   // Form eines JWT, kein echter

// Stellt den Server fuer /auth/v1/user (und /auth/v1/logout, PUT) und ruft
// gsHandleAuthRedirect mit dem gegebenen Anker. antwort: 'ja' | 'nein' | 'netz'.
async function rueckkehr(h, o) {
  const r = await h.seite().evaluate(async (o) => {
    const vorher = localStorage.getItem('gs_sb_token');
    const log = { anfragen: [], toasts: [], prompt: 0, confirm: 0, abgemeldet: 0 };
    const altFetch = window.fetch, altGs = window._gsFetch, altT = window.showProfileToast,
          altP = window.gsPromptModal, altC = window.gsConfirmModal, altL = window.sbLogout;
    const stell = async (url, opts) => {
      url = String(url); opts = opts || {};
      const hd = opts.headers || {};
      log.anfragen.push({ url, method: opts.method || 'GET', auth: hd.Authorization || hd.authorization || '' });
      if (o.antwort === 'netz') throw new TypeError('Failed to fetch');
      if (/\/auth\/v1\/user/.test(url) && (opts.method || 'GET') === 'GET') {
        if (o.antwort === 'nein') return new Response('{"code":401,"msg":"invalid JWT"}', { status: 401, headers: { 'Content-Type': 'application/json' } });
        return new Response(JSON.stringify({ id: o.uid, email: o.email }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ id: o.uid }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    window.fetch = stell; window._gsFetch = stell;
    window.showProfileToast = function (m) { log.toasts.push(typeof m === 'object' ? JSON.stringify(m) : String(m)); };
    window.gsPromptModal = function () { log.prompt++; return Promise.resolve(o.passwort || null); };
    window.gsConfirmModal = function () { log.confirm++; return Promise.resolve(!!o.ja); };
    window.sbLogout = async function () { log.abgemeldet++; return altL.apply(this, arguments); };
    if (o.abgemeldet) { localStorage.removeItem('gs_sb_token'); localStorage.removeItem('gs_sb_uid'); }
    history.replaceState(null, '', location.pathname + '#' + o.anker);
    try { await gsHandleAuthRedirect(); } catch (e) { log.wurf = String(e && e.message); }
    await new Promise(r => setTimeout(r, 1400));
    const out = {
      vorher, token: localStorage.getItem('gs_sb_token'), uid: localStorage.getItem('gs_sb_uid'),
      expires: localStorage.getItem('gs_sb_expires'), hash: location.hash, log,
    };
    window.fetch = altFetch; window._gsFetch = altGs; window.showProfileToast = altT;
    window.gsPromptModal = altP; window.gsConfirmModal = altC; window.sbLogout = altL;
    return out;
  }, o);
  await h.frisch();   // jeder Fall beginnt mit derselben angemeldeten Sitzung
  return r;
}

function quelltextOhneKommentare() {
  return fs.readFileSync(path.join(WURZEL, 'index.html'), 'utf8')
    .split('\n').filter(z => !/^\s*(\/\/|\*|\/\*)/.test(z)).join('\n');
}

module.exports = [
  {
    name: 'Auth-Rueckkehr · ein Token eines FREMDEN Kontos wird nicht still zur Sitzung (Nein in der Rueckfrage)',
    lauf: async (seite, h) => {
      const r = await rueckkehr(h, {
        anker: 'access_token=' + JWT + '&type=recovery&expires_in=99999999',
        antwort: 'ja', uid: FREMD_UID, email: 'angreifer@example.invalid', ja: false,
      });
      if (r.token !== r.vorher) return { ok: false, warum: 'gs_sb_token wurde ersetzt: ' + r.token + ' (vorher ' + r.vorher + ')' };
      if (r.hash) return { ok: false, warum: 'der Anker steht noch in der Adresse: ' + r.hash.slice(0, 60) };
      if (!r.log.confirm) return { ok: false, warum: 'keine Rueckfrage, obwohl ein anderes Konto angemeldet ist' };
      if (r.log.prompt) return { ok: false, warum: 'Passwort-Dialog fuer das fremde Konto trotz Nein' };
      if (!r.log.anfragen.some(a => /\/auth\/v1\/user/.test(a.url) && a.auth === 'Bearer ' + JWT)) return { ok: false, warum: 'der Token wurde nicht beim Server geprueft' };
      return { ok: true, info: 'Token unveraendert · Rueckfrage · Nein → kein Dialog · Anker weg' };
    },
  },
  {
    name: 'Auth-Rueckkehr · Server sagt Nein / Netz faellt aus / unbekannte Art → Sitzung unberuehrt, Anker weg, ein Satz',
    lauf: async (seite, h) => {
      const faelle = [
        { anker: 'access_token=' + JWT + '&type=recovery', antwort: 'nein', uid: OPFER_UID },
        { anker: 'access_token=' + JWT + '&type=recovery', antwort: 'netz', uid: OPFER_UID },
        { anker: 'access_token=' + JWT + '&type=bogus', antwort: 'ja', uid: OPFER_UID },
        { anker: 'access_token=' + JWT + '&type=signup&refresh_token=rt', antwort: 'ja', uid: FREMD_UID },
        { anker: 'error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid', antwort: 'ja', uid: OPFER_UID },
        // Anmelde-Link: wird nicht zur Sitzung, und der Satz sagt WARUM (nicht „ungueltig")
        { anker: 'access_token=' + JWT + '&type=magiclink&refresh_token=rt&expires_in=99999999', antwort: 'ja', uid: FREMD_UID, satzRe: /nicht möglich/ },
      ];
      const schlecht = [];
      for (const f of faelle) {
        const r = await rueckkehr(h, f);
        const satz = r.log.toasts.some(t => (f.satzRe || /ungültig|abgelaufen|Verbindung/i).test(t));
        if (f.satzRe && !satz) { schlecht.push(f.anker.slice(0, 40) + ' → kein passender Satz: ' + JSON.stringify(r.log.toasts)); continue; }
        if (r.token !== r.vorher || r.hash || r.log.prompt || (f.antwort !== 'ja' || /bogus|error=/.test(f.anker)) && !satz && !/signup/.test(f.anker))
          schlecht.push(f.anker.slice(0, 40) + '/' + f.antwort + ' → token ' + (r.token !== r.vorher ? 'ERSETZT' : 'gleich') + ', hash ' + JSON.stringify(r.hash.slice(0, 30)) + ', prompt ' + r.log.prompt + ', satz ' + satz);
      }
      if (schlecht.length) return { ok: false, warum: schlecht.join(' | ') };
      return { ok: true, info: faelle.length + ' Faelle: Nein · Netz · unbekannte Art · signup · Fehler-Anker — Token gleich, Anker weg, Satz da' };
    },
  },
  {
    name: 'Auth-Rueckkehr · gutartig: abgemeldet, Server sagt Ja → Passwort-Dialog, PUT mit DIESEM Token, keine Sitzung daraus',
    lauf: async (seite, h) => {
      const r = await rueckkehr(h, {
        anker: 'access_token=' + JWT + '&type=recovery&expires_in=3600', antwort: 'ja',
        uid: OPFER_UID, email: 'ich@example.invalid', abgemeldet: true, passwort: 'neuesPasswort123',
      });
      const put = r.log.anfragen.find(a => a.method === 'PUT' && /\/auth\/v1\/user/.test(a.url));
      if (!r.log.prompt) return { ok: false, warum: 'kein Passwort-Dialog: ' + JSON.stringify(r.log) };
      if (!put) return { ok: false, warum: 'kein PUT an /auth/v1/user: ' + JSON.stringify(r.log.anfragen) };
      if (put.auth !== 'Bearer ' + JWT) return { ok: false, warum: 'PUT mit anderem Token: ' + put.auth };
      if (r.token) return { ok: false, warum: 'der Wiederherstellungs-Token liegt als Sitzung im Speicher: ' + r.token };
      if (r.hash) return { ok: false, warum: 'Anker steht noch da' };
      if (!r.log.toasts.some(t => /Passwort/.test(t) && /geändert/.test(t))) return { ok: false, warum: 'keine Bestaetigung: ' + JSON.stringify(r.log.toasts) };
      return { ok: true, info: 'Dialog · PUT mit dem geprueften Token · nichts in gs_sb_token · Bestaetigung' };
    },
  },
  {
    name: 'Auth-Rueckkehr · fremdes Konto, Ja in der Rueckfrage → erst sauber abmelden, dann der Dialog',
    lauf: async (seite, h) => {
      const r = await rueckkehr(h, {
        anker: 'access_token=' + JWT + '&type=recovery', antwort: 'ja',
        uid: FREMD_UID, email: 'zweites@example.invalid', ja: true, passwort: null,
      });
      if (!r.log.confirm) return { ok: false, warum: 'keine Rueckfrage' };
      if (!r.log.abgemeldet) return { ok: false, warum: 'nicht abgemeldet vor dem Wechsel' };
      if (r.token || r.uid) return { ok: false, warum: 'alte Sitzung steht noch: ' + r.token + ' / ' + r.uid };
      if (!r.log.prompt) return { ok: false, warum: 'kein Dialog nach dem Ja' };
      return { ok: true, info: 'Rueckfrage · Ja → sbLogout · danach Dialog · keine Sitzung im Speicher' };
    },
  },
  {
    name: 'Backend-Adresse · gs_sb_url/gs_sb_key aus dem Speicher bestimmen das Ziel nicht und werden entfernt',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async () => {
        localStorage.setItem('gs_sb_url', 'https://angreifer.supabase.co');
        localStorage.setItem('gs_sb_key', 'sb_publishable_ANGREIFERxxxxxxxxxxxxxxxx');
        const urls = [];
        const alt = window._gsFetch, altF = window.fetch;
        const stell = async (u, o) => { urls.push({ u: String(u), key: ((o && o.headers) || {}).apikey }); return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }); };
        window._gsFetch = stell; window.fetch = stell;
        await sbFetch('/rest/v1/species?select=id&limit=1', { method: 'GET' });
        window._gsFetch = alt; window.fetch = altF;
        // der Admin-Dialog: zeigt an, speichert keine andere Adresse
        const adm = window.gsIsAdmin; window.gsIsAdmin = () => true;
        let dlg = null;
        try { openAdminSbKeyPanel(); const b = document.getElementById('recipe-detail-body'); dlg = { text: b.textContent, inputs: b.querySelectorAll('#admin-sb-url-input,#admin-sb-key-input').length, speichern: !!b.querySelector('[onclick*="gsAdminSaveSbKey"]') }; closeModal('modal-recipe-detail'); } catch (e) { dlg = { fehler: String(e.message) }; }
        window.gsIsAdmin = adm;
        return { urls, def: SB_URL_DEFAULT, defKey: SB_KEY_DEFAULT, dlg, keep: GS_KEEP_ON_LOGOUT.indexOf('gs_sb_url') };
      });
      // beim naechsten Start werden die abweichenden Eintraege entfernt
      await h.frisch();
      Object.assign(r, await h.seite().evaluate(() => ({ url: localStorage.getItem('gs_sb_url'), key: localStorage.getItem('gs_sb_key') })));
      if (!r.urls.length) return { ok: false, warum: 'keine Anfrage gesehen — der Fall misst nichts' };
      const fremd = r.urls.filter(x => x.u.indexOf(r.def) !== 0 || x.key !== r.defKey);
      if (fremd.length) return { ok: false, warum: 'Anfrage ging an ' + fremd[0].u + ' mit Key ' + fremd[0].key };
      if (r.url !== null || r.key !== null) return { ok: false, warum: 'abweichende Werte ueberleben den Neustart: ' + r.url + ' / ' + r.key };
      if (r.keep >= 0) return { ok: false, warum: 'gs_sb_url steht noch in GS_KEEP_ON_LOGOUT' };
      if (!r.dlg || r.dlg.fehler || r.dlg.inputs || r.dlg.speichern) return { ok: false, warum: 'der Admin-Dialog laesst noch eine Adresse speichern: ' + JSON.stringify(r.dlg) };
      if (r.dlg.text.indexOf(r.def) < 0) return { ok: false, warum: 'der Dialog zeigt die Adresse nicht an' };
      // statisch: niemand liest die Schluessel mehr, um ein Ziel daraus zu machen
      const src = quelltextOhneKommentare();
      const leser = (src.match(/getItem\(\s*'gs_sb_(url|key)'\s*\)/g) || []).length;
      if (leser) return { ok: false, warum: leser + ' Stelle(n) lesen gs_sb_url/gs_sb_key noch aus dem Speicher' };
      return { ok: true, info: 'Anfrage an ' + r.def + ' · Schluessel entfernt · Dialog nur Anzeige · 0 Leser im Quelltext' };
    },
  },
  {
    name: 'Start-Parameter · ?screen=<unbekannt> laesst einen Bildschirm stehen, ?screen=garten oeffnet den Garten',
    lauf: async (seite, h) => {
      const mess = async (wert) => seite.evaluate(async (wert) => {
        if (typeof switchTab === 'function') switchTab('home');
        await new Promise(r => setTimeout(r, 300));
        history.replaceState(null, '', location.pathname + '?screen=' + encodeURIComponent(wert));
        gsHandleShortcutUrl();
        await new Promise(r => setTimeout(r, 1300));
        const sicht = Array.from(document.querySelectorAll('.screen')).filter(s => s.offsetParent !== null || getComputedStyle(s).display !== 'none').map(s => s.id);
        return { sicht, such: location.search };
      }, wert);
      const boese = await mess('<img src=x>');
      const leer = await mess('gibtsnicht');
      const gut = await mess('garten');
      if (!boese.sicht.length || !leer.sicht.length) return { ok: false, warum: 'kein Bildschirm sichtbar nach unbekanntem screen: ' + JSON.stringify([boese, leer]) };
      if (/screen=/.test(boese.such + leer.such)) return { ok: false, warum: 'Adresse nicht aufgeraeumt: ' + boese.such + ' ' + leer.such };
      if (gut.sicht.indexOf('screen-garden') < 0) return { ok: false, warum: 'gutartig: Garten nicht sichtbar: ' + JSON.stringify(gut) };
      return { ok: true, info: 'unbekannt → ' + leer.sicht.join(',') + ' · garten → screen-garden · Adresse aufgeraeumt' };
    },
  },
  {
    name: 'Start-Parameter · ?billing=success sagt NICHT „Zahlung erfolgreich", bevor der Server das Abo bestaetigt',
    lauf: async (seite, h) => {
      // 1) echte Navigation mit dem Parameter (der Handler laeuft beim Parsen)
      const ziel = 'file://' + path.join(WURZEL, 'index.html') + '?billing=success';
      await seite.goto(ziel, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await h.warte(2500);
      const nav = await seite.evaluate(() => ({ text: document.body.innerText, such: location.search }));
      await h.frisch();
      if (/Zahlung erfolgreich/.test(nav.text)) return { ok: false, warum: 'ohne jede Bestaetigung steht „Zahlung erfolgreich" da' };
      if (/billing=/.test(nav.search || nav.such)) return { ok: false, warum: 'Adresse nicht aufgeraeumt' };
      if (!/prüfen deine Zahlung/.test(nav.text)) return { ok: false, warum: 'kein neutraler Satz nach der Rueckkehr' };
      // 1b) dieselbe Klasse: ?ev_payment=success (Experten-Pruefung) — Toast faengt der Fall selbst ab
      const s2 = h.seite();
      await s2.goto('file://' + path.join(WURZEL, 'index.html') + '?ev_payment=success', { waitUntil: 'domcontentloaded', timeout: 120000 });
      await s2.evaluate(() => {
        window.__evT = [];
        const alt = window.showProfileToast;
        window.showProfileToast = function (m) { window.__evT.push(typeof m === 'object' ? JSON.stringify(m) : String(m)); return alt && alt.apply(this, arguments); };
      });
      await h.warte(3500);
      const ev = await s2.evaluate(() => ({ t: window.__evT || [], text: document.body.innerText }));
      await h.frisch();
      if (!ev.t.length) return { ok: false, warum: 'ev_payment: keine Meldung gesehen — der Fall misst nichts' };
      if (ev.t.some(x => /Zahlung erfolgreich/.test(x)) || /Zahlung erfolgreich/.test(ev.text)) return { ok: false, warum: 'ev_payment=success: „Zahlung erfolgreich" aus der Adresse: ' + JSON.stringify(ev.t) };
      // 2) die Rechnung dahinter: bestaetigt / nicht bestaetigt
      const r = await h.seite().evaluate(async () => {
        const t = []; const alt = window.showProfileToast, altE = window.gsLoadEntitlements;
        window.showProfileToast = (m) => t.push(String(typeof m === 'object' ? m.title : m));
        window.gsLoadEntitlements = async () => ({ tier: 'pro' });
        await _gsBillingPruefen({ ms: 30, versuche: 3 });
        const ja = t.slice(); t.length = 0;
        window.gsLoadEntitlements = async () => ({ tier: 'free' });
        await _gsBillingPruefen({ ms: 30, versuche: 3 });
        const nein = t.slice();
        window.showProfileToast = alt; window.gsLoadEntitlements = altE;
        return { ja, nein };
      });
      if (!r.ja.some(x => /Abo aktiv/.test(x))) return { ok: false, warum: 'bestaetigt, aber keine Erfolgsmeldung: ' + JSON.stringify(r.ja) };
      if (r.nein.some(x => /aktiv|erfolgreich/.test(x) && !/noch nicht/.test(x))) return { ok: false, warum: 'nicht bestaetigt und trotzdem Erfolg: ' + JSON.stringify(r.nein) };
      if (!r.nein.some(x => /noch nicht bestätigt/.test(x))) return { ok: false, warum: 'kein ehrlicher Satz: ' + JSON.stringify(r.nein) };
      return { ok: true, info: 'Navigation: neutraler Satz, kein Erfolg · Server pro → „Abo aktiv" · Server free → „noch nicht bestätigt"' };
    },
  },
  {
    name: 'Gespeicherte Plaene · gs_plans_v2 und der Spiegel im Arbeitsspeicher gehen beim Abmelden mit',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async () => {
        localStorage.setItem('gs_plans_v2', JSON.stringify([{ id: 'l1', localId: 'l1', type: 'garden', title: 'Plan von Konto A · Musterweg 3', payload: {}, created: new Date().toISOString() }]));
        const sbAlt = window.sbIsLoggedIn; window.sbIsLoggedIn = () => false;
        const vorher = (await gsPlans.list()).map(e => e.title);
        gsClearUserDataKeys();
        const ls = localStorage.getItem('gs_plans_v2');
        const geladen = gsPlans.load('l1');
        const nachher = (await gsPlans.list()).map(e => e.title);
        window.sbIsLoggedIn = sbAlt;
        return { vorher, ls, geladen: !!geladen, nachher, liste: GS_USER_KEYS.indexOf('gs_plans_v2') };
      });
      if (r.vorher.indexOf('Plan von Konto A · Musterweg 3') < 0) return { ok: false, warum: 'gutartig: der eigene Plan erscheint nicht: ' + JSON.stringify(r.vorher) };
      if (r.ls !== null) return { ok: false, warum: 'gs_plans_v2 ueberlebt das Abmelden' };
      if (r.geladen || r.nachher.length) return { ok: false, warum: 'der Plan ist nach dem Abmelden noch zu oeffnen: ' + JSON.stringify(r) };
      if (r.liste < 0) return { ok: false, warum: 'gs_plans_v2 steht nicht in GS_USER_KEYS' };
      return { ok: true, info: 'vorher sichtbar · nachher weg (Speicher und Spiegel) · in GS_USER_KEYS' };
    },
  },
  {
    name: 'Tiefer Pfad · /a/b?x=1#y startet MIT Artenliste und steht danach auf /?x=1#y (http, SPA-Rueckfall)',
    lauf: async (seite, h) => {
      const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.css': 'text/css' };
      const s = http.createServer((req, res) => {
        let p = decodeURIComponent(req.url.split('?')[0]);
        if (p === '/') p = '/index.html';
        const datei = path.join(WURZEL, path.normalize(p).replace(/^([/\\])+/, ''));
        const da = datei.startsWith(WURZEL) && fs.existsSync(datei) && !fs.statSync(datei).isDirectory();
        const ziel = da ? datei : path.join(WURZEL, 'index.html');   // /* /index.html 200
        res.writeHead(200, { 'Content-Type': TYPEN[path.extname(ziel)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
        fs.createReadStream(ziel).pipe(res);
      });
      await new Promise(r => s.listen(0, '127.0.0.1', r));
      const basis = 'http://127.0.0.1:' + s.address().port;
      const br = seite.context().browser();
      const ctx = await br.newContext({ serviceWorkers: 'block' });
      const p = await ctx.newPage();
      const mess = async (adr) => {
        await p.goto(basis + adr, { waitUntil: 'load', timeout: 120000 });
        await p.waitForTimeout(2500);
        return p.evaluate(() => ({ arten: (window.DB || []).length, pfad: location.pathname, such: location.search, hash: location.hash }));
      };
      let tief, wurzel;
      try { tief = await mess('/a/b?x=1#y'); wurzel = await mess('/?x=2'); }
      finally { await ctx.close(); s.close(); }
      if (!(wurzel.arten > 0)) return { ok: false, warum: 'gutartig: unter / keine Arten (' + wurzel.arten + ') — der Fall misst nichts' };
      if (!(tief.arten > 0)) return { ok: false, warum: 'unter /a/b keine Artenliste (' + tief.arten + ')' };
      if (tief.pfad !== '/' || tief.such !== '?x=1' || tief.hash !== '#y') return { ok: false, warum: 'Adresse nicht normalisiert: ' + JSON.stringify(tief) };
      if (wurzel.pfad !== '/' || wurzel.such !== '?x=2') return { ok: false, warum: 'gutartig: / wurde veraendert: ' + JSON.stringify(wurzel) };
      return { ok: true, info: '/a/b → ' + tief.arten + ' Arten, Adresse /?x=1#y · / unveraendert (' + wurzel.arten + ')' };
    },
  },
];
