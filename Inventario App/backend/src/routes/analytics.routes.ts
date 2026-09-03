import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';

const router = Router();

// KPIs y métricas gerenciales
router.get('/kpis', AnalyticsController.getKPIs);

// Historial y búsqueda forense de auditoría
router.get('/audit-log', AnalyticsController.getAuditLogs);

export default router;
