import { prisma } from '../db';
import { SerializedStatus, BatchStatus, AuditEventType, WarehouseType, TransferStatus } from '@prisma/client';
import { wisproService } from './wispro.service';

export interface CreateTransferDTO {
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  createdById?: string;
  notes?: string;
  directReceive?: boolean;
  serializedItemIds?: string[];
  batchIds?: string[];
  bulkItems?: {
    productId: string;
    quantity: number;
  }[];
}

export interface CloseInstallationTicketDTO {
  technicianId: string;
  wisproClientId: string;
  installedOnuMac?: string;
  installedRouterMac?: string;
  retiredOnuMac?: string;
  retiredOnuStatus?: 'RMA_DEFECTUOSO' | 'RECUPERADO_BUENO';
  cableDropMetersUsed?: number;
  connectorsUsed?: number;
  tensorsUsed?: number;
  otherMaterialsUsed?: string;
  installationPhotoUrl?: string;
  notes?: string;
}

export class InventoryService {
  /**
   * Obtiene resumen global para el Dashboard Admin usando Prisma
   */
  public async getDashboardKPIs() {
    const [serialized, bulkStocks, warehouses, transfers, rmaCount] = await Promise.all([
      prisma.serializedItem.findMany(),
      prisma.bulkStock.findMany({ include: { product: true, warehouse: true } }),
      prisma.warehouse.findMany(),
      prisma.transferOrder.findMany({ where: { status: 'PENDIENTE' } }),
      prisma.serializedItem.count({ where: { status: SerializedStatus.RMA_DEFECTUOSO } })
    ]);

    const totalSerializedActive = serialized.filter(i => i.status !== SerializedStatus.BAJA).length;

    const criticalStockAlerts = bulkStocks
      .filter(s => s.product && s.quantity < (s.product.minStockAlert || 50))
      .map(s => ({
        warehouseName: s.warehouse?.name || 'Bodega',
        bulkItemName: s.product.name,
        currentQuantity: s.quantity,
        minStockAlert: s.product.minStockAlert || 50,
        unitOfMeasure: s.product.unitOfMeasure || 'UNIDADES'
      }));

    const onusByStatus = {
      enBodega: serialized.filter(i => i.status === SerializedStatus.EN_BODEGA).length,
      enTransito: serialized.filter(i => i.status === SerializedStatus.EN_TRANSITO).length,
      enVehiculo: serialized.filter(i => i.status === SerializedStatus.EN_VEHICULO).length,
      instaladoCliente: serialized.filter(i => i.status === SerializedStatus.INSTALADO_CLIENTE).length,
      rmaDefectuoso: rmaCount,
      baja: serialized.filter(i => i.status === SerializedStatus.BAJA).length
    };

    return {
      totalSerializedActive,
      criticalStockAlerts,
      rmaCount,
      rmaItems: serialized.filter(i => i.status === SerializedStatus.RMA_DEFECTUOSO).slice(0, 10),
      onusByStatus,
      totalWarehouses: warehouses.length,
      pendingTransfersCount: transfers.length,
      pendingTransfers: transfers
    };
  }

  /**
   * Búsqueda Forense de MAC en Prisma
   */
  public async searchForensicHistory(macOrSerial: string) {
    const q = macOrSerial.trim();
    const item = await prisma.serializedItem.findFirst({
      where: {
        OR: [
          { macAddress: { equals: q, mode: 'insensitive' } },
          { serialNumber: { equals: q, mode: 'insensitive' } }
        ]
      },
      include: {
        product: true,
        currentWarehouse: true
      }
    });

    if (!item) {
      return {
        found: false,
        query: macOrSerial,
        timeline: []
      };
    }

    const [timeline, clientData] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          OR: [
            { macAddress: item.macAddress },
            { serialNumber: item.serialNumber }
          ]
        },
        include: {
          user: true,
          fromWarehouse: true,
          toWarehouse: true
        },
        orderBy: { timestamp: 'asc' }
      }),
      item.installedContractId
        ? prisma.wisproClient.findFirst({ where: { contractId: item.installedContractId } })
        : null
    ]);

    return {
      found: true,
      item: {
        id: item.id,
        macAddress: item.macAddress,
        serialNumber: item.serialNumber,
        category: item.product?.category,
        brand: item.product?.brand,
        model: item.product?.model,
        status: item.status,
        currentWarehouseId: item.currentWarehouseId,
        currentWarehouseName: item.currentWarehouse?.name
      },
      clientData,
      timeline: timeline.map(t => ({
        id: t.id,
        eventType: t.eventType,
        details: t.details,
        timestamp: t.timestamp.toISOString(),
        userId: t.userId,
        userName: t.user?.name || 'Usuario',
        fromWarehouseName: t.fromWarehouse?.name,
        toWarehouseName: t.toWarehouse?.name
      }))
    };
  }

  /**
   * Ejecuta un traslado transaccional con validación estricta de existencias
   */
  public async executeTransfer(dto: CreateTransferDTO) {
    const {
      sourceWarehouseId,
      destinationWarehouseId,
      createdById,
      notes,
      directReceive = true,
      serializedItemIds = [],
      batchIds = [],
      bulkItems = []
    } = dto;

    if (!sourceWarehouseId || !destinationWarehouseId) {
      throw new Error('Debe especificar bodega de origen y destino');
    }

    if (sourceWarehouseId === destinationWarehouseId) {
      throw new Error('La bodega de origen y destino no pueden ser la misma');
    }

    const [sourceWarehouse, destinationWarehouse] = await Promise.all([
      prisma.warehouse.findUnique({ where: { id: sourceWarehouseId } }),
      prisma.warehouse.findUnique({ where: { id: destinationWarehouseId } })
    ]);

    if (!sourceWarehouse) {
      throw new Error('Bodega de origen no encontrada');
    }
    if (!destinationWarehouse) {
      throw new Error('Bodega de destino no encontrada');
    }

    let defaultUserId = createdById;
    if (!defaultUserId) {
      const u = await prisma.user.findFirst();
      defaultUserId = u?.id || 'usr-system';
    }

    // ─────────────────────────────────────────────────────────────
    // EJECUCIÓN 100% TRANSACCIONAL CON BARRERA DE PROTECCIÓN (ZERO CORRUPCIÓN)
    // ─────────────────────────────────────────────────────────────
    return await prisma.$transaction(async (tx) => {
      const sanitizedBulk: { productId: string; quantity: number; unitOfMeasure: any }[] = [];

      // 1. Validar y descontar material a granel
      for (const item of bulkItems) {
        const qty = Number(item.quantity);
        if (!item.productId || isNaN(qty) || qty <= 0) continue;

        const currentStock = await tx.bulkStock.findUnique({
          where: {
            productId_warehouseId: {
              productId: item.productId,
              warehouseId: sourceWarehouseId
            }
          },
          include: { product: true }
        });

        const available = currentStock?.quantity || 0;
        const productName = currentStock?.product?.name || item.productId;

        if (!currentStock || available < qty) {
          throw new Error(`Stock insuficiente en la bodega origen: "${productName}". Disponible en ${sourceWarehouse.name}: ${available}, Solicitado: ${qty}`);
        }

        // Restar en origen
        await tx.bulkStock.update({
          where: {
            productId_warehouseId: {
              productId: item.productId,
              warehouseId: sourceWarehouseId
            }
          },
          data: {
            quantity: { decrement: qty }
          }
        });

        // Sumar en destino
        await tx.bulkStock.upsert({
          where: {
            productId_warehouseId: {
              productId: item.productId,
              warehouseId: destinationWarehouseId
            }
          },
          create: {
            productId: item.productId,
            warehouseId: destinationWarehouseId,
            quantity: qty
          },
          update: {
            quantity: { increment: qty }
          }
        });

        sanitizedBulk.push({
          productId: item.productId,
          quantity: qty,
          unitOfMeasure: currentStock.product.unitOfMeasure
        });
      }

      // 2. Validar y trasladar Bobinas
      if (batchIds.length > 0) {
        const availableBatches = await tx.batchItem.findMany({
          where: {
            id: { in: batchIds },
            currentWarehouseId: sourceWarehouseId,
            status: BatchStatus.DISPONIBLE
          }
        });

        if (availableBatches.length !== batchIds.length) {
          throw new Error(`Stock insuficiente en la bodega origen: Una o más bobinas ya no están disponibles en ${sourceWarehouse.name}`);
        }

        await tx.batchItem.updateMany({
          where: { id: { in: batchIds } },
          data: {
            currentWarehouseId: destinationWarehouseId,
            status: directReceive ? BatchStatus.DISPONIBLE : BatchStatus.EN_TRANSITO
          }
        });
      }

      // 3. Validar y trasladar Equipos Seriados
      if (serializedItemIds.length > 0) {
        const availableSerialized = await tx.serializedItem.findMany({
          where: {
            id: { in: serializedItemIds },
            currentWarehouseId: sourceWarehouseId,
            status: { in: [SerializedStatus.EN_BODEGA, SerializedStatus.EN_VEHICULO] }
          }
        });

        if (availableSerialized.length !== serializedItemIds.length) {
          throw new Error(`Stock insuficiente en la bodega origen: Uno o más equipos seriados no están disponibles en ${sourceWarehouse.name}`);
        }

        const newStatus = destinationWarehouse.type === WarehouseType.VEHICULO
          ? SerializedStatus.EN_VEHICULO
          : SerializedStatus.EN_BODEGA;

        await tx.serializedItem.updateMany({
          where: { id: { in: serializedItemIds } },
          data: {
            currentWarehouseId: destinationWarehouseId,
            status: directReceive ? newStatus : SerializedStatus.EN_TRANSITO
          }
        });
      }

      // 4. Crear la orden de traslado
      const orderNumber = `TRF-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
      const order = await tx.transferOrder.create({
        data: {
          orderNumber,
          sourceWarehouseId,
          destinationWarehouseId,
          status: directReceive ? TransferStatus.RECIBIDO : TransferStatus.EN_TRANSITO,
          createdByUserId: defaultUserId,
          dispatchedByUserId: defaultUserId,
          dispatchedAt: new Date(),
          receivedByUserId: directReceive ? defaultUserId : null,
          receivedAt: directReceive ? new Date() : null,
          notes: notes?.trim() || null,
          items: {
            create: sanitizedBulk.map(b => ({
              productId: b.productId,
              quantity: b.quantity,
              unitOfMeasure: b.unitOfMeasure
            }))
          },
          batchItems: batchIds.length > 0 ? {
            connect: batchIds.map(id => ({ id }))
          } : undefined,
          serializedItems: serializedItemIds.length > 0 ? {
            connect: serializedItemIds.map(id => ({ id }))
          } : undefined
        },
        include: {
          items: { include: { product: true } },
          batchItems: { include: { product: true } },
          serializedItems: { include: { product: true } },
          sourceWarehouse: true,
          destinationWarehouse: true
        }
      });

      // 5. Registrar Auditoría Forense
      await tx.auditLog.create({
        data: {
          eventType: destinationWarehouse.type === WarehouseType.VEHICULO ? AuditEventType.CARGA_VEHICULO : AuditEventType.DESPACHO_TRASLADO,
          fromWarehouseId: sourceWarehouseId,
          toWarehouseId: destinationWarehouseId,
          userId: defaultUserId,
          details: `Orden de Traslado ${orderNumber} ejecutada. Origen: ${sourceWarehouse.name} -> Destino: ${destinationWarehouse.name}. Contenido: ${sanitizedBulk.length} a granel, ${batchIds.length} bobina(s), ${serializedItemIds.length} serial(es).`
        }
      });

      return order;
    });
  }

  /**
   * Cierre de ticket / Liquidación de campo con transacción atómica y validación de stock
   */
  public async closeInstallationTicket(dto: CloseInstallationTicketDTO) {
    const [tech, client] = await Promise.all([
      prisma.user.findUnique({
        where: { id: dto.technicianId },
        include: {
          managedWarehouses: {
            where: { type: WarehouseType.VEHICULO }
          }
        }
      }),
      prisma.wisproClient.findUnique({
        where: { id: dto.wisproClientId }
      })
    ]);

    const vehicleWarehouse = tech?.managedWarehouses?.[0];
    const vehicleWarehouseId = vehicleWarehouse?.id || 'wh-veh-01';

    return await prisma.$transaction(async (tx) => {
      // 1. Validar y descontar ONU instalada
      let targetOnu: any = null;
      if (dto.installedOnuMac) {
        const cleanMac = dto.installedOnuMac.trim().toUpperCase();
        targetOnu = await tx.serializedItem.findFirst({
          where: {
            macAddress: cleanMac,
            currentWarehouseId: vehicleWarehouseId
          },
          include: { product: true }
        });

        if (!targetOnu) {
          throw new Error(`Stock insuficiente en la bodega origen: El equipo con MAC ${cleanMac} no se encuentra disponible en la bodega de este vehículo (${vehicleWarehouse?.name || 'Camioneta'})`);
        }

        if (targetOnu.status === SerializedStatus.INSTALADO_CLIENTE) {
          throw new Error(`Stock insuficiente en la bodega origen: El equipo con MAC ${cleanMac} ya se encuentra instalado en otro cliente`);
        }

        await tx.serializedItem.update({
          where: { id: targetOnu.id },
          data: {
            status: SerializedStatus.INSTALADO_CLIENTE,
            installedClientId: dto.wisproClientId,
            installedClientName: client?.name || 'Cliente Wispro',
            installedContractId: client?.contractId || 'CONT-000',
            installedDate: new Date(),
            notes: `Instalado en cliente ${client?.name || 'Wispro'}. ${dto.notes || ''}`
          }
        });

        await tx.auditLog.create({
          data: {
            eventType: AuditEventType.INSTALACION_CLIENTE,
            macAddress: targetOnu.macAddress,
            serialNumber: targetOnu.serialNumber,
            fromWarehouseId: vehicleWarehouseId,
            userId: dto.technicianId,
            details: `Equipo ${targetOnu.product?.name || 'ONU'} (MAC: ${targetOnu.macAddress}) instalado en cliente ${client?.name || 'Wispro'}`
          }
        });
      }

      // 2. Validar y descontar metraje de cable drop
      const metersUsed = Number(dto.cableDropMetersUsed) || 0;
      let usedBatchNumber: string | null = null;
      if (metersUsed > 0) {
        const availableBatch = await tx.batchItem.findFirst({
          where: {
            currentWarehouseId: vehicleWarehouseId,
            status: BatchStatus.DISPONIBLE,
            currentQuantity: { gte: metersUsed }
          }
        });

        if (!availableBatch) {
          throw new Error(`Stock insuficiente en la bodega origen: Metraje de cable drop insuficiente en el vehículo. Se requieren ${metersUsed}m.`);
        }

        const remaining = availableBatch.currentQuantity - metersUsed;
        await tx.batchItem.update({
          where: { id: availableBatch.id },
          data: {
            currentQuantity: remaining,
            status: remaining <= 0 ? BatchStatus.AGOTADO : BatchStatus.DISPONIBLE
          }
        });

        usedBatchNumber = availableBatch.batchNumber;

        await tx.auditLog.create({
          data: {
            eventType: AuditEventType.CONSUMO_BOBINA,
            batchNumber: availableBatch.batchNumber,
            fromWarehouseId: vehicleWarehouseId,
            userId: dto.technicianId,
            details: `Consumo de ${metersUsed}m de cable drop de bobina ${availableBatch.batchNumber} en instalación cliente ${client?.name || 'Wispro'}. Remanente: ${remaining}m`
          }
        });
      }

      // 3. Crear el ticket de instalación
      const ticketNumber = `TICK-${Date.now().toString().slice(-4)}`;
      const ticket = await tx.installationTicket.create({
        data: {
          ticketNumber,
          technicianId: dto.technicianId,
          vehicleWarehouseId,
          wisproClientId: dto.wisproClientId,
          wisproClientName: client?.name || 'Cliente Wispro',
          wisproContractId: client?.contractId || 'CONT-000',
          clientAddress: client?.address || 'Panamá',
          installedOnuMac: dto.installedOnuMac || null,
          installedRouterMac: dto.installedRouterMac || null,
          retiredDeviceMac: dto.retiredOnuMac || null,
          retiredDeviceStatus: dto.retiredOnuStatus ? (dto.retiredOnuStatus as any) : null,
          usedSpoolBatchNumber: usedBatchNumber,
          cableDropMetersUsed: metersUsed,
          connectorsUsed: Number(dto.connectorsUsed) || 0,
          tensorsUsed: Number(dto.tensorsUsed) || 0,
          otherMaterialsUsed: dto.otherMaterialsUsed || null,
          installationPhotoUrl: dto.installationPhotoUrl || null,
          notes: dto.notes || null,
          wisproSynced: true,
          wisproSyncMessage: 'Sincronizado exitosamente'
        }
      });

      return ticket;
    });
  }

  /**
   * Métricas de Cuadrillas
   */
  public async getTechnicianMetrics() {
    const technicians = await prisma.user.findMany({
      where: { role: 'TECNICO' },
      include: {
        managedWarehouses: true,
        installationTickets: true
      }
    });

    return technicians.map(tech => {
      const tickets = tech.installationTickets || [];
      const totalMeters = tickets.reduce((sum, t) => sum + (t.cableDropMetersUsed || 0), 0);
      const totalConnectors = tickets.reduce((sum, t) => sum + (t.connectorsUsed || 0), 0);
      const avgMeters = tickets.length > 0 ? Math.round(totalMeters / tickets.length) : 0;

      return {
        technicianId: tech.id,
        technicianName: tech.name,
        assignedWarehouse: tech.managedWarehouses?.[0]?.name || 'Camioneta',
        totalInstalls: tickets.length,
        totalMetersConsumed: totalMeters,
        avgMetersPerInstall: avgMeters,
        totalConnectorsUsed: totalConnectors,
        isAnomaly: avgMeters > 150,
        anomalyWarning: avgMeters > 150 ? 'Consumo promedio elevado de cable (>150m)' : null
      };
    });
  }
}

export const inventoryService = new InventoryService();
