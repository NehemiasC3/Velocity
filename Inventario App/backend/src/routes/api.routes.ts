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
// 11. INTEGRACIÓN WISPRO CLOUD
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
