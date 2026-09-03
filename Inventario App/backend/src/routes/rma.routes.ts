import { Router } from 'express';
import { RMAController } from '../controllers/rma.controller';

const router = Router();

// Consultar lista de equipos en RMA / Cuarentena
router.get('/items', RMAController.getRmaItems);

// Lookup rápido por MAC o Serial
router.get('/lookup/:query', RMAController.lookupDevice);

// Procesar retiro / devolución / RMA
router.post('/return', RMAController.returnEquipment);

export default router;
