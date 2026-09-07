# AUFTRAG v25.35 — 3 Live-Bugs nach v25.34-Hotfix

> **Cowork-Diagnose 2026-05-13** via Chrome-MCP + DB-Inspektion.
>
> **Backend:** Stripe komplett saniert (3 Test-Mode-Products + 5 Prices + Webhook neu + stripe-checkout v6 Trial-7-Tage). Alle 5 Lookup-Keys in DB synchronisiert.
>
> **App-Init läuft jetzt durch** (v25.34-Hotfix wirksam) ABER 3 P1-Bugs noch sichtbar.

---

## ⚠️ Versions-Disziplin

- Letzter LIVE-Commit: `1074535` v25.34 (Cowork-Hotfix `_quizStreak`/`_mqStreak` Top-Level-gsStore-Refs)
- Nächster Frontend-Sprint: **v25.35**

---

## 🟠 BUG 1 — Karte „Marker vorbereiten" hängt / Karten-Tab leer

**Wo:** Splash-Loader Z.51750 (`'🗺️ Karte & Marker vorbereiten…'`) UND/ODER `initMap`/`gsLoadLeaflet` (Z.31893+31909)

**Symptom (Fernando):** „Karte funktioniert immer noch nicht."
**Cowork-Beobachtung:** Splash-Step bei 91% bleibt manchmal hängen. ODER Karten-Tab zeigt „🗺️ Swisstopo lädt…" und nie fertig.

**Wahrscheinliche Root-Causes:**
1. `gsLoadLeaflet` Promise resolved aber `typeof L` ist immer noch undefined (Script lädt vom CDN aber initialisiert sich nicht — Race-Condition)
2. Splash-Step-91% Function returned `true` aber `nextStep()` wird nicht aufgerufen
3. Service-Worker hat alte gecachte Leaflet → liefert leeres Skript

**Fix-Vorschlag (defensiv):**
```js
// Z.~31893 gsLoadLeaflet — robusteres Polling NACH Script-Load
function gsLoadLeaflet() {
  if (window._gsLeafletLoadingPromise) return window._gsLeafletLoadingPromise;
  if (typeof L !== 'undefined') return Promise.resolve();
  window._gsLeafletLoadingPromise = new Promise(function(resolve, reject){
    var src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    var existing = document.querySelector('script[src="' + src + '"]');
    var poll = function(tries){
      if (typeof L !== 'undefined') return resolve();
      if (tries <= 0) {
        window._gsLeafletLoadingPromise = null;
        return reject(new Error('Leaflet timeout'));
      }
      setTimeout(function(){ poll(tries - 1); }, 200);
    };
    if (existing) {
      // Script-Tag schon da aber L noch nicht — poll
      poll(50);  // 50 × 200ms = 10s max
      return;
    }
    var s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = function(){ poll(20); };  // nach onload nochmal 4s polling
    s.onerror = function(){ window._gsLeafletLoadingPromise = null; reject(new Error('Leaflet load failed')); };
    document.head.appendChild(s);
  });
  return window._gsLeafletLoadingPromise;
}
```

Plus: **Splash-Step-91% (Z.~51753) try/catch um die fn**:
```js
fn: function() {
  try {
    if (typeof updateApiBanner === 'function') updateApiBanner();
  } catch(_){}
  return true;
}
```

**Verify:** Cowork triggert via Chrome-MCP `await gsLoadLeaflet(); typeof L` — sollte 'object' sein.

---

## 🟠 BUG 2 — Home-Stats zeigt „NaN 📷 Scans"

**Wo:** `#stat-scans` Element (Z.1740) wird von **3 Funktionen** parallel beschrieben:
- `gsUpdateHomeScanStat` (Z.10635) — sauber: `JSON.parse(...).length`
- `gsUpdateMoreStats` Z.10833 — sauber: `scanCount + confirmed`
- `gsAnimateCounter` (Z.15186) — `parseInt(el.textContent)||0`

**Symptom (Fernando, Live-Screenshot):** Home zeigt „NaN" statt „0".

**Root-Cause-Verdacht:** Race Condition zwischen den 3 Updaters. ODER 4. Stelle die direkt schreibt:

```bash
# Audit-Befehl
grep -nE "stat-scans" index.html
# erwartet 4 Treffer (1 DOM-Definition + 3 Updater)
```

Lass mich tippen: irgendwo wird `Number(undefined)` oder `parseInt('')` ohne `||0` Fallback gerendert.

**Fix-Vorschlag (Defensive Wrapper):**
```js
// In gsUpdateHomeScanStat:
function gsUpdateHomeScanStat() {
  var total = 0;
  try { total = (JSON.parse(localStorage.getItem('gs_scan_history')||'[]') || []).length || 0; } catch(e){}
  try { total += (JSON.parse(localStorage.getItem('gs_confirmed_species')||'[]') || []).length || 0; } catch(e){}
  if (!Number.isFinite(total)) total = 0;
  var el = document.getElementById('stat-scans');
  if (el) el.textContent = String(total);
}
```

Plus: in `gsUpdateMoreStats` Z.10833:
```js
'stat-scans': Number.isFinite(scanCount + confirmed) ? (scanCount + confirmed) : 0,
```

Und in der `gsAnimateCounter`-Animation Z.15186 die finale `el.textContent` setzen mit `Number.isFinite`-Check.

**Verify:** Inkognito → Home öffnen → `#stat-scans` zeigt „0" (nicht „NaN").

---

## 🔴 BUG 3 — Mein-Abo-Tab leer / Empty-State von v25.33 wird nicht gerendert

**Wo:** Z.9385-9390 (im Abo-Modal-Builder) + `gsRenderSubInfo` Z.9741

**Symptom (Fernando):** „Mein Abo zeigt nur Plan-Auswahl, kein Status, kein Cancel-Button"

**Root-Cause:** Die Empty-State-Card aus v25.33 wird in einem `if (paid) { ... }`-Block gerendert:
```js
// Z.~9385 — AKTUELL
if (paid) {
  gsLoadSubInfo().then(function(sub){
    var host = document.getElementById('abo-sub-info-host');
    if (host) host.innerHTML = gsRenderSubInfo(sub);
  }).catch(function(){});
}
```

→ Free-User (paid=false) sehen den Empty-State NIE, obwohl `gsRenderSubInfo(null)` extra dafür ist!

**Fix-Vorschlag:**
```js
// Z.~9385 — NEU: ALWAYS rendern (gsRenderSubInfo handelt null/sub Beide)
gsLoadSubInfo().then(function(sub){
  var host = document.getElementById('abo-sub-info-host');
  if (host) host.innerHTML = gsRenderSubInfo(sub);
}).catch(function(){
  var host = document.getElementById('abo-sub-info-host');
  if (host) host.innerHTML = gsRenderSubInfo(null);
});
```

**Plus prüfen:** existiert `<div id="abo-sub-info-host">` als Element im Abo-Modal-Markup?
```bash
grep -nE 'id="abo-sub-info-host"|abo-sub-info-host' index.html
```
- Falls **0 Treffer**: Element fehlt → muss als `<div id="abo-sub-info-host"></div>` an Modal-Anfang eingefügt werden (in der HTML-Definition des Abo-Modals oben im DOM)

**Verify:**
1. Inkognito-Login → Menü → Abo verwalten
2. Modal öffnet sich → ZEIGT „🌱 Free-Plan aktiv" Card mit „⬆️ Plus oder Pro — 7 Tage gratis testen"-Button
3. Nach Stripe-Test: Modal zeigt „💎 GreenScan Plus" + Status-Badge + Cancel-Button

---

## 📦 Versions-Disziplin

```
[ ] index.html: GS_VERSION = 'v25.35'
[ ] index.html: <meta name="app-version" content="25.35.20260513">
[ ] sw.js: VERSION = 'gs-v25.35' + Top-Comment
[ ] _headers: v25.35
[ ] GS_RELEASES Top-Eintrag mit „3 Live-Bugs gefixt"
[ ] 7/7 Inline-Scripts node --check OK
```

---

## 🧪 Smoke-Test nach Push (Cowork via Chrome-MCP)

```bash
# 1) Live-Verify
curl -s https://green-scan.ch/ | grep -oE "GS_VERSION = '[^']*'"
curl -s https://green-scan.ch/sw.js | grep -oE "VERSION = 'gs-[^']*'"
# erwartet: beide v25.35

# 2) Karten-Test (Cowork via Chrome-MCP)
- Karten-Tab öffnen → Swisstopo-Layer erscheint binnen 5s

# 3) Stats-Test
- Home öffnen → "📷 Scans" zeigt "0" (nicht "NaN")

# 4) Mein-Abo-Test
- Menü → Mein Abo → Empty-State zeigt "Free-Plan aktiv" + Upgrade-CTA
- Nach Stripe-Test (4242): Status-Card mit Trial-Badge + Cancel-Button
```

---

## 🛠️ Backend-Status (Cowork hat alles bereit)

✅ Stripe Test-Mode komplett aufgesetzt:
- 3 Products (Plus / Pro / Plus-Lifetime)
- 5 Prices (plus_monthly 3.90, plus_yearly 39, pro_monthly 7.90, pro_yearly 79, plus_launch_lifetime 45.60)
- Webhook neu + frischer Secret
- stripe-checkout v6 mit 7-Tage-Trial-Default
- 0 echte Subs (wartet auf Fernando-Test mit 4242)

---

**Stand:** 2026-05-13 nach Live-Diagnose · 3 P1-Bugs identifiziert · Briefing scharf
