"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateToken = validateToken;
const AuthService_1 = require("../services/AuthService");
function validateToken(req, res, next) {
    const authHeader = (req.headers['authorization'] || req.headers['x-api-secret']);
    if (!authHeader) {
        res.status(401).json({ error: 'No autorizado. Se requiere token.' });
        return;
    }
    // Bypass maestro para compatibilidad de herramientas administrativas
    if (AuthService_1.authService.isMasterSecret(authHeader)) {
        return next();
    }
    try {
        const cleanToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
        const decoded = AuthService_1.authService.verifyToken(cleanToken);
        req.user = decoded;
        next();
    }
    catch (e) {
        res.status(401).json({ error: 'Sesión inválida o expirada.' });
    }
}
