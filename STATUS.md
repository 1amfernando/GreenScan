# STATUS.md — Operativer Snapshot

> **Single Source of Truth** für den aktuellen Zustand der App.
> Wenn du etwas änderst, **aktualisiere dieses File im selben Commit**.
> Kompagnon: `CLAUDE.md` (Onboarding) und `ROADMAP.md` (Meilensteine).

**Stand**: 2026-04-30 · **Branch**: `claude/audit-app-features-QZgDb` · **Version**: `v24.24` (gepusht, head) · **2 Wochen bis Release**

---

## 1 · Aktuell auf dem Branch (gepusht)

| Commit | Version | Fokus |
|---|---|---|
| (next push) | v24.24 | **Sprint 46 — About-Modal-Changelog + Session-Handoff**: About-Modal „Aktuelle Version"-Block + Header-Default (Z. 4640) auf v24.24 aktualisiert, ersetzt veralteten v23.74-Stand · neuer kompakter v24.14–v24.23-Block mit 12 Bullets (statt nur das alte v23.74-Detail) · STATUS.md §5 als Session-Handoff für den nächsten Agenten neu geschrieben (Stand, offene Server-Deploys, sichere/unsichere Bereiche, „Sag dem nächsten Agenten" Block). |
| `31202fb` | v24.23 | **Sprint 45 — Self-Test-Coverage + WhatsNew-Settings-Row**: gsSelfTest TESTS-Array um 6 Sprint-36–44-Module erweitert (gsRunSelfTestModal, gsOpenShareCardForLastScan, gsOpenPushSettings, gsExportUserData, gsEnsurePdfjs, gsWhatsNew) — Pre-Deploy-Check fängt jetzt Regressionen in den neuen Modulen ab. Settings → ✨ „Was ist neu" Row öffnet das WhatsNew-Modal manuell (Highlights wieder anschauen). 2 i18n-Keys × 4 Sprachen. HIGHLIGHTS-Tabelle um v24.22+v24.23 erweitert. |
| `42746bf` | v24.22 | **Sprint 44 — What's-New-Modal**: Returning Users sehen beim ersten Boot mit neuer GS_VERSION ein kompaktes Highlights-Modal mit den Bullet-Points seit `gs_seen_version`. `gsWhatsNew` mit `HIGHLIGHTS`-Tabelle für v24.14–v24.21, `compareDesc` lex-sort, Welcomed-Gate (Erst-User → Welcome-Tour, kein WhatsNew), Idempotent über `gs_seen_version`. Globaler Helper `openWhatsNew()` für „Was ist neu wiederholen". 3 i18n-Keys × 4 Sprachen. |
| `2f16ee6` | v24.21 | **Sprint 43 — Plant-Deep-Link + Marketplace-XSS-Fix + URL-Hygiene**: `?plant=ID` Deep-Link öffnet Detail-Modal direkt — viral-shareable URLs ab jetzt möglich · `gsShareSpecies` erweitert um optionalen `plantId`-Param + Call-Sites updated · `history.replaceState` säubert die URL nach jeder Deep-Link-Konsumierung (screen/plant/shared/fromfile/deeplink raus) · marketplace `l.sellerAvatar` jetzt escaped (B2-Mini-Migration). |
| `2dda5a6` | v24.20 | **Sprint 42 — revDSG-Compliance: Datenexport + sauberer Lösch-Flow**: Recht auf Datenübertragbarkeit (revDSG Art. 8 / DSGVO Art. 20) wird jetzt bedient — `gsExportUserData()` sammelt alle gs_*/ps_*-localStorage-Einträge als JSON und lädt sie als `greenscan-data-YYYY-MM-DD.json` herunter. Sensible Keys (gs_sb_token, gs_claude_key) werden im Export redacted. Settings → 📤 „Meine Daten exportieren" sichtbar für ALLE User (vorher gab es nur Admin-only Import-Row). `profDeleteAccount` jetzt revDSG-konform: bietet Export vor Löschung an, löscht zusätzlich zum Server-Profil auch alle lokalen gs_*/ps_*-Keys, reload danach. 4 i18n-Keys × 4 Sprachen. |
| `00be57e` | v24.19 | **Sprint 41 — Push-UI**: `gsPush` (subscribe/unsubscribe/test) war bisher nur via DevTools-Console aufrufbar — jetzt vollständige Modal-UI über `gsOpenPushSettings()` mit Status-Badge (active/inactive/denied/unsupported), Stunden-Picker (5–22 h, persistent in `gs_push_hour`), Login-Hinweis, Test-Button. Eingebunden ins Menü → 🩺 Diagnose & Hilfe → 🔔 Push-Tipps. 17 i18n-Keys (DE/FR/IT/gsw) für die komplette Push-UX. |
| `9975b6f` | v24.18 | **Sprint 40 — Performance-Pass**: Leaflet jetzt `defer`-geladen (~140 KB JS blockt Initial-Parse nicht mehr) · pdf.js wirklich lazy via `gsEnsurePdfjs()` (~500 KB nur beim ersten Plan-Export geladen, vorher 2× geladen: eager + dynamic-import) · `loading="lazy" decoding="async"` auf 3 Listen-Bilder (Marktplatz-Listings, Scan-History, Hero-Foto) — nur sichtbare Bilder werden geladen. Erwarteter Gewinn: -140 KB blockendes JS auf Home/Scanner/Search/Favs/Menu (5 von 6 Haupt-Tabs), pdf.js nur on-demand. |
| `cd74506` | v24.17 | **Sprint 39 — Discovery & Deep-Links**: Erst-User (0 Scans) bekommen prominente Discovery-Card auf Home für „📋 Bestimmungs-Schlüssel" (Killer-Feature gegen Flora Helvetica) · `gsHandleShortcutUrl` erweitert um 9 Modal-Screens (multikey, vapko, achievements, doctor, brain, health, tour, inat, light) und sauberer Tab-Whitelist (vorher kaputter `navTo`-Call) · manifest.json shortcuts: Lichtmessung + Garten-Planer raus, dafür „Bestimmungs-Schlüssel" + „Pflanzendoktor" rein (long-press auf Home-Icon zeigt jetzt die Power-Features). |
| `57a4a92` | v24.16 | **Sprint 38 — Home-Hook + B2-Hardening**: Home zeigt unter Brain-Tipp ein Achievement-Hint-Card („🏆 12/34 · Nächstes: 🦋 Sammler") mit Click→Modal — psychologischer Sog für Quote-getriebene User · 3 unescaped `err.message`/`e.message`-innerHTML-Stellen (Lichtmesser, Solar-Sensor, Pflanzendoktor-Foto) gehärtet mit `gsHTMLEscape`-Fallback (B2-Mini-Migration). |
| `434f457` | v24.15 | **Sprint 37 — UI-Polish**: i18n-Keys (DE/FR/IT/gsw) für 11 neue Strings (menu.multikey/vapko/achievements/inat/diagnose/health/brain/tour/selftest, scan.shareCard, search.empty.tryKey) · `data-i18n`-Attribute auf neuen Menü-Buttons + Section · Achievement-Counter (X/Y) live im Menü-Button (rendert beim openMainMenu) · Multikriterien-Schlüssel-CTA im leeren Search-Result als prominenter Button · `gsApplyI18n` re-apply beim Menü-Open (Locale-Switch wirkt sofort) |
| `685210f` | v24.14 | **Sprint 36 — UI-Verdrahtung**: 7 unsichtbare Features bekommen Menü-Buttons (Multikriterien-Schlüssel, VAPKO-Pilzkontrollen, Achievements, iNaturalist, Brain-Inspector, Welcome-Tour, Self-Test). Neue Menü-Sektion „🩺 Diagnose & Hilfe". Share-Card-Button im Scan-Result mit Auto-Fill aus letztem Scan + Standort + IUCN-Status. `gsRunSelfTestModal()` als Modal-Wrapper für Self-Test. Größte UX-Lücke der letzten 7 Sprints geschlossen. |
| `4d295d5` | v24.13 | Phase 9: Pre-Launch-Audit-Subagent + 5 Sicherheits-Fixes (1 CRITICAL daily-push-Auth · 3 HIGH CORS-Origins/encodeURIComponent · 1 MED stripe-uuid · LOW SW-Version-Bump) · 10 zusätzliche Achievements (34 total) · 50 zusätzliche IUCN-Arten (130 total) |
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

- ✅ **About-Modal-Changelog modernisiert** (v24.24): „Aktuelle
  Version"-Block + Header-Default zeigen jetzt v24.24 statt v23.65/
  v23.74. Kompakter v24.14–v24.23-Block mit 12 Bullets vor dem alten
  v23.74-Detail-Block — User in About sehen tatsächlich was passiert
  ist seit dem letzten echten Update.
- ✅ **Self-Test-Coverage erweitert** (v24.23): `gsSelfTest`-Array
  enthält jetzt 39 Module-Checks (vorher 33), inkl. der 6 neuen
  Sprint-36–44-Helfer. Damit wird `gsRunSelfTestModal()` als Pre-
  Deploy-Smoke-Test wieder zuverlässig — eine Regression in einem
  der neuen Module fällt sofort als ❌ auf.
- ✅ **WhatsNew Settings-Row** (v24.23): in den Settings öffnet die
  ✨-Row jetzt das WhatsNew-Modal manuell, damit User die Highlights
  jederzeit nachlesen können (vorher: nur einmaliger Auto-Trigger
  beim Boot). HIGHLIGHTS-Tabelle um v24.22 + v24.23 erweitert.
- ✅ **What's-New-Modal** (v24.22): kompaktes „Was ist neu?"-Modal
  beim Boot, sobald `localStorage.gs_seen_version !== GS_VERSION`.
  Liest aus `HIGHLIGHTS`-Tabelle (in-Code, eine Zeile pro Version)
  und filtert mit `changesSince(prev)` lex-sortiert. Welcomed-Gate:
  Erst-User (`gs_welcomed_v24 !== '1'`) bekommen weiterhin nur die
  Welcome-Tour, kein WhatsNew. Defensive Modal-Stack-Heuristik
  (3 s Delay, retry nach 4.5 s wenn anderes Modal offen). Brain-
  Observe `whatsnew_open`. Globaler Helper `openWhatsNew()` für
  „nochmal anschauen".
- ✅ **Plant-Deep-Link + URL-Hygiene** (v24.21): `?plant=ID` öffnet
  Detail-Modal direkt, validiert ID gegen `/^[A-Za-z0-9_-]{1,20}$/`
  und prüft DB-Hit vor Öffnen — defensiver Schutz gegen Müll-Params.
  `gsShareSpecies` baut `?plant=ID`-URLs wenn ID übergeben — viral-
  shareable Links ab jetzt möglich. Brain-Observe `deeplink_plant`.
  `history.replaceState` säubert URL nach Konsum (`screen/plant/shared/
  fromfile/deeplink` raus) — bessere Share-UX, Reload bleibt sauber.
- ✅ **B2-Mini-Migration Marketplace** (v24.21): `l.sellerAvatar` im
  Listing-Detail jetzt durch `escHtml` — verhindert XSS via
  user-controlled Avatar-Strings.
- ✅ **revDSG-Datenexport + sauberer Lösch-Flow** (v24.20): Recht auf
  Datenübertragbarkeit (revDSG Art. 8 / DSGVO Art. 20) implementiert.
  - `gsExportUserData()` sammelt alle `gs_*`/`ps_*`-localStorage-Keys
    als strukturierten JSON-Blob (parst JSON-Werte automatisch),
    redacted Auth-Token und API-Keys, fügt App-Version + UID +
    Server-Daten-Hinweis (info@greenscan.ch für Auskunfts-Antrag) bei,
    triggert Download als `greenscan-data-YYYY-MM-DD.json`.
  - **Settings → 📤 „Meine Daten exportieren"** sichtbar für ALLE User
    (vorher: nur Admin-only Import-Row).
  - **`profDeleteAccount`** jetzt vollständig: bietet Export vor
    Löschung an, löscht Profil-Row (RLS), führt Logout durch und
    löscht zusätzlich alle lokalen `gs_*`/`ps_*`-Keys → wirklich
    blanker Zustand. Reload danach.
- ✅ **gsPush-Settings-UI** (v24.19): vorher achtes unsichtbares
  Power-Feature (alle 5 Methoden — `isSupported/status/subscribe/
  unsubscribe/test` — nur via DevTools-Console). Jetzt:
  `gsOpenPushSettings()` Modal mit Live-Status-Badge,
  Stunden-Picker (persistent in `gs_push_hour`),
  Login-Hinweis wenn nicht angemeldet, defensiver Error-Pfad mit
  Server-Setup-Hinweis (VAPID-Public-Key fehlt → klare Botschaft).
  Eingebunden ins Menü → 🩺 Diagnose & Hilfe → 🔔 Push-Tipps. 17 i18n-
  Keys in DE/FR/IT/gsw.
- ✅ **Performance-Pass** (v24.18): drei konkrete Wins für Initial-Load:
  - **Leaflet defer-loaded** (`<script defer>` statt sync) — ~140 KB JS
    blockt Initial-Parse nicht mehr. Sicher, weil alle `L.`-Calls in
    on-demand-Functions stehen (initMap/gsVapko.layer/Garden-Map).
    Boot berührt L nicht.
  - **pdf.js wirklich lazy** via `window.gsEnsurePdfjs()` Promise.
    Vorher: 2× geladen (eager `<script src>` + dynamic `import()`).
    Jetzt: nur beim ersten Plan-Export oder Buch-Ingest. ~500 KB
    Default-Save für 99 % der User.
  - **`loading="lazy" decoding="async"`** auf 3 Listen-Bilder
    (Marktplatz-Listing-Cover, Scan-History-Thumbs in Hero,
    Marktplatz-Hero) — nur sichtbare Bilder werden geladen.
- ✅ **Discovery-Card für Erst-User** (v24.17): User mit 0 Scans sehen
  prominent grünen Button „📋 Bestimmungs-Schlüssel" direkt unter dem
  Tages-Fact auf Home. Surfact das Killer-Feature genau dann, wenn der
  User noch nicht scannen kann/will. Auto-removed nach erstem Scan.
- ✅ **Deep-Link-Handler erweitert** (v24.17): `?screen=` unterstützt
  jetzt 9 Modal-Screens (multikey/vapko/achievements/doctor/brain/health/
  tour/inat/light) zusätzlich zu 15 Tab-Screens. Vorher rief der Handler
  ein nicht-existentes `navTo` auf (silent no-op). Jetzt:
  Tab-Whitelist + Modal-Handlers + showScreen-Fallback.
- ✅ **manifest.json shortcuts überarbeitet** (v24.17): Lichtmessung +
  Garten-Planer raus (kleiner Hebel), dafür „Bestimmungs-Schlüssel" +
  „Pflanzendoktor" rein. Long-press auf das Home-Icon zeigt User direkt
  die wichtigsten Power-Features.
- ✅ **Home-Achievement-Hint** (v24.16): nach Brain-Tipp + Insights-Box
  rendert `initHomeBoard` einen Hint-Card-Button: „🏆 X/Y freigeschaltet
  · Nächstes: <Icon> <Name>". Sichtbar nur wenn ≥1 Badge unlocked UND
  ≥1 noch offen. Click öffnet Achievements-Modal. Idempotent (re-render
  beim Home-Re-Open ohne Duplikate).
- ✅ **B2-Mini-Migration** (v24.16): 3 unescaped `err.message`/
  `e.message` innerHTML-Pfade gehärtet — Lichtmesser-Status (Z. 23021),
  Solar-Sensor-Messung (Z. 35701), Pflanzendoktor-Foto-Upload-Fehler
  (Z. 43365). Alle nutzen jetzt `gsHTMLEscape`-Fallback. Defensiver
  Schutz gegen Server-/Browser-Error-Messages mit eingebettetem HTML.
- ✅ **UI-Polish-Sprint** (v24.15): i18n-Keys (DE/FR/IT/gsw) für alle
  neuen Buttons + `data-i18n`-Attribute. Achievement-Counter „X/Y" rendert
  live im Menü-Button beim Öffnen. Empty-State der Plant-Suche bekommt
  prominenten CTA „📋 Bestimmungs-Schlüssel" mit i18n-Hinweis. Locale-
  Switch wirkt sofort auch im Menü (`gsApplyI18n` re-apply in
  `openMainMenu`).
- ✅ **UI-Verdrahtung der Power-Features** (v24.14): 10 neue Buttons im
  Hauptmenü und Scan-Result. Vorher nur via DevTools-Console erreichbar:
  `openMultiKey` (Wissen → 📋 Bestimmungs-Schlüssel), `openVapko`
  (Wissen → 🍄 Pilzkontrolle VAPKO), `openAchievements` (Next-Level →
  🏆 Auszeichnungen), `openInat` (Community → 🌍 iNaturalist),
  `gsHealthCheck(true)` / `gsBrainDebug(true)` / `openWelcomeTour` /
  `gsRunSelfTestModal` (neue Sektion „🩺 Diagnose & Hilfe"),
  `gsOpenShareCardForLastScan` (Scan-Result → 🎴 Teilbare Karte
  erstellen, auto-fill aus `_lastScanResult` + `gs_user_location` +
  `gsRedList`).
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
  (deren Kern-USP). **Ab v24.14** im Menü → Wissen → „📋 Bestimmungs-Schlüssel".
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

## 5 · In Progress / Session-Handoff

> Aktueller Zustand für den nächsten AI-Agenten — **lies das zuerst**.

**Branch**: `claude/audit-app-features-QZgDb` · **HEAD**: v24.24 ·
**Letzte Session**: 11 Sprints (36–46) auf v24.13 → v24.24 in einem
Lauf, alle gepusht. Kein PR offen. PR #1 (von CXtrI nach main) wartet
weiterhin auf Owner-Merge — siehe `RELEASE.md`.

### Zusammenfassung letzte Session (Sprints 36–46)

| Sprint | Version | Commit | Wirkung |
|---|---|---|---|
| 36 | v24.14 | `685210f` | UI-Verdrahtung 7 Power-Features (Multikriterien · VAPKO · Achievements · iNat · Brain-Inspector · Welcome-Tour · Self-Test) als Menü-Buttons + Share-Card im Scan-Result |
| 37 | v24.15 | `434f457` | i18n DE/FR/IT/gsw für 11 Strings · Achievement-Counter X/Y im Menü · Multikriterien-CTA in Empty-Search-State |
| 38 | v24.16 | `57a4a92` | Home-Achievement-Hint (psychologischer Sog) · 3 unescaped err.message-innerHTML gehärtet (B2-Mini) |
| 39 | v24.17 | `cd74506` | Discovery-Card auf Home für 0-Scan-User · gsHandleShortcutUrl Bugfix (war kaputt: navTo existiert nicht) · manifest shortcuts auf Killer-Features |
| 40 | v24.18 | `9975b6f` | Performance: Leaflet defer (−140 KB blockend) · pdf.js wirklich lazy via gsEnsurePdfjs (−500 KB Default-Save, vorher 2× geladen) · loading=lazy auf Listen-Bildern |
| 41 | v24.19 | `00be57e` | Push-UI: gsPush.subscribe/unsubscribe/test als Modal (8. Power-Feature verdrahtet) — 17 i18n-Keys × 4 Sprachen |
| 42 | v24.20 | `2dda5a6` | revDSG-Datenexport: gsExportUserData (sensible Keys redacted) · profDeleteAccount mit Export-Angebot + lokaler Bereinigung |
| 43 | v24.21 | `2f16ee6` | Plant-Deep-Link `?plant=ID` öffnet Detail-Modal · gsShareSpecies baut shareable URLs · history.replaceState säubert URL · seller-avatar escaped |
| 44 | v24.22 | `42746bf` | What's-New-Modal: gsWhatsNew zeigt returning Usern Highlights seit gs_seen_version (Welcomed-Gate, Stack-Heuristik) |
| 45 | v24.23 | `31202fb` | gsSelfTest auf 39 Module-Checks erweitert (von 33) · Settings → ✨ Was-ist-neu-wiederholen-Row |
| 46 | v24.24 | (this) | About-Modal-Changelog modernisiert (war auf v23.74 stehen geblieben) · diese §5-Handoff-Notiz |

### Was offen ist (Owner-Tasks, nicht Code)

- **PR #1** in `main` mergen (CXtrI → main) — siehe RELEASE.md Phase 1
- **Server-Stack deployen**: 4 Migrations + 5 Edge Fns (ai-proxy,
  entitlements, push-test, daily-push, stripe-webhook) — siehe DEPLOY.md
- **VAPID-Keys + pg_cron** für daily-push — RELEASE.md Phase 2+3
- **iNaturalist-Client-ID** registrieren — RELEASE.md Phase 4
- **Stripe-Webhook-Setup** + Test-Mode-Smoke — RELEASE.md Phase 4+8
- **NVIDIA-API-Key rotieren** (war in Git-History gleakt pre-v23.86)
- **OG-Image 1200×630** + manifest screenshots — RELEASE.md Phase 6

### Was du als nächster Agent sinnvoll angehen könntest

1. **B2-Migration weiter**: noch ~290 innerHTML-Stellen ohne
   gsSafeHTML, Helper steht seit v24.02. Ziel: hot-spots in Marketplace,
   Community-Posts, Profile-Bio. Siehe Bug B2.
2. **Saisonkalender-Tile** auf Home (analog Discovery-Card v24.17 für
   0-Scan-User, aber für saisonal-aktive User: „Hat jetzt Saison")
3. **SW-Update-Banner mit Versions-Anzeige** — derzeit generisch.
   `reg.waiting.postMessage({type:'GET_VERSION'})` + MessageChannel
   liefert die neue CACHE_VERSION (sw.js Z. 250 unterstützt das).
4. **Quick-Add-To-Garden vom Scan-Result** — Friction-Reducer
5. **B1 (HIGH): JWT in HttpOnly-Cookies** — das größte offene Sec-Item,
   braucht Server-Migration mit User-Logout-Flow, also nicht ohne
   Owner-Approval starten

### Sicher zu editieren

- Index.html-Bereiche **außerhalb** der File-Locks unten
- CSS-Inline-Styles auf neuen Buttons (CSP erlaubt)
- i18n-Bundles (4 Sprachen, klare Struktur Z. ~16007 ff.)
- gsSelfTest-TESTS-Array (Z. ~18950) bei jedem neuen Modul ergänzen
- HIGHLIGHTS-Tabelle in gsWhatsNew bei jedem Sprint-Push aktualisieren

### NICHT editieren ohne Plan (Race-Risiken)

Siehe §6 unten — File Locks gelten weiterhin.

### Pre-Deploy-Smoke-Test

In DevTools-Console auf Branch-Preview:
```js
await gsSelfTest()           // muss 39 ✅ liefern
await gsHealthCheck(true)    // muss min. 4 ✅ haben
gsBrainDebug(true)           // Modal mit Kontext muss erscheinen
openMultiKey(); openVapko(); openAchievements();   // alle 3 öffnen
```

Wenn ein Test rot ist: **vor Deploy fixen**, nicht ignorieren.

---

## 6 · File Locks (für Multi-Agent-Workflow)

Bereiche, die nicht gleichzeitig editiert werden sollten:

| Bereich | Zeilenrange (index.html) | Owner |
|---|---|---|
| API-Helpers (callAI/callVisionAI/sbFetch) | 18321–18450, 39346–39410 | Stable |
| gsBrain-Modul | 18495–18820 | Stable |
| gsAchievements-Modul | 17750–18120 | Stable (v24.13: 34 Badges) |
| gsWhatsNew-Modul + HIGHLIGHTS | ~18900 ff. | Pflichtfeld bei Versions-Bump |
| PLANT_DB (4342 Arten) | extern in `data/plants.v1.js` | Read-Only ohne Migrations-Plan |
| Init-Sequenz | 40330–42410 | Vorsicht — Race-Risiko |
| gsHandleShortcutUrl | ~41373 ff. | Bei Deep-Link-Erweiterung MODAL_HANDLERS-Map updaten |

---

## 7 · Schweizer Compliance-Status

- ✅ **revDSG**: Datenschutz-Erklärung verlinkt, EDÖB-Verweis, Opt-In
  Analytics, **Datenexport (Art. 8)** ab v24.20 in Settings, **Konto-
  Löschung mit lokaler + serverseitiger Bereinigung** ab v24.20
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

1. Lies §5 oben — die Session-Handoff-Liste hat 5 konkrete Vorschläge.
2. Lies `ROADMAP.md` — dort sind Meilensteine priorisiert (S26+ ist
   offen, alle bisherigen Sprints sind dokumentiert).
3. Wenn keiner passt: arbeite an P0/P1 aus Tabelle in §4.
4. Wenn du auf einen Bug stößt: trag ihn in §4 ein, nicht „silent fix".

## 10 · Konventionen für jeden neuen Sprint

1. Code editieren (eine Sache nach der anderen, kein Refactor-Mix)
2. **Versions-Sync** in 5 Files: `index.html` (GS_VERSION + meta
   app-version), `sw.js` (Header-Comment + CACHE_VERSION),
   `install.html`, `_redirects`, `robots.txt`
3. Wenn **Module-API neu** → in `gsSelfTest`-TESTS ergänzen
4. Wenn **i18n-relevant** → 4 Sprachen (DE/FR/IT/gsw) parallel
5. **HIGHLIGHTS-Tabelle** in gsWhatsNew updaten (1 Bullet pro Version)
6. **STATUS.md §1 + §2** ergänzen, **ROADMAP.md** mit S-Eintrag
7. Sanity-Check: `node --check sw.js` + JSON.parse(manifest)
8. Commit-Message: `vXX.YY: <kurze Aussage>` + Bullet-Body
9. Push auf Feature-Branch — kein direkter main-Push
