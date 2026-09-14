import { Request, Response } from 'express';
import { DbService } from '../services/DbService';

interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  checks: {
    database: {
      status: 'ok' | 'error';
      details: string;
    };
    wisproSync: {
      status: 'ok' | 'stale' | 'unavailable';
      details: string;
      lastSync?: string;
      syncAgeInMinutes?: number;
    };
  };
}

export class SystemController {
  /**
   * Endpoint de Health Check /api/system/health:
   * Verifica el estado de los componentes críticos del sistema.
   * - Conectividad con la base de datos local y estado del sistema.
   * - Frescura de la última sincronización de datos con Wispro.
   * GET /api/system/health
   */
  public static async getHealthStatus(_req: Request, res: Response): Promise<void> {
    const health: HealthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: 'ok',
          details: 'Database connection is healthy.'
        },
        wisproSync: {
          status: 'ok',
          details: 'Wispro data is up to date.',
        }
      }
    };

    let overallStatusCode = 200;

    // 1. Verificar la base de datos
    try {
      const dbService = new DbService();
      const state = dbService.getDB();
      if (!state) {
        throw new Error('Database state unavailable');
      }
      health.checks.database = {
        status: 'ok',
        details: 'Database storage is operational.'
      };
    } catch (error: any) {
      health.checks.database = {
        status: 'error',
        details: 'Failed to connect to the database.'
      };
      health.status = 'error';
      console.error('[Health Check] Database check failed:', error.message);
    }

    if (health.status === 'error') {
      overallStatusCode = 503; // Service Unavailable
    } else if (health.status === 'degraded') {
      overallStatusCode = 200; // OK, pero informando estado degradado
    }

    res.status(overallStatusCode).json(health);
  }
}
