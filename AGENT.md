# AGENT.md — Anleitung für den Deployment-Agent

> Dieses Dokument richtet sich an einen **Deployment-Agent**
> (Bash-/CI-Pipeline / KI-Codier-Agent), der GreenScan automatisch
> deployen soll. Lies dies vor `CLAUDE.md` und `DEPLOY.md`.

---

## 🎯 Deine Aufgabe

GreenScan auf https://greenscan.ch live + funktionsfähig machen — vom
Code-Stand des aktuellen Branches bis zum laufenden Server-Stack.

Die App ist **vollständig vorbereitet**: 31 JS-Module, 5 Edge Functions,
4 Migrations, alle Doku-Files. Du musst sie nur noch deployen.

---

## ⚡ Quick-Start (3 Befehle)

```bash
# 1) Repo klonen & wechseln
git clone https://github.com/1amfernando/GreenScan.git && cd GreenScan
git checkout main

# 2) .env aus Vorlage füllen (siehe „Pflicht-Variablen" unten)
cp .env.example .env
$EDITOR .env

# 3) Master-Deploy
./scripts/deploy.sh
```

Das war's. Bei Erfolg: alle 5 Edge Functions live, Stripe-Webhook
konfiguriert, pg_cron läuft, Smoke-Test grün.

---

## 📋 Pflicht-Variablen in `.env`

Ohne diese funktioniert `deploy.sh` nicht:

| Variable | Quelle |
|---|---|
| `SUPABASE_PROJECT_REF` | `vowbiueikwrauuceilhc` (aus index.html) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase-Dashboard → Settings → API → `service_role secret` |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/settings/keys (Format: `sk-ant-…`) |

## 🔧 Empfohlene Variablen (sonst Skip mit Warnung)

| Variable | Was passiert wenn leer |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe-Webhook nicht automatisch konfiguriert (manuell siehe DEPLOY.md §11.5) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Werden automatisch via `web-push` generiert und in `.env` zurückgeschrieben |
| `GS_INAT_CLIENT_ID` | iNaturalist-Bridge zeigt Setup-Hinweis im Modal — User kann iNat-Funktion nicht nutzen, aber alles andere läuft |

---

## 🤖 Was deploy.sh macht (Reihenfolge)

```
00-prereq      → Tools (git, jq, supabase CLI, node), ENV, Login
10-link        → supabase link --project-ref <REF>
20-migrations  → supabase db push (4 Tabellen)
30-secrets     → 4 Secrets setzen (Anthropic, 3× VAPID)
40-functions   → 5 Edge Functions deployen
60-stripe      → Stripe-Webhook anlegen oder aktualisieren
                 (gibt evtl. neues Secret zurück → wird in .env gespeichert)
50-cron        → pg_cron + vault.secrets, stündlicher daily-push
70-smoke       → curl-basierte End-to-End-Tests
```

**Idempotent**: Du kannst `deploy.sh` beliebig oft laufen lassen. Nichts
wird doppelt erstellt, alles wird nur aktualisiert.

---

## 🔬 Modi

### Vollautomatisch (CI/CD, default)
```bash
./scripts/deploy.sh
```
Geht durch alle Schritte ohne Bestätigung. Bei Fehler: Abbruch + Rollback-Hinweis.

### Interaktiv (manuelle Bestätigung pro Schritt)
```bash
GS_INTERACTIVE=1 ./scripts/deploy.sh
```

### Dry-Run (zeigt nur was getan würde)
```bash
GS_DRY_RUN=1 ./scripts/deploy.sh
```

### Einzelner Schritt
```bash
./scripts/40-functions.sh   # nur Edge Functions
./scripts/70-smoke.sh        # nur Smoke-Test
```

---

## 🚨 Rollback

```bash
./scripts/99-rollback.sh
```

Was wird zurückgenommen:
- `cron.unschedule('greenscan-daily-push')`
- Stripe-Webhook auf `disabled` (nicht gelöscht)

Was BLEIBT:
- Edge Functions (Rollback würde sie löschen → besser durch erneutes Deploy ersetzen)
- DB-Tabellen (kein Datenverlust)
- Frontend auf `main` (du musst manuell `git revert` + push)

---

## 🔁 GitHub Actions

`.github/workflows/deploy.yml` triggert automatisch bei Push auf `main`,
wenn `supabase/**` oder `scripts/**` geändert wurde.

Erforderliche **GitHub-Secrets** (Settings → Secrets → Actions):
- `SUPABASE_PROJECT_REF`
- `SUPABASE_ACCESS_TOKEN` (aus `supabase login` lokal: `~/.supabase/access-token`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `VAPID_PUBLIC_KEY` (falls vorgegeben — sonst auto-generated)
- `VAPID_PRIVATE_KEY`
- `STRIPE_SECRET_KEY` (optional)
- `STRIPE_WEBHOOK_SECRET` (optional, wird sonst angelegt)

**Manueller Trigger**: GitHub → Actions → „Deploy to Production" → Run workflow.

`.github/workflows/preview.yml` läuft bei jedem PR und prüft:
- HTML-`<script>`-Tag-Balance
- JSON / XML / SQL Syntax
- Repo-Struktur (Pflicht-Files vorhanden)
- Hardcoded Secrets in Code

---

## 🤔 Was du NICHT automatisieren kannst

Diese Schritte erfordern menschliche Aktion:

| Aufgabe | Warum nicht automatisiert |
|---|---|
| Cloudflare-Pages-Build | Triggert automatisch nach `git push origin main` |
| iNat-OAuth-App-Registrierung | iNat hat keine API für App-Erstellung. Manuell auf https://www.inaturalist.org/oauth/applications/new |
| NVIDIA-Key rotieren | Falls noch nie: alten geleakten Demo-Key in NVIDIA-Dashboard widerrufen |
| App-Store-Listing | PWABuilder (Google Play) + Capacitor (Apple) brauchen interaktive UI/Xcode |
| OG-Image + Screenshots | Design-Aufgabe (Figma/Canva) — siehe `DEPLOY.md` §16 |
| Browser-Smoke-Test | `gsSelfTest()` muss in echtem Browser laufen |

---

## 🧪 Smoke-Test-Befehle (nach `deploy.sh`)

In Browser-DevTools-Console auf `https://greenscan.ch/`:

```js
// 1) Module-Reachability — alle 33 ✅?
await gsSelfTest()

// 2) Health-Check
await gsHealthCheck(true)

// 3) Server-Proxy aktivieren + KI-Scan testen
localStorage.setItem('gs_use_proxy', '1')
location.reload()

// 4) Push-Subscribe + Test (Mobile/Desktop mit Permission)
await gsPush.subscribe({hour: 6})
await gsPush.test()
```

Erwartetes Ergebnis siehe `RELEASE.md` Phase 5.

---

## 📚 Weitere Doku

- [`README.md`](./README.md) — Übersicht, Features, Stack
- [`DEPLOY.md`](./DEPLOY.md) — Detail-Anleitung für manuelle Deploys
- [`RELEASE.md`](./RELEASE.md) — Verbindliche Pre-Launch-Checkliste
- [`STATUS.md`](./STATUS.md) — Aktueller Code-Stand, bekannte Bugs
- [`ROADMAP.md`](./ROADMAP.md) — Was ist fertig, was kommt
- [`CLAUDE.md`](./CLAUDE.md) — Onboarding für AI-Code-Sessions

---

## ⚠️ Sicherheits-Hinweise für den Agent

- **`.env` NIEMALS committen** (steht in `.gitignore`).
- **Service-Role-Key** hat volle DB-Rechte → nur für `deploy.sh` und
  GitHub-Actions-Secrets, niemals im Frontend.
- **Stripe-Secret-Key** ist Live-Key sobald `sk_live_…` → eigene Vorsicht.
- **Idempotenz** ist geprüft: jeder `deploy.sh`-Run ist sicher.

---

## 🆘 Wenn was schiefgeht

1. `./scripts/70-smoke.sh` — was fehlt konkret?
2. `supabase functions list` — alle 5 deployed?
3. `supabase secrets list` — alle ENV-Variablen gesetzt?
4. Im Stripe-Dashboard → Webhooks → Test-Event senden
5. Browser → DevTools → Console → `await gsSelfTest()`

Bei kritischen Issues: `./scripts/99-rollback.sh` und dann manuell debuggen.

---

**Ziel-Stand nach erfolgreichem Deploy**:
```
✅ Cloudflare-Pages → Frontend live auf https://greenscan.ch
✅ Supabase → 4 Tabellen, 5 Edge Functions, 5 Secrets, pg_cron
✅ Stripe → Webhook konfiguriert, signiert
✅ gsSelfTest() im Browser → 33/33 ✅
```
