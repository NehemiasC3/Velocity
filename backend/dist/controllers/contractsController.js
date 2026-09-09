"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractsController = void 0;
const axios_1 = __importDefault(require("axios"));
const INVENTORY_API_URL = (process.env.INVENTORY_API_URL ||
    (process.env.NODE_ENV === 'production' ? 'http://inventory-backend:4000/api' : 'http://127.0.0.1:4000/api')).replace(/\/+$/, '');
class ContractsController {
    /**
     * Endpoint principal /api/contracts y /api/wispro/contracts/active:
     * Consulta directa al servicio de inventario PostgreSQL vía Prisma con respuesta sub-50ms
     */
    static async getContracts(req, res) {
        try {
            const query = req.originalUrl.includes('?') ? req.originalUrl.split('?')[1] : '';
            const url = `${INVENTORY_API_URL}/contracts${query ? '?' + query : ''}`;
            const response = await axios_1.default.get(url, {
                timeout: 10000,
                validateStatus: () => true,
                headers: {
                    Accept: 'application/json'
                }
            });
            res.status(response.status).json(response.data);
        }
        catch (error) {
            console.error('[ContractsController ❌] Error conectando con backend de PostgreSQL (Puerto 4000):', error.message);
            res.status(502).json({
                success: false,
                error: 'Gateway Error',
                message: `No se pudo consultar contratos desde la base de datos PostgreSQL: ${error.message}`
            });
        }
    }
    /**
     * Consulta de un contrato específico por ID
     */
    static async getContractById(req, res) {
        try {
            const id = encodeURIComponent(req.params.id);
            const url = `${INVENTORY_API_URL}/contracts/${id}`;
            const response = await axios_1.default.get(url, {
                timeout: 10000,
                validateStatus: () => true,
                headers: {
                    Accept: 'application/json'
                }
            });
            res.status(response.status).json(response.data);
        }
        catch (error) {
            console.error(`[ContractsController ❌] Error al consultar contrato ${req.params.id}:`, error.message);
            res.status(502).json({
                success: false,
                error: 'Gateway Error',
                message: error.message
            });
        }
    }
    /**
     * Sincronización en segundo plano con Wispro (POST /api/wispro/sync)
     */
    static async syncWispro(req, res) {
        try {
            const query = req.originalUrl.includes('?') ? req.originalUrl.split('?')[1] : '';
            const url = `${INVENTORY_API_URL}/wispro/sync${query ? '?' + query : ''}`;
            const response = await axios_1.default.post(url, req.body || {}, {
                timeout: 10000,
                validateStatus: () => true,
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                }
            });
            res.status(response.status).json(response.data);
        }
        catch (error) {
            console.error('[ContractsController ❌] Error conectando con endpoint de sincronización:', error.message);
            res.status(502).json({
                success: false,
                error: 'Gateway Error',
                message: `No se pudo iniciar sincronización en el servicio de inventario: ${error.message}`
            });
        }
    }
}
exports.ContractsController = ContractsController;
