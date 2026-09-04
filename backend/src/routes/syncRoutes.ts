import { Router } from 'express';
import { SyncController } from '../controllers/syncController';
import { validateToken } from '../middlewares/authMiddleware';

const router = Router();

router.get('/sync', validateToken, SyncController.getSyncState);
router.post('/sync', validateToken, SyncController.updateSyncState);
router.post('/heartbeat', SyncController.heartbeat);
router.post('/sync/heartbeat', SyncController.heartbeat);

export default router;
