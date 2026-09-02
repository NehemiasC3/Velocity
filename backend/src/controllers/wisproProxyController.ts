import { Request, Response } from 'express';
import axios from 'axios';

interface ProxyCacheEntry {
  timestamp: number;
  status: number;
  data: any;
}

export class WisproProxyController {
  private static cache: Record<string, ProxyCacheEntry> = {};
  private static readonly TTL_MS = 5 * 60 * 1000; // 5 minutos

  private static cleanCache(): void {
    const now = Date.now();
    Object.keys(WisproProxyController.cache).forEach((key) => {
      if (now - WisproProxyController.cache[key].timestamp > WisproProxyController.TTL_MS) {
        delete WisproProxyController.cache[key];
      }
    });
  }

  public static async handleProxy(req: Request, res: Response): Promise<void> {
    const apiPath = (req.params as any)[0] || '';
    const query = req.originalUrl.includes('?') ? req.originalUrl.split('?')[1] : '';
    const token = process.env.WISPRO_API_KEY || process.env.WISPRO_API_TOKEN || '';
    const baseUrl = (process.env.WISPRO_BASE_URL || process.env.WISPRO_API_URL || 'https://www.cloud.wispro.co/api/v1').replace(/\/+$/, '');

    const isGet = req.method === 'GET';
    const cacheKey = req.originalUrl;

    if (isGet) {
      WisproProxyController.cleanCache();
      const cached = WisproProxyController.cache[cacheKey];
      if (cached && Date.now() - cached.timestamp < WisproProxyController.TTL_MS) {
        res.status(cached.status).json(cached.data);
        return;
      }
    }

    try {
      const fullApiPath = apiPath.startsWith('/') ? apiPath.slice(1) : apiPath;
      const url = `${baseUrl}/${fullApiPath}${query ? '?' + query : ''}`;

      const axiosResponse = await axios({
        url,
        method: req.method as any,
        headers: {
          Authorization: token,
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        data: ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : undefined,
        validateStatus: () => true
      });

      const responseData = axiosResponse.data;

      if (isGet && axiosResponse.status === 200) {
        WisproProxyController.cache[cacheKey] = {
          timestamp: Date.now(),
          status: axiosResponse.status,
          data: responseData
        };
      } else if (!isGet) {
        // Invalidar caché relacionada ante mutaciones
        const pathParts = apiPath.split('/');
        const id = pathParts.find((p: string) => p && (!isNaN(Number(p)) || p.length > 10));
        if (id) {
          Object.keys(WisproProxyController.cache).forEach((k) => {
            if (k.includes(id)) {
              delete WisproProxyController.cache[k];
            }
          });
        }
      }

      res.status(axiosResponse.status).json(responseData);
    } catch (error: any) {
      console.error('[WisproProxyController] Error en Gateway:', error.message);
      res.status(500).json({
        error: 'Wispro Gateway Error',
        message: error.message
      });
    }
  }
}
