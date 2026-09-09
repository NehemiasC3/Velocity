import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import { Prisma } from '@prisma/client';

/**
 * Middleware Global de Errores para Express con integración a Sentry y Prisma.
 * Captura excepciones 500 y fallos de Prisma (PrismaClientKnownRequestError).
 * Si no hay SENTRY_DSN configurado, funciona normalmente haciendo log en consola.
 */
export const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const isPrismaError =
    err instanceof Prisma.PrismaClientKnownRequestError ||
    err?.name === 'PrismaClientKnownRequestError';
  const statusCode = err.status || err.statusCode || (isPrismaError ? 400 : 500);

  // Log en consola para observabilidad local
  console.error('[Global Error Middleware]', {
    message: err.message,
    name: err.name,
    code: err.code,
    statusCode,
    path: req.originalUrl,
    method: req.method,
    stack: err.stack,
  });

  // Reportar a Sentry si hay DSN configurado y es error 500 o fallo de Prisma
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
    } catch (sentryErr) {
      console.error('[Sentry Error] Error al reportar a Sentry:', sentryErr);
    }
  }

  // Respuesta al cliente
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

export default errorMiddleware;
