/**
 * VELOCITY — Panel de Supervisor
 * Arquitectura limpia con cache inteligente y polling ligero
 */

// ── CONFIGURACIÓN ─────────────────────────────────────────────────────────
const CFG = {
    proxy:    'https://corsproxy.io/?',
    base:     'https://www.cloud.wispro.co/api/v1',
    token:    '',
    pollMs:   5 * 60 * 1000,   // 5 min
    cacheTTL: { static: 24*60*60*1000, orders: 5*60*1000, issues: 10*60*1000 }
};

// Cargar token desde config.js
if (typeof VELOCITY_CONFIG !== 'undefined' && VELOCITY_CONFIG.wisproToken) {
    CFG.token   = VELOCITY_CONFIG.wisproToken;
    CFG.base    = VELOCITY_CONFIG.wisproBaseUrl || CFG.base;
}

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

const TECNICOS_ACTIVOS = Object.keys(TECH_PALETTE);

// ── ESTADO GLOBAL ─────────────────────────────────────────────────────────
const state = {
    tab:          sessionStorage.getItem('V_Tab') || 'dashboard',
    clients:      {},   // id → {name, zone, address, phone}
    techs:        {},   // id → name
    categories:   {},   // id → name
    orders:       [],   // órdenes del día
    issues:       [],   // issues pendientes
    finishedOrders: [], // órdenes finalizadas (hoy y ayer)
    finishedIssues: [], // reportes finalizados (hoy y ayer)
    napOverrides: {},   // ticketId → {nap, marquilla, lat, lng}
    trackedNaps:  [],   // registro manual de NAPs
    napFilter:    { sortBy: 'date', sortDir: 'desc', zone: 'all' },
    orderFilter:  { type: 'all', tech: 'all', zone: 'all' },
    issueFilter:  { tech: 'all', zone: 'all', date: 'all', sortBy: 'id', sortDir: 'desc' },
    isSyncing:    false,
    lastSync:     0,
    pollTimer:    null
};
window.appState = state; // Expuesto temporalmente para debug


// ── API HELPER ────────────────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
    const url = CFG.proxy + encodeURIComponent(CFG.base + path);
    const res = await fetch(url, {
        ...opts,
        headers: {
            'Authorization': CFG.token,
            'Accept':        'application/json',
            'Content-Type':  'application/json',
            ...(opts.headers || {})
        }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
    return res.json();
}

async function apiPages(endpoint, maxPages = 10) {
    let all = [], page = 1;
    while (page <= maxPages) {
        const d = await apiFetch(`/${endpoint}?per_page=1000&page=${page}`);
        const items = Array.isArray(d.data) ? d.data : [];
        all = all.concat(items);
        if (items.length < 1000) break;
        page++;
    }
    return all;
}

// ── CACHE ─────────────────────────────────────────────────────────────────
function cacheGet(key) {
    try {
        const raw = localStorage.getItem('V_' + key);
        if (!raw) return null;
        const { ts, data, ttl } = JSON.parse(raw);
        if (Date.now() - ts > ttl) return null;
        return data;
    } catch { return null; }
}

function cacheSet(key, data, ttl) {
    try {
        localStorage.setItem('V_' + key, JSON.stringify({ ts: Date.now(), data, ttl }));
    } catch {}
}

function cacheClear() {
    ['static','orders','issues'].forEach(k => localStorage.removeItem('V_' + k));
}

// ── CARGA DE DATOS ────────────────────────────────────────────────────────
async function loadStaticData(force = false) {
    const cached = !force && cacheGet('static');
    if (cached) {
        state.clients    = cached.clients;
        state.techs      = cached.techs;
        state.categories = cached.categories;
        return;
    }

    const [rawClients, rawTechs, rawCats] = await Promise.all([
        apiPages('clients'),
        apiFetch('/employees?per_page=1000'),
        apiFetch('/help_desk/categories?per_page=200').catch(() => ({ data: [] }))
    ]);

    rawClients.forEach(c => {
        state.clients[c.id] = {
            name:    c.name || '',
            zone:    c.zone_name || '',
            address: c.address || c.street || '',
            phone:   c.phone_mobile || c.phone || ''
        };
    });

    (Array.isArray(rawTechs.data) ? rawTechs.data : []).forEach(t => {
        state.techs[t.id] = t.name;
    });

    (Array.isArray(rawCats.data) ? rawCats.data : []).forEach(c => {
        state.categories[c.id] = c.name;
    });

    cacheSet('static', {
        clients:    state.clients,
        techs:      state.techs,
        categories: state.categories
    }, CFG.cacheTTL.static);
}

async function loadTodayOrders(force = false) {
    const cached = !force && cacheGet('orders');
    if (cached && cached.orders) {
        state.orders         = cached.orders;
        state.finishedOrders = cached.finishedOrders || [];
        state.napOverrides   = cached.napOverrides || {};
        return;
    }

    const todayStr = new Date().toLocaleDateString('en-CA');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yestStr = yesterday.toLocaleDateString('en-CA');

    // Traer órdenes recientes ordenadas por start_at desc
    const raw = `${CFG.base}/order/orders?per_page=1000&q%5Bs%5D=start_at+desc`;
    const url = CFG.proxy + encodeURIComponent(raw);
    const res = await fetch(url, {
        headers: { 'Authorization': CFG.token, 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} /order/orders`);
    const d = await res.json();
    const items = d.data || [];

    // Filtrar: hoy + pendientes + con técnico
    const todayOrders = items.filter(o => {
        const day   = (o.start_at || '').slice(0, 10);
        const state = (o.state || '').toLowerCase();
        return day === todayStr && state === 'pending' && !!o.employee_id;
    });

    // Filtrar finalizadas de hoy y ayer
    const finishedOrdersRaw = items.filter(o => {
        const st = (o.state || '').toLowerCase();
        if ((st === 'finalizada' || st === 'finalizado') && !!o.employee_id) {
            const dStr = o.end_at || o.updated_at || '';
            const day = dStr.slice(0, 10);
            return day === todayStr;
        }
        return false;
    });

    // Resolver dependencias (contratos, instalaciones, tickets) en batch
    const orderables = {};
    const allToResolve = [...todayOrders, ...finishedOrdersRaw];
    allToResolve.forEach(o => {
        if (o.orderable_id) orderables[o.orderable_id] = o.kind;
    });

    const targetIds = Object.keys(orderables);
    const contractMap = {};

    for (let i = 0; i < targetIds.length; i += 15) {
        await Promise.all(targetIds.slice(i, i + 15).map(async (cid) => {
            try {
                const kind = orderables[cid];
                let endpointsToTry = [`/contracts/${cid}`];
                if (kind === 'installation') {
                    endpointsToTry = [`/installation_orders/${cid}`, `/clients/${cid}`, `/contracts/${cid}`];
                }

                let c = null;
                for (const ep of endpointsToTry) {
                    try {
                        const r = await apiFetch(ep);
                        if (r) {
                            const raw = r.data || r;
                            if (raw && (raw.client_id || raw.name)) {
                                c = raw;
                                break;
                            }
                        }
                    } catch (e) {}
                }

                const realClientId = c ? (c.client_id || c.id) : null;

                if (c && realClientId) {
                    let client = state.clients[realClientId];
                    
                    if (!c.client_id && c.name) {
                        client = {
                            name:    c.name || '',
                            zone:    c.zone_name || '',
                            address: c.address || c.street || '',
                            phone:   c.phone_mobile || c.phone || ''
                        };
                        state.clients[realClientId] = client;
                    } 
                    else if (!client) {
                        try {
                            const clRes = await apiFetch(`/clients/${realClientId}`);
                            if (clRes) {
                                const clData = clRes.data || clRes;
                                client = {
                                    name:    clData.name || '',
                                    zone:    clData.zone_name || '',
                                    address: clData.address || clData.street || '',
                                    phone:   clData.phone_mobile || clData.phone || ''
                                };
                                state.clients[realClientId] = client;
                            }
                        } catch(e) {}
                    }
                    
                    contractMap[cid] = {
                        name:    client?.name || '',
                        address: [c.address_street, c.address_number, c.address_city].filter(Boolean).join(', ') || client?.address || '',
                        zone:    client?.zone || c.address_city || '',
                        phone:   client?.phone || '',
                        nap:     c.nap_name || null
                    };
                }
            } catch {}
        }));
    }

    function mapOrder(o) {
        const resolved  = contractMap[o.orderable_id] || {};
        const techName  = state.techs[o.employee_id] || 'Sin asignar';
        const typeCfg   = TYPE_CFG[o.kind] || { color: '#6b7280', label: o.kind || '?' };
        const override  = state.napOverrides[o.sequential_id] || {};
        const nameFromDesc = o.description?.match(/\(([^)]+)\)/)?.[1] || '';
        const startDate = o.start_at ? new Date(o.start_at) : null;
        const endDate   = o.end_at   ? new Date(o.end_at)   : null;

        const tracking = JSON.parse(localStorage.getItem('Velocity_Order_Tracking') || '{}');
        const trackData = tracking[o.id] || tracking[o.id?.slice(0, 8)] || tracking[o.sequential_id];

        return {
            id:           o.sequential_id || o.id?.slice(0, 8),
            rawId:        o.id,
            kind:         o.kind,
            typeLabel:    typeCfg.label,
            typeColor:    typeCfg.color,
            state:        o.state,
            result:       o.result,
            client:       resolved.name || nameFromDesc || `#${o.sequential_id || o.id} ${o.orderable_id ? '' : '(Sin Asignar)'}`,
            address:      resolved.address || '',
            zone:         resolved.zone || '',
            phone:        resolved.phone || '',
            techId:       o.employee_id,
            techName,
            startTime:    startDate ? startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
            endTime:      endDate   ? endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })   : '--:--',
            nap:          override.nap || resolved.nap || null,
            marquilla:    override.marquilla || null,
            description:  o.description || '',
            endDay:       (o.end_at || o.updated_at || '').slice(0, 10),
            trackData
        };
    }

    state.orders = todayOrders.map(mapOrder);
    state.finishedOrders = finishedOrdersRaw.map(mapOrder);

    cacheSet('orders', { orders: state.orders, finishedOrders: state.finishedOrders, napOverrides: state.napOverrides }, CFG.cacheTTL.orders);
}

async function loadIssues(force = false) {
    const cached = !force && cacheGet('issues');
    if (cached && cached.pending) { 
        state.issues = cached.pending; 
        state.finishedIssues = cached.finished || [];
        return; 
    } 

    const todayStr = new Date().toLocaleDateString('en-CA');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yestStr = yesterday.toLocaleDateString('en-CA');

    let allPending = [], allFinished = [], page = 1;
    while (page <= 30) {
        const raw = `${CFG.base}/help_desk/issues?per_page=1000&page=${page}&q%5Bs%5D=id+desc`;
        const url = CFG.proxy + encodeURIComponent(raw);
        const res = await fetch(url, { headers: { 'Authorization': CFG.token, 'Accept': 'application/json' } });
        if (!res.ok) break;
        const d = await res.json();
        const items = d.data || [];
        if (!items.length) break;
        
        allPending = allPending.concat(items.filter(i => (i.state || '').toLowerCase() === 'pending'));
        
        allFinished = allFinished.concat(items.filter(i => {
            const st = (i.state || '').toLowerCase();
            if (st === 'finalizada' || st === 'finalizado') {
                const dDate = i.updated_at || '';
                const day = dDate.slice(0, 10);
                return day === todayStr;
            }
            return false;
        }));

        if (items.length < 1000) break;
        page++;
    }

    state.issues = allPending;
    state.finishedIssues = allFinished;
    cacheSet('issues', { pending: allPending, finished: allFinished }, CFG.cacheTTL.issues);
}

// ── NAPs STATE ────────────────────────────────────────────────────────────
function loadTrackedNaps() {
    try {
        state.trackedNaps = JSON.parse(localStorage.getItem('Velocity_NAPs'));
        if (!state.trackedNaps) {
            state.trackedNaps = [
                { id:'n1', date:'2026-04-14', name:'NAP W-13', zone:'Wacuco', coords:'', ports:'Llena', comments:'', resolved:false },
                { id:'n2', date:'2026-04-14', name:'NAP W-12', zone:'Wacuco', coords:'XG7V+P9Q Ipetí', ports:'', comments:'', resolved:false },
                { id:'n3', date:'2026-04-14', name:'NAP PLY-04', zone:'Torti', coords:'', ports:'', comments:'Niveles de retrocesos altos', resolved:false },
                { id:'n4', date:'2026-04-14', name:'NAP SFI', zone:'Sansoncito', coords:'8.42727, -77.906704', ports:'Llena', comments:'', resolved:false },
                { id:'n5', date:'2026-04-14', name:'NAP OFI 56', zone:'Sansoncito', coords:'8.430455, -77.904381', ports:'Llena', comments:'', resolved:false },
                { id:'n6', date:'2026-04-14', name:'NAP', zone:'Sansoncito', coords:'8.425521, -77.907464', ports:'', comments:'', resolved:false },
                { id:'n7', date:'2026-04-14', name:'NAP SC', zone:'Sansoncito', coords:'8.430456, -77.904381', ports:'', comments:'', resolved:false },
                { id:'n8', date:'2026-04-14', name:'NAP EXP 01', zone:'Santa Fe', coords:'8.683474, -78.14153', ports:'', comments:'Niveles en -23', resolved:false },
                { id:'n9', date:'2026-04-15', name:'NAP P 4', zone:'Santa Fe', coords:'8.681755, -78.141331', ports:'', comments:'Niveles en 22.88', resolved:false },
                { id:'n10', date:'2026-04-15', name:'NAP P 5', zone:'Santa Fe', coords:'8.679962, -78.141131', ports:'', comments:'Niveles en 19.95', resolved:false },
                { id:'n11', date:'2026-04-15', name:'NAP EXP 71', zone:'Nicanor', coords:'8.554195, -78.036118', ports:'', comments:'Niveles en 23', resolved:false }
            ];
            localStorage.setItem('Velocity_NAPs', JSON.stringify(state.trackedNaps));
        }
    } catch(e) {
        state.trackedNaps = [];
    }
}
function saveTrackedNaps() {
    localStorage.setItem('Velocity_NAPs', JSON.stringify(state.trackedNaps));
}

// ── POLLING ───────────────────────────────────────────────────────────────
function startPolling() {
    stopPolling();
    state.pollTimer = setInterval(async () => {
        if (document.visibilityState !== 'visible') return;
        await loadTodayOrders(true);
        if (state.tab === 'orders' || state.tab === 'dashboard') renderTab(state.tab);
    }, CFG.pollMs);
}

function stopPolling() {
    if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') startPolling();
    else stopPolling();
});

// ── HELPERS ───────────────────────────────────────────────────────────────
function techColor(name) {
    const key = TECNICOS_ACTIVOS.find(n => name?.toLowerCase().includes(n.split(' ')[0].toLowerCase()));
    return key ? TECH_PALETTE[key] : '#6b7280';
}

function techInitials(name) {
    return (name || '??').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function isActiveTech(name) {
    return TECNICOS_ACTIVOS.some(n => name?.toLowerCase().includes(n.split(' ')[0].toLowerCase()));
}

function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `${d.getDate()} ${months[d.getMonth()]}.`;
}

function sinceBadge(iso) {
    if (!iso) return '';
    const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
    if (days === 0) return '<span style="color:#059669;font-weight:700;font-size:16px;">Hoy</span>';
    if (days === 1) return '<span style="color:#0059bb;font-weight:700;font-size:16px;">Ayer</span>';
    return `<span style="color:#dc2626;font-weight:700;font-size:16px;">Hace ${days}d</span>`;
}

function statusBadge(s) {
    const map = {
        pending:      { bg: '#fff7ed', color: '#c2410c', text: 'Pendiente' },
        finalized:    { bg: '#f0fdf4', color: '#059669', text: 'Finalizado' },
        closed:       { bg: '#f3f4f6', color: '#6b7280', text: 'Cerrado' },
        to_reschedule:{ bg: '#fef3c7', color: '#d97706', text: 'Reagendar' }
    };
    const m = map[s] || { bg: '#f3f4f6', color: '#6b7280', text: s || '?' };
    return `<span style="background:${m.bg};color:${m.color};font-size:16px;font-weight:700;padding:3px 10px;border-radius:999px;white-space:nowrap;">${m.text}</span>`;
}

// ── NAVEGACIÓN ────────────────────────────────────────────────────────────
window.switchTab = function(tab) {
    state.tab = tab;
    sessionStorage.setItem('V_Tab', tab);

    // Actualizar nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
        const isActive = btn.id === `nav-${tab}`;
        btn.classList.toggle('bg-primary-container', isActive);
        btn.classList.toggle('text-white', isActive);
        btn.classList.toggle('shadow-lg', isActive);
        btn.classList.toggle('text-on-surface-variant', !isActive);
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) icon.style.fontVariationSettings = isActive ? "'FILL' 1" : "'FILL' 0";
    });

    // Título
    const titles = { dashboard: 'Resumen', orders: 'Órdenes', technicians: 'Técnicos', reports: 'Reportes', users: 'Cuentas', settings: 'Ajustes' };
    const titleEl = document.getElementById('header-title');
    if (titleEl) titleEl.textContent = titles[tab] || tab;

    renderTab(tab);
};

function renderTab(tab) {
    const el = document.getElementById('main-content');
    if (!el) return;
    el.innerHTML = Views[tab] ? Views[tab]() : '<p class="p-8 text-on-surface-variant">Vista no encontrada</p>';
}

// ── VISTAS ────────────────────────────────────────────────────────────────
const Views = {};

// ── DASHBOARD ─────────────────────────────────────────────────────────────
Views.dashboard = () => {
    const todayOrders = state.orders;
    const total       = todayOrders.length;
    const done        = todayOrders.filter(o => o.result === 'success').length;
    const pending     = todayOrders.filter(o => o.state === 'pending').length;
    const noNap       = todayOrders.filter(o => (o.kind === 'technical' || o.kind === 'installation') && !o.nap).length;
    
    // Count active
    const tracking = JSON.parse(localStorage.getItem('Velocity_Order_Tracking') || '{}');
    const activeCount = Object.values(tracking).filter(t => t.status === 'started').length;
    const syncAgo     = state.lastSync ? Math.round((Date.now() - state.lastSync) / 1000) : null;
    const syncText    = syncAgo === null ? 'Sin sincronizar' : syncAgo < 60 ? 'Recién sincronizado' : `Hace ${Math.floor(syncAgo/60)}m`;

    const dbSync = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    const registeredTechs = dbSync.technicians || [];
    const onlineStatus = JSON.parse(localStorage.getItem('Velocity_Online_Status') || '{}');

    // Tarjetas por técnico
    const techCards = TECNICOS_ACTIVOS.map(nombre => {
        const myOrders  = todayOrders.filter(o => o.techName?.toLowerCase().includes(nombre.split(' ')[0].toLowerCase()));
        const myDone    = myOrders.filter(o => o.result === 'success').length;
        const myPending = myOrders.filter(o => o.state === 'pending').length;
        const pct       = myOrders.length > 0 ? Math.round(myDone / myOrders.length * 100) : 0;
        const color     = TECH_PALETTE[nombre];
        const initials  = techInitials(nombre);
        const firstName = nombre.split(' ')[0];

        // Verificar estado Online localmente
        const techObj = registeredTechs.find(t => t.name?.toLowerCase() === nombre.toLowerCase());
        let isOnline = false;
        if(techObj && onlineStatus[techObj.id]) {
            isOnline = (Date.now() - onlineStatus[techObj.id]) < 180000; // 3 minutos de latencia máxima
        }

        const onlineBadge = isOnline 
            ? `<div class="flex items-center gap-1 mt-0.5"><div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div><span class="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">En línea</span></div>`
            : `<div class="flex items-center gap-1 mt-0.5"><div class="w-2 h-2 rounded-full bg-gray-300"></div><span class="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Offline</span></div>`;

        const byType = {};
        myOrders.forEach(o => { byType[o.kind] = (byType[o.kind] || 0) + 1; });
        const typeBadges = Object.entries(byType).map(([k, v]) => {
            const t = TYPE_CFG[k] || { color: '#6b7280', label: k };
            return `<span style="background:${t.color}18;color:${t.color};font-size:15px;font-weight:700;padding:1px 6px;border-radius:999px;">${t.label} ${v}</span>`;
        }).join('');

        return `
        <div class="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-4 hover:shadow-md transition-all cursor-pointer" onclick="window.switchTab('orders');window.setOrderFilter('tech','${nombre}')">
            <div class="flex items-center gap-3 mb-3">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black flex-shrink-0" style="background:${color};">${initials}</div>
                <div class="flex-1 min-w-0">
                    <p class="font-bold text-on-surface text-sm truncate flex items-center gap-2">${firstName}</p>
                    ${onlineBadge}
                </div>
                <span class="text-sm font-black" style="color:${color};">${pct}%</span>
            </div>
            <div class="w-full h-1.5 bg-surface-container rounded-full overflow-hidden mb-2">
                <div class="h-full rounded-full transition-all" style="width:${pct}%;background:${color};"></div>
            </div>
            <div class="flex flex-wrap gap-1">${typeBadges || '<span class="text-[9px] text-on-surface-variant">Sin órdenes hoy</span>'}</div>
        </div>`;
    }).join('');

    return `
    <div class="space-y-6">
        <!-- Stats globales -->
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div class="bg-primary text-white p-5 rounded-2xl relative overflow-hidden">
                <p class="text-[10px] font-bold uppercase tracking-widest opacity-60">Total Hoy</p>
                <h3 class="text-4xl font-black mt-1">${total}</h3>
                <p class="text-xs opacity-70 mt-1">órdenes asignadas</p>
                <span class="material-symbols-outlined absolute -right-2 -bottom-2 text-7xl opacity-10">assignment</span>
            </div>
            <div class="bg-surface-container-lowest border border-outline-variant/20 p-5 rounded-2xl relative overflow-hidden">
                <p class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Completadas</p>
                <h3 class="text-4xl font-black mt-1 text-on-tertiary-container">${done}</h3>
                <p class="text-xs text-on-surface-variant mt-1">resultado exitoso</p>
            </div>
            <div class="bg-surface-container-lowest border border-outline-variant/20 p-5 rounded-2xl relative overflow-hidden">
                <p class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Pendientes</p>
                <h3 class="text-4xl font-black mt-1 text-secondary">${pending}</h3>
                <p class="text-xs text-on-surface-variant mt-1">en espera</p>
            </div>
            <div class="bg-surface-container-lowest border border-tertiary-fixed-dim/30 p-5 rounded-2xl relative overflow-hidden" style="background:rgba(16,185,129,0.05);">
                <p class="text-[10px] font-bold uppercase tracking-widest" style="color:#059669;">En curso</p>
                <h3 class="text-4xl font-black mt-1" style="color:#059669;">${activeCount}</h3>
                <p class="text-xs text-on-surface-variant mt-1">técnicos activos</p>
                <span class="material-symbols-outlined absolute right-2 top-4 text-3xl opacity-20 animate-pulse" style="color:#059669;">timer</span>
            </div>
            <div class="bg-surface-container-lowest border border-error/20 p-5 rounded-2xl relative overflow-hidden">
                <p class="text-[10px] font-bold uppercase tracking-widest text-error">Sin NAP</p>
                <h3 class="text-4xl font-black mt-1 text-error">${noNap}</h3>
                <p class="text-xs text-on-surface-variant mt-1">requieren asignación</p>
            </div>
        </div>

        <!-- Header técnicos -->
        <div class="flex items-center justify-between">
            <h2 class="text-lg font-black text-on-surface">Flota del Día</h2>
            <div class="flex items-center gap-2">
                <span class="text-[10px] text-on-surface-variant font-bold">${syncText}</span>
                <button onclick="window.syncNow()" class="flex items-center gap-1.5 border border-outline-variant/30 text-secondary px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-surface-container transition-colors active:scale-95">
                    <span class="material-symbols-outlined text-[16px] inline-block ${state.isSyncing ? 'animate-spin' : ''}" id="sync-icon">sync</span> Sincronizar
                </button>
            </div>
        </div>

        <!-- Grid técnicos -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${techCards}
        </div>
    </div>`;
};

// ── ÓRDENES ───────────────────────────────────────────────────────────────
Views.orders = () => {
    const { type, tech, zone } = state.orderFilter;

    // Tabs
    const counts = {
        all:          state.orders.length,
        technical:    state.orders.filter(o => o.kind === 'technical').length,
        installation: state.orders.filter(o => o.kind === 'installation').length,
        feasibility:  state.orders.filter(o => o.kind === 'feasibility').length,
        resignation:  state.orders.filter(o => o.kind === 'resignation').length,
        no_nap:       state.orders.filter(o => (o.kind === 'technical' || o.kind === 'installation') && !o.nap).length
    };

    const tabs = [
        { id: 'all',          label: `Todas (${counts.all})` },
        { id: 'technical',    label: `Visita Técnica (${counts.technical})` },
        { id: 'installation', label: `Instalación (${counts.installation})` },
        { id: 'feasibility',  label: `Factibilidad (${counts.feasibility})` },
        { id: 'resignation',  label: `Baja (${counts.resignation})` },
        { id: 'no_nap',       label: `Sin NAP (${counts.no_nap})`, alert: true }
    ];

    // Filtrar
    let filtered = type === 'no_nap'
        ? state.orders.filter(o => (o.kind === 'technical' || o.kind === 'installation') && !o.nap)
        : type === 'all' ? [...state.orders] : state.orders.filter(o => o.kind === type);

    if (tech !== 'all') filtered = filtered.filter(o => o.techName?.toLowerCase().includes(tech.split(' ')[0].toLowerCase()));
    if (zone !== 'all') filtered = filtered.filter(o => o.zone === zone);

    // Técnicos y zonas únicos
    const baseForFilters = type === 'no_nap'
        ? state.orders.filter(o => (o.kind === 'technical' || o.kind === 'installation') && !o.nap)
        : type === 'all' ? state.orders : state.orders.filter(o => o.kind === type);

    const techs = [...new Set(baseForFilters.map(o => o.techName).filter(isActiveTech))].sort();
    const zones = [...new Set(baseForFilters.map(o => o.zone).filter(Boolean))].sort();

    const tabsHtml = tabs.map(t => {
        const active = type === t.id;
        const cls = active
            ? (t.alert ? 'background:#dc2626;color:white;' : 'background:#111827;color:white;')
            : (t.alert ? 'background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;' : 'background:#f3f4f6;color:#374151;');
        return `<button onclick="window.setOrderFilter('type','${t.id}')" style="${cls}padding:7px 14px;border-radius:999px;font-size:15px;font-weight:700;border:none;cursor:pointer;white-space:nowrap;transition:all 0.15s;">${t.label}</button>`;
    }).join('');

    const techPills = techs.map(n => {
        const active = tech === n;
        const color  = techColor(n);
        const first  = n.split(' ')[0];
        const cnt    = baseForFilters.filter(o => o.techName?.toLowerCase().includes(first.toLowerCase())).length;
        return `<button onclick="window.setOrderFilter('tech','${n}')" style="${active ? `background:${color};color:white;` : 'background:#f3f4f6;color:#374151;'}padding:6px 12px;border-radius:999px;font-size:15px;font-weight:700;border:none;cursor:pointer;display:flex;align-items:center;gap:4px;">
            ${first} <span style="font-size:16px;font-weight:800;padding:0 4px;border-radius:999px;${active?'background:rgba(255,255,255,0.25);':'background:#e5e7eb;'}">${cnt}</span>
        </button>`;
    }).join('');

    const zonePills = zones.map(z => {
        const active = zone === z;
        const cnt    = baseForFilters.filter(o => o.zone === z).length;
        return `<button onclick="window.setOrderFilter('zone','${z}')" style="${active ? 'background:#111827;color:white;' : 'background:#f3f4f6;color:#374151;'}padding:6px 12px;border-radius:999px;font-size:15px;font-weight:700;border:none;cursor:pointer;display:flex;align-items:center;gap:4px;">
            ${z} <span style="font-size:16px;font-weight:800;padding:0 4px;border-radius:999px;${active?'background:rgba(255,255,255,0.2);':'background:#e5e7eb;'}">${cnt}</span>
        </button>`;
    }).join('');

    const renderRows = (collection, emptyMsg) => {
        if (!collection.length) return `<tr><td colspan="6" style="text-align:center;padding:48px;color:#9ca3af;"><span style="font-size:15px;font-weight:700;text-transform:uppercase;">${emptyMsg}</span></td></tr>`;
        return collection.map(o => {
            const color    = o.typeColor;
            const tColor   = techColor(o.techName);
            const initials = techInitials(o.techName);
            const napBadge = (o.kind === 'technical' || o.kind === 'installation')
                ? (o.nap
                    ? `<span style="background:#f0fdf4;color:#059669;font-size:16px;font-weight:700;padding:3px 9px;border-radius:999px;">✓ ${o.nap}</span>`
                    : `<button onclick="window.openNapModal('${o.id}')" style="background:#fee2e2;color:#dc2626;font-size:16px;font-weight:700;padding:3px 9px;border-radius:999px;border:none;cursor:pointer;">Sin NAP</button>`)
                : '';

            return `
            <tr onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'" style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:12px 14px;min-width:180px;">
                    <div style="display:flex;align-items:flex-start;gap:6px;">
                        <div style="width:3px;height:32px;background:${color};border-radius:2px;flex-shrink:0;margin-top:2px;"></div>
                        <div>
                            <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
                                <span style="font-weight:800;color:#111827;font-size:15px;">#${o.id}</span>
                                <span style="background:${color}18;color:${color};font-size:15px;font-weight:700;padding:1px 6px;border-radius:999px;">${o.typeLabel}</span>
                            </div>
                            <p style="font-size:16px;color:#374151;font-weight:600;margin-top:2px;">${o.client}</p>
                        </div>
                    </div>
                </td>
                <td style="padding:12px 14px;min-width:160px;">
                    <p style="font-size:16px;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;">${o.address || '—'}</p>
                    ${o.zone ? `<span style="font-size:16px;color:#0059bb;font-weight:700;">${o.zone}</span>` : ''}
                </td>
                <td style="padding:12px 14px;">
                    <div style="display:flex;align-items:center;gap:6px;">
                        <div style="width:28px;height:28px;border-radius:50%;background:${tColor};display:flex;align-items:center;justify-content:center;color:white;font-size:16px;font-weight:800;flex-shrink:0;" title="${o.techName}">${initials}</div>
                        <span style="font-size:15px;color:#374151;font-weight:600;white-space:nowrap;">${o.techName.split(' ')[0]}</span>
                    </div>
                </td>
                <td style="padding:12px 14px;white-space:nowrap;">
                    <span style="font-size:16px;font-weight:700;color:#374151;">${o.startTime}</span>
                    <span style="font-size:16px;color:#9ca3af;"> → ${o.endTime}</span>
                </td>
                <td style="padding:12px 14px;">
                    ${o.trackData && o.trackData.status === 'started'
                        ? `<span style="background:rgba(16,185,129,0.15);color:#059669;font-size:14px;font-weight:800;padding:4px 10px;border-radius:999px;border:1px solid rgba(16,185,129,0.3);animation:pulse 2s cubic-bezier(0.4,0,0.6,1) infinite;display:inline-flex;align-items:center;gap:4px;">
                               <span class="material-symbols-outlined" style="font-size:14px;">timer</span>
                               En curso: ${Math.floor((Date.now() - o.trackData.startTime)/60000)}m
                           </span><style>@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }</style>`
                        : statusBadge(o.state)}
                </td>
                <td style="padding:12px 14px;">${napBadge}</td>
            </tr>`;
        }).join('');
    };

    const mainRows = renderRows(filtered, 'Sin órdenes con estos filtros');

    const todayStr = new Date().toLocaleDateString('en-CA');
    const fToday = state.finishedOrders.filter(o => o.endDay === todayStr);

    function renderFinishedTable(collection, title) {
        if (!collection.length) return '';
        return `
        <div style="margin-top:24px;">
            <p style="font-size:15px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
                <span class="material-symbols-outlined" style="font-size:18px;">check_circle</span> ${title} (${collection.length})
            </p>
            <div style="background:white;border:1px solid #f0f0f0;border-radius:12px;overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;min-width:700px;opacity:0.85;filter:grayscale(30%);">
                    <thead>
                        <tr style="background:#f8fafc;border-bottom:2px solid #e5e7eb;text-align:left;">
                            <th style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;"># Cliente</th>
                            <th style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Dirección / Zona</th>
                            <th style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Técnico</th>
                            <th style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Hora</th>
                            <th style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Estado</th>
                            <th style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">NAP</th>
                        </tr>
                    </thead>
                    <tbody>${renderRows(collection, '')}</tbody>
                </table>
            </div>
        </div>`;
    }

    return `
    <div>
        <div class="flex items-center justify-between mb-4">
            <h2 class="text-2xl font-extrabold text-on-surface">Órdenes del Día</h2>
            <button onclick="window.syncNow()" class="flex items-center gap-1.5 border border-outline-variant/30 text-secondary px-3 py-2 rounded-xl text-xs font-bold hover:bg-surface-container transition-colors active:scale-95">
                <span class="material-symbols-outlined text-[16px] inline-block ${state.isSyncing ? 'animate-spin' : ''}">sync</span> Actualizar
            </button>
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;margin-bottom:12px;">${tabsHtml}</div>

        <!-- Filtros -->
        <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
            ${techs.length > 0 ? `
            <div style="background:white;border:1px solid #f0f0f0;border-radius:12px;padding:12px 16px;display:flex;flex-direction:column;gap:6px;flex:1;min-width:180px;">
                <span style="font-size:16px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#6b7280;">Técnico</span>
                <div style="display:flex;flex-wrap:wrap;gap:5px;">
                    <button onclick="window.setOrderFilter('tech','all')" style="${tech==='all'?'background:#0059bb;color:white;':'background:#f3f4f6;color:#374151;'}padding:6px 12px;border-radius:999px;font-size:15px;font-weight:700;border:none;cursor:pointer;">Todos</button>
                    ${techPills}
                </div>
            </div>` : ''}
            ${zones.length > 0 ? `
            <div style="background:white;border:1px solid #f0f0f0;border-radius:12px;padding:12px 16px;display:flex;flex-direction:column;gap:6px;flex:1;min-width:180px;">
                <span style="font-size:16px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#6b7280;">Zona</span>
                <div style="display:flex;flex-wrap:wrap;gap:5px;">
                    <button onclick="window.setOrderFilter('zone','all')" style="${zone==='all'?'background:#111827;color:white;':'background:#f3f4f6;color:#374151;'}padding:6px 12px;border-radius:999px;font-size:15px;font-weight:700;border:none;cursor:pointer;">Todas</button>
                    ${zonePills}
                </div>
            </div>` : ''}
        </div>

        <p style="font-size:15px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">${filtered.length} orden${filtered.length !== 1 ? 'es' : ''}</p>

        <!-- Tabla -->
        <div style="background:white;border:1px solid #f0f0f0;border-radius:12px;overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;min-width:700px;">
                <thead>
                    <tr style="background:#f8fafc;border-bottom:2px solid #e5e7eb;text-align:left;">
                        <th style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;"># Cliente</th>
                        <th style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Dirección / Zona</th>
                        <th style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Técnico</th>
                        <th style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Hora</th>
                        <th style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Estado</th>
                        <th style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">NAP</th>
                    </tr>
                </thead>
                <tbody>${mainRows}</tbody>
            </table>
        </div>
        ${renderFinishedTable(fToday, 'Órdenes Finalizadas (Hoy)')}
    </div>`;
};

// ── TÉCNICOS ──────────────────────────────────────────────────────────────
Views.technicians = () => {
    const cards = TECNICOS_ACTIVOS.map(nombre => {
        const color     = TECH_PALETTE[nombre];
        const initials  = techInitials(nombre);
        const myOrders  = state.orders.filter(o => o.techName?.toLowerCase().includes(nombre.split(' ')[0].toLowerCase()));
        const done      = myOrders.filter(o => o.result === 'success').length;
        const pending   = myOrders.filter(o => o.state === 'pending').length;
        const pct       = myOrders.length > 0 ? Math.round(done / myOrders.length * 100) : 0;

        const byType = {};
        myOrders.forEach(o => { byType[o.kind] = (byType[o.kind] || 0) + 1; });
        const badges = Object.entries(byType).map(([k, v]) => {
            const t = TYPE_CFG[k] || { color: '#6b7280', label: k };
            return `<span style="background:${t.color}18;color:${t.color};font-size:15px;font-weight:700;padding:1px 6px;border-radius:999px;">${t.label} ${v}</span>`;
        }).join('');

        return `
        <div class="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden hover:shadow-md transition-all">
            <div class="p-5 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-base font-black flex-shrink-0" style="background:${color};">${initials}</div>
                    <div>
                        <p class="font-bold text-on-surface text-base">${nombre}</p>
                        <p class="text-[10px] text-on-surface-variant mt-0.5">${myOrders.length} órdenes · ${pending} pendientes</p>
                        <div class="flex flex-wrap gap-1 mt-1.5">${badges || '<span class="text-[9px] text-on-surface-variant">Sin órdenes hoy</span>'}</div>
                    </div>
                </div>
                <div class="flex flex-col items-end gap-2">
                    <button onclick="window.openTechModal('${nombre}')" class="kinetic-gradient text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-transform">
                        <span class="material-symbols-outlined text-[15px]">assignment</span> Ver órdenes
                    </button>
                    <span class="text-sm font-black" style="color:${color};">${pct}%</span>
                </div>
            </div>
            ${myOrders.length > 0 ? `
            <div class="px-5 pb-4">
                <div class="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                    <div class="h-full rounded-full" style="width:${pct}%;background:${color};transition:width 0.5s;"></div>
                </div>
            </div>` : ''}
        </div>`;
    }).join('');

    return `
    <div>
        <h2 class="text-2xl font-extrabold text-on-surface mb-6">Flota de Técnicos</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">${cards}</div>

        <!-- Modal órdenes del técnico -->
        <div id="tech-modal" class="hidden fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onclick="if(event.target===this)window.closeTechModal()">
            <div class="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div class="flex justify-between items-center px-6 py-4 border-b border-gray-100">
                    <div class="flex items-center gap-3">
                        <div id="tm-avatar" class="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-black"></div>
                        <div>
                            <h3 id="tm-name" class="font-black text-gray-900 text-base"></h3>
                            <p id="tm-sub" class="text-xs text-gray-500"></p>
                        </div>
                    </div>
                    <button onclick="window.closeTechModal()" class="p-2 rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div id="tm-body" class="overflow-y-auto flex-1 p-5 space-y-4"></div>
            </div>
        </div>
    </div>`;
};

// ── REPORTES ──────────────────────────────────────────────────────────────
Views.reports = () => {
    const { date } = state.issueFilter;
    const today    = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
    const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate()+7);

    // Filtrar por fecha o estado de asignación
    let allIssues = state.issues.filter(issue => {
        if (date === 'sin_asignar') {
            return !issue.assignable_id;
        }

        // Excluir los sin asignar si no estamos en ese filtro
        if (!issue.assignable_id) return false;

        // Verificar que el técnico sea uno de los activos
        const techName = state.techs[issue.assignable_id] || '';
        const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
        const foundInDB = (db.technicians || []).find(t => String(t.id) === String(issue.assignable_id));
        const resolvedName = techName || foundInDB?.name || '';
        const esActivo = resolvedName && TECNICOS_ACTIVOS.some(n =>
            resolvedName.toLowerCase().includes(n.split(' ')[0].toLowerCase())
        );
        if (!esActivo) return false;

        if (date !== 'all') {
            const venc = issue.expires_at ? new Date(issue.expires_at) : null;
            if (!venc) return date === 'sin_fecha';
            venc.setHours(0,0,0,0);
            if (date === 'hoy'     && venc.getTime() !== today.getTime())    return false;
            if (date === 'manana'  && venc.getTime() !== tomorrow.getTime()) return false;
            if (date === 'vencido' && venc >= today)                         return false;
        }
        return true;
    });

    // Agrupar por tecnico — usar assignable_id que es el "Asignado a" de Mesa de Ayuda
    const byTech = {};
    allIssues.forEach(issue => {
        // Buscar nombre: primero en state.techs (employees), luego en localStorage
        let techName = state.techs[issue.assignable_id];

        if (!techName && issue.assignable_id) {
            // Fallback: buscar en técnicos del localStorage
            const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
            const found = (db.technicians || []).find(t =>
                String(t.id) === String(issue.assignable_id)
            );
            techName = found?.name;
        }

        if (!techName) techName = 'Sin asignar';

        // Omitir 'Sin asignar' a menos que estemos explícitamente en el filtro
        if (techName === 'Sin asignar' && date !== 'sin_asignar') return;

        if (!byTech[techName]) byTech[techName] = [];
        byTech[techName].push(issue);
    });

    const CONTRATISTAS = ['Daniel Opua','Jose Mendoza','Mario Gonzalez'];

    const renderTechCard = (techName, issues) => {
        const color    = techName === 'Sin asignar' ? '#9ca3af' : techColor(techName);
        const initials = techName === 'Sin asignar' ? 'SA' : techInitials(techName);
        const isContratista = CONTRATISTAS.some(n => techName.toLowerCase().includes(n.split(' ')[0].toLowerCase()));
        const subtitle = techName === 'Sin asignar' ? 'Ticket Huérfano' : (isContratista ? 'Contratista' : 'Técnico Operativo');

        // Agrupar por zona
        const byZone = {};
        issues.forEach(issue => {
            const client = state.clients[issue.client_id] || {};
            const title  = issue.title || issue.description || '';
            const zm = title.match(/\(([^)]+)\)/);
            const zone = client.zone || (zm ? zm[1] : '') || 'Sin zona';
            if (!byZone[zone]) byZone[zone] = [];
            byZone[zone].push(issue);
        });

        const zoneRows = Object.entries(byZone).map(([zone, zIssues]) =>
            `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f3f4f6;">
                <div style="display:flex;align-items:center;gap:6px;">
                    <span class="material-symbols-outlined" style="font-size:13px;color:#9ca3af;">location_on</span>
                    <span style="font-size:14px;font-weight:600;color:#374151;">${zone}</span>
                </div>
                <span style="font-size:13px;font-weight:800;color:${color};background:${color}15;padding:2px 10px;border-radius:999px;">${zIssues.length}</span>
            </div>`
        ).join('');

        // Texto WhatsApp
        let waText = '';
        if (techName !== 'Sin asignar') {
            const waLines = [`*Reportes Pendientes — ${techName}*`,
                `Fecha: ${new Date().toLocaleDateString('es-PA',{weekday:'long',day:'numeric',month:'long'})}`, ''];
            Object.entries(byZone).forEach(([zone, zIssues]) => {
                waLines.push(`*${zone}* (${zIssues.length})`);
                zIssues.forEach(i => {
                    const c   = state.clients[i.client_id] || {};
                    const cat = state.categories[i.category_id] || '';
                    const t   = (i.title||i.description||'').replace(/\s*\([^)]*\)\s*/g,'').trim();
                    waLines.push(`  #${i.public_id} ${c.name||t} ${cat?'— '+cat:''}`);
                });
                waLines.push('');
            });
            waLines.push(`Total: ${issues.length} reporte${issues.length!==1?'s':''}`);
            waLines.push('— Velocity Rappido Panama');
            waText = encodeURIComponent(waLines.join('\n'));
        }

        const detailRows = issues.map(issue => {
            const client   = state.clients[issue.client_id] || {};
            const title    = issue.title || issue.description || 'Sin titulo';
            const zm       = title.match(/\(([^)]+)\)/);
            const zoneName = zm ? zm[1] : (client.zone || '');
            const cleanT   = title.replace(/\s*\([^)]*\)\s*/g,'').trim();
            const category = state.categories[issue.category_id] || '';
            const vencDate = issue.expires_at ? new Date(issue.expires_at) : null;
            const todayChk = new Date(); todayChk.setHours(0,0,0,0);
            let vencText = '—', vencCol = '#6b7280';
            if (vencDate) {
                const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
                vencText = `${vencDate.getDate()} ${months[vencDate.getMonth()]}.`;
                const vd = new Date(vencDate); vd.setHours(0,0,0,0);
                if (vd < todayChk) vencCol = '#dc2626';
                else if (vd.getTime() === todayChk.getTime()) vencCol = '#d97706';
                else vencCol = '#059669';
            }
            return `<div style="display:flex;align-items:flex-start;gap:8px;padding:7px;border-radius:8px;background:#f9fafb;margin-bottom:4px;">
                <div style="width:3px;height:30px;background:#f97316;border-radius:2px;flex-shrink:0;margin-top:2px;"></div>
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
                        <span style="font-weight:800;color:#111827;font-size:13px;">#${issue.public_id||'—'}</span>
                        ${category?`<span style="background:#f3f4f6;color:#374151;font-size:11px;font-weight:600;padding:1px 6px;border-radius:999px;">${category}</span>`:''}
                        <span style="font-weight:700;color:${vencCol};font-size:12px;margin-left:auto;">${vencText}</span>
                    </div>
                    <p style="font-size:13px;color:#0059bb;font-weight:500;margin:2px 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${client.name||cleanT}</p>
                    ${zoneName?`<span style="font-size:11px;color:#6b7280;">${zoneName}</span>`:''}
                </div>
            </div>`;
        }).join('');

        const safeId = techName.replace(/\s+/g,'-').replace(/[^a-zA-Z0-9-]/g,'');

        return `<div style="background:white;border:1px solid #f0f0f0;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #f3f4f6;">
                <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:38px;height:38px;border-radius:12px;background:${color};display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:800;flex-shrink:0;">${initials}</div>
                    <div>
                        <p style="font-weight:800;color:#111827;font-size:17px;margin:0;line-height:1.2;">${techName}</p>
                        <p style="font-size:14.5px;font-weight:700;color:#4b5563;margin-top:4px;">${issues.length} reporte${issues.length!==1?'s':''}</p>
                    </div>
                </div>
                ${techName !== 'Sin asignar' ? `<button onclick="window.sendReportWA('${waText}')"
                    style="display:flex;align-items:center;gap:5px;padding:7px 12px;background:#25D366;color:white;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    WhatsApp
                </button>` : ''}
            </div>
            <div style="padding:10px 16px;">${zoneRows||'<p style="font-size:13px;color:#9ca3af;text-align:center;padding:8px;">Sin zonas</p>'}</div>
            <div style="padding:0 16px 12px;">
                <button onclick="window.toggleTechDetail('detail-${safeId}')"
                    style="width:100%;padding:6px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;font-size:13px;font-weight:700;color:#6b7280;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;">
                    <span class="material-symbols-outlined" style="font-size:14px;">expand_more</span> Ver tickets
                </button>
                <div id="detail-${safeId}" style="display:none;margin-top:8px;max-height:280px;overflow-y:auto;">${detailRows}</div>
            </div>
        </div>`;
    };

    // Resumen global WhatsApp
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    const mNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const titleDate = `${tmrw.getDate()} de ${mNames[tmrw.getMonth()]}`;

    const globalLines = [`*Reportes ${titleDate}*`, ''];
    Object.entries(byTech).sort((a,b)=>b[1].length-a[1].length).forEach(([name, issues]) => {
        const bz = {};
        issues.forEach(i => {
            const c = state.clients[i.client_id]||{};
            const t = i.title||i.description||'';
            const zm = t.match(/\(([^)]+)\)/);
            const z = c.zone||(zm?zm[1]:'')||'Sin zona';
            bz[z] = (bz[z]||0)+1;
        });
        globalLines.push(`*${name}* — ${issues.length} reporte${issues.length!==1?'s':''}`);
        Object.entries(bz).forEach(([z,n]) => globalLines.push(`  ${z}: ${n}`));
        globalLines.push('');
    });
    globalLines.push(`Total: ${allIssues.length} reportes`);
    const globalWaText = encodeURIComponent(globalLines.join('\n'));

    const techCards = Object.entries(byTech)
        .sort((a,b) => b[1].length - a[1].length)
        .map(([name, issues]) => renderTechCard(name, issues))
        .join('');

    const counts = { all: 0, hoy: 0, manana: 0, semana: 0, vencido: 0, sin_fecha: 0, sin_asignar: 0 };
    const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    state.issues.forEach(i => {
        if (!i.assignable_id) { counts.sin_asignar++; return; }
        
        let tName = state.techs[i.assignable_id];
        if (!tName) {
            const f = (db.technicians || []).find(t => String(t.id) === String(i.assignable_id));
            tName = f?.name;
        }
        const esAct = tName && TECNICOS_ACTIVOS.some(n => tName.toLowerCase().includes(n.split(' ')[0].toLowerCase()));
        if (!esAct) return;

        counts.all++;
        const venc = i.expires_at ? new Date(i.expires_at) : null;
        if (!venc) { counts.sin_fecha++; return; }
        
        venc.setHours(0,0,0,0);
        const tTime = today.getTime();
        const mTime = tomorrow.getTime();
        const vTime = venc.getTime();
        
        if (vTime === tTime) counts.hoy++;
        if (vTime === mTime) counts.manana++;
        if (venc < today) counts.vencido++;
    });

    const dateFilters = [
        {v:'all',l:'Todos',c:counts.all},
        {v:'hoy',l:'Hoy',c:counts.hoy},
        {v:'manana',l:'Mañana',c:counts.manana},
        {v:'vencido',l:'Vencidos',c:counts.vencido},
        {v:'sin_fecha',l:'Sin fecha',c:counts.sin_fecha},
        {v:'sin_asignar',l:'Sin asignar',c:counts.sin_asignar}
    ].map(f => {
        const active = date === f.v;
        const bg = active ? '#111827' : '#f3f4f6';
        const color = active ? 'white' : '#374151';
        const badgeBg = active ? 'rgba(255,255,255,0.2)' : '#e5e7eb';
        return `<button onclick="window.setIssueFilter('date','${f.v}')" style="display:flex;align-items:center;gap:6px;padding:6px 14px;border-radius:999px;font-size:13px;font-weight:700;border:none;cursor:pointer;background:${bg};color:${color};">
            ${f.l} <span style="font-size:11px;font-weight:800;padding:2px 6px;border-radius:999px;background:${badgeBg};">${f.c}</span>
        </button>`;
    }).join('');

    return `<div>
        <div class="flex items-center justify-between mb-4">
            <div>
                <h2 class="text-2xl font-extrabold text-on-surface">Reportes Mesa de Ayuda</h2>
                <p class="text-sm text-on-surface-variant mt-1">Pendientes agrupados por tecnico y zona</p>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
                <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:6px 12px;display:flex;align-items:center;gap:5px;">
                    <span style="width:7px;height:7px;background:#f97316;border-radius:50%;display:inline-block;"></span>
                    <span style="font-size:14px;font-weight:700;color:#c2410c;">Pendiente ${allIssues.length}</span>
                </div>
                <button onclick="window.sendReportWA('${globalWaText}')"
                    style="display:flex;align-items:center;gap:5px;padding:8px 14px;background:#25D366;color:white;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Resumen Global
                </button>
                <button onclick="window.refreshIssues()" style="width:34px;height:34px;border:1px solid #e5e7eb;border-radius:8px;background:white;cursor:pointer;display:flex;align-items:center;justify-content:center;">
                    <span class="material-symbols-outlined inline-block ${state.isSyncing ? 'animate-spin' : ''}" style="font-size:17px;color:#6b7280;">sync</span>
                </button>
            </div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">${dateFilters}</div>
        ${allIssues.length === 0
            ? `<div style="text-align:center;padding:60px;color:#9ca3af;"><span class="material-symbols-outlined" style="font-size:48px;display:block;margin-bottom:8px;">search_off</span><p style="font-weight:700;font-size:14px;text-transform:uppercase;">Sin reportes pendientes</p></div>`
            : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px;">${techCards}</div>`
        }

        ${(() => {
            const renderFinishedList = (coll, titleText) => {
                if (!coll.length) return '';
                const formatTime = (iso) => {
                    if (!iso) return '';
                    const d = new Date(iso);
                    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                };
                const rows = coll.map(i => {
                    let tName = state.techs[i.assignable_id];
                    if (!tName) {
                        const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
                        const f = (db.technicians || []).find(t => String(t.id) === String(i.assignable_id));
                        tName = f?.name || 'Sin asignar';
                    }
                    const col = techColor(tName);
                    const st = i.title || i.description || '';
                    const cn = (state.clients[i.client_id] || {}).name || st.replace(/\s*\([^)]*\)\s*/g, '').trim() || 'Desconocido';
                    const ct = state.categories[i.category_id] || '';
                    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #f3f4f6;background:white;">
                        <div style="display:flex;align-items:center;gap:12px;">
                            <div style="width:3px;height:24px;background:#10b981;border-radius:2px;"></div>
                            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                                <span style="font-size:14px;font-weight:800;color:#111827;">#${i.public_id || ''}</span>
                                <span style="font-size:15px;font-weight:600;color:#374151;">${cn}</span>
                                ${ct ? `<span style="font-size:12px;color:#6b7280;background:#f3f4f6;padding:1px 6px;border-radius:4px;font-weight:600;">${ct}</span>` : ''}
                            </div>
                        </div>
                        <div style="display:flex;align-items:center;gap:12px;">
                            <span style="font-size:14px;font-weight:600;color:${col};background:${col}15;padding:2px 10px;border-radius:999px;">${tName.split(' ')[0]}</span>
                            <span style="font-size:13px;font-weight:700;color:#9ca3af;">${formatTime(i.updated_at)}</span>
                        </div>
                    </div>`;
                }).join('');

                return `
                <div style="margin-top:24px;">
                    <p style="font-size:15px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
                        <span class="material-symbols-outlined" style="font-size:18px;">check_circle</span> ${titleText} (${coll.length})
                    </p>
                    <div style="border:1px solid #f0f0f0;border-radius:12px;overflow:hidden;opacity:0.85;filter:grayscale(30%);box-shadow:0 1px 2px rgba(0,0,0,0.02);">
                        ${rows}
                    </div>
                </div>`;
            };

            const tStr = new Date().toLocaleDateString('en-CA');
            const fiToday = state.finishedIssues.filter(i => (i.updated_at || '').slice(0,10) === tStr);

            return renderFinishedList(fiToday, 'Reportes Finalizados (Hoy)');
        })()}
    </div>`;
};

// ── NAPs TRACKER ──────────────────────────────────────────────────────────
Views.naps = () => {
    let list = [...state.trackedNaps];
    const { sortBy, sortDir, zone } = state.napFilter;

    // Filter by zone
    if (zone !== 'all') {
        list = list.filter(n => n.zone?.toLowerCase().trim() === zone.toLowerCase().trim());
    }

    // Sort
    list.sort((a,b) => {
        let valA, valB;
        if (sortBy === 'date') {
            valA = new Date(a.date).getTime() || 0;
            valB = new Date(b.date).getTime() || 0;
        } else if (sortBy === 'name') {
            valA = (a.name || '').toLowerCase();
            valB = (b.name || '').toLowerCase();
        } else {
            valA = (a.zone || '').toLowerCase();
            valB = (b.zone || '').toLowerCase();
        }

        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });

    // Extract unique zones for the dropdown filter
    const uniqueZones = [...new Set(state.trackedNaps.map(n => n.zone?.trim()).filter(Boolean))].sort();

    const rows = list.map(n => {
        let latLngLink = n.coords;
        // Simple regex to check if it looks like coords to make it a maps link
        if (n.coords && n.coords.match(/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/)) {
            latLngLink = `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(n.coords.replace(/\s/g,''))}" target="_blank" style="color:#0059bb;text-decoration:underline;font-weight:600;">${n.coords}</a>`;
        }

        return `
        <tr style="border-bottom:1px solid #f3f4f6;background:${n.resolved ? '#f8fafc' : 'white'};opacity:${n.resolved ? '0.7' : '1'};transition:all 0.2s;">
            <td style="padding:12px 14px;white-space:nowrap;font-size:14px;color:#374151;">${n.date}</td>
            <td style="padding:12px 14px;font-weight:700;color:#111827;font-size:15px;">${n.name}</td>
            <td style="padding:12px 14px;font-size:14px;color:#374151;">${n.zone}</td>
            <td style="padding:12px 14px;font-size:14px;color:#6b7280;">${latLngLink||'—'}</td>
            <td style="padding:12px 14px;font-size:14px;color:#374151;">${n.ports||'—'}</td>
            <td style="padding:12px 14px;font-size:14px;color:#6b7280;">${n.comments||'—'}</td>
            <td style="padding:12px 14px;text-align:right;">
                <div style="display:flex;align-items:center;justify-content:flex-end;gap:12px;">
                    <input type="checkbox" ${n.resolved?'checked':''} onchange="window.toggleNapStatus('${n.id}')" style="width:18px;height:18px;accent-color:#10b981;cursor:pointer;" title="Marcar como revisada/resuelta">
                    <button onclick="window.editNapTracker('${n.id}')" style="background:none;border:none;color:#6b7280;cursor:pointer;display:flex;align-items:center;opacity:0.7;hover:opacity:1;" title="Editar registro"><span class="material-symbols-outlined text-[18px]">edit</span></button>
                    <button onclick="window.deleteNapTracker('${n.id}')" style="background:none;border:none;color:#ef4444;cursor:pointer;display:flex;align-items:center;opacity:0.6;hover:opacity:1;" title="Eliminar registro"><span class="material-symbols-outlined text-[18px]">delete</span></button>
                </div>
            </td>
        </tr>`;
    }).join('');

    return `
    <div>
        <div class="flex items-center justify-between mb-6">
            <div>
                <h2 class="text-2xl font-extrabold text-on-surface">Reportes de NAPs</h2>
                <p class="text-sm text-on-surface-variant mt-1">Control de niveles altos y saturación de puertos detectados en campo</p>
            </div>
        </div>

        <div class="flex flex-wrap items-center justify-between bg-surface-container-low p-3 rounded-2xl border border-outline-variant/30 mb-6 gap-3">
            <div class="flex flex-wrap items-center gap-3">
                <select onchange="window.setNapFilter('zone', this.value)" class="bg-white border border-outline-variant/50 text-sm rounded-xl px-3 py-2 text-on-surface focus:outline-none focus:border-secondary">
                    <option value="all" ${zone === 'all' ? 'selected' : ''}>Todas las Zonas</option>
                    ${uniqueZones.map(z => `<option value="${z}" ${zone === z ? 'selected' : ''}>${z}</option>`).join('')}
                </select>

                <select onchange="window.setNapFilter('sortBy', this.value)" class="bg-white border border-outline-variant/50 text-sm rounded-xl px-3 py-2 text-on-surface focus:outline-none focus:border-secondary">
                    <option value="date" ${sortBy === 'date' ? 'selected' : ''}>Ordenar por Fecha</option>
                    <option value="name" ${sortBy === 'name' ? 'selected' : ''}>Ordenar por Nombre</option>
                    <option value="zone" ${sortBy === 'zone' ? 'selected' : ''}>Ordenar por Zona</option>
                </select>

                <button onclick="window.setNapFilter('sortDir', '${sortDir === 'asc' ? 'desc' : 'asc'}')" class="flex items-center gap-1 bg-white border border-outline-variant/50 px-3 py-2 rounded-xl text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors active:scale-95">
                    <span class="material-symbols-outlined text-[18px]">${sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
                    ${sortDir === 'asc' ? 'Ascendente' : 'Descendente'}
                </button>
            </div>

            <button onclick="window.openNapTrackerModal()" class="flex items-center gap-2 bg-secondary text-white px-4 py-2 rounded-xl text-sm font-bold hover:shadow-lg transition-transform active:scale-95" style="background:linear-gradient(135deg,#0059bb,#0070ea);">
                <span class="material-symbols-outlined text-[18px]">add</span> Registrar NAP
            </button>
        </div>

        <div style="background:white;border:1px solid #f0f0f0;border-radius:12px;overflow-x:auto;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
            <table style="width:100%;border-collapse:collapse;min-width:900px;">
                <thead>
                    <tr style="background:#f8fafc;border-bottom:2px solid #e5e7eb;text-align:left;">
                        <th style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Fechas</th>
                        <th style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Nombres</th>
                        <th style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Zona</th>
                        <th style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Coordenadas</th>
                        <th style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Puertos</th>
                        <th style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Comentarios</th>
                        <th style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;text-align:right;">Opciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || `<tr><td colspan="7" style="text-align:center;padding:60px;color:#9ca3af;"><span class="material-symbols-outlined" style="font-size:48px;display:block;margin-bottom:8px;opacity:0.3;">hub</span><p style="font-weight:700;font-size:14px;text-transform:uppercase;">No hay NAPs registradas</p></td></tr>`}
                </tbody>
            </table>
        </div>
    </div>`;
};

// Modal Logic
window.openNapTrackerModal = (id = null) => {
    document.getElementById('nap-tracker-form').reset();
    document.getElementById('nt-id').value = id || Date.now().toString();
    if (!id) document.getElementById('nt-date').value = new Date().toLocaleDateString('en-CA');
    document.getElementById('nap-tracker-modal').classList.remove('hidden');
};

window.editNapTracker = (id) => {
    const item = state.trackedNaps.find(n => String(n.id) === String(id));
    if(!item) return;
    
    document.getElementById('nt-id').value = item.id;
    document.getElementById('nt-date').value = item.date || '';
    document.getElementById('nt-name').value = item.name || '';
    document.getElementById('nt-zone').value = item.zone || '';
    document.getElementById('nt-coords').value = item.coords || '';
    document.getElementById('nt-ports').value = item.ports || '';
    document.getElementById('nt-comments').value = item.comments || '';
    
    document.getElementById('nap-tracker-modal').classList.remove('hidden');
};

window.closeNapTrackerModal = () => document.getElementById('nap-tracker-modal').classList.add('hidden');

window.saveNapTracker = (e) => {
    e.preventDefault();
    const id = document.getElementById('nt-id').value;
    const nap = {
        id,
        date: document.getElementById('nt-date').value,
        name: document.getElementById('nt-name').value,
        zone: document.getElementById('nt-zone').value,
        coords: document.getElementById('nt-coords').value,
        ports: document.getElementById('nt-ports').value,
        comments: document.getElementById('nt-comments').value,
        resolved: false
    };
    
    const idx = state.trackedNaps.findIndex(n => String(n.id) === String(id));
    if(idx > -1) {
        nap.resolved = state.trackedNaps[idx].resolved;
        state.trackedNaps[idx] = nap;
    } else {
        state.trackedNaps.push(nap);
    }
    
    saveTrackedNaps();
    window.closeNapTrackerModal();
    if(state.tab === 'naps') renderTab('naps');
};

window.toggleNapStatus = (id) => {
    const item = state.trackedNaps.find(n => String(n.id) === String(id));
    if(item) {
        item.resolved = !item.resolved;
        saveTrackedNaps();
        if(state.tab === 'naps') renderTab('naps');
    }
};

window.deleteNapTracker = (id) => {
    if(confirm('¿Eliminar registro de esta NAP de la base de datos?')) {
        state.trackedNaps = state.trackedNaps.filter(n => String(n.id) !== String(id));
        saveTrackedNaps();
        if(state.tab === 'naps') renderTab('naps');
    }
};

window.setNapFilter = (key, value) => {
    state.napFilter[key] = value;
    if(state.tab === 'naps') renderTab('naps');
};

// ── CUENTAS ───────────────────────────────────────────────────────────────
Views.users = () => {
    const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    const supervisors = db.supervisors || [];
    const technicians = db.technicians || [];

    const supRows = supervisors.map(s => `
        <div class="flex items-center justify-between p-4 bg-surface-container rounded-xl">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                    <span class="material-symbols-outlined text-secondary text-xl" style="font-variation-settings:'FILL' 1;">admin_panel_settings</span>
                </div>
                <div>
                    <p class="font-bold text-on-surface text-sm">${s.name}</p>
                    <p class="text-xs text-on-surface-variant">${s.email}</p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold px-2 py-1 rounded-full ${s.disabled ? 'bg-error-container text-error' : 'bg-tertiary-fixed-dim/30 text-on-tertiary-container'}">
                    ${s.disabled ? 'Inactivo' : 'Activo'}
                </span>
                <button onclick="window.openEditUser('${s.id}','supervisor')" class="p-2 rounded-lg hover:bg-surface-container-high text-secondary transition-colors" title="Editar">
                    <span class="material-symbols-outlined text-sm">edit</span>
                </button>
                <button onclick="window.toggleUserStatus('${s.id}','supervisor')" class="p-2 rounded-lg hover:bg-surface-container-high transition-colors ${s.disabled ? 'text-on-tertiary-container' : 'text-error'}" title="${s.disabled ? 'Activar' : 'Desactivar'}">
                    <span class="material-symbols-outlined text-sm">${s.disabled ? 'toggle_off' : 'toggle_on'}</span>
                </button>
            </div>
        </div>`).join('');

    const techRows = technicians.map(t => `
        <div class="flex items-center justify-between p-4 bg-surface-container rounded-xl">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black" style="background:${techColor(t.name)};">
                    ${techInitials(t.name)}
                </div>
                <div>
                    <p class="font-bold text-on-surface text-sm">${t.name}</p>
                    <p class="text-xs text-on-surface-variant">${t.email}</p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold px-2 py-1 rounded-full ${t.disabled ? 'bg-error-container text-error' : 'bg-tertiary-fixed-dim/30 text-on-tertiary-container'}">
                    ${t.disabled ? 'Inactivo' : 'Activo'}
                </span>
                <button onclick="window.openEditUser('${t.id}','technician')" class="p-2 rounded-lg hover:bg-surface-container-high text-secondary transition-colors" title="Editar">
                    <span class="material-symbols-outlined text-sm">edit</span>
                </button>
                <button onclick="window.toggleUserStatus('${t.id}','technician')" class="p-2 rounded-lg hover:bg-surface-container-high transition-colors ${t.disabled ? 'text-on-tertiary-container' : 'text-error'}" title="${t.disabled ? 'Activar' : 'Desactivar'}">
                    <span class="material-symbols-outlined text-sm">${t.disabled ? 'toggle_off' : 'toggle_on'}</span>
                </button>
            </div>
        </div>`).join('');

    return `
    <div class="space-y-6 max-w-2xl">
        <div class="flex items-center justify-between">
            <h2 class="text-2xl font-extrabold text-on-surface">Gestión de Cuentas</h2>
            <div class="flex items-center gap-3">
                <button onclick="window.autoSyncTechs()" class="border border-outline-variant/50 text-secondary hover:bg-surface-container-low px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-1.5 active:scale-95 transition-colors">
                    <span class="material-symbols-outlined text-sm">cloud_sync</span> Importar Wispro
                </button>
                <button onclick="window.openNewUser()" class="kinetic-gradient text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-1.5 active:scale-95 transition-transform shadow-sm">
                    <span class="material-symbols-outlined text-sm">person_add</span> Nueva Cuenta
                </button>
            </div>
        </div>

        <div class="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 space-y-3">
            <p class="text-[10px] font-bold uppercase tracking-widest text-secondary flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[14px]">admin_panel_settings</span> Supervisores
            </p>
            ${supRows || '<p class="text-sm text-on-surface-variant py-2">Sin supervisores registrados</p>'}
        </div>

        <div class="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 space-y-3">
            <p class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[14px]">engineering</span> Técnicos Operativos
            </p>
            ${techRows || '<p class="text-sm text-on-surface-variant py-2">Sin técnicos registrados</p>'}
        </div>

    </div>`;
};



// ── AJUSTES ───────────────────────────────────────────────────────────────
Views.settings = () => {
    const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    const s  = db.settings || {};

    return `
    <div class="space-y-6 max-w-2xl">
        <h2 class="text-2xl font-extrabold text-on-surface">Ajustes del Sistema</h2>

        <!-- API Wispro -->
        <div class="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 space-y-4">
            <div class="flex items-center gap-2 mb-2">
                <span class="material-symbols-outlined text-secondary">api</span>
                <h3 class="font-bold text-on-surface">Integración Wispro</h3>
            </div>
            <div>
                <label class="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant ml-1">API Token</label>
                <input type="password" id="set-token" value="${s.wisproToken || ''}" class="w-full mt-1 bg-surface-container border border-outline-variant/30 focus:border-secondary focus:ring-1 focus:ring-secondary rounded-xl px-4 py-2.5 text-sm text-on-surface transition-colors" placeholder="Pega tu token aquí...">
            </div>
            <div class="flex items-center justify-between p-3 rounded-xl bg-surface-container/50 border border-outline-variant/20">
                <div>
                    <p class="text-[10px] font-black uppercase tracking-widest text-on-surface">Modo Live</p>
                    <p class="text-[9px] text-on-surface-variant mt-0.5">Conectar con API real de Wispro</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="set-live" ${s.isLiveMode ? 'checked' : ''} class="sr-only peer">
                    <div class="w-11 h-6 bg-outline-variant/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary"></div>
                </label>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <button onclick="window.saveSettings()" class="kinetic-gradient text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95">
                    <span class="material-symbols-outlined text-sm">save</span> Guardar
                </button>
                <button onclick="window.testConnection()" class="border border-secondary text-secondary py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-secondary/5 active:scale-95">
                    <span class="material-symbols-outlined text-sm">wifi_find</span> Probar
                </button>
            </div>
            <div id="conn-result" class="hidden text-xs font-bold p-3 rounded-xl"></div>
        </div>

        <!-- Cache -->
        <div class="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20">
            <div class="flex items-center gap-2 mb-4">
                <span class="material-symbols-outlined text-secondary">storage</span>
                <h3 class="font-bold text-on-surface">Cache de Datos</h3>
            </div>
            <p class="text-sm text-on-surface-variant mb-4">Los datos estáticos (clientes, técnicos) se guardan 24h. Las órdenes se actualizan cada 5 min.</p>
            <button onclick="window.clearAllCache()" class="border border-error/40 text-error py-2.5 px-5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-error-container/20 active:scale-95">
                <span class="material-symbols-outlined text-sm">delete_sweep</span> Limpiar todo el cache
            </button>
        </div>

        <!-- Gestión de Zonas -->
        <div class="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20">
            <div class="flex items-center gap-2 mb-4">
                <span class="material-symbols-outlined text-secondary">location_on</span>
                <div>
                    <h3 class="font-bold text-on-surface">Asignar Zona a Cliente</h3>
                    <p class="text-xs text-on-surface-variant mt-0.5">Actualiza zone_name del cliente en Wispro</p>
                </div>
            </div>
            <input type="text" id="zone-search" placeholder="Buscar cliente por nombre o #ID..."
                class="w-full bg-surface-container border border-outline-variant/30 focus:border-secondary focus:ring-1 focus:ring-secondary rounded-xl px-4 py-2.5 text-sm text-on-surface transition-colors mb-3"
                oninput="window.searchClientZone(this.value)">
            <div id="zone-results" class="space-y-2 max-h-48 overflow-y-auto mb-3"></div>
            <div id="zone-form" class="hidden p-4 bg-surface-container rounded-xl space-y-3">
                <p class="font-bold text-on-surface text-sm" id="zone-client-name"></p>
                <p class="text-xs text-on-surface-variant" id="zone-client-current"></p>
                <div class="flex gap-2">
                    <input type="text" id="zone-value" placeholder="Nueva zona..." class="flex-1 bg-surface-container-lowest border border-outline-variant/30 focus:border-secondary rounded-xl px-3 py-2 text-sm">
                    <button onclick="window.saveClientZone()" class="kinetic-gradient text-white px-4 py-2 rounded-xl font-bold text-sm active:scale-95">Guardar</button>
                </div>
                <p id="zone-status" class="text-xs font-bold hidden"></p>
            </div>
        </div>

        <!-- Cerrar sesión -->
        <div class="bg-error-container/20 border border-error/20 p-5 rounded-2xl">
            <button onclick="window.logout()" class="text-error font-bold text-sm uppercase tracking-widest flex items-center justify-center w-full gap-2 active:scale-95">
                <span class="material-symbols-outlined text-[18px]">logout</span> Cerrar Sesión
            </button>
        </div>
    </div>`;
};

// ── ACCIONES ──────────────────────────────────────────────────────────────
window.setOrderFilter = function(key, val) {
    state.orderFilter[key] = val;
    renderTab('orders');
};

window.setIssueFilter = function(key, val) {
    state.issueFilter[key] = val;
    renderTab('reports');
};

window.clearIssueFilters = function() {
    state.issueFilter = { tech: 'all', zone: 'all', date: 'all', sortBy: 'id', sortDir: 'desc' };
    renderTab('reports');
};

window.sendReportWA = function(encodedText) {
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
};

window.toggleTechDetail = function(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const isHidden = el.style.display === 'none';
    el.style.display = isHidden ? 'block' : 'none';
    const btn = el.previousElementSibling;
    if (btn) {
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = isHidden ? 'expand_less' : 'expand_more';
    }
};

window.sortIssues = function(col) {
    if (state.issueFilter.sortBy === col) {
        state.issueFilter.sortDir = state.issueFilter.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
        state.issueFilter.sortBy  = col;
        state.issueFilter.sortDir = col === 'venc' ? 'asc' : 'desc';
    }
    renderTab('reports');
};

window.syncNow = async function() {
    const icons = document.querySelectorAll('.material-symbols-outlined');
    icons.forEach(i => {
        if (i.textContent.trim() === 'sync') i.classList.add('animate-spin');
    });

    try {
        await loadTodayOrders(true);
        state.lastSync = Date.now();
        if (typeof renderTab === 'function') renderTab(state.tab);
    } catch(e) { console.error(e); }

    icons.forEach(i => i.classList.remove('animate-spin'));
};

window.refreshIssues = async function() {
    const icons = document.querySelectorAll('.material-symbols-outlined');
    icons.forEach(i => {
        if (i.textContent.trim() === 'sync') i.classList.add('animate-spin');
    });

    try {
        await loadIssues(true);
        if (typeof renderTab === 'function') renderTab('reports');
    } catch(e) { console.error(e); }
    
    icons.forEach(i => i.classList.remove('animate-spin'));
};

window.openTechModal = function(nombre) {
    const modal    = document.getElementById('tech-modal');
    const avatar   = document.getElementById('tm-avatar');
    const nameEl   = document.getElementById('tm-name');
    const subEl    = document.getElementById('tm-sub');
    const body     = document.getElementById('tm-body');
    if (!modal) return;

    const color    = TECH_PALETTE[nombre] || '#6b7280';
    avatar.style.background = color;
    avatar.textContent = techInitials(nombre);
    nameEl.textContent = nombre;

    const myOrders = state.orders.filter(o => o.techName?.toLowerCase().includes(nombre.split(' ')[0].toLowerCase()));
    subEl.textContent = `${myOrders.length} orden${myOrders.length !== 1 ? 'es' : ''} hoy`;

    if (!myOrders.length) {
        body.innerHTML = `<div class="flex flex-col items-center py-10 text-gray-400"><span class="material-symbols-outlined text-5xl mb-2">inbox</span><p class="font-bold text-sm uppercase">Sin órdenes hoy</p></div>`;
    } else {
        const grupos = {};
        myOrders.forEach(o => { if (!grupos[o.kind]) grupos[o.kind] = []; grupos[o.kind].push(o); });

        body.innerHTML = Object.entries(grupos).map(([kind, orders]) => {
            const t = TYPE_CFG[kind] || { color: '#6b7280', label: kind };
            const rows = orders.map(o => `
                <div style="display:flex;align-items:flex-start;gap:10px;padding:10px;border-radius:10px;background:#f9fafb;border:1px solid #f0f0f0;">
                    <div style="text-align:center;flex-shrink:0;min-width:40px;">
                        <span style="font-size:15px;font-weight:700;color:#6b7280;">${o.startTime}</span>
                    </div>
                    <div style="flex:1;min-width:0;">
                        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                            <span style="font-weight:800;color:#111827;font-size:15px;">#${o.id}</span>
                            ${statusBadge(o.state)}
                            ${o.nap ? `<span style="background:#f0fdf4;color:#059669;font-size:16px;font-weight:700;padding:1px 6px;border-radius:999px;">✓ NAP</span>` : ''}
                        </div>
                        <p style="font-weight:600;color:#374151;font-size:16px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${o.client}</p>
                        <p style="font-size:15px;color:#6b7280;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">📍 ${o.address || '—'}</p>
                        ${o.zone ? `<span style="font-size:16px;color:#0059bb;font-weight:700;">${o.zone}</span>` : ''}
                    </div>
                </div>`).join('');

            return `<div>
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
                    <div style="width:20px;height:20px;border-radius:6px;background:${t.color};display:flex;align-items:center;justify-content:center;">
                        <span style="color:white;font-size:15px;font-weight:900;">${orders.length}</span>
                    </div>
                    <span style="font-weight:800;font-size:16px;color:#111827;text-transform:uppercase;letter-spacing:0.04em;">${t.label}</span>
                </div>
                <div style="display:flex;flex-direction:column;gap:6px;">${rows}</div>
            </div>`;
        }).join('');
    }

    modal.classList.remove('hidden');
};

window.closeTechModal = function() {
    document.getElementById('tech-modal')?.classList.add('hidden');
};

// Modal NAP
window.openNapModal = function(orderId) {
    const order = state.orders.find(o => String(o.id) === String(orderId));
    if (!order) return;

    const existing = state.napOverrides[orderId] || {};
    const html = `
    <div id="nap-modal" class="fixed inset-0 z-[300] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onclick="if(event.target===this)document.getElementById('nap-modal').remove()">
        <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div class="flex justify-between items-center">
                <h3 class="font-black text-gray-900 text-lg">Asignar NAP — #${order.id}</h3>
                <button onclick="document.getElementById('nap-modal').remove()" class="text-gray-400 hover:text-gray-600"><span class="material-symbols-outlined">close</span></button>
            </div>
            <p class="text-sm text-gray-500">${order.client}</p>
            <div class="space-y-3">
                <div>
                    <label class="text-[10px] uppercase tracking-widest font-bold text-gray-500 ml-1">Nombre NAP</label>
                    <input type="text" id="nap-name" value="${existing.nap||''}" placeholder="Ej: CAJA-4-SEC-A" class="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-[10px] uppercase tracking-widest font-bold text-gray-500 ml-1">Puerto</label>
                        <input type="number" id="nap-port" value="${existing.port||''}" placeholder="Ej: 8" min="1" max="16" class="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                    </div>
                    <div>
                        <label class="text-[10px] uppercase tracking-widest font-bold text-gray-500 ml-1">Marquilla</label>
                        <input type="text" id="nap-marquilla" value="${existing.marquilla||''}" placeholder="Ej: R-405" class="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-[10px] uppercase tracking-widest font-bold text-gray-500 ml-1">Latitud</label>
                        <input type="text" id="nap-lat" value="${existing.lat||''}" placeholder="9.0745" class="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                    </div>
                    <div>
                        <label class="text-[10px] uppercase tracking-widest font-bold text-gray-500 ml-1">Longitud</label>
                        <input type="text" id="nap-lng" value="${existing.lng||''}" placeholder="-79.5245" class="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                    </div>
                </div>
            </div>
            <button onclick="window.saveNap('${orderId}')" class="w-full py-3 rounded-xl text-white font-bold text-sm active:scale-95 transition-transform" style="background:linear-gradient(135deg,#0059bb,#0070ea);">
                Confirmar NAP
            </button>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.saveNap = function(orderId) {
    const nap       = document.getElementById('nap-name')?.value.trim();
    const port      = document.getElementById('nap-port')?.value.trim();
    const marquilla = document.getElementById('nap-marquilla')?.value.trim();
    const lat       = document.getElementById('nap-lat')?.value.trim();
    const lng       = document.getElementById('nap-lng')?.value.trim();

    if (!nap) { alert('El nombre de la NAP es obligatorio'); return; }

    state.napOverrides[orderId] = { nap, port, marquilla, lat, lng };

    // Actualizar en state.orders
    const order = state.orders.find(o => String(o.id) === String(orderId));
    if (order) { order.nap = nap; order.marquilla = marquilla; }

    // Persistir
    cacheSet('orders', { orders: state.orders, napOverrides: state.napOverrides }, CFG.cacheTTL.orders);

    document.getElementById('nap-modal')?.remove();
    renderTab(state.tab);
};

// Ajustes
window.saveSettings = function() {
    const token = document.getElementById('set-token')?.value.trim();
    const live  = document.getElementById('set-live')?.checked;
    const db    = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    if (!db.settings) db.settings = {};
    db.settings.wisproToken = token;
    db.settings.isLiveMode  = live;
    localStorage.setItem('Velocity_Sync_State', JSON.stringify(db));
    if (token) { CFG.token = token; }
    alert('✅ Ajustes guardados');
};

window.testConnection = async function() {
    const resultEl = document.getElementById('conn-result');
    if (!resultEl) return;
    resultEl.className = 'text-xs font-bold p-3 rounded-xl bg-surface-container text-on-surface-variant';
    resultEl.textContent = '⏳ Probando...';
    resultEl.classList.remove('hidden');
    try {
        const url = CFG.proxy + encodeURIComponent(`${CFG.base}/employees?per_page=1`);
        const res = await fetch(url, { headers: { 'Authorization': CFG.token, 'Accept': 'application/json' } });
        if (res.ok) {
            const d = await res.json();
            resultEl.className = 'text-xs font-bold p-3 rounded-xl bg-green-50 text-green-700';
            resultEl.textContent = `✅ Conexión OK — ${d.meta?.total_count || d.data?.length || '?'} empleados`;
        } else {
            resultEl.className = 'text-xs font-bold p-3 rounded-xl bg-red-50 text-red-700';
            resultEl.textContent = `❌ Error HTTP ${res.status}`;
        }
    } catch(e) {
        resultEl.className = 'text-xs font-bold p-3 rounded-xl bg-red-50 text-red-700';
        resultEl.textContent = `❌ ${e.message}`;
    }
};

window.clearAllCache = function() {
    if (!confirm('¿Limpiar todo el cache? Se volverá a descargar todo de Wispro.')) return;
    cacheClear();
    alert('✅ Cache limpiado. Recarga la página.');
};

// Gestión de zonas
let _zoneClient = null;
window.searchClientZone = function(q) {
    const el = document.getElementById('zone-results');
    const form = document.getElementById('zone-form');
    if (!el) return;
    if (!q || q.length < 2) { el.innerHTML = ''; form?.classList.add('hidden'); return; }

    const matches = Object.entries(state.clients)
        .filter(([id, c]) => c.name?.toLowerCase().includes(q.toLowerCase()) || q.startsWith('#') && String(id).includes(q.slice(1)))
        .slice(0, 6);

    el.innerHTML = matches.map(([id, c]) => `
        <button onclick="window.selectClientZone('${id}')" class="w-full flex items-center justify-between p-3 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors text-left active:scale-95">
            <div>
                <p class="font-bold text-on-surface text-sm">${c.name}</p>
                <p class="text-xs text-on-surface-variant">${c.zone || 'Sin zona'}</p>
            </div>
            <span class="material-symbols-outlined text-secondary text-sm">chevron_right</span>
        </button>`).join('');
};

window.selectClientZone = function(id) {
    const c = state.clients[id];
    if (!c) return;
    _zoneClient = { id, ...c };
    document.getElementById('zone-client-name').textContent    = c.name;
    document.getElementById('zone-client-current').textContent = `Zona actual: ${c.zone || 'Sin zona'}`;
    document.getElementById('zone-value').value                = c.zone || '';
    document.getElementById('zone-form').classList.remove('hidden');
    document.getElementById('zone-results').innerHTML          = '';
    document.getElementById('zone-search').value               = c.name;
    document.getElementById('zone-status').classList.add('hidden');
};

window.saveClientZone = async function() {
    if (!_zoneClient) return;
    const newZone = document.getElementById('zone-value')?.value.trim();
    const statusEl = document.getElementById('zone-status');
    if (!newZone) { alert('Escribe una zona'); return; }

    try {
        const url = CFG.proxy + encodeURIComponent(`${CFG.base}/clients/${_zoneClient.id}`);
        const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Authorization': CFG.token, 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ client: { zone_name: newZone } })
        });
        if (res.ok) {
            state.clients[_zoneClient.id].zone = newZone;
            statusEl.textContent = `✅ Zona actualizada a "${newZone}"`;
            statusEl.className   = 'text-xs font-bold text-green-700';
        } else {
            statusEl.textContent = `❌ Error ${res.status}`;
            statusEl.className   = 'text-xs font-bold text-red-700';
        }
    } catch(e) {
        statusEl.textContent = `❌ ${e.message}`;
        statusEl.className   = 'text-xs font-bold text-red-700';
    }
    statusEl.classList.remove('hidden');
};

window.logout = function() {
    document.getElementById('logout-modal')?.classList.remove('hidden');
};

// ── GESTIÓN DE USUARIOS ───────────────────────────────────────────────────
window.openNewUserModal = function() { window.openNewUser(); };
window.toggleUser = function(id, role) { window.toggleUserStatus(String(id), role); };

window.openNewUser = function() {
    const modal = document.getElementById('user-modal');
    if (!modal) return;
    document.getElementById('user-modal-title').textContent  = 'Nueva Cuenta';
    document.getElementById('u-id').value            = '';
    document.getElementById('u-original-role').value = '';
    document.getElementById('u-name').value          = '';
    document.getElementById('u-email').value         = '';
    document.getElementById('u-pass').value          = '';
    document.getElementById('u-role').value          = 'technician';
    document.getElementById('u-pass-hint').textContent = 'Mínimo 6 caracteres';
    document.getElementById('u-pass').required = true;
    modal.classList.remove('hidden');
};

window.openEditUser = function(id, role) {
    const db   = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    const list = role === 'supervisor' ? (db.supervisors || []) : (db.technicians || []);
    const user = list.find(u => String(u.id || u.email) === String(id));
    if (!user) return;
    const modal = document.getElementById('user-modal');
    if (!modal) return;
    document.getElementById('user-modal-title').textContent  = 'Editar Cuenta';
    document.getElementById('u-id').value            = id;
    document.getElementById('u-original-role').value = role;
    document.getElementById('u-name').value          = user.name || '';
    document.getElementById('u-email').value         = user.email || '';
    document.getElementById('u-pass').value          = '';
    document.getElementById('u-role').value          = role;
    document.getElementById('u-pass-hint').textContent = 'Deja vacío para no cambiar la contraseña';
    document.getElementById('u-pass').required = false;
    modal.classList.remove('hidden');
};

window.closeUserModal = function() {
    document.getElementById('user-modal')?.classList.add('hidden');
};

window.saveUser = function(event) {
    event.preventDefault();
    const id       = document.getElementById('u-id').value;
    const origRole = document.getElementById('u-original-role').value;
    const name     = document.getElementById('u-name').value.trim();
    const email    = document.getElementById('u-email').value.trim().toLowerCase();
    const pass     = document.getElementById('u-pass').value;
    const role     = document.getElementById('u-role').value;

    const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    if (!db.supervisors) db.supervisors = [];
    if (!db.technicians) db.technicians = [];

    if (id) {
        // Editar existente
        const list = origRole === 'supervisor' ? db.supervisors : db.technicians;
        const idx  = list.findIndex(u => String(u.id || u.email) === String(id));
        if (idx >= 0) {
            list[idx].name  = name;
            list[idx].email = email;
            if (pass && pass.length >= 6) list[idx].password = pass;
            // Si cambió de rol, mover
            if (role !== origRole) {
                const user = list.splice(idx, 1)[0];
                if (role === 'supervisor') {
                    user.id = `S${db.supervisors.length + 1}`;
                    db.supervisors.push(user);
                } else {
                    user.id = Math.max(0, ...db.technicians.map(t => Number(t.id) || 0)) + 1;
                    db.technicians.push(user);
                }
            }
        }
    } else {
        // Nueva cuenta — verificar email único
        const allUsers = [...db.supervisors, ...db.technicians];
        if (allUsers.find(u => u.email?.toLowerCase() === email)) {
            alert('❌ Ya existe una cuenta con ese correo'); return;
        }
        if (!pass || pass.length < 6) {
            alert('❌ La contraseña debe tener al menos 6 caracteres'); return;
        }
        const newUser = { name, email, password: pass, disabled: false };
        if (role === 'supervisor') {
            newUser.id = `S${db.supervisors.length + 1}`;
            db.supervisors.push(newUser);
        } else {
            newUser.id     = Math.max(0, ...db.technicians.map(t => Number(t.id) || 0)) + 1;
            newUser.status = 'offline';
            db.technicians.push(newUser);
        }
    }

    localStorage.setItem('Velocity_Sync_State', JSON.stringify(db));
    window.closeUserModal();
    renderTab('users');
};

window.toggleUserStatus = function(id, role) {
    const db   = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    const list = role === 'supervisor' ? (db.supervisors || []) : (db.technicians || []);
    const user = list.find(u => String(u.id || u.email) === String(id));
    if (!user) return;
    user.disabled = !user.disabled;
    localStorage.setItem('Velocity_Sync_State', JSON.stringify(db));
    renderTab('users');
};

window.togglePassVis = function(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    const icon = input.parentElement?.querySelector('.material-symbols-outlined');
    if (icon) icon.textContent = input.type === 'password' ? 'visibility' : 'visibility_off';
};

// ── AUTO SYNC TÉCNICOS DESDE WISPRO ─────────────────────────────────────────
window.autoSyncTechs = async function() {
    if(!confirm('¿Importar automáticamente los técnicos activos desde Wispro? Esto generará cuentas provisionales para quienes no tengan una.')) return;
    try {
        const btn = event.currentTarget;
        const origIcon = btn.innerHTML;
        btn.innerHTML = `<span class="material-symbols-outlined text-sm animate-spin">sync</span> Importando...`;
        
        await loadStaticData(true); // force fetch
        
        const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
        if(!db.technicians) db.technicians = [];
        
        let addedCount = 0;
        
        Object.entries(state.techs).forEach(([id, name]) => {
            // Verificar si ya existe por ID o por nombre
            const exists = db.technicians.find(t => t.wisproId === id || t.name.toLowerCase() === name.toLowerCase());
            if(!exists) {
                // Crear correo mock basado en el nombre (ej. juan.perez@velocity.local)
                const sanitized = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
                db.technicians.push({
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    name: name,
                    email: `${sanitized}@velocity.local`,
                    password: 'Velocity2024',
                    disabled: false,
                    wisproId: id
                });
                addedCount++;
            }
        });
        
        localStorage.setItem('Velocity_Sync_State', JSON.stringify(db));
        renderTab('users');
        
        alert(`Sincronización completada. Se importaron ${addedCount} técnicos nuevos. Contraseña por defecto: Velocity2024`);
        btn.innerHTML = origIcon;
    } catch(e) {
        console.error('Error sincronizando técnicos:', e);
        alert('Hubo un error al intentar sincronizar los técnicos.');
    }
};

// ── INIT ──────────────────────────────────────────────────────────────────
async function initApp() {
    // Verificar auth
    const role = sessionStorage.getItem('Velocity_Role');
    if (role !== 'supervisor') { window.location.href = 'login.html'; return; }

    // Mostrar loading
    const content = document.getElementById('main-content');
    if (content) content.innerHTML = `
        <div class="h-64 flex flex-col items-center justify-center gap-3">
            <span class="material-symbols-outlined text-secondary text-5xl animate-spin-slow" style="font-variation-settings:'FILL' 1;">sync</span>
            <p class="text-on-surface font-bold text-sm tracking-widest uppercase">Conectando con Wispro...</p>
        </div>`;

    // Cargar NAP overrides del cache
    const ordCache = cacheGet('orders');
    if (ordCache?.napOverrides) state.napOverrides = ordCache.napOverrides;

    loadTrackedNaps(); // Cargar estado de NAPs manuales

    try {
        // Carga paralela: datos estáticos + órdenes del día + issues
        await Promise.all([
            loadStaticData(),
            loadTodayOrders(),
            loadIssues()
        ]);
        state.lastSync = Date.now();
    } catch(e) {
        console.error('Error en carga inicial:', e);
    }

    // Aplicar tema
    const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    const theme = db.settings?.visualMode || 'kinetic';
    document.documentElement.className = theme;

    // Renderizar pestaña guardada
    switchTab(state.tab);

    // Iniciar polling
    startPolling();
}

window.addEventListener('DOMContentLoaded', initApp);
