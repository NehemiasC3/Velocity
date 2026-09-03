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
const warehouse_controller_1 = require("../controllers/warehouse.controller");
const inventory_controller_1 = require("../controllers/inventory.controller");
const transfer_controller_1 = require("../controllers/transfer.controller");
const liquidation_controller_1 = require("../controllers/liquidation.controller");
const catalog_routes_1 = __importDefault(require("./catalog.routes"));
const transfer_routes_1 = __importDefault(require("./transfer.routes"));
const liquidation_routes_1 = __importDefault(require("./liquidation.routes"));
const rma_routes_1 = __importDefault(require("./rma.routes"));
const wispro_routes_1 = __importDefault(require("./wispro.routes"));
const analytics_routes_1 = __importDefault(require("./analytics.routes"));
const auth_routes_1 = __importDefault(require("./auth.routes"));
const router = (0, express_1.Router)();
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
router.get('/warehouses', warehouse_controller_1.WarehouseController.getWarehouses);
router.get('/warehouses/:id', warehouse_controller_1.WarehouseController.getWarehouseById);
router.post('/warehouses', auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)(['SUPERADMIN', 'ADMIN_BODEGA']), warehouse_controller_1.WarehouseController.createWarehouse);
router.put('/warehouses/:id', auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)(['SUPERADMIN', 'ADMIN_BODEGA']), warehouse_controller_1.WarehouseController.updateWarehouse);
router.delete('/warehouses/:id', auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)(['SUPERADMIN', 'ADMIN_BODEGA']), warehouse_controller_1.WarehouseController.deleteWarehouse);
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
// 11. INTEGRACIÓN WISPRO CLOUD
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
