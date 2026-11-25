// Offline support: cache-first, one cache per app version (js/version.js).
importScripts('js/version.js');

// The github.io origin is shared between projects, so only ever touch our own prefix.
const PREFIX = 'severe-';
const CACHE = PREFIX + self.APP_VERSION;
const FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'app-icons/apple-touch-icon-180.png',
  'app-icons/icon-192.png',
  'app-icons/icon-512.png',
  'css/app.css',
  'css/theme.css',
  'icons/bench.svg',
  'icons/cableCurl1.svg',
  'icons/cableLat.svg',
  'icons/calf.svg',
  'icons/chestRow.svg',
  'icons/crossover.svg',
  'icons/dbCurlSup.svg',
  'icons/hack.svg',
  'icons/inclBar45.svg',
  'icons/inclCable.svg',
  'icons/inclDb45.svg',
  'icons/inclDbCurl45.svg',
  'icons/inclPlate.svg',
  'icons/inclSmith45.svg',
  'icons/isoPulldown.svg',
  'icons/latCable.svg',
  'icons/latMachine.svg',
  'icons/legCurl.svg',
  'icons/legPress.svg',
  'icons/oneArmExt.svg',
  'icons/overhead.svg',
  'icons/preacher.svg',
  'icons/pullup.svg',
  'icons/pushdown.svg',
  'icons/rdl.svg',
  'icons/rdlSeated.svg',
  'icons/row.svg',
  'icons/seatedOverhead.svg',
  'icons/shoulderPress2.svg',
  'icons/smithSquat.svg',
  'icons/tbar.svg',
  'icons/wristCurl.svg',
  'icons/wristExt.svg',
  'js/app.js',
  'js/db.js',
  'js/logic/backup.js',
  'js/logic/program.js',
  'js/logic/rotation.js',
  'js/logic/weights.js',
  'js/screens/entry.js',
  'js/screens/exercise.js',
  'js/screens/exercises.js',
  'js/screens/more.js',
  'js/screens/program.js',
  'js/screens/today.js',
  'js/seed.js',
  'js/ui.js',
  'js/version.js',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' skips the HTTP cache, so a new version never mixes with old files.
  event.waitUntil(caches.open(CACHE)
    .then((cache) => cache.addAll(FILES.map((url) => new Request(url, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const old = (await caches.keys()).filter((k) => k.startsWith(PREFIX) && k !== CACHE);
    await Promise.all(old.map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(request.mode === 'navigate' ? 'index.html' : request);
    return hit ?? fetch(request);
  })());
});
