"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const inventory_service_1 = require("../services/inventory.service");
const wispro_service_1 = require("../services/wispro.service");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const inventory_routes_1 = __importDefault(require("./inventory.routes"));
const inventory_controller_1 = require("../controllers/inventory.controller");
const transfer_controller_1 = require("../controllers/transfer.controller");
const liquidation_controller_1 = require("../controllers/liquidation.controller");
const search_controller_1 = require("../controllers/search.controller");
const warehouse_routes_1 = __importDefault(require("./warehouse.routes"));
const catalog_routes_1 = __importDefault(require("./catalog.routes"));
const transfer_routes_1 = __importDefault(require("./transfer.routes"));
const liquidation_routes_1 = __importDefault(require("./liquidation.routes"));
const rma_routes_1 = __importDefault(require("./rma.routes"));
const wispro_routes_1 = __importDefault(require("./wispro.routes"));
const analytics_routes_1 = __importDefault(require("./analytics.routes"));
const auth_routes_1 = __importDefault(require("./auth.routes"));
const router = (0, express_1.Router)();
// ==========================================
// 0. BÚSQUEDA UNIVERSAL GLOBAL (COMMAND PALETTE)
// ==========================================
router.get('/search/universal', auth_middleware_1.authMiddleware, search_controller_1.SearchController.universalSearch);
// ==========================================
// 1. AUTENTICACIÓN & USUARIOS (RBAC)
// ==========================================
router.use('/auth', auth_routes_1.default);
// ==========================================
// 2. DASHBOARD GENERAL (KPIS Y ALERTAS)
// ==========================================
router.get('/dashboard/kpis', auth_middleware_1.authMiddleware, async (req, res) => {
    const kpis = await inventory_service_1.inventoryService.getDashboardKPIs();
    res.json(kpis);
});
// ==========================================
// 3. CATÁLOGO CENTRAL DE PRODUCTOS (PRISMA)
// ==========================================
router.use('/catalog', catalog_routes_1.default);
// ==========================================
// 4. BODEGAS (HUB & SPOKE CON JERARQUÍA PRISMA)
// ==========================================
router.use('/warehouses', warehouse_routes_1.default);
// ==========================================
// 5. INVENTARIO FÍSICO, INBOUND & STOCK
// ==========================================
router.post('/inventory/inbound', auth_middleware_1.authMiddleware, inventory_controller_1.InventoryController.inboundInventory);
router.get('/inventory/stock', transfer_controller_1.TransferController.getWarehouseStock);
router.use(inventory_routes_1.default);
// ==========================================
// 6. ÓRDENES DE TRASLADO (HUB -> SPOKE -> VEHICLE)
// ==========================================
router.use('/transfers', transfer_routes_1.default);
// ==========================================
// 7. LIQUIDACIÓN Y CONSUMO EN CAMPO
// ==========================================
router.use('/liquidations', liquidation_routes_1.default);
router.post('/technician/tickets/close', auth_middleware_1.authMiddleware, liquidation_controller_1.LiquidationController.consumeLiquidation);
// ==========================================
// 8. LOGÍSTICA INVERSA & RMA
// ==========================================
router.use('/rma', rma_routes_1.default);
// ==========================================
// 9. AUDITORÍA FORENSE & ANALÍTICA
// ==========================================
router.use('/analytics', analytics_routes_1.default);
router.get('/audit/mac/:query', auth_middleware_1.authMiddleware, async (req, res) => {
    const query = String(req.params.query);
    const history = await inventory_service_1.inventoryService.searchForensicHistory(query);
    res.json(history);
});
router.get('/audit/logs', auth_middleware_1.authMiddleware, async (req, res) => {
    const logs = await db_1.prisma.auditLog.findMany({
        take: 100,
        orderBy: { timestamp: 'desc' },
        include: { user: true, fromWarehouse: true, toWarehouse: true }
    });
    res.json({ logs });
});
// ==========================================
// 10. APP MÓVIL DEL TÉCNICO (MI CAMIONETA)
// ==========================================
router.get('/technician/my-vehicle', auth_middleware_1.authMiddleware, async (req, res) => {
    const user = req.user;
    const warehouse = await db_1.prisma.warehouse.findFirst({
        where: {
            OR: [
                { id: user?.baseWarehouseId || undefined },
                { managerId: user?.id }
            ]
        }
    });
    if (!warehouse) {
        res.status(404).json({ error: 'No tienes una bodega vehicular asignada' });
        return;
    }
    const [serialized, bulk] = await Promise.all([
        db_1.prisma.serializedItem.findMany({
            where: { currentWarehouseId: warehouse.id, status: 'EN_VEHICULO' },
            include: { product: true }
        }),
        db_1.prisma.bulkStock.findMany({
            where: { warehouseId: warehouse.id },
            include: { product: true }
        })
    ]);
    res.json({
        warehouse,
        serializedItems: serialized,
        bulkStocks: bulk
    });
});
router.get('/technician/tickets', auth_middleware_1.authMiddleware, async (req, res) => {
    const tickets = await db_1.prisma.installationTicket.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' },
        include: { technician: true }
    });
    res.json({ tickets });
});
// ==========================================
// 11. VISTA 360° EQUIPOS POR CLIENTE
// ==========================================
router.get('/clients/equipment-view', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { search, category, status } = req.query;
        // 1. Obtener todos los clientes Wispro de la BD local
        const whereClause = {};
        if (status && status !== 'ALL')
            whereClause.status = status;
        if (search) {
            whereClause.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { contractId: { contains: search, mode: 'insensitive' } },
                { address: { contains: search, mode: 'insensitive' } },
                { nodeName: { contains: search, mode: 'insensitive' } },
            ];
        }
        const wisproClients = await db_1.prisma.wisproClient.findMany({
            where: whereClause,
            orderBy: { name: 'asc' }
        });
        // 2. Para cada cliente, buscar sus equipos instalados y tickets
        const clientIds = wisproClients.map(c => c.id);
        const [serializedItems, installationTickets] = await Promise.all([
            // Equipos serializados actualmente instalados en clientes
            db_1.prisma.serializedItem.findMany({
                where: {
                    status: 'INSTALADO_CLIENTE',
                    installedClientId: { in: clientIds },
                    ...(category && category !== 'ALL' ? { category: category } : {})
                },
                include: {
                    product: {
                        select: { name: true, brand: true, model: true, category: true }
                    }
                }
            }),
            // Historial de tickets de instalación
            db_1.prisma.installationTicket.findMany({
                where: { wisproClientId: { in: clientIds } },
                include: { technician: { select: { name: true } } },
                orderBy: { createdAt: 'desc' }
            })
        ]);
        // 3. Construir mapa: clientId => { equipos, tickets }
        const equipmentByClient = new Map();
        const ticketsByClient = new Map();
        for (const item of serializedItems) {
            if (!item.installedClientId)
                continue;
            const arr = equipmentByClient.get(item.installedClientId) || [];
            arr.push(item);
            equipmentByClient.set(item.installedClientId, arr);
        }
        for (const tk of installationTickets) {
            const arr = ticketsByClient.get(tk.wisproClientId) || [];
            arr.push(tk);
            ticketsByClient.set(tk.wisproClientId, arr);
        }
        // 4. Construir respuesta enriquecida
        const clients = wisproClients.map(client => {
            const equip = equipmentByClient.get(client.id) || [];
            const tickets = ticketsByClient.get(client.id) || [];
            // Summary por categoria
            const summary = {};
            for (const eq of equip) {
                const cat = eq.product?.category || 'OTRO';
                summary[cat] = (summary[cat] || 0) + 1;
            }
            return {
                id: client.id,
                name: client.name,
                contractId: client.contractId,
                address: client.address,
                nodeName: client.nodeName,
                planName: client.planName,
                status: client.status,
                currentOnuMac: client.currentOnuMac,
                installedEquipment: equip.map(eq => ({
                    id: eq.id,
                    serialNumber: eq.serialNumber,
                    macAddress: eq.macAddress,
                    category: eq.product?.category,
                    productName: eq.product?.name,
                    brand: eq.product?.brand,
                    model: eq.product?.model,
                    installedDate: eq.installedDate,
                    installedTicketId: eq.installedTicketId,
                })),
                ticketHistory: tickets.map(tk => ({
                    id: tk.id,
                    ticketNumber: tk.ticketNumber,
                    type: tk.type,
                    technicianName: tk.technician?.name,
                    createdAt: tk.createdAt,
                })),
                equipmentSummary: summary,
            };
        });
        // 5. Totales globales
        const totals = {
            totalClients: clients.length,
            withEquipment: clients.filter(c => c.installedEquipment.length > 0).length,
            withCamera: clients.filter(c => (c.equipmentSummary['CAMARA_SEGURIDAD_IOT'] ?? 0) > 0).length,
            withTvBox: clients.filter(c => (c.equipmentSummary['TV_BOX_OTT'] ?? 0) > 0).length,
            withRepeater: clients.filter(c => (c.equipmentSummary['REPETIDOR_MESH'] ?? 0) > 0).length,
        };
        res.json({ success: true, clients, totals });
    }
    catch (error) {
        console.error('[equipment-view] Error:', error);
        res.status(500).json({ success: false, error: 'Error generando vista de equipos por cliente', details: error.message });
    }
});
// ==========================================
// 12. INTEGRACIÓN WISPRO CLOUD
// ==========================================
router.use('/wispro', wispro_routes_1.default);
router.get('/wispro/clients', auth_middleware_1.authMiddleware, async (req, res) => {
    const { status, search } = req.query;
    const clients = await wispro_service_1.wisproService.getClients({
        status: status,
        search: search
    });
    res.json({ clients });
});
router.post('/wispro/sync', auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)(['SUPERADMIN', 'ADMIN_BODEGA', 'ENCARGADO_PERSONAL']), async (req, res) => {
    const result = await wispro_service_1.wisproService.syncWithWispro();
    res.json(result);
});
// ==========================================
// 12. MÉTRICAS DE PERSONAL Y MERMAS DE CABLE
// ==========================================
router.get('/metrics/personnel', auth_middleware_1.authMiddleware, async (req, res) => {
    const metrics = await inventory_service_1.inventoryService.getTechnicianMetrics();
    res.json({ metrics });
});
// ==========================================
// 13. RESET DE PRUEBAS
// ==========================================
router.post('/system/reset', auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)(['SUPERADMIN', 'ADMIN_BODEGA']), async (req, res) => {
    res.json({ message: 'Sistema sincronizado con base de datos Prisma.' });
});
exports.default = router;
