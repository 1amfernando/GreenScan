-- v29.28 Block B Fix (Review-P1/P2): konstanteres Backup OHNE wertvolle Wiederherstellungs-
-- punkte zu verdrängen. Vorher: 3-Slot-Cap → der neue 3h-auto_periodic-Snapshot (v29.27) hätte
-- daily/pre_migration binnen ~9h rotiert. Plus auto_periodic wurde silent zu 'manual' coerced.
-- Fix: 'auto_periodic' erlauben + korrekt labeln; Cap 3→6; trigger-aware Retention
-- (neuester pre_migration/auto_daily/pre_logout immer geschützt).
-- Verifiziert als echter JWT (HL#16): fn_user_snapshot_create('auto_periodic',…) → Label
-- 'auto_periodic' (nicht mehr zu 'manual' coerced).

-- 1) CHECK um 'auto_periodic' erweitern
ALTER TABLE public.user_state_snapshots DROP CONSTRAINT IF EXISTS user_state_snapshots_trigger_reason_check;
ALTER TABLE public.user_state_snapshots ADD CONSTRAINT user_state_snapshots_trigger_reason_check
  CHECK (trigger_reason = ANY (ARRAY['auto_daily','auto_periodic','pre_migration','manual','pre_logout']));

-- 2) Whitelist in fn_user_snapshot_create erweitern (sonst auto_periodic → 'manual')
CREATE OR REPLACE FUNCTION public.fn_user_snapshot_create(p_trigger text, p_state jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $function$
DECLARE v_id uuid; v_uid uuid := (SELECT auth.uid()); v_trig text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authed'; END IF;
  IF p_state IS NULL OR jsonb_typeof(p_state) <> 'object' THEN RAISE EXCEPTION 'bad_state'; END IF;
  IF octet_length(p_state::text) < 8 THEN RAISE EXCEPTION 'empty_state'; END IF;
  v_trig := CASE WHEN p_trigger IN ('auto_daily','auto_periodic','pre_migration','manual','pre_logout')
                 THEN p_trigger ELSE 'manual' END;
  INSERT INTO public.user_state_snapshots (user_id, trigger_reason, state)
  VALUES (v_uid, v_trig, p_state)
  ON CONFLICT (user_id, taken_at) DO UPDATE SET state = EXCLUDED.state
  RETURNING id INTO v_id;
  PERFORM public.fn_cleanup_user_snapshots();
  RETURN v_id;
END $function$;

-- 3) Trigger-aware Retention: 6 neueste behalten + neuesten pre_migration/auto_daily/pre_logout
--    IMMER schützen (Disaster-Recovery-Anker, von häufigen auto_periodic nicht verdrängbar).
CREATE OR REPLACE FUNCTION public.fn_cleanup_user_snapshots()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $function$
DECLARE v_deleted int := 0;
BEGIN
  WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY taken_at DESC) AS rn,
           ROW_NUMBER() OVER (PARTITION BY user_id, trigger_reason ORDER BY taken_at DESC) AS rn_trig,
           trigger_reason
    FROM public.user_state_snapshots
  ),
  keep AS (
    SELECT id FROM ranked
    WHERE rn <= 6
       OR (trigger_reason IN ('pre_migration','auto_daily','pre_logout') AND rn_trig = 1)
  ),
  del AS (
    DELETE FROM public.user_state_snapshots
    WHERE id NOT IN (SELECT id FROM keep)
    RETURNING id
  )
  SELECT count(*)::int INTO v_deleted FROM del;
  RETURN v_deleted;
END $function$;
