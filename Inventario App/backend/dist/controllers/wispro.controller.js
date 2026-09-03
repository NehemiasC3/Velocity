"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WisproController = void 0;
const wispro_service_1 = require("../services/wispro.service");
class WisproController {
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
