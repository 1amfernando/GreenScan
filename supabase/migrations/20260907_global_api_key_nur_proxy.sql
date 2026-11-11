-- ══════════════════════════════════════════════════════════════════════════
-- v32.68 · DER GLOBALE ANTHROPIC-SCHLÜSSEL VERLÄSST DEN SERVER NICHT MEHR
--          (Audit A1 — docs/PROFESSIONALITAET-AUDIT-2026-09-06.md)
-- ══════════════════════════════════════════════════════════════════════════
--
-- BEFUND (live gelesen, 06.09.2026):
--   `fn_get_global_api_key()` gab den echten sk-ant-Schlüssel an JEDEN
--   angemeldeten, nicht gesperrten Nutzer. Die App schrieb ihn nach
--   localStorage und rief api.anthropic.com direkt aus dem Browser. Jeder
--   Nutzer, jede Browser-Erweiterung und jeder XSS-Fund konnte ihn lesen und
--   auf Fernandos Rechnung nutzen. Der Server-Proxy `ai-proxy` (verify_jwt,
--   Tier-Quota, Schlüssel aus app_settings per service_role) ist seit Juni
--   ausgeliefert — und wurde nie benutzt: `ai_usage` hat 0 Zeilen, das
--   Frontend hielt ihn hinter einem Flag mit Vorgabe „aus".
--
-- REIHENFOLGE (docs/FUER-FERNANDO.md §8) — DIESE DATEI IST SCHRITT 3:
--   1. v32.68 ist live: die App ruft den Proxy ZUERST, legt den Schlüssel
--      nicht mehr auf die Platte (nur Arbeitsspeicher) und fällt nur solange
--      auf den Direktweg zurück, wie der Server ihr noch einen Schlüssel
--      gibt — also bis zu dieser Datei.
--   2. Einmal eine KI-Funktion benutzen und `select count(*) from ai_usage`
--      ansehen: > 0 heisst, der Proxy funktioniert produktiv.
--   3. Diese Datei anwenden. Danach bekommt kein Nutzer den Schlüssel mehr;
--      Admins bekommen ihn weiter (Schlüssel-Test im Admin-Panel, Health-
--      Check) — der Admin-Browser ist ohnehin der Ort, der ihn eintippt.
--
-- Antwortformat (App liest `enabled`, `mode`, `key`, `provider`):
--   { enabled:false, reason:'not_authenticated'|'not_configured'|'banned' }
--   { enabled:true,  mode:'proxy', provider:'anthropic' }                — Nutzer
--   { enabled:true,  mode:'proxy', provider:'anthropic', key:'sk-ant-…' } — Admin
--
-- Rückweg, falls der Proxy im Betrieb versagt: die Funktion aus
-- v26_xx (`RETURN jsonb_build_object('enabled', true, 'key', _key, …)`)
-- wieder einspielen — die App versteht beide Antworten. Idempotent.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_get_global_api_key()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  _enabled text;
  _key text;
  _provider text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('enabled', false, 'reason', 'not_authenticated'); END IF;
  SELECT value INTO _enabled  FROM public.app_settings WHERE key='global_api_enabled';
  SELECT value INTO _key      FROM public.app_settings WHERE key='global_anthropic_api_key';
  SELECT value INTO _provider FROM public.app_settings WHERE key='global_api_provider';
  IF _enabled IS NULL OR _enabled = 'false' OR _key IS NULL OR length(_key) < 10 THEN
    RETURN jsonb_build_object('enabled', false, 'reason', 'not_configured');
  END IF;
  -- Gesperrte bekommen nichts — auch keinen Proxy.
  IF public.fn_user_role(auth.uid()) = 'banned' THEN
    RETURN jsonb_build_object('enabled', false, 'reason', 'banned');
  END IF;
  -- v32.68: Nur Admins sehen den Schlüssel (Schlüssel-Test, Health-Check im
  -- Admin-Panel). Alle anderen erfahren nur, dass der Proxy bereitsteht.
  IF public.is_admin_user() THEN
    RETURN jsonb_build_object('enabled', true, 'mode', 'proxy', 'key', _key, 'provider', COALESCE(_provider, 'anthropic'));
  END IF;
  RETURN jsonb_build_object('enabled', true, 'mode', 'proxy', 'provider', COALESCE(_provider, 'anthropic'));
END; $function$;

COMMENT ON FUNCTION public.fn_get_global_api_key() IS
  'v32.68: sagt der App, ob die KI bereitsteht (mode=proxy). Den Schlüssel selbst bekommen nur Admins — Nutzer rufen die Edge-Function ai-proxy, die ihn serverseitig hält (Audit A1).';

REVOKE EXECUTE ON FUNCTION public.fn_get_global_api_key() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.fn_get_global_api_key() TO authenticated;

COMMIT;
