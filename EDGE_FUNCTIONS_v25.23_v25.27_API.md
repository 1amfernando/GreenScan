# Edge-Function-API v25.23 + v25.26 + v25.27 — Cowork-Backend ready

> **Cowork-deployed 2026-05-11.** Alle 3 Backends LIVE + getestet. Frontend-Integration durch Code.

---

## 🔔 v25.23 — Smart-Push-Notifications

### VAPID-Keys (in `app_settings` gespeichert)

**VAPID Public-Key (Frontend braucht diesen für Subscribe):**
```
BFr4JqzlaIVpnfYhMR14hzjMpjrzPq-2PFGETL2LU4kdsuC2amkOf333lWly3C9TJlgAXF4PZl3wT2ceE6rH9tk
```

Frontend liest den Key dynamisch via:
```js
async function gsGetVapidKey() {
  const r = await sbFetch('/rest/v1/app_settings?key=eq.vapid_public_key&select=value', { method: 'GET' });
  return r.data?.[0]?.value || null;
}
```

### `push_subscriptions` Schema (erweitert)

```
id              uuid PK
user_id         uuid FK auth.users
endpoint        text NOT NULL  -- vom PushSubscription.endpoint
p256dh          text           -- subscription.toJSON().keys.p256dh
auth_secret     text           -- subscription.toJSON().keys.auth
user_agent      text
gps_lat         numeric(9,6)   -- v25.23 NEU für Frost-Check
gps_lng         numeric(9,6)   -- v25.23 NEU
notify_frost    boolean DEFAULT TRUE
notify_water    boolean DEFAULT TRUE
notify_seasonal boolean DEFAULT TRUE
notify_quiz_streak boolean DEFAULT TRUE
quiet_start_hour smallint DEFAULT 22  -- 0-23, Stille-Zeit-Start
quiet_end_hour   smallint DEFAULT 7   -- 0-23, Ende
last_push_sent_at timestamptz
push_failure_count integer DEFAULT 0
created_at, updated_at
```

### Frontend-Integration

**Subscribe-Flow:**
```js
async function gsSubscribePush() {
  const reg = await navigator.serviceWorker.ready;
  const vapidKey = await gsGetVapidKey();
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: gsBase64UrlToUint8(vapidKey)
  });
  const subJson = sub.toJSON();
  const userLoc = JSON.parse(localStorage.getItem('gs_user_location') || '{}');

  await sbFetch('/rest/v1/push_subscriptions', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({
      user_id: gsStore.get('gs_sb_uid', null),
      endpoint: sub.endpoint,
      p256dh: subJson.keys.p256dh,
      auth_secret: subJson.keys.auth,
      user_agent: navigator.userAgent.slice(0, 200),
      gps_lat: userLoc.lat || null,
      gps_lng: userLoc.lng || null,
      notify_frost: true,
      notify_water: true,
      notify_seasonal: true,
      notify_quiz_streak: true,
      quiet_start_hour: 22,
      quiet_end_hour: 7
    })
  });
}

// Helper für VAPID-Key (Base64URL → Uint8Array)
function gsBase64UrlToUint8(b64) {
  const padding = '='.repeat((4 - b64.length % 4) % 4);
  const base64 = (b64 + padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw = atob(base64);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
```

**Settings-UI:**
```
[ ] Frostwarnungen     ☑ aktiv
[ ] Pflege-Erinnerungen ☑ aktiv
[ ] Saisonale Tipps    ☑ aktiv
[ ] Quiz-Streak-Erinnerung ☑ aktiv
Stille-Zeit: [ 22:00 ] - [ 07:00 ]
```

`UPDATE push_subscriptions SET notify_frost = true/false ... WHERE user_id = <uid>`

**Service-Worker (`sw.js`) Push-Handler:**
```js
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(data.title || 'GreenScan', {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-96.png',
    tag: data.tag,
    data: { url: data.url || '/' }
  }));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});
```

### Backend-pg_cron läuft bereits

| Job | Schedule (UTC) | Zweck |
|---|---|---|
| `daily-push-morning` | 0 7 * * * | Frost + Saisonal |
| `daily-push-evening` | 0 19 * * * | Quiz-Streak |

Beide rufen `daily-push-checker` Edge-Fn → iteriert push_subscriptions → sendet Web Push via VAPID.

**Endpoint (für manuelle Tests):**
```
POST https://vowbiueikwrauuceilhc.supabase.co/functions/v1/daily-push-checker?dry_run=1
Headers: x-cron-secret: <aus app_settings.push_cron_secret>
```

`dry_run=1` führt keine echten Pushes aus, gibt aber zurück was gesendet würde.

### `push_send_log` Audit-Tabelle

Jeder Versuch wird geloggt. Frontend kann Anti-Spam-Settings damit machen:
```sql
SELECT category, result, sent_at FROM push_send_log
WHERE user_id = <uid> ORDER BY sent_at DESC LIMIT 20;
```

---

## 👥 v25.26 — Community-Feed Experten-Verifikation

### `expert_verifications` Schema

```
id          uuid PK
post_id     uuid FK social_posts CASCADE
expert_id   uuid FK auth.users CASCADE
status      text CHECK ('pending'|'verified'|'rejected'|'expired')
verification_text text
fee_paid_chf numeric(10,2) DEFAULT 0
fee_paid_at timestamptz
stripe_payment_intent_id text
created_at, updated_at
UNIQUE (post_id, expert_id)
```

### `profiles.is_expert` (existiert bereits)

Admin setzt manuell pro User: `UPDATE profiles SET is_expert = TRUE WHERE id = <uid>;`

### View `v_social_posts_with_verifications`

Frontend nutzt diese statt `social_posts` direkt — gibt zusätzlich:
- `verification_count` (Anzahl Experten-Verifikationen für den Post)
- `is_expert_verified` (mind. 1 status='verified')

```sql
GET /rest/v1/v_social_posts_with_verifications?order=created_at.desc&limit=20&select=*
```

### Frontend-TODO (v25.26)

**Im Community-Feed:**
- Posts mit `is_expert_verified=true` → grünes ✅-Badge
- Hover-Tooltip: "Verifiziert von Experten"
- Counter: `Wenn verification_count > 0 → "✅ <count>x Experten-verifiziert"`

**Für Experten (User mit profiles.is_expert=true):**
- "Verifizieren"-Button auf jedem Post (nur sichtbar wenn is_expert)
- Klick → Modal mit Textfeld "Begründung" + Submit
  ```js
  POST /rest/v1/expert_verifications
  body: { post_id, expert_id: gsStore.get('gs_sb_uid'), status: 'verified', verification_text: '<text>' }
  ```

**Für PRO-User:**
- "Experten-Verifikation anfragen" auf eigenem Post (CHF 0.50)
- Stripe-Checkout via `gsStartCheckout('expert_verification', false, 0)` mit metadata.post_id
- Backend-TODO: stripe-webhook v7 muss expert_verifications.fee_paid_chf+at setzen wenn payment_intent.metadata.post_id da ist (offen für Cowork)

---

## 🌍 v25.27 — i18n FR + IT (+ optional EN/GSW)

### Endpoint

```
POST https://vowbiueikwrauuceilhc.supabase.co/functions/v1/i18n-translate
Auth: Bearer <user-token> (oder Service-Role)
```

**Request:**
```json
{
  "source_lang": "de",
  "target_langs": ["fr", "it"],
  "context": "GreenScan App-UI Buttons + Labels",
  "strings": {
    "btn_add_plant": "🌱 Pflanze hinzufügen",
    "btn_scan": "📷 Scanner",
    "tip_water": "Heute giessen — die Erde ist trocken"
  }
}
```

**Response:**
```json
{
  "ok": true,
  "translations": {
    "fr": {
      "btn_add_plant": "🌱 Ajouter une plante",
      "btn_scan": "📷 Scanner",
      "tip_water": "Arroser aujourd'hui — la terre est sèche"
    },
    "it": {
      "btn_add_plant": "🌱 Aggiungi pianta",
      "btn_scan": "📷 Scanner",
      "tip_water": "Annaffia oggi — il terreno è secco"
    }
  },
  "cached": 0,
  "fetched": 6,
  "tokens": { "in": 762, "out": 338 }
}
```

### Caching

Hash-basiert (SHA-256 über source_text). Zweiter Call mit gleichen Strings → `cached=N`, `tokens=0`. **Kein Anthropic-Call mehr für gecachte Strings.**

### Frontend-TODO (v25.27 + v25.28)

**Bundle-Build:**
```js
// gsI18n existiert seit v23.97 mit Stub-Bundles. Aktivieren:
async function gsBuildI18n() {
  // 1) Sammle alle data-i18n-Keys aus DOM + JS-Strings
  const strings = gsCollectI18nStrings();  // Mapper: key → DE-Text
  // 2) Edge-Fn-Call
  const r = await sbFetch('/functions/v1/i18n-translate', {
    method: 'POST',
    body: JSON.stringify({ source_lang: 'de', target_langs: ['fr','it'], strings, context: 'GreenScan UI' })
  });
  // 3) In gsI18n.bundles speichern
  gsI18n.bundles.fr = r.data.translations.fr;
  gsI18n.bundles.it = r.data.translations.it;
  // 4) Optional: in localStorage cachen für offline
  gsStore.set('gs_i18n_bundles', JSON.stringify(r.data.translations));
}
```

**Sprachauswahl im Settings-Tab:**
```
🌍 Sprache: ( ) Auto-Detect ( ) DE ( ) FR ( ) IT ( ) GSW
```

Auto-Detect via `navigator.language` (Browser-Sprache).

**`data-i18n`-Attribute auf statische Strings:**
```html
<button data-i18n="btn_add_plant">🌱 Pflanze hinzufügen</button>
```

`gsI18n.applyToDOM()` ersetzt textContent basierend auf gewählter Sprache.

**hreflang-Tags fürs SEO:**
```html
<link rel="alternate" hreflang="de" href="https://green-scan.ch/" />
<link rel="alternate" hreflang="fr" href="https://green-scan.ch/?lang=fr" />
<link rel="alternate" hreflang="it" href="https://green-scan.ch/?lang=it" />
```

### Test-Resultate (Live)

| String DE | FR | IT |
|---|---|---|
| 🌱 Pflanze hinzufügen | 🌱 Ajouter une plante | 🌱 Aggiungi pianta |
| 🌿 Garten | 🌿 Jardin | 🌿 Orto |
| Quiz des Tages | Quiz du jour | Quiz del giorno |
| Heute giessen — die Erde ist trocken | Arroser aujourd'hui — la terre est sèche | Annaffia oggi — il terreno è secco |

**Cost:** ~$0.0006 pro 5 Strings × 2 Sprachen (Haiku 4.5 input/output sehr günstig).

---

## ✅ Definition of Done v25.23+v25.26+v25.27

- [ ] **v25.23** Frontend Push-Subscribe-Flow + Service-Worker push-Handler + Settings-UI
- [ ] **v25.26** Community-Feed mit Experten-Badge + Verifizieren-Button
- [ ] **v25.27** Bundle-Builder + Sprachauswahl + data-i18n-Attribute auf Top-50-UI-Strings
- [ ] **v25.28** Restliche UI-Strings + hreflang-Tags

---

## Cowork-Pflichten (offen)

- [ ] Stripe-Webhook v7: payment_intent.succeeded → expert_verifications.fee_paid_chf+at setzen wenn metadata.post_id (für v25.26)
- [ ] Optional: stripe_prices.expert_verification eintragen (CHF 0.50 one-time)

**Stand:** 2026-05-11 · 3 Backends LIVE · Code kann sofort starten
