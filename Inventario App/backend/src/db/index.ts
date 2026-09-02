import fs from 'fs';
import path from 'path';
import { 
  User, Warehouse, SerializedItem, BulkItem, BulkStock, 
  TransferOrder, InstallationTicket, AuditLog, WisproClient 
} from '../types';

interface DatabaseSchema {
  users: User[];
  warehouses: Warehouse[];
  bulkItems: BulkItem[];
  bulkStocks: BulkStock[];
  serializedItems: SerializedItem[];
  transferOrders: TransferOrder[];
  installationTickets: InstallationTicket[];
  auditLogs: AuditLog[];
  wisproClients: WisproClient[];
  wisproConfig: {
    apiUrl: string;
    apiToken: string;
    autoSyncMinutes: number;
    lastSyncTimestamp?: string;
  };
}

const DB_FILE_PATH = path.join(__dirname, '..', '..', 'data', 'inventory_db.json');

const INITIAL_DATA: DatabaseSchema = {
  users: [
    {
      id: 'usr-admin-1',
      name: 'Roberto Gómez (Admin Bodega)',
      email: 'admin@isp.net',
      role: 'ADMIN_BODEGA',
      phone: '+57 300 111 2233',
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr-encargado-1',
      name: 'Marcela Castillo (Encargada Personal)',
      email: 'personal@isp.net',
      role: 'ENCARGADO_PERSONAL',
      phone: '+57 311 444 5566',
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr-tec-lider-1',
      name: 'Carlos Mendoza (Técnico Líder Cuadrilla 1)',
      email: 'carlos.mendoza@isp.net',
      role: 'TECNICO_LIDER',
      phone: '+57 315 777 8899',
      assignedWarehouseId: 'wh-veh-01',
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr-tec-lider-2',
      name: 'Andrés Rocha (Técnico Líder Cuadrilla 2)',
      email: 'andres.rocha@isp.net',
      role: 'TECNICO_LIDER',
      phone: '+57 318 999 0011',
      assignedWarehouseId: 'wh-veh-02',
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr-tec-ayud-1',
      name: 'Luis Pardo (Técnico Ayudante)',
      email: 'luis.pardo@isp.net',
      role: 'TECNICO_AYUDANTE',
      phone: '+57 320 222 3344',
      assignedWarehouseId: 'wh-veh-01',
      createdAt: new Date().toISOString()
    }
  ],

  warehouses: [
    {
      id: 'wh-hub-central',
      name: 'Bodega Central Matriz (Hub)',
      code: 'HUB-01',
      type: 'HUB',
      address: 'Zona Industrial Calle 13 # 68-45',
      managerId: 'usr-admin-1',
      managerName: 'Roberto Gómez',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    },
    {
      id: 'wh-spoke-norte',
      name: 'Sucursal Regional Norte (Spoke)',
      code: 'SPK-NORTE',
      type: 'SPOKE',
      address: 'Autopista Norte # 170-20',
      managerId: 'usr-admin-1',
      managerName: 'Roberto Gómez',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    },
    {
      id: 'wh-spoke-sur',
      name: 'Sucursal Regional Sur (Spoke)',
      code: 'SPK-SUR',
      type: 'SPOKE',
      address: 'Av. Primero de Mayo # 42-10',
      managerId: 'usr-admin-1',
      managerName: 'Roberto Gómez',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    },
    {
      id: 'wh-veh-01',
      name: 'Camioneta Móvil 01 (Carlos Mendoza)',
      code: 'VEH-CM01',
      type: 'VEHICLE',
      vehiclePlate: 'ABC-123',
      managerId: 'usr-tec-lider-1',
      managerName: 'Carlos Mendoza',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    },
    {
      id: 'wh-veh-02',
      name: 'Camioneta Móvil 02 (Andrés Rocha)',
      code: 'VEH-AR02',
      type: 'VEHICLE',
      vehiclePlate: 'XYZ-789',
      managerId: 'usr-tec-lider-2',
      managerName: 'Andrés Rocha',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    }
  ],

  bulkItems: [
    {
      id: 'blk-cable-drop-1h',
      name: 'Cable Drop Fibra Óptica 1 Hilo G.657A2',
      code: 'CBL-DRP-1H',
      category: 'CABLE_DROP',
      unitOfMeasure: 'METROS',
      minStockAlert: 1000,
      description: 'Bobinas de fibra drop monomodo autosoportada',
      createdAt: new Date().toISOString()
    },
    {
      id: 'blk-cable-drop-2h',
      name: 'Cable Drop Fibra Óptica 2 Hilos Autosoportado',
      code: 'CBL-DRP-2H',
      category: 'CABLE_DROP',
      unitOfMeasure: 'METROS',
      minStockAlert: 500,
      description: 'Cable drop de 2 hilos para acometidas duales',
      createdAt: new Date().toISOString()
    },
    {
      id: 'blk-conector-scapc',
      name: 'Conector Mecánico Rápido SC/APC Verde',
      code: 'CON-SCAPC',
      category: 'CONECTOR_MECANICO',
      unitOfMeasure: 'UNIDADES',
      minStockAlert: 100,
      description: 'Conector de ensamblado en campo SC/APC 0.2dB',
      createdAt: new Date().toISOString()
    },
    {
      id: 'blk-tensor-drop',
      name: 'Tensor Metálico de Retención Drop Tipo Pez',
      code: 'TNS-DROP',
      category: 'TENSOR_DROP',
      unitOfMeasure: 'UNIDADES',
      minStockAlert: 150,
      description: 'Herraje tipo pez para retención en poste',
      createdAt: new Date().toISOString()
    },
    {
      id: 'blk-roseta-optica',
      name: 'Roseta Óptica Interior 1 Puerto con Adaptador',
      code: 'ROS-OPT-1P',
      category: 'ROSETA',
      unitOfMeasure: 'UNIDADES',
      minStockAlert: 80,
      description: 'Caja de terminación interna de abonado',
      createdAt: new Date().toISOString()
    },
    {
      id: 'blk-patchcord-scapc',
      name: 'Patchcord Óptico SC/APC - SC/UPC 2 Metros',
      code: 'PAT-SC-2M',
      category: 'PATCHCORD',
      unitOfMeasure: 'UNIDADES',
      minStockAlert: 60,
      description: 'Cordón de parcheo monomodo simplex 2m',
      createdAt: new Date().toISOString()
    }
  ],

  bulkStocks: [
    // Hub Central
    { id: 'stk-1', bulkItemId: 'blk-cable-drop-1h', bulkItemName: 'Cable Drop Fibra Óptica 1 Hilo G.657A2', bulkItemCode: 'CBL-DRP-1H', unitOfMeasure: 'METROS', warehouseId: 'wh-hub-central', warehouseName: 'Bodega Central Matriz (Hub)', quantity: 24000, updatedAt: new Date().toISOString() },
    { id: 'stk-2', bulkItemId: 'blk-conector-scapc', bulkItemName: 'Conector Mecánico Rápido SC/APC Verde', bulkItemCode: 'CON-SCAPC', unitOfMeasure: 'UNIDADES', warehouseId: 'wh-hub-central', warehouseName: 'Bodega Central Matriz (Hub)', quantity: 2500, updatedAt: new Date().toISOString() },
    { id: 'stk-3', bulkItemId: 'blk-tensor-drop', bulkItemName: 'Tensor Metálico de Retención Drop Tipo Pez', bulkItemCode: 'TNS-DROP', unitOfMeasure: 'UNIDADES', warehouseId: 'wh-hub-central', warehouseName: 'Bodega Central Matriz (Hub)', quantity: 1800, updatedAt: new Date().toISOString() },
    { id: 'stk-4', bulkItemId: 'blk-roseta-optica', bulkItemName: 'Roseta Óptica Interior 1 Puerto con Adaptador', bulkItemCode: 'ROS-OPT-1P', unitOfMeasure: 'UNIDADES', warehouseId: 'wh-hub-central', warehouseName: 'Bodega Central Matriz (Hub)', quantity: 1200, updatedAt: new Date().toISOString() },

    // Spoke Norte (Stock crítico para disparar alerta en dashboard)
    { id: 'stk-5', bulkItemId: 'blk-cable-drop-1h', bulkItemName: 'Cable Drop Fibra Óptica 1 Hilo G.657A2', bulkItemCode: 'CBL-DRP-1H', unitOfMeasure: 'METROS', warehouseId: 'wh-spoke-norte', warehouseName: 'Sucursal Regional Norte (Spoke)', quantity: 450, updatedAt: new Date().toISOString() },
    { id: 'stk-6', bulkItemId: 'blk-conector-scapc', bulkItemName: 'Conector Mecánico Rápido SC/APC Verde', bulkItemCode: 'CON-SCAPC', unitOfMeasure: 'UNIDADES', warehouseId: 'wh-spoke-norte', warehouseName: 'Sucursal Regional Norte (Spoke)', quantity: 60, updatedAt: new Date().toISOString() },
    { id: 'stk-7', bulkItemId: 'blk-tensor-drop', bulkItemName: 'Tensor Metálico de Retención Drop Tipo Pez', bulkItemCode: 'TNS-DROP', unitOfMeasure: 'UNIDADES', warehouseId: 'wh-spoke-norte', warehouseName: 'Sucursal Regional Norte (Spoke)', quantity: 90, updatedAt: new Date().toISOString() },

    // Spoke Sur
    { id: 'stk-8', bulkItemId: 'blk-cable-drop-1h', bulkItemName: 'Cable Drop Fibra Óptica 1 Hilo G.657A2', bulkItemCode: 'CBL-DRP-1H', unitOfMeasure: 'METROS', warehouseId: 'wh-spoke-sur', warehouseName: 'Sucursal Regional Sur (Spoke)', quantity: 3800, updatedAt: new Date().toISOString() },
    { id: 'stk-9', bulkItemId: 'blk-conector-scapc', bulkItemName: 'Conector Mecánico Rápido SC/APC Verde', bulkItemCode: 'CON-SCAPC', unitOfMeasure: 'UNIDADES', warehouseId: 'wh-spoke-sur', warehouseName: 'Sucursal Regional Sur (Spoke)', quantity: 320, updatedAt: new Date().toISOString() },
    { id: 'stk-10', bulkItemId: 'blk-tensor-drop', bulkItemName: 'Tensor Metálico de Retención Drop Tipo Pez', bulkItemCode: 'TNS-DROP', unitOfMeasure: 'UNIDADES', warehouseId: 'wh-spoke-sur', warehouseName: 'Sucursal Regional Sur (Spoke)', quantity: 240, updatedAt: new Date().toISOString() },

    // Camioneta 01 (Carlos Mendoza)
    { id: 'stk-11', bulkItemId: 'blk-cable-drop-1h', bulkItemName: 'Cable Drop Fibra Óptica 1 Hilo G.657A2', bulkItemCode: 'CBL-DRP-1H', unitOfMeasure: 'METROS', warehouseId: 'wh-veh-01', warehouseName: 'Camioneta Móvil 01 (Carlos Mendoza)', quantity: 620, updatedAt: new Date().toISOString() },
    { id: 'stk-12', bulkItemId: 'blk-conector-scapc', bulkItemName: 'Conector Mecánico Rápido SC/APC Verde', bulkItemCode: 'CON-SCAPC', unitOfMeasure: 'UNIDADES', warehouseId: 'wh-veh-01', warehouseName: 'Camioneta Móvil 01 (Carlos Mendoza)', quantity: 28, updatedAt: new Date().toISOString() },
    { id: 'stk-13', bulkItemId: 'blk-tensor-drop', bulkItemName: 'Tensor Metálico de Retención Drop Tipo Pez', bulkItemCode: 'TNS-DROP', unitOfMeasure: 'UNIDADES', warehouseId: 'wh-veh-01', warehouseName: 'Camioneta Móvil 01 (Carlos Mendoza)', quantity: 18, updatedAt: new Date().toISOString() },
    { id: 'stk-14', bulkItemId: 'blk-roseta-optica', bulkItemName: 'Roseta Óptica Interior 1 Puerto con Adaptador', bulkItemCode: 'ROS-OPT-1P', unitOfMeasure: 'UNIDADES', warehouseId: 'wh-veh-01', warehouseName: 'Camioneta Móvil 01 (Carlos Mendoza)', quantity: 12, updatedAt: new Date().toISOString() },

    // Camioneta 02 (Andrés Rocha)
    { id: 'stk-15', bulkItemId: 'blk-cable-drop-1h', bulkItemName: 'Cable Drop Fibra Óptica 1 Hilo G.657A2', bulkItemCode: 'CBL-DRP-1H', unitOfMeasure: 'METROS', warehouseId: 'wh-veh-02', warehouseName: 'Camioneta Móvil 02 (Andrés Rocha)', quantity: 890, updatedAt: new Date().toISOString() },
    { id: 'stk-16', bulkItemId: 'blk-conector-scapc', bulkItemName: 'Conector Mecánico Rápido SC/APC Verde', bulkItemCode: 'CON-SCAPC', unitOfMeasure: 'UNIDADES', warehouseId: 'wh-veh-02', warehouseName: 'Camioneta Móvil 02 (Andrés Rocha)', quantity: 45, updatedAt: new Date().toISOString() },
    { id: 'stk-17', bulkItemId: 'blk-tensor-drop', bulkItemName: 'Tensor Metálico de Retención Drop Tipo Pez', bulkItemCode: 'TNS-DROP', unitOfMeasure: 'UNIDADES', warehouseId: 'wh-veh-02', warehouseName: 'Camioneta Móvil 02 (Andrés Rocha)', quantity: 32, updatedAt: new Date().toISOString() }
  ],

  serializedItems: [
    // ONUs en Camioneta 01 (Listas para instalar)
    {
      id: 'ser-onu-001',
      macAddress: 'F4:8E:38:1A:4C:90',
      serialNumber: 'HWTC4C901A38',
      brand: 'Huawei',
      model: 'EG8145V5 Dual Band AC',
      category: 'ONU_GPON',
      currentWarehouseId: 'wh-veh-01',
      currentWarehouseName: 'Camioneta Móvil 01 (Carlos Mendoza)',
      status: 'EN_VEHICULO',
      createdAt: '2026-08-10T10:00:00Z',
      updatedAt: '2026-08-28T14:30:00Z'
    },
    {
      id: 'ser-onu-002',
      macAddress: 'F4:8E:38:1A:4C:91',
      serialNumber: 'HWTC4C911A39',
      brand: 'Huawei',
      model: 'EG8145V5 Dual Band AC',
      category: 'ONU_GPON',
      currentWarehouseId: 'wh-veh-01',
      currentWarehouseName: 'Camioneta Móvil 01 (Carlos Mendoza)',
      status: 'EN_VEHICULO',
      createdAt: '2026-08-10T10:00:00Z',
      updatedAt: '2026-08-28T14:30:00Z'
    },
    {
      id: 'ser-onu-003',
      macAddress: '78:D6:F0:88:E2:14',
      serialNumber: 'ZTEGC9E21488',
      brand: 'ZTE',
      model: 'F670L Gigabit Wi-Fi 5',
      category: 'ONU_GPON',
      currentWarehouseId: 'wh-veh-01',
      currentWarehouseName: 'Camioneta Móvil 01 (Carlos Mendoza)',
      status: 'EN_VEHICULO',
      createdAt: '2026-08-12T09:15:00Z',
      updatedAt: '2026-08-29T11:00:00Z'
    },
    {
      id: 'ser-onu-004',
      macAddress: '00:0C:43:AA:99:10',
      serialNumber: 'VSOLAX300010',
      brand: 'VSOL',
      model: 'V2804AX Wi-Fi 6 AX3000',
      category: 'ONU_GPON',
      currentWarehouseId: 'wh-veh-01',
      currentWarehouseName: 'Camioneta Móvil 01 (Carlos Mendoza)',
      status: 'EN_VEHICULO',
      createdAt: '2026-08-15T15:00:00Z',
      updatedAt: '2026-08-29T11:00:00Z'
    },

    // ONUs en Camioneta 02
    {
      id: 'ser-onu-005',
      macAddress: '78:D6:F0:88:E2:20',
      serialNumber: 'ZTEGC9E22089',
      brand: 'ZTE',
      model: 'F670L Gigabit Wi-Fi 5',
      category: 'ONU_GPON',
      currentWarehouseId: 'wh-veh-02',
      currentWarehouseName: 'Camioneta Móvil 02 (Andrés Rocha)',
      status: 'EN_VEHICULO',
      createdAt: '2026-08-12T09:15:00Z',
      updatedAt: '2026-08-30T08:00:00Z'
    },

    // ONUs en Sucursal Norte
    {
      id: 'ser-onu-006',
      macAddress: 'F4:8E:38:2B:10:01',
      serialNumber: 'HWTC2B100199',
      brand: 'Huawei',
      model: 'EG8145V5 Dual Band AC',
      category: 'ONU_GPON',
      currentWarehouseId: 'wh-spoke-norte',
      currentWarehouseName: 'Sucursal Regional Norte (Spoke)',
      status: 'EN_BODEGA',
      createdAt: '2026-08-10T10:00:00Z',
      updatedAt: '2026-08-20T16:00:00Z'
    },
    {
      id: 'ser-onu-007',
      macAddress: 'F4:8E:38:2B:10:02',
      serialNumber: 'HWTC2B100200',
      brand: 'Huawei',
      model: 'EG8145V5 Dual Band AC',
      category: 'ONU_GPON',
      currentWarehouseId: 'wh-spoke-norte',
      currentWarehouseName: 'Sucursal Regional Norte (Spoke)',
      status: 'EN_BODEGA',
      createdAt: '2026-08-10T10:00:00Z',
      updatedAt: '2026-08-20T16:00:00Z'
    },

    // ONUs en Bodega Central
    {
      id: 'ser-onu-008',
      macAddress: 'F4:8E:38:3C:99:01',
      serialNumber: 'HWTC3C990111',
      brand: 'Huawei',
      model: 'EG8145X6 Wi-Fi 6',
      category: 'ONU_GPON',
      currentWarehouseId: 'wh-hub-central',
      currentWarehouseName: 'Bodega Central Matriz (Hub)',
      status: 'EN_BODEGA',
      createdAt: '2026-08-25T11:00:00Z',
      updatedAt: '2026-08-25T11:00:00Z'
    },
    {
      id: 'ser-onu-009',
      macAddress: 'F4:8E:38:3C:99:02',
      serialNumber: 'HWTC3C990222',
      brand: 'Huawei',
      model: 'EG8145X6 Wi-Fi 6',
      category: 'ONU_GPON',
      currentWarehouseId: 'wh-hub-central',
      currentWarehouseName: 'Bodega Central Matriz (Hub)',
      status: 'EN_BODEGA',
      createdAt: '2026-08-25T11:00:00Z',
      updatedAt: '2026-08-25T11:00:00Z'
    },

    // ONUs Ya instaladas en clientes (Con trazabilidad completa)
    {
      id: 'ser-onu-010',
      macAddress: 'F4:8E:38:00:AA:11',
      serialNumber: 'HWTC00AA1100',
      brand: 'Huawei',
      model: 'EG8145V5 Dual Band AC',
      category: 'ONU_GPON',
      currentWarehouseId: 'wh-veh-01',
      currentWarehouseName: 'Instalado en Cliente',
      status: 'INSTALADO_CLIENTE',
      installedTicketId: 'TCK-2026-0891',
      installedClientId: 'wisp-cli-101',
      installedClientName: 'Restaurante El Roble S.A.S.',
      installedContractId: 'CTR-88192',
      installedDate: '2026-08-30T16:20:00Z',
      createdAt: '2026-08-01T10:00:00Z',
      updatedAt: '2026-08-30T16:20:00Z'
    },

    // Equipo en RMA (Garantía por puerto PON quemado)
    {
      id: 'ser-onu-011',
      macAddress: '78:D6:F0:11:22:33',
      serialNumber: 'ZTEGC1122339',
      brand: 'ZTE',
      model: 'F670L Gigabit Wi-Fi 5',
      category: 'ONU_GPON',
      currentWarehouseId: 'wh-hub-central',
      currentWarehouseName: 'Bodega Central Matriz (Hub)',
      status: 'RMA_DEFECTUOSO',
      notes: 'Puerto óptico PON con potencia atenuada - En trámite con distribuidor',
      createdAt: '2026-07-15T08:00:00Z',
      updatedAt: '2026-08-22T14:10:00Z'
    } as any
  ],

  transferOrders: [
    {
      id: 'ord-trf-101',
      orderNumber: 'TRF-2026-00101',
      originWarehouseId: 'wh-hub-central',
      originWarehouseName: 'Bodega Central Matriz (Hub)',
      destinationWarehouseId: 'wh-spoke-norte',
      destinationWarehouseName: 'Sucursal Regional Norte (Spoke)',
      status: 'EN_TRANSITO',
      createdById: 'usr-admin-1',
      createdByName: 'Roberto Gómez',
      dispatchedById: 'usr-admin-1',
      dispatchedByName: 'Roberto Gómez',
      dispatchedAt: '2026-08-31T17:00:00Z',
      notes: 'Despacho de reposición semanal para zona Norte',
      serializedItemIds: [],
      bulkItems: [
        { bulkItemId: 'blk-cable-drop-1h', bulkItemName: 'Cable Drop Fibra Óptica 1 Hilo G.657A2', quantity: 3000, unitOfMeasure: 'METROS' },
        { bulkItemId: 'blk-conector-scapc', bulkItemName: 'Conector Mecánico Rápido SC/APC Verde', quantity: 200, unitOfMeasure: 'UNIDADES' }
      ],
      createdAt: '2026-08-31T15:30:00Z',
      updatedAt: '2026-08-31T17:00:00Z'
    },
    {
      id: 'ord-trf-100',
      orderNumber: 'TRF-2026-00100',
      originWarehouseId: 'wh-hub-central',
      originWarehouseName: 'Bodega Central Matriz (Hub)',
      destinationWarehouseId: 'wh-veh-01',
      destinationWarehouseName: 'Camioneta Móvil 01 (Carlos Mendoza)',
      status: 'RECIBIDO',
      createdById: 'usr-admin-1',
      createdByName: 'Roberto Gómez',
      dispatchedById: 'usr-admin-1',
      dispatchedByName: 'Roberto Gómez',
      dispatchedAt: '2026-08-28T14:00:00Z',
      receivedById: 'usr-tec-lider-1',
      receivedByName: 'Carlos Mendoza',
      receivedAt: '2026-08-28T14:30:00Z',
      notes: 'Dotación de inicio de semana cuadrilla 1',
      serializedItemIds: ['ser-onu-001', 'ser-onu-002', 'ser-onu-003', 'ser-onu-004'],
      bulkItems: [
        { bulkItemId: 'blk-cable-drop-1h', bulkItemName: 'Cable Drop Fibra Óptica 1 Hilo G.657A2', quantity: 800, unitOfMeasure: 'METROS' },
        { bulkItemId: 'blk-conector-scapc', bulkItemName: 'Conector Mecánico Rápido SC/APC Verde', quantity: 40, unitOfMeasure: 'UNIDADES' }
      ],
      createdAt: '2026-08-28T13:45:00Z',
      updatedAt: '2026-08-28T14:30:00Z'
    }
  ],

  installationTickets: [
    {
      id: 'tck-0891',
      ticketNumber: 'TCK-2026-0891',
      type: 'INSTALACION_NUEVA',
      wisproClientId: 'wisp-cli-101',
      wisproClientName: 'Restaurante El Roble S.A.S.',
      wisproContractId: 'CTR-88192',
      wisproNode: 'NODO-CENTRO-OLT01',
      clientAddress: 'Carrera 7 # 45-20 Local 3',
      technicianId: 'usr-tec-lider-1',
      technicianName: 'Carlos Mendoza',
      vehicleWarehouseId: 'wh-veh-01',
      installedOnuMac: 'F4:8E:38:00:AA:11',
      installedOnuSerial: 'HWTC00AA1100',
      cableDropMetersUsed: 78,
      connectorsUsed: 2,
      tensorsUsed: 2,
      installationPhotoUrl: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800',
      notes: 'Instalación exitosa en rack comercial. Potencia óptica recibida: -19.4 dBm. Aprovisionamiento Wispro OK.',
      wisproSynced: true,
      wisproSyncMessage: 'MAC inyectada exitosamente en contrato CTR-88192 y servicio activado en OLT.',
      createdAt: '2026-08-30T16:20:00Z'
    },
    {
      id: 'tck-0890',
      ticketNumber: 'TCK-2026-0890',
      type: 'INSTALACION_NUEVA',
      wisproClientId: 'wisp-cli-102',
      wisproClientName: 'Dra. Sandra Milena Torres',
      wisproContractId: 'CTR-88193',
      wisproNode: 'NODO-NORTE-OLT02',
      clientAddress: 'Calle 140 # 19-35 Apto 502',
      technicianId: 'usr-tec-lider-1',
      technicianName: 'Carlos Mendoza',
      vehicleWarehouseId: 'wh-veh-01',
      cableDropMetersUsed: 84,
      connectorsUsed: 2,
      tensorsUsed: 2,
      notes: 'Tendido por ductería interna. Potencia óptica: -18.2 dBm.',
      wisproSynced: true,
      wisproSyncMessage: 'Sincronizado con Wispro.',
      createdAt: '2026-08-29T11:30:00Z'
    },
    {
      id: 'tck-0889',
      ticketNumber: 'TCK-2026-0889',
      type: 'INSTALACION_NUEVA',
      wisproClientId: 'wisp-cli-103',
      wisproClientName: 'Mariana Duque Castro',
      wisproContractId: 'CTR-88194',
      wisproNode: 'NODO-NORTE-OLT02',
      clientAddress: 'Cra 15 # 122-10 Torre B',
      technicianId: 'usr-tec-lider-2',
      technicianName: 'Andrés Rocha',
      vehicleWarehouseId: 'wh-veh-02',
      cableDropMetersUsed: 145,
      connectorsUsed: 4,
      tensorsUsed: 3,
      notes: 'Ruta larga por posteado público con cruce de avenida.',
      wisproSynced: true,
      wisproSyncMessage: 'Sincronizado con Wispro.',
      createdAt: '2026-08-29T15:45:00Z'
    }
  ],

  auditLogs: [
    {
      id: 'aud-001',
      macAddress: 'F4:8E:38:00:AA:11',
      serialNumber: 'HWTC00AA1100',
      eventType: 'ALTA_INVENTARIO',
      toWarehouseId: 'wh-hub-central',
      toWarehouseName: 'Bodega Central Matriz (Hub)',
      userId: 'usr-admin-1',
      userName: 'Roberto Gómez',
      details: 'Ingreso al sistema por compra lote #PO-2026-88 a distribuidor Huawei Colombia.',
      timestamp: '2026-08-01T10:00:00Z'
    },
    {
      id: 'aud-002',
      macAddress: 'F4:8E:38:00:AA:11',
      serialNumber: 'HWTC00AA1100',
      eventType: 'DESPACHO_TRASLADO',
      fromWarehouseId: 'wh-hub-central',
      fromWarehouseName: 'Bodega Central Matriz (Hub)',
      toWarehouseId: 'wh-veh-01',
      toWarehouseName: 'Camioneta Móvil 01 (Carlos Mendoza)',
      userId: 'usr-admin-1',
      userName: 'Roberto Gómez',
      details: 'Despacho de remisión en orden TRF-2026-00100 para dotación de cuadrilla.',
      timestamp: '2026-08-28T14:00:00Z'
    },
    {
      id: 'aud-003',
      macAddress: 'F4:8E:38:00:AA:11',
      serialNumber: 'HWTC00AA1100',
      eventType: 'RECEPCION_TRASLADO',
      fromWarehouseId: 'wh-hub-central',
      fromWarehouseName: 'Bodega Central Matriz (Hub)',
      toWarehouseId: 'wh-veh-01',
      toWarehouseName: 'Camioneta Móvil 01 (Carlos Mendoza)',
      userId: 'usr-tec-lider-1',
      userName: 'Carlos Mendoza',
      details: 'Confirmación y escaneo de recepción física en camioneta ABC-123.',
      timestamp: '2026-08-28T14:30:00Z'
    },
    {
      id: 'aud-004',
      macAddress: 'F4:8E:38:00:AA:11',
      serialNumber: 'HWTC00AA1100',
      eventType: 'INSTALACION_CLIENTE',
      fromWarehouseId: 'wh-veh-01',
      fromWarehouseName: 'Camioneta Móvil 01 (Carlos Mendoza)',
      userId: 'usr-tec-lider-1',
      userName: 'Carlos Mendoza',
      details: 'Instalado en cliente Restaurante El Roble S.A.S. (Wispro ID: wisp-cli-101) bajo ticket TCK-2026-0891. Vinculación automática en Wispro.',
      timestamp: '2026-08-30T16:20:00Z'
    }
  ],

  wisproClients: [
    {
      id: 'wisp-cli-201',
      name: 'Constructora Bolívar S.A.',
      email: 'operaciones@cbolivar.com',
      phone: '+57 310 888 7766',
      address: 'Calle 100 # 8A-49 Piso 6',
      identification: 'NIT 900.123.456-7',
      nodeName: 'NODO-NORTE-OLT01 (Puerto PON 1/2)',
      contractId: 'CTR-99011',
      planName: 'Fibra Corporativa 1 Gbps Dedicado',
      status: 'PENDIENTE_INSTALACION'
    },
    {
      id: 'wisp-cli-202',
      name: 'Juan Camilo Valencia Gómez',
      email: 'jc.valencia@gmail.com',
      phone: '+57 301 555 4321',
      address: 'Carrera 58 # 134-22 Apto 301',
      identification: 'CC 1.018.452.981',
      nodeName: 'NODO-NORTE-OLT02 (Puerto PON 2/1)',
      contractId: 'CTR-99012',
      planName: 'Fibra Hogar 300 Mbps Simétrico',
      status: 'PENDIENTE_INSTALACION'
    },
    {
      id: 'wisp-cli-203',
      name: 'Farmacia & Droguería La Esperanza',
      email: 'contacto@farmacialaesperanza.co',
      phone: '+57 312 333 9988',
      address: 'Av. Las Américas # 42-18 Local 1',
      identification: 'NIT 860.999.111-2',
      nodeName: 'NODO-SUR-OLT01 (Puerto PON 3/4)',
      contractId: 'CTR-99013',
      planName: 'Fibra Negocios 500 Mbps Simétrico + IP Fija',
      status: 'PENDIENTE_INSTALACION'
    },
    {
      id: 'wisp-cli-101',
      name: 'Restaurante El Roble S.A.S.',
      email: 'administracion@elroble.com',
      phone: '+57 314 222 3344',
      address: 'Carrera 7 # 45-20 Local 3',
      identification: 'NIT 901.444.333-1',
      nodeName: 'NODO-CENTRO-OLT01',
      contractId: 'CTR-88192',
      planName: 'Fibra Comercial 200 Mbps',
      currentOnuMac: 'F4:8E:38:00:AA:11',
      status: 'ACTIVO'
    }
  ],

  wisproConfig: {
    apiUrl: 'https://cloud.wispro.co/api/v1',
    apiToken: 'wisp_live_demo_token_sec_99a8b7c6d5e4',
    autoSyncMinutes: 15,
    lastSyncTimestamp: new Date().toISOString()
  }
};

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.loadData();
  }

  private loadData(): DatabaseSchema {
    try {
      const dir = path.dirname(DB_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(DB_FILE_PATH)) {
        const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Error cargando BD existente, inicializando datos por defecto:', err);
    }

    this.saveData(INITIAL_DATA);
    return INITIAL_DATA;
  }

  public saveData(customData?: DatabaseSchema): void {
    try {
      const dataToSave = customData || this.data;
      const dir = path.dirname(DB_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(dataToSave, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error guardando en archivo de BD:', err);
    }
  }

  // Getters
  public getUsers(): User[] { return this.data.users; }
  public getWarehouses(): Warehouse[] { return this.data.warehouses; }
  public getBulkItems(): BulkItem[] { return this.data.bulkItems; }
  public getBulkStocks(): BulkStock[] { return this.data.bulkStocks; }
  public getSerializedItems(): SerializedItem[] { return this.data.serializedItems; }
  public getTransferOrders(): TransferOrder[] { return this.data.transferOrders; }
  public getInstallationTickets(): InstallationTicket[] { return this.data.installationTickets; }
  public getAuditLogs(): AuditLog[] { return this.data.auditLogs; }
  public getWisproClients(): WisproClient[] { return this.data.wisproClients; }
  public getWisproConfig() { return this.data.wisproConfig; }

  // Setters / Modifiers
  public addUser(user: User): void {
    this.data.users.push(user);
    this.saveData();
  }

  public addWarehouse(warehouse: Warehouse): void {
    this.data.warehouses.push(warehouse);
    this.saveData();
  }

  public addBulkItem(item: BulkItem): void {
    this.data.bulkItems.push(item);
    this.saveData();
  }

  public addSerializedItem(item: SerializedItem): void {
    this.data.serializedItems.push(item);
    this.saveData();
  }

  public addSerializedItemsBatch(items: SerializedItem[]): void {
    this.data.serializedItems.push(...items);
    this.saveData();
  }

  public updateSerializedItem(id: string, update: Partial<SerializedItem>): SerializedItem | null {
    const idx = this.data.serializedItems.findIndex(i => i.id === id);
    if (idx === -1) return null;
    this.data.serializedItems[idx] = { 
      ...this.data.serializedItems[idx], 
      ...update, 
      updatedAt: new Date().toISOString() 
    };
    this.saveData();
    return this.data.serializedItems[idx];
  }

  public addBulkStock(stock: BulkStock): void {
    this.data.bulkStocks.push(stock);
    this.saveData();
  }

  public updateBulkStockQuantity(warehouseId: string, bulkItemId: string, deltaQuantity: number): BulkStock {
    let stock = this.data.bulkStocks.find(s => s.warehouseId === warehouseId && s.bulkItemId === bulkItemId);
    const bulkItem = this.data.bulkItems.find(b => b.id === bulkItemId);
    const warehouse = this.data.warehouses.find(w => w.id === warehouseId);

    if (!stock) {
      stock = {
        id: `stk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        bulkItemId,
        bulkItemName: bulkItem?.name || 'Ítem Granel',
        bulkItemCode: bulkItem?.code || 'BLK',
        unitOfMeasure: bulkItem?.unitOfMeasure || 'UNIDADES',
        warehouseId,
        warehouseName: warehouse?.name || 'Bodega',
        quantity: 0,
        updatedAt: new Date().toISOString()
      };
      this.data.bulkStocks.push(stock);
    }

    stock.quantity += deltaQuantity;
    if (stock.quantity < 0) {
      throw new Error(`Stock insuficiente de ${stock.bulkItemName} en ${warehouse?.name || warehouseId}. Disponible: ${stock.quantity - deltaQuantity}, Requerido: ${Math.abs(deltaQuantity)}`);
    }

    stock.updatedAt = new Date().toISOString();
    this.saveData();
    return stock;
  }

  public addTransferOrder(order: TransferOrder): void {
    this.data.transferOrders.unshift(order);
    this.saveData();
  }

  public updateTransferOrder(id: string, update: Partial<TransferOrder>): TransferOrder | null {
    const idx = this.data.transferOrders.findIndex(o => o.id === id);
    if (idx === -1) return null;
    this.data.transferOrders[idx] = {
      ...this.data.transferOrders[idx],
      ...update,
      updatedAt: new Date().toISOString()
    };
    this.saveData();
    return this.data.transferOrders[idx];
  }

  public addInstallationTicket(ticket: InstallationTicket): void {
    this.data.installationTickets.unshift(ticket);
    this.saveData();
  }

  public addAuditLog(log: AuditLog): void {
    this.data.auditLogs.unshift(log);
    this.saveData();
  }

  public updateWisproClient(id: string, update: Partial<WisproClient>): WisproClient | null {
    const idx = this.data.wisproClients.findIndex(c => c.id === id);
    if (idx === -1) return null;
    this.data.wisproClients[idx] = { ...this.data.wisproClients[idx], ...update };
    this.saveData();
    return this.data.wisproClients[idx];
  }

  public updateWisproConfig(update: Partial<typeof INITIAL_DATA['wisproConfig']>): void {
    this.data.wisproConfig = { ...this.data.wisproConfig, ...update };
    this.saveData();
  }

  public resetToDefaults(): void {
    this.data = JSON.parse(JSON.stringify(INITIAL_DATA));
    this.saveData();
  }
}

export const db = new Database();
