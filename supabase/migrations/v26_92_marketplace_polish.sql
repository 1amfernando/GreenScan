-- ============================================================================
-- Migration: v26_92_marketplace_polish
-- Sprint:    v26.92 — Marktplatz-Politur (Phase 4, isoliert)
-- Datum:     2026-06-02
-- Zweck:     Status-Verwaltung (active/reserved/sold/archived), FTS-Server-Suche,
--            Preisfilter-Support, sold→30d Auto-Archiv.
--
-- ARCHITEKTUR-REALITAET (Hard-Lesson #8): Marketplace war bereits weit gebaut.
--   - Spec-Annahme lat/lng-Spalten existieren NICHT  → Distanz bleibt region-basiert.
--   - Kanonischer Status ist 'active' (NICHT 'available' wie Spec annahm).
--   - Profil-Felder real: display_name / is_expert / tier / level (kein full_name/role).
-- Diese Datei spiegelt den LIVE applizierten Stand (pg_get_functiondef/viewdef).
-- ============================================================================

-- 1) sold_at-Spalte (additiv) -------------------------------------------------
ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS sold_at timestamptz;

-- 2) GIN-Index fuer deutsche Volltextsuche (Titel + Beschreibung) -------------
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_fts_de
  ON public.marketplace_listings
  USING gin (to_tsvector('german', coalesce(title,'') || ' ' || coalesce(description,'')));

-- 3) VIEW v_marketplace_listings neu (sold_at angehaengt, status-Whitelist) ---
CREATE OR REPLACE VIEW public.v_marketplace_listings AS
 SELECT m.id,
    m.user_id,
    m.title,
    m.description,
    m.category,
    m.price,
    m.currency,
    m.region,
    m.contact,
    m.photo_url,
    m.photo_urls,
    m.price_mode,
    m.status,
    m.views,
    m.reports,
    m.data,
    m.created_at,
    m.updated_at,
    COALESCE(p.display_name, split_part(p.email, '@'::citext, 1), 'Anonym'::text) AS seller_name,
    p.avatar_emoji AS seller_avatar,
    p.is_expert AS seller_is_expert,
    COALESCE(p.tier = ANY (ARRAY['plus'::text, 'pro'::text, 'plus_lifetime'::text]), false) AS seller_is_premium,
    COALESCE(p.level, 1) AS seller_level,
    m.sold_at
   FROM public.marketplace_listings m
     LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE (m.status = ANY (ARRAY['active'::text, 'reserved'::text, 'sold'::text])) OR m.status IS NULL;

-- 4) RPC fn_marketplace_set_status — Owner-Guard + sold_at-Logik --------------
CREATE OR REPLACE FUNCTION public.fn_marketplace_set_status(p_listing_id uuid, p_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_owner uuid; v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  IF p_status NOT IN ('active','reserved','sold','archived') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;
  SELECT user_id INTO v_owner FROM public.marketplace_listings WHERE id = p_listing_id;
  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_owner <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  UPDATE public.marketplace_listings
     SET status = p_status,
         sold_at = CASE WHEN p_status = 'sold' THEN COALESCE(sold_at, now())
                        WHEN p_status = 'active' THEN NULL
                        ELSE sold_at END,
         updated_at = now()
   WHERE id = p_listing_id;
  RETURN jsonb_build_object('ok', true, 'id', p_listing_id, 'status', p_status);
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_marketplace_set_status(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_marketplace_set_status(uuid, text) TO authenticated;

-- 5) RPC fn_marketplace_search — deutsche FTS + Filter (nur status='active') --
CREATE OR REPLACE FUNCTION public.fn_marketplace_search(
    p_query text DEFAULT ''::text,
    p_category text DEFAULT NULL::text,
    p_region text DEFAULT NULL::text,
    p_price_min numeric DEFAULT NULL::numeric,
    p_price_max numeric DEFAULT NULL::numeric,
    p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, user_id uuid, title text, description text, category text,
    price numeric, currency text, region text, contact text, photo_url text,
    photo_urls text[], price_mode text, status text, views integer, reports integer,
    created_at timestamp with time zone, updated_at timestamp with time zone,
    sold_at timestamp with time zone, organic_certified boolean, pesticide_free boolean,
    certification_label text, allow_online_payment boolean, contact_method text,
    seller_name text, seller_avatar text, seller_is_expert boolean,
    seller_is_premium boolean, seller_level integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_q text := nullif(btrim(coalesce(p_query,'')), '');
        v_ts tsquery;
BEGIN
  IF v_q IS NOT NULL AND length(v_q) >= 2 THEN
    BEGIN v_ts := websearch_to_tsquery('german', v_q); EXCEPTION WHEN others THEN v_ts := NULL; END;
  END IF;
  RETURN QUERY
  SELECT m.id, m.user_id, m.title, m.description, m.category, m.price, m.currency,
         m.region, m.contact, m.photo_url, m.photo_urls, m.price_mode, m.status,
         m.views, m.reports, m.created_at, m.updated_at, m.sold_at,
         m.organic_certified, m.pesticide_free, m.certification_label,
         m.allow_online_payment, m.contact_method,
         COALESCE(p.display_name, split_part(p.email,'@'::citext,1), 'Anonym') AS seller_name,
         p.avatar_emoji AS seller_avatar,
         p.is_expert AS seller_is_expert,
         COALESCE(p.tier = ANY (ARRAY['plus','pro','plus_lifetime']), false) AS seller_is_premium,
         COALESCE(p.level, 1) AS seller_level
    FROM public.marketplace_listings m
    LEFT JOIN public.profiles p ON p.id = m.user_id
   WHERE m.status = 'active'
     AND (p_category IS NULL OR m.category = p_category)
     AND (p_region   IS NULL OR m.region   = p_region)
     AND (p_price_min IS NULL OR m.price >= p_price_min)
     AND (p_price_max IS NULL OR m.price <= p_price_max)
     AND (v_ts IS NULL OR to_tsvector('german', coalesce(m.title,'')||' '||coalesce(m.description,'')) @@ v_ts)
   ORDER BY
     CASE WHEN v_ts IS NOT NULL
          THEN ts_rank(to_tsvector('german', coalesce(m.title,'')||' '||coalesce(m.description,'')), v_ts)
          ELSE 0 END DESC,
     m.created_at DESC
   LIMIT GREATEST(1, LEAST(coalesce(p_limit,50), 100));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_marketplace_search(text, text, text, numeric, numeric, integer) TO anon, authenticated;

-- 6) RPC fn_marketplace_auto_archive — sold > 30 Tage → archived --------------
CREATE OR REPLACE FUNCTION public.fn_marketplace_auto_archive()
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE n bigint;
BEGIN
  WITH u AS (
    UPDATE public.marketplace_listings
       SET status = 'archived', updated_at = now()
     WHERE status = 'sold' AND sold_at IS NOT NULL
       AND sold_at < now() - interval '30 days'
     RETURNING 1)
  SELECT count(*) INTO n FROM u;
  RETURN n;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_marketplace_auto_archive() FROM anon, authenticated;

-- 7) fn_cleanup_old_data() um Auto-Archiv-Schritt erweitert (cron-only) -------
CREATE OR REPLACE FUNCTION public.fn_cleanup_old_data()
 RETURNS TABLE(table_name text, rows_deleted bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE n bigint;
BEGIN
  WITH d AS (DELETE FROM public.notifications
             WHERE created_at < now() - interval '90 days' RETURNING 1)
  SELECT count(*) INTO n FROM d;
  table_name := 'notifications'; rows_deleted := n; RETURN NEXT;

  WITH d AS (DELETE FROM public.audit_log
             WHERE created_at < now() - interval '180 days' RETURNING 1)
  SELECT count(*) INTO n FROM d;
  table_name := 'audit_log'; rows_deleted := n; RETURN NEXT;

  WITH d AS (DELETE FROM public.book_ingest_jobs
             WHERE status IN ('completed','done','failed','error','cancelled')
               AND COALESCE(updated_at, created_at) < now() - interval '90 days' RETURNING 1)
  SELECT count(*) INTO n FROM d;
  table_name := 'book_ingest_jobs'; rows_deleted := n; RETURN NEXT;

  -- v26.92: verkaufte Marketplace-Inserate > 30 Tage archivieren
  SELECT public.fn_marketplace_auto_archive() INTO n;
  table_name := 'marketplace_archived'; rows_deleted := n; RETURN NEXT;
END;
$function$;
