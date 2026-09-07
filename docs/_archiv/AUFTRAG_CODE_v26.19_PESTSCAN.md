# AUFTRAG v26.19 — Schädlings-Scanner-Modus

**Owner:** Claude Code (Frontend + Edge-Fn).
**Priorität:** P1 (entlastet plant-doctor, eigener Use-Case).
**Erwartete Dauer:** ~3-5 Std.
**Vorbedingung:** ✅ Tabelle `plant_pests` mit 25 Schweizer Garten-Schädlingen geseedet.

---

## Was und warum

Aktuell läuft Schädlings-Identifikation nur über `plant-doctor-diagnose` (KI-Generalist mit `plant_diseases`-Knowledge). Spezial-Modus für Schädlinge fehlt — User fotografiert ein Blatt mit Blattläusen und kriegt „Pflanze unbestimmt" zurück.

Mit der neuen `plant_pests`-Tabelle (25 hochwertig kuratierte Einträge inkl. Bio-Behandlung) lässt sich ein dedizierter Modus bauen.

---

## Architektur

### 1. Edge-Fn `pest-identify` (NEU, deployen)

`supabase/functions/pest-identify/index.ts`

```ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const admin = createClient(supabaseUrl, svcKey);

  const { image_base64, media_type = "image/jpeg", host_plant = null } = await req.json();
  if (!image_base64) return new Response(JSON.stringify({ error: "missing image" }), { status: 400 });

  // 1) Knowledge-Inventory: Liste alle Schädlinge die zur Pflanze passen (oder alle wenn host_plant=null)
  let pestQuery = admin.from("plant_pests").select("slug,common_name_de,scientific_name,category,host_plants,symptoms,identification_tips");
  if (host_plant) pestQuery = pestQuery.contains("host_plants", [host_plant]);
  const { data: pests } = await pestQuery.limit(20);

  // 2) System-Prompt mit Knowledge-Kontext
  const knowledge = (pests || []).map(p =>
    `- ${p.slug} (${p.common_name_de}, ${p.scientific_name}): ${p.symptoms} | Tipps: ${p.identification_tips}`
  ).join("\n");

  const systemPrompt = `Du bist ein Experte für Schweizer Garten-Schädlinge. Analysiere das Foto und vergleiche mit dieser Knowledge-Base:\n\n${knowledge}\n\nAntworte JSON: { "matched_slug": "<slug oder null>", "confidence": 0-100, "reasoning": "<knapp>", "alternative_slugs": ["..."], "severity_observed": "gering|mittel|hoch", "advice": "<1-2 Sätze konkret>" }. Wenn unsicher: matched_slug=null und Hinweise geben.`;

  // 3) Anthropic Vision call
  const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: systemPrompt,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type, data: image_base64 } },
          { type: "text", text: `Identifiziere den Schädling. Host-Pflanze (falls bekannt): ${host_plant || "unbekannt"}.` }
        ]
      }]
    })
  });

  const aiJson = await aiResp.json();
  const text = aiJson.content?.[0]?.text || "{}";
  const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}");

  // 4) Vollständige Schädlings-Daten anreichern wenn match
  let fullPest = null;
  if (parsed.matched_slug) {
    const { data } = await admin.from("plant_pests").select("*").eq("slug", parsed.matched_slug).maybeSingle();
    fullPest = data;
  }

  return new Response(JSON.stringify({
    matched_slug: parsed.matched_slug,
    confidence: parsed.confidence,
    reasoning: parsed.reasoning,
    alternatives: parsed.alternative_slugs,
    severity: parsed.severity_observed,
    advice: parsed.advice,
    pest_detail: fullPest,
  }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});
```

Deploy:
```js
mcp__supabase__deploy_edge_function({
  project_id: "vowbiueikwrauuceilhc",
  name: "pest-identify",
  files: [{ name: "index.ts", content: "..." }],
  verify_jwt: true,  // requires user-JWT
});
```

### 2. Frontend — Schädlings-Scanner-Tab

Im Scan-Screen einen 3. Modus neben „Pflanze" und „Pilz":
- **🪲 Schädling** → öffnet Schädlings-Identifikation

#### `gsPestScanOpen()` Camera-Flow

```js
window.gsPestScanOpen = async function() {
  // Vorab: User fragen welche Pflanze betroffen ist (optional)
  const host = await _gsAskHostPlant();  // Modal mit Pflanzen-Picker oder Skip

  // Foto-Aufnahme — bestehende _gsCameraCapture nutzen
  const photoData = await _gsCameraCapture({ aspectRatio: '4:3' });

  // POST pest-identify
  const resp = await _gsFetch(`${SB_URL}/functions/v1/pest-identify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${gsAuthToken()}`,
    },
    body: JSON.stringify({
      image_base64: photoData.base64,
      media_type: photoData.mime,
      host_plant: host,
    }),
  }, 30000);

  const result = await resp.json();
  _gsPestScanShowResult(result);
};

function _gsPestScanShowResult(r) {
  if (!r.matched_slug || r.confidence < 40) {
    gsToast('Kein eindeutiger Schädling erkannt. Bitte Foto näher/schärfer.');
    return;
  }

  const p = r.pest_detail;
  // Render Detail-Card:
  const card = `
    <h2>${p.common_name_de} <small>(${p.scientific_name})</small></h2>
    <div class="severity severity-${r.severity}">Schwere: ${r.severity}</div>
    <p>${r.reasoning}</p>
    <h3>Schaden</h3>
    <p>${p.symptoms}</p>
    <h3>Bio-Behandlung</h3>
    <ul>${(p.treatment_organic || []).map(t => `<li>${t}</li>`).join('')}</ul>
    <h3>Vorbeugen</h3>
    <ul>${(p.prevention || []).map(t => `<li>${t}</li>`).join('')}</ul>
    <h3>Natürliche Feinde</h3>
    <p>${(p.natural_enemies || []).join(', ')}</p>
    <button onclick="gsPestScanAddToDiary('${p.slug}')">Im Garten-Tagebuch festhalten</button>
  `;
  _gsOpenModal({ title: '🪲 Schädling identifiziert', html: card });
}
```

#### Integration in Scan-Screen

In bestehendem Scan-Screen ein 3. Tab/Mode-Button:
```js
// Z. ~22000 wo Scan-Mode-Toggle ist
const modes = [
  { id: 'plant', label: '🌱 Pflanze', icon: 'flower' },
  { id: 'fungus', label: '🍄 Pilz', icon: 'mushroom' },
  { id: 'pest', label: '🪲 Schädling', icon: 'bug' },  // ← v26.19 NEU
];
```

### 3. Plant-Diary-Integration

Wenn User „Im Garten-Tagebuch festhalten" klickt:
```js
window.gsPestScanAddToDiary = async function(slug) {
  // Insert in plant_diagnoses oder neue garden_diary-Entry
  // Mit pest_slug, photo_url, host_plant, sent_at
  await sbFetch('garden_diary', {
    method: 'POST',
    body: JSON.stringify({
      type: 'pest_observation',
      pest_slug: slug,
      photo_url: photoUrl,  // ggf zu Storage hochladen
      notes: r.advice,
    }),
  });
  gsToast('Im Garten-Tagebuch gespeichert. Erinnerung in 7 Tagen?');
};
```

---

## Definition of Done

- [ ] Edge-Fn `pest-identify` v1 deployed (verify_jwt: true)
- [ ] Frontend Scan-Screen hat 3. Tab „🪲 Schädling"
- [ ] `gsPestScanOpen()` öffnet Camera, postet zu pest-identify, zeigt Ergebnis
- [ ] Ergebnis-Modal mit allen Daten aus `plant_pests` (Symptome, Bio-Behandlung, Prävention, Feinde)
- [ ] „Im Garten-Tagebuch festhalten"-Button funktioniert
- [ ] Confidence < 40% → Toast „bitte näher" statt false-positive
- [ ] 7/7 Inline-Scripts node-clean
- [ ] sw.js VERSION-Bump auf v26.19
- [ ] GS_RELEASES Eintrag mit user_summary: „🪲 Schädlings-Scanner: Foto vom Befall → KI identifiziert + Bio-Behandlung sofort"

## Commit-Message

```
v26.19: 🪲 Schädlings-Scanner — KI + plant_pests-Knowledge

- Edge-Fn pest-identify v1 mit Anthropic-Vision + 25 Schädlings-DB
- Frontend 3. Scan-Modus "🪲 Schädling"
- gsPestScanOpen → Camera → Edge-Fn → Detail-Modal
- Bio-Behandlung + Prävention + Feinde aus plant_pests
- Optional Host-Plant Picker für bessere Treffer

Cowork-Auftrag v26.19 erfüllt.
```

---

**Geschrieben:** Cowork-Claude 2026-05-22.
