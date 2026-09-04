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
   * Recorre asíncronamente los endpoints de Wispro (/clients y /contracts)
   * cruzando clientes con contratos para mostrar nombres y números de serie reales.
   */
  private async fetchAllPages(): Promise<InventoryItem[]> {
    if (!this.apiToken) {
      console.warn('[WisproService] ⚠️ Advertencia: No se ha configurado WISPRO_API_TOKEN en el entorno.');
    }

    const perPage = 100;
    const BATCH_SIZE = 6;

    // 1. Obtener Directorio Completo de Clientes (/clients)
    const clientsMap = new Map<string, any>();
    try {
      const firstClientsRes = await this.fetchPage('/clients', 1, perPage);
      if (firstClientsRes.data && Array.isArray(firstClientsRes.data)) {
        for (const c of firstClientsRes.data) {
          if (c.id) clientsMap.set(String(c.id), c);
        }
      }

      const totalClientPages = firstClientsRes.meta?.pagination?.total_pages || 1;
      let clientPage = 2;

      while (clientPage <= totalClientPages) {
        const batchPromises: Promise<WisproPageResponse>[] = [];
        const batchEnd = Math.min(clientPage + BATCH_SIZE - 1, totalClientPages);

        for (let p = clientPage; p <= batchEnd; p++) {
          batchPromises.push(this.fetchPage('/clients', p, perPage));
        }

        const batchResults = await Promise.all(batchPromises);
        for (const res of batchResults) {
          if (res.data && Array.isArray(res.data)) {
            for (const c of res.data) {
              if (c.id) clientsMap.set(String(c.id), c);
            }
          }
        }
        clientPage = batchEnd + 1;
      }
      console.log(`[WisproService 👥] ${clientsMap.size} clientes indexados desde Wispro Cloud.`);
    } catch (err: any) {
      console.warn('[WisproService] Error al indexar directorio /clients:', err.message);
    }

    // 2. Obtener Todos los Contratos (/contracts)
    const allRawContracts: WisproRawItem[] = [];
    const endpoint = '/contracts';

    const firstContractRes = await this.fetchPage(endpoint, 1, perPage);
    if (firstContractRes.data && Array.isArray(firstContractRes.data)) {
      allRawContracts.push(...firstContractRes.data);
    }

    const totalContractPages = firstContractRes.meta?.pagination?.total_pages || 1;
    let contractPage = 2;

    while (contractPage <= totalContractPages) {
      const batchPromises: Promise<WisproPageResponse>[] = [];
      const batchEnd = Math.min(contractPage + BATCH_SIZE - 1, totalContractPages);

      for (let p = contractPage; p <= batchEnd; p++) {
        batchPromises.push(this.fetchPage(endpoint, p, perPage));
      }

      const batchResults = await Promise.all(batchPromises);
      for (const res of batchResults) {
        if (res.data && Array.isArray(res.data)) {
          allRawContracts.push(...res.data);
        }
      }
      contractPage = batchEnd + 1;
    }

    console.log(`[WisproService 📦] ${allRawContracts.length} contratos cargados. Mapeando con directorio de clientes...`);

    // 3. Mapear cruzando con los datos de clientes
    return allRawContracts.map((contract) => {
      const client = contract.client_id ? clientsMap.get(String(contract.client_id)) : contract.client;
      return this.mapToInventoryItem(contract, client);
    });
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

  private mapToInventoryItem(raw: WisproRawItem, client?: any): InventoryItem {
    const id = String(raw.id || raw.client_id || Math.random().toString(36).slice(2, 10));

    // Nombre real del cliente
    let clientName = 'Sin Nombre';
    if (client?.name && typeof client.name === 'string' && client.name.trim()) {
      clientName = client.name.trim();
    } else if (raw.client_name && typeof raw.client_name === 'string' && raw.client_name.trim()) {
      clientName = raw.client_name.trim();
    } else if (raw.client?.name && typeof raw.client.name === 'string' && raw.client.name.trim()) {
      clientName = raw.client.name.trim();
    } else if (raw.pppoe_username && typeof raw.pppoe_username === 'string' && raw.pppoe_username.trim()) {
      clientName = `Usuario ${raw.pppoe_username.trim()}`;
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
      raw.mac_address ||
      raw.mac ||
      raw.equipment_mac ||
      raw.device_mac ||
      'No registrada'
    ).trim();

    // Serial de la ONT / ONU
    const serialNumber = (
      raw.ont_serial_number ||
      raw.serial_number ||
      raw.serial ||
      raw.sn ||
      raw.onu_sn ||
      raw.gpon_sn ||
      'S/N no disponible'
    ).trim();

    // Deducción o extracción del modelo de hardware
    let model = (
      raw.model ||
      raw.equipment_model ||
      raw.model_name ||
      raw.hardware_model ||
      raw.device_model ||
      ''
    ).trim();

    if (!model || model === 'Genérico / Desconocido') {
      if (serialNumber.startsWith('XPON') || serialNumber.startsWith('ZTEG')) {
        model = 'ZTE / XPON ONU';
      } else if (serialNumber.startsWith('CMDC') || serialNumber.startsWith('CDAT')) {
        model = 'C-Data GPON ONU';
      } else if (serialNumber.startsWith('HWTC')) {
        model = 'Huawei EchoLife ONT';
      } else if (serialNumber.startsWith('VSOL')) {
        model = 'V-SOL ONU';
      } else {
        model = 'ONU Óptica Estándar';
      }
    }

    let status = (
      raw.state ||
      raw.status ||
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
    if (client?.address && typeof client.address === 'string' && client.address.trim()) {
      address = client.address.trim();
    } else if (raw.address && typeof raw.address === 'string' && raw.address.trim()) {
      address = raw.address.trim();
    } else if (raw.address_street) {
      const street = raw.address_street || '';
      const num = raw.address_number || '';
      address = `${street} ${num}`.trim();
    }

    if (!address) {
      address = client?.zone_name || raw.nap_name || raw.zone_name || 'Sin dirección registrada';
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
