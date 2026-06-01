-- v26.76 — Security-Advisor ERROR-Fixes (4 ERRORs → 0)
-- Quelle: Supabase get_advisors(security) nach v26.75.
--
-- Problem 1: 3 Views liefen als SECURITY DEFINER (security_definer_view).
--   SECURITY-DEFINER-Views umgehen die RLS des Aufrufers und laufen mit den
--   Rechten des View-Owners → Daten-Leak-Risiko. Fix: security_invoker=true,
--   damit die View die RLS-Policies des aufrufenden Users respektiert.
--
-- Problem 2: v_user_engagement_summary selektierte auth.users.email und war an
--   anon + authenticated granted (auth_users_exposed). Fix: GRANT entzogen —
--   die View ist rein Admin-/Service-Role-intern.

ALTER VIEW public.v_harvest_stats_yearly      SET (security_invoker = true);
ALTER VIEW public.v_plant_care_due            SET (security_invoker = true);
ALTER VIEW public.v_user_engagement_summary   SET (security_invoker = true);

REVOKE ALL ON public.v_user_engagement_summary FROM anon, authenticated;
