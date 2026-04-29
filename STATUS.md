# STATUS.md — Operativer Snapshot

> **Single Source of Truth** für den aktuellen Zustand der App.
> Wenn du etwas änderst, **aktualisiere dieses File im selben Commit**.
> Kompagnon: `CLAUDE.md` (Onboarding) und `ROADMAP.md` (Meilensteine).

**Stand**: 2026-04-29 · **Branch**: `claude/audit-app-features-CXtrI` · **Version**: `v23.91` (in Arbeit) / `v23.90` (gepusht)

---

## 1 · Aktuell auf dem Branch (gepusht)

| Commit | Version | Fokus |
|---|---|---|
| (next push) | v23.91 | Sprint 3: Brain-Memory geräteübergreifend (Supabase brain_memory + push/pull/flushQueue) |
| `c69c5b7` | v23.90 | Sprint 2: Anthropic Edge-Function-Proxy (Supabase Edge Fn + Client-Switch) |
| `ba743df` | v23.89 | Sprint 1: Share-Target-Receiver + Storage-Layer mit Auto-Rotation |
| `39249e9` | v23.88 | Brain-Tip auf Home, Multi-Agent-Doku (CLAUDE/STATUS/ROADMAP) |
| `cd90f34` | v23.87 | gsBrain — zentraler Kontext-/Lern-/Empfehlungs-Hub + 5 KI-Call-Sites |
| `1bde9ec` | v23.86 | App-Store-Polish: iOS-Meta, a11y, SW-Update-Banner, sbFetch-Retry |
| `a5651f4` | v23.86 | NVIDIA-Provider entfernt, Claude-only-UX |
| `d5b9d55` | v23.86 | Sicherheit/CSP/PWA-Hygiene, revDSG-Consent |

**Nicht in main** — `main` steht auf `b56915f` (v23.85). Ein Merge ist
vorbereitet, aber blockiert bis App-Store-Readiness P0/P1 abgeschlossen.

---

## 2 · Was nachweislich funktioniert (Code-Verifikation)

- ✅ **gsBrain-Modul**: `context()`, `format()`, `systemPrompt()`,
  `observe()`, `recommend()`, `dailyTip()`, `memory()`, `roles()` exposed
  via `window.gsBrain`
- ✅ **KI-Auto-Inject**: `callAI(..., {brain:'<rolle>'})` und
  `callVisionAI(..., {brain:'<rolle>'})` prependen Persona + Kontext
- ✅ **Brain-Observer-Hooks**:
  - `gsAddToScanHistory` → `observe('scan_added')`
  - `savePlant` (neue Pflanze) → `observe('garden_plant_added')`
  - `answerDailyQuiz` → `observe('quiz_answered')`
  - `initHomeBoard` → `observe('home_open')` (v23.88)
- ✅ **5 KI-Call-Sites mit Brain-Rolle**: Hauptchat (generalist),
  Pflanzendoktor (phytopathologe ×2), Garten-Plan-Generator (gaertner),
  Garten-Sensor-Refine (gaertner), Pflanzendoktor-Foto (phytopathologe)
- ✅ **NVIDIA-Code restlos raus**: keine aktiven `nvidia`/`nvapi`-Pfade.
  Migration-Hook löscht alten geleakten Demo-Key beim Boot
- ✅ **CSP**: vollständige Allowlist in `_headers`, COOP, CORP, HSTS-Preload
- ✅ **Service Worker v23.86**: Share-Target für Foto-Sharing, Push-Stub,
  notificationclick, Image-Cache-LRU-Trim
- ✅ **Manifest**: `share_target`, `file_handlers`, `protocol_handlers`,
  `launch_handler: navigate-existing`, `edge_side_panel`
- ✅ **revDSG**: Analytics auf Opt-In, Consent-Banner beim ersten Launch
- ✅ **a11y**: Skip-Link, `:focus-visible`, `prefers-reduced-motion`
- ✅ **iOS**: format-detection off, theme-color dark/light split,
  msapplication-TileColor, mehrere apple-touch-icon sizes
- ✅ **sbFetch**: Auto-Retry/Backoff (GET 3 Versuche, POST 2 bei Network)
- ✅ **Share-Target-Receiver** (v23.89): App liest geteilte Fotos aus
  SW-Cache und führt sie automatisch in den Scanner. Plus: File Handling
  API (Doppelklick auf .jpg/.png/.webp im OS) öffnet Scanner mit Foto.
- ✅ **Storage-Auto-Rotation** (v23.89): Bei `QuotaExceededError` werden
  acht bekannte rotatable Listen (`gs_scan_history`, `gs_brain_memory`,
  `gs_ernte_log`, …) automatisch gekürzt und der Schreibversuch
  wiederholt. Public API: `gsStoragePush(key, item, max)` und
  `gsStorageInfo()` für Debug.
- ✅ **Anthropic Edge-Function-Proxy** (v23.90, Code committed —
  Server-Deploy steht noch aus): User braucht keinen eigenen Claude-Key
  mehr, wenn `localStorage.gs_use_proxy === '1'`. Quota pro Tier
  (free 5/Tag, plus 200/Tag, pro 2'000/Tag), Modell-Whitelist,
  Token-Cap 4096, Telemetrie in `ai_usage`-Tabelle. Code unter
  `supabase/functions/ai-proxy/` mit Deploy-README.
- ✅ **Brain-Memory geräteübergreifend** (v23.91, Code committed —
  Migration-Deploy ausstehend): `gsBrain.observe()` schreibt zusätzlich
  in Supabase `brain_memory`. Beim Login: `pullCloud()` mergt letzte
  200 Cloud-Events mit Lokalem (Dedup nach `ts+event`), `flushQueue()`
  re-played offline gesammelte Events. Migration unter
  `supabase/migrations/20260429_brain_memory.sql`. Damit lebt der
  „Schleimpilz" über Geräte-Grenzen hinweg.

---

## 3 · Was UNVERIFIZIERT ist (ehrlich!)

> Diese Punkte sind **statisch korrekt** (Klammer-Balance, JSON valid),
> aber **nicht im Browser getestet**, weil keine npm/Vitest/Playwright-
> Pipeline existiert. Vor App-Store-Release **Pflicht-Test** durch User.

- ⚠️ **Brain-Tipp auf Home** (v23.88): wird beim `initHomeBoard` an das
  `daily-fact`-Element angehängt. Wenn das Element nicht existiert,
  no-op. UI-Test fehlt.
- ⚠️ **API-Key-Test-Button**: `gsTestApiKey` sendet Mini-Ping an Anthropic.
  Ungetestet ob Toast/Status-Block korrekt rendern.
- ⚠️ **Service-Worker-Update-Banner**: idempotente Logik geschrieben,
  aber Trigger nur bei echtem `updatefound`-Event nachvollziehbar.
- ⚠️ **Share-Target-POST**: SW empfängt das Foto, sendet `postMessage`
  an Clients — **kein Empfänger im App-Code**. Foto landet im Cache,
  aber der Scanner liest es nicht aus. → ROADMAP P1.
- ⚠️ **Brain mit nicht-vorhandenen Daten**: `_gsWeatherData`,
  `_gsMoonCache` werden nur dann eingelesen, wenn vorher gesetzt. In
  einer frischen Session vor erstem Wetter-Load liefert Brain teilweise
  ohne Wetter-Felder.

---

## 4 · Bekannte Bugs / Schwachstellen (statisch identifiziert)

| ID | Severity | Wo | Beschreibung | ROADMAP |
|---|---|---|---|---|
| B1 | HIGH | `index.html` ~31 KB JWT-Storage | Auth-Token in localStorage. Mit CSP entschärft, aber XSS-Hijack theoretisch möglich. | P2: HttpOnly-Cookies |
| B2 | MEDIUM | `index.html` 299× innerHTML | Manche Stellen mit User-Input, gegen XSS via `gsSanitize` geschützt — nicht alle systematisch | P2: safeHTML-Migration |
| ~~B3~~ | ~~MEDIUM~~ | ~~`localStorage` Quota~~ | ~~`safeSetItem` schluckt Quota-Errors still~~ | **erledigt v23.89** (Auto-Rotation) |
| B4 | MEDIUM | Stripe-Entitlement | `GS_PLANS[plan].scans` aus localStorage manipulierbar | P1-7: Server-seitig in Edge Function |
| B5 | LOW | `book-ingest` (Z. 46135–46259) | Funktion ohne UI-Hook (kein onclick im HTML) | P3: aktivieren oder löschen |
| B6 | LOW | PLANT_DB inline 4.5 MB | Lädt jedes Mal komplett neu, nicht in IndexedDB | P1-8: Split + Hydration |
| ~~B7~~ | ~~INFO~~ | ~~`callAIWithOfflineFallback`~~ | | **erledigt v23.88** (brain-aware) |

---

## 5 · In Progress (durch wen?)

> Wenn du an einem Bereich arbeitest, schreib dich hier ein, damit andere
> Agenten dich nicht überschreiben.

| Datum | Agent | Bereich | Erwartete Dauer |
|---|---|---|---|
| 2026-04-29 | claude-code (Cloud) | Boot-Audit, Brain, Doku-Sync | abgeschlossen (gepusht) |

---

## 6 · File Locks (für Multi-Agent-Workflow)

Bereiche, die nicht gleichzeitig editiert werden sollten:

| Bereich | Zeilenrange (index.html) | Owner |
|---|---|---|
| API-Helpers (callAI/callVisionAI/sbFetch) | 18321–18450, 39346–39410 | Stable |
| gsBrain-Modul | 18495–18820 | Stable |
| PLANT_DB (4342 Arten) | 12252–32500 | Read-Only ohne Migrations-Plan |
| Init-Sequenz | 40330–42410 | Vorsicht — Race-Risiko |

---

## 7 · Schweizer Compliance-Status

- ✅ **revDSG**: Datenschutz-Erklärung verlinkt, EDÖB-Verweis, Opt-In Analytics
- ✅ **VAPKO**: Pilz-Warnung im Scanner (Tox-Info Suisse 145 prominent)
- ✅ **swisstopo**: Default-Karten-Layer
- ⚠️ **FR/IT/RM**: nur DE-CH — eigene Roadmap-Punkte (P1)
- ⚠️ **iNaturalist-Bridge**: nicht vorhanden (P1)
- ⚠️ **Kantonale Schutzlisten**: nicht eingebunden (P2)

---

## 8 · Live-Deployment-Status

- **Cloudflare Pages**: zieht `main` automatisch
- **Branch-Preview**: jeder Push auf `claude/*` baut eine Preview-URL
  (siehe Cloudflare-Dashboard)
- **Edge-Cache**: HTML 5 min, Icons 1 Jahr, SW immer frisch
- **Cache-Bust**: bei Versions-Bump → SW-Update-Banner triggert User-Reload

---

## 9 · Wenn du nicht weißt, was du tun sollst

1. Lies `ROADMAP.md` — dort sind Meilensteine priorisiert.
2. Wenn keiner passt: arbeite an P0/P1 aus Tabelle in §4.
3. Wenn du auf einen Bug stößt: trag ihn in §4 ein, nicht „silent fix".
