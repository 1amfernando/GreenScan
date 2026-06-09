-- v28 Perf (deferred-by-design Sprint, 2026-06-10): multiple_permissive auf den 2
-- traffic-staerksten Community-Tabellen (social_posts, post_comments) konsolidieren.
-- Die _moderate FOR ALL (staff) Policy ueberlappte JEDES Kommando -> fn_role_at_least('staff')
-- wurde pro Zeile beim Feed-Read ausgewertet. Loesung: staff-Bedingung per ALTER POLICY in
-- jede Kommando-Policy einfalten (billige Bedingung is_archived=false / uid=user_id ZUERST
-- -> OR-Short-Circuit, Funktion laeuft nur noch fuer Archiv-/Fremd-Zeilen), _moderate droppen.
-- Semantik identisch: staff behaelt Voll-Zugriff je Kommando, User own-row, Public liest
-- nicht-archivierte Posts. Ergebnis: genau 1 Policy pro Kommando (multiple_permissive 75->40).
-- Backend-only, kein App-Bump.

-- social_posts
ALTER POLICY social_posts_select_all ON public.social_posts
  USING ((is_archived = false) OR ((SELECT auth.uid()) = user_id) OR fn_role_at_least('staff'));
ALTER POLICY social_posts_update_own ON public.social_posts
  USING (((SELECT auth.uid()) = user_id) OR fn_role_at_least('staff'))
  WITH CHECK (((SELECT auth.uid()) = user_id) OR fn_role_at_least('staff'));
ALTER POLICY social_posts_delete_own ON public.social_posts
  USING (((SELECT auth.uid()) = user_id) OR fn_role_at_least('staff'));
ALTER POLICY social_posts_insert_auth ON public.social_posts
  WITH CHECK (((SELECT auth.uid()) = user_id) OR fn_role_at_least('staff'));
DROP POLICY IF EXISTS social_posts_moderate ON public.social_posts;

-- post_comments (SELECT bleibt true; staff in insert/delete einfalten; update staff-only neu)
ALTER POLICY post_comments_delete_own ON public.post_comments
  USING (((SELECT auth.uid()) = user_id) OR fn_role_at_least('staff'));
ALTER POLICY post_comments_insert_auth ON public.post_comments
  WITH CHECK (((SELECT auth.uid()) = user_id) OR fn_role_at_least('staff'));
CREATE POLICY post_comments_update_mod ON public.post_comments
  FOR UPDATE TO public
  USING (fn_role_at_least('staff'))
  WITH CHECK (fn_role_at_least('staff'));
DROP POLICY IF EXISTS post_comments_moderate ON public.post_comments;
