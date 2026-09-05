import { Router, Response } from 'express';
import { prisma } from '../db';
import { inventoryService } from '../services/inventory.service';
import { wisproService } from '../services/wispro.service';
import { authMiddleware, requireRole, AuthenticatedRequest } from '../middlewares/auth.middleware';
import inventoryApiRoutes from './inventory.routes';
import { WarehouseController } from '../controllers/warehouse.controller';
import { InventoryController } from '../controllers/inventory.controller';
import { TransferController } from '../controllers/transfer.controller';
import { LiquidationController } from '../controllers/liquidation.controller';
import { SearchController } from '../controllers/search.controller';
import warehouseRoutes from './warehouse.routes';
import catalogRoutes from './catalog.routes';
import transferRoutes from './transfer.routes';
import liquidationRoutes from './liquidation.routes';
import rmaRoutes from './rma.routes';
import wisproRoutes from './wispro.routes';
import analyticsRoutes from './analytics.routes';
import authRoutes from './auth.routes';

const router = Router();

// ==========================================
// 0. BÚSQUEDA UNIVERSAL GLOBAL (COMMAND PALETTE)
// ==========================================
router.get('/search/universal', authMiddleware, SearchController.universalSearch);

// ==========================================
// 1. AUTENTICACIÓN & USUARIOS (RBAC)
// ==========================================
router.use('/auth', authRoutes);

// ==========================================
// 2. DASHBOARD GENERAL (KPIS Y ALERTAS)
// ==========================================
router.get('/dashboard/kpis', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const kpis = await inventoryService.getDashboardKPIs();
  res.json(kpis);
});

// ==========================================
// 3. CATÁLOGO CENTRAL DE PRODUCTOS (PRISMA)
// ==========================================
router.use('/catalog', catalogRoutes);

// ==========================================
// 4. BODEGAS (HUB & SPOKE CON JERARQUÍA PRISMA)
// ==========================================
router.use('/warehouses', warehouseRoutes);

// ==========================================
// 5. INVENTARIO FÍSICO, INBOUND & STOCK
// ==========================================
router.post('/inventory/inbound', authMiddleware, InventoryController.inboundInventory);
router.get('/inventory/stock', TransferController.getWarehouseStock);
router.use(inventoryApiRoutes);

// ==========================================
// 6. ÓRDENES DE TRASLADO (HUB -> SPOKE -> VEHICLE)
// ==========================================
router.use('/transfers', transferRoutes);

// ==========================================
// 7. LIQUIDACIÓN Y CONSUMO EN CAMPO
// ==========================================
router.use('/liquidations', liquidationRoutes);
router.post('/technician/tickets/close', authMiddleware, LiquidationController.consumeLiquidation);

// ==========================================
// 8. LOGÍSTICA INVERSA & RMA
// ==========================================
router.use('/rma', rmaRoutes);

// ==========================================
// 9. AUDITORÍA FORENSE & ANALÍTICA
// ==========================================
router.use('/analytics', analyticsRoutes);

router.get('/audit/mac/:query', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const query = String(req.params.query);
  const history = await inventoryService.searchForensicHistory(query);
  res.json(history);
});

router.get('/audit/logs', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const logs = await prisma.auditLog.findMany({
    take: 100,
    orderBy: { timestamp: 'desc' },
    include: { user: true, fromWarehouse: true, toWarehouse: true }
  });
  res.json({ logs });
});

// ==========================================
// 10. APP MÓVIL DEL TÉCNICO (MI CAMIONETA)
// ==========================================
router.get('/technician/my-vehicle', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const warehouse = await prisma.warehouse.findFirst({
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
    prisma.serializedItem.findMany({
      where: { currentWarehouseId: warehouse.id, status: 'EN_VEHICULO' },
      include: { product: true }
    }),
    prisma.bulkStock.findMany({
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

router.get('/technician/tickets', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const tickets = await prisma.installationTicket.findMany({
    take: 100,
    orderBy: { createdAt: 'desc' },
    include: { technician: true }
  });
  res.json({ tickets });
});

// ==========================================
// 11. VISTA 360° EQUIPOS POR CLIENTE
// ==========================================
router.get('/clients/equipment-view', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, category, status } = req.query as Record<string, string>;

    // 1. Obtener todos los clientes Wispro de la BD local
    const whereClause: any = {};
    if (status && status !== 'ALL') whereClause.status = status;
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contractId: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { nodeName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const wisproClients = await prisma.wisproClient.findMany({
      where: whereClause,
      orderBy: { name: 'asc' }
    });

    // 2. Para cada cliente, buscar sus equipos instalados y tickets
    const clientIds = wisproClients.map(c => c.id);

    const [serializedItems, installationTickets] = await Promise.all([
      // Equipos serializados actualmente instalados en clientes
      prisma.serializedItem.findMany({
        where: {
          status: 'INSTALADO_CLIENTE',
          installedClientId: { in: clientIds },
          ...(category && category !== 'ALL' ? { category: category as any } : {})
        },
        include: {
          product: {
            select: { name: true, brand: true, model: true, category: true }
          }
        }
      }),
      // Historial de tickets de instalación
      prisma.installationTicket.findMany({
        where: { wisproClientId: { in: clientIds } },
        include: { technician: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    // 3. Construir mapa: clientId => { equipos, tickets }
    const equipmentByClient = new Map<string, typeof serializedItems>();
    const ticketsByClient = new Map<string, typeof installationTickets>();

    for (const item of serializedItems) {
      if (!item.installedClientId) continue;
      const arr = equipmentByClient.get(item.installedClientId) || [];
      arr.push(item);
      equipmentByClient.set(item.installedClientId, arr);
    }

    for (const tk of installationTickets) {
      const arr = ticketsByClient.get(tk.wisproClientId) || [];
      arr.push(tk);
      ticketsByClient.set(tk.wisproClientId, arr);
    }

    // 4. Construir respuesta enriquecida
    const clients = wisproClients.map(client => {
      const equip = equipmentByClient.get(client.id) || [];
      const tickets = ticketsByClient.get(client.id) || [];

      // Summary por categoria
      const summary: Record<string, number> = {};
      for (const eq of equip) {
        const cat = eq.product?.category || 'OTRO';
        summary[cat] = (summary[cat] || 0) + 1;
      }

      return {
        id: client.id,
        name: client.name,
        contractId: client.contractId,
        address: client.address,
        nodeName: client.nodeName,
        planName: client.planName,
        status: client.status,
        currentOnuMac: client.currentOnuMac,
        installedEquipment: equip.map(eq => ({
          id: eq.id,
          serialNumber: eq.serialNumber,
          macAddress: eq.macAddress,
          category: eq.product?.category,
          productName: eq.product?.name,
          brand: eq.product?.brand,
          model: eq.product?.model,
          installedDate: eq.installedDate,
          installedTicketId: eq.installedTicketId,
        })),
        ticketHistory: tickets.map(tk => ({
          id: tk.id,
          ticketNumber: tk.ticketNumber,
          type: tk.type,
          technicianName: tk.technician?.name,
          createdAt: tk.createdAt,
        })),
        equipmentSummary: summary,
      };
    });

    // 5. Totales globales
    const totals = {
      totalClients: clients.length,
      withEquipment: clients.filter(c => c.installedEquipment.length > 0).length,
      withCamera: clients.filter(c => (c.equipmentSummary['CAMARA_SEGURIDAD_IOT'] ?? 0) > 0).length,
      withTvBox: clients.filter(c => (c.equipmentSummary['TV_BOX_OTT'] ?? 0) > 0).length,
      withRepeater: clients.filter(c => (c.equipmentSummary['REPETIDOR_MESH'] ?? 0) > 0).length,
    };

    res.json({ success: true, clients, totals });
  } catch (error: any) {
    console.error('[equipment-view] Error:', error);
    res.status(500).json({ success: false, error: 'Error generando vista de equipos por cliente', details: error.message });
  }
});

// ==========================================
// 12. INTEGRACIÓN WISPRO CLOUD
// ==========================================
router.use('/wispro', wisproRoutes);

router.get('/wispro/clients', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { status, search } = req.query;
  const clients = await wisproService.getClients({
    status: status as string,
    search: search as string
  });
  res.json({ clients });
});

router.post('/wispro/sync', authMiddleware, requireRole(['SUPERADMIN', 'ADMIN_BODEGA', 'ENCARGADO_PERSONAL']), async (req: AuthenticatedRequest, res: Response) => {
  const result = await wisproService.syncWithWispro();
  res.json(result);
});

// ==========================================
// 12. MÉTRICAS DE PERSONAL Y MERMAS DE CABLE
// ==========================================
router.get('/metrics/personnel', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const metrics = await inventoryService.getTechnicianMetrics();
  res.json({ metrics });
});

// ==========================================
// 13. RESET DE PRUEBAS
// ==========================================
router.post('/system/reset', authMiddleware, requireRole(['SUPERADMIN', 'ADMIN_BODEGA']), async (req: AuthenticatedRequest, res: Response) => {
  res.json({ message: 'Sistema sincronizado con base de datos Prisma.' });
});

export default router;
