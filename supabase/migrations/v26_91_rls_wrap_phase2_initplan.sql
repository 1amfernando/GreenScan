-- v26.91 — Perf Phase 2: wrap bare auth.uid()/auth.jwt() in RLS policies as
-- (SELECT auth.uid()) so Postgres evaluates them once per query (init-plan) instead
-- of once per row (Hard-Lesson #6). Semantics-preserving: identical truth tables,
-- 50-200x faster at 1k+ rows/user. Atomic (single transaction). 56 policies / 33 tables.
-- Advisor auth_rls_initplan: 59 -> (this + authrole migration) -> 0.

-- ── admin / is_admin EXISTS-subquery policies ──────────────────────────────
DROP POLICY IF EXISTS app_settings_admin_write ON public.app_settings;
CREATE POLICY app_settings_admin_write ON public.app_settings AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = (SELECT auth.uid())) AND (p.is_admin = true)))));

DROP POLICY IF EXISTS audit_log_admin_only ON public.audit_log;
CREATE POLICY audit_log_admin_only ON public.audit_log AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = (SELECT auth.uid())) AND (p.is_admin = true)))));

DROP POLICY IF EXISTS book_ingest_admin ON public.book_ingest_jobs;
CREATE POLICY book_ingest_admin ON public.book_ingest_jobs AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = (SELECT auth.uid())) AND (p.is_admin = true)))));

DROP POLICY IF EXISTS book_cand_admin ON public.book_species_candidates;
CREATE POLICY book_cand_admin ON public.book_species_candidates AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = (SELECT auth.uid())) AND (p.is_admin = true)))));

DROP POLICY IF EXISTS scan_corrections_admin_read ON public.scan_corrections;
CREATE POLICY scan_corrections_admin_read ON public.scan_corrections AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = (SELECT auth.uid())) AND (p.is_admin = true)))));

DROP POLICY IF EXISTS schema_migrations_admin_only ON public.schema_migrations;
CREATE POLICY schema_migrations_admin_only ON public.schema_migrations AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = (SELECT auth.uid())) AND (p.is_admin = true)))));

DROP POLICY IF EXISTS species_proposals_admin ON public.species_proposals;
CREATE POLICY species_proposals_admin ON public.species_proposals AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = (SELECT auth.uid())) AND (p.is_admin = true)))));

DROP POLICY IF EXISTS stripe_wh_admin_read ON public.stripe_webhook_events;
CREATE POLICY stripe_wh_admin_read ON public.stripe_webhook_events AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = (SELECT auth.uid())) AND (p.is_admin = true)))));

-- ── expert / jwt-email admin ────────────────────────────────────────────────
DROP POLICY IF EXISTS expert_verif_insert_experts ON public.expert_verifications;
CREATE POLICY expert_verif_insert_experts ON public.expert_verifications AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((expert_id = (SELECT auth.uid())) AND (EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = (SELECT auth.uid())) AND (profiles.is_expert = true))))));

DROP POLICY IF EXISTS launch_offer_usage_admin_read ON public.launch_offer_usage;
CREATE POLICY launch_offer_usage_admin_read ON public.launch_offer_usage AS PERMISSIVE FOR SELECT TO public
  USING ((((SELECT auth.jwt()) ->> 'email'::text) = ANY (ARRAY['fernando.rankwiler1997@gmail.com'::text, 'www.greenscan@gmail.com'::text])));

-- ── feedback_votes (existing cast-subquery wrap kept; only the bare IS NULL wrapped) ──
DROP POLICY IF EXISTS feedback_votes_delete_own ON public.feedback_votes;
CREATE POLICY feedback_votes_delete_own ON public.feedback_votes AS PERMISSIVE FOR DELETE TO public
  USING (((voter_key = ( SELECT (auth.uid())::text AS uid)) OR ((voter_key ~~ 'anon:%'::text) AND ((SELECT auth.uid()) IS NULL))));

DROP POLICY IF EXISTS feedback_votes_insert_own ON public.feedback_votes;
CREATE POLICY feedback_votes_insert_own ON public.feedback_votes AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((voter_key = ( SELECT (auth.uid())::text AS uid)) OR ((voter_key ~~ 'anon:%'::text) AND ((SELECT auth.uid()) IS NULL))));

DROP POLICY IF EXISTS feedback_votes_update_own ON public.feedback_votes;
CREATE POLICY feedback_votes_update_own ON public.feedback_votes AS PERMISSIVE FOR UPDATE TO public
  USING (((voter_key = ( SELECT (auth.uid())::text AS uid)) OR ((voter_key ~~ 'anon:%'::text) AND ((SELECT auth.uid()) IS NULL))))
  WITH CHECK (((voter_key = ( SELECT (auth.uid())::text AS uid)) OR ((voter_key ~~ 'anon:%'::text) AND ((SELECT auth.uid()) IS NULL))));

-- ── simple own-row insert/select/update/delete ─────────────────────────────
DROP POLICY IF EXISTS garden_diary_insert_own ON public.garden_diary;
CREATE POLICY garden_diary_insert_own ON public.garden_diary AS PERMISSIVE FOR INSERT TO public WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS garden_harvests_insert_own ON public.garden_harvests;
CREATE POLICY garden_harvests_insert_own ON public.garden_harvests AS PERMISSIVE FOR INSERT TO public WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS garden_plans_insert_own ON public.garden_plans;
CREATE POLICY garden_plans_insert_own ON public.garden_plans AS PERMISSIVE FOR INSERT TO public WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS garden_plantings_insert_own ON public.garden_plantings;
CREATE POLICY garden_plantings_insert_own ON public.garden_plantings AS PERMISSIVE FOR INSERT TO public WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS gardens_insert_own ON public.gardens;
CREATE POLICY gardens_insert_own ON public.gardens AS PERMISSIVE FOR INSERT TO public WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS harvest_insert_own ON public.harvest_log;
CREATE POLICY harvest_insert_own ON public.harvest_log AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS launch_offer_insert_own ON public.launch_offer_usage;
CREATE POLICY launch_offer_insert_own ON public.launch_offer_usage AS PERMISSIVE FOR INSERT TO public WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS marketplace_insert_own ON public.marketplace_listings;
CREATE POLICY marketplace_insert_own ON public.marketplace_listings AS PERMISSIVE FOR INSERT TO public WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS doctor_delete_own ON public.plant_doctor_history;
CREATE POLICY doctor_delete_own ON public.plant_doctor_history AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS doctor_insert_own ON public.plant_doctor_history;
CREATE POLICY doctor_insert_own ON public.plant_doctor_history AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS doctor_select_own ON public.plant_doctor_history;
CREATE POLICY doctor_select_own ON public.plant_doctor_history AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS doctor_update_own ON public.plant_doctor_history;
CREATE POLICY doctor_update_own ON public.plant_doctor_history AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = (SELECT auth.uid()))) WITH CHECK ((user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS post_comments_delete_own ON public.post_comments;
CREATE POLICY post_comments_delete_own ON public.post_comments AS PERMISSIVE FOR DELETE TO public USING (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS post_comments_insert_auth ON public.post_comments;
CREATE POLICY post_comments_insert_auth ON public.post_comments AS PERMISSIVE FOR INSERT TO public WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS post_likes_delete_own ON public.post_likes;
CREATE POLICY post_likes_delete_own ON public.post_likes AS PERMISSIVE FOR DELETE TO public USING (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS post_likes_insert_own ON public.post_likes;
CREATE POLICY post_likes_insert_own ON public.post_likes AS PERMISSIVE FOR INSERT TO public WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self ON public.profiles AS PERMISSIVE FOR INSERT TO public WITH CHECK (((SELECT auth.uid()) = id));
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles AS PERMISSIVE FOR UPDATE TO public USING (((SELECT auth.uid()) = id));

DROP POLICY IF EXISTS push_subs_update_own ON public.push_subscriptions;
CREATE POLICY push_subs_update_own ON public.push_subscriptions AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = (SELECT auth.uid()))) WITH CHECK ((user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS quiz_answers_insert_auth ON public.quiz_answers;
CREATE POLICY quiz_answers_insert_auth ON public.quiz_answers AS PERMISSIVE FOR INSERT TO public WITH CHECK (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS quiz_answers_select_own ON public.quiz_answers;
CREATE POLICY quiz_answers_select_own ON public.quiz_answers AS PERMISSIVE FOR SELECT TO public USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS quiz_ranking_update_own ON public.quiz_ranking;
CREATE POLICY quiz_ranking_update_own ON public.quiz_ranking AS PERMISSIVE FOR UPDATE TO public USING (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS quiz_ranking_upsert_own ON public.quiz_ranking;
CREATE POLICY quiz_ranking_upsert_own ON public.quiz_ranking AS PERMISSIVE FOR INSERT TO public WITH CHECK (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users insert own scans" ON public.scan_events;
CREATE POLICY "Users insert own scans" ON public.scan_events AS PERMISSIVE FOR INSERT TO public WITH CHECK (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS "Users read own scans" ON public.scan_events;
CREATE POLICY "Users read own scans" ON public.scan_events AS PERMISSIVE FOR SELECT TO public USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS social_posts_delete_own ON public.social_posts;
CREATE POLICY social_posts_delete_own ON public.social_posts AS PERMISSIVE FOR DELETE TO public USING (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS social_posts_insert_auth ON public.social_posts;
CREATE POLICY social_posts_insert_auth ON public.social_posts AS PERMISSIVE FOR INSERT TO public WITH CHECK (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS social_posts_select_all ON public.social_posts;
CREATE POLICY social_posts_select_all ON public.social_posts AS PERMISSIVE FOR SELECT TO public USING (((is_archived = false) OR ((SELECT auth.uid()) = user_id)));
DROP POLICY IF EXISTS social_posts_update_own ON public.social_posts;
CREATE POLICY social_posts_update_own ON public.social_posts AS PERMISSIVE FOR UPDATE TO public USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS stripe_subs_select_own ON public.stripe_subscriptions;
CREATE POLICY stripe_subs_select_own ON public.stripe_subscriptions AS PERMISSIVE FOR SELECT TO public USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS user_gardens_delete_own ON public.user_gardens;
CREATE POLICY user_gardens_delete_own ON public.user_gardens AS PERMISSIVE FOR DELETE TO public USING (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS user_gardens_insert_own ON public.user_gardens;
CREATE POLICY user_gardens_insert_own ON public.user_gardens AS PERMISSIVE FOR INSERT TO public WITH CHECK (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS user_gardens_select_own ON public.user_gardens;
CREATE POLICY user_gardens_select_own ON public.user_gardens AS PERMISSIVE FOR SELECT TO public USING (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS user_gardens_update_own ON public.user_gardens;
CREATE POLICY user_gardens_update_own ON public.user_gardens AS PERMISSIVE FOR UPDATE TO public USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS user_plants_delete_own ON public.user_plants;
CREATE POLICY user_plants_delete_own ON public.user_plants AS PERMISSIVE FOR DELETE TO public USING (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS user_plants_insert_own ON public.user_plants;
CREATE POLICY user_plants_insert_own ON public.user_plants AS PERMISSIVE FOR INSERT TO public WITH CHECK (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS user_plants_select_own ON public.user_plants;
CREATE POLICY user_plants_select_own ON public.user_plants AS PERMISSIVE FOR SELECT TO public USING (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS user_plants_update_own ON public.user_plants;
CREATE POLICY user_plants_update_own ON public.user_plants AS PERMISSIVE FOR UPDATE TO public USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS user_scans_delete_own ON public.user_scans;
CREATE POLICY user_scans_delete_own ON public.user_scans AS PERMISSIVE FOR DELETE TO public USING (((SELECT auth.uid()) = user_id));
DROP POLICY IF EXISTS user_scans_insert_own ON public.user_scans;
CREATE POLICY user_scans_insert_own ON public.user_scans AS PERMISSIVE FOR INSERT TO public WITH CHECK ((((SELECT auth.uid()) = user_id) OR (user_id IS NULL)));
DROP POLICY IF EXISTS user_scans_select_own ON public.user_scans;
CREATE POLICY user_scans_select_own ON public.user_scans AS PERMISSIVE FOR SELECT TO public USING (((SELECT auth.uid()) = user_id));

DROP POLICY IF EXISTS user_species_insert_auth ON public.user_species;
CREATE POLICY user_species_insert_auth ON public.user_species AS PERMISSIVE FOR INSERT TO public WITH CHECK ((((SELECT auth.uid()) = user_id) OR (user_id IS NULL)));

DROP POLICY IF EXISTS "subs insert self" ON public.user_submissions;
CREATE POLICY "subs insert self" ON public.user_submissions AS PERMISSIVE FOR INSERT TO public WITH CHECK ((user_id = (SELECT auth.uid())));
