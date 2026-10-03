/* ════════════════════════════════════════════════════════════
   Play Over Mood — service worker
   Strategy, deliberately: NETWORK-FIRST for the app shell (index.html,
   app.js) so a new deploy is NEVER stuck behind a stale cache — falls
   back to cache only when there's genuinely no connection. Static
   assets that rarely change (icons/manifest) are cache-first for speed.
   Firebase/Firestore requests are never intercepted — always live.
   Bump SW_CACHE when you want to force every installed copy to drop
   its old cache (rare — normal file updates don't need this).
   ════════════════════════════════════════════════════════════ */

const SW_CACHE = 'pom-shell-v2';

const PRECACHE_URLS = [
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/favicon-16.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SW_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== SW_CACHE).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

function isAppShellRequest(url) {
  return url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/app.js');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  /* Only handle same-origin GET requests — never touch Firebase/Firestore/Google Fonts calls */
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (isAppShellRequest(url)) {
    /* network-first: always try live, cache the fresh copy, fall back to cache offline.
       cache: 'no-store' forces an actual network round-trip — without it, this fetch()
       can still be quietly satisfied by the browser's own HTTP cache, serving a stale
       app shell even though this handler is "network-first" in intent. */
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          const copy = res.clone();
          caches.open(SW_CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  /* cache-first for static assets (icons/manifest) that rarely change */
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
