-- 20261110_sicherheit_community_markt.sql — Community und Marktplatz: was die
-- Datenbank selbst haelt, statt es der App zu glauben (v33.59).
--
-- NICHT angewandt — Fernando. Idempotent (CREATE OR REPLACE, DROP … IF EXISTS,
-- DO-Bloecke mit Existenzpruefung); zweimal eingespielt in scripts/rls/30_community.js.
--
-- LIVE gemessen am 10.11.2026 (nur lesend: pg_policies, pg_proc, pg_trigger,
-- information_schema.columns, Tabellenrechte):
--   · social_posts_update_own / marketplace_update_own erlauben dem Eigentuemer
--     JEDE Spalte. Ein vom Admin versteckter Beitrag (is_archived) bzw. ein
--     verstecktes Inserat (moderation_status='hidden') wird mit einem PATCH
--     wieder oeffentlich; likes, comments_count, is_featured, views, reports,
--     created_at und (beim Inserat, Policy ohne CHECK) sogar user_id sind frei.
--   · Die Sperre (profiles.role='banned') haengt nur BEFORE INSERT an
--     social_posts und post_comments. Bearbeiten, Inserate, Chat, oeffentliche
--     Kartenfunde, Freundschaftsanfragen: offen.
--   · user_blocks liest nur fn_follow_toggle/fn_profile_view/fn_user_search u. a.
--     Ein direkter INSERT in user_follows, ein Kommentar, eine Marktplatz-
--     Nachricht oder eine Freundschaftsanfrage an den Blockierenden geht durch.
--   · marketplace_messages: die INSERT-Policy bindet seller_id nicht an den
--     Eigentuemer des Inserats (jeder schreibt sich als „Verkaeufer" in einen
--     fremden Posteingang), und marketplace_messages_update laesst BEIDE
--     Teilnehmer jede Spalte jeder Zeile aendern — auch Text und Absender der
--     Gegenseite. Die App schreibt dort nur read_at (fn_mkt_chat_mark_read).
--   · marketplace_sellers: Policy FOR ALL an den Eigentuemer, der Status-
--     Waechter haengt nur BEFORE UPDATE und prueft nur status — charges_enabled,
--     payouts_enabled und stripe_account_id sind selbst setzbar, INSERT und
--     DELETE ungeprueft. Die App schreibt dort nie (liest v_my_marketplace_seller).
--   · user_reports_insert_own: ein direkter INSERT umgeht das Rate-Limit von
--     fn_report. Die App ruft nur rpc/fn_report.
--   · organizations: orgs_update_owner_admin ohne Spaltengrenze — max_members,
--     is_active, created_by, slug direkt per PATCH; logo_url/website ohne die
--     Pruefung, die fn_org_update macht.
--   · recipes/remedies: INSERT/UPDATE/DELETE fuer JEDEN mit is_expert. Die App
--     schreibt dort nie (nur knowledge-bulk-gen mit service_role).
--   · Bild-Adressen fremder Nutzer (social_posts.photo_url, marketplace_listings
--     .photo_url/photo_urls, map_user_finds.photo_url, profiles.avatar_url) sind
--     an keinen Host gebunden — jeder Betrachter laedt sie (Tracking-Pixel).
--   · gs_abo_can_use(uuid,text): SECURITY DEFINER, fuer authenticated
--     ausfuehrbar, liest profiles.abo_* — Spalten, die es live NICHT gibt.
--
-- Was diese Datei aendert:
--   1. Waechter-Trigger (Bauform fn_profiles_guard_protected: greift nur, wenn
--      current_user 'authenticated'/'anon' ist; SECURITY-DEFINER-Wege wie
--      toggle_post_like, fn_mkt_increment_views, fn_admin_moderate, Cron und
--      service_role laufen als Eigentuemer und bleiben frei). Sie HALTEN die
--      geschuetzten Spalten auf dem alten Wert bzw. setzen beim Anlegen die
--      Vorgabe — still, damit ein PATCH der App mit erlaubten Feldern weitergeht.
--   1a. Oeffentlicher Name (author_name beim Anlegen, profiles.display_name bei
--      jeder Aenderung — eigener Trigger 1c, fn_profiles_guard_protected bleibt
--      in 20261110_sicherheit_konto_speicher.sql —, Anmeldung ueber
--      fn_handle_new_user): gesaeubert (Steuer-, Bidi-, Null-Breite-Zeichen), auf
--      40 Zeichen gedeckelt; ein Betreiber-Name („GreenScan Team", „Аdmin",
--      „Support-Team") nur fuer Admin/Staff, sonst der Profilname bzw.
--      'Naturfreund'. author_avatar nur ein kurzes Emoji. Live keine Regel dafuer.
--   2. fn_update_comment_count wird SECURITY DEFINER — sonst hielte der neue
--      Waechter den Kommentarzaehler fest (er lief als der Kommentierende).
--   3. Sperre: fn_gs_sperre() auf marketplace_listings, marketplace_messages,
--      map_user_finds (nur oeffentlich), friendships, user_follows (INSERT und
--      UPDATE) und auf social_posts/post_comments zusaetzlich BEFORE UPDATE.
--      3a: fn_marketplace_set_status (SECURITY DEFINER, an fn_gs_sperre vorbei)
--      lehnt ein gesperrtes Konto ab; marketplace-publish (service_role) prueft
--      die Rolle selbst. Die Liste der DEFINER-Wege steht bei 3a.
--   4. Blockieren: fn_gs_block_pruefen() BEFORE INSERT auf user_follows,
--      post_comments, marketplace_messages, friendships; fn_block_toggle raeumt
--      auch offene friendships; fn_following_feed laesst Blockierte und vom
--      Admin versteckte Inserate weg.
--   5. marketplace_messages: neue INSERT-Policy (seller_id = Eigentuemer des
--      Inserats, buyer<>seller, der Verkaeufer antwortet nur in einer Unterhaltung,
--      die der Kaeufer begonnen hat); INSERT nur mit den fuenf Feldern der App;
--      UPDATE nur noch auf read_at, nur fuer den Empfaenger.
--   6. marketplace_sellers: nur noch lesen fuer den Eigentuemer; schreiben nur
--      service_role (stripe-create-connect-account, stripe-webhook).
--   7. user_reports: direkter INSERT zu; fn_report (SECURITY DEFINER) bleibt der Weg.
--   8. organizations: Waechter fuer slug, created_by, subscription_tier,
--      max_members, is_active, created_at; logo_url/website wie in fn_org_update.
--   9. recipes/remedies: schreiben nur Admins.
--  10. Bild-Adressen: ein Trigger (KEIN CHECK — ein CHECK, auch NOT VALID, wird
--      bei JEDEM Update der Zeile geprueft; ein alter fremder Avatar haette
--      sonst jeden xp-/last_login-Update des Profils scheitern lassen) prueft
--      eine NEUE bzw. GEAENDERTE Adresse aus Nutzerhand: nur der oeffentliche
--      Speicher dieses Projekts, NULL und leer bleiben erlaubt.
--  11. gs_abo_can_use: EXECUTE nur noch service_role.
--
-- Was die App davon merkt: nichts, solange sie tut, was sie heute tut. Mit
-- v33.59 laedt sie Kartenfunde ohne den lokalen Platzhalter `gsphoto://` hoch
-- (_uploadLocalOnly) — vorher landete er in der Cloud-Zeile und waere jetzt
-- abgewiesen worden. Reihenfolge: zuerst die App (v33.59) ausliefern, dann diese
-- Datei anwenden.

-- ══ 1a · Oeffentlicher Name: gesaeubert, gedeckelt, nicht als Betreiber ═════
-- v33.59: der Waechter hielt author_name nur beim UPDATE; beim INSERT ging
-- „GreenScan Team", „Аdmin" (kyrillisch) oder ein Name mit Zeilenumbruch und
-- Bidi-Zeichen in den Feed. Die App laesst die Person einen Namen WAEHLEN
-- (_gsOeffentlicherName) — deshalb nicht hart ans Profil binden, sondern
-- saeubern und nur die Betreiber-Namen sperren. EINE Regel fuer Beitrag,
-- Kommentar, Profil und Anmeldung.
CREATE OR REPLACE FUNCTION public.fn_gs_name_sauber(p text, p_max integer DEFAULT 40)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path = public, pg_temp
AS $f$
  -- Format-/Bidi-/Null-Breite-Zeichen weg (U+200D bleibt: er haelt Emoji wie 🧑‍🌾 zusammen), Steuerzeichen und Sonder-Leerraum zu
  -- einem Leerzeichen, Leerraum zusammenziehen, deckeln, leer → NULL.
  SELECT nullif(btrim(left(btrim(regexp_replace(regexp_replace(regexp_replace(coalesce(p, ''),
           '[­؜᠎​‌‎‏‪-‮⁠-⁯﻿]', '', 'g'),
           '[\u0001-\u001f\u007f-\u009f   -     　]', ' ', 'g'),
           ' {2,}', ' ', 'g')), greatest(1, p_max))), '')
$f$;

-- Reserviert: nach Kleinschreibung, ohne Akzente, mit den ueblichen Ersatzzeichen
-- (0→o 3→e 4→a 5→s 7→t @→a $→s, kyrillische/griechische Doppelgaenger der
-- lateinischen Buchstaben, 1 als i UND als l) und ohne alles ausser a–z:
-- enthaelt „greenscan" ODER ist genau ein bzw. zwei Woerter aus der Liste
-- („Support-Team", „Systemadmin"). „Greta", „Teamgeist Thun", „Administratorin
-- Anna" bleiben frei — kein exakter Treffer.
CREATE OR REPLACE FUNCTION public.fn_gs_name_reserviert(p text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path = public, pg_temp
AS $f$
  WITH b AS (
    -- Gegenpruefung: NFKC zuerst (Vollbreite „ＧｒｅｅｎＳｃａｎ“, mathematisch fett
    -- „𝐆𝐫𝐞𝐞𝐧“ → ASCII), dazu Kapitaelchen und weitere Doppelgaenger (ɢʀᴇᴇɴ, ԁ, ѕ).
    SELECT translate(translate(normalize(coalesce(public.fn_gs_name_sauber(p, 200), ''), NFKC),
             'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘʀꜱᴛᴜᴠᴡʏᴢɡɑıӏӀԁѕЅһԝ', 'abcdefghijklmnoprstuvwyzgailldsshw'),
             'àáâãäåāăąÀÁÂÃÄÅĀĂĄаАαΑ@4ВβΒçćčÇĆČсСďĎèéêëēėęěÈÉÊËĒĖĘĚеЕεΕ3НΗìíîïīįÌÍÎÏĪĮіІιΙкКκΚмМΜñńňÑŃŇΝòóôõöøōÒÓÔÕÖØŌоОοΟ0рРρΡśšşŚŠŞ5$тТτΤ7ùúûüūůÙÚÛÜŪŮхХχΧýÿÝуУΥźżžŹŻŽΖ',
             'aaaaaaaaaaaaaaaaaaaaaaaabbbccccccccddeeeeeeeeeeeeeeeeeeeeehhiiiiiiiiiiiiiiiikkkkmmmnnnnnnnoooooooooooooooooooppppsssssssstttttuuuuuuuuuuuuxxxxyyyyyyzzzzzzz') AS t
  ), v AS (
    SELECT regexp_replace(lower(translate(t, '1', 'i')), '[^a-z]', '', 'g') AS s FROM b
    UNION ALL
    SELECT regexp_replace(lower(translate(t, '1', 'l')), '[^a-z]', '', 'g') FROM b
    UNION ALL   -- Ziffern als Zierrat („Admin1“)
    SELECT regexp_replace(lower(t), '[^a-z]', '', 'g') FROM b
  )
  SELECT coalesce(bool_or(s LIKE '%greenscan%'
           OR s ~ '^(gs|das|der|die|the|dein|euer|your)?(admin|admins|administrator|administration|moderator|moderatoren|moderation|mod|mods|support|team|staff|offiziell|offizielle|offizieller|offizielles|official|system|service|helpdesk){1,3}$'), false)
  FROM v
$f$;

-- Der Name, der oeffentlich dasteht: der gewaehlte, gesaeubert; leer oder
-- reserviert → der Profilname (gesaeubert); auch der leer oder reserviert →
-- 'Naturfreund' (der Rueckfall der App). p_frei: Admin/Staff duerfen reservierte Namen.
CREATE OR REPLACE FUNCTION public.fn_gs_name_oeffentlich(p_name text, p_uid uuid, p_frei boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path = public, pg_temp
AS $f$
DECLARE v text := public.fn_gs_name_sauber(p_name, 40);
BEGIN
  IF v IS NULL OR (NOT p_frei AND public.fn_gs_name_reserviert(v)) THEN
    v := public.fn_gs_name_sauber((SELECT display_name FROM public.profiles WHERE id = p_uid), 40);
    IF v IS NULL OR (NOT p_frei AND public.fn_gs_name_reserviert(v)) THEN v := 'Naturfreund'; END IF;
  END IF;
  RETURN v;
END $f$;

-- author_avatar: die App schickt ein Emoji (profiles.avatar_emoji bzw. eines aus
-- ihrer Liste, Vorgabe der Spalte '🌿'). Ein kurzes Zeichen ohne ASCII bleibt
-- (ZWJ-Folgen wie 👨‍👩‍👧 haben bis zu 7 Codepunkte), alles andere wird '🌿'.
CREATE OR REPLACE FUNCTION public.fn_gs_avatar_sauber(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path = public, pg_temp
AS $f$
  -- Gegenpruefung: auch keine Buchstaben ausserhalb von ASCII („АДМИН“, „ＴＥＡＭ“, „管理员“).
  SELECT CASE WHEN v = '' OR char_length(v) > 8 OR v ~ '[!-~]' OR v ~ '[[:alpha:]]' THEN '🌿' ELSE v END
  FROM (SELECT regexp_replace(coalesce(p, ''),
          '[\u0001- \u007f- ؜​‌‎‏ - ⁠-⁯﻿]', '', 'g') AS v) x
$f$;

-- ══ 1 · social_posts / post_comments: Waechter ══════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_gs_beitrag_waechter()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public, pg_temp
AS $f$
DECLARE v_frei boolean;
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    v_frei := coalesce(public.is_admin_user(), false) OR coalesce(public.fn_role_at_least('staff'), false);
    IF TG_OP = 'INSERT' THEN
      -- v33.59: Name und Avatar auch beim Anlegen (1a) — Admin/Staff duerfen „Team".
      NEW.author_name   := public.fn_gs_name_oeffentlich(NEW.author_name, NEW.user_id, v_frei);
      NEW.author_avatar := public.fn_gs_avatar_sauber(NEW.author_avatar);
    END IF;
  END IF;
  IF current_user IN ('authenticated','anon') AND NOT v_frei THEN
    IF TG_OP = 'INSERT' THEN
      NEW.created_at := now();
      IF TG_TABLE_NAME = 'social_posts' THEN
        NEW.likes := 0; NEW.comments_count := 0;
        NEW.is_featured := false; NEW.is_archived := false;
      END IF;
    ELSE
      NEW.user_id       := OLD.user_id;
      NEW.created_at    := OLD.created_at;
      NEW.author_name   := OLD.author_name;
      NEW.author_avatar := OLD.author_avatar;
      IF TG_TABLE_NAME = 'social_posts' THEN
        NEW.likes          := OLD.likes;
        NEW.comments_count := OLD.comments_count;
        NEW.is_featured    := OLD.is_featured;
        NEW.is_archived    := OLD.is_archived;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $f$;

DROP TRIGGER IF EXISTS trg_gs_beitrag_waechter ON public.social_posts;
CREATE TRIGGER trg_gs_beitrag_waechter BEFORE INSERT OR UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.fn_gs_beitrag_waechter();
DROP TRIGGER IF EXISTS trg_gs_beitrag_waechter ON public.post_comments;
CREATE TRIGGER trg_gs_beitrag_waechter BEFORE INSERT OR UPDATE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.fn_gs_beitrag_waechter();

-- Der Zaehler-Trigger lief als der Kommentierende (SECURITY INVOKER) — der
-- Waechter haette seinen Schreibvorgang gehalten. Als Eigentuemer zaehlt er
-- jetzt auch auf fremden Beitraegen (vorher filterte RLS das still auf 0 Zeilen).
CREATE OR REPLACE FUNCTION public.fn_update_comment_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.social_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.social_posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- ══ 1c · profiles.display_name: dieselbe Regel (Rueckfall und Quelle) ══════
-- Der Profilname ist der Rueckfall von 1a und die Quelle fuer Marktplatz
-- (seller_name) und Rangliste (fn_quiz_leaderboard_top). Ein EIGENER Trigger —
-- fn_profiles_guard_protected aendert schon 20261110_sicherheit_konto_speicher.sql,
-- zwei Fassungen derselben Funktion in zwei Dateien gewaenne die spaetere.
-- Nur ein GEAENDERTER Name wird geprueft: ein alter reservierter Name blockiert
-- keinen xp-/last_login-Update (er faellt in 1a ohnehin auf 'Naturfreund').
CREATE OR REPLACE FUNCTION public.fn_gs_profil_name()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public, pg_temp
AS $f$
DECLARE v_alt text;
BEGIN
  IF current_user IN ('authenticated','anon')
     AND (TG_OP = 'INSERT' OR NEW.display_name IS DISTINCT FROM OLD.display_name) THEN
    NEW.display_name := public.fn_gs_name_sauber(NEW.display_name, 40);
    IF NEW.display_name IS NOT NULL AND public.fn_gs_name_reserviert(NEW.display_name)
       AND NOT (coalesce(public.is_admin_user(), false) OR coalesce(public.fn_role_at_least('staff'), false)) THEN
      IF TG_OP = 'UPDATE' THEN v_alt := OLD.display_name;
      ELSE v_alt := (SELECT p.display_name FROM public.profiles p WHERE p.id = NEW.id);  -- Upsert der App
      END IF;
      v_alt := public.fn_gs_name_sauber(v_alt, 40);
      NEW.display_name := CASE WHEN v_alt IS NULL OR public.fn_gs_name_reserviert(v_alt) THEN 'Naturfreund' ELSE v_alt END;
    END IF;
  END IF;
  RETURN NEW;
END $f$;

DROP TRIGGER IF EXISTS trg_gs_profil_name ON public.profiles;
CREATE TRIGGER trg_gs_profil_name BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_gs_profil_name();

-- Anmeldung: der Name aus raw_user_meta_data kommt aus Nutzerhand, laeuft aber als
-- Eigentuemer (SECURITY DEFINER) — 1c greift dort nicht. Wortlaut live (10.11.2026)
-- bis auf den Namen.
CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  insert into public.profiles (id, email, display_name, avatar_emoji)
  values (new.id, new.email,
          -- v33.59: gesaeubert, nie ein Betreiber-Name (1a)
          public.fn_gs_name_oeffentlich(coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), NULL, false),
          '🌿')
  on conflict (id) do update
    set email = coalesce(public.profiles.email, excluded.email);
  return new;
end;
$function$;

-- ══ 1b · marketplace_listings: Waechter ═════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_gs_inserat_waechter()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public, pg_temp
AS $f$
BEGIN
  IF current_user IN ('authenticated','anon') AND NOT coalesce(public.is_admin_user(), false) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.moderation_status := NULL; NEW.reports := 0; NEW.views := 0; NEW.created_at := now();
    ELSE
      NEW.user_id           := OLD.user_id;
      NEW.moderation_status := OLD.moderation_status;
      NEW.reports           := OLD.reports;
      NEW.views             := OLD.views;
      NEW.created_at        := OLD.created_at;
    END IF;
  END IF;
  RETURN NEW;
END $f$;

DROP TRIGGER IF EXISTS trg_gs_inserat_waechter ON public.marketplace_listings;
CREATE TRIGGER trg_gs_inserat_waechter BEFORE INSERT OR UPDATE ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.fn_gs_inserat_waechter();

-- ══ 3 · Sperre auf allen oeffentlichen Schreibwegen ═════════════════════════
-- TG_ARGV[0] = Spalte des Urhebers (fuer INSERT, auch aus service_role:
-- marketplace-publish), TG_ARGV[1] = 'nur_oeffentlich' (Kartenfunde: ein
-- privater Fund ist kein oeffentlicher Inhalt). Beim UPDATE zaehlt der Handelnde
-- (auth.uid()), und nur aus Nutzerhand — ein Admin, der den Beitrag eines
-- Gesperrten versteckt, laeuft als Eigentuemer und bleibt frei.
CREATE OR REPLACE FUNCTION public.fn_gs_sperre()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public, pg_temp
AS $f$
DECLARE v_wer uuid;
BEGIN
  IF TG_NARGS > 1 AND TG_ARGV[1] = 'nur_oeffentlich'
     AND coalesce((to_jsonb(NEW) ->> 'is_private')::boolean, true) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    v_wer := nullif(to_jsonb(NEW) ->> TG_ARGV[0], '')::uuid;
  ELSIF current_user IN ('authenticated','anon') THEN
    v_wer := (SELECT auth.uid());
  ELSE
    RETURN NEW;
  END IF;
  IF v_wer IS NOT NULL AND public.fn_user_role(v_wer) = 'banned' THEN
    RAISE EXCEPTION 'User is banned and cannot post' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $f$;

DROP TRIGGER IF EXISTS trg_gs_sperre ON public.marketplace_listings;
CREATE TRIGGER trg_gs_sperre BEFORE INSERT OR UPDATE ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.fn_gs_sperre('user_id');
DROP TRIGGER IF EXISTS trg_gs_sperre ON public.marketplace_messages;
CREATE TRIGGER trg_gs_sperre BEFORE INSERT OR UPDATE ON public.marketplace_messages
  FOR EACH ROW EXECUTE FUNCTION public.fn_gs_sperre('sender_id');
DROP TRIGGER IF EXISTS trg_gs_sperre ON public.map_user_finds;
CREATE TRIGGER trg_gs_sperre BEFORE INSERT OR UPDATE ON public.map_user_finds
  FOR EACH ROW EXECUTE FUNCTION public.fn_gs_sperre('user_id', 'nur_oeffentlich');
DROP TRIGGER IF EXISTS trg_gs_sperre ON public.friendships;
CREATE TRIGGER trg_gs_sperre BEFORE INSERT OR UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.fn_gs_sperre('user_id');
DROP TRIGGER IF EXISTS trg_gs_sperre ON public.user_follows;
CREATE TRIGGER trg_gs_sperre BEFORE INSERT ON public.user_follows
  FOR EACH ROW EXECUTE FUNCTION public.fn_gs_sperre('follower_id');
-- INSERT ist dort schon durch fn_check_not_banned gedeckt; es fehlte das Bearbeiten.
DROP TRIGGER IF EXISTS trg_gs_sperre_upd ON public.social_posts;
CREATE TRIGGER trg_gs_sperre_upd BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.fn_gs_sperre('user_id');
DROP TRIGGER IF EXISTS trg_gs_sperre_upd ON public.post_comments;
CREATE TRIGGER trg_gs_sperre_upd BEFORE UPDATE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.fn_gs_sperre('user_id');

-- 3a · Die Sperre auch auf den SECURITY-DEFINER-Wegen, die fuer eine Person schreiben.
-- v33.59 (Schlusspruefung): fn_gs_sperre prueft ein UPDATE nur aus Nutzerhand —
-- eine DEFINER-Funktion laeuft als Eigentuemer und kommt durch. Gesucht in
-- live/functions.sql (DEFINER mit INSERT/UPDATE auf den gesperrten Tabellen):
--   fn_marketplace_set_status  · der Status-Weg der App (gsMktSetStatus): hier gesperrt.
--   fn_follow_toggle           · INSERT in user_follows — der INSERT-Zweig von
--                                fn_gs_sperre liest follower_id auch als Eigentuemer.
--   toggle_post_like           · bewusst offen: post_likes traegt keine Sperre (auch
--                                der direkte INSERT nicht) — ein Like ist kein Inhalt.
--   fn_mkt_increment_views     · bewusst offen: zaehlt einen Aufruf, schreibt nichts
--                                von der Person.
--   fn_admin_moderate, fn_marketplace_auto_archive · bewusst: Admin-Weg bzw. Cron.
--   fn_block_toggle            · loescht nur (Folgen/Anfragen entfernen bleibt erlaubt).
-- Die Edge-Function marketplace-publish (service_role) prueft die Rolle selbst
-- (_shared/markt_regeln.mjs), BEVOR sie schreibt.
-- Wortlaut live (10.11.2026), ergaenzt NUR um die Sperre nach der Eigentuemerpruefung;
-- Antwortform wie die anderen Ablehnungen, `error` ist ein Satz (gsMktSetStatus zeigt ihn).
CREATE OR REPLACE FUNCTION public.fn_marketplace_set_status(p_listing_id uuid, p_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_owner uuid; v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  IF p_status NOT IN ('active','reserved','sold','archived') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;
  SELECT user_id INTO v_owner FROM public.marketplace_listings WHERE id = p_listing_id;
  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_owner <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  -- v33.59: ein gesperrtes Konto aendert den Status nicht (sonst holt es ein
  -- archiviertes Inserat zurueck) — als DEFINER greift fn_gs_sperre hier nicht.
  IF public.fn_user_role(v_uid) = 'banned' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'banned',
      'error', 'Dein Konto ist gesperrt – Inserate lassen sich nicht mehr ändern.');
  END IF;
  UPDATE public.marketplace_listings
     SET status = p_status,
         sold_at = CASE WHEN p_status = 'sold' THEN COALESCE(sold_at, now())
                        WHEN p_status = 'active' THEN NULL
                        ELSE sold_at END,
         updated_at = now()
   WHERE id = p_listing_id;
  RETURN jsonb_build_object('ok', true, 'id', p_listing_id, 'status', p_status);
END;
$function$;
REVOKE ALL ON FUNCTION public.fn_marketplace_set_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_marketplace_set_status(uuid, text) TO authenticated, service_role;

-- ══ 4 · Blockieren gilt auf jedem Weg, nicht nur in drei RPCs ═══════════════
-- SECURITY DEFINER, weil user_blocks per RLS nur dem Blockierenden gehoert.
CREATE OR REPLACE FUNCTION public.fn_gs_block_pruefen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $f$
DECLARE v_neu jsonb := to_jsonb(NEW); v_wer uuid; v_ziel uuid;
BEGIN
  IF TG_TABLE_NAME = 'user_follows' THEN
    v_wer := (v_neu->>'follower_id')::uuid; v_ziel := (v_neu->>'followed_id')::uuid;
  ELSIF TG_TABLE_NAME = 'friendships' THEN
    v_wer := (v_neu->>'user_id')::uuid; v_ziel := (v_neu->>'friend_id')::uuid;
  ELSIF TG_TABLE_NAME = 'post_comments' THEN
    v_wer := (v_neu->>'user_id')::uuid;
    SELECT p.user_id INTO v_ziel FROM public.social_posts p WHERE p.id = (v_neu->>'post_id')::uuid;
  ELSIF TG_TABLE_NAME = 'marketplace_messages' THEN
    v_wer := (v_neu->>'sender_id')::uuid;
    v_ziel := CASE WHEN v_wer = (v_neu->>'buyer_id')::uuid THEN (v_neu->>'seller_id')::uuid
                   ELSE (v_neu->>'buyer_id')::uuid END;
  END IF;
  IF v_wer IS NOT NULL AND v_ziel IS NOT NULL AND v_wer <> v_ziel AND EXISTS (
       SELECT 1 FROM public.user_blocks b WHERE b.blocker_id = v_ziel AND b.blocked_id = v_wer) THEN
    RAISE EXCEPTION 'blocked_by_target' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION public.fn_gs_block_pruefen() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_gs_block ON public.user_follows;
CREATE TRIGGER trg_gs_block BEFORE INSERT ON public.user_follows
  FOR EACH ROW EXECUTE FUNCTION public.fn_gs_block_pruefen();
DROP TRIGGER IF EXISTS trg_gs_block ON public.friendships;
CREATE TRIGGER trg_gs_block BEFORE INSERT ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.fn_gs_block_pruefen();
DROP TRIGGER IF EXISTS trg_gs_block ON public.post_comments;
CREATE TRIGGER trg_gs_block BEFORE INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.fn_gs_block_pruefen();
DROP TRIGGER IF EXISTS trg_gs_block ON public.marketplace_messages;
CREATE TRIGGER trg_gs_block BEFORE INSERT ON public.marketplace_messages
  FOR EACH ROW EXECUTE FUNCTION public.fn_gs_block_pruefen();

-- fn_block_toggle: Signatur unveraendert; raeumt zusaetzlich offene
-- Freundschaften zwischen beiden (sonst stand die Anfrage weiter in der Glocke).
CREATE OR REPLACE FUNCTION public.fn_block_toggle(p_target uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_uid uuid := (SELECT auth.uid()); v_existed boolean;
BEGIN
  IF v_uid IS NULL OR v_uid = p_target THEN RETURN jsonb_build_object('error','invalid'); END IF;
  DELETE FROM public.user_blocks WHERE blocker_id = v_uid AND blocked_id = p_target RETURNING true INTO v_existed;
  IF v_existed THEN RETURN jsonb_build_object('action','unblocked'); END IF;
  DELETE FROM public.user_follows WHERE
    (follower_id = v_uid AND followed_id = p_target) OR (follower_id = p_target AND followed_id = v_uid);
  DELETE FROM public.friendships WHERE
    (user_id = v_uid AND friend_id = p_target) OR (user_id = p_target AND friend_id = v_uid);
  INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES (v_uid, p_target) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('action','blocked');
END $function$;

-- fn_following_feed: Signatur unveraendert; ohne Blockierte (beide Richtungen)
-- und ohne vom Admin versteckte Inserate.
CREATE OR REPLACE FUNCTION public.fn_following_feed(p_limit integer DEFAULT 30)
 RETURNS TABLE(kind text, user_id uuid, display_name text, avatar_url text, avatar_emoji text, ref_id text, title text, icon text, ts timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH followed AS (
    SELECT uf.followed_id FROM public.user_follows uf
    WHERE uf.follower_id = (SELECT auth.uid())
      AND NOT EXISTS (SELECT 1 FROM public.user_blocks b
                      WHERE (b.blocker_id = uf.followed_id AND b.blocked_id = uf.follower_id)
                         OR (b.blocker_id = uf.follower_id AND b.blocked_id = uf.followed_id))
  )
  SELECT 'achievement' AS kind, ua.user_id, p.display_name, p.avatar_url, p.avatar_emoji,
    ua.achievement_slug::text AS ref_id, c.title, c.icon, ua.unlocked_at AS ts
  FROM public.user_achievements ua
  JOIN followed f ON f.followed_id = ua.user_id
  JOIN public.profiles p ON p.id = ua.user_id
  JOIN public.achievements_catalog c ON c.slug = ua.achievement_slug
  WHERE ua.unlocked_at > now() - interval '7 days'
    AND coalesce(c.rarity,'common') <> 'common'
    AND coalesce(p.opt_in_feed, true) = true
  UNION ALL
  SELECT 'find' AS kind, mf.user_id, p.display_name, p.avatar_url, p.avatar_emoji,
    mf.id::text AS ref_id, mf.species_name, '📍', mf.found_at
  FROM public.map_user_finds mf
  JOIN followed f ON f.followed_id = mf.user_id
  JOIN public.profiles p ON p.id = mf.user_id
  WHERE mf.is_private = false AND mf.found_at > now() - interval '7 days'
    AND coalesce(p.show_finds_public, false) = true AND coalesce(p.opt_in_feed, true) = true
  UNION ALL
  SELECT 'listing' AS kind, ml.user_id, p.display_name, p.avatar_url, p.avatar_emoji,
    ml.id::text AS ref_id, ml.title, '🤝', ml.created_at
  FROM public.marketplace_listings ml
  JOIN followed f ON f.followed_id = ml.user_id
  JOIN public.profiles p ON p.id = ml.user_id
  WHERE ml.status = 'active' AND coalesce(ml.moderation_status, '') <> 'hidden'
    AND ml.created_at > now() - interval '7 days'
    AND coalesce(p.show_marketplace, true) = true AND coalesce(p.opt_in_feed, true) = true
  ORDER BY ts DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$function$;

-- ══ 5 · marketplace_messages ════════════════════════════════════════════════
-- Wem gehoert das Inserat? SECURITY DEFINER, weil ein verkauftes Inserat fuer
-- den Kaeufer per RLS unsichtbar ist und die Unterhaltung trotzdem weitergeht.
CREATE OR REPLACE FUNCTION public.fn_mkt_listing_owner(p_listing_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $f$ SELECT l.user_id FROM public.marketplace_listings l WHERE l.id = p_listing_id $f$;
REVOKE ALL ON FUNCTION public.fn_mkt_listing_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_mkt_listing_owner(uuid) TO authenticated, service_role;

-- Hat der Kaeufer diese Unterhaltung begonnen? Eine Policy auf marketplace_messages
-- darf die Tabelle nicht selbst abfragen (infinite recursion) — daher eine Funktion.
-- Auskunft nur an die zwei Beteiligten — sonst fragt jeder ab, wer sich fuer
-- welches Inserat interessiert hat.
CREATE OR REPLACE FUNCTION public.fn_mkt_kaeufer_hat_begonnen(p_listing_id uuid, p_buyer_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $f$
  SELECT (SELECT auth.uid()) IN (p_buyer_id, (SELECT l.user_id FROM public.marketplace_listings l WHERE l.id = p_listing_id))
     AND EXISTS (SELECT 1 FROM public.marketplace_messages m
                 WHERE m.listing_id = p_listing_id AND m.buyer_id = p_buyer_id AND m.sender_id = p_buyer_id)
$f$;
REVOKE ALL ON FUNCTION public.fn_mkt_kaeufer_hat_begonnen(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_mkt_kaeufer_hat_begonnen(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "users send own messages" ON public.marketplace_messages;
CREATE POLICY "users send own messages" ON public.marketplace_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND buyer_id <> seller_id
    AND (buyer_id = (SELECT auth.uid()) OR seller_id = (SELECT auth.uid()))
    AND seller_id = public.fn_mkt_listing_owner(listing_id)
    -- der Verkaeufer antwortet; eine Unterhaltung beginnt der Kaeufer
    AND (buyer_id = (SELECT auth.uid()) OR public.fn_mkt_kaeufer_hat_begonnen(listing_id, buyer_id))
  );

DROP POLICY IF EXISTS marketplace_messages_update ON public.marketplace_messages;
DROP POLICY IF EXISTS marketplace_messages_gelesen ON public.marketplace_messages;
CREATE POLICY marketplace_messages_gelesen ON public.marketplace_messages
  FOR UPDATE TO authenticated
  USING ((buyer_id = (SELECT auth.uid()) OR seller_id = (SELECT auth.uid())) AND sender_id <> (SELECT auth.uid()))
  WITH CHECK ((buyer_id = (SELECT auth.uid()) OR seller_id = (SELECT auth.uid())) AND sender_id <> (SELECT auth.uid()));
REVOKE UPDATE ON public.marketplace_messages FROM anon, authenticated;
GRANT UPDATE (read_at) ON public.marketplace_messages TO authenticated;
-- Anlegen nur mit den fuenf Feldern der App: created_at und read_at setzt der
-- Server (sonst rueckdatiert ein Absender seine Nachricht oder markiert sie
-- selbst als gelesen — beim Empfaenger erschiene sie nie als neu).
REVOKE INSERT ON public.marketplace_messages FROM anon, authenticated;
GRANT INSERT (listing_id, buyer_id, seller_id, sender_id, message) ON public.marketplace_messages TO authenticated;

-- ══ 6 · marketplace_sellers: nur service_role schreibt ══════════════════════
DROP POLICY IF EXISTS marketplace_seller_owner_all ON public.marketplace_sellers;
DROP POLICY IF EXISTS marketplace_seller_owner_read ON public.marketplace_sellers;
CREATE POLICY marketplace_seller_owner_read ON public.marketplace_sellers
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.marketplace_sellers FROM anon, authenticated;

-- ══ 7 · user_reports: nur ueber fn_report (Rate-Limit, Selbstmeldung) ═══════
DROP POLICY IF EXISTS user_reports_insert_own ON public.user_reports;
REVOKE INSERT ON public.user_reports FROM anon, authenticated;

-- ══ 8 · organizations: Waechter ═════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_gs_org_waechter()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public, pg_temp
AS $f$
BEGIN
  IF current_user IN ('authenticated','anon') AND NOT coalesce(public.is_admin_user(), false) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.subscription_tier := 'free'; NEW.max_members := 1000; NEW.is_active := true; NEW.created_at := now();
    ELSE
      NEW.slug              := OLD.slug;
      NEW.created_by        := OLD.created_by;
      NEW.subscription_tier := OLD.subscription_tier;
      NEW.max_members       := OLD.max_members;
      NEW.is_active         := OLD.is_active;
      NEW.created_at        := OLD.created_at;
    END IF;
    -- dieselbe Regel wie fn_org_update — sie galt nur auf dem Weg ueber die RPC
    IF NEW.logo_url IS NOT NULL AND NEW.logo_url <> '' AND NEW.logo_url !~* '^https?://' THEN
      RAISE EXCEPTION 'Logo-URL muss mit http(s):// beginnen.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.website IS NOT NULL AND NEW.website <> '' AND NEW.website !~* '^https?://' THEN
      RAISE EXCEPTION 'Website muss mit http(s):// beginnen.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $f$;
DROP TRIGGER IF EXISTS trg_gs_org_waechter ON public.organizations;
CREATE TRIGGER trg_gs_org_waechter BEFORE INSERT OR UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.fn_gs_org_waechter();

-- ══ 9 · recipes / remedies: schreiben nur Admins ════════════════════════════
DO $do$
DECLARE t text; ist_admin text :=
  '(coalesce(public.is_admin_user(), false) OR coalesce(public.fn_is_role(''admin''), false))';
BEGIN
  FOREACH t IN ARRAY ARRAY['recipes','remedies'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_ins', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_upd', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_del', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)', t || '_admin_ins', t, ist_admin);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', t || '_admin_upd', t, ist_admin, ist_admin);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s)', t || '_admin_del', t, ist_admin);
  END LOOP;
END $do$;

-- ══ 10 · Bild-Adressen aus Nutzerhand: nur der eigene Speicher ══════════════
CREATE OR REPLACE FUNCTION public.fn_gs_bild_url_ok(p text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path = public, pg_temp
AS $f$
  SELECT p IS NULL OR p = '' OR (
    left(p, 66) = 'https://vowbiueikwrauuceilhc.supabase.co/storage/v1/object/public/'
    AND length(p) > 66 AND length(p) <= 1024
    AND p !~ '[[:space:]"''<>\\`]'
    AND p !~ '/\.\.?(/|$)'
  )
$f$;

-- TG_ARGV = die Bildspalten. Geprueft wird nur eine NEUE oder GEAENDERTE
-- Adresse und nur aus Nutzerhand (authenticated/anon): ein alter Wert bleibt
-- stehen, bis die Person ihn selbst aendert, und SECURITY-DEFINER-/
-- service_role-Wege (marketplace-publish laedt selbst hoch) bleiben frei.
CREATE OR REPLACE FUNCTION public.fn_gs_bild_pruefen()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public, pg_temp
AS $f$
DECLARE i int; v_neu jsonb; v_alt jsonb; e text;
BEGIN
  IF current_user NOT IN ('authenticated','anon') THEN RETURN NEW; END IF;
  FOR i IN 0 .. TG_NARGS - 1 LOOP
    v_neu := to_jsonb(NEW) -> TG_ARGV[i];
    IF TG_OP = 'UPDATE' THEN
      v_alt := to_jsonb(OLD) -> TG_ARGV[i];
      IF v_neu IS NOT DISTINCT FROM v_alt THEN CONTINUE; END IF;
    END IF;
    IF v_neu IS NULL OR jsonb_typeof(v_neu) = 'null' THEN CONTINUE; END IF;
    IF jsonb_typeof(v_neu) = 'array' THEN
      FOR e IN SELECT jsonb_array_elements_text(v_neu) LOOP
        IF NOT public.fn_gs_bild_url_ok(e) THEN
          RAISE EXCEPTION 'bild_url_nicht_erlaubt: %', TG_ARGV[i] USING ERRCODE = 'check_violation';
        END IF;
      END LOOP;
    ELSIF NOT public.fn_gs_bild_url_ok(v_neu #>> '{}') THEN
      RAISE EXCEPTION 'bild_url_nicht_erlaubt: %', TG_ARGV[i] USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END $f$;

DROP TRIGGER IF EXISTS trg_gs_bild ON public.social_posts;
CREATE TRIGGER trg_gs_bild BEFORE INSERT OR UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.fn_gs_bild_pruefen('photo_url');
DROP TRIGGER IF EXISTS trg_gs_bild ON public.marketplace_listings;
CREATE TRIGGER trg_gs_bild BEFORE INSERT OR UPDATE ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.fn_gs_bild_pruefen('photo_url', 'photo_urls');
DROP TRIGGER IF EXISTS trg_gs_bild ON public.map_user_finds;
CREATE TRIGGER trg_gs_bild BEFORE INSERT OR UPDATE ON public.map_user_finds
  FOR EACH ROW EXECUTE FUNCTION public.fn_gs_bild_pruefen('photo_url');
DROP TRIGGER IF EXISTS trg_gs_bild ON public.profiles;
CREATE TRIGGER trg_gs_bild BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_gs_bild_pruefen('avatar_url');

-- ══ 11 · gs_abo_can_use: kein Aufrufer, liest Spalten, die es nicht gibt ════
DO $do$
BEGIN
  IF to_regprocedure('public.gs_abo_can_use(uuid, text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.gs_abo_can_use(uuid, text) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.gs_abo_can_use(uuid, text) TO service_role;
  END IF;
END $do$;
