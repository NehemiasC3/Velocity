"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const catalog_controller_1 = require("../controllers/catalog.controller");
const router = (0, express_1.Router)();
// CRUD de Catálogo Central de Productos
router.get('/', catalog_controller_1.CatalogController.getCatalog);
router.get('/:id', catalog_controller_1.CatalogController.getCatalogProductById);
router.post('/', catalog_controller_1.CatalogController.createCatalogProduct);
router.put('/:id', catalog_controller_1.CatalogController.updateCatalogProduct);
router.delete('/:id', catalog_controller_1.CatalogController.deleteCatalogProduct);
exports.default = router;
