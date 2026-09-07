# Backend ↔ Frontend Map · v26.76 · 2026-06-01

> **Master-Auftrag #4 Audit.** Stand: nach v26.65–v26.75 (9 Sprints in 1 Tag) + v26.76 Backend-Cleanup. Quelle: `information_schema.tables`, `list_edge_functions`, grep `index.html`, `get_advisors`.

## TL;DR

- **117 Tables** (5 `legacy_*` in v26.76 gedroppt + `schema_migrations`-Duplikate, alle in `public`).
- **30 Edge-Functions** LIVE deployed.
- Alle Tables haben RLS · **0 Security-Advisor-ERRORs** (4 in v26.76 behoben).
- 100% Backend-Coverage: jede Domain hat ein zugeordnetes Frontend-Modul.
- **Verwaiste Edge-Functions:** 6 Stripe-Setup-Fns sind seit Stripe-Live-Switch (v26.40) Dead-Code (Code-seitig 410-Gone-Stubs; physisches Löschen = Fernando-Dashboard).

---

## v26.76 · Backend-Cleanup-Sprint — Resolution Log

> Backend-only (KEIN Client-v-Bump — index.html/sw.js unverändert, kein Re-Download erzwungen).

| # | Finding | Fix (LIVE in DB) | Migration / Deploy |
|---|---|---|---|
| P1.1/P1.2 | Stripe Dead-Code + `customer-portal`/`create-checkout`-Duplikate | Bereits in Vor-Version als **410-Gone-Stubs** im Code erledigt (grep `index.html`: nur noch in `GS_RELEASES`-Changelog-Text). Physisches Edge-Fn-Löschen = Fernando-Dashboard. | — |
| P1.4 | `legacy_*`-Tables (5) | **⚠️ Korrektur:** Audit nannte sie "safe drops" — sind aber FK-PARENTS von ~12 aktiven Tabellen. DROP nur sicher, weil alle FK-Children **0 Rows**. Behebt sogar latente kaputte FKs. | `v26_76_drop_legacy_tables.sql` (CASCADE) + `delete-user` v4 (legacy_profiles-Block raus, ZUERST deployed) |
| P1.5 | `plant-doctor-diagnose` ohne AI-Logging | Verifiziert: **loggt bereits** (Edge-Fn ruft `fn_log_ai_usage`) → No-Op. | — |
| P3.1 | `book_ingest_jobs` Archivierung | TTL 90d für Terminal-Status (`completed/done/failed/error/cancelled`); **pending NIE gelöscht** (66 pending). | `v26_76_implement_cleanup_old_data.sql` |
| P3.2 | `audit_log` ohne TTL | TTL 180d. + `notifications` TTL 90d. | dito |
| — | `fn_cleanup_old_data()` war **Placeholder-No-Op** | Echte TTL-Logik implementiert (Cron `gs_cleanup_old_data` 03:15 UTC lief seit jeher ins Leere). | dito |
| ADV | 4 Security-Advisor **ERRORs** | 3× `security_definer_view` → `security_invoker=true`; 1× `auth_users_exposed` → GRANT entzogen. **0 ERRORs verbleibend.** | `v26_76_security_view_hardening.sql` |
| ADV | `duplicate_index` (3×) | redundante Indexes/Constraints gedroppt (jeweils funktional identisches behalten). | `v26_76_drop_duplicate_indexes.sql` |
| ADV | `function_search_path_mutable` (4 eigene Fns) | `search_path=public, pg_temp` gepinnt (Extension-Fns bewusst ausgelassen). | `v26_76_function_search_path_hardening.sql` |

**DEFERRED (eigener Perf-Sprint, NICHT v26.76):** 73× `auth_rls_initplan` + 166× `multiple_permissive_policies` (zu groß/riskant auf Live-Payment-DB ohne Per-Policy-Review), 14× `unindexed_foreign_key`, 7× `public_bucket_allows_listing`. **Fernando-Manual:** 7 obsolete Stripe-Edge-Fns physisch löschen · Stripe-Live-Switch · TWINT/4242-Test · GitHub `workflow`-Scope-PAT.

---

## 1 · Tabellen-Matrix (Domain × Frontend-Modul)

### User-Content (write-heavy, Cross-Device kritisch)

| Tabelle | Write | Read | Render |
|---|---|---|---|
| `user_gardens` | `saveGarden`, `gsPushPlantsNow` | `loadGardens`, `gsSyncUserDataOnLogin` | `renderGardens` |
| `user_plants` | `savePlant` → UPSERT | `loadMyPlants` | `renderMyPlants` |
| `gardens` | `submitGarden` (Wizard) | `gsLoadGardens` | Garten-Liste |
| `garden_plantings` | `placeRecommendation` (KI-Plan) | `gsLoadPlantings` | Garten-Detail |
| `garden_diary` | `gsAddDiaryEntry`, `gsTbDelete` | `gsLoadDiary` | Plant-Detail-Modal |
| `garden_harvests` | `gsErnteAdd`, `gsErnteDelete` | `gsErnteLoad` | `gsErnteRender` |
| `garden_milestones` | `gsCheckMilestone` (RPC `fn_check_milestone`) | `gsLoadMilestones` | XP-Widget |
| `garden_plans` (KI-Plan) | `garden-scan-analyze` (insert), `gsPPdeletePlan` | `gsPPopenSavedPlans` v26.68 | Saved-Plans-Modal |
| `garden_score_history` | `fn_log_garden_score` daily | `gsLoadScoreHistory` | Score-Chart |
| `garden_tasks` | `gsAddGardenTask` | `gsLoadGardenTasks` | Garten-Aktion-Liste |
| `harvest_log` | (legacy, ersetzt durch garden_harvests) | (selten) | — |
| `notifications` | `gsScheduleNotif`, push-checker | `gsNotifPull` | Notif-Liste |
| `plant_doctor_history` | `plant-doctor-diagnose` (insert) | `gsLoadDoctorHistory` | Doctor-Modal |
| `plant_reminder_snoozes` | `gsSnoozeReminder` | `gsIsReminderSnoozed` | Reminder-Logic |
| `quiz_answers` | `dqRecordAnswer` | `dqLoadAnswers` | Quiz-Stats |
| `quiz_leaderboard` ✨ NEW v26.72 | `fn_quiz_leaderboard_upsert` via `dqPushLeaderboardDebounced` | `fn_quiz_leaderboard_top` / `_my_rank` | `gsOpenQuizLeaderboard` |
| `quiz_ranking` | (legacy, ersetzt durch leaderboard) | — | — |
| `scan_events` | `gsTrackScan` | `gsLoadScanHistory` | Scan-Card |
| `scan_corrections` | `gsSubmitScanCorrection` | (Admin) | — |
| `user_scans` | `addToConfirmed` | `loadUserScans` | Scan-History |
| `user_species` | `gsToggleFav` | `loadFavSpecies` | Favoriten-Tab |
| `user_app_state` | `_pushStateBlob` (debounced) | `_pullStateBlob` | Cloud-Sync für 9 LS-Keys |
| `user_preferences` ✨ FIXED v26.69 | `gsPrefsPushNow` (`prefs jsonb`) | `gsPrefsPull` | userPrefs-Globalvar |
| `user_achievements` | `fn_unlock_achievement` | `gsLoadAchievements` | Achievements-Modal |
| `user_quest_progress` | `gsUpdateQuestProgress` | `gsLoadQuests` | Quest-Card |
| `user_weekly_challenge_progress` | `gsTrackChallenge` | `gsLoadChallenges` | Challenge-Card |
| `user_submissions` | `submitSpeciesProposal` | (Admin) | — |
| `user_garden_layouts` | `gsSaveLayout` | `gsLoadLayouts` | Layout-Picker |
| `book_ingest_jobs` | `book-ingest` (PDF) | `gsLoadBookJobs` | Book-Modal |
| `book_ocr_pages` | `book-ingest` | — | — |
| `book_species_candidates` | `book-ingest` | `gsReviewCandidates` | Review-Modal |
| `books` | `gsSaveBook` | `gsLoadBooks` | Books-Liste |
| `expert_verifications` | `fn_verify_species` | `loadVerifications` | Verified-Badge |
| `feedback_items` | `submitFeedback` | `loadFeedback` | Feedback-Tab |
| `feedback_votes` | `voteFeedback` | (joined mit items) | Vote-Counter |
| `feedback_analysis` | `feedback-triage` (insert) | (Admin) | — |
| `friendships` | `gsAddFriend` | `gsLoadFriends` | Social-Tab |
| `marketplace_listings` | `submitListing`, `gsListingsRender` | `loadMarketFromSupabase` | Marketplace |
| `marketplace_messages` ✨ NEW v26.70 | (Frontend coming v26.74) | `v_marketplace_conversations` View | (Chat-Modal TBD) |
| `marketplace_sellers` | `marketplace-publish` | `gsLoadSellerProfile` | Profil-Tab |
| `map_user_finds` ✨ NEW v26.71 | `gsAddMarker` (cloud-augmented) | `gsLoadMarkersFromCloud` | Map-Marker mit ☁️ |
| `plant_diagnoses` | `plant-doctor-diagnose` | (joined mit history) | — |
| `post_comments` | `gsAddComment` | `gsLoadComments` | Post-Detail |
| `post_likes` | `gsToggleLike` | `gsLoadLikes` | Like-Counter |
| `profiles` | `gsUpdateProfile` | `sbGetProfile` | Profil-Modal |
| `push_subscriptions` | `gsRegisterPush` | `push-test` Edge-Fn | (Admin) |
| `push_send_log` | `daily-push-checker` | (Admin) | — |
| `sensor_devices` | `gsRegisterSensor` (BLE) | `gsLoadSensors` | Sensor-Modal |
| `sensor_readings` | `gsRecordReading` | `gsLoadReadings` | Sensor-Chart |
| `sensor_alerts` | `gsCheckSensorAlert` | `gsLoadAlerts` | Alert-Banner |
| `social_garden_visits` | `gsRecordVisit` | `gsLoadVisits` | Social-Stats |
| `social_posts` | `submitIgPost` | `loadSocialFeed` | Social-Tab |
| `species_proposals` | `gsProposeSpecies` | (Admin) | Review-Modal |
| `species_watchlist` | `gsWatchSpecies` | `gsLoadWatchlist` | Watchlist-Tab |
| `stripe_subscriptions` | `stripe-webhook` (sync) | `sbGetEntitlements` | Plan-Badge |
| `stripe_webhook_events` | `stripe-webhook` (audit) | (Admin) | — |
| `abo_events` | `gsLogAboEvent` | (Admin) | — |
| `audit_log` | `fn_audit_log` (security events) | (Admin) | — |
| `weather_log_per_garden` | `gsLogWeather` | `gsLoadWeatherHistory` | Frost-Banner-History |
| `frost_history` | `fn_log_frost_event` | `gsLoadFrostHistory` | Frost-Banner |

### Knowledge-Content (read-mostly, growing via `knowledge-bulk-gen`)

| Tabelle | Source | Frontend-Modul |
|---|---|---|
| `achievements_catalog` | `knowledge-bulk-gen` | Achievements-Modal |
| `alpine_garden_plants` | `knowledge-bulk-gen` v10+ | Wissen-Tab 9 |
| `compost_recipes` | `knowledge-bulk-gen` | Wissen-Tab 4 |
| `compost_troubleshooting` | manuell | Wissen-Tab 4 Detail |
| `daily_quizzes` | `knowledge-bulk-gen` | `dqGetTodaysQuiz` |
| `did_you_know_facts` | `knowledge-bulk-gen` | Home-Card "Wusstest du?" |
| `fertilization_schedules` | `knowledge-bulk-gen` | Düngeplan-Modal |
| `folk_lore` | `knowledge-bulk-gen` | Wissen-Tab "Folklore" |
| `forest_garden_design` | `knowledge-bulk-gen` v10+ | Wissen-Tab Permakultur |
| `garden_birds_register` | `knowledge-bulk-gen` v9+ | Wissen-Tab Vögel |
| `garden_layouts` | manuell | Layout-Picker |
| `garden_problems` | `knowledge-bulk-gen` | Wissen-Tab "Probleme" |
| `garden_tasks_catalog` | `knowledge-bulk-gen` | Garten-Aktion-Liste |
| `garden_techniques` | `knowledge-bulk-gen` | Wissen-Tab "Techniken" |
| `garden_visitors_animals` | `knowledge-bulk-gen` v11+ | Wissen-Tab Tiere |
| `garden_weather_alerts` | manuell + cron | Home-Wetter-Alert-Widget v26.49 |
| `harvest_preservation` | `knowledge-bulk-gen` | Wissen-Tab Konservierung |
| `i18n_translations` | `i18n-translate` | gsI18n |
| `indoor_houseplants` | `knowledge-bulk-gen` v10+ | Wissen-Tab Indoor |
| `medicinal_plants_register` | `knowledge-bulk-gen` | Wissen-Tab Heilpflanzen |
| `mushroom_lookalikes` | manuell | Mushroom-Scanner Detail |
| `mushroom_recipes` | `knowledge-bulk-gen` v9+ | Wissen-Tab Pilz-Rezepte |
| `mushroom_register` | `knowledge-bulk-gen` | Mushroom-Scanner |
| `mushroom_seasonal_patches` | `knowledge-bulk-gen` v8+ | Home-Saison-Card |
| `pest_companion_plants` | `knowledge-bulk-gen` | Companion-Suche |
| `plant_care_schedules` | manuell | Pflege-Hinweise |
| `plant_companion_matrix` | `knowledge-bulk-gen` | KI-Plan-Companion-Hints |
| `plant_diseases` | `knowledge-bulk-gen` | Wissen-Tab Krankheiten |
| `plant_pests` | `knowledge-bulk-gen` | Wissen-Tab Schädlinge |
| `pollinators` | `knowledge-bulk-gen` | Wissen-Tab Bestäuber |
| `propagation_methods` | `knowledge-bulk-gen` | Wissen-Tab Vermehrung |
| `recipes` | `knowledge-bulk-gen` | Rezepte-Tab |
| `regional_garden_calendars` | manuell | Regional-Tab |
| `remedies` | `knowledge-bulk-gen` | Heilmittel-Tab |
| `seasonal_highlights` | `knowledge-bulk-gen` | Home-Card |
| `seasonal_tips` | `knowledge-bulk-gen` | Home-Tip-Card |
| `seed_saving_methods` | `knowledge-bulk-gen` | Wissen-Tab Saatgut |
| `seed_starting_calendar` | `knowledge-bulk-gen` | Säkalender |
| `soil_amendments` | `knowledge-bulk-gen` | Boden-Tab |
| `species` | `species-bulk-seed` + manuell | Such-Tab + Detail |
| `species_embeddings` | `species-bulk-seed` (RAG) | `fn_knowledge_search` |
| `species_images` | manuell | Detail-Modal |
| `species_sources` | manuell | Detail-Modal |
| `species_import_queue` | (Admin) | — |
| `swiss_climate_zones` | manuell | Regional-Tab |
| `swiss_heritage_varieties` | manuell | Heritage-Tab |
| `traditional_garden_wisdom` | `knowledge-bulk-gen` | Wissen-Tab "Bauernregeln" |
| `urban_balcony_design` | `knowledge-bulk-gen` v10+ | Wissen-Tab Balkon |
| `water_features` | `knowledge-bulk-gen` v9+ | Wissen-Tab Wassergarten |
| `weekly_challenges` | `knowledge-bulk-gen` | Challenge-Card |
| `quests` | manuell | Quest-Card |
| `ar_models` | manuell | AR-Tab (lazy) |
| `ch_chemical_legal` | manuell | Pestizid-Filter |
| `daily_quiz_history` | aggregate | Quiz-Stats |
| `feature_limits` | manuell | Pricing-Modal |
| `launch_offer_usage` | `gsClaimLaunchOffer` | Pricing-Modal |
| `rate_limits` | `fn_check_rate_limit` | Edge-Fns intern |
| `stripe_prices` | `stripe-bootstrap` | Pricing-Modal |
| `stripe_products` | `stripe-bootstrap` | Pricing-Modal |
| `ai_daily_usage` | `fn_log_ai_usage` von 5 Edge-Fns | `gsLoadDailyUsage` Admin |
| `ai_queries` | (Admin-Telemetrie) | — |
| `app_settings` | (Admin) | `fn_get_global_api_key` |
| `schema_migrations` (×4 Klone) | Supabase intern | — |

---

## 2 · Edge-Functions Inventar (30 LIVE)

### KI-Pipeline (5)
| Fn | Verify-JWT | v | Frontend-Aufruf | Logging-RPC |
|---|---:|---:|---|---|
| `garden-scan-analyze` | ✅ | v5 | `gsRunGardenScan` | ✅ `fn_log_ai_usage` |
| `plan-iterate` | ✅ | v3 | `gsIteratePlan` | ✅ `fn_log_ai_usage` |
| `plant-doctor-diagnose` | ✅ | v2 | `runDoctor` | ✅ `fn_log_ai_usage` (v26.76 verifiziert) |
| `pest-identify` | ✅ | v2 | `runPestScan` | ✅ `fn_log_ai_usage` |
| `mushroom-identify` | ✅ | v2 | `runMushroomScan` | ✅ `fn_log_ai_usage` |

### Marketplace (3)
| Fn | Verify-JWT | v | Frontend-Aufruf |
|---|---:|---:|---|
| `marketplace-publish` | ✅ | v1 | `submitListing` (when paid+image) |
| `stripe-create-connect-account` | ✅ | v1 | `gsMarketplaceConnectStripe` |
| `stripe-expert-checkout` | ✅ | v1 | `gsBuyExpertSession` |

### Stripe (12 — viele sind Setup-Time-Tools)
| Fn | Verify-JWT | v | Status |
|---|---:|---:|---|
| `stripe-checkout` | ✅ | v6 | LIVE — primary subscription checkout |
| `stripe-portal` ✨ FIXED v26.68 | ❌ | v4 | LIVE — Abo-Verwaltung |
| `stripe-webhook` | ❌ | v11 | LIVE — Event-Sync (28 cases) |
| `stripe-bootstrap` | ❌ | v5 | LIVE — Prices/Products-Sync |
| `customer-portal` | ❌ | v4 | LIVE (older variant von stripe-portal — TODO konsolidieren) |
| `create-checkout` | ❌ | v5 | LIVE (older variant — TODO konsolidieren) |
| `send-receipt` | ✅ | v2 | LIVE — Email-Receipt |
| `delete-user` | ✅ | v4 | LIVE — Konto-Lösch-Flow (v26.76: legacy_profiles-Block raus) |
| `stripe-setup-webhook` | ❌ | v4 | 💀 DEAD-CODE — Setup-Time (v26.0) |
| `stripe-restructure-pro-only` | ❌ | v3 | 💀 DEAD-CODE — Setup-Time (v25.38) |
| `stripe-import-fernando-sub` | ❌ | v3 | 💀 DEAD-CODE — Migration-once |
| `stripe-complete-setup` | ❌ | v4 | 💀 DEAD-CODE — Setup-Time |
| `stripe-final-audit` | ❌ | v3 | 💀 DEAD-CODE — Setup-Time |
| `stripe-admin-extend-webhook` | ❌ | v1 | DEAD/optional — Admin-Tool für Webhook-Extend |

### Knowledge / Daily (5)
| Fn | v | Cron |
|---|---:|---|
| `knowledge-bulk-gen` | v11 | nightly `0 1 * * *` |
| `daily-push-checker` | v4 | 3-stage `0 7,14,18 * * *` |
| `i18n-translate` | v2 | on-demand (lazy lang-switch) |
| `species-bulk-seed` | v3 | rare admin-trigger |
| `admin-seed-species` | v2 | rare admin-trigger |

### Misc (5)
| Fn | Verify-JWT | v | Frontend-Aufruf |
|---|---:|---:|---|
| `book-ingest` | ✅ | v8 | `runBookImport` |
| `feedback-triage` | ✅ | v2 | nightly cron |

---

## 3 · Findings

### 🟥 P1 — Cleanup
1. ✅ **5 Setup-Time-Stripe-Functions Dead-Code** — Code-seitig als 410-Gone-Stubs erledigt; physisches Löschen = Fernando-Dashboard (nicht via MCP).
2. ✅ **`customer-portal` + `create-checkout` Duplikate** — Frontend ruft nur noch `stripe-portal`/`stripe-checkout`; alte Slugs nur in Changelog-Text.
3. **`schema_migrations`-Duplikate (3×):** Postgres-System-Klone. Bleiben (Supabase intern).
4. ✅ **`legacy_*`-Tables (5) — GEDROPPT (v26.76).** ⚠️ **Korrektur des Original-Findings:** waren NICHT "safe drops", sondern FK-PARENTS von ~12 aktiven Tabellen. DROP CASCADE war nur sicher, weil alle FK-Children 0 Rows hatten — verifiziert vor dem Lauf. Behob latente kaputte FKs (zeigten auf falschen Parent, hätten echte User-Inserts blockiert). `delete-user` v4 ZUERST deployed (legacy_profiles-Ref raus), dann DROP.
5. ✅ **`plant-doctor-diagnose` AI-Logging** — verifiziert: loggt bereits via `fn_log_ai_usage` (Edge-Fn v2). War No-Op.

### 🟡 P2 — Frontend-Ergänzungen (alle ✅ v26.75)
1. ✅ **`marketplace_messages` Chat-UI** — `openMarketChat` + `gsOpenConversations` live (v26.75).
2. ✅ **`map_user_finds` "Meine Funde"-Screen** — `gsOpenMyFinds` live (v26.75).
3. ✅ **`quiz_leaderboard` Home-Card** — `gsHomeFillLeaderboard` Top-3 live (v26.75).

### 🟢 P3 — Optimierungen
1. ✅ **`book_ingest_jobs` Archivierung** — `fn_cleanup_old_data` TTL 90d für Terminal-Status (pending NIE); Cron 03:15 UTC (v26.76).
2. ✅ **`audit_log` TTL** — 180d via `fn_cleanup_old_data` (v26.76). + `notifications` 90d.
3. **`species` 4.3 MB + `species_embeddings` 1.6 MB.** Größte Tables. Embeddings: pgvector-Index vorhanden. `species`: 57 Spalten — manche in JSON aggregierbar (DEFER).

### 🔵 ADV — Security/Performance-Advisors (v26.76)
- ✅ **4 ERRORs behoben:** 3× `security_definer_view` (→ `security_invoker=true`), 1× `auth_users_exposed` (GRANT entzogen). **0 ERRORs verbleibend.**
- ✅ **3× `duplicate_index`** gedroppt. ✅ **4 eigene Fns** mit gepinntem `search_path`.
- ⏭ **DEFERRED (eigener Perf-Sprint):** 73× `auth_rls_initplan`, 166× `multiple_permissive_policies`, 14× `unindexed_foreign_key`, 7× `public_bucket_allows_listing`. Zu groß/riskant auf Live-Payment-DB ohne Per-Policy-Review.

---

## 4 · RLS-Status

Alle 117 Tabellen haben RLS aktiv (✅ post-v26.51-Hardening). Die `schema_migrations`-Klone in System-Schemas sind Supabase-intern und nicht user-facing. `book_ocr_pages` + `species_import_queue` haben RLS-enabled-no-policy → bewusst Deny-All (Admin-/Service-Role-only, kein Frontend-Read).

---

## 5 · Empfehlungen für nächste Sprints

- ✅ **v26.74/v26.75:** Frontend-Chat + "Meine Funde" + Quiz-Leaderboard-Home-Card — DONE.
- ✅ **v26.76:** Backend-Cleanup — legacy-DROP, cleanup-fn, audit/notif TTL, 4 Advisor-ERRORs, duplicate-index, search_path — DONE.
- **v26.77 (Perf-Sprint):** RLS-Hardening — `auth_rls_initplan` (73× `auth.uid()` → `(SELECT auth.uid())`) + `multiple_permissive_policies` (166×) per-policy konsolidieren + 14× `unindexed_foreign_key`. Vorsicht: Live-Payment-DB, Per-Policy-Review.
- **Fernando-Manual:** 7 obsolete Stripe-Edge-Fns physisch löschen · Stripe-Live-Switch · TWINT/4242-Test · GitHub `workflow`-Scope-PAT · 7× `public_bucket_allows_listing` prüfen.
- **DEFER:** `species` 57-Spalten-Schema in JSON aggregieren.

---

**Erstellt:** 2026-06-01 in v26.73 · **Update:** v26.76 Backend-Cleanup-Resolution-Log · GreenScan Backend-Frontend-Map v2.
