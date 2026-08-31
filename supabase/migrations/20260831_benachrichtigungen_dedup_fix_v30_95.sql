-- ══════════════════════════════════════════════════════════════════════════
-- v30.95 · Erinnerungen sind seit 33 Tagen still gestorben — Ursache + Fix
-- ══════════════════════════════════════════════════════════════════════════
--
-- BEFUND (live belegt, Stand 2026-08-31):
--   garden_tasks  status='pending' AND due_at<=heute  = 66, ALLE mit
--                 reminded_at, max = heute 07:00  → der Cron arbeitet.
--   notifications kind='reminder'                   = 66, aber
--                 min(created_at) = max(created_at) = 2026-07-29 07:00.
--   Seit 33 Tagen läuft der Job jeden Morgen grün und erzeugt NICHTS.
--
-- URSACHE — zwei Fehler, die sich gegenseitig verstecken:
--
--   (1) fn_create_notification prüft Duplikate nur in einem 60-Minuten-Fenster
--       und nur pro (user_id, dedup_key). Der Index ist aber unbedingt und
--       GLOBAL:  notifications_dedup_key_unique ON notifications (dedup_key)
--       — ohne WHERE, ohne Zeitanteil, nicht einmal pro user_id.
--       Nach 60 Minuten lässt der Guard also durch, der INSERT läuft in die
--       unique_violation, und `EXCEPTION WHEN OTHERS` verschluckt sie
--       lautlos zu `RETURN NULL`. Der Aufrufer merkt nichts.
--
--   (2) fn_remind_garden_tasks baut den Schlüssel als 'task:'||id — OHNE
--       Datum. Die WHERE-Klausel („reminded_at < NOW() - 20 hours") verspricht
--       tägliche Wiedervorlage, der Schlüssel macht sie unmöglich.
--       Kontrollexperiment in derselben Tabelle, mit demselben Index, denselben
--       Nutzern:  kind='plant_task' (Schlüssel MIT Datum) = 597 Zeilen über
--       75 Tage · kind='reminder' (ohne Datum) = 66 Zeilen an genau 1 Tag.
--
--   Besonders heimtückisch: fn_cleanup_old_data löscht nach 90 Tagen und gibt
--   den Schlüssel wieder frei — der Fehler kaschiert sich alle 90 Tage selbst.
--
-- BETROFFEN waren alle 5 Aufrufer, nicht nur die Garten-Erinnerung:
--   fn_remind_garden_tasks   'task:'||id                   → kein Datum
--   fn_remind_bloom_harvest  'bloom:'||sp_id||':'||month   → keine user_id,
--                                                            kollidiert
--                                                            ZWISCHEN Nutzern
--   fn_notify_friend_request                               → zweite Anfrage
--                                                            desselben Absenders
--                                                            schlägt fehl
--   fn_quest_increment       'quest:'||quest_id            → keine user_id →
--                                                            nur der allererste
--                                                            Nutzer je Quest
--                                                            bekäme je eine
--   fn_assign_role
--
-- FIX — bewusst an EINER Stelle, damit alle 5 Aufrufer mitgeheilt werden:
--
--   A) fn_create_notification stellt dem Schlüssel die user_id voran.
--      Damit ist der global-unique Index automatisch per Nutzer eindeutig und
--      die drei „keine user_id"-Kollisionen sind in einem Zug erledigt.
--      Der Index bleibt, wie er ist — v30_56_admin_moderation_notify.sql:93
--      hängt mit `on conflict (dedup_key) do update` daran und schreibt
--      ohnehin direkt in die Tabelle, nicht über diese Funktion.
--
--   B) Vorab-EXISTS raus, `ON CONFLICT (dedup_key) DO NOTHING RETURNING id`
--      rein. Ein Duplikat ist damit ein normaler, stiller Nicht-Treffer statt
--      einer abgefangenen Ausnahme.
--
--   C) `EXCEPTION WHEN OTHERS` bleibt als letzte Reissleine (eine fehlende
--      Erinnerung darf nie einen Cron-Job abbrechen), protokolliert den Fehler
--      jetzt aber zusätzlich nach system_events — sonst bleibt der nächste
--      Schema-Fehler wieder 33 Tage unsichtbar.
--
--   D) fn_remind_garden_tasks bekommt den Datumsanteil. Erst dadurch ergibt
--      die vorhandene 20-Stunden-Drossel überhaupt Sinn.
--
--   E) Alters-Deckel: nur Aufgaben erinnern, die höchstens 30 Tage überfällig
--      sind. Grund: die 66 offenen Aufgaben sind Testdaten eines internen
--      staff-Kontos mit due_at 2023-04-01 … 2023-08-01 (angelegt 2026-04-28
--      in einem 2,5-Stunden-Fenster). Ohne Deckel würden sie ab morgen täglich
--      nagen. Unabhängig davon ist es die bessere Produktregel: eine drei
--      Jahre überfällige Aufgabe jeden Morgen anzumahnen hilft niemandem.
--
-- Idempotent: nur CREATE OR REPLACE, keine Signatur-, Index- oder Datenänderung.
-- ══════════════════════════════════════════════════════════════════════════

-- Alles-oder-nichts: ein Syntaxfehler darf nicht die Haelfte der Datei anwenden.
BEGIN;

CREATE OR REPLACE FUNCTION public.fn_create_notification(
  _user_id uuid, _kind text, _title text,
  _body text DEFAULT NULL::text, _link text DEFAULT NULL::text,
  _dedup_key text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  _id  uuid;
  _key text;
BEGIN
  IF _user_id IS NULL OR _kind IS NULL OR _title IS NULL THEN RETURN NULL; END IF;

  -- (A) user_id voranstellen: macht den global-unique dedup_key pro Nutzer
  -- eindeutig. Heilt 'bloom:…' und 'quest:…', die bisher zwischen Nutzern
  -- kollidierten (nur der allererste Nutzer bekam je eine Benachrichtigung).
  _key := CASE WHEN _dedup_key IS NULL THEN NULL
               ELSE _user_id::text || '|' || _dedup_key END;

  -- (B) Konflikt ist ein stiller Nicht-Treffer, keine abgefangene Ausnahme.
  INSERT INTO public.notifications(user_id, kind, title, body, link, dedup_key)
  VALUES (_user_id, _kind, left(_title, 200), left(_body, 500), _link, _key)
  ON CONFLICT (dedup_key) DO NOTHING
  RETURNING id INTO _id;

  RETURN _id;   -- NULL = Duplikat, absichtlich übersprungen
EXCEPTION WHEN OTHERS THEN
  -- (C) Reissleine bleibt — aber ab jetzt mit Spur.
  RAISE WARNING 'fn_create_notification failed: %', SQLERRM;
  BEGIN
    INSERT INTO public.system_events(severity, source, event, detail)
    VALUES ('error', 'notifications', 'create_failed',
            jsonb_build_object('kind', _kind, 'dedup_key', _key, 'sqlerrm', SQLERRM));
  EXCEPTION WHEN OTHERS THEN NULL;  -- Protokollieren darf selbst nie stören
  END;
  RETURN NULL;
END; $function$;

CREATE OR REPLACE FUNCTION public.fn_remind_garden_tasks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE _r record; _count integer := 0; _nid uuid;
BEGIN
  FOR _r IN
    SELECT id, user_id, title, due_at FROM public.garden_tasks
    WHERE status = 'pending'
      AND due_at <= CURRENT_DATE
      -- (E) Alters-Deckel: keine Dauer-Mahnung für längst aufgegebene Aufgaben.
      AND due_at >= CURRENT_DATE - 30
      AND (reminded_at IS NULL OR reminded_at < NOW() - interval '20 hours')
  LOOP
    _nid := public.fn_create_notification(
      _r.user_id, 'reminder',
      '🌱 Pflege-Aufgabe heute: ' || _r.title,
      'Fällig seit ' || (CURRENT_DATE - _r.due_at) || ' Tag(en)',
      '/?screen=garden#task-' || _r.id::text,
      -- (D) Datumsanteil: erst dadurch wird die tägliche Wiedervorlage möglich,
      -- die die 20-Stunden-Bedingung oben seit jeher verspricht.
      'task:' || _r.id::text || ':' || CURRENT_DATE::text
    );
    UPDATE public.garden_tasks SET reminded_at = NOW() WHERE id = _r.id;
    -- Nur zählen, was wirklich entstanden ist. Vorher zählte der Job auch
    -- die 66 verschluckten Fehlschläge als Erfolg und meldete „66 Zeilen".
    IF _nid IS NOT NULL THEN _count := _count + 1; END IF;
  END LOOP;
  RETURN _count;
END; $function$;

COMMENT ON FUNCTION public.fn_create_notification(uuid,text,text,text,text,text) IS
  'v30.95: dedup_key wird mit der user_id praefixiert (global-unique Index -> pro Nutzer eindeutig) und Konflikte laufen ueber ON CONFLICT DO NOTHING statt in eine verschluckte unique_violation. Fehler landen zusaetzlich in system_events.';
COMMENT ON FUNCTION public.fn_remind_garden_tasks() IS
  'v30.95: dedup_key mit Datumsanteil (taegliche Wiedervorlage), Alters-Deckel 30 Tage, Zaehler zaehlt nur tatsaechlich erzeugte Erinnerungen.';

COMMIT;
