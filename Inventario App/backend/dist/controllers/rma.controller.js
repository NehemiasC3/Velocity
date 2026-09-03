"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RMAController = void 0;
const db_1 = require("../db");
const client_1 = require("@prisma/client");
class RMAController {
    /**
     * Búsqueda rápida de un equipo por MAC o Serial para validar a quién pertenecía antes del retiro
     * GET /api/rma/lookup/:query
     */
    static async lookupDevice(req, res) {
        try {
            const { query } = req.params;
            const clean = String(query).trim().toUpperCase();
            if (!clean) {
                res.status(400).json({ success: false, error: 'Debe ingresar una MAC o número de serie' });
                return;
            }
            const item = await db_1.prisma.serializedItem.findFirst({
                where: {
                    OR: [
                        { macAddress: clean },
                        { serialNumber: clean }
                    ]
                },
                include: {
                    product: true,
                    currentWarehouse: true
                }
            });
            if (!item) {
                res.status(404).json({
                    success: false,
                    error: `No se encontró ningún equipo con MAC o Serial "${clean}" en el sistema.`
                });
                return;
            }
            res.status(200).json({
                success: true,
                item,
                isInstalledInClient: item.status === client_1.SerializedStatus.INSTALADO_CLIENTE || !!item.installedClientName,
                installedClientName: item.installedClientName || 'Sin cliente asignado',
                installedTicketId: item.installedTicketId || 'N/A',
                installedContractId: item.installedContractId || 'N/A',
                installedDate: item.installedDate || null,
                currentLocation: item.currentWarehouse?.name || 'Ubicación desconocida'
            });
        }
        catch (error) {
            console.error('Error en lookup de RMA:', error);
            res.status(500).json({
                success: false,
                error: 'Error interno al consultar el equipo',
                details: error.message
            });
        }
    }
    /**
     * Registra el retiro / devolución / RMA de un equipo en campo
     * POST /api/rma/return
     */
    static async returnEquipment(req, res) {
        try {
            const { macAddress, serialNumber, vehicleWarehouseId, targetWarehouseId, reason = 'FALLA_EQUIPO', // DANO_ELECTRICO, CANCELACION, FALLA_PUERTO, ACTUALIZACION, MIGRACION
            deviceCondition = 'DEFECTUOSO_RMA', // DEFECTUOSO_RMA | OPERATIVO_BUENO
            notes } = req.body;
            const cleanQuery = (macAddress || serialNumber || '').trim().toUpperCase();
            if (!cleanQuery) {
                res.status(400).json({
                    success: false,
                    error: 'Debe proporcionar la dirección MAC o Número de Serie del equipo a retirar'
                });
                return;
            }
            // 1. Buscar el equipo
            const item = await db_1.prisma.serializedItem.findFirst({
                where: {
                    OR: [
                        { macAddress: cleanQuery },
                        { serialNumber: cleanQuery }
                    ]
                },
                include: {
                    product: true,
                    currentWarehouse: true
                }
            });
            if (!item) {
                res.status(404).json({
                    success: false,
                    error: `Equipo con identificador "${cleanQuery}" no existe en la base de datos.`
                });
                return;
            }
            // 2. Determinar la bodega destino de la devolución
            let destinationWarehouseId = targetWarehouseId;
            if (!destinationWarehouseId) {
                if (deviceCondition === 'DEFECTUOSO_RMA') {
                    // Buscar la bodega de cuarentena / RMA principal
                    const rmaWarehouse = await db_1.prisma.warehouse.findFirst({
                        where: { type: client_1.WarehouseType.CUARENTENA_RMA }
                    });
                    destinationWarehouseId = rmaWarehouse ? rmaWarehouse.id : vehicleWarehouseId || item.currentWarehouseId;
                }
                else {
                    // Si está bueno, va a la camioneta del técnico o a sucursal
                    destinationWarehouseId = vehicleWarehouseId || item.currentWarehouseId;
                }
            }
            const destWarehouse = await db_1.prisma.warehouse.findUnique({
                where: { id: destinationWarehouseId }
            });
            const prevClient = item.installedClientName || 'Cliente No Identificado';
            const prevTicket = item.installedTicketId || 'N/A';
            const prevLocation = item.currentWarehouse?.name || 'Bodega Previa';
            // 3. Ejecutar la transacción de Logística Inversa
            const result = await db_1.prisma.$transaction(async (tx) => {
                const newStatus = deviceCondition === 'DEFECTUOSO_RMA'
                    ? client_1.SerializedStatus.RMA_DEFECTUOSO
                    : (destWarehouse?.type === client_1.WarehouseType.VEHICULO ? client_1.SerializedStatus.EN_VEHICULO : client_1.SerializedStatus.EN_BODEGA);
                const updated = await tx.serializedItem.update({
                    where: { id: item.id },
                    data: {
                        status: newStatus,
                        currentWarehouseId: destinationWarehouseId,
                        installedTicketId: null,
                        installedClientId: null,
                        installedClientName: null,
                        installedContractId: null,
                        installedDate: null,
                        notes: `[RETIRADO / RMA] Motivo: ${reason} (${deviceCondition}). Cliente previo: ${prevClient} (Ticket: ${prevTicket}). ${notes ? `Obs: ${notes}` : ''}`
                    },
                    include: {
                        product: true,
                        currentWarehouse: true
                    }
                });
                // Registrar en Auditoría Forense
                const auditUserId = req.user?.id || 'usr-admin-1';
                await tx.auditLog.create({
                    data: {
                        eventType: client_1.AuditEventType.RETIRO_CLIENTE,
                        macAddress: item.macAddress,
                        serialNumber: item.serialNumber,
                        fromWarehouseId: item.currentWarehouseId,
                        toWarehouseId: destinationWarehouseId,
                        userId: auditUserId,
                        details: `Recuperación de equipo ${item.product?.name || 'ONU'} (MAC: ${item.macAddress}) retirado de ${prevClient}. Motivo: ${reason}. Reubicado en ${destWarehouse?.name || destinationWarehouseId} con estado ${newStatus}.`
                    }
                });
                return updated;
            });
            res.status(200).json({
                success: true,
                message: `Equipo ${result.macAddress} recuperado exitosamente y trasladado a ${destWarehouse?.name || 'Cuarentena/Vehículo'}.`,
                item: result,
                previousClient: prevClient
            });
        }
        catch (error) {
            console.error('Error al procesar devolución RMA:', error);
            res.status(500).json({
                success: false,
                error: 'Error interno al procesar la devolución del equipo',
                details: error.message
            });
        }
    }
    /**
     * Obtiene la lista de todos los equipos en RMA / Cuarentena
     * GET /api/rma/items
     */
    static async getRmaItems(req, res) {
        try {
            const items = await db_1.prisma.serializedItem.findMany({
                where: {
                    OR: [
                        { status: client_1.SerializedStatus.RMA_DEFECTUOSO },
                        { currentWarehouse: { type: client_1.WarehouseType.CUARENTENA_RMA } }
                    ]
                },
                include: {
                    product: true,
                    currentWarehouse: true
                },
                orderBy: {
                    updatedAt: 'desc'
                }
            });
            res.status(200).json({
                success: true,
                count: items.length,
                items
            });
        }
        catch (error) {
            console.error('Error al obtener ítems RMA:', error);
            res.status(500).json({
                success: false,
                error: 'Error interno al consultar ítems en RMA',
                details: error.message
            });
        }
    }
}
exports.RMAController = RMAController;
