# ROADMAP.md — Meilensteine zur „besten Schweizer Naturbestimmungs-App"

> **Priorisierung**: P0 = blockiert Release · P1 = große Wirkung kurzfristig
> · P2 = Wettbewerbsvorteil mittelfristig · P3 = nice to have.
> Aktualisierung bei jedem abgeschlossenen Meilenstein.
> Kompagnon: `STATUS.md` (operativ) und `CLAUDE.md` (Onboarding).

---

## ✅ Shipped (auf Branch `claude/audit-app-features-QZgDb`)

| # | Meilenstein | Commit | Wirkung |
|---|---|---|---|
| S26 | **Sprint 46: About-Modal-Changelog + Session-Handoff** | (next push) v24.24 | About-Modal „Aktuelle Version" + Header-Default auf v24.24 (war v23.65/v23.74) · kompakter v24.14–v24.23-Block mit 12 Bullets · STATUS.md §5 als Session-Handoff für nächsten Agenten neu geschrieben (Tabelle aller 11 Sprints, offene Owner-Tasks, sichere/risiko-Bereiche, Konventionen für neue Sprints) |
| S25 | **Sprint 45: Self-Test-Coverage + WhatsNew-Settings-Row** | `31202fb` v24.23 | gsSelfTest um 6 neue Module erweitert (39 Checks total) · Settings-Row für „Was ist neu wiederholen" (manueller WhatsNew-Trigger) · HIGHLIGHTS um v24.22+v24.23 |
| S24 | **Sprint 44: What's-New-Modal** | `42746bf` v24.22 | gsWhatsNew zeigt returning Usern Highlights seit gs_seen_version (HIGHLIGHTS-Tabelle, lex-sort, Welcomed-Gate, Stack-Heuristik) — i18n in 4 Sprachen |
| S23 | **Sprint 43: Plant-Deep-Link + URL-Hygiene + Marketplace-XSS-Fix** | `2f16ee6` v24.21 | ?plant=ID öffnet Detail-Modal direkt (viral-shareable URLs) · gsShareSpecies baut Deep-Links · history.replaceState säubert URL · seller-avatar escaped |
| S22 | **Sprint 42: revDSG-Datenexport + sauberer Lösch-Flow** | `2dda5a6` v24.20 | Recht auf Datenübertragbarkeit (Art. 8 revDSG / Art. 20 GDPR) — gsExportUserData liefert JSON-Backup, sensible Keys redacted · Settings-Row für alle User · profDeleteAccount mit Export-Angebot + lokale Bereinigung |
| S21 | **Sprint 41: Push-UI** | `00be57e` v24.19 | gsPush vollständig im Menü erreichbar (Modal mit Status/Hour-Picker/Test) — 8. unsichtbares Power-Feature verdrahtet, 17 i18n-Keys DE/FR/IT/gsw |
| S20 | **Sprint 40: Performance-Pass** | `9975b6f` v24.18 | Leaflet defer-loaded (-140 KB blockend) · pdf.js lazy via gsEnsurePdfjs (-500 KB Default-Save, vorher 2× geladen) · loading=lazy auf 3 Listen-Bilder |
| S19 | **Sprint 39: Discovery & Deep-Links** | `cd74506` v24.17 | Discovery-Card auf Home für 0-Scan-User · gsHandleShortcutUrl erweitert um 9 Modal-Screens (vorher kaputter navTo-Call) · manifest shortcuts auf killer-Features umgestellt |
| S18 | **Sprint 38: Home-Hook + B2-Hardening** | `57a4a92` v24.16 | Home-Achievement-Hint-Card (X/Y + Nächstes-Badge mit Click→Modal) als psychologischer Sog · 3 unescaped err.message-innerHTML-Stellen mit gsHTMLEscape-Fallback gehärtet |
| S17 | **Sprint 37: UI-Polish** | `434f457` v24.15 | i18n DE/FR/IT/gsw für 11 neue Strings · `data-i18n` auf neuen Buttons + Section · Achievement-Counter „X/Y" live im Menü · Multikriterien-CTA im Empty-State der Plant-Suche · Locale-Switch wirkt sofort im Menü |
| S16 | **Sprint 36: UI-Verdrahtung** | `685210f` v24.14 | 7 unsichtbare Power-Features bekommen Menü-Buttons (Multikriterien, VAPKO, Achievements, iNat, Brain-Inspector, Welcome-Tour, Self-Test) + Share-Card-Button im Scan-Result. Größte UX-Lücke der letzten 7 Sprints geschlossen. |
| S1 | Sicherheits-Audit + CSP | `d5b9d55` | Hardcoded NVIDIA-Key raus, vollständige Allowlist-CSP |
| S2 | NVIDIA komplett entfernt | `a5651f4` | Code halbiert auf API-Layer; Claude-only-UX |
| S3 | App-Store-Polish | `1bde9ec` | iOS-Meta, a11y, SW-Update-Banner, sbFetch-Retry |
| S4 | gsBrain — Kontext-Hub | `cd90f34` | Alle KI-Calls sehen automatisch User-Kontext |
| S5 | Doku-Sync für Multi-Agent | `39249e9` | CLAUDE.md / STATUS.md / ROADMAP.md |
| S6 | **P1-6 Share-Target-Receiver** | `ba743df` v23.89 | Foto teilen aus anderer App → Scanner liest aus + analysiert. Plus File-Handler |
| S7 | **P1-5 Storage-Auto-Rotation** | `ba743df` v23.89 | Quota-Error löst Auto-Trim aus, App crasht nie wegen vollem Speicher (Bug B3 erledigt) |
| S8 | **P1-1 Anthropic Edge-Function-Proxy** (Code) | `c69c5b7` v23.90 | User braucht keinen eigenen Claude-Key mehr. Tier-Quota (5/200/2000), Modell-Whitelist, Telemetrie. **Server-Deploy durch Owner ausstehend** |
| S9 | **P1-2 Brain-Memory Cloud-Sync** | `16de706` v23.91 | gsBrain.observe pusht zu Supabase brain_memory. Login → pullCloud merged. Schleimpilz lebt geräteübergreifend. **Migration-Deploy ausstehend** |
| S10 | **P1-7 Stripe-Entitlement server-seitig** | `9d85f4a` v23.92 | Edge Fn `entitlements` liefert `can_scan` authoritativ. Client-Counter ist nur noch UX-Hint. Bug B4 erledigt. **Edge-Fn-Deploy ausstehend** |
| S11 | **Sprint 5: Brain v2** | `22cf57d` v23.93 | recommend() mit Frost-Awareness + Memory-basierter Quiz-Schwäche; weekly_summary; Smart-Insights auf Home; gsBrainDebug() Inspector |
| S12 | **Sprint 6: Health-Check** | `424c2ff` v23.94 | `gsHealthCheck()` mit 9 Checks + Modal-UI mit Ampelsystem |
| S13 | **Sprint 7 (B): Multikriterien-Schlüssel** | `4559bee` v23.95 | `gsKey` Filter-Engine + Modal mit 9 Kriterien. Killer-Feature gegen Flora Helvetica |
| S14 | **Sprint 8 (C): Smart-Push-Notifications** | `be8d202` v23.96 | `gsPush` Client + push-test/daily-push Edge Fns. Tägliche personalisierte Tipps aus brain_memory. **VAPID-Keys + Cron-Setup durch Owner pending** |
| S15 | **Sprint 9 (A): i18n FR/IT-Infrastruktur** | (next push) v23.97 | `gsI18n` Modul mit DE/FR/IT-Bundles (~70 Strings + 14 Pflanzen-Namen), Locale-Detect, dynamisches html-lang, hreflang. Strings-Migration iterativ |

---

## 🔥 P0 — Release-Blocker (vor Merge in `main`)

| # | Meilenstein | Aufwand | Status |
|---|---|---|---|
| P0-1 | **Browser-Smoke-Test durch User**: Erstinstall, Scanner ohne Key, Scanner mit Key, Pflanzendoktor, Garten-Plan, Quiz. Nicht skippbar. | 1–2h | offen |
| P0-2 | **NVIDIA-API-Key in Anthropic/NVIDIA-Dashboard rotieren** (war in Git-History gleakt) | 5min | offen |
| P0-3 | **Cloudflare Pages re-deploy** mit neuem `_headers` (CSP greift erst am Edge) | sofort | offen |
| P0-4 | **Supabase RLS-Policies verifizieren** für `social_posts`, `user_gardens`, `sensor_readings`, `user_preferences` | 1h | offen |

---

## 🚀 P1 — Sofort-Hebel mit großer Wirkung (nächste 1–2 Sprints)

| # | Meilenstein | Wirkung | Aufwand |
|---|---|---|---|
| ~~P1-1~~ | ~~Anthropic Edge-Function-Proxy~~ | **Code erledigt v23.90** — Server-Deploy durch Owner pending (siehe `supabase/functions/ai-proxy/README.md`) | — |
| ~~P1-2~~ | ~~Brain-Memory in Supabase syncen~~ | **Code erledigt v23.91** — Migration-Deploy durch Owner pending | — |
| ~~P1-3~~ | ~~i18n FR + IT~~ | **Infrastruktur erledigt v23.97** (`gsI18n`+ Bundles). String-Konvertierung im Code iterativ (eigene Mini-Sprints) | — |
| ~~P1-4~~ | ~~Multikriterien-Bestimmungs-Schlüssel~~ | **erledigt v23.95** (`gsKey` + Modal-UI) — UI-Einbindung in Tab-Buttons als Folge-Sprint | — |
| ~~P1-5~~ | ~~Storage-Layer mit Rotations-Strategie~~ | **erledigt v23.89** (Auto-Rotation + `gsStoragePush`/`gsStorageInfo`) | — |
| ~~P1-6~~ | ~~Share-Target-Receiver im Scanner~~ | **erledigt v23.89** (SW-Postmessage + File Handling API) | — |
| ~~P1-7~~ | ~~Stripe-Entitlement server-seitig~~ | **Code erledigt v23.92** — Edge-Fn-Deploy durch Owner pending | — |
| P1-8 | **PLANT_DB-Split** (4.5 MB raus aus index.html) | Initial-JS halbiert sich. DB als `data/plants.v1.json` mit Cache-Control immutable. Hydration via IndexedDB. | 1 Tag |

---

## 🎯 P2 — Wettbewerbsvorteil (Next Quarter)

| # | Meilenstein | Wirkung |
|---|---|---|
| P2-1 | **iNaturalist-OAuth-Bridge** | „Auch auf iNat veröffentlichen" Button. iNat hat 630k CH-Sichtungen — der Brückenkopf zur Wissenschafts-Community. |
| P2-2 | **VAPKO-Pilzkontrollstellen-Layer auf Karte** | „Du hast Steinpilz gescannt → 3 km zu Pilzkontrolle in Aarau, geöffnet Sa 17–19h." Killer-USP. |
| P2-3 | **MeteoSwiss OGD-Integration** | Echte Schweizer Wetterdaten statt Open-Meteo. Frost-Warnung Push, Niederschlags-Radar. |
| P2-4 | **JWT in HttpOnly-Cookies** (Bug B1) | Eliminiert XSS-Token-Hijack komplett. Braucht Migration mit User-Logout-Flow. |
| P2-5 | **Schutzstatus + Rote Liste** in DB integrieren | BAFU-Liste der nationalen Prioritäten. UI-Icon pro Art. |
| P2-6 | **Spaced-Repetition für Quiz** | SM-2-Algorithmus lokal. Fokus auf Schwächen aus `gsBrain.recommend('quiz_focus')`. |
| P2-7 | **Echte Tests** (Vitest + Playwright Smoke-Suite) | Endlich automatische Regression. Mindest-Pfade: Scan-Flow, Garten-Plan, Stripe-Webhook, Offline-Boot. |
| P2-8 | **innerHTML → safeHTML-Migration** (Bug B2) | Tagged Template `safeHTML\`...\``, ersetzt 299 Hotspots. |

---

## 🌟 P3 — Differenzierende Innovationen (Strategisch)

| # | Meilenstein | Wirkung |
|---|---|---|
| P3-1 | **BirdNET-Audio-Bestimmung** (TFLite client-side) | Differenziert von ALLEN Pflanzen-Apps. Vögel über Mikrofon erkennen, lokal, offline-fähig. |
| P3-2 | **Schweizerdeutsch-Modus** (UI-Toggle) | Spielerei mit viralem Potenzial („Hesch s'Bärlauch gfunde?"). |
| ~~P3-3~~ | ~~Push-Smart-Notifications~~ | **erledigt v23.96** — Code + Edge Fns committed; VAPID + Cron-Setup durch Owner pending |
| ~~P3-4~~ | ~~GPX-Import/Export~~ | **erledigt v23.99** (Export war v23.84, Import in v23.99 ergänzt) |
| ~~P3-5~~ | ~~Print-/PDF-Export~~ | **erledigt v23.99** (globales `@media print`, gilt für alle Modals) |
| ~~P2-2~~ | ~~VAPKO-Pilzkontrollstellen-Layer~~ | **erledigt v24.00** (`gsVapko` mit ~50 Stationen, Karten-LayerGroup, Modal) |
| ~~P2-3~~ | ~~MeteoSwiss OGD-Integration~~ | **erledigt v24.00** (`gsMeteo` leitet aus open-meteo Schweizer Warnungen ab + verlinkt offizielle MeteoSwiss-Seite) |
| ~~P2-5~~ | ~~Schutzstatus + Rote Liste~~ | **erledigt v24.00** (`gsRedList` mit ~80 Arten IUCN Schweiz) |
| ~~P2-6~~ | ~~Spaced-Repetition für Quiz~~ | **erledigt v24.01** (`gsSRS` SM-2 + Auto-Bridge zu Brain-Events) |
| ~~P2-8~~ | ~~innerHTML → safeHTML-Migration~~ | **Helper erledigt v24.02** (`gsSafeHTML` Tagged-Template + CLAUDE.md-Pattern); Code-Migration iterativ in Folge-Sprints |
| ~~P1-8~~ | ~~PLANT_DB-Split~~ | **erledigt v24.03** (`data/plants.v1.js`, -2.16 MB Initial-Size, immutable-cached) |
| ~~P2-1~~ | ~~iNaturalist-OAuth-Bridge~~ | **erledigt v24.04** (`gsINaturalist` mit PKCE-Flow + publishObservation; Client-ID-Setup durch Owner pending) |
| ~~P3-8~~ | ~~Brain-Recommend in der Cloud~~ | **erledigt v24.05** (`gsBrain.smartRecommend` mit 6h-Cache + Hintergrund-Hydration; min. 30 Events nötig) |
| ~~P3-2~~ | ~~Schweizerdeutsch-Modus~~ | **erledigt v24.06** (Locale `gsw`, 70 Strings, hreflang) |
| P3-4 | **GPX-Import/Export** für Karten-Tracks | Pilzsammler:innen wollen Touren speichern + teilen. |
| P3-5 | **Print-/PDF-Export** des Garten-Plans | Bestehende `pdf.js`-Lib ausreizen. |
| P3-6 | **AR-Pflanzenmarkierung** (WebXR/AR.js) | Pflanze in der Realität markieren mit Kamera-Overlay. |
| P3-7 | **Modulares Build-System** (Vite + ESM-Splitting) | Fundament für alle weiteren Optimierungen. Initial-JS auf ≤80 KB. |
| P3-8 | **Brain-Recommend in der Cloud** (LLM-basiert) | Wenn Brain.memory > 50 Events → personalisierte Empfehlung über Claude statt Heuristik. |
| P3-9 | **Community-Identifikation** | User postet Foto → andere bestätigen. Wie iNat, aber Schweiz-fokussiert. |
| P3-10 | **App-Store-Wrapper** (PWABuilder / Capacitor) | Echte Präsenz im Apple App Store + Google Play. PWA bleibt Tier 1, Wrapper als Sichtbarkeit. |

---

## 📊 Definition of „beste App der Schweiz"

Eine App in dieser Kategorie ist „die beste", wenn sie **alle 5 Kriterien** erfüllt:

1. **Vollständigkeit**: ≥ 4'000 Schweizer Arten in DE/FR/IT, mit
   Schutzstatus + Verbreitungs-Höhe + Verwechslungs-Hinweis
2. **Bestimmungs-Tiefe**: Foto-Scan + Multikriterien-Schlüssel + dichotomer
   Schlüssel (für Profis)
3. **Lokal-Authentizität**: swisstopo-Karte, VAPKO-Stellen, MeteoSwiss,
   kantonale Schutzlisten, Tox Info Suisse 145 prominent
4. **Lern-Intelligenz**: Personalisiert nach Standort, Saison, Vorkenntnis;
   Quiz adaptiv; KI-Scanner kontextbewusst (siehe gsBrain v23.87)
5. **Vertrauen**: revDSG-konform, Schweizer Hosting (Edge in Frankfurt OK),
   transparente AGB, keine Tracker ohne Consent

**Aktueller Stand**: Punkt 1 (~85%, FR/IT fehlt), Punkt 2 (50%, nur Scan +
Suche), Punkt 3 (70%, MeteoSwiss + Kantonale fehlen), Punkt 4 (80%, gsBrain
da, adaptives Quiz fehlt), Punkt 5 (95%, sehr stark).

**Mit P1 abgeschlossen** rücken wir auf alle 5 Kriterien auf > 90%.

---

## 🔄 Update-Konvention

Wer einen Meilenstein abschließt:
1. In dieser Datei: Eintrag aus „P0/P1/..." → Tabelle „✅ Shipped" verschieben.
2. Commit-Hash daneben schreiben.
3. `STATUS.md` §1 aktualisieren.
4. Bei Major-Bumps (z.B. P1-3 fertig) → User-facing Changelog im
   About-Modal (`index.html` Z. 4615+) ergänzen.
