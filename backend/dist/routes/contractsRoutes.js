"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const contractsController_1 = require("../controllers/contractsController");
const router = (0, express_1.Router)();
// Endpoint principal /api/contracts (PostgreSQL sub-50ms)
router.get('/contracts', contractsController_1.ContractsController.getContracts);
router.get('/contracts/active', contractsController_1.ContractsController.getContracts);
router.get('/contracts/:id', contractsController_1.ContractsController.getContractById);
exports.default = router;
