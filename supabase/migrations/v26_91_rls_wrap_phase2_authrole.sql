-- v26.91 — RLS init-plan wrap, Phase 2b: auth.role() service-role guards
-- Companion to v26_91_rls_wrap_phase2_initplan.sql (which wrapped auth.uid()/auth.jwt()).
-- These 3 service-role-only ALL policies used bare auth.role(), which re-evaluates
-- per-row. Wrapping as (SELECT auth.role()) caches it once per query (init-plan).
-- Semantics-preserving: identical truth table, only the evaluation count changes.
-- Result: auth_rls_initplan advisor findings 59 → 0 (combined with the initplan migration).

-- ── feature_limits ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "limits admin write" ON public.feature_limits;
CREATE POLICY "limits admin write" ON public.feature_limits
  FOR ALL TO public
  USING ((SELECT auth.role()) = 'service_role'::text)
  WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- ── species_images ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "simg write" ON public.species_images;
CREATE POLICY "simg write" ON public.species_images
  FOR ALL TO public
  USING ((SELECT auth.role()) = 'service_role'::text)
  WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- ── species_sources ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ssources write" ON public.species_sources;
CREATE POLICY "ssources write" ON public.species_sources
  FOR ALL TO public
  USING ((SELECT auth.role()) = 'service_role'::text)
  WITH CHECK ((SELECT auth.role()) = 'service_role'::text);
