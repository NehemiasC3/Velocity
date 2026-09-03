import { Request, Response } from 'express';
import { prisma } from '../db';
import { TransferStatus, SerializedStatus, BatchStatus, AuditEventType, WarehouseType } from '@prisma/client';

export class TransferController {
  /**
   * Obtiene el historial de órdenes de traslado
   * GET /api/transfers
   */
  public static async getTransfers(req: Request, res: Response): Promise<void> {
    try {
      const { warehouseId, status, search } = req.query;

      const where: any = {};

      if (status && typeof status === 'string') {
        where.status = status as TransferStatus;
      }

      if (warehouseId && typeof warehouseId === 'string') {
        where.OR = [
          { sourceWarehouseId: warehouseId },
          { destinationWarehouseId: warehouseId }
        ];
      }

      if (search && typeof search === 'string') {
        const q = search.trim();
        where.OR = [
          { orderNumber: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
          { sourceWarehouse: { name: { contains: q, mode: 'insensitive' } } },
          { destinationWarehouse: { name: { contains: q, mode: 'insensitive' } } }
        ];
      }

      const transfers = await prisma.transferOrder.findMany({
        where,
        include: {
          sourceWarehouse: true,
          destinationWarehouse: true,
          createdByUser: {
            select: { id: true, name: true, email: true, role: true }
          },
          dispatchedByUser: {
            select: { id: true, name: true, email: true, role: true }
          },
          receivedByUser: {
            select: { id: true, name: true, email: true, role: true }
          },
          items: {
            include: { product: true }
          },
          batchItems: {
            include: { product: true }
          },
          serializedItems: {
            include: { product: true }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      res.status(200).json({
        success: true,
        count: transfers.length,
        transfers
      });
    } catch (error: any) {
      console.error('Error al obtener traslados:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno al consultar las órdenes de traslado',
        details: error.message
      });
    }
  }

  /**
   * Obtiene el stock disponible físico de una bodega para traslado
   * GET /api/transfers/warehouse-stock/:warehouseId
   */
  public static async getWarehouseStock(req: Request, res: Response): Promise<void> {
    try {
      const warehouseId = String(req.params.warehouseId || req.query.warehouseId);

      if (!warehouseId) {
        res.status(400).json({
          success: false,
          error: 'Debe especificar el ID de la bodega (warehouseId)'
        });
        return;
      }

      const warehouse = await prisma.warehouse.findUnique({
        where: { id: warehouseId }
      });

      if (!warehouse) {
        res.status(404).json({
          success: false,
          error: 'Bodega no encontrada'
        });
        return;
      }

      const [bulkStocks, batchItems, serializedItems] = await Promise.all([
        // A. Material a granel con existencia > 0
        prisma.bulkStock.findMany({
          where: {
            warehouseId,
            quantity: { gt: 0 }
          },
          include: { product: true },
          orderBy: { product: { name: 'asc' } }
        }),

        // B. Bobinas disponibles con metraje > 0
        prisma.batchItem.findMany({
          where: {
            currentWarehouseId: warehouseId,
            status: BatchStatus.DISPONIBLE,
            currentQuantity: { gt: 0 }
          },
          include: { product: true },
          orderBy: { batchNumber: 'asc' }
        }),

        // C. Equipos seriados en bodega o en vehículo
        prisma.serializedItem.findMany({
          where: {
            currentWarehouseId: warehouseId,
            status: { in: [SerializedStatus.EN_BODEGA, SerializedStatus.EN_VEHICULO] }
          },
          include: { product: true },
          orderBy: { macAddress: 'asc' }
        })
      ]);

      res.status(200).json({
        success: true,
        warehouse,
        stock: {
          bulkStocks,
          batchItems,
          serializedItems
        }
      });
    } catch (error: any) {
      console.error('Error al obtener stock de bodega:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno al consultar el stock de la bodega',
        details: error.message
      });
    }
  }

  /**
   * Procesa un traslado transaccional entre bodegas
   * POST /api/transfers
   */
  public static async createTransfer(req: Request, res: Response): Promise<void> {
    try {
      const {
        sourceWarehouseId,
        destinationWarehouseId,
        notes,
        bulkItems,
        batchIds,
        serializedIds,
        directReceive = true
      } = req.body;

      if (!sourceWarehouseId || !destinationWarehouseId) {
        res.status(400).json({
          success: false,
          error: 'Debe especificar tanto la bodega de origen como la bodega de destino'
        });
        return;
      }

      if (sourceWarehouseId === destinationWarehouseId) {
        res.status(400).json({
          success: false,
          error: 'La bodega de origen y la bodega de destino no pueden ser la misma'
        });
        return;
      }

      // Validar existencia de bodegas
      const [sourceWarehouse, destinationWarehouse] = await Promise.all([
        prisma.warehouse.findUnique({ where: { id: sourceWarehouseId } }),
        prisma.warehouse.findUnique({ where: { id: destinationWarehouseId } })
      ]);

      if (!sourceWarehouse) {
        res.status(404).json({ success: false, error: 'Bodega de origen no encontrada' });
        return;
      }

      if (!destinationWarehouse) {
        res.status(404).json({ success: false, error: 'Bodega de destino no encontrada' });
        return;
      }

      const hasBulk = Array.isArray(bulkItems) && bulkItems.length > 0;
      const hasBatches = Array.isArray(batchIds) && batchIds.length > 0;
      const hasSerialized = Array.isArray(serializedIds) && serializedIds.length > 0;

      if (!hasBulk && !hasBatches && !hasSerialized) {
        res.status(400).json({
          success: false,
          error: 'Debe incluir al menos un material (granel, bobina o equipo seriado) en la orden de traslado'
        });
        return;
      }

      // Obtener usuario autenticado o default
      const activeUserId = (req as any).user?.id || (req.headers['x-user-id'] as string) || null;
      let user: any = null;
      if (activeUserId) {
        user = await prisma.user.findUnique({ where: { id: activeUserId } });
      }
      if (!user) {
        user = await prisma.user.findFirst();
      }

      if (!user) {
        res.status(500).json({ success: false, error: 'No se encontró un usuario responsable para firmar el traslado' });
        return;
      }

      // ─────────────────────────────────────────────────────────────
      // VALIDACIÓN PREVIA DE STOCK EN ORIGEN
      // ─────────────────────────────────────────────────────────────
      
      // 1. Validar Granel
      const sanitizedBulk: { productId: string; quantity: number; unitOfMeasure: any }[] = [];
      if (hasBulk) {
        for (const item of bulkItems) {
          const qty = Number(item.quantity);
          if (!item.productId || isNaN(qty) || qty <= 0) continue;

          const currentStock = await prisma.bulkStock.findUnique({
            where: {
              productId_warehouseId: {
                productId: item.productId,
                warehouseId: sourceWarehouseId
              }
            },
            include: { product: true }
          });

          if (!currentStock || currentStock.quantity < qty) {
            res.status(400).json({
              success: false,
              error: `Stock insuficiente para "${currentStock?.product?.name || item.productId}". Disponible en origen: ${currentStock?.quantity || 0}, Solicitado: ${qty}`
            });
            return;
          }

          sanitizedBulk.push({
            productId: item.productId,
            quantity: qty,
            unitOfMeasure: currentStock.product.unitOfMeasure
          });
        }
      }

      // 2. Validar Bobinas
      let validatedBatches: any[] = [];
      if (hasBatches) {
        validatedBatches = await prisma.batchItem.findMany({
          where: {
            id: { in: batchIds },
            currentWarehouseId: sourceWarehouseId,
            status: BatchStatus.DISPONIBLE
          },
          include: { product: true }
        });

        if (validatedBatches.length !== batchIds.length) {
          res.status(400).json({
            success: false,
            error: `Una o más bobinas seleccionadas ya no están disponibles en la bodega de origen (${sourceWarehouse.name})`
          });
          return;
        }
      }

      // 3. Validar Seriados
      let validatedSerialized: any[] = [];
      if (hasSerialized) {
        validatedSerialized = await prisma.serializedItem.findMany({
          where: {
            id: { in: serializedIds },
            currentWarehouseId: sourceWarehouseId,
            status: { in: [SerializedStatus.EN_BODEGA, SerializedStatus.EN_VEHICULO] }
          },
          include: { product: true }
        });

        if (validatedSerialized.length !== serializedIds.length) {
          res.status(400).json({
            success: false,
            error: `Uno o más equipos seriados seleccionados ya no están en la bodega de origen (${sourceWarehouse.name})`
          });
          return;
        }
      }

      // ─────────────────────────────────────────────────────────────
      // EJECUCIÓN TRANSACCIONAL (Prisma $transaction)
      // ─────────────────────────────────────────────────────────────
      const transferStatus: TransferStatus = directReceive ? TransferStatus.RECIBIDO : TransferStatus.EN_TRANSITO;
      const orderNumber = `TRF-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

      const result = await prisma.$transaction(async (tx) => {
        // A. Crear cabecera de la Orden de Traslado
        const order = await tx.transferOrder.create({
          data: {
            orderNumber,
            sourceWarehouseId,
            destinationWarehouseId,
            status: transferStatus,
            createdByUserId: user.id,
            dispatchedByUserId: user.id,
            dispatchedAt: new Date(),
            receivedByUserId: directReceive ? user.id : null,
            receivedAt: directReceive ? new Date() : null,
            notes: notes?.trim() || null,
            // Crear ítems de resumen a granel
            items: {
              create: sanitizedBulk.map(b => ({
                productId: b.productId,
                quantity: b.quantity,
                unitOfMeasure: b.unitOfMeasure
              }))
            },
            // Conectar bobinas
            batchItems: hasBatches ? {
              connect: batchIds.map((id: string) => ({ id }))
            } : undefined,
            // Conectar equipos seriados
            serializedItems: hasSerialized ? {
              connect: serializedIds.map((id: string) => ({ id }))
            } : undefined
          },
          include: {
            items: { include: { product: true } },
            batchItems: { include: { product: true } },
            serializedItems: { include: { product: true } },
            sourceWarehouse: true,
            destinationWarehouse: true
          }
        });

        // B. Trasladar Granel (Resta en Origen, Suma/Upsert en Destino)
        for (const b of sanitizedBulk) {
          // Resta en origen
          await tx.bulkStock.update({
            where: {
              productId_warehouseId: {
                productId: b.productId,
                warehouseId: sourceWarehouseId
              }
            },
            data: {
              quantity: { decrement: b.quantity }
            }
          });

          // Suma/Upsert en destino
          await tx.bulkStock.upsert({
            where: {
              productId_warehouseId: {
                productId: b.productId,
                warehouseId: destinationWarehouseId
              }
            },
            create: {
              productId: b.productId,
              warehouseId: destinationWarehouseId,
              quantity: b.quantity
            },
            update: {
              quantity: { increment: b.quantity }
            }
          });
        }

        // C. Trasladar Bobinas (Actualizar currentWarehouseId)
        if (hasBatches) {
          await tx.batchItem.updateMany({
            where: { id: { in: batchIds } },
            data: {
              currentWarehouseId: destinationWarehouseId,
              status: directReceive ? BatchStatus.DISPONIBLE : BatchStatus.EN_TRANSITO
            }
          });
        }

        // D. Trasladar Equipos Seriados
        if (hasSerialized) {
          // Si el destino es vehículo, cambiar status a EN_VEHICULO, sino EN_BODEGA
          const newStatus = destinationWarehouse.type === WarehouseType.VEHICULO 
            ? SerializedStatus.EN_VEHICULO 
            : SerializedStatus.EN_BODEGA;

          await tx.serializedItem.updateMany({
            where: { id: { in: serializedIds } },
            data: {
              currentWarehouseId: destinationWarehouseId,
              status: directReceive ? newStatus : SerializedStatus.EN_TRANSITO
            }
          });
        }

        // E. Registrar Auditoría Forense
        const eventType = destinationWarehouse.type === WarehouseType.VEHICULO
          ? AuditEventType.CARGA_VEHICULO
          : AuditEventType.DESPACHO_TRASLADO;

        await tx.auditLog.create({
          data: {
            eventType,
            fromWarehouseId: sourceWarehouseId,
            toWarehouseId: destinationWarehouseId,
            userId: user.id,
            details: `Orden de Traslado ${orderNumber} ejecutada. Origen: ${sourceWarehouse.name} -> Destino: ${destinationWarehouse.name}. Contenido: ${sanitizedBulk.length} material(es) a granel, ${validatedBatches.length} bobina(s), ${validatedSerialized.length} equipo(s) seriado(s).`
          }
        });

        return order;
      });

      res.status(201).json({
        success: true,
        message: `Orden de traslado ${result.orderNumber} procesada exitosamente.`,
        transfer: result
      });
    } catch (error: any) {
      console.error('Error al procesar traslado:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno al ejecutar la orden de traslado',
        details: error.message
      });
    }
  }
}
