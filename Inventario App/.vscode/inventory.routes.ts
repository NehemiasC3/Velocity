import { Router } from 'express';
import { inventoryController } from '../controllers/inventory.controller';

const router = Router();

router.get('/inventory', inventoryController.getFullInventory);

export default router;