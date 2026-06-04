-- ============================================================================
-- v28_15_harvest_consolidation — Spiegel der LIVE-Migration (siehe v28.15-Block).
-- Ernte-Mismatch (v28.03-Audit): der prominente Ernte-Tracker (gsErnteAdd) schreibt nach
-- garden_harvests, aber der Erntekalender (v_harvest_stats_per_user) aggregierte harvest_log
-- (0 Zeilen, System-1-Plant-Detail-UI nicht erreichbar) → Kalender war IMMER leer trotz Ernten.
-- Fix: garden_harvests wird die EINE kanonische Tabelle; harvest_log bleibt deprecated (0 Zeilen,
-- KEIN destruktiver DROP). Beide Cloud-Tabellen waren 0 Zeilen → kein Cloud-Datenverlust-Risiko.
-- ============================================================================

-- Additiv: per-Pflanze-Linkage, damit garden_harvests auch den (toten) System-1-Pfad abdeckt.
ALTER TABLE public.garden_harvests ADD COLUMN IF NOT EXISTS plant_local_id text;
ALTER TABLE public.garden_harvests ADD COLUMN IF NOT EXISTS species_lat   text;
CREATE INDEX IF NOT EXISTS idx_garden_harvests_plant ON public.garden_harvests(user_id, plant_local_id);

-- Erntekalender-Stats jetzt aus garden_harvests. security_invoker=on → RLS von garden_harvests
-- (owner-only) greift → kein Cross-User-Leak (transaktional verifiziert: User B sieht 0 von User A).
CREATE OR REPLACE VIEW public.v_harvest_stats_per_user
WITH (security_invoker = on) AS
SELECT
  user_id,
  EXTRACT(year FROM ts)::integer AS year,
  species_lat,
  species_name,
  count(*) AS harvest_count,
  sum(CASE WHEN lower(btrim(unit)) IN ('g','gramm') THEN menge
           WHEN lower(btrim(unit)) = 'kg'           THEN menge * 1000::numeric
           ELSE 0::numeric END) AS total_grams,
  sum(CASE WHEN lower(btrim(unit)) IN ('stk','stück','stueck','st','stk.') THEN menge
           ELSE 0::numeric END) AS total_pieces,
  avg(quality_rating) AS avg_quality,
  min(ts)::date AS first_harvest,
  max(ts)::date AS last_harvest
FROM public.garden_harvests
GROUP BY user_id, EXTRACT(year FROM ts), species_lat, species_name;
