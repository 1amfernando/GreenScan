# QUOTA_AUDIT_v28.05 — Pre-Flight (Hard-Lesson #14) + Pfad-Entscheidung

> **Pflicht-Audit vor der Migration.** Fernando-Direktive: „erweitern, nicht parallel bauen".
> Stand 2026-06-03 · Projekt `vowbiueikwrauuceilhc`.

## 1 · Existierende Quota-Realität (LIVE)

### Backend
| Objekt | Typ | Zweck | Per-User? |
|---|---|---|---|
| `feature_limits` | Tabelle (wide) | Tier×Feature-Capability-**Config** (1 Zeile/Tier) | nein (Config) |
| `v_user_entitlements` | View | resolved Entitlements für `auth.uid()` | ja (self-filtered) |
| `gs_abo_can_use(user,feature)` | RPC (DEFINER) | Tier-**Gate** (trial/active → erlaubt; sonst free-Features) | ja |
| `scan_events` | Tabelle | Einzel-Scan-Log (user_id, success, created_at) | ja |
| `user_scan_quota_remaining(user)` | RPC | **monatliche** Scan-Restzahl gg. v_user_entitlements | ja |
| `ai_daily_usage` | Tabelle | **globale** Edge-Fn-Kosten/Token-Statistik (date, edge_fn, tokens, cost) — **KEIN user_id** | **nein** |
| `v_ai_usage_*` | Views | Admin-Kosten-Auswertung | nein |

- `feature_limits`: Spalten `tier(enum free/plus/pro/admin)`, `scans_per_month`, `recipes_export`, `light_measurement`, `garden_planner`, `ai_herbalist`, `book_excerpts`, `family_accounts`, `offline_sync`, `updated_at`. RLS: public read + service_role write.
- **tier-Enum hat KEINEN `lifetime`-Wert.** Lifetime = `profiles.is_lifetime=true` (+ ggf. `stripe_subscriptions.is_lifetime`). `v_user_entitlements` löst lifetime/aktive-Sub → `tier` (sonst `'free'`) + `scans_per_month=-1` etc. auf.
- `feature_limits` enthält noch eine **`plus`-Zeile** (Produkt-seitig entfernt) — bleibt als harmlose Config (kein User resolved zu plus, falls doch: pro-äquivalente Werte → großzügig).

### Frontend (`index.html`)
- `GS_PLANS` (free/plus/pro/lifetime/premium/basic) · `gsAboCanUse(feature)` · `gsAboTrackScan/AICall` · `gsAboGetAIQuota`.
- **Tatsächlicher Gate = client-seitig (localStorage):** `gs_scans_<date>` (free 5/Tag) + **eine unified** `gs_aicalls_<date>`-Bremse (free **15/Tag**, gilt für ALLE callAI/callVisionAI = Scan/Doktor/Plan/Foto-Diff zusammen). Greift nur bei **globalem Key** (BYO-Key umgeht — User zahlt selbst).
- **Schwäche:** rein LS-basiert → durch LS-Löschen umgehbar → **kein echter Kostenschutz** des globalen Keys.

## 2 · Lücken-Analyse (Coverage)
| Bedarf v28.05 | Existing? | Lücke |
|---|---|---|
| Tier×Feature-Config | ✅ `feature_limits` | nur grobe Caps, keine Per-Feature-**Tageslimits** |
| Per-User-Per-Feature-Tageszähler | ❌ | **fehlt komplett** (ai_daily_usage ist global/ohne user_id) |
| Server-enforced Quota (nicht LS-umgehbar) | ❌ | **fehlt** (Gate ist client-seitig) |
| Warme Countdown-UI / „Mein Plan" | ❌ | fehlt |
| Statische Limits (Garten-Count, Marktplatz-Fotos) | teilw. (`unlimited_plants`, MAX_PHOTOS in Edge-Fn) | nicht zentral |

## 3 · Pfad-Entscheidung: **C (Hybrid, additiv)** — bestätigt von Fernando

**Prinzipien:** erweitern statt parallel · Migrationen strikt additiv (`ADD COLUMN IF NOT EXISTS`, keine Drops von Existing-Daten) · Existing-Namen gewinnen · `gsAboCanUse` bleibt Frontend-Vorder-Tür (kein Duplikat-Helper).

### Backend (Migration `v28_05_feature_quota`, additiv)
1. **`feature_limits` erweitern** (Config bleibt diese Tabelle): additive Spalten `scans_per_day, lina_per_day, doctor_per_day, foto_diff_per_day, battle_per_day, garden_max, marketplace_photos` (int; `-1`=unbegrenzt). Werte je Tier gesetzt (free großzügig, pro/plus/admin = -1). **plus-Zeile NICHT gelöscht** (additiv) — pro-äquivalent befüllt.
2. **`feature_usage` (NEU)** = der fehlende Per-User-Per-Feature-Per-Periode-Zähler (ersetzt funktional das zu schmale, user-lose `ai_daily_usage` für Quota-Zwecke; `ai_daily_usage` bleibt für Admin-Kosten). Spalten `(user_id, feature, period_type 'day', period_start date [Europe/Zurich], used int, updated_at)`, PK `(user_id,feature,period_type,period_start)`. RLS own-only SELECT; Write nur via DEFINER-RPC.
3. **RPCs (DEFINER, Hard-Lesson #13 grants):**
   - `_fn_quota_zurich_day()` → date (Europe/Zurich-Tag).
   - `fn_quota_consume(p_feature)` → jsonb `{allowed,used,limit,remaining,unlimited,period_end}`: paid/lifetime/admin → unlimited (kein Increment); free → atomar check-and-increment via `ON CONFLICT … WHERE used < limit` (kein Over-Increment). Unbekanntes Feature → fail-open (nicht blockieren).
   - `fn_quota_peek(p_feature)` → jsonb (kein Increment, für UI).
   - `fn_cleanup_feature_usage()` → DELETE >35 Tage; Cron `feature-usage-cleanup`.
4. **Server-Enforcement** (der echte Kostenschutz): Frontend ruft `fn_quota_consume` server-seitig VOR dem globalen-Key-AI-Call → Zähler liegt server-seitig in `feature_usage` → **nicht per LS-Löschen umgehbar**.

### Frontend (Pfad C — erweitern, kein Parallel-Helper)
- `gsQuotaConsume(feature)` / `gsQuotaPeek(feature)` (async, RPC-Adapter) — die EINZIGEN neuen Helper. `gsAboCanUse` bleibt schneller LS-Vor-Check.
- `callVisionAI`/`callAI`: optionaler `opts.quotaFeature` → bei globalem Key + free serverseitig konsumieren; `!allowed` → warme Limit-UI (kein Dark-Pattern, „gut gemacht heute!" statt „upgrade!"). Rückwärts-kompatibel (ohne quotaFeature = bisheriges LS-Verhalten).
- `gsShowQuotaCountdown` (warm, Reset-Zeitpunkt) · `gsOpenProBenefits` (sachlich, keine FOMO) · Settings „💎 Mein Plan" (Per-Feature-Stand via `fn_quota_peek`).
- 2 statische Limits: Garten-Count (bei Garten-Anlegen) · Marktplatz-Fotos (Publish-Pfad).

**Mission-Leitplanken:** Quota = API-Kosten-Bremse, KEINE Sales-Bremse. Lina (v28.07) FREE, fragt nie nach Geld. Großzügige Free-Limits. Keine Dark-Patterns / FOMO.

## 4 · Verworfen
- **Spec wörtlich** (`tier_quota_config` long + `feature_usage` + `fn_quota_check_and_consume` als Neubau): würde `feature_limits`/Config duplizieren → Drift, payment-DB-Risiko. Stattdessen Existing-Config erweitert + nur `feature_usage` neu.
- **lifetime-Zeile in feature_limits**: tier-Enum hat kein 'lifetime' → würde brechen; Lifetime ist über `is_lifetime` bereits aufgelöst.
