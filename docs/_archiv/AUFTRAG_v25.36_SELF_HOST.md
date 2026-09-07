# AUFTRAG v25.36 — Leaflet+Three.js SELF-HOST + Mein-Abo-Element-Fix

> **Cowork-Live-Diagnose 2026-05-13** via Chrome-MCP nach v25.35-Push:
>
> - ✅ NaN-Fix wirkt (Home zeigt "8 Scans" statt "NaN")
> - ❌ **Karte hängt weiter** — `fetch('unpkg.com/leaflet')` returns `onerror: unknown` → **CDN ist tatsächlich nicht erreichbar vom Browser** (nicht nur Race-Condition!)
> - ❌ **Mein-Abo zeigt nur kaputtes Bild-Icon** — `<div id="abo-sub-info-host">` Element existiert NICHT im DOM (`getElementById('abo-sub-info-host')` returns null)
>
> **v25.35-Polling kann das CDN-Problem NICHT heilen.** Self-Host ist die einzige Lösung.

---

## ⚠️ Versions-Disziplin

- Letzter LIVE: `833fe13` v25.35 (NaN-Fix + Karten-Polling + if-paid-removal)
- Nächster Sprint: **v25.36**

---

## 🔴 BUG A — Leaflet CDN tot → SELF-HOST

### Live-Beweis (Cowork via Chrome-MCP):
```js
new Promise((r)=>{
  var s=document.createElement('script');
  s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  s.onload=()=>r('typeof L = '+typeof L);
  s.onerror=()=>r('onerror');
  document.head.appendChild(s);
});
// → Result: "onerror: unknown"
```

→ **CDN unpkg.com liefert nichts** (entweder Cloudflare-Pages-CSP, Adblocker, Network-Issue, oder unpkg-Outage). v25.35 Polling-Retry rennt 50× ins Leere.

### Schritt 1: Libs lokal kopieren

```bash
cd ~/Documents/Claude\ wichtige\ dateien/local-agent-mode-sessions/repo-clone
mkdir -p assets

# Leaflet (~150 KB)
curl -L -o assets/leaflet.js https://unpkg.com/leaflet@1.9.4/dist/leaflet.js
curl -L -o assets/leaflet.css https://unpkg.com/leaflet@1.9.4/dist/leaflet.css

# Three.js (~600 KB) — wichtig für 3D-Track + KI-Planer + Garten-Detail-3D
curl -L -o assets/three.min.js https://unpkg.com/three@0.128.0/build/three.min.js

# Verify
ls -la assets/
# Erwartet: leaflet.js ~150K, leaflet.css ~14K, three.min.js ~600K
```

**Plus:** Leaflet-Marker-Bilder (sonst sind Pin-Icons broken):
```bash
mkdir -p assets/leaflet-images
curl -L -o assets/leaflet-images/marker-icon.png https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png
curl -L -o assets/leaflet-images/marker-icon-2x.png https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png
curl -L -o assets/leaflet-images/marker-shadow.png https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png
```

### Schritt 2: Frontend umstellen

**A) `gsLoadLeaflet` (Z.~31893):**
```js
function gsLoadLeaflet() {
  if (typeof L !== 'undefined') return Promise.resolve();
  if (window._gsLeafletLoadingPromise) return window._gsLeafletLoadingPromise;
  window._gsLeafletLoadingPromise = new Promise(function(resolve, reject){
    var src = '/assets/leaflet.js';  // ← SELF-HOST statt unpkg
    var existing = document.querySelector('script[src="' + src + '"]');
    var poll = function(t){
      if (typeof L !== 'undefined') return resolve();
      if (t<=0) { window._gsLeafletLoadingPromise = null; return reject(new Error('L undefined after script-load')); }
      setTimeout(function(){ poll(t-1); }, 100);
    };
    if (existing) { poll(50); return; }  // 5s polling
    var s = document.createElement('script');
    s.src = src;
    s.onload = function(){
      // Leaflet-Marker-Image-Path auf self-hosted setzen (sonst broken pins)
      try { if (typeof L !== 'undefined') L.Icon.Default.imagePath = '/assets/leaflet-images/'; } catch(_){}
      poll(20);
    };
    s.onerror = function(){ window._gsLeafletLoadingPromise = null; reject(new Error('Leaflet load failed (self-hosted!)')); };
    document.head.appendChild(s);
  });
  return window._gsLeafletLoadingPromise;
}
```

**B) Three.js (Z.~36365 + ~40143 + ~40695):**
```js
// gsLoadThree() Helper analog
function gsLoadThree() {
  if (typeof THREE !== 'undefined') return Promise.resolve();
  if (window._gsThreeLoadingPromise) return window._gsThreeLoadingPromise;
  window._gsThreeLoadingPromise = new Promise(function(resolve, reject){
    var src = '/assets/three.min.js';
    var s = document.createElement('script');
    s.src = src;
    s.onload = function(){
      var poll = function(t){
        if (typeof THREE !== 'undefined') return resolve();
        if (t<=0) { window._gsThreeLoadingPromise = null; return reject(new Error('THREE undefined after load')); }
        setTimeout(function(){ poll(t-1); }, 100);
      };
      poll(20);
    };
    s.onerror = function(){ window._gsThreeLoadingPromise = null; reject(new Error('Three load failed')); };
    document.head.appendChild(s);
  });
  return window._gsThreeLoadingPromise;
}
```

Plus: alle 3 Three.js-Stellen (3D-Track / KI-Planer-3D / Garten-3D) auf `await gsLoadThree();` umstellen.

**C) Leaflet-CSS in `<head>`:**
```html
<!-- VORHER (Z.~?) -->
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">

<!-- NACHHER -->
<link rel="stylesheet" href="/assets/leaflet.css">
```

### Schritt 3: Service-Worker SHELL_URLS umstellen

```js
// sw.js
const SHELL_URLS = [
  '/', '/index.html', '/offline.html', '/manifest.json',
  '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png',
  '/icons/icon-maskable-192.png', '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png', '/icons/favicon-32.png', '/icons/favicon-16.png',
  '/icons/shortcut-scanner.png', '/icons/shortcut-garden.png',
  '/icons/shortcut-quiz.png', '/icons/shortcut-knowledge.png',
  '/data/plants.v1.js?v=1',
  // v25.36: SELF-HOST statt unpkg.com
  '/assets/leaflet.js',
  '/assets/leaflet.css',
  '/assets/three.min.js',
  '/assets/leaflet-images/marker-icon.png',
  '/assets/leaflet-images/marker-icon-2x.png',
  '/assets/leaflet-images/marker-shadow.png',
  // pdf.js bleibt CDN (zu groß: 1.5MB)
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs'
];
```

Plus: `IMAGE_HOSTS` Array — `unpkg.com` daraus entfernen.

---

## 🔴 BUG B — `abo-sub-info-host` Element FEHLT im DOM

### Live-Beweis (Cowork):
```js
document.getElementById('abo-sub-info-host')  // → null
```

→ Code's v25.35 hat `if (paid)`-Wrapper entfernt, aber das **Element selbst wurde nie zum Modal-DOM hinzugefügt**. `gsLoadSubInfo().then(... host.innerHTML = ...)` macht nichts wenn `host` null.

### Fix: Element ins Abo-Modal-Markup einfügen

```bash
# Anker finden (Stelle wo das Abo-Modal HTML definiert wird)
grep -n 'id="gs-abo-modal"' index.html
# Wahrscheinlich ein Modal-Wrapper mit innerem Content-Container
```

In den Modal-Builder-Code (oder direkt in das HTML-Template):
```html
<!-- VORHER: irgendwo am Anfang des Modal-Inhalts -->
<div class="modal-content" ...>
  <button class="modal-close">×</button>
  <h2>Abo & Premium</h2>
  ... <!-- Plan-Karten -->
</div>

<!-- NACHHER: Container für Sub-Info-Card hinzufügen -->
<div class="modal-content" ...>
  <button class="modal-close">×</button>
  <h2>Abo & Premium</h2>
  <!-- v25.36: Empty-State / Status-Card aus gsRenderSubInfo -->
  <div id="abo-sub-info-host"></div>
  ... <!-- Plan-Karten danach -->
</div>
```

**Verify:**
```bash
grep -c 'id="abo-sub-info-host"' index.html
# erwartet: ≥1
```

---

## 🟢 Plus: Erfolge aus v25.35

- ✅ NaN-Scans behoben (live-getestet, zeigt jetzt "8")
- ✅ App-Init läuft sauber durch (v25.34-Hotfix LIVE)
- ✅ v25.35-Update-Banner zeigt sich korrekt

---

## 📦 Versions-Disziplin v25.36

```
[ ] index.html: GS_VERSION = 'v25.36'
[ ] index.html: <meta name="app-version" content="25.36.20260513">
[ ] sw.js: const VERSION = 'gs-v25.36' + Top-Comment
[ ] _headers: v25.36
[ ] GS_RELEASES Top-Eintrag: "Self-Host Leaflet+Three.js + Mein-Abo Element-Fix"
[ ] 7/7 Inline-Scripts node --check OK
```

---

## 📂 Neue Repo-Files

```
repo-clone/
  assets/
    leaflet.js          (~150 KB)
    leaflet.css         (~14 KB)
    three.min.js        (~600 KB)
    leaflet-images/
      marker-icon.png
      marker-icon-2x.png
      marker-shadow.png
```

**Repo wird ~770 KB größer**, aber:
- Keine externe DNS-Abhängigkeit mehr
- Kein CDN-Outage-Risk
- Kein CSP-Issue
- Garantiert im SW-Shell-Cache nach Install
- Schneller (Cloudflare-Edge ist näher als unpkg)

---

## 🧪 Smoke-Test nach Push (Cowork)

```bash
# 1) Live-Files
curl -s https://green-scan.ch/assets/leaflet.js | head -c 100
# erwartet: Leaflet-Code (z.B. "/* @preserve" oder "var L=...")

curl -s https://green-scan.ch/assets/three.min.js | head -c 100
# erwartet: Three.js-Code

# 2) Karten-Test via Chrome-MCP
- Karten-Tab öffnen → Swisstopo-Tiles erscheinen binnen 3s
- typeof L === 'object' ✓
- L.version === '1.9.4' ✓

# 3) Mein-Abo
- Menü → Mein Abo öffnen
- Empty-State zeigt "🌱 Free-Plan aktiv" + Upgrade-CTA
```

---

## ⏭️ Nach v25.36

| Sprint | Was |
|---|---|
| **v25.37** | sw.js Cloudflare-Cache `Cache-Control: no-cache` (verhindert SW-Update-Hänger) |
| **v25.38** | A11y aria-labels (~400 Buttons) |
| **v25.39** | maxlength + Z-Index-Tokens |
| **v25.40** | Console-Cleanup + Lazy-Split |
| **v26.0** | Pre-Release-stable Tag |

---

**Stand:** 2026-05-13 nach Cowork-Live-Diagnose · CDN-tot bestätigt · Self-Host = einzige Lösung
