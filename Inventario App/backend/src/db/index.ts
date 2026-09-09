import { PrismaClient } from '@prisma/client';

declare global {
  // Previene múltiples instancias de Prisma Client en desarrollo con hot-reloading
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const basePrisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

// Alias para soportar consultas directas tipo prisma.contract.findMany() sobre WisproClient
(basePrisma as any).contract = (basePrisma as any).wisproClient;

export const prisma = basePrisma as PrismaClient & { contract: typeof basePrisma.wisproClient };

if (process.env.NODE_ENV !== 'production') {
  global.prisma = basePrisma;
}

export const db = prisma;

export default prisma;

