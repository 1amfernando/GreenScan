#!/usr/bin/env node
// robust_check.js — vier kleine Versprechen, die niemand geprueft hatte.
//
//   node scripts/robust_check.js
//
// Anlass: docs/PROFESSIONALITAET-AUDIT-2026-09-06.md §B1, B3, B5, B6 —
// vier Stellen, die klein aussehen und jede fuer sich ein Nutzer-Erlebnis
// sind: ein Panel, das immer „Konnte nicht laden" sagt (B1); eine Meldung,
// die immer 3,5 s bleibt, egal was der Aufrufer wollte (B5); ein Escape,
// das den ganzen Fensterstapel wegwischt (B6); ein Service Worker, der sich
// selbst aktiviert und danach um Erlaubnis fragt (B3). Jeder Fall stellt den
// Zustand HER und misst — mit gestelltem Netz (B1), mit echter Uhr (B5), mit
// zwei wirklich geoeffneten Fenstern (B6) und am Quelltext des Workers (B3).
//
// Grenze: B3 ist eine Quelltext-Frage (kein zweiter Worker in dieser Umgebung);
// dass der erste Install weiter funktioniert, misst offline_check.
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const SEED = require('./_seed.js');

let __seite = null;
const FAELLE = [
  {
    name: 'B1 · sbFetch ohne zweites Argument stuerzt nicht mehr ab — Verkaeufer-Status und Wetterwarnungen kommen an',
    lauf: async () => {
      const r = await __seite.evaluate(async () => {
        const echtFetch = window._gsFetch, echtCfg = window.sbGetConfig, echtLogin = window.sbIsLoggedIn;
        const iso = new Date().toISOString(); const rufe = [];
        window.sbGetConfig = () => true; window.sbIsLoggedIn = () => true;
        window._gsFetch = async (url) => { rufe.push(String(url)); return { ok: true, status: 200, json: async () =>
          /v_my_marketplace_seller/.test(url) ? [{ stripe_account_id: 'acct_1', charges_enabled: true, payouts_enabled: true }]
          : /weather_alerts/.test(url) ? [{ id: 'w1', title: 'Sturmwarnung Test', body: 'Boeen bis 90 km/h', severity: 'warn', created_at: iso, dismissed: false, alert_type: 'storm' }]
          : [] }; };
        try {
          const roh = await sbFetch('/rest/v1/x');
          const status = await gsMarketplaceLoadStatus();
          await gsOpenWeatherAlerts(); await new Promise(res => setTimeout(res, 400));
          const panel = document.getElementById('gs-wx-panel');
          const txt = panel ? panel.textContent : '';
          try { gsCloseWeatherAlerts(); } catch (_) {}
          return { roh: roh && !roh.error && Array.isArray(roh.data), status: status && status.stripe_account_id, sturm: /Sturmwarnung Test/.test(txt), fehl: /nicht laden/.test(txt), rufe: rufe.length };
        } finally { window._gsFetch = echtFetch; window.sbGetConfig = echtCfg; window.sbIsLoggedIn = echtLogin; }
      });
      if (!r.roh) return { ok: false, warum: 'sbFetch(path) ohne opts liefert keine Daten (wirft vermutlich vor dem try)' };
      if (r.status !== 'acct_1') return { ok: false, warum: 'Verkaeufer-Status: ' + JSON.stringify(r.status) };
      if (!r.sturm || r.fehl) return { ok: false, warum: 'Wetterwarnungen: sturm=' + r.sturm + ' fehl=' + r.fehl };
      return { ok: true, info: 'sbFetch(path) → data · Verkaeufer acct_1 · Panel zeigt „Sturmwarnung Test" · ' + r.rufe + ' Netzaufrufe' };
    },
  },
  {
    name: 'B5 · gsToast(msg, type, dauer): 600 ms sind nach 1,4 s weg, die Vorgabe (3,5 s) steht noch, die Objekt-Form behaelt ihre Dauer',
    lauf: async () => {
      const r = await __seite.evaluate(async () => {
        const w = (ms) => new Promise(res => setTimeout(res, ms));
        const zeig = () => !!(window._gsToastEl && _gsToastEl.classList.contains('show'));
        try { if (window._gsToastTimer) clearTimeout(_gsToastTimer); if (window._gsToastEl) _gsToastEl.classList.remove('show'); window._gsToastActive = false; window._gsToastQueue.length = 0; } catch (_) {}
        gsToast('Kurz sichtbar', 'info', 600); await w(200); const k1 = zeig(); await w(1200); const k2 = zeig();
        await w(600);
        gsToast('Vorgabe sichtbar', 'info'); await w(200); const v1 = zeig(); await w(1200); const v2 = zeig();
        try { clearTimeout(_gsToastTimer); _gsToastEl.classList.remove('show'); window._gsToastActive = false; } catch (_) {}
        await w(400);
        gsToast({ title: 'Objekt', body: 'kurz', duration: 500 }); await w(200); const o1 = zeig(); await w(1000); const o2 = zeig();
        try { clearTimeout(_gsToastTimer); _gsToastEl.classList.remove('show'); window._gsToastActive = false; } catch (_) {}
        return { k1, k2, v1, v2, o1, o2 };
      });
      if (!r.k1 || r.k2) return { ok: false, warum: '600 ms: nach 0,2 s ' + r.k1 + ', nach 1,4 s ' + r.k2 + ' (erwartet true, false — die Dauer wird verworfen)' };
      if (!r.v1 || !r.v2) return { ok: false, warum: 'Vorgabe: nach 0,2 s ' + r.v1 + ', nach 1,4 s ' + r.v2 + ' (erwartet true, true)' };
      if (!r.o1 || r.o2) return { ok: false, warum: 'Objekt-Form 500 ms: ' + r.o1 + '/' + r.o2 };
      return { ok: true, info: '600 ms → nach 1,4 s weg · Vorgabe → nach 1,4 s noch da · Objekt 500 ms → weg' };
    },
  },
  {
    name: 'B6 · Escape schliesst NUR das oberste Fenster: zwei offen → eins offen → keins, Body-Scroll wieder frei',
    lauf: async () => {
      const r = await __seite.evaluate(async () => {
        const w = (ms) => new Promise(res => setTimeout(res, ms));
        const A = 'modal-post-picker', B = 'modal-post-comments';
        const esc = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        const offen = (id) => document.getElementById(id).classList.contains('open');
        openModal(A); await w(50); openModal(B); await w(50);
        const s0 = [offen(A), offen(B)];
        esc(); await w(300); const s1 = [offen(A), offen(B)];
        esc(); await w(300); const s2 = [offen(A), offen(B)];
        const scroll = document.body.style.overflow;
        try { closeModal(A); closeModal(B); } catch (_) {}
        return { s0, s1, s2, scroll };
      });
      if (r.s0.join() !== 'true,true') return { ok: false, warum: 'Aufbau: beide offen erwartet, ' + r.s0.join() };
      if (r.s1.join() !== 'true,false') return { ok: false, warum: 'nach 1× Escape: ' + r.s1.join() + ' (erwartet true,false — nur das oberste zu)' };
      if (r.s2.join() !== 'false,false') return { ok: false, warum: 'nach 2× Escape: ' + r.s2.join() };
      if (r.scroll !== '') return { ok: false, warum: 'Body-Scroll nicht frei: ' + JSON.stringify(r.scroll) };
      return { ok: true, info: 'true,true → true,false → false,false · overflow frei' };
    },
  },
  {
    name: 'A8 · CSP (_headers): kein unsafe-eval — und kein eval/new Function im App-Code; worker-src kennt cdnjs (pdf.js-Worker); frame-ancestors none; ipapi.co nirgends mehr',
    lauf: async () => {
      const h = fs.readFileSync(path.join(__dirname, '..', '_headers'), 'utf8');
      const csp = (h.match(/Content-Security-Policy: (.*)/) || ['', ''])[1];
      const idx = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
      // ohne Kommentare und ohne die Release-Notizen (dort steht „ipapi.co" als Zitat dessen, was raus ist)
      const zeilen = idx.replace(/\/\*[\s\S]*?\*\//g, '').split('\n');
      const relStart = zeilen.findIndex(z => /^window\.GS_RELEASES = \[/.test(z)), relEnde = relStart >= 0 ? zeilen.findIndex((z, i) => i > relStart && /^\];/.test(z)) : -1;
      const code = zeilen.filter((z, i) => !/^\s*\/\//.test(z) && !(relStart >= 0 && i >= relStart && i <= relEnde)).join('\n');
      const evalTreffer = (code.match(/[^A-Za-z_.$]eval\s*\(|new Function\s*\(/g) || []).length;
      const falsch = [];
      if (/unsafe-eval/.test(csp)) falsch.push("'unsafe-eval' steht noch in der CSP");
      if (evalTreffer) falsch.push(evalTreffer + '× eval/new Function im App-Code — dann braucht die CSP unsafe-eval wieder');
      const worker = (csp.match(/worker-src ([^;]*)/) || ['', ''])[1];
      if (!/cdnjs\.cloudflare\.com/.test(worker)) falsch.push('worker-src ohne cdnjs: ' + worker);
      if (!/frame-ancestors 'none'/.test(csp)) falsch.push('frame-ancestors nicht none');
      if (/ipapi\.co/.test(csp) || /ipapi\.co/.test(code)) falsch.push('ipapi.co noch da');
      if (!/X-Frame-Options: DENY/.test(h)) falsch.push('X-Frame-Options nicht DENY');
      if (falsch.length) return { ok: false, warum: falsch.join(' · ') };
      return { ok: true, info: 'kein unsafe-eval · 0 eval/new Function · worker-src + cdnjs · frame-ancestors none · DENY · ipapi.co 0×' };
    },
  },
  {
    name: 'A9 · Fehlerbericht mit Konto-Bezug geht nur mit Zustimmung; Nutzungsmessung ist Opt-in (gs_consent ODER gs_prefs.privacy.analytics === true)',
    lauf: async () => __seite.evaluate(async () => {
      const echtFetch = window.sbFetch, echtLogin = window.sbIsLoggedIn, echtGet = gsStore.get;
      const rufe = [];
      window.sbFetch = async (path, opts) => { rufe.push(path); return { data: [], error: null }; };
      window.sbIsLoggedIn = () => true;
      gsStore.get = (k, d) => (k === 'gs_sb_uid' ? '00000000-0000-0000-0000-000000000001' : echtGet.call(gsStore, k, d));
      const w = (ms) => new Promise(r => setTimeout(r, ms));
      const fehler = (t) => { try { window.dispatchEvent(new ErrorEvent('error', { message: 'Pruefstand-Fehler ' + t, filename: 'x.js', lineno: 1, error: new Error('Pruefstand ' + t) })); } catch (_) {} };
      try {
        localStorage.removeItem('gs_consent'); localStorage.setItem('gs_prefs', JSON.stringify({ privacy: {} }));
        fehler('ohne'); gsTrackEvent('pruefstand_ohne'); await w(300);
        const ohne = { fehler: rufe.filter(p => /client_errors/.test(p)).length, mess: rufe.filter(p => /analytics_events/.test(p)).length, erlaubt: _gsAnalyticsErlaubt() };
        rufe.length = 0; localStorage.setItem('gs_consent', JSON.stringify({ analytics: true }));
        fehler('mit'); gsTrackEvent('pruefstand_mit'); await w(300);
        const mit = { fehler: rufe.filter(p => /client_errors/.test(p)).length, mess: rufe.filter(p => /analytics_events/.test(p)).length, erlaubt: _gsAnalyticsErlaubt() };
        rufe.length = 0; localStorage.removeItem('gs_consent'); localStorage.setItem('gs_prefs', JSON.stringify({ privacy: { analytics: true } }));
        const prefsWeg = _gsAnalyticsErlaubt();
        localStorage.setItem('gs_prefs', JSON.stringify({ privacy: { analytics: false } }));
        const nein = _gsAnalyticsErlaubt();
        if (ohne.erlaubt || ohne.fehler || ohne.mess) return { ok: false, warum: 'ohne Zustimmung: ' + JSON.stringify(ohne) };
        if (!mit.erlaubt || mit.fehler !== 1 || mit.mess !== 1) return { ok: false, warum: 'mit Zustimmung: ' + JSON.stringify(mit) };
        if (!prefsWeg || nein) return { ok: false, warum: 'prefs.privacy.analytics: true→' + prefsWeg + ' false→' + nein };
        return { ok: true, info: 'ohne: 0 Fehlerbericht, 0 Messung · mit gs_consent: 1 + 1 · prefs.privacy.analytics true → erlaubt, false → nicht' };
      } finally { localStorage.removeItem('gs_consent'); localStorage.removeItem('gs_prefs'); window.sbFetch = echtFetch; window.sbIsLoggedIn = echtLogin; gsStore.get = echtGet; }
    }),
  },
  {
    name: 'B7 · der Toast ist eine Live-Region (role=status, aria-live=polite) — Screenreader lesen ihn vor',
    lauf: async () => __seite.evaluate(async () => {
      gsToast('Live-Region-Probe', 'info', 500);
      await new Promise(r => setTimeout(r, 200));
      const el = window._gsToastEl;
      const r = { role: el && el.getAttribute('role'), live: el && el.getAttribute('aria-live'), text: el && /Live-Region-Probe/.test(el.textContent) };
      try { clearTimeout(_gsToastTimer); el.classList.remove('show'); window._gsToastActive = false; } catch (_) {}
      if (r.role !== 'status' || r.live !== 'polite' || !r.text) return { ok: false, warum: JSON.stringify(r) };
      return { ok: true, info: 'role=status · aria-live=polite · Text steht drin' };
    }),
  },
  {
    name: 'C1/B9 · _gsNorm und gsIsAdmin genau einmal definiert; gsRequireOnline (0 Aufrufer) und die 4342er-Startschleife sind weg',
    lauf: async () => {
      // ohne Kommentarzeilen — die Erklaerung, warum etwas weg ist, nennt es beim Namen
      const idx = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').split('\n').filter(z => !/^\s*\/\//.test(z)).join('\n');
      const norm = (idx.match(/^function _gsNorm\s*\(/gm) || []).length;
      const admin = (idx.match(/^function gsIsAdmin\s*\(/gm) || []).length;
      const req = (idx.match(/gsRequireOnline/g) || []).length;
      const dupes = (idx.match(/hasDupes/g) || []).length;
      const falsch = [];
      if (norm !== 1) falsch.push('_gsNorm ' + norm + '×');
      if (admin !== 1) falsch.push('gsIsAdmin ' + admin + '×');
      if (req) falsch.push('gsRequireOnline ' + req + '×');
      if (dupes) falsch.push('hasDupes ' + dupes + '×');
      if (falsch.length) return { ok: false, warum: falsch.join(' · ') };
      return { ok: true, info: '_gsNorm 1× · gsIsAdmin 1× · gsRequireOnline 0× · hasDupes 0×' };
    },
  },
  {
    name: 'C3 · sw.js ohne Changelog-Ballast: unter 60 KB, keine vXX.YY-Eintraege im Kopf, das Archiv existiert und traegt sie',
    lauf: async () => {
      const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
      const kb = Math.round(sw.length / 1024);
      const kopf = sw.slice(0, sw.indexOf('*/'));
      const eintraege = (kopf.match(/^\s+v\d+\.\d+ — /gm) || []).length;
      let archiv = 0; try { archiv = (fs.readFileSync(path.join(__dirname, '..', 'docs', '_archiv', 'SW-CHANGELOG.md'), 'utf8').match(/^- v\d+\.\d+ — /gm) || []).length; } catch (_) {}
      if (kb > 60) return { ok: false, warum: 'sw.js ist ' + kb + ' KB' };
      if (eintraege) return { ok: false, warum: eintraege + ' Changelog-Zeilen im Kopf' };
      if (archiv < 300) return { ok: false, warum: 'Archiv hat ' + archiv + ' Eintraege (erwartet > 300)' };
      return { ok: true, info: 'sw.js ' + kb + ' KB · 0 Eintraege im Kopf · Archiv ' + archiv + ' Eintraege' };
    },
  },
  {
    name: 'A10 (Server) · Geheimnisse konstantzeitig ueber EIN Modul: Rechnung geprueft, fuenf Cron-Empfaenger benutzen es und kein includes() mehr; feedback-triage nur is_admin + UUID; ai-proxy nur eigene Previews',
    lauf: async () => {
      const M = await import(path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'auth_vergleich.mjs'));
      const f = [];
      if (M.constantTimeEquals('abc', 'abc') !== true) f.push('gleich → false');
      if (M.constantTimeEquals('abc', 'abd') !== false) f.push('ungleich → true');
      if (M.constantTimeEquals('abc', 'ab') !== false) f.push('Laenge → true');
      if (M.constantTimeEquals('', '') !== false) f.push('leer/leer → true (ein fehlender Key bestaetigt einen fehlenden Header)');
      if (M.constantTimeEquals(null, undefined) !== false) f.push('null/undefined → true');
      if (M.hatServiceRole('Bearer sk-1', 'sk-1') !== true) f.push('Bearer sk-1 → false');
      if (M.hatServiceRole('Bearer sk-1x', 'sk-1') !== false) f.push('Praefix-Treffer → true');
      if (M.hatServiceRole('Bearer other sk-1', 'sk-1') !== false) f.push('Teilstring → true (das war der includes-Fehler)');
      if (M.hatServiceRole('Bearer sk-1', '') !== false) f.push('ohne Key → true');
      const req = (h) => ({ headers: { get: (k) => h[k.toLowerCase()] || null } });
      if (M.cronOderService(req({ 'x-cron-secret': 'geheim' }), 'geheim', 'sk') !== true) f.push('Cron richtig → false');
      if (M.cronOderService(req({ 'x-cron-secret': 'falsch' }), 'geheim', 'sk') !== false) f.push('Cron falsch → true');
      if (M.cronOderService(req({ 'x-cron-secret': '' }), '', 'sk') !== false) f.push('Cron leer/leer → true');
      if (M.cronOderService(req({ 'authorization': 'Bearer sk' }), 'geheim', 'sk') !== true) f.push('Service-Role → false');
      const fn = ['daily-push-checker', 'engagement-push-checker', 'key-health-check', 'sensor-push', 'weather-alert-checker'];
      fn.forEach(n => { const t = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', n, 'index.ts'), 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/\/\/ v32\.72.*$/gm, '');
        if (!/auth_vergleich\.mjs/.test(t)) f.push(n + ' importiert das Modul nicht');
        if (/\.includes\((SERVICE_ROLE|serviceKey)\)/.test(t)) f.push(n + ' vergleicht noch mit includes()'); });
      const tri = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'feedback-triage', 'index.ts'), 'utf8');
      if (/is_expert/.test(tri.replace(/\/\/.*$/gm, ''))) f.push('feedback-triage laesst is_expert durch');
      if (!/\^\[0-9a-f-\]\{36\}\$/.test(tri)) f.push('feedback-triage prueft body.id nicht als UUID');
      const px = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'ai-proxy', 'index.ts'), 'utf8');
      if (/\/\\\.pages\\\.dev\$\//.test(px)) f.push('ai-proxy erlaubt jede *.pages.dev');
      if (!/greenscan-app\\\.pages\\\.dev/.test(px)) f.push('ai-proxy kennt die eigene Preview-Domain nicht');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: '13 Rechnungen richtig · 5 Empfaenger importieren, 0× includes · triage is_admin + UUID · ai-proxy nur greenscan-app.pages.dev' };
    },
  },
  {
    name: 'B2 · Timeouts abgestimmt: Server bricht bei 110 s ab (AbortSignal.timeout) und speichert nichts, Client wartet 120 s; ein Timeout heisst „rechnet vielleicht noch", ein error-String wird zu {message}',
    lauf: async () => {
      const f = [];
      ['garden-scan-analyze', 'plan-iterate'].forEach(n => { const t = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', n, 'index.ts'), 'utf8');
        if (!/signal: AbortSignal\.timeout\(110_000\)/.test(t)) f.push(n + ' ohne AbortSignal 110 s');
        if (!/status: zuLang \? 504 : 502/.test(t)) f.push(n + ' ohne 504 bei Timeout'); });
      const idx = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
      if (!/functions\/v1\/garden-scan-analyze'[\s\S]{0,400}\}, 120000\)/.test(idx)) f.push('Client Garten-Scan wartet nicht 120 s');
      if (!/functions\/v1\/plan-iterate'[\s\S]{0,400}\}, 120000\)/.test(idx)) f.push('Client Plan-Chat wartet nicht 120 s');
      const r = await __seite.evaluate(() => {
        const a = _gsEdgeFehler({ error: 'Not authenticated' }, 401);
        const b = _gsEdgeFehler({ error: { code: 'timeout', message: 'zu lang' } }, 504);
        const c = _gsEdgeFehler({}, 500);
        const d = _gsEdgeAusnahme(Object.assign(new Error('Zeitüberschreitung — bitte Internetverbindung prüfen.'), { status: 408 }));
        const e = _gsEdgeAusnahme(Object.assign(new Error('x'), { name: 'AbortError' }));
        const g = _gsEdgeAusnahme(new Error('Failed to fetch'));
        return { a, b, c, d, e, g };
      });
      if (r.a.message !== 'Not authenticated' || r.a.code !== 'server') f.push('error-String: ' + JSON.stringify(r.a));
      if (!/^⏱️ zu lang/.test(r.b.message)) f.push('504: ' + JSON.stringify(r.b));
      if (!/Server-Fehler 500/.test(r.c.message)) f.push('leer: ' + JSON.stringify(r.c));
      if (r.d.code !== 'timeout' || !/rechnet vielleicht noch/.test(r.d.message)) f.push('408: ' + JSON.stringify(r.d));
      if (r.e.code !== 'timeout') f.push('AbortError: ' + JSON.stringify(r.e));
      if (r.g.code !== 'network' || r.g.message !== 'Failed to fetch') f.push('Netz: ' + JSON.stringify(r.g));
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'Server 110 s + 504 · Client 120 s ×2 · String → {message} · 504 → ⏱️ · 408/AbortError → „rechnet vielleicht noch" · Netz bleibt Netz' };
    },
  },
  {
    name: 'B3 · Service Worker: kein skipWaiting beim Install; SKIP_WAITING nur auf Befehl der App; der Banner schickt ihn',
    lauf: async () => {
      const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
      const idx = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
      const iStart = sw.indexOf("addEventListener('install'"), iEnd = sw.indexOf("addEventListener('activate'");
      if (iStart < 0 || iEnd < 0) return { ok: false, warum: 'install/activate-Handler nicht gefunden' };
      const install = sw.slice(iStart, iEnd).replace(/\/\/.*$/gm, '');
      if (/skipWaiting/.test(install)) return { ok: false, warum: 'install ruft skipWaiting — der Worker aktiviert sich selbst' };
      const mStart = sw.indexOf("addEventListener('message'");
      const msg = sw.slice(mStart, mStart + 600);
      if (!/SKIP_WAITING/.test(msg) || !/self\.skipWaiting\(\)/.test(msg)) return { ok: false, warum: 'message-Handler ohne SKIP_WAITING → skipWaiting' };
      if (!/postMessage\(\{ type: 'SKIP_WAITING' \}\)/.test(idx)) return { ok: false, warum: 'index.html schickt kein SKIP_WAITING' };
      const claim = /clients\.claim\(\)/.test(sw.slice(iEnd, iEnd + 800));
      return { ok: true, info: 'install ohne skipWaiting · message SKIP_WAITING → skipWaiting · Banner schickt SKIP_WAITING · activate ' + (claim ? 'mit' : 'ohne') + ' claim' };
    },
  },
];

(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 412, height: 915 } });
  const p = await ctx.newPage(); __seite = p;
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await p.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await p.addInitScript(SEED);
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForTimeout(4000);
  await p.evaluate(() => { document.documentElement.classList.remove('gs-preauth'); window.gsRequire = () => true; window.gsHaptic = () => {}; });
  console.log('\n=== robust_check — vier kleine Versprechen, die niemand geprueft hatte');
  let kaputt = 0;
  for (const f of FAELLE) {
    let r;
    try { r = await f.lauf(); } catch (e) { r = { ok: false, warum: 'Ausnahme: ' + e.message.split('\n')[0] }; }
    if (r && r.ok) console.log('  ok   ' + f.name + (r.info ? '   [' + r.info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
  }
  await br.close();
  console.log('  ---');
  console.log('  Faelle geprueft: ' + FAELLE.length + ' · davon kaputt: ' + kaputt);
  console.log('  JS-Fehler waehrend der Pruefung: ' + (errs.length ? errs.length + ' (' + errs.slice(0, 2).join(' | ') + ')' : 'keine'));
  console.log('  Grenze: B3 ist eine Quelltext-Frage — den ersten Install misst offline_check.');
  process.exitCode = kaputt ? 1 : 0;
})();
