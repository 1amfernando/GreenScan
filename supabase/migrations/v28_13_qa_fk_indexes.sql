-- ============================================================================
-- v28_13_qa_fk_indexes — Full-App-QA-Sweep Quick-Fixes (Spiegel der LIVE-Migration).
-- Aus dem Advisor-Pass (siehe QA_v28.12.md): 7 fehlende FK-Indizes + 1 search_path-Pin.
-- Alle additiv/semantik-erhaltend (Perf-Win, kein Verhaltens-Change). 0 neue ERRORs.
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_class_submissions_user      ON public.class_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_messages_user         ON public.coach_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_created_by      ON public.org_invites(created_by);
CREATE INDEX IF NOT EXISTS idx_org_invites_used_by         ON public.org_invites(used_by);
CREATE INDEX IF NOT EXISTS idx_org_members_invited_by      ON public.org_members(invited_by);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked         ON public.user_blocks(blocked_id);
CREATE INDEX IF NOT EXISTS idx_uwcp_challenge             ON public.user_weekly_challenge_progress(challenge_id);

ALTER FUNCTION public._gs_parse_ts_flex(p text) SET search_path = public, pg_temp;

-- Bewusst NICHT geändert (kurz vor Launch, dokumentiert in QA_v28.12.md):
--   v_marketplace_listings (security_definer_view) bleibt DEFINER — exponiert nur öffentliche
--   Listing-Daten + Verkäufer-Badges; security_invoker würde Verkäufer-Namen-Anzeige riskieren.
