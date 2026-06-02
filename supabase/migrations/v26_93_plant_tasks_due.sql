-- v26.93 · Push-System · Plant-Task-Engine
-- Mirror des LIVE-angewandten Endzustands (2 Migrations konsolidiert:
--   v26_93_plant_tasks_due + v26_93_plant_tasks_due_fix_lastdone_format).
--
-- Hard-Lesson #8: lastDone ist real ein ISO-8601-String
-- ("2026-04-27T20:16:58.392Z"), NICHT epoch-ms wie die Spec annahm.
-- Der erste View (regex '^[0-9]+$' + ::bigint) lieferte 0 Zeilen.
-- Fix: _gs_parse_ts_flex(text) parst BEIDE Formate (epoch-ms/epoch-s/ISO),
-- exception-safe (-> NULL statt Crash).
--
-- Push-Infrastruktur (push_subscriptions, push_send_log, VAPID-Keys in
-- app_settings, daily-push-checker, v25.26-Push-Frontend) existierte BEREITS
-- und ist NICHT Teil dieser Migration.

-- ── Flexibler Timestamp-Parser (epoch-ms | epoch-s | ISO-8601) ──────────────
CREATE OR REPLACE FUNCTION public._gs_parse_ts_flex(p text)
  RETURNS timestamptz
  LANGUAGE plpgsql
  STABLE
AS $function$
BEGIN
  IF p IS NULL OR p = '' THEN RETURN NULL; END IF;
  IF p ~ '^[0-9]+$' THEN
    IF length(p) >= 13 THEN
      RETURN to_timestamp(p::bigint / 1000.0);   -- epoch-Millisekunden
    ELSE
      RETURN to_timestamp(p::bigint);            -- epoch-Sekunden
    END IF;
  END IF;
  RETURN p::timestamptz;                          -- ISO-8601
EXCEPTION WHEN others THEN
  RETURN NULL;
END $function$;

-- ── VIEW: fällige Pflege-Aufgaben pro User ──────────────────────────────────
-- user_plants ist ein per-user jsonb-Blob (data->'plants' = Array), KEIN
-- per-plant-row-Modell. tasks ist ein Objekt {task_key: {active,intervalDays,
-- lastDone}}. security_invoker=true -> View erbt die RLS von user_plants
-- (jeder User sieht nur eigene Pflanzen).
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
         public._gs_parse_ts_flex(t.value ->> 'lastDone') AS last_done
  FROM plants pl,
       LATERAL jsonb_each(COALESCE(pl.plant -> 'tasks', '{}'::jsonb)) t(task_key, value)
  WHERE jsonb_typeof(pl.plant -> 'tasks') = 'object'
)
SELECT user_id,
       plant_id,
       plant_name,
       emoji,
       task_key,
       interval_days,
       last_done,
       last_done + ((interval_days || ' days')::interval) AS next_due_at,
       (last_done + ((interval_days || ' days')::interval)) <= now() AS is_due_now,
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
FROM expanded
WHERE active = true
  AND interval_days IS NOT NULL
  AND interval_days > 0
  AND last_done IS NOT NULL;

GRANT SELECT ON public.v_plant_tasks_due TO authenticated;

-- ── RPC: Pflege-Aufgabe als erledigt markieren (Robustness-Sync) ────────────
-- Spiegelt das client-seitige lastDone-Update best-effort serverseitig, damit
-- der daily-push-checker-Cron exakt weiß, was fällig ist. lastDone wird als
-- ISO-8601-UTC-String geschrieben (gleiches Format wie das Frontend).
CREATE OR REPLACE FUNCTION public.fn_plant_task_done(p_plant_id text, p_task_key text)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_data jsonb;
  v_idx int;
  v_now_iso text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_valid_keys text[] := ARRAY['water','fertilize','check','mist','rotate','prune','repot','dust'];
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  IF p_plant_id IS NULL OR length(p_plant_id) = 0 THEN RETURN false; END IF;
  IF NOT (p_task_key = ANY(v_valid_keys)) THEN RETURN false; END IF;

  SELECT data INTO v_data FROM public.user_plants WHERE user_id = v_uid;
  IF NOT FOUND OR v_data IS NULL OR jsonb_typeof(v_data->'plants') <> 'array' THEN
    RETURN false;
  END IF;

  SELECT (ord - 1) INTO v_idx
  FROM jsonb_array_elements(v_data->'plants') WITH ORDINALITY AS arr(elem, ord)
  WHERE elem->>'id' = p_plant_id
  LIMIT 1;
  IF v_idx IS NULL THEN RETURN false; END IF;

  IF NOT (v_data->'plants'->v_idx->'tasks' ? p_task_key) THEN
    RETURN false;
  END IF;

  v_data := jsonb_set(
    v_data,
    ARRAY['plants', v_idx::text, 'tasks', p_task_key, 'lastDone'],
    to_jsonb(v_now_iso),
    false
  );

  UPDATE public.user_plants
  SET data = v_data, updated_at = now()
  WHERE user_id = v_uid;

  RETURN true;
END $function$;

REVOKE ALL ON FUNCTION public.fn_plant_task_done(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_plant_task_done(text, text) TO authenticated;
