"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkOrdersController = void 0;
const db_1 = require("../db");
const client_1 = require("@prisma/client");
const inventory_service_1 = require("../services/inventory.service");
const wispro_service_1 = require("../services/wispro.service");
// ─────────────────────────────────────────────────────────────────────────────
// Filtro y clasificación de tickets Wispro → 4 tipos de la Mesa
// ─────────────────────────────────────────────────────────────────────────────
const WISPRO_TICKET_TYPE_MAP = {
    'visita tecnica': 'MANTENIMIENTO_RMA',
    'visita técnica': 'MANTENIMIENTO_RMA',
    'support': 'MANTENIMIENTO_RMA',
    'soporte': 'MANTENIMIENTO_RMA',
    'tecnica': 'MANTENIMIENTO_RMA',
    'technical': 'MANTENIMIENTO_RMA',
    'instalacion': 'INSTALACION_NUEVA',
    'instalación': 'INSTALACION_NUEVA',
    'installation': 'INSTALACION_NUEVA',
    'alta': 'INSTALACION_NUEVA',
    'factibilidad': 'CAMBIO_EQUIPO',
    'feasibility': 'CAMBIO_EQUIPO',
    'baja': 'BAJA_SERVICIO',
    'baja de servicio': 'BAJA_SERVICIO',
    'cancellation': 'BAJA_SERVICIO',
    'cancelacion': 'BAJA_SERVICIO',
    'cancelación': 'BAJA_SERVICIO',
};
const DISPATCH_TYPE_LABELS = {
    MANTENIMIENTO_RMA: 'Visita Técnica',
    INSTALACION_NUEVA: 'Instalación',
    CAMBIO_EQUIPO: 'Factibilidad',
    BAJA_SERVICIO: 'Baja de Servicio',
};
const ALLOWED_DISPATCH_TYPES = new Set([
    'MANTENIMIENTO_RMA',
    'INSTALACION_NUEVA',
    'CAMBIO_EQUIPO',
    'BAJA_SERVICIO',
]);
function classifyWisproTicket(raw) {
    const kind = String(raw.kind || raw.type || raw.category || '').toLowerCase().trim();
    if (kind && WISPRO_TICKET_TYPE_MAP[kind])
        return WISPRO_TICKET_TYPE_MAP[kind];
    const subject = String(raw.subject || raw.title || raw.description || '').toLowerCase();
    for (const [keyword, type] of Object.entries(WISPRO_TICKET_TYPE_MAP)) {
        if (subject.includes(keyword))
            return type;
    }
    return null;
}
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
        data: { name: 'Administrador del Sistema', email: 'admin@velocity.com', role: client_1.Role.SUPERADMIN }
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// WorkOrdersController
// ─────────────────────────────────────────────────────────────────────────────
class WorkOrdersController {
    // GET /api/work-orders
    static async list(req, res) {
        try {
            const { type, wisproSynced, search, technicianId, vehicleWarehouseId, page = '1', limit = '30' } = req.query;
            const pageNum = Math.max(1, parseInt(page, 10) || 1);
            const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
            const skip = (pageNum - 1) * limitNum;
            const where = {};
            if (type && type !== 'ALL')
                where.type = type;
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
                    { installedOnuSerial: { contains: q, mode: 'insensitive' } },
                ];
            }
            const [tickets, total] = await Promise.all([
                db_1.prisma.installationTicket.findMany({
                    where, skip, take: limitNum, orderBy: { createdAt: 'desc' },
                    include: {
                        technician: { select: { id: true, name: true, email: true, phone: true } },
                        vehicleWarehouse: { select: { id: true, name: true, code: true, type: true } },
                    },
                }),
                db_1.prisma.installationTicket.count({ where }),
            ]);
            res.json({ success: true, data: tickets, pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } });
        }
        catch (err) {
            console.error('[WorkOrders.list]', err);
            res.status(500).json({ success: false, error: err.message });
        }
    }
    // GET /api/work-orders/dispatch
    // Vista de Despacho: tickets Wispro filtrados por 4 tipos, agrupados por tecnico
    static async dispatch(req, res) {
        try {
            const { date, typeFilter } = req.query;
            const technicians = await db_1.prisma.user.findMany({
                where: { role: { in: ['TECNICO', 'SUPERVISOR_MESA'] } },
                include: {
                    managedWarehouses: {
                        where: { type: client_1.WarehouseType.VEHICULO },
                        include: {
                            batchItems: {
                                where: { status: client_1.BatchStatus.DISPONIBLE },
                                include: { product: { select: { name: true, category: true } } },
                                orderBy: { currentQuantity: 'desc' },
                            },
                            bulkStocks: {
                                where: { quantity: { gt: 0 } },
                                include: { product: { select: { name: true, category: true } } },
                            },
                            serializedItems: {
                                where: { status: client_1.SerializedStatus.EN_VEHICULO },
                                include: { product: { select: { name: true, category: true } } },
                            },
                        },
                    },
                },
                orderBy: { name: 'asc' },
            });
            let rawTickets = [];
            try {
                rawTickets = await wispro_service_1.WisproService.fetchOpenTickets();
            }
            catch (err) {
                console.warn('[WorkOrders.dispatch] Wispro unavailable:', err.message);
            }
            const localPendingWhere = {
                wisproSynced: false,
                type: { in: Array.from(ALLOWED_DISPATCH_TYPES) },
            };
            if (date) {
                const d = new Date(date);
                const next = new Date(d);
                next.setDate(next.getDate() + 1);
                localPendingWhere.createdAt = { gte: d, lt: next };
            }
            const localOrders = await db_1.prisma.installationTicket.findMany({
                where: localPendingWhere,
                include: {
                    technician: { select: { id: true, name: true, email: true, phone: true } },
                    vehicleWarehouse: { select: { id: true, name: true, code: true } },
                },
                orderBy: { createdAt: 'desc' },
            });
            const wisproOrders = [];
            for (const raw of rawTickets) {
                const orderType = classifyWisproTicket(raw);
                if (!orderType || !ALLOWED_DISPATCH_TYPES.has(orderType))
                    continue;
                const alreadyLocal = localOrders.some(lo => lo.ticketNumber === String(raw.id || raw.ticketNumber || ''));
                if (alreadyLocal)
                    continue;
                if (typeFilter && typeFilter !== 'ALL' && orderType !== typeFilter)
                    continue;
                wisproOrders.push({
                    id: `wispro-${raw.id}`,
                    ticketNumber: raw.ticketNumber || String(raw.id),
                    type: orderType,
                    typeLabel: DISPATCH_TYPE_LABELS[orderType],
                    wisproClientName: raw.clientName || raw.title || 'Cliente',
                    wisproContractId: raw.contractId || '',
                    clientAddress: raw.clientAddress || 'Sin dirección',
                    wisproNode: raw.node || raw.zone || '',
                    technicianId: raw.assignedToId || null,
                    technician: raw.technician || null,
                    vehicleWarehouseId: raw.technician?.vehicleWarehouseId || null,
                    wisproSynced: false,
                    status: 'PENDIENTE',
                    source: 'WISPRO',
                    scheduledDate: raw.scheduledDate || raw.createdAt,
                    createdAt: raw.createdAt || new Date().toISOString(),
                });
            }
            const allOrders = [
                ...localOrders.map(lo => ({
                    ...lo,
                    typeLabel: DISPATCH_TYPE_LABELS[lo.type] || lo.type,
                    source: 'LOCAL',
                    status: lo.wisproSynced ? 'COMPLETADA' : 'PENDIENTE',
                    scheduledDate: lo.createdAt,
                })),
                ...wisproOrders,
            ];
            const techMap = new Map();
            for (const tech of technicians) {
                const vehicle = tech.managedWarehouses[0] || null;
                techMap.set(tech.id, {
                    technician: { id: tech.id, name: tech.name, email: tech.email, phone: tech.phone, role: tech.role },
                    vehicle: vehicle ? {
                        id: vehicle.id, name: vehicle.name, code: vehicle.code,
                        vehiclePlate: vehicle.vehiclePlate,
                        serializedCount: vehicle.serializedItems?.length || 0,
                        batchSummary: vehicle.batchItems?.map((b) => ({
                            id: b.id,
                            productName: b.product?.name, currentQuantity: b.currentQuantity,
                            batchNumber: b.batchNumber, unitOfMeasure: b.unitOfMeasure,
                        })) || [],
                        bulkSummary: vehicle.bulkStocks?.map((bs) => ({
                            productId: bs.productId,
                            productName: bs.product?.name, quantity: bs.quantity,
                        })) || [],
                    } : null,
                    orders: [],
                    zones: [],
                    scheduledDate: date || new Date().toISOString().split('T')[0],
                    stats: { total: 0, instalaciones: 0, visitas: 0, factibilidades: 0, bajas: 0 },
                });
            }
            const unassigned = [];
            for (const order of allOrders) {
                const techId = order.technicianId;
                if (techId && techMap.has(techId)) {
                    const g = techMap.get(techId);
                    g.orders.push(order);
                    g.stats.total++;
                    if (order.type === 'INSTALACION_NUEVA')
                        g.stats.instalaciones++;
                    else if (order.type === 'MANTENIMIENTO_RMA')
                        g.stats.visitas++;
                    else if (order.type === 'CAMBIO_EQUIPO')
                        g.stats.factibilidades++;
                    else if (order.type === 'BAJA_SERVICIO')
                        g.stats.bajas++;
                    const zoneName = order.wisproNode || order.clientAddress;
                    if (zoneName && !g.zones.includes(zoneName)) {
                        g.zones.push(zoneName);
                    }
                }
                else {
                    unassigned.push(order);
                }
            }
            const groups = Array.from(techMap.values());
            res.json({
                success: true, groups, unassigned, totalOrders: allOrders.length,
                allowedTypes: Array.from(ALLOWED_DISPATCH_TYPES).map(t => ({ value: t, label: DISPATCH_TYPE_LABELS[t] })),
            });
        }
        catch (err) {
            console.error('[WorkOrders.dispatch]', err);
            res.status(500).json({ success: false, error: err.message });
        }
    }
    // POST /api/work-orders/:id/liquidate
    // Transaccion atomica: serial del vehiculo + cable + granel + auditoria + Wispro binding
    static async liquidate(req, res) {
        try {
            const orderId = String(req.params.id);
            const { serialNumber, macAddress, batchUsage, bulkUsage, notes } = req.body;
            let ticket = await db_1.prisma.installationTicket.findFirst({
                where: {
                    OR: [
                        { id: orderId },
                        { ticketNumber: orderId.replace('wispro-', '') }
                    ]
                },
                include: { technician: true, vehicleWarehouse: true },
            });
            // Si la orden viene de Wispro y aun no esta persistida en la DB local, la creamos
            if (!ticket && orderId.startsWith('wispro-')) {
                const rawTickets = await wispro_service_1.WisproService.fetchOpenTickets();
                const rawT = rawTickets.find(r => `wispro-${r.id}` === orderId || r.id === orderId.replace('wispro-', '') || r.ticketNumber === orderId.replace('wispro-', ''));
                if (rawT) {
                    const orderType = classifyWisproTicket(rawT) || 'INSTALACION_NUEVA';
                    const techId = rawT.assignedToId || rawT.technician?.id;
                    const tech = techId ? await db_1.prisma.user.findUnique({
                        where: { id: techId },
                        include: { managedWarehouses: { where: { type: client_1.WarehouseType.VEHICULO } } }
                    }) : null;
                    const vWhId = tech?.managedWarehouses?.[0]?.id || rawT.technician?.vehicleWarehouseId;
                    if (!vWhId) {
                        res.status(400).json({ success: false, error: 'No se puede liquidar: Asigne primero un técnico con bodega vehicular a esta orden.' });
                        return;
                    }
                    ticket = await db_1.prisma.installationTicket.create({
                        data: {
                            ticketNumber: rawT.ticketNumber || `WO-${rawT.id}`,
                            type: orderType,
                            wisproClientId: rawT.wisproClientId || `WISP-${rawT.id}`,
                            wisproClientName: rawT.clientName || 'Cliente',
                            wisproContractId: rawT.contractId || `CTR-${rawT.id}`,
                            wisproNode: rawT.wisproNode || rawT.node || null,
                            clientAddress: rawT.clientAddress || 'Panamá',
                            technicianId: tech ? tech.id : (await resolveUser(req)).id,
                            vehicleWarehouseId: vWhId,
                            wisproSynced: false,
                            wisproSyncMessage: 'Orden Wispro iniciada para liquidación',
                        },
                        include: { technician: true, vehicleWarehouse: true },
                    });
                }
            }
            if (!ticket) {
                res.status(404).json({ success: false, error: 'Orden no encontrada' });
                return;
            }
            if (ticket.wisproSynced) {
                res.status(409).json({ success: false, error: 'Esta orden ya fue liquidada' });
                return;
            }
            const targetTicket = ticket;
            const vehicleWarehouseId = targetTicket.vehicleWarehouseId;
            if (!vehicleWarehouseId) {
                res.status(400).json({ success: false, error: 'La orden no tiene bodega vehicular asignada' });
                return;
            }
            const responsibleUser = await resolveUser(req);
            // PRE-GUARD: serial en vehiculo del tecnico
            let targetItem = null;
            if (serialNumber || macAddress) {
                const cleanSN = serialNumber ? String(serialNumber).trim().toUpperCase() : null;
                const cleanMAC = macAddress ? String(macAddress).replace(/[^A-Za-z0-9]/g, '').toUpperCase() : null;
                targetItem = await db_1.prisma.serializedItem.findFirst({
                    where: {
                        currentWarehouseId: vehicleWarehouseId,
                        status: client_1.SerializedStatus.EN_VEHICULO,
                        OR: [
                            ...(cleanSN ? [{ serialNumber: cleanSN }] : []),
                            ...(cleanMAC ? [{ macAddress: cleanMAC }] : []),
                        ],
                    },
                    include: { product: true },
                });
                if (!targetItem) {
                    res.status(400).json({
                        success: false,
                        error: `El equipo "${serialNumber || macAddress}" no está en la bodega del vehículo (${targetTicket.vehicleWarehouse?.name || vehicleWarehouseId}). Verifique que esté físicamente cargado con estado EN_VEHICULO.`,
                    });
                    return;
                }
            }
            // PRE-GUARD: bobina en vehiculo
            let targetBatch = null;
            let metersToDeduct = 0;
            if (batchUsage && Number(batchUsage.metersUsed) > 0) {
                metersToDeduct = Number(batchUsage.metersUsed);
                targetBatch = await db_1.prisma.batchItem.findFirst({
                    where: {
                        currentWarehouseId: vehicleWarehouseId,
                        status: client_1.BatchStatus.DISPONIBLE,
                        OR: [
                            ...(batchUsage.batchId ? [{ id: batchUsage.batchId }] : []),
                            ...(batchUsage.batchNumber ? [{ batchNumber: String(batchUsage.batchNumber).trim().toUpperCase() }] : []),
                        ],
                    },
                    include: { product: true },
                });
                if (!targetBatch) {
                    res.status(400).json({ success: false, error: 'Bobina no disponible en el vehículo' });
                    return;
                }
                if (targetBatch.currentQuantity < metersToDeduct) {
                    res.status(400).json({ success: false, error: `Metraje insuficiente: Bobina ${targetBatch.batchNumber} tiene ${targetBatch.currentQuantity}m, se solicitaron ${metersToDeduct}m` });
                    return;
                }
            }
            // TRANSACCION ATOMICA
            const txResult = await db_1.prisma.$transaction(async (tx) => {
                const auditEntries = [];
                if (targetItem) {
                    await tx.serializedItem.update({
                        where: { id: targetItem.id },
                        data: {
                            status: client_1.SerializedStatus.INSTALADO_CLIENTE,
                            installedContractId: targetTicket.wisproContractId,
                            installedClientId: targetTicket.wisproClientId,
                            installedClientName: targetTicket.wisproClientName,
                            installedTicketId: targetTicket.ticketNumber,
                            installedDate: new Date(),
                            notes: notes ? `${targetItem.notes ? targetItem.notes + ' | ' : ''}Instalado: ${notes}` : targetItem.notes,
                        },
                    });
                    await tx.auditLog.create({
                        data: {
                            eventType: client_1.AuditEventType.INSTALACION_CLIENTE,
                            macAddress: targetItem.macAddress,
                            serialNumber: targetItem.serialNumber,
                            fromWarehouseId: vehicleWarehouseId,
                            userId: responsibleUser.id,
                            details: `[LIQUIDACION] ${targetItem.product?.name || 'Equipo'} S/N:${targetItem.serialNumber} MAC:${targetItem.macAddress || 'N/A'} → Cliente "${targetTicket.wisproClientName}" Contrato:${targetTicket.wisproContractId} Ticket:${targetTicket.ticketNumber}`,
                        },
                    });
                    auditEntries.push(`Serial ${targetItem.serialNumber} → ${targetTicket.wisproContractId}`);
                }
                if (targetBatch && metersToDeduct > 0) {
                    const newQty = Math.max(0, targetBatch.currentQuantity - metersToDeduct);
                    await tx.batchItem.update({
                        where: { id: targetBatch.id },
                        data: { currentQuantity: newQty, status: newQty <= 0 ? client_1.BatchStatus.AGOTADO : client_1.BatchStatus.DISPONIBLE },
                    });
                    await tx.auditLog.create({
                        data: {
                            eventType: client_1.AuditEventType.CONSUMO_BOBINA,
                            batchNumber: targetBatch.batchNumber,
                            fromWarehouseId: vehicleWarehouseId,
                            userId: responsibleUser.id,
                            details: `[LIQUIDACION] ${metersToDeduct}m de ${targetBatch.product?.name || 'cable'} (${targetBatch.batchNumber}). Remanente: ${newQty}m. Ticket:${targetTicket.ticketNumber}`,
                        },
                    });
                    auditEntries.push(`${metersToDeduct}m bobina ${targetBatch.batchNumber}`);
                }
                if (Array.isArray(bulkUsage)) {
                    for (const b of bulkUsage) {
                        if (!b.productId || !(Number(b.quantity) > 0))
                            continue;
                        const stock = await tx.bulkStock.findUnique({
                            where: { productId_warehouseId: { productId: b.productId, warehouseId: vehicleWarehouseId } },
                            include: { product: true },
                        });
                        if (!stock || stock.quantity < Number(b.quantity)) {
                            throw new Error(`Stock insuficiente: "${stock?.product?.name || b.productId}" — Disponible: ${stock?.quantity ?? 0}, Solicitado: ${b.quantity}`);
                        }
                        await tx.bulkStock.update({ where: { id: stock.id }, data: { quantity: stock.quantity - Number(b.quantity) } });
                        auditEntries.push(`${b.quantity}x ${stock.product?.name || b.productId}`);
                    }
                }
                const updatedTicket = await tx.installationTicket.update({
                    where: { id: targetTicket.id },
                    data: {
                        wisproSynced: true,
                        wisproSyncMessage: `Liquidado: ${auditEntries.join(', ') || 'Sin materiales'}. ${notes || ''}`.trim(),
                        installedOnuMac: targetItem?.macAddress || targetTicket.installedOnuMac,
                        installedOnuSerial: targetItem?.serialNumber || targetTicket.installedOnuSerial,
                        notes: notes || targetTicket.notes,
                    },
                    include: {
                        technician: { select: { id: true, name: true } },
                        vehicleWarehouse: { select: { id: true, name: true, code: true } },
                    },
                });
                return { ticket: updatedTicket, auditEntries };
            });
            inventory_service_1.inventoryService.invalidateDashboardCache();
            res.json({
                success: true,
                message: `Liquidacion completada. ${txResult.auditEntries.length} movimiento(s) registrado(s).`,
                ticket: txResult.ticket,
                auditEntries: txResult.auditEntries,
                liquidatedItems: {
                    serialNumber: targetItem?.serialNumber || null,
                    macAddress: targetItem?.macAddress || null,
                    metersCable: metersToDeduct,
                },
            });
        }
        catch (err) {
            console.error('[WorkOrders.liquidate]', err);
            const is400 = err.message?.includes('Stock insuficiente') || err.message?.includes('no está en la bodega') || err.message?.includes('Metraje insuficiente');
            res.status(is400 ? 400 : 500).json({ success: false, error: err.message });
        }
    }
    // GET /api/work-orders/:id
    static async getOne(req, res) {
        try {
            const id = String(req.params.id);
            let ticket = await db_1.prisma.installationTicket.findFirst({
                where: {
                    OR: [
                        { id },
                        { ticketNumber: id.replace('wispro-', '') }
                    ]
                },
                include: { technician: { select: { id: true, name: true, email: true, phone: true } }, vehicleWarehouse: true },
            });
            if (!ticket && id.startsWith('wispro-')) {
                const rawTickets = await wispro_service_1.WisproService.fetchOpenTickets();
                const rawT = rawTickets.find(r => `wispro-${r.id}` === id || r.id === id.replace('wispro-', '') || r.ticketNumber === id.replace('wispro-', ''));
                if (rawT) {
                    const orderType = classifyWisproTicket(rawT) || 'INSTALACION_NUEVA';
                    const techId = rawT.assignedToId || rawT.technician?.id;
                    let vehicleWarehouse = null;
                    let technician = null;
                    if (techId) {
                        technician = await db_1.prisma.user.findUnique({
                            where: { id: techId },
                            select: { id: true, name: true, email: true, phone: true, role: true, managedWarehouses: { where: { type: client_1.WarehouseType.VEHICULO } } }
                        });
                        vehicleWarehouse = technician?.managedWarehouses?.[0] || null;
                    }
                    ticket = {
                        id,
                        ticketNumber: rawT.ticketNumber || `WO-${rawT.id}`,
                        type: orderType,
                        wisproClientId: rawT.wisproClientId || `WISP-${rawT.id}`,
                        wisproClientName: rawT.clientName || 'Cliente Residencial',
                        wisproContractId: rawT.contractId || `CTR-${rawT.id}`,
                        wisproNode: rawT.wisproNode || rawT.node || null,
                        clientAddress: rawT.clientAddress || 'Panamá',
                        technicianId: technician?.id || null,
                        technician: technician || rawT.technician || null,
                        vehicleWarehouseId: vehicleWarehouse?.id || rawT.technician?.vehicleWarehouseId || null,
                        vehicleWarehouse: vehicleWarehouse || (rawT.technician?.vehicleWarehouseId ? { id: rawT.technician.vehicleWarehouseId, name: rawT.technician.vehicleWarehouseName, code: 'VEH-01' } : null),
                        wisproSynced: false,
                        wisproSyncMessage: 'Orden de Wispro',
                        cableDropMetersUsed: 0,
                        connectorsUsed: 0,
                        tensorsUsed: 0,
                        createdAt: rawT.createdAt || new Date().toISOString(),
                    };
                }
            }
            if (!ticket) {
                res.status(404).json({ success: false, error: 'Orden no encontrada' });
                return;
            }
            let retrievalChecklist = [];
            let contractAssignment = null;
            if (ticket.type === 'BAJA_SERVICIO' && ticket.wisproContractId) {
                [retrievalChecklist, contractAssignment] = await Promise.all([
                    db_1.prisma.serializedItem.findMany({
                        where: {
                            OR: [
                                { installedContractId: ticket.wisproContractId, status: client_1.SerializedStatus.INSTALADO_CLIENTE },
                                { clientAssignment: { wisproContractId: ticket.wisproContractId }, status: client_1.SerializedStatus.INSTALADO_CLIENTE },
                            ],
                        },
                        include: { product: { select: { id: true, name: true, brand: true, model: true, category: true } }, currentWarehouse: { select: { id: true, name: true, code: true } } },
                        orderBy: { updatedAt: 'desc' },
                    }),
                    db_1.prisma.clientAssignment.findFirst({
                        where: { wisproContractId: ticket.wisproContractId, status: 'ACTIVO' },
                        include: { technician: { select: { id: true, name: true } }, node: { select: { id: true, name: true, code: true } } },
                    }),
                ]);
            }
            let vehicleInventory = null;
            if (ticket.vehicleWarehouseId) {
                const [serials, batches, bulks] = await Promise.all([
                    db_1.prisma.serializedItem.findMany({
                        where: { currentWarehouseId: ticket.vehicleWarehouseId, status: client_1.SerializedStatus.EN_VEHICULO },
                        include: { product: { select: { name: true, category: true, brand: true, model: true } } },
                        orderBy: [{ product: { category: 'asc' } }, { serialNumber: 'asc' }],
                    }),
                    db_1.prisma.batchItem.findMany({
                        where: { currentWarehouseId: ticket.vehicleWarehouseId, status: client_1.BatchStatus.DISPONIBLE },
                        include: { product: { select: { name: true, category: true } } },
                    }),
                    db_1.prisma.bulkStock.findMany({
                        where: { warehouseId: ticket.vehicleWarehouseId, quantity: { gt: 0 } },
                        include: { product: { select: { id: true, name: true, category: true } } },
                    }),
                ]);
                vehicleInventory = { serials, batches, bulks };
            }
            res.json({ success: true, ticket, retrievalChecklist, contractAssignment, retrievalCount: retrievalChecklist.length, vehicleInventory });
        }
        catch (err) {
            console.error('[WorkOrders.getOne]', err);
            res.status(500).json({ success: false, error: err.message });
        }
    }
    // POST /api/work-orders
    static async create(req, res) {
        try {
            const { ticketNumber, type = 'INSTALACION_NUEVA', wisproClientId, wisproClientName, wisproContractId, wisproNode, clientAddress, technicianId, vehicleWarehouseId, installedOnuMac, installedOnuSerial, installedRouterMac, retiredDeviceMac, retiredDeviceStatus, notes } = req.body;
            if (!wisproContractId || !wisproClientName || !vehicleWarehouseId) {
                res.status(400).json({ success: false, error: 'wisproContractId, wisproClientName y vehicleWarehouseId son requeridos' });
                return;
            }
            const responsibleUser = await resolveUser(req);
            const vehicleWarehouse = await db_1.prisma.warehouse.findUnique({ where: { id: vehicleWarehouseId } });
            if (!vehicleWarehouse) {
                res.status(404).json({ success: false, error: 'Bodega vehicular no encontrada' });
                return;
            }
            const ticket = await db_1.prisma.installationTicket.create({
                data: {
                    ticketNumber: ticketNumber || `WO-${type.slice(0, 3)}-${Date.now().toString().slice(-6)}`,
                    type: type,
                    wisproClientId: wisproClientId || `WISP-${Date.now().toString().slice(-8)}`,
                    wisproClientName,
                    wisproContractId,
                    wisproNode: wisproNode || null,
                    clientAddress: clientAddress || vehicleWarehouse.address || 'Panama',
                    technicianId: technicianId || responsibleUser.id,
                    vehicleWarehouseId,
                    installedOnuMac: installedOnuMac || null,
                    installedOnuSerial: installedOnuSerial || null,
                    installedRouterMac: installedRouterMac || null,
                    retiredDeviceMac: retiredDeviceMac || null,
                    retiredDeviceStatus: retiredDeviceStatus ? retiredDeviceStatus : null,
                    notes: notes || null,
                    wisproSynced: false,
                    wisproSyncMessage: 'Orden creada — pendiente de completar',
                },
                include: { technician: { select: { id: true, name: true, email: true } }, vehicleWarehouse: { select: { id: true, name: true, code: true } } },
            });
            res.status(201).json({ success: true, message: `Orden ${ticket.ticketNumber} creada`, ticket });
        }
        catch (err) {
            console.error('[WorkOrders.create]', err);
            res.status(500).json({ success: false, error: err.message });
        }
    }
    // POST /api/work-orders/:id/complete
    static async complete(req, res) {
        try {
            const id = String(req.params.id);
            const { defectiveItemIds = [], returnWarehouseId, notes } = req.body;
            const ticket = await db_1.prisma.installationTicket.findUnique({ where: { id }, include: { vehicleWarehouse: true } });
            if (!ticket) {
                res.status(404).json({ success: false, error: 'Orden no encontrada' });
                return;
            }
            const responsibleUser = await resolveUser(req);
            const destWarehouseId = returnWarehouseId || ticket.vehicleWarehouseId;
            if (ticket.type === 'BAJA_SERVICIO') {
                const contractId = ticket.wisproContractId;
                const installedItems = await db_1.prisma.serializedItem.findMany({
                    where: { status: client_1.SerializedStatus.INSTALADO_CLIENTE, OR: [{ installedContractId: contractId }, { clientAssignment: { wisproContractId: contractId } }] },
                    include: { product: true, clientAssignment: true },
                });
                const defectiveSet = new Set(Array.isArray(defectiveItemIds) ? defectiveItemIds.map(String) : []);
                await db_1.prisma.$transaction(async (tx) => {
                    for (const item of installedItems) {
                        const newStatus = defectiveSet.has(item.id) ? client_1.SerializedStatus.RMA_DEFECTUOSO : client_1.SerializedStatus.EN_VEHICULO;
                        await tx.serializedItem.update({
                            where: { id: item.id },
                            data: { status: newStatus, currentWarehouseId: destWarehouseId, clientAssignmentId: null, installedContractId: null, installedClientName: null, installedClientId: null, installedDate: null, installedTicketId: null, notes: notes ? `${item.notes ? item.notes + ' | ' : ''}Retiro BAJA: ${notes}` : item.notes },
                        });
                        await tx.auditLog.create({ data: { macAddress: item.macAddress, serialNumber: item.serialNumber, eventType: client_1.AuditEventType.RETIRO_POR_CANCELACION, fromWarehouseId: item.currentWarehouseId, toWarehouseId: destWarehouseId, userId: responsibleUser.id, details: `Retiro baja. Contrato:${contractId} Cliente:${ticket.wisproClientName} Equipo:${item.product?.name} S/N:${item.serialNumber} Estado:${newStatus}` } });
                    }
                    await tx.clientAssignment.updateMany({ where: { wisproContractId: contractId, status: 'ACTIVO' }, data: { status: 'FINALIZADO' } });
                    await tx.installationTicket.update({ where: { id: ticket.id }, data: { wisproSynced: true, wisproSyncMessage: `Baja completada. ${installedItems.length} equipos retirados. ${notes || ''}`.trim() } });
                });
                inventory_service_1.inventoryService.invalidateDashboardCache();
                res.json({ success: true, message: `Baja completada. ${installedItems.length} equipos retirados de ${ticket.wisproClientName}.`, summary: { totalRetrieved: installedItems.length, movedToVehicle: installedItems.filter(i => !defectiveSet.has(i.id)).length, movedToRMA: defectiveSet.size } });
                return;
            }
            await db_1.prisma.installationTicket.update({ where: { id: ticket.id }, data: { wisproSynced: true, wisproSyncMessage: notes || 'Orden completada' } });
            inventory_service_1.inventoryService.invalidateDashboardCache();
            res.json({ success: true, message: `Orden ${ticket.ticketNumber} completada.` });
        }
        catch (err) {
            console.error('[WorkOrders.complete]', err);
            res.status(500).json({ success: false, error: err.message });
        }
    }
    // PATCH /api/work-orders/:id/status
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
                    ...(wisproSyncMessage !== undefined ? { wisproSyncMessage } : {}),
                },
                include: { technician: { select: { id: true, name: true } }, vehicleWarehouse: { select: { id: true, name: true } } },
            });
            res.json({ success: true, ticket: updated });
        }
        catch (err) {
            console.error('[WorkOrders.updateStatus]', err);
            res.status(500).json({ success: false, error: err.message });
        }
    }
    // GET /api/work-orders/contract/:contractId/checklist
    static async retrievalChecklist(req, res) {
        try {
            const contractId = String(req.params.contractId);
            const items = await db_1.prisma.serializedItem.findMany({
                where: { status: client_1.SerializedStatus.INSTALADO_CLIENTE, OR: [{ installedContractId: contractId }, { clientAssignment: { wisproContractId: contractId } }] },
                include: { product: { select: { id: true, name: true, brand: true, model: true, category: true } }, currentWarehouse: { select: { id: true, name: true, code: true } } },
                orderBy: { updatedAt: 'desc' },
            });
            const assignment = await db_1.prisma.clientAssignment.findFirst({
                where: { wisproContractId: contractId, status: 'ACTIVO' },
                include: { technician: { select: { id: true, name: true } }, node: { select: { id: true, name: true } } },
            });
            res.json({ success: true, contractId, retrievalCount: items.length, items, assignment });
        }
        catch (err) {
            console.error('[WorkOrders.retrievalChecklist]', err);
            res.status(500).json({ success: false, error: err.message });
        }
    }
}
exports.WorkOrdersController = WorkOrdersController;
