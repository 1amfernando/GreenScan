/* ────────────────────────────────────────────────────────────
   GreenScan Service Worker
   Changelog v25.38–v30.79: docs/_archiv/SW-CHANGELOG.md
   v32.72 (Audit C3): hier standen 342 Changelog-Zeilen, 413 KB Kommentar — ein drittes Changelog
   neben GS_RELEASES und data/releases.v1.js, das jedes Geraet bei jedem Update mitlud. Das
   Register des Service Workers ist kein Ort fuer Geschichte; die App-Historie steht in
   GS_RELEASES (index.html) und data/releases.v1.js.
   Strategien:
     • App-Shell (HTML/CSS/JS): Network-First mit Cache-Fallback → offline.html
     • Statische Assets (icons/fonts/manifest): Cache-First
     • API/Supabase: Network-Only (Offline-Engine queued)
     • Bilder/Fotos: Stale-While-Revalidate
     • Periodic-Sync: 12h-Update-Pull
     • Background-Sync: Tag „gs-sync-pending" (Queue-Flush)
   ──────────────────────────────────────────────────────────── */
'use strict';

const VERSION = 'gs-v33.12';
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
  // v31.36: Das Release-Archiv (536 aeltere Changelog-Eintraege, gut 1 MB —
  // Stand v33.01, bei der Auslagerung waren es 371 und 778 KB) wird hier
  // BEWUSST NICHT vor-gecacht. Vor-cachen hiesse: jeder Nutzer laedt das alles
  // fuer einen Bildschirm, den die meisten nie oeffnen — damit waere
  // der halbe Gewinn der Auslagerung wieder weg. Es faellt unter die
  // Default-Strategie (networkFirst + RUNTIME_CACHE) und ist damit ab dem
  // ersten Oeffnen des Changelogs auch offline da. Wer offline ist und ihn
  // noch nie geoeffnet hat, sieht die 12 inline vorhandenen Eintraege und
  // einen Hinweis (siehe gsRenderAboutChangelog).
  // v25.36 SELF-HOST: vorher unpkg.com fuer Leaflet+Three (siehe v25.9 Comment
  // im git log) — Cowork hat live verifiziert dass unpkg vom Browser onerror
  // returns. Jetzt aus eigenem /assets/-Ordner: kein CDN-Race, kein CSP-Issue,
  // garantiert im Shell-Cache nach Install. Repo waechst ~770 KB.
  '/assets/leaflet.js',
  '/assets/leaflet.css',
  '/assets/three.min.js',
  '/assets/leaflet-images/marker-icon.png',
  '/assets/leaflet-images/marker-icon-2x.png',
  '/assets/leaflet-images/marker-shadow.png'
  // v32.79: pdf.js NICHT mehr vorgeladen — 1,5 MB bei jedem Install für ein
  // Admin-Werkzeug (Book-Ingest). Die App holt es beim ersten PDF
  // (_gsPdfjsLaden); IMAGE_HOSTS kennt cdnjs, der Runtime-Cache behält es.
];

// v32.13: Dieselbe Liste noch einmal als PFADE — daran erkennt der
// fetch-Handler, dass eine Anfrage eine vorgeladene Datei meint.
//
// Warum das noetig wurde: bis v32.12 fiel `/data/plants.v1.js?v=1` unter die
// Default-Regel (networkFirst + RUNTIME_CACHE). Vorgeladen wurde sie in den
// SHELL_CACHE — und dort hat sie NIEMAND je gesucht. Gemessen mit
// `scripts/offline_check.js`: nach dem ersten Besuch ohne Netz standen
// **0 von 4'342 Arten** zur Verfuegung. Die App startete, die Artenliste war
// leer, und keine Fehlermeldung sagte warum.
//
// Der Grund, dass es niemandem auffiel: beim ERSTEN Besuch installiert sich
// der Service Worker waehrend die Seite laedt — ihre eigenen Unterdateien
// holt der Browser also noch OHNE ihn. Der Runtime-Cache bleibt dabei leer.
// Wer die App installiert und dann in den Wald faehrt, hatte genau den Fall.
//
// `/` und `/index.html` stehen bewusst NICHT hier: Navigationen sollen
// weiterhin zuerst das Netz fragen (Regel 2), sonst sieht niemand je ein
// Update. Dasselbe fuer `manifest.json` (Regel 3).
const SHELL_SOFORT = new Set(
  SHELL_URLS
    .filter((u) => u.startsWith('/') && u !== '/' && u !== '/index.html' && u !== '/manifest.json')
);

// Liegt die Anfrage als vorgeladene Datei im Shell-Cache? Vergleicht Pfad UND
// Abfrage — `plants.v1.js?v=1` ist eine andere Datei als `plants.v1.js`.
function istShellDatei(req) {
  try {
    const u = new URL(req.url);
    if (u.origin !== self.location.origin) return false;
    return SHELL_SOFORT.has(u.pathname + u.search) || SHELL_SOFORT.has(u.pathname);
  } catch (e) { return false; }
}

// ══ v32.15 · EIN DECKEL FUER DEN BILD-CACHE ══════════════════════════════
//
// Regel 4 legt JEDES Bild in den IMAGE_CACHE — und dazu gehoeren die
// Kartenkacheln (swisstopo `wmts.geo.admin.ch` steht auf keiner Ausnahmeliste,
// OpenStreetMap schon). Eine Wanderung auf Zoomstufe 16 zieht schnell
// Tausende davon.
//
// Eine Obergrenze gab es nicht. Geleert wurde der Cache nur durch einen
// Versionswechsel — `activate` loescht jeden Cache, dessen Name nicht zur
// laufenden Version gehoert. Das ist Zufall, kein Entwurf: bei einer ruhigen
// Woche waechst er ungebremst weiter.
//
// Warum das mehr ist als Speicherplatz: geht der Platz auf dem Geraet aus,
// raeumt der Browser auf — und mancher raeumt den GANZEN Ursprung ab, also
// auch `localStorage`. Dort liegt der Garten-Zwilling, das Ernte-Log, die
// Einstellungen. Der groesste unbegrenzte Verbraucher gefaehrdet damit den
// wertvollsten Speicher.
//
// EHRLICH DAZU: wie gross er in der Praxis wirklich wird, ist von hier aus
// nicht messbar — die Kachel-Server sind aus dieser Umgebung nicht
// erreichbar. Geprueft ist der MECHANISMUS (siehe offline_check), nicht die
// Zahl. Der Deckel ist deshalb bewusst grosszuegig gewaehlt.
// Der Deckel ist ein ZIEL, keine harte Schranke — und das ist Absicht. Bei
// jedem einzelnen Bild `keys()` aufzurufen kostet mehr, als es bringt.
// Geprueft wird alle `IMAGE_CACHE_INTERVALL` Bilder; dazwischen darf der
// Cache darueber hinauswachsen. Die tatsaechliche Obergrenze ist also
// `MAX + INTERVALL` plus das, was gerade gleichzeitig unterwegs ist.
const IMAGE_CACHE_MAX = 500;        // ~35 KB je Kachel → grob 17 MB
const IMAGE_CACHE_INTERVALL = 50;   // so oft wird nachgesehen
let _bildZaehler = 0;               // nicht bei jedem Bild `keys()` aufrufen

async function deckelCache(cacheName, max) {
  try {
    const c = await caches.open(cacheName);
    const keys = await c.keys();
    if (keys.length <= max) return 0;
    // `keys()` liefert die EINFUEGEreihenfolge — vorne steht das Aelteste.
    const weg = keys.slice(0, keys.length - max);
    await Promise.all(weg.map((k) => c.delete(k)));
    console.log('[SW] Bild-Cache gedeckelt: ' + weg.length + ' entfernt, ' + max + ' behalten');
    return weg.length;
  } catch (e) { return 0; }
}
self.deckelCache = deckelCache;

// Der letzte Ausweg fuer JEDE Strategie: was vorgeladen wurde, muss auch
// gefunden werden — egal, in welchem Cache die Strategie zuerst gesucht hat.
// Browser verdraengen Caches EINZELN; der Shell-Cache ist der, der ueberleben
// soll. Ohne diesen Nachschlag ist das Vorladen reine Zierde.
async function ausShell(req) {
  try {
    const shell = await caches.open(SHELL_CACHE);
    return (await shell.match(req)) || (await shell.match(req, { ignoreSearch: true })) || null;
  } catch (e) { return null; }
}

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
      // v32.67 (Audit B3): KEIN skipWaiting mehr beim Install. Der neue Worker
      // wartet, bis die App per SKIP_WAITING zustimmt (Update-Banner, Knopf
      // „Neu laden" → message-Handler unten). Vorher aktivierte er sich selbst,
      // löschte im activate die alten Caches unter der LAUFENDEN Seite (jede
      // spätere Nachladung ging ins Netz und scheiterte offline), und der
      // Banner fragte nach etwas, das schon passiert war. Beim ersten Install
      // gibt es keinen Vorgänger, also nichts zu warten — offline_check bleibt
      // unberührt.
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
    // v32.13: bevor irgendetwas scheitert — steht die Datei im Shell-Cache?
    // Sie wurde beim Install vorgeladen; ohne diesen Nachschlag war das
    // Vorladen fuer alles ausser Navigationen wirkungslos (siehe die
    // Anmerkung bei SHELL_SOFORT).
    const vorgeladen = await ausShell(req);
    if (vorgeladen) return vorgeladen;
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
    const vorgeladen = await ausShell(req);
    if (vorgeladen) return vorgeladen;
    throw err;
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then((res) => {
    if (res && res.status === 200 && res.type !== 'opaqueredirect') {
      cache.put(req, res.clone()).catch(() => {});
      // v32.15: alle 50 Bilder nachsehen, ob der Deckel greift. NICHT
      // abgewartet — eine Aufraeumaktion darf keine Antwort verzoegern.
      if (cacheName === IMAGE_CACHE && (++_bildZaehler % IMAGE_CACHE_INTERVALL) === 0) {
        deckelCache(IMAGE_CACHE, IMAGE_CACHE_MAX);
      }
    }
    return res;
  // v32.13: `cached` ist hier oft `undefined` — beim ERSTEN Besuch war der
  // Service Worker beim Laden der Bilder noch nicht zustaendig. Dann gab
  // diese Kette `undefined` an `respondWith` weiter, und das ist ein
  // Netzwerkfehler: die Symbole fehlten offline, obwohl sie vorgeladen sind.
  }).catch(() => cached || ausShell(req));
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

  // v32.13 · 3b. Vorgeladene Dateien → Cache-First aus dem SHELL_CACHE.
  //
  // Das sind die grossen, unveraenderlichen Brocken: die Artenliste (2,1 MB),
  // Leaflet, Three.js, die Symbole. Drei Dinge auf einmal:
  //   · offline da, auch beim allerersten Start ohne Netz,
  //   · sofort da (kein Netz-Versuch, der erst ablaufen muss),
  //   · genau EINMAL auf dem Geraet statt in zwei Caches.
  // Aktuell gehalten werden sie ueber den Cache-NAMEN: er traegt die Version,
  // und `activate` loescht jeden Cache, der nicht zur laufenden gehoert.
  if (istShellDatei(req)) {
    event.respondWith(cacheFirst(req, SHELL_CACHE));
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
  // v26.93: url kann top-level ODER in data.url kommen → beide in data.url normalisieren,
  // damit notificationclick-Deep-Link (?screen=favs) zuverlässig greift.
  const data = Object.assign({}, payload.data || {});
  if (!data.url && payload.url) data.url = payload.url;
  const options = {
    body: payload.body || 'Du hast eine neue Benachrichtigung.',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    tag: payload.tag || 'greenscan',
    data: data,
    actions: payload.actions || [],
    vibrate: [100, 50, 100],
    silent: false
  };
  // v30.80: Offene Tabs sofort informieren → In-App-Badge/Inbox aktualisieren
  // sich live, ohne dass der User den OS-Push anklicken muss.
  const notifyClients = self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((clients) => {
      clients.forEach((c) => c.postMessage({
        type: 'GS_PUSH_RECEIVED',
        category: payload.tag || (data.category || ''),
        title: title
      }));
    }).catch(() => {});
  event.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    notifyClients
  ]));
});

// ─── NOTIFICATION-CLICK ──────────────────────────────────────
// v32.66 (Audit A4): die URL kommt aus der Push-Nutzlast. Wer pushen kann,
// darf den vertrauten App-Tab nicht auf eine fremde Seite lenken — nur der
// eigene Ursprung, alles andere (javascript:, https://fremd, //fremd) wird '/'.
function swSafeUrl(u) {
  try {
    const x = new URL(String(u == null ? '/' : u), self.location.origin);
    return x.origin === self.location.origin ? (x.pathname + x.search + x.hash) : '/';
  } catch (_) { return '/'; }
}
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = swSafeUrl(event.notification.data && event.notification.data.url);
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
