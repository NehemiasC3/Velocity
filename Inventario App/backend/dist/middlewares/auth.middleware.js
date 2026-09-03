"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = exports.requireRole = exports.verifyToken = exports.JWT_SECRET = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../db");
const client_1 = require("@prisma/client");
exports.JWT_SECRET = process.env.JWT_SECRET || 'velocity-isp-secret-jwt-key-2026-prod';
/**
 * Middleware para validar el JWT en Authorization: Bearer <token>
 */
const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const userIdHeader = req.headers['x-user-id'];
        let token;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
        // 1. Si viene token JWT real
        if (token && !token.startsWith('usr-') && token !== 'dev-token') {
            try {
                const decoded = jsonwebtoken_1.default.verify(token, exports.JWT_SECRET);
                req.user = decoded;
                return next();
            }
            catch (jwtErr) {
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
        const user = await db_1.prisma.user.findFirst({
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
            role: client_1.Role.SUPERADMIN,
            baseWarehouseId: null,
            assignedWarehouseId: null
        };
        return next();
    }
    catch (error) {
        console.error('Error en verifyToken middleware:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno en la autenticación'
        });
    }
};
exports.verifyToken = verifyToken;
/**
 * Middleware para restringir rutas según Roles (RBAC)
 */
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
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
exports.requireRole = requireRole;
exports.authMiddleware = exports.verifyToken;
