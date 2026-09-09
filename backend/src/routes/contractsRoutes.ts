import { Router } from 'express';
import { ContractsController } from '../controllers/contractsController';

const router = Router();

// Endpoint principal /api/contracts (PostgreSQL sub-50ms)
router.get('/contracts', ContractsController.getContracts);
router.get('/contracts/active', ContractsController.getContracts);
router.get('/contracts/:id', ContractsController.getContractById);

export default router;
