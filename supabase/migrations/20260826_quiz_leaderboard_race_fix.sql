-- v30.80: Quiz-Rangliste Race-Condition-Fix (User-Bug: "richtige Antwort,
-- aber Rangliste zeigt gleiche Punkte").
--
-- Root-Cause (Live-DB-verifiziert 2026-08-26):
--   fn_quiz_leaderboard_upsert zaehlt total_correct/total_attempts
--   server-seitig aus quiz_answers (Anti-Cheat, korrekt). Der Client-Push
--   ist aber auf 500ms debounced, der quiz_answers-INSERT laeuft im
--   Frontend erst nach einem 800ms-setTimeout → der Upsert zaehlt VOR dem
--   Insert (Beweis: lb.updated_at 09:54:14.879 < answers.created_at
--   09:54:15.197). GREATEST(alt, alte_zaehlung) → Rangliste friert ein.
--
-- Fix: AFTER-INSERT-Trigger auf quiz_answers aktualisiert das Leaderboard
-- atomar IN DERSELBEN Transaktion wie die Antwort. Damit ist die Zaehlung
-- immer konsistent, egal wann/ob der Client-RPC-Push laeuft. Der Client-
-- Push bleibt fuer streak_current/streak_max + display_name zustaendig
-- (stehen nicht in quiz_answers).
--
-- Cheat-Sicherheit unveraendert: RLS (insert nur eigene user_id) +
-- UNIQUE(user_id, quiz_id) + FK auf daily_quizzes begrenzen auf 1 Antwort
-- pro echtem Quiz.

CREATE OR REPLACE FUNCTION public.fn_quiz_answers_sync_leaderboard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _correct  int;
  _attempts int;
  _name     text;
BEGIN
  SELECT count(*) FILTER (WHERE is_correct), count(*)
    INTO _correct, _attempts
    FROM public.quiz_answers
    WHERE user_id = NEW.user_id;

  _name := COALESCE(
    (SELECT NULLIF(TRIM(display_name), '') FROM public.profiles WHERE id = NEW.user_id),
    'GreenScan-Mitglied');

  INSERT INTO public.quiz_leaderboard
    (user_id, display_name, total_correct, total_attempts,
     streak_current, streak_max, last_active_date, updated_at)
  VALUES
    (NEW.user_id, _name, COALESCE(_correct, 0), COALESCE(_attempts, 0),
     0, 0, current_date, now())
  ON CONFLICT (user_id) DO UPDATE SET
    -- display_name + streaks NICHT anfassen: verwaltet der Client-RPC
    -- (fn_quiz_leaderboard_upsert) mit p_display_name / p_streak_*.
    total_correct    = GREATEST(public.quiz_leaderboard.total_correct,  EXCLUDED.total_correct),
    total_attempts   = GREATEST(public.quiz_leaderboard.total_attempts, EXCLUDED.total_attempts),
    last_active_date = current_date,
    updated_at       = now();

  RETURN NEW;
END $$;

-- Advisor-Hygiene (v26_51b-Muster): Trigger-Fn nicht direkt aufrufbar.
REVOKE EXECUTE ON FUNCTION public.fn_quiz_answers_sync_leaderboard() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_quiz_answers_sync_lb ON public.quiz_answers;
CREATE TRIGGER trg_quiz_answers_sync_lb
  AFTER INSERT ON public.quiz_answers
  FOR EACH ROW EXECUTE FUNCTION public.fn_quiz_answers_sync_leaderboard();

-- Backfill: Bestands-User deren Antworten bereits in quiz_answers liegen,
-- aber deren Leaderboard-Zeile eingefroren ist (das User-Symptom).
INSERT INTO public.quiz_leaderboard
  (user_id, display_name, total_correct, total_attempts, streak_current, streak_max, last_active_date, updated_at)
SELECT qa.user_id,
       COALESCE((SELECT NULLIF(TRIM(p.display_name),'') FROM public.profiles p WHERE p.id = qa.user_id), 'GreenScan-Mitglied'),
       count(*) FILTER (WHERE qa.is_correct),
       count(*),
       0, 0, current_date, now()
FROM public.quiz_answers qa
GROUP BY qa.user_id
ON CONFLICT (user_id) DO UPDATE SET
  total_correct    = GREATEST(public.quiz_leaderboard.total_correct,  EXCLUDED.total_correct),
  total_attempts   = GREATEST(public.quiz_leaderboard.total_attempts, EXCLUDED.total_attempts),
  updated_at       = now();
