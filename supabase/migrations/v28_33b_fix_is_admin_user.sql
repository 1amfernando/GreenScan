-- v28.33b KRITISCHER FIX: is_admin_user() referenzierte die in v26.65 gedroppte Tabelle
-- legacy_profiles → warf bei JEDEM Aufruf "relation legacy_profiles does not exist".
-- Betraf 3 Admin-Policies (feedback_analysis_admin_read, weekly_challenges wc_admin_update/write)
-- — diese warfen bei Auswertung. Fix: legacy_profiles → profiles.is_admin (existiert, gesetzt) +
-- admin_emails-Whitelist behalten. coalesce(...,false) garantiert sauberen Boolean.
-- Verifiziert: anon=false (kein Throw), Nicht-Admin=false, Admin=true; feedback_analysis-Read ohne Error.
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
  select coalesce(
    exists (select 1 from profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    or
    ((select auth.jwt() ->> 'email') = any (
      string_to_array(coalesce((select value from app_settings where key='admin_emails'), ''), ',')
    ))
  , false);
$function$;
-- Grants bleiben Original (postgres, authenticated, service_role) — KEIN anon (Hard-Lesson #13).
