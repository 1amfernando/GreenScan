# GreenScan v28.00→v28.81 Voll-Audit (09.06.2026)

> 9-Agenten-Workflow (BE via Supabase-MCP + FE via Grep), Evidenz-Pflicht. 44 verifizierte Befunde (4 HIGH, 14 MEDIUM, 26 LOW).

## Umsetzungs-Stand
- ✅ v28.82 Sprint A: GPX-Boot-confirm + tote LS-Keys (gs_scan_count/favorites/profile/profile_name)
- ✅ v28.83 Sprint B-Kern: 3 MEDIUM HL#2-Dialoge (Sensor/PW-Reset/Cache-Modal)
- ⬜ Sprint B-Rest: prompt()-Sweep (~7 LOW) + Dead-Code (gsIsAdmin-Stub, analytics/voucher, Interval-Clear, Chat-WS-Hook, Quota-Toast)
- ⬜ Sprint C: i18n-Lücken (Lehrer ~55, Org ~40, Sammlungen ~30, Community ~25, Verkäufer ~20) + EN/ES/FR/IT-Seed
- ⬜ Sprint D [ENTSCHEIDUNG/Backend]: siehe unten

## Synthese (Master-Fix-Liste)

Master-Fix-Liste GreenScan v28-Audit (44 Befunde → 30 dedupliziert)

Hinweis vorab: Mehrere Befunde sind Doppel-Sichtungen desselben Issues (Security-Advisor 2× durchgelaufen). Zusammengeführt: v_feedback_public (2×), 13 anon-DEFINER-Fns (2×), 4× rls_no_policy (2×), 8 Storage-Buckets (2×), Leaked-Password (2×), extensions_in_public (2×), 75× multiple_permissive (2×), 192× unused_index (2×).

---

## 🔴 HIGH — echter User-/Security-Impact

### Frontend

- **[AUTO] HL#2 Crash-Risiko: natives `confirm()` in GPX-Track-Recovery feuert beim App-Boot** (Z.43153). Höchste Prio der ganzen Liste: blockiert das iOS-PWA-Webview automatisch beim Start (kein User-Klick nötig), sobald ein unterbrochener Track existiert. → `await gsConfirmModal(...)`, Callback async.
- **[AUTO] Tote LS-Keys `gs_scan_count` + `gs_favorites` in Home-XP-Bar** (Z.15742/15743 + 15894/15895). Live-Bug: Achievement-Vorschau zeigt JEDEM User scans=0 / favs=leer → Milestones first_scan/scan_10/scan_50/fav_10 immer auf voller Restdistanz, egal wie viel real gescannt. Geschwister-Bug zum bereits gefixten v28.39 gs_xp_total. Echte Quellen: `gs_scan_history` (SCAN_HISTORY_KEY) + `ps_favs`. (gsCheckAchievement = toter Helper, 0 Caller → mitkorrigieren oder löschen.)
- **[AUTO] Tote LS-Keys `gs_profile` + `gs_profile_name`** (Z.18246/18652/15113/15305/46574/66201). Live-Bug auf mehreren sichtbaren Pfaden: Home-Greeting ohne Vorname, Marktplatz-Verkäufername fällt auf email-prefix, Quiz-Ranking-Name aus email, Pflanz-Prefill greift nie. Kanonische Keys: `gs_sb_display_name` / `gs_social_name`.
- **[AUTO] i18n-Lücke Lehrer-Dashboard/Klassen v28.06 — ~55 ungewrappte DE-Strings** (Z.67890-68062). Komplett unübersetzt (EN/ES sehen Deutsch). Pattern existiert (Lina daneben ist gewrappt). → `_t('class_…','DE')`-Sweep + EN/ES-Keys.
- **[AUTO] i18n-Lücke Organisationen v28.01/08 — ~40 ungewrappte DE-Strings** (Z.67674-67885). Dito. → `_t('org_…','DE')`-Sweep.
- **[AUTO] i18n-Lücke Sammlungen v28.24-28 — ~30 ungewrappte DE-Strings inkl. System-Sammlungsnamen** (Z.6662-7018). System-Namen (Giftige/Essbare/Heilpflanzen…) müssen als i18n-Key beim Render gelookupt werden, nicht hart in der Konstante. → `_t('coll_…','DE')`.

### Backend

- *(keine HIGH — kein einziger exploitbarer Befund. Alle "ERROR"/"WARN"-Advisor-Items sind durch Default-Deny-RLS oder interne `is_admin_user()`-Guards entschärft, siehe MEDIUM/LOW.)*

---

## 🟡 MEDIUM — vorhanden, aber kein akuter Schaden

### Frontend

- **[AUTO] HL#2 natives `confirm()` im Sensor-Setup-iOS-Fallback** (Z.55234) — feuert genau auf iOS, wo Web-Bluetooth fehlt → Webview-Blocker. → `gsConfirmModal`.
- **[AUTO] HL#2 natives `confirm()` im Speicher/Cache-Modal onclick** (Z.63967) — Inline-confirm im onclick, über Menü + Command-Palette erreichbar. → benannte Handler-Fn + `gsConfirmModal`.
- **[AUTO] HL#2-Familie natives `prompt()` im Passwort-Reset-Flow** (Z.62078) — auth-kritisch, feuert per setTimeout nach Token-Erkennung. → `gsPromptModal`.
- **[AUTO] Toter LS-Key `gs_weather_loc_manual`** (Z.45761) — Picker-Option "Manuell" ist funktionslos, fällt immer auf Auto zurück. → entweder Write-Pfad (Geocode) ergänzen oder Option entfernen. (`safe_to_autofix=false` im Befund, aber Entfernen der Option ist risikoarm — Entscheidung welcher Weg.)
- **[AUTO] i18n Community-Profil & Feed v27.02/02 — ~25 DE-Strings** (Z.67421-67620). → `_t('profile_…'/'community_…')`.
- **[AUTO] i18n Marktplatz-Verkäufer-Screen (Stripe Connect) — ~20 DE-Strings** (Z.20849-20913). Stripe-Onboarding-Texte, payment-nah aber reiner Anzeige-Text. → `_t('seller_…')`, 4 Status-Renderings.

### Backend (alle [ENTSCHEIDUNG] — Live-DB / Payment-Nähe)

- **[ENTSCHEIDUNG] `profiles.tier` CHECK erlaubt obsolete `plus`/`premium`/`basic`** (payment-relevant). Widerspricht 3-Tier-Mission, Risiko stiller Tier-Drift via Webhook. → CHECK auf `['free','pro','lifetime']` verengen, ABER zuerst `stripe-webhook` v11 + index.html greppen ob irgendwo `plus` geschrieben wird. NICHT blind.
- **[ENTSCHEIDUNG] SECURITY DEFINER View `v_feedback_public` umgeht RLS** (Advisor-ERROR, einziger ERROR). anon liest ALLE feedback_items-Zeilen (Email gestrippt, kein Direkt-Leak, aber Zeilen-Bypass). → `security_invoker=on`, vorher RLS-Policy auf feedback_items für gewollten Public-Read sicherstellen, sonst Liste leer.
- **[ENTSCHEIDUNG] 8 Public-Storage-Buckets erlauben anon Objekt-Listing** (scan-images, map-find-photos, garden-photos privacy-relevant). Fremde Foto-Keys enumerierbar. → broad SELECT-Policy entfernen, pro Bucket prüfen ob Frontend `list()` nutzt (Galerie).
- **[ENTSCHEIDUNG] 4× `rls_enabled_no_policy` + überbreite anon/auth-Grants** (book_ocr_pages, species_import_queue, species_search_cache, weather_forecast_cache). Aktuell Default-Deny → NICHT exploitbar, aber Schema-Hygiene-Risiko + Silent-Empty-Read-Falle (wie map_user_finds v27.01). → REVOKE der anon/auth-Grants ODER bewusste Policy + COMMENT ON TABLE.
- **[ENTSCHEIDUNG] 75× `multiple_permissive_policies`** (Hotspots social_posts 20×, post_comments 15×). Skalierungs-Perf bei wachsendem Feed, doppelte Policy-Auswertung pro Row. → `*_moderate`-Admin-Policy per `OR is_admin_user()` in Funktions-Policies mergen. Per-Policy-Review zwingend (Moderation darf nicht brechen).

---

## 🟢 LOW — Hygiene / kosmetisch / dokumentiert harmlos

### Frontend

- **[AUTO] HL#2-Familie natives `prompt()` an ~8 Stellen** (Community-Name Z.41711 + Scan-Korrektur 24030, Todesursache 28181, Garten-Breite 47021, Sensor 54860/54863, PW-Reset-Email 65424, Umbenennen 65602). → ein `gsPromptModal`-Sweep analog v28.31 confirm-Sweep.
- **[AUTO] `localStorage.setItem`-Wrapper schluckt QuotaExceeded ohne User-Feedback** (Z.6236) — global try/catch da, aber nur `console.warn` → HL#10-Sekundärsymptom "speichere und sehe nichts". → debounced 1×/Session `gsToast` bei Quota-Fehler.
- **[AUTO] `gsIsAdmin` doppelt deklariert** (Stub Z.61670 `return false` + echte Def Z.68948). Aktuell unschädlich (spätere Def gewinnt), aber HL#9-Fragilität. → toten Stub entfernen.
- **[AUTO] Marktplatz-Chat-WebSocket unsubscribe nur via 5s-Poll-Tick** (Z.33038-33192) — kein direkter closeModal-Hook, hängt an `.open`-Klassen-Heuristik. Kein Dauer-Leak, aber Socket+Heartbeat bis zu 5s nach Close offen. → direkter `unsubscribe()` im closeModal-Hook.
- **[AUTO] `_gsAutoSyncInterval` ohne clearInterval-Pfad** (Z.67359-67364) — als einziges Interval ohne Pre-Clear-Pattern; Early-Return-Guard verhindert echten Schaden, aber 5-Min-Timer nach Logout nicht stoppbar. → Pre-Clear + Stop-Pfad bei Logout.
- **[AUTO] Schema-Schuld: `analytics_events`/`vouchers`/`voucher_redemptions` existieren nicht** (Z.68854-68902) — Tabellen fehlen, ABER beide Fns (gsTrackEvent/gsRedeemVoucher) haben 0 Caller → kein Live-404. → toten Code entfernen ODER Tabellen + RLS anlegen bevor verdrahtet.
- **[ENTSCHEIDUNG] Toter LS-Key `gs_user_region` in Marktplatz-Sort "near"** (Z.18754) — Nicht-Zürcher bekommen ZH-Fallback. Echter Key `gs_region` ist ein Slug → Kanton-Mapping nötig, deshalb keine Blind-Korrektur.
- **[ENTSCHEIDUNG] Toter LS-Key `gs_install_declined='forever'`** (Z.62258) — "für immer nicht fragen" unmöglich; Write-Site fehlt ganz. → Write ergänzen ODER toten Code entfernen (je nach ob UI-Wahl existiert).
- **[ENTSCHEIDUNG] Legacy-Dead-Keys `gs_auth_session`/`gs_auth_db` in Admin-IIFE** (Z.69462-69477) — pre-Supabase, fail-closed harmlos, ABER enthält hardcoded `atob()`-Admin-Email (verstößt gegen CLAUDE.md `is_admin_user()`-Regel). → IIFE entfernen.

### Backend (alle [ENTSCHEIDUNG] oder Fernando-Manual)

- **[AUTO] `i18n_translations` CHECK enthält totes `'gsw'`** (Schwiizerdütsch, 0 Zeilen). Rein kosmetisch, kein Daten-Konflikt. → `gsw` aus source_lang + target_lang CHECK entfernen. Einziger sauber-autofixbarer Backend-Befund.
- **[ENTSCHEIDUNG] `organizations.subscription_tier` CHECK erlaubt gestrichene v28-Tiers** (school_basic/school_pro/botanical_garden, 0 Zeilen). → auf `['free']` verengen sobald Org-Onboarding-Code (v28.08) gegengeprüft.
- **[ENTSCHEIDUNG] `gs_abo_can_use(p_user_id,...)` vertraut Caller-UID statt auth.uid()** — 1-bit Info-Leak (ist fremder User Pro?), kein Schreibzugriff. → intern `auth.uid()` erzwingen. Payment-nah → Review.
- **[ENTSCHEIDUNG] `fn_mkt_increment_views` anon-schreibbar ohne Guard** — View-Count-Inflation beliebig hochzählbar. Kein Leak/Payment. → Rate-Limit oder 1×/Session-Counter.
- **[ENTSCHEIDUNG] 82× `authenticated_security_definer_function_executable`** — false-positive: sensible Fälle (fn_admin_*, fn_get_global_api_key) intern via `is_admin_user()`/`auth.uid()` gegated, verifiziert. → kein Fix nötig, optional REVOKE bei reinen Trigger-Helfern.
- **[ENTSCHEIDUNG] 13× `anon_security_definer_function_executable`** — meist gewollte Public-Reads (Knowledge/Quiz/Marketplace-Search). Nur `fn_quiz_record_answer` (No-Op bei anon, verifiziert) + `fn_mkt_increment_views` (siehe oben) sind Writes. → keine Aktion außer increment_views.
- **[ENTSCHEIDUNG] 192× `unused_index`** (inkl. profiles 5×, stripe_subscriptions) — wahrscheinlich Statistik-Artefakt (junge DB). NICHT droppen ohne `pg_stat_user_indexes`-Verlauf über Wochen, payment-nah Review-pflichtig.
- **[ENTSCHEIDUNG] 3× `extension_in_public`** (pg_trgm, vector, citext) — Verschieben kann search_path-abhängige Suche/Indexe brechen. Live-riskant → deferred/Wartungsfenster.
- **[FERNANDO/Browser] Leaked-Password-Protection deaktiviert** — Dashboard-Toggle (Auth → Policies), kein SQL. Bei Live-Payment-App empfohlen.
- **[FERNANDO/Browser] `auth_db_connections_absolute` fix auf 10** — prozentbasiert umstellen (Pooler-Config). Erst bei Hochskalierung relevant.

---

## ✅ Was sauber ist (ehrlich)

- **Aktive Enum-CHECKs konsistent** (scan_events, marketplace_listings.status, mushroom_register, garden_problems mit Umlauten, garden_weather_alerts u.a.): alle distinct-Werte ⊆ CHECK. Kein verbleibendes Pendant zum v28.80-es-Insert-Bug. Negativ-Verifikation bestätigt.
- **Kein einziger exploitbarer Backend-Befund.** Der einzige Advisor-ERROR (v_feedback_public) strippt Emails; alle DEFINER-Fns mit Payment-/Admin-Bezug sind intern autorisiert; alle RLS-no-policy-Tabellen sind Default-Deny.
- **`localStorage.setItem` global try/catch-gewrappt** (HL#10-Primärrisiko entschärft, nur Feedback fehlt).

---

## 📋 Empfohlene Umsetzungs-Reihenfolge

1. **Sprint A — Frontend Live-Bugs (1 Commit, rein [AUTO], höchster Hebel):**
   - GPX-Recovery `confirm()` → `gsConfirmModal` (Boot-Crash-Risiko, zuerst)
   - Tote-Keys-Fix gs_scan_count/gs_favorites + gs_profile/gs_profile_name (sichtbare Falschanzeigen)
   - **Bündeln**, da alle index.html, alle [AUTO], gleiche Test-Oberfläche.

2. **Sprint B — HL#2/#10 Dialog- & Storage-Härtung (1 Commit, [AUTO], analog v28.31-Sweep):**
   - Sensor-confirm + Cache-Modal-confirm + PW-Reset-prompt → Modal-API
   - prompt()-Sweep der ~8 LOW-Stellen
   - Quota-`gsToast` im LS-Wrapper
   - gsIsAdmin-Stub raus, Chat-WS-unsubscribe-Hook, _gsAutoSyncInterval-Clear, toter analytics/voucher-Code raus.

3. **Sprint C — i18n-Coverage (1 Commit, [AUTO], Fortsetzung v28.42-56-Mega-Sprint):**
   - Lehrer/Klassen + Organisationen + Sammlungen (HIGH) → dann Community-Profil + Verkäufer-Screen (MEDIUM)
   - **Bündeln** in einen i18n-Key-Block, EN/ES-Map in einem Rutsch ergänzen.

4. **Sprint D — Backend (Migration + Review, [ENTSCHEIDUNG], NICHT auf Live blind):**
   - Schnell + safe: `gsw` aus i18n_translations-CHECK raus.
   - Erst nach Code-Grep: `profiles.tier`- + `organizations.subscription_tier`-CHECK verengen (Webhook/Onboarding prüfen).
   - `v_feedback_public` → security_invoker (mit feedback_items-RLS-Check).
   - `gs_abo_can_use` + `fn_mkt_increment_views` Body-Hardening.
   - Storage-Bucket-Listing-Policies (pro Bucket Frontend-list()-Check).
   - **Deferred:** multiple_permissive merge, unused_index, extensions_in_public — erst nach Traffic-Daten/Wartungsfenster.

5. **Fernando-Manual (Dashboard, parallel jederzeit):** Leaked-Password-Protection an, Auth-Connections prozentbasiert.

**Bündel-Regel:** Sprint A+B+C sind alle index.html-only und [AUTO] → können theoretisch in einem v-Bump zusammengefasst werden, sollten aber für sauberes Rollback in 3 Commits getrennt bleiben. Sprint D braucht je eigene Migration + Verifikation und gehört NICHT in denselben Bump wie Frontend.

## Alle verifizierten Befunde (Roh)

### [MEDIUM DEC] ERROR: SECURITY DEFINER View v_feedback_public (umgeht RLS auf feedback_items)
- **Bereich:** security advisor / view public.v_feedback_public
- **Evidenz:** get_advisors(security) → 1× [ERROR] security_definer_view: detail="View `public.v_feedback_public` is defined with the SECURITY DEFINER property". Verifiziert via execute_sql: relacl = `anon=arwdDxtm/postgres | authenticated=arwdDxtm/postgres`. View-Body: `SELECT id, content, kind, ... context - 'author_email' AS context, CASE WHEN context->>'author_email' <> '' THEN left(split_part(...,'@',1),14)
- **Fix:** View mit `security_invoker=on` neu anlegen: CREATE OR REPLACE VIEW public.v_feedback_public WITH (security_invoker=on) AS <gleicher Body>; danach RLS-Policy auf feedback_items prüfen, dass der gewünschte Public-Read weiter klappt. Lint-Ref: lint=0010_security_definer_view. Keine Payment-Tabelle betr

### [LOW DEC] 82× authenticated_security_definer_function_executable — Admin/Payment-Funktionen aber server-seitig durch is_admin_user() gewappt (Advisor-WARN ist exploit-mässig false-positive)
- **Bereich:** security advisor / 82 public.fn_* SECURITY DEFINER functions
- **Evidenz:** get_advisors(security) → 82× [WARN] authenticated_security_definer_function_executable. Betrifft u.a. fn_admin_stripe_overview, fn_admin_metrics, fn_get_global_api_key, fn_add_xp, fn_class_create. Per execute_sql VERIFIZIERT dass die sensiblen Fälle intern gaten: fn_admin_stripe_overview() Body = `IF NOT public.is_admin_user() THEN RAISE EXCEPTION 'forbidden' USING errcode='42501'; END IF;` (liest
- **Fix:** Kein dringender Fix nötig — Funktionen sind absichtlich SECURITY DEFINER + intern autorisiert. Optional Lärm reduzieren: bei rein-internen/Trigger-Helfern `REVOKE EXECUTE ... FROM authenticated;`. NICHT bei fn_admin_*/payment-relevanten ändern ohne Frontend-Call-Review (RPC-Pfade /rest/v1/rpc/* sind

### [LOW DEC] 13× anon_security_definer_function_executable — anon-aufrufbare RPCs (read-only Public-Daten, vertretbar; einzeln prüfen)
- **Bereich:** security advisor / 13 public.fn_* mit anon EXECUTE
- **Evidenz:** get_advisors(security) → 13× [WARN] anon_security_definer_function_executable: fn_get_daily_quiz, fn_knowledge_recent, fn_knowledge_related, fn_knowledge_search, fn_knowledge_search2, fn_marketplace_search, fn_mkt_increment_views, fn_org_directory, fn_quiz_leaderboard_my_rank, fn_quiz_leaderboard_top, fn_quiz_record_answer, has_feature, launch_offer_available. detail-Beispiel: "Function `public.fn
- **Fix:** Pro Funktion entscheiden: bei reinen Public-Read-RPCs (Knowledge/Quiz-Anzeige/Marketplace-Search) anon-EXECUTE belassen. fn_quiz_record_answer + fn_mkt_increment_views (Schreib-RPCs) auf anon-Missbrauch prüfen; falls Login-Pflicht gewünscht: `REVOKE EXECUTE ... FROM anon;`. Lint=0028. Keine Payment-

### [MEDIUM DEC] 4× rls_enabled_no_policy + zu breite anon/authenticated Table-GRANTs (RLS=on aber 0 Policies → Deny-All, nicht exploitbar)
- **Bereich:** security advisor / public.book_ocr_pages, species_import_queue, species_search_cache, weather_forecast_cache
- **Evidenz:** get_advisors(security) → 4× [INFO] rls_enabled_no_policy auf den 4 Tabellen. execute_sql information_schema.role_table_grants VERIFIZIERT: jede der 4 Tabellen hat für anon UND authenticated FULL Grants `INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER`. Aktuell blockiert RLS=on + 0 Policies jeden anon/auth-Zugriff (Default-Deny), daher NICHT exploitbar. Aber: die pauschalen Table-Grants sin
- **Fix:** Entweder gezielte minimale RLS-Policies anlegen (z.B. service_role-only, oder SELECT-only für authenticated bei species_search_cache) ODER überbreite Grants zurücknehmen: `REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.<tbl> FROM anon, authenticated;`. Da kleine Cache/Queue-Tabellen ohne Payment-Bez

### [LOW DEC] 8× public_bucket_allows_listing — öffentliche Storage-Buckets erlauben anon Objekt-Listing
- **Bereich:** security advisor / Storage buckets
- **Evidenz:** get_advisors(security) → 8× [WARN] public_bucket_allows_listing für Buckets: avatars, garden-photos, map-find-photos, marketplace-photos, post-images, recipe-photos, scan-images, species-images. Public-Buckets liefern Objekt-URLs öffentlich (gewollt für PWA-Bilder), aber das Listing erlaubt anon das Enumerieren aller Objekt-Keys (Privacy: z.B. fremde garden-photos/scan-images erratbar/auflistbar).
- **Fix:** Wenn nur direkte URL-Reads gewünscht sind: Bucket-Policy so anpassen dass `storage.objects` SELECT (Listing) für anon entzogen wird, einzelne Reads über signierte/Public-URLs belassen. Keine Payment-Daten, aber User-Foto-Privacy → vor Änderung prüfen ob das Frontend ein Listing-API nutzt (gallery-Vi

### [LOW DEC] 3× extension_in_public — pg_trgm, vector, citext im public-Schema
- **Bereich:** security advisor / Extensions
- **Evidenz:** get_advisors(security) → 3× [WARN] extension_in_public: pg_trgm, vector, citext liegen im public-Schema statt in dediziertem extensions-Schema.
- **Fix:** Best-Practice: nach `extensions`-Schema verschieben (`ALTER EXTENSION ... SET SCHEMA extensions`). ABER pg_trgm wird aktiv von fn_knowledge_search/species-search genutzt und vector ggf. von Embeddings — Verschieben kann search_path-abhängige Funktionen/Indexe brechen. Auf Live-DB riskant, deshalb NI

### [LOW DEC] WARN: Leaked Password Protection deaktiviert (HaveIBeenPwned-Check aus)
- **Bereich:** security advisor / Auth-Config
- **Evidenz:** get_advisors(security) → 1× [WARN] auth_leaked_password_protection: "Supabase Auth prevents the use of compromised passwords by checking against HaveIBeenPwned.org. Enable this feature to enhance security."
- **Fix:** Im Supabase Dashboard → Authentication → Policies → 'Leaked password protection' aktivieren. Reine Dashboard-Einstellung, kein SQL, keine Datenänderung — Fernando-Manual (kein DB-Autofix möglich via MCP).

### [MEDIUM DEC] 75× multiple_permissive_policies — überlappende Admin- + Public-Policies pro Aktion (Skalierungs-Perf, schwerpunkt social_posts/post_comments)
- **Bereich:** performance advisor / RLS-Policies auf 15 Tabellen
- **Evidenz:** get_advisors(performance) → 75× [WARN] multiple_permissive_policies. Verteilung (execute_sql/jq): social_posts 20×, post_comments 15×, je 5× species_sources, species_images, quiz_leaderboard, quests, plant_3d_models, feature_limits, app_settings; je 1× remedies, recipes, garden_techniques, folk_lore, book_ingest_jobs. Muster (detail): z.B. social_posts hat pro Rolle+Aktion 2 permissive Policies, e
- **Fix:** Pro Tabelle die Admin-`*_moderate`-Policy in die jeweilige Funktions-Policy mergen via OR-Bedingung (z.B. `USING (user_id = (SELECT auth.uid()) OR public.is_admin_user())`) statt zwei getrennter permissiver Policies → halbiert die Policy-Auswertungen. KEIN Autofix: social_posts/post_comments sind us

### [LOW DEC] 192× unused_index — nie genutzte Indexe (Write-Overhead + Storage), inkl. profiles/stripe_subscriptions
- **Bereich:** performance advisor / Indexe auf ~50 Tabellen
- **Evidenz:** get_advisors(performance) → 192× [INFO] unused_index. Top-Tabellen (jq): marketplace_listings 10×, profiles 5× (idx_profiles_role, idx_profiles_tier, idx_profiles_xp, idx_profiles_role_assigned_by, idx_profiles_quiz_elo), plant_doctor_history 4×, org_invites 4×, map_user_finds 4×, garden_harvests 4×, garden_diary 4×. Payment-nah: idx_marketplace_sellers_stripe, idx_stripe_subs_price auf stripe_sub
- **Fix:** 'unused' kann Statistik-Artefakt sein (Index erst kürzlich erstellt / nur bei seltenen Admin-Queries genutzt). Vor DROP pg_stat_user_indexes idx_scan über längeren Zeitraum prüfen. Harmlose kleine Tabellen-Indexe (z.B. quiz/garden_diary) sind DROP-bar; idx_stripe_subs_price/idx_profiles_* NICHT drop

### [LOW DEC] INFO: auth_db_connections_absolute — Auth-Server fix auf 10 Connections (skaliert nicht mit Instanz-Grösse)
- **Bereich:** performance advisor / Auth-Pooler-Config
- **Evidenz:** get_advisors(performance) → 1× [INFO] auth_db_connections_absolute: "Your project's Auth server is configured to use at most 10 connections. Increasing the instance size without manually adjusting this number will not improve the performance of the Auth server. Switch to a percentage based connection allocation strategy instead."
- **Fix:** Auf prozentbasierte Connection-Allocation umstellen (Supabase Dashboard / Pooler-Config). Reine Infra-Config, kein SQL — Fernando-Manual. Erst relevant wenn Instanz hochskaliert wird; aktuell unkritisch.

### [LOW AUTO] i18n_translations CHECK enthält totes 'gsw' (Schwiizerdütsch) – obsolet seit v26.65
- **Bereich:** i18n_translations (source_lang + target_lang CHECK-Constraints)
- **Evidenz:** CHECK-def beider Spalten: i18n_translations_source_lang_check / _target_lang_check = CHECK (lang = ANY (ARRAY['de','fr','it','en','es','gsw'])). Distinct-Werte real: target_lang = {it:1257, fr:1257, es:1190, en:1190}, source_lang = {de:4894}. 'gsw' kommt in 0 Zeilen vor. CLAUDE.md (v26.65): "Schwiizerdütsch raus, Englisch + Spanisch rein". 'es' ist bereits korrekt im CHECK (der v28.80-Bug ist beho
- **Fix:** 'gsw' aus beiden CHECK-Constraints entfernen (source_lang + target_lang): DROP + ADD CONSTRAINT mit ARRAY['de','fr','it','en','es']. Da 0 Zeilen 'gsw' nutzen, kein Daten-Konflikt. Optional belassen (rein kosmetisch / tote Erlaubnis, kein funktionaler Schaden).

### [MEDIUM DEC] profiles.tier CHECK erlaubt obsolete Tiers 'plus','premium','basic' – widerspricht der 3-Tier-Mission
- **Bereich:** profiles (tier-CHECK-Constraint, PAYMENT-RELEVANT)
- **Evidenz:** CHECK-def: profiles_tier_check = CHECK (tier = ANY (ARRAY['free','plus','pro','lifetime','premium','basic'])). Distinct-Werte real: tier = {free:10, pro:1}. 'plus','premium','basic' in 0 Zeilen. CLAUDE.md-Mission (03.06.2026, verbindlich): "3 Tiers aktiv: Free + Pro + Lifetime (Fernando bestätigt — Plus existiert NICHT mehr)". Der CHECK erlaubt also weiterhin 'plus' (gestrichen) sowie 'premium'/'b
- **Fix:** CHECK auf ARRAY['free','pro','lifetime'] verengen. ACHTUNG: zuerst prüfen ob Stripe-Webhook/Bootstrap-Edge-Fns oder Frontend irgendwo 'plus'/'premium'/'basic' schreiben (grep stripe-webhook v11 + index.html), SONST schlagen legitime Inserts/Updates fehl. Erst Code-Migration sicherstellen, dann CHECK

### [LOW DEC] organizations.subscription_tier CHECK erlaubt gestrichene v28-Tiers (school_basic/school_pro/botanical_garden)
- **Bereich:** organizations (subscription_tier-CHECK-Constraint)
- **Evidenz:** CHECK-def: organizations_subscription_tier_check = CHECK (subscription_tier = ANY (ARRAY['free','school_basic','school_pro','botanical_garden'])). Distinct-Werte real: subscription_tier = {free:1}. school_basic/school_pro/botanical_garden in 0 Zeilen. CLAUDE.md-Mission, Sektion 'Nein zu': "KEINE NEUEN Bezahl-Tiers (school_basic, school_pro, botanical_garden, personal_plus — alle gestrichen aus v28
- **Fix:** subscription_tier-CHECK auf ARRAY['free'] (bzw. künftig vorgesehene Org-Tiers) verengen, sobald bestätigt ist, dass kein Org-Onboarding-Code (v28.08 Whitelabel) diese Werte schreibt. Da nur 1 Zeile (free), niedriges Risiko, aber Org-Subscription-Pfad zuerst gegen-greppen.

### [LOW AUTO] Kein aktiver Enum-Insert-Bruch gefunden — alle übrigen genutzten CHECK-Enums konsistent
- **Bereich:** scan_events, marketplace_listings, user_collection_items, garden_weather_alerts, weather_alerts, mushroom_register, garden_problems, garden_visitors_animals, ai_queries, social_posts, quiz_battles, push_send_log, expert_verifications, marketplace_sellers
- **Evidenz:** Für alle operativ aktiven Enum-Spalten: distinct-Werte ⊆ CHECK-erlaubte Werte. Beispiele: marketplace_listings.status {archived:7, active:1} ⊆ {active,sold,reserved,archived,reported}; garden_weather_alerts.alert_type alle 10 Werte ⊆ CHECK; mushroom_register.edibility {speisepilz,giftig,toedlich,bedingt_essbar,speisepilz_jung} ⊆ 8er-Set; vapko_klasse {1..5} ⊆ CHECK. Non-ASCII-Werte werden korrekt 
- **Fix:** Keine Aktion nötig. Befund dokumentiert die Negativ-Verifikation (kein stiller Insert-Bruch durch unvollständige CHECK-Sets in den geprüften aktiven Tabellen).

### [MEDIUM DEC] SECURITY DEFINER View v_feedback_public umgeht RLS und ist anon-lesbar (Advisor-ERROR)
- **Bereich:** DB View / public.v_feedback_public (Advisor security: security_definer_view, level=ERROR)
- **Evidenz:** Advisor liefert genau 1 ERROR: name=security_definer_view, detail="View `public.v_feedback_public` is defined with the SECURITY DEFINER property". pg_get_viewdef bestätigt: SELECT id, content, kind, ... ,context - 'author_email' AS context, CASE WHEN context->>'author_email' <> '' THEN left(split_part(...,'@',1),14) ELSE NULL END AS author_nick FROM feedback_items fi;  select_grantees = 'anon, aut
- **Fix:** View auf security_invoker umstellen: ALTER VIEW public.v_feedback_public SET (security_invoker = true); ABER vorher sicherstellen, dass feedback_items eine RLS-Policy hat, die anon genau die öffentlich gewollten Zeilen (z.B. WHERE is_public/visible) SELECTen lässt — sonst zeigt die öffentliche Feedb

### [LOW DEC] 13 anon-EXECUTE DEFINER-Fns — Lese-Endpoints gewollt, aber fn_mkt_increment_views erlaubt anon UPDATE-Counter (geringer Abuse-Vektor)
- **Bereich:** Advisor anon_security_definer_function_executable (13 Fns) + pg_get_functiondef fn_mkt_increment_views / fn_quiz_record_answer
- **Evidenz:** Advisor listet 13 anon-aufrufbare DEFINER-Fns: fn_get_daily_quiz, fn_knowledge_recent/related/search/search2, fn_marketplace_search, fn_org_directory, fn_quiz_leaderboard_top/my_rank, has_feature, launch_offer_available — alles Lese-Endpoints für Logged-out-Besucher (gewollt). ABER: fn_quiz_record_answer und fn_mkt_increment_views sind WRITES und anon-grantbar. fn_quiz_record_answer ist abgesicher
- **Fix:** View-Count-Inflation drosseln: entweder Rate-Limit via vorhandene fn_check_rate_limit pro Listing/IP, oder Counter nur 1×/Session/Tag erhöhen (z.B. INSERT in eine listing_view_log mit ON CONFLICT DO NOTHING (listing_id, viewer_fingerprint, date) und Zähler nur bei neuem Insert). marketplace_listings

### [LOW DEC] gs_abo_can_use vertraut caller-übergebenem p_user_id statt auth.uid() (read-only Entitlement-Boolean)
- **Bereich:** pg_get_functiondef public.gs_abo_can_use(p_user_id uuid, feature text)
- **Evidenz:** Body: 'SELECT abo_status, abo_trial_end, abo_period_end INTO prof FROM profiles WHERE id = p_user_id;' — die Funktion liest die Abo-Felder des per Parameter übergebenen p_user_id, NICHT von (select auth.uid()). EXECUTE-Grant='authenticated, postgres, service_role' (kein anon). Rückgabe ist nur boolean (darf-Feature-nutzen), keine Roh-Abo-Daten. Ein authentifizierter User könnte gs_abo_can_use(frem
- **Fix:** p_user_id-Parameter ignorieren und intern (SELECT auth.uid()) verwenden, oder am Funktionsanfang erzwingen: 'IF p_user_id <> (SELECT auth.uid()) AND NOT public.is_admin_user() THEN RAISE EXCEPTION ''forbidden''; END IF;'. profiles ist payment-relevante Tabelle → nur Function-Body-Logik ändern (kein 

### [LOW DEC] 4 Tabellen mit RLS aktiv aber 0 Policies (Cache/Queue) — Client-Reads liefern still leer
- **Bereich:** RLS-Abdeckung / public.book_ocr_pages, species_import_queue, species_search_cache, weather_forecast_cache
- **Evidenz:** get_advisors(security) lint 'rls_enabled_no_policy' listet exakt diese 4 Tabellen: "Table public.species_search_cache has RLS enabled, but no policies exist" (+ book_ocr_pages, species_import_queue, weather_forecast_cache). SQL-Beweis: pg_class-Query zeigt relrowsecurity=true, policy_count=0 für alle 4. information_schema.role_table_grants: anon UND authenticated haben SELECT/INSERT/UPDATE/DELETE-
- **Fix:** Bestätigen dass diese 4 Tabellen ausschliesslich server-seitig (Edge-Fn/service_role) gelesen/geschrieben werden — dann ist der Zustand korrekt und sollte mit COMMENT ON TABLE dokumentiert werden ('service_role only, RLS intentional default-deny'). Falls ein Client jemals lesen soll: explizite SELEC

### [LOW DEC] multiple_permissive_policies: social_posts + post_comments — überlappende _moderate(ALL)-Policy verdoppelt jede Aktion
- **Bereich:** Performance / RLS-Policies public.social_posts (20 Lints), public.post_comments (15 Lints)
- **Evidenz:** get_advisors(performance): 75× 'multiple_permissive_policies', Hotspots social_posts=20, post_comments=15. pg_policies-Beweis: social_posts hat 'social_posts_moderate' (cmd=ALL, roles={public}, qual=fn_role_at_least('staff')) UND zusätzlich social_posts_select_all/insert_auth/update_own/delete_own — alle auf roles={public}. Da die ALL-Policy für JEDE Aktion (SELECT/INSERT/UPDATE/DELETE) zusätzlich
- **Fix:** Die _moderate(ALL)-Policy in eine restriktive Policy oder in role-spezifische separate Policies aufteilen statt als permissive ALL über {public}: z.B. moderate nur für UPDATE/DELETE (wo Staff fremde Posts ändern darf), nicht für SELECT/INSERT. Oder fn_role_at_least('staff') als zusätzliche OR-Beding

### [MEDIUM DEC] 8 Public-Storage-Buckets erlauben Listing (broad SELECT auf storage.objects)
- **Bereich:** Security / storage.objects-Policies (avatars, scan-images, species-images, recipe-photos, post-images, marketplace-photos, map-find-photos, garden-photos)
- **Evidenz:** get_advisors(security) 8× WARN 'public_bucket_allows_listing', z.B.: "Public bucket scan-images has 1 broad SELECT policy on storage.objects (scan-images public read), allowing clients to list all files. Public buckets don't need this for object URL access and it may expose more data than intended." Public-Bucket-URL-Zugriff funktioniert auch ohne SELECT-Policy — die breite Policy erlaubt jedem Cl
- **Fix:** Die broad SELECT-Policies auf storage.objects für diese Buckets entfernen — Public-Buckets liefern Objekt-URLs auch ohne list()-Recht. Pro Bucket prüfen ob Frontend list() nutzt (z.B. Galerie-Ansicht); falls ja, list() auf owner-eigene Pfade (foldername = auth.uid()) einschränken statt global true. 

### [LOW DEC] Auth: Leaked-Password-Protection (HaveIBeenPwned) deaktiviert
- **Bereich:** Security / Supabase Auth-Config
- **Evidenz:** get_advisors(security) WARN 'auth_leaked_password_protection' (1×): Schutz gegen kompromittierte Passwörter via HaveIBeenPwned ist aus. Bei einer Live-Payment-App (Stripe-Kunden mit Accounts) erhöht das das Risiko von Account-Takeover über wiederverwendete geleakte Passwörter.
- **Fix:** Im Supabase-Dashboard unter Authentication > Policies 'Leaked password protection' aktivieren (Fernando-Manual, 1 Klick). Reine Config-Änderung, kein DB-Eingriff, kein Payment-Risiko — aber Dashboard-only, nicht via SQL/MCP fixbar.

### [LOW DEC] 3 Extensions im public-Schema (vector, pg_trgm, citext)
- **Bereich:** Security / Extensions
- **Evidenz:** get_advisors(security) 3× WARN 'extension_in_public': "Extension vector is installed in the public schema. Move it to another schema." — ebenso pg_trgm und citext. Extensions im public-Schema können Namens-/Sicherheits-Konflikte mit User-Objekten verursachen.
- **Fix:** Extensions in dediziertes 'extensions'-Schema verschieben (ALTER EXTENSION ... SET SCHEMA extensions). ACHTUNG: vector + pg_trgm werden aktiv von Code genutzt (species_embeddings, pg_trgm-Fuzzy-Suche aus v26.88) — ein Schema-Wechsel kann Funktionsaufrufe/Indexe brechen und search_path-Anpassungen er

### [LOW DEC] 192 ungenutzte Indexe (unused_index) — Schreib-Overhead, payment-Tabellen betroffen
- **Bereich:** Performance / diverse (marketplace_listings 10, profiles 5, plant_doctor_history 4, map_user_finds 4, garden_harvests 4, garden_diary 4, ...)
- **Evidenz:** get_advisors(performance) 192× 'unused_index', z.B. "Index idx_sensor_devices_token on table public.sensor_devices has not been used". Verteilung u.a. marketplace_listings=10, profiles=5, plant_doctor_history=4, map_user_finds=4. Jeder Index kostet Write-Amplification bei INSERT/UPDATE. Da DB jung + low-traffic ist, kann 'unused' aber heissen 'noch nie getroffen' statt 'nie nötig' — viele wurden i
- **Fix:** NICHT pauschal droppen — viele Indexe sind für erwartetes Wachstum vorgesehen (z.B. FK-Index-Abdeckung, FTS, pg_trgm). Erst nach echtem Traffic (mehrere Wochen produktive Nutzung) erneut prüfen und nur klar redundante Duplikate entfernen. profiles + marketplace_listings sind community/payment-nah → 

### [LOW AUTO] gsIsAdmin doppelt als globale function-Declaration definiert (Stub return false + echte Definition) — HL#9-Muster, aktuell unschädlich aber fragil
- **Bereich:** index.html Auth/Admin-Rolle (Z.61670 + Z.68948)
- **Evidenz:** Zwei top-level `function gsIsAdmin(...)` im selben Script-Scope:
Z.61670: `function gsIsAdmin(email){ return false; /* siehe v24.46 konsolidierte Definition unten */ }`
Z.68948: `function gsIsAdmin(email) { try { if (email) { return Array.isArray(window.GS_ADMINS) && GS_ADMINS.includes((email||'').toLowerCase()); } if (gsGetUserRole() === 'admin') return true; var em = (gsStore.get('gs_sb_email', 
- **Fix:** Den toten Stub Z.61670 ersatzlos entfernen (Single-Source-of-Truth wie im Kommentar v24.46 angestrebt). Da gsIsAdmin nur aus anderen Funktionen heraus aufgerufen wird — nie auf Top-Level vor Z.68948 — ist die Forward-Declaration nicht nötig. Falls Vorsicht gewünscht: Stub durch ein `// gsIsAdmin: si

### [LOW AUTO] Marktplatz-Realtime-Chat WebSocket: unsubscribe nur über 5s-Polling-Tick, nicht direkt an closeModal gekoppelt
- **Bereich:** index.html Marktplatz-Chat v28.17 (Z.33038-33054, 33139-33192)
- **Evidenz:** WS-Subscribe in _gsChatStartThread Z.33050: `if (window._gsRealtimeChat) window._gsRealtimeChat.subscribe(listingId, buyerId, ...)`. Der einzige unsubscribe()-Aufruf hängt INNERHALB des 5s-Poll-Callbacks Z.33042-33043: `try { clearInterval(window._gsChat.pollId); }... try { if (window._gsRealtimeChat) window._gsRealtimeChat.unsubscribe(); }` — er feuert erst beim NÄCHSTEN Poll-Tick (bis zu 5s NACH
- **Fix:** In der closeModal-Funktion (bzw. dem closeModal-Hook für 'modal-market-chat', analog zur 3D-Dispose-Hook bei 'modal-ar') direkt `try { if (window._gsRealtimeChat) window._gsRealtimeChat.unsubscribe(); } catch(_){}` plus `try { clearInterval(window._gsChat && window._gsChat.pollId); } catch(_){}` auf

### [LOW AUTO] _gsAutoSyncInterval: kein clearInterval-Pfad (nur durch Setup-Guard vor Doppel-Start geschützt)
- **Bereich:** index.html Auto-Sync v27.01 (Z.67359-67364)
- **Evidenz:** Z.67360 `function _gsSnapshotSetupAutoSync(){ if (window._gsAutoSyncSetup) return; window._gsAutoSyncSetup = true; ... window._gsAutoSyncInterval = setInterval(function(){...}, ...)`. grep über die gesamte Datei nach `_gsAutoSyncInterval` liefert NUR die eine Set-Zeile 67364 — es existiert NIRGENDS ein `clearInterval(window._gsAutoSyncInterval)`. Im Gegensatz zu allen anderen window-Global-Interva
- **Fix:** Konsistenz zum Rest herstellen: vor setInterval `if (window._gsAutoSyncInterval) clearInterval(window._gsAutoSyncInterval);` ergänzen und einen expliziten Stop-Pfad (z.B. bei Logout) `clearInterval(window._gsAutoSyncInterval); window._gsAutoSyncInterval=null; window._gsAutoSyncSetup=false;` vorsehen

### [HIGH AUTO] HL#2: Natives confirm() in GPX-Track-Recovery feuert automatisch beim App-Boot (iOS-PWA-Webview-Blocker)
- **Bereich:** GPS-Track-Recovery / index.html ~Z.43153 (Funktion _gsCheckTrackRecovery, IIFE)
- **Evidenz:** Z.43153: `if (!confirm('🎯 Letzter Track wurde unterbrochen (' + data.points.length + ' Punkte, vor ' + Math.round(age/60000) + ' min). Als beendet speichern?')) {`. Kein gsConfirmModal-Guard davor (anders als z.B. gsTbDelete Z.7536). Live-Path bestätigt: Z.43170 `document.addEventListener('DOMContentLoaded', _gsCheckTrackRecovery);` bzw. Z.43172 `setTimeout(_gsCheckTrackRecovery, 2000);` — die II
- **Fix:** confirm() durch `await gsConfirmModal({...})` ersetzen mit typeof-Guard wie in gsTbDelete (Z.7536). Da die Recovery in einem setTimeout-Callback läuft, Callback async machen oder gsConfirmModal().then(...) nutzen.

### [MEDIUM AUTO] HL#2: Natives confirm() im Sensor-Setup-Fallback (Web-Bluetooth-iOS-Zweig)
- **Bereich:** Live-Sensor-Anbindung / index.html ~Z.55234 (Web-Bluetooth-iOS-Fallback)
- **Evidenz:** Z.55234: `if (confirm(setupHtml)) {` — setupHtml ist ein mehrzeiliger Text (Z.55225-55233) der im nativen confirm-Dialog gezeigt wird. Kein gsConfirmModal-Guard. Erreicht im `if (!gsDevBtSupported())`-Zweig (Z.55223) — also genau auf iOS/Safari, wo Web-Bluetooth fehlt und der native Dialog das PWA-Webview blockiert (Hard-Lesson #2). Bei Klick öffnet es openDevicesModal (Z.55237).
- **Fix:** confirm(setupHtml) durch `await gsConfirmModal({title:'Live-Sensoren anbinden', message: setupHtml, ok:'Sensor-Setup öffnen', cancel:'Abbrechen'})` ersetzen (umgebende Funktion ist bereits async-fähig prüfen). Langer Text gehört ohnehin besser in ein In-App-Modal.

### [MEDIUM AUTO] HL#2: Natives confirm() in onclick-Attribut des Speicher/Cache-Modals
- **Bereich:** Speicher-Verwaltung-Modal / index.html Z.63967 (gsShowStorageModal)
- **Evidenz:** Z.63967: `'<button onclick="if(confirm(\'Cache wirklich leeren? Du brauchst danach kurz Internet zum Reload.\')){window.gsClearAllCaches().then(...)}" ...>🗑️ Cache komplett leeren</button>'`. Kein gsConfirmModal. Live-Path bestätigt: gsShowStorageModal ist über Menü-Item Z.5562 (`onclick="window.gsShowStorageModal && window.gsShowStorageModal()"`) und Command-Palette Z.64193 (kw 'speicher cache s
- **Fix:** Inline-confirm() im onclick durch eine benannte Handler-Funktion ersetzen die gsConfirmModal nutzt (z.B. `onclick="gsClearCachesConfirm()"` + Funktion mit `await gsConfirmModal(...)`). Inline-JS im onclick mit nativem confirm ist doppelt problematisch.

### [MEDIUM AUTO] HL#2-Familie: Natives prompt() im Passwort-Reset-Flow (auth-kritisch, feuert per setTimeout beim Boot)
- **Bereich:** Auth / Passwort-Reset / index.html Z.62078
- **Evidenz:** Z.62078: `var newPw = prompt('🔑 Neues Passwort setzen (min. 8 Zeichen):');` in einem `setTimeout(function(){...})` (Z.62077) der nach Erkennen des Reset-Tokens im URL-Hash läuft (Z.62072-62075 parsen `expires_in` + setzen gs_sb_token). Laut CLAUDE.md ist PW-Reset-Redirect `?pw_reset=1` ein aktiver Auth-Flow. Natives prompt() blockiert iOS-PWA-Webview genauso wie alert/confirm (Hard-Lesson #2) — u
- **Fix:** prompt() durch gsPromptModal (existiert laut v28.29) ersetzen: `var newPw = await gsPromptModal({title:'Neues Passwort', ...})`. setTimeout-Callback entsprechend async.

### [LOW AUTO] HL#2-Familie: Natives prompt() für Community-Namen-Eingabe
- **Bereich:** Community / index.html Z.41711 (showNameInput)
- **Evidenz:** Z.41711: `const name = prompt('Dein Name in der Community:', socialUserName || '');` ohne gsPromptModal-Guard, in der Live-Funktion showNameInput (Z.41710). Ergebnis wird Z.41714 in `gs_social_name` gespeichert. Natives prompt() blockiert iOS-PWA-Webview (Hard-Lesson #2). Weitere gleichartige native prompt()-Stellen in Live-Pfaden: Z.24030 (Scan-Korrektur), Z.28181 (Todesursache), Z.47021 (Garten-
- **Fix:** prompt() durch gsPromptModal ersetzen (Promise-API, iOS-PWA-safe). Gilt für alle aufgezählten Stellen — ein eigener kleiner Sweep analog v28.31 (confirm-Sweep).

### [LOW AUTO] HL#10: localStorage.setItem global try/catch-gewrappt — aber QuotaExceeded ohne user-sichtbares Feedback (nur console.warn)
- **Bereich:** Storage-Wrapper / index.html Z.6227-6249 (SAFE localStorage Wrapper)
- **Evidenz:** Z.6234-6240: `localStorage.setItem = function(k, v) { try { return _origSet(k, v); } catch(e) { console.warn('localStorage.setItem quota/fail for "' + k + '":', e.message); return undefined; } };`. Dadurch werfen ALLE bare `localStorage.setItem`-Calls (306 Stellen) nicht mehr — HL#10s 'Funktion bricht ab'-Risiko ist global entschärft. ABER: Bei QuotaExceeded gibt es NUR console.warn, KEIN gsToast/
- **Fix:** Im Wrapper-catch (Z.6236) bei QuotaExceededError ein einmaliges user-sichtbares gsToast triggern (debounced, z.B. 1×/Session): `if (e && /quota/i.test(e.name+e.message) && typeof gsToast==='function') gsToast('Gerätespeicher voll — bitte App-Daten aufräumen', 'warn');`. Kein Datenverlust-Fix, aber s

### [MEDIUM AUTO] Tote LS-Keys gs_scan_count + gs_favorites in Achievement-Hint (live, Home-XP-Bar) — nie geschrieben
- **Bereich:** index.html · gsUpdateXPBar() Achievement-Hint (Z.15894/15895) + gsCheckAchievement() (Z.15742/15743)
- **Evidenz:** grep -n 'gs_scan_count' liefert NUR Reads: 15742 + 15894 (`parseInt(localStorage.getItem('gs_scan_count')||'0')`) + 1 Eintrag in GS_USER_KEYS-Array (66414). KEIN setItem/gsStore.set existiert (Write-Key-Set enthält 'gs_scan_count' nicht). Identisch für gs_favorites: nur 15743 + 15895 (`(localStorage.getItem('gs_favorites')||'').split(',')`) + 66415, KEIN Write. gsUpdateXPBar() ist live (9 Caller: 
- **Fix:** In beiden Blöcken die toten Keys durch echte Quellen ersetzen: `var scans = (function(){try{return JSON.parse(localStorage.getItem(SCAN_HISTORY_KEY||'gs_scan_history')||'[]').length;}catch(_){return 0;}})();` und `var favs = (function(){try{return JSON.parse(localStorage.getItem('ps_favs')||'[]').le

### [MEDIUM AUTO] Tote LS-Keys gs_profile + gs_profile_name — nie geschrieben, brechen Home-Greeting + Marktplatz-Verkäufername
- **Bereich:** index.html · gsUpdateHomeGreeting (Z.18246), gsMarketUser (Z.18652), Quiz-Ranking (Z.15113/15305), Pflanzungs-Prefill (Z.46574), Welcome-Toast (Z.66201)
- **Evidenz:** grep zeigt für gs_profile NUR 3 Reads (15113 `JSON.parse(localStorage.getItem('gs_profile')||'{}')`, 15305, 46574) und für gs_profile_name NUR Reads (18246 `localStorage.getItem('gs_profile_name')||''`, 18652, 66201) + 1 Doku-Zeile. KEIN setItem/gsStore.set für beide Keys existiert. Die tatsächlich geschriebenen Namens-Keys sind gs_sb_display_name (Writes Z.14515/62616/65606) und gs_social_name (W
- **Fix:** Reads auf die kanonischen Keys umstellen: für gs_profile_name → `localStorage.getItem('gs_sb_display_name') || localStorage.getItem('gs_social_name') || ''`. Für gs_profile (Objekt-Reads) entweder ein echtes Profil-Objekt aus sbLoadProfile/profiles-Cache lesen oder die einzelnen vorhandenen Keys (gs

### [LOW DEC] Toter LS-Key gs_user_region in Marktplatz-Sortierung 'nach Ort' — nie geschrieben
- **Bereich:** index.html · Marktplatz-Sort 'near' (Z.18754)
- **Evidenz:** grep 'gs_user_region' liefert exakt 1 Treffer (Z.18754): `var userRegion = localStorage.getItem('gs_user_region') || 'ZH';` — reiner Read, KEIN Write irgendwo. Der real geschriebene Regions-Key heißt gs_region (Write Z.30425 `localStorage.setItem('gs_region', slug)`, Reads Z.17350/29965/30383/30412). Folge: Sortierung 'near' (User-Kanton zuerst) behandelt JEDEN User als Kanton 'ZH' → Nicht-Zürcher
- **Fix:** Z.18754 auf den kanonischen Key umstellen: `var userRegion = localStorage.getItem('gs_region') || localStorage.getItem('gs_user_region') || 'ZH';` (gs_region ist ein Slug — ggf. auf Kanton-Code mappen, da a.region/b.region Kantons-Codes sind; Mapping vorab prüfen).

### [MEDIUM DEC] Toter LS-Key gs_weather_loc_manual — UI-Option 'Manuell' im Wetter-Standort-Picker tut nichts
- **Bereich:** index.html · gsGetLocationFor('weather') (Z.45761) + gsSetWeatherLocMode (Z.45768) + Picker gsOpenWeatherLocPicker (Z.45790)
- **Evidenz:** grep 'gs_weather_loc_manual' liefert exakt 1 Treffer (Z.45761): `if (mode === 'manual') { var m = JSON.parse(localStorage.getItem('gs_weather_loc_manual')||'null'); if (m && m.lat!=null) return ...; return _loc(); }` — reiner Read, KEIN Write existiert. gsSetWeatherLocMode('manual') (Z.45768-45777) schreibt NUR gs_weather_loc_mode='manual' (Z.45770), aber NIE die manuellen Koordinaten gs_weather_l
- **Fix:** Entweder beim Setzen von mode='manual' echte Koordinaten erfassen (Geocode-Prompt → `localStorage.setItem('gs_weather_loc_manual', JSON.stringify({lat,lon,name}))`) — analog dem bereits vorhandenen Pattern für gs_home_weather_loc (Z.45703) — oder die 'Manuell'-Option aus dem Picker (Z.45793) entfern

### [LOW DEC] Toter LS-Key gs_install_declined='forever' — dauerhaftes Ablehnen des Install-Prompts unmöglich
- **Bereich:** index.html · isPermDeclined() (Z.62258)
- **Evidenz:** grep 'gs_install_declined': Z.62258 `function isPermDeclined(){ return localStorage.getItem('gs_install_declined') === 'forever'; }` (Read) und Z.62291 `localStorage.removeItem('gs_install_declined')` (nur Remove im appinstalled-Handler). KEIN setItem('gs_install_declined', ...) existiert; das einzige Literal 'forever' im ganzen File steht in Z.62258 (Vergleich). Folge: isPermDeclined() liefert IM
- **Fix:** Im Decline-Handler des Install-Prompts (bei 'für immer nicht mehr fragen') `localStorage.setItem('gs_install_declined','forever')` setzen — Write-Site fehlt komplett. Falls keine solche UI-Wahl existiert, ist isPermDeclined() toter Code und kann entfernt werden.

### [LOW AUTO] Schema-Mismatch (HL#14): Tabellen analytics_events / vouchers / voucher_redemptions existieren nicht in DB — nur in nie aufgerufenem Code
- **Bereich:** index.html · gsTrackEvent (Z.68854, /rest/v1/analytics_events Z.68862) + gsRedeemVoucher (Z.68879, /rest/v1/vouchers Z.68886 + /rest/v1/voucher_redemptions Z.68893)
- **Evidenz:** information_schema.tables (public, Live-DB vowbiueikwrauuceilhc) enthält KEINE der 3 Tabellen analytics_events / vouchers / voucher_redemptions; auch keine Migration in supabase/migrations/ erzeugt sie (grep leer). Frontend-vs-DB-Diff der /rest/v1/<tabelle>-Calls ergab exakt diese 3 (plus Regex-Artefakt 'i' = i18n_translations, existiert). ABER: `grep 'gsTrackEvent('` und `grep 'gsRedeemVoucher('`
- **Fix:** Entweder die 3 Tabellen per Migration anlegen (mit RLS + REVOKE-Pattern HL#13) BEVOR gsTrackEvent/gsRedeemVoucher verdrahtet werden, oder den toten Code (Z.68854-68902) entfernen. Aktuell harmlos, da unaufgerufen — als Schema-Schuld dokumentieren.

### [LOW DEC] Legacy-Dead-Keys gs_auth_session / gs_auth_db in Admin-Erkennung — nie geschrieben
- **Bereich:** index.html · Admin-Konfiguration IIFE (Z.69462-69477)
- **Evidenz:** grep zeigt gs_auth_session NUR als Read (Z.69467 `localStorage.getItem('gs_auth_session')`) und gs_auth_db NUR als Read (Z.69471 `JSON.parse(localStorage.getItem('gs_auth_db')||'{}')`) — KEINE Writes. Beide stammen aus der pre-Supabase Local-Auth (heutige Auth nutzt gs_sb_* Keys). Folge: der `if (_sess)`-Branch (Z.69466) wird nie betreten → window._gsIsAdmin wird über diesen Pfad nie true. Admin-E
- **Fix:** Die Admin-IIFE (Z.69462-69477) entfernen — sie liest nur nie-geschriebene Legacy-Keys und der hardcodierte atob()-Admin-Email-Vergleich widerspricht zudem der CLAUDE.md-Regel 'kein Hardcoded-Admin-Email, is_admin_user() RPC nutzen'.

### [HIGH AUTO] Lehrer-Dashboard / Klassen (v28.06) komplett ungewrappt — ~55 user-facing DE-Strings
- **Bereich:** Lehrer-Dashboard v28.06 — gsOpenClasses / gsClassJoin / gsClassCreate / gsOpenClassDetail / gsClassAssignmentCreate / gsClassTaskLabel (index.html Z.67890-68062)
- **Evidenz:** 0× _t() im gesamten Block 67890-68062 (verifiziert via awk+grep -c). Beispiele: Z.67903 '🎓 Klassen'; Z.67904 'Klassen deiner Schulen, Kurse & Vereine…'; Z.67906 Empty-State 'Noch keine Klasse. Tritt mit einem Klassen-Code bei…'; Z.67919/67920 Buttons '➕ Beitreten' / '🧑‍🏫 Neue Klasse'; Z.67928 '➕ Klasse beitreten'; Z.67930 placeholder; Z.67997 '➕ Neue Aufgabe'; Z.67998 'Aufgaben'; Z.68002 'Klass
- **Fix:** Alle user-facing Strings durch _t('class_…','DE-fallback') ersetzen (Header, Empty-States, Button-Labels, select-options, Toasts) + gsClassTaskLabel über _t() mappen. Lokale `var _t = (window.gsI18n && gsI18n.t) ? gsI18n.t : function(k,f){return f;};` am Funktionskopf einfügen (wie in gsLinaRender Z

### [HIGH AUTO] Organisationen (v28.01/v28.08) komplett ungewrappt — ~40 user-facing DE-Strings
- **Bereich:** Org-Multi-Tenant v28.01/08 — gsOpenOrgs / gsOrgCreate / gsOrgJoinPrompt / _gsRenderOrgDetail / gsOrgEdit / gsOrgInviteCreate / gsOrgOnboardingDone (index.html Z.67674-67885)
- **Evidenz:** 0× _t() im Block 67674-67885 (verifiziert). Beispiele: Z.67681 '🏢 Organisationen'; Z.67682 'Schule, Kurs, Verein oder Botanischer Garten — getrennt von deinen privaten Daten.'; Z.67683 Empty 'Du bist noch in keiner Organisation.'; Z.67692/67693 Buttons '+ Neue Org' / '🔑 Beitreten (Code)'; Z.67700 '🏢 Neue Organisation'; Z.67704 'Erstellen'; Z.67730 'Gib den 8-stelligen Einladungs-Code ein…'; Z.6
- **Fix:** Alle user-facing Strings in gsOpenOrgs/gsOrgCreate/gsOrgJoinPrompt/_gsRenderOrgDetail/gsOrgEdit/gsOrgInviteCreate/gsOrgOnboardingDone über _t('org_…','DE') wrappen; lokales _t am Funktionskopf einfügen. EN/ES-Keys ergänzen. Org-Typ-Labels (_gsOrgTypeLabel / GS_ORG_TYPES) ebenfalls i18n-fähig machen.

### [HIGH AUTO] Sammlungen-UI (v28.24-28) komplett ungewrappt — ~30 user-facing DE-Strings inkl. System-Sammlungsnamen
- **Bereich:** Sammlungen v28.24-28 — gsOpenCollections / gsCollectionsRefresh / gsOpenCollectionItems / gsAddToCollection / gsCollectionDelete + GS_SYSTEM_COLLECTIONS (index.html Z.6662-7018, 6746-6751, 6834-6932)
- **Evidenz:** 0× _t() in Blöcken 6662-7018 und 6834-6932 (verifiziert). Beispiele: Z.6836 'Meine Sammlungen' + 'Eigene Ordner für Pflanzen, Arten & mehr'; Z.6843 'Melde dich an, um Sammlungen anzulegen.'; Z.6848 placeholder 'Neue Sammlung…'; Z.6849 '+ Anlegen'; Z.6858 '💡 Vorschläge'; Z.6856 Vorschlag-Namen 'Wunschliste'/'Mein Garten 2026'; Z.6871 'N Einträge'; Z.6874 Empty 'Noch keine Sammlungen — lege oben ei
- **Fix:** User-facing Strings via _t('coll_…','DE') wrappen; GS_SYSTEM_COLLECTIONS-name über i18n-Key rendern (Daten-key + _t-Lookup beim Render, nicht hart in der Konstante). Toasts in gsAddSpeciesToCollection/gsAddFindToCollection/gsAddListingToCollection ebenfalls. EN/ES ergänzen.

### [MEDIUM AUTO] Community-Profil & Feed (v27.02/v28.02) ungewrappt — ~25 user-facing DE-Strings
- **Bereich:** Community v27.02/v28.02 — gsOpenProfile / _gsRenderProfile / _gsProfileActionBtns / gsProfileMore / gsOpenCommunity (index.html Z.67421-67620)
- **Evidenz:** 0× _t() und 0× data-i18n im Block 67421-67620 (verifiziert). Beispiele: Z.67441 Fallback 'Natur-Fan'; Z.67445 '🔒 Dieses Profil ist privat / nur für Follower sichtbar.'; Stats-Labels Z.67452-67457 'Follower','Following','Pflanzen','Erfolge','Funde','Angebote'; Z.67463 '🏆 Vitrine'; Z.67473 '✓ Folge ich' / '+ Folgen'; Z.67499 '🚫 Blockieren'; Z.67500 '🚩 Melden'; Z.67519 '🚩 Danke — Meldung übermit
- **Fix:** Strings in _gsRenderProfile/_gsProfileActionBtns/gsProfileMore/gsOpenCommunity über _t('profile_…','DE')/_t('community_…','DE') wrappen; lokales _t am Funktionskopf. Stats-Labels und Tab-Labels als Keys. EN/ES ergänzen.

### [MEDIUM AUTO] Marktplatz Verkäufer-Screen (Stripe Connect) ungewrappt — ~20 user-facing DE-Strings
- **Bereich:** Marktplatz Verkäufer v28 — gsMarketplaceOpenSellerScreen (index.html Z.20849-20913)
- **Evidenz:** 0× _t() im Block 20849-20913 (verifiziert). Beispiele: Z.20851 Toast '🔑 Bitte zuerst anmelden'; Z.20858 '⏳ Lade Verkäufer-Status…'; Z.20869 'Werde Verkäufer'; Z.20870 'Verkaufe eigene Pflanzen, Samen, Werkzeug…'; Z.20874-20877 Feature-Liste 'Pro Verkauf 5% GreenScan-Gebühr','TWINT, Karte, Kontoüberweisung…','Vereinfachte Schweizer Steuer-Reports…','Geld auf dein Bankkonto in 2-7 Tagen'; Z.20879 '
- **Fix:** Alle 4 Status-Renderings (pending/active/restricted/disabled) in gsMarketplaceOpenSellerScreen über _t('seller_…','DE') wrappen; lokales _t am Funktionskopf (wie in gsMarketShowDetail Z.32548). EN/ES ergänzen.

