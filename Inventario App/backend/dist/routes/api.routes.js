"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const inventory_service_1 = require("../services/inventory.service");
const wispro_service_1 = require("../services/wispro.service");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// ==========================================
// 1. AUTENTICACIÓN & USUARIOS (RBAC)
// ==========================================
router.get('/auth/users', (req, res) => {
    const users = db_1.db.getUsers();
    res.json({ users });
});
router.get('/auth/me', auth_1.authMiddleware, (req, res) => {
    res.json({ user: req.user });
});
// ==========================================
// 2. DASHBOARD GENERAL (KPIS Y ALERTAS)
// ==========================================
router.get('/dashboard/kpis', auth_1.authMiddleware, (req, res) => {
    const kpis = inventory_service_1.inventoryService.getDashboardKPIs();
    res.json(kpis);
});
// ==========================================
// 3. BODEGAS (HUB, SPOKE, VEHICLE)
// ==========================================
router.get('/warehouses', auth_1.authMiddleware, (req, res) => {
    const warehouses = db_1.db.getWarehouses();
    res.json({ warehouses });
});
router.post('/warehouses', auth_1.authMiddleware, (0, auth_1.requireRole)(['ADMIN_BODEGA']), (req, res) => {
    try {
        const { name, code, type, address, vehiclePlate, managerId, managerName } = req.body;
        if (!name || !code || !type) {
            return res.status(400).json({ error: 'Nombre, código y tipo son obligatorios' });
        }
        const newWarehouse = {
            id: `wh-${type.toLowerCase()}-${Date.now()}`,
            name,
            code,
            type,
            address,
            vehiclePlate,
            managerId,
            managerName,
            status: 'ACTIVE',
            createdAt: new Date().toISOString()
        };
        db_1.db.addWarehouse(newWarehouse);
        res.status(201).json({ warehouse: newWarehouse });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// ==========================================
// 4. INVENTARIO SERIADO (ONUS, ROUTERS)
// ==========================================
router.get('/inventory/serialized', auth_1.authMiddleware, (req, res) => {
    let items = db_1.db.getSerializedItems();
    const { warehouseId, status, category, search } = req.query;
    if (warehouseId)
        items = items.filter(i => i.currentWarehouseId === warehouseId);
    if (status)
        items = items.filter(i => i.status === status);
    if (category)
        items = items.filter(i => i.category === category);
    if (search) {
        const q = search.toLowerCase();
        items = items.filter(i => i.macAddress.toLowerCase().includes(q) ||
            i.serialNumber.toLowerCase().includes(q) ||
            i.model.toLowerCase().includes(q) ||
            i.brand.toLowerCase().includes(q));
    }
    res.json({ items });
});
router.post('/inventory/serialized', auth_1.authMiddleware, (0, auth_1.requireRole)(['ADMIN_BODEGA']), (req, res) => {
    try {
        const { macAddress, serialNumber, brand, model, category, currentWarehouseId } = req.body;
        if (!macAddress || !serialNumber || !brand || !currentWarehouseId) {
            return res.status(400).json({ error: 'MAC, Serial, Marca y Bodega son obligatorios' });
        }
        // Validar MAC única
        const exists = db_1.db.getSerializedItems().find(i => i.macAddress.toUpperCase() === macAddress.trim().toUpperCase());
        if (exists) {
            return res.status(400).json({ error: `La MAC ${macAddress} ya existe en el sistema.` });
        }
        const warehouse = db_1.db.getWarehouses().find(w => w.id === currentWarehouseId);
        const newItem = {
            id: `ser-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            macAddress: macAddress.trim().toUpperCase(),
            serialNumber: serialNumber.trim().toUpperCase(),
            brand,
            model: model || 'Standard ONU',
            category: category || 'ONU_GPON',
            currentWarehouseId,
            currentWarehouseName: warehouse?.name || 'Bodega',
            status: warehouse?.type === 'VEHICLE' ? 'EN_VEHICULO' : 'EN_BODEGA',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        db_1.db.addSerializedItem(newItem);
        db_1.db.addAuditLog({
            id: `aud-${Date.now()}`,
            macAddress: newItem.macAddress,
            serialNumber: newItem.serialNumber,
            eventType: 'ALTA_INVENTARIO',
            toWarehouseId: currentWarehouseId,
            toWarehouseName: warehouse?.name,
            userId: req.user?.id || 'admin',
            userName: req.user?.name || 'Admin',
            details: `Alta de equipo (${brand} ${model}) en ${warehouse?.name}.`,
            timestamp: new Date().toISOString()
        });
        res.status(201).json({ item: newItem });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/inventory/serialized/batch', auth_1.authMiddleware, (0, auth_1.requireRole)(['ADMIN_BODEGA']), (req, res) => {
    try {
        const { items, brand, model, category, targetWarehouseId } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0 || !brand || !targetWarehouseId) {
            return res.status(400).json({ error: 'Lista de ítems, marca y bodega son obligatorios' });
        }
        const result = inventory_service_1.inventoryService.createSerializedItemsBatch({
            items,
            brand,
            model: model || 'ONU GPON',
            category: category || 'ONU_GPON',
            targetWarehouseId,
            userId: req.user?.id || 'admin',
            userName: req.user?.name || 'Admin'
        });
        res.status(201).json(result);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.patch('/inventory/serialized/:id/rma', auth_1.authMiddleware, (req, res) => {
    try {
        const id = String(req.params.id);
        const { reason, targetWarehouseId } = req.body;
        const item = db_1.db.getSerializedItems().find(i => i.id === id);
        if (!item)
            return res.status(404).json({ error: 'Equipo no encontrado' });
        const updated = db_1.db.updateSerializedItem(id, {
            status: 'RMA_DEFECTUOSO',
            currentWarehouseId: targetWarehouseId || item.currentWarehouseId,
            notes: reason || 'Reportado como defectuoso (RMA)'
        });
        db_1.db.addAuditLog({
            id: `aud-${Date.now()}`,
            macAddress: item.macAddress,
            serialNumber: item.serialNumber,
            eventType: 'REPORTE_RMA',
            fromWarehouseId: item.currentWarehouseId,
            fromWarehouseName: item.currentWarehouseName,
            userId: req.user?.id || 'user',
            userName: req.user?.name || 'User',
            details: `Reportado para garantía RMA: ${reason || 'Falla de hardware'}`,
            timestamp: new Date().toISOString()
        });
        res.json({ item: updated });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// ==========================================
// 5. INVENTARIO A GRANEL (CABLE DROP, ETC)
// ==========================================
router.get('/inventory/bulk', auth_1.authMiddleware, (req, res) => {
    const items = db_1.db.getBulkItems();
    const stocks = db_1.db.getBulkStocks();
    const { warehouseId } = req.query;
    const filteredStocks = warehouseId
        ? stocks.filter(s => s.warehouseId === warehouseId)
        : stocks;
    res.json({ items, stocks: filteredStocks });
});
router.post('/inventory/bulk/adjust', auth_1.authMiddleware, (0, auth_1.requireRole)(['ADMIN_BODEGA']), (req, res) => {
    try {
        const { warehouseId, bulkItemId, deltaQuantity, reason } = req.body;
        if (!warehouseId || !bulkItemId || deltaQuantity === undefined) {
            return res.status(400).json({ error: 'Bodega, ítem y cantidad son obligatorios' });
        }
        const updatedStock = db_1.db.updateBulkStockQuantity(warehouseId, bulkItemId, Number(deltaQuantity));
        db_1.db.addAuditLog({
            id: `aud-${Date.now()}`,
            eventType: 'AJUSTE_STOCK',
            toWarehouseId: warehouseId,
            toWarehouseName: updatedStock.warehouseName,
            userId: req.user?.id || 'admin',
            userName: req.user?.name || 'Admin',
            details: `Ajuste manual de stock (${deltaQuantity > 0 ? '+' : ''}${deltaQuantity} ${updatedStock.unitOfMeasure}) en ${updatedStock.bulkItemName}. Razón: ${reason || 'Ajuste de inventario'}`,
            timestamp: new Date().toISOString()
        });
        res.json({ stock: updatedStock });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/inventory/bulk/items', auth_1.authMiddleware, (0, auth_1.requireRole)(['ADMIN_BODEGA']), (req, res) => {
    try {
        const { name, code, category, unitOfMeasure, minStockAlert, description, initialWarehouseId, initialQuantity } = req.body;
        if (!name || !code || !category || !unitOfMeasure) {
            return res.status(400).json({ error: 'Nombre, código, categoría y unidad de medida son obligatorios' });
        }
        const newItem = {
            id: `blk-${code.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`,
            name,
            code: code.toUpperCase(),
            category,
            unitOfMeasure,
            minStockAlert: Number(minStockAlert) || 100,
            description,
            createdAt: new Date().toISOString()
        };
        db_1.db.addBulkItem(newItem);
        // Si viene con carga inicial a bodega
        if (initialWarehouseId && initialQuantity && Number(initialQuantity) > 0) {
            db_1.db.updateBulkStockQuantity(initialWarehouseId, newItem.id, Number(initialQuantity));
        }
        db_1.db.addAuditLog({
            id: `aud-${Date.now()}`,
            eventType: 'ALTA_INVENTARIO',
            toWarehouseId: initialWarehouseId || 'wh-hub-central',
            toWarehouseName: 'Bodega Central Matriz (Hub)',
            userId: req.user?.id || 'admin',
            userName: req.user?.name || 'Admin',
            details: `Creación de nuevo artículo de catálogo: ${name} (${code}) con unidad ${unitOfMeasure}.`,
            timestamp: new Date().toISOString()
        });
        res.status(201).json({ item: newItem });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// ==========================================
// 6. ÓRDENES DE TRASLADO (HUB -> SPOKE -> VEHICLE)
// ==========================================
router.get('/transfers', auth_1.authMiddleware, (req, res) => {
    const transfers = db_1.db.getTransferOrders();
    res.json({ transfers });
});
router.post('/transfers', auth_1.authMiddleware, (0, auth_1.requireRole)(['ADMIN_BODEGA', 'ENCARGADO_PERSONAL', 'TECNICO_LIDER']), (req, res) => {
    try {
        const { originWarehouseId, destinationWarehouseId, notes, serializedItemIds, bulkItems } = req.body;
        const newOrder = inventory_service_1.inventoryService.createTransferOrder({
            originWarehouseId,
            destinationWarehouseId,
            createdById: req.user?.id || 'admin',
            notes,
            serializedItemIds: serializedItemIds || [],
            bulkItems: bulkItems || []
        });
        res.status(201).json({ transfer: newOrder });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.post('/transfers/:id/receive', auth_1.authMiddleware, (0, auth_1.requireRole)(['ADMIN_BODEGA', 'ENCARGADO_PERSONAL', 'TECNICO_LIDER']), (req, res) => {
    try {
        const id = String(req.params.id);
        const updated = inventory_service_1.inventoryService.receiveTransferOrder(id, req.user?.id || 'user');
        res.json({ transfer: updated });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// ==========================================
// 7. AUDITORÍA FORENSE DE ONUS (TRAZABILIDAD MAC)
// ==========================================
router.get('/audit/mac/:query', auth_1.authMiddleware, (req, res) => {
    const query = String(req.params.query);
    const history = inventory_service_1.inventoryService.searchForensicHistory(query);
    res.json(history);
});
router.get('/audit/logs', auth_1.authMiddleware, (req, res) => {
    const logs = db_1.db.getAuditLogs().slice(0, 100);
    res.json({ logs });
});
// ==========================================
// 8. APP MÓVIL DEL TÉCNICO (MI CAMIONETA & CIERRE)
// ==========================================
router.get('/technician/my-vehicle', auth_1.authMiddleware, (req, res) => {
    const user = req.user;
    const warehouse = db_1.db.getWarehouses().find(w => w.id === user?.assignedWarehouseId || w.managerId === user?.id);
    if (!warehouse) {
        return res.status(404).json({ error: 'No tienes una bodega vehicular asignada' });
    }
    const serialized = db_1.db.getSerializedItems().filter(i => i.currentWarehouseId === warehouse.id && i.status === 'EN_VEHICULO');
    const bulk = db_1.db.getBulkStocks().filter(s => s.warehouseId === warehouse.id);
    res.json({
        warehouse,
        serializedItems: serialized,
        bulkStocks: bulk
    });
});
router.post('/technician/tickets/close', auth_1.authMiddleware, (0, auth_1.requireRole)(['ADMIN_BODEGA', 'TECNICO_LIDER']), async (req, res) => {
    try {
        const { wisproClientId, installedOnuMac, installedRouterMac, cableDropMetersUsed, connectorsUsed, tensorsUsed, otherMaterialsUsed, installationPhotoUrl, notes } = req.body;
        if (!wisproClientId) {
            return res.status(400).json({ error: 'Debes seleccionar un cliente de Wispro' });
        }
        const ticket = await inventory_service_1.inventoryService.closeInstallationTicket({
            technicianId: req.user.id,
            wisproClientId,
            installedOnuMac,
            installedRouterMac,
            cableDropMetersUsed: Number(cableDropMetersUsed) || 0,
            connectorsUsed: Number(connectorsUsed) || 0,
            tensorsUsed: Number(tensorsUsed) || 0,
            otherMaterialsUsed,
            installationPhotoUrl,
            notes
        });
        res.status(201).json({ ticket });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.get('/technician/tickets', auth_1.authMiddleware, (req, res) => {
    const tickets = db_1.db.getInstallationTickets();
    res.json({ tickets });
});
// ==========================================
// 9. INTEGRACIÓN CON WISPRO (CLIENTES & SYNC)
// ==========================================
router.get('/wispro/clients', auth_1.authMiddleware, async (req, res) => {
    const { status, search } = req.query;
    const clients = await wispro_service_1.wisproService.getClients({
        status: status,
        search: search
    });
    res.json({ clients });
});
router.post('/wispro/sync', auth_1.authMiddleware, (0, auth_1.requireRole)(['ADMIN_BODEGA', 'ENCARGADO_PERSONAL']), async (req, res) => {
    const result = await wispro_service_1.wisproService.syncWithWispro();
    res.json(result);
});
router.get('/wispro/config', auth_1.authMiddleware, (req, res) => {
    const config = db_1.db.getWisproConfig();
    res.json({ config });
});
router.post('/wispro/config', auth_1.authMiddleware, (0, auth_1.requireRole)(['ADMIN_BODEGA']), (req, res) => {
    const { apiUrl, apiToken, autoSyncMinutes } = req.body;
    db_1.db.updateWisproConfig({ apiUrl, apiToken, autoSyncMinutes: Number(autoSyncMinutes) || 15 });
    res.json({ success: true, config: db_1.db.getWisproConfig() });
});
// ==========================================
// 10. MÉTRICAS DE PERSONAL Y MERMAS DE CABLE
// ==========================================
router.get('/metrics/personnel', auth_1.authMiddleware, (req, res) => {
    const metrics = inventory_service_1.inventoryService.getTechnicianMetrics();
    res.json({ metrics });
});
// ==========================================
// 11. SISTEMA & RESET PARA PRUEBAS
// ==========================================
router.post('/system/reset', auth_1.authMiddleware, (0, auth_1.requireRole)(['ADMIN_BODEGA']), (req, res) => {
    db_1.db.resetToDefaults();
    res.json({ message: 'Base de datos reiniciada con datos estándar de prueba' });
});
exports.default = router;
