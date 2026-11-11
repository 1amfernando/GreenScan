-- ══════════════════════════════════════════════════════════════════════════
-- v32.65 · QUIZ-RANGLISTE: der Server-Trigger kannte nur eines von drei
--          Frageformaten — seit dem 02.09.2026 galt JEDE Antwort als falsch
-- ══════════════════════════════════════════════════════════════════════════
--
-- BEFUND (Live-DB, nur lesend gemessen am 07.09.2026):
--   • `fn_quiz_answers_verify` (v30.95, angewandt am 01.09.2026 zwischen
--     07:13 und 18:48 UTC) leitet is_correct aus
--         daily_quizzes.options -> selected_option ->> 'is_correct'
--     ab. Das ist das Format „Array von Objekten" — 5 von 203 Fragen.
--   • 138 Fragen sind {answers:[…], correct:<int>} (so schreibt sie auch
--     knowledge-bulk-gen), 60 sind {choices:[…], correct:<int>}. Bei einem
--     Objekt liefert `-> <int>` NULL, COALESCE macht daraus false.
--   • Folge: 198 von 203 Fragen (97,5 %) sind seit dem 01.09. für niemanden
--     richtig zu beantworten. Belegt: am 04.09. wählten drei Personen bei
--     „Schlehe" dieselbe Option 1 = correct 1 — alle drei stehen als falsch.
--     Fernandos Meldung: „Rangliste sieht aus wie die letzten Tage, obwohl
--     ich die Antwort mehrmals richtig hatte." Genau das.
--   • Der Client zeigte derweil „🎉 Richtig!" — er kennt alle drei Formate
--     (`_gsQuizToSupaShape`, v30.32). Zwei Regeln für dieselbe Frage, und
--     nur eine davon hat die Formate gelernt.
--   • `fn_grant_quiz_top3_pro` (Jahresende, 1 Jahr Pro für die Top 3) zählt
--     mit derselben Ableitung — hätte am 31.12. mit 5 von 203 Fragen gerankt.
--
-- FIX — EINE Funktion für „ist Option i richtig?", die alle drei Formate
-- kennt, und alle Leser benutzen sie:
--
--   1) `fn_quiz_option_correct(options, idx)` → true / false / NULL.
--      NULL heisst „nicht prüfbar" (unbekanntes Format, Index ausserhalb).
--      IMMUTABLE, wirft nie: ein Wert, den sie nicht lesen kann, ist NULL,
--      kein Abbruch der Antwort-Speicherung.
--   2) `fn_quiz_answers_verify` ruft sie. Nicht prüfbar → is_correct false
--      (wie bisher: im Zweifel nicht anrechnen) — aber SICHTBAR: eine Zeile
--      in system_events (`quiz` / `antwort_nicht_pruefbar`). Genau diese
--      Zeile hätte den Fehler am 02.09. gemeldet statt am 07.09.
--      Und beim UPDATE bleibt `answered_on` stehen — vorher hätte jedes
--      Nachrechnen alle Antworten auf heute umdatiert.
--   3) `fn_grant_quiz_top3_pro` zählt mit derselben Funktion.
--   4) Nachrechnen: alle Antworten MIT Index werden neu bewertet (die 24
--      Altzeilen ohne Index bleiben, wie sie sind — sie sind nicht prüfbar
--      und wurden nie umgeschrieben). Erwartung aus der Lese-Messung vom
--      07.09.: 5 Zeilen kippen auf richtig (2 · 1 · 2), keine auf falsch.
--   5) Rangliste nachziehen: total_correct/total_attempts = GREATEST(alt,
--      Zählung) — dieselbe „kein Rückschritt"-Regel wie in v26.72/v30.80.
--   6) Zweiter Block, eigene Transaktion: ein CHECK auf daily_quizzes, dass
--      jede Frage in einem der drei Formate steht (Option 0 muss entscheidbar
--      sein). Heute erfüllen es alle 203 (gemessen). Eine künftige Frage in
--      einem vierten Format scheitert damit LAUT beim Einfügen, statt still
--      für alle unbeantwortbar zu sein.
--
-- Was diese Datei NICHT tut: die 198 Fragen in ein Format umschreiben. Der
-- Client, die View und der Generator kennen alle drei; eine Umschreibung
-- wäre ein zweiter Eingriff mit eigenem Risiko. Wer es je vereinheitlicht,
-- nimmt {answers, correct} — das Format des Generators.
--
-- Geprüft mit: `node scripts/quiz_check.js` (lokales Postgres 16, spielt
-- v30.80 → v30.95 → diese Datei nach und misst vor und nach der Reparatur).
-- Idempotent: CREATE OR REPLACE, UPDATE nur bei Abweichung, CHECK mit
-- IF NOT EXISTS-Wächter.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

-- (1) Die eine Frage: ist Option <idx> dieser Frage richtig?
CREATE OR REPLACE FUNCTION public.fn_quiz_option_correct(p_options jsonb, p_idx integer)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'pg_catalog'
AS $$
  SELECT CASE
    WHEN p_options IS NULL OR p_idx IS NULL OR p_idx < 0 THEN NULL
    -- Format A · [{label|text, is_correct|correct, explanation}, …]
    WHEN jsonb_typeof(p_options) = 'array' THEN
      CASE
        WHEN p_idx >= jsonb_array_length(p_options) THEN NULL
        WHEN jsonb_typeof(p_options -> p_idx) <> 'object' THEN NULL
        WHEN (p_options -> p_idx) ? 'is_correct'
          THEN lower(p_options -> p_idx ->> 'is_correct') IN ('true', 't', '1')
        WHEN jsonb_typeof(p_options -> p_idx -> 'correct') = 'boolean'
          THEN (p_options -> p_idx ->> 'correct') = 'true'
        ELSE NULL
      END
    -- Format B · {answers:[…], correct:<int>}   (Generator, 138 Fragen)
    -- Format C · {choices:[…], correct:<int>}   (Altbestand, 60 Fragen)
    WHEN jsonb_typeof(p_options) = 'object'
         AND jsonb_typeof(COALESCE(p_options -> 'answers', p_options -> 'choices')) = 'array'
         AND jsonb_typeof(COALESCE(p_options -> 'correct', p_options -> 'correct_idx')) = 'number' THEN
      CASE
        WHEN p_idx >= jsonb_array_length(COALESCE(p_options -> 'answers', p_options -> 'choices')) THEN NULL
        ELSE p_idx = trunc((COALESCE(p_options -> 'correct', p_options -> 'correct_idx'))::text::numeric)::int
      END
    ELSE NULL
  END
$$;

COMMENT ON FUNCTION public.fn_quiz_option_correct(jsonb, integer) IS
  'v32.65: ist Option idx richtig? Kennt Array-Objekte {is_correct}, {answers,correct} und {choices,correct}. NULL = nicht prüfbar (Format unbekannt, Index ausserhalb). Wirft nie. Einzige Regel dafür — Trigger und Jahres-Ranking rufen sie.';

REVOKE EXECUTE ON FUNCTION public.fn_quiz_option_correct(jsonb, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_quiz_option_correct(jsonb, integer) TO authenticated, anon, service_role;

-- (2) Der Trigger ruft sie — und sagt, wenn er nicht prüfen kann.
CREATE OR REPLACE FUNCTION public.fn_quiz_answers_verify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_correct boolean;
  v_xp      integer;
  v_options jsonb;
BEGIN
  -- Ein Nachrechnen (UPDATE) datiert nichts um. Vorher stand hier für beide
  -- Fälle CURRENT_DATE — jede Korrektur hätte alle Antworten auf heute gesetzt.
  IF TG_OP = 'UPDATE' THEN
    NEW.answered_on := COALESCE(OLD.answered_on, NEW.answered_on, CURRENT_DATE);
  ELSE
    NEW.answered_on := CURRENT_DATE;
  END IF;

  -- Ohne nachschlagbaren Index ist die Antwort nicht prüfbar → gilt als falsch.
  IF NEW.quiz_id IS NULL OR NEW.selected_option IS NULL OR NEW.selected_option < 0 THEN
    NEW.is_correct := false;
    NEW.xp_earned  := 0;
    RETURN NEW;
  END IF;

  SELECT q.options, COALESCE(q.xp_reward, 10)
    INTO v_options, v_xp
    FROM public.daily_quizzes q
   WHERE q.id = NEW.quiz_id;

  v_correct := public.fn_quiz_option_correct(v_options, NEW.selected_option);

  -- Nicht prüfbar ist ein dritter Zustand. Er zählt nicht (im Zweifel nicht
  -- anrechnen) — aber er wird gesagt, damit ein viertes Format nicht wieder
  -- fünf Tage lang still jede Antwort verwirft.
  IF v_correct IS NULL THEN
    BEGIN
      INSERT INTO public.system_events (severity, source, event, detail)
      VALUES ('warn', 'quiz', 'antwort_nicht_pruefbar',
              jsonb_build_object('quiz_id', NEW.quiz_id, 'selected_option', NEW.selected_option,
                                 'format', COALESCE(jsonb_typeof(v_options), 'null'),
                                 'schluessel', CASE WHEN jsonb_typeof(v_options) = 'object'
                                                    THEN (SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(v_options) k)
                                                    ELSE NULL END));
    EXCEPTION WHEN OTHERS THEN
      NULL;   -- die Meldung darf die Antwort nie verhindern
    END;
  END IF;

  NEW.is_correct := COALESCE(v_correct, false);
  NEW.xp_earned  := CASE WHEN v_correct THEN v_xp ELSE 0 END;
  RETURN NEW;
END; $function$;

COMMENT ON FUNCTION public.fn_quiz_answers_verify() IS
  'v32.65: leitet is_correct/xp_earned serverseitig über fn_quiz_option_correct ab (alle drei Frageformate). Nicht prüfbar → false + system_events(quiz/antwort_nicht_pruefbar). UPDATE datiert answered_on nicht um. Der vom Client geschickte Wert wird verworfen.';

DROP TRIGGER IF EXISTS trg_quiz_answers_verify ON public.quiz_answers;
CREATE TRIGGER trg_quiz_answers_verify
  BEFORE INSERT OR UPDATE ON public.quiz_answers
  FOR EACH ROW EXECUTE FUNCTION public.fn_quiz_answers_verify();

-- (3) Das Jahres-Ranking zählt mit derselben Funktion.
CREATE OR REPLACE FUNCTION public.fn_grant_quiz_top3_pro()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
declare v_ids uuid[]; v_n int := 0; v_uid uuid;
begin
  -- v30.95: Ranking aus quiz_answers, JEDE Zeile gegen daily_quizzes.options
  -- gegengeprüft. v32.65: über fn_quiz_option_correct — die alte Ableitung
  -- kannte nur das Array-Format (5 von 203 Fragen). Zeilen ohne
  -- selected_option (Altbestand) sind nicht prüfbar und zählen nicht mit.
  select array_agg(user_id) into v_ids from (
    select qa.user_id
    from public.quiz_answers qa
    join public.daily_quizzes dq on dq.id = qa.quiz_id
    group by qa.user_id
    having count(*) filter (
             where coalesce(public.fn_quiz_option_correct(dq.options, qa.selected_option), false)
           ) >= 1
    order by count(*) filter (
               where coalesce(public.fn_quiz_option_correct(dq.options, qa.selected_option), false)
             ) desc,
             count(distinct qa.answered_on) desc,
             min(qa.created_at) asc
    limit 3
  ) t;
  if v_ids is null then
    insert into public.system_events(severity, source, event, detail)
    values ('info', 'quiz_reward', 'top3_grant', jsonb_build_object('granted', 0, 'reason', 'no_verified_players', 'source', 'quiz_answers_verified'));
    return jsonb_build_object('ok', true, 'granted', 0);
  end if;
  foreach v_uid in array v_ids loop
    update public.profiles
       set comp_tier = 'pro',
           comp_expires_at = now() + interval '1 year',
           comp_granted_by = null,
           comp_granted_at = now()
     where id = v_uid and coalesce(comp_tier, '') <> 'lifetime';
    if found then v_n := v_n + 1; end if;
  end loop;
  insert into public.system_events(severity, source, event, detail)
  values (case when v_n > 0 then 'warn' else 'info' end, 'quiz_reward', 'top3_grant',
          jsonb_build_object('granted', v_n, 'user_ids', to_jsonb(v_ids), 'source', 'quiz_answers_verified_yearend',
                             'expires', (now() + interval '1 year')));
  return jsonb_build_object('ok', true, 'granted', v_n, 'user_ids', to_jsonb(v_ids));
end
$function$;

-- (4) Nachrechnen — nur Zeilen mit Index, nur bei Abweichung. Der Trigger
--     läuft dabei mit (BEFORE UPDATE) und rechnet dasselbe; answered_on bleibt.
UPDATE public.quiz_answers qa
   SET is_correct = COALESCE(public.fn_quiz_option_correct(q.options, qa.selected_option), false),
       xp_earned  = CASE WHEN public.fn_quiz_option_correct(q.options, qa.selected_option)
                         THEN COALESCE(q.xp_reward, 10) ELSE 0 END
  FROM public.daily_quizzes q
 WHERE q.id = qa.quiz_id
   AND qa.selected_option IS NOT NULL
   AND qa.is_correct IS DISTINCT FROM COALESCE(public.fn_quiz_option_correct(q.options, qa.selected_option), false);

-- (5) Rangliste nachziehen — kein Rückschritt (GREATEST), wie v26.72/v30.80.
UPDATE public.quiz_leaderboard ql
   SET total_correct    = GREATEST(ql.total_correct,  s.n_correct),
       total_attempts   = GREATEST(ql.total_attempts, s.n_attempts),
       updated_at       = now()
  FROM (SELECT user_id,
               count(*) FILTER (WHERE is_correct) AS n_correct,
               count(*)                            AS n_attempts
          FROM public.quiz_answers
         GROUP BY user_id) s
 WHERE s.user_id = ql.user_id
   AND (s.n_correct > ql.total_correct OR s.n_attempts > ql.total_attempts);

-- Wer Antworten hat, aber noch keine Zeile in der Rangliste (Backfill wie v30.80).
INSERT INTO public.quiz_leaderboard
  (user_id, display_name, total_correct, total_attempts, streak_current, streak_max, last_active_date, updated_at)
SELECT qa.user_id,
       COALESCE((SELECT NULLIF(TRIM(p.display_name), '') FROM public.profiles p WHERE p.id = qa.user_id), 'GreenScan-Mitglied'),
       count(*) FILTER (WHERE qa.is_correct),
       count(*),
       0, 0, current_date, now()
  FROM public.quiz_answers qa
 GROUP BY qa.user_id
ON CONFLICT (user_id) DO NOTHING;

COMMIT;

-- (6) Eigene Transaktion: scheitert der CHECK (eine Frage in einem vierten
--     Format), bleibt die Reparatur oben trotzdem angewandt — und die
--     Fehlermeldung nennt die Zeile.
BEGIN;

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.daily_quizzes'::regclass
                    AND conname  = 'daily_quizzes_options_format_chk') THEN
    ALTER TABLE public.daily_quizzes
      ADD CONSTRAINT daily_quizzes_options_format_chk
      CHECK (public.fn_quiz_option_correct(options, 0) IS NOT NULL);
  END IF;
END $do$;

COMMENT ON CONSTRAINT daily_quizzes_options_format_chk ON public.daily_quizzes IS
  'v32.65: jede Frage muss in einem Format stehen, das fn_quiz_option_correct lesen kann — sonst wäre sie für alle unbeantwortbar (so geschehen 01.–07.09.2026 für 198 von 203 Fragen).';

COMMIT;
