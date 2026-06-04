-- ============================================================================
-- v28_18_consolidate_permissive_policies — Spiegel der LIVE-Migration (Block 3/4).
-- Perf-Sprint: 8 (Tabelle,cmd)-Paare mit je 2 permissiven Policies → je 1 OR-gemergte Policy.
-- Beweisbar äquivalent (permissive Policies OR'en ohnehin), spart Per-Row-Policy-Evaluation.
-- Alle Ausdrücke 1:1 übernommen (keine Logik-/Admin-Quellen-Änderung). Security-neutral,
-- transaktional verifiziert (profiles UPDATE: Non-Admin self=1/foreign=0).
-- ============================================================================
DROP POLICY IF EXISTS "app_settings_select_all" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_vapid_public_read" ON public.app_settings;
CREATE POLICY "app_settings_select" ON public.app_settings FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "launch_offer_owner_read" ON public.launch_offer_usage;
DROP POLICY IF EXISTS "launch_offer_usage_admin_read" ON public.launch_offer_usage;
CREATE POLICY "launch_offer_usage_select" ON public.launch_offer_usage FOR SELECT TO public
USING (
  ((SELECT auth.uid()) = user_id)
  OR (((SELECT auth.jwt()) ->> 'email') = ANY (ARRAY['fernando.rankwiler1997@gmail.com'::text, 'www.greenscan@gmail.com'::text]))
);

DROP POLICY IF EXISTS "community sees public finds" ON public.map_user_finds;
DROP POLICY IF EXISTS "users see own finds" ON public.map_user_finds;
CREATE POLICY "map_user_finds_select" ON public.map_user_finds FOR SELECT TO public
USING ((is_private = false) OR (user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "users read own chat" ON public.marketplace_messages;
DROP POLICY IF EXISTS "users see own conversations" ON public.marketplace_messages;
CREATE POLICY "marketplace_messages_select" ON public.marketplace_messages FOR SELECT TO public
USING ((buyer_id = (SELECT auth.uid())) OR (seller_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "seller marks read" ON public.marketplace_messages;
DROP POLICY IF EXISTS "users update own seen flag" ON public.marketplace_messages;
CREATE POLICY "marketplace_messages_update" ON public.marketplace_messages FOR UPDATE TO public
USING ((buyer_id = (SELECT auth.uid())) OR (seller_id = (SELECT auth.uid())))
WITH CHECK ((buyer_id = (SELECT auth.uid())) OR (seller_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "diag_expert_read" ON public.plant_diagnoses;
DROP POLICY IF EXISTS "diag_select_own" ON public.plant_diagnoses;
CREATE POLICY "plant_diagnoses_select" ON public.plant_diagnoses FOR SELECT TO public
USING (fn_role_at_least('expert'::text) OR ((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "profiles_admin_update_any" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO public
USING (fn_is_role('admin'::text) OR ((SELECT auth.uid()) = id));

DROP POLICY IF EXISTS "sgv_host_read" ON public.social_garden_visits;
DROP POLICY IF EXISTS "sgv_visitor_read" ON public.social_garden_visits;
CREATE POLICY "social_garden_visits_select" ON public.social_garden_visits FOR SELECT TO public
USING ((host_user_id = (SELECT auth.uid())) OR (visitor_user_id = (SELECT auth.uid())));
