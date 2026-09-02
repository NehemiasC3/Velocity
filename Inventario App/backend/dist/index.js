"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const api_routes_1 = __importDefault(require("./routes/api.routes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
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
app.listen(PORT, () => {
    console.log(`🚀 Servidor ISP Inventory API escuchando en http://localhost:${PORT}`);
    console.log(`📦 Endpoints disponibles en http://localhost:${PORT}/api`);
});
