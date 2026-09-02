"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryController = void 0;
const WisproService_1 = require("../services/WisproService");
class InventoryController {
    /**
     * GET /api/v1/inventory
     * Devuelve la lista completa de equipos con compresión Gzip, ETag y caché en RAM
     */
    static async getInventory(req, res) {
        try {
            const forceRefresh = req.query.force === 'true' || req.query.refresh === 'true';
            const { items, cached, timestamp } = await WisproService_1.wisproService.getInventory(forceRefresh);
            // ETag condicional basado en timestamp para responder 304 Not Modified si no hay cambios
            const etag = `W/"inv-${timestamp}-${items.length}"`;
            res.setHeader('ETag', etag);
            res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
            if (req.headers['if-none-match'] === etag && !forceRefresh) {
                res.status(304).end();
                return;
            }
            const responsePayload = {
                success: true,
                count: items.length,
                cached,
                timestamp: new Date(timestamp).toISOString(),
                data: items
            };
            res.status(200).json(responsePayload);
        }
        catch (error) {
            console.error('[InventoryController] Error al obtener inventario:', error.message || error);
            res.status(500).json({
                success: false,
                error: 'InternalServerError',
                message: 'No se pudo sincronizar el inventario de Wispro. Intente de nuevo más tarde.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
    /**
     * POST /api/v1/inventory/cache/clear
     */
    static async clearCache(_req, res) {
        try {
            WisproService_1.wisproService.clearCache();
            res.status(200).json({
                success: true,
                message: 'Caché de inventario invalidada correctamente'
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message || 'Error al invalidar caché'
            });
        }
    }
}
exports.InventoryController = InventoryController;
