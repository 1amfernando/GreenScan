-- v26.99 Garten-Planer v3: Multi-Year + Klima-Adaptiv + Constraints + Was-Wenn
-- (A) garden_plans um v3-Spalten erweitern (alle additiv, NOT NULL DEFAULT → bestehende Inserts bleiben gültig)
ALTER TABLE public.garden_plans
  ADD COLUMN IF NOT EXISTS planning_horizon_years smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS climate_scenario text NOT NULL DEFAULT 'baseline',
  ADD COLUMN IF NOT EXISTS constraints jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS plan_version smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS yearly_outputs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS what_if_runs jsonb NOT NULL DEFAULT '[]'::jsonb;

-- CHECK-Constraints defensiv (nur wenn noch nicht vorhanden)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'garden_plans_horizon_chk') THEN
    ALTER TABLE public.garden_plans
      ADD CONSTRAINT garden_plans_horizon_chk CHECK (planning_horizon_years BETWEEN 1 AND 3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'garden_plans_climate_chk') THEN
    ALTER TABLE public.garden_plans
      ADD CONSTRAINT garden_plans_climate_chk CHECK (climate_scenario IN ('baseline','warmer_drier','wetter_summer'));
  END IF;
END$$;

-- (B) Schweizer Klima-Szenarien-Referenztabelle (CH2018 / MeteoSchweiz-orientierte Deltas)
CREATE TABLE IF NOT EXISTS public.climate_scenarios_ch (
  region text NOT NULL,
  scenario text NOT NULL,
  avg_temp_delta_c numeric NOT NULL DEFAULT 0,
  avg_precip_delta_pct numeric NOT NULL DEFAULT 0,
  frost_days_delta int NOT NULL DEFAULT 0,
  summary text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (region, scenario)
);

ALTER TABLE public.climate_scenarios_ch ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'climate_scenarios_ch' AND policyname = 'climate_scenarios_read'
  ) THEN
    CREATE POLICY climate_scenarios_read ON public.climate_scenarios_ch
      FOR SELECT TO authenticated USING (true);
  END IF;
END$$;

-- Seed: 4 CH-Regionen × 3 Szenarien = 12 Zeilen (idempotent via ON CONFLICT)
INSERT INTO public.climate_scenarios_ch (region, scenario, avg_temp_delta_c, avg_precip_delta_pct, frost_days_delta, summary) VALUES
  ('mittelland','baseline',      0.0,   0,   0,  'Referenz-Klima (Normperiode 1981–2010) für das Schweizer Mittelland.'),
  ('mittelland','warmer_drier',  2.5, -18, -15,  'Wärmer & trockener (CH2018, RCP8.5 Mitte Jahrhundert): heissere, niederschlagsärmere Sommer, längere Trockenphasen.'),
  ('mittelland','wetter_summer', 1.8,  12, -10,  'Wärmer mit feuchteren Sommern: mehr Niederschlag und häufigere Starkregen-Ereignisse.'),
  ('jura','baseline',            0.0,   0,   0,  'Referenz-Klima (1981–2010) für den Jura.'),
  ('jura','warmer_drier',        2.4, -16, -18,  'Wärmer & trockener: spürbar mildere Winter, trockenere Sommer am Jura-Südhang.'),
  ('jura','wetter_summer',       1.7,  14, -12,  'Wärmer mit feuchteren Sommern: erhöhte Niederschläge, Pilzdruck steigt.'),
  ('alpen','baseline',           0.0,   0,   0,  'Referenz-Klima (1981–2010) für die Alpen/Voralpen.'),
  ('alpen','warmer_drier',       2.8, -12, -25,  'Wärmer & trockener: alpine Erwärmung verstärkt, deutlich weniger Frosttage, verlängerte Vegetationszeit.'),
  ('alpen','wetter_summer',      2.0,  15, -20,  'Wärmer mit feuchteren Sommern: mehr Sommerniederschlag, Spätfrost-Risiko sinkt.'),
  ('tessin','baseline',          0.0,   0,   0,  'Referenz-Klima (1981–2010) für das Tessin/Südschweiz.'),
  ('tessin','warmer_drier',      2.6, -22, -12,  'Wärmer & trockener: ohnehin trockene Sommer verschärfen sich, Bewässerung wird zentral.'),
  ('tessin','wetter_summer',     1.9,  10,  -9,  'Wärmer mit feuchteren Sommern: mediterrane Starkregen, gute Wärme für Frucht-Gemüse.')
ON CONFLICT (region, scenario) DO UPDATE
  SET avg_temp_delta_c = EXCLUDED.avg_temp_delta_c,
      avg_precip_delta_pct = EXCLUDED.avg_precip_delta_pct,
      frost_days_delta = EXCLUDED.frost_days_delta,
      summary = EXCLUDED.summary,
      updated_at = now();
