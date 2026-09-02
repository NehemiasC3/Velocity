import { Request, Response } from 'express';
import { authService } from '../services/AuthService';

export class AuthController {
  public static login(req: Request, res: Response): void {
    const { email, password } = req.body;

    try {
      const response = authService.login(email, password);
      res.status(200).json(response);
    } catch (error: any) {
      res.status(401).json({ error: error.message || 'Error en inicio de sesión' });
    }
  }

  public static verifySession(req: Request, res: Response): void {
    if (req.user) {
      res.status(200).json({ valid: true, user: req.user });
    } else {
      res.status(401).json({ valid: false, error: 'No autorizado' });
    }
  }
}
