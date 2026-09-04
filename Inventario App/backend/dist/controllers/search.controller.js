"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchController = void 0;
const db_1 = require("../db");
class SearchController {
    /**
     * Búsqueda universal inteligente (Normalización de MAC, Seriados, Catálogo, Clientes Wispro, Traslados y Auditoría)
     */
    static async universalSearch(req, res) {
        const rawQuery = String(req.query.q || '').trim();
        const categoryFilter = String(req.query.category || 'ALL').toUpperCase();
        if (!rawQuery || rawQuery.length < 2) {
            res.json({
                query: rawQuery,
                totalResults: 0,
                serialized: [],
                bulk: [],
                clients: [],
                transfers: [],
                audit: []
            });
            return;
        }
        // Normalización de MAC y cadenas alfanuméricas
        const cleanMac = rawQuery.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
        const formattedMacColons = cleanMac.length >= 4
            ? cleanMac.match(/.{1,2}/g)?.join(':') || rawQuery
            : rawQuery;
        const formattedMacDashes = cleanMac.length >= 4
            ? cleanMac.match(/.{1,2}/g)?.join('-') || rawQuery
            : rawQuery;
        try {
            const results = {
                serialized: [],
                bulk: [],
                clients: [],
                transfers: [],
                audit: []
            };
            // 1. Equipos Seriados (ONUs, Routers, Switches)
            if (categoryFilter === 'ALL' || categoryFilter === 'SERIALIZED') {
                results.serialized = await db_1.prisma.serializedItem.findMany({
                    where: {
                        OR: [
                            { macAddress: { contains: rawQuery, mode: 'insensitive' } },
                            { macAddress: { contains: cleanMac, mode: 'insensitive' } },
                            { macAddress: { contains: formattedMacColons, mode: 'insensitive' } },
                            { macAddress: { contains: formattedMacDashes, mode: 'insensitive' } },
                            { serialNumber: { contains: rawQuery, mode: 'insensitive' } },
                            { installedClientName: { contains: rawQuery, mode: 'insensitive' } },
                            { installedContractId: { contains: rawQuery, mode: 'insensitive' } },
                            {
                                product: {
                                    OR: [
                                        { name: { contains: rawQuery, mode: 'insensitive' } },
                                        { brand: { contains: rawQuery, mode: 'insensitive' } },
                                        { model: { contains: rawQuery, mode: 'insensitive' } },
                                        { sku: { contains: rawQuery, mode: 'insensitive' } }
                                    ]
                                }
                            }
                        ]
                    },
                    take: 10,
                    include: {
                        product: true,
                        currentWarehouse: true
                    }
                });
            }
            // 2. Materiales a Granel y Catálogo (Bobinas, Conectores, Herrajes)
            if (categoryFilter === 'ALL' || categoryFilter === 'BULK') {
                results.bulk = await db_1.prisma.bulkStock.findMany({
                    where: {
                        OR: [
                            {
                                product: {
                                    OR: [
                                        { name: { contains: rawQuery, mode: 'insensitive' } },
                                        { sku: { contains: rawQuery, mode: 'insensitive' } },
                                        { brand: { contains: rawQuery, mode: 'insensitive' } },
                                        { model: { contains: rawQuery, mode: 'insensitive' } }
                                    ]
                                }
                            },
                            {
                                warehouse: {
                                    name: { contains: rawQuery, mode: 'insensitive' }
                                }
                            }
                        ]
                    },
                    take: 8,
                    include: {
                        product: true,
                        warehouse: true
                    }
                });
            }
            // 3. Clientes y Contratos Wispro
            if (categoryFilter === 'ALL' || categoryFilter === 'CLIENTS') {
                results.clients = await db_1.prisma.wisproClient.findMany({
                    where: {
                        OR: [
                            { name: { contains: rawQuery, mode: 'insensitive' } },
                            { contractId: { contains: rawQuery, mode: 'insensitive' } },
                            { address: { contains: rawQuery, mode: 'insensitive' } },
                            { identification: { contains: rawQuery, mode: 'insensitive' } },
                            { currentOnuMac: { contains: rawQuery, mode: 'insensitive' } },
                            { currentOnuMac: { contains: cleanMac, mode: 'insensitive' } },
                            { nodeName: { contains: rawQuery, mode: 'insensitive' } }
                        ]
                    },
                    take: 8
                });
            }
            // 4. Órdenes de Traslado y Remisiones
            if (categoryFilter === 'ALL' || categoryFilter === 'TRANSFERS') {
                results.transfers = await db_1.prisma.transferOrder.findMany({
                    where: {
                        OR: [
                            { orderNumber: { contains: rawQuery, mode: 'insensitive' } },
                            { notes: { contains: rawQuery, mode: 'insensitive' } },
                            {
                                sourceWarehouse: {
                                    name: { contains: rawQuery, mode: 'insensitive' }
                                }
                            },
                            {
                                destinationWarehouse: {
                                    name: { contains: rawQuery, mode: 'insensitive' }
                                }
                            }
                        ]
                    },
                    take: 6,
                    include: {
                        sourceWarehouse: true,
                        destinationWarehouse: true,
                        createdByUser: true
                    }
                });
            }
            // 5. Auditoría Forense y Trazabilidad
            if (categoryFilter === 'ALL' || categoryFilter === 'AUDIT') {
                results.audit = await db_1.prisma.auditLog.findMany({
                    where: {
                        OR: [
                            { macAddress: { contains: rawQuery, mode: 'insensitive' } },
                            { macAddress: { contains: cleanMac, mode: 'insensitive' } },
                            { serialNumber: { contains: rawQuery, mode: 'insensitive' } },
                            { batchNumber: { contains: rawQuery, mode: 'insensitive' } },
                            { details: { contains: rawQuery, mode: 'insensitive' } }
                        ]
                    },
                    take: 6,
                    orderBy: { timestamp: 'desc' },
                    include: {
                        user: true,
                        fromWarehouse: true,
                        toWarehouse: true
                    }
                });
            }
            const totalResults = results.serialized.length +
                results.bulk.length +
                results.clients.length +
                results.transfers.length +
                results.audit.length;
            res.json({
                query: rawQuery,
                cleanMac,
                totalResults,
                ...results
            });
        }
        catch (error) {
            console.error('[SearchController ❌] Error en búsqueda universal:', error);
            res.status(500).json({
                error: 'Search Error',
                message: error.message
            });
        }
    }
}
exports.SearchController = SearchController;
