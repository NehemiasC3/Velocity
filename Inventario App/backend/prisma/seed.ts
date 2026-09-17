import { PrismaClient, Role, WarehouseType, WarehouseStatus, ItemCategory, TrackingType, UnitOfMeasure, SerializedStatus, BatchStatus, AuditEventType, InstallationTicketType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Iniciando inyección de Seed para Demo Gerencial Velocity (Inventario + Mesa)...');

  const defaultPasswordHash = await bcrypt.hash('admin123', 10);
  const techPasswordHash = await bcrypt.hash('tecnico123', 10);

  // ==========================================
  // 1. ESTRUCTURA DE BODEGAS (Hub & Spoke / Nodos)
  // ==========================================
  console.log('📦 Configurando red logística de Bodegas y Nodos...');

  const tocumen = await prisma.warehouse.upsert({
    where: { code: 'WH-TOCUMEN' },
    update: {
      name: 'Hub Central Tocumen',
      type: WarehouseType.PRINCIPAL,
      address: 'Hub Central Tocumen, Vía Panamericana km 18, Ciudad de Panamá',
      status: WarehouseStatus.ACTIVE,
    },
    create: {
      code: 'WH-TOCUMEN',
      name: 'Hub Central Tocumen',
      type: WarehouseType.PRINCIPAL,
      address: 'Hub Central Tocumen, Vía Panamericana km 18, Ciudad de Panamá',
      status: WarehouseStatus.ACTIVE,
    },
  });

  const meteti = await prisma.warehouse.upsert({
    where: { code: 'WH-METETI' },
    update: {
      name: 'Sucursal Metetí',
      type: WarehouseType.SUCURSAL,
      address: 'Centro Operativo Metetí, Carretera Panamericana, Darién',
      status: WarehouseStatus.ACTIVE,
      parentId: tocumen.id,
    },
    create: {
      code: 'WH-METETI',
      name: 'Sucursal Metetí',
      type: WarehouseType.SUCURSAL,
      address: 'Centro Operativo Metetí, Carretera Panamericana, Darién',
      status: WarehouseStatus.ACTIVE,
      parentId: tocumen.id,
    },
  });

  const torti = await prisma.warehouse.upsert({
    where: { code: 'WH-TORTI' },
    update: {
      name: 'Sucursal Tortí',
      type: WarehouseType.SUCURSAL,
      address: 'Sub-Hub Tortí, Chepo Este, Panamá',
      status: WarehouseStatus.ACTIVE,
      parentId: tocumen.id,
    },
    create: {
      code: 'WH-TORTI',
      name: 'Sucursal Tortí',
      type: WarehouseType.SUCURSAL,
      address: 'Sub-Hub Tortí, Chepo Este, Panamá',
      status: WarehouseStatus.ACTIVE,
      parentId: tocumen.id,
    },
  });

  // Bodegas Móviles / Vehiculares para Cuadrillas
  const vehiculo1 = await prisma.warehouse.upsert({
    where: { code: 'WH-VEH-01' },
    update: {
      name: 'Cuadrilla 1 - Luis David (Móvil)',
      type: WarehouseType.VEHICULO,
      vehiclePlate: '829471',
      address: 'Vehículo Móvil Asignado a Cuadrilla 1',
      status: WarehouseStatus.ACTIVE,
      parentId: tocumen.id,
    },
    create: {
      code: 'WH-VEH-01',
      name: 'Cuadrilla 1 - Luis David (Móvil)',
      type: WarehouseType.VEHICULO,
      vehiclePlate: '829471',
      address: 'Vehículo Móvil Asignado a Cuadrilla 1',
      status: WarehouseStatus.ACTIVE,
      parentId: tocumen.id,
    },
  });

  const vehiculo2 = await prisma.warehouse.upsert({
    where: { code: 'WH-VEH-02' },
    update: {
      name: 'Cuadrilla 2 - Mario Barria (Móvil)',
      type: WarehouseType.VEHICULO,
      vehiclePlate: '914023',
      address: 'Vehículo Móvil Asignado a Cuadrilla 2',
      status: WarehouseStatus.ACTIVE,
      parentId: meteti.id,
    },
    create: {
      code: 'WH-VEH-02',
      name: 'Cuadrilla 2 - Mario Barria (Móvil)',
      type: WarehouseType.VEHICULO,
      vehiclePlate: '914023',
      address: 'Vehículo Móvil Asignado a Cuadrilla 2',
      status: WarehouseStatus.ACTIVE,
      parentId: meteti.id,
    },
  });

  // ==========================================
  // 2. PERSONAL, SUPERVISORES Y TÉCNICOS
  // ==========================================
  console.log('👷 Registrando personal técnico y administrativo...');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@rappidopanama.com' },
    update: {
      name: 'Carlos Mendoza (Gerencia / Superadmin)',
      role: Role.SUPERADMIN,
      phone: '+507 6001-0001',
      password: defaultPasswordHash,
      baseWarehouseId: tocumen.id,
    },
    create: {
      email: 'admin@rappidopanama.com',
      name: 'Carlos Mendoza (Gerencia / Superadmin)',
      role: Role.SUPERADMIN,
      phone: '+507 6001-0001',
      password: defaultPasswordHash,
      baseWarehouseId: tocumen.id,
    },
  });

  const supervisorNehemias = await prisma.user.upsert({
    where: { email: 'nehemias@atg-rappido.com' },
    update: {
      name: 'Nehemias C. (Supervisor de Operaciones)',
      role: Role.SUPERADMIN,
      phone: '+507 6123-4567',
      password: defaultPasswordHash,
      baseWarehouseId: tocumen.id,
    },
    create: {
      email: 'nehemias@atg-rappido.com',
      name: 'Nehemias C. (Supervisor de Operaciones)',
      role: Role.SUPERADMIN,
      phone: '+507 6123-4567',
      password: defaultPasswordHash,
      baseWarehouseId: tocumen.id,
    },
  });

  const bodeguero = await prisma.user.upsert({
    where: { email: 'bodega.tocumen@atg-rappido.com' },
    update: {
      name: 'Mario Pérez (Jefe de Bodega)',
      role: Role.BODEGUERO_CENTRAL,
      phone: '+507 6002-0002',
      password: defaultPasswordHash,
      baseWarehouseId: tocumen.id,
    },
    create: {
      email: 'bodega.tocumen@atg-rappido.com',
      name: 'Mario Pérez (Jefe de Bodega)',
      role: Role.BODEGUERO_CENTRAL,
      phone: '+507 6002-0002',
      password: defaultPasswordHash,
      baseWarehouseId: tocumen.id,
    },
  });

  const tech1 = await prisma.user.upsert({
    where: { email: 'ldavid@atg-rappido.com' },
    update: {
      name: 'Luis David (Cuadrilla 1)',
      role: Role.TECNICO,
      phone: '+507 6821-4455',
      password: techPasswordHash,
      baseWarehouseId: vehiculo1.id,
      assignedNodeId: tocumen.id,
    },
    create: {
      email: 'ldavid@atg-rappido.com',
      name: 'Luis David (Cuadrilla 1)',
      role: Role.TECNICO,
      phone: '+507 6821-4455',
      password: techPasswordHash,
      baseWarehouseId: vehiculo1.id,
      assignedNodeId: tocumen.id,
    },
  });

  const tech2 = await prisma.user.upsert({
    where: { email: 'mbarria@atg-rappido.com' },
    update: {
      name: 'Mario Barria (Cuadrilla 2)',
      role: Role.TECNICO,
      phone: '+507 6932-1188',
      password: techPasswordHash,
      baseWarehouseId: vehiculo2.id,
      assignedNodeId: meteti.id,
    },
    create: {
      email: 'mbarria@atg-rappido.com',
      name: 'Mario Barria (Cuadrilla 2)',
      role: Role.TECNICO,
      phone: '+507 6932-1188',
      password: techPasswordHash,
      baseWarehouseId: vehiculo2.id,
      assignedNodeId: meteti.id,
    },
  });

  // Vincular responsables a bodegas
  await prisma.warehouse.update({ where: { id: tocumen.id }, data: { managerId: bodeguero.id } });
  await prisma.warehouse.update({ where: { id: vehiculo1.id }, data: { managerId: tech1.id } });
  await prisma.warehouse.update({ where: { id: vehiculo2.id }, data: { managerId: tech2.id } });

  // ==========================================
  // 3. CATÁLOGO CENTRAL DE PRODUCTOS ISP
  // ==========================================
  console.log('📋 Configurando catálogo de productos y materiales...');

  // A. Equipos Seriados
  const prodZteGpon = await prisma.productCatalog.upsert({
    where: { sku: 'ONU-ZTE-F670L' },
    update: {},
    create: {
      sku: 'ONU-ZTE-F670L',
      name: 'ONU GPON ZTE F670L Dual Band AC1200',
      brand: 'ZTE',
      model: 'ZXHN F670L',
      description: 'Terminal ONT GPON 4GE + 1POTS + WiFi 2.4/5GHz para clientes residenciales y corporativos',
      category: ItemCategory.ONU_ONT,
      trackingType: TrackingType.SERIALIZED,
      unitOfMeasure: UnitOfMeasure.UNIDADES,
      minStockAlert: 15,
    },
  });

  const prodHuaweiGpon = await prisma.productCatalog.upsert({
    where: { sku: 'ONU-HUA-EG8145V5' },
    update: {},
    create: {
      sku: 'ONU-HUA-EG8145V5',
      name: 'ONU GPON Huawei EchoLife EG8145V5',
      brand: 'Huawei',
      model: 'EchoLife EG8145V5',
      description: 'ONT Routing-type GPON con WiFi Dual Band AC y 4 puertos Gigabit Ethernet',
      category: ItemCategory.ONU_ONT,
      trackingType: TrackingType.SERIALIZED,
      unitOfMeasure: UnitOfMeasure.UNIDADES,
      minStockAlert: 15,
    },
  });

  const prodVsolXpon = await prisma.productCatalog.upsert({
    where: { sku: 'ONU-VSOL-V2801SG' },
    update: {},
    create: {
      sku: 'ONU-VSOL-V2801SG',
      name: 'ONU XPON V-Sol 1GE Bridge/Router',
      brand: 'V-Sol',
      model: 'V2801SG',
      description: 'ONU XPON compatible EPON/GPON auto-adaptativa con 1 puerto Gigabit LAN',
      category: ItemCategory.ONU_ONT,
      trackingType: TrackingType.SERIALIZED,
      unitOfMeasure: UnitOfMeasure.UNIDADES,
      minStockAlert: 10,
    },
  });

  const prodChinaMobile = await prisma.productCatalog.upsert({
    where: { sku: 'ONU-CM-G680' },
    update: {},
    create: {
      sku: 'ONU-CM-G680',
      name: 'ONU XPON China Mobile G-680 Dual Band',
      brand: 'China Mobile',
      model: 'G-680',
      description: 'Terminal óptico Gigabit Ethernet de alto rendimiento',
      category: ItemCategory.ONU_ONT,
      trackingType: TrackingType.SERIALIZED,
      unitOfMeasure: UnitOfMeasure.UNIDADES,
      minStockAlert: 8,
    },
  });

  const prodOnnTvBox = await prisma.productCatalog.upsert({
    where: { sku: 'TV-ONN-4K-G1' },
    update: {},
    create: {
      sku: 'TV-ONN-4K-G1',
      name: 'TV Box ONN Android TV 4K UHD Streaming',
      brand: 'Walmart ONN',
      model: 'Streaming Box 4K',
      description: 'Dispositivo OTT 4K con control por voz Google Assistant para servicio de IPTV',
      category: ItemCategory.TV_BOX_OTT,
      trackingType: TrackingType.SERIALIZED,
      unitOfMeasure: UnitOfMeasure.UNIDADES,
      minStockAlert: 5,
    },
  });

  const prodCamEzviz = await prisma.productCatalog.upsert({
    where: { sku: 'CAM-EZV-H6C' },
    update: {},
    create: {
      sku: 'CAM-EZV-H6C',
      name: 'Cámara Seguridad Ezviz H6c 2MP Pan/Tilt',
      brand: 'Ezviz',
      model: 'H6c 2MP Pro',
      description: 'Cámara domo Wi-Fi con visión nocturna inteligente y seguimiento 360° para planes Smart Home',
      category: ItemCategory.CAMARA_SEGURIDAD_IOT,
      trackingType: TrackingType.SERIALIZED,
      unitOfMeasure: UnitOfMeasure.UNIDADES,
      minStockAlert: 5,
    },
  });

  const prodMeshHuawei = await prisma.productCatalog.upsert({
    where: { sku: 'MESH-HUA-WA8021V5' },
    update: {},
    create: {
      sku: 'MESH-HUA-WA8021V5',
      name: 'Repetidor Mesh Huawei Edge ONT WA8021V5',
      brand: 'Huawei',
      model: 'WA8021V5',
      description: 'Extensor de cobertura Wi-Fi Mesh de roaming transparente para hogares amplios',
      category: ItemCategory.REPETIDOR_MESH,
      trackingType: TrackingType.SERIALIZED,
      unitOfMeasure: UnitOfMeasure.UNIDADES,
      minStockAlert: 5,
    },
  });

  // B. Materiales a Granel (Bulk)
  const prodConector = await prisma.productCatalog.upsert({
    where: { sku: 'CON-SCAPC-FAST' },
    update: {},
    create: {
      sku: 'CON-SCAPC-FAST',
      name: 'Conector Mecánico Rápido SC/APC',
      brand: 'Huawei',
      model: 'Fast Connector SC/APC FTTH',
      description: 'Conector de ensamblaje en campo sin pulido con pérdida de inserción < 0.3dB',
      category: ItemCategory.CONECTORIZACION,
      trackingType: TrackingType.BULK,
      unitOfMeasure: UnitOfMeasure.UNIDADES,
      minStockAlert: 100,
    },
  });

  const prodCajaNap = await prisma.productCatalog.upsert({
    where: { sku: 'NAP-16P-FAT' },
    update: {},
    create: {
      sku: 'NAP-16P-FAT',
      name: 'Caja NAP 16 Puertos Exterior IP65',
      brand: 'Fibramérica',
      model: 'FAT-16P',
      description: 'Caja de distribución óptica de segundo nivel para poste o pared con cerradura',
      category: ItemCategory.HERRAJE_PLANTA_EXTERNA,
      trackingType: TrackingType.BULK,
      unitOfMeasure: UnitOfMeasure.UNIDADES,
      minStockAlert: 10,
    },
  });

  const prodSplitter1x8 = await prisma.productCatalog.upsert({
    where: { sku: 'SPL-PLC-1X8' },
    update: {},
    create: {
      sku: 'SPL-PLC-1X8',
      name: 'Splitter PLC 1x8 SC/APC Conectorizado',
      brand: 'Optictimes',
      model: 'PLC-1x8-SC/APC',
      description: 'Divisor óptico simétrico balanceado para cajas NAP',
      category: ItemCategory.HERRAJE_PLANTA_EXTERNA,
      trackingType: TrackingType.BULK,
      unitOfMeasure: UnitOfMeasure.UNIDADES,
      minStockAlert: 15,
    },
  });

  const prodSplitter1x16 = await prisma.productCatalog.upsert({
    where: { sku: 'SPL-PLC-1X16' },
    update: {},
    create: {
      sku: 'SPL-PLC-1X16',
      name: 'Splitter PLC 1x16 SC/APC Conectorizado',
      brand: 'Optictimes',
      model: 'PLC-1x16-SC/APC',
      description: 'Divisor óptico simétrico balanceado para distribución principal',
      category: ItemCategory.HERRAJE_PLANTA_EXTERNA,
      trackingType: TrackingType.BULK,
      unitOfMeasure: UnitOfMeasure.UNIDADES,
      minStockAlert: 10,
    },
  });

  const prodTensores = await prisma.productCatalog.upsert({
    where: { sku: 'TEN-DROP-FIG8' },
    update: {},
    create: {
      sku: 'TEN-DROP-FIG8',
      name: 'Tensores Tipo Cuña Drop Figura 8 Plásticos',
      brand: 'Genérico',
      model: 'Tensor UV Plástico',
      description: 'Anclaje dieléctrico para acometidas aéreas de fibra óptica drop',
      category: ItemCategory.HERRAJE_PLANTA_EXTERNA,
      trackingType: TrackingType.BULK,
      unitOfMeasure: UnitOfMeasure.UNIDADES,
      minStockAlert: 200,
    },
  });

  // C. Bobinas por Lotes (Batched)
  const prodCableDrop = await prisma.productCatalog.upsert({
    where: { sku: 'CBL-DROP-1F-1KM' },
    update: {},
    create: {
      sku: 'CBL-DROP-1F-1KM',
      name: 'Bobina Cable Drop Fibra Óptica 1 Hilo G.657A2',
      brand: 'Optictimes',
      model: 'Drop FTTH 1000m LSZH',
      description: 'Carrete de acometida exterior autosoportada con guía de acero',
      category: ItemCategory.CABLE_DROP,
      trackingType: TrackingType.BATCHED,
      unitOfMeasure: UnitOfMeasure.METROS,
      minStockAlert: 2000,
    },
  });

  // ==========================================
  // 4. INVENTARIO A GRANEL Y BOBINAS
  // ==========================================
  console.log('📦 Inyectando existencias a granel (Bulk) y Carretes de Cable Drop...');

  const bulkStockSetup = [
    // Tocumen
    { pId: prodConector.id, wId: tocumen.id, qty: 450 },
    { pId: prodCajaNap.id, wId: tocumen.id, qty: 28 },
    { pId: prodSplitter1x8.id, wId: tocumen.id, qty: 42 },
    { pId: prodSplitter1x16.id, wId: tocumen.id, qty: 18 },
    { pId: prodTensores.id, wId: tocumen.id, qty: 650 },
    // Metetí
    { pId: prodConector.id, wId: meteti.id, qty: 120 },
    { pId: prodCajaNap.id, wId: meteti.id, qty: 12 },
    { pId: prodSplitter1x8.id, wId: meteti.id, qty: 15 },
    { pId: prodTensores.id, wId: meteti.id, qty: 180 },
    // Tortí
    { pId: prodConector.id, wId: torti.id, qty: 85 },
    { pId: prodCajaNap.id, wId: torti.id, qty: 8 },
    { pId: prodSplitter1x8.id, wId: torti.id, qty: 10 },
    { pId: prodTensores.id, wId: torti.id, qty: 110 },
    // Vehículo 1 (Luis David)
    { pId: prodConector.id, wId: vehiculo1.id, qty: 40 },
    { pId: prodCajaNap.id, wId: vehiculo1.id, qty: 2 },
    { pId: prodSplitter1x8.id, wId: vehiculo1.id, qty: 4 },
    { pId: prodTensores.id, wId: vehiculo1.id, qty: 60 },
    // Vehículo 2 (Mario Barria)
    { pId: prodConector.id, wId: vehiculo2.id, qty: 35 },
    { pId: prodCajaNap.id, wId: vehiculo2.id, qty: 2 },
    { pId: prodSplitter1x8.id, wId: vehiculo2.id, qty: 3 },
    { pId: prodTensores.id, wId: vehiculo2.id, qty: 45 },
  ];

  for (const bs of bulkStockSetup) {
    await prisma.bulkStock.upsert({
      where: { productId_warehouseId: { productId: bs.pId, warehouseId: bs.wId } },
      update: { quantity: bs.qty },
      create: { productId: bs.pId, warehouseId: bs.wId, quantity: bs.qty },
    });
  }

  // Bobinas de Cable Drop en Bodegas y Vehículos
  const batchSpools = [
    { num: 'BOB-TOC-101', wId: tocumen.id, init: 1000, curr: 1000, status: BatchStatus.DISPONIBLE },
    { num: 'BOB-TOC-102', wId: tocumen.id, init: 1000, curr: 850, status: BatchStatus.EN_USO },
    { num: 'BOB-TOC-103', wId: tocumen.id, init: 1000, curr: 1000, status: BatchStatus.DISPONIBLE },
    { num: 'BOB-MET-201', wId: meteti.id, init: 1000, curr: 620, status: BatchStatus.EN_USO },
    { num: 'BOB-TOR-301', wId: torti.id, init: 1000, curr: 910, status: BatchStatus.EN_USO },
    { num: 'BOB-VEH-01', wId: vehiculo1.id, init: 1000, curr: 380, status: BatchStatus.EN_USO },
    { num: 'BOB-VEH-02', wId: vehiculo2.id, init: 1000, curr: 440, status: BatchStatus.EN_USO },
  ];

  for (const sp of batchSpools) {
    await prisma.batchItem.upsert({
      where: { productId_batchNumber: { productId: prodCableDrop.id, batchNumber: sp.num } },
      update: {
        currentWarehouseId: sp.wId,
        initialQuantity: sp.init,
        currentQuantity: sp.curr,
        status: sp.status,
      },
      create: {
        batchNumber: sp.num,
        productId: prodCableDrop.id,
        currentWarehouseId: sp.wId,
        initialQuantity: sp.init,
        currentQuantity: sp.curr,
        unitOfMeasure: UnitOfMeasure.METROS,
        status: sp.status,
        notes: `Carrete asignado para despliegue de acometidas en ${sp.num}`,
      },
    });
  }

  // ==========================================
  // 5. INYECCIÓN DE 48 EQUIPOS SERIALIZADOS (S/N ES EL REY)
  // ==========================================
  console.log('⚡ Inyectando 48 equipos con Seriales reales (S/N como clave principal)...');

  // Buscar si existen clientes reales de Wispro para asociarles ONUs instaladas
  const realClients = await prisma.wisproClient.findMany({
    take: 6,
    orderBy: { createdAt: 'desc' },
  });

  const serializedItemsData: Array<{
    sn: string;
    mac: string;
    prodId: string;
    wId: string;
    status: SerializedStatus;
    vCode?: string;
    installedClient?: { id: string; name: string; contractId: string };
  }> = [];

  // Helper para generar seriales y macs
  let snCounter = 1000;

  // 1. ZTE F670L GPON (12 unidades)
  for (let i = 1; i <= 12; i++) {
    snCounter++;
    const sn = `ZTEG${snCounter}${80 + i}`;
    const hex = i.toString(16).padStart(2, '0').toUpperCase();
    const mac = `F4:FE:FE:5A:2B:${hex}`;
    
    // 6 en Tocumen, 2 en Meteti, 2 en Torti, 1 en Vehiculo 1, 1 Instalado
    let wId = tocumen.id;
    let st: SerializedStatus = SerializedStatus.EN_BODEGA;
    let instClient = undefined;

    if (i === 1 && realClients.length > 0) {
      st = SerializedStatus.INSTALADO_CLIENTE;
      instClient = { id: realClients[0].id, name: realClients[0].name, contractId: realClients[0].contractId };
    } else if (i === 2) {
      wId = vehiculo1.id;
      st = SerializedStatus.EN_VEHICULO;
    } else if (i === 3) {
      wId = vehiculo2.id;
      st = SerializedStatus.EN_VEHICULO;
    } else if (i <= 5) {
      wId = meteti.id;
    } else if (i <= 7) {
      wId = torti.id;
    }

    serializedItemsData.push({ sn, mac, prodId: prodZteGpon.id, wId, status: st, installedClient: instClient });
  }

  // 2. Huawei EG8145V5 GPON (12 unidades)
  for (let i = 1; i <= 12; i++) {
    snCounter++;
    const sn = `HWTC29${snCounter}${i}`;
    const hex = (i + 15).toString(16).padStart(2, '0').toUpperCase();
    const mac = `48:57:02:C4:91:${hex}`;
    
    let wId = tocumen.id;
    let st: SerializedStatus = SerializedStatus.EN_BODEGA;
    let instClient = undefined;

    if (i === 1 && realClients.length > 1) {
      st = SerializedStatus.INSTALADO_CLIENTE;
      instClient = { id: realClients[1].id, name: realClients[1].name, contractId: realClients[1].contractId };
    } else if (i === 2) {
      wId = vehiculo1.id;
      st = SerializedStatus.EN_VEHICULO;
    } else if (i === 3) {
      wId = vehiculo2.id;
      st = SerializedStatus.EN_VEHICULO;
    } else if (i <= 5) {
      wId = meteti.id;
    } else if (i <= 7) {
      wId = torti.id;
    }

    serializedItemsData.push({ sn, mac, prodId: prodHuaweiGpon.id, wId, status: st, installedClient: instClient });
  }

  // 3. V-Sol V2801SG XPON (8 unidades)
  for (let i = 1; i <= 8; i++) {
    snCounter++;
    const sn = `VSOL88${snCounter}${i}`;
    const hex = (i + 30).toString(16).padStart(2, '0').toUpperCase();
    const mac = `00:13:25:7E:11:${hex}`;
    
    let wId = tocumen.id;
    let st: SerializedStatus = SerializedStatus.EN_BODEGA;
    let instClient = undefined;

    if (i === 1 && realClients.length > 2) {
      st = SerializedStatus.INSTALADO_CLIENTE;
      instClient = { id: realClients[2].id, name: realClients[2].name, contractId: realClients[2].contractId };
    } else if (i === 2) {
      wId = vehiculo1.id;
      st = SerializedStatus.EN_VEHICULO;
    } else if (i <= 4) {
      wId = meteti.id;
    }

    serializedItemsData.push({ sn, mac, prodId: prodVsolXpon.id, wId, status: st, installedClient: instClient });
  }

  // 4. China Mobile G-680 (6 unidades)
  for (let i = 1; i <= 6; i++) {
    snCounter++;
    const sn = `CMCC55${snCounter}${i}`;
    const hex = (i + 45).toString(16).padStart(2, '0').toUpperCase();
    const mac = `B0:95:75:88:22:${hex}`;
    
    let wId = tocumen.id;
    let st: SerializedStatus = SerializedStatus.EN_BODEGA;
    let instClient = undefined;

    if (i === 1 && realClients.length > 3) {
      st = SerializedStatus.INSTALADO_CLIENTE;
      instClient = { id: realClients[3].id, name: realClients[3].name, contractId: realClients[3].contractId };
    } else if (i === 2) {
      wId = vehiculo2.id;
      st = SerializedStatus.EN_VEHICULO;
    } else if (i === 3) {
      wId = torti.id;
    }

    serializedItemsData.push({ sn, mac, prodId: prodChinaMobile.id, wId, status: st, installedClient: instClient });
  }

  // 5. ONN TV Box 4K (4 unidades)
  for (let i = 1; i <= 4; i++) {
    snCounter++;
    const sn = `ONN4K${snCounter}${i}`;
    const hex = (i + 60).toString(16).padStart(2, '0').toUpperCase();
    const mac = `18:E8:29:43:01:${hex}`;
    
    let wId = tocumen.id;
    let st: SerializedStatus = SerializedStatus.EN_BODEGA;

    if (i === 1) {
      wId = vehiculo1.id;
      st = SerializedStatus.EN_VEHICULO;
    } else if (i === 2) {
      wId = meteti.id;
    }

    serializedItemsData.push({ sn, mac, prodId: prodOnnTvBox.id, wId, status: st });
  }

  // 6. Cámaras Ezviz H6c (4 unidades con código de verificación)
  const vCodes = ['ABDFGH', 'KLYTRE', 'ZXCVBN', 'QWERTY'];
  for (let i = 1; i <= 4; i++) {
    snCounter++;
    const sn = `EZVH6C${snCounter}${i}`;
    const hex = (i + 70).toString(16).padStart(2, '0').toUpperCase();
    const mac = `BC:5F:F6:19:33:${hex}`;
    
    let wId = tocumen.id;
    let st: SerializedStatus = SerializedStatus.EN_BODEGA;

    if (i === 1) {
      wId = vehiculo1.id;
      st = SerializedStatus.EN_VEHICULO;
    } else if (i === 2) {
      wId = torti.id;
    }

    serializedItemsData.push({ sn, mac, prodId: prodCamEzviz.id, wId, status: st, vCode: vCodes[i - 1] });
  }

  // 7. Repetidor Mesh Huawei (2 unidades)
  for (let i = 1; i <= 2; i++) {
    snCounter++;
    const sn = `HWMS33${snCounter}${i}`;
    const hex = (i + 80).toString(16).padStart(2, '0').toUpperCase();
    const mac = `48:57:02:88:AA:${hex}`;
    serializedItemsData.push({ sn, mac, prodId: prodMeshHuawei.id, wId: tocumen.id, status: SerializedStatus.EN_BODEGA });
  }

  // Inserción en Prisma con creación de logs de auditoría forense
  for (const item of serializedItemsData) {
    const serialized = await prisma.serializedItem.upsert({
      where: { serialNumber: item.sn },
      update: {
        macAddress: item.mac,
        currentWarehouseId: item.wId,
        status: item.status,
        verificationCode: item.vCode || null,
        installedClientId: item.installedClient?.id || null,
        installedClientName: item.installedClient?.name || null,
        installedContractId: item.installedClient?.contractId || null,
        installedDate: item.installedClient ? new Date() : null,
      },
      create: {
        serialNumber: item.sn,
        macAddress: item.mac,
        productId: item.prodId,
        currentWarehouseId: item.wId,
        status: item.status,
        verificationCode: item.vCode || null,
        installedClientId: item.installedClient?.id || null,
        installedClientName: item.installedClient?.name || null,
        installedContractId: item.installedClient?.contractId || null,
        installedDate: item.installedClient ? new Date() : null,
      },
    });

    // ==========================================
    // 6. TRAZABILIDAD FORENSE (AuditLog Timeline)
    // ==========================================
    // Evento de Alta en Tocumen
    await prisma.auditLog.create({
      data: {
        serialNumber: item.sn,
        macAddress: item.mac,
        eventType: AuditEventType.ALTA_INVENTARIO,
        toWarehouseId: tocumen.id,
        userId: bodeguero.id,
        details: `Ingreso inicial de equipo serializado ${item.sn} (MAC: ${item.mac}) a Hub Central Tocumen`,
        timestamp: new Date(Date.now() - 3600 * 1000 * 48), // Hace 2 días
      },
    });

    // Si está en otra bodega o vehículo, registrar el despacho
    if (item.wId !== tocumen.id) {
      await prisma.auditLog.create({
        data: {
          serialNumber: item.sn,
          macAddress: item.mac,
          eventType: item.status === SerializedStatus.EN_VEHICULO ? AuditEventType.CARGA_VEHICULO : AuditEventType.DESPACHO_TRASLADO,
          fromWarehouseId: tocumen.id,
          toWarehouseId: item.wId,
          userId: bodeguero.id,
          details: `Despacho y asignación de equipo ${item.sn} hacia ${item.status === SerializedStatus.EN_VEHICULO ? 'vehículo técnico' : 'sucursal regional'}`,
          timestamp: new Date(Date.now() - 3600 * 1000 * 12), // Hace 12 horas
        },
      });
    }

    // Si está instalado en cliente
    if (item.status === SerializedStatus.INSTALADO_CLIENTE && item.installedClient) {
      await prisma.auditLog.create({
        data: {
          serialNumber: item.sn,
          macAddress: item.mac,
          eventType: AuditEventType.INSTALACION_CLIENTE,
          fromWarehouseId: vehiculo1.id,
          userId: tech1.id,
          details: `Instalación exitosa en cliente Wispro: ${item.installedClient.name} (Contrato: ${item.installedClient.contractId})`,
          timestamp: new Date(),
        },
      });
    }
  }

  // ==========================================
  // 7. MESA DE ÓRDENES (Tickets de Instalación en Vivo)
  // ==========================================
  console.log('📋 Generando tickets de demostración para la Mesa de Órdenes...');

  const ticketsData = [
    {
      ticketNumber: 'OT-2026-0841',
      type: InstallationTicketType.INSTALACION_NUEVA,
      clientName: realClients[0]?.name || 'Amado Flores Vergara',
      clientId: realClients[0]?.id || 'cli-001',
      contractId: realClients[0]?.contractId || 'CTR-3',
      address: realClients[0]?.address || 'Wacuco, Chepo Este',
      node: 'Tortí',
      techId: tech1.id,
      vehId: vehiculo1.id,
      onuSerial: 'ZTEG100181',
      onuMac: 'F4:FE:FE:5A:2B:01',
      dropMeters: 85,
      connectors: 2,
      tensors: 4,
      spool: 'BOB-VEH-01',
      notes: 'Instalación completada y potencia calibrada a -19.4 dBm. Cliente navegando a 100 Mbps.',
      synced: true,
    },
    {
      ticketNumber: 'OT-2026-0842',
      type: InstallationTicketType.INSTALACION_NUEVA,
      clientName: realClients[1]?.name || 'Yisela Lizzet Galvez Galvez',
      clientId: realClients[1]?.id || 'cli-002',
      contractId: realClients[1]?.contractId || 'CTR-4',
      address: realClients[1]?.address || 'Wacuco, Calle Principal',
      node: 'Tortí',
      techId: tech1.id,
      vehId: vehiculo1.id,
      onuSerial: 'HWTC2910131',
      onuMac: '48:57:02:C4:91:10',
      dropMeters: 110,
      connectors: 2,
      tensors: 5,
      spool: 'BOB-VEH-01',
      notes: 'Instalación completada satisfactoriamente con Huawei Dual Band.',
      synced: true,
    },
    {
      ticketNumber: 'OT-2026-0843',
      type: InstallationTicketType.INSTALACION_NUEVA,
      clientName: realClients[4]?.name || 'Carlos E. Villarreal',
      clientId: realClients[4]?.id || 'cli-005',
      contractId: realClients[4]?.contractId || 'CTR-881',
      address: 'Barrio Central, Metetí, Darién',
      node: 'Metetí',
      techId: tech2.id,
      vehId: vehiculo2.id,
      onuSerial: 'ZTEG100383',
      onuMac: 'F4:FE:FE:5A:2B:03',
      dropMeters: 0,
      connectors: 0,
      tensors: 0,
      spool: null,
      notes: 'Orden asignada a Cuadrilla 2 (Mario Barria). En camino al domicilio del cliente.',
      synced: false,
    },
    {
      ticketNumber: 'OT-2026-0844',
      type: InstallationTicketType.MANTENIMIENTO_RMA,
      clientName: realClients[2]?.name || 'Karelen Mabel Gonzalez Ramos',
      clientId: realClients[2]?.id || 'cli-003',
      contractId: realClients[2]?.contractId || 'CTR-2',
      address: realClients[2]?.address || 'Wacuco Centro',
      node: 'Tortí',
      techId: tech1.id,
      vehId: vehiculo1.id,
      onuSerial: 'VSOL8810251',
      onuMac: '00:13:25:7E:11:1F',
      dropMeters: 15,
      connectors: 1,
      tensors: 1,
      spool: 'BOB-VEH-01',
      notes: 'Reemplazo de conector por corte accidental. Potencia restaurada a -18.2 dBm.',
      synced: true,
    },
  ];

  for (const t of ticketsData) {
    await prisma.installationTicket.upsert({
      where: { ticketNumber: t.ticketNumber },
      update: {},
      create: {
        ticketNumber: t.ticketNumber,
        type: t.type,
        wisproClientId: t.clientId,
        wisproClientName: t.clientName,
        wisproContractId: t.contractId,
        wisproNode: t.node,
        clientAddress: t.address,
        technicianId: t.techId,
        vehicleWarehouseId: t.vehId,
        installedOnuSerial: t.onuSerial,
        installedOnuMac: t.onuMac,
        cableDropMetersUsed: t.dropMeters,
        connectorsUsed: t.connectors,
        tensorsUsed: t.tensors,
        usedSpoolBatchNumber: t.spool,
        notes: t.notes,
        wisproSynced: t.synced,
        wisproSyncMessage: t.synced ? 'Sincronizado exitosamente con Wispro Cloud' : 'Pendiente de liquidación en campo',
      },
    });
  }

  console.log('✅ SEED INYECTADO CON ÉXITO:');
  console.log(`   - 5 Bodegas (Tocumen, Metetí, Tortí + 2 Vehículos de Cuadrillas)`);
  console.log(`   - 5 Usuarios (Superadmin, Supervisor, Bodeguero, 2 Técnicos)`);
  console.log(`   - 13 Productos en Catálogo (ONUs, TV Box, Cámaras, Repetidores, Bobinas, Conectores, NAPs)`);
  console.log(`   - 48 Equipos Serializados con S/N prioritario`);
  console.log(`   - 7 Carretes de Cable Drop con metraje`);
  console.log(`   - 4 Órdenes de Trabajo en la Mesa con liquidación en campo`);
  console.log(`   - Trazabilidad Forense y Audit Logs generados`);
}

main()
  .catch((e) => {
    console.error('❌ Error ejecutando seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
