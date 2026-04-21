const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const API_SECRET = process.env.API_SECRET || 'velocidad-secreta-2024';

// Middleware
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
    fs.writeFile(DB_PATH, JSON.stringify(dbCache, null, 2), (err) => {
        if (err) console.error('Error saving DB:', err);
    });
}

// ── SEGURIDAD (TOKEN) ─────────────────────────────────────────────────────
function validateToken(req, res, next) {
    const authHeader = req.headers['authorization'] || req.headers['x-api-secret'];
    if (authHeader === API_SECRET) {
        return next();
    }
    return res.status(401).json({ error: 'No autorizado. Token inválido o expirado.' });
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
    
    res.json({
        success: true,
        token: API_SECRET, // Por ahora usamos el API_SECRET como token
        role: role,
        userId: user.id,
        name: user.name
    });
});

// ── VARIABLES DE ESTADO EN TIEMPO REAL ────────────────────────────────────
let onlineStatus = {}; 

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
        onlineStatus: onlineStatus
    });
});

app.post('/api/sync', validateToken, (req, res) => {
    const db = getDB();
    const newData = req.body;
    
    if (newData.technicians) db.technicians = newData.technicians;
    if (newData.supervisors) db.supervisors = newData.supervisors;
    if (newData.napOverrides) db.napOverrides = newData.napOverrides;
    if (newData.trackedNaps) db.trackedNaps = newData.trackedNaps;
    if (newData.settings) db.settings = newData.settings;
    
    persistDB();
    res.json({ success: true });
});

app.post('/api/heartbeat', (req, res) => {
    const { techId } = req.body;
    if (!techId) return res.status(400).json({ error: 'techId missing' });
    
    onlineStatus[techId] = Date.now();
    res.json({ success: true, timestamp: onlineStatus[techId] });
});

// ── PROXY SEGURO PARA WISPRO (PROTEGIDO) ─────────────────────────────────
app.all('/api/wispro/*', validateToken, async (req, res) => {
    const apiPath = req.params[0] || '';
    const query = new URLSearchParams(req.query).toString();
    const token = process.env.WISPRO_API_KEY;
    const baseUrl = process.env.WISPRO_BASE_URL || 'https://www.cloud.wispro.co/api/v1';
    
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
        res.status(response.status).json(data);
    } catch (error) {
        console.error('Error in Wispro Proxy:', error.message);
        res.status(500).json({ 
            error: 'Wispro Gateway Error', 
            message: error.message
        });
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

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Velocity Server Seguro activo en puerto: ${PORT}`);
    console.log(`📂 Sirviendo archivos desde: ${path.join(__dirname, 'public')}`);
});


