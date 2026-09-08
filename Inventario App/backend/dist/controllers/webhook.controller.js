"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookController = void 0;
const webhook_service_1 = require("../services/webhook.service");
class WebhookController {
    /**
     * Endpoint receptor de Webhook para Activación Zero-Touch desde Wispro
     * POST /api/webhooks/wispro/activation
     */
    static async handleWisproActivation(req, res) {
        try {
            console.log('[Webhook Wispro 📡] Evento de activación recibido:', JSON.stringify(req.body));
            const result = await webhook_service_1.WisproWebhookService.processActivation(req.body);
            res.status(200).json(result);
        }
        catch (error) {
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
exports.WebhookController = WebhookController;
