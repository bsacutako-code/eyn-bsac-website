/* BSAC Service Worker - Cache versioned for reliable updates on Vercel */
const CACHE_VERSION = 'bsac-v1.0.0';
const CACHE_NAME = `bsac-cache-${CACHE_VERSION}`;

/* Core app shell assets - keep minimal to avoid stale content */
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/app.png',
  '/logo.png'
];

/* Install: cache app shell */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

/* Activate: clean old caches and claim clients so updates reach installed apps */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('bsac-cache-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* Fetch strategy:
   - Network-first for HTML/navigation (so Vercel updates appear)
   - Cache-first for static same-origin assets
   - Never cache Google Forms / external POST or third-party
   - Bypass for non-GET
*/
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  /* Never intercept non-GET (form submissions, etc.) */
  if (req.method !== 'GET') {
    return;
  }

  /* Never cache Google Forms or external APIs */
  if (
    url.hostname.includes('docs.google.com') ||
    url.hostname.includes('google.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('youtube.com') ||
    url.hostname.includes('youtu.be') ||
    url.hostname.includes('facebook.com') ||
    url.hostname.includes('instagram.com') ||
    url.hostname.includes('wa.me') ||
    url.hostname.includes('t.me') ||
    url.hostname.includes('cdn.') ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    return;
  }

  /* Navigation / HTML: network-first so new deployments win */
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          return response;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('/index.html'))
        )
    );
    return;
  }

  /* Same-origin static assets: cache-first with network fallback */
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
            }
            return response;
          })
          .catch(() => cached);
      })
    );
  }
});

/* Allow page to force skipWaiting when a new SW is waiting */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});