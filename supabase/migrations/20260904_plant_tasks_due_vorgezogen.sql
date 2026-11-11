-- ═══════════════════════════════════════════════════════════════════════════
-- v32.53 · v_plant_tasks_due: eine Sensor-Regel zieht eine Aufgabe VOR
-- Entwurf: docs/OEKOSYSTEM-V1.md §6 und §11 Idee 4 · docs/KALENDER-V1.md §1.2
--
-- BEWUSST NICHT ANGEWANDT (DDL ist Fernandos Handgriff). Idempotent; ersetzt
-- die Sicht aus 20260903_plant_tasks_due_snooze.sql vollstaendig — diese
-- Datei nach jener anwenden (oder nur diese: sie enthaelt alles).
--
-- Was der Client seit v32.53 anders macht als die alte Sicht:
--   Eine verletzte Regel `task:<key>` an einem Geraet der Pflanze schreibt
--   `tasks.<key>.vorgezogenAuf` (ISO, Mitternacht des Tages) und
--   `vorgezogenGrund`. getDaysUntilDue rechnet:
--     faellig = max( min(lastDone + Intervall, vorgezogenAuf), snoozedUntil )
--   vorgezogenAuf zaehlt nur, wenn es NACH lastDone liegt (seither nicht
--   erledigt). Die Verschiebung durch die Person gewinnt — der Sensor ist
--   ein Hinweis, entschieden wird nicht fuer den Menschen.
-- Ohne diese Sicht haelt der Push-Cron eine vorgezogene Aufgabe erst am
-- regulaeren Tag fuer faellig — zwei Regeln fuer dieselbe Frage.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- v33.41 · WARUM DROP + CREATE statt CREATE OR REPLACE
-- Gemessen am 16.09.2026 in einem lokalen Postgres, gegen die Sicht, wie sie
-- HEUTE live steht (v26_93, zehn Spalten):
--     ERROR: cannot change name of view column "next_due_at" to "snoozed_until"
-- `CREATE OR REPLACE VIEW` darf Spalten nur ANHAENGEN, nie einfuegen oder
-- umbenennen. Diese Datei fuegt welche in der Mitte ein — sie WAERE beim
-- Anwenden gescheitert, und stand trotzdem seit Tagen als „bereit" in der
-- Liste der offenen Migrationen.
-- Nichts haengt an der Sicht (live geprueft, pg_depend: 0 abhaengige Objekte),
-- deshalb ist DROP + CREATE gefahrlos — und idempotent.
-- Pruefstand: naht_check „Migration · jede Sicht-Migration laesst sich WIRKLICH
-- anwenden" rechnet genau das in einem lokalen Postgres nach.
-- ───────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.v_plant_tasks_due;

CREATE VIEW public.v_plant_tasks_due
  WITH (security_invoker = true) AS
WITH plants AS (
  SELECT up.user_id,
         jsonb_array_elements(up.data -> 'plants') AS plant
  FROM public.user_plants up
  WHERE jsonb_typeof(up.data -> 'plants') = 'array'
), expanded AS (
  SELECT pl.user_id,
         pl.plant ->> 'id'    AS plant_id,
         pl.plant ->> 'name'  AS plant_name,
         pl.plant ->> 'emoji' AS emoji,
         t.task_key,
         (t.value ->> 'active')::boolean AS active,
         NULLIF(t.value ->> 'intervalDays', '')::integer AS interval_days,
         public._gs_parse_ts_flex(t.value ->> 'lastDone')      AS last_done,
         public._gs_parse_ts_flex(t.value ->> 'snoozedUntil')  AS snoozed_until,
         public._gs_parse_ts_flex(t.value ->> 'vorgezogenAuf') AS vorgezogen_auf,
         t.value ->> 'vorgezogenGrund'                          AS vorgezogen_grund
  FROM plants pl,
       LATERAL jsonb_each(COALESCE(pl.plant -> 'tasks', '{}'::jsonb)) t(task_key, value)
  WHERE jsonb_typeof(pl.plant -> 'tasks') = 'object'
), berechnet AS (
  SELECT *,
         -- faellig = max( min(lastDone + Intervall, vorgezogenAuf), snoozedUntil )
         -- vorgezogenAuf zaehlt nur nach lastDone — dieselbe Regel wie getDaysUntilDue
         GREATEST(
           LEAST(last_done + ((interval_days || ' days')::interval),
                 CASE WHEN vorgezogen_auf IS NOT NULL AND vorgezogen_auf > last_done
                      THEN vorgezogen_auf
                      ELSE last_done + ((interval_days || ' days')::interval) END),
           COALESCE(snoozed_until, last_done)
         ) AS next_due_at
  FROM expanded
)
SELECT user_id,
       plant_id,
       plant_name,
       emoji,
       task_key,
       interval_days,
       last_done,
       snoozed_until,
       vorgezogen_auf,
       vorgezogen_grund,
       next_due_at,
       (next_due_at AT TIME ZONE 'Europe/Zurich')::date <= (now() AT TIME ZONE 'Europe/Zurich')::date AS is_due_now,
       (vorgezogen_auf IS NOT NULL AND vorgezogen_auf > last_done AND next_due_at = vorgezogen_auf) AS durch_sensor,
       CASE task_key
         WHEN 'water'     THEN '💧 Gießen'
         WHEN 'fertilize' THEN '🧪 Düngen'
         WHEN 'check'     THEN '👀 Check'
         WHEN 'mist'      THEN '💨 Besprühen'
         WHEN 'rotate'    THEN '🔄 Drehen'
         WHEN 'prune'     THEN '✂️ Schneiden'
         WHEN 'repot'     THEN '🪴 Umtopfen'
         WHEN 'dust'      THEN '🧹 Abstauben'
         ELSE task_key
       END AS task_label
FROM berechnet
WHERE active = true
  AND interval_days IS NOT NULL
  AND interval_days > 0
  AND last_done IS NOT NULL;

GRANT SELECT ON public.v_plant_tasks_due TO authenticated;

COMMENT ON VIEW public.v_plant_tasks_due IS
  'Faellige Pflegeaufgaben je Nutzer. Seit v32.46: snoozedUntil zaehlt, Kalendertag Europe/Zurich. Seit v32.53: vorgezogenAuf (Sensor-Regel task:<key>) zieht vor, die Verschiebung gewinnt — dieselbe Regel wie getDaysUntilDue im Client.';
