# AUFTRAG v25.30 + v25.31 — Marketplace-Repair UND Phase-2-Bundle

> **Cowork-Briefing 2026-05-13** nach v25.28-Push. Zwei aufeinanderfolgende Sprints, beide Backends KOMPLETT LIVE. Code wählt: erst Quick-Win v25.30 (~1.5h) ODER direkt Phase-2 v25.31 (~2 Tage).

---

# 🛒 SPRINT v25.30 — Marketplace-Repair (Quick-Win, 1-1.5h)

**Goal:** User-Marketplace-Listings erscheinen endlich im Cloud-Feed (aktuell: nur localStorage, andere User sehen NICHTS).

**Backend:** ✅ KOMPLETT LIVE — neuer `marketplace-publish` Edge-Fn macht Validate + Foto-Upload + DB-INSERT in 1 Call.

**Spec:** `repo-clone/CODE_VERBESSERUNGS_AUDIT_v25.29.md` (revidiertes Snippet ganz unten)

---

## 3 Frontend-Änderungen

### 1) `saveListing()` umschreiben (Z.14248)

```js
async function saveListing() {
  // ... existing validation (title, cat, pmode, region, contact) bleibt unverändert ...

  if (!sbIsLoggedIn()) {
    showProfileToast(gsI18n.t('toast_market_login_required', '🔑 Bitte einloggen um zu veröffentlichen'), 'error');
    return;
  }

  showProfileToast(gsI18n.t('toast_market_publishing', '⏳ Veröffentliche…'), 'info');

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
    }, 60000);  // 60s für Foto-Upload

    var j = await resp.json();
    if (!resp.ok || !j.ok) {
      showProfileToast('⚠️ ' + (j.error || gsI18n.t('toast_market_error', 'Fehler beim Veröffentlichen')), 'error');
      return;
    }
    showProfileToast(gsI18n.t('toast_market_published', '✅ Live im Marketplace!') + ' (' + j.photo_count + ' Foto)', 'success');
    try { gsNlClearPhotos(); } catch(_){}
    closeModal('detail-modal');
    if (typeof renderMarket === 'function') renderMarket();
  } catch(e) {
    showProfileToast(gsI18n.t('toast_market_network_error', '⚠️ Netzwerkfehler — versuche es erneut'), 'error');
  }
}
```

### 2) `loadMarketFromSupabase()` umstellen auf View

```js
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
```

### 3) Listing-Detail-Open: Views-Counter inkrementieren

```js
async function gsMktOpenDetail(listingId) {
  // existing modal-open logic ... PLUS:
  try {
    await sbFetch('/rest/v1/rpc/fn_mkt_increment_views', {
      method: 'POST',
      body: JSON.stringify({ p_listing_id: listingId })
    });
  } catch(_){}
}
```

## v25.30 Versions-Disziplin

```
GS_VERSION = 'v25.30'
sw.js = 'gs-v25.30'
_headers v25.30
meta = 25.30.20260513
GS_RELEASES Top-Eintrag
```

## v25.30 Smoke-Test (Cowork verifiziert)

```sql
-- Vor User-Test
SELECT COUNT(*) FROM marketplace_listings; -- aktuell 3

-- User postet 1 Listing mit 2 Fotos
-- Cowork prüft:
SELECT id, title, photo_url, photo_urls, seller_name FROM v_marketplace_listings
ORDER BY created_at DESC LIMIT 1;
-- erwartet: 4 rows total, dein Listing mit 2 photo_urls + Storage-URLs
```

---

# 🩺 SPRINT v25.31 — Phase-2-Bundle (KI-Pflanzendoktor + Erntekalender, ~2 Tage)

**Goal:** PictureThis-Killer-Feature (KI-Doctor mit Vision-AI) + Erntekalender mit Statistik (User-Engagement-Boost).

**Backend:** ✅ KOMPLETT LIVE — `plant_doctor_history` + `harvest_log` + `v_harvest_stats_per_user` + `plant-doctor-diagnose` Edge-Fn.

**Spec:** `repo-clone/EDGE_FUNCTIONS_v25.30_PHASE2_API.md`

---

## v25.31 Teil A — KI-Pflanzendoktor

### Frontend-Bausteine

1. **Garten-Tab → neuer Action-Button** „🩺 Diagnose"
   - Anker: bei den existing Bee/Disease/Season/Insights/Voice/Saved-Plans Buttons
   - openDoctorModal()

2. **Diagnose-Modal**
   ```html
   <div id="doctor-modal" class="modal-overlay">
     <h3 data-i18n="doctor_title">🩺 Pflanzen-Diagnose</h3>
     <input type="file" id="doctor-photo" accept="image/*" capture="environment">
     <select id="doctor-plant"><!-- aus myPlants füllen --></select>
     <div id="doctor-symptoms">
       <!-- 8 Multi-Select Symptom-Tags: gelbe_blaetter, welke, flecken,
            schaedling_sichtbar, missbildung, faulnis, vertrocknung, parasit -->
     </div>
     <textarea id="doctor-note" placeholder="Zusätzliche Beobachtungen…"></textarea>
     <button onclick="gsRunDiagnose()">🔍 Diagnose starten</button>
   </div>
   ```

3. **`gsRunDiagnose()` Wrapper**
   ```js
   async function gsRunDiagnose() {
     var fileEl = document.getElementById('doctor-photo');
     if (!fileEl.files[0]) {
       showProfileToast(gsI18n.t('doctor_no_photo', 'Bitte Foto hochladen'), 'error');
       return;
     }
     var b64 = await gsFileToBase64(fileEl.files[0]);  // existing helper, falls nicht: erstellen
     var symptoms = Array.from(document.querySelectorAll('#doctor-symptoms input:checked')).map(c => c.value);
     var plantSelect = document.getElementById('doctor-plant');
     var plant = myPlants.find(p => p.id === plantSelect.value);
     var note = document.getElementById('doctor-note').value;

     showProfileToast(gsI18n.t('doctor_analyzing', '🔬 KI analysiert…'), 'info');

     var token = gsStore.get('gs_sb_token', null);
     var resp = await _gsFetch(SB_URL + '/functions/v1/plant-doctor-diagnose', {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'apikey': SB_KEY,
         'Authorization': 'Bearer ' + token
       },
       body: JSON.stringify({
         photo: b64.replace(/^data:image\/\w+;base64,/, ''),
         species_lat: plant?.lat || null,
         species_name: plant?.name || '',
         symptoms: symptoms,
         user_note: note,
         plant_local_id: plant?.id || null,
         save_history: true
       })
     }, 60000);

     var j = await resp.json();
     if (!j.ok) {
       showProfileToast('⚠️ ' + (j.error || gsI18n.t('doctor_error', 'Diagnose fehlgeschlagen')), 'error');
       return;
     }
     gsRenderDoctorResult(j);
   }
   ```

4. **Result-Render**
   ```js
   function gsRenderDoctorResult(j) {
     var d = j.diagnosis;
     var t = j.treatment_plan;
     var html = '<div class="doctor-result">';
     html += '<div class="doctor-urgency urgency-' + d.urgency + '">' +
             gsI18n.t('doctor_urgency_' + d.urgency, d.urgency) + '</div>';
     html += '<h4 data-i18n="doctor_top_diagnosis">Wahrscheinlichste Diagnose:</h4>';
     html += '<div class="hypothesis-top">' + d.top + ' (' + Math.round(d.hypotheses[0].confidence * 100) + '%)</div>';
     html += '<div class="hypothesis-list">';
     d.hypotheses.forEach(function(h){
       html += '<div class="hypothesis"><b>' + h.name + '</b> (' + Math.round(h.confidence*100) + '%): ' + h.reason + '</div>';
     });
     html += '</div>';
     html += '<h4 data-i18n="doctor_treatment">Behandlung:</h4>';
     t.steps.forEach(function(s, i){
       html += '<div class="treatment-step priority-' + s.priority + '">' +
               '<b>' + (i+1) + '. ' + s.title + '</b><br>' + s.description +
               '<span class="when">⏱ ' + s.when + '</span></div>';
     });
     if (t.natural_remedies && t.natural_remedies.length) {
       html += '<h5>Natürliche Hilfsmittel:</h5><ul>';
       t.natural_remedies.forEach(r => html += '<li>' + r + '</li>');
       html += '</ul>';
     }
     html += '<div class="when-pro">⚠️ ' + t.when_call_pro + '</div>';
     html += '<button onclick="gsDoctorFollowup(\'' + j.history_id + '\', \'helpful\')">👍 Hilfreich</button>';
     html += '<button onclick="gsDoctorFollowup(\'' + j.history_id + '\', \'got_better\')">✅ Wurde besser</button>';
     html += '<button onclick="gsDoctorFollowup(\'' + j.history_id + '\', \'got_worse\')">⚠️ Wurde schlechter</button>';
     html += '</div>';
     document.getElementById('doctor-result').innerHTML = html;
     gsI18n.applyToDOM(document.getElementById('doctor-result'));
   }

   async function gsDoctorFollowup(historyId, status) {
     await sbFetch('/rest/v1/plant_doctor_history?id=eq.' + historyId, {
       method: 'PATCH',
       headers: {'Content-Type':'application/json','Prefer':'return=minimal'},
       body: JSON.stringify({ user_followup: status, followup_at: new Date().toISOString() })
     });
     showProfileToast(gsI18n.t('doctor_followup_thanks', 'Danke für dein Feedback! Hilft anderen User.'), 'success');
   }
   ```

5. **History-Tab im Pflanzen-Detail**
   - GET `/rest/v1/plant_doctor_history?plant_local_id=eq.<id>&order=created_at.desc&limit=20`
   - Liste mit Datum + Top-Diagnose + Status-Badge

---

## v25.31 Teil B — Erntekalender

### Frontend-Bausteine

1. **Pflanzen-Detail → neuer Tab** „🥕 Ernte"
   - Anker: neben „📸 Verlauf" Tab (v25.22)

2. **Ernte-Add-Modal**
   ```html
   <div id="harvest-add-modal">
     <h3 data-i18n="harvest_add_title">🥕 Ernte erfassen</h3>
     <input type="date" id="harvest-date" value="today">
     <input type="number" id="harvest-amount" placeholder="Menge">
     <select id="harvest-unit">
       <option>g</option><option>kg</option><option>stk</option>
       <option>bund</option><option>l</option><option>tasse</option>
     </select>
     <input type="file" id="harvest-photo" accept="image/*" capture="environment">
     <textarea id="harvest-note" placeholder="Notiz (optional)…"></textarea>
     <div class="quality-rating">
       <!-- 5 Stern-Buttons (1-5) -->
     </div>
     <button onclick="gsHarvestSubmit()">✅ Speichern</button>
   </div>
   ```

3. **`gsHarvestSubmit()`**
   ```js
   async function gsHarvestSubmit() {
     var plantId = window._gsCurrentPlantId;
     var plant = myPlants.find(p => p.id === plantId);
     var uid = gsStore.get('gs_sb_uid', null);

     // Optional: Foto via marketplace-photos Bucket oder eigenes harvest-photos (für jetzt: skip foto)
     var row = {
       user_id: uid,
       plant_local_id: plantId,
       species_lat: plant?.lat,
       species_name: plant?.name,
       harvested_at: document.getElementById('harvest-date').value,
       amount_value: parseFloat(document.getElementById('harvest-amount').value),
       amount_unit: document.getElementById('harvest-unit').value,
       note: document.getElementById('harvest-note').value,
       quality_rating: window._gsHarvestRating || null
     };

     var r = await sbFetch('/rest/v1/harvest_log', {
       method: 'POST',
       headers: {'Content-Type':'application/json','Prefer':'return=minimal'},
       body: JSON.stringify(row)
     });
     if (r.error) {
       showProfileToast(gsI18n.t('harvest_save_error', '⚠️ Konnte nicht speichern'), 'error');
       return;
     }
     showProfileToast(gsI18n.t('harvest_saved', '✅ Ernte gespeichert!'), 'success');
     closeModal('harvest-add-modal');
     gsHarvestRender(plantId);  // refresh list
   }
   ```

4. **Statistik-Tab** mit Recharts
   ```js
   async function gsHarvestStatsLoad(year) {
     var uid = gsStore.get('gs_sb_uid', null);
     year = year || new Date().getFullYear();
     var r = await sbFetch('/rest/v1/v_harvest_stats_per_user?user_id=eq.' + uid +
       '&year=eq.' + year + '&order=total_grams.desc', {method:'GET'});
     return r.data || [];
   }
   ```
   Render: Balkendiagramm (recharts, bereits in der App vorhanden)
   Plus: „Diese Saison: X kg / Y Stk Ernte aus Z Pflanzen" als Header

5. **Garten-Tab Header-Erweiterung**
   - Mini-Card mit current-year stats
   - Klick → Statistik-Modal

---

## v25.31 Versions-Disziplin

```
GS_VERSION = 'v25.31'
sw.js = 'gs-v25.31'
_headers v25.31
meta = 25.31.20260513
GS_RELEASES neuer Top-Eintrag mit Item-Liste
```

## v25.31 Smoke-Test (Cowork)

```sql
-- Doctor
SELECT user_id, ai_diagnosis->'top' AS diagnosis, urgency, created_at
FROM plant_doctor_history ORDER BY created_at DESC LIMIT 5;

-- Harvest
SELECT user_id, species_name, amount_value, amount_unit, harvested_at
FROM harvest_log ORDER BY harvested_at DESC LIMIT 10;

-- Stats-View
SELECT * FROM v_harvest_stats_per_user WHERE user_id='<test-uid>' ORDER BY total_grams DESC;
```

---

# 📋 Übersicht: Empfohlene Reihenfolge

| Schritt | Sprint | Aufwand | Wert |
|---|---|---|---|
| 1️⃣ ZUERST | **v25.30 Marketplace** | 1-1.5h | P0 Vertrauens-Bug |
| 2️⃣ DANN | **v25.31 Phase-2** | 2 Tage | Killer-Features (Pro-Plan) |
| 3️⃣ DANACH | **v25.32 gsStore-Welle 4** | 1 Tag mechanisch | Tech-Debt |
| 4️⃣ Optional | **v25.33 AR-View** | 1 Woche P3 | Marketing-Asset |

**v25.30 ist 1.5h Arbeit und schließt den letzten Vertrauens-Killer-Bug — bitte ZUERST machen.**

Danach v25.31 Bundle als großer Phase-2-Sprint.

---

**Stand:** 2026-05-13 nach v25.28-Push · Cowork-Backend für v25.30+v25.31 KOMPLETT LIVE
