import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller';

const router = Router();

/**
 * 1. Endpoint del Webhook: POST /api/webhooks/wispro/activation
 * Procesamiento de automatización 'Zero-Touch' cuando un contrato es autorizado/activado en Wispro
 */
router.post('/wispro/activation', WebhookController.handleWisproActivation);

// Alias por flexibilidad
router.post('/activation', WebhookController.handleWisproActivation);

export default router;
