# QA_v28.12 — Full-App-QA-Sweep vor dem grossen Launch (v26.83 → v28.12)

> Stand 2026-06-03 · vor dem einen grossen `DEPLOY_FULL.command` (v26.83 → v28.12).
> Ziel: maximale Deploy-Sicherheit für den grössten Release bisher. Quick-Fixes in `v28.13`.

## ✅ Ergebnis: DEPLOY-READY — 0 neue ERRORs, 0 P0/P1-Blocker

## 1 · RLS-Abdeckung — 21/21 ✅
Alle v28-Nutzer-/Sensiblen-Tabellen haben RLS aktiv: feature_usage, feature_limits, coach_conversations, coach_messages, organizations, org_members, org_invites, org_audit_log, org_classes, class_members, class_assignments, class_submissions, scan_cache, app_status, marketplace_listings, user_follows, user_blocks, user_state_snapshots, push_subscriptions, recipes, remedies.

## 2 · Privacy-Spot-Check (transaktional, fremder User) ✅
User B sieht **0** fremde Zeilen in coach_messages / feature_usage / user_state_snapshots / class_submissions (own-only-RLS hält). Marketplace public-read (non-archived) korrekt. Deckt die zentralen Privacy-Flächen aus v27.02/v28.05/v28.06/v28.07.

## 3 · Supabase-Advisor — Security
- **1 ERROR (bekannt/akzeptiert):** `security_definer_view` auf `v_marketplace_listings`. **Bewusst DEFINER** — liest Verkäufer-Anzeigedaten (Name/Expert/Premium-Badge) aus profiles trotz Caller-RLS für die Marktplatz-Liste. Exponiert NUR öffentliche Listing-Daten (status<>archived) + öffentliche Verkäufer-Badges. Flip auf security_invoker würde Verkäufer-Namen-Anzeige riskieren → **kurz vor Launch bewusst NICHT geändert.** **0 NEUE ERRORs.**
- WARNs (erwartet/akzeptiert): `anon/authenticated_security_definer_function_executable` (140 — das gewollte own-only-DEFINER-Pattern aller RPCs, Hard-Lesson #13), `rls_enabled_no_policy` (4 — service-role-only Tabellen, gewollt), `public_bucket_allows_listing` (8 — öffentliche Asset-Buckets, by design), `extension_in_public` (3 — pgcrypto/pg_trgm etc.), `auth_leaked_password_protection` (1 — **Fernando-Manual:** Dashboard-Toggle „Leaked Password Protection" aktivieren).
- **FIXED in v28.13:** `function_search_path_mutable` auf `_gs_parse_ts_flex` → `SET search_path = public, pg_temp` gepinnt.

## 4 · Supabase-Advisor — Performance
- **FIXED in v28.13:** 7 `unindexed_foreign_keys` → 7 Indizes ergänzt (class_submissions.user_id, coach_messages.user_id, org_invites.created_by/used_by, org_members.invited_by, user_blocks.blocked_id, user_weekly_challenge_progress.challenge_id). Verifiziert vorhanden.
- **Deferred (kein Blocker):** `multiple_permissive_policies` (136 — Skalierungs-Perf, semantik-erhaltende Konsolidierung als eigener Perf-Sprint), `unused_index` (195 INFO — viele Auto-/FK-Indizes, bei Wachstum genutzt; harmlos).

## 5 · Frontend
- 7/7 Inline-Scripts `node --check` OK + sw.js OK.
- 55 Migrations-Mirror-Files im Repo. git HEAD == origin/main == v28.12 (`b0ab09c`).

## 6 · Offen (kein Deploy-Blocker)
- **Fernando-Manual (Dashboard):** Leaked-Password-Protection aktivieren · 8 obsolete Stripe-Edge-Fns löschen · TWINT · Plus-Products archivieren · 4242-Test.
- **Deferred Backlog:** multiple_permissive_policies-Konsolidierung (Perf-Sprint) · Settings-Redesign (B-004) · Harvest-Konsolidierung + Realtime-Marktplatz-Chat (v28.03-Audit).

## Fazit
Der v26.83→v28.12-Release ist **deploy-ready**. Keine neuen Sicherheits-ERRORs, Privacy-Isolation verifiziert, die zwei objektiven Perf-/Hygiene-Findings (FK-Indizes + search_path) in v28.13 gefixt.
