import { Router } from 'express';
import { WisproProxyController } from '../controllers/wisproProxyController';
import { ContractsController } from '../controllers/contractsController';
import { validateToken } from '../middlewares/authMiddleware';

const router = Router();

// 1. Sincronización REST con Wispro en segundo plano (no bloquea al usuario)
router.post(['/wispro/sync', '/v1/wispro/sync'], ContractsController.syncWispro);

// 2. Consulta 100% local de contratos sobre PostgreSQL (sub-50ms)
router.get(['/wispro/contracts/active', '/v1/wispro/contracts/active'], ContractsController.getContracts);
router.get(['/wispro/contracts', '/v1/wispro/contracts'], ContractsController.getContracts);
router.get(['/wispro/contracts/:id', '/v1/wispro/contracts/:id'], ContractsController.getContractById);

// 3. Proxy transparente para llamadas directas a Wispro API
router.all('/wispro/*', validateToken, WisproProxyController.handleProxy);

export default router;
