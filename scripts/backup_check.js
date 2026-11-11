#!/usr/bin/env node
/**
 * backup_check.js — ist das Backup da, wenn man es braucht?
 *
 *   node scripts/backup_check.js
 *   bash scripts/_pg_local.sh start      # einmal: Wegwerf-Postgres (Port 54329)
 *
 * Die App sichert den ganzen Nutzerzustand als Snapshot in die Cloud
 * (`user_state_snapshots`, RPC `fn_user_snapshot_create`). Gemessen hat das
 * bis v33.25 niemand — weder die Frage „wann ist eines faellig?" noch die
 * Frage „welches ueberlebt die Aufbewahrung?".
 *
 * ZWEI BEFUNDE, die diesen Pruefstand ausgeloest haben:
 *
 * 1. ZWEI Regeln fuer dieselbe Frage. `auto_daily` ging nach dem Kalendertag
 *    (UTC gerechnet), `auto_periodic` nach reiner Zeit (> 3 h) — und keine
 *    fragte, ob sich etwas GEAENDERT hat. Wer die App offen liess, bekam alle
 *    drei Stunden eine Kopie desselben Zustands; wer kuerzer als fuenf Minuten
 *    da war, bekam gar nichts (der Takt ist ein 5-Minuten-Intervall).
 *    Seit v33.26 gibt es EINE Regel: `_gsSnapshotAutoFaellig()`.
 *
 * 2. `manual` war in der Aufbewahrung NICHT geschuetzt. `fn_cleanup_user_snapshots`
 *    (v29_28) haelt die 6 neuesten plus den je neuesten pre_migration /
 *    auto_daily / pre_logout — ausgerechnet der Stand, den eine Person selbst
 *    angelegt hat, fehlt in der Liste. Mit „Update ohne Klick" (v33.25)
 *    entsteht je Auslieferung ein pre_migration; am 10.09.2026 waren das 14 an
 *    einem Tag. Die Migration `20260912_snapshot_retention_manual.sql` schliesst
 *    das — sie ist NICHT angewandt, und dieser Pruefstand rechnet sie nach.
 *
 * ZWEI HAELFTEN:
 *   SQL  — lokales Postgres: die Aufbewahrung wirklich ausfuehren, mit
 *          Reproduktion (alte Fassung frisst das manual) und Gegenprobe.
 *          Ohne Postgres: „nicht pruefbar" (Exit 2), nie gruen.
 *   App  — Playwright mit gestellter Uhr UND gestellter Zeitzone: die eine
 *          Regel in fuenf Zustaenden, das Backup dieser Sitzung nach dem
 *          ersten erfolgreichen Pull, und der Tagesstempel, der nur nach einem
 *          BELEGTEN Snapshot gesetzt wird.
 *
 * GRENZE: das lokale Postgres hat keine RLS und kein auth.users. Geprueft ist
 * die RECHNUNG der Aufbewahrung und die Entscheidung der App — nicht, ob die
 * Live-Datenbank die Zeile annimmt.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const SEED = require('./_seed.js');

const WURZEL = path.join(__dirname, '..');
const MIG = (n) => path.join(WURZEL, 'supabase', 'migrations', n);
const URL0 = process.env.GS_PG_URL || 'postgresql://postgres@127.0.0.1:54329/postgres';
const DBN = 'gs_backup_check';

function psql(url, args) { return spawnSync('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-F', '\t', ...args], { encoding: 'utf8' }); }
// Die LETZTE Zeile eines psql-Fehlers ist oft nur das Caret („^") — eine
// Meldung, aus der niemand etwas ablesen kann. Genommen wird die Zeile mit
// ERROR/FEHLER, sonst die erste nicht leere.
function letzte(r) {
  const z = String((r.stderr || r.stdout || '')).trim().split('\n').map(x => x.trim()).filter(Boolean);
  return (z.find(x => /^(ERROR|FEHLER|DETAIL|HINT)/i.test(x)) || z[0] || '').slice(0, 200);
}
function sql(url, q) { const r = psql(url, ['-c', q]); if (r.status !== 0) throw new Error(letzte(r)); return (r.stdout || '').trim(); }
function sqlFile(url, f) { const r = psql(url, ['-f', f]); if (r.status !== 0) throw new Error(path.basename(f) + ': ' + letzte(r)); }

const U1 = '22222222-2222-4222-8222-000000000001';

// Die Tabelle wie live (v27_01 + v29_28-CHECK), ohne auth.users-FK und ohne RLS.
const FIXTURE = `
create table public.user_state_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  taken_at timestamptz not null default now(),
  trigger_reason text not null default 'manual'
    check (trigger_reason in ('auto_daily','auto_periodic','pre_migration','manual','pre_logout')),
  state jsonb not null,
  size_bytes int generated always as (octet_length(state::text)) stored,
  unique (user_id, taken_at)
);
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
`;

// Die Aufbewahrung VOR v33.26 — woertlich die Fassung aus v29_28 (dort steht
// sie zwischen anderen Anweisungen, die eine auth.users-FK brauchen; deshalb
// hier die Funktion allein, Zeile fuer Zeile identisch).
const ALT = `
create or replace function public.fn_cleanup_user_snapshots()
returns integer language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare v_deleted int := 0;
begin
  with ranked as (
    select id,
           row_number() over (partition by user_id order by taken_at desc) as rn,
           row_number() over (partition by user_id, trigger_reason order by taken_at desc) as rn_trig,
           trigger_reason
    from public.user_state_snapshots
  ),
  keep as (
    select id from ranked
    where rn <= 6
       or (trigger_reason in ('pre_migration','auto_daily','pre_logout') and rn_trig = 1)
  ),
  del as (
    delete from public.user_state_snapshots
    where id not in (select id from keep)
    returning id
  )
  select count(*)::int into v_deleted from del;
  return v_deleted;
end $function$;
`;

// Ein Nachmittag mit „Update ohne Klick": ein bewusstes Backup um 08:00, danach
// zehn Auslieferungen. Genau der Tag, den v33.25 moeglich macht.
function tagNachspielen(url) {
  sql(url, `delete from public.user_state_snapshots`);
  sql(url, `insert into public.user_state_snapshots (user_id, taken_at, trigger_reason, state)
            values ('${U1}', timestamptz '2026-09-10 08:00:00+02', 'manual', '{"a":1,"b":2}'::jsonb)`);
  sql(url, `insert into public.user_state_snapshots (user_id, taken_at, trigger_reason, state)
            select '${U1}', timestamptz '2026-09-10 09:00:00+02' + (i || ' minutes')::interval, 'pre_migration', '{"a":1,"b":2}'::jsonb
            from generate_series(1, 10) i`);
}
const zahlManual = (url) => Number(sql(url, `select count(*) from public.user_state_snapshots where trigger_reason = 'manual'`));

const S = [];
function fallS(name, fn) { try { S.push(Object.assign({ name }, fn())); } catch (e) { S.push({ name, ok: false, warum: 'Ausnahme: ' + String(e.message).split('\n')[0] }); } }

function sqlHaelfte() {
  try { sql(URL0, 'select 1'); }
  catch (e) {
    S.push({ name: 'Lokales Postgres', ok: null, warum: 'nicht erreichbar unter ' + URL0.replace(/\/\/.*@/, '//…@') + ' — `bash scripts/_pg_local.sh start` (' + String(e.message).split('\n')[0] + ')' });
    return;
  }
  sql(URL0, `drop database if exists ${DBN}`);
  sql(URL0, `create database ${DBN}`);
  const url = URL0.replace(/\/[^/]*$/, '/' + DBN);
  sql(url, FIXTURE);
  sql(url, ALT);

  // 1 · REPRODUKTION. Ohne sie misst der Rest nichts.
  fallS('Reproduktion · die Aufbewahrung VOR v33.26 loescht das bewusste Backup (ein manual, danach zehn Auslieferungen)', () => {
    tagNachspielen(url);
    const vorher = zahlManual(url);
    const geloescht = Number(sql(url, `select public.fn_cleanup_user_snapshots()`));
    const nachher = zahlManual(url);
    const preMig = Number(sql(url, `select count(*) from public.user_state_snapshots where trigger_reason = 'pre_migration'`));
    return (vorher === 1 && nachher === 0)
      ? { ok: true, info: '1 manual + 10 pre_migration → ' + geloescht + ' geloescht, manual weg, ' + preMig + ' pre_migration uebrig (6 neueste + der je neueste)' }
      : { ok: false, warum: 'manual vorher ' + vorher + ', nachher ' + nachher + ' — die alte Fassung loescht es NICHT, dann prueft der Rest nichts' };
  });

  // 2 · Die Migration rechnet es weg.
  fallS('20260912_snapshot_retention_manual.sql: derselbe Tag, und das bewusste Backup bleibt', () => {
    sqlFile(url, MIG('20260912_snapshot_retention_manual.sql'));
    tagNachspielen(url);
    const geloescht = Number(sql(url, `select public.fn_cleanup_user_snapshots()`));
    const m = zahlManual(url);
    const wann = sql(url, `select to_char(max(taken_at) at time zone 'Europe/Zurich', 'HH24:MI') from public.user_state_snapshots where trigger_reason = 'manual'`);
    return (m === 1)
      ? { ok: true, info: geloescht + ' geloescht · manual bleibt (' + wann + ' Uhr) · ' + Number(sql(url, `select count(*) from public.user_state_snapshots`)) + ' Staende gesamt' }
      : { ok: false, warum: 'manual nach der Migration: ' + m + ' (erwartet 1)' };
  });

  // 3 · Die anderen vier Typen bleiben ebenfalls je einmal — die Migration
  //     nimmt nichts weg, sie legt nur einen fuenften Schutz dazu.
  fallS('Von jedem Anlass ueberlebt der neueste — auch bei vierzig Staenden', () => {
    sql(url, `delete from public.user_state_snapshots`);
    sql(url, `insert into public.user_state_snapshots (user_id, taken_at, trigger_reason, state)
              select '${U1}', timestamptz '2026-09-01 06:00:00+02' + (i || ' minutes')::interval,
                     (array['auto_daily','auto_periodic','pre_migration','manual','pre_logout'])[1 + (i % 5)],
                     '{"a":1,"b":2}'::jsonb
              from generate_series(1, 40) i`);
    sql(url, `select public.fn_cleanup_user_snapshots()`);
    const typen = sql(url, `select trigger_reason || ':' || count(*) from public.user_state_snapshots group by trigger_reason order by 1`).split('\n').filter(Boolean);
    const fehlend = ['auto_daily', 'auto_periodic', 'manual', 'pre_logout', 'pre_migration'].filter(t => !typen.some(z => z.indexOf(t + ':') === 0));
    return (fehlend.length === 0)
      ? { ok: true, info: typen.join(' · ') + ' — jeder Anlass noch vertreten' }
      : { ok: false, warum: 'kein Stand mehr fuer: ' + fehlend.join(', ') + ' (uebrig: ' + typen.join(' · ') + ')' };
  });

  // 4 · Idempotenz: zweimal anwenden aendert nichts.
  fallS('Idempotenz: die Migration zweimal einspielen, die Aufbewahrung zweimal laufen lassen', () => {
    sqlFile(url, MIG('20260912_snapshot_retention_manual.sql'));
    tagNachspielen(url);
    const a = Number(sql(url, `select public.fn_cleanup_user_snapshots()`));
    const b = Number(sql(url, `select public.fn_cleanup_user_snapshots()`));
    const m = zahlManual(url);
    return (b === 0 && m === 1)
      ? { ok: true, info: 'erster Lauf loescht ' + a + ', zweiter ' + b + ' · manual steht' }
      : { ok: false, warum: 'zweiter Lauf loescht ' + b + ' (erwartet 0), manual ' + m };
  });

  // 5 · GEGENPROBE: die alte Fassung wieder einspielen → derselbe Tag frisst
  //     das manual erneut. Ohne sie waere Fall 2 auch dann gruen, wenn die
  //     Migration gar nichts aendert.
  fallS('Gegenprobe: alte Fassung erneut → das bewusste Backup ist wieder weg; Migration erneut → wieder da', () => {
    sql(url, ALT);
    tagNachspielen(url);
    sql(url, `select public.fn_cleanup_user_snapshots()`);
    const ohne = zahlManual(url);
    sqlFile(url, MIG('20260912_snapshot_retention_manual.sql'));
    tagNachspielen(url);
    sql(url, `select public.fn_cleanup_user_snapshots()`);
    const mit = zahlManual(url);
    return (ohne === 0 && mit === 1)
      ? { ok: true, info: 'ohne Migration 0 · mit Migration 1' }
      : { ok: false, warum: 'ohne Migration ' + ohne + ' (erwartet 0), mit Migration ' + mit + ' (erwartet 1)' };
  });
}

// ── App-Haelfte ───────────────────────────────────────────────────────────
// Uhr UND Zeitzone gestellt: 11.09.2026 22:30 UTC ist in Auckland bereits der
// 12.09. — nur so laesst sich messen, dass der Tagesstempel der LOKALE ist.
const UHR = new Date('2026-09-11T22:30:00Z');
const K = [];
const kaputtHelfer = (r) => (r && r.ok) ? null : ((r && r.warum) || 'unbekannt');

(async () => {
  console.log('\n=== backup_check — ist das Backup da, wenn man es braucht?');
  let kaputt = 0, offen = 0;

  console.log('  [Aufbewahrung — lokales Postgres]');
  sqlHaelfte();
  for (const f of S) {
    if (f.ok === null) { offen++; console.log('  ??   ' + f.name + '\n         → ' + f.warum); continue; }
    if (f.ok) console.log('  ok   ' + f.name + (f.info ? '   [' + f.info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + f.warum); }
  }

  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 412, height: 915 }, timezoneId: 'Pacific/Auckland' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await page.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.clock.setFixedTime(UHR);          // VOR addInitScript (CLAUDE.md §7.1)
  await page.addInitScript(SEED);
  await page.goto('file://' + path.join(WURZEL, 'index.html'), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3000);

  // Die Regel in fuenf Zustaenden — jeder Zustand wird HERGESTELLT.
  const regel = await page.evaluate(() => {
    const setz = (snapLast, autoDay, push) => {
      ['gs_snapshot_last', 'gs_snapshot_auto_day', 'gs_sync_last_push'].forEach(k => localStorage.removeItem(k));
      if (snapLast) localStorage.setItem('gs_snapshot_last', snapLast);
      if (autoDay) localStorage.setItem('gs_snapshot_auto_day', autoDay);
      if (push) localStorage.setItem('gs_sync_last_push', push);
    };
    const jetzt = Date.now();
    const iso = (msVorher) => new Date(jetzt - msVorher).toISOString();
    const lokal = (typeof _gsDayKey === 'function') ? _gsDayKey() : null;
    const utc = new Date(jetzt).toISOString().slice(0, 10);
    const out = {};
    setz(null, null, null);                                            out.ohneBackup = _gsSnapshotAutoFaellig();
    // Vier Stunden altes Backup, Tagesstempel heute, letzter Push NOCH aelter:
    // ohne die Aenderungs-Stufe wuerde Schritt 4 („aelter als drei Stunden")
    // greifen — nur sie kann diesen Zustand erklaeren. (Der erste Anlauf setzte
    // hier ein 60 s altes Backup; dann entschied ohnehin „frisch", und die
    // Gegenprobe mit ausgebauter Stufe blieb gruen.)
    setz(iso(4 * 3600 * 1000), lokal, iso(5 * 3600 * 1000));           out.ohneAenderung = _gsSnapshotAutoFaellig();
    setz(iso(60 * 1000), utc, iso(30 * 1000));                         out.neuerTag = _gsSnapshotAutoFaellig();
    setz(iso(4 * 3600 * 1000), lokal, iso(30 * 1000));                 out.alt = _gsSnapshotAutoFaellig();
    setz(iso(60 * 1000), lokal, iso(30 * 1000));                       out.frisch = _gsSnapshotAutoFaellig();
    return { out, lokal, utc };
  });
  K.push({
    name: 'Eine Regel, fuenf Zustaende: kein Backup · keine Aenderung · neuer (LOKALER) Tag · aelter als drei Stunden · frisch — und jeder nennt seinen Grund',
    r: (() => {
      const o = regel.out;
      const soll = [
        ['ohneBackup', true, 'auto_daily'],
        ['ohneAenderung', false, null],
        ['neuerTag', true, 'auto_daily'],
        ['alt', true, 'auto_periodic'],
        ['frisch', false, null],
      ];
      const rot = soll.filter(([k, f, t]) => !o[k] || o[k].faellig !== f || o[k].trigger !== t)
        .map(([k, f, t]) => k + ' → ' + JSON.stringify(o[k]) + ' (erwartet faellig=' + f + ', trigger=' + t + ')');
      const ohneGrund = Object.keys(o).filter(k => !o[k] || !String(o[k].grund || '').trim());
      if (o.ohneAenderung && String(o.ohneAenderung.grund).indexOf('Aenderung') < 0) return { ok: false, warum: 'der Zustand „keine Aenderung" wird mit einem anderen Grund abgelehnt: „' + o.ohneAenderung.grund + '" — dann misst der Fall diese Stufe nicht' };
      if (regel.lokal === regel.utc) return { ok: false, warum: 'lokaler Tag und UTC-Tag sind gleich (' + regel.lokal + ') — der Fall „neuer Tag" prueft dann nicht, dass der LOKALE zaehlt' };
      if (ohneGrund.length) return { ok: false, warum: 'ohne Grund: ' + ohneGrund.join(', ') };
      return rot.length ? { ok: false, warum: rot.join(' · ') }
        : { ok: true, info: 'lokal ' + regel.lokal + ' vs UTC ' + regel.utc + ' · ' + soll.map(([k]) => k + ': ' + (o[k].faellig ? o[k].trigger : 'nein')).join(' · ') };
    })(),
  });

  // Das Backup DIESER Sitzung: nach dem ersten erfolgreichen Pull, genau eines.
  const sitzung = await page.evaluate(async () => {
    const bis = new Date(Date.now() + 3600 * 1000).toISOString();
    localStorage.setItem('gs_sb_token', 'x.y.z');
    localStorage.setItem('gs_sb_uid', 'nutzer-backup');
    localStorage.setItem('gs_sb_expires_at', bis);
    window.sbIsLoggedIn = () => true;
    window.gsRequire = () => true;
    ['gs_snapshot_last', 'gs_snapshot_auto_day'].forEach(k => localStorage.removeItem(k));
    localStorage.setItem('gs_sync_last_push', new Date().toISOString());

    const rufe = [];
    window.gsSnapshotCreate = async function (trigger) { rufe.push(trigger); localStorage.setItem('gs_snapshot_last', new Date().toISOString()); return 'snap-' + rufe.length; };
    window.sbFetch = async function () { return { data: [], error: null, status: 200 }; };
    window._gsInitialSyncDone = false;
    await gsSyncUserDataOnLogin();
    await new Promise(r => setTimeout(r, 600));
    const nachPull = rufe.slice();
    const tag = localStorage.getItem('gs_snapshot_auto_day');
    // Zweiter Anlauf am selben Tag, ohne neue Aenderung: darf nichts tun.
    // Das Backup wird dafuer auf vor vier Stunden zurueckdatiert (sonst lehnt
    // die Regel es ohnehin als „frisch" ab, und die Kopie-Sperre bliebe
    // ungemessen); der letzte Push liegt NOCH davor.
    localStorage.setItem('gs_snapshot_last', new Date(Date.now() - 4 * 3600 * 1000).toISOString());
    localStorage.setItem('gs_sync_last_push', new Date(Date.now() - 5 * 3600 * 1000).toISOString());
    await _gsSnapshotAuto('takt');
    const nachTakt = rufe.slice();
    return { nachPull, nachTakt, tag, heute: (typeof _gsDayKey === 'function') ? _gsDayKey() : null, gemerkt: window._gsSnapshotZuletztGeprueft || null };
  });
  K.push({
    name: 'Das Backup dieser Sitzung laeuft direkt nach dem ersten erfolgreichen Pull — genau eines, als auto_daily, mit dem LOKALEN Tagesstempel; der Takt danach legt keine Kopie nach',
    r: (sitzung.nachPull.length === 1 && sitzung.nachPull[0] === 'auto_daily'
        && sitzung.tag === sitzung.heute && sitzung.nachTakt.length === 1)
      ? { ok: true, info: 'nach dem Pull: ' + JSON.stringify(sitzung.nachPull) + ' · Stempel ' + sitzung.tag + ' · nach dem Takt unveraendert (' + (sitzung.gemerkt ? sitzung.gemerkt.grund : '?') + ')' }
      : { ok: false, warum: 'nach dem Pull ' + JSON.stringify(sitzung.nachPull) + ' (erwartet ["auto_daily"]) · Stempel ' + sitzung.tag + ' (erwartet ' + sitzung.heute + ') · nach dem Takt ' + JSON.stringify(sitzung.nachTakt) },
  });

  // Der Tagesstempel haengt am BELEGTEN Snapshot — sonst faellt das Tages-Backup
  // aus, ohne dass eines existiert (die Klasse aus v32.40: Erfolg ohne Beleg).
  const stempel = await page.evaluate(async () => {
    ['gs_snapshot_last', 'gs_snapshot_auto_day'].forEach(k => localStorage.removeItem(k));
    localStorage.setItem('gs_snapshot_auto_day', '2000-01-01');
    localStorage.setItem('gs_sync_last_push', new Date().toISOString());
    localStorage.setItem('gs_snapshot_last', new Date(Date.now() - 86400000).toISOString());
    let versuche = 0;
    window.gsSnapshotCreate = async function () { versuche++; return null; };   // Server sagt 0 Zeilen
    const id = await _gsSnapshotAuto('stempel');
    return { versuche, id, stempel: localStorage.getItem('gs_snapshot_auto_day') };
  });
  K.push({
    name: 'Sagt der Server Nein (0 Zeilen), bleibt der Tagesstempel alt — beim naechsten Versuch wird es erneut probiert',
    r: (stempel.versuche === 1 && stempel.id === null && stempel.stempel === '2000-01-01')
      ? { ok: true, info: '1 Versuch · Rueckgabe null · Stempel unveraendert (2000-01-01)' }
      : { ok: false, warum: JSON.stringify(stempel) + ' — erwartet {versuche:1, id:null, stempel:"2000-01-01"}' },
  });

  // Und der Update-Weg (v33.25) fragt dieselbe zweite Stufe: ohne Aenderung
  // kein pre_migration. Gemessen am echten _gsUpdateSichern.
  const update = await page.evaluate(async () => {
    const rufe = [];
    window.gsSnapshotCreate = async function (t) { rufe.push(t); return 'x'; };
    window.sbIsLoggedIn = () => true;
    const jetzt = Date.now();
    // (a) nichts gepusht seit dem letzten Backup
    localStorage.setItem('gs_snapshot_last', new Date(jetzt - 60000).toISOString());
    localStorage.setItem('gs_sync_last_push', new Date(jetzt - 120000).toISOString());
    await _gsUpdateSichern();
    const ohne = rufe.slice();
    // (b) seither gepusht
    localStorage.setItem('gs_sync_last_push', new Date(jetzt).toISOString());
    await _gsUpdateSichern();
    return { ohne, mit: rufe.slice() };
  });
  K.push({
    name: 'Update ohne Klick (v33.25) sichert nur, wenn es etwas zu sichern gibt — ohne Aenderung kein pre_migration',
    r: (update.ohne.length === 0 && update.mit.length === 1 && update.mit[0] === 'pre_migration')
      ? { ok: true, info: 'ohne Aenderung 0 Snapshots · mit Aenderung 1× pre_migration' }
      : { ok: false, warum: 'ohne ' + JSON.stringify(update.ohne) + ' · mit ' + JSON.stringify(update.mit) },
  });

  // ── v33.59: der Banner „Daten wiederherstellen?" ─────────────────────────
  // Gemeldet am 10.11.2026 mit Bildschirmfoto: er stand bei JEDEM Start da.
  // Die Bedingung fragte nur, ob lokal irgendeine snapshot-exklusive Domaene
  // leer ist — der Normalzustand. Der Server ist gestellt (Liste + neuester
  // Snapshot), jede Anfrage wird gezaehlt; jeder Zustand wird HERGESTELLT.
  const banner = await page.evaluate(async () => {
    window.sbIsLoggedIn = () => true;
    localStorage.setItem('gs_sb_uid', 'nutzer-backup');
    const EXKL = ['gs_soil_profile','gs_pp_garden_location','gs_scan_corrections','gs_purchases','gs_my_bids','gs_action_counts',
                  'gs_market_ratings','gs_market_reported','gs_recipes','gs_remedies','gs_prefs','gs_reminder_prefs'];
    let snap = null, snapId = 's1', zaehl = { liste: 0, latest: 0 };
    window.sbFetch = async function (pfad) {
      if (String(pfad).indexOf('fn_user_snapshots_list') >= 0) { zaehl.liste++; return { data: snap ? [{ id: snapId, taken_at: '2026-09-11T20:00:00Z' }] : [], error: null, status: 200 }; }
      if (String(pfad).indexOf('fn_user_snapshot_latest') >= 0) { zaehl.latest++; return { data: snap, error: null, status: 200 }; }
      return { data: [], error: null, status: 200 };
    };
    const frisch = () => {
      EXKL.concat(['gs_restore_geprueft', 'gs_restore_abgelehnt', 'gs_snapshot_had']).forEach(k => localStorage.removeItem(k));
      const b = document.getElementById('gs-restore-banner'); if (b) b.remove();
      zaehl = { liste: 0, latest: 0 };
    };
    const da = () => !!document.getElementById('gs-restore-banner');
    const text = () => { const b = document.getElementById('gs-restore-banner'); return b ? b.innerText.replace(/\s+/g, ' ').trim() : ''; };
    const pflanzen = JSON.parse(localStorage.getItem('ps_myplants') || '[]').length;
    const out = { pflanzen };

    // W1 · der gemeldete Fall: Pflanzen da, exklusive Domaenen leer — und das Backup hat dort AUCH nichts.
    frisch(); snap = { plants: [{ id: 1 }], soil_profile: null, purchases: [], prefs: {} };
    const z1 = await gsSnapshotMaybeOfferRestore();
    out.w1 = { da: da(), z: z1, zaehl: Object.assign({}, zaehl) };
    // … und beim NAECHSTEN Start kostet dieselbe Frage keinen ganzen Snapshot mehr.
    await gsSnapshotMaybeOfferRestore();
    out.w1b = { da: da(), zaehl: Object.assign({}, zaehl) };

    // W2 · das Backup haelt ein Bodenprofil und eigene Rezepte, lokal sind beide leer.
    frisch(); snapId = 's2'; snap = { plants: [{ id: 1 }], soil_profile: { ph: 6.5 }, user_recipes: [{ id: 'r1', name: 'Test' }] };
    const z2 = await gsSnapshotMaybeOfferRestore();
    out.w2 = { da: da(), z: z2, text: text(),
               knoepfe: Array.from(document.querySelectorAll('#gs-restore-banner button')).map(b => ({ t: b.innerText.trim(), h: Math.round(b.getBoundingClientRect().height) })) };

    // W3 · „Nicht nötig" gilt — auch beim naechsten Start und bei einem NEUEN Snapshot.
    document.getElementById('gs-restore-x').click();
    out.w3 = { nachKlick: da(), abg: localStorage.getItem('gs_restore_abgelehnt') };
    await gsSnapshotMaybeOfferRestore(); out.w3.wieder = da(); out.w3.grund = (window._gsRestoreAngebot || {}).grund;
    snapId = 's3'; await gsSnapshotMaybeOfferRestore(); out.w3.neuerSnap = da();
    // … und haelt die automatischen Backups nicht mehr an.
    out.w3.haeltAn = await _gsSnapshotWouldLoseData();

    // W4 · fehlt spaeter etwas ANDERES, kommt das Angebot wieder — und nennt nur das Neue.
    snapId = 's4'; snap = Object.assign({}, snap, { purchases: [{ id: 'k1' }] });
    const z4 = await gsSnapshotMaybeOfferRestore();
    out.w4 = { da: da(), text: text(), fehlt: z4 && z4.fehlt };
    out.w4.haeltAn = await _gsSnapshotWouldLoseData();

    // W5 · „Wiederherstellen" fuellt, der Banner geht, und er kommt nicht wieder.
    frisch(); snapId = 's5'; snap = { plants: [{ id: 1 }], soil_profile: { ph: 6.5 } };
    await gsSnapshotMaybeOfferRestore();
    const vor = da();
    document.getElementById('gs-restore-btn').click();
    await new Promise(r => setTimeout(r, 400));
    out.w5 = { vor, nach: da(), wert: localStorage.getItem('gs_soil_profile') };
    await gsSnapshotMaybeOfferRestore(); out.w5.wieder = da(); out.w5.grund = (window._gsRestoreAngebot || {}).grund;

    // W6 · drei Neins, jedes mit Grund: kein Backup · Liste nicht erreichbar · Backup nicht lesbar.
    frisch(); snap = null; const k = await gsSnapshotMaybeOfferRestore();
    frisch(); const alt = window.sbFetch; window.sbFetch = async () => ({ data: null, error: { message: 'netz' } });
    const n = await gsSnapshotMaybeOfferRestore(); const nMemo = localStorage.getItem('gs_restore_geprueft');
    window.sbFetch = async (pfad) => String(pfad).indexOf('list') >= 0 ? { data: [{ id: 's6' }], error: null } : { data: null, error: { message: 'kaputt' } };
    const u = await gsSnapshotMaybeOfferRestore(); const uMemo = localStorage.getItem('gs_restore_geprueft');
    window.sbFetch = alt;
    out.w6 = { k, n, u, nMemo, uMemo, da: da() };
    frisch();
    return out;
  });
  const _grund = z => (z && z.grund) || '(kein Grund)';
  K.push({
    name: 'W1 · Banner: Pflanzen da, exklusive Bereiche leer, das Backup hat dort AUCH nichts → KEIN Banner (der gemeldete Fall), mit Grund — und der naechste Start holt den Snapshot nicht noch einmal',
    r: (banner.pflanzen > 0 && !banner.w1.da && banner.w1.z && banner.w1.z.zeigen === false && /nichts, was hier fehlt/.test(_grund(banner.w1.z))
        && banner.w1.zaehl.latest === 1 && !banner.w1b.da && banner.w1b.zaehl.latest === 1 && banner.w1b.zaehl.liste === 2)
      ? { ok: true, info: banner.pflanzen + ' Pflanzen · „' + _grund(banner.w1.z) + '" · Snapshot 1× geholt, beim zweiten Start nur die Liste' }
      : { ok: false, warum: 'Banner ' + (banner.w1.da ? 'STEHT DA' : 'aus') + ' · ' + JSON.stringify(banner.w1.z) + ' · Anfragen ' + JSON.stringify(banner.w1.zaehl) + ' → ' + JSON.stringify(banner.w1b.zaehl) + ' · Pflanzen ' + banner.pflanzen },
  });
  K.push({
    name: 'W2 · Banner: das Backup haelt Bodenprofil und eigene Rezepte, lokal leer → Banner, er NENNT beide, zwei Knoepfe mit mindestens 44 px',
    r: (banner.w2.da && /Bodenprofil/.test(banner.w2.text) && /eigene Rezepte/.test(banner.w2.text) && /nicht überschrieben/.test(banner.w2.text)
        && banner.w2.knoepfe.length === 2 && banner.w2.knoepfe.every(b => b.h >= 44))
      ? { ok: true, info: '„' + banner.w2.text.slice(0, 110) + '…" · ' + banner.w2.knoepfe.map(b => b.t + ' ' + b.h + 'px').join(' · ') }
      : { ok: false, warum: JSON.stringify(banner.w2) },
  });
  K.push({
    name: 'W3 · „Nicht nötig" gilt: kein Banner beim naechsten Start, keiner bei einem neuen Snapshot — und die automatischen Backups halten deswegen nicht an',
    r: (!banner.w3.nachKlick && !banner.w3.wieder && !banner.w3.neuerSnap && banner.w3.grund === 'abgelehnt' && banner.w3.haeltAn === false
        && /gs_soil_profile/.test(banner.w3.abg || '') && /gs_recipes/.test(banner.w3.abg || ''))
      ? { ok: true, info: 'gemerkt: ' + banner.w3.abg + ' · Grund „' + banner.w3.grund + '"' }
      : { ok: false, warum: JSON.stringify(banner.w3) },
  });
  K.push({
    name: 'W4 · Fehlt spaeter etwas ANDERES (Käufe), kommt das Angebot wieder und nennt nur das Neue — und haelt das automatische Backup an',
    r: (banner.w4.da && /Käufe/.test(banner.w4.text) && !/Bodenprofil/.test(banner.w4.text) && (banner.w4.fehlt || []).length === 1 && banner.w4.haeltAn === true)
      ? { ok: true, info: '„' + banner.w4.text.slice(0, 90) + '…"' }
      : { ok: false, warum: JSON.stringify(banner.w4) },
  });
  K.push({
    name: 'W5 · „Wiederherstellen" fuellt den Bereich, der Banner geht — und kommt beim naechsten Start nicht wieder',
    r: (banner.w5.vor && !banner.w5.nach && /6\.5/.test(banner.w5.wert || '') && !banner.w5.wieder)
      ? { ok: true, info: 'gs_soil_profile = ' + banner.w5.wert + ' · danach „' + banner.w5.grund + '"' }
      : { ok: false, warum: JSON.stringify(banner.w5) },
  });
  K.push({
    name: 'W6 · Drei Neins, jedes mit eigenem Grund (kein Backup · Liste nicht erreichbar · Backup nicht lesbar) — und ein Fehler wird NICHT als Ergebnis gemerkt',
    r: (() => {
      const g = [banner.w6.k, banner.w6.n, banner.w6.u].map(_grund);
      const ok = !banner.w6.da && [banner.w6.k, banner.w6.n, banner.w6.u].every(z => z && z.zeigen === false)
        && /kein Backup/.test(g[0]) && /nicht erreichbar/.test(g[1]) && /nicht lesbar/.test(g[2]) && !banner.w6.nMemo && !banner.w6.uMemo;
      return ok ? { ok: true, info: g.join(' · ') } : { ok: false, warum: JSON.stringify(banner.w6) };
    })(),
  });

  console.log('  [App — Playwright, gestellte Uhr (11.09.2026 22:30 UTC) und Zeitzone Pacific/Auckland]');
  for (const f of K) {
    const w = kaputtHelfer(f.r);
    if (w) { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + w); }
    else console.log('  ok   ' + f.name + (f.r.info ? '   [' + f.r.info + ']' : ''));
  }

  await br.close();
  console.log('  ---');
  console.log('  Faelle geprueft: ' + (S.length + K.length) + ' · davon kaputt: ' + kaputt + (offen ? ' · nicht pruefbar: ' + offen + ' (Aufbewahrung ohne lokales Postgres)' : ''));
  console.log('  JS-Fehler waehrend der Pruefung: ' + (errs.length ? errs.length + ' (' + errs.slice(0, 2).join(' | ') + ')' : 'keine'));
  console.log('  Grenze: das lokale Postgres hat keine RLS und kein auth.users, und die Migration');
  console.log('  20260912_snapshot_retention_manual.sql ist NICHT angewandt — geprueft ist ihre Rechnung.');
  process.exitCode = (kaputt || errs.length) ? 1 : (offen ? 2 : 0);
})();
