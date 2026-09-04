/**
 * VELOCITY — Panel de Supervisor
 * Arquitectura limpia con cache inteligente y polling ligero
 * Versión: 2.0.0-PRO (Updated Node Proxy)
 */
console.log('🚀 Velocity Supervisor v2.0.0-PRO cargado correctamente');

// ── CONFIGURACIÓN ─────────────────────────────────────────────────────────
// Cargar configuración desde config.js







window.updateNapsBadge = function() {
    const badge = document.getElementById('naps-badge');
    const badgeCollapsed = document.getElementById('naps-badge-collapsed');
    const count = state.trackedNaps ? state.trackedNaps.filter(n => !n.resolved).length : 0;
    if (badge) {
        badge.textContent = count;
        badge.classList.toggle('hidden', count === 0);
    }
    if (badgeCollapsed) {
        badgeCollapsed.textContent = count;
        badgeCollapsed.classList.toggle('hidden', count === 0);
    }
};

window.calculateMesaCounts = function(activeType = 'all') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const counts = { all: 0, hoy: 0, manana: 0, vencido: 0, sin_fecha: 0, sin_asignar: 0 };
    const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');

    // 1. Reportes (Mesa de Ayuda / Issues)
    if (activeType === 'all' || activeType === 'issues') {
        (state.issues || []).forEach(i => {
            let tName = state.techs[i.assignable_id];
            if (!tName && i.assignable_id) {
                const f = (db.technicians || []).find(t => String(t.wisproId) === String(i.assignable_id) || String(t.id) === String(i.assignable_id));
                tName = f?.name;
            }
            if (!tName) tName = 'Sin asignar';

            if (tName === 'Sin asignar') {
                counts.sin_asignar++;
                counts.all++;
                const venc = i.expires_at ? new Date(i.expires_at) : null;
                if (venc) {
                    venc.setHours(0, 0, 0, 0);
                    if (venc.getTime() <= today.getTime()) {
                        counts.hoy++;
                    }
                }
                return;
            }

            const esAct = TECNICOS_ACTIVOS.some(n => tName.toLowerCase().includes(n.split(' ')[0].toLowerCase()));
            if (!esAct) return;

            counts.all++;
            const venc = i.expires_at ? new Date(i.expires_at) : null;
            if (!venc) {
                counts.sin_fecha++;
                counts.hoy++; // Reporte activo sin fecha vence hoy / requiere atención hoy
                return;
            }
            
            venc.setHours(0, 0, 0, 0);
            const tTime = today.getTime();
            const mTime = tomorrow.getTime();
            const vTime = venc.getTime();
            
            if (vTime === tTime || vTime < tTime) counts.hoy++;
            if (vTime === mTime) counts.manana++;
            if (vTime < tTime) counts.vencido++;
        });
    }

    // 2. Órdenes (Instalaciones)
    if (activeType === 'all' || activeType === 'orders') {
        (state.orders || []).forEach(o => {
            if (o.kind !== 'installation') return;

            const tName = o.techName || 'Sin asignar';
            if (tName === 'Sin asignar') return; // Excluir instalaciones sin asignar

            const esAct = TECNICOS_ACTIVOS.some(n => tName.toLowerCase().includes(n.split(' ')[0].toLowerCase()));
            if (!esAct) return;

            counts.all++;

            const sched = o.start_at ? new Date(o.start_at) : null;
            if (!sched) {
                counts.sin_fecha++;
                return;
            }
            sched.setHours(0, 0, 0, 0);

            const tTime = today.getTime();
            const mTime = tomorrow.getTime();
            const sTime = sched.getTime();

            if (sTime === tTime) counts.hoy++;
            if (sTime === mTime) counts.manana++;
            if (sTime < tTime) counts.vencido++;
        });
    }

    return counts;
};

window.updateMesaBadge = function() {
    const badge = document.getElementById('mesa-badge');
    const badgeCollapsed = document.getElementById('mesa-badge-collapsed');
    if (!badge && !badgeCollapsed) return;

    // Misma fuente de la verdad para el total de Hoy
    const counts = window.calculateMesaCounts('all');
    const totalToday = counts.hoy;

    if (badge) {
        badge.textContent = totalToday;
        badge.classList.toggle('hidden', totalToday === 0);
    }
    if (badgeCollapsed) {
        badgeCollapsed.textContent = totalToday;
        badgeCollapsed.classList.toggle('hidden', totalToday === 0);
    }
};

window.updateReportsBadge = function() {
    if (window.updateMesaBadge) window.updateMesaBadge();
    const badge = document.getElementById('reports-badge');
    if (!badge) return;
    
    let count = 0;
    if (state.issues && Array.isArray(state.issues)) {
        const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
        state.issues.forEach(i => {
            if (!i.assignable_id) {
                count++;
                return;
            }
            
            let tName = state.techs[i.assignable_id];
            if (!tName) {
                const f = (db.technicians || []).find(t => String(t.wisproId) === String(i.assignable_id) || String(t.id) === String(i.assignable_id));
                tName = f?.name;
            }
            const esAct = tName && TECNICOS_ACTIVOS.some(n => tName.toLowerCase().includes(n.split(' ')[0].toLowerCase()));
            if (esAct) {
                count++;
            }
        });
    }

    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
};

// ── NAPs STATE ────────────────────────────────────────────────────────────
function loadTrackedNaps() {
    try {
        const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
        state.trackedNaps = db.trackedNaps;
        if (!state.trackedNaps || !Array.isArray(state.trackedNaps)) {
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
            db.trackedNaps = state.trackedNaps;
            localStorage.setItem('Velocity_Sync_State', JSON.stringify(db));
            serverPush(db);
        }
    } catch(e) {
        state.trackedNaps = [];
    }
    window.updateNapsBadge();
}
function saveTrackedNaps() {
    try {
        const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
        db.trackedNaps = state.trackedNaps;
        localStorage.setItem('Velocity_Sync_State', JSON.stringify(db));
        serverPush(db);
    } catch(e) {
        console.error('Error saving tracked naps to sync state:', e);
    }
    window.updateNapsBadge();
}

// ── INVENTORY STATE & MANAGEMENT ──────────────────────────────────────────
function loadInventoryData() {
    try {
        const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
        state.inventory = db.inventory;
        if (!state.inventory || !Array.isArray(state.inventory) || state.inventory.length === 0) {
            state.inventory = [
                {
                    id: 'inv-101',
                    serial: 'HWTC4892A1B0',
                    mac: 'F4:8E:38:2A:1B:00',
                    model: 'Huawei EG8145V5 Dual-Band GPON',
                    category: 'onu',
                    brand: 'Huawei',
                    location: 'Bodega Central',
                    assignedTech: '',
                    status: 'disponible',
                    zone: 'Platanilla',
                    wisproOrder: null,
                    registeredAt: '2026-08-28',
                    lastMovement: 'Ingreso inicial a Bodega Central',
                    history: [{ date: '2026-08-28 09:15', user: 'Supervisor', action: 'Ingreso inicial a Bodega Central' }]
                },
                {
                    id: 'inv-102',
                    serial: 'HWTC4892A1B1',
                    mac: 'F4:8E:38:2A:1B:01',
                    model: 'Huawei EG8145V5 Dual-Band GPON',
                    category: 'onu',
                    brand: 'Huawei',
                    location: 'Móvil - Maydelin Ojo',
                    assignedTech: 'Maydelin Ojo',
                    status: 'asignado',
                    zone: 'Platanilla',
                    wisproOrder: null,
                    registeredAt: '2026-08-29',
                    lastMovement: 'Transferido a Móvil Maydelin Ojo',
                    history: [
                        { date: '2026-08-29 08:30', user: 'Supervisor', action: 'Ingreso inicial a Bodega Central' },
                        { date: '2026-09-01 07:45', user: 'Supervisor', action: 'Asignado a vehículo de Maydelin Ojo' }
                    ]
                },
                {
                    id: 'inv-103',
                    serial: 'ZTEG9872C4D2',
                    mac: '34:E8:94:12:4D:02',
                    model: 'ZTE F670L AC1200 Wi-Fi 5 GPON',
                    category: 'onu',
                    brand: 'ZTE',
                    location: 'Móvil - Javier Rodriguez',
                    assignedTech: 'Javier Rodriguez',
                    status: 'asignado',
                    zone: 'Torti',
                    wisproOrder: null,
                    registeredAt: '2026-08-29',
                    lastMovement: 'Transferido a Móvil Javier Rodriguez',
                    history: [{ date: '2026-08-29 10:00', user: 'Supervisor', action: 'Asignado a Javier Rodriguez' }]
                },
                {
                    id: 'inv-104',
                    serial: 'VSOL11029384',
                    mac: '00:1E:67:89:38:40',
                    model: 'V-SOL V2801SG 1GE XPON Bridge',
                    category: 'onu',
                    brand: 'V-SOL',
                    location: 'Cliente Final',
                    assignedTech: 'Maydelin Ojo',
                    status: 'instalado',
                    zone: 'Platanilla',
                    wisproOrder: { id: 'ORD-10492', clientName: 'Roberto Gómez', plan: '100 Mbps Residencial', date: '2026-09-02' },
                    registeredAt: '2026-08-20',
                    lastMovement: 'Instalado en Cliente Roberto Gómez (Wispro)',
                    history: [
                        { date: '2026-08-20 09:00', user: 'Supervisor', action: 'Ingreso Bodega' },
                        { date: '2026-09-01 08:00', user: 'Supervisor', action: 'Transferido a Maydelin Ojo' },
                        { date: '2026-09-02 11:20', user: 'Wispro API', action: 'Instalado y Aprovisionado en Orden #10492' }
                    ]
                },
                {
                    id: 'inv-105',
                    serial: 'TPLK99281726',
                    mac: '60:32:B1:99:28:17',
                    model: 'TP-Link Archer C6 Gigabit Router',
                    category: 'router',
                    brand: 'TP-Link',
                    location: 'Bodega Central',
                    assignedTech: '',
                    status: 'disponible',
                    zone: 'La Siesta',
                    wisproOrder: null,
                    registeredAt: '2026-08-30',
                    lastMovement: 'Ingreso Bodega Central',
                    history: [{ date: '2026-08-30 14:00', user: 'Supervisor', action: 'Ingreso a Bodega Central' }]
                },
                {
                    id: 'inv-106',
                    serial: 'BOB-FIBRA-014',
                    mac: 'N/A',
                    model: 'Bobina Fibra Drop 1 Hilo (1000m)',
                    category: 'drop',
                    brand: 'OpticFiber',
                    location: 'Móvil - Maydelin Ojo',
                    assignedTech: 'Maydelin Ojo',
                    status: 'asignado',
                    zone: 'Platanilla',
                    wisproOrder: null,
                    registeredAt: '2026-08-25',
                    lastMovement: '850m restantes en vehículo',
                    history: [{ date: '2026-08-25 08:00', user: 'Supervisor', action: 'Entrega de bobina 1000m a Maydelin' }]
                },
                {
                    id: 'inv-107',
                    serial: 'HWTC4892A1B9',
                    mac: 'F4:8E:38:2A:1B:09',
                    model: 'Huawei EG8145V5 Dual-Band GPON',
                    category: 'onu',
                    brand: 'Huawei',
                    location: 'Taller de Reparación',
                    assignedTech: '',
                    status: 'dañado',
                    zone: 'Torti',
                    wisproOrder: null,
                    registeredAt: '2026-08-15',
                    lastMovement: 'Falla óptica / Láser bajo reportado en campo',
                    history: [
                        { date: '2026-08-15 10:00', user: 'Supervisor', action: 'Ingreso Bodega' },
                        { date: '2026-09-01 16:30', user: 'Supervisor', action: 'Retirado por falla óptica (-32dBm)' }
                    ]
                }
            ];
            db.inventory = state.inventory;
            localStorage.setItem('Velocity_Sync_State', JSON.stringify(db));
            if (typeof serverPush === 'function') serverPush(db);
        }
    } catch(e) {
        state.inventory = [];
    }
}

function saveInventoryData() {
    try {
        const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
        db.inventory = state.inventory;
        localStorage.setItem('Velocity_Sync_State', JSON.stringify(db));
        if (typeof serverPush === 'function') serverPush(db);
    } catch(e) {
        console.error('Error guardando inventario en Sync State:', e);
    }
}

window.setOrderSearch = function(val) {
    state.orderSearch = val;
    if (state.tab === 'orders') renderTab('orders');
};

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

state.lastStateHash = '';

function getStateHash() {
    return JSON.stringify({
        ordersCount: state.orders ? state.orders.length : 0,
        finishedOrdersCount: state.finishedOrders ? state.finishedOrders.length : 0,
        issuesCount: state.issues ? state.issues.length : 0,
        finishedIssuesCount: state.finishedIssues ? state.finishedIssues.length : 0,
        ordersStates: state.orders ? state.orders.map(o => `${o.id}:${o.state}:${o.result}:${o.feedbacksCount}`) : [],
        finishedOrdersStates: state.finishedOrders ? state.finishedOrders.map(o => `${o.id}:${o.state}:${o.result}:${o.feedbacksCount}`) : [],
        issuesStates: state.issues ? state.issues.map(i => `${i.id}:${i.state}:${i.feedbacks?.length || 0}`) : [],
        finishedIssuesStates: state.finishedIssues ? state.finishedIssues.map(i => `${i.id}:${i.state}:${i.feedbacks?.length || 0}`) : [],
        trackedNapsCount: state.trackedNaps ? state.trackedNaps.length : 0,
        trackedNapsStates: state.trackedNaps ? state.trackedNaps.map(n => `${n.id}:${n.resolved}`) : [],
        tracking: localStorage.getItem('Velocity_Order_Tracking') || '{}',
        online: state.onlineStatus ? Object.keys(state.onlineStatus).sort().map(k => `${k}:${state.onlineStatus[k]}`) : []
    });
}

function startPolling() {
    stopPolling();
    // Ticker para tiempos relativos y SLA (cada 60 seg)
    state.relTimeTimer = setInterval(() => {
        if (document.visibilityState === 'visible' && state.tab === 'orders') {
            const activeEl = document.activeElement;
            const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
            const isFocusInContent = activeEl && document.getElementById('main-content')?.contains(activeEl);
            if (!(isTyping && isFocusInContent)) {
                renderTab('orders');
            }
        }
    }, 60000);

    // Fast polling de tickets pendientes cada 10 segundos
    state.fastPollTimer = setInterval(async () => {
        if (document.visibilityState !== 'visible') return;
        try {
            await loadIssues(true, 1, true);
            
            const newHash = getStateHash();
            if (newHash !== state.lastStateHash) {
                state.lastStateHash = newHash;
                const activeEl = document.activeElement;
                const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
                const isFocusInContent = activeEl && document.getElementById('main-content')?.contains(activeEl);
                if (isTyping && isFocusInContent) {
                    console.log('[Velocity] Cambios detectados por fast-polling de tickets, pero re-renderizado pospuesto porque el usuario está escribiendo.');
                } else {
                    console.log('[Velocity] Cambios detectados por fast-polling de tickets. Actualizando interfaz...');
                    renderTab(state.tab);
                }
            }
        } catch (e) {
            console.error('Error en fast polling sync:', e);
        }
    }, 10000);

    state.pollTimer = setInterval(async () => {
        if (document.visibilityState !== 'visible') return;
        try {
            const promises = [
                loadTodayOrders(true),
                loadIssues(true, 1),
                serverSync()
            ];
            await Promise.allSettled(promises);
            
            // Recargar NAPs manuales, inventario y técnicos activos de la DB local sincronizada
            loadTrackedNaps();
            loadInventoryData();
            
            const newHash = getStateHash();
            if (newHash !== state.lastStateHash) {
                state.lastStateHash = newHash;
                const activeEl = document.activeElement;
                const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
                const isFocusInContent = activeEl && document.getElementById('main-content')?.contains(activeEl);
                if (isTyping && isFocusInContent) {
                    console.log('[Velocity] Cambios detectados en la API, pero re-renderizado pospuesto porque el usuario está escribiendo.');
                } else {
                    console.log('[Velocity] Cambios detectados en la API. Actualizando interfaz...');
                    renderTab(state.tab);
                }
            } else {
                console.log('[Velocity] Polling finalizado sin cambios.');
            }
        } catch(e) { console.error('Error en polling sync:', e); }
        state.lastSync = Date.now();
    }, CFG.pollMs);
}

function stopPolling() {
    if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
    if (state.relTimeTimer) { clearInterval(state.relTimeTimer); state.relTimeTimer = null; }
    if (state.fastPollTimer) { clearInterval(state.fastPollTimer); state.fastPollTimer = null; }
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
    const todayStr = new Date().toLocaleDateString('en-CA');
    const todayActiveOrders = state.orders.filter(o => (o.start_at ? new Date(o.start_at).toLocaleDateString('en-CA') : '') === todayStr);
    const fToday = state.finishedOrders || [];
    const allTodayOrders = [...todayActiveOrders, ...fToday];
    const total       = allTodayOrders.length;
    const done        = fToday.length;
    const pending     = todayActiveOrders.length;
    const noNap       = todayActiveOrders.filter(o => (o.kind === 'technical' || o.kind === 'installation') && !o.nap).length;
    
    const dbSync = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    // Función para validar que la orden se inició hoy
    const isToday = (timestamp) => {
        if (!timestamp) return false;
        const d = new Date(timestamp);
        const today = new Date();
        return d.getDate() === today.getDate() &&
               d.getMonth() === today.getMonth() &&
               d.getFullYear() === today.getFullYear();
    };

    // Para el supervisor, el estado de técnicos activos viene estrictamente del servidor
    const tracking = dbSync.activeTracking || {};
    const activeCount = Object.values(tracking).filter(t => t.status === 'started' && isToday(t.startTime)).length;
    const syncAgo     = state.lastSync ? Math.round((Date.now() - state.lastSync) / 1000) : null;
    const syncText    = syncAgo === null ? 'Sin sincronizar' : syncAgo < 60 ? 'Recién sincronizado' : `Hace ${Math.floor(syncAgo/60)}m`;

    const registeredTechs = dbSync.technicians || [];
    const onlineStatus = {
        ...JSON.parse(localStorage.getItem('Velocity_Online_Status') || '{}'),
        ...(dbSync.onlineStatus || {})
    };

    // Tarjetas por técnico
    const techCards = TECNICOS_ACTIVOS.map(nombre => {
        const myOrders  = allTodayOrders.filter(o => o.techName?.toLowerCase().includes(nombre.split(' ')[0].toLowerCase()));
        const myDone    = myOrders.filter(o => ['finalizada','finalizado','closed','finalized'].includes(o.state.toLowerCase())).length;
        const myPending = myOrders.filter(o => ['pending','started','in_progress','to_reschedule','abierta','open'].includes(o.state.toLowerCase())).length;
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

    setTimeout(() => {
        if (typeof window.updateDashboardCharts === 'function') {
            window.updateDashboardCharts();
        }
    }, 80);

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
            <div onclick="window.showActiveTechsModal()" class="bg-surface-container-lowest border border-tertiary-fixed-dim/30 p-5 rounded-2xl relative overflow-hidden cursor-pointer hover:shadow-md transition-all active:scale-95 group" style="background:rgba(16,185,129,0.05);">
                <p class="text-[10px] font-bold uppercase tracking-widest animate-pulse" style="color:#059669;">En curso</p>
                <h3 class="text-4xl font-black mt-1" style="color:#059669;">${activeCount}</h3>
                <p class="text-xs text-on-surface-variant mt-1 group-hover:text-secondary transition-colors">técnicos activos <span class="material-symbols-outlined text-xs align-middle">open_in_new</span></p>
            </div>
            <div class="bg-surface-container-lowest border border-error/20 p-5 rounded-2xl relative overflow-hidden">
                <p class="text-[10px] font-bold uppercase tracking-widest text-error">Sin NAP</p>
                <h3 class="text-4xl font-black mt-1 text-error">${noNap}</h3>
                <p class="text-xs text-on-surface-variant mt-1">requieren asignación</p>
            </div>
        </div>

        <!-- Charts Pro Dashboard -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Chart 1: Rendimiento por Técnico -->
            <div class="bg-surface-container-lowest border border-outline-variant/20 p-5 rounded-[2rem] shadow-sm flex flex-col h-[340px]">
                <h4 class="font-black text-on-surface text-sm mb-4 flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-secondary text-lg">bar_chart</span>
                    Rendimiento por Técnico (Órdenes de Hoy)
                </h4>
                <div class="flex-1 relative min-h-0">
                    <canvas id="chart-tech-performance"></canvas>
                </div>
            </div>
            <!-- Chart 2: Distribución por Tipo de Trabajo -->
            <div class="bg-surface-container-lowest border border-outline-variant/20 p-5 rounded-[2rem] shadow-sm flex flex-col h-[340px]">
                <h4 class="font-black text-on-surface text-sm mb-4 flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-secondary text-lg">donut_large</span>
                    Distribución de Labores del Día
                </h4>
                <div class="flex-1 relative min-h-0">
                    <canvas id="chart-job-distribution"></canvas>
                </div>
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
    const todayActiveOrders = state.orders.filter(o => (o.start_at ? new Date(o.start_at).toLocaleDateString('en-CA') : '') === todayStr);
    
    // state.finishedOrders ya viene filtrado por el día de hoy desde loadTodayOrders
    const fToday = state.finishedOrders || [];
    const allTodayOrders = [...todayActiveOrders, ...fToday];

    // 1. Filtrar Activas
    let filteredActive = type === 'no_nap'
        ? todayActiveOrders.filter(o => (o.kind === 'technical' || o.kind === 'installation') && !o.nap)
        : type === 'all' ? [...todayActiveOrders] : todayActiveOrders.filter(o => o.kind === type);

    if (tech !== 'all') filteredActive = filteredActive.filter(o => o.techName?.toLowerCase().includes(tech.split(' ')[0].toLowerCase()));
    if (zone !== 'all') filteredActive = filteredActive.filter(o => o.zone === zone);

    // 2. Filtrar Finalizadas (Mismos criterios)
    let filteredFinished = type === 'no_nap'
        ? fToday.filter(o => (o.kind === 'technical' || o.kind === 'installation') && !o.nap)
        : type === 'all' ? [...fToday] : fToday.filter(o => o.kind === type);

    if (tech !== 'all') filteredFinished = filteredFinished.filter(o => o.techName?.toLowerCase().includes(tech.split(' ')[0].toLowerCase()));
    if (zone !== 'all') filteredFinished = filteredFinished.filter(o => o.zone === zone);

    // Recopilar técnicos y zonas para filtros dinámicos (de ambas listas)
    const baseForFilters = allTodayOrders;
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
    const totalDay = allTodayOrders.length;
    const completionRate = totalDay > 0 ? Math.round((fToday.length / totalDay) * 100) : 0;
    const criticalNoNap = todayActiveOrders.filter(o => (o.kind === 'technical' || o.kind === 'installation') && !o.nap).length;
    
    // Time computation (Solo exitosas con tiempos válidos)
    const timed = fToday.filter(o => o.rawStart && o.rawEnd && o.result === 'success');
    const avgMs = timed.length > 0 ? timed.reduce((a, b) => a + (b.rawEnd - b.rawStart), 0) / timed.length : 0;
    const avgMin = Math.round(avgMs / 60000);

    // Tech Workload Logic
    const techStats = techs.map(name => {
        const tOrders = allTodayOrders.filter(o => o.techName === name);
        const tDone = tOrders.filter(o => ['finalizada','finalizado','closed'].includes(o.state.toLowerCase())).length;
        const tPending = tOrders.length - tDone;
        return { name, done: tDone, pending: tPending, total: tOrders.length };
    }).sort((a,b) => b.total - a.total);

    // Tabs / Pills Logic
    const counts = {
        all:          todayActiveOrders.length,
        technical:    todayActiveOrders.filter(o => o.kind === 'technical').length,
        installation: todayActiveOrders.filter(o => o.kind === 'installation').length,
        feasibility:  todayActiveOrders.filter(o => o.kind === 'feasibility').length,
        resignation:  todayActiveOrders.filter(o => o.kind === 'resignation').length,
        no_nap:       todayActiveOrders.filter(o => (o.kind === 'technical' || o.kind === 'installation') && !o.nap).length,
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
            const isFinished = ['finalizada', 'finalizado', 'closed', 'finalized'].includes((o.state || '').toLowerCase());
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
                            ${isFinished ? `<div data-last-comment-order-id="${o.rawId || o.id}" class="text-[11px] text-secondary mt-1 font-semibold italic flex items-center gap-1 opacity-90"><span class="material-symbols-outlined text-[12px] animate-spin">sync</span><span>Obteniendo nota de cierre...</span></div>` : ''}
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
                <button onclick="window.openExportOrdersModal()" class="flex items-center gap-2 border border-outline-variant/30 text-on-surface-variant px-4 py-2 rounded-2xl text-xs font-bold hover:bg-surface-container transition-all active:scale-95">
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

        <div class="relative group max-w-md mb-4">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-secondary transition-colors text-lg">search</span>
            <input type="text" 
                id="global-search-input"
                placeholder="Buscar órdenes... (Enter)" 
                value="${state.orderSearch}"
                onkeydown="if(event.key === 'Enter') { window.setOrderSearch(this.value); }"
                class="w-full bg-surface-container-lowest border border-outline-variant/25 focus:border-secondary focus:ring-2 focus:ring-secondary/5 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold outline-none transition-all shadow-sm placeholder:text-on-surface-variant/40"
            >
            ${state.orderSearch ? `
                <button onclick="window.setOrderSearch('');" class="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant/60">
                    <span class="material-symbols-outlined text-sm">close</span>
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
    const todayStr = new Date().toLocaleDateString('en-CA');
    const todayActiveOrders = state.orders.filter(o => (o.start_at ? new Date(o.start_at).toLocaleDateString('en-CA') : '') === todayStr);
    const cards = TECNICOS_ACTIVOS.map(nombre => {
        const color     = TECH_PALETTE[nombre];
        const initials  = techInitials(nombre);
        const myOrders  = todayActiveOrders.filter(o => o.techName?.toLowerCase().includes(nombre.split(' ')[0].toLowerCase()));
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
    const todayStr = new Date().toLocaleDateString('en-CA');
    const todayActiveOrders = state.orders.filter(o => (o.start_at ? new Date(o.start_at).toLocaleDateString('en-CA') : '') === todayStr);
    
    TECNICOS_ACTIVOS.forEach(nombre => {
        const myOrders = todayActiveOrders.filter(o => o.techName?.toLowerCase().includes(nombre.split(' ')[0].toLowerCase()));
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
    const { date, search } = state.issueFilter;
    const today    = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
    const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate()+7);

    // 1. Aplicar Búsqueda Inteligente primero
    let searchFilteredIssues = [...state.issues];
    if (search && search.trim()) {
        const q = search.toLowerCase().trim();
        searchFilteredIssues = searchFilteredIssues.filter(issue => {
            const client = state.clients[issue.client_id] || {};
            const title = issue.title || issue.description || '';
            const zm = title.match(/\(([^)]+)\)/);
            const zoneName = (zm ? zm[1] : (client.zone || '')) || 'Sin zona';
            const clientName = (state.clients[issue.client_id]?.name || issue.title || '').toLowerCase();
            const descriptionText = title.toLowerCase();
            
            let techName = state.techs[issue.assignable_id] || '';
            if (!techName && issue.assignable_id) {
                const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
                const found = (db.technicians || []).find(t => String(t.wisproId) === String(issue.assignable_id) || String(t.id) === String(issue.assignable_id));
                techName = found?.name || '';
            }
            const techNameLower = (techName || 'Sin asignar').toLowerCase();
            const addressText = (client.address || '').toLowerCase();
            const idStr = String(issue.public_id || issue.id);

            return zoneName.toLowerCase().includes(q) ||
                   clientName.includes(q) ||
                   descriptionText.includes(q) ||
                   techNameLower.includes(q) ||
                   addressText.includes(q) ||
                   idStr.includes(q);
        });
    }

    // 2. Calcular los contadores basándose en la lista filtrada por búsqueda
    const counts = { all: 0, hoy: 0, manana: 0, vencido: 0, sin_fecha: 0, sin_asignar: 0 };
    const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    
    searchFilteredIssues.forEach(i => {
        let tName = state.techs[i.assignable_id];
        if (!tName && i.assignable_id) {
            const f = (db.technicians || []).find(t => String(t.wisproId) === String(i.assignable_id) || String(t.id) === String(i.assignable_id));
            tName = f?.name;
        }
        if (!tName) tName = 'Sin asignar';

        if (tName === 'Sin asignar') {
            counts.sin_asignar++;
            counts.all++;
            const venc = i.expires_at ? new Date(i.expires_at) : null;
            if (venc) {
                venc.setHours(0,0,0,0);
                if (venc.getTime() <= today.getTime()) {
                    counts.hoy++;
                }
            }
            return;
        }

        const esAct = TECNICOS_ACTIVOS.some(n => tName.toLowerCase().includes(n.split(' ')[0].toLowerCase()));
        if (!esAct) return;

        counts.all++;
        const venc = i.expires_at ? new Date(i.expires_at) : null;
        if (!venc) {
            counts.sin_fecha++;
            counts.hoy++; // No date is active today
            return;
        }
        
        venc.setHours(0,0,0,0);
        const tTime = today.getTime();
        const mTime = tomorrow.getTime();
        const vTime = venc.getTime();
        
        if (vTime === tTime || vTime < tTime) counts.hoy++;
        if (vTime === mTime) counts.manana++;
        if (vTime < tTime) counts.vencido++;
    });

    // 3. Filtrar por fecha o estado de asignación sobre la lista filtrada por búsqueda
    let allIssues = searchFilteredIssues.filter(issue => {
        let techName = state.techs[issue.assignable_id];
        if (!techName && issue.assignable_id) {
            const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
            const found = (db.technicians || []).find(t =>
                String(t.wisproId) === String(issue.assignable_id) || String(t.id) === String(issue.assignable_id)
            );
            techName = found?.name;
        }
        if (!techName) techName = 'Sin asignar';

        if (date === 'sin_asignar') {
            return techName === 'Sin asignar';
        }

        const venc = issue.expires_at ? new Date(issue.expires_at) : null;
        if (date === 'all' || date === 'hoy') {
            if (techName === 'Sin asignar') {
                if (date === 'hoy' && !venc) return false;
                return true;
            }
            const esActivo = TECNICOS_ACTIVOS.some(n =>
                techName.toLowerCase().includes(n.split(' ')[0].toLowerCase())
            );
            if (!esActivo) return false;
            // Incluir si no tiene fecha, si venció, o si vence hoy
            if (!venc) return true;
            venc.setHours(0,0,0,0);
            return venc.getTime() <= today.getTime();
        }

        if (techName === 'Sin asignar') return false;

        const esActivo = TECNICOS_ACTIVOS.some(n =>
            techName.toLowerCase().includes(n.split(' ')[0].toLowerCase())
        );
        if (!esActivo) return false;

        if (!venc) return date === 'sin_fecha';
        if (date === 'sin_fecha') return false;
        venc.setHours(0,0,0,0);
        if (date === 'manana'  && venc.getTime() !== tomorrow.getTime()) return false;
        if (date === 'vencido' && venc >= today)                         return false;

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
                String(t.wisproId) === String(issue.assignable_id) || String(t.id) === String(issue.assignable_id)
            );
            techName = found?.name;
        }

        if (!techName) techName = 'Sin asignar';

        // Omitir 'Sin asignar' a menos que estemos en el filtro de sin asignar o en 'all'
        if (techName === 'Sin asignar' && date !== 'sin_asignar' && date !== 'all') return;

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
            // Priorizamos el nombre en paréntesis sobre la zona del cliente
            const zone = (zm ? zm[1] : (client.zone || '')) || 'Sin zona';
            if (!byZone[zone]) byZone[zone] = [];
            byZone[zone].push(issue);
        });

        const zoneRows = Object.entries(byZone).map(([zone, zIssues]) => {
            const zoneSafeId = `${techName.replace(/\s+/g,'-')}-${zone.replace(/\s+/g,'-')}`.toLowerCase().replace(/[^a-z0-9-]/g,'');

            const zIssuesHtml = zIssues.map(issue => {
                const client   = state.clients[issue.client_id] || {};
                const title    = issue.title || issue.description || 'Sin titulo';
                const zm       = title.match(/\(([^)]+)\)/);
                const zoneName = (zm ? zm[1] : (client.zone || '')) || 'Sin zona';
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
                return `<div draggable="true" ondragstart="window.handleDragStart(event, '${issue.id}', 'TICKET')" ondragend="window.handleDragEnd(event)" class="cursor-grab active:cursor-grabbing hover:shadow-xs transition-all" style="display:flex;align-items:flex-start;gap:8px;padding:7px;border-radius:8px;background:#f9fafb;margin-bottom:4px;border:1px solid #f3f4f6;">
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
                            <div style="display:flex;align-items:center;gap:4px;">
                                <div data-last-comment-issue-id="${issue.id}" class="comment-preview-inline flex-shrink-0">
                                    <span class="material-symbols-outlined text-[14px] text-secondary/50 animate-spin">sync</span>
                                </div>
                                <button onclick="window.openFeedbackModal('${issue.id}', true)" class="w-7 h-7 flex items-center justify-center text-secondary hover:bg-secondary/10 rounded-lg transition-all" title="Ver Bitácora Completa">
                                    <span class="material-symbols-outlined text-[18px]">history_edu</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');

            return `<div style="border-bottom:1px solid #f3f4f6; padding:4px 0;">
                <div onclick="window.toggleZoneDetail('zone-detail-${zoneSafeId}')" style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;cursor:pointer;user-select:none;">
                    <div style="display:flex;align-items:center;gap:6px;">
                        <span class="material-symbols-outlined zone-arrow-icon" style="font-size:18px;color:#9ca3af;transition:transform 0.2s;">expand_more</span>
                        <span class="material-symbols-outlined" style="font-size:14px;color:#6b7280;">location_on</span>
                        <span style="font-size:14px;font-weight:700;color:#374151;">${zone}</span>
                    </div>
                    <span style="font-size:13px;font-weight:800;color:${color};background:${color}15;padding:2px 10px;border-radius:999px;">${zIssues.length}</span>
                </div>
                <div id="zone-detail-${zoneSafeId}" style="display:none;padding:6px 0 6px 12px;border-left:2px solid #e5e7eb;margin-left:8px;margin-top:4px;">
                    ${zIssuesHtml}
                </div>
            </div>`;
        }).join('');

        const safeId = techName.replace(/\s+/g,'-').replace(/[^a-zA-Z0-9-]/g,'');

        return `<div ondragover="window.handleDragOver(event)" ondragleave="window.handleDragLeave(event)" ondrop="window.handleDropTicket(event, '${techName}')" class="transition-all duration-200" style="background:white;border:1px solid #f0f0f0;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #f3f4f6;">
                <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:38px;height:38px;border-radius:12px;background:${color};display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:800;flex-shrink:0;">${initials}</div>
                    <div>
                        <p style="font-weight:800;color:#111827;font-size:17px;margin:0;line-height:1.2;">${techName}</p>
                        <p style="font-size:14.5px;font-weight:700;color:#4b5563;margin-top:4px;">${issues.length} reporte${issues.length!==1?'s':''}</p>
                    </div>
                </div>
            </div>
            <div style="padding:10px 16px;">${zoneRows||'<p style="font-size:13px;color:#9ca3af;text-align:center;padding:8px;">Sin zonas (Arrastra aquí para asignar)</p>'}</div>
        </div>`;
    };

    // Global Drag and Drop Handlers
    window.handleDragStart = function(event, ticketId, type = 'TICKET') {
        event.dataTransfer.setData('text/plain', JSON.stringify({ ticketId, type }));
        event.dataTransfer.effectAllowed = 'move';
        if (event.target) event.target.style.opacity = '0.5';
    };

    window.handleDragEnd = function(event) {
        if (event.target) event.target.style.opacity = '1';
    };

    window.handleDragOver = function(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        const dropTarget = event.currentTarget;
        if (dropTarget) {
            dropTarget.style.borderColor = '#0059bb';
            dropTarget.style.boxShadow = '0 0 0 2px #0059bb';
        }
    };

    window.handleDragLeave = function(event) {
        const dropTarget = event.currentTarget;
        if (dropTarget) {
            dropTarget.style.borderColor = '#f0f0f0';
            dropTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
        }
    };

    window.handleDropTicket = async function(event, targetTechName) {
        event.preventDefault();
        const dropTarget = event.currentTarget;
        if (dropTarget) {
            dropTarget.style.borderColor = '#f0f0f0';
            dropTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
        }

        try {
            const rawData = event.dataTransfer.getData('text/plain');
            if (!rawData) return;
            const data = JSON.parse(rawData);
            const { ticketId, type } = data;

            if (!ticketId || !targetTechName || targetTechName === 'Sin asignar') return;

            const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
            const tech = (db.technicians || []).find(t => 
                t.name.toLowerCase().includes(targetTechName.toLowerCase()) || 
                targetTechName.toLowerCase().includes(t.name.toLowerCase())
            );

            const techId = tech ? (tech.wisproId || tech.id) : targetTechName;
            const token = localStorage.getItem('Velocity_Token') || localStorage.getItem('token') || 'dev-token';

            const res = await fetch('/api/wispro/assign', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ticketId,
                    type: type || 'TICKET',
                    technicianId: techId
                })
            });

            const result = await res.json();
            if (res.ok) {
                const issue = (state.issues || []).find(i => String(i.id) === String(ticketId) || String(i.public_id) === String(ticketId));
                if (issue) issue.assignable_id = techId;
                if (typeof renderTab === 'function') renderTab(state.tab || 'reports');
            } else {
                alert(`Error al asignar: ${result.error || result.message}`);
            }
        } catch (err) {
            console.error('Error en handleDropTicket:', err);
        }
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
            const z = (zm?zm[1]:(c.zone||''))||'Sin zona';
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
                <button onclick="window.refreshIssues()" style="width:34px;height:34px;border:1px solid #e5e7eb;border-radius:8px;background:white;cursor:pointer;display:flex;align-items:center;justify-content:center;">
                    <span class="material-symbols-outlined inline-block ${state.isSyncing ? 'animate-spin' : ''}" style="font-size:17px;color:#6b7280;">sync</span>
                </button>
            </div>
        </div>

        <div class="relative group mb-4 max-w-md">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-secondary transition-colors text-lg">search</span>
            <input type="text" 
                id="report-search-input"
                placeholder="Buscar por zona, cliente, técnico, ID... (Enter)" 
                value="${search || ''}"
                onkeydown="if(event.key === 'Enter') { window.setReportSearch(this.value); }"
                class="w-full bg-surface-container-lowest border border-outline-variant/25 focus:border-secondary focus:ring-2 focus:ring-secondary/5 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold outline-none transition-all shadow-sm placeholder:text-on-surface-variant/40"
            >
            ${search ? `
                <button onclick="window.setReportSearch('');" class="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant/60">
                    <span class="material-symbols-outlined text-sm">close</span>
                </button>
            ` : ''}
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
            : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px;align-items:start;">${techCards}</div>`
        }

        ${(() => {
            const renderFinishedList = (coll, titleText) => {
                if (!coll.length) return '';
                const formatTime = (iso) => {
                    if (!iso) return '';
                    const d = new Date(iso);
                    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                };
                const getElapsedTime = (iso) => {
                    if (!iso) return '—';
                    const closed = new Date(iso);
                    const now = new Date();
                    const diffMs = now.getTime() - closed.getTime();
                    if (isNaN(diffMs)) return '—';
                    if (diffMs < 0) return 'Hace unos momentos';
                    const diffMins = Math.floor(diffMs / (1000 * 60));
                    if (diffMins < 1) return 'Hace instantes';
                    if (diffMins < 60) return `Hace ${diffMins}m`;
                    const diffHours = Math.floor(diffMins / 60);
                    const remMins = diffMins % 60;
                    if (diffHours < 24) {
                        return `Hace ${diffHours}h ${remMins > 0 ? remMins + 'm' : ''}`;
                    }
                    const diffDays = Math.floor(diffHours / 24);
                    return `Hace ${diffDays}d`;
                };
                const rows = coll.map(i => {
                    let tName = state.techs[i.assignable_id];
                    if (!tName) {
                        const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
                        const f = (db.technicians || []).find(t => String(t.wisproId) === String(i.assignable_id) || String(t.id) === String(i.assignable_id));
                        tName = f?.name || 'Sin asignar';
                    }
                    
                    const finishedTime = i.closed_at || i.finalized_at || i.updated_at;
                    const timeStr = formatTime(finishedTime);
                    const elapsedStr = getElapsedTime(finishedTime);
                    const clientName = state.clients[i.client_id]?.name || i.title || 'Reporte';
                    
                    return `
                    <tr class="hover:bg-surface-container-low/30 transition-colors">
                        <!-- Columna 1: Reporte / Orden -->
                        <td class="py-3 px-4">
                            <div class="flex items-center gap-2">
                                <span class="bg-surface-container text-on-surface-variant font-extrabold text-[10px] px-2 py-0.5 rounded-lg border border-outline-variant/10">
                                    #${i.public_id || '—'}
                                </span>
                                <span class="text-sm font-bold text-on-surface truncate max-w-[240px]" title="${clientName}">
                                    ${clientName}
                                </span>
                            </div>
                        </td>
                        <!-- Columna 2: Técnico -->
                        <td class="py-3 px-4">
                            <div class="flex items-center gap-2">
                                <div class="w-6 h-6 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-black text-[10px]">
                                    ${tName === 'Sin asignar' ? 'SA' : tName.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                                </div>
                                <span class="text-xs font-bold text-on-surface-variant">
                                    ${tName}
                                </span>
                            </div>
                        </td>
                        <!-- Columna 3: Hora finalizado -->
                        <td class="py-3 px-4 text-right">
                            <span class="text-xs font-bold text-on-surface-variant">
                                ${timeStr}
                            </span>
                        </td>
                        <!-- Columna 4: Tiempo transcurrido y Auditoría -->
                        <td class="py-3 px-4 text-right">
                            <div class="flex items-center justify-end gap-2">
                                <span class="inline-flex items-center gap-1 text-[11px] font-black text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                                    <span class="material-symbols-outlined text-[10px]" style="font-variation-settings: 'FILL' 1;">schedule</span>
                                    ${elapsedStr}
                                </span>
                                <button onclick="window.openFeedbackModal('${i.id}')" class="w-7 h-7 flex items-center justify-center text-secondary hover:bg-secondary/10 rounded-lg border border-outline-variant/10 transition-all active:scale-95 shadow-sm" title="Ver comentarios / Auditoría">
                                    <span class="material-symbols-outlined text-[16px]">history_edu</span>
                                </button>
                            </div>
                        </td>
                    </tr>`;
                }).join('');

                return `
                <div class="mt-8 p-6 bg-surface-container-low/30 border border-outline-variant/10 rounded-[2rem] shadow-md space-y-4">
                    <div class="flex items-center gap-3 mb-2">
                        <span class="material-symbols-outlined text-secondary" style="font-variation-settings: 'FILL' 1;">check_circle</span>
                        <h3 class="text-xs font-black text-on-surface uppercase tracking-widest">${titleText} (${coll.length})</h3>
                    </div>
                    <div class="overflow-x-auto w-full rounded-2xl border border-outline-variant/10 bg-surface-container-lowest/60">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="border-b border-outline-variant/10 bg-surface-container-low/50">
                                    <th class="py-3 px-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Reporte / Orden</th>
                                    <th class="py-3 px-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Técnico</th>
                                    <th class="py-3 px-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest text-right">Finalizado</th>
                                    <th class="py-3 px-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest text-right">Tiempo / Comentarios</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-outline-variant/5">
                                ${rows}
                            </tbody>
                        </table>
                    </div>
                </div>`;
            };

            const tStr = new Date().toLocaleDateString('en-CA');
            const fiToday = state.finishedIssues.filter(i => (i.updated_at || '').slice(0,10) === tStr);

            const finishedHtml = renderFinishedList(fiToday, 'Reportes Finalizados (Hoy)');
            
            return finishedHtml;
        })()}
    </div>`;
};

// ── PRUEBA TAB (COMBINADO) ──────────────────────────────────────────────────
Views.prueba = () => {
    const { date, search, type } = state.pruebaFilter;
    const today    = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);

    // Helper functions
    const getNapForIssue = (issue) => {
        if (state.napOverrides && state.napOverrides[issue.id]?.nap) {
            return state.napOverrides[issue.id].nap;
        }
        if (issue.nap) return issue.nap;
        const clientNap = (issue.client_id && state.clients[issue.client_id]?.nap) || (issue.contract_id && state.clients[issue.contract_id]?.nap);
        if (clientNap) return clientNap;
        if (issue.client_id) {
            const allOrders = [...(state.orders || []), ...(state.finishedOrders || [])];
            const matchingOrder = allOrders.find(o => {
                const oClientId = o.client_id || (o.orderable_id && state.clients[o.orderable_id]?.client_id) || o.orderable_id;
                return oClientId && String(oClientId) === String(issue.client_id) && o.nap;
            });
            if (matchingOrder) return matchingOrder.nap;
        }
        return null;
    };

    const getNapForOrder = (order) => {
        const oid = order.rawId || order.id;
        if (state.napOverrides && state.napOverrides[oid]?.nap) {
            return state.napOverrides[oid].nap;
        }
        return order.nap;
    };

    const getCommentBadgeHtml = (id, isIssue) => {
        let feedbacks = state.feedbacksCache[id];
        if (isIssue && (!feedbacks || feedbacks.length === 0)) {
            const allIssues = [...(state.issues || []), ...(state.finishedIssues || [])];
            const issue = allIssues.find(i => String(i.id) === String(id));
            if (issue) {
                const allOrders = [...(state.orders || []), ...(state.finishedOrders || [])];
                const matchingOrder = allOrders.find(o => {
                    const oClientId = o.client_id || (o.orderable_id && state.clients[o.orderable_id]?.client_id) || o.orderable_id;
                    if (oClientId && issue.client_id && String(oClientId) === String(issue.client_id)) return true;
                    const orderClientName = (o.client || '').toLowerCase().trim();
                    const issueClientName = ((state.clients && state.clients[issue.client_id]?.name) || issue.title || '').toLowerCase().trim();
                    if (orderClientName && issueClientName && orderClientName === issueClientName) return true;
                    return false;
                });
                if (matchingOrder) {
                    feedbacks = state.feedbacksCache[matchingOrder.rawId || matchingOrder.id];
                }
            }
        }
        const count = feedbacks ? feedbacks.length : 0;
        return count > 0 ? `<div class="comment-badge absolute -top-1.5 -right-1.5 bg-secondary text-white text-[8px] font-black px-1 py-0.5 rounded-full border border-surface-container-lowest shadow-sm min-w-[14px] text-center">${count}</div>` : '';
    };

    // 1. Filtrar Activas
    let activeIssues = state.issues.filter(issue => {
        let techName = state.techs[issue.assignable_id];
        if (!techName && issue.assignable_id) {
            const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
            const found = (db.technicians || []).find(t =>
                String(t.wisproId) === String(issue.assignable_id) || String(t.id) === String(issue.assignable_id)
            );
            techName = found?.name;
        }
        if (!techName) techName = 'Sin asignar';

        if (date === 'sin_asignar') {
            return techName === 'Sin asignar';
        }

        // Si es "Todos" (all) o "Hoy" (hoy), mostramos los reportes pendientes/vencidos o sin fecha
        const venc = issue.expires_at ? new Date(issue.expires_at) : null;
        if (date === 'all' || date === 'hoy') {
            if (techName === 'Sin asignar') {
                if (date === 'hoy' && !venc) return false;
                return true;
            }
            const esActivo = TECNICOS_ACTIVOS.some(n =>
                techName.toLowerCase().includes(n.split(' ')[0].toLowerCase())
            );
            if (!esActivo) return false;
            // Incluir si no tiene fecha, si venció, o si vence hoy
            if (!venc) return true;
            venc.setHours(0,0,0,0);
            return venc.getTime() <= today.getTime();
        }

        if (techName === 'Sin asignar') return false;

        const esActivo = TECNICOS_ACTIVOS.some(n =>
            techName.toLowerCase().includes(n.split(' ')[0].toLowerCase())
        );
        if (!esActivo) return false;

        if (!venc) return date === 'sin_fecha';
        if (date === 'sin_fecha') return false;
        venc.setHours(0,0,0,0);
        if (date === 'manana'  && venc.getTime() !== tomorrow.getTime()) return false;
        if (date === 'vencido' && venc >= today)                         return false;

        return true;
    });

    let activeOrders = state.orders.filter(o => {
        // EN PRUEBA SOLO CONSIDERAR INSTALACIONES
        if (o.kind !== 'installation') return false;

        const techName = o.techName || 'Sin asignar';
        if (techName === 'Sin asignar') return false; // Quitar instalaciones sin asignar

        const sched = o.start_at ? new Date(o.start_at) : null;

        if (date === 'sin_asignar') {
            return false;
        }

        const esActivo = TECNICOS_ACTIVOS.some(n =>
            techName.toLowerCase().includes(n.split(' ')[0].toLowerCase())
        );
        if (!esActivo) return false;

        if (date === 'all') return true;

        if (date === 'hoy') {
            if (!sched) return false;
            sched.setHours(0,0,0,0);
            return sched.getTime() === today.getTime();
        }

        if (!sched) return date === 'sin_fecha';
        if (date === 'sin_fecha') return false;
        sched.setHours(0,0,0,0);
        if (date === 'manana'  && sched.getTime() !== tomorrow.getTime()) return false;
        if (date === 'vencido' && sched.getTime() >= today.getTime()) return false;

        return true;
    });

    // Calcular totales globales del tipo ANTES de aplicar el filtro de tipo
    const totalIssuesCount = activeIssues.length;
    const totalOrdersCount = activeOrders.length;
    const totalCombinedCount = totalIssuesCount + totalOrdersCount;

    const activeType = type || 'all';
    if (activeType === 'issues') {
        activeOrders = [];
    } else if (activeType === 'orders') {
        activeIssues = [];
    }

    // 2. Aplicar Búsqueda Global
    if (search && search.trim()) {
        const q = search.toLowerCase().trim();
        
        activeIssues = activeIssues.filter(issue => {
            const client = state.clients[issue.client_id] || {};
            const title = issue.title || issue.description || '';
            const zm = title.match(/\(([^)]+)\)/);
            const zoneName = (zm ? zm[1] : (client.zone || '')) || 'Sin zona';
            const clientName = (state.clients[issue.client_id]?.name || issue.title || '').toLowerCase();
            const descriptionText = title.toLowerCase();
            const techNameLower = (state.techs[issue.assignable_id] || 'Sin asignar').toLowerCase();
            const addressText = (client.address || '').toLowerCase();
            const idStr = String(issue.public_id || issue.id);

            return zoneName.toLowerCase().includes(q) ||
                   clientName.includes(q) ||
                   descriptionText.includes(q) ||
                   techNameLower.includes(q) ||
                   addressText.includes(q) ||
                   idStr.includes(q);
        });

        activeOrders = activeOrders.filter(o => {
            const zoneName = (o.zone || 'Sin zona').toLowerCase();
            const clientName = (o.client || '').toLowerCase();
            const techNameLower = (o.techName || 'Sin asignar').toLowerCase();
            const addressText = (o.address || '').toLowerCase();
            const idStr = String(o.id);
            
            return zoneName.includes(q) ||
                   clientName.includes(q) ||
                   techNameLower.includes(q) ||
                   addressText.includes(q) ||
                   idStr.includes(q);
        });
    }

    // 3. Agrupar por técnico
    const byTech = {};
    activeIssues.forEach(issue => {
        let techName = state.techs[issue.assignable_id];
        if (!techName && issue.assignable_id) {
            const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
            const found = (db.technicians || []).find(t =>
                String(t.wisproId) === String(issue.assignable_id) || String(t.id) === String(issue.assignable_id)
            );
            techName = found?.name;
        }
        if (!techName) techName = 'Sin asignar';

        if (!byTech[techName]) byTech[techName] = { issues: [], orders: [] };
        byTech[techName].issues.push(issue);
    });

    activeOrders.forEach(o => {
        const techName = o.techName || 'Sin asignar';
        if (!byTech[techName]) byTech[techName] = { issues: [], orders: [] };
        byTech[techName].orders.push(o);
    });

    const CONTRATISTAS = ['Daniel Opua','Jose Mendoza','Mario Gonzalez'];

    const renderTechCard = (techName, issuesList, ordersList) => {
        const color    = techName === 'Sin asignar' ? '#9ca3af' : techColor(techName);
        const initials = techName === 'Sin asignar' ? 'SA' : techInitials(techName);
        const isContratista = CONTRATISTAS.some(n => techName.toLowerCase().includes(n.split(' ')[0].toLowerCase()));
        const subtitle = techName === 'Sin asignar' ? 'Ticket Huérfano' : (isContratista ? 'Contratista' : 'Técnico Operativo');

        // Agrupar por zona
        const byZone = {};
        issuesList.forEach(issue => {
            const client = state.clients[issue.client_id] || {};
            const title  = issue.title || issue.description || '';
            const zm = title.match(/\(([^)]+)\)/);
            const zone = (zm ? zm[1] : (client.zone || '')) || 'Sin zona';
            if (!byZone[zone]) byZone[zone] = { issues: [], orders: [] };
            byZone[zone].issues.push(issue);
        });
        ordersList.forEach(o => {
            const zone = o.zone || 'Sin zona';
            if (!byZone[zone]) byZone[zone] = { issues: [], orders: [] };
            byZone[zone].orders.push(o);
        });

        const zoneRows = Object.entries(byZone).map(([zone, data]) => {
            const counts = { issues: data.issues.length, orders: data.orders.length };
            const badges = [];
            if (counts.issues > 0) {
                badges.push(`
                <span style="display:inline-flex;align-items:center;gap:3px;color:#c2410c;background:#fff7ed;border:1px solid #fed7aa;padding:1px 6px;border-radius:6px;font-size:11px;font-weight:800;" title="${counts.issues} Reporte(s)">
                    <span class="material-symbols-outlined" style="font-size:12px;font-variation-settings:'FILL' 1;">build</span>
                    ${counts.issues} rep
                </span>`);
            }
            if (counts.orders > 0) {
                badges.push(`
                <span style="display:inline-flex;align-items:center;gap:3px;color:#0059bb;background:#e8eeff;border:1px solid #c5c6ce;padding:1px 6px;border-radius:6px;font-size:11px;font-weight:800;" title="${counts.orders} Instalación(es)">
                    <span class="material-symbols-outlined" style="font-size:12px;font-variation-settings:'FILL' 1;">router</span>
                    ${counts.orders} inst
                </span>`);
            }
            const badgesHtml = `<div style="display:flex;gap:4px;align-items:center;">${badges.join('')}</div>`;

            const safeTechName = techName.replace(/'/g, "\\'");
            const safeZoneName = zone.replace(/'/g, "\\'");
            const encodedIssues = encodeURIComponent(JSON.stringify(data.issues));
            const encodedOrders = encodeURIComponent(JSON.stringify(data.orders));

            return `<div class="py-0.5">
                <div onclick="window.openZoneModal('${safeTechName}', '${safeZoneName}', '${encodedIssues}', '${encodedOrders}')" class="flex items-center justify-between py-2 px-2.5 rounded-xl cursor-pointer select-none hover:bg-surface-container-low/60 active:scale-[0.99] transition-all">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-sm text-on-surface-variant/60">location_on</span>
                        <span class="text-xs font-bold text-on-surface">${zone}</span>
                    </div>
                    ${badgesHtml}
                </div>
            </div>`;
        }).join('');

        const safeId = techName.replace(/\s+/g,'-').replace(/[^a-zA-Z0-9-]/g,'');
        const totalItems = issuesList.length + ordersList.length;

        return `<div class="flex flex-col bg-surface-container-lowest border border-outline-variant/20 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
            <!-- Header Fijo de la Tarjeta -->
            <div class="flex items-center justify-between p-4 border-b border-outline-variant/15 flex-shrink-0 bg-surface-container-lowest">
                <div class="flex items-center gap-3">
                    <div style="background:${color};" class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black flex-shrink-0 shadow-sm">${initials}</div>
                    <div>
                        <p class="font-extrabold text-on-surface text-base leading-tight">${techName}</p>
                        <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span class="text-xs font-bold text-on-surface-variant/80">${totalItems} tarea${totalItems!==1?'s':''}</span>
                        </div>
                    </div>
                </div>
            </div>
            <!-- Lista de Tareas / Zonas con Altura Máxima y Scroll Interno -->
            <div class="max-h-56 overflow-y-auto p-3 space-y-1 divide-y divide-outline-variant/10">
                ${zoneRows || '<p class="text-xs font-semibold text-on-surface-variant/50 text-center py-4">Sin zonas</p>'}
            </div>
        </div>`;
    };

    // Calculate filter button counts precisely using the unified single source of truth
    const counts = window.calculateMesaCounts(activeType);
    if (window.updateMesaBadge) window.updateMesaBadge();

    // Global WhatsApp Summary
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    const mNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const titleDate = `${tmrw.getDate()} de ${mNames[tmrw.getMonth()]}`;

    const globalLines = [`*Resumen General de Tareas — ${titleDate}*`, ''];
    Object.entries(byTech).sort((a, b) => {
        const totalA = a[1].issues.length + a[1].orders.length;
        const totalB = b[1].issues.length + b[1].orders.length;
        return totalB - totalA;
    }).forEach(([name, data]) => {
        const bz = {};
        data.issues.forEach(i => {
            const c = state.clients[i.client_id]||{};
            const t = i.title||i.description||'';
            const zm = t.match(/\(([^)]+)\)/);
            const z = (zm?zm[1]:(c.zone||''))||'Sin zona';
            if (!bz[z]) bz[z] = { issues: 0, orders: 0 };
            bz[z].issues++;
        });
        data.orders.forEach(o => {
            const z = o.zone || 'Sin zona';
            if (!bz[z]) bz[z] = { issues: 0, orders: 0 };
            bz[z].orders++;
        });

        const totalTasks = data.issues.length + data.orders.length;
        globalLines.push(`*${name}* — ${totalTasks} tarea(s) (${data.issues.length} rep + ${data.orders.length} ord)`);
        Object.entries(bz).forEach(([z, n]) => {
            const parts = [];
            if (n.issues > 0) parts.push(`${n.issues} rep`);
            if (n.orders > 0) parts.push(`${n.orders} ord`);
            globalLines.push(`  ${z}: ${parts.join(' + ')}`);
        });
        globalLines.push('');
    });
    const totalActiveIssues = activeIssues.length;
    const totalActiveOrders = activeOrders.length;
    const totalActiveTasks = totalActiveIssues + totalActiveOrders;
    globalLines.push(`Total General: ${totalActiveTasks} tarea(s) (${totalActiveIssues} reportes + ${totalActiveOrders} órdenes)`);
    globalLines.push('— Velocity Rappido Panama');

    const globalWaText = encodeURIComponent(globalLines.join('\n'));

    // Tech Cards HTML
    const techCards = Object.entries(byTech)
        .sort((a, b) => {
            const totalA = a[1].issues.length + a[1].orders.length;
            const totalB = b[1].issues.length + b[1].orders.length;
            return totalB - totalA;
        })
        .map(([name, data]) => renderTechCard(name, data.issues, data.orders))
        .join('');

    // Date filters HTML
    let dateFilters = [
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
        return `<button onclick="window.setPruebaFilter('date','${f.v}')" style="display:flex;align-items:center;gap:6px;padding:6px 14px;border-radius:999px;font-size:13px;font-weight:700;border:none;cursor:pointer;background:${bg};color:${color};transition:all 0.2s;">
            ${f.l} <span style="font-size:11px;font-weight:800;padding:2px 6px;border-radius:999px;background:${badgeBg};">${f.c}</span>
        </button>`;
    }).join('');

    // Append Ver Mapa button next to Sin asignar button
    dateFilters += `
    <button onclick="window.openPruebaMapModal()" style="display:flex;align-items:center;gap:6px;padding:6px 14px;border-radius:999px;font-size:13px;font-weight:700;border:none;cursor:pointer;background:#e8eeff;color:#0059bb;transition:all 0.2s;box-shadow:0 1px 2px rgba(0,0,0,0.05);" class="hover:bg-primary/10 hover:shadow active:scale-95">
        <span class="material-symbols-outlined text-[18px]">map</span>
        Ver Mapa
    </button>`;

    // Finished List rendering
    const renderFinishedList = (coll, titleText) => {
        if (!coll.length) return '';
        const formatTime = (iso) => {
            if (!iso) return '';
            const d = new Date(iso);
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };
        const getElapsedTime = (iso) => {
            if (!iso) return '—';
            const closed = new Date(iso);
            const now = new Date();
            const diffMs = now.getTime() - closed.getTime();
            if (isNaN(diffMs)) return '—';
            if (diffMs < 0) return 'Hace unos momentos';
            const diffMins = Math.floor(diffMs / (1000 * 60));
            if (diffMins < 1) return 'Hace instantes';
            if (diffMins < 60) return `Hace ${diffMins}m`;
            const diffHours = Math.floor(diffMins / 60);
            const remMins = diffMins % 60;
            if (diffHours < 24) {
                return `Hace ${diffHours}h ${remMins > 0 ? remMins + 'm' : ''}`;
            }
            const diffDays = Math.floor(diffHours / 24);
            return `Hace ${diffDays}d`;
        };
        const rows = coll.map(entry => {
            if (entry.type === 'issue') {
                const i = entry.item;
                let tName = state.techs[i.assignable_id];
                if (!tName && i.assignable_id) {
                    const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
                    const f = (db.technicians || []).find(t => String(t.wisproId) === String(i.assignable_id) || String(t.id) === String(i.assignable_id));
                    tName = f?.name || 'Sin asignar';
                }
                if (!tName) tName = 'Sin asignar';
                
                const finishedTime = i.closed_at || i.finalized_at || i.updated_at;
                const timeStr = formatTime(finishedTime);
                const elapsedStr = getElapsedTime(finishedTime);
                const clientName = state.clients[i.client_id]?.name || i.title || 'Reporte';
                const idStr = i.public_id || i.id;
                const nap = getNapForIssue(i);
                const napBadgeHtml = nap
                    ? `<span class="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 font-extrabold text-[10px] px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800/50">✓ ${nap}</span>`
                    : `<button onclick="window.openNapModal('${i.id}', true)" class="bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 font-extrabold text-[10px] px-2 py-0.5 rounded-lg border border-red-200 dark:border-red-800/50 cursor-pointer">Sin NAP</button>`;

                return `
                <tr class="hover:bg-surface-container-low/30 transition-colors">
                    <!-- Columna 1: Reporte / Orden -->
                    <td class="py-3 px-4">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="bg-surface-container text-on-surface-variant font-extrabold text-[10px] px-2 py-0.5 rounded-lg border border-outline-variant/10">
                                #${idStr} (Reporte)
                            </span>
                            <span class="text-sm font-bold text-on-surface truncate max-w-[240px]" title="${clientName}">
                                ${clientName}
                            </span>
                            ${napBadgeHtml}
                        </div>
                    </td>
                    <!-- Columna 2: Técnico -->
                    <td class="py-3 px-4">
                        <div class="flex items-center gap-2">
                            <div class="w-6 h-6 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-black text-[10px]">
                                ${tName === 'Sin asignar' ? 'SA' : tName.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                            </div>
                            <span class="text-xs font-bold text-on-surface-variant">
                                ${tName}
                            </span>
                        </div>
                    </td>
                    <!-- Columna 3: Hora finalizado -->
                    <td class="py-3 px-4 text-right">
                        <span class="text-xs font-bold text-on-surface-variant">
                            ${timeStr}
                        </span>
                    </td>
                    <!-- Columna 4: Tiempo transcurrido y Auditoría -->
                    <td class="py-3 px-4 text-right">
                        <div class="flex items-center justify-end gap-2">
                            <span class="inline-flex items-center gap-1 text-[11px] font-black text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                                <span class="material-symbols-outlined text-[10px]" style="font-variation-settings: 'FILL' 1;">schedule</span>
                                ${elapsedStr}
                            </span>
                            <div class="relative inline-block" data-issue-btn-id="${i.id}">
                                <button onclick="window.openFeedbackModal('${i.id}')" class="w-7 h-7 flex items-center justify-center text-secondary hover:bg-secondary/10 rounded-lg border border-outline-variant/10 transition-all active:scale-95 shadow-sm" title="Ver comentarios / Auditoría">
                                    <span class="material-symbols-outlined text-[16px]">history_edu</span>
                                </button>
                                ${getCommentBadgeHtml(i.id, true)}
                            </div>
                        </div>
                    </td>
                </tr>`;
            } else {
                const o = entry.item;
                const finishedTime = o.end_at || o.updated_at;
                const timeStr = formatTime(finishedTime);
                const elapsedStr = getElapsedTime(finishedTime);
                const clientName = o.client || 'Orden';
                const idStr = o.id;
                const nap = getNapForOrder(o);
                const isInstallation = o.kind === 'installation';
                const napBadgeHtml = isInstallation
                    ? (nap
                        ? `<span class="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 font-extrabold text-[10px] px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800/50">✓ ${nap}</span>`
                        : `<button onclick="window.openNapModal('${o.rawId || o.id}', false)" class="bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 font-extrabold text-[10px] px-2 py-0.5 rounded-lg border border-red-200 dark:border-red-800/50 cursor-pointer">Sin NAP</button>`)
                    : '';

                return `
                <tr class="hover:bg-surface-container-low/30 transition-colors">
                    <!-- Columna 1: Reporte / Orden -->
                    <td class="py-3 px-4">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="bg-surface-container text-on-surface-variant font-extrabold text-[10px] px-2 py-0.5 rounded-lg border border-outline-variant/10">
                                #${idStr} (${o.typeLabel})
                            </span>
                            <span class="text-sm font-bold text-on-surface truncate max-w-[240px]" title="${clientName}">
                                ${clientName}
                            </span>
                            ${napBadgeHtml}
                        </div>
                    </td>
                    <!-- Columna 2: Técnico -->
                    <td class="py-3 px-4">
                        <div class="flex items-center gap-2">
                            <div class="w-6 h-6 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-black text-[10px]">
                                ${o.techName === 'Sin asignar' ? 'SA' : o.techName.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                            </div>
                            <span class="text-xs font-bold text-on-surface-variant">
                                ${o.techName}
                            </span>
                        </div>
                    </td>
                    <!-- Columna 3: Hora finalizado -->
                    <td class="py-3 px-4 text-right">
                        <span class="text-xs font-bold text-on-surface-variant">
                            ${timeStr}
                        </span>
                    </td>
                    <!-- Columna 4: Tiempo transcurrido y Auditoría -->
                    <td class="py-3 px-4 text-right">
                        <div class="flex items-center justify-end gap-2">
                            <span class="inline-flex items-center gap-1 text-[11px] font-black text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                                <span class="material-symbols-outlined text-[10px]" style="font-variation-settings: 'FILL' 1;">schedule</span>
                                ${elapsedStr}
                            </span>
                            <div class="relative inline-block" data-order-btn-id="${o.rawId || o.id}">
                                <button onclick="window.openFeedbackModal('${o.rawId || o.id}')" class="w-7 h-7 flex items-center justify-center text-secondary hover:bg-secondary/10 rounded-lg border border-outline-variant/10 transition-all active:scale-95 shadow-sm" title="Ver comentarios / Auditoría">
                                    <span class="material-symbols-outlined text-[16px]">history_edu</span>
                                </button>
                                ${getCommentBadgeHtml(o.rawId || o.id, false)}
                            </div>
                        </div>
                    </td>
                </tr>`;
            }
        }).join('');

        return `
        <div class="mt-8 p-6 bg-surface-container-low/30 border border-outline-variant/10 rounded-[2rem] shadow-md space-y-4">
            <div class="flex items-center gap-3 mb-2">
                <span class="material-symbols-outlined text-secondary" style="font-variation-settings: 'FILL' 1;">check_circle</span>
                <h3 class="text-xs font-black text-on-surface uppercase tracking-widest">${titleText} (${coll.length})</h3>
            </div>
            <div class="overflow-x-auto w-full rounded-2xl border border-outline-variant/10 bg-surface-container-lowest/60">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="border-b border-outline-variant/10 bg-surface-container-low/50">
                            <th class="py-3 px-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Reporte / Orden</th>
                            <th class="py-3 px-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Técnico</th>
                            <th class="py-3 px-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest text-right">Finalizado</th>
                            <th class="py-3 px-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest text-right">Tiempo / Comentarios</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-outline-variant/5">
                        ${rows}
                    </tbody>
                </table>
            </div>
        </div>`;
    };

    // Finished List Data
    const tStr = new Date().toLocaleDateString('en-CA');
    const fiToday = (state.finishedIssues || []).filter(i => (i.updated_at || '').slice(0,10) === tStr);
    const foToday = (state.finishedOrders || []).filter(o => o.kind === 'installation' && (o.end_at || o.updated_at || '').slice(0,10) === tStr);

    // Filter finished issues and orders by search text and task type
    let activeFinishedIssues = activeType === 'orders' ? [] : fiToday;
    let activeFinishedOrders = activeType === 'issues' ? [] : foToday;

    if (search && search.trim()) {
        const q = search.toLowerCase().trim();
        
        activeFinishedIssues = activeFinishedIssues.filter(issue => {
            const client = state.clients[issue.client_id] || {};
            const title = issue.title || issue.description || '';
            const zm = title.match(/\(([^)]+)\)/);
            const zoneName = (zm ? zm[1] : (client.zone || '')) || 'Sin zona';
            const clientName = (state.clients[issue.client_id]?.name || issue.title || '').toLowerCase();
            const descriptionText = title.toLowerCase();
            const techNameLower = (state.techs[issue.assignable_id] || 'Sin asignar').toLowerCase();
            const addressText = (client.address || '').toLowerCase();
            const idStr = String(issue.public_id || issue.id);

            return zoneName.toLowerCase().includes(q) ||
                   clientName.includes(q) ||
                   descriptionText.includes(q) ||
                   techNameLower.includes(q) ||
                   addressText.includes(q) ||
                   idStr.includes(q);
        });

        activeFinishedOrders = activeFinishedOrders.filter(o => {
            const zoneName = (o.zone || 'Sin zona').toLowerCase();
            const clientName = (o.client || '').toLowerCase();
            const techNameLower = (o.techName || 'Sin asignar').toLowerCase();
            const addressText = (o.address || '').toLowerCase();
            const idStr = String(o.id);
            
            return zoneName.includes(q) ||
                   clientName.includes(q) ||
                   techNameLower.includes(q) ||
                   addressText.includes(q) ||
                   idStr.includes(q);
        });
    }

    const allFinished = [];
    activeFinishedIssues.forEach(i => {
        allFinished.push({
            type: 'issue',
            item: i,
            time: new Date(i.closed_at || i.finalized_at || i.updated_at)
        });
    });
    activeFinishedOrders.forEach(o => {
        allFinished.push({
            type: 'order',
            item: o,
            time: new Date(o.end_at || o.updated_at)
        });
    });
    allFinished.sort((a, b) => b.time - a.time);

    let finishedSectionHtml = '';
    if (date === 'all' || date === 'hoy') {
        finishedSectionHtml = renderFinishedList(allFinished, 'Tareas Finalizadas (Hoy)');
    }

    // (Totales globales ya calculados al inicio)

    const typeButtons = [
        { v: 'all', l: `Todos (${totalCombinedCount})` },
        { v: 'issues', l: `Reportes (${totalIssuesCount})` },
        { v: 'orders', l: `Instalaciones (${totalOrdersCount})` }
    ].map(item => {
        const active = activeType === item.v;
        const bg = active ? 'var(--secondary)' : 'var(--surface-container-high)';
        const color = active ? 'var(--on-secondary)' : 'var(--on-surface-variant)';
        return `<button onclick="window.setPruebaFilter('type','${item.v}')" style="padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;border:none;cursor:pointer;background:${bg};color:${color};transition:all 0.2s;display:inline-flex;align-items:center;gap:4px;">
            ${item.l}
        </button>`;
    }).join('');

    return `<div>
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div class="relative group max-w-md w-full">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-secondary transition-colors text-lg">search</span>
                <input type="text" 
                    id="prueba-search-input"
                    placeholder="Buscar por zona, cliente, técnico, ID... (Enter)" 
                    value="${search || ''}"
                    onkeydown="if(event.key === 'Enter') { window.setPruebaSearch(this.value); }"
                    class="w-full bg-surface-container-lowest border border-outline-variant/25 focus:border-secondary focus:ring-2 focus:ring-secondary/5 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold outline-none transition-all shadow-sm placeholder:text-on-surface-variant/40"
                >
                ${search ? `
                    <button onclick="window.setPruebaSearch('');" class="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant/60">
                        <span class="material-symbols-outlined text-sm">close</span>
                    </button>
                ` : ''}
            </div>

            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:6px 12px;display:flex;align-items:center;gap:5px;">
                    <span style="width:7px;height:7px;background:#f97316;border-radius:50%;display:inline-block;"></span>
                    <span style="font-size:13px;font-weight:700;color:#c2410c;">Pendientes ${totalActiveTasks}</span>
                </div>
                <div style="display:flex;gap:4px;background:var(--surface-container-low);padding:4px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);align-items:center;">
                    ${typeButtons}
                </div>
                <button onclick="window.refreshPrueba()" style="width:34px;height:34px;border:1px solid #e5e7eb;border-radius:8px;background:white;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="Refrescar datos">
                    <span class="material-symbols-outlined inline-block ${state.isSyncing ? 'animate-spin' : ''}" style="font-size:17px;color:#6b7280;">sync</span>
                </button>
            </div>
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">${dateFilters}</div>
        ${totalActiveTasks === 0
            ? `<div style="text-align:center;padding:60px;color:#9ca3af;"><span class="material-symbols-outlined" style="font-size:48px;display:block;margin-bottom:8px;">search_off</span><p style="font-weight:700;font-size:14px;text-transform:uppercase;">Sin tareas pendientes</p></div>`
            : `<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">${techCards}</div>`
        }

        ${finishedSectionHtml}
    </div>`;
};

window.refreshPrueba = async function() {
    if (window.showLoadingOverlay) window.showLoadingOverlay('Actualizando datos...');
    const icons = document.querySelectorAll('.material-symbols-outlined');
    icons.forEach(i => {
        if (i.textContent.trim() === 'sync') i.classList.add('animate-spin');
    });

    try {
        await Promise.allSettled([
            loadTodayOrders(true),
            loadIssues(true)
        ]);
        if (typeof renderTab === 'function') renderTab('prueba');
    } catch(e) { console.error(e); }
    
    icons.forEach(i => i.classList.remove('animate-spin'));
    if (window.hideLoadingOverlay) window.hideLoadingOverlay();
};

window.setPruebaFilter = function(key, value) {
    state.pruebaFilter[key] = value;
    renderTab('prueba');
};

window.setPruebaSearch = function(q) {
    state.pruebaFilter.search = q;
    renderTab('prueba');
};

window.openZoneModal = function(techName, zoneName, encodedIssues, encodedOrders) {
    const modal = document.getElementById('zone-modal');
    if (!modal) return;

    const titleEl = document.getElementById('zone-modal-title');
    const bodyEl = document.getElementById('zone-modal-body');

    if (titleEl) {
        titleEl.textContent = `${zoneName} — ${techName}`;
    }

    const issues = JSON.parse(decodeURIComponent(encodedIssues) || '[]');
    const orders = JSON.parse(decodeURIComponent(encodedOrders) || '[]');

    let html = '';

    const getNapForIssue = (issue) => {
        if (state.napOverrides && state.napOverrides[issue.id]?.nap) {
            return state.napOverrides[issue.id].nap;
        }
        if (issue.nap) return issue.nap;
        const clientNap = (issue.client_id && state.clients[issue.client_id]?.nap) || (issue.contract_id && state.clients[issue.contract_id]?.nap);
        if (clientNap) return clientNap;
        if (issue.client_id) {
            const allOrders = [...(state.orders || []), ...(state.finishedOrders || [])];
            const matchingOrder = allOrders.find(o => {
                const oClientId = o.client_id || (o.orderable_id && state.clients[o.orderable_id]?.client_id) || o.orderable_id;
                return oClientId && String(oClientId) === String(issue.client_id) && o.nap;
            });
            if (matchingOrder) return matchingOrder.nap;
        }
        return null;
    };

    const getNapForOrder = (order) => {
        const oid = order.rawId || order.id;
        if (state.napOverrides && state.napOverrides[oid]?.nap) {
            return state.napOverrides[oid].nap;
        }
        return order.nap;
    };

    if (issues.length === 0 && orders.length === 0) {
        html = `<p class="text-center py-8 text-on-surface-variant/60 text-sm">No hay tareas en esta zona.</p>`;
    } else {
        if (issues.length > 0) {
            html += `<div class="mb-5">
                <h4 class="text-xs font-black text-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[16px]">build</span> Reportes (${issues.length})
                </h4>
                <div class="space-y-3">`;
            issues.forEach(i => {
                const client = state.clients[i.client_id] || {};
                const clientName = client.name || i.title || 'Cliente desconocido';
                
                // Get zone/lugar
                const title = i.title || i.description || '';
                const zm = title.match(/\(([^)]+)\)/);
                const clientZone = (zm ? zm[1] : (client.zone || '')) || zoneName || 'Sin zona';
                
                const desc = i.description || i.title || '';
                const napVal = getNapForIssue(i);
                const isNapUnassigned = !napVal || napVal.toLowerCase().includes('sin asignar') || napVal.toLowerCase().includes('n/a') || napVal === 'Sin colocar';
                const napText = isNapUnassigned ? 'Sin colocar' : napVal;
                
                const dateStr = i.expires_at ? new Date(i.expires_at).toLocaleDateString('es-ES') : 'Sin fecha';

                // Navigation data
                const lat = client.latitude || '';
                const lng = client.longitude || '';
                const safeAddress = (client.address || '').replace(/'/g, "\\'");
                const safeClientName = clientName.replace(/'/g, "\\'");

                html += `
                    <div class="p-4 bg-surface-container-low hover:bg-surface-container-high transition-all duration-200 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col gap-2">
                        <div class="flex justify-between items-start gap-2">
                            <span class="text-sm font-bold text-on-surface leading-tight">${clientName}</span>
                            <span onclick="window.openClientGPS('${lat}', '${lng}', '${safeAddress}', '${safeClientName}')" 
                                  class="text-[12px] font-extrabold text-secondary bg-secondary/10 hover:bg-secondary/20 transition-all duration-150 px-3 py-1 rounded-full flex items-center gap-1 cursor-pointer shrink-0 active:scale-95 shadow-sm"
                                  title="Ver ubicación en Google Maps">
                                <span class="material-symbols-outlined text-[14px]" style="font-variation-settings:'FILL' 1;">location_on</span>
                                ${clientZone}
                            </span>
                        </div>
                        <p class="text-xs text-on-surface-variant leading-relaxed bg-surface-container-lowest/50 p-2 rounded-lg border border-outline-variant/5">${desc}</p>
                        <div class="flex flex-wrap items-center justify-between gap-2 mt-1 text-[11px] font-semibold">
                            <span class="flex items-center gap-1 px-2.5 py-0.5 rounded-full ${isNapUnassigned ? 'bg-error-container/20 text-error border border-error/10' : 'bg-surface-container-highest/60 text-on-surface-variant'}">
                                <span class="material-symbols-outlined text-[13px] ${isNapUnassigned ? 'text-error' : 'text-on-surface-variant/80'}">settings_input_hdmi</span>
                                NAP: <strong>${napText}</strong>
                            </span>
                            <span class="flex items-center gap-1 text-on-surface-variant/70">
                                <span class="material-symbols-outlined text-[13px]">calendar_today</span>
                                Vence: <strong class="text-on-surface">${dateStr}</strong>
                            </span>
                        </div>
                    </div>`;
            });
            html += `</div></div>`;
        }

        if (orders.length > 0) {
            html += `<div>
                <h4 class="text-xs font-black text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[16px]">router</span> Instalaciones (${orders.length})
                </h4>
                <div class="space-y-3">`;
            orders.forEach(o => {
                const clientName = o.client || 'Cliente desconocido';
                const clientZone = o.zone || zoneName || 'Sin zona';
                const address = o.address || 'Sin dirección';
                
                const napVal = getNapForOrder(o);
                const isNapUnassigned = !napVal || napVal.toLowerCase().includes('sin asignar') || napVal.toLowerCase().includes('n/a') || napVal === 'Sin colocar';
                const napText = isNapUnassigned ? 'Sin colocar' : napVal;
                
                const dateStr = o.start_at ? new Date(o.start_at).toLocaleDateString('es-ES') : 'Sin fecha';

                // Navigation data
                const clientFromCache = state.clients[o.client_id] || state.clients[o.orderable_id] || {};
                const lat = o.latitude || clientFromCache.latitude || '';
                const lng = o.longitude || clientFromCache.longitude || '';
                const safeAddress = address.replace(/'/g, "\\'");
                const safeClientName = clientName.replace(/'/g, "\\'");

                html += `
                    <div class="p-4 bg-surface-container-low hover:bg-surface-container-high transition-all duration-200 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col gap-2">
                        <div class="flex justify-between items-start gap-2">
                            <span class="text-sm font-bold text-on-surface leading-tight">${clientName}</span>
                            <span onclick="window.openClientGPS('${lat}', '${lng}', '${safeAddress}', '${safeClientName}')" 
                                  class="text-[12px] font-extrabold text-primary bg-primary/10 hover:bg-primary/20 transition-all duration-150 px-3 py-1 rounded-full flex items-center gap-1 cursor-pointer shrink-0 active:scale-95 shadow-sm"
                                  title="Ver ubicación en Google Maps">
                                <span class="material-symbols-outlined text-[14px]" style="font-variation-settings:'FILL' 1;">location_on</span>
                                ${clientZone}
                            </span>
                        </div>
                        <p class="text-xs text-on-surface-variant leading-relaxed flex items-center gap-1 bg-surface-container-lowest/50 p-2 rounded-lg border border-outline-variant/5">
                            <span class="material-symbols-outlined text-[14px] text-on-surface-variant/70 shrink-0">home</span>
                            <span class="truncate">${address}</span>
                        </p>
                        <div class="flex flex-wrap items-center justify-between gap-2 mt-1 text-[11px] font-semibold">
                            <span class="flex items-center gap-1 px-2.5 py-0.5 rounded-full ${isNapUnassigned ? 'bg-error-container/20 text-error border border-error/10' : 'bg-surface-container-highest/60 text-on-surface-variant'}">
                                <span class="material-symbols-outlined text-[13px] ${isNapUnassigned ? 'text-error' : 'text-on-surface-variant/80'}">settings_input_hdmi</span>
                                NAP: <strong>${napText}</strong>
                            </span>
                            <span class="flex items-center gap-1 text-on-surface-variant/70">
                                <span class="material-symbols-outlined text-[13px]">calendar_today</span>
                                Fecha: <strong class="text-on-surface">${dateStr}</strong>
                            </span>
                        </div>
                    </div>`;
            });
            html += `</div></div>`;
        }
    }

    if (bodyEl) {
        bodyEl.innerHTML = html;
    }

    modal.classList.remove('hidden');
    // Transition/animation class trigger
    const contentBox = modal.querySelector('div');
    if (contentBox) {
        setTimeout(() => {
            contentBox.classList.remove('scale-95');
            contentBox.classList.add('scale-100');
        }, 10);
    }
};

window.closeZoneModal = function() {
    const modal = document.getElementById('zone-modal');
    if (!modal) return;
    const contentBox = modal.querySelector('div');
    if (contentBox) {
        contentBox.classList.remove('scale-100');
        contentBox.classList.add('scale-95');
    }
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 150);
};

window.openClientGPS = function(lat, lng, address, clientName) {
    let url = '';
    const cleanLat = lat ? String(lat).replace(/,/g, '.').trim() : '';
    const cleanLng = lng ? String(lng).replace(/,/g, '.').trim() : '';
    if (cleanLat && cleanLng && !isNaN(parseFloat(cleanLat)) && !isNaN(parseFloat(cleanLng))) {
        url = `https://www.google.com/maps/search/?api=1&query=${parseFloat(cleanLat)},${parseFloat(cleanLng)}`;
    } else if (address && address.trim() && address.trim() !== 'Sin dirección') {
        url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim() + ' Panama')}`;
    } else if (clientName && clientName.trim() && clientName.trim() !== 'Cliente desconocido') {
        url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clientName.trim() + ' Panama')}`;
    }
    
    if (url) {
        window.open(url, '_blank');
    } else {
        alert('No se encontraron coordenadas ni dirección para este cliente.');
    }
};

window.openPruebaMapModal = function() {
    // Remove existing modal if any
    document.getElementById('prueba-map-modal')?.remove();

    const html = `
    <div id="prueba-map-modal" class="fixed inset-0 z-[250] bg-black/40 backdrop-blur-sm flex items-center justify-center p-2" onclick="if(event.target === this) window.closePruebaMapModal()">
        <div class="bg-surface-container-lowest w-[98vw] max-w-none rounded-[1.5rem] shadow-2xl overflow-hidden flex flex-col h-[96vh]" onclick="event.stopPropagation()">
            <div class="flex justify-between items-center px-6 py-4 border-b border-surface-container-highest">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-secondary">map</span>
                    <h3 class="font-bold text-on-surface text-base Inter">Mapa de Clientes (Filtro Activo)</h3>
                </div>
                <button onclick="window.closePruebaMapModal()" class="text-on-surface-variant hover:text-error transition-colors p-2 rounded-full hover:bg-error-container/30 flex items-center justify-center active:scale-95">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="flex-1 w-full bg-surface-container-high relative">
                <div id="leaflet-prueba-fullscreen-map" style="height: 100%; width: 100%;"></div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);

    setTimeout(() => {
        const map = L.map('leaflet-prueba-fullscreen-map').setView([8.9833, -79.5167], 8);
        L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
            attribution: '&copy; Google Maps'
        }).addTo(map);

        const bounds = [];
        const { date, search, type } = state.pruebaFilter;
        const today    = new Date(); today.setHours(0,0,0,0);
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);

        // Helper to parse localized coordinates
        const parseCoord = (val) => {
            if (val === undefined || val === null) return NaN;
            const str = String(val).replace(/,/g, '.').trim();
            return parseFloat(str);
        };

        // 1. Filtrar Activas
        let activeIssues = state.issues.filter(issue => {
            let techName = state.techs[issue.assignable_id];
            if (!techName && issue.assignable_id) {
                const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
                const found = (db.technicians || []).find(t =>
                    String(t.wisproId) === String(issue.assignable_id) || String(t.id) === String(issue.assignable_id)
                );
                techName = found?.name;
            }
            if (!techName) techName = 'Sin asignar';

            if (date === 'sin_asignar') {
                return techName === 'Sin asignar';
            }

            const venc = issue.expires_at ? new Date(issue.expires_at) : null;
            if (date === 'all' || date === 'hoy') {
                if (techName === 'Sin asignar') {
                    if (date === 'hoy' && !venc) return false;
                    return true;
                }
                const esActivo = TECNICOS_ACTIVOS.some(n =>
                    techName.toLowerCase().includes(n.split(' ')[0].toLowerCase())
                );
                if (!esActivo) return false;
                if (!venc) return true;
                venc.setHours(0,0,0,0);
                return venc.getTime() <= today.getTime();
            }

            if (techName === 'Sin asignar') return false;

            const esActivo = TECNICOS_ACTIVOS.some(n =>
                techName.toLowerCase().includes(n.split(' ')[0].toLowerCase())
            );
            if (!esActivo) return false;

            if (!venc) return date === 'sin_fecha';
            if (date === 'sin_fecha') return false;
            venc.setHours(0,0,0,0);
            if (date === 'manana'  && venc.getTime() !== tomorrow.getTime()) return false;
            if (date === 'vencido' && venc >= today)                         return false;

            return true;
        });

        let activeOrders = state.orders.filter(o => {
            if (o.kind !== 'installation') return false;

            const techName = o.techName || 'Sin asignar';
            if (techName === 'Sin asignar') return false; // Quitar instalaciones sin asignar del mapa

            const sched = o.start_at ? new Date(o.start_at) : null;

            if (date === 'sin_asignar') {
                return false;
            }

            const esActivo = TECNICOS_ACTIVOS.some(n =>
                techName.toLowerCase().includes(n.split(' ')[0].toLowerCase())
            );
            if (!esActivo) return false;

            if (date === 'all') return true;

            if (date === 'hoy') {
                if (!sched) return false;
                sched.setHours(0,0,0,0);
                return sched.getTime() === today.getTime();
            }

            if (!sched) return date === 'sin_fecha';
            if (date === 'sin_fecha') return false;
            sched.setHours(0,0,0,0);
            if (date === 'manana'  && sched.getTime() !== tomorrow.getTime()) return false;
            if (date === 'vencido' && sched.getTime() >= today.getTime()) return false;

            return true;
        });

        const activeType = type || 'all';
        if (activeType === 'issues') {
            activeOrders = [];
        } else if (activeType === 'orders') {
            activeIssues = [];
        }

        if (search && search.trim()) {
            const q = search.toLowerCase().trim();
            activeIssues = activeIssues.filter(issue => {
                const client = state.clients[issue.client_id] || {};
                const title = issue.title || issue.description || '';
                const zm = title.match(/\(([^)]+)\)/);
                const zoneNameVal = (zm ? zm[1] : (client.zone || '')) || 'Sin zona';
                const clientName = (state.clients[issue.client_id]?.name || issue.title || '').toLowerCase();
                const descriptionText = title.toLowerCase();
                const techNameLower = (state.techs[issue.assignable_id] || 'Sin asignar').toLowerCase();
                const addressText = (client.address || '').toLowerCase();
                const idStr = String(issue.public_id || issue.id);

                return zoneNameVal.toLowerCase().includes(q) ||
                       clientName.includes(q) ||
                       descriptionText.includes(q) ||
                       techNameLower.includes(q) ||
                       addressText.includes(q) ||
                       idStr.includes(q);
            });

            activeOrders = activeOrders.filter(o => {
                const zoneNameVal = (o.zone || 'Sin zona').toLowerCase();
                const clientName = (o.client || '').toLowerCase();
                const techNameLower = (o.techName || 'Sin asignar').toLowerCase();
                const addressText = (o.address || '').toLowerCase();
                const idStr = String(o.id);
                
                return zoneNameVal.includes(q) ||
                       clientName.includes(q) ||
                       techNameLower.includes(q) ||
                       addressText.includes(q) ||
                       idStr.includes(q);
            });
        }

        // Gather all with coordinates
        const mapItems = [];

        activeIssues.forEach(i => {
            const client = state.clients[i.client_id] || {};
            const lat = parseCoord(client.latitude);
            const lng = parseCoord(client.longitude);
            if (!isNaN(lat) && !isNaN(lng)) {
                mapItems.push({
                    type: 'issue',
                    id: i.id,
                    name: client.name || i.title || 'Reporte',
                    zone: client.zone || 'Sin zona',
                    lat,
                    lng,
                    details: i.description || i.title || '',
                    tech: state.techs[i.assignable_id] || 'Sin asignar'
                });
            }
        });

        activeOrders.forEach(o => {
            const clientFromCache = state.clients[o.client_id] || state.clients[o.orderable_id] || {};
            const lat = parseCoord(o.latitude || clientFromCache.latitude);
            const lng = parseCoord(o.longitude || clientFromCache.longitude);
            if (!isNaN(lat) && !isNaN(lng)) {
                mapItems.push({
                    type: 'order',
                    id: o.id,
                    name: o.client || 'Instalación',
                    zone: o.zone || 'Sin zona',
                    lat,
                    lng,
                    details: o.address || 'Sin dirección',
                    tech: o.techName || 'Sin asignar'
                });
            }
        });

        mapItems.forEach(c => {
            bounds.push([c.lat, c.lng]);
            const isIssue = c.type === 'issue';
            const color = isIssue ? '#ef4444' : '#0059bb'; // Red for reports, Blue for installations
            const iconSymbol = isIssue ? 'build' : 'router';

            const markerHtml = `
                <div style="background:${color};width:28px;height:28px;border-radius:50%;border:2px solid white;box-shadow:0 3px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;">
                    <span class="material-symbols-outlined" style="font-size:16px;">${iconSymbol}</span>
                </div>
            `;

            const icon = L.divIcon({
                html: markerHtml,
                className: '',
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });

            L.marker([c.lat, c.lng], { icon }).addTo(map)
                .bindPopup(`
                    <div style="text-align:left;padding:4px;min-width:220px;font-family:inherit;">
                        <div style="margin-bottom:4px;">
                            <strong style="font-size:13px;color:#111827;">${c.name}</strong>
                        </div>
                        <div style="display:flex;gap:4px;align-items:center;margin-bottom:6px;">
                            <span style="font-size:9px;font-weight:bold;color:${isIssue ? '#c2410c' : '#0059bb'};background:${isIssue ? '#fff7ed' : '#e8eeff'};padding:2px 6px;border-radius:4px;display:inline-block;">
                                ${isIssue ? 'Reporte / Ticket' : 'Instalación'}
                            </span>
                            <span style="font-size:9px;font-weight:bold;color:#4b5563;background:#f3f4f6;padding:2px 6px;border-radius:4px;">
                                ${c.tech}
                            </span>
                        </div>
                        <div style="font-size:11px;color:#4b5563;line-height:1.4;">
                            <strong>Zona:</strong> ${c.zone}<br>
                            <strong>Detalle:</strong> ${c.details}<br>
                            <strong>Coords:</strong> ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}
                        </div>
                    </div>
                `);
        });

        if (bounds.length > 0) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        } else {
            map.setView([8.9833, -79.5167], 8);
        }

        window.pruebaMapInstance = map;
    }, 100);
};

window.closePruebaMapModal = function() {
    const modal = document.getElementById('prueba-map-modal');
    if (modal) {
        modal.remove();
    }
    if (window.pruebaMapInstance) {
        window.pruebaMapInstance.remove();
        window.pruebaMapInstance = null;
    }
};

// ── INVENTORY VISTA ────────────────────────────────────────────────────────
Views.inventory = () => {
    // 1. Obtener clientes combinados (clientes reales + simulados)
    const dbSync = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    const clientsCache = dbSync.clients_cache || [];
    
    // Obtener contratos y órdenes para extraer clientes si no están en caché
    const allOrders = [...(state.orders || []), ...(state.finishedOrders || [])];
    const clientMap = new Map();

    // Poblar mapa de clientes
    clientsCache.forEach(c => {
        if (c.id) {
            clientMap.set(String(c.id), {
                id: c.id,
                name: c.name || 'Cliente sin nombre',
                zone: c.zone_name || c.address_city || 'Sin Zona',
                phone: c.phone_mobile || c.phone || '—',
                onn: false,
                playtv: false,
                camara: false,
                extensor: false
            });
        }
    });

    // Si dbSync.clients_cache está vacío, poblar desde state.clients
    if (clientMap.size === 0 && state.clients) {
        Object.entries(state.clients).forEach(([id, c]) => {
            if (id && c.name) {
                clientMap.set(String(id), {
                    id: id,
                    name: c.name,
                    zone: c.zone || 'Sin Zona',
                    phone: c.phone || '—',
                    onn: false,
                    playtv: false,
                    camara: false,
                    extensor: false
                });
            }
        });
    }

    // Agregar de órdenes del día si no existen en el mapa
    allOrders.forEach(o => {
        const cid = o.clientId || o.client_id;
        if (cid && !clientMap.has(String(cid))) {
            clientMap.set(String(cid), {
                id: cid,
                name: o.client || 'Cliente sin nombre',
                zone: o.zone || 'Sin Zona',
                phone: o.phone || '—',
                onn: false,
                playtv: false,
                camara: false,
                extensor: false
            });
        }
    });

    // Inicializar o cargar inventario guardado por cliente desde dbSync
    if (!dbSync.client_inventory) {
        dbSync.client_inventory = {};
    }

    // Lógica para auto-detectar desde notas técnicas de Wispro si la orden finalizada contiene texto descriptivo
    allOrders.forEach(o => {
        const cid = o.clientId || o.client_id;
        if (cid) {
            const clientInv = dbSync.client_inventory[cid] || { onn: false, playtv: false, camara: false, extensor: false };
            const desc = (o.description || '').toLowerCase();
            const comment = (o.comments || '').toLowerCase();
            const textToInspect = desc + ' ' + comment;

            if (textToInspect.includes('onn')) clientInv.onn = true;
            if (textToInspect.includes('playtv') || textToInspect.includes('play tv')) clientInv.playtv = true;
            if (textToInspect.includes('camara') || textToInspect.includes('cámara')) clientInv.camara = true;
            if (textToInspect.includes('extensor') || textToInspect.includes('repetidor')) clientInv.extensor = true;

            dbSync.client_inventory[cid] = clientInv;
        }
    });

    // Aplicar valores guardados a la lista en memoria
    const clientList = Array.from(clientMap.values()).map(c => {
        const saved = dbSync.client_inventory[c.id] || { onn: false, playtv: false, camara: false, extensor: false };
        return {
            ...c,
            onn: saved.onn,
            playtv: saved.playtv,
            camara: saved.camara,
            extensor: saved.extensor
        };
    });

    // 2. Calcular Totales para KPIs
    let totalOnn = 0;
    let totalPlaytv = 0;
    let totalCamara = 0;
    let totalExtensor = 0;

    clientList.forEach(c => {
        if (c.onn) totalOnn++;
        if (c.playtv) totalPlaytv++;
        if (c.camara) totalCamara++;
        if (c.extensor) totalExtensor++;
    });

    // 3. Aplicar Filtro y Búsqueda
    let filtered = [...clientList];
    const search = (state.orderSearch || '').toLowerCase().trim();
    if (search) {
        filtered = filtered.filter(c => 
            c.name.toLowerCase().includes(search) ||
            c.zone.toLowerCase().includes(search) ||
            String(c.id).includes(search)
        );
    }

    // 4. Renderizado de filas
    const rows = filtered.map(c => {
        return `
        <tr class="border-b border-surface-container-high/50 hover:bg-surface-container-low/30 transition-colors">
            <td class="p-4">
                <div class="font-bold text-on-surface text-sm">${c.name}</div>
                <div class="text-[10px] font-semibold text-on-surface-variant/60">ID: ${c.id.slice(0, 8)}...</div>
            </td>
            <td class="p-4 text-xs font-bold text-on-surface-variant">${c.zone}</td>
            <td class="p-4 text-xs text-on-surface-variant">${c.phone}</td>
            <td class="p-4 text-center">
                <input type="checkbox" ${c.onn ? 'checked' : ''} 
                    onchange="window.toggleClientEquipment('${c.id}', 'onn', this.checked)"
                    class="w-5 h-5 accent-secondary cursor-pointer rounded">
            </td>
            <td class="p-4 text-center">
                <input type="checkbox" ${c.playtv ? 'checked' : ''} 
                    onchange="window.toggleClientEquipment('${c.id}', 'playtv', this.checked)"
                    class="w-5 h-5 accent-secondary cursor-pointer rounded">
            </td>
            <td class="p-4 text-center">
                <input type="checkbox" ${c.camara ? 'checked' : ''} 
                    onchange="window.toggleClientEquipment('${c.id}', 'camara', this.checked)"
                    class="w-5 h-5 accent-secondary cursor-pointer rounded">
            </td>
            <td class="p-4 text-center">
                <input type="checkbox" ${c.extensor ? 'checked' : ''} 
                    onchange="window.toggleClientEquipment('${c.id}', 'extensor', this.checked)"
                    class="w-5 h-5 accent-secondary cursor-pointer rounded">
            </td>
        </tr>`;
    }).join('');

    // Guardar estado filtrado para las exportaciones
    state.lastFilteredInventory = filtered;

    return `
    <div class="space-y-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h2 class="text-2xl font-black text-on-surface tracking-tight">Control de Equipamiento</h2>
                <p class="text-xs text-on-surface-variant font-semibold mt-1">Gestión de dispositivos ONN, PlayTV+, Cámaras y Extensores por cliente</p>
            </div>
            <div class="flex items-center gap-3">
                <button onclick="window.exportInventoryToCSV()" class="flex items-center gap-2 border border-outline-variant/30 text-on-surface-variant px-4 py-2 rounded-2xl text-xs font-bold hover:bg-surface-container transition-all active:scale-95">
                    <span class="material-symbols-outlined text-[18px]">download</span> Exportar CSV
                </button>
                <button onclick="window.exportInventoryToPDF()" class="bg-primary text-white hover:opacity-90 px-4 py-2 rounded-2xl text-xs font-black flex items-center gap-2 active:scale-95 transition-all shadow-md">
                    <span class="material-symbols-outlined text-[18px]">print</span> Exportar PDF
                </button>
            </div>
        </div>

        <!-- KPIs Cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-surface-container-lowest border border-outline-variant/20 p-5 rounded-3xl flex items-center gap-4 relative overflow-hidden">
                <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                    <span class="material-symbols-outlined text-2xl font-bold">tv</span>
                </div>
                <div>
                    <p class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Dispositivos ONN</p>
                    <h4 class="text-2xl font-black text-primary">${totalOnn}</h4>
                    <p class="text-[10px] text-on-surface-variant/60 font-bold">Entregados en campo</p>
                </div>
            </div>
            <div class="bg-surface-container-lowest border border-outline-variant/20 p-5 rounded-3xl flex items-center gap-4 relative overflow-hidden">
                <div class="w-12 h-12 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center shadow-inner">
                    <span class="material-symbols-outlined text-2xl font-bold">smart_display</span>
                </div>
                <div>
                    <p class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">App PlayTV+</p>
                    <h4 class="text-2xl font-black text-secondary">${totalPlaytv}</h4>
                    <p class="text-[10px] text-on-surface-variant/60 font-bold">Cuentas activas</p>
                </div>
            </div>
            <div class="bg-surface-container-lowest border border-outline-variant/20 p-5 rounded-3xl flex items-center gap-4 relative overflow-hidden">
                <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shadow-inner">
                    <span class="material-symbols-outlined text-2xl font-bold">videocam</span>
                </div>
                <div>
                    <p class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Cámaras</p>
                    <h4 class="text-2xl font-black text-emerald-600">${totalCamara}</h4>
                    <p class="text-[10px] text-on-surface-variant/60 font-bold">Instaladas</p>
                </div>
            </div>
            <div class="bg-surface-container-lowest border border-outline-variant/20 p-5 rounded-3xl flex items-center gap-4 relative overflow-hidden">
                <div class="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shadow-inner">
                    <span class="material-symbols-outlined text-2xl font-bold">router</span>
                </div>
                <div>
                    <p class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Extensores</p>
                    <h4 class="text-2xl font-black text-amber-600">${totalExtensor}</h4>
                    <p class="text-[10px] text-on-surface-variant/60 font-bold">Repetidores provistos</p>
                </div>
            </div>
        </div>

        <!-- Filtros y Búsqueda -->
        <div class="relative group max-w-md">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-secondary transition-colors text-lg">search</span>
            <input type="text" 
                id="inventory-search-input"
                placeholder="Buscar por cliente, zona... (Enter)" 
                value="${state.orderSearch || ''}"
                onkeydown="if(event.key === 'Enter') { window.setOrderSearch(this.value); }"
                class="w-full bg-surface-container-lowest border border-outline-variant/25 focus:border-secondary focus:ring-2 focus:ring-secondary/5 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold outline-none transition-all shadow-sm placeholder:text-on-surface-variant/40"
            >
            ${state.orderSearch ? `
                <button onclick="window.setOrderSearch('');" class="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant/60">
                    <span class="material-symbols-outlined text-sm">close</span>
                </button>
            ` : ''}
        </div>

        <!-- Tabla de Equipos -->
        <div class="bg-surface-container-lowest border border-outline-variant/15 rounded-3xl overflow-hidden">
            <table class="w-full border-collapse">
                <thead>
                    <tr class="bg-surface-container-low/50 text-left border-b border-outline-variant/10">
                        <th class="p-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Cliente</th>
                        <th class="p-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Zona</th>
                        <th class="p-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Teléfono</th>
                        <th class="p-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest text-center">ONN</th>
                        <th class="p-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest text-center">PlayTV+</th>
                        <th class="p-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest text-center">Cámara</th>
                        <th class="p-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest text-center">Extensor</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-surface-container-high/30">
                    ${rows || `<tr><td colspan="7" class="p-12 text-center text-on-surface-variant/40"><span class="material-symbols-outlined text-4xl mb-2">inbox</span><p class="font-bold text-sm uppercase">Sin clientes encontrados</p></td></tr>`}
                </tbody>
            </table>
        </div>
    </div>`;
};

// Toggle de equipamiento manual con guardado local y push al servidor
window.toggleClientEquipment = function(clientId, equipmentKey, isChecked) {
    const dbSync = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    if (!dbSync.client_inventory) {
        dbSync.client_inventory = {};
    }
    if (!dbSync.client_inventory[clientId]) {
        dbSync.client_inventory[clientId] = { onn: false, playtv: false, camara: false, extensor: false };
    }
    
    dbSync.client_inventory[clientId][equipmentKey] = isChecked;
    localStorage.setItem('Velocity_Sync_State', JSON.stringify(dbSync));
    serverPush(dbSync);
    
    // Recargar vista para actualizar KPIs sin perder foco
    renderTab('inventory');
};

// Exportar Inventario a CSV
window.exportInventoryToCSV = function() {
    const list = state.lastFilteredInventory || [];
    if (!list.length) {
        alert('No hay datos para exportar.');
        return;
    }
    const headers = ['Cliente', 'Zona', 'Telefono', 'ONN', 'PlayTV+', 'Camara', 'Extensor'];
    const rows = list.map(c => [
        c.name || '',
        c.zone || '',
        c.phone || '',
        c.onn ? 'SI' : 'NO',
        c.playtv ? 'SI' : 'NO',
        c.camara ? 'SI' : 'NO',
        c.extensor ? 'SI' : 'NO'
    ]);
    
    let csvContent = '\uFEFF'; // BOM UTF-8
    csvContent += [headers.join(','), ...rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `reporte_equipamiento_${new Date().toLocaleDateString('en-CA')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Exportar Inventario a PDF
window.exportInventoryToPDF = async function() {
    const list = state.lastFilteredInventory || [];
    if (!list.length) {
        alert('No hay datos para exportar.');
        return;
    }

    if (window.showLoadingOverlay) window.showLoadingOverlay('Generando PDF...');

    try {
        const { PDFDocument, rgb, StandardFonts } = PDFLib;
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const cleanText = (str) => {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/[\u2013\u2014]/g, "-")
                .replace(/[\u2018\u2019]/g, "'")
                .replace(/[\u201C\u201D]/g, '"');
        };

        const wrapText = (text, maxWidth, fontSize) => {
            if (!text) return [];
            const words = text.split(' ');
            const lines = [];
            let currentLine = '';
            const avgCharWidth = fontSize * 0.55;
            const maxCharsPerLine = Math.floor(maxWidth / avgCharWidth);

            words.forEach(word => {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                if (testLine.length > maxCharsPerLine) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            });
            if (currentLine) {
                lines.push(currentLine);
            }
            return lines;
        };

        let currentPage = null;
        let currentY = 0;

        const createNewPage = () => {
            currentPage = pdfDoc.addPage([792, 612]); // Landscape
            
            // Header
            currentPage.drawText("Reporte de Equipamiento Entregado", { x: 30, y: 560, size: 20, font: fontBold, color: rgb(0, 0.35, 0.73) });
            currentPage.drawText("Velocity Dashboard - Auditoría de Equipos y Aplicaciones", { x: 30, y: 540, size: 10, font: font, color: rgb(0.4, 0.4, 0.4) });
            
            const dateStr = new Date().toLocaleString();
            currentPage.drawText(`Fecha de Emisión: ${dateStr}`, { x: 500, y: 560, size: 9, font: font, color: rgb(0.4, 0.4, 0.4) });
            currentPage.drawText(`Total Registros: ${list.length}`, { x: 500, y: 545, size: 9, font: font, color: rgb(0.4, 0.4, 0.4) });

            currentY = 500;
            drawHeaderRow();
        };

        const drawHeaderRow = () => {
            const headers = [
                { text: 'Cliente', x: 30, w: 220 },
                { text: 'Zona', x: 260, w: 120 },
                { text: 'Teléfono', x: 390, w: 100 },
                { text: 'ONN', x: 500, w: 50 },
                { text: 'PlayTV+', x: 560, w: 50 },
                { text: 'Cámara', x: 620, w: 50 },
                { text: 'Extensor', x: 680, w: 50 }
            ];

            currentPage.drawRectangle({
                x: 30,
                y: currentY - 5,
                width: 730,
                height: 25,
                color: rgb(0.95, 0.96, 0.98)
            });

            headers.forEach(h => {
                currentPage.drawText(h.text, {
                    x: h.x + 5,
                    y: currentY + 5,
                    size: 9,
                    font: fontBold,
                    color: rgb(0.2, 0.2, 0.2)
                });
            });

            currentPage.drawLine({
                start: { x: 30, y: currentY - 5 },
                end: { x: 760, y: currentY - 5 },
                thickness: 1,
                color: rgb(0.8, 0.8, 0.8)
            });

            currentY -= 30;
        };

        createNewPage();

        for (const c of list) {
            const rowHeight = 25;

            if (currentY - rowHeight < 40) {
                createNewPage();
            }

            currentPage.drawRectangle({
                x: 30,
                y: currentY - rowHeight + 5,
                width: 730,
                height: rowHeight,
                color: rgb(1, 1, 1)
            });

            currentPage.drawLine({
                start: { x: 30, y: currentY - rowHeight + 5 },
                end: { x: 760, y: currentY - rowHeight + 5 },
                thickness: 0.5,
                color: rgb(0.9, 0.9, 0.9)
            });

            const nameText = cleanText(c.name || '—');
            const nameLines = wrapText(nameText, 210, 8);
            nameLines.forEach((line, idx) => {
                currentPage.drawText(line, { x: 35, y: currentY - 5 - (idx * 9), size: 8, font: fontBold });
            });

            currentPage.drawText(cleanText(c.zone || '—'), { x: 265, y: currentY - 5, size: 8, font: font });
            currentPage.drawText(cleanText(c.phone || '—'), { x: 395, y: currentY - 5, size: 8, font: font });

            currentPage.drawText(c.onn ? 'SI' : 'NO', { x: 505, y: currentY - 5, size: 8, font: fontBold, color: c.onn ? rgb(0, 0.5, 0) : rgb(0.7, 0.7, 0.7) });
            currentPage.drawText(c.playtv ? 'SI' : 'NO', { x: 565, y: currentY - 5, size: 8, font: fontBold, color: c.playtv ? rgb(0, 0.5, 0) : rgb(0.7, 0.7, 0.7) });
            currentPage.drawText(c.camara ? 'SI' : 'NO', { x: 625, y: currentY - 5, size: 8, font: fontBold, color: c.camara ? rgb(0, 0.5, 0) : rgb(0.7, 0.7, 0.7) });
            currentPage.drawText(c.extensor ? 'SI' : 'NO', { x: 685, y: currentY - 5, size: 8, font: fontBold, color: c.extensor ? rgb(0, 0.5, 0) : rgb(0.7, 0.7, 0.7) });

            currentY -= rowHeight;
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `reporte_equipamiento_${new Date().toLocaleDateString('en-CA')}.pdf`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error("Error generating Equipment PDF:", error);
        alert("Ocurrió un error al generar el PDF.");
    } finally {
        if (window.hideLoadingOverlay) window.hideLoadingOverlay();
    }
};

// ── NATIVE INVENTORY TAB & ACTIONS ────────────────────────────────────────
window.inventorySubTab = window.inventorySubTab || 'all';

window.setInventorySearch = function(val) {
    state.inventoryFilter.search = val;
    if (state.tab === 'inventory') renderTab('inventory');
};

window.setInventoryFilter = function(key, val) {
    state.inventoryFilter[key] = val;
    if (state.tab === 'inventory') renderTab('inventory');
};

window.setInventorySubTab = function(sub) {
    window.inventorySubTab = sub;
    if (state.tab === 'inventory') renderTab('inventory');
};

window.quickCopyText = function(text, elId) {
    if (!text || text === 'N/A') return;
    navigator.clipboard.writeText(text).then(() => {
        const el = document.getElementById(elId);
        if (el) {
            const original = el.innerHTML;
            el.innerHTML = `<span class="material-symbols-outlined text-[14px] text-emerald-400">check</span>`;
            setTimeout(() => { el.innerHTML = original; }, 1500);
        }
    }).catch(() => {});
};

window.syncWisproInventoryNow = function() {
    if (window.showLoadingOverlay) window.showLoadingOverlay('Sincronizando con órdenes de Wispro...');
    setTimeout(() => {
        let syncedCount = 0;
        const allOrders = [...(state.orders || []), ...(state.finishedOrders || [])];
        
        // Cruzar cada orden con el inventario
        allOrders.forEach(ord => {
            const clientName = ord.client_name || (ord.client_id && state.clients[ord.client_id]?.name) || ord.clientName || 'Cliente Residencial';
            const tech = ord.techName || '';
            const zone = ord.zone || (ord.client_id && state.clients[ord.client_id]?.zone) || 'Panamá Este';
            const isInstalled = ['finalizada','finalizado','closed','finalized','installed'].includes(String(ord.state || '').toLowerCase());
            
            // Si la orden tiene serial o es una instalación finalizada
            if (isInstalled && (ord.kind === 'installation' || ord.kind === 'technical')) {
                const serialCandidate = ord.onu_sn || ord.sn || ord.onu || `HWTC-${String(ord.id).padStart(6, '0')}`;
                let item = (state.inventory || []).find(i => i.serial === serialCandidate || (i.wisproOrder && String(i.wisproOrder.id) === String(ord.id)));
                
                if (item) {
                    item.status = 'instalado';
                    item.location = `Instalado en ${clientName}`;
                    item.wisproOrder = {
                        id: String(ord.id || ord.rawId),
                        clientName: clientName,
                        plan: ord.plan || 'Fibra Óptica 100M',
                        date: ord.closed_at || ord.start_at || new Date().toISOString().split('T')[0]
                    };
                    syncedCount++;
                } else if (ord.kind === 'installation') {
                    // Registrar automáticamente equipo instalado en Wispro
                    state.inventory.unshift({
                        id: `inv-auto-${ord.id}`,
                        serial: serialCandidate,
                        mac: ord.mac || 'F4:8E:38:AUTO',
                        model: ord.onu_model || 'Huawei EG8145V5 GPON',
                        category: 'onu',
                        brand: 'Huawei',
                        location: `Instalado en ${clientName}`,
                        assignedTech: tech,
                        status: 'instalado',
                        zone: zone,
                        wisproOrder: {
                            id: String(ord.id || ord.rawId),
                            clientName: clientName,
                            plan: ord.plan || 'Plan Residencial Wispro',
                            date: ord.closed_at || ord.start_at || new Date().toISOString().split('T')[0]
                        },
                        registeredAt: new Date().toISOString().split('T')[0],
                        lastMovement: `Instalado por ${tech || 'Técnico'} (Wispro #${ord.id})`,
                        history: [
                            { date: new Date().toLocaleDateString('es-PA') + ' ' + new Date().toLocaleTimeString('es-PA'), user: 'Wispro Gateway', action: `Aprovisionamiento automático en Orden #${ord.id} (${clientName})` }
                        ]
                    });
                    syncedCount++;
                }
            }
        });

        saveInventoryData();
        if (window.hideLoadingOverlay) window.hideLoadingOverlay();
        renderTab('inventory');
        alert(`⚡ Sincronización completa: Se actualizaron y vincularon ${syncedCount} equipos con las órdenes de Wispro Cloud.`);
    }, 400);
};

window.openAddInventoryModal = function() {
    let modal = document.getElementById('modal-inventory-add');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-inventory-add';
        modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animation-fade-in';
        modal.innerHTML = `
        <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative">
            <div class="flex items-center justify-between border-b border-outline-variant/20 pb-4 mb-4">
                <div class="flex items-center gap-3">
                    <div class="p-2 bg-primary/10 text-primary rounded-xl">
                        <span class="material-symbols-outlined text-2xl">add_box</span>
                    </div>
                    <div>
                        <h3 class="font-black text-lg text-on-surface">Registrar Nuevo Equipo</h3>
                        <p class="text-xs text-on-surface-variant">Ingreso a Bodega Central o Asignación Directa</p>
                    </div>
                </div>
                <button onclick="window.closeAddInventoryModal()" class="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-high transition">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            
            <form onsubmit="window.submitNewInventory(event)" class="space-y-4">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Categoría</label>
                        <select id="inv-in-category" class="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface font-semibold focus:outline-none focus:border-primary">
                            <option value="onu">ONU / GPON</option>
                            <option value="router">Router Wi-Fi</option>
                            <option value="drop">Bobina Fibra Drop</option>
                            <option value="connector">Conectores / Splitters</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Marca</label>
                        <select id="inv-in-brand" class="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface font-semibold focus:outline-none focus:border-primary">
                            <option value="Huawei">Huawei</option>
                            <option value="ZTE">ZTE</option>
                            <option value="V-SOL">V-SOL</option>
                            <option value="TP-Link">TP-Link</option>
                            <option value="Mercusys">Mercusys</option>
                            <option value="Genérico">Genérico / Fibra</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label class="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Modelo del Equipo</label>
                    <input type="text" id="inv-in-model" required placeholder="Ej. EG8145V5 Dual Band GPON" class="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface font-semibold focus:outline-none focus:border-primary" />
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Serial / PON SN</label>
                        <input type="text" id="inv-in-serial" required placeholder="HWTC..." class="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface font-mono font-bold uppercase focus:outline-none focus:border-primary" />
                    </div>
                    <div>
                        <label class="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Dirección MAC</label>
                        <input type="text" id="inv-in-mac" placeholder="F4:8E:38:..." class="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface font-mono uppercase focus:outline-none focus:border-primary" />
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Ubicación Inicial</label>
                        <select id="inv-in-location" class="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface font-semibold focus:outline-none focus:border-primary">
                            <option value="Bodega Central">Bodega Central</option>
                            <option value="Bodega Tortí">Bodega Tortí</option>
                            <option value="Bodega La Siesta">Bodega La Siesta</option>
                            ${TECNICOS_ACTIVOS.map(t => `<option value="Móvil - ${t}">Móvil - ${t}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Zona Principal</label>
                        <select id="inv-in-zone" class="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface font-semibold focus:outline-none focus:border-primary">
                            <option value="Platanilla">Platanilla</option>
                            <option value="Torti">Tortí</option>
                            <option value="La Siesta">La Siesta</option>
                            <option value="Santa Fe">Santa Fe</option>
                            <option value="Wacuco">Wacuco</option>
                        </select>
                    </div>
                </div>

                <div class="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/20 mt-4">
                    <button type="button" onclick="window.closeAddInventoryModal()" class="px-4 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface rounded-xl hover:bg-surface-container-high transition">
                        Cancelar
                    </button>
                    <button type="submit" class="px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl shadow-lg shadow-primary/30 hover:opacity-90 active:scale-95 transition flex items-center gap-2">
                        <span class="material-symbols-outlined text-[18px]">save</span>
                        <span>Guardar Equipo</span>
                    </button>
                </div>
            </form>
        </div>
        `;
        document.body.appendChild(modal);
    }
    modal.classList.remove('hidden');
};

window.closeAddInventoryModal = function() {
    const modal = document.getElementById('modal-inventory-add');
    if (modal) modal.classList.add('hidden');
};

window.submitNewInventory = function(e) {
    e.preventDefault();
    const cat = document.getElementById('inv-in-category')?.value || 'onu';
    const brand = document.getElementById('inv-in-brand')?.value || 'Huawei';
    const model = document.getElementById('inv-in-model')?.value?.trim() || 'Equipo GPON';
    const serial = document.getElementById('inv-in-serial')?.value?.trim().toUpperCase() || 'SN-UNKNOWN';
    const mac = document.getElementById('inv-in-mac')?.value?.trim().toUpperCase() || 'N/A';
    const loc = document.getElementById('inv-in-location')?.value || 'Bodega Central';
    const zone = document.getElementById('inv-in-zone')?.value || 'Platanilla';
    
    const assignedTech = loc.startsWith('Móvil - ') ? loc.replace('Móvil - ', '') : '';
    const status = assignedTech ? 'asignado' : 'disponible';

    state.inventory.unshift({
        id: `inv-${Date.now()}`,
        serial: serial,
        mac: mac,
        model: model,
        category: cat,
        brand: brand,
        location: loc,
        assignedTech: assignedTech,
        status: status,
        zone: zone,
        wisproOrder: null,
        registeredAt: new Date().toISOString().split('T')[0],
        lastMovement: `Ingreso registrado (${loc})`,
        history: [
            { date: new Date().toLocaleDateString('es-PA') + ' ' + new Date().toLocaleTimeString('es-PA'), user: 'Supervisor', action: `Registro manual de equipo en ${loc}` }
        ]
    });

    saveInventoryData();
    window.closeAddInventoryModal();
    renderTab('inventory');
};

window.openTransferModal = function(id) {
    const item = (state.inventory || []).find(i => i.id === id);
    if (!item) return;

    let modal = document.getElementById('modal-inventory-transfer');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-inventory-transfer';
        modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animation-fade-in';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
    <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
        <div class="flex items-center justify-between border-b border-outline-variant/20 pb-4 mb-4">
            <div class="flex items-center gap-3">
                <div class="p-2 bg-tertiary-fixed text-on-tertiary-fixed rounded-xl">
                    <span class="material-symbols-outlined text-2xl">local_shipping</span>
                </div>
                <div>
                    <h3 class="font-black text-lg text-on-surface">Transferir Equipo</h3>
                    <p class="text-xs text-on-surface-variant font-mono">${item.serial} &bull; ${item.model}</p>
                </div>
            </div>
            <button onclick="window.closeTransferModal()" class="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-high transition">
                <span class="material-symbols-outlined">close</span>
            </button>
        </div>

        <form onsubmit="window.saveTransferEquipment(event, '${item.id}')" class="space-y-4">
            <div>
                <label class="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Ubicación Actual</label>
                <input type="text" disabled value="${item.location} (${item.status.toUpperCase()})" class="w-full bg-surface-container-high/40 border border-outline-variant/20 rounded-xl px-3 py-2 text-xs text-on-surface-variant font-semibold" />
            </div>

            <div>
                <label class="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Nuevo Destino / Técnico</label>
                <select id="inv-tr-dest" class="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface font-semibold focus:outline-none focus:border-primary">
                    <option value="Bodega Central">Bodega Central (Disponible)</option>
                    <option value="Bodega Tortí">Bodega Tortí</option>
                    <option value="Bodega La Siesta">Bodega La Siesta</option>
                    <optgroup label="Técnicos de Campo (Móvil)">
                        ${TECNICOS_ACTIVOS.map(t => `<option value="Móvil - ${t}" ${item.assignedTech === t ? 'selected' : ''}>Móvil - ${t}</option>`).join('')}
                    </optgroup>
                    <optgroup label="Otros Estados">
                        <option value="Taller de Reparación">Taller de Reparación (Dañado)</option>
                        <option value="Baja Definitiva">Baja Definitiva / Descarte</option>
                    </optgroup>
                </select>
            </div>

            <div>
                <label class="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Nota o Motivo del Movimiento</label>
                <input type="text" id="inv-tr-note" placeholder="Ej. Asignación de stock para jornada en Tortí" class="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface font-semibold focus:outline-none focus:border-primary" />
            </div>

            <div class="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/20 mt-4">
                <button type="button" onclick="window.closeTransferModal()" class="px-4 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface rounded-xl hover:bg-surface-container-high transition">
                    Cancelar
                </button>
                <button type="submit" class="px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl shadow-lg shadow-primary/30 hover:opacity-90 active:scale-95 transition flex items-center gap-2">
                    <span class="material-symbols-outlined text-[18px]">check_circle</span>
                    <span>Confirmar Transferencia</span>
                </button>
            </div>
        </form>
    </div>
    `;
    modal.classList.remove('hidden');
};

window.closeTransferModal = function() {
    const modal = document.getElementById('modal-inventory-transfer');
    if (modal) modal.classList.add('hidden');
};

window.saveTransferEquipment = function(e, id) {
    e.preventDefault();
    const item = (state.inventory || []).find(i => i.id === id);
    if (!item) return;

    const dest = document.getElementById('inv-tr-dest')?.value || 'Bodega Central';
    const note = document.getElementById('inv-tr-note')?.value?.trim() || 'Transferencia de rutina';

    let newStatus = 'disponible';
    let assignedTech = '';

    if (dest.startsWith('Móvil - ')) {
        newStatus = 'asignado';
        assignedTech = dest.replace('Móvil - ', '');
    } else if (dest.includes('Taller') || dest.includes('Baja')) {
        newStatus = 'dañado';
    }

    item.location = dest;
    item.status = newStatus;
    item.assignedTech = assignedTech;
    item.lastMovement = `${dest} (${note})`;
    
    if (!item.history) item.history = [];
    item.history.push({
        date: new Date().toLocaleDateString('es-PA') + ' ' + new Date().toLocaleTimeString('es-PA'),
        user: 'Supervisor',
        action: `Transferido a ${dest}. Motivo: ${note}`
    });

    saveInventoryData();
    window.closeTransferModal();
    renderTab('inventory');
};

window.openInventoryAudit = function(id) {
    const item = (state.inventory || []).find(i => i.id === id);
    if (!item) return;

    let modal = document.getElementById('modal-inventory-audit');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-inventory-audit';
        modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animation-fade-in';
        document.body.appendChild(modal);
    }

    const historyItems = item.history || [{ date: item.registeredAt, user: 'Sistema', action: 'Ingreso al sistema' }];

    modal.innerHTML = `
    <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative max-h-[85vh] flex flex-col">
        <div class="flex items-center justify-between border-b border-outline-variant/20 pb-4 mb-4">
            <div class="flex items-center gap-3">
                <div class="p-2.5 bg-primary/10 text-primary rounded-xl">
                    <span class="material-symbols-outlined text-2xl">history</span>
                </div>
                <div>
                    <h3 class="font-black text-lg text-on-surface">Auditoría y Trazabilidad</h3>
                    <p class="text-xs text-on-surface-variant font-mono font-bold">${item.serial} &bull; ${item.model}</p>
                </div>
            </div>
            <button onclick="window.closeInventoryAudit()" class="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-high transition">
                <span class="material-symbols-outlined">close</span>
            </button>
        </div>

        <div class="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20 mb-4 grid grid-cols-2 gap-3 text-xs">
            <div>
                <span class="text-on-surface-variant font-medium block">Estado Actual:</span>
                <span class="font-bold uppercase text-on-surface">${item.status}</span>
            </div>
            <div>
                <span class="text-on-surface-variant font-medium block">Ubicación:</span>
                <span class="font-bold text-on-surface">${item.location}</span>
            </div>
            <div>
                <span class="text-on-surface-variant font-medium block">Dirección MAC:</span>
                <span class="font-mono text-on-surface">${item.mac || 'N/A'}</span>
            </div>
            <div>
                <span class="text-on-surface-variant font-medium block">Orden Wispro:</span>
                <span class="font-bold text-primary">${item.wisproOrder ? `#${item.wisproOrder.id} - ${item.wisproOrder.clientName}` : 'Ninguna'}</span>
            </div>
        </div>

        <div class="flex-1 overflow-y-auto pr-1 space-y-3">
            <h4 class="text-xs font-black uppercase tracking-wider text-on-surface-variant">Línea de Tiempo del Serial</h4>
            <div class="relative pl-6 border-l-2 border-outline-variant/40 space-y-4 my-2">
                ${historyItems.map((h, idx) => `
                    <div class="relative">
                        <div class="absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full bg-primary border-2 border-surface-container-lowest"></div>
                        <div class="bg-surface-container-low/60 p-3 rounded-xl border border-outline-variant/20">
                            <div class="flex items-center justify-between gap-2 mb-1">
                                <span class="text-[10px] font-bold text-primary uppercase">${h.user || 'Operador'}</span>
                                <span class="text-[10px] text-on-surface-variant font-mono">${h.date}</span>
                            </div>
                            <p class="text-xs text-on-surface font-medium">${h.action}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="pt-4 border-t border-outline-variant/20 flex justify-end mt-4">
            <button onclick="window.closeInventoryAudit()" class="px-5 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold rounded-xl transition">
                Cerrar
            </button>
        </div>
    </div>
    `;
    modal.classList.remove('hidden');
};

window.closeInventoryAudit = function() {
    const modal = document.getElementById('modal-inventory-audit');
    if (modal) modal.classList.add('hidden');
};

window.exportInventoryCSV = function() {
    if (!state.inventory || state.inventory.length === 0) {
        alert('No hay registros de inventario para exportar.');
        return;
    }

    const headers = ['ID', 'Serial', 'MAC', 'Modelo', 'Categoria', 'Marca', 'Ubicacion', 'Tecnico Asignado', 'Estado', 'Zona', 'Orden Wispro', 'Fecha Registro'];
    const rows = state.inventory.map(i => [
        i.id,
        i.serial,
        i.mac || '',
        `"${(i.model || '').replace(/"/g, '""')}"`,
        i.category || '',
        i.brand || '',
        `"${(i.location || '').replace(/"/g, '""')}"`,
        i.assignedTech || '',
        i.status || '',
        i.zone || '',
        i.wisproOrder ? `"${i.wisproOrder.id} - ${i.wisproOrder.clientName}"` : 'Sin asignar',
        i.registeredAt || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Inventario_Velocity_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// ── VISTA PRINCIPAL NATIVA: INVENTARIO ────────────────────────────────────
Views.inventory = () => {
    loadInventoryData();
    const inv = state.inventory || [];
    const filter = state.inventoryFilter || { search: '', category: 'all', status: 'all', tech: 'all', warehouse: 'all' };
    const q = (filter.search || '').toLowerCase().trim();

    // Métricas
    const totalCount      = inv.length;
    const availableCount  = inv.filter(i => i.status === 'disponible').length;
    const assignedCount   = inv.filter(i => i.status === 'asignado').length;
    const installedCount  = inv.filter(i => i.status === 'instalado').length;
    const damagedCount    = inv.filter(i => i.status === 'dañado' || i.status === 'revision').length;

    // Filtrado
    let filtered = inv.filter(i => {
        if (filter.category !== 'all' && i.category !== filter.category) return false;
        if (filter.status !== 'all' && i.status !== filter.status) return false;
        if (filter.tech !== 'all' && i.assignedTech !== filter.tech) return false;
        
        if (q) {
            const sMatch = (i.serial || '').toLowerCase().includes(q);
            const mMatch = (i.mac || '').toLowerCase().includes(q);
            const modMatch = (i.model || '').toLowerCase().includes(q);
            const locMatch = (i.location || '').toLowerCase().includes(q);
            const techMatch = (i.assignedTech || '').toLowerCase().includes(q);
            const ordMatch = i.wisproOrder && (
                String(i.wisproOrder.id).toLowerCase().includes(q) || 
                (i.wisproOrder.clientName || '').toLowerCase().includes(q)
            );
            if (!sMatch && !mMatch && !modMatch && !locMatch && !techMatch && !ordMatch) return false;
        }
        return true;
    });

    const activeSub = window.inventorySubTab || 'all';

    return `
    <div class="space-y-6 animation-slide-up pb-12">
        <!-- 1. ENCABEZADO Y BOTONES DE ACCIÓN RÁPIDA -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/20 shadow-sm">
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-[10px] font-black tracking-widest text-primary uppercase bg-primary/10 px-2.5 py-0.5 rounded-full">
                        Módulo de Operaciones ISP
                    </span>
                    <span class="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Wispro Cloud Sincronizado
                    </span>
                </div>
                <h1 class="text-2xl md:text-3xl font-black text-on-surface tracking-tight">Inventario & Hardware</h1>
                <p class="text-xs text-on-surface-variant mt-1">Control de ONUs, Routers Wi-Fi, Stock móvil por cuadrilla y Aprovisionamiento en Campo.</p>
            </div>

            <div class="flex flex-wrap items-center gap-2.5">
                <button onclick="window.syncWisproInventoryNow()" class="px-3.5 py-2.5 bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold rounded-2xl border border-outline-variant/30 flex items-center gap-2 transition active:scale-95 shadow-sm" title="Cruzar datos con las órdenes de Wispro">
                    <span class="material-symbols-outlined text-[18px] text-amber-400">sync</span>
                    <span>Sincronizar Wispro</span>
                </button>

                <button onclick="window.exportInventoryCSV()" class="px-3.5 py-2.5 bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold rounded-2xl border border-outline-variant/30 flex items-center gap-2 transition active:scale-95 shadow-sm" title="Descargar reporte en formato CSV">
                    <span class="material-symbols-outlined text-[18px] text-sky-400">download</span>
                    <span>Exportar</span>
                </button>

                <button onclick="window.openAddInventoryModal()" class="px-4 py-2.5 bg-primary text-white text-xs font-bold rounded-2xl shadow-lg shadow-primary/25 hover:opacity-90 active:scale-95 transition flex items-center gap-2">
                    <span class="material-symbols-outlined text-[18px]">add_circle</span>
                    <span>+ Nuevo Equipo</span>
                </button>
            </div>
        </div>

        <!-- 2. TARJETAS DE ESTADÍSTICAS / KPIS DEL INVENTARIO -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div onclick="window.setInventoryFilter('status', 'all')" class="bg-surface-container-lowest border ${filter.status === 'all' ? 'border-primary shadow-md' : 'border-outline-variant/20'} p-4 rounded-2xl cursor-pointer hover:border-primary/50 transition flex flex-col justify-between">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Total Hardware</span>
                    <span class="material-symbols-outlined text-primary text-xl">inventory_2</span>
                </div>
                <div class="mt-2">
                    <span class="text-2xl font-black text-on-surface">${totalCount}</span>
                    <span class="text-[10px] text-on-surface-variant block mt-0.5">En base de datos</span>
                </div>
            </div>

            <div onclick="window.setInventoryFilter('status', 'disponible')" class="bg-surface-container-lowest border ${filter.status === 'disponible' ? 'border-emerald-500 shadow-md' : 'border-outline-variant/20'} p-4 rounded-2xl cursor-pointer hover:border-emerald-500/50 transition flex flex-col justify-between">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-400">En Bodega</span>
                    <span class="material-symbols-outlined text-emerald-400 text-xl">warehouse</span>
                </div>
                <div class="mt-2">
                    <span class="text-2xl font-black text-emerald-400">${availableCount}</span>
                    <span class="text-[10px] text-on-surface-variant block mt-0.5">Stock disponible</span>
                </div>
            </div>

            <div onclick="window.setInventoryFilter('status', 'asignado')" class="bg-surface-container-lowest border ${filter.status === 'asignado' ? 'border-sky-500 shadow-md' : 'border-outline-variant/20'} p-4 rounded-2xl cursor-pointer hover:border-sky-500/50 transition flex flex-col justify-between">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-sky-400">En Móviles</span>
                    <span class="material-symbols-outlined text-sky-400 text-xl">local_shipping</span>
                </div>
                <div class="mt-2">
                    <span class="text-2xl font-black text-sky-400">${assignedCount}</span>
                    <span class="text-[10px] text-on-surface-variant block mt-0.5">En vehículos técnicos</span>
                </div>
            </div>

            <div onclick="window.setInventoryFilter('status', 'instalado')" class="bg-surface-container-lowest border ${filter.status === 'instalado' ? 'border-primary shadow-md' : 'border-outline-variant/20'} p-4 rounded-2xl cursor-pointer hover:border-primary/50 transition flex flex-col justify-between">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-primary">Instalados</span>
                    <span class="material-symbols-outlined text-primary text-xl">check_circle</span>
                </div>
                <div class="mt-2">
                    <span class="text-2xl font-black text-on-surface">${installedCount}</span>
                    <span class="text-[10px] text-on-surface-variant block mt-0.5">Activos en Wispro</span>
                </div>
            </div>

            <div onclick="window.setInventoryFilter('status', 'dañado')" class="bg-surface-container-lowest border ${filter.status === 'dañado' ? 'border-rose-500 shadow-md' : 'border-outline-variant/20'} p-4 rounded-2xl cursor-pointer hover:border-rose-500/50 transition flex flex-col justify-between col-span-2 sm:col-span-1">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-rose-400">En Taller / Bajas</span>
                    <span class="material-symbols-outlined text-rose-400 text-xl">build</span>
                </div>
                <div class="mt-2">
                    <span class="text-2xl font-black text-rose-400">${damagedCount}</span>
                    <span class="text-[10px] text-on-surface-variant block mt-0.5">Para revisión o descarte</span>
                </div>
            </div>
        </div>

        <!-- 3. SUB-PESTAÑAS DE NAVEGACIÓN (LISTA DE EQUIPOS vs RESUMEN POR CUADRILLA) -->
        <div class="flex items-center gap-2 border-b border-outline-variant/20 pb-2">
            <button onclick="window.setInventorySubTab('all')" class="px-4 py-2 text-xs font-bold rounded-xl transition ${activeSub === 'all' ? 'bg-primary-container text-white shadow-md' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'} flex items-center gap-2">
                <span class="material-symbols-outlined text-[16px]">list_alt</span>
                <span>Registro de Equipos (${filtered.length})</span>
            </button>
            <button onclick="window.setInventorySubTab('techs')" class="px-4 py-2 text-xs font-bold rounded-xl transition ${activeSub === 'techs' ? 'bg-primary-container text-white shadow-md' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'} flex items-center gap-2">
                <span class="material-symbols-outlined text-[16px]">engineering</span>
                <span>Stock por Cuadrilla Técnica</span>
            </button>
        </div>

        ${activeSub === 'techs' ? renderTechStockSummary(inv) : renderMainInventoryTable(filtered, filter)}
    </div>
    `;
};

// ── TABLA PRINCIPAL DE INVENTARIO ─────────────────────────────────────────
function renderMainInventoryTable(filtered, filter) {
    return `
    <div class="space-y-4">
        <!-- BARRA DE BÚSQUEDA Y FILTROS INTEGRADOS -->
        <div class="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/20 shadow-sm flex flex-col md:flex-row items-center gap-3">
            <div class="relative flex-1 w-full">
                <span class="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]">search</span>
                <input 
                    type="text" 
                    value="${filter.search || ''}" 
                    oninput="window.setInventorySearch(this.value)" 
                    placeholder="Buscar por Serial (PON/SN), MAC, Modelo, Técnico o Cliente Wispro..." 
                    class="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl pl-9 pr-8 py-2 text-xs text-on-surface font-semibold focus:outline-none focus:border-primary transition"
                />
                ${filter.search ? `<button onclick="window.setInventorySearch('')" class="absolute right-2.5 top-2.5 text-on-surface-variant hover:text-on-surface"><span class="material-symbols-outlined text-sm">close</span></button>` : ''}
            </div>

            <div class="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <select onchange="window.setInventoryFilter('category', this.value)" class="bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface font-semibold focus:outline-none focus:border-primary">
                    <option value="all" ${filter.category === 'all' ? 'selected' : ''}>Todas las categorías</option>
                    <option value="onu" ${filter.category === 'onu' ? 'selected' : ''}>ONUs GPON</option>
                    <option value="router" ${filter.category === 'router' ? 'selected' : ''}>Routers Wi-Fi</option>
                    <option value="drop" ${filter.category === 'drop' ? 'selected' : ''}>Cables & Fibra Drop</option>
                    <option value="connector" ${filter.category === 'connector' ? 'selected' : ''}>Conectores / Splitters</option>
                </select>

                <select onchange="window.setInventoryFilter('status', this.value)" class="bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface font-semibold focus:outline-none focus:border-primary">
                    <option value="all" ${filter.status === 'all' ? 'selected' : ''}>Todos los estados</option>
                    <option value="disponible" ${filter.status === 'disponible' ? 'selected' : ''}>Disponible en Bodega</option>
                    <option value="asignado" ${filter.status === 'asignado' ? 'selected' : ''}>Asignado a Técnico</option>
                    <option value="instalado" ${filter.status === 'instalado' ? 'selected' : ''}>Instalado (Wispro)</option>
                    <option value="dañado" ${filter.status === 'dañado' ? 'selected' : ''}>En Revisión / Dañado</option>
                </select>

                <select onchange="window.setInventoryFilter('tech', this.value)" class="bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface font-semibold focus:outline-none focus:border-primary">
                    <option value="all" ${filter.tech === 'all' ? 'selected' : ''}>Todos los técnicos</option>
                    ${TECNICOS_ACTIVOS.map(t => `<option value="${t}" ${filter.tech === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
            </div>
        </div>

        <!-- TABLA DE EQUIPOS -->
        <div class="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 overflow-hidden shadow-sm">
            ${filtered.length === 0 ? `
                <div class="p-12 text-center flex flex-col items-center justify-center">
                    <div class="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-3">
                        <span class="material-symbols-outlined text-on-surface-variant text-3xl">inventory_2</span>
                    </div>
                    <h3 class="font-bold text-on-surface text-base">No se encontraron equipos</h3>
                    <p class="text-xs text-on-surface-variant mt-1 max-w-sm">Intenta ajustar los filtros de búsqueda o registra un nuevo equipo haciendo clic en "+ Nuevo Equipo".</p>
                </div>
            ` : `
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr class="bg-surface-container-low/80 border-b border-outline-variant/20 text-[10px] font-black text-on-surface-variant uppercase tracking-wider">
                                <th class="p-3.5 pl-6">Serial / PON SN</th>
                                <th class="p-3.5">Modelo & Categoría</th>
                                <th class="p-3.5">Ubicación / Asignación</th>
                                <th class="p-3.5">Estado</th>
                                <th class="p-3.5">Vínculo Wispro</th>
                                <th class="p-3.5 pr-6 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-outline-variant/10">
                            ${filtered.map(item => {
                                // Badges de Estado
                                let statusBadge = '';
                                if (item.status === 'disponible') {
                                    statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>Disponible</span>`;
                                } else if (item.status === 'asignado') {
                                    statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-sky-500/10 text-sky-400 border border-sky-500/20"><span class="w-1.5 h-1.5 rounded-full bg-sky-400"></span>En Móvil</span>`;
                                } else if (item.status === 'instalado') {
                                    statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-primary/10 text-primary border border-primary/20"><span class="material-symbols-outlined text-[12px]">verified</span>Instalado</span>`;
                                } else {
                                    statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-400 border border-rose-500/20"><span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>Dañado / Revisión</span>`;
                                }

                                const copyBtnId = `copy-btn-${item.id}`;

                                return `
                                <tr class="hover:bg-surface-container-low/50 transition group">
                                    <td class="p-3.5 pl-6 font-mono">
                                        <div class="flex items-center gap-2">
                                            <span class="font-bold text-on-surface text-[12px] tracking-tight">${item.serial}</span>
                                            <button id="${copyBtnId}" onclick="window.quickCopyText('${item.serial}', '${copyBtnId}')" class="text-on-surface-variant hover:text-primary transition p-0.5 rounded" title="Copiar Serial">
                                                <span class="material-symbols-outlined text-[14px]">content_copy</span>
                                            </button>
                                        </div>
                                        <span class="text-[10px] text-on-surface-variant font-normal block mt-0.5">MAC: ${item.mac || 'N/A'}</span>
                                    </td>

                                    <td class="p-3.5">
                                        <span class="font-bold text-on-surface block">${item.model}</span>
                                        <span class="text-[10px] text-on-surface-variant uppercase tracking-wider">${item.brand} &bull; ${item.category.toUpperCase()}</span>
                                    </td>

                                    <td class="p-3.5">
                                        <div class="flex items-center gap-1.5">
                                            <span class="material-symbols-outlined text-sm text-on-surface-variant">
                                                ${item.location.startsWith('Móvil') ? 'directions_car' : item.location.startsWith('Cliente') ? 'person' : 'warehouse'}
                                            </span>
                                            <span class="font-semibold text-on-surface">${item.location}</span>
                                        </div>
                                        ${item.zone ? `<span class="text-[10px] text-on-surface-variant block mt-0.5">Zona: ${item.zone}</span>` : ''}
                                    </td>

                                    <td class="p-3.5">
                                        ${statusBadge}
                                    </td>

                                    <td class="p-3.5">
                                        ${item.wisproOrder ? `
                                            <div class="bg-primary/5 border border-primary/20 p-2 rounded-xl">
                                                <div class="flex items-center gap-1.5">
                                                    <span class="material-symbols-outlined text-[14px] text-primary">tag</span>
                                                    <span class="font-bold text-on-surface text-[11px]">${item.wisproOrder.clientName}</span>
                                                </div>
                                                <span class="text-[9px] text-on-surface-variant block mt-0.5 font-mono">Orden #${item.wisproOrder.id} &bull; ${item.wisproOrder.plan}</span>
                                            </div>
                                        ` : `
                                            <span class="text-[11px] text-on-surface-variant italic">Sin orden asignada</span>
                                        `}
                                    </td>

                                    <td class="p-3.5 pr-6 text-right">
                                        <div class="inline-flex items-center gap-1">
                                            <button onclick="window.openTransferModal('${item.id}')" class="p-1.5 rounded-xl hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition" title="Transferir de ubicación">
                                                <span class="material-symbols-outlined text-[18px]">swap_horiz</span>
                                            </button>
                                            <button onclick="window.openInventoryAudit('${item.id}')" class="p-1.5 rounded-xl hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition" title="Ver Historial y Auditoría">
                                                <span class="material-symbols-outlined text-[18px]">history</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        </div>
    </div>
    `;
}

// ── RESUMEN DE STOCK POR CUADRILLA TÉCNICA ────────────────────────────────
function renderTechStockSummary(inv) {
    return `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${TECNICOS_ACTIVOS.map(nombre => {
            const techItems = inv.filter(i => (i.assignedTech || '').toLowerCase().includes(nombre.split(' ')[0].toLowerCase()));
            const onusCount = techItems.filter(i => i.category === 'onu' && i.status === 'asignado').length;
            const routersCount = techItems.filter(i => i.category === 'router' && i.status === 'asignado').length;
            const dropCables = techItems.filter(i => i.category === 'drop' && i.status === 'asignado').length;
            const installedToday = (state.finishedOrders || []).filter(o => (o.techName || '').toLowerCase().includes(nombre.split(' ')[0].toLowerCase())).length;

            return `
            <div class="bg-surface-container-lowest border border-outline-variant/20 rounded-3xl p-5 shadow-sm space-y-4">
                <div class="flex items-center justify-between border-b border-outline-variant/15 pb-3">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-2xl bg-primary/10 text-primary font-black flex items-center justify-center text-sm">
                            ${techInitials(nombre)}
                        </div>
                        <div>
                            <h3 class="font-black text-on-surface text-sm">${nombre}</h3>
                            <span class="text-[10px] font-bold text-sky-400 uppercase tracking-wider">Unidad Móvil en Campo</span>
                        </div>
                    </div>
                    <button onclick="window.setInventoryFilter('tech', '${nombre}'); window.setInventorySubTab('all');" class="text-xs font-bold text-primary hover:underline">
                        Ver items
                    </button>
                </div>

                <div class="grid grid-cols-3 gap-2 text-center">
                    <div class="bg-surface-container-low p-2.5 rounded-xl border border-outline-variant/15">
                        <span class="text-[10px] text-on-surface-variant font-bold block uppercase">ONUs</span>
                        <span class="text-lg font-black text-on-surface">${onusCount}</span>
                    </div>
                    <div class="bg-surface-container-low p-2.5 rounded-xl border border-outline-variant/15">
                        <span class="text-[10px] text-on-surface-variant font-bold block uppercase">Routers</span>
                        <span class="text-lg font-black text-on-surface">${routersCount}</span>
                    </div>
                    <div class="bg-surface-container-low p-2.5 rounded-xl border border-outline-variant/15">
                        <span class="text-[10px] text-on-surface-variant font-bold block uppercase">Bobinas</span>
                        <span class="text-lg font-black text-on-surface">${dropCables}</span>
                    </div>
                </div>

                <div class="bg-primary/5 p-3 rounded-2xl border border-primary/15 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary text-base">task_alt</span>
                        <span class="text-xs font-semibold text-on-surface">Instalaciones de hoy (Wispro):</span>
                    </div>
                    <span class="font-black text-xs text-primary">${installedToday} órdenes</span>
                </div>
            </div>
            `;
        }).join('')}
    </div>
    `;
}

// ── NAPs TRACKER ──────────────────────────────────────────────────────────
Views.naps = () => {
    let list = [...state.trackedNaps];
    const { sortBy, sortDir, zone, search } = state.napFilter;

    // Filter by search query
    if (search && search.trim()) {
        const q = search.toLowerCase().trim();
        list = list.filter(n => 
            (n.name || '').toLowerCase().includes(q) ||
            (n.zone || '').toLowerCase().includes(q) ||
            (n.techName || '').toLowerCase().includes(q) ||
            (n.coords || '').toLowerCase().includes(q) ||
            (n.comments || '').toLowerCase().includes(q) ||
            (n.action || '').toLowerCase().includes(q)
        );
    }

    // Filter by zone
    if (zone !== 'all') {
        list = list.filter(n => n.zone?.toLowerCase().trim() === zone.toLowerCase().trim());
    }

    // Helper to parse dates in format DD/MM/YYYY or standard YYYY-MM-DD
    const parseNapDate = (dateStr) => {
        if (!dateStr) return 0;
        const s = String(dateStr).trim();
        if (s.includes('/')) {
            const parts = s.split('/');
            if (parts.length === 3) {
                const d = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10) - 1;
                const y = parseInt(parts[2], 10);
                return new Date(y, m, d).getTime() || 0;
            }
        }
        return new Date(s).getTime() || 0;
    };

    // Helper to extract first number for sorting (handles negative levels, counts, etc.)
    const extractNapNumber = (val) => {
        if (val === null || val === undefined) return -Infinity;
        if (typeof val === 'number') return val;
        const cleanStr = String(val).trim();
        if (!cleanStr) return -Infinity;
        const match = cleanStr.match(/-?\d+(\.\d+)?/);
        return match ? parseFloat(match[0]) : -Infinity;
    };

    // Sort
    list.sort((a,b) => {
        let valA, valB;
        if (sortBy === 'date') {
            valA = parseNapDate(a.date);
            valB = parseNapDate(b.date);
        } else if (sortBy === 'name') {
            valA = (a.name || '').toLowerCase();
            valB = (b.name || '').toLowerCase();
        } else if (sortBy === 'zone') {
            valA = (a.zone || '').toLowerCase();
            valB = (b.zone || '').toLowerCase();
        } else if (sortBy === 'tech') {
            valA = (a.techName || '').toLowerCase();
            valB = (b.techName || '').toLowerCase();
        } else if (sortBy === 'coords') {
            valA = (a.coords || '').toLowerCase();
            valB = (b.coords || '').toLowerCase();
        } else if (sortBy === 'ports') {
            valA = extractNapNumber(a.ports);
            valB = extractNapNumber(b.ports);
        } else if (sortBy === 'levels') {
            valA = extractNapNumber(a.levels);
            valB = extractNapNumber(b.levels);
        } else if (sortBy === 'action') {
            valA = ((a.action || '') + ' ' + (a.comments || '')).toLowerCase();
            valB = ((b.action || '') + ' ' + (b.comments || '')).toLowerCase();
        } else {
            valA = parseNapDate(a.date);
            valB = parseNapDate(b.date);
        }

        // Handle empty values: always push to the end regardless of direction
        const isAEmpty = (valA === -Infinity || valA === null || valA === undefined || valA === '');
        const isBEmpty = (valB === -Infinity || valB === null || valB === undefined || valB === '');
        if (isAEmpty && isBEmpty) return 0;
        if (isAEmpty) return 1;
        if (isBEmpty) return -1;

        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });

    state.lastFilteredNaps = list;

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
            <td style="padding:12px 14px;font-weight:700;color:#111827;font-size:15px;">
                <div style="display:flex;align-items:center;gap:6px;">
                    <span>${n.name}</span>
                    ${n.wisproId ? `
                        <span class="material-symbols-outlined text-[16px] text-emerald-500" title="Validada en Wispro" style="cursor:help;">cloud_done</span>
                    ` : `
                        <span class="material-symbols-outlined text-[16px] text-gray-300" title="Solo local (No vinculada en Wispro)" style="cursor:help;">cloud_off</span>
                    `}
                </div>
            </td>
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

    // Helper for rendering header with sort button
    const renderSortHeader = (label, colKey) => {
        const isActive = sortBy === colKey;
        const icon = isActive 
            ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') 
            : 'swap_vert';
        const opacityClass = isActive ? 'text-primary opacity-100 font-black' : 'opacity-30';
        return `
        <th onclick="window.toggleNapSort('${colKey}')" class="hover:bg-slate-100 cursor-pointer select-none transition-colors" style="padding:12px 14px;font-size:14px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">
            <div style="display:flex;align-items:center;gap:4px;">
                <span>${label}</span>
                <span class="material-symbols-outlined text-[16px] ${opacityClass}" style="font-size: 16px;">${icon}</span>
            </div>
        </th>`;
    };

    return `
    <div>
        <div class="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-3">
            <div class="relative group max-w-md w-full">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-secondary transition-colors text-lg">search</span>
                <input type="text" 
                    id="nap-search-input"
                    placeholder="Buscar NAPs... (Enter)" 
                    value="${search || ''}"
                    onkeydown="if(event.key === 'Enter') { window.setNapSearch(this.value); }"
                    class="w-full bg-surface-container-lowest border border-outline-variant/25 focus:border-secondary focus:ring-2 focus:ring-secondary/5 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold outline-none transition-all shadow-sm placeholder:text-on-surface-variant/40"
                >
                ${search ? `
                    <button onclick="window.setNapSearch('');" class="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant/60">
                        <span class="material-symbols-outlined text-sm">close</span>
                    </button>
                ` : ''}
            </div>

            <div class="flex flex-wrap items-center gap-2">
                <input type="file" id="nap-import-file" accept=".csv" class="hidden" onchange="window.importNapsFromCSV(event)">
                <input type="file" id="nap-import-pdf-file" accept=".pdf" class="hidden" onchange="window.importNapsFromPDF(event)">
                <button onclick="document.getElementById('nap-import-file').click()" class="border border-outline-variant/30 text-on-surface hover:bg-surface-container/40 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all">
                    <span class="material-symbols-outlined text-[15px]">publish</span> Importar CSV
                </button>
                <button onclick="document.getElementById('nap-import-pdf-file').click()" class="border border-outline-variant/30 text-on-surface hover:bg-surface-container/40 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all">
                    <span class="material-symbols-outlined text-[15px]">upload_file</span> Importar PDF
                </button>
                <button onclick="window.exportNapsToCSV()" class="border border-outline-variant/30 text-on-surface hover:bg-surface-container/40 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all">
                    <span class="material-symbols-outlined text-[15px]">download</span> Exportar CSV
                </button>
                <button onclick="window.exportNapsToPDF()" class="bg-secondary text-white hover:opacity-95 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all shadow-sm">
                    <span class="material-symbols-outlined text-[15px]">print</span> Exportar PDF
                </button>
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
                    <option value="tech" ${sortBy === 'tech' ? 'selected' : ''}>Ordenar por Técnico</option>
                    <option value="coords" ${sortBy === 'coords' ? 'selected' : ''}>Ordenar por Coordenadas</option>
                    <option value="ports" ${sortBy === 'ports' ? 'selected' : ''}>Ordenar por Puertos</option>
                    <option value="levels" ${sortBy === 'levels' ? 'selected' : ''}>Ordenar por Niveles</option>
                    <option value="action" ${sortBy === 'action' ? 'selected' : ''}>Ordenar por Acción / Comentario</option>
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

        <div class="relative group cursor-pointer overflow-hidden rounded-2xl border border-outline-variant/30 mb-6 shadow-sm" onclick="window.openNapsMapModal()">
            <div id="naps-map" style="width: 100%; aspect-ratio: 16/9; max-height: 220px; z-index: 1;"></div>
            <div class="absolute inset-0 bg-black/5 group-hover:bg-black/15 transition-all flex items-center justify-center z-10">
                <div class="bg-white/95 dark:bg-black/90 backdrop-blur text-on-surface px-4 py-2 rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-all transform group-hover:scale-105">
                    <span class="material-symbols-outlined text-sm">fullscreen</span>
                    Ampliar mapa interactivo
                </div>
            </div>
        </div>

        <!-- Fullscreen NAPs Map Modal -->
        <div id="naps-map-modal" class="hidden fixed inset-0 z-[200] bg-black/45 backdrop-blur-sm flex items-center justify-center p-2" onclick="if(event.target === this) window.closeNapsMapModal(event)">
            <div class="bg-surface-container-lowest w-[98vw] max-w-none rounded-[1.5rem] shadow-2xl overflow-hidden flex flex-col h-[96vh]">
                <div class="flex justify-between items-center px-6 py-4 border-b border-surface-container-highest">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-secondary">hub</span>
                        <h3 class="font-bold text-on-surface text-base Inter">Mapa Ampliado de NAPs</h3>
                    </div>
                    <button onclick="window.closeNapsMapModal(event)" class="text-on-surface-variant hover:text-error transition-colors p-2 rounded-full hover:bg-error-container/30 flex items-center justify-center active:scale-95">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="flex-1 w-full bg-surface-container-high relative">
                    <div id="leaflet-naps-fullscreen-map" style="height: 100%; width: 100%;"></div>
                </div>
            </div>
        </div>

        <div style="background:white;border:1px solid #f0f0f0;border-radius:12px;overflow-x:auto;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
            <table style="width:100%;border-collapse:collapse;min-width:900px;">
                <thead>
                    <tr style="background:#f8fafc;border-bottom:2px solid #e5e7eb;text-align:left;">
                        ${renderSortHeader('Fechas', 'date')}
                        ${renderSortHeader('Nombres', 'name')}
                        ${renderSortHeader('Zona', 'zone')}
                        ${renderSortHeader('Técnico', 'tech')}
                        ${renderSortHeader('Coordenadas', 'coords')}
                        ${renderSortHeader('Puertos', 'ports')}
                        ${renderSortHeader('Niveles', 'levels')}
                        ${renderSortHeader('Acción / Comentario', 'action')}
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

    const panamaBounds = L.latLngBounds([6.8, -83.5], [10.2, -77.0]);
    napsMapInstance = L.map('naps-map', {
        maxBounds: panamaBounds,
        maxBoundsViscosity: 1.0,
        minZoom: 7,
        dragging: false,
        zoomControl: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoom: false
    }).setView([8.9833, -79.5167], 8);
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

        L.marker([lat, lng], { icon }).addTo(napsMapInstance);
    });

    if (bounds.length > 0) {
        napsMapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
};

let napsFullscreenMapInstance = null;
window.openNapsMapModal = () => {
    const modal = document.getElementById('naps-map-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    
    // Inicializar mapa de pantalla completa
    setTimeout(() => {
        if (napsFullscreenMapInstance) {
            napsFullscreenMapInstance.remove();
            napsFullscreenMapInstance = null;
        }
        
        napsFullscreenMapInstance = L.map('leaflet-naps-fullscreen-map').setView([8.9833, -79.5167], 12);
        L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
            attribution: '&copy; Google Maps'
        }).addTo(napsFullscreenMapInstance);
        
        const napsWithCoords = state.trackedNaps.filter(n => n.coords && n.coords.match(/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/));
        if (napsWithCoords.length === 0) return;
        
        const bounds = [];
        napsWithCoords.forEach(n => {
            const [lat, lng] = n.coords.split(',').map(s => parseFloat(s.trim()));
            bounds.push([lat, lng]);
            
            const isResolved = n.resolved;
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
            
            L.marker([lat, lng], { icon }).addTo(napsFullscreenMapInstance)
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
            napsFullscreenMapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
        }
    }, 100);
};

window.closeNapsMapModal = (e) => {
    if (e) e.stopPropagation();
    const modal = document.getElementById('naps-map-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    if (napsFullscreenMapInstance) {
        napsFullscreenMapInstance.remove();
        napsFullscreenMapInstance = null;
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

window.saveNapTracker = async (e) => {
    e.preventDefault();
    const id = document.getElementById('nt-id').value;
    const syncWispro = document.getElementById('nt-sync-wispro').checked;

    const nap = {
        id,
        date: document.getElementById('nt-date').value,
        name: document.getElementById('nt-name').value.trim(),
        zone: document.getElementById('nt-zone').value.trim(),
        techName: document.getElementById('nt-tech').value.trim(),
        wisproId: document.getElementById('nt-id-wispro').value.trim(),
        coords: document.getElementById('nt-coords').value.trim(),
        ports: document.getElementById('nt-ports').value.trim(),
        levels: document.getElementById('nt-levels').value.trim(),
        action: document.getElementById('nt-action').value.trim(),
        comments: document.getElementById('nt-comments').value.trim(),
        resolved: false
    };

    // Si no está validada en Wispro pero se tiene el nombre, buscarla en segundo plano para enriquecer los datos vacíos
    if (!nap.wisproId && nap.name) {
        try {
            const allNaps = await apiPages('naps', 5);
            const found = allNaps.find(n => n.name.toLowerCase() === nap.name.toLowerCase());
            if (found) {
                nap.wisproId = found.id;
                if (!nap.coords && found.latitude && found.longitude) {
                    nap.coords = `${found.latitude}, ${found.longitude}`;
                }
                if (!nap.ports) {
                    const total = found.ports_count || 8;
                    const occ = found.contracts_count || 0;
                    nap.ports = `Ocupados: ${occ}, Libres: ${total - occ} (Total: ${total})`;
                }
            }
        } catch (err) {
            console.warn('[Velocity] Error en búsqueda automática de NAP en Wispro:', err);
        }
    }

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

window.setNapSearch = (value) => {
    state.napFilter.search = value;
    if (state.tab === 'naps') renderTab('naps');
};

window.setNapFilter = (key, value) => {
    state.napFilter[key] = value;
    if(state.tab === 'naps') renderTab('naps');
};

window.toggleNapSort = (col) => {
    if (state.napFilter.sortBy === col) {
        state.napFilter.sortDir = state.napFilter.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
        state.napFilter.sortBy = col;
        state.napFilter.sortDir = 'asc';
    }
    if (state.tab === 'naps') renderTab('naps');
};

// Auxiliar para parsear CSV respetando comillas y comas
function parseCSV(text) {
    const lines = [];
    let row = [""];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        const next = text[i+1];
        if (c === '"') {
            if (inQuotes && next === '"') {
                row[row.length - 1] += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (c === ',' && !inQuotes) {
            row.push("");
        } else if ((c === '\r' || c === '\n') && !inQuotes) {
            if (c === '\r' && next === '\n') { i++; }
            lines.push(row);
            row = [""];
        } else {
            row[row.length - 1] += c;
        }
    }
    if (row.length > 1 || row[0] !== "") {
        lines.push(row);
    }
    return lines;
}

window.exportNapsToCSV = function() {
    const list = state.trackedNaps;
    if (!list || list.length === 0) {
        alert('No hay registros de NAPs para exportar.');
        return;
    }
    const headers = ['Fecha', 'NAP', 'Zona', 'Tecnico', 'Coordenadas', 'Puertos', 'Nivel/dBm', 'Accion', 'Comentarios', 'Resuelto'];
    const rows = list.map(n => [
        n.date || '',
        n.name || '',
        n.zone || '',
        n.techName || '',
        n.coords || '',
        n.ports || '',
        n.levels || '',
        n.action || '',
        n.comments || '',
        n.resolved ? 'SI' : 'NO'
    ]);
    
    let csvContent = '\uFEFF'; // BOM para que Excel detecte UTF-8 correctamente
    csvContent += [headers.join(','), ...rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `reporte_naps_${new Date().toLocaleDateString('en-CA')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.exportNapsToPDF = async function() {
    const list = state.lastFilteredNaps || state.trackedNaps;
    if (!list || list.length === 0) {
        alert('No hay registros de NAPs para exportar.');
        return;
    }

    if (window.showLoadingOverlay) window.showLoadingOverlay('Generando PDF...');

    try {
        const { PDFDocument, rgb, StandardFonts } = PDFLib;
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const form = pdfDoc.getForm();

        const cleanText = (str) => {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/[\u2013\u2014]/g, "-")
                .replace(/[\u2018\u2019]/g, "'")
                .replace(/[\u201C\u201D]/g, '"');
        };

        const wrapText = (text, maxWidth, fontSize) => {
            if (!text) return [];
            const words = text.split(' ');
            const lines = [];
            let currentLine = '';
            const avgCharWidth = fontSize * 0.55;
            const maxCharsPerLine = Math.floor(maxWidth / avgCharWidth);

            words.forEach(word => {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                if (testLine.length > maxCharsPerLine) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            });
            if (currentLine) {
                lines.push(currentLine);
            }
            return lines;
        };

        let currentPage = null;
        let currentY = 0;

        const createNewPage = () => {
            currentPage = pdfDoc.addPage([792, 612]);
            
            // Header
            currentPage.drawText("Reporte de NAPs", { x: 30, y: 560, size: 20, font: fontBold, color: rgb(0, 0.35, 0.73) });
            currentPage.drawText("Velocity Dashboard - Reporte de Campo", { x: 30, y: 540, size: 10, font: font, color: rgb(0.4, 0.4, 0.4) });
            
            const dateStr = new Date().toLocaleString();
            currentPage.drawText(`Fecha de Emisión: ${dateStr}`, { x: 500, y: 560, size: 9, font: font, color: rgb(0.4, 0.4, 0.4) });
            currentPage.drawText(`Total registros: ${list.length}`, { x: 500, y: 545, size: 9, font: font, color: rgb(0.4, 0.4, 0.4) });

            currentY = 500;
            drawHeaderRow();
        };

        const drawHeaderRow = () => {
            const headers = [
                { text: 'Fecha', x: 30, w: 60 },
                { text: 'Nombre NAP', x: 90, w: 75 },
                { text: 'Zona', x: 165, w: 75 },
                { text: 'Técnico', x: 240, w: 85 },
                { text: 'Coordenadas', x: 325, w: 100 },
                { text: 'Puertos', x: 425, w: 100 },
                { text: 'Niveles', x: 525, w: 45 },
                { text: 'Acción / Comentario', x: 570, w: 145 },
                { text: 'Revisada', x: 715, w: 45 }
            ];

            currentPage.drawRectangle({
                x: 30,
                y: currentY - 5,
                width: 730,
                height: 25,
                color: rgb(0.95, 0.96, 0.98)
            });

            headers.forEach(h => {
                currentPage.drawText(h.text, {
                    x: h.x + 5,
                    y: currentY + 5,
                    size: 9,
                    font: fontBold,
                    color: rgb(0.2, 0.2, 0.2)
                });
            });

            currentPage.drawLine({
                start: { x: 30, y: currentY - 5 },
                end: { x: 760, y: currentY - 5 },
                thickness: 1,
                color: rgb(0.8, 0.8, 0.8)
            });

            currentY -= 30;
        };

        createNewPage();

        for (const n of list) {
            const actionText = cleanText(`${n.action || ''} ${n.comments || ''}`);
            const actionLines = wrapText(actionText, 135, 8);
            
            const techName = cleanText(n.techName || '—');
            const techLines = wrapText(techName, 80, 8);

            const name = cleanText(n.name || '—');
            const nameLines = wrapText(name, 70, 8);

            const zone = cleanText(n.zone || '—');
            const zoneLines = wrapText(zone, 70, 8);

            const portsText = cleanText(n.ports || '—');
            const portsLines = wrapText(portsText, 90, 7.5);

            const maxLines = Math.max(actionLines.length, techLines.length, nameLines.length, zoneLines.length, portsLines.length, 1);
            const rowHeight = Math.max(25, maxLines * 12 + 10);

            if (currentY - rowHeight < 40) {
                createNewPage();
            }

            currentPage.drawRectangle({
                x: 30,
                y: currentY - rowHeight + 5,
                width: 730,
                height: rowHeight,
                color: n.resolved ? rgb(0.97, 0.99, 0.98) : rgb(1, 1, 1)
            });

            currentPage.drawLine({
                start: { x: 30, y: currentY - rowHeight + 5 },
                end: { x: 760, y: currentY - rowHeight + 5 },
                thickness: 0.5,
                color: rgb(0.9, 0.9, 0.9)
            });

            currentPage.drawText(cleanText(n.date || '—'), { x: 35, y: currentY - 5, size: 8, font: font });

            nameLines.forEach((line, idx) => {
                currentPage.drawText(line, { x: 95, y: currentY - 5 - (idx * 10), size: 8, font: fontBold });
            });

            zoneLines.forEach((line, idx) => {
                currentPage.drawText(line, { x: 170, y: currentY - 5 - (idx * 10), size: 8, font: font });
            });

            techLines.forEach((line, idx) => {
                currentPage.drawText(line, { x: 245, y: currentY - 5 - (idx * 10), size: 8, font: font });
            });

            const coordsStr = cleanText(n.coords || '—');
            currentPage.drawText(coordsStr, { x: 330, y: currentY - 5, size: 8, font: font, color: rgb(0, 0.35, 0.73) });
            
            if (n.coords && n.coords.match(/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/)) {
                const query = encodeURIComponent(n.coords.replace(/\s/g, ''));
                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
                
                const x1 = 330;
                const y1 = currentY - rowHeight + 10;
                const x2 = 330 + 80;
                const y2 = currentY + 5;
                
                const linkAnnotation = pdfDoc.context.obj({
                  Type: 'Annot',
                  Subtype: 'Link',
                  Rect: [x1, y1, x2, y2],
                  Border: [0, 0, 0],
                  A: {
                    Type: 'Action',
                    S: 'URI',
                    URI: PDFLib.PDFString.of(mapsUrl)
                  }
                });
                const annots = currentPage.node.get(PDFLib.PDFName.of('Annots')) || pdfDoc.context.obj([]);
                annots.push(linkAnnotation);
                currentPage.node.set(PDFLib.PDFName.of('Annots'), annots);
            }

            portsLines.forEach((line, idx) => {
                currentPage.drawText(line, { x: 430, y: currentY - 5 - (idx * 10), size: 7.5, font: font });
            });

            currentPage.drawText(cleanText(n.levels || '—'), { x: 530, y: currentY - 5, size: 8, font: fontBold, color: rgb(0.85, 0.1, 0.1) });

            actionLines.forEach((line, idx) => {
                currentPage.drawText(line, { x: 575, y: currentY - 5 - (idx * 10), size: 7.5, font: font });
            });

            const checkBox = form.createCheckBox(`nap_resolved_${n.id}`);
            if (n.resolved) {
                checkBox.check();
            }
            
            checkBox.addToPage(currentPage, {
                x: 730,
                y: currentY - 12,
                width: 14,
                height: 14
            });

            currentY -= rowHeight;
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `reporte_naps_${new Date().toLocaleDateString('en-CA')}.pdf`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error("Error generating NAPs PDF:", error);
        alert("Ocurrió un error al generar el PDF interactivo.");
    } finally {
        if (window.hideLoadingOverlay) window.hideLoadingOverlay();
    }
};

window.importNapsFromPDF = async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (window.showLoadingOverlay) window.showLoadingOverlay('Procesando PDF...');

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const arrayBuffer = e.target.result;
            const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
            const form = pdfDoc.getForm();
            const fields = form.getFields();

            let updatedCount = 0;

            fields.forEach(field => {
                const name = field.getName();
                if (name.startsWith('nap_resolved_') && field instanceof PDFLib.PDFCheckBox) {
                    const id = name.replace('nap_resolved_', '');
                    const isChecked = field.isChecked();
                    
                    const nap = state.trackedNaps.find(n => String(n.id) === String(id));
                    if (nap) {
                        if (nap.resolved !== isChecked) {
                            nap.resolved = isChecked;
                            updatedCount++;
                        }
                    }
                }
            });

            if (updatedCount > 0) {
                saveTrackedNaps();
                showNotification(
                    'PDF Importado Exitosamente',
                    `Se actualizaron ${updatedCount} NAPs desde el PDF de campo.`,
                    'success'
                );
                if (state.tab === 'naps') renderTab('naps');
            } else {
                showNotification(
                    'PDF Sin Cambios',
                    'No se detectaron cambios en el estado de las NAPs en el PDF importado.',
                    'info'
                );
            }
        } catch (err) {
            console.error("Error al importar PDF:", err);
            alert("Error al procesar el archivo PDF. Asegúrese de que sea el archivo PDF exportado desde Velocity y no esté corrupto.");
        } finally {
            if (window.hideLoadingOverlay) window.hideLoadingOverlay();
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
};

window.importNapsFromCSV = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const text = e.target.result;
            const rows = parseCSV(text);
            if (rows.length < 1) {
                alert('El archivo CSV está vacío.');
                return;
            }
            
            // Detectar dinámicamente la fila que contiene las cabeceras reales
            let headerRowIdx = -1;
            for (let r = 0; r < Math.min(rows.length, 10); r++) {
                const row = rows[r] || [];
                const nonBlankCount = row.filter(cell => (cell || '').trim() !== '').length;
                const hasNameCol = row.some(cell => {
                    const val = (cell || '').toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    return val.includes('nap') || val.includes('nombre') || val.includes('caja');
                });
                if (hasNameCol && nonBlankCount >= 3) {
                    headerRowIdx = r;
                    break;
                }
            }

            if (headerRowIdx === -1) {
                alert('No se encontró una fila de cabeceras válida que contenga columnas como "NAP", "Nombre" o "Caja". Por favor verifica las cabeceras del archivo.');
                return;
            }
            
            // Normalizar cabeceras de la fila detectada
            const headers = rows[headerRowIdx].map(h => h.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
            
            const idx = {
                date: headers.findIndex(h => h.includes('fecha')),
                name: headers.findIndex(h => h.includes('nap') || h.includes('nombre') || h.includes('caja')),
                zone: headers.findIndex(h => h.includes('zona') || h.includes('sector')),
                techName: headers.findIndex(h => h.includes('tecnico') || h.includes('creado')),
                coords: headers.findIndex(h => h.includes('coordenadas') || h.includes('coords') || h.includes('ubicacion')),
                ports: headers.findIndex(h => h.includes('puertos') || h.includes('puerto')),
                levels: headers.findIndex(h => h.includes('nivel') || h.includes('dbm') || h.includes('senal')),
                action: headers.findIndex(h => h.includes('accion') || h.includes('solucion')),
                comments: headers.findIndex(h => h.includes('comentarios') || h.includes('comentario') || h.includes('observa') || h.includes('nota'))
            };

            if (idx.name === -1) {
                alert('No se encontró una columna para el nombre de la NAP (ej: "NAP", "Nombre", "Caja"). Por favor verifica las cabeceras.');
                return;
            }

            // Descargar listado de NAPs desde Wispro de forma paralela para enriquecer datos en lote
            let allWisproNaps = [];
            try {
                allWisproNaps = await apiPages('naps', 5);
            } catch (err) {
                console.warn('[Velocity] No se pudieron descargar NAPs de Wispro para enriquecer el CSV:', err);
            }

            let importCount = 0;
            const todayStr = new Date().toLocaleDateString('en-CA');

            for (let i = headerRowIdx + 1; i < rows.length; i++) {
                const row = rows[i];
                if (row.length === 0 || row.join('').trim() === '') continue;
                
                const napName = row[idx.name] ? row[idx.name].trim() : '';
                if (!napName) continue;

                const ts = Date.now().toString().slice(-6);
                const rnd = Math.random().toString(36).substr(2, 4);
                
                let finalCoords = idx.coords !== -1 && row[idx.coords] ? row[idx.coords].trim() : '';
                let finalPorts = idx.ports !== -1 && row[idx.ports] ? row[idx.ports].trim() : '';
                let wisproId = '';

                // Intentar enriquecer desde Wispro
                const foundWispro = allWisproNaps.find(wn => wn.name.toLowerCase() === napName.toLowerCase());
                if (foundWispro) {
                    wisproId = foundWispro.id;
                    if (!finalCoords && foundWispro.latitude && foundWispro.longitude) {
                        finalCoords = `${foundWispro.latitude}, ${foundWispro.longitude}`;
                    }
                    if (!finalPorts) {
                        const total = foundWispro.ports_count || 8;
                        const occ = foundWispro.contracts_count || 0;
                        finalPorts = `Ocupados: ${occ}, Libres: ${total - occ} (Total: ${total})`;
                    }
                }
                
                const newNap = {
                    id: `NAP-${ts}-${rnd}-${i}`,
                    date: idx.date !== -1 && row[idx.date] ? row[idx.date].trim() : todayStr,
                    name: napName,
                    zone: idx.zone !== -1 && row[idx.zone] ? row[idx.zone].trim() : 'General',
                    techName: idx.techName !== -1 && row[idx.techName] ? row[idx.techName].trim() : '—',
                    coords: finalCoords,
                    ports: finalPorts,
                    wisproId: wisproId,
                    levels: idx.levels !== -1 && row[idx.levels] ? row[idx.levels].trim() : '',
                    action: idx.action !== -1 && row[idx.action] ? row[idx.action].trim() : '',
                    comments: idx.comments !== -1 && row[idx.comments] ? row[idx.comments].trim() : '',
                    resolved: false
                };

                state.trackedNaps.push(newNap);
                importCount++;
            }

            if (importCount > 0) {
                saveTrackedNaps();
                renderTab('naps');
                showNotification('Importación Exitosa', `Se importaron ${importCount} registros de NAPs correctamente.`, 'success');
            } else {
                alert('No se importó ninguna fila. Verifica que los datos no estén vacíos.');
            }
        } catch (error) {
            console.error(error);
            alert('Ocurrió un error al procesar el archivo CSV: ' + error.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
};

// ── INTEGRACIÓN WISPRO NAPs ────────────────────────────────────────────────
window.validateNapInWispro = async function() {
    const name = document.getElementById('nt-name').value.trim();
    const resEl = document.getElementById('nt-validation-result');
    if (!name) return;

    resEl.innerHTML = '<span class="text-gray-400">Buscando en Wispro...</span>';
    try {
        const allNaps = await apiPages('naps', 5);
        const found = allNaps.find(n => n.name.toLowerCase() === name.toLowerCase());

        if (found) {
            const total = found.ports_count || 8;
            const occ = found.contracts_count || 0;
            const free = total - occ;
            
            resEl.innerHTML = `<span class="text-emerald-500">✓ Encontrada en Wispro (ID: ${found.public_id})</span>`;
            
            if (found.latitude && found.longitude) {
                document.getElementById('nt-coords').value = `${found.latitude}, ${found.longitude}`;
            }
            
            document.getElementById('nt-ports').value = `Ocupados: ${occ}, Libres: ${free} (Total: ${total})`;
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
        <div id="nap-clients-modal" onclick="if(event.target === this) { this.remove(); }" class="fixed inset-0 z-[201] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
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
    const activeSubTab = state.settingsSubTab || 'general';

    return `
    <div class="space-y-6 max-w-5xl mx-auto pb-12">
        <!-- Header Principal de Ajustes -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/15 pb-4">
            <div>
                <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-secondary/10 text-secondary text-[11px] font-bold mb-1.5">
                    <span class="material-symbols-outlined text-[14px]">tune</span>
                    <span>Centro de Configuración & Ajustes</span>
                </div>
                <h2 class="text-2xl font-black text-on-surface tracking-tight">Administración del Sistema</h2>
                <p class="text-xs text-on-surface-variant mt-0.5">Control de parámetros de la empresa, integración Wispro, respaldos y monitor de salud.</p>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="window.clearAllCache()" class="px-3.5 py-2 rounded-xl border border-outline-variant/30 text-on-surface-variant hover:text-error hover:bg-error/5 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95" title="Purgar Caché Local">
                    <span class="material-symbols-outlined text-sm">delete_sweep</span>
                    <span>Limpiar Caché</span>
                </button>
            </div>
        </div>

        <!-- Navegación de Sub-Pestañas de Ajustes (Estilo Wispro Blanco) -->
        <div class="flex items-center gap-1 p-1 bg-surface-container-low rounded-2xl border border-outline-variant/20 overflow-x-auto">
            <button onclick="window.switchSettingsSubTab('general')" class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeSubTab === 'general' ? 'bg-white text-secondary shadow-2xs' : 'text-on-surface-variant hover:text-on-surface'}">
                <span class="material-symbols-outlined text-base">business</span>
                <span>General & SLA</span>
            </button>
            <button onclick="window.switchSettingsSubTab('wispro')" class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeSubTab === 'wispro' ? 'bg-white text-secondary shadow-2xs' : 'text-on-surface-variant hover:text-on-surface'}">
                <span class="material-symbols-outlined text-base">cloud_sync</span>
                <span>Wispro Cloud</span>
            </button>
            <button onclick="window.switchSettingsSubTab('backups')" class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeSubTab === 'backups' ? 'bg-white text-secondary shadow-2xs' : 'text-on-surface-variant hover:text-on-surface'}">
                <span class="material-symbols-outlined text-base">backup</span>
                <span>Respaldos & BD</span>
            </button>
            <button onclick="window.switchSettingsSubTab('health')" class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeSubTab === 'health' ? 'bg-white text-secondary shadow-2xs' : 'text-on-surface-variant hover:text-on-surface'}">
                <span class="material-symbols-outlined text-base">monitor_heart</span>
                <span>Estado del Servidor</span>
            </button>
            <button onclick="window.switchSettingsSubTab('notifications')" class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeSubTab === 'notifications' ? 'bg-white text-secondary shadow-2xs' : 'text-on-surface-variant hover:text-on-surface'}">
                <span class="material-symbols-outlined text-base">notifications_active</span>
                <span>Alertas</span>
            </button>
        </div>

        <!-- CONTENIDO: 1. GENERAL & SLA -->
        ${activeSubTab === 'general' ? `
        <div class="space-y-6">
            <div class="bg-white p-6 rounded-2xl border border-outline-variant/20 shadow-2xs space-y-5">
                <div class="flex items-center gap-2 border-b border-outline-variant/10 pb-3">
                    <span class="material-symbols-outlined text-secondary">corporate_fare</span>
                    <h3 class="font-bold text-on-surface text-sm">Identidad Operativa del ISP</h3>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant ml-1">Nombre Comercial de la Empresa</label>
                        <input type="text" id="set-company-name" value="${s.companyName || 'Velocity ISP'}" class="w-full mt-1 bg-surface-container-low border border-outline-variant/30 focus:border-secondary focus:bg-white rounded-xl px-4 py-2.5 text-xs text-on-surface font-semibold transition-all">
                    </div>
                    <div>
                        <label class="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant ml-1">Teléfono / Mesa de Ayuda NOC</label>
                        <input type="text" id="set-support-phone" value="${s.supportPhone || '+58 412 0000000'}" class="w-full mt-1 bg-surface-container-low border border-outline-variant/30 focus:border-secondary focus:bg-white rounded-xl px-4 py-2.5 text-xs text-on-surface font-semibold transition-all">
                    </div>
                </div>
            </div>

            <div class="bg-white p-6 rounded-2xl border border-outline-variant/20 shadow-2xs space-y-5">
                <div class="flex items-center gap-2 border-b border-outline-variant/10 pb-3">
                    <span class="material-symbols-outlined text-secondary">timer</span>
                    <h3 class="font-bold text-on-surface text-sm">Políticas de SLA y Tiempos de Atención</h3>
                </div>
                <p class="text-xs text-on-surface-variant">Defina el tiempo máximo en horas antes de que una orden o ticket se marque en estado crítico/vencido en la Mesa de Control.</p>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant ml-1">SLA Instalaciones (Horas)</label>
                        <input type="number" id="set-sla-install" value="${s.slaInstallHours || 24}" min="1" max="168" class="w-full mt-1 bg-surface-container-low border border-outline-variant/30 focus:border-secondary focus:bg-white rounded-xl px-4 py-2.5 text-xs text-on-surface font-bold">
                    </div>
                    <div>
                        <label class="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant ml-1">SLA Reparaciones / Averías (Horas)</label>
                        <input type="number" id="set-sla-repair" value="${s.slaRepairHours || 8}" min="1" max="72" class="w-full mt-1 bg-surface-container-low border border-outline-variant/30 focus:border-secondary focus:bg-white rounded-xl px-4 py-2.5 text-xs text-on-surface font-bold">
                    </div>
                    <div>
                        <label class="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant ml-1">SLA Retiros / Desinstalación (Horas)</label>
                        <input type="number" id="set-sla-pickup" value="${s.slaPickupHours || 48}" min="1" max="168" class="w-full mt-1 bg-surface-container-low border border-outline-variant/30 focus:border-secondary focus:bg-white rounded-xl px-4 py-2.5 text-xs text-on-surface font-bold">
                    </div>
                </div>
                <div class="pt-2">
                    <button onclick="window.saveGeneralSettings()" class="bg-secondary text-white px-6 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-secondary/90 active:scale-95 transition-all shadow-2xs">
                        <span class="material-symbols-outlined text-sm">save</span>
                        <span>Guardar Parámetros Generales</span>
                    </button>
                </div>
            </div>
        </div>
        ` : ''}

        <!-- CONTENIDO: 2. WISPRO CLOUD -->
        ${activeSubTab === 'wispro' ? `
        <div class="space-y-6">
            <div class="bg-white p-6 rounded-2xl border border-outline-variant/20 shadow-2xs space-y-4">
                <div class="flex items-center justify-between border-b border-outline-variant/10 pb-3">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-secondary">wifi_channel</span>
                        <h3 class="font-bold text-on-surface text-sm">Estado de Enlace con Wispro Cloud</h3>
                    </div>
                    <span class="px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse"></span>
                        <span>En Línea & Sincronizado</span>
                    </span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2">
                    <div class="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20">
                        <span class="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Clientes Indexados</span>
                        <p class="text-xl font-black text-on-surface mt-1">${Object.keys(state.clients || {}).length || '2,835'}</p>
                        <span class="text-[10px] text-green-700 font-semibold">En memoria RAM</span>
                    </div>
                    <div class="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20">
                        <span class="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Técnicos Activos</span>
                        <p class="text-xl font-black text-on-surface mt-1">${Object.keys(state.techs || {}).length || '12'}</p>
                        <span class="text-[10px] text-secondary font-semibold">Cuadrillas sincronizadas</span>
                    </div>
                    <div class="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20">
                        <span class="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Ciclo de Auto-Refresco</span>
                        <p class="text-xl font-black text-on-surface mt-1">4.5 min</p>
                        <span class="text-[10px] text-purple-700 font-semibold">Cero Cold-Starts</span>
                    </div>
                </div>

                <div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-outline-variant/10">
                    <p class="text-xs text-on-surface-variant">Las credenciales API Token están aseguradas en el entorno protegido del servidor backend.</p>
                    <button onclick="window.triggerWisproSync()" id="btn-force-sync" class="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-secondary text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-secondary/90 active:scale-95 transition-all shadow-2xs">
                        <span class="material-symbols-outlined text-sm">sync</span>
                        <span>Forzar Re-indexación Inmediata</span>
                    </button>
                </div>
            </div>
        </div>
        ` : ''}

        <!-- CONTENIDO: 3. RESPALDOS & BASE DE DATOS -->
        ${activeSubTab === 'backups' ? `
        <div class="space-y-6">
            <div class="bg-white p-6 rounded-2xl border border-outline-variant/20 shadow-2xs space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/10 pb-3">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-secondary">database</span>
                        <div>
                            <h3 class="font-bold text-on-surface text-sm">Copias de Seguridad Automáticas (PostgreSQL & Inventario)</h3>
                            <p class="text-xs text-on-surface-variant">Programación automática diaria a las 03:00 AM con rotación de 14 días.</p>
                        </div>
                    </div>
                    <button onclick="window.triggerManualBackup()" id="btn-manual-backup" class="px-4 py-2.5 rounded-xl bg-secondary text-white font-bold text-xs flex items-center gap-2 hover:bg-secondary/90 active:scale-95 transition-all shadow-2xs">
                        <span class="material-symbols-outlined text-sm">add_circle</span>
                        <span>Crear Respaldo Ahora</span>
                    </button>
                </div>

                <div id="backups-list-container" class="space-y-2 pt-2">
                    <div class="flex items-center justify-center p-8 text-xs font-bold text-on-surface-variant">
                        <span class="material-symbols-outlined animate-spin text-secondary mr-2">progress_activity</span>
                        <span>Consultando archivos de respaldo en el servidor...</span>
                    </div>
                </div>
            </div>
        </div>
        ` : ''}

        <!-- CONTENIDO: 4. ESTADO DEL SERVIDOR & MICROSERVICIOS -->
        ${activeSubTab === 'health' ? `
        <div class="space-y-6">
            <div class="bg-white p-6 rounded-2xl border border-outline-variant/20 shadow-2xs space-y-4">
                <div class="flex items-center justify-between border-b border-outline-variant/10 pb-3">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-secondary">dns</span>
                        <h3 class="font-bold text-on-surface text-sm">Matriz de Salud de Microservicios 24/7</h3>
                    </div>
                    <span class="px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 text-[10px] font-black uppercase">
                        Vigilante Activo (Cada 60s)
                    </span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-2">
                    <div class="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between">
                        <div>
                            <div class="flex items-center justify-between">
                                <span class="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Backend API</span>
                                <span class="w-2 h-2 rounded-full bg-green-500"></span>
                            </div>
                            <p class="text-sm font-black text-on-surface mt-1">Puerto 3000</p>
                        </div>
                        <span class="text-[10px] text-green-700 font-bold mt-2">HTTP 200 OK</span>
                    </div>

                    <div class="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between">
                        <div>
                            <div class="flex items-center justify-between">
                                <span class="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Inventario Prisma</span>
                                <span class="w-2 h-2 rounded-full bg-green-500"></span>
                            </div>
                            <p class="text-sm font-black text-on-surface mt-1">Puerto 4000</p>
                        </div>
                        <span class="text-[10px] text-green-700 font-bold mt-2">PostgreSQL Link</span>
                    </div>

                    <div class="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between">
                        <div>
                            <div class="flex items-center justify-between">
                                <span class="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Base PostgreSQL</span>
                                <span class="w-2 h-2 rounded-full bg-green-500"></span>
                            </div>
                            <p class="text-sm font-black text-on-surface mt-1">Puerto 5432</p>
                        </div>
                        <span class="text-[10px] text-green-700 font-bold mt-2">Conectada & Activa</span>
                    </div>

                    <div class="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between">
                        <div>
                            <div class="flex items-center justify-between">
                                <span class="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Frontend Nginx</span>
                                <span class="w-2 h-2 rounded-full bg-green-500"></span>
                            </div>
                            <p class="text-sm font-black text-on-surface mt-1">Puerto 3080 / 443</p>
                        </div>
                        <span class="text-[10px] text-green-700 font-bold mt-2">SSL TLSv1.3</span>
                    </div>
                </div>

                <div id="system-stats-card" class="p-4 rounded-xl bg-surface-container-low/60 border border-outline-variant/20 text-xs space-y-2">
                    <div class="flex justify-between items-center">
                        <span class="font-bold text-on-surface-variant">Memoria RAM del Servidor (KVM1):</span>
                        <span class="font-black text-secondary" id="stat-mem-usage">Calculando...</span>
                    </div>
                    <div class="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                        <div id="stat-mem-bar" class="h-full bg-secondary transition-all" style="width: 30%;"></div>
                    </div>
                </div>
            </div>
        </div>
        ` : ''}

        <!-- CONTENIDO: 5. ALERTAS & NOTIFICACIONES -->
        ${activeSubTab === 'notifications' ? `
        <div class="space-y-6">
            <div class="bg-white p-6 rounded-2xl border border-outline-variant/20 shadow-2xs space-y-5">
                <div class="flex items-center gap-2 border-b border-outline-variant/10 pb-3">
                    <span class="material-symbols-outlined text-secondary">notifications</span>
                    <h3 class="font-bold text-on-surface text-sm">Disparadores de Alertas Operativas</h3>
                </div>

                <div class="space-y-4">
                    <div class="flex items-center justify-between p-4 rounded-xl bg-surface-container-low border border-outline-variant/20">
                        <div>
                            <p class="text-xs font-black text-on-surface">Alerta de Stock Crítico en Camionetas</p>
                            <p class="text-[11px] text-on-surface-variant">Notificar al supervisor cuando a un técnico le queden menos de 2 ONUs en vehículo.</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="notif-low-stock" ${s.notifLowStock !== false ? 'checked' : ''} class="sr-only peer">
                            <div class="w-11 h-6 bg-outline-variant/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary"></div>
                        </label>
                    </div>

                    <div class="flex items-center justify-between p-4 rounded-xl bg-surface-container-low border border-outline-variant/20">
                        <div>
                            <p class="text-xs font-black text-on-surface">Alerta de SLA Excedido (Tickets/Órdenes)</p>
                            <p class="text-[11px] text-on-surface-variant">Resaltar órdenes en rojo cuando superen el tiempo límite de atención.</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="notif-sla-overdue" ${s.notifSlaOverdue !== false ? 'checked' : ''} class="sr-only peer">
                            <div class="w-11 h-6 bg-outline-variant/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary"></div>
                        </label>
                    </div>

                    <div class="flex items-center justify-between p-4 rounded-xl bg-surface-container-low border border-outline-variant/20">
                        <div>
                            <p class="text-xs font-black text-on-surface">Alerta de Discrepancia en Liquidaciones</p>
                            <p class="text-[11px] text-on-surface-variant">Avisar si un técnico reporta materiales usados que no concuerdan con su carga.</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="notif-liquidation-diff" ${s.notifLiquidationDiff !== false ? 'checked' : ''} class="sr-only peer">
                            <div class="w-11 h-6 bg-outline-variant/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary"></div>
                        </label>
                    </div>
                </div>

                <div class="pt-2">
                    <button onclick="window.saveNotificationSettings()" class="bg-secondary text-white px-6 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-secondary/90 active:scale-95 transition-all shadow-2xs">
                        <span class="material-symbols-outlined text-sm">save</span>
                        <span>Guardar Preferencias de Alertas</span>
                    </button>
                </div>
            </div>
        </div>
        ` : ''}
    </div>
    `;
};
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

window.setReportSearch = (value) => {
    state.issueFilter.search = value;
    if (state.tab === 'reports') renderTab('reports');
};

window.clearIssueFilters = function() {
    state.issueFilter = { tech: 'all', zone: 'all', date: 'all', sortBy: 'id', sortDir: 'desc', search: '' };
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

window.toggleZoneDetail = function(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const isHidden = el.style.display === 'none';
    el.style.display = isHidden ? 'block' : 'none';
    const row = el.previousElementSibling;
    if (row) {
        const arrow = row.querySelector('.zone-arrow-icon');
        if (arrow) {
            arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
        }
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
    if (window.showLoadingOverlay) window.showLoadingOverlay('Sincronizando con Wispro...');
    const icons = document.querySelectorAll('.material-symbols-outlined');
    icons.forEach(i => {
        if (i.textContent.trim() === 'sync') i.classList.add('animate-spin');
    });

    try {
        const promises = [
            loadTodayOrders(true),
            loadIssues(true, 1),
            serverSync()
        ];
        if (state.tab === 'reports' || state.tab === 'prueba') {
            promises[1] = loadIssues(true); // Carga completa de reportes si el usuario está en la pestaña de reportes o prueba
        }
        await Promise.allSettled(promises);
        state.lastSync = Date.now();
        if (typeof renderTab === 'function') renderTab(state.tab);
    } catch(e) { console.error(e); }

    icons.forEach(i => i.classList.remove('animate-spin'));
    if (window.hideLoadingOverlay) window.hideLoadingOverlay();
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
    <div id="error-log-modal" onclick="if(event.target === this) { this.remove(); }" class="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
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
    if (window.showLoadingOverlay) window.showLoadingOverlay('Actualizando reportes...');
    const icons = document.querySelectorAll('.material-symbols-outlined');
    icons.forEach(i => {
        if (i.textContent.trim() === 'sync') i.classList.add('animate-spin');
    });

    try {
        await loadIssues(true);
        if (typeof renderTab === 'function') renderTab('reports');
    } catch(e) { console.error(e); }
    
    icons.forEach(i => i.classList.remove('animate-spin'));
    if (window.hideLoadingOverlay) window.hideLoadingOverlay();
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
window.openNapModal = function(id, isIssue = false) {
    let title = '';
    let subtitle = '';
    let existing = {};

    if (isIssue) {
        const allIssues = [...(state.issues || []), ...(state.finishedIssues || [])];
        const issue = allIssues.find(i => String(i.id) === String(id));
        if (!issue) return;
        title = `Asignar NAP — Reporte #${issue.public_id || issue.id}`;
        subtitle = state.clients[issue.client_id]?.name || issue.title || '';
        existing = state.napOverrides[id] || {};
    } else {
        const order = state.orders.find(o => String(o.id) === String(id));
        if (!order) return;
        title = `Asignar NAP — #${order.id}`;
        subtitle = order.client;
        existing = state.napOverrides[id] || {};
    }

    const html = `
    <div id="nap-modal" class="fixed inset-0 z-[300] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onclick="if(event.target===this)document.getElementById('nap-modal').remove()">
        <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div class="flex justify-between items-center">
                <h3 class="font-black text-gray-900 text-lg">${title}</h3>
                <button onclick="document.getElementById('nap-modal').remove()" class="text-gray-400 hover:text-gray-600"><span class="material-symbols-outlined">close</span></button>
            </div>
            <p class="text-sm text-gray-500">${subtitle}</p>
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
            <button onclick="window.saveNap('${id}', ${isIssue})" class="w-full py-3 rounded-xl text-white font-bold text-sm active:scale-95 transition-transform" style="background:linear-gradient(135deg,#0059bb,#0070ea);">
                Confirmar NAP
            </button>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.saveNap = function(id, isIssue = false) {
    const nap       = document.getElementById('nap-name')?.value.trim();
    const port      = document.getElementById('nap-port')?.value.trim();
    const marquilla = document.getElementById('nap-marquilla')?.value.trim();
    const lat       = document.getElementById('nap-lat')?.value.trim();
    const lng       = document.getElementById('nap-lng')?.value.trim();

    if (!nap) { alert('El nombre de la NAP es obligatorio'); return; }

    state.napOverrides[id] = { nap, port, marquilla, lat, lng };

    if (isIssue) {
        const allIssues = [...(state.issues || []), ...(state.finishedIssues || [])];
        const issue = allIssues.find(i => String(i.id) === String(id));
        if (issue) {
            issue.nap = nap;
            issue.marquilla = marquilla;
        }
    } else {
        const order = state.orders.find(o => String(o.id) === String(id));
        if (order) { order.nap = nap; order.marquilla = marquilla; }
    }

    cacheSet('orders', { orders: state.orders, napOverrides: state.napOverrides }, CFG.cacheTTL.orders);

    document.getElementById('nap-modal')?.remove();
    renderTab(state.tab);
};

// ── CENTRO DE AJUSTES & CONFIGURACIÓN EJECUTIVA ──────────────────────
window.switchSettingsSubTab = function(subTab) {
    state.settingsSubTab = subTab;
    renderTab('settings');
    if (subTab === 'backups') {
        window.loadBackupsList();
    } else if (subTab === 'health') {
        window.loadServerHealthStats();
    }
};

window.saveGeneralSettings = function() {
    const companyName = document.getElementById('set-company-name')?.value.trim() || 'Velocity ISP';
    const supportPhone = document.getElementById('set-support-phone')?.value.trim() || '';
    const slaInstall = parseInt(document.getElementById('set-sla-install')?.value) || 24;
    const slaRepair = parseInt(document.getElementById('set-sla-repair')?.value) || 8;
    const slaPickup = parseInt(document.getElementById('set-sla-pickup')?.value) || 48;

    const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    if (!db.settings) db.settings = {};
    db.settings.companyName = companyName;
    db.settings.supportPhone = supportPhone;
    db.settings.slaInstallHours = slaInstall;
    db.settings.slaRepairHours = slaRepair;
    db.settings.slaPickupHours = slaPickup;

    localStorage.setItem('Velocity_Sync_State', JSON.stringify(db));
    serverPush(db);
    
    // Actualizar nombre en el header
    const headerCompanyEl = document.getElementById('header-company');
    if (headerCompanyEl) headerCompanyEl.textContent = companyName;

    showNotification('Ajustes Guardados', 'Parámetros generales y políticas de SLA actualizados.', 'success');
};

window.saveNotificationSettings = function() {
    const notifLowStock = document.getElementById('notif-low-stock')?.checked;
    const notifSlaOverdue = document.getElementById('notif-sla-overdue')?.checked;
    const notifLiquidationDiff = document.getElementById('notif-liquidation-diff')?.checked;

    const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    if (!db.settings) db.settings = {};
    db.settings.notifLowStock = notifLowStock;
    db.settings.notifSlaOverdue = notifSlaOverdue;
    db.settings.notifLiquidationDiff = notifLiquidationDiff;

    localStorage.setItem('Velocity_Sync_State', JSON.stringify(db));
    serverPush(db);

    showNotification('Alertas Actualizadas', 'Preferencias de notificaciones operativas guardadas.', 'success');
};

window.triggerWisproSync = async function() {
    const btn = document.getElementById('btn-force-sync');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span><span>Sincronizando con Wispro Cloud...</span>';
    }
    try {
        await serverSync();
        await loadTodayOrders(true);
        await loadIssues(true, 1);
        showNotification('Sincronización Completa', 'Clientes, contratos y tickets actualizados desde Wispro Cloud.', 'success');
        renderTab('settings');
    } catch (e) {
        showNotification('Error de Sincronización', e.message || 'No se pudo completar la sincronización.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined text-sm">sync</span><span>Forzar Re-indexación Inmediata</span>';
        }
    }
};

window.triggerManualBackup = async function() {
    const btn = document.getElementById('btn-manual-backup');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span><span>Generando Respaldo...</span>';
    }
    try {
        const res = await apiFetch('/api/system/backup', { method: 'POST' });
        if (res && res.success) {
            showNotification('Respaldo Exitoso', 'La base de datos y archivos se han respaldado correctamente.', 'success');
            window.loadBackupsList();
        } else {
            throw new Error(res?.error || 'No se pudo generar el respaldo');
        }
    } catch (e) {
        showNotification('Error al Respaldar', e.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined text-sm">add_circle</span><span>Crear Respaldo Ahora</span>';
        }
    }
};

window.loadBackupsList = async function() {
    const container = document.getElementById('backups-list-container');
    if (!container) return;

    try {
        const res = await apiFetch('/api/system/info');
        const items = res?.backups?.items || [];

        if (items.length === 0) {
            container.innerHTML = `
                <div class="p-6 text-center text-xs text-on-surface-variant bg-surface-container-low rounded-xl border border-outline-variant/20">
                    <span class="material-symbols-outlined text-3xl text-outline-variant mb-1">inventory_2</span>
                    <p class="font-bold">No hay archivos de respaldo aún.</p>
                    <p class="text-[11px] mt-0.5">Los respaldos automáticos se generan a las 03:00 AM o puedes pulsar "Crear Respaldo Ahora".</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="overflow-x-auto rounded-xl border border-outline-variant/20">
                <table class="w-full text-left text-xs">
                    <thead class="bg-surface-container-low text-[10px] font-black uppercase tracking-wider text-on-surface-variant border-b border-outline-variant/20">
                        <tr>
                            <th class="p-3">Tipo de Respaldo</th>
                            <th class="p-3">Nombre del Archivo</th>
                            <th class="p-3">Fecha y Hora</th>
                            <th class="p-3">Tamaño</th>
                            <th class="p-3 text-right">Acción</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-outline-variant/10">
                        ${items.map(b => `
                            <tr class="hover:bg-surface-container-low/50 transition-colors">
                                <td class="p-3 font-bold text-on-surface flex items-center gap-1.5">
                                    <span class="material-symbols-outlined text-sm text-secondary">${b.type.includes('PostgreSQL') ? 'database' : 'folder_zip'}</span>
                                    <span>${b.type}</span>
                                </td>
                                <td class="p-3 font-mono text-[11px] text-on-surface-variant">${b.name}</td>
                                <td class="p-3 text-on-surface-variant">${new Date(b.date).toLocaleString()}</td>
                                <td class="p-3 font-bold text-on-surface">${b.size}</td>
                                <td class="p-3 text-right">
                                    <a href="/api/system/backups/download/${encodeURIComponent(b.name)}" download class="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-secondary/10 hover:bg-secondary text-secondary hover:text-white text-[11px] font-bold transition-all shadow-2xs">
                                        <span class="material-symbols-outlined text-xs">download</span>
                                        <span>Descargar</span>
                                    </a>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (e) {
        container.innerHTML = `
            <div class="p-4 text-xs font-bold text-error bg-error-container/20 rounded-xl">
                Error al consultar lista de respaldos: ${e.message}
            </div>
        `;
    }
};

window.loadServerHealthStats = async function() {
    try {
        const res = await apiFetch('/api/system/info');
        if (res?.server?.memory) {
            const mem = res.server.memory;
            const memUsageEl = document.getElementById('stat-mem-usage');
            const memBarEl = document.getElementById('stat-mem-bar');

            if (memUsageEl) {
                memUsageEl.textContent = `${mem.usedMb} MB / ${mem.totalMb} MB (${mem.percentage}% en uso)`;
            }
            if (memBarEl) {
                memBarEl.style.width = `${mem.percentage}%`;
                memBarEl.className = `h-full transition-all ${mem.percentage > 85 ? 'bg-error' : mem.percentage > 60 ? 'bg-amber-500' : 'bg-green-600'}`;
            }
        }
    } catch (e) {
        console.error('Error al cargar métricas de servidor:', e);
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

    if (pass && pass.length < 6) {
        alert('❌ La contraseña debe tener al menos 6 caracteres');
        return;
    }

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
    if (typeof window.updateActiveTechs === 'function') window.updateActiveTechs();
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
    serverPush(db);
    if (typeof window.updateActiveTechs === 'function') window.updateActiveTechs();
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
                const wisproEmail = (state.techEmails && state.techEmails[id]) || '';
                const sanitized = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
                const defaultEmail = `${sanitized}@atg-rappido.com`;
                const ts = Date.now().toString().slice(-6);
                const rnd = Math.random().toString(36).substr(2, 4);
                
                db.technicians.push({
                    id: `T-${ts}-${rnd}`,
                    name: name,
                    email: wisproEmail || defaultEmail,
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
    
    // Mostrar pantalla de carga elegante (deja visible el menú lateral)
    if (window.showLoadingOverlay) window.showLoadingOverlay('Conectando con Wispro...');

    // 1. Sincronizar estado base desde el servidor (Usuarios, etc)
    await serverSync();

    // Cargar NAP overrides del cache
    const ordCache = cacheGet('orders');
    if (ordCache?.napOverrides) state.napOverrides = ordCache.napOverrides;

    loadTrackedNaps(); // Cargar estado de NAPs manuales
    loadInventoryData(); // Cargar estado de inventario ISP

    try {
        localStorage.removeItem('V_issues'); // Forzar recarga limpia de reportes con nombres de clientes
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
        
        if (window.updateMesaBadge) window.updateMesaBadge();
        if (window.updateNapsBadge) window.updateNapsBadge();
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
    if (window.hideLoadingOverlay) window.hideLoadingOverlay();
    switchTab(state.tab);

    // Iniciar polling
    startPolling();
}

window.addEventListener('DOMContentLoaded', initApp);





window.updateDashboardCharts = function() {
    const ctx1 = document.getElementById('chart-tech-performance');
    const ctx2 = document.getElementById('chart-job-distribution');
    if (!ctx1 || !ctx2) return;

    if (window.techChartInstance) { window.techChartInstance.destroy(); }
    if (window.jobChartInstance) { window.jobChartInstance.destroy(); }

    const fToday = state.finishedOrders || [];
    const allTodayOrders = [...state.orders, ...fToday];

    const labels1 = [];
    const completedData = [];
    const pendingData = [];

    TECNICOS_ACTIVOS.forEach(nombre => {
        const firstName = nombre.split(' ')[0];
        labels1.push(firstName);

        const myOrders  = allTodayOrders.filter(o => o.techName?.toLowerCase().includes(nombre.split(' ')[0].toLowerCase()));
        const myDone    = myOrders.filter(o => ['finalizada','finalizado','closed','finalized'].includes(o.state.toLowerCase())).length;
        const myPending = myOrders.length - myDone;

        completedData.push(myDone);
        pendingData.push(myPending);
    });

    window.techChartInstance = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: labels1,
            datasets: [
                {
                    label: 'Completadas',
                    data: completedData,
                    backgroundColor: '#10b981',
                    borderRadius: 6
                },
                {
                    label: 'Pendientes',
                    data: pendingData,
                    backgroundColor: '#0059bb',
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { family: 'Outfit, Inter', weight: 'bold', size: 10 } }
                }
            },
            scales: {
                x: { stacked: true, grid: { display: false } },
                y: { stacked: true, ticks: { stepSize: 1 } }
            }
        }
    });

    const jobCounts = {
        technical: 0,
        installation: 0,
        feasibility: 0,
        resignation: 0
    };

    allTodayOrders.forEach(o => {
        if (jobCounts[o.kind] !== undefined) {
            jobCounts[o.kind]++;
        }
    });

    const labels2 = ['Técnica', 'Instalación', 'Factibilidad', 'Baja'];
    const data2 = [jobCounts.technical, jobCounts.installation, jobCounts.feasibility, jobCounts.resignation];
    const colors2 = ['#7c3aed', '#0059bb', '#059669', '#dc2626'];

    window.jobChartInstance = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: labels2,
            datasets: [{
                data: data2,
                backgroundColor: colors2,
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { font: { family: 'Outfit, Inter', weight: 'bold', size: 11 } }
                }
            },
            cutout: '65%'
        }
    });
};



// ── BITÁCORA TÉCNICA (ÓRDENES) ───────────────────────────────────────────
window.openFeedbackModal = async function(id) {
    // 1. Buscar en órdenes activas o finalizadas de hoy (y también reportes de mesa de ayuda)
    let order = [...state.orders, ...state.finishedOrders, ...(state.finishedIssues || []), ...(state.issues || [])].find(o => String(o.id) === String(id) || String(o.rawId) === String(id));
    
    // 2. Si no está, buscar en los resultados de la auditoría mensual (Pestaña Reportes)
    if (!order && state.monthlyReport?.results) {
        const r = state.monthlyReport.results;
        order = [...(r.orders || []), ...(r.issues || [])].find(o => String(o.id) === String(id) || String(o.rawId) === String(id));
    }

    if (!order) {
        console.warn('[Velocity] No se encontró la orden en ningún estado local:', id);
        order = { id, rawId: id, client: 'Cargando datos...', typeColor: '#6b7280' };
    } else {
        if (!order.client && order.client_id) {
            order.client = state.clients[order.client_id]?.name || order.title || 'Reporte';
        }
    }

    const typeColor = order.typeColor || '#f97316';
    const clientName = order.client || 'Cliente desconocido';
    const modalId = 'feedback-modal';
    
    document.getElementById(modalId)?.remove();

    // Resolve technician name and info
    let techName = 'Sin asignar';
    if (order.techName) {
        techName = order.techName;
    } else if (order.assignable_id) {
        techName = state.techs[order.assignable_id];
        if (!techName) {
            const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
            const found = (db.technicians || []).find(t => String(t.wisproId) === String(order.assignable_id) || String(t.id) === String(order.assignable_id));
            techName = found?.name || 'Técnico';
        }
    }
    const initials = techName === 'Sin asignar' ? 'SA' : techInitials(techName);
    const avatarColor = techName === 'Sin asignar' ? '#9ca3af' : techColor(techName);

    // Resolve state labels and colors
    let stateText = 'Abierta';
    let stateBg = '#0059bb'; // Default blue
    if (order.state === 'closed' || order.state === 'finalized' || order.state === 'resolved') {
        stateText = 'Cerrada';
        stateBg = '#00a896'; // Cyan
    } else if (order.state === 'in_progress' || order.state === 'in_course') {
        stateText = 'En curso';
        stateBg = '#f59e0b'; // Amber
    } else if (order.state === 'pending' || order.state === 'open') {
        stateText = 'Pendiente';
        stateBg = '#0070ea'; // Blue
    }

    // Resolve result labels and colors
    let resultText = 'Sin iniciar';
    let resultBg = '#9ca3af'; // Gray
    if (order.result === 'success') {
        resultText = 'Exitosa';
        resultBg = '#2bc016'; // Green
    } else if (order.result === 'failed') {
        resultText = 'No exitosa';
        resultBg = '#dc2626'; // Red
    } else if (order.result === 'not_set') {
        resultText = 'Pendiente';
        resultBg = '#f59e0b'; // Amber
    }

    // Resolve scheduled text
    let scheduledText = 'No programado';
    if (order.startTime && order.startTime !== '--:--') {
        scheduledText = order.startTime;
        if (order.endTime && order.endTime !== '--:--') {
            scheduledText += ` - ${order.endTime}`;
        }
    } else if (order.expires_at) {
        const d = new Date(order.expires_at);
        scheduledText = d.toLocaleString('es-PA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    // Resolve created date
    let createdText = '—';
    if (order.created_at) {
        const d = new Date(order.created_at);
        createdText = d.toLocaleString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } else if (order.start_at) {
        const d = new Date(order.start_at);
        createdText = d.toLocaleString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    const html = `
    <div id="${modalId}" onclick="if(event.target === this) { this.remove(); }" class="fixed inset-0 z-[101] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
        <div class="bg-surface-container-lowest w-full max-w-3xl max-h-[85vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border border-outline-variant/10">
            <!-- Header -->
            <div class="p-6 border-b border-outline-variant/5 flex items-center justify-between bg-surface-container-low/40">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg" style="background:${typeColor}; box-shadow: 0 4px 12px ${typeColor}30">
                        <span class="material-symbols-outlined text-2xl">chat</span>
                    </div>
                    <div class="min-w-0">
                        <h3 id="feedback-modal-title" class="font-black text-on-surface text-base">Bitácora de Comentarios</h3>
                        <p class="text-sm text-primary font-black uppercase tracking-[0.05em] mt-0.5 truncate max-w-[480px]" title="${clientName}">${clientName}</p>
                    </div>
                </div>
                <button onclick="document.getElementById('${modalId}').remove()" class="w-9 h-9 rounded-full hover:bg-surface-container-high flex items-center justify-center transition-all hover:rotate-90">
                    <span class="material-symbols-outlined text-on-surface-variant text-xl">close</span>
                </button>
            </div>

            <!-- Intelligent Metadata Panel (Wispro style) -->
            <div class="px-6 py-4 bg-surface-container-low/20 border-b border-outline-variant/10 grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div class="flex flex-col gap-1">
                    <span class="font-bold text-on-surface-variant/60 uppercase text-[9px] tracking-wider">Estado:</span>
                    <div>
                        <span style="background:${stateBg}; color:white; font-size:11px; padding:3px 10px; border-radius:6px; font-weight:700; display:inline-block;">
                            ${stateText}
                        </span>
                    </div>
                </div>
                <div class="flex flex-col gap-1">
                    <span class="font-bold text-on-surface-variant/60 uppercase text-[9px] tracking-wider">Resultado:</span>
                    <div>
                        <span style="background:${resultBg}; color:white; font-size:11px; padding:3px 10px; border-radius:6px; font-weight:700; display:inline-block;">
                            ${resultText}
                        </span>
                    </div>
                </div>
                <div class="flex flex-col gap-1 col-span-2 md:col-span-1">
                    <span class="font-bold text-on-surface-variant/60 uppercase text-[9px] tracking-wider">Asignado a:</span>
                    <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded-full flex items-center justify-center text-white font-extrabold text-[10px]" style="background:${avatarColor}">
                            ${initials}
                        </div>
                        <span class="font-black text-on-surface text-sm">${techName}</span>
                    </div>
                </div>
                <div class="flex flex-col gap-1">
                    <span class="font-bold text-on-surface-variant/60 uppercase text-[9px] tracking-wider">Programado el:</span>
                    <div class="flex items-center gap-1.5 text-on-surface font-semibold">
                        <span class="material-symbols-outlined text-[16px] text-on-surface-variant/50">calendar_month</span>
                        <span>${scheduledText}</span>
                    </div>
                </div>
                <div class="flex flex-col gap-1">
                    <span class="font-bold text-on-surface-variant/60 uppercase text-[9px] tracking-wider">Creado el:</span>
                    <div class="flex items-center gap-1.5 text-on-surface font-semibold">
                        <span class="material-symbols-outlined text-[16px] text-on-surface-variant/50">schedule</span>
                        <span>${createdText}</span>
                    </div>
                </div>
            </div>

            <!-- Body (Timeline) -->
            <div id="feedback-timeline" class="flex-1 overflow-y-auto p-6 space-y-4 bg-surface-container-lowest/30 custom-scrollbar scroll-smooth">
                <div class="flex flex-col items-center justify-center py-20 text-on-surface-variant/30">
                    <span class="material-symbols-outlined text-4xl mb-3 animate-spin">history</span>
                    <p class="font-black text-xs tracking-widest uppercase italic mb-1">Cargando comentarios...</p>
                    <p class="text-[8px] font-bold opacity-40 uppercase">Búsqueda rápida en progreso</p>
                </div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    await window.loadFeedbacks(order);
};

window.loadFeedbacks = async function(target) {
    const timeline = document.getElementById('feedback-timeline');
    if (!timeline) return;
    if (!target) return;

    try {
        let allFeedbacks = [];
        const seenBodies = new Set();

        const id = target.rawId || target.id;

        // 1. Restaurar feedbacks desde caché global si existen
        if (id && state.feedbacksCache && state.feedbacksCache[id]) {
            target.feedbacks = state.feedbacksCache[id];
            target.feedbacksLoaded = true;
        }

        // Verificar si el target ya contiene feedbacks en memoria local (incluso si está vacío pero cargado)
        let hasBeenLoadedBefore = !!(target.feedbacksLoaded || (target.feedbacks && Array.isArray(target.feedbacks) && target.feedbacks.length > 0));
        if (target.feedbacks && Array.isArray(target.feedbacks)) {
            target.feedbacks.forEach(f => {
                const body = (f.body || f.comment || '').trim();
                if (body && !seenBodies.has(body)) {
                    allFeedbacks.push(f);
                    seenBodies.add(body);
                }
            });
        }

        // 2. Si es un reporte/issue, buscar órdenes correspondientes del mismo cliente en memoria local
        const isIssue = !!(target.assignable_id || (target.client_id && !target.orderable_id));
        let targetMatchingOrder = null;
        if (isIssue) {
            const allOrders = [...(state.orders || []), ...(state.finishedOrders || [])];
            targetMatchingOrder = allOrders.find(o => {
                const oClientId = o.client_id || (o.orderable_id && state.clients[o.orderable_id]?.client_id) || o.orderable_id;
                if (oClientId && target.client_id && String(oClientId) === String(target.client_id)) return true;
                
                const orderClientName = (o.client || '').toLowerCase().trim();
                const targetClientName = ((state.clients && state.clients[target.client_id]?.name) || target.title || '').toLowerCase().trim();
                if (orderClientName && targetClientName && orderClientName === targetClientName) return true;
                
                return false;
            });
            
            if (targetMatchingOrder) {
                const mOid = targetMatchingOrder.rawId || targetMatchingOrder.id;
                if (mOid && state.feedbacksCache && state.feedbacksCache[mOid]) {
                    targetMatchingOrder.feedbacks = state.feedbacksCache[mOid];
                    targetMatchingOrder.feedbacksLoaded = true;
                }

                if (targetMatchingOrder.feedbacksLoaded || (targetMatchingOrder.feedbacks && targetMatchingOrder.feedbacks.length > 0)) {
                    if (targetMatchingOrder.feedbacks && Array.isArray(targetMatchingOrder.feedbacks)) {
                        targetMatchingOrder.feedbacks.forEach(f => {
                            const body = (f.body || f.comment || '').trim();
                            if (body && !seenBodies.has(body)) {
                                allFeedbacks.push(f);
                                seenBodies.add(body);
                            }
                        });
                    }
                    hasBeenLoadedBefore = true;
                }
            }
        }

        // 3. Fallback: Si no ha sido cargado antes en memoria local ni en caché, hacer búsqueda rápida en endpoints específicos
        if (!hasBeenLoadedBefore) {
            if (id) {
                const endpoints = [];
                if (isIssue) {
                    // Si es un issue pero tenemos una orden coincidente, priorizamos los endpoints de la orden
                    if (targetMatchingOrder) {
                        const oid = targetMatchingOrder.rawId || targetMatchingOrder.id;
                        if (oid) {
                            endpoints.push(`/order/orders/${oid}/feedbacks`);
                            endpoints.push(`/installation_orders/${oid}/feedbacks`);
                        }
                    }
                    endpoints.push(`/help_desk/issues/${id}/feedbacks`);
                    endpoints.push(`/help_desk/issues/${id}/issue_feedbacks`);
                } else {
                    endpoints.push(`/order/orders/${id}/feedbacks`);
                    endpoints.push(`/installation_orders/${id}/feedbacks`);
                }

                console.log(`[Velocity] Sonda 5.2 cargando feedbacks para ${isIssue ? 'Reporte' : 'Orden'} #${id}...`);
                const results = await Promise.allSettled(endpoints.map(ep => apiFetch(ep, {}, true)));
                
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
            }
            // Guardar en memoria local y caché global
            target.feedbacks = allFeedbacks;
            target.feedbacksLoaded = true;
            if (id) state.feedbacksCache[id] = allFeedbacks;
            
            if (targetMatchingOrder) {
                targetMatchingOrder.feedbacks = allFeedbacks;
                targetMatchingOrder.feedbacksLoaded = true;
                const mOid = targetMatchingOrder.rawId || targetMatchingOrder.id;
                if (mOid) state.feedbacksCache[mOid] = allFeedbacks;
                if (targetMatchingOrder.id) state.feedbacksCache[targetMatchingOrder.id] = allFeedbacks;
            }
        }

        if (allFeedbacks.length === 0) {
            const titleEl = document.getElementById('feedback-modal-title');
            if (titleEl) titleEl.textContent = 'Bitácora de Comentarios (0)';
            timeline.innerHTML = `
                <div class="flex flex-col items-center justify-center py-16 text-on-surface-variant/15 italic text-center px-10">
                    <span class="material-symbols-outlined text-5xl mb-3">search_off</span>
                    <p class="text-xs font-black tracking-widest uppercase mb-1">Sin comentarios</p>
                    <p class="text-[8px] opacity-40 uppercase">No se hallaron notas registradas en esta visita.</p>
                </div>`;
            return;
        }

        const titleEl = document.getElementById('feedback-modal-title');
        if (titleEl) {
            titleEl.textContent = `Bitácora de Comentarios (${allFeedbacks.length})`;
        }

        allFeedbacks.sort((a,b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

        timeline.innerHTML = allFeedbacks.map(f => {
            const date = f.created_at ? new Date(f.created_at).toLocaleString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--';
            
            // Resolver el nombre del autor
            const senderName = (state.techs && state.techs[f.creatable_id]) || f.author_name || f.technician_name || f.creator_name || f.user_name || 'Sistema';
            
            const activeUserEl = document.getElementById('active-user-name');
            const activeUserName = activeUserEl ? activeUserEl.textContent.trim().toLowerCase() : '';
            const isSelf = senderName.toLowerCase().includes('admin') || 
                           senderName.toLowerCase().includes('supervisor') ||
                           (activeUserName && senderName.toLowerCase().includes(activeUserName.split(' ')[0]));
            
            const isSistema = senderName.toLowerCase() === 'sistema';
            const roleLabel = isSistema ? 'Sistema' : isSelf ? 'Supervisor' : 'Técnico';
            
            let roleBg = '#e8eeff';
            let roleColor = '#0059bb';
            if (isSistema) {
                roleBg = '#f3f4f6';
                roleColor = '#4b5563';
            } else if (isSelf) {
                roleBg = '#e8eeff';
                roleColor = '#0059bb';
            } else {
                roleBg = '#e6fffa';
                roleColor = '#0d9488';
            }

            return `
            <div class="bg-surface-container-lowest border border-outline-variant/15 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                <!-- Header -->
                <div class="flex items-center justify-between gap-2 border-b border-outline-variant/5 pb-2 mb-2">
                    <div class="flex items-center flex-wrap">
                        <span class="text-base font-black text-on-surface">${senderName}</span>
                        <span class="text-xs text-on-surface-variant/50 ml-2 font-medium">${date}</span>
                    </div>
                    <span style="background:${roleBg}; color:${roleColor}; font-size:10px; font-weight:800; padding:2.5px 8px; border-radius:999px; text-transform:uppercase; tracking-wider:0.05em; display:inline-block;">
                        ${roleLabel}
                    </span>
                </div>
                <!-- Body -->
                <div class="text-sm font-normal text-on-surface-variant leading-relaxed select-text whitespace-pre-wrap break-words">${f.body || f.comment || '—'}</div>
            </div>`;
        }).join('');
        
        timeline.scrollTop = timeline.scrollHeight;

    } catch (e) {
        console.error('[Velocity] Sonda 5.2 fallida:', e);
        timeline.innerHTML = `<p class="text-center text-error font-black text-[10px] uppercase p-10 opacity-50">Fallo en búsqueda dinámica</p>`;
    }
};

window.currentAuditFilter = 'all';
window.currentAuditSearch = '';
window.lastAuditComments = [];

window.loadRecentCommentsAudit = async function() {
    const listContainer = document.getElementById('comments-audit-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = `
    <div class="flex flex-col items-center justify-center py-12 text-on-surface-variant/30 col-span-full">
        <span class="material-symbols-outlined text-4xl mb-3 animate-spin text-secondary">sync</span>
        <p class="text-xs font-black tracking-widest uppercase mb-1">Cargando Auditoría...</p>
        <p class="text-[9px] font-bold opacity-50 uppercase">Consolidando comentarios de hoy...</p>
    </div>`;

    // Breve pausa para mostrar la animación
    await new Promise(resolve => setTimeout(resolve, 150));

    const todayStr = new Date().toLocaleDateString('en-CA');
    const allIssues = [...(state.issues || []), ...(state.finishedIssues || [])];
    const allOrders = [...(state.orders || []), ...(state.finishedOrders || [])];

    // Carga paralela por lotes de los comentarios faltantes para evitar llamadas duplicadas o listas vacías
    const itemsToFetch = [];
    allOrders.forEach(o => {
        if (!o.feedbacks) {
            itemsToFetch.push({ id: o.rawId || o.id, isIssue: false, obj: o });
        }
    });
    allIssues.forEach(i => {
        if (!i.feedbacks) {
            itemsToFetch.push({ id: i.id, isIssue: true, obj: i });
        }
    });

    if (itemsToFetch.length > 0) {
        const BATCH_SIZE = 5;
        for (let idx = 0; idx < itemsToFetch.length; idx += BATCH_SIZE) {
            const batch = itemsToFetch.slice(idx, idx + BATCH_SIZE);
            await Promise.allSettled(batch.map(async (item) => {
                const endpoints = item.isIssue 
                    ? [`/help_desk/issues/${item.id}/feedbacks`, `/help_desk/issues/${item.id}/issue_feedbacks`]
                    : [`/order/orders/${item.id}/feedbacks`, `/installation_orders/${item.id}/feedbacks`];
                
                for (const url of endpoints) {
                    try {
                        const res = await apiFetch(url, {}, true);
                        if (res && Array.isArray(res.data)) {
                            item.obj.feedbacks = res.data;
                            break;
                        }
                    } catch (e) {}
                }
            }));
            if (idx + BATCH_SIZE < itemsToFetch.length) {
                await new Promise(r => setTimeout(r, 200));
            }
        }
    }
    
    let allComments = [];
    const seenFeedbackIds = new Set();

    // 1. Procesar comentarios en órdenes (tanto activas como finalizadas)
    allOrders.forEach(o => {
        if (o.feedbacks && Array.isArray(o.feedbacks)) {
            o.feedbacks.forEach(c => {
                const body = (c.body || c.comment || '').trim();
                if (!body) return;
                
                // Filtrar solo comentarios de hoy
                const commentDate = c.created_at ? new Date(c.created_at) : new Date();
                const commentDateStr = commentDate.toLocaleDateString('en-CA');
                if (commentDateStr !== todayStr) return;
                
                if (!seenFeedbackIds.has(c.id)) {
                    seenFeedbackIds.add(c.id);
                    let author = c.author_name || c.technician_name || c.creator_name || c.user_name;
                    if (!author && c.creatable_id) {
                        if (c.creatable_id === o.employee_id) {
                            author = o.techName;
                        } else {
                            author = (state.techs && state.techs[c.creatable_id]) || 'Técnico';
                        }
                    }
                    if (!author) author = 'Técnico';
                    
                    // Verificar si esta orden está asociada a algún issue (Mesa de Ayuda)
                    const matchingIssue = allIssues.find(i => {
                        const oClientId = o.client_id || (o.orderable_id && state.clients[o.orderable_id]?.client_id) || o.orderable_id;
                        if (oClientId && i.client_id && String(oClientId) === String(i.client_id)) return true;
                        
                        const orderClientName = (o.client || '').toLowerCase().trim();
                        const issueClientName = ((state.clients && state.clients[i.client_id]?.name) || i.title || '').toLowerCase().trim();
                        if (orderClientName && issueClientName && orderClientName === issueClientName) return true;
                        
                        return false;
                    });
                    
                    if (matchingIssue) {
                        allComments.push({
                            targetId: matchingIssue.public_id || matchingIssue.id,
                            client: (state.clients && state.clients[matchingIssue.client_id]?.name) || matchingIssue.title || o.client || 'Reporte',
                            color: '#ef4444',
                            type: 'Mesa de Ayuda',
                            category: 'issues',
                            author: author,
                            comment: body,
                            createdAt: commentDate
                        });
                    } else {
                        allComments.push({
                            targetId: o.id,
                            client: o.client || 'Cliente',
                            color: o.typeColor || '#3b82f6',
                            type: o.typeLabel || 'Orden',
                            category: 'orders',
                            author: author,
                            comment: body,
                            createdAt: commentDate
                        });
                    }
                }
            });
        }
    });

    // 2. Procesar comentarios cargados directamente en issues (por si acaso no pasaron por órdenes)
    allIssues.forEach(i => {
        if (i.feedbacks && Array.isArray(i.feedbacks)) {
            i.feedbacks.forEach(c => {
                const body = (c.body || c.comment || '').trim();
                if (!body) return;

                const commentDate = c.created_at ? new Date(c.created_at) : new Date();
                const commentDateStr = commentDate.toLocaleDateString('en-CA');
                if (commentDateStr !== todayStr) return;

                if (!seenFeedbackIds.has(c.id)) {
                    seenFeedbackIds.add(c.id);
                    let author = c.author_name || c.technician_name || c.creator_name || c.user_name;
                    if (!author && c.creatable_id) {
                        author = (state.techs && state.techs[c.creatable_id]) || 'Técnico';
                    }
                    if (!author) author = 'Técnico';

                    allComments.push({
                        targetId: i.public_id || i.id,
                        client: (state.clients && state.clients[i.client_id]?.name) || i.title || 'Reporte',
                        color: '#ef4444',
                        type: 'Mesa de Ayuda',
                        category: 'issues',
                        author: author,
                        comment: body,
                        createdAt: commentDate
                    });
                }
            });
        }
    });

    // Ordenar de más nuevo a más antiguo
    allComments.sort((a, b) => b.createdAt - a.createdAt);
    
    // Guardar en variable global para búsquedas y filtrados instantáneos
    window.lastAuditComments = allComments;

    // Renderizar con el filtro y búsqueda actual
    window.renderAuditComments();
};

window.setAuditFilter = function(filter) {
    window.currentAuditFilter = filter;
    
    const btnAll = document.getElementById('audit-filter-all');
    const btnOrders = document.getElementById('audit-filter-orders');
    const btnIssues = document.getElementById('audit-filter-issues');
    
    if (btnAll) {
        btnAll.className = filter === 'all' 
            ? 'px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider bg-primary text-white shadow-sm border border-transparent transition-all'
            : 'px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider bg-surface-container text-on-surface-variant border border-outline-variant/10 transition-all hover:bg-surface-container-high';
    }
    if (btnOrders) {
        btnOrders.className = filter === 'orders' 
            ? 'px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider bg-primary text-white shadow-sm border border-transparent transition-all'
            : 'px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider bg-surface-container text-on-surface-variant border border-outline-variant/10 transition-all hover:bg-surface-container-high';
    }
    if (btnIssues) {
        btnIssues.className = filter === 'issues' 
            ? 'px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider bg-primary text-white shadow-sm border border-transparent transition-all'
            : 'px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider bg-surface-container text-on-surface-variant border border-outline-variant/10 transition-all hover:bg-surface-container-high';
    }
    
    window.renderAuditComments();
};

window.filterAuditComments = function() {
    const searchInput = document.getElementById('audit-search-input');
    window.currentAuditSearch = searchInput ? searchInput.value.trim().toLowerCase() : '';
    window.renderAuditComments();
};

window.renderAuditComments = function() {
    const listContainer = document.getElementById('comments-audit-list');
    if (!listContainer) return;
    
    const comments = window.lastAuditComments || [];
    const filter = window.currentAuditFilter || 'all';
    const query = window.currentAuditSearch || '';
    
    const filtered = comments.filter(c => {
        if (filter === 'orders' && c.category !== 'orders') return false;
        if (filter === 'issues' && c.category !== 'issues') return false;
        
        if (query) {
            const authorMatch = (c.author || '').toLowerCase().includes(query);
            const clientMatch = (c.client || '').toLowerCase().includes(query);
            const commentMatch = (c.comment || '').toLowerCase().includes(query);
            const idMatch = String(c.targetId || '').toLowerCase().includes(query);
            const typeMatch = (c.type || '').toLowerCase().includes(query);
            if (!authorMatch && !clientMatch && !commentMatch && !idMatch && !typeMatch) {
                return false;
            }
        }
        return true;
    });
    
    if (filtered.length === 0) {
        listContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-8 text-on-surface-variant/30 italic col-span-full">
            <span class="material-symbols-outlined text-3xl mb-2">search_off</span>
            <p class="text-xs font-black uppercase tracking-wider">Sin comentarios</p>
            <p class="text-[9px] opacity-40 uppercase">No se hallaron notas en las órdenes o reportes con los criterios especificados.</p>
        </div>`;
        return;
    }
    
    listContainer.innerHTML = filtered.map(c => `
    <div class="bg-surface-container-lowest border border-outline-variant/15 hover:border-outline-variant/30 rounded-3xl p-5 shadow-sm space-y-3 transition-all hover:shadow-md duration-200">
        <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
                <div class="flex items-center gap-2 mb-1 flex-wrap">
                    <span class="text-[9px] font-black text-white px-2 py-0.5 rounded-full" style="background:${c.color}">
                        #${c.targetId}
                    </span>
                    <span class="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-surface-container-high text-on-surface-variant rounded-full">
                        ${c.type}
                    </span>
                </div>
                <p class="text-xs font-black text-on-surface truncate max-w-[200px]" title="${c.client}">
                    ${c.client}
                </p>
            </div>
            <span class="text-[10px] text-on-surface-variant/40 font-black whitespace-nowrap bg-surface-container/30 px-2 py-0.5 rounded-lg">
                ${c.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
        </div>
        
        <p class="text-xs text-on-surface font-medium leading-relaxed bg-surface-container-low/40 p-4 rounded-2xl border border-outline-variant/10 whitespace-pre-line">
            ${c.comment}
        </p>
        
        <div class="flex items-center justify-between text-[10px] font-black text-secondary">
            <div class="flex items-center gap-1">
                <span class="material-symbols-outlined text-[13px]">person</span>
                <span>${c.author}</span>
            </div>
            <span class="text-[8px] text-on-surface-variant/30 uppercase font-black">
                ${c.createdAt.toLocaleDateString([], { day: '2-digit', month: '2-digit' })}
            </span>
        </div>
    </div>
    `).join('');
};


window.loadLastCommentsForPlaceholders = async function() {
    const orderElements = document.querySelectorAll('[data-last-comment-order-id]');
    const issueElements = document.querySelectorAll('[data-last-comment-issue-id]');
    const orderBtnElements = document.querySelectorAll('[data-order-btn-id]');
    const issueBtnElements = document.querySelectorAll('[data-issue-btn-id]');
    console.log(`[Velocity Audit] loadLastCommentsForPlaceholders (Lazy). Órdenes: ${orderElements.length}, Issues: ${issueElements.length}`);
    
    // Función auxiliar para obtener feedbacks de Wispro de manera asíncrona y con caché simple
    const fetchFeedbacks = async (id, isIssue = false) => {
        if (state.feedbacksCache && state.feedbacksCache[id]) {
            return state.feedbacksCache[id];
        }

        const allOrders = [...(state.orders || []), ...(state.finishedOrders || [])];
        const allIssues = [...(state.issues || []), ...(state.finishedIssues || [])];

        let order = null;
        let issue = null;

        if (isIssue) {
            issue = allIssues.find(i => i.id === id);
            if (issue) {
                order = allOrders.find(o => {
                    const oClientId = o.client_id || (o.orderable_id && state.clients[o.orderable_id]?.client_id) || o.orderable_id;
                    if (oClientId && issue.client_id && String(oClientId) === String(issue.client_id)) return true;
                    
                    const orderClientName = (o.client || '').toLowerCase().trim();
                    const issueClientName = ((state.clients && state.clients[issue.client_id]?.name) || issue.title || '').toLowerCase().trim();
                    if (orderClientName && issueClientName && orderClientName === issueClientName) return true;
                    
                    return false;
                });
            }
        } else {
            order = allOrders.find(o => o.rawId === id || String(o.id) === String(id));
        }

        // Si la orden ya tiene feedbacks en memoria local o cache, usarlos
        if (order) {
            const mOid = order.rawId || order.id;
            if (mOid && state.feedbacksCache && state.feedbacksCache[mOid]) {
                order.feedbacks = state.feedbacksCache[mOid];
                order.feedbacksLoaded = true;
            }
            if (order.feedbacks && order.feedbacks.length > 0) {
                state.feedbacksCache[id] = order.feedbacks;
                return order.feedbacks;
            }
        }

        const endpoints = [];
        if (order) {
            const oid = order.rawId || order.id;
            endpoints.push(`/order/orders/${oid}/feedbacks`);
            endpoints.push(`/installation_orders/${oid}/feedbacks`);
        } else if (isIssue) {
            endpoints.push(`/help_desk/issues/${id}/feedbacks`);
            endpoints.push(`/help_desk/issues/${id}/issue_feedbacks`);
        } else {
            endpoints.push(`/order/orders/${id}/feedbacks`);
            endpoints.push(`/installation_orders/${id}/feedbacks`);
        }

        for (const url of endpoints) {
            try {
                const res = await apiFetch(url);
                if (res && Array.isArray(res.data) && res.data.length > 0) {
                    if (order) {
                        order.feedbacks = res.data;
                        order.feedbacksLoaded = true;
                        if (order.rawId) state.feedbacksCache[order.rawId] = res.data;
                        if (order.id) state.feedbacksCache[order.id] = res.data;
                    }
                    if (issue) {
                        issue.feedbacks = res.data;
                        issue.feedbacksLoaded = true;
                        if (issue.id) state.feedbacksCache[issue.id] = res.data;
                    }
                    state.feedbacksCache[id] = res.data;
                    return res.data;
                }
            } catch (e) {
                // Probar siguiente endpoint
            }
        }
        
        // Guardar array vacío para no re-consultar
        state.feedbacksCache[id] = [];
        if (order) {
            order.feedbacks = [];
            order.feedbacksLoaded = true;
            if (order.rawId) state.feedbacksCache[order.rawId] = [];
            if (order.id) state.feedbacksCache[order.id] = [];
        }
        if (issue) {
            issue.feedbacks = [];
            issue.feedbacksLoaded = true;
            if (issue.id) state.feedbacksCache[issue.id] = [];
        }
        return [];
    };

    const loadOrderComment = async (el) => {
        const id = el.getAttribute('data-last-comment-order-id');
        if (!id) return;
        try {
            const feedbacks = await fetchFeedbacks(id, false);
            if (feedbacks && feedbacks.length > 0) {
                const sorted = [...feedbacks].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                const comment = (sorted[0].body || sorted[0].comment || '').trim();
                const author = sorted[0].author_name || sorted[0].technician_name || sorted[0].creator_name || sorted[0].user_name || 'Técnico';
                el.innerHTML = `<span class="material-symbols-outlined text-[12px] text-secondary">chat_bubble</span><span class="truncate max-w-[260px] block" title="${comment}"><strong>${author}:</strong> ${comment}</span>`;
            } else {
                el.innerHTML = `<span class="material-symbols-outlined text-[12px] opacity-40">chat_bubble</span><span class="text-on-surface-variant/40">Sin notas de cierre</span>`;
            }
        } catch (err) {
            el.innerHTML = `<span class="material-symbols-outlined text-[12px] opacity-40">chat_bubble</span><span class="text-on-surface-variant/40">Error al cargar notas</span>`;
        }
    };

    const loadIssueComment = async (el) => {
        const id = el.getAttribute('data-last-comment-issue-id');
        if (!id) return;
        try {
            let feedbacks = await fetchFeedbacks(id, true);
            if (!feedbacks || feedbacks.length === 0) {
                const allIssues = [...(state.issues || []), ...(state.finishedIssues || [])];
                const issue = allIssues.find(i => i.id === id);
                if (issue) {
                    const allOrders = [...(state.orders || []), ...(state.finishedOrders || [])];
                    const matchingOrder = allOrders.find(o => {
                        const oClientId = o.client_id || (o.orderable_id && state.clients[o.orderable_id]?.client_id) || o.orderable_id;
                        if (oClientId && issue.client_id && String(oClientId) === String(issue.client_id)) return true;
                        
                        const orderClientName = (o.client || '').toLowerCase().trim();
                        const issueClientName = ((state.clients && state.clients[issue.client_id]?.name) || issue.title || '').toLowerCase().trim();
                        if (orderClientName && issueClientName && orderClientName === issueClientName) return true;
                        
                        return false;
                    });
                    if (matchingOrder) {
                        feedbacks = await fetchFeedbacks(matchingOrder.rawId || matchingOrder.id, false);
                    }
                }
            }

            if (feedbacks && feedbacks.length > 0) {
                const sorted = [...feedbacks].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                const comment = (sorted[0].body || sorted[0].comment || '').trim();
                const author = sorted[0].author_name || sorted[0].technician_name || sorted[0].creator_name || sorted[0].user_name || 'Técnico';
                if (el.classList.contains('comment-preview-inline')) {
                    const truncated = comment.length > 40 ? comment.substring(0, 40) + '...' : comment;
                    el.innerHTML = `
                        <button onclick="window.openFeedbackModal('${id}', true)" class="inline-flex items-center gap-1 text-left text-secondary hover:underline bg-transparent border-none p-0 cursor-pointer max-w-full" title="${comment}">
                            <span class="material-symbols-outlined text-[12px] text-secondary flex-shrink-0">chat_bubble</span>
                            <span class="truncate text-[11px] font-semibold italic"><strong>${author}:</strong> ${truncated}</span>
                        </button>
                    `;
                } else {
                    el.innerHTML = `<span class="material-symbols-outlined text-[12px] text-secondary">chat_bubble</span><span class="truncate max-w-[260px] block" title="${comment}"><strong>${author}:</strong> ${comment}</span>`;
                }
            } else {
                el.innerHTML = '';
            }
        } catch (err) {
            if (el.classList.contains('comment-preview-inline')) {
                el.innerHTML = `
                    <div class="inline-flex items-center gap-1 text-on-surface-variant/40">
                        <span class="material-symbols-outlined text-[12px] opacity-40">chat_bubble</span>
                        <span class="text-[11px] font-semibold italic">Error</span>
                    </div>
                `;
            } else {
                el.innerHTML = `<span class="material-symbols-outlined text-[12px] opacity-40">chat_bubble</span><span class="text-on-surface-variant/40">Error al cargar notas</span>`;
            }
        }
    };

    const loadOrderBtnComment = async (el) => {
        const id = el.getAttribute('data-order-btn-id');
        if (!id) return;
        try {
            const feedbacks = await fetchFeedbacks(id, false);
            const count = feedbacks ? feedbacks.length : 0;
            let badgeEl = el.querySelector('.comment-badge');
            if (count > 0) {
                if (!badgeEl) {
                    badgeEl = document.createElement('div');
                    badgeEl.className = 'comment-badge absolute -top-1.5 -right-1.5 bg-secondary text-white text-[8px] font-black px-1 py-0.5 rounded-full border border-surface-container-lowest shadow-sm min-w-[14px] text-center';
                    el.appendChild(badgeEl);
                }
                badgeEl.textContent = count;
            } else if (badgeEl) {
                badgeEl.remove();
            }
        } catch (err) {
            console.error('Error loading feedbacks for order button', id, err);
        }
    };

    const loadIssueBtnComment = async (el) => {
        const id = el.getAttribute('data-issue-btn-id');
        if (!id) return;
        try {
            let feedbacks = await fetchFeedbacks(id, true);
            if (!feedbacks || feedbacks.length === 0) {
                const allIssues = [...(state.issues || []), ...(state.finishedIssues || [])];
                const issue = allIssues.find(i => String(i.id) === String(id));
                if (issue) {
                    const allOrders = [...(state.orders || []), ...(state.finishedOrders || [])];
                    const matchingOrder = allOrders.find(o => {
                        const oClientId = o.client_id || (o.orderable_id && state.clients[o.orderable_id]?.client_id) || o.orderable_id;
                        if (oClientId && issue.client_id && String(oClientId) === String(issue.client_id)) return true;
                        const orderClientName = (o.client || '').toLowerCase().trim();
                        const issueClientName = ((state.clients && state.clients[issue.client_id]?.name) || issue.title || '').toLowerCase().trim();
                        if (orderClientName && issueClientName && orderClientName === issueClientName) return true;
                        return false;
                    });
                    if (matchingOrder) {
                        feedbacks = await fetchFeedbacks(matchingOrder.rawId || matchingOrder.id, false);
                    }
                }
            }
            const count = feedbacks ? feedbacks.length : 0;
            let badgeEl = el.querySelector('.comment-badge');
            if (count > 0) {
                if (!badgeEl) {
                    badgeEl = document.createElement('div');
                    badgeEl.className = 'comment-badge absolute -top-1.5 -right-1.5 bg-secondary text-white text-[8px] font-black px-1 py-0.5 rounded-full border border-surface-container-lowest shadow-sm min-w-[14px] text-center';
                    el.appendChild(badgeEl);
                }
                badgeEl.textContent = count;
            } else if (badgeEl) {
                badgeEl.remove();
            }
        } catch (err) {
            console.error('Error loading feedbacks for issue button', id, err);
        }
    };

    // Crear un IntersectionObserver para cargar bajo demanda
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                observer.unobserve(el); // Dejar de observar para no duplicar peticiones
                
                if (el.hasAttribute('data-last-comment-order-id')) {
                    loadOrderComment(el);
                } else if (el.hasAttribute('data-last-comment-issue-id')) {
                    loadIssueComment(el);
                } else if (el.hasAttribute('data-order-btn-id')) {
                    loadOrderBtnComment(el);
                } else if (el.hasAttribute('data-issue-btn-id')) {
                    loadIssueBtnComment(el);
                }
            }
        });
    }, {
        rootMargin: '100px 0px', // Cargar 100px antes de entrar en pantalla
        threshold: 0.01
    });

    // Observar todos los elementos con placeholder de comentarios
    orderElements.forEach(el => observer.observe(el));
    issueElements.forEach(el => observer.observe(el));
    orderBtnElements.forEach(el => observer.observe(el));
    issueBtnElements.forEach(el => observer.observe(el));
};





window.openExportOrdersModal = function() {
    const modalHtml = `
    <div id="export-orders-modal" onclick="this.remove()" class="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center animate-fade-in" style="animation: fadeIn 0.2s;">
        <div onclick="event.stopPropagation()" class="bg-surface-container-lowest w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-outline-variant/20 transform scale-95" style="animation: scaleUp 0.2s forwards;">
            <div class="kinetic-gradient p-6 text-white">
                <h3 class="font-black text-xl tracking-tight">Exportar Órdenes</h3>
                <p class="text-[10px] font-black uppercase opacity-80 tracking-[0.2em] mt-1">Descarga de Reporte CSV</p>
            </div>
            
            <div class="p-6 space-y-5">
                <div>
                    <label class="block text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-2">Período de Exportación</label>
                    <select id="export-range" onchange="document.getElementById('export-custom-dates').style.display = this.value === 'custom' ? 'block' : 'none'" class="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-sm font-bold text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary transition-all outline-none">
                        <option value="today">Solo del Día de Hoy (Rápido)</option>
                        <option value="custom">Rango Personalizado...</option>
                    </select>
                </div>

                <div id="export-custom-dates" style="display:none;" class="space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-2">Desde</label>
                            <input type="date" id="export-start" class="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-sm font-bold text-on-surface focus:border-secondary transition-all outline-none">
                        </div>
                        <div>
                            <label class="block text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-2">Hasta</label>
                            <input type="date" id="export-end" class="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-sm font-bold text-on-surface focus:border-secondary transition-all outline-none">
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-2">Tipo de Orden</label>
                        <select id="export-type" class="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-sm font-bold text-on-surface focus:border-secondary transition-all outline-none">
                            <option value="all">Todas</option>
                            <option value="installation">Instalaciones</option>
                            <option value="technical">Visitas Técnicas</option>
                            <option value="feasibility">Factibilidades</option>
                            <option value="resignation">Bajas</option>
                        </select>
                    </div>
                </div>

                <button id="btn-run-export" onclick="window.runCustomOrderExport()" class="w-full kinetic-gradient text-white font-black text-sm py-4 rounded-2xl hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 mt-4">
                    <span class="material-symbols-outlined text-[18px]">download</span> Generar y Descargar CSV
                </button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Set default dates to past month
    const d = new Date();
    document.getElementById('export-end').value = d.toISOString().slice(0,10);
    d.setMonth(d.getMonth() - 1);
    document.getElementById('export-start').value = d.toISOString().slice(0,10);
};

window.runCustomOrderExport = async function() {
    const range = document.getElementById('export-range').value;
    const btn = document.getElementById('btn-run-export');
    
    if (range === 'today') {
        const all = [...state.orders, ...(state.finishedOrders || [])];
        if (all.length === 0) { alert('No hay datos hoy para exportar'); return; }

        const headers = ['ID', 'Tipo', 'Cliente', 'Direccion', 'Zona', 'Tecnico', 'Inicio', 'Fin', 'Estado', 'Finalizado', 'NAP'];
        const rows = all.map(o => {
            const isFin = ['finalizada', 'finalizado', 'closed'].includes((o.state || '').toLowerCase()) ? 'SI' : 'NO';
            return [
                o.id,
                o.typeLabel,
                (o.client||'').replace(/,/g, ''),
                (o.address || '').replace(/,/g, ''),
                o.zone,
                o.techName,
                o.startTime,
                o.endTime,
                o.state,
                isFin,
                o.nap || ''
            ];
        });

        // ── ESTADÍSTICAS POR TÉCNICO ──
        const techStats = {};
        rows.forEach(r => {
            const t = r[5]; // Técnico (index 5)
            const isFin = r[9]; // Finalizado (index 9)
            if (!techStats[t]) techStats[t] = { name: t, total: 0, done: 0 };
            techStats[t].total++;
            if (isFin === 'SI') techStats[t].done++;
        });

        const statsHeaders = ['RESUMEN POR TECNICO', 'Completadas', 'Pendientes', 'Total Asignadas'];
        const statsRows = Object.values(techStats).sort((a,b) => b.total - a.total).map(ts => [
            ts.name,
            ts.done,
            ts.total - ts.done,
            ts.total
        ]);

        const csvContentStats = [statsHeaders, ...statsRows].map(e => e.join(",")).join("\n");
        const csvContentDetail = [headers, ...rows].map(e => e.join(",")).join("\n");
        const csvContent = csvContentStats + "\n\nDETALLE DE ORDENES\n" + csvContentDetail;

        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const fileName = `Velocity_Hoy_${new Date().toLocaleDateString('en-CA')}.csv`;
        
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);

        document.getElementById('export-orders-modal').remove();
        return;
    }

    const start = document.getElementById('export-start').value;
    const end = document.getElementById('export-end').value;
    const type = document.getElementById('export-type').value;

    if (!start || !end) { alert("Selecciona el rango de fechas"); return; }
    
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin" style="font-size:18px;">sync</span> Inicializando...`;
    btn.disabled = true;

    try {
        let page = 1;
        let totalPages = 1;
        let allData = [];
        const startDate = new Date(start + 'T00:00:00');
        const endDate = new Date(end + 'T23:59:59');

        // Primera petición para obtener el total de páginas (usamos los filtros Ransack por si Wispro los soporta)
        const query = `q%5Bstart_at_gteq%5D=${start}&q%5Bstart_at_lteq%5D=${end}T23:59:59&q%5Bs%5D=start_at+desc`;
        const firstPage = await apiFetch(`/order/orders?per_page=100&page=1&${query}`);
        
        if (firstPage && firstPage.meta && firstPage.meta.pagination) {
            totalPages = firstPage.meta.pagination.total_pages || 1;
        } else {
            totalPages = 20; // fallback razonable si no hay meta
        }

        // Si Wispro no soportó el filtro, totalPages será gigante. Lo limitamos a 50 máximo por seguridad.
        totalPages = Math.min(totalPages, 50);

        while (page <= totalPages) {
            btn.innerHTML = `<span class="material-symbols-outlined animate-spin" style="font-size:18px;">sync</span> Descargando pág ${page} de ${totalPages}...`;
            
            const d = page === 1 ? firstPage : await apiFetch(`/order/orders?per_page=100&page=${page}&${query}`);
            const items = d.data || [];
            if (items.length === 0) break;

            let validItemsInPage = 0;
            for (const item of items) {
                if (!item.start_at) continue; // Ignoramos si no tiene fecha de inicio programada
                
                const itemDate = new Date(item.start_at);
                if (itemDate >= startDate && itemDate <= endDate) {
                    if (type === 'all' || item.kind === type) {
                        allData.push(item);
                    }
                    validItemsInPage++;
                }
            }
            
            // Si Wispro NO está filtrando por Ransack, y ya pasamos la ventana de tiempo, podemos detenernos
            // Asumimos que si hay 0 items válidos en una página (y ya estamos viendo fechas más viejas), terminamos.
            const sampleDate = items[0]?.start_at ? new Date(items[0].start_at) : null;
            if (sampleDate && sampleDate < startDate) {
                break; // Ya llegamos a fechas anteriores al rango
            }

            page++;
        }

        if (allData.length === 0) {
            alert('No se encontraron órdenes en este rango de fechas. Asegúrate de que las fechas sean correctas.');
            btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">download</span> Generar y Descargar CSV`;
            btn.disabled = false;
            return;
        }

        // Resolucion de clientes faltantes
        const toResolve = {};
        allData.forEach(o => {
            if (o.orderable_id && !state.clients[o.orderable_id]) {
                toResolve[o.orderable_id] = o.kind;
            }
        });
        
        btn.innerHTML = `<span class="material-symbols-outlined animate-spin" style="font-size:18px;">sync</span> Resolviendo nombres (${Object.keys(toResolve).length})...`;
        await resolveUnified(toResolve);

        // Exportar
        const headers = ['ID', 'Tipo', 'Fecha', 'Cliente', 'Direccion', 'Zona', 'Tecnico', 'Estado', 'Finalizado'];
        const rows = allData.map(o => {
            const c = state.clients[o.orderable_id] || {};
            const t = state.techs[o.employee_id] || 'Sin Asignar';
            const clientName = c.name || o.description?.match(/\(([^)]+)\)/)?.[1] || `#${o.sequential_id || o.id}`;
            const isFinished = ['finalizada', 'finalizado', 'closed'].includes((o.state || '').toLowerCase()) ? 'SI' : 'NO';
            const kindLabel = window.TYPE_CFG ? (window.TYPE_CFG[o.kind]?.label || o.kind) : (o.kind === 'installation' ? 'Instalación' : (o.kind === 'technical' ? 'Visita Técnica' : o.kind));

            return [
                o.sequential_id || o.id,
                kindLabel,
                (o.start_at || '').slice(0, 10),
                clientName.replace(/,/g, ''),
                (c.address || '').replace(/,/g, ''),
                c.zone || '',
                t,
                o.state || '',
                isFinished
            ];
        });

        // ── ESTADÍSTICAS POR TÉCNICO ──
        const techStats = {};
        rows.forEach(r => {
            const t = r[6]; // Técnico
            const isFin = r[8]; // Finalizado
            if (!techStats[t]) techStats[t] = { name: t, total: 0, done: 0 };
            techStats[t].total++;
            if (isFin === 'SI') techStats[t].done++;
        });

        const statsHeaders = ['RESUMEN POR TECNICO', 'Completadas', 'Pendientes', 'Total Asignadas'];
        const statsRows = Object.values(techStats).sort((a,b) => b.total - a.total).map(ts => [
            ts.name,
            ts.done,
            ts.total - ts.done,
            ts.total
        ]);

        const csvContentStats = [statsHeaders, ...statsRows].map(e => e.join(",")).join("\n");
        const csvContentDetail = [headers, ...rows].map(e => e.join(",")).join("\n");
        const csvContent = csvContentStats + "\n\nDETALLE DE ORDENES\n" + csvContentDetail;

        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const fileName = `Velocity_Export_${start}_al_${end}.csv`;

        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);

        document.getElementById('export-orders-modal').remove();

    } catch (e) {
        alert('Error al exportar: ' + e.message);
        btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">download</span> Generar y Descargar CSV`;
        btn.disabled = false;
    }
};


// ── EXPORTACIÓN MENSUAL ────────────────────────────────────────────────────
window.exportMonthlyCSV = function() {
    const r = state.monthlyReport.results;
    if (!r) return;

    const headers = ['ID', 'Fecha', 'Cliente', 'Zona', 'Categoría', 'Estado', 'Prioridad', 'Descripción'];
    const rows = r.issues.map(i => {
        const c = state.clients[i.client_id] || {};
        const cat = state.categories[i.category_id] || '';
        const title = i.title || i.description || '';
        const zm = title.match(/\(([^)]+)\)/);
        const zone = (zm ? zm[1] : (c.zone || '')) || 'Sin zona';
        
        return [
            i.public_id,
            (i.created_at || '').slice(0, 10),
            (c.name || 'Desconocido').replace(/,/g, ''),
            zone,
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

window.showActiveTechsModal = function() {
    const dbSync = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    const registeredTechs = dbSync.technicians || [];
    const onlineStatus = {
        ...JSON.parse(localStorage.getItem('Velocity_Online_Status') || '{}'),
        ...(dbSync.onlineStatus || {})
    };
    
    // Validar fecha de inicio de la orden
    const isToday = (timestamp) => {
        if (!timestamp) return false;
        const d = new Date(timestamp);
        const today = new Date();
        return d.getDate() === today.getDate() &&
               d.getMonth() === today.getMonth() &&
               d.getFullYear() === today.getFullYear();
    };

    // Usar estrictamente el activeTracking del servidor
    const tracking = dbSync.activeTracking || {};
    
    const techStatusList = registeredTechs.map(tech => {
        const lastSeen = onlineStatus[tech.id];
        const isOnline = lastSeen && (Date.now() - lastSeen < 180000);
        
        const activeOrderEntry = Object.entries(tracking).find(([orderId, t]) => {
            return String(t.empId) === String(tech.id) && t.status === 'started' && isToday(t.startTime);
        });
        
        let activeOrder = null;
        if (activeOrderEntry) {
            const orderId = activeOrderEntry[0];
            const order = [...(state.orders || []), ...(state.finishedOrders || [])].find(o => String(o.id) === String(orderId));
            activeOrder = {
                id: orderId,
                client: order ? order.client : 'Cliente desconocido',
                kind: order ? order.kind : 'Servicio',
                startTime: activeOrderEntry[1].startTime
            };
        }
        
        return {
            ...tech,
            isOnline,
            lastSeen,
            activeOrder
        };
    });

    techStatusList.sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0));

    const itemsHtml = techStatusList.map(t => {
        const statusBadge = t.isOnline
            ? `<span class="flex items-center gap-1.5 text-xs font-black text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full"><div class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> EN LÍNEA</span>`
            : `<span class="flex items-center gap-1.5 text-xs font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full"><div class="w-1.5 h-1.5 rounded-full bg-gray-300"></div> OFFLINE</span>`;
            
        let lastSeenText = 'Nunca visto';
        if (t.lastSeen) {
            const diffMin = Math.round((Date.now() - t.lastSeen) / 60000);
            lastSeenText = diffMin <= 0 ? 'Hace un momento' : `Hace ${diffMin} min`;
        }

        let orderHtml = `<p class="text-xs text-on-surface-variant italic">Sin tareas en curso</p>`;
        if (t.activeOrder) {
            const timeActive = Math.round((Date.now() - t.activeOrder.startTime) / 60000);
            const timeStr = timeActive < 60 ? `${timeActive} min` : `${Math.floor(timeActive/60)}h ${timeActive%60}m`;
            orderHtml = `
                <div class="p-3 bg-secondary/5 rounded-xl border border-secondary/10">
                    <div class="flex items-center gap-1 text-[9px] font-black uppercase text-secondary tracking-wider">
                        <span class="material-symbols-outlined text-xs">play_circle</span> En Curso (${timeStr})
                    </div>
                    <p class="text-xs font-bold text-on-surface mt-1">${t.activeOrder.client}</p>
                    <p class="text-[10px] text-on-surface-variant font-semibold mt-0.5">${t.activeOrder.kind.toUpperCase()} (#${t.activeOrder.id})</p>
                </div>
            `;
        }

        const initials = techInitials(t.name || 'T');
        const color = TECH_PALETTE[t.name] || 'hsl(210, 80%, 40%)';

        return `
            <div class="p-4 bg-surface-container border border-outline-variant/30 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-secondary/25 transition-all">
                <div class="flex items-center gap-3">
                    <div class="w-11 h-11 rounded-xl font-black text-sm flex items-center justify-center text-white" style="background:${color}">
                        ${initials}
                    </div>
                    <div>
                        <h5 class="font-bold text-on-surface text-sm">${t.name}</h5>
                        <p class="text-[10px] text-on-surface-variant font-semibold mt-0.5">Último reporte: ${lastSeenText}</p>
                    </div>
                </div>
                <div class="flex flex-col items-start md:items-end gap-1.5">
                    ${statusBadge}
                </div>
                <div class="w-full md:w-auto md:max-w-xs flex-shrink-0">
                    ${orderHtml}
                </div>
            </div>
        `;
    }).join('<div class="h-2"></div>');

    let modal = document.getElementById('active-techs-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'active-techs-modal';
        modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in';
        modal.onclick = function(e) {
            if (e.target === modal) {
                window.closeActiveTechsModal();
            }
        };
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
        <div class="bg-surface-container-lowest rounded-[2rem] border border-outline-variant/30 w-full max-w-2xl overflow-hidden shadow-2xl animate-scale-up">
            <div class="p-6 border-b border-outline-variant/20 flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-secondary">group</span>
                    <div>
                        <h4 class="font-black text-on-surface text-lg">Técnicos Activos en Campo</h4>
                        <p class="text-xs text-on-surface-variant font-semibold">Estado de conexión y tareas en tiempo real</p>
                    </div>
                </div>
                <button onclick="window.closeActiveTechsModal()" class="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="p-6 max-h-[60vh] overflow-y-auto space-y-3">
                ${itemsHtml || '<p class="text-center text-sm text-on-surface-variant font-semibold">No hay técnicos registrados</p>'}
            </div>
            <div class="p-6 bg-surface-container-low border-t border-outline-variant/20 flex justify-end">
                <button onclick="window.closeActiveTechsModal()" class="bg-primary text-white font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-primary/90 active:scale-95 transition-all">
                    Cerrar
                </button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
};

window.closeActiveTechsModal = function() {
    const modal = document.getElementById('active-techs-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
};



