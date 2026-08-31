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
