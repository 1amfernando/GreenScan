-- ══════════════════════════════════════════════════════════════════════════
-- v30.95 · SICHERHEIT: quiz_answers.is_correct kam vom Client — und entschied
--          über ein Jahr PRO gratis
-- ══════════════════════════════════════════════════════════════════════════
--
-- BEFUND:
--   • Einzige INSERT-Policy `quiz_answers_insert_auth` prüft nur
--     `(SELECT auth.uid()) = user_id` — KEINE Bedingung an `is_correct`.
--   • Das Frontend schickt den Wert roh (index.html: dq-Pfad und Supa-Pfad);
--     die „Korrektheit" stammt aus einem data-Attribut im DOM.
--   • Kein Default, kein CHECK, `is_generated = NEVER`, einziger Trigger ist
--     AFTER INSERT (Leaderboard-Sync).
--   • `role_table_grants`: `authenticated` UND `anon` haben volles
--     INSERT/UPDATE/DELETE auf quiz_answers.
--   • Konsument: `fn_grant_quiz_top3_pro()` rankt
--     `count(*) filter (where qa.is_correct) desc limit 3` und setzt
--     `comp_tier='pro', comp_expires_at = now() + interval '1 year'`.
--     Cron jobid=23 `quiz-top3-yearend`, '0 23 31 12 *', active.
--
--   Wirkung: jeder eingeloggte Nutzer konnte mit ein paar POSTs auf
--   /rest/v1/quiz_answers (is_correct:true) den Zähler maximieren und am
--   31.12. ein Jahr PRO geschenkt bekommen. Bei aktuell 10 echten richtigen
--   Antworten insgesamt ist die Top-3-Hürde trivial — die geringe Nutzung
--   macht die Lücke schlimmer, nicht harmloser.
--
--   Der Kommentar IN der Funktion war nachweislich falsch:
--   „FK->daily_quizzes + UNIQUE(user_id,quiz_id) = unfälschbarer Korrekt-Count".
--   FK und UNIQUE begrenzen die ANZAHL Zeilen, nicht den WAHRHEITSWERT.
--
-- FIX — die Wahrheit steht in der DB, also entscheidet die DB:
--
--   1) BEFORE INSERT/UPDATE-Trigger überschreibt `is_correct` mit dem Wert aus
--      `daily_quizzes.options[selected_option].is_correct`. Der Client darf
--      weiter schicken, was er will — es wird schlicht ersetzt. Kein REVOKE
--      auf INSERT nötig, also auch keine Reihenfolge-Abhängigkeit zum
--      Frontend-Deploy und kein Bruch für Nutzer mit altem Cache-Stand.
--      Gleich mitgenommen: `xp_earned` aus `daily_quizzes.xp_reward` statt vom
--      Client, `answered_on` auf CURRENT_DATE (kein Rückdatieren).
--
--   2) UPDATE und DELETE für `anon`/`authenticated` entzogen. Ohne das wäre
--      der Trigger umgehbar: erst sauber einfügen, dann `is_correct` per PATCH
--      umbiegen. Es gibt im Frontend keinen einzigen UPDATE/DELETE-Pfad auf
--      diese Tabelle. INSERT bleibt (die Policy prüft weiter auth.uid()).
--
--   3) `fn_grant_quiz_top3_pro` zählt nur noch Antworten, die gegen
--      `daily_quizzes` GEGENGEPRÜFT werden können und dort auch wirklich
--      richtig sind. Das schliesst zugleich die 24 Altzeilen aus, die alle
--      `selected_option IS NULL` haben (davon 10 als „richtig" markiert) und
--      damit nachträglich nicht mehr überprüfbar sind.
--      Ausserdem: falscher Kommentar korrigiert.
--
-- HINWEIS ZUM FRONTEND (gehört zu v30.95, index.html):
--   Der Supa-Quiz-Pfad mischt die Antwortoptionen clientseitig. Die angezeigte
--   Reihenfolge entspricht also NICHT der DB-Reihenfolge. Damit der Trigger
--   überhaupt nachschlagen kann, stempelt das Frontend jetzt vor dem Mischen
--   den DB-Index auf jede Option (`_idx` → `data-idx`) und schickt ihn als
--   `selected_option` mit. Ohne Index gilt eine Antwort als nicht überprüfbar
--   und zählt als falsch — bewusst so, „im Zweifel nicht anrechnen".
--
-- Idempotent: CREATE OR REPLACE + DROP TRIGGER IF EXISTS + REVOKE.
-- ══════════════════════════════════════════════════════════════════════════

-- Alles-oder-nichts: ein Syntaxfehler darf nicht die Haelfte der Datei anwenden.
BEGIN;

CREATE OR REPLACE FUNCTION public.fn_quiz_answers_verify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_correct boolean;
  v_xp      integer;
BEGIN
  -- Ohne nachschlagbaren Index ist die Antwort nicht überprüfbar → gilt als falsch.
  IF NEW.quiz_id IS NULL OR NEW.selected_option IS NULL OR NEW.selected_option < 0 THEN
    NEW.is_correct := false;
    NEW.xp_earned  := 0;
    NEW.answered_on := CURRENT_DATE;
    RETURN NEW;
  END IF;

  SELECT COALESCE((q.options -> NEW.selected_option ->> 'is_correct')::boolean, false),
         COALESCE(q.xp_reward, 10)
    INTO v_correct, v_xp
    FROM public.daily_quizzes q
   WHERE q.id = NEW.quiz_id;

  -- Unbekannte quiz_id (FK sollte das verhindern) → ebenfalls nicht anrechnen.
  NEW.is_correct  := COALESCE(v_correct, false);
  NEW.xp_earned   := CASE WHEN COALESCE(v_correct, false) THEN COALESCE(v_xp, 10) ELSE 0 END;
  NEW.answered_on := CURRENT_DATE;
  RETURN NEW;
END; $function$;

COMMENT ON FUNCTION public.fn_quiz_answers_verify() IS
  'v30.95: leitet is_correct/xp_earned serverseitig aus daily_quizzes.options[selected_option] ab. Der vom Client geschickte Wert wird verworfen.';

DROP TRIGGER IF EXISTS trg_quiz_answers_verify ON public.quiz_answers;
CREATE TRIGGER trg_quiz_answers_verify
  BEFORE INSERT OR UPDATE ON public.quiz_answers
  FOR EACH ROW EXECUTE FUNCTION public.fn_quiz_answers_verify();

-- (2) Ohne das waere der Trigger per nachtraeglichem PATCH umgehbar.
REVOKE UPDATE, DELETE ON public.quiz_answers FROM anon, authenticated;

-- (3) Nur gegenpruefbare und tatsaechlich richtige Antworten zaehlen.
CREATE OR REPLACE FUNCTION public.fn_grant_quiz_top3_pro()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
declare v_ids uuid[]; v_n int := 0; v_uid uuid;
begin
  -- v30.95: Ranking aus quiz_answers, aber JEDE Zeile wird gegen
  -- daily_quizzes.options gegengeprueft. Der frueher hier stehende Satz
  -- "FK + UNIQUE = unfaelschbarer Korrekt-Count" war falsch: beide begrenzen
  -- die Anzahl Zeilen, nicht den Wahrheitswert. Zeilen ohne selected_option
  -- (alle 24 Altzeilen) sind nicht ueberpruefbar und zaehlen nicht mit.
  select array_agg(user_id) into v_ids from (
    select qa.user_id
    from public.quiz_answers qa
    join public.daily_quizzes dq on dq.id = qa.quiz_id
    group by qa.user_id
    having count(*) filter (
             where qa.selected_option is not null
               and coalesce((dq.options -> qa.selected_option ->> 'is_correct')::boolean, false)
           ) >= 1
    order by count(*) filter (
               where qa.selected_option is not null
                 and coalesce((dq.options -> qa.selected_option ->> 'is_correct')::boolean, false)
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

COMMIT;
