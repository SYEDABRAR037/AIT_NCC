// ============================================================
// NCC Digital Command System - Progressive Web App Service Worker
// Offline Caching & Background Sync for Field Operations
// ============================================================

const CACHE_NAME = 'ncc-command-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/logos/ncc_logo.png',
  '/assets/logos/ait_logo.gif',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
];

// Install: Precache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[NCC PWA ServiceWorker] Precaching App Shell');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[NCC PWA ServiceWorker] Removing Old Cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network First with Cache Fallback for API / Pages
self.addEventListener('fetch', (event) => {
  // Ignore non-GET or chrome-extension requests
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // Static assets: Cache First
  if (event.request.url.match(/\.(png|jpg|jpeg|gif|svg|ico|woff2|css)$/)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // HTML & API: Network First with Cache Fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/');
          }
          return new Response(
            JSON.stringify({ offline: true, message: 'Offline Mode: Field Connection Unavailable' }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        });
      })
  );
});
