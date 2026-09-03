"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rma_controller_1 = require("../controllers/rma.controller");
const router = (0, express_1.Router)();
// Consultar lista de equipos en RMA / Cuarentena
router.get('/items', rma_controller_1.RMAController.getRmaItems);
// Lookup rápido por MAC o Serial
router.get('/lookup/:query', rma_controller_1.RMAController.lookupDevice);
// Procesar retiro / devolución / RMA
router.post('/return', rma_controller_1.RMAController.returnEquipment);
exports.default = router;
