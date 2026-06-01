-- v26.76 — search_path auf den 4 EIGENEN public-Funktionen pinnen
-- Advisor: function_search_path_mutable. Alle 4 sind security_definer=false
-- (low-risk), aber das Pinnen entfernt den Lint und verhindert
-- search_path-Injection. Extension-Funktionen (pgvector/citext/pg_trgm) werden
-- bewusst NICHT angefasst (kein eigener Code).

ALTER FUNCTION public.fn_mkt_chat_mark_read(uuid, uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.fn_quiz_leaderboard_top(integer)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.fn_quiz_leaderboard_upsert(integer, integer, integer, integer, text)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.trg_set_updated_at()
  SET search_path = public, pg_temp;
