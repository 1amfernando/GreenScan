-- ============================================================================
-- 20260910_analytics_retention.sql — Aufbewahrung der Nutzungsereignisse (v33.24)
--
-- v33.11 schreibt Ereignisse (Opt-in), v33.18 liest sie — und nichts loeschte
-- sie je. Eine Zaehlung, die nie endet, ist keine Zaehlung, sondern ein Archiv.
-- revDSG: Speicherbegrenzung — Daten werden geloescht, sobald der Zweck
-- (Nutzung ueber 30/90 Tage beurteilen) sie nicht mehr braucht.
--
-- fn_analytics_prune(p_days) loescht analytics_events aelter als p_days
-- (Vorgabe 180, geklemmt auf 30..730) und gibt die Zahl zurueck. SECURITY
-- DEFINER, nur service_role/postgres duerfen rufen (Cron), REVOKE PUBLIC/anon/
-- authenticated. Der Cron laeuft taeglich 03:40 UTC, nur wenn pg_cron da ist
-- (dieselbe Bauform wie 20260905_device_alerts_cron.sql). Idempotent.
-- Die App zeigt dieselbe Zahl (GS_ANALYTICS_TAGE) — nutzung_check haelt beide
-- gegeneinander. Pruefstand: scripts/nutzung_check.js (SQL im lokalen Postgres).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_analytics_prune(p_days integer DEFAULT 180)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d integer := greatest(30, least(coalesce(p_days, 180), 730));
  n integer;
BEGIN
  DELETE FROM analytics_events WHERE created_at < now() - make_interval(days => d);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_analytics_prune(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_analytics_prune(integer) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('analytics-prune') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'analytics-prune');
    PERFORM cron.schedule('analytics-prune', '40 3 * * *', $cron$select public.fn_analytics_prune(180);$cron$);
  END IF;
END $$;
