"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const webhook_controller_1 = require("../controllers/webhook.controller");
const router = (0, express_1.Router)();
/**
 * 1. Endpoint del Webhook: POST /api/webhooks/wispro/activation
 * Procesamiento de automatización 'Zero-Touch' cuando un contrato es autorizado/activado en Wispro
 */
router.post('/wispro/activation', webhook_controller_1.WebhookController.handleWisproActivation);
// Alias por flexibilidad
router.post('/activation', webhook_controller_1.WebhookController.handleWisproActivation);
exports.default = router;
