-- v26.76 — fn_cleanup_old_data() echte TTL-Logik (war Placeholder-No-Op)
-- Audit-Finding: Der pg_cron-Job gs_cleanup_old_data (03:15 UTC täglich) rief
-- eine Placeholder-Funktion auf, die nur ('placeholder',0) zurückgab → KEIN
-- Cleanup lief jemals. notifications + audit_log wuchsen unbounded (P2/P3.2),
-- abgeschlossene book_ingest_jobs sammelten sich an (P3.1).
--
-- WICHTIG: pending book_ingest_jobs (aktuell 66) werden NIE gelöscht — nur
-- Terminal-Status (completed/done/failed/error/cancelled) > 90 Tage.
-- Cron-Job bleibt unverändert; nur der Funktions-Body wird ersetzt.

CREATE OR REPLACE FUNCTION public.fn_cleanup_old_data()
  RETURNS TABLE(table_name text, rows_deleted bigint)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE n bigint;
BEGIN
  -- 1) Notifications > 90 Tage (unbounded growth, Audit-Finding P2)
  WITH d AS (DELETE FROM public.notifications
             WHERE created_at < now() - interval '90 days' RETURNING 1)
  SELECT count(*) INTO n FROM d;
  table_name := 'notifications'; rows_deleted := n; RETURN NEXT;

  -- 2) Audit-Log TTL 180 Tage (Audit-Finding P3.2)
  WITH d AS (DELETE FROM public.audit_log
             WHERE created_at < now() - interval '180 days' RETURNING 1)
  SELECT count(*) INTO n FROM d;
  table_name := 'audit_log'; rows_deleted := n; RETURN NEXT;

  -- 3) Abgeschlossene Book-Ingest-Jobs > 90 Tage (Audit-Finding P3.1).
  --    pending-Jobs NIE löschen (aktuell 66 pending).
  WITH d AS (DELETE FROM public.book_ingest_jobs
             WHERE status IN ('completed','done','failed','error','cancelled')
               AND COALESCE(updated_at, created_at) < now() - interval '90 days' RETURNING 1)
  SELECT count(*) INTO n FROM d;
  table_name := 'book_ingest_jobs'; rows_deleted := n; RETURN NEXT;
END;
$function$;
