import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000,
  message: { error: 'Demasiadas peticiones desde esta IP. Por favor intenta más tarde.' }
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  message: { error: 'Demasiados intentos de inicio de sesión. Por favor intenta en 15 minutos.' }
});
