"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const transfer_controller_1 = require("../controllers/transfer.controller");
const router = (0, express_1.Router)();
// Consultas de Traslados y Stock por Bodega
router.get('/', transfer_controller_1.TransferController.getTransfers);
router.get('/warehouse-stock/:warehouseId', transfer_controller_1.TransferController.getWarehouseStock);
// Crear Orden de Traslado Transaccional
router.post('/', transfer_controller_1.TransferController.createTransfer);
exports.default = router;
