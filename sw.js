// ── Version — must match APP_VERSION in index.html ───────────────────
const VERSION = '2.17.3';

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
const REQUIRED_SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
];

const OPTIONAL_SHELL_ASSETS = [
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
const FONT_TIMEOUT_MS = 2500;

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

async function fetchOptionalFont(request) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FONT_TIMEOUT_MS);
  try { return await fetch(request, { signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function warmFontCache() {
  // Fonts remain an optional enhancement. The reader's local Georgia/serif
  // fallback is always usable; when Google Fonts is reachable, cache both its
  // stylesheet and every referenced WOFF/WOFF2 resource for later offline use.
  const fonts = await caches.open(FONT_CACHE);
  const cssReq = new Request(FONT_URL, { cache: 'reload', mode: 'cors' });
  const cssRes = await fetchOptionalFont(cssReq);
  if (!cssRes || !cssRes.ok) return;
  const cssText = await cssRes.clone().text();
  await fonts.put(cssReq, cssRes.clone());
  const urls = [...new Set(Array.from(cssText.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g), m => m[1]))];
  await Promise.all(urls.map(async url => {
    try {
      const req = new Request(url, { cache: 'reload', mode: 'cors' });
      if (await fonts.match(req)) return;
      const res = await fetchOptionalFont(req);
      if (res && (res.ok || res.type === 'opaque')) await fonts.put(req, res.clone());
    } catch (_) { /* font enhancement is deliberately non-fatal */ }
  }));
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    for (const u of REQUIRED_SHELL_ASSETS) await putRequired(shell, u);
    await Promise.all(OPTIONAL_SHELL_ASSETS.map(u => putOptionalReload(shell, u)));

    const content = await caches.open(CONTENT_CACHE);
    for (const u of CONTENT_ASSETS) await ensureContent(content, u);

    await warmFontCache().catch(() => {});
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
