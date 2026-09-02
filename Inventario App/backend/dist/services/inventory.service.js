"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inventoryService = exports.InventoryService = void 0;
const db_1 = require("../db");
const wispro_service_1 = require("./wispro.service");
class InventoryService {
    /**
     * Obtiene resumen global para el Dashboard Admin
     */
    getDashboardKPIs() {
        const serialized = db_1.db.getSerializedItems();
        const bulkStocks = db_1.db.getBulkStocks();
        const bulkItems = db_1.db.getBulkItems();
        const warehouses = db_1.db.getWarehouses();
        const transfers = db_1.db.getTransferOrders();
        // Total de equipos activos
        const totalSerializedActive = serialized.filter(i => i.status !== 'BAJA').length;
        // Alertas de stock crítico
        const criticalStockAlerts = [];
        bulkStocks.forEach(stock => {
            const item = bulkItems.find(b => b.id === stock.bulkItemId);
            if (item && stock.quantity < item.minStockAlert) {
                criticalStockAlerts.push({
                    warehouseName: stock.warehouseName || stock.warehouseId,
                    bulkItemName: stock.bulkItemName,
                    currentQuantity: stock.quantity,
                    minStockAlert: item.minStockAlert,
                    unitOfMeasure: stock.unitOfMeasure
                });
            }
        });
        // Equipos en RMA
        const rmaItems = serialized.filter(i => i.status === 'RMA_DEFECTUOSO');
        // Resumen de ONUs por estado
        const onusByStatus = {
            enBodega: serialized.filter(i => i.status === 'EN_BODEGA').length,
            enTransito: serialized.filter(i => i.status === 'EN_TRANSITO').length,
            enVehiculo: serialized.filter(i => i.status === 'EN_VEHICULO').length,
            instaladoCliente: serialized.filter(i => i.status === 'INSTALADO_CLIENTE').length,
            rmaDefectuoso: rmaItems.length,
            baja: serialized.filter(i => i.status === 'BAJA').length,
        };
        // Órdenes en tránsito activas
        const pendingTransfers = transfers.filter(t => t.status === 'EN_TRANSITO' || t.status === 'PENDIENTE');
        return {
            totalSerializedActive,
            criticalStockAlerts,
            rmaCount: rmaItems.length,
            rmaItems,
            onusByStatus,
            totalWarehouses: warehouses.length,
            pendingTransfersCount: pendingTransfers.length,
            pendingTransfers
        };
    }
    /**
     * Carga masiva de ONUs por escáner o lote
     */
    createSerializedItemsBatch(dto) {
        const warehouse = db_1.db.getWarehouses().find(w => w.id === dto.targetWarehouseId);
        if (!warehouse)
            throw new Error('Bodega de destino no existe.');
        const createdItems = [];
        const timestamp = new Date().toISOString();
        for (const item of dto.items) {
            const cleanMac = item.macAddress.trim().toUpperCase();
            const cleanSerial = item.serialNumber.trim().toUpperCase();
            // Verificar si ya existe
            const exists = db_1.db.getSerializedItems().find(i => i.macAddress.toUpperCase() === cleanMac);
            if (exists) {
                continue; // Omitir duplicados
            }
            const newItem = {
                id: `ser-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                macAddress: cleanMac,
                serialNumber: cleanSerial || `SN-${cleanMac.replace(/[^A-Z0-9]/g, '')}`,
                brand: dto.brand,
                model: dto.model,
                category: dto.category || 'ONU_GPON',
                currentWarehouseId: warehouse.id,
                currentWarehouseName: warehouse.name,
                status: warehouse.type === 'VEHICLE' ? 'EN_VEHICULO' : 'EN_BODEGA',
                createdAt: timestamp,
                updatedAt: timestamp
            };
            createdItems.push(newItem);
            db_1.db.addAuditLog({
                id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                macAddress: newItem.macAddress,
                serialNumber: newItem.serialNumber,
                eventType: 'ALTA_INVENTARIO',
                toWarehouseId: warehouse.id,
                toWarehouseName: warehouse.name,
                userId: dto.userId,
                userName: dto.userName,
                details: `Alta masiva por lote (${dto.brand} ${dto.model}) en ${warehouse.name}.`,
                timestamp
            });
        }
        db_1.db.addSerializedItemsBatch(createdItems);
        return {
            totalReceived: dto.items.length,
            totalCreated: createdItems.length,
            createdItems
        };
    }
    /**
     * Crea una nueva orden de traslado
     */
    createTransferOrder(dto) {
        const origin = db_1.db.getWarehouses().find(w => w.id === dto.originWarehouseId);
        const destination = db_1.db.getWarehouses().find(w => w.id === dto.destinationWarehouseId);
        const creator = db_1.db.getUsers().find(u => u.id === dto.createdById);
        if (!origin || !destination) {
            throw new Error('Bodega de origen o destino inválida.');
        }
        if (origin.id === destination.id) {
            throw new Error('La bodega de origen y destino no pueden ser la misma.');
        }
        const orderNumber = `TRF-${new Date().getFullYear()}-${String(db_1.db.getTransferOrders().length + 101).padStart(5, '0')}`;
        // Validar ítems seriados
        const serializedItemsDetails = [];
        for (const itemId of dto.serializedItemIds) {
            const item = db_1.db.getSerializedItems().find(i => i.id === itemId);
            if (!item)
                throw new Error(`Artículo seriado ${itemId} no encontrado.`);
            if (item.currentWarehouseId !== origin.id) {
                throw new Error(`El artículo ${item.brand} ${item.macAddress} no está en la bodega de origen (${origin.name}).`);
            }
            if (item.status === 'INSTALADO_CLIENTE' || item.status === 'BAJA') {
                throw new Error(`El artículo ${item.macAddress} no está disponible para traslado.`);
            }
            serializedItemsDetails.push(item);
        }
        // Preparar ítems granel
        const bulkItemsDetails = dto.bulkItems.map(bi => {
            const bulkItem = db_1.db.getBulkItems().find(b => b.id === bi.bulkItemId);
            if (!bulkItem)
                throw new Error(`Ítem granel ${bi.bulkItemId} no existe.`);
            // Verificar stock en origen
            const originStock = db_1.db.getBulkStocks().find(s => s.warehouseId === origin.id && s.bulkItemId === bi.bulkItemId);
            if (!originStock || originStock.quantity < bi.quantity) {
                throw new Error(`Stock insuficiente de ${bulkItem.name} en ${origin.name}. Disponible: ${originStock?.quantity || 0}, Solicitado: ${bi.quantity}`);
            }
            return {
                bulkItemId: bi.bulkItemId,
                bulkItemName: bulkItem.name,
                quantity: bi.quantity,
                unitOfMeasure: bulkItem.unitOfMeasure
            };
        });
        const newOrder = {
            id: `ord-trf-${Date.now()}`,
            orderNumber,
            originWarehouseId: origin.id,
            originWarehouseName: origin.name,
            destinationWarehouseId: destination.id,
            destinationWarehouseName: destination.name,
            status: 'EN_TRANSITO', // Se despacha de inmediato
            createdById: creator?.id || 'usr-admin-1',
            createdByName: creator?.name || 'Administrador',
            dispatchedById: creator?.id,
            dispatchedByName: creator?.name,
            dispatchedAt: new Date().toISOString(),
            notes: dto.notes,
            serializedItemIds: dto.serializedItemIds,
            bulkItems: bulkItemsDetails,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        // Descontar stock de origen y cambiar estado de ONUs a EN_TRANSITO
        for (const item of serializedItemsDetails) {
            db_1.db.updateSerializedItem(item.id, {
                status: 'EN_TRANSITO',
                currentWarehouseName: `En tránsito: ${origin.name} -> ${destination.name}`
            });
            db_1.db.addAuditLog({
                id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                macAddress: item.macAddress,
                serialNumber: item.serialNumber,
                eventType: 'DESPACHO_TRASLADO',
                fromWarehouseId: origin.id,
                fromWarehouseName: origin.name,
                toWarehouseId: destination.id,
                toWarehouseName: destination.name,
                userId: creator?.id || 'admin',
                userName: creator?.name || 'Admin',
                details: `Despachado en orden ${orderNumber}.`,
                timestamp: new Date().toISOString()
            });
        }
        for (const bi of dto.bulkItems) {
            db_1.db.updateBulkStockQuantity(origin.id, bi.bulkItemId, -bi.quantity);
        }
        db_1.db.addTransferOrder(newOrder);
        return newOrder;
    }
    /**
     * Confirma la recepción de una orden de traslado en el destino
     */
    receiveTransferOrder(orderId, receiverId) {
        const order = db_1.db.getTransferOrders().find(o => o.id === orderId);
        if (!order)
            throw new Error('Orden de traslado no encontrada.');
        if (order.status !== 'EN_TRANSITO') {
            throw new Error(`La orden no se puede recibir porque su estado es ${order.status}.`);
        }
        const receiver = db_1.db.getUsers().find(u => u.id === receiverId);
        const destination = db_1.db.getWarehouses().find(w => w.id === order.destinationWarehouseId);
        if (!destination)
            throw new Error('Bodega de destino no existe.');
        const newSerializedStatus = destination.type === 'VEHICLE' ? 'EN_VEHICULO' : 'EN_BODEGA';
        // Acreditar ítems seriados en destino
        for (const itemId of order.serializedItemIds) {
            const item = db_1.db.getSerializedItems().find(i => i.id === itemId);
            if (item) {
                db_1.db.updateSerializedItem(item.id, {
                    currentWarehouseId: destination.id,
                    currentWarehouseName: destination.name,
                    status: newSerializedStatus
                });
                db_1.db.addAuditLog({
                    id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                    macAddress: item.macAddress,
                    serialNumber: item.serialNumber,
                    eventType: 'RECEPCION_TRASLADO',
                    fromWarehouseId: order.originWarehouseId,
                    fromWarehouseName: order.originWarehouseName,
                    toWarehouseId: destination.id,
                    toWarehouseName: destination.name,
                    userId: receiver?.id || 'user',
                    userName: receiver?.name || 'Receptor',
                    details: `Recepción confirmada en ${destination.name} bajo orden ${order.orderNumber}.`,
                    timestamp: new Date().toISOString()
                });
            }
        }
        // Acreditar ítems granel en destino
        for (const bi of order.bulkItems) {
            db_1.db.updateBulkStockQuantity(destination.id, bi.bulkItemId, bi.quantity);
        }
        const updated = db_1.db.updateTransferOrder(order.id, {
            status: 'RECIBIDO',
            receivedById: receiver?.id,
            receivedByName: receiver?.name,
            receivedAt: new Date().toISOString()
        });
        return updated;
    }
    /**
     * Auditoría Forense por MAC o Serial: Historial completo de la vida del equipo
     */
    searchForensicHistory(query) {
        const q = query.trim().toUpperCase();
        const item = db_1.db.getSerializedItems().find(i => i.macAddress.toUpperCase() === q ||
            i.serialNumber.toUpperCase() === q ||
            i.id.toUpperCase() === q);
        const relatedLogs = db_1.db.getAuditLogs().filter(l => (l.macAddress && l.macAddress.toUpperCase() === q) ||
            (l.serialNumber && l.serialNumber.toUpperCase() === q) ||
            (item && l.macAddress === item.macAddress) ||
            (item && l.serialNumber === item.serialNumber)).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        let clientData = null;
        if (item?.installedClientId) {
            clientData = db_1.db.getWisproClients().find(c => c.id === item.installedClientId);
        }
        return {
            found: !!item,
            item,
            clientData,
            timeline: relatedLogs
        };
    }
    /**
     * Cierre de Ticket de Instalación por el Técnico (Descargo + Inyección Wispro)
     */
    async closeInstallationTicket(dto) {
        const tech = db_1.db.getUsers().find(u => u.id === dto.technicianId);
        if (!tech)
            throw new Error('Técnico no encontrado.');
        // Localizar bodega vehicular del técnico
        const vehicleWarehouse = db_1.db.getWarehouses().find(w => w.id === tech.assignedWarehouseId || w.managerId === tech.id);
        if (!vehicleWarehouse) {
            throw new Error(`El técnico ${tech.name} no tiene una bodega vehicular (camioneta) asignada.`);
        }
        // Obtener cliente de Wispro
        const client = db_1.db.getWisproClients().find(c => c.id === dto.wisproClientId);
        if (!client)
            throw new Error('Cliente de Wispro no encontrado.');
        // 1. Validar y descontar ONU instalada
        let installedOnu;
        if (dto.installedOnuMac) {
            const macClean = dto.installedOnuMac.trim().toUpperCase();
            installedOnu = db_1.db.getSerializedItems().find(i => i.macAddress.toUpperCase() === macClean || i.serialNumber.toUpperCase() === macClean);
            if (!installedOnu) {
                throw new Error(`La ONU con MAC/SN '${dto.installedOnuMac}' no existe en el sistema.`);
            }
            if (installedOnu.currentWarehouseId !== vehicleWarehouse.id) {
                throw new Error(`La ONU ${installedOnu.macAddress} no está en tu camioneta (${vehicleWarehouse.name}). Está en: ${installedOnu.currentWarehouseName || installedOnu.currentWarehouseId}.`);
            }
            if (installedOnu.status === 'INSTALADO_CLIENTE') {
                throw new Error(`La ONU ${installedOnu.macAddress} ya se encuentra instalada en otro cliente.`);
            }
        }
        // 2. Descontar materiales a granel de la camioneta
        if (dto.cableDropMetersUsed > 0) {
            db_1.db.updateBulkStockQuantity(vehicleWarehouse.id, 'blk-cable-drop-1h', -dto.cableDropMetersUsed);
        }
        if (dto.connectorsUsed > 0) {
            db_1.db.updateBulkStockQuantity(vehicleWarehouse.id, 'blk-conector-scapc', -dto.connectorsUsed);
        }
        if (dto.tensorsUsed > 0) {
            db_1.db.updateBulkStockQuantity(vehicleWarehouse.id, 'blk-tensor-drop', -dto.tensorsUsed);
        }
        const ticketNumber = `TCK-${new Date().getFullYear()}-${String(db_1.db.getInstallationTickets().length + 1000).padStart(4, '0')}`;
        // 3. Aprovisionar en Wispro
        let wisproSyncResult;
        if (installedOnu) {
            wisproSyncResult = await wispro_service_1.wisproService.provisionOnuToContract({
                contractId: client.contractId,
                onuMac: installedOnu.macAddress,
                onuSerial: installedOnu.serialNumber,
                technicianName: tech.name,
                notes: dto.notes
            });
        }
        // 4. Actualizar estado de la ONU
        if (installedOnu) {
            db_1.db.updateSerializedItem(installedOnu.id, {
                status: 'INSTALADO_CLIENTE',
                installedClientId: client.id,
                installedClientName: client.name,
                installedContractId: client.contractId,
                installedTicketId: ticketNumber,
                installedDate: new Date().toISOString(),
                currentWarehouseName: `Cliente: ${client.name} (${client.address})`
            });
            // Registrar auditoría
            db_1.db.addAuditLog({
                id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                macAddress: installedOnu.macAddress,
                serialNumber: installedOnu.serialNumber,
                eventType: 'INSTALACION_CLIENTE',
                fromWarehouseId: vehicleWarehouse.id,
                fromWarehouseName: vehicleWarehouse.name,
                userId: tech.id,
                userName: tech.name,
                details: `Instalado en ${client.name} (${client.address}) bajo ticket ${ticketNumber}. Integrado a Wispro (${client.contractId}).`,
                timestamp: new Date().toISOString()
            });
        }
        // 5. Crear Ticket de Instalación
        const ticket = {
            id: `tck-${Date.now()}`,
            ticketNumber,
            type: 'INSTALACION_NUEVA',
            wisproClientId: client.id,
            wisproClientName: client.name,
            wisproContractId: client.contractId,
            wisproNode: client.nodeName,
            clientAddress: client.address,
            technicianId: tech.id,
            technicianName: tech.name,
            vehicleWarehouseId: vehicleWarehouse.id,
            installedOnuMac: installedOnu?.macAddress,
            installedOnuSerial: installedOnu?.serialNumber,
            cableDropMetersUsed: dto.cableDropMetersUsed,
            connectorsUsed: dto.connectorsUsed,
            tensorsUsed: dto.tensorsUsed,
            otherMaterialsUsed: dto.otherMaterialsUsed,
            installationPhotoUrl: dto.installationPhotoUrl,
            notes: dto.notes,
            wisproSynced: wisproSyncResult?.success ?? true,
            wisproSyncMessage: wisproSyncResult?.message || 'Sincronizado con Wispro',
            createdAt: new Date().toISOString()
        };
        db_1.db.addInstallationTicket(ticket);
        return ticket;
    }
    /**
     * Métricas de rendimiento y consumo de cable Drop por técnico/cuadrilla
     */
    getTechnicianMetrics() {
        const tickets = db_1.db.getInstallationTickets();
        const technicians = db_1.db.getUsers().filter(u => u.role === 'TECNICO_LIDER');
        const metrics = technicians.map(tech => {
            const techTickets = tickets.filter(t => t.technicianId === tech.id);
            const totalMeters = techTickets.reduce((sum, t) => sum + (t.cableDropMetersUsed || 0), 0);
            const totalInstalls = techTickets.length;
            const avgMeters = totalInstalls > 0 ? Math.round(totalMeters / totalInstalls) : 0;
            const totalConnectors = techTickets.reduce((sum, t) => sum + (t.connectorsUsed || 0), 0);
            // Si el promedio de drop supera 110 metros por instalación, alerta por posible merma o desvío
            const isAnomaly = avgMeters > 110;
            return {
                technicianId: tech.id,
                technicianName: tech.name,
                assignedWarehouse: db_1.db.getWarehouses().find(w => w.id === tech.assignedWarehouseId)?.name || 'Camioneta',
                totalInstalls,
                totalMetersConsumed: totalMeters,
                avgMetersPerInstall: avgMeters,
                totalConnectorsUsed: totalConnectors,
                isAnomaly,
                anomalyWarning: isAnomaly
                    ? `Alerta de sobreconsumo: Promedio de ${avgMeters}m por instalación supera el umbral estándar (110m).`
                    : null
            };
        });
        return metrics;
    }
}
exports.InventoryService = InventoryService;
exports.inventoryService = new InventoryService();
