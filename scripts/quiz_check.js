#!/usr/bin/env node
// quiz_check.js — zaehlt der Server, was der Spieler richtig hatte?
//
//   bash scripts/_pg_local.sh start      # einmal: Wegwerf-Postgres (Port 54329)
//   node scripts/quiz_check.js
//
// Anlass (07.09.2026, Fernando): „Die Rangliste des taeglichen Quiz sieht
// aus wie die letzten Tage, obwohl ich die Antwort mehrmals richtig hatte."
// Live gemessen: seit v30.95 entscheidet ein Trigger auf quiz_answers ueber
// is_correct — und er kannte EIN Frageformat (Array von Objekten, 5 von 203
// Fragen). 138 Fragen sind {answers,correct}, 60 {choices,correct}: dort
// galt vom 01. bis 07.09. JEDE Antwort als falsch. Der Client zeigte
// derweil „Richtig!" — er kennt alle drei Formate seit v30.32. Zwei Regeln
// fuer dieselbe Frage, nur eine hatte die Formate gelernt.
//
// Zwei Haelften, beide gegen einen guten UND einen schlechten Fall (CLAUDE.md §4b):
//
//   SQL  — spielt die Geschichte in einem lokalen Postgres nach: v30.80
//          (Rangliste aus quiz_answers) → v30.95 (Server-Urteil, der Fehler)
//          → 20260907_quiz_antwort_formate.sql (die Reparatur). Erst wird der
//          Live-Fehler REPRODUZIERT (richtige Antwort im Generator-Format
//          zaehlt als falsch), dann die Reparatur gemessen: Nachrechnen,
//          Rangliste, alle drei Formate, „nicht pruefbar" wird gesagt, der
//          CHECK weist ein viertes Format ab, Idempotenz. Zum Schluss die
//          Gegenprobe: alte Regel wieder eingespielt → der Fall wird rot.
//          Ohne lokales Postgres sagt er „nicht pruefbar" (Exit 2) — nie gruen.
//   App  — Playwright gegen index.html: der DB-Index der gewaehlten Option
//          reist mit (vor dem Mischen gestempelt, alle drei Formate), und
//          seit v32.65 LIEST die App das Urteil des Servers zurueck: Wider-
//          spruch und Nicht-Ankommen stehen sichtbar unter dem Ergebnis.
//
// Grenze: das lokale Postgres hat keine RLS, keine Rollenrechte, kein
// auth.users. Geprueft ist die RECHNUNG der Migration, nicht ihre Anwendung.
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const SEED = require('./_seed.js');

const ROOT = path.resolve(__dirname, '..');
const MIG = (f) => path.join(ROOT, 'supabase', 'migrations', f);
const URL0 = process.env.GS_PG_URL || 'postgresql://postgres@127.0.0.1:54329/postgres';
const DBN = 'gs_quiz_check';
const z = (o) => JSON.stringify(o);

// ── SQL-Helfer (psql, ON_ERROR_STOP) ─────────────────────────────────────
function psql(url, args) { return spawnSync('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-F', '\t', ...args], { encoding: 'utf8' }); }
function letzte(r) { return (r.stderr || '').trim().split('\n').filter(Boolean).slice(-2).join(' · '); }
function sql(url, q) { const r = psql(url, ['-c', q]); if (r.status !== 0) throw new Error(letzte(r)); return (r.stdout || '').trim(); }
function zeilen(url, q) { const s = sql(url, q); return s ? s.split('\n').map(l => l.split('\t')) : []; }
function sqlFile(url, f) { const r = psql(url, ['-f', f]); if (r.status !== 0) throw new Error(path.basename(f) + ': ' + letzte(r)); }
function sqlFehler(url, q) { const r = psql(url, ['-c', q]); return r.status === 0 ? null : letzte(r); }

const U1 = '11111111-1111-4111-8111-000000000001', U2 = '11111111-1111-4111-8111-000000000002';
const U3 = '11111111-1111-4111-8111-000000000003', U4 = '11111111-1111-4111-8111-000000000004';
const QA = 'aaaaaaaa-0000-4000-8000-000000000001';  // Array von Objekten {label,is_correct}  (5 Fragen live)
const QB = 'aaaaaaaa-0000-4000-8000-000000000002';  // {answers:[…], correct:1}               (138 live, Generator)
const QC = 'aaaaaaaa-0000-4000-8000-000000000003';  // {choices:[…], correct:2}               (60 live)
const QL = 'aaaaaaaa-0000-4000-8000-000000000004';  // fuer die Altzeile ohne Index

// Die Fragen sind erfunden — sie tragen keine botanische Aussage, nur ein Format.
const FIXTURE = `
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('gs.uid', true), '')::uuid $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
create table public.profiles (id uuid primary key, display_name text, comp_tier text, comp_expires_at timestamptz, comp_granted_by uuid, comp_granted_at timestamptz);
create table public.system_events (id bigserial primary key, severity text, source text, event text, detail jsonb, created_at timestamptz default now());
create table public.daily_quizzes (id uuid primary key default gen_random_uuid(), day_key date, question text, options jsonb, category text, xp_reward integer, is_active boolean default true, created_at timestamptz default now());
create table public.quiz_answers (id uuid primary key default gen_random_uuid(), user_id uuid not null, username text, quiz_id uuid references public.daily_quizzes(id), selected_option integer, is_correct boolean, time_taken_ms integer, xp_earned integer, answered_on date, created_at timestamptz default now(), unique (user_id, quiz_id));
create table public.quiz_leaderboard (user_id uuid primary key, display_name text, total_correct integer default 0, total_attempts integer default 0, streak_current integer default 0, streak_max integer default 0, last_active_date date, rank_position integer, updated_at timestamptz);
insert into public.profiles (id, display_name) values ('${U1}', 'Eins'), ('${U2}', 'Zwei'), ('${U3}', 'Drei'), ('${U4}', 'Vier');
insert into public.daily_quizzes (id, question, options, xp_reward) values
 ('${QA}', 'Format A', '[{"label":"A0","is_correct":true,"explanation":"x"},{"label":"A1","is_correct":false},{"label":"A2","is_correct":false},{"label":"A3","is_correct":false}]'::jsonb, 15),
 ('${QB}', 'Format B', '{"answers":["B0","B1","B2","B3"],"correct":1,"difficulty":"easy","explanation":"y"}'::jsonb, 10),
 ('${QC}', 'Format C', '{"choices":["C0","C1","C2","C3"],"correct":2,"explanation":"z"}'::jsonb, 20),
 ('${QL}', 'Altfrage',  '{"answers":["L0","L1"],"correct":0}'::jsonb, 10);
`;

const S = [];   // SQL-Faelle: {name, ok, info|warum}
function fallS(name, fn) { try { S.push(Object.assign({ name }, fn())); } catch (e) { S.push({ name, ok: false, warum: 'Ausnahme: ' + String(e.message).split('\n')[0] }); } }
const eins = (url, q) => sql(url, q);
const zahl = (url, q) => Number(sql(url, q));

function sqlHaelfte() {
  let url;
  try { sql(URL0, 'select 1'); }
  catch (e) {
    S.push({ name: 'Lokales Postgres', ok: null, warum: 'nicht erreichbar unter ' + URL0.replace(/\/\/.*@/, '//…@') + ' — `bash scripts/_pg_local.sh start` (' + String(e.message).split('\n')[0] + ')' });
    return;
  }
  sql(URL0, `drop database if exists ${DBN}`);
  sql(URL0, `create database ${DBN}`);
  url = URL0.replace(/\/[^/]*$/, '/' + DBN);
  sql(url, FIXTURE);

  // ── Geschichte nachspielen ──────────────────────────────────────────────
  sqlFile(url, MIG('20260826_quiz_leaderboard_race_fix.sql'));          // v30.80: Rangliste zaehlt quiz_answers
  sql(url, `insert into quiz_answers (user_id, quiz_id, selected_option, is_correct, answered_on, created_at)
            values ('${U1}', '${QL}', null, true, '2026-06-14', '2026-06-14 10:00+00')`);   // Altzeile: kein Index, vor v30.95
  sqlFile(url, MIG('20260831_quiz_antworten_serverseitig_v30_95.sql'));  // v30.95: der Server entscheidet — und kennt EIN Format
  sql(url, `
    insert into quiz_answers (user_id, quiz_id, selected_option, is_correct) values
      ('${U1}', '${QB}', 1, true),    -- 04.09.: richtig im Generator-Format (Schlehe)
      ('${U2}', '${QB}', 0, false),   -- falsch
      ('${U3}', '${QC}', 2, true),    -- richtig im Altbestand-Format
      ('${U1}', '${QA}', 0, true),    -- richtig im Array-Format (das einzige, das ging)
      ('${U1}', '${QC}', 0, false);   -- falsch
    alter table quiz_answers disable trigger trg_quiz_answers_verify;
    update quiz_answers set answered_on = '2026-09-04', created_at = '2026-09-04 05:49+00' where selected_option is not null;
    alter table quiz_answers enable trigger trg_quiz_answers_verify;`);

  fallS('Reproduktion (Stand v30.95) · richtige Antwort im Generator- und im Altbestand-Format zaehlt als FALSCH, im Array-Format als richtig', () => {
    const b = eins(url, `select is_correct from quiz_answers where user_id='${U1}' and quiz_id='${QB}'`);
    const c = eins(url, `select is_correct from quiz_answers where user_id='${U3}' and quiz_id='${QC}'`);
    const a = eins(url, `select is_correct from quiz_answers where user_id='${U1}' and quiz_id='${QA}'`);
    const lb = eins(url, `select total_correct||'/'||total_attempts from quiz_leaderboard where user_id='${U1}'`);
    if (b !== 'f' || c !== 'f' || a !== 't') return { ok: false, warum: 'Live-Fehler NICHT reproduziert — B=' + b + ' C=' + c + ' A=' + a + '. Dann misst der Rest nichts.' };
    if (lb !== '2/4') return { ok: false, warum: 'Rangliste vor der Reparatur: ' + lb + ' (erwartet 2/4: Altzeile + Array-Format)' };
    return { ok: true, info: 'B=false C=false A=true · Rangliste U1 2/4 — genau das Bild vom 04.09.' };
  });

  // ── Die Reparatur ───────────────────────────────────────────────────────
  sqlFile(url, MIG('20260907_quiz_antwort_formate.sql'));

  fallS('Nachrechnen · die zwei richtigen Antworten kippen auf richtig, falsche bleiben falsch, die Altzeile ohne Index bleibt unangetastet, kein Umdatieren', () => {
    const r = Object.fromEntries(zeilen(url, `select user_id||'/'||quiz_id, is_correct||'|'||coalesce(xp_earned::text,'-')||'|'||answered_on from quiz_answers`));
    const erw = {
      [U1 + '/' + QB]: 'true|10|2026-09-04', [U3 + '/' + QC]: 'true|20|2026-09-04', [U2 + '/' + QB]: 'false|0|2026-09-04',
      [U1 + '/' + QA]: 'true|15|2026-09-04', [U1 + '/' + QC]: 'false|0|2026-09-04', [U1 + '/' + QL]: 'true|-|2026-06-14',
    };
    const falsch = Object.keys(erw).filter(k => r[k] !== erw[k]).map(k => k.slice(-4) + ': ' + r[k] + ' (erwartet ' + erw[k] + ')');
    if (falsch.length) return { ok: false, warum: falsch.join(' · ') };
    return { ok: true, info: 'B und C richtig (xp 10/20), Altzeile bleibt true ohne Index, answered_on bleibt 04.09.' };
  });

  fallS('Rangliste nachgezogen · U1 3/4, U3 1/1, U2 0/1 — kein Rueckschritt', () => {
    const r = Object.fromEntries(zeilen(url, `select user_id, total_correct||'/'||total_attempts from quiz_leaderboard`));
    const erw = { [U1]: '3/4', [U3]: '1/1', [U2]: '0/1' };
    const falsch = Object.keys(erw).filter(k => r[k] !== erw[k]).map(k => k.slice(-1) + ': ' + r[k] + ' (erwartet ' + erw[k] + ')');
    return falsch.length ? { ok: false, warum: falsch.join(' · ') } : { ok: true, info: 'U1 3/4 · U3 1/1 · U2 0/1' };
  });

  fallS('Neue Antworten · alle drei Formate: richtig → true + XP der Frage, falsch → false + 0, Index ausserhalb → false UND gesagt (system_events)', () => {
    sql(url, `insert into quiz_answers (user_id, quiz_id, selected_option, is_correct) values
      ('${U2}', '${QA}', 0, false), ('${U2}', '${QC}', 1, true), ('${U3}', '${QB}', 1, false), ('${U3}', '${QA}', 9, true)`);
    const r = Object.fromEntries(zeilen(url, `select user_id||'/'||quiz_id, is_correct||'|'||xp_earned||'|'||(answered_on = current_date) from quiz_answers where created_at > now() - interval '1 minute'`));
    const erw = { [U2 + '/' + QA]: 'true|15|true', [U2 + '/' + QC]: 'false|0|true', [U3 + '/' + QB]: 'true|10|true', [U3 + '/' + QA]: 'false|0|true' };
    const falsch = Object.keys(erw).filter(k => r[k] !== erw[k]).map(k => k.slice(-4) + ': ' + r[k] + ' (erwartet ' + erw[k] + ')');
    if (falsch.length) return { ok: false, warum: falsch.join(' · ') };
    const ev = zeilen(url, `select severity, event, detail->>'quiz_id', detail->>'selected_option' from system_events where source='quiz'`);
    if (ev.length !== 1 || ev[0][1] !== 'antwort_nicht_pruefbar' || ev[0][2] !== QA || ev[0][3] !== '9') return { ok: false, warum: 'system_events: ' + z(ev) };
    return { ok: true, info: 'A richtig xp 15 · C falsch · B richtig xp 10 · Index 9 → false + 1 Zeile antwort_nicht_pruefbar (Client-Wert true wurde verworfen)' };
  });

  fallS('fn_quiz_option_correct · true / false / NULL je Format; wirft nie (is_correct:"ja" → false, Text statt Zahl → NULL)', () => {
    const f = (o, i) => eins(url, `select coalesce(public.fn_quiz_option_correct('${o}'::jsonb, ${i})::text, 'NULL')`);
    const erw = [
      [f('[{"label":"a","is_correct":true},{"label":"b","is_correct":false}]', 0), 'true', 'A richtig'],
      [f('[{"label":"a","is_correct":true},{"label":"b","is_correct":false}]', 1), 'false', 'A falsch'],
      [f('[{"label":"a","is_correct":true},{"label":"b","is_correct":false}]', 2), 'NULL', 'A ausserhalb'],
      [f('["a","b"]', 0), 'NULL', 'A ohne Objekte'],
      [f('[{"text":"a","correct":true}]', 0), 'true', 'A mit correct:true'],
      [f('[{"label":"a","is_correct":"ja"}]', 0), 'false', 'A is_correct:"ja" → false, kein Fehler'],
      [f('{"answers":["a","b","c"],"correct":2}', 2), 'true', 'B richtig'],
      [f('{"answers":["a","b","c"],"correct":2}', 0), 'false', 'B falsch'],
      [f('{"answers":["a","b","c"],"correct":2}', 3), 'NULL', 'B ausserhalb'],
      [f('{"choices":["a","b"],"correct":1}', 1), 'true', 'C richtig'],
      [f('{"choices":["a","b"],"correct":1}', 0), 'false', 'C falsch'],
      [f('{"answers":["a","b"],"correct_idx":1}', 1), 'true', 'B mit correct_idx'],
      [f('{"answers":["a","b"],"correct":"1"}', 1), 'NULL', 'B correct als Text → nicht pruefbar'],
      [f('{"foo":["a","b"]}', 0), 'NULL', 'viertes Format'],
      [f('{"answers":["a","b"],"correct":1}', -1), 'NULL', 'negativer Index'],
      [eins(url, `select coalesce(public.fn_quiz_option_correct(null, 0)::text, 'NULL')`), 'NULL', 'options NULL'],
      [eins(url, `select coalesce(public.fn_quiz_option_correct('{"answers":["a"],"correct":0}'::jsonb, null)::text, 'NULL')`), 'NULL', 'Index NULL'],
    ];
    const falsch = erw.filter(e => e[0] !== e[1]).map(e => e[2] + ': ' + e[0] + ' (erwartet ' + e[1] + ')');
    return falsch.length ? { ok: false, warum: falsch.join(' · ') } : { ok: true, info: erw.length + ' Werte, alle wie erwartet' };
  });

  fallS('CHECK auf daily_quizzes · ein viertes Format und correct als Text werden LAUT abgewiesen, die drei bekannten angenommen', () => {
    const e1 = sqlFehler(url, `insert into daily_quizzes (question, options) values ('x', '{"foo":["a","b"]}'::jsonb)`);
    const e2 = sqlFehler(url, `insert into daily_quizzes (question, options) values ('x', '{"answers":["a","b"],"correct":"1"}'::jsonb)`);
    const e3 = sqlFehler(url, `insert into daily_quizzes (question, options) values ('x', '[]'::jsonb)`);
    if (!e1 || !/daily_quizzes_options_format_chk/.test(e1)) return { ok: false, warum: 'viertes Format angenommen: ' + e1 };
    if (!e2 || !/daily_quizzes_options_format_chk/.test(e2)) return { ok: false, warum: 'correct als Text angenommen: ' + e2 };
    if (!e3) return { ok: false, warum: 'leeres Array angenommen' };
    const ok = sqlFehler(url, `insert into daily_quizzes (question, options) values
      ('a', '[{"label":"a","is_correct":true},{"label":"b","is_correct":false}]'::jsonb),
      ('b', '{"answers":["a","b"],"correct":0}'::jsonb), ('c', '{"choices":["a","b"],"correct":1}'::jsonb)`);
    if (ok) return { ok: false, warum: 'bekanntes Format abgewiesen: ' + ok };
    return { ok: true, info: '{"foo"} → abgewiesen · correct:"1" → abgewiesen · [] → abgewiesen · A/B/C → angenommen' };
  });

  fallS('Jahres-Ranking (fn_grant_quiz_top3_pro) · zaehlt mit derselben Funktion: U1 3, U3 2, U2 1 → alle drei Pro, U1 zuerst', () => {
    const r = JSON.parse(eins(url, `select public.fn_grant_quiz_top3_pro()`));
    if (r.granted !== 3 || !Array.isArray(r.user_ids) || r.user_ids[0] !== U1 || r.user_ids[1] !== U3 || r.user_ids[2] !== U2) return { ok: false, warum: z(r) };
    const pro = zahl(url, `select count(*) from profiles where comp_tier = 'pro' and comp_expires_at > now() + interval '360 days'`);
    if (pro !== 3) return { ok: false, warum: 'comp_tier pro: ' + pro };
    return { ok: true, info: 'granted 3 · Reihenfolge U1, U3, U2 · comp_expires_at +1 Jahr' };
  });

  fallS('Idempotent · Migration ein zweites Mal → kein Fehler, nichts aendert sich, der CHECK steht einmal', () => {
    const vorher = eins(url, `select string_agg(user_id||':'||total_correct||'/'||total_attempts, ',' order by user_id) from quiz_leaderboard`) + '|' + zahl(url, `select count(*) from quiz_answers where is_correct`);
    sqlFile(url, MIG('20260907_quiz_antwort_formate.sql'));
    const nachher = eins(url, `select string_agg(user_id||':'||total_correct||'/'||total_attempts, ',' order by user_id) from quiz_leaderboard`) + '|' + zahl(url, `select count(*) from quiz_answers where is_correct`);
    const chk = zahl(url, `select count(*) from pg_constraint where conname = 'daily_quizzes_options_format_chk'`);
    if (vorher !== nachher) return { ok: false, warum: vorher + ' → ' + nachher };
    if (chk !== 1) return { ok: false, warum: 'CHECK ' + chk + '×' };
    return { ok: true, info: 'zweiter Lauf ohne Fehler, Zaehler gleich, CHECK 1×' };
  });

  fallS('Gegenprobe · alte Regel (v30.95) wieder eingespielt → richtige Antwort im Generator-Format wird wieder FALSCH; Reparatur erneut → sie kippt zurueck', () => {
    sqlFile(url, MIG('20260831_quiz_antworten_serverseitig_v30_95.sql'));
    sql(url, `insert into quiz_answers (user_id, quiz_id, selected_option, is_correct) values ('${U4}', '${QB}', 1, true)`);
    const alt = eins(url, `select is_correct from quiz_answers where user_id='${U4}'`);
    sqlFile(url, MIG('20260907_quiz_antwort_formate.sql'));
    const neu = eins(url, `select is_correct from quiz_answers where user_id='${U4}'`);
    const lb = eins(url, `select total_correct||'/'||total_attempts from quiz_leaderboard where user_id='${U4}'`);
    if (alt !== 'f') return { ok: false, warum: 'die Gegenprobe wird nicht rot: alte Regel liefert ' + alt + ' — dann misst dieser Pruefstand die Regel nicht' };
    if (neu !== 't' || lb !== '1/1') return { ok: false, warum: 'nach erneuter Reparatur: ' + neu + ' · Rangliste ' + lb };
    return { ok: true, info: 'alte Regel → false (rot) · Reparatur → true, Rangliste U4 1/1' };
  });

  try { sql(URL0, `drop database if exists ${DBN}`); } catch (_) {}
}

// ── App-Haelfte (Playwright) ──────────────────────────────────────────────
const K = [
  {
    name: 'Index reist mit · in allen drei Formaten traegt jeder Knopf den DB-Index seiner Option; angetippt wird der richtige, gesendet wird SEIN Index (nicht die gemischte Position)',
    lauf: async () => {
      const fragen = [
        { id: 'aaaaaaaa-0000-4000-8000-000000000001', question: 'Format A', category: 'x', xp_reward: 15, options: [{ label: 'A0', is_correct: true, explanation: 'x' }, { label: 'A1', is_correct: false }, { label: 'A2', is_correct: false }, { label: 'A3', is_correct: false }], texte: ['A0', 'A1', 'A2', 'A3'], richtig: 0 },
        { id: 'aaaaaaaa-0000-4000-8000-000000000002', question: 'Format B', category: 'x', xp_reward: 10, options: { answers: ['B0', 'B1', 'B2', 'B3'], correct: 1, explanation: 'y' }, texte: ['B0', 'B1', 'B2', 'B3'], richtig: 1 },
        { id: 'aaaaaaaa-0000-4000-8000-000000000003', question: 'Format C', category: 'x', xp_reward: 20, options: { choices: ['C0', 'C1', 'C2', 'C3'], correct: 2, explanation: 'z' }, texte: ['C0', 'C1', 'C2', 'C3'], richtig: 2 },
      ];
      const infos = [];
      for (const q of fragen) {
        const r = await __seite.evaluate(async (q) => {
          const A = window.__qc; await A.reset(); A.antwort = { data: [{ is_correct: true }], error: null };
          A.oeffnen(q);
          const kn = A.knoepfe();
          const falsch = kn.filter(k => k.idx !== q.texte.indexOf(k.text));
          if (falsch.length) return { ok: false, warum: q.question + ': Index passt nicht zum Text: ' + JSON.stringify(falsch) };
          const richtig = kn.find(k => k.idx === q.richtig);
          if (!richtig || richtig.correct !== '1') return { ok: false, warum: q.question + ': richtiger Knopf ohne data-correct=1: ' + JSON.stringify(kn) };
          document.querySelectorAll('.dq-opt')[richtig.pos].click();
          await new Promise(r => setTimeout(r, 1400));
          const post = A.rufe.find(x => /\/quiz_answers$/.test(x.path) && x.opts && x.opts.method === 'POST');
          if (!post) return { ok: false, warum: q.question + ': kein POST auf quiz_answers (' + A.rufe.map(x => x.path).join(', ') + ')' };
          const body = JSON.parse(post.opts.body);
          if (body.selected_option !== q.richtig || body.quiz_id !== q.id || body.is_correct !== true) return { ok: false, warum: q.question + ': Body ' + JSON.stringify(body) };
          if (!/return=representation/.test(post.opts.headers.Prefer || '')) return { ok: false, warum: q.question + ': Prefer ' + post.opts.headers.Prefer + ' — das Urteil wird nie gelesen' };
          const gemischt = kn.map(k => k.idx).join('') !== '0123';
          return { ok: true, info: q.question + ' idx ' + q.richtig + (gemischt ? ' (gemischt ' + kn.map(k => k.idx).join('') + ')' : '') };
        }, q);
        if (!r.ok) return r;
        infos.push(r.info);
      }
      return { ok: true, info: infos.join(' · ') };
    },
  },
  {
    name: 'Urteil des Servers · bestaetigt → nichts; widersprochen → sichtbar unter dem Ergebnis; nicht angekommen → sichtbar; Dublette (0 Zeilen) → nichts',
    lauf: async () => __seite.evaluate(async () => {
      const A = window.__qc;
      const q = { id: 'aaaaaaaa-0000-4000-8000-000000000002', question: 'Format B', category: 'x', xp_reward: 10, options: { answers: ['B0', 'B1', 'B2', 'B3'], correct: 1 } };
      const spiel = async (antwort, welcher) => {
        await A.reset(); A.antwort = antwort; A.oeffnen(q);
        const kn = A.knoepfe(); const k = kn.find(x => (welcher === 'richtig' ? x.correct === '1' : x.correct !== '1'));
        document.querySelectorAll('.dq-opt')[k.pos].click();
        await new Promise(r => setTimeout(r, 1400));
        const el = document.getElementById('dq-server-urteil');
        return { text: el ? el.textContent : null, sichtbar: !!(el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'), heute: (dqGetToday() || {}).serverUrteil };
      };
      const a = await spiel({ data: [{ is_correct: true }], error: null }, 'richtig');
      if (a.text !== null || a.heute !== 'richtig') return { ok: false, warum: 'bestaetigt zeigt etwas: ' + JSON.stringify(a) };
      const b = await spiel({ data: [{ is_correct: false }], error: null }, 'richtig');
      if (!b.text || !/als falsch/.test(b.text) || !b.sichtbar || b.heute !== 'falsch') return { ok: false, warum: 'Widerspruch nicht sichtbar: ' + JSON.stringify(b) };
      const c = await spiel({ data: null, error: { message: 'permission denied for table quiz_answers', status: 403 } }, 'richtig');
      // v32.73 (Audit B8): der Grund steht als SATZ da (_gsFehlerText), nicht als PostgREST-Zeile
      if (!c.text || !/nicht beim Server/.test(c.text) || !/abgelehnt/.test(c.text) || /permission denied/.test(c.text) || c.heute !== 'nicht_angekommen') return { ok: false, warum: 'nicht angekommen nicht gesagt: ' + JSON.stringify(c) };
      const d = await spiel({ data: [], error: null }, 'richtig');
      if (d.text !== null || d.heute !== null) return { ok: false, warum: 'Dublette zeigt etwas: ' + JSON.stringify(d) };
      const e = await spiel({ data: [{ is_correct: true }], error: null }, 'falsch');
      if (!e.text || !/als richtig/.test(e.text)) return { ok: false, warum: 'Gegenrichtung (Client falsch, Server richtig) nicht gesagt: ' + JSON.stringify(e) };
      return { ok: true, info: 'bestaetigt still · „als falsch" sichtbar · „nicht beim Server (permission denied…)" sichtbar · Dublette still · Gegenrichtung „als richtig"' };
    }),
  },
  {
    name: 'Wiederoeffnen · das Urteil steht auch in der „heute schon gespielt"-Ansicht (showDqResult), ein bestaetigtes nicht',
    lauf: async () => __seite.evaluate(async () => {
      const A = window.__qc;
      const q = { id: 'aaaaaaaa-0000-4000-8000-000000000003', question: 'Format C', category: 'x', xp_reward: 20, options: { choices: ['C0', 'C1', 'C2', 'C3'], correct: 2 } };
      const spiel = async (antwort) => {
        await A.reset(); A.antwort = antwort; A.oeffnen(q);
        const k = A.knoepfe().find(x => x.correct === '1');
        document.querySelectorAll('.dq-opt')[k.pos].click();
        await new Promise(r => setTimeout(r, 1400));
        closeDailyQuiz(); await new Promise(r => setTimeout(r, 300));
        showDqResult(dqGetToday());
        const el = document.querySelector('#dq-result #dq-server-urteil');
        return el ? el.textContent : null;
      };
      const w = await spiel({ data: [{ is_correct: false }], error: null });
      if (!w || !/als falsch/.test(w)) return { ok: false, warum: 'Widerspruch fehlt beim Wiederoeffnen: ' + w };
      const n = await spiel({ data: null, error: { message: 'offline' } });
      if (!n || !/nicht beim Server/.test(n)) return { ok: false, warum: 'nicht angekommen fehlt beim Wiederoeffnen: ' + n };
      const b = await spiel({ data: [{ is_correct: true }], error: null });
      if (b !== null) return { ok: false, warum: 'bestaetigt zeigt beim Wiederoeffnen etwas: ' + b };
      return { ok: true, info: 'Widerspruch da · nicht angekommen da · bestaetigt still' };
    }),
  },
  {
    name: 'Nach der Antwort · die offenen Ranglisten werden erneuert (dqRefreshLeaderboards), und der Streak-Push geht raus',
    lauf: async () => __seite.evaluate(async () => {
      const A = window.__qc;
      const q = { id: 'aaaaaaaa-0000-4000-8000-000000000002', question: 'Format B', category: 'x', xp_reward: 10, options: { answers: ['B0', 'B1', 'B2', 'B3'], correct: 1 } };
      await A.reset(); A.antwort = { data: [{ is_correct: true }], error: null }; A.oeffnen(q);
      let refresh = 0; const echt = window.dqRefreshLeaderboards; window.dqRefreshLeaderboards = () => { refresh++; };
      try {
        const k = A.knoepfe().find(x => x.correct === '1');
        document.querySelectorAll('.dq-opt')[k.pos].click();
        await new Promise(r => setTimeout(r, 2200));
      } finally { window.dqRefreshLeaderboards = echt; }
      const push = A.rufe.filter(x => /fn_quiz_leaderboard_upsert/.test(x.path)).length;
      if (refresh < 1) return { ok: false, warum: 'dqRefreshLeaderboards nicht gerufen' };
      if (push < 1) return { ok: false, warum: 'kein Upsert-Push (' + A.rufe.map(x => x.path).join(', ') + ')' };
      return { ok: true, info: 'refresh ' + refresh + '× · Upsert-Push ' + push + '×' };
    }),
  },
];
let __seite = null;

(async () => {
  console.log('\n=== quiz_check — zaehlt der Server, was der Spieler richtig hatte?');
  // ── SQL ────────────────────────────────────────────────────────────────
  sqlHaelfte();
  let kaputt = 0, offen = 0;
  console.log('  [SQL — lokales Postgres, Geschichte v30.80 → v30.95 → 20260907 nachgespielt]');
  for (const s of S) {
    if (s.ok === null) { offen++; console.log('  ??   ' + s.name + '\n         → ' + s.warum); }
    else if (s.ok) console.log('  ok   ' + s.name + (s.info ? '   [' + s.info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + s.name + '\n         → ' + s.warum); }
  }
  // ── App ────────────────────────────────────────────────────────────────
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
    window.gsRequire = () => true;
    window.gsToast = () => {}; window.showProfileToast = () => {}; window.gsHaptic = () => {};
    window.sbIsLoggedIn = () => true;
    window.gsStore = window.gsStore || {};
    const echtGet = gsStore.get;
    gsStore.get = (k, d) => (k === 'gs_sb_uid' ? '00000000-0000-0000-0000-000000000001' : (echtGet ? echtGet.call(gsStore, k, d) : d));
    const A = window.__qc = { rufe: [], antwort: { data: [], error: null } };
    window.sbFetch = async (path, opts) => {
      A.rufe.push({ path, opts: opts || {} });
      if (/\/quiz_answers$/.test(path) && opts && opts.method === 'POST') return A.antwort;
      return { data: [], error: null };
    };
    // closeDailyQuiz blendet das Fenster 200 ms VERZOEGERT aus — wer sofort wieder
    // oeffnet, bekommt es 200 ms spaeter unter sich weggezogen (erster Lauf:
    // „Widerspruch nicht sichtbar", getClientRects leer). Deshalb warten.
    A.reset = async () => { A.rufe.length = 0; try { closeDailyQuiz(); } catch (_) {} try { localStorage.removeItem(dqTodayKey()); } catch (_) {} const r = document.getElementById('dq-result'); if (r) r.innerHTML = ''; await new Promise(res => setTimeout(res, 320)); };
    A.oeffnen = (q) => { const s = _gsQuizToSupaShape(JSON.parse(JSON.stringify(q))); openDailyQuizFromSupa(s); return s; };
    A.knoepfe = () => Array.from(document.querySelectorAll('.dq-opt')).map((b, pos) => ({ pos, text: b.textContent.trim(), idx: parseInt(b.dataset.idx, 10), correct: b.dataset.correct }));
  });
  console.log('  [App — Playwright, gestellter Server]');
  for (const f of K) {
    let r;
    try { r = await f.lauf(); } catch (e) { r = { ok: false, warum: 'Ausnahme: ' + e.message.split('\n')[0] }; }
    if (r && r.ok) console.log('  ok   ' + f.name + (r.info ? '   [' + r.info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
  }
  await br.close();
  console.log('  ---');
  console.log('  Faelle geprueft: ' + (S.length + K.length) + ' · davon kaputt: ' + kaputt + (offen ? ' · nicht pruefbar: ' + offen + ' (SQL-Haelfte ohne lokales Postgres)' : ''));
  console.log('  JS-Fehler waehrend der Pruefung: ' + (errs.length ? errs.length + ' (' + errs.slice(0, 2).join(' | ') + ')' : 'keine'));
  console.log('  Grenze: das lokale Postgres hat keine RLS und kein auth.users — geprueft ist die');
  console.log('  Rechnung der Migration und die Rueckmeldung der App, nicht die Anwendung auf der Live-DB.');
  process.exitCode = kaputt ? 1 : (offen ? 2 : 0);
})();
