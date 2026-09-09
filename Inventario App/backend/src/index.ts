import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';
import apiRoutes from './routes/api.routes';
import { errorMiddleware } from './middleware/error.middleware';

dotenv.config();

// Inicialización de Sentry con DSN opcional
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

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id']
}));

app.use(express.json());

// API Routes
app.use('/api', apiRoutes);

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
app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`🚀 Servidor ISP Inventory API escuchando en http://localhost:${PORT}`);
  console.log(`📦 Endpoints disponibles en http://localhost:${PORT}/api`);
});

export { app };

