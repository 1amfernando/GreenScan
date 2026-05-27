-- v26.51b Lock admin-only SECURITY DEFINER Functions
-- Sub-Migration zu v26_51_backend_security_hardening — gehört zum Pentagon
-- Self-Audit-Sprint.
--
-- Pre-Fix: fn_assign_role, fn_cleanup_old_data, fn_set_global_api_key,
-- is_admin_user waren für anon + authenticated callable. Admin-Only-Functions
-- sollten nur über service_role (Edge-Fns/Backend) callable sein.

REVOKE EXECUTE ON FUNCTION public.fn_assign_role FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_cleanup_old_data FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_set_global_api_key FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_user FROM PUBLIC, anon;
-- is_admin_user darf für authenticated bleiben (Frontend checkt eigene Rolle)

GRANT EXECUTE ON FUNCTION public.fn_assign_role TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_cleanup_old_data TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_set_global_api_key TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_user TO service_role;
