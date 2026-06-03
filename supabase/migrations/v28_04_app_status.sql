-- ============================================================================
-- v28_04_app_status — Globaler-Anthropic-Key Health-Status (v28.04 Block C)
-- Spiegel der LIVE angewandten Migration (project vowbiueikwrauuceilhc).
-- app_status: vom Edge-Fn key-health-check (service_role) geschrieben, read-all.
-- + Edge-Fn `key-health-check` v1 (verify_jwt=false, x-cron-secret-Auth) — bewusst
--   NICHT als TS-Spiegel hier (Transkriptions-Risiko; Live ist operative Wahrheit).
-- + pg_cron `key-health-daily` (0 3 * * *) via net.http_post mit x-cron-secret.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.app_status (
  key           text PRIMARY KEY,
  status        text NOT NULL CHECK (status IN ('ok','expiring_soon','invalid','unknown')),
  message       text,
  last_check_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS as_read_all ON public.app_status;
CREATE POLICY as_read_all ON public.app_status FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.app_status TO anon, authenticated;
-- INSERT/UPDATE nur via service_role (Edge-Fn key-health-check) — keine Policy = default-deny.

INSERT INTO public.app_status (key, status, message)
VALUES ('global_anthropic_key', 'unknown', 'Noch nicht geprüft')
ON CONFLICT (key) DO NOTHING;

-- ─── Cron (separat via execute_sql appliziert, hier dokumentiert): ───────────
-- SELECT cron.schedule('key-health-daily', '0 3 * * *', $$
--   SELECT net.http_post(
--     url := 'https://vowbiueikwrauuceilhc.supabase.co/functions/v1/key-health-check',
--     headers := jsonb_build_object('Content-Type','application/json',
--       'x-cron-secret', (SELECT value FROM public.app_settings WHERE key='push_cron_secret')),
--     body := '{}'::jsonb);
-- $$);
-- Verify: Test-Call HTTP 200 → {status:'ok', message:'Key gültig …'} → app_status befüllt.
