export type Role = 
  | 'SUPERADMIN' 
  | 'ADMIN_BODEGA' 
  | 'BODEGUERO_PRINCIPAL' 
  | 'BODEGUERO_SUCURSAL' 
  | 'TECNICO' 
  | 'TECNICO_LIDER' 
  | 'TECNICO_AYUDANTE' 
  | 'SUPERVISOR_MESA' 
  | 'AUDITOR_INTERNO' 
  | 'ENCARGADO_PERSONAL';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  baseWarehouseId?: string | null;
  baseWarehouseName?: string | null;
  assignedWarehouseId?: string;
  managedWarehouses?: { id: string; name: string; type: string }[];
  createdAt?: string;
}

export type WarehouseType = 'PRINCIPAL' | 'SUCURSAL' | 'VEHICULO' | 'CUARENTENA_RMA' | 'HUB' | 'SPOKE';

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  type: WarehouseType;
  address?: string;
  location?: string;
  vehiclePlate?: string;
  managerId?: string;
  managerName?: string;
  manager?: { id: string; name: string; email: string; role?: string };
  parentId?: string | null;
  parent_id?: string | null;
  parentWarehouse?: { id: string; name: string; code: string; type: string; address?: string } | null;
  childWarehouses?: { id: string; name: string; code: string; type: string; status?: string; vehiclePlate?: string }[];
  _count?: { serializedItems?: number; batchItems?: number; bulkStocks?: number };
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  updatedAt?: string;
}

export type SerializedStatus = 
  | 'EN_BODEGA' 
  | 'EN_TRANSITO' 
  | 'EN_VEHICULO' 
  | 'INSTALADO_CLIENTE' 
  | 'RMA_DEFECTUOSO' 
  | 'BAJA';

export interface SerializedItem {
  id: string;
  macAddress?: string;
  serialNumber: string;
  verificationCode?: string;
  brand?: string;
  model?: string;
  category?: 'ONU_GPON' | 'ONU_EPON' | 'ROUTER' | 'TV_BOX_OTT' | 'CAMARA_SEGURIDAD_IOT' | 'REPETIDOR_MESH' | 'OLT' | 'SWITCH' | 'MININODE' | string;
  productId?: string;
  product?: ProductCatalog;
  currentWarehouseId: string;
  currentWarehouseName?: string;
  currentWarehouse?: Warehouse;
  status: SerializedStatus;
  installedTicketId?: string;
  installedClientId?: string;
  installedClientName?: string;
  installedContractId?: string;
  installedDate?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BulkItem {
  id: string;
  name: string;
  code: string;
  category: 'CABLE_DROP' | 'CONECTOR_MECANICO' | 'TENSOR_DROP' | 'SPLITTER' | 'ROSETA' | 'PATCHCORD';
  unitOfMeasure: 'METROS' | 'UNIDADES' | 'ROLLOS';
  minStockAlert: number;
  description?: string;
  createdAt: string;
}

export interface BulkStock {
  id: string;
  bulkItemId: string;
  bulkItemName: string;
  bulkItemCode: string;
  unitOfMeasure: 'METROS' | 'UNIDADES' | 'ROLLOS';
  warehouseId: string;
  warehouseName?: string;
  quantity: number;
  updatedAt: string;
}

export type TransferStatus = 'PENDIENTE' | 'EN_TRANSITO' | 'RECIBIDO' | 'RECHAZADO' | 'CANCELADO';

export interface BatchItem {
  id: string;
  batchNumber: string;
  productId: string;
  product?: ProductCatalog;
  currentWarehouseId: string;
  currentWarehouse?: Warehouse;
  initialQuantity: number;
  currentQuantity: number;
  unitOfMeasure: string;
  status: 'DISPONIBLE' | 'EN_USO' | 'AGOTADO' | 'EN_TRANSITO' | 'DEFECTUOSO';
  notes?: string;
  createdAt?: string;
}

export interface TransferOrderItem {
  id: string;
  transferOrderId?: string;
  productId: string;
  product?: ProductCatalog;
  quantity: number;
  unitOfMeasure: string;
}

export interface TransferOrder {
  id: string;
  orderNumber: string;
  sourceWarehouseId: string;
  sourceWarehouse?: Warehouse;
  destinationWarehouseId: string;
  destinationWarehouse?: Warehouse;
  status: TransferStatus;
  createdByUserId?: string;
  createdByUser?: { id: string; name: string; email: string; role?: string };
  dispatchedByUserId?: string;
  dispatchedByUser?: { id: string; name: string; email: string; role?: string };
  dispatchedAt?: string;
  receivedByUserId?: string;
  receivedByUser?: { id: string; name: string; email: string; role?: string };
  receivedAt?: string;
  notes?: string;
  items?: TransferOrderItem[];
  batchItems?: BatchItem[];
  serializedItems?: SerializedItem[];
  // Legacy / UI Helpers
  originWarehouseId?: string;
  originWarehouseName?: string;
  destinationWarehouseName?: string;
  createdById?: string;
  createdByName?: string;
  serializedItemIds?: string[];
  bulkItems?: {
    bulkItemId: string;
    bulkItemName: string;
    quantity: number;
    unitOfMeasure: string;
  }[];
  createdAt: string;
  updatedAt?: string;
}

export type InstallationTicketType = 'INSTALACION_NUEVA' | 'CAMBIO_EQUIPO' | 'MIGRACION' | 'REPARACION_DROP';

export interface InstallationTicket {
  id: string;
  ticketNumber: string;
  type: InstallationTicketType;
  wisproClientId: string;
  wisproClientName: string;
  wisproContractId: string;
  wisproNode?: string;
  clientAddress: string;
  technicianId: string;
  technicianName?: string;
  vehicleWarehouseId: string;
  installedOnuMac?: string;
  installedOnuSerial?: string;
  cableDropMetersUsed: number;
  connectorsUsed: number;
  tensorsUsed: number;
  otherMaterialsUsed?: string;
  installationPhotoUrl?: string;
  notes?: string;
  wisproSynced: boolean;
  wisproSyncMessage?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  macAddress?: string;
  serialNumber?: string;
  eventType: 
    | 'ALTA_INVENTARIO' 
    | 'DESPACHO_TRASLADO' 
    | 'RECEPCION_TRASLADO' 
    | 'CARGA_VEHICULO' 
    | 'INSTALACION_CLIENTE' 
    | 'RETIRO_CLIENTE' 
    | 'REPORTE_RMA' 
    | 'AJUSTE_STOCK';
  fromWarehouseId?: string;
  fromWarehouseName?: string;
  toWarehouseId?: string;
  toWarehouseName?: string;
  userId: string;
  userName: string;
  details: string;
  timestamp: string;
}

export interface WisproClient {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address: string;
  identification?: string;
  nodeName: string;
  contractId: string;
  planName: string;
  currentOnuMac?: string;
  status: 'ACTIVO' | 'PENDIENTE_INSTALACION' | 'SUSPENDIDO';
}

export interface DashboardKPIs {
  totalSerializedActive: number;
  criticalStockAlerts: {
    warehouseName: string;
    bulkItemName: string;
    currentQuantity: number;
    minStockAlert: number;
    unitOfMeasure: string;
  }[];
  rmaCount: number;
  rmaItems: SerializedItem[];
  onusByStatus: {
    enBodega: number;
    enTransito: number;
    enVehiculo: number;
    instaladoCliente: number;
    rmaDefectuoso: number;
    baja: number;
  };
  totalWarehouses: number;
  pendingTransfersCount: number;
  pendingTransfers: TransferOrder[];
}

export interface TechnicianMetric {
  technicianId: string;
  technicianName: string;
  assignedWarehouse: string;
  totalInstalls: number;
  totalMetersConsumed: number;
  avgMetersPerInstall: number;
  totalConnectorsUsed: number;
  isAnomaly: boolean;
  anomalyWarning: string | null;
}

export type ItemCategory = 
  | 'ONU_ONT' 
  | 'ROUTER_WIFI' 
  | 'TV_BOX_OTT'
  | 'CAMARA_SEGURIDAD_IOT'
  | 'REPETIDOR_MESH'
  | 'CABLE_DROP' 
  | 'CONECTORIZACION' 
  | 'HERRAJE_PLANTA_EXTERNA' 
  | 'HERRAMIENTA_EQUIPO' 
  | 'MISCELANEOS';

export type TrackingType = 'SERIALIZED' | 'BATCHED' | 'BULK';

export type UnitOfMeasure = 'METROS' | 'UNIDADES' | 'ROLLOS' | 'CAJAS' | 'KITS';

export interface ProductCatalog {
  id: string;
  sku: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  description?: string | null;
  category: ItemCategory;
  trackingType: TrackingType;
  unitOfMeasure: UnitOfMeasure;
  minStockAlert: number;
  isActive: boolean;
  serializedItems?: SerializedItem[];
  batchItems?: BatchItem[];
  bulkStocks?: BulkStock[];
  _count?: {
    serializedItems?: number;
    batchItems?: number;
    bulkStocks?: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface AnalyticsKPIs {
  total_active_onus: number;
  total_installed_onus: number;
  total_quarantine_onus: number;
  monthly_cable_consumption: number;
  daily_cable_consumption_7d: {
    date: string;
    label: string;
    meters: number;
  }[];
  top_technicians: {
    technicianId: string;
    technicianName: string;
    closedTickets: number;
    metersInstalled: number;
  }[];
  total_warehouses: number;
  total_tickets_month: number;
}

export interface UniversalSearchResults {
  query: string;
  cleanMac: string;
  totalResults: number;
  serialized: Array<SerializedItem & { product?: ProductCatalog; currentWarehouse?: Warehouse }>;
  bulk: Array<BulkStock & { product?: ProductCatalog; warehouse?: Warehouse }>;
  clients: WisproClient[];
  transfers: Array<TransferOrder & { sourceWarehouse?: Warehouse; destinationWarehouse?: Warehouse; createdByUser?: User }>;
  audit: Array<AuditLog & { user?: User; fromWarehouse?: Warehouse; toWarehouse?: Warehouse }>;
}

