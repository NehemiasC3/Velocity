import { Router } from 'express';
import { TransferController } from '../controllers/transfer.controller';

const router = Router();

// Consultas de Traslados y Stock por Bodega
router.get('/', TransferController.getTransfers);
router.get('/warehouse-stock/:warehouseId', TransferController.getWarehouseStock);

// Crear Orden de Traslado Transaccional
router.post('/', TransferController.createTransfer);

export default router;
