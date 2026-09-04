/**
 * VELOCITY — Panel de Técnico
 * Muestra las órdenes del día asignadas al técnico autenticado y gestiona
 * el Stock en tiempo real de su Camioneta / Bodega Móvil conectada con PostgreSQL.
 */

// ── CONFIG ────────────────────────────────────────────────────────────────
const CFG_T = {
    server: '' 
};

// ── ESTADO ────────────────────────────────────────────────────────────────
const techState = {
    profile:          null,   // datos del técnico logueado
    orders:           [],     // órdenes del día desde Wispro
    view:             'agenda',
    inventory:        null,   // inventario local / legacy
    vehicleWarehouse: null,   // Bodega móvil real desde PostgreSQL / Prisma
    isLoadingStock:   false,
    techs:            {}
};

// ── SESIÓN ────────────────────────────────────────────────────────────────
const SESSION_ROLE  = sessionStorage.getItem('Velocity_Role') || localStorage.getItem('Velocity_Role');
const SESSION_ID    = sessionStorage.getItem('Velocity_Active_User') || localStorage.getItem('Velocity_Active_User');
const SESSION_TOKEN = sessionStorage.getItem('Velocity_Token') || localStorage.getItem('Velocity_Token');

const allowedTechRoles = ['technician', 'admin', 'superadmin', 'supervisor'];
if (!allowedTechRoles.includes(String(SESSION_ROLE).toLowerCase()) || !SESSION_TOKEN) {
    window.location.href = '/login';
}

// ── API ───────────────────────────────────────────────────────────────────
async function tFetch(path, opts = {}, silent = false) {
    try {
        const isDirect = path.startsWith('/api/') || path.startsWith('api/') || 
                         path.startsWith('/inventory-api/') || path.startsWith('inventory-api/');
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;
        const url = path.startsWith('http') 
            ? path 
            : (isDirect ? (path.startsWith('/') ? path : '/' + path) : VELOCITY_CONFIG.proxy + cleanPath);
        
        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...(opts.headers || {})
        };
        if (SESSION_TOKEN) {
            headers['Authorization'] = SESSION_TOKEN;
        }

        const res = await fetch(url, {
            ...opts,
            headers,
            body: opts.body || (['POST', 'PUT', 'PATCH'].includes(opts.method) ? JSON.stringify(opts.data) : undefined)
        });

        if (res.ok) return await res.json();
        if (silent && res.status === 404) return null;
        
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `HTTP ${res.status}`);
    } catch (e) {
        if (!silent) console.error('[Velocity-Tech] API Error:', e.message);
        throw e;
    }
}

// ── SISTEMA DE LATIDO (HEARTBEAT) ──────────────────────────────────────────
function startHeartbeat() {
    if (!techState.profile || !techState.profile.wisproId) return;
    
    const sendPulse = async () => {
        try {
            const tracking = JSON.parse(localStorage.getItem('Velocity_Order_Tracking') || '{}');
            await fetch(VELOCITY_CONFIG.heartbeatPath, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': SESSION_TOKEN
                },
                body: JSON.stringify({
                    techId: techState.profile.wisproId,
                    tracking: tracking
                })
            });
        } catch (e) { console.warn('[Velocity-Tech] Heartbeat failed'); }
    };

    window.triggerHeartbeat = sendPulse;
    sendPulse();
    setInterval(sendPulse, 30000); // Cada 30 segundos
}

// ── TIPOS DE ÓRDENES ──────────────────────────────────────────────────────
const TYPE_CFG_T = {
    technical:   { color: '#7c3aed', label: 'Visita Técnica',  icon: 'build' },
    installation:{ color: '#0059bb', label: 'Instalación',     icon: 'wifi' },
    feasibility: { color: '#059669', label: 'Factibilidad',    icon: 'search' },
    resignation: { color: '#dc2626', label: 'Baja de Servicio',icon: 'cancel' }
};

// ── CARGA DE DATOS ────────────────────────────────────────────────────────
async function loadTechData() {
    // Obtener datos guardados de sesión
    const storedName  = sessionStorage.getItem('Velocity_User_Name') || localStorage.getItem('Velocity_User_Name');
    const storedEmail = sessionStorage.getItem('Velocity_Active_Email') || localStorage.getItem('Velocity_Active_Email');
    const storedId    = sessionStorage.getItem('Velocity_Active_User') || localStorage.getItem('Velocity_Active_User');

    // Obtener perfil del técnico desde localStorage / db
    const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    const techs = db.technicians || [];
    techState.profile = techs.find(t => String(t.id) === String(storedId) || (storedEmail && t.email?.toLowerCase() === storedEmail.toLowerCase()));

    if (!techState.profile) {
        techState.profile = {
            id: storedId || SESSION_ID,
            name: storedName || 'Capacitaciones ATG (Christofer)',
            email: storedEmail || 'capacitaciones@atg-rappido.com'
        };
    } else if (storedName && (!techState.profile.name || techState.profile.name === 'Técnico')) {
        techState.profile.name = storedName;
    }

    // Actualizar saludo de inmediato
    updateGreeting();

    // Cargar inventario guardado / fallback
    const savedInv = localStorage.getItem(`V_Inventory_${techState.profile.id}`);
    techState.inventory = savedInv ? JSON.parse(savedInv) : defaultInventory();

    // Cargar bodega móvil real desde PostgreSQL y órdenes de Wispro en paralelo
    await Promise.allSettled([
        loadMyOrders(),
        loadVehicleWarehouse()
    ]);
}

async function loadVehicleWarehouse() {
    try {
        techState.isLoadingStock = true;
        const identifier = techState.profile?.name || techState.profile?.id || SESSION_ID || 'Técnico';
        const res = await tFetch(`/inventory-api/warehouses/technician/${encodeURIComponent(identifier)}`, {}, true);
        if (res && res.success && res.warehouse) {
            techState.vehicleWarehouse = res.warehouse;
            const tagEl = document.getElementById('vehicle-warehouse-tag');
            if (tagEl) {
                tagEl.textContent = `${res.warehouse.name} (${res.warehouse.code || 'MÓVIL'})`;
            }
        }
    } catch (e) {
        console.warn('[Velocity-Tech] No se pudo cargar la bodega móvil remota:', e);
    } finally {
        techState.isLoadingStock = false;
    }
}

window.refreshTechStock = async function() {
    await loadVehicleWarehouse();
    renderStock();
    showToastNotification('Stock Actualizado', 'Existencias físicas de tu camioneta sincronizadas con PostgreSQL.');
};

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
    try {
        const todayStr = new Date().toLocaleDateString('en-CA');
        const d = await tFetch('/order/orders?per_page=1000&q%5Bs%5D=start_at+desc');

        // Buscar el employee_id del técnico en Wispro
        const empData = await tFetch('/employees?per_page=1000');
        const employees = Array.isArray(empData?.data) ? empData.data : [];
        
        // Poblar mapa de técnicos
        techState.techs = {};
        employees.forEach(e => {
            if (e.id && e.name) techState.techs[e.id] = e.name;
        });

        const myEmployee = employees.find(e =>
            (techState.profile?.wisproId && String(e.id) === String(techState.profile.wisproId)) ||
            (techState.profile?.email && e.email?.toLowerCase() === techState.profile.email?.toLowerCase()) ||
            (techState.profile?.name && e.name?.toLowerCase().includes(techState.profile.name.split(' ')[0].toLowerCase()))
        );

        const myEmpId = techState.profile?.wisproId || myEmployee?.id;

        // Filtrar órdenes del día asignadas a este técnico
        const myOrders = (d.data || []).filter(o => {
            const day   = (o.start_at || '').slice(0, 10);
            return day === todayStr && (!myEmpId || o.employee_id === myEmpId);
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
                    let client = clients.find(cl => cl.id === realClientId);
                    
                    if (!c.client_id && c.name) {
                        client = c;
                    } else if (!client) {
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
                        nap:     c.nap_name || null,
                        lat:     client?.latitude || c.latitude || null,
                        lng:     client?.longitude || c.longitude || null
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
                client:    mappedName,
                address:   resolved.address || '',
                zone:      resolved.zone || '',
                phone:     resolved.phone || '',
                nap:       resolved.nap || null,
                lat:       resolved.lat || null,
                lng:       resolved.lng || null,
                startTime: startDate ? startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
                endTime:   endDate   ? endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })   : '--:--',
                description: o.description || '',
                feedbacksCount: o.feedbacks_count || 0,
                ticketable_id: o.ticketable_id || null,
                ticketable_type: o.ticketable_type || null,
                orderable_id: o.orderable_id || null
            };
        }).sort((a, b) => a.startTime.localeCompare(b.startTime));

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
    const fullName = techState.profile?.name || sessionStorage.getItem('Velocity_User_Name') || localStorage.getItem('Velocity_User_Name') || 'Técnico';
    const el = document.getElementById('hero-greeting');
    if (el) el.textContent = `${greet}, ${fullName}`;
    
    // Navbar name display
    const nameEl = document.getElementById('active-user-name');
    if (nameEl) nameEl.textContent = fullName;
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
            <div class="flex flex-col items-center justify-center py-12 text-on-surface-variant text-center px-6">
                <span class="material-symbols-outlined text-6xl mb-4 opacity-20">inventory_2</span>
                <p class="font-bold text-sm uppercase tracking-widest mb-1">Sin órdenes para hoy</p>
                <p class="text-xs opacity-60 mb-6">No tienes tareas asignadas en Wispro con fecha de hoy.</p>
                
                <!-- Botón de Simulación para QA -->
                <button onclick="window.loadDemoOrders()" class="flex items-center gap-2 px-6 py-3 bg-secondary text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">
                    <span class="material-symbols-outlined text-sm">rocket_launch</span>
                    Activar Órdenes de Prueba
                </button>
            </div>`;
    } else {
        container.innerHTML = techState.orders.map(o => renderOrderCard(o)).join('');
    }

    // Próxima parada
    const next = techState.orders.find(o => o.state === 'pending' && o.result === 'not_set');
    if (next && nextStop) {
        let nextNavHtml = '';
        if (next.lat && next.lng) {
            nextNavHtml = `
            <div class="flex items-center gap-2 mt-2">
                <button onclick="window.navigateGPS(${next.lat}, ${next.lng}, 'google')" class="flex items-center justify-center gap-1.5 flex-1 bg-surface border border-outline-variant/30 text-on-surface font-bold text-xs py-2 rounded-xl active:scale-95 transition-all shadow-sm">
                    <span class="material-symbols-outlined text-sm text-secondary" style="font-variation-settings:'FILL' 1;">explore</span> Maps
                </button>
                <button onclick="window.navigateGPS(${next.lat}, ${next.lng}, 'waze')" class="flex items-center justify-center gap-1.5 flex-1 bg-surface border border-outline-variant/30 text-on-surface font-bold text-xs py-2 rounded-xl active:scale-95 transition-all shadow-sm">
                    <span class="material-symbols-outlined text-sm text-amber-500" style="font-variation-settings:'FILL' 1;">directions_car</span> Waze
                </button>
            </div>`;
        } else if (next.address) {
            nextNavHtml = `
            <div class="flex items-center gap-2 mt-2">
                <button onclick="window.navigateAddress('${encodeURIComponent(next.address)}', 'google')" class="flex items-center justify-center gap-1.5 flex-1 bg-surface border border-outline-variant/30 text-on-surface font-bold text-xs py-2 rounded-xl active:scale-95 transition-all shadow-sm">
                    <span class="material-symbols-outlined text-sm text-secondary" style="font-variation-settings:'FILL' 1;">explore</span> Maps
                </button>
                <button onclick="window.navigateAddress('${encodeURIComponent(next.address)}', 'waze')" class="flex items-center justify-center gap-1.5 flex-1 bg-surface border border-outline-variant/30 text-on-surface font-bold text-xs py-2 rounded-xl active:scale-95 transition-all shadow-sm">
                    <span class="material-symbols-outlined text-sm text-amber-500" style="font-variation-settings:'FILL' 1;">directions_car</span> Waze
                </button>
            </div>`;
        }

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
                ${nextNavHtml}
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
                       <span class="material-symbols-outlined text-sm">done_all</span> Completada y Liquidada
                   </div>`;
    } else if (trackData && trackData.status === 'started') {
        const mins = Math.floor((Date.now() - trackData.startTime) / 60000);
        buttons = `<div class="mt-4 flex gap-3">
                       <div class="flex-1 flex items-center justify-center gap-2 bg-on-tertiary-container/10 text-on-tertiary-container py-3 rounded-xl font-bold text-sm border border-tertiary-fixed-dim/30">
                           <span class="material-symbols-outlined text-[18px] animate-pulse">timer</span>
                           En curso: ${mins} min
                       </div>
                       <button onclick="window.openLiquidationModal('${o.id}')" class="flex-1 flex items-center justify-center gap-2 kinetic-gradient text-white py-3 rounded-xl font-bold text-sm active:scale-95 transition-transform shadow-md">
                           <span class="material-symbols-outlined text-sm">check_circle</span>
                           Finalizar / Liquidar
                       </button>
                   </div>`;
    } else {
        buttons = `<div class="grid grid-cols-2 gap-3 mt-4">
               <button onclick="window.startOrder('${o.id}')" class="flex items-center justify-center gap-2 kinetic-gradient text-white py-3 rounded-xl font-bold text-sm active:scale-95 transition-transform shadow-sm">
                   <span class="material-symbols-outlined text-sm" style="font-variation-settings:'FILL' 1;">play_arrow</span>
                   Iniciar
               </button>
               <button onclick="window.openLiquidationModal('${o.id}')" class="flex items-center justify-center gap-2 border border-outline-variant text-on-surface py-3 rounded-xl font-bold text-sm active:scale-95 transition-transform hover:bg-surface-container-low">
                   <span class="material-symbols-outlined text-sm">check_circle</span>
                   Finalizar
               </button>
           </div>`;
    }

    let navHtml = '';
    if (o.lat && o.lng) {
        navHtml = `
        <div class="flex items-center gap-2 mt-2">
            <button onclick="window.navigateGPS(${o.lat}, ${o.lng}, 'google')" class="flex items-center gap-1 bg-surface border border-outline-variant/30 text-on-surface font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-sm hover:bg-surface-container-low active:scale-95 transition-all">
                <span class="material-symbols-outlined text-xs text-secondary" style="font-variation-settings:'FILL' 1;">explore</span> Maps
            </button>
            <button onclick="window.navigateGPS(${o.lat}, ${o.lng}, 'waze')" class="flex items-center gap-1 bg-surface border border-outline-variant/30 text-on-surface font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-sm hover:bg-surface-container-low active:scale-95 transition-all">
                <span class="material-symbols-outlined text-xs text-amber-500" style="font-variation-settings:'FILL' 1;">directions_car</span> Waze
            </button>
        </div>`;
    } else if (o.address) {
        navHtml = `
        <div class="flex items-center gap-2 mt-2">
            <button onclick="window.navigateAddress('${encodeURIComponent(o.address)}', 'google')" class="flex items-center gap-1 bg-surface border border-outline-variant/30 text-on-surface font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-sm hover:bg-surface-container-low active:scale-95 transition-all">
                <span class="material-symbols-outlined text-xs text-secondary" style="font-variation-settings:'FILL' 1;">explore</span> Maps
            </button>
            <button onclick="window.navigateAddress('${encodeURIComponent(o.address)}', 'waze')" class="flex items-center gap-1 bg-surface border border-outline-variant/30 text-on-surface font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-sm hover:bg-surface-container-low active:scale-95 transition-all">
                <span class="material-symbols-outlined text-xs text-amber-500" style="font-variation-settings:'FILL' 1;">directions_car</span> Waze
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
            <div class="flex-1">
                <p class="text-sm text-on-surface font-medium">${o.address || '—'}</p>
                ${o.zone ? `<span class="text-xs font-bold text-secondary">${o.zone}</span>` : ''}
                ${navHtml}
            </div>
        </div>

        ${o.phone ? `
        <a href="tel:${o.phone}" class="flex items-center gap-1.5 text-secondary font-bold text-sm mt-2 hover:underline active:scale-95 transition-transform inline-flex">
            <span class="material-symbols-outlined text-sm">call</span> ${o.phone}
        </a>` : ''}

        ${napInfo}
        <div class="flex items-center justify-between mt-4">
            <div class="relative inline-block">
                ${o.feedbacksCount > 0 ? `
                    <button onclick="window.openFeedbackModal('${o.id}')" class="flex items-center gap-2 bg-secondary/10 hover:bg-secondary/20 text-secondary font-bold text-xs uppercase tracking-widest px-3 py-2 rounded-xl border border-secondary/20 transition-all active:scale-95 shadow-sm">
                        <span class="material-symbols-outlined text-[18px]">history_edu</span>
                        Bitácora
                    </button>
                    <div class="absolute -top-1.5 -right-1.5 bg-secondary text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border border-surface-container-lowest shadow-sm min-w-[16px] text-center">
                        ${o.feedbacksCount}
                    </div>
                ` : `
                    <button onclick="window.openFeedbackModal('${o.id}')" class="flex items-center gap-2 bg-transparent hover:bg-surface-container-high text-on-surface-variant/30 hover:text-on-surface-variant font-bold text-xs uppercase tracking-widest px-3 py-2 rounded-xl border border-outline-variant/15 transition-all active:scale-95">
                        <span class="material-symbols-outlined text-[18px]">history_edu</span>
                        Bitácora
                    </button>
                `}
            </div>
        </div>
        ${buttons}
    </div>`;
}

// ── STOCK REAL (BODEGA MÓVIL / CAMIONETA) ───────────────────────────────────
function renderStock() {
    const container = document.getElementById('inventory-container');
    if (!container) return;

    if (techState.isLoadingStock) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-16 text-on-surface-variant">
                <span class="material-symbols-outlined text-4xl text-secondary mb-3 animate-spin">sync</span>
                <p class="font-bold text-sm uppercase tracking-widest">Sincronizando Stock de Camioneta...</p>
            </div>`;
        return;
    }

    const wh = techState.vehicleWarehouse;
    const serialized = (wh?.serializedItems || []).filter(i => i.status !== 'INSTALADO_CLIENTE');
    const batches    = wh?.batchItems || [];
    const bulks      = wh?.bulkStocks || [];

    const parentName = wh?.parentWarehouse?.name || 'Hub Central Tocumen';

    let html = `
    <!-- Tarjeta de Nodo Móvil -->
    <div class="bg-surface-container-lowest border border-outline-variant/30 p-5 rounded-[1.5rem] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
            <div class="w-12 h-12 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center border border-secondary/20">
                <span class="material-symbols-outlined text-2xl">local_shipping</span>
            </div>
            <div>
                <div class="flex items-center gap-2">
                    <h3 class="font-extrabold text-base text-on-surface">${wh?.name || 'Móvil - Mi Camioneta'}</h3>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 uppercase">
                        ${wh?.code || 'MOV-01'}
                    </span>
                </div>
                <p class="text-xs text-on-surface-variant mt-0.5">
                    Abastecido por: <strong class="text-on-surface font-semibold">${parentName}</strong>
                </p>
            </div>
        </div>
        <div class="flex items-center gap-2 text-xs font-bold text-on-surface bg-surface-container px-3.5 py-2 rounded-xl">
            <span class="material-symbols-outlined text-sm text-secondary">inventory</span>
            <span>${serialized.length} ONUs en vehículo</span>
        </div>
    </div>

    <!-- SECCIÓN 1: Equipos Seriados (ONUs / Routers en Vehículo) -->
    <div class="bg-surface-container-lowest border border-outline-variant/30 p-6 rounded-[1.5rem] shadow-sm">
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-secondary text-xl">router</span>
                <h3 class="font-extrabold text-base text-on-surface">ONUs Asignadas para Instalación</h3>
            </div>
            <span class="text-xs font-bold bg-secondary/10 text-secondary px-2.5 py-1 rounded-full">
                ${serialized.length} Disponibles
            </span>
        </div>`;

    if (serialized.length === 0) {
        html += `
        <div class="py-8 text-center text-on-surface-variant/70 bg-surface-container-low/50 rounded-2xl border border-dashed border-outline-variant/30 p-4">
            <span class="material-symbols-outlined text-4xl mb-2 opacity-30">inventory_2</span>
            <p class="text-xs font-bold uppercase tracking-wider">Sin equipos en camioneta</p>
            <p class="text-[11px] mt-1">Solicita un traspaso de ONUs a tu supervisor de bodega central.</p>
        </div>`;
    } else {
        html += `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">`;
        serialized.forEach(onu => {
            html += `
            <div class="bg-surface-container-low/60 p-4 rounded-2xl border border-outline-variant/20 flex flex-col justify-between hover:border-secondary/40 transition-colors">
                <div>
                    <div class="flex items-center justify-between mb-1.5">
                        <span class="font-mono text-xs font-black text-secondary tracking-wider">${onu.macAddress}</span>
                        <span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 uppercase">
                            Listo
                        </span>
                    </div>
                    <p class="text-xs font-semibold text-on-surface">${onu.product?.name || onu.brand + ' ' + onu.model}</p>
                    <p class="font-mono text-[10px] text-on-surface-variant mt-1">S/N: ${onu.serialNumber}</p>
                </div>
            </div>`;
        });
        html += `</div>`;
    }

    html += `</div>`;

    // SECCIÓN 2: Bobinas de Fibra Drop
    html += `
    <div class="bg-surface-container-lowest border border-outline-variant/30 p-6 rounded-[1.5rem] shadow-sm">
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-sky-600 text-xl">cable</span>
                <h3 class="font-extrabold text-base text-on-surface">Bobinas de Fibra Drop</h3>
            </div>
            <span class="text-xs font-bold bg-sky-500/10 text-sky-600 px-2.5 py-1 rounded-full">
                ${batches.length} Activas
            </span>
        </div>`;

    if (batches.length === 0) {
        html += `
        <div class="py-6 text-center text-on-surface-variant/70 bg-surface-container-low/50 rounded-2xl border border-dashed border-outline-variant/30 p-4">
            <p class="text-xs font-bold uppercase tracking-wider">No hay bobinas registradas</p>
            <p class="text-[11px] mt-1">Metraje estándar precargado: 1000m por camioneta.</p>
        </div>`;
    } else {
        html += `<div class="space-y-3">`;
        batches.forEach(b => {
            const initial = b.initialQuantity || 1000;
            const current = b.currentQuantity || 0;
            const pct = Math.round((current / initial) * 100);
            const isLow = current < 150;
            const barColor = isLow ? 'bg-error' : current < 300 ? 'bg-amber-500' : 'bg-emerald-500';

            html += `
            <div class="bg-surface-container-low/60 p-4 rounded-2xl border border-outline-variant/20">
                <div class="flex items-center justify-between mb-2">
                    <div>
                        <span class="font-bold text-xs text-on-surface">Bobina #${b.batchNumber}</span>
                        <p class="text-[10px] text-on-surface-variant">${b.product?.name || 'Cable Drop 1 Hilo GJYXFCH'}</p>
                    </div>
                    <div class="text-right">
                        <span class="font-mono font-black text-sm ${isLow ? 'text-error' : 'text-on-surface'}">${current}m</span>
                        <span class="text-[10px] text-on-surface-variant">/ ${initial}m</span>
                    </div>
                </div>
                <div class="w-full bg-surface-container-high h-2.5 rounded-full overflow-hidden">
                    <div class="${barColor} h-full transition-all duration-500" style="width: ${pct}%"></div>
                </div>
            </div>`;
        });
        html += `</div>`;
    }

    html += `</div>`;

    // SECCIÓN 3: Consumibles y Granel
    html += `
    <div class="bg-surface-container-lowest border border-outline-variant/30 p-6 rounded-[1.5rem] shadow-sm">
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-amber-500 text-xl">handyman</span>
                <h3 class="font-extrabold text-base text-on-surface">Consumibles & Conectividad</h3>
            </div>
            <span class="text-xs font-bold bg-amber-500/10 text-amber-600 px-2.5 py-1 rounded-full">
                Materiales de Campo
            </span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">`;

    // Si hay bulks en PostgreSQL los mostramos, de lo contrario usamos el inventario base
    const displayBulks = bulks.length > 0 
        ? bulks.map(b => ({ name: b.product?.name || 'Material', qty: b.quantity, unit: b.product?.unitOfMeasure || 'und' }))
        : (techState.inventory || []).filter(i => i.id !== 'onu').map(i => ({ name: i.name, qty: i.qty, unit: 'und' }));

    displayBulks.forEach(item => {
        const isLow = item.qty <= 3;
        html += `
        <div class="bg-surface-container-low/60 p-3.5 rounded-2xl border border-outline-variant/20 flex flex-col justify-between">
            <span class="text-xs font-semibold text-on-surface line-clamp-1">${item.name}</span>
            <div class="mt-2 flex items-baseline justify-between">
                <span class="font-mono font-black text-base ${isLow ? 'text-error' : 'text-secondary'}">${item.qty}</span>
                <span class="text-[10px] uppercase font-bold text-on-surface-variant">${item.unit}</span>
            </div>
        </div>`;
    });

    html += `
        </div>
    </div>`;

    container.innerHTML = html;
}

// ── MODAL DE LIQUIDACIÓN DE ORDEN (TRANSACCIONAL POSTGRESQL) ───────────────
window.openLiquidationModal = async function(orderId) {
    const order = techState.orders.find(o => String(o.id) === String(orderId)) || 
                  techState.orders.find(o => String(o.rawId) === String(orderId));
    if (!order) return;

    // Asegurar que la bodega móvil esté cargada
    if (!techState.vehicleWarehouse) {
        await loadVehicleWarehouse();
    }

    const wh = techState.vehicleWarehouse;
    const availableOnus = (wh?.serializedItems || []).filter(i => i.status !== 'INSTALADO_CLIENTE');
    const availableBatches = wh?.batchItems || [];

    const modalId = 'order-liquidation-modal';
    document.getElementById(modalId)?.remove();

    const isInstallation = order.kind === 'installation';

    const html = `
    <div id="${modalId}" onclick="if(event.target === this) { this.remove(); }" class="fixed inset-0 z-[100] bg-slate-950/65 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
        <div class="w-full max-w-lg max-h-[90vh] rounded-[2.25rem] shadow-2xl flex flex-col overflow-hidden border animate-in zoom-in-95 duration-200" style="background-color: var(--surface-container-lowest); border-color: var(--outline-variant);">
            
            <!-- Header -->
            <div class="p-6 flex items-center justify-between border-b" style="background-color: var(--surface-container-low); border-color: var(--outline-variant);">
                <div class="flex items-center gap-3">
                    <div class="w-11 h-11 rounded-2xl bg-secondary text-white flex items-center justify-center shadow-md">
                        <span class="material-symbols-outlined text-2xl">checklist_rtl</span>
                    </div>
                    <div>
                        <h3 class="font-black text-lg text-on-surface">Liquidar Orden #${order.id}</h3>
                        <p class="text-xs font-bold text-secondary truncate max-w-[280px]">${order.client}</p>
                    </div>
                </div>
                <button onclick="document.getElementById('${modalId}').remove()" class="w-8 h-8 rounded-full text-on-surface-variant hover:text-error flex items-center justify-center transition-transform hover:scale-105">
                    <span class="material-symbols-outlined text-lg">close</span>
                </button>
            </div>

            <!-- Form Body -->
            <form id="liquidation-form" onsubmit="window.submitLiquidation(event, '${order.id}')" class="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                
                <!-- Dirección / NAP -->
                <div class="bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/30">
                    <p class="text-xs text-on-surface font-semibold">${order.address || 'Panamá'}</p>
                    ${order.nap ? `<span class="text-[10px] font-bold text-secondary mt-1 inline-block">🔌 NAP: ${order.nap}</span>` : ''}
                </div>

                <!-- 1. ONU Instalada -->
                <div class="space-y-1.5">
                    <label class="block font-bold text-on-surface uppercase tracking-wider text-[10px]">
                        Equipo Seriado / ONU Instalada ${isInstallation ? '*' : '(Opcional)'}
                    </label>
                    <select id="liq-onu-select" class="w-full bg-surface border border-outline-variant/40 rounded-xl px-3.5 py-2.5 text-xs text-on-surface font-mono font-medium focus:ring-2 focus:ring-secondary outline-none">
                        <option value="">-- Sin cambio de ONU / Ninguna --</option>
                        ${availableOnus.map(onu => `
                            <option value="${onu.macAddress}" ${isInstallation ? 'selected' : ''}>
                                ${onu.macAddress} &bull; ${onu.brand || ''} ${onu.model || ''} (S/N: ${onu.serialNumber})
                            </option>
                        `).join('')}
                    </select>
                    ${availableOnus.length === 0 ? `
                        <p class="text-[10px] text-amber-600 font-bold">⚠️ No tienes ONUs cargadas en tu camioneta en el sistema.</p>
                    ` : ''}
                </div>

                <!-- 2. Metros de Drop Fibra Consumidos -->
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block font-bold text-on-surface uppercase tracking-wider text-[10px]">
                            Metros de Fibra Drop *
                        </label>
                        <input type="number" id="liq-meters-input" required min="0" max="500" value="${isInstallation ? '120' : '0'}"
                            class="w-full bg-surface border border-outline-variant/40 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-on-surface focus:ring-2 focus:ring-secondary outline-none">
                    </div>
                    <div>
                        <label class="block font-bold text-on-surface uppercase tracking-wider text-[10px]">
                            Bobina de Origen
                        </label>
                        <select id="liq-batch-select" class="w-full bg-surface border border-outline-variant/40 rounded-xl px-3 py-2 text-xs text-on-surface font-medium focus:ring-2 focus:ring-secondary outline-none">
                            ${availableBatches.length > 0 ? availableBatches.map(b => `
                                <option value="${b.batchNumber}">Bobina #${b.batchNumber} (${b.currentQuantity}m disp.)</option>
                            `).join('') : '<option value="BOB-AUTO">Bobina Principal Camioneta</option>'}
                        </select>
                    </div>
                </div>

                <!-- 3. Consumibles usados -->
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block font-bold text-on-surface uppercase tracking-wider text-[10px]">
                            Conectores APC/UPC
                        </label>
                        <input type="number" id="liq-connectors-input" min="0" max="20" value="${isInstallation ? '2' : '0'}"
                            class="w-full bg-surface border border-outline-variant/40 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-on-surface focus:ring-2 focus:ring-secondary outline-none">
                    </div>
                    <div>
                        <label class="block font-bold text-on-surface uppercase tracking-wider text-[10px]">
                            Tensores de Acometida
                        </label>
                        <input type="number" id="liq-tensors-input" min="0" max="20" value="${isInstallation ? '2' : '0'}"
                            class="w-full bg-surface border border-outline-variant/40 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-on-surface focus:ring-2 focus:ring-secondary outline-none">
                    </div>
                </div>

                <!-- 4. Observaciones de Campo -->
                <div>
                    <label class="block font-bold text-on-surface uppercase tracking-wider text-[10px] mb-1">
                        Observaciones / Bitácora de Cierre
                    </label>
                    <textarea id="liq-notes-input" rows="2" placeholder="Ej. Instalación OK, potencia -19.4 dBm en NAP. Cliente satisfecho."
                        class="w-full bg-surface border border-outline-variant/40 rounded-xl px-3.5 py-2 text-xs text-on-surface focus:ring-2 focus:ring-secondary outline-none"></textarea>
                </div>

                <!-- Botones de Acción -->
                <div class="pt-4 border-t border-outline-variant/30 flex items-center justify-end gap-3">
                    <button type="button" onclick="document.getElementById('${modalId}').remove()" class="px-4 py-2.5 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container">
                        Cancelar
                    </button>
                    <button type="submit" id="liq-submit-btn" class="px-6 py-2.5 rounded-xl kinetic-gradient text-white font-black uppercase tracking-wider text-xs shadow-md active:scale-95 transition-all flex items-center gap-2">
                        <span class="material-symbols-outlined text-base">check_circle</span>
                        Confirmar y Liquidar
                    </button>
                </div>
            </form>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
};

window.submitLiquidation = async function(e, orderId) {
    e.preventDefault();
    const order = techState.orders.find(o => String(o.id) === String(orderId)) || 
                  techState.orders.find(o => String(o.rawId) === String(orderId));
    if (!order) return;

    const submitBtn = document.getElementById('liq-submit-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="material-symbols-outlined text-base animate-spin">sync</span> Liquidando...`;
    }

    try {
        const onuMac = document.getElementById('liq-onu-select')?.value.trim();
        const meters = parseFloat(document.getElementById('liq-meters-input')?.value || '0');
        const batchNumber = document.getElementById('liq-batch-select')?.value;
        const connectors = parseInt(document.getElementById('liq-connectors-input')?.value || '0', 10);
        const tensors = parseInt(document.getElementById('liq-tensors-input')?.value || '0', 10);
        const notes = document.getElementById('liq-notes-input')?.value.trim();

        const whId = techState.vehicleWarehouse?.id;

        // Si tenemos bodega móvil registrada, enviamos liquidación al backend
        if (whId) {
            await tFetch('/inventory-api/liquidations/consume', {
                method: 'POST',
                data: {
                    vehicleWarehouseId: whId,
                    technicianId: techState.profile?.id,
                    ticketNumber: `#${order.id}`,
                    ticketType: order.kind === 'installation' ? 'INSTALACION_NUEVA' : 'MANTENIMIENTO_CAMBIO_EQUIPO',
                    wisproClientId: order.orderable_id || order.id,
                    clientName: order.client,
                    clientAddress: order.address,
                    wisproNode: order.nap,
                    installedOnuMac: onuMac || undefined,
                    batchedUsage: meters > 0 ? { batchNumber, metersUsed: meters } : undefined,
                    connectorsUsed: connectors,
                    tensorsUsed: tensors,
                    notes: notes
                }
            });
        }

        // Marcar como completada localmente
        order.result = 'success';
        order.state  = 'finalized';

        // Limpiar tracking
        try {
            const tracking = JSON.parse(localStorage.getItem('Velocity_Order_Tracking') || '{}');
            delete tracking[order.id];
            delete tracking[order.rawId];
            localStorage.setItem('Velocity_Order_Tracking', JSON.stringify(tracking));
        } catch(e) {}

        // Cerrar modal
        document.getElementById('order-liquidation-modal')?.remove();

        renderProgress();
        renderAgenda();

        // Actualizar bodega móvil en segundo plano
        loadVehicleWarehouse().then(() => {
            if (techState.view === 'stock') renderStock();
        });

        // WhatsApp de confirmación
        const text = `✅ *ORDEN FINALIZADA Y LIQUIDADA*\n\n` +
            `📋 Orden: #${order.id}\n` +
            `📌 Tipo: ${order.typeLabel}\n` +
            `👤 Cliente: ${order.client}\n` +
            `📍 Dirección: ${order.address || order.zone || '—'}\n` +
            `${order.nap ? `🔌 NAP: ${order.nap}\n` : ''}` +
            `${onuMac ? `📦 ONU MAC: ${onuMac}\n` : ''}` +
            `${meters > 0 ? `📏 Fibra Drop: ${meters}m\n` : ''}` +
            `⏰ Finalizado: ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}\n\n` +
            `— ${techState.profile?.name}`;

        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');

    } catch (err) {
        alert(`⚠️ Error al liquidar materiales: ${err.message}\nVerifica tus existencias en camioneta.`);
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span class="material-symbols-outlined text-base">check_circle</span> Confirmar y Liquidar`;
        }
    }
};

// ── ACCIONES ──────────────────────────────────────────────────────────────
window.switchTab = function(view) {
    techState.view = view;

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
    const order = techState.orders.find(o => String(o.id) === String(orderId)) ||
                  techState.orders.find(o => String(o.rawId) === String(orderId));
    if (!order) return;

    try {
        const tracking = JSON.parse(localStorage.getItem('Velocity_Order_Tracking') || '{}');
        tracking[order.id] = { status: 'started', startTime: Date.now(), empId: SESSION_ID };
        localStorage.setItem('Velocity_Order_Tracking', JSON.stringify(tracking));
        renderAgenda();
        if (typeof window.triggerHeartbeat === 'function') {
            window.triggerHeartbeat();
        }
    } catch(e) { console.error('Error al iniciar orden:', e); }

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

// ── PERFIL ────────────────────────────────────────────────────────────────
function renderPerfil() {
    const nameTag   = document.getElementById('profile-name-tag');
    const nameInput = document.getElementById('profile-name-input');
    if (nameTag)   nameTag.textContent   = techState.profile?.name || 'Técnico';
    if (nameInput) nameInput.value       = techState.profile?.name || '';
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
        sessionStorage.setItem('Velocity_User_Name', newName);
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

// ── BITÁCORA (SINCRONIZADA CON WISPRO) ────────────────────────────────────
window.openFeedbackModal = async function(id) {
    const order = techState.orders.find(o => String(o.id) === String(id)) || 
                  techState.orders.find(o => String(o.rawId) === String(id));
    if (!order) return;

    const modalId = 'tech-feedback-modal';
    document.getElementById(modalId)?.remove();

    const html = `
    <div id="${modalId}" onclick="if(event.target === this) { this.remove(); }" class="fixed inset-0 z-[100] bg-slate-950/65 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
        <div class="w-full max-w-xl max-h-[85vh] rounded-[2.25rem] shadow-2xl flex flex-col overflow-hidden border animate-in zoom-in-95 duration-300" style="background-color: var(--surface-container-lowest); border-color: var(--outline-variant);">
            <!-- Header -->
            <div class="p-6 flex items-center justify-between border-b backdrop-blur-md" style="background-color: var(--surface-container-low); border-color: var(--outline-variant);">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-white relative overflow-hidden flex-shrink-0" style="background: linear-gradient(135deg, ${order.typeColor} 0%, ${order.typeColor}dd 100%); box-shadow: 0 8px 24px -4px ${order.typeColor}50">
                        <span class="material-symbols-outlined text-2xl relative z-10">forum</span>
                    </div>
                    <div class="min-w-0">
                        <h3 id="tech-feedback-modal-title" class="font-extrabold text-lg tracking-tight font-headline animate-pulse" style="color: var(--on-surface);">Bitácora #${order.id}</h3>
                        <p class="text-[10px] font-black uppercase tracking-widest mt-1.5 truncate max-w-[340px] flex items-center gap-1.5" title="${order.client}" style="color: var(--secondary);">
                            <span class="w-1.5 h-1.5 rounded-full bg-secondary/80 animate-pulse" style="background-color: var(--secondary);"></span>
                            ${order.client}
                        </p>
                    </div>
                </div>
                <button onclick="document.getElementById('${modalId}').remove()" class="w-9 h-9 rounded-full text-on-surface-variant hover:text-error flex items-center justify-center transition-all border shadow-sm" style="background-color: var(--surface-container-high); border-color: var(--outline-variant);">
                    <span class="material-symbols-outlined text-lg">close</span>
                </button>
            </div>

            <!-- Body (Timeline) -->
            <div id="feedback-timeline" class="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar scroll-smooth">
                <div class="flex flex-col items-center justify-center py-24 text-center" style="color: var(--on-surface-variant); opacity: 0.3;">
                    <span class="material-symbols-outlined text-4xl animate-spin mb-2">sync</span>
                    <p class="font-black text-xs tracking-widest uppercase italic">Sincronizando Bitácora...</p>
                </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 border-t flex items-center justify-between" style="background-color: var(--surface-container-low); border-color: var(--outline-variant);">
                <span class="text-[9px] font-black uppercase tracking-wider" style="color: var(--on-surface-variant); opacity: 0.5;">Historial Integrado Wispro • Sólo Lectura</span>
                <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span class="text-[9px] font-extrabold uppercase tracking-widest" style="color: var(--on-surface-variant); opacity: 0.7;">Live Link</span>
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
        const endpoints = [`/order/orders/${target.rawId}/feedbacks`];
        if (target.kind === 'installation' && target.orderable_id) {
            endpoints.push(`/installation_orders/${target.orderable_id}/feedbacks`);
        }
        if (target.ticketable_id) {
            endpoints.push(`/help_desk/issues/${target.ticketable_id}/feedbacks`);
        }

        const results = await Promise.allSettled(endpoints.map(ep => tFetch(ep)));
        let allFeedbacks = [];
        const seenIds = new Set();

        results.forEach(res => {
            if (res.status === 'fulfilled' && res.value) {
                const data = res.value.data || res.value;
                if (Array.isArray(data)) {
                    data.forEach(f => {
                        if (!seenIds.has(f.id)) {
                            allFeedbacks.push(f);
                            seenIds.add(f.id);
                        }
                    });
                }
            }
        });

        if (allFeedbacks.length === 0) {
            const titleEl = document.getElementById('tech-feedback-modal-title');
            if (titleEl) titleEl.textContent = `Bitácora #${target.id} (0)`;
            timeline.innerHTML = `
                <div class="flex flex-col items-center justify-center py-16 italic text-center" style="color: var(--on-surface-variant); opacity: 0.4;">
                    <span class="material-symbols-outlined text-4xl mb-2">auto_stories</span>
                    <p class="text-[10px] font-bold tracking-widest uppercase">Sin historial de eventos</p>
                </div>`;
            return;
        }

        const titleEl = document.getElementById('tech-feedback-modal-title');
        if (titleEl) titleEl.textContent = `Bitácora #${target.id} (${allFeedbacks.length})`;

        allFeedbacks.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));

        timeline.innerHTML = allFeedbacks.map((f, idx) => {
            const date = new Date(f.created_at).toLocaleString('es-PA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            const sender = (techState.techs && techState.techs[f.creatable_id]) || f.author_name || f.technician_name || f.creator_name || 'Sistema';
            const isMe = sender.toLowerCase().includes(techState.profile?.name?.split(' ')[0].toLowerCase());
            const isSistema = sender.toLowerCase() === 'sistema';
            const roleLabel = isSistema ? 'Sistema' : isMe ? 'Yo' : 'Técnico';

            return `
            <div class="relative pl-12 pb-6 last:pb-0">
                <div class="absolute left-0 top-0.5 w-9 h-9 rounded-full flex items-center justify-center text-white font-extrabold text-[11px] shadow-sm bg-secondary">
                    ${sender.slice(0, 2).toUpperCase()}
                </div>
                <div class="flex-1 min-w-0 rounded-2xl p-4 border" style="background-color: var(--surface-container-low); border-color: var(--outline-variant);">
                    <div class="flex items-center justify-between gap-2 mb-2">
                        <div class="flex items-center gap-2 min-w-0">
                            <span class="text-xs font-bold truncate" style="color: var(--on-surface);">${sender}</span>
                            <span class="text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase bg-secondary/10 text-secondary">
                                ${roleLabel}
                            </span>
                        </div>
                        <span class="text-[10px] opacity-60">${date}</span>
                    </div>
                    <p class="text-[13px] leading-relaxed select-text" style="color: var(--on-surface-variant);">${f.body || f.comment || '—'}</p>
                </div>
            </div>`;
        }).join('');

        timeline.scrollTop = timeline.scrollHeight;
    } catch(e) {
        timeline.innerHTML = `<p class="text-center text-error font-black text-[9px] uppercase p-10 opacity-50">Error de conexión</p>`;
    }
};

function showToastNotification(title, msg) {
    alert(`${title}\n${msg}`);
}

window.loadDemoOrders = function() {
    techState.orders = [
        {
            id: 'DEMO-101',
            rawId: 'demo-ins-01',
            kind: 'installation',
            typeLabel: 'Instalación',
            typeColor: '#0059bb',
            typeIcon: 'wifi',
            state: 'pending',
            result: 'not_set',
            client: 'FAMILIA RODRIGUEZ (DEMO)',
            address: 'Calle 50, Edificio F&F, Piso 20',
            zone: 'CIUDAD DE PANAMÁ',
            phone: '6600-0000',
            nap: 'NAP-S5-P12',
            startTime: '09:00 AM',
            endTime: '11:00 AM',
            description: 'Instalación de fibra óptica.',
            feedbacksCount: 2
        }
    ];
    renderApp();
};

window.navigateGPS = function(lat, lng, platform) {
    let url = '';
    if (platform === 'google') {
        url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    } else if (platform === 'waze') {
        url = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
    }
    if (url) window.open(url, '_blank');
};

window.navigateAddress = function(address, platform) {
    const query = address + ', Panama';
    let url = '';
    if (platform === 'google') {
        url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    } else if (platform === 'waze') {
        url = `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`;
    }
    if (url) window.open(url, '_blank');
};

// ── INIT ──────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
    updateGreeting();
    const container = document.getElementById('tickets-container');
    if (container) container.innerHTML = `
        <div class="flex flex-col items-center py-16 text-on-surface-variant">
            <span class="material-symbols-outlined text-4xl text-secondary mb-2 animate-spin">sync</span>
            <p class="font-bold text-sm uppercase tracking-widest">Cargando tus órdenes...</p>
        </div>`;

    await loadTechData();
    startHeartbeat();
    renderApp();

    // Auto-recarga periódica cada 60s
    setInterval(async () => {
        if (techState.profile && document.visibilityState === 'visible') {
            try {
                await loadMyOrders();
                renderApp();
            } catch (e) {}
        }
    }, 60000);
});
