/* ────────────────────────────────────────────────────────────
   GreenScan Service Worker
   v24.50 — Pre-Release-Pass-11: Z-Index-Token-Migration (12 Sites) + neuer --z-image-overlay + maxlength auf 14 Auth/Profile-Inputs
   Strategien:
     • App-Shell (HTML/CSS/JS): Network-First mit Cache-Fallback → offline.html
     • Statische Assets (icons/fonts/manifest): Cache-First
     • API/Supabase: Network-Only (Offline-Engine queued)
     • Bilder/Fotos: Stale-While-Revalidate
     • Periodic-Sync: 12h-Update-Pull
     • Background-Sync: Tag „gs-sync-pending" (Queue-Flush)
   ──────────────────────────────────────────────────────────── */
'use strict';

const VERSION = 'gs-v24.50';
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
  '/icons/shortcut-knowledge.png'
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
const IMAGE_HOSTS = [
  'fonts.gstatic.com',
  'fonts.googleapis.com',
  'unpkg.com',
  'cdnjs.cloudflare.com'
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
