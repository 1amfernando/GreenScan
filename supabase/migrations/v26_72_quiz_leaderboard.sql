-- v26.72 Quiz-Leaderboard (Master-Auftrag #11)

CREATE TABLE IF NOT EXISTS public.quiz_leaderboard (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  total_correct integer NOT NULL DEFAULT 0,
  total_attempts integer NOT NULL DEFAULT 0,
  streak_current integer NOT NULL DEFAULT 0,
  streak_max integer NOT NULL DEFAULT 0,
  last_active_date date,
  rank_position integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_leaderboard_correct
  ON public.quiz_leaderboard (total_correct DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_leaderboard_streak
  ON public.quiz_leaderboard (streak_max DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_leaderboard_active
  ON public.quiz_leaderboard (last_active_date DESC);

ALTER TABLE public.quiz_leaderboard ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "all read leaderboard" ON public.quiz_leaderboard;
CREATE POLICY "all read leaderboard" ON public.quiz_leaderboard
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "users upsert own row" ON public.quiz_leaderboard;
CREATE POLICY "users upsert own row" ON public.quiz_leaderboard
  FOR ALL USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

COMMENT ON TABLE public.quiz_leaderboard IS
  'v26.72: Quiz-Rangliste. Eine Zeile pro User (PK auf user_id). Wird via fn_quiz_leaderboard_upsert RPC upgesertet.';

DROP FUNCTION IF EXISTS public.fn_quiz_leaderboard_top(int);
CREATE FUNCTION public.fn_quiz_leaderboard_top(p_limit int DEFAULT 10)
RETURNS TABLE(rnk int, user_id uuid, display_name text, total_correct int, streak_max int, total_attempts int)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT (row_number() OVER (ORDER BY total_correct DESC, streak_max DESC))::int AS rnk,
         user_id, display_name, total_correct, streak_max, total_attempts
  FROM public.quiz_leaderboard
  ORDER BY total_correct DESC, streak_max DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;
REVOKE EXECUTE ON FUNCTION public.fn_quiz_leaderboard_top(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_quiz_leaderboard_top(int) TO authenticated, anon;

DROP FUNCTION IF EXISTS public.fn_quiz_leaderboard_my_rank();
CREATE FUNCTION public.fn_quiz_leaderboard_my_rank()
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ranked AS (
    SELECT user_id, row_number() OVER (ORDER BY total_correct DESC, streak_max DESC) AS rnk
    FROM public.quiz_leaderboard
  )
  SELECT rnk::int FROM ranked WHERE user_id = (SELECT auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.fn_quiz_leaderboard_my_rank() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_quiz_leaderboard_my_rank() TO authenticated;

DROP FUNCTION IF EXISTS public.fn_quiz_leaderboard_upsert(int,int,int,int,text);
CREATE FUNCTION public.fn_quiz_leaderboard_upsert(
  p_total_correct int,
  p_total_attempts int,
  p_streak_current int,
  p_streak_max int,
  p_display_name text DEFAULT NULL
) RETURNS public.quiz_leaderboard
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  _uid uuid := (SELECT auth.uid());
  _row public.quiz_leaderboard;
  _name text;
  _animal_words text[] := ARRAY['Bär','Fuchs','Eichhörnchen','Reh','Dachs','Igel','Wolf','Luchs','Adler','Falke','Eule','Specht','Murmel','Steinbock','Marmot','Hase'];
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  _name := COALESCE(p_display_name,
    'Pilz-' || _animal_words[1 + (abs(hashtext(_uid::text)) % array_length(_animal_words,1))]
       || ' ' || (10 + (abs(hashtext(_uid::text || 'salt')) % 90))::text);
  INSERT INTO public.quiz_leaderboard
    (user_id, display_name, total_correct, total_attempts, streak_current, streak_max, last_active_date, updated_at)
  VALUES
    (_uid, _name, GREATEST(0,p_total_correct), GREATEST(0,p_total_attempts), GREATEST(0,p_streak_current), GREATEST(0,p_streak_max), current_date, now())
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = COALESCE(p_display_name, public.quiz_leaderboard.display_name),
    total_correct = GREATEST(public.quiz_leaderboard.total_correct, EXCLUDED.total_correct),
    total_attempts = GREATEST(public.quiz_leaderboard.total_attempts, EXCLUDED.total_attempts),
    streak_current = EXCLUDED.streak_current,
    streak_max = GREATEST(public.quiz_leaderboard.streak_max, EXCLUDED.streak_max),
    last_active_date = current_date,
    updated_at = now()
  RETURNING * INTO _row;
  RETURN _row;
END $$;
REVOKE EXECUTE ON FUNCTION public.fn_quiz_leaderboard_upsert(int,int,int,int,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_quiz_leaderboard_upsert(int,int,int,int,text) TO authenticated;

COMMENT ON FUNCTION public.fn_quiz_leaderboard_upsert IS
  'v26.72: UPSERT Quiz-Rangliste. Defensiv: total_correct/_attempts/streak_max werden mit GREATEST kombiniert (kein Backward-Slide). display_name fallback auf "Pilz-<Animal> <Number>" aus user_id-Hash.';

-- pg_cron daily rank-update
-- (separat applied via execute_sql wegen idempotenten cron.schedule)
-- SELECT cron.schedule('quiz-leaderboard-rank', '0 2 * * *', $cron$
--   UPDATE public.quiz_leaderboard ql
--   SET rank_position = sub.rnk
--   FROM (
--     SELECT user_id, row_number() OVER (ORDER BY total_correct DESC, streak_max DESC) AS rnk
--     FROM public.quiz_leaderboard
--   ) sub
--   WHERE ql.user_id = sub.user_id;
-- $cron$);
