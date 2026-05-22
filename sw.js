/* ────────────────────────────────────────────────────────────
   GreenScan Service Worker
   v26.28 — KI-Planer Region-Wiring (AUFTRAG_v26.28): gsRunGardenScan body.metadata bekommt async region_slug (via gsGetRegionContext aus v26.27) + soil_type/soil_ph (aus localStorage gs_soil_profile von v26.25). Backend garden-scan-analyze v2 nutzt das fuer Frost-Constraints + best_vegetables + Boden-Empfehlungen im System-Prompt. plan-iterate v2 lest die region_used aus garden_plans-Record (automatisch region-aware bei Iterationen).
   v26.27 — Regional-Calendar (AUFTRAG_v26.27): neuer Garten-Aktion-Button "🗓️ Regional-Kalender" + Modal mit 7-CH-Hoehenzonen-Picker aus regional_garden_calendars. Wahl persistiert in localStorage gs_region. Render: aktueller Monat prominent in oranger Box (12 Monats-Tasks), best_vegetables (gruen), challenging_plants (orange), 12-Monats-Accordion (current open, andere collapsed). gsGetRegionContext() API fuer KI-Planer-Integration (kann last_frost_avg, growing_season_days, monthly_tasks als Constraint nutzen).
   v26.26 — Heilpflanzen-Profile (AUFTRAG_v26.26): openDetail Pflanzen-Detail-Modal bekommt async geladenen Heilpflanzen-Block falls sp.lat in medicinal_plants_register existiert. gsLoadMedicinalProfile mountet eine groessere gruene Section am Ende des existing Modals mit Badges (Evidenz/CH-heimisch/geschuetzt), dann ZUERST prominent rote Kontraindikationen + orange Wechselwirkungen + gelbe Toxizitaet, dann Verwendung (Pflanzenteile/Wirkstoffe/traditionelle vs evidenzbasierte Anwendung/Zubereitung/Dosierung/Erntezeit/Rechtslage), Footer-Disclaimer. Backwards-compat: keine Section wenn kein Match.
   v26.25 — Bodenverbesserer-Recommender (AUFTRAG_v26.25): Garten-Aktion-Button "🪨 Boden verbessern" + Modal mit pH/Bodenart/Goal Pickers + scoring (50 pH-Match, 18 Type-Match, 25 Goal-Match, 8 Universal). Top-5 aus 15 CH-Bodenverbesserern. Profil in gs_soil_profile localStorage gecached + bei naechstem Open vorausgefuellt. Detail-Modal nutzt v26.23 _gsWave9RenderSoilAmend.
   v26.24 — Pest-Filter im KI-Planer (AUFTRAG_v26.24): gsGardenScanShowPlant Detail-Modal bekommt async geladenen Block mit Top-3 Schaedlingen (plant_pests via host_plants @> [species_lat]) + Companion-Plant-Vorschlaegen (pest_companion_plants via effective_against-Overlap). Severity-Dots + Praevention + Bio-Behandlung pro Pest. "🪲 Schaedling fotografieren"-CTA oeffnet existing v26.21 Pest-Scanner-Modal.
   v26.23 — Wissen-Tab Erweiterung (AUFTRAG_v26.23): 4 neue Sub-Tabs aus DB-Wave-9. Kompostieren (8 Methoden), Vermehrung (12 Methoden), Boden-Pflege (15 Bodenverbesserer), Heilpflanzen (15 CH-Heilpflanzen). gsRenderWissenWave9 generic Renderer mit Filter-Pills (Kategorie-Distinct + Counts) + Card-Liste. gsWave9OpenDetail dispatch zu 4 spezifischen Render-Funktionen (_gsWave9RenderCompost/Propagation/SoilAmend/Medicinal). Heilpflanzen-Renderer mit PROMINENT (rot/orange) Kontraindikationen + Wechselwirkungen + Toxizitaet + Disclaimer-Footer (rechtssicher). 10min in-Memory-Cache pro Section.
   v26.22 — AR-View MVP (AUFTRAG_CODE_v26.18). Three.js-basierter 3D-View fuer 30 Seed-Pflanzen aus ar_models. Da gltf_url=NULL: Fallback-Geometrie (Stamm-Zylinder + Krone-Sphere mit verjuengter Form je nach Hoehe: flach fuer Kraeuter <40cm, Standard-Strauch, vergroessert fuer Baeume >3m). 30 species-spezifische Krone-Farben (Tomate rot, Lavendel violett, Sonnenblume gelb, etc.). _gsARInitScene mit HemisphereLight + DirectionalLight + Shadow-Map + eigener Drag/Pinch/Wheel-Pointer-Logic (statt OrbitControls — spart externe Abhaengigkeit). _gsARDispose disposed Geometries/Materials/Renderer beim Modal-Close (Memory-Leak-frei) via closeModal-Hook. Three.js lazy via existing _gsLoadThree() aus /assets/three.min.js (v25.36).
   v26.21 — Schaedlings-Scanner (AUFTRAG_CODE_v26.19). Neue Edge-Fn pest-identify v1 (verify_jwt:true) mit Anthropic Vision Haiku 4.5 + plant_pests-Knowledge-Context (25 Schweizer Schaedlinge mit Bio-Behandlung + Praevention + natuerliche Feinde, AGFF-Source). Frontend: neuer Garten-Aktion-Button "🪲 Schaedling-Scanner" + Modal mit Foto-Upload (Kamera/Galerie) + optionalem Host-Pflanze-Picker aus myPlants. gsPestRunScan POSTet zu Edge-Fn, gsPestRenderResult zeigt Match mit Confidence-Badge (3 Stufen Gering/Mittel/Hoch), Symptome, Bio-Behandlung, Praevention, natuerliche Feinde + Alternative-Kandidaten. Confidence < 40 zeigt "bitte naeher"-Hint statt false-positive. "📓 Im Garten-Tagebuch festhalten"-Button insertet in garden_diary.
   v26.20 — i18n Frontend-Switcher (AUFTRAG_CODE_v26.20). gsI18n erweitert: neuer loadFromDb(lang) Direct-PostgREST-Pull aus i18n_translations (1 GET-Query, 0 Anthropic-Calls; viel schneller als gsBuildI18n weil Edge-Fn-Cache-Miss-Path entfaellt). 24h-TTL pro Sprache via bundleTs-Map. Boot-Auto-Build: bei detectLang()!=de UND isStale(lang) wird Bundle async beim DOMContentLoaded geladen + applyToDOM erneut. openModal-Hook (idempotent) ruft applyToDOM auf jeden neu geoeffneten Modal damit dynamische Inhalte uebersetzt sind. gsHandleLangChange nutzt Fast-Path loadFromDb zuerst, Fallback auf gsBuildI18n nur bei DB-Pull-Fehler. FR/IT/GSW-User sehen jetzt schon beim Erst-Visit ihre Sprache.
   v26.16 — Cache-Inkonsistenz-Fix: _headers HTML-Shell mit max-age=0,must-revalidate (Cloudflare-Default war cache → User sahen alten GS_VERSION nach Push). Plus /assets/* + /data/* mit max-age=31536000 immutable (versioned URLs). sw.js wird bei v-Bump automatisch revalidated. Reduziert Cache-Drift zwischen Browser-Cache und Live-Deploy.
   v26.15 — User-friendly Release-Notes Vollausbau (v26.2-Sprint)
   v26.14 — i18n Pass-3 Tooling (v26.8-Sprint). Inventory-Script extrahiert 235 unique Translation-Keys aus index.html (218 data-i18n + 18 gsI18n.t + GS_I18N_JS_STRINGS-Map). Bulk-Translate-Skript scripts/i18n_translate.sh ruft i18n-translate Edge-Fn chunk-weise (10 keys, 8s sleep) gegen Anthropic Rate-Limit. gsI18n.coverage() DevTools-Helper + window.gsI18nCoverage() Shortcut fuer Cowork-Verify nach Bulk-Translate. Tatsaechliches FR/IT-Backfill ist Cowork-Pflicht (braucht SERVICE_ROLE_KEY + DB-Diff SELECT-Query).
   v26.13 — Trial-End-Reminder (v26.7-Sprint). Backend daily-push-checker v3 mit notifyTrialEndingSoon (Subs mit trial_end in 24-25h, dedup via push_send_log unique-index Migration 20260521_push_dedup.sql). Frontend gsCheckTrialEnding pruft alle 4.5s nach Boot wenn eingeloggt — bei <36h Trial-Rest zeigt es einen orange In-App-Banner ueber der Bottom-Nav mit "Verlaengern"-CTA zu gsShowAboScreen. sessionStorage-Guard pro Trial-End-Datum verhindert Mehrfach-Show. URL-Handler ?open=abo oeffnet Abo-Modal nach Push-Click.
   v26.12 — Marketplace-Connect Frontend (v26.6-Sprint, GS_VERSION-Bump erfolgt zu v26.12 weil Cowork v26.1-v26.11 lokal vorgebaut hat). Settings-Row "Verkaeufer-Konto verbinden" + 5 Functions (gsMarketplaceLoadStatus, gsMarketplaceRefreshSettingsRow, gsMarketplaceOpenSellerScreen mit 4 Statusansichten Pending/Active/Restricted/Disabled, gsMarketplaceStartConnect ruft stripe-create-connect-account Edge-Fn, gsMarketplaceOpenStripeDashboard) + URL-Handler ?marketplace_done=1/?marketplace_refresh=1. Backend-Files in supabase/migrations/20260520_marketplace_sellers.sql + supabase/functions/stripe-create-connect-account/index.ts. Cowork deploys via Supabase MCP. Bundled mit dem ungepushten lokalen v26.11 Performance-Pass (preconnect/dns-prefetch/_gsAutoLazyImg) und v26.1-v26.5 (Karten-Reparatur, A11y Auto-Labeler, Maxlength, Z-Index, Console-Cleanup).
   v26.11 — Performance-Pass: preconnect zu Supabase/Fonts, dns-prefetch Anthropic+Stripe, prefetch three.min.js, leaflet.js mit defer (kein Boot-Block — gsLoadLeaflet pollt eh). _gsAutoLazyImg patcht alle <img> ausser Top-4 LCP-Kandidaten auf loading=lazy + decoding=async + fetchpriority=low. Erwarteter LCP-Boost +20-40%.
   v26.5 — Console-Cleanup _gsConsoleCleanup: silent no-op fuer console.log/debug/info in Production (Host !localhost UND nicht ?gs_debug=1 UND nicht localStorage.gs_debug=1). console.warn/error/trace bleiben aktiv. window.gsConsoleRestore() schaltet ad-hoc ein. Reduziert Noise + PII-Leakage + DevTools-Render-Cost. 80 Boot-Logs (72 log + 4 debug + 4 info) werden silent ohne dass einzelne Calls geaendert werden mussten.
   v26.4 — Auto-Maxlength + Z-Index-Tokens. _gsAutoMaxlength scannt alle <input>/<textarea> ohne maxlength und setzt sinnvolle Limits via Placeholder/Name-Heuristik (name=80, search=100, email=254, code=16, textarea_default=500, feedback/share=2000). MutationObserver wie bei v26.3. Plus :root CSS-Tokens --z-base/sticky/dropdown/overlay/modal/toast/tooltip/whatsnew/critical fuer kuenftige Layer.
   v26.3 — A11y Auto-Labeler: 78 Icon-only Buttons (×, 🗑️, ★, ➤, ❤, 💬, ↑, ＋, 📷 etc.) bekommen automatisch aria-label via Boot-Scan + MutationObserver fuer dynamisch gerenderte Modals. Screen-Reader-friendly (NVDA/VoiceOver/TalkBack) ohne 78 manuelle HTML-Edits. EMOJI_LABELS-Map mit ~40 Symbol→Text-Mappings. Defensive: skipt Buttons mit aria-labelledby oder echtem Text-Content.
   v26.1 — Karten-Reparatur + User-friendly Release-Notes. Karte: Tile-Error-Auto-Fallback (Swisstopo→OSM nach 5 Fehlern in 10s), localStorage-Persistenz der Layer-Wahl, CSP um wmts.geo.admin.ch + opentopomap + arcgisonline + fastly.net erweitert. GS_RELEASES bekommt user_summary + user_items fuer Nutzer-Whats-New (technische items bleiben fuer Devs). Pro-only Restructure aus v25.38 bleibt aktiv.
   v25.38 — Pro-only Restructure (Backend hat Plus-Plans deaktiviert + Plus-Lifetime in Pro Lifetime umbenannt). Frontend: gsShowFirstTrialModal mit 3 Buttons (Pro Lifetime / Pro Monthly 7d-Trial / Free), gsShowAboScreen vereinfacht (freeCard + proCard + lifeCard statt 4 Karten), GS_PRICE_CATALOG auf 3 Pro-Eintraege gekuerzt, planName in gsRenderSubInfo immer "Pro", Empty-State CTA "Pro 7 Tage gratis testen", gsStartCheckout-Default = pro_monthly. Legacy plus/premium-Subs bleiben als isPaid backwards-compat.
   Strategien:
     • App-Shell (HTML/CSS/JS): Network-First mit Cache-Fallback → offline.html
     • Statische Assets (icons/fonts/manifest): Cache-First
     • API/Supabase: Network-Only (Offline-Engine queued)
     • Bilder/Fotos: Stale-While-Revalidate
     • Periodic-Sync: 12h-Update-Pull
     • Background-Sync: Tag „gs-sync-pending" (Queue-Flush)
   ──────────────────────────────────────────────────────────── */
'use strict';

const VERSION = 'gs-v26.28';
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const IMAGE_CACHE = `${VERSION}-images`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

// App-Shell: kritische Dateien — werden bei install vorgecached
const SHELL_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png',
  '/icons/favicon-16.png',
  '/icons/shortcut-scanner.png',
  '/icons/shortcut-garden.png',
  '/icons/shortcut-quiz.png',
  '/icons/shortcut-knowledge.png',
  // v25.10 Thema 3: PLANT_DB extern (4341 Arten, immutable-cached). Vor-Cachen
  // damit App offline mit voller Pflanzen-DB funktioniert (sonst nur leere DB).
  '/data/plants.v1.js?v=1',
  // v25.36 SELF-HOST: vorher unpkg.com fuer Leaflet+Three (siehe v25.9 Comment
  // im git log) — Cowork hat live verifiziert dass unpkg vom Browser onerror
  // returns. Jetzt aus eigenem /assets/-Ordner: kein CDN-Race, kein CSP-Issue,
  // garantiert im Shell-Cache nach Install. Repo waechst ~770 KB.
  '/assets/leaflet.js',
  '/assets/leaflet.css',
  '/assets/three.min.js',
  '/assets/leaflet-images/marker-icon.png',
  '/assets/leaflet-images/marker-icon-2x.png',
  '/assets/leaflet-images/marker-shadow.png',
  // pdf.js bleibt CDN (1.5MB zu gross fuer das Repo, wird nur fuer PDF-Export
  // genutzt — nicht kritisch fuer Karte/3D-Render).
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs'
];

// Domains, die NIE gecached werden (immer Network)
const NEVER_CACHE_HOSTS = [
  'supabase.co',
  'supabase.in',
  'api.anthropic.com',
  'api.stripe.com',
  'js.stripe.com',
  'm.stripe.network',
  'open-meteo.com',
  'api.open-meteo.com',
  'ipapi.co',
  'tile.openstreetmap.org',
  'plausible.io',
  'analytics.google.com'
];

// Bild-Hosts: Stale-While-Revalidate
// v25.36 SELF-HOST: unpkg.com entfernt — Leaflet+Three sind jetzt /assets/-lokal.
const IMAGE_HOSTS = [
  'fonts.gstatic.com',
  'fonts.googleapis.com',
  'cdnjs.cloudflare.com'  // bleibt fuer pdf.js
];

// ─── INSTALL ─────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Install', VERSION);
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => {
        // addAll fails atomically — wenn auch nur eine URL nicht cached → komplett fail
        // → wir nutzen stattdessen einzelne add() mit catch, damit fehlende Dateien
        // den Install nicht blockieren (Robustheit > Vollständigkeit)
        return Promise.all(
          SHELL_URLS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn('[SW] Shell-Cache fehlgeschlagen für:', url, err.message);
            })
          )
        );
      })
      .then(() => self.skipWaiting()) // Aktiviere SW sofort, ohne reload zu warten
      .catch((err) => console.warn('[SW] Install error:', err))
  );
});

// ─── ACTIVATE ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate', VERSION);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => {
          console.log('[SW] Lösche alten Cache:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim()) // Nimm sofort Kontrolle aller Tabs
  );
});

// ─── HELPERS ─────────────────────────────────────────────────
function isNeverCache(url) {
  try {
    const u = new URL(url);
    return NEVER_CACHE_HOSTS.some((h) => u.hostname.endsWith(h));
  } catch (e) { return false; }
}
function isImageHost(url) {
  try {
    const u = new URL(url);
    return IMAGE_HOSTS.some((h) => u.hostname.endsWith(h));
  } catch (e) { return false; }
}
function isImageRequest(req) {
  return req.destination === 'image' || /\.(png|jpg|jpeg|gif|webp|avif|svg|ico)(\?|$)/i.test(req.url);
}
function isFontRequest(req) {
  return req.destination === 'font' || /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(req.url);
}
function isHTMLNav(req) {
  return req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'));
}

// Fetch-Strategien
async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.status === 200 && fresh.type !== 'opaqueredirect') {
      cache.put(req, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    // Final fallback für HTML-Navigation: index.html → offline.html
    if (isHTMLNav(req)) {
      const shell = await caches.open(SHELL_CACHE);
      const fallback = await shell.match('/index.html') || await shell.match('/');
      if (fallback) return fallback;
      // Last-Resort: dedicated offline.html mit nice UI
      const offlinePage = await shell.match('/offline.html');
      if (offlinePage) return offlinePage;
    }
    throw err;
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.status === 200 && fresh.type !== 'opaqueredirect') {
      cache.put(req, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then((res) => {
    if (res && res.status === 200 && res.type !== 'opaqueredirect') {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  }).catch(() => cached);
  return cached || fetchPromise;
}

// ─── FETCH ───────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Nur GET cachen (POST/PUT/DELETE direkt durchreichen)
  if (req.method !== 'GET') return;

  const url = req.url;

  // Skip: chrome-extension, data:, blob:
  if (!url.startsWith('http')) return;

  // 1. Never-cache hosts (Supabase, Anthropic, Stripe, Wetter, IP-Geo) → Network only
  if (isNeverCache(url)) return;

  // 2. App-Shell HTML-Navigation → Network-First (immer aktuell, bei offline aus Cache)
  if (isHTMLNav(req)) {
    event.respondWith(networkFirst(req, SHELL_CACHE));
    return;
  }

  // 3. Manifest + statische Skripte → Network-First (Updates wichtig)
  if (/\/(manifest\.json|sw\.js)$/.test(url)) {
    event.respondWith(networkFirst(req, STATIC_CACHE));
    return;
  }

  // 4. Bilder → Stale-While-Revalidate (schnell + Updates im Hintergrund)
  if (isImageRequest(req)) {
    event.respondWith(staleWhileRevalidate(req, IMAGE_CACHE));
    return;
  }

  // 5. Fonts → Cache-First (Fonts ändern sich selten)
  if (isFontRequest(req) || isImageHost(url)) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // 6. Default → Network-First mit Runtime-Cache
  event.respondWith(networkFirst(req, RUNTIME_CACHE));
});

// ─── MESSAGE-HANDLER ─────────────────────────────────────────
// Erlaubt der App, den SW zu steuern (skipWaiting, clearCaches)
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (data.type === 'CLEAR_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => {
          if (event.source) event.source.postMessage({ type: 'CACHES_CLEARED' });
        })
    );
  } else if (data.type === 'GET_VERSION') {
    if (event.source) event.source.postMessage({ type: 'VERSION', version: VERSION });
  }
});

// ─── PUSH-NOTIFICATIONS ──────────────────────────────────────
// Vorbereitung für künftige Web-Push-Reminder (Pflanzen-Pflege)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch (e) { payload = { title: 'GreenScan', body: event.data.text() }; }
  const title = payload.title || '🌱 GreenScan';
  const options = {
    body: payload.body || 'Du hast eine neue Benachrichtigung.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || 'greenscan',
    data: payload.data || {},
    actions: payload.actions || [],
    vibrate: [100, 50, 100],
    silent: false
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── NOTIFICATION-CLICK ──────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// ─── BACKGROUND-SYNC ─────────────────────────────────────────
// Tag 'gs-sync-pending' → flush Offline-Queue (Garten/Diary/Scans).
// Tag 'gs-sync-now' → force-flush (manuell triggered).
self.addEventListener('sync', (event) => {
  if (event.tag === 'gs-sync-pending' || event.tag === 'gs-sync-now') {
    console.log('[SW] sync event:', event.tag);
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        if (clients.length === 0) return;
        clients.forEach((c) => c.postMessage({ type: 'SYNC_PENDING', tag: event.tag }));
      })
    );
  }
});

// ─── PERIODIC-SYNC ───────────────────────────────────────────
// Tag 'gs-periodic-sync' → 12h-Pull (App-Shell-Refresh + Pflanzen-Reminder-Check).
// Nur Chrome Android wenn User Permission „granted" gibt (selten, aber wertvoll).
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'gs-periodic-sync') {
    console.log('[SW] periodic-sync event:', event.tag);
    event.waitUntil(
      Promise.all([
        // App-Shell refreshen (für Updates)
        caches.open(SHELL_CACHE).then((cache) =>
          fetch('/index.html').then((res) => {
            if (res.ok) return cache.put('/index.html', res);
          }).catch(() => {})
        ),
        // Frontend-Tabs benachrichtigen (Reminder/Sync)
        self.clients.matchAll({ type: 'window' }).then((clients) => {
          clients.forEach((c) => c.postMessage({ type: 'PERIODIC_SYNC' }));
        })
      ])
    );
  }
});

console.log('[SW] Loaded', VERSION);
