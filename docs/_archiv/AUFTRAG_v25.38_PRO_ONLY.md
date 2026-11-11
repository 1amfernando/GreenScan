# AUFTRAG v25.38 — Frontend Pro-Only-Restructure

> **Cowork-Backend bereits LIVE 2026-05-14:**
> - Stripe: Plus-Plans deaktiviert, Plus-Lifetime → Pro Lifetime renamed
> - DB stripe_products + stripe_prices synchronisiert
> - stripe-bootstrap v5: nur noch Pro + Pro-Lifetime (idempotent)
>
> **Fernando-Wunsch:**
> - Nur 1 Abo-Modell: **Pro** (vereint alle Plus + Pro-Features)
> - **Free-Plan bleibt** mit „Pro 7 Tage gratis testen"-CTA
> - **Plus-Lifetime → Pro Lifetime** umbenannt
> - **7-Tage-Trial:** ALLE Features verfügbar (= Pro-Equivalent)

---

## 🟢 Backend-Status (Cowork bereit)

| Was | Status | DB-IDs |
|---|---|---|
| Pro Monthly | ✅ active | `price_1TTgEcJnN3SSU2QNjhByEYsG` (CHF 7.90) lookup_key=`pro_monthly` |
| Pro Yearly | ✅ active | `price_1TTgEdJnN3SSU2QN1rM96noT` (CHF 79.00) lookup_key=`pro_yearly` |
| Pro Lifetime | ✅ active | `price_1TTgEeJnN3SSU2QNOS76YkLi` (CHF 45.60) lookup_key=`pro_lifetime` |
| Plus Monthly | ❌ deaktiviert | (in Stripe + DB) |
| Plus Yearly | ❌ deaktiviert | |
| `plus_launch_lifetime` | ✅ umbenannt zu `pro_lifetime` | gleiche price_id, neuer lookup_key |

**Frontend-Aufruf:**
- `gsStartCheckout('pro_monthly', false, 7)` für 7-Tage-Trial → CHF 7.90/Monat
- `gsStartCheckout('pro_yearly', false, 7)` für 7-Tage-Trial → CHF 79/Jahr (10 Monate sparen)
- `gsStartCheckout('pro_lifetime', false, 0)` für Lifetime einmalig CHF 45.60

---

## 🐛 Frontend-Änderungen (3 Bausteine)

### BAUSTELLE 1 — `gsShowFirstTrialModal` neu (Z.~9303)

**Aktuell:** 3 Buttons (Plus / Pro / Free) + alle „1 Woche gratis testen"
**Neu:** 3 Buttons (Pro Lifetime / Pro Monthly / Free) — Plus komplett raus

```js
function gsShowFirstTrialModal() {
  var mc = document.getElementById('modal-content');
  if (!mc) return;
  mc.innerHTML = '<div style="padding:0;">' +
    '<div style="background:linear-gradient(135deg,#1b5e20,#2e7d32,#43a047);padding:28px 22px;color:#fff;text-align:center;position:relative;">' +
      '<button onclick="closeModal(\'detail-modal\')" aria-label="Schliessen" style="position:absolute;top:10px;right:10px;width:34px;height:34px;border-radius:50%;border:none;background:rgba(255,255,255,.2);color:#fff;font-size:20px;cursor:pointer;">×</button>' +
      '<div style="font-size:48px;margin-bottom:8px;">🌱</div>' +
      '<div style="font-family:\'Playfair Display\',serif;font-size:24px;font-weight:900;margin-bottom:6px;">Willkommen bei GreenScan</div>' +
      '<div style="font-size:13px;opacity:.92;line-height:1.5;">7 Tage lang ALLES kostenlos testen.<br>Jederzeit kündbar — keine Sofort-Sperre.</div>' +
    '</div>' +
    '<div style="padding:18px;">' +
      // Pro Lifetime (Launch-Aktion)
      '<button onclick="gsTrialStart(\'pro_lifetime\')" style="width:100%;display:block;padding:16px;margin-bottom:10px;background:linear-gradient(135deg,#b8860b,#daa520);color:#fff;border:none;border-radius:14px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;text-align:left;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;">' +
          '<div><div style="font-size:15px;margin-bottom:2px;">🏆 Pro Lifetime — einmalig CHF 45.60</div>' +
          '<div style="font-size:11.5px;opacity:.9;font-weight:600;">Launch-Aktion · nur erste 100 Nutzer · alle Features für immer</div></div>' +
          '<div style="font-size:18px;">→</div>' +
        '</div>' +
      '</button>' +
      // Pro Monthly mit 7-Tage-Trial
      '<button onclick="gsTrialStart(\'pro_monthly\')" style="width:100%;display:block;padding:16px;margin-bottom:10px;background:linear-gradient(135deg,#1a237e,#3949ab);color:#fff;border:none;border-radius:14px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;text-align:left;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;">' +
          '<div><div style="font-size:15px;margin-bottom:2px;">⭐ Pro — 7 Tage gratis testen</div>' +
          '<div style="font-size:11.5px;opacity:.9;font-weight:600;">Danach CHF 7.90/Monat · KI-Doctor · Buch-Wissen · Familien-Konto · Offline · Werbefrei</div></div>' +
          '<div style="font-size:18px;">→</div>' +
        '</div>' +
      '</button>' +
      // Free-Plan
      '<button onclick="gsTrialSkip()" style="width:100%;display:block;padding:13px;background:transparent;color:var(--muted);border:1.5px solid var(--border);border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;margin-top:6px;">🌱 Mit Free-Plan starten (5 Scans/Tag)</button>' +
      '<div style="font-size:10.5px;color:var(--muted);text-align:center;margin-top:14px;line-height:1.55;">' +
        '7-Tage-Trial: Du behältst alle Pro-Features bis zum Ende der Trial-Woche.<br>Sichere Zahlung über Stripe.' +
      '</div>' +
    '</div>' +
  '</div>';
  openModal('detail-modal');
}
```

### BAUSTELLE 2 — `gsRenderSubInfo` Pro-Style (Z.~9741)

Plan-Anzeige vereinfachen (planName immer "Pro", weil's nur noch Pro gibt):

```js
// Z.~9772 — VORHER:
var planName = sub.tier ? (sub.tier.charAt(0).toUpperCase() + sub.tier.slice(1)) : 'Plus';
// NACHHER:
var planName = 'Pro';  // nur noch ein Plan-Modell

// Plus: Empty-State CTA-Text auf "Pro" anpassen (Z.~9748):
'<div style="font-size:18px;font-weight:900;color:var(--g-dark);margin-bottom:6px;">Free-Plan aktiv</div>' +
'<div style="font-size:13px;color:var(--muted);margin-bottom:16px;line-height:1.5;">5 Scans/Tag · Kein Cloud-Sync · Keine KI-Doctor-Analyse</div>' +
'<button onclick="gsShowFirstTrialModal()" ... >' +
  '⬆️ Pro 7 Tage gratis testen' +  // statt "Plus oder Pro"
'</button>'
```

### BAUSTELLE 3 — Plus-Texte überall entfernen

```bash
# Audit-Befehl
grep -nE "Plus[- ]?Plan|Plus monthly|GreenScan Plus|⭐ Plus|💎 Plus|tier=plus|'plus'|plus_monthly|plus_yearly|plus_launch" index.html | head -30
```

**Ersetzen-Pattern:**
- `'plus_monthly'` → `'pro_monthly'`
- `'plus_yearly'` → `'pro_yearly'`
- `'plus_launch_lifetime'` → `'pro_lifetime'`
- „GreenScan Plus" → entfernen ODER „GreenScan Pro" wenn es das Lifetime ist
- „⭐ Plus — …" → entfernen
- Plan-Vergleichs-Tables (falls vorhanden) → 2-spaltig (Free / Pro) statt 3-spaltig

**Audit erwartete Treffer-Zahl:** ~15-30. Code geht systematisch durch.

### BAUSTELLE 4 — `gsAboCanUse` / Tier-Checks vereinfachen

Aktuell prüft Code an manchen Stellen `tier === 'plus'` ODER `tier === 'pro'`. Da es nur noch Pro gibt:

```bash
grep -nE "tier === 'plus'|tier===\"plus\"" index.html | head -10
```

Pro-Check reicht. Plus-Checks entfernen (würden eh false returnen weil keine Plus-Subs mehr existieren).

### BAUSTELLE 5 — Trial-Period 7 Tage = Pro-Features ALL

Das macht das Backend bereits automatisch:
- `stripe-checkout v6` cap't trial_days auf 7
- Während Trial = Stripe-Status `'trialing'` → User hat Pro-Tier
- `v_user_entitlements`-View resolved tier='pro' → alle Pro-Features freigeschaltet

→ **Code muss hier nichts ändern**, nur sicherstellen dass `gsTrialStart('pro_monthly')` mit 7d-Trial gerufen wird (Default-Backend gibt 7 wenn nicht gesetzt).

---

## 📦 Versions-Disziplin v25.38

```
[ ] index.html: GS_VERSION = 'v25.38'
[ ] index.html: <meta name="app-version" content="25.38.20260514">
[ ] sw.js: VERSION = 'gs-v25.38' + Top-Comment „Pro-only Restructure"
[ ] _headers: v25.38
[ ] GS_RELEASES Top-Eintrag mit „Pro-only Modell"
[ ] 7/7 Inline-Scripts node --check OK
```

---

## 🧪 Smoke-Test (Cowork via Chrome-MCP)

```bash
# Live-Files
curl -s https://green-scan.ch/ | grep -oE "GS_VERSION = '[^']*'"
# erwartet: v25.38

# Plus-Texte raus?
curl -s https://green-scan.ch/ | grep -c "⭐ Plus"
# erwartet: 0 (nur in CHANGELOG-Strings ok)

# Trial-Modal-Test
- gsShowFirstTrialModal() im Browser
- 3 Buttons: Pro Lifetime / Pro Monthly / Free (kein Plus mehr!)
- Klick Pro Monthly → Stripe-Checkout öffnet sich → Test 4242 → success
```

---

## 🔗 Followup nach v25.38

- **v25.39 Marketplace-Connect** (Cowork): Edge-Fn `stripe-create-connect-account` + `marketplace_sellers` Tabelle (siehe `110_MARKETPLACE_STRIPE_ONBOARDING.md`)
- **v25.40+ A11y / maxlength / z-index** wie geplant
- **v26.0** Pre-Release-stable Tag

---

**Stand:** 2026-05-14 nach Backend-Restructure · 3-4h Frontend-Arbeit für Pro-only
