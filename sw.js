const CACHE_NAME = 'brainforge-v2';
const SHELL_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/app.js',
    '/manifest.json',
];

// Install: cache the app shell
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: network-first for API, cache-first for shell
self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    // API calls and external requests: always go to network
    if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) {
        e.respondWith(fetch(e.request).catch(() =>
            new Response(JSON.stringify({ error: 'Offline' }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
            })
        ));
        return;
    }

    // Shell assets: cache-first with network fallback
    e.respondWith(
        caches.match(e.request).then((cached) => cached || fetch(e.request))
    );
});
