"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inventoryController_1 = require("../controllers/inventoryController");
const router = (0, express_1.Router)();
// GET /api/v1/inventory - Obtener inventario completo optimizado
router.get('/inventory', inventoryController_1.InventoryController.getInventory);
// POST /api/v1/inventory/cache/clear - Invalidar caché de inventario
router.post('/inventory/cache/clear', inventoryController_1.InventoryController.clearCache);
exports.default = router;
