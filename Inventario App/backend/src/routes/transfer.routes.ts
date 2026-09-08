import { Router } from 'express';
import { TransferController } from '../controllers/transfer.controller';
import { optionalAuth } from '../middlewares/auth.middleware';

const router = Router();

router.use(optionalAuth);

// Consultas de Traslados y Stock por Bodega
router.get('/', TransferController.getTransfers);
router.get('/warehouse-stock/:warehouseId', TransferController.getWarehouseStock);

// Crear Orden de Traslado Transaccional
router.post('/', TransferController.createTransfer);

// Confirmar Recepción de Orden de Traslado
router.post('/:orderId/receive', TransferController.receiveTransfer);
router.post('/:id/receive', TransferController.receiveTransfer);

export default router;
