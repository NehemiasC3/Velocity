"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkOrdersController = void 0;
const db_1 = require("../db");
const client_1 = require("@prisma/client");
const inventory_service_1 = require("../services/inventory.service");
// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
async function resolveUser(req) {
    const authUser = req.user;
    const uid = authUser?.id || req.headers['x-user-id'] || null;
    if (uid) {
        const u = await db_1.prisma.user.findUnique({ where: { id: uid } });
        if (u)
            return u;
    }
    const admin = (await db_1.prisma.user.findFirst({ where: { role: client_1.Role.SUPERADMIN } })) ||
        (await db_1.prisma.user.findFirst());
    if (admin)
        return admin;
    return db_1.prisma.user.create({
        data: {
            name: 'Administrador del Sistema',
            email: 'admin@velocity.com',
            role: client_1.Role.SUPERADMIN
        }
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// WorkOrdersController
// ─────────────────────────────────────────────────────────────────────────────
class WorkOrdersController {
    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/work-orders
    // Lista paginada de órdenes con filtros por tipo, estado y búsqueda libre.
    // ──────────────────────────────────────────────────────────────────────────
    static async list(req, res) {
        try {
            const { type, wisproSynced, search, technicianId, vehicleWarehouseId, page = '1', limit = '30' } = req.query;
            const pageNum = Math.max(1, parseInt(page, 10) || 1);
            const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
            const skip = (pageNum - 1) * limitNum;
            const where = {};
            if (type && type !== 'ALL') {
                where.type = type;
            }
            if (wisproSynced === 'true')
                where.wisproSynced = true;
            if (wisproSynced === 'false')
                where.wisproSynced = false;
            if (technicianId)
                where.technicianId = technicianId;
            if (vehicleWarehouseId)
                where.vehicleWarehouseId = vehicleWarehouseId;
            if (search && search.trim()) {
                const q = search.trim();
                where.OR = [
                    { ticketNumber: { contains: q, mode: 'insensitive' } },
                    { wisproClientName: { contains: q, mode: 'insensitive' } },
                    { wisproContractId: { contains: q, mode: 'insensitive' } },
                    { clientAddress: { contains: q, mode: 'insensitive' } },
                    { installedOnuMac: { contains: q, mode: 'insensitive' } },
                    { installedOnuSerial: { contains: q, mode: 'insensitive' } }
                ];
            }
            const [tickets, total] = await Promise.all([
                db_1.prisma.installationTicket.findMany({
                    where,
                    skip,
                    take: limitNum,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        technician: { select: { id: true, name: true, email: true, phone: true } },
                        vehicleWarehouse: { select: { id: true, name: true, code: true, type: true } }
                    }
                }),
                db_1.prisma.installationTicket.count({ where })
            ]);
            res.json({
                success: true,
                data: tickets,
                pagination: {
                    total,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil(total / limitNum)
                }
            });
        }
        catch (err) {
            console.error('[WorkOrders.list]', err);
            res.status(500).json({ success: false, error: err.message });
        }
    }
    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/work-orders/:id
    // Detalle de una orden. Si es BAJA_SERVICIO incluye checklist de retiro
    // (equipos activos asignados al contrato en ClientAssignment).
    // ──────────────────────────────────────────────────────────────────────────
    static async getOne(req, res) {
        try {
            const id = String(req.params.id);
            const ticket = await db_1.prisma.installationTicket.findUnique({
                where: { id },
                include: {
                    technician: { select: { id: true, name: true, email: true, phone: true } },
                    vehicleWarehouse: true
                }
            });
            if (!ticket) {
                res.status(404).json({ success: false, error: 'Orden no encontrada' });
                return;
            }
            // Checklist de retiro para BAJA_SERVICIO
            let retrievalChecklist = [];
            let contractAssignment = null;
            if (ticket.type === 'BAJA_SERVICIO' && ticket.wisproContractId) {
                const contractId = ticket.wisproContractId;
                // Equipos actualmente instalados en ese contrato
                retrievalChecklist = await db_1.prisma.serializedItem.findMany({
                    where: {
                        OR: [
                            { installedContractId: contractId, status: client_1.SerializedStatus.INSTALADO_CLIENTE },
                            {
                                clientAssignment: { wisproContractId: contractId },
                                status: client_1.SerializedStatus.INSTALADO_CLIENTE
                            }
                        ]
                    },
                    include: {
                        product: {
                            select: { id: true, name: true, brand: true, model: true, category: true }
                        },
                        currentWarehouse: { select: { id: true, name: true, code: true } }
                    },
                    orderBy: { updatedAt: 'desc' }
                });
                contractAssignment = await db_1.prisma.clientAssignment.findFirst({
                    where: { wisproContractId: contractId, status: 'ACTIVO' },
                    include: {
                        technician: { select: { id: true, name: true } },
                        node: { select: { id: true, name: true, code: true } }
                    }
                });
            }
            res.json({
                success: true,
                ticket,
                retrievalChecklist,
                contractAssignment,
                retrievalCount: retrievalChecklist.length
            });
        }
        catch (err) {
            console.error('[WorkOrders.getOne]', err);
            res.status(500).json({ success: false, error: err.message });
        }
    }
    // ──────────────────────────────────────────────────────────────────────────
    // POST /api/work-orders
    // Crea una nueva orden de trabajo.
    // ──────────────────────────────────────────────────────────────────────────
    static async create(req, res) {
        try {
            const { ticketNumber, type = 'INSTALACION_NUEVA', wisproClientId, wisproClientName, wisproContractId, wisproNode, clientAddress, technicianId, vehicleWarehouseId, installedOnuMac, installedOnuSerial, installedRouterMac, retiredDeviceMac, retiredDeviceStatus, notes } = req.body;
            if (!wisproContractId || !wisproClientName || !vehicleWarehouseId) {
                res.status(400).json({
                    success: false,
                    error: 'wisproContractId, wisproClientName y vehicleWarehouseId son requeridos'
                });
                return;
            }
            const responsibleUser = await resolveUser(req);
            const finalTechId = technicianId || responsibleUser.id;
            const vehicleWarehouse = await db_1.prisma.warehouse.findUnique({
                where: { id: vehicleWarehouseId }
            });
            if (!vehicleWarehouse) {
                res.status(404).json({ success: false, error: 'Bodega vehicular no encontrada' });
                return;
            }
            const finalTicketNumber = ticketNumber || `WO-${type.slice(0, 3)}-${Date.now().toString().slice(-6)}`;
            const ticket = await db_1.prisma.installationTicket.create({
                data: {
                    ticketNumber: finalTicketNumber,
                    type: type,
                    wisproClientId: wisproClientId || `WISP-${Date.now().toString().slice(-8)}`,
                    wisproClientName,
                    wisproContractId,
                    wisproNode: wisproNode || null,
                    clientAddress: clientAddress || vehicleWarehouse.address || 'Panamá',
                    technicianId: finalTechId,
                    vehicleWarehouseId,
                    installedOnuMac: installedOnuMac || null,
                    installedOnuSerial: installedOnuSerial || null,
                    installedRouterMac: installedRouterMac || null,
                    retiredDeviceMac: retiredDeviceMac || null,
                    retiredDeviceStatus: retiredDeviceStatus
                        ? retiredDeviceStatus
                        : null,
                    notes: notes || null,
                    wisproSynced: false,
                    wisproSyncMessage: 'Orden creada — pendiente de completar'
                },
                include: {
                    technician: { select: { id: true, name: true, email: true } },
                    vehicleWarehouse: { select: { id: true, name: true, code: true } }
                }
            });
            res.status(201).json({
                success: true,
                message: `Orden de trabajo ${ticket.ticketNumber} creada`,
                ticket
            });
        }
        catch (err) {
            console.error('[WorkOrders.create]', err);
            res.status(500).json({ success: false, error: err.message });
        }
    }
    // ──────────────────────────────────────────────────────────────────────────
    // POST /api/work-orders/:id/complete
    //
    // Completa la orden.  Para BAJA_SERVICIO ejecuta el flujo completo:
    //   1. Busca todos los SerializedItems INSTALADO_CLIENTE del contrato.
    //   2. En una sola transacción:
    //      a. Actualiza cada ítem a EN_VEHICULO (o CUARENTENA_RMA si marcado).
    //      b. Limpia clientAssignmentId / installedContractId.
    //      c. Marca el ClientAssignment como FINALIZADO.
    //      d. Crea AuditLog RETIRO_POR_CANCELACION por cada ítem.
    //   3. Actualiza el ticket con wisproSynced = true.
    // ──────────────────────────────────────────────────────────────────────────
    static async complete(req, res) {
        try {
            const id = String(req.params.id);
            const { 
            // Permite marcar dispositivos individuales como defectuosos al retirar
            defectiveItemIds = [], 
            // Bodega destino de los equipos retirados (vehicleWarehouseId del técnico por defecto)
            returnWarehouseId, notes } = req.body;
            const ticket = await db_1.prisma.installationTicket.findUnique({
                where: { id },
                include: { vehicleWarehouse: true }
            });
            if (!ticket) {
                res.status(404).json({ success: false, error: 'Orden no encontrada' });
                return;
            }
            const responsibleUser = await resolveUser(req);
            const destWarehouseId = returnWarehouseId || ticket.vehicleWarehouseId;
            // ── Flujo BAJA_SERVICIO ────────────────────────────────────────────────
            if (ticket.type === 'BAJA_SERVICIO') {
                const contractId = ticket.wisproContractId;
                // Todos los ítems instalados en este contrato
                const installedItems = await db_1.prisma.serializedItem.findMany({
                    where: {
                        status: client_1.SerializedStatus.INSTALADO_CLIENTE,
                        OR: [
                            { installedContractId: contractId },
                            { clientAssignment: { wisproContractId: contractId } }
                        ]
                    },
                    include: { product: true, clientAssignment: true }
                });
                const defectiveSet = new Set(Array.isArray(defectiveItemIds) ? defectiveItemIds.map(String) : []);
                await db_1.prisma.$transaction(async (tx) => {
                    for (const item of installedItems) {
                        const isDefective = defectiveSet.has(item.id);
                        const newStatus = isDefective
                            ? client_1.SerializedStatus.RMA_DEFECTUOSO
                            : client_1.SerializedStatus.EN_VEHICULO;
                        // a. Actualizar estado del equipo
                        await tx.serializedItem.update({
                            where: { id: item.id },
                            data: {
                                status: newStatus,
                                currentWarehouseId: destWarehouseId,
                                clientAssignmentId: null,
                                installedContractId: null,
                                installedClientName: null,
                                installedClientId: null,
                                installedDate: null,
                                installedTicketId: null,
                                notes: notes
                                    ? `${item.notes ? item.notes + ' | ' : ''}Retiro BAJA_SERVICIO: ${notes}`
                                    : item.notes
                            }
                        });
                        // b. Auditoría forense RETIRO_POR_CANCELACION
                        await tx.auditLog.create({
                            data: {
                                macAddress: item.macAddress,
                                serialNumber: item.serialNumber,
                                eventType: client_1.AuditEventType.RETIRO_POR_CANCELACION,
                                fromWarehouseId: item.currentWarehouseId,
                                toWarehouseId: destWarehouseId,
                                userId: responsibleUser.id,
                                details: `Retiro por cancelación de servicio. Contrato: ${contractId} | Cliente: ${ticket.wisproClientName} | Equipo: ${item.product?.name || 'N/A'} S/N: ${item.serialNumber || ''} MAC: ${item.macAddress || ''} | Nuevo estado: ${newStatus} | Ticket: ${ticket.ticketNumber}`
                            }
                        });
                    }
                    // c. Marcar ClientAssignment(s) del contrato como FINALIZADO
                    await tx.clientAssignment.updateMany({
                        where: { wisproContractId: contractId, status: 'ACTIVO' },
                        data: { status: 'FINALIZADO' }
                    });
                    // d. Actualizar el ticket
                    await tx.installationTicket.update({
                        where: { id: ticket.id },
                        data: {
                            wisproSynced: true,
                            wisproSyncMessage: `Baja completada. ${installedItems.length} equipos retirados. ${notes || ''}`.trim()
                        }
                    });
                });
                inventory_service_1.inventoryService.invalidateDashboardCache();
                const summary = {
                    totalRetrieved: installedItems.length,
                    movedToVehicle: installedItems.filter((i) => !defectiveSet.has(i.id)).length,
                    movedToRMA: defectiveSet.size
                };
                res.json({
                    success: true,
                    message: `Baja de servicio completada. ${summary.totalRetrieved} equipos retirados del cliente ${ticket.wisproClientName}.`,
                    summary,
                    contractId
                });
                return;
            }
            // ── Flujo genérico (INSTALACION_NUEVA, MANTENIMIENTO_RMA, etc.) ────────
            await db_1.prisma.installationTicket.update({
                where: { id: ticket.id },
                data: {
                    wisproSynced: true,
                    wisproSyncMessage: notes || 'Orden completada'
                }
            });
            inventory_service_1.inventoryService.invalidateDashboardCache();
            res.json({
                success: true,
                message: `Orden ${ticket.ticketNumber} marcada como completada.`
            });
        }
        catch (err) {
            console.error('[WorkOrders.complete]', err);
            res.status(500).json({ success: false, error: err.message });
        }
    }
    // ──────────────────────────────────────────────────────────────────────────
    // PATCH /api/work-orders/:id/status
    // Actualización ligera de notas / wisproSyncMessage.
    // ──────────────────────────────────────────────────────────────────────────
    static async updateStatus(req, res) {
        try {
            const id = String(req.params.id);
            const { notes, wisproSynced, wisproSyncMessage } = req.body;
            const ticket = await db_1.prisma.installationTicket.findUnique({ where: { id } });
            if (!ticket) {
                res.status(404).json({ success: false, error: 'Orden no encontrada' });
                return;
            }
            const updated = await db_1.prisma.installationTicket.update({
                where: { id },
                data: {
                    ...(notes !== undefined ? { notes } : {}),
                    ...(wisproSynced !== undefined ? { wisproSynced: Boolean(wisproSynced) } : {}),
                    ...(wisproSyncMessage !== undefined ? { wisproSyncMessage } : {})
                },
                include: {
                    technician: { select: { id: true, name: true } },
                    vehicleWarehouse: { select: { id: true, name: true } }
                }
            });
            res.json({ success: true, ticket: updated });
        }
        catch (err) {
            console.error('[WorkOrders.updateStatus]', err);
            res.status(500).json({ success: false, error: err.message });
        }
    }
    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/work-orders/contract/:contractId/checklist
    // Checklist de retiro en tiempo real para un contrato dado.
    // Útil para refrescar la lista antes de completar sin recargar toda la orden.
    // ──────────────────────────────────────────────────────────────────────────
    static async retrievalChecklist(req, res) {
        try {
            const contractId = String(req.params.contractId);
            if (!contractId) {
                res.status(400).json({ success: false, error: 'contractId requerido' });
                return;
            }
            const items = await db_1.prisma.serializedItem.findMany({
                where: {
                    status: client_1.SerializedStatus.INSTALADO_CLIENTE,
                    OR: [
                        { installedContractId: contractId },
                        { clientAssignment: { wisproContractId: contractId } }
                    ]
                },
                include: {
                    product: {
                        select: { id: true, name: true, brand: true, model: true, category: true }
                    },
                    currentWarehouse: { select: { id: true, name: true, code: true } }
                },
                orderBy: { updatedAt: 'desc' }
            });
            const assignment = await db_1.prisma.clientAssignment.findFirst({
                where: { wisproContractId: contractId, status: 'ACTIVO' },
                include: {
                    technician: { select: { id: true, name: true } },
                    node: { select: { id: true, name: true } }
                }
            });
            res.json({
                success: true,
                contractId,
                retrievalCount: items.length,
                items,
                assignment
            });
        }
        catch (err) {
            console.error('[WorkOrders.retrievalChecklist]', err);
            res.status(500).json({ success: false, error: err.message });
        }
    }
}
exports.WorkOrdersController = WorkOrdersController;
