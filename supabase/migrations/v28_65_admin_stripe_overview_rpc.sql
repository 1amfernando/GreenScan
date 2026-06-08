-- ============================================================================
-- v28_65_admin_stripe_overview_rpc — Block F.2: Admin-Stripe-Übersicht (LIVE-Spiegel).
-- Internes Finanz-Monitoring (Mission „Kostendeckung im Auge behalten").
-- SECURITY DEFINER + interner is_admin_user()-Gate (HL#13) + REVOKE/GRANT.
-- MRR robust direkt aus stripe_subscriptions JOIN stripe_prices (price_id→id),
-- da v_admin_subscriptions in Prod leer ist (Join greift nicht für trialing — HL#14).
--   monatlich = unit_amount · jährlich = /12 · lifetime = 0 (nicht wiederkehrend).
--   Nur status='active' zählt für MRR (trialing = noch nicht zahlend, separat ausgewiesen).
-- Verifiziert: grants {authenticated,postgres,service_role} (kein anon/PUBLIC);
-- Dry-Run mrr=0 (nur 1 Trial-Abo), Katalog Pro 790 / Lifetime 4560 / Yearly 7900 chf.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_admin_stripe_overview()
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
    'currency', (SELECT lower(coalesce(max(currency),'chf')) FROM stripe_prices),
    'mrr_cents', (
      SELECT coalesce(sum(
        CASE WHEN p.lookup_key ILIKE '%year%' THEN round(p.unit_amount/12.0)
             WHEN p.lookup_key ILIKE '%lifetime%' THEN 0
             ELSE p.unit_amount END
      ),0)
      FROM stripe_subscriptions s JOIN stripe_prices p ON p.id = s.price_id
      WHERE s.status = 'active'
    ),
    'subs_total',          (SELECT count(*) FROM stripe_subscriptions),
    'subs_active',         (SELECT count(*) FROM stripe_subscriptions WHERE status='active'),
    'subs_trialing',       (SELECT count(*) FROM stripe_subscriptions WHERE status='trialing'),
    'subs_past_due',       (SELECT count(*) FROM stripe_subscriptions WHERE status IN ('past_due','unpaid','incomplete')),
    'subs_canceled',       (SELECT count(*) FROM stripe_subscriptions WHERE status IN ('canceled','incomplete_expired')),
    'pro_active',          (SELECT count(*) FROM stripe_subscriptions WHERE status='active' AND coalesce(is_lifetime,false)=false),
    'lifetime_total',      (SELECT count(*) FROM stripe_subscriptions WHERE coalesce(is_lifetime,false)=true),
    'cancel_at_period_end',(SELECT count(*) FROM stripe_subscriptions WHERE coalesce(cancel_at_period_end,false)=true AND status IN ('active','trialing')),
    'catalog', (SELECT jsonb_agg(jsonb_build_object('key',lookup_key,'amount',unit_amount,'cur',currency) ORDER BY unit_amount) FROM stripe_prices),
    'webhook_total',       (SELECT count(*) FROM stripe_webhook_events),
    'webhook_errors',      (SELECT count(*) FROM stripe_webhook_events WHERE error IS NOT NULL),
    'webhook_unprocessed', (SELECT count(*) FROM stripe_webhook_events WHERE processed=false),
    'webhook_last_at',     (SELECT max(created_at) FROM stripe_webhook_events),
    'recent_webhooks', (SELECT coalesce(jsonb_agg(w ORDER BY (w->>'created_at') DESC),'[]'::jsonb) FROM (
                          SELECT jsonb_build_object('type',type,'processed',processed,'error',error,'created_at',created_at) AS w
                          FROM stripe_webhook_events ORDER BY created_at DESC LIMIT 8) sub),
    'generated_at', now()
  ) INTO r;
  RETURN r;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_admin_stripe_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_stripe_overview() TO authenticated;
