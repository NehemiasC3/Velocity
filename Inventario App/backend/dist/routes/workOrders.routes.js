"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const workOrders_controller_1 = require("../controllers/workOrders.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Listado con filtros
router.get('/', auth_middleware_1.authMiddleware, workOrders_controller_1.WorkOrdersController.list);
// Checklist de retiro en tiempo real para un contrato (antes del endpoint genérico /:id)
router.get('/contract/:contractId/checklist', auth_middleware_1.authMiddleware, workOrders_controller_1.WorkOrdersController.retrievalChecklist);
// Detalle de una orden (incluye checklist si es BAJA_SERVICIO)
router.get('/:id', auth_middleware_1.authMiddleware, workOrders_controller_1.WorkOrdersController.getOne);
// Crear nueva orden
router.post('/', auth_middleware_1.authMiddleware, workOrders_controller_1.WorkOrdersController.create);
// Completar orden (flujo transaccional para BAJA_SERVICIO)
router.post('/:id/complete', auth_middleware_1.authMiddleware, workOrders_controller_1.WorkOrdersController.complete);
// Actualizar estado / notas de la orden
router.patch('/:id/status', auth_middleware_1.authMiddleware, workOrders_controller_1.WorkOrdersController.updateStatus);
exports.default = router;
