# GreenScan 🌿

Schweizer Naturbestimmungs-PWA — 4'342 Arten, Claude-KI-Scanner,
Garten-Planer, swisstopo-Karte, offline-fähig.

**Live**: https://greenscan.ch/ · **App**: https://greenscan.ch/install

## Stack

- **Frontend**: Vanilla JS in einem `index.html` (kein npm, kein Build).
  Hosting Cloudflare Pages.
- **Backend**: Supabase (Auth, Postgres mit RLS, Storage, Edge Functions).
- **KI**: Claude (Anthropic) — entweder BYO-Key oder Server-Proxy.
- **Maps**: Leaflet + swisstopo WMTS.
- **Sicherheit**: CSP, HSTS, revDSG-konform, Opt-In Analytics.

## Schlüsselfeatures

- 🤖 **gsBrain** — zentraler Lern-Hub: aggregiert Standort, Saison, Wetter,
  Garten, Quiz-Schwächen → fließt in jeden KI-Call. Geräteübergreifend.
- 🔑 **Multikriterien-Schlüssel** — Filter nach Familie, Farbe, Habitat,
  Höhe, Saison, essbar, giftig, geschützt.
- 🩺 **Health-Check** — `gsHealthCheck()` liefert in 5 s Status aller
  Subsysteme.
- 🔔 **Smart-Push** — tägliche personalisierte Tipps aus Brain-Memory.
- 🌍 **i18n** — DE/FR/IT.
- 🔐 **Server-Proxy** — User braucht keinen eigenen KI-Key.

## Dokumentation

- 📖 [`CLAUDE.md`](./CLAUDE.md) — Onboarding für AI-Agenten (Konventionen,
  gsBrain-API, Sicherheits-Regeln, Sync-Protokoll).
- 📊 [`STATUS.md`](./STATUS.md) — Operativer Snapshot: was funktioniert,
  was unverifiziert ist, bekannte Bugs.
- 🗺️ [`ROADMAP.md`](./ROADMAP.md) — Priorisierte Meilensteine (P0/P1/P2/P3),
  Definition von „beste App der Schweiz" mit 5 Kriterien.
- 🚀 [`DEPLOY.md`](./DEPLOY.md) — Schritt-für-Schritt-Deploy-Checkliste
  (7 Befehle, Migrations, Edge Functions, Cron, Smoke-Test).

## Quick-Start für Entwickler

```bash
# Static-Hosting reicht (kein Build)
git clone https://github.com/1amfernando/GreenScan.git
cd GreenScan
python3 -m http.server 8000
# → http://localhost:8000
```

Für volle Server-Features: siehe [`DEPLOY.md`](./DEPLOY.md).

## Multi-Agent-Workflow

Mehrere AI-Sessions arbeiten parallel. Vor jedem Edit: `STATUS.md` lesen,
nach dem Edit aktualisieren. File-Locks und Sync-Protokoll in `CLAUDE.md`.

## Lizenz / Kontakt

Made in Switzerland · Datenschutz revDSG-konform · Tox Info Suisse 145.
Kontakt: info@greenscan.ch
