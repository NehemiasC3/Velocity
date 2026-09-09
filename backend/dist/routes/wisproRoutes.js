"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const wisproProxyController_1 = require("../controllers/wisproProxyController");
const contractsController_1 = require("../controllers/contractsController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
// 1. Sincronización REST con Wispro en segundo plano (no bloquea al usuario)
router.post(['/wispro/sync', '/v1/wispro/sync'], contractsController_1.ContractsController.syncWispro);
// 2. Consulta 100% local de contratos sobre PostgreSQL (sub-50ms)
router.get(['/wispro/contracts/active', '/v1/wispro/contracts/active'], contractsController_1.ContractsController.getContracts);
router.get(['/wispro/contracts', '/v1/wispro/contracts'], contractsController_1.ContractsController.getContracts);
router.get(['/wispro/contracts/:id', '/v1/wispro/contracts/:id'], contractsController_1.ContractsController.getContractById);
// 3. Proxy transparente para llamadas directas a Wispro API
router.all('/wispro/*', authMiddleware_1.validateToken, wisproProxyController_1.WisproProxyController.handleProxy);
exports.default = router;
