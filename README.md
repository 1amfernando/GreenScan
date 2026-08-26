# GreenScan 🌿

Schweizer Naturbestimmungs-PWA — **4'342 Arten** (Pflanzen, Pilze, Bäume,
Kräuter, Moose, Flechten, Algen). KI-Scanner, Garten-Planer, Pilz-Sicherheit,
Marketplace, mehrsprachig.

**Live:** https://green-scan.ch/ · **Install:** https://green-scan.ch/install.html
*(green-scan.ch ist kanonisch — mit Bindestrich; greenscan.ch ohne Bindestrich ist nur die Mail-Domain.)*

## Stack

- **Frontend:** Vanilla JS in `index.html` (~82k Zeilen Monolith, kein npm/Build).
  Hosting: **Cloudflare Pages**.
- **Backend:** **Supabase** — 117 Tabellen (alle RLS), ~30 Edge-Functions,
  195 Migrationen.
- **KI:** **Claude (Anthropic)** — Server-Proxy (User braucht keinen eigenen Key)
  oder BYO-Key. Eigene Edge-Fns für Scan/Pilz/Schädling/Garten-Analyse.
- **Maps:** Leaflet + swisstopo WMTS.
- **Zahlungen:** Stripe (Live-Mode, inkl. Connect für Marketplace-Experten).
- **Sicherheit:** CSP, HSTS, COOP, revDSG-konform, 0 Security-ERROR-Advisors.

## Schlüsselfeatures

- **📷 KI-Scanner** — autonome Klassifikation, Multi-Shot bei niedriger
  Konfidenz, voller Steckbrief auch für nicht-DB-Arten.
- **🍄 Pilz-Scanner** — roter Vollbild-Warnscreen bei tödlich/giftig,
  Tox-Info-145-Notruf, VAPKO-Region-Lookup.
- **🩺 Pflanzendoktor & Schädlings-Scanner** — KI-Diagnose mit Bio-Behandlung.
- **🌱 KI-Garten-Planer** — 5 Plan-Intents, Forest-Garden-Designer, Balkon-Wizard.
- **📚 Wissen** — 11 Sub-Tabs (Alpen, Vögel, Garten-Besucher, …).
- **🏡 Home-Widgets** — Bauernregel, Saison-Pilze, MeteoSchweiz-Wetter-Alert.
- **🛒 Marketplace** — Stripe-Connect für Experten, Bio-Filter.
- **🌍 DE / FR / IT / Schweizerdeutsch** — live, Boot-Auto-Build für nicht-DE.
- **📱 PWA** — Share-Target, Shortcuts, iOS-Standalone, Offline-fähig.

## Dokumentation

- 📖 [`CLAUDE.md`](./CLAUDE.md) — Onboarding für AI-Agenten (Konventionen,
  KI-Call-Wrapper, RLS-Regeln, Multi-Agent-Sync).
- 📊 [`STATUS.md`](./STATUS.md) — Operativer Snapshot + tägliche Routine-Einträge.
- 🗺️ [`ROADMAP.md`](./ROADMAP.md) — Priorisierte Meilensteine.
- 🧭 [`BACKEND_FRONTEND_MAP_v26.76.md`](./BACKEND_FRONTEND_MAP_v26.76.md) —
  Architektur-Detailkarte (Tabellen, Edge-Fns, Advisor-Stand).
- 🚀 Deploy/Betrieb: `AI_PROXY_ACTIVATION_RUNBOOK.md`, `STORE_SUBMISSION_GUIDE.md`,
  aktuelle `FULL_STACK_AUDIT_v30.*.md`.

## Quick-Start (Entwickler)

```bash
git clone https://github.com/1amfernando/GreenScan.git
cd GreenScan
python3 -m http.server 8000   # kein Build nötig — statische Files
# → http://localhost:8000
```

## Multi-Agent-Workflow

Mehrere AI-Sessions arbeiten parallel (Frontend-Code + „Cowork"-Backend).
Vor jedem Edit: `STATUS.md` lesen. Nach jedem Edit: Routine-Eintrag oben in
`STATUS.md` Sektion 0 anhängen. Konventionen in `CLAUDE.md`.

## Kontakt

Made in Switzerland 🇨🇭 · revDSG-konform · Tox Info Suisse **145** ·
Kontakt: info@greenscan.ch
