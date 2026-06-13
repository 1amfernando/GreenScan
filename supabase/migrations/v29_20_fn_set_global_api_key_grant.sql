-- ============ v29.20 D5: fn_set_global_api_key authenticated-EXECUTE-Grant ============
-- (Backend-Teil der Fernando-Fixes.) Befund D5 (P1): Der In-App-Admin-„Globaler Key speichern"-Button
-- (gsAdminSetGlobalApiKey → POST /rpc/fn_set_global_api_key) schlug für JEDEN fehl — auch für Admins —
-- weil dem RPC der EXECUTE-Grant für die Rolle authenticated fehlte (nur postgres/service_role). Admins
-- sind Rolle 'authenticated' mit is_admin-Flag → permission denied for function, bevor der interne
-- Admin-Check greift. Der Key liess sich nur via Dashboard/Service-Role setzen.
-- Fix: authenticated-Grant. Sicher, weil der RPC sich INTERN bereits absichert
-- (SECURITY DEFINER + 'IF NOT fn_is_role(''admin'') THEN RAISE EXCEPTION ''Only admins can set global API key''').
-- Verifiziert als echter JWT: authenticated hat jetzt EXECUTE; Nicht-Admin-Aufruf → Exception (kein Clobber).
GRANT EXECUTE ON FUNCTION public.fn_set_global_api_key(text, text, boolean) TO authenticated;
