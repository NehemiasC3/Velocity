"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.prisma = void 0;
const client_1 = require("@prisma/client");
const basePrisma = global.prisma ||
    new client_1.PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
// Alias para soportar consultas directas tipo prisma.contract.findMany() sobre WisproClient
basePrisma.contract = basePrisma.wisproClient;
exports.prisma = basePrisma;
if (process.env.NODE_ENV !== 'production') {
    global.prisma = basePrisma;
}
exports.db = exports.prisma;
exports.default = exports.prisma;
