-- v26.98 Grants-Hardening: ALTER DEFAULT PRIVILEGES grantet EXECUTE auto an anon.
-- Beide RPCs sind auth-only (schreiben/lesen own-data) → anon explizit revoken.
REVOKE EXECUTE ON FUNCTION public.fn_photo_diff_create(text,text,text,timestamptz,timestamptz,jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_photo_diff_list(text,integer) FROM anon;
