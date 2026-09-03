import { 
  User, Warehouse, SerializedItem, BulkItem, BulkStock, 
  TransferOrder, InstallationTicket, AuditLog, WisproClient, 
  DashboardKPIs, TechnicianMetric, ProductCatalog, AnalyticsKPIs 
} from '../types';

const API_BASE_URL = 
  import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' 
    ? '/inventory-api' 
    : 'http://localhost:4000/api');

class ApiService {
  private activeUserId: string = 'usr-admin-1';
  private token: string | null = localStorage.getItem('Velocity_Token') || localStorage.getItem('token') || null;

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('Velocity_Token', token);
    } else {
      localStorage.removeItem('Velocity_Token');
      localStorage.removeItem('token');
    }
  }

  public getToken(): string | null {
    return this.token || localStorage.getItem('Velocity_Token') || localStorage.getItem('token');
  }

  public setActiveUserId(userId: string) {
    this.activeUserId = userId;
  }

  public getActiveUserId(): string {
    return this.activeUserId;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const currentToken = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-id': this.activeUserId,
      ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {}),
      ...(options.headers as Record<string, string> || {})
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      let errorMsg = 'Error en la petición al servidor';
      try {
        const errorData = await response.json();
        errorMsg = errorData.error || errorData.message || errorMsg;
      } catch (e) {
        // Fallback
      }
      throw new Error(errorMsg);
    }

    return response.json();
  }

  // Auth & Users
  public async login(credentials: { email: string; password: string }): Promise<{
    success: boolean;
    message: string;
    token: string;
    user: User;
  }> {
    const res = await this.request<{
      success: boolean;
      message: string;
      token: string;
      user: User;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });

    if (res.token) {
      this.setToken(res.token);
      this.setActiveUserId(res.user.id);
    }

    return res;
  }

  public async getUsers(): Promise<{ users: User[] }> {
    return this.request('/auth/users');
  }

  public async getMe(): Promise<{ user: User }> {
    return this.request('/auth/me');
  }

  // Catálogo Central de Productos (Prisma)
  public async getCatalog(params?: {
    category?: string;
    trackingType?: string;
    search?: string;
    isActive?: boolean;
  }): Promise<{ success: boolean; count: number; products: ProductCatalog[] }> {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/catalog${query ? `?${query}` : ''}`);
  }

  public async getCatalogProduct(id: string): Promise<{ success: boolean; product: ProductCatalog }> {
    return this.request(`/catalog/${id}`);
  }

  public async createCatalogProduct(data: Partial<ProductCatalog>): Promise<{ success: boolean; message: string; product: ProductCatalog }> {
    return this.request('/catalog', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public async updateCatalogProduct(id: string, data: Partial<ProductCatalog>): Promise<{ success: boolean; message: string; product: ProductCatalog }> {
    return this.request(`/catalog/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  public async deleteCatalogProduct(id: string): Promise<{ success: boolean; message: string; product?: ProductCatalog }> {
    return this.request(`/catalog/${id}`, {
      method: 'DELETE'
    });
  }

  // Inbound Inventory (Alta de Stock Físico Transaccional)
  public async inboundInventory(data: {
    warehouseId: string;
    productId: string;
    trackingType?: string;
    quantity?: number;
    batchNumber?: string;
    initialQuantity?: number;
    batches?: { batchNumber: string; initialQuantity: number; notes?: string }[];
    items?: { macAddress: string; serialNumber: string; notes?: string }[];
    notes?: string;
  }): Promise<{
    success: boolean;
    message: string;
    type: string;
    bulkStock?: any;
    batches?: any[];
    items?: any[];
    count?: number;
  }> {
    return this.request('/inventory/inbound', {
      method: 'POST',
      body: JSON.stringify(data)
    });
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

  // Logística Inversa & RMA
  public async lookupRmaDevice(query: string): Promise<{
    success: boolean;
    item: SerializedItem;
    isInstalledInClient: boolean;
    installedClientName: string;
    installedTicketId: string;
    installedContractId: string;
    installedDate?: string;
    currentLocation: string;
  }> {
    return this.request(`/rma/lookup/${encodeURIComponent(query)}`);
  }

  public async returnRmaEquipment(data: {
    macAddress?: string;
    serialNumber?: string;
    vehicleWarehouseId?: string;
    targetWarehouseId?: string;
    reason?: string;
    deviceCondition?: 'DEFECTUOSO_RMA' | 'OPERATIVO_BUENO';
    notes?: string;
  }): Promise<{
    success: boolean;
    message: string;
    item: SerializedItem;
    previousClient: string;
  }> {
    return this.request('/rma/return', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public async getRmaItems(): Promise<{
    success: boolean;
    count: number;
    items: SerializedItem[];
  }> {
    return this.request('/rma/items');
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

  // Transfers (Órdenes de Traslado Hub & Spoke con Prisma)
  public async getTransfers(params?: { warehouseId?: string; status?: string; search?: string }): Promise<{
    success: boolean;
    count: number;
    transfers: TransferOrder[];
  }> {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/transfers${query ? `?${query}` : ''}`);
  }

  public async getWarehouseStock(warehouseId: string): Promise<{
    success: boolean;
    warehouse: Warehouse;
    stock: {
      bulkStocks: any[];
      batchItems: any[];
      serializedItems: any[];
    };
  }> {
    return this.request(`/inventory/stock?warehouseId=${warehouseId}`);
  }

  public async createTransfer(data: {
    sourceWarehouseId: string;
    destinationWarehouseId: string;
    notes?: string;
    bulkItems?: { productId: string; quantity: number }[];
    batchIds?: string[];
    serializedIds?: string[];
    directReceive?: boolean;
    // Compatibility fields
    originWarehouseId?: string;
    serializedItemIds?: string[];
  }): Promise<{ success: boolean; message: string; transfer: TransferOrder }> {
    const payload = {
      sourceWarehouseId: data.sourceWarehouseId || data.originWarehouseId,
      destinationWarehouseId: data.destinationWarehouseId,
      notes: data.notes,
      bulkItems: data.bulkItems,
      batchIds: data.batchIds,
      serializedIds: data.serializedIds || data.serializedItemIds,
      directReceive: data.directReceive !== undefined ? data.directReceive : true
    };

    return this.request('/transfers', {
      method: 'POST',
      body: JSON.stringify(payload)
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

  public async searchForensicHistory(query: string) {
    return this.searchForensicMAC(query);
  }

  public async getAuditLogs(): Promise<{ logs: AuditLog[] }> {
    return this.request('/audit/logs');
  }

  // Technician Mobile & Liquidations (Consumo en Campo)
  public async getMyVehicleStock(): Promise<{
    warehouse: Warehouse;
    serializedItems: SerializedItem[];
    bulkStocks: BulkStock[];
  }> {
    return this.request('/technician/my-vehicle');
  }

  public async consumeLiquidation(data: {
    vehicleWarehouseId: string;
    technicianId?: string;
    ticketNumber?: string;
    ticketId?: string;
    ticketType?: string;
    wisproClientId?: string;
    clientName?: string;
    contractId?: string;
    clientAddress?: string;
    wisproNode?: string;
    installedOnuMac?: string;
    installedRouterMac?: string;
    retiredDeviceMac?: string;
    retiredDeviceStatus?: string;
    batchedUsage?: { batchId?: string; batchNumber?: string; metersUsed: number };
    bulkUsage?: { productId: string; quantity: number }[];
    connectorsUsed?: number;
    tensorsUsed?: number;
    otherMaterialsUsed?: string;
    notes?: string;
    installationPhotoUrl?: string;
  }): Promise<{ success: boolean; message: string; ticket: InstallationTicket }> {
    return this.request('/liquidations/consume', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public async getLiquidations(params?: { vehicleWarehouseId?: string; technicianId?: string; search?: string }): Promise<{
    success: boolean;
    count: number;
    tickets: InstallationTicket[];
  }> {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/liquidations${query ? `?${query}` : ''}`);
  }

  public async closeTicket(data: any): Promise<{ ticket: InstallationTicket }> {
    const res = await this.consumeLiquidation(data);
    return { ticket: res.ticket };
  }

  public async getTickets(): Promise<{ tickets: InstallationTicket[] }> {
    const res = await this.getLiquidations();
    return { tickets: res.tickets || [] };
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

  // Analytics & Gerencial KPIs
  public async getAnalyticsKPIs(): Promise<{ success: boolean; kpis: AnalyticsKPIs }> {
    return this.request('/analytics/kpis');
  }

  public async getAnalyticsAuditLogs(params?: {
    eventType?: string;
    userId?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ success: boolean; count: number; total: number; logs: any[] }> {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/analytics/audit-log${query ? `?${query}` : ''}`);
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

