"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const clientAssignment_controller_1 = require("../controllers/clientAssignment.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Búsqueda rápida de equipos serializados disponibles para asignar
router.get('/available-items', auth_middleware_1.optionalAuth, clientAssignment_controller_1.ClientAssignmentController.searchAvailableItems);
// Asignaciones por contrato Wispro (soporta tanto :wisproContractId como :contractId)
router.get('/contract/:wisproContractId', auth_middleware_1.optionalAuth, clientAssignment_controller_1.ClientAssignmentController.getContractAssignment);
// Desvincular / retirar un equipo específico de una asignación (por body o por param)
router.post('/unassign', auth_middleware_1.authMiddleware, clientAssignment_controller_1.ClientAssignmentController.unassignItem);
router.post('/items/:itemId/unassign', auth_middleware_1.authMiddleware, clientAssignment_controller_1.ClientAssignmentController.unassignItem);
// Listado paginado de asignaciones
router.get('/', auth_middleware_1.optionalAuth, clientAssignment_controller_1.ClientAssignmentController.getAssignments);
// Crear o actualizar asignación multi-equipo a un contrato
router.post('/', auth_middleware_1.authMiddleware, clientAssignment_controller_1.ClientAssignmentController.createAssignment);
exports.default = router;
