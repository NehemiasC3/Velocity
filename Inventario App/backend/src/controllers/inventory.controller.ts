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
        const sanitizedItems: { macAddress: string; serialNumber: string; notes?: string }[] = [];
        const macSet = new Set<string>();
        const serialSet = new Set<string>();

        for (let i = 0; i < items.length; i++) {
          const rawMac = String(items[i].macAddress || '').trim().toUpperCase();
          const rawSerial = String(items[i].serialNumber || '').trim().toUpperCase();

          if (!rawMac || !rawSerial) {
            res.status(400).json({
              success: false,
              error: `El ítem en la posición #${i + 1} debe contener tanto MAC Address como Serial (S/N)`
            });
            return;
          }

          if (macSet.has(rawMac)) {
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

          macSet.add(rawMac);
          serialSet.add(rawSerial);

          sanitizedItems.push({
            macAddress: rawMac,
            serialNumber: rawSerial,
            notes: items[i].notes?.trim() || notes?.trim() || undefined
          });
        }

        // Verificar colisiones con la base de datos
        const allMacs = sanitizedItems.map(i => i.macAddress);
        const allSerials = sanitizedItems.map(i => i.serialNumber);

        const existingItems = await prisma.serializedItem.findMany({
          where: {
            OR: [
              { macAddress: { in: allMacs } },
              { serialNumber: { in: allSerials } }
            ]
          }
        });

        if (existingItems.length > 0) {
          const conflicting = existingItems.map(e => `MAC: ${e.macAddress} (S/N: ${e.serialNumber})`).join(', ');
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
                macAddress: item.macAddress,
                serialNumber: item.serialNumber,
                status: SerializedStatus.EN_BODEGA,
                notes: item.notes || null
              }
            });

            if (systemUser) {
              await tx.auditLog.create({
                data: {
                  eventType: AuditEventType.ALTA_INVENTARIO,
                  macAddress: item.macAddress,
                  serialNumber: item.serialNumber,
                  toWarehouseId: warehouseId,
                  userId: systemUser.id,
                  details: `Alta de Equipo Seriado: ${product.name} (MAC: ${item.macAddress}, S/N: ${item.serialNumber}) en bodega ${warehouse.name}`
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
}

export const inventoryController = new InventoryController();
export default InventoryController;
