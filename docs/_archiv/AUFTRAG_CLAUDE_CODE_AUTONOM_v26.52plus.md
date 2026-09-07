# AUFTRAG: Claude Code — Autonomer Sprint-Pipeline ab v26.52

**Datum:** 2026-05-27
**Auftraggeber:** Fernando via Cowork
**Gültigkeit:** Bis explizit zurückgezogen oder durch neueren Master-Auftrag ersetzt
**Status v26.51:** Cowork hat Mein-Garten-Audit + 3 P0-Quick-Wins als v26.51 ausgeliefert (Z.6188-6411, 6737, 7364, 19834+, 57333+, 57102+). Du startest auf **v26.52**.

---

## 0 · Operating-Mode

**Du arbeitest autonom — ohne Rückfrage zu Fernando, ohne Rückfrage zu Cowork.**
- Jeder Sprint = 1 Version-Bump = 1 git push.
- Du wählst die nächste Version aus der Sprint-Pipeline unten (Priorität P0 > P1 > P2 > P3).
- Bei jedem Push: index.html + sw.js + _headers + GS_RELEASES + meta app-version syncen. 6/6 Inline-Scripts `node --check` clean ist Pflicht.
- Bei Schema-Änderungen IMMER `information_schema.columns` query VORHER. Niemals Feldnamen raten.
- Migrations: schreib SQL in `supabase/migrations/<timestamp>_<name>.sql`. Cowork pickt sie auf für Deploy ODER du nutzt `mcp__supabase__apply_migration` direkt.
- Edge-Functions: `supabase/functions/<name>/index.ts`. Deploy via `mcp__supabase__deploy_edge_function`.

**Wann doch fragen (in der commit-Message + STATUS.md notieren — keine direkte Frage):**
- Stripe-Live-Mode-Switch
- Account-Delete-Logik
- DSGVO-relevante Datenmodell-Änderungen
- Akzeptierter Hard-Break (z.B. `myPlants`-Blob → eigene Tabelle erfordert Frontend-Umbau >1000 Zeilen)

**Niemals:**
- Stripe-Live-Mode aktivieren
- Hardcoded API-Keys committen
- index.html komplett lesen (63k Zeilen → Token-Kollaps; nutze grep + offset+limit)

---

## 1 · Sprint-Pipeline (priorisiert)

### 🔴 P0 — Mein-Garten Backend-Härtung (Cowork-Audit-Erkenntnisse v26.51)

#### **v26.52 · Plant- + Diary-Fotos in Storage-Bucket** (4-6h)
- **Migration:** 2 neue Buckets via Supabase-Admin
  - `user-plant-photos` (RLS: SELECT/INSERT/UPDATE/DELETE WHERE storage.foldername = uid)
  - `garden-diary-photos` (RLS identisch)
  - Max-File-Size 5 MB, allowed_mime_types `['image/jpeg','image/webp','image/png']`
- **Frontend:**
  - Z.23034 `_gsPlantPhotoB64` und Z.23222 `_gsDiaryPhotoB64` (oder aktuelle Anker) → nach Compress (max 1920x1920 / 0.85 quality) direkt nach Bucket uploaden, URL als `p.photo` bzw. `entry.photo` speichern statt base64
  - Bei Render von Plant-Cards Fallback: falls `p.photo` mit `data:` startet (Legacy), upload-on-read + replace
  - Ein-Pass-Migration: `gsMigrateBase64Photos()` läuft beim ersten Boot, geht `myPlants[]` + `_gsTagebuch[]` durch
- **Verify:** alle alten Test-User-Plants haben nach Refresh URL statt base64, plants-Blob < 100 KB statt evtl. 2+ MB

#### **v26.53 · Ernte-Schema-Erweiterung** (4-6h)
- **Migration `v26_53_garden_harvests_extend.sql`:**
  ```sql
  ALTER TABLE public.garden_harvests
    ADD COLUMN IF NOT EXISTS notes text,
    ADD COLUMN IF NOT EXISTS photo_url text,
    ADD COLUMN IF NOT EXISTS weather jsonb,
    ADD COLUMN IF NOT EXISTS destination text
      CHECK (destination IN ('eaten','sold','gifted','composted','preserved')),
    ADD COLUMN IF NOT EXISTS price_chf numeric(8,2),
    ADD COLUMN IF NOT EXISTS buyer text,
    ADD COLUMN IF NOT EXISTS quality_rating smallint CHECK (quality_rating BETWEEN 1 AND 5);
  CREATE INDEX IF NOT EXISTS idx_garden_harvests_destination ON public.garden_harvests(user_id, destination) WHERE destination IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_garden_harvests_price ON public.garden_harvests(user_id, price_chf) WHERE price_chf IS NOT NULL;
  ```
- **Frontend `gsErnteAdd` (Z.7318+):** Expand-Section unter Basic-Felder: Foto-Button, Notiz-Textarea, Verkauf-Toggle (Bio/Privatkauf/Markt), Preis-Input, Käufer-Input, Quality-Rating-Stars
- **Neue View `v_harvest_stats_yearly` für Stats-Card:** YEAR + Total-kg + Total-CHF-Verkauf + Top-Pflanze
- **Frontend Stats:** „📊 Erntestatistik" Tab im Ernte-Tracker mit YoY-Vergleich, Verkaufserlös, Top-Pflanze

#### **v26.54 · Frost-Warnung Server-Cron + Wetter-Cache** (6-8h)
- **Migration `v26_54_frost_alerts.sql`:**
  - Tabelle `frost_history (id uuid PK, user_id, alerted_at timestamptz, min_temp_c numeric, location_lat numeric, location_lon numeric, was_actual_frost bool null)` mit RLS own + Index `(user_id, alerted_at desc)`
- **Edge-Function `frost-checker` v1:**
  - Iteriert profiles WHERE location_lat IS NOT NULL
  - Fetcht Open-Meteo für nächste 24h
  - Bei minimum_temperature < 2°C: INSERT notifications kind='frost_warning' mit dedup_key=`'frost_'||date`
  - + INSERT frost_history für Statistik
- **pg_cron-Job `frost-check-evening` 18:00 UTC täglich**
- **Frontend Z.7749 `loadGardenWeather`:**
  - `gs_weather_cache` LS mit TTL 30min (`{ts, data, ttl_minutes:30}`)
  - `_gsFetch` Timeout auf 20s + 1 Retry mit 2s Backoff
- **Verify:** SELECT count(*) FROM notifications WHERE kind='frost_warning' AND created_at::date = current_date

### 🟠 P1 — DB-Ausbau (User-Auftrag: "DB mehr aufgebaut")

#### **v26.55 · species 2'837 → 4'342** (8-12h, mehrere Sub-Bumps möglich)
- **Edge-Function `species-bulk-seed` v4:** Erweiterung um Schweizer-Fokus-Mode (`mode='ch_focus'`)
- **Targets (1'505 neue species):**
  - 800 Pflanzen (Wildpflanzen CH Mittelland/Alpen, davon 200 Wildkräuter, 150 Wildblumen Alpen, 100 Wasserpflanzen, 100 Gartenpflanzen-Klassiker, 250 Nutzpflanzen-Sorten Diversität)
  - 400 Pilze (300 essbar+ungenießbar mit VAPKO-Klasse, 100 giftig+tödlich mit Symptom-Bibliothek)
  - 200 Bäume (CH-heimisch, exotic-naturalized, Obstbaum-Sorten Pro-Specie-Rara-Cross-Sell)
  - 105 Moose/Flechten/Algen (Bioindikatoren, Wasserqualität)
- **Curation-Strategie:** 50/Batch via knowledge-bulk-gen-Pattern (Anti-Dup-Slug, sources jsonb mit GBIF/Info-Flora/iNaturalist-Refs)
- **Verify:** SELECT cat, count(*) FROM species GROUP BY cat ORDER BY count DESC. Vorher 2'837, Ziel 4'342 (+1'505).
- Bumps: v26.55a (Plants), v26.55b (Mushrooms), v26.55c (Trees), v26.55d (Moose) — pro Subbatch ein Commit.

#### **v26.56 · Knowledge-Tables vertiefen** (4-6h)
- knowledge-bulk-gen v12: Per-Topic-Target-Counts hochsetzen, pg_cron knowledge-growth-daily auf 24+ Topics (vorher 16, jetzt 35 sind enabled aber count target niedrig):
  - recipes 132 → 300 (Schweizer-Rezepte mit medizinaler Pflanzen-Komponente, plus saisonale)
  - remedies 100 → 250 (alpine Heilpflanzen-Tradition, plus moderne TCM-Crossover)
  - folk_lore 90 → 200 (Schweizer Sagen + Bräuche, Bauernregeln)
  - garden_techniques 68 → 200 (Biodynamische Methoden, CH-Permakultur, Vertikale Gärten)
  - plant_diseases 65 → 200 (mit Bio-Behandlung + Companion-Schutz)
  - did_you_know_facts 80 → 250 (Surprising facts, virale Quality)
- pg_cron Job-Definition aktualisieren: täglich 12+ pro Topic statt 2-3.

#### **v26.57 · Neue Tabellen für Mein-Garten** (6-10h)
Migrations `v26_57_garden_tables.sql`:
```sql
-- 1) Garten-Beet-Layout (für Layout-Editor + KI-Optimierung)
CREATE TABLE public.user_garden_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  garden_id uuid REFERENCES public.user_gardens(user_id),
  name text NOT NULL,
  beds jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{id, x, y, w, h, soil_type, sun_hours, plants:[]}]
  shape_svg text, -- optional SVG-Path für Garten-Umriss
  size_sqm numeric,
  orientation text, -- süd/nord/etc
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX ON public.user_garden_layouts(user_id);
ALTER TABLE public.user_garden_layouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY ugl_own ON public.user_garden_layouts FOR ALL USING (user_id = (SELECT auth.uid()));
CREATE TRIGGER _touch_ugl BEFORE UPDATE ON public.user_garden_layouts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Per-Plant Care-Schedule (statt JSON-Blob, ermöglicht Cross-Plant-Queries für Server-Cron)
CREATE TABLE public.plant_care_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plant_local_id text NOT NULL, -- p.id aus myPlants
  task_key text NOT NULL CHECK (task_key IN ('water','fertilize','prune','repot','rotate','mist','dust','check','harvest','sow')),
  interval_days int NOT NULL,
  last_done timestamptz,
  next_due timestamptz GENERATED ALWAYS AS (last_done + (interval_days || ' days')::interval) STORED,
  is_active bool DEFAULT true,
  custom_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, plant_local_id, task_key)
);
CREATE INDEX idx_pcs_user_next_due ON public.plant_care_schedules(user_id, next_due) WHERE is_active = true;
ALTER TABLE public.plant_care_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY pcs_own ON public.plant_care_schedules FOR ALL USING (user_id = (SELECT auth.uid()));
CREATE TRIGGER _touch_pcs BEFORE UPDATE ON public.plant_care_schedules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Garten-Milestones (Achievements pro Garten)
CREATE TABLE public.garden_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_slug text NOT NULL,
  achieved_at timestamptz DEFAULT now(),
  data jsonb,
  UNIQUE (user_id, milestone_slug)
);
CREATE INDEX ON public.garden_milestones(user_id, achieved_at desc);
ALTER TABLE public.garden_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY gm_own ON public.garden_milestones FOR ALL USING (user_id = (SELECT auth.uid()));

-- 4) Wetter-Log pro Garten (für YoY-Vergleich + KI-Lernen)
CREATE TABLE public.weather_log_per_garden (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  min_temp_c numeric,
  max_temp_c numeric,
  precip_mm numeric,
  frost_risk bool,
  source text DEFAULT 'open-meteo',
  raw_data jsonb,
  UNIQUE (user_id, date)
);
CREATE INDEX ON public.weather_log_per_garden(user_id, date desc);
ALTER TABLE public.weather_log_per_garden ENABLE ROW LEVEL SECURITY;
CREATE POLICY wlpg_own ON public.weather_log_per_garden FOR ALL USING (user_id = (SELECT auth.uid()));
```

Frontend optional in v26.57: nur das Schema deployen, UI später.

#### **v26.58 · User-Engagement-Tabellen** (4-6h)
- `achievement_progress` (uid, achievement_slug, current_value, target_value, last_updated)
- `weekly_challenges` (id, week_iso, title, description, reward_xp, condition jsonb, active_until)
- `user_weekly_challenge_progress` (uid, challenge_id, completed_at, progress jsonb)
- `garden_score_history` (uid, computed_at, score, breakdown jsonb)
- `social_garden_visits` (visitor_uid, host_uid, ts, viewed_garden_id)

### 🟡 P2 — Refactoring (langfristig)

#### **v26.60+: Sync-Engines konsolidieren**
- Z.62331 v23.47-IIFE und Z.57226 v24.23-IIFE überlappen. v23.47 entfernen, v24.23 als Single-Source.
- Migrations-Schritt: Stille Caller via `grep -n 'gs_garden_sync_queue\|gsCloudSync\.push\(Diary\|Harvest\)'` finden + migrieren.

#### **v26.65+: Säkalender-DB aus species-Tabelle**
- `GS_SAE_DB` inline (40 Pflanzen Z.6426+) → `species WHERE has_sowing_data=true`
- Migration: ALTER species ADD `sowing_indoor int[], sowing_outdoor int[], harvest_months int[], germ_days_min/max, plant_depth_cm, spacing_cm, sowing_tip text`
- Lazy-Load aus DB

#### **v26.70+: myPlants-Schema in eigene Tabelle**
- `user_plants.data.plants[]` JSON-Blob → `plant_instances`-Tabelle
- Vorteile: Cross-Plant-Queries, Server-Cron-Reminders sauberer, kein Blob-Konflikt mehr
- Großer Frontend-Umbau — vorher in commit-Message + STATUS.md Note `[BREAKING]`

### 🟢 P3 — Polish-Sprints (aus CODE_AUFTRAEGE_v26.51_POLISH.md)

Bereits priorisiert — wenn P0/P1-Sprints fertig oder du dazwischen Lust hast:
- **v26.51 PDF-Import-Workflow** (66 pending book_ingest_jobs!) — Cowork hat v26.51-Nummer für Mein-Garten vergeben, du fährst die alten Polish-Nummern weiter hoch (v26.61+)
- v26.62 CH-Erhaltungssorten Sub-Tab (12. Wissen-Sub-Tab)
- v26.63 Admin-Telemetrie-Dashboard
- v26.64 A11y-Pass
- v26.65 Loading-/Empty-/Error-States
- v26.66 Mobile-Refinement
- v26.67 Wave-15 Frontend

---

## 2 · Hourly-Audit-Schleife (NEU autonom-Modus)

Wie v24.42-v24.50 Pass-1 bis Pass-11: zwischen Sprint-Bumps läuft eine **autonome Audit-Schleife**.

**Pattern:**
1. `grep` über aktuelle index.html nach Code-Smells (Liste unten)
2. Wenn >0 Findings: ein „Polish-Bump" v26.X.Y mit ≤10 Fixes
3. Audit-Doc in `outputs/GreenScan Hourly-Audit vX.Y — <date> Pass N.md`
4. Erkenntnisse in `21_AUDIT_FINDINGS.md` (Workspace-Root) ergänzen

**Code-Smells (immer wieder prüfen):**
- `confirm(` / `alert(` / `prompt(` (außer in v26.51-getouchten Stellen) → `gsConfirmModal` / `gsToast`
- `fetch(` ohne `_gsFetch` → migrieren (bare fetch Code-Pfad-Sites)
- `localStorage.getItem/setItem` ohne `gsStore` (außer in v26.51-State-Sync-Keys)
- `100vh` außerhalb Release-Notes → `100dvh`
- z-index Hardcoded außerhalb 9 Token → `var(--z-*)`
- `<input>` ohne `maxlength`
- `setInterval(` ohne Handle in `window._gsXxxInterval`
- 404 Edge-Function-Calls (Functions die nicht (mehr) existieren)
- innerHTML mit User-Input ohne `gsSafeHTML` Escape

**Cap:** Nicht mehr als 1 Polish-Bump pro 4h. Sonst Audit-Doc anlegen + bei nächstem Sprint einbauen.

---

## 3 · Boundaries — was Cowork macht, was du machst

| Bereich | Cowork (Fernando-getriggert) | Du (autonom) |
|---|---|---|
| Memory-Files | Owner | Liest aus, signalisiert Drift |
| Mein-Garten-Audit Re-Run | quartalsweise | Inkrementelle Findings in 21_AUDIT_FINDINGS |
| Migrations < 100 Z | optional | Standard-Pfad |
| Migrations > 100 Z (Breaking) | Review erbeten | Vorab in STATUS.md notieren |
| Edge-Function-Deploy | gelegentlich | Standard-Pfad |
| Stripe-Code | Migrations OK, Live-Switch NEIN | Nur Bug-Fixes, kein Live-Mode |
| Auth-/Account-Delete-Pfad | Review-Pflicht | Nicht ohne Cowork |
| Frontend-Refactor < 200 Z | optional | Standard-Pfad |
| Frontend-Refactor > 200 Z | Review-Pflicht | STATUS.md `[BREAKING]` notieren, dann pushen |
| AR-View / Voice-Mode | optional | Standard-Pfad |
| Knowledge-Bulk-Gen-Topic-Add | optional | Standard-Pfad |
| Plugin-Dev | Cowork-only | – |

---

## 4 · STATUS.md im repo-clone — Pflicht-Aktualisierung

Bei JEDEM Push: `STATUS.md` updaten mit:
- aktuelle Version (matches GS_VERSION)
- aktive Sprint-Nummer (z.B. v26.52)
- letzter Push commit-hash
- nächstes geplantes Ziel
- Bekannte Probleme

Cowork liest STATUS.md beim Boot — das ist die Live-Brücke zwischen den beiden.

---

## 5 · Verify-Checklist VOR jedem Push

```bash
# 1. Inline-Scripts node --check
# Block 1: 1476-1581, Block 2: 5921-59458, Block 3: 61588-61603,
# Block 4: 62332-62621, Block 5: 62625-62999, Block 6: 63034-63702
# (Boundaries verschieben sich; aktuelle via grep '<script>\|</script>' index.html)

# 2. Version-Konsistenz
grep "GS_VERSION = '" index.html
grep "VERSION = 'gs-v" sw.js
head -1 _headers
grep 'app-version' index.html

# 3. manifest.json validate
python3 -c "import json; json.load(open('manifest.json'))"

# 4. GS_RELEASES-Array hat aktuellen Eintrag oben
head -200 index.html | grep -A2 "window.GS_RELEASES"

# 5. git status — keine ungewollten Files
git status
```

**Push-Command (Standard):**
```bash
git add -A
git commit -m "vXX.YY: <emoji> <kurz-zusammenfassung>"
git push origin main
# Cloudflare Pages deployed automatisch (~30s)
```

---

## 6 · Master-Pipeline-Liste (15 nächste Sprints)

1. v26.52 Plant-+ Diary-Fotos Storage-Bucket 🔴 P0
2. v26.53 Ernte-Schema-Erweiterung 🔴 P0
3. v26.54 Frost-Server-Cron + Wetter-Cache 🔴 P0
4. v26.55a-d species 2'837→4'342 🟠 P1 (4 Sub-Bumps)
5. v26.56 Knowledge-Tables vertiefen 🟠 P1
6. v26.57 Mein-Garten neue Tabellen 🟠 P1
7. v26.58 User-Engagement-Tabellen 🟠 P1
8. v26.61 PDF-Import-Workflow Admin 🟢 P3
9. v26.62 CH-Erhaltungssorten Sub-Tab 🟢 P3
10. v26.63 Admin-Telemetrie-Dashboard 🟢 P3
11. v26.64 A11y-Pass 🟢 P3
12. v26.65 Loading/Empty/Error-States 🟢 P3
13. v26.66 Mobile-Refinement 🟢 P3
14. v26.67 Wave-15 Frontend 🟢 P3
15. v26.70 myPlants → plant_instances (Breaking, koordinieren) 🟡 P2

Wenn diese 15 durch: neue Pipeline anlegen + Cowork pingen via STATUS.md-Note.

---

**Reference:**
- Cowork-Audit: `../MEIN_GARTEN_AUDIT_v26.51.md`
- Polish-Aufträge: `../CODE_AUFTRAEGE_v26.51_POLISH.md`
- Status: `../AUDIT_REPORT_2026-05-24.md`
- Auftrag-Template (für eigene Mini-Aufträge falls du untergliederst): `../50_AUFTRAG_TEMPLATE.md`

**Erstellt:** Cowork-Claude 2026-05-27.
