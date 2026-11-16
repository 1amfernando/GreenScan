-- Live-Stand der Quiz-/Punkte-Funktionen, live gelesen 10.11.2026 (pg_get_functiondef,
-- nur lesend; Quelle: Momentaufnahme der Sicherheitspruefung). Wortlaut, nicht veraendert.
-- Fixture fuer scripts/rls/20_quiz.js — keine Migration, wird nie angewandt.
-- Kein Geheimnis darin (geprueft beim Herausziehen).

-- ===== _fn_quiz_battle_finalize(p_battle_id uuid) | secdef=True | config=['search_path=public'] | acl={postgres=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public._fn_quiz_battle_finalize(p_battle_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_b record;
  v_elo_c int; v_elo_o int;
  v_expected_c numeric; v_K constant int := 32;
  v_change_c int; v_change_o int;
  v_winner uuid;
BEGIN
  SELECT * INTO v_b FROM public.quiz_battles WHERE id = p_battle_id FOR UPDATE;
  IF NOT FOUND OR v_b.resolved_at IS NOT NULL THEN RETURN; END IF;
  IF v_b.challenger_score IS NULL OR v_b.opponent_score IS NULL OR v_b.opponent_id IS NULL THEN RETURN; END IF;

  -- Sicherstellen, dass beide profiles-Zeilen existieren (nur id ist NOT NULL ohne Default)
  INSERT INTO public.profiles (id) VALUES (v_b.challenger_id) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profiles (id) VALUES (v_b.opponent_id)   ON CONFLICT (id) DO NOTHING;

  SELECT quiz_elo INTO v_elo_c FROM public.profiles WHERE id = v_b.challenger_id;
  SELECT quiz_elo INTO v_elo_o FROM public.profiles WHERE id = v_b.opponent_id;
  v_elo_c := coalesce(v_elo_c, 1200); v_elo_o := coalesce(v_elo_o, 1200);
  v_expected_c := 1.0 / (1.0 + power(10.0, (v_elo_o - v_elo_c) / 400.0));

  IF v_b.challenger_score > v_b.opponent_score THEN
    v_change_c := round(v_K * (1 - v_expected_c)); v_change_o := -v_change_c;
    v_winner := v_b.challenger_id;
    UPDATE public.profiles SET battles_won  = battles_won  + 1 WHERE id = v_b.challenger_id;
    UPDATE public.profiles SET battles_lost = battles_lost + 1 WHERE id = v_b.opponent_id;
  ELSIF v_b.challenger_score < v_b.opponent_score THEN
    v_change_c := round(v_K * (0 - v_expected_c)); v_change_o := -v_change_c;
    v_winner := v_b.opponent_id;
    UPDATE public.profiles SET battles_lost = battles_lost + 1 WHERE id = v_b.challenger_id;
    UPDATE public.profiles SET battles_won  = battles_won  + 1 WHERE id = v_b.opponent_id;
  ELSE
    v_change_c := round(v_K * (0.5 - v_expected_c)); v_change_o := -v_change_c;
    v_winner := NULL;
    UPDATE public.profiles SET battles_tied = battles_tied + 1 WHERE id = v_b.challenger_id;
    UPDATE public.profiles SET battles_tied = battles_tied + 1 WHERE id = v_b.opponent_id;
  END IF;

  -- ELO clamped ≥ 100 (kein Negativ-Rating)
  UPDATE public.profiles SET quiz_elo = GREATEST(100, quiz_elo + v_change_c) WHERE id = v_b.challenger_id;
  UPDATE public.profiles SET quiz_elo = GREATEST(100, quiz_elo + v_change_o) WHERE id = v_b.opponent_id;

  UPDATE public.quiz_battles
    SET winner_id = v_winner,
        elo_change_challenger = v_change_c, elo_change_opponent = v_change_o,
        status = 'resolved', resolved_at = now(), updated_at = now()
    WHERE id = p_battle_id;
END $function$;

-- ===== fn_achievements_bump(p_metric text, p_value bigint, p_set boolean) | secdef=True | config=['search_path=public'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_achievements_bump(p_metric text, p_value bigint DEFAULT 1, p_set boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid       uuid := (SELECT auth.uid());
  v_prev      bigint;
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

  -- bisheriger Stand dieser Metric (alle Slugs der Familie tragen denselben current_value)
  SELECT COALESCE(max(ap.current_value), 0) INTO v_prev
  FROM public.achievement_progress ap
  JOIN public.achievements_catalog c ON c.slug = ap.achievement_slug
  WHERE ap.user_id = v_uid AND c.condition->>'type' = p_metric;

  v_total := CASE WHEN p_set THEN GREATEST(p_value, 0) ELSE v_prev + GREATEST(p_value, 0) END;

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

-- ===== fn_add_xp(p_amount integer) | secdef=True | config=['search_path=public'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_add_xp(p_amount integer)
 RETURNS TABLE(xp integer, level integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  IF p_amount > 50000 THEN p_amount := 50000; END IF;

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

-- ===== fn_achievements_showcase_set(p_slugs text[]) | secdef=True | config=['search_path=public'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_achievements_showcase_set(p_slugs text[])
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid   uuid := (SELECT auth.uid());
  v_valid text[];
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  -- nur tatsächlich freigeschaltete Slugs, max 5, Reihenfolge erhalten
  SELECT array_agg(s ORDER BY ord) INTO v_valid
  FROM (
    SELECT s, ord FROM unnest(COALESCE(p_slugs, '{}')) WITH ORDINALITY AS t(s, ord)
    WHERE EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = v_uid AND ua.achievement_slug = t.s)
    LIMIT 5
  ) q;
  UPDATE public.profiles
     SET showcase_achievements = COALESCE(v_valid, '{}'), updated_at = now()
   WHERE id = v_uid;
  RETURN true;
END $function$;

-- ===== fn_get_daily_quiz() | secdef=True | config=['search_path=public, pg_catalog'] | acl={=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_get_daily_quiz()
 RETURNS TABLE(id uuid, question text, options jsonb, category text, xp_reward integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  today_key date := current_date;
  picked_id uuid;
BEGIN
  SELECT h.question_id INTO picked_id FROM public.daily_quiz_history h WHERE h.day_key = today_key;
  IF picked_id IS NOT NULL THEN
    RETURN QUERY SELECT q.id, q.question, q.options, q.category, q.xp_reward
      FROM public.daily_quizzes q WHERE q.id = picked_id AND q.is_active = true;
    RETURN;
  END IF;
  SELECT q.id INTO picked_id FROM public.daily_quizzes q
  WHERE q.is_active = true
    AND NOT EXISTS (SELECT 1 FROM public.daily_quiz_history h
      WHERE h.question_id = q.id AND h.day_key > today_key - INTERVAL '730 days')
  ORDER BY md5(today_key::text || q.id::text) LIMIT 1;
  IF picked_id IS NULL THEN
    SELECT q.id INTO picked_id FROM public.daily_quizzes q
    WHERE q.is_active = true ORDER BY md5(today_key::text || q.id::text) LIMIT 1;
  END IF;
  IF picked_id IS NOT NULL THEN
    INSERT INTO public.daily_quiz_history (day_key, question_id) VALUES (today_key, picked_id)
    ON CONFLICT (day_key) DO NOTHING;
    RETURN QUERY SELECT q.id, q.question, q.options, q.category, q.xp_reward
      FROM public.daily_quizzes q WHERE q.id = picked_id;
  END IF;
END $function$;

-- ===== fn_grant_quiz_top3_pro() | secdef=True | config=['search_path=public, pg_catalog'] | acl={postgres=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_grant_quiz_top3_pro()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare v_ids uuid[]; v_n int := 0; v_uid uuid;
begin
  -- v30.95: Ranking aus quiz_answers, aber JEDE Zeile wird gegen
  -- daily_quizzes.options gegengeprueft. Der frueher hier stehende Satz
  -- "FK + UNIQUE = unfaelschbarer Korrekt-Count" war falsch: beide begrenzen
  -- die Anzahl Zeilen, nicht den Wahrheitswert. Zeilen ohne selected_option
  -- (alle 24 Altzeilen) sind nicht ueberpruefbar und zaehlen nicht mit.
  select array_agg(user_id) into v_ids from (
    select qa.user_id
    from public.quiz_answers qa
    join public.daily_quizzes dq on dq.id = qa.quiz_id
    group by qa.user_id
    having count(*) filter (
             where qa.selected_option is not null
               and coalesce((dq.options -> qa.selected_option ->> 'is_correct')::boolean, false)
           ) >= 1
    order by count(*) filter (
               where qa.selected_option is not null
                 and coalesce((dq.options -> qa.selected_option ->> 'is_correct')::boolean, false)
             ) desc,
             count(distinct qa.answered_on) desc,
             min(qa.created_at) asc
    limit 3
  ) t;
  if v_ids is null then
    insert into public.system_events(severity, source, event, detail)
    values ('info', 'quiz_reward', 'top3_grant', jsonb_build_object('granted', 0, 'reason', 'no_verified_players', 'source', 'quiz_answers_verified'));
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
          jsonb_build_object('granted', v_n, 'user_ids', to_jsonb(v_ids), 'source', 'quiz_answers_verified_yearend',
                             'expires', (now() + interval '1 year')));
  return jsonb_build_object('ok', true, 'granted', v_n, 'user_ids', to_jsonb(v_ids));
end
$function$;

-- ===== fn_profiles_guard_protected() | secdef=False | config=['search_path=public'] | acl={=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_profiles_guard_protected()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('authenticated','anon') AND NOT coalesce(is_admin_user(), false) THEN
    IF NEW.tier             IS DISTINCT FROM OLD.tier
       OR NEW.is_admin      IS DISTINCT FROM OLD.is_admin
       OR NEW.role          IS DISTINCT FROM OLD.role
       OR NEW.is_expert     IS DISTINCT FROM OLD.is_expert
       OR NEW.is_lifetime   IS DISTINCT FROM OLD.is_lifetime
       OR NEW.comp_tier        IS DISTINCT FROM OLD.comp_tier
       OR NEW.comp_expires_at  IS DISTINCT FROM OLD.comp_expires_at
       OR NEW.comp_granted_by  IS DISTINCT FROM OLD.comp_granted_by
       OR NEW.role_assigned_by IS DISTINCT FROM OLD.role_assigned_by
       OR NEW.role_assigned_at IS DISTINCT FROM OLD.role_assigned_at
       OR NEW.quiz_elo      IS DISTINCT FROM OLD.quiz_elo
       OR NEW.battles_won   IS DISTINCT FROM OLD.battles_won
       OR NEW.battles_lost  IS DISTINCT FROM OLD.battles_lost
       OR NEW.battles_tied  IS DISTINCT FROM OLD.battles_tied
       OR NEW.level         IS DISTINCT FROM OLD.level
       OR NEW.xp            IS DISTINCT FROM OLD.xp
    THEN RAISE EXCEPTION 'protected_column_change_denied' USING ERRCODE='insufficient_privilege'; END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- ===== fn_quest_increment(_user_id uuid, _metric text, _delta integer) | secdef=True | config=['search_path=public, pg_catalog'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_quest_increment(_user_id uuid, _metric text, _delta integer DEFAULT 1)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE _q record;
BEGIN
  FOR _q IN
    SELECT id, target_value, xp_reward FROM public.quests
    WHERE is_active = true AND target_metric = _metric
      AND NOW() BETWEEN starts_at AND ends_at
  LOOP
    INSERT INTO public.user_quest_progress(user_id, quest_id, current_value)
    VALUES (_user_id, _q.id, _delta)
    ON CONFLICT (user_id, quest_id) DO UPDATE
      SET current_value = LEAST(_q.target_value, public.user_quest_progress.current_value + _delta),
          completed = (LEAST(_q.target_value, public.user_quest_progress.current_value + _delta) >= _q.target_value),
          completed_at = CASE WHEN public.user_quest_progress.current_value + _delta >= _q.target_value
                              AND public.user_quest_progress.completed = false
                              THEN NOW() ELSE public.user_quest_progress.completed_at END;
    -- XP-Reward bei Vollendung (einmalig)
    IF EXISTS (SELECT 1 FROM public.user_quest_progress WHERE user_id=_user_id AND quest_id=_q.id AND completed=true AND rewarded=false) THEN
      UPDATE public.profiles SET xp = COALESCE(xp,0) + _q.xp_reward WHERE id = _user_id;
      UPDATE public.user_quest_progress SET rewarded=true WHERE user_id=_user_id AND quest_id=_q.id;
      PERFORM public.fn_create_notification(_user_id, 'achievement',
        '🏆 Quest abgeschlossen!', '+' || _q.xp_reward || ' XP', NULL, 'quest:' || _q.id::text);
    END IF;
  END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END; $function$;

-- ===== fn_quest_track_scan() | secdef=True | config=['search_path=public, pg_catalog'] | acl={postgres=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_quest_track_scan()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF NEW.user_id IS NOT NULL THEN PERFORM public.fn_quest_increment(NEW.user_id, 'scans_count', 1); END IF;
  RETURN NEW;
END; $function$;

-- ===== fn_quiz_answers_sync_leaderboard() | secdef=True | config=['search_path=public, pg_temp'] | acl={postgres=X/postgres,service_role=X/postgres}
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
  SELECT count(*) FILTER (WHERE is_correct), count(*)
    INTO _correct, _attempts
    FROM public.quiz_answers
    WHERE user_id = NEW.user_id;

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

-- ===== fn_quiz_answers_verify() | secdef=True | config=['search_path=public, pg_catalog'] | acl={postgres=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_quiz_answers_verify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_correct boolean;
  v_xp      integer;
BEGIN
  -- Ohne nachschlagbaren Index ist die Antwort nicht überprüfbar → gilt als falsch.
  IF NEW.quiz_id IS NULL OR NEW.selected_option IS NULL OR NEW.selected_option < 0 THEN
    NEW.is_correct := false;
    NEW.xp_earned  := 0;
    NEW.answered_on := CURRENT_DATE;
    RETURN NEW;
  END IF;

  SELECT COALESCE((q.options -> NEW.selected_option ->> 'is_correct')::boolean, false),
         COALESCE(q.xp_reward, 10)
    INTO v_correct, v_xp
    FROM public.daily_quizzes q
   WHERE q.id = NEW.quiz_id;

  NEW.is_correct  := COALESCE(v_correct, false);
  NEW.xp_earned   := CASE WHEN COALESCE(v_correct, false) THEN COALESCE(v_xp, 10) ELSE 0 END;
  NEW.answered_on := CURRENT_DATE;
  RETURN NEW;
END; $function$;

-- ===== fn_quiz_battle_create(p_questions jsonb, p_opponent_id uuid, p_random_match boolean) | secdef=True | config=['search_path=public'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_quiz_battle_create(p_questions jsonb, p_opponent_id uuid DEFAULT NULL::uuid, p_random_match boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

  INSERT INTO public.profiles (id) VALUES (v_uid) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.quiz_battles (challenger_id, opponent_id, status, questions, is_random_match)
  VALUES (v_uid, p_opponent_id, 'open', p_questions, COALESCE(p_random_match,false))
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;

-- ===== fn_quiz_battle_find_or_create_random(p_questions jsonb) | secdef=True | config=['search_path=public'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_quiz_battle_find_or_create_random(p_questions jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

-- ===== fn_quiz_battle_submit(p_battle_id uuid, p_answers jsonb) | secdef=True | config=['search_path=public'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_quiz_battle_submit(p_battle_id uuid, p_answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_b record;
  v_is_challenger boolean;
  v_score smallint := 0;
  v_q jsonb; v_ans jsonb; v_correct boolean;
  v_enriched jsonb := '[]'::jsonb;
  v_n int; i int;
  v_winner uuid; v_status text; v_resolved boolean; v_you_won int; v_elo_delta int;
  v_my_elo int; v_my_won int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authed'; END IF;
  SELECT * INTO v_b FROM public.quiz_battles WHERE id = p_battle_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_b.status IN ('resolved','expired','declined') THEN RAISE EXCEPTION 'battle_closed'; END IF;

  v_is_challenger := (v_b.challenger_id = v_uid);
  IF NOT v_is_challenger THEN
    -- Gegner: opponent_id muss ich sein (named) ODER offene Random-Battle die ich hiermit claime
    IF v_b.opponent_id IS NULL AND v_b.is_random_match THEN
      UPDATE public.quiz_battles SET opponent_id = v_uid,
        status = CASE WHEN status='open' THEN 'accepted' ELSE status END, updated_at = now()
        WHERE id = p_battle_id AND opponent_id IS NULL;
      v_b.opponent_id := v_uid;
    ELSIF v_b.opponent_id <> v_uid THEN
      RAISE EXCEPTION 'not_participant';
    END IF;
  END IF;

  IF (v_is_challenger AND v_b.challenger_answers IS NOT NULL)
     OR (NOT v_is_challenger AND v_b.opponent_answers IS NOT NULL) THEN
    RAISE EXCEPTION 'already_submitted';
  END IF;

  v_n := LEAST(jsonb_array_length(v_b.questions), 10);
  FOR i IN 0 .. (v_n - 1) LOOP
    v_q   := v_b.questions -> i;
    v_ans := p_answers -> i;
    v_correct := (v_ans IS NOT NULL)
                 AND (v_ans ->> 'ans') IS NOT NULL
                 AND (v_ans ->> 'ans')::int = (v_q ->> 'correct_idx')::int;
    IF v_correct THEN v_score := v_score + 1; END IF;
    v_enriched := v_enriched || jsonb_build_object(
      'idx', i,
      'ans', NULLIF(v_ans ->> 'ans','')::int,
      'time_ms', COALESCE(NULLIF(v_ans ->> 'time_ms','')::int, 0),
      'correct', v_correct
    );
  END LOOP;

  IF v_is_challenger THEN
    UPDATE public.quiz_battles
      SET challenger_answers = v_enriched, challenger_score = v_score,
          status = CASE WHEN opponent_answers IS NOT NULL THEN 'resolved' ELSE 'challenger_done' END,
          updated_at = now()
      WHERE id = p_battle_id;
  ELSE
    UPDATE public.quiz_battles
      SET opponent_answers = v_enriched, opponent_score = v_score,
          status = CASE WHEN challenger_answers IS NOT NULL THEN 'resolved' ELSE 'opponent_done' END,
          updated_at = now()
      WHERE id = p_battle_id;
  END IF;

  -- Beide fertig? → finalisieren (ELO + winner)
  PERFORM public._fn_quiz_battle_finalize(p_battle_id);

  SELECT status, winner_id INTO v_status, v_winner FROM public.quiz_battles WHERE id = p_battle_id;
  v_resolved := (v_status = 'resolved');
  IF v_resolved THEN
    IF v_winner IS NULL THEN v_you_won := 0;             -- Tie
    ELSIF v_winner = v_uid THEN v_you_won := 1;          -- Sieg
    ELSE v_you_won := -1; END IF;                        -- Niederlage
    SELECT CASE WHEN v_is_challenger THEN elo_change_challenger ELSE elo_change_opponent END
      INTO v_elo_delta FROM public.quiz_battles WHERE id = p_battle_id;
    SELECT COALESCE(quiz_elo,1200), COALESCE(battles_won,0) INTO v_my_elo, v_my_won
      FROM public.profiles WHERE id = v_uid;
  END IF;

  RETURN jsonb_build_object(
    'your_score', v_score,
    'status', v_status,
    'resolved', v_resolved,
    'you_won', v_you_won,            -- 1=Sieg, 0=Unentschieden, -1=Niederlage, NULL=wartet
    'elo_delta', v_elo_delta,
    'your_elo', v_my_elo,
    'your_battles_won', v_my_won
  );
END $function$;

-- ===== fn_quiz_leaderboard_upsert(p_total_correct integer, p_total_attempts integer, p_streak_current integer, p_streak_max integer, p_display_name text) | secdef=True | config=['search_path=public, pg_temp'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_quiz_leaderboard_upsert(p_total_correct integer, p_total_attempts integer, p_streak_current integer, p_streak_max integer, p_display_name text DEFAULT NULL::text)
 RETURNS quiz_leaderboard
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE _uid uuid := (SELECT auth.uid()); _row public.quiz_leaderboard; _name text;
        _qa_correct int; _qa_attempts int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT count(*) FILTER (WHERE is_correct), count(*)
    INTO _qa_correct, _qa_attempts
    FROM public.quiz_answers WHERE user_id = _uid;
  _qa_correct := COALESCE(_qa_correct, 0);
  _qa_attempts := COALESCE(_qa_attempts, 0);
  _name := COALESCE(
    NULLIF(TRIM(p_display_name),''),
    (SELECT NULLIF(TRIM(display_name),'') FROM public.profiles WHERE id = _uid),
    'GreenScan-Mitglied');
  INSERT INTO public.quiz_leaderboard
    (user_id, display_name, total_correct, total_attempts, streak_current, streak_max, last_active_date, updated_at)
  VALUES
    (_uid, _name, _qa_correct, _qa_attempts, GREATEST(0,p_streak_current), GREATEST(0,p_streak_max), current_date, now())
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = _name,
    total_correct = GREATEST(public.quiz_leaderboard.total_correct, _qa_correct),
    total_attempts = GREATEST(public.quiz_leaderboard.total_attempts, _qa_attempts),
    streak_current = EXCLUDED.streak_current,
    streak_max = GREATEST(public.quiz_leaderboard.streak_max, EXCLUDED.streak_max),
    last_active_date = current_date,
    updated_at = now()
  RETURNING * INTO _row;
  RETURN _row;
END $function$;

-- ===== fn_quiz_record_answer(p_correct boolean, p_username text) | secdef=True | config=['search_path=public'] | acl={=X/postgres,postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_quiz_record_answer(p_correct boolean, p_username text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_year int := EXTRACT(year FROM now())::int;
  v_username text := COALESCE(p_username, 'GreenScan-User');
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  INSERT INTO quiz_ranking (user_id, username, year, total_points, year_points, correct_answers, total_answers, streak, updated_at)
  VALUES (
    v_uid, v_username, v_year,
    CASE WHEN p_correct THEN 10 ELSE 0 END,
    CASE WHEN p_correct THEN 10 ELSE 0 END,
    CASE WHEN p_correct THEN 1 ELSE 0 END,
    1,
    CASE WHEN p_correct THEN 1 ELSE 0 END,
    now()
  )
  ON CONFLICT (user_id, year) DO UPDATE SET
    username = EXCLUDED.username,
    total_points = quiz_ranking.total_points + (CASE WHEN p_correct THEN 10 ELSE 0 END),
    year_points = quiz_ranking.year_points + (CASE WHEN p_correct THEN 10 ELSE 0 END),
    correct_answers = quiz_ranking.correct_answers + (CASE WHEN p_correct THEN 1 ELSE 0 END),
    total_answers = quiz_ranking.total_answers + 1,
    streak = CASE WHEN p_correct THEN quiz_ranking.streak + 1 ELSE 0 END,
    updated_at = now();
END;
$function$;

-- ===== fn_quiz_leaderboard_top(p_limit integer) | secdef=True | config=['search_path=public, pg_temp'] | acl={postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_quiz_leaderboard_top(p_limit integer DEFAULT 10)
 RETURNS TABLE(rnk integer, user_id uuid, display_name text, total_correct integer, streak_max integer, total_attempts integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT (row_number() OVER (ORDER BY q.total_correct DESC, q.streak_max DESC))::int AS rnk,
         q.user_id,
         COALESCE(NULLIF(TRIM(p.display_name),''), 'GreenScan-Mitglied') AS display_name,
         q.total_correct, q.streak_max, q.total_attempts
  FROM public.quiz_leaderboard q
  LEFT JOIN public.profiles p ON p.id = q.user_id
  ORDER BY q.total_correct DESC, q.streak_max DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$function$;
