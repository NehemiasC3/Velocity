import { Request, Response } from 'express';
import { prisma } from '../db';
import { SerializedStatus, AuditEventType, WarehouseType } from '@prisma/client';

export class RMAController {
  /**
   * Búsqueda rápida de un equipo por MAC o Serial para validar a quién pertenecía antes del retiro
   * GET /api/rma/lookup/:query
   */
  public static async lookupDevice(req: Request, res: Response): Promise<void> {
    try {
      const { query } = req.params;
      const clean = String(query).trim().toUpperCase();

      if (!clean) {
        res.status(400).json({ success: false, error: 'Debe ingresar una MAC o número de serie' });
        return;
      }

      const item = await prisma.serializedItem.findFirst({
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
        isInstalledInClient: item.status === SerializedStatus.INSTALADO_CLIENTE || !!item.installedClientName,
        installedClientName: item.installedClientName || 'Sin cliente asignado',
        installedTicketId: item.installedTicketId || 'N/A',
        installedContractId: item.installedContractId || 'N/A',
        installedDate: item.installedDate || null,
        currentLocation: item.currentWarehouse?.name || 'Ubicación desconocida'
      });
    } catch (error: any) {
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
  public static async returnEquipment(req: Request, res: Response): Promise<void> {
    try {
      const {
        macAddress,
        serialNumber,
        vehicleWarehouseId,
        targetWarehouseId,
        reason = 'FALLA_EQUIPO', // DANO_ELECTRICO, CANCELACION, FALLA_PUERTO, ACTUALIZACION, MIGRACION
        deviceCondition = 'DEFECTUOSO_RMA', // DEFECTUOSO_RMA | OPERATIVO_BUENO
        notes
      } = req.body;

      const cleanQuery = (macAddress || serialNumber || '').trim().toUpperCase();

      if (!cleanQuery) {
        res.status(400).json({
          success: false,
          error: 'Debe proporcionar la dirección MAC o Número de Serie del equipo a retirar'
        });
        return;
      }

      // 1. Buscar el equipo
      const item = await prisma.serializedItem.findFirst({
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
          const rmaWarehouse = await prisma.warehouse.findFirst({
            where: { type: WarehouseType.CUARENTENA_RMA }
          });
          destinationWarehouseId = rmaWarehouse ? rmaWarehouse.id : vehicleWarehouseId || item.currentWarehouseId;
        } else {
          // Si está bueno, va a la camioneta del técnico o a sucursal
          destinationWarehouseId = vehicleWarehouseId || item.currentWarehouseId;
        }
      }

      const destWarehouse = await prisma.warehouse.findUnique({
        where: { id: destinationWarehouseId }
      });

      const prevClient = item.installedClientName || 'Cliente No Identificado';
      const prevTicket = item.installedTicketId || 'N/A';
      const prevLocation = item.currentWarehouse?.name || 'Bodega Previa';

      // 3. Ejecutar la transacción de Logística Inversa
      const result = await prisma.$transaction(async (tx) => {
        const newStatus = deviceCondition === 'DEFECTUOSO_RMA'
          ? SerializedStatus.RMA_DEFECTUOSO
          : (destWarehouse?.type === WarehouseType.VEHICULO ? SerializedStatus.EN_VEHICULO : SerializedStatus.EN_BODEGA);

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
        const auditUserId = (req as any).user?.id || 'usr-admin-1';
        await tx.auditLog.create({
          data: {
            eventType: AuditEventType.RETIRO_CLIENTE,
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
    } catch (error: any) {
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
  public static async getRmaItems(req: Request, res: Response): Promise<void> {
    try {
      const items = await prisma.serializedItem.findMany({
        where: {
          OR: [
            { status: SerializedStatus.RMA_DEFECTUOSO },
            { currentWarehouse: { type: WarehouseType.CUARENTENA_RMA } }
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
    } catch (error: any) {
      console.error('Error al obtener ítems RMA:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno al consultar ítems en RMA',
        details: error.message
      });
    }
  }
}
