-- ══════════════════════════════════════════════════════════════════════════
-- v31.09 · Community: Kommentar-Reaktionen + Benachrichtigung bei Likes
-- ══════════════════════════════════════════════════════════════════════════
--
-- WARUM ALS MIGRATION UND NICHT IM CLIENT:
--   • `notifications` hat RLS `insert_own` — ein Client kann keine
--     Benachrichtigung für JEMAND ANDEREN anlegen.
--   • `fn_create_notification` ist SECURITY DEFINER und NUR für postgres +
--     service_role ausführbar (geprüft: proacl). Das ist richtig so — waere sie
--     fuer `authenticated` offen, koennte jeder jedem beliebige Meldungen
--     schicken.
--   Ein Trigger ist damit der einzige saubere Weg. Er laeuft als Owner, ist vom
--   Client nicht faelschbar und funktioniert unabhaengig davon, welche
--   App-Version gerade liket.
--
-- ── 1 · Kommentar-Reaktionen ─────────────────────────────────────────────
-- Eine Zeile pro Nutzer und Kommentar. Wechsel Like <-> Dislike ist ein
-- UPDATE, Zuruecknehmen ein DELETE. Der UNIQUE-Index macht Doppel-Stimmen
-- unmoeglich — auch bei parallelen Taps auf zwei Geraeten.

BEGIN;

CREATE TABLE IF NOT EXISTS public.comment_reactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id  uuid NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id)           ON DELETE CASCADE,
  reaction    smallint NOT NULL CHECK (reaction IN (-1, 1)),   -- 1 = Like, -1 = Dislike
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment ON public.comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_user    ON public.comment_reactions(user_id);

ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

-- Zaehlstaende sind oeffentlich (jeder sieht, wie oft etwas geliked wurde),
-- schreiben darf jeder nur die EIGENE Stimme.
DROP POLICY IF EXISTS comment_reactions_select_all ON public.comment_reactions;
CREATE POLICY comment_reactions_select_all ON public.comment_reactions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS comment_reactions_insert_own ON public.comment_reactions;
CREATE POLICY comment_reactions_insert_own ON public.comment_reactions
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS comment_reactions_update_own ON public.comment_reactions;
CREATE POLICY comment_reactions_update_own ON public.comment_reactions
  FOR UPDATE USING ((SELECT auth.uid()) = user_id)
             WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS comment_reactions_delete_own ON public.comment_reactions;
CREATE POLICY comment_reactions_delete_own ON public.comment_reactions
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- ── 2 · Benachrichtigung, wenn jemand einen BEITRAG liked ────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_post_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_author uuid;
  v_name   text;
  v_snippet text;
BEGIN
  SELECT p.user_id, left(coalesce(p.content,''), 60)
    INTO v_author, v_snippet
    FROM public.social_posts p WHERE p.id = NEW.post_id;

  -- Eigene Beitraege loesen keine Meldung aus — sonst bekaeme man bei jedem
  -- Selbst-Like eine Nachricht von sich selbst.
  IF v_author IS NULL OR v_author = NEW.user_id THEN RETURN NEW; END IF;

  SELECT coalesce(display_name, 'Jemand') INTO v_name
    FROM public.profiles WHERE id = NEW.user_id;

  PERFORM public.fn_create_notification(
    v_author, 'like',
    '❤️ ' || coalesce(v_name,'Jemand') || ' gefällt dein Beitrag',
    CASE WHEN v_snippet <> '' THEN '„' || v_snippet || '…"' ELSE NULL END,
    '/?screen=social#post-' || NEW.post_id::text,
    -- Pro Beitrag und Likendem genau EINE Meldung. Wer wegnimmt und neu
    -- liked, loest dadurch keine zweite aus.
    'like:post:' || NEW.post_id::text || ':' || NEW.user_id::text
  );
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS trg_notify_post_like ON public.post_likes;
CREATE TRIGGER trg_notify_post_like
  AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_post_like();

-- ── 3 · Benachrichtigung, wenn jemand einen KOMMENTAR liked ──────────────
-- Bewusst NUR bei Likes. Eine Meldung „jemandem gefällt dein Kommentar nicht"
-- waere entmutigend und lädt zu Schikane ein. Dislikes zaehlen sichtbar mit,
-- benachrichtigen aber niemanden.
CREATE OR REPLACE FUNCTION public.fn_notify_comment_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_author uuid;
  v_post   uuid;
  v_name   text;
  v_snippet text;
BEGIN
  IF NEW.reaction <> 1 THEN RETURN NEW; END IF;

  SELECT c.user_id, c.post_id, left(coalesce(c.content,''), 60)
    INTO v_author, v_post, v_snippet
    FROM public.post_comments c WHERE c.id = NEW.comment_id;

  IF v_author IS NULL OR v_author = NEW.user_id THEN RETURN NEW; END IF;

  SELECT coalesce(display_name, 'Jemand') INTO v_name
    FROM public.profiles WHERE id = NEW.user_id;

  PERFORM public.fn_create_notification(
    v_author, 'like',
    '❤️ ' || coalesce(v_name,'Jemand') || ' gefällt dein Kommentar',
    CASE WHEN v_snippet <> '' THEN '„' || v_snippet || '…"' ELSE NULL END,
    '/?screen=social#post-' || coalesce(v_post::text,''),
    'like:comment:' || NEW.comment_id::text || ':' || NEW.user_id::text
  );
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS trg_notify_comment_like ON public.comment_reactions;
CREATE TRIGGER trg_notify_comment_like
  AFTER INSERT OR UPDATE OF reaction ON public.comment_reactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_comment_like();

-- ── 4 · Like-Zaehler am Beitrag serverseitig fuehren ─────────────────────
-- Vorher schrieb der Client `social_posts.likes` selbst. Zwei Geraete
-- gleichzeitig -> Zaehler driftet, und faelschbar war er ohnehin.
CREATE OR REPLACE FUNCTION public.fn_sync_post_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE v_post uuid;
BEGIN
  v_post := coalesce(NEW.post_id, OLD.post_id);
  UPDATE public.social_posts
     SET likes = (SELECT count(*) FROM public.post_likes WHERE post_id = v_post)
   WHERE id = v_post;
  RETURN NULL;
END; $function$;

DROP TRIGGER IF EXISTS trg_sync_post_like_count ON public.post_likes;
CREATE TRIGGER trg_sync_post_like_count
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_post_like_count();

COMMENT ON TABLE public.comment_reactions IS
  'v31.09: Like (1) / Dislike (-1) auf Kommentare, eine Stimme pro Nutzer und Kommentar. Nur Likes benachrichtigen.';

COMMIT;
