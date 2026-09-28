// Static asset caching only. Pages and every API/auth request remain network-only.
const CACHE_NAME = 'ncc-static-v2';
const PRECACHE_ASSETS = [
  '/manifest.json',
  '/assets/logos/ncc_logo.png',
  '/assets/logos/ait_logo.gif',
  '/assets/hero_cadets.jpg',
  '/assets/strength_dusk.jpg',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/icon-512-maskable.png',
];

// Install: Precache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Remove caches from the previous worker, which also cached API and HTML responses.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName === 'ncc-command-v1' || (cacheName.startsWith('ncc-static-') && cacheName !== CACHE_NAME)) {
            return caches.delete(cacheName);
          }
          return undefined;
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercept only same-origin static assets under the public asset/model directories.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  const safeStaticPath = requestUrl.pathname.startsWith('/assets/') || requestUrl.pathname.startsWith('/models/');
  const staticFile = /\.(?:avif|bin|css|gif|ico|jpe?g|js|json|png|svg|webp|woff2)$/i.test(requestUrl.pathname);
  if (!safeStaticPath || !staticFile) return;

  event.respondWith(
    fetch(event.request).then(async (networkResponse) => {
      if (networkResponse.ok && networkResponse.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, networkResponse.clone());
      }
      return networkResponse;
    }).catch(async () => {
      const cachedResponse = await caches.match(event.request);
      return cachedResponse || Response.error();
    })
  );
});
