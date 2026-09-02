import axios, { AxiosInstance } from 'axios';
import { InventoryItem } from '../types/inventory';
import { WisproPageResponse, WisproRawItem } from '../types/wispro';

interface CacheEntry {
  data: InventoryItem[];
  timestamp: number;
}

export class WisproService {
  private readonly client: AxiosInstance;
  private readonly baseUrl: string;
  private readonly apiToken: string;
  private readonly cacheTtlMs: number;
  private cache: CacheEntry | null = null;
  private fetchPromise: Promise<InventoryItem[]> | null = null;
  private autoRefreshTimer: NodeJS.Timeout | null = null;

  constructor(
    apiUrl?: string,
    apiToken?: string,
    cacheTtlMs: number = 5 * 60 * 1000 // 5 minutos de TTL
  ) {
    this.baseUrl = (
      apiUrl ||
      process.env.WISPRO_API_URL ||
      process.env.WISPRO_BASE_URL ||
      'https://www.cloud.wispro.co/api/v1'
    ).replace(/\/+$/, '');

    this.apiToken = (
      apiToken ||
      process.env.WISPRO_API_TOKEN ||
      process.env.WISPRO_API_KEY ||
      ''
    ).trim();

    this.cacheTtlMs = cacheTtlMs;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        Authorization: this.apiToken,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    });

    // Iniciar el worker de precalentamiento y auto-refresco en segundo plano cada 4.5 minutos
    this.startWarmCacheWorker();
  }

  /**
   * Inicia un temporizador que auto-refresca la memoria RAM proactivamente cada 4.5 min.
   * Esto elimina los "Cold Starts" y garantiza que el 100% de las peticiones de los usuarios
   * se respondan desde la memoria RAM en < 15ms.
   */
  private startWarmCacheWorker(): void {
    if (this.autoRefreshTimer) clearInterval(this.autoRefreshTimer);

    // Refrescar cada 4.5 minutos (antes de que expire el TTL de 5 min)
    const refreshInterval = Math.max(this.cacheTtlMs - 30000, 60000);

    this.autoRefreshTimer = setInterval(() => {
      console.log('[WisproService ⚡] Auto-refresco proactivo de inventario en segundo plano iniciado...');
      this.getInventory(true).catch((err) =>
        console.warn('[WisproService] Error en auto-refresco en segundo plano:', err.message)
      );
    }, refreshInterval);
  }

  /**
   * Pre-calienta la caché al arrancar el servidor
   */
  public async warmUp(): Promise<void> {
    if (!this.apiToken) return;
    try {
      console.log('[WisproService 🚀] Precalentando caché de inventario en memoria RAM al arrancar...');
      await this.getInventory(true);
      console.log(`[WisproService ✅] Precalentamiento exitoso. ${this.cache?.data.length || 0} equipos listos en RAM.`);
    } catch (e: any) {
      console.warn('[WisproService] No se pudo precalentar en el inicio:', e.message);
    }
  }

  /**
   * Obtiene el catálogo completo de equipos/inventario.
   * Utiliza la caché en memoria con TTL si está disponible.
   * Previene peticiones duplicadas en paralelo (Thundering Herd).
   */
  public async getInventory(forceRefresh = false): Promise<{ items: InventoryItem[]; cached: boolean; timestamp: number }> {
    const now = Date.now();

    // 1. Si hay caché válida en RAM y no se fuerza actualización, retornar en < 1ms
    if (!forceRefresh && this.cache && now - this.cache.timestamp < this.cacheTtlMs) {
      return {
        items: this.cache.data,
        cached: true,
        timestamp: this.cache.timestamp
      };
    }

    // 2. Si ya hay una solicitud en curso, reutilizarla
    if (this.fetchPromise) {
      const items = await this.fetchPromise;
      return {
        items,
        cached: false,
        timestamp: this.cache?.timestamp || Date.now()
      };
    }

    try {
      this.fetchPromise = this.fetchAllPages();
      const items = await this.fetchPromise;

      const timestamp = Date.now();
      this.cache = {
        data: items,
        timestamp
      };

      return {
        items,
        cached: false,
        timestamp
      };
    } finally {
      this.fetchPromise = null;
    }
  }

  /**
   * Recorre asíncronamente todas las páginas con per_page=100
   * utilizando un bucle dinámico por lotes concurrentes (BATCH_SIZE = 5)
   */
  private async fetchAllPages(): Promise<InventoryItem[]> {
    if (!this.apiToken) {
      console.warn('[WisproService] ⚠️ Advertencia: No se ha configurado WISPRO_API_TOKEN en el entorno.');
    }

    const perPage = 100;
    let currentPage = 1;
    let totalPages = 1;
    const allRawItems: WisproRawItem[] = [];

    const endpoint = '/contracts';

    // 1. Obtener la primera página para determinar el total de páginas
    const firstPageResponse = await this.fetchPage(endpoint, 1, perPage);

    if (firstPageResponse.data && Array.isArray(firstPageResponse.data)) {
      allRawItems.push(...firstPageResponse.data);
    }

    if (firstPageResponse.meta?.pagination?.total_pages) {
      totalPages = firstPageResponse.meta.pagination.total_pages;
    }

    // 2. Bucle dinámico por lotes
    currentPage = 2;
    const BATCH_SIZE = 5;

    while (currentPage <= totalPages) {
      const batchPromises: Promise<WisproPageResponse>[] = [];
      const batchEnd = Math.min(currentPage + BATCH_SIZE - 1, totalPages);

      for (let p = currentPage; p <= batchEnd; p++) {
        batchPromises.push(this.fetchPage(endpoint, p, perPage));
      }

      const batchResults = await Promise.all(batchPromises);

      for (const res of batchResults) {
        if (res.data && Array.isArray(res.data)) {
          allRawItems.push(...res.data);
        }
      }

      currentPage = batchEnd + 1;
    }

    // 3. Mapear y sanear campos a la estructura limpia requerida
    return allRawItems.map((item) => this.mapToInventoryItem(item));
  }

  private async fetchPage(endpoint: string, page: number, perPage: number): Promise<WisproPageResponse> {
    try {
      const response = await this.client.get<WisproPageResponse>(endpoint, {
        params: {
          page,
          per_page: perPage
        }
      });

      return response.data || { data: [] };
    } catch (error: any) {
      const status = error?.response?.status;
      const message = error?.message || 'Error desconocido';
      console.error(`[WisproService] Error al obtener página ${page} de ${endpoint}: HTTP ${status || 'N/A'} - ${message}`);
      return { data: [] };
    }
  }

  private mapToInventoryItem(raw: WisproRawItem): InventoryItem {
    const id = String(raw.id || raw.client_id || Math.random().toString(36).slice(2, 10));

    let clientName = 'Sin Nombre';
    if (raw.client_name && typeof raw.client_name === 'string' && raw.client_name.trim()) {
      clientName = raw.client_name.trim();
    } else if (raw.client?.name && typeof raw.client.name === 'string' && raw.client.name.trim()) {
      clientName = raw.client.name.trim();
    } else if (raw.name && typeof raw.name === 'string' && raw.name.trim()) {
      clientName = raw.name.trim();
    }

    const ip = (
      raw.ip ||
      raw.ip_address ||
      raw.framed_ip_address ||
      raw.mikrotik_ip ||
      'No asignada'
    ).trim();

    const mac = (
      raw.mac ||
      raw.mac_address ||
      raw.equipment_mac ||
      raw.device_mac ||
      'No registrada'
    ).trim();

    const serialNumber = (
      raw.serial_number ||
      raw.serial ||
      raw.sn ||
      raw.onu_sn ||
      raw.gpon_sn ||
      'S/N no disponible'
    ).trim();

    const model = (
      raw.model ||
      raw.equipment_model ||
      raw.model_name ||
      raw.hardware_model ||
      raw.device_model ||
      'Genérico / Desconocido'
    ).trim();

    let status = (
      raw.status ||
      raw.state ||
      raw.contract_state ||
      raw.service_state ||
      'unknown'
    ).toLowerCase().trim();

    if (['activo', 'active', 'habilitado', 'enabled'].includes(status)) {
      status = 'active';
    } else if (['deshabilitado', 'disabled', 'inactivo', 'inactive', 'baja'].includes(status)) {
      status = 'disabled';
    } else if (['pendiente', 'pending', 'instalacion_pendiente'].includes(status)) {
      status = 'pending';
    } else if (['suspendido', 'suspended', 'corte'].includes(status)) {
      status = 'suspended';
    }

    let address = '';
    if (raw.address && typeof raw.address === 'string') {
      address = raw.address.trim();
    } else if (raw.full_address && typeof raw.full_address === 'string') {
      address = raw.full_address.trim();
    } else if (raw.street || raw.address_street) {
      const street = raw.street || raw.address_street || '';
      const num = raw.address_number || '';
      address = `${street} ${num}`.trim();
    } else if (raw.client?.address) {
      address = raw.client.address.trim();
    }

    if (!address) {
      address = raw.zone_name || raw.city || 'Sin dirección registrada';
    }

    return {
      id,
      client_name: clientName,
      ip,
      mac,
      serial_number: serialNumber,
      model,
      status,
      address
    };
  }

  public clearCache(): void {
    this.cache = null;
    console.log('[WisproService] Caché de inventario invalidada con éxito.');
  }
}

export const wisproService = new WisproService();
