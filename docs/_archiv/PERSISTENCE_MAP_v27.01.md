# PERSISTENCE_MAP v27.01 — Vollständige Save/Pull-Karte aller User-Content-Domains

> Erstellt 03.06.2026 (Phase A der v27.01-Diagnose, 9-Agenten-Fan-out + DB-Pre-Flight gegen Projekt `vowbiueikwrauuceilhc`). Quelle der Wahrheit für den Persistence-Audit.

## 🔴 Root-Cause-Zusammenfassung (warum „Daten nach Update weg")

**Zwei unabhängige P0-Bugs, beide bestätigt durch DB-Fakten:**

1. **Funde-Cloud-Save: 100 % broken.** `map_user_finds` hat **0 Zeilen total** — noch NIE erfolgreich gespeichert. Ursache: `gsAddMarker` (Z. ~40035) POSTet ein Payload **OHNE `user_id`**. `map_user_finds.user_id` ist NOT-NULL-ohne-Default + RLS-INSERT `with_check (user_id = (SELECT auth.uid()))`. → jeder INSERT scheitert (NOT-NULL + RLS), aber der Code zeigt trotzdem teils Erfolgs-Toast. Funde leben nur in `localStorage['greenscan_markers']` → bei Cache-Clear/Update weg.

2. **Empty-Array-Clobber + Boot-Race (der „nach Update weg"-Hauptbug).** Bestätigt: `user_plants` hat **4 Zeilen, davon 2 mit leerem `data->plants`** — zwei reale User wurden bereits geleert. Mechanik:
   - Beim Boot/Login setzt `gsClearUserDataKeys()` (Z. 62597) `myPlants = []` synchron.
   - Der Cloud-Pull (`gsSyncUserDataOnLogin`) läuft erst ~1.8 s später async.
   - Feuert in diesem Fenster IRGENDEIN `savePlantsToStorage()` (UI-Render, Modal-Close) ODER der 30-s-Auto-Flush / `beforeunload`, wird via `_buildPlantsBlob()` (Z. 62897) ein **leerer Blob `{plants:[]}`** nach `user_plants` UPSERTet (Z. 62866/62975).
   - Dieser leere Push bekommt ein **frisches `updated_at`**. Beim nächsten Pull entscheidet `_shouldOverwriteLocal` rein per Timestamp → leere Cloud gewinnt → **lokale Daten unwiderruflich überschrieben, auf allen Geräten**.
   - Zusätzlich: der Pull-Merge (Z. 62653) überschreibt populated local mit `[]`, sobald die Cloud-Zeile leer + neuer ist — `if (Array.isArray(pd.plants))` lässt `[]` durch.

**v27.01-Fix-Strategie (Defense-in-Depth):** (a) `user_id` in Funde-Payload, (b) PUSH-Guard: keine leeren plants/garden-Blobs vor `_gsInitialSyncDone`, (c) PULL-Guard: leere Cloud darf populated local nie überschreiben (stattdessen Re-Push = Repair), (d) `user_state_snapshots`-Backup als Sicherheitsnetz + Restore-Banner.

---

## 📊 Vollständige Domain-Karte

| Domain | LS-Key(s) | Cloud-Tabelle | Save-Pfad | Pull-Pfad | in gsCloudSync? | Bekannte Bugs / Risiken |
|---|---|---|---|---|---|---|
| **Funde** | `greenscan_markers` | `map_user_finds` (Row-Tabelle) | `gsAddMarker` Z.40035 direkter sbFetch POST | `gsLoadMarkersFromCloud` Z.40116 / `gsMapFinds.list` Z.40210 | **NEIN** (eigener Pfad) | 🔴 **0 Zeilen** — Payload ohne `user_id` → RLS+NOT-NULL-Reject. Nicht im Login-Pull (kein Cross-Device). Cache-Clear = Totalverlust. |
| **Pläne** | `gs_garden_plans`, `gs_garden_plan_current` | `user_gardens.data.plans` (+ `garden_plans` Tabelle 0 Zeilen, broken) | `gsPPsavePlan` Z.47159 → `user_gardens` Blob | `gsSyncUserDataOnLogin` Z.62639 + `gsPPopenSavedPlans` 3-Quellen-Merge Z.51230 | partial (Blob-Push ja, garden_plans nein) | 🟠 adopt-flows (`gsBalconyAdoptTemplate` Z.47702, `gsForestAdoptPlan` Z.29192) POSTen `garden_plans` ohne `user_id` → RLS-Reject (0 Zeilen). Empty-Clobber bei Z.62640. |
| **Pflanzen** | `ps_myplants` | `user_plants.data.plants` (jsonb-Blob) | `savePlantsToStorage` Z.22524 → `_buildPlantsBlob` Z.62897 | `gsSyncUserDataOnLogin` Z.62648 | **ja** (voll) | 🔴 **Empty-Array-Clobber + Boot-Race** (2 von 4 Zeilen leer). PUSH+PULL beide ungeguardet. |
| **Tagebuch** | `gs_gartentagebuch` | `user_plants.data.diary` + `garden_diary` (0 Zeilen) | `gsDiaryAddEntry` Z.28598 + Blob | Login-Merge Z.62747 (dedupe per id) | partial | 🟡 garden_diary 0 Zeilen (kaum genutzt o. Pfad-Schwäche). photo_b64 ohne Size-Limit. |
| **Ernte** | `gs_ernte_log` | `garden_harvests` (Pull) / `harvest_log` (Save, 0 Zeilen) | `gsHarvestSubmit` Z.29659 → `/rest/v1/harvest_log` | Login-Merge Z.62770 `/rest/v1/garden_harvests` | partial (Queue-basiert) | 🟠 Save→`harvest_log`, Pull←`garden_harvests` (Endpoint-Mismatch). `quality_rating` evtl. nicht in Schema. |
| **Settings** | `gs_prefs`, `gs_dark`, `gs_theme_color`, `gs_lang` | `user_preferences.prefs` (jsonb) + Spalten | `gsPrefsPushNow` Z.63860 (2 s debounce) | `gsPrefsPull` Z.63823 | separater Pfad | 🟢 v26.69-Fix (`gsPrefsPush`→`gsPrefsPushNow`-Alias) aktiv. (v27.03 vertieft) |
| **Quiz/Streak** | `gs_dq_*`, `gs_quiz_streak`, `gs_streak` | `user_app_state.data` + `quiz_leaderboard` | Blob (`_buildStateBlob` Z.62932) + `dqPushLeaderboard` | Login state-Pull Z.62665 | ja (Blob) | 🟢 Blob-gesichert. Leaderboard separat. |
| **Achievements** | `gs_achievements` | `user_app_state.data.achievements` + `achievements_catalog`/`user_achievements` | Blob + `gsAchBump` RPC | state-Pull | ja (Blob) | 🟡 LS-Cache mergt nicht zurück vom RPC-Overview (offline-stale). |
| **Battles** | — | `quiz_battles` (cloud-native) | `fn_quiz_battle_submit` RPC | `fn_quiz_battle_list` RPC | nein (cloud-native) | 🟡 `window._gsBattle` nur in-memory → Reload mitten im Battle = Verlust (v27.04). |
| **Doktor** | `gs_doctor_history` | `plant_doctor_history` + `user_app_state.data.doctor_history` | RPC/PATCH + Blob | RPC load + state-Pull | ja (Blob) | 🟡 Dual-Persistence (Cloud + LS-Blob) nicht gemerged on re-online. |
| **Foto-Diff** | — | `plant_photo_diffs` | `fn_photo_diff_create` RPC | `fn_photo_diff_list` RPC | nein (cloud-native) | 🟡 Pure-Cloud, kein Offline-Draft. |
| **Marketplace** | — | `marketplace_listings` | Edge-Fn `marketplace-publish` | REST GET | nein (Edge-Fn) | 🟡 Foto-Upload fire-and-forget ohne Bestätigung. |
| **Scans** | `gs_scan_history` | `scan_history` | `gsLoadCloudScans` Pfad | Login Z.62786 | separat | 🟢 eigener Pfad ok. |

---

## 🛠️ v27.01-Maßnahmen (was implementiert wird)

1. **Funde-Fix (C):** `user_id: gsStore.get('gs_sb_uid')` ins `gsAddMarker`-Payload + Skip-Cloud-wenn-kein-uid + `pending_cloud_sync`-Marker. `gsLoadMarkersFromCloud()` in Login-Sync hängen (Cross-Device).
2. **PULL-Empty-Guards (B):** `gsSyncUserDataOnLogin` Z.62640 (garden) + Z.62653 (plants): leere Cloud-Collection überschreibt nie populated local → stattdessen `markDirty` (Re-Push = Repair).
3. **PUSH-Boot-Race-Guard (B):** `window._gsInitialSyncDone`-Flag (gesetzt am Ende von `gsSyncUserDataOnLogin`). `_flush` skippt leere plants/garden-Blobs solange `!_gsInitialSyncDone`.
4. **Snapshot-Backup (B):** Migration `v27_01_persistence_safeguard` — `user_state_snapshots` + `fn_user_snapshot_create`/`fn_user_snapshots_list`/`fn_user_snapshot_latest`/`fn_cleanup_user_snapshots` (max 3 pro User). Frontend `gsSnapshotBuildState`/`gsSnapshotCreate`/`gsSnapshotRestore`.
5. **Restore-Banner (B):** Boot — wenn eingeloggt + lokaler User-Content leer + Cloud-Snapshot vorhanden → „💾 Daten wiederherstellen?".
6. **Auto-Sync 5 Min (B):** Interval — `flushNow()` + 1×/Tag `gsSnapshotCreate('auto_daily')` + Sync-Status-Indikator in Settings.
7. **SW-Pre-Update-Snapshot (B):** Update-Banner-Klick → `gsSnapshotCreate('pre_migration')` VOR `skipWaiting`.
8. **TTL-Cleanup v3 (D):** `fn_cleanup_old_data` v3 — + `user_state_snapshots` (max 3/User) + `push_send_log` (`sent_at` > 30 Tage). User-Content (Pflanzen/Pläne/Funde/Diary/Achievements/Doktor/Foto-Diff/Battles) **sakrosankt — nie gelöscht.**

**Bewusst NICHT in v27.01:** Endpoint-Mismatch Ernte (`harvest_log`↔`garden_harvests`) tieferer Fix → v27.03/v27.04. garden_plans-adopt-flow-`user_id` → mitgefixt (trivial). Battle-in-memory-Reload-Schutz → v27.04. Settings-Deep-Merge → v27.03.
