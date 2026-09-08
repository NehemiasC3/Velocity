import { Router } from 'express';
import { InventoryController } from '../controllers/inventory.controller';
import { optionalAuth } from '../middlewares/auth.middleware';

const router = Router();

router.use(optionalAuth);

// Inbound Inventory (Alta de Stock Físico Transaccional)
router.post('/inventory/inbound', InventoryController.inboundInventory);
router.post('/inbound', InventoryController.inboundInventory);

// Serialized Inventory (ONUs, Routers, Equipos)
router.get('/inventory/serialized', InventoryController.getSerializedItems);
router.get('/serialized', InventoryController.getSerializedItems);
router.post('/inventory/serialized', InventoryController.createSerializedItem);
router.post('/serialized', InventoryController.createSerializedItem);
router.delete('/inventory/serialized/:id', InventoryController.deleteSerializedItem);
router.delete('/serialized/:id', InventoryController.deleteSerializedItem);

// Batched Inventory (Bobinas y Lotes de Cable Drop)
router.get('/inventory/batches', InventoryController.getBatchItems);
router.get('/batches', InventoryController.getBatchItems);

// Bulk Inventory (Conectores, Herrajes, Granel)
router.get('/inventory/bulk', InventoryController.getBulkInventory);
router.get('/bulk', InventoryController.getBulkInventory);
router.post('/inventory/bulk/adjust', InventoryController.adjustBulkStock);
router.post('/bulk/adjust', InventoryController.adjustBulkStock);

export default router;