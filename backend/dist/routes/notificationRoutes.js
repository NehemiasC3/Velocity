"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notificationController_1 = require("../controllers/notificationController");
const router = (0, express_1.Router)();
// Clave pública VAPID (pública)
router.get('/notifications/vapid-key', notificationController_1.NotificationController.getVapidKey);
// Suscripción de navegadores
router.post('/notifications/subscribe', notificationController_1.NotificationController.subscribe);
router.post('/notifications/unsubscribe', notificationController_1.NotificationController.unsubscribe);
// Gestión de Preferencias de Alertas
router.get('/notifications/preferences', notificationController_1.NotificationController.getPreferences);
router.put('/notifications/preferences', notificationController_1.NotificationController.updatePreferences);
// Envío de alertas PUSH
router.post('/notifications/send', notificationController_1.NotificationController.sendPush);
router.post('/notifications/test', notificationController_1.NotificationController.sendTestPush);
exports.default = router;
