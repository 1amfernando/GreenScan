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
    name: 'B8 · rohe Serverfehler werden zu Saetzen: _gsFehlerText kennt RLS, Sitzung, Netz, Dublette, Datenstruktur, 429, 5xx; sbFetch gibt den Status mit; ein echter Toast und das Quiz-Urteil zeigen den Satz, nicht die Zeile aus PostgREST',
    lauf: async () => {
      const f = [];
      // 1 · Statisch: keine Anzeige-Zeile mehr mit rohem .error.message (Schluesselwort-Pruefungen und Logs sind keine Anzeige)
      const idx = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
      const roh = [];
      idx.split('\n').forEach((z, i) => {
        if (!/\.error\.message/.test(z) || /^\s*\/\//.test(z)) return;
        if (!/gsToast|showProfileToast|showErr\(|toast\(|innerHTML|textContent|_onbShowErr|\bbody\s*:/.test(z)) return;
        if (/_gsFehlerText\(|gsTranslateAuthError\(|\.includes\(|indexOf\(|\.test\(|toLowerCase\(\)|console\./.test(z)) return;
        roh.push((i + 1) + ': ' + z.trim().slice(0, 80));
      });
      if (roh.length) f.push('roh angezeigt (' + roh.length + '): ' + roh.slice(0, 3).join(' | '));
      // 2 · Die Uebersetzung selbst, je Klasse ein Rohwert — und was NICHT uebersetzt werden darf
      const r = await __seite.evaluate(async () => {
        const t = window._gsFehlerText; if (typeof t !== 'function') return { fehlt: true };
        const o = {
          rls: t({ message: 'new row violates row-level security policy for table "user_scans"', status: 403 }),
          rls2: t({ message: 'permission denied for table profiles' }),
          jwt: t({ message: 'JWT expired', status: 401 }),
          netz: t(new TypeError('Failed to fetch')),
          zeit: t({ message: 'Zeitüberschreitung — bitte Internetverbindung prüfen.', status: 408 }),
          dup: t({ message: 'duplicate key value violates unique constraint "friendships_pkey"' }),
          tab: t({ message: 'relation "public.foo" does not exist', status: 404 }),
          cache: t({ message: 'Could not find the function public.fn_x in the schema cache' }),
          rate: t({ message: 'x', status: 429 }),
          s503: t({ message: 'Fehler 503', status: 503 }),
          kurz: t({ message: 'Du kannst dich nicht selbst melden.' }),
          lang: t({ message: 'A'.repeat(200) }),
          leer: t(null),
          str: t('Supabase nicht konfiguriert'),
        };
        // 3 · sbFetch traegt den Status in den Fehler
        const echtFetch = window._gsFetch, echtCfg = window.sbGetConfig, echtLogin = window.sbIsLoggedIn;
        window.sbGetConfig = () => true; window.sbIsLoggedIn = () => true;
        window._gsFetch = async () => ({ ok: false, status: 403, json: async () => ({ code: '42501', message: 'new row violates row-level security policy for table "user_scans"' }) });
        let sb;
        try { sb = await sbFetch('/rest/v1/user_scans', { method: 'POST', body: '{}' }); }
        finally { window._gsFetch = echtFetch; window.sbGetConfig = echtCfg; window.sbIsLoggedIn = echtLogin; }
        o.sbStatus = sb && sb.error && sb.error.status; o.sbText = sb && sb.error ? t(sb.error) : null;
        // 4 · Ein echter Weg bis in den Toast: Freundschaftsanfrage, Server lehnt per RLS ab
        const echtSb = window.sbFetch, echtUid = localStorage.getItem('gs_sb_uid');
        window.sbIsLoggedIn = () => true; localStorage.setItem('gs_sb_uid', 'u-pruef');
        window.sbFetch = async () => ({ data: null, error: { message: 'new row violates row-level security policy for table "friendships"', status: 403 } });
        try { await gsFriendsSendRequest('u-anders'); await new Promise(res => setTimeout(res, 250)); }
        finally { window.sbFetch = echtSb; window.sbIsLoggedIn = echtLogin; if (echtUid === null) localStorage.removeItem('gs_sb_uid'); else localStorage.setItem('gs_sb_uid', echtUid); }
        const tEl = document.querySelector('.gs-toast .gs-toast-body');
        o.toast = tEl ? tEl.textContent : '';
        // 5 · Quiz-Urteil bei abgelaufener Sitzung
        // _dqServerUrteil RENDERT (in #dq-result), es gibt nichts zurueck — gemessen wird das Element
        const dqRes = document.createElement('div'); dqRes.id = 'dq-result'; document.body.appendChild(dqRes);
        try { window._dqServerUrteil({ error: { message: 'JWT expired', status: 401 } }, true); const u = document.getElementById('dq-server-urteil'); o.quiz = u ? u.textContent : ''; }
        finally { dqRes.remove(); }
        return o;
      });
      if (r.fehlt) return { ok: false, warum: '_gsFehlerText fehlt' };
      const muss = [['rls', /abgelehnt/], ['rls2', /abgelehnt/], ['jwt', /Sitzung/], ['netz', /Verbindung/], ['zeit', /Verbindung/], ['dup', /gibt es schon/], ['tab', /Datenstruktur/], ['cache', /Datenstruktur/], ['rate', /Zu viele/], ['s503', /Problem/], ['leer', /^Unbekannter Fehler$/], ['str', /^Supabase nicht konfiguriert$/]];
      muss.forEach(([k, re]) => { if (!re.test(String(r[k]))) f.push(k + ' → ' + JSON.stringify(r[k])); });
      if (r.kurz !== 'Du kannst dich nicht selbst melden.') f.push('kurze Meldung veraendert: ' + JSON.stringify(r.kurz));
      if (!(r.lang.length <= 120 && /…$/.test(r.lang))) f.push('lange Meldung nicht gekuerzt: ' + r.lang.length);
      ['rls', 'jwt', 'tab', 'dup'].forEach(k => { if (/row-level|jwt|does not exist|duplicate key/i.test(String(r[k]))) f.push(k + ' traegt noch das Rohe'); });
      if (r.sbStatus !== 403) f.push('sbFetch ohne status: ' + JSON.stringify(r.sbStatus));
      if (!/abgelehnt/.test(String(r.sbText))) f.push('sbFetch-Fehler nicht uebersetzt: ' + JSON.stringify(r.sbText));
      if (!/abgelehnt/.test(r.toast) || /row-level/.test(r.toast)) f.push('Toast: ' + JSON.stringify(r.toast));
      if (!/Sitzung/.test(r.quiz) || /JWT/.test(r.quiz)) f.push('Quiz-Urteil: ' + JSON.stringify(r.quiz));
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: '12 Klassen · kurz bleibt · lang gekuerzt · sbFetch status 403 · Toast „' + r.toast.slice(0, 40) + '…" · Quiz „' + r.quiz.slice(0, 40) + '…" · statisch 0 rohe Anzeige-Zeilen' };
    },
  },
  {
    name: 'A5 · der alte Cloud-Sensor-Assistent zeigt kein Sitzungs-Token mehr: Wegweiser zu Messwerte, Alt-Geraete nur noch loeschbar, kein Code-Beispiel, kein Menueeintrag zum Smart-Home-Dashboard',
    lauf: async () => {
      const f = [];
      const idx = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
      ['gsDevShowSensorCode', 'gsDevAddCloudSensor', 'USER_TOK', 'curlExample', 'espExample', 'action:"gsShOpen()"'].forEach(t => { if (idx.includes(t)) f.push('Quelltext traegt noch ' + t); });
      // Release-Notizen zitieren, was raus ist (dieselbe Falle wie in nutzersicht_check) — der GS_RELEASES-Block bleibt aussen vor
      const relA = idx.indexOf('window.GS_RELEASES = ['), relB = relA < 0 ? -1 : idx.indexOf('\n];', relA);
      const ohneRel = relA < 0 ? idx : idx.slice(0, relA) + idx.slice(relB);
      if (/Service-Role/.test(ohneRel.replace(/^\s*\/\/.*$/gm, ''))) f.push('„Service-Role" steht noch ausserhalb von Kommentaren und Release-Notizen');
      const r = await __seite.evaluate(async () => {
        const echtSb = window.sbFetch, echtLogin = window.sbIsLoggedIn;
        const sichtbar = el => !!(el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden');
        window.sbIsLoggedIn = () => true;
        window.sbFetch = async (url) => /sensor_devices/.test(String(url)) ? { data: [{ id: 'alt-1', name: 'Tomatenbeet ESP32', kind: 'multi', last_seen_at: null }], error: null } : { data: [], error: null };
        try {
          openDevicesModal(); await new Promise(res => setTimeout(res, 500));
          const wiz = document.getElementById('gs-cloud-sensor-wizard');
          const txt = wiz ? wiz.textContent : '', html = wiz ? wiz.innerHTML : '';
          const knopf = document.getElementById('gs-dev-zu-messwerte');
          const o = { da: !!wiz, weg: /Messwerte/.test(txt), alt: /Tomatenbeet ESP32/.test(txt), code: /Code|curl|Bearer|anlegen/.test(txt), loeschen: /gsDevDeleteCloudSensor/.test(html), knopf: !!knopf, devicesOffen: sichtbar(document.getElementById('modal-devices')) };
          if (knopf) { knopf.click(); await new Promise(res => setTimeout(res, 600)); }
          o.messwerteOffen = sichtbar(document.getElementById('detail-modal')) && /Messwerte/.test((document.getElementById('modal-content') || {}).textContent || '');
          o.devicesZu = !sichtbar(document.getElementById('modal-devices'));
          try { closeModal('detail-modal'); } catch (_) {}
          try { closeModal('modal-devices'); } catch (_) {}
          if (wiz) wiz.remove();
          return o;
        } finally { window.sbFetch = echtSb; window.sbIsLoggedIn = echtLogin; }
      });
      if (!r.da || !r.devicesOffen) f.push('Wegweiser nicht gerendert: ' + JSON.stringify(r));
      if (!r.weg || !r.knopf) f.push('kein Weg zu Messwerte: ' + JSON.stringify(r));
      if (!r.alt || !r.loeschen) f.push('Alt-Geraet nicht gelistet/loeschbar: ' + JSON.stringify(r));
      if (r.code) f.push('Code-Beispiel oder „anlegen" noch da: ' + JSON.stringify(r));
      if (!r.messwerteOffen || !r.devicesZu) f.push('Knopf fuehrt nicht zu Messwerte: ' + JSON.stringify(r));
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'kein Token-Code im Quelltext · Wegweiser da · Alt-Geraet gelistet, nur loeschbar · Knopf oeffnet Messwerte und schliesst Geraete · Smart-Home nicht im Menue' };
    },
  },
  {
    name: 'A6 · Admin-Modus fragt den Server: kein Passwort-Hash, keine Admin-E-Mails im HTML; Server „nein" → kein Admin, Fehler → Satz, Server „ja" → an; ein Speicher-„ja" ohne Server-Spiegel zaehlt nicht, eine fremde Adresse bekommt keine Auskunft',
    lauf: async () => {
      const f = [];
      const idx = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
      ['GS_ADMIN_PW_SEED', 'GS_ADMINS', 'gsHashPw', 'admin-pw-input', 'fernando.rankwiler1997@gmail.com'].forEach(t => { if (idx.includes(t)) f.push('Quelltext traegt noch ' + t); });
      const ab = idx.indexOf('GREENSCAN EMBEDDED ADMIN');
      if (ab < 0 || /[0-9a-f]{64}/.test(idx.slice(ab, ab + 4000))) f.push('64-hex-Konstante im Admin-Block (oder Block fehlt)');
      const r = await __seite.evaluate(async () => {
        const echtSb = window.sbFetch, echtLogin = window.sbIsLoggedIn, echtST = window.setTimeout, echtMail = localStorage.getItem('gs_sb_email');
        const merk = {}, rufe = []; let reloads = 0;
        const setz = (antwort) => { window.sbFetch = async (url) => { rufe.push(String(url)); return antwort; }; };
        window.setTimeout = function (fn) { if (typeof fn === 'function' && /location\.reload/.test(String(fn))) { reloads++; return 0; } return echtST.apply(window, arguments); };
        window.sbIsLoggedIn = () => true;
        localStorage.setItem('gs_sb_email', 'p@r.ch');
        const err = () => { const e = document.getElementById('admin-login-error'); return e ? e.textContent : ''; };
        try {
          localStorage.setItem('gs_admin', 'true'); localStorage.setItem('gs_is_admin', '0'); localStorage.setItem('gs_user_role', 'user');
          merk.ohneSpiegel = gsIsActuallyAdmin();
          merk.fremd = gsIsAdmin('jemand@example.com');
          merk.profilJa = gsIsAdmin({ is_admin: true }); merk.profilNein = gsIsAdmin({ is_admin: false, role: 'user' });
          localStorage.removeItem('gs_admin');
          setz({ data: false, error: null }); openAdminLogin();
          merk.nein = { rueck: await doAdminLogin(), flag: localStorage.getItem('gs_admin'), text: err(), reloads };
          setz({ data: null, error: { message: 'JWT expired', status: 401 } });
          merk.fehler = { rueck: await doAdminLogin(), flag: localStorage.getItem('gs_admin'), text: err() };
          setz({ data: true, error: null });
          merk.ja = { rueck: await doAdminLogin(), flag: localStorage.getItem('gs_admin'), spiegel: localStorage.getItem('gs_is_admin'), reloads, rpc: rufe.filter(u => /rpc\/is_admin_user/.test(u)).length };
          merk.jetztAdmin = gsIsActuallyAdmin();
          return merk;
        } finally {
          window.sbFetch = echtSb; window.sbIsLoggedIn = echtLogin; window.setTimeout = echtST;
          try { closeAdminLogin(); } catch (_) {}
          try { localStorage.removeItem('gs_admin'); localStorage.removeItem('gs_is_admin'); localStorage.removeItem('gs_user_role'); if (echtMail === null) localStorage.removeItem('gs_sb_email'); else localStorage.setItem('gs_sb_email', echtMail); } catch (_) {}
        }
      });
      if (r.ohneSpiegel !== false) f.push('Speicher-„ja" ohne Server-Spiegel gilt als Admin');
      if (r.fremd !== false) f.push('fremde Adresse bekommt Auskunft: ' + r.fremd);
      if (r.profilJa !== true || r.profilNein !== false) f.push('Profil-Urteil: ' + JSON.stringify({ ja: r.profilJa, nein: r.profilNein }));
      if (!r.nein || r.nein.rueck !== false || r.nein.flag !== null || !/kein Admin/.test(r.nein.text) || r.nein.reloads !== 0) f.push('Server nein: ' + JSON.stringify(r.nein));
      if (!r.fehler || r.fehler.rueck !== false || r.fehler.flag !== null || !/Sitzung/.test(r.fehler.text) || /JWT/.test(r.fehler.text)) f.push('Server-Fehler: ' + JSON.stringify(r.fehler));
      if (!r.ja || r.ja.rueck !== true || r.ja.flag !== 'true' || r.ja.spiegel !== '1' || r.ja.reloads !== 1 || r.ja.rpc !== 3) f.push('Server ja: ' + JSON.stringify(r.ja));
      if (r.jetztAdmin !== true) f.push('nach dem Server-Ja kein Admin');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'kein Hash, keine Liste im HTML · Speicher-„ja" allein zaehlt nicht · fremde Adresse: nein · Server nein → „kein Admin", kein Neustart · 401 → „Sitzung" · Server ja → Flag + Spiegel + ein Neustart · 3 RPC-Aufrufe' };
    },
  },
  {
    name: 'C4 · vier Push-Sender teilen EIN Helfer-Modul (_shared/push_helfer.mjs): keine Kopie von loadSettings/zurichHour/sendPush mehr, keine private Adresse als VAPID-Rueckfall; Rechnung des Moduls mit gestelltem Client und gestelltem web-push',
    lauf: async () => {
      const f = [];
      const fnRoot = path.join(__dirname, '..', 'supabase', 'functions');
      const sender = ['daily-push-checker', 'engagement-push-checker', 'weather-alert-checker', 'sensor-push'];
      sender.forEach(n => {
        const t = fs.readFileSync(path.join(fnRoot, n, 'index.ts'), 'utf8');
        if (!/from "\.\.\/_shared\/push_helfer\.mjs"/.test(t)) f.push(n + ' importiert das Modul nicht');
        if (/^async function loadSettings\(|^function zurichHour\(|^async function sendPush\(/m.test(t)) f.push(n + ' traegt noch eine eigene Kopie');
      });
      const alle = fs.readdirSync(fnRoot).filter(d => fs.existsSync(path.join(fnRoot, d, 'index.ts')));
      alle.forEach(d => { if (/rankwiler/.test(fs.readFileSync(path.join(fnRoot, d, 'index.ts'), 'utf8'))) f.push(d + ' traegt eine private Adresse'); });
      const modPfad = path.join(fnRoot, '_shared', 'push_helfer.mjs');
      if (!fs.existsSync(modPfad)) return { ok: false, warum: '_shared/push_helfer.mjs fehlt · ' + f.join(' · ') };
      if (/^import /m.test(fs.readFileSync(modPfad, 'utf8'))) f.push('Modul ist nicht rein (import)');
      // feedback-triage: kein Admin-Urteil aus einer E-Mail-Liste und keinem unverifizierten Token-Inhalt — der Server sagt es (is_admin_user mit dem Token der Person)
      const triage = fs.readFileSync(path.join(fnRoot, 'feedback-triage', 'index.ts'), 'utf8');
      if (/ADMIN_EMAILS/.test(triage)) f.push('feedback-triage traegt noch eine E-Mail-Liste');
      if (!/rpc\/is_admin_user/.test(triage)) f.push('feedback-triage fragt nicht is_admin_user');
      if (/atob\(/.test(triage.replace(/^\s*\/\/.*$/gm, ''))) f.push('feedback-triage liest den Token-Inhalt selbst (atob)');
      let M;
      try { M = await import('file://' + modPfad); } catch (e) { return { ok: false, warum: 'Modul laedt nicht: ' + e.message }; }
      // zurichHour: Sommer 10:30Z → 12, Winter 23:30Z → 0
      if (M.zurichHour('2026-07-01T10:30:00Z') !== 12) f.push('zurichHour Sommer: ' + M.zurichHour('2026-07-01T10:30:00Z'));
      if (M.zurichHour('2026-01-01T23:30:00Z') !== 0) f.push('zurichHour Winter: ' + M.zurichHour('2026-01-01T23:30:00Z'));
      if (typeof M.zurichHour() !== 'number') f.push('zurichHour() ohne Argument');
      // loadSettings mit gestelltem Client
      const sbMit = (rows, error) => ({ from: () => ({ select: () => ({ in: async () => ({ data: rows, error: error || null }) }) }) });
      let s1; try { s1 = await M.loadSettings(sbMit([{ key: 'vapid_public_key', value: 'PUB' }, { key: 'vapid_private_key', value: 'PRIV' }, { key: 'push_cron_secret', value: 'S' }])); } catch (e) { f.push('loadSettings wirft: ' + e.message); }
      if (s1 && (s1.vapid.publicKey !== 'PUB' || s1.vapid.privateKey !== 'PRIV' || s1.cronSecret !== 'S')) f.push('loadSettings Werte: ' + JSON.stringify(s1));
      if (s1 && s1.vapid.subject !== 'mailto:info@greenscan.ch') f.push('VAPID-Rueckfall ist ' + (s1 && s1.vapid.subject));
      let s2 = null; try { s2 = await M.loadSettings(sbMit([{ key: 'vapid_public_key', value: 'PUB' }])); f.push('ohne privaten Schluessel keine Ausnahme'); } catch (e) { if (!/VAPID/.test(e.message)) f.push('falsche Ausnahme: ' + e.message); }
      try { await M.loadSettings(sbMit(null, { message: 'kaputt' })); f.push('Ladefehler ohne Ausnahme'); } catch (e) { if (!/settings load: kaputt/.test(e.message)) f.push('Ladefehler-Text: ' + e.message); }
      // sendPush mit gestelltem web-push
      const rufe = [];
      const wp = { setVapidDetails: (...a) => rufe.push(['vapid', a]), sendNotification: async (sub, payload, opts) => { rufe.push(['send', sub, JSON.parse(payload), opts]); return { statusCode: 201 }; } };
      const r1 = await M.sendPush(wp, { endpoint: 'https://push.example/x', p256dh: 'P', auth_secret: 'A' }, { title: 'T', body: 'B', url: '/?screen=garden', tag: 'gs-t' }, { subject: 'mailto:info@greenscan.ch', publicKey: 'PUB', privateKey: 'PRIV' });
      const send = rufe.find(x => x[0] === 'send');
      if (!r1.ok || r1.status !== 201) f.push('sendPush ok: ' + JSON.stringify(r1));
      if (!send || send[1].keys.p256dh !== 'P' || send[1].keys.auth !== 'A' || send[3].TTL !== 3600) f.push('sendPush Abo/TTL: ' + JSON.stringify(send && [send[1], send[3]]));
      if (!send || send[2].title !== 'T' || send[2].url !== '/?screen=garden' || send[2].data.url !== '/?screen=garden' || send[2].tag !== 'gs-t' || !/icon-192/.test(send[2].icon) || !/icon-96/.test(send[2].badge)) f.push('Nutzlast: ' + JSON.stringify(send && send[2]));
      const p2 = M.pushPayload({ title: 'x', body: 'y', url: '/' });
      if (!/^gs-\d+$/.test(p2.tag)) f.push('tag-Rueckfall: ' + p2.tag);
      const wpWeg = { setVapidDetails: () => {}, sendNotification: async () => { const e = new Error('Gone'); e.statusCode = 410; throw e; } };
      const r2 = await M.sendPush(wpWeg, { endpoint: 'e', p256dh: 'P', auth_secret: 'A' }, { title: 't', body: 'b', url: '/' }, { subject: 's', publicKey: 'p', privateKey: 'k' });
      if (r2.ok || r2.status !== 410 || !/Gone/.test(r2.error)) f.push('sendPush 410: ' + JSON.stringify(r2));
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: '4 Sender importieren, 0 Kopien, 0 private Adressen in ' + alle.length + ' Functions · Zuerich 12/0 · Settings PUB/PRIV/S, Rueckfall info@greenscan.ch, fehlend → Ausnahme · Push 201, TTL 3600, Nutzlast vollstaendig · 410 → ok:false' };
    },
  },
  {
    name: 'A7 · species-search verlangt einen echten Nutzer (GoTrue prueft), CORS nur eigene Origins, Suche mit dem Token der Person statt Service-Key, keine rohen Fehlertexte, q und lim gedeckelt — Quelltext-Frage, kein Deno hier',
    lauf: async () => {
      const f = [];
      const t = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'species-search', 'index.ts'), 'utf8');
      const code = t.replace(/^\s*\/\/.*$/gm, '');
      if (/Allow-Origin":\s*"\*"/.test(code)) f.push('CORS steht auf *');
      if (!/greenscan-app\\?\.pages\\?\.dev/.test(code) || !/"https:\/\/green-scan\.ch"/.test(code)) f.push('keine Origin-Allowlist');   // im Quelltext stehen die Punkte maskiert
      if (!/auth\/v1\/user/.test(code)) f.push('kein Blick zu GoTrue (auth/v1/user)');
      if (!/auth_required/.test(code) || !/, 401\)/.test(code)) f.push('ohne Token keine 401');
      // Die Suche laeuft mit dem Token der Person: im RPC-Aufruf steht `Bearer ${token}`, nicht der Service-Key
      const rpc = code.slice(code.indexOf('rpc/fn_species_search'), code.indexOf('rpc/fn_species_search') + 400);
      if (!/Bearer \$\{token\}/.test(rpc) || /Bearer \$\{SVC_KEY\}/.test(rpc)) f.push('RPC laeuft nicht mit dem Token der Person');
      if (/detail:\s*t\.slice|detail:/.test(code)) f.push('roher Fehlertext (detail) geht hinaus');
      if (/error:\s*String\(e\)/.test(code)) f.push('Ausnahme-Text geht hinaus');
      if (!/Q_MAX\s*=\s*80/.test(code) || !/\.slice\(0, Q_MAX\)/.test(code)) f.push('q nicht auf 80 Zeichen gedeckelt');
      if (!/if \(lim > 25\) lim = 25;/.test(code)) f.push('lim nicht gedeckelt');
      // Der Cache-Weg bleibt der einzige Service-Key-Weg — und er kommt erst NACH der Suche
      const iAuth = code.indexOf('auth/v1/user'), iRpc = code.indexOf('rpc/fn_species_search'), iCache = code.indexOf('species_search_cache?on_conflict');
      if (!(iAuth > 0 && iAuth < iRpc && iRpc < iCache)) f.push('Reihenfolge Auth → Suche → Cache stimmt nicht: ' + [iAuth, iRpc, iCache].join('/'));
      // Und die App faellt ohne Server auf die lokale Liste zurueck (der Aufrufer prueft `resp.data.results`, sonst null)
      const idx = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
      const iCall = idx.indexOf("sbFetch('/functions/v1/species-search'");
      if (iCall < 0 || !/return null;/.test(idx.slice(iCall, iCall + 400))) f.push('App ohne Rueckfall auf die lokale Liste');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'Allowlist statt * · Bearer Pflicht, GoTrue prueft, sonst 401 · RPC mit Nutzer-Token · Cache (Service-Key) erst nach der Suche · kein detail/String(e) · q ≤ 80, lim ≤ 25 · App faellt lokal zurueck' };
    },
  },
  {
    name: 'C2 · keine Funktion ohne zweite Nennung im Repo (Quelltext, Skripte, Migrationen, Functions — ganze Kommentarzeilen abgezogen); was bewusst bleibt, steht namentlich in der Liste (dynamisch gebildete Namen)',
    lauf: async () => {
      // Dieselbe Rechnung wie das Werkzeug, das die 104 Funktionen in v32.77 entfernt hat:
      // jede Definition (function X / window.X = function) braucht irgendwo im Repo eine
      // zweite Nennung — als Aufruf, als onclick-Zeichenkette, in MENU_ITEMS, in GS_NOTIF_ZIELE,
      // in einem Pruefstand. Ein `/*` in einer Zeichenkette (accept="image/*") wuerde einen
      // Block-Kommentar-Streicher den halben Rest verschlucken lassen — deshalb werden NUR
      // ganze Kommentarzeilen entfernt (wiring_check hat dieselbe Lehre, CLAUDE.md §7.1).
      const BEWUSST = { closeAbout: "window['close' + modalId] bildet den Namen dynamisch (Z. ~19597)" };
      const wurzel = path.join(__dirname, '..');
      const idx = fs.readFileSync(path.join(wurzel, 'index.html'), 'utf8');
      const defs = new Set();
      for (const m of idx.matchAll(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) defs.add(m[1]);
      for (const m of idx.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function/g)) defs.add(m[1]);
      const dateien = ['sw.js', 'install.html', 'offline.html'];
      const sammle = (d, re) => { try { fs.readdirSync(path.join(wurzel, d)).filter(f => re.test(f)).forEach(f => dateien.push(path.join(d, f))); } catch (_) {} };
      sammle('scripts', /\.(js|py)$/); sammle('supabase/migrations', /\.sql$/);
      try { fs.readdirSync(path.join(wurzel, 'supabase', 'functions')).forEach(f => { const p = path.join('supabase', 'functions', f, 'index.ts'); if (fs.existsSync(path.join(wurzel, p))) dateien.push(p); }); } catch (_) {}
      let korpus = idx;
      for (const f of dateien) { try { korpus += '\n' + fs.readFileSync(path.join(wurzel, f), 'utf8'); } catch (_) {} }
      korpus = korpus.replace(/^[ \t]*\/\/.*$/gm, '').replace(/^[ \t]*\*.*$/gm, '');
      const zaehl = new Map();
      for (const m of korpus.matchAll(/[A-Za-z_$][\w$]*/g)) zaehl.set(m[0], (zaehl.get(m[0]) || 0) + 1);
      const tot = [...defs].filter(d => (zaehl.get(d) || 0) <= 1).sort();
      const unbegruendet = tot.filter(d => !BEWUSST[d]);
      const fehltInListe = Object.keys(BEWUSST).filter(d => !defs.has(d));
      const f = [];
      if (unbegruendet.length) f.push(unbegruendet.length + ' ohne zweite Nennung: ' + unbegruendet.slice(0, 12).join(' ') + (unbegruendet.length > 12 ? ' …' : ''));
      if (fehltInListe.length) f.push('in BEWUSST, aber nicht mehr definiert: ' + fehltInListe.join(' '));
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: defs.size + ' Definitionen · ' + tot.length + ' ohne zweite Nennung, alle begruendet (' + tot.join(', ') + ') · Korpus ' + (dateien.length + 1) + ' Dateien' };
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
  console.log('  Grenze: B3 ist eine Quelltext-Frage — den ersten Install misst offline_check. B8 statisch: eine Zeile, die den Fehler erst spaeter anzeigt, sieht die Suche nicht — der gerenderte Toast und das Quiz-Urteil sind die Messung.');
  process.exitCode = kaputt ? 1 : 0;
})();
