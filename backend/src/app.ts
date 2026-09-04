import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import fs from 'fs';
import path from 'path';
import apiRouter from './routes';
import { generalLimiter } from './middlewares/rateLimitMiddleware';

export function createApp(): Application {
  const app: Application = express();

  // Habilitar trust proxy para resolver IPs reales detrás de Nginx / Cloudflare / Docker
  app.set('trust proxy', true);


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

  // Servir archivos estáticos del Core y Módulo de Inventario
  const possiblePublicDirs = [
    process.env.PUBLIC_DIR,
    path.join(__dirname, '../public'),
    path.join(__dirname, '../../public'),
    '/usr/src/app/public',
    '/public'
  ].filter(Boolean) as string[];

  const publicDir = possiblePublicDirs.find(d => fs.existsSync(d)) || path.join(__dirname, '../../public');
  const inventoryDir = path.join(publicDir, 'inventory');
  const inventoryAltDir = path.join(__dirname, '../../Inventario App/frontend/dist');

  if (fs.existsSync(inventoryDir)) {
    app.use('/inventory', express.static(inventoryDir));
    app.use('/inventario', express.static(inventoryDir));
  } else if (fs.existsSync(inventoryAltDir)) {
    app.use('/inventory', express.static(inventoryAltDir));
    app.use('/inventario', express.static(inventoryAltDir));
  }

  if (fs.existsSync(publicDir)) {
    // Soporte para Pretty URLs en archivos estáticos (/pages/supervisor -> supervisor.html)
    app.use(express.static(publicDir, { extensions: ['html', 'htm'] }));

    // Accesos directos raíz limpios (Pretty URLs)
    app.get('/supervisor', (_req: Request, res: Response) => {
      res.sendFile(path.join(publicDir, 'pages/supervisor.html'));
    });
    app.get('/login', (_req: Request, res: Response) => {
      res.sendFile(path.join(publicDir, 'pages/login.html'));
    });
    app.get('/technician', (_req: Request, res: Response) => {
      res.sendFile(path.join(publicDir, 'pages/technician.html'));
    });
  }

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
