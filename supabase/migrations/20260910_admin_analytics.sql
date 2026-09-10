-- ============================================================================
-- 20260910_admin_analytics.sql — die LESE-Seite der Nutzungsmessung (v33.18)
--
-- Seit v33.11 schreibt gsTrackEvent ein benanntes Vokabular (scan_done,
-- plan_saved, task_done, quiz_answered, consent_changed) nach analytics_events
-- — Opt-in, gefiltert, ohne Namen. Und niemand las es: kein RPC, keine
-- Edge-Function, keine Stelle in der App (nachgemessen 10.09.2026).
-- „Abgefragt, geliefert, weggeworfen" (CLAUDE.md §7.1) — nur andersherum.
--
-- fn_admin_analytics(p_days) zaehlt je Ereignis und je Tag (Europe/Zurich),
-- dazu Gesamtzahl, Zahl der Personen und die Zustimmungs-Wechsel — NUR ZAHLEN,
-- keine user_id, keine session_id, keine props ausser dem einen Zustimmungs-
-- Flag. Gate wie fn_admin_metrics (v28_64): SECURITY DEFINER + is_admin_user(),
-- REVOKE PUBLIC/anon, GRANT authenticated. p_days wird auf 1..365 geklemmt.
-- Idempotent (CREATE OR REPLACE). Pruefstand: scripts/nutzung_check.js
-- (SQL im lokalen Postgres + App mit gestelltem sbFetch).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_admin_analytics(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
  d integer := greatest(1, least(coalesce(p_days, 30), 365));
  seit timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;
  SELECT jsonb_build_object(
    'days',         d,
    'since',        seit,
    'generated_at', now(),
    'total',        (SELECT count(*) FROM analytics_events WHERE created_at >= seit),
    'users',        (SELECT count(DISTINCT user_id) FROM analytics_events WHERE user_id IS NOT NULL AND created_at >= seit),
    'by_event',     coalesce((
                      SELECT jsonb_agg(jsonb_build_object('event', e.event, 'n', e.n, 'users', e.users) ORDER BY e.n DESC, e.event)
                      FROM (SELECT event, count(*) AS n, count(DISTINCT user_id) AS users
                              FROM analytics_events WHERE created_at >= seit GROUP BY event) e), '[]'::jsonb),
    'by_day',       coalesce((
                      SELECT jsonb_agg(jsonb_build_object('day', t.day, 'n', t.n) ORDER BY t.day)
                      FROM (SELECT (created_at AT TIME ZONE 'Europe/Zurich')::date AS day, count(*) AS n
                              FROM analytics_events WHERE created_at >= seit GROUP BY 1) t), '[]'::jsonb),
    'consent_on',   (SELECT count(*) FROM analytics_events WHERE event = 'consent_changed' AND (props->>'analytics') = 'true'  AND created_at >= seit),
    'consent_off',  (SELECT count(*) FROM analytics_events WHERE event = 'consent_changed' AND (props->>'analytics') = 'false' AND created_at >= seit)
  ) INTO r;
  RETURN r;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_admin_analytics(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_analytics(integer) TO authenticated;
