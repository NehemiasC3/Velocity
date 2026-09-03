import { PrismaClient } from '@prisma/client';

declare global {
  // Previene múltiples instancias de Prisma Client en desarrollo con hot-reloading
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export const db = prisma;

export default prisma;

