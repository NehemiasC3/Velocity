import { Router } from 'express';
import { ReportController } from '../controllers/reportController';
import { validateToken } from '../middlewares/authMiddleware';

const router = Router();

router.post('/test-report-email', validateToken, ReportController.testReportEmail);
router.post('/test-gdrive', validateToken, ReportController.testGDrive);

export default router;
