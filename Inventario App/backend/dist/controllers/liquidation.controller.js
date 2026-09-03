"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiquidationController = void 0;
const db_1 = require("../db");
const client_1 = require("@prisma/client");
class LiquidationController {
    /**
     * Obtiene el listado de tickets o liquidaciones realizadas
     * GET /api/liquidations
     */
    static async getLiquidations(req, res) {
        try {
            const { vehicleWarehouseId, technicianId, search } = req.query;
            const where = {};
            if (vehicleWarehouseId && typeof vehicleWarehouseId === 'string') {
                where.vehicleWarehouseId = vehicleWarehouseId;
            }
            if (technicianId && typeof technicianId === 'string') {
                where.technicianId = technicianId;
            }
            if (search && typeof search === 'string') {
                const q = search.trim();
                where.OR = [
                    { ticketNumber: { contains: q, mode: 'insensitive' } },
                    { wisproClientName: { contains: q, mode: 'insensitive' } },
                    { clientAddress: { contains: q, mode: 'insensitive' } },
                    { installedOnuMac: { contains: q, mode: 'insensitive' } }
                ];
            }
            const tickets = await db_1.prisma.installationTicket.findMany({
                where,
                include: {
                    technician: {
                        select: { id: true, name: true, email: true, phone: true }
                    },
                    vehicleWarehouse: true
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });
            res.status(200).json({
                success: true,
                count: tickets.length,
                tickets
            });
        }
        catch (error) {
            console.error('Error al obtener liquidaciones:', error);
            res.status(500).json({
                success: false,
                error: 'Error interno al consultar las liquidaciones',
                details: error.message
            });
        }
    }
    /**
     * Endpoint transaccional para liquidar y consumir material en campo
     * POST /api/liquidations/consume
     */
    static async consumeLiquidation(req, res) {
        try {
            const { vehicleWarehouseId, technicianId: explicitTechId, ticketNumber, ticketId, ticketType = 'INSTALACION_NUEVA', wisproClientId, clientName, contractId, clientAddress, wisproNode, installedOnuMac, installedRouterMac, retiredDeviceMac, retiredDeviceStatus, batchedUsage, // { batchId, batchNumber, metersUsed }
            bulkUsage, // [{ productId, quantity }] o { connectorsUsed, tensorsUsed, otherMaterials }
            connectorsUsed = 0, tensorsUsed = 0, otherMaterialsUsed, notes, installationPhotoUrl } = req.body;
            if (!vehicleWarehouseId) {
                res.status(400).json({
                    success: false,
                    error: 'El ID de la bodega del vehículo (vehicleWarehouseId) es obligatorio'
                });
                return;
            }
            // Validar que la bodega exista y sea preferiblemente tipo VEHICULO o SUCURSAL
            const vehicleWarehouse = await db_1.prisma.warehouse.findUnique({
                where: { id: vehicleWarehouseId },
                include: { manager: true }
            });
            if (!vehicleWarehouse) {
                res.status(404).json({
                    success: false,
                    error: 'Bodega de vehículo no encontrada'
                });
                return;
            }
            // Determinar técnico responsable
            let finalTechId = explicitTechId || vehicleWarehouse.managerId;
            if (!finalTechId) {
                const defaultTech = await db_1.prisma.user.findFirst();
                finalTechId = defaultTech?.id || 'usr-default';
            }
            const finalTicketNumber = ticketNumber || ticketId || `TCK-${Date.now().toString().slice(-6)}`;
            const finalClientName = clientName || 'Cliente Residencial';
            const finalContractId = contractId || `CTR-${Date.now().toString().slice(-6)}`;
            const finalClientId = wisproClientId || `WISP-${Date.now().toString().slice(-6)}`;
            const finalAddress = clientAddress || vehicleWarehouse.address || 'Panamá';
            // ─────────────────────────────────────────────────────────────
            // VALIDACIÓN PREVIA DE EXISTENCIAS EN EL VEHÍCULO
            // ─────────────────────────────────────────────────────────────
            // 1. Validar ONU / Equipo Seriado si se especificó
            let targetOnu = null;
            if (installedOnuMac) {
                const cleanMac = String(installedOnuMac).trim().toUpperCase();
                targetOnu = await db_1.prisma.serializedItem.findFirst({
                    where: {
                        macAddress: cleanMac,
                        currentWarehouseId: vehicleWarehouseId
                    },
                    include: { product: true }
                });
                if (!targetOnu) {
                    res.status(400).json({
                        success: false,
                        error: `El equipo con MAC ${cleanMac} no se encuentra asignado físicamente en la bodega de este vehículo (${vehicleWarehouse.name})`
                    });
                    return;
                }
                if (targetOnu.status === client_1.SerializedStatus.INSTALADO_CLIENTE) {
                    res.status(400).json({
                        success: false,
                        error: `El equipo con MAC ${cleanMac} ya figura como INSTALADO en otro cliente (${targetOnu.installedClientName || 'Wispro'})`
                    });
                    return;
                }
            }
            // 2. Validar Bobina / Cable Drop
            let targetBatch = null;
            let metersToDeduct = 0;
            if (batchedUsage && (batchedUsage.batchId || batchedUsage.batchNumber) && Number(batchedUsage.metersUsed) > 0) {
                metersToDeduct = Number(batchedUsage.metersUsed);
                targetBatch = await db_1.prisma.batchItem.findFirst({
                    where: {
                        currentWarehouseId: vehicleWarehouseId,
                        OR: [
                            { id: batchedUsage.batchId || undefined },
                            { batchNumber: batchedUsage.batchNumber?.trim().toUpperCase() || undefined }
                        ],
                        status: client_1.BatchStatus.DISPONIBLE
                    },
                    include: { product: true }
                });
                if (!targetBatch) {
                    res.status(400).json({
                        success: false,
                        error: `La bobina especificada no está disponible en este vehículo`
                    });
                    return;
                }
                if (targetBatch.currentQuantity < metersToDeduct) {
                    res.status(400).json({
                        success: false,
                        error: `Metraje insuficiente en la bobina ${targetBatch.batchNumber}. Disponible: ${targetBatch.currentQuantity}m, Solicitado para liquidar: ${metersToDeduct}m`
                    });
                    return;
                }
            }
            // 3. Validar Granel en el vehículo
            const sanitizedBulkUsage = [];
            if (Array.isArray(bulkUsage)) {
                for (const b of bulkUsage) {
                    if (b.productId && Number(b.quantity) > 0) {
                        sanitizedBulkUsage.push({ productId: b.productId, quantity: Number(b.quantity) });
                    }
                }
            }
            // ─────────────────────────────────────────────────────────────
            // EJECUCIÓN TRANSACCIONAL DEL CONSUMO (Prisma $transaction)
            // ─────────────────────────────────────────────────────────────
            const result = await db_1.prisma.$transaction(async (tx) => {
                // A. Actualizar estado de la ONU instalada
                if (targetOnu) {
                    await tx.serializedItem.update({
                        where: { id: targetOnu.id },
                        data: {
                            status: client_1.SerializedStatus.INSTALADO_CLIENTE,
                            installedTicketId: finalTicketNumber,
                            installedClientId: finalClientId,
                            installedClientName: finalClientName,
                            installedContractId: finalContractId,
                            installedDate: new Date(),
                            notes: `Instalado en cliente ${finalClientName}. ${notes || ''}`
                        }
                    });
                    // Auditoría de ONU instalada
                    await tx.auditLog.create({
                        data: {
                            eventType: client_1.AuditEventType.INSTALACION_CLIENTE,
                            macAddress: targetOnu.macAddress,
                            serialNumber: targetOnu.serialNumber,
                            fromWarehouseId: vehicleWarehouseId,
                            userId: finalTechId,
                            details: `Equipo Seriado ${targetOnu.product?.name || 'ONU'} (MAC: ${targetOnu.macAddress}) instalado en cliente ${finalClientName} (Ticket ${finalTicketNumber})`
                        }
                    });
                }
                // B. Descontar metraje de la Bobina
                if (targetBatch && metersToDeduct > 0) {
                    const remanente = targetBatch.currentQuantity - metersToDeduct;
                    const isAgotado = remanente <= 0;
                    await tx.batchItem.update({
                        where: { id: targetBatch.id },
                        data: {
                            currentQuantity: Math.max(0, remanente),
                            status: isAgotado ? client_1.BatchStatus.AGOTADO : client_1.BatchStatus.DISPONIBLE
                        }
                    });
                    // Auditoría de consumo de cable
                    await tx.auditLog.create({
                        data: {
                            eventType: client_1.AuditEventType.CONSUMO_BOBINA,
                            batchNumber: targetBatch.batchNumber,
                            fromWarehouseId: vehicleWarehouseId,
                            userId: finalTechId,
                            details: `Consumo de ${metersToDeduct}m de cable drop de la bobina ${targetBatch.batchNumber} en ticket ${finalTicketNumber}. Remanente actual: ${Math.max(0, remanente)}m`
                        }
                    });
                }
                // C. Descontar existencias a granel en el vehículo
                for (const b of sanitizedBulkUsage) {
                    const currentStock = await tx.bulkStock.findUnique({
                        where: {
                            productId_warehouseId: {
                                productId: b.productId,
                                warehouseId: vehicleWarehouseId
                            }
                        }
                    });
                    if (currentStock) {
                        const newQty = Math.max(0, currentStock.quantity - b.quantity);
                        await tx.bulkStock.update({
                            where: { id: currentStock.id },
                            data: { quantity: newQty }
                        });
                    }
                }
                // D. Registrar el Ticket de Liquidación
                const ticket = await tx.installationTicket.create({
                    data: {
                        ticketNumber: finalTicketNumber,
                        type: ticketType,
                        wisproClientId: finalClientId,
                        wisproClientName: finalClientName,
                        wisproContractId: finalContractId,
                        wisproNode: wisproNode || null,
                        clientAddress: finalAddress,
                        technicianId: finalTechId,
                        vehicleWarehouseId: vehicleWarehouseId,
                        installedOnuMac: targetOnu?.macAddress || installedOnuMac || null,
                        installedOnuSerial: targetOnu?.serialNumber || null,
                        installedRouterMac: installedRouterMac || null,
                        retiredDeviceMac: retiredDeviceMac || null,
                        retiredDeviceStatus: retiredDeviceStatus ? retiredDeviceStatus : null,
                        usedSpoolBatchNumber: targetBatch?.batchNumber || null,
                        cableDropMetersUsed: metersToDeduct,
                        connectorsUsed: Number(connectorsUsed) || 0,
                        tensorsUsed: Number(tensorsUsed) || 0,
                        otherMaterialsUsed: otherMaterialsUsed || null,
                        installationPhotoUrl: installationPhotoUrl || null,
                        notes: notes || null,
                        wisproSynced: true,
                        wisproSyncMessage: 'Liquidado y sincronizado automáticamente'
                    },
                    include: {
                        technician: { select: { id: true, name: true, email: true } },
                        vehicleWarehouse: true
                    }
                });
                return ticket;
            });
            res.status(201).json({
                success: true,
                message: `Liquidación del ticket ${result.ticketNumber} registrada exitosamente. Materiales descontados del vehículo ${vehicleWarehouse.name}.`,
                ticket: result
            });
        }
        catch (error) {
            console.error('Error al procesar liquidación:', error);
            res.status(500).json({
                success: false,
                error: 'Error interno al procesar la liquidación de materiales',
                details: error.message
            });
        }
    }
}
exports.LiquidationController = LiquidationController;
