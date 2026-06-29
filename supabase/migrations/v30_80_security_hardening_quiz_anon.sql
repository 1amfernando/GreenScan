-- v30.80: Proaktiver Security-Audit (2026-06-29) — fn_quiz_record_answer anon-Zugriff entfernen
-- Supabase-Advisor (WARN): fn_quiz_record_answer war für anon-Role ausführbar.
-- Die Funktion hat zwar einen internen Guard (IF v_uid IS NULL THEN RETURN),
-- aber anon-EXECUTE-Grants auf Schreib-Funktionen sind unnötig und widersprechen
-- dem Least-Privilege-Prinzip. Das Quiz ist Login-pflichtig.
-- Risiko vorher: anon kann die Funktion aufrufen → no-op durch internen Guard → kein Schaden.
-- Nach dieser Migration: anon erhält sofort "permission denied" → Defense-in-depth.
REVOKE EXECUTE ON FUNCTION public.fn_quiz_record_answer(boolean, text) FROM anon;
