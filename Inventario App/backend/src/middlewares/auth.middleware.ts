import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { Role } from '@prisma/client';

export const JWT_SECRET = process.env.JWT_SECRET || 'velocity-isp-secret-jwt-key-2026-prod';

export interface UserPayload {
  id: string;
  name: string;
  email: string;
  role: Role | string;
  baseWarehouseId?: string | null;
  assignedWarehouseId?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

/**
 * Middleware para validar el JWT en Authorization: Bearer <token>
 */
export const verifyToken = async (
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    let token: string | undefined;

    if (authHeader) {
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim();
      } else {
        token = authHeader.trim();
      }
    }

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'No autorizado. Se requiere token Bearer en el encabezado Authorization.'
      });
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
      req.user = decoded;
      return next();
    } catch (jwtErr: any) {
      res.status(401).json({
        success: false,
        error: 'Token inválido o expirado. Por favor, inicia sesión de nuevo.'
      });
      return;
    }
  } catch (error: any) {
    console.error('Error en verifyToken middleware:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno en la autenticación'
    });
  }
};

/**
 * Middleware para restringir rutas según Roles (RBAC)
 */
export const requireRole = (allowedRoles: (Role | string)[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'No autenticado. Debes iniciar sesión.'
      });
      return;
    }

    const userRole = String(req.user.role);

    // SUPERADMIN siempre tiene acceso total
    if (userRole === 'SUPERADMIN') {
      return next();
    }

    const hasPermission = allowedRoles.some(r => String(r) === userRole);

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        error: `Acceso Denegado (RBAC). Se requiere uno de los roles: [${allowedRoles.join(', ')}]. Tu rol actual es: ${userRole}`
      });
      return;
    }

    next();
  };
};

export const authMiddleware = verifyToken;
