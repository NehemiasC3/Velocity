import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import apiRouter from './routes';
import { generalLimiter } from './middlewares/rateLimitMiddleware';

export function createApp(): Application {
  const app: Application = express();

  app.set('trust proxy', 1);

  // 1. Compresión HTTP Gzip / Deflate (Reduce el payload en un 85-92%)
  app.use(
    compression({
      level: 6,
      threshold: 1024, // Comprimir respuestas mayores a 1KB
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      }
    })
  );

  // 2. Seguridad con Helmet
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    })
  );

  // 3. Rate limiter general
  app.use('/api/', generalLimiter);

  // 4. CORS Middleware
  app.use(
    cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-api-secret', 'If-None-Match']
    })
  );

  // 5. Parsing JSON & URL Encoded
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health Check Endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'healthy',
      service: 'velocity-backend-api',
      version: '2.2.0',
      timestamp: new Date().toISOString()
    });
  });

  // Master API Router
  app.use('/api', apiRouter);

  // Manejador de 404
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'NotFound',
      message: 'Ruta no encontrada en el servidor'
    });
  });

  // Manejador global de errores
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Global App Error]', err);
    res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: err.message || 'Error interno en el servidor'
    });
  });

  return app;
}
