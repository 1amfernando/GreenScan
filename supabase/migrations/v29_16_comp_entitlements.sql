-- ============ v29.16 Comp-Entitlements: Admin-/Gutschein-Tier schaltet Features zuverlässig frei ============
-- (Backend-only Teil; das Frontend bekam den v-Bump.) Fernando-Auftrag: "Wenn ich jemandem Pro umschalte,
-- muss das erkannt werden und die Funktionen freischalten."
--
-- WURZEL (4-Agenten-Diagnose, als echter JWT belegt): fn_admin_set_tier + fn_redeem_voucher setzten NUR
-- profiles.tier. v_user_entitlements honorierte profiles.tier aber ausschliesslich bei is_lifetime ODER
-- aktivem Stripe-Abo → admin-/gutschein-vergebenes Pro/Lifetime blieb funktionslos (4 reale Konten gesperrt).
-- Zusätzlich latenter Bug für ECHTE Zahler: stripe-webhook setzt profiles.tier NIE, die View las aber
-- profiles.tier statt stripe_subscriptions.tier.
--
-- FIX: Stripe-unabhängiger 3. Entitlement-Pfad (comp_tier). View liest echten Stripe-Abo-Tier (sub.tier).
-- Effektiver Tier = lifetime > aktives Stripe-Abo > gültiger Comp > free. HL#18-Guard um comp_* erweitert
-- (kein Self-Grant). 4 gestrandete Konten backfilled.
-- ABNAHME als echter JWT 8/8: Admin-Grant pro→unlock, free→lock, Voucher→unlock, echtes Stripe→unverändert,
-- Kündigung→free, Lifetime→voll, abgelaufener comp→free, Self-Grant→protected_column_change_denied.
-- Server-Consumer fn_quota_peek/_consume/has_feature/user_scan_quota_remaining bleiben kompatibel
-- (Spalten-Set/-Reihenfolge der View unverändert) und honorieren comp ebenfalls.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS comp_tier text,
  ADD COLUMN IF NOT EXISTS comp_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS comp_granted_by uuid,
  ADD COLUMN IF NOT EXISTS comp_granted_at timestamptz;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_comp_tier_chk;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_comp_tier_chk
  CHECK (comp_tier IS NULL OR comp_tier IN ('pro','lifetime'));

CREATE OR REPLACE FUNCTION public.fn_profiles_guard_protected()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
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
    THEN RAISE EXCEPTION 'protected_column_change_denied' USING ERRCODE='insufficient_privilege'; END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE VIEW public.v_user_entitlements WITH (security_invoker = true) AS
WITH active_sub AS (
  SELECT s.user_id,
         bool_or(s.is_lifetime) AS sub_is_lifetime,
         max(s.tier) FILTER (WHERE s.tier IN ('pro','lifetime','plus','premium','basic')) AS sub_tier
    FROM public.stripe_subscriptions s
   WHERE s.is_lifetime = true
      OR s.status IN ('active','trialing')
      OR (s.status = 'past_due' AND s.current_period_end > now() - interval '7 days')
   GROUP BY s.user_id
),
eff AS (
  SELECT p.id, p.is_admin, p.role, p.tier AS raw_tier, p.is_lifetime AS raw_is_lifetime,
         p.comp_tier,
         a.user_id AS sub_uid, a.sub_is_lifetime, a.sub_tier,
         (p.comp_tier IN ('pro','lifetime') AND (p.comp_expires_at IS NULL OR p.comp_expires_at > now())) AS comp_active
    FROM public.profiles p
    LEFT JOIN active_sub a ON a.user_id = p.id
   WHERE p.id = (SELECT auth.uid())
),
fin AS (
  SELECT e.*,
    CASE
      WHEN coalesce(e.raw_is_lifetime,false) OR coalesce(e.sub_is_lifetime,false)
           OR (e.comp_active AND e.comp_tier = 'lifetime') THEN 'lifetime'
      WHEN e.sub_uid IS NOT NULL THEN coalesce(e.sub_tier, e.raw_tier)
      WHEN e.comp_active THEN e.comp_tier
      ELSE 'free'
    END AS eff_tier
  FROM eff e
)
SELECT
  id AS user_id,
  eff_tier AS tier,
  CASE WHEN eff_tier IN ('pro','lifetime','plus','premium') THEN -1
       WHEN eff_tier = 'basic' THEN 1500
       ELSE 150 END AS scans_per_month,
  (eff_tier IN ('pro','lifetime'))                  AS ai_herbalist,
  (eff_tier IN ('pro','lifetime'))                  AS offline_mode,
  (eff_tier IN ('plus','pro','lifetime','premium')) AS recipes_export,
  (eff_tier IN ('plus','pro','lifetime','premium')) AS community_post,
  (eff_tier IN ('plus','pro','lifetime','premium')) AS unlimited_plants,
  is_admin,
  (eff_tier = 'lifetime')                           AS is_lifetime,
  role
FROM fin;
GRANT SELECT ON public.v_user_entitlements TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_set_tier(p_user_id uuid, p_tier text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_has_sub boolean;
BEGIN
  IF NOT is_admin_user() THEN RETURN jsonb_build_object('error','forbidden'); END IF;
  IF p_tier NOT IN ('free','pro','lifetime') THEN RETURN jsonb_build_object('error','invalid_tier'); END IF;
  SELECT EXISTS(SELECT 1 FROM stripe_subscriptions ss
    WHERE ss.user_id = p_user_id AND ss.status IN ('active','trialing')) INTO v_has_sub;
  IF p_tier = 'free' THEN
    UPDATE profiles SET comp_tier=NULL, comp_expires_at=NULL, comp_granted_by=NULL, comp_granted_at=NULL,
           tier = CASE WHEN v_has_sub THEN tier ELSE 'free' END
     WHERE id = p_user_id;
  ELSE
    UPDATE profiles SET comp_tier=p_tier, comp_expires_at=NULL,
           comp_granted_by=(SELECT auth.uid()), comp_granted_at=now(), tier=p_tier
     WHERE id = p_user_id;
  END IF;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','user_not_found'); END IF;
  INSERT INTO audit_log (actor_id, action, target_type, target_id, diff)
  VALUES ((SELECT auth.uid()), 'admin_set_tier', 'profile', p_user_id::text,
          jsonb_build_object('new_tier', p_tier, 'via', 'comp'));
  RETURN jsonb_build_object('ok', true, 'tier', p_tier, 'stripe_warning', v_has_sub);
END; $function$;

CREATE OR REPLACE FUNCTION public.fn_redeem_voucher(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE u uuid := (SELECT auth.uid()); v public.vouchers%ROWTYPE; v_tier text; v_days text;
BEGIN
  IF u IS NULL THEN RETURN jsonb_build_object('error','not_authenticated'); END IF;
  IF coalesce(trim(p_code),'') = '' THEN RETURN jsonb_build_object('error','no_code'); END IF;
  SELECT * INTO v FROM vouchers WHERE lower(code) = lower(trim(p_code)) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF NOT v.is_active THEN RETURN jsonb_build_object('error','inactive'); END IF;
  IF v.valid_until IS NOT NULL AND v.valid_until < now() THEN RETURN jsonb_build_object('error','expired'); END IF;
  IF v.max_uses IS NOT NULL AND v.used_count >= v.max_uses THEN RETURN jsonb_build_object('error','exhausted'); END IF;
  IF EXISTS(SELECT 1 FROM voucher_redemptions WHERE voucher_code = v.code AND user_id = u) THEN
    RETURN jsonb_build_object('error','already_redeemed'); END IF;
  INSERT INTO voucher_redemptions(voucher_code, user_id) VALUES (v.code, u);
  v_tier := v.reward->>'tier';
  v_days := v.reward->>'duration_days';
  IF v_tier IN ('pro','lifetime') THEN
    UPDATE profiles SET comp_tier=v_tier,
      comp_expires_at = CASE WHEN v_days ~ '^[0-9]+$' THEN now() + (v_days||' days')::interval ELSE NULL END,
      comp_granted_by=NULL, comp_granted_at=now(), tier=v_tier
     WHERE id = u;
  END IF;
  INSERT INTO audit_log(actor_id, action, target_type, target_id, diff)
  VALUES (u, 'voucher_redeem', 'voucher', v.code, jsonb_build_object('reward', v.reward, 'via', 'comp'));
  RETURN jsonb_build_object('ok', true, 'reward', v.reward, 'tier', v_tier);
END; $function$;

-- Backfill der bereits vergebenen, aber leerlaufenden Grants (tier/is_lifetime ohne Abo) → comp_tier
UPDATE public.profiles p
   SET comp_tier = CASE WHEN p.is_lifetime THEN 'lifetime' ELSE p.tier END,
       comp_granted_at = now()
 WHERE (p.tier IN ('pro','lifetime') OR p.is_lifetime)
   AND p.comp_tier IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.stripe_subscriptions s
        WHERE s.user_id = p.id AND (s.is_lifetime OR s.status IN ('active','trialing')));
