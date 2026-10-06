-- v33.52 · Eine Freundschaft nimmt der an, der gefragt wurde — sonst niemand.
--
-- Gemessen am 06.10.2026 in der Live-DB (nur lesend: pg_policies, pg_class.relacl,
-- information_schema.columns, pg_get_functiondef):
--
--   friendships_insert  WITH CHECK (auth.uid() = user_id)           — Status frei
--   friendships_update  USING (auth.uid() = friend_id OR = user_id) — KEIN WITH CHECK
--   relacl              authenticated=arwdm                          — UPDATE auf JEDE Spalte
--
-- Daraus folgen drei Wege an der Zustimmung vorbei, alle drei ohne die App:
--
--   1. A legt eine Zeile A→C gleich mit status='accepted' an (INSERT prueft
--      nur user_id). Der Trigger fn_notify_friend_request meldet dann NUR A
--      („C hat deine Anfrage angenommen") — C erfaehrt nichts und steht in
--      v_my_friends als „✓ Verbunden".
--   2. A setzt die EIGENE Anfrage A→B auf 'accepted' (UPDATE erlaubt beiden
--      Seiten). Die App bietet „Annehmen" nur dem Empfaenger an (v_my_friends,
--      direction = 'incoming') — der Server nicht.
--   3. Ohne WITH CHECK gilt USING auch fuer die NEUE Zeile, und die verlangt nur
--      „ich bin eine der beiden Seiten": A schreibt friend_id von B auf C um,
--      B schreibt user_id von A auf C um. Beides ist eine Freundschaft, der C
--      nie zugestimmt hat.
--
-- Wie schwer das wiegt, ehrlich: live 0 Zeilen in friendships, und KEINE
-- Policy und keine Funktion ausser dem Benachrichtigungs-Trigger liest den
-- Status (pg_policies/pg_proc, 06.10.2026). Eine erzwungene Freundschaft
-- oeffnet heute nichts — sie steht nur in einer Liste. Die Regel wird trotzdem
-- jetzt richtig, bevor etwas sie liest.
--
-- Drei Zeilen Regel, alle idempotent:
--   · INSERT nur als Absender UND nur als Anfrage (status = 'pending')
--   · UPDATE nur durch den Empfaenger, und er bleibt der Empfaenger (WITH CHECK)
--   · UPDATE nur auf die Spalte `status` (Spalten-Recht statt Tabellen-Recht);
--     updated_at setzt der BEFORE-Trigger, dafuer braucht es kein Spaltenrecht.
-- Zurueckziehen bleibt fuer beide Seiten DELETE (friendships_delete, unveraendert).
--
-- Die App schickt beim Anfragen status:'pending' (gsFriendsSendRequest) und beim
-- Annehmen nur {status:'accepted'} (gsFriendsAccept) — beides geht weiter durch.
-- scripts/naht_check.js spielt den LIVE-Stand in einem lokalen Postgres nach,
-- reproduziert alle drei Wege, wendet diese Datei ZWEIMAL an und prueft, dass
-- danach jeder der drei scheitert und der richtige Weg weiter geht.
--
-- NICHT angewandt. DDL auf der Produktivdatenbank ist Fernandos Klick
-- (CLAUDE.md §7.1: „Nachmessen: ja, jederzeit, nur lesend. Anwenden: nein.").

DROP POLICY IF EXISTS friendships_insert ON public.friendships;
CREATE POLICY friendships_insert ON public.friendships FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id AND status = 'pending');

DROP POLICY IF EXISTS friendships_update ON public.friendships;
CREATE POLICY friendships_update ON public.friendships FOR UPDATE
  USING ((SELECT auth.uid()) = friend_id)
  WITH CHECK ((SELECT auth.uid()) = friend_id);

REVOKE UPDATE ON public.friendships FROM anon, authenticated;
GRANT UPDATE (status) ON public.friendships TO authenticated;

-- Gegenprobe nach dem Anwenden (nur lesend):
--   select policyname, cmd, qual, with_check from pg_policies
--    where tablename = 'friendships' and cmd in ('INSERT','UPDATE');
--   select attname, attacl from pg_attribute
--    where attrelid = 'public.friendships'::regclass and attacl is not null;
-- Erwartet: INSERT mit status = 'pending', UPDATE nur friend_id (USING und
-- WITH CHECK), und genau eine Spalte mit Recht: status=authenticated.
