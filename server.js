const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const API_SECRET = process.env.API_SECRET || 'velocidad-secreta-2024';

// Middleware de Seguridad y Limitador
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 400,
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
                { id: 'S-ROOT-1', name: 'Nehemias', email: 'nehemias@atg-rappido.com', password: 'Rappido2024', role: 'supervisor', disabled: false },
                { id: 'S-ROOT-2', name: 'E. Vasquez', email: 'evasquez@atg-rappido.com', password: 'Rappido2024', role: 'supervisor', disabled: false }
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
        return dbCache;
    } catch (e) {
        console.error('Error reading DB:', e);
        return { supervisors: [], technicians: [], settings: {} };
    }
}

function persistDB() {
    if (!dbCache) return;
    
    // Guardar copia local en disco
    fs.writeFile(DB_PATH, JSON.stringify(dbCache, null, 2), (err) => {
        if (err) console.error('Error saving DB:', err);
    });

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

// ── SEGURIDAD (TOKEN Y SESIONES EFÍMERAS) ──────────────────────────────────
const activeSessions = new Map();

function validateToken(req, res, next) {
    const authHeader = req.headers['authorization'] || req.headers['x-api-secret'];
    if (!authHeader) {
        return res.status(401).json({ error: 'No autorizado. Se requiere token.' });
    }

    // Bypass maestro para compatibilidad de herramientas administrativas/sistemas
    if (authHeader === API_SECRET) {
        return next();
    }

    const session = activeSessions.get(authHeader);
    if (session && session.expiresAt > Date.now()) {
        session.expiresAt = Date.now() + 24 * 60 * 60 * 1000; // Prolongar sesión 24h
        req.user = session;
        return next();
    }

    return res.status(401).json({ error: 'Sesión inválida o expirada.' });
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
    
    if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    
    if (user.disabled) {
        return res.status(403).json({ error: 'Cuenta desactivada' });
    }
    
    // Generar token efímero de sesión de 64 caracteres hex
    const sessionToken = crypto.randomBytes(32).toString('hex');
    activeSessions.set(sessionToken, {
        userId: user.id,
        role: role,
        name: user.name,
        email: user.email,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 horas de validez
    });
    
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
        });
        db.technicians = newData.technicians;
    }
    if (newData.supervisors) {
        newData.supervisors.forEach(ns => {
            const exs = db.supervisors.find(s => s.id === ns.id);
            if (exs && !ns.password) ns.password = exs.password;
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
});


