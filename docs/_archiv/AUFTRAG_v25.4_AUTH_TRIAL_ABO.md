# Auftrag v25.4 — Auth + Trial + Abo-Polish

> **Cowork-Audit 2026-05-10.** Stripe-Card-Backend-Bug ist gefixt (Webhook-Secret rotiert, neuer Secret in app_settings + stripe-webhook v6 deployed).
>
> **Owner:** Claude Code für alle Frontend-Änderungen. Cowork hat parallel gemacht: Edge-Fn `stripe-portal` checken/upgraden für Cancel-Flow.

---

## Bug-Übersicht (Fernando-Input 2026-05-10)

| # | Bug | Symptom | Severity |
|---|---|---|---|
| **A1** | Logout zeigt nicht Onboarding | Nach Logout bleibt User auf letzter Seite, nicht zurück zu Anmelde-/Registrier-Screen | P0 |
| **A2** | Login zeigt „Willkommen bei GreenScan" + „Account erstellen" | Falsches UI nach erfolgreichem Login | P0 |
| **A3** | Trial-Modell fehlt | Erstmal-User sollten 1 Monat Free-Trial bekommen → automatisch in Plus-Plan | P0 |
| **A4** | Stripe-Card geht nicht | Webhook-Signature-Fail → ✅ Cowork-Backend-Fix gemacht (Webhook rotiert + v6 deployed). Test nochmal. | gefixt |
| **A5** | Abo-Info fehlt | User sieht nicht: Restlaufzeit, kündbar mit Tage-Anzeige, aktueller Status | P0 |

---

## A1 — Logout zeigt nicht Onboarding (Code-Pfad)

### Diagnose
`sbLogout()` (Z.~47301) ruft Token-Clear, aber zeigt keinen expliziten Onboarding-Screen.

`gsOnLogout()` (Z.~50407) macht `localStorage.removeItem(GS_ONBOARDING_KEY)` + `localStorage.removeItem(GS_GUEST_MODE_KEY)` — sollte beim nächsten Boot Onboarding triggern. Aber: User ist GERADE eingeloggt → bleibt auf letzter Seite.

### Fix
```js
async function sbLogout() {
  // ... existing token clear code

  // v25.4: Nach Logout sofort Onboarding zeigen (nicht warten auf Reload)
  if (typeof gsOnLogout === 'function') gsOnLogout();

  // Onboarding-Wrapper sichtbar machen + auf Start-Screen reset
  var ob = document.getElementById('gs-onboarding');
  if (ob) {
    ob.style.display = 'flex';
    ob.style.opacity = '1';
  }
  if (typeof _onbShowView === 'function') _onbShowView('onb-start');

  // Aktuelle Tab-Inhalte verstecken (alle Modals zu)
  document.querySelectorAll('.modal-overlay').forEach(function(m){ m.style.display='none'; });

  // Optional: Toast „Du wurdest abgemeldet"
  if (typeof showProfileToast === 'function') showProfileToast('👋 Erfolgreich abgemeldet');

  return result;
}
```

### Verify
- Logout-Button → `onb-start` (mit „Anmelden" / „Registrieren" / „Als Gast")
- Token weg, Cloud-Daten weg
- Re-Login → Home

---

## A2 — Falscher Welcome-Screen nach Login

### Diagnose
Nach Login wird vermutlich der Welcome-Step aus dem Register-Flow gezeigt — der gehört nur zur **Erstregistrierung**, nicht zu jedem Login.

### Fix
1. Welcome-Screen NUR zeigen wenn:
   - User gerade ERST registriert hat (URL-Param `?just_registered=1` oder localStorage-Flag `gs_first_login`)
   - ODER: Email-Confirm-Redirect (`?email_confirmed=1`)
2. Bei normalem Login: direkt zu Home-Tab, plus Welcome-Back-Toast

```js
// In onbDoLogin Erfolg-Pfad:
if (localStorage.getItem('gs_first_login') === '1') {
  localStorage.removeItem('gs_first_login');
  // Welcome-Modal mit Tour-Start-Button
  if (typeof gsShowWelcomeTour === 'function') gsShowWelcomeTour();
} else {
  // Normaler Login → kein Welcome-Modal, nur Toast
  if (typeof showProfileToast === 'function') {
    showProfileToast('🌿 Willkommen zurück, ' + (displayName || email.split('@')[0]) + '!');
  }
}
```

In `onbDoRegister` Erfolg-Pfad:
```js
localStorage.setItem('gs_first_login', '1');
```

---

## A3 — Trial-Modell: 1 Monat free, dann kostenpflichtig, kündbar

### Konzept
Bei Erstregistrierung:
1. User registriert → Email-Confirm
2. Sofort 1-Monat-Trial-Modal: „Wähle deinen Plan — 1 Monat kostenlos testen"
3. Plus oder Pro auswählen → Stripe-Trial-Subscription mit `trial_period_days=30`
4. Stripe handhabt: 30 Tage frei, dann automatisch kostenpflichtig
5. User kann jederzeit kündigen → bleibt aktiv bis `current_period_end`

### Backend (Cowork hat schon)
- Stripe-Subscriptions mit `trial_period_days` werden via stripe-checkout Edge-Function angelegt
- `cancel_at_period_end=true` setzt → User behält Plus bis Trial endet
- past_due-Migration deployed (Cowork v24.52)

### Frontend-Änderungen für Code

#### A3.1 — Stripe-Checkout mit Trial
In `gsStartCheckout(priceLookupKey, claimLaunchOffer)` Z.~8928:
```js
// v25.4: Trial-Mode für First-Subscription (User hat noch keine Sub gehabt)
async function userHasHadSub() {
  if (!sbIsLoggedIn()) return false;
  var res = await sbFetch('/rest/v1/stripe_subscriptions?user_id=eq.' + uid + '&select=id&limit=1', {method:'GET'});
  return (res.data || []).length > 0;
}

var trial_days = (await userHasHadSub()) ? 0 : 30;

var resp = await _gsFetch(base + '/functions/v1/stripe-checkout', {
  method: 'POST',
  headers: {...},
  body: JSON.stringify({
    price_id: price.id,
    trial_days: trial_days,    // NEU: an Edge-Fn weitergeben
    success_url: window.location.origin + '/?billing=success&session_id={CHECKOUT_SESSION_ID}',
    cancel_url: window.location.origin + '/?billing=cancel',
  })
});
```

**Cowork muss in stripe-checkout v5 das `trial_days` Param annehmen** (passiert separat — siehe „Cowork-Pflichten" unten).

#### A3.2 — Erstregistrierung-Trial-Prompt
Nach Email-Confirm (URL-Param `?email_confirmed=1`):
- Modal „🌱 Willkommen — wähle deinen Plan"
- 3 Buttons:
  - **Plus 1 Monat kostenlos testen** → `gsStartCheckout('plus_monthly')`
  - **Pro 1 Monat kostenlos testen** → `gsStartCheckout('pro_monthly')`
  - **Mit Free-Plan starten** → schließt Modal
- Hint: „Kündbar jederzeit. Du behältst die Vorteile bis zum Periodenende."

---

## A5 — Abo-Info verbessern + funktionsfähiges Kündigen

### Was zu zeigen
Im „Mein Abo"-Bereich (Settings → Abo):

```
┌─────────────────────────────────────────┐
│  💎 GreenScan Plus                       │
│                                          │
│  Status: ✅ Aktiv (Trial)                │
│  Nächste Abrechnung: 09.06.2026          │
│  Verbleibend: 28 Tage                    │
│  Preis: CHF 3.90 / Monat (nach Trial)    │
│                                          │
│  [📋 Stripe-Portal öffnen]               │
│  [⚠️ Abo kündigen]                       │
└─────────────────────────────────────────┘
```

Wenn `cancel_at_period_end=true`:
```
┌─────────────────────────────────────────┐
│  💎 GreenScan Plus (Gekündigt)           │
│                                          │
│  Status: 🟡 Endet am 09.06.2026          │
│  Verbleibend: 28 Tage Premium-Zugriff    │
│                                          │
│  [↩️ Kündigung zurücknehmen]             │
└─────────────────────────────────────────┘
```

### Implementation
```js
async function gsLoadSubInfo() {
  var uid = gsStore.get('gs_sb_uid');
  if (!uid) return null;
  var res = await sbFetch(
    '/rest/v1/stripe_subscriptions?user_id=eq.' + uid +
    '&select=*,stripe_prices(unit_amount,currency,recurring,metadata)&order=created_at.desc&limit=1',
    {method:'GET'}
  );
  return (res.data || [])[0];
}

function gsRenderSubInfo(sub) {
  if (!sub) return '<div>Free-Plan aktiv</div>';
  var now = new Date();
  var endDate = sub.current_period_end ? new Date(sub.current_period_end) : null;
  var daysLeft = endDate ? Math.max(0, Math.ceil((endDate - now) / 86400000)) : null;
  var isCanceled = sub.cancel_at_period_end || sub.status === 'canceled';
  var isTrial = sub.status === 'trialing';

  var statusIcon = isCanceled ? '🟡' : (isTrial ? '🆓' : '✅');
  var statusText = isCanceled ? 'Endet am ' + endDate.toLocaleDateString('de-CH')
                  : (isTrial ? 'Aktiv (Trial)' : 'Aktiv');

  var html = '<div class="abo-card">' +
    '<h3>💎 GreenScan ' + (sub.tier ? sub.tier.charAt(0).toUpperCase() + sub.tier.slice(1) : 'Plus') + '</h3>' +
    '<p>' + statusIcon + ' ' + statusText + '</p>';

  if (daysLeft !== null) {
    html += '<p>📅 Verbleibend: <strong>' + daysLeft + ' Tage</strong></p>';
  }
  if (sub.stripe_prices && !isCanceled) {
    var price = (sub.stripe_prices.unit_amount / 100).toFixed(2);
    html += '<p>💰 Preis: CHF ' + price + ' / ' + (sub.stripe_prices.recurring?.interval === 'year' ? 'Jahr' : 'Monat') + '</p>';
  }

  if (isCanceled) {
    html += '<button onclick="gsUncancelSub()">↩️ Kündigung zurücknehmen</button>';
  } else {
    html += '<button onclick="gsOpenBillingPortal()">📋 Stripe-Portal</button>';
    html += '<button onclick="gsConfirmCancelSub()">⚠️ Abo kündigen</button>';
  }
  html += '</div>';
  return html;
}

async function gsConfirmCancelSub() {
  var ok = await gsConfirmModal({
    title: 'Abo wirklich kündigen?',
    message: 'Du behältst alle Plus-Features bis zum Ende deiner Periode. Danach wird auf Free-Plan umgeschaltet — keine Sofort-Sperre.',
    ok: 'Ja, kündigen',
    cancel: 'Abbrechen',
    kind: 'warn'
  });
  if (!ok) return;
  // Via Stripe-Portal (Cowork-Edge-Fn) — User wird zu Stripe-Hosted Cancel-Page geleitet
  await gsOpenBillingPortal('cancel');
}

async function gsUncancelSub() {
  // Stripe-Portal mit Reactivate-Flow
  await gsOpenBillingPortal('reactivate');
}
```

### Pflicht-Hinweis: `cancel_at_period_end=true` (Stripe Soft-Cancel)
NICHT direkt löschen — Stripe behält Subscription, setzt `cancel_at_period_end=true`. User behält Tier bis `current_period_end`. Past-Due-Migration v24.52 handhabt das schon korrekt (View liefert tier='plus' bis Periode endet).

---

## 🤝 Cowork-Pflichten (parallel zu Code)

### Backend-Polish v25.4

1. **`stripe-checkout` v5 mit `trial_days` Support:**
```ts
const { price_id, success_url, cancel_url, claim_launch_offer, trial_days } = await req.json();
// ...
if (trial_days && trial_days > 0 && mode === 'subscription') {
  sessionParams.subscription_data = {
    metadata: { supabase_user_id: user.id },
    trial_period_days: trial_days,
  };
}
```

2. **Verify dass `stripe-portal` Cancel-Flow erlaubt** — sonst `stripe.billingPortal.configurations.create({...features: { subscription_cancel: { enabled: true, mode: 'at_period_end' } } ...})`

3. **Test-Card-Verify** sobald Code v25.4 deployed: Card-Test → DB-Check (Subscription erstellt, status=trialing, trial_end=+30d)

### Heute schon gemacht (vor diesem Briefing)
- ✅ Webhook-Endpoint rotiert + neuer Secret in app_settings (`whsec_***REDACTED***` — v30.86: Prefix aus Repo entfernt, Secret liegt nur noch in Supabase app_settings)
- ✅ stripe-webhook v6 deployed (Cache-Bust)
- ✅ stripe-setup-webhook v2 mit `?rotate=1` Support
- ✅ stripe-bootstrap v4 mit metadata.lookup_key Backwards-Compat
- ✅ stripe-checkout v4 mit Schema-Fix + green-scan.ch URL

---

## ✅ Definition of Done für v25.4

- [ ] **A1**: Logout zeigt sofort `onb-start` Onboarding (nicht letzte Seite)
- [ ] **A2**: Login zeigt Home-Tab + Welcome-Back-Toast (kein Welcome-Modal)
- [ ] **A3**: Erstregistrierung → 1-Monat-Trial-Modal nach Email-Confirm
- [ ] **A4 (gefixt)**: Test-Card 4242 → Subscription in DB
- [ ] **A5**: „Mein Abo"-Tab zeigt Restlaufzeit + Status + Cancel-Button + Reactivate-Button
- [ ] 7/7 Inline-Scripts node --check ✓
- [ ] LIVE auf green-scan.ch
- [ ] STATUS.md updated

---

## Reihenfolge

1. **A1 + A2** zuerst (5 Min Edits, sofort verbessert User-Experience)
2. **A5** dann (gsLoadSubInfo + gsRenderSubInfo + Cancel-Modal — 1h)
3. **A3** zum Schluss (braucht Cowork-`stripe-checkout` v5 mit trial_days — Code+Cowork koordinieren)

---

**Stand:** 2026-05-10 · Cowork-Audit · Stripe-Backend bereits gefixt
