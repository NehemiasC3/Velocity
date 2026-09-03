"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogController = void 0;
const db_1 = require("../db");
const client_1 = require("@prisma/client");
class CatalogController {
    /**
     * Obtiene todos los productos del catálogo
     * GET /api/catalog
     */
    static async getCatalog(req, res) {
        try {
            const { category, trackingType, search, isActive } = req.query;
            const where = {};
            if (isActive !== undefined) {
                where.isActive = isActive === 'true';
            }
            if (category && typeof category === 'string') {
                where.category = category;
            }
            if (trackingType && typeof trackingType === 'string') {
                where.trackingType = trackingType;
            }
            if (search && typeof search === 'string') {
                const q = search.trim();
                where.OR = [
                    { name: { contains: q, mode: 'insensitive' } },
                    { sku: { contains: q, mode: 'insensitive' } },
                    { brand: { contains: q, mode: 'insensitive' } },
                    { model: { contains: q, mode: 'insensitive' } }
                ];
            }
            const products = await db_1.prisma.productCatalog.findMany({
                where,
                include: {
                    _count: {
                        select: {
                            serializedItems: true,
                            batchItems: true,
                            bulkStocks: true
                        }
                    }
                },
                orderBy: [
                    { category: 'asc' },
                    { name: 'asc' }
                ]
            });
            res.status(200).json({
                success: true,
                count: products.length,
                products
            });
        }
        catch (error) {
            console.error('Error al obtener catálogo:', error);
            res.status(500).json({
                success: false,
                error: 'Error interno al consultar el catálogo de productos',
                details: error.message
            });
        }
    }
    /**
     * Obtiene un producto específico del catálogo por ID o SKU
     * GET /api/catalog/:id
     */
    static async getCatalogProductById(req, res) {
        try {
            const id = String(req.params.id);
            const product = await db_1.prisma.productCatalog.findFirst({
                where: {
                    OR: [
                        { id },
                        { sku: id }
                    ]
                },
                include: {
                    bulkStocks: {
                        include: { warehouse: true }
                    },
                    batchItems: {
                        include: { currentWarehouse: true }
                    },
                    serializedItems: {
                        take: 50,
                        include: { currentWarehouse: true }
                    },
                    _count: {
                        select: {
                            serializedItems: true,
                            batchItems: true,
                            bulkStocks: true
                        }
                    }
                }
            });
            if (!product) {
                res.status(404).json({
                    success: false,
                    error: 'Producto no encontrado en el catálogo'
                });
                return;
            }
            res.status(200).json({
                success: true,
                product
            });
        }
        catch (error) {
            console.error('Error al obtener producto:', error);
            res.status(500).json({
                success: false,
                error: 'Error interno al consultar el producto',
                details: error.message
            });
        }
    }
    /**
     * Registra un nuevo producto en el catálogo central
     * POST /api/catalog
     */
    static async createCatalogProduct(req, res) {
        try {
            const { sku, name, brand, model, description, category, trackingType, unitOfMeasure, minStockAlert } = req.body;
            if (!name || !name.trim()) {
                res.status(400).json({
                    success: false,
                    error: 'El nombre del producto es obligatorio'
                });
                return;
            }
            if (!category) {
                res.status(400).json({
                    success: false,
                    error: 'La categoría es obligatoria (ONU_ONT, ROUTER_WIFI, CABLE_DROP, CONECTORIZACION, HERRAJE_PLANTA_EXTERNA, HERRAMIENTA_EQUIPO, MISCELANEOS)'
                });
                return;
            }
            if (!trackingType) {
                res.status(400).json({
                    success: false,
                    error: 'El tipo de seguimiento (trackingType) es obligatorio (SERIALIZED, BATCHED, BULK)'
                });
                return;
            }
            // Generar SKU único si no se suministra
            let finalSku = sku?.trim()?.toUpperCase();
            if (!finalSku) {
                const catPrefix = {
                    ONU_ONT: 'ONU',
                    ROUTER_WIFI: 'RTR',
                    CABLE_DROP: 'DRP',
                    CONECTORIZACION: 'CON',
                    HERRAJE_PLANTA_EXTERNA: 'HER',
                    HERRAMIENTA_EQUIPO: 'EQP',
                    MISCELANEOS: 'MISC'
                }[category] || 'PRD';
                const rand = Math.floor(1000 + Math.random() * 9000);
                const namePart = name.trim().slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
                finalSku = `${catPrefix}-${namePart}-${rand}`;
            }
            // Verificar si el SKU ya existe
            const existingSku = await db_1.prisma.productCatalog.findUnique({
                where: { sku: finalSku }
            });
            if (existingSku) {
                res.status(409).json({
                    success: false,
                    error: `Ya existe un producto registrado con el SKU: ${finalSku}`
                });
                return;
            }
            // Asignar unidad de medida predeterminada según naturaleza si no se especifica
            let finalUnit = unitOfMeasure;
            if (!finalUnit) {
                if (trackingType === 'BATCHED' || category === 'CABLE_DROP') {
                    finalUnit = client_1.UnitOfMeasure.METROS;
                }
                else {
                    finalUnit = client_1.UnitOfMeasure.UNIDADES;
                }
            }
            const newProduct = await db_1.prisma.productCatalog.create({
                data: {
                    sku: finalSku,
                    name: name.trim(),
                    brand: brand?.trim() || null,
                    model: model?.trim() || null,
                    description: description?.trim() || null,
                    category: category,
                    trackingType: trackingType,
                    unitOfMeasure: finalUnit,
                    minStockAlert: minStockAlert !== undefined ? Number(minStockAlert) : 10,
                    isActive: true
                }
            });
            res.status(201).json({
                success: true,
                message: 'Producto registrado exitosamente en el catálogo',
                product: newProduct
            });
        }
        catch (error) {
            console.error('Error al crear producto en catálogo:', error);
            res.status(500).json({
                success: false,
                error: 'Error interno al registrar el producto',
                details: error.message
            });
        }
    }
    /**
     * Actualiza un producto existente en el catálogo
     * PUT /api/catalog/:id
     */
    static async updateCatalogProduct(req, res) {
        try {
            const id = String(req.params.id);
            const { name, brand, model, description, category, trackingType, unitOfMeasure, minStockAlert, isActive } = req.body;
            const product = await db_1.prisma.productCatalog.findUnique({
                where: { id }
            });
            if (!product) {
                res.status(404).json({
                    success: false,
                    error: 'Producto no encontrado'
                });
                return;
            }
            const updated = await db_1.prisma.productCatalog.update({
                where: { id },
                data: {
                    name: name !== undefined ? name.trim() : undefined,
                    brand: brand !== undefined ? brand.trim() : undefined,
                    model: model !== undefined ? model.trim() : undefined,
                    description: description !== undefined ? description.trim() : undefined,
                    category: category ? category : undefined,
                    trackingType: trackingType ? trackingType : undefined,
                    unitOfMeasure: unitOfMeasure ? unitOfMeasure : undefined,
                    minStockAlert: minStockAlert !== undefined ? Number(minStockAlert) : undefined,
                    isActive: isActive !== undefined ? Boolean(isActive) : undefined
                }
            });
            res.status(200).json({
                success: true,
                message: 'Producto actualizado exitosamente',
                product: updated
            });
        }
        catch (error) {
            console.error('Error al actualizar producto:', error);
            res.status(500).json({
                success: false,
                error: 'Error interno al actualizar el producto',
                details: error.message
            });
        }
    }
    /**
     * Elimina o desactiva un producto del catálogo
     * DELETE /api/catalog/:id
     */
    static async deleteCatalogProduct(req, res) {
        try {
            const id = String(req.params.id);
            const product = await db_1.prisma.productCatalog.findUnique({
                where: { id },
                include: {
                    _count: {
                        select: {
                            serializedItems: true,
                            batchItems: true,
                            bulkStocks: true
                        }
                    }
                }
            });
            if (!product) {
                res.status(404).json({
                    success: false,
                    error: 'Producto no encontrado'
                });
                return;
            }
            const totalItems = (product._count?.serializedItems || 0) +
                (product._count?.batchItems || 0) +
                (product._count?.bulkStocks || 0);
            if (totalItems > 0) {
                // Desactivación lógica (Soft delete) si tiene registros asociados
                const disabled = await db_1.prisma.productCatalog.update({
                    where: { id },
                    data: { isActive: false }
                });
                res.status(200).json({
                    success: true,
                    message: `El producto tiene ${totalItems} registro(s) de stock asociados. Se ha desactivado del catálogo para preservar la integridad histórica.`,
                    product: disabled
                });
                return;
            }
            // Eliminación física si no tiene ningún stock vinculado
            await db_1.prisma.productCatalog.delete({
                where: { id }
            });
            res.status(200).json({
                success: true,
                message: 'Producto eliminado definitivamente del catálogo'
            });
        }
        catch (error) {
            console.error('Error al eliminar producto del catálogo:', error);
            res.status(500).json({
                success: false,
                error: 'Error interno al eliminar el producto',
                details: error.message
            });
        }
    }
}
exports.CatalogController = CatalogController;
