/* ReeOS offline-cache. En bil har täckningshål; skalet ska starta ändå. */
const CACHE = 'reeos-v1';

const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/reeos.css',
  './icons/icon.svg',
  './js/main.js',
  './js/core/bus.js', './js/core/store.js', './js/core/ui.js',
  './js/core/sensors.js', './js/core/speech.js', './js/core/router.js',
  './js/apps/home.js', './js/apps/nav.js', './js/apps/music.js',
  './js/apps/phone.js', './js/apps/messages.js', './js/apps/assistant.js',
  './js/apps/triplog.js', './js/apps/fatigue.js', './js/apps/parking.js',
  './js/apps/dashcam.js', './js/apps/alerts.js', './js/apps/hud.js',
  './js/apps/settings.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Kartrutor: nätet först, men behåll en kopia så nyss körd väg finns kvar.
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open(`${CACHE}-tiles`).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request).then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        }).catch(() => cached);
        return cached ?? network;
      }),
    );
    return;
  }

  // Sök- och ruttanrop ska aldrig serveras ur cache — de blir fel direkt.
  if (url.hostname.includes('nominatim') || url.hostname.includes('project-osrm')) return;

  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => cached ?? fetch(request).then((response) => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    }).catch(() => caches.match('./index.html'))),
  );
});
