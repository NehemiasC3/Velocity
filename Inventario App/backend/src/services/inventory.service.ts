import { prisma } from '../db';
import { SerializedStatus, AuditEventType, WarehouseType } from '@prisma/client';
import { wisproService } from './wispro.service';

export interface CreateTransferDTO {
  originWarehouseId: string;
  destinationWarehouseId: string;
  createdById: string;
  notes?: string;
  serializedItemIds: string[];
  bulkItems: {
    bulkItemId: string;
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
  cableDropMetersUsed: number;
  connectorsUsed: number;
  tensorsUsed: number;
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
   * Cierre de ticket / Liquidación de campo
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

    const ticket = await prisma.installationTicket.create({
      data: {
        ticketNumber: `TICK-${Date.now().toString().slice(-4)}`,
        technicianId: dto.technicianId,
        vehicleWarehouseId: vehicleWarehouse?.id || 'wh-veh-01',
        wisproClientId: dto.wisproClientId,
        wisproClientName: client?.name || 'Cliente Wispro',
        wisproContractId: client?.contractId || 'CONT-000',
        clientAddress: client?.address || 'Panamá',
        installedOnuMac: dto.installedOnuMac,
        installedRouterMac: dto.installedRouterMac,
        retiredDeviceMac: dto.retiredOnuMac,
        retiredDeviceStatus: dto.retiredOnuStatus,
        cableDropMetersUsed: dto.cableDropMetersUsed,
        connectorsUsed: dto.connectorsUsed,
        tensorsUsed: dto.tensorsUsed,
        otherMaterialsUsed: dto.otherMaterialsUsed,
        installationPhotoUrl: dto.installationPhotoUrl,
        notes: dto.notes
      }
    });

    if (dto.installedOnuMac) {
      await prisma.serializedItem.updateMany({
        where: { macAddress: dto.installedOnuMac },
        data: {
          status: SerializedStatus.INSTALADO_CLIENTE,
          installedClientId: dto.wisproClientId,
          installedDate: new Date()
        }
      });
    }

    return ticket;
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
