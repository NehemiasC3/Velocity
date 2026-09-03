import { Router } from 'express';
import { LiquidationController } from '../controllers/liquidation.controller';

const router = Router();

// Consultar liquidaciones
router.get('/', LiquidationController.getLiquidations);

// Endpoint transaccional de consumo / liquidación
router.post('/consume', LiquidationController.consumeLiquidation);

export default router;
