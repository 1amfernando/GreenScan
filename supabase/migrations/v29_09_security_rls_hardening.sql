-- ============ v29.09 Security RLS Hardening (Sweep #2) ============
-- Adversarial verifizierter Sweep #2 fand 4 RLS-Read-Leaks. Alle Fixes als echter
-- authenticated-JWT verifiziert: eigene Daten lesbar, fremde 0, sensible Spalten blockiert,
-- Social-Features (Discovery/Feed/Badges) intakt.

-- 1) profiles (P0): profiles_select_all USING(true) gab E-Mail-Adressen aller Nutzer cross-user
--    frei (sogar anon mit publishable key). SELECT auf eigene Zeile + admin beschränken.
DROP POLICY IF EXISTS profiles_select_all ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO public
  USING ((id = (SELECT auth.uid())) OR fn_is_role('admin'));

-- Discovery/Feed/Block-RPCs lesen Fremdprofile (kuratierte Spalten, KEIN email, Privacy-Filter
-- intern via profile_visibility/opt_in_feed) → SECURITY DEFINER, damit sie unter der verschärften
-- Policy weiter funktionieren. fn_quiz_leaderboard_upsert liest nur eigenes Profil → unverändert.
ALTER FUNCTION public.fn_user_search(text, integer) SECURITY DEFINER;
ALTER FUNCTION public.fn_user_discover(text, integer) SECURITY DEFINER;
ALTER FUNCTION public.fn_following_feed(integer) SECURITY DEFINER;
ALTER FUNCTION public.fn_blocked_list() SECURITY DEFINER;
-- HL#13: DEFINER + Default-anon-Grant wäre ein anon-Enumerations-Risiko → anon EXECUTE entziehen.
REVOKE EXECUTE ON FUNCTION public.fn_user_search(text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_user_discover(text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_following_feed(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_blocked_list() FROM anon;

-- 2) expert_verifications (P1): Stripe-Payment-Intent-IDs + Gebühren cross-user lesbar.
--    Column-level: Tabellen-SELECT entziehen, nur Nicht-sensible Badge-Spalten neu granten
--    (Tabellen-Grant würde sonst column-REVOKE überstimmen). v_social_posts_with_verifications
--    (security_invoker) liest nur post_id+status → öffentliche Verifikations-Badges bleiben intakt.
REVOKE SELECT ON public.expert_verifications FROM anon, authenticated;
GRANT SELECT (id, post_id, expert_id, status, verification_text, created_at, updated_at)
  ON public.expert_verifications TO anon, authenticated;

-- 3) user_species (P2): gescannte Arten + data-jsonb weltlesbar → SELECT auf eigene Zeile
--    (analog user_scans/user_plants).
DROP POLICY IF EXISTS user_species_select_all ON public.user_species;
CREATE POLICY user_species_select_own ON public.user_species
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 4) vouchers (P3, latent/0 Zeilen): vouchers_select_auth USING(true) erlaubte Enumeration aller
--    Gutschein-Codes. Public-SELECT entziehen; vouchers_admin_write (ALL, is_admin_user()) deckt
--    Admin-SELECT ab. Echte Einlösung später über SECURITY-DEFINER-RPC fn_redeem_voucher
--    (Follow-up, sobald Vouchers angelegt werden — der Code darf nie an den Client zurück).
DROP POLICY IF EXISTS vouchers_select_auth ON public.vouchers;
