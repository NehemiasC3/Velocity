import { Router } from 'express';
import { SystemController } from '../controllers/systemController';

const router = Router();

router.get('/system/info', SystemController.getSystemInfo);
router.post('/system/backup', SystemController.triggerBackup);
router.get('/system/backups/download/:filename', SystemController.downloadBackup);

export default router;
