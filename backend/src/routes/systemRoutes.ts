import { Router } from 'express';
import { SystemController } from '../controllers/systemController';

const router = Router();

/**
 * Rutas para el monitoreo y estado del sistema.
 */

// GET /api/system/health - Devuelve el estado de salud de los servicios críticos
router.get('/health', SystemController.getHealthStatus);

export default router;
