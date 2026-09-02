import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { validateToken } from '../middlewares/authMiddleware';
import { loginLimiter } from '../middlewares/rateLimitMiddleware';

const router = Router();

router.post('/login', loginLimiter, AuthController.login);
router.get('/verify', validateToken, AuthController.verifySession);

export default router;
