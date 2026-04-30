// GreenScan Service Worker v24.17
// Strategie:
//   - Static-Assets:    Cache-First mit langer TTL
//   - HTML-Navigation:  Network-First, Fallback offline.html
//   - Bilder/Tiles:     Cache-First mit Größen-Limit
//   - Fonts (Google):   Cache-First, dauerhaft
//   - APIs:             Pass-through (NIE cachen)
//   - Default:          Stale-While-Revalidate
//
// Neu in v23.86:
//   - Share-Target POST → Foto wird in Cache gelegt und
//     index.html mit ?screen=scanner&shared=1 geöffnet
//   - Push-Empfang (Stub) für Garten-Erinnerungen
//   - Image-Cache-Quota (max ~80 Einträge) verhindert Storage-Explosion

const CACHE_VERSION = 'greenscan-v24.17';
const CACHE_STATIC   = CACHE_VERSION + '-static';
const CACHE_DYNAMIC  = CACHE_VERSION + '-dynamic';
const CACHE_IMG      = CACHE_VERSION + '-images';
const CACHE_SHARED   = CACHE_VERSION + '-shared';
const IMG_CACHE_MAX  = 80;

// Core-Assets die SOFORT vorgeladen werden (Offline-fähig ab Erststart)
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './offline.html',
  './favicon.ico',
  './favicon-16.png',
  './favicon-32.png',
  './apple-touch-icon.png',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  // v24.03: PLANT_DB extrahiert — kritisch für Offline-Funktion
  './data/plants.v1.js',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=DM+Sans:wght@300;400;500;600;700&display=swap'
];

// Hosts die niemals gecached werden (API-Requests, Stripe, Realtime)
const NO_CACHE_HOSTS = [
  'openrouter.ai',
  'integrate.api.nvidia.com',
  'api.anthropic.com',
  'api.open-meteo.com',
  'geocoding-api.open-meteo.com',
  'nominatim.openstreetmap.org',
  'supabase.co',
  'api.stripe.com'
];

// Limit den Image-Cache auf N Einträge (LRU-artig: ältesten Eintrag löschen)
async function trimCache(cacheName, maxItems){
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      await cache.delete(keys[0]);
      return trimCache(cacheName, maxItems);
    }
  } catch(_){}
}

// ── INSTALL: Core-Assets cachen ────────────────────────────────
self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(function(cache){
        // Add one-by-one: failures are logged but don't abort install
        return Promise.all(STATIC_ASSETS.map(function(url){
          return cache.add(url).catch(function(){ /* swallow */ });
        }));
      })
      .then(function(){ return self.skipWaiting(); })
  );
});

// ── ACTIVATE: Alte Caches löschen ──────────────────────────────
self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if (k.indexOf(CACHE_VERSION) !== 0) {
          return caches.delete(k);
        }
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

// ── SHARE-TARGET: POST mit Foto → Cache + Redirect zum Scanner ──
async function handleShareTarget(event){
  try {
    const formData = await event.request.formData();
    const file = formData.get('image');
    if (file && file.size > 0) {
      const cache = await caches.open(CACHE_SHARED);
      const url = './shared-image-' + Date.now() + '-' + (file.name || 'photo');
      await cache.put(url, new Response(file, {
        headers: { 'Content-Type': file.type || 'image/jpeg' }
      }));
      // Speichere Cache-URL in einem Client-Message, sobald jemand connected
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(function(c){
        c.postMessage({ type: 'SHARED_IMAGE', cacheUrl: url, mime: file.type });
      });
    }
  } catch(_){}
  return Response.redirect('./index.html?screen=scanner&shared=1', 303);
}

// ── FETCH: Intelligente Strategie je nach Request-Typ ──────────
self.addEventListener('fetch', function(event){
  const req = event.request;
  const url = new URL(req.url);

  // 0. Share-Target (POST von "Foto teilen" auf Android)
  if (req.method === 'POST' && url.pathname.endsWith('/index.html') && url.searchParams.get('shared') === '1') {
    event.respondWith(handleShareTarget(event));
    return;
  }

  // 1. Nur GET-Requests cachen
  if (req.method !== 'GET') return;

  // 2. API-Hosts niemals cachen (direkter Pass-through)
  if (NO_CACHE_HOSTS.some(function(h){ return url.hostname.indexOf(h) !== -1; })) {
    return; // Default browser handling
  }

  // 3. HTML-Navigation: Network-First mit Offline-Fallback
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') !== -1) {
    event.respondWith(
      fetch(req)
        .then(function(res){
          if (res.ok) {
            const resClone = res.clone();
            caches.open(CACHE_STATIC).then(function(cache){ cache.put(req, resClone); });
          }
          return res;
        })
        .catch(function(){
          return caches.match(req).then(function(cached){
            return cached || caches.match('./offline.html');
          });
        })
    );
    return;
  }

  // 4. Bilder & Map-Tiles: Cache-First mit LRU-Trim
  if (req.destination === 'image' || /\.(png|jpg|jpeg|webp|svg|ico|gif)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(function(cached){
        if (cached) return cached;
        return fetch(req).then(function(res){
          if (res.ok) {
            const resClone = res.clone();
            caches.open(CACHE_IMG).then(function(cache){
              cache.put(req, resClone);
              trimCache(CACHE_IMG, IMG_CACHE_MAX);
            });
          }
          return res;
        }).catch(function(){ return new Response('', { status: 504 }); });
      })
    );
    return;
  }

  // 5. Fonts: Cache-First dauerhaft
  if (url.hostname.indexOf('fonts.googleapis.com') !== -1 || url.hostname.indexOf('fonts.gstatic.com') !== -1) {
    event.respondWith(
      caches.match(req).then(function(cached){
        if (cached) return cached;
        return fetch(req).then(function(res){
          if (res.ok) {
            const resClone = res.clone();
            caches.open(CACHE_STATIC).then(function(cache){ cache.put(req, resClone); });
          }
          return res;
        });
      })
    );
    return;
  }

  // 6. Default: Stale-While-Revalidate (sofort aus Cache, dann Update)
  event.respondWith(
    caches.match(req).then(function(cached){
      const networkFetch = fetch(req).then(function(res){
        if (res.ok) {
          const resClone = res.clone();
          caches.open(CACHE_DYNAMIC).then(function(cache){ cache.put(req, resClone); });
        }
        return res;
      }).catch(function(){ return cached; });
      return cached || networkFetch;
    })
  );
});

// ── PUSH: Garten-Erinnerungen (Stub, aktiv sobald Subscription da) ──
self.addEventListener('push', function(event){
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch(_) { payload = { title: 'GreenScan', body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'GreenScan', {
      body: payload.body || '',
      icon: payload.icon || './icons/icon-192.png',
      badge: './icons/icon-192.png',
      data: payload.data || {},
      tag: payload.tag || 'greenscan',
      renotify: !!payload.renotify
    })
  );
});

self.addEventListener('notificationclick', function(event){
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './index.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(function(clients){
      for (const c of clients) {
        if (c.url.indexOf(url) !== -1 && 'focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

// ── MESSAGE: Cache manuell löschen (für Update-Button) ─────────
self.addEventListener('message', function(event){
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(function(keys){
      Promise.all(keys.map(function(k){ return caches.delete(k); }))
        .then(function(){
          if (event.source) event.source.postMessage({ type: 'CACHE_CLEARED' });
        });
    });
  }
  if (event.data.type === 'GET_VERSION') {
    if (event.source) event.source.postMessage({ type: 'VERSION', version: CACHE_VERSION });
  }
});
