# FULL-STACK-AUDIT v30.42 (Block G + H)

> **Datum:** 25.06.2026 · **Basis:** v30.41 LIVE · **Methode:** 7-Sektionen-Adversarial-Audit (21 Agenten,
> 7 Hunter + adversariale Verifikation, Default „refuted"). 14 reale Erstfunde → **10 bestätigt** nach Gegenprüfung.
> Bekannte/deferred Punkte (Perf-Sprint 73× auth_rls_initplan etc., localStorage-Auth, Hard-Lessons) NICHT neu gezählt.

## Ergebnis-Übersicht

| # | Sektion | Severity | Fund | Status |
|---|---|---|---|---|
| 1 | G.4 | **HIGH** | quiz_leaderboard self-write → Jahresend-Auto-Pro-Grant (Entitlement-Diebstahl) | ✅ gefixt (Backend) |
| 2 | G.4 | MEDIUM | profiles-Guard schützt quiz_elo/battles/level/xp nicht → Battle-ELO/Matchmaking-Exploit | ✅ gefixt (Backend) |
| 3 | G.3 | MEDIUM | 7 i18n-Werte mit literalem `&amp;` rendern DE für EN/ES (JS-Map-Loader-Pfad) | ✅ gefixt (v30.42) |
| 4 | G.2 | MEDIUM | gsRegionPickChange ohne markDirty → Region synct nicht cross-device (Fake-„gespeichert") | ✅ gefixt (v30.42) |
| 5 | G.2 | MEDIUM | gsSeedAdd/Del ohne markDirty → Saatgut-Inventar synct nicht cross-device | ✅ gefixt (v30.42) |
| 6 | G.7 | MEDIUM | gs_wissen_read lokal-only trotz „cloud-restored"-Kommentar → Verlust bei Logout/Gerätewechsel | ✅ gefixt (v30.42) |
| 7 | G.2 | LOW | gsErnteSetYear/View ohne markDirty (ephemerer View-State) | ✅ gefixt (v30.42, mitgenommen) |
| 8 | G.2 | LOW | toter gsOpenAuthModal-typeof-Fallback (Funktion existiert nicht) | ✅ entfernt (v30.42) |
| 9 | G.3 | LOW | Close/Back-Buttons <44px für nicht-DE-Sprachen (aria-label-Selektor nur DE) | 📋 Backlog |
| 10 | G.3 | LOW | Foto-Entfernen-Overlay-Icons 22–30px (sprach-unabhängig) | 📋 Backlog |

---

## 1 · HIGH — quiz_leaderboard Entitlement-Exploit (G.4)

**Kette (Live-DB reproduziert):** `quiz_leaderboard.total_correct` war via RLS-own-row-UPDATE ohne Spalten-Guard
frei vom Client setzbar (`PATCH …?user_id=eq.<self> {total_correct:999999}`). Der Cron `quiz-top3-yearend`
(31.12. 23:00 UTC) rief `fn_grant_quiz_top3_pro()`, das die Top-3 **nach total_correct** wählte und
`profiles.comp_tier='pro' + comp_expires_at=now()+1 Jahr` setzte. `v_user_entitlements` schaltet damit für
Free-User (ohne Stripe-Sub) ein echtes 12-Monats-Pro frei (unlimited Scans, ai_herbalist, offline_mode …).
→ **jeder Free-User konnte sich am Jahresende automatisch Pro erschleichen + die globale Rangliste fälschen.**

**Fix (Migration `v30_42_quiz_integrity_and_profile_guard`):**
- `fn_grant_quiz_top3_pro` + `fn_quiz_leaderboard_upsert` zählen `total_correct`/`attempts` jetzt **autoritativ
  aus `quiz_answers`** (`quiz_id` FK→`daily_quizzes` + `UNIQUE(user_id,quiz_id)` = max 1 korrekt je echtem Quiz,
  nicht fälschbar). `GREATEST(existing, qa_count)` → kein Rückwärts-Slide bei Altdaten.
- `REVOKE INSERT/UPDATE/DELETE ON quiz_leaderboard FROM anon, authenticated` (SELECT bleibt). Frontend schreibt
  ausschließlich über die RPC → kein Direkt-PATCH-Cheat mehr.
- Upsert → `SECURITY DEFINER` + `search_path` gepinnt + `REVOKE EXECUTE FROM public,anon` + `GRANT authenticated` (HL#13).
- **Verifiziert:** Schreibrechte entzogen, Upsert DEFINER+authenticated-only, Grant rankt aus quiz_answers, Advisor 0 ERRORs.
  Aktuelle Daten zeigten KEINE aktive Manipulation (Leaderboard ≈ quiz_answers).

## 2 · MEDIUM — profiles-Guard: quiz_elo/battles/level/xp self-writable (G.4)

`fn_profiles_guard_protected` (BEFORE-UPDATE, HL#18) schützte 10 Spalten (tier/is_admin/role/comp_*…), aber NICHT
`quiz_elo`, `battles_won/lost/tied`, `level`, `xp`. Ein User konnte `UPDATE profiles SET quiz_elo=100` → Battle-ELO
fälschen (Matchmaking gegen Schwache, überproportionaler ELO-Gewinn) + Statistik/Level/XP faken.
**Fix:** 6 Spalten in den Guard aufgenommen. DEFINER-Writer (`fn_add_xp`, `_fn_quiz_battle_finalize`,
`fn_achievements_bump` — alle `prosecdef=true`, owner=postgres) laufen als Owner → `current_user` ≠ authenticated
→ Guard überspringt sie → XP/Battles/Achievements bleiben funktionsfähig (verifiziert).

## 3 · MEDIUM — 7 i18n-`&amp;`-Werte rendern DE für EN/ES (G.3)

`loadFromDb`-JS-Map-Pfad nahm `var de = jsMap[k]` ROH (mit `&amp;`), schlug damit `srcMap[de]` fehl (srcMap-Keys
sind dekodiert) → 7 Keys (sw_update_sub, coll_subtitle, cls_subtitle, cls_my_tasks_sub, cls_auto_progress_hint,
org_onb_step1, lina_greeting_sub) fielen für EN/ES auf DE zurück. **Fix:** `var de = _i18nDec(jsMap[k])`
(symmetrisch zum data-i18n-Pfad). Übersetzungen existierten bereits in der DB. (HL#29: Frontend-v-Bump nötig.)

## 4–6 · MEDIUM — Cross-Device-Sync-Lücken (HL#32)

Drei Setter schrieben nur lokal ohne `markDirty` (STATE_KEYS-Auto-Track ist durch den Quota-Wrapper geshadowt):
- **gsRegionPickChange** (Region) → `markDirty('state')` in beiden Branches. War HL#33 (Fake-„gespeichert"-Toast).
- **gsSeedAdd/gsSeedDel** (Saatgut-Inventar) → `markDirty('plants')`.
- **gs_wissen_read** (Lesefortschritt) → in `_buildStateBlob` + Pull-**Merge** (additive Kapitel-Flags) + STATE_KEYS
  + `markDirty('state')` im Writer `gsWissenMarkRead`. Der Kommentar „cloud-restored" war faktisch falsch.

## 7–8 · LOW (mitgenommen)

- **gsErnteSetYear/View** → `markDirty('state')` + HL#10-`try/catch` für gsErnteSetView.
- **toter gsOpenAuthModal-Fallback** entfernt (openLoginModal ist immer hoisted → Branch unerreichbar).

## 9–10 · LOW — Backlog (A11y, WCAG 2.5.5)

- **Close/Back-Buttons <44px für nicht-DE:** der Tap-Target-CSS-Fix (Z.~76572) matcht nur deutsche aria-labels
  („Schliessen"/„Zurück"). Bei EN/ES/FR/IT sind die aria-labels übersetzt → Selektor greift nicht → 32–34px.
  **Fix-Vorschlag:** stabilen Hook nutzen (`class="modal-close-btn"` oder `[data-close]`) statt lokalisiertem aria-label.
- **Foto-Entfernen-Overlay-Icons 22–30px:** 6+ ✕-Buttons ohne Klasse/Tap-Fix. **Fix-Vorschlag:** gemeinsame Klasse
  `.gs-photo-x{min-width:44px;min-height:44px}`.

---

## Sektionen ohne neue bestätigte HIGH/MEDIUM-Funde

- **G.1 Duplikate:** keine echten Clobber-/Shadowing-Bugs über die bekannten hinaus (Save/Toast/Modal-Pfade sind
  konsolidiert genug; reine DRY-Kandidaten = kein Bug-Risiko).
- **G.5 Performance:** keine NEUE heiße Instanz über den bekannten deferred Perf-Sprint hinaus.
- **G.6 Sicherheit:** keine neuen hardcodierten Secrets; Storage-Policies ok; Admin-RPCs server-gated. (Bekannt/staged:
  globaler Anthropic-Key-Leak → ai-proxy, Task task_bb4fd480, separat.)

## Block H — Optimization-Status

Die Top-Hebel dieses Audits waren die Security-Migration (#1/#2) + die Sync-Konsolidierung (#4–#7, alle auf das
einheitliche markDirty-Muster gebracht). Weitere Block-H-Kandidaten (Save-Pfad-Konsolidierung auf gsPersist,
Toast/Modal-Vereinheitlichung, RLS-Perf-Sprint) bleiben bewusst Backlog (kein akuter Bug, Perf-Sprint riskant auf
Live-Payment-DB → braucht Per-Policy-Review).
