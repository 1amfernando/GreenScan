# STATUS.md — Operativer Snapshot

> **Single Source of Truth** für den aktuellen Zustand der App.
> Wenn du etwas änderst, **aktualisiere dieses File im selben Commit**.
> Kompagnon: `CLAUDE.md` (Onboarding) und `ROADMAP.md` (Meilensteine).

**Stand**: 2026-05-22 · **Branch**: `main` · **Version**: `v26.15` (LIVE) · **Release**: ✅ v26.0 Pre-Release-stable getagged (auf v25.38)

---

## 0 · Daily-/Weekly-/Monthly-Routine-Eintraege (neueste zuerst)

> Eingefuehrt 2026-05-20 mit `CODE_ROUTINE_MASTER.md`. Code haengt nach jeder Session einen Eintrag hier oben an.

### 2026-05-22 (e) — Triple-Sprint v26.18+v26.19+v26.20

- **Auftrag:** Cowork hat 3 grosse Sprints freigegeben (CODE_AUFTRAEGE_v26.18_v26.20.md). Reihenfolge: v26.20 i18n (höchster Impact, niedrigstes Risiko) → v26.19 Pest-Scanner (Vision-AI + 25 Schädlinge) → v26.18 AR-View (Three.js MVP).
- **v26.20 i18n Frontend-Switcher** (commit `b10709d`, GS_VERSION='v26.20'): gsI18n erweitert um Direct-PostgREST-Pull aus i18n_translations (1 GET-Query, keine Anthropic-Calls). 24h-TTL via bundleTs-Map. Boot-Auto-Build: bei detectLang()!=de UND isStale(lang) → async loadFromDb → applyToDOM. openModal-Hook (idempotent) übersetzt dynamisch geöffnete Modals. gsHandleLangChange Fast-Path. FR/IT/GSW-User sehen jetzt schon beim Erst-Visit ihre Sprache.
- **v26.21 = v26.19 Schädlings-Scanner** (commit `6978f02`, GS_VERSION='v26.21'): Edge-Fn `pest-identify` v1 LIVE (verify_jwt:true, Anthropic Vision Haiku 4.5 + plant_pests-Knowledge-Context mit 25 AGFF-Schädlingen). Frontend: neuer Garten-Aktion-Button "🪲 Schädling-Scanner" + #modal-pest mit Foto-Upload (Kamera/Galerie, 8MB Limit) + Host-Plant-Picker aus myPlants. 5 neue Functions (openPestModal/gsPestLoadPhoto/gsPestRunScan/gsPestRenderResult/gsPestAddToDiary). Confidence-Badge 3 Stufen (Gering/Mittel/Hoch). Bei Confidence < 40 zeigt "bitte näher"-Hint statt false-positive.
- **v26.22 = v26.18 AR-View MVP** (commit `076afad`, GS_VERSION='v26.22'): Three.js basierter 3D-View für 30 Seed-Pflanzen aus ar_models (gltf_url=NULL → Fallback-Geometrie). gsAROpen + _gsARInitScene + _gsARRenderFallback + _gsARDispose. Eigene Drag/Pinch/Wheel-Pointer-Logic statt OrbitControls (spart externe Abhängigkeit). _gsARColors-Map mit 30 species-spezifischen Krone-Farben. Memory-Leak-frei via closeModal-Hook. Three.js bereits self-hosted (/assets/three.min.js seit v25.36).
- **Cowork-Restpflichten:**
  - 🟡 knowledge-bulk-gen v7 mit seasonal_highlights Topic
  - 🟡 Stripe-Dashboard: Webhook-Endpoint um account.updated + account.application.deauthorized als Enabled-Events ergänzen (für v26.6/v26.17 Marketplace-Connect-Loop)
  - 🟡 Stripe-Dashboard Connect aktivieren
  - 🟡 Stripe Live-Mode-Switch (Fernando)
  - 🟡 Bonus v26.18a/b/c (optionale Nachzieh-Sprints): seasonal_highlights als 17. knowledge-bulk-gen Topic · compost_recipes + propagation_methods im Frontend (Wissen-Tab) · Pest-Filter im KI-Planer.
- **Followup naechste Session:** Browser-Smoke-Test via Chrome-MCP (FR-Switch, Schädling-Foto, AR-View für Tomate) falls verfügbar. Bonus-Sprints v26.18a/b/c bei Bandbreite.

### 2026-05-22 (d) — AUFTRAG_v26.17 Refinements (stripe-webhook v10)

- **Auftrag:** Nach v9-Push schrieb Cowork das AUFTRAG_v26.17 mit 3 spezifizierten Refinements. Meine v9 matched zu ~95%, aber: (a) `account.application.deauthorized` Handler fehlte komplett, (b) v9 setzte `disabled` bei JEDEM disabled_reason (zu aggressiv — Stripe nutzt das auch für transient `pending_verification`), (c) v9 hatte impliziten Skip via UPDATE statt expliziten Pre-Check + warn-log.
- **Edge-Fn `stripe-webhook` v10 LIVE:**
  - `handleAccountUpdated`: jetzt Pre-Check (`SELECT marketplace_sellers WHERE stripe_account_id=...maybeSingle()`), skip mit warn-log wenn kein Eintrag. Status-Mapping konservativer — `disabled` NUR wenn `disabled_reason.startsWith('rejected')`. Sonst `restricted` (für `pending_verification` etc.).
  - `handleAccountDeauthorized` (NEU): bei `account.application.deauthorized` → status='disabled', charges/payouts=false. Account-ID-Lookup zuerst via `event.account` (top-level), Fallback via `event.data.object.account` (API-Version-tolerant).
  - Switch-Case erweitert um `case "account.application.deauthorized"`.
  - Repo-File 1:1 mit v10 synced.
- **Definition of Done v26.17 erfüllt:**
  - ✅ account.updated → marketplace_sellers.status/charges_enabled/payouts_enabled/details_submitted/requirements/business_type sync
  - ✅ account.application.deauthorized → status=disabled
  - ✅ Status-Mapping wie spezifiziert (pending/active/restricted/disabled)
  - ✅ Header-Kommentar v10-Notiz
- **Cowork-Restpflichten (weiter reduziert):**
  - 🟡 Stripe-Dashboard: Webhook-Endpoint um `account.updated` + `account.application.deauthorized` als Enabled-Events ergänzen (sonst kommen die Events nicht beim Webhook an) — siehe AUFTRAG_v26.17 §1.
  - 🟡 Stripe-Dashboard Connect aktivieren
  - 🟡 knowledge-bulk-gen v7 mit seasonal_highlights Topic
  - 🟡 Stripe Live-Mode-Switch
- **Followup naechste Session:** Smoke-Test via AUFTRAG_v26.17 Variante A (synthetic) wenn Cowork den Webhook-Endpoint erweitert hat.

### 2026-05-22 (c) — Autonome Backend-Erweiterung (i18n Pass-3 Live + stripe-webhook v9)

- **Auftrag:** User-Freigabe „lets go" → autonome Wertschoepfung auf 2 Tracks: (1) i18n FR/IT komplett, (2) stripe-webhook v9 mit account.updated Handler.
- **i18n Pass-3 LIVE:**
  - 316 unique DE-Keys aus index.html extrahiert (data-i18n + GS_I18N_JS_STRINGS-Map).
  - i18n-translate Edge-Fn API verstanden: nimmt `{source_lang, target_langs:[fr,it], strings:{key:text}, context}`, macht intern Chunking + Cache via i18n_translations(source_lang, target_lang, source_hash) Schema (NICHT lang/key-Tabelle wie urspruenglich angenommen).
  - 4 Batches × 80 Keys × 2 Sprachen = 632 Translations via curl (Edge-Fn ist verify_jwt:false, kein Auth-Header noetig). Total ~115s, ~22.3k tokens in / 19.6k tokens out = ~$0.10 Anthropic-Cost (Haiku-Pricing).
  - DB-Coverage **VORHER → NACHHER**: DE→FR 30 → **321** (+291) · DE→IT **5 → 313** (+308) · DE→GSW 297 (unveraendert, war Cowork-Pass-2). Schweizer Markt jetzt 100% DE/FR/IT covered. AUFTRAG_CODE_v26.8 Definition-of-Done erfuellt.
- **stripe-webhook v8 → v9 LIVE:**
  - v8-Source komplett uebernommen (kein Behavior-Change fuer existing Triggers Subscription/Checkout/PaymentIntent/Invoice).
  - Neuer `case "account.updated"` mit `handleAccountUpdated` Handler. Logik: Stripe.Account.charges_enabled + payouts_enabled + details_submitted + requirements.currently_due → status-Mapping (active/pending/restricted/disabled).
  - User-Lookup zuerst via `account.metadata.gs_user_id` (von stripe-create-connect-account gesetzt), Fallback via `stripe_account_id` (eindeutig in marketplace_sellers).
  - Sync-Felder: status + charges_enabled + payouts_enabled + details_submitted + requirements (jsonb) + business_type.
  - Damit v26.6 Marketplace-Connect-Loop komplett: Frontend ruft Edge-Fn → Stripe-Onboarding → account.updated Webhook → marketplace_sellers.status sync → gsMarketplaceRefreshSettingsRow zeigt korrekten Status.
  - Repo-File supabase/functions/stripe-webhook/index.ts 1:1 mit deployed v9 synced.
- **Cowork-Restpflichten (reduziert):**
  - ✅ DONE: marketplace_sellers Migration · stripe-create-connect-account · daily-push-checker v3 · stripe-webhook v9 account.updated · i18n FR/IT Bulk-Translate
  - 🟡 Stripe-Dashboard Connect aktivieren (https://dashboard.stripe.com/settings/connect) — sonst returnt stripe-create-connect-account `account_invalid`
  - 🟡 knowledge-bulk-gen v7 mit seasonal_highlights Topic erweitern (aus heute-morgen Daily-Routine flagged)
  - 🟡 Stripe Live-Mode-Switch (Fernando Dashboard-Action)
- **Followup naechste Session:** AR-View v26.9 sobald Cowork ar_models gefuellt hat · Browser-Smoke-Test mit Chrome-MCP falls verfuegbar (Sprachen-Switch FR/IT) · Lighthouse-Pass.

### 2026-05-22 (b) — Backend-Deploy-Session (v26.6/v26.7 Backend)

- **Auftrag:** Cowork hat freigegeben — Backend-Files fuer v26.6 (Marketplace-Connect) + v26.7 (Trial-Reminder) via Supabase MCP deployen.
- **Migration `v26_6_marketplace_sellers`:** ✅ APPLIED. CREATE TABLE marketplace_sellers + 3 RLS-Policies (own_select/insert/update) + index_marketplace_sellers_stripe + view v_my_marketplace_seller (joined mit profiles) + touch_updated_at Trigger.
- **Migration `20260521_push_dedup.sql`:** ❌ NICHT APPLIED — schema-incompatible (push_send_log hat keinen dedup_key Column). Statt eines neuen Indexes wird die existing (user_id, category)-Dedup via fn_push_already_sent_today RPC genutzt. File im Repo als NO-OP-Marker neu geschrieben.
- **Edge-Fn `stripe-create-connect-account`:** ✅ DEPLOYED v1 (verify_jwt: true). Express-Onboarding mit CH/CHF/individual + idempotent (existing account reused) + AccountLink mit refresh/return-URLs. Slug: stripe-create-connect-account.
- **Edge-Fn `daily-push-checker`:** ✅ DEPLOYED v3 (verify_jwt: false). v2-Source komplett uebernommen (Frost / Seasonal / Quiz-Streak Triggers unangetastet) + neuer notifyTrialEndingSoon-Helper am Ende des Handlers. Trial-End nutzt category='trial_end' mit alreadySentToday-Check, push_subscriptions.auth_secret (statt auth), webpush.setVapidDetails aus app_settings. Repo-File jetzt 1:1 mit deployed Code.
- **Cowork-Restpflichten:**
  - 🟡 stripe-webhook v9 muss account.updated-Event handlen → marketplace_sellers.status/charges_enabled/payouts_enabled syncen
  - 🟡 Stripe-Dashboard Connect aktivieren (https://dashboard.stripe.com/settings/connect) — sonst returnt Edge-Fn account_invalid
  - 🟡 daily-push-checker v3 Smoke-Test (curl mit cron-secret oder service_role) waehrend Fernando-Trial gerade laeuft → verify trial_sent ≥ 0
- **Followup naechste Session:** AR-View v26.9 sobald Cowork ar_models gefuellt hat · Stripe Live-Mode-Switch wartet auf Fernandos Dashboard-Action.

### 2026-05-22 — Code-Daily (Fr, KW 21)

- **Sync:** Lokale Divergence aufgeloest — `git reset --hard origin/main` (Cowork-lokale `83f2d40` v26.11-Performance war redundant, Inhalt bereits in meiner v26.12-Bundle).
- **Sprint-Status:** v26.6 Marketplace-Connect (f24f37d → v26.12), v26.7 Trial-Reminder (de5067a → v26.13), v26.8 i18n-Tooling (83bc00e → v26.14), v26.2 User-friendly Release-Notes (0117c23 → v26.15) **alle LIVE** auf origin/main + green-scan.ch.
- **Health:** ✅ LIVE=v26.15 = REPO=v26.15. SW gs-v26.15. Cloudflare antwortet `cache-control: must-revalidate`. 25 Edge-Fns ACTIVE. Webhook 24h: 0 Events (keine Sub-Aktivitaet), 0 Errors. audit_log 24h: nur `knowledge_growth_daily` (pg_cron laeuft).
- **DB-Wachstum:** 16 Knowledge-Tabellen; nur **`seasonal_highlights = 36 (Min 40)`** unter Threshold. Bulk-Gen-Trigger via `pg_net.http_post` → **HTTP 400 "Unknown topic"** — `knowledge-bulk-gen` Edge-Fn kennt `seasonal_highlights` nicht (nur `seasonal_tips`).  → **Cowork-Pflicht:** Topic in `knowledge-bulk-gen` v7 ergaenzen ODER alternative Seed-Quelle definieren.
- **Smoke-Test (HTTP):** ✅ `/` (3.57 MB), `/assets/leaflet.js` (148 KB), `/sw.js` (17 KB), `/data/plants.v1.js` (2.17 MB) — alle HTTP 200, <300ms. (Browser-Smoke fehlt mangels Chrome-MCP.)
- **Cowork-Backend-Pflichten offen** (aus v26.6/v26.7 Sprints):
  - 🟠 `stripe-create-connect-account` Edge-Fn nicht deployed (File: `supabase/functions/stripe-create-connect-account/index.ts`)
  - 🟠 `daily-push-checker` ist noch **v2** — v3 mit `notifyTrialEndingSoon` Re-Deploy ueberfaellig (File: `supabase/functions/daily-push-checker/index.ts`, **existing v2-Trigger Frost/Wasser/Saisonal/Quiz beim Re-Deploy mit dem neuen Trial-Helper im Handler kombinieren**)
  - 🟠 Migrations `20260520_marketplace_sellers.sql` + `20260521_push_dedup.sql` apply
  - 🟡 Stripe-Dashboard Connect aktivieren (https://dashboard.stripe.com/settings/connect)
  - 🟡 FR/IT Bulk-Translate via `scripts/i18n_translate.sh` (235 Keys-Pipeline ready)
- **Followup naechste Session:** seasonal_highlights Topic-Erweiterung verifizieren · Lighthouse-Pass falls Chrome-MCP verfuegbar.

---

## 1 · Aktuell auf dem Branch (gepusht)

| Commit | Version | Fokus |
|---|---|---|
| (next push) | v24.13 | Phase 9: Pre-Launch-Audit-Subagent + 5 Sicherheits-Fixes (1 CRITICAL daily-push-Auth · 3 HIGH CORS-Origins/encodeURIComponent · 1 MED stripe-uuid · LOW SW-Version-Bump) · 10 zusätzliche Achievements (34 total) · 50 zusätzliche IUCN-Arten (130 total) |
| `ee900a7` | v24.12 | Phase 8: Performance-Polish (preconnect/preload erweitert) · DEPLOY.md §16-17 (OG/Screenshots/App-Store-Wrapper) · README-Refresh · Stripe-Webhook Edge Fn (audit-log) + Migration · Error→Brain-Memory-Telemetry |
| `80ba380` | v24.11 | Sprint 28+29+30: Pre-Launch-Polish — `gsAlert`-Helper + 9 alert()→Toast Migrationen · B5 als „Admin-Feature" geklärt · `gsSelfTest()` mit 33 Module-Reachability-Checks |
| `9a78621` | v24.10 | Sprint 26+27: Pre-Launch-Audit + Versions-Sync (alles `v24.10`), install.html-Marketing-Polish (16 Features statt 8) |
| `b6f3df8` | v24.09 | Sprint 25: `gsWelcomeTour` — 3-Slide Welcome (auto-trigger erst-Launch, defensiv, idempotent) |
| `050c45a` | v24.08 | Sprint 24: `gsShareCard` — Canvas-basierte 1080×1080 Share-Cards mit Foto, IUCN-Badge, Schweiz-Branding + native Share-API |
| `a155bfb` | v24.07 | Sprint 23: `gsAchievements` — 24 Schweizer Badges + Auto-Trigger über Brain-Events + Toast + Badge-Wand-Modal |
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
- ✅ **gsAlert + alert()→Toast-Migration** (v24.11): Neuer Helper
  `gsAlert(msg, type)` nutzt `showProfileToast` für kurze Texte
  (≤200 Zeichen, einzeilig), fällt auf nativen `alert()` für lange/
  mehrzeilige Texte zurück. 9 wichtige User-facing alert()-Stellen
  migriert (Login-Hinweis, Stripe-Recovery-Status, Kamera-Errors,
  Garten-Limits, Feedback-Bestätigung).
- ✅ **Pre-Launch-Audit-Sicherheits-Fixes** (v24.13):
  - **D3 (CRITICAL)**: `daily-push` Edge Fn verlangt jetzt
    Service-Role-Bearer-Auth mit Constant-Time-Compare. Vorher: jeder
    mit Function-URL konnte Push-Spam triggern.
  - **D1 (HIGH)**: CORS in `ai-proxy`, `entitlements`, `push-test` von
    `*` auf Allowlist (`greenscan.ch`, `*.pages.dev`, `localhost`)
    umgestellt. `Vary: Origin`-Header hinzugefügt.
  - **G2 (HIGH)**: 4 Stellen `marketplace_listings?id=eq.'+id` und
    `profiles?id=eq.'+uid` mit `encodeURIComponent` geschützt — keine
    String-Concat-Injection möglich.
  - **D4 (MEDIUM)**: `stripe-webhook` validiert `metadata.user_id`
    gegen UUID-Regex `/^[0-9a-f-]{36}$/i` — verhindert Injection-
    Versuche via Stripe-Metadata.
  - **F2 (LOW)**: Versions-Sync v24.13 in allen Files (sw.js
    CACHE_VERSION, index.html GS_VERSION + meta, install.html,
    _redirects, robots.txt).
- ✅ **gsAchievements erweitert auf 34 Badges** (v24.13): +Naturadler
  (500 Scans), +Pilz-Herbst (Sept-Nov), +Kantons-Wanderer:in (5+),
  +Frühaufsteher:in (<7h), +Nachteule (>22h), +Hochalpinist:in
  (>2500m), +Botschafter:in (5 Shares), +Schnellfinger (Quiz <5s),
  +Mundart-Pionier:in, +Werkzeugkasten (alle Tools).
- ✅ **gsRedList erweitert auf ~130 Arten** (v24.13): +50 prominente
  Schweizer Spezies (Orchideen, Alpenflora, Wasserpflanzen,
  Magerwiesen, Heilpflanzen, Bäume) nach Bornand 2016.
- ✅ **Performance-Polish** (v24.12): preconnect für Supabase (mit
  crossorigin) hinzu, dns-prefetch erweitert auf 11 Hosts (cdnjs,
  Anthropic, Open-Meteo, Geocoding, Nominatim, Wikipedia, iNat,
  ArcGIS). 2 preload für `data/plants.v1.js` (script) + Leaflet-CSS
  (style) — Browser fängt früher zu fetchen an.
- ✅ **Stripe-Webhook Edge Function** (v24.12, Code committed —
  Stripe-Webhook-Setup + Secret durch Owner pending): empfängt
  signierte Webhook-Events von Stripe (HMAC-SHA256 verified mit
  5min-Toleranz, Constant-Time-Compare). Schreibt jeden Event in
  `stripe_events`-Audit-Log (additive Migration, kollidiert nicht
  mit existierenden Tabellen). Idempotent über `event.id` als PK.
  Owner-Anleitung in `supabase/functions/stripe-webhook/README.md`
  + DEPLOY.md.
- ✅ **Error→Brain-Memory-Telemetry** (v24.12): bestehender
  globaler Error-Handler (window.onerror + unhandledrejection)
  ruft jetzt zusätzlich `gsBrain.observe('error'|'promise_error', {msg})`
  rate-limited auf 1/sec → Errors sichtbar im Brain-Inspector
  (`gsBrainDebug(true)`).
- ✅ **DEPLOY.md erweitert** (v24.12): §8 mit `gsSelfTest`-Pre-Deploy-
  Block + 12 Smoke-Test-Befehle. §16: OG-Image-Strategie + manifest-
  Screenshots-Anleitung. §17: App-Store-Wrapper (PWABuilder/
  Capacitor) für Google Play + Apple App Store.
- ✅ **README-Refresh** (v24.12): Schlüsselfeatures von 6 auf 21
  Bullets erweitert in 5 Kategorien (KI/Authentizität/Bestimmung/
  Community/Stabilität).
- ✅ **gsSelfTest — Module-Reachability-Check** (v24.11):
  `gsSelfTest()` ruft 33 zentrale Module-Hooks auf und prüft, ob sie
  reachable + funktional sind (gsBrain/Key/RedList/ExternalSources/
  Vapko/Meteo/SRS/SafeHTML/I18n/INaturalist/Achievements/ShareCard/
  WelcomeTour/Push/HealthCheck/BrainDebug/Storage/Alert/Track-Import/
  callAI/callVisionAI/DB/SW/Leaflet/Crypto.subtle/localStorage).
  Liefert `{ok, total, passed, failed, results}`. Pre-Deploy-Befehl
  in DevTools: `gsSelfTest()` — alle ✅ → safe to deploy.
- ✅ **Versions-Sync v24.10** (Pre-Launch): alle hardcoded Version-
  Strings synchronisiert — `meta app-version=24.10`, `GS_VERSION=v24.10`,
  `sw.js CACHE_VERSION=greenscan-v24.10`, `install.html` Badge + Footer,
  `_redirects` + `robots.txt` Header. SW-Cache wird beim nächsten
  Deploy invalidiert → User bekommt Update-Banner automatisch.
- ✅ **install.html Marketing-Polish** (v24.10): Feature-Grid von 8
  auf 16 Karten erweitert. Neue Features sichtbar: Multikriterien-
  Schlüssel, VAPKO-Pilzkontrollen, IUCN-Schutzstatus, MeteoSwiss-
  Warnungen, gsBrain, swisstopo+GPX, iNaturalist-Bridge, 24
  Achievement-Badges, SRS-Quiz, DE/FR/IT/Mundart, Share-Cards, Smart-
  Push, revDSG-konform.
- ✅ **gsWelcomeTour — Erstes-Erfolg-Erlebnis** (v24.09): 3-Slide-Modal
  beim ersten App-Open: (1) Was ist GreenScan + 4'342 Arten + Schweiz-
  Fokus, (2) Schweizer USPs (VAPKO/swisstopo/IUCN/MeteoSwiss/Quellen/
  Tox-145), (3) Drei Wege zum Loslegen (Foto/Multikriterien/Quiz).
  Auto-Trigger 2.5s nach DOMContentLoaded, **defensiv**: prüft
  Consent-Banner und Login-Modal heuristisch, verschiebt sich um 4s
  wenn kollidiert. Idempotent über `gs_welcomed_v24`-Flag. Skip /
  Zurück / Weiter / Loslegen-Buttons. Brain-Observe: `welcome_open`,
  `welcome_completed`. `gsWelcomeTour.reset()` für Tests, globaler
  Helper `window.openWelcomeTour()` für Settings → Tour wiederholen.
- ✅ **gsShareCard — Viral-Share-Cards** (v24.08): Canvas-basierter
  Renderer für 1080×1080 PNG-Cards (Insta-Post + Story-tauglich) mit
  Foto-Hero, Pflanzenname, lat. Name, Datum, Standort (Region/Kanton/
  Höhe), optionalem IUCN-Badge, Confidence-Score, Schweiz-Gradient-
  Branding. `gsShareCard.share(opts)` nutzt native `navigator.share`
  mit File falls verfügbar (WhatsApp/Insta direkt), sonst Download-
  Fallback. `gsShareCard.preview(opts)` öffnet Vorschau-Modal mit
  Teilen+Speichern-Buttons. Brain-Observe: `share_card_open`,
  `share_card_shared` (mit method: native|download|manual_download).
  Globaler Helper `window.openShareCard(opts)`.
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
| ~~B5~~ | ~~LOW~~ | ~~`book-ingest`~~ | **falsch eingestuft v24.11**: ist ein Admin-Feature mit `admin-only-row`-Class (Z. 4401), nicht Dead-Code. Auch im Search-Index (Z. 31802). Keine Aktion nötig. |
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
