/**
 * Representa la entidad limpia de inventario para equipos de ISP.
 */
export interface InventoryItem {
  id: string;
  client_name: string;
  ip: string;
  mac: string;
  serial_number: string;
  model: string;
  status: 'active' | 'disabled' | 'pending' | 'suspended' | 'unknown' | string;
  address: string;
}

/**
 * Respuesta tipada para el endpoint de inventario.
 */
export interface InventoryApiResponse {
  success: boolean;
  count: number;
  cached: boolean;
  timestamp: string;
  data: InventoryItem[];
}
