-- ============================================================================
-- v27_01_persistence_safeguard — User-State-Snapshot-Backup + TTL-Cleanup v3
-- P0: garantiertes Recovery-Netz gegen Datenverlust nach Update/Cache-Clear.
-- Rein additiv. Hard-Lesson #13 (REVOKE+GRANT) + #14 (Schema pre-flighted).
-- NB: Spalte heißt trigger_reason (nicht reserviertes Keyword 'trigger').
-- Spiegel der LIVE angewandten Migration (project vowbiueikwrauuceilhc).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_state_snapshots (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  taken_at       timestamptz NOT NULL DEFAULT now(),
  trigger_reason text NOT NULL DEFAULT 'manual'
                   CHECK (trigger_reason IN ('auto_daily','pre_migration','manual','pre_logout')),
  state          jsonb NOT NULL,
  size_bytes     int GENERATED ALWAYS AS (octet_length(state::text)) STORED,
  UNIQUE (user_id, taken_at)
);
CREATE INDEX IF NOT EXISTS idx_uss_user_recent
  ON public.user_state_snapshots (user_id, taken_at DESC);

ALTER TABLE public.user_state_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS uss_own ON public.user_state_snapshots;
CREATE POLICY uss_own ON public.user_state_snapshots
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, DELETE ON public.user_state_snapshots TO authenticated;

-- ─── Auto-Cleanup: max 3 Snapshots pro User (jüngste behalten) ────────────────
CREATE OR REPLACE FUNCTION public.fn_cleanup_user_snapshots()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_deleted int := 0;
BEGIN
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY taken_at DESC) AS rn
    FROM public.user_state_snapshots
  ),
  del AS (
    DELETE FROM public.user_state_snapshots
    WHERE id IN (SELECT id FROM ranked WHERE rn > 3)
    RETURNING id
  )
  SELECT count(*)::int INTO v_deleted FROM del;
  RETURN v_deleted;
END $$;
REVOKE ALL ON FUNCTION public.fn_cleanup_user_snapshots() FROM PUBLIC, anon, authenticated;

-- ─── Snapshot anlegen (Frontend, eigene Daten) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_user_snapshot_create(p_trigger text, p_state jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id uuid; v_uid uuid := (SELECT auth.uid()); v_trig text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authed'; END IF;
  IF p_state IS NULL OR jsonb_typeof(p_state) <> 'object' THEN RAISE EXCEPTION 'bad_state'; END IF;
  IF octet_length(p_state::text) < 8 THEN RAISE EXCEPTION 'empty_state'; END IF;
  v_trig := CASE WHEN p_trigger IN ('auto_daily','pre_migration','manual','pre_logout')
                 THEN p_trigger ELSE 'manual' END;
  INSERT INTO public.user_state_snapshots (user_id, trigger_reason, state)
  VALUES (v_uid, v_trig, p_state)
  ON CONFLICT (user_id, taken_at) DO UPDATE SET state = EXCLUDED.state
  RETURNING id INTO v_id;
  PERFORM public.fn_cleanup_user_snapshots();
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.fn_user_snapshot_create(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_user_snapshot_create(text, jsonb) TO authenticated;

-- ─── Snapshot-Liste (Metadaten, own-only via RLS) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_user_snapshots_list()
RETURNS TABLE (id uuid, taken_at timestamptz, trigger_reason text, size_bytes int)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  SELECT id, taken_at, trigger_reason, size_bytes
  FROM public.user_state_snapshots
  WHERE user_id = (SELECT auth.uid())
  ORDER BY taken_at DESC;
$$;
REVOKE ALL ON FUNCTION public.fn_user_snapshots_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_user_snapshots_list() TO authenticated;

-- ─── Jüngsten Snapshot-State holen (für Restore) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_user_snapshot_latest()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  SELECT state
  FROM public.user_state_snapshots
  WHERE user_id = (SELECT auth.uid())
  ORDER BY taken_at DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.fn_user_snapshot_latest() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_user_snapshot_latest() TO authenticated;

-- ─── fn_cleanup_old_data v3 — alle TTLs idempotent, User-Content sakrosankt ────
CREATE OR REPLACE FUNCTION public.fn_cleanup_old_data()
RETURNS TABLE(table_name text, rows_deleted bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
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

  -- v27.01: Push-Sent-Log GC > 30 Tage (Hygiene; offenes Backlog-Item)
  WITH d AS (DELETE FROM public.push_send_log
             WHERE sent_at < now() - interval '30 days' RETURNING 1)
  SELECT count(*) INTO n FROM d;
  table_name := 'push_send_log'; rows_deleted := n; RETURN NEXT;

  -- v27.01: max 3 State-Snapshots pro User behalten
  SELECT public.fn_cleanup_user_snapshots() INTO n;
  table_name := 'user_state_snapshots'; rows_deleted := n; RETURN NEXT;
END;
$function$;
