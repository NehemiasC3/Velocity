import dotenv from 'dotenv';
import { db } from '../db';
import { WisproClient } from '../types';

// Cargar variables de entorno desde el archivo .env
dotenv.config();

const wisproApiUrl = process.env.WISPRO_API_URL;
const wisproApiToken = process.env.WISPRO_API_TOKEN;

interface WisproPaginatedResponse {
  data: any[];
  meta: {
    pagination: {
      total_pages: number;
    };
  };
}

export interface ProvisionOnuDTO {
  contractId: string;
  onuMac: string;
  onuSerial?: string;
  technicianName: string;
  notes?: string;
}

export interface WisproSyncResult {
  success: boolean;
  message: string;
  clientsSynced: number;
  timestamp: string;
}

export interface LightInventoryItem {
  id: string;
  client_name: string;
  ip: string;
  mac: string;
  address: string;
  status: string;
}

class WisproService {
  // Cache en memoria para el inventario
  private inventoryCache: LightInventoryItem[] = [];
  private inventoryCacheTimestamp: number = 0;
  // 15 minutos de vida para la caché
  private CACHE_TTL_MS = 15 * 60 * 1000;

  constructor() {
    if (!wisproApiUrl || !wisproApiToken) {
      console.warn('WISPRO_SERVICE: Las variables de entorno WISPRO_API_URL y WISPRO_API_TOKEN no están definidas. El servicio usará datos de prueba.');
    }
  }

  private async wisproApiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Si no hay token, no se puede hacer la petición real
    if (!wisproApiToken || !wisproApiUrl) {
      throw new Error('El token o la URL de la API de Wispro no está configurado en el archivo .env');
    }

    const url = `${wisproApiUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${wisproApiToken}`,
      ...(options.headers as Record<string, string> || {})
    };

    try {
      const res = await fetch(url, { ...options, headers });

      if (!res.ok) {
        const errorBody = await res.text();
        console.error(`Error en API de Wispro (${res.status}): ${errorBody}`);
        throw new Error(`Error en la API de Wispro: ${res.statusText}`);
      }

      // Si la respuesta no tiene contenido (ej. un 204 No Content)
      if (res.status === 204) {
        return {} as T;
      }

      return await res.json();
    } catch (err: any) {
      console.error(`WISPRO_SERVICE: Fallo en la petición a ${url}`, err);
      throw new Error(`No se pudo comunicar con la API de Wispro: ${err.message}`);
    }
  }

  /**
   * Obtiene el inventario completo de clientes/equipos desde Wispro,
   * manejando la paginación de forma automática.
   * Utiliza una caché en memoria para evitar peticiones repetidas.
   */
  public async getFullInventory(): Promise<LightInventoryItem[]> {
    // Si no hay configuración de API, devolvemos datos de prueba para desarrollo
    if (!wisproApiUrl || !wisproApiToken) {
      console.log('WISPRO_SERVICE: Devolviendo datos de clientes de prueba (mock).');
      return db.getWisproClients().map(c => ({ id: c.id, client_name: c.name, ip: c.planName, mac: c.currentOnuMac || 'N/A', address: c.address, status: c.status }));
    }

    const now = Date.now();
    if (this.inventoryCache.length > 0 && (now - this.inventoryCacheTimestamp < this.CACHE_TTL_MS)) {
      console.log('WISPRO_SERVICE: Devolviendo inventario desde caché.');
      return this.inventoryCache;
    }

    console.log('WISPRO_SERVICE: Caché expirada o vacía. Obteniendo inventario completo desde la API de Wispro...');
    
    try {
      // Primera petición para obtener el total de páginas
      const firstPageResponse = await this.wisproApiRequest<WisproPaginatedResponse>('/clients?per_page=100&page=1');
      const totalPages = firstPageResponse.meta.pagination.total_pages;
      let allClients = firstPageResponse.data;

      // Si hay más de una página, creamos un array de promesas para el resto
      if (totalPages > 1) {
        const pagePromises: Promise<WisproPaginatedResponse>[] = [];
        for (let page = 2; page <= totalPages; page++) {
          pagePromises.push(
            this.wisproApiRequest<WisproPaginatedResponse>(`/clients?per_page=100&page=${page}`)
          );
        }
        
        const subsequentPages = await Promise.all(pagePromises);
        subsequentPages.forEach(pageResponse => {
          allClients = allClients.concat(pageResponse.data);
        });
      }

      console.log(`WISPRO_SERVICE: Se obtuvieron ${allClients.length} registros en total de Wispro.`);

      // Mapeamos a la estructura ligera que necesita el frontend
      const lightInventory = allClients.map((client: any): LightInventoryItem => ({
        id: client.id,
        client_name: client.name,
        ip: client.ip || 'N/A',
        mac: client.onu?.mac_address || 'Sin ONU',
        address: client.address || 'Sin dirección',
        status: client.status.name || 'Desconocido',
      }));

      // Actualizamos la caché
      this.inventoryCache = lightInventory;
      this.inventoryCacheTimestamp = now;
      console.log('WISPRO_SERVICE: Caché de inventario actualizada.');

      return lightInventory;

    } catch (error: any) {
      console.error('WISPRO_SERVICE: Error fatal obteniendo inventario completo de Wispro:', error);
      // Si falla, pero tenemos una caché vieja, la devolvemos para mantener la app funcional
      if (this.inventoryCache.length > 0) {
        console.warn('WISPRO_SERVICE: Devolviendo caché antigua debido a un error en la API.');
        return this.inventoryCache;
      }
      throw new Error(`No se pudo obtener el inventario de Wispro: ${error.message}`);
    }
  }

  /**
   * Obtiene la lista de clientes activos o pendientes desde Wispro
   */
  public async getClients(filter?: { status?: string; search?: string }): Promise<WisproClient[]> {
    // Esta función ahora puede usar el inventario completo para buscar
    const fullInventory = await this.getFullInventory();
    let results = fullInventory;

    // Aplicar filtros si existen
    if (filter?.status) {
      results = results.filter(c => c.status.toLowerCase() === filter.status?.toLowerCase());
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      results = results.filter(c => c.client_name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q));
    }

    // Mapear al formato WisproClient que espera el resto de la app
    return results.map(item => ({
      id: item.id,
      name: item.client_name,
      status: item.status,
      address: item.address,
      contractId: `(Contrato de ${item.id})`, // Dato a completar si es necesario desde otra llamada
      planName: `(Plan de ${item.id})`,
      nodeName: `(Nodo de ${item.id})`,
      currentOnuMac: item.mac,
    }));
  }

  /**
   * Sincroniza la base de datos de clientes con Wispro API (GET /api/v1/clients o contracts)
   */
  public async syncWithWispro(): Promise<WisproSyncResult> {
    // Forzar la actualización de la caché
    this.inventoryCache = []; 
    const inventory = await this.getFullInventory();
    const timestamp = new Date().toISOString();

    return {
      success: true,
      message: `Sincronización exitosa con Wispro Cloud. ${inventory.length} clientes y contratos actualizados.`,
      clientsSynced: inventory.length,
      timestamp
    };
  }

  /**
   * Aprovisionamiento en Wispro (PUT /api/v1/contracts/{id})
   * Inyecta la MAC de la ONU en los datos técnicos del contrato del cliente
   */
  public async provisionOnuToContract(payload: ProvisionOnuDTO): Promise<{
    success: boolean;
    contractId: string;
    wisproResponseCode: number;
    message: string;
    details: any;
  }> {
    const { contractId, onuMac, onuSerial, technicianName, notes } = payload;
    
    const client = (await this.getFullInventory()).find(c => c.id === contractId);

    if (!client) {
      return {
        success: false,
        contractId,
        wisproResponseCode: 404,
        message: `Contrato ${contractId} no encontrado en Wispro.`,
        details: null
      };
    }

    // Si tenemos API real, hacemos la llamada a Wispro
    if (wisproApiToken) {
      try {
        const wisproResponse = await this.wisproApiRequest(`/contracts/${contractId}/provision_onu`, {
          method: 'POST',
          body: JSON.stringify({
            mac: onuMac,
            notes: `Instalado por ${technicianName}. ${notes || ''}`
          })
        });
        
        // Forzar actualización de caché la próxima vez
        this.inventoryCache = [];

        return { success: true, contractId, wisproResponseCode: 200, message: 'ONU aprovisionada en Wispro con éxito.', details: wisproResponse };
      } catch (error: any) {
        return { success: false, contractId, wisproResponseCode: 500, message: `Fallo al aprovisionar en Wispro: ${error.message}`, details: error };
      }
    }

    // --- SIMULACIÓN SI NO HAY API TOKEN ---
    const simulatedWisproResponse = {
      status: 200,
      wispro_contract: {
        id: contractId,
        client_id: client.id,
        client_name: client.name,
        plan: client.planName,
        technical_data: {
          onu_mac_address: onuMac,
          onu_serial_number: onuSerial || 'N/A',
          provisioned_by: technicianName,
          provisioned_at: new Date().toISOString(),
          port_status: 'ONLINE',
          rx_power_dbm: -19.5,
          tx_power_dbm: 2.3
        },
        service_state: 'ACTIVE'
      },
      msg: 'Contrato actualizado exitosamente en Wispro Cloud. ONU autorizada en OLT.'
    };

    return {
      success: true,
      contractId,
      wisproResponseCode: 200,
      message: `(SIMULADO) MAC ${onuMac} inyectada en Wispro para el contrato ${contractId} (${client.client_name}).`,
      details: simulatedWisproResponse
    };
  }
}

export const wisproService = new WisproService();
