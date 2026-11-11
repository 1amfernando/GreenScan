# Marketplace-Audit (v25.3)

> **Code-Audit:** Claude Code 2026-05-10 · **Auftrag:** AUDIT_v25_BUG_BRIEFINGS.md Bug #4
> **Severity:** P0 (Marktplatz ist effektiv kaputt — UI funktioniert, Backend wird nie geschrieben)

---

## TL;DR

Der Marktplatz hat **3 kritische Bugs** und **2 mittlere Schwächen**. Aktuelles Verhalten: User sieht erstellte Listings nur lokal, andere User sehen sie nie. Das Backend wird **ausschließlich gelesen**, nie beschrieben (außer Like/Delete-PATCH/DELETE auf bereits existierenden Server-Listings).

| # | Bug | Severity | Fix-Owner |
|---|---|---|---|
| M1 | `saveListing()` schreibt nur `localStorage`, kein POST in `marketplace_listings` | 🔴 P0 | Code |
| M2 | Frontend-Schema (`desc`/`cat`/`createdAt`/`images`/etc.) ≠ Backend-Schema (`description`/`category`/`created_at`/`photo_url`/etc.) | 🔴 P0 | Code (+ Cowork beraten) |
| M3 | Photos werden als komprimiertes Base64-Array in JSON gespeichert — nicht via `marketplace-photos` Storage-Bucket | 🔴 P0 | Code + Cowork (Bucket existiert seit 2026-05-09) |
| M4 | `mktLike`/`mktDelete` String-Concat ohne `encodeURIComponent` (Injection-Vuln) | 🟠 P1 | **erledigt v25.3** |
| M5 | `sellerId/sellerEmail` aus localStorage statt `auth.uid()` — RLS-INSERT-Policy würde sowieso `user_id=auth.uid()` erzwingen | 🟡 P2 | Code |

---

## M1 — `saveListing()` macht keinen Backend-INSERT

**Code:** `index.html` Z.18084-18133 (`function saveListing()`).

**Aktuelles Verhalten:**
1. User füllt Listing-Form aus → Klick „Speichern"
2. Listing wird in `gs_market_listings` localStorage-Array prepended
3. `gsMarketSave()` → `localStorage.setItem('gs_market_listings', JSON.stringify(...))`
4. Toast „✅ Angebot veröffentlicht" — **lügt, es ist nirgendwo veröffentlicht**
5. `renderMarket()` zeigt das Listing in der lokalen Liste

**Was fehlt:** Ein `sbFetch('/rest/v1/marketplace_listings', {method:'POST', body: ...})`-Call. RLS-INSERT-Policy ist seit 2026-05-09 (Cowork) auf `auth.uid() = user_id` — d.h. ein authentifizierter User kann inserten, aber `user_id` muss gesetzt sein.

**Fix-Vorschlag (für v25.4 oder v25.5):**
```js
async function saveListing() {
  // ... (bestehende Validierung)
  var user = gsMarketUser();
  var uid = gsStore.get('gs_sb_uid', null);
  if (!uid) {
    showProfileToast('Bitte zuerst einloggen', 'info');
    return;
  }

  var now = Date.now();
  var localListing = { /* bestehendes Schema mit id/title/desc/cat/etc */ };
  var serverListing = {
    user_id: uid,
    title: title.slice(0, 80),
    description: desc.slice(0, 500),
    category: cat,
    price: (pmode === 'fix' || pmode === 'vb') ? parseFloat(price) : 0,
    currency: 'CHF',
    region: region,
    photo_url: null,        // erst nach Storage-Upload (siehe M3)
    status: 'active',
    data: {                 // App-spezifische Felder ins jsonb
      priceMode: pmode,
      contact: contact.slice(0, 80),
      sellerName: user.name
    }
  };

  // Optimistic local-first
  var listings = gsMarketLoad();
  listings.unshift(localListing);
  window._gsMarket = listings;
  gsMarketSave();
  renderMarket();

  // Server-INSERT (gibt Backend-id zurück)
  if (typeof sbFetch === 'function') {
    try {
      var res = await sbFetch('/rest/v1/marketplace_listings', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify(serverListing)
      });
      if (res && res.data && res.data[0]) {
        // Local-id durch Server-id ersetzen
        var serverId = res.data[0].id;
        var l = window._gsMarket.find(function(x){ return x.id === localListing.id; });
        if (l) l.id = serverId;
        gsMarketSave();
        renderMarket();
      } else if (res && res.error) {
        showProfileToast('⚠️ Server-Sync fehlgeschlagen — lokal gespeichert', 'warn');
      }
    } catch(e) {
      showProfileToast('⚠️ Offline — Listing nur lokal', 'warn');
    }
  }
}
```

**Risiken:**
- ID-Migration (lokale `'L'+timestamp` → Server-UUID) braucht Doppel-Tracking
- Bei Konflikt (Server-INSERT fail nach localStorage-Set) ist UI inkonsistent

**Cowork-Verify nötig:**
- Test-Listing per SQL anlegen → Frontend zeigt es?
- Test-User INSERT-Permissions?

---

## M2 — Schema-Mismatch Frontend ↔ Backend

**Frontend `saveListing()`** speichert ein Objekt mit:
```
id (lokal "L<ts>_<rand>"), title, desc, cat, priceMode, price, currency,
region, images[], contact, sellerId, sellerName, sellerEmail, verified,
createdAt, updatedAt, status, reports, views
```

**Backend `marketplace_listings`-Schema** (laut AUDIT_v25_BUG_BRIEFINGS.md Z.123):
```
id (uuid), user_id, title, description, category, price (numeric), currency,
region, photo_url, status, views (int), data (jsonb), created_at, updated_at
```

**Mapping:**
| Frontend | Backend | Notiz |
|---|---|---|
| `id` (`L...`) | `id` (uuid) | komplett anderes Format |
| `title` | `title` | OK |
| `desc` | `description` | umbenennen |
| `cat` | `category` | umbenennen |
| `priceMode` | `data.priceMode` | in jsonb |
| `price` | `price` | OK |
| `currency` | `currency` | OK |
| `region` | `region` | OK |
| `images[]` | `photo_url` (single) + Storage-Bucket | siehe M3 |
| `contact` | `data.contact` | in jsonb |
| `sellerId/sellerEmail` | aus `auth.uid()` ableiten | siehe M5 |
| `sellerName` | `data.sellerName` | in jsonb |
| `verified` | aus `auth.uid()` ableiten | profile-info |
| `createdAt` (ms) | `created_at` (timestamptz) | DB-default |
| `updatedAt` (ms) | `updated_at` (timestamptz) | DB-default |
| `status` | `status` | OK |
| `reports` | `data.reports` | in jsonb |
| `views` | `views` | OK |

**Auch `loadMarketFromSupabase()` Z.9485-9502** würde diese Felder als Server-Format liefern und mit lokalem Format mergen. Aktuell wird **nicht gemerget** — ein Listing aus dem Server hat `description`, eines vom localStorage hat `desc`, der `renderMarket()`-Code sucht nur `desc` → Server-Listings würden ohne Description gerendert.

**Fix erfordert:**
- Adapter-Funktion `_mktServerToLocal(row)` und `_mktLocalToServer(local)` in beiden Pfaden konsistent anwenden
- Alternativ: Frontend-Schema komplett auf Server-Schema umstellen (aufwändiger, aber sauberer)

---

## M3 — Photos nicht im Storage-Bucket

**Aktuelles Verhalten:** `images[]` enthält bis zu 3 base64-komprimierte JPEGs direkt im Listing-Objekt. Bei 3 Fotos × ~80 KB = 240 KB pro Listing in `localStorage` — bei 50 Listings sind 12 MB nur Marketplace im localStorage.

**Backend-Spalte:** `photo_url` (text, single URL).

**Cowork hat 2026-05-09 gemacht:** Storage-Bucket `marketplace-photos` mit RLS angelegt.

**Fix-Vorschlag:**
1. Beim `saveListing()`: ersten Photo via `sbFetch` als multipart-upload an `/storage/v1/object/marketplace-photos/<uid>/<listing-id>_<idx>.jpg` hochladen
2. Storage-URL als `photo_url` in `marketplace_listings`-Row schreiben
3. Bei Display: `photo_url` direkt einbinden (CDN-served)
4. Local-Cache nur als Vorschau (während Upload läuft)

**Alternative Multi-Photo:** `data.photo_urls[]` jsonb-Array statt `photo_url` single. Aber Schema ändern braucht Cowork.

---

## ✅ M4 — encodeURIComponent in mktLike/mktDelete (erledigt v25.3)

**Vorher:** `'/rest/v1/marketplace_listings?id=eq.'+id` — String-Concat.

**Nach v25.3:** `+encodeURIComponent(id)`.

**Memory-Notiz:** Dieser Fix war in v24.13 schon mal drin („G2 (HIGH)" laut Memory-Changelog). Der UPDATE.command-Sync `bae5750` hat den Code auf v24.51-Stand zurückgerollt, der Fix war also weg. Bei v25.3 wieder restauriert.

**Verify (Boundary-Match):**
```bash
grep -nE "marketplace_listings\?id=eq\.[^']*\+(?!encodeURIComponent)" index.html
# sollte 0 Treffer geben
```

---

## M5 — sellerId aus localStorage statt auth.uid()

**Aktuelles Verhalten:** `saveListing()` setzt `sellerId: user.email || 'anon_' + now`. Das ist eine Email oder ein Fake-Anon-String. Backend erwartet `user_id` als UUID.

**Konsequenz mit RLS:** Selbst wenn `saveListing()` gefixt wird (M1), würde der INSERT mit Email-als-user_id fehlschlagen (UUID-Spalte erwartet UUID).

**Fix:** `var uid = gsStore.get('gs_sb_uid', null);` und `sellerId: uid` (ODER nur Server-Side: `user_id: uid` als Backend-Feld, Frontend braucht dann keinen `sellerId` mehr).

---

## E2E-Test-Plan (für Cowork via Chrome-MCP)

**Voraussetzungen:**
- Test-Account eingeloggt
- M1-M3 gefixt (saveListing macht POST + Storage-Upload)
- Cowork hat Test-Listing via SQL angelegt (zur Display-Verifikation)

**Test-Sequenz:**
1. **Tab wechseln zu Marktplatz** → existierende Listings werden geladen (Server + localStorage)
2. **Filter-UI** testen: Kategorie-Buttons, Sort-Dropdown, Region-Dropdown, Search-Input
   - Erwartung: Liste filtert client-side, Counter aktualisiert sich
3. **„+ Inserat erstellen"** → Form ausfüllen mit Titel, Cat, Pmode, Price, Region, Contact
   - Optional: 1-3 Fotos hochladen (komprimieren auf < 100 KB)
4. **„Speichern"** → Erwartung:
   - Toast „✅ Angebot veröffentlicht"
   - Listing erscheint in der Liste
   - Server-Side: neue Row in `marketplace_listings` mit korrektem Schema
   - Storage: Photos im `marketplace-photos`-Bucket
5. **Like-Button** auf eigenem oder fremdem Listing
   - Erwartung: Counter +1 lokal, PATCH in Server (nur eigenes funktioniert wegen RLS)
6. **Delete** auf eigenem Listing
   - Erwartung: Confirm-Dialog, Toast, Listing weg lokal + Server (DELETE mit `auth.uid()=user_id`)
7. **Re-Login auf zweitem Gerät** → eigenes Listing sichtbar (Server-Sync funktioniert)
8. **Logout → ausgeloggter Browser** → Listings sichtbar (lesbar ohne Login = SELECT-Policy `status != 'archived'`)

**Bug-Report-Template:**
```
[Test #X] [iOS/Android/Desktop] [erwartet]: ...
[ist]: ...
[Console-Errors]: ...
[Network 4xx/5xx]: ...
```

---

## Empfehlung für Sprint-Reihenfolge

| Sprint | Was | Aufwand |
|---|---|---|
| v25.3 | ✅ encodeURIComponent-Restore + dieses Audit-Doc | done |
| v25.4 (oder später) | M1 saveListing()-POST + M2 Schema-Adapter | 2-3h |
| v25.5 | M3 Storage-Upload für Photos | 2h |
| v25.6 | M5 user_id aus auth.uid() konsequent + sellerId-Refactor | 1h |
| Test-Sprint | E2E-Test mit Cowork-Chrome-MCP | 1h |

---

**Stand:** 2026-05-10 · Claude Code · Marktplatz-Audit komplett · Frontend-INSERT/Storage-Upload offen
