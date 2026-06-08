# APP_MGMT_TOOLS_AUDIT — Block F.1 Inventar (v28.63 Stand)

> **F.1-Deliverable** aus `AUFTRAG_CODE_v28.32.md` Block F. Erschöpfendes Inventar der
> App-Verwaltung, Admin-Dashboards, Key-/Backup-/Storage-Tools und der 9 Next-Level-Tools
> (Speicher-/Lade-/Edit-/Sammlungs-Status). Erstellt via 8-Agenten-Workflow + Synthese +
> Faktencheck am Code. Basis: `index.html` ~69k Zeilen, v28.63.

---

## 0 · Executive Summary

- **Admin gibt es 2× nebeneinander** (`openAdminPanel` @55917 DB-Editor + @68728 User-Mgmt) — **Hard-Lesson #9**: die zweite gewinnt durch Hoisting, der DB-Editor ist *shadowed* (wiederbelebbar, nicht kaputt — `DB` existiert global @18215).
- **F.2-Kernlücken:** keine Echtzeit-Metriken (User/MRR/Scan/Error), keine User-Suche, kein GDPR-Anonymisieren, keine Stripe-Status-Ansicht, keine Edge-Function-Health.
- **F.3-Kernlücke universell:** **keines** der 9 Tools landet sauber in Sammlungen; kein einheitliches Edit/Duplizieren/Versionieren/Teilen. `gsCollectionsAutoVacuum` triggert nur nach `species`-Add.
- **Latente Bugs gefunden:** DB-Editor Persistence-Lücke (RAM-only), `importUserData` bare `confirm()` (HL#2), SB-Key-Save ohne try/catch (HL#10), Doktor-Historie kein Cross-Device-Sync, Foto-Diff-Verlauf-RPC nie aufgerufen.

---

## 1 · App-Verwaltung Menü (user-facing, @5548–5563)

**Existiert (3 Buttons, alle Handler vorhanden):**
- `gsShowStorageModal` @63650 — Speicher-%, SW-Status, Offline-Queue, Persistent-Toggle, Cache-Clear
- `gsShowConnDetail` @63489 — Online/Offline, Tempo, Pending-Sync, letzte-Sync, Sync-jetzt
- `gsShowExportModal` @64691 — 2 CSV-Exports (`gsExportPlantsCSV` @64597 / `gsExportDiaryCSV` @64654, Live-Counts)
- `exportUserData` @41312 (JSON-Backup, 17 Bereiche) / `importUserData` @41336 (JSON-Restore)
- `gsConfirmClearAllData` @41376 → `clearAllData` @41368 (korrekt mit `gsConfirmModal` kind=danger)

**Fehlt:** Sync-Status-Badge im Menü, Cloud-Backup-Status im Menü, Cache-Details pro Speicher-Typ, Wissens-Cache-Stats exposed (`gsKnowledgeStats` @63818 existiert ungenutzt), selektives Cache-Clear.

**Risiken:** `importUserData` @41347 nutzt bare `confirm()` (**HL#2**). CSV-Export ohne Size-Limit (Blob-Risiko bei riesigen Beständen, Web-Share-Fallback @64632).

---

## 2 · Admin-Dashboard / User-Verwaltung (LIVE @68728)

**Existiert:** `openAdminPanel` @68728 (async, gewinnt) · `gsAdminListUsers` @68719 (`v_admin_users`) · `gsAdminAssignRole` @68700 (RPC `fn_assign_role`) · Storage-Diagnostics-Card @68764 · `gsRoleBadge` @68668 · `GS_ROLE_HIERARCHY` @68631 (banned<user<expert<staff<admin) · `GS_PERMISSIONS.ADMIN` @68810 · `gsCanDo`/`gsRoleAtLeast`/`gsUpdateAdminUIVisibility`.

**Fehlt (F.2-Spec):**
- **Echtzeit-Metriken** (User-Count, MRR, Scan-Volumen, Error-Rate) — komplett absent
- **User-Suche/Pagination** — `gsAdminListUsers` lädt blind ALLE User (>1000 = Perf-Knick)
- **GDPR-Anonymisieren-Knopf** — nicht vorhanden (nur `delete-user` Edge-Fn @65503 für User selbst)
- User-Detail-Felder (Tier, Created, Last-Active, Stripe-IDs) — View liefert nur Name/Email/xp/scan_count/role/avatar

**Risiken:** `gsAdminBanUser` @61487 + `gsAdminSetExpertLevel` @61498 speichern **nur lokal** (`gs_admin_log` Ringbuffer 200) — schizophren neben RPC-basiertem `fn_assign_role`. Rollen-Wechsel-Notification @68787 angekündigt, aber keine Impl.

---

## 3 · DB-Editor Admin-Panel (Arten-CRUD, @55917 — SHADOWED)

**Existiert:** `openAdminPanel` @55917 (erste Def, DB-Editor) + `admShowTab`/`admUpdateStats`/`admRenderTable`/`admBuildForm`/`admSaveNew`/`admOpenEdit`/`admConfirmDel`/`admRenderDupes`/`admApplyDedup`/`admExportJSON`/`admExportCSV`/`admChangePw` (55930–56138) + HTML-Modal @69906 (Tabs species/add/dupes/export/pw).

**Status:** **shadowed Dead-Code** — die zweite `openAdminPanel` @68728 gewinnt durch Hoisting. `DB` existiert global (@18215 `var DB = window.DB || []`) → der Editor ist *lauffähig*, nur *unerreichbar*. (Inventar-Claim „DB undefined" wurde im Faktencheck **widerlegt**.)

**Risiken:**
- **Persistence-Lücke (KRITISCH):** `admSaveNew` @56069 / `admConfirmDel` @56083 / `admApplyDedup` @56115 mutieren **nur RAM-`DB[]`** — kein Cloud/LS-Write → bei Reload weg. (Vermutlich Demo-Mode, nirgends dokumentiert.)
- HL#12-Muster bei `admOpenEdit`/`admConfirmDel` onclick **bereits in v28.63 gefixt** (echte Konkatenation).
- `admBuildForm` @56055 escaped `inp`-Felder aber **nicht** Textareas (`ta()`) → potenzielles innerHTML-XSS bei cloud-controlled Werten.
- Edit-Button-Text-Reset fehlt nach Cancel (`admClearForm` @56080 setzt `'✏️ Bearbeiten'` nicht zurück).

---

## 4 · SB-Key + Global-API-Key Admin (@56922 ff.)

**Existiert (gut ausgebaut):** `openAdminSbKeyPanel` @56922 · `gsAdminSaveSbKey` @56963 · `gsAdminSetGlobalApiKey` @57125 (RPC `fn_set_global_api_key`) · `gsAdminResetSbKey` @57299 · `_gsKeyHealthWalker` @57009 (Modell-Fallback-Chain-Ping) · `gsHealthCheckGlobalKey` @57054 · `gsCheckKeyAge` @57065 (150d Warn / 180d Critical) · `gsDailyKeyHealthCheck` @57098 · `gsOpenGlobalKeyAdmin` @57176 (Status-Modal, Age-Badge, Test/Save/Toggle).

**Fehlt:** Key-Test-Ratelimit (beliebig oft → bis 300 API-Calls), Verschlüsselung der LS-Keys, Key-Audit-Trail im Backend, schneller Revoke-Button.

**Risiken:** LS-Keys unverschlüsselt (CSP-protected, aber XSS-exposed). `gsAdminSaveSbKey` @56975/56977 **localStorage ohne try/catch** (**HL#10** — Toast zeigt ✅ obwohl Quota-Fehler). Health-Check nach Save läuft **sync** (blockiert UI 3–8s wenn API langsam). Unklar ob `gsDailyKeyHealthCheck`/`gsCheckKeyAge` überhaupt zeitgesteuert aufgerufen werden.

---

## 5 · Stripe-Status + Edge-Function-Health (F.2 — fast komplett fehlend)

**Existiert:** nur Edge-Fn-**Calls** (`stripe-checkout` @13153, `stripe-portal` @13242, `stripe-expert-checkout` @28635) + Anthropic-Key-Health (`_gsKeyHealthWalker`). Backend-Daten da (`stripe_subscriptions`, `v_user_entitlements`).

**Fehlt komplett:** Stripe-Status-Übersicht (charges/payouts/MRR), Pro/Lifetime-User-Count, Edge-Function-Health-Pings (F.2 will 30-Min-Cron + rotes Banner), Error-Rate-Dashboard, Webhook-Status. → **Mission-relevant** (Fernando: „Kostendeckung im Auge behalten").

---

## 6 · Storage-Buckets + RLS-Coverage + Sync/Backups

**Existiert:** `gsStore` @20984 (Quota-safe LS-Wrapper + `usageBytes`) · Storage-Diagnostics-Card @68771 · `gsCloudSync` @66391 (`markDirty`/`pushBlob`/`status`@66825) · `gsSyncStatusText` @67031 · `user_state_snapshots` (max 3/User, RLS own-only) · `gsManualSnapshotBackup` @67049 · `gsSnapshotCreate`@66909 / `gsSnapshotRestore`@66950 (RPCs `fn_user_snapshot_*`).

**Fehlt:** RLS-Coverage-Report im Admin (106 Policies), Bucket-Übersicht (5 Buckets: post-images/garden-scans/marketplace-photos/book-pdfs/map-find-photos + Größen/Limits), Pro-User-Storage-Quota, Admin-Query für fremde Snapshots, persistente Quota-Hit-Statistik, globale Sync-Queue-View.

---

## 7 · Next-Level-Tools — Speicher-/Sammlungs-Status (F.3)

Legende: 💾 Speicher · 📂 Lade · ✏️ Edit · 🔁 Duplizieren · 📚 Sammlung

| # | Tool | 💾 | 📂 | ✏️ | 🔁 | 📚 | Schlüssel |
|---|---|---|---|---|---|---|---|
| 1 | Garten-Planer | ✓ LS+Cloud (2 Quellen!) | ✓ Merge | ~ Re-Open | ✗ | ✗ | `gsPPsavePlan`@49469, `_gsSaveGardenPlanCloud`@49695 |
| 2 | Doktor-Diagnose | ✓ LS + Cloud-Tabelle | ~ LS-only (kein Cross-Device!) | ✗ kein UI | ✗ | ✗ | `gsRunDiagnose`@28771, `gs_doctor_history`@66522 |
| 3 | Foto-Diff | ✓ Cloud-only | ✗ RPC `fn_photo_diff_list`@58441 **nie aufgerufen** | ✗ | ✗ | ✗ | `gsPhotoDiffPersist`@53289 |
| 4 | 3D-Planer/Tracks | ✓ LS+Cloud (JSONB) | ~ | ~ lokal | ✗ | ✗ | `gs_gpx_tracks`@42885 |
| 5 | Companion-Planting | nur Cache 15min | View `v_companion_lookup` | — | — | ✗ | `gsLoadCompanionsForPlanPlant`@50483 |
| 6 | Was-Wenn | transient (by-design, max 20 JSONB) | — | — | — | ✗ | `gsGardenScanWhatIfRun`@51822 |
| 7 | Forest-Garden | ✓ via `_gsSaveGardenPlanCloud` | Cache 30min | ✗ | ✗ | ✗ | `gsForestAdoptPlan`@31128 |
| 8 | Balkon-Wizard | ✓ via `_gsSaveGardenPlanCloud` | Cache | ✗ | ✗ | ✗ | `gsBalconyAdoptTemplate`@50055 |
| 9 | Bestäuber-Garten | ✗ kein Cloud-Save (reine Empfehlung) | Cache 30min | — | — | ✗ | `gsBeeFriendlyOpen`@52194 |

**Universelle F.3-Lücke:** `gsAddToCollection` @6898 unterstützt `item_type` (species/listing), aber **`item_type='plan'` wird nie benutzt**. `_gsCollGatherSourceItems` @6691 sammelt nur DB-Arten/eigene-Pflanzen/Funde/Inserate — **keine** Tool-Ergebnisse. `gsCollectionsAutoVacuumDebounced` @6794 triggert nur @6943 nach species-Add.

**Hebel:** Tools 1+7+8 nutzen **denselben** Save-Pfad `_gsSaveGardenPlanCloud` @49695 → **ein** Eingriff (item_type='plan' + Auto-Vacuum-Trigger) macht drei Tools sammlungsfähig.

**Hybrid-Storage-Risiko (Garten-Planer):** schreibt zu `user_gardens.data.plans` UND `garden_plans`-Tabelle; `gsPPopenSavedPlans` @53620 merged per ID, aber Prefixes divergieren (`uuid` vs `gp_uuid`) → Merge kann Duplikate nicht erkennen. Kanonische Quelle festlegen nötig.

---

## 8 · Empfohlene Sub-Versions-Roadmap (F.2 + F.3)

| Version | Inhalt | Typ | Aufwand | Risiko |
|---|---|---|---|---|
| **v28.65** | **Admin-Cleanup:** `openAdminPanel`-Duplikat konsolidieren (DB-Editor als Tab ins User-Mgmt-Panel ODER löschen), `gsIsAdmin`-Stub @61372 raus, DB-Editor-Persistence entscheiden, `importUserData`→`gsConfirmModal` (HL#2), SB-Key try/catch (HL#10) | Tech-Debt | M | niedrig |
| **v28.66** | **Quick-Wins (alle nutzen fertiges Backend):** Foto-Diff-Verlauf anschalten (`fn_photo_diff_list`), Doktor Cross-Device-Sync, Admin-User-Suche+Limit, Key-Test-Ratelimit, Wissens-Cache-Stats exposen, Plan-Sanitize-on-save | Quick-Wins | S–M | niedrig |
| **v28.67** | F.2 **Admin-Metriken-Tab** (User/aktiv/Tier/Scan/Error via neue RPC `fn_admin_metrics`, HL#13 REVOKE/GRANT) | F.2 | L | mittel |
| **v28.68** | F.2 **Stripe-Status-Tab** (MRR/charges/payouts/Pro-Count/Webhooks — internes Monitoring, KEIN Sales-UI) | F.2 | L | mittel |
| **v28.69** | F.2 **Edge-Health-Cron** (30-Min-Ping + rotes Banner) + Cloud-Audit-Trail (Ban/Expert) + Bucket/RLS-Report | F.2 | L–XL | mittel (Backend-Deploy) |
| **v28.70** | F.3 **Sammlungs-Integration Pläne** (`item_type='plan'` + Auto-Vacuum-Trigger in `_gsSaveGardenPlanCloud`) → Garten-Planer + Forest + Balkon auf einen Schlag | F.3 | M | niedrig |
| **v28.71** | F.3 **Plan-Edit/Duplizieren** + Hybrid-Storage-Konsolidierung (kanonische Quelle `garden_plans`) | F.3 | L | mittel |
| **v28.72** | F.3 **Rest-Sammlungen** (diagnosis/photo_diff/tracks) + transiente Tools (Companion/Was-Wenn/Pollinator) als by-design-nicht-persistent klarstellen | F.3 | M | niedrig |

**Reihenfolge-Logik:** v28.65 entriegelt das Admin-Panel (sonst baut F.2 auf der shadowed Definition). v28.66 erntet sofortigen Wert aus bereits gebautem Backend. v28.67–69 = F.2-Ausbau (Metriken → Stripe → Health). v28.70 = größter F.3-Einzelhebel (1 Eingriff, 3 Tools). v28.71/72 vervollständigen.

**Cross-Cutting (jeder Sprint):** 5-fach v-Bump (HL#1) · neue RPCs `REVOKE … FROM PUBLIC, anon` + `GRANT … TO authenticated` + serverseitig `is_admin_user()` (HL#13/#14, `information_schema` VOR Schreib-Code) · Cron-Kommentare ohne `*/N` in `/* */` (HL#15) · `node --check` aller Inline-Scripts · neue Sammlungs-item_types folgen Single-Flight/Opt-out-Muster (`gs_auto_collections`).

---

**Stand:** v28.63 · erstellt 09.06.2026 via 8-Agenten-Audit-Workflow + Synthese + Faktencheck.
