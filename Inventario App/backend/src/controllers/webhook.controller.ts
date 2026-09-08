import { Request, Response } from 'express';
import { WisproWebhookService } from '../services/webhook.service';

export class WebhookController {
  /**
   * Endpoint receptor de Webhook para Activación Zero-Touch desde Wispro
   * POST /api/webhooks/wispro/activation
   */
  public static async handleWisproActivation(req: Request, res: Response): Promise<void> {
    try {
      console.log('[Webhook Wispro 📡] Evento de activación recibido:', JSON.stringify(req.body));
      
      const result = await WisproWebhookService.processActivation(req.body);

      res.status(200).json(result);
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      
      console.error(`[Webhook Wispro ❌] Error procesando activación (HTTP ${statusCode}):`, error.message);

      if (statusCode === 422) {
        // Requerimiento: Si la MAC no existe en el inventario de Velocity, responder con status 422
        res.status(422).json({
          success: false,
          error: 'Unprocessable Entity',
          message: error.message,
          macAddress: error.macAddress
        });
        return;
      }

      res.status(statusCode).json({
        success: false,
        error: error.code || (statusCode === 400 ? 'BadRequest' : 'InternalServerError'),
        message: error.message,
        details: error.details || error.warehouse || undefined
      });
    }
  }
}
