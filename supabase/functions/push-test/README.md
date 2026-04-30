# push-test + daily-push — Smart-Push-Notifications

GreenScan kann tägliche personalisierte Push-Tipps schicken
(„Heute Vollmond + dein Garten hat Karotten → Wurzelschneiden").

## Architektur

```
Browser  ──[Notification API]──> User
   ▲
   │ Web Push (VAPID-signiert)
   │
Edge Fn daily-push  ◀── pg_cron (stündlich)
   │
   ▼  Edge Fn push-test (sofort)
Supabase push_subscriptions (RLS)
   ▲
   │ Client gsPush.subscribe()
Browser PushManager
```

## Setup (einmalig)

### 1 · VAPID-Keys generieren

```bash
npx web-push generate-vapid-keys
# Public:  BPV...  (base64url, 87 chars)
# Private: x9... (base64url, 43 chars)
```

### 2 · Als Supabase-Secrets hinterlegen

```bash
supabase secrets set VAPID_PUBLIC_KEY=BPV...
supabase secrets set VAPID_PRIVATE_KEY=x9...
supabase secrets set VAPID_SUBJECT='mailto:info@greenscan.ch'
```

### 3 · Migration

```bash
supabase db push  # zieht 20260429_push_subscriptions.sql
```

### 4 · Edge Functions deployen

```bash
supabase functions deploy push-test --no-verify-jwt
supabase functions deploy daily-push --no-verify-jwt
```

### 5 · pg_cron einrichten (stündlich)

In Supabase SQL Editor:

```sql
-- Erweitern: pg_cron + http
create extension if not exists pg_cron;
create extension if not exists http;

-- Service-Role-Key in vault speichern
-- (Dashboard → Settings → API → "service_role secret" in vault eintragen)

select cron.schedule(
  'greenscan-daily-push',
  '0 * * * *',  -- stündlich auf Min 0
  $$
    select net.http_post(
      url := 'https://vowbiueikwrauuceilhc.supabase.co/functions/v1/daily-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='service_role_key')
      ),
      body := '{}'
    );
  $$
);
```

### 6 · Im Client testen

```js
// Status checken
await gsPush.status()
// { supported: true, permission: 'default', subscribed: false }

// Subscriben
await gsPush.subscribe({ hour: 7 })  // schickt täglich um 7:00 UTC
// → fragt Browser-Permission, registriert PushManager,
//   speichert in Supabase

// Test-Push sofort
await gsPush.test()
// → Edge Fn push-test schickt sofort eine Push an alle Subscriptions

// Unsubscribe
await gsPush.unsubscribe()
```

## Notification-Inhalte

`daily-push` baut den Body aus:
- **brain_memory** der letzten 7 Tage des Users (Scans, Garten, Quiz)
- **Saison** (Frühling/Sommer/Herbst/Winter)
- **Top-Kategorie** der letzten Scans

Beispiele (echte Output aus `buildTip`):
- „Diese Woche 7 Arten gefunden — Spitzenleistung! Dein Fokus: pilz."
- „🌱 Frühling: Beete vorbereiten, Frühblüher beobachten."
- „3 Scans diese Woche — heute weiter dranbleiben? Quiz-Trefferquote: 80%."

## Zeitzonen — Caveat

`daily-push` matcht aktuell `send_hour === current UTC hour`. Echte
Zeitzonen-Logik (z.B. „07:00 lokale Zeit") fehlt. Workaround: User
trägt `send_hour` als UTC-Stunde ein (Schweiz: −1h im Winter, −2h
im Sommer). Saubere Lösung: Spalte `tz_offset_minutes` ergänzen,
Cron prüft `(now_utc + offset).hour === send_hour`. Folge-Sprint.

## Rollback

```bash
# Subscribers behalten, nur Cron stoppen
select cron.unschedule('greenscan-daily-push');
# Oder Edge Fn loeschen
supabase functions delete daily-push
```

## Troubleshooting

- **"VAPID nicht konfiguriert"** (503): `supabase secrets list` prüfen.
- **"no subscriptions"** (404): `gsPush.subscribe()` im Browser einmal
  aufrufen, Permission gewähren.
- **Push kommt nicht an**: in Browser-DevTools → Application → Push
  Subscription → endpoint manuell testen mit `web-push send` CLI.
- **endpoint 410 Gone**: Browser hat Subscription invalidiert. Edge Fn
  setzt `enabled=false`. User muss neu subscriben.
