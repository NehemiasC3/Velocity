import { Request, Response } from 'express';
import axios from 'axios';

const INVENTORY_API_URL = (
  process.env.INVENTORY_API_URL ||
  (process.env.NODE_ENV === 'production' ? 'http://inventory-backend:4000/api' : 'http://127.0.0.1:4000/api')
).replace(/\/+$/, '');

export class ContractsController {
  /**
   * Endpoint principal /api/contracts y /api/wispro/contracts/active:
   * Consulta directa al servicio de inventario PostgreSQL vía Prisma con respuesta sub-50ms
   */
  public static async getContracts(req: Request, res: Response): Promise<void> {
    try {
      const query = req.originalUrl.includes('?') ? req.originalUrl.split('?')[1] : '';
      const url = `${INVENTORY_API_URL}/contracts${query ? '?' + query : ''}`;

      const response = await axios.get(url, {
        timeout: 10000,
        validateStatus: () => true,
        headers: {
          Accept: 'application/json'
        }
      });

      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error('[ContractsController ❌] Error conectando con backend de PostgreSQL (Puerto 4000):', error.message);
      res.status(502).json({
        success: false,
        error: 'Gateway Error',
        message: `No se pudo consultar contratos desde la base de datos PostgreSQL: ${error.message}`
      });
    }
  }

  /**
   * Consulta de un contrato específico por ID
   */
  public static async getContractById(req: Request, res: Response): Promise<void> {
    try {
      const id = encodeURIComponent(req.params.id);
      const url = `${INVENTORY_API_URL}/contracts/${id}`;

      const response = await axios.get(url, {
        timeout: 10000,
        validateStatus: () => true,
        headers: {
          Accept: 'application/json'
        }
      });

      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error(`[ContractsController ❌] Error al consultar contrato ${req.params.id}:`, error.message);
      res.status(502).json({
        success: false,
        error: 'Gateway Error',
        message: error.message
      });
    }
  }

  /**
   * Sincronización en segundo plano con Wispro (POST /api/wispro/sync)
   */
  public static async syncWispro(req: Request, res: Response): Promise<void> {
    try {
      const query = req.originalUrl.includes('?') ? req.originalUrl.split('?')[1] : '';
      const url = `${INVENTORY_API_URL}/wispro/sync${query ? '?' + query : ''}`;

      const response = await axios.post(url, req.body || {}, {
        timeout: 10000,
        validateStatus: () => true,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      });

      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error('[ContractsController ❌] Error conectando con endpoint de sincronización:', error.message);
      res.status(502).json({
        success: false,
        error: 'Gateway Error',
        message: `No se pudo iniciar sincronización en el servicio de inventario: ${error.message}`
      });
    }
  }
}
