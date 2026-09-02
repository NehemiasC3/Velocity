import { Request, Response } from 'express';
import { inventoryService } from '../services/inventory.service';

class InventoryController {
  public async getFullInventory(req: Request, res: Response): Promise<void> {
    try {
      const inventory = inventoryService.getFullInventory();
      res.json(inventory);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get full inventory' });
    }
  }
}

export const inventoryController = new InventoryController();
