// GreenScan Service Worker v23.58
// Cache-First Strategy für "1000% smoother" App-Erlebnis
// Offline-First mit Stale-While-Revalidate für Daten

const CACHE_VERSION = 'greenscan-v23.58';
const CACHE_STATIC   = CACHE_VERSION + '-static';
const CACHE_DYNAMIC  = CACHE_VERSION + '-dynamic';
const CACHE_IMG      = CACHE_VERSION + '-images';

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
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=DM+Sans:wght@300;400;500;600;700&display=swap'
];

// Hosts die niemals gecached werden (API-Requests)
const NO_CACHE_HOSTS = [
  'openrouter.ai',
  'api.open-meteo.com',
  'geocoding-api.open-meteo.com',
  'supabase.co',
  'api.stripe.com'
];

// ── INSTALL: Core-Assets cachen ────────────────────────────────
self.addEventListener('install', function(event){
  console.log('[SW v23.58] Installing…');
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(function(cache){
        console.log('[SW v23.58] Precaching ' + STATIC_ASSETS.length + ' assets');
        // Add one-by-one: failures are logged but don't abort install
        return Promise.all(STATIC_ASSETS.map(function(url){
          return cache.add(url).catch(function(err){
            console.warn('[SW v23.58] Failed to cache: ' + url, err.message);
          });
        }));
      })
      .then(function(){ return self.skipWaiting(); })
  );
});

// ── ACTIVATE: Alte Caches löschen ──────────────────────────────
self.addEventListener('activate', function(event){
  console.log('[SW v23.58] Activating…');
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if (k.indexOf(CACHE_VERSION) !== 0) {
          console.log('[SW v23.58] Deleting old cache: ' + k);
          return caches.delete(k);
        }
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

// ── FETCH: Intelligente Strategie je nach Request-Typ ──────────
self.addEventListener('fetch', function(event){
  const req = event.request;
  const url = new URL(req.url);

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
          // Aktualisiere Cache im Hintergrund
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

  // 4. Bilder: Cache-First mit langer TTL
  if (req.destination === 'image' || /\.(png|jpg|jpeg|webp|svg|ico|gif)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(function(cached){
        if (cached) return cached;
        return fetch(req).then(function(res){
          if (res.ok) {
            const resClone = res.clone();
            caches.open(CACHE_IMG).then(function(cache){ cache.put(req, resClone); });
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

// ── MESSAGE: Cache manuell löschen (für Update-Button) ─────────
self.addEventListener('message', function(event){
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(function(keys){
      Promise.all(keys.map(function(k){ return caches.delete(k); }))
        .then(function(){
          if (event.source) event.source.postMessage({ type: 'CACHE_CLEARED' });
        });
    });
  }
});

console.log('[SW v23.58] GreenScan Service Worker loaded — ready for 1000% smoother experience 🚀');
