-- ══════════════════════════════════════════════════════════════════════════
-- v33.59 · QUIZ, RANGLISTE, XP, ERFOLGE, BATTLES: was der Client sich selbst
--          gutschreiben konnte
-- ══════════════════════════════════════════════════════════════════════════
--
-- BEFUND (Live-DB, nur lesend gemessen am 10.11.2026: pg_policies, pg_proc mit
-- ACL und Quelltext, Tabellenrechte, Constraints, Trigger, cron.job):
--
--   1. Antworten auf JEDE Frage. quiz_answers_insert_auth prueft nur
--      auth.uid() = user_id; fn_quiz_answers_verify schlaegt die Option nach,
--      fragt aber nie, ob die Frage die von HEUTE ist (daily_quiz_history).
--      daily_quizzes ist samt Loesung oeffentlich lesbar. Wer alle ~215 Fragen
--      auf einmal beantwortet, hat mehr richtige Antworten als jeder ehrliche
--      Spieler (eine je Tag) — und am 31.12. um 23:00 UTC setzt der Cron
--      quiz-top3-yearend (fn_grant_quiz_top3_pro) fuer die drei Ersten
--      comp_tier = 'pro' fuer ein Jahr. Die offene Migration
--      20260907_quiz_antwort_formate.sql macht das sogar wirksamer (alle drei
--      Formate zaehlen) und bindet ebenfalls nicht an den Tag.
--   2. Punkte vom Client. fn_add_xp nimmt bis 50'000 XP je Aufruf, beliebig
--      oft (als SECURITY DEFINER am Spaltenschutz fn_profiles_guard_protected
--      vorbei; Hoechstlevel ab 22'000 XP). fn_achievements_bump(p_set => true)
--      uebernimmt jeden Wert und schaltet damit alle Abzeichen samt XP frei.
--      fn_quiz_leaderboard_upsert uebernimmt streak_max (Gleichstand-Regel der
--      oeffentlichen Rangliste). Direkte Schreib-Policies: user_achievements
--      (INSERT), achievement_progress (ALL), user_quest_progress (INSERT,
--      UPDATE ohne CHECK), quiz_ranking (INSERT/UPDATE); fn_quest_increment
--      nimmt eine FREMDE user_id an und ist fuer authenticated ausfuehrbar;
--      fn_quiz_record_answer bucht die Richtigkeit, die der Client meldet.
--      showcase_achievements laesst sich per PATCH auf profiles beliebig setzen.
--   3. Battles per direktem INSERT. qb_challenger_create prueft nur
--      challenger_id; opponent_id, opponent_score, status sind frei. Danach
--      bucht fn_quiz_battle_submit → _fn_quiz_battle_finalize ELO und eine
--      Niederlage beim Opfer, das nie gespielt hat. Und fn_quiz_battle_create /
--      _find_or_create_random nehmen jede Frage an (correct_idx 9 bei vier
--      Optionen ist fuer den Gegner unloesbar).
--
-- Die App schreibt keine dieser Tabellen direkt ausser quiz_answers (POST mit
-- return=representation, _dqAntwortSenden); alles andere geht ueber RPCs
-- (grep index.html, supabase/functions, cron.json am 10.11.2026).
--
-- WAS DIESE DATEI AENDERT (alles idempotent):
--   A) Ein EIGENER Trigger trg_quiz_answers_tagesfrage (BEFORE INSERT): eine
--      Antwort von authenticated/anon nur auf die Frage, die daily_quiz_history
--      fuer current_date fuehrt (derselbe Tag, den fn_get_daily_quiz waehlt —
--      UTC). Sonst Ablehnung 'quiz_nicht_heute' (check_violation). created_at
--      setzt der Server. Eine Antwort je Frage haelt schon
--      quiz_answers_user_id_quiz_id_key. Eigener Trigger statt einer Zeile im
--      Verify-Trigger, damit 20260907 (ersetzt fn_quiz_answers_verify) ihn
--      nicht ueberschreibt — die Reihenfolge der beiden Dateien ist egal.
--   B) fn_grant_quiz_top3_pro zaehlt nur Antworten, die am Tag ihrer Frage
--      gegeben wurden (answered_on = daily_quiz_history.day_key) — das laesst
--      sich nachtraeglich nicht mehr fuellen. Mit fn_quiz_option_correct (hier
--      identisch zu 20260907 mit angelegt). 20260907 laesst eine Fassung mit
--      der Marke „v33.59 tagesgebunden" seither stehen.
--   C) fn_quiz_leaderboard_upsert: Serien hoechstens so lang wie die Zahl der
--      Tage mit einer Antwort beim Server; bestehende Werte einmal gekappt.
--      Die oeffentliche Rangliste (total_correct/total_attempts — Sync-Trigger
--      fn_quiz_answers_sync_leaderboard und fn_quiz_leaderboard_upsert) zaehlt nach
--      DERSELBEN Regel wie B (_gs_quiz_antwort_zaehlt / _gs_quiz_stand); der
--      Bestand wird einmal gekappt. Die Regel: es zaehlt eine Antwort, fuer deren Tag
--      daily_quiz_history diese Frage fuehrt; ein Tag ohne Historienzeile zaehlt nur
--      VOR der ersten Historienzeile (Altbestand bleibt, Luecken danach nicht).
--   D) fn_add_xp: hoechstens 1'000 XP je Aufruf UND je Tag (UTC).
--      fn_achievements_bump: nur Metriken aus dem Katalog; quiz_elo und
--      battles_won hoechstens der Wert, den der Server fuehrt; alle anderen
--      wachsen hoechstens um 50 je Metrik und Tag. Buchhaltung in
--      punkte_tageszuwachs (RLS an, keine Policy, nur ueber die Funktionen).
--   E) Schreibrechte entzogen: quiz_leaderboard, quiz_ranking,
--      user_achievements, achievement_progress (Lesen bleibt),
--      user_quest_progress, quiz_battles; INSERT auf quiz_answers fuer anon.
--      fn_quest_increment und fn_quiz_record_answer nur noch service_role
--      (Aufrufer: die Trigger fn_quest_track_* als SECURITY DEFINER bzw.
--      niemand). showcase_achievements nur ueber fn_achievements_showcase_set.
--   F) Battles: fn_quiz_battle_create / _find_or_create_random pruefen jede
--      Frage (q Text, 2..6 verschiedene Optionen, correct_idx ganzzahlig im
--      Bereich) ueber _gs_battle_fragen_ok.
--
-- WAS DIE APP DAVON MERKT: nichts im ehrlichen Weg. Eine Antwort auf eine
-- gestrige Frage (Quiz vor Mitternacht UTC geoeffnet, danach beantwortet)
-- wird abgelehnt; _dqServerUrteil sagt dann „nicht beim Server angekommen".
-- Lokal gesammelte XP ueber 1'000 kommen ueber mehrere Tage an (gsXpBootSync
-- schiebt die Differenz bei jedem Start nach).
--
-- WAS DIESE DATEI NICHT LOEST: der Antwortschluessel bleibt oeffentlich
-- lesbar (daily_quizzes.options), und der Herausforderer eines Battles
-- liefert Fragen UND Loesungen. Die Rangliste ist damit weiter ein Spiel,
-- kein Nachweis — wer die heutige Frage richtig haben will, schaut nach. Das
-- zu schliessen ist ein Umbau des Quiz-Ablaufs (Urteil nur vom Server,
-- Spaltenrecht auf options) und eine Entscheidung.
--
-- Geprueft mit: node scripts/rls_check.js 20 (lokales Postgres: Live-Stand
-- vom 10.11.2026 im Wortlaut, Angriff vorher, Datei ZWEIMAL, Angriff nachher,
-- erlaubter Weg, Gegenproben; beide Reihenfolgen mit 20260907).
-- NICHT angewandt — Fernando.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── A) Nur die Frage von heute ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_quiz_answers_tagesfrage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- v33.59: nur Anfragen aus der App (PostgREST-Rollen); service_role und
  -- Migrationen (postgres) bleiben frei. SECURITY INVOKER, damit current_user
  -- die Rolle des Aufrufers ist — daily_quiz_history ist fuer beide lesbar.
  IF current_user IN ('authenticated', 'anon') THEN
    IF NOT EXISTS (SELECT 1 FROM public.daily_quiz_history h
                    WHERE h.day_key = current_date AND h.question_id = NEW.quiz_id) THEN
      RAISE EXCEPTION 'quiz_nicht_heute'
        USING ERRCODE = 'check_violation',
              HINT = 'Gewertet wird nur die Frage des Tages (fn_get_daily_quiz, UTC).';
    END IF;
    NEW.created_at := now();
  END IF;
  RETURN NEW;
END $function$;

COMMENT ON FUNCTION public.fn_quiz_answers_tagesfrage() IS
  'v33.59: eine Antwort aus der App nur auf die Frage, die daily_quiz_history fuer current_date fuehrt; created_at vom Server. Eigener Trigger, damit 20260907 (fn_quiz_answers_verify) ihn nicht ueberschreibt.';

DROP TRIGGER IF EXISTS trg_quiz_answers_tagesfrage ON public.quiz_answers;
CREATE TRIGGER trg_quiz_answers_tagesfrage
  BEFORE INSERT ON public.quiz_answers
  FOR EACH ROW EXECUTE FUNCTION public.fn_quiz_answers_tagesfrage();

REVOKE INSERT ON public.quiz_answers FROM anon;

-- ── B) Jahres-Pro nur aus Antworten am Tag ihrer Frage ─────────────────────
-- Dieselbe Regel wie 20260907 (1) — hier mit angelegt, damit diese Datei auch
-- VOR 20260907 laeuft. Wortgleich; wer sie aendert, aendert beide.
CREATE OR REPLACE FUNCTION public.fn_quiz_option_correct(p_options jsonb, p_idx integer)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'pg_catalog'
AS $$
  SELECT CASE
    WHEN p_options IS NULL OR p_idx IS NULL OR p_idx < 0 THEN NULL
    -- Format A · [{label|text, is_correct|correct, explanation}, …]
    WHEN jsonb_typeof(p_options) = 'array' THEN
      CASE
        WHEN p_idx >= jsonb_array_length(p_options) THEN NULL
        WHEN jsonb_typeof(p_options -> p_idx) <> 'object' THEN NULL
        WHEN (p_options -> p_idx) ? 'is_correct'
          THEN lower(p_options -> p_idx ->> 'is_correct') IN ('true', 't', '1')
        WHEN jsonb_typeof(p_options -> p_idx -> 'correct') = 'boolean'
          THEN (p_options -> p_idx ->> 'correct') = 'true'
        ELSE NULL
      END
    -- Format B · {answers:[…], correct:<int>}   (Generator, 138 Fragen)
    -- Format C · {choices:[…], correct:<int>}   (Altbestand, 60 Fragen)
    WHEN jsonb_typeof(p_options) = 'object'
         AND jsonb_typeof(COALESCE(p_options -> 'answers', p_options -> 'choices')) = 'array'
         AND jsonb_typeof(COALESCE(p_options -> 'correct', p_options -> 'correct_idx')) = 'number' THEN
      CASE
        WHEN p_idx >= jsonb_array_length(COALESCE(p_options -> 'answers', p_options -> 'choices')) THEN NULL
        ELSE p_idx = trunc((COALESCE(p_options -> 'correct', p_options -> 'correct_idx'))::text::numeric)::int
      END
    ELSE NULL
  END
$$;
REVOKE EXECUTE ON FUNCTION public.fn_quiz_option_correct(jsonb, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_quiz_option_correct(jsonb, integer) TO authenticated, anon, service_role;

-- Die EINE Regel, welche Antwort zaehlt (Jahrespreis UND oeffentliche Rangliste).
-- v33.59 (Schlusspruefung): vorher zaehlte nur der Jahrespreis tagesgebunden, die
-- Rangliste (Sync-Trigger, fn_quiz_leaderboard_upsert) jede Altantwort auf jede Frage.
-- Es zaehlt: fuer den Tag der Antwort fuehrt daily_quiz_history GENAU diese Frage.
-- Ein Tag OHNE Historienzeile zaehlt nur, wenn er VOR der ersten Historienzeile liegt
-- (Bestand aus der Zeit, bevor es die Historie gab — nicht pruefbar, ehrliche
-- Altspieler behalten ihre Zahl). Eine LUECKE danach ist kein Altbestand: die App holt
-- die Frage immer ueber fn_get_daily_quiz, das die Zeile anlegt — ein Tag ohne Zeile
-- heisst, niemand hat die Frage geholt. Die Historie ist oeffentlich lesbar; bis
-- Trigger A gilt, liessen sich an so einem Tag alle Fragen einreichen (Gegenpruefung
-- r4: 20 Antworten an einem Luecken-Tag zaehlten fuer Rangliste UND Jahrespreis).
-- Neue Antworten aus der App haben immer eine Historienzeile (Trigger A verlangt sie).
CREATE OR REPLACE FUNCTION public._gs_quiz_antwort_zaehlt(p_quiz_id uuid, p_tag date)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT COALESCE((SELECT h.question_id = p_quiz_id FROM public.daily_quiz_history h WHERE h.day_key = p_tag),
                  p_tag < (SELECT min(h0.day_key) FROM public.daily_quiz_history h0),
                  true)
$$;
REVOKE ALL ON FUNCTION public._gs_quiz_antwort_zaehlt(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._gs_quiz_antwort_zaehlt(uuid, date) TO service_role;

-- Stand einer Person nach dieser Regel: richtig · Versuche · Tage mit einer Antwort.
CREATE OR REPLACE FUNCTION public._gs_quiz_stand(p_uid uuid, OUT richtig integer, OUT versuche integer, OUT tage integer)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT (count(*) FILTER (WHERE qa.is_correct))::int, count(*)::int, count(DISTINCT qa.answered_on)::int
    FROM public.quiz_answers qa
   WHERE qa.user_id = p_uid
     AND public._gs_quiz_antwort_zaehlt(qa.quiz_id, qa.answered_on)
$$;
REVOKE ALL ON FUNCTION public._gs_quiz_stand(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._gs_quiz_stand(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_grant_quiz_top3_pro()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
declare v_ids uuid[]; v_n int := 0; v_uid uuid;
begin
  -- v33.59 tagesgebunden: es zaehlt nur eine Antwort, die am Tag ihrer Frage
  -- gegeben wurde (answered_on setzt der Trigger auf current_date, day_key
  -- fuehrt fn_get_daily_quiz; Regel in _gs_quiz_antwort_zaehlt, dieselbe wie die
  -- Rangliste). Vorher zaehlte jede Antwort auf jede Frage —
  -- und der Loesungsschluessel ist oeffentlich lesbar. Diese Marke laesst
  -- 20260907 die Funktion stehen; wer sie entfernt, macht das rueckgaengig.
  select array_agg(user_id) into v_ids from (
    select qa.user_id
    from public.quiz_answers qa
    join public.daily_quizzes dq on dq.id = qa.quiz_id
    where public._gs_quiz_antwort_zaehlt(qa.quiz_id, qa.answered_on)
    group by qa.user_id
    having count(*) filter (
             where coalesce(public.fn_quiz_option_correct(dq.options, qa.selected_option), false)
           ) >= 1
    order by count(*) filter (
               where coalesce(public.fn_quiz_option_correct(dq.options, qa.selected_option), false)
             ) desc,
             count(distinct qa.answered_on) desc,
             min(qa.created_at) asc
    limit 3
  ) t;
  if v_ids is null then
    insert into public.system_events(severity, source, event, detail)
    values ('info', 'quiz_reward', 'top3_grant', jsonb_build_object('granted', 0, 'reason', 'no_verified_players', 'source', 'quiz_answers_tagesgebunden'));
    return jsonb_build_object('ok', true, 'granted', 0);
  end if;
  foreach v_uid in array v_ids loop
    update public.profiles
       set comp_tier = 'pro',
           comp_expires_at = now() + interval '1 year',
           comp_granted_by = null,
           comp_granted_at = now()
     where id = v_uid and coalesce(comp_tier, '') <> 'lifetime';
    if found then v_n := v_n + 1; end if;
  end loop;
  insert into public.system_events(severity, source, event, detail)
  values (case when v_n > 0 then 'warn' else 'info' end, 'quiz_reward', 'top3_grant',
          jsonb_build_object('granted', v_n, 'user_ids', to_jsonb(v_ids), 'source', 'quiz_answers_tagesgebunden_yearend',
                             'expires', (now() + interval '1 year')));
  return jsonb_build_object('ok', true, 'granted', v_n, 'user_ids', to_jsonb(v_ids));
end
$function$;
REVOKE ALL ON FUNCTION public.fn_grant_quiz_top3_pro() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_grant_quiz_top3_pro() TO service_role;

-- ── C) Rangliste: Serien nicht laenger als die Tage beim Server ────────────
CREATE OR REPLACE FUNCTION public.fn_quiz_leaderboard_upsert(p_total_correct integer, p_total_attempts integer, p_streak_current integer, p_streak_max integer, p_display_name text DEFAULT NULL::text)
 RETURNS quiz_leaderboard
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE _uid uuid := (SELECT auth.uid()); _row public.quiz_leaderboard; _name text;
        _qa_correct int; _qa_attempts int; _qa_tage int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  -- v33.59: auch die Serie kommt nicht mehr ungeprueft vom Client — sie ist
  -- hoechstens so lang wie die Zahl der Tage, an denen der Server eine
  -- Antwort hat (streak_max entscheidet den Gleichstand der Rangliste).
  -- Zaehlung nach der Tagesregel (_gs_quiz_stand) — sonst trug total_correct jede
  -- Altantwort auf jede Frage in die oeffentliche Rangliste.
  SELECT s.richtig, s.versuche, s.tage INTO _qa_correct, _qa_attempts, _qa_tage
    FROM public._gs_quiz_stand(_uid) s;
  _qa_correct := COALESCE(_qa_correct, 0);
  _qa_attempts := COALESCE(_qa_attempts, 0);
  _qa_tage := COALESCE(_qa_tage, 0);
  _name := COALESCE(
    NULLIF(TRIM(p_display_name),''),
    (SELECT NULLIF(TRIM(display_name),'') FROM public.profiles WHERE id = _uid),
    'GreenScan-Mitglied');
  INSERT INTO public.quiz_leaderboard
    (user_id, display_name, total_correct, total_attempts, streak_current, streak_max, last_active_date, updated_at)
  VALUES
    (_uid, _name, _qa_correct, _qa_attempts,
     LEAST(GREATEST(0, COALESCE(p_streak_current, 0)), _qa_tage),
     LEAST(GREATEST(0, COALESCE(p_streak_max, 0)), _qa_tage), current_date, now())
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = _name,
    total_correct = GREATEST(public.quiz_leaderboard.total_correct, _qa_correct),
    total_attempts = GREATEST(public.quiz_leaderboard.total_attempts, _qa_attempts),
    streak_current = EXCLUDED.streak_current,
    streak_max = LEAST(GREATEST(public.quiz_leaderboard.streak_max, EXCLUDED.streak_max), _qa_tage),
    last_active_date = current_date,
    updated_at = now()
  RETURNING * INTO _row;
  RETURN _row;
END $function$;

-- Der Trigger, der die Rangliste in derselben Transaktion wie die Antwort nachzieht
-- (20260826, live): Wortlaut live (10.11.2026), nur die Zaehlung ueber _gs_quiz_stand.
-- GREATEST bleibt (eine Zaehlung aus einem aelteren Schnappschuss ist nur kleiner) —
-- deshalb wird der Bestand unten EINMAL gekappt, sonst bliebe die alte Zahl stehen.
CREATE OR REPLACE FUNCTION public.fn_quiz_answers_sync_leaderboard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _correct  int;
  _attempts int;
  _name     text;
BEGIN
  -- v33.59: nur Antworten, die nach der Tagesregel zaehlen (wie fn_grant_quiz_top3_pro)
  SELECT s.richtig, s.versuche INTO _correct, _attempts
    FROM public._gs_quiz_stand(NEW.user_id) s;

  _name := COALESCE(
    (SELECT NULLIF(TRIM(display_name), '') FROM public.profiles WHERE id = NEW.user_id),
    'GreenScan-Mitglied');

  INSERT INTO public.quiz_leaderboard
    (user_id, display_name, total_correct, total_attempts,
     streak_current, streak_max, last_active_date, updated_at)
  VALUES
    (NEW.user_id, _name, COALESCE(_correct, 0), COALESCE(_attempts, 0),
     0, 0, current_date, now())
  ON CONFLICT (user_id) DO UPDATE SET
    total_correct    = GREATEST(public.quiz_leaderboard.total_correct,  EXCLUDED.total_correct),
    total_attempts   = GREATEST(public.quiz_leaderboard.total_attempts, EXCLUDED.total_attempts),
    last_active_date = current_date,
    updated_at       = now();

  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION public.fn_quiz_answers_sync_leaderboard() FROM PUBLIC, anon, authenticated;

-- Bestand einmal kappen (idempotent: danach aendert sich nichts mehr) — Serien UND
-- Zaehler, nach derselben Regel. LEAST: ein Wert wird nie angehoben, nur gekappt.
UPDATE public.quiz_leaderboard ql
   SET streak_max     = LEAST(ql.streak_max,     s.tage),
       streak_current = LEAST(ql.streak_current, s.tage),
       total_correct  = LEAST(ql.total_correct,  s.richtig),
       total_attempts = LEAST(ql.total_attempts, s.versuche)
  FROM (SELECT l.user_id, st.richtig, st.versuche, st.tage
          FROM public.quiz_leaderboard l, public._gs_quiz_stand(l.user_id) st) s
 WHERE s.user_id = ql.user_id
   AND (ql.streak_max > s.tage OR ql.streak_current > s.tage
        OR ql.total_correct > s.richtig OR ql.total_attempts > s.versuche);

-- ── D) Tageskontingent fuer XP und Erfolge ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.punkte_tageszuwachs (
  user_id uuid   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  art     text   NOT NULL,
  tag     date   NOT NULL,
  menge   bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, art, tag)
);
COMMENT ON TABLE public.punkte_tageszuwachs IS
  'v33.59: wieviel XP (art=xp) bzw. Fortschritt je Erfolgs-Metrik (art=ach:<metric>) heute schon gutgeschrieben wurde. Nur ueber _gs_tageskontingent; Zeilen aelter als gestern raeumt dieselbe Funktion.';
ALTER TABLE public.punkte_tageszuwachs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.punkte_tageszuwachs FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._gs_tageskontingent(p_uid uuid, p_art text, p_wunsch bigint, p_max bigint)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_heute date := current_date; v_menge bigint; v_gut bigint;
BEGIN
  -- v33.59: bucht hoechstens p_max je Nutzer, Art und Tag; gibt zurueck, was gilt.
  IF p_uid IS NULL OR p_art IS NULL OR COALESCE(p_wunsch, 0) <= 0 OR COALESCE(p_max, 0) <= 0 THEN RETURN 0; END IF;
  DELETE FROM public.punkte_tageszuwachs WHERE user_id = p_uid AND tag < v_heute - 1;
  INSERT INTO public.punkte_tageszuwachs (user_id, art, tag, menge) VALUES (p_uid, p_art, v_heute, 0)
    ON CONFLICT (user_id, art, tag) DO NOTHING;
  SELECT menge INTO v_menge FROM public.punkte_tageszuwachs
   WHERE user_id = p_uid AND art = p_art AND tag = v_heute FOR UPDATE;
  v_gut := LEAST(p_wunsch, GREATEST(p_max - COALESCE(v_menge, 0), 0));
  IF v_gut > 0 THEN
    UPDATE public.punkte_tageszuwachs SET menge = menge + v_gut
     WHERE user_id = p_uid AND art = p_art AND tag = v_heute;
  END IF;
  RETURN v_gut;
END $function$;
REVOKE ALL ON FUNCTION public._gs_tageskontingent(uuid, text, bigint, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._gs_tageskontingent(uuid, text, bigint, bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_add_xp(p_amount integer)
 RETURNS TABLE(xp integer, level integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid   uuid := auth.uid();
  v_xp    integer;
  v_level integer := 1;
  v_table integer[] := ARRAY[0,100,250,450,700,1000,1400,1900,2500,3200,4000,5000,6200,7600,9200,11000,13000,15500,18500,22000];
  i       integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN p_amount := 0; END IF;
  -- v33.59: hoechstens 1'000 XP je Aufruf UND je Tag — vorher 50'000 je
  -- Aufruf, beliebig oft (Hoechstlevel mit einem Aufruf). Was darueber liegt,
  -- schiebt die App beim naechsten Start nach (gsXpBootSync).
  IF p_amount > 1000 THEN p_amount := 1000; END IF;
  IF p_amount > 0 THEN
    p_amount := public._gs_tageskontingent(v_uid, 'xp', p_amount, 1000)::int;
  END IF;

  IF p_amount = 0 THEN
    SELECT COALESCE(p.xp,0) INTO v_xp FROM public.profiles p WHERE p.id = v_uid;
  ELSE
    UPDATE public.profiles p
       SET xp = COALESCE(p.xp,0) + p_amount
     WHERE p.id = v_uid
     RETURNING p.xp INTO v_xp;
  END IF;

  IF v_xp IS NULL THEN v_xp := 0; END IF;

  FOR i IN REVERSE array_length(v_table,1)..1 LOOP
    IF v_xp >= v_table[i] THEN v_level := i; EXIT; END IF;
  END LOOP;

  IF p_amount > 0 THEN
    UPDATE public.profiles p SET level = v_level WHERE p.id = v_uid;
  ELSE
    SELECT COALESCE(p.level, v_level) INTO v_level FROM public.profiles p WHERE p.id = v_uid;
  END IF;

  RETURN QUERY SELECT v_xp AS xp, v_level AS level;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_achievements_bump(p_metric text, p_value bigint DEFAULT 1, p_set boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid       uuid := (SELECT auth.uid());
  v_prev      bigint;
  v_wunsch    bigint;
  v_server    bigint;
  v_total     bigint;
  v_unlocked  jsonb := '[]'::jsonb;
  v_xp_gain   integer := 0;
  rec         record;
  v_threshold bigint;
  v_active_total int;
  v_user_have   int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error','not_authed'); END IF;
  IF p_metric IS NULL OR length(p_metric) = 0 OR p_metric = 'all_achievements' THEN
    RETURN jsonb_build_object('error','bad_metric');
  END IF;
  -- v33.59: nur Metriken, die der Katalog kennt (sonst legte jeder Name eine
  -- Kontingent-Zeile an).
  IF NOT EXISTS (SELECT 1 FROM public.achievements_catalog c
                  WHERE c.is_active = true AND c.condition->>'type' = p_metric) THEN
    RETURN jsonb_build_object('error','bad_metric');
  END IF;

  -- bisheriger Stand dieser Metric (alle Slugs der Familie tragen denselben current_value)
  SELECT COALESCE(max(ap.current_value), 0) INTO v_prev
  FROM public.achievement_progress ap
  JOIN public.achievements_catalog c ON c.slug = ap.achievement_slug
  WHERE ap.user_id = v_uid AND c.condition->>'type' = p_metric;

  v_wunsch := CASE WHEN p_set THEN GREATEST(COALESCE(p_value, 0), 0) ELSE v_prev + GREATEST(COALESCE(p_value, 0), 0) END;

  -- v33.59: der Client meldet, der Server deckelt. Was der Server selbst
  -- fuehrt (ELO, Siege — von _fn_quiz_battle_finalize gebucht), gilt hoechstens
  -- in seiner Hoehe; alles andere waechst hoechstens um 50 je Metrik und Tag.
  -- Vorher schaltete ein p_set mit beliebigem Wert alle Stufen samt XP frei.
  IF p_metric = 'quiz_elo' THEN
    SELECT COALESCE(quiz_elo, 1200) INTO v_server FROM public.profiles WHERE id = v_uid;
    v_total := LEAST(v_wunsch, COALESCE(v_server, 1200));
  ELSIF p_metric = 'battles_won' THEN
    SELECT COALESCE(battles_won, 0) INTO v_server FROM public.profiles WHERE id = v_uid;
    v_total := LEAST(v_wunsch, COALESCE(v_server, 0));
  ELSIF v_wunsch > v_prev THEN
    v_total := v_prev + public._gs_tageskontingent(v_uid, 'ach:' || p_metric, v_wunsch - v_prev, 50);
  ELSE
    v_total := v_wunsch;
  END IF;

  -- pro Achievement dieser Metric: Progress upserten + ggf. Tier freischalten
  FOR rec IN
    SELECT c.slug, c.title, c.icon, c.rarity, c.xp_reward,
           COALESCE((c.condition->>'value')::bigint, 1) AS threshold
    FROM public.achievements_catalog c
    WHERE c.is_active = true AND c.condition->>'type' = p_metric
  LOOP
    v_threshold := rec.threshold;
    INSERT INTO public.achievement_progress (user_id, achievement_slug, current_value, target_value, last_updated,
                                             unlocked_at)
    VALUES (v_uid, rec.slug, v_total, v_threshold, now(),
            CASE WHEN v_total >= v_threshold THEN now() ELSE NULL END)
    ON CONFLICT (user_id, achievement_slug) DO UPDATE
      SET current_value = v_total,
          target_value  = v_threshold,
          last_updated  = now(),
          unlocked_at   = COALESCE(public.achievement_progress.unlocked_at,
                                   CASE WHEN v_total >= v_threshold THEN now() ELSE NULL END);

    IF v_total >= v_threshold THEN
      INSERT INTO public.user_achievements (user_id, achievement_slug, unlocked_at, metadata)
      VALUES (v_uid, rec.slug, now(), jsonb_build_object('via','bump','metric',p_metric))
      ON CONFLICT (user_id, achievement_slug) DO NOTHING;
      IF FOUND THEN
        v_xp_gain  := v_xp_gain + COALESCE(rec.xp_reward, 0);
        v_unlocked := v_unlocked || jsonb_build_object(
          'slug', rec.slug, 'title', rec.title, 'icon', rec.icon,
          'rarity', rec.rarity, 'xp', COALESCE(rec.xp_reward,0));
      END IF;
    END IF;
  END LOOP;

  -- Capstone „master_gardener" (all_achievements): wenn ALLE übrigen aktiven Achievements erreicht
  IF jsonb_array_length(v_unlocked) > 0 THEN
    SELECT count(*) INTO v_active_total
      FROM public.achievements_catalog
     WHERE is_active = true AND slug <> 'master_gardener';
    SELECT count(*) INTO v_user_have
      FROM public.user_achievements ua
      JOIN public.achievements_catalog c ON c.slug = ua.achievement_slug
     WHERE ua.user_id = v_uid AND c.is_active = true AND ua.achievement_slug <> 'master_gardener';

    INSERT INTO public.achievement_progress (user_id, achievement_slug, current_value, target_value, last_updated, unlocked_at)
    VALUES (v_uid, 'master_gardener', v_user_have, GREATEST(v_active_total,1), now(),
            CASE WHEN v_user_have >= v_active_total THEN now() ELSE NULL END)
    ON CONFLICT (user_id, achievement_slug) DO UPDATE
      SET current_value = v_user_have, target_value = GREATEST(v_active_total,1), last_updated = now(),
          unlocked_at = COALESCE(public.achievement_progress.unlocked_at,
                                 CASE WHEN v_user_have >= v_active_total THEN now() ELSE NULL END);

    IF v_user_have >= v_active_total THEN
      INSERT INTO public.user_achievements (user_id, achievement_slug, unlocked_at, metadata)
      VALUES (v_uid, 'master_gardener', now(), jsonb_build_object('via','capstone'))
      ON CONFLICT (user_id, achievement_slug) DO NOTHING;
      IF FOUND THEN
        SELECT v_xp_gain + COALESCE(xp_reward,0) INTO v_xp_gain
          FROM public.achievements_catalog WHERE slug = 'master_gardener';
        v_unlocked := v_unlocked || (
          SELECT jsonb_build_object('slug','master_gardener','title',title,'icon',icon,'rarity',rarity,'xp',COALESCE(xp_reward,0))
          FROM public.achievements_catalog WHERE slug = 'master_gardener');
      END IF;
    END IF;
  END IF;

  -- XP gutschreiben (nur bei neuen Unlocks)
  IF v_xp_gain > 0 THEN
    UPDATE public.profiles SET xp = COALESCE(xp,0) + v_xp_gain, updated_at = now() WHERE id = v_uid;
  END IF;

  RETURN jsonb_build_object('metric', p_metric, 'total', v_total, 'xp_gain', v_xp_gain, 'unlocked', v_unlocked);
END $function$;

-- ── E) Direkte Schreibwege schliessen — geschrieben wird nur ueber RPCs ────
DO $e$
BEGIN
  IF to_regclass('public.quiz_leaderboard') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS ql_own_ins ON public.quiz_leaderboard';
    EXECUTE 'DROP POLICY IF EXISTS ql_own_upd ON public.quiz_leaderboard';
    EXECUTE 'DROP POLICY IF EXISTS ql_own_del ON public.quiz_leaderboard';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.quiz_leaderboard FROM anon, authenticated';
  END IF;
  IF to_regclass('public.quiz_ranking') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS quiz_ranking_upsert_own ON public.quiz_ranking';
    EXECUTE 'DROP POLICY IF EXISTS quiz_ranking_update_own ON public.quiz_ranking';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.quiz_ranking FROM anon, authenticated';
  END IF;
  IF to_regclass('public.user_achievements') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS user_achievements_own_insert ON public.user_achievements';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.user_achievements FROM anon, authenticated';
  END IF;
  IF to_regclass('public.achievement_progress') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS ap_own ON public.achievement_progress';
    EXECUTE 'DROP POLICY IF EXISTS ap_own_select ON public.achievement_progress';
    EXECUTE 'CREATE POLICY ap_own_select ON public.achievement_progress FOR SELECT USING (user_id = (SELECT auth.uid()))';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.achievement_progress FROM anon, authenticated';
  END IF;
  IF to_regclass('public.user_quest_progress') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS quest_progress_insert_own ON public.user_quest_progress';
    EXECUTE 'DROP POLICY IF EXISTS quest_progress_update_own ON public.user_quest_progress';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.user_quest_progress FROM anon, authenticated';
  END IF;
  IF to_regclass('public.quiz_battles') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS qb_challenger_create ON public.quiz_battles';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.quiz_battles FROM anon, authenticated';
  END IF;
  IF to_regprocedure('public.fn_quest_increment(uuid,text,integer)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.fn_quest_increment(uuid,text,integer) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.fn_quest_increment(uuid,text,integer) TO service_role';
  END IF;
  IF to_regprocedure('public.fn_quiz_record_answer(boolean,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.fn_quiz_record_answer(boolean,text) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.fn_quiz_record_answer(boolean,text) TO service_role';
  END IF;
END $e$;

-- Vitrine: nur freigeschaltete Erfolge, nur ueber fn_achievements_showcase_set
-- (SECURITY DEFINER → current_user ist dort der Eigentuemer, nicht die App).
CREATE OR REPLACE FUNCTION public.fn_profiles_showcase_pruefen()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- v33.59: ein PATCH auf profiles stellte Erfolge in die Vitrine, die man nie hatte.
  IF current_user IN ('authenticated', 'anon')
     AND NEW.showcase_achievements IS DISTINCT FROM OLD.showcase_achievements THEN
    RAISE EXCEPTION 'showcase_nur_ueber_rpc' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS trg_profiles_showcase_pruefen ON public.profiles;
CREATE TRIGGER trg_profiles_showcase_pruefen
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_profiles_showcase_pruefen();

-- ── F) Battles: nur loesbare Fragen ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._gs_battle_fragen_ok(p jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'pg_catalog'
AS $function$
DECLARE e jsonb; o jsonb; n int; ci text;
BEGIN
  -- v33.59: jede Frage ein Objekt mit Text, 2..6 verschiedenen Optionen und
  -- einem correct_idx, der auf eine davon zeigt. Vorher nahm der Server jede
  -- Form an — correct_idx 9 bei vier Optionen ist fuer den Gegner unloesbar.
  IF p IS NULL OR jsonb_typeof(p) <> 'array' THEN RETURN false; END IF;
  FOR e IN SELECT x FROM jsonb_array_elements(p) x LOOP
    IF jsonb_typeof(e) <> 'object' THEN RETURN false; END IF;
    IF jsonb_typeof(e -> 'q') <> 'string' OR length(e ->> 'q') NOT BETWEEN 1 AND 500 THEN RETURN false; END IF;
    IF jsonb_typeof(e -> 'options') <> 'array' THEN RETURN false; END IF;
    n := jsonb_array_length(e -> 'options');
    IF n NOT BETWEEN 2 AND 6 THEN RETURN false; END IF;
    FOR o IN SELECT y FROM jsonb_array_elements(e -> 'options') y LOOP
      IF jsonb_typeof(o) <> 'string' OR length(o #>> '{}') NOT BETWEEN 1 AND 300 THEN RETURN false; END IF;
    END LOOP;
    IF (SELECT count(DISTINCT y #>> '{}') FROM jsonb_array_elements(e -> 'options') y) <> n THEN RETURN false; END IF;
    IF jsonb_typeof(e -> 'correct_idx') <> 'number' THEN RETURN false; END IF;
    ci := e ->> 'correct_idx';
    IF ci !~ '^[0-9]{1,2}$' OR ci::int >= n THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END $function$;

CREATE OR REPLACE FUNCTION public.fn_quiz_battle_create(p_questions jsonb, p_opponent_id uuid DEFAULT NULL::uuid, p_random_match boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_id  uuid;
  v_len int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authed'; END IF;
  IF p_opponent_id = v_uid THEN RAISE EXCEPTION 'self_match'; END IF;
  IF p_questions IS NULL OR jsonb_typeof(p_questions) <> 'array' THEN RAISE EXCEPTION 'bad_questions'; END IF;
  v_len := jsonb_array_length(p_questions);
  IF v_len < 3 OR v_len > 10 THEN RAISE EXCEPTION 'bad_question_count'; END IF;
  IF NOT public._gs_battle_fragen_ok(p_questions) THEN RAISE EXCEPTION 'bad_questions'; END IF;   -- v33.59

  INSERT INTO public.profiles (id) VALUES (v_uid) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.quiz_battles (challenger_id, opponent_id, status, questions, is_random_match)
  VALUES (v_uid, p_opponent_id, 'open', p_questions, COALESCE(p_random_match,false))
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;

CREATE OR REPLACE FUNCTION public.fn_quiz_battle_find_or_create_random(p_questions jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_my_elo int;
  v_match uuid;
  v_id uuid;
  v_len int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authed'; END IF;
  IF p_questions IS NULL OR jsonb_typeof(p_questions) <> 'array' THEN RAISE EXCEPTION 'bad_questions'; END IF;
  v_len := jsonb_array_length(p_questions);
  IF v_len < 3 OR v_len > 10 THEN RAISE EXCEPTION 'bad_question_count'; END IF;
  IF NOT public._gs_battle_fragen_ok(p_questions) THEN RAISE EXCEPTION 'bad_questions'; END IF;   -- v33.59

  INSERT INTO public.profiles (id) VALUES (v_uid) ON CONFLICT (id) DO NOTHING;
  SELECT COALESCE(quiz_elo,1200) INTO v_my_elo FROM public.profiles WHERE id = v_uid;
  v_my_elo := COALESCE(v_my_elo, 1200);

  SELECT b.id INTO v_match
  FROM public.quiz_battles b
  JOIN public.profiles pc ON pc.id = b.challenger_id
  WHERE b.is_random_match = true
    AND b.opponent_id IS NULL
    AND b.status IN ('open','challenger_done')
    AND b.challenger_id <> v_uid
    AND b.expires_at > now()
    AND COALESCE(pc.quiz_elo,1200) BETWEEN (v_my_elo - 250) AND (v_my_elo + 250)
  ORDER BY b.created_at ASC
  LIMIT 1
  FOR UPDATE OF b SKIP LOCKED;

  IF v_match IS NOT NULL THEN
    UPDATE public.quiz_battles
      SET opponent_id = v_uid,
          status = CASE WHEN status = 'open' THEN 'accepted' ELSE status END,
          updated_at = now()
      WHERE id = v_match AND opponent_id IS NULL;
    RETURN jsonb_build_object('battle_id', v_match, 'matched', true, 'role', 'opponent');
  END IF;

  INSERT INTO public.quiz_battles (challenger_id, opponent_id, status, questions, is_random_match)
  VALUES (v_uid, NULL, 'open', p_questions, true)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('battle_id', v_id, 'matched', false, 'role', 'challenger');
END $function$;

COMMIT;
