-- v26.88 — Server-side fuzzy species search (pg_trgm) + privacy-safe popularity + cache
-- Tables:
--   species_search_log   : per-user private pick log (RLS: insert/select OWN only)
--   species_popularity   : aggregate-only pick counts (NO user_id → revDSG-safe, public SELECT)
--   species_search_cache : Edge-Function 60s cache (RLS enabled, NO policy → service-role only)
-- RPCs:
--   fn_species_search(p_q, p_lim)         : STABLE, trigram + word_similarity fuzzy match
--   fn_species_log_pick(p_q, p_species_id): SECURITY DEFINER, logs pick + bumps popularity
-- Maintenance (cron 02:15 UTC):
--   fn_refresh_species_popularity() / fn_cleanup_species_search_cache()

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes for fuzzy match on species name + latin name (idempotent).
CREATE INDEX IF NOT EXISTS idx_species_name_trgm ON public.species USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_species_lat_trgm  ON public.species USING gin (lat  gin_trgm_ops);

-- ── species_search_log (private per-user) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.species_search_log (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id           uuid,
  q                 text,
  picked_species_id text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_species_search_log_created ON public.species_search_log (created_at);
CREATE INDEX IF NOT EXISTS idx_species_search_log_picked  ON public.species_search_log (picked_species_id) WHERE picked_species_id IS NOT NULL;

ALTER TABLE public.species_search_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS species_search_log_insert_own ON public.species_search_log;
CREATE POLICY species_search_log_insert_own ON public.species_search_log
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS species_search_log_select_own ON public.species_search_log;
CREATE POLICY species_search_log_select_own ON public.species_search_log
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ── species_popularity (aggregate, public, NO user_id) ─────────────────────
CREATE TABLE IF NOT EXISTS public.species_popularity (
  species_id     text PRIMARY KEY,
  pick_count     integer NOT NULL DEFAULT 0,
  last_picked_at timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.species_popularity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS species_popularity_select_all ON public.species_popularity;
CREATE POLICY species_popularity_select_all ON public.species_popularity
  FOR SELECT TO anon, authenticated
  USING (true);

GRANT SELECT ON public.species_popularity TO anon, authenticated;

-- ── species_search_cache (service-role only: RLS on, no policy) ────────────
CREATE TABLE IF NOT EXISTS public.species_search_cache (
  cache_key  text PRIMARY KEY,
  payload    jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_species_search_cache_expires ON public.species_search_cache (expires_at);

ALTER TABLE public.species_search_cache ENABLE ROW LEVEL SECURITY;
-- No policy on purpose: only service-role (RLS-bypass) reads/writes this table.

-- ── fn_species_search ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_species_search(p_q text, p_lim integer DEFAULT 8)
 RETURNS TABLE(id uuid, slug text, name text, lat text, emoji text, cat text, tox smallint, toxic boolean, edible boolean, similarity_score real, popularity_score integer, combined_score real)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  qq text := btrim(coalesce(p_q,''));
  lm int  := LEAST(GREATEST(coalesce(p_lim,8),1),25);
BEGIN
  IF qq = '' THEN RETURN; END IF;
  PERFORM set_config('pg_trgm.similarity_threshold', '0.2', true);
  PERFORM set_config('pg_trgm.word_similarity_threshold', '0.35', true);

  RETURN QUERY
  WITH ranked AS (
    SELECT s.id AS r_id, s.slug AS r_slug, s.name AS r_name, s.lat AS r_lat,
           s.emoji AS r_emoji, s.cat AS r_cat, s.tox AS r_tox,
           (coalesce(s.tox,0) >= 3) AS r_toxic,
           s.edible AS r_edible,
           GREATEST(
             similarity(s.name, qq),
             similarity(coalesce(s.lat,''), qq),
             word_similarity(qq, s.name),
             word_similarity(qq, coalesce(s.lat,''))
           ) AS r_sim,
           coalesce(pop.pick_count,0) AS r_pop
    FROM public.species s
    LEFT JOIN public.species_popularity pop ON pop.species_id = s.id::text
    WHERE s.name % qq
       OR coalesce(s.lat,'') % qq
       OR qq <% s.name
       OR qq <% coalesce(s.lat,'')
       OR s.name ILIKE '%' || qq || '%'
       OR coalesce(s.lat,'') ILIKE '%' || qq || '%'
  )
  SELECT r.r_id, r.r_slug, r.r_name, r.r_lat, r.r_emoji, r.r_cat, r.r_tox, r.r_toxic, r.r_edible,
         r.r_sim::real,
         r.r_pop,
         (r.r_sim + LEAST(r.r_pop::real / 50.0, 0.3))::real
  FROM ranked r
  WHERE r.r_sim > 0.12
  ORDER BY (r.r_sim + LEAST(r.r_pop::real / 50.0, 0.3)) DESC, r.r_sim DESC, length(r.r_name) ASC, r.r_name ASC
  LIMIT lm;
END $function$;

-- ── fn_species_top_picks (popular species for v26.89 Home suggestions) ─────
-- Public read (default PUBLIC EXECUTE kept on purpose — drives logged-out Home cards).
CREATE OR REPLACE FUNCTION public.fn_species_top_picks(p_lim integer DEFAULT 6)
 RETURNS TABLE(id uuid, slug text, name text, lat text, emoji text, cat text, pick_count integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT s.id, s.slug, s.name, s.lat, s.emoji, s.cat,
         coalesce(pop.pick_count,0) AS pick_count
  FROM public.species s
  LEFT JOIN public.species_popularity pop ON pop.species_id = s.id::text
  WHERE s.cat IN ('gemuese','kraut','hauspflanze','blume')
  ORDER BY coalesce(pop.pick_count,0) DESC, s.name ASC
  LIMIT LEAST(GREATEST(coalesce(p_lim,6),1),24);
$function$;

-- ── fn_species_log_pick (logs pick + bumps aggregate popularity) ───────────
CREATE OR REPLACE FUNCTION public.fn_species_log_pick(p_q text, p_species_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_sid text := NULLIF(btrim(coalesce(p_species_id,'')),'');
BEGIN
  INSERT INTO public.species_search_log(user_id, q, picked_species_id)
  VALUES ((SELECT auth.uid()), NULLIF(btrim(coalesce(p_q,'')),''), v_sid);

  IF v_sid IS NOT NULL THEN
    INSERT INTO public.species_popularity(species_id, pick_count, last_picked_at, updated_at)
    VALUES (v_sid, 1, now(), now())
    ON CONFLICT (species_id) DO UPDATE
      SET pick_count     = public.species_popularity.pick_count + 1,
          last_picked_at = now(),
          updated_at     = now();
  END IF;
END $function$;

-- ── Maintenance functions ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_refresh_species_popularity()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.species_popularity(species_id, pick_count, last_picked_at, updated_at)
  SELECT picked_species_id, count(*)::int, max(created_at), now()
  FROM public.species_search_log
  WHERE picked_species_id IS NOT NULL
  GROUP BY picked_species_id
  ON CONFLICT (species_id) DO UPDATE
    SET pick_count     = EXCLUDED.pick_count,
        last_picked_at = EXCLUDED.last_picked_at,
        updated_at     = now();
END $function$;

CREATE OR REPLACE FUNCTION public.fn_cleanup_species_search_cache()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.species_search_cache WHERE expires_at < now();
  DELETE FROM public.species_search_log   WHERE created_at < now() - interval '90 days';
END $function$;

-- ── Cron: daily popularity refresh + cache cleanup (02:15 UTC) ─────────────
SELECT cron.schedule(
  'species-maintenance-daily',
  '15 2 * * *',
  $$SELECT public.fn_refresh_species_popularity(); SELECT public.fn_cleanup_species_search_cache();$$
);
