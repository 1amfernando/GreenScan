# FULL_STACK_AUDIT — Block G (v28.69 Stand)

> **Block-G-Deliverable** aus `AUFTRAG_CODE_v28.32.md`. Full-Stack-Audit über 7 Sektionen
> (G.1–G.7) via 7-Agenten-Workflow mit **Evidence-Pflicht** (jedes Finding per echtem
> grep/SQL belegt) + **DB-Verifikation** (Supabase-MCP). Kritische Security-Findings
> zusätzlich vom Main-Loop per MCP spot-gecheckt.
>
> **Lesart:** `[V]` = verifiziert (grep/SQL/Read) · `[?]` = Aggregat belegt, Einzelfall-Klassifikation offen.
> Aufwand: **S** <30 Min · **M** ½–1 Tag · **L** mehrtägig/risikobehaftet.
>
> **⚠️ Vor JEDER Umsetzung:** Zeilennummern können verschoben sein → immer per grep auf
> Funktionsnamen ankern (HL#9/#11). Vor Backend-Policy-Fixes prüfen, ob Edge-Functions
> per `service_role` schreiben (umgehen RLS) — sonst ändert eine Policy nur den Client-Pfad (HL#14).

---

## 0 · Gesamtbild

- **Supabase Security-Advisors: 0 ERROR · 0 WARN** (nur INFO) — bestätigt v28.64-Check. Backend fundamental gesund.
- **Keine Halluzinationen geerbt:** frühere Falschbehauptungen (z. B. „fn_photo_diff_list existiert nicht") aktiv widerlegt.
- **G.1 (Duplikate): keine kritischen Redundanzen** — Toast/Modal/Save-Familien sind absichtlich spezialisiert; `gsIsAdmin`-Doppel ist dokumentierte Forward-Declaration (nicht anfassen).
- Echte Handlungs-Findings konzentrieren sich auf: **2 anon-lesbare sensible Tabellen (nDSG)**, **3 garden_harvests-Orphans**, **3 Frontend-XSS-Best-Practice-Lücken**, **gsIsExpert-Dead-Code**, **CSP unsafe-eval**, **Tap-Targets**, **2 i18n-Nachzügler**.

---

## (A) SOFORT — verifiziert, klein, lohnend

### A1 · 2 sensible Tabellen anon-lesbar (`qual='true'`, nDSG-Risiko)
- **Severity:** hoch · **Aufwand:** S · **[V]** (Main-Loop-Spot-Check der Rollen)
- **Beleg:** `expert_verifications.expert_verif_select_all` → roles `{anon,authenticated}`, qual=`true`. `feedback_items.feedback_items_select_all` → roles `{public}`, qual=`true`. → **beide ohne Login lesbar**; `feedback_items` enthält `author_email`/Text → Schweizer nDSG-Thema (Crawler/Konkurrenz lesen Kundenfeedback inkl. Mail).
- **Empfehlung:** `feedback_items` SELECT → mind. `authenticated` + `author_email` für Nicht-Owner ausblenden (View/Spalten-Maskierung), ODER bewusst „Community-Feed public ohne Mail" definieren. `expert_verifications` → Profil-Teil public lassen, Verifizierungs-**Details** auf auth/admin. **Produkt-Entscheidung nötig: was soll wirklich öffentlich sein.**

### A2 · garden_harvests: 3 Orphan-Records + NULL-FK-Schreibpfad
- **Severity:** hoch · **Aufwand:** S (Cleanup) + M (Root-Cause) · **[V]** (SQL, 3 IDs)
- **Beleg:** 3 Records mit `garden_id IS NULL AND planting_id IS NULL` (04.–06.06.2026). FK `confdeltype='n'` (NO ACTION).
- **Empfehlung:** (1) `DELETE FROM garden_harvests WHERE garden_id IS NULL AND planting_id IS NULL;` (2) **Root-Cause zuerst:** Frontend `gsErnteAdd` (~Z.8200) schreibt NULL-FKs → vor INSERT validieren, sonst kcommen Orphans wieder. (3) FK-Politik bewusst wählen (siehe B5).

### A3 · 3 Frontend-XSS-Best-Practice-Lücken (ungeescapte IDs/URL in inline-onclick/CSS)
- **Severity:** hoch (wegen `p.photo`) / sonst mittel · **Aufwand:** S–M · **[V]** (Read)
- **Ort:** `gsNewPlantCard()` @~6533 (`p.photo` in CSS `url()` nur quote-stripped), @~6575 (`p.id` in onclick); `gsCollectionRemoveItem()` @~6918 (`it.id` in onclick).
- **Beleg:** `name`/`nick` werden escaped, IDs/Photo nicht. Real-Exploit gering (IDs sind Server-UUIDs/eigene Daten), aber `p.photo` ist URL-Feld → eher steuerbar.
- **Empfehlung:** auf `data-*`-Attribute + Event-Delegation umstellen (deckt HL#12 strukturell), oder `gsHTMLEscape` auf alle interpolierten Werte. Mit B9 (innerHTML-Härtung) bündeln.

### A4 · gsErnteSetYear(): localStorage.setItem ohne try/catch (HL#10)
- **Severity:** mittel · **Aufwand:** S · **[V]** (Read @~8117)
- **Beleg:** `localStorage.setItem('gs_ernte_year', y)` ungeschützt; 185/291 setItem-Calls ohne Wrapper.
- **Empfehlung:** auf `gsStore.set()` (Quota-safe, seit v28.29) migrieren. Diese Stelle = S; Voll-Migration = B4.

> **Vorschlag v28.70 (Backend-only, klein):** A1 + A2-Cleanup als SQL-Migrationen (kein index.html-Bump; Migrations in `supabase/migrations/` spiegeln). **A1 erst nach Fernando-Entscheidung „was ist public".**
> **Vorschlag v28.71 (Frontend-Härtung):** A3 + A4 + A2-Root-Cause (gsErnteAdd-FK-Validierung).

---

## (B) Lohnender Cleanup

| # | Finding | Sev | Aufw | Beleg | Empfehlung |
|---|---------|-----|------|-------|------------|
| B1 | `gsIsExpert()` Doppel-Def: @~28578 (59 Z. Async-Cache, **tot**) vs. @~68614 (1 Z. `gsRoleAtLeast`) | hoch→cleanup | S | [V] | 59-Z.-Version löschen; vorher `gsLoadUserExpertStatus`/`_gsExpertStatusCache` auf Restnutzung grep'en. (`gsIsAdmin`-Doppel **nicht** anfassen — bewusste Forward-Decl.) |
| B2 | multiple permissive Policies | mittel→info | — | [V] | **v28.74 verifiziert + weitgehend erledigt:** 0 same-cmd-Duplikate (v28.18 erledigte die); FK-Indizes komplett (v28.13). Advisor-Treffer = (a) verschiedene-Rollen-„Overlaps" (z.B. ai_daily_usage ALL=service_role vs SELECT=authenticated → KEIN echter Overlap, nicht droppen) + (b) admin-ALL+public-read-Muster (Split = Churn+Risiko für INFO-Gewinn → **deferred-by-design**). Einzige sichere Konsolidierung gemacht: `harvest_log.harvest_insert_own` gedroppt (exakt redundant zu owner_all). Rest **bleibt bewusst deferred** (CLAUDE.md-konform). |
| B3 | 62 Tabellen `qual='true'` SELECT (über A1 hinaus) | gemischt | M | [V]/[?] | Liste klassifizieren „public by design" vs. „auth/own". `harvest_log`/`quiz_*`/`post_*` als nächstes prüfen. Severity je Tabelle. |
| B4 | 185 localStorage.setItem ohne try/catch (über A4) | mittel | M | [V]/[?] | Save-Pfade (Ernte/Reminder/Tagebuch) auf `gsStore.set()`; UI-State nachrangig. Restrisiko gedämpft durch Wrapper seit v28.29. |
| B5 | garden_diary/garden_harvests NO-ACTION-FK | mittel | S–M | [V] | Archive-Pattern gewollt? → DB-Kommentar + Runbook; sonst SET NULL/CASCADE. Bündelt mit A2. |
| B6 | Extensions in public-Schema (pg_trgm, vector, citext) | mittel | M | [V] | `ALTER EXTENSION … SET SCHEMA extensions` + qualifizierte Namen. **Bricht ungequalifizierte RPC-Calls → erst alle Call-Sites grep'en.** Eher Backlog. |
| B7 | CSP `'unsafe-eval'` ungenutzt | mittel | S | [V] | aus `_headers` streichen (`'unsafe-inline'` bleibt, Monolith). **Vor Deploy Hard-Reload-Smoke-Test (Leaflet/Three/pdf.js eval?).** |
| B8 | Tap-Targets <44px (gsGoBack 34×34, Modal-Close 30–36, clearInlinePhoto 26×26 …) | A11y | M | [V] | Clickable-Area auf 44×44 (Icon-font-size klein ok) via CSS-Klasse `.btn-icon`. WCAG 2.5.5. |
| B9 | Error-Message unescaped in innerHTML @~10210 | niedrig | S | [V] | `escHtml(msg)` / `textContent`. Mit A3 bündeln. |

> **Vorschlag v28.72 (Code-Hygiene):** B1 + B7 + B9 (+ ggf. B8). Kleine, klar abgegrenzte Fixes.
> **Vorschlag v28.73+ (Backend-Perf, deferred-Charakter):** B2 + B3 + B5 + B6 — Per-Policy-Review auf Live-Payment-DB, gleiche Vorsicht wie der bereits deferred'te Perf-Sprint.

---

## (C) Bewusst akzeptiert / Backlog / Entscheidung nötig

| # | Finding | Sev | Status | Beleg |
|---|---------|-----|--------|-------|
| C1 | 4 RLS-Tabellen RLS-on / no-policy (`book_ocr_pages`, `species_import_queue`, `species_search_cache`, `weather_forecast_cache`) | info | **Spot-Check: alle 4 LEER** → deny-all an Clients ist **harmlos/gewollt** (nur Edge-Fns/Cron via service_role). Optional: RLS-off ODER explizite Policy + DB-Kommentar. | [V] (count=0) |
| C2 | Cloud-Sync-Gap: `map_user_finds` + `user_scans` per direktem sbFetch statt 3-Blob-System | hoch | **Architektur-Entscheidung** (Blob-Scope vs. Direct+Offline-Queue). Kein akuter Datenverlust belegt, Race-Condition-Risiko offline. | [V] |
| C3 | Brain/Lina-Memory LOCAL-ONLY (`gs_brain_memory`) | hoch | **Produkt-Entscheidung:** Lina Cross-Device-Kontext? Wenn nein → Limitation dokumentieren. | [V] |
| C4 | 13 anon-exec SECURITY DEFINER RPCs (von 110 total) | info | Stichproben-Review auf auth.uid()-Check (`fn_get_daily_quiz` public by design etc.). Großteil v28.18+ gewrappt. | [V]/[?] |
| C5 | 194 unused Indexes | info | Storage-Hygiene, 0 Perf-Impact. `pg_stat_user_indexes` monitoren, DROP nach >4 Wo idle. | [V] |
| C6 | 8 public Storage-Buckets | info | G.6: korrekt (Fotos/Avatare public by design, PDFs/Raw-Scans privat). `garden-photos`/`map-find-photos` ggf. Owner+Share-Flag. | [V] |
| C7 | CSP `'unsafe-inline'` | info | **Bewusst akzeptiert** — Single-File-PWA, unvermeidbar. Nonce = große Architektur-Änderung. | [V] |
| C8 | i18n-Nachzügler: `renderProfileLoggedIn()` (~10) + `showLuxResult()` (7 Lichtkategorien) | mittel | „100%"-Claim war unvollständig (Vollprofil + Lux übersehen). In nächsten i18n-Sprint. | [V] |
| C9 | RLS INSERT ohne `with_check` (expert_verifications u.a.) | mittel | mit B2/B3-Review bündeln. | [V] |
| C10 | Event-Listener 183 add : 40 remove · Button-Style-Inkonsistenz · innerHTML-Coverage 79/591 | info | kein belegter Leak/Bug; optional `gsInitModalCleanup` + CSS-Klassen + `gsSafeHTML`-Migration. | [V]/[?] |

> **C2/C3 brauchen zuerst eine Fernando-Entscheidung** (Architektur/Produkt) — nicht blind bauen.

---

## Methodik-Hinweis

7 parallele Explore-Agenten (1 pro Sektion) mit Pflicht-Evidence (echtes grep/SQL) + Backend-Sektionen via Supabase-MCP, dann Synthese-Agent + Main-Loop-Spot-Check der „kritisch"-Findings. Severity-Korrekturen ggü. Sektions-Labels: A1-feedback_items (anon-Rollen per Spot-Check bestätigt = real), C1 (4 Tabellen leer = entschärft), B8/B3 (von „hoch" auf realistisch). 0 ERROR/WARN bei Supabase-Advisors bestätigt — die App ist grundsolide; die Findings sind Härtung/Hygiene, kein Notstand.

---

**Stand:** v28.69 · erstellt 09.06.2026 via 7-Agenten-Audit-Workflow + Synthese + Main-Loop-Spot-Check.
