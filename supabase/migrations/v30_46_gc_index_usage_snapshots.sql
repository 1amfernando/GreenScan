-- v30.46 (Block H Optimierung) — angewendet 2026-06-25 via MCP.
-- index_usage_snapshots (diagnostische Index-Nutzungs-Snapshots vom index-usage-daily-Cron, ~100/Tag) wuchs
-- UNBEGRENZT (2297 Zeilen, kein GC, einzige unbounded Log-Tabelle ohne Retention). Retention 90 Tage in die
-- bestehende tägliche fn_cleanup_old_data (Cron gs_cleanup_old_data 03:15 UTC) aufgenommen.
-- HL#23: disposable Diagnose-Tabelle, keine FKs darauf, 90d-Grace behält ein Quartal Trend für den Perf-Sprint.
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

  SELECT public.fn_marketplace_auto_archive() INTO n;
  table_name := 'marketplace_archived'; rows_deleted := n; RETURN NEXT;

  WITH d AS (DELETE FROM public.push_send_log
             WHERE sent_at < now() - interval '30 days' RETURNING 1)
  SELECT count(*) INTO n FROM d;
  table_name := 'push_send_log'; rows_deleted := n; RETURN NEXT;

  SELECT public.fn_cleanup_user_snapshots() INTO n;
  table_name := 'user_state_snapshots'; rows_deleted := n; RETURN NEXT;

  -- v30.46 (Block H): diagnostische Index-Nutzungs-Snapshots > 90 Tage (wuchsen unbounded)
  WITH d AS (DELETE FROM public.index_usage_snapshots
             WHERE captured_at < now() - interval '90 days' RETURNING 1)
  SELECT count(*) INTO n FROM d;
  table_name := 'index_usage_snapshots'; rows_deleted := n; RETURN NEXT;
END;
$function$;
