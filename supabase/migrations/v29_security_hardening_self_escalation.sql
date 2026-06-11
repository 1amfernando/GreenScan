-- ============ Security-Härtung: Self-Escalation / Badge-Spoofing / Policy-Funktions-Grants ============
-- (Backend-only, kein App-v-Bump.) Aus der „stärke alles"-Red-Team-Runde — 3 Klassen-Funde, alle als
-- echter authenticated/anon-JWT verifiziert (Escalation blockiert, legitime Pfade intakt):

-- ── (1) KRITISCH: profiles Self-Escalation ──────────────────────────────────────────────────────
-- profiles_update-Policy erlaubt (auth.uid()=id) ohne Spalten-Restriktion → JEDER Nutzer konnte sein
-- eigenes Row patchen und tier='lifetime' (Gratis-Pro/Lifetime, Umsatz-Bypass) ODER is_admin=true
-- (Selbst-Beförderung zum Admin → volle Privilege-Escalation) setzen. RLS ist row-, nicht column-level.
-- Fix: BEFORE-UPDATE-Guard-Trigger. WICHTIG: SECURITY INVOKER (nicht DEFINER!), sonst wäre current_user
-- im Trigger der Owner statt 'authenticated' und die Bedingung griffe nie. INVOKER → current_user=
-- 'authenticated' beim Direkt-Patch (blockieren), 'postgres' innerhalb DEFINER-Funktionen wie
-- fn_redeem_voucher/fn_admin_set_tier (erlauben), service_role beim Stripe-Webhook (erlauben).
CREATE OR REPLACE FUNCTION public.fn_profiles_guard_protected()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('authenticated','anon') AND NOT coalesce(is_admin_user(), false) THEN
    IF NEW.tier IS DISTINCT FROM OLD.tier
       OR NEW.is_admin IS DISTINCT FROM OLD.is_admin
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.is_expert IS DISTINCT FROM OLD.is_expert
       OR NEW.is_lifetime IS DISTINCT FROM OLD.is_lifetime
       OR NEW.role_assigned_by IS DISTINCT FROM OLD.role_assigned_by
       OR NEW.role_assigned_at IS DISTINCT FROM OLD.role_assigned_at
    THEN RAISE EXCEPTION 'protected_column_change_denied' USING ERRCODE='insufficient_privilege'; END IF;
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS trg_profiles_guard_protected ON public.profiles;
CREATE TRIGGER trg_profiles_guard_protected BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_profiles_guard_protected();

-- ── (2) Badge-Spoofing: social_posts/post_comments.role ─────────────────────────────────────────
-- role ist das Feed-Badge (gsRoleBadge). User konnten beim INSERT (social_posts auch UPDATE)
-- role='admin'/'expert' setzen → Fake-Badge/Impersonation (Safety-Risiko bei Experten-Pflanzenrat).
-- Fix: role IMMER auf die echte Rolle des Autors (profiles[user_id]) zwingen → Badge stets wahr.
CREATE OR REPLACE FUNCTION public.fn_force_author_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  NEW.role := (SELECT role FROM profiles WHERE id = NEW.user_id);
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS trg_force_author_role ON public.social_posts;
CREATE TRIGGER trg_force_author_role BEFORE INSERT OR UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.fn_force_author_role();
DROP TRIGGER IF EXISTS trg_force_author_role_c ON public.post_comments;
CREATE TRIGGER trg_force_author_role_c BEFORE INSERT OR UPDATE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.fn_force_author_role();

-- ── (3) marketplace_sellers.status (Stripe-Connect-Onboarding) nicht selbst setzbar ─────────────
CREATE OR REPLACE FUNCTION public.fn_mkt_seller_status_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('authenticated','anon') AND NOT coalesce(is_admin_user(), false) THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'seller_status_change_denied' USING ERRCODE='insufficient_privilege'; END IF;
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS trg_mkt_seller_status_guard ON public.marketplace_sellers;
CREATE TRIGGER trg_mkt_seller_status_guard BEFORE UPDATE ON public.marketplace_sellers
  FOR EACH ROW EXECUTE FUNCTION public.fn_mkt_seller_status_guard();

-- ── (4) anon EXECUTE auf Rollen-Helfer (sonst harter Fehler statt Deny) ─────────────────────────
-- profiles_select_own [v29.09] + quests_select_all (TO public) rufen DEFINER-Helfer fn_is_role/
-- fn_role_at_least; anon hatte kein EXECUTE → anon-SELECT warf 'permission denied for function ...'.
-- Helfer sind DEFINER und liefern für unauth. false → anon EXECUTE unbedenklich (kein Leak), Policy
-- wertet für anon sauber zu 'deny' aus.
GRANT EXECUTE ON FUNCTION public.fn_is_role(text, uuid)       TO anon;
GRANT EXECUTE ON FUNCTION public.fn_role_at_least(text, uuid) TO anon;
