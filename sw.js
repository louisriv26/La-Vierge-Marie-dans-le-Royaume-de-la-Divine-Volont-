// Cache key — bump this when deploying updates
const CACHE = 'mjv-v1.1.1';

// SW scope is set by the caller (index.html passes { scope: APP_BASE })
// All asset paths are relative to the SW file location
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './corpus/manifest.json',
  './corpus/days.json',
  'https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isCorpus = url.pathname.includes('/corpus/');
  const isCrossOrigin = url.origin !== self.location.origin;

  if (isCrossOrigin) {
    // Fonts: cache-first, no CORS issues
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        if (res && res.status === 200) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => caches.match(e.request)))
    );
    return;
  }

  if (isCorpus) {
    // Corpus: network-first so updates deploy cleanly
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    // Shell: cache-first for fast load
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        if (res && res.status === 200 && e.request.method === 'GET') {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }))
    );
  }
});
