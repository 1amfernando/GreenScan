-- ══════════════════════════════════════════════════════════════════════════
-- v33.59 · SICHERHEIT: KONTO, SPEICHER, PUSH-ABOS, STARTANGEBOT
--          (Sicherheitspruefung vom 10.11.2026, Gruppe q4)
-- ══════════════════════════════════════════════════════════════════════════
--
-- BEFUND (live gelesen am 10.11.2026, nur lesend — pg_policies, pg_proc,
-- pg_trigger, storage.buckets):
--
--  A  launch_offer_usage: Policy `launch_offer_insert_own` (INSERT, roles
--     public, CHECK auth.uid() = user_id) — jedes Konto traegt sich OHNE Kauf
--     selbst in den Zaehler des Startangebots (Deckel 100) ein; hundert
--     Wegwerfkonten machen das Angebot fuer alle „ausverkauft". Die
--     SELECT-Policy fuehrt zwei private Adressen als Literal. Und
--     `launch_offer_available()` antwortet ohne Anmeldung (also auch dem
--     Service-Schluessel von stripe-checkout) immer `available: true`.
--  B  profiles: `trg_profiles_guard_protected` laeuft nur BEFORE UPDATE. Eine
--     Profilzeile, die per INSERT entsteht (Upsert der App nach einer halb
--     gescheiterten Kontoloeschung), traegt is_admin/role/tier so, wie der
--     Client sie schickt — und is_admin_user() liest genau profiles.is_admin.
--  C  user_scans / user_species (roles public, also auch anon) sowie
--     scan_corrections / species_proposals erlauben `user_id IS NULL`:
--     besitzerlose Zeilen, die niemand mehr loeschen kann (keine Kontoloeschung
--     erreicht sie). feedback_votes: anon darf JEDE Stimme mit 'anon:%'
--     loeschen (und, feedback_votes_update_own, auf eine andere Idee und
--     Richtung UMSCHREIBEN) und beliebig viele neue anlegen.
--  D  storage.buckets avatars, species-images, user-uploads: kein
--     file_size_limit, keine allowed_mime_types (alle anderen Nutzer-Buckets:
--     5–10 MB, Bildliste). Unter der Projekt-Domain liess sich HTML/SVG
--     ablegen, unbegrenzt gross.
--  E  push_subscriptions.endpoint: kein CHECK — die Push-Functions schicken
--     einen signierten POST an jede Adresse, die ein Nutzer eintraegt; und
--     kein Deckel je Nutzer (tausend Abos verlangsamen jeden Cron-Lauf).
--
-- WAS DIESE DATEI AENDERT (Signaturen bleiben alle gleich):
--  A  INSERT/UPDATE/DELETE auf launch_offer_usage nur noch service_role
--     (stripe-webhook zaehlt, delete-user raeumt). SELECT: eigene Zeile oder
--     is_admin_user() — ohne Adress-Literale. launch_offer_available() rechnet
--     ohne Anmeldung den Deckel (count < 100) statt `true` zu sagen.
--  B  fn_profiles_guard_protected kennt INSERT: legt ein Nicht-Admin eine
--     NEUE Zeile an, stehen die geschuetzten Spalten auf ihren Vorgaben
--     (is_admin false, role 'user', tier 'free', xp 0 …). Ein Upsert auf eine
--     VORHANDENE Zeile laeuft weiter in den UPDATE-Waechter. Der Trigger heisst
--     gleich und laeuft jetzt BEFORE INSERT OR UPDATE. comp_granted_at ist neu
--     geschuetzt (stand bisher nicht in der Liste).
--  C  INSERT in die vier Tabellen nur `TO authenticated` mit
--     user_id = auth.uid() (nicht NULL). feedback_votes: Stimmen nur noch
--     angemeldet, eigener voter_key = auth.uid()::text — INSERT, UPDATE und
--     DELETE (die App verlangt seit
--     v25.33 eine Anmeldung, der anon-Zweig im Client ist ohne Weg dorthin).
--  D  Limits je Bucket (Bilder, 5 MB; user-uploads 10 MB mit PDF).
--  E  CHECK `push_subscriptions_endpoint_push_dienst` (NOT VALID — der Bestand
--     wird nicht geprueft, nur neue und geaenderte Zeilen): https und ein
--     bekannter Push-Dienst (dieselbe Liste wie PUSH_HOSTS in
--     supabase/functions/_shared/push_helfer.mjs). Trigger
--     `trg_push_subs_deckel`: hoechstens 10 Abos je Nutzer — das NEUE gewinnt,
--     die aeltesten fallen weg (ein neues Geraet wird nie abgewiesen).
--
-- BEWUSST NICHT HIER:
--  - fn_is_role / fn_role_at_least bleiben fuer anon ausfuehrbar: Policies mit
--    roles=public (social_posts, quests, profiles, feedback_items,
--    post_comments, plant_diagnoses) werten sie fuer anon aus — ein REVOKE
--    machte aus „0 Zeilen" ein „permission denied". Beide Funktionen geben
--    anon ohnehin nur false (scripts/rls/40_konto.js zeigt beides).
--  - ALTER DEFAULT PRIVILEGES: eine Entscheidung, siehe FUER-FERNANDO.
--  - der globale KI-Schluessel: 20260907_global_api_key_nur_proxy.sql, danach
--    der Schluesselwechsel (Handgriff, kein SQL).
--
-- WAS DIE APP DAVON MERKT: nichts im Normalbetrieb. gsCheckLaunchAvailable
-- liest seit v33.59 `available` aus dem Objekt (vorher: immer „verfuegbar").
-- Ein Abo mit fremder Adresse, eine Stimme ohne Anmeldung und ein Scan ohne
-- Konto werden abgewiesen.
--
-- NICHT ANGEWANDT — Fernando. Idempotent; nachgespielt in
-- scripts/rls/40_konto.js (zweimal eingespielt, Angriff vorher/nachher).
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── A · Startangebot ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS launch_offer_insert_own ON public.launch_offer_usage;
DROP POLICY IF EXISTS launch_offer_usage_select ON public.launch_offer_usage;
CREATE POLICY launch_offer_usage_select ON public.launch_offer_usage
  FOR SELECT TO authenticated
  USING (((SELECT auth.uid()) = user_id) OR (SELECT public.is_admin_user()));
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.launch_offer_usage FROM anon, authenticated;
REVOKE ALL ON public.launch_offer_usage FROM anon;

CREATE OR REPLACE FUNCTION public.launch_offer_available()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_used boolean; v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM public.launch_offer_usage;
  -- v33.59: ohne Anmeldung (auch der Service-Schluessel) galt immer „verfuegbar".
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('available', v_count < 100, 'logged_in', false, 'claimed', v_count);
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.launch_offer_usage WHERE user_id = auth.uid()) INTO v_used;
  RETURN jsonb_build_object('available', (v_count < 100) AND NOT v_used, 'logged_in', true, 'claimed', v_count);
END; $function$;

-- ── B · profiles: der Waechter kennt INSERT ─────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_profiles_guard_protected()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- v33.59: eine NEU angelegte Zeile eines Nicht-Admins bekommt die Vorgaben.
  -- Ein Upsert auf eine vorhandene Zeile geht weiter (er endet im UPDATE unten).
  IF TG_OP = 'INSERT' THEN
    IF current_user IN ('authenticated','anon')
       AND (current_user = 'anon' OR NOT coalesce(is_admin_user(), false))
       AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = NEW.id) THEN
      NEW.tier := 'free';          NEW.is_admin := false;      NEW.role := 'user';
      NEW.is_expert := false;      NEW.is_lifetime := false;
      NEW.comp_tier := NULL;       NEW.comp_expires_at := NULL;
      NEW.comp_granted_by := NULL; NEW.comp_granted_at := NULL;
      NEW.role_assigned_by := NULL; NEW.role_assigned_at := now();
      NEW.quiz_elo := 1200;        NEW.battles_won := 0; NEW.battles_lost := 0; NEW.battles_tied := 0;
      NEW.level := 1;              NEW.xp := 0;
    END IF;
    RETURN NEW;
  END IF;
  IF current_user IN ('authenticated','anon') AND NOT coalesce(is_admin_user(), false) THEN
    IF NEW.tier             IS DISTINCT FROM OLD.tier
       OR NEW.is_admin      IS DISTINCT FROM OLD.is_admin
       OR NEW.role          IS DISTINCT FROM OLD.role
       OR NEW.is_expert     IS DISTINCT FROM OLD.is_expert
       OR NEW.is_lifetime   IS DISTINCT FROM OLD.is_lifetime
       OR NEW.comp_tier        IS DISTINCT FROM OLD.comp_tier
       OR NEW.comp_expires_at  IS DISTINCT FROM OLD.comp_expires_at
       OR NEW.comp_granted_by  IS DISTINCT FROM OLD.comp_granted_by
       OR NEW.comp_granted_at  IS DISTINCT FROM OLD.comp_granted_at
       OR NEW.role_assigned_by IS DISTINCT FROM OLD.role_assigned_by
       OR NEW.role_assigned_at IS DISTINCT FROM OLD.role_assigned_at
       OR NEW.quiz_elo      IS DISTINCT FROM OLD.quiz_elo
       OR NEW.battles_won   IS DISTINCT FROM OLD.battles_won
       OR NEW.battles_lost  IS DISTINCT FROM OLD.battles_lost
       OR NEW.battles_tied  IS DISTINCT FROM OLD.battles_tied
       OR NEW.level         IS DISTINCT FROM OLD.level
       OR NEW.xp            IS DISTINCT FROM OLD.xp
    THEN RAISE EXCEPTION 'protected_column_change_denied' USING ERRCODE='insufficient_privilege'; END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_profiles_guard_protected ON public.profiles;
CREATE TRIGGER trg_profiles_guard_protected BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_profiles_guard_protected();

-- ── C · keine besitzerlosen Zeilen, keine Stimmen ohne Anmeldung ────────
DROP POLICY IF EXISTS user_scans_insert_own ON public.user_scans;
CREATE POLICY user_scans_insert_own ON public.user_scans
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS user_species_insert_auth ON public.user_species;
CREATE POLICY user_species_insert_auth ON public.user_species
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS scan_corrections_insert_authenticated_own ON public.scan_corrections;
CREATE POLICY scan_corrections_insert_authenticated_own ON public.scan_corrections
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS species_proposals_insert_authenticated_own ON public.species_proposals;
CREATE POLICY species_proposals_insert_authenticated_own ON public.species_proposals
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS feedback_votes_insert_own ON public.feedback_votes;
CREATE POLICY feedback_votes_insert_own ON public.feedback_votes
  FOR INSERT TO authenticated WITH CHECK (voter_key = (SELECT (auth.uid())::text));
DROP POLICY IF EXISTS feedback_votes_delete_own ON public.feedback_votes;
CREATE POLICY feedback_votes_delete_own ON public.feedback_votes
  FOR DELETE TO authenticated USING (voter_key = (SELECT (auth.uid())::text));
-- v33.59 (Schlusspruefung): auch UPDATE — live erlaubte feedback_votes_update_own
-- anon, jede 'anon:%'-Stimme auf eine andere Idee und Richtung umzuschreiben, und
-- seit 20261110_feedback_stimmen_zaehlen.sql folgen votes_up/votes_down. Das
-- Umstimmen der App (Upsert mit merge-duplicates) braucht die eigene Zeile.
DROP POLICY IF EXISTS feedback_votes_update_own ON public.feedback_votes;
CREATE POLICY feedback_votes_update_own ON public.feedback_votes
  FOR UPDATE TO authenticated
  USING (voter_key = (SELECT (auth.uid())::text))
  WITH CHECK (voter_key = (SELECT (auth.uid())::text));

-- ── D · Speicher: Groesse und Dateityp je Bucket ────────────────────────
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    -- avatars: die App laedt dort heute nichts hoch (Avatare sind Emojis) — nur Bilder.
    UPDATE storage.buckets SET file_size_limit = 5242880,
           allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']
     WHERE id IN ('avatars', 'species-images');
    -- user-uploads (privat): ebenfalls ohne Aufrufer in der App; Bilder und PDF.
    UPDATE storage.buckets SET file_size_limit = 10485760,
           allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','application/pdf']
     WHERE id = 'user-uploads';
  END IF;
END $$;

-- ── E · Push-Abos: nur bekannte Dienste, hoechstens zehn je Nutzer ──────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'push_subscriptions_endpoint_push_dienst'
                    AND conrelid = 'public.push_subscriptions'::regclass) THEN
    -- Kein Port, kein Benutzerteil: nach dem Host muss sofort „/" kommen.
    ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_endpoint_push_dienst
      CHECK (endpoint ~* '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)+notify\.windows\.com|([a-z0-9-]+\.)+push\.apple\.com)/')
      NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fn_push_subs_deckel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Nur fuer die eigene Zeile (oder service_role): eine fremde user_id weist
  -- die RLS danach ohnehin ab, und dann soll vorher nichts geloescht sein.
  IF auth.uid() IS NOT NULL AND NEW.user_id IS DISTINCT FROM auth.uid() THEN RETURN NEW; END IF;
  -- Ein Upsert auf ein vorhandenes Abo ist kein neues.
  IF EXISTS (SELECT 1 FROM public.push_subscriptions s
              WHERE s.user_id = NEW.user_id AND s.endpoint = NEW.endpoint) THEN RETURN NEW; END IF;
  DELETE FROM public.push_subscriptions s
   WHERE s.user_id = NEW.user_id
     AND s.id IN (SELECT x.id FROM public.push_subscriptions x
                   WHERE x.user_id = NEW.user_id
                   ORDER BY coalesce(x.updated_at, x.created_at) DESC NULLS LAST, x.created_at DESC NULLS LAST
                   OFFSET 9);
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.fn_push_subs_deckel() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_push_subs_deckel ON public.push_subscriptions;
CREATE TRIGGER trg_push_subs_deckel BEFORE INSERT ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.fn_push_subs_deckel();

COMMIT;
