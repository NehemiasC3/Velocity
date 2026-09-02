import { Request, Response } from 'express';
import { wisproService } from '../services/wispro.service';

class InventoryController {
  public async getFullInventory(req: Request, res: Response): Promise<void> {
    try {
      const inventory = await wisproService.getFullInventory();
      res.status(200).json(inventory);
    } catch (error: any) {
      res.status(500).json({ 
        message: 'Error al obtener el inventario completo', 
        error: error.message 
      });
    }
  }
}

export const inventoryController = new InventoryController();