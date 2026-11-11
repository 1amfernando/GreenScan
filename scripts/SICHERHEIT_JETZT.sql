-- ══════════════════════════════════════════════════════════════════════════
-- GreenScan — die drei Sicherheits-Migrationen in EINER Datei
-- Erstellt 01.09.2026, gegen die Live-Datenbank geprüft (lesend).
--
-- ANWENDEN: Supabase Dashboard → SQL Editor → alles einfügen → Run.
-- Idempotent: ein zweiter Lauf ändert nichts mehr.
--
-- WARUM DIESE DREI, GEPRÜFT AN DER LIVE-DB AM 01.09.2026:
--
--   A · quiz_answers  — anon UND authenticated haben INSERT, UPDATE, DELETE
--       und TRUNCATE. is_correct kommt vom Client. Der Cron jobid=23 verteilt
--       am 31.12. ein JAHR PRO gratis an die Quiz-Top-3 — entschieden über
--       eine Tabelle, die jeder beschreiben und leeren kann.
--       Geprüft: fn_quiz_answers_verify existiert nicht (0 Treffer).
--       Heutiger Umfang: 28 Antworten — der Schaden wäre klein, das Loch ist
--       trotzdem offen und der Cron läuft in vier Monaten.
--
--   B · fn_is_role / fn_role_at_least — der optionale zweite Parameter
--       beantwortet Fragen zu FREMDEN Konten, auch ohne Login. User-UUIDs
--       stehen öffentlich in social_posts.user_id → Admin-Konten sind ohne
--       Anmeldung aufzählbar.
--       Geprüft: die 2-Parameter-Fassung ist live vorhanden.
--
--   C · fn_mkt_increment_views — SECURITY DEFINER, für anon ausführbar, ohne
--       jeden Bezug auf auth.uid(). Jeder mit dem öffentlichen Anon-Schlüssel
--       kann die Aufrufzahl beliebiger Inserate hochzählen.
--       Geprüft: hat_uid_bezug = false, anon_darf = true. Die Schwester
--       fn_quiz_record_answer macht es richtig — nur diese wurde vergessen.
--
-- HINWEIS ZUR TRANSAKTION: Jede der drei Migrationen bringt ihre EIGENE
-- BEGIN/COMMIT-Klammer mit, ist also für sich atomar. Eine zusätzliche äussere
-- Klammer wäre falsch — das erste innere COMMIT würde sie beenden, und alles
-- danach liefe ungeschützt. Bricht eine ab, sind die vorherigen angewendet
-- und die folgenden nicht; alle drei sind idempotent, also einfach erneut
-- laufen lassen.
-- ══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────
-- aus supabase/migrations/20260831_quiz_antworten_serverseitig_v30_95.sql
-- ─────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────
-- aus supabase/migrations/20260831_rollen_leak_fix_v30_95.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- v30.95 · SICHERHEIT: Rollen-Auskunft über fremde User-IDs schliessen
-- ══════════════════════════════════════════════════════════════════════════
--
-- BEFUND (reproduziert als anon):
--   set local role anon;
--   select fn_is_role('admin','<uuid>');        -> true
--   select fn_role_at_least('admin','<uuid>');  -> true
--
-- Beide Funktionen sind SECURITY DEFINER (umgehen also die RLS auf profiles)
-- und haben EXECUTE für `anon`. Der zweite Parameter `_uid` ist frei wählbar.
-- Damit konnte JEDER — auch ohne Konto — zu einer beliebigen User-UUID die
-- Rolle abfragen. Und User-UUIDs stehen öffentlich in `social_posts.user_id`
-- und `v_marketplace_listings.user_id`. Ergebnis: die Admin-Konten der App
-- liessen sich ohne Login aufzählen — ideale Vorarbeit für gezielte Angriffe.
--
-- WARUM NICHT EINFACH `REVOKE EXECUTE FROM anon`:
--   Die RLS-Policies `social_posts_select_all`, `quests_select_all` u. a.
--   rufen `fn_role_at_least('staff')` auf. Diese Policies werden AUCH für
--   anon ausgewertet, wenn ein Gast den Community-Feed liest. Ein REVOKE
--   würde also das Gast-Browsing zerschiessen. Der Parameter ist das Problem,
--   nicht die Funktion.
--
-- FIX: Die Auskunft über eine FREMDE UUID gibt es nur noch für Staff/Admin.
--   Ohne `_uid` (bzw. mit der eigenen) verhalten sich beide Funktionen exakt
--   wie bisher — genau so werden sie überall aufgerufen:
--     · alle 16 RLS-Policies:  fn_is_role('admin') / fn_role_at_least('staff')
--     · fn_set_global_api_key: fn_is_role('admin')
--     · Frontend + Edge-Functions: 0 Aufrufe
--   `fn_check_not_banned` nutzt `fn_user_role(NEW.user_id)` — eine andere
--   Funktion, die kein EXECUTE für anon hat und hier unangetastet bleibt.
--
-- Idempotent: reines CREATE OR REPLACE, keine Signatur-Änderung.
-- ══════════════════════════════════════════════════════════════════════════

-- Alles-oder-nichts: ein Syntaxfehler darf nicht die Haelfte der Datei anwenden.
BEGIN;

CREATE OR REPLACE FUNCTION public.fn_is_role(_role text, _uid uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT CASE
    -- Fremde UUID abgefragt und der Aufrufer ist nicht Staff/Admin -> keine Auskunft.
    WHEN _uid IS NOT NULL
     AND _uid IS DISTINCT FROM (SELECT auth.uid())
     AND NOT EXISTS (
           SELECT 1 FROM public.profiles me
           WHERE me.id = (SELECT auth.uid()) AND me.role IN ('admin','staff')
         )
    THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = COALESCE(_uid, (SELECT auth.uid())) AND role = _role
    )
  END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_role_at_least(_required text, _uid uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT CASE
    WHEN _uid IS NOT NULL
     AND _uid IS DISTINCT FROM (SELECT auth.uid())
     AND NOT EXISTS (
           SELECT 1 FROM public.profiles me
           WHERE me.id = (SELECT auth.uid()) AND me.role IN ('admin','staff')
         )
    THEN false
    WHEN _required = 'admin'  THEN public.fn_user_role(_uid) = 'admin'
    WHEN _required = 'staff'  THEN public.fn_user_role(_uid) IN ('admin','staff')
    WHEN _required = 'expert' THEN public.fn_user_role(_uid) IN ('admin','staff','expert')
    WHEN _required = 'user'   THEN public.fn_user_role(_uid) IN ('admin','staff','expert','user')
    ELSE false
  END;
$function$;

COMMENT ON FUNCTION public.fn_is_role(text, uuid) IS
  'v30.95: Rollen-Check. Der optionale _uid-Parameter beantwortet Fragen zu FREMDEN Konten nur noch fuer Staff/Admin — vorher konnte anon damit die Admin-Konten aufzaehlen.';
COMMENT ON FUNCTION public.fn_role_at_least(text, uuid) IS
  'v30.95: Rollen-Hierarchie-Check. Der optionale _uid-Parameter beantwortet Fragen zu FREMDEN Konten nur noch fuer Staff/Admin (siehe fn_is_role).';

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────
-- aus supabase/migrations/v31_36_mkt_views_auth_guard.sql
-- ─────────────────────────────────────────────────────────────────────────
-- v31.36: fn_mkt_increment_views gegen anonyme Aufrufe absichern. NOCH NICHT ANGEWENDET.
--
-- Gefunden am 01.09.2026 beim Durchgehen der 16 anon-ausfuehrbaren
-- SECURITY-DEFINER-Funktionen (Supabase-Security-Advisor). Der Zaehler war die
-- einzige davon, die SCHREIBT und sich dabei nicht absichert:
--
--   UPDATE marketplace_listings SET views = COALESCE(views,0)+1 WHERE id = p_listing_id;
--
-- Der Anon-Key ist oeffentlich (by design, RLS schuetzt die Daten). Damit kann
-- jeder ohne Konto die Aufrufzahl beliebiger Inserate hochzaehlen — in einer
-- Schleife auch als kleine Schreiblast. Kein Datenabfluss, kein Datenverlust;
-- eine irrefuehrende Kennzahl und eine unnoetige offene Schreibstelle.
--
-- Zum Vergleich: fn_quiz_record_answer macht es richtig und beginnt mit
--   v_uid uuid := (SELECT auth.uid());
--   IF v_uid IS NULL THEN RETURN; END IF;
-- Genau dieses Muster kommt hier dazu.
--
-- Bricht nichts: der einzige Aufrufer ist openListingDetail() (index.html
-- ~Z. 37750), erreichbar aus Marktplatz-Liste und Home-Widget. Beide setzen
-- eine Anmeldung voraus — der Gast-Modus wurde in v25.33 abgeschaltet.
-- Ein anonymer Aufruf tut danach schlicht nichts, statt zu schreiben.
--
-- Idempotent (CREATE OR REPLACE). Rueckgaengig: dieselbe Funktion ohne die
-- drei IF-Zeilen neu anlegen.

create or replace function public.fn_mkt_increment_views(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := (select auth.uid());
begin
  -- v31.36: ohne angemeldeten Nutzer nichts tun (vorher: jeder Aufruf schrieb).
  if v_uid is null then return; end if;

  update marketplace_listings
  set views = coalesce(views, 0) + 1
  where id = p_listing_id;
end $function$;

-- Verifikation nach dem Anwenden:
--   select pg_get_functiondef(p.oid)
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname='public' and p.proname='fn_mkt_increment_views';
-- Erwartet: enthaelt "if v_uid is null then return".

-- ══════════════════════════════════════════════════════════════════════════
-- GEGENPROBE — nach dem Lauf ausführen. Alle drei Spalten müssen `t` sein.
-- ══════════════════════════════════════════════════════════════════════════
-- select
--   (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--      where n.nspname='public' and p.proname='fn_quiz_answers_verify') = 1  as A_quiz_geprueft,
--   (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--      where n.nspname='public' and p.proname='fn_is_role' and p.pronargs=2) = 0
--     or (select pg_get_functiondef(p.oid) ilike '%staff%' from pg_proc p
--         join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
--         and p.proname='fn_is_role' and p.pronargs=2)                      as B_rollen_dicht,
--   (select pg_get_functiondef(p.oid) ilike '%auth.uid()%' from pg_proc p
--      join pg_namespace n on n.oid=p.pronamespace
--     where n.nspname='public' and p.proname='fn_mkt_increment_views')      as C_views_geschuetzt;

-- ══════════════════════════════════════════════════════════════════════════
-- D · OPTIONAL — Härtung der Standard-Grants (KEIN Notfall)
-- ══════════════════════════════════════════════════════════════════════════
--
-- Beim Prüfen von C aufgefallen: anon und authenticated haben auf ALLEN
-- 200 Tabellen des public-Schemas TRUNCATE, REFERENCES und TRIGGER. Das ist
-- der Supabase-Standard-Grant (GRANT ALL ... TO anon, authenticated), nicht
-- etwas, das jemand hier absichtlich gesetzt hat.
--
-- WIE SCHLIMM IST DAS WIRKLICH? Ich habe es nachgeprüft statt es zu raten:
--
--   • TRUNCATE unterliegt KEINER RLS — wer das Recht hat, leert die Tabelle,
--     egal welche Policies darauf liegen. So weit die schlechte Nachricht.
--   • ABER: über die öffentliche API ist es nicht erreichbar. PostgREST hat
--     kein Verb für TRUNCATE, und der Anon-Schlüssel ist ein PostgREST-JWT,
--     kein Postgres-Login.
--   • Der einzige denkbare Umweg wäre eine anon-aufrufbare Funktion, die
--     dynamisches SQL ausführt. Geprüft: es gibt KEINE EINZIGE (0 Treffer).
--
-- Also: kein offenes Loch, sondern unnötig weite Rechte. Verteidigung in der
-- Tiefe — wenn je eine Funktion mit dynamischem SQL dazukommt oder ein
-- Verbindungsweg sich ändert, ist der Schaden dann schon begrenzt.
--
-- Die App verliert dadurch nichts: sie schreibt ausschliesslich über
-- PostgREST (SELECT/INSERT/UPDATE/DELETE) und über RPCs. TRUNCATE, REFERENCES
-- und TRIGGER braucht sie an keiner Stelle.
--
-- Auskommentiert, weil es breit wirkt: erst lesen, dann einkommentieren.
--
-- revoke truncate, references, trigger on all tables in schema public
--   from anon, authenticated;
-- alter default privileges in schema public
--   revoke truncate, references, trigger on tables from anon, authenticated;
--
-- Gegenprobe danach (muss 0 liefern):
-- select count(*) from information_schema.role_table_grants
--  where table_schema='public' and privilege_type='TRUNCATE'
--    and grantee in ('anon','authenticated');
