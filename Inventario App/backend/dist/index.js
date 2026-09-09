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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const Sentry = __importStar(require("@sentry/node"));
const api_routes_1 = __importDefault(require("./routes/api.routes"));
const error_middleware_1 = require("./middleware/error.middleware");
dotenv_1.default.config();
// Inicialización de Sentry con DSN opcional
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: 1.0,
    });
    console.log('📡 [Sentry] Observabilidad backend (Sentry) inicializada correctamente.');
}
else {
    console.log('ℹ️ [Sentry] SENTRY_DSN no configurado. Continuando sin reporte externo a Sentry.');
}
const app = (0, express_1.default)();
exports.app = app;
const PORT = process.env.PORT || 4000;
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id']
}));
app.use(express_1.default.json());
// API Routes
app.use('/api', api_routes_1.default);
// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        service: 'ISP Hub-and-Spoke Inventory API',
        wisproIntegration: 'active'
    });
});
// Middleware Global de Errores
app.use(error_middleware_1.errorMiddleware);
app.listen(PORT, () => {
    console.log(`🚀 Servidor ISP Inventory API escuchando en http://localhost:${PORT}`);
    console.log(`📦 Endpoints disponibles en http://localhost:${PORT}/api`);
});
