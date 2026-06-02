-- v26.88 — Lock down SECURITY DEFINER functions (default PUBLIC EXECUTE is unsafe)
-- get_advisors flagged: maintenance fns + log_pick were callable by anon via default grant.
--   - Maintenance fns: nobody but service-role/cron should run them → REVOKE from all.
--   - fn_species_log_pick: only authenticated users (it reads auth.uid()) → REVOKE anon.

REVOKE EXECUTE ON FUNCTION public.fn_refresh_species_popularity()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_cleanup_species_search_cache() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_species_log_pick(text, text)   FROM PUBLIC, anon;
-- fn_species_search stays callable by anon + authenticated (read-only fuzzy search).
