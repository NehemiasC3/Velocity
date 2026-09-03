import { Router } from 'express';
import { CatalogController } from '../controllers/catalog.controller';

const router = Router();

// CRUD de Catálogo Central de Productos
router.get('/', CatalogController.getCatalog);
router.get('/:id', CatalogController.getCatalogProductById);
router.post('/', CatalogController.createCatalogProduct);
router.put('/:id', CatalogController.updateCatalogProduct);
router.delete('/:id', CatalogController.deleteCatalogProduct);

export default router;
