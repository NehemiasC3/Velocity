/**
 * VELOCITY — Panel de Técnico
 * Muestra las órdenes del día asignadas al técnico autenticado
 */

// ── CONFIG ────────────────────────────────────────────────────────────────
const CFG_T = {
    proxy: 'https://corsproxy.io/?',
    base:  'https://www.cloud.wispro.co/api/v1',
    token: ''
};

if (typeof VELOCITY_CONFIG !== 'undefined' && VELOCITY_CONFIG.wisproToken) {
    CFG_T.token = VELOCITY_CONFIG.wisproToken;
    CFG_T.base  = VELOCITY_CONFIG.wisproBaseUrl || CFG_T.base;
}
if (!CFG_T.token) {
    try {
        const raw = localStorage.getItem('Velocity_Sync_State');
        if (raw) CFG_T.token = JSON.parse(raw).settings?.wisproToken || '';
    } catch {}
}

// ── ESTADO ────────────────────────────────────────────────────────────────
const techState = {
    profile:    null,   // datos del técnico logueado
    orders:     [],     // órdenes del día
    view:       'agenda',
    inventory:  null
};

// ── SESIÓN ────────────────────────────────────────────────────────────────
const SESSION_ROLE = sessionStorage.getItem('Velocity_Role');
const SESSION_ID   = sessionStorage.getItem('Velocity_Active_User');

if (SESSION_ROLE !== 'technician' || !SESSION_ID) {
    window.location.href = 'login.html';
}

// ── API ───────────────────────────────────────────────────────────────────
async function tFetch(path, opts = {}) {
    const url = CFG_T.proxy + encodeURIComponent(CFG_T.base + path);
    const res = await fetch(url, {
        ...opts,
        headers: {
            'Authorization': CFG_T.token,
            'Accept':        'application/json',
            'Content-Type':  'application/json',
            ...(opts.headers || {})
        }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// ── TIPOS ─────────────────────────────────────────────────────────────────
const TYPE_CFG_T = {
    technical:   { color: '#7c3aed', label: 'Visita Técnica',  icon: 'build' },
    installation:{ color: '#0059bb', label: 'Instalación',     icon: 'wifi' },
    feasibility: { color: '#059669', label: 'Factibilidad',    icon: 'search' },
    resignation: { color: '#dc2626', label: 'Baja de Servicio',icon: 'cancel' }
};

// ── CARGA DE DATOS ────────────────────────────────────────────────────────
async function loadTechData() {
    // Obtener perfil del técnico desde localStorage
    const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    const techs = db.technicians || [];
    techState.profile = techs.find(t => String(t.id) === String(SESSION_ID));

    if (!techState.profile) {
        showError('No se encontró tu perfil. Contacta al supervisor.');
        return;
    }

    // Cargar inventario guardado
    const savedInv = localStorage.getItem(`V_Inventory_${SESSION_ID}`);
    techState.inventory = savedInv ? JSON.parse(savedInv) : defaultInventory();

    // Cargar órdenes del día desde Wispro
    await loadMyOrders();
}

function defaultInventory() {
    return [
        { id: 'fibra',    name: 'Drop Fibra (m)',      qty: 240, step: 10 },
        { id: 'onu',      name: 'ONU',                 qty: 0,   step: 1  },
        { id: 'kits',     name: 'Kits',                qty: 2,   step: 1  },
        { id: 'herrajes', name: 'Herrajes',             qty: 10,  step: 1  },
        { id: 'tensores', name: 'Tensores',             qty: 15,  step: 1  },
        { id: 'pigtails', name: 'Pigtails UPC',         qty: 5,   step: 1  },
        { id: 'con_apc',  name: 'Conectores APC',       qty: 20,  step: 5  },
        { id: 'con_upc',  name: 'Conectores UPC',       qty: 20,  step: 5  },
        { id: 'rj45',     name: 'RJ45',                 qty: 50,  step: 10 },
        { id: 'patchcord',name: 'Patchcord',            qty: 10,  step: 1  }
    ];
}

async function loadMyOrders() {
    if (!CFG_T.token) return;

    try {
        const todayStr = new Date().toLocaleDateString('en-CA');
        const raw = `${CFG_T.base}/order/orders?per_page=1000&q%5Bs%5D=start_at+desc`;
        const url = CFG_T.proxy + encodeURIComponent(raw);
        const res = await fetch(url, {
            headers: { 'Authorization': CFG_T.token, 'Accept': 'application/json' }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = await res.json();

        // Buscar el employee_id del técnico en Wispro
        const empData = await tFetch('/employees?per_page=1000');
        const employees = Array.isArray(empData.data) ? empData.data : [];
        const myEmployee = employees.find(e =>
            e.name?.toLowerCase().includes(techState.profile.name.split(' ')[0].toLowerCase()) ||
            e.email?.toLowerCase() === techState.profile.email?.toLowerCase()
        );

        const myEmpId = myEmployee?.id;

        // Filtrar órdenes del día asignadas a este técnico
        const myOrders = (d.data || []).filter(o => {
            const day   = (o.start_at || '').slice(0, 10);
            const state = (o.state || '').toLowerCase();
            return day === todayStr && o.employee_id === myEmpId;
        });

        // Resolver ordenables (contratos, instalaciones) para obtener datos del cliente
        const orderables = {};
        myOrders.forEach(o => {
            if (o.orderable_id) orderables[o.orderable_id] = o.kind;
        });
        
        const targetIds = Object.keys(orderables);
        const contractMap = {};
        const db2 = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
        const clients = db2.clients_cache || [];

        await Promise.all(targetIds.map(async (cid) => {
            try {
                const kind = orderables[cid];
                let endpointsToTry = [`/contracts/${cid}`];
                if (kind === 'installation') {
                    endpointsToTry = [`/installation_orders/${cid}`, `/clients/${cid}`, `/contracts/${cid}`];
                }

                let c = null;
                for (const ep of endpointsToTry) {
                    try {
                        const r = await tFetch(ep);
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
                    // Buscar cliente en cache
                    let client  = clients.find(cl => cl.id === realClientId);
                    
                    if (!c.client_id && c.name) {
                        client = c;
                    }
                    else if (!client) {
                        try {
                            const clRes = await tFetch(`/clients/${realClientId}`);
                            if (clRes) {
                                client = clRes.data || clRes;
                            }
                        } catch(e) {}
                    }
                    
                    contractMap[cid] = {
                        name:    client?.name || '',
                        address: [c.address_street, c.address_number, c.address_city].filter(Boolean).join(', ') || client?.address || client?.street || '',
                        zone:    client?.zone_name || c.address_city || '',
                        phone:   client?.phone_mobile || client?.phone || '',
                        nap:     c.nap_name || null
                    };
                }
            } catch {}
        }));

        // Mapear órdenes
        techState.orders = myOrders.map(o => {
            const resolved  = contractMap[o.orderable_id] || {};
            const typeCfg   = TYPE_CFG_T[o.kind] || { color: '#6b7280', label: o.kind || '?', icon: 'task' };
            const nameFromDesc = o.description?.match(/\(([^)]+)\)/)?.[1] || '';
            const mappedName = resolved?.name || nameFromDesc || `#${o.sequential_id || o.id} ${o.orderable_id ? '' : '(Sin Asignar)'}`;
            const startDate = o.start_at ? new Date(o.start_at) : null;
            const endDate   = o.end_at   ? new Date(o.end_at)   : null;

            return {
                id:        o.sequential_id || o.id?.slice(0, 8),
                rawId:     o.id,
                kind:      o.kind,
                typeLabel: typeCfg.label,
                typeColor: typeCfg.color,
                typeIcon:  typeCfg.icon,
                state:     o.state,
                result:    o.result,
                client:    resolved.name || nameFromDesc || `#${o.sequential_id}`,
                address:   resolved.address || '',
                zone:      resolved.zone || '',
                phone:     resolved.phone || '',
                nap:       resolved.nap || null,
                startTime: startDate ? startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
                endTime:   endDate   ? endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })   : '--:--',
                description: o.description || '',
                ticketable_id: o.ticketable_id || null,
                ticketable_type: o.ticketable_type || null
            };
        }).sort((a, b) => a.startTime.localeCompare(b.startTime));

        // Calcular ONUs necesarias
        const instCount = techState.orders.filter(o => o.kind === 'installation').length;
        const onuItem   = techState.inventory.find(i => i.id === 'onu');
        if (onuItem) onuItem.qty = instCount;

    } catch(e) {
        console.error('Error cargando órdenes:', e);
    }
}

// ── RENDER ────────────────────────────────────────────────────────────────
function renderApp() {
    updateGreeting();
    renderProgress();
    renderView(techState.view);
}

function updateGreeting() {
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
    const el = document.getElementById('hero-greeting');
    if (el) el.textContent = `${greet}, ${techState.profile?.name?.split(' ')[0] || 'Técnico'}`;
}

function renderProgress() {
    const total   = techState.orders.length;
    const done    = techState.orders.filter(o => o.result === 'success').length;
    const pct     = total > 0 ? Math.round(done / total * 100) : 0;

    const pctEl  = document.getElementById('progress-percentage');
    const txtEl  = document.getElementById('progress-text');
    const barEl  = document.getElementById('progress-bar');
    const nameEl = document.getElementById('progress-name');

    if (pctEl)  pctEl.textContent  = `${pct}%`;
    if (txtEl)  txtEl.textContent  = `${done} de ${total} tareas completadas`;
    if (barEl)  barEl.style.width  = `${pct}%`;
    if (nameEl) nameEl.textContent = `Rendimiento ${techState.profile?.name?.split(' ')[0] || ''}`;
}

function renderView(view) {
    // Ocultar todas las vistas
    ['agenda','stock','perfil'].forEach(v => {
        document.getElementById(`view-${v}`)?.classList.add('hidden');
    });
    document.getElementById(`view-${view}`)?.classList.remove('hidden');

    if (view === 'agenda')  renderAgenda();
    if (view === 'stock')   renderStock();
    if (view === 'perfil')  renderPerfil();
}

// ── AGENDA ────────────────────────────────────────────────────────────────
function renderAgenda() {
    const container  = document.getElementById('tickets-container');
    const nextStop   = document.getElementById('next-stop-container');
    if (!container) return;

    if (!techState.orders.length) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-16 text-on-surface-variant opacity-50">
                <span class="material-symbols-outlined text-6xl mb-3">inbox</span>
                <p class="font-bold text-sm uppercase tracking-widest">Sin órdenes asignadas hoy</p>
            </div>`;
    } else {
        container.innerHTML = techState.orders.map(o => renderOrderCard(o)).join('');
    }

    // Próxima parada
    const next = techState.orders.find(o => o.state === 'pending' && o.result === 'not_set');
    if (next && nextStop) {
        nextStop.innerHTML = `
            <div class="relative z-10 w-full">
                <div class="flex items-center gap-2 mb-2">
                    <span class="material-symbols-outlined text-secondary text-sm">near_me</span>
                    <span class="text-xs font-bold text-on-surface uppercase tracking-tighter">Siguiente Parada</span>
                </div>
                <p class="text-sm font-semibold text-on-surface border-b border-surface-container-highest pb-2">${next.client}</p>
                <div class="flex justify-between items-center mt-2">
                    <p class="text-xs text-on-surface-variant line-clamp-1 flex-1 pr-2">${next.address || next.zone || '—'}</p>
                    <span class="text-xs font-bold bg-surface px-2 py-0.5 rounded text-secondary">${next.startTime}</span>
                </div>
                ${next.address ? `
                <div class="w-full h-36 rounded-xl overflow-hidden border border-outline-variant/30 mt-2">
                    <iframe width="100%" height="100%" frameborder="0" style="border:0"
                        src="https://maps.google.com/maps?q=${encodeURIComponent(next.address + ' Panama')}&output=embed"
                        allowfullscreen></iframe>
                </div>` : ''}
            </div>`;
    } else if (nextStop) {
        nextStop.innerHTML = `
            <div class="relative z-10 flex flex-col items-center text-center">
                <span class="material-symbols-outlined text-tertiary-fixed-dim text-3xl mb-1">done_all</span>
                <p class="text-sm font-bold text-on-surface">¡Jornada Finalizada!</p>
                <p class="text-xs text-on-surface-variant">No hay más órdenes pendientes</p>
            </div>`;
    }
}

function renderOrderCard(o) {
    const isDone    = o.result === 'success';
    const isActive  = o.state === 'pending' && o.result === 'not_set';
    const borderCls = isDone ? 'border-l-4 border-tertiary-fixed-dim opacity-75' : isActive ? 'border-l-4 border-secondary' : 'border border-outline-variant/30';

    const napInfo = o.nap
        ? `<div class="flex items-center gap-2 mt-3 pt-3 border-t border-surface-container-highest">
               <span class="material-symbols-outlined text-tertiary-fixed-dim text-sm" style="font-variation-settings:'FILL' 1;">router</span>
               <span class="text-sm font-semibold text-on-surface">${o.nap}</span>
           </div>`
        : (o.kind === 'technical' || o.kind === 'installation')
            ? `<div class="flex items-center gap-2 mt-3 pt-3 border-t border-surface-container-highest">
                   <span class="material-symbols-outlined text-error text-sm" style="font-variation-settings:'FILL' 1;">warning</span>
                   <span class="text-xs font-bold text-error uppercase">Sin NAP asignada</span>
               </div>`
            : '';

    const tracking = JSON.parse(localStorage.getItem('Velocity_Order_Tracking') || '{}');
    const trackData = tracking[o.id] || tracking[o.rawId];
    let buttons = '';

    if (isDone) {
        buttons = `<div class="mt-4 bg-tertiary-fixed/20 text-on-tertiary-container px-4 py-2.5 rounded-xl text-center font-bold text-sm flex items-center justify-center gap-2">
                       <span class="material-symbols-outlined text-sm">done_all</span> Completada
                   </div>`;
    } else if (trackData && trackData.status === 'started') {
        const mins = Math.floor((Date.now() - trackData.startTime) / 60000);
        buttons = `<div class="mt-4 flex gap-3">
                       <div class="flex-1 flex items-center justify-center gap-2 bg-on-tertiary-container/10 text-on-tertiary-container py-3 rounded-xl font-bold text-sm border border-tertiary-fixed-dim/30">
                           <span class="material-symbols-outlined text-[18px] animate-pulse">timer</span>
                           En curso: ${mins} min
                       </div>
                       <button onclick="window.finishOrder('${o.id}')" class="flex-1 flex items-center justify-center gap-2 border border-outline-variant text-on-surface py-3 rounded-xl font-bold text-sm active:scale-95 transition-transform hover:bg-surface-container-low">
                           <span class="material-symbols-outlined text-sm">check_circle</span>
                           Finalizar
                       </button>
                   </div>`;
    } else {
        buttons = `<div class="grid grid-cols-2 gap-3 mt-4">
               <button onclick="window.startOrder('${o.id}')" class="flex items-center justify-center gap-2 kinetic-gradient text-white py-3 rounded-xl font-bold text-sm active:scale-95 transition-transform shadow-sm">
                   <span class="material-symbols-outlined text-sm" style="font-variation-settings:'FILL' 1;">play_arrow</span>
                   Iniciar
               </button>
               <button onclick="window.finishOrder('${o.id}')" class="flex items-center justify-center gap-2 border border-outline-variant text-on-surface py-3 rounded-xl font-bold text-sm active:scale-95 transition-transform hover:bg-surface-container-low">
                   <span class="material-symbols-outlined text-sm">check_circle</span>
                   Finalizar
               </button>
           </div>`;
    }

    return `
    <div class="bg-surface-container-lowest p-5 rounded-[1.25rem] shadow-sm ${borderCls}">
        <div class="flex justify-between items-start mb-3">
            <div>
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-black text-lg text-on-surface">#${o.id}</span>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase" style="background:${o.typeColor}18;color:${o.typeColor};">${o.typeLabel}</span>
                </div>
                <p class="font-bold text-on-surface text-base mt-1">${o.client}</p>
            </div>
            <div class="text-right">
                <span class="text-xs font-bold bg-surface-container px-2 py-1 rounded-full text-on-surface-variant">${o.startTime}</span>
            </div>
        </div>

        <div class="flex items-start gap-2 mb-1">
            <span class="material-symbols-outlined text-outline text-sm mt-0.5">location_on</span>
            <div>
                <p class="text-sm text-on-surface font-medium">${o.address || '—'}</p>
                ${o.zone ? `<span class="text-xs font-bold text-secondary">${o.zone}</span>` : ''}
            </div>
        </div>

        ${o.phone ? `
        <a href="tel:${o.phone}" class="flex items-center gap-1.5 text-secondary font-bold text-sm mt-2 hover:underline active:scale-95 transition-transform inline-flex">
            <span class="material-symbols-outlined text-sm">call</span> ${o.phone}
        </a>` : ''}

        ${napInfo}
        <div class="flex items-center justify-between mt-4">
            <button onclick="window.openFeedbackModal('${o.id}')" class="flex items-center gap-2 text-secondary font-bold text-xs uppercase tracking-widest px-3 py-2 rounded-xl border border-secondary/10 hover:bg-secondary/5 transition-all active:scale-95">
                <span class="material-symbols-outlined text-[18px]">history_edu</span>
                Bitácora
            </button>
        </div>
        ${buttons}
    </div>`;
}

// ── STOCK ─────────────────────────────────────────────────────────────────
function renderStock() {
    const container = document.getElementById('inventory-container');
    if (!container || !techState.inventory) return;

    const pendingInst = techState.orders.filter(o => o.kind === 'installation' && o.result !== 'success').length;
    const onuItem     = techState.inventory.find(i => i.id === 'onu');
    if (onuItem) onuItem.name = `ONU (Req. ${pendingInst})`;

    let lowStock = false;
    let html = `
        <div class="flex justify-between items-center mb-4">
            <span class="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Mi Equipamiento</span>
        </div>
        <div class="space-y-3 max-h-80 overflow-y-auto pr-1">`;

    techState.inventory.forEach(item => {
        const isLow = item.qty <= 0;
        if (isLow) lowStock = true;
        const qtyColor = isLow ? 'text-error' : item.qty <= 3 ? 'text-on-tertiary-container' : 'text-secondary';

        html += `
        <div class="flex flex-col gap-1 border-b border-surface-container-highest pb-2 last:border-0">
            <div class="flex justify-between items-center">
                <span class="text-sm font-medium text-on-surface">${item.name}</span>
                <span class="text-sm font-bold ${qtyColor}">${item.qty}</span>
            </div>
            <div class="flex justify-end gap-2">
                <button onclick="window.updateStock('${item.id}',-${item.step})" class="text-xs bg-surface-container font-bold text-on-surface-variant px-3 py-1 rounded-lg hover:bg-outline-variant/30 active:scale-95 transition-all">- ${item.step}</button>
                <button onclick="window.updateStock('${item.id}',${item.step})" class="text-xs bg-surface-container font-bold text-on-surface-variant px-3 py-1 rounded-lg hover:bg-outline-variant/30 active:scale-95 transition-all">+ ${item.step}</button>
            </div>
        </div>`;
    });

    html += `</div>`;

    if (lowStock) {
        const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
        const warehouseEmail = db.settings?.warehouseEmail || '';
        const body = encodeURIComponent(`Hola,\n\nSolicito material extra. Me estoy quedando sin stock crítico.\n\nAtentamente,\n${techState.profile?.name}`);
        html += `
        <div class="mt-4 p-3 bg-error-container text-on-error-container rounded-xl">
            <p class="text-xs font-bold uppercase mb-2">⚠️ Stock Crítico</p>
            <a href="mailto:${warehouseEmail}?subject=Solicitud de Materiales - ${techState.profile?.name}&body=${body}"
               class="block w-full text-center bg-error text-on-error py-2 rounded-lg text-xs font-bold active:scale-95 transition-transform">
               Solicitar al Almacén
            </a>
        </div>`;
    }

    container.innerHTML = html;
}

// ── PERFIL ────────────────────────────────────────────────────────────────
function renderPerfil() {
    const nameTag   = document.getElementById('profile-name-tag');
    const nameInput = document.getElementById('profile-name-input');
    if (nameTag)   nameTag.textContent   = techState.profile?.name || 'Técnico';
    if (nameInput) nameInput.value       = techState.profile?.name || '';
}

// ── ACCIONES ──────────────────────────────────────────────────────────────
window.switchTab = function(view) {
    techState.view = view;

    // Actualizar nav
    document.querySelectorAll('.nav-tab').forEach(btn => {
        const isActive = btn.id === `nav-${view}`;
        btn.classList.toggle('text-secondary', isActive);
        btn.classList.toggle('text-on-surface-variant', !isActive);
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) icon.style.fontVariationSettings = isActive ? "'FILL' 1" : "'FILL' 0";
    });

    renderView(view);
};

window.startOrder = function(orderId) {
    const order = techState.orders.find(o => String(o.id) === String(orderId));
    if (!order) return;

    // WhatsApp con texto prescrito
    const text = `🔧 *INICIO DE ORDEN*\n\n` +
        `📋 Orden: #${order.id}\n` +
        `📌 Tipo: ${order.typeLabel}\n` +
        `👤 Cliente: ${order.client}\n` +
        `📍 Dirección: ${order.address || order.zone || '—'}\n` +
        `⏰ Hora: ${order.startTime}\n\n` +
        `✅ Iniciando atención — ${techState.profile?.name}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
};

window.finishOrder = function(orderId) {
    const order = techState.orders.find(o => String(o.id) === String(orderId));
    if (!order) return;

    // Validar NAP para instalaciones y visitas técnicas
    if ((order.kind === 'installation' || order.kind === 'technical') && !order.nap) {
        if (!confirm(`⚠️ Esta ${order.typeLabel} no tiene NAP asignada.\n¿Deseas finalizar de todas formas?`)) return;
    }

    // Marcar como completada localmente
    order.result = 'success';
    order.state  = 'finalized';

    // Descontar ONU si es instalación
    if (order.kind === 'installation') {
        const onuItem = techState.inventory.find(i => i.id === 'onu');
        if (onuItem && onuItem.qty > 0) onuItem.qty--;
        saveInventory();
    }

    renderProgress();
    renderAgenda();

    // WhatsApp con texto prescrito
    const text = `✅ *ORDEN FINALIZADA*\n\n` +
        `📋 Orden: #${order.id}\n` +
        `📌 Tipo: ${order.typeLabel}\n` +
        `👤 Cliente: ${order.client}\n` +
        `📍 Dirección: ${order.address || order.zone || '—'}\n` +
        `${order.nap ? `🔌 NAP: ${order.nap}\n` : ''}` +
        `⏰ Finalizado: ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}\n\n` +
        `— ${techState.profile?.name}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
};

window.updateStock = function(id, delta) {
    const item = techState.inventory.find(i => i.id === id);
    if (item) {
        item.qty = Math.max(0, item.qty + delta);
        saveInventory();
        renderStock();
    }
};

function saveInventory() {
    localStorage.setItem(`V_Inventory_${SESSION_ID}`, JSON.stringify(techState.inventory));
}

window.saveProfile = function() {
    const newName = document.getElementById('profile-name-input')?.value.trim();
    if (!newName) return;

    const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    const tech = (db.technicians || []).find(t => String(t.id) === String(SESSION_ID));
    if (tech) {
        tech.name = newName;
        localStorage.setItem('Velocity_Sync_State', JSON.stringify(db));
        techState.profile.name = newName;
        updateGreeting();
        renderPerfil();
        alert('✅ Perfil actualizado');
    }
};

window.forgotPassword = function() {
    alert('Contacta a tu supervisor para restablecer tu contraseña.');
};

window.logout = function() {
    try {
        if(SESSION_ID) {
            const statusObj = JSON.parse(localStorage.getItem('Velocity_Online_Status') || '{}');
            delete statusObj[SESSION_ID];
            localStorage.setItem('Velocity_Online_Status', JSON.stringify(statusObj));
        }
    } catch(e) {}
    document.getElementById('logout-modal')?.classList.remove('hidden');
};

// ── TRACKING EN CURSO ─────────────────────────────────────────────────────
window.startOrder = function(id) {
    if(!confirm('¿Iniciar tiempo de trabajo para esta orden?')) return;
    try {
        const tracking = JSON.parse(localStorage.getItem('Velocity_Order_Tracking') || '{}');
        tracking[id] = { status: 'started', startTime: Date.now(), empId: SESSION_ID };
        localStorage.setItem('Velocity_Order_Tracking', JSON.stringify(tracking));
        renderAgenda();
    } catch(e) { console.error('Error al iniciar orden:', e); }
};

window.finishOrder = function(id) {
    if(!confirm('¿Marcar como finalizada localmente? (Recuerda cerrar el contrato en Wispro)')) return;
    try {
        const tracking = JSON.parse(localStorage.getItem('Velocity_Order_Tracking') || '{}');
        delete tracking[id];
        localStorage.setItem('Velocity_Order_Tracking', JSON.stringify(tracking));
        // Aquí podríamos hacer un optimistic UI update
        const order = techState.orders.find(o => o.id === id || o.rawId === id);
        if(order) order.result = 'success';
        
        renderApp();
    } catch(e) { console.error('Error al finalizar orden:', e); }
};



// ── BITÁCORA (SINCRONIZADA CON WISPRO) ────────────────────────────────────
window.openFeedbackModal = async function(id) {
    const order = techState.orders.find(o => String(o.id) === String(id));
    if (!order) { alert('No se encontró la orden seleccionada.'); return; }

    // Determinar si es interactivo (tiene ticket vinculado)
    const linkedIssueId = (order.ticketable_id && order.ticketable_type?.toLowerCase().includes('issue')) ? order.ticketable_id : null;
    const canWrite = !!linkedIssueId;

    const modalId = 'tech-feedback-modal';
    document.getElementById(modalId)?.remove();

    const html = `
    <div id="${modalId}" class="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div class="bg-surface-container-lowest w-full max-w-lg max-h-[85vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border border-outline-variant/20">
            <!-- Header -->
            <div class="p-5 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-low/50">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white" style="background:${order.typeColor}">
                        <span class="material-symbols-outlined">history_edu</span>
                    </div>
                    <div>
                        <h3 class="font-black text-on-surface text-base">Bitácora #${order.id}</h3>
                        <p class="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest truncate max-w-[180px]">${order.client}</p>
                    </div>
                </div>
                <button onclick="document.getElementById('${modalId}').remove()" class="w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center">
                    <span class="material-symbols-outlined text-on-surface-variant text-xl">close</span>
                </button>
            </div>

            <!-- Body (Timeline) -->
            <div id="feedback-timeline" class="flex-1 overflow-y-auto p-5 space-y-4 bg-surface-container-lowest/50">
                <div class="flex flex-col items-center justify-center py-12 text-on-surface-variant/30">
                    <span class="material-symbols-outlined text-4xl mb-2 animate-spin">sync</span>
                    <p class="font-bold text-[10px] uppercase tracking-widest">Sincronizando...</p>
                </div>
            </div>

            <!-- Input (Solo si hay vínculo) -->
            ${canWrite ? `
            <div class="p-4 bg-surface-container-low/30 border-t border-outline-variant/10">
                <div class="relative">
                    <textarea id="issue-comment-input" rows="2" 
                        class="w-full bg-surface-container-lowest border-2 border-outline-variant/20 rounded-2xl p-3 pr-14 text-sm font-bold text-on-surface placeholder:text-on-surface-variant/40 focus:border-secondary outline-none transition-all resize-none shadow-inner"
                        placeholder="Escribe un comentario..."></textarea>
                    <button onclick="window.submitIssueFeedback('${linkedIssueId}')" 
                        id="btn-send-issue-feedback"
                        class="absolute right-2 bottom-2 w-10 h-10 kinetic-gradient text-white rounded-xl shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all">
                        <span class="material-symbols-outlined text-lg">send</span>
                    </button>
                </div>
            </div>
            ` : ''}

            <!-- Footer -->
            <div class="px-5 py-3 bg-surface-container-low border-t border-outline-variant/10 flex items-center justify-between">
                <span class="text-[9px] font-black uppercase text-on-surface-variant/50 italic">${canWrite ? 'Interactivo' : 'Solo Lectura'}</span>
                <div class="flex items-center gap-1.5 opacity-60">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span class="text-[9px] font-bold text-on-surface-variant">Live Sync Wispro</span>
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

    try {
        let allFeedbacks = [];
        
        // 1. Feedbacks de la Orden (Solo lectura generalmente)
        try {
            const orderRes = await tFetch(`/order/orders/${target.rawId}/feedbacks`);
            if (orderRes.data) allFeedbacks.push(...orderRes.data);
            else if (Array.isArray(orderRes)) allFeedbacks.push(...orderRes);
        } catch(e) {}

        // 2. Feedbacks del Ticket vinculado (Mesa de Ayuda)
        if (target.ticketable_id && target.ticketable_type?.toLowerCase().includes('issue')) {
            try {
                const issueRes = await tFetch(`/help_desk/issues/${target.ticketable_id}/feedbacks`);
                if (issueRes.data) {
                    issueRes.data.forEach(f => {
                        if (!allFeedbacks.find(existing => existing.id === f.id)) allFeedbacks.push(f);
                    });
                }
            } catch(e) {}
        }

        if (allFeedbacks.length === 0) {
            timeline.innerHTML = `
                <div class="flex flex-col items-center justify-center py-16 text-on-surface-variant/20 italic">
                    <span class="material-symbols-outlined text-4xl mb-2">auto_stories</span>
                    <p class="text-[10px] font-bold tracking-widest uppercase">Sin historial de eventos</p>
                </div>`;
            return;
        }

        allFeedbacks.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));

        timeline.innerHTML = allFeedbacks.map(f => {
            const date = new Date(f.created_at).toLocaleString('es-PA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            const sender = f.author_name || f.technician_name || f.creator_name || 'Sistema';
            const isMe = sender.toLowerCase().includes(techState.profile?.name?.split(' ')[0].toLowerCase());
            
            return `
            <div class="flex gap-3 ${isMe ? 'flex-row-reverse' : ''}">
                <div class="w-8 h-8 rounded-lg bg-surface-container flex-shrink-0 flex items-center justify-center text-[10px] font-black text-on-surface-variant/50">
                    ${sender.slice(0,2).toUpperCase()}
                </div>
                <div class="max-w-[85%] ${isMe ? 'items-end flex flex-col' : ''}">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-[9px] font-black text-on-surface uppercase">${sender}</span>
                        <span class="text-[8px] text-on-surface-variant opacity-50">${date}</span>
                    </div>
                    <div class="p-3 rounded-2xl text-xs leading-relaxed ${isMe ? 'bg-secondary text-white rounded-tr-none shadow-sm shadow-secondary/20' : 'bg-surface-container-high text-on-surface rounded-tl-none border border-outline-variant/10'}">
                        ${f.body || f.comment || ''}
                    </div>
                </div>
            </div>`;
        }).join('');

        timeline.scrollTop = timeline.scrollHeight;

    } catch(e) {
        timeline.innerHTML = `<p class="text-center text-error font-black text-[9px] uppercase p-10 opacity-50">Error de conexión</p>`;
    }
};

window.submitIssueFeedback = async function(issueId) {
    const input = document.getElementById('issue-comment-input');
    const btn = document.getElementById('btn-send-issue-feedback');
    if (!input || !btn || !input.value.trim()) return;

    const text = input.value.trim();
    try {
        input.disabled = true;
        btn.disabled = true;
        btn.innerHTML = `<span class="material-symbols-outlined text-sm animate-spin">sync</span>`;

        await tFetch(`/help_desk/issues/${issueId}/feedbacks`, {
            method: 'POST',
            body: JSON.stringify({ feedback: { body: text } })
        });

        input.value = '';
        const currentOrder = techState.orders.find(o => String(o.ticketable_id) === String(issueId));
        if (currentOrder) await window.loadFeedbacks(currentOrder);

    } catch (e) {
        alert("Error al enviar comentario: " + e.message);
    } finally {
        input.disabled = false;
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-outlined text-lg">send</span>`;
    }
};

function showError(msg) {
    const el = document.getElementById('tickets-container');
    if (el) el.innerHTML = `
        <div class="flex flex-col items-center py-16 text-error opacity-70">
            <span class="material-symbols-outlined text-5xl mb-3">error</span>
            <p class="font-bold text-sm text-center">${msg}</p>
        </div>`;
}

// ── INIT ──────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
    // Mostrar loading
    const container = document.getElementById('tickets-container');
    if (container) container.innerHTML = `
        <div class="flex flex-col items-center py-16 text-on-surface-variant">
            <span class="material-symbols-outlined text-4xl text-secondary mb-2 animate-spin">sync</span>
            <p class="font-bold text-sm uppercase tracking-widest">Cargando tus órdenes...</p>
        </div>`;

    await loadTechData();
    renderApp();
    switchTab('agenda');
    // Reportar como "Online"
    function updateOnlineStatus() {
        if(!SESSION_ID) return;
        const statusObj = JSON.parse(localStorage.getItem('Velocity_Online_Status') || '{}');
        statusObj[SESSION_ID] = Date.now();
        localStorage.setItem('Velocity_Online_Status', JSON.stringify(statusObj));
    }
    updateOnlineStatus();

    // Refrescar cronómetros En Curso cada minuto y reportar estado Online
    setInterval(() => {
        updateOnlineStatus();
        if(techState.view === 'agenda') {
            const hasStarted = JSON.stringify(localStorage.getItem('Velocity_Order_Tracking') || '{}').includes('started');
            if(hasStarted) renderAgenda();
        }
    }, 60000);
});
