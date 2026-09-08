import { Router } from 'express';
import { ClientAssignmentController } from '../controllers/clientAssignment.controller';
import { authMiddleware, optionalAuth } from '../middlewares/auth.middleware';

const router = Router();

// Búsqueda rápida de equipos serializados disponibles para asignar
router.get('/available-items', optionalAuth, ClientAssignmentController.searchAvailableItems);

// Asignaciones por contrato Wispro (soporta tanto :wisproContractId como :contractId)
router.get('/contract/:wisproContractId', optionalAuth, ClientAssignmentController.getContractAssignment);

// Desvincular / retirar un equipo específico de una asignación (por body o por param)
router.post('/unassign', authMiddleware, ClientAssignmentController.unassignItem);
router.post('/items/:itemId/unassign', authMiddleware, ClientAssignmentController.unassignItem);

// Listado paginado de asignaciones
router.get('/', optionalAuth, ClientAssignmentController.getAssignments);

// Crear o actualizar asignación multi-equipo a un contrato
router.post('/', authMiddleware, ClientAssignmentController.createAssignment);

export default router;
