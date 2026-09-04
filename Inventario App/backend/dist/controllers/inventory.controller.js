"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inventoryController = exports.InventoryController = void 0;
const db_1 = require("../db");
const client_1 = require("@prisma/client");
class InventoryController {
    /**
     * Endpoint transaccional para dar de alta stock físico (Inbound Inventory)
     * POST /api/inventory/inbound
     */
    static async inboundInventory(req, res) {
        try {
            const { warehouseId, productId, trackingType: requestedTrackingType, quantity, batchNumber, initialQuantity, batches, items, notes } = req.body;
            if (!warehouseId) {
                res.status(400).json({
                    success: false,
                    error: 'La bodega de destino (warehouseId) es obligatoria'
                });
                return;
            }
            if (!productId) {
                res.status(400).json({
                    success: false,
                    error: 'El producto del catálogo (productId) es obligatorio'
                });
                return;
            }
            // Validar que la bodega exista
            const warehouse = await db_1.prisma.warehouse.findUnique({
                where: { id: warehouseId }
            });
            if (!warehouse) {
                res.status(404).json({
                    success: false,
                    error: `Bodega destino no encontrada (ID: ${warehouseId})`
                });
                return;
            }
            // Validar que el producto exista en el Catálogo
            const product = await db_1.prisma.productCatalog.findUnique({
                where: { id: productId }
            });
            if (!product) {
                res.status(404).json({
                    success: false,
                    error: `Producto no encontrado en el catálogo (ID: ${productId})`
                });
                return;
            }
            const activeTrackingType = product.trackingType || requestedTrackingType;
            // Obtener o asignar usuario para auditoría (o usuario default si no está autenticado)
            const activeUserId = req.user?.id || req.headers['x-user-id'] || null;
            let systemUser = null;
            if (activeUserId) {
                systemUser = await db_1.prisma.user.findUnique({ where: { id: activeUserId } });
            }
            if (!systemUser) {
                systemUser = await db_1.prisma.user.findFirst();
            }
            // ─────────────────────────────────────────────────────────────
            // CASO 1: BULK (Control Granel / Unidades)
            // ─────────────────────────────────────────────────────────────
            if (activeTrackingType === client_1.TrackingType.BULK) {
                const qty = Number(quantity);
                if (isNaN(qty) || qty <= 0) {
                    res.status(400).json({
                        success: false,
                        error: 'Para artículos a granel se debe especificar una cantidad numérica mayor a cero'
                    });
                    return;
                }
                const result = await db_1.prisma.$transaction(async (tx) => {
                    // Upsert en BulkStock
                    const bulkStock = await tx.bulkStock.upsert({
                        where: {
                            productId_warehouseId: {
                                productId,
                                warehouseId
                            }
                        },
                        create: {
                            productId,
                            warehouseId,
                            quantity: qty
                        },
                        update: {
                            quantity: { increment: qty }
                        }
                    });
                    // Registro en Auditoría Forense
                    if (systemUser) {
                        await tx.auditLog.create({
                            data: {
                                eventType: client_1.AuditEventType.ALTA_INVENTARIO,
                                toWarehouseId: warehouseId,
                                userId: systemUser.id,
                                details: `Ingreso a Granel: +${qty} ${product.unitOfMeasure} de "${product.name}" (${product.sku}) en bodega ${warehouse.name}. Stock total: ${bulkStock.quantity}. ${notes ? `Nota: ${notes}` : ''}`
                            }
                        });
                    }
                    return bulkStock;
                });
                res.status(201).json({
                    success: true,
                    message: `Se ingresaron exitosamente ${qty} ${product.unitOfMeasure} de "${product.name}" a ${warehouse.name}`,
                    type: 'BULK',
                    bulkStock: result
                });
                return;
            }
            // ─────────────────────────────────────────────────────────────
            // CASO 2: BATCHED (Control por Lotes / Bobinas de Cable)
            // ─────────────────────────────────────────────────────────────
            if (activeTrackingType === client_1.TrackingType.BATCHED) {
                // Soporte tanto para una sola bobina como para una lista de bobinas
                const batchList = [];
                if (Array.isArray(batches) && batches.length > 0) {
                    for (const b of batches) {
                        if (b.batchNumber && Number(b.initialQuantity) > 0) {
                            batchList.push({
                                batchNumber: String(b.batchNumber).trim().toUpperCase(),
                                initialQuantity: Number(b.initialQuantity),
                                notes: b.notes?.trim() || notes || undefined
                            });
                        }
                    }
                }
                else if (batchNumber && Number(initialQuantity) > 0) {
                    batchList.push({
                        batchNumber: String(batchNumber).trim().toUpperCase(),
                        initialQuantity: Number(initialQuantity),
                        notes: notes?.trim() || undefined
                    });
                }
                if (batchList.length === 0) {
                    res.status(400).json({
                        success: false,
                        error: 'Debe ingresar al menos un número de lote/bobina válido con su metraje o cantidad inicial mayor a cero'
                    });
                    return;
                }
                // Validar si algún lote ya existe para este producto
                const batchNumbers = batchList.map(b => b.batchNumber);
                const existingBatches = await db_1.prisma.batchItem.findMany({
                    where: {
                        productId,
                        batchNumber: { in: batchNumbers }
                    }
                });
                if (existingBatches.length > 0) {
                    const dups = existingBatches.map(b => b.batchNumber).join(', ');
                    res.status(409).json({
                        success: false,
                        error: `Los siguientes números de lote/bobina ya se encuentran registrados para este producto: ${dups}`
                    });
                    return;
                }
                const resultBatches = await db_1.prisma.$transaction(async (tx) => {
                    const createdList = [];
                    for (const b of batchList) {
                        const batch = await tx.batchItem.create({
                            data: {
                                productId,
                                currentWarehouseId: warehouseId,
                                batchNumber: b.batchNumber,
                                initialQuantity: b.initialQuantity,
                                currentQuantity: b.initialQuantity,
                                unitOfMeasure: product.unitOfMeasure,
                                status: client_1.BatchStatus.DISPONIBLE,
                                notes: b.notes || null
                            }
                        });
                        if (systemUser) {
                            await tx.auditLog.create({
                                data: {
                                    eventType: client_1.AuditEventType.ALTA_INVENTARIO,
                                    batchNumber: b.batchNumber,
                                    toWarehouseId: warehouseId,
                                    userId: systemUser.id,
                                    details: `Ingreso de Bobina/Lote: ${b.batchNumber} (${b.initialQuantity} ${product.unitOfMeasure}) de "${product.name}" en bodega ${warehouse.name}`
                                }
                            });
                        }
                        createdList.push(batch);
                    }
                    return createdList;
                });
                res.status(201).json({
                    success: true,
                    message: `Se ingresaron ${resultBatches.length} bobina(s)/lote(s) de "${product.name}" en ${warehouse.name}`,
                    type: 'BATCHED',
                    batches: resultBatches
                });
                return;
            }
            // ─────────────────────────────────────────────────────────────
            // CASO 3: SERIALIZED (Control Individual por MAC / Serial)
            // ─────────────────────────────────────────────────────────────
            if (activeTrackingType === client_1.TrackingType.SERIALIZED) {
                if (!Array.isArray(items) || items.length === 0) {
                    res.status(400).json({
                        success: false,
                        error: 'Para artículos seriados se debe enviar un listado (array) con al menos un equipo { macAddress, serialNumber }'
                    });
                    return;
                }
                // Sanitizar y validar
                const sanitizedItems = [];
                const macSet = new Set();
                const serialSet = new Set();
                for (let i = 0; i < items.length; i++) {
                    const rawMac = String(items[i].macAddress || '').trim().toUpperCase();
                    const rawSerial = String(items[i].serialNumber || '').trim().toUpperCase();
                    const rawVerificationCode = String(items[i].verificationCode || '').trim().toUpperCase();
                    if (!rawSerial) {
                        res.status(400).json({
                            success: false,
                            error: `El ítem en la posición #${i + 1} debe contener un Número de Serie (S/N)`
                        });
                        return;
                    }
                    if (rawMac && macSet.has(rawMac)) {
                        res.status(400).json({
                            success: false,
                            error: `La MAC Address "${rawMac}" está duplicada dentro del lote a ingresar`
                        });
                        return;
                    }
                    if (serialSet.has(rawSerial)) {
                        res.status(400).json({
                            success: false,
                            error: `El Serial "${rawSerial}" está duplicado dentro del lote a ingresar`
                        });
                        return;
                    }
                    if (rawMac)
                        macSet.add(rawMac);
                    serialSet.add(rawSerial);
                    sanitizedItems.push({
                        macAddress: rawMac || undefined,
                        serialNumber: rawSerial,
                        verificationCode: rawVerificationCode || undefined,
                        notes: items[i].notes?.trim() || notes?.trim() || undefined
                    });
                }
                // Verificar colisiones con la base de datos
                const allMacs = sanitizedItems.map(i => i.macAddress).filter(Boolean);
                const allSerials = sanitizedItems.map(i => i.serialNumber);
                const orConditions = [{ serialNumber: { in: allSerials } }];
                if (allMacs.length > 0) {
                    orConditions.push({ macAddress: { in: allMacs } });
                }
                const existingItems = await db_1.prisma.serializedItem.findMany({
                    where: { OR: orConditions }
                });
                if (existingItems.length > 0) {
                    const conflicting = existingItems.map(e => `S/N: ${e.serialNumber}${e.macAddress ? ` (MAC: ${e.macAddress})` : ''}`).join(', ');
                    res.status(409).json({
                        success: false,
                        error: `Los siguientes equipos ya existen registrados en el inventario: ${conflicting}`
                    });
                    return;
                }
                // Inserción transaccional
                const createdSerialized = await db_1.prisma.$transaction(async (tx) => {
                    const list = [];
                    for (const item of sanitizedItems) {
                        const created = await tx.serializedItem.create({
                            data: {
                                productId,
                                currentWarehouseId: warehouseId,
                                macAddress: item.macAddress || null,
                                serialNumber: item.serialNumber,
                                verificationCode: item.verificationCode || null,
                                status: client_1.SerializedStatus.EN_BODEGA,
                                notes: item.notes || null
                            }
                        });
                        if (systemUser) {
                            await tx.auditLog.create({
                                data: {
                                    eventType: client_1.AuditEventType.ALTA_INVENTARIO,
                                    macAddress: item.macAddress || null,
                                    serialNumber: item.serialNumber,
                                    toWarehouseId: warehouseId,
                                    userId: systemUser.id,
                                    details: `Alta de Equipo Seriado: ${product.name} (S/N: ${item.serialNumber}${item.macAddress ? `, MAC: ${item.macAddress}` : ''}${item.verificationCode ? `, Code: ${item.verificationCode}` : ''}) en bodega ${warehouse.name}`
                                }
                            });
                        }
                        list.push(created);
                    }
                    return list;
                });
                res.status(201).json({
                    success: true,
                    message: `Se registraron exitosamente ${createdSerialized.length} equipo(s) seriado(s) de "${product.name}" en ${warehouse.name}`,
                    type: 'SERIALIZED',
                    count: createdSerialized.length,
                    items: createdSerialized
                });
                return;
            }
            res.status(400).json({
                success: false,
                error: `Tipo de seguimiento no soportado: ${activeTrackingType}`
            });
        }
        catch (error) {
            console.error('Error en Inbound Inventory:', error);
            res.status(500).json({
                success: false,
                error: 'Error interno al procesar el ingreso de inventario',
                details: error.message
            });
        }
    }
}
exports.InventoryController = InventoryController;
exports.inventoryController = new InventoryController();
exports.default = InventoryController;
