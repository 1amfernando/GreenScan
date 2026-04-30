# DEPLOY.md — GreenScan Deploy-Checkliste

> **Eine Datei, alle Schritte.** Wenn du diese Liste durchgehst, ist
> GreenScan v23.98 produktions-fertig.

**Verbindlich vorher**: `git checkout claude/audit-app-features-CXtrI` und
`git pull` — du arbeitest auf dem Audit-Branch, nicht auf `main`.

---

## ⏱️ TL;DR — die 7 Befehle

```bash
# 1) Supabase verlinken
supabase link --project-ref vowbiueikwrauuceilhc

# 2) Migrations ausspielen (3 Tabellen)
supabase db push

# 3) Server-Secrets setzen
supabase secrets set ANTHROPIC_API_KEY=sk-ant-XXXXX
npx web-push generate-vapid-keys
# → notiere PUBLIC + PRIVATE Key, dann:
supabase secrets set VAPID_PUBLIC_KEY=BPV...
supabase secrets set VAPID_PRIVATE_KEY=x9...
supabase secrets set VAPID_SUBJECT='mailto:info@greenscan.ch'

# 4) Edge Functions deployen (4 Stück)
supabase functions deploy ai-proxy --no-verify-jwt
supabase functions deploy entitlements --no-verify-jwt
supabase functions deploy push-test --no-verify-jwt
supabase functions deploy daily-push --no-verify-jwt

# 5) pg_cron für tägliche Push (siehe SQL unten)
# 6) Branch auf main mergen → Cloudflare Pages baut automatisch
# 7) Smoke-Test im Browser (siehe unten)
```

---

## 1 · Voraussetzung: Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# oder Node-basiert
npm i -g supabase

supabase --version  # >= 1.180
```

## 2 · Repo verlinken

```bash
cd <repo-root>
supabase link --project-ref vowbiueikwrauuceilhc
# Project-Ref steht in index.html: SB_URL_DEFAULT
```

## 3 · Migrations ausspielen

`supabase/migrations/` enthält 3 SQL-Dateien:

| Datei | Tabelle | Zweck |
|---|---|---|
| `20260429_ai_usage.sql` | `ai_usage` | Quota-Tracking pro KI-Call |
| `20260429_brain_memory.sql` | `brain_memory` | Geräteübergreifende Lern-History |
| `20260429_push_subscriptions.sql` | `push_subscriptions` | Web-Push-Endpunkte |

```bash
supabase db push
```

Verifiziere im Supabase-Dashboard → Table Editor, dass die 3 Tabellen
existieren und RLS aktiv ist.

## 4 · Server-Secrets

### 4.1 · Anthropic-Key (für ai-proxy)

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-XXXXX
```

Holst du auf [console.anthropic.com](https://console.anthropic.com/settings/keys).

### 4.2 · VAPID-Keys (für Push)

```bash
npx web-push generate-vapid-keys
```

Output sieht so aus:
```
Public:  BPV...xyz   (87 Zeichen, base64url)
Private: x9...abc    (43 Zeichen, base64url)
```

```bash
supabase secrets set VAPID_PUBLIC_KEY=BPV...xyz
supabase secrets set VAPID_PRIVATE_KEY=x9...abc
supabase secrets set VAPID_SUBJECT='mailto:info@greenscan.ch'
```

### 4.3 · Verifikation

```bash
supabase secrets list
# Sollte 4 Einträge zeigen: ANTHROPIC_API_KEY, VAPID_PUBLIC_KEY,
# VAPID_PRIVATE_KEY, VAPID_SUBJECT.
```

## 5 · Edge Functions deployen

```bash
supabase functions deploy ai-proxy      --no-verify-jwt
supabase functions deploy entitlements  --no-verify-jwt
supabase functions deploy push-test     --no-verify-jwt
supabase functions deploy daily-push    --no-verify-jwt
```

`--no-verify-jwt` ist wichtig: die Funktionen lesen das JWT selbst und
geben es an Supabase weiter (RLS-tauglich).

Verifiziere im Dashboard → Edge Functions, dass alle 4 grün sind.

## 6 · pg_cron für tägliche Push

In **Supabase SQL Editor**:

```sql
-- Erweiterungen aktivieren (einmalig)
create extension if not exists pg_cron;
create extension if not exists http;

-- Service-Role-Key in vault hinterlegen
-- (Dashboard → Settings → API → service_role key kopieren, dann:)
insert into vault.secrets (name, secret)
  values ('service_role_key', '<dein service_role JWT>')
  on conflict (name) do update set secret = excluded.secret;

-- Stündlicher Cron — schickt nur an Subs deren send_hour = current UTC
select cron.schedule(
  'greenscan-daily-push',
  '0 * * * *',
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

-- Verifizieren
select * from cron.job;
```

## 7 · Branch auf main mergen

Im GitHub-UI auf `1amfernando/GreenScan`:
- **Compare & pull request** für `claude/audit-app-features-CXtrI` → `main`
- **Merge pull request**

Cloudflare Pages baut automatisch nach Push auf `main`. Build dauert
~30 Sekunden, da kein npm.

## 8 · Smoke-Test im Browser

Öffne `https://greenscan.ch/` und in DevTools-Console:

```js
// Health-Check (alle 9 Komponenten)
gsHealthCheck(true)
// → öffnet Modal. Erwartung: alle grün ausser GPS/Camera (default 'prompt')

// Brain-Inspector
gsBrainDebug(true)
// → zeigt Kontext, Empfehlungen, Memory, Server-Quota

// Multikriterien-Schlüssel
openMultiKey()
// → Filter-Modal, sollte 4342 Arten + Filter-Chips zeigen

// Server-Proxy aktivieren (kein User-Key mehr nötig!)
localStorage.setItem('gs_use_proxy', '1')
location.reload()
// → KI-Calls gehen jetzt via ai-proxy mit deinem Server-Key

// Push-Subscription (nach Login)
await gsPush.subscribe({hour: 6})  // 6 UTC = 7/8 Uhr CH-Zeit
await gsPush.test()
// → Test-Push sollte sofort ankommen
```

**Erwarteter Output für Health-Check (4 von 9 sollten ✅, 5 könnten Hinweise haben):**
- ✅ Internet, Service Worker, lokaler Speicher, gsBrain
- ⚠️/✅ Anmeldung, Server-Quota, GPS, Kamera, KI-Zugang (je nach Zustand)

## 9 · Push für alle aktivieren

Nach dem Deploy musst du **bei Bedarf** allen Usern den Server-Proxy
empfehlen — sonst zahlen sie weiter mit BYO-Key. Zwei Optionen:

**Option a — leise**: nichts tun, User behält BYO-Key oder schaltet
selbst um (`localStorage.gs_use_proxy='1'`).

**Option b — laut**: Settings-Modul ergänzen mit Toggle
„KI-Server nutzen (kostenlos für dich)". Code-Snippet:

```js
// In den Settings, sichtbar für eingeloggte User:
function gsToggleProxy(on) {
  localStorage.setItem('gs_use_proxy', on ? '1' : '0');
  location.reload();
}
```

---

## 10 · Tier-Limits anpassen

In `supabase/functions/ai-proxy/index.ts` und
`supabase/functions/entitlements/index.ts`:

```ts
const TIER_LIMITS: Record<string, number> = {
  free: 5,        // Tages-KI-Calls
  plus: 200,
  pro: 2000,
  lifetime: 2000,
};
```

**Wichtig**: beide Files synchron halten. Nach Anpassung:
```bash
supabase functions deploy ai-proxy entitlements
```

---

## 15 · iNaturalist-Bridge (optional, P2-1)

GreenScan kann Funde auf [iNaturalist](https://www.inaturalist.org/)
veröffentlichen — Eintritt zur Schweizer Bürger-Wissenschafts-Community
(630k+ CH-Sichtungen, GBIF-Anbindung).

### 15.1 · OAuth-App registrieren (einmalig)

1. Mit deinem iNat-Owner-Account einloggen
2. https://www.inaturalist.org/oauth/applications/new
3. Felder ausfüllen:
   - **Name**: `GreenScan`
   - **Redirect URI**: `https://greenscan.ch/`  ← exakt mit Trailing-Slash
   - **Scopes**: `write` (Standard reicht)
4. **Client-ID** notieren (lange Hex-String). **Client-Secret wird NICHT
   gebraucht** — wir nutzen PKCE.

### 15.2 · Client-ID in der App hinterlegen

Zwei Wege (entweder oder):

**a)** Per Browser-DevTools (für Tests):
```js
localStorage.setItem('gs_inat_client_id', '<deine-client-id>')
```

**b)** Per Meta-Tag im `<head>` (für alle User dauerhaft) — in
`index.html` nach den anderen Metas einfügen:
```html
<meta name="gs-inat-client-id" content="<deine-client-id>">
```

### 15.3 · Test

```js
gsINaturalist.connect()        // → Redirect zu iNat-Login
// Nach Rückkehr:
await gsINaturalist.me()       // → User-Profil
gsINaturalist.isConnected()    // → true
```

### 15.4 · Im Scan-Result-Flow nutzen

```js
await gsINaturalist.publishObservation({
  speciesGuess: 'Bärlauch',
  latinName:    'Allium ursinum',
  observedOn:   '2026-04-30',
  lat: 47.3769, lng: 8.5417, accuracy: 12,
  description:  'Auf einem Spaziergang im Waldhof gefunden.',
  photoB64:     'iVBORw0KGgoAAAANSU...',
  photoMime:    'image/jpeg'
});
// → { id: 123456, url: 'https://www.inaturalist.org/observations/123456' }
```

### 15.5 · Rollback / Disconnect

```js
gsINaturalist.disconnect()  // Token + Profile löschen
```

Token wird auch automatisch entfernt, wenn iNat ihn als ungültig (401)
ablehnt.

---

## 11 · Rollback

Wenn etwas nicht passt:

```bash
# Cron stoppen
supabase db query 'select cron.unschedule(''greenscan-daily-push'');'

# Edge Functions löschen (User fällt auf BYO-Key zurück)
supabase functions delete ai-proxy entitlements push-test daily-push

# Code-Stand zurücksetzen
git checkout main
```

Migrations rückgängig machen ist destruktiv (Datenverlust).
Empfehlung: lassen, falls du sie später wieder brauchst.

---

## 12 · Was funktioniert OHNE Server-Deploy

Falls du den Server-Stack noch nicht aufsetzt: **die App läuft trotzdem**:

| Feature | Funktioniert ohne Deploy? |
|---|---|
| Scanner mit BYO-Key (sk-ant-…) | ✅ |
| Multikriterien-Bestimmungs-Schlüssel | ✅ |
| Brain-Tipp + Wochen-Insights | ✅ (lokal) |
| Garten-Planer | ✅ (mit BYO-Key) |
| Pflanzendoktor | ✅ (mit BYO-Key) |
| Quiz | ✅ |
| Karte (swisstopo) | ✅ |
| Health-Check | ✅ |
| Brain-Inspector | ✅ |
| i18n DE/FR/IT | ✅ |
| **Brain-Memory geräteübergreifend** | ❌ (braucht brain_memory-Tabelle) |
| **Quota-Schutz vor Manipulation** | ❌ (braucht entitlements Edge Fn) |
| **Server-Proxy (kein User-Key)** | ❌ (braucht ai-proxy Edge Fn) |
| **Tägliche Push-Tipps** | ❌ (braucht VAPID + Cron) |

Sprich: ohne Deploy ist GreenScan **eine starke lokale App**. Mit Deploy
wird sie eine **Cloud-Smart-App**.

---

## 13 · Häufige Probleme

| Problem | Lösung |
|---|---|
| `supabase functions deploy` fragt nach Login | `supabase login` einmalig |
| `Function ai-proxy returned 503: Server: ANTHROPIC_API_KEY fehlt` | Schritt 4.1 nicht gemacht |
| `Function push-test 503: VAPID nicht konfiguriert` | Schritt 4.2 nicht gemacht |
| Push kommt nicht an | DevTools → Application → Push → endpoint manuell mit `web-push send` testen |
| `Function 401: invalid session` | Token abgelaufen — User neu einloggen |
| `gsHealthCheck` zeigt Quota „n/a" | Edge Fn entitlements nicht deployed (Schritt 5) |

---

**Nach allen 7 Schritten ist GreenScan auf der Höhe der Zeit.** Wenn du
auf einen Punkt klemmst, sag mir welchen — ich pinpointe.
