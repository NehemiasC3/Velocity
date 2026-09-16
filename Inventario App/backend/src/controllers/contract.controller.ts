import { Request, Response } from 'express';
import { prisma } from '../db';
import * as Sentry from '@sentry/node';

export class ContractController {
  /**
   * GET /api/contracts
   * Server-Side Pagination estricto con skip, take, filtros y payload optimizado con select
   * Retorna { total, page, limit, data } y alias contratos para retrocompatibilidad
   */
  public static async getContracts(req: Request, res: Response): Promise<void> {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit || req.query.per_page) || 10));
      const skip = (page - 1) * limit;
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
      const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim() : undefined;
      const originFilter = typeof req.query.origin === 'string' ? req.query.origin.trim() : undefined;

      const where: any = {};
      if (statusFilter && statusFilter !== 'ALL') {
        where.status = statusFilter;
      }
      if (originFilter && originFilter !== 'ALL') {
        where.origin = originFilter;
      }

      if (search) {
        where.OR = [
          { contractNumber: { contains: search, mode: 'insensitive' } },
          { ipAddress: { contains: search, mode: 'insensitive' } },
          {
            client: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { dniPassport: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } }
              ]
            }
          }
        ];
      }

      const [total, data] = await Promise.all([
        prisma.contract.count({ where }),
        prisma.contract.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            contractNumber: true,
            clientId: true,
            client: {
              select: {
                id: true,
                name: true,
                dniPassport: true,
                phone: true,
                email: true
              }
            },
            servicePlanId: true,
            servicePlan: {
              select: {
                id: true,
                name: true,
                downloadSpeed: true,
                uploadSpeed: true,
                price: true
              }
            },
            ipAddress: true,
            origin: true,
            status: true,
            createdAt: true,
            updatedAt: true
          }
        })
      ]);

      res.status(200).json({
        total,
        page,
        limit,
        data,
        contracts: data // Alias de compatibilidad
      });
    } catch (error: any) {
      console.error('[ContractController ❌ getContracts]:', error);
      Sentry.captureException(error);
      res.status(500).json({
        success: false,
        error: 'Error al consultar contratos',
        details: error.message
      });
    }
  }

  /**
   * GET /api/contracts/active
   * Alias de conveniencia para contratos activos
   */
  public static async getActiveContracts(req: Request, res: Response): Promise<void> {
    req.query.status = 'ACTIVO';
    return ContractController.getContracts(req, res);
  }

  /**
   * GET /api/contracts/:id
   * Obtener detalle completo de un contrato por ID
   */
  public static async getContractDetails(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const contract = await prisma.contract.findUnique({
        where: { id },
        select: {
          id: true,
          contractNumber: true,
          clientId: true,
          client: {
            select: {
              id: true,
              name: true,
              dniPassport: true,
              phone: true,
              email: true,
              address: true
            }
          },
          servicePlanId: true,
          servicePlan: {
            select: {
              id: true,
              name: true,
              downloadSpeed: true,
              uploadSpeed: true,
              price: true
            }
          },
          routerServerId: true,
          routerServer: {
            select: {
              id: true,
              name: true,
              ipAddress: true,
              type: true
            }
          },
          ipAddress: true,
          origin: true,
          status: true,
          inventoryItems: {
            select: {
              id: true,
              name: true,
              category: true,
              macAddress: true,
              serialNumber: true,
              status: true
            }
          },
          createdAt: true,
          updatedAt: true
        }
      });

      if (!contract) {
        res.status(404).json({
          success: false,
          error: `Contrato con ID ${id} no encontrado`
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: contract,
        contract
      });
    } catch (error: any) {
      console.error('[ContractController ❌ getContractDetails]:', error);
      Sentry.captureException(error);
      res.status(500).json({
        success: false,
        error: 'Error al consultar detalle del contrato',
        details: error.message
      });
    }
  }

  /**
   * POST /api/contracts
   * Crear nuevo contrato BSS.
   * Previene condiciones de carrera en asignación de IP y numeración mediante prisma.$transaction interactiva.
   */
  public static async createContract(req: Request, res: Response): Promise<void> {
    try {
      const { clientId, servicePlanId, ip_address, ipAddress, status, routerServerId, origin } = req.body;

      // 1. Validaciones básicas de entrada
      if (!clientId || typeof clientId !== 'string') {
        res.status(400).json({
          success: false,
          error: 'El campo "clientId" es obligatorio'
        });
        return;
      }

      const cleanIp = (ipAddress || ip_address)?.toString().trim() || null;
      const cleanStatus = (status?.toString().trim() || 'ACTIVO').toUpperCase();
      const cleanOrigin = (origin?.toString().trim() || 'VELOCITY').toUpperCase();

      // Validación de formato IPv4 si se ingresó IP
      if (cleanIp && !/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(cleanIp)) {
        res.status(400).json({
          success: false,
          error: `La dirección IP "${cleanIp}" no tiene un formato IPv4 válido`
        });
        return;
      }

      // 2. Transacción interactiva para evitar condición de carrera (Race Condition)
      const newContract = await prisma.$transaction(async (tx) => {
        // Verificar existencia del cliente
        const client = await tx.client.findUnique({
          where: { id: clientId },
          select: { id: true, name: true }
        });
        if (!client) {
          throw new Error(`CLIENT_NOT_FOUND: El cliente con ID ${clientId} no existe`);
        }

        // Verificar existencia del plan de servicio si fue especificado
        if (servicePlanId) {
          const plan = await tx.servicePlan.findUnique({
            where: { id: servicePlanId },
            select: { id: true, name: true }
          });
          if (!plan) {
            throw new Error(`PLAN_NOT_FOUND: El plan de servicio con ID ${servicePlanId} no existe`);
          }
        }

        // CONTROL DE CONCURRENCIA: Bloquear duplicidad de IP en contratos activos
        if (cleanIp) {
          const conflictingContract = await tx.contract.findFirst({
            where: {
              ipAddress: cleanIp,
              status: { not: 'CANCELADO' }
            },
            select: { id: true, contractNumber: true, client: { select: { name: true } } }
          });

          if (conflictingContract) {
            throw new Error(
              `IP_CONFLICT: La IP ${cleanIp} ya está asignada al contrato ${conflictingContract.contractNumber || conflictingContract.id} (${conflictingContract.client?.name || 'Otro cliente'}).`
            );
          }
        }

        // Generar número de contrato único y consistente
        const totalCount = await tx.contract.count();
        const timestamp = Date.now().toString().slice(-4);
        const generatedNumber = `CTR-${String(totalCount + 1).padStart(5, '0')}-${timestamp}`;

        return tx.contract.create({
          data: {
            contractNumber: generatedNumber,
            clientId,
            servicePlanId: servicePlanId || null,
            routerServerId: routerServerId || null,
            ipAddress: cleanIp,
            origin: cleanOrigin,
            status: cleanStatus
          },
          select: {
            id: true,
            contractNumber: true,
            clientId: true,
            client: {
              select: {
                id: true,
                name: true,
                dniPassport: true
              }
            },
            servicePlanId: true,
            servicePlan: {
              select: {
                id: true,
                name: true,
                downloadSpeed: true,
                uploadSpeed: true,
                price: true
              }
            },
            ipAddress: true,
            origin: true,
            status: true,
            createdAt: true
          }
        });
      }, {
        maxWait: 5000,
        timeout: 5000
      });

      res.status(201).json({
        success: true,
        message: 'Contrato creado exitosamente con asignación segura de red',
        data: newContract
      });
    } catch (error: any) {
      console.error('[ContractController ❌ createContract]:', error);
      Sentry.captureException(error);

      if (error.message.includes('CLIENT_NOT_FOUND')) {
        res.status(404).json({ success: false, error: error.message.replace('CLIENT_NOT_FOUND: ', '') });
        return;
      }
      if (error.message.includes('PLAN_NOT_FOUND')) {
        res.status(404).json({ success: false, error: error.message.replace('PLAN_NOT_FOUND: ', '') });
        return;
      }
      if (error.message.includes('IP_CONFLICT')) {
        res.status(409).json({ success: false, error: error.message.replace('IP_CONFLICT: ', '') });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Error al registrar contrato en base de datos',
        details: error.message
      });
    }
  }

  /**
   * PUT /api/contracts/:id
   * Actualizar contrato existente (cambio de plan, ip, status)
   */
  public static async updateContract(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const { clientId, servicePlanId, ip_address, ipAddress, status, routerServerId } = req.body;

      const existingContract = await prisma.contract.findUnique({
        where: { id }
      });

      if (!existingContract) {
        res.status(404).json({
          success: false,
          error: `Contrato con ID ${id} no encontrado`
        });
        return;
      }

      const rawIp = ipAddress !== undefined ? ipAddress : ip_address;
      const cleanIp = rawIp !== undefined ? (rawIp ? rawIp.toString().trim() : null) : undefined;

      if (cleanIp && !/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(cleanIp)) {
        res.status(400).json({
          success: false,
          error: `La dirección IP "${cleanIp}" no tiene un formato IPv4 válido`
        });
        return;
      }

      const updated = await prisma.$transaction(async (tx) => {
        if (cleanIp && cleanIp !== existingContract.ipAddress) {
          const conflicting = await tx.contract.findFirst({
            where: {
              ipAddress: cleanIp,
              status: { not: 'CANCELADO' },
              id: { not: id }
            }
          });
          if (conflicting) {
            throw new Error(`IP_CONFLICT: La IP ${cleanIp} ya está en uso por otro contrato activo (${conflicting.contractNumber || conflicting.id})`);
          }
        }

        const updateData: any = {};
        if (clientId !== undefined) updateData.clientId = clientId;
        if (servicePlanId !== undefined) updateData.servicePlanId = servicePlanId || null;
        if (routerServerId !== undefined) updateData.routerServerId = routerServerId || null;
        if (cleanIp !== undefined) updateData.ipAddress = cleanIp;
        if (status !== undefined) updateData.status = status.toString().trim().toUpperCase();
        if (req.body.origin !== undefined) updateData.origin = req.body.origin.toString().trim().toUpperCase();

        return tx.contract.update({
          where: { id },
          data: updateData,
          select: {
            id: true,
            contractNumber: true,
            clientId: true,
            client: {
              select: {
                id: true,
                name: true,
                dniPassport: true
              }
            },
            servicePlanId: true,
            servicePlan: {
              select: {
                id: true,
                name: true,
                downloadSpeed: true,
                uploadSpeed: true,
                price: true
              }
            },
            ipAddress: true,
            origin: true,
            status: true,
            updatedAt: true
          }
        });
      }, {
        maxWait: 5000,
        timeout: 5000
      });

      res.status(200).json({
        success: true,
        message: 'Contrato actualizado exitosamente',
        data: updated
      });
    } catch (error: any) {
      console.error('[ContractController ❌ updateContract]:', error);
      Sentry.captureException(error);

      if (error.message.includes('IP_CONFLICT')) {
        res.status(409).json({ success: false, error: error.message.replace('IP_CONFLICT: ', '') });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Error al actualizar contrato',
        details: error.message
      });
    }
  }

  /**
   * GET /api/plans
   * Obtener lista de planes de servicio para selectores de velocidad
   * Si la tabla está vacía, auto-inicializa planes ISP por defecto para Velocity
   */
  public static async getPlans(_req: Request, res: Response): Promise<void> {
    try {
      let plans = await prisma.servicePlan.findMany({
        orderBy: { downloadSpeed: 'asc' },
        select: {
          id: true,
          name: true,
          downloadSpeed: true,
          uploadSpeed: true,
          price: true
        }
      });

      // Auto-inicialización inteligente de planes básicos si aún no hay ninguno
      if (plans.length === 0) {
        const defaultPlans = [
          { name: 'Plan Fibra Básico 50M', downloadSpeed: 50, uploadSpeed: 25, price: 25.00 },
          { name: 'Plan Fibra Estándar 100M', downloadSpeed: 100, uploadSpeed: 50, price: 35.00 },
          { name: 'Plan Fibra Pro 200M', downloadSpeed: 200, uploadSpeed: 100, price: 45.00 },
          { name: 'Plan Fibra Ultra 500M', downloadSpeed: 500, uploadSpeed: 250, price: 70.00 },
          { name: 'Plan Fibra Giga 1000M', downloadSpeed: 1000, uploadSpeed: 500, price: 110.00 }
        ];

        await prisma.servicePlan.createMany({
          data: defaultPlans
        });

        plans = await prisma.servicePlan.findMany({
          orderBy: { downloadSpeed: 'asc' },
          select: {
            id: true,
            name: true,
            downloadSpeed: true,
            uploadSpeed: true,
            price: true
          }
        });
      }

      res.status(200).json({
        success: true,
        total: plans.length,
        data: plans
      });
    } catch (error: any) {
      console.error('[ContractController ❌ getPlans]:', error);
      Sentry.captureException(error);
      res.status(500).json({
        success: false,
        error: 'Error al consultar planes de servicio',
        details: error.message
      });
    }
  }
}
