# AUDIT v28.20 — Full-Stack-Audit (AUFTRAG-Block-C, konsolidiert)

> Stand 04.06.2026 · Repo v28.20 · konsolidiert C1–C5 in EIN Dokument (statt 4 Files —
> AUFTRAG-Prinzip „lieber 3 Sachen richtig fixen als 30 anstreichen").
> **Wichtig:** Der AUFTRAG wurde bei Repo v28.13 geschrieben; mehrere C-Kandidaten sind seither
> bereits umgesetzt (v28.14–v28.19). Diese sind unten als ✅ markiert.

## Block A — KI-Chat → Lina ✅ (umgesetzt v28.20)
Menü-Eintrag, Universal-Suche, Help-Text, Feature-Liste, About-Card, Chip, FAQ → alle auf **Lina**
(`gsOpenLina`) umgestellt. Keine user-facing „KI-Chat"-Erwähnung mehr (verifiziert via grep).
Alter Elena-Screen (`menuNav('ai')` + `AI_SYSTEM_BASE`) bleibt dormant im Code (kein Datenverlust —
Verlauf war LS-only), nur nicht mehr verlinkt → trivial reaktivierbar falls je gewünscht.

## Block B — Marktplatz-Visibility (B-012, P0) ✅ (umgesetzt v28.20)
**Root-Cause:** Fernando testete auf LIVE = **v27.04-Frontend** mit dem B-007-Token-Bug
(marketplace-publish 401 „invalid token") → Inserat erreichte die Cloud nie. **Bereits gefixt in
v28.10** (marketplace-publish v4 + `_gsFreshToken`). Nach Deploy funktioniert Publish.
**Verifiziert (transaktional):** User legt aktives Inserat an → anon sieht es in `v_marketplace_listings`
(seller_name aufgelöst). Status-Verteilung sauber (1 active, 4 archiviert-demo, KEINE draft/null-Leichen).
**v28.20-Härtung:** (1) `v_marketplace_listings` auf **security_invoker** (sicher: profiles public-read →
seller_name trägt; RLS jetzt autoritativ) → **letzter Security-Advisor-ERROR behoben**.
(2) `loadMarketFromSupabase`: Lade-Fehler nicht mehr still geschluckt (gsToast). KEIN `&status=eq.active`
(View liefert bewusst active/reserved/sold für Status-Badges — AUFTRAG-Vorschlag bewusst abgewichen).

## C1 — Backend-Coverage
Alle zentralen User-Features sind cloud-backed + cross-device. Geprüfte Knoten:
- Pflanzen (myPlants-Blob in profiles/state) ✅ · Funde `map_user_finds` ✅ · Tasks (jsonb) ✅
- Scans `scan_events`/`scan_cache` ✅ · Doktor `plant_doctor_history` ✅ · Foto-Diff ✅
- Garten-Pläne `garden_plans` ✅ (v28.09) · **Ernte `garden_harvests` ✅ (v28.15-Konsolidierung)**
- Marktplatz `marketplace_listings`+View ✅ (B-012) · Following/Blocks ✅ · Org/Klassen ✅
- Lina `coach_*` ✅ · Push ✅ · Battles ✅ · Wetter-Alerts ✅ · Wissen-Progress ✅ · Rezepte ✅
- Snapshots ✅ · Prefs `user_preferences` ✅ · Feedback `v_feedback_triage`/feedback-triage ✅
- **Tagebuch:** `garden_diary` ungenutzt (tote Tabelle) — Tagebuch synct via plants-Blob (verifiziert v28.16). Kein Risiko.
- **Bewusst LS-only:** gsBrain-Memory (LRU 200), Suche-History, Standort-Modi — by design.
**Fazit:** Keine kritische Frontend-only-Lücke mit Datenverlust-Risiko.

## C2 — Performance
- **RLS auth_rls_initplan:** 0 (v26.91 + Folge-Wraps). ✅
- **multiple_permissive_policies:** 13 Konsolidierungen v28.18 (same-cmd-Merges + redundante insert_own). Rest (admin_write/public_read-Read-Overlap auf Referenz-Tabellen) deferred — marginal.
- **unindexed_foreign_keys:** 0 (v28.13 + v28.15-Index). ✅
- **unused_index (195):** BEWUSST behalten — FK-/neue Indizes, nur pre-launch ungenutzt, bei Skalierung gebraucht.
- **index.html ~3.5 MB single-file:** Lazy-Load-Module (3D-Planer/Battle/Foto-Diff) = grösster Initial-Load-Hebel, aber Architektur-Eingriff → **deferred** (BACKLOG, eigener Sprint).
- **Storage-Edge-Cache:** Supabase-Storage-URLs liegen NICHT hinter Cloudflare-Pages-`_headers` → kein Quick-Win via `_headers`. Supabase-Transform/CDN-Cache wäre eigenes Thema. Deferred.

## C3 — Sicherheit
- **Security-Advisor: 0 ERRORs** ✅ (v28.20: v_marketplace_listings-Flip war der letzte). 152 WARN alle erwartet/akzeptiert:
  - `anon/authenticated_security_definer_function_executable` (140) = gewolltes own-only-DEFINER-RPC-Pattern (Hard-Lesson #13, REVOKE+GRANT).
  - `public_bucket_allows_listing` (8) = öffentliche Asset-Buckets by design.
  - `extension_in_public` (3) = pgcrypto/pg_trgm etc. · `auth_leaked_password_protection` (1) = **Fernando-Dashboard-Toggle**.
- RLS: 0 Tabellen ohne RLS. Views: marketplace + harvest-stats jetzt security_invoker.
- Kein Hardcode-Key (NVIDIA-Removal v28.04). CSP `connect-src` sauber (inkl. wss://*.supabase.co für Realtime).

## C4 — UX-Konsistenz
- **Settings-Accordion (B-004):** ✅ umgesetzt v28.14.
- **native alert/confirm/prompt (Hard-Lesson #2):** **87 verbleibende** in hot-paths (Marktplatz-Delete/Report, Scan-Delete, User-Block, API-Key) → **TOP-BACKLOG B-013** (async-Refactor confirm→gsConfirmModal, eigener Sprint — zu gross + risiko-behaftet für diesen Block).
- i18n DE/EN/ES: Kern abgedeckt; neue v28.x-Strings teils nur DE-Fallback → Backlog.
- Empty-States: Marktplatz/Klassen vorhanden; Community-Feed könnte CTA — Backlog.

## C5 — Top-Picks (umgesetzt vs. Backlog)
**Umgesetzt v28.20:** (1) Lina-Replace (A), (2) Marktplatz-Visibility + Härtung (B-012),
(3) **0 Security-ERRORs** (View-Flip). Plus historisch bereits: Settings-Accordion (v28.14),
RLS-Perf (v28.18), Realtime-Chat (v28.17), Harvest-Konsolidierung (v28.15), Senior-Mode (v28.19).
**BACKLOG (priorisiert):** B-013 native-alert-Sweep (87×, Hard-Lesson #2) → Settings/Backup/Scan/Marktplatz
zuerst · Lazy-Load-Module (Initial-Load) · multiple_permissive-Phase-2 (Referenz-Tabellen) ·
i18n-Vervollständigung · Storage-CDN-Cache.
