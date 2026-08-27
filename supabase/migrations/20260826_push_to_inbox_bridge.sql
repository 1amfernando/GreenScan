-- v30.80: Push→Inbox-Bridge (User-Feedback: "Benachrichtigungen wirken
-- gebastelt — ich will es wie bei anderen Apps").
--
-- Kern-Befund (Frontend-Audit 2026-08-26): Web-Push (OS) und In-App-
-- Notification-Center waren VOLLSTAENDIG entkoppelt. daily-push-checker,
-- engagement-push-checker und send-push schreiben 0x in die notifications-
-- Tabelle — die In-App-Inbox zeigte faktisch nur Stripe-Events. Jede echte
-- Benachrichtigung (Frost, Giessen, Quiz-Streak, Trial, Klassen, Doktor,
-- Battle) existierte nur als fluechtiger OS-Push.
--
-- Fix: AFTER-INSERT-Trigger auf push_send_log spiegelt jeden Push in die
-- notifications-Tabelle. Damit ist die In-App-Inbox automatisch synchron
-- mit ALLEN Push-Quellen — heutigen und zukuenftigen Checkern — ohne dass
-- eine einzige Edge-Function angefasst werden muss.
--
-- Bewusst inkludiert: result='suppressed_quiet' (Quiet-Hours). Der OS-Push
-- wird nachts unterdrueckt, aber die Info darf nicht verloren gehen — die
-- Inbox ist dann der einzige Kanal (wie bei WhatsApp & Co: stumm != weg).

CREATE OR REPLACE FUNCTION public.fn_push_log_to_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Nur zustellbare/beabsichtigte Pushes spiegeln, keine Fehl-Versuche.
  IF NEW.user_id IS NULL OR NEW.title IS NULL THEN RETURN NEW; END IF;
  IF NEW.result IS DISTINCT FROM 'sent' AND NEW.result IS DISTINCT FROM 'suppressed_quiet' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, kind, title, body, link, dedup_key, is_read, created_at)
  VALUES (
    NEW.user_id,
    COALESCE(NULLIF(TRIM(NEW.category), ''), 'push'),
    NEW.title,
    NEW.body,
    NULLIF(TRIM(COALESCE(NEW.payload_meta->>'url', '')), ''),
    'pushlog_' || NEW.id,
    false,
    COALESCE(NEW.sent_at, now())
  )
  ON CONFLICT (dedup_key) DO NOTHING;

  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.fn_push_log_to_notifications() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_push_log_to_notifications ON public.push_send_log;
CREATE TRIGGER trg_push_log_to_notifications
  AFTER INSERT ON public.push_send_log
  FOR EACH ROW EXECUTE FUNCTION public.fn_push_log_to_notifications();

-- Backfill der letzten 30 Tage, damit die Inbox nicht leer startet.
INSERT INTO public.notifications (user_id, kind, title, body, link, dedup_key, is_read, created_at)
SELECT p.user_id,
       COALESCE(NULLIF(TRIM(p.category), ''), 'push'),
       p.title, p.body,
       NULLIF(TRIM(COALESCE(p.payload_meta->>'url', '')), ''),
       'pushlog_' || p.id,
       true,  -- Historie als gelesen — kein kuenstlicher Badge-Berg beim Rollout
       COALESCE(p.sent_at, now())
FROM public.push_send_log p
WHERE p.user_id IS NOT NULL AND p.title IS NOT NULL
  AND (p.result = 'sent' OR p.result = 'suppressed_quiet')
  AND p.sent_at > now() - interval '30 days'
ON CONFLICT (dedup_key) DO NOTHING;
