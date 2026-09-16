-- ═══════════════════════════════════════════════════════════════════════════
-- v33.41 · v_plant_tasks_due kennt BEIDE Pflanzenlisten
-- Entwurf: docs/KALENDER-V2.md §8 Punkt 1 · docs/KALENDER-V1.md §1.2
--
-- BEWUSST NICHT ANGEWANDT (DDL ist Fernandos Handgriff). Idempotent; ersetzt
-- die Sicht aus 20260904_plant_tasks_due_vorgezogen.sql vollstaendig — diese
-- Datei nach jener anwenden (oder nur diese: sie enthaelt alles).
--
-- DER BEFUND, live gemessen am 16.09.2026 (nur lesend):
--   Die Sicht expandiert ausschliesslich `user_plants.data -> 'plants'`.
--   `user_gardens` kommt in KEINER der vier Migrationen dieser Sicht vor.
--   Gemessen: 15 Garten-Pflanzungen mit `tasks` in `user_gardens`, und die
--   Sicht hatte 23 Zeilen — alle aus `user_plants` (6 Zeilen).
--   Der Aufgaben-Cron (`daily-push-checker`) hat also seit v26.93 an KEINE
--   einzige Garten-Pflanzung erinnert.
--   Die App zaehlt seit v32.47 beide Listen (`gsGetDueTasks` ueber
--   `_gsPflanzeFinden`); der Server eine. Zwei Zahlen fuer „faellig", und
--   die kleinere ist die, die pusht.
--
-- Die Rechnung bleibt WOERTLICH dieselbe — sie steht deshalb genau EINMAL,
-- hinter einem UNION ALL der beiden Quellen. Zwei Kopien waeren die Klasse,
-- die dieser Kalender ueberall abbaut.
--
-- Die Pflanzung traegt zusaetzlich ihren Garten (`garden_id`, `garden_name`)
-- und `liste` ('myPlants' | 'plantings') — damit ein Push sagen kann, WO die
-- Pflanze steht, und ein Pruefstand die zwei Quellen auseinanderhalten kann.
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
WITH quellen AS (
  -- 1 · „Meine Pflanzen" (user_plants.data -> 'plants')
  SELECT up.user_id,
         jsonb_array_elements(up.data -> 'plants') AS pflanze,
         'myPlants'::text                          AS liste,
         NULL::text                                AS garden_id,
         NULL::text                                AS garden_name
  FROM public.user_plants up
  WHERE jsonb_typeof(up.data -> 'plants') = 'array'

  UNION ALL

  -- 2 · Garten-Pflanzungen (user_gardens.data -> 'plantings') — v33.41.
  --     Der Gartenname kommt aus `data -> 'gardens'` ueber die gardenId der
  --     Pflanzung; fehlt er, bleibt er NULL (nie ein erfundener Name).
  SELECT ug.user_id,
         p                                          AS pflanze,
         'plantings'::text                          AS liste,
         p ->> 'gardenId'                           AS garden_id,
         (SELECT g ->> 'name'
            FROM jsonb_array_elements(COALESCE(ug.data -> 'gardens', '[]'::jsonb)) g
           WHERE g ->> 'id' = p ->> 'gardenId'
           LIMIT 1)                                 AS garden_name
  FROM public.user_gardens ug,
       LATERAL jsonb_array_elements(ug.data -> 'plantings') p
  WHERE jsonb_typeof(ug.data -> 'plantings') = 'array'
), expanded AS (
  SELECT q.user_id,
         q.liste,
         q.garden_id,
         q.garden_name,
         q.pflanze ->> 'id'    AS plant_id,
         q.pflanze ->> 'name'  AS plant_name,
         q.pflanze ->> 'emoji' AS emoji,
         t.task_key,
         (t.value ->> 'active')::boolean AS active,
         NULLIF(t.value ->> 'intervalDays', '')::integer AS interval_days,
         public._gs_parse_ts_flex(t.value ->> 'lastDone')      AS last_done,
         public._gs_parse_ts_flex(t.value ->> 'snoozedUntil')  AS snoozed_until,
         public._gs_parse_ts_flex(t.value ->> 'vorgezogenAuf') AS vorgezogen_auf,
         t.value ->> 'vorgezogenGrund'                          AS vorgezogen_grund
  FROM quellen q,
       LATERAL jsonb_each(COALESCE(q.pflanze -> 'tasks', '{}'::jsonb)) t(task_key, value)
  WHERE jsonb_typeof(q.pflanze -> 'tasks') = 'object'
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
       liste,
       garden_id,
       garden_name,
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
  'Faellige Pflegeaufgaben je Nutzer aus BEIDEN Listen (v33.41): user_plants.data->plants und user_gardens.data->plantings, mit liste/garden_id/garden_name. Seit v32.46: snoozedUntil zaehlt, Kalendertag Europe/Zurich. Seit v32.53: vorgezogenAuf (Sensor-Regel task:<key>) zieht vor, die Verschiebung gewinnt — dieselbe Regel wie getDaysUntilDue im Client.';
