import { Router } from 'express';
import { WisproController } from '../controllers/wispro.controller';

const router = Router();

router.get('/tickets/open', WisproController.getOpenTickets);
router.get('/installations/pending', WisproController.getPendingInstallations);
router.put('/assign', WisproController.assignTicket);

export default router;
