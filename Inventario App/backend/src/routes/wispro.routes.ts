import { Router } from 'express';
import { WisproController } from '../controllers/wispro.controller';

const router = Router();

// Sincronización REST de contratos & inventario
router.post('/sync', WisproController.syncWispro);

// Contratos y detalles (Espejo Local PostgreSQL Sub-20ms)
router.get('/contracts', WisproController.getContracts);
router.get('/contracts/active', WisproController.getActiveContracts);
router.get('/contracts/:id', WisproController.getContractDetails);

// Tickets e instalaciones
router.get('/tickets/open', WisproController.getOpenTickets);
router.get('/installations/pending', WisproController.getPendingInstallations);
router.put('/assign', WisproController.assignTicket);

export default router;
