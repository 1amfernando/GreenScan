// Gruppe r1b — Schlusspruefung Client II (v33.59): das Fund-Foto beim Freigeben,
// die Wiederherstellung UNTER dem Anmeldebildschirm, der Magic-Link-Knopf,
// offline gespeicherte Plaene beim Abmelden, die festen Saetze des KI-Proxys.
//
// Jeder Fall faehrt die ECHTE Funktion und misst die WIRKUNG: was der PATCH
// traegt und welche Bytes hochgeladen werden, was an einem Punkt des
// Bildschirms WIRKLICH oben liegt (elementFromPoint, keine Attrappe fuer die
// Dialoge), was nach Abmelden und Wiederanmelden noch da ist, welcher Satz bei
// der Person ankommt. Gestellt wird nur der Server (fetch / sbFetch).
'use strict';
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const SEED = require('../_seed.js');

const WURZEL = path.resolve(__dirname, '..', '..');
const UID_A = '00000000-0000-4000-8000-000000000001';   // die Sitzung aus sicherheit_check
const UID_B = '22222222-2222-4222-8222-222222222222';

// ── Hilfen ───────────────────────────────────────────────────────────────

// Die Tor-Entscheidungen des KI-Proxys aus dem MODUL gelesen (nicht abgeschrieben):
// jeder Code, den kiTor / kiEingabeOk / kiProxyEingabe mit einem Status liefern,
// plus zu_gross aus ai-proxy. quota_exceeded hat seinen eigenen Weg, config ist
// ein Ausfall des Servers (Rueckfall bleibt), ok ist kein Fehler.
async function proxyCodes() {
  const quelle = fs.readFileSync(path.join(WURZEL, 'supabase/functions/_shared/ki_tor.mjs'), 'utf8');
  const proxy = fs.readFileSync(path.join(WURZEL, 'supabase/functions/ai-proxy/index.ts'), 'utf8');
  const st = {};
  for (const m of quelle.matchAll(/status:\s*(\d{3}),\s*code:\s*"([a-z_]+)"/g)) st[m[2]] = +m[1];
  for (const m of quelle.matchAll(/nein\((\d{3}),\s*"([a-z_]+)"/g)) st[m[2]] = +m[1];
  for (const m of proxy.matchAll(/type:\s*"([a-z_]+)"[^\n]*?\}\s*\},\s*(\d{3})/g)) st[m[1]] = +m[2];
  ['quota_exceeded', 'config', 'ok', 'upstream'].forEach(k => delete st[k]);
  const mod = await import(pathToFileURL(path.join(WURZEL, 'supabase/functions/_shared/ki_tor.mjs')).href);
  return Object.keys(st).sort().map(code => ({ code, status: st[code], satz: mod.kiFehlerCode(code).message, bekannt: mod.kiFehlerCode(code).code === code }));
}

// Eine ABGEMELDET geladene App (eigene Seite im selben Kontext — h.frisch() laedt
// angemeldet). /auth/v1/user ist gestellt; alles andere ausser file: wird abgebrochen.
// Achtung: dieselbe Herkunft (file://) — der localStorage ist mit der Hauptseite GETEILT;
// danach h.frisch(), sonst ist die Hauptseite ebenfalls abgemeldet.
async function abgemeldet(seite, anker) {
  const p = await seite.context().newPage();
  const fehler = [];
  p.on('pageerror', e => fehler.push(String(e.message).split('\n')[0]));
  p.on('dialog', d => d.dismiss().catch(() => {}));
  await p.route('**', r => {
    const u = r.request().url();
    if (u.startsWith('file:')) return r.continue();
    if (/\/auth\/v1\/user/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: UID_A, email: 'ich@example.invalid' }) });
    return r.abort();
  });
  await p.addInitScript(SEED);
  await p.addInitScript(() => { try {
    ['gs_sb_token', 'gs_sb_uid', 'gs_sb_email', 'gs_sb_expires', 'gs_sb_expires_at', 'gs_sb_refresh'].forEach(k => localStorage.removeItem(k));
  } catch (e) {} });
  await p.goto('file://' + path.join(WURZEL, 'index.html') + '#' + anker, { waitUntil: 'domcontentloaded', timeout: 120000 });
  return { p, fehler };
}

// Liegt am Mittelpunkt des Elements wirklich dieses Element (oder ein Kind)?
const obenAuf = (p, sel) => p.evaluate((sel) => {
  const el = typeof sel === 'string' ? document.querySelector(sel) : null;
  if (!el) return { da: false };
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return { da: true, sichtbar: false };
  const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { da: true, sichtbar: true, oben: !!(t && (t === el || el.contains(t))), traf: t ? (t.id || t.className || t.tagName) : null, imOnb: !!(t && t.closest && t.closest('#gs-onboarding')) };
}, sel);

// Ein Element mit diesem Text, das man SIEHT (elementFromPoint am Mittelpunkt).
const satzSichtbar = (p, re) => p.evaluate((src) => {
  const re = new RegExp(src);
  const kand = Array.from(document.querySelectorAll('body *')).filter(el =>
    re.test(el.textContent || '') && !Array.from(el.children).some(c => re.test(c.textContent || '')));
  const treffer = kand.map(el => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return { text: el.textContent.slice(0, 80), sichtbar: false };
    const t = document.elementFromPoint(Math.min(innerWidth - 1, r.left + r.width / 2), Math.min(innerHeight - 1, r.top + r.height / 2));
    return { text: el.textContent.slice(0, 80), sichtbar: !!(t && (t === el || el.contains(t) || t.contains(el))), traf: t ? (t.id || String(t.className).slice(0, 30) || t.tagName) : null };
  });
  return { ok: treffer.some(x => x.sichtbar), treffer };
}, re.source);

module.exports = [
  // ── d2#2 · die festen Saetze des KI-Proxys ─────────────────────────────
  {
    name: 'KI-Proxy · jede Tor-Entscheidung zeigt den Satz des Servers (callAI + callVisionAI), Liste gegen ki_tor.mjs',
    lauf: async (seite, h) => {
      const codes = await proxyCodes();
      if (codes.length < 8) return { ok: false, warum: 'aus ki_tor.mjs nur ' + codes.length + ' Codes gelesen — der Fall misst nichts: ' + JSON.stringify(codes) };
      const r = await seite.evaluate(async (codes) => {
        const alt = { a: window._gsApiFetch, c: window.getApiConfig, q: window.gsAboCanUse };
        window.getApiConfig = () => ({ provider: 'anthropic', key: '', source: 'global' });
        window.gsAboCanUse = () => true;
        const out = [];
        for (const c of codes) {
          for (const weg of ['callAI', 'callVisionAI']) {
            window._gsApiFetch = async () => new Response(JSON.stringify({ error: { type: c.code, message: c.satz } }), { status: c.status, headers: { 'Content-Type': 'application/json' } });
            let msg = null;
            try { weg === 'callAI' ? await callAI([{ role: 'user', content: 'x' }], 's', 50, { retries: 0 }) : await callVisionAI('AAAA', 'image/jpeg', 'x'); }
            catch (e) { msg = String(e && e.message); }
            out.push({ code: c.code, weg, msg, ok: !!msg && msg.indexOf(c.satz) >= 0 });
          }
        }
        window._gsApiFetch = alt.a; window.getApiConfig = alt.c; window.gsAboCanUse = alt.q;
        return { out, liste: Array.isArray(window.GS_KI_PROXY_SAETZE) ? window.GS_KI_PROXY_SAETZE.slice().sort() : null };
      }, codes);
      const schlecht = r.out.filter(x => !x.ok);
      if (schlecht.length) return { ok: false, warum: schlecht.length + ' von ' + r.out.length + ' falsch umgedeutet, z.B. ' + schlecht.slice(0, 3).map(x => x.code + '/' + x.weg + ' → ' + JSON.stringify(x.msg)).join(' | ') };
      const fremd = codes.filter(c => !c.bekannt).map(c => c.code);
      if (fremd.length) return { ok: false, warum: 'Codes ohne Satz in KI_SAETZE: ' + fremd.join(',') };
      const soll = codes.map(c => c.code).sort();
      if (JSON.stringify(r.liste) !== JSON.stringify(soll)) return { ok: false, warum: 'GS_KI_PROXY_SAETZE ' + JSON.stringify(r.liste) + ' ≠ Tor-Codes des Moduls ' + JSON.stringify(soll) };
      return { ok: true, info: codes.length + ' Codes × 2 Wege — der Satz des Servers kommt an; die App-Liste deckt das Modul' };
    },
  },
  {
    name: 'KI-Proxy · 503 kontingent_unbekannt ist kein Ausfall (keine Marke, kein Direktweg) — 503 ohne type und Netzfehler bleiben der Rueckfall',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async () => {
        const alt = { a: window._gsApiFetch, c: window.getApiConfig, q: window.gsAboCanUse, m: window._gsGlobalKeyMem };
        window.getApiConfig = () => ({ provider: 'anthropic', key: 'sk-ant-pruefstand', source: 'global' });
        window.gsAboCanUse = () => true;
        const lauf = async (antwort) => {
          localStorage.removeItem('gs_ai_proxy_down_ts');
          const ziele = [];
          window._gsApiFetch = async (url) => {
            ziele.push(String(url));
            if (/anthropic\.com/.test(url)) return new Response(JSON.stringify({ content: [{ type: 'text', text: 'direkt' }] })   /* echte Form: seit v33.58 liest _gsAiText nur Bloecke mit type 'text' */, { status: 200, headers: { 'Content-Type': 'application/json' } });
            if (antwort === 'netz') throw new TypeError('Failed to fetch');
            return new Response(JSON.stringify(antwort.body), { status: antwort.status, headers: { 'Content-Type': 'application/json' } });
          };
          let msg = null, text = null;
          try { text = await callAI([{ role: 'user', content: 'x' }], 's', 50, { retries: 0 }); } catch (e) { msg = String(e && e.message); }
          return { direkt: ziele.filter(u => /anthropic\.com/.test(u)).length, marke: !!localStorage.getItem('gs_ai_proxy_down_ts'), msg, text };
        };
        const ku = await lauf({ status: 503, body: { error: { type: 'kontingent_unbekannt', message: 'Das Kontingent ist gerade nicht prüfbar — bitte in einer Minute erneut versuchen.' } } });
        const aus = await lauf({ status: 503, body: { error: { message: 'Service Unavailable' } } });
        const netz = await lauf('netz');
        const quota = await lauf({ status: 429, body: { error: { type: 'quota_exceeded', message: 'Tageslimit erreicht (5/5).' } } });
        window._gsApiFetch = alt.a; window.getApiConfig = alt.c; window.gsAboCanUse = alt.q;
        localStorage.removeItem('gs_ai_proxy_down_ts');
        return { ku, aus, netz, quota };
      });
      if (r.ku.direkt || r.ku.marke) return { ok: false, warum: 'kontingent_unbekannt als Ausfall gewertet: ' + JSON.stringify(r.ku) };
      if (!r.ku.msg || r.ku.msg.indexOf('nicht prüfbar') < 0) return { ok: false, warum: 'kontingent_unbekannt: falscher Satz ' + JSON.stringify(r.ku.msg) };
      if (r.aus.direkt !== 1 || !r.aus.marke || r.aus.text !== 'direkt') return { ok: false, warum: 'Gegenrichtung: 503 ohne type nimmt den Rueckfall nicht mehr: ' + JSON.stringify(r.aus) };
      if (r.netz.direkt !== 1 || !r.netz.marke) return { ok: false, warum: 'Gegenrichtung: Netzfehler nimmt den Rueckfall nicht mehr: ' + JSON.stringify(r.netz) };
      if (r.quota.direkt || !/Tageslimit/.test(r.quota.msg || '')) return { ok: false, warum: '429 quota_exceeded veraendert: ' + JSON.stringify(r.quota) };
      return { ok: true, info: 'kontingent_unbekannt: Satz, 0 Direktweg, keine Marke · 503 ohne type / Netz: Rueckfall wie bisher · 429 unveraendert' };
    },
  },

  // ── e#1 · Magic-Link ───────────────────────────────────────────────────
  {
    name: 'Anmeldebildschirm · kein sichtbares Angebot einer Anmeldung per E-Mail-Link, solange die Rueckkehr abgewiesen wird',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async () => {
        const ob = document.getElementById('gs-onboarding');
        ob.style.display = 'flex';
        onbShowLogin();
        await new Promise(res => setTimeout(res, 500));
        const sicht = (el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
        const view = document.getElementById('onb-login');
        const alle = Array.from(view.querySelectorAll('*')).filter(sicht);
        const angebot = alle.filter(el => /magic|login-link|e-mail-link|einmaligen\s+login/i.test((el.textContent || '') + ' ' + (el.getAttribute('onclick') || '')) && !Array.from(el.children).some(c => /magic|login-link|e-mail-link|einmaligen/i.test(c.textContent || ''))).map(el => (el.id || el.tagName) + ': ' + el.textContent.trim().slice(0, 50));
        const oder = alle.filter(el => el.children.length === 0 && (el.textContent || '').trim() === 'oder').length;
        const login = document.getElementById('onb-login-btn');
        const out = { angebot, oder, login: !!(login && sicht(login)), fn: typeof window.onbMagicLink + '/' + typeof window.sbMagicLink };
        ob.style.display = 'none';
        return out;
      });
      if (r.angebot.length) return { ok: false, warum: 'sichtbares Angebot: ' + r.angebot.join(' | ') };
      if (r.oder) return { ok: false, warum: 'der „oder"-Trenner steht noch da' };
      if (r.fn !== 'undefined/undefined') return { ok: false, warum: 'onbMagicLink/sbMagicLink gibt es noch: ' + r.fn };
      if (!r.login) return { ok: false, warum: 'gutartig: der Anmelde-Knopf ist nicht sichtbar — der Fall misst nichts' };
      return { ok: true, info: 'kein Knopf, kein Hinweis, kein Trenner · Anmelden sichtbar · beide Funktionen entfernt' };
    },
  },

  // ── i5#1 · Wiederherstellung sichtbar, abgemeldet geladen ──────────────
  {
    name: 'Passwort-Link · abgemeldet geladen: der Passwort-Dialog liegt OBEN (elementFromPoint), danach ist der Anmeldebildschirm wieder da',
    lauf: async (seite, h) => {
      const { p, fehler } = await abgemeldet(seite, 'access_token=aaa.bbb.ccc&type=recovery');
      try {
        let feld = null;
        for (let i = 0; i < 40 && !feld; i++) { await p.waitForTimeout(250); feld = await p.$('#gs-prompt-input'); }
        if (!feld) return { ok: false, warum: 'kein Passwort-Dialog erschienen' };
        // der Start-Bildschirm (#gs-splash, z-index 999999) liegt anfangs ueber allem — erst danach zaehlt es
        for (let i = 0; i < 60; i++) {
          const weg = await p.evaluate(() => { const s = document.getElementById('gs-splash'); if (!s) return true; const c = getComputedStyle(s); return c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0; });
          if (weg) break; await p.waitForTimeout(250);
        }
        await p.waitForTimeout(500);
        const vorher = await p.evaluate(() => ({ pre: document.documentElement.classList.contains('gs-preauth'), ob: getComputedStyle(document.getElementById('gs-onboarding')).display }));
        if (!vorher.pre) return { ok: false, warum: 'gs-preauth fehlt — die Seite ist nicht abgemeldet geladen, der Fall misst nichts' };
        const o = await obenAuf(p, '#gs-prompt-input');
        if (!o.oben) return { ok: false, warum: 'am Passwortfeld liegt ' + o.traf + (o.imOnb ? ' (im #gs-onboarding)' : '') + ' — niemand sieht den Dialog' };
        // Abbrechen: Escape schliesst den Dialog
        await p.keyboard.press('Escape');
        await p.waitForTimeout(900);
        const nach = await p.evaluate(() => {
          const t = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
          return { dialog: !!document.getElementById('gs-prompt-input'), imOnb: !!(t && t.closest('#gs-onboarding')), token: localStorage.getItem('gs_sb_token') };
        });
        if (nach.dialog) return { ok: false, warum: 'der Dialog ging mit Escape nicht zu' };
        if (!nach.imOnb) return { ok: false, warum: 'nach dem Schliessen ist der Anmeldebildschirm nicht wieder da' };
        if (nach.token) return { ok: false, warum: 'ein Token liegt als Sitzung im Speicher' };
        if (fehler.length) return { ok: false, warum: 'JS-Fehler: ' + fehler.join(' | ') };
        return { ok: true, info: 'Dialog oben (' + o.traf + ') · Escape → Anmeldebildschirm wieder oben · keine Sitzung' };
      } finally { await p.close(); await h.frisch(); }   // dieselbe Herkunft: der Speicher ist geteilt — Sitzung wiederherstellen
    },
  },
  {
    name: 'Link-Meldungen · abgemeldet geladen: „nicht möglich" (magiclink) und „ungültig" (unbekannte Art) stehen SICHTBAR da',
    lauf: async (seite, h) => {
      const faelle = [
        { anker: 'access_token=aaa.bbb.ccc&type=magiclink&refresh_token=rt', re: /Anmeldung per E-Mail-Link ist nicht möglich/ },
        { anker: 'access_token=aaa.bbb.ccc&type=bogus', re: /Link ist ungültig oder abgelaufen/ },
        { anker: 'error=access_denied&error_code=otp_expired', re: /Link ist ungültig oder abgelaufen/ },
      ];
      const schlecht = [];
      for (const f of faelle) {
        const { p } = await abgemeldet(seite, f.anker);
        try {
          await p.waitForTimeout(2600);
          const s = await satzSichtbar(p, f.re);
          if (!s.ok) schlecht.push(f.anker.slice(0, 40) + ' → ' + (s.treffer.length ? 'verdeckt: ' + JSON.stringify(s.treffer.slice(0, 2)) : 'kein Satz im Dokument'));
        } finally { await p.close(); }
      }
      await h.frisch();   // der Speicher ist mit der abgemeldeten Seite geteilt
      if (schlecht.length) return { ok: false, warum: schlecht.join(' | ') };
      return { ok: true, info: faelle.length + ' Anker — der Satz liegt oben, nicht unter dem Anmeldebildschirm' };
    },
  },

  // ── e#2 · offline gespeicherte Plaene beim Abmelden ────────────────────
  {
    name: 'Plaene · offline gespeichert, abgemeldet → B sieht ihn nicht → A wieder angemeldet: er ist da und wird nachgeschoben; Cloud-Plaene gehen',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async (o) => {
        const alt = { f: window.sbFetch, s: window.gsSnapshotCreate };
        let netz = false; const posts = [];
        window.sbFetch = async (pfad, opt) => {
          opt = opt || {};
          if (!netz) return { data: null, error: { message: 'Failed to fetch' } };
          if (/garden_plans/.test(pfad) && opt.method === 'POST') { const b = JSON.parse(opt.body); posts.push(b); return { data: [{ id: 'c0ffee00-0000-4000-8000-00000000000' + posts.length }], error: null }; }
          return { data: [], error: null };
        };
        window.gsSnapshotCreate = async () => null;
        localStorage.removeItem('gs_plans_v2'); localStorage.removeItem('gs_plans_wartend');
        // A speichert einen Plan OHNE Empfang und einen MIT
        await gsPlans.save({ type: 'garden', title: 'Offline-Plan von A' });
        netz = true;
        await gsPlans.save({ type: 'garden', title: 'Cloud-Plan von A' });
        netz = false;
        const vorA = (await gsPlans.list()).map(e => e.title + (e.cloud ? '☁' : ''));
        // Abmelden — derselbe Weg wie der Knopf
        await sbLogout();
        const nachLogout = { v2: localStorage.getItem('gs_plans_v2'), liste: (await gsPlans.list()).map(e => e.title) };
        // B meldet sich an
        localStorage.setItem('gs_sb_token', 'pruef.stand.b'); localStorage.setItem('gs_sb_uid', o.B);
        const sichtB = (await gsPlans.list()).map(e => e.title);
        const ladenB = JSON.parse(localStorage.getItem('gs_plans_v2') || '[]').some(e => /von A/.test(e.title));
        sbClearSession(); gsClearUserDataKeys();
        // A meldet sich wieder an — jetzt mit Empfang
        netz = true;
        localStorage.setItem('gs_sb_token', 'pruef.stand.token'); localStorage.setItem('gs_sb_uid', o.A);
        const sichtA = (await gsPlans.list()).map(e => e.title);
        await new Promise(res => setTimeout(res, 600));
        const v2 = JSON.parse(localStorage.getItem('gs_plans_v2') || '[]');
        const offline = v2.find(e => e.title === 'Offline-Plan von A') || null;
        // Deckel: 30 wartende Plaene eines Kontos ergeben hoechstens 20, ein 100 Tage alter geht
        netz = false;
        localStorage.setItem('gs_plans_v2', JSON.stringify(Array.from({ length: 30 }, (_, i) => ({ id: 'l' + i, localId: 'l' + i, type: 'garden', title: 'P' + i, uid: o.A, cloud: false, created: new Date(Date.now() - (i === 0 ? 100 : 1) * 86400000).toISOString() }))));
        localStorage.removeItem('gs_plans_wartend');
        gsClearUserDataKeys();
        const wart = JSON.parse(localStorage.getItem('gs_plans_wartend') || '[]');
        window.sbFetch = alt.f; window.gsSnapshotCreate = alt.s;
        localStorage.removeItem('gs_plans_wartend');
        localStorage.setItem('gs_sb_token', 'pruef.stand.token'); localStorage.setItem('gs_sb_uid', o.A);
        return { vorA, nachLogout, sichtB, ladenB, sichtA, offline, postsA: posts.map(p => p.user_id + ':' + p.title), deckel: wart.length, alt100: wart.some(e => e.title === 'P0') };
      }, { A: UID_A, B: UID_B });
      await h.frisch();
      if (r.vorA.indexOf('Offline-Plan von A') < 0 || r.vorA.indexOf('Cloud-Plan von A☁') < 0) return { ok: false, warum: 'gutartig: A sieht seine Plaene nicht: ' + JSON.stringify(r.vorA) };
      if (r.nachLogout.v2 !== null) return { ok: false, warum: 'gs_plans_v2 ueberlebt das Abmelden: ' + r.nachLogout.v2.slice(0, 120) };
      if (r.nachLogout.liste.length) return { ok: false, warum: 'abgemeldet sichtbar: ' + JSON.stringify(r.nachLogout.liste) };
      if (r.sichtB.some(t => /von A/.test(t)) || r.ladenB) return { ok: false, warum: 'B sieht einen Plan von A: ' + JSON.stringify(r.sichtB) };
      if (r.sichtA.indexOf('Offline-Plan von A') < 0) return { ok: false, warum: 'A wieder angemeldet: der offline gespeicherte Plan ist weg: ' + JSON.stringify(r.sichtA) };
      if (r.sichtA.indexOf('Cloud-Plan von A') >= 0) return { ok: false, warum: 'der Cloud-Plan blieb auf dem Geraet liegen (er kommt aus der Cloud)' };
      if (!r.offline || !r.offline.cloud || r.postsA.indexOf(UID_A + ':Offline-Plan von A') < 0) return { ok: false, warum: 'nicht nachgeschoben: ' + JSON.stringify({ e: r.offline, posts: r.postsA }) };
      if (r.deckel > 20 || r.alt100) return { ok: false, warum: 'kein Deckel fuer das Wartende: ' + r.deckel + ' Eintraege, 100 Tage alter ' + (r.alt100 ? 'noch da' : 'weg') };
      return { ok: true, info: 'Abmelden: Speicher leer · B sieht nichts · A zurueck: Plan da, POST mit uid A · Cloud-Plan nicht geparkt · Deckel ' + r.deckel };
    },
  },

  // ── i4#1 · altes Fund-Foto beim Freigeben ──────────────────────────────
  {
    name: 'Fund freigeben · ein altes Foto MIT Exif wird neu kodiert, neu hochgeladen und im selben PATCH ersetzt; Holen scheitert → Rueckfrage',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async (o) => {
        // Ein „altes" Foto: Canvas-JPEG plus ein APP1-Exif-Segment mit GPS-Kennung
        const cv = document.createElement('canvas'); cv.width = 40; cv.height = 30;
        const cx = cv.getContext('2d'); cx.fillStyle = '#3a7'; cx.fillRect(0, 0, 40, 30);
        const sauberB = Uint8Array.from(atob(cv.toDataURL('image/jpeg', 0.9).split(',')[1]), c => c.charCodeAt(0));
        const nutz = new TextEncoder().encode('Exif\u0000\u0000GPSLatitude47.376912N8.541694E');
        const app1 = new Uint8Array(4 + nutz.length); app1[0] = 0xFF; app1[1] = 0xE1; app1[2] = (nutz.length + 2) >> 8; app1[3] = (nutz.length + 2) & 255; app1.set(nutz, 4);
        const exifB = new Uint8Array(sauberB.length + app1.length); exifB.set(sauberB.subarray(0, 2), 0); exifB.set(app1, 2); exifB.set(sauberB.subarray(2), 2 + app1.length);
        const ALT = SB_URL + '/storage/v1/object/public/map-find-photos/' + o.A + '/alt.jpg';
        const alt = { f: window.fetch, g: window._gsFetch, s: window.sbFetch, c: window.gsConfirmModal };
        const lauf = async (bild, ja, lesefehler) => {
          // lesefehler: die Zeile laesst sich nicht lesen, der lokale Marker kennt nur einen Platzhalter
          localStorage.setItem('greenscan_markers', JSON.stringify([{ id: 'm1', cloud_id: 'f-1', name: 'Steinpilz', lat: 47.376912, lng: 8.541694, photo_url: lesefehler ? 'gsphoto://m1' : ALT, is_private: true, date: Date.now() }]));
          const log = { patch: null, upload: [], del: [], confirm: 0, get: 0 };
          const stell = async (url, opt) => {
            url = String(url); opt = opt || {}; const m = (opt.method || 'GET').toUpperCase();
            if (url === ALT && m === 'GET') { log.get++; if (bild === 'weg') return new Response('nope', { status: 404 }); if (bild === 'netz') throw new TypeError('Failed to fetch'); return new Response(bild, { status: 200, headers: { 'Content-Type': 'image/jpeg' } }); }
            if (/\/storage\/v1\/object\/map-find-photos\//.test(url) && m === 'POST') { log.upload.push(new Uint8Array(await opt.body.arrayBuffer())); return new Response('{"Key":"x"}', { status: 200 }); }
            if (/\/storage\/v1\/object\//.test(url) && m === 'DELETE') { log.del.push(url); return new Response('{}', { status: 200 }); }
            return new Response('{}', { status: 404 });
          };
          window.fetch = stell; window._gsFetch = stell;
          window.sbFetch = async (pfad, opt) => {
            opt = opt || {};
            if (/map_user_finds/.test(pfad) && (opt.method || 'GET') === 'GET' && lesefehler) return { data: null, error: { message: 'HTTP 500', status: 500 } };
            if (/map_user_finds/.test(pfad) && (opt.method || 'GET') === 'GET') return { data: [{ lat: 47.376912, lng: 8.541694, photo_url: ALT }], error: null };
            if (/map_user_finds/.test(pfad) && opt.method === 'PATCH') { log.patch = JSON.parse(opt.body); return { data: [{ id: 'f-1' }], error: null }; }
            return { data: [], error: null };
          };
          window.gsConfirmModal = async () => { log.confirm++; return ja; };
          let erg; try { erg = await gsMapFinds.togglePrivacy('f-1', true); } catch (e) { erg = 'wurf: ' + e.message; }
          window.fetch = alt.f; window._gsFetch = alt.g; window.sbFetch = alt.s; window.gsConfirmModal = alt.c;
          const lokal = JSON.parse(localStorage.getItem('greenscan_markers'))[0];
          const hoch = log.upload[0] || null;
          return { erg, patch: log.patch, confirm: log.confirm, get: log.get, del: log.del, hochgeladen: log.upload.length,
            hochSauber: hoch ? _gsBildArt(hoch).sauber : null, hochGps: hoch ? new TextDecoder('latin1').decode(hoch).indexOf('GPSLatitude') >= 0 : null, lokalFoto: lokal.photo_url };
        };
        const exif = await lauf(exifB, true);
        const sauber = await lauf(sauberB, true);
        const weg = await lauf('weg', false);
        const wegJa = await lauf('netz', true);
        const lesen = await lauf(exifB, false, true);
        localStorage.removeItem('greenscan_markers');
        return { ALT, praefix: SB_URL + '/storage/v1/object/public/map-find-photos/' + o.A + '/', exifVorher: _gsBildArt(exifB).sauber, exif, sauber, weg, wegJa, lesen };
      }, { A: UID_A });
      if (r.exifVorher !== false) return { ok: false, warum: 'das Probefoto gilt als sauber — der Fall misst nichts' };
      const e = r.exif;
      if (!e.patch) return { ok: false, warum: 'Exif: kein PATCH: ' + JSON.stringify(e) };
      if (!('photo_url' in e.patch) || e.patch.photo_url === r.ALT || String(e.patch.photo_url).indexOf(r.praefix) !== 0) return { ok: false, warum: 'Exif: der PATCH traegt keine neue Foto-Adresse: ' + JSON.stringify(e.patch) };
      if (e.hochgeladen !== 1 || e.hochSauber !== true || e.hochGps !== false) return { ok: false, warum: 'Exif: hochgeladen ' + e.hochgeladen + ', sauber ' + e.hochSauber + ', GPS ' + e.hochGps };
      if (e.patch.lat !== 47.38 || e.patch.lng !== 8.54) return { ok: false, warum: 'Exif: Ort nicht gerundet: ' + JSON.stringify(e.patch) };
      if (e.erg !== true) return { ok: false, warum: 'Exif: Freigabe meldet ' + JSON.stringify(e.erg) };
      if (e.del.length !== 1 || e.del[0].indexOf('/alt.jpg') < 0) return { ok: false, warum: 'Exif: das alte Objekt wurde nicht entfernt: ' + JSON.stringify(e.del) };
      if (e.lokalFoto === r.ALT) return { ok: false, warum: 'Exif: der lokale Marker zeigt noch auf das alte Foto' };
      const s = r.sauber;
      if (!s.patch || s.hochgeladen || s.confirm || ('photo_url' in s.patch && s.patch.photo_url !== r.ALT)) return { ok: false, warum: 'gutartig: ein sauberes Foto wurde angefasst: ' + JSON.stringify(s) };
      const w = r.weg;
      if (w.patch) return { ok: false, warum: 'Holen scheitert + Nein: der PATCH ging trotzdem hinaus: ' + JSON.stringify(w.patch) };
      if (!w.confirm) return { ok: false, warum: 'Holen scheitert: keine Rueckfrage' };
      if (w.erg === true) return { ok: false, warum: 'Holen scheitert + Nein: meldet eine Freigabe' };
      const j = r.wegJa;
      if (!j.patch || j.patch.photo_url !== null || !j.confirm) return { ok: false, warum: 'Holen scheitert + Ja: der PATCH traegt nicht photo_url:null: ' + JSON.stringify(j) };
      if (j.lokalFoto !== r.ALT) return { ok: false, warum: 'Holen scheitert + Ja: das Foto im lokalen Marker ging verloren' };
      const l = r.lesen;
      if (l.patch || !l.confirm) return { ok: false, warum: 'Zeile nicht lesbar + Nein: ' + (l.patch ? 'der PATCH ging ohne Foto-Pruefung hinaus (das Foto der Zeile bliebe mit Exif oeffentlich): ' + JSON.stringify(l.patch) : 'keine Rueckfrage') };
      return { ok: true, info: 'Zeile nicht lesbar → Rueckfrage · Exif → neue Adresse im PATCH, Bild ohne Exif, altes Objekt entfernt · sauber → unberuehrt · Holen scheitert: Nein → kein PATCH, Ja → photo_url:null' };
    },
  },
];
