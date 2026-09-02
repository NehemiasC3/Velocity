/**
 * Utilidades para Web Push API, Permisos y Efectos de Sonido
 */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Genera un sonido de alerta dual-tone limpio estilo WhatsApp Web
 * utilizando la Web Audio API nativa sin requerir archivos externos.
 */
export function playAlertSound(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();

    // Reanudar contexto si está suspendido por políticas de autoplay
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Primer tono (alta frecuencia suave: 880 Hz / A5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.3, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.18);

    // Segundo tono (tono confirmatorio más agudo: 1320 Hz / E6)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1320, now + 0.09);
    gain2.gain.setValueAtTime(0, now + 0.09);
    gain2.gain.linearRampToValueAtTime(0.35, now + 0.11);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.09);
    osc2.stop(now + 0.35);
  } catch (e) {
    console.warn('[Notifications] No se pudo reproducir el sonido:', e);
  }
}

/**
 * Solicita permisos de notificación nativos del navegador
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('[Notifications] Este navegador no soporta notificaciones de escritorio.');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (e) {
    console.error('[Notifications] Error solicitando permisos:', e);
    return 'denied';
  }
}

/**
 * Suscribe el Service Worker al servicio Web Push del Backend con VAPID
 */
export async function subscribeToPush(userId?: string, role?: string): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Notifications] Web Push no soportado en este navegador.');
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.ready;

    // 1. Obtener clave pública VAPID desde el backend
    const keyRes = await fetch('/api/v1/notifications/vapid-key');
    const { publicKey } = await keyRes.json();

    if (!publicKey) {
      throw new Error('No se pudo obtener la clave VAPID pública');
    }

    const applicationServerKey = urlBase64ToUint8Array(publicKey);

    // 2. Suscribir a PushManager
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as any
    });

    // 3. Enviar la suscripción al servidor
    await fetch('/api/v1/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        userId,
        role
      })
    });

    console.log('[Notifications ✅] Dispositivo suscrito a alertas Push en segundo plano.');
    return subscription;
  } catch (e: any) {
    console.error('[Notifications] Error al suscribirse a Push:', e.message);
    return null;
  }
}

/**
 * Desuscribe el navegador de Web Push
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;

  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await fetch('/api/v1/notifications/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint })
      });
      return true;
    }
    return false;
  } catch (e) {
    console.error('[Notifications] Error al desuscribir:', e);
    return false;
  }
}

/**
 * Emite una alerta adaptativa:
 * - Si la pestaña está visible/activa: reproduce audio y emite evento interno
 * - Si la pestaña está oculta o minimizada: emite notificación nativa del sistema operativo
 */
export async function triggerSmartAlert(
  title: string,
  body: string,
  url: string = '/'
): Promise<void> {
  // Siempre reproducir sonido de alerta
  playAlertSound();

  const isHidden = document.hidden || document.visibilityState === 'hidden';

  if (isHidden) {
    // Pestaña minimizada / oculta -> Notificación nativa del SO
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
      const reg = await navigator.serviceWorker.ready;
      const options: any = {
        body,
        icon: '/logo-velocity.svg',
        badge: '/icon-192.png',
        tag: `vel-${Date.now()}`,
        vibrate: [200, 100, 200, 100, 200],
        requireInteraction: true,
        data: { url }
      };
      reg.showNotification(title, options);
    }
  } else {
    // Pestaña activa -> Disparar evento personalizado para toast en pantalla
    window.dispatchEvent(
      new CustomEvent('velocity-toast-alert', {
        detail: { title, body, url }
      })
    );
  }
}
