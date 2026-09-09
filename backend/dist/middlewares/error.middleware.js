"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = void 0;
const Sentry = __importStar(require("@sentry/node"));
/**
 * Middleware Global de Errores para Velocity Backend.
 * Captura excepciones 500 y fallos de base de datos / Prisma (si aplica).
 * Reporta automáticamente a Sentry cuando process.env.SENTRY_DSN está presente.
 */
const errorMiddleware = (err, req, res, _next) => {
    const isPrismaError = err?.name === 'PrismaClientKnownRequestError' ||
        err?.constructor?.name === 'PrismaClientKnownRequestError' ||
        (typeof err?.code === 'string' && err.code.startsWith('P'));
    const statusCode = err.status || err.statusCode || (isPrismaError ? 400 : 500);
    console.error('[Global Error Middleware]', {
        message: err.message,
        name: err.name,
        code: err.code,
        statusCode,
        path: req.originalUrl,
        method: req.method,
        stack: err.stack,
    });
    if (process.env.SENTRY_DSN && (statusCode >= 500 || isPrismaError)) {
        try {
            Sentry.withScope((scope) => {
                scope.setExtra('path', req.originalUrl);
                scope.setExtra('method', req.method);
                scope.setExtra('query', req.query);
                if (req.body) {
                    scope.setExtra('body', req.body);
                }
                if (isPrismaError) {
                    scope.setTag('error_type', 'PrismaClientKnownRequestError');
                    scope.setExtra('prisma_code', err.code);
                    scope.setExtra('prisma_meta', err.meta);
                }
                Sentry.captureException(err);
            });
        }
        catch (sentryErr) {
            console.error('[Sentry Error] Error al reportar a Sentry:', sentryErr);
        }
    }
    if (res.headersSent) {
        return;
    }
    if (isPrismaError) {
        res.status(statusCode).json({
            success: false,
            error: 'DatabaseError',
            code: err.code,
            message: 'Ocurrió un error en la base de datos',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined,
        });
        return;
    }
    res.status(statusCode).json({
        success: false,
        error: err.name || 'InternalServerError',
        message: statusCode >= 500 ? 'Error interno en el servidor' : err.message,
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
};
exports.errorMiddleware = errorMiddleware;
exports.default = exports.errorMiddleware;
