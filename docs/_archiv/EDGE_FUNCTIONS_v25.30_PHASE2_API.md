# Edge-Function-API v25.30+ Phase-2-Features (Cowork pre-deployed 2026-05-11)

> **Status:** Backend für 3 nächste Features KOMPLETT LIVE. Code kann jeden Sprint sofort nach v25.28 starten.

---

## 🩺 v25.30 — KI-Pflanzendoktor

### Endpoint
```
POST https://vowbiueikwrauuceilhc.supabase.co/functions/v1/plant-doctor-diagnose
Auth: Bearer user-token (verify_jwt: true)
```

### Request
```json
{
  "photo": "<base64-jpeg ohne data:image/jpeg;base64,>",
  "species_lat": "Solanum lycopersicum",
  "species_name": "Tomate",
  "symptoms": ["yellow_leaves", "wilting", "spots"],
  "user_note": "Pflanze steht im Hochbeet seit 3 Wochen, täglich gegossen",
  "plant_local_id": "plant_abc123",
  "save_history": true
}
```

### Response 200
```json
{
  "ok": true,
  "diagnosis": {
    "hypotheses": [
      { "name": "Krautfäule (Phytophthora)", "confidence": 0.78, "reason": "Braune Flecken auf Blättern + feuchtes Wetter" },
      { "name": "Wurzelfäule", "confidence": 0.15, "reason": "..." },
      { "name": "Nährstoffmangel (N)", "confidence": 0.07, "reason": "..." }
    ],
    "top": "Krautfäule (Phytophthora)",
    "urgency": "high",
    "visible_symptoms": ["braune Blattflecken", "welke untere Blätter"]
  },
  "treatment_plan": {
    "steps": [
      { "title": "Befallene Blätter entfernen", "description": "Sofort, in Plastiktüte entsorgen — NICHT auf Kompost", "when": "sofort", "priority": 1 },
      { "title": "Bordeaux-Brühe spritzen", "description": "Bio-zertifiziert, Anwendung früh morgens oder abends", "when": "diese woche", "priority": 2 }
    ],
    "natural_remedies": ["Schachtelhalm-Tee als Stärkungs-Spritzung", "Mulchschicht entfernen für bessere Luftzirkulation"],
    "when_call_pro": "Wenn nach 7 Tagen keine Besserung oder Befall auf andere Tomaten übergreift"
  },
  "history_id": "uuid-or-null",
  "tokens": { "input": 1234, "output": 2345 }
}
```

### Response Errors
- `400` — photo fehlt oder zu kurz
- `401` — kein/ungültiges Bearer-Token
- `503` — Anthropic-API-Key fehlt
- `500` — Anthropic-Error oder JSON-Parse-Fail

### DB-Schema `plant_doctor_history`
```
id, user_id, garden_id?, plant_local_id?, species_lat?,
photo_url?, symptoms (text[]), user_note?,
ai_diagnosis (jsonb), treatment_plan (jsonb),
user_followup?, followup_at?, model, tokens_in, tokens_out, created_at
```
**RLS:** SELECT/INSERT/UPDATE/DELETE jeweils own (`user_id = auth.uid()`)

### Knowledge-Boost
Edge-Fn lädt automatisch Top-8 relevante `plant_diseases` als Context (Symptom- ODER Species-Match) → bessere Diagnose-Qualität.

### Cost pro Diagnose
~$0.05-0.08 (Sonnet 4.5 + Foto + JSON-Output ~3000 Tokens)

### Frontend-Pflicht (Code)
- Garten-Tab → neuer Action-Button "🩺 Diagnose"
- Modal: Foto-Picker + Multi-Select Symptome + Freitext + Submit
- Result-Render: Hypothesen-Card mit Confidence-Bar, Treatment-Steps, "Pro?"-Hint
- History-Tab im Pflanzen-Detail mit Filter (gelöst/ungelöst)
- User-Followup-Buttons ("Hilfreich" / "Schlechter geworden" / "Profi-Termin")
- Optional: Pay-per-Use für Free-User (CHF 0.20) via Stripe analog zu expert_verification

---

## 🥕 v25.31 — Erntekalender + Statistik

### Backend bereits LIVE — Code braucht keinen Edge-Fn-Call

### DB-Schema `harvest_log`
```
id, user_id, garden_id?, plant_local_id?,
species_lat?, species_name?,
harvested_at (DATE, default today),
amount_value (numeric), amount_unit ('g'|'kg'|'stk'|'bund'|'l'|'ml'|'tasse'),
photo_url?, note?, quality_rating (1-5)?, created_at
```
**RLS:** own-data alle Operations

### View `v_harvest_stats_per_user`
```sql
SELECT * FROM v_harvest_stats_per_user
WHERE user_id = '<uid>' AND year = 2026
ORDER BY total_grams DESC;
```
Liefert: `species_lat, species_name, harvest_count, total_grams, total_pieces, avg_quality, first_harvest, last_harvest`

### Frontend-Pflicht (Code)
- Pflanzen-Detail → neuer Tab "🥕 Ernte" mit Liste + Add-Button
- Add-Modal: Datum-Picker (default heute) + Menge + Unit-Select + Foto + Note + Quality-Rating
- Garten-Tab Header: "Diese Saison: X kg Ernte aus Y Pflanzen"
- Statistik-Tab: Recharts mit Bar-Chart pro Species + Jahres-Vergleich
- Export-Button: CSV oder PDF (html2pdf wie KI-Plan-Export)

### REST-Calls
```js
// INSERT
POST /rest/v1/harvest_log
body: { user_id, plant_local_id, species_lat, species_name, harvested_at, amount_value, amount_unit, ... }

// LIST pro Pflanze
GET /rest/v1/harvest_log?plant_local_id=eq.<id>&order=harvested_at.desc

// STATS
GET /rest/v1/v_harvest_stats_per_user?user_id=eq.<uid>&year=eq.2026&order=total_grams.desc
```

---

## 📐 v25.32 — AR-View MVP (P3, optional)

### Backend bereits LIVE (Tabelle leer, glTF-Modelle separater Aufwand)

### DB-Schema `ar_models`
```
id, species_lat (UNIQUE), gltf_url?, low_poly_url?,
scale_factor (default 1.0), default_height_cm,
source ('sketchfab'|'kaggle'|'self-rendered'|'placeholder'),
attribution, created_at, updated_at
```
**RLS:** SELECT all (anon + auth)

### Frontend-Pflicht (Code)
- KI-Planer-Plan → "🪟 In meinem Raum sehen"-Button pro Pflanze
- WebXR-Polyfill + Three.js ARButton
- GET `/rest/v1/ar_models?species_lat=eq.<lat>&select=gltf_url,low_poly_url,scale_factor`
- Falls keine glTF → Fallback Cylinder mit species.mature_height_cm
- Screenshot-Funktion "📸 Speichern"

### Cowork-TODO (separat, kein Block für Code)
- glTF-Modelle aus Sketchfab/Kaggle curaten + in ar_models seeden (1-2 Tage)
- Optional: glTF-Optimierungs-Edge-Fn für mobile (low_poly_url generieren)

---

## ✅ Definition of Done v25.30+v25.31

- [ ] **v25.30** Diagnose-Modal komplett funktional inkl. History-Tab
- [ ] **v25.31** Erntekalender mit Add/List/Stats/Export
- [ ] Bei Erfolg: v25.32 AR-View nach Sketchfab-Curate

**Stand:** 2026-05-11 nach v25.29 · 3 Phase-2-Backends LIVE
