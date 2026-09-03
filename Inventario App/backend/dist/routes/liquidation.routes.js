"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const liquidation_controller_1 = require("../controllers/liquidation.controller");
const router = (0, express_1.Router)();
// Consultar liquidaciones
router.get('/', liquidation_controller_1.LiquidationController.getLiquidations);
// Endpoint transaccional de consumo / liquidación
router.post('/consume', liquidation_controller_1.LiquidationController.consumeLiquidation);
exports.default = router;
