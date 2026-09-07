# AUFTRAG v26.0 → v26.10 — Roadmap für autonome Arbeit (Fernando weg, mehrere Tage)

> **Stand 2026-05-17 nach v25.38 LIVE.**
> **Fernando-Anweisung:** „Ich habe keine Zeit nächste Tage. Mache alles selbstständig."
>
> **Code-Marschrichtung:** Eigenständig Sprint für Sprint abarbeiten, push, verify, nächster. Cowork verifiziert parallel via Chrome-MCP nach jedem Push.

---

## 🎯 v26.0 — Pre-Release-stable Tag (5 Min)

```bash
cd repo-clone
git tag -a v26.0 -m "v26.0 Pre-Release-stable

Konkurrenz-Killer-Sprint v25.21-v25.38 alle LIVE:
✅ Mischkultur-Score · Foto-Verlauf · Voice-Mode
✅ Push-Notifications · i18n FR/IT/GSW
✅ Community-Experten · Marketplace-Repair
✅ KI-Pflanzendoktor · Erntekalender
✅ Auth-Bug-Fixes · gsStore-Welle 4
✅ Self-Host Leaflet+Three.js (kein CDN-Risk)
✅ Pro-only-Modell (Backend + Frontend)
✅ Stripe Test-Mode komplett: Customer-Portal, 11 Webhook-Events, TWINT pending

DB: 1311+ Knowledge in 16 Tabellen, 2837 species, 16 Edge-Functions
"
git push origin v26.0
```

---

## 🐛 v26.1 — Swisstopo-Karten-Tile-Fix (1-2h, P0)

**Symptom (Fernando):** Karte ist graue Fläche mit blauem Punkt, keine Tiles.

**Cowork-Diagnose (Live):**
```
L.version 1.9.4 ✓ · gsMap=true ✓ · tilesInDom=14 · tilesLoaded=0
fetch wmts.geo.admin.ch → "Failed to fetch"
img.naturalWidth=0 → Bilder leer geladen
```

→ **Browser blockt Tile-Requests** (CSP/CORS).

### Fix-Strategie

1. **`_headers` CSP erweitern** für Swisstopo:
```
img-src 'self' data: blob: https:;  ← bereits OK
connect-src ... https://wmts.geo.admin.ch https://*.geo.admin.ch ...
```

2. **Fallback-Layer auf OpenStreetMap** wenn Swisstopo nach 3s noch nicht geladen:
```js
// GS_MAP_LAYERS — OpenStreetMap als zuverlässiger Default + Swisstopo als Option
GS_MAP_LAYERS = {
  osm: {  // ← NEUER DEFAULT
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    opts: { maxZoom: 19, attribution: '© OpenStreetMap' }
  },
  swisstopo: {  // bleibt als 2. Tab
    url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    opts: { maxZoom: 18, attribution: '© swisstopo' }
  },
  // ...
};

// In gsCreateMap: erstes Tile-Layer = osm (immer funktional)
gsMapLayer = L.tileLayer(GS_MAP_LAYERS.osm.url, GS_MAP_LAYERS.osm.opts).addTo(gsMap);
```

3. **Tile-Error-Handler** für Swisstopo-Fallback:
```js
gsMapLayer.on('tileerror', function(error){
  console.warn('[Map] Tile error:', error.tile?.src);
  // Wenn >3 errors in 5s → auto-switch zu OSM
});
```

### Smoke-Test
- Karte öffnen → OSM-Tiles erscheinen sofort
- Layer-Switcher → Swisstopo wählen → wenn Tiles laden ✓, sonst Toast "Swisstopo nicht erreichbar — OSM aktiv"

---

## 📢 v26.2 — User-friendly Release-Notes (1h, P1)

**Fernando-Wunsch:** „Bei Update-News soll es so gemacht werden, dass Nutzer einfacher beschriebene + relevante Infos bekommen."

**Aktuell (technisch):**
```
v25.38: Pro-only Restructure — gsShowFirstTrialModal 4→3 Buttons, 
GS_PRICE_CATALOG 5→3, plusCard entfernt, plus_monthly raus, ...
```

**Neu (user-friendly):**
```
✨ Was ist neu in v25.38

🎁 Einfacher: nur noch 1 Pro-Plan mit allen Features
⏱️ 7-Tage-Trial gratis — danach CHF 7.90/Monat
🏆 Pro Lifetime CHF 45.60 (Launch-Aktion, nur 100 Stück)

Jetzt mit dabei: KI-Pflanzendoktor · Buch-Wissen · 
Familien-Konto · Offline-Sync · Werbefrei
```

### Implementierung

**Option A** — Zwei-Layer-System (empfohlen):
```js
// GS_RELEASES bekommt neues Feld `user_summary`:
{
  v: 'v25.38', date: '14.05.2026',
  headline: '💎 Nur noch 1 Pro-Plan mit ALLEN Features',
  user_summary: 'Wir haben das Abo einfacher gemacht: nur noch 1 Plan, der ALLES kann. 7 Tage gratis testen, dann CHF 7.90/Monat. Pro Lifetime (CHF 45.60) für Launch-Fans.',
  user_items: [
    '🌱 7-Tage-Gratis-Test mit ALLEN Features',
    '💎 1 Plan — Pro mit KI-Doctor, Buch-Wissen, Familien-Konto, Offline',
    '🏆 Pro Lifetime einmalig 45.60 (nur 100x verfügbar)'
  ],
  // technisch (für Entwickler-View, hidden by default):
  summary: '...', items: [...]
}

// Whats-new Modal zeigt:
// - user_summary (immer)
// - user_items (immer, max 3-5)
// - "🔧 Technische Details" Toggle für summary + items
```

### Backwards-Compat für alle existing v25.x-Releases

- Wenn `user_summary` fehlt → automatisch generieren via Heuristik (erster Satz von `summary`, gekürzt)
- ODER: nur die NEUEN v26.x-Releases haben user_summary, alte bleiben technisch

---

## ♿ v26.3 — A11y aria-labels (3h, P2)

Audit: 763 Buttons, 88 mit aria-label = 12% Coverage.

**Strategie:** Top-100 Icon-only Buttons zuerst.

```bash
# Auto-Find für Icon-only-Buttons
grep -nE '<button[^>]*>[×✕✖✗📷🔔⚙️👁️🩺🥕🎙️🌍🗺️📋🎯💎⭐🌱][^<]{0,3}</button>' index.html | head -100
```

Pattern:
```html
<!-- VORHER --><button onclick="closeModal('x')">×</button>
<!-- NACHHER --><button onclick="closeModal('x')" aria-label="Schliessen">×</button>
```

---

## 🛡️ v26.4 — maxlength + Z-Index-Tokens (2h, P2)

### A) `<input>` maxlength (102 von 125)
- type=text → maxlength=200
- type=email → maxlength=254
- type=password → maxlength=128

### B) Z-Index-Tokens (43 hardcoded)
```css
:root {
  --z-base: 1; --z-menu: 2000; --z-overlay: 4000;
  --z-modal: 5000; --z-banner: 8000; --z-prompt: 9000;
  --z-onboarding: 9999; --z-toast: 99999;
}
```

---

## 🧹 v26.5 — Cleanup + Performance (2h, P3)

- 65× `console.log()` raus (nur Debug)
- Lazy-Split: KI-Planer-Code (Z.40000+) lazy → Initial-Bundle -40%

---

## 🤝 v26.6 — Marketplace-Connect-Frontend (2h, P2)

**Backend bereit:** `marketplace-publish` Edge-Fn + `v_marketplace_listings` View + `marketplace_sellers` Schema.

**Frontend-TODO:**
- Settings → „🛒 Als Verkäufer registrieren"-Button
- Klick → Edge-Fn `stripe-create-connect-account` (Cowork muss noch deployen post-v26.6)
- Redirect zu Stripe-Hosted-Onboarding
- Bei Return: marketplace_sellers-Row + Verkaufs-Funktion freigeschaltet

→ Erst nach Cowork-Edge-Fn-Deploy für Connect.

---

## 🔔 v26.7 — Trial-End-Reminder (1h, P2)

Webhook `customer.subscription.trial_will_end` (3 Tage vor Trial-Ende) bereits subscribed.
→ Cowork muss Push-Notification + Email-Reminder implementieren.

**Frontend:** Wenn `subscription.trial_end - now < 3 days` → Banner „⏰ Trial endet in X Tagen — Kreditkarte hinterlegt? Kein automatischer Abzug ohne Bestätigung"

---

## 🌍 v26.8 — i18n Pass-3 Restliche Strings (3h, P3)

210 data-i18n Marker aktuell. Audit zeigt noch ~150 statische Strings.

```bash
grep -nE ">[A-ZÄÖÜ][a-zäöüß ]{8,}<" index.html | wc -l
# Top-Frequenz-Strings zuerst
```

---

## 📐 v26.9 — AR-View MVP (1 Woche, P3 — optional, nur wenn Zeit)

WebXR + Three.js (bereits self-hosted in `/assets/three.min.js`)
- KI-Planer-Plan → „🪟 In meinem Raum sehen"-Button
- ar_models-Tabelle (Cowork bereits angelegt)
- glTF-Modelle aus Sketchfab/Kaggle curaten (Cowork-Pflicht später)

---

## 📊 v26.10 — Memory-Files konsolidieren (30 Min)

- 01_STATUS_LIVE.md → v26.x neuester Stand
- 02_CHANGELOG.md → alle v25.30-v26.x Einträge
- 11_ARCHITEKTUR_MAP.md → Z-Anker für neue Funktionen

---

## 📋 Sprint-Reihenfolge Empfehlung (für autonome Tage)

```
TAG 1 (heute Abend):
  v26.0  Tag setzen + push (5 Min)
  v26.1  Swisstopo-Karten-Fix (1-2h)
  v26.2  User-friendly Release-Notes (1h)

TAG 2:
  v26.3  A11y aria-labels Top-100 (3h)
  v26.4  maxlength + Z-Index-Tokens (2h)

TAG 3:
  v26.5  Console-Cleanup + Lazy-Split (2h)
  v26.7  Trial-End-Reminder (1h)
  v26.8  i18n Pass-3 (3h)

TAG 4+:
  v26.6  Marketplace-Connect-Frontend (wartet auf Cowork-Edge-Fn)
  v26.9  AR-View MVP (1 Woche, optional)
  v26.10 Memory-Final (30 Min)
```

**Push-Regel:** nach jedem Sprint → `git push` → Cowork verifiziert via Chrome-MCP + meldet kritische Bugs zurück.

---

## 🛠️ Cowork-Parallel-Pflichten (während Code arbeitet)

| Sprint | Cowork-Pflicht | Status |
|---|---|---|
| v26.6 | `stripe-create-connect-account` Edge-Fn + `marketplace_sellers`-Schema | offen |
| v26.7 | `daily-push-checker` um trial_will_end-Trigger erweitern | offen |
| v26.9 | `ar_models`-Tabelle mit ~50 Pflanzen-glTF-URLs füllen | offen |
| dauerhaft | pg_cron `knowledge-growth-daily` läuft täglich 03:30 UTC | ✅ aktiv (16 Topics) |
| dauerhaft | DB-Monitoring + Wave-7+ wenn Tabellen < 100 Einträge | ✅ aktiv |

---

## 🚨 Wenn etwas schiefgeht

- Cowork bemerkt bug via Chrome-MCP-Audit → schreibt Mini-Briefing in `repo-clone/`
- Code arbeitet das ab nach aktuellem Sprint
- Bei P0 (App stuck o.ä.) → Hotfix-Push direkt (analog v25.34 Cowork-Hotfix)

---

## ✅ Definition of Done v26.10

- [ ] Karte funktioniert (OSM-Default + Swisstopo-Option)
- [ ] Update-News user-freundlich (2-Layer)
- [ ] A11y ≥400 aria-labels (von 88 → 400+)
- [ ] 0 Inputs ohne maxlength
- [ ] Z-Index-Tokens überall (0 hardcoded > 1500)
- [ ] Initial-Bundle <4MB (von 5.4MB)
- [ ] Trial-End-Reminder live
- [ ] i18n-Coverage ≥80% der UI-Strings
- [ ] Memory-Files final konsolidiert

→ Dann ist GreenScan ready für **echten Launch** (Live-Mode-Switch + Marketing-Push).

---

**Stand:** 2026-05-17 · Cowork-Roadmap für Code's autonome Woche · Fernando weg
