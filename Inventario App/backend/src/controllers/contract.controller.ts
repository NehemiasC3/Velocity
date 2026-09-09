import { Request, Response } from 'express';
import { WisproService } from '../services/wispro.service';

export class ContractController {
  /**
   * Endpoint principal /api/contracts:
   * Consulta directa a PostgreSQL vía Prisma con paginación local y sub-50ms de latencia.
   * GET /api/contracts
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
        source: 'PostgreSQL Local Mirror (Prisma)',
        kpis: result.kpis,
        contracts: result.contracts
      });
    } catch (error: any) {
      console.error('Error consultando contratos locales en PostgreSQL:', error);
      res.status(500).json({
        success: false,
        error: 'Error al consultar contratos',
        details: error.message
      });
    }
  }

  /**
   * Alias de conveniencia para contratos activos
   * GET /api/contracts/active
   */
  public static async getActiveContracts(req: Request, res: Response): Promise<void> {
    return ContractController.getContracts(req, res);
  }

  /**
   * Obtiene el detalle de un contrato específico desde PostgreSQL
   * GET /api/contracts/:id
   */
  public static async getContractDetails(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const contract = await WisproService.fetchContractDetails(id);
      if (!contract) {
        res.status(404).json({
          success: false,
          error: `Contrato ${id} no encontrado en la base de datos local`
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
}
