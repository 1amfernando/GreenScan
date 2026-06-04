-- ============================================================================
-- v28_20_marketplace_view_security_invoker — Spiegel der LIVE-Migration (Block B).
-- v_marketplace_listings auf security_invoker → letzter Advisor-ERROR (security_definer_view)
-- behoben. SICHER: profiles hat RLS profiles_select_all=USING(true) (public-read) → Verkäufer-
-- Namen-JOIN funktioniert auch unter invoker; marketplace_listings-RLS (marketplace_select_active:
-- status<>'archived' OR own) wird jetzt autoritativ angewandt. Sichtbarkeit identisch
-- (View-WHERE: active/reserved/sold/null). Transaktional verifiziert (anon sieht aktives Inserat,
-- seller_name aufgelöst). Reines ALTER (View-Body unverändert).
-- ============================================================================
ALTER VIEW public.v_marketplace_listings SET (security_invoker = on);
