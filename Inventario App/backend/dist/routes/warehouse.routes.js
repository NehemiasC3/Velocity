"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const warehouse_controller_1 = require("../controllers/warehouse.controller");
const router = (0, express_1.Router)();
// CRUD de Bodegas con Jerarquía
router.get('/', warehouse_controller_1.WarehouseController.getWarehouses);
router.get('/:id', warehouse_controller_1.WarehouseController.getWarehouseById);
router.post('/', warehouse_controller_1.WarehouseController.createWarehouse);
router.put('/:id', warehouse_controller_1.WarehouseController.updateWarehouse);
router.delete('/:id', warehouse_controller_1.WarehouseController.deleteWarehouse);
exports.default = router;
