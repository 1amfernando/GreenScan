# STATUS.md — Operativer Snapshot

> **Single Source of Truth** für den aktuellen Zustand der App.
> Wenn du etwas änderst, **aktualisiere dieses File im selben Commit**.
> Kompagnon: `CLAUDE.md` (Onboarding) und `ROADMAP.md` (Meilensteine).

**Stand**: 2026-04-30 · **Branch**: `claude/audit-app-features-CXtrI` · **Version**: `v24.07` (in Arbeit) / `v24.06` (gepusht)

---

## 1 · Aktuell auf dem Branch (gepusht)

| Commit | Version | Fokus |
|---|---|---|
| (next push) | v24.07 | Sprint 23: `gsAchievements` — 24 Schweizer Badges + Auto-Trigger über Brain-Events + Toast + Badge-Wand-Modal |
| `8acc95c` | v24.06 | Sprint 22 (P3-2): Schweizerdeutsch-Modus — Locale `gsw` mit ~70 Mundart-Strings, hreflang `gsw-CH` |
| `9b135c6` | v24.05 | Sprint 21 (P3-8): Brain-Recommend-LLM — `gsBrain.smartRecommend(kind)` Async + Cache 6h + Hintergrund-Hydration |
| `d103747` | v24.04 | Sprint 20 (P2-1): iNaturalist-OAuth-Bridge — `gsINaturalist` mit PKCE-Flow, `publishObservation`, Connect-Modal |
| `8c43ac3` | v24.03 | Sprint 17: PLANT_DB-Split → `data/plants.v1.js` (~2.1 MB raus, -45% Initial-Size) + immutable-Cache + SW-Precache |
| `6f23ff1` | v24.02 | Sprint 18: `gsSafeHTML`-Tagged-Template (auto-escape) + CLAUDE.md-Doku-Pattern |
| `1ada9fd` | v24.01 | Sprint 19: `gsSRS` SM-2-Spaced-Repetition + Auto-Bridge zu `gsBrain.observe('quiz_answered')` |
| `318427e` | v24.00 | Phase 2 (Sprint 13-16): `gsRedList` + `gsExternalSources` (in Detail-Modal verdrahtet) · `gsVapko` Pilzkontrollstellen (~50 Stellen) · `gsMeteo` Schweizer Warnungen (Frost/Hitze/Sturm/Regen aus open-meteo) |
| `70aa68c` | v23.99 | Phase 1 (Sprint 10-12): GPX-Import · Print-CSS für saubere PDFs · i18n-Tab-Migration (`gsApplyI18n` + data-i18n) |
| `5dc9880` | v23.98 | Deploy-Ready: DEPLOY.md (7 Befehle), README-Update, defensive Quota-Cache bei Failure |
| `7b61cf7` | v23.97 | Sprint 9 (A): i18n FR/IT-Infrastruktur (`gsI18n` + DE/FR/IT-Bundles + plant-name lookup + hreflang) |
| `be8d202` | v23.96 | Sprint 8 (C): Smart-Push-Notifications (`gsPush` + push-test/daily-push Edge Fns + push_subscriptions Migration) |
| `4559bee` | v23.95 | Sprint 7 (B): Multikriterien-Bestimmungs-Schlüssel (`gsKey` + Filter-Modal) |
| `424c2ff` | v23.94 | Sprint 6: Health-Check / Diagnose-Tool (`gsHealthCheck()` + Modal) |
| `22cf57d` | v23.93 | Sprint 5: Brain v2 — smartere Empfehlungen + Wochen-Insights auf Home + Brain-Inspector |
| `9d85f4a` | v23.92 | Sprint 4: Stripe-Entitlement server-seitig (entitlements Edge Fn + Client-Cache) |
| `16de706` | v23.91 | Sprint 3: Brain-Memory geräteübergreifend (Supabase brain_memory + push/pull/flushQueue) |
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
- ✅ **Stripe-Entitlement server-seitig** (v23.92, Code committed —
  Edge-Fn-Deploy ausstehend): Bug B4 erledigt. Edge Function
  `entitlements` liefert authoritatives `{tier, scans_today,
  scans_limit, can_scan}` aus `v_user_entitlements` ⨝ `ai_usage`.
  Client cached 60s in `_gsServerEnt`, `gsAboCanUse('scan')` nutzt
  Server-Wert wenn vorhanden — localStorage-Manipulation nutzlos.
- ✅ **gsAchievements — Schweizer Badge-System** (v24.07): 24 kuratierte
  Badges (Erstgeborenes/Späher/Sammler/Botaniker:in/Pilzsammler:in/
  Dendrologe/Heilkundler:in/Alpinist:in/Quizmeister:in/Frühlingsbote/
  Bürger-Wissenschaftler:in usw.). Auto-Check nach jedem Brain-Event
  (Bridge wickelt `gsBrain.observe`). Bei Unlock: Toast oben am
  Bildschirm mit Icon, Name, Beschreibung — sequenziell mit 600ms
  Versatz wenn mehrere gleichzeitig. Badge-Wand-Modal mit Progress-Bar
  (X von Y freigeschaltet). Storage `gs_achievements`, idempotent.
  `gsAchievements.reset()` als DevTools-Helper. Globaler Helper
  `window.openAchievements()`.
- ✅ **Schweizerdeutsch-Modus** (v24.06): Locale `gsw` (IETF Tag für
  Swiss German) mit ~70 Strings als „lesbares Schweizerdeutsch"
  (moderater Berner-/Zürcher-Mix). `gsLocaleSwitch('gsw')` triggert
  re-render: Tab-Bar zeigt z.B. „Doheim · Scanner · Sueche · Pflanze ·
  Menü", Buttons werden „Spichere"/„Abbreche", Garten heisst „Gärtli",
  Karte „Charte". `<html lang>` wird `gsw-CH`, `og:locale` wird
  `gsw_CH`, hreflang `gsw-CH` ergänzt. Spielerei mit hohem viralen
  Wow-Effekt — keine offizielle Mundart-Standardisierung nötig.
- ✅ **Brain-Recommend-LLM** (v24.05): Wenn `gs_brain_memory` ≥ 30
  Events UND API-Key/Proxy verfügbar, generiert `gsBrain.smartRecommend(kind)`
  asynchron einen LLM-basierten Tipp via `callAI({brain:'generalist'})`.
  4 Kinds: `daily_tip`, `next_plant`, `quiz_focus`, `next_action`.
  Cache 6h pro `<kind>:<datum>` (max 1 Call/Typ/Tag — kostensicher).
  Hintergrund-Hydration: nach Boot + Login (`syncOnce`) wird der
  Daily-Tipp still generiert; bei Erfolg dispatched
  `gs-brain-smart-tip`-Event und re-rendert die Tipp-Box auf Home.
  `dailyTip()` priorisiert smarten Tipp über Heuristik. Silent-Fallback
  bei fehlendem Key oder Fehler.
- ✅ **iNaturalist-OAuth-Bridge** (v24.04, Code committed —
  Client-ID-Setup durch Owner ausstehend): `gsINaturalist.connect()`
  startet OAuth2-PKCE-Flow (sicher für PWA, kein Client-Secret).
  `handleCallback()` läuft beim Boot wenn `?code&state` in der URL,
  tauscht Code gegen `access_token`, säubert URL via
  `history.replaceState`. `publishObservation({speciesGuess, latinName,
  observedOn, lat, lng, accuracy, description, photoB64, photoMime})`
  → POST `/observations` + separater Foto-Upload via
  `/observation_photos`. `me()` cached User-Profile 24h.
  Connect-Modal mit Scope-Hinweis + Disconnect-Option. Brain-Observe:
  `inat_connect_start`, `inat_connected`, `inat_disconnected`,
  `inat_published`. Setup-Anleitung in `DEPLOY.md §15`.
- ✅ **PLANT_DB-Split** (v24.03): 4'342 Pflanzen aus `index.html`
  extrahiert nach `data/plants.v1.js` (-2.16 MB, -45% Initial-Size).
  index.html jetzt 2.63 MB (vorher 4.79 MB), 45'104 Zeilen (vorher
  49'440). Synchroner `<script src>` im `<head>` lädt DB vor dem
  Shim — `var DB = window.DB` ist 100% kompatibel mit allen
  bestehenden DB-Lese-Stellen. Cache-Header `immutable` (`/data/*.js`),
  Cache-Bust per URL-Versionierung (`plants.v2.js` bei DB-Update).
  Service Worker precacht das File (CACHE_VERSION → `v24.03`) und
  unterstützt Offline-Boot. **Bug B6 erledigt.**
- ✅ **gsSafeHTML — Auto-Escape Tagged-Template** (v24.02): Pattern für
  alle neuen DOM-Konstruktionen mit User-Input.
  `gsSafeHTML\`<div>${userInput}</div>\`` escaped automatisch. Helpers:
  `.escape`, `.attr`, `.url` (whitelist https/http/mailto/relative),
  `.unsafe` (bypass für bereits-escapte Sub-Templates), `.raw` (Variant
  ohne Auto-Escape). `gsHTMLEscape` als Kurz-Alias. CLAUDE.md
  §3.6 dokumentiert das Pattern. **Bestehende 299 innerHTML-Stellen
  bleiben unverändert** (mit `gsSanitize` und CSP gehärtet) — Migration
  iterativ in Folge-Sprints, modul-weise, mit Browser-Test.
- ✅ **gsSRS — Spaced-Repetition (SM-2)** (v24.01): Adaptives Lernen
  statt Zufalls-Quiz. SM-2-Algorithmus (SuperMemo, Goldstandard).
  `gsSRS.review(cardId, q)` mit q∈[0..5] aktualisiert Karten-State
  (ease, interval, reps, lapses, due). `gsSRS.due()` liefert fällige
  Karten sortiert nach Overdue-Tagen, `gsSRS.stats()` liefert
  total/due/learning/mature. **Auto-Bridge**: wickelt
  `gsBrain.observe` ein und konvertiert `quiz_answered`-Events
  automatisch in `gsSRS.observeQuiz(cardId, ok, timeS)` —
  kein Eingriff in Quiz-Flow nötig, das Lern-System wächst transparent
  mit. Storage: `gs_srs_cards`.
- ✅ **gsRedList — IUCN-Schutzstatus Schweiz** (v24.00): kuratierte Liste
  von ~80 Schweizer Arten mit IUCN-Status (LC/NT/VU/EN/CR/RE) nach
  Bornand 2016 + BAFU 2019. `gsRedList.status(latName)` liefert
  `{code,label,color,bg}`. Im Detail-Modal als farbiges Status-Badge
  sichtbar.
- ✅ **gsExternalSources — Wissenschaftliche Quellen** (v24.00): Pro
  Pflanze Links zu Info Flora (`infoflora.ch/de/flora/<slug>.html`),
  GBIF (search by name) und Wikipedia (locale-aware: DE/FR/IT).
  Im Detail-Modal als Quellen-Block sichtbar.
- ✅ **gsVapko — Pilzkontrollstellen** (v24.00): ~50 Schweizer
  Stationen mit Lat/Lng, Kanton, saisonalem Hinweis, optional URL.
  `gsVapko.nearest(lat, lng, n)` Haversine-Sortierung,
  `gsVapko.layer(map)` Leaflet-LayerGroup mit 🍄-Markers,
  `gsVapko.openModal()` Modal mit den 8 nächsten Stellen ab GPS.
  Globaler Helper `window.openVapko()`. Killer-USP gegen alle
  Mitbewerber.
- ✅ **gsMeteo — Schweizer Wetter-Warnungen** (v24.00): leitet aus
  `_gsWeatherData` (open-meteo) Frost/Hitze/Sturm/Stark-Regen-
  Warnungen für die nächsten 3 Tage ab nach MeteoSwiss-Schwellen.
  `gsMeteo.warnings()`, `gsMeteo.urgent()`, `gsMeteo.bannerHTML()`,
  `gsMeteo.officialUrl(canton)` (Link zur offiziellen MeteoSwiss-
  Warn-Seite). Brain-Tipp und Push-Logik können das nutzen.
- ✅ **GPX-Import** (v23.99): `gsTrackImportGPX()` öffnet File-Picker,
  parst GPX 1.0/1.1 (DOMParser, tolerant für `<trkpt>`+`<ele>`+`<time>`),
  splittet Multi-Track-Files in separate Tracks, downsampelt auf 5000
  Punkte. Import-Button im Tracks-Modal. Quellen wie SchweizMobil,
  komoot, Strava werden direkt akzeptiert. (Export existierte bereits.)
- ✅ **Print-CSS** (v23.99): globaler `@media print`-Block versteckt
  Tab-Bar/Topbar/Banner/Modal-Close-X/Skip-Link, A4 mit 1.5cm Rand,
  schwarz-auf-weiss-tauglich, page-break-Hints für `h1-3`/Tabellen/
  Plant-Cards. `window.print()` liefert jetzt saubere PDFs ohne UI-
  Chrome — wirkt für **alle** Modals (Garten-Plan, Pflanzendoktor,
  Wissen-Detail, etc.).
- ✅ **i18n-Tab-Migration** (v23.99): Bundles erweitert um `tab.search`/
  `tab.plants`/`tab.menu` in DE/FR/IT. Alle 5 Bottom-Tab-Labels mit
  `data-i18n="tab.xxx"` markiert. `gsApplyI18n(root?)` scannt
  `[data-i18n]` und `[data-i18n-attr="placeholder:key"]`, ersetzt
  textContent/Attribute idempotent. Wird beim DOMContentLoaded und bei
  jedem `gs-locale-changed`-Event automatisch aufgerufen.
  `gsLocaleSwitch(loc)` triggert kein Reload mehr (live re-render),
  `gsLocaleSwitch(loc, {reload:true})` als Fallback.
- ✅ **i18n FR/IT-Infrastruktur** (v23.97): `gsI18n.t(key, vars)` mit
  Fallback-Chain (current → DE → key). Bundles mit ~70 wichtigsten
  UI-Strings in DE/FR/IT (Tabs, Buttons, Auth, Scanner, Garten, Karte,
  Wissen, Settings, Plan, Quiz, Brain, Notif, Errors, Toxizität).
  `gsI18n.plantName(plant)` mit Top-14 Pflanzen-Namen FR/IT (id-basiert).
  Locale-Detect: `gs_locale` → `navigator.language` → `de`.
  `gsLocaleSwitch(loc)` triggert Reload, `<html lang>`+og:locale werden
  dynamisch gesetzt, hreflang-Tags für SEO (de-CH/fr-CH/it-CH/x-default).
  **Bestehende DE-Strings im Code bleiben unverändert** — andere Agenten
  konvertieren iterativ via `t('key')`-Calls in Folge-Sprints.
- ✅ **Smart-Push-Notifications** (v23.96, Code committed — VAPID-Keys
  + Cron-Setup durch Owner ausstehend): `gsPush.subscribe({hour: 7})`
  registriert Browser-Push, speichert Endpoint+Keys in Supabase
  `push_subscriptions`. `gsPush.test()` schickt sofortige Test-Push,
  `gsPush.unsubscribe()` deaktiviert. Edge Fn `daily-push` wird
  stündlich von pg_cron aufgerufen, baut personalisierte Smart-Tipps
  aus `brain_memory` (letzte 7 Tage) + Saison-Heuristik. Edge Fn
  `push-test` für Sofort-Pushes + VAPID-Key-Lookup. Setup-Schritte
  in `supabase/functions/push-test/README.md`.
- ✅ **Multikriterien-Bestimmungs-Schlüssel** (v23.95): `gsKey.filter(criteria)`
  liefert Pflanzen aus DB, gefiltert nach Kategorie / Familie / Blütenfarbe /
  Habitat / Saison-Monat / Höhenlage (Range-Slider) / essbar / heilkundlich /
  geschützt / max-Toxizität. UI-Modal mit Live-Treffer-Counter, Top-50-
  Resultatliste mit Klick-zur-Detail-Ansicht. Filter-State persistiert in
  `gs_key_filter_state`. Brain-Observe: `multikey_open`, `multikey_apply`.
  Trigger: `window.openMultiKey()`. **Killer-Feature gegen Flora Helvetica**
  (deren Kern-USP), aber UI-Trigger noch nicht in Tabs eingebunden — nächster
  Schritt: Button im Wissen-/Suche-Bereich.
- ✅ **Health-Check / Diagnose-Tool** (v23.94): `gsHealthCheck()` läuft
  9 Checks parallel/sequenziell durch — Online, Service Worker,
  localStorage-Quota, KI-Zugang (BYO-Key oder Proxy), Anmeldung,
  Server-Quota (entitlements Edge Fn), gsBrain-Modul, GPS-Permission,
  Camera-Permission. Liefert Array `{id, name, status:
  'ok'|'warn'|'error'|'na', message, hint}`. Mit `gsHealthCheck(true)`
  öffnet sich ein Diagnose-Modal mit Ampelsystem + konkreten Hilfe-
  Hinweisen pro Check + „Erneut prüfen"-Button. User kann selbst
  prüfen, ob die App intakt ist.
- ✅ **gsBrain v2** (v23.93): smartere `recommend()` mit Frost-Awareness
  (`<5°C` filtert empfindliche Pflanzen), Memory-basierter Quiz-
  Schwäche-Detection (Top-Fehlerkategorie der letzten 100 Events),
  neuer Typ `weekly_summary` (Scans/Garten/Quiz/Shares + Top-Kategorie
  der letzten 7 Tage). Smart-Insights-Box auf Home (nur wenn ≥3 Events).
  `gsBrainDebug()` als DevTools-Helper, `gsBrainDebug(true)` öffnet
  Inspector-Modal (Kontext, Empfehlungen, Memory-Tail, Server-Quota,
  Storage-Info).

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
| B2 | MEDIUM | `index.html` 299× innerHTML | `gsSafeHTML`-Helper steht ab v24.02 bereit. Migration iterativ pro Modul (eigene Mini-Sprints) | P2: safeHTML-Migration (Helper ✓, Code-Migration pending) |
| ~~B3~~ | ~~MEDIUM~~ | ~~`localStorage` Quota~~ | ~~`safeSetItem` schluckt Quota-Errors still~~ | **erledigt v23.89** (Auto-Rotation) |
| B5 | LOW | `book-ingest` (Z. 46135–46259) | Funktion ohne UI-Hook (kein onclick im HTML) | P3: aktivieren oder löschen |
| ~~B6~~ | ~~LOW~~ | ~~PLANT_DB inline 4.5 MB~~ | | **erledigt v24.03** (extrahiert in `data/plants.v1.js`, immutable-cached) |
| ~~B4~~ | ~~MEDIUM~~ | ~~Stripe-Entitlement~~ | ~~`GS_PLANS[plan].scans` aus localStorage manipulierbar~~ | **erledigt v23.92** (entitlements Edge Fn = SoT) |
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
