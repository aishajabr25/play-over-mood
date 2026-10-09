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

const SW_CACHE = 'pom-shell-v3';

const PRECACHE_URLS = [
  './manifest.webmanifest',
  './icons.js?v=1',
  './icons/ui/sun.svg',
  './icons/ui/moon.svg',
  './icons/ui/night-sky.svg',
  './icons/ui/mosque.svg',
  './icons/ui/clock.svg',
  './icons/ui/sunset.svg',
  './icons/ui/city-evening.svg',
  './icons/ui/city-night.svg',
  './icons/ui/prayer-beads.svg',
  './icons/ui/crescent.svg',
  './icons/ui/sunrise.svg',
  './icons/ui/book.svg',
  './icons/ui/walk.svg',
  './icons/ui/water.svg',
  './icons/ui/headphones.svg',
  './icons/ui/handshake.svg',
  './icons/ui/tree.svg',
  './icons/ui/connection.svg',
  './icons/ui/compass.svg',
  './icons/ui/sparkles.svg',
  './icons/ui/basket.svg',
  './icons/ui/palette.svg',
  './icons/ui/dove.svg',
  './icons/ui/kite.svg',
  './icons/ui/candle.svg',
  './icons/ui/care.svg',
  './icons/ui/full-moon.svg',
  './icons/ui/kaaba.svg',
  './icons/ui/playful.svg',
  './icons/ui/heart.svg',
  './icons/ui/heart-warm.svg',
  './icons/ui/heart-healing.svg',
  './icons/ui/star.svg',
  './icons/ui/star-outline.svg',
  './icons/ui/repeat.svg',
  './icons/ui/flower.svg',
  './icons/ui/hashtag.svg',
  './icons/ui/celebrate.svg',
  './icons/ui/smile.svg',
  './icons/ui/laugh.svg',
  './icons/ui/smile-sweat.svg',
  './icons/ui/calendar.svg',
  './icons/ui/globe.svg',
  './icons/ui/cloud.svg',
  './icons/ui/gamepad.svg',
  './icons/ui/chart.svg',
  './icons/ui/chat.svg',
  './icons/ui/camera.svg',
  './icons/ui/idea.svg',
  './icons/ui/turtle.svg',
  './icons/ui/notes.svg',
  './icons/ui/growth.svg',
  './icons/ui/scroll.svg',
  './icons/ui/puzzle.svg',
  './icons/ui/edit.svg',
  './icons/ui/pin.svg',
  './icons/ui/microphone.svg',
  './icons/ui/upload.svg',
  './icons/ui/download.svg',
  './icons/ui/link.svg',
  './icons/ui/science.svg',
  './icons/ui/archive.svg',
  './icons/ui/delete.svg',
  './icons/ui/gear.svg',
  './icons/ui/hourglass.svg',
  './icons/ui/back.svg',
  './icons/ui/target.svg',
  './icons/ui/tag.svg',
  './icons/ui/announcement.svg',
  './icons/ui/like.svg',
  './icons/ui/dislike.svg',

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
    url.pathname.endsWith('/app.js') ||
    url.pathname.endsWith('/icons.js');
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
