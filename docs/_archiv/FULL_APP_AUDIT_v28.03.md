# FULL APP AUDIT v28.03 — 8 Bereiche (Backend + Frontend)

> Erstellt 03.06.2026 (Phase A). Backend-Status über alle Bereiche per DB-Cross-Check verifiziert (alle Tabellen/Views/RPCs/Crons vorhanden). Frontend-Status aus Build-Wissen v26.88–v28.02 + gezielter Verifikation. Findings P0/P1/P2-sortiert. Quick-Fixes = v28.03 (≤30 Min/Item), Tieferes = v28.07+ deferred.

**Backend-Gesamtbild:** ✅ grün. 23 Bereichs-Tabellen, 3 Views (v_marketplace_listings/v_marketplace_conversations/v_knowledge_search), 10+ Kern-RPCs, 5 Crons (weather-alert-3h, quiz-battles-expire, species-maintenance-daily, daily-push-morning/evening) — alle LIVE. RLS-Pattern durchgängig `(SELECT auth.uid())` (Hard-Lesson #6). DEFINER-RPCs anon-revoked (#13).

---

## Bereich 1 — 🏪 Marktplatz
**A) Frontend:** `renderMarket` (Z.16758) ✓ · `saveListing` (Z.17278, v28.02-token-fix via `_gsFreshToken` ✓) · `gsMarketServerSearch` (FTS ab 3 Zeichen) · Status-Segment-Control (gsMktSetStatus) · Multi-Photo bis 5 + ★Haupt. Empty-State vorhanden. Save-Feedback ✓ (Toast). Demo-Listings v28.02 entfernt.
**B) Backend:** `marketplace_listings` (RLS insert/update/delete own + select active) · `marketplace_messages` + `v_marketplace_conversations` (Chat) · `marketplace-publish v3` (verify_jwt) · GIN-FTS `idx_marketplace_listings_fts_de` · `fn_marketplace_set_status`/`_search`/`_auto_archive` (in fn_cleanup_old_data). Alle ✓.
**C) Findings:** 🔴 0. 🟠 P1: Chat-Modal nutzt Polling (Latenz) — kein Realtime. 🟡 P2: Multi-Photo-Reorder nur via ★-Main (kein Drag); Auto-Archiv-Cron hängt an fn_cleanup_old_data (kein dedizierter Schedule — läuft nur wenn cleanup läuft).
**D) Quick-Fixes v28.03:** (1) Verifiziert: Listing-Create für Free+Pro funktioniert (v28.02). (2) Chat-Polling-Intervall dokumentiert. (keine Code-Änderung nötig — Bereich post-v28.02 stabil)
**E) Deferred v28.07+:** Realtime-Chat (Supabase Realtime statt Polling) · Drag-Reorder Fotos · dedizierter Auto-Archiv-Cron · Rating-System.

## Bereich 2 — 👥 Community
**A) Frontend:** `gsOpenCommunity` (v28.02 Following-zentrisch: Feed/Meilensteine/Suche) ✓ · `gsOpenProfile` (privacy-aware) · `gsOpenProfileSettings` · Avatar-Klick im Feed→Profil. Empty-States ✓.
**B) Backend:** `profiles` +9 Spalten · `user_follows` (RLS read-all+own-write) · `user_blocks` (owner-only RLS) · 7 RPCs (fn_profile_view alle-Privacy-Checks-server-seitig / follow_toggle / block_toggle / user_search / discover / following_feed / blocked_list). Alle ✓.
**C) Findings:** 🔴 0. 🟠 P1: `fn_following_feed` JOINt mehrere Tabellen ohne LIMIT-Vorfilter pro Quelle → bei 100+ Follows evtl. >2s (Index-Review nötig). 🟡 P2: `fn_user_discover` ist seit v28.02 ungenutzt (Discover-Tab raus) — toter RPC, kann in v28.07 gedroppt werden. Avatar-Klick noch nicht in ALLEN Listen einheitlich (Marketplace-Seller, Leaderboard).
**D) Quick-Fixes v28.03:** (1) Privacy-Hard-Test server-seitig in fn_profile_view bereits verifiziert (v27.02). (2) Leaderboard/Marketplace-Seller-Namen → gsOpenProfile-klickbar machen (wenn user_id vorhanden) — Quick-Fix-Kandidat.
**E) Deferred:** Feed-Performance-Index bei Scale · fn_user_discover droppen · einheitlicher `_gsRenderUserAvatar`-Helper überall.

## Bereich 3 — 🛠 Next-Level-Tools (8)
**3a 🩺 Doktor v2:** plant_doctor_history/plant_treatment_steps/symptom_library(14 Seed) + plant-doctor-diagnose v4 + 7d-Follow-up-Banner. ✓ Frontend gsRunDiagnose/gsDoctorShowHistory/CheckFollowups. P1: Follow-up nur In-App-Banner, kein OS-Push (BL-01 Backlog).
**3b ⚔️ Quiz-Battles:** quiz_battles + ELO _fn_quiz_battle_finalize + Matchmaker + v27.04-sessionStorage-Resume. ✓ P1: „Gegner-antwortete"-Push fehlt (BL-02). Cron quiz-battles-expire ✓.
**3c 📸 Foto-Diff:** plant_photo_diffs + callVisionAI + Time-Lapse. ✓ P2: kein Offline-Draft.
**3d 🌱 Garten-Planer v3:** garden_plans +6 + climate_scenarios_ch(12) + garden-scan-analyze v7/v8 + Mehrjahres/Was-wäre-wenn. ✓
**3e ❄️ Wetter-Alerts:** weather_alerts + weather-alert-checker Cron 3h + Inbox. ✓ Hängt an push_subscriptions.gps (v26.93).
**3f 🏆 Achievements:** achievements_catalog/user_achievements + fn_achievements_bump + Konfetti + Feed. ✓ P2: LS-Cache mergt nicht zurück vom RPC-Overview (offline-stale).
**3g 🔍 Fuzzy-Suche:** pg_trgm + species-search Edge-Fn + fn_species_top_picks Home-Card (v27.04 Dismiss). ✓
**3h 📷 Scanner+Scan-to-Add:** gsAddScanToMyPlants + Thumb-Upload user-plant-photos. ✓
**C) Findings:** 🔴 0. 🟠 P1: 3 fehlende OS-Pushes (Doktor-Follow-up BL-01, Battle-answered BL-02 — brauchen send-push-Cron). 🟡 P2: Foto-Diff Offline-Draft, Achievements LS-Resync.
**D) Quick-Fixes v28.03:** Battle-Push BL-02 als Backlog-Quick-Win (Phase D) — wenn send-push-Pfad reicht.
**E) Deferred:** OS-Push-Hooks (eigener Mini-Sprint mit send-push-Cron) · Foto-Diff-Offline · Achievements-Resync.

## Bereich 4 — 🌱 Meine Pflanzen
**A) Frontend:** renderMyPlants + Sub-Tab Wohnung/Garten (v26.90) + Autocomplete-Add (v26.87/89) + Plant-Card-Tasks + gsQuickDone/doneTask. ✓ Save-Feedback ✓.
**B) Backend:** user_plants (jsonb-Blob data.plants[]) + fn_plant_task_done (jsonb_set WITH ORDINALITY) + Universal-Save/Snapshot (v27.01, Empty-Clobber+Boot-Race-Guard). ✓
**C) Findings:** 🔴 0 (v27.01 fixte den Datenverlust). 🟠 P1: 0 bekannt. 🟡 P2: Plant-Detail Foto-Galerie + Diary-Tab-Integration könnte runder sein.
**D) Quick-Fixes v28.03:** Verifiziert stabil post-v27.01. Keine dringende Änderung.
**E) Deferred:** Lazy-Load bei >50 Pflanzen (BL-Perf) · Move-Plant Wohnung↔Garten.

## Bereich 5 — 🌳 Mein Garten
**A) Frontend:** renderGarden + Garden-Cards + openAddPlanting + Ernte (gsHarvestSubmit) + Diary (gsDiaryAddEntry) + Wetter-Banner + Score-History.
**B) Backend:** gardens · garden_plantings · garden_diary (**0 Zeilen**) · garden_harvests (**0 Zeilen**, kanonisch, 17 Spalten) · harvest_log (legacy, existiert) · garden_milestones · garden_score_history. Pull liest garden_diary + garden_harvests (gsSyncUserDataOnLogin Z.62747/62770).
**C) Findings (korrigiert nach Code-Verifikation, Hard-Lesson #14):** 🔴 0. **🟠 P1: Zwei parallele Harvest-Subsysteme** — `gsHarvestSubmit` (Z.29761) schreibt+liest `harvest_log` (Pro-Pflanze-Ernte-Historie im Plant-Detail, Spalten plant_local_id/harvested_at — intern konsistent ✓). Das Garten-Ernte-Widget nutzt `garden_harvests` via gsCloudSync-Queue (Z.63328) + Login-Pull (Z.63055, Spalten ts/menge/unit). KEIN simpler Endpoint-Tippfehler — zwei Features. garden_harvests=0 Zeilen → Garten-Ernte-Widget-Queue-Pfad selten genutzt/prüfen. **Re-Point wäre destruktiv** (bräche Plant-Detail-Historie) → Konsolidierung deferred. 🟡 P2: garden_diary=0 Zeilen (Diary-Widget selten genutzt); Score-History-Trend-Visualisierung.
**D) Quick-Fixes v28.03:** (keine — Harvest-Konsolidierung ist KEIN Quick-Fix; bewusst deferred statt riskantem Re-Point). Garten-Bereich funktional stabil (beide Subsysteme intern konsistent).
**E) Deferred v28.07+:** ⭐ Harvest-Subsystem-Konsolidierung (harvest_log + garden_harvests → eine Quelle, mit Migration der bestehenden Daten) · garden_harvests-Queue-Pfad-Verifikation · Score-Trend-Chart.

## Bereich 6 — ⚙️ Einstellungen
**A) Frontend:** Settings-Screen (flache Liste + Sektionen) + Toggles via savePref→gsPrefsPushNow (v27.03 deep-merge-RPC, v28.02 token-robust) + Sync-Status #gs-sync-status + neue Rows (Profil/Backup/Orgs). Standort aktuell NICHT tri-modal getrennt.
**B) Backend:** user_preferences + fn_user_prefs_save(jsonb) deep-merge + RLS own-only. ✓
**C) Findings:** 🔴 0. 🟠 P1: Standort nicht tri-modal (Karte=Live/Garten=Fix/Wetter=Settings-Wahl) — eine zentrale Helper-Funktion `gsGetLocationFor(context)` fehlt. 🟡 P2: Settings flach statt 8-Sektionen-Accordion; Toggle-Sofort-Feedback uneinheitlich. Hard-Lesson-#9-Fishing (v27.03): gsHTMLEscape + gsLoadGardenWeather bereits gefixt; restliche Guards (gsOpenAuthModal/gsPPloadWeather/gsStartCamera/gsLoadFarmWeather/gsMapRefreshUserLocation) sind harmlose defensive Fallbacks (echte Pfade greifen).
**D) Quick-Fixes v28.03:** ⭐ `gsGetLocationFor(context)`-Helper (context: 'map'→Live-GPS, 'garden'→fix gespeichert, 'weather'→Settings-Wahl gs_weather_loc_mode auto/garden/manual). + Settings-Row „📍 Wetter-Standort"-Wahl.
**E) Deferred v28.07+:** 8-Sektionen-Accordion-Redesign · alle Toggles Spinner→Häkchen · vollständiges Menü-Seiten-Audit.

## Bereich 7 — 💬 Feedback & Hilfe
**A) Frontend:** Feedback-Modal (Menü→Feedback) mit Type + Text + optional Foto + Submit. Hilfe/FAQ: minimal/keine dedizierte FAQ-Sektion.
**B) Backend:** `feedback_items` (**1 Zeile** — Submit funktioniert ✓) + feedback-triage Edge-Fn (v3). ✓
**C) Findings:** 🔴 0. 🟠 P1: keine FAQ/Hilfe-Sektion (User-Self-Service fehlt). 🟡 P2: Feedback-Status-Rückmeldung an User.
**D) Quick-Fixes v28.03:** ⭐ 5-Item-FAQ-Sektion aufbauen (häufigste Fragen: Daten-Sync/Backup, Pro/Lifetime, Karten-Funde, Pflanzen hinzufügen, Org beitreten) — read-only, low-risk.
**E) Deferred:** Feedback-Status-Tracking · durchsuchbare Hilfe.

## Bereich 8 — 📚 Gartenwissen
**A) Frontend:** gsKnowledgeGlobalSearch (search2) + Bookmarks (🔖) + Reading-Progress + „Heute neu" + Related + Offline (v26.94). ✓
**B) Backend:** UNION-VIEW v_knowledge_search (5 Tabellen) + knowledge_bookmarks + knowledge_progress + 6 RPCs (search2/recent/related/bookmark_toggle/bookmarks_list/track_progress, anon-hardened). ✓
**C) Findings:** 🔴 0. 🟠 P1: 0 bekannt. 🟡 P2: Reading-Progress-Continue-Bar UX; Related-Qualität (Trigram word_similarity).
**D) Quick-Fixes v28.03:** Verifiziert stabil post-v26.94.
**E) Deferred:** Related-Ranking-Tuning · Offline-Reading-Cache-Größe.

---

## 📊 Zusammenfassung Findings
- **🔴 P0:** 0 über alle 8 Bereiche (Juni-bug-frei-Ziel für P0 erreicht).
- **🟠 P1:** Ernte-Endpoint-Mismatch (B5) · Standort-tri-modal-Helper fehlt (B6) · FAQ-Sektion fehlt (B7) · 3 fehlende OS-Pushes (B3) · Feed-Perf bei Scale (B2) · Diary-0-Zeilen-Check (B5).
- **🟡 P2:** diverse Polish (Realtime-Chat, Drag-Reorder, Accordion-Settings, Foto-Diff-Offline, …) → v28.07+.

## ✅ v28.03 Quick-Fixes umgesetzt (Phase B)
Siehe BUG_TRACKER + CHANGELOG. Fokus (verifiziert sicher): **gsGetLocationFor-Helper + Wetter-Standort-Wahl (B6)** · **5-Item-FAQ-Sektion (B7)**. B5-Ernte-Konsolidierung bewusst deferred (kein sicherer Quick-Fix — würde Plant-Detail-Historie brechen). Restliche P1/P2 dokumentiert/deferred zu v28.07+. **0 P0 über alle 8 Bereiche** (Juni-Ziel für P0 erreicht). Vollständige Phase-B-Abdeckung (alle 3-5 Fixes/Bereich) + Phase-D-Backlog laufen über Folge-Takes weiter.
