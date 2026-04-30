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

**KI & Lernen:**
- 🤖 **gsBrain** — Kontext-/Lern-Hub: aggregiert Standort, Saison, Wetter,
  Garten, Quiz-Schwächen → fließt in jeden KI-Call. Geräteübergreifend
  via Supabase. LLM-basierte Smart-Recommendations bei reichem Memory.
- 🧠 **gsSRS** — Spaced-Repetition (SM-2, SuperMemo) für adaptives Quiz.
- 🤖 **Server-Proxy** — User braucht keinen eigenen Claude-Key.

**Schweizer Authentizität:**
- 🍄 **VAPKO-Pilzkontrollen** — ~50 Stationen direkt auf der Karte.
- 🛡️ **IUCN-Schutzstatus** nach BAFU für 80+ Schweizer Arten.
- 🌡️ **MeteoSwiss-Warnungen** — Frost / Hitze / Sturm / Stark-Regen.
- 🗺️ **swisstopo** + Wanderwege + GPX-Import/Export.
- 📚 **Quellen pro Art** — Info Flora · GBIF · Wikipedia (locale-aware).
- 🌍 **DE/FR/IT/Mundart** — vier Sprachen incl. Schweizerdeutsch.

**Bestimmung:**
- 🔑 **Multikriterien-Schlüssel** — Filter nach Familie, Farbe, Habitat,
  Höhe, Saison, essbar, giftig, geschützt.
- 📷 **KI-Scanner** — Claude Vision mit Phytopathologin/Mykologe/
  Botaniker-Personas + User-Kontext.

**Community & Viralität:**
- 🦋 **iNaturalist-Bridge** (PKCE-OAuth) — Funde zu 630k+ CH-Sichtungen.
- 📤 **Share-Cards** — 1080×1080 Image-Cards mit Schweiz-Branding.
- 🔔 **Smart-Push** — tägliche personalisierte Tipps aus Brain-Memory.
- 🏆 **24 Achievements** — Badge-System, gamifizierte Retention.

**Stabilität & Diagnose:**
- 🩺 **`gsHealthCheck`** — 9-Komponenten-Ampel.
- 🧪 **`gsSelfTest`** — 33 Module-Reachability-Checks vor Deploy.
- 🔐 **CSP/HSTS/COOP** + revDSG-Consent + server-side Quota.
- 💾 **Storage-Auto-Rotation** — keine Quota-Crashes.
- 📦 **PLANT_DB-Split** — -45% Initial-Download.

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
