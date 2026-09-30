// Enkel offline-cache för Astro (PWA / Meta Quest).
const CACHE = 'astro-v1';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css', 'vendor/three.module.min.js',
  'js/main.js', 'js/data.js', 'js/i18n.js', 'js/textures.js', 'js/ship.js', 'js/world.js', 'js/hangar.js',
  'js/flight.js', 'js/input.js', 'js/ui.js', 'js/presence.js', 'js/audio.js', 'js/xr.js',
  'icons/icon-192.png', 'icons/icon-512.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Nätverket först (så att uppdateringar kommer fram), cachen om det inte går.
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
