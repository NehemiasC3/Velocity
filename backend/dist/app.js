"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const routes_1 = __importDefault(require("./routes"));
const rateLimitMiddleware_1 = require("./middlewares/rateLimitMiddleware");
const error_middleware_1 = require("./middlewares/error.middleware");
function createApp() {
    const app = (0, express_1.default)();
    // Habilitar trust proxy para resolver IPs reales detrás de Nginx / Cloudflare / Docker
    app.set('trust proxy', true);
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
    // Proxy local para Inventory API
    app.use('/inventory-api', async (req, res) => {
        const targetUrl = `http://127.0.0.1:4000/api${req.url}`;
        try {
            const response = await (0, axios_1.default)({
                method: req.method,
                url: targetUrl,
                headers: {
                    ...req.headers,
                    host: '127.0.0.1:4000'
                },
                data: req.body,
                validateStatus: () => true
            });
            res.status(response.status).set(response.headers).send(response.data);
        }
        catch (err) {
            res.status(502).json({ error: 'Error conectando con el servicio de inventario en el puerto 4000', details: err.message });
        }
    });
    // Servir archivos estáticos del Core y Módulo de Inventario
    const possiblePublicDirs = [
        process.env.PUBLIC_DIR,
        path_1.default.join(__dirname, '../public'),
        path_1.default.join(__dirname, '../../public'),
        '/usr/src/app/public',
        '/public'
    ].filter(Boolean);
    const publicDir = possiblePublicDirs.find(d => fs_1.default.existsSync(d)) || path_1.default.join(__dirname, '../../public');
    const inventoryDir = path_1.default.join(publicDir, 'inventory');
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
        // Soporte para Pretty URLs en archivos estáticos (/pages/supervisor -> supervisor.html)
        app.use(express_1.default.static(publicDir, { extensions: ['html', 'htm'] }));
        // Accesos directos raíz limpios (Pretty URLs)
        app.get(['/supervisor', '/supervisor/*', '/supervisor/contratos'], (_req, res) => {
            res.sendFile(path_1.default.join(publicDir, 'pages/supervisor.html'));
        });
        app.get('/login', (_req, res) => {
            res.sendFile(path_1.default.join(publicDir, 'pages/login.html'));
        });
        app.get('/technician', (_req, res) => {
            res.sendFile(path_1.default.join(publicDir, 'pages/technician.html'));
        });
    }
    // Manejador de 404
    app.use((_req, res) => {
        res.status(404).json({
            success: false,
            error: 'NotFound',
            message: 'Ruta no encontrada en el servidor'
        });
    });
    // Manejador global de errores con Sentry
    app.use(error_middleware_1.errorMiddleware);
    return app;
}
