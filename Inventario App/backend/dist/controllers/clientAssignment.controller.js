"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssignmentController = exports.ClientAssignmentController = void 0;
const db_1 = require("../db");
const client_1 = require("@prisma/client");
const inventory_service_1 = require("../services/inventory.service");
/**
 * Resuelve el usuario responsable para auditoría y asignaciones.
 */
async function resolveResponsibleUser(req) {
    const authUser = req.user;
    const activeUserId = authUser?.id || req.headers['x-user-id'] || null;
    if (activeUserId) {
        const existing = await db_1.prisma.user.findUnique({ where: { id: activeUserId } });
        if (existing)
            return existing;
        if (authUser && authUser.id) {
            try {
                return await db_1.prisma.user.upsert({
                    where: { id: authUser.id },
                    update: {},
                    create: {
                        id: authUser.id,
                        name: authUser.name || 'Administrador Velocity',
                        email: authUser.email || `user_${authUser.id.slice(0, 8)}@velocity.com`,
                        role: client_1.Role.SUPERADMIN
                    }
                });
            }
            catch (err) {
                console.warn('[resolveResponsibleUser] Upsert omitido:', err);
            }
        }
    }
    const admin = await db_1.prisma.user.findFirst({ where: { role: client_1.Role.SUPERADMIN } }) || await db_1.prisma.user.findFirst();
    if (admin)
        return admin;
    return await db_1.prisma.user.create({
        data: {
            name: 'Administrador del Sistema',
            email: 'admin@velocity.com',
            role: client_1.Role.SUPERADMIN
        }
    });
}
class ClientAssignmentController {
    /**
     * POST /api/assignments
     * Asignación multi-equipo de inventario físico a un contrato Wispro.
     * Recibe: wisproContractId, clientName, technicianId, nodeId, notes, serializedItemIds (o itemIds).
     * Crea o actualiza el registro en ClientAssignment, actualiza cada SerializedItem a INSTALADO_CLIENTE
     * y genera registros forenses de AuditLog.
     */
    static async createAssignment(req, res) {
        try {
            const { wisproContractId, clientName, nodeId, technicianId, notes } = req.body;
            const rawItems = req.body.serializedItemIds || req.body.itemIds || [];
            const itemIds = Array.isArray(rawItems) ? rawItems.map(String) : [];
            if (!wisproContractId || !clientName) {
                res.status(400).json({ success: false, error: 'wisproContractId y clientName son requeridos' });
                return;
            }
            if (itemIds.length === 0) {
                res.status(400).json({ success: false, error: 'Debe especificar al menos un equipo en serializedItemIds o itemIds' });
                return;
            }
            const responsibleUser = await resolveResponsibleUser(req);
            const cleanContractId = String(wisproContractId).trim();
            const cleanClientName = String(clientName).trim();
            // Determinar nodeId responsable: si no se especifica, tomar del nodo asignado al usuario o la bodega del primer equipo
            let targetNodeId = nodeId;
            if (!targetNodeId) {
                const userNode = req.user?.assignedNodeId;
                if (userNode) {
                    targetNodeId = userNode;
                }
                else {
                    const firstItem = await db_1.prisma.serializedItem.findUnique({
                        where: { id: itemIds[0] },
                        select: { currentWarehouseId: true }
                    });
                    targetNodeId = firstItem?.currentWarehouseId;
                }
            }
            if (!targetNodeId) {
                const defaultWh = await db_1.prisma.warehouse.findFirst();
                if (!defaultWh) {
                    res.status(400).json({ success: false, error: 'No se encontró una bodega o nodo logístico para la asignación' });
                    return;
                }
                targetNodeId = defaultWh.id;
            }
            // Validar que los items existan y estén disponibles
            const itemsToAssign = await db_1.prisma.serializedItem.findMany({
                where: { id: { in: itemIds } },
                include: { product: true }
            });
            if (itemsToAssign.length !== itemIds.length) {
                const foundIds = new Set(itemsToAssign.map(i => i.id));
                const missing = itemIds.filter(id => !foundIds.has(id));
                res.status(404).json({ success: false, error: `Los siguientes equipos no existen: ${missing.join(', ')}` });
                return;
            }
            // Verificar estados de los equipos
            const unavailable = itemsToAssign.filter(i => i.status === client_1.SerializedStatus.INSTALADO_CLIENTE || i.status === client_1.SerializedStatus.EN_TRANSITO);
            if (unavailable.length > 0) {
                const details = unavailable.map(i => `${i.serialNumber} (${i.status})`).join(', ');
                res.status(400).json({
                    success: false,
                    error: `Los siguientes equipos no están disponibles para instalación: ${details}`
                });
                return;
            }
            // Ejecutar asignación transaccional
            const result = await db_1.prisma.$transaction(async (tx) => {
                // 1. Buscar si ya existe una asignación activa para este contrato o crear una nueva
                let assignment = await tx.clientAssignment.findFirst({
                    where: {
                        wisproContractId: cleanContractId,
                        status: 'ACTIVO'
                    }
                });
                if (assignment) {
                    assignment = await tx.clientAssignment.update({
                        where: { id: assignment.id },
                        data: {
                            clientName: cleanClientName,
                            ...(technicianId ? { technicianId } : {}),
                            ...(nodeId ? { nodeId: targetNodeId } : {}),
                            ...(notes ? { notes: assignment.notes ? `${assignment.notes} | ${notes}` : notes } : {})
                        }
                    });
                }
                else {
                    assignment = await tx.clientAssignment.create({
                        data: {
                            wisproContractId: cleanContractId,
                            clientName: cleanClientName,
                            nodeId: targetNodeId,
                            technicianId: technicianId || responsibleUser.id,
                            notes: notes || null,
                            status: 'ACTIVO'
                        }
                    });
                }
                // 2. Actualizar cada SerializedItem y registrar auditoría forense
                const updatedItems = [];
                for (const item of itemsToAssign) {
                    const updated = await tx.serializedItem.update({
                        where: { id: item.id },
                        data: {
                            clientAssignmentId: assignment.id,
                            status: client_1.SerializedStatus.INSTALADO_CLIENTE,
                            installedContractId: cleanContractId,
                            installedClientName: cleanClientName,
                            installedDate: new Date(),
                            notes: notes ? `${item.notes ? item.notes + ' | ' : ''}Asignado contrato #${cleanContractId}: ${notes}` : item.notes
                        },
                        include: { product: true }
                    });
                    updatedItems.push(updated);
                    await tx.auditLog.create({
                        data: {
                            macAddress: item.macAddress,
                            serialNumber: item.serialNumber,
                            eventType: client_1.AuditEventType.INSTALACION_CLIENTE,
                            fromWarehouseId: item.currentWarehouseId,
                            userId: responsibleUser.id,
                            details: `Asignación multi-equipo a cliente ${cleanClientName} (Contrato #${cleanContractId}) - Equipo: ${item.product.name} S/N: ${item.serialNumber}`
                        }
                    });
                }
                // 3. Si algún equipo es ONT/ONU, sincronizar la MAC en WisproClient local si existe
                const ontItem = itemsToAssign.find(i => i.product.category === 'ONU_ONT' || i.macAddress);
                if (ontItem && ontItem.macAddress) {
                    await tx.wisproClient.updateMany({
                        where: { contractId: cleanContractId },
                        data: { currentOnuMac: ontItem.macAddress }
                    });
                }
                return { assignment, updatedItems };
            });
            // Invalidar cache de dashboard y stock
            await inventory_service_1.inventoryService.invalidateDashboardCache();
            res.status(201).json({
                success: true,
                message: `Se asignaron exitosamente ${result.updatedItems.length} equipos al contrato #${cleanContractId}`,
                assignment: {
                    ...result.assignment,
                    items: result.updatedItems
                }
            });
        }
        catch (error) {
            console.error('[ClientAssignmentController.createAssignment] Error:', error);
            res.status(500).json({ success: false, error: 'Error al asignar equipos al contrato', details: error.message });
        }
    }
    /**
     * GET /api/assignments/contract/:wisproContractId
     * Devuelve el historial y la ficha completa de equipos físicos (ONUs, TV Boxes, Cámaras, Mesh) instalados.
     */
    static async getContractAssignment(req, res) {
        try {
            const contractId = req.params.wisproContractId || req.params.contractId;
            if (!contractId) {
                res.status(400).json({ success: false, error: 'wisproContractId es requerido' });
                return;
            }
            const cleanContractId = String(contractId).trim();
            // Buscar asignaciones registradas para este contrato
            const assignments = await db_1.prisma.clientAssignment.findMany({
                where: { wisproContractId: cleanContractId },
                orderBy: { createdAt: 'desc' },
                include: {
                    items: {
                        include: {
                            product: true,
                            currentWarehouse: { select: { id: true, name: true, code: true } }
                        }
                    },
                    node: { select: { id: true, name: true, code: true } },
                    technician: { select: { id: true, name: true } }
                }
            });
            // Buscar todos los SerializedItems actualmente instalados vinculados a este contrato
            const assignedItems = await db_1.prisma.serializedItem.findMany({
                where: {
                    OR: [
                        { installedContractId: cleanContractId, status: client_1.SerializedStatus.INSTALADO_CLIENTE },
                        { clientAssignment: { wisproContractId: cleanContractId } }
                    ]
                },
                include: {
                    product: true,
                    currentWarehouse: { select: { id: true, name: true, code: true } },
                    clientAssignment: true
                },
                orderBy: { updatedAt: 'desc' }
            });
            // Clasificación semántica de equipos instalados
            const categorized = {
                onus: assignedItems.filter(i => i.product.category === 'ONU_ONT'),
                tvBoxes: assignedItems.filter(i => i.product.category === 'TV_BOX_OTT'),
                cameras: assignedItems.filter(i => i.product.category === 'CAMARA_SEGURIDAD_IOT'),
                meshRouters: assignedItems.filter(i => i.product.category === 'ROUTER_WIFI' || i.product.category === 'REPETIDOR_MESH'),
                others: assignedItems.filter(i => !['ONU_ONT', 'TV_BOX_OTT', 'CAMARA_SEGURIDAD_IOT', 'ROUTER_WIFI', 'REPETIDOR_MESH'].includes(i.product.category))
            };
            res.json({
                success: true,
                wisproContractId: cleanContractId,
                contractId: cleanContractId,
                assignments,
                items: assignedItems,
                categorized
            });
        }
        catch (error) {
            console.error('[ClientAssignmentController.getContractAssignment] Error:', error);
            res.status(500).json({ success: false, error: 'Error al consultar equipos del contrato', details: error.message });
        }
    }
    /**
     * POST /api/assignments/unassign y POST /api/assignments/items/:itemId/unassign
     * Permite desvincular un equipo específico (ej. retiro de TV Box por baja de servicio o RMA)
     * cambiando el estado del ítem a RMA_DEFECTUOSO o EN_BODEGA.
     */
    static async unassignItem(req, res) {
        try {
            const itemId = String(req.body.itemId || req.body.serializedItemId || req.params.itemId || '').trim();
            const returnWarehouseId = req.body.returnWarehouseId ? String(req.body.returnWarehouseId) : undefined;
            const rawStatus = String(req.body.returnStatus || req.body.status || 'EN_BODEGA').toUpperCase();
            const notes = String(req.body.notes || req.body.reason || '');
            if (!itemId) {
                res.status(400).json({ success: false, error: 'itemId o serializedItemId es requerido' });
                return;
            }
            const item = await db_1.prisma.serializedItem.findUnique({
                where: { id: itemId },
                include: { product: true, clientAssignment: true }
            });
            if (!item) {
                res.status(404).json({ success: false, error: 'Equipo no encontrado' });
                return;
            }
            const responsibleUser = await resolveResponsibleUser(req);
            const destinationWarehouseId = returnWarehouseId || item.clientAssignment?.nodeId || item.currentWarehouseId;
            const newStatus = (rawStatus === 'CUARENTENA_RMA' || rawStatus === 'RMA_DEFECTUOSO' || rawStatus === 'RMA')
                ? client_1.SerializedStatus.RMA_DEFECTUOSO
                : client_1.SerializedStatus.EN_BODEGA;
            await db_1.prisma.$transaction(async (tx) => {
                // 1. Liberar el equipo
                await tx.serializedItem.update({
                    where: { id: itemId },
                    data: {
                        clientAssignmentId: null,
                        installedContractId: null,
                        installedClientName: null,
                        installedDate: null,
                        installedTicketId: null,
                        status: newStatus,
                        currentWarehouseId: destinationWarehouseId,
                        notes: notes ? `${item.notes ? item.notes + ' | ' : ''}Retiro cliente: ${notes}` : item.notes
                    }
                });
                // 2. Registrar auditoría forense
                await tx.auditLog.create({
                    data: {
                        macAddress: item.macAddress,
                        serialNumber: item.serialNumber,
                        eventType: client_1.AuditEventType.RETIRO_CLIENTE,
                        fromWarehouseId: item.currentWarehouseId,
                        toWarehouseId: destinationWarehouseId,
                        userId: responsibleUser.id,
                        details: `Equipo retirado de contrato #${item.installedContractId || item.clientAssignment?.wisproContractId || 'N/A'}. Motivo: ${notes || 'Retiro de servicio / cambio de equipo'}. Nuevo estado: ${newStatus}`
                    }
                });
                // 3. Si la asignación ya no tiene items activos, marcarla como FINALIZADO
                if (item.clientAssignmentId) {
                    const remaining = await tx.serializedItem.count({
                        where: {
                            clientAssignmentId: item.clientAssignmentId,
                            id: { not: itemId }
                        }
                    });
                    if (remaining === 0) {
                        await tx.clientAssignment.update({
                            where: { id: item.clientAssignmentId },
                            data: { status: 'FINALIZADO' }
                        });
                    }
                }
            });
            await inventory_service_1.inventoryService.invalidateDashboardCache();
            res.json({
                success: true,
                message: `Equipo ${item.serialNumber} desvinculado con éxito. Estado actual: ${newStatus}`
            });
        }
        catch (error) {
            console.error('[ClientAssignmentController.unassignItem] Error:', error);
            res.status(500).json({ success: false, error: 'Error al desvincular equipo', details: error.message });
        }
    }
    /**
     * GET /api/assignments
     * Listado paginado de asignaciones multi-equipo con filtros.
     */
    static async getAssignments(req, res) {
        try {
            const { page = '1', limit = '25', search = '', nodeId, contractId, technicianId, status } = req.query;
            const pageNum = Math.max(1, parseInt(page, 10) || 1);
            const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
            const skip = (pageNum - 1) * limitNum;
            const where = {};
            const user = req.user;
            if (user && user.role !== 'SUPERADMIN' && user.assignedNodeId) {
                where.nodeId = user.assignedNodeId;
            }
            else if (nodeId && nodeId !== 'all') {
                where.nodeId = nodeId;
            }
            if (status && status !== 'ALL') {
                where.status = status;
            }
            if (contractId) {
                where.wisproContractId = { contains: contractId, mode: 'insensitive' };
            }
            if (technicianId) {
                where.technicianId = technicianId;
            }
            if (search) {
                where.OR = [
                    { clientName: { contains: search, mode: 'insensitive' } },
                    { wisproContractId: { contains: search, mode: 'insensitive' } },
                    {
                        items: {
                            some: {
                                OR: [
                                    { serialNumber: { contains: search, mode: 'insensitive' } },
                                    { macAddress: { contains: search, mode: 'insensitive' } },
                                    { product: { name: { contains: search, mode: 'insensitive' } } }
                                ]
                            }
                        }
                    }
                ];
            }
            const [assignments, total] = await Promise.all([
                db_1.prisma.clientAssignment.findMany({
                    where,
                    skip,
                    take: limitNum,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        items: {
                            include: {
                                product: {
                                    select: {
                                        id: true,
                                        sku: true,
                                        name: true,
                                        brand: true,
                                        model: true,
                                        category: true
                                    }
                                }
                            }
                        },
                        node: {
                            select: { id: true, name: true, code: true, type: true }
                        },
                        technician: {
                            select: { id: true, name: true, email: true, role: true }
                        }
                    }
                }),
                db_1.prisma.clientAssignment.count({ where })
            ]);
            res.json({
                success: true,
                data: assignments,
                pagination: {
                    total,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil(total / limitNum)
                }
            });
        }
        catch (error) {
            console.error('[ClientAssignmentController.getAssignments] Error:', error);
            res.status(500).json({ success: false, error: 'Error al obtener asignaciones', details: error.message });
        }
    }
    /**
     * GET /api/assignments/available-items
     * Búsqueda en tiempo real de equipos serializados disponibles en bodegas/vehículos.
     */
    static async searchAvailableItems(req, res) {
        try {
            const search = req.query.search ? String(req.query.search) : '';
            const warehouseId = req.query.warehouseId ? String(req.query.warehouseId) : undefined;
            const category = req.query.category ? String(req.query.category) : undefined;
            const limit = req.query.limit ? String(req.query.limit) : '30';
            const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
            const where = {
                status: { in: [client_1.SerializedStatus.EN_BODEGA, client_1.SerializedStatus.EN_VEHICULO] }
            };
            if (warehouseId && warehouseId !== 'all') {
                where.currentWarehouseId = warehouseId;
            }
            if (category && category !== 'ALL') {
                where.product = { ...where.product, category: category };
            }
            if (search && search.trim().length > 0) {
                const query = search.trim();
                where.OR = [
                    { serialNumber: { contains: query, mode: 'insensitive' } },
                    { macAddress: { contains: query, mode: 'insensitive' } },
                    { product: { name: { contains: query, mode: 'insensitive' } } },
                    { product: { model: { contains: query, mode: 'insensitive' } } }
                ];
            }
            const items = await db_1.prisma.serializedItem.findMany({
                where,
                take: limitNum,
                orderBy: { updatedAt: 'desc' },
                include: {
                    product: {
                        select: {
                            id: true,
                            sku: true,
                            name: true,
                            brand: true,
                            model: true,
                            category: true
                        }
                    },
                    currentWarehouse: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                            type: true
                        }
                    }
                }
            });
            res.json({
                success: true,
                items
            });
        }
        catch (error) {
            console.error('[ClientAssignmentController.searchAvailableItems] Error:', error);
            res.status(500).json({ success: false, error: 'Error al buscar equipos disponibles', details: error.message });
        }
    }
}
exports.ClientAssignmentController = ClientAssignmentController;
exports.AssignmentController = ClientAssignmentController;
