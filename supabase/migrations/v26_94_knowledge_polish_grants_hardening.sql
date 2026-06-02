-- v26.94 Grants-Hardening: Supabase ALTER DEFAULT PRIVILEGES grantet EXECUTE auto an anon.
-- Auth-only Funktionen self-guarden zwar auf auth.uid(), aber wir entziehen anon explizit
-- (analog v26.88 log_pick-Hardening) → advisor-sauber + least-privilege.
REVOKE EXECUTE ON FUNCTION public.fn_knowledge_bookmark_toggle(text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_knowledge_track_progress(text,text,int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_knowledge_bookmarks_list(int,int) FROM anon;
