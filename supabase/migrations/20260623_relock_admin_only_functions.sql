-- Re-apply REVOKE for admin-only SECURITY DEFINER functions
-- Subsequent migrations recreated fn_assign_role and fn_set_global_api_key,
-- resetting their grants to PUBLIC (default). This migration re-locks them.
-- Original intent: v26_51b_lock_admin_only_functions.sql (2026-05-24)

REVOKE EXECUTE ON FUNCTION public.fn_assign_role(_user_id uuid, _role text, _note text)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_set_global_api_key(_key text, _provider text, _enabled boolean)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_assign_role(_user_id uuid, _role text, _note text)
  TO service_role;

GRANT EXECUTE ON FUNCTION public.fn_set_global_api_key(_key text, _provider text, _enabled boolean)
  TO service_role;
