-- 20260912_snapshot_retention_manual.sql  (v33.26)
--
-- NICHT ANGEWANDT. DDL auf der Produktivdatenbank macht Fernando (CLAUDE.md §7.1).
--
-- BEFUND (live gemessen am 11.09.2026, nur lesend):
--
--   select trigger_reason, count(*) from user_state_snapshots group by 1;
--     auto_periodic  18   (7 Nutzer)
--     auto_daily     14   (8 Nutzer)
--     pre_migration  11   (5 Nutzer)
--     manual          0
--     pre_logout      0
--
-- `fn_cleanup_user_snapshots` (v29_28) behaelt je Nutzer die 6 NEUESTEN plus
-- den je neuesten `pre_migration` / `auto_daily` / `pre_logout`. **`manual`
-- steht in dieser Liste nicht** — ausgerechnet der Stand, den eine Person
-- bewusst angelegt hat („Cloud-Backup & Sync" → „Backup jetzt").
--
-- Ehrlich dazu: dass deshalb je einer verdraengt WURDE, ist von hier nicht
-- entscheidbar — es gibt live 0 manual-Zeilen, und das kann auch heissen, dass
-- den Knopf noch nie jemand gedrueckt hat. Die Luecke ist trotzdem real, und
-- mit v33.25 (Update ohne Klick) entsteht je Auslieferung ein pre_migration:
-- am 10.09.2026 waren das 14 Versionen an einem Tag. Sechs Plaetze sind dann
-- an einem Nachmittag durchgespuelt.
--
-- WAS DIESE DATEI TUT: `manual` kommt in die geschuetzte Liste. Sonst nichts —
-- kein Schema, keine Rechte, keine Daten.
--
-- NACHPRUEFEN (nach dem Anwenden):
--   select pg_get_functiondef('public.fn_cleanup_user_snapshots'::regproc)
--          like '%''manual''%' as manual_geschuetzt;   -- erwartet: t
--
-- Pruefstand: `node scripts/backup_check.js` spielt die Regel in einem lokalen
-- Postgres nach — mit der Reproduktion (ein manual, zehn pre_migration → das
-- manual ist weg) und der Gegenprobe (alte Fassung erneut → wieder weg).

CREATE OR REPLACE FUNCTION public.fn_cleanup_user_snapshots()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $function$
DECLARE v_deleted int := 0;
BEGIN
  WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY taken_at DESC) AS rn,
           ROW_NUMBER() OVER (PARTITION BY user_id, trigger_reason ORDER BY taken_at DESC) AS rn_trig,
           trigger_reason
    FROM public.user_state_snapshots
  ),
  keep AS (
    SELECT id FROM ranked
    WHERE rn <= 6
       -- v33.26: 'manual' dazu. Ein Stand, den die Person selbst angelegt hat,
       -- ist der einzige, bei dem der Wille eindeutig ist — er darf nicht von
       -- automatischen Staenden verdraengt werden.
       OR (trigger_reason IN ('pre_migration','auto_daily','pre_logout','manual') AND rn_trig = 1)
  ),
  del AS (
    DELETE FROM public.user_state_snapshots
    WHERE id NOT IN (SELECT id FROM keep)
    RETURNING id
  )
  SELECT count(*)::int INTO v_deleted FROM del;
  RETURN v_deleted;
END $function$;

REVOKE ALL ON FUNCTION public.fn_cleanup_user_snapshots() FROM PUBLIC, anon, authenticated;
