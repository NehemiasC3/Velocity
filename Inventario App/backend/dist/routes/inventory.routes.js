"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inventory_controller_1 = require("../controllers/inventory.controller");
const router = (0, express_1.Router)();
// Inbound Inventory (Alta de Stock Físico Transaccional)
router.post('/inventory/inbound', inventory_controller_1.InventoryController.inboundInventory);
router.post('/inbound', inventory_controller_1.InventoryController.inboundInventory);
// Serialized Inventory (ONUs, Routers, Equipos)
router.get('/inventory/serialized', inventory_controller_1.InventoryController.getSerializedItems);
router.get('/serialized', inventory_controller_1.InventoryController.getSerializedItems);
router.post('/inventory/serialized', inventory_controller_1.InventoryController.createSerializedItem);
router.post('/serialized', inventory_controller_1.InventoryController.createSerializedItem);
router.delete('/inventory/serialized/:id', inventory_controller_1.InventoryController.deleteSerializedItem);
router.delete('/serialized/:id', inventory_controller_1.InventoryController.deleteSerializedItem);
// Batched Inventory (Bobinas y Lotes de Cable Drop)
router.get('/inventory/batches', inventory_controller_1.InventoryController.getBatchItems);
router.get('/batches', inventory_controller_1.InventoryController.getBatchItems);
// Bulk Inventory (Conectores, Herrajes, Granel)
router.get('/inventory/bulk', inventory_controller_1.InventoryController.getBulkInventory);
router.get('/bulk', inventory_controller_1.InventoryController.getBulkInventory);
router.post('/inventory/bulk/adjust', inventory_controller_1.InventoryController.adjustBulkStock);
router.post('/bulk/adjust', inventory_controller_1.InventoryController.adjustBulkStock);
exports.default = router;
