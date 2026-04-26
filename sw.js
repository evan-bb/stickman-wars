// Service Worker for Stickman Wars PWA.
//
// CACHE_VERSION is replaced with the short commit SHA at deploy time by
// .github/workflows/firebase-hosting-merge.yml — every deploy gets a
// fresh cache, so when the SW updates it discards the old version and
// pulls the new build.
//
// Strategy:
//   - On install, precache the static shell (HTML, JS, manifest, icons).
//   - On fetch, cache-first for same-origin GET requests; fall through
//     to network for cross-origin (Firebase, PeerJS broker, gstatic CDN).
//   - On activate, delete any caches whose name doesn't match the
//     current version.

const CACHE_VERSION = '__CACHE_VERSION__';
const CACHE_NAME = 'swars-' + CACHE_VERSION;
// In local dev, the placeholder is never replaced. Skip caching entirely
// so script edits don't get masked by a stale install.
const IS_DEV_BUILD = CACHE_VERSION === '__' + 'CACHE_VERSION__';

const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/manifest.webmanifest',
    '/icons/icon.svg',
    '/icons/icon-maskable.svg',
    '/js/firebase-config.js',
    '/js/lobby.js',
    '/js/version.js',
    '/js/constants.js',
    '/js/utils.js',
    '/js/iso.js',
    '/js/input.js',
    '/js/touch.js',
    '/js/camera.js',
    '/js/particles.js',
    '/js/stickman.js',
    '/js/weapon.js',
    '/js/entity.js',
    '/js/player.js',
    '/js/ai.js',
    '/js/boss.js',
    '/js/currency.js',
    '/js/crate.js',
    '/js/biome.js',
    '/js/minimap.js',
    '/js/hud.js',
    '/js/progression.js',
    '/js/music.js',
    '/js/multiplayer.js',
    '/js/game.js',
    '/js/main.js'
];

self.addEventListener('install', (event) => {
    if (IS_DEV_BUILD) { self.skipWaiting(); return; }
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            // Remove every cache that isn't the current one (also wipes dev caches).
            Promise.all(names.filter((n) => n !== CACHE_NAME || IS_DEV_BUILD).map((n) => caches.delete(n)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (IS_DEV_BUILD) return; // network passthrough in dev
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    // Don't cache the SW itself — the browser handles its update lifecycle.
    if (url.pathname === '/sw.js') return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req, { ignoreSearch: true });
        if (cached) return cached;
        try {
            const fresh = await fetch(req);
            if (fresh && fresh.status === 200 && fresh.type === 'basic') {
                cache.put(req, fresh.clone());
            }
            return fresh;
        } catch (err) {
            throw err;
        }
    })());
});
