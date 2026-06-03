-- ============================================================================
-- v28_09_quiz_leaderboard_realname — B-005: Quiz-Rangliste zeigt echten Namen
-- Spiegel der LIVE-Migration. Root-Cause: fn_quiz_leaderboard_upsert generierte
-- einen Zufallsnamen („Pilz-Igel 22") wenn kein display_name übergeben wurde.
-- Fix: live aus profiles.display_name (Fallback „GreenScan-Mitglied", nie Email/Random).
-- (B-006 Plan-Save ist rein Frontend — kein DB-Change; siehe index.html
--  _gsSaveGardenPlanCloud + gsPPopenSavedPlans-Mapping. garden_plans-Schema unverändert.)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_quiz_leaderboard_top(p_limit integer DEFAULT 10)
RETURNS TABLE(rnk integer, user_id uuid, display_name text, total_correct integer, streak_max integer, total_attempts integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  SELECT (row_number() OVER (ORDER BY q.total_correct DESC, q.streak_max DESC))::int AS rnk,
         q.user_id,
         COALESCE(NULLIF(TRIM(p.display_name),''), 'GreenScan-Mitglied') AS display_name,
         q.total_correct, q.streak_max, q.total_attempts
  FROM public.quiz_leaderboard q
  LEFT JOIN public.profiles p ON p.id = q.user_id
  ORDER BY q.total_correct DESC, q.streak_max DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;

CREATE OR REPLACE FUNCTION public.fn_quiz_leaderboard_upsert(p_total_correct integer, p_total_attempts integer, p_streak_current integer, p_streak_max integer, p_display_name text DEFAULT NULL::text)
RETURNS quiz_leaderboard LANGUAGE plpgsql SET search_path TO 'public','pg_temp' AS $$
DECLARE _uid uuid := (SELECT auth.uid()); _row public.quiz_leaderboard; _name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  _name := COALESCE(
    NULLIF(TRIM(p_display_name),''),
    (SELECT NULLIF(TRIM(display_name),'') FROM public.profiles WHERE id = _uid),
    'GreenScan-Mitglied');
  INSERT INTO public.quiz_leaderboard
    (user_id, display_name, total_correct, total_attempts, streak_current, streak_max, last_active_date, updated_at)
  VALUES
    (_uid, _name, GREATEST(0,p_total_correct), GREATEST(0,p_total_attempts), GREATEST(0,p_streak_current), GREATEST(0,p_streak_max), current_date, now())
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = _name,
    total_correct = GREATEST(public.quiz_leaderboard.total_correct, EXCLUDED.total_correct),
    total_attempts = GREATEST(public.quiz_leaderboard.total_attempts, EXCLUDED.total_attempts),
    streak_current = EXCLUDED.streak_current,
    streak_max = GREATEST(public.quiz_leaderboard.streak_max, EXCLUDED.streak_max),
    last_active_date = current_date,
    updated_at = now()
  RETURNING * INTO _row;
  RETURN _row;
END $$;

-- Einmaliger Bestandsdaten-Sync (Zufallsnamen → echter profiles.display_name):
UPDATE public.quiz_leaderboard q
SET display_name = COALESCE(NULLIF(TRIM(p.display_name),''), 'GreenScan-Mitglied'), updated_at = now()
FROM public.profiles p WHERE p.id = q.user_id;
