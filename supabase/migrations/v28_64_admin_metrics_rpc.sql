-- ============================================================================
-- v28_64_admin_metrics_rpc — Block F.2: Admin-Metriken-RPC (LIVE-Spiegel).
-- Liefert Echtzeit-Kennzahlen fürs Admin-Dashboard als jsonb.
-- SECURITY DEFINER + interner is_admin_user()-Gate (HL#13) → nur Admins.
-- REVOKE FROM PUBLIC, anon + GRANT TO authenticated.
-- Aggregiert NUR über echte, verifizierte Spalten (HL#14):
--   • scan_events ist leer in Prod → user_scans als Scan-Quelle.
--   • profiles.last_login ist überall NULL → Aktivität via user_scans + updated_at.
--   • Error-Rate aus scan_events bewusst NICHT verwendet (immer 0) →
--     stattdessen echtes Signal stripe_webhook_events.error.
-- Verifiziert: grants {authenticated,postgres,service_role}, is_admin_user()-Gate
-- wirft 'forbidden' (42501) ohne auth.uid().
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_admin_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;
  SELECT jsonb_build_object(
    'users_total',         (SELECT count(*) FROM profiles),
    'users_new_7d',        (SELECT count(*) FROM profiles WHERE created_at >= now() - interval '7 days'),
    'users_new_30d',       (SELECT count(*) FROM profiles WHERE created_at >= now() - interval '30 days'),
    'tier_free',           (SELECT count(*) FROM profiles WHERE coalesce(is_lifetime,false)=false AND coalesce(tier,'free')='free'),
    'tier_pro',            (SELECT count(*) FROM profiles WHERE coalesce(is_lifetime,false)=false AND tier='pro'),
    'tier_lifetime',       (SELECT count(*) FROM profiles WHERE coalesce(is_lifetime,false)=true OR tier='lifetime'),
    'role_admin',          (SELECT count(*) FROM profiles WHERE role='admin'),
    'role_expert',         (SELECT count(*) FROM profiles WHERE role IN ('expert','staff')),
    'active_scanners_7d',  (SELECT count(DISTINCT user_id) FROM user_scans WHERE created_at >= now() - interval '7 days'),
    'active_scanners_30d', (SELECT count(DISTINCT user_id) FROM user_scans WHERE created_at >= now() - interval '30 days'),
    'active_profiles_7d',  (SELECT count(*) FROM profiles WHERE updated_at >= now() - interval '7 days'),
    'scans_total',         (SELECT count(*) FROM user_scans),
    'scans_7d',            (SELECT count(*) FROM user_scans WHERE created_at >= now() - interval '7 days'),
    'scans_30d',           (SELECT count(*) FROM user_scans WHERE created_at >= now() - interval '30 days'),
    'subs_active',         (SELECT count(*) FROM stripe_subscriptions WHERE status IN ('active','trialing')),
    'subs_trialing',       (SELECT count(*) FROM stripe_subscriptions WHERE status='trialing'),
    'subs_canceled',       (SELECT count(*) FROM stripe_subscriptions WHERE status IN ('canceled','incomplete_expired','unpaid')),
    'webhook_total_7d',    (SELECT count(*) FROM stripe_webhook_events WHERE created_at >= now() - interval '7 days'),
    'webhook_errors_7d',   (SELECT count(*) FROM stripe_webhook_events WHERE error IS NOT NULL AND created_at >= now() - interval '7 days'),
    'generated_at',        now()
  ) INTO r;
  RETURN r;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_admin_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_metrics() TO authenticated;
