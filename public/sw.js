const CACHE_NAME = 'velocity-v4.4.0';
const ASSETS = [
  '/',
  '/manifest.json',
  '/logo-velocity.svg',
  '/icon-192.png',
  '/icon-512.png'
];

// ── INSTALACIÓN Y ACTIVACIÓN INMEDIATA ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[Velocity SW 🚀] Instalando versión:', CACHE_NAME);
  self.skipWaiting();
});

// ── ACTIVACIÓN Y PURGA DE TODAS LAS CACHÉS ANTIGUAS ───────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[Velocity SW 🚀] Activando versión:', CACHE_NAME);
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Velocity SW] Purgando caché obsoleta:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ── MANEJADOR DE FETCH (NETWORK-FIRST PARA HTML Y VISTAS) ─────────────────────
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  
  // No interceptar llamadas API ni peticiones no-GET
  if (
    event.request.method !== 'GET' || 
    url.includes('/api/') || 
    url.includes('/inventory-api/') ||
    url.includes('/api') ||
    url.includes('/inventory-api')
  ) {
    return;
  }

  // Network-First para páginas HTML y scripts dinámicos (evita atrapar al usuario en caché vieja)
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback offline a la caché
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('/pages/supervisor.html') || caches.match('/index.html');
          }
        });
      })
  );
});

// ── EVENTO PUSH (NOTIFICACIONES EN SEGUNDO PLANO / PESTAÑA CERRADA) ────────
self.addEventListener('push', (event) => {
  console.log('[Velocity SW 🔔] Evento Push recibido:', event);

  let data = {
    title: '🚨 Alerta Velocity ISP',
    body: 'Nuevo evento o actualización recibida en el sistema.',
    icon: '/logo-velocity.svg',
    badge: '/icon-192.png',
    tag: 'velocity-general-alert',
    data: { url: '/' }
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch {
      data.body = event.data.text();
    }
  }

  const title = data.title || '🚨 Velocity ISP';
  const options = {
    body: data.body,
    icon: data.icon || '/logo-velocity.svg',
    badge: data.badge || '/icon-192.png',
    image: data.image || undefined,
    vibrate: data.vibrate || [200, 100, 200, 100, 200],
    tag: data.tag || `velocity-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.data?.url || data.url || '/',
      timestamp: Date.now(),
      ...(data.data || {})
    },
    actions: [
      { action: 'open', title: '👁️ Abrir en Velocity' },
      { action: 'dismiss', title: 'Cerrar' }
    ]
  };

  // Notificar a las pestañas abiertas que llegó un mensaje push (para sonido/toast si está visible)
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'PUSH_RECEIVED',
        payload: { title, ...options }
      });
    });
  });

  // Mostrar notificación del sistema operativo
  event.waitUntil(self.registration.showNotification(title, options));
});

// ── CLIC EN LA NOTIFICACIÓN (NOTIFICATION CLICK) ───────────────────────────
self.addEventListener('notificationclick', (event) => {
  console.log('[Velocity SW 👆] Clic en notificación:', event.notification.tag);
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. Si ya hay una pestaña abierta de Velocity, enfocarla y navegar
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url.includes(self.location.origin)) {
            client.postMessage({
              type: 'NAVIGATE_TO',
              url: targetUrl
            });
            return client.focus();
          }
        }
      }

      // 2. Si no hay pestañas abiertas, abrir una nueva ventana
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// ── RENOVACIÓN DE SUSCRIPCIÓN ANTE CAMBIOS ─────────────────────────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[Velocity SW] Push subscription expirada/renovada');
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription.options)
      .then((newSubscription) => {
        return fetch('/api/v1/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: newSubscription })
        });
      })
      .catch((err) => console.error('[Velocity SW] Error renovando suscripción push:', err))
  );
});
