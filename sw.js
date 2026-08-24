const CACHE_NAME = 'bsac-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/logo.png',
  '/app.png',
  '/welcome.png',
  '/about.png',
  '/bg1.png',
  '/bg2.png',
  '/bg3.png',
  '/gallery1.png',
  '/gallery2.png',
  '/gallery3.png',
  '/gallery4.png',
  '/vid1.mp4',
  '/vid2.mp4',
  '/vid3.mp4'
];

// Install – precache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activate – clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch – network-first for navigation, cache-first for static, never cache Google Forms
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never interfere with Google Forms submissions
  if (url.hostname.includes('docs.google.com') || url.hostname.includes('google.com')) {
    return;
  }

  // Navigation requests – network first, fallback to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets – cache first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => cached);
    })
  );
});