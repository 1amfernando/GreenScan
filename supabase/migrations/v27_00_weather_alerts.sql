-- v27.00 — Wetter-Frost-Push: Alert-Inbox + 3h-Checker (Frost/Hitze/Sturm) + Vorlauf
-- FINALE des Mega-Sprints v26.88 → v27.00.
--
-- ARCHITEKTUR-REALITAET (Hard-Lesson #8): Spec-Annahmen waren grossteils falsch.
--   * frost_tolerance_c existiert NIRGENDS (weder garden_plantings noch species)
--     -> Alerts sind STANDORT- statt pflanzen-spezifisch.
--   * garden_plantings/gardens sind LEER; echte Garten-Daten liegen als per-user
--     jsonb in user_gardens.data (gardens[]/plantings[]).
--   * user_prefs existiert nicht (real: user_preferences.prefs jsonb).
--   * Server-Koordinaten kommen aus push_subscriptions.gps_lat/gps_lng.
--   * daily-push-checker v6 macht bereits Basis-Frost-Push 07/19 UTC -> NICHT
--     ersetzt, sondern ergaenzt: gemeinsame Dedup ueber
--     fn_push_already_sent_today(p_user, p_category) (Kategorie 'frost')
--     verhindert Doppel-Push am selben Tag.
--
-- Edge-Fn weather-alert-checker v1 + Cron weather-alert-3h NICHT hier (Cron/Edge
-- werden bewusst NICHT als TS/SQL-Spiegel ins Repo gelegt — Transkriptions-Risiko).

-- ── 1) push_subscriptions: 3 additive Spalten ───────────────────────────────
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS notify_heat      boolean  NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_storm     boolean  NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS alert_lead_hours smallint NOT NULL DEFAULT 12;

-- ── 2) weather_alerts: per-user Inbox ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.weather_alerts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type    text NOT NULL CHECK (alert_type IN ('frost','heat','storm')),
  severity      text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  title         text NOT NULL,
  body          text,
  min_temp_c    numeric,
  max_temp_c    numeric,
  metric        jsonb,
  valid_from    timestamptz DEFAULT now(),
  valid_until   timestamptz,
  location_lat  numeric,
  location_lng  numeric,
  pushed        boolean DEFAULT false,
  acknowledged  boolean DEFAULT false,
  dismissed     boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weather_alerts_user_created
  ON public.weather_alerts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_weather_alerts_active
  ON public.weather_alerts (user_id, alert_type, valid_until)
  WHERE dismissed = false;

ALTER TABLE public.weather_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wx_alerts_sel ON public.weather_alerts;
CREATE POLICY wx_alerts_sel ON public.weather_alerts
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS wx_alerts_upd ON public.weather_alerts;
CREATE POLICY wx_alerts_upd ON public.weather_alerts
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

GRANT SELECT, UPDATE ON public.weather_alerts TO authenticated;
-- INSERT bleibt service_role-only (Edge-Fn schreibt via Bypass).

-- ── 3) weather_forecast_cache: shared Grid-Cache (service-role-only) ─────────
CREATE TABLE IF NOT EXISTS public.weather_forecast_cache (
  grid_key   text PRIMARY KEY,        -- lat/lng auf 0.1° gerundet, toFixed(1)
  lat        numeric,
  lng        numeric,
  payload    jsonb,
  fetched_at timestamptz DEFAULT now()
);

ALTER TABLE public.weather_forecast_cache ENABLE ROW LEVEL SECURITY;
-- BEWUSST KEINE Policy: nur service_role (Edge-Fn) liest/schreibt. RLS-enabled
-- ohne Policy = Default-Deny fuer anon/authenticated (Advisor INFO, gewollt).

-- ── 4) RPC: Alert quittieren / entfernen ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_weather_alert_ack(
  p_id      uuid,
  p_dismiss boolean DEFAULT false
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.weather_alerts
     SET acknowledged = true,
         dismissed    = (dismissed OR p_dismiss)
   WHERE id = p_id
     AND user_id = (SELECT auth.uid());
  RETURN FOUND;
END;
$$;

-- ── 5) RPC: ungelesene Alerts zaehlen (Badge) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_weather_alerts_unread()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
    FROM public.weather_alerts
   WHERE user_id = (SELECT auth.uid())
     AND acknowledged = false
     AND dismissed    = false;
$$;

-- ── 6) Grants: anon raus, authenticated rein ────────────────────────────────
REVOKE ALL ON FUNCTION public.fn_weather_alert_ack(uuid, boolean)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_weather_alerts_unread()           FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_weather_alert_ack(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_weather_alerts_unread()          TO authenticated;
