import { Router } from 'express';
import { WisproProxyController } from '../controllers/wisproProxyController';
import { validateToken } from '../middlewares/authMiddleware';

const router = Router();

// Proxy transparente para llamadas directas a Wispro API
router.all('/wispro/*', validateToken, WisproProxyController.handleProxy);

export default router;
