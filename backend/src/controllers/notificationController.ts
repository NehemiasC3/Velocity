import { Request, Response } from 'express';
import { notificationService } from '../services/NotificationService';
import { PushSubscriptionPayload, NotificationPayload } from '../types/notification';

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
   * Registra una suscripción Push del navegador
   */
  public static subscribe(req: Request, res: Response): void {
    try {
      const { subscription, userId, role } = req.body;

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
        userAgent
      );

      res.status(201).json({
        success: true,
        message: 'Suscripción Push registrada exitosamente',
        id: stored.id
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
   * Emite una notificación Push a todos los suscriptores o rol
   */
  public static async sendPush(req: Request, res: Response): Promise<void> {
    try {
      const { title, body, icon, url, role, tag } = req.body;

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
        data: {
          url: url || '/'
        }
      };

      const result = await notificationService.broadcastNotification(payload, role);

      res.status(200).json({
        success: true,
        sent: result.sent,
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
      const payload: NotificationPayload = {
        title: '🚨 Velocity Alert: Notificación de Prueba',
        body: 'El sistema de alertas en segundo plano estilo WhatsApp está funcionando correctamente.',
        icon: '/logo-velocity.svg',
        tag: 'velocity-test-alert',
        data: {
          url: '/',
          type: 'test'
        }
      };

      const result = await notificationService.broadcastNotification(payload);

      res.status(200).json({
        success: true,
        message: 'Alerta push de prueba enviada a los dispositivos suscritos',
        sent: result.sent,
        totalSubscribers: notificationService.getSubscriptionsCount()
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
