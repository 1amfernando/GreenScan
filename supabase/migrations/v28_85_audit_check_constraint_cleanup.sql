-- v28-Audit Sprint D: stale/obsolete CHECK-Enums bereinigt (alle gegen Bestandsdaten verifiziert).
-- profiles.tier: 'plus'/'premium'/'basic' raus (0 Zeilen; Mission=free/pro/lifetime; profiles.tier wird
--   nie direkt vom Webhook geschrieben — Quelle stripe_products.tier={pro} via trg_stripe_subs_sync_profile).
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_tier_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_tier_check
  CHECK (tier = ANY (ARRAY['free','pro','lifetime']));
-- organizations.subscription_tier: gestrichene v28-School/Garden-Tiers raus (0 Zeilen, nur 'free';
--   'botanical_garden' ist org_type, separate Spalte).
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_subscription_tier_check;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_subscription_tier_check
  CHECK (subscription_tier = ANY (ARRAY['free']));
-- i18n_translations: totes 'gsw' (obsolet seit v26.65, 0 Zeilen) aus beiden CHECKs raus.
ALTER TABLE public.i18n_translations DROP CONSTRAINT IF EXISTS i18n_translations_target_lang_check;
ALTER TABLE public.i18n_translations ADD CONSTRAINT i18n_translations_target_lang_check
  CHECK (target_lang = ANY (ARRAY['de','fr','it','en','es']));
ALTER TABLE public.i18n_translations DROP CONSTRAINT IF EXISTS i18n_translations_source_lang_check;
ALTER TABLE public.i18n_translations ADD CONSTRAINT i18n_translations_source_lang_check
  CHECK (source_lang = ANY (ARRAY['de','fr','it','en','es']));
