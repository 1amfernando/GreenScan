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
