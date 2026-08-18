// ── Version — must match APP_VERSION in index.html ───────────────────
const VERSION = '2.17.14';

// H5 uses two app-scoped buckets. Local OFL fonts ship with the release shell.
//   SHELL   — bumped per app version (index.html, manifest, icons, local fonts)
//   CONTENT — bumped only when the governed corpus itself changes
const SHELL_CACHE   = 'mjv-shell-v' + VERSION;
const CONTENT_CACHE = 'mjv-content-v1';   // bump only when corpus/days.json changes
const ALL_CACHES = [SHELL_CACHE, CONTENT_CACHE];

// Icons are precached too: without them a first-run-offline install showed
// broken icons until one online visit populated the cache opportunistically.
const REQUIRED_SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './fonts/crimson-text-400.woff2',
  './fonts/crimson-text-600.woff2',
  './fonts/crimson-text-400-italic.woff2',
  './fonts/im-fell-english-400.woff2',
  './fonts/im-fell-english-400-italic.woff2',
  './fonts/OFL-Crimson-Text.txt',
  './fonts/OFL-IM-Fell-English.txt',
];

const OPTIONAL_SHELL_ASSETS = [
  './icons/favicon-16.png',
  './icons/favicon-32.png',
  './icons/favicon.ico',
  './icons/icon-60.png',
  './icons/icon-120.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

const CONTENT_ASSETS = [
  './corpus/manifest.json',
  './corpus/days.json'
];


// How long to wait for the network before falling back to a cached copy.
// Without this, a "lie-fi" connection left the app on the loading screen for
// the full request timeout even though a perfectly good cached copy existed.
const NET_TIMEOUT_MS = 3500;

// Install-time requests bypass the browser HTTP cache. This prevents a new
// service-worker version from seeding its versioned shell cache with stale
// bytes that happen to be fresh in the normal HTTP cache. Required reader
// assets are atomic: if one cannot be obtained, this worker does not activate
// and the previous working service worker remains in control.
function scopedRequest(url, cacheMode = 'reload') {
  return new Request(new URL(url, self.registration.scope).href, { cache: cacheMode });
}

async function fetchRequired(url) {
  const req = scopedRequest(url, 'reload');
  const res = await fetch(req);
  if (!res || !res.ok) throw new Error('required precache failed: ' + req.url);
  return { req, res };
}

async function putRequired(cache, url) {
  const { req, res } = await fetchRequired(url);
  await cache.put(req, res.clone());
}

async function putOptionalReload(cache, url) {
  try {
    const { req, res } = await fetchRequired(url);
    await cache.put(req, res.clone());
  } catch (_) { /* cosmetic asset: fallback UI remains usable */ }
}

async function ensureContent(cache, url) {
  const req = scopedRequest(url, 'reload');
  if (await cache.match(req)) return;
  const res = await fetch(req);
  if (!res || !res.ok) throw new Error('required content precache failed: ' + req.url);
  await cache.put(req, res.clone());
}



self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    for (const u of REQUIRED_SHELL_ASSETS) await putRequired(shell, u);
    await Promise.all(OPTIONAL_SHELL_ASSETS.map(u => putOptionalReload(shell, u)));

    const content = await caches.open(CONTENT_CACHE);
    for (const u of CONTENT_ASSETS) await ensureContent(content, u);

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
function shellCacheKey(request) {
  // Deep links are query-string routes served by the same app shell. The
  // install cache contains only './' and './index.html'; matching the full
  // navigation URL would therefore fail offline for ?open=unit/search routes.
  // Canonicalise only shell navigations, while preserving the browser's real
  // URL so startup routing still sees window.location.search.
  const url = new URL(request.url);
  if (url.origin === self.location.origin &&
      (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html'))) {
    url.search = '';
    url.hash = '';
    return new Request(url.href, { method: 'GET' });
  }
  return request;
}

async function networkFirstWithTimeout(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cacheKey = shellCacheKey(request);
  const cached = await cache.match(cacheKey);

  const network = fetch(request, { cache: 'no-store' }).then(res => {
    if (res && res.status === 200) cache.put(cacheKey, res.clone());
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

  if (isCrossOrigin) return;

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
