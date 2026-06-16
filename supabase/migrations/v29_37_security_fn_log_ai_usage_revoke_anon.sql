-- v29.37: Revoke anon EXECUTE from fn_log_ai_usage
-- Anon callers could inject fake AI cost records into ai_daily_usage (admin dashboard).
-- The function is only legitimately called from Edge Functions (service_role) and
-- the admin panel (authenticated). Anon access has no valid use-case.
REVOKE EXECUTE ON FUNCTION fn_log_ai_usage(text, integer, integer, numeric, text) FROM anon;
