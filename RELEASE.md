# RELEASE.md — Pre-Launch-Checkliste

> **Verbindliche Schritte vor dem Release.** Jeder Punkt zählt. Wenn alle
> abgehakt sind, ist GreenScan auf der höchsten Reife für #1 in der
> Schweiz.

**Aktuelle Version**: `v24.13` · **Branch**: `claude/audit-app-features-CXtrI` · **PR**: #1

---

## ⏱️ Zeitplan (realistisch in 14 Tagen)

| Tag | Aufgabe | Aufwand |
|---|---|---|
| 1 | PR-Merge + Cloudflare-Build + Browser-Smoke-Test | 1–2 h |
| 2 | Server-Stack deployen (Migrations + 5 Edge Fns + VAPID + Cron) | 4 h |
| 3 | iNat + Stripe-Webhook konfigurieren · NVIDIA-Key rotieren | 1 h |
| 4–5 | OG-Image + manifest-Screenshots erzeugen | 4–8 h |
| 6–8 | Stresstests auf iPhone + Android · Multi-User-Test | 8 h |
| 9–10 | Stripe-Sandbox-Tests (alle Pläne durch) | 4 h |
| 11–12 | App-Store-Wrapper (PWABuilder + Capacitor) — optional | 8–16 h |
| 13–14 | Final-Polish · Marketing-Push · Beta-Tester einladen | flexibel |

---

## ✅ Phase 1 · Code-Merge (Tag 1, ~30 min)

- [ ] **PR #1** auf [github.com/1amfernando/GreenScan/pull/1](https://github.com/1amfernando/GreenScan/pull/1) prüfen
- [ ] Conflicts? Nein — Branch ist auf neuestem `main` rebased
- [ ] **Merge** klicken (Squash + Merge empfohlen)
- [ ] Cloudflare Pages baut automatisch (~30 s) → https://greenscan.ch
- [ ] Browser hart-refresh (Cmd+Shift+R) — Service-Worker-Update-Banner sollte erscheinen
- [ ] „Jetzt aktualisieren" → App lädt v24.13

## ✅ Phase 2 · Server-Stack (Tag 2, ~30 min)

Komplette Anleitung in [`DEPLOY.md`](./DEPLOY.md). Quick-Sequenz:

```bash
# 0) Supabase CLI installiert?
supabase --version  # >= 1.180

# 1) Projekt verlinken
supabase link --project-ref vowbiueikwrauuceilhc

# 2) Migrations (4 Stück: ai_usage, brain_memory, push_subscriptions, stripe_events)
supabase db push

# 3) VAPID generieren
npx web-push generate-vapid-keys

# 4) Secrets setzen
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set VAPID_PUBLIC_KEY=BPV...
supabase secrets set VAPID_PRIVATE_KEY=x9...
supabase secrets set VAPID_SUBJECT='mailto:info@greenscan.ch'
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

# 5) Edge Functions deployen (5 Stück)
supabase functions deploy ai-proxy       --no-verify-jwt
supabase functions deploy entitlements   --no-verify-jwt
supabase functions deploy push-test      --no-verify-jwt
supabase functions deploy daily-push     --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
```

- [ ] Alle 4 Migrations grün im Supabase-Dashboard
- [ ] Alle 5 Edge Functions grün
- [ ] Secrets-Liste enthält 5 Einträge

## ✅ Phase 3 · pg_cron (Tag 2, ~10 min)

Im Supabase SQL Editor (siehe `supabase/functions/push-test/README.md` §6):

```sql
create extension if not exists pg_cron;
create extension if not exists http;

-- service_role_key in vault speichern (Dashboard → Settings → API)
insert into vault.secrets (name, secret) values ('service_role_key', '<JWT>')
  on conflict (name) do update set secret = excluded.secret;

-- Stündlicher Push-Trigger
select cron.schedule(
  'greenscan-daily-push', '0 * * * *',
  $$ select net.http_post(
       url := 'https://vowbiueikwrauuceilhc.supabase.co/functions/v1/daily-push',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='service_role_key')
       ),
       body := '{}'
     ); $$
);

-- Verifizieren
select * from cron.job;
```

- [ ] Cron-Job erscheint in `cron.job`
- [ ] Nach 1 h: erste Push-Logs in `daily_push.last_sent_at` (für Test-User)

## ✅ Phase 4 · iNaturalist + Stripe (Tag 3, ~15 min)

### iNaturalist
- [ ] App registriert auf https://www.inaturalist.org/oauth/applications/new
  - Name: `GreenScan`, Redirect URI: `https://greenscan.ch/`, Scope: `write`
- [ ] Client-ID hinzugefügt: `localStorage.setItem('gs_inat_client_id', '<ID>')`
  ODER `<meta name="gs-inat-client-id" content="...">` im `<head>`

### Stripe
- [ ] Webhook angelegt im Stripe-Dashboard:
  - URL: `https://vowbiueikwrauuceilhc.supabase.co/functions/v1/stripe-webhook`
  - Events: `checkout.session.completed`, `customer.subscription.*`,
    `invoice.paid`, `invoice.payment_failed`
  - Signing-Secret als `STRIPE_WEBHOOK_SECRET` gesetzt (Phase 2 Schritt 4)
- [ ] „Send test webhook" klicken → 200 OK
- [ ] In Supabase → Table `stripe_events` → Test-Event sichtbar

### NVIDIA-Key
- [ ] Falls noch nicht: alten geleakten NVIDIA-Demo-Key in Anthropic-Dashboard
      rotieren (war in Git-History pre-v23.86)

## ✅ Phase 5 · Browser-Smoke-Test (Tag 1, ~30 min)

In DevTools-Console auf `https://greenscan.ch/`:

```js
// 1) Module-Reachability (33 Tests)
await gsSelfTest()
// Erwartung: alle ✅ — wenn ❌: vor weitergehen FIXEN!

// 2) Health-Check (9 Komponenten)
await gsHealthCheck(true)
// Erwartung: 4 ✅ minimal, GPS/Camera erst nach User-Permission

// 3) Brain-Inspector
gsBrainDebug(true)
// Erwartung: Modal mit Kontext (lat/lng/canton/season/...)

// 4) Multikriterien-Schlüssel
openMultiKey()
// Filter mit 4'342 Arten

// 5) VAPKO-Pilzkontrollstellen
openVapko()
// ~50 Stationen sortiert nach GPS-Distanz

// 6) Achievement-Wand
openAchievements()
// 34 Badges in Grid

// 7) Welcome-Tour
openWelcomeTour()
// 3-Slide-Modal

// 8) Schweizerdeutsch
gsLocaleSwitch('gsw')
// Tabs: "Doheim · Scanner · Sueche · Pflanze · Menü"
gsLocaleSwitch('de')

// 9) Server-Proxy aktivieren
localStorage.setItem('gs_use_proxy', '1')
location.reload()
// Scanner sollte nun ohne BYO-Key funktionieren

// 10) iNat (nach Client-ID-Setup)
gsINaturalist.connect()
// Redirect zu inaturalist.org

// 11) Push (nach Login + auf Mobile/Desktop mit Permission)
await gsPush.subscribe({hour: 6})
await gsPush.test()
// Test-Push sollte sofort kommen
```

- [ ] `gsSelfTest()`: alle 33 ✅
- [ ] Multikriterien-Schlüssel filter funktional
- [ ] VAPKO-Modal zeigt Stellen
- [ ] Achievement-Wand rendert ohne Fehler
- [ ] Schweizerdeutsch-Switch funktioniert
- [ ] (Server-Proxy auf): KI-Scan ohne User-Key funktioniert
- [ ] (Wenn iNat konfiguriert): Connect-Flow läuft durch

## ✅ Phase 6 · Marketing-Assets (Tag 4–5)

Siehe [`DEPLOY.md`](./DEPLOY.md) §16.

### OG-Image (1200×630)
- [ ] Bild erzeugen mit Logo + „4'342 Schweizer Arten · KI-Scanner · greenscan.ch"
- [ ] Speichern als `icons/og-1200x630.jpg`
- [ ] In `index.html` Meta-Tag `og:image` umstellen
- [ ] Test mit https://www.opengraph.xyz/url/https%3A%2F%2Fgreenscan.ch oder via WhatsApp-Link teilen

### manifest-Screenshots (4× 1080×1920)
- [ ] Home-Screen-Screenshot mit Daily-Tipp + Wochen-Insights
- [ ] Scan-Result-Screenshot (Pflanze gefunden)
- [ ] Karte-Screenshot (swisstopo + GPS-Marker)
- [ ] Garten-Planer-Screenshot
- [ ] In `manifest.json` `screenshots`-Array eintragen
- [ ] Effekt: Chrome-Install-Prompt zeigt Screenshots → höhere Conversion

## ✅ Phase 7 · Geräte-Tests (Tag 6–8)

### Android
- [ ] Chrome → greenscan.ch → „App installieren" → öffnet als Standalone
- [ ] Foto teilen aus Galerie → öffnet GreenScan-Scanner mit Bild
- [ ] Camera + GPS funktionieren
- [ ] Push-Notifications kommen an
- [ ] Offline-Modus: Karte + DB + Garten funktionieren

### iPhone (Safari)
- [ ] Safari → greenscan.ch → Teilen → „Zum Home-Bildschirm"
- [ ] Standalone-Mode aktiv (kein Browser-Chrome)
- [ ] Camera funktioniert nach Permission
- [ ] GPS funktioniert
- [ ] Hinweis: iOS-Safari hat begrenzten Push-Support — Test nicht-blockierend

### Desktop (Chrome / Edge)
- [ ] Install-Prompt erscheint (mit manifest-Screenshots!)
- [ ] App läuft im eigenen Fenster
- [ ] Edge: Side-Panel-Mode funktioniert

## ✅ Phase 8 · Stripe-Sandbox-Test (Tag 9–10)

Mit [Stripe Test-Mode](https://dashboard.stripe.com/test):

- [ ] Free-User: max 5 Scans/Tag (server-seitig via `entitlements`-Edge-Fn)
- [ ] Free → Plus Checkout: Kreditkarte `4242 4242 4242 4242`, beliebiges Datum/CVV
- [ ] Webhook-Event in `stripe_events` erscheint
- [ ] User-Tier wechselt auf `plus` (in `v_user_entitlements` prüfen)
- [ ] Quota Plus = 200/Tag → `entitlements`-Endpoint liefert `can_scan: true`
- [ ] Customer-Portal: User kann Plan wechseln + kündigen
- [ ] Cancel → `customer.subscription.deleted` → Tier zurück auf `free`

## ✅ Phase 9 · App-Store (optional, Tag 11–12)

### Google Play (PWABuilder / Bubblewrap)
- [ ] https://www.pwabuilder.com → URL https://greenscan.ch → Android-Package
- [ ] Bubblewrap CLI: `npx @bubblewrap/cli init --manifest https://greenscan.ch/manifest.json`
- [ ] `npx @bubblewrap/cli build`
- [ ] Play Console: neue App, .aab-File hochladen, Store-Listing füllen
- [ ] Internal-Testing-Track first → Play-Test → Public-Release

### Apple App Store (Capacitor)
- [ ] Capacitor: `npm i -g @capacitor/cli && npx cap init`
- [ ] iOS-Plattform hinzufügen, Xcode-Projekt öffnen
- [ ] Apple Developer Account ($99/Jahr)
- [ ] App-Store-Listing + Screenshots
- [ ] TestFlight Beta → App-Review (1–3 Tage) → Public

## ✅ Phase 10 · Final-Polish (Tag 13–14)

- [ ] STATUS.md zeigt alle „verifizierte Features" als ✅
- [ ] ROADMAP.md hat keine offenen P0-Punkte
- [ ] CLAUDE.md aktuell für nachfolgende AI-Sessions
- [ ] Beta-Tester (5–10 Personen) eingeladen → Feedback gesammelt
- [ ] Marketing-Push: SocialMedia, Flora-Helvetica-Foren, lokale News
- [ ] Pressemitteilung in DE/FR/IT bereit
- [ ] Server-Monitoring eingerichtet (Supabase-Dashboards beobachten)

---

## 🚨 Notfall-Rollback

Wenn nach Release ein kritischer Bug auftaucht:

```bash
# Sofort: alten Stand wiederherstellen
git checkout main
git revert <bad-commit>
git push origin main
# Cloudflare baut automatisch zurück (~30 s)

# Edge Functions: alten Stand redeployen oder löschen
supabase functions deploy ai-proxy --no-verify-jwt  # alten Stand vorher checkouten
supabase functions delete <name>  # nuclear option
```

`gsHealthCheck(true)` zeigt sofort, was kaputt ist.

---

## 📊 Was du nach Release tracken solltest

| Metrik | Wo |
|---|---|
| **Daily Active Users** | Supabase `analytics_events` (mit Consent) |
| **KI-Calls / User / Tag** | Supabase `ai_usage` |
| **Push-Subscribe-Rate** | Supabase `push_subscriptions` |
| **Conversion Free → Plus** | Stripe-Dashboard |
| **Crashs / Errors** | Supabase `error_log` (falls aktiviert) |
| **Cloudflare-Bandbreite** | Cloudflare-Dashboard |

## 🎯 Erfolgs-Definition

**„#1 in der Schweiz" wenn:**
- ≥ 5'000 aktive Schweizer User in 60 Tagen
- ≥ 10 % Conversion-Rate Free → Plus
- 4.5+ Sterne in App-Store + Play-Store
- Featured in mind. 2 Schweizer Tech-/Natur-Medien (Watson, NZZ-Tech, SRF)
- Zitate von Info-Flora, BAFU oder VAPKO

**„#1 in Europa"**: Multiplikator ×30, weitere Sprachen (EN, ES, FR-FR), MeteoEurope-Integration.

**„#1 in der Welt"**: Globale DBs (PlantNet-API integration), 50+ Sprachen, Native Apps.

---

**Bei jeder offenen Frage**: in `CLAUDE.md` / `STATUS.md` / `ROADMAP.md` /
`DEPLOY.md` schauen, oder über die `gsHealthCheck()` /
`gsBrainDebug()` / `gsSelfTest()`-Helper prüfen.

Made in Switzerland 🇨🇭 · Tox Info Suisse 145 · revDSG-konform
