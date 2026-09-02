import { 
  User, Warehouse, SerializedItem, BulkItem, BulkStock, 
  TransferOrder, InstallationTicket, AuditLog, WisproClient, 
  DashboardKPIs, TechnicianMetric 
} from '../types';

const API_BASE_URL = 'http://localhost:4000/api';

class ApiService {
  private activeUserId: string = 'usr-admin-1';

  public setActiveUserId(userId: string) {
    this.activeUserId = userId;
  }

  public getActiveUserId(): string {
    return this.activeUserId;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-id': this.activeUserId,
      ...(options.headers as Record<string, string> || {})
    };

    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Error en la petición' }));
        throw new Error(errData.error || `HTTP error ${res.status}`);
      }

      return await res.json();
    } catch (err: any) {
      console.error(`API Error on ${endpoint}:`, err);
      throw err;
    }
  }

  // Auth & Users
  public async getUsers(): Promise<{ users: User[] }> {
    return this.request('/auth/users');
  }

  public async getMe(): Promise<{ user: User }> {
    return this.request('/auth/me');
  }

  // Dashboard
  public async getDashboardKPIs(): Promise<DashboardKPIs> {
    return this.request('/dashboard/kpis');
  }

  // Warehouses
  public async getWarehouses(): Promise<{ warehouses: Warehouse[] }> {
    return this.request('/warehouses');
  }

  public async createWarehouse(data: Partial<Warehouse>): Promise<{ warehouse: Warehouse }> {
    return this.request('/warehouses', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Serialized Inventory
  public async getSerializedItems(params?: { warehouseId?: string; status?: string; search?: string }): Promise<{ items: SerializedItem[] }> {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/inventory/serialized${query ? `?${query}` : ''}`);
  }

  public async createSerializedItem(data: {
    macAddress: string;
    serialNumber: string;
    brand: string;
    model: string;
    category?: string;
    currentWarehouseId: string;
  }): Promise<{ item: SerializedItem }> {
    return this.request('/inventory/serialized', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public async createSerializedBatch(data: {
    items: { macAddress: string; serialNumber: string }[];
    brand: string;
    model: string;
    category?: string;
    targetWarehouseId: string;
  }): Promise<{ totalReceived: number; totalCreated: number; createdItems: SerializedItem[] }> {
    return this.request('/inventory/serialized/batch', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public async reportRMA(id: string, reason: string): Promise<{ item: SerializedItem }> {
    return this.request(`/inventory/serialized/${id}/rma`, {
      method: 'PATCH',
      body: JSON.stringify({ reason })
    });
  }

  // Bulk Inventory
  public async getBulkInventory(warehouseId?: string): Promise<{ items: BulkItem[]; stocks: BulkStock[] }> {
    return this.request(`/inventory/bulk${warehouseId ? `?warehouseId=${warehouseId}` : ''}`);
  }

  public async createBulkCatalogItem(data: {
    name: string;
    code: string;
    category: string;
    unitOfMeasure: string;
    minStockAlert?: number;
    description?: string;
    initialWarehouseId?: string;
    initialQuantity?: number;
  }): Promise<{ item: BulkItem }> {
    return this.request('/inventory/bulk/items', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public async adjustBulkStock(data: {
    warehouseId: string;
    bulkItemId: string;
    deltaQuantity: number;
    reason?: string;
  }): Promise<{ stock: BulkStock }> {
    return this.request('/inventory/bulk/adjust', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Transfers
  public async getTransfers(): Promise<{ transfers: TransferOrder[] }> {
    return this.request('/transfers');
  }

  public async createTransfer(data: {
    originWarehouseId: string;
    destinationWarehouseId: string;
    notes?: string;
    serializedItemIds: string[];
    bulkItems: { bulkItemId: string; quantity: number }[];
  }): Promise<{ transfer: TransferOrder }> {
    return this.request('/transfers', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public async receiveTransfer(orderId: string): Promise<{ transfer: TransferOrder }> {
    return this.request(`/transfers/${orderId}/receive`, {
      method: 'POST'
    });
  }

  // Forensic Audit
  public async searchForensicMAC(query: string): Promise<{
    found: boolean;
    item?: SerializedItem;
    clientData?: WisproClient;
    timeline: AuditLog[];
  }> {
    return this.request(`/audit/mac/${encodeURIComponent(query)}`);
  }

  public async getAuditLogs(): Promise<{ logs: AuditLog[] }> {
    return this.request('/audit/logs');
  }

  // Technician Mobile
  public async getMyVehicleStock(): Promise<{
    warehouse: Warehouse;
    serializedItems: SerializedItem[];
    bulkStocks: BulkStock[];
  }> {
    return this.request('/technician/my-vehicle');
  }

  public async closeTicket(data: {
    wisproClientId: string;
    installedOnuMac?: string;
    cableDropMetersUsed: number;
    connectorsUsed: number;
    tensorsUsed: number;
    otherMaterialsUsed?: string;
    installationPhotoUrl?: string;
    notes?: string;
  }): Promise<{ ticket: InstallationTicket }> {
    return this.request('/technician/tickets/close', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public async getTickets(): Promise<{ tickets: InstallationTicket[] }> {
    return this.request('/technician/tickets');
  }

  // Wispro
  public async getWisproClients(params?: { status?: string; search?: string }): Promise<{ clients: WisproClient[] }> {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/wispro/clients${query ? `?${query}` : ''}`);
  }

  public async syncWispro(): Promise<{ success: boolean; message: string; clientsSynced: number; timestamp: string }> {
    return this.request('/wispro/sync', {
      method: 'POST'
    });
  }

  // Metrics
  public async getPersonnelMetrics(): Promise<{ metrics: TechnicianMetric[] }> {
    return this.request('/metrics/personnel');
  }

  // Reset
  public async resetSystem(): Promise<{ message: string }> {
    return this.request('/system/reset', {
      method: 'POST'
    });
  }

  // Inventory Search
  public async getFullInventory(): Promise<any[]> {
    // Este endpoint específico no requiere autenticación de usuario,
    // por lo que usamos fetch directamente en lugar de this.request.
    const response = await fetch(`${API_BASE_URL}/inventory`);
    if (!response.ok) {
      throw new Error('No se pudo obtener el inventario completo');
    }
    return response.json();
  }
}

export const api = new ApiService();
