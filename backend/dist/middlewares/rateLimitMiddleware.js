"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginLimiter = exports.generalLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// Rate limiter general súper permisivo para operaciones de tiempo real y polling continuo
exports.generalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100000, // 100,000 peticiones por ventana de 15 min (evita bloqueos en dashboards 24/7)
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // No limitar peticiones de lectura GET / HEAD / OPTIONS o endpoints de salud / sync
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method))
            return true;
        if (req.path.startsWith('/health') || req.path.startsWith('/sync'))
            return true;
        return false;
    },
    message: { error: 'Demasiadas peticiones concurrentes. Por favor espere unos momentos.' }
});
// Limiter para endpoints de autenticación contra fuerza bruta
exports.loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 60, // 60 intentos cada 15 min
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos de inicio de sesión. Por favor intenta en 15 minutos.' }
});
