-- ═══════════════════════════════════════════════════════════════════════════
-- v32.46 · v_plant_tasks_due: Verschiebung (snoozedUntil) und Kalendertag
-- Entwurf: docs/KALENDER-V1.md §3.1
--
-- BEWUSST NICHT ANGEWANDT (DDL ist Fernandos Handgriff). Idempotent.
--
-- Zwei Dinge, die der Client seit v32.46 anders macht als diese Sicht:
--
-- 1. gsSnoozeTask FAELSCHT `lastDone` nicht mehr, sondern schreibt
--    `snoozedUntil`. Bis diese Sicht das liest, haelt der Push-Cron eine
--    verschobene Aufgabe fuer faellig — er liest nur lastDone + Intervall.
-- 2. Der Client vergleicht KALENDERTAGE (Mitternacht, v24.25); diese Sicht
--    verglich auf die Sekunde (`<= now()`). Eine um 14:00 gegossene Pflanze
--    war fuer den Cron ab 14:00 des Faelligkeitstags faellig, fuer die App
--    ab 00:00. Zwei Regeln fuer dieselbe Frage — jetzt eine, in Europe/Zurich.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.v_plant_tasks_due
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
         public._gs_parse_ts_flex(t.value ->> 'lastDone')     AS last_done,
         public._gs_parse_ts_flex(t.value ->> 'snoozedUntil') AS snoozed_until
  FROM plants pl,
       LATERAL jsonb_each(COALESCE(pl.plant -> 'tasks', '{}'::jsonb)) t(task_key, value)
  WHERE jsonb_typeof(pl.plant -> 'tasks') = 'object'
), berechnet AS (
  SELECT *,
         -- faellig = max(lastDone + Intervall, snoozedUntil) — dieselbe Regel wie getDaysUntilDue
         GREATEST(last_done + ((interval_days || ' days')::interval), COALESCE(snoozed_until, last_done)) AS next_due_at
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
       next_due_at,
       -- Kalendertag statt Sekunde: faellig, sobald der Tag angebrochen ist
       (next_due_at AT TIME ZONE 'Europe/Zurich')::date <= (now() AT TIME ZONE 'Europe/Zurich')::date AS is_due_now,
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
  'Faellige Pflegeaufgaben je Nutzer. Seit v32.46: snoozedUntil zaehlt, Vergleich auf Kalendertag (Europe/Zurich) — dieselbe Regel wie getDaysUntilDue im Client.';
