-- v26.88 — fn_species_search: word_similarity (<%) + relaxed thresholds + ambiguity fix
-- WHY:
--   1) Compound German names (e.g. "Fleischtomate") diluted plain trigram score so
--      "tomaten" returned 0 hits. Added word_similarity (<%) operator + relaxed both
--      thresholds (similarity 0.2, word_similarity 0.35), scoped to the function via
--      set_config(..., true). Both operators ride the same gin_trgm_ops index.
--   2) plpgsql ambiguity: RETURNS TABLE OUT params (id, slug, name, ...) collided with
--      the CTE's column refs. FIX: alias CTE columns to r_* and reference via "r." prefix.
-- This is the FINAL definition (re-asserted here for migration-history fidelity; it is
-- identical to the fn_species_search body shipped in v26_88_species_search.sql).

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
