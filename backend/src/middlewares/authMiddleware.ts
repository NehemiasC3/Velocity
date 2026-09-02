import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/AuthService';

export function validateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = (req.headers['authorization'] || req.headers['x-api-secret']) as string | undefined;

  if (!authHeader) {
    res.status(401).json({ error: 'No autorizado. Se requiere token.' });
    return;
  }

  // Bypass maestro para compatibilidad de herramientas administrativas
  if (authService.isMasterSecret(authHeader)) {
    return next();
  }

  try {
    const cleanToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const decoded = authService.verifyToken(cleanToken);
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Sesión inválida o expirada.' });
  }
}
