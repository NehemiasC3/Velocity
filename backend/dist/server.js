"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Cargar variables de entorno
dotenv_1.default.config();
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const app_1 = require("./app");
const DbService_1 = require("./services/DbService");
const WisproService_1 = require("./services/WisproService");
const PORT = Number(process.env.PORT) || 3000;
const app = (0, app_1.createApp)();
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`🚀 Velocity Backend API activo en puerto: ${PORT}`);
    console.log(`📡 Health: http://localhost:${PORT}/health`);
    console.log(`📦 Inventario: http://localhost:${PORT}/api/v1/inventory`);
    console.log(`🔒 Sincronización: http://localhost:${PORT}/api/sync`);
    console.log(`====================================================`);
    // Intentar sincronización inicial con Google Drive si está configurado
    DbService_1.dbService.syncFromGoogleDrive();
    // Precalentar caché de inventario en memoria RAM
    WisproService_1.wisproService.warmUp();
});
// Manejo de apagado graceful
const handleShutdown = (signal) => {
    console.log(`Recibida señal ${signal}, cerrando servidor HTTP...`);
    server.close(() => {
        console.log('Servidor finalizado con éxito.');
        process.exit(0);
    });
};
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
