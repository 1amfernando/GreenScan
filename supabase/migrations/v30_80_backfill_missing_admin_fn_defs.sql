-- v30.80 Repo-Hygiene: Backfill fehlender Function-Bodies (Self-Audit-Fund).
-- Automatischer Deep-Scan fand: fn_admin_audit_recent (v28_99), fn_admin_client_errors (v29_00),
-- fn_admin_flag_set + fn_admin_flags_list (v28_98) und fn_quiz_record_answer waren als
-- "Voller Inhalt: DB-Migration ... (apply_migration)"-Stub-Kommentare committed — die tatsaechliche
-- SQL wurde live via Supabase-MCP appliziert, aber nie ins Repo zurueckgeschrieben. Damit war das
-- Repo fuer diese 5 Functions NICHT die Single Source of Truth (Verstoss gegen CLAUDE.md).
-- Dieses File holt die aktuell live-deployten Function-Definitionen 1:1 nach (per
-- pg_get_functiondef via execute_sql verifiziert, 2026-08-19). Reines No-Op-Backfill,
-- kein Verhaltens-Change — CREATE OR REPLACE gegen identischen Body.
--
-- Security-Review-Ergebnis (Anlass dieses Backfills): alle 5 Functions besitzen einen korrekten
-- Guard VOR jedem privilegierten Read/Write (is_admin_user()-Check bzw. auth.uid() IS NULL-Return
-- bei fn_quiz_record_answer). Keine Privilege-Escalation gefunden.

CREATE OR REPLACE FUNCTION public.fn_admin_audit_recent(p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin_user() THEN RETURN jsonb_build_object('error','forbidden'); END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'action', a.action, 'target_type', a.target_type, 'target_id', a.target_id,
      'diff', a.diff, 'created_at', a.created_at,
      'actor_email', (SELECT email FROM profiles WHERE id = a.actor_id)
    ) ORDER BY a.created_at DESC)
    FROM (SELECT * FROM audit_log ORDER BY created_at DESC LIMIT LEAST(GREATEST(coalesce(p_limit,20),1),100)) a
  ), '[]'::jsonb);
END; $function$;

CREATE OR REPLACE FUNCTION public.fn_admin_client_errors(p_days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin_user() THEN RETURN jsonb_build_object('error','forbidden'); END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(g)) FROM (
      SELECT message, app_version, err_type,
             count(*) AS n,
             count(DISTINCT user_id) AS users,
             max(created_at) AS last_seen,
             (array_agg(context ORDER BY created_at DESC))[1] AS last_context
      FROM client_errors
      WHERE created_at > now() - make_interval(days => LEAST(GREATEST(coalesce(p_days,7),1),30))
      GROUP BY message, app_version, err_type
      ORDER BY count(*) DESC
      LIMIT 25
    ) g
  ), '[]'::jsonb);
END; $function$;

CREATE OR REPLACE FUNCTION public.fn_admin_flag_set(p_key text, p_value text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin_user() THEN RETURN jsonb_build_object('error','forbidden'); END IF;
  IF p_key NOT LIKE 'flag\_%' THEN RETURN jsonb_build_object('error','only_flag_keys'); END IF;
  INSERT INTO app_settings (key, value, updated_at, updated_by)
  VALUES (p_key, p_value, now(), (SELECT auth.uid()))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by;
  INSERT INTO audit_log (actor_id, action, target_type, target_id, diff)
  VALUES ((SELECT auth.uid()), 'admin_flag_set', 'app_settings', p_key, jsonb_build_object('value', p_value));
  RETURN jsonb_build_object('ok', true);
END; $function$;

CREATE OR REPLACE FUNCTION public.fn_admin_flags_list()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin_user() THEN RETURN jsonb_build_object('error','forbidden'); END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('key',key,'value',value,'description',description,'updated_at',updated_at) ORDER BY key)
    FROM app_settings WHERE key LIKE 'flag\_%'), '[]'::jsonb);
END; $function$;

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
