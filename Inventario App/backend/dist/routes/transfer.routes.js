"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const transfer_controller_1 = require("../controllers/transfer.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.optionalAuth);
// Consultas de Traslados y Stock por Bodega
router.get('/', transfer_controller_1.TransferController.getTransfers);
router.get('/warehouse-stock/:warehouseId', transfer_controller_1.TransferController.getWarehouseStock);
// Crear Orden de Traslado Transaccional
router.post('/', transfer_controller_1.TransferController.createTransfer);
// Confirmar Recepción de Orden de Traslado
router.post('/:orderId/receive', transfer_controller_1.TransferController.receiveTransfer);
router.post('/:id/receive', transfer_controller_1.TransferController.receiveTransfer);
exports.default = router;
