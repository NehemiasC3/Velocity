const CACHE_NAME = 'velocity-v3.0-force';
const ASSETS = [
    'index.html',
    'pages/supervisor.html',
    'pages/technician.html'
];


self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(keys.map(key => {
                if (key !== CACHE_NAME) return caches.delete(key);
            }));
        })
    );
});

self.addEventListener('fetch', event => {
    // Solo cacheamos archivos estáticos, no peticiones de API
    if (event.request.url.includes('/api/')) return;
    
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});
