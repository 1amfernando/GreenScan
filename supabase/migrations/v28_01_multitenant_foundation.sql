-- ============================================================================
-- v28_01_multitenant_foundation — organizations + members + invites + audit + RLS
-- Spiegel der LIVE angewandten Migration (project vowbiueikwrauuceilhc).
-- Sicherheits-Korrekturen ggü. Spec (Privacy doppelt wichtig, Multi-Tenant):
--  * RLS-Rekursion vermieden: org_members-SELECT nutzt SECURITY-DEFINER-Helper
--    fn_is_org_member (sonst 42P17 infinite recursion in policy).
--  * KEIN `OR is_active=true` in orgs-SELECT (members-only) → kein Voll-Row-Leak.
--  * stripe_subscription_id NICHT auf organizations (→ org_subscriptions v28.03,
--    service-role-only). fn_org_detail gibt curated Objekt (kein row_to_json-Leak).
--  * Public-Discovery via curated DEFINER-Fn fn_org_directory (kein Leaky-View).
--  * KEIN self-leave-DELETE-Policy (umginge Last-Owner-Schutz) → nur via fn_org_leave.
-- Hard-Lesson #13: Action-RPCs REVOKE PUBLIC,anon + GRANT authenticated.
--   RLS-Helper: GRANT anon+authenticated (Policy-Evaluation braucht EXECUTE; safe).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.organizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]{3,40}$'),
  name            text NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  org_type        text NOT NULL CHECK (org_type IN ('school','university','course','botanical_garden','community_garden','company','other')),
  country         text DEFAULT 'CH' CHECK (length(country)=2),
  bio             text CHECK (length(coalesce(bio,'')) <= 500),
  logo_url        text,
  website         text,
  primary_color   text DEFAULT '#2d8a2d' CHECK (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  created_by      uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  subscription_tier text NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free','school_basic','school_pro','botanical_garden')),
  max_members     int NOT NULL DEFAULT 1000,  -- v28.01-Follow-up: großzügig, KEIN Sales-Gate (Mission „nicht geldgierig")
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orgs_active ON public.organizations (is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orgs_created_by ON public.organizations (created_by);

CREATE TABLE IF NOT EXISTS public.org_members (
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('owner','admin','teacher','student','viewer')),
  joined_at       timestamptz NOT NULL DEFAULT now(),
  invited_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name_in_org text,
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_om_user ON public.org_members (user_id, role);
CREATE INDEX IF NOT EXISTS idx_om_org_role ON public.org_members (org_id, role);

CREATE TABLE IF NOT EXISTS public.org_invites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invite_code     text NOT NULL UNIQUE CHECK (length(invite_code) = 8),
  email           text,
  role_offer      text NOT NULL CHECK (role_offer IN ('admin','teacher','student','viewer')),
  created_by      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  used_at         timestamptz,
  used_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oi_code_unused ON public.org_invites (invite_code) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_oi_org ON public.org_invites (org_id);

CREATE TABLE IF NOT EXISTS public.org_audit_log (
  id              bigserial PRIMARY KEY,
  org_id          uuid NOT NULL,
  actor_user_id   uuid,
  action          text NOT NULL,
  target_type     text,
  target_id       text,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oal_org_recent ON public.org_audit_log (org_id, created_at DESC);

-- RLS-Helper (DEFINER, rekursionsfrei)
CREATE OR REPLACE FUNCTION public.fn_is_org_member(p_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.org_members WHERE org_id = p_org AND user_id = (SELECT auth.uid()));
$$;
CREATE OR REPLACE FUNCTION public.fn_org_role(p_org uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT role FROM public.org_members WHERE org_id = p_org AND user_id = (SELECT auth.uid()) LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.fn_is_org_member(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_org_role(uuid) TO anon, authenticated;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY orgs_read_members ON public.organizations FOR SELECT TO authenticated
  USING (public.fn_is_org_member(id));
CREATE POLICY orgs_insert_authed ON public.organizations FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = created_by);
CREATE POLICY orgs_update_owner_admin ON public.organizations FOR UPDATE TO authenticated
  USING (public.fn_org_role(id) IN ('owner','admin'));
CREATE POLICY orgs_delete_owner ON public.organizations FOR DELETE TO authenticated
  USING (public.fn_org_role(id) = 'owner');

CREATE POLICY om_read_same_org ON public.org_members FOR SELECT TO authenticated
  USING (public.fn_is_org_member(org_id));

CREATE POLICY oi_read_admins ON public.org_invites FOR SELECT TO authenticated
  USING (public.fn_org_role(org_id) IN ('owner','admin'));
CREATE POLICY oi_create_admins ON public.org_invites FOR INSERT TO authenticated
  WITH CHECK (public.fn_org_role(org_id) IN ('owner','admin'));

CREATE POLICY oal_read_admins ON public.org_audit_log FOR SELECT TO authenticated
  USING (public.fn_org_role(org_id) IN ('owner','admin'));

-- Core-RPCs (siehe Migration-Header für Security-Rationale)
CREATE OR REPLACE FUNCTION public.fn_org_create(p_slug text, p_name text, p_type text, p_country text DEFAULT 'CH')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := (SELECT auth.uid()); v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authed'; END IF;
  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = lower(p_slug)) THEN RAISE EXCEPTION 'slug_taken'; END IF;
  INSERT INTO public.organizations (slug, name, org_type, country, created_by)
  VALUES (lower(p_slug), p_name, p_type, coalesce(p_country,'CH'), v_uid) RETURNING id INTO v_id;
  INSERT INTO public.org_members (org_id, user_id, role) VALUES (v_id, v_uid, 'owner');
  INSERT INTO public.org_audit_log (org_id, actor_user_id, action, metadata)
    VALUES (v_id, v_uid, 'org_created', jsonb_build_object('slug', lower(p_slug), 'name', p_name));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.fn_org_create(text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_org_create(text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_org_invite_create(p_org_id uuid, p_role text, p_email text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := (SELECT auth.uid()); v_my_role text; v_code text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authed'; END IF;
  SELECT role INTO v_my_role FROM public.org_members WHERE org_id = p_org_id AND user_id = v_uid;
  IF v_my_role NOT IN ('owner','admin','teacher') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_my_role = 'teacher' AND p_role <> 'student' THEN RAISE EXCEPTION 'teacher_can_only_invite_students'; END IF;
  IF p_role NOT IN ('admin','teacher','student','viewer') THEN RAISE EXCEPTION 'bad_role'; END IF;
  v_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));
  INSERT INTO public.org_invites (org_id, invite_code, email, role_offer, created_by)
  VALUES (p_org_id, v_code, p_email, p_role, v_uid);
  INSERT INTO public.org_audit_log (org_id, actor_user_id, action, metadata)
    VALUES (p_org_id, v_uid, 'invite_sent', jsonb_build_object('code', v_code, 'role', p_role, 'email', p_email));
  RETURN v_code;
END $$;
REVOKE ALL ON FUNCTION public.fn_org_invite_create(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_org_invite_create(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_org_invite_redeem(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := (SELECT auth.uid()); v_inv record; v_org record; v_count int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error','not_authed'); END IF;
  SELECT * INTO v_inv FROM public.org_invites WHERE invite_code = upper(p_code);
  IF NOT FOUND THEN RETURN jsonb_build_object('error','invalid_code'); END IF;
  IF v_inv.used_at IS NOT NULL THEN RETURN jsonb_build_object('error','already_used'); END IF;
  IF v_inv.expires_at < now() THEN RETURN jsonb_build_object('error','expired'); END IF;
  SELECT * INTO v_org FROM public.organizations WHERE id = v_inv.org_id;
  IF NOT v_org.is_active THEN RETURN jsonb_build_object('error','org_inactive'); END IF;
  SELECT count(*) INTO v_count FROM public.org_members WHERE org_id = v_inv.org_id;
  IF v_count >= v_org.max_members AND NOT EXISTS(SELECT 1 FROM public.org_members WHERE org_id=v_inv.org_id AND user_id=v_uid)
    THEN RETURN jsonb_build_object('error','max_members_reached'); END IF;
  INSERT INTO public.org_members (org_id, user_id, role, invited_by)
  VALUES (v_inv.org_id, v_uid, v_inv.role_offer, v_inv.created_by)
  ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  UPDATE public.org_invites SET used_at = now(), used_by = v_uid WHERE id = v_inv.id;
  INSERT INTO public.org_audit_log (org_id, actor_user_id, action, target_type, target_id, metadata)
    VALUES (v_inv.org_id, v_uid, 'member_joined', 'user', v_uid::text, jsonb_build_object('role', v_inv.role_offer));
  RETURN jsonb_build_object('org_id', v_inv.org_id, 'org_name', v_org.name, 'role', v_inv.role_offer);
END $$;
REVOKE ALL ON FUNCTION public.fn_org_invite_redeem(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_org_invite_redeem(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_my_orgs()
RETURNS TABLE (org_id uuid, name text, slug text, org_type text, logo_url text, my_role text, member_count int)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  SELECT o.id, o.name, o.slug, o.org_type, o.logo_url, om.role::text,
    (SELECT count(*)::int FROM public.org_members om2 WHERE om2.org_id = o.id)
  FROM public.org_members om
  JOIN public.organizations o ON o.id = om.org_id
  WHERE om.user_id = (SELECT auth.uid()) AND o.is_active = true
  ORDER BY om.joined_at DESC;
$$;
REVOKE ALL ON FUNCTION public.fn_my_orgs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_my_orgs() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_org_detail(p_org_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := (SELECT auth.uid()); v_my_role text; v_org record; v_members jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error','not_authed'); END IF;
  SELECT role INTO v_my_role FROM public.org_members WHERE org_id = p_org_id AND user_id = v_uid;
  IF v_my_role IS NULL THEN RETURN jsonb_build_object('error','not_member'); END IF;
  SELECT * INTO v_org FROM public.organizations WHERE id = p_org_id;
  SELECT jsonb_agg(jsonb_build_object(
    'user_id', om.user_id, 'role', om.role, 'joined_at', om.joined_at,
    'display_name', coalesce(om.display_name_in_org, p.display_name), 'avatar_emoji', p.avatar_emoji
  ) ORDER BY om.joined_at) INTO v_members
  FROM public.org_members om LEFT JOIN public.profiles p ON p.id = om.user_id
  WHERE om.org_id = p_org_id;
  RETURN jsonb_build_object(
    'org', jsonb_build_object(
      'id', v_org.id, 'slug', v_org.slug, 'name', v_org.name, 'org_type', v_org.org_type,
      'country', v_org.country, 'bio', v_org.bio, 'logo_url', v_org.logo_url, 'website', v_org.website,
      'primary_color', v_org.primary_color, 'subscription_tier', v_org.subscription_tier,
      'max_members', v_org.max_members, 'is_active', v_org.is_active, 'created_at', v_org.created_at),
    'my_role', v_my_role,
    'can_manage_members', v_my_role IN ('owner','admin'),
    'can_manage_settings', v_my_role IN ('owner','admin'),
    'members', coalesce(v_members, '[]'::jsonb)
  );
END $$;
REVOKE ALL ON FUNCTION public.fn_org_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_org_detail(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_org_member_set_role(p_org_id uuid, p_target_user uuid, p_new_role text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := (SELECT auth.uid()); v_my_role text; v_target_role text;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  IF p_new_role NOT IN ('owner','admin','teacher','student','viewer') THEN RETURN false; END IF;
  SELECT role INTO v_my_role FROM public.org_members WHERE org_id = p_org_id AND user_id = v_uid;
  IF v_my_role NOT IN ('owner','admin') THEN RETURN false; END IF;
  IF v_my_role = 'admin' AND p_new_role IN ('owner','admin') THEN RETURN false; END IF;
  SELECT role INTO v_target_role FROM public.org_members WHERE org_id = p_org_id AND user_id = p_target_user;
  IF v_target_role IS NULL THEN RETURN false; END IF;
  IF v_my_role = 'admin' AND v_target_role IN ('owner','admin') THEN RETURN false; END IF;
  IF v_target_role = 'owner' AND p_new_role <> 'owner' THEN
    IF (SELECT count(*) FROM public.org_members WHERE org_id = p_org_id AND role = 'owner') <= 1 THEN RETURN false; END IF;
  END IF;
  UPDATE public.org_members SET role = p_new_role WHERE org_id = p_org_id AND user_id = p_target_user;
  INSERT INTO public.org_audit_log (org_id, actor_user_id, action, target_type, target_id, metadata)
    VALUES (p_org_id, v_uid, 'role_changed', 'user', p_target_user::text, jsonb_build_object('from', v_target_role, 'to', p_new_role));
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.fn_org_member_set_role(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_org_member_set_role(uuid,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_org_leave(p_org_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := (SELECT auth.uid()); v_my_role text;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  SELECT role INTO v_my_role FROM public.org_members WHERE org_id = p_org_id AND user_id = v_uid;
  IF v_my_role IS NULL THEN RETURN false; END IF;
  IF v_my_role = 'owner' THEN
    IF (SELECT count(*) FROM public.org_members WHERE org_id = p_org_id AND role = 'owner') <= 1 THEN RETURN false; END IF;
  END IF;
  DELETE FROM public.org_members WHERE org_id = p_org_id AND user_id = v_uid;
  INSERT INTO public.org_audit_log (org_id, actor_user_id, action, target_type, target_id, metadata)
    VALUES (p_org_id, v_uid, 'member_left', 'user', v_uid::text, jsonb_build_object('was_role', v_my_role));
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.fn_org_leave(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_org_leave(uuid) TO authenticated;

-- Public-Org-Directory (curated DEFINER-Fn statt Leaky-View; anon-fähig für Discovery)
CREATE OR REPLACE FUNCTION public.fn_org_directory(p_q text DEFAULT NULL, p_limit int DEFAULT 30)
RETURNS TABLE (id uuid, slug text, name text, org_type text, country text, bio text,
               logo_url text, website text, primary_color text, member_count int, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT o.id, o.slug, o.name, o.org_type, o.country, o.bio, o.logo_url, o.website, o.primary_color,
    (SELECT count(*)::int FROM public.org_members om WHERE om.org_id = o.id) AS member_count, o.created_at
  FROM public.organizations o
  WHERE o.is_active = true
    AND (p_q IS NULL OR length(p_q) < 2 OR o.name ILIKE '%'||p_q||'%' OR o.slug ILIKE '%'||p_q||'%')
  ORDER BY o.created_at DESC
  LIMIT GREATEST(1, LEAST(coalesce(p_limit,30), 60));
$$;
GRANT EXECUTE ON FUNCTION public.fn_org_directory(text,int) TO anon, authenticated;
