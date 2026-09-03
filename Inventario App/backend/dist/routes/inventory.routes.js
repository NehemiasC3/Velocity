"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inventory_controller_1 = require("../controllers/inventory.controller");
const router = (0, express_1.Router)();
// Inbound Inventory (Alta de Stock Físico Transaccional)
router.post('/inventory/inbound', inventory_controller_1.InventoryController.inboundInventory);
router.post('/inbound', inventory_controller_1.InventoryController.inboundInventory);
exports.default = router;
