import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { validateToken } from '../middlewares/authMiddleware';
import { loginLimiter } from '../middlewares/rateLimitMiddleware';

const router = Router();

router.post('/login', loginLimiter, AuthController.login);
router.get('/verify', validateToken, AuthController.verifySession);
router.post('/reset-password', AuthController.resetPassword);
router.post('/update-password', AuthController.resetPassword);
router.post('/users/reset-password', AuthController.resetPassword);
router.post('/users/update-password', AuthController.resetPassword);

export default router;
