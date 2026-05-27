-- v26.58 — User-Engagement-Tabellen (Cowork-Auftrag 2026-05-27)
-- Autor: Cowork-Claude
-- Auftrag: User-Engagement messen + Weekly-Challenges + Garden-Score-Trend
-- Deploy: via mcp__supabase__apply_migration

-- =============================================================================
-- 1) achievement_progress — Inkrementeller Fortschritt für Multi-Step-Achievements
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.achievement_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_slug text NOT NULL, -- FK soft auf achievements_catalog.slug
  current_value int NOT NULL DEFAULT 0,
  target_value int NOT NULL,
  last_updated timestamptz DEFAULT now() NOT NULL,
  unlocked_at timestamptz,
  PRIMARY KEY (user_id, achievement_slug)
);

CREATE INDEX IF NOT EXISTS idx_ap_user_unlocked ON public.achievement_progress(user_id, unlocked_at);
CREATE INDEX IF NOT EXISTS idx_ap_user_pct ON public.achievement_progress(user_id, (current_value::numeric / NULLIF(target_value,0))) WHERE unlocked_at IS NULL;

ALTER TABLE public.achievement_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ap_own ON public.achievement_progress;
CREATE POLICY ap_own ON public.achievement_progress
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

COMMENT ON TABLE public.achievement_progress IS 'v26.58 — Inkrementeller Fortschritt pro User+Achievement. unlocked_at=NULL solange in-progress.';

-- =============================================================================
-- 2) weekly_challenges — Wöchentliche System-Challenges für ganze Userbase
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.weekly_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_iso text NOT NULL, -- '2026-W22'
  title text NOT NULL,
  description text NOT NULL,
  emoji text DEFAULT '🏆',
  reward_xp int DEFAULT 50 NOT NULL,
  reward_badge_slug text,
  condition jsonb NOT NULL, -- { type:'scan_count'|'harvest_kg'|'diary_entries'|'plants_added', target:5, scope:'week' }
  active_from timestamptz NOT NULL,
  active_until timestamptz NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (week_iso, title)
);

CREATE INDEX IF NOT EXISTS idx_wc_active ON public.weekly_challenges(active_from, active_until);
CREATE INDEX IF NOT EXISTS idx_wc_week ON public.weekly_challenges(week_iso);

ALTER TABLE public.weekly_challenges ENABLE ROW LEVEL SECURITY;

-- Public read (alle User können laufende Challenges sehen)
DROP POLICY IF EXISTS wc_public_read ON public.weekly_challenges;
CREATE POLICY wc_public_read ON public.weekly_challenges
  FOR SELECT
  USING (true);

-- Admin write only
DROP POLICY IF EXISTS wc_admin_write ON public.weekly_challenges;
CREATE POLICY wc_admin_write ON public.weekly_challenges
  FOR INSERT
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS wc_admin_update ON public.weekly_challenges;
CREATE POLICY wc_admin_update ON public.weekly_challenges
  FOR UPDATE
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

COMMENT ON TABLE public.weekly_challenges IS 'v26.58 — System-weite wöchentliche Challenges. Admin-curated. Public read.';

-- =============================================================================
-- 3) user_weekly_challenge_progress — Per User Progress
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_weekly_challenge_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES public.weekly_challenges(id) ON DELETE CASCADE,
  started_at timestamptz DEFAULT now() NOT NULL,
  completed_at timestamptz,
  progress jsonb DEFAULT '{}'::jsonb, -- { current: 3, target: 5, last_event: '...' }
  PRIMARY KEY (user_id, challenge_id)
);

CREATE INDEX IF NOT EXISTS idx_uwcp_user_completed ON public.user_weekly_challenge_progress(user_id, completed_at);

ALTER TABLE public.user_weekly_challenge_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS uwcp_own ON public.user_weekly_challenge_progress;
CREATE POLICY uwcp_own ON public.user_weekly_challenge_progress
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

COMMENT ON TABLE public.user_weekly_challenge_progress IS 'v26.58 — Per-User Fortschritt + Completion-Zeitpunkt.';

-- =============================================================================
-- 4) garden_score_history — Berechneter Garten-Score über Zeit
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.garden_score_history (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  computed_at timestamptz DEFAULT now() NOT NULL,
  score numeric(6,2) NOT NULL, -- 0-100
  breakdown jsonb NOT NULL, -- { diversity: 22, biodiversity: 18, care: 25, harvest: 15, pollinator: 20 }
  plant_count int,
  harvest_total_kg numeric(8,2),
  notes text
);

CREATE INDEX IF NOT EXISTS idx_gsh_user_computed ON public.garden_score_history(user_id, computed_at DESC);

ALTER TABLE public.garden_score_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gsh_own ON public.garden_score_history;
CREATE POLICY gsh_own ON public.garden_score_history
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

COMMENT ON TABLE public.garden_score_history IS 'v26.58 — Berechneter Garten-Score über Zeit. Pro Tag 1 Eintrag via Cron.';

-- =============================================================================
-- 5) social_garden_visits — Wer-besucht-wessen-Garten (Social-Feed-Foundation)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.social_garden_visits (
  id bigserial PRIMARY KEY,
  visitor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visited_at timestamptz DEFAULT now() NOT NULL,
  viewed_garden_id uuid,
  viewed_post_id uuid,
  source text -- 'feed' / 'profile' / 'marketplace' / 'search'
);

CREATE INDEX IF NOT EXISTS idx_sgv_host_visited ON public.social_garden_visits(host_user_id, visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_sgv_visitor ON public.social_garden_visits(visitor_user_id, visited_at DESC);

ALTER TABLE public.social_garden_visits ENABLE ROW LEVEL SECURITY;

-- Host sieht alle Visits AN sein Garten
DROP POLICY IF EXISTS sgv_host_read ON public.social_garden_visits;
CREATE POLICY sgv_host_read ON public.social_garden_visits
  FOR SELECT
  USING (host_user_id = (SELECT auth.uid()));

-- Visitor INSERT own
DROP POLICY IF EXISTS sgv_visitor_insert ON public.social_garden_visits;
CREATE POLICY sgv_visitor_insert ON public.social_garden_visits
  FOR INSERT
  WITH CHECK (visitor_user_id = (SELECT auth.uid()));

-- Visitor sieht eigene Visits (Profile-View "Welche Gärten habe ich besucht")
DROP POLICY IF EXISTS sgv_visitor_read ON public.social_garden_visits;
CREATE POLICY sgv_visitor_read ON public.social_garden_visits
  FOR SELECT
  USING (visitor_user_id = (SELECT auth.uid()));

COMMENT ON TABLE public.social_garden_visits IS 'v26.58 — Social-Garden-Besuche. Host sieht "Wer war auf meinem Garten", Visitor sieht "Welche Gärten habe ich besucht".';

-- =============================================================================
-- 6) v_user_engagement_summary — Aggregations-View für Admin-Dashboard
-- =============================================================================
CREATE OR REPLACE VIEW public.v_user_engagement_summary AS
SELECT
  p.id AS user_id,
  p.email,
  COALESCE(ap_done.count, 0) AS achievements_unlocked,
  COALESCE(wcp_done.count, 0) AS weekly_challenges_completed,
  gsh.latest_score,
  gsh.latest_score_at,
  COALESCE(visits.in_count, 0) AS garden_visits_received,
  COALESCE(visits.out_count, 0) AS garden_visits_made
FROM auth.users p
LEFT JOIN (
  SELECT user_id, count(*) AS count FROM public.achievement_progress WHERE unlocked_at IS NOT NULL GROUP BY user_id
) ap_done ON ap_done.user_id = p.id
LEFT JOIN (
  SELECT user_id, count(*) AS count FROM public.user_weekly_challenge_progress WHERE completed_at IS NOT NULL GROUP BY user_id
) wcp_done ON wcp_done.user_id = p.id
LEFT JOIN LATERAL (
  SELECT score AS latest_score, computed_at AS latest_score_at
  FROM public.garden_score_history h
  WHERE h.user_id = p.id
  ORDER BY computed_at DESC LIMIT 1
) gsh ON true
LEFT JOIN (
  SELECT host_user_id AS user_id, count(*) AS in_count, NULL::bigint AS out_count FROM public.social_garden_visits GROUP BY host_user_id
  UNION ALL
  SELECT visitor_user_id, NULL, count(*) FROM public.social_garden_visits GROUP BY visitor_user_id
) visits ON visits.user_id = p.id;

COMMENT ON VIEW public.v_user_engagement_summary IS 'v26.58 — Engagement-Aggregat pro User für Admin-Dashboard.';

-- =============================================================================
-- Final-Verify (manuell laufen lassen):
-- =============================================================================
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema='public'
--     AND table_name IN ('achievement_progress','weekly_challenges','user_weekly_challenge_progress','garden_score_history','social_garden_visits');
-- SELECT count(*) FROM public.v_user_engagement_summary;
