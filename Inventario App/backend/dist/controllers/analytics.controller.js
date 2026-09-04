"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsController = void 0;
const db_1 = require("../db");
const client_1 = require("@prisma/client");
class AnalyticsController {
    /**
     * Métricas gerenciales y KPIs clave
     * GET /api/analytics/kpis
     */
    static async getKPIs(req, res) {
        try {
            const now = new Date();
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            // 1. ONUs Activas (En Bodegas y en Vehículos)
            const totalActiveOnus = await db_1.prisma.serializedItem.count({
                where: {
                    status: {
                        in: [client_1.SerializedStatus.EN_BODEGA, client_1.SerializedStatus.EN_VEHICULO]
                    }
                }
            });
            // 2. ONUs Instaladas en Clientes
            const totalInstalledOnus = await db_1.prisma.serializedItem.count({
                where: {
                    status: client_1.SerializedStatus.INSTALADO_CLIENTE
                }
            });
            // 3. Equipos en Cuarentena / RMA Defectuoso
            const totalQuarantineOnus = await db_1.prisma.serializedItem.count({
                where: {
                    status: client_1.SerializedStatus.RMA_DEFECTUOSO
                }
            });
            // 4. Consumo de Cable Drop del Mes Actual (Suma de metros en InstallationTicket)
            const monthlyTickets = await db_1.prisma.installationTicket.findMany({
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
            const monthlyCableConsumption = monthlyTickets.reduce((sum, t) => sum + (t.cableDropMetersUsed || 0), 0);
            // 5. Consumo diario de los últimos 7 días
            const dailyCableConsumption7d = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                d.setHours(0, 0, 0, 0);
                const nextD = new Date(d);
                nextD.setDate(nextD.getDate() + 1);
                const dayTickets = await db_1.prisma.installationTicket.findMany({
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
            const techCounts = {};
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
                const defaultTechs = await db_1.prisma.user.findMany({
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
            const totalWarehouses = await db_1.prisma.warehouse.count();
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
        }
        catch (error) {
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
    static async getAuditLogs(req, res) {
        try {
            const { eventType, userId, search, dateFrom, dateTo, limit = '100', offset = '0' } = req.query;
            const where = {};
            if (eventType && typeof eventType === 'string' && eventType !== 'TODOS' && eventType !== 'undefined' && eventType !== 'null') {
                where.eventType = eventType;
            }
            if (userId && typeof userId === 'string' && userId !== 'undefined' && userId !== 'null') {
                where.userId = userId;
            }
            const timestampFilter = {};
            if (dateFrom && typeof dateFrom === 'string' && dateFrom !== 'undefined') {
                const d = new Date(dateFrom);
                if (!isNaN(d.getTime())) {
                    timestampFilter.gte = d;
                }
            }
            if (dateTo && typeof dateTo === 'string' && dateTo !== 'undefined') {
                const d = new Date(dateTo);
                if (!isNaN(d.getTime())) {
                    timestampFilter.lte = d;
                }
            }
            if (Object.keys(timestampFilter).length > 0) {
                where.timestamp = timestampFilter;
            }
            if (search && typeof search === 'string' && search.trim() !== '' && search !== 'undefined' && search !== 'null') {
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
                db_1.prisma.auditLog.findMany({
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
                db_1.prisma.auditLog.count({ where })
            ]);
            res.status(200).json({
                success: true,
                count: logs.length,
                total: totalCount,
                logs
            });
        }
        catch (error) {
            console.error('Error al consultar logs de auditoría:', error);
            res.status(500).json({
                success: false,
                error: 'Error interno al consultar logs de auditoría',
                details: error.message
            });
        }
    }
}
exports.AnalyticsController = AnalyticsController;
