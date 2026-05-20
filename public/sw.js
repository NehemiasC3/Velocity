const CACHE_NAME = 'velocity-v1';
const ASSETS = [
  'index.html',
  'pages/login.html',
  'pages/supervisor.html',
  'pages/technician.html',
  'src/js/config.js',
  'src/js/core/state.js',
  'src/js/core/api.js',
  'src/js/core/ui.js',
  'src/js/supervisor.js',
  'src/js/technician.js',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap',
  'https://cdn.tailwindcss.com?plugins=forms,container-queries',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Velocity SW] Precaché iniciado');
      // Usar cache.addAll tolerante a fallos
      return Promise.allSettled(
        ASSETS.map(url => {
          return cache.add(url).catch(err => {
            console.warn(`[Velocity SW] Fallo al precachar recurso: ${url}`, err);
          });
        })
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[Velocity SW] Eliminando caché obsoleto:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;
  // Solo interceptar peticiones GET de la misma app y no llamadas API
  if (event.request.method !== 'GET' || url.includes('/api/')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Stale-While-Revalidate: servir rápido de caché y actualizar
        fetch(event.request).then(networkResponse => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        // Cachear dinámicamente nuevas peticiones válidas
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Fallback offline para navegación
        if (event.request.mode === 'navigate') {
          return caches.match('pages/login.html');
        }
      });
    })
  );
});
