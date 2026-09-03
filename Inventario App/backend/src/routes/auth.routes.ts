import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { verifyToken } from '../middlewares/auth.middleware';

const router = Router();

// Rutas Públicas
router.post('/login', AuthController.login);

// Rutas Protegidas
router.get('/me', verifyToken, AuthController.me);
router.get('/users', verifyToken, AuthController.getUsers);

export default router;
