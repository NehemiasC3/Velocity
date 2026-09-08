import { Request, Response } from 'express';
import { WisproService } from '../services/wispro.service';

export class WisproController {
  /**
   * Endpoint de Sincronización Diferencial REST con Wispro
   * POST /api/wispro/sync
   */
  public static async syncWispro(req: Request, res: Response): Promise<void> {
    try {
      console.log('[WisproController] Recibida solicitud POST /api/wispro/sync');
      const forceFull = req.query.force === 'true' || req.body?.forceFullDump === true;
      const result = await WisproService.syncWisproContractsIncremental({ forceFullDump: forceFull });
      res.status(200).json(result);
    } catch (error: any) {
      console.error('Error en sincronización con Wispro:', error);
      res.status(500).json({
        success: false,
        error: 'Error al sincronizar con Wispro',
        details: error.message
      });
    }
  }

  /**
   * Consulta 100% Local de Contratos sobre PostgreSQL (Sub-20ms)
   * GET /api/wispro/contracts
   */
  public static async getContracts(req: Request, res: Response): Promise<void> {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const isAll = req.query.per_page === 'ALL' || req.query.limit === 'ALL' || req.query.all === 'true' || req.query.loadAll === 'true';
      const perPage = isAll ? 'ALL' : Math.min(200, Math.max(1, Number(req.query.per_page || req.query.limit) || 50));
      const loadAll = isAll;
      const search = req.query.search ? String(req.query.search) : undefined;
      const filterState = req.query.filterState ? String(req.query.filterState) : (req.query.state ? String(req.query.state) : undefined);
      const filterSerial = req.query.filterSerial ? String(req.query.filterSerial) : undefined;
      const filterNap = req.query.filterNap ? String(req.query.filterNap) : undefined;
      const sortOrder = (req.query.sortOrder === 'asc' || req.query.order === 'asc') ? 'asc' : 'desc';

      const result = await WisproService.getLocalContracts({
        page,
        perPage,
        loadAll,
        search,
        filterState,
        filterSerial,
        filterNap,
        sortOrder
      });

      res.status(200).json({
        success: true,
        count: result.contracts.length,
        total: result.total,
        page: result.page,
        perPage: result.perPage,
        totalPages: result.totalPages,
        lastSyncedAt: result.lastSyncedAt,
        source: 'PostgreSQL Local Mirror',
        kpis: result.kpis,
        contracts: result.contracts
      });
    } catch (error: any) {
      console.error('Error consultando contratos locales:', error);
      res.status(500).json({
        success: false,
        error: 'Error al consultar contratos',
        details: error.message
      });
    }
  }

  /**
   * Obtiene la lista de contratos activos desde PostgreSQL Local Mirror
   * GET /api/wispro/contracts/active (Alias a getContracts)
   */
  public static async getActiveContracts(req: Request, res: Response): Promise<void> {
    return WisproController.getContracts(req, res);
  }

  /**
   * Obtiene el detalle de un contrato específico
   * GET /api/wispro/contracts/:id
   */
  public static async getContractDetails(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const contract = await WisproService.fetchContractDetails(id);
      if (!contract) {
        res.status(404).json({
          success: false,
          error: `Contrato ${id} no encontrado`
        });
        return;
      }
      res.status(200).json({
        success: true,
        contract
      });
    } catch (error: any) {
      console.error('Error obteniendo detalle de contrato:', error);
      res.status(500).json({
        success: false,
        error: 'Error al consultar contrato',
        details: error.message
      });
    }
  }

  /**
   * Obtiene los tickets abiertos enriquecidos con técnicos y vehículos de Prisma
   * GET /api/wispro/tickets/open
   */
  public static async getOpenTickets(req: Request, res: Response): Promise<void> {
    try {
      const tickets = await WisproService.fetchOpenTickets();
      res.status(200).json({
        success: true,
        count: tickets.length,
        tickets
      });
    } catch (error: any) {
      console.error('Error obteniendo tickets de Wispro:', error);
      res.status(500).json({
        success: false,
        error: 'Error al consultar tickets abiertos',
        details: error.message
      });
    }
  }

  /**
   * Obtiene las instalaciones pendientes enriquecidas con Prisma
   * GET /api/wispro/installations/pending
   */
  public static async getPendingInstallations(req: Request, res: Response): Promise<void> {
    try {
      const installations = await WisproService.fetchPendingInstallations();
      res.status(200).json({
        success: true,
        count: installations.length,
        installations
      });
    } catch (error: any) {
      console.error('Error obteniendo instalaciones de Wispro:', error);
      res.status(500).json({
        success: false,
        error: 'Error al consultar instalaciones pendientes',
        details: error.message
      });
    }
  }

  /**
   * Endpoint de Asignación Bidireccional (Drag & Drop)
   * PUT /api/wispro/assign
   */
  public static async assignTicket(req: Request, res: Response): Promise<void> {
    try {
      const { ticketId, contractId, type = 'TICKET', technicianId } = req.body;
      const targetId = ticketId || contractId;

      if (!targetId || !technicianId) {
        res.status(400).json({
          success: false,
          error: 'ticketId y technicianId son obligatorios'
        });
        return;
      }

      const result = await WisproService.assignTicket({
        ticketId: targetId,
        type,
        technicianId
      });

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Error asignando ticket en Wispro:', error);
      res.status(500).json({
        success: false,
        error: 'Error al asignar el ticket',
        details: error.message
      });
    }
  }
}
