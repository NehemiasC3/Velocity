"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = exports.requireRole = exports.verifyToken = exports.JWT_SECRET = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
exports.JWT_SECRET = process.env.JWT_SECRET || 'velocity-isp-secret-jwt-key-2026-prod';
/**
 * Middleware para validar el JWT en Authorization: Bearer <token>
 */
const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        let token;
        if (authHeader) {
            if (authHeader.startsWith('Bearer ')) {
                token = authHeader.slice(7).trim();
            }
            else {
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
