// Service Worker for RutaEscolar PWA
// Strategy:
//  - Navigation / HTML: NETWORK-FIRST (always fetch fresh index.html, fallback to cache offline)
//  - Hashed assets (immutable, e.g. /assets/index-abc123.js): CACHE-FIRST
//  - API requests: network only
const CACHE_NAME = 'rutaescolar-v3';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Don't fail install if a core asset 404s (e.g. subpath deployments)
      return Promise.allSettled(
        CORE_ASSETS.map((url) => cache.add(url))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

function isNavigationRequest(request) {
  return request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('accept') && request.headers.get('accept').includes('text/html'));
}

function isHashedAsset(url) {
  // e.g. /assets/index-abc123.js or ./assets/index-abc123.css
  return /\/assets\/.+[.-][a-f0-9]{8,}\.(js|css|png|svg|webp|woff2?)$/i.test(url.pathname) ||
    /[.-][a-f0-9]{8,}\.(js|css)$/i.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API: network only (never cache)
  if (url.pathname.includes('/api/')) {
    return;
  }

  // 1. Navigation / HTML: network-first, fallback to cached index.html
  if (isNavigationRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Only cache successful HTML responses (not error pages / SPA fallback HTML for missing assets)
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match('/index.html').then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // 2. Hashed assets: cache-first (immutable content, avoids re-fetching)
  if (isHashedAsset(url)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 3. Everything else (manifest, icons, non-hashed): network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
