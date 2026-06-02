-- v26.94 Knowledge-DB Polish — Bookmarks, Reading-Progress, Related, "Heute neu", bookmark-aware Search
-- ARCHITEKTUR-REALITÄT (verifiziert via information_schema 2026-06-02):
--   Es gibt KEINE Tabelle knowledge_articles (Spec-Annahme falsch).
--   Wissen lebt in 5 Tabellen, vereint via VIEW public.v_knowledge_search
--   (UNION ALL: species | recipes | remedies | folk_lore | garden_techniques).
--   Identität eines Eintrags = COMPOSITE (source_type text, source_id text).
--   FTS/Fuzzy existiert bereits via fn_knowledge_search(q,lim) (pg_trgm).
--   Offline-Reading existiert bereits (Frontend IndexedDB gsKnowledgePull/Search).
-- → Bookmarks/Progress auf Composite-Key, KEIN FK auf eine Einzeltabelle.

-- 1) Bookmarks (Composite-Key)
CREATE TABLE IF NOT EXISTS public.knowledge_bookmarks (
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type   text NOT NULL,
  source_id     text NOT NULL,
  bookmarked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, source_type, source_id)
);
ALTER TABLE public.knowledge_bookmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS knowledge_bm_own ON public.knowledge_bookmarks;
CREATE POLICY knowledge_bm_own ON public.knowledge_bookmarks
  FOR ALL USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_bm_user_at
  ON public.knowledge_bookmarks (user_id, bookmarked_at DESC);

-- 2) Reading-Progress (Composite-Key) — Foundation für "Weiterlesen"
CREATE TABLE IF NOT EXISTS public.knowledge_progress (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type  text NOT NULL,
  source_id    text NOT NULL,
  scroll_pct   smallint NOT NULL DEFAULT 0 CHECK (scroll_pct BETWEEN 0 AND 100),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  read_count   int NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, source_type, source_id)
);
ALTER TABLE public.knowledge_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS knowledge_pr_own ON public.knowledge_progress;
CREATE POLICY knowledge_pr_own ON public.knowledge_progress
  FOR ALL USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_pr_user_at
  ON public.knowledge_progress (user_id, last_read_at DESC);

-- 3) Toggle-Bookmark RPC → returns new state (true=bookmarked)
CREATE OR REPLACE FUNCTION public.fn_knowledge_bookmark_toggle(p_source_type text, p_source_id text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_source_type IS NULL OR p_source_id IS NULL THEN RAISE EXCEPTION 'missing args'; END IF;
  DELETE FROM public.knowledge_bookmarks
   WHERE user_id = v_uid AND source_type = p_source_type AND source_id = p_source_id;
  IF FOUND THEN
    RETURN false;  -- war gebookmarkt → jetzt entfernt
  END IF;
  INSERT INTO public.knowledge_bookmarks (user_id, source_type, source_id)
  VALUES (v_uid, p_source_type, p_source_id)
  ON CONFLICT DO NOTHING;
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.fn_knowledge_bookmark_toggle(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_knowledge_bookmark_toggle(text,text) TO authenticated;

-- 4) Bookmarks-List RPC → joins back to v_knowledge_search for full cards
CREATE OR REPLACE FUNCTION public.fn_knowledge_bookmarks_list(p_limit int DEFAULT 50, p_offset int DEFAULT 0)
RETURNS TABLE (source_type text, source_id text, title text, subtitle text, body text, icon text, bookmarked_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_catalog AS $$
  SELECT v.source_type, v.source_id, v.title, v.subtitle,
         SUBSTRING(v.body FROM 1 FOR 300) AS body, v.icon, b.bookmarked_at
  FROM public.knowledge_bookmarks b
  JOIN public.v_knowledge_search v
    ON v.source_type = b.source_type AND v.source_id = b.source_id
  WHERE b.user_id = (SELECT auth.uid())
  ORDER BY b.bookmarked_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 200)) OFFSET GREATEST(0, p_offset);
$$;
REVOKE EXECUTE ON FUNCTION public.fn_knowledge_bookmarks_list(int,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_knowledge_bookmarks_list(int,int) TO authenticated;

-- 5) "Heute neu" — neueste redaktionelle Einträge (species ausgeschlossen)
CREATE OR REPLACE FUNCTION public.fn_knowledge_recent(p_limit int DEFAULT 8)
RETURNS TABLE (source_type text, source_id text, title text, subtitle text, body text, icon text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT v.source_type, v.source_id, v.title, v.subtitle,
         SUBSTRING(v.body FROM 1 FOR 200) AS body, v.icon, v.created_at
  FROM public.v_knowledge_search v
  WHERE v.source_type <> 'species'
  ORDER BY v.created_at DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(p_limit, 30));
$$;
GRANT EXECUTE ON FUNCTION public.fn_knowledge_recent(int) TO anon, authenticated;

-- 6) Related RPC — gleicher source_type Bonus + Trigram auf Titel + word_similarity
CREATE OR REPLACE FUNCTION public.fn_knowledge_related(p_source_type text, p_source_id text, p_limit int DEFAULT 4)
RETURNS TABLE (source_type text, source_id text, title text, subtitle text, icon text, similarity real)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  WITH src AS (
    SELECT source_type AS st, title AS ti, coalesce(search_text,'') AS sx
    FROM public.v_knowledge_search
    WHERE source_type = p_source_type AND source_id = p_source_id
    LIMIT 1
  )
  SELECT v.source_type, v.source_id, v.title, v.subtitle, v.icon,
    (
      (CASE WHEN v.source_type = (SELECT st FROM src) THEN 0.25 ELSE 0 END)
      + similarity(coalesce(v.title,''), (SELECT coalesce(ti,'') FROM src))
      + word_similarity((SELECT coalesce(ti,'') FROM src), coalesce(v.search_text,'')) * 0.4
    )::real AS similarity
  FROM public.v_knowledge_search v
  WHERE NOT (v.source_type = p_source_type AND v.source_id = p_source_id)
    AND (SELECT st FROM src) IS NOT NULL
  ORDER BY similarity DESC
  LIMIT GREATEST(1, LEAST(p_limit, 12));
$$;
GRANT EXECUTE ON FUNCTION public.fn_knowledge_related(text,text,int) TO anon, authenticated;

-- 7) Track-Progress RPC (Foundation — Frontend feuert beim Öffnen eines Treffers)
CREATE OR REPLACE FUNCTION public.fn_knowledge_track_progress(p_source_type text, p_source_id text, p_scroll_pct int DEFAULT 1)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_uid uuid := (SELECT auth.uid()); v_pct smallint := GREATEST(0, LEAST(100, coalesce(p_scroll_pct,1)))::smallint;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  IF p_source_type IS NULL OR p_source_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.knowledge_progress (user_id, source_type, source_id, scroll_pct, last_read_at)
  VALUES (v_uid, p_source_type, p_source_id, v_pct, now())
  ON CONFLICT (user_id, source_type, source_id) DO UPDATE
    SET scroll_pct = GREATEST(public.knowledge_progress.scroll_pct, EXCLUDED.scroll_pct),
        last_read_at = now(),
        read_count = public.knowledge_progress.read_count + 1;
END $$;
REVOKE EXECUTE ON FUNCTION public.fn_knowledge_track_progress(text,text,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_knowledge_track_progress(text,text,int) TO authenticated;

-- 8) Bookmark-aware Search v2 (additiv; alte fn_knowledge_search bleibt für Offline-Hook unangetastet)
CREATE OR REPLACE FUNCTION public.fn_knowledge_search2(p_q text, p_lim int DEFAULT 30)
RETURNS TABLE (source_type text, source_id text, title text, subtitle text, body text, icon text, similarity real, is_bookmarked boolean, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT
    v.source_type, v.source_id, v.title, v.subtitle,
    SUBSTRING(v.body FROM 1 FOR 300) AS body, v.icon,
    GREATEST(
      similarity(coalesce(v.title,''), p_q) * 2.0,
      similarity(coalesce(v.search_text,''), p_q)
    )::real AS similarity,
    EXISTS (
      SELECT 1 FROM public.knowledge_bookmarks b
      WHERE b.user_id = (SELECT auth.uid())
        AND b.source_type = v.source_type AND b.source_id = v.source_id
    ) AS is_bookmarked,
    v.created_at
  FROM public.v_knowledge_search v
  WHERE coalesce(v.search_text,'') ILIKE '%' || p_q || '%'
     OR similarity(coalesce(v.title,''), p_q) > 0.2
     OR similarity(coalesce(v.search_text,''), p_q) > 0.15
  ORDER BY similarity DESC
  LIMIT GREATEST(1, LEAST(p_lim, 100));
$$;
GRANT EXECUTE ON FUNCTION public.fn_knowledge_search2(text,int) TO anon, authenticated;
