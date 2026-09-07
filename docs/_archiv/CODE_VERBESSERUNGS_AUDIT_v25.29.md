# Code-Verbesserungs-Audit v25.29 — Was Code als nächstes fixen MUSS

> **Cowork-Audit 2026-05-11.** Systematischer Scan der LIVE-Codebase nach Bugs, Tech-Debt, A11y, Performance, Security. Pro Befund: Severity, konkreter Code-Pfad, Fix-Vorschlag, Aufwand.

---

## 🟢 COWORK-UPDATE 2026-05-11: 3 Bugs in einem API-Call lösbar

**Cowork hat NEU deployed (während Audit):**

1. **`marketplace-publish` Edge-Fn v1** (verify_jwt: true) — All-in-One:
   ```
   POST .../functions/v1/marketplace-publish
   Body: { title, description, category, price_mode, price?, currency,
           region, contact, photos_b64: ["<b64>"...3 max], listing_id? }
   Response: { ok, listing: {...komplette DB-Row...}, photo_count, photo_failures }
   ```
   - Validation + Storage-Upload + DB-INSERT in einem Call
   - Schema-Adapt automatisch (kein Frontend-Adapter nötig)
   - User-ID kommt aus JWT (verifiziert serverseitig)
   - photo_url + photo_urls werden nach Upload gesetzt
   - Bei listing_id → UPDATE (nur wenn owner)

2. **View `v_marketplace_listings`** für Display:
   ```sql
   GET /rest/v1/v_marketplace_listings?order=created_at.desc&limit=20
   ```
   Liefert: alle DB-Felder + `seller_name`, `seller_avatar`, `seller_is_expert`,
   `seller_is_premium`, `seller_level` aus profiles-JOIN.

3. **RPC `fn_mkt_increment_views(uuid)`**:
   ```sql
   POST /rest/v1/rpc/fn_mkt_increment_views { p_listing_id: '<uuid>' }
   ```

4. **Schema erweitert:** marketplace_listings hat jetzt `contact`, `photo_urls[]`,
   `price_mode`, `reports`. Plus Indexes für Filter, Trigger für updated_at.

**Frontend-Aufwand reduziert: 3-4h → ~1-1.5h.** Code muss nur:
- saveListing() umschreiben auf 1 Call → marketplace-publish
- renderMarket() umstellen auf v_marketplace_listings View
- Listing-Open: fn_mkt_increment_views aufrufen

→ siehe REVIDIERTES Fix-Snippet weiter unten am Ende dieses Docs.

---

## 🔴 P0 — Hard-Bugs (BLOCKER, sofort) — ALTER ANSATZ (jetzt vereinfacht durch Cowork-Helper, siehe oben)

### BUG #1 — Marketplace `saveListing()` macht KEIN Cloud-INSERT
**Anker:** `index.html:14248` function `saveListing`
**Severity:** 🔴 P0 (User-Listings unsichtbar für andere User)

**Beweis (Live-DB):**
```sql
SELECT COUNT(*) FROM marketplace_listings; -- 3 (nur Cowork-Test-Listings)
SELECT COUNT(DISTINCT user_id) FROM marketplace_listings; -- 1 (admin)
```

**Root-Cause:** Funktion schreibt NUR `window._gsMarket.unshift(listing)` + `gsMarketSave()` (localStorage). KEIN `sbFetch('/rest/v1/marketplace_listings', POST)`. Toast „✅ Angebot veröffentlicht" lügt.

**Fix-Snippet:**
```js
async function saveListing() {
  // ... existing validation ...
  var user = gsMarketUser();
  if (!sbIsLoggedIn() || !user.email) {
    showProfileToast('🔑 Bitte einloggen um zu veröffentlichen', 'error');
    return;
  }
  var uid = gsStore.get('gs_sb_uid', null);
  var localId = 'L' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
  var listing = {
    id: localId,  // local-only id, separate vom DB-uuid
    title: title.slice(0,80),
    desc: desc.slice(0,500),
    cat: cat,
    priceMode: pmode,
    price: (pmode === 'fix' || pmode === 'vb') ? parseFloat(price) : 0,
    currency: 'CHF',
    region: region,
    images: (window._gsNlPhotos || []).slice(0, 3),
    contact: contact.slice(0,80),
    sellerId: user.email,
    sellerName: user.name,
    sellerEmail: user.email,
    verified: user.verified,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'active', reports: 0, views: 0
  };
  // 1) Lokal sofort speichern (offline-first UX)
  var listings = gsMarketLoad();
  listings.unshift(listing);
  window._gsMarket = listings;
  gsMarketSave();
  // 2) Cloud-INSERT (mit Schema-Adapter — siehe BUG #2)
  try {
    var dbRow = gsMktAdaptToDb(listing, uid);  // siehe Helper unten
    var r = await sbFetch('/rest/v1/marketplace_listings', {
      method:'POST',
      headers:{'Content-Type':'application/json','Prefer':'return=representation'},
      body: JSON.stringify(dbRow)
    });
    if (r.data && r.data[0]) {
      // DB-uuid mit local-id mappen für Edit/Delete
      listing.cloudId = r.data[0].id;
      gsMarketSave();
      showProfileToast('✅ Angebot live im Cloud-Marketplace', 'success');
    } else {
      showProfileToast('⚠️ Lokal gespeichert, Cloud-Sync später', 'warn');
    }
  } catch(e) {
    console.warn('[saveListing cloud-INSERT]', e);
    showProfileToast('⚠️ Lokal gespeichert, Cloud-Sync später', 'warn');
  }
  closeModal('detail-modal');
  renderMarket();
}
```

**Aufwand:** 1h Code + 30min Testing.

---

### BUG #2 — Marketplace Schema-Mismatch Frontend↔Backend
**Anker:** `index.html:14248-14290` (saveListing) + Render-Pfade
**Severity:** 🔴 P0 (verbunden mit BUG #1)

**Mismatch-Tabelle:**
| Frontend | Backend (DB) |
|---|---|
| `desc` | `description` |
| `cat` | `category` |
| `images[]` (base64-array) | `photo_url` (single text) |
| `sellerId` | `user_id` (uuid) |
| `createdAt` (epoch ms) | `created_at` (timestamptz) |
| `priceMode` | (custom?) |
| `region` | `region` (ok) |
| `views` | `view_count` |

**Fix:** Schema-Adapter-Funktionen anlegen:
```js
function gsMktAdaptToDb(local, uid) {
  return {
    user_id: uid,
    title: local.title,
    description: local.desc,
    category: local.cat,
    price: local.price || null,
    currency: local.currency,
    region: local.region,
    contact: local.contact,
    photo_url: (local.images && local.images[0]) || null,
    // weitere Fotos via marketplace-photos Bucket — siehe BUG #3
    status: local.status || 'active',
    metadata: {
      priceMode: local.priceMode,
      images_count: (local.images || []).length,
      verified: !!local.verified,
      sellerName: local.sellerName,
      local_id: local.id
    }
  };
}

function gsMktAdaptFromDb(dbRow) {
  return {
    id: dbRow.id,  // Cloud-uuid als id, kein local-id mehr
    title: dbRow.title,
    desc: dbRow.description,
    cat: dbRow.category,
    price: dbRow.price,
    currency: dbRow.currency,
    region: dbRow.region,
    contact: dbRow.contact,
    images: dbRow.photo_url ? [dbRow.photo_url] : [],
    sellerId: dbRow.user_id,
    sellerName: dbRow.metadata?.sellerName || 'Anonym',
    sellerEmail: dbRow.metadata?.sellerEmail,
    verified: dbRow.metadata?.verified,
    priceMode: dbRow.metadata?.priceMode || 'fix',
    createdAt: new Date(dbRow.created_at).getTime(),
    updatedAt: new Date(dbRow.updated_at).getTime(),
    status: dbRow.status, reports: 0, views: dbRow.view_count || 0
  };
}
```

**Aufwand:** 30min.

---

### BUG #3 — Marketplace-Fotos als base64-Array statt Storage-Bucket
**Anker:** `index.html` `_gsNlPhotos[]` (3 base64-komprimierte Fotos pro Listing)
**Severity:** 🔴 P0 (sprengt localStorage-Quota schnell + nicht in Cloud)

**Backend-Status:** Cowork hat 2026-05-09 den `marketplace-photos`-Storage-Bucket angelegt. Frontend nutzt ihn aber nicht.

**Fix-Snippet:**
```js
async function gsUploadMktPhoto(b64Image, listingLocalId, idx) {
  if (!sbIsLoggedIn()) return null;
  var uid = gsStore.get('gs_sb_uid', null);
  var blob = await (await fetch('data:image/jpeg;base64,'+b64Image)).blob();
  var path = uid + '/' + listingLocalId + '_' + idx + '.jpg';
  var r = await fetch(SB_URL + '/storage/v1/object/marketplace-photos/' + path, {
    method:'POST',
    headers: {
      'Authorization': 'Bearer ' + gsStore.get('gs_sb_token', null),
      'Content-Type': 'image/jpeg'
    },
    body: blob
  });
  if (!r.ok) return null;
  return SB_URL + '/storage/v1/object/public/marketplace-photos/' + path;
}

// In saveListing nach DB-INSERT:
var photoUrls = [];
for (var i = 0; i < (window._gsNlPhotos || []).length; i++) {
  var url = await gsUploadMktPhoto(window._gsNlPhotos[i], listing.id, i);
  if (url) photoUrls.push(url);
}
// Update listing.photo_url + metadata.images = photoUrls[]
```

**Aufwand:** 1-2h.

---

## 🟠 P1 — Tech-Debt (in nächstem Sprint)

### TECH #1 — gsStore-Welle 4 (~70 Calls über 10 Hot-Keys)
**Anker:** Verteilt
**Severity:** 🟠 P1 (Quota-Risiko bei Storage-Pressure)

**Top-Keys:**
| Key | Calls | Datentyp |
|---|---|---|
| gs_admin_log | 10 | Audit-Log JSON-Array |
| gs_quiz_streak | 9 | Quiz-Streak-Counter |
| gs_market_listings | 8 | localStorage-Fallback für Marketplace |
| gs_streak | 7 | Login-Streak |
| ps_myplants | 5 | Pflanzen-Array |
| gs_prefs | 5 | User-Preferences |
| gs_plantings | 5 | Pflanzungs-Slots |
| gs_claude_model | 5 | Aktuelles AI-Modell |
| gs_dead_plants | 4 | Verstorbene Pflanzen |
| gs_seed_inventory | 4 | Saatgut-Bestand |

**Fix-Pattern (1:1 wie Welle 1+2):**
```js
// VORHER:  localStorage.setItem('gs_admin_log', JSON.stringify(log));
// NACHHER: gsStore.set('gs_admin_log', JSON.stringify(log));

// VORHER:  var raw = localStorage.getItem('gs_admin_log');
// NACHHER: var raw = gsStore.get('gs_admin_log', null);

// VORHER:  localStorage.removeItem('gs_admin_log');
// NACHHER: gsStore.remove('gs_admin_log');
```

**Aufwand:** 2-3h (mechanisch, batchbar mit grep+sed).

---

### TECH #2 — Z-Index-Token-Migration (43 hardcoded vs 18 Token)
**Severity:** 🟠 P1 (Layer-Konsistenz, vermeidet v25.25-ähnliche Modal-Bugs)

**Hot-Spots aus Audit:**
- `2000` (menu-overlay)
- `4500-4900` (scan-chat, quiz, schema)
- `5500-5900` (about, rechtlich, book-ingest, smart-home)
- `6000-6500` (dynamische Modals)
- `8000+` (Banner-Layer)
- `9000+` (auth-pflicht-modal — KOLLIDIERT mit Onboarding 9999999, siehe v25.25)
- `9999999` (Onboarding)

**CSS-Token-Vorschlag:**
```css
:root {
  --z-base: 1;
  --z-tooltip: 1500;
  --z-menu: 2000;
  --z-overlay: 4000;
  --z-modal: 5000;
  --z-modal-detail: 5500;
  --z-modal-special: 6000;
  --z-banner: 8000;
  --z-prompt: 9000;
  --z-auth: 9500;        /* NEU für gs-auth-pflicht-modal */
  --z-onboarding: 9999;  /* NEU — runter von 9999999 für sauberen Stack */
  --z-toast: 99999;      /* immer ganz oben */
}
```

**Aufwand:** 2-3h.

---

### TECH #3 — `<input>` ohne `maxlength` (102 von 125 = 81%)
**Severity:** 🟠 P1 (DoS-Vektor, DB-Bloat-Risiko)

**Quick-Audit:**
```bash
grep -nE '<input[^>]*type=' index.html | grep -v 'maxlength' | head -20
```

**Pattern pro Input-Type:**
- `type="text"` → maxlength=200 (default), 80 für Titel, 500 für desc
- `type="email"` → maxlength=254 (RFC-Standard)
- `type="password"` → maxlength=128
- `type="number"` → kein maxlength nötig (input-validation)
- `type="search"` → maxlength=100

**Aufwand:** 1h (mechanisch).

---

### TECH #4 — A11y: 763 Buttons, nur 88 mit aria-label (88%)
**Severity:** 🟠 P1 (Screen-Reader unbrauchbar für viele Funktionen)

**Pattern:**
```html
<!-- VORHER -->
<button onclick="closeModal('x')">×</button>

<!-- NACHHER -->
<button onclick="closeModal('x')" aria-label="Schliessen">×</button>
```

**Priorität:**
1. Icon-only Buttons (×, ✕, 📷, 🔔) — alle brauchen aria-label
2. Toggle-Buttons (👁️ Pw-show) — aria-pressed dazu
3. Tab-Buttons — bereits role=tab + aria-controls in v23.x

**Aufwand:** 3-4h (semi-mechanisch, jeden Button einzeln prüfen).

---

## 🟡 P2 — Quality-of-Life (nice to have)

### QOL #1 — Console-Cleanup (191 Total: 65 log + 111 warn + 15 error)
**Severity:** 🟡 P2 (Production-Polish, kein User-Impact)

**Strategie:** alle `console.log()` raus, `console.warn/error` behalten für Debug. Wrapper:
```js
if (window.GS_DEBUG) console.log = function(){};
```

**Aufwand:** 30min.

---

### QOL #2 — Performance: index.html Lazy-Split
**Severity:** 🟡 P2 (5.4MB initial-bundle)

**Optionen:**
- KI-Planer-Code in lazy-loaded Modul (Z.40000+ Three.js-Render)
- Marketplace-Code lazy (Z.14000-15000)
- Voice-Mode-Code lazy (Z.36000+)

**Aufwand:** 1 Tag.

---

### QOL #3 — i18n Pass-2 (~270 Rest-Strings)
**Severity:** 🟡 P2 (Schweizer Markt-Komplettierung)

Bereits als v25.28 separates Briefing weitergegeben.

---

## 🟢 P3 — Strategische Updates (Phase 3)

### STRAT #1 — Stripe Test-Card 4242 verifizieren
**Severity:** 🟢 P3 (für Live-Launch zwingend, aber nicht Code-Aufgabe)

**Beweis (Live-DB):**
```sql
SELECT COUNT(*) FROM stripe_subscriptions; -- 0
SELECT COUNT(*) FROM stripe_webhook_events; -- 0
```

→ Niemand hat je gezahlt. Fernando muss das durchspielen.

---

### STRAT #2 — Service-Worker Cache-Strategie für i18n-Bundles
**Severity:** 🟢 P3

`gs_i18n_bundles` in localStorage funktioniert, aber Service-Worker könnte sie auch in IndexedDB cachen für Offline-Switch.

**Aufwand:** 2h.

---

## 📋 Zusammenfassung: Empfohlener nächster Code-Sprint

**Sprint v25.30+ Empfehlung — „Marketplace Repair + Tech-Debt"** (~1 Tag):
1. 🔴 **BUG #1+#2+#3** Marketplace komplett funktional machen (~3h)
2. 🟠 **TECH #1** gsStore-Welle 4 (~3h)
3. ⏰ Pre-Push-Verify + 7/7 node --check + v-Bump v25.30
4. ⏰ Cowork verifiziert per SQL: `SELECT COUNT(*) FROM marketplace_listings WHERE created_at > now() - interval '1 hour'`

**ODER alternativ — „Phase-2-Feature-Sprint"** (~2 Tage):
- v25.30 KI-Pflanzendoktor + v25.31 Erntekalender (Backend ready, siehe `EDGE_FUNCTIONS_v25.30_PHASE2_API.md`)

**Mein Vorschlag:** Erst Bug-Sprint (Marketplace ist ein VERTRAUENS-Killer wenn User nichts veröffentlichen können), DANN Phase-2-Features.

---

**Stand:** 2026-05-11 nach v25.29-Audit · Cowork-Audit-Pass-12

---

## 🔧 REVIDIERTES Frontend-Fix-Snippet (1-Call statt 4)

```js
// v25.30 — saveListing() neu mit marketplace-publish Edge-Fn
async function saveListing() {
  var title = document.getElementById('nl-title').value.trim();
  var cat = localStorage.getItem('gs_nl_cat') || '';
  var pmode = localStorage.getItem('gs_nl_pmode') || '';
  var price = document.getElementById('nl-price').value;
  var region = document.getElementById('nl-region').value;
  var desc = document.getElementById('nl-desc').value.trim();
  var contact = document.getElementById('nl-contact').value.trim();

  // Validation (wie vorher)
  if (!title) { showProfileToast('Titel fehlt', 'info'); return; }
  if (!cat) { showProfileToast('Kategorie wählen', 'info'); return; }
  if (!pmode) { showProfileToast('Preis-Typ wählen', 'info'); return; }
  if (!region) { showProfileToast('Kanton wählen', 'info'); return; }
  if (!contact) { showProfileToast('Kontakt fehlt', 'info'); return; }
  if ((pmode === 'fix' || pmode === 'vb') && !price) { showProfileToast('Preis angeben', 'info'); return; }
  if (!sbIsLoggedIn()) { showProfileToast('🔑 Bitte einloggen', 'error'); return; }

  showProfileToast('⏳ Veröffentliche…', 'info');

  try {
    var token = gsStore.get('gs_sb_token', null);
    var resp = await _gsFetch(SB_URL + '/functions/v1/marketplace-publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SB_KEY,
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        title: title.slice(0, 80),
        description: desc.slice(0, 500),
        category: cat,
        price_mode: pmode,
        price: (pmode === 'fix' || pmode === 'vb') ? parseFloat(price) : null,
        currency: 'CHF',
        region: region,
        contact: contact.slice(0, 80),
        photos_b64: (window._gsNlPhotos || []).slice(0, 3)
      })
    }, 60000);  // 60s Timeout für Foto-Upload
    var j = await resp.json();
    if (!resp.ok || !j.ok) {
      showProfileToast('⚠️ ' + (j.error || 'Fehler beim Veröffentlichen'), 'error');
      return;
    }
    // Erfolg: lokale Liste + Cloud sind synchron
    showProfileToast('✅ Live im Marketplace! ' + j.photo_count + ' Foto(s) hochgeladen.', 'success');
    try { gsNlClearPhotos(); } catch(_){}
    closeModal('detail-modal');
    if (typeof renderMarket === 'function') renderMarket();
  } catch(e) {
    showProfileToast('⚠️ Netzwerkfehler — versuche es erneut', 'error');
  }
}

// renderMarket() umstellen auf View statt direktem Tabellen-Read
async function loadMarketFromSupabase() {
  var r = await sbFetch('/rest/v1/v_marketplace_listings?select=*&order=created_at.desc&limit=50', { method: 'GET' });
  if (r.error) return [];
  return (r.data || []).map(function(dbRow){
    return {
      id: dbRow.id,
      title: dbRow.title,
      desc: dbRow.description,
      cat: dbRow.category,
      price: dbRow.price,
      currency: dbRow.currency,
      region: dbRow.region,
      contact: dbRow.contact,
      images: dbRow.photo_urls || (dbRow.photo_url ? [dbRow.photo_url] : []),
      sellerId: dbRow.user_id,
      sellerName: dbRow.seller_name,
      sellerIsExpert: dbRow.seller_is_expert,
      sellerIsPremium: dbRow.seller_is_premium,
      sellerLevel: dbRow.seller_level,
      sellerAvatar: dbRow.seller_avatar,
      priceMode: dbRow.price_mode,
      createdAt: new Date(dbRow.created_at).getTime(),
      status: dbRow.status,
      views: dbRow.views || 0
    };
  });
}

// Listing-Detail-Open: View-Counter incrementieren
async function gsMktOpenDetail(listingId) {
  // existing modal-open logic
  // ... PLUS:
  try {
    await sbFetch('/rest/v1/rpc/fn_mkt_increment_views', {
      method: 'POST',
      body: JSON.stringify({ p_listing_id: listingId })
    });
  } catch(_){}  // Best-effort, kein Block bei Fail
}
```

**Definition of Done v25.30 Marketplace-Sprint:**
- [ ] saveListing() ruft marketplace-publish (nicht mehr nur localStorage)
- [ ] renderMarket() liest v_marketplace_listings (nicht mehr social_posts oder direkt-Table)
- [ ] gsMktOpenDetail() inkrementiert views via RPC
- [ ] Cowork-Smoke: SELECT count(*) FROM marketplace_listings WHERE created_at > now() - '5 min' ≥ 1 nach User-Test

