// ── Version — must match APP_VERSION in index.html ───────────────────
const VERSION = '2.8.0';

// Three buckets instead of one. Previously a single version-scoped cache meant
// every code-only deploy evicted the unchanged 416KB corpus and the fonts, so
// the first launch after any update re-downloaded everything.
//   SHELL   — bumped per app version (index.html, manifest, icons)
//   CONTENT — bumped only when the corpus itself changes
//   FONTS   — origin-independent, effectively permanent
const SHELL_CACHE   = 'mjv-shell-v' + VERSION;
const CONTENT_CACHE = 'mjv-content-v1';   // bump only when corpus/days.json changes
const FONT_CACHE    = 'mjv-fonts-v1';
const ALL_CACHES = [SHELL_CACHE, CONTENT_CACHE, FONT_CACHE];

// Icons are precached too: without them a first-run-offline install showed
// broken icons until one online visit populated the cache opportunistically.
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

const CONTENT_ASSETS = [
  './corpus/manifest.json',
  './corpus/days.json'
];

const FONT_URL = 'https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap';

// How long to wait for the network before falling back to a cached copy.
// Without this, a "lie-fi" connection left the app on the loading screen for
// the full request timeout even though a perfectly good cached copy existed.
const NET_TIMEOUT_MS = 3500;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    // Individually so one 404 can't fail the whole install
    await Promise.all(SHELL_ASSETS.map(u => shell.add(u).catch(() => {})));

    const content = await caches.open(CONTENT_CACHE);
    await Promise.all(CONTENT_ASSETS.map(async u => {
      // Don't refetch corpus that a previous version already cached
      if (await content.match(u)) return;
      return content.add(u).catch(() => {});
    }));

    const fonts = await caches.open(FONT_CACHE);
    if (!(await fonts.match(FONT_URL))) await fonts.add(FONT_URL).catch(() => {});

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    // Only touch this app's caches — a sibling app shares this origin.
    await Promise.all(
      keys.filter(k => k.startsWith('mjv-') && !ALL_CACHES.includes(k))
          .map(k => caches.delete(k))
    );
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' }));
  })());
});

// Serve from cache immediately, then refresh the cache in the background so the
// next launch is up to date. Used for the corpus, which is static text that
// only changes on a deliberate content release.
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request).then(res => {
    if (res && res.status === 200) cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  if (cached) return cached;              // instant, no network wait
  const fresh = await network;
  if (fresh) return fresh;
  throw new Error('offline and not cached: ' + request.url);
}

// Prefer the network so a new deployment is picked up, but never let a slow
// connection block startup: whichever resolves first within the timeout wins,
// and the cached copy is the fallback.
async function networkFirstWithTimeout(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const network = fetch(request).then(res => {
    if (res && res.status === 200) cache.put(request, res.clone());
    return res;
  });

  if (!cached) return network;            // nothing to fall back to

  let timer;
  const timeout = new Promise(resolve => { timer = setTimeout(() => resolve(null), NET_TIMEOUT_MS); });
  try {
    const winner = await Promise.race([network.catch(() => null), timeout]);
    return winner || cached;
  } finally {
    clearTimeout(timer);
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res && res.status === 200 && request.method === 'GET') cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const isCrossOrigin = url.origin !== self.location.origin;
  const isCorpus = url.pathname.includes('/corpus/');
  const isShell = url.pathname.endsWith('/') || url.pathname.endsWith('index.html');

  if (isCrossOrigin) {
    // Fonts (and any other cross-origin asset): cache-first, own bucket
    e.respondWith(cacheFirst(e.request, FONT_CACHE).catch(() => caches.match(e.request)));
    return;
  }

  if (isCorpus) {
    // Static book content — serve instantly from cache, refresh in background
    e.respondWith(staleWhileRevalidate(e.request, CONTENT_CACHE));
    return;
  }

  if (isShell) {
    // Fresh shell after a deploy, but bounded so lie-fi can't stall startup
    e.respondWith(networkFirstWithTimeout(e.request, SHELL_CACHE));
    return;
  }

  e.respondWith(cacheFirst(e.request, SHELL_CACHE));
});
