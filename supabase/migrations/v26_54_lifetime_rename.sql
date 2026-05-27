-- v26.54 HOTFIX — Lifetime-Spalten-Rename
-- Autor: Cowork-Claude 2026-05-27
-- Bug: Lifetime-Käufer (CHF 45.60 Launch-Aktion) landen als tier='free'
--   - stripe-webhook setzte is_launch_lifetime: true
--   - v_user_entitlements + fn_sync_lifetime_to_profile lesen aber is_lifetime
--   - → Spalten-Drift → Lifetime-Status geht verloren
-- Fix: Spalten-Rename macht Webhook+View+Trigger konsistent.

-- =============================================================================
-- 1) Pre-Check: gibt es überhaupt is_launch_lifetime-User die "kaputt" sind?
-- =============================================================================
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'stripe_subscriptions'
    AND column_name = 'is_launch_lifetime';

  IF cnt = 0 THEN
    RAISE NOTICE 'Migration NO-OP: is_launch_lifetime existiert nicht (vermutlich bereits umbenannt oder Schema neu)';
    RETURN;
  END IF;

  -- Wenn beide Spalten existieren: Werte erst syncen, dann alte Spalte droppen
  SELECT count(*) INTO cnt
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'stripe_subscriptions'
    AND column_name = 'is_lifetime';

  IF cnt > 0 THEN
    RAISE NOTICE 'Beide Spalten existieren — Werte syncen + alte droppen';
  END IF;
END $$;

-- =============================================================================
-- 2) Wenn is_lifetime Spalte schon existiert: aus is_launch_lifetime mergen
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='stripe_subscriptions' AND column_name='is_lifetime'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='stripe_subscriptions' AND column_name='is_launch_lifetime'
  ) THEN
    -- Werte aus is_launch_lifetime in is_lifetime mergen (TRUE überschreibt FALSE)
    UPDATE public.stripe_subscriptions
       SET is_lifetime = COALESCE(is_launch_lifetime, false) OR COALESCE(is_lifetime, false)
     WHERE is_launch_lifetime IS NOT NULL OR is_lifetime IS NOT NULL;

    -- Alte Spalte droppen
    ALTER TABLE public.stripe_subscriptions DROP COLUMN is_launch_lifetime;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='stripe_subscriptions' AND column_name='is_launch_lifetime'
  ) THEN
    -- Nur is_launch_lifetime existiert → einfach umbenennen
    ALTER TABLE public.stripe_subscriptions RENAME COLUMN is_launch_lifetime TO is_lifetime;
  END IF;
END $$;

-- =============================================================================
-- 3) Default + NOT-NULL sicherstellen (falls neu erstellt)
-- =============================================================================
ALTER TABLE public.stripe_subscriptions
  ALTER COLUMN is_lifetime SET DEFAULT false;

UPDATE public.stripe_subscriptions
   SET is_lifetime = false
 WHERE is_lifetime IS NULL;

ALTER TABLE public.stripe_subscriptions
  ALTER COLUMN is_lifetime SET NOT NULL;

-- =============================================================================
-- 4) Re-Trigger fn_sync_lifetime_to_profile für alle bestehenden Lifetime-Subs
--    (damit profiles.tier='lifetime' nachträglich gesetzt wird für die,
--    die wegen dem Bug noch tier='free' haben)
-- =============================================================================
UPDATE public.profiles p
   SET tier = 'lifetime'
  FROM public.stripe_subscriptions s
 WHERE s.user_id = p.id
   AND s.is_lifetime = true
   AND s.status IN ('active','complete')
   AND p.tier != 'lifetime';

-- =============================================================================
-- 5) Comment für Doku
-- =============================================================================
COMMENT ON COLUMN public.stripe_subscriptions.is_lifetime IS
  'v26.54 HOTFIX: Umbenannt von is_launch_lifetime. Lifetime-Käufe (pro_lifetime CHF 45.60). View v_user_entitlements + Trigger fn_sync_lifetime_to_profile lesen diese Spalte.';

-- =============================================================================
-- 6) Verify (manuell laufen lassen):
-- =============================================================================
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='stripe_subscriptions' AND column_name LIKE '%lifetime%';
--   -- Erwartet: nur 'is_lifetime'
--
-- SELECT count(*) FROM stripe_subscriptions WHERE is_lifetime=true AND status='active';
-- SELECT count(*) FROM profiles WHERE tier='lifetime';
-- -- Beide Counts sollten identisch sein (oder Profiles >= Subs falls Trigger Edge-Cases hat)
