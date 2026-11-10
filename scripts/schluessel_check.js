#!/usr/bin/env node
// schluessel_check.js — verlaesst der Anthropic-Schluessel den Server?
//
//   bash scripts/_pg_local.sh start      # einmal (SQL-Haelfte)
//   node scripts/schluessel_check.js
//
// Anlass: docs/PROFESSIONALITAET-AUDIT-2026-09-06.md §A1. `fn_get_global_api_key`
// gab den echten sk-ant-Schluessel an jeden angemeldeten Nutzer, die App legte
// ihn nach localStorage und rief api.anthropic.com direkt aus dem Browser. Der
// Proxy `ai-proxy` war seit Juni ausgeliefert und nie benutzt (ai_usage: 0 Zeilen).
//
// Seit v32.68 gilt: der Proxy ZUERST, der Schluessel liegt nie mehr auf der
// Platte (nur Arbeitsspeicher, nur solange der Server ihn noch schickt), und
// der Direktweg ist ein RUECKFALL fuer den Uebergang — nur bei Ausfall des
// Proxys, nur mit vorhandenem Schluessel, nie bei Quota oder Anmeldefehlern.
// Nach der Migration `20260907_global_api_key_nur_proxy.sql` bekommt kein
// Nutzer mehr einen Schluessel; der Rueckfall verschwindet damit von selbst.
//
// App-Haelfte (Playwright, gestelltes fetch): wohin geht ein KI-Aufruf, was
// steht danach im Speicher, und was passiert, wenn der Proxy schweigt.
// SQL-Haelfte (lokales Postgres): die neue Funktion — Nutzer ohne Schluessel,
// Admin mit, gesperrt/nicht konfiguriert/anonym ohne alles.
//
// Grenze: der echte Proxy laeuft hier nicht (Deno, Netz). Geprueft ist, WOHIN
// die App ruft und WAS sie speichert — nicht, ob der Proxy antwortet. Das sagt
// `select count(*) from ai_usage` nach dem ersten echten Aufruf (FUER-FERNANDO §8).
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const SEED = require('./_seed.js');

const ROOT = path.resolve(__dirname, '..');
const MIG = (f) => path.join(ROOT, 'supabase', 'migrations', f);
const URL0 = process.env.GS_PG_URL || 'postgresql://postgres@127.0.0.1:54329/postgres';
const DBN = 'gs_schluessel_check';
const KEY = 'sk-ant-' + 'a'.repeat(90);

function psql(url, args) { return spawnSync('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-F', '\t', ...args], { encoding: 'utf8' }); }
function letzte(r) { return (r.stderr || '').trim().split('\n').filter(Boolean).slice(-2).join(' · '); }
function sql(url, q) { const r = psql(url, ['-c', q]); if (r.status !== 0) throw new Error(letzte(r)); return (r.stdout || '').trim(); }
function sqlFile(url, f) { const r = psql(url, ['-f', f]); if (r.status !== 0) throw new Error(path.basename(f) + ': ' + letzte(r)); }

const S = [];
function fallS(name, fn) { try { S.push(Object.assign({ name }, fn())); } catch (e) { S.push({ name, ok: false, warum: 'Ausnahme: ' + String(e.message).split('\n')[0] }); } }

// auth.uid()/auth.jwt() aus Sitzungsvariablen, damit ein Fall „als Nutzer X" laufen kann.
const FIXTURE = `
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('gs.uid', true), '')::uuid $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email', current_setting('gs.email', true)) $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create table public.app_settings (key text primary key, value text);
create table public.profiles (id uuid primary key, is_admin boolean default false, role text default 'user');
create or replace function public.fn_user_role(_uid uuid default null) returns text language sql stable security definer set search_path to 'public','pg_catalog' as $$ select role from public.profiles where id = coalesce(_uid, auth.uid()) limit 1 $$;
create or replace function public.is_admin_user() returns boolean language sql stable security definer set search_path to 'public','pg_temp' as $$
  select coalesce(exists (select 1 from profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    or ((select auth.jwt() ->> 'email') = any (string_to_array(coalesce((select value from app_settings where key='admin_emails'), ''), ','))), false) $$;
insert into public.app_settings values ('global_api_enabled', 'true'), ('global_anthropic_api_key', '${KEY}'), ('global_api_provider', 'anthropic'), ('admin_emails', 'chef@example.ch');
insert into public.profiles values ('11111111-1111-4111-8111-000000000001', false, 'user'), ('11111111-1111-4111-8111-000000000002', true, 'admin'), ('11111111-1111-4111-8111-000000000003', false, 'banned'), ('11111111-1111-4111-8111-000000000004', false, 'user');
`;
const als = (url, uid, email, q) => sql(url, `set gs.uid = '${uid || ''}'; set gs.email = '${email || ''}'; ${q}`);

function sqlHaelfte() {
  try { sql(URL0, 'select 1'); }
  catch (e) { S.push({ name: 'Lokales Postgres', ok: null, warum: 'nicht erreichbar — `bash scripts/_pg_local.sh start` (' + String(e.message).split('\n')[0] + ')' }); return; }
  sql(URL0, `drop database if exists ${DBN}`); sql(URL0, `create database ${DBN}`);
  const url = URL0.replace(/\/[^/]*$/, '/' + DBN);
  sql(url, FIXTURE);
  sqlFile(url, MIG('20260907_global_api_key_nur_proxy.sql'));
  const U = (n) => '11111111-1111-4111-8111-00000000000' + n;
  fallS('Nutzer · bekommt enabled+mode=proxy, aber KEINEN Schluessel', () => {
    const r = JSON.parse(als(url, U(1), 'u1@example.ch', 'select public.fn_get_global_api_key()'));
    if (r.enabled !== true || r.mode !== 'proxy' || r.provider !== 'anthropic' || 'key' in r) return { ok: false, warum: JSON.stringify(r).replace(KEY, '<KEY>') };
    return { ok: true, info: 'enabled · mode proxy · provider anthropic · key fehlt' };
  });
  fallS('Admin (profiles.is_admin) und Admin (admin_emails) · bekommen den Schluessel — und mode=proxy', () => {
    const a = JSON.parse(als(url, U(2), 'a@example.ch', 'select public.fn_get_global_api_key()'));
    const b = JSON.parse(als(url, U(4), 'chef@example.ch', 'select public.fn_get_global_api_key()'));
    if (a.key !== KEY || a.mode !== 'proxy') return { ok: false, warum: 'is_admin: ' + JSON.stringify(a).replace(KEY, '<KEY>') };
    if (b.key !== KEY) return { ok: false, warum: 'admin_emails: ' + JSON.stringify(b).replace(KEY, '<KEY>') };
    return { ok: true, info: 'beide Admin-Wege liefern den Schluessel, mode proxy' };
  });
  fallS('Gesperrt · nicht konfiguriert · anonym → enabled false mit Grund, nie ein Schluessel', () => {
    const g = JSON.parse(als(url, U(3), 'b@example.ch', 'select public.fn_get_global_api_key()'));
    const an = JSON.parse(als(url, '', '', 'select public.fn_get_global_api_key()'));
    sql(url, `update app_settings set value = 'false' where key = 'global_api_enabled'`);
    const nk = JSON.parse(als(url, U(1), 'u1@example.ch', 'select public.fn_get_global_api_key()'));
    sql(url, `update app_settings set value = 'true' where key = 'global_api_enabled'`);
    const falsch = [];
    if (g.enabled !== false || g.reason !== 'banned' || 'key' in g) falsch.push('gesperrt: ' + JSON.stringify(g));
    if (an.enabled !== false || an.reason !== 'not_authenticated') falsch.push('anonym: ' + JSON.stringify(an));
    if (nk.enabled !== false || nk.reason !== 'not_configured') falsch.push('aus: ' + JSON.stringify(nk));
    return falsch.length ? { ok: false, warum: falsch.join(' · ').replace(KEY, '<KEY>') } : { ok: true, info: 'banned · not_authenticated · not_configured' };
  });
  fallS('Rechte · anon darf die Funktion nicht rufen, authenticated schon; idempotent', () => {
    const anon = sql(url, `select has_function_privilege('anon', 'public.fn_get_global_api_key()', 'execute')`);
    const auth = sql(url, `select has_function_privilege('authenticated', 'public.fn_get_global_api_key()', 'execute')`);
    sqlFile(url, MIG('20260907_global_api_key_nur_proxy.sql'));
    const r = JSON.parse(als(url, U(1), 'u1@example.ch', 'select public.fn_get_global_api_key()'));
    if (anon !== 'f' || auth !== 't') return { ok: false, warum: 'anon=' + anon + ' authenticated=' + auth };
    if ('key' in r) return { ok: false, warum: 'nach zweitem Lauf Schluessel fuer Nutzer' };
    return { ok: true, info: 'anon f · authenticated t · zweiter Lauf gleich' };
  });
  try { sql(URL0, `drop database if exists ${DBN}`); } catch (_) {}
}

// ── App-Haelfte ──────────────────────────────────────────────────────────
let __seite = null;
const K = [
  {
    name: 'Proxy zuerst · angemeldet, Server sagt „proxy" → callAI geht an /functions/v1/ai-proxy mit Bearer, OHNE x-api-key; Antwort kommt an; ohne Schluessel auf der Platte',
    lauf: async () => __seite.evaluate(async (KEY) => {
      const A = window.__sk; A.reset({ mode: 'proxy', mem: KEY });
      const t = await callAI([{ role: 'user', content: 'ping' }], 'sys', 50, { retries: 0, timeout: 3000 });
      const p = A.rufe.filter(r => /\/functions\/v1\/ai-proxy$/.test(r.url));
      const d = A.rufe.filter(r => /api\.anthropic\.com/.test(r.url));
      if (t !== 'proxy-ok') return { ok: false, warum: 'Antwort: ' + JSON.stringify(t) };
      if (p.length !== 1 || d.length) return { ok: false, warum: 'proxy ' + p.length + ' · direkt ' + d.length + ' (' + A.rufe.map(r => r.url).join(', ') + ')' };
      const h = p[0].init.headers || {};
      if (!/^Bearer /.test(h.Authorization || '') || h['x-api-key']) return { ok: false, warum: 'Header: ' + JSON.stringify(h) };
      if (localStorage.getItem('gs_global_api_key')) return { ok: false, warum: 'Schluessel liegt in localStorage' };
      const b = JSON.parse(p[0].init.body);
      if (!Array.isArray(b.messages) || b.system !== 'sys' || b.max_tokens !== 50) return { ok: false, warum: 'Body: ' + JSON.stringify(b).slice(0, 120) };
      return { ok: true, info: '1× Proxy, 0× direkt · Bearer, kein x-api-key · Body messages/system/max_tokens · localStorage ohne Schluessel' };
    }, KEY),
  },
  {
    name: 'Ohne Schluessel im Browser · Server sagt nur „proxy" (Stand nach der Migration) → callAI und callVisionAI laufen ueber den Proxy, nichts wirft „kein Key"',
    lauf: async () => __seite.evaluate(async () => {
      const A = window.__sk; A.reset({ mode: 'proxy', mem: '' });
      const t = await callAI([{ role: 'user', content: 'ping' }], '', 20, { retries: 0, timeout: 3000 });
      const v = await callVisionAI('AAAA', 'image/jpeg', 'Was ist das?', null, { maxTokens: 30 });
      const p = A.rufe.filter(r => /ai-proxy$/.test(r.url));
      if (t !== 'proxy-ok' || v !== 'proxy-ok') return { ok: false, warum: 'callAI ' + JSON.stringify(t) + ' · vision ' + JSON.stringify(v) };
      if (p.length !== 2 || A.rufe.some(r => /anthropic\.com/.test(r.url))) return { ok: false, warum: A.rufe.map(r => r.url).join(', ') };
      const vb = JSON.parse(p[1].init.body);
      const bild = vb.messages && vb.messages[0] && vb.messages[0].content && vb.messages[0].content[0];
      if (!bild || bild.type !== 'image' || bild.source.data !== 'AAAA') return { ok: false, warum: 'Vision-Body ohne Bildblock: ' + JSON.stringify(vb).slice(0, 160) };
      if (getApiConfig().source !== 'global' || getApiConfig().key) return { ok: false, warum: 'getApiConfig: ' + JSON.stringify(getApiConfig()) };
      return { ok: true, info: 'callAI + Vision je 1× Proxy · Bildblock im Body · getApiConfig source global, key leer' };
    }),
  },
  {
    // v33.57: der Fall darueber ruft callAI und callVisionAI DIREKT — und war gruen, waehrend der
    // Scanner jedem Nutzer ohne Schluessel „KI gerade nicht erreichbar" sagte. Ein Fall, der die
    // Funktion direkt ruft, misst die Rechnung, nicht den Draht (v33.43). Dieser geht den Weg davor.
    name: 'Ohne Schluessel im Browser · der WEG DAVOR: der Scanner (analyzeImage) fragt die KI ueber den Proxy statt „KI gerade nicht erreichbar" zu zeigen, der Scan-Chat ebenso — und gsKiVerfuegbar sagt in beide Richtungen die Wahrheit',
    lauf: async () => __seite.evaluate(async () => {
      const A = window.__sk; A.reset({ mode: 'proxy', mem: '' });
      if (typeof gsKiVerfuegbar !== 'function') return { ok: false, warum: 'gsKiVerfuegbar gibt es nicht — der Scanner fragt noch nach einem Schluessel im Browser' };
      // 1 · das Praedikat, beide Richtungen
      const lang = 'sk-ant-' + 'x'.repeat(90);
      const p1 = gsKiVerfuegbar();                                             // Proxy-Modus, kein Schluessel → ja
      localStorage.removeItem('gs_global_api_mode'); const p2 = gsKiVerfuegbar();   // weder noch → nein
      localStorage.setItem('ps_api_key', lang); const p3 = gsKiVerfuegbar();        // persoenlicher Schluessel → ja
      localStorage.removeItem('ps_api_key');
      localStorage.setItem('gs_global_api_mode', 'proxy');
      const echtLog = window.sbIsLoggedIn; window.sbIsLoggedIn = () => false; const p4 = gsKiVerfuegbar(); window.sbIsLoggedIn = echtLog;   // abgemeldet → nein
      if (p1 !== true || p2 !== false || p3 !== true || p4 !== false) return { ok: false, warum: 'gsKiVerfuegbar: proxy ' + p1 + ' · nichts ' + p2 + ' · persoenlich ' + p3 + ' · abgemeldet ' + p4 };
      // 2 · der Scanner. Sperren gestellt wie in scan_check — NUR der Schluessel nicht.
      const c = document.createElement('canvas'); c.width = 160; c.height = 160;
      const g = c.getContext('2d');
      g.fillStyle = '#4a3b2a'; g.fillRect(0, 0, 160, 160);
      g.fillStyle = '#3f9142'; g.beginPath(); g.ellipse(80, 74, 50, 30, -0.5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#1d5c22'; g.lineWidth = 2; for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(10 + i * 12, 150); g.lineTo(60 + i * 8, 20); g.stroke(); }
      const b64 = c.toDataURL('image/jpeg', 0.9).split(',')[1];
      window.stopCamera = () => {}; window.gsScanStatusShow = () => {}; window.gsStopScanStatus = () => {};
      window.gsScanPersistToCloud = () => Promise.resolve(true); window.gsAddToScanHistory = () => {};
      window.gsBuildScanContext = () => ({ month: 'Oktober', season: 'Herbst', monthNum: 10, canton: 'ZH' });
      window._gsScanDHash = async () => 'hash-schluessel-check'; window._gsScanCacheGet = async () => null; window._gsScanCachePut = () => {};
      window.gsQuotaPeek = async () => ({ allowed: true, unlimited: false, used: 0, limit: 15 }); window.gsQuotaConsume = () => {};
      A.text = JSON.stringify({ name: 'Löwenzahn', latin: 'Taraxacum officinale', confidence: 91, edible: true, toxic: false, toxicity: 0, alternatives: [], description: 'x' });
      try { if (typeof switchTab === 'function') switchTab('scanner'); } catch (_) {}
      await analyzeImage(b64, 'image/jpeg');
      const karte = ((document.getElementById('scan-result') || {}).textContent || '').replace(/\s+/g, ' ');
      const scanRufe = A.rufe.filter(r => /\/functions\/v1\/ai-proxy$/.test(r.url));
      if (/KI gerade nicht erreichbar|API-Key wird ben/.test(karte)) return { ok: false, warum: 'der Scanner bricht ab: „' + karte.slice(0, 90).trim() + '…" — Aufrufe an den Proxy: ' + scanRufe.length };
      if (scanRufe.length !== 1) return { ok: false, warum: 'der Scanner hat den Proxy ' + scanRufe.length + '× gerufen statt 1× — Karte: „' + karte.slice(0, 80).trim() + '…"' };
      const sb = JSON.parse(scanRufe[0].init.body);
      const hatBild = JSON.stringify(sb.messages || []).indexOf('"type":"image"') >= 0;
      const kopf = scanRufe[0].init.headers || {};
      if (!hatBild || !/^Bearer /.test(kopf.Authorization || '') || kopf['x-api-key']) return { ok: false, warum: 'Scan-Anfrage: Bild ' + hatBild + ' · Header ' + JSON.stringify(Object.keys(kopf)) };
      if (A.rufe.some(r => /anthropic\.com/.test(r.url))) return { ok: false, warum: 'der Scan ging direkt an Anthropic' };
      if (!/L.wenzahn/.test(karte)) return { ok: false, warum: 'die Antwort steht nicht auf der Karte: „' + karte.slice(0, 80).trim() + '…"' };
      // 3 · der Scan-Chat
      const vorher = A.rufe.length;
      A.text = 'Ja, die jungen Blätter.';
      const inp = document.getElementById('scan-chat-input');
      if (!inp) return { ok: false, warum: '#scan-chat-input fehlt — der Fall stellt den Chat nicht her' };
      inp.value = 'Kann man den essen?';
      await sendScanChat();
      const chatRufe = A.rufe.slice(vorher).filter(r => /\/functions\/v1\/ai-proxy$/.test(r.url));
      if (A.toasts.some(t => /API-Key/.test(t))) return { ok: false, warum: 'der Scan-Chat sagt „' + A.toasts.find(t => /API-Key/.test(t)) + '" und fragt nicht' };
      if (chatRufe.length !== 1) return { ok: false, warum: 'der Scan-Chat hat den Proxy ' + chatRufe.length + '× gerufen statt 1× (Meldungen: ' + JSON.stringify(A.toasts) + ')' };
      const log = ((document.getElementById('scan-chat-log') || {}).textContent || '');
      if (!/jungen Bl.tter/.test(log)) return { ok: false, warum: 'die Antwort steht nicht im Chat' };
      return { ok: true, info: 'gsKiVerfuegbar ja·nein·ja·nein · Scanner 1× Proxy mit Bild, Karte „Löwenzahn" · Scan-Chat 1× Proxy, Antwort im Verlauf' };
    }),
  },
  {
    name: 'Pull legt nichts auf die Platte · alter Server (mit key) → nur Arbeitsspeicher, Altbestand in localStorage wird geraeumt; neuer Server (ohne key) → mode proxy, kein Schluessel; enabled false → alles weg',
    lauf: async () => __seite.evaluate(async (KEY) => {
      const A = window.__sk; A.reset({ mode: null, mem: '' });
      localStorage.setItem('gs_global_api_key', 'sk-ant-alt' + 'b'.repeat(80));
      A.rpc = { enabled: true, key: KEY, provider: 'anthropic' };
      window._gsApiKeyPullPromise = null; await gsPullGlobalApiKey();
      const a = { ls: localStorage.getItem('gs_global_api_key'), mode: localStorage.getItem('gs_global_api_mode'), mem: window._gsGlobalKeyMem === KEY, prov: localStorage.getItem('gs_global_api_provider') };
      A.rpc = { enabled: true, mode: 'proxy', provider: 'anthropic' };
      window._gsApiKeyPullPromise = null; await gsPullGlobalApiKey();
      const b = { ls: localStorage.getItem('gs_global_api_key'), mode: localStorage.getItem('gs_global_api_mode'), mem: window._gsGlobalKeyMem || '' , src: getApiConfig().source };
      A.rpc = { enabled: false, reason: 'not_configured' };
      window._gsApiKeyPullPromise = null; await gsPullGlobalApiKey();
      const c = { ls: localStorage.getItem('gs_global_api_key'), mode: localStorage.getItem('gs_global_api_mode'), mem: window._gsGlobalKeyMem || '', src: getApiConfig().source };
      if (a.ls !== null || a.mode !== 'proxy' || !a.mem || a.prov !== 'anthropic') return { ok: false, warum: 'alter Server: ' + JSON.stringify(a) };
      if (b.ls !== null || b.mode !== 'proxy' || b.mem !== '' || b.src !== 'global') return { ok: false, warum: 'neuer Server: ' + JSON.stringify(b) };
      if (c.ls !== null || c.mode !== null || c.mem !== '' || c.src !== 'none') return { ok: false, warum: 'aus: ' + JSON.stringify(c) };
      return { ok: true, info: 'alt: localStorage leer, mode proxy, Schluessel nur im Speicher · neu: kein Schluessel, source global · aus: nichts' };
    }, KEY),
  },
  {
    name: 'Rueckfall · Proxy schweigt (Netzfehler / 503) UND Schluessel im Speicher → einmal direkt an Anthropic, Ausfall vermerkt; ohne Schluessel → ehrlicher Fehler, kein Direktweg; 429 Quota → KEIN Rueckfall',
    lauf: async () => __seite.evaluate(async (KEY) => {
      const A = window.__sk;
      A.reset({ mode: 'proxy', mem: KEY }); A.proxy = 'netz';
      const t1 = await callAI([{ role: 'user', content: 'p' }], '', 20, { retries: 0, timeout: 3000 });
      const r1 = { t: t1, proxy: A.rufe.filter(r => /ai-proxy$/.test(r.url)).length, direkt: A.rufe.filter(r => /anthropic\.com/.test(r.url)).length, xkey: (A.rufe.find(r => /anthropic\.com/.test(r.url)) || { init: { headers: {} } }).init.headers['x-api-key'] === KEY, down: !!localStorage.getItem('gs_ai_proxy_down_ts') };
      A.reset({ mode: 'proxy', mem: KEY }); A.proxy = 503;
      const t2 = await callAI([{ role: 'user', content: 'p' }], '', 20, { retries: 0, timeout: 3000 });
      const r2 = { t: t2, direkt: A.rufe.filter(r => /anthropic\.com/.test(r.url)).length };
      A.reset({ mode: 'proxy', mem: '' }); A.proxy = 'netz';
      let f3 = null; try { await callAI([{ role: 'user', content: 'p' }], '', 20, { retries: 0, timeout: 3000 }); } catch (e) { f3 = e.message; }
      const r3 = { f: f3, direkt: A.rufe.filter(r => /anthropic\.com/.test(r.url)).length };
      A.reset({ mode: 'proxy', mem: KEY }); A.proxy = 429;
      let f4 = null, c4 = null; try { await callAI([{ role: 'user', content: 'p' }], '', 20, { retries: 0, timeout: 3000 }); } catch (e) { f4 = e.message; c4 = e.code; }
      const r4 = { f: f4, code: c4, direkt: A.rufe.filter(r => /anthropic\.com/.test(r.url)).length };
      if (r1.t !== 'direkt-ok' || r1.proxy !== 1 || r1.direkt !== 1 || !r1.xkey || !r1.down) return { ok: false, warum: 'Netzfehler: ' + JSON.stringify(r1) };
      if (r2.t !== 'direkt-ok' || r2.direkt !== 1) return { ok: false, warum: '503: ' + JSON.stringify(r2) };
      if (!r3.f || !/KI-Server/.test(r3.f) || r3.direkt !== 0) return { ok: false, warum: 'ohne Schluessel: ' + JSON.stringify(r3) };
      if (!r4.f || !/Tageslimit/.test(r4.f) || r4.code !== 'free_quota_reached' || r4.direkt !== 0) return { ok: false, warum: 'Quota: ' + JSON.stringify(r4) };
      return { ok: true, info: 'Netz → 1× Proxy, 1× direkt mit x-api-key, Ausfall vermerkt · 503 → direkt · ohne Schluessel → „KI-Server", 0× direkt · 429 → Tageslimit, free_quota_reached, 0× direkt' };
    }, KEY),
  },
  {
    name: 'Persoenlicher Schluessel · geht direkt an Anthropic (unveraendert), kein Proxy; abgemeldet → Anmelde-Hinweis, kein Aufruf; Notschalter gs_feat_aiproxy=0 → direkt nur mit Schluessel',
    lauf: async () => __seite.evaluate(async (KEY) => {
      const A = window.__sk;
      A.reset({ mode: 'proxy', mem: '' }); localStorage.setItem('ps_api_key', 'sk-ant-pers' + 'c'.repeat(80));
      const t1 = await callAI([{ role: 'user', content: 'p' }], '', 20, { retries: 0, timeout: 3000 });
      const r1 = { t: t1, proxy: A.rufe.filter(r => /ai-proxy$/.test(r.url)).length, direkt: A.rufe.filter(r => /anthropic\.com/.test(r.url)).length };
      localStorage.removeItem('ps_api_key');
      A.reset({ mode: 'proxy', mem: KEY }); window.sbIsLoggedIn = () => false;
      let f2 = null; try { await callAI([{ role: 'user', content: 'p' }], '', 20, { retries: 0, timeout: 3000 }); } catch (e) { f2 = e.message; }
      const r2 = { f: f2, rufe: A.rufe.length }; window.sbIsLoggedIn = () => true;
      A.reset({ mode: 'proxy', mem: KEY }); localStorage.setItem('gs_feat_aiproxy', '0');
      const t3 = await callAI([{ role: 'user', content: 'p' }], '', 20, { retries: 0, timeout: 3000 });
      const r3 = { t: t3, proxy: A.rufe.filter(r => /ai-proxy$/.test(r.url)).length, direkt: A.rufe.filter(r => /anthropic\.com/.test(r.url)).length };
      A.reset({ mode: 'proxy', mem: '' }); localStorage.setItem('gs_feat_aiproxy', '0');
      let f4 = null; try { await callAI([{ role: 'user', content: 'p' }], '', 20, { retries: 0, timeout: 3000 }); } catch (e) { f4 = e.message; }
      localStorage.removeItem('gs_feat_aiproxy');
      if (r1.t !== 'direkt-ok' || r1.proxy || r1.direkt !== 1) return { ok: false, warum: 'persoenlich: ' + JSON.stringify(r1) };
      if (!r2.f || !/einloggen/i.test(r2.f) || r2.rufe) return { ok: false, warum: 'abgemeldet: ' + JSON.stringify(r2) };
      if (r3.t !== 'direkt-ok' || r3.proxy || r3.direkt !== 1) return { ok: false, warum: 'Notschalter: ' + JSON.stringify(r3) };
      if (!f4 || A.rufe.length) return { ok: false, warum: 'Notschalter ohne Schluessel: ' + JSON.stringify({ f4, rufe: A.rufe.length }) };
      return { ok: true, info: 'persoenlich → direkt · abgemeldet → Hinweis, 0 Aufrufe · Notschalter → direkt · Notschalter ohne Schluessel → Fehler' };
    }, KEY),
  },
  {
    name: 'Abmelden raeumt · Schluessel im Speicher und mode werden beim Logout entfernt (gsOnLogout); getApiConfig danach none',
    lauf: async () => __seite.evaluate(async (KEY) => {
      const A = window.__sk; A.reset({ mode: 'proxy', mem: KEY });
      const vorher = getApiConfig().source;
      const echtLogin = window.sbIsLoggedIn;
      try { gsOnLogout(); } catch (e) { return { ok: false, warum: 'gsOnLogout wirft: ' + e.message }; }
      const mem = window._gsGlobalKeyMem || '', mode = localStorage.getItem('gs_global_api_mode');
      window.sbIsLoggedIn = () => false; const nach = getApiConfig().source; window.sbIsLoggedIn = echtLogin;
      if (vorher !== 'global') return { ok: false, warum: 'vorher: ' + vorher };
      if (mem || mode) return { ok: false, warum: 'nach Logout: mem=' + (mem ? 'da' : 'leer') + ' mode=' + mode };
      if (nach !== 'none') return { ok: false, warum: 'getApiConfig nach Logout: ' + nach };
      return { ok: true, info: 'vorher global · Speicher und mode leer · nachher none' };
    }, KEY),
  },
];

(async () => {
  console.log('\n=== schluessel_check — verlaesst der Anthropic-Schluessel den Server?');
  sqlHaelfte();
  let kaputt = 0, offen = 0;
  console.log('  [SQL — fn_get_global_api_key nach 20260907_global_api_key_nur_proxy.sql]');
  for (const s of S) {
    if (s.ok === null) { offen++; console.log('  ??   ' + s.name + '\n         → ' + s.warum); }
    else if (s.ok) console.log('  ok   ' + s.name + (s.info ? '   [' + s.info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + s.name + '\n         → ' + s.warum); }
  }
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 412, height: 915 } });
  const p = await ctx.newPage(); __seite = p;
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await p.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await p.addInitScript(SEED);
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForTimeout(4000);
  await p.evaluate(() => {
    document.documentElement.classList.remove('gs-preauth');
    window.gsRequire = () => true; window.gsToast = (m) => { try { window.__sk.toasts.push(String(m)); } catch (_) {} }; window.showProfileToast = () => {}; window.gsHaptic = () => {};
    window.sbIsLoggedIn = () => true; window.sbGetConfig = () => true;
    window.gsStore = window.gsStore || {}; const echtGet = gsStore.get;
    gsStore.get = (k, d) => (k === 'gs_sb_uid' ? '00000000-0000-0000-0000-000000000001' : k === 'gs_sb_token' ? 'pruefstand-kein-echter-token' : (echtGet ? echtGet.call(gsStore, k, d) : d));
    const A = window.__sk = { rufe: [], proxy: 'ok', rpc: { enabled: true, mode: 'proxy', provider: 'anthropic' } };
    const antwort = (status, body) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body, text: async () => JSON.stringify(body) });
    window.fetch = async (url, init) => {
      A.rufe.push({ url: String(url), init: init || {} });
      if (/\/functions\/v1\/ai-proxy$/.test(String(url))) {
        if (A.proxy === 'netz') throw new TypeError('Failed to fetch');
        if (A.proxy === 503) return antwort(503, { error: { message: 'Server: Anthropic-Key fehlt.' } });
        if (A.proxy === 429) return antwort(429, { error: { type: 'quota_exceeded', message: 'Tageslimit erreicht (15/15). Upgrade für mehr KI-Calls.', tier: 'free', used: 15, limit: 15 } });
        return antwort(200, { content: [{ type: 'text', text: A.text || 'proxy-ok' }], usage: { input_tokens: 1, output_tokens: 1 }, model: 'claude-sonnet-4-5' });
      }
      if (/api\.anthropic\.com/.test(String(url))) return antwort(200, { content: [{ type: 'text', text: 'direkt-ok' }], usage: { input_tokens: 1, output_tokens: 1 } });
      return antwort(200, {});
    };
    window.sbFetch = async (path, opts) => {
      if (/fn_get_global_api_key/.test(path)) return { data: A.rpc, error: null };
      return { data: [], error: null };
    };
    A.reset = (o) => { A.rufe.length = 0; A.proxy = 'ok'; A.text = ''; A.toasts = [];
      try { localStorage.removeItem('gs_global_api_key'); localStorage.removeItem('ps_api_key'); localStorage.removeItem('gs_feat_aiproxy'); localStorage.removeItem('gs_ai_proxy_down_ts'); } catch (_) {}
      if (o.mode) localStorage.setItem('gs_global_api_mode', o.mode); else localStorage.removeItem('gs_global_api_mode');
      window._gsGlobalKeyMem = o.mem || ''; window._gsApiKeyPullPromise = null; window._gsProxyDownTs = 0; };
  });
  console.log('  [App — Playwright, gestelltes fetch]');
  for (const f of K) {
    let r;
    try { r = await f.lauf(); } catch (e) { r = { ok: false, warum: 'Ausnahme: ' + e.message.split('\n')[0] }; }
    if (r && r.ok) console.log('  ok   ' + f.name + (r.info ? '   [' + r.info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
  }
  await br.close();
  console.log('  ---');
  console.log('  Faelle geprueft: ' + (S.length + K.length) + ' · davon kaputt: ' + kaputt + (offen ? ' · nicht pruefbar: ' + offen : ''));
  console.log('  JS-Fehler waehrend der Pruefung: ' + (errs.length ? errs.length + ' (' + errs.slice(0, 2).join(' | ') + ')' : 'keine'));
  console.log('  Grenze: der echte Proxy laeuft hier nicht — geprueft ist, wohin die App ruft und was sie speichert.');
  process.exitCode = kaputt ? 1 : (offen ? 2 : 0);
})();
