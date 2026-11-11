# AUFTRAG v26.18 — AR-View MVP („In meinem Raum sehen")

**Owner:** Claude Code (Frontend, mit Supabase-Anbindung).
**Priorität:** P2 (Killer-Feature für Marketplace + KI-Planer).
**Erwartete Dauer:** ~4-6 Std (Three.js + glTF-Loader + ar_models-Anbindung + Fallback-Geometrie).
**Vorbedingung:** ✅ Tabelle `ar_models` existiert mit 30 Seed-Einträgen (gltf_url=NULL → Fallback verwenden).

---

## Was und warum

GreenScan-User sollen vor dem Kauf/Planen sehen wie eine Pflanze in ihrem Raum aussieht — als platzhaltergrößes 3D-Modell, AR-kompatibel.

Use-Cases:
1. **Marketplace:** „Wie groß wird der Olivenbaum den ich kaufe?" → AR-Vorschau in 1.5m Höhe im Wohnzimmer
2. **KI-Planer:** Beim Bepflanzen eines Beets → „So sieht dein Beet in 6 Monaten aus" (mehrere Pflanzen positioniert)
3. **Detailansicht Pflanze:** Im Scan-Result-Screen oder im Pflanzen-Profile

---

## Architektur

### 1. DB-Layer (READY)

Tabelle `ar_models`:
```
id (uuid), species_lat (text NOT NULL UNIQUE), gltf_url (text),
low_poly_url (text), scale_factor (numeric, default 1.0),
default_height_cm (integer), source (text), attribution (text)
```

**30 Pflanzen sind geseedet** mit gltf_url=NULL (Code's AR-View muss Fallback-Geometrie rendern) und `default_height_cm` als Größenangabe. Liste:
- Gemüse: Tomate, Paprika, Gurke, Zucchini, Salat, Möhre, Kohl, Zwiebel, Knoblauch, Bohne, Erbse, Kartoffel
- Beeren: Erdbeere, Himbeere, Schwarze Johannisbeere
- Obstbäume: Apfel, Birne, Kirsche
- Zier: Rose, Lavendel, Sonnenblume, Ringelblume, Tagetes, Weinrebe
- Kräuter: Rosmarin, Basilikum, Pfefferminze, Salbei, Thymian, Petersilie

Query:
```js
const { data: arModel } = await sbFetch(`ar_models?species_lat=eq.${species_lat}`);
```

### 2. Three.js Setup

Importe (defer-OK, im Body):
```html
<script defer src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
```

(CSP `script-src` muss `cdn.jsdelivr.net` zulassen — siehe `_headers`. Cowork hat das bereits drin.)

### 3. Module — Frontend-Funktionen

#### `gsAROpen(species_lat, opts)` → Hauptentry

```js
window.gsAROpen = async function(species_lat, opts={}) {
  // 1) ar_models Eintrag holen
  const { data: rows } = await sbFetch(`ar_models?species_lat=eq.${encodeURIComponent(species_lat)}&select=*`);
  const model = rows?.[0] || null;

  // 2) Modal öffnen
  const modal = _gsAROpenModal();

  // 3) Renderer + Szene initialisieren
  const { scene, camera, renderer, controls } = _gsARInitScene(modal.querySelector('canvas'));

  // 4) Modell laden ODER Fallback-Geometrie
  if (model?.gltf_url) {
    _gsARLoadGltf(scene, model.gltf_url, model);
  } else {
    _gsARRenderFallback(scene, species_lat, model);  // ← v26.18 wichtig
  }

  // 5) Render-Loop
  _gsARStartLoop(scene, camera, renderer, controls);

  // 6) Optional WebXR / Magic-Window
  if (opts.tryWebXR && navigator.xr) {
    _gsARTryWebXR(renderer);
  }
};
```

#### `_gsARRenderFallback(scene, species_lat, model)` → Procedural Plant

Da gltf_url=NULL: einfache Geometrie aus Stamm + Krone, Höhe aus `model.default_height_cm`, Farbe aus Pflanzenkategorie.

```js
function _gsARRenderFallback(scene, species_lat, model) {
  const heightM = (model?.default_height_cm || 50) / 100;  // → Meter
  const scale = model?.scale_factor || 1.0;

  // Stamm (Zylinder, Cube für Salat etc)
  const trunkHeight = heightM * 0.6;
  const trunkRadius = Math.max(0.01, heightM * 0.04);
  const trunkGeo = new THREE.CylinderGeometry(trunkRadius, trunkRadius * 1.2, trunkHeight, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4f3a, roughness: 0.85 });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = trunkHeight / 2;
  scene.add(trunk);

  // Krone — Kugel (oder mehrere Sphären für Strauch)
  const crownRadius = Math.max(0.05, heightM * 0.4);
  const crownGeo = new THREE.SphereGeometry(crownRadius, 16, 12);

  // Farbcode nach Kategorie (lookup tabellarisch im Frontend)
  const color = _gsARColorForSpecies(species_lat);
  const crownMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const crown = new THREE.Mesh(crownGeo, crownMat);
  crown.position.y = trunkHeight + crownRadius * 0.7;
  scene.add(crown);

  // Boden-Ebene (Schatten-Catcher)
  const groundGeo = new THREE.PlaneGeometry(2, 2);
  const groundMat = new THREE.ShadowMaterial({ opacity: 0.25 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Skalierung
  scene.scale.set(scale, scale, scale);

  // Höhen-Label
  _gsARAddHeightLabel(scene, heightM);
}

function _gsARColorForSpecies(species_lat) {
  const map = {
    'Solanum lycopersicum': 0xc62828,  // Tomate → rot
    'Capsicum annuum': 0xff6f00,       // Paprika → orange
    'Cucumis sativus': 0x2e7d32,       // Gurke → dunkelgrün
    'Lactuca sativa': 0x66bb6a,        // Salat → hellgrün
    'Lavandula angustifolia': 0x7e57c2, // Lavendel → violett
    'Rosa gallica': 0xec407a,          // Rose → pink
    'Helianthus annuus': 0xfdd835,     // Sonnenblume → gelb
    // ... weitere 23 — Code: bitte ausfüllen
  };
  return map[species_lat] || 0x4caf50;  // Default: Standard-Grün
}
```

### 4. WebXR-Mode (Optional, Phase 2)

Auf iOS Safari + ARKit / Android Chrome + ARCore:
- `navigator.xr.isSessionSupported('immersive-ar')` Pre-Check
- WebXRViewer button → starts AR mode mit `renderer.xr.setSession()`
- Reticle für Tap-to-Place (Bodenerkennung via hit-test)

**Für MVP NICHT zwingend!** Magic-Window-3D-Modus (Mouse-Drag, Pinch-Zoom) reicht.

### 5. Integrationspunkte

**A. Marketplace-Listing:** Im `marketplace_listings`-Card einen „AR-Vorschau"-Button (nur wenn `ar_models`-Eintrag existiert)
```js
gsAROpen(listing.species_lat, { tryWebXR: true });
```

**B. KI-Planer-Result:** Pro vorgeschlagener Pflanze im Plan einen kleinen 3D-Icon-Button. Tap → AR-View.

**C. Pflanzen-Profile (Scan-Result):** Im Detailscreen einen großen „In meinem Raum sehen"-CTA.

### 6. Fallback-UX wenn nicht supported

```js
function _gsARNotSupported() {
  const hasWebGL = !!window.WebGLRenderingContext;
  if (!hasWebGL) {
    gsToast('Dein Browser unterstützt 3D nicht. Update empfohlen.');
    return;
  }
  // Three.js fehlt evtl noch (defer load)
  if (typeof THREE === 'undefined') {
    gsToast('3D-Engine wird geladen — bitte gleich nochmal versuchen.');
    return;
  }
}
```

---

## Definition of Done

- [ ] `gsAROpen(species_lat)` funktioniert für alle 30 geseedete Pflanzen mit Fallback-Geometrie
- [ ] 3D-View hat OrbitControls (drag/pinch/zoom), Beleuchtung, Boden-Schatten
- [ ] Höhen-Label zeigt korrekte Größe in m
- [ ] „AR-Vorschau"-Button erscheint im Marketplace-Listing (wenn ar_models match)
- [ ] „In meinem Raum sehen"-Button im Pflanzen-Detailscreen
- [ ] Modal schließt Renderer + dispose()d Geometrien (kein Memory-Leak)
- [ ] WebXR-Probe-Check (kein zwingender AR-Mode für MVP)
- [ ] Mobile (iOS Safari + Android Chrome) getestet
- [ ] 7/7 Inline-Scripts node-clean
- [ ] sw.js VERSION-Bump auf v26.18
- [ ] GS_VERSION + meta + GS_RELEASES auf v26.18
- [ ] GS_RELEASES user_summary: „🪴 AR-Vorschau: Sieh, wie deine Pflanzen in deinem Raum aussehen — direkt im Browser."
- [ ] CSP `script-src` enthält `cdn.jsdelivr.net` (Cowork hat es)

## Commit-Message

```
v26.18: 🪴 AR-View MVP — In meinem Raum sehen via Three.js

- gsAROpen(species_lat) → öffnet Modal mit 3D-View
- ar_models-Tabelle als Source-of-Truth (30 Seed-Pflanzen)
- Fallback-Geometrie (Stamm+Krone) für gltf_url=NULL
- _gsARColorForSpecies-Lookup (30 Farben)
- Integration: Marketplace-Listing + Pflanzen-Detail + KI-Planer
- WebXR-Probe (nicht zwingend für MVP)
- Cleanup-Dispose-Pfad gegen Memory-Leaks

Cowork-Auftrag v26.18 erfüllt.
```

---

## Bonus: Echte glTF-Modelle nachschieben

Code kann später, wenn Modelle verfügbar:
1. Upload nach Supabase Storage `ar-models/` Bucket
2. `update ar_models set gltf_url='https://.../tomato.glb' where species_lat='Solanum lycopersicum'`
3. Fallback-Geometrie wird automatisch durch echtes Modell ersetzt

CC0-Quellen für Modelle:
- Sketchfab → CC0/CC-BY Filter → Botanik
- Smithsonian-3D
- Poly.cam Outdoor-Scans

---

**Geschrieben:** Cowork-Claude 2026-05-22 (DB-Wave-8 Sprint).
