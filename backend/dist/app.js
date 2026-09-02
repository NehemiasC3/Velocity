"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const routes_1 = __importDefault(require("./routes"));
const rateLimitMiddleware_1 = require("./middlewares/rateLimitMiddleware");
function createApp() {
    const app = (0, express_1.default)();
    app.set('trust proxy', 1);
    // 1. Compresión HTTP Gzip / Deflate (Reduce el payload en un 85-92%)
    app.use((0, compression_1.default)({
        level: 6,
        threshold: 1024, // Comprimir respuestas mayores a 1KB
        filter: (req, res) => {
            if (req.headers['x-no-compression']) {
                return false;
            }
            return compression_1.default.filter(req, res);
        }
    }));
    // 2. Seguridad con Helmet
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false
    }));
    // 3. Rate limiter general
    app.use('/api/', rateLimitMiddleware_1.generalLimiter);
    // 4. CORS Middleware
    app.use((0, cors_1.default)({
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-api-secret', 'If-None-Match']
    }));
    // 5. Parsing JSON & URL Encoded
    app.use(express_1.default.json({ limit: '10mb' }));
    app.use(express_1.default.urlencoded({ extended: true }));
    // Health Check Endpoint
    app.get('/health', (_req, res) => {
        res.status(200).json({
            status: 'healthy',
            service: 'velocity-backend-api',
            version: '2.2.0',
            timestamp: new Date().toISOString()
        });
    });
    // Master API Router
    app.use('/api', routes_1.default);
    // Servir archivos estáticos del Core y Módulo de Inventario
    const publicDir = path_1.default.join(__dirname, '../../public');
    const inventoryDir = path_1.default.join(__dirname, '../../public/inventory');
    const inventoryAltDir = path_1.default.join(__dirname, '../../Inventario App/frontend/dist');
    if (fs_1.default.existsSync(inventoryDir)) {
        app.use('/inventory', express_1.default.static(inventoryDir));
        app.use('/inventario', express_1.default.static(inventoryDir));
    }
    else if (fs_1.default.existsSync(inventoryAltDir)) {
        app.use('/inventory', express_1.default.static(inventoryAltDir));
        app.use('/inventario', express_1.default.static(inventoryAltDir));
    }
    if (fs_1.default.existsSync(publicDir)) {
        app.use(express_1.default.static(publicDir));
    }
    // Manejador de 404
    app.use((_req, res) => {
        res.status(404).json({
            success: false,
            error: 'NotFound',
            message: 'Ruta no encontrada en el servidor'
        });
    });
    // Manejador global de errores
    app.use((err, _req, res, _next) => {
        console.error('[Global App Error]', err);
        res.status(500).json({
            success: false,
            error: 'InternalServerError',
            message: err.message || 'Error interno en el servidor'
        });
    });
    return app;
}
