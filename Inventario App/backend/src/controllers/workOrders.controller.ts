import { Request, Response } from 'express';
import { prisma } from '../db';
import {
  SerializedStatus,
  AuditEventType,
  InstallationTicketType,
  RetiredDeviceStatus,
  Role,
  BatchStatus,
  WarehouseType
} from '@prisma/client';
import { inventoryService } from '../services/inventory.service';
import { WisproService } from '../services/wispro.service';

// ─────────────────────────────────────────────────────────────────────────────
// Filtro y clasificación de tickets Wispro → 4 tipos de la Mesa
// ─────────────────────────────────────────────────────────────────────────────

const WISPRO_TICKET_TYPE_MAP: Record<string, InstallationTicketType> = {
  'visita tecnica':   'MANTENIMIENTO_RMA',
  'visita técnica':   'MANTENIMIENTO_RMA',
  'support':          'MANTENIMIENTO_RMA',
  'soporte':          'MANTENIMIENTO_RMA',
  'tecnica':          'MANTENIMIENTO_RMA',
  'technical':        'MANTENIMIENTO_RMA',
  'instalacion':      'INSTALACION_NUEVA',
  'instalación':      'INSTALACION_NUEVA',
  'installation':     'INSTALACION_NUEVA',
  'alta':             'INSTALACION_NUEVA',
  'factibilidad':     'CAMBIO_EQUIPO',
  'feasibility':      'CAMBIO_EQUIPO',
  'baja':             'BAJA_SERVICIO',
  'baja de servicio': 'BAJA_SERVICIO',
  'cancellation':     'BAJA_SERVICIO',
  'cancelacion':      'BAJA_SERVICIO',
  'cancelación':      'BAJA_SERVICIO',
};

const DISPATCH_TYPE_LABELS: Record<string, string> = {
  MANTENIMIENTO_RMA: 'Visita Técnica',
  INSTALACION_NUEVA: 'Instalación',
  CAMBIO_EQUIPO:     'Factibilidad',
  BAJA_SERVICIO:     'Baja de Servicio',
};

const ALLOWED_DISPATCH_TYPES = new Set<string>([
  'MANTENIMIENTO_RMA',
  'INSTALACION_NUEVA',
  'CAMBIO_EQUIPO',
  'BAJA_SERVICIO',
]);

function classifyWisproTicket(raw: any): InstallationTicketType | null {
  const kind = String(raw.kind || raw.type || raw.category || '').toLowerCase().trim();
  if (kind && WISPRO_TICKET_TYPE_MAP[kind]) return WISPRO_TICKET_TYPE_MAP[kind];
  const subject = String(raw.subject || raw.title || raw.description || '').toLowerCase();
  for (const [keyword, type] of Object.entries(WISPRO_TICKET_TYPE_MAP)) {
    if (subject.includes(keyword)) return type;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function resolveUser(req: Request) {
  const authUser = (req as any).user;
  const uid = authUser?.id || (req.headers['x-user-id'] as string) || null;
  if (uid) {
    const u = await prisma.user.findUnique({ where: { id: uid } });
    if (u) return u;
  }
  const admin =
    (await prisma.user.findFirst({ where: { role: Role.SUPERADMIN } })) ||
    (await prisma.user.findFirst());
  if (admin) return admin;
  return prisma.user.create({
    data: { name: 'Administrador del Sistema', email: 'admin@velocity.com', role: Role.SUPERADMIN }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// WorkOrdersController
// ─────────────────────────────────────────────────────────────────────────────

export class WorkOrdersController {

  // GET /api/work-orders
  static async list(req: Request, res: Response): Promise<void> {
    try {
      const { type, wisproSynced, search, technicianId, vehicleWarehouseId, page = '1', limit = '30' } =
        req.query as Record<string, string>;
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
      const skip = (pageNum - 1) * limitNum;
      const where: any = {};
      if (type && type !== 'ALL') where.type = type as InstallationTicketType;
      if (wisproSynced === 'true') where.wisproSynced = true;
      if (wisproSynced === 'false') where.wisproSynced = false;
      if (technicianId) where.technicianId = technicianId;
      if (vehicleWarehouseId) where.vehicleWarehouseId = vehicleWarehouseId;
      if (search && search.trim()) {
        const q = search.trim();
        where.OR = [
          { ticketNumber: { contains: q, mode: 'insensitive' } },
          { wisproClientName: { contains: q, mode: 'insensitive' } },
          { wisproContractId: { contains: q, mode: 'insensitive' } },
          { clientAddress: { contains: q, mode: 'insensitive' } },
          { installedOnuMac: { contains: q, mode: 'insensitive' } },
          { installedOnuSerial: { contains: q, mode: 'insensitive' } },
        ];
      }
      const [tickets, total] = await Promise.all([
        prisma.installationTicket.findMany({
          where, skip, take: limitNum, orderBy: { createdAt: 'desc' },
          include: {
            technician: { select: { id: true, name: true, email: true, phone: true } },
            vehicleWarehouse: { select: { id: true, name: true, code: true, type: true } },
          },
        }),
        prisma.installationTicket.count({ where }),
      ]);
      res.json({ success: true, data: tickets, pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } });
    } catch (err: any) {
      console.error('[WorkOrders.list]', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // GET /api/work-orders/dispatch
  // Vista de Despacho: tickets Wispro filtrados por 4 tipos, agrupados por tecnico
  static async dispatch(req: Request, res: Response): Promise<void> {
    try {
      const { date, typeFilter } = req.query as Record<string, string>;

      const technicians = await prisma.user.findMany({
        where: { role: { in: ['TECNICO', 'SUPERVISOR_MESA'] as Role[] } },
        include: {
          managedWarehouses: {
            where: { type: WarehouseType.VEHICULO },
            include: {
              batchItems: {
                where: { status: BatchStatus.DISPONIBLE },
                include: { product: { select: { name: true, category: true } } },
                orderBy: { currentQuantity: 'desc' },
              },
              bulkStocks: {
                where: { quantity: { gt: 0 } },
                include: { product: { select: { name: true, category: true } } },
              },
              serializedItems: {
                where: { status: SerializedStatus.EN_VEHICULO },
                include: { product: { select: { name: true, category: true } } },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      let rawTickets: any[] = [];
      try {
        rawTickets = await WisproService.fetchOpenTickets();
      } catch (err: any) {
        console.warn('[WorkOrders.dispatch] Wispro unavailable:', err.message);
      }

      const localPendingWhere: any = {
        wisproSynced: false,
        type: { in: Array.from(ALLOWED_DISPATCH_TYPES) as InstallationTicketType[] },
      };
      if (date) {
        const d = new Date(date);
        const next = new Date(d);
        next.setDate(next.getDate() + 1);
        localPendingWhere.createdAt = { gte: d, lt: next };
      }
      const localOrders = await prisma.installationTicket.findMany({
        where: localPendingWhere,
        include: {
          technician: { select: { id: true, name: true, email: true, phone: true } },
          vehicleWarehouse: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const wisproOrders: any[] = [];
      for (const raw of rawTickets) {
        const orderType = classifyWisproTicket(raw);
        if (!orderType || !ALLOWED_DISPATCH_TYPES.has(orderType)) continue;
        const alreadyLocal = localOrders.some(lo => lo.ticketNumber === String(raw.id || raw.ticketNumber || ''));
        if (alreadyLocal) continue;
        if (typeFilter && typeFilter !== 'ALL' && orderType !== typeFilter) continue;
        wisproOrders.push({
          id: `wispro-${raw.id}`,
          ticketNumber: raw.ticketNumber || String(raw.id),
          type: orderType,
          typeLabel: DISPATCH_TYPE_LABELS[orderType],
          wisproClientName: raw.clientName || raw.title || 'Cliente',
          wisproContractId: raw.contractId || '',
          clientAddress: raw.clientAddress || 'Sin dirección',
          wisproNode: raw.node || raw.zone || '',
          technicianId: raw.assignedToId || null,
          technician: raw.technician || null,
          vehicleWarehouseId: raw.technician?.vehicleWarehouseId || null,
          wisproSynced: false,
          status: 'PENDIENTE',
          source: 'WISPRO',
          scheduledDate: raw.scheduledDate || raw.createdAt,
          createdAt: raw.createdAt || new Date().toISOString(),
        });
      }

      const allOrders = [
        ...localOrders.map(lo => ({
          ...lo,
          typeLabel: DISPATCH_TYPE_LABELS[lo.type] || lo.type,
          source: 'LOCAL',
          status: lo.wisproSynced ? 'COMPLETADA' : 'PENDIENTE',
          scheduledDate: lo.createdAt,
        })),
        ...wisproOrders,
      ];

      const techMap = new Map<string, any>();
      for (const tech of technicians) {
        const vehicle = tech.managedWarehouses[0] || null;
        techMap.set(tech.id, {
          technician: { id: tech.id, name: tech.name, email: tech.email, phone: tech.phone, role: tech.role },
          vehicle: vehicle ? {
            id: vehicle.id, name: vehicle.name, code: vehicle.code,
            vehiclePlate: (vehicle as any).vehiclePlate,
            serializedCount: (vehicle as any).serializedItems?.length || 0,
            batchSummary: (vehicle as any).batchItems?.map((b: any) => ({
              id: b.id,
              productName: b.product?.name, currentQuantity: b.currentQuantity,
              batchNumber: b.batchNumber, unitOfMeasure: b.unitOfMeasure,
            })) || [],
            bulkSummary: (vehicle as any).bulkStocks?.map((bs: any) => ({
              productId: bs.productId,
              productName: bs.product?.name, quantity: bs.quantity,
            })) || [],
          } : null,
          orders: [] as any[],
          zones: [] as string[],
          scheduledDate: date || new Date().toISOString().split('T')[0],
          stats: { total: 0, instalaciones: 0, visitas: 0, factibilidades: 0, bajas: 0 },
        });
      }

      const unassigned: any[] = [];
      for (const order of allOrders) {
        const techId = (order as any).technicianId;
        if (techId && techMap.has(techId)) {
          const g = techMap.get(techId)!;
          g.orders.push(order);
          g.stats.total++;
          if (order.type === 'INSTALACION_NUEVA') g.stats.instalaciones++;
          else if (order.type === 'MANTENIMIENTO_RMA') g.stats.visitas++;
          else if (order.type === 'CAMBIO_EQUIPO') g.stats.factibilidades++;
          else if (order.type === 'BAJA_SERVICIO') g.stats.bajas++;

          const zoneName = (order as any).wisproNode || (order as any).clientAddress;
          if (zoneName && !g.zones.includes(zoneName)) {
            g.zones.push(zoneName);
          }
        } else {
          unassigned.push(order);
        }
      }

      const groups = Array.from(techMap.values());
      res.json({
        success: true, groups, unassigned, totalOrders: allOrders.length,
        allowedTypes: Array.from(ALLOWED_DISPATCH_TYPES).map(t => ({ value: t, label: DISPATCH_TYPE_LABELS[t] })),
      });
    } catch (err: any) {
      console.error('[WorkOrders.dispatch]', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST /api/work-orders/:id/liquidate
  // Transaccion atomica: serial del vehiculo + cable + granel + auditoria + Wispro binding
  static async liquidate(req: Request, res: Response): Promise<void> {
    try {
      const orderId = String(req.params.id);
      const { serialNumber, macAddress, batchUsage, bulkUsage, notes } = req.body;

      let ticket = await prisma.installationTicket.findFirst({
        where: {
          OR: [
            { id: orderId },
            { ticketNumber: orderId.replace('wispro-', '') }
          ]
        },
        include: { technician: true, vehicleWarehouse: true },
      });

      // Si la orden viene de Wispro y aun no esta persistida en la DB local, la creamos
      if (!ticket && orderId.startsWith('wispro-')) {
        const rawTickets = await WisproService.fetchOpenTickets();
        const rawT = rawTickets.find(r => `wispro-${r.id}` === orderId || r.id === orderId.replace('wispro-', '') || r.ticketNumber === orderId.replace('wispro-', ''));
        if (rawT) {
          const orderType = classifyWisproTicket(rawT) || 'INSTALACION_NUEVA';
          const techId = rawT.assignedToId || rawT.technician?.id;
          const tech = techId ? await prisma.user.findUnique({
            where: { id: techId },
            include: { managedWarehouses: { where: { type: WarehouseType.VEHICULO } } }
          }) : null;
          const vWhId = tech?.managedWarehouses?.[0]?.id || rawT.technician?.vehicleWarehouseId;

          if (!vWhId) {
            res.status(400).json({ success: false, error: 'No se puede liquidar: Asigne primero un técnico con bodega vehicular a esta orden.' });
            return;
          }

          ticket = await prisma.installationTicket.create({
            data: {
              ticketNumber: rawT.ticketNumber || `WO-${rawT.id}`,
              type: orderType,
              wisproClientId: rawT.wisproClientId || `WISP-${rawT.id}`,
              wisproClientName: rawT.clientName || 'Cliente',
              wisproContractId: rawT.contractId || `CTR-${rawT.id}`,
              wisproNode: rawT.wisproNode || rawT.node || null,
              clientAddress: rawT.clientAddress || 'Panamá',
              technicianId: tech ? tech.id : (await resolveUser(req)).id,
              vehicleWarehouseId: vWhId,
              wisproSynced: false,
              wisproSyncMessage: 'Orden Wispro iniciada para liquidación',
            },
            include: { technician: true, vehicleWarehouse: true },
          });
        }
      }

      if (!ticket) { res.status(404).json({ success: false, error: 'Orden no encontrada' }); return; }
      if (ticket.wisproSynced) { res.status(409).json({ success: false, error: 'Esta orden ya fue liquidada' }); return; }

      const targetTicket = ticket;
      const vehicleWarehouseId = targetTicket.vehicleWarehouseId;
      if (!vehicleWarehouseId) { res.status(400).json({ success: false, error: 'La orden no tiene bodega vehicular asignada' }); return; }

      const responsibleUser = await resolveUser(req);

      // PRE-GUARD: serial en vehiculo del tecnico
      let targetItem: any = null;
      if (serialNumber || macAddress) {
        const cleanSN  = serialNumber ? String(serialNumber).trim().toUpperCase() : null;
        const cleanMAC = macAddress ? String(macAddress).replace(/[^A-Za-z0-9]/g, '').toUpperCase() : null;
        targetItem = await prisma.serializedItem.findFirst({
          where: {
            currentWarehouseId: vehicleWarehouseId,
            status: SerializedStatus.EN_VEHICULO,
            OR: [
              ...(cleanSN  ? [{ serialNumber: cleanSN }]  : []),
              ...(cleanMAC ? [{ macAddress: cleanMAC }] : []),
            ],
          },
          include: { product: true },
        });
        if (!targetItem) {
          res.status(400).json({
            success: false,
            error: `El equipo "${serialNumber || macAddress}" no está en la bodega del vehículo (${targetTicket.vehicleWarehouse?.name || vehicleWarehouseId}). Verifique que esté físicamente cargado con estado EN_VEHICULO.`,
          });
          return;
        }
      }

      // PRE-GUARD: bobina en vehiculo
      let targetBatch: any = null;
      let metersToDeduct = 0;
      if (batchUsage && Number(batchUsage.metersUsed) > 0) {
        metersToDeduct = Number(batchUsage.metersUsed);
        targetBatch = await prisma.batchItem.findFirst({
          where: {
            currentWarehouseId: vehicleWarehouseId,
            status: BatchStatus.DISPONIBLE,
            OR: [
              ...(batchUsage.batchId     ? [{ id: batchUsage.batchId }] : []),
              ...(batchUsage.batchNumber ? [{ batchNumber: String(batchUsage.batchNumber).trim().toUpperCase() }] : []),
            ],
          },
          include: { product: true },
        });
        if (!targetBatch) { res.status(400).json({ success: false, error: 'Bobina no disponible en el vehículo' }); return; }
        if (targetBatch.currentQuantity < metersToDeduct) {
          res.status(400).json({ success: false, error: `Metraje insuficiente: Bobina ${targetBatch.batchNumber} tiene ${targetBatch.currentQuantity}m, se solicitaron ${metersToDeduct}m` });
          return;
        }
      }

      // TRANSACCION ATOMICA
      const txResult = await prisma.$transaction(async (tx) => {
        const auditEntries: string[] = [];

        if (targetItem) {
          await tx.serializedItem.update({
            where: { id: targetItem.id },
            data: {
              status: SerializedStatus.INSTALADO_CLIENTE,
              installedContractId: targetTicket.wisproContractId,
              installedClientId:   targetTicket.wisproClientId,
              installedClientName: targetTicket.wisproClientName,
              installedTicketId:   targetTicket.ticketNumber,
              installedDate:       new Date(),
              notes: notes ? `${targetItem.notes ? targetItem.notes + ' | ' : ''}Instalado: ${notes}` : targetItem.notes,
            },
          });
          await tx.auditLog.create({
            data: {
              eventType: AuditEventType.INSTALACION_CLIENTE,
              macAddress: targetItem.macAddress,
              serialNumber: targetItem.serialNumber,
              fromWarehouseId: vehicleWarehouseId,
              userId: responsibleUser.id,
              details: `[LIQUIDACION] ${targetItem.product?.name || 'Equipo'} S/N:${targetItem.serialNumber} MAC:${targetItem.macAddress || 'N/A'} → Cliente "${targetTicket.wisproClientName}" Contrato:${targetTicket.wisproContractId} Ticket:${targetTicket.ticketNumber}`,
            },
          });
          auditEntries.push(`Serial ${targetItem.serialNumber} → ${targetTicket.wisproContractId}`);
        }

        if (targetBatch && metersToDeduct > 0) {
          const newQty = Math.max(0, targetBatch.currentQuantity - metersToDeduct);
          await tx.batchItem.update({
            where: { id: targetBatch.id },
            data: { currentQuantity: newQty, status: newQty <= 0 ? BatchStatus.AGOTADO : BatchStatus.DISPONIBLE },
          });
          await tx.auditLog.create({
            data: {
              eventType: AuditEventType.CONSUMO_BOBINA,
              batchNumber: targetBatch.batchNumber,
              fromWarehouseId: vehicleWarehouseId,
              userId: responsibleUser.id,
              details: `[LIQUIDACION] ${metersToDeduct}m de ${targetBatch.product?.name || 'cable'} (${targetBatch.batchNumber}). Remanente: ${newQty}m. Ticket:${targetTicket.ticketNumber}`,
            },
          });
          auditEntries.push(`${metersToDeduct}m bobina ${targetBatch.batchNumber}`);
        }

        if (Array.isArray(bulkUsage)) {
          for (const b of bulkUsage) {
            if (!b.productId || !(Number(b.quantity) > 0)) continue;
            const stock = await tx.bulkStock.findUnique({
              where: { productId_warehouseId: { productId: b.productId, warehouseId: vehicleWarehouseId } },
              include: { product: true },
            });
            if (!stock || stock.quantity < Number(b.quantity)) {
              throw new Error(`Stock insuficiente: "${stock?.product?.name || b.productId}" — Disponible: ${stock?.quantity ?? 0}, Solicitado: ${b.quantity}`);
            }
            await tx.bulkStock.update({ where: { id: stock.id }, data: { quantity: stock.quantity - Number(b.quantity) } });
            auditEntries.push(`${b.quantity}x ${stock.product?.name || b.productId}`);
          }
        }

        const updatedTicket = await tx.installationTicket.update({
          where: { id: targetTicket.id },
          data: {
            wisproSynced: true,
            wisproSyncMessage: `Liquidado: ${auditEntries.join(', ') || 'Sin materiales'}. ${notes || ''}`.trim(),
            installedOnuMac:    targetItem?.macAddress   || targetTicket.installedOnuMac,
            installedOnuSerial: targetItem?.serialNumber || targetTicket.installedOnuSerial,
            notes: notes || targetTicket.notes,
          },
          include: {
            technician:       { select: { id: true, name: true } },
            vehicleWarehouse: { select: { id: true, name: true, code: true } },
          },
        });

        return { ticket: updatedTicket, auditEntries };
      });

      inventoryService.invalidateDashboardCache();
      res.json({
        success: true,
        message: `Liquidacion completada. ${txResult.auditEntries.length} movimiento(s) registrado(s).`,
        ticket: txResult.ticket,
        auditEntries: txResult.auditEntries,
        liquidatedItems: {
          serialNumber: targetItem?.serialNumber || null,
          macAddress:   targetItem?.macAddress   || null,
          metersCable:  metersToDeduct,
        },
      });
    } catch (err: any) {
      console.error('[WorkOrders.liquidate]', err);
      const is400 = err.message?.includes('Stock insuficiente') || err.message?.includes('no está en la bodega') || err.message?.includes('Metraje insuficiente');
      res.status(is400 ? 400 : 500).json({ success: false, error: err.message });
    }
  }

  // GET /api/work-orders/:id
  static async getOne(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      let ticket: any = await prisma.installationTicket.findFirst({
        where: {
          OR: [
            { id },
            { ticketNumber: id.replace('wispro-', '') }
          ]
        },
        include: { technician: { select: { id: true, name: true, email: true, phone: true } }, vehicleWarehouse: true },
      });

      if (!ticket && id.startsWith('wispro-')) {
        const rawTickets = await WisproService.fetchOpenTickets();
        const rawT = rawTickets.find(r => `wispro-${r.id}` === id || r.id === id.replace('wispro-', '') || r.ticketNumber === id.replace('wispro-', ''));
        if (rawT) {
          const orderType = classifyWisproTicket(rawT) || 'INSTALACION_NUEVA';
          const techId = rawT.assignedToId || rawT.technician?.id;
          let vehicleWarehouse: any = null;
          let technician: any = null;

          if (techId) {
            technician = await prisma.user.findUnique({
              where: { id: techId },
              select: { id: true, name: true, email: true, phone: true, role: true, managedWarehouses: { where: { type: WarehouseType.VEHICULO } } }
            });
            vehicleWarehouse = technician?.managedWarehouses?.[0] || null;
          }

          ticket = {
            id,
            ticketNumber: rawT.ticketNumber || `WO-${rawT.id}`,
            type: orderType,
            wisproClientId: rawT.wisproClientId || `WISP-${rawT.id}`,
            wisproClientName: rawT.clientName || 'Cliente Residencial',
            wisproContractId: rawT.contractId || `CTR-${rawT.id}`,
            wisproNode: rawT.wisproNode || rawT.node || null,
            clientAddress: rawT.clientAddress || 'Panamá',
            technicianId: technician?.id || null,
            technician: technician || rawT.technician || null,
            vehicleWarehouseId: vehicleWarehouse?.id || rawT.technician?.vehicleWarehouseId || null,
            vehicleWarehouse: vehicleWarehouse || (rawT.technician?.vehicleWarehouseId ? { id: rawT.technician.vehicleWarehouseId, name: rawT.technician.vehicleWarehouseName, code: 'VEH-01' } : null),
            wisproSynced: false,
            wisproSyncMessage: 'Orden de Wispro',
            cableDropMetersUsed: 0,
            connectorsUsed: 0,
            tensorsUsed: 0,
            createdAt: rawT.createdAt || new Date().toISOString(),
          };
        }
      }

      if (!ticket) { res.status(404).json({ success: false, error: 'Orden no encontrada' }); return; }

      let retrievalChecklist: any[] = [];
      let contractAssignment: any = null;
      if (ticket.type === 'BAJA_SERVICIO' && ticket.wisproContractId) {
        [retrievalChecklist, contractAssignment] = await Promise.all([
          prisma.serializedItem.findMany({
            where: {
              OR: [
                { installedContractId: ticket.wisproContractId, status: SerializedStatus.INSTALADO_CLIENTE },
                { clientAssignment: { wisproContractId: ticket.wisproContractId }, status: SerializedStatus.INSTALADO_CLIENTE },
              ],
            },
            include: { product: { select: { id: true, name: true, brand: true, model: true, category: true } }, currentWarehouse: { select: { id: true, name: true, code: true } } },
            orderBy: { updatedAt: 'desc' },
          }),
          prisma.clientAssignment.findFirst({
            where: { wisproContractId: ticket.wisproContractId, status: 'ACTIVO' },
            include: { technician: { select: { id: true, name: true } }, node: { select: { id: true, name: true, code: true } } },
          }),
        ]);
      }

      let vehicleInventory: any = null;
      if (ticket.vehicleWarehouseId) {
        const [serials, batches, bulks] = await Promise.all([
          prisma.serializedItem.findMany({
            where: { currentWarehouseId: ticket.vehicleWarehouseId, status: SerializedStatus.EN_VEHICULO },
            include: { product: { select: { name: true, category: true, brand: true, model: true } } },
            orderBy: [{ product: { category: 'asc' } }, { serialNumber: 'asc' }],
          }),
          prisma.batchItem.findMany({
            where: { currentWarehouseId: ticket.vehicleWarehouseId, status: BatchStatus.DISPONIBLE },
            include: { product: { select: { name: true, category: true } } },
          }),
          prisma.bulkStock.findMany({
            where: { warehouseId: ticket.vehicleWarehouseId, quantity: { gt: 0 } },
            include: { product: { select: { id: true, name: true, category: true } } },
          }),
        ]);
        vehicleInventory = { serials, batches, bulks };
      }

      res.json({ success: true, ticket, retrievalChecklist, contractAssignment, retrievalCount: retrievalChecklist.length, vehicleInventory });
    } catch (err: any) {
      console.error('[WorkOrders.getOne]', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST /api/work-orders
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const { ticketNumber, type = 'INSTALACION_NUEVA', wisproClientId, wisproClientName, wisproContractId, wisproNode, clientAddress, technicianId, vehicleWarehouseId, installedOnuMac, installedOnuSerial, installedRouterMac, retiredDeviceMac, retiredDeviceStatus, notes } = req.body;
      if (!wisproContractId || !wisproClientName || !vehicleWarehouseId) {
        res.status(400).json({ success: false, error: 'wisproContractId, wisproClientName y vehicleWarehouseId son requeridos' }); return;
      }
      const responsibleUser = await resolveUser(req);
      const vehicleWarehouse = await prisma.warehouse.findUnique({ where: { id: vehicleWarehouseId } });
      if (!vehicleWarehouse) { res.status(404).json({ success: false, error: 'Bodega vehicular no encontrada' }); return; }

      const ticket = await prisma.installationTicket.create({
        data: {
          ticketNumber: ticketNumber || `WO-${type.slice(0, 3)}-${Date.now().toString().slice(-6)}`,
          type: type as InstallationTicketType,
          wisproClientId: wisproClientId || `WISP-${Date.now().toString().slice(-8)}`,
          wisproClientName,
          wisproContractId,
          wisproNode: wisproNode || null,
          clientAddress: clientAddress || vehicleWarehouse.address || 'Panama',
          technicianId: technicianId || responsibleUser.id,
          vehicleWarehouseId,
          installedOnuMac: installedOnuMac || null,
          installedOnuSerial: installedOnuSerial || null,
          installedRouterMac: installedRouterMac || null,
          retiredDeviceMac: retiredDeviceMac || null,
          retiredDeviceStatus: retiredDeviceStatus ? (retiredDeviceStatus as RetiredDeviceStatus) : null,
          notes: notes || null,
          wisproSynced: false,
          wisproSyncMessage: 'Orden creada — pendiente de completar',
        },
        include: { technician: { select: { id: true, name: true, email: true } }, vehicleWarehouse: { select: { id: true, name: true, code: true } } },
      });
      res.status(201).json({ success: true, message: `Orden ${ticket.ticketNumber} creada`, ticket });
    } catch (err: any) {
      console.error('[WorkOrders.create]', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST /api/work-orders/:id/complete
  static async complete(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const { defectiveItemIds = [], returnWarehouseId, notes } = req.body;
      const ticket = await prisma.installationTicket.findUnique({ where: { id }, include: { vehicleWarehouse: true } });
      if (!ticket) { res.status(404).json({ success: false, error: 'Orden no encontrada' }); return; }

      const responsibleUser = await resolveUser(req);
      const destWarehouseId = returnWarehouseId || ticket.vehicleWarehouseId;

      if (ticket.type === 'BAJA_SERVICIO') {
        const contractId = ticket.wisproContractId;
        const installedItems = await prisma.serializedItem.findMany({
          where: { status: SerializedStatus.INSTALADO_CLIENTE, OR: [{ installedContractId: contractId }, { clientAssignment: { wisproContractId: contractId } }] },
          include: { product: true, clientAssignment: true },
        });
        const defectiveSet = new Set<string>(Array.isArray(defectiveItemIds) ? defectiveItemIds.map(String) : []);
        await prisma.$transaction(async (tx) => {
          for (const item of installedItems) {
            const newStatus = defectiveSet.has(item.id) ? SerializedStatus.RMA_DEFECTUOSO : SerializedStatus.EN_VEHICULO;
            await tx.serializedItem.update({
              where: { id: item.id },
              data: { status: newStatus, currentWarehouseId: destWarehouseId, clientAssignmentId: null, installedContractId: null, installedClientName: null, installedClientId: null, installedDate: null, installedTicketId: null, notes: notes ? `${item.notes ? item.notes + ' | ' : ''}Retiro BAJA: ${notes}` : item.notes },
            });
            await tx.auditLog.create({ data: { macAddress: item.macAddress, serialNumber: item.serialNumber, eventType: AuditEventType.RETIRO_POR_CANCELACION, fromWarehouseId: item.currentWarehouseId, toWarehouseId: destWarehouseId, userId: responsibleUser.id, details: `Retiro baja. Contrato:${contractId} Cliente:${ticket.wisproClientName} Equipo:${item.product?.name} S/N:${item.serialNumber} Estado:${newStatus}` } });
          }
          await tx.clientAssignment.updateMany({ where: { wisproContractId: contractId, status: 'ACTIVO' }, data: { status: 'FINALIZADO' } });
          await tx.installationTicket.update({ where: { id: ticket.id }, data: { wisproSynced: true, wisproSyncMessage: `Baja completada. ${installedItems.length} equipos retirados. ${notes || ''}`.trim() } });
        });
        inventoryService.invalidateDashboardCache();
        res.json({ success: true, message: `Baja completada. ${installedItems.length} equipos retirados de ${ticket.wisproClientName}.`, summary: { totalRetrieved: installedItems.length, movedToVehicle: installedItems.filter(i => !defectiveSet.has(i.id)).length, movedToRMA: defectiveSet.size } });
        return;
      }

      await prisma.installationTicket.update({ where: { id: ticket.id }, data: { wisproSynced: true, wisproSyncMessage: notes || 'Orden completada' } });
      inventoryService.invalidateDashboardCache();
      res.json({ success: true, message: `Orden ${ticket.ticketNumber} completada.` });
    } catch (err: any) {
      console.error('[WorkOrders.complete]', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // PATCH /api/work-orders/:id/status
  static async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const { notes, wisproSynced, wisproSyncMessage } = req.body;
      const ticket = await prisma.installationTicket.findUnique({ where: { id } });
      if (!ticket) { res.status(404).json({ success: false, error: 'Orden no encontrada' }); return; }
      const updated = await prisma.installationTicket.update({
        where: { id },
        data: {
          ...(notes !== undefined ? { notes } : {}),
          ...(wisproSynced !== undefined ? { wisproSynced: Boolean(wisproSynced) } : {}),
          ...(wisproSyncMessage !== undefined ? { wisproSyncMessage } : {}),
        },
        include: { technician: { select: { id: true, name: true } }, vehicleWarehouse: { select: { id: true, name: true } } },
      });
      res.json({ success: true, ticket: updated });
    } catch (err: any) {
      console.error('[WorkOrders.updateStatus]', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // GET /api/work-orders/contract/:contractId/checklist
  static async retrievalChecklist(req: Request, res: Response): Promise<void> {
    try {
      const contractId = String(req.params.contractId);
      const items = await prisma.serializedItem.findMany({
        where: { status: SerializedStatus.INSTALADO_CLIENTE, OR: [{ installedContractId: contractId }, { clientAssignment: { wisproContractId: contractId } }] },
        include: { product: { select: { id: true, name: true, brand: true, model: true, category: true } }, currentWarehouse: { select: { id: true, name: true, code: true } } },
        orderBy: { updatedAt: 'desc' },
      });
      const assignment = await prisma.clientAssignment.findFirst({
        where: { wisproContractId: contractId, status: 'ACTIVO' },
        include: { technician: { select: { id: true, name: true } }, node: { select: { id: true, name: true } } },
      });
      res.json({ success: true, contractId, retrievalCount: items.length, items, assignment });
    } catch (err: any) {
      console.error('[WorkOrders.retrievalChecklist]', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
