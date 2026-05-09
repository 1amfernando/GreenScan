-- v24.52: v_user_entitlements past_due-Behandlung
-- =============================================================
-- Liest stripe_subscriptions.status statt nur profiles.tier.
-- Effektives Tier fällt auf 'free' wenn:
--   - kein active/trialing/lifetime sub vorhanden
--   - past_due > 7 Tage Grace-Period
-- Cowork-Verify 2026-05-04: bisher Bug — User mit past_due behielt Plus-Privilegien.
-- Bereits via Supabase MCP applied 2026-05-04 — dieses File spiegelt den Zustand.

CREATE OR REPLACE VIEW public.v_user_entitlements AS
WITH active_sub AS (
    SELECT user_id
    FROM stripe_subscriptions
    WHERE
      -- Lifetime ist immer aktiv
      (is_lifetime = true)
      -- Active oder Trialing sind aktiv
      OR (status IN ('active','trialing'))
      -- Past_due nur wenn current_period_end weniger als 7 Tage zurück (Grace)
      OR (status = 'past_due' AND current_period_end > now() - interval '7 days')
)
SELECT
    p.id AS user_id,
    -- Effektives Tier: profiles.tier wenn aktiver Sub ODER lifetime, sonst 'free'
    CASE
      WHEN p.is_lifetime
           OR EXISTS(SELECT 1 FROM active_sub WHERE user_id = p.id)
      THEN p.tier
      ELSE 'free'
    END AS tier,
    CASE
      WHEN (p.is_lifetime OR EXISTS(SELECT 1 FROM active_sub WHERE user_id = p.id)) AND
           (p.is_lifetime OR (p.tier = ANY (ARRAY['plus'::text, 'pro'::text, 'premium'::text, 'lifetime'::text])))
      THEN '-1'::integer
      WHEN p.tier = 'basic' THEN 1500
      ELSE 150
    END AS scans_per_month,
    -- ai_herbalist nur bei aktiv pro/lifetime
    (p.is_lifetime OR (
        EXISTS(SELECT 1 FROM active_sub WHERE user_id = p.id)
        AND p.tier = ANY (ARRAY['pro'::text, 'lifetime'::text])
    )) AS ai_herbalist,
    (p.is_lifetime OR (
        EXISTS(SELECT 1 FROM active_sub WHERE user_id = p.id)
        AND p.tier = ANY (ARRAY['pro'::text, 'lifetime'::text])
    )) AS offline_mode,
    (p.is_lifetime OR (
        EXISTS(SELECT 1 FROM active_sub WHERE user_id = p.id)
        AND p.tier = ANY (ARRAY['plus'::text, 'pro'::text, 'lifetime'::text, 'premium'::text])
    )) AS recipes_export,
    (p.is_lifetime OR (
        EXISTS(SELECT 1 FROM active_sub WHERE user_id = p.id)
        AND p.tier = ANY (ARRAY['plus'::text, 'pro'::text, 'lifetime'::text, 'premium'::text])
    )) AS community_post,
    (p.is_lifetime OR (
        EXISTS(SELECT 1 FROM active_sub WHERE user_id = p.id)
        AND p.tier = ANY (ARRAY['plus'::text, 'pro'::text, 'lifetime'::text, 'premium'::text])
    )) AS unlimited_plants,
    p.is_admin,
    p.is_lifetime,
    p.role
FROM profiles p
WHERE p.id = auth.uid();

COMMENT ON VIEW public.v_user_entitlements IS 'v24.52: Liest stripe_subscriptions.status — past_due > 7d fällt auf tier=free zurück (Cowork-Verify 2026-05-04 Bug-Fix).';

-- ─────────────────────────────────────────────────────────────
-- Trigger fn_sync_lifetime_to_profile fix:
-- past_due NICHT mehr sofort auf 'free' setzen — View regelt 7d-Grace selbst.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_sync_lifetime_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF NEW.is_lifetime = true THEN
    UPDATE public.profiles SET tier = 'lifetime', is_lifetime = true WHERE id = NEW.user_id;
  ELSIF NEW.status IN ('active','trialing') AND NEW.is_lifetime IS DISTINCT FROM true THEN
    UPDATE public.profiles pr SET tier = COALESCE(
      (SELECT (CASE WHEN sp.lookup_key LIKE '%pro%' THEN 'pro'
                    WHEN sp.lookup_key LIKE '%plus%' THEN 'plus'
                    WHEN sp.lookup_key LIKE '%basic%' THEN 'basic'
                    ELSE pr.tier END)
       FROM public.stripe_prices sp WHERE sp.id = NEW.price_id), pr.tier)
     WHERE pr.id = NEW.user_id;
  -- past_due NICHT mehr in dieser Liste — View regelt 7d-Grace
  ELSIF NEW.status IN ('canceled','unpaid','incomplete_expired') THEN
    UPDATE public.profiles SET tier = 'free'
     WHERE id = NEW.user_id AND is_lifetime = false;
  END IF;
  RETURN NEW;
END; $function$;

COMMENT ON FUNCTION public.fn_sync_lifetime_to_profile() IS 'v24.52: past_due wird nicht mehr sofort auf free gesetzt — View v_user_entitlements regelt 7d-Grace-Period.';
