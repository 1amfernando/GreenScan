-- ============ Perf: multiple_permissive_policies konsolidieren + fehlender FK-Index ============
-- (Backend-only, kein App-v-Bump.) 36 multiple_permissive-Advisor-Lints über 12 Content-Tabellen:
-- jeweils eine FOR-ALL-Write-Policy, die mit der FOR-SELECT-Lese-Policy für dieselbe Rolle+SELECT
-- überlappte (redundante Per-Row-Auswertung). Fix OHNE Verhaltensänderung: Write-Policies auf
-- INSERT/UPDATE/DELETE beschränken (SELECT-Overlap weg); reine service_role-Write-Policies droppen
-- (service_role bypassed RLS ohnehin). Als JWT verifiziert: app_settings-Secret-Schutz hält (non-admin
-- sieht nur Whitelist, anon nichts, admin alles), Content lesbar, Writes korrekt gated (unprivilegiert
-- blockiert, admin/expert/staff/own erlaubt). Danach: alle 12 Tabellen for_all=0, genau 1 SELECT-Policy.
-- KEINE Payment-/User-Kern-Tabellen betroffen.

-- 1) service_role-only Write-Policies (redundant) droppen
DROP POLICY IF EXISTS "limits admin write" ON public.feature_limits;
DROP POLICY IF EXISTS "simg write"         ON public.species_images;
DROP POLICY IF EXISTS "ssources write"     ON public.species_sources;

-- 2) book_ingest_jobs: admin FOR ALL → I/U/D (Lese via select_own deckt Admin ab)
DROP POLICY IF EXISTS book_ingest_admin ON public.book_ingest_jobs;
CREATE POLICY book_ingest_admin_ins ON public.book_ingest_jobs FOR INSERT TO public WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_admin=true));
CREATE POLICY book_ingest_admin_upd ON public.book_ingest_jobs FOR UPDATE TO public USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_admin=true)) WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_admin=true));
CREATE POLICY book_ingest_admin_del ON public.book_ingest_jobs FOR DELETE TO public USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_admin=true));

-- 3) folk_lore / garden_techniques / recipes / remedies (admin|expert FOR ALL → I/U/D)
DO $mig$
DECLARE t text; expr text := '(EXISTS (SELECT 1 FROM profiles WHERE profiles.id=(SELECT auth.uid()) AND (profiles.is_admin=true OR profiles.is_expert=true OR profiles.role=''admin'')))';
BEGIN
  FOREACH t IN ARRAY ARRAY['folk_lore','garden_techniques','recipes','remedies'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_admin_write', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK %s', t||'_admin_ins', t, expr);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING %s WITH CHECK %s', t||'_admin_upd', t, expr, expr);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING %s', t||'_admin_del', t, expr);
  END LOOP;
END $mig$;

-- 4) plant_3d_models (admin FOR ALL → I/U/D)
DROP POLICY IF EXISTS "admin write plant_3d_models" ON public.plant_3d_models;
CREATE POLICY plant_3d_admin_ins ON public.plant_3d_models FOR INSERT TO public WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_admin=true));
CREATE POLICY plant_3d_admin_upd ON public.plant_3d_models FOR UPDATE TO public USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_admin=true)) WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_admin=true));
CREATE POLICY plant_3d_admin_del ON public.plant_3d_models FOR DELETE TO public USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_admin=true));

-- 5) quests (staff FOR ALL → I/U/D)
DROP POLICY IF EXISTS quests_admin_write ON public.quests;
CREATE POLICY quests_admin_ins ON public.quests FOR INSERT TO public WITH CHECK (fn_role_at_least('staff'));
CREATE POLICY quests_admin_upd ON public.quests FOR UPDATE TO public USING (fn_role_at_least('staff')) WITH CHECK (fn_role_at_least('staff'));
CREATE POLICY quests_admin_del ON public.quests FOR DELETE TO public USING (fn_role_at_least('staff'));

-- 6) quiz_leaderboard (eigene Zeile FOR ALL → I/U/D)
DROP POLICY IF EXISTS "users upsert own row" ON public.quiz_leaderboard;
CREATE POLICY ql_own_ins ON public.quiz_leaderboard FOR INSERT TO public WITH CHECK (user_id=(SELECT auth.uid()));
CREATE POLICY ql_own_upd ON public.quiz_leaderboard FOR UPDATE TO public USING (user_id=(SELECT auth.uid())) WITH CHECK (user_id=(SELECT auth.uid()));
CREATE POLICY ql_own_del ON public.quiz_leaderboard FOR DELETE TO public USING (user_id=(SELECT auth.uid()));

-- 7) app_settings: Write splitten + 2 SELECT-Policies zu EINER mergen (Whitelist ODER Admin)
DROP POLICY IF EXISTS app_settings_admin_write        ON public.app_settings;
DROP POLICY IF EXISTS app_settings_select_public_keys ON public.app_settings;
CREATE POLICY app_settings_admin_ins ON public.app_settings FOR INSERT TO public WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_admin=true));
CREATE POLICY app_settings_admin_upd ON public.app_settings FOR UPDATE TO public USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_admin=true)) WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_admin=true));
CREATE POLICY app_settings_admin_del ON public.app_settings FOR DELETE TO public USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_admin=true));
CREATE POLICY app_settings_select ON public.app_settings FOR SELECT TO authenticated
  USING ( (key = ANY (ARRAY['vapid_public_key','stripe_publishable_key','global_api_enabled','global_api_provider']) OR key LIKE 'flag\_%')
          OR EXISTS (SELECT 1 FROM profiles p WHERE p.id=(SELECT auth.uid()) AND p.is_admin=true) );

-- 8) fehlender FK-Index (unindexed_foreign_keys: client_errors.user_id)
CREATE INDEX IF NOT EXISTS idx_client_errors_user_id ON public.client_errors(user_id);
