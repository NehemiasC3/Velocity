const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const writeFileAtomic = require('write-file-atomic');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const API_SECRET = process.env.API_SECRET || 'velocidad-secreta-2024';
const JWT_SECRET = process.env.JWT_SECRET || 'velocity-jwt-secure-secret-key-2026';

// Middleware de Seguridad y Limitador
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10000, // Aumentado a 10000 para evitar bloqueos por carga en paralelo y fast-polling de comentarios
    message: { error: 'Demasiadas peticiones desde esta IP. Por favor intenta más tarde.' }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: { error: 'Demasiados intentos de inicio de sesión. Por favor intenta en 15 minutos.' }
});

app.use('/api/', generalLimiter);
app.use('/api/login', loginLimiter);

app.use(cors());
app.use(express.json());
// SEGURIDAD: Solo servir archivos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Asegurar que existe la carpeta de datos
if (!fs.existsSync(DATA_DIR)) {
    console.log(`[Velocity] Creando directorio de datos en: ${DATA_DIR}`);
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ── MEMORY CACHE (RENDIMIENTO) ───────────────────────────────────────────
let dbCache = null;

function getDB() {
    if (dbCache) return dbCache;
    
    if (!fs.existsSync(DB_PATH)) {
        const initialState = {
            supervisors: [
                { id: 'S-ROOT-1', name: 'Nehemias', email: 'nehemias@atg-rappido.com', password: bcrypt.hashSync('Rappido2024', 10), role: 'supervisor', disabled: false },
                { id: 'S-ROOT-2', name: 'E. Vasquez', email: 'evasquez@atg-rappido.com', password: bcrypt.hashSync('Rappido2024', 10), role: 'supervisor', disabled: false }
            ],
            technicians: [],
            napOverrides: {},
            trackedNaps: [],
            settings: {
                wisproToken: process.env.WISPRO_API_KEY || '',
                wisproBaseUrl: process.env.WISPRO_BASE_URL || 'https://www.cloud.wispro.co/api/v1'
            }
        };
        fs.writeFileSync(DB_PATH, JSON.stringify(initialState, null, 2));
        dbCache = initialState;
        return initialState;
    }
    
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        dbCache = JSON.parse(data);

        // AUTO-MIGRACIÓN: Hashear contraseñas en texto plano si existen
        let updated = false;
        if (dbCache.supervisors) {
            dbCache.supervisors.forEach(u => {
                if (u.password && !u.password.startsWith('$2a$') && !u.password.startsWith('$2b$')) {
                    u.password = bcrypt.hashSync(u.password, 10);
                    updated = true;
                }
            });
        }
        if (dbCache.technicians) {
            dbCache.technicians.forEach(u => {
                if (u.password && !u.password.startsWith('$2a$') && !u.password.startsWith('$2b$')) {
                    u.password = bcrypt.hashSync(u.password, 10);
                    updated = true;
                }
            });
        }
        if (updated) {
            console.log('[Velocity Security] Contraseñas en texto plano detectadas. Hasheándolas automáticamente...');
            fs.writeFileSync(DB_PATH, JSON.stringify(dbCache, null, 2));
        }

        return dbCache;
    } catch (e) {
        console.error('Error reading DB:', e);
        return { supervisors: [], technicians: [], settings: {} };
    }
}

function persistDB() {
    if (!dbCache) return;
    
    // Guardar copia local en disco de forma atómica
    writeFileAtomic(DB_PATH, JSON.stringify(dbCache, null, 2))
        .catch(err => console.error('Error saving DB atomically:', err));

    // Guardar en la nube de Google Drive si está configurado
    const url = dbCache.settings?.googleSheetUrl;
    if (url && url.startsWith('http')) {
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dbCache)
        })
        .then(res => {
            if (res.ok) console.log('[Velocity Cloud] Base de datos guardada en Google Drive.');
            else console.warn('[Velocity Cloud] Respuesta fallida al guardar en Google Drive:', res.status);
        })
        .catch(err => {
            console.error('[Velocity Cloud] Error guardando en Google Drive:', err.message);
        });
    }
}

async function syncFromGoogleDrive() {
    const db = getDB();
    const url = db.settings?.googleSheetUrl;
    if (url && url.startsWith('http')) {
        console.log(`[Velocity Cloud] Cargando base de datos inicial desde Google Drive: ${url}`);
        try {
            const res = await fetch(url);
            if (res.ok) {
                const cloudData = await res.json();
                if (cloudData && (cloudData.supervisors || cloudData.technicians)) {
                    dbCache = cloudData;
                    // Hashear cualquier contraseña plana del cloud antes de escribir
                    let updated = false;
                    if (dbCache.supervisors) {
                        dbCache.supervisors.forEach(u => {
                            if (u.password && !u.password.startsWith('$2a$') && !u.password.startsWith('$2b$')) {
                                u.password = bcrypt.hashSync(u.password, 10);
                                updated = true;
                            }
                        });
                    }
                    if (dbCache.technicians) {
                        dbCache.technicians.forEach(u => {
                            if (u.password && !u.password.startsWith('$2a$') && !u.password.startsWith('$2b$')) {
                                u.password = bcrypt.hashSync(u.password, 10);
                                updated = true;
                            }
                        });
                    }
                    fs.writeFileSync(DB_PATH, JSON.stringify(dbCache, null, 2));
                    console.log(`[Velocity Cloud] Sincronización inicial exitosa. ${dbCache.supervisors?.length || 0} supervisores, ${dbCache.technicians?.length || 0} técnicos cargados.`);
                } else {
                    console.log('[Velocity Cloud] El archivo en Google Drive está vacío o no es compatible.');
                }
            } else {
                console.warn('[Velocity Cloud] El servidor de Google Drive retornó error:', res.status);
            }
        } catch (e) {
            console.warn('[Velocity Cloud] Error al sincronizar con Google Drive en el inicio:', e.message);
        }
    }
}

// ── SEGURIDAD (TOKEN Y SESIONES EFÍMERAS CON JWT) ───────────────────────────

function validateToken(req, res, next) {
    const authHeader = req.headers['authorization'] || req.headers['x-api-secret'];
    if (!authHeader) {
        return res.status(401).json({ error: 'No autorizado. Se requiere token.' });
    }

    // Bypass maestro para compatibilidad de herramientas administrativas/sistemas
    if (authHeader === API_SECRET) {
        return next();
    }

    try {
        const decoded = jwt.verify(authHeader, JWT_SECRET);
        req.user = decoded;
        return next();
    } catch (e) {
        return res.status(401).json({ error: 'Sesión inválida o expirada.' });
    }
}

// ── ENDPOINTS DE AUTENTICACIÓN ────────────────────────────────────────────

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const db = getDB();
    
    // Buscar en supervisores
    let user = db.supervisors.find(u => u.email.toLowerCase() === email.toLowerCase());
    let role = 'supervisor';
    
    if (!user) {
        user = db.technicians.find(u => u.email.toLowerCase() === email.toLowerCase());
        role = 'technician';
    }
    
    if (!user) {
        return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
        return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    
    if (user.disabled) {
        return res.status(403).json({ error: 'Cuenta desactivada' });
    }
    
    // Generar token JWT firmado
    const tokenPayload = {
        userId: user.id,
        role: role,
        name: user.name,
        email: user.email
    };
    const sessionToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({
        success: true,
        token: sessionToken,
        role: role,
        userId: user.id,
        name: user.name
    });
});

// ── VARIABLES DE ESTADO EN TIEMPO REAL ────────────────────────────────────
let onlineStatus = {}; 
let activeTracking = {};

// ── ENDPOINTS DE SINCRONIZACIÓN (PROTEGIDOS) ───────────────────────────────

app.get('/api/sync', validateToken, (req, res) => {
    const db = getDB();
    // SEGURIDAD: No enviar contraseñas ni el token de Wispro al cliente de forma innecesaria
    const sanitizedDB = JSON.parse(JSON.stringify(db));
    sanitizedDB.supervisors.forEach(s => delete s.password);
    sanitizedDB.technicians.forEach(t => delete t.password);
    if (sanitizedDB.settings) delete sanitizedDB.settings.wisproToken;
    
    res.json({
        ...sanitizedDB,
        onlineStatus: onlineStatus,
        activeTracking: activeTracking
    });
});

app.post('/api/sync', validateToken, (req, res) => {
    const db = getDB();
    const newData = req.body;
    
    if (newData.technicians) {
        newData.technicians.forEach(nt => {
            const ext = db.technicians.find(t => t.id === nt.id);
            if (ext && !nt.password) nt.password = ext.password;
            // Hashear contraseña si es nueva/cambiada
            if (nt.password && !nt.password.startsWith('$2a$') && !nt.password.startsWith('$2b$')) {
                nt.password = bcrypt.hashSync(nt.password, 10);
            }
        });
        db.technicians = newData.technicians;
    }
    if (newData.supervisors) {
        newData.supervisors.forEach(ns => {
            const exs = db.supervisors.find(s => s.id === ns.id);
            if (exs && !ns.password) ns.password = exs.password;
            // Hashear contraseña si es nueva/cambiada
            if (ns.password && !ns.password.startsWith('$2a$') && !ns.password.startsWith('$2b$')) {
                ns.password = bcrypt.hashSync(ns.password, 10);
            }
        });
        db.supervisors = newData.supervisors;
    }
    if (newData.napOverrides) db.napOverrides = newData.napOverrides;
    if (newData.trackedNaps) db.trackedNaps = newData.trackedNaps;
    if (newData.settings) db.settings = { ...db.settings, ...newData.settings };
    
    persistDB();
    res.json({ success: true });
});

app.post('/api/heartbeat', (req, res) => {
    const { techId, tracking } = req.body;
    if (!techId) return res.status(400).json({ error: 'techId missing' });
    
    onlineStatus[techId] = Date.now();
    
    if (tracking) {
        // Eliminar órdenes previas pertenecientes a este técnico
        Object.keys(activeTracking).forEach(orderId => {
            if (String(activeTracking[orderId].empId) === String(techId)) {
                delete activeTracking[orderId];
            }
        });
        
        // Agregar las órdenes activas en curso
        Object.entries(tracking).forEach(([orderId, entry]) => {
            if (entry.status === 'started') {
                activeTracking[orderId] = {
                    status: 'started',
                    startTime: entry.startTime,
                    empId: techId
                };
            }
        });
    }

    res.json({ success: true, timestamp: onlineStatus[techId] });
});

// ── PROXY SEGURO PARA WISPRO (PROTEGIDO) CON CACHÉ ───────────────────────
const wisproCache = {};
const WISPRO_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

function cleanWisproCache() {
    const now = Date.now();
    Object.keys(wisproCache).forEach(key => {
        if (now - wisproCache[key].timestamp > WISPRO_CACHE_TTL) {
            delete wisproCache[key];
        }
    });
}

app.all('/api/wispro/*', validateToken, async (req, res) => {
    const apiPath = req.params[0] || '';
    const query = req.originalUrl.includes('?') ? req.originalUrl.split('?')[1] : '';
    const token = process.env.WISPRO_API_KEY;
    const baseUrl = process.env.WISPRO_BASE_URL || 'https://www.cloud.wispro.co/api/v1';
    
    const isGet = req.method === 'GET';
    const cacheKey = req.originalUrl;

    if (isGet) {
        cleanWisproCache();
        if (wisproCache[cacheKey]) {
            const entry = wisproCache[cacheKey];
            if (Date.now() - entry.timestamp < WISPRO_CACHE_TTL) {
                return res.status(entry.status).json(entry.data);
            } else {
                delete wisproCache[cacheKey];
            }
        }
    }

    try {
        const fullApiPath = apiPath.startsWith('/') ? apiPath.slice(1) : apiPath;
        const url = `${baseUrl}/${fullApiPath}${query ? '?' + query : ''}`;
        
        const response = await fetch(url, {
            method: req.method,
            headers: {
                'Authorization': token,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined
        });

        const data = await response.json().catch(() => ({}));
        
        // Almacenar en caché si es una petición GET exitosa
        if (isGet && response.status === 200) {
            wisproCache[cacheKey] = {
                timestamp: Date.now(),
                status: response.status,
                data: data
            };
        } else if (!isGet) {
            // Invalidar caché relacionada si se hace un cambio
            // Ej: si se edita una orden, invalidamos la caché de esa orden
            const pathParts = apiPath.split('/');
            const id = pathParts.find(p => p && !isNaN(p) || (p && p.length > 10)); // busca un posible ID
            if (id) {
                Object.keys(wisproCache).forEach(k => {
                    if (k.includes(id)) {
                        delete wisproCache[k];
                    }
                });
            }
        }

        res.status(response.status).json(data);
    } catch (error) {
        console.error('Error in Wispro Proxy:', error.message);
        res.status(500).json({ 
            error: 'Wispro Gateway Error', 
            message: error.message
        });
    }
});

// ── MÓDULO DE INVENTARIO Y BÚSQUEDA INSTANTÁNEA (WISPRO API V1) ───────────
let inventoryCache = {
    data: null,
    timestamp: 0
};
const INVENTORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

function mapWisproItem(raw) {
    const id = String(raw.id || raw.client_id || Math.random().toString(36).slice(2, 10));
    
    let clientName = 'Sin Nombre';
    if (raw.client_name && typeof raw.client_name === 'string' && raw.client_name.trim()) {
        clientName = raw.client_name.trim();
    } else if (raw.client && raw.client.name && typeof raw.client.name === 'string' && raw.client.name.trim()) {
        clientName = raw.client.name.trim();
    } else if (raw.name && typeof raw.name === 'string' && raw.name.trim()) {
        clientName = raw.name.trim();
    }

    const ip = (raw.ip || raw.ip_address || raw.framed_ip_address || raw.mikrotik_ip || 'No asignada').trim();
    const mac = (raw.mac || raw.mac_address || raw.equipment_mac || raw.device_mac || 'No registrada').trim();
    const serialNumber = (raw.serial_number || raw.serial || raw.sn || raw.onu_sn || raw.gpon_sn || 'S/N no disponible').trim();
    const model = (raw.model || raw.equipment_model || raw.model_name || raw.hardware_model || raw.device_model || 'Genérico / Desconocido').trim();
    
    let status = (raw.status || raw.state || raw.contract_state || raw.service_state || 'unknown').toLowerCase().trim();
    if (['activo', 'active', 'habilitado', 'enabled'].includes(status)) status = 'active';
    else if (['deshabilitado', 'disabled', 'inactivo', 'inactive', 'baja'].includes(status)) status = 'disabled';
    else if (['pendiente', 'pending', 'instalacion_pendiente'].includes(status)) status = 'pending';
    else if (['suspendido', 'suspended', 'corte'].includes(status)) status = 'suspended';

    let address = '';
    if (raw.address && typeof raw.address === 'string') address = raw.address.trim();
    else if (raw.full_address && typeof raw.full_address === 'string') address = raw.full_address.trim();
    else if (raw.street || raw.address_street) {
        address = `${raw.street || raw.address_street || ''} ${raw.address_number || ''}`.trim();
    } else if (raw.client && raw.client.address) {
        address = raw.client.address.trim();
    }
    if (!address) address = raw.zone_name || raw.city || 'Sin dirección registrada';

    return {
        id,
        client_name: clientName,
        ip,
        mac,
        serial_number: serialNumber,
        model,
        status,
        address
    };
}

app.get('/api/v1/inventory', async (req, res) => {
    try {
        const forceRefresh = req.query.force === 'true' || req.query.refresh === 'true';
        const now = Date.now();

        if (!forceRefresh && inventoryCache.data && (now - inventoryCache.timestamp < INVENTORY_CACHE_TTL)) {
            return res.json({
                success: true,
                count: inventoryCache.data.length,
                cached: true,
                timestamp: new Date(inventoryCache.timestamp).toISOString(),
                data: inventoryCache.data
            });
        }

        const token = process.env.WISPRO_API_TOKEN || process.env.WISPRO_API_KEY;
        const baseUrl = (process.env.WISPRO_API_URL || process.env.WISPRO_BASE_URL || 'https://www.cloud.wispro.co/api/v1').replace(/\/+$/, '');

        console.log(`[Inventory API] Sincronizando catálogo completo desde Wispro API (${baseUrl}/contracts)...`);

        const perPage = 100;
        let currentPage = 1;
        let totalPages = 1;
        const allItems = [];

        // Página 1
        const firstUrl = `${baseUrl}/contracts?per_page=${perPage}&page=1`;
        const firstRes = await fetch(firstUrl, {
            headers: {
                'Authorization': token,
                'Accept': 'application/json'
            }
        });

        if (!firstRes.ok) {
            throw new Error(`Wispro API error HTTP ${firstRes.status}`);
        }

        const firstJson = await firstRes.json();
        if (firstJson.data && Array.isArray(firstJson.data)) {
            allItems.push(...firstJson.data);
        }
        if (firstJson.meta?.pagination?.total_pages) {
            totalPages = firstJson.meta.pagination.total_pages;
        }

        // Bucle dinámico por lotes
        currentPage = 2;
        const BATCH_SIZE = 5;
        while (currentPage <= totalPages) {
            const batchPromises = [];
            const batchEnd = Math.min(currentPage + BATCH_SIZE - 1, totalPages);
            for (let p = currentPage; p <= batchEnd; p++) {
                const url = `${baseUrl}/contracts?per_page=${perPage}&page=${p}`;
                batchPromises.push(
                    fetch(url, { headers: { 'Authorization': token, 'Accept': 'application/json' } })
                        .then(r => r.ok ? r.json() : { data: [] })
                        .catch(() => ({ data: [] }))
                );
            }
            const results = await Promise.all(batchPromises);
            for (const r of results) {
                if (r.data && Array.isArray(r.data)) {
                    allItems.push(...r.data);
                }
            }
            currentPage = batchEnd + 1;
        }

        const cleanData = allItems.map(mapWisproItem);
        inventoryCache = {
            data: cleanData,
            timestamp: Date.now()
        };

        console.log(`[Inventory API] Sincronización exitosa. Total equipos: ${cleanData.length}`);

        res.json({
            success: true,
            count: cleanData.length,
            cached: false,
            timestamp: new Date().toISOString(),
            data: cleanData
        });
    } catch (err) {
        console.error('[Inventory API Error]', err);
        res.status(500).json({
            success: false,
            error: 'InternalServerError',
            message: 'Error al sincronizar el inventario de Wispro',
            details: err.message
        });
    }
});

app.post('/api/v1/inventory/cache/clear', (_req, res) => {
    inventoryCache = { data: null, timestamp: 0 };
    console.log('[Inventory API] Caché limpiada bajo demanda.');
    res.json({ success: true, message: 'Caché de inventario invalidada' });
});

async function warmInventoryCache() {
    const token = process.env.WISPRO_API_TOKEN || process.env.WISPRO_API_KEY;
    if (!token) return;
    try {
        console.log('[Inventory API ⚡] Precalentando caché de inventario en RAM...');
        const baseUrl = (process.env.WISPRO_API_URL || process.env.WISPRO_BASE_URL || 'https://www.cloud.wispro.co/api/v1').replace(/\/+$/, '');
        const firstRes = await fetch(`${baseUrl}/contracts?per_page=100&page=1`, {
            headers: { 'Authorization': token, 'Accept': 'application/json' }
        });
        if (firstRes.ok) {
            const firstJson = await firstRes.json();
            let allItems = Array.isArray(firstJson.data) ? [...firstJson.data] : [];
            const totalPages = firstJson.meta?.pagination?.total_pages || 1;
            let currentPage = 2;
            const BATCH_SIZE = 5;
            while (currentPage <= totalPages) {
                const batchPromises = [];
                const batchEnd = Math.min(currentPage + BATCH_SIZE - 1, totalPages);
                for (let p = currentPage; p <= batchEnd; p++) {
                    const url = `${baseUrl}/contracts?per_page=100&page=${p}`;
                    batchPromises.push(
                        fetch(url, { headers: { 'Authorization': token, 'Accept': 'application/json' } })
                            .then(r => r.ok ? r.json() : { data: [] })
                            .catch(() => ({ data: [] }))
                    );
                }
                const results = await Promise.all(batchPromises);
                for (const r of results) {
                    if (r.data && Array.isArray(r.data)) allItems.push(...r.data);
                }
                currentPage = batchEnd + 1;
            }
            inventoryCache = {
                data: allItems.map(mapWisproItem),
                timestamp: Date.now()
            };
            console.log(`[Inventory API ✅] Precalentamiento completado. ${inventoryCache.data.length} registros en RAM.`);
        }
    } catch (e) {
        console.warn('[Inventory API] Error en precalentamiento:', e.message);
    }
}

// Auto-refresco en segundo plano cada 4.5 minutos para tener RAM siempre caliente
setInterval(warmInventoryCache, 4.5 * 60 * 1000);

// Endpoint para probar conexión con Google Drive / Sheets Web App
app.post('/api/test-gdrive', validateToken, async (req, res) => {
    const { url } = req.body;
    if (!url || !url.startsWith('http')) {
        return res.status(400).json({ error: 'URL de Web App inválida. Debe comenzar con http:// o https://' });
    }
    try {
        console.log(`[Velocity Cloud] Probando conexión a Google Drive a través de: ${url}`);
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            if (data && (data.supervisors || data.technicians)) {
                return res.json({ 
                    success: true, 
                    info: `¡Conexión OK! Base de datos de Google Drive validada. Contiene ${data.supervisors?.length || 0} supervisores y ${data.technicians?.length || 0} técnicos.` 
                });
            } else {
                return res.json({ 
                    success: true, 
                    info: '¡Conexión OK! La URL responde correctamente, pero el archivo velocity_db.json está vacío. Se inicializará con tu base de datos actual al guardar.' 
                });
            }
        } else {
            return res.status(response.status).json({ error: `Google retornó estado HTTP ${response.status}` });
        }
    } catch (e) {
        return res.status(500).json({ error: `Error de conexión: ${e.message}` });
    }
});

// Limpieza de estados online 
setInterval(() => {
    const now = Date.now();
    Object.keys(onlineStatus).forEach(id => {
        if (now - onlineStatus[id] > 120000) {
            delete onlineStatus[id];
        }
    });
}, 60000);

app.post('/api/test-report-email', validateToken, async (req, res) => {
    try {
        console.log('[Velocity Reports] Solicitud de envío de reporte de prueba manual recibida...');
        await sendDailyReportEmail();
        res.json({ success: true, message: 'Reporte de prueba enviado. Revisa tu correo y logs del servidor.' });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// ── REPORTES DIARIOS AUTOMÁTICOS POR CORREO ─────────────────────────────
let lastReportDay = '';

async function sendDailyReportEmail() {
    const db = getDB();
    const url = db.settings?.googleSheetUrl;
    if (!url || !url.startsWith('http')) {
        console.log('[Velocity Reports] No se puede enviar reporte diario por correo: Google Apps Script URL no configurada.');
        return;
    }
    
    const recipient = db.settings?.reportRecipientEmail || (db.supervisors && db.supervisors[0] ? db.supervisors[0].email : '');
    if (!recipient) {
        console.log('[Velocity Reports] No se puede enviar reporte diario por correo: Email receptor no configurado.');
        return;
    }

    console.log(`[Velocity Reports] Preparando reporte diario para enviar a: ${recipient}...`);

    const payload = {
        action: 'send_daily_report',
        recipientEmail: recipient,
        date: new Date().toLocaleDateString('es-ES'),
        totalTrackedNaps: db.trackedNaps?.length || 0,
        pendingNapsCount: db.trackedNaps?.filter(n => !n.resolved)?.length || 0
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            console.log('[Velocity Reports] Reporte diario enviado a Google Apps Script con éxito.');
        } else {
            console.warn('[Velocity Reports] Apps Script retornó error al enviar reporte:', response.status);
        }
    } catch (e) {
        console.error('[Velocity Reports] Error de red al enviar reporte por correo:', e.message);
    }
}

// Scheduler: revisar la hora cada 60 segundos
setInterval(() => {
    const now = new Date();
    const hh = now.getHours();
    const mm = now.getMinutes();
    const todayStr = now.toISOString().split('T')[0];

    if (hh === 23 && mm === 59 && lastReportDay !== todayStr) {
        lastReportDay = todayStr;
        sendDailyReportEmail();
    }
}, 60000);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Velocity Server Seguro activo en puerto: ${PORT}`);
    console.log(`📂 Sirviendo archivos desde: ${path.join(__dirname, 'public')}`);
    syncFromGoogleDrive();
    warmInventoryCache();
});


