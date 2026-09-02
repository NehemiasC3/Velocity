export type Role = 'ADMIN_BODEGA' | 'ENCARGADO_PERSONAL' | 'TECNICO_LIDER' | 'TECNICO_AYUDANTE';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  assignedWarehouseId?: string;
  createdAt: string;
}

export type WarehouseType = 'HUB' | 'SPOKE' | 'VEHICLE';

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  type: WarehouseType;
  address?: string;
  vehiclePlate?: string;
  managerId?: string;
  managerName?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
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
  macAddress: string;
  serialNumber: string;
  brand: string;
  model: string;
  category: 'ONU_GPON' | 'ONU_EPON' | 'ROUTER' | 'OLT' | 'SWITCH' | 'MININODE';
  currentWarehouseId: string;
  currentWarehouseName?: string;
  status: SerializedStatus;
  installedTicketId?: string;
  installedClientId?: string;
  installedClientName?: string;
  installedContractId?: string;
  installedDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
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

export interface TransferOrder {
  id: string;
  orderNumber: string;
  originWarehouseId: string;
  originWarehouseName: string;
  destinationWarehouseId: string;
  destinationWarehouseName: string;
  status: TransferStatus;
  createdById: string;
  createdByName: string;
  dispatchedById?: string;
  dispatchedByName?: string;
  dispatchedAt?: string;
  receivedById?: string;
  receivedByName?: string;
  receivedAt?: string;
  notes?: string;
  serializedItemIds: string[];
  bulkItems: {
    bulkItemId: string;
    bulkItemName: string;
    quantity: number;
    unitOfMeasure: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface InstallationTicket {
  id: string;
  ticketNumber: string;
  type: 'INSTALACION_NUEVA' | 'CAMBIO_EQUIPO' | 'MIGRACION' | 'REPARACION_DROP';
  wisproClientId: string;
  wisproClientName: string;
  wisproContractId: string;
  wisproNode?: string;
  clientAddress: string;
  technicianId: string;
  technicianName: string;
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
