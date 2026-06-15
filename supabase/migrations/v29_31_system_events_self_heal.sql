-- v29.31 Schicht 2 (Self-Healing + Observability): strukturiertes System-Event-Log + ein
-- Monitor-Cron der die anderen 17 Jobs überwacht und Fehlläufe protokolliert. Modernes
-- Must-have: Alerting/Record bei Background-Job-Fehlern. Additiv, kein Eingriff in Flows.
-- Verifiziert: fn_monitor_health läuft, cron aktiv, admin liest Events, non-admin abgewiesen.

-- 1) system_events: operatives Log (kein Actor, anders als audit_log). Kein public-Zugriff.
CREATE TABLE IF NOT EXISTS public.system_events (
  id bigserial PRIMARY KEY,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn','error')),
  source text NOT NULL,
  event text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_system_events_recent ON public.system_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_events_sev ON public.system_events (severity, created_at DESC);
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;
-- keine SELECT/INSERT-Policy für anon/authenticated → nur service_role + SECURITY DEFINER-Fns.

-- 2) interner Logger (service/definer) — Primitive für künftige Sicherheits-/Ops-Events.
CREATE OR REPLACE FUNCTION public.fn_log_system_event(p_source text, p_severity text, p_event text, p_detail jsonb DEFAULT '{}'::jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id bigint;
BEGIN
  INSERT INTO public.system_events(severity, source, event, detail)
  VALUES (CASE WHEN p_severity IN ('info','warn','error') THEN p_severity ELSE 'info' END,
          coalesce(nullif(btrim(p_source),''),'unknown'),
          coalesce(nullif(btrim(p_event),''),'event'),
          coalesce(p_detail,'{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.fn_log_system_event(text,text,text,jsonb) FROM public, anon, authenticated;

-- 3) Self-Heal-Monitor: protokolliert fehlgeschlagene Cron-Läufe (letzte 75 Min) + GC >30d.
CREATE OR REPLACE FUNCTION public.fn_monitor_health()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, cron, pg_catalog AS $$
DECLARE v_logged int := 0; r record;
BEGIN
  FOR r IN
    SELECT j.jobname, d.status, d.start_time, d.return_message
    FROM cron.job_run_details d JOIN cron.job j ON j.jobid = d.jobid
    WHERE d.start_time > now() - interval '75 minutes'
      AND d.status IS DISTINCT FROM 'succeeded'
      AND d.status IS DISTINCT FROM 'running'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.system_events
      WHERE source='cron_monitor' AND event='job_failed'
        AND detail->>'jobname' = r.jobname AND detail->>'start_time' = r.start_time::text
    ) THEN
      INSERT INTO public.system_events(severity, source, event, detail)
      VALUES ('error','cron_monitor','job_failed',
              jsonb_build_object('jobname', r.jobname, 'status', r.status,
                                 'start_time', r.start_time, 'message', left(coalesce(r.return_message,''),500)));
      v_logged := v_logged + 1;
    END IF;
  END LOOP;
  DELETE FROM public.system_events WHERE created_at < now() - interval '30 days';
  RETURN v_logged;
END $$;
REVOKE EXECUTE ON FUNCTION public.fn_monitor_health() FROM public, anon, authenticated;

-- 4) Admin-View der letzten System-Events.
CREATE OR REPLACE FUNCTION public.fn_admin_system_events(p_limit int DEFAULT 50)
RETURNS TABLE(id bigint, severity text, source text, event text, detail jsonb, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin_user() THEN RAISE EXCEPTION 'admin only'; END IF;
  RETURN QUERY
    SELECT se.id, se.severity, se.source, se.event, se.detail, se.created_at
    FROM public.system_events se
    ORDER BY se.created_at DESC
    LIMIT greatest(1, least(p_limit, 200));
END $$;
REVOKE EXECUTE ON FUNCTION public.fn_admin_system_events(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_system_events(int) TO authenticated;

-- 5) Stündlicher Self-Heal-Monitor-Cron.
SELECT cron.schedule('health-monitor-hourly', '5 * * * *', $$SELECT public.fn_monitor_health();$$);
