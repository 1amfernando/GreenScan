# Edge-Function-API für Code v25.9 KI-Planer-Integration

> **Cowork-deployed 2026-05-10.** Beide Functions LIVE + getestet bereit.

---

## 1) `garden-scan-analyze` — Multi-Foto Vision-Analyse

**Endpoint:** `POST https://vowbiueikwrauuceilhc.supabase.co/functions/v1/garden-scan-analyze`

**Auth:** Bearer-Token (verify_jwt: true → User muss eingeloggt sein)

**Request Body:**
```json
{
  "photos": ["<base64-jpeg-1>", "<base64-jpeg-2>", "<base64-jpeg-3>"],  // 1-3 Fotos
  "metadata": {
    "gps": { "lat": 47.3769, "lng": 8.5417 },
    "climate_zone": "H3",
    "user_preferences": {
      "categories": ["Gemüse", "Kräuter"],
      "avoid": ["Bambus", "Brennnessel"],
      "garden_type": "balcony|raised_bed|garden|wall"
    }
  },
  "save_as_plan": true,         // optional — speichert direkt in garden_plans
  "plan_title": "Mein Frühlings-Beet"  // optional
}
```

**Response 200:**
```json
{
  "ok": true,
  "analysis": {
    "site_analysis": { "size_m2": 12.5, "shape": "rectangular", "soil": {...}, "light": {...}, ... },
    "recommended_plants": [
      { "name": "Tomate Gardeners Delight", "lat": "Solanum lycopersicum", "category": "Gemüse",
        "position": { "x": 1.2, "y": 2.5, "row": 1 }, "qty": 4, "spacing_cm": 50,
        "sow_date": "2026-04-15", "harvest_date": "2026-08-01", "yield_kg_estimate": 8,
        "companion_plants": ["Basilikum"], "incompatible_plants": ["Kartoffel"],
        "care_intensity": "medium", "reason": "Halbschatten mit 5h reicht..." }
    ],
    "layout_grid": { "width_m": 3, "depth_m": 4, "rows": 5, "cols": 3 },
    "monthly_calendar": { "jan": [...], "feb": [...], ... "dez": [...] },
    "tools_needed": ["Spaten", ...],
    "warnings": ["Eisheilige bis 15. Mai..."],
    "follow_up_questions": [...]
  },
  "plan_id": "uuid-or-null",   // null wenn save_as_plan=false
  "tokens": { "input_tokens": 1234, "output_tokens": 2345 },
  "model": "claude-sonnet-4-20250514"
}
```

**Response Errors:**
- `400` — photos array missing/wrong size
- `401` — not authenticated
- `503` — Anthropic API key not configured (fallback chain: ENV → app_settings.global_anthropic_api_key)
- `502` — Anthropic API error oder JSON-Parse-Fail (mit `raw_preview` für Debug)

**Frontend-Integration (Beispiel):**
```js
async function gsRunGardenScan(photos, metadata) {
  const token = gsStore.get('gs_sb_token');
  const resp = await _gsFetch(SB_URL + '/functions/v1/garden-scan-analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
      'apikey': SB_KEY,
    },
    body: JSON.stringify({ photos, metadata, save_as_plan: true, plan_title: title }),
  }, 60000);  // 60s Timeout für AI-Call
  return await resp.json();
}
```

**Cost-Schätzung pro Call:** ~$0.05-0.10 (3 Bilder + JSON-Output ~3000 Tokens)

---

## 2) `plan-iterate` — Chat-basierte Plan-Änderung

**Endpoint:** `POST .../functions/v1/plan-iterate`

**Auth:** Bearer-Token (Owner-Check via plan.user_id)

**Request Body:**
```json
{
  "plan_id": "uuid-from-garden-scan-analyze",
  "user_message": "Ich will keinen Bambus, lieber Schnittlauch."
}
```

**Response 200:**
```json
{
  "ok": true,
  "plan_id": "uuid",
  "analysis": { ...komplettes neues Plan-JSON... },
  "change_summary": "Bambus durch Schnittlauch ersetzt (Position 2,1). Companion-Plants angepasst.",
  "iteration_count": 2,
  "iterations_remaining": 3
}
```

**Limit:** 5 Iterations pro Plan (HTTP 429 wenn überschritten).

**Frontend-Integration:**
```js
async function gsIteratePlan(planId, message) {
  const token = gsStore.get('gs_sb_token');
  const resp = await _gsFetch(SB_URL + '/functions/v1/plan-iterate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
      'apikey': SB_KEY,
    },
    body: JSON.stringify({ plan_id: planId, user_message: message }),
  }, 30000);
  return await resp.json();
}
```

---

## DB-Schema (Cowork bereits deployed)

### `garden_plans` Tabelle
```
id           uuid PK
user_id      uuid FK auth.users CASCADE
garden_id    uuid (optional reference zu user_gardens)
title        text
scan_input   jsonb  -- Foto-Refs + Metadata
ai_analysis  jsonb  -- structured Plan-JSON aus Edge-Fn
layout_svg   text   -- Code generiert via gsPPrenderPlan o.ä.
layout_3d_data jsonb -- für Three.js-Render
status       text   -- draft | active | archived
iterations   jsonb  -- Chat-History
starred      boolean
created_at, updated_at
```

**RLS:** own-data only (`auth.uid() = user_id` für SELECT/INSERT/UPDATE/DELETE).

### `species` Schema-Erweiterung (17 neue Spalten)
```
mature_height_cm, mature_width_cm, root_depth_cm,
water_need_l_per_week, frost_tolerance_c,
companion_plants[], incompatible_plants[],
care_intensity, growth_phases jsonb,
yield_per_plant_g, storage_method,
propagation_methods[], common_pests[], common_diseases[],
soil_compaction_tolerance, edible_parts[], flavor_profile jsonb
```

Frontend kann diese Felder direkt nutzen für Pflanzen-Detail-Modal-Erweiterung.

---

## Frontend-TODO für Code v25.11+

| Sub-Task | Was | Edge-Fn-Call |
|---|---|---|
| 1.1 | Multi-Foto-Wizard mit 3 Photo-Inputs (camera + gallery toggle) | direkter Datei-Capture |
| 1.2 | `gsRunGardenScan()` Wrapper für `garden-scan-analyze` | siehe oben |
| 1.3 | 2D-SVG-Render aus `analysis.layout_grid` + `recommended_plants[].position` | client-side, kein Edge-Call |
| 1.4 | 3D-Three.js-Render — Plane + Cylinder pro Pflanze, Höhe aus `species.mature_height_cm` | client-side mit cached Three.js (v25.9 sw.js fix) |
| 1.5 | Chat-Bar unten im Plan-Modal → `gsIteratePlan(planId, msg)` | `plan-iterate` |
| 1.6 | Auto-Sync: nach Plan-Save → INSERT in myPlants mit `status='planned'` | direkter DB-INSERT via sbFetch |
| 1.7 | PDF-Export: html2pdf oder window.print() Polish + Mobile-Fallback | client-side |

---

## Cowork-TODO (parallel)

- [ ] species Bulk-Seed aus Frontend-Inline-DB (jetzt extern in `data/plants.v1.js` — Cowork extrahiert + Cloud-INSERT)
- [ ] daily_quizzes Auto-Generation aus species (Edge-Fn `quiz-bulk-gen`)
- [ ] recipes/remedies/folk_lore/garden_techniques Bulk-Seed (Edge-Fn `knowledge-bulk-seed`)
- [ ] Test-Card-Verify nach Fernando-Test

---

**Stand:** 2026-05-10 · Cowork-Edge-Functions deployed · Code kann sofort starten
