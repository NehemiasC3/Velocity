"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const DbService_1 = require("../services/DbService");
const router = (0, express_1.Router)();
const dbService = new DbService_1.DbService();
/**
 * Webhook Listener: POST /api/webhooks/wispro/activation
 * Procesamiento de automatización 'Zero-Touch' cuando un contrato es autorizado/activado en Wispro
 */
router.post(['/webhooks/wispro/activation', '/webhooks/activation'], async (req, res) => {
    console.log('[Velocity Backend 📡] Webhook de activación recibido:', JSON.stringify(req.body));
    const inventoryApiUrl = process.env.INVENTORY_API_URL || 'http://localhost:4000/api';
    try {
        const response = await axios_1.default.post(`${inventoryApiUrl}/webhooks/wispro/activation`, req.body, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            validateStatus: () => true // Permite procesar códigos 422 sin arrojar excepción
        });
        const data = response.data;
        if (response.status === 422) {
            const mac = req.body.macAddress || req.body.mac || req.body.serial || req.body.serialNumber || 'Desconocida';
            const alertMsg = data.message || `Equipo desconocido intentó ser activado en Wispro: [${mac}]`;
            // Registrar alerta en el panel del supervisor
            dbService.addAlert({
                message: alertMsg,
                type: 'error',
                details: {
                    contractId: req.body.contractId,
                    clientName: req.body.clientName,
                    payload: req.body
                }
            });
            console.warn(`[Velocity 🚨 ALERTA SUPERVISOR]: ${alertMsg}`);
            res.status(422).json(data);
            return;
        }
        res.status(response.status).json(data);
    }
    catch (err) {
        console.error('[Velocity Backend ❌] Error conectando con API de Inventario (Puerto 4000):', err.message);
        const mac = req.body.macAddress || req.body.mac || req.body.serial || 'Desconocida';
        const alertMsg = `Equipo desconocido intentó ser activado en Wispro: [${mac}]`;
        dbService.addAlert({
            message: alertMsg,
            type: 'error',
            details: {
                error: err.message,
                payload: req.body
            }
        });
        res.status(422).json({
            success: false,
            error: 'Unprocessable Entity',
            message: alertMsg,
            macAddress: mac
        });
    }
});
exports.default = router;
