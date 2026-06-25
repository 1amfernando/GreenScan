-- v30.42 SECURITY (Block-G Audit G.4) — angewendet 2026-06-25 via MCP apply_migration.
-- (1) Entitlement-Exploit: quiz_leaderboard.total_correct war user-schreibbar (RLS own-row, kein Spalten-Guard)
--     + Cron quiz-top3-yearend (31.12.) schenkte Top-3 nach total_correct automatisch 1 Jahr Pro.
--     Fix: Grant + Leaderboard zählen jetzt aus quiz_answers (quiz_id FK→daily_quizzes + UNIQUE(user_id,quiz_id)
--     = max 1 korrekt je echtem Quiz, NICHT fälschbar) + Direkt-Schreibrechte entzogen + Upsert DEFINER.
-- (2) profiles-Guard schützte quiz_elo/battles/level/xp nicht → Battle-ELO/Matchmaking-Manipulation.

-- ── (1a) Jahresend-Pro-Grant aus AUTORITATIVER Quelle (quiz_answers) ──
CREATE OR REPLACE FUNCTION public.fn_grant_quiz_top3_pro()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare v_ids uuid[]; v_n int := 0; v_uid uuid;
begin
  select array_agg(user_id) into v_ids from (
    select qa.user_id
    from public.quiz_answers qa
    group by qa.user_id
    having count(*) filter (where qa.is_correct) >= 1
    order by count(*) filter (where qa.is_correct) desc,
             count(distinct qa.answered_on) desc,
             min(qa.created_at) asc
    limit 3
  ) t;
  if v_ids is null then
    insert into public.system_events(severity, source, event, detail)
    values ('info', 'quiz_reward', 'top3_grant', jsonb_build_object('granted', 0, 'reason', 'no_eligible_players', 'source', 'quiz_answers'));
    return jsonb_build_object('ok', true, 'granted', 0);
  end if;
  foreach v_uid in array v_ids loop
    update public.profiles
       set comp_tier = 'pro', comp_expires_at = now() + interval '1 year',
           comp_granted_by = null, comp_granted_at = now()
     where id = v_uid and coalesce(comp_tier, '') <> 'lifetime';
    if found then v_n := v_n + 1; end if;
  end loop;
  insert into public.system_events(severity, source, event, detail)
  values (case when v_n > 0 then 'warn' else 'info' end, 'quiz_reward', 'top3_grant',
          jsonb_build_object('granted', v_n, 'user_ids', to_jsonb(v_ids), 'source', 'quiz_answers_yearend',
                             'expires', (now() + interval '1 year')));
  return jsonb_build_object('ok', true, 'granted', v_n, 'user_ids', to_jsonb(v_ids));
end
$function$;

-- ── (1b) Leaderboard-Upsert: DEFINER + total_correct/attempts autoritativ aus quiz_answers ──
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
  SELECT count(*) FILTER (WHERE is_correct), count(*) INTO _qa_correct, _qa_attempts
    FROM public.quiz_answers WHERE user_id = _uid;
  _qa_correct := COALESCE(_qa_correct, 0); _qa_attempts := COALESCE(_qa_attempts, 0);
  _name := COALESCE(NULLIF(TRIM(p_display_name),''),
    (SELECT NULLIF(TRIM(display_name),'') FROM public.profiles WHERE id = _uid), 'GreenScan-Mitglied');
  INSERT INTO public.quiz_leaderboard
    (user_id, display_name, total_correct, total_attempts, streak_current, streak_max, last_active_date, updated_at)
  VALUES (_uid, _name, _qa_correct, _qa_attempts, GREATEST(0,p_streak_current), GREATEST(0,p_streak_max), current_date, now())
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = _name,
    total_correct = GREATEST(public.quiz_leaderboard.total_correct, _qa_correct),
    total_attempts = GREATEST(public.quiz_leaderboard.total_attempts, _qa_attempts),
    streak_current = EXCLUDED.streak_current,
    streak_max = GREATEST(public.quiz_leaderboard.streak_max, EXCLUDED.streak_max),
    last_active_date = current_date, updated_at = now()
  RETURNING * INTO _row;
  RETURN _row;
END $function$;

REVOKE EXECUTE ON FUNCTION public.fn_quiz_leaderboard_upsert(integer,integer,integer,integer,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_quiz_leaderboard_upsert(integer,integer,integer,integer,text) TO authenticated;

-- ── (1c) Direkten Tabellen-Schreibpfad sperren (Frontend nutzt NUR die RPC) ──
REVOKE INSERT, UPDATE, DELETE ON public.quiz_leaderboard FROM anon, authenticated;

-- ── (2) profiles-Guard um Competitive-/Vanity-Spalten erweitern ──
CREATE OR REPLACE FUNCTION public.fn_profiles_guard_protected()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('authenticated','anon') AND NOT coalesce(is_admin_user(), false) THEN
    IF NEW.tier IS DISTINCT FROM OLD.tier
       OR NEW.is_admin IS DISTINCT FROM OLD.is_admin
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.is_expert IS DISTINCT FROM OLD.is_expert
       OR NEW.is_lifetime IS DISTINCT FROM OLD.is_lifetime
       OR NEW.comp_tier IS DISTINCT FROM OLD.comp_tier
       OR NEW.comp_expires_at IS DISTINCT FROM OLD.comp_expires_at
       OR NEW.comp_granted_by IS DISTINCT FROM OLD.comp_granted_by
       OR NEW.role_assigned_by IS DISTINCT FROM OLD.role_assigned_by
       OR NEW.role_assigned_at IS DISTINCT FROM OLD.role_assigned_at
       OR NEW.quiz_elo IS DISTINCT FROM OLD.quiz_elo
       OR NEW.battles_won IS DISTINCT FROM OLD.battles_won
       OR NEW.battles_lost IS DISTINCT FROM OLD.battles_lost
       OR NEW.battles_tied IS DISTINCT FROM OLD.battles_tied
       OR NEW.level IS DISTINCT FROM OLD.level
       OR NEW.xp IS DISTINCT FROM OLD.xp
    THEN RAISE EXCEPTION 'protected_column_change_denied' USING ERRCODE='insufficient_privilege'; END IF;
  END IF;
  RETURN NEW;
END;
$function$;
