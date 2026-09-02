import { Router } from 'express';
import { InventoryController } from '../controllers/inventoryController';

const router = Router();

// GET /api/v1/inventory - Obtener inventario completo optimizado
router.get('/inventory', InventoryController.getInventory);

// POST /api/v1/inventory/cache/clear - Invalidar caché de inventario
router.post('/inventory/cache/clear', InventoryController.clearCache);

export default router;
