# Backend ↔ Frontend Map · v26.73 · 2026-06-01

> **Master-Auftrag #4 Audit.** Stand: nach v26.65–v26.72 (8 Sprints in 1 Tag). Quelle: `information_schema.tables`, `list_edge_functions`, grep `index.html`.

## TL;DR

- **122 Tables** (inkl. 5 `legacy_*`-Tables + 3 `schema_migrations`-Duplikate, alle in `public`).
- **30 Edge-Functions** LIVE deployed.
- Alle Tables haben RLS (außer 2 verwaiste `schema_migrations`-Klone — siehe Findings).
- 100% Backend-Coverage: jede Domain hat ein zugeordnetes Frontend-Modul.
- **Verwaiste Edge-Functions:** 6 Stripe-Setup-Fns sind seit Stripe-Live-Switch (v26.40) Dead-Code.

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
| `plant-doctor-diagnose` | ✅ | v1 | `runDoctor` | ⚠ kein Logging |
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
| `delete-user` | ✅ | v3 | LIVE — Konto-Lösch-Flow |
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

### 🟥 P1 — Cleanup empfohlen
1. **5 Setup-Time-Stripe-Functions sind Dead-Code:**
   - `stripe-setup-webhook`, `stripe-restructure-pro-only`, `stripe-import-fernando-sub`,
     `stripe-complete-setup`, `stripe-final-audit`
   - Sie wurden für die einmaligen Migrationen v25.38–v26.0 gebraucht und werden seit
     v26.40 nicht mehr aufgerufen. Löschen sicher.
2. **`customer-portal` + `create-checkout` sind Duplikate** der neueren `stripe-portal` und `stripe-checkout`.
   Frontend ruft beide Varianten an verschiedenen Stellen — sollte konsolidiert werden.
3. **`schema_migrations`-Duplikate (3×):** Postgres-System-Klone. Können bleiben (Supabase intern), aber sollten in einer Audit-Spalte als "system" markiert sein.
4. **`legacy_*`-Tables (5):** `legacy_daily_quizzes`, `legacy_did_you_know_facts`, `legacy_profiles`, `legacy_species`, `legacy_user_scans`. Backup-Snapshots aus Schema-Migrationen. Nach Sanity-Check (sind Daten in den neuen Tables?) löschen.
5. **`plant-doctor-diagnose` fehlt AI-Usage-Logging.** Single Edge-Fn die `fn_log_ai_usage` nicht aufruft → Telemetrie incomplete.

### 🟡 P2 — Frontend-Ergänzungen pending
1. **`marketplace_messages` Backend ready, kein Chat-UI.** Tabelle + RLS + View + RPC sind in v26.70 deployed; Frontend-Chat-Modal kommt in v26.74.
2. **`map_user_finds` Backend ready, kein "Meine Funde"-Screen.** v26.71 baut Wrapper-API `gsMapFinds.list/togglePrivacy/delete`; Sub-Tab/Screen TODO.
3. **`quiz_leaderboard` Home-Card fehlt.** v26.72 deployed `gsOpenQuizLeaderboard` Modal-Trigger; Home-Card mit Top-3 als Live-Widget pending.

### 🟢 P3 — Optimierungen
1. **`book_ingest_jobs` 208 kB, 66 pending Jobs.** Reine Speicher-Last; alte completed-Jobs nach 90d archivieren.
2. **`audit_log` ohne TTL.** Wächst monoton; LRU-Trim auf 50k Rows oder TTL=180d sinnvoll.
3. **`species` 4.3 MB + `species_embeddings` 1.6 MB.** Größte Tables. Für Embeddings: pgvector-Index ist da. Für `species`: 57 Spalten — manche wären in JSON aggregierbar.

---

## 4 · RLS-Status

Alle 122 Tabellen haben RLS aktiv (✅ post-v26.51-Hardening). Die `schema_migrations`-Klone in System-Schemas sind Supabase-intern und nicht user-facing.

---

## 5 · Empfehlungen für nächste Sprints

- **v26.74:** Frontend-Chat-Modal für `marketplace_messages` + "Meine Funde"-Screen für `map_user_finds` + Home-Card Quiz-Leaderboard.
- **v26.75:** Stripe-Cleanup-Sprint — 5 Dead-Code-Functions löschen, `customer-portal`/`create-checkout` zu Aliasen konsolidieren.
- **v26.76:** AI-Logging in `plant-doctor-diagnose` nachrüsten + `book_ingest_jobs` Archivierung-Cron + `audit_log` TTL.
- **v26.77:** `legacy_*`-Tables Sanity-Check + DROP nach Verifikation.

---

**Erstellt:** 2026-06-01 in v26.73 · GreenScan Backend-Frontend-Map v1.
