// Cargar configuración desde config.js
const CFG = typeof VELOCITY_CONFIG !== 'undefined' ? VELOCITY_CONFIG : {};

// ── PALETAS ───────────────────────────────────────────────────────────────
const TECH_PALETTE = {
    'Luis David':         '#0059bb',
    'Daniel Opua':        '#7c3aed',
    'Edgar Abdiel':       '#059669',
    'Jose Mendoza':       '#d97706',
    'Mario Gonzalez':     '#dc2626',
    'Nelson Eduar Sagel': '#0891b2'
};

const TYPE_CFG = {
    technical:   { color: '#7c3aed', label: 'Visita Técnica' },
    installation:{ color: '#0059bb', label: 'Instalación' },
    feasibility: { color: '#059669', label: 'Factibilidad' },
    resignation: { color: '#dc2626', label: 'Baja de Servicio' }
};

const TECNICOS_ACTIVOS = [];
window.updateActiveTechs = function() {
    try {
        const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
        const dbTechs = (db.technicians || []).filter(t => !t.disabled && t.name && typeof t.name === 'string').map(t => t.name.trim());
        if (dbTechs.length > 0) {
            TECNICOS_ACTIVOS.length = 0;
            TECNICOS_ACTIVOS.push(...dbTechs);
        } else {
            TECNICOS_ACTIVOS.length = 0;
            TECNICOS_ACTIVOS.push(...Object.keys(TECH_PALETTE));
        }
    } catch(e) {
        TECNICOS_ACTIVOS.length = 0;
        TECNICOS_ACTIVOS.push(...Object.keys(TECH_PALETTE));
    }
};
window.updateActiveTechs();

// ── ESTADO GLOBAL ─────────────────────────────────────────────────────────
const state = {
    tab:          sessionStorage.getItem('V_Tab') || 'dashboard',
    feedbacksCache: {}, // Caché global de comentarios para evitar llamadas repetidas a Wispro
    clients:      {},   // id → {name, zone, address, phone}
    techs:        {},   // id → name
    techEmails:   {},   // id → email (Wispro exact)
    categories:   {},   // id → name
    orders:       [],   // órdenes del día
    issues:       [],   // issues pendientes
    finishedOrders: [], // órdenes finalizadas (hoy y ayer)
    finishedIssues: [], // reportes finalizados (hoy y ayer)
    napOverrides: {},   // ticketId → {nap, marquilla, lat, lng}
    trackedNaps:  [],   // registro manual de NAPs
    napFilter:    { sortBy: 'date', sortDir: 'desc', zone: 'all', search: '' },
    orderFilter:  { type: 'all', tech: 'all', zone: 'all' },
    issueFilter:  { tech: 'all', zone: 'all', date: 'all', sortBy: 'id', sortDir: 'desc', search: '' },
    pruebaFilter: { date: 'all', search: '', type: 'all' },
    orderSearch:  '',
    orderSort:    { key: 'id', dev: 'desc' },
    isSyncing:    false,
    lastSync:     0,
    pollTimer:    null,
    knownOrderIds: new Set(), // IDs de órdenes finalizadas ya notificadas
    knownIssueIds: new Set(), // IDs de issues ya notificados
    // Estado para Módulo de Inventario & Hardware ISP
    inventory:        [], // Lista de ONUs, Routers, Bobinas, Materiales
    inventoryFilter:  { search: '', category: 'all', status: 'all', tech: 'all', warehouse: 'all' },
    // Estado para Reportes Mensuales
    monthlyReport: {
        isFetching: false,
        results:    null, // { month, year, issues: [], stats: { byCategory, totals } }
        progress:   0
    }
};
window.appState = state; // Expuesto temporalmente para debug


// ── SESIÓN ────────────────────────────────────────────────────────────────
window.getSessionToken = function() {
    return sessionStorage.getItem('Velocity_Token') || localStorage.getItem('Velocity_Token') || '';
};

// Validar sesión inicial (si no estamos en login.html y no hay token, redirigir)
(function checkInitialAuth() {
    const isLoginPage = window.location.pathname.endsWith('login.html');
    const token = window.getSessionToken();
    if (!token && !isLoginPage) {
        console.warn('[Velocity Auth] No se encontró sesión activa. Redirigiendo a login...');
        const loginUrl = window.location.pathname.includes('/pages/') ? 'login.html' : 'pages/login.html';
        window.location.href = loginUrl;
    }
})();

// Mantener compatibilidad con variable legacy
const SESSION_TOKEN = window.getSessionToken();

// Cola de peticiones para evitar bloqueo de Wispro
let apiPromise = Promise.resolve();
