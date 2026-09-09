import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import * as Sentry from '@sentry/node';

// Inicialización de Sentry con SENTRY_DSN opcional
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 1.0,
  });
  console.log('📡 [Sentry] Observabilidad backend (Sentry) inicializada correctamente.');
} else {
  console.log('ℹ️ [Sentry] SENTRY_DSN no configurado. Continuando sin reporte externo a Sentry.');
}

import { createApp } from './app';
import { dbService } from './services/DbService';
import { wisproService } from './services/WisproService';

const PORT = Number(process.env.PORT) || 3000;
const app = createApp();

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🚀 Velocity Backend API activo en puerto: ${PORT}`);
  console.log(`📡 Health: http://localhost:${PORT}/health`);
  console.log(`📦 Inventario: http://localhost:${PORT}/api/v1/inventory`);
  console.log(`🔒 Sincronización: http://localhost:${PORT}/api/sync`);
  console.log(`====================================================`);

  // Intentar sincronización inicial con Google Drive si está configurado
  dbService.syncFromGoogleDrive();

  // Precalentar caché de inventario en memoria RAM
  wisproService.warmUp();
});

// Manejo de apagado graceful
const handleShutdown = (signal: string) => {
  console.log(`Recibida señal ${signal}, cerrando servidor HTTP...`);
  server.close(() => {
    console.log('Servidor finalizado con éxito.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
