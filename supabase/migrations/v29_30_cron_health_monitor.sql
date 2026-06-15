-- v29.30 Schicht 1 (Observability): Cron-Health-Monitor. Modernes Must-have — Sichtbarkeit
-- ob die 17 Hintergrund-Jobs wirklich laufen. Read-only, admin-only, additiv (kein Eingriff
-- in bestehende Flows). Liest cron.job + cron.job_run_details (SECURITY DEFINER, owner=postgres).
-- Verifiziert als echter JWT: admin → 17/17 healthy; non-admin → "admin only".
CREATE OR REPLACE FUNCTION public.fn_admin_cron_health()
RETURNS TABLE(
  jobname text, schedule text, active boolean,
  last_run timestamptz, last_status text, last_duration_s numeric,
  runs_24h int, fails_24h int, healthy boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, cron, pg_catalog AS $$
BEGIN
  IF NOT public.is_admin_user() THEN RAISE EXCEPTION 'admin only'; END IF;
  RETURN QUERY
  WITH last AS (
    SELECT d.jobid, d.status, d.start_time, d.end_time,
           ROW_NUMBER() OVER (PARTITION BY d.jobid ORDER BY d.start_time DESC) AS rn
    FROM cron.job_run_details d
    WHERE d.start_time > now() - interval '40 days'   -- deckt auch monatliche Jobs ab
  ),
  agg AS (
    SELECT d.jobid,
           count(*) FILTER (WHERE d.start_time > now()-interval '24 hours')::int AS runs_24h,
           count(*) FILTER (WHERE d.start_time > now()-interval '24 hours' AND d.status <> 'succeeded')::int AS fails_24h
    FROM cron.job_run_details d
    GROUP BY d.jobid
  )
  SELECT j.jobname::text, j.schedule::text, j.active,
         l.start_time AS last_run,
         l.status::text AS last_status,
         round(extract(epoch FROM (l.end_time - l.start_time))::numeric, 1) AS last_duration_s,
         COALESCE(a.runs_24h,0), COALESCE(a.fails_24h,0),
         (l.status = 'succeeded' AND COALESCE(a.fails_24h,0) = 0 AND l.start_time IS NOT NULL) AS healthy
  FROM cron.job j
  LEFT JOIN last l ON l.jobid = j.jobid AND l.rn = 1
  LEFT JOIN agg a ON a.jobid = j.jobid
  ORDER BY (COALESCE(a.fails_24h,0) > 0) DESC, (l.status IS DISTINCT FROM 'succeeded') DESC, j.jobname;
END $$;
REVOKE EXECUTE ON FUNCTION public.fn_admin_cron_health() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_cron_health() TO authenticated;
