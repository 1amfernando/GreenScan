-- ============================================================================
-- v29.16 Marktplatz-Moderation entkoppelt (MOD-P3-1, Option A) — backend-only
-- ----------------------------------------------------------------------------
-- BUG (P3, von v29.15-Diagnose-Workflow als MOD-P3-1 verifiziert):
--   marketplace_listings.status trug ZWEI Bedeutungen gleichzeitig:
--     (a) User-Lifecycle  : active / reserved / sold / archived (Tutti-Style)
--     (b) Admin-Moderation : "verstecken" = status='archived'
--   → Im Moderations-Feed (fn_admin_moderation_feed) erschien JEDES archivierte
--     Inserat als „VERSTECKT", auch wenn es der NUTZER selbst archiviert/verkauft
--     hat. Ein Admin-Klick „Einblenden" (fn_admin_moderate action=unhide) setzte
--     status='active' und machte so ein bewusst archiviertes/verkauftes Inserat
--     wieder öffentlich sichtbar → Datenkorrektheits-Bug.
--
-- FIX (Option A): zweite, orthogonale Spalte `moderation_status` (nullable).
--   - Admin-Moderation schreibt NUR noch moderation_status ('hidden'/NULL),
--     der User-Lifecycle-`status` bleibt unberührt.
--   - Der Feed zeigt für Listings nur ECHTE Admin-Hides als 'hidden'.
--   - JEDE öffentliche Sichtbarkeits-Quelle berücksichtigt zusätzlich
--     `moderation_status IS DISTINCT FROM 'hidden'` (NULL → sichtbar):
--       1) RLS-Policy marketplace_select_active  (deckt v_marketplace_listings
--          via security_invoker + alle Direkt-Reads ab)
--       2) fn_marketplace_search   (SECURITY DEFINER → RLS-Bypass, eigener Filter)
--       3) fn_following_feed       (SECURITY DEFINER seit v29.09 → eigener Filter)
--       4) fn_profile_view         (SECURITY DEFINER, marketplace_active-Count)
--   Owner-Sicht (OR auth.uid()=user_id) bleibt absichtlich ungefiltert: der
--   Eigentümer sieht/verwaltet sein Inserat weiterhin (kann es löschen).
--
-- KEINE Daten-Migration: Alt-Hides (falls überhaupt — fn_admin_moderate existiert
--   erst seit v29.11) trugen status='archived' und sind dadurch ohnehin
--   öffentlich unsichtbar; sie bleiben es. Sie sind nicht von User-Archiven
--   unterscheidbar (genau das war der Bug) → keine Auto-Reklassifizierung möglich.
--
-- KEIN App-v-Bump: das Frontend (_gsAdminModerationHtml) prüft bereits
--   `it.status === 'hidden'` und blendet „VERSTECKT"/„Einblenden" nur dann ein.
--
-- ⚠️ PAYMENT-NAHER MARKTPLATZ. Nach Anwendung als ECHTER Admin-JWT verifizieren
--    (HL#16): (1) Admin-hide/unhide schaltet NUR moderation_status, status bleibt;
--    (2) admin-hidden Inserat verschwindet aus Suche/Feed/Profil-Count + öff. Liste;
--    (3) normaler User-Archiv/Sold-Flow + öffentliche Inserat-Liste UNVERÄNDERT;
--    (4) Owner sieht eigenes (auch admin-hidden) Inserat weiter.
-- ============================================================================

-- (0) Orthogonale Moderations-Spalte (additiv, nullable) ----------------------
ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS moderation_status text;

COMMENT ON COLUMN public.marketplace_listings.moderation_status IS
  'v29.16: Admin-Moderation, orthogonal zu status. NULL=normal, ''hidden''=admin-versteckt. NUR via fn_admin_moderate.';

-- (1) fn_admin_moderate: Listing-hide/unhide schreibt moderation_status statt status
CREATE OR REPLACE FUNCTION public.fn_admin_moderate(p_type text, p_id uuid, p_action text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin_user() THEN RETURN jsonb_build_object('error','forbidden'); END IF;
  IF p_type   NOT IN ('post','listing','comment') THEN RETURN jsonb_build_object('error','invalid_type'); END IF;
  IF p_action NOT IN ('hide','unhide','delete')   THEN RETURN jsonb_build_object('error','invalid_action'); END IF;

  IF p_type = 'post' THEN
    IF p_action = 'delete' THEN
      DELETE FROM post_comments WHERE post_id = p_id;   -- Kinder zuerst (FK-sicher)
      DELETE FROM social_posts  WHERE id = p_id;
    ELSE
      UPDATE social_posts SET is_archived = (p_action = 'hide') WHERE id = p_id;
    END IF;

  ELSIF p_type = 'listing' THEN
    IF p_action = 'delete' THEN
      DELETE FROM marketplace_listings WHERE id = p_id;
    ELSE
      -- v29.16: NUR Moderations-Achse schalten, User-Lifecycle-status unberührt lassen.
      UPDATE marketplace_listings
         SET moderation_status = CASE WHEN p_action = 'hide' THEN 'hidden' ELSE NULL END
       WHERE id = p_id;
    END IF;

  ELSIF p_type = 'comment' THEN
    IF p_action <> 'delete' THEN RETURN jsonb_build_object('error','comment_only_delete'); END IF;
    DELETE FROM post_comments WHERE id = p_id;
  END IF;

  INSERT INTO audit_log (actor_id, action, target_type, target_id, diff)
  VALUES ((SELECT auth.uid()), 'admin_moderate', p_type, p_id::text, jsonb_build_object('action', p_action));
  RETURN jsonb_build_object('ok', true, 'type', p_type, 'id', p_id, 'action', p_action);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fn_admin_moderate(text, uuid, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.fn_admin_moderate(text, uuid, text) TO authenticated;

-- (2) fn_admin_moderation_feed: für Listings nur ECHTE Admin-Hides als 'hidden'
CREATE OR REPLACE FUNCTION public.fn_admin_moderation_feed(p_limit int DEFAULT 40)
RETURNS TABLE(kind text, id uuid, post_id uuid, author text, snippet text, status text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin_user() THEN RETURN; END IF;
  RETURN QUERY
    SELECT * FROM (
      SELECT 'post'::text, p.id, p.id, coalesce(p.author_name,'?'),
             left(coalesce(p.content,''),120), CASE WHEN p.is_archived THEN 'hidden' ELSE 'active' END, p.created_at
        FROM social_posts p
      UNION ALL
      SELECT 'listing', l.id, NULL::uuid, coalesce(pr.display_name, '?'),
             left(coalesce(l.title,''),120),
             CASE WHEN l.moderation_status = 'hidden' THEN 'hidden' ELSE 'active' END,
             l.created_at
        FROM marketplace_listings l LEFT JOIN profiles pr ON pr.id = l.user_id
      UNION ALL
      SELECT 'comment', c.id, c.post_id, coalesce(c.author_name,'?'),
             left(coalesce(c.content,''),120), 'comment', c.created_at
        FROM post_comments c
    ) q
    ORDER BY q.created_at DESC
    LIMIT greatest(1, least(p_limit, 100));
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fn_admin_moderation_feed(int) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.fn_admin_moderation_feed(int) TO authenticated;

-- (3) RLS: öffentliche Sicht zusätzlich an moderation_status koppeln -----------
--     Owner-Zweig bewusst ungefiltert (Eigentümer verwaltet sein Inserat weiter).
DROP POLICY IF EXISTS marketplace_select_active ON public.marketplace_listings;
CREATE POLICY marketplace_select_active ON public.marketplace_listings
  FOR SELECT
  USING (
    (status IN ('active','reserved') AND moderation_status IS DISTINCT FROM 'hidden')
    OR (SELECT auth.uid()) = user_id
  );

-- (4) fn_marketplace_search (SECURITY DEFINER → RLS-Bypass): Hidden ausschließen
CREATE OR REPLACE FUNCTION public.fn_marketplace_search(
    p_query text DEFAULT ''::text,
    p_category text DEFAULT NULL::text,
    p_region text DEFAULT NULL::text,
    p_price_min numeric DEFAULT NULL::numeric,
    p_price_max numeric DEFAULT NULL::numeric,
    p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, user_id uuid, title text, description text, category text,
    price numeric, currency text, region text, contact text, photo_url text,
    photo_urls text[], price_mode text, status text, views integer, reports integer,
    created_at timestamp with time zone, updated_at timestamp with time zone,
    sold_at timestamp with time zone, organic_certified boolean, pesticide_free boolean,
    certification_label text, allow_online_payment boolean, contact_method text,
    seller_name text, seller_avatar text, seller_is_expert boolean,
    seller_is_premium boolean, seller_level integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_q text := nullif(btrim(coalesce(p_query,'')), '');
        v_ts tsquery;
BEGIN
  IF v_q IS NOT NULL AND length(v_q) >= 2 THEN
    BEGIN v_ts := websearch_to_tsquery('german', v_q); EXCEPTION WHEN others THEN v_ts := NULL; END;
  END IF;
  RETURN QUERY
  SELECT m.id, m.user_id, m.title, m.description, m.category, m.price, m.currency,
         m.region, m.contact, m.photo_url, m.photo_urls, m.price_mode, m.status,
         m.views, m.reports, m.created_at, m.updated_at, m.sold_at,
         m.organic_certified, m.pesticide_free, m.certification_label,
         m.allow_online_payment, m.contact_method,
         COALESCE(p.display_name, split_part(p.email,'@'::citext,1), 'Anonym') AS seller_name,
         p.avatar_emoji AS seller_avatar,
         p.is_expert AS seller_is_expert,
         COALESCE(p.tier = ANY (ARRAY['plus','pro','plus_lifetime']), false) AS seller_is_premium,
         COALESCE(p.level, 1) AS seller_level
    FROM public.marketplace_listings m
    LEFT JOIN public.profiles p ON p.id = m.user_id
   WHERE m.status = 'active'
     AND m.moderation_status IS DISTINCT FROM 'hidden'   -- v29.16: admin-hidden raus
     AND (p_category IS NULL OR m.category = p_category)
     AND (p_region   IS NULL OR m.region   = p_region)
     AND (p_price_min IS NULL OR m.price >= p_price_min)
     AND (p_price_max IS NULL OR m.price <= p_price_max)
     AND (v_ts IS NULL OR to_tsvector('german', coalesce(m.title,'')||' '||coalesce(m.description,'')) @@ v_ts)
   ORDER BY
     CASE WHEN v_ts IS NOT NULL
          THEN ts_rank(to_tsvector('german', coalesce(m.title,'')||' '||coalesce(m.description,'')), v_ts)
          ELSE 0 END DESC,
     m.created_at DESC
   LIMIT GREATEST(1, LEAST(coalesce(p_limit,50), 100));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_marketplace_search(text, text, text, numeric, numeric, integer) TO anon, authenticated;

-- (5) fn_following_feed (SECURITY DEFINER seit v29.09 → RLS-Bypass): Hidden raus
--     Body identisch zu v27.02/v29.09, nur Listing-Zweig um moderation-Filter ergänzt.
CREATE OR REPLACE FUNCTION public.fn_following_feed(p_limit int DEFAULT 30)
RETURNS TABLE (kind text, user_id uuid, display_name text, avatar_url text, avatar_emoji text,
               ref_id text, title text, icon text, ts timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
  WHERE ml.status = 'active' AND ml.moderation_status IS DISTINCT FROM 'hidden'  -- v29.16
    AND ml.created_at > now() - interval '7 days'
    AND coalesce(p.show_marketplace, true) = true AND coalesce(p.opt_in_feed, true) = true
  ORDER BY ts DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;
REVOKE ALL ON FUNCTION public.fn_following_feed(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_following_feed(int) TO authenticated;

-- (6) fn_profile_view (SECURITY DEFINER): marketplace_active-Count ohne Hidden
--     Body identisch zu v27.02, nur der marketplace_active-Count um moderation-Filter ergänzt.
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
      (SELECT count(*) FROM public.marketplace_listings
        WHERE user_id = p_user_id AND status = 'active'
          AND moderation_status IS DISTINCT FROM 'hidden'));  -- v29.16
  END IF;
  IF v_target.show_finds_public THEN
    v_result := v_result || jsonb_build_object('public_finds_count',
      (SELECT count(*) FROM public.map_user_finds WHERE user_id = p_user_id AND is_private = false));
  END IF;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.fn_profile_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_profile_view(uuid) TO authenticated;
