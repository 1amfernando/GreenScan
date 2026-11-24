// Quiz, Rangliste, XP, Erfolge, Battles — was der Client sich selbst gutschreiben kann (v33.59).
//
// Jeder Fall baut den Live-Stand vom 10.11.2026 nach: Tabellen mit den Live-
// Spalten (soweit gebraucht), Policies und Tabellenrechte im Wortlaut von
// pg_policies / relacl, die Funktionen im Wortlaut aus 20_quiz_live.sql
// (pg_get_functiondef, live gelesen 10.11.2026) mit ihrer Live-ACL. Dann:
// Angriff (MUSS gelingen) → 20261110_sicherheit_quiz_punkte.sql ZWEIMAL →
// Angriff scheitert → der Weg der App geht weiter → Gegenprobe (die
// entscheidende Zeile der Migration weggelassen → der Angriff gelingt wieder).
'use strict';
const fs = require('fs');
const path = require('path');

const MIG = '20261110_sicherheit_quiz_punkte.sql';
const ALT = '20260907_quiz_antwort_formate.sql';
const LIVE = fs.readFileSync(path.join(__dirname, '20_quiz_live.sql'), 'utf8');
const Q_HEUTE = 'aaaaaaaa-0000-4000-8000-0000000000a1';
const Q_ALT1 = 'aaaaaaaa-0000-4000-8000-0000000000a2';
const Q_ALT2 = 'aaaaaaaa-0000-4000-8000-0000000000a3';
const Q_GESTERN = 'aaaaaaaa-0000-4000-8000-0000000000a4';
// Format A (Array von Objekten): das einzige, das der Live-Trigger heute kennt.
const OPT_A = `'[{"label":"x0","is_correct":true},{"label":"x1","is_correct":false},{"label":"x2","is_correct":false}]'::jsonb`;

function grund(h) {
  return `
create table public.profiles (id uuid primary key, email text, display_name text, avatar_emoji text default '🌿',
  xp int4 default 0, level int4 default 1, tier text default 'free', is_expert bool default false, is_admin bool default false,
  updated_at timestamptz default now(), role text default 'user', role_assigned_at timestamptz default now(), role_assigned_by uuid,
  is_lifetime bool default false, showcase_achievements text[] default '{}'::text[], quiz_elo int4 not null default 1200,
  battles_won int4 not null default 0, battles_lost int4 not null default 0, battles_tied int4 not null default 0,
  comp_tier text, comp_expires_at timestamptz, comp_granted_by uuid, comp_granted_at timestamptz);
create table public.system_events (id bigserial primary key, severity text, source text, event text, detail jsonb, created_at timestamptz default now());
create table public.daily_quizzes (id uuid primary key default gen_random_uuid(), day_key date, question text not null, options jsonb not null,
  category text, xp_reward int4 default 10, is_active bool default true, created_at timestamptz default now());
create table public.daily_quiz_history (day_key date primary key, question_id uuid not null references public.daily_quizzes(id) on delete cascade, created_at timestamptz not null default now());
create table public.quiz_answers (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, username text,
  quiz_id uuid references public.daily_quizzes(id), selected_option int4, is_correct bool, time_taken_ms int4, xp_earned int4 default 0,
  answered_on date default current_date, created_at timestamptz default now(), unique (user_id, quiz_id));
create table public.quiz_leaderboard (user_id uuid primary key references auth.users(id) on delete cascade, display_name text not null,
  total_correct int4 not null default 0, total_attempts int4 not null default 0, streak_current int4 not null default 0,
  streak_max int4 not null default 0, last_active_date date, rank_position int4, updated_at timestamptz not null default now());
create table public.quiz_ranking (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  username text not null, year int4 not null, total_points int4 default 0, year_points int4 default 0, correct_answers int4 default 0,
  total_answers int4 default 0, streak int4 default 0, updated_at timestamptz default now(), unique (user_id, year));
create table public.quiz_battles (id uuid primary key default gen_random_uuid(), challenger_id uuid not null references auth.users(id) on delete cascade,
  opponent_id uuid references auth.users(id) on delete set null, status text not null default 'open'
  check (status = any (array['open','accepted','challenger_done','opponent_done','resolved','expired','declined'])),
  questions jsonb not null, challenger_answers jsonb, opponent_answers jsonb, challenger_score int2, opponent_score int2, winner_id uuid,
  elo_change_challenger int2 default 0, elo_change_opponent int2 default 0, is_random_match bool not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), resolved_at timestamptz,
  expires_at timestamptz not null default (now() + '7 days'::interval));
create table public.achievements_catalog (id uuid primary key default gen_random_uuid(), slug text not null unique, title text not null,
  description text, icon text, category text, rarity text default 'common', xp_reward int4 default 10, condition jsonb default '{}'::jsonb,
  is_active bool default true, sort_order int4 default 100, created_at timestamptz default now(), share_template text);
create table public.achievement_progress (user_id uuid not null references auth.users(id) on delete cascade, achievement_slug text not null,
  current_value int4 not null default 0, target_value int4 not null, last_updated timestamptz not null default now(), unlocked_at timestamptz,
  primary key (user_id, achievement_slug));
create table public.user_achievements (user_id uuid not null references auth.users(id) on delete cascade,
  achievement_slug text not null references public.achievements_catalog(slug) on delete cascade,
  unlocked_at timestamptz not null default now(), metadata jsonb default '{}'::jsonb, primary key (user_id, achievement_slug));
create table public.quests (id uuid primary key default gen_random_uuid(), target_metric text, target_value int4, xp_reward int4,
  is_active bool default true, starts_at timestamptz, ends_at timestamptz);
create table public.user_quest_progress (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade, current_value int4 default 0, completed bool default false,
  completed_at timestamptz, rewarded bool default false, created_at timestamptz default now(), updated_at timestamptz default now(), unique (user_id, quest_id));
create table public.user_scans (id uuid primary key default gen_random_uuid(), user_id uuid, created_at timestamptz default now());
create or replace function public.is_admin_user() returns boolean language sql stable as $f$ select false $f$;
create or replace function public.fn_is_role(text) returns boolean language sql stable as $f$ select false $f$;
create or replace function public.fn_create_notification(uuid, text, text, text, text, text) returns void language sql as $f$ select $f$;

insert into auth.users (id) values ('${h.U1}'), ('${h.U2}'), ('${h.U3}');
insert into public.profiles (id, display_name) values ('${h.U1}', 'Eins'), ('${h.U2}', 'Zwei'), ('${h.U3}', 'Drei');
insert into public.daily_quizzes (id, question, options) values
  ('${Q_HEUTE}', 'heute', ${OPT_A}), ('${Q_ALT1}', 'alt1', ${OPT_A}), ('${Q_ALT2}', 'alt2', ${OPT_A}), ('${Q_GESTERN}', 'gestern', ${OPT_A});
insert into public.daily_quiz_history (day_key, question_id) values (current_date, '${Q_HEUTE}'), (current_date - 1, '${Q_GESTERN}');
insert into public.achievements_catalog (slug, title, xp_reward, condition) values
  ('scan_1', 'Erster Scan', 10, '{"type":"scan_count","value":1}'), ('scan_100', 'Hundert', 100, '{"type":"scan_count","value":100}'),
  ('scan_1000', 'Tausend', 500, '{"type":"scan_count","value":1000}'), ('elo_1300', 'Aufsteiger', 75, '{"type":"quiz_elo","value":1300}'),
  ('battle_first', 'Erstes Duell', 25, '{"type":"battles_won","value":1}'), ('master_gardener', 'Meister', 1000, '{"type":"all_achievements","value":1}');
insert into public.quests (target_metric, target_value, xp_reward, starts_at, ends_at) values ('scans_count', 3, 50, now() - interval '1 day', now() + interval '1 day');

-- Live-Policies (pg_policies, gelesen 10.11.2026) — Wortlaut
alter table public.profiles enable row level security;
create policy profiles_insert_self on public.profiles for insert with check ((select auth.uid()) = id);
create policy profiles_select_own on public.profiles for select using ((id = (select auth.uid())) or fn_is_role('admin'::text));
create policy profiles_update on public.profiles for update using (fn_is_role('admin'::text) or ((select auth.uid()) = id));
alter table public.system_events enable row level security;
alter table public.daily_quizzes enable row level security;
create policy daily_quizzes_public_read on public.daily_quizzes for select using (is_active = true);
alter table public.daily_quiz_history enable row level security;
create policy daily_quiz_history_public on public.daily_quiz_history for select to anon, authenticated using (true);
alter table public.quiz_answers enable row level security;
create policy quiz_answers_insert_auth on public.quiz_answers for insert with check ((select auth.uid()) = user_id);
create policy quiz_answers_select_own on public.quiz_answers for select using ((select auth.uid()) = user_id);
alter table public.quiz_leaderboard enable row level security;
create policy "all read leaderboard" on public.quiz_leaderboard for select using (true);
create policy ql_own_del on public.quiz_leaderboard for delete using (user_id = (select auth.uid()));
create policy ql_own_ins on public.quiz_leaderboard for insert with check (user_id = (select auth.uid()));
create policy ql_own_upd on public.quiz_leaderboard for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter table public.quiz_ranking enable row level security;
create policy quiz_ranking_select_all on public.quiz_ranking for select using (true);
create policy quiz_ranking_update_own on public.quiz_ranking for update using ((select auth.uid()) = user_id);
create policy quiz_ranking_upsert_own on public.quiz_ranking for insert with check ((select auth.uid()) = user_id);
alter table public.quiz_battles enable row level security;
create policy qb_challenger_create on public.quiz_battles for insert with check ((select auth.uid()) = challenger_id);
create policy qb_participants_read on public.quiz_battles for select using (((((select auth.uid()) = challenger_id) or ((select auth.uid()) = opponent_id)) or ((is_random_match = true) and (opponent_id is null) and (status = any (array['open'::text, 'challenger_done'::text])))));
alter table public.achievements_catalog enable row level security;
create policy achievements_catalog_public on public.achievements_catalog for select to anon, authenticated using (is_active = true);
alter table public.achievement_progress enable row level security;
create policy ap_own on public.achievement_progress for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter table public.user_achievements enable row level security;
create policy user_achievements_own_insert on public.user_achievements for insert to authenticated with check (user_id = (select auth.uid()));
create policy user_achievements_own_select on public.user_achievements for select to authenticated using (user_id = (select auth.uid()));
alter table public.quests enable row level security;
alter table public.user_quest_progress enable row level security;
create policy quest_progress_insert_own on public.user_quest_progress for insert with check ((select auth.uid()) = user_id);
create policy quest_progress_select_own on public.user_quest_progress for select using ((select auth.uid()) = user_id);
create policy quest_progress_update_own on public.user_quest_progress for update using ((select auth.uid()) = user_id);
alter table public.user_scans enable row level security;
create policy user_scans_own on public.user_scans for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Live-Tabellenrechte (relacl): ueberall alles ausser quiz_answers (INSERT, SELECT) und quiz_leaderboard (SELECT)
revoke all on public.quiz_answers from anon, authenticated; grant insert, select on public.quiz_answers to anon, authenticated;
revoke all on public.quiz_leaderboard from anon, authenticated; grant select on public.quiz_leaderboard to anon, authenticated;
`;
}

const ACL = `
-- Live-ACL der Funktionen (functions_index.txt, 10.11.2026)
revoke all on function public._fn_quiz_battle_finalize(uuid) from public, anon, authenticated;
revoke all on function public.fn_grant_quiz_top3_pro() from public, anon, authenticated;
revoke all on function public.fn_quiz_answers_sync_leaderboard() from public, anon, authenticated;
revoke all on function public.fn_quiz_answers_verify() from public, anon, authenticated;
revoke all on function public.fn_quest_track_scan() from public, anon, authenticated;
revoke all on function public.fn_achievements_bump(text, bigint, boolean) from public, anon;
revoke all on function public.fn_add_xp(integer) from public, anon;
revoke all on function public.fn_achievements_showcase_set(text[]) from public, anon;
revoke all on function public.fn_quest_increment(uuid, text, integer) from public, anon;
revoke all on function public.fn_quiz_battle_create(jsonb, uuid, boolean) from public, anon;
revoke all on function public.fn_quiz_battle_find_or_create_random(jsonb) from public, anon;
revoke all on function public.fn_quiz_battle_submit(uuid, jsonb) from public, anon;
revoke all on function public.fn_quiz_leaderboard_upsert(integer, integer, integer, integer, text) from public, anon;
revoke all on function public.fn_quiz_record_answer(boolean, text) from anon;
-- Live-Trigger (triggers.json)
create trigger trg_profiles_guard_protected before update on public.profiles for each row execute function fn_profiles_guard_protected();
create trigger trg_quiz_answers_sync_lb after insert on public.quiz_answers for each row execute function fn_quiz_answers_sync_leaderboard();
create trigger trg_quiz_answers_verify before insert or update on public.quiz_answers for each row execute function fn_quiz_answers_verify();
create trigger trg_quest_track_scan after insert on public.user_scans for each row execute function fn_quest_track_scan();
`;

function aufbau(h, name) {
  const d = h.neu(name);
  d.sql(grund(h));
  d.sql(LIVE);
  d.sql(ACL);
  return d;
}
function zweimal(d) {
  for (let i = 1; i <= 2; i++) { const m = d.migration(MIG); if (!m.ok) throw new Error('Migration Lauf ' + i + ': ' + m.err.split('\n').slice(0, 2).join(' | ')); }
}
// Gegenprobe: die Migration ohne die genannten Zeilen (exakte Teilstrings; jeder MUSS vorkommen;
// ein Paar [alt, neu] ersetzt statt zu streichen).
function ohne(d, h, raus) {
  let t = h.migrationText(MIG);
  for (const x of raus) {
    const r = Array.isArray(x) ? x[0] : x, neu = Array.isArray(x) ? x[1] : '';
    if (t.indexOf(r) < 0) throw new Error('Gegenprobe: Zeile nicht gefunden: ' + r.slice(0, 60));
    t = t.split(r).join(neu);
  }
  const x = d.versuch(t);
  if (!x.ok) throw new Error('Gegenprobe-Migration: ' + x.err.split('\n')[0]);
}
const fehlt = (r, muster) => !r.ok && muster.test(r.err);
const kurz = (r) => (r.ok ? 'ok: ' + r.out : 'Fehler: ' + r.err.split('\n')[0]).slice(0, 200);

function antworte(d, uid, q, opt, extra) {
  return d.als(uid, `insert into public.quiz_answers (user_id, quiz_id, selected_option, is_correct${extra ? ', created_at' : ''})
    values ('${uid}', '${q}', ${opt}, true${extra ? ", '" + extra + "'" : ''}) returning is_correct;`);
}

module.exports = [
  {
    name: 'Quiz · eine Antwort nur auf die Frage von HEUTE (daily_quiz_history, UTC) — vorher jede Frage, danach Ablehnung quiz_nicht_heute; der Weg der App (heute, return=representation) geht weiter, eine je Frage, created_at vom Server',
    lauf: async (h) => {
      const d = aufbau(h, 'q2_heute');
      try {
        const vor1 = antworte(d, h.U1, Q_ALT1, 0), vor2 = antworte(d, h.U1, Q_ALT2, 0);
        if (!vor1.ok || vor1.out !== 't' || !vor2.ok || vor2.out !== 't') return { ok: false, warum: 'Angriff vor der Migration NICHT gelungen — dann misst der Fall nichts: ' + kurz(vor1) + ' / ' + kurz(vor2) };
        zweimal(d);
        const nach = antworte(d, h.U2, Q_ALT1, 0), gestern = antworte(d, h.U2, Q_GESTERN, 0);
        if (!fehlt(nach, /quiz_nicht_heute/) || !fehlt(gestern, /quiz_nicht_heute/)) return { ok: false, warum: 'Antwort auf fremde Frage nach der Migration: ' + kurz(nach) + ' / gestern ' + kurz(gestern) };
        const anon = d.als(null, `insert into public.quiz_answers (user_id, quiz_id, selected_option) values (null, '${Q_HEUTE}', 0);`);
        if (anon.ok || !/permission denied/.test(anon.err)) return { ok: false, warum: 'anon darf noch einfuegen: ' + kurz(anon) };
        const app = antworte(d, h.U2, Q_HEUTE, 0, '2000-01-01T00:00:00Z');
        if (!app.ok || app.out !== 't') return { ok: false, warum: 'ehrliche Antwort auf die Frage von heute: ' + kurz(app) };
        const zeit = d.sql(`select (created_at > now() - interval '1 hour')::text from public.quiz_answers where user_id = '${h.U2}'`);
        if (zeit !== 'true') return { ok: false, warum: 'created_at kommt weiter vom Client: ' + zeit };
        const doppelt = antworte(d, h.U2, Q_HEUTE, 1);
        if (doppelt.ok) return { ok: false, warum: 'zweite Antwort auf dieselbe Frage angenommen' };
        const falsch = antworte(d, h.U3, Q_HEUTE, 2);
        if (!falsch.ok || falsch.out !== 'f') return { ok: false, warum: 'falsche Antwort heute: ' + kurz(falsch) };
        const lb = d.sql(`select total_correct||'/'||total_attempts from public.quiz_leaderboard where user_id = '${h.U2}'`);
        if (lb !== '1/1') return { ok: false, warum: 'Rangliste nach ehrlicher Antwort: ' + lb };
        const svc = d.versuch(`insert into public.quiz_answers (user_id, quiz_id, selected_option) values ('${h.U3}', '${Q_ALT2}', 0);`);
        if (!svc.ok) return { ok: false, warum: 'Eigentuemer/Service-Weg blockiert: ' + svc.err.split('\n')[0] };
        // Gegenprobe: ohne den neuen Trigger gelingt der Angriff wieder
        const g = aufbau(h, 'q2_heute_gp');
        try {
          ohne(g, h, ['CREATE TRIGGER trg_quiz_answers_tagesfrage\n  BEFORE INSERT ON public.quiz_answers\n  FOR EACH ROW EXECUTE FUNCTION public.fn_quiz_answers_tagesfrage();']);
          const gp = antworte(g, h.U2, Q_ALT1, 0);
          if (!gp.ok) return { ok: false, warum: 'Gegenprobe bleibt gruen — der Trigger ist nicht die entscheidende Zeile: ' + kurz(gp) };
        } finally { g.weg(); }
        return { ok: true, info: 'vorher 2 fremde Fragen richtig · danach quiz_nicht_heute (Fehler) · anon permission denied · heute ok (true), created_at vom Server, zweite Antwort abgewiesen, Rangliste 1/1 · Gegenprobe ohne Trigger: Angriff gelingt' };
      } finally { d.weg(); }
    },
  },
  {
    name: 'Quiz · Jahres-Pro (fn_grant_quiz_top3_pro) zaehlt nur Antworten am Tag ihrer Frage — der Altbestand eines Massen-Einreichers gewinnt nicht mehr, der ehrliche Spieler schon; beide Reihenfolgen mit 20260907',
    lauf: async (h) => {
      const fuellen = (d) => {
        // U1 hat am 05.11. drei Fragen auf einmal beantwortet (nur eine war die des Tages) —
        // so liegt Altbestand vor der Migration. U2 hat zweimal die Tagesfrage richtig.
        d.sql(`alter table public.quiz_answers disable trigger user;
          insert into public.daily_quiz_history (day_key, question_id) values ('2026-11-05', '${Q_ALT1}'), ('2026-11-06', '${Q_ALT2}');
          insert into public.quiz_answers (user_id, quiz_id, selected_option, is_correct, answered_on, created_at) values
            ('${h.U1}', '${Q_ALT1}', 0, true, '2026-11-05', '2026-11-05 08:00+00'), ('${h.U1}', '${Q_ALT2}', 0, true, '2026-11-05', '2026-11-05 08:00+00'),
            ('${h.U1}', '${Q_GESTERN}', 0, true, '2026-11-05', '2026-11-05 08:00+00'),
            ('${h.U2}', '${Q_ALT1}', 0, true, '2026-11-05', '2026-11-05 09:00+00'), ('${h.U2}', '${Q_ALT2}', 0, true, '2026-11-06', '2026-11-06 09:00+00');
          alter table public.quiz_answers enable trigger user;`);
      };
      const top = (d) => { const r = JSON.parse(d.sql(`select public.fn_grant_quiz_top3_pro()`)); return (r.user_ids || []).join(','); };
      const d = aufbau(h, 'q2_top3');
      try {
        fuellen(d);
        const vor = top(d);
        if (vor.split(',')[0] !== h.U1) return { ok: false, warum: 'vor der Migration liegt der Massen-Einreicher NICHT vorn — dann misst der Fall nichts: ' + vor };
        d.sql(`update public.profiles set comp_tier = null, comp_expires_at = null`);
        zweimal(d);
        const nach = top(d);
        if (nach.split(',')[0] !== h.U2) return { ok: false, warum: 'nach der Migration: ' + nach + ' (erwartet U2 vorn: 2 Tage, U1 nur 1)' };
        const aufruf = d.als(h.U1, `select public.fn_grant_quiz_top3_pro();`);
        if (aufruf.ok) return { ok: false, warum: 'authenticated darf die Vergabe ausloesen' };
        // Reihenfolge 1: erst 20260907, dann diese Datei. Reihenfolge 2: umgekehrt.
        const reihen = [], endstand = [];
        // v33.59 (Schlusspruefung c1#1): beide Dateien legen Funktionen gleichen Namens an — der Endstand
        // muss in beiden Reihenfolgen DERSELBE sein, Rumpf fuer Rumpf (nicht nur das Ergebnis eines Aufrufs).
        const rumpf = (e) => e.sql(`select string_agg(proname || ':' || md5(prosrc), ' ' order by proname) from pg_proc
          where pronamespace = 'public'::regnamespace and proname in ('fn_quiz_option_correct', 'fn_grant_quiz_top3_pro', 'fn_quiz_answers_verify',
            'fn_quiz_answers_tagesfrage', '_gs_quiz_antwort_zaehlt', '_gs_quiz_stand', 'fn_quiz_leaderboard_upsert', 'fn_quiz_answers_sync_leaderboard')`);
        for (const folge of [[ALT, MIG], [MIG, ALT]]) {
          const e = aufbau(h, 'q2_top3_folge');
          try {
            fuellen(e);
            for (const f of folge) { const m = e.migration(f); if (!m.ok) return { ok: false, warum: f + ': ' + m.err.split('\n')[0] }; }
            const t = top(e);
            endstand.push(rumpf(e));
            const marke = e.sql(`select (prosrc like '%v33.59 tagesgebunden%')::text from pg_proc where proname = 'fn_grant_quiz_top3_pro'`);
            const trig = e.sql(`select count(*) from pg_trigger where tgname in ('trg_quiz_answers_tagesfrage', 'trg_quiz_answers_verify') and not tgisinternal`);
            const verify = e.sql(`select (prosrc like '%fn_quiz_option_correct%')::text from pg_proc where proname = 'fn_quiz_answers_verify'`);
            // Format B (Generator) — kennt nur die Fassung aus 20260907: eine ehrliche Antwort heute
            e.sql(`update public.daily_quizzes set options = '{"answers":["a","b","c"],"correct":1}'::jsonb where id = '${Q_HEUTE}'`);
            const b = antworte(e, h.U3, Q_HEUTE, 1);
            const fremd = antworte(e, h.U3, Q_ALT1, 0);
            if (t.split(',')[0] !== h.U2 || marke !== 'true' || trig !== '2' || verify !== 'true' || b.out !== 't' || !fehlt(fremd, /quiz_nicht_heute/))
              return { ok: false, warum: folge.join(' → ') + ': top=' + t + ' marke=' + marke + ' trigger=' + trig + ' verify=' + verify + ' B=' + kurz(b) + ' fremd=' + kurz(fremd) };
            reihen.push(folge[0].slice(0, 8) + '→' + folge[1].slice(0, 8));
          } finally { e.weg(); }
        }
        if (endstand[0] !== endstand[1] || endstand[0].split(' ').length !== 8) return { ok: false, warum: 'Endstand haengt von der Reihenfolge ab: ' + endstand.join('  ≠  ') };
        const g = aufbau(h, 'q2_top3_gp');
        try {
          fuellen(g);
          ohne(g, h, ['    where public._gs_quiz_antwort_zaehlt(qa.quiz_id, qa.answered_on)\n']);
          const gp = top(g);
          if (gp.split(',')[0] !== h.U1) return { ok: false, warum: 'Gegenprobe bleibt gruen: ' + gp };
        } finally { g.weg(); }
        return { ok: true, info: 'vorher U1 (3 Antworten an EINEM Tag) vorn · danach U2 (2 Tage) vorn, U1 zaehlt 1 · authenticated darf nicht vergeben · ' + reihen.join(' und ') + ': Marke bleibt, beide Trigger, Format B heute richtig, fremde Frage abgewiesen, Endstand (8 Funktionen) Rumpf fuer Rumpf gleich · Gegenprobe ohne Tagesregel: U1 wieder vorn' };
      } finally { d.weg(); }
    },
  },
  {
    // v33.59 (Schlusspruefung c1#3): der Jahrespreis war an den Tag gebunden, die OEFFENTLICHE Rangliste nicht —
    // total_correct zaehlte (Sync-Trigger und fn_quiz_leaderboard_upsert, mit GREATEST) JEDE Altantwort auf jede Frage.
    name: 'Rangliste · total_correct zaehlt nur Antworten am Tag ihrer Frage (dieselbe Regel wie der Jahrespreis) — 30 ehrliche bleiben 30, 30 + 180 beliebige fallen auf 30, Antworten aus der Zeit VOR der Historie bleiben, 20 an einem Luecken-Tag danach nicht; neue Antwort zaehlt weiter',
    lauf: async (h) => {
      const Q = (i) => 'bbbbbbbb-0000-4000-8000-' + String(i).padStart(12, '0');
      const fuellen = (d) => d.sql(`
        insert into public.daily_quizzes (id, question, options) select ('bbbbbbbb-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'tq' || i, ${OPT_A} from generate_series(1, 210) i;
        insert into public.daily_quiz_history (day_key, question_id) select current_date - 10 - i, ('bbbbbbbb-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid from generate_series(1, 30) i;
        -- Altbestand so, wie der Live-Trigger ihn hinterlassen hat: answered_on = Tag der Antwort, Sync-Trigger zaehlt mit
        alter table public.quiz_answers disable trigger trg_quiz_answers_verify;
        insert into public.quiz_answers (user_id, quiz_id, selected_option, is_correct, answered_on)
          select '${h.U1}', ('bbbbbbbb-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 0, true, current_date - 10 - i from generate_series(1, 30) i;
        insert into public.quiz_answers (user_id, quiz_id, selected_option, is_correct, answered_on)
          select '${h.U2}', ('bbbbbbbb-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 0, true, current_date - 10 - i from generate_series(1, 30) i;
        insert into public.quiz_answers (user_id, quiz_id, selected_option, is_correct, answered_on)
          select '${h.U2}', ('bbbbbbbb-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 0, true, current_date - 10 - (1 + i % 30) from generate_series(31, 210) i;
        -- U3: fuenf Antworten aus einer Zeit, fuer die es keine Historienzeile gibt — nicht pruefbar, also nicht gestrichen
        insert into public.quiz_answers (user_id, quiz_id, selected_option, is_correct, answered_on)
          select '${h.U3}', ('bbbbbbbb-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 0, true, current_date - 400 - i from generate_series(1, 5) i;
        -- U3 dazu: 20 beliebige Antworten an EINEM Tag, an dem die Historie schon lief, aber niemand die Frage holte
        -- (Luecke, oeffentlich lesbar — vor der Migration gibt es Trigger A nicht): widerlegbar, zaehlt nicht
        insert into public.quiz_answers (user_id, quiz_id, selected_option, is_correct, answered_on)
          select '${h.U3}', ('bbbbbbbb-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 0, true, current_date - 5 from generate_series(6, 25) i;
        alter table public.quiz_answers enable trigger trg_quiz_answers_verify;`);
      const lb = (d) => d.sql(`select string_agg(total_correct || '/' || total_attempts, ' ' order by user_id) from public.quiz_leaderboard`);
      const d = aufbau(h, 'q2_lb_tag');
      try {
        fuellen(d);
        const vor = lb(d);
        if (vor !== '30/30 210/210 25/25') return { ok: false, warum: 'Reproduktion: vor der Migration steht ' + vor + ' (erwartet 30/30 210/210 25/25) — der Fall misst nichts' };
        zweimal(d);
        const nach = lb(d);
        if (nach !== '30/30 30/30 5/5') return { ok: false, warum: 'nach der Migration: ' + nach + ' (erwartet 30/30 30/30 5/5)' };
        // die App: U2 antwortet heute richtig (Trigger zaehlt), danach der Push der Serie (RPC) — beide bleiben bei der Tageszaehlung
        const heute = antworte(d, h.U2, Q_HEUTE, 0);
        const rpc = d.als(h.U2, `select total_correct || '/' || total_attempts from public.fn_quiz_leaderboard_upsert(999, 999, 1, 1, null);`);
        const u1 = d.als(h.U1, `select total_correct || '/' || streak_max from public.fn_quiz_leaderboard_upsert(0, 0, 30, 30, null);`);
        if (!heute.ok || rpc.out !== '31/31' || u1.out !== '30/30' || lb(d) !== '30/30 31/31 5/5') return { ok: false, warum: 'App-Weg: heute ' + kurz(heute) + ' · RPC U2 ' + kurz(rpc) + ' · RPC U1 ' + kurz(u1) + ' · ' + lb(d) };
        // Gegenprobe: ohne die eine Regel (jede Antwort zaehlt) bleibt U2 bei 210
        const g = aufbau(h, 'q2_lb_tag_gp');
        try {
          fuellen(g);
          ohne(g, h, [['  SELECT COALESCE((SELECT h.question_id = p_quiz_id FROM public.daily_quiz_history h WHERE h.day_key = p_tag),', '  SELECT true OR COALESCE(null,']]);
          const gp = lb(g);
          if (gp.split(' ')[1] !== '210/210') return { ok: false, warum: 'Gegenprobe bleibt gruen: ' + gp };
        } finally { g.weg(); }
        // Gegenprobe 2 (Gegenpruefung r4): jeder Tag ohne Historienzeile zaehlt → die 20 Luecken-Antworten von U3 zaehlen
        const g2 = aufbau(h, 'q2_lb_tag_gp2');
        try {
          fuellen(g2);
          ohne(g2, h, [['                  p_tag < (SELECT min(h0.day_key) FROM public.daily_quiz_history h0),\n', '']]);
          const gp2 = lb(g2);
          if (gp2.split(' ')[2] !== '25/25') return { ok: false, warum: 'Gegenprobe Luecke bleibt gruen: ' + gp2 };
        } finally { g2.weg(); }
        return { ok: true, info: 'vorher ' + vor + ' · Migration 2× · nachher ' + nach + ' · heute richtig: Trigger und RPC (999 vom Client) → 31/31, U1 bleibt 30 mit Serie 30 · Gegenprobe ohne Tagesregel: U2 210 · Gegenprobe Luecke zaehlt: U3 25' };
      } finally { d.weg(); }
    },
  },
  {
    name: 'XP · fn_add_xp: vorher 2× 50\'000 XP (Hoechstlevel), danach hoechstens 1\'000 je Tag; der Weg der App (kleine Betraege, Rueckgabe xp/level) geht weiter',
    lauf: async (h) => {
      const d = aufbau(h, 'q2_xp');
      try {
        d.als(h.U1, `select * from public.fn_add_xp(50000);`);
        const vor = d.als(h.U1, `select xp||'/'||level from public.fn_add_xp(50000);`);
        if (!vor.ok || vor.out !== '100000/20') return { ok: false, warum: 'Angriff vor der Migration nicht gelungen: ' + kurz(vor) };
        const direkt = d.als(h.U2, `update public.profiles set xp = 99999 where id = '${h.U2}';`);
        if (!fehlt(direkt, /protected_column_change_denied/)) return { ok: false, warum: 'Spaltenschutz greift im Nachbau nicht: ' + kurz(direkt) };
        zweimal(d);
        const a = d.als(h.U2, `select xp||'/'||level from public.fn_add_xp(50000);`);
        const b = d.als(h.U2, `select xp||'/'||level from public.fn_add_xp(500);`);
        if (a.out !== '1000/6' || b.out !== '1000/6') return { ok: false, warum: 'nach der Migration: ' + kurz(a) + ' · zweiter Aufruf ' + kurz(b) };
        const app = d.als(h.U3, `select xp||'/'||level from public.fn_add_xp(5); select xp||'/'||level from public.fn_add_xp(10);`);
        if (app.out !== '5/1\n15/1') return { ok: false, warum: 'App-Weg (5, 10 XP): ' + kurz(app) };
        const tab = d.als(h.U3, `select count(*) from public.punkte_tageszuwachs;`);
        if (tab.ok) return { ok: false, warum: 'Kontingent-Tabelle fuer authenticated lesbar' };
        const g = aufbau(h, 'q2_xp_gp');
        try {
          ohne(g, h, ["    p_amount := public._gs_tageskontingent(v_uid, 'xp', p_amount, 1000)::int;\n"]);
          g.als(h.U2, `select * from public.fn_add_xp(1000);`);
          const gp = g.als(h.U2, `select xp from public.fn_add_xp(1000);`);
          if (gp.out !== '2000') return { ok: false, warum: 'Gegenprobe bleibt gruen: ' + kurz(gp) };
        } finally { g.weg(); }
        return { ok: true, info: 'vorher 100000 XP / Level 20 · danach 50000 → +1000, zweiter Aufruf +0 · App 5+10 → 15/1 · Tabelle gesperrt · Gegenprobe ohne Kontingent: 2× 1000 = 2000' };
      } finally { d.weg(); }
    },
  },
  {
    name: 'Erfolge · fn_achievements_bump(p_set => 999999) schaltete alle Stufen samt XP frei — danach hoechstens +50 je Metrik und Tag, ELO/Siege nur bis zum Server-Wert; direkte INSERTs gesperrt; +1-Weg und Lesen der App gehen weiter',
    lauf: async (h) => {
      const d = aufbau(h, 'q2_ach');
      try {
        const v1 = d.als(h.U1, `select public.fn_achievements_bump('scan_count', 999999, true)->>'xp_gain';`);
        const v2 = d.als(h.U1, `select public.fn_achievements_bump('quiz_elo', 5000, true)->>'xp_gain';`);
        const v3 = d.als(h.U1, `insert into public.user_achievements (user_id, achievement_slug) values ('${h.U1}', 'battle_first');`);
        const v4 = d.als(h.U1, `insert into public.achievement_progress (user_id, achievement_slug, current_value, target_value) values ('${h.U1}', 'x', 1, 1);`);
        if (v1.out !== '610' || v2.out !== '75' || !v3.ok || !v4.ok) return { ok: false, warum: 'Angriff vor der Migration nicht gelungen: ' + [v1, v2, v3, v4].map(kurz).join(' · ') };
        zweimal(d);
        const n1 = d.als(h.U2, `select (r->>'total')||'/'||(r->>'xp_gain') from (select public.fn_achievements_bump('scan_count', 999999, true) r) t;`);
        const n1b = d.als(h.U2, `select (r->>'total')||'/'||(r->>'xp_gain') from (select public.fn_achievements_bump('scan_count', 999999, true) r) t;`);
        const n2 = d.als(h.U2, `select (r->>'total')||'/'||(r->>'xp_gain') from (select public.fn_achievements_bump('quiz_elo', 5000, true) r) t;`);
        const n3 = d.als(h.U2, `select (r->>'total')||'/'||(r->>'xp_gain') from (select public.fn_achievements_bump('battles_won', 10, true) r) t;`);
        const n4 = d.als(h.U2, `select public.fn_achievements_bump('erfunden', 1, false)->>'error';`);
        if (n1.out !== '50/10' || n1b.out !== '50/0' || n2.out !== '1200/0' || n3.out !== '0/0' || n4.out !== 'bad_metric')
          return { ok: false, warum: 'nach der Migration: scan ' + kurz(n1) + ' · nochmal ' + kurz(n1b) + ' · elo ' + kurz(n2) + ' · siege ' + kurz(n3) + ' · erfunden ' + kurz(n4) };
        const d3 = d.als(h.U2, `insert into public.user_achievements (user_id, achievement_slug) values ('${h.U2}', 'battle_first');`);
        const d4 = d.als(h.U2, `update public.achievement_progress set current_value = 999999 where user_id = '${h.U2}';`);
        if (!fehlt(d3, /permission denied/) || !fehlt(d4, /permission denied/)) return { ok: false, warum: 'direkt: ' + kurz(d3) + ' · ' + kurz(d4) };
        // Weg der App: Server fuehrt ELO 1350 (Battle gewonnen) → elo_1300 frei; +1-Scan; Lesen der eigenen Zeilen
        d.sql(`update public.profiles set quiz_elo = 1350, battles_won = 1 where id = '${h.U3}'`);
        const a1 = d.als(h.U3, `select public.fn_achievements_bump('quiz_elo', 1350, true)->>'xp_gain'; select public.fn_achievements_bump('battles_won', 1, true)->>'xp_gain'; select public.fn_achievements_bump('scan_count', 1, false)->>'xp_gain';`);
        const a2 = d.als(h.U3, `select count(*) from public.achievement_progress; select count(*) from public.user_achievements; select xp from public.profiles where id = '${h.U3}';`);
        if (a1.out !== '75\n25\n10' || a2.out !== '6\n3\n110') return { ok: false, warum: 'App-Weg: ' + kurz(a1) + ' · lesen ' + kurz(a2) };
        const g = aufbau(h, 'q2_ach_gp');
        try {
          ohne(g, h, [["    v_total := LEAST(v_wunsch, COALESCE(v_server, 1200));\n", "    v_total := v_wunsch;\n"]]);
          const gp = g.als(h.U2, `select public.fn_achievements_bump('quiz_elo', 5000, true)->>'xp_gain';`);
          if (gp.out !== '75') return { ok: false, warum: 'Gegenprobe bleibt gruen: ' + kurz(gp) };
        } finally { g.weg(); }
        return { ok: true, info: 'vorher 610 XP aus scan_count + 75 aus erfundener ELO, direkte INSERTs ok · danach scan 50 (nur Stufe 1), nochmal +0 am selben Tag, ELO 1200, Siege 0, erfundene Metrik bad_metric, direkt permission denied · App: echte ELO 1350 → elo_1300, 1 Sieg, +1 Scan, eigene Zeilen lesbar (6 Fortschritt, 3 Erfolge) · Gegenprobe ohne ELO-Deckel: 75 XP' };
      } finally { d.weg(); }
    },
  },
  {
    name: 'Rangliste/Quests/Vitrine · Serie vom Client (9999) wird auf die Tage beim Server gekappt; quiz_ranking, fn_quiz_record_answer, fn_quest_increment(fremde uuid), user_quest_progress, PATCH showcase gesperrt; Scan-Quest per Trigger und Vitrine per RPC gehen weiter',
    lauf: async (h) => {
      const d = aufbau(h, 'q2_rang');
      try {
        d.sql(`insert into public.user_achievements (user_id, achievement_slug) values ('${h.U2}', 'scan_1')`);
        const vor = [
          d.als(h.U1, `select streak_max from public.fn_quiz_leaderboard_upsert(0, 0, 9999, 9999, null);`),
          d.als(h.U1, `insert into public.quiz_ranking (user_id, username, year, total_points) values ('${h.U1}', 'x', 2026, 999999);`),
          d.als(h.U1, `select public.fn_quiz_record_answer(true, 'x');`),
          d.als(h.U1, `select public.fn_quest_increment('${h.U3}', 'scans_count', 99); select public.fn_quest_increment('${h.U3}', 'scans_count', 1);`),
          d.als(h.U1, `update public.profiles set showcase_achievements = '{scan_1000,master_gardener}' where id = '${h.U1}';`),
        ];
        const xp3 = d.sql(`select xp from public.profiles where id = '${h.U3}'`);
        if (vor[0].out !== '9999' || !vor.slice(1).every(r => r.ok) || xp3 !== '50') return { ok: false, warum: 'Angriff vor der Migration nicht gelungen: ' + vor.map(kurz).join(' · ') + ' · fremde XP ' + xp3 };
        zweimal(d);
        const kapp = d.sql(`select streak_max||'/'||streak_current from public.quiz_leaderboard where user_id = '${h.U1}'`);
        if (kapp !== '0/0') return { ok: false, warum: 'Bestand nicht gekappt: ' + kapp };
        d.sql(`insert into public.quiz_answers (user_id, quiz_id, selected_option, answered_on) values ('${h.U2}', '${Q_HEUTE}', 0, current_date)`);
        const s = d.als(h.U2, `select streak_max||'/'||total_correct from public.fn_quiz_leaderboard_upsert(0, 0, 9999, 9999, null);`);
        if (s.out !== '1/1') return { ok: false, warum: 'Serie nach der Migration: ' + kurz(s) + ' (erwartet 1 Tag / 1 richtig)' };
        const nach = [
          d.als(h.U2, `insert into public.quiz_ranking (user_id, username, year) values ('${h.U2}', 'x', 2026);`),
          d.als(h.U2, `select public.fn_quiz_record_answer(true, 'x');`),
          d.als(h.U2, `select public.fn_quest_increment('${h.U1}', 'scans_count', 99);`),
          d.als(h.U2, `insert into public.user_quest_progress (user_id, quest_id, current_value, completed) select '${h.U2}', id, 3, true from public.quests;`),
          d.als(h.U2, `update public.profiles set showcase_achievements = '{scan_1000}' where id = '${h.U2}';`),
        ];
        const muster = [/permission denied/, /permission denied/, /permission denied/, /permission denied/, /showcase_nur_ueber_rpc/];
        const offen = nach.map((r, i) => fehlt(r, muster[i]) ? null : i + ': ' + kurz(r)).filter(Boolean);
        if (offen.length) return { ok: false, warum: 'nach der Migration noch offen: ' + offen.join(' · ') };
        const quest = d.als(h.U2, `insert into public.user_scans (user_id) values ('${h.U2}'); select current_value from public.user_quest_progress;`);
        const vitr = d.als(h.U2, `select public.fn_achievements_showcase_set(array['scan_1','scan_1000']); select array_to_string(showcase_achievements, ',') from public.profiles where id = '${h.U2}';`);
        const name = d.als(h.U2, `update public.profiles set display_name = 'Neu' where id = '${h.U2}' returning display_name;`);
        if (quest.out !== '1' || vitr.out !== 't\nscan_1' || name.out !== 'Neu') return { ok: false, warum: 'App-Weg: Quest ' + kurz(quest) + ' · Vitrine ' + kurz(vitr) + ' · Profil ' + kurz(name) };
        const g = aufbau(h, 'q2_rang_gp');
        try {
          ohne(g, h, ["    EXECUTE 'REVOKE ALL ON FUNCTION public.fn_quest_increment(uuid,text,integer) FROM PUBLIC, anon, authenticated';\n"]);
          const gp = g.als(h.U2, `select public.fn_quest_increment('${h.U1}', 'scans_count', 99);`);
          if (!gp.ok) return { ok: false, warum: 'Gegenprobe bleibt gruen: ' + kurz(gp) };
        } finally { g.weg(); }
        return { ok: true, info: 'vorher Serie 9999, quiz_ranking/record_answer/fremde Quest in zwei Aufrufen (+50 XP bei U3)/Vitrine ok · danach Bestand 0, neue Serie 1 (1 Tag), alles andere permission denied bzw. showcase_nur_ueber_rpc · Scan-Trigger zaehlt die Quest, Vitrine per RPC nur scan_1, Name aendern geht · Gegenprobe ohne REVOKE: fremde Quest wieder moeglich' };
      } finally { d.weg(); }
    },
  },
  {
    name: 'Battles · direkter INSERT mit fertigem Gegner-Ergebnis kostete ein fremdes Konto ELO und eine Niederlage — danach permission denied; unloesbare Fragen (correct_idx 9) abgewiesen; ein ehrliches Battle mit Fragen in App-Form laeuft bis resolved',
    lauf: async (h) => {
      const d = aufbau(h, 'q2_battle');
      const f3 = JSON.stringify([0, 1, 2].map(() => ({ correct_idx: 0 })));
      const app = JSON.stringify([0, 1, 2].map((i) => ({ q: 'Frage ' + i + ' — Bärlauch?', icon: '🌿', options: ['Bärlauch', 'Maiglöckchen', "Herbst-Zeitlose", 'Aronstab'], correct_idx: i, category: 'kraut' })));
      const boese = JSON.stringify([0, 1, 2].map(() => ({ q: 'x', options: ['a', 'b', 'c', 'd'], correct_idx: 9 })));
      const angriff = (uid) => d.als(uid, `insert into public.quiz_battles (challenger_id, opponent_id, questions, opponent_answers, opponent_score, status)
          values ('${uid}', '${h.U3}', '${f3}'::jsonb, '[]'::jsonb, 0, 'opponent_done') returning id;`);
      try {
        const a = angriff(h.U1);
        if (!a.ok) return { ok: false, warum: 'Angriff (INSERT) vor der Migration: ' + kurz(a) };
        const sub = d.als(h.U1, `select public.fn_quiz_battle_submit('${a.out}', '[{"ans":0},{"ans":0},{"ans":0}]'::jsonb)->>'you_won';`);
        const opfer = d.sql(`select quiz_elo||'/'||battles_lost from public.profiles where id = '${h.U3}'`);
        const vorBoese = d.als(h.U1, `select public.fn_quiz_battle_create('${boese}'::jsonb, '${h.U2}', false) is not null;`);
        if (sub.out !== '1' || opfer !== '1184/1' || vorBoese.out !== 't') return { ok: false, warum: 'Angriff nicht gelungen: submit ' + kurz(sub) + ' · Opfer ' + opfer + ' · unloesbar ' + kurz(vorBoese) };
        zweimal(d);
        const n = angriff(h.U2);
        if (!fehlt(n, /permission denied/)) return { ok: false, warum: 'INSERT nach der Migration: ' + kurz(n) };
        const nb = d.als(h.U2, `select public.fn_quiz_battle_create('${boese}'::jsonb, '${h.U1}', false);`);
        const nr = d.als(h.U2, `select public.fn_quiz_battle_find_or_create_random('${boese}'::jsonb);`);
        if (!fehlt(nb, /bad_questions/) || !fehlt(nr, /bad_questions/)) return { ok: false, warum: 'unloesbare Fragen: ' + kurz(nb) + ' · ' + kurz(nr) };
        const id = d.als(h.U2, `select public.fn_quiz_battle_create('${app.replace(/'/g, "''")}'::jsonb, '${h.U1}', false);`);
        if (!id.ok) return { ok: false, warum: 'ehrliches Battle anlegen: ' + kurz(id) };
        const s1 = d.als(h.U2, `select public.fn_quiz_battle_submit('${id.out}', '[{"ans":0},{"ans":1},{"ans":2}]'::jsonb)->>'status';`);
        const s2 = d.als(h.U1, `select public.fn_quiz_battle_submit('${id.out}', '[{"ans":0},{"ans":0},{"ans":0}]'::jsonb)->>'status';`);
        const rand = d.als(h.U3, `select public.fn_quiz_battle_find_or_create_random('${app.replace(/'/g, "''")}'::jsonb)->>'role';`);
        if (s1.out !== 'challenger_done' || s2.out !== 'resolved' || rand.out !== 'challenger') return { ok: false, warum: 'App-Weg: ' + kurz(s1) + ' · ' + kurz(s2) + ' · random ' + kurz(rand) };
        const g = aufbau(h, 'q2_battle_gp');
        try {
          ohne(g, h, ["    EXECUTE 'DROP POLICY IF EXISTS qb_challenger_create ON public.quiz_battles';\n", "    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.quiz_battles FROM anon, authenticated';\n"]);
          const gp = g.als(h.U1, `insert into public.quiz_battles (challenger_id, opponent_id, questions, opponent_score, status) values ('${h.U1}', '${h.U3}', '${f3}'::jsonb, 0, 'opponent_done');`);
          if (!gp.ok) return { ok: false, warum: 'Gegenprobe bleibt gruen: ' + kurz(gp) };
        } finally { g.weg(); }
        return { ok: true, info: 'vorher: INSERT mit opponent_score 0 → 3:0, Opfer ELO 1200→1184 und 1 Niederlage, unloesbare Fragen angenommen · danach INSERT permission denied, correct_idx 9 → bad_questions (create + random) · App-Fragen (Umlaut, Apostroph): challenger_done → resolved, Zufalls-Battle angelegt · Gegenprobe ohne DROP/REVOKE: INSERT wieder moeglich' };
      } finally { d.weg(); }
    },
  },
];
