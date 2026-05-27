# Auftrag v25.9 — KI-Planer Mega-Upgrade + 3D-Internet-Fix + DB-Erweiterung

> **Cowork-Briefing 2026-05-10.** Ziel: GreenScan-KI-Planer wird der **beste Garten-Planer** auf dem Markt. Plus: 3D-Visualisierung funktioniert offline. Plus: Datenbanken werden 5-10× größer für mehr Intelligenz.
>
> **Owner:** Code (Frontend) + Cowork (Backend, DB-Migrations, Daten-Seeding via Edge-AI).

---

## 🟢 Status-Snapshot vor Sprint-Start

- ✅ v25.4 → v25.8 LIVE (Auth-Polish + Trial-Modal + Mein-Abo-Tab)
- ✅ Stripe-Backend KOMPLETT funktional (Webhook rotiert, Schema vollständig, Card sollte gehen)
- ✅ stripe-portal v3 mit `flow=cancel/reactivate` deployed (Code's gsConfirmCancelSub funktioniert direkt)
- 🟡 Test-Card-Verify wartet auf Fernando-Re-Test mit v25.8 LIVE

**DB-Counts heute:**
| Tabelle | aktuell | Ziel | Lücke |
|---|---|---|---|
| species (Cloud) | 99 | 542+ (alle Frontend-Inline-DB-Arten) | **massiv — Knowledge-Search hat nur 18% Coverage** |
| recipes | 30 | 100+ | mittel |
| remedies | 30 | 100+ | mittel |
| folk_lore | 20 | 50+ | mittel |
| garden_techniques | 20 | 50+ | mittel |
| daily_quizzes | 65 | 200+ | groß (für mehr Vielfalt) |

---

## 🎯 SPRINT v25.9 — Drei Mega-Themen

### 🎨 THEMA 1 — KI-Planer „Visuelle Selbst-Aufarbeitung" + intelligenter

**Vision (Fernando-Wunsch):**
> „Der KI-Planer soll das Visuelle selber aufarbeiten und der beste Planer werden. Effizienter, intelligenter, einfacher, präziser."

**Konkret — was Code baut (v25.9):**

#### 1.1 — Smarter Multi-Foto-Scan
**Aktuell:** 1 Foto pro Schritt (Fläche / Boden separat).
**Neu:** „Garten-Scan-Wizard" — 3 Fotos in 1 Flow:
- Foto 1: Top-Down (Vogelperspektive der Fläche)
- Foto 2: Boden-Close-up
- Foto 3: Umgebung/Wand/Zaun (für Licht-Kontext)
- Optional: GPS-Koordinaten (für Klimazone-Auto-Detection)

Vision-AI bekommt alle 3 Fotos + Metadata in EINEM Call → konsolidierte Analyse.

#### 1.2 — Strukturiertes JSON-Response-Schema
Aktueller Prompt liefert freie Text-Antworten. Neuer Prompt zwingt JSON-Output:

```json
{
  "site_analysis": {
    "size_m2": 12.5,
    "shape": "rectangular",
    "soil": { "type": "lehmig-humos", "ph_estimate": 6.5, "moisture": "mittel" },
    "light": { "level": "halbschatten", "hours_per_day": 5.5, "shade_source": "Hauswand Süd" },
    "climate_zone": "H3 (Mittelland)",
    "existing_plants": [{"name":"Lavendel","health":"gut","area_m2":0.8}],
    "challenges": ["Steile Hanglage", "Frostgefahr Mai"]
  },
  "recommended_plants": [
    {
      "name": "Tomate Gardeners Delight",
      "lat": "Solanum lycopersicum",
      "category": "Gemüse",
      "position": { "x": 1.2, "y": 2.5, "row": 1 },
      "qty": 4,
      "spacing_cm": 50,
      "sow_date": "2026-04-15",
      "harvest_date": "2026-08-01",
      "yield_kg_estimate": 8,
      "companion_plants": ["Basilikum", "Ringelblume"],
      "incompatible_plants": ["Kartoffel", "Fenchel"],
      "care_intensity": "mittel",
      "reason": "Halbschatten mit 5h Sonne reicht, Lehmboden ideal"
    }
    // ... weitere 8-15 Pflanzen
  ],
  "layout_grid": { "width_m": 3, "depth_m": 4, "rows": 5, "cols": 3 },
  "monthly_calendar": {
    "april": ["Tomaten vorziehen drinnen", "Boden lockern"],
    "may": ["Tomaten auspflanzen nach Eisheiligen", "Mulchen"],
    // ... 12 Monate
  },
  "tools_needed": ["Spaten", "Pflanzkelle", "Gießkanne 10L", "Mulchmaterial"],
  "warnings": ["Eisheilige bis 15. Mai beachten"],
  "follow_up_questions": ["Hast du eine Wassertonne?", "Soll Schnecken-Schutz eingeplant werden?"]
}
```

#### 1.3 — Plan-Visualisierung 2D + 3D
**2D-SVG (responsive, mobile-first):**
- viewBox + preserveAspectRatio="xMidYMid meet"
- Pflanzen als Kreis-Symbole mit Emoji + Name
- 1m-Grid im Hintergrund
- Tap auf Pflanze → Detail-Modal mit Pflege-Tipps

**3D-Render (NEU für v25.9 — Three.js):**
- Top-Down + 3D-Toggle
- Beet als braune Plane, Pflanzen als 3D-Cylinder/Cone
- Pflanzen-Größe = Erwachsene-Höhe aus DB
- Drag-to-Rotate, Pinch-Zoom
- **Funktioniert offline** (siehe Thema 2)

#### 1.4 — Plan-Iteration mit Chat
Nach Plan-Generierung:
- Chat-Bar unten: „Was magst du ändern?"
- User: „Ich will keinen Bambus, lieber Schnittlauch"
- KI generiert neuen Plan-Diff (nur die geänderte Pflanze ersetzt)
- 5 Iterations-Limits pro Plan (Token-Schutz)

#### 1.5 — Plan als PDF-Export-Polish
- A4-Format mit Logo + Datum
- 2D-Skizze + Pflanzenliste + Monatskalender + Werkzeug-Liste
- QR-Code zur Cloud-Version (für Sharing)
- Mobile-Download-Fallback (kein Print-Modal mehr)

#### 1.6 — Auto-Sync mit Garten-Tagebuch
- Beim Plan-Speichern: alle empfohlenen Pflanzen werden als „Geplant"-Status in `myPlants` angelegt
- Bei jeder echten Pflanzung → Status auf „Eingepflanzt"
- Reminder-Cron checkt `recommended` Pflanzungen → Push „Diese Woche Tomaten auspflanzen"

---

### 🌐 THEMA 2 — 3D-Internet-Fix (Three.js + Leaflet offline-fähig)

**Aktuell (Cowork-Diagnose 2026-05-10):**
4 Stellen zeigen „benötigt Internet"-Fallback:
- Z.34887: Karte (Leaflet)
- Z.36300: 3D-Track (Wandern)
- Z.40078: KI-Planer 3D
- Z.40630: Garten-Detail 3D

**Root-Cause:** Three.js + Leaflet werden von externer CDN (unpkg.com) geladen. Im PWA-Standalone-Mode oder bei flakiger Verbindung → Loader-Fail → Fallback-Meldung.

**Fix in `sw.js`:**
```js
const STATIC_ASSETS = [
  // ... existing
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/three@0.128.0/build/three.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs',
];

// Plus: NEVER_CACHE_HOSTS um unpkg.com + cdnjs erweitern? NEIN — wir WOLLEN sie cachen.
// Stattdessen: unpkg.com + cdnjs.cloudflare.com aus NO_CACHE_HOSTS rauslassen wenn drin.
```

**Plus:** Three.js Loader (`gsTrack3DLoadThree`) muss bei Cache-Hit sofort init machen, nicht warten auf network-fetch.

**Verify:**
- Flugmodus → App öffnen → KI-Planer → 3D-View → muss funktionieren
- Karte → Leaflet zeigt zumindest gecachte Tiles

---

### 📚 THEMA 3 — Datenbank-Erweiterung (Knowledge × 5)

**Pflicht-Erweiterungen für Pre-Release:**

| Tabelle | Heute | Ziel | Quelle |
|---|---|---|---|
| `species` | 99 | **600+** | Frontend-Inline-DB (542 Arten) + 50-100 weitere via Vision-AI-Bulk-Ingest |
| `recipes` | 30 | 150+ | Buch-Ingest-Pipeline (PDF-Upload für Experten) |
| `remedies` | 30 | 100+ | dito |
| `folk_lore` | 20 | 60+ | dito |
| `garden_techniques` | 20 | 80+ | dito + KI-Generierung |
| `daily_quizzes` | 65 | 250+ | KI-Generierung aus species/recipes (Multi-Choice-Auto-Gen) |
| `did_you_know_facts` | 80 | 200+ | KI-Generierung pro species |
| `seasonal_tips` | 60 | 150+ | dito |

**Cowork macht das Backend-Seeding** parallel zu Code:
1. **species**: Frontend-Inline-DB extrahieren (Z.13050-16569 via grep) → Bulk-INSERT via Edge-Fn (Vision-AI für fehlende Felder wie `light_min`, `water_need`, `bloom_months`)
2. **recipes/remedies/folk_lore/garden_techniques**: KI-Bulk-Generation via stripe-bootstrap-ähnliches Pattern (Edge-Fn `knowledge-bulk-seed` mit Schema-Validation)
3. **daily_quizzes**: Auto-Gen aus species (für jede Art 2-3 Fragen: „Welche Familie?", „Wann blüht?", „Essbar?") via callAI mit JSON-Schema
4. **did_you_know_facts + seasonal_tips**: KI generiert pro species 2 Fakten + 1 saisonalen Tipp

**Schema-Erweiterungen für mehr Intelligenz:**

```sql
-- species: mehr Felder für KI-Planer
ALTER TABLE species ADD COLUMN IF NOT EXISTS:
  - mature_height_cm integer
  - mature_width_cm integer
  - root_depth_cm integer
  - water_need_l_per_week numeric
  - frost_tolerance_c numeric  -- e.g. -5.0
  - companion_plants text[]    -- Pflanzen die gut nebeneinander wachsen
  - incompatible_plants text[]
  - care_intensity text        -- 'low' | 'medium' | 'high'
  - growth_phases jsonb        -- {sowing:[...], germination:14, flowering:[6,7,8]}
  - yield_per_plant_g integer
  - storage_method text
  - propagation_methods text[]
  - common_pests text[]
  - common_diseases text[]
  - soil_compaction_tolerance text
  - edible_parts text[]        -- ['Frucht', 'Blatt', 'Wurzel']
  - flavor_profile jsonb       -- {sweet:3, sour:1, bitter:0}

-- garden_plans (NEUE Tabelle für KI-Planer-Output)
CREATE TABLE garden_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  garden_id uuid,
  title text,
  scan_input jsonb,        -- die 3 Fotos + Metadata
  ai_analysis jsonb,       -- structured JSON output
  layout_svg text,         -- generated SVG markup
  layout_3d_data jsonb,    -- {plants:[{x,y,height,model}]}
  status text DEFAULT 'draft',
  iterations jsonb DEFAULT '[]',  -- Chat-History für Plan-Iteration
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

---

## 🤝 Cowork-Pflichten (parallel zu Code v25.9)

### Sprint A (sofort, ~1 Tag)
1. ✅ A4 Test-Card-Verify nach Fernando-Re-Test
2. ✅ stripe-portal v3 deployed (heute 02:43 UTC)
3. **species-Bulk-Seed**: Frontend-Inline-DB extrahieren + via Edge-Fn `knowledge-bulk-seed` einfügen
4. **garden_plans-Tabelle anlegen** mit RLS (own-data)
5. **Schema-Erweiterung species** (alle neuen Spalten)
6. **Edge-Fn `garden-scan-analyze`** (Vision-AI-Wrapper mit JSON-Schema-Output)

### Sprint B (~2-3 Tage)
7. **Bulk-Seed recipes/remedies/folk_lore/garden_techniques** via KI-Generation
8. **daily_quizzes Auto-Gen** aus species
9. **Edge-Fn `plan-iterate`** für Chat-basierte Plan-Iteration
10. **Push-Reminder-Logic** für „Geplante Pflanzungen diese Woche"

### Sprint C (~1 Woche)
11. Stripe Live-Mode-Aktivierung-Verify
12. Echt-Geräte-Tests-Coordination
13. i18n-Generierung FR/IT für KI-Planer-Strings
14. Live-Smoke-Test nach jedem Code-Push

---

## ✅ Definition of Done v25.9

- [ ] **KI-Planer**: 3-Foto-Scan-Flow + JSON-Schema-Output + 2D-SVG responsive + 3D-Render funktional + Chat-Iteration
- [ ] **3D offline**: Three.js + Leaflet im sw.js cached, „benötigt Internet" Meldungen weg
- [ ] **DB**: species 600+, daily_quizzes 200+, recipes/remedies/folk_lore/garden_techniques verdoppelt
- [ ] **garden_plans-Tabelle** in use, Plans werden cloud-synced
- [ ] **Plan-Iteration via Chat** funktional (5 Iterations-Limit)
- [ ] **Auto-Sync KI-Plan → myPlants** als „Geplant"-Status
- [ ] 7/7 Inline-Scripts node --check ✓
- [ ] LIVE auf green-scan.ch (mehrere v25.9-v25.15 Mini-Bumps OK)

---

## Reihenfolge (Pflicht)

| Sprint | Wer | Was | Dauer |
|---|---|---|---|
| 1 | **Cowork** | species-Bulk-Seed + Schema-Erweiterung + garden_plans-Table + garden-scan-analyze Edge-Fn | 1 Tag |
| 2 | **Code** | KI-Planer 3-Foto-Scan-Wizard + JSON-Schema-Integration + 2D-SVG-Polish | 1-2 Tage |
| 3 | **Code** | 3D-Render via Three.js + sw.js-Cache-Update | 1 Tag |
| 4 | **Cowork** | Bulk-Seed recipes/remedies/folk_lore/garden_techniques + daily_quizzes Auto-Gen | 2 Tage |
| 5 | **Code** | Chat-Iteration + Auto-Sync myPlants + PDF-Export-Polish | 1 Tag |
| 6 | **Code+Fernando** | Live-Tests | 1 Tag |

**Total ~ 1 Woche** für Mega-Upgrade.

---

## ⚠️ Pflicht-Disziplin (nach v25.7-Hotfix-Lesson)

**NIE pushen ohne 7/7 grün.** Das v25.7-Inkident war menschlich verständlich, aber Hard-Lesson: jeder Push muss `node --check` 7/7 grün haben. Sonst sitzt der User auf einem broken App-Screen.

---

**Stand:** 2026-05-10 · Cowork-erstellt · 3 Mega-Themen + Sprint-Plan + DoD
