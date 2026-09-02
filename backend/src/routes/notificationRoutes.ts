import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController';

const router = Router();

// Clave pública VAPID (pública)
router.get('/notifications/vapid-key', NotificationController.getVapidKey);

// Suscripción de navegadores
router.post('/notifications/subscribe', NotificationController.subscribe);
router.post('/notifications/unsubscribe', NotificationController.unsubscribe);

// Gestión de Preferencias de Alertas
router.get('/notifications/preferences', NotificationController.getPreferences);
router.put('/notifications/preferences', NotificationController.updatePreferences);

// Envío de alertas PUSH
router.post('/notifications/send', NotificationController.sendPush);
router.post('/notifications/test', NotificationController.sendTestPush);

export default router;
