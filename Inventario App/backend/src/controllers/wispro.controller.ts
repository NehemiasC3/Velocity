import { Request, Response } from 'express';
import { WisproService } from '../services/wispro.service';

export class WisproController {
  private static isSyncing = false;

  /**
   * Endpoint de Sincronización Diferencial REST con Wispro en Segundo Plano (Seeding / Sync)
   * POST /api/wispro/sync
   * No bloquea la respuesta HTTP del usuario; ejecuta la descarga e inserción en background.
   */
  public static async syncWispro(req: Request, res: Response): Promise<void> {
    try {
      console.log('[WisproController] Recibida solicitud POST /api/wispro/sync');
      const forceFull = req.query.force === 'true' || req.body?.forceFullDump === true;
      const wait = req.query.wait === 'true';

      if (WisproController.isSyncing) {
        res.status(200).json({
          success: true,
          status: 'running',
          message: 'La sincronización con Wispro ya se encuentra en ejecución en segundo plano.'
        });
        return;
      }

      if (wait) {
        WisproController.isSyncing = true;
        try {
          const result = await WisproService.syncWisproContractsIncremental({ forceFullDump: forceFull });
          res.status(200).json(result);
        } finally {
          WisproController.isSyncing = false;
        }
        return;
      }

      // Sincronización asíncrona en segundo plano sin bloquear al cliente
      WisproController.isSyncing = true;
      setImmediate(async () => {
        try {
          console.log('[WisproController 🚀] Iniciando sincronización en background...');
          const result = await WisproService.syncWisproContractsIncremental({ forceFullDump: forceFull });
          console.log('[WisproController ✅] Sincronización background completada exitosamente:', result.message);
        } catch (bgError: any) {
          console.error('[WisproController ❌] Error en sincronización background:', bgError.message);
        } finally {
          WisproController.isSyncing = false;
        }
      });

      res.status(200).json({
        success: true,
        status: 'started',
        message: 'Sincronización con Wispro Cloud iniciada en segundo plano sin bloquear el sistema.'
      });
    } catch (error: any) {
      console.error('Error al iniciar sincronización con Wispro:', error);
      res.status(500).json({
        success: false,
        error: 'Error al iniciar sincronización con Wispro',
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
