import { Request, Response } from 'express';
import { prisma } from '../db';
import { SerializedStatus, AuditEventType } from '@prisma/client';

export class AnalyticsController {
  /**
   * Métricas gerenciales y KPIs clave
   * GET /api/analytics/kpis
   */
  public static async getKPIs(req: Request, res: Response): Promise<void> {
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // 1. ONUs Activas (En Bodegas y en Vehículos)
      const totalActiveOnus = await prisma.serializedItem.count({
        where: {
          status: {
            in: [SerializedStatus.EN_BODEGA, SerializedStatus.EN_VEHICULO]
          }
        }
      });

      // 2. ONUs Instaladas en Clientes
      const totalInstalledOnus = await prisma.serializedItem.count({
        where: {
          status: SerializedStatus.INSTALADO_CLIENTE
        }
      });

      // 3. Equipos en Cuarentena / RMA Defectuoso
      const totalQuarantineOnus = await prisma.serializedItem.count({
        where: {
          status: SerializedStatus.RMA_DEFECTUOSO
        }
      });

      // 4. Consumo de Cable Drop del Mes Actual (Suma de metros en InstallationTicket)
      const monthlyTickets = await prisma.installationTicket.findMany({
        where: {
          createdAt: { gte: firstDayOfMonth }
        },
        select: {
          cableDropMetersUsed: true,
          technicianId: true,
          technician: {
            select: { id: true, name: true }
          },
          createdAt: true
        }
      });

      const monthlyCableConsumption = monthlyTickets.reduce(
        (sum, t) => sum + (t.cableDropMetersUsed || 0),
        0
      );

      // 5. Consumo diario de los últimos 7 días
      const dailyCableConsumption7d: { date: string; label: string; meters: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const nextD = new Date(d);
        nextD.setDate(nextD.getDate() + 1);

        const dayTickets = await prisma.installationTicket.findMany({
          where: {
            createdAt: {
              gte: d,
              lt: nextD
            }
          },
          select: { cableDropMetersUsed: true }
        });

        const dayMeters = dayTickets.reduce((sum, t) => sum + (t.cableDropMetersUsed || 0), 0);
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        dailyCableConsumption7d.push({
          date: d.toISOString().split('T')[0],
          label: `${days[d.getDay()]} ${d.getDate()}`,
          meters: dayMeters
        });
      }

      // 6. Top 3 Técnicos con más tickets/instalaciones en el mes
      const techCounts: { [techId: string]: { name: string; tickets: number; meters: number } } = {};
      monthlyTickets.forEach(t => {
        const tId = t.technicianId;
        const name = t.technician?.name || 'Técnico';
        if (!techCounts[tId]) {
          techCounts[tId] = { name, tickets: 0, meters: 0 };
        }
        techCounts[tId].tickets += 1;
        techCounts[tId].meters += (t.cableDropMetersUsed || 0);
      });

      const topTechnicians = Object.entries(techCounts)
        .map(([id, data]) => ({
          technicianId: id,
          technicianName: data.name,
          closedTickets: data.tickets,
          metersInstalled: data.meters
        }))
        .sort((a, b) => b.closedTickets - a.closedTickets)
        .slice(0, 3);

      // Si no hay datos suficientes de este mes, completamos con los usuarios técnicos de la DB
      if (topTechnicians.length === 0) {
        const defaultTechs = await prisma.user.findMany({
          where: { role: 'TECNICO' },
          take: 3
        });
        defaultTechs.forEach(t => {
          topTechnicians.push({
            technicianId: t.id,
            technicianName: t.name,
            closedTickets: 0,
            metersInstalled: 0
          });
        });
      }

      // 7. Resumen de Bodegas
      const totalWarehouses = await prisma.warehouse.count();

      res.status(200).json({
        success: true,
        kpis: {
          total_active_onus: totalActiveOnus,
          total_installed_onus: totalInstalledOnus,
          total_quarantine_onus: totalQuarantineOnus,
          monthly_cable_consumption: monthlyCableConsumption,
          daily_cable_consumption_7d: dailyCableConsumption7d,
          top_technicians: topTechnicians,
          total_warehouses: totalWarehouses,
          total_tickets_month: monthlyTickets.length
        }
      });
    } catch (error: any) {
      console.error('Error al generar KPIs:', error);
      res.status(500).json({
        success: false,
        error: 'Error al generar métricas y KPIs',
        details: error.message
      });
    }
  }

  /**
   * Historial de auditoría forense
   * GET /api/analytics/audit-log
   */
  public static async getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const { 
        eventType, 
        userId, 
        search, 
        dateFrom, 
        dateTo, 
        limit = '100', 
        offset = '0' 
      } = req.query;

      const where: any = {};

      if (eventType && typeof eventType === 'string' && eventType !== 'TODOS') {
        where.eventType = eventType as AuditEventType;
      }

      if (userId && typeof userId === 'string') {
        where.userId = userId;
      }

      if (dateFrom || dateTo) {
        where.timestamp = {};
        if (dateFrom) where.timestamp.gte = new Date(String(dateFrom));
        if (dateTo) where.timestamp.lte = new Date(String(dateTo));
      }

      if (search && typeof search === 'string') {
        const q = search.trim();
        where.OR = [
          { macAddress: { contains: q, mode: 'insensitive' } },
          { serialNumber: { contains: q, mode: 'insensitive' } },
          { batchNumber: { contains: q, mode: 'insensitive' } },
          { details: { contains: q, mode: 'insensitive' } },
          { user: { name: { contains: q, mode: 'insensitive' } } },
          { fromWarehouse: { name: { contains: q, mode: 'insensitive' } } },
          { toWarehouse: { name: { contains: q, mode: 'insensitive' } } }
        ];
      }

      const take = Math.min(Number(limit) || 100, 200);
      const skip = Number(offset) || 0;

      const [logs, totalCount] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true }
            },
            fromWarehouse: true,
            toWarehouse: true
          },
          orderBy: {
            timestamp: 'desc'
          },
          take,
          skip
        }),
        prisma.auditLog.count({ where })
      ]);

      res.status(200).json({
        success: true,
        count: logs.length,
        total: totalCount,
        logs
      });
    } catch (error: any) {
      console.error('Error al consultar logs de auditoría:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno al consultar logs de auditoría',
        details: error.message
      });
    }
  }
}
