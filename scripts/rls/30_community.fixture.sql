set check_function_bodies = off;
-- Fixture fuer scripts/rls/30_community.js — Ausschnitt des Live-Stands, live gelesen 10.11.2026
-- (scratchpad/live: columns.txt, constraints.txt, functions.sql, policies.txt, triggers.json; nur lesend).
-- Tabellen mit den LIVE-Spalten (ohne Fremdschluessel ausser auth.users), Funktionen und Policies im WORTLAUT.
-- Kein Geheimnis darin: keine der uebernommenen Funktionen traegt einen Schluessel.

create table public.profiles (
  id uuid NOT NULL,
  email text ,
  display_name text ,
  avatar_emoji text DEFAULT '🌿'::text,
  bio text ,
  xp integer DEFAULT 0,
  level integer DEFAULT 1,
  login_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  total_logins integer DEFAULT 0,
  last_login date ,
  stats jsonb DEFAULT '{}'::jsonb,
  milestones jsonb DEFAULT '[]'::jsonb,
  tier text DEFAULT 'free'::text,
  is_expert boolean DEFAULT false,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  role text DEFAULT 'user'::text,
  role_assigned_at timestamptz DEFAULT now(),
  role_assigned_by uuid ,
  role_note text ,
  scan_count integer DEFAULT 0,
  last_scan_at timestamptz ,
  is_lifetime boolean DEFAULT false,
  showcase_achievements text[] DEFAULT '{}'::text[],
  opt_in_achievement_feed boolean DEFAULT true,
  quiz_elo integer NOT NULL DEFAULT 1200,
  battles_won integer NOT NULL DEFAULT 0,
  battles_lost integer NOT NULL DEFAULT 0,
  battles_tied integer NOT NULL DEFAULT 0,
  avatar_url text ,
  profile_visibility text NOT NULL DEFAULT 'public'::text,
  show_finds_public boolean NOT NULL DEFAULT false,
  show_plants_count boolean NOT NULL DEFAULT true,
  show_achievements boolean NOT NULL DEFAULT true,
  show_marketplace boolean NOT NULL DEFAULT true,
  opt_in_feed boolean NOT NULL DEFAULT true,
  region text ,
  bio_emoji text ,
  comp_tier text ,
  comp_expires_at timestamptz ,
  comp_granted_by uuid ,
  comp_granted_at timestamptz ,
  primary key (id)
);
create table public.app_settings (
  key text NOT NULL,
  value text ,
  description text ,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid ,
  primary key (key)
);
create table public.audit_log (
  id bigserial NOT NULL ,
  actor_id uuid ,
  action text NOT NULL,
  target_type text ,
  target_id text ,
  diff jsonb DEFAULT '{}'::jsonb,
  ip_hash text ,
  created_at timestamptz DEFAULT now(),
  primary key (id)
);
create table public.social_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  author_name text ,
  author_avatar text DEFAULT '🌿'::text,
  content text NOT NULL,
  category text DEFAULT 'fund'::text,
  plant_name text ,
  photo_url text ,
  likes integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  is_featured boolean DEFAULT false,
  is_archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  role text ,
  primary key (id)
);
create table public.post_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  author_name text ,
  author_avatar text DEFAULT '🌿'::text,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  role text ,
  primary key (id)
);
create table public.post_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  primary key (id)
);
create table public.marketplace_listings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text ,
  category text ,
  price numeric ,
  currency text DEFAULT 'CHF'::text,
  region text ,
  photo_url text ,
  status text DEFAULT 'active'::text,
  views integer DEFAULT 0,
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  contact text ,
  photo_urls text[] ,
  price_mode text DEFAULT 'fix'::text,
  reports integer DEFAULT 0,
  organic_certified boolean DEFAULT false,
  pesticide_free boolean DEFAULT false,
  certification_label text ,
  allow_online_payment boolean DEFAULT false,
  contact_method text DEFAULT 'chat'::text,
  contact_email text ,
  contact_phone text ,
  sold_at timestamptz ,
  moderation_status text ,
  primary key (id)
);
create table public.marketplace_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  message text NOT NULL,
  read_at timestamptz ,
  created_at timestamptz NOT NULL DEFAULT now(),
  primary key (id)
);
create table public.marketplace_sellers (
  user_id uuid NOT NULL,
  stripe_account_id text ,
  status text NOT NULL DEFAULT 'pending'::text,
  charges_enabled boolean DEFAULT false,
  payouts_enabled boolean DEFAULT false,
  details_submitted boolean DEFAULT false,
  requirements jsonb DEFAULT '{}'::jsonb,
  country text DEFAULT 'CH'::text,
  default_currency text DEFAULT 'chf'::text,
  business_type text ,
  display_name text ,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  primary key (user_id)
);
create table public.user_follows (
  follower_id uuid NOT NULL,
  followed_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  primary key (follower_id, followed_id)
);
create table public.user_blocks (
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reason text ,
  primary key (blocker_id, blocked_id)
);
create table public.friendships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  friend_id uuid NOT NULL,
  status text DEFAULT 'pending'::text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  primary key (id)
);
create table public.map_user_finds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  species_id text ,
  species_name text NOT NULL,
  category text ,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy_m integer ,
  altitude_m integer ,
  found_at timestamptz NOT NULL DEFAULT now(),
  note text ,
  photo_url text ,
  weather_condition text ,
  edible_confirmed boolean ,
  quantity_estimate text ,
  is_private boolean NOT NULL DEFAULT true,
  region_slug text ,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  primary key (id)
);
create table public.user_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid(),
  target_type text NOT NULL,
  target_ref text NOT NULL,
  reason text ,
  status text NOT NULL DEFAULT 'open'::text,
  admin_note text ,
  reviewed_by uuid ,
  reviewed_at timestamptz ,
  created_at timestamptz NOT NULL DEFAULT now(),
  primary key (id)
);
create table public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  org_type text NOT NULL,
  country text DEFAULT 'CH'::text,
  bio text ,
  logo_url text ,
  website text ,
  primary_color text DEFAULT '#2d8a2d'::text,
  created_by uuid NOT NULL,
  subscription_tier text NOT NULL DEFAULT 'free'::text,
  max_members integer NOT NULL DEFAULT 1000,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  primary key (id)
);
create table public.org_members (
  org_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  invited_by uuid ,
  display_name_in_org text ,
  primary key (org_id, user_id)
);
create table public.recipes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text ,
  title text NOT NULL,
  subtitle text ,
  ingredients jsonb DEFAULT '[]'::jsonb,
  steps jsonb DEFAULT '[]'::jsonb,
  prep_time_min integer ,
  difficulty text ,
  servings integer ,
  category text ,
  tags text[] DEFAULT ARRAY[]::text[],
  species_refs text[] DEFAULT ARRAY[]::text[],
  season text ,
  emoji text ,
  description text ,
  warning text ,
  sources jsonb DEFAULT '[]'::jsonb,
  data jsonb DEFAULT '{}'::jsonb,
  is_published boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  photo_urls text[] NOT NULL DEFAULT '{}'::text[],
  primary key (id)
);
create table public.remedies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text ,
  title text NOT NULL,
  ailment text ,
  preparation text ,
  dosage text ,
  contraindications text ,
  ingredients jsonb DEFAULT '[]'::jsonb,
  species_refs text[] DEFAULT ARRAY[]::text[],
  category text ,
  tags text[] DEFAULT ARRAY[]::text[],
  emoji text ,
  description text ,
  warning text ,
  evidence_level text ,
  sources jsonb DEFAULT '[]'::jsonb,
  data jsonb DEFAULT '{}'::jsonb,
  is_published boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  photo_urls text[] NOT NULL DEFAULT '{}'::text[],
  primary key (id)
);
create table public.rate_limits (
  id bigserial NOT NULL ,
  bucket text NOT NULL,
  action text NOT NULL,
  count integer DEFAULT 1,
  window_start timestamptz DEFAULT date_trunc('hour'::text, now()),
  primary key (id)
);
create table public.achievements_catalog (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL,
  description text ,
  icon text ,
  category text ,
  rarity text DEFAULT 'common'::text,
  xp_reward integer DEFAULT 10,
  condition jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  share_template text ,
  primary key (id)
);
create table public.user_achievements (
  user_id uuid NOT NULL,
  achievement_slug text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  primary key (user_id, achievement_slug)
);
alter table public.achievements_catalog add constraint achievements_catalog_category_check CHECK (((category IS NULL) OR (category = ANY (ARRAY['explorer'::text, 'collector'::text, 'gardener'::text, 'healer'::text, 'sage'::text, 'community'::text, 'milestone'::text]))));
alter table public.achievements_catalog add constraint achievements_catalog_rarity_check CHECK (((rarity IS NULL) OR (rarity = ANY (ARRAY['common'::text, 'uncommon'::text, 'rare'::text, 'epic'::text, 'legendary'::text]))));
alter table public.achievements_catalog add constraint achievements_catalog_slug_key UNIQUE (slug);
alter table public.friendships add constraint friendships_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'blocked'::text])));
alter table public.friendships add constraint friendships_user_id_friend_id_key UNIQUE (user_id, friend_id);
alter table public.friendships add constraint no_self_friend CHECK ((user_id <> friend_id));
alter table public.marketplace_listings add constraint marketplace_listings_price_mode_check CHECK ((price_mode = ANY (ARRAY['fix'::text, 'vb'::text, 'tausch'::text, 'gratis'::text])));
alter table public.marketplace_listings add constraint marketplace_listings_status_check CHECK ((status = ANY (ARRAY['active'::text, 'sold'::text, 'reserved'::text, 'archived'::text, 'reported'::text])));
alter table public.marketplace_listings add constraint marketplace_moderation_status_chk CHECK (((moderation_status IS NULL) OR (moderation_status = 'hidden'::text)));
alter table public.marketplace_sellers add constraint marketplace_sellers_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'restricted'::text, 'disabled'::text])));
alter table public.marketplace_sellers add constraint marketplace_sellers_stripe_account_id_key UNIQUE (stripe_account_id);
alter table public.org_members add constraint org_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'teacher'::text, 'student'::text, 'viewer'::text])));
alter table public.organizations add constraint organizations_bio_check CHECK ((length(COALESCE(bio, ''::text)) <= 500));
alter table public.organizations add constraint organizations_country_check CHECK ((length(country) = 2));
alter table public.organizations add constraint organizations_name_check CHECK (((length(name) >= 2) AND (length(name) <= 80)));
alter table public.organizations add constraint organizations_org_type_check CHECK ((org_type = ANY (ARRAY['school'::text, 'university'::text, 'course'::text, 'botanical_garden'::text, 'community_garden'::text, 'company'::text, 'other'::text])));
alter table public.organizations add constraint organizations_primary_color_check CHECK ((primary_color ~ '^#[0-9a-fA-F]{6}$'::text));
alter table public.organizations add constraint organizations_slug_check CHECK ((slug ~ '^[a-z0-9-]{3,40}$'::text));
alter table public.organizations add constraint organizations_slug_key UNIQUE (slug);
alter table public.organizations add constraint organizations_subscription_tier_check CHECK ((subscription_tier = ANY (ARRAY['free'::text])));
alter table public.post_likes add constraint post_likes_post_id_user_id_key UNIQUE (post_id, user_id);
alter table public.profiles add constraint profiles_bio_len CHECK ((length(COALESCE(bio, ''::text)) <= 200));
alter table public.profiles add constraint profiles_comp_tier_chk CHECK (((comp_tier IS NULL) OR (comp_tier = ANY (ARRAY['pro'::text, 'lifetime'::text]))));
alter table public.profiles add constraint profiles_level_check CHECK ((level >= 1));
alter table public.profiles add constraint profiles_profile_visibility_check CHECK ((profile_visibility = ANY (ARRAY['public'::text, 'followers_only'::text, 'private'::text])));
alter table public.profiles add constraint profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'staff'::text, 'expert'::text, 'user'::text, 'banned'::text])));
alter table public.profiles add constraint profiles_tier_check CHECK ((tier = ANY (ARRAY['free'::text, 'pro'::text, 'lifetime'::text])));
alter table public.profiles add constraint profiles_xp_check CHECK ((xp >= 0));
alter table public.rate_limits add constraint rate_limits_bucket_action_window_start_key UNIQUE (bucket, action, window_start);
alter table public.recipes add constraint recipes_difficulty_check CHECK (((difficulty IS NULL) OR (difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text]))));
alter table public.recipes add constraint recipes_slug_key UNIQUE (slug);
alter table public.remedies add constraint remedies_evidence_level_check CHECK (((evidence_level IS NULL) OR (evidence_level = ANY (ARRAY['traditional'::text, 'folk'::text, 'clinical'::text, 'strong_clinical'::text]))));
alter table public.remedies add constraint remedies_slug_key UNIQUE (slug);
alter table public.social_posts add constraint social_posts_category_check CHECK ((category = ANY (ARRAY['fund'::text, 'help'::text, 'tip'::text, 'showcase'::text, 'rare'::text, 'question'::text])));
alter table public.user_blocks add constraint user_blocks_check CHECK ((blocker_id <> blocked_id));
alter table public.user_follows add constraint user_follows_check CHECK ((follower_id <> followed_id));
alter table public.user_reports add constraint user_reports_reporter_id_target_type_target_ref_key UNIQUE (reporter_id, target_type, target_ref);
alter table public.user_reports add constraint user_reports_status_check CHECK ((status = ANY (ARRAY['open'::text, 'reviewed'::text, 'dismissed'::text, 'actioned'::text])));
alter table public.user_reports add constraint user_reports_target_type_check CHECK ((target_type = ANY (ARRAY['user'::text, 'listing'::text, 'post'::text, 'comment'::text])));
create unique index if not exists achievements_catalog_slug on public.achievements_catalog(slug);
-- _touch_updated_at() | secdef=False | config=['search_path=public, pg_catalog'] | acl={=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public._touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END $function$;
-- fn_admin_moderate(p_type text, p_id uuid, p_action text) | secdef=True | config=['search_path=public'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_admin_moderate(p_type text, p_id uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin_user() THEN RETURN jsonb_build_object('error','forbidden'); END IF;
  IF p_type   NOT IN ('post','listing','comment') THEN RETURN jsonb_build_object('error','invalid_type'); END IF;
  IF p_action NOT IN ('hide','unhide','delete')   THEN RETURN jsonb_build_object('error','invalid_action'); END IF;

  IF p_type = 'post' THEN
    IF p_action = 'delete' THEN
      DELETE FROM post_comments WHERE post_id = p_id;
      DELETE FROM social_posts  WHERE id = p_id;
    ELSE
      UPDATE social_posts SET is_archived = (p_action = 'hide') WHERE id = p_id;
    END IF;

  ELSIF p_type = 'listing' THEN
    IF p_action = 'delete' THEN
      DELETE FROM marketplace_listings WHERE id = p_id;
    ELSE
      -- nur Moderations-Flag, User-Lifecycle-status unberührt (kein Republish von User-Archiv)
      UPDATE marketplace_listings SET moderation_status = CASE WHEN p_action = 'hide' THEN 'hidden' ELSE NULL END WHERE id = p_id;
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
-- fn_block_toggle(p_target uuid) | secdef=True | config=['search_path=public, pg_temp'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_block_toggle(p_target uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_uid uuid := (SELECT auth.uid()); v_existed boolean;
BEGIN
  IF v_uid IS NULL OR v_uid = p_target THEN RETURN jsonb_build_object('error','invalid'); END IF;
  DELETE FROM public.user_blocks WHERE blocker_id = v_uid AND blocked_id = p_target RETURNING true INTO v_existed;
  IF v_existed THEN RETURN jsonb_build_object('action','unblocked'); END IF;
  DELETE FROM public.user_follows WHERE
    (follower_id = v_uid AND followed_id = p_target) OR (follower_id = p_target AND followed_id = v_uid);
  INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES (v_uid, p_target) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('action','blocked');
END $function$;
-- fn_check_not_banned() | secdef=True | config=['search_path=public, pg_catalog'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_check_not_banned()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF public.fn_user_role(NEW.user_id) = 'banned' THEN
    RAISE EXCEPTION 'User is banned and cannot post' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $function$;
-- fn_check_rate_limit(p_bucket text, p_action text, p_max_per_hour integer) | secdef=True | config=['search_path=public, pg_temp'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_check_rate_limit(p_bucket text, p_action text, p_max_per_hour integer DEFAULT 30)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_count integer; v_window timestamptz := date_trunc('hour', now());
BEGIN
  INSERT INTO public.rate_limits (bucket, action, window_start, count)
    VALUES (p_bucket, p_action, v_window, 1)
    ON CONFLICT (bucket, action, window_start)
    DO UPDATE SET count = public.rate_limits.count + 1
    RETURNING count INTO v_count;
  DELETE FROM public.rate_limits WHERE window_start < now() - interval '2 hours';
  RETURN v_count <= p_max_per_hour;
END;
$function$;
-- fn_follow_toggle(p_target uuid) | secdef=True | config=['search_path=public, pg_temp'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_follow_toggle(p_target uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_uid uuid := (SELECT auth.uid()); v_existed boolean;
BEGIN
  IF v_uid IS NULL OR v_uid = p_target THEN RETURN jsonb_build_object('error','invalid'); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id = p_target) THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF EXISTS(SELECT 1 FROM public.user_blocks WHERE blocker_id = p_target AND blocked_id = v_uid) THEN
    RETURN jsonb_build_object('error','blocked_by_target');
  END IF;
  DELETE FROM public.user_follows WHERE follower_id = v_uid AND followed_id = p_target RETURNING true INTO v_existed;
  IF v_existed THEN RETURN jsonb_build_object('action','unfollowed'); END IF;
  INSERT INTO public.user_follows (follower_id, followed_id) VALUES (v_uid, p_target) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('action','followed');
END $function$;
-- fn_following_feed(p_limit integer) | secdef=True | config=['search_path=public, pg_temp'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_following_feed(p_limit integer DEFAULT 30)
 RETURNS TABLE(kind text, user_id uuid, display_name text, avatar_url text, avatar_emoji text, ref_id text, title text, icon text, ts timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH followed AS (
    SELECT followed_id FROM public.user_follows WHERE follower_id = (SELECT auth.uid())
  )
  SELECT 'achievement' AS kind, ua.user_id, p.display_name, p.avatar_url, p.avatar_emoji,
    ua.achievement_slug::text AS ref_id, c.title, c.icon, ua.unlocked_at AS ts
  FROM public.user_achievements ua
  JOIN followed f ON f.followed_id = ua.user_id
  JOIN public.profiles p ON p.id = ua.user_id
  JOIN public.achievements_catalog c ON c.slug = ua.achievement_slug
  WHERE ua.unlocked_at > now() - interval '7 days'
    AND coalesce(c.rarity,'common') <> 'common'
    AND coalesce(p.opt_in_feed, true) = true
  UNION ALL
  SELECT 'find' AS kind, mf.user_id, p.display_name, p.avatar_url, p.avatar_emoji,
    mf.id::text AS ref_id, mf.species_name, '📍', mf.found_at
  FROM public.map_user_finds mf
  JOIN followed f ON f.followed_id = mf.user_id
  JOIN public.profiles p ON p.id = mf.user_id
  WHERE mf.is_private = false AND mf.found_at > now() - interval '7 days'
    AND coalesce(p.show_finds_public, false) = true AND coalesce(p.opt_in_feed, true) = true
  UNION ALL
  SELECT 'listing' AS kind, ml.user_id, p.display_name, p.avatar_url, p.avatar_emoji,
    ml.id::text AS ref_id, ml.title, '🤝', ml.created_at
  FROM public.marketplace_listings ml
  JOIN followed f ON f.followed_id = ml.user_id
  JOIN public.profiles p ON p.id = ml.user_id
  WHERE ml.status = 'active' AND ml.created_at > now() - interval '7 days'
    AND coalesce(p.show_marketplace, true) = true AND coalesce(p.opt_in_feed, true) = true
  ORDER BY ts DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$function$;
-- fn_force_author_role() | secdef=True | config=['search_path=public'] | acl={postgres=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_force_author_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.role := (SELECT role FROM profiles WHERE id = NEW.user_id);
  RETURN NEW;
END;
$function$;
-- fn_is_org_member(p_org uuid) | secdef=True | config=['search_path=public, pg_temp'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_is_org_member(p_org uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS(SELECT 1 FROM public.org_members WHERE org_id = p_org AND user_id = (SELECT auth.uid()));
$function$;
-- fn_is_role(_role text, _uid uuid) | secdef=True | config=['search_path=public, pg_catalog'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres,anon=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_is_role(_role text, _uid uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT CASE
    -- Fremde UUID abgefragt und der Aufrufer ist nicht Staff/Admin -> keine Auskunft.
    WHEN _uid IS NOT NULL
     AND _uid IS DISTINCT FROM (SELECT auth.uid())
     AND NOT EXISTS (
           SELECT 1 FROM public.profiles me
           WHERE me.id = (SELECT auth.uid()) AND me.role IN ('admin','staff')
         )
    THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = COALESCE(_uid, (SELECT auth.uid())) AND role = _role
    )
  END;
$function$;
-- fn_marketplace_set_status(p_listing_id uuid, p_status text) | secdef=True | config=['search_path=public, pg_temp'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_marketplace_set_status(p_listing_id uuid, p_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_owner uuid; v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  IF p_status NOT IN ('active','reserved','sold','archived') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;
  SELECT user_id INTO v_owner FROM public.marketplace_listings WHERE id = p_listing_id;
  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_owner <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  UPDATE public.marketplace_listings
     SET status = p_status,
         sold_at = CASE WHEN p_status = 'sold' THEN COALESCE(sold_at, now())
                        WHEN p_status = 'active' THEN NULL
                        ELSE sold_at END,
         updated_at = now()
   WHERE id = p_listing_id;
  RETURN jsonb_build_object('ok', true, 'id', p_listing_id, 'status', p_status);
END;
$function$;
-- fn_mkt_chat_mark_read(p_listing_id uuid, p_buyer_id uuid) | secdef=False | config=['search_path=public, pg_temp'] | acl={postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_mkt_chat_mark_read(p_listing_id uuid, p_buyer_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE _uid uuid := (SELECT auth.uid()); _n int;
BEGIN
  IF _uid IS NULL THEN RETURN 0; END IF;
  UPDATE public.marketplace_messages
  SET read_at = now()
  WHERE listing_id = p_listing_id
    AND buyer_id = p_buyer_id
    AND sender_id <> _uid
    AND read_at IS NULL
    AND (buyer_id = _uid OR seller_id = _uid);
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $function$;
-- fn_mkt_increment_views(p_listing_id uuid) | secdef=True | config=['search_path=public'] | acl={=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_mkt_increment_views(p_listing_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    return;   -- ohne Login kein Zaehlen
  end if;
  update marketplace_listings
     set views = coalesce(views, 0) + 1
   where id = p_listing_id;
end
$function$;
-- fn_mkt_seller_status_guard() | secdef=False | config=['search_path=public'] | acl={=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_mkt_seller_status_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('authenticated','anon') AND NOT coalesce(is_admin_user(), false) THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'seller_status_change_denied' USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
-- fn_org_role(p_org uuid) | secdef=True | config=['search_path=public, pg_temp'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_org_role(p_org uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT role FROM public.org_members WHERE org_id = p_org AND user_id = (SELECT auth.uid()) LIMIT 1;
$function$;
-- fn_org_update(p_org_id uuid, p_name text, p_bio text, p_logo_url text, p_website text, p_primary_color text) | secdef=True | config=['search_path=public, pg_temp'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_org_update(p_org_id uuid, p_name text, p_bio text, p_logo_url text, p_website text, p_primary_color text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_role text;
BEGIN
  v_role := public.fn_org_role(p_org_id);
  IF v_role IS NULL OR v_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Nur Owner/Admin dürfen die Organisation bearbeiten.'; END IF;
  IF p_primary_color IS NOT NULL AND p_primary_color <> '' AND p_primary_color !~ '^#[0-9A-Fa-f]{6}$' THEN
    RAISE EXCEPTION 'Farbe muss #RRGGBB sein.'; END IF;
  IF p_logo_url IS NOT NULL AND p_logo_url <> '' AND p_logo_url !~* '^https?://' THEN
    RAISE EXCEPTION 'Logo-URL muss mit http(s):// beginnen.'; END IF;
  IF p_website IS NOT NULL AND p_website <> '' AND p_website !~* '^https?://' THEN
    RAISE EXCEPTION 'Website muss mit http(s):// beginnen.'; END IF;
  UPDATE public.organizations SET
    name          = COALESCE(NULLIF(trim(p_name),''), name),
    bio           = NULLIF(trim(coalesce(p_bio,'')),''),
    logo_url      = NULLIF(trim(coalesce(p_logo_url,'')),''),
    website       = NULLIF(trim(coalesce(p_website,'')),''),
    primary_color = NULLIF(trim(coalesce(p_primary_color,'')),''),
    updated_at    = now()
  WHERE id = p_org_id;
  RETURN jsonb_build_object('ok', true);
END $function$;
-- fn_profiles_guard_protected() | secdef=False | config=['search_path=public'] | acl={=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_profiles_guard_protected()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('authenticated','anon') AND NOT coalesce(is_admin_user(), false) THEN
    IF NEW.tier             IS DISTINCT FROM OLD.tier
       OR NEW.is_admin      IS DISTINCT FROM OLD.is_admin
       OR NEW.role          IS DISTINCT FROM OLD.role
       OR NEW.is_expert     IS DISTINCT FROM OLD.is_expert
       OR NEW.is_lifetime   IS DISTINCT FROM OLD.is_lifetime
       OR NEW.comp_tier        IS DISTINCT FROM OLD.comp_tier
       OR NEW.comp_expires_at  IS DISTINCT FROM OLD.comp_expires_at
       OR NEW.comp_granted_by  IS DISTINCT FROM OLD.comp_granted_by
       OR NEW.role_assigned_by IS DISTINCT FROM OLD.role_assigned_by
       OR NEW.role_assigned_at IS DISTINCT FROM OLD.role_assigned_at
       OR NEW.quiz_elo      IS DISTINCT FROM OLD.quiz_elo
       OR NEW.battles_won   IS DISTINCT FROM OLD.battles_won
       OR NEW.battles_lost  IS DISTINCT FROM OLD.battles_lost
       OR NEW.battles_tied  IS DISTINCT FROM OLD.battles_tied
       OR NEW.level         IS DISTINCT FROM OLD.level
       OR NEW.xp            IS DISTINCT FROM OLD.xp
    THEN RAISE EXCEPTION 'protected_column_change_denied' USING ERRCODE='insufficient_privilege'; END IF;
  END IF;
  RETURN NEW;
END;
$function$;
-- fn_report(p_target_type text, p_target_ref text, p_reason text) | secdef=True | config=['search_path=public, pg_temp'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_report(p_target_type text, p_target_ref text, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_uid uuid := (select auth.uid()); v_id uuid;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  if p_target_type is null or p_target_type not in ('user','listing','post','comment') then raise exception 'invalid target_type'; end if;
  if p_target_ref is null or length(btrim(p_target_ref))=0 then raise exception 'target_ref required'; end if;
  if p_target_type='user' and p_target_ref = v_uid::text then raise exception 'cannot report self'; end if;
  if not public.fn_check_rate_limit(v_uid::text, 'user_report', 20) then raise exception 'rate_limited'; end if;
  insert into public.user_reports (reporter_id, target_type, target_ref, reason)
  values (v_uid, p_target_type, p_target_ref, nullif(btrim(coalesce(p_reason,'')),''))
  on conflict (reporter_id, target_type, target_ref) do nothing
  returning id into v_id;
  return jsonb_build_object('ok', true, 'duplicate', v_id is null);
end; $function$;
-- fn_role_at_least(_required text, _uid uuid) | secdef=True | config=['search_path=public, pg_catalog'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres,anon=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_role_at_least(_required text, _uid uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT CASE
    WHEN _uid IS NOT NULL
     AND _uid IS DISTINCT FROM (SELECT auth.uid())
     AND NOT EXISTS (
           SELECT 1 FROM public.profiles me
           WHERE me.id = (SELECT auth.uid()) AND me.role IN ('admin','staff')
         )
    THEN false
    WHEN _required = 'admin'  THEN public.fn_user_role(_uid) = 'admin'
    WHEN _required = 'staff'  THEN public.fn_user_role(_uid) IN ('admin','staff')
    WHEN _required = 'expert' THEN public.fn_user_role(_uid) IN ('admin','staff','expert')
    WHEN _required = 'user'   THEN public.fn_user_role(_uid) IN ('admin','staff','expert','user')
    ELSE false
  END;
$function$;
-- fn_snapshot_author_role() | secdef=True | config=['search_path=public, pg_catalog'] | acl={postgres=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_snapshot_author_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF NEW.role IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT role INTO NEW.role FROM public.profiles WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END; $function$;
-- fn_touch_updated_at() | secdef=False | config=['search_path=public, pg_temp'] | acl={=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$function$;
-- fn_update_comment_count() | secdef=False | config=['search_path=public, pg_temp'] | acl={=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_update_comment_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.social_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.social_posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;
-- fn_user_role(_uid uuid) | secdef=True | config=['search_path=public, pg_catalog'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_user_role(_uid uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT role FROM public.profiles WHERE id = COALESCE(_uid, auth.uid()) LIMIT 1;
$function$;
-- gs_abo_can_use(p_user_id uuid, feature text) | secdef=True | config=['search_path=public, pg_catalog'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.gs_abo_can_use(p_user_id uuid, feature text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  prof RECORD;
  now_ts TIMESTAMPTZ := now();
BEGIN
  SELECT abo_status, abo_trial_end, abo_period_end
  INTO prof FROM profiles WHERE id = p_user_id;

  IF NOT FOUND THEN RETURN true; END IF; -- Noch kein Profil = Trial noch nicht gestartet

  -- Trial läuft
  IF prof.abo_status = 'trial' AND prof.abo_trial_end > now_ts THEN
    RETURN true;
  END IF;

  -- Abo aktiv
  IF prof.abo_status = 'active' AND (prof.abo_period_end IS NULL OR prof.abo_period_end > now_ts) THEN
    RETURN true;
  END IF;

  -- Free Features: immer erlaubt
  IF feature IN ('browse', 'map', 'recipes', 'weather') THEN
    RETURN true;
  END IF;

  -- Pro Features gesperrt
  RETURN false;
END;
$function$;
-- is_admin_user() | secdef=True | config=['search_path=public, pg_temp'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.is_admin_user()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(
    exists (select 1 from profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    or
    ((select auth.jwt() ->> 'email') = any (
      string_to_array(coalesce((select value from app_settings where key='admin_emails'), ''), ',')
    ))
  , false);
$function$;
-- toggle_post_like(p_post_id uuid, p_user_id uuid) | secdef=True | config=['search_path=public, pg_temp'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.toggle_post_like(p_post_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_existing uuid; v_liked boolean; v_count integer;
BEGIN
  -- Security: caller must only act as themselves
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'unauthorized: p_user_id must match authenticated user';
  END IF;
  SELECT id INTO v_existing FROM public.post_likes WHERE post_id = p_post_id AND user_id = p_user_id;
  IF v_existing IS NOT NULL THEN
    DELETE FROM public.post_likes WHERE id = v_existing; v_liked := false;
  ELSE
    INSERT INTO public.post_likes (post_id, user_id) VALUES (p_post_id, p_user_id); v_liked := true;
  END IF;
  UPDATE public.social_posts SET likes = GREATEST(0, (SELECT COUNT(*) FROM public.post_likes WHERE post_id = p_post_id))
    WHERE id = p_post_id RETURNING likes INTO v_count;
  RETURN jsonb_build_object('liked', v_liked, 'likes', v_count);
END;
$function$;
-- touch_updated_at() | secdef=False | config=['search_path=public, pg_temp'] | acl={=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
-- trg_set_updated_at() | secdef=False | config=['search_path=public, pg_temp'] | acl={=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.trg_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
CREATE TRIGGER trg_app_settings_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
CREATE TRIGGER trg_friendships_upd BEFORE UPDATE ON public.friendships FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
CREATE TRIGGER trg_map_user_finds_updated BEFORE UPDATE ON public.map_user_finds FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER trg_marketplace_updated_at BEFORE UPDATE ON public.marketplace_listings FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
CREATE TRIGGER trg_marketplace_sellers_touch BEFORE UPDATE ON public.marketplace_sellers FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_mkt_seller_status_guard BEFORE UPDATE ON public.marketplace_sellers FOR EACH ROW EXECUTE FUNCTION fn_mkt_seller_status_guard();
CREATE TRIGGER trg_comments_counter AFTER INSERT OR DELETE ON public.post_comments FOR EACH ROW EXECUTE FUNCTION fn_update_comment_count();
CREATE TRIGGER trg_force_author_role_c BEFORE INSERT OR UPDATE ON public.post_comments FOR EACH ROW EXECUTE FUNCTION fn_force_author_role();
CREATE TRIGGER trg_post_comments_ban_check BEFORE INSERT ON public.post_comments FOR EACH ROW EXECUTE FUNCTION fn_check_not_banned();
CREATE TRIGGER trg_post_comments_role_snapshot BEFORE INSERT ON public.post_comments FOR EACH ROW EXECUTE FUNCTION fn_snapshot_author_role();
CREATE TRIGGER trg_profiles_guard_protected BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION fn_profiles_guard_protected();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
CREATE TRIGGER recipes_touch_ts BEFORE UPDATE ON public.recipes FOR EACH ROW EXECUTE FUNCTION _touch_updated_at();
CREATE TRIGGER remedies_touch_ts BEFORE UPDATE ON public.remedies FOR EACH ROW EXECUTE FUNCTION _touch_updated_at();
CREATE TRIGGER trg_force_author_role BEFORE INSERT OR UPDATE ON public.social_posts FOR EACH ROW EXECUTE FUNCTION fn_force_author_role();
CREATE TRIGGER trg_social_posts_ban_check BEFORE INSERT ON public.social_posts FOR EACH ROW EXECUTE FUNCTION fn_check_not_banned();
CREATE TRIGGER trg_social_posts_role_snapshot BEFORE INSERT ON public.social_posts FOR EACH ROW EXECUTE FUNCTION fn_snapshot_author_role();
alter table public.achievements_catalog enable row level security;
create policy "achievements_catalog_public" on public.achievements_catalog as permissive for SELECT to anon,authenticated using ((is_active = true));
alter table public.app_settings enable row level security;
create policy "app_settings_admin_del" on public.app_settings as permissive for DELETE to public using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.is_admin = true)))));
create policy "app_settings_admin_ins" on public.app_settings as permissive for INSERT to public with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.is_admin = true)))));
create policy "app_settings_admin_upd" on public.app_settings as permissive for UPDATE to public using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.is_admin = true))))) with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.is_admin = true)))));
create policy "app_settings_select" on public.app_settings as permissive for SELECT to authenticated using (((key = ANY (ARRAY['vapid_public_key'::text, 'stripe_publishable_key'::text, 'global_api_enabled'::text, 'global_api_provider'::text])) OR (key ~~ 'flag\_%'::text) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.is_admin = true))))));
alter table public.audit_log enable row level security;
create policy "audit_log_admin_only" on public.audit_log as permissive for SELECT to public using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.is_admin = true)))));
alter table public.friendships enable row level security;
create policy "friendships_delete" on public.friendships as permissive for DELETE to public using (((( SELECT auth.uid() AS uid) = user_id) OR (( SELECT auth.uid() AS uid) = friend_id)));
create policy "friendships_insert" on public.friendships as permissive for INSERT to public with check ((( SELECT auth.uid() AS uid) = user_id));
create policy "friendships_select" on public.friendships as permissive for SELECT to public using (((( SELECT auth.uid() AS uid) = user_id) OR (( SELECT auth.uid() AS uid) = friend_id)));
create policy "friendships_update" on public.friendships as permissive for UPDATE to public using (((( SELECT auth.uid() AS uid) = friend_id) OR (( SELECT auth.uid() AS uid) = user_id)));
alter table public.map_user_finds enable row level security;
create policy "map_user_finds_select" on public.map_user_finds as permissive for SELECT to public using (((is_private = false) OR (user_id = ( SELECT auth.uid() AS uid))));
create policy "users delete own finds" on public.map_user_finds as permissive for DELETE to public using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "users insert own finds" on public.map_user_finds as permissive for INSERT to public with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "users update own finds" on public.map_user_finds as permissive for UPDATE to public using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
alter table public.marketplace_listings enable row level security;
create policy "marketplace_delete_own" on public.marketplace_listings as permissive for DELETE to public using ((( SELECT auth.uid() AS uid) = user_id));
create policy "marketplace_insert_own" on public.marketplace_listings as permissive for INSERT to public with check ((( SELECT auth.uid() AS uid) = user_id));
create policy "marketplace_select_active" on public.marketplace_listings as permissive for SELECT to public using ((((status = ANY (ARRAY['active'::text, 'reserved'::text])) AND (COALESCE(moderation_status, ''::text) <> 'hidden'::text)) OR (( SELECT auth.uid() AS uid) = user_id)));
create policy "marketplace_update_own" on public.marketplace_listings as permissive for UPDATE to public using ((( SELECT auth.uid() AS uid) = user_id));
alter table public.marketplace_messages enable row level security;
create policy "marketplace_messages_select" on public.marketplace_messages as permissive for SELECT to public using (((buyer_id = ( SELECT auth.uid() AS uid)) OR (seller_id = ( SELECT auth.uid() AS uid))));
create policy "marketplace_messages_update" on public.marketplace_messages as permissive for UPDATE to public using (((buyer_id = ( SELECT auth.uid() AS uid)) OR (seller_id = ( SELECT auth.uid() AS uid)))) with check (((buyer_id = ( SELECT auth.uid() AS uid)) OR (seller_id = ( SELECT auth.uid() AS uid))));
create policy "users delete own messages" on public.marketplace_messages as permissive for DELETE to public using ((sender_id = ( SELECT auth.uid() AS uid)));
create policy "users send own messages" on public.marketplace_messages as permissive for INSERT to public with check (((sender_id = ( SELECT auth.uid() AS uid)) AND ((buyer_id = ( SELECT auth.uid() AS uid)) OR (seller_id = ( SELECT auth.uid() AS uid)))));
alter table public.marketplace_sellers enable row level security;
create policy "marketplace_seller_owner_all" on public.marketplace_sellers as permissive for ALL to public using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
alter table public.org_members enable row level security;
create policy "om_read_same_org" on public.org_members as permissive for SELECT to authenticated using (fn_is_org_member(org_id));
alter table public.organizations enable row level security;
create policy "orgs_delete_owner" on public.organizations as permissive for DELETE to authenticated using ((fn_org_role(id) = 'owner'::text));
create policy "orgs_insert_authed" on public.organizations as permissive for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = created_by));
create policy "orgs_read_members" on public.organizations as permissive for SELECT to authenticated using (fn_is_org_member(id));
create policy "orgs_update_owner_admin" on public.organizations as permissive for UPDATE to authenticated using ((fn_org_role(id) = ANY (ARRAY['owner'::text, 'admin'::text])));
alter table public.post_comments enable row level security;
create policy "post_comments_delete_own" on public.post_comments as permissive for DELETE to public using (((( SELECT auth.uid() AS uid) = user_id) OR fn_role_at_least('staff'::text)));
create policy "post_comments_insert_auth" on public.post_comments as permissive for INSERT to public with check (((( SELECT auth.uid() AS uid) = user_id) OR fn_role_at_least('staff'::text)));
create policy "post_comments_select_all" on public.post_comments as permissive for SELECT to public using (true);
create policy "post_comments_update_mod" on public.post_comments as permissive for UPDATE to public using (fn_role_at_least('staff'::text)) with check (fn_role_at_least('staff'::text));
alter table public.post_likes enable row level security;
create policy "post_likes_delete_own" on public.post_likes as permissive for DELETE to public using ((( SELECT auth.uid() AS uid) = user_id));
create policy "post_likes_insert_own" on public.post_likes as permissive for INSERT to public with check ((( SELECT auth.uid() AS uid) = user_id));
create policy "post_likes_select_all" on public.post_likes as permissive for SELECT to public using (true);
alter table public.profiles enable row level security;
create policy "profiles_insert_self" on public.profiles as permissive for INSERT to public with check ((( SELECT auth.uid() AS uid) = id));
create policy "profiles_select_own" on public.profiles as permissive for SELECT to public using (((id = ( SELECT auth.uid() AS uid)) OR fn_is_role('admin'::text)));
create policy "profiles_update" on public.profiles as permissive for UPDATE to public using ((fn_is_role('admin'::text) OR (( SELECT auth.uid() AS uid) = id)));
alter table public.rate_limits enable row level security;
create policy "rate_limits_admin_only" on public.rate_limits as permissive for SELECT to public using (false);
alter table public.recipes enable row level security;
create policy "recipes_admin_del" on public.recipes as permissive for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND ((profiles.is_admin = true) OR (profiles.is_expert = true) OR (profiles.role = 'admin'::text))))));
create policy "recipes_admin_ins" on public.recipes as permissive for INSERT to authenticated with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND ((profiles.is_admin = true) OR (profiles.is_expert = true) OR (profiles.role = 'admin'::text))))));
create policy "recipes_admin_upd" on public.recipes as permissive for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND ((profiles.is_admin = true) OR (profiles.is_expert = true) OR (profiles.role = 'admin'::text)))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND ((profiles.is_admin = true) OR (profiles.is_expert = true) OR (profiles.role = 'admin'::text))))));
create policy "recipes_public_read" on public.recipes as permissive for SELECT to anon,authenticated using ((is_published = true));
alter table public.remedies enable row level security;
create policy "remedies_admin_del" on public.remedies as permissive for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND ((profiles.is_admin = true) OR (profiles.is_expert = true) OR (profiles.role = 'admin'::text))))));
create policy "remedies_admin_ins" on public.remedies as permissive for INSERT to authenticated with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND ((profiles.is_admin = true) OR (profiles.is_expert = true) OR (profiles.role = 'admin'::text))))));
create policy "remedies_admin_upd" on public.remedies as permissive for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND ((profiles.is_admin = true) OR (profiles.is_expert = true) OR (profiles.role = 'admin'::text)))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND ((profiles.is_admin = true) OR (profiles.is_expert = true) OR (profiles.role = 'admin'::text))))));
create policy "remedies_public_read" on public.remedies as permissive for SELECT to anon,authenticated using ((is_published = true));
alter table public.social_posts enable row level security;
create policy "social_posts_delete_own" on public.social_posts as permissive for DELETE to public using (((( SELECT auth.uid() AS uid) = user_id) OR fn_role_at_least('staff'::text)));
create policy "social_posts_insert_auth" on public.social_posts as permissive for INSERT to public with check (((( SELECT auth.uid() AS uid) = user_id) OR fn_role_at_least('staff'::text)));
create policy "social_posts_select_all" on public.social_posts as permissive for SELECT to public using (((is_archived = false) OR (( SELECT auth.uid() AS uid) = user_id) OR fn_role_at_least('staff'::text)));
create policy "social_posts_update_own" on public.social_posts as permissive for UPDATE to public using (((( SELECT auth.uid() AS uid) = user_id) OR fn_role_at_least('staff'::text))) with check (((( SELECT auth.uid() AS uid) = user_id) OR fn_role_at_least('staff'::text)));
alter table public.user_achievements enable row level security;
create policy "user_achievements_own_insert" on public.user_achievements as permissive for INSERT to authenticated with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "user_achievements_own_select" on public.user_achievements as permissive for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
alter table public.user_blocks enable row level security;
create policy "blocks_own" on public.user_blocks as permissive for ALL to authenticated using ((( SELECT auth.uid() AS uid) = blocker_id)) with check ((( SELECT auth.uid() AS uid) = blocker_id));
alter table public.user_follows enable row level security;
create policy "follows_own_delete" on public.user_follows as permissive for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = follower_id));
create policy "follows_own_insert" on public.user_follows as permissive for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = follower_id));
create policy "follows_read_all" on public.user_follows as permissive for SELECT to public using (true);
alter table public.user_reports enable row level security;
create policy "user_reports_insert_own" on public.user_reports as permissive for INSERT to authenticated with check ((reporter_id = ( SELECT auth.uid() AS uid)));
create policy "user_reports_select_admin" on public.user_reports as permissive for SELECT to authenticated using (is_admin_user());
create policy "user_reports_update_admin" on public.user_reports as permissive for UPDATE to authenticated using (is_admin_user()) with check (is_admin_user());
