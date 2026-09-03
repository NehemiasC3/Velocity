import { Router } from 'express';
import { InventoryController } from '../controllers/inventory.controller';

const router = Router();

// Inbound Inventory (Alta de Stock Físico Transaccional)
router.post('/inventory/inbound', InventoryController.inboundInventory);
router.post('/inbound', InventoryController.inboundInventory);

export default router;