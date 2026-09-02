"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.authMiddleware = void 0;
const db_1 = require("../db");
const authMiddleware = (req, res, next) => {
    // Para testing ágil o simulación de sesión en el demo, permitir header 'x-user-id' o Bearer token
    const userIdHeader = req.headers['x-user-id'];
    const authHeader = req.headers['authorization'];
    let targetUserId = userIdHeader || 'usr-admin-1';
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        // En demo permitimos token con formato usr-xxx
        if (token.startsWith('usr-')) {
            targetUserId = token;
        }
    }
    const user = db_1.db.getUsers().find(u => u.id === targetUserId);
    if (!user) {
        return res.status(401).json({ error: 'Usuario no autenticado o no encontrado' });
    }
    req.user = user;
    next();
};
exports.authMiddleware = authMiddleware;
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
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
exports.requireRole = requireRole;
