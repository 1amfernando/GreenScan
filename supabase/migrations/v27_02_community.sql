-- ============================================================================
-- v27_02_community — Community-Profile + Following + Block-System (Privacy-zentral)
-- Spiegel der LIVE angewandten Migration (project vowbiueikwrauuceilhc).
-- Hard-Lesson #14-Korrekturen ggü. Spec:
--  * profiles.bio existiert bereits; avatar_url NEU (avatar_emoji bleibt).
--  * user_achievements: achievement_slug + unlocked_at (KEIN tier/reached_at/slug)
--    → Following-Feed nutzt c.rarity <> 'common' statt ua.tier >= 2.
--  * Avatar-Bucket: bestehenden 'avatars'-Bucket wiederverwenden (kein neuer).
-- Hard-Lesson #13: alle DEFINER-Fns REVOKE PUBLIC,anon + GRANT authenticated.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS profile_visibility text NOT NULL DEFAULT 'public'
    CHECK (profile_visibility IN ('public','followers_only','private')),
  ADD COLUMN IF NOT EXISTS show_finds_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_plants_count boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_achievements boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_marketplace boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS opt_in_feed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS bio_emoji text;
DO $$ BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_bio_len CHECK (length(coalesce(bio,'')) <= 200);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followed_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followed_id),
  CHECK (follower_id <> followed_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_followed ON public.user_follows (followed_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.user_follows (follower_id, created_at DESC);
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS follows_read_all ON public.user_follows;
CREATE POLICY follows_read_all ON public.user_follows FOR SELECT USING (true);
DROP POLICY IF EXISTS follows_own_insert ON public.user_follows;
CREATE POLICY follows_own_insert ON public.user_follows
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = follower_id);
DROP POLICY IF EXISTS follows_own_delete ON public.user_follows;
CREATE POLICY follows_own_delete ON public.user_follows
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = follower_id);
GRANT SELECT, INSERT, DELETE ON public.user_follows TO authenticated;

CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  reason     text,
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS blocks_own ON public.user_blocks;
CREATE POLICY blocks_own ON public.user_blocks
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = blocker_id)
  WITH CHECK ((SELECT auth.uid()) = blocker_id);
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;

-- fn_profile_view: ALLE Privacy-Checks server-seitig (Block-beidseitig, Visibility,
-- Stats nur bei Opt-In; gibt NIE E-Mail/Pläne/Diary/private-Funde/Tasks/Doktor zurück).
CREATE OR REPLACE FUNCTION public.fn_profile_view(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_viewer uuid := (SELECT auth.uid());
  v_target record; v_can_view boolean := false; v_is_follower boolean := false; v_is_blocked boolean := false;
  v_result jsonb;
BEGIN
  IF v_viewer IS NULL THEN RETURN jsonb_build_object('error','not_authed'); END IF;
  SELECT p.id, p.display_name, p.bio, p.bio_emoji, p.avatar_url, p.avatar_emoji, p.region,
         p.profile_visibility, p.show_finds_public, p.show_plants_count,
         p.show_achievements, p.show_marketplace, p.opt_in_feed, p.role, p.is_expert, p.is_admin
    INTO v_target FROM public.profiles p WHERE p.id = p_user_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = p_user_id AND blocked_id = v_viewer)
       OR (blocker_id = v_viewer AND blocked_id = p_user_id)) INTO v_is_blocked;
  IF v_is_blocked THEN RETURN jsonb_build_object('error','blocked'); END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_follows
    WHERE follower_id = v_viewer AND followed_id = p_user_id) INTO v_is_follower;
  IF v_target.profile_visibility = 'public' THEN v_can_view := true;
  ELSIF v_target.profile_visibility = 'followers_only' THEN v_can_view := v_is_follower OR (v_viewer = p_user_id);
  ELSIF v_target.profile_visibility = 'private' THEN v_can_view := (v_viewer = p_user_id); END IF;
  IF NOT v_can_view THEN
    RETURN jsonb_build_object('id', v_target.id, 'display_name', v_target.display_name,
      'avatar_url', v_target.avatar_url, 'avatar_emoji', v_target.avatar_emoji,
      'visibility', v_target.profile_visibility, 'can_view', false, 'is_self', (v_viewer = p_user_id));
  END IF;
  v_result := jsonb_build_object(
    'id', v_target.id, 'display_name', v_target.display_name, 'bio', v_target.bio, 'bio_emoji', v_target.bio_emoji,
    'avatar_url', v_target.avatar_url, 'avatar_emoji', v_target.avatar_emoji, 'region', v_target.region,
    'role', v_target.role, 'is_expert', v_target.is_expert, 'is_admin', v_target.is_admin,
    'visibility', v_target.profile_visibility, 'can_view', true, 'is_self', (v_viewer = p_user_id), 'is_following', v_is_follower,
    'follower_count', (SELECT count(*) FROM public.user_follows WHERE followed_id = p_user_id),
    'following_count', (SELECT count(*) FROM public.user_follows WHERE follower_id = p_user_id));
  IF v_target.show_plants_count THEN
    v_result := v_result || jsonb_build_object('plants_count',
      (SELECT jsonb_array_length(coalesce(data->'plants','[]'::jsonb)) FROM public.user_plants WHERE user_id = p_user_id));
  END IF;
  IF v_target.show_achievements THEN
    v_result := v_result || jsonb_build_object(
      'achievements_count', (SELECT count(*) FROM public.user_achievements WHERE user_id = p_user_id),
      'showcase', (SELECT showcase_achievements FROM public.profiles WHERE id = p_user_id));
  END IF;
  IF v_target.show_marketplace THEN
    v_result := v_result || jsonb_build_object('marketplace_active',
      (SELECT count(*) FROM public.marketplace_listings WHERE user_id = p_user_id AND status = 'active'));
  END IF;
  IF v_target.show_finds_public THEN
    v_result := v_result || jsonb_build_object('public_finds_count',
      (SELECT count(*) FROM public.map_user_finds WHERE user_id = p_user_id AND is_private = false));
  END IF;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.fn_profile_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_profile_view(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_follow_toggle(p_target uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := (SELECT auth.uid()); v_existed boolean;
BEGIN
  IF v_uid IS NULL OR v_uid = p_target THEN RETURN jsonb_build_object('error','invalid'); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id = p_target) THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF EXISTS(SELECT 1 FROM public.user_blocks WHERE blocker_id = p_target AND blocked_id = v_uid) THEN
    RETURN jsonb_build_object('error','blocked_by_target'); END IF;
  DELETE FROM public.user_follows WHERE follower_id = v_uid AND followed_id = p_target RETURNING true INTO v_existed;
  IF v_existed THEN RETURN jsonb_build_object('action','unfollowed'); END IF;
  INSERT INTO public.user_follows (follower_id, followed_id) VALUES (v_uid, p_target) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('action','followed');
END $$;
REVOKE ALL ON FUNCTION public.fn_follow_toggle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_follow_toggle(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_block_toggle(p_target uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := (SELECT auth.uid()); v_existed boolean;
BEGIN
  IF v_uid IS NULL OR v_uid = p_target THEN RETURN jsonb_build_object('error','invalid'); END IF;
  DELETE FROM public.user_blocks WHERE blocker_id = v_uid AND blocked_id = p_target RETURNING true INTO v_existed;
  IF v_existed THEN RETURN jsonb_build_object('action','unblocked'); END IF;
  DELETE FROM public.user_follows WHERE
    (follower_id = v_uid AND followed_id = p_target) OR (follower_id = p_target AND followed_id = v_uid);
  INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES (v_uid, p_target) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('action','blocked');
END $$;
REVOKE ALL ON FUNCTION public.fn_block_toggle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_block_toggle(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_user_search(p_q text, p_limit int DEFAULT 20)
RETURNS TABLE (id uuid, display_name text, bio text, avatar_url text, avatar_emoji text, region text, follower_count int)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  SELECT p.id, p.display_name, p.bio, p.avatar_url, p.avatar_emoji, p.region,
    (SELECT count(*)::int FROM public.user_follows WHERE followed_id = p.id) AS follower_count
  FROM public.profiles p
  WHERE p.profile_visibility <> 'private' AND coalesce(p.display_name,'') <> ''
    AND length(coalesce(p_q,'')) >= 2 AND lower(p.display_name) ILIKE '%' || lower(p_q) || '%'
    AND p.id <> (SELECT auth.uid())
    AND NOT EXISTS(SELECT 1 FROM public.user_blocks ub
      WHERE (ub.blocker_id = p.id AND ub.blocked_id = (SELECT auth.uid()))
         OR (ub.blocker_id = (SELECT auth.uid()) AND ub.blocked_id = p.id))
  ORDER BY follower_count DESC, p.display_name ASC
  LIMIT GREATEST(1, LEAST(p_limit, 50));
$$;
REVOKE ALL ON FUNCTION public.fn_user_search(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_user_search(text, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_user_discover(p_region text DEFAULT NULL, p_limit int DEFAULT 12)
RETURNS TABLE (id uuid, display_name text, bio text, avatar_url text, avatar_emoji text, region text,
               follower_count int, achievements_count int, is_expert boolean, created_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  SELECT p.id, p.display_name, p.bio, p.avatar_url, p.avatar_emoji, p.region,
    (SELECT count(*)::int FROM public.user_follows WHERE followed_id = p.id) AS follower_count,
    (SELECT count(*)::int FROM public.user_achievements WHERE user_id = p.id) AS achievements_count,
    p.is_expert, p.created_at
  FROM public.profiles p
  WHERE p.profile_visibility = 'public' AND coalesce(p.display_name,'') <> '' AND p.id <> (SELECT auth.uid())
    AND (p_region IS NULL OR lower(coalesce(p.region,'')) = lower(p_region))
    AND NOT EXISTS(SELECT 1 FROM public.user_blocks ub
      WHERE (ub.blocker_id = p.id AND ub.blocked_id = (SELECT auth.uid()))
         OR (ub.blocker_id = (SELECT auth.uid()) AND ub.blocked_id = p.id))
  ORDER BY follower_count DESC, p.is_expert DESC, p.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 40));
$$;
REVOKE ALL ON FUNCTION public.fn_user_discover(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_user_discover(text, int) TO authenticated;

-- Following-Feed (Hard-Lesson #14: achievement_slug + unlocked_at + rarity, KEIN tier)
CREATE OR REPLACE FUNCTION public.fn_following_feed(p_limit int DEFAULT 30)
RETURNS TABLE (kind text, user_id uuid, display_name text, avatar_url text, avatar_emoji text,
               ref_id text, title text, icon text, ts timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  WITH followed AS (SELECT followed_id FROM public.user_follows WHERE follower_id = (SELECT auth.uid()))
  SELECT 'achievement' AS kind, ua.user_id, p.display_name, p.avatar_url, p.avatar_emoji,
    ua.achievement_slug::text AS ref_id, c.title, c.icon, ua.unlocked_at AS ts
  FROM public.user_achievements ua
  JOIN followed f ON f.followed_id = ua.user_id
  JOIN public.profiles p ON p.id = ua.user_id
  JOIN public.achievements_catalog c ON c.slug = ua.achievement_slug
  WHERE ua.unlocked_at > now() - interval '7 days' AND coalesce(c.rarity,'common') <> 'common'
    AND coalesce(p.opt_in_feed, true) = true
  UNION ALL
  SELECT 'find', mf.user_id, p.display_name, p.avatar_url, p.avatar_emoji,
    mf.id::text, mf.species_name, '📍', mf.found_at
  FROM public.map_user_finds mf
  JOIN followed f ON f.followed_id = mf.user_id
  JOIN public.profiles p ON p.id = mf.user_id
  WHERE mf.is_private = false AND mf.found_at > now() - interval '7 days'
    AND coalesce(p.show_finds_public, false) = true AND coalesce(p.opt_in_feed, true) = true
  UNION ALL
  SELECT 'listing', ml.user_id, p.display_name, p.avatar_url, p.avatar_emoji,
    ml.id::text, ml.title, '🤝', ml.created_at
  FROM public.marketplace_listings ml
  JOIN followed f ON f.followed_id = ml.user_id
  JOIN public.profiles p ON p.id = ml.user_id
  WHERE ml.status = 'active' AND ml.created_at > now() - interval '7 days'
    AND coalesce(p.show_marketplace, true) = true AND coalesce(p.opt_in_feed, true) = true
  ORDER BY ts DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;
REVOKE ALL ON FUNCTION public.fn_following_feed(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_following_feed(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_blocked_list()
RETURNS TABLE (blocked_id uuid, display_name text, avatar_emoji text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  SELECT b.blocked_id, p.display_name, p.avatar_emoji, b.created_at
  FROM public.user_blocks b
  LEFT JOIN public.profiles p ON p.id = b.blocked_id
  WHERE b.blocker_id = (SELECT auth.uid())
  ORDER BY b.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.fn_blocked_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_blocked_list() TO authenticated;
