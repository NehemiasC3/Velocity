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
    const userIdHeader = req.headers['x-user-id'] as string;

    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // 1. Si viene token JWT real
    if (token && !token.startsWith('usr-') && token !== 'dev-token') {
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
    }

    // 2. Fallback de desarrollo: Buscar usuario por ID (x-user-id o dev-token)
    const targetUserId = (token && token.startsWith('usr-')) 
      ? token 
      : (userIdHeader || 'usr-admin-1');

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: targetUserId },
          { email: targetUserId }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        baseWarehouseId: true
      }
    });

    if (user) {
      req.user = {
        ...user,
        assignedWarehouseId: user.baseWarehouseId
      };
      return next();
    }

    // Si no encontramos usuario en Prisma pero hay ID de desarrollo
    req.user = {
      id: targetUserId,
      name: 'Admin Supervisor',
      email: 'admin@rappidopanama.com',
      role: Role.SUPERADMIN,
      baseWarehouseId: null,
      assignedWarehouseId: null
    };

    return next();
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
