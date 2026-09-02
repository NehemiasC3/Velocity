"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
const NotificationService_1 = require("../services/NotificationService");
class NotificationController {
    /**
     * GET /api/v1/notifications/vapid-key
     * Entrega la clave pública VAPID para suscripción en el navegador
     */
    static getVapidKey(_req, res) {
        const publicKey = NotificationService_1.notificationService.getPublicKey();
        res.status(200).json({
            success: true,
            publicKey
        });
    }
    /**
     * POST /api/v1/notifications/subscribe
     * Registra una suscripción Push del navegador con preferencias iniciales opcionales
     */
    static subscribe(req, res) {
        try {
            const { subscription, userId, role, preferences } = req.body;
            if (!subscription || !subscription.endpoint || !subscription.keys) {
                res.status(400).json({
                    success: false,
                    error: 'Objeto de suscripción Push inválido'
                });
                return;
            }
            const userAgent = req.headers['user-agent'] || '';
            const stored = NotificationService_1.notificationService.saveSubscription(subscription, userId, role, userAgent, preferences);
            res.status(201).json({
                success: true,
                message: 'Suscripción Push registrada exitosamente',
                id: stored.id,
                preferences: stored.preferences
            });
        }
        catch (error) {
            console.error('[NotificationController] Error en suscripción:', error.message);
            res.status(500).json({
                success: false,
                error: error.message || 'Error interno registrando suscripción'
            });
        }
    }
    /**
     * GET /api/v1/notifications/preferences?endpoint=...
     */
    static getPreferences(req, res) {
        try {
            const endpoint = req.query.endpoint;
            if (!endpoint) {
                res.status(400).json({ success: false, error: 'Parámetro endpoint es requerido' });
                return;
            }
            const preferences = NotificationService_1.notificationService.getPreferences(endpoint);
            res.status(200).json({
                success: true,
                preferences: preferences || {
                    zones: ['Todas'],
                    priorities: ['Alta', 'Normal'],
                    events: ['orders', 'issues', 'audits']
                }
            });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    /**
     * PUT /api/v1/notifications/preferences
     * Actualiza los filtros de alertas para un endpoint específico
     */
    static updatePreferences(req, res) {
        try {
            const { endpoint, preferences } = req.body;
            if (!endpoint || !preferences) {
                res.status(400).json({
                    success: false,
                    error: 'endpoint y preferences son requeridos'
                });
                return;
            }
            const updated = NotificationService_1.notificationService.updatePreferences(endpoint, preferences);
            if (!updated) {
                res.status(404).json({
                    success: false,
                    error: 'Suscripción no encontrada para el endpoint proporcionado'
                });
                return;
            }
            res.status(200).json({
                success: true,
                message: 'Preferencias de notificaciones actualizadas correctamente',
                preferences: updated.preferences
            });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    /**
     * POST /api/v1/notifications/unsubscribe
     */
    static unsubscribe(req, res) {
        try {
            const { endpoint } = req.body;
            if (!endpoint) {
                res.status(400).json({ success: false, error: 'Endpoint es requerido' });
                return;
            }
            const removed = NotificationService_1.notificationService.removeSubscription(endpoint);
            res.status(200).json({
                success: true,
                removed
            });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    /**
     * POST /api/v1/notifications/send
     * Emite una notificación Push filtrada inteligentemente
     */
    static async sendPush(req, res) {
        try {
            const { title, body, icon, url, role, tag, zone, priority, event } = req.body;
            if (!title || !body) {
                res.status(400).json({
                    success: false,
                    error: 'title y body son requeridos'
                });
                return;
            }
            const payload = {
                title,
                body,
                icon: icon || '/logo-velocity.svg',
                tag: tag || `vel-${Date.now()}`,
                zone,
                priority,
                event,
                data: {
                    url: url || '/',
                    zone,
                    priority,
                    event
                }
            };
            const result = await NotificationService_1.notificationService.broadcastNotification(payload, role);
            res.status(200).json({
                success: true,
                sent: result.sent,
                skipped: result.skipped,
                failed: result.failed,
                totalSubscribers: NotificationService_1.notificationService.getSubscriptionsCount()
            });
        }
        catch (error) {
            console.error('[NotificationController] Error enviando push:', error.message);
            res.status(500).json({
                success: false,
                error: error.message || 'Error enviando notificación push'
            });
        }
    }
    /**
     * POST /api/v1/notifications/test
     * Envía una notificación de prueba para validar el funcionamiento en segundo plano
     */
    static async sendTestPush(req, res) {
        try {
            const { zone = 'Platanilla', priority = 'Alta', event = 'issues' } = req.body || {};
            const payload = {
                title: `🚨 Alerta Velocity [${zone}]`,
                body: `Reporte de prioridad ${priority}: Prueba de notificación en segundo plano recibida con éxito.`,
                icon: '/logo-velocity.svg',
                tag: 'velocity-test-alert',
                zone,
                priority,
                event,
                data: {
                    url: '/',
                    type: 'test',
                    zone,
                    priority,
                    event
                }
            };
            const result = await NotificationService_1.notificationService.broadcastNotification(payload);
            res.status(200).json({
                success: true,
                message: 'Alerta push de prueba emitida a dispositivos suscritos',
                sent: result.sent,
                skipped: result.skipped,
                totalSubscribers: NotificationService_1.notificationService.getSubscriptionsCount()
            });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}
exports.NotificationController = NotificationController;
