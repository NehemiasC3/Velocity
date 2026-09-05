import { Request, Response } from 'express';
import { prisma } from '../db';
import { ItemCategory, TrackingType, UnitOfMeasure } from '@prisma/client';

export class CatalogController {
  /**
   * Obtiene todos los productos del catálogo
   * GET /api/catalog
   */
  public static async getCatalog(req: Request, res: Response): Promise<void> {
    try {
      const { category, trackingType, search, isActive, includeInactive } = req.query;

      const where: any = {};

      if (isActive !== undefined) {
        where.isActive = isActive === 'true';
      } else if (includeInactive !== 'true') {
        // Por defecto, mostrar únicamente productos activos para que los eliminados desaparezcan de inmediato
        where.isActive = true;
      }

      if (category && typeof category === 'string') {
        where.category = category as ItemCategory;
      }

      if (trackingType && typeof trackingType === 'string') {
        where.trackingType = trackingType as TrackingType;
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

      const products = await prisma.productCatalog.findMany({
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
    } catch (error: any) {
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
  public static async getCatalogProductById(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);

      const product = await prisma.productCatalog.findFirst({
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
            take: 250,
            orderBy: { createdAt: 'desc' },
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
    } catch (error: any) {
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
  public static async createCatalogProduct(req: Request, res: Response): Promise<void> {
    try {
      const {
        sku,
        name,
        brand,
        model,
        description,
        category,
        trackingType,
        unitOfMeasure,
        minStockAlert
      } = req.body;

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
        const catPrefix: Record<ItemCategory, string> = {
          ONU_ONT: 'ONU',
          ROUTER_WIFI: 'RTR',
          TV_BOX_OTT: 'TVB',
          CAMARA_SEGURIDAD_IOT: 'CAM',
          REPETIDOR_MESH: 'MSH',
          CABLE_DROP: 'DRP',
          CONECTORIZACION: 'CON',
          HERRAJE_PLANTA_EXTERNA: 'HER',
          HERRAMIENTA_EQUIPO: 'EQP',
          MISCELANEOS: 'MISC'
        };
        const prefix = catPrefix[category as ItemCategory] || 'PRD';

        const rand = Math.floor(1000 + Math.random() * 9000);
        const namePart = name.trim().slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
        finalSku = `${prefix}-${namePart}-${rand}`;
      }

      // Verificar si el SKU ya existe
      const existingSku = await prisma.productCatalog.findUnique({
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
      let finalUnit = unitOfMeasure as UnitOfMeasure;
      if (!finalUnit) {
        if (trackingType === 'BATCHED' || category === 'CABLE_DROP') {
          finalUnit = UnitOfMeasure.METROS;
        } else {
          finalUnit = UnitOfMeasure.UNIDADES;
        }
      }

      const newProduct = await prisma.productCatalog.create({
        data: {
          sku: finalSku,
          name: name.trim(),
          brand: brand?.trim() || null,
          model: model?.trim() || null,
          description: description?.trim() || null,
          category: category as ItemCategory,
          trackingType: trackingType as TrackingType,
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
    } catch (error: any) {
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
  public static async updateCatalogProduct(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const {
        name,
        brand,
        model,
        description,
        category,
        trackingType,
        unitOfMeasure,
        minStockAlert,
        isActive
      } = req.body;

      const product = await prisma.productCatalog.findUnique({
        where: { id }
      });

      if (!product) {
        res.status(404).json({
          success: false,
          error: 'Producto no encontrado'
        });
        return;
      }

      const updated = await prisma.productCatalog.update({
        where: { id },
        data: {
          name: name !== undefined ? name.trim() : undefined,
          brand: brand !== undefined ? brand.trim() : undefined,
          model: model !== undefined ? model.trim() : undefined,
          description: description !== undefined ? description.trim() : undefined,
          category: category ? (category as ItemCategory) : undefined,
          trackingType: trackingType ? (trackingType as TrackingType) : undefined,
          unitOfMeasure: unitOfMeasure ? (unitOfMeasure as UnitOfMeasure) : undefined,
          minStockAlert: minStockAlert !== undefined ? Number(minStockAlert) : undefined,
          isActive: isActive !== undefined ? Boolean(isActive) : undefined
        }
      });

      res.status(200).json({
        success: true,
        message: 'Producto actualizado exitosamente',
        product: updated
      });
    } catch (error: any) {
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
  public static async deleteCatalogProduct(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const force = req.query.force === 'true' || req.body?.force === true;

      const product = await prisma.productCatalog.findUnique({
        where: { id },
        include: {
          bulkStocks: true,
          batchItems: true,
          serializedItems: true,
          transferItems: true
        }
      });

      if (!product) {
        res.status(404).json({
          success: false,
          error: 'Producto no encontrado en el catálogo'
        });
        return;
      }

      const activeSerializedCount = product.serializedItems.length;
      const activeBatchesCount = product.batchItems.length;
      const activeBulkQty = product.bulkStocks.reduce((sum, b) => sum + (b.quantity || 0), 0);
      const totalPhysicalStock = activeSerializedCount + activeBatchesCount + activeBulkQty;

      // Si no tiene stock físico activo o se solicita eliminación forzada
      if (force || totalPhysicalStock === 0) {
        await prisma.$transaction(async (tx) => {
          // 1. Limpiar items de transferencias
          await tx.transferOrderItem.deleteMany({
            where: { productId: id }
          });
          // 2. Limpiar registros de stock a granel
          await tx.bulkStock.deleteMany({
            where: { productId: id }
          });
          // 3. Limpiar lotes/bobinas si aplica
          await tx.batchItem.deleteMany({
            where: { productId: id }
          });
          // 4. Limpiar serializados si aplica
          await tx.serializedItem.deleteMany({
            where: { productId: id }
          });
          // 5. Eliminar el producto del catálogo
          await tx.productCatalog.delete({
            where: { id }
          });
        });

        res.status(200).json({
          success: true,
          message: `Producto "${product.name}" (${product.sku}) eliminado definitivamente del catálogo.`
        });
        return;
      }

      // Si tiene stock físico activo y no se forzó, desactivarlo para preservar trazabilidad
      const disabled = await prisma.productCatalog.update({
        where: { id },
        data: { isActive: false }
      });

      res.status(200).json({
        success: true,
        message: `El producto tiene existencias registradas (${totalPhysicalStock} ítems/unidades). Se ha retirado del catálogo activo.`,
        product: disabled
      });
    } catch (error: any) {
      console.error('Error al eliminar producto del catálogo:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno al procesar la eliminación del producto',
        details: error.message
      });
    }
  }
}
