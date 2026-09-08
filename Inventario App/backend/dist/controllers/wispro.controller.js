"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WisproController = void 0;
const wispro_service_1 = require("../services/wispro.service");
class WisproController {
    /**
     * Endpoint de Sincronización REST con Wispro
     * POST /api/wispro/sync
     */
    static async syncWispro(req, res) {
        try {
            console.log('[WisproController] Recibida solicitud POST /api/wispro/sync');
            const result = await wispro_service_1.WisproService.syncActiveContracts();
            res.status(200).json(result);
        }
        catch (error) {
            console.error('Error en sincronización con Wispro:', error);
            res.status(500).json({
                success: false,
                error: 'Error al sincronizar con Wispro',
                details: error.message
            });
        }
    }
    /**
     * Obtiene la lista de contratos activos desde Wispro REST API
     * GET /api/wispro/contracts/active
     */
    static async getActiveContracts(req, res) {
        try {
            const page = req.query.page ? Number(req.query.page) : undefined;
            const perPage = req.query.per_page || req.query.limit ? Number(req.query.per_page || req.query.limit) : undefined;
            const loadAll = req.query.all === 'true' || req.query.loadAll === 'true' || (!req.query.page && !req.query.per_page);
            const forceRefresh = req.query.forceRefresh === 'true' || req.query.refresh === 'true';
            const result = await wispro_service_1.WisproService.fetchActiveContracts({ page, perPage, loadAll, forceRefresh });
            res.status(200).json({
                success: true,
                count: result.contracts ? result.contracts.length : (Array.isArray(result) ? result.length : 0),
                total: result.total || (result.contracts ? result.contracts.length : (Array.isArray(result) ? result.length : 0)),
                page: result.page || 1,
                perPage: result.perPage || 100,
                totalPages: result.totalPages || 1,
                contracts: result.contracts || result
            });
        }
        catch (error) {
            console.error('Error obteniendo contratos de Wispro:', error);
            res.status(500).json({
                success: false,
                error: 'Error al consultar contratos',
                details: error.message
            });
        }
    }
    /**
     * Obtiene el detalle de un contrato específico
     * GET /api/wispro/contracts/:id
     */
    static async getContractDetails(req, res) {
        try {
            const id = String(req.params.id);
            const contract = await wispro_service_1.WisproService.fetchContractDetails(id);
            if (!contract) {
                res.status(404).json({
                    success: false,
                    error: `Contrato ${id} no encontrado`
                });
                return;
            }
            res.status(200).json({
                success: true,
                contract
            });
        }
        catch (error) {
            console.error('Error obteniendo detalle de contrato:', error);
            res.status(500).json({
                success: false,
                error: 'Error al consultar contrato',
                details: error.message
            });
        }
    }
    /**
     * Obtiene los tickets abiertos enriquecidos con técnicos y vehículos de Prisma
     * GET /api/wispro/tickets/open
     */
    static async getOpenTickets(req, res) {
        try {
            const tickets = await wispro_service_1.WisproService.fetchOpenTickets();
            res.status(200).json({
                success: true,
                count: tickets.length,
                tickets
            });
        }
        catch (error) {
            console.error('Error obteniendo tickets de Wispro:', error);
            res.status(500).json({
                success: false,
                error: 'Error al consultar tickets abiertos',
                details: error.message
            });
        }
    }
    /**
     * Obtiene las instalaciones pendientes enriquecidas con Prisma
     * GET /api/wispro/installations/pending
     */
    static async getPendingInstallations(req, res) {
        try {
            const installations = await wispro_service_1.WisproService.fetchPendingInstallations();
            res.status(200).json({
                success: true,
                count: installations.length,
                installations
            });
        }
        catch (error) {
            console.error('Error obteniendo instalaciones de Wispro:', error);
            res.status(500).json({
                success: false,
                error: 'Error al consultar instalaciones pendientes',
                details: error.message
            });
        }
    }
    /**
     * Endpoint de Asignación Bidireccional (Drag & Drop)
     * PUT /api/wispro/assign
     */
    static async assignTicket(req, res) {
        try {
            const { ticketId, contractId, type = 'TICKET', technicianId } = req.body;
            const targetId = ticketId || contractId;
            if (!targetId || !technicianId) {
                res.status(400).json({
                    success: false,
                    error: 'ticketId y technicianId son obligatorios'
                });
                return;
            }
            const result = await wispro_service_1.WisproService.assignTicket({
                ticketId: targetId,
                type,
                technicianId
            });
            res.status(200).json(result);
        }
        catch (error) {
            console.error('Error asignando ticket en Wispro:', error);
            res.status(500).json({
                success: false,
                error: 'Error al asignar el ticket',
                details: error.message
            });
        }
    }
}
exports.WisproController = WisproController;
