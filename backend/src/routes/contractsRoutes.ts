import { Router } from 'express';
import { ContractsController } from '../controllers/contractsController';

const router = Router();

// Endpoint principal /api/contracts (PostgreSQL sub-50ms)
router.get('/contracts', ContractsController.getContracts);
router.get('/contracts/active', ContractsController.getContracts);
router.get('/contracts/:id', ContractsController.getContractById);
router.post('/contracts', ContractsController.createContract);
router.put('/contracts/:id', ContractsController.updateContract);

// Endpoint /api/plans para catálogo y gestión de planes de velocidad
router.get('/plans', ContractsController.getPlans);
router.post('/plans', ContractsController.createPlan);
router.put('/plans/:id', ContractsController.updatePlan);
router.delete('/plans/:id', ContractsController.deletePlan);

export default router;
