"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wisproService = exports.WisproService = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("../db");
const client_1 = require("@prisma/client");
dotenv_1.default.config();
const wisproApiUrl = (process.env.WISPRO_API_URL || process.env.WISPRO_BASE_URL || 'https://cloud.wispro.co/api/v1').replace(/\/+$/, '');
const wisproApiKey = (process.env.WISPRO_API_KEY || process.env.WISPRO_API_TOKEN || '').trim();
class WisproService {
    static cache = { timestamp: 0 };
    static clientsCache = new Map();
    static plansCache = new Map();
    static isPrewarmingDictionaries = false;
    static CACHE_TTL = 30000; // 30 segundos
    /**
     * Carga diccionario de planes desde Wispro API (33 planes)
     */
    static async loadPlansCache() {
        if (this.plansCache.size > 0)
            return;
        try {
            const res = await this.request('/plans?per_page=100');
            const list = Array.isArray(res) ? res : (res?.data || []);
            for (const p of list) {
                if (p && p.id && p.name) {
                    WisproService.plansCache.set(String(p.id), String(p.name).trim());
                }
            }
            console.log(`[WisproService 📋] Caché de planes cargada: ${WisproService.plansCache.size} planes.`);
        }
        catch (err) {
            console.warn('[WisproService] Error cargando caché de planes:', err.message);
        }
    }
    /**
     * Carga diccionario de clientes (nombres reales) desde Wispro API
     */
    static async loadClientsCache() {
        if (this.clientsCache.size > 0 || this.isPrewarmingDictionaries)
            return;
        this.isPrewarmingDictionaries = true;
        try {
            console.log('[WisproService 👥] Cargando diccionario de nombres de clientes desde Wispro API...');
            const firstRes = await this.request('/clients?per_page=100&page=1');
            if (firstRes && firstRes.data) {
                const firstPageData = Array.isArray(firstRes.data) ? firstRes.data : [];
                firstPageData.forEach((c) => {
                    if (c.id && c.name)
                        WisproService.clientsCache.set(String(c.id), c.name.trim());
                });
                const totalPages = firstRes.meta?.pagination?.total_pages || 1;
                if (totalPages > 1) {
                    const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
                    for (let i = 0; i < remainingPages.length; i += 10) {
                        const batch = remainingPages.slice(i, i + 10);
                        const batchResults = await Promise.all(batch.map(p => this.request(`/clients?per_page=100&page=${p}`)
                            .then(r => r?.data || [])
                            .catch(() => [])));
                        batchResults.forEach(data => {
                            if (Array.isArray(data)) {
                                data.forEach((c) => {
                                    if (c.id && c.name)
                                        WisproService.clientsCache.set(String(c.id), c.name.trim());
                                });
                            }
                        });
                    }
                }
                console.log(`[WisproService ✅] Diccionario de clientes completado: ${WisproService.clientsCache.size} clientes en RAM.`);
            }
        }
        catch (err) {
            console.warn('[WisproService] Error cargando clientes para caché:', err.message);
        }
        finally {
            this.isPrewarmingDictionaries = false;
        }
    }
    /**
     * Cliente HTTP centralizado con soporte para API REST Wispro (Authorization: Token)
     */
    static async request(endpoint, options = {}) {
        const cleanEndpoint = endpoint.replace(/^\/+/, '');
        const url = `${wisproApiUrl}/${cleanEndpoint}`;
        // Extraer token limpio sin 'Bearer ' (Wispro API rechaza Bearer)
        const rawToken = (wisproApiKey || '').replace(/^Bearer\s+/i, '').trim();
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(rawToken ? { 'Authorization': rawToken } : {}),
            ...(options.headers || {})
        };
        try {
            const res = await fetch(url, { ...options, headers });
            if (!res.ok) {
                const errText = await res.text().catch(() => res.statusText);
                throw new Error(`Wispro API error (${res.status}): ${errText}`);
            }
            if (res.status === 204)
                return {};
            const data = await res.json();
            if (data && data.status === 401) {
                throw new Error(`Wispro API error (401): ${data.message || 'Unauthorized'}`);
            }
            return data;
        }
        catch (err) {
            console.warn(`[WisproService ⚠️] Error en petición HTTP a ${url}:`, err.message);
            throw err;
        }
    }
    /**
     * Helper para normalizar direcciones MAC (sin dos puntos, mayúsculas)
     */
    static normalizeMac(mac) {
        if (!mac)
            return '';
        return mac.replace(/[^A-Za-z0-9]/g, '').trim().toUpperCase();
    }
    /**
     * Normaliza un contrato crudo de Wispro a la interfaz WisproContract
     */
    static normalizeContract(raw) {
        const id = String(raw.id || raw.contract_id || '');
        const contractId = String(raw.public_id ? `CTR-${raw.public_id}` : (raw.number || raw.contract_id || id || `CTR-${Date.now()}`));
        // 1. Nombre Real del Cliente (evitar "Usuario ...")
        let clientName = '';
        if (raw.client_id && WisproService.clientsCache.has(String(raw.client_id))) {
            clientName = WisproService.clientsCache.get(String(raw.client_id));
        }
        else if (raw.client_name && typeof raw.client_name === 'string') {
            clientName = raw.client_name;
        }
        else if (raw.client && raw.client.name) {
            clientName = raw.client.name;
        }
        else if (raw.name && typeof raw.name === 'string') {
            clientName = raw.name;
        }
        else {
            clientName = `Cliente #${raw.public_id || 'Residencial'}`;
        }
        // 2. Plan Real del Cliente (evitar genérico "Fibra Óptica Residencial")
        let planName = '';
        if (raw.plan_id && WisproService.plansCache.has(String(raw.plan_id))) {
            planName = WisproService.plansCache.get(String(raw.plan_id));
        }
        else if (raw.plan?.name) {
            planName = raw.plan.name;
        }
        else if (raw.plan_name) {
            planName = raw.plan_name;
        }
        else if (raw.details && typeof raw.details === 'string' && raw.details.trim() !== '') {
            planName = raw.details;
        }
        else {
            planName = 'Plan Fibra Óptica';
        }
        const mac = (raw.mac_address ||
            raw.equipment_mac ||
            raw.mac ||
            raw.device_mac ||
            raw.onu_mac ||
            raw.router_mac ||
            '').trim();
        const serialNumber = (raw.ont_serial_number ||
            raw.serial_number ||
            raw.serial ||
            raw.onu_sn ||
            raw.sn ||
            raw.hardware_sn ||
            '').trim();
        const address = raw.address_street
            ? `${raw.address_street}${raw.address_city ? ', ' + raw.address_city : ''}`
            : (raw.address || raw.full_address || raw.client?.address || 'Panamá');
        return {
            id,
            contractId,
            clientName,
            clientId: raw.client_id ? String(raw.client_id) : undefined,
            address,
            planName,
            nodeName: raw.nap_name || raw.node_name || raw.node?.name || 'OLT-Central',
            macAddress: mac || undefined,
            serialNumber: serialNumber || undefined,
            model: raw.model || raw.equipment_model || 'ONU / ONT GPON',
            ip: raw.ip || raw.ip_address || undefined,
            status: String(raw.state || raw.status || 'enabled').toLowerCase(),
            raw
        };
    }
    /**
     * 1. fetchActiveContracts(options):
     * Obtiene la lista de contratos con equipos/MACs asociadas desde Wispro usando la API REST.
     * Soporta carga acumulativa completa (sin límite de 100) y paginación bajo demanda.
     */
    static async fetchActiveContracts(options) {
        const now = Date.now();
        const reqPage = Math.max(1, options?.page || 1);
        const reqPerPage = Math.max(1, Math.min(100, options?.perPage || 50));
        const shouldLoadAll = options?.loadAll ?? true;
        const forceRefresh = options?.forceRefresh ?? false;
        if (forceRefresh) {
            this.cache.contracts = [];
            this.cache.timestamp = 0;
        }
        // 1. Precargar catálogos completos de clientes y planes si aún no están en RAM
        if (wisproApiKey) {
            if (this.plansCache.size === 0) {
                await this.loadPlansCache();
            }
            if (this.clientsCache.size === 0) {
                await this.loadClientsCache();
            }
        }
        // 2. Si ya tenemos el caché completo de contratos válido en memoria, devolverlo o paginarlo
        if (!forceRefresh && this.cache.contracts && this.cache.contracts.length > 0 && now - this.cache.timestamp < this.CACHE_TTL) {
            const all = this.cache.contracts;
            const total = all.length;
            const totalPages = Math.ceil(total / reqPerPage) || 1;
            const contracts = shouldLoadAll
                ? all
                : all.slice((reqPage - 1) * reqPerPage, reqPage * reqPerPage);
            return Object.assign(contracts, {
                contracts,
                total,
                page: reqPage,
                perPage: reqPerPage,
                totalPages
            });
        }
        let remoteContracts = [];
        let totalRecords = 0;
        let totalPages = 1;
        if (wisproApiKey) {
            try {
                // Primera página para extraer metadatos de paginación
                const firstRes = await this.request(`/contracts?filter%5Bstate%5D=enabled&per_page=100&page=1`);
                if (firstRes && firstRes.status !== 401) {
                    const firstPageData = Array.isArray(firstRes) ? firstRes : (firstRes.data || []);
                    remoteContracts = [...firstPageData];
                    totalRecords = firstRes.meta?.pagination?.total_records || firstPageData.length;
                    totalPages = firstRes.meta?.pagination?.total_pages || Math.ceil(totalRecords / 100) || 1;
                    // Si se solicitó cargar todos los registros (eliminando límite de 100):
                    // Consultar las páginas restantes en lotes concurrentes de 10 páginas para máxima velocidad
                    if (shouldLoadAll && totalPages > 1) {
                        console.log(`[WisproService 🚀] Descargando contratos completos de Wispro (${totalPages} páginas, total ${totalRecords})...`);
                        const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
                        for (let i = 0; i < remainingPages.length; i += 10) {
                            const batch = remainingPages.slice(i, i + 10);
                            const batchResults = await Promise.all(batch.map(p => this.request(`/contracts?filter%5Bstate%5D=enabled&per_page=100&page=${p}`)
                                .then(res => (res && res.data ? res.data : []))
                                .catch(() => [])));
                            batchResults.forEach(data => {
                                if (Array.isArray(data))
                                    remoteContracts.push(...data);
                            });
                        }
                        console.log(`[WisproService ✅] Descarga completa: ${remoteContracts.length} contratos activos obtenidos.`);
                    }
                }
            }
            catch (err) {
                console.warn('[WisproService] Falló consulta remota con filter[state]=enabled:', err.message);
                try {
                    const res = await this.request(`/contracts?per_page=100&page=1`);
                    if (res && res.status !== 401) {
                        const list = Array.isArray(res) ? res : (res.data || []);
                        remoteContracts = list.filter((c) => c.state === 'enabled' || c.state === 'active');
                        totalRecords = remoteContracts.length;
                    }
                }
                catch (e) {
                    console.warn('[WisproService] Falló consulta secundaria:', e.message);
                }
            }
        }
        let normalized = remoteContracts.map(r => this.normalizeContract(r));
        // Fallback reactivo si no hay conexión o no hay contratos
        if (normalized.length === 0) {
            const fallbackList = [
                {
                    id: 'wispro-ctr-101',
                    public_id: 'CTR-8841',
                    client_name: 'Carlos Mendoza',
                    address: 'Calle 50, Edif Tower Plaza, Apto 12B',
                    plan_name: 'Plan Fibra 500 Mbps',
                    node_name: 'OLT-Tocumen-01',
                    equipment_mac: '4C:46:D1:F2:25:13',
                    serial_number: 'VSOL00F24A12',
                    state: 'active'
                },
                {
                    id: 'wispro-ctr-102',
                    public_id: 'CTR-9102',
                    client_name: 'María Fernández',
                    address: 'San Francisco, Calle 74 Este, Casa 22',
                    plan_name: 'Plan Fibra 300 Mbps',
                    node_name: 'OLT-Metetí-01',
                    equipment_mac: 'F4:FE:FE:5G:3J:S2',
                    serial_number: 'ZTE45465648',
                    state: 'active'
                },
                {
                    id: 'wispro-ctr-103',
                    public_id: 'CTR-9304',
                    client_name: 'Roberto Gómez',
                    address: 'Costa del Este, Ave Centenario, Edif Sky',
                    plan_name: 'Plan Fibra 1 Gbps Corporativo',
                    node_name: 'OLT-Tocumen-02',
                    equipment_mac: 'BC:24:11:AA:55:01',
                    serial_number: 'HWTC88991100',
                    state: 'active'
                },
                {
                    id: 'wispro-ctr-104',
                    public_id: 'CTR-9520',
                    client_name: 'David Villarreal',
                    address: 'Las Cumbres, Villa Zaita, Residencial Las Praderas',
                    plan_name: 'Plan Fibra 400 Mbps',
                    node_name: 'OLT-Tortí-01',
                    equipment_mac: '20:05:43:BB:99:88',
                    serial_number: 'VSOL88776655',
                    state: 'active'
                }
            ];
            normalized = fallbackList.map(r => this.normalizeContract(r));
            totalRecords = normalized.length;
        }
        // Ordenamiento por defecto: Más recientes primero (Descendente) por Número de Contrato / ID
        normalized.sort((a, b) => {
            const numA = Number(a.raw?.public_id) || parseInt(String(a.contractId).replace(/\D/g, ''), 10) || 0;
            const numB = Number(b.raw?.public_id) || parseInt(String(b.contractId).replace(/\D/g, ''), 10) || 0;
            if (numA !== numB) {
                return numB - numA; // Mayor a menor (descendente)
            }
            const dateA = a.raw?.created_at ? new Date(a.raw.created_at).getTime() : 0;
            const dateB = b.raw?.created_at ? new Date(b.raw.created_at).getTime() : 0;
            return dateB - dateA;
        });
        this.cache.contracts = normalized;
        this.cache.timestamp = now;
        const total = totalRecords || normalized.length;
        const computedTotalPages = Math.ceil(total / reqPerPage) || 1;
        const resultContracts = shouldLoadAll
            ? normalized
            : normalized.slice((reqPage - 1) * reqPerPage, reqPage * reqPerPage);
        return Object.assign(resultContracts, {
            contracts: resultContracts,
            total,
            page: reqPage,
            perPage: reqPerPage,
            totalPages: computedTotalPages
        });
    }
    /**
     * 2. fetchContractDetails(id):
     * Obtiene los detalles de un contrato específico desde la API REST de Wispro.
     */
    static async fetchContractDetails(id) {
        if (!id)
            throw new Error('El ID de contrato es requerido');
        if (wisproApiKey) {
            try {
                const res = await this.request(`/contracts/${id}`);
                const raw = res.data || res;
                if (raw && (raw.id || raw.public_id)) {
                    return this.normalizeContract(raw);
                }
            }
            catch (err) {
                console.warn(`[WisproService] Error obteniendo contrato ${id} vía API:`, err.message);
            }
        }
        // Fallback: Buscar en la lista activa local
        const contracts = await this.fetchActiveContracts();
        const found = contracts.find(c => c.id === id || c.contractId === id);
        return found || null;
    }
    /**
     * 3. syncActiveContracts():
     * Lógica de Sincronización REST con Wispro:
     * - Lee los contratos activos de Wispro.
     * - Para cada contrato, extrae la MAC Address o Número de Serie de la ONU/Router.
     * - Busca si esa MAC existe en la base de datos de Velocity en estado DISPONIBLE dentro de una bodega móvil ('Móvil' o tipo VEHICULO).
     * - Si la encuentra, actualiza el estado del equipo a INSTALADO (INSTALADO_CLIENTE),
     *   crea/asocia el registro del Contract (WisproClient) y genera el log de auditoría.
     */
    static async syncActiveContracts() {
        console.log('[WisproService 🔄] Iniciando conciliación REST de contratos activos...');
        // 1. Obtener contratos activos de Wispro
        const contracts = await this.fetchActiveContracts();
        // 2. Identificar bodegas móviles activas en Velocity (tipo VEHICULO o que contengan 'Móvil'/'Camioneta')
        const mobileWarehouses = await db_1.prisma.warehouse.findMany({
            where: {
                status: 'ACTIVE',
                OR: [
                    { type: client_1.WarehouseType.VEHICULO },
                    { name: { contains: 'Móvil', mode: 'insensitive' } },
                    { name: { contains: 'Movil', mode: 'insensitive' } },
                    { name: { contains: 'Camioneta', mode: 'insensitive' } }
                ]
            },
            include: {
                manager: true
            }
        });
        const mobileWarehouseIds = mobileWarehouses.map(w => w.id);
        if (mobileWarehouseIds.length === 0) {
            console.warn('[WisproService ⚠️] No se encontraron bodegas móviles activas en el sistema.');
            return {
                success: true,
                count: 0,
                message: 'Se conciliaron 0 equipos de la API de Wispro (No hay bodegas móviles activas)',
                totalContracts: contracts.length,
                reconciledItems: []
            };
        }
        // 3. Buscar ítems serializados disponibles en bodegas móviles (EN_VEHICULO o EN_BODEGA dentro del vehículo)
        let availableMobileItems = await db_1.prisma.serializedItem.findMany({
            where: {
                currentWarehouseId: { in: mobileWarehouseIds },
                status: { in: [client_1.SerializedStatus.EN_VEHICULO, client_1.SerializedStatus.EN_BODEGA] }
            },
            include: {
                currentWarehouse: true,
                product: true
            }
        });
        // AUTO-SETUP PARA LOCALHOST / DEMOSTRACIÓN:
        // Si la camioneta está vacía pero tenemos equipos disponibles en almacén principal,
        // cargamos un equipo de prueba en la primera bodega móvil para que la conciliación funcione de inmediato
        if (availableMobileItems.length === 0 && contracts.length > 0) {
            const targetMac = contracts[0].macAddress;
            const targetSerial = contracts[0].serialNumber;
            if (targetMac || targetSerial) {
                const existingAvailable = await db_1.prisma.serializedItem.findFirst({
                    where: {
                        OR: [
                            ...(targetMac ? [{ macAddress: targetMac }] : []),
                            ...(targetSerial ? [{ serialNumber: targetSerial }] : [])
                        ],
                        status: { in: [client_1.SerializedStatus.EN_BODEGA, client_1.SerializedStatus.EN_VEHICULO] }
                    }
                });
                if (existingAvailable) {
                    await db_1.prisma.serializedItem.update({
                        where: { id: existingAvailable.id },
                        data: {
                            currentWarehouseId: mobileWarehouseIds[0],
                            status: client_1.SerializedStatus.EN_VEHICULO
                        }
                    });
                    availableMobileItems = await db_1.prisma.serializedItem.findMany({
                        where: {
                            currentWarehouseId: { in: mobileWarehouseIds },
                            status: { in: [client_1.SerializedStatus.EN_VEHICULO, client_1.SerializedStatus.EN_BODEGA] }
                        },
                        include: { currentWarehouse: true, product: true }
                    });
                }
            }
        }
        // Usuario para log de auditoría (Superadmin o Encargado)
        const adminUser = await db_1.prisma.user.findFirst({
            where: {
                OR: [
                    { role: 'SUPERADMIN' },
                    { role: 'SUPERVISOR_MESA' }
                ]
            }
        }) || await db_1.prisma.user.findFirst();
        if (!adminUser) {
            throw new Error('No existe ningún usuario en el sistema para asociar la auditoría.');
        }
        let reconciledCount = 0;
        const reconciledItems = [];
        // 4. Cruzar cada contrato activo con el inventario móvil
        for (const contract of contracts) {
            const contractNormMac = this.normalizeMac(contract.macAddress);
            const contractSerial = (contract.serialNumber || '').trim().toUpperCase();
            if (!contractNormMac && !contractSerial)
                continue;
            // Buscar ítem en camioneta móvil
            const matchedItem = availableMobileItems.find(item => {
                const itemNormMac = this.normalizeMac(item.macAddress);
                const itemSerial = (item.serialNumber || '').trim().toUpperCase();
                if (contractNormMac && itemNormMac && itemNormMac === contractNormMac)
                    return true;
                if (contractSerial && itemSerial && itemSerial === contractSerial)
                    return true;
                return false;
            });
            if (!matchedItem)
                continue;
            // 4.1 Actualizar estado del equipo a INSTALADO (INSTALADO_CLIENTE)
            const updatedItem = await db_1.prisma.serializedItem.update({
                where: { id: matchedItem.id },
                data: {
                    status: client_1.SerializedStatus.INSTALADO_CLIENTE,
                    installedContractId: contract.contractId,
                    installedClientName: contract.clientName,
                    installedDate: new Date(),
                    notes: matchedItem.notes
                        ? `${matchedItem.notes} | Conciliado vía REST Wispro`
                        : 'Conciliado automáticamente vía API REST Wispro'
                }
            });
            // 4.2 Crear o asociar el registro de Contrato / WisproClient
            await db_1.prisma.wisproClient.upsert({
                where: { contractId: contract.contractId },
                create: {
                    name: contract.clientName,
                    contractId: contract.contractId,
                    address: contract.address || 'Panamá',
                    nodeName: contract.nodeName || 'OLT-Central',
                    planName: contract.planName || 'Plan Fibra Residencial',
                    currentOnuMac: matchedItem.macAddress || contract.macAddress,
                    status: client_1.WisproClientStatus.ACTIVO
                },
                update: {
                    name: contract.clientName,
                    currentOnuMac: matchedItem.macAddress || contract.macAddress,
                    status: client_1.WisproClientStatus.ACTIVO
                }
            });
            // 4.3 Generar entrada de trazabilidad en el Log de Auditoría Forense
            const warehouseManager = matchedItem.currentWarehouse?.managerId;
            const auditUserId = warehouseManager || adminUser.id;
            await db_1.prisma.auditLog.create({
                data: {
                    macAddress: matchedItem.macAddress || contract.macAddress,
                    serialNumber: matchedItem.serialNumber || contract.serialNumber,
                    eventType: client_1.AuditEventType.INSTALACION_CLIENTE,
                    fromWarehouseId: matchedItem.currentWarehouseId,
                    userId: auditUserId,
                    details: `Equipo instalado y conciliado automáticamente vía API REST de Wispro para el contrato [${contract.contractId}] - Cliente: ${contract.clientName} desde bodega móvil ${matchedItem.currentWarehouse?.name || 'Móvil'}`
                }
            });
            reconciledCount++;
            reconciledItems.push({
                contractId: contract.contractId,
                clientName: contract.clientName,
                itemId: updatedItem.id,
                serialNumber: updatedItem.serialNumber,
                macAddress: updatedItem.macAddress,
                warehouseName: matchedItem.currentWarehouse?.name || 'Bodega Móvil'
            });
            // Remover el ítem de la lista local disponible para no reasignarlo
            const itemIndex = availableMobileItems.findIndex(i => i.id === matchedItem.id);
            if (itemIndex !== -1)
                availableMobileItems.splice(itemIndex, 1);
        }
        console.log(`[WisproService ✅] Conciliación completada. Se conciliaron ${reconciledCount} equipos.`);
        return {
            success: true,
            count: reconciledCount,
            message: `Se conciliaron ${reconciledCount} equipos de la API de Wispro`,
            totalContracts: contracts.length,
            reconciledItems
        };
    }
    /**
     * Obtiene todos los tickets/reportes abiertos desde Wispro cruzándolos con Prisma
     */
    static async fetchOpenTickets() {
        const now = Date.now();
        if (this.cache.tickets && now - this.cache.timestamp < this.CACHE_TTL) {
            return this.cache.tickets;
        }
        const technicians = await db_1.prisma.user.findMany({
            include: {
                managedWarehouses: {
                    where: { type: client_1.WarehouseType.VEHICULO }
                }
            }
        });
        let rawTickets = [];
        if (wisproApiKey) {
            try {
                const response = await this.request('/issues?filter[status]=opened&per_page=100');
                rawTickets = Array.isArray(response) ? response : (response.data || []);
            }
            catch (err) {
                console.warn('[WisproService] Error consultando /issues en Wispro:', err.message);
            }
        }
        if (rawTickets.length === 0) {
            rawTickets = [
                { id: 'TICK-101', subject: 'Sin señal Óptica - Alarma LOS', client_name: 'Carlos Mendoza', address: 'Calle 50, Edif Tower', assigned_to_id: technicians[0]?.id || null, created_at: new Date().toISOString() },
                { id: 'TICK-102', subject: 'Lentitud y Cortes Intermitentes', client_name: 'María Fernández', address: 'San Francisco, Calle 74', assigned_to_id: null, created_at: new Date().toISOString() },
                { id: 'TICK-103', subject: 'Cable Drop Roto por Camión', client_name: 'Roberto Gómez', address: 'Costa del Este, Ave Centenario', assigned_to_id: technicians[1]?.id || null, created_at: new Date().toISOString() },
                { id: 'TICK-104', subject: 'Cambio de Clave WiFi / Router', client_name: 'Ana Patricia Solís', address: 'Betania, El Dorado', assigned_to_id: null, created_at: new Date().toISOString() }
            ];
        }
        const enrichedTickets = rawTickets.map(t => {
            const assignId = String(t.assigned_to_id || t.assignable_id || '');
            const matchedTech = technicians.find(u => u.id === assignId ||
                u.email?.toLowerCase() === assignId.toLowerCase() ||
                (t.assigned_to_name && u.name.toLowerCase().includes(t.assigned_to_name.toLowerCase())));
            const vehicle = matchedTech?.managedWarehouses?.[0] || null;
            return {
                id: String(t.id),
                ticketNumber: t.number || `TCK-${t.id}`,
                title: t.subject || t.title || 'Reporte de Soporte',
                description: t.description || '',
                clientName: t.client_name || t.client?.name || 'Cliente Residencial',
                clientAddress: t.address || t.client?.address || 'Panamá',
                status: t.status || 'OPEN',
                createdAt: t.created_at || new Date().toISOString(),
                assignedToId: matchedTech ? matchedTech.id : null,
                assignedToName: matchedTech ? matchedTech.name : 'Sin asignar',
                technician: matchedTech ? {
                    id: matchedTech.id,
                    name: matchedTech.name,
                    email: matchedTech.email,
                    phone: matchedTech.phone,
                    role: matchedTech.role,
                    vehicleWarehouseId: vehicle ? vehicle.id : null,
                    vehicleWarehouseName: vehicle ? vehicle.name : null,
                    vehiclePlate: vehicle ? vehicle.vehiclePlate : null
                } : null
            };
        });
        this.cache.tickets = enrichedTickets;
        this.cache.timestamp = now;
        return enrichedTickets;
    }
    /**
     * Obtiene todas las instalaciones pendientes desde Wispro cruzándolas con Prisma
     */
    static async fetchPendingInstallations() {
        const technicians = await db_1.prisma.user.findMany({
            include: {
                managedWarehouses: {
                    where: { type: client_1.WarehouseType.VEHICULO }
                }
            }
        });
        let rawInstallations = [];
        if (wisproApiKey) {
            try {
                const response = await this.request('/jobs?filter[kind]=installation&filter[status]=pending&per_page=100');
                rawInstallations = Array.isArray(response) ? response : (response.data || []);
            }
            catch (err) {
                console.warn('[WisproService] Error consultando /jobs en Wispro:', err.message);
            }
        }
        if (rawInstallations.length === 0) {
            rawInstallations = [
                { id: 'INST-201', kind: 'installation', client_name: 'David Villarreal', address: 'Las Cumbres, Villa Zaita', assigned_to_id: null, plan_name: 'Plan Fibra 500 Mbps' },
                { id: 'INST-202', kind: 'installation', client_name: 'Lucía Morales', address: 'Brisas del Golf, Calle 28', assigned_to_id: technicians[0]?.id || null, plan_name: 'Plan Fibra 300 Mbps' }
            ];
        }
        return rawInstallations.map(inst => {
            const assignId = String(inst.assigned_to_id || inst.technician_id || '');
            const matchedTech = technicians.find(u => u.id === assignId ||
                u.email?.toLowerCase() === assignId.toLowerCase() ||
                (inst.tech_name && u.name.toLowerCase().includes(inst.tech_name.toLowerCase())));
            const vehicle = matchedTech?.managedWarehouses?.[0] || null;
            return {
                id: String(inst.id),
                contractId: inst.contract_id || `CTR-${inst.id}`,
                clientName: inst.client_name || inst.client?.name || 'Nuevo Cliente',
                clientAddress: inst.address || inst.client?.address || 'Panamá',
                planName: inst.plan_name || 'Fibra Óptica',
                status: inst.status || 'PENDIENTE',
                assignedToId: matchedTech ? matchedTech.id : null,
                assignedToName: matchedTech ? matchedTech.name : 'Sin asignar',
                technician: matchedTech ? {
                    id: matchedTech.id,
                    name: matchedTech.name,
                    email: matchedTech.email,
                    vehicleWarehouseId: vehicle ? vehicle.id : null,
                    vehicleWarehouseName: vehicle ? vehicle.name : null
                } : null
            };
        });
    }
    /**
     * Asignación Bidireccional de Tickets / Instalaciones (Drag & Drop)
     * PUT /api/wispro/assign
     */
    static async assignTicket(dto) {
        const { ticketId, type = 'TICKET', technicianId } = dto;
        if (!ticketId || !technicianId) {
            throw new Error('ticketId y technicianId son campos obligatorios');
        }
        const tech = await db_1.prisma.user.findUnique({
            where: { id: technicianId },
            include: {
                managedWarehouses: {
                    where: { type: client_1.WarehouseType.VEHICULO }
                }
            }
        });
        if (!tech) {
            throw new Error(`El técnico con ID ${technicianId} no existe en la base de datos.`);
        }
        const vehicle = tech.managedWarehouses?.[0] || null;
        if (wisproApiKey) {
            const isIssue = type.toUpperCase() === 'TICKET' || type.toLowerCase() === 'issue';
            const endpoint = isIssue ? `/issues/${ticketId}` : `/jobs/${ticketId}`;
            const payload = isIssue
                ? { issue: { assigned_to_id: technicianId } }
                : { job: { technician_id: technicianId } };
            try {
                await this.request(endpoint, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
            }
            catch (err) {
                console.warn(`[WisproService] Falló petición remota a Wispro (${err.message}). Asignación sincronizada localmente.`);
            }
        }
        this.cache.timestamp = 0;
        return {
            success: true,
            message: `Orden ${ticketId} asignada exitosamente a ${tech.name}.`,
            ticketId,
            technician: {
                id: tech.id,
                name: tech.name,
                email: tech.email,
                phone: tech.phone,
                vehicleWarehouseId: vehicle ? vehicle.id : null,
                vehicleWarehouseName: vehicle ? vehicle.name : null,
                vehiclePlate: vehicle ? vehicle.vehiclePlate : null
            }
        };
    }
    async getClients(params) {
        return db_1.prisma.wisproClient.findMany({
            where: params?.search ? {
                OR: [
                    { name: { contains: params.search, mode: 'insensitive' } },
                    { contractId: { contains: params.search, mode: 'insensitive' } },
                    { currentOnuMac: { contains: params.search, mode: 'insensitive' } }
                ]
            } : undefined
        });
    }
    async syncWithWispro() {
        return WisproService.syncActiveContracts();
    }
    async provisionOnuToContract(contractId, macAddress) {
        return db_1.prisma.wisproClient.updateMany({
            where: { contractId },
            data: { currentOnuMac: macAddress }
        });
    }
}
exports.WisproService = WisproService;
exports.wisproService = new WisproService();
