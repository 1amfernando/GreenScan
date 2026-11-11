-- ══════════════════════════════════════════════════════════════════════════
-- 20261110_feedback_stimmen_zaehlen.sql — v33.59: eine Stimme zaehlt auch
-- auf dem Server (Nebenbefund der Sicherheitspruefung vom 10.11.2026).
--
-- WAS LIVE STEHT (functions.sql / triggers.json / policies, gelesen 10.11.2026):
--  - trg_feedback_votes_aggregate AFTER INSERT OR DELETE OR UPDATE ON
--    feedback_votes FOR EACH ROW → fn_update_feedback_votes().
--  - fn_update_feedback_votes zaehlt richtig aus der Tabelle nach — laeuft aber
--    als SECURITY INVOKER, also mit den Rechten der Person, die abstimmt.
--  - feedback_items hat GENAU eine UPDATE-Policy: feedback_items_update_admin
--    (fn_role_at_least('staff')). Fuer alle anderen filtert RLS das UPDATE im
--    Trigger still auf 0 Zeilen — kein Fehler, kein Zaehler.
--  Folge: votes_up / votes_down bewegten sich nur, wenn Staff abstimmte. Die
--  App liest beide Zahlen aus v_feedback_public und zeigte bei jedem Neuladen
--  wieder 0 (bzw. die eigene, lokal gemerkte Stimme).
--
-- WAS DIESE DATEI AENDERT (Signatur und Trigger bleiben gleich):
--  - fn_update_feedback_votes laeuft SECURITY DEFINER mit festem search_path.
--    Sie schreibt NUR die zwei Zaehler einer Zeile und rechnet sie aus der
--    Tabelle neu (kein +1/-1, dem man glauben muesste) — bei einem UPDATE, das
--    item_id wechselt, beide betroffenen Zeilen.
--  - EXECUTE fuer PUBLIC/anon/authenticated entzogen: eine Trigger-Funktion ruft
--    niemand direkt; das Ausloesen prueft das Recht nicht.
--  - Einmaliges Nachzaehlen des Bestands (nur Zeilen, deren Zahl abweicht).
--
-- Die Policies auf feedback_votes stellt 20261110_sicherheit_konto_speicher.sql
-- um (Stimmen nur angemeldet); beide Dateien sind voneinander unabhaengig.
--
-- NICHT ANGEWANDT — Fernando. Idempotent; nachgespielt in
-- scripts/rls/60_feedback.js (Live-Ausschnitt, vorher/nachher, zweimal, Gegenprobe).
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_update_feedback_votes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ids uuid[];
BEGIN
  IF TG_OP = 'INSERT' THEN v_ids := ARRAY[NEW.item_id];
  ELSIF TG_OP = 'DELETE' THEN v_ids := ARRAY[OLD.item_id];
  ELSE v_ids := ARRAY[NEW.item_id, OLD.item_id];
  END IF;
  UPDATE public.feedback_items fi SET
    votes_up   = (SELECT count(*) FROM public.feedback_votes v WHERE v.item_id = fi.id AND v.dir = 'up'),
    votes_down = (SELECT count(*) FROM public.feedback_votes v WHERE v.item_id = fi.id AND v.dir = 'down')
  WHERE fi.id = ANY (v_ids);
  RETURN COALESCE(NEW, OLD);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fn_update_feedback_votes() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_update_feedback_votes() FROM anon, authenticated;

-- Der Trigger steht live; fehlt er (frische Datenbank), wird er angelegt.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                  WHERE tgname = 'trg_feedback_votes_aggregate'
                    AND tgrelid = 'public.feedback_votes'::regclass) THEN
    CREATE TRIGGER trg_feedback_votes_aggregate
      AFTER INSERT OR DELETE OR UPDATE ON public.feedback_votes
      FOR EACH ROW EXECUTE FUNCTION public.fn_update_feedback_votes();
  END IF;
END $$;

-- Bestand: was bisher nicht gezaehlt wurde, einmal nachzaehlen.
WITH z AS (
  SELECT fi.id,
         (SELECT count(*) FROM public.feedback_votes v WHERE v.item_id = fi.id AND v.dir = 'up')::int   AS up,
         (SELECT count(*) FROM public.feedback_votes v WHERE v.item_id = fi.id AND v.dir = 'down')::int AS down
    FROM public.feedback_items fi)
UPDATE public.feedback_items fi SET votes_up = z.up, votes_down = z.down
  FROM z
 WHERE z.id = fi.id
   AND (fi.votes_up IS DISTINCT FROM z.up OR fi.votes_down IS DISTINCT FROM z.down);

COMMIT;
