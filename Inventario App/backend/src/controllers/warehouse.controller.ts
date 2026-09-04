import { Request, Response } from 'express';
import { prisma } from '../db';
import { WarehouseType, WarehouseStatus } from '@prisma/client';

export class WarehouseController {
  /**
   * Obtiene todas las bodegas con su jerarquía completa (Hub -> Spoke)
   * GET /api/warehouses
   */
  public static async getWarehouses(req: Request, res: Response): Promise<void> {
    try {
      const warehouses = await prisma.warehouse.findMany({
        include: {
          parentWarehouse: {
            select: {
              id: true,
              name: true,
              code: true,
              type: true,
              address: true
            }
          },
          childWarehouses: {
            select: {
              id: true,
              name: true,
              code: true,
              type: true,
              status: true,
              vehiclePlate: true
            }
          },
          manager: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          },
          _count: {
            select: {
              serializedItems: true,
              batchItems: true,
              bulkStocks: true
            }
          }
        },
        orderBy: [
          { type: 'asc' },
          { name: 'asc' }
        ]
      });

      res.json({
        success: true,
        count: warehouses.length,
        warehouses
      });
    } catch (error: any) {
      console.error('[WarehouseController.getWarehouses] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Error al consultar las bodegas en la base de datos',
        details: error.message
      });
    }
  }

  /**
   * Obtiene una bodega específica por ID con sus existencias
   * GET /api/warehouses/:id
   */
  public static async getWarehouseById(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const warehouse = await prisma.warehouse.findUnique({
        where: { id },
        include: {
          parentWarehouse: true,
          childWarehouses: true,
          manager: true,
          bulkStocks: {
            include: { product: true }
          },
          batchItems: {
            include: { product: true }
          },
          serializedItems: {
            include: { product: true }
          }
        }
      });

      if (!warehouse) {
        res.status(404).json({ success: false, error: 'Bodega no encontrada' });
        return;
      }

      res.json({ success: true, warehouse });
    } catch (error: any) {
      console.error('[WarehouseController.getWarehouseById] Error:', error);
      res.status(500).json({ success: false, error: 'Error al consultar la bodega', details: error.message });
    }
  }

  /**
   * Crea una nueva bodega en el árbol jerárquico
   * POST /api/warehouses
   */
  public static async createWarehouse(req: Request, res: Response): Promise<void> {
    try {
      const { 
        name, 
        code, 
        type, 
        location, 
        address, 
        vehiclePlate, 
        parent_id, 
        parentId, 
        managerId 
      } = req.body;

      if (!name || !type) {
        res.status(400).json({ 
          success: false, 
          error: 'El nombre y el tipo de bodega son obligatorios' 
        });
        return;
      }

      // Validar tipo de bodega permitido
      const validTypes: WarehouseType[] = ['PRINCIPAL', 'SUCURSAL', 'VEHICULO', 'CUARENTENA_RMA'];
      const normalizedType = type.toUpperCase() as WarehouseType;
      if (!validTypes.includes(normalizedType)) {
        res.status(400).json({ 
          success: false, 
          error: `Tipo de bodega inválido. Opciones válidas: ${validTypes.join(', ')}` 
        });
        return;
      }

      // Generar código único si no se envió explícitamente
      let finalCode = code?.trim().toUpperCase();
      if (!finalCode) {
        const prefix = normalizedType === 'PRINCIPAL' ? 'HUB' 
                     : normalizedType === 'SUCURSAL' ? 'SUC' 
                     : normalizedType === 'VEHICULO' ? 'MOV' 
                     : 'RMA';
        finalCode = `${prefix}-${Date.now().toString().slice(-4)}`;
      }

      // Verificar que el código no exista
      const existingCode = await prisma.warehouse.findUnique({
        where: { code: finalCode }
      });
      if (existingCode) {
        finalCode = `${finalCode}-${Math.floor(Math.random() * 100)}`;
      }

      const finalParentId = parent_id || parentId || null;

      // Si se indicó bodega padre, validar que exista
      if (finalParentId) {
        const parentExists = await prisma.warehouse.findUnique({
          where: { id: finalParentId }
        });
        if (!parentExists) {
          res.status(400).json({ 
            success: false, 
            error: 'La bodega padre especificada no existe en el sistema' 
          });
          return;
        }
      }

      const newWarehouse = await prisma.warehouse.create({
        data: {
          name,
          code: finalCode,
          type: normalizedType,
          address: address || location || null,
          vehiclePlate: vehiclePlate || null,
          parentId: finalParentId,
          managerId: managerId || null,
          status: WarehouseStatus.ACTIVE
        },
        include: {
          parentWarehouse: true,
          childWarehouses: true,
          manager: true
        }
      });

      res.status(201).json({
        success: true,
        message: 'Bodega creada exitosamente en la jerarquía',
        warehouse: newWarehouse
      });
    } catch (error: any) {
      console.error('[WarehouseController.createWarehouse] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Error al registrar la bodega en la base de datos',
        details: error.message
      });
    }
  }

  /**
   * Actualiza los datos de una bodega
   * PUT /api/warehouses/:id
   */
  public static async updateWarehouse(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const { name, code, type, address, location, vehiclePlate, parentId, parent_id, managerId, status } = req.body;

      const finalParentId = parent_id !== undefined ? parent_id : parentId;

      const updated = await prisma.warehouse.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(code && { code: code.toUpperCase() }),
          ...(type && { type: type.toUpperCase() as WarehouseType }),
          ...((address || location) && { address: address || location }),
          ...(vehiclePlate !== undefined && { vehiclePlate }),
          ...(finalParentId !== undefined && { parentId: finalParentId || null }),
          ...(managerId !== undefined && { managerId: managerId || null }),
          ...(status && { status: status.toUpperCase() as WarehouseStatus })
        },
        include: {
          parentWarehouse: true,
          childWarehouses: true,
          manager: true
        }
      });

      res.json({
        success: true,
        message: 'Bodega actualizada correctamente',
        warehouse: updated
      });
    } catch (error: any) {
      console.error('[WarehouseController.updateWarehouse] Error:', error);
      res.status(500).json({ success: false, error: 'Error al actualizar la bodega', details: error.message });
    }
  }

  /**
   * Elimina o desactiva una bodega
   * DELETE /api/warehouses/:id
   */
  public static async deleteWarehouse(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);

      // Verificar si tiene bodegas hijas dependientes
      const childCount = await prisma.warehouse.count({
        where: { parentId: id }
      });
      if (childCount > 0) {
        res.status(400).json({
          success: false,
          error: `No se puede eliminar: Esta bodega abastece a ${childCount} bodega(s)/vehículo(s) hijo(s). Reasigna sus dependientes primero.`
        });
        return;
      }

      await prisma.warehouse.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: 'Bodega eliminada correctamente'
      });
    } catch (error: any) {
      console.error('[WarehouseController.deleteWarehouse] Error:', error);
      res.status(500).json({ success: false, error: 'Error al eliminar la bodega', details: error.message });
    }
  }

  /**
   * Obtiene o auto-aprovisiona la bodega móvil de un técnico
   * GET /api/warehouses/technician/:identifier
   */
  public static async getTechnicianVehicleWarehouse(req: Request, res: Response): Promise<void> {
    try {
      const identifier = decodeURIComponent(String(req.params.identifier || '')).trim();
      if (!identifier) {
        res.status(400).json({ success: false, error: 'Identificador de técnico requerido' });
        return;
      }

      // Buscar si existe un usuario con este id, email o nombre
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { id: identifier },
            { email: { equals: identifier, mode: 'insensitive' } },
            { name: { contains: identifier, mode: 'insensitive' } }
          ]
        }
      });

      // Buscar si ya existe la bodega de tipo VEHICULO asociada al técnico
      let warehouse = await prisma.warehouse.findFirst({
        where: {
          type: WarehouseType.VEHICULO,
          OR: [
            ...(user ? [{ managerId: user.id }] : []),
            { name: { contains: identifier, mode: 'insensitive' } }
          ]
        },
        include: {
          parentWarehouse: true,
          manager: true,
          bulkStocks: {
            include: { product: true }
          },
          batchItems: {
            include: { product: true }
          },
          serializedItems: {
            include: { product: true }
          }
        }
      });

      // Si no existe, auto-crear la bodega móvil para este técnico
      if (!warehouse) {
        const defaultHub = await prisma.warehouse.findFirst({
          where: { type: { in: [WarehouseType.PRINCIPAL, WarehouseType.SUCURSAL] } },
          orderBy: { createdAt: 'asc' }
        });

        const techName = user?.name || identifier;
        const cleanCode = `MOV-${techName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

        const created = await prisma.warehouse.create({
          data: {
            name: `Móvil - ${techName}`,
            code: cleanCode,
            type: WarehouseType.VEHICULO,
            parentId: defaultHub?.id || null,
            managerId: user?.id || null,
            status: WarehouseStatus.ACTIVE,
            address: `Cuadrilla móvil en ruta`
          },
          include: {
            parentWarehouse: true,
            manager: true,
            bulkStocks: {
              include: { product: true }
            },
            batchItems: {
              include: { product: true }
            },
            serializedItems: {
              include: { product: true }
            }
          }
        });

        warehouse = created;
      }

      res.json({
        success: true,
        warehouse
      });
    } catch (error: any) {
      console.error('[WarehouseController.getTechnicianVehicleWarehouse] Error:', error);
      res.status(500).json({ success: false, error: 'Error al consultar la bodega del técnico', details: error.message });
    }
  }
}
