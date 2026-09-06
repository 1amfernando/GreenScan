-- ═══════════════════════════════════════════════════════════════════════════
-- Ökosystem V1 · Sensor-Alarme werden zum PUSH (docs/OEKOSYSTEM-V1.md §3.4,
-- §11 Idee 16; Modul supabase/functions/_shared/sensor_push_regeln.mjs,
-- Prüfstand scripts/sensor_push_check.js, Empfänger supabase/functions/sensor-push)
--
-- BEWUSST NICHT ANGEWANDT (DDL ist Fernandos Handgriff). Idempotent.
-- Setzt 20260905_device_alerts_cron.sql voraus (fn_device_alerts, notify_sensor).
--
-- Der Fund (06.09.2026): `fn_device_alerts()` schreibt Zeilen in
-- `notifications` — und niemand pusht sie. Die Brücke aus
-- 20260826_push_to_inbox_bridge.sql läuft in EINE Richtung
-- (push_send_log → notifications); eine Inbox-Zeile wird nie zum Push.
-- §11.3j behauptete, daily-push-checker lese `notifications`. Tut er nicht.
--
-- Was diese Migration tut:
--   1. Die Brücke spiegelt eine Protokollzeile NICHT, wenn sie schon zu einer
--      Inbox-Zeile gehört (`payload_meta.notification_id`) — sonst stünde
--      jeder Sensor-Alarm zweimal in der Inbox (Cron + Brücke).
--   2. Der Cron `device-alerts` ruft nach der Rechnung die Edge-Function
--      `sensor-push` — aber nur, wenn fn_device_alerts() etwas NEUES gemeldet
--      hat (lost + rules > 0). Alle 15 Minuten ein HTTP-Aufruf ins Leere wäre
--      der falsche Preis für einen Alarm, der meist nicht kommt.
--   Muster wie key-health-daily / daily-push-morning: net.http_post mit dem
--   x-cron-secret aus app_settings. Ein zweiter Push-KANAL ist das nicht —
--   sensor-push benutzt VAPID, Stille-Zeit, Pause, push_send_log wie die
--   anderen Checker; neu ist nur die Quelle (die Inbox-Zeile des Crons).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · Brücke: eine Inbox-Zeile bleibt eine ─────────────────────────────
-- Wortgleich mit 20260826, plus die eine Zeile mit dem Marker.
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
  -- 20260906: der Push GEHÖRT zu einer Inbox-Zeile (sensor-push) — nicht spiegeln.
  IF NEW.payload_meta IS NOT NULL AND (NEW.payload_meta ? 'notification_id') THEN RETURN NEW; END IF;

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

COMMENT ON FUNCTION public.fn_push_log_to_notifications() IS
  'Push→Inbox-Brücke (v30.80). Seit 20260906: Protokollzeilen mit payload_meta.notification_id gehören schon zu einer Inbox-Zeile (sensor-push) und werden nicht gespiegelt.';

-- ── 2 · Cron device-alerts: rechnen, und nur bei etwas Neuem pushen ──────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND to_regprocedure('public.fn_device_alerts()') IS NOT NULL THEN
    PERFORM cron.unschedule('device-alerts') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'device-alerts');
    PERFORM cron.schedule('device-alerts', '*/15 * * * *', $cron$
      DO $do$
      DECLARE r jsonb;
      BEGIN
        r := public.fn_device_alerts();
        IF COALESCE((r->>'lost')::int, 0) + COALESCE((r->>'rules')::int, 0) > 0 THEN
          PERFORM net.http_post(
            url := 'https://vowbiueikwrauuceilhc.supabase.co/functions/v1/sensor-push',
            headers := jsonb_build_object('Content-Type', 'application/json',
              'x-cron-secret', (SELECT value FROM public.app_settings WHERE key = 'push_cron_secret')),
            body := '{}'::jsonb);
        END IF;
      END $do$;
    $cron$);
  END IF;
END $$;

-- Nachmessen (nur lesend):
--   select jobname, schedule from cron.job where jobname = 'device-alerts';
--   select count(*) from public.push_send_log where category = 'sensor_alert';
--   select count(*) from public.notifications where kind = 'sensor_alert' and dedup_key like 'pushlog_%';  -- muss 0 bleiben
