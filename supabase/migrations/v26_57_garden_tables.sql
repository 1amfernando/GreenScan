-- v26.57 — Neue Tabellen für Mein-Garten (Cowork-Audit-Erkenntnisse v26.51)
-- Autor: Cowork-Claude 2026-05-27
-- Auftrag: Backend-Persistierung-Lücken aus MEIN_GARTEN_AUDIT_v26.51.md schließen
-- Deploy: via mcp__supabase__apply_migration oder Supabase-CLI

-- =============================================================================
-- 1) user_garden_layouts — Beet-Layout-Editor + KI-Optimierung
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_garden_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  garden_id uuid, -- optional FK auf user_gardens.user_id (jsonb-only Schema)
  name text NOT NULL,
  beds jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Beispiel-Schema beds: [{ id, x_pct, y_pct, w_pct, h_pct, shape:'rect|round',
  --   soil_type:'lehm|sandig|...', sun_hours:6, plants:[{species_lat, planted_at, count}] }]
  shape_svg text, -- optional SVG-Path für Garten-Umriss
  size_sqm numeric,
  orientation text, -- süd / nord / süd-ost / etc
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ugl_user_id ON public.user_garden_layouts(user_id);
CREATE INDEX IF NOT EXISTS idx_ugl_updated_at ON public.user_garden_layouts(user_id, updated_at DESC);

ALTER TABLE public.user_garden_layouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ugl_own ON public.user_garden_layouts;
CREATE POLICY ugl_own ON public.user_garden_layouts
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP TRIGGER IF EXISTS _touch_ugl ON public.user_garden_layouts;
CREATE TRIGGER _touch_ugl
  BEFORE UPDATE ON public.user_garden_layouts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.user_garden_layouts IS 'v26.57 — Visueller Garten-Layout-Editor. beds-jsonb hält Beet-Positionen + Belegung.';

-- =============================================================================
-- 2) plant_care_schedules — Pro Pflanze pro Task-Key (statt JSON-Blob)
-- =============================================================================
-- Ermöglicht Cross-Plant-Queries: "Alle Pflanzen die heute Gießen brauchen"
-- ohne durch user_plants.data.plants[].tasks JSON zu parsen.

CREATE TABLE IF NOT EXISTS public.plant_care_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plant_local_id text NOT NULL, -- p.id aus myPlants (bleibt JSON-Blob für jetzt, Migration später)
  plant_name text,              -- Denormalized für UI ohne Plant-Lookup
  task_key text NOT NULL CHECK (task_key IN ('water','fertilize','prune','repot','rotate','mist','dust','check','harvest','sow','spray')),
  interval_days int NOT NULL CHECK (interval_days > 0),
  last_done timestamptz,
  is_active boolean DEFAULT true NOT NULL,
  custom_notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, plant_local_id, task_key)
);

-- next_due wird im View berechnet (STORED column hat Restriktionen bei timestamptz-Arithmetic in PG <14)
CREATE OR REPLACE VIEW public.v_plant_care_due AS
SELECT
  pcs.*,
  COALESCE(pcs.last_done, pcs.created_at) + (pcs.interval_days || ' days')::interval AS next_due,
  GREATEST(0, EXTRACT(DAY FROM (now() - (COALESCE(pcs.last_done, pcs.created_at) + (pcs.interval_days || ' days')::interval)))::int) AS days_overdue
FROM public.plant_care_schedules pcs
WHERE pcs.is_active = true;

CREATE INDEX IF NOT EXISTS idx_pcs_user_active ON public.plant_care_schedules(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_pcs_user_plant ON public.plant_care_schedules(user_id, plant_local_id);

ALTER TABLE public.plant_care_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pcs_own ON public.plant_care_schedules;
CREATE POLICY pcs_own ON public.plant_care_schedules
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP TRIGGER IF EXISTS _touch_pcs ON public.plant_care_schedules;
CREATE TRIGGER _touch_pcs
  BEFORE UPDATE ON public.plant_care_schedules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.plant_care_schedules IS 'v26.57 — Pro Pflanze + Task-Key Schedule. Ermöglicht Cross-Plant-Queries (z.B. Server-Cron-Reminders).';
COMMENT ON VIEW public.v_plant_care_due IS 'v26.57 — Berechnet next_due + days_overdue für aktive Schedules.';

-- =============================================================================
-- 3) garden_milestones — Garten-spezifische Achievements
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.garden_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_slug text NOT NULL,
  -- Beispiel-Slugs: 'first_harvest', 'ten_plants', 'first_winter_survived',
  --                 'first_seed_saved', 'pollinator_friendly_garden',
  --                 'biodiversity_score_50', 'compost_master', 'frost_survived'
  achieved_at timestamptz DEFAULT now() NOT NULL,
  data jsonb, -- optional context: {plant_id, harvest_kg, score, ...}
  UNIQUE (user_id, milestone_slug)
);

CREATE INDEX IF NOT EXISTS idx_gm_user_achieved ON public.garden_milestones(user_id, achieved_at DESC);

ALTER TABLE public.garden_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gm_own ON public.garden_milestones;
CREATE POLICY gm_own ON public.garden_milestones
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

COMMENT ON TABLE public.garden_milestones IS 'v26.57 — Garten-spezifische Achievements (unabhängig von achievements_catalog).';

-- =============================================================================
-- 4) weather_log_per_garden — Tägliche Wetter-Snapshots pro User-Standort
-- =============================================================================
-- Ermöglicht YoY-Vergleich + KI-Lernen aus historischen Bedingungen.

CREATE TABLE IF NOT EXISTS public.weather_log_per_garden (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  min_temp_c numeric(4,1),
  max_temp_c numeric(4,1),
  avg_temp_c numeric(4,1),
  precip_mm numeric(5,1),
  frost_risk boolean DEFAULT false,
  humidity_pct smallint,
  wind_max_kmh smallint,
  source text DEFAULT 'open-meteo' NOT NULL,
  raw_data jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_wlpg_user_date ON public.weather_log_per_garden(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_wlpg_frost ON public.weather_log_per_garden(user_id, date) WHERE frost_risk = true;

ALTER TABLE public.weather_log_per_garden ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wlpg_own ON public.weather_log_per_garden;
CREATE POLICY wlpg_own ON public.weather_log_per_garden
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

COMMENT ON TABLE public.weather_log_per_garden IS 'v26.57 — Tägliches Wetter-Log pro User für YoY-Vergleich + KI-Constraints.';

-- =============================================================================
-- 5) frost_history — Frost-Warnungs-Historie (aus v26.54-Plan vorgezogen)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.frost_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alerted_at timestamptz DEFAULT now() NOT NULL,
  predicted_min_temp_c numeric(4,1),
  actual_min_temp_c numeric(4,1), -- Backfill nach 1 Tag, für Forecast-Accuracy
  location_lat numeric(8,5),
  location_lon numeric(8,5),
  notified boolean DEFAULT false,
  acknowledged boolean DEFAULT false,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_fh_user_alerted ON public.frost_history(user_id, alerted_at DESC);

ALTER TABLE public.frost_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fh_own ON public.frost_history;
CREATE POLICY fh_own ON public.frost_history
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

COMMENT ON TABLE public.frost_history IS 'v26.57 — Historie aller Frost-Warnungen (für Forecast-Accuracy-Auswertung).';

-- =============================================================================
-- Final-Verify (manuell laufen lassen):
-- =============================================================================
-- SELECT table_name, count(*) AS row_count
--   FROM information_schema.tables t
--   WHERE table_schema='public'
--     AND table_name IN ('user_garden_layouts','plant_care_schedules','garden_milestones','weather_log_per_garden','frost_history')
--   GROUP BY 1;
--
-- SELECT tablename, policyname, cmd, qual FROM pg_policies
--   WHERE schemaname='public' AND tablename IN ('user_garden_layouts','plant_care_schedules','garden_milestones','weather_log_per_garden','frost_history');
