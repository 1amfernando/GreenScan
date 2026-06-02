-- v26.98 Foto-Diff-AI: Persisted Vorher/Nachher-Analysen pro Pflanze.
-- ARCHITEKTUR-REALITAET (Hard-Lesson #8): user_plants ist KEIN per-plant-row-Modell,
-- sondern ein per-user jsonb-Blob (data->'plants' Array). Daher KEINE v_plant_photo_timeline-VIEW
-- (waere invalide + unnoetig — Frontend hat alle Fotos client-seitig in myPlants).
-- plant_id ist daher TEXT (= jsonb plant.id), nicht FK.

CREATE TABLE IF NOT EXISTS public.plant_photo_diffs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plant_id    text NOT NULL,
  photo_url_a text,
  photo_url_b text,
  taken_at_a  timestamptz,
  taken_at_b  timestamptz,
  days_between integer,
  analysis    jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_provider text DEFAULT 'anthropic',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ppd_user_plant_at
  ON public.plant_photo_diffs (user_id, plant_id, created_at DESC);

ALTER TABLE public.plant_photo_diffs ENABLE ROW LEVEL SECURITY;

-- Own-only (Hard-Lesson #6: auth.uid() gewrappt fuer init-plan-Caching)
DROP POLICY IF EXISTS ppd_own ON public.plant_photo_diffs;
CREATE POLICY ppd_own ON public.plant_photo_diffs
  FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- RPC: erstellt einen Diff-Record. days_between server-seitig aus taken_at berechnet.
CREATE OR REPLACE FUNCTION public.fn_photo_diff_create(
  p_plant_id text,
  p_photo_a  text,
  p_photo_b  text,
  p_taken_a  timestamptz,
  p_taken_b  timestamptz,
  p_analysis jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid  uuid := (SELECT auth.uid());
  v_id   uuid;
  v_days integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_plant_id IS NULL OR length(trim(p_plant_id)) = 0 THEN
    RAISE EXCEPTION 'plant_id required';
  END IF;
  v_days := CASE
    WHEN p_taken_a IS NOT NULL AND p_taken_b IS NOT NULL
    THEN GREATEST(0, (EXTRACT(EPOCH FROM (p_taken_b - p_taken_a)) / 86400)::int)
    ELSE NULL
  END;
  INSERT INTO public.plant_photo_diffs
    (user_id, plant_id, photo_url_a, photo_url_b, taken_at_a, taken_at_b, days_between, analysis, ai_provider)
  VALUES
    (v_uid, p_plant_id, p_photo_a, p_photo_b, p_taken_a, p_taken_b, v_days, COALESCE(p_analysis, '{}'::jsonb), 'anthropic')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- RPC: listet Diff-Historie einer Pflanze (DEFINER → daher explizit user_id-Filter im Body).
CREATE OR REPLACE FUNCTION public.fn_photo_diff_list(
  p_plant_id text,
  p_lim integer DEFAULT 20
) RETURNS TABLE (
  id uuid,
  plant_id text,
  taken_at_a timestamptz,
  taken_at_b timestamptz,
  days_between integer,
  analysis jsonb,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT d.id, d.plant_id, d.taken_at_a, d.taken_at_b, d.days_between, d.analysis, d.created_at
  FROM public.plant_photo_diffs d
  WHERE d.user_id = (SELECT auth.uid())
    AND d.plant_id = p_plant_id
  ORDER BY d.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_lim, 20), 1), 100);
$$;

GRANT EXECUTE ON FUNCTION public.fn_photo_diff_create(text,text,text,timestamptz,timestamptz,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_photo_diff_list(text,integer) TO authenticated;
