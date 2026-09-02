/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ revision: string | null; url: string }>;
};

// ── 1. PRECACHÉ AUTOMÁTICO DE ASSETS VITE (WORKBOX) ───────────────────────────
precacheAndRoute(self.__WB_MANIFEST || []);

// ── 2. ESTRATEGIA NETWORK-FIRST PARA LA API DE INVENTARIO ─────────────────────
// Intenta obtener datos frescos de Wispro/Backend por red; si falla (offline), entrega la caché.
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/v1/inventory'),
  new NetworkFirst({
    cacheName: 'velocity-api-inventory-cache',
    networkTimeoutSeconds: 3
  })
);

// ── 3. ACTIVACIÓN Y CONTROL DE ACTUALIZACIONES (SKIP_WAITING) ─────────────────
self.addEventListener('message', (event) => {
  if (event.data) {
    if (event.data.type === 'SKIP_WAITING' || event.data === 'SKIP_WAITING') {
      console.log('[Velocity SW] Recibido SKIP_WAITING. Activando nueva versión...');
      self.skipWaiting();
    }
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ── 4. EVENTO PUSH (NOTIFICACIONES EN SEGUNDO PLANO / PESTAÑA CERRADA) ────────
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
  const options: any = {
    body: data.body,
    icon: data.icon || '/logo-velocity.svg',
    badge: data.badge || '/icon-192.png',
    tag: data.tag || `velocity-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    data: {
      url: (data.data && data.data.url) || data.data || '/',
      timestamp: Date.now(),
      ...(typeof data.data === 'object' ? data.data : {})
    },
    actions: [
      { action: 'open', title: '👁️ Abrir en Velocity' },
      { action: 'dismiss', title: 'Cerrar' }
    ]
  };

  // Notificar a las pestañas abiertas mediante postMessage para sonido/toast si está visible
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'PUSH_RECEIVED',
        payload: { title, ...options }
      });
    });
  });

  // Mostrar notificación del sistema operativo
  event.waitUntil(self.registration.showNotification(title, options as any));
});

// ── 5. CLIC EN LA NOTIFICACIÓN (NOTIFICATION CLICK) ───────────────────────────
self.addEventListener('notificationclick', (event) => {
  console.log('[Velocity SW 👆] Clic en notificación:', event.notification.tag);
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client && client.url.includes(self.location.origin)) {
          client.postMessage({
            type: 'NAVIGATE_TO',
            url: targetUrl
          });
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// ── 6. RENOVACIÓN DE SUSCRIPCIÓN ANTE CAMBIOS ─────────────────────────────────
self.addEventListener('pushsubscriptionchange', (event: any) => {
  console.log('[Velocity SW] Push subscription expirada/renovada');
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription?.options)
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
