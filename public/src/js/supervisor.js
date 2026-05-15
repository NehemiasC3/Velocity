/**
 * VELOCITY — Panel de Supervisor
 * Arquitectura limpia con cache inteligente y polling ligero
 * Versión: 2.0.0-PRO (Updated Node Proxy)
 */
console.log('🚀 Velocity Supervisor v2.0.0-PRO cargado correctamente');

// ── CONFIGURACIÓN ─────────────────────────────────────────────────────────
// Cargar configuración desde config.js







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

window.setOrderSearch = function(val) {
    state.orderSearch = val;
    // No redibujar todo instantáneo, usamos debounce
    debouncedSearch();
};

const debouncedSearch = debounce(() => {
    if (state.tab === 'orders') renderTab('orders');
}, 300);

window.setOrderSort = function(key) {
    if (state.orderSort.key === key) {
        state.orderSort.dev = state.orderSort.dev === 'asc' ? 'desc' : 'asc';
    } else {
        state.orderSort.key = key;
        state.orderSort.dev = 'desc';
    }
    renderTab('orders');
};

// ── GESTIÓN DE ZONAS EXPRESS ──────────────────────────────────────────────
window.showZonePicker = function(clientId, currentZone) {
    if (!clientId) { alert("No se puede identificar el ID del cliente para asignar zona."); return; }
    
    // Remover picker anterior si existe
    const old = document.getElementById('zone-picker-overlay');
    if (old) old.remove();

    const zones = ['Metetí', 'Santa Fe', 'Yaviza', 'Tortí', 'Chepo', 'Panamá'];
    const options = zones.map(z => `
        <button onclick="window.confirmZoneUpdate('${clientId}', '${z}')" 
            class="w-full text-left p-4 hover:bg-surface-container-high transition-all font-black text-sm text-on-surface border-b border-outline-variant/10 last:border-0">
            ${z}
            ${currentZone === z ? '<span class="material-symbols-outlined text-success float-right" style="font-size:18px;">check_circle</span>' : ''}
        </button>
    `).join('');

    const html = `
    <div id="zone-picker-overlay" onclick="this.remove()" class="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center animate-fade-in">
        <div onclick="event.stopPropagation()" class="bg-surface-container-lowest w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden border border-outline-variant/20 animate-scale-up">
            <div class="kinetic-gradient p-6 text-white">
                <h3 class="font-black text-lg tracking-tight">Asignar Zona</h3>
                <p class="text-[10px] font-black uppercase opacity-60 tracking-[0.2em] mt-1">Sincronización directa con Wispro</p>
            </div>
            <div class="max-h-[60vh] overflow-y-auto">
                ${options}
                <button onclick="const z = prompt('Ingresa el nombre de la zona:','${currentZone||''}'); if(z) window.confirmZoneUpdate('${clientId}', z)" 
                    class="w-full text-left p-4 hover:bg-primary/10 transition-all font-black text-sm text-primary">
                    <span class="material-symbols-outlined align-middle mr-2" style="font-size:18px;">add_circle</span> Personalizada...
                </button>
            </div>
            <div class="p-3 bg-surface-container-low flex justify-end">
                <button onclick="document.getElementById('zone-picker-overlay').remove()" class="px-6 py-2 rounded-2xl text-[10px] font-black uppercase text-on-surface-variant hover:bg-surface-container-high transition-all">Cancelar</button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
};

window.confirmZoneUpdate = async function(clientId, zoneName) {
    const overlay = document.getElementById('zone-picker-overlay');
    if (overlay) overlay.remove();

    try {
        // 1. Notificar en UI (Show a small loader or toast if we had one)
        console.log(`Actualizando zona para ${clientId} a ${zoneName}...`);
        
        // 2. WiSPRO API PUT
        const res = await apiFetch(`/clients/${clientId}`, {
            method: 'PUT',
            body: JSON.stringify({ client: { zone_name: zoneName } })
        });

        if (res) {
            // 3. Actualizar Estado Local
            if (state.clients[clientId]) {
                state.clients[clientId].zone = zoneName;
            }
            
            // Actualizar órdenes en memoria para no esperar al polling
            state.orders.forEach(o => { if (o.clientId === clientId) o.zone = zoneName; });
            state.finishedOrders.forEach(o => { if (o.clientId === clientId) o.zone = zoneName; });
            
            // 4. Salvar en Caché estática
            cacheSet('static', {
                clients:    state.clients,
                techs:      state.techs,
                categories: state.categories
            }, CFG.cacheTTL.static);

            // 5. Re-renderizar vista actual
            renderTab(state.tab);
            
            // Notificación ligera (consola por ahora)
            console.log("¡Wispro actualizado exitosamente!");
        }
    } catch (e) {
        console.error("Error al actualizar zona en Wispro:", e);
        alert("Error al actualizar Wispro: " + e.message);
    }
};

window.runMonthlyAudit = function() {
    const month = parseInt(document.getElementById('audit-month').value);
    const year  = parseInt(document.getElementById('audit-year').value);
    fetchMonthlyIssues(month, year);
};

function startPolling() {
    stopPolling();
    // Ticker para tiempos relativos y SLA (cada 30 seg)
    setInterval(() => {
        if (state.tab === 'orders') renderTab('orders');
    }, 30000);

    state.pollTimer = setInterval(async () => {
        if (document.visibilityState !== 'visible') return;
        await loadTodayOrders(true);
        state.lastSync = Date.now();
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

;

;

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
        <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            ${techCards}
        </div>
    </div>`;
};

// ── ÓRDENES ───────────────────────────────────────────────────────────────
Views.orders = () => {
    const { type, tech, zone } = state.orderFilter;
    
    const todayStr = new Date().toLocaleDateString('en-CA');
    const fToday = state.finishedOrders.filter(o => o.endDay === todayStr);

    // 1. Filtrar Activas
    let filteredActive = type === 'no_nap'
        ? state.orders.filter(o => (o.kind === 'technical' || o.kind === 'installation') && !o.nap)
        : type === 'all' ? [...state.orders] : state.orders.filter(o => o.kind === type);

    if (tech !== 'all') filteredActive = filteredActive.filter(o => o.techName?.toLowerCase().includes(tech.split(' ')[0].toLowerCase()));
    if (zone !== 'all') filteredActive = filteredActive.filter(o => o.zone === zone);

    // 2. Filtrar Finalizadas (Mismos criterios)
    let filteredFinished = type === 'no_nap'
        ? fToday.filter(o => (o.kind === 'technical' || o.kind === 'installation') && !o.nap)
        : type === 'all' ? [...fToday] : fToday.filter(o => o.kind === type);

    if (tech !== 'all') filteredFinished = filteredFinished.filter(o => o.techName?.toLowerCase().includes(tech.split(' ')[0].toLowerCase()));
    if (zone !== 'all') filteredFinished = filteredFinished.filter(o => o.zone === zone);

    // Recopilar técnicos y zonas para filtros dinámicos (de ambas listas)
    const baseForFilters = [...state.orders, ...fToday];
    const techs = [...new Set(baseForFilters.map(o => o.techName).filter(isActiveTech))].sort();
    const zones = [...new Set(baseForFilters.map(o => o.zone).filter(Boolean))].sort();

    // 3. Aplicar Búsqueda Global
    const search = state.orderSearch.toLowerCase().trim();
    if (search) {
        const filterFn = o => 
            o.client.toLowerCase().includes(search) || 
            String(o.id).includes(search) || 
            o.address.toLowerCase().includes(search) || 
            o.techName.toLowerCase().includes(search);
            
        filteredActive = filteredActive.filter(filterFn);
        filteredFinished = filteredFinished.filter(filterFn);
    }

    // 4. Aplicar Ordenamiento Dinámico
    const sortKey = state.orderSort.key;
    const sortDev = state.orderSort.dev;
    const sortFn = (a, b) => {
        let vA = a[sortKey];
        let vB = b[sortKey];
        if (typeof vA === 'string') vA = vA.toLowerCase();
        if (typeof vB === 'string') vB = vB.toLowerCase();
        if (vA < vB) return sortDev === 'asc' ? -1 : 1;
        if (vA > vB) return sortDev === 'asc' ? 1 : -1;
        return 0;
    };
    filteredActive.sort(sortFn);
    filteredFinished.sort(sortFn);

    // KPI Calculations
    const totalDay = state.orders.length + fToday.length;
    const completionRate = totalDay > 0 ? Math.round((fToday.length / totalDay) * 100) : 0;
    const criticalNoNap = state.orders.filter(o => (o.kind === 'technical' || o.kind === 'installation') && !o.nap).length;
    
    // Time computation (Solo exitosas con tiempos válidos)
    const timed = fToday.filter(o => o.rawStart && o.rawEnd && o.result === 'success');
    const avgMs = timed.length > 0 ? timed.reduce((a, b) => a + (b.rawEnd - b.rawStart), 0) / timed.length : 0;
    const avgMin = Math.round(avgMs / 60000);

    // Tech Workload Logic
    const techStats = techs.map(name => {
        const tOrders = [...state.orders, ...fToday].filter(o => o.techName === name);
        const tDone = tOrders.filter(o => ['finalizada','finalizado','closed'].includes(o.state.toLowerCase())).length;
        const tPending = tOrders.length - tDone;
        return { name, done: tDone, pending: tPending, total: tOrders.length };
    }).sort((a,b) => b.total - a.total);

    // Tabs / Pills Logic
    const counts = {
        all:          state.orders.length,
        technical:    state.orders.filter(o => o.kind === 'technical').length,
        installation: state.orders.filter(o => o.kind === 'installation').length,
        feasibility:  state.orders.filter(o => o.kind === 'feasibility').length,
        resignation:  state.orders.filter(o => o.kind === 'resignation').length,
        no_nap:       state.orders.filter(o => (o.kind === 'technical' || o.kind === 'installation') && !o.nap).length,
        finished:     fToday.length
    };

    const tabs = [
        { id: 'all',          label: `Todas (${counts.all})` },
        { id: 'technical',    label: `Visita Técnica (${counts.technical})` },
        { id: 'installation', label: `Instalación (${counts.installation})` },
        { id: 'feasibility',  label: `Factibilidad (${counts.feasibility})` },
        { id: 'resignation',  label: `Baja (${counts.resignation})` },
        { id: 'no_nap',       label: `Sin NAP (${counts.no_nap})`, alert: true }
    ];

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
        return `<button onclick="window.setOrderFilter('tech','${n}')" style="${active ? `background:${color};color:white;` : 'background:#f3f4f6;color:#374151;'}padding:6px 12px;border-radius:999px;font-size:15px;font-weight:700;border:none;cursor:pointer;">${first}</button>`;
    }).join('');

    const zonePills = zones.map(z => {
        const active = zone === z;
        return `<button onclick="window.setOrderFilter('zone','${z}')" style="${active ? 'background:#111827;color:white;' : 'background:#f3f4f6;color:#374151;'}padding:6px 12px;border-radius:999px;font-size:15px;font-weight:700;border:none;cursor:pointer;">${z}</button>`;
    }).join('');

    const renderTable = (collection, emptyMsg, extraClass = '') => {
        if (!collection.length) return `<div class="p-12 text-center text-on-surface-variant/40 bg-surface-container/20 rounded-2xl border border-dashed border-outline-variant/30"><span class="material-symbols-outlined text-4xl mb-2">inbox</span><p class="font-bold text-sm uppercase">${emptyMsg}</p></div>`;
        
        const rows = collection.map(o => {
            const color    = o.typeColor;
            const tColor   = techColor(o.techName);
            const initials = techInitials(o.techName);
            const napBadge = (o.kind === 'technical' || o.kind === 'installation')
                ? (o.nap
                    ? `<span style="background:#f0fdf4;color:#059669;font-size:14px;font-weight:700;padding:3px 9px;border-radius:999px;">✓ ${o.nap}</span>`
                    : `<button onclick="window.openNapModal('${o.id}')" style="background:#fee2e2;color:#dc2626;font-size:14px;font-weight:700;padding:3px 9px;border-radius:999px;border:none;cursor:pointer;">Sin NAP</button>`)
                : '';

            return `
            <tr class="border-b border-surface-container-high/50 hover:bg-surface-container-low/30 transition-colors">
                <td class="p-4">
                    <div class="flex items-start gap-3">
                        <div class="w-1 h-8 rounded-full flex-shrink-0" style="background:${color}"></div>
                        <div class="min-w-0">
                            <div class="flex items-center gap-2 mb-0.5">
                                <span class="font-black text-on-surface text-sm">#${o.id}</span>
                                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:${color}15;color:${color}">${o.typeLabel}</span>
                            </div>
                            <p class="font-bold text-on-surface text-sm truncate">${o.client}</p>
                        </div>
                    </div>
                </td>
                <td class="p-4 hidden lg:table-cell">
                    <p class="text-[13px] text-on-surface-variant truncate max-w-[180px] mb-1.5">${o.address || '—'}</p>
                    <button onclick="window.showZonePicker('${o.clientId}', '${o.zone}')" 
                        class="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border
                        ${o.zone ? 'bg-secondary/10 text-secondary border-secondary/20 hover:bg-secondary hover:text-white' : 'bg-error/10 text-error border-error/20 animate-pulse hover:bg-error hover:text-white'}">
                        ${o.zone || 'Sin asignar'}
                    </button>
                </td>
                <td class="p-4">
                    <div class="flex items-center gap-2">
                        <div class="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-black" style="background:${tColor}">${initials}</div>
                        <span class="text-xs font-bold text-on-surface-variant">${o.techName.split(' ')[0]}</span>
                    </div>
                </td>
                <td class="p-4 whitespace-nowrap">
                    <span class="text-xs font-bold text-on-surface">${o.startTime}</span>
                    <span class="text-[10px] text-on-surface-variant opacity-60"> → ${o.endTime}</span>
                </td>
                <td class="p-4">
                    ${o.trackData && o.trackData.status === 'started'
                        ? (() => {
                            const diffMin = Math.floor((Date.now() - o.trackData.startTime)/60000);
                            const isDelayed = diffMin > 90;
                            return `<div class="flex flex-col gap-1 items-start">
                                <span class="inline-flex items-center gap-1.5 ${isDelayed ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'} px-3 py-1 rounded-full text-[11px] font-black border ${isDelayed ? 'border-amber-500/20' : 'border-emerald-500/20'} animate-pulse">
                                    <span class="material-symbols-outlined text-sm">${isDelayed ? 'warning' : 'timer'}</span> ${diffMin}m
                                </span>
                                ${isDelayed ? `<span class="text-[9px] font-black text-amber-600 uppercase tracking-tighter ml-1">Excede SLA</span>` : ''}
                            </div>`;
                          })()
                        : `<div class="flex items-center gap-2">
                                ${statusBadge(o.state)}
                            </div>`}
                </td>
                <td class="p-4">${napBadge}</td>
                <td class="p-4">
                    <div class="relative inline-block group">
                        <button onclick="window.openFeedbackModal('${o.id}')" class="w-10 h-10 flex items-center justify-center hover:bg-secondary/10 text-secondary rounded-xl border border-secondary/10 transition-all active:scale-95 shadow-sm" title="Bitácora Técnica">
                            <span class="material-symbols-outlined text-[22px]">history_edu</span>
                        </button>
                        ${o.feedbacksCount > 0 ? `
                            <div class="absolute -top-2 -right-2 bg-secondary text-white text-[10px] font-black px-1.5 py-0.5 rounded-full border-2 border-surface-container-lowest shadow-md min-w-[18px] text-center animate-in zoom-in duration-300">
                                ${o.feedbacksCount}
                            </div>
                        ` : ''}
                    </div>
                </td>
            </tr>`;
        }).join('');

        const sortIcon = (key) => {
            if (state.orderSort.key !== key) return `<span class="material-symbols-outlined text-[14px] opacity-10 group-hover:opacity-40 transition-opacity">unfold_more</span>`;
            return `<span class="material-symbols-outlined text-[14px] text-secondary">${state.orderSort.dev === 'asc' ? 'expand_less' : 'expand_more'}</span>`;
        };

        return `
        <div class="bg-surface-container-lowest border border-outline-variant/15 rounded-3xl overflow-hidden ${extraClass}">
            <table class="w-full border-collapse">
                <thead>
                    <tr class="bg-surface-container-low/50 text-left border-b border-outline-variant/10">
                        <th onclick="window.setOrderSort('client')" class="p-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest cursor-pointer group hover:bg-surface-container-high/40 transition-colors">
                            <div class="flex items-center gap-1">Cliente / ID ${sortIcon('client')}</div>
                        </th>
                        <th class="p-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest hidden lg:table-cell">Dirección</th>
                        <th onclick="window.setOrderSort('techName')" class="p-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest cursor-pointer group hover:bg-surface-container-high/40 transition-colors">
                            <div class="flex items-center gap-1">Técnico ${sortIcon('techName')}</div>
                        </th>
                        <th onclick="window.setOrderSort('startTime')" class="p-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest cursor-pointer group hover:bg-surface-container-high/40 transition-colors">
                            <div class="flex items-center gap-1">Horario ${sortIcon('startTime')}</div>
                        </th>
                        <th class="p-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Estado</th>
                        <th class="p-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest text-center">NAP</th>
                        <th class="p-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Reporte</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-surface-container-high/30">${rows}</tbody>
            </table>
        </div>`;
    };

    return `
    <div class="space-y-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="space-y-1">
                <h2 class="text-2xl font-black text-on-surface tracking-tight">Órdenes del Día</h2>
                <div class="flex items-center gap-2">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span class="text-[10px] font-black text-on-surface-variant/60 uppercase tracking-widest">Sincronizado: ${getRelativeTime(state.lastSync)}</span>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <button onclick="window.exportOrdersToCSV()" class="flex items-center gap-2 border border-outline-variant/30 text-on-surface-variant px-4 py-2 rounded-2xl text-xs font-bold hover:bg-surface-container transition-all active:scale-95">
                    <span class="material-symbols-outlined text-[18px]">download</span> Exportar
                </button>
                <button onclick="window.syncNow()" class="flex items-center gap-2 border border-outline-variant/30 text-secondary px-4 py-2 rounded-2xl text-xs font-bold hover:bg-surface-container transition-all active:scale-95">
                    <span class="material-symbols-outlined text-[18px] ${state.isSyncing ? 'animate-spin' : ''}">sync</span> Sincronizar
                </button>
            </div>
        </div>

        <!-- KPI Professional Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-surface-container-lowest border border-outline-variant/20 p-5 rounded-3xl flex items-center gap-4">
                <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shadow-inner">
                    <span class="material-symbols-outlined text-2xl font-bold">query_stats</span>
                </div>
                <div>
                    <p class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Efectividad Global</p>
                    <h4 class="text-2xl font-black text-emerald-600">${completionRate}%</h4>
                    <p class="text-[10px] text-on-surface-variant/60 font-bold">${fToday.length} de ${totalDay} completadas</p>
                </div>
            </div>
            <div class="bg-surface-container-lowest border border-outline-variant/20 p-5 rounded-3xl flex items-center gap-4">
                <div class="w-12 h-12 rounded-2xl bg-error/10 text-error flex items-center justify-center shadow-inner">
                    <span class="material-symbols-outlined text-2xl font-bold">report</span>
                </div>
                <div>
                    <p class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Órdenes Críticas</p>
                    <h4 class="text-2xl font-black text-error">${criticalNoNap}</h4>
                    <p class="text-[10px] text-on-surface-variant/60 font-bold">Requieren asignación de NAP</p>
                </div>
            </div>
            <div class="bg-surface-container-lowest border border-outline-variant/20 p-5 rounded-3xl flex items-center gap-4">
                <div class="w-12 h-12 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center shadow-inner">
                    <span class="material-symbols-outlined text-2xl font-bold">avg_time</span>
                </div>
                <div>
                    <p class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Tiempo Promedio</p>
                    <h4 class="text-2xl font-black text-secondary">${avgMin || 0} min</h4>
                    <p class="text-[10px] text-on-surface-variant/60 font-bold">Basado en visitas exitosas</p>
                </div>
            </div>
        </div>

        <div class="relative group">
            <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-secondary transition-colors">search</span>
            <input type="text" 
                id="global-search-input"
                placeholder="Buscar por cliente, ID, dirección o técnico..." 
                value="${state.orderSearch}"
                oninput="window.setOrderSearch(this.value)"
                class="w-full bg-surface-container-lowest border border-outline-variant/20 focus:border-secondary focus:ring-4 focus:ring-secondary/5 rounded-[2rem] pl-12 pr-6 py-4 text-sm font-medium outline-none transition-all shadow-sm placeholder:text-on-surface-variant/30"
            >
            ${state.orderSearch ? `
                <button onclick="window.setOrderSearch('');renderTab('orders')" class="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant/60">
                    <span class="material-symbols-outlined text-base">close</span>
                </button>
            ` : ''}
        </div>

        <!-- Filtros Principales (Tabs) -->
        <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-1">${tabsHtml}</div>

        <!-- Filtros Secundarios (Pills) -->
        <div class="flex flex-col gap-4">
            ${techs.length > 0 ? `
            <div class="flex flex-wrap items-center gap-2">
                <span class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mr-2">Técnico:</span>
                <button onclick="window.setOrderFilter('tech','all')" class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${tech==='all'?'bg-secondary text-white':'bg-surface-container text-on-surface-variant'}">Todos</button>
                ${techPills}
            </div>` : ''}
            ${zones.length > 0 ? `
            <div class="flex flex-wrap items-center gap-2">
                <span class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mr-2">Zona:</span>
                <button onclick="window.setOrderFilter('zone','all')" class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${zone==='all'?'bg-primary text-white':'bg-surface-container text-on-surface-variant'}">Todas</button>
                ${zonePills}
            </div>` : ''}
        </div>

        <!-- Sección de Órdenes Activas -->
        <div class="space-y-3">
            <div class="flex items-center gap-3 px-2">
                <div class="h-px flex-1 bg-outline-variant/20"></div>
                <div class="bg-secondary/10 border border-secondary/30 text-secondary px-4 py-2 rounded-2xl flex items-center gap-2 shadow-sm">
                    <span class="material-symbols-outlined text-lg">timer</span>
                    <span class="text-xs font-black uppercase tracking-widest">En Curso / Pendientes (${filteredActive.length})</span>
                </div>
                <div class="h-px flex-1 bg-outline-variant/20"></div>
            </div>
            ${renderTable(filteredActive, 'No hay órdenes pendientes')}
        </div>

        <!-- SEPARADOR / SECCIÓN FINALIZADAS -->
        ${filteredFinished.length > 0 ? `
        <div class="space-y-3 pt-6">
            <div class="flex items-center gap-3 px-2">
                <div class="h-px flex-1 bg-outline-variant/20"></div>
                <div class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 px-4 py-2 rounded-2xl flex items-center gap-2 shadow-sm">
                    <span class="material-symbols-outlined text-lg">check_circle</span>
                    <span class="text-xs font-black uppercase tracking-widest">Finalizadas (${filteredFinished.length})</span>
                </div>
                <div class="h-px flex-1 bg-outline-variant/20"></div>
            </div>
            ${renderTable(filteredFinished, '', 'opacity-70 grayscale-[30%]')}
        </div>` : ''}

        <!-- Distribución Operativa Profesional -->
        <div class="pt-10 space-y-6">
            <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-secondary">analytics</span>
                <h3 class="text-sm font-black text-on-surface uppercase tracking-widest">Balance de Carga y Rendimiento</h3>
                <div class="h-px flex-1 bg-outline-variant/10"></div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Columna: Barras de Carga -->
                <div class="bg-surface-container-low/30 border border-outline-variant/10 rounded-[2rem] p-8 space-y-6">
                    <div class="space-y-4">
                        ${techStats.slice(0, 6).map(t => {
                            const pct = t.total > 0 ? Math.round((t.done/t.total)*100) : 0;
                            const color = techColor(t.name);
                            return `
                            <div class="space-y-2">
                                <div class="flex justify-between items-end">
                                    <div class="flex items-center gap-2">
                                        <div class="w-2.5 h-2.5 rounded-full" style="background:${color}"></div>
                                        <span class="text-xs font-black text-on-surface">${t.name}</span>
                                    </div>
                                    <span class="text-[10px] font-black text-on-surface-variant">${t.done} <span class="opacity-40">/ ${t.total}</span> <span class="ml-2 text-secondary">${pct}%</span></span>
                                </div>
                                <div class="h-3 bg-white/50 dark:bg-black/10 rounded-full overflow-hidden flex shadow-inner">
                                    <div class="h-full kinetic-gradient transition-all duration-1000" style="width:${pct}%"></div>
                                    ${t.pending > 0 ? `<div class="h-full bg-amber-500/20 animate-pulse transition-all duration-1000" style="width:${100-pct}%"></div>` : ''}
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>

                <!-- Columna: Resumen Ejecutivo -->
                <div class="bg-surface-container-low/30 border border-outline-variant/10 rounded-[2rem] p-8 flex flex-col justify-between">
                    <div class="space-y-4">
                        <div class="w-14 h-14 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center shadow-inner mb-6">
                            <span class="material-symbols-outlined text-3xl font-bold">query_stats</span>
                        </div>
                        <h4 class="text-xl font-black text-on-surface tracking-tight leading-tight">Análisis Operativo del Día</h4>
                        <p class="text-sm text-on-surface-variant leading-relaxed">
                            Hoy se han gestionado <span class="font-black text-on-surface">${totalDay} órdenes</span> en total. 
                            El equipo mantiene una efectividad del <span class="font-black text-emerald-600">${completionRate}%</span> 
                            con un tiempo de resolución promedio de <span class="font-black text-secondary">${avgMin} minutos</span>.
                        </p>
                    </div>
                    
                    <div class="pt-8 flex flex-col gap-4">
                        <button onclick="window.openFieldMap()" class="w-full kinetic-gradient py-4 rounded-2xl text-white font-bold text-sm tracking-wide shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3">
                            <span class="material-symbols-outlined">map</span>
                            Ver Mapa de Operaciones
                        </button>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div class="bg-white/40 p-4 rounded-3xl border border-white/20">
                                <p class="text-[9px] font-black text-on-surface-variant uppercase tracking-widest mb-1">Carga Activa</p>
                                <p class="text-lg font-black text-on-surface">${state.orders.length} <span class="text-[10px] opacity-40">tickets</span></p>
                            </div>
                            <div class="bg-white/40 p-4 rounded-3xl border border-white/20">
                                <p class="text-[9px] font-black text-on-surface-variant uppercase tracking-widest mb-1">Rendimiento</p>
                                <p class="text-lg font-black text-on-surface">${avgMin}<span class="text-[10px] opacity-40"> min/v</span></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
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
                    <div class="relative">
                        <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-base font-black flex-shrink-0" style="background:${color};">${initials}</div>
                        <span class="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${isTechOnline(nombre) ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-outline'}"></span>
                    </div>
                    <div>
                        <p class="font-bold text-on-surface text-base">${nombre}</p>
                        <div class="flex items-center gap-2 mt-0.5">
                            <p class="text-[10px] text-on-surface-variant font-medium">${myOrders.length} órdenes · ${pending} pendientes</p>
                            ${myOrders.find(o => o.state === 'in_course') ? `<span class="bg-amber-100 text-amber-700 text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1 animate-pulse"><span class="material-symbols-outlined text-[12px]">timer</span> EN CURSO</span>` : ''}
                        </div>
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
        
        <!-- Mapa de Técnicos -->
        <div id="techs-map" style="width: 100%; height: 400px; border-radius: 16px; margin-bottom: 24px; z-index: 1; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);"></div>

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

// Map Initialization for Technicians
let techsMapInstance = null;
window.initTechsMap = function() {
    const mapEl = document.getElementById('techs-map');
    if (!mapEl) return;
    
    if (techsMapInstance) {
        techsMapInstance.remove();
        techsMapInstance = null;
    }

    techsMapInstance = L.map('techs-map').setView([8.9833, -79.5167], 8);
    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps'
    }).addTo(techsMapInstance);

    const bounds = [];
    
    TECNICOS_ACTIVOS.forEach(nombre => {
        const myOrders = state.orders.filter(o => o.techName?.toLowerCase().includes(nombre.split(' ')[0].toLowerCase()));
        if (myOrders.length === 0) return;
        
        // Determinar ubicación: Si está 'in_course', usar esa. Si no, usar la próxima 'pending'.
        let activeOrder = myOrders.find(o => o.state === 'in_course');
        let statusText = "EN RUTA / OPERANDO";
        let color = "#10b981"; // Emerald green for active
        let pulseAnim = "pulse-active";
        
        if (!activeOrder) {
            activeOrder = myOrders.find(o => o.state === 'pending');
            statusText = "PRÓXIMO DESTINO";
            color = "#f59e0b"; // Amber for pending
            pulseAnim = "pulse-pending";
        }
        
        if (activeOrder && activeOrder.lat && activeOrder.lng) {
            const lat = parseFloat(activeOrder.lat);
            const lng = parseFloat(activeOrder.lng);
            bounds.push([lat, lng]);
            
            const initials = techInitials(nombre);
            const techCol = techColor(nombre);
            
            const markerHtml = `
                <style>
                    @keyframes pulse-active { 0% { transform: scale(0.95); opacity: 0.6; } 50% { transform: scale(1.3); opacity: 0.2; } 100% { transform: scale(0.95); opacity: 0.6; } }
                    @keyframes pulse-pending { 0% { transform: scale(0.95); opacity: 0.4; } 50% { transform: scale(1.1); opacity: 0.1; } 100% { transform: scale(0.95); opacity: 0.4; } }
                </style>
                <div style="position:relative; width:40px; height:40px;">
                    <div style="background:${color}; width:100%; height:100%; border-radius:50%; position:absolute; top:0; left:0; opacity:0.3; animation: ${pulseAnim} 2s infinite;"></div>
                    <div style="background:${techCol}; width:30px; height:30px; border-radius:50%; border:2px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; color:white; font-weight:900; font-size:12px; position:absolute; top:5px; left:5px; z-index:2;">
                        ${initials}
                    </div>
                </div>
            `;
            
            const icon = L.divIcon({
                html: markerHtml,
                className: '',
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });

            L.marker([lat, lng], { icon }).addTo(techsMapInstance)
                .bindPopup(`
                    <div style="text-align:center;padding:4px;">
                        <strong style="font-size:15px;color:#111827;">${nombre}</strong><br>
                        <span style="font-size:10px; font-weight:900; letter-spacing: 0.5px; color:${color}; padding:3px 8px; background:${color}15; border-radius:6px; margin-top:6px; display:inline-block; border: 1px solid ${color}30;">${statusText}</span><br>
                        <div style="margin-top:10px; font-size:12px; color:#4b5563; background:#f9fafb; padding:8px; border-radius:8px; border: 1px solid #f3f4f6; text-align:left;">
                            <span style="font-weight:700; color:#1f2937;">Cliente:</span> ${activeOrder.client}<br>
                            <span style="font-weight:700; color:#1f2937; margin-top:4px; display:inline-block;">Tarea:</span> ${activeOrder.typeLabel}
                        </div>
                    </div>
                `);
        }
    });

    if (bounds.length > 0) {
        techsMapInstance.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
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
            if (date === 'sin_fecha') return false;
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
            return `<div style="display:flex;align-items:flex-start;gap:8px;padding:7px;border-radius:8px;background:#f9fafb;margin-bottom:4px;border:1px solid #f3f4f6;">
                <div style="width:3px;height:35px;background:#f97316;border-radius:2px;flex-shrink:0;margin-top:2px;"></div>
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
                        <span style="font-weight:800;color:#111827;font-size:13px;">#${issue.public_id||'—'}</span>
                        ${category?`<span style="background:#f3f4f6;color:#374151;font-size:11px;font-weight:600;padding:1px 6px;border-radius:999px;">${category}</span>`:''}
                        <span style="font-weight:700;color:${vencCol};font-size:12px;margin-left:auto;">${vencText}</span>
                    </div>
                    <p style="font-size:13px;color:#0059bb;font-weight:500;margin:2px 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${client.name||cleanT}</p>
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:2px;">
                        ${zoneName?`<span style="font-size:11px;color:#6b7280;">${zoneName}</span>`: '<span></span>'}
                        <button onclick="window.openFeedbackModal('${issue.id}', true)" class="w-7 h-7 flex items-center justify-center text-secondary hover:bg-secondary/10 rounded-lg transition-all" title="Ver Bitácora">
                            <span class="material-symbols-outlined text-[18px]">history_edu</span>
                        </button>
                    </div>
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
    globalLines.push('— Velocity Rappido Panama');

    window.exportToCSV = function() {
        const finished = state.orders.filter(o => o.state === 'finalized');
        if (finished.length === 0) {
            showNotification('Exportación', 'No hay órdenes finalizadas para exportar.', 'issue');
            return;
        }

        const headers = ['ID', 'Cliente', 'Tecnico', 'Tipo', 'Inicio', 'Fin', 'Caja NAP', 'Marquilla', 'Resultado', 'Coordenadas'];
        const csvContent = [
            headers.join(','),
            ...finished.map(o => [
                `#${o.id}`,
                `"${o.client.replace(/"/g, '""')}"`,
                `"${o.techName}"`,
                `"${o.typeLabel}"`,
                o.startTime,
                o.endTime,
                `"${o.nap || 'N/A'}"`,
                `"${o.marquilla || 'N/A'}"`,
                `"${o.result || 'Sin resultado'}"`,
                o.lat && o.lng ? `"${o.lat}, ${o.lng}"` : 'N/A'
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `Velocity_Report_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification('Reporte Generado', 'Excel (CSV) descargado con éxito.', 'success');
    };

    window.openFieldMap = function() {
        // Inicializar modal del mapa
        const modal = document.getElementById('map-modal');
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0', 'pointer-events-none');
            modal.querySelector('#map-modal-content').classList.remove('scale-95');
        }, 10);

        // Si el mapa ya existe en el div, no lo reinicializamos (o lo refrescamos)
        const container = document.getElementById('map-iframe').parentElement;
        container.innerHTML = '<div id="leaflet-map" style="height:100%; width:100%;"></div>';
        
        const map = L.map('leaflet-map').setView([8.983, -79.517], 12); // Panamá City
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Añadir órdenes activas con coordenadas
        state.orders.forEach(o => {
            if (o.lat && o.lng && (o.state === 'in_course' || o.state === 'pending')) {
                const markerColor = o.state === 'in_course' ? '#f97316' : '#0059bb';
                const icon = L.divIcon({
                    className: 'custom-div-icon',
                    html: `<div style="background-color:${markerColor}; width:12px; height:12px; border-radius:50%; border:2px solid white; box-shadow:0 0 5px rgba(0,0,0,0.3);"></div>`,
                    iconSize: [12, 12],
                    iconAnchor: [6, 6]
                });

                L.marker([o.lat, o.lng], {icon}).addTo(map)
                    .bindPopup(`<b>${o.client}</b><br>${o.typeLabel}<br>Técnico: ${o.techName}`);
            }
        });

        // Añadir NAPs registradas
        state.trackedNaps.forEach(n => {
            if (n.coords && n.coords.includes(',')) {
                const [lt, lg] = n.coords.split(',').map(c => parseFloat(c.trim()));
                L.marker([lt, lg], {
                    icon: L.divIcon({
                        className: 'nap-icon',
                        html: `<span class="material-symbols-outlined" style="color:#059669; font-size:18px;">hub</span>`,
                        iconSize: [20, 20]
                    })
                }).addTo(map).bindPopup(`<b>NAP: ${n.name}</b><br>${n.zone}<br>${n.comments || ''}`);
            }
        });
    };

    window.closeMapModal = function() {
        const modal = document.getElementById('map-modal');
        modal.classList.add('opacity-0', 'pointer-events-none');
        modal.querySelector('#map-modal-content').classList.add('scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
    };
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

        <!-- Generador de Auditoría Mensual -->
        <div class="mb-8 p-6 bg-surface-container-low/30 border border-outline-variant/10 rounded-[2rem] space-y-4">
            <div class="flex items-center gap-3 mb-2">
                <span class="material-symbols-outlined text-secondary">history_edu</span>
                <h3 class="text-xs font-black text-on-surface uppercase tracking-widest">Generador de Auditoría Mensual (Mesa de Ayuda)</h3>
            </div>
            
            <div class="flex flex-wrap items-center gap-4">
                <div class="flex items-center gap-2">
                    <select id="audit-month" class="bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-4 py-2 text-sm font-bold outline-none">
                        ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `<option value="${m}" ${m===(new Date().getMonth()+1)?'selected':''}>${mNames[m-1]}</option>`).join('')}
                    </select>
                    <select id="audit-year" class="bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-4 py-2 text-sm font-bold outline-none">
                        ${[2024,2025,2026].map(y => `<option value="${y}" ${y===new Date().getFullYear()?'selected':''}>${y}</option>`).join('')}
                    </select>
                </div>
                
                <button onclick="window.runMonthlyAudit()" 
                    class="kinetic-gradient text-white px-6 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 shadow-md active:scale-95 transition-all ${state.monthlyReport.isFetching ? 'opacity-50 pointer-events-none' : ''}">
                    <span class="material-symbols-outlined text-sm font-bold">${state.monthlyReport.isFetching ? 'sync' : 'search'}</span>
                    ${state.monthlyReport.isFetching ? `Descargando... ${state.monthlyReport.progress}%` : 'Cargar Reporte del Mes'}
                </button>
            </div>

            ${state.monthlyReport.results ? (() => {
                const r = state.monthlyReport.results;
                return `
                <div class="mt-6 pt-6 border-t border-outline-variant/10 animate-fade-in">
                    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div>
                            <p class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Resultados Auditoría</p>
                            <h4 class="text-xl font-black text-on-surface">${mNames[r.month-1]} ${r.year} · <span class="text-secondary">${r.stats.total} Tickets</span></h4>
                        </div>
                        <div class="flex items-center gap-3">
                            <button onclick="window.exportMonthlyCSV()" class="flex items-center gap-2 border border-outline-variant/30 text-on-surface-variant px-4 py-2 rounded-2xl text-xs font-bold hover:bg-surface-container transition-all active:scale-95">
                                <span class="material-symbols-outlined text-[18px]">download</span> CSV
                            </button>
                            <button onclick="window.generateMonthlyPDF()" class="flex items-center gap-2 bg-on-surface text-white px-4 py-2 rounded-2xl text-xs font-black hover:opacity-90 transition-all active:scale-95 shadow-md">
                                <span class="material-symbols-outlined text-[18px]">print</span> Generar Informe PDF
                            </button>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        ${Object.entries(r.stats.byCategory).sort((a,b)=>b[1]-a[1]).map(([cat, count]) => {
                            const pct = Math.round((count / r.stats.total) * 100);
                            return `
                            <div class="bg-surface-container-lowest/40 border border-outline-variant/5 p-4 rounded-2xl">
                                <div class="flex justify-between items-center mb-1.5">
                                    <span class="text-xs font-black text-on-surface truncate pr-2">${cat}</span>
                                    <span class="text-xs font-black text-secondary">${count} <span class="text-[9px] opacity-40 font-bold ml-1">(${pct}%)</span></span>
                                </div>
                                <div class="h-2 bg-surface-container rounded-full overflow-hidden">
                                    <div class="h-full kinetic-gradient" style="width:${pct}%"></div>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>`;
            })() : ''}
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
                    return `
                    <div style="display:flex;align-items:center;padding:10px 0;border-bottom:1px solid #f3f4f6;gap:12px;">
                        <div style="background:#f3f4f6;color:#9ca3af;font-size:11px;font-weight:800;padding:2px 8px;border-radius:6px;min-width:45px;text-align:center;">#${i.public_id}</div>
                        <div style="flex:1;min-width:0;">
                            <p style="font-size:13px;font-weight:700;color:#374151;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${(state.clients[i.client_id]?.name || i.title || 'Reporte').slice(0, 30)}</p>
                            <p style="font-size:11px;color:#9ca3af;margin:0;">Finalizado por ${tName.split(' ')[0]} a las ${formatTime(i.closed_at || i.finalized_at || i.updated_at)}</p>
                        </div>
                        <button onclick="window.openFeedbackModal('${i.id}', true)" class="w-8 h-8 flex items-center justify-center text-secondary hover:bg-secondary/10 rounded-lg transition-all">
                            <span class="material-symbols-outlined text-[18px]">history_edu</span>
                        </button>
                    </div>`;
                }).join('');

                return `
                <div style="margin-top:24px;">
                    <p style="font-size:15px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
                        <span class="material-symbols-outlined" style="font-size:18px;">check_circle</span> ${titleText} (${coll.length})
                    </p>
                    <div style="border:1px solid #f0f0f0;border-radius:12px;overflow:hidden;opacity:0.85;filter:grayscale(30%);box-shadow:0 1px 2px rgba(0,0,0,0.02);padding:0 16px;">
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
            <td style="padding:12px 14px;font-size:13px;color:#0059bb;font-weight:600;">
                <div style="display:flex;align-items:center;gap:6px;">
                    <span class="material-symbols-outlined text-[14px]">engineering</span>
                    ${n.techName || '—'}
                </div>
            </td>
            <td style="padding:12px 14px;font-size:14px;color:#6b7280;">${latLngLink||'—'}</td>
            <td style="padding:12px 14px;font-size:14px;color:#374151;">${n.ports||'—'}</td>
            <td style="padding:12px 14px;font-size:14px;font-weight:800;color:#dc2626;">${n.levels||'—'}</td>
            <td style="padding:12px 14px;font-size:13px;color:#374151;">
                <div style="font-weight:700;color:#111827;margin-bottom:2px;">${n.action||'—'}</div>
                <div style="font-size:11px;color:#6b7280;">${n.comments||''}</div>
            </td>
            <td style="padding:12px 14px;text-align:right;">
                <div style="display:flex;align-items:center;justify-content:flex-end;gap:12px;">
                    <button onclick="window.viewNapClients('${n.id}', '${n.name}')" style="background:none;border:none;color:#0059bb;cursor:pointer;display:flex;align-items:center;opacity:0.8;hover:opacity:1;" title="Ver Clientes Conectados"><span class="material-symbols-outlined text-[18px]">group</span></button>
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

        <div id="naps-map" style="width: 100%; height: 350px; border-radius: 16px; margin-bottom: 24px; z-index: 1; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);"></div>

        <div style="background:white;border:1px solid #f0f0f0;border-radius:12px;overflow-x:auto;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
            <table style="width:100%;border-collapse:collapse;min-width:900px;">
                <thead>
                    <tr style="background:#f8fafc;border-bottom:2px solid #e5e7eb;text-align:left;">
                        <th style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Fechas</th>
                        <th style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Nombres</th>
                        <th style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Zona</th>
                        <th style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Técnico</th>
                        <th style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Coordenadas</th>
                        <th style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Puertos</th>
                        <th style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Niveles</th>
                        <th style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Acción / Comentario</th>
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

// Map Initialization
let napsMapInstance = null;
window.initNapsMap = function() {
    const mapEl = document.getElementById('naps-map');
    if (!mapEl) return;
    
    if (napsMapInstance) {
        napsMapInstance.remove();
        napsMapInstance = null;
    }

    napsMapInstance = L.map('naps-map').setView([8.9833, -79.5167], 8);
    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps'
    }).addTo(napsMapInstance);

    const napsWithCoords = state.trackedNaps.filter(n => n.coords && n.coords.match(/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/));
    
    if (napsWithCoords.length === 0) return;

    const bounds = [];
    napsWithCoords.forEach(n => {
        const [lat, lng] = n.coords.split(',').map(s => parseFloat(s.trim()));
        bounds.push([lat, lng]);
        
        const isResolved = n.resolved;
        // Si hay niveles y empiezan con un número, revisar si es "alto" (por convención, si es menor o igual a -23 es malo en fibra, pero acá pueden estar en positivo o negativo, así que lo pintamos rojo si no está resuelto).
        const color = isResolved ? '#10b981' : '#ef4444'; 
        
        const markerHtml = `
            <div style="background:${color};width:24px;height:24px;border-radius:50%;border:2px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:10px;">
                <span class="material-symbols-outlined" style="font-size:14px;">router</span>
            </div>
        `;
        
        const icon = L.divIcon({
            html: markerHtml,
            className: '',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        L.marker([lat, lng], { icon }).addTo(napsMapInstance)
            .bindPopup(`
                <div style="text-align:center;padding:4px;">
                    <strong style="font-size:14px;color:#111827;">${n.name}</strong><br>
                    <span style="font-size:12px;color:#6b7280;">${n.zone || 'Sin zona'}</span><br>
                    <div style="margin-top:6px;padding:4px;background:#fee2e2;border-radius:4px;color:#dc2626;font-weight:bold;font-size:12px;">
                        Niveles: ${n.levels || 'No reportado'}
                    </div>
                    ${n.comments ? `<p style="font-size:11px;margin-top:6px;color:#4b5563;">${n.comments}</p>` : ''}
                </div>
            `);
    });

    if (bounds.length > 0) {
        napsMapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
};

// Modal Logic
window.openNapTrackerModal = (id = null) => {
    document.getElementById('nap-tracker-form').reset();
    document.getElementById('nt-id').value = id || Date.now().toString();
    document.getElementById('nt-id-wispro').value = '';
    document.getElementById('nt-validation-result').innerHTML = '';
    
    // Poblar técnicos en el datalist
    const techList = document.getElementById('tech-list');
    if (techList) {
        const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
        const techs = db.technicians || [];
        
        // Unir técnicos de Wispro con los 6 activos hardcoded para asegurar disponibilidad
        const allTechNames = [...new Set([
            ...TECNICOS_ACTIVOS,
            ...techs.map(t => t.name)
        ])].sort();

        techList.innerHTML = allTechNames.map(name => `<option value="${name}">`).join('');
    }

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
    
    // Asegurar que el datalist esté poblado
    const techList = document.getElementById('tech-list');
    if (techList) {
        const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
        const techs = db.technicians || [];
        
        const allTechNames = [...new Set([
            ...TECNICOS_ACTIVOS,
            ...techs.map(t => t.name)
        ])].sort();

        techList.innerHTML = allTechNames.map(name => `<option value="${name}">`).join('');
    }
    document.getElementById('nt-tech').value = item.techName || '';

    document.getElementById('nt-coords').value = item.coords || '';
    document.getElementById('nt-ports').value = item.ports || '';
    document.getElementById('nt-levels').value = item.levels || '';
    document.getElementById('nt-action').value = item.action || '';
    document.getElementById('nt-comments').value = item.comments || '';
    
    document.getElementById('nap-tracker-modal').classList.remove('hidden');
};

window.closeNapTrackerModal = () => document.getElementById('nap-tracker-modal').classList.add('hidden');

window.saveNapTracker = (e) => {
    e.preventDefault();
    const id = document.getElementById('nt-id').value;
    const syncWispro = document.getElementById('nt-sync-wispro').checked;

    const nap = {
        id,
        date: document.getElementById('nt-date').value,
        name: document.getElementById('nt-name').value,
        zone: document.getElementById('nt-zone').value,
        techName: document.getElementById('nt-tech').value,
        wisproId: document.getElementById('nt-id-wispro').value,
        coords: document.getElementById('nt-coords').value,
        ports: document.getElementById('nt-ports').value,
        levels: document.getElementById('nt-levels').value,
        action: document.getElementById('nt-action').value,
        comments: document.getElementById('nt-comments').value,
        resolved: false
    };

    if (syncWispro && nap.wisproId) {
        showNotification('Wispro', 'Sincronizando reporte con Wispro...', 'info');
        const detailMsg = `[Velocity Report] ${nap.date} - ${nap.techName}: Niveles ${nap.levels}. Acción: ${nap.action}. ${nap.comments}`;
        apiFetch(`/naps/${nap.wisproId}`, {
            method: 'PUT',
            data: { details: detailMsg }
        }, true).then(() => {
            showNotification('Éxito', 'Reporte documentado en Wispro', 'success');
        }).catch(() => {
            showNotification('Aviso', 'No se pudo actualizar Wispro, pero el reporte se guardó localmente.', 'issue');
        });
    }
    
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

// ── INTEGRACIÓN WISPRO NAPs ────────────────────────────────────────────────
window.validateNapInWispro = async function() {
    const name = document.getElementById('nt-name').value.trim();
    const resEl = document.getElementById('nt-validation-result');
    if (!name) return;

    resEl.innerHTML = '<span class="text-gray-400">Buscando...</span>';
    try {
        // Buscamos todas las NAPs y filtramos por nombre (la API no suele tener búsqueda parcial exacta por query)
        const allNaps = await apiPages('naps', 5); // Probamos 5 páginas
        const found = allNaps.find(n => n.name.toLowerCase() === name.toLowerCase());

        if (found) {
            resEl.innerHTML = `<span class="text-emerald-500">✓ Encontrada (ID: ${found.public_id}) - ${found.contracts_count} contratos</span>`;
            document.getElementById('nt-coords').value = `${found.latitude}, ${found.longitude}`;
            // Guardamos el ID real de Wispro para futuras consultas
            document.getElementById('nt-id-wispro').value = found.id;
        } else {
            resEl.innerHTML = '<span class="text-error">⚠ No encontrada en Wispro</span>';
        }
    } catch (e) {
        resEl.innerHTML = '<span class="text-error">Error de conexión</span>';
    }
};

window.viewNapClients = async function(localId, napName) {
    // Intentamos encontrar el ID de Wispro
    const item = state.trackedNaps.find(n => String(n.id) === String(localId));
    let wisproId = item?.wisproId;

    // Si no tenemos el ID, intentamos buscarlo por nombre primero
    if (!wisproId) {
        showNotification('Wispro', `Buscando ID de ${napName}...`, 'info');
        const allNaps = await apiPages('naps', 5);
        const found = allNaps.find(n => n.name.toLowerCase() === napName.toLowerCase());
        if (found) wisproId = found.id;
    }

    if (!wisproId) {
        showNotification('Error', 'No se pudo vincular con Wispro. Valida el nombre de la NAP.', 'issue');
        return;
    }

    showNotification('Wispro', `Obteniendo clientes de ${napName}...`, 'info');
    
    try {
        // Obtenemos una lista más amplia (hasta 1000) para filtrar localmente ya que la API ignora el filtro nap_id en el query
        const [contracts, installations] = await Promise.all([
            apiFetch(`/contracts?per_page=1000`, {}, true),
            apiFetch(`/installation_orders?per_page=1000`, {}, true)
        ]);

        // FILTRO MANUAL: Solo los que coincidan con la NAP seleccionada
        const cList = (contracts?.data || contracts || []).filter(c => String(c.nap_id) === String(wisproId));
        const iList = (installations?.data || installations || []).filter(i => String(i.nap_id) === String(wisproId));

        const total = cList.length + iList.length;
        
        let html = `
        <div id="nap-clients-modal" class="fixed inset-0 z-[201] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
            <div class="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div class="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 class="font-black text-gray-900 text-xl">Clientes en ${napName}</h3>
                        <p class="text-xs text-gray-500 font-bold uppercase tracking-widest">${total} Conexiones Detectadas</p>
                    </div>
                    <button onclick="document.getElementById('nap-clients-modal').remove()" class="w-10 h-10 rounded-full hover:bg-gray-200 flex items-center justify-center">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="p-6 overflow-y-auto space-y-6">
                    <div>
                        <h4 class="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-3">Contratos Activos (${cList.length})</h4>
                        <div class="space-y-2">
                            ${cList.map(c => `
                                <div class="flex items-center justify-between p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                                    <div class="flex items-center gap-3">
                                        <div class="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center text-[10px] font-black">#${c.public_id}</div>
                                        <div>
                                            <p class="text-sm font-bold text-gray-800">${state.clients[c.client_id]?.name || 'Cliente de Wispro'}</p>
                                            <p class="text-[10px] text-gray-500">ID: ${c.id.slice(0,8)}... | IP: ${c.ip || '—'}</p>
                                        </div>
                                    </div>
                                    <span class="text-[9px] font-black px-2 py-1 rounded-full bg-blue-100 text-blue-700 uppercase tracking-widest">${c.state}</span>
                                </div>
                            `).join('') || '<p class="text-center text-xs text-gray-400 py-4 italic">No hay contratos vinculados</p>'}
                        </div>
                    </div>
                    <div>
                        <h4 class="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-3">Instalaciones Pendientes (${iList.length})</h4>
                        <div class="space-y-2">
                            ${iList.map(i => `
                                <div class="flex items-center justify-between p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
                                    <div class="flex items-center gap-3">
                                        <div class="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center text-[10px] font-black">INS</div>
                                        <div>
                                            <p class="text-sm font-bold text-gray-800">${state.clients[i.client_id]?.name || 'Prospecto'}</p>
                                            <p class="text-[10px] text-gray-500">Estado: ${i.state} | Creado: ${new Date(i.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                </div>
                            `).join('') || '<p class="text-center text-xs text-gray-400 py-4 italic">No hay instalaciones en curso</p>'}
                        </div>
                    </div>
                </div>
                <div class="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
                    <button onclick="document.getElementById('nap-clients-modal').remove()" class="px-8 py-3 bg-gray-900 text-white rounded-xl font-bold text-sm active:scale-95 transition-all">
                        Cerrar Ventana
                    </button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
    } catch (e) {
        showNotification('Error', 'No se pudo obtener la información de los clientes.', 'issue');
    }
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

    const techRows = technicians.map(t => {
        const online = isTechOnline(t.id);
        return `
        <div class="flex items-center justify-between p-4 bg-surface-container rounded-xl">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black" style="background:${techColor(t.name)};">
                    ${techInitials(t.name)}
                </div>
                <div>
                    <div class="flex items-center gap-2">
                        <p class="font-bold text-on-surface text-sm">${t.name}</p>
                        <span class="w-2 h-2 rounded-full ${online ? 'bg-emerald-500 shadow-[0_0_5px_#10b981]' : 'bg-outline-variant'}"></span>
                    </div>
                    <p class="text-xs text-on-surface-variant">${t.email}</p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="window.toggleSimulatedOnline('${t.id}')" class="text-[9px] font-black uppercase text-secondary hover:bg-secondary/10 px-2 py-1 rounded-lg transition-all">
                    [Simular Login]
                </button>
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
        </div>`;
    }).join('');

    return `
    <div class="space-y-6 max-w-2xl">
        <div class="flex items-center justify-between">
            <h2 class="text-2xl font-extrabold text-on-surface">Gestión de Cuentas</h2>
            <div class="flex items-center gap-3">
                <button onclick="window.deleteInactiveUsers()" class="border border-error/50 text-error hover:bg-error/5 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-1.5 active:scale-95 transition-colors">
                    <span class="material-symbols-outlined text-sm">person_remove</span> Eliminar Inactivos
                </button>
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
window.setVisualMode = function(mode) {
    const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    if (!db.settings) db.settings = {};
    db.settings.visualMode = mode;
    localStorage.setItem('Velocity_Sync_State', JSON.stringify(db));
    serverPush(db);
    document.documentElement.className = mode;
    renderTab('settings');
    showNotification('Tema Actualizado', `Modo ${mode} aplicado con éxito.`, 'success');
};

Views.settings = () => {
    const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    const s  = db.settings || {};

    return `
    <div class="space-y-6 max-w-2xl">
        <h2 class="text-2xl font-extrabold text-on-surface">Ajustes del Sistema</h2>

        <!-- Apariencia -->
        <div class="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 space-y-4">
            <div class="flex items-center gap-2 mb-2">
                <span class="material-symbols-outlined text-secondary">palette</span>
                <h3 class="font-bold text-on-surface">Apariencia y Tema</h3>
            </div>
            <div class="grid grid-cols-3 gap-3">
                <button onclick="window.setVisualMode('kinetic')" class="flex flex-col items-center gap-2 p-4 rounded-xl border-2 ${db.settings?.visualMode === 'kinetic' || !db.settings?.visualMode ? 'border-secondary bg-secondary/5' : 'border-outline-variant/20 hover:bg-surface-container'} transition-all group">
                    <div class="w-10 h-10 rounded-lg bg-[#0059bb] shadow-lg group-active:scale-95 transition-transform"></div>
                    <span class="text-[10px] font-black uppercase tracking-widest text-on-surface">Kinetic</span>
                </button>
                <button onclick="window.setVisualMode('nocturno')" class="flex flex-col items-center gap-2 p-4 rounded-xl border-2 ${db.settings?.visualMode === 'nocturno' ? 'border-secondary bg-secondary/5' : 'border-outline-variant/20 hover:bg-surface-container'} transition-all group">
                    <div class="w-10 h-10 rounded-lg bg-[#081b38] border border-white/10 shadow-lg group-active:scale-95 transition-transform"></div>
                    <span class="text-[10px] font-black uppercase tracking-widest text-on-surface">Nocturno</span>
                </button>
                <button onclick="window.setVisualMode('operativo')" class="flex flex-col items-center gap-2 p-4 rounded-xl border-2 ${db.settings?.visualMode === 'operativo' ? 'border-secondary bg-secondary/5' : 'border-outline-variant/20 hover:bg-surface-container'} transition-all group">
                    <div class="w-10 h-10 rounded-lg bg-black shadow-lg group-active:scale-95 transition-transform"></div>
                    <span class="text-[10px] font-black uppercase tracking-widest text-on-surface">Operativo</span>
                </button>
            </div>
        </div>

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

        </div>

        <!-- Migración y Respaldo -->
        <div class="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 space-y-4">
            <div class="flex items-center gap-2 mb-2">
                <span class="material-symbols-outlined text-secondary">send_to_mobile</span>
                <div>
                    <h3 class="font-bold text-on-surface">Migración y Respaldo</h3>
                    <p class="text-xs text-on-surface-variant mt-0.5">Usa esto para pasar tus datos a otro celular o PC rápidamente.</p>
                </div>
            </div>
            <div class="space-y-3">
                <textarea id="migration-code" readonly placeholder="El código de migración aparecerá aquí..." 
                    class="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-[10px] font-mono text-on-surface h-24 resize-none outline-none focus:border-secondary"></textarea>
                <div class="grid grid-cols-2 gap-3">
                    <button onclick="window.exportDatabase()" class="border border-secondary text-secondary py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-secondary/5 active:scale-95">
                        <span class="material-symbols-outlined text-sm">content_copy</span> Exportar
                    </button>
                    <button onclick="window.importDatabasePrompt()" class="kinetic-gradient text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95">
                        <span class="material-symbols-outlined text-sm">download</span> Importar
                    </button>
                </div>
            </div>
        </div>

        <!-- Diagnóstico de Red (QA) -->
        <div class="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 space-y-4">
            <div class="flex items-center gap-2 mb-2">
                <span class="material-symbols-outlined text-error">bug_report</span>
                <div>
                    <h3 class="font-bold text-on-surface">Diagnóstico de Red</h3>
                    <p class="text-xs text-on-surface-variant mt-0.5">Ver errores técnicos si no carga la información.</p>
                </div>
            </div>
            <button onclick="window.viewErrorLog()" class="w-full bg-error/10 text-error py-3 rounded-xl font-bold text-xs uppercase tracking-widest border border-error/20 hover:bg-error/20 transition-all">
                Ver Log de Errores (${CFG.errorLog.length})
            </button>
        </div>

        <!-- Modo Simulación Global (QA) -->
        <div class="bg-secondary/10 p-6 rounded-2xl border border-secondary/20 space-y-4">
            <div class="flex items-center gap-2 mb-2">
                <span class="material-symbols-outlined text-secondary">rocket_launch</span>
                <div>
                    <h3 class="font-bold text-secondary">Modo Simulación Global</h3>
                    <p class="text-xs text-on-surface-variant mt-0.5">Inyecta datos ficticios para probar el Dashboard y KPIs.</p>
                </div>
            </div>
            <button onclick="window.loadSupervisorDemo()" class="kinetic-gradient text-white w-full py-4 rounded-xl font-bold text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all">
                Activar Simulación Maestro
            </button>
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

// ── MIGRACIÓN DE DATOS ──────────────────────────────────────────────────
window.exportDatabase = function() {
    try {
        const raw = localStorage.getItem('Velocity_Sync_State');
        if (!raw) { alert('No hay datos para exportar'); return; }
        
        const code = btoa(unescape(encodeURIComponent(raw)));
        const area = document.getElementById('migration-code');
        if (area) {
            area.value = code;
            area.select();
            document.execCommand('copy');
            showNotification('Código Copiado', 'Pasa este código al otro dispositivo y úsalo en "Importar".', 'success');
        }
    } catch(e) {
        console.error('Error al exportar:', e);
        alert('Error al generar el código de migración.');
    }
};

window.importDatabasePrompt = function() {
    const code = prompt('Pega aquí el código de migración que copiaste del otro dispositivo:');
    if (!code) return;

    try {
        const decoded = decodeURIComponent(escape(atob(code.trim())));
        // Validar que sea JSON válido
        JSON.parse(decoded);
        
        if (confirm('⚠️ Esto sobrescribirá todos los datos actuales. ¿Deseas continuar?')) {
            localStorage.setItem('Velocity_Sync_State', decoded);
            showNotification('Importación Exitosa', 'Los datos se han cargado. La página se reiniciará.', 'success');
            setTimeout(() => window.location.reload(), 1500);
        }
    } catch(e) {
        console.error('Error al importar:', e);
        alert('❌ Código de migración inválido. Asegúrate de haber copiado todo el texto correctamente.');
    }
};

// ── DIAGNÓSTICO QA ──────────────────────────────────────────────────────
window.viewErrorLog = function() {
    const logs = CFG.errorLog.map(l => `
        <div class="p-3 bg-surface-container border-b border-outline-variant/10 last:border-0">
            <div class="flex justify-between text-[10px] font-black text-on-surface-variant uppercase mb-1">
                <span>${l.time}</span>
                <span class="text-error">${l.proxy}</span>
            </div>
            <p class="text-xs font-mono text-on-surface break-all">${l.error}</p>
            <p class="text-[9px] text-secondary mt-1">${l.path}</p>
        </div>
    `).join('') || '<p class="text-center py-10 opacity-50 text-xs">No hay errores registrados.</p>';

    const html = `
    <div id="error-log-modal" class="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-surface-container-lowest w-full max-w-lg rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border border-outline-variant/20">
            <div class="p-6 border-b border-outline-variant/10 flex items-center justify-between">
                <h3 class="font-black text-on-surface">Log de Errores (Red)</h3>
                <button onclick="document.getElementById('error-log-modal').remove()" class="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center">
                    <span class="material-symbols-outlined text-xl">close</span>
                </button>
            </div>
            <div class="max-h-96 overflow-y-auto">
                ${logs}
            </div>
            <div class="p-4 bg-surface-container-low text-center">
                <p class="text-[10px] font-bold text-on-surface-variant uppercase">Estos logs ayudan a detectar bloqueos de red en el dispositivo móvil.</p>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.toggleSimulatedOnline = function(techId) {
    const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    if (!db.simulatedOnline) db.simulatedOnline = {};
    
    db.simulatedOnline[techId] = !db.simulatedOnline[techId];
    localStorage.setItem('Velocity_Sync_State', JSON.stringify(db));
    serverPush(db);
    
    renderTab('users');
    showNotification('Estado Simulado', 'Cambio aplicado para pruebas visuales.', 'success');
};

// Modificar isTechOnline para que respete la simulación
function isTechOnline(techId) {
    // Buscar id del técnico por nombre si se pasa el nombre
    let foundId = techId;
    if (isNaN(techId) && typeof techId === 'string') {
        Object.entries(state.techs).forEach(([id, n]) => {
            if (n.toLowerCase().includes(techId.toLowerCase().split(' ')[0])) foundId = id;
        });
    }

    if (!foundId) return false;
    
    const lastSeen = state.onlineStatus?.[foundId];
    if (!lastSeen) return false;
    
    // Un técnico está online si envió un pulso en los últimos 2.5 minutos
    return (Date.now() - lastSeen) < (150 * 1000);
}

window.loadSupervisorDemo = async function() {
    const msg = 'Esto inyectará órdenes de prueba para Luis y Nelson y los activará como online. ¿Continuar?';
    if (!confirm(msg)) return;

    const demoOrders = [];
    // Ajustado para solo Luis y Nelson según pedido del usuario
    const names = ['Luis David', 'Nelson Eduar Sagel'];
    const types = ['installation', 'technical', 'feasibility', 'resignation'];
    
    // Inyectar estado online simulado
    const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    if (!db.simulatedOnline) db.simulatedOnline = {};
    
    names.forEach((name, i) => {
        db.simulatedOnline[name] = true;
        
        // Crear 6 órdenes por técnico para que el dashboard se vea lleno
        for (let j = 0; j < 6; j++) {
            const isDone = j < 4; // 66% efectividad aprox
            const type = types[j % 4];
            const t = TYPE_CFG[type];
            
            demoOrders.push({
                id: `D-${500 + (i*6) + j}`,
                rawId: `demo-${i}-${j}`,
                kind: type,
                typeLabel: t.label,
                typeColor: t.color,
                state: isDone ? 'finalized' : 'pending',
                result: isDone ? 'success' : 'not_set',
                client: `CLIENTE DE PRUEBA ${i*6 + j + 1}`,
                address: 'Calle Principal, Metetí',
                zone: 'METETÍ',
                techName: name,
                techId: `tech-${i}`,
                startTime: `${8 + j}:30 AM`,
                endTime: `${9 + j}:30 AM`,
                nap: isDone ? 'NAP-W-13' : null,
                description: 'Prueba de sincronización móvil.'
            });
        }
    });

    localStorage.setItem('Velocity_Sync_State', JSON.stringify(db));
    serverPush(db);
    state.orders = demoOrders;
    state.lastSync = Date.now();
    renderTab('dashboard');
    showNotification('📊 Simulación Luis/Nelson', 'Dashboard actualizado solo con Luis y Nelson.', 'success');
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
    serverPush(db);
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
        const d = await apiFetch('/employees?per_page=1');
        if (d) {
            resultEl.className = 'text-xs font-bold p-3 rounded-xl bg-green-50 text-green-700';
            resultEl.textContent = `✅ Conexión OK — ${d.meta?.total_count || d.data?.length || '?'} empleados`;
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
        const res = await apiFetch(`/clients/${_zoneClient.id}`, {
            method: 'PUT',
            data: { client: { zone_name: newZone } }
        });
        if (res) {

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
                const ts = Date.now().toString().slice(-6);
                const rnd = Math.random().toString(36).substr(2, 4);
                if (role === 'supervisor') {
                    user.id = `S-${ts}-${rnd}`;
                    db.supervisors.push(user);
                } else {
                    user.id = `T-${ts}-${rnd}`;
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
        const ts = Date.now().toString().slice(-6);
        const rnd = Math.random().toString(36).substr(2, 4);
        
        if (role === 'supervisor') {
            newUser.id = `S-${ts}-${rnd}`;
            db.supervisors.push(newUser);
        } else {
            newUser.id     = `T-${ts}-${rnd}`;
            newUser.status = 'offline';
            db.technicians.push(newUser);
        }
    }

    localStorage.setItem('Velocity_Sync_State', JSON.stringify(db));
    serverPush(db);
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
                // Crear correo mock basado en el nombre (ej. juan.perez@atg-rappido.com)
                const sanitized = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
                const ts = Date.now().toString().slice(-6);
                const rnd = Math.random().toString(36).substr(2, 4);
                
                db.technicians.push({
                    id: `T-${ts}-${rnd}`,
                    name: name,
                    email: `${sanitized}@atg-rappido.com`,
                    password: 'Velocity2024',
                    disabled: false,
                    wisproId: id
                });
                addedCount++;
            }
        });
        
        localStorage.setItem('Velocity_Sync_State', JSON.stringify(db));
        serverPush(db);
        renderTab('users');
        
        alert(`Sincronización completada. Se importaron ${addedCount} técnicos nuevos. Contraseña por defecto: Velocity2024`);
        btn.innerHTML = origIcon;
    } catch(e) {
        console.error('Error sincronizando técnicos:', e);
        alert('Hubo un error al intentar sincronizar los técnicos.');
    }
};

// ── ELIMINAR TÉCNICOS INACTIVOS ─────────────────────────────────────────────
window.deleteInactiveUsers = function() {
    const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    if (!db.technicians || db.technicians.length === 0) {
        alert('No hay técnicos registrados para limpiar.');
        return;
    }

    const inactiveTechs = db.technicians.filter(t => !isActiveTech(t.name));
    const removedCount = inactiveTechs.length;

    if (removedCount === 0) {
        alert('Todos los técnicos actuales están en la flota activa.');
        return;
    }

    if (confirm(`Se han detectado ${removedCount} técnicos que no pertenecen a la flota activa definida. ¿Deseas eliminarlos permanentemente?`)) {
        db.technicians = db.technicians.filter(t => isActiveTech(t.name));
        localStorage.setItem('Velocity_Sync_State', JSON.stringify(db));
        serverPush(db);
        
        showNotification('Limpieza Completada', `Se eliminaron ${removedCount} técnicos inactivos.`, 'success');
        renderTab('users');
    }
};

// ── INIT ──────────────────────────────────────────────────────────────────
async function initApp() {
    // Verificar auth
    const role = sessionStorage.getItem('Velocity_Role');
    if (role !== 'supervisor') { window.location.href = 'login.html'; return; }
    
    // 1. Sincronizar estado base desde el servidor (Usuarios, etc)
    await serverSync();

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
        loadDynamicClients();
        // Carga paralela: datos estáticos + órdenes del día + issues
        await Promise.all([
            loadStaticData(),
            loadTodayOrders(),
            loadIssues()
        ]);
        state.lastSync = Date.now();
        state.knownOrderIds = new Set([...state.orders, ...state.finishedOrders].map(o => o.id));
        state.knownIssueIds = new Set([...state.issues, ...state.finishedIssues].map(i => i.id));
    } catch(e) {
        console.error('Error en carga inicial:', e);
    }

    // Aplicar tema
    const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    const theme = db.settings?.visualMode || 'kinetic';
    document.documentElement.className = theme;

    // Mostrar nombre del usuario activo
    const activeUserId = sessionStorage.getItem('Velocity_Active_User');
    const activeUser = db.supervisors?.find(s => String(s.id) === String(activeUserId));
    if (activeUser) {
        const nameEl = document.getElementById('active-user-name');
        if (nameEl) nameEl.textContent = activeUser.name;
    }

    // Renderizar pestaña guardada
    switchTab(state.tab);

    // Iniciar polling
    startPolling();
}

window.addEventListener('DOMContentLoaded', initApp);


// ── BITÁCORA TÉCNICA (ÓRDENES) ───────────────────────────────────────────
window.openFeedbackModal = async function(id) {
    // 1. Buscar en órdenes activas o finalizadas de hoy
    let order = [...state.orders, ...state.finishedOrders].find(o => String(o.id) === String(id) || String(o.rawId) === String(id));
    
    // 2. Si no está, buscar en los resultados de la auditoría mensual (Pestaña Reportes)
    if (!order && state.monthlyReport?.results) {
        const r = state.monthlyReport.results;
        order = [...(r.orders || []), ...(r.issues || [])].find(o => String(o.id) === String(id) || String(o.rawId) === String(id));
    }

    if (!order) {
        console.warn('[Velocity] No se encontró la orden en ningún estado local:', id);
        // Fallback final: crear un objeto mínimo de búsqueda
        order = { id, rawId: id, client: 'Cargando datos...', typeColor: '#6b7280' };
    }

    const typeColor = order.typeColor || '#6b7280';
    const clientName = order.client || 'Cliente desconocido';
    const modalId = 'feedback-modal';
    
    document.getElementById(modalId)?.remove();

    const html = `
    <div id="${modalId}" class="fixed inset-0 z-[101] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
        <div class="bg-surface-container-lowest w-full max-w-2xl max-h-[92vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-outline-variant/20">
            <!-- Header -->
            <div class="p-8 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low/50">
                <div class="flex items-center gap-5">
                    <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg ring-4 ring-white/10" style="background:${typeColor}">
                        <span class="material-symbols-outlined text-3xl">history_edu</span>
                    </div>
                    <div>
                        <h3 class="font-black text-on-surface text-xl">Bitácora Técnica #${order.id}</h3>
                        <p class="text-[11px] text-on-surface-variant font-black uppercase tracking-[0.2em] opacity-60">${clientName}</p>
                    </div>
                </div>
                <button onclick="document.getElementById('${modalId}').remove()" class="w-12 h-12 rounded-full hover:bg-surface-container-high flex items-center justify-center transition-all hover:rotate-90">
                    <span class="material-symbols-outlined text-on-surface-variant text-2xl">close</span>
                </button>
            </div>

            <!-- Body (Timeline) -->
            <div id="feedback-timeline" class="flex-1 overflow-y-auto p-8 space-y-6 bg-surface-container-lowest/30 custom-scrollbar scroll-smooth">
                <div class="flex flex-col items-center justify-center py-20 text-on-surface-variant/30">
                    <span class="material-symbols-outlined text-5xl mb-4 animate-spin">history</span>
                    <p class="font-black text-sm tracking-widest uppercase italic mb-1">Peinando Wispro...</p>
                    <p class="text-[9px] font-bold opacity-40 uppercase">Búsqueda profunda en progreso (Sonda 3.6)</p>
                </div>
            </div>

            <!-- Footer con Enlace Directo -->
            <div id="feedback-footer" class="px-8 py-5 bg-surface-container-low border-t border-outline-variant/5 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <span class="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse"></span>
                    <span class="text-[9px] font-black text-on-surface-variant/60 uppercase tracking-widest">Live Link</span>
                </div>
                
                <a id="wispro-link" href="https://www.cloud.wispro.co/order/orders/${order.rawId}" target="_blank" 
                   class="flex items-center gap-2 px-6 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-2xl transition-all group border border-primary/20 shadow-sm">
                    <span class="text-[10px] font-black uppercase tracking-wider">Ver en Wispro</span>
                    <span class="material-symbols-outlined text-sm group-hover:translate-x-0.5 transition-transform">open_in_new</span>
                </a>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    await window.loadFeedbacks(order);
};

window.loadFeedbacks = async function(target) {
    const timeline = document.getElementById('feedback-timeline');
    const wisproLink = document.getElementById('wispro-link');
    if (!timeline) return;

    try {
        const sequentialId = (target.id && String(target.id).length < 8) ? target.id : target.sequential_id;
        console.log(`[Velocity] Sonda 5.1 (Bloodhound) buscando #${sequentialId} y Orderable ID: ${target.orderable_id}...`);

        const idsToTry = new Set();
        if (target.rawId) idsToTry.add(target.rawId);
        if (target.orderable_id) idsToTry.add(target.orderable_id);
        if (target.ticketable_id) idsToTry.add(target.ticketable_id);

        // 1. Búsqueda Dinámica por Secuencial en múltiples modelos
        const searchModels = ['/order/orders', '/installation_orders', '/help_desk/issues', '/sale_desk/tickets'];
        const searchQueries = searchModels.map(m => apiFetch(`${m}?q[sequential_id_eq]=${sequentialId}`, {}, true));
        
        const searchResults = await Promise.allSettled(searchQueries);
        searchResults.forEach(res => {
            if (res.status === 'fulfilled' && res.value) {
                const items = res.value.data || res.value;
                if (Array.isArray(items) && items.length > 0) {
                    items.forEach(item => {
                        if (item.id) idsToTry.add(item.id);
                        if (item.uuid) idsToTry.add(item.uuid);
                        // Actualizar link de Wispro si encontramos el UUID correcto
                        if (wisproLink && item.id && item.id.length > 10) {
                            wisproLink.href = `https://www.cloud.wispro.co/order/orders/${item.id}`;
                        }
                    });
                }
            }
        });

        // 2. Preparar Endpoints con los IDs descubiertos
        const endpoints = [];
        idsToTry.forEach(id => {
            if (!id) return;
            endpoints.push(`/order/orders/${id}/feedbacks`);
            endpoints.push(`/installation_orders/${id}/feedbacks`);
            endpoints.push(`/help_desk/issues/${id}/feedbacks`);
            endpoints.push(`/help_desk/issues/${id}/issue_feedbacks`);
            endpoints.push(`/help_desk/issues/${id}/comments`);
        });

        // 3. Ejecución por lotes (Batching)
        const results = [];
        const batchSize = 3;
        for (let i = 0; i < endpoints.length; i += batchSize) {
            const batch = endpoints.slice(i, i + batchSize);
            const batchRes = await Promise.allSettled(batch.map(ep => apiFetch(ep, {}, true)));
            results.push(...batchRes);
            if (i + batchSize < endpoints.length) await new Promise(r => setTimeout(r, 200));
        }
        
        let allFeedbacks = [];
        const seenBodies = new Set();
        results.forEach(res => {
            if (res.status === 'fulfilled' && res.value) {
                const data = res.value.data || res.value;
                if (Array.isArray(data)) {
                    data.forEach(f => {
                        const body = (f.body || f.comment || '').trim();
                        if (body && !seenBodies.has(body)) {
                            allFeedbacks.push(f);
                            seenBodies.add(body);
                        }
                    });
                }
            }
        });

        if (allFeedbacks.length === 0) {
            timeline.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 text-on-surface-variant/15 italic text-center px-10">
                    <span class="material-symbols-outlined text-6xl mb-4">search_off</span>
                    <p class="text-xs font-black tracking-widest uppercase mb-1">Cero resultados</p>
                    <p class="text-[8px] opacity-40 uppercase">Ni por ID, ni por UUID, ni por búsqueda secuencial.</p>
                </div>`;
            return;
        }

        allFeedbacks.sort((a,b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

        timeline.innerHTML = allFeedbacks.map(f => {
            const date = f.created_at ? new Date(f.created_at).toLocaleString('es-PA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '--:--';
            const senderName = f.author_name || f.technician_name || f.creator_name || f.user_name || 'Sistema';
            const isSelf = senderName.toLowerCase().includes('admin') || senderName.toLowerCase().includes('supervisor');
            
            return `
            <div class="flex gap-4 ${isSelf ? 'flex-row-reverse' : ''} animate-in slide-in-from-bottom-2 duration-300">
                <div class="w-11 h-11 rounded-2xl flex-shrink-0 flex items-center justify-center text-on-surface-variant/40 bg-surface-container-high font-black text-sm border border-outline-variant/10 shadow-sm">
                    ${senderName.charAt(0).toUpperCase()}
                </div>
                <div class="max-w-[80%] space-y-1.5 ${isSelf ? 'items-end' : ''}">
                    <div class="flex items-center gap-2 ${isSelf ? 'flex-row-reverse' : ''} px-1">
                        <span class="text-[10px] font-black text-on-surface uppercase tracking-wider">${senderName}</span>
                        <span class="text-[9px] text-on-surface-variant/30 font-bold">${date}</span>
                    </div>
                    <div class="p-5 rounded-[1.5rem] text-[13px] leading-relaxed shadow-sm ${isSelf ? 'bg-secondary text-white rounded-tr-none shadow-secondary/10' : 'bg-white text-on-surface rounded-tl-none border border-outline-variant/10'}">
                        ${f.body || f.comment || '—'}
                    </div>
                </div>
            </div>`;
        }).join('');
        
        timeline.scrollTop = timeline.scrollHeight;

    } catch (e) {
        console.error('[Velocity] Sonda 5.0 fallida:', e);
        timeline.innerHTML = `<p class="text-center text-error font-black text-[10px] uppercase p-10 opacity-50">Fallo en búsqueda dinámica</p>`;
    }
};





window.exportOrdersToCSV = function() {
    const all = [...state.orders, ...state.finishedOrders];
    if (all.length === 0) { alert('No hay datos para exportar'); return; }

    const headers = ['ID', 'Tipo', 'Cliente', 'Direccion', 'Zona', 'Tecnico', 'Inicio', 'Fin', 'Estado', 'NAP'];
    const rows = all.map(o => [
        o.id,
        o.typeLabel,
        o.client.replace(/,/g, ''),
        (o.address || '').replace(/,/g, ''),
        o.zone,
        o.techName,
        o.startTime,
        o.endTime,
        o.state,
        o.nap || ''
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Velocity_Reporte_${new Date().toLocaleDateString('en-CA')}.csv`);
    document.body.appendChild(link);
    link.click();
};


// ── EXPORTACIÓN MENSUAL ────────────────────────────────────────────────────
window.exportMonthlyCSV = function() {
    const r = state.monthlyReport.results;
    if (!r) return;

    const headers = ['ID', 'Fecha', 'Cliente', 'Categoría', 'Estado', 'Prioridad', 'Descripción'];
    const rows = r.issues.map(i => {
        const c = state.clients[i.client_id] || {};
        const cat = state.categories[i.category_id] || '';
        return [
            i.public_id,
            (i.created_at || '').slice(0, 10),
            (c.name || 'Desconocido').replace(/,/g, ''),
            cat.replace(/,/g, ''),
            i.state,
            i.priority,
            (i.description || '').replace(/,/g, '').replace(/\n/g, ' ')
        ];
    });

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Reporte_Mensual_Tickets_${r.month}_${r.year}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.generateMonthlyPDF = function() {
    const r = state.monthlyReport.results;
    if (!r) return;

    const win = window.open('', '_blank');
    const monthsNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const mName = monthsNames[r.month-1];
    
    // Logo Rappido (referencia local)
    const logoSrc = './uploaded_media_1776452368925.img';

    const categoryRows = Object.entries(r.stats.byCategory)
        .sort((a,b)=>b[1]-a[1])
        .map(([cat, count]) => {
            const pct = Math.round((count / r.stats.total) * 100);
            return `<tr>
                <td style="padding:12px;border-bottom:1px solid #edf2f7;font-weight:600;color:#2d3748;">${cat}</td>
                <td style="padding:12px;border-bottom:1px solid #edf2f7;text-align:center;font-weight:700;">${count}</td>
                <td style="padding:12px;border-bottom:1px solid #edf2f7;text-align:right;color:#4a5568;">${pct}%</td>
            </tr>`;
        }).join('');

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Reporte de Auditoría - Velocity Rappido</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
            * { box-sizing: border-box; }
            body { font-family: 'Inter', sans-serif; padding: 50px; color: #1a202c; max-width: 900px; margin: 0 auto; background: white; }
            
            .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 30px; border-bottom: 3px solid #ebf8ff; margin-bottom: 40px; }
            .logo-container { display: flex; align-items: center; gap: 15px; }
            .logo { height: 60px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.05)); }
            
            .title-section { text-align: right; }
            .title-section h1 { margin: 0; color: #2b6cb0; font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
            .title-section p { margin: 4px 0 0; color: #a0aec0; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; }

            .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px; }
            .stat-card { background: #f7fafc; padding: 25px; border-radius: 20px; border: 1px solid #e2e8f0; }
            .stat-card label { display: block; font-size: 10px; font-weight: 800; color: #718096; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
            .stat-card value { display: block; font-size: 32px; font-weight: 800; color: #2d3748; }

            .table-container { background: white; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; margin-top: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #f8fafc; padding: 15px; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #4a5568; text-align: left; border-bottom: 2px solid #edf2f7; }
            
            .legal-box { margin-top: 50px; background: #fffaf0; border: 1px solid #feebc8; padding: 30px; border-radius: 20px; color: #7b341e; position: relative; overflow: hidden; }
            .legal-box::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 6px; background: #f6ad55; }
            .legal-box h4 { margin: 0 0 10px; font-weight: 800; font-size: 15px; }
            .legal-box p { margin: 0; font-size: 13px; line-height: 1.6; }

            .signature-section { margin-top: 80px; display: flex; justify-content: space-between; padding: 0 40px; }
            .sig-box { text-align: center; width: 220px; }
            .sig-line { border-top: 1px solid #cbd5e0; margin-bottom: 10px; }
            .sig-box p { margin: 0; font-size: 12px; font-weight: 800; color: #4a5568; }
            .sig-box span { font-size: 10px; color: #a0aec0; }

            .footer { margin-top: 60px; text-align: center; border-top: 1px solid #edf2f7; padding-top: 20px; font-size: 10px; color: #a0aec0; font-weight: 600; }

            @media print {
                body { padding: 0; background: white; }
                .stat-card { background: #f7fafc !important; -webkit-print-color-adjust: exact; }
                .legal-box { background: #fffaf0 !important; -webkit-print-color-adjust: exact; }
                .no-print { display: none; }
            }
        </style>
    </head>
    <body onload="window.print()">
        <header class="header">
            <div class="logo-container">
                <img src="${logoSrc}" class="logo" alt="Velocity Logo" onerror="this.src='https://via.placeholder.com/150?text=VELOCITY'">
            </div>
            <div class="title-section">
                <h1>Reporte de Gestión</h1>
                <p>Auditoría Mensual de Mesa de Ayuda</p>
            </div>
        </header>

        <section class="stats-grid">
            <div class="stat-card">
                <label>Periodo Fiscal</label>
                <value>${mName} ${r.year}</value>
            </div>
            <div class="stat-card">
                <label>Volumen Total</label>
                <value>${r.stats.total} Tickets</value>
            </div>
            <div class="stat-card">
                <label>Estatus Reporte</label>
                <value style="font-size:20px; color:#2f855a;">✓ Certificado</value>
            </div>
        </section>

        <h3>Desglose por Categoría de Problema</h3>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th style="width: 50%;">Descripción de Incidencia</th>
                        <th style="text-align:center;">Volumen</th>
                        <th style="text-align:right;">Participación</th>
                    </tr>
                </thead>
                <tbody>
                    ${categoryRows}
                </tbody>
            </table>
        </div>

        <div class="legal-box">
            <h4>Declaración de Integridad de Datos</h4>
            <p>
                Este documento resume la actividad operativa de la Mesa de Ayuda durante el mes de ${mName} de ${r.year}. 
                Los datos han sido extraídos directamente de los registros de Wispro Cloud mediante el protocolo de auditoría 
                de Velocity Rappido. Este informe es confidencial y ha sido preparado para la gerencia de operaciones.
            </p>
        </div>

        <div class="signature-section">
            <div class="sig-box">
                <div class="sig-line"></div>
                <p>Supervisor de Mesa de Ayuda</p>
                <span>Responsable de Auditoría</span>
            </div>
            <div class="sig-box">
                <div class="sig-line"></div>
                <p>Gerencia de Operaciones</p>
                <span>Velocity Rappido Panama</span>
            </div>
        </div>

        <footer class="footer">
            GENERADO AUTOMÁTICAMENTE POR VELOCITY DASHBOARD — ID: ${Math.random().toString(36).substr(2, 9).toUpperCase()} — FECHA DE EMISIÓN: ${new Date().toLocaleString()}
        </footer>
    </body>
    </html>`;

    win.document.write(html);
    win.document.close();
};


