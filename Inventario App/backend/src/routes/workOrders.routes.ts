import { Router } from 'express';
import { WorkOrdersController } from '../controllers/workOrders.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Listado con filtros
router.get('/', authMiddleware, WorkOrdersController.list);

// Checklist de retiro en tiempo real para un contrato (antes del endpoint genérico /:id)
router.get('/contract/:contractId/checklist', authMiddleware, WorkOrdersController.retrievalChecklist);

// Detalle de una orden (incluye checklist si es BAJA_SERVICIO)
router.get('/:id', authMiddleware, WorkOrdersController.getOne);

// Crear nueva orden
router.post('/', authMiddleware, WorkOrdersController.create);

// Completar orden (flujo transaccional para BAJA_SERVICIO)
router.post('/:id/complete', authMiddleware, WorkOrdersController.complete);

// Actualizar estado / notas de la orden
router.patch('/:id/status', authMiddleware, WorkOrdersController.updateStatus);

export default router;
