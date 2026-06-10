-- v28.98 P0-SECURITY-FIX (2026-06-10): app_settings_select hatte USING(true) ->
-- JEDER (anon-Key reichte) konnte ALLE Secrets lesen: global_anthropic_api_key,
-- vapid_private_key, stripe_webhook_secret, push_cron_secret. Live verifiziert
-- (REST-Call mit publishable key lieferte alle 10 Zeilen inkl. sk-ant-Key).
-- Fix: SELECT nur noch fuer authenticated + nur 4 nicht-sensible Keys (+ flag_*
-- via v28_98_admin_tier_and_flags). Edge-Fns nutzen service_role (RLS-Bypass).
-- !! FERNANDO MUSS ROTIEREN: Anthropic-Key, VAPID-Paar, stripe_webhook_secret,
-- push_cron_secret (waren oeffentlich abrufbar).
DROP POLICY IF EXISTS app_settings_select ON public.app_settings;
CREATE POLICY app_settings_select_public_keys ON public.app_settings
  FOR SELECT TO authenticated
  USING (key IN ('vapid_public_key','stripe_publishable_key','global_api_enabled','global_api_provider'));
