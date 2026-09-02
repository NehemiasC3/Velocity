import { Request, Response } from 'express';
import { notificationService } from '../services/NotificationService';
import { PushSubscriptionPayload, NotificationPayload, NotificationPreferences } from '../types/notification';

export class NotificationController {
  /**
   * GET /api/v1/notifications/vapid-key
   * Entrega la clave pública VAPID para suscripción en el navegador
   */
  public static getVapidKey(_req: Request, res: Response): void {
    const publicKey = notificationService.getPublicKey();
    res.status(200).json({
      success: true,
      publicKey
    });
  }

  /**
   * POST /api/v1/notifications/subscribe
   * Registra una suscripción Push del navegador con preferencias iniciales opcionales
   */
  public static subscribe(req: Request, res: Response): void {
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
      const stored = notificationService.saveSubscription(
        subscription as PushSubscriptionPayload,
        userId,
        role,
        userAgent,
        preferences as NotificationPreferences
      );

      res.status(201).json({
        success: true,
        message: 'Suscripción Push registrada exitosamente',
        id: stored.id,
        preferences: stored.preferences
      });
    } catch (error: any) {
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
  public static getPreferences(req: Request, res: Response): void {
    try {
      const endpoint = req.query.endpoint as string;
      if (!endpoint) {
        res.status(400).json({ success: false, error: 'Parámetro endpoint es requerido' });
        return;
      }

      const preferences = notificationService.getPreferences(endpoint);
      res.status(200).json({
        success: true,
        preferences: preferences || {
          zones: ['Todas'],
          priorities: ['Alta', 'Normal'],
          events: ['orders', 'issues', 'audits']
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/v1/notifications/preferences
   * Actualiza los filtros de alertas para un endpoint específico
   */
  public static updatePreferences(req: Request, res: Response): void {
    try {
      const { endpoint, preferences } = req.body;

      if (!endpoint || !preferences) {
        res.status(400).json({
          success: false,
          error: 'endpoint y preferences son requeridos'
        });
        return;
      }

      const updated = notificationService.updatePreferences(endpoint, preferences as NotificationPreferences);

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
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/v1/notifications/unsubscribe
   */
  public static unsubscribe(req: Request, res: Response): void {
    try {
      const { endpoint } = req.body;
      if (!endpoint) {
        res.status(400).json({ success: false, error: 'Endpoint es requerido' });
        return;
      }

      const removed = notificationService.removeSubscription(endpoint);
      res.status(200).json({
        success: true,
        removed
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/v1/notifications/send
   * Emite una notificación Push filtrada inteligentemente
   */
  public static async sendPush(req: Request, res: Response): Promise<void> {
    try {
      const { title, body, icon, url, role, tag, zone, priority, event } = req.body;

      if (!title || !body) {
        res.status(400).json({
          success: false,
          error: 'title y body son requeridos'
        });
        return;
      }

      const payload: NotificationPayload = {
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

      const result = await notificationService.broadcastNotification(payload, role);

      res.status(200).json({
        success: true,
        sent: result.sent,
        skipped: result.skipped,
        failed: result.failed,
        totalSubscribers: notificationService.getSubscriptionsCount()
      });
    } catch (error: any) {
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
  public static async sendTestPush(req: Request, res: Response): Promise<void> {
    try {
      const { zone = 'Platanilla', priority = 'Alta', event = 'issues' } = req.body || {};

      const payload: NotificationPayload = {
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

      const result = await notificationService.broadcastNotification(payload);

      res.status(200).json({
        success: true,
        message: 'Alerta push de prueba emitida a dispositivos suscritos',
        sent: result.sent,
        skipped: result.skipped,
        totalSubscribers: notificationService.getSubscriptionsCount()
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
