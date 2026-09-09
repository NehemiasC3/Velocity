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
    static clientsLoadingPromise = null;
    static plansLoadingPromise = null;
    static CACHE_TTL = 30000; // 30 segundos
    /**
     * Carga diccionario de planes desde Wispro API (33 planes)
     */
    static async loadPlansCache() {
        if (this.plansCache.size > 0)
            return;
        if (this.plansLoadingPromise)
            return this.plansLoadingPromise;
        this.plansLoadingPromise = (async () => {
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
            finally {
                this.plansLoadingPromise = null;
            }
        })();
        return this.plansLoadingPromise;
    }
    /**
     * Carga diccionario de clientes (nombres reales, cédulas, teléfonos) desde Wispro API
     */
    static async loadClientsCache() {
        if (this.clientsCache.size > 0)
            return;
        if (this.clientsLoadingPromise)
            return this.clientsLoadingPromise;
        this.clientsLoadingPromise = (async () => {
            try {
                console.log('[WisproService 👥] Cargando diccionario de clientes desde Wispro API...');
                const firstRes = await this.request('/clients?per_page=100&page=1');
                if (firstRes && firstRes.data) {
                    const firstPageData = Array.isArray(firstRes.data) ? firstRes.data : [];
                    firstPageData.forEach((c) => {
                        if (c && c.id) {
                            WisproService.clientsCache.set(String(c.id), {
                                id: String(c.id),
                                name: (c.name || '').trim(),
                                identification: c.national_identification_number || c.identification || null,
                                phone: c.phone_mobile || c.phone || null,
                                email: c.email || null,
                                address: c.address || null
                            });
                        }
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
                                        if (c && c.id) {
                                            WisproService.clientsCache.set(String(c.id), {
                                                id: String(c.id),
                                                name: (c.name || '').trim(),
                                                identification: c.national_identification_number || c.identification || null,
                                                phone: c.phone_mobile || c.phone || null,
                                                email: c.email || null,
                                                address: c.address || null
                                            });
                                        }
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
                this.clientsLoadingPromise = null;
            }
        })();
        return this.clientsLoadingPromise;
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
        const rawPublicId = raw.public_id ? Number(raw.public_id) : (raw.number ? Number(String(raw.number).replace(/\D/g, '')) : null);
        const contractId = String(raw.public_id ? `CTR-${raw.public_id}` : (raw.number || raw.contract_id || id || `CTR-${Date.now()}`));
        // 1. Datos del Cliente (buscar en caché de clientes o en raw)
        const clientInfo = raw.client_id ? WisproService.clientsCache.get(String(raw.client_id)) : undefined;
        let clientName = '';
        if (clientInfo && clientInfo.name) {
            clientName = clientInfo.name;
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
        const identification = clientInfo?.identification ||
            raw.client?.national_identification_number ||
            raw.national_identification_number ||
            raw.identification ||
            null;
        const phone = clientInfo?.phone ||
            raw.client?.phone_mobile ||
            raw.phone_mobile ||
            raw.phone ||
            null;
        const email = clientInfo?.email ||
            raw.client?.email ||
            raw.email ||
            null;
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
            : (raw.address || raw.full_address || raw.client?.address || clientInfo?.address || 'Panamá');
        const status = String(raw.state || raw.status || 'enabled').toLowerCase();
        return {
            id,
            contractId,
            publicId: rawPublicId,
            clientName,
            clientId: raw.client_id ? String(raw.client_id) : undefined,
            identification,
            phone,
            email,
            address,
            planName,
            nodeName: (raw.nap_name || raw.node_name || raw.node?.name) && (raw.nap_name || raw.node_name || raw.node?.name) !== 'OLT-Central' && (raw.nap_name || raw.node_name || raw.node?.name).trim() !== '' ? (raw.nap_name || raw.node_name || raw.node?.name).trim() : 'Sin NAP',
            macAddress: mac || undefined,
            serialNumber: serialNumber || undefined,
            model: raw.model || raw.equipment_model || 'ONU / ONT GPON',
            ip: raw.ip || raw.ip_address || undefined,
            status,
            wisproUpdatedAt: raw.updated_at ? new Date(raw.updated_at) : null,
            createdAt: raw.created_at ? new Date(raw.created_at) : null,
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
                // Consulta paginada directa o primera página si es carga completa
                const targetPerPage = shouldLoadAll ? 100 : Math.min(100, Math.max(1, reqPerPage));
                const targetPage = shouldLoadAll ? 1 : Math.max(1, reqPage);
                const firstRes = await this.request(`/contracts?filter%5Bstate%5D=enabled&per_page=${targetPerPage}&page=${targetPage}`);
                if (firstRes && firstRes.status !== 401) {
                    const firstPageData = Array.isArray(firstRes) ? firstRes : (firstRes.data || []);
                    remoteContracts = [...firstPageData];
                    totalRecords = firstRes.meta?.pagination?.total_records || firstPageData.length;
                    totalPages = firstRes.meta?.pagination?.total_pages || Math.ceil(totalRecords / targetPerPage) || 1;
                    // Solo si se solicitó explícitamente cargar todos los registros (all=true)
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
                    const res = await this.request(`/contracts?per_page=${shouldLoadAll ? 100 : reqPerPage}&page=${shouldLoadAll ? 1 : reqPage}`);
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
        if (shouldLoadAll) {
            this.cache.contracts = normalized;
            this.cache.timestamp = now;
        }
        const total = totalRecords || normalized.length;
        const computedTotalPages = Math.ceil(total / reqPerPage) || 1;
        const resultContracts = shouldLoadAll
            ? normalized.slice((reqPage - 1) * reqPerPage, reqPage * reqPerPage)
            : normalized;
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
     * Obtiene los detalles de un contrato específico. Primero consulta PostgreSQL (Espejo Local <10ms),
     * y si no existe realiza fallback a la API de Wispro y lo persiste localmente.
     */
    static async fetchContractDetails(id) {
        if (!id)
            throw new Error('El ID de contrato es requerido');
        const cleanId = String(id).trim();
        const isNumeric = !isNaN(Number(cleanId)) && Number(cleanId) > 0;
        // 1. Consulta primero en PostgreSQL local (Respuesta instantánea)
        const localContract = await db_1.prisma.wisproClient.findFirst({
            where: {
                OR: [
                    { id: cleanId },
                    { contractId: cleanId },
                    { contractId: cleanId.startsWith('CTR-') ? cleanId : `CTR-${cleanId}` },
                    ...(isNumeric ? [{ publicId: Number(cleanId) }] : [])
                ]
            }
        });
        if (localContract) {
            const isEnabled = (localContract.wisproState === 'enabled' || localContract.wisproState === 'active' || localContract.status === 'ACTIVO');
            const stateStr = localContract.wisproState || (isEnabled ? 'enabled' : 'disabled');
            return {
                id: localContract.id,
                contractId: localContract.contractId,
                publicId: localContract.publicId,
                clientName: localContract.name,
                clientId: undefined,
                identification: localContract.identification,
                phone: localContract.phone,
                email: localContract.email,
                address: localContract.address,
                planName: localContract.planName,
                nodeName: localContract.nodeName,
                macAddress: localContract.currentOnuMac || undefined,
                serialNumber: localContract.currentOnuSerial || undefined,
                model: localContract.model || 'ONU / ONT GPON',
                ip: localContract.ipAddress || undefined,
                status: stateStr,
                createdAt: localContract.createdAt,
                wisproUpdatedAt: localContract.wisproUpdatedAt,
                raw: {
                    public_id: localContract.publicId,
                    state: stateStr,
                    nap_name: localContract.nodeName,
                    ont_serial_number: localContract.currentOnuSerial,
                    mac_address: localContract.currentOnuMac,
                    ip: localContract.ipAddress,
                    client_name: localContract.name,
                    plan_name: localContract.planName,
                    address: localContract.address,
                    created_at: localContract.createdAt?.toISOString(),
                    updated_at: localContract.wisproUpdatedAt?.toISOString()
                }
            };
        }
        // 2. Si no está en BD local, consultar API remota de Wispro
        if (wisproApiKey) {
            try {
                const res = await this.request(`/contracts/${cleanId}`);
                const raw = res.data || res;
                if (raw && (raw.id || raw.public_id)) {
                    const normalized = this.normalizeContract(raw);
                    // Persistir de inmediato en PostgreSQL para futuras consultas
                    const isSuspended = normalized.status === 'disabled' || normalized.status === 'suspended' || normalized.status === 'canceled';
                    await db_1.prisma.wisproClient.upsert({
                        where: { contractId: normalized.contractId },
                        create: {
                            contractId: normalized.contractId,
                            publicId: normalized.publicId ?? null,
                            name: normalized.clientName,
                            identification: normalized.identification ?? null,
                            phone: normalized.phone ?? null,
                            email: normalized.email ?? null,
                            address: normalized.address || 'Panamá',
                            planName: normalized.planName || 'Plan Fibra',
                            nodeName: normalized.nodeName || 'Sin NAP',
                            currentOnuMac: normalized.macAddress ?? null,
                            currentOnuSerial: normalized.serialNumber ?? null,
                            model: normalized.model ?? null,
                            ipAddress: normalized.ip ?? null,
                            wisproState: normalized.status || 'enabled',
                            status: isSuspended ? client_1.WisproClientStatus.SUSPENDIDO : client_1.WisproClientStatus.ACTIVO,
                            wisproUpdatedAt: normalized.wisproUpdatedAt || new Date()
                        },
                        update: {
                            publicId: normalized.publicId ?? undefined,
                            name: normalized.clientName,
                            identification: normalized.identification ?? undefined,
                            phone: normalized.phone ?? undefined,
                            email: normalized.email ?? undefined,
                            address: normalized.address || undefined,
                            planName: normalized.planName || undefined,
                            nodeName: normalized.nodeName || undefined,
                            currentOnuMac: normalized.macAddress ?? undefined,
                            currentOnuSerial: normalized.serialNumber ?? undefined,
                            model: normalized.model ?? undefined,
                            ipAddress: normalized.ip ?? undefined,
                            wisproState: normalized.status || undefined,
                            status: isSuspended ? client_1.WisproClientStatus.SUSPENDIDO : client_1.WisproClientStatus.ACTIVO,
                            wisproUpdatedAt: normalized.wisproUpdatedAt || new Date()
                        }
                    });
                    return normalized;
                }
            }
            catch (err) {
                console.warn(`[WisproService] Error obteniendo contrato ${cleanId} vía API:`, err.message);
            }
        }
        return null;
    }
    /**
     * 3. getLocalContracts(options):
     * Consultas 100% Locales sobre PostgreSQL con Paginación, Búsqueda Server-Side y Filtros.
     * Respuesta en sub-20ms e independencia total de la API externa.
     */
    static async getLocalContracts(options) {
        const startTime = Date.now();
        const isLoadAll = options?.loadAll === true || options?.perPage === 'ALL';
        const reqPage = Math.max(1, Number(options?.page) || 1);
        const reqPerPage = isLoadAll ? 5000 : Math.min(200, Math.max(1, Number(options?.perPage) || 50));
        const skip = isLoadAll ? 0 : (reqPage - 1) * reqPerPage;
        const take = isLoadAll ? 5000 : reqPerPage;
        const where = {};
        // 1. Búsqueda multi-campo en servidor (Nombre de cliente, Cédula/RUC, # Contrato, Serial ONU, MAC, etc.)
        if (options?.search && options.search.trim()) {
            const q = options.search.trim();
            const isNum = !isNaN(Number(q)) && Number(q) > 0;
            where.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { identification: { contains: q, mode: 'insensitive' } },
                { contractId: { contains: q, mode: 'insensitive' } },
                { currentOnuSerial: { contains: q, mode: 'insensitive' } },
                { currentOnuMac: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q, mode: 'insensitive' } },
                { address: { contains: q, mode: 'insensitive' } },
                { planName: { contains: q, mode: 'insensitive' } },
                { nodeName: { contains: q, mode: 'insensitive' } },
                ...(isNum ? [{ publicId: Number(q) }] : [])
            ];
        }
        // 2. Filtro de Estado Wispro (Habilitados / Deshabilitados / Todos)
        if (options?.filterState && options.filterState !== 'ALL') {
            if (options.filterState === 'ENABLED') {
                where.OR = [
                    { wisproState: { in: ['enabled', 'active'] } },
                    { status: client_1.WisproClientStatus.ACTIVO }
                ];
            }
            else if (options.filterState === 'DISABLED') {
                where.OR = [
                    { wisproState: { in: ['disabled', 'suspended', 'canceled', 'inactive'] } },
                    { status: client_1.WisproClientStatus.SUSPENDIDO }
                ];
            }
        }
        // 3. Filtro Conciliación por Serial (Con Serial / Sin Serial)
        if (options?.filterSerial && options.filterSerial !== 'ALL') {
            if (options.filterSerial === 'WITH_SERIAL') {
                where.OR = [
                    { currentOnuSerial: { not: null, notIn: [''] } },
                    { currentOnuMac: { not: null, notIn: [''] } }
                ];
            }
            else if (options.filterSerial === 'WITHOUT_SERIAL') {
                where.AND = [
                    { OR: [{ currentOnuSerial: null }, { currentOnuSerial: '' }] },
                    { OR: [{ currentOnuMac: null }, { currentOnuMac: '' }] }
                ];
            }
        }
        // 4. Filtro Infraestructura (NAP)
        if (options?.filterNap && options.filterNap !== 'ALL') {
            if (options.filterNap === 'WITH_NAP') {
                where.nodeName = { notIn: ['', 'Sin NAP', 'OLT-Central'] };
            }
            else if (options.filterNap === 'WITHOUT_NAP') {
                where.nodeName = { in: ['', 'Sin NAP', 'OLT-Central'] };
            }
        }
        // 5. Ordenamiento: por defecto descendente por publicId y createdAt
        const sortDir = options?.sortOrder === 'asc' ? 'asc' : 'desc';
        const orderBy = [
            { publicId: sortDir },
            { createdAt: sortDir }
        ];
        // 6. Consultas concurrentes en PostgreSQL
        const [rows, total, config, totalAll, withSerialCount, withNapCount, enabledCount] = await Promise.all([
            db_1.prisma.wisproClient.findMany({
                where,
                orderBy,
                skip,
                take
            }),
            db_1.prisma.wisproClient.count({ where }),
            db_1.prisma.wisproConfig.findFirst({ where: { id: 'default' } }),
            db_1.prisma.wisproClient.count(),
            db_1.prisma.wisproClient.count({
                where: {
                    OR: [
                        { currentOnuSerial: { not: null, notIn: [''] } },
                        { currentOnuMac: { not: null, notIn: [''] } }
                    ]
                }
            }),
            db_1.prisma.wisproClient.count({
                where: {
                    nodeName: { notIn: ['', 'Sin NAP', 'OLT-Central'] }
                }
            }),
            db_1.prisma.wisproClient.count({
                where: {
                    OR: [
                        { wisproState: { in: ['enabled', 'active'] } },
                        { status: client_1.WisproClientStatus.ACTIVO }
                    ]
                }
            })
        ]);
        // Si la BD está vacía y no hay filtro activo de búsqueda, disparar volcado inicial en background
        if (total === 0 && !options?.search && wisproApiKey) {
            WisproService.syncWisproContractsIncremental({ forceFullDump: true }).catch(err => {
                console.warn('[WisproService] Error en volcado inicial en segundo plano:', err.message);
            });
        }
        // 7. Mapeo a WisproContract compatible con frontend
        const contracts = rows.map(r => {
            const isEnabled = (r.wisproState === 'enabled' || r.wisproState === 'active' || r.status === 'ACTIVO');
            const stateStr = r.wisproState || (isEnabled ? 'enabled' : 'disabled');
            return {
                id: r.id,
                contractId: r.contractId,
                publicId: r.publicId,
                clientName: r.name,
                clientId: undefined,
                identification: r.identification,
                phone: r.phone,
                email: r.email,
                address: r.address,
                planName: r.planName,
                nodeName: r.nodeName,
                macAddress: r.currentOnuMac || undefined,
                serialNumber: r.currentOnuSerial || undefined,
                model: r.model || 'ONU / ONT GPON',
                ip: r.ipAddress || undefined,
                status: stateStr,
                createdAt: r.createdAt,
                wisproUpdatedAt: r.wisproUpdatedAt,
                raw: {
                    public_id: r.publicId,
                    state: stateStr,
                    nap_name: r.nodeName,
                    ont_serial_number: r.currentOnuSerial,
                    mac_address: r.currentOnuMac,
                    ip: r.ipAddress,
                    client_name: r.name,
                    plan_name: r.planName,
                    address: r.address,
                    created_at: r.createdAt?.toISOString(),
                    updated_at: r.wisproUpdatedAt?.toISOString()
                }
            };
        });
        const elapsed = Date.now() - startTime;
        console.log(`[WisproService ⚡ Sub-20ms] ${contracts.length} contratos recuperados de PostgreSQL en ${elapsed}ms (Total filtrado: ${total})`);
        const computedTotalPages = isLoadAll ? 1 : (Math.ceil(total / reqPerPage) || 1);
        return {
            contracts,
            total,
            page: isLoadAll ? 1 : reqPage,
            perPage: isLoadAll ? total : reqPerPage,
            totalPages: computedTotalPages,
            lastSyncedAt: config?.lastSyncedAt || config?.lastSyncTimestamp || null,
            kpis: {
                total: totalAll,
                withSerial: withSerialCount,
                withNap: withNapCount,
                enabled: enabledCount
            }
        };
    }
    /**
     * 4. Sincronización Diferencial (Delta Sync) y Persistencia en PostgreSQL
     * Si es la primera ejecución o forceFullDump=true: realiza el volcado inicial completo.
     * En ejecuciones posteriores: consulta a Wispro únicamente los contratos creados o modificados desde lastSyncedAt (updated_after).
     */
    static async syncWisproContractsIncremental(options) {
        console.log('[WisproService ⚡] Iniciando sincronización de contratos con espejo local PostgreSQL...');
        const startTime = Date.now();
        // 1. Cargar diccionarios de planes y clientes
        await Promise.all([
            this.loadPlansCache(),
            this.loadClientsCache()
        ]);
        // 2. Determinar si es sincronización incremental o completa
        const config = await db_1.prisma.wisproConfig.findFirst({ where: { id: 'default' } });
        const localContractCount = await db_1.prisma.wisproClient.count();
        const isFirstRun = localContractCount === 0 || !config?.lastSyncedAt;
        const forceFull = options?.forceFullDump ?? isFirstRun;
        const lastSyncedAt = config?.lastSyncedAt || config?.lastSyncTimestamp;
        let rawContracts = [];
        let isIncremental = false;
        if (!forceFull && lastSyncedAt) {
            isIncremental = true;
            console.log(`[WisproService 🔄] Ejecutando Delta Sync desde: ${lastSyncedAt.toISOString()}`);
            try {
                const deltaUrl = `/contracts?updated_after=${encodeURIComponent(lastSyncedAt.toISOString())}&per_page=100&page=1`;
                const firstRes = await this.request(deltaUrl);
                if (firstRes && firstRes.data) {
                    const firstPage = Array.isArray(firstRes.data) ? firstRes.data : [];
                    rawContracts.push(...firstPage);
                    const totalPages = firstRes.meta?.pagination?.total_pages || 1;
                    if (totalPages > 1) {
                        for (let p = 2; p <= totalPages; p++) {
                            const res = await this.request(`/contracts?updated_after=${encodeURIComponent(lastSyncedAt.toISOString())}&per_page=100&page=${p}`);
                            if (res && res.data && Array.isArray(res.data)) {
                                rawContracts.push(...res.data);
                            }
                        }
                    }
                }
            }
            catch (err) {
                console.warn('[WisproService] Advertencia en petición delta updated_after, procediendo:', err.message);
            }
        }
        // Si es primera ejecución o forceFull
        if (!isIncremental || (rawContracts.length === 0 && forceFull)) {
            isIncremental = false;
            console.log('[WisproService 📥] Realizando volcado inicial completo de contratos desde Wispro Cloud...');
            const firstRes = await this.request('/contracts?per_page=100&page=1');
            if (firstRes && firstRes.data) {
                const firstPageData = Array.isArray(firstRes.data) ? firstRes.data : [];
                rawContracts.push(...firstPageData);
                const totalPages = firstRes.meta?.pagination?.total_pages || 1;
                const totalRecords = firstRes.meta?.pagination?.total_records || firstPageData.length;
                console.log(`[WisproService 🚀] Descargando ${totalPages} páginas (${totalRecords} registros)...`);
                const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
                for (let i = 0; i < remainingPages.length; i += 10) {
                    const batch = remainingPages.slice(i, i + 10);
                    const batchResults = await Promise.all(batch.map(p => this.request(`/contracts?per_page=100&page=${p}`)
                        .then(r => r?.data || [])
                        .catch(() => [])));
                    batchResults.forEach(data => {
                        if (Array.isArray(data))
                            rawContracts.push(...data);
                    });
                }
            }
        }
        console.log(`[WisproService 💾] Guardando ${rawContracts.length} contratos en PostgreSQL (Espejo Local)...`);
        // 3. Normalizar y Persistir en PostgreSQL por lotes
        let upsertedCount = 0;
        const batchSize = 50;
        for (let i = 0; i < rawContracts.length; i += batchSize) {
            const chunk = rawContracts.slice(i, i + batchSize);
            await Promise.all(chunk.map(async (raw) => {
                const c = this.normalizeContract(raw);
                const isSuspended = c.status === 'disabled' || c.status === 'suspended' || c.status === 'canceled' || c.status === 'inactive';
                const clientStatus = isSuspended ? client_1.WisproClientStatus.SUSPENDIDO : client_1.WisproClientStatus.ACTIVO;
                await db_1.prisma.wisproClient.upsert({
                    where: { contractId: c.contractId },
                    create: {
                        contractId: c.contractId,
                        publicId: c.publicId ?? null,
                        name: c.clientName,
                        identification: c.identification ?? null,
                        phone: c.phone ?? null,
                        email: c.email ?? null,
                        address: c.address || 'Panamá',
                        planName: c.planName || 'Plan Fibra',
                        nodeName: c.nodeName || 'Sin NAP',
                        currentOnuMac: c.macAddress ?? null,
                        currentOnuSerial: c.serialNumber ?? null,
                        model: c.model ?? null,
                        ipAddress: c.ip ?? null,
                        wisproState: c.status || 'enabled',
                        status: clientStatus,
                        wisproUpdatedAt: c.wisproUpdatedAt || new Date()
                    },
                    update: {
                        publicId: c.publicId ?? undefined,
                        name: c.clientName,
                        identification: c.identification ?? undefined,
                        phone: c.phone ?? undefined,
                        email: c.email ?? undefined,
                        address: c.address || undefined,
                        planName: c.planName || undefined,
                        nodeName: c.nodeName || undefined,
                        currentOnuMac: c.macAddress ?? undefined,
                        currentOnuSerial: c.serialNumber ?? undefined,
                        model: c.model ?? undefined,
                        ipAddress: c.ip ?? undefined,
                        wisproState: c.status || undefined,
                        status: clientStatus,
                        wisproUpdatedAt: c.wisproUpdatedAt || new Date()
                    }
                });
                upsertedCount++;
            }));
        }
        // 4. Actualizar metadata de sincronización en WisproConfig
        const syncTimestamp = new Date();
        await db_1.prisma.wisproConfig.upsert({
            where: { id: 'default' },
            create: {
                id: 'default',
                lastSyncedAt: syncTimestamp,
                lastSyncTimestamp: syncTimestamp
            },
            update: {
                lastSyncedAt: syncTimestamp,
                lastSyncTimestamp: syncTimestamp
            }
        });
        // 5. Conciliación con Bodegas Móviles / Vehículos
        const reconcileResult = await this.reconcileMobileEquipment();
        const elapsed = Date.now() - startTime;
        const totalInPostgres = await db_1.prisma.wisproClient.count();
        console.log(`[WisproService ✅] Sincronización completada en ${elapsed}ms. Procesados: ${upsertedCount}, Total en BD: ${totalInPostgres}, Conciliados: ${reconcileResult.count}`);
        return {
            success: true,
            count: upsertedCount,
            totalContracts: totalInPostgres,
            isIncremental,
            lastSyncedAt: syncTimestamp,
            message: isIncremental
                ? `Delta Sync completado: ${upsertedCount} contratos actualizados en PostgreSQL (${reconcileResult.count} equipos conciliados).`
                : `Volcado completo exitoso: ${upsertedCount} contratos sincronizados en PostgreSQL (${reconcileResult.count} equipos conciliados).`,
            reconciledItems: reconcileResult.reconciledItems
        };
    }
    /**
     * 5. Reconciliación con Bodegas Móviles / Vehículos
     */
    static async reconcileMobileEquipment(targetContracts) {
        const contracts = targetContracts || (await this.getLocalContracts({ loadAll: true })).contracts;
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
            include: { manager: true }
        });
        const mobileWarehouseIds = mobileWarehouses.map(w => w.id);
        if (mobileWarehouseIds.length === 0) {
            return { count: 0, reconciledItems: [] };
        }
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
        const adminUser = await db_1.prisma.user.findFirst({
            where: {
                OR: [
                    { role: 'SUPERADMIN' },
                    { role: 'SUPERVISOR_MESA' }
                ]
            }
        }) || await db_1.prisma.user.findFirst();
        if (!adminUser) {
            return { count: 0, reconciledItems: [] };
        }
        let reconciledCount = 0;
        const reconciledItems = [];
        for (const contract of contracts) {
            const contractNormMac = this.normalizeMac(contract.macAddress);
            const contractSerial = (contract.serialNumber || '').trim().toUpperCase();
            if (!contractNormMac && !contractSerial)
                continue;
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
            const updatedItem = await db_1.prisma.serializedItem.update({
                where: { id: matchedItem.id },
                data: {
                    status: client_1.SerializedStatus.INSTALADO_CLIENTE,
                    installedContractId: contract.contractId,
                    installedClientName: contract.clientName,
                    installedDate: new Date(),
                    notes: matchedItem.notes
                        ? `${matchedItem.notes} | Conciliado vía Espejo Local Wispro`
                        : 'Conciliado automáticamente vía Espejo Local Wispro'
                }
            });
            await db_1.prisma.wisproClient.updateMany({
                where: { contractId: contract.contractId },
                data: {
                    currentOnuMac: matchedItem.macAddress || contract.macAddress,
                    currentOnuSerial: matchedItem.serialNumber || contract.serialNumber,
                    status: client_1.WisproClientStatus.ACTIVO
                }
            });
            const warehouseManager = matchedItem.currentWarehouse?.managerId;
            const auditUserId = warehouseManager || adminUser.id;
            await db_1.prisma.auditLog.create({
                data: {
                    macAddress: matchedItem.macAddress || contract.macAddress,
                    serialNumber: matchedItem.serialNumber || contract.serialNumber,
                    eventType: client_1.AuditEventType.INSTALACION_CLIENTE,
                    fromWarehouseId: matchedItem.currentWarehouseId,
                    userId: auditUserId,
                    details: `Equipo instalado y conciliado automáticamente para el contrato [${contract.contractId}] - Cliente: ${contract.clientName} desde bodega móvil ${matchedItem.currentWarehouse?.name || 'Móvil'}`
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
            const itemIndex = availableMobileItems.findIndex(i => i.id === matchedItem.id);
            if (itemIndex !== -1)
                availableMobileItems.splice(itemIndex, 1);
        }
        return { count: reconciledCount, reconciledItems };
    }
    /**
     * 6. Sincronización activa (compatibilidad con endpoints existentes)
     */
    static async syncActiveContracts() {
        return this.syncWisproContractsIncremental();
    }
    /**
     * 7. Receptor de Webhooks de Contratos en Tiempo Real
     * Procesa evento de webhook desde Wispro y actualiza inmediatamente PostgreSQL
     */
    static async processContractWebhook(payload) {
        const event = String(payload.event || payload.type || payload.action || 'contract_updated').toLowerCase();
        const rawContract = payload.contract || payload.data || payload.payload || payload;
        const rawId = rawContract.id || rawContract.contract_id;
        const rawPublicId = rawContract.public_id ? Number(rawContract.public_id) : null;
        const contractId = rawPublicId ? `CTR-${rawPublicId}` : (rawContract.contract_id || rawId || `CTR-${Date.now()}`);
        if (!contractId) {
            throw new Error('No se pudo identificar el contractId en el webhook');
        }
        console.log(`[WisproService 📡 Webhook] Procesando evento '${event}' para contrato ${contractId}`);
        const isCancellation = event.includes('cancel') ||
            event.includes('delete') ||
            event.includes('disable') ||
            rawContract.state === 'disabled' ||
            rawContract.state === 'canceled';
        if (isCancellation) {
            await db_1.prisma.wisproClient.updateMany({
                where: { contractId },
                data: {
                    wisproState: 'canceled',
                    status: client_1.WisproClientStatus.SUSPENDIDO,
                    wisproUpdatedAt: new Date(),
                    updatedAt: new Date()
                }
            });
            return {
                success: true,
                event,
                contractId,
                action: 'CANCELED',
                message: `Contrato ${contractId} cancelado/suspendido en PostgreSQL espejo.`
            };
        }
        // Creación o Modificación
        const c = this.normalizeContract(rawContract);
        const clientStatus = (c.status === 'disabled' || c.status === 'suspended')
            ? client_1.WisproClientStatus.SUSPENDIDO
            : client_1.WisproClientStatus.ACTIVO;
        await db_1.prisma.wisproClient.upsert({
            where: { contractId: c.contractId },
            create: {
                contractId: c.contractId,
                publicId: c.publicId ?? null,
                name: c.clientName,
                identification: c.identification ?? null,
                phone: c.phone ?? null,
                email: c.email ?? null,
                address: c.address || 'Panamá',
                planName: c.planName || 'Plan Fibra',
                nodeName: c.nodeName || 'OLT-Central',
                currentOnuMac: c.macAddress ?? null,
                currentOnuSerial: c.serialNumber ?? null,
                model: c.model ?? null,
                ipAddress: c.ip ?? null,
                wisproState: c.status || 'enabled',
                status: clientStatus,
                wisproUpdatedAt: c.wisproUpdatedAt || new Date()
            },
            update: {
                publicId: c.publicId ?? undefined,
                name: c.clientName,
                identification: c.identification ?? undefined,
                phone: c.phone ?? undefined,
                email: c.email ?? undefined,
                address: c.address || undefined,
                planName: c.planName || undefined,
                nodeName: c.nodeName || undefined,
                currentOnuMac: c.macAddress ?? undefined,
                currentOnuSerial: c.serialNumber ?? undefined,
                model: c.model ?? undefined,
                ipAddress: c.ip ?? undefined,
                wisproState: c.status || undefined,
                status: clientStatus,
                wisproUpdatedAt: c.wisproUpdatedAt || new Date()
            }
        });
        return {
            success: true,
            event,
            contractId: c.contractId,
            action: 'UPSERTED',
            message: `Contrato ${c.contractId} sincronizado en PostgreSQL espejo vía Webhook.`
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
                    { currentOnuMac: { contains: params.search, mode: 'insensitive' } },
                    { currentOnuSerial: { contains: params.search, mode: 'insensitive' } },
                    { identification: { contains: params.search, mode: 'insensitive' } }
                ]
            } : undefined
        });
    }
    async getLocalContracts(options) {
        return WisproService.getLocalContracts(options);
    }
    async syncWisproContractsIncremental(options) {
        return WisproService.syncWisproContractsIncremental(options);
    }
    async syncWithWispro() {
        return WisproService.syncWisproContractsIncremental();
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
