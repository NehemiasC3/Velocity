import { useState, useEffect, useCallback } from 'react';
import {
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  playAlertSound,
  triggerSmartAlert
} from '../utils/notifications';

export function usePushNotifications(userId?: string, role?: string) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [supported, setSupported] = useState<boolean>(false);

  // Registrar Service Worker y comprobar estado inicial
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
      setSupported(true);
      setPermission(Notification.permission);

      // Registrar Service Worker
      navigator.serviceWorker
        .register('/sw.js')
        .then(async (reg) => {
          const sub = await reg.pushManager.getSubscription();
          setIsSubscribed(Boolean(sub));
        })
        .catch((err) => console.warn('[usePushNotifications] Registro SW falló:', err));

      // Escuchar mensajes push entrantes mientras la pestaña esté abierta
      const handleSwMessage = (event: MessageEvent) => {
        if (event.data?.type === 'PUSH_RECEIVED') {
          playAlertSound();
        }
      };

      navigator.serviceWorker.addEventListener('message', handleSwMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      };
    }
  }, []);

  const enableNotifications = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      const perm = await requestNotificationPermission();
      setPermission(perm);

      if (perm === 'granted') {
        const sub = await subscribeToPush(userId, role);
        setIsSubscribed(Boolean(sub));
        playAlertSound();
        return Boolean(sub);
      }
      return false;
    } catch (e) {
      console.error('[usePushNotifications] Error al habilitar:', e);
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId, role]);

  const disableNotifications = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      const success = await unsubscribeFromPush();
      if (success) {
        setIsSubscribed(false);
      }
      return success;
    } finally {
      setLoading(false);
    }
  }, []);

  const sendTestAlert = useCallback(async () => {
    playAlertSound();
    try {
      await fetch('/api/v1/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      console.warn('Fallback a notificación local de prueba:', err);
      triggerSmartAlert(
        '🚨 Prueba de Alerta Velocity',
        'Notificación de prueba emitida en segundo plano con sonido estilo WhatsApp.'
      );
    }
  }, []);

  return {
    supported,
    permission,
    isSubscribed,
    loading,
    enableNotifications,
    disableNotifications,
    sendTestAlert
  };
}
