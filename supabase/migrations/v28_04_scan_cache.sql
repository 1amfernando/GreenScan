-- ============================================================================
-- v28_04_scan_cache — Scan-Caching (v28.04 Block A · Cost-Hebel #1)
-- Spiegel der LIVE angewandten Migration (project vowbiueikwrauuceilhc).
-- Cache identischer Re-Scans → Claude-Vision-Call wird übersprungen.
--
-- ⚠️ SICHERHEIT (Toxizitäts-App): Cache trifft NUR bei EXAKTEM dHash-Match
--   (Hamming-Distanz 0). Die Spec erlaubte ≤5 Toleranz — bewusst auf 0 verschärft,
--   damit kein visuell ähnliches, aber anderes Bild eine FALSCHE Art zurückgibt.
--   Frontend liefert nur den exakten phash-Lookup (PK-Match), kein Fuzzy-Range.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.scan_cache (
  phash           text PRIMARY KEY,                 -- 64-bit dHash als hex (16 Zeichen)
  result_json     jsonb NOT NULL,
  hit_count       int NOT NULL DEFAULT 0,
  first_cached_at timestamptz NOT NULL DEFAULT now(),
  last_hit_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_cache_recent ON public.scan_cache (last_hit_at DESC);

ALTER TABLE public.scan_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scan_cache_read_all ON public.scan_cache;
CREATE POLICY scan_cache_read_all ON public.scan_cache FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.scan_cache TO anon, authenticated;
-- INSERT/UPDATE nur via DEFINER-RPC (kein direkter Write).

-- Put/Bump (DEFINER): legt Eintrag an oder zählt Hit + last_hit_at hoch.
CREATE OR REPLACE FUNCTION public.fn_scan_cache_put(p_phash text, p_result jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_phash IS NULL OR length(p_phash) NOT BETWEEN 8 AND 32 THEN RETURN; END IF;
  IF p_result IS NULL OR jsonb_typeof(p_result) <> 'object' THEN RETURN; END IF;
  INSERT INTO public.scan_cache (phash, result_json) VALUES (lower(p_phash), p_result)
  ON CONFLICT (phash) DO UPDATE
    SET hit_count = scan_cache.hit_count + 1, last_hit_at = now();
END $$;
REVOKE ALL ON FUNCTION public.fn_scan_cache_put(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_scan_cache_put(text, jsonb) TO authenticated;

-- Cleanup: Einträge > 30 Tage ohne Hit löschen.
CREATE OR REPLACE FUNCTION public.fn_cleanup_scan_cache()
RETURNS int LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH d AS (DELETE FROM public.scan_cache WHERE last_hit_at < now() - interval '30 days' RETURNING phash)
  SELECT count(*)::int FROM d;
$$;
REVOKE ALL ON FUNCTION public.fn_cleanup_scan_cache() FROM PUBLIC, anon, authenticated;

-- ─── Cron (separat via execute_sql appliziert, hier dokumentiert): ───────────
-- SELECT cron.schedule('scan-cache-cleanup', '15 4 * * 0',
--   $$SELECT public.fn_cleanup_scan_cache();$$);   -- jobid 13, So 04:15 UTC
-- Frontend-Integration: index.html analyzeImage — _gsScanDHash (dHash 9x8→64bit) +
-- _gsScanCacheGet (exakter phash-Lookup VOR callVisionAI) + _gsScanCachePut (RPC bei Miss/Hit).
