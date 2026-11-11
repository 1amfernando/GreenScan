#!/usr/bin/env node
/**
 * nutzung_check.js — liest jemand, was die Nutzungsmessung schreibt?
 *
 *   bash scripts/_pg_local.sh start      # einmal (SQL-Haelfte)
 *   node scripts/nutzung_check.js
 *
 * Seit v33.11 schreibt gsTrackEvent ein benanntes Vokabular nach
 * analytics_events — Opt-in, gefiltert, ohne Namen. Und niemand las es
 * (nachgemessen 10.09.2026: kein RPC, keine Edge-Function, keine Stelle in der
 * App). Seit v33.18 gibt es die Lese-Seite: fn_admin_analytics(p_days)
 * (Migration 20260910_admin_analytics.sql, NICHT angewandt) und die Karte
 * „Nutzung" im Admin-Panel mit drei Zustaenden.
 *
 * Zwei Haelften, wie schluessel_check:
 *   SQL — die Migration laeuft in einem lokalen Wegwerf-Postgres gegen eine
 *         Fixture mit elf Ereignissen: zaehlt sie richtig, klemmt sie p_days,
 *         sperrt sie Nutzer und Anonyme, ist sie idempotent — und steht KEINE
 *         Kennung in der Antwort? Ohne Postgres: „nicht pruefbar" (Exit 2), nie gruen.
 *   App — gestellter sbFetch: RPC fehlt → die Karte nennt die Migration; leer →
 *         sie sagt, dass die Messung Opt-in ist; Zahlen → jede Zeile steht da.
 *         Und die Karte haengt wirklich im Admin-Panel (Quelltext).
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const MIG = (f) => path.resolve(ROOT, 'supabase', 'migrations', f);
const URL0 = process.env.GS_PG_URL || 'postgresql://postgres@127.0.0.1:54329/postgres';
const DBN = 'gs_nutzung_check';

function psql(url, args) { return spawnSync('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-F', '\t', ...args], { encoding: 'utf8' }); }
function letzte(r) { return (r.stderr || '').trim().split('\n').filter(Boolean).slice(-2).join(' · '); }
function sql(url, q) { const r = psql(url, ['-c', q]); if (r.status !== 0) throw new Error(letzte(r)); return (r.stdout || '').trim(); }
function sqlFile(url, f) { const r = psql(url, ['-f', f]); if (r.status !== 0) throw new Error(path.basename(f) + ': ' + letzte(r)); }

const S = [];
function fallS(name, fn) { try { S.push(Object.assign({ name }, fn())); } catch (e) { S.push({ name, ok: false, warum: 'Ausnahme: ' + String(e.message).split('\n')[0] }); } }

const U = { admin: '11111111-1111-4111-8111-000000000002', u1: '11111111-1111-4111-8111-000000000001', u2: '11111111-1111-4111-8111-000000000004' };
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
create or replace function public.is_admin_user() returns boolean language sql stable security definer set search_path to 'public','pg_temp' as $$
  select coalesce(exists (select 1 from profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    or ((select auth.jwt() ->> 'email') = any (string_to_array(coalesce((select value from app_settings where key='admin_emails'), ''), ','))), false) $$;
insert into public.app_settings values ('admin_emails', 'chef@example.ch');
insert into public.profiles values ('${U.u1}', false, 'user'), ('${U.admin}', true, 'admin'), ('${U.u2}', false, 'user');
-- analytics_events wie live (information_schema.columns, 10.09.2026)
create table public.analytics_events (
  id bigserial primary key, user_id uuid, session_id text, event text not null,
  props jsonb not null default '{}'::jsonb, app_version text, platform text, created_at timestamptz not null default now());
insert into public.analytics_events (user_id, session_id, event, props, app_version, platform, created_at) values
  ('${U.u1}', 's1', 'scan_done', '{"cat":"plant","conf_bucket":"hoch","db_hit":true}', 'v33.18', 'android', now() - interval '2 days'),
  ('${U.u1}', 's1', 'scan_done', '{"cat":"plant","conf_bucket":"mittel","db_hit":true}', 'v33.18', 'android', now() - interval '2 days'),
  ('${U.u1}', 's1', 'scan_done', '{"cat":"pilz","conf_bucket":"tief","db_hit":false}', 'v33.18', 'android', now() - interval '2 days'),
  ('${U.u1}', 's2', 'plan_saved', '{}', 'v33.18', 'android', now() - interval '10 days'),
  ('${U.u2}', 's3', 'scan_done', '{"cat":"plant","conf_bucket":"hoch","db_hit":true}', 'v33.18', 'ios', now() - interval '3 days'),
  ('${U.u2}', 's3', 'quiz_answered', '{"correct":true}', 'v33.18', 'ios', now() - interval '20 days'),
  ('${U.u2}', 's3', 'quiz_answered', '{"correct":false}', 'v33.18', 'ios', now() - interval '20 days'),
  (null, 's4', 'scan_done', '{"cat":"plant","conf_bucket":"hoch","db_hit":true}', 'v33.18', 'web', now() - interval '5 days'),
  ('${U.u1}', 's1', 'consent_changed', '{"analytics":true}', 'v33.18', 'android', now() - interval '12 hours'),
  ('${U.u2}', 's3', 'consent_changed', '{"analytics":false}', 'v33.18', 'ios', now() - interval '25 days'),
  ('${U.u1}', 's0', 'scan_done', '{"cat":"plant","conf_bucket":"hoch","db_hit":true}', 'v33.10', 'android', now() - interval '45 days');
`;
const als = (url, uid, email, q) => sql(url, `set gs.uid = '${uid || ''}'; set gs.email = '${email || ''}'; ${q}`);

function sqlHaelfte() {
  try { sql(URL0, 'select 1'); }
  catch (e) { S.push({ name: 'Lokales Postgres', ok: null, warum: 'nicht erreichbar — `bash scripts/_pg_local.sh start` (' + String(e.message).split('\n')[0] + ')' }); return; }
  sql(URL0, `drop database if exists ${DBN}`); sql(URL0, `create database ${DBN}`);
  const url = URL0.replace(/\/[^/]*$/, '/' + DBN);
  sql(url, FIXTURE);
  sqlFile(url, MIG('20260910_admin_analytics.sql'));
  sqlFile(url, MIG('20260910_analytics_retention.sql'));   // v33.24: die Aufbewahrung
  const admin = (q) => JSON.parse(als(url, U.admin, 'a@example.ch', q));
  fallS('Admin · 30 Tage: 10 Ereignisse, 2 Personen (anonym zaehlt nicht), scan_done zuerst mit 5 (2 Personen), Zustimmung 1 an / 1 aus, Tage summieren sich', () => {
    const r = admin('select public.fn_admin_analytics(30)');
    const klagen = [];
    if (r.days !== 30) klagen.push('days ' + r.days);
    if (r.total !== 10) klagen.push('total ' + r.total + ' statt 10 (das 45 Tage alte zaehlt nicht)');
    if (r.users !== 2) klagen.push('users ' + r.users + ' statt 2');
    const e0 = (r.by_event || [])[0] || {};
    if (e0.event !== 'scan_done' || e0.n !== 5 || e0.users !== 2) klagen.push('erstes Ereignis: ' + JSON.stringify(e0));
    const namen = (r.by_event || []).map(x => x.event).join(',');
    if (namen !== 'scan_done,consent_changed,quiz_answered,plan_saved') klagen.push('Reihenfolge: ' + namen);
    if (r.consent_on !== 1 || r.consent_off !== 1) klagen.push('consent ' + r.consent_on + '/' + r.consent_off);
    const summe = (r.by_day || []).reduce((a, x) => a + x.n, 0);
    if (summe !== r.total || !(r.by_day || []).length) klagen.push('by_day summiert ' + summe + ' statt ' + r.total);
    return klagen.length ? { ok: false, warum: klagen.join(' · ') } : { ok: true, info: 'total 10 · users 2 · ' + namen + ' · consent 1/1 · ' + r.by_day.length + ' Tage' };
  });
  fallS('Fenster · 7 Tage: 6 · p_days 0 → 1 Tag (1) · p_days 1000 → 365 Tage (11, das alte zaehlt) · ohne Argument 30', () => {
    const a = admin('select public.fn_admin_analytics(7)'), b = admin('select public.fn_admin_analytics(0)'), c = admin('select public.fn_admin_analytics(1000)'), d = admin('select public.fn_admin_analytics()');
    const klagen = [];
    if (a.total !== 6) klagen.push('7 Tage: ' + a.total + ' statt 6');
    if (b.days !== 1 || b.total !== 1) klagen.push('0 → days ' + b.days + ', total ' + b.total);
    if (c.days !== 365 || c.total !== 11) klagen.push('1000 → days ' + c.days + ', total ' + c.total);
    if (d.days !== 30 || d.total !== 10) klagen.push('ohne Argument → days ' + d.days + ', total ' + d.total);
    return klagen.length ? { ok: false, warum: klagen.join(' · ') } : { ok: true, info: '7 → 6 · 0 → 1/1 · 1000 → 365/11 · default 30/10' };
  });
  fallS('Keine Kennung in der Antwort — nur Zahlen (keine user_id, keine session_id, keine props ausser dem Zustimmungs-Flag)', () => {
    const txt = als(url, U.admin, 'a@example.ch', 'select public.fn_admin_analytics(365)');
    const treffer = [U.u1, U.u2, U.admin, 's1', 's3', 'conf_bucket', 'db_hit'].filter(k => txt.indexOf(k) >= 0);
    return treffer.length ? { ok: false, warum: 'in der Antwort: ' + treffer.join(', ') } : { ok: true, info: txt.length + ' Zeichen, keine Kennung' };
  });
  fallS('Nutzer → 42501 forbidden · anon darf nicht ausfuehren, authenticated schon', () => {
    let fehler = '';
    try { als(url, U.u1, 'u1@example.ch', 'select public.fn_admin_analytics(30)'); } catch (e) { fehler = String(e.message); }
    const anon = sql(url, `select has_function_privilege('anon', 'public.fn_admin_analytics(integer)', 'execute')`);
    const auth = sql(url, `select has_function_privilege('authenticated', 'public.fn_admin_analytics(integer)', 'execute')`);
    if (!/forbidden/.test(fehler)) return { ok: false, warum: 'Nutzer bekam: ' + (fehler || 'eine Antwort') };
    if (anon !== 'f' || auth !== 't') return { ok: false, warum: 'anon=' + anon + ' authenticated=' + auth };
    return { ok: true, info: 'forbidden · anon f · authenticated t' };
  });
  // v33.24 · Aufbewahrung: was aelter ist als die Frist, verschwindet — der Rest bleibt
  fallS('Aufbewahrung · fn_analytics_prune(180) loescht nur Aelteres, klemmt auf 30..730, nur service_role darf — und die App nennt dieselbe Zahl', () => {
    sql(url, `insert into public.analytics_events (user_id, event, props, created_at) values ('${U.u1}', 'scan_done', '{}', now() - interval '200 days'), ('${U.u2}', 'scan_done', '{}', now() - interval '190 days')`);
    const vorher = +sql(url, 'select count(*) from public.analytics_events');
    const geloescht = +sql(url, 'select public.fn_analytics_prune(180)');
    const nachher = +sql(url, 'select count(*) from public.analytics_events');
    const klagen = [];
    if (vorher !== 13) klagen.push('Fixture: ' + vorher + ' Zeilen statt 13');
    if (geloescht !== 2 || nachher !== 11) klagen.push('prune(180): ' + geloescht + ' geloescht, ' + nachher + ' bleiben (erwartet 2 / 11 — das 45 Tage alte bleibt)');
    // Klemme: 1 Tag → 30 Tage (das 45 Tage alte faellt, die juengeren nicht)
    const g2 = +sql(url, 'select public.fn_analytics_prune(1)');
    const n2 = +sql(url, 'select count(*) from public.analytics_events');
    if (g2 !== 1 || n2 !== 10) klagen.push('prune(1) klemmt nicht auf 30: ' + g2 + ' geloescht, ' + n2 + ' bleiben (erwartet 1 / 10)');
    const anon = sql(url, `select has_function_privilege('anon', 'public.fn_analytics_prune(integer)', 'execute')`);
    const auth = sql(url, `select has_function_privilege('authenticated', 'public.fn_analytics_prune(integer)', 'execute')`);
    if (anon !== 'f' || auth !== 'f') klagen.push('Rechte: anon=' + anon + ' authenticated=' + auth + ' (beide muessen f sein — nur der Cron loescht)');
    // Eine Zahl, zwei Leser: die App nennt dieselbe Frist wie die Migration
    const fs2 = require('fs'), path2 = require('path');
    const mig = fs2.readFileSync(MIG('20260910_analytics_retention.sql'), 'utf8');
    const app = fs2.readFileSync(path2.resolve(ROOT, 'index.html'), 'utf8');
    const mTage = (mig.match(/p_days integer DEFAULT (\d+)/) || [])[1], aTage = (app.match(/var GS_ANALYTICS_TAGE = (\d+);/) || [])[1];
    if (!mTage || !aTage || mTage !== aTage) klagen.push('Frist: Migration ' + mTage + ' Tage, App ' + aTage + ' Tage');
    if (!/'analytics-prune'/.test(mig) || !/pg_cron/.test(mig)) klagen.push('Migration plant keinen Cron (analytics-prune) oder prueft pg_cron nicht');
    return klagen.length ? { ok: false, warum: klagen.join(' · ') } : { ok: true, info: '13 → prune(180) loescht 2 → 11 · prune(1) klemmt auf 30 → 10 · anon f, authenticated f · Frist ' + mTage + ' Tage in Migration und App' };
  });
  fallS('Admin ueber admin_emails · und idempotent (zweiter Lauf der Migration, gleiche Antwort)', () => {
    const vorher = als(url, '', 'chef@example.ch', 'select public.fn_admin_analytics(30)');
    sqlFile(url, MIG('20260910_admin_analytics.sql'));
    const nachher = als(url, '', 'chef@example.ch', 'select public.fn_admin_analytics(30)');
    const a = JSON.parse(vorher), b = JSON.parse(nachher);
    if (a.total !== 10 || b.total !== 10 || JSON.stringify(a.by_event) !== JSON.stringify(b.by_event)) return { ok: false, warum: 'vorher ' + a.total + ' / nachher ' + b.total };
    return { ok: true, info: 'admin_emails darf · zweiter Lauf gleich' };
  });
  try { sql(URL0, `drop database if exists ${DBN}`); } catch (_) {}
}

// ── App-Haelfte ──────────────────────────────────────────────────────────
async function appHaelfte() {
  const K = [];
  const quelle = fs.readFileSync(path.resolve(ROOT, 'index.html'), 'utf8');
  const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
  const SEED = require('./_seed.js');
  const br = await chromium.launch();
  const p = await (await br.newContext({ viewport: { width: 412, height: 915 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await p.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await p.addInitScript(SEED);
  await p.goto('file://' + path.resolve(ROOT, 'index.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForTimeout(3500);
  const r = await p.evaluate(async () => {
    document.documentElement.classList.remove('gs-preauth');
    window.gsIsAdmin = () => true;
    const out = { rufe: [] };
    const div = document.createElement('div'); document.body.appendChild(div);
    const zeig = (a) => { div.innerHTML = _gsAdminAnalyticsHtml(a); return (div.textContent || '').replace(/\s+/g, ' '); };
    // 1 · RPC fehlt (Migration nicht angewandt)
    window.sbFetch = async (pfad, o) => { out.rufe.push({ pfad, body: o && o.body }); return { error: { message: 'Could not find the function public.fn_admin_analytics(p_days) in the schema cache', status: 404 } }; };
    const a1 = await gsAdminFetchAnalytics(30); out.s1 = a1 && a1.state; out.t1 = zeig(a1);
    // 2 · leer
    window.sbFetch = async () => ({ data: { days: 30, total: 0, users: 0, by_event: [], by_day: [], consent_on: 0, consent_off: 0, generated_at: new Date().toISOString() }, error: null });
    const a2 = await gsAdminFetchAnalytics(30); out.s2 = a2 && a2.state; out.t2 = zeig(a2);
    // 3 · Zahlen
    window.sbFetch = async () => ({ data: { days: 30, total: 10, users: 2, by_event: [{ event: 'scan_done', n: 5, users: 2 }, { event: 'consent_changed', n: 2, users: 2 }, { event: 'quiz_answered', n: 2, users: 1 }, { event: 'plan_saved', n: 1, users: 1 }], by_day: [{ day: '2026-09-08', n: 3 }, { day: '2026-09-09', n: 7 }], consent_on: 1, consent_off: 1, generated_at: new Date().toISOString() }, error: null });
    const a3 = await gsAdminFetchAnalytics(30); out.s3 = a3 && a3.state; out.t3 = zeig(a3);
    out.zeilen3 = div.querySelectorAll('tr[data-event]').length;
    // 4 · anderer Fehler (Netz) → „fehler", nicht „nicht verfuegbar"
    window.sbFetch = async () => ({ error: { message: 'Failed to fetch', status: 0 } });
    const a4 = await gsAdminFetchAnalytics(30); out.s4 = a4 && a4.state; out.t4 = zeig(a4);
    // 5 · Fremdtext im Ereignisnamen kommt als Text an
    window.sbFetch = async () => ({ data: { days: 30, total: 1, users: 1, by_event: [{ event: '<img src=x onerror="window.__pwned=1">', n: 1, users: 1 }], by_day: [], consent_on: 0, consent_off: 0 }, error: null });
    const a5 = await gsAdminFetchAnalytics(30); zeig(a5);
    await new Promise(r => setTimeout(r, 300));
    out.pwned = !!window.__pwned; out.t5 = (div.textContent || '');
    div.remove();
    return out;
  });
  await br.close();
  const ok = (name, cond, info) => K.push({ name, ok: !!cond, warum: cond ? '' : info, info: cond ? info : '' });
  ok('RPC fehlt → Zustand „nicht_verfuegbar", die Karte nennt die Migration — und der Aufruf ging an fn_admin_analytics mit p_days',
     r.s1 === 'nicht_verfuegbar' && /nicht verfügbar/i.test(r.t1) && /20260910_admin_analytics\.sql/.test(r.t1) && r.rufe[0] && /rpc\/fn_admin_analytics$/.test(r.rufe[0].pfad) && /"p_days":30/.test(r.rufe[0].body || ''),
     'state=' + r.s1 + ' · ' + r.t1.slice(0, 120) + ' · Aufruf ' + JSON.stringify(r.rufe[0]));
  ok('Leer → die Karte sagt, dass die Messung Opt-in ist (nicht „kaputt")', r.s2 === 'daten' && /Opt-in/i.test(r.t2) && /keine Ereignisse/i.test(r.t2), 'state=' + r.s2 + ' · ' + r.t2.slice(0, 140));
  ok('Zahlen → jede Ereignis-Zeile steht da (4), mit Gesamtzahl, Personen und Zustimmung', r.s3 === 'daten' && r.zeilen3 === 4 && /scan_done/.test(r.t3) && /10 Ereignisse/.test(r.t3) && /2 Personen/.test(r.t3) && /1 an/.test(r.t3), 'state=' + r.s3 + ' · Zeilen ' + r.zeilen3 + ' · ' + r.t3.slice(0, 160));
  ok('Netzfehler → „fehler" (nicht „nicht verfuegbar") mit uebersetztem Satz', r.s4 === 'fehler' && !/Migration/.test(r.t4) && /Verbindung|geladen/i.test(r.t4), 'state=' + r.s4 + ' · ' + r.t4.slice(0, 120));
  ok('Fremdtext im Ereignisnamen kommt als Text an, nicht als Code', !r.pwned && /<img src=x/.test(r.t5), 'pwned=' + r.pwned + ' · ' + r.t5.slice(0, 80));
  ok('Die Karte haengt im Admin-Panel: Abruf im Promise.all, Zuweisung, Einbau nach den Live-Metriken',
     /gsAdminFetchSpeciesProposalQueue\(\),\s*gsAdminFetchAnalytics\(\)/.test(quelle) && /propQueue = _ad\[14\], analytics = _ad\[15\]/.test(quelle) && /_gsAdminMetricsHtml\(metrics\) \+\s*_gsAdminAnalyticsHtml\(analytics\) \+/.test(quelle), '');
  if (errs.length) K.push({ name: 'JS-Fehler waehrend der App-Pruefung', ok: false, warum: errs.slice(0, 2).join(' | ') });
  return K;
}

(async () => {
  console.log('\n=== nutzung_check — liest jemand, was die Nutzungsmessung schreibt?');
  sqlHaelfte();
  let K = [];
  try { K = await appHaelfte(); } catch (e) { K = [{ name: 'App-Haelfte (Playwright)', ok: false, warum: 'Ausnahme: ' + String(e.message || e).split('\n')[0] }]; }
  let kaputt = 0, offen = 0;
  const druck = (f) => {
    if (f.ok === null) { offen++; console.log('  ??   ' + f.name + '\n         → ' + f.warum); }
    else if (f.ok) console.log('  ok   ' + f.name + (f.info ? '   [' + f.info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + (f.warum || 'unbekannt')); }
  };
  console.log('  — SQL (lokales Postgres, Migration 20260910_admin_analytics.sql) —');
  S.forEach(druck);
  console.log('  — App (gestellter sbFetch) —');
  K.forEach(druck);
  console.log('  ---');
  console.log('  Faelle geprueft: ' + (S.length + K.length) + ' · davon kaputt: ' + kaputt + (offen ? ' · nicht pruefbar: ' + offen : ''));
  console.log('  Grenze: die Migration ist NICHT angewandt — ob die Live-Datenbank sie annimmt, zeigt nur Fernando.');
  process.exitCode = kaputt ? 1 : (offen ? 2 : 0);
})();
