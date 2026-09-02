import { Request, Response, NextFunction } from 'express';
import { Role } from '../types';
import { db } from '../db';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    role: Role;
    assignedWarehouseId?: string;
  };
}

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Para testing ágil o simulación de sesión en el demo, permitir header 'x-user-id' o Bearer token
  const userIdHeader = req.headers['x-user-id'] as string;
  const authHeader = req.headers['authorization'];

  let targetUserId = userIdHeader || 'usr-admin-1';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    // En demo permitimos token con formato usr-xxx
    if (token.startsWith('usr-')) {
      targetUserId = token;
    }
  }

  const user = db.getUsers().find(u => u.id === targetUserId);
  if (!user) {
    return res.status(401).json({ error: 'Usuario no autenticado o no encontrado' });
  }

  req.user = user;
  next();
};

export const requireRole = (allowedRoles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Acceso denegado. Se requiere uno de los siguientes roles: ${allowedRoles.join(', ')}. Tu rol actual es: ${req.user.role}` 
      });
    }

    next();
  };
};
