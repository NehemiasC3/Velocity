import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';

/**
 * Middleware Global de Errores para Velocity Backend.
 * Captura excepciones 500 y fallos de base de datos / Prisma (si aplica).
 * Reporta automáticamente a Sentry cuando process.env.SENTRY_DSN está presente.
 */
export const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const isPrismaError =
    err?.name === 'PrismaClientKnownRequestError' ||
    err?.constructor?.name === 'PrismaClientKnownRequestError' ||
    (typeof err?.code === 'string' && err.code.startsWith('P'));
  const statusCode = err.status || err.statusCode || (isPrismaError ? 400 : 500);

  console.error('[Global Error Middleware]', {
    message: err.message,
    name: err.name,
    code: err.code,
    statusCode,
    path: req.originalUrl,
    method: req.method,
    stack: err.stack,
  });

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
