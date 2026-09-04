import { Router } from 'express';
import { WarehouseController } from '../controllers/warehouse.controller';

const router = Router();

// CRUD de Bodegas con Jerarquía
router.get('/', WarehouseController.getWarehouses);
router.get('/technician/:identifier', WarehouseController.getTechnicianVehicleWarehouse);
router.get('/:id', WarehouseController.getWarehouseById);
router.post('/', WarehouseController.createWarehouse);
router.put('/:id', WarehouseController.updateWarehouse);
router.delete('/:id', WarehouseController.deleteWarehouse);

export default router;
