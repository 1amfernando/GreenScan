-- ============================================================================
-- v28_05_feature_quota — Tier-System + Quotas (v28.05 · Pfad C: erweitern, additiv)
-- Spiegel der LIVE angewandten Migration (project vowbiueikwrauuceilhc).
-- Hard-Lesson #14: gegen echte DB-Realität gebaut (siehe QUOTA_AUDIT_v28.05.md):
--   • feature_limits BLEIBT die Config (existing wins) → nur additive Spalten.
--   • ai_daily_usage ist GLOBAL/ohne user_id (Admin-Kosten) → bleibt unangetastet.
--   • feature_usage = der bisher fehlende Per-User-Per-Feature-Tageszähler (NEU).
--   • tier-Enum hat KEIN 'lifetime' → keine lifetime-Zeile; Lifetime über is_lifetime.
-- ============================================================================

-- 1) feature_limits additiv erweitern (-1 = unbegrenzt) -------------------------------------------
ALTER TABLE public.feature_limits ADD COLUMN IF NOT EXISTS scans_per_day      int;
ALTER TABLE public.feature_limits ADD COLUMN IF NOT EXISTS lina_per_day       int;
ALTER TABLE public.feature_limits ADD COLUMN IF NOT EXISTS doctor_per_day     int;
ALTER TABLE public.feature_limits ADD COLUMN IF NOT EXISTS foto_diff_per_day  int;
ALTER TABLE public.feature_limits ADD COLUMN IF NOT EXISTS battle_per_day     int;
ALTER TABLE public.feature_limits ADD COLUMN IF NOT EXISTS garden_max         int;
ALTER TABLE public.feature_limits ADD COLUMN IF NOT EXISTS marketplace_photos int;

UPDATE public.feature_limits SET
  scans_per_day=15, lina_per_day=10, doctor_per_day=5, foto_diff_per_day=3,
  battle_per_day=10, garden_max=2, marketplace_photos=3 WHERE tier='free';
UPDATE public.feature_limits SET
  scans_per_day=-1, lina_per_day=-1, doctor_per_day=-1, foto_diff_per_day=-1,
  battle_per_day=-1, garden_max=-1, marketplace_photos=5 WHERE tier IN ('plus','pro','admin');

-- 2) feature_usage (NEU) — Per-User-Per-Feature-Per-Periode-Zähler --------------------------------
CREATE TABLE IF NOT EXISTS public.feature_usage (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature      text NOT NULL,
  period_type  text NOT NULL DEFAULT 'day',
  period_start date NOT NULL,          -- Europe/Zurich-lokaler Tag
  used         int  NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, feature, period_type, period_start)
);
CREATE INDEX IF NOT EXISTS idx_feature_usage_cleanup ON public.feature_usage (period_start);
ALTER TABLE public.feature_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fu_own_read ON public.feature_usage;
CREATE POLICY fu_own_read ON public.feature_usage FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
GRANT SELECT ON public.feature_usage TO authenticated;
-- INSERT/UPDATE nur via DEFINER-RPC fn_quota_consume.

-- 3) fn_quota_consume — atomar check-and-increment (Server-Truth, nicht LS-umgehbar) --------------
CREATE OR REPLACE FUNCTION public.fn_quota_consume(p_feature text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_uid  uuid := (SELECT auth.uid());
  v_tier text; v_limit int; v_used int;
  v_day  date := (now() AT TIME ZONE 'Europe/Zurich')::date;
  v_next timestamptz := ((v_day + 1)::timestamp AT TIME ZONE 'Europe/Zurich');
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('allowed', false, 'reason', 'auth'); END IF;
  SELECT tier INTO v_tier FROM public.v_user_entitlements LIMIT 1;
  v_tier := COALESCE(v_tier, 'free');
  IF v_tier <> 'free' THEN RETURN jsonb_build_object('allowed', true, 'unlimited', true, 'tier', v_tier); END IF;
  SELECT CASE p_feature
           WHEN 'scan' THEN scans_per_day WHEN 'lina' THEN lina_per_day
           WHEN 'doctor' THEN doctor_per_day WHEN 'foto_diff' THEN foto_diff_per_day
           WHEN 'battle' THEN battle_per_day ELSE NULL END
    INTO v_limit FROM public.feature_limits WHERE tier='free';
  IF v_limit IS NULL THEN RETURN jsonb_build_object('allowed', true, 'unlimited', true, 'unknown_feature', true); END IF;
  IF v_limit = -1 THEN RETURN jsonb_build_object('allowed', true, 'unlimited', true); END IF;
  IF v_limit <= 0 THEN RETURN jsonb_build_object('allowed', false, 'used', 0, 'limit', 0, 'remaining', 0, 'period_end', v_next); END IF;
  INSERT INTO public.feature_usage(user_id, feature, period_type, period_start, used)
  VALUES (v_uid, p_feature, 'day', v_day, 1)
  ON CONFLICT (user_id, feature, period_type, period_start)
  DO UPDATE SET used = public.feature_usage.used + 1, updated_at = now()
    WHERE public.feature_usage.used < v_limit
  RETURNING used INTO v_used;
  IF v_used IS NULL THEN
    SELECT used INTO v_used FROM public.feature_usage
      WHERE user_id=v_uid AND feature=p_feature AND period_type='day' AND period_start=v_day;
    RETURN jsonb_build_object('allowed', false, 'used', COALESCE(v_used, v_limit), 'limit', v_limit, 'remaining', 0, 'period_end', v_next);
  END IF;
  RETURN jsonb_build_object('allowed', true, 'used', v_used, 'limit', v_limit, 'remaining', GREATEST(0, v_limit - v_used), 'period_end', v_next);
END $$;
REVOKE ALL ON FUNCTION public.fn_quota_consume(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_quota_consume(text) TO authenticated;

-- 4) fn_quota_peek — nur lesen (UI / "Mein Plan") -------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_quota_peek(p_feature text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=public,pg_temp AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid()); v_tier text; v_limit int; v_used int;
  v_day date := (now() AT TIME ZONE 'Europe/Zurich')::date;
  v_next timestamptz := ((v_day + 1)::timestamp AT TIME ZONE 'Europe/Zurich');
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('allowed', false, 'reason', 'auth'); END IF;
  SELECT tier INTO v_tier FROM public.v_user_entitlements LIMIT 1;
  v_tier := COALESCE(v_tier, 'free');
  IF v_tier <> 'free' THEN RETURN jsonb_build_object('allowed', true, 'unlimited', true, 'tier', v_tier); END IF;
  SELECT CASE p_feature
           WHEN 'scan' THEN scans_per_day WHEN 'lina' THEN lina_per_day
           WHEN 'doctor' THEN doctor_per_day WHEN 'foto_diff' THEN foto_diff_per_day
           WHEN 'battle' THEN battle_per_day ELSE NULL END
    INTO v_limit FROM public.feature_limits WHERE tier='free';
  IF v_limit IS NULL OR v_limit = -1 THEN RETURN jsonb_build_object('allowed', true, 'unlimited', true); END IF;
  SELECT used INTO v_used FROM public.feature_usage
    WHERE user_id=v_uid AND feature=p_feature AND period_type='day' AND period_start=v_day;
  v_used := COALESCE(v_used, 0);
  RETURN jsonb_build_object('allowed', v_used < v_limit, 'used', v_used, 'limit', v_limit,
                            'remaining', GREATEST(0, v_limit - v_used), 'unlimited', false, 'period_end', v_next);
END $$;
REVOKE ALL ON FUNCTION public.fn_quota_peek(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_quota_peek(text) TO authenticated;

-- 5) Cleanup + Cron -------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_cleanup_feature_usage()
RETURNS int LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
  WITH d AS (DELETE FROM public.feature_usage
             WHERE period_start < ((now() AT TIME ZONE 'Europe/Zurich')::date - 35) RETURNING 1)
  SELECT count(*)::int FROM d;
$$;
REVOKE ALL ON FUNCTION public.fn_cleanup_feature_usage() FROM PUBLIC, anon, authenticated;
-- Cron (separat via execute_sql): cron.schedule('feature-usage-cleanup','30 4 * * 0', ...) jobid 14.

-- Verify (transaktional ROLLBACK): free → foto_diff 1/2/3 allowed, 4. blockiert; getrennte Buckets;
--   peek read-only (separates Statement sieht used korrekt); pro → unlimited ohne Increment.
