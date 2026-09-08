import { Request, Response } from 'express';
import { prisma } from '../db';
import { TrackingType, BatchStatus, SerializedStatus, AuditEventType } from '@prisma/client';

export class InventoryController {
  /**
   * Endpoint transaccional para dar de alta stock físico (Inbound Inventory)
   * POST /api/inventory/inbound
   */
  public static async inboundInventory(req: Request, res: Response): Promise<void> {
    try {
      const {
        warehouseId,
        productId,
        trackingType: requestedTrackingType,
        quantity,
        batchNumber,
        initialQuantity,
        batches,
        items,
        notes
      } = req.body;

      if (!warehouseId) {
        res.status(400).json({
          success: false,
          error: 'La bodega de destino (warehouseId) es obligatoria'
        });
        return;
      }

      if (!productId) {
        res.status(400).json({
          success: false,
          error: 'El producto del catálogo (productId) es obligatorio'
        });
        return;
      }

      // Validar que la bodega exista
      const warehouse = await prisma.warehouse.findUnique({
        where: { id: warehouseId }
      });

      if (!warehouse) {
        res.status(404).json({
          success: false,
          error: `Bodega destino no encontrada (ID: ${warehouseId})`
        });
        return;
      }

      // Validar que el producto exista en el Catálogo
      const product = await prisma.productCatalog.findUnique({
        where: { id: productId }
      });

      if (!product) {
        res.status(404).json({
          success: false,
          error: `Producto no encontrado en el catálogo (ID: ${productId})`
        });
        return;
      }

      const activeTrackingType = product.trackingType || requestedTrackingType;

      // Obtener o asignar usuario para auditoría (o usuario default si no está autenticado)
      const activeUserId = (req as any).user?.id || (req.headers['x-user-id'] as string) || null;
      let systemUser: any = null;
      if (activeUserId) {
        systemUser = await prisma.user.findUnique({ where: { id: activeUserId } });
      }
      if (!systemUser) {
        systemUser = await prisma.user.findFirst();
      }

      // ─────────────────────────────────────────────────────────────
      // CASO 1: BULK (Control Granel / Unidades)
      // ─────────────────────────────────────────────────────────────
      if (activeTrackingType === TrackingType.BULK) {
        const qty = Number(quantity);
        if (isNaN(qty) || qty <= 0) {
          res.status(400).json({
            success: false,
            error: 'Para artículos a granel se debe especificar una cantidad numérica mayor a cero'
          });
          return;
        }

        const result = await prisma.$transaction(async (tx) => {
          // Upsert en BulkStock
          const bulkStock = await tx.bulkStock.upsert({
            where: {
              productId_warehouseId: {
                productId,
                warehouseId
              }
            },
            create: {
              productId,
              warehouseId,
              quantity: qty
            },
            update: {
              quantity: { increment: qty }
            }
          });

          // Registro en Auditoría Forense
          if (systemUser) {
            await tx.auditLog.create({
              data: {
                eventType: AuditEventType.ALTA_INVENTARIO,
                toWarehouseId: warehouseId,
                userId: systemUser.id,
                details: `Ingreso a Granel: +${qty} ${product.unitOfMeasure} de "${product.name}" (${product.sku}) en bodega ${warehouse.name}. Stock total: ${bulkStock.quantity}. ${notes ? `Nota: ${notes}` : ''}`
              }
            });
          }

          return bulkStock;
        });

        res.status(201).json({
          success: true,
          message: `Se ingresaron exitosamente ${qty} ${product.unitOfMeasure} de "${product.name}" a ${warehouse.name}`,
          type: 'BULK',
          bulkStock: result
        });
        return;
      }

      // ─────────────────────────────────────────────────────────────
      // CASO 2: BATCHED (Control por Lotes / Bobinas de Cable)
      // ─────────────────────────────────────────────────────────────
      if (activeTrackingType === TrackingType.BATCHED) {
        // Soporte tanto para una sola bobina como para una lista de bobinas
        const batchList: { batchNumber: string; initialQuantity: number; notes?: string }[] = [];

        if (Array.isArray(batches) && batches.length > 0) {
          for (const b of batches) {
            if (b.batchNumber && Number(b.initialQuantity) > 0) {
              batchList.push({
                batchNumber: String(b.batchNumber).trim().toUpperCase(),
                initialQuantity: Number(b.initialQuantity),
                notes: b.notes?.trim() || notes || undefined
              });
            }
          }
        } else if (batchNumber && Number(initialQuantity) > 0) {
          batchList.push({
            batchNumber: String(batchNumber).trim().toUpperCase(),
            initialQuantity: Number(initialQuantity),
            notes: notes?.trim() || undefined
          });
        }

        if (batchList.length === 0) {
          res.status(400).json({
            success: false,
            error: 'Debe ingresar al menos un número de lote/bobina válido con su metraje o cantidad inicial mayor a cero'
          });
          return;
        }

        // Validar si algún lote ya existe para este producto
        const batchNumbers = batchList.map(b => b.batchNumber);
        const existingBatches = await prisma.batchItem.findMany({
          where: {
            productId,
            batchNumber: { in: batchNumbers }
          }
        });

        if (existingBatches.length > 0) {
          const dups = existingBatches.map(b => b.batchNumber).join(', ');
          res.status(409).json({
            success: false,
            error: `Los siguientes números de lote/bobina ya se encuentran registrados para este producto: ${dups}`
          });
          return;
        }

        const resultBatches = await prisma.$transaction(async (tx) => {
          const createdList: any[] = [];

          for (const b of batchList) {
            const batch = await tx.batchItem.create({
              data: {
                productId,
                currentWarehouseId: warehouseId,
                batchNumber: b.batchNumber,
                initialQuantity: b.initialQuantity,
                currentQuantity: b.initialQuantity,
                unitOfMeasure: product.unitOfMeasure,
                status: BatchStatus.DISPONIBLE,
                notes: b.notes || null
              }
            });

            if (systemUser) {
              await tx.auditLog.create({
                data: {
                  eventType: AuditEventType.ALTA_INVENTARIO,
                  batchNumber: b.batchNumber,
                  toWarehouseId: warehouseId,
                  userId: systemUser.id,
                  details: `Ingreso de Bobina/Lote: ${b.batchNumber} (${b.initialQuantity} ${product.unitOfMeasure}) de "${product.name}" en bodega ${warehouse.name}`
                }
              });
            }

            createdList.push(batch);
          }

          return createdList;
        });

        res.status(201).json({
          success: true,
          message: `Se ingresaron ${resultBatches.length} bobina(s)/lote(s) de "${product.name}" en ${warehouse.name}`,
          type: 'BATCHED',
          batches: resultBatches
        });
        return;
      }

      // ─────────────────────────────────────────────────────────────
      // CASO 3: SERIALIZED (Control Individual por MAC / Serial)
      // ─────────────────────────────────────────────────────────────
      if (activeTrackingType === TrackingType.SERIALIZED) {
        if (!Array.isArray(items) || items.length === 0) {
          res.status(400).json({
            success: false,
            error: 'Para artículos seriados se debe enviar un listado (array) con al menos un equipo { macAddress, serialNumber }'
          });
          return;
        }

        // Sanitizar y validar
        const sanitizedItems: { macAddress?: string; serialNumber: string; verificationCode?: string; notes?: string }[] = [];
        const macSet = new Set<string>();
        const serialSet = new Set<string>();

        for (let i = 0; i < items.length; i++) {
          const rawMac = String(items[i].macAddress || '').trim().toUpperCase();
          const rawSerial = String(items[i].serialNumber || '').trim().toUpperCase();
          const rawVerificationCode = String(items[i].verificationCode || '').trim().toUpperCase();

          if (!rawSerial) {
            res.status(400).json({
              success: false,
              error: `El ítem en la posición #${i + 1} debe contener un Número de Serie (S/N)`
            });
            return;
          }

          if (rawMac && macSet.has(rawMac)) {
            res.status(400).json({
              success: false,
              error: `La MAC Address "${rawMac}" está duplicada dentro del lote a ingresar`
            });
            return;
          }

          if (serialSet.has(rawSerial)) {
            res.status(400).json({
              success: false,
              error: `El Serial "${rawSerial}" está duplicado dentro del lote a ingresar`
            });
            return;
          }

          if (rawMac) macSet.add(rawMac);
          serialSet.add(rawSerial);

          sanitizedItems.push({
            macAddress: rawMac || undefined,
            serialNumber: rawSerial,
            verificationCode: rawVerificationCode || undefined,
            notes: items[i].notes?.trim() || notes?.trim() || undefined
          });
        }

        // Verificar colisiones con la base de datos
        const allMacs = sanitizedItems.map(i => i.macAddress).filter(Boolean) as string[];
        const allSerials = sanitizedItems.map(i => i.serialNumber);

        const orConditions: any[] = [{ serialNumber: { in: allSerials } }];
        if (allMacs.length > 0) {
          orConditions.push({ macAddress: { in: allMacs } });
        }

        const existingItems = await prisma.serializedItem.findMany({
          where: { OR: orConditions }
        });

        if (existingItems.length > 0) {
          const conflicting = existingItems.map(e => `S/N: ${e.serialNumber}${e.macAddress ? ` (MAC: ${e.macAddress})` : ''}`).join(', ');
          res.status(409).json({
            success: false,
            error: `Los siguientes equipos ya existen registrados en el inventario: ${conflicting}`
          });
          return;
        }

        // Inserción transaccional
        const createdSerialized = await prisma.$transaction(async (tx) => {
          const list: any[] = [];

          for (const item of sanitizedItems) {
            const created = await tx.serializedItem.create({
              data: {
                productId,
                currentWarehouseId: warehouseId,
                macAddress: item.macAddress || null,
                serialNumber: item.serialNumber,
                verificationCode: item.verificationCode || null,
                status: SerializedStatus.EN_BODEGA,
                notes: item.notes || null
              }
            });

            if (systemUser) {
              await tx.auditLog.create({
                data: {
                  eventType: AuditEventType.ALTA_INVENTARIO,
                  macAddress: item.macAddress || null,
                  serialNumber: item.serialNumber,
                  toWarehouseId: warehouseId,
                  userId: systemUser.id,
                  details: `Alta de Equipo Seriado: ${product.name} (S/N: ${item.serialNumber}${item.macAddress ? `, MAC: ${item.macAddress}` : ''}${item.verificationCode ? `, Code: ${item.verificationCode}` : ''}) en bodega ${warehouse.name}`
                }
              });
            }

            list.push(created);
          }

          return list;
        });

        res.status(201).json({
          success: true,
          message: `Se registraron exitosamente ${createdSerialized.length} equipo(s) seriado(s) de "${product.name}" en ${warehouse.name}`,
          type: 'SERIALIZED',
          count: createdSerialized.length,
          items: createdSerialized
        });
        return;
      }

      res.status(400).json({
        success: false,
        error: `Tipo de seguimiento no soportado: ${activeTrackingType}`
      });
    } catch (error: any) {
      console.error('Error en Inbound Inventory:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno al procesar el ingreso de inventario',
        details: error.message
      });
    }
  }

  /**
   * Obtiene todos los artículos seriados con filtros por bodega, estado y búsqueda
   * GET /api/inventory/serialized
   */
  public static async getSerializedItems(req: Request, res: Response): Promise<void> {
    try {
      const warehouseId = req.query.warehouseId ? String(req.query.warehouseId) : undefined;
      const status = req.query.status ? String(req.query.status) : undefined;
      const search = req.query.search ? String(req.query.search).trim() : undefined;

      const where: any = {};
      if (warehouseId && warehouseId !== 'all') {
        where.currentWarehouseId = warehouseId;
      }
      if (status && status !== 'ALL') {
        where.status = status as SerializedStatus;
      }
      if (search) {
        where.OR = [
          { serialNumber: { contains: search, mode: 'insensitive' } },
          { macAddress: { contains: search, mode: 'insensitive' } },
          { verificationCode: { contains: search, mode: 'insensitive' } },
          { product: { name: { contains: search, mode: 'insensitive' } } },
          { product: { model: { contains: search, mode: 'insensitive' } } },
          { product: { brand: { contains: search, mode: 'insensitive' } } }
        ];
      }

      const items = await prisma.serializedItem.findMany({
        where,
        include: {
          product: true,
          currentWarehouse: true
        },
        orderBy: [
          { currentWarehouse: { name: 'asc' } },
          { serialNumber: 'asc' }
        ]
      });

      res.status(200).json({
        success: true,
        count: items.length,
        items
      });
    } catch (error: any) {
      console.error('[InventoryController.getSerializedItems] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Error al consultar equipos seriados',
        details: error.message
      });
    }
  }

  /**
   * Registra un equipo seriado individual
   * POST /api/inventory/serialized
   */
  public static async createSerializedItem(req: Request, res: Response): Promise<void> {
    try {
      const { macAddress, serialNumber, brand, model, category, currentWarehouseId, productId } = req.body;

      if (!serialNumber || !currentWarehouseId) {
        res.status(400).json({
          success: false,
          error: 'Número de serial y bodega destino son obligatorios'
        });
        return;
      }

      let targetProductId = productId;
      if (!targetProductId) {
        const existingProduct = await prisma.productCatalog.findFirst({
          where: {
            OR: [
              { model: model || undefined },
              { name: { contains: model || brand || 'ONU', mode: 'insensitive' } }
            ]
          }
        });
        if (existingProduct) {
          targetProductId = existingProduct.id;
        } else {
          const createdProduct = await prisma.productCatalog.create({
            data: {
              sku: `ONU-${Date.now().toString().slice(-6)}`,
              name: `${brand || 'ONU'} ${model || 'Estándar'}`,
              brand: brand || 'Genérico',
              model: model || 'Estándar',
              category: (category as any) || 'ONU_ONT',
              trackingType: TrackingType.SERIALIZED,
              unitOfMeasure: 'UNIDADES',
              minStockAlert: 5
            }
          });
          targetProductId = createdProduct.id;
        }
      }

      const item = await prisma.serializedItem.create({
        data: {
          serialNumber: String(serialNumber).trim(),
          macAddress: macAddress ? String(macAddress).trim().toUpperCase() : null,
          currentWarehouseId,
          productId: targetProductId,
          status: SerializedStatus.EN_BODEGA
        },
        include: {
          product: true,
          currentWarehouse: true
        }
      });

      res.status(201).json({
        success: true,
        item
      });
    } catch (error: any) {
      console.error('[InventoryController.createSerializedItem] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Error al registrar equipo seriado',
        details: error.message
      });
    }
  }

  /**
   * Obtiene bobinas y lotes de cable drop
   * GET /api/inventory/batches
   */
  public static async getBatchItems(req: Request, res: Response): Promise<void> {
    try {
      const warehouseId = req.query.warehouseId ? String(req.query.warehouseId) : undefined;
      const status = req.query.status ? String(req.query.status) : undefined;
      const search = req.query.search ? String(req.query.search).trim() : undefined;

      const where: any = {};
      if (warehouseId && warehouseId !== 'all') {
        where.currentWarehouseId = warehouseId;
      }
      if (status && status !== 'ALL') {
        where.status = status as BatchStatus;
      }
      if (search) {
        where.OR = [
          { batchNumber: { contains: search, mode: 'insensitive' } },
          { product: { name: { contains: search, mode: 'insensitive' } } },
          { product: { sku: { contains: search, mode: 'insensitive' } } }
        ];
      }

      const items = await prisma.batchItem.findMany({
        where,
        include: {
          product: true,
          currentWarehouse: true
        },
        orderBy: [
          { currentWarehouse: { name: 'asc' } },
          { batchNumber: 'asc' }
        ]
      });

      res.status(200).json({
        success: true,
        count: items.length,
        items
      });
    } catch (error: any) {
      console.error('[InventoryController.getBatchItems] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Error al consultar bobinas y lotes',
        details: error.message
      });
    }
  }

  /**
   * Obtiene el inventario de artículos a granel
   * GET /api/inventory/bulk
   */
  public static async getBulkInventory(req: Request, res: Response): Promise<void> {
    try {
      const warehouseId = req.query.warehouseId ? String(req.query.warehouseId) : undefined;
      const search = req.query.search ? String(req.query.search).trim() : undefined;

      const where: any = {};
      if (warehouseId && warehouseId !== 'all') {
        where.warehouseId = warehouseId;
      }
      if (search) {
        where.product = {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { sku: { contains: search, mode: 'insensitive' } }
          ]
        };
      }

      const [bulkStocks, catalogBulkItems] = await Promise.all([
        prisma.bulkStock.findMany({
          where,
          include: {
            product: true,
            warehouse: true
          },
          orderBy: [
            { warehouse: { name: 'asc' } },
            { product: { name: 'asc' } }
          ]
        }),
        prisma.productCatalog.findMany({
          where: { trackingType: TrackingType.BULK, isActive: true },
          orderBy: { name: 'asc' }
        })
      ]);

      const formattedStocks = bulkStocks.map(stock => ({
        id: stock.id,
        bulkItemId: stock.productId,
        bulkItemName: stock.product.name,
        bulkItemCode: stock.product.sku,
        unitOfMeasure: stock.product.unitOfMeasure,
        warehouseId: stock.warehouseId,
        warehouseName: stock.warehouse.name,
        quantity: stock.quantity,
        updatedAt: stock.updatedAt
      }));

      const formattedItems = catalogBulkItems.map(item => ({
        id: item.id,
        name: item.name,
        code: item.sku,
        category: item.category,
        unitOfMeasure: item.unitOfMeasure,
        minStockAlert: item.minStockAlert,
        description: item.description,
        createdAt: item.createdAt
      }));

      res.status(200).json({
        success: true,
        items: formattedItems,
        stocks: formattedStocks
      });
    } catch (error: any) {
      console.error('[InventoryController.getBulkInventory] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Error al consultar inventario a granel',
        details: error.message
      });
    }
  }

  /**
   * Ajusta existencias a granel
   * POST /api/inventory/bulk/adjust
   */
  public static async adjustBulkStock(req: Request, res: Response): Promise<void> {
    try {
      const { warehouseId, bulkItemId, deltaQuantity, reason } = req.body;
      if (!warehouseId || !bulkItemId) {
        res.status(400).json({ success: false, error: 'warehouseId y bulkItemId son requeridos' });
        return;
      }

      const delta = Number(deltaQuantity);
      if (isNaN(delta)) {
        res.status(400).json({ success: false, error: 'deltaQuantity debe ser numérico' });
        return;
      }

      const existing = await prisma.bulkStock.findUnique({
        where: {
          productId_warehouseId: {
            productId: bulkItemId,
            warehouseId
          }
        }
      });

      const currentQty = existing ? existing.quantity : 0;
      const newQty = Math.max(0, currentQty + delta);

      const stock = await prisma.bulkStock.upsert({
        where: {
          productId_warehouseId: {
            productId: bulkItemId,
            warehouseId
          }
        },
        create: {
          productId: bulkItemId,
          warehouseId,
          quantity: newQty
        },
        update: {
          quantity: newQty
        },
        include: {
          product: true,
          warehouse: true
        }
      });

      res.status(200).json({
        success: true,
        stock: {
          id: stock.id,
          bulkItemId: stock.productId,
          bulkItemName: stock.product.name,
          bulkItemCode: stock.product.sku,
          unitOfMeasure: stock.product.unitOfMeasure,
          warehouseId: stock.warehouseId,
          warehouseName: stock.warehouse.name,
          quantity: stock.quantity,
          updatedAt: stock.updatedAt
        }
      });
    } catch (error: any) {
      console.error('[InventoryController.adjustBulkStock] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Error al ajustar stock a granel',
        details: error.message
      });
    }
  }

  /**
   * Elimina un equipo serializado individual (Solo permitido para equipos de prueba)
   * DELETE /api/inventory/serialized/:id
   */
  public static async deleteSerializedItem(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);

      const item: any = await prisma.serializedItem.findUnique({
        where: { id },
        include: {
          product: true,
          currentWarehouse: true
        }
      });

      if (!item) {
        res.status(404).json({
          success: false,
          error: 'Equipo serializado no encontrado'
        });
        return;
      }

      // Validar si el equipo corresponde a uno de prueba (por serial, mac, notas o datos del producto)
      const combined = [
        item.serialNumber || '',
        item.macAddress || '',
        item.notes || '',
        item.product?.name || '',
        item.product?.sku || '',
        item.product?.description || '',
        item.product?.model || '',
        item.product?.brand || ''
      ].join(' ').toLowerCase();

      const isTest = /prueba|test|tester|testing|demo|dummy|mock|laboratorio|sandbox|beta|temporal|desarrollo/i.test(combined);

      if (!isTest) {
        res.status(403).json({
          success: false,
          error: `Acción protegida: Como administrador o desarrollador, únicamente puedes eliminar equipos de prueba (con número de serie, MAC o producto marcados como 'prueba', 'test' o 'demo'). El equipo "${item.serialNumber}" es de producción y no puede eliminarse.`
        });
        return;
      }

      // Eliminar el equipo serializado
      await prisma.serializedItem.delete({
        where: { id }
      });

      res.status(200).json({
        success: true,
        message: `Equipo de prueba con serial "${item.serialNumber}" eliminado exitosamente.`
      });
    } catch (error: any) {
      console.error('[InventoryController.deleteSerializedItem] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Error al eliminar el equipo de prueba',
        details: error.message
      });
    }
  }
}

export const inventoryController = new InventoryController();
export default InventoryController;
