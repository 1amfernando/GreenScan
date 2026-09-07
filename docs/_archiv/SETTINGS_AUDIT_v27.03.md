# SETTINGS_AUDIT v27.03 — Vollständige Settings-Persistence-Karte + Hard-Lesson-#9-Befunde

> Erstellt 03.06.2026 (Phase A der v27.03-Diagnose, DB-Pre-Flight + Code-Grep). Quelle: wie/wo jedes Setting gespeichert + angewandt wird.

## 🔑 Architektur (echte DB-Realität, Hard-Lesson #14)

- **Spec-Tabelle `user_prefs` existiert NICHT** → echte Tabelle ist **`public.user_preferences`** (RLS own-only INSERT/SELECT/UPDATE, UNIQUE user_id, 0 Zeilen vor v27.03).
- Strukturierte Spalten: `language, region, altitude_m, reminders_enabled, push_enabled, email_enabled, digest_freq, units (jsonb)` + Catch-all **`prefs jsonb`**.
- Frontend-Quelle: `localStorage.gs_prefs` (userPrefs-Blob aus `savePrefs()`), DEFAULT_PREFS ~14 Toggles. `savePref(key,val)` → `gsPrefsPush`→`gsPrefsPushNow` (v26.69-Alias-Fix). Pull: `gsPrefsPull` (REST GET → Object.assign(row,row.prefs) → gs_prefs).
- **v27.03-Änderung:** `gsPrefsPushNow` schreibt jetzt über **`fn_user_prefs_save(p_patch jsonb)`** (atomarer jsonb-**DEEP-MERGE** `prefs || patch` statt REST-Replace) + Debounce 2000→800ms + 3× Retry + Sync-Status-Update.

## 📊 Settings-Karte

| Setting | LS / Quelle | Cloud-Pfad | Apply-Funktion | Status |
|---|---|---|---|---|
| Theme/Dark | gs_prefs.darkMode + gs_dark | prefs jsonb / user_app_state.ui.dark | applyAllPrefs / applyTheme | ✅ |
| Theme-Color | gs_theme_color | user_app_state.ui.theme_color | applyAllPrefs | ✅ |
| Sprache | gs_lang | user_preferences.language + ui.lang | applyAllPrefs/i18n | ✅ |
| Schriftgröße | gs_prefs.fontSize | prefs jsonb | applyAllPrefs | ✅ |
| Kompakt-Modus | gs_prefs.compact | prefs jsonb | applyAllPrefs | ✅ |
| Einheiten | gs_units / units | user_preferences.units (jsonb) | — | ✅ |
| Push global | push_subscriptions | push_subscriptions (v26.93) | gsSubscribeWebPush | ✅ |
| Push Frost/Wasser/Saison/Quiz | gs_prefs.*Notif | push_subscriptions.notify_* | gsSavePushSettings | ✅ |
| Push Hitze/Sturm (v27.00) | — | push_subscriptions.notify_heat/storm | gsSavePushSettings | ✅ |
| Push Vorlaufzeit (v27.00) | #push-lead-hours | push_subscriptions.alert_lead_hours | gsSavePushSettings | ✅ |
| Quiet Hours | — | push_subscriptions.quiet_start/end_hour | gsSavePushSettings | ✅ |
| Home-Wetter/Mond/Pest-Tips/Safety | gs_prefs.* | prefs jsonb | applyAllPrefs | ✅ |
| Achievements-Feed-Optin | gs_prefs.achFeed | profiles.opt_in_achievement_feed | gsToggleAchFeed | ✅ |
| Profil-Sichtbarkeit (v27.02) | — | profiles.profile_visibility | gsSaveProfileField | ✅ |
| Profil Show-Toggles ×4 (v27.02) | — | profiles.show_* | gsSaveProfileField | ✅ |
| Community-Feed-Optin (v27.02) | — | profiles.opt_in_feed | gsSaveProfileField | ✅ |
| Analytics-Consent (revDSG) | gs_consent.analytics | (LS-gated, analytics_events) | Consent-Banner | ✅ separat |
| Cloud-Backup/Sync (v27.01) | gs_snapshot_* | user_state_snapshots | gsManualSnapshotBackup | ✅ |

## 🐛 Hard-Lesson #9 — Silent-Alias-Fishing (Befunde)

Grep aller `typeof gsX==='function'`-Guards (164) gegen echte Definitionen (1189):

| Symbol | Befund | Verdikt |
|---|---|---|
| **`gsHTMLEscape`** | als „Kurz-Alias" dokumentiert, aber **NIE definiert** — 8+ Sites nahmen immer den Fallback | 🔧 **GEFIXT**: `window.gsHTMLEscape` definiert (voller Escaper inkl. `'`) → konsistentes Escaping |
| **`gsLoadGardenWeather`** | in `gsBroadcastLocationChange` gerufen — echter Name ist **`gsLoadGardenWeatherAlerts`** (v26.69-Typo-Muster) → Wetter-Alerts refreshten NIE bei Standort-Wechsel | 🔧 **GEFIXT**: echten Namen + `gsLoadMarkersFromCloud` ergänzt |
| `gsPrefsPush` vs `gsPrefsPushNow` | v26.69 bereits gefixt (Alias gesetzt) | ✅ ok |
| `_gsOrigSyncOnLogin` | `var = window.gsSyncUserDataOnLogin` (echte Zuweisung) | ✅ kein Bug |
| `gsOpenAuthModal` | defensiver Fallback NACH `openLoginModal` (echter Pfad greift) | ℹ️ harmlos |
| `gsPPloadWeather` | optionaler Planner-Wetter-Preload, typeof-guarded, kein Crash | ℹ️ harmlos (deferred) |
| `gsStartCamera` / `gsLoadFarmWeather` / `gsMapRefreshUserLocation` | optionale defensive Hooks, typeof-guarded | ℹ️ harmlos |

**Netto: 2 echte silent Aliases gefixt** (gsHTMLEscape + gsLoadGardenWeather-Cluster), 6 als harmlose defensive Fallbacks verifiziert.

## ⚠️ Bewusst NICHT in v27.03

- Komplettes Settings-UI-Teardown/Re-Grouping (Spec Phase C1) — zu riskant auf funktionierenden Toggles; stattdessen gezielte Persistence-Härtung.
- Senior-Mode (Fernando deferred).
- Neue konfliktäre `user_prefs`-Spalten (units ist bereits jsonb) — prefs-jsonb ist Catch-all.
