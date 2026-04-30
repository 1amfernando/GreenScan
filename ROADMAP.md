# ROADMAP.md — Meilensteine zur „besten Schweizer Naturbestimmungs-App"

> **Priorisierung**: P0 = blockiert Release · P1 = große Wirkung kurzfristig
> · P2 = Wettbewerbsvorteil mittelfristig · P3 = nice to have.
> Aktualisierung bei jedem abgeschlossenen Meilenstein.
> Kompagnon: `STATUS.md` (operativ) und `CLAUDE.md` (Onboarding).

---

## ✅ Shipped (auf Branch `claude/audit-app-features-CXtrI`)

| # | Meilenstein | Commit | Wirkung |
|---|---|---|---|
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
| S12 | **Sprint 6: Health-Check** | (next push) v23.94 | `gsHealthCheck()` mit 9 Checks (Online/SW/Storage/KI/Auth/Quota/Brain/GPS/Cam) + Modal-UI mit Ampelsystem |

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
| P1-3 | **i18n FR + IT** (CH-Amtssprachen) | Verdoppelt potenziellen Markt; FlorApp und Flora Helvetica beherrschen DE/FR/IT. JSON-basierter `t(key)`-Layer, `<html lang>` dynamisch. | 3–5 Tage |
| P1-4 | **Multikriterien-Bestimmungs-Schlüssel** (Blattform / Blütenfarbe / Habitat / Höhe) | Killer-Feature gegen Flora Helvetica. Daten sind in `PLANT_DB` schon da — fehlt nur UI. | 2–3 Tage |
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
| P3-3 | **Push-Smart-Notifications** | „Heute Vollmond + dein Garten hat Karotten → idealer Tag zum Wurzelschneiden." Über Brain.recommend(). |
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
