-- v26.51 Backend Security + Performance Hardening
-- Reagiert auf Supabase-Advisor-Findings vom 2026-05-24:
--   Pre-Fix: 14 ERROR + 84 WARN security lints, 376 perf lints
--   Post-Fix: 0 ERROR + 75 WARN security lints
--
-- 1) 14 SECURITY DEFINER Views → security_invoker=true (RLS wieder respektiert)
-- 2) feedback_votes RLS gehärtet (war ALWAYS-TRUE auf INSERT/UPDATE/DELETE)
-- 3) 29 Indexes auf Foreign-Keys (Perf-Boost)
-- 4) 6 Duplicate-Indexes gedroppt
-- 5) 2 function_search_path_mutable fix
-- 6) (sub-migration v26_51b) 4 admin-only Functions REVOKE EXECUTE

-- ═══════════════════════════════════════════════════════════
-- TEIL 1: SECURITY DEFINER Views → INVOKER
-- Pre-Fix Risk: Jeder authenticated User konnte über die View Daten lesen,
-- die durch RLS auf der Underlying-Table normalerweise limitiert wären.
-- ═══════════════════════════════════════════════════════════
ALTER VIEW public.v_ai_usage_monthly SET (security_invoker = true);
ALTER VIEW public.v_ai_usage_summary SET (security_invoker = true);
ALTER VIEW public.v_ai_usage_weekly SET (security_invoker = true);
ALTER VIEW public.v_companion_lookup SET (security_invoker = true);
ALTER VIEW public.v_cron_health SET (security_invoker = true);
ALTER VIEW public.v_harvest_stats_per_user SET (security_invoker = true);
ALTER VIEW public.v_knowledge_db_stats SET (security_invoker = true);
ALTER VIEW public.v_knowledge_search SET (security_invoker = true);
ALTER VIEW public.v_marketplace_listings SET (security_invoker = true);
ALTER VIEW public.v_mushroom_safety SET (security_invoker = true);
ALTER VIEW public.v_my_marketplace_seller SET (security_invoker = true);
ALTER VIEW public.v_social_posts_with_verifications SET (security_invoker = true);
ALTER VIEW public.v_species_stats SET (security_invoker = true);
ALTER VIEW public.v_user_entitlements SET (security_invoker = true);

-- ═══════════════════════════════════════════════════════════
-- TEIL 2: feedback_votes RLS-Hardening
-- War USING(true), WITH CHECK(true) für INSERT/UPDATE/DELETE → jeder konnte
-- die Votes anderer ändern/löschen. Jetzt: voter_key = uid bzw. anonymous-Key.
-- ═══════════════════════════════════════════════════════════
DROP POLICY IF EXISTS feedback_votes_insert_any ON public.feedback_votes;
DROP POLICY IF EXISTS feedback_votes_update_any ON public.feedback_votes;
DROP POLICY IF EXISTS feedback_votes_delete_any ON public.feedback_votes;

CREATE POLICY feedback_votes_insert_own ON public.feedback_votes
  FOR INSERT TO public
  WITH CHECK (
    voter_key = (SELECT auth.uid()::text)
    OR (voter_key LIKE 'anon:%' AND auth.uid() IS NULL)
  );

CREATE POLICY feedback_votes_update_own ON public.feedback_votes
  FOR UPDATE TO public
  USING (
    voter_key = (SELECT auth.uid()::text)
    OR (voter_key LIKE 'anon:%' AND auth.uid() IS NULL)
  )
  WITH CHECK (
    voter_key = (SELECT auth.uid()::text)
    OR (voter_key LIKE 'anon:%' AND auth.uid() IS NULL)
  );

CREATE POLICY feedback_votes_delete_own ON public.feedback_votes
  FOR DELETE TO public
  USING (
    voter_key = (SELECT auth.uid()::text)
    OR (voter_key LIKE 'anon:%' AND auth.uid() IS NULL)
  );

-- ═══════════════════════════════════════════════════════════
-- TEIL 3: 29 Indexes auf Foreign-Keys (Perf-Boost)
-- ═══════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_ai_queries_user_id ON public.ai_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_updated_by ON public.app_settings(updated_by);
CREATE INDEX IF NOT EXISTS idx_book_ingest_jobs_user_id ON public.book_ingest_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON public.friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON public.friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_garden_diary_user_id ON public.garden_diary(user_id);
CREATE INDEX IF NOT EXISTS idx_garden_harvests_user_id ON public.garden_harvests(user_id);
CREATE INDEX IF NOT EXISTS idx_garden_plans_user_id ON public.garden_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_garden_tasks_user_id ON public.garden_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_harvest_log_user_id ON public.harvest_log(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_user_id ON public.marketplace_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_plant_diagnoses_user_id ON public.plant_diagnoses(user_id);
CREATE INDEX IF NOT EXISTS idx_plant_doctor_history_user_id ON public.plant_doctor_history(user_id);
CREATE INDEX IF NOT EXISTS idx_plant_reminder_snoozes_user_id ON public.plant_reminder_snoozes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_push_send_log_user_id ON public.push_send_log(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_user_id ON public.quiz_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_ranking_user_id ON public.quiz_ranking(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_corrections_user_id ON public.scan_corrections(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_events_user_id ON public.scan_events(user_id);
CREATE INDEX IF NOT EXISTS idx_sensor_alerts_user_id ON public.sensor_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_sensor_alerts_device_id ON public.sensor_alerts(device_id);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_user_id ON public.sensor_readings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON public.user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quest_progress_user_id ON public.user_quest_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quest_progress_quest_id ON public.user_quest_progress(quest_id);
CREATE INDEX IF NOT EXISTS idx_user_scans_user_id ON public.user_scans(user_id);

-- ═══════════════════════════════════════════════════════════
-- TEIL 4: Duplicate-Indexes droppen (6 Stück)
-- Behalten: idx_<table>_<col>-Namen als Single-Source.
-- ═══════════════════════════════════════════════════════════
DROP INDEX IF EXISTS public.idx_ai_usage_date;
DROP INDEX IF EXISTS public.idx_diary_user_ts;
DROP INDEX IF EXISTS public.idx_harvests_user_ts;
DROP INDEX IF EXISTS public.idx_plantings_user;
DROP INDEX IF EXISTS public.idx_plantings_garden;
DROP INDEX IF EXISTS public.idx_species_name_tri;

-- ═══════════════════════════════════════════════════════════
-- TEIL 5: function_search_path_mutable fix (2 Funktionen)
-- Schutz vor Search-Path-Injection in SECURITY DEFINER Funktionen.
-- ═══════════════════════════════════════════════════════════
ALTER FUNCTION public.update_expert_verif_timestamp() SET search_path = '';
ALTER FUNCTION public.fn_normalize_species_cat() SET search_path = '';

-- ═══════════════════════════════════════════════════════════
-- TEIL 6: (siehe v26_51b_lock_admin_only_functions.sql)
-- REVOKE EXECUTE für 4 admin-only Functions von public/anon/authenticated.
-- ═══════════════════════════════════════════════════════════
