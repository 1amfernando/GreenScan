-- v30.80 Re-Fix: fn_assign_role EXECUTE-Grant Regression
-- Self-Audit-Sprint (Supabase Advisor Re-Scan 2026-06-30).
--
-- v26_51b hatte EXECUTE auf fn_assign_role von PUBLIC/anon/authenticated
-- revoked (admin-only Role-Assignment-RPC, sollte nur ueber service_role
-- laufen). Advisor-Re-Scan zeigt: authenticated kann die Funktion wieder
-- ausfuehren (vermutlich Default-Privileges nach einem CREATE OR REPLACE
-- in einer spaeteren Migration, die die Funktion neu angelegt hat).
--
-- Kein aktiver Exploit (Funktion prueft intern auth.uid()-Rolle = 'admin'
-- und wirft sonst eine Exception), aber Defense-in-Depth-Regression.
-- fn_cleanup_old_data + fn_set_global_api_key sind weiterhin korrekt
-- gesperrt — nur fn_assign_role betroffen.

REVOKE EXECUTE ON FUNCTION public.fn_assign_role FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_assign_role TO service_role;
