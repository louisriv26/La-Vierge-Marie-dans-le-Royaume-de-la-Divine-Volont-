// ── Version — must match APP_VERSION in index.html ─────────────────
const CACHE = 'mjv-v1.9.0';

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
      // Notify all open tabs to reload so they get the new shell immediately
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' })))
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isCorpus = url.pathname.includes('/corpus/');
  const isCrossOrigin = url.origin !== self.location.origin;

  if (isCrossOrigin) {
    // Fonts: cache-first
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        if (res && res.status === 200) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => caches.match(e.request)))
    );
    return;
  }

  if (isCorpus) {
    // Corpus: network-first — always get fresh text
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.status === 200) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    // Shell: network-first for index.html so new deployments always load fresh,
    // cache-first for everything else (icons, etc.)
    const isShell = url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
    if (isShell) {
      e.respondWith(
        fetch(e.request)
          .then(res => {
            if (res && res.status === 200) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
            return res;
          })
          .catch(() => caches.match(e.request))
      );
    } else {
      e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
          if (res && res.status === 200 && e.request.method === 'GET')
            caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        }))
      );
    }
  }
});
