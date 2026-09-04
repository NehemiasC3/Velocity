// Velocity API Module
async function apiFetch(path, opts = {}, silent = false) {
    const token = typeof window.getSessionToken === 'function' ? window.getSessionToken() : (sessionStorage.getItem('Velocity_Token') || localStorage.getItem('Velocity_Token') || '');
    const currentPath = window.location.pathname.toLowerCase();
    const isLoginPage = currentPath.includes('login') || currentPath === '/' || currentPath === '';

    if (!token && !path.includes('/api/login')) {
        if (!isLoginPage) {
            window.location.href = '/login';
        }
        return null;
    }

    const isLocalApi = !path.includes(CFG.proxy) && (path.startsWith('/api/') || path.startsWith('api/'));
    
    if (['POST', 'PUT', 'PATCH'].includes(opts.method) && !opts.body && opts.data) {
        opts.body = JSON.stringify(opts.data);
    }
    
    const executeFetch = async (retries = 2) => {
        try {
            const cleanPath = path.startsWith('/') ? path.slice(1) : path;
            const url = path.startsWith('http') ? path : (isLocalApi ? path : CFG.proxy + cleanPath);
            
            const res = await fetch(url, {
                ...opts,
                headers: {
                    'Authorization': token,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    ...(opts.headers || {})
                },
                body: opts.body
            }).catch(err => {
                const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(opts.method || 'GET');
                if (isWrite) {
                    addToOfflineQueue(path, opts);
                    return { ok: true, json: () => Promise.resolve({ offline: true, success: true }) };
                }
                throw err;
            });

            // 1. Manejo inmediato de 401 (No reintentar)
            if (res.status === 401) {
                console.warn('[Velocity Auth] Sesión inválida o expirada (HTTP 401). Limpiando sesión...');
                sessionStorage.removeItem('Velocity_Token');
                sessionStorage.removeItem('Velocity_Role');
                sessionStorage.removeItem('Velocity_Active_User');
                sessionStorage.removeItem('Velocity_User_Name');
                localStorage.removeItem('Velocity_Token');
                localStorage.removeItem('Velocity_Role');

                if (!isLoginPage) {
                    window.location.href = '/login';
                }
                throw new Error('Sesión inválida o expirada.');
            }

            if (res.ok) return await res.json();
            if (silent && res.status === 404) return null;

            // Transient error retries (429 rate limit or 5xx server issues)
            if (retries > 0 && [429, 500, 502, 503, 504].includes(res.status)) {
                const delay = res.status === 429 ? 2000 : 1000;
                console.warn(`[Velocity] Error transitorio HTTP ${res.status} al llamar a ${path}. Reintentando en ${delay}ms... (Intentos restantes: ${retries})`);
                await new Promise(r => setTimeout(r, delay));
                return executeFetch(retries - 1);
            }

            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${res.status}`);
        } catch (e) {
            // Network error retries (except auth errors)
            if (e.message && e.message.includes('Sesión inválida')) {
                throw e;
            }
            if (retries > 0 && (e.name === 'TypeError' || e.message.includes('fetch') || e.message.includes('NetworkError'))) {
                console.warn(`[Velocity] Error de red al llamar a ${path}. Reintentando en 1000ms... (Intentos restantes: ${retries})`);
                await new Promise(r => setTimeout(r, 1000));
                return executeFetch(retries - 1);
            }
            if (!silent) console.warn('[Velocity] Fetch Error:', e.message, path);
            throw e;
        }
    };

    return executeFetch();
}

async function serverSync() {
    try {
        if (!navigator.onLine) {
            updateSystemStatus(false);
            return;
        }
        updateSystemStatus(true);
        const remoteState = await apiFetch('/api/sync', { method: 'GET' }, true);
        if (remoteState) {
            localStorage.setItem('Velocity_Sync_State', JSON.stringify(remoteState));
            console.log('[Velocity] Estado sincronizado desde el servidor');
            if (typeof window.updateActiveTechs === 'function') {
                window.updateActiveTechs();
            }
        }
    } catch (e) {
        console.warn('[Velocity] Error de sincronización:', e.message);
        updateSystemStatus(false);
    }
}

async function serverPush(newState) {
    try {
        await apiFetch('/api/sync', {
            method: 'POST',
            body: JSON.stringify(newState)
        });
    } catch (e) { console.error('[Velocity] Falló el guardado en servidor', e); }
}

// ── COLA OFFLINE Y SINCRONIZACIÓN DE RED ────────────────────────────────
const OFFLINE_QUEUE_KEY = 'Velocity_Offline_Queue';

function getOfflineQueue() {
    try {
        return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    } catch(e) {
        return [];
    }
}

function saveOfflineQueue(queue) {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

function addToOfflineQueue(path, opts) {
    const queue = getOfflineQueue();
    if (path.includes('/api/sync')) {
        const idx = queue.findIndex(q => q.path.includes('/api/sync'));
        if (idx !== -1) {
            queue[idx] = { id: queue[idx].id, path, opts, ts: Date.now() };
            saveOfflineQueue(queue);
            return;
        }
    }
    
    queue.push({ id: Math.random().toString(36).slice(2, 9), path, opts, ts: Date.now() });
    saveOfflineQueue(queue);
    
    if (typeof showNotification === 'function') {
        showNotification('Modo Offline', 'Acción guardada localmente en la cola de sincronización.', 'issue');
    }
}

async function syncOfflineQueue() {
    if (!navigator.onLine) return;
    const queue = getOfflineQueue();
    if (queue.length === 0) return;
    
    console.log(`[Velocity PWA] Intentando sincronizar ${queue.length} acciones offline...`);
    const remaining = [];
    let successCount = 0;
    
    for (const item of queue) {
        try {
            const cleanPath = item.path.startsWith('/') ? item.path.slice(1) : item.path;
            const isLocalApi = !item.path.includes(CFG.proxy) && (item.path.startsWith('/api/') || item.path.startsWith('api/'));
            const url = item.path.startsWith('http') ? item.path : (isLocalApi ? item.path : CFG.proxy + cleanPath);
            
            const res = await fetch(url, {
                ...item.opts,
                headers: {
                    'Authorization': SESSION_TOKEN,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    ...(item.opts.headers || {})
                },
                body: item.opts.body
            });
            
            if (res.ok) {
                successCount++;
            } else {
                remaining.push(item);
            }
        } catch (e) {
            remaining.push(item);
        }
    }
    
    saveOfflineQueue(remaining);
    
    if (successCount > 0) {
        if (typeof showNotification === 'function') {
            showNotification('Sincronización Exitosa', `Se han sincronizado ${successCount} cambios pendientes.`, 'success');
        }
        if (typeof window.syncNow === 'function') {
            window.syncNow();
        }
    }
}

window.addEventListener('online', () => {
    updateSystemStatus(true);
    syncOfflineQueue();
});

window.addEventListener('offline', () => {
    updateSystemStatus(false);
    if (typeof showNotification === 'function') {
        showNotification('Sin Conexión', 'Se ha perdido la conexión de red. Trabajando en modo offline.', 'issue');
    }
});

setTimeout(syncOfflineQueue, 1500);




async function apiPages(endpoint, maxPages = 10) {
    try {
        const firstPage = await apiFetch(`/${endpoint}?per_page=1000&page=1`);
        if (!firstPage) return [];

        let all = Array.isArray(firstPage.data) ? firstPage.data : [];
        const totalPages = Math.min(firstPage.meta?.pagination?.total_pages || 1, maxPages);

        if (totalPages > 1) {
            const promises = [];
            for (let p = 2; p <= totalPages; p++) {
                promises.push(apiFetch(`/${endpoint}?per_page=1000&page=${p}`).catch(() => ({ data: [] })));
            }
            const results = await Promise.all(promises);
            results.forEach(res => {
                const items = Array.isArray(res.data) ? res.data : [];
                all = all.concat(items);
            });
        }
        return all;
    } catch (e) {
        console.warn(`[Velocity] Error en apiPages para ${endpoint}:`, e.message);
        return [];
    }
}



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
    ['static','orders','issues','clients_dynamic'].forEach(k => localStorage.removeItem('V_' + k));
}



function loadDynamicClients() {
    const cached = cacheGet('clients_dynamic');
    if (cached) {
        for (const [id, clientData] of Object.entries(cached)) {
            if (state.clients[id]) {
                state.clients[id] = {
                    ...state.clients[id],
                    ...clientData
                };
            } else {
                state.clients[id] = clientData;
            }
        }
    }
}



function saveDynamicClients() {
    // Solo guardamos los que NO están en el caché estático para no duplicar
    cacheSet('clients_dynamic', state.clients, 1000 * 60 * 60 * 24); // 24 horas
}



// Directorio Oficial Maestro de Empleados de Wispro (Correos reales, teléfonos y estados)
const WISPRO_EMPLOYEE_DIRECTORY = [
    { publicId: 1, name: "Orlando Creus", email: "ocreus@atg-rappido.com", status: "Activo", phone: "+50763198199" },
    { publicId: 3, name: "Astrid Mariscal", email: "amariscal@atg-rappido.com", status: "Activo", phone: "+5076120-9824" },
    { publicId: 4, name: "Anayaris Vásquez", email: "avasquez@atg-rappido.com", status: "Activo", phone: "+5076319-8697" },
    { publicId: 5, name: "Roberto Remis", email: "rremis@atg-rappido.com", status: "Activo", phone: "+5076201-4119" },
    { publicId: 8, name: "Daniel Opua", email: "t.solutiond.o@gmail.com", status: "Activo", phone: "+5076856-1285" },
    { publicId: 9, name: "Jonathan Castillo", email: "jcastillo@atg-rappido.com", status: "Inactivo", phone: "+5076037-6159" },
    { publicId: 10, name: "EDGAR ABDIEL", email: "eramirez@atg-rappido.com", status: "Inactivo", phone: "6866-6131" },
    { publicId: 14, name: "Mingthoys Ramos Dominguez", email: "mramos@atg-rappido.com", status: "Inactivo", phone: "+50768553365" },
    { publicId: 17, name: "Mario Gonzalez", email: "galexandra.aig@gmail.com", status: "Activo", phone: "" },
    { publicId: 18, name: "Ricardo Barria", email: "rbarria@atg-rappido.com", status: "Inactivo", phone: "" },
    { publicId: 19, name: "Tablet Proyecto 1", email: "proyectos@atg-rappido.com", status: "Activo", phone: "" },
    { publicId: 20, name: "AREMAR", email: "pagosdirecto.01@gmail.com", status: "Activo", phone: "" },
    { publicId: 21, name: "Virtual Phone", email: "stevennetflix2020@gmail.com", status: "Inactivo", phone: "65050890" },
    { publicId: 22, name: "Maydelin Mixelis Barria Ojo", email: "mbarria@atg-rappido.com", status: "Activo", phone: "6319-8697" },
    { publicId: 26, name: "Boniblac", email: "boniblanc02@gmail.com", status: "Activo", phone: "" },
    { publicId: 27, name: "Jose Mendoza", email: "jpfibersolutions@gmail.com", status: "Activo", phone: "" },
    { publicId: 28, name: "Cobros Agua Fria", email: "panamavirtual.phone@gmail.com", status: "Inactivo", phone: "" },
    { publicId: 29, name: "Luis David", email: "ldavid@atg-rappido.com", status: "Activo", phone: "" },
    { publicId: 32, name: "Nehemias Canto", email: "nehemias@atg-rappido.com", status: "Activo", phone: "+50768982262" },
    { publicId: 34, name: "Yeisca Espada", email: "yeiscaespada@gmail.com", status: "Activo", phone: "" },
    { publicId: null, name: "Katheine Williams", email: "professionalservicesw@gmail.com", status: "Activo", phone: "" },
    { publicId: 36, name: "Gerardo Mejivar", email: "gerardo.menjivar@gmail.com", status: "Activo", phone: "" },
    { publicId: 37, name: "Yakelin Espinoza", email: "yespinoza@atg-rappido.com", status: "Activo", phone: "" },
    { publicId: 38, name: "Alicia Marin", email: "amarin@atg-rappido.com", status: "Inactivo", phone: "" },
    { publicId: 39, name: "Manuel Perez", email: "mperez@atg-rappido.com", status: "Inactivo", phone: "" },
    { publicId: 40, name: "Nayelis Mariscal", email: "nemariscal@atg-rappido.com", status: "Activo", phone: "" },
    { publicId: 41, name: "Derian Morales", email: "dmorales@atg-rappido.com", status: "Inactivo", phone: "" },
    { publicId: 42, name: "Juan Carlos Atencio", email: "juancatencio@gmail.com", status: "Inactivo", phone: "" },
    { publicId: 43, name: "Capacitaciones ATG", email: "capacitaciones@atg-rappido.com", status: "Activo", phone: "" },
    { publicId: 44, name: "Abraham Quintero", email: "aquintero@atg-rappido.com", status: "Inactivo", phone: "68181891" },
    { publicId: 45, name: "Yarisbel Reina", email: "yreina@atg-rappido.com", status: "Activo", phone: "65684979" },
    { publicId: 46, name: "Mariolys Remis", email: "mremis@atg-rappido.com", status: "Activo", phone: "" },
    { publicId: 47, name: "Caira Rubio", email: "crubio@atg-rappido.com", status: "Inactivo", phone: "6397-9245" },
    { publicId: 48, name: "Edwar Vasquez", email: "evasquez@atg-rappido.com", status: "Activo", phone: "" },
    { publicId: 49, name: "Nelson Eduar Sagel", email: "nsagel@atg-rappido.com", status: "Activo", phone: "" },
    { publicId: 50, name: "colombiatel", email: "infraestructuracolombiatel@gmail.com", status: "Activo", phone: "+57 350 8108102" },
    { publicId: 51, name: "Vanessa Canate", email: "vaneindira27@gmail.com", status: "Activo", phone: "" },
    { publicId: 52, name: "Regie Spencer", email: "rspencer@atg-rappido.com", status: "Inactivo", phone: "" },
    { publicId: 53, name: "Aaliyah Espada", email: "aespada@atg-rappido.com", status: "Activo", phone: "" }
];

window.WISPRO_EMPLOYEE_DIRECTORY = WISPRO_EMPLOYEE_DIRECTORY;

window.getWisproDirectoryEntry = function(name = '', wisproId = '') {
    if (!name && !wisproId) return null;
    const clean = (s) => String(s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const cleanTarget = clean(name);

    // 1. Coincidencia exacta de nombre limpio
    let match = WISPRO_EMPLOYEE_DIRECTORY.find(e => clean(e.name) === cleanTarget);
    if (match) return match;

    // 2. Coincidencia por sub-cadena de nombre
    match = WISPRO_EMPLOYEE_DIRECTORY.find(e => {
        const cName = clean(e.name);
        return (cName.length > 3 && cleanTarget.includes(cName)) || (cleanTarget.length > 3 && cName.includes(cleanTarget));
    });
    if (match) return match;

    // 3. Coincidencia por publicId si viene en name o wisproId
    const num = parseInt(name.replace(/\D/g, ''), 10);
    if (!isNaN(num)) {
        match = WISPRO_EMPLOYEE_DIRECTORY.find(e => e.publicId === num);
        if (match) return match;
    }

    return null;
};

async function loadStaticData(force = false) {
    const cached = !force && cacheGet('static');
    if (cached) {
        Object.assign(state.clients, cached.clients || {});
        Object.assign(state.techs, cached.techs || {});
        Object.assign(state.techEmails || {}, cached.techEmails || {});
        Object.assign(state.techPhones || {}, cached.techPhones || {});
        Object.assign(state.categories, cached.categories || {});
        loadDynamicClients();
        return;
    }

    try {
        const [rawClients, rawTechs, rawCats] = await Promise.all([
            apiPages('clients').catch(() => []),
            apiFetch('/employees?per_page=1000').catch(() => ({ data: [] })),
            apiFetch('/help_desk/categories?per_page=200').catch(() => ({ data: [] }))
        ]);

        rawClients.forEach(c => {
            const existing = state.clients[c.id] || {};
            state.clients[c.id] = {
                ...existing,
                name:    c.name || existing.name || '',
                zone:    c.zone_name || existing.zone || '',
                address: c.address || c.street || existing.address || '',
                phone:   c.phone_mobile || c.phone || existing.phone || '',
                lat:     c.latitude || c.gps_point?.latitude || existing.lat || null,
                lng:     c.longitude || c.gps_point?.longitude || existing.lng || null
            };
        });

        (Array.isArray(rawTechs.data) ? rawTechs.data : []).forEach(t => {
            state.techs[t.id] = t.name;
            if (!state.techEmails) state.techEmails = {};
            if (!state.techPhones) state.techPhones = {};

            const dirEntry = window.getWisproDirectoryEntry(t.name, t.id);
            state.techEmails[t.id] = t.email || (dirEntry ? dirEntry.email : '') || '';
            state.techPhones[t.id] = t.phone_mobile || t.phone || (dirEntry ? dirEntry.phone : '') || '';
        });

        (Array.isArray(rawCats.data) ? rawCats.data : []).forEach(c => {
            state.categories[c.id] = c.name;
        });

        cacheSet('static', {
            clients:    state.clients,
            techs:      state.techs,
            techEmails: state.techEmails,
            techPhones: state.techPhones,
            categories: state.categories
        }, CFG.cacheTTL.static);
        loadDynamicClients();
    } catch (e) {
        console.warn('[Velocity] Error cargando datos estáticos, intentando fallback de caché:', e.message);
        try {
            const raw = localStorage.getItem('V_static');
            if (raw) {
                const expired = JSON.parse(raw).data;
                if (expired) {
                    Object.assign(state.clients, expired.clients || {});
                    Object.assign(state.techs, expired.techs || {});
                    Object.assign(state.categories, expired.categories || {});
                    if (typeof showNotification === 'function') {
                        showNotification('Modo Conexión Inestable', 'No se pudieron actualizar los datos base. Usando copia local.', 'issue');
                    }
                }
            }
        } catch(err) { console.error('Fallo en fallback de cache static', err); }
        loadDynamicClients();
    }
}




async function loadTodayOrders(force = false) {
    try {
        const cached = !force && cacheGet('orders');
        if (cached && cached.orders) {
            state.orders         = cached.orders;
            state.finishedOrders = cached.finishedOrders || [];
            state.napOverrides   = cached.napOverrides || {};
            if (window.updateMesaBadge) window.updateMesaBadge();
            return;
        }

        const todayStr = new Date().toLocaleDateString('en-CA');
        
        const d = await apiFetch('/order/orders?per_page=1000&q%5Bs%5D=start_at+desc');
        const items = d.data || [];

        const todayOrders = items.filter(o => {
            const st    = (o.state || '').toLowerCase();
            const isActive = ['pending', 'started', 'in_progress', 'to_reschedule', 'abierta', 'open'].includes(st);
            return isActive;
        });

        const finishedOrdersRaw = items.filter(o => {
            const st = (o.state || '').toLowerCase();
            const isFinished = ['finalizada', 'finalizado', 'finalized', 'closed'].includes(st);
            if (isFinished && !!o.employee_id) {
                const endAtLocalStr = (o.end_at || o.updated_at) ? new Date(o.end_at || o.updated_at).toLocaleDateString('en-CA') : '';
                return endAtLocalStr === todayStr;
            }
            return false;
        });

        const toResolve = {};
        [...todayOrders, ...finishedOrdersRaw].forEach(o => {
            if (o.orderable_id && (force || !state.clients[o.orderable_id] || !state.clients[o.orderable_id].name)) {
                toResolve[o.orderable_id] = o.kind;
            }
        });

        // Ejecutar resolución unificada
        await resolveUnified(toResolve, force);

        // Función mapeadora local
        const mapOrder = (o) => {
            const resolved  = state.clients[o.orderable_id] || {};
            const techName  = state.techs[o.employee_id] || 'Sin asignar';
            const typeCfg   = TYPE_CFG[o.kind] || { color: '#6b7280', label: o.kind || '?', icon: 'task' };
            const nameFromDesc = o.description?.match(/\(([^)]+)\)/)?.[1] || '';
            const startDate = o.start_at ? new Date(o.start_at) : null;
            
            const endDate   = o.end_at ? new Date(o.end_at) : (o.state === 'finalized' && o.updated_at ? new Date(o.updated_at) : null);
            
            const rawId = o.id;
            const mappedId = o.sequential_id || o.id?.slice(0, 8);
            const cachedFeedbacks = state.feedbacksCache ? (state.feedbacksCache[rawId] || state.feedbacksCache[mappedId]) : null;
            
            return {
                ...o,
                id:           mappedId,
                rawId:        rawId,
                typeLabel:    typeCfg.label,
                typeColor:    typeCfg.color,
                typeIcon:     typeCfg.icon,
                client:       resolved.name || nameFromDesc || `#${o.sequential_id || o.id} ${o.orderable_id ? '' : '(Sin Asignar)'}`,
                address:      resolved.address || '',
                zone:         resolved.zone || '',
                phone:        resolved.phone || '',
                nap:          resolved.nap || o.nap || null,
                techName:     techName,
                startTime:    startDate ? startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
                endTime:      endDate ? endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
                feedbacksCount: o.feedbacks_count || 0,
                feedbacks:    cachedFeedbacks || o.feedbacks || [],
                feedbacksLoaded: !!cachedFeedbacks || o.feedbacksLoaded || false
            };
        };

        // Filtrar instalaciones vencidas
        const todayStart = new Date();
        todayStart.setHours(0,0,0,0);

        state.orders = todayOrders
            .map(mapOrder)
            .filter(o => {
                if (o.kind === 'installation' && o.start_at) {
                    const sched = new Date(o.start_at);
                    sched.setHours(0,0,0,0);
                    if (sched.getTime() < todayStart.getTime()) {
                        return false; // Excluir instalación vencida
                    }
                }
                return true;
            })
            .sort((a, b) => (a.start_at || '').localeCompare(b.start_at || ''));
        state.finishedOrders = finishedOrdersRaw.map(mapOrder);

        // Notificaciones
        if (state.knownOrderIds.size > 0) {
            state.finishedOrders.forEach(o => {
                if (!state.knownOrderIds.has(o.id)) {
                    showNotification(`¡Orden #${o.id} Finalizada!`, `Cliente: ${o.client}\nTécnico: ${o.techName}`, 'success');
                    state.knownOrderIds.add(o.id);
                }
            });
        } else {
            [...state.orders, ...state.finishedOrders].forEach(o => state.knownOrderIds.add(o.id));
        }

        cacheSet('orders', { orders: state.orders, finishedOrders: state.finishedOrders }, CFG.cacheTTL.orders);
        if (window.updateMesaBadge) window.updateMesaBadge();

    } catch (e) {
        console.error("Error al cargar órdenes, intentando fallback de caché:", e);
        try {
            const raw = localStorage.getItem('V_orders');
            if (raw) {
                const expired = JSON.parse(raw).data;
                if (expired && expired.orders) {
                    state.orders         = expired.orders;
                    state.finishedOrders = expired.finishedOrders || [];
                    state.napOverrides   = expired.napOverrides || {};
                    if (typeof showNotification === 'function') {
                        showNotification('Modo Conexión Inestable', 'No se pudieron actualizar las órdenes. Usando copia local.', 'issue');
                    }
                }
            }
        } catch(err) { console.error('Fallo en fallback de cache orders', err); }
    }
}



async function resolveUnified(idMap, force = false) {
    const ids = Object.keys(idMap).filter(id => force || !state.clients[id] || !state.clients[id].name);
    if (ids.length === 0) return;

    // INTELIGENTE: Si tenemos que resolver clientes, usamos el endpoint optimizado de inventario en 1 sola llamada
    if (ids.length > 0) {
        try {
            console.log(`[Velocity] Pre-cargando catálogo unificado para acelerar la carga...`);
            const invRes = await apiFetch('/api/v1/inventory', {}, true);
            if (invRes && Array.isArray(invRes.data)) {
                invRes.data.forEach(item => {
                    if (item && item.id) {
                        state.clients[item.id] = {
                            name: item.client_name || 'Cliente sin nombre',
                            zone: '',
                            address: item.address || '',
                            phone: '',
                            ip: item.ip,
                            mac: item.mac,
                            model: item.model,
                            status: item.status,
                            client_id: item.id
                        };
                    }
                });
                console.log(`[Velocity] Catálogo unificado cargado en RAM. Entidades listas: ${Object.keys(state.clients).length}`);
            }
        } catch(e) {
            console.warn('[Velocity] Fallback a pre-carga estándar:', e.message);
        }
    }

    // Volver a filtrar después de la carga optimizada
    const remainingIds = Object.keys(idMap).filter(id => force || !state.clients[id] || !state.clients[id].name);
    if (remainingIds.length === 0) {
        saveDynamicClients();
        return;
    }

    console.log(`[Velocity] Resolviendo de forma individual ${remainingIds.length} entidades de Wispro...`);
    const BATCH_SIZE = 5;
    for (let i = 0; i < remainingIds.length; i += BATCH_SIZE) {
        const batch = remainingIds.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (cid) => {
            try {
                const kind = idMap[cid];
                let endpointsToTry = [`/contracts/${cid}`, `/clients/${cid}`];
                if (kind === 'client') {
                    endpointsToTry = [`/clients/${cid}`];
                } else if (kind === 'installation') {
                    endpointsToTry = [`/installation_orders/${cid}`, `/sale_desk/prospects/${cid}`, `/prospects/${cid}`, `/clients/${cid}`, `/contracts/${cid}`];
                }

                let data = null;
                for (const ep of endpointsToTry) {
                    try {
                        const r = await apiFetch(ep, {}, true);
                        if (r && r.status !== 404) {
                            const raw = r.data || r;
                            if (raw && (raw.id || raw.client_id || raw.name)) {
                                data = raw;
                                if (data.name) break;
                            }
                        }
                    } catch (e) {}
                }

                if (data) {
                    let name = data.name || '';
                    let realClientId = data.client_id || data.id;

                    if (!name && data.client_id) {
                        try {
                            const cl = await apiFetch(`/clients/${data.client_id}`, {}, true);
                            if (cl) {
                                const cld = cl.data || cl;
                                name = cld.name || '';
                            }
                        } catch (e) {}
                    }

                    let napName = data.nap_name || null;
                    if (!napName && data.nap_id) {
                        if (!state.napCache) {
                            try {
                                state.napCache = JSON.parse(localStorage.getItem('Velocity_Nap_Cache') || '{}');
                            } catch(e) { state.napCache = {}; }
                        }
                        if (state.napCache[data.nap_id]) {
                            napName = state.napCache[data.nap_id];
                        } else {
                            try {
                                const napRes = await apiFetch(`/naps/${data.nap_id}`, {}, true);
                                if (napRes) {
                                    const napD = napRes.data || napRes;
                                    napName = napD.name || null;
                                    if (napName) {
                                        state.napCache[data.nap_id] = napName;
                                        localStorage.setItem('Velocity_Nap_Cache', JSON.stringify(state.napCache));
                                    }
                                }
                            } catch (e) {}
                        }
                    }

                    state.clients[cid] = {
                        name:    name,
                        zone:    data.zone_name || data.address_city || data.city || '',
                        address: [data.address_street, data.address_number].filter(Boolean).join(' ') || data.address || data.street || '',
                        phone:   data.phone_mobile || data.phone || '',
                        nap:     napName,
                        client_id: realClientId,
                        latitude:  data.latitude ? String(data.latitude).replace(/,/g, '.').trim() : '',
                        longitude: data.longitude ? String(data.longitude).replace(/,/g, '.').trim() : ''
                    };
                    if (realClientId) {
                        state.clients[realClientId] = state.clients[cid];
                    }
                }
            } catch (e) {}
        }));
    }
    saveDynamicClients();
}



async function loadIssues(force = false, maxPages = 30, fastPendingOnly = false) {
    try {
        const cached = !force && cacheGet('issues');
        if (cached && cached.pending && !fastPendingOnly) { 
            state.issues = cached.pending; 
            state.finishedIssues = cached.finished || [];
            if (window.updateReportsBadge) window.updateReportsBadge();
            return; 
        } 

        if (fastPendingOnly) {
            const pendingData = await apiFetch('/help_desk/issues?per_page=1000&state_eq=pending&page=1').catch(() => ({ data: [] }));
            const pendingItems = pendingData.data || [];
            const uniqueIssues = Array.from(new Map(pendingItems.map(i => [i.id, i])).values());

            const currentPending = state.issues || [];
            const hasChanged = uniqueIssues.length !== currentPending.length ||
                uniqueIssues.some((issue, index) => {
                    const current = currentPending[index];
                    return !current || 
                           issue.id !== current.id || 
                           issue.state !== current.state;
                });

            if (hasChanged) {
                console.log('[Velocity] Se detectó un cambio en los tickets pendientes mediante fast-poll. Ejecutando recarga completa de reportes...');
                await loadIssues(true);
            }
            return;
        }

        const todayStr = new Date().toLocaleDateString('en-CA');

        // 1. Cargar la primera página de cada estado en paralelo
        const [pendingData, closedData, finalizedPage1] = await Promise.all([
            apiFetch('/help_desk/issues?per_page=1000&state_eq=pending&page=1').catch(() => ({ data: [] })),
            apiFetch('/help_desk/issues?per_page=1000&state_eq=closed&page=1').catch(() => ({ data: [] })),
            apiFetch('/help_desk/issues?per_page=1000&state_eq=finalized&page=1').catch(() => ({ data: [] }))
        ]);

        let closedItems = closedData.data || [];
        const closedTotalPages = closedData.meta?.pagination?.total_pages || 1;

        let finalizedItems = finalizedPage1.data || [];
        const finalizedTotalPages = finalizedPage1.meta?.pagination?.total_pages || 1;

        // 2. Descargar las últimas páginas de cerrados y finalizados en paralelo (si hay más de 1 página)
        const secondBatchPromises = [];
        if (closedTotalPages > 1) {
            secondBatchPromises.push(apiFetch(`/help_desk/issues?per_page=1000&state_eq=closed&page=${closedTotalPages}`).catch(() => null));
        }
        if (finalizedTotalPages > 1) {
            secondBatchPromises.push(apiFetch(`/help_desk/issues?per_page=1000&state_eq=finalized&page=${finalizedTotalPages}`).catch(() => null));
            if (finalizedTotalPages > 2) {
                secondBatchPromises.push(apiFetch(`/help_desk/issues?per_page=1000&state_eq=finalized&page=${finalizedTotalPages - 1}`).catch(() => null));
            }
        }

        if (secondBatchPromises.length > 0) {
            const secondBatchResults = await Promise.all(secondBatchPromises);
            let idx = 0;
            if (closedTotalPages > 1) {
                const res = secondBatchResults[idx++];
                if (res?.data) closedItems = closedItems.concat(res.data);
            }
            if (finalizedTotalPages > 1) {
                const res = secondBatchResults[idx++];
                if (res?.data) finalizedItems = finalizedItems.concat(res.data);
            }
            if (finalizedTotalPages > 2) {
                const res = secondBatchResults[idx++];
                if (res?.data) finalizedItems = finalizedItems.concat(res.data);
            }
        }

        // 3. Unificar todos los ítems y filtrar
        const allItems = [...(pendingData.data || []), ...closedItems, ...finalizedItems];

        const finalIssues = allItems.filter(i => ['pending', 'open', 'abierta'].includes((i.state || '').toLowerCase()));
        
        const finalFinished = allItems.filter(i => {
            const st = (i.state || '').toLowerCase();
            if (['finalizada', 'finalizado', 'closed', 'finalized'].includes(st)) {
                const dDate = i.updated_at || '';
                const day = dDate.slice(0, 10);
                return day === todayStr;
            }
            return false;
        });

        // Eliminar duplicados por ID
        const uniqueIssues = Array.from(new Map(finalIssues.map(i => [i.id, i])).values());
        const uniqueFinished = Array.from(new Map(finalFinished.map(i => [i.id, i])).values());

        // Resolver nombres de clientes para los reportes pendientes y finalizados
        const missingClientIds = {};
        [...uniqueIssues, ...uniqueFinished].forEach(i => {
            if (i.contract_id) {
                if (force || !state.clients[i.contract_id]) {
                    missingClientIds[i.contract_id] = 'contract';
                }
            } else if (i.client_id && (force || !state.clients[i.client_id] || !state.clients[i.client_id].name)) {
                missingClientIds[i.client_id] = 'client';
            }
        });

        if (Object.keys(missingClientIds).length > 0) {
            try {
                await resolveUnified(missingClientIds, force);
            } catch (err) {
                console.error("Error resolviendo clientes para reportes:", err);
            }
        }

        // Notificaciones de nuevos reportes
        if (state.knownIssueIds.size > 0) {
            uniqueIssues.forEach(i => {
                if (!state.knownIssueIds.has(i.id)) {
                    const client = state.clients[i.client_id]?.name || 'Nuevo Reporte';
                    showNotification(`Nuevo Reporte Detectado`, `Cliente: ${client}\nAsunto: ${i.title || 'Sin asunto'}`, 'issue');
                    state.knownIssueIds.add(i.id);
                }
            });
        } else {
            uniqueIssues.forEach(i => state.knownIssueIds.add(i.id));
        }

        state.issues = uniqueIssues;
        state.finishedIssues = uniqueFinished;
        if (window.updateMesaBadge) window.updateMesaBadge();
        if (window.updateReportsBadge) window.updateReportsBadge();
        cacheSet('issues', { pending: uniqueIssues, finished: uniqueFinished }, CFG.cacheTTL.issues);
    } catch (e) {
        console.error("Error al cargar reportes, intentando fallback de caché:", e);
        try {
            const raw = localStorage.getItem('V_issues');
            if (raw) {
                const expired = JSON.parse(raw).data;
                if (expired && expired.pending) {
                    state.issues = expired.pending;
                    state.finishedIssues = expired.finished || [];
                    if (window.updateReportsBadge) window.updateReportsBadge();
                    if (typeof showNotification === 'function') {
                        showNotification('Modo Conexión Inestable', 'No se pudieron actualizar los reportes. Usando copia local.', 'issue');
                    }
                }
            }
        } catch(err) { console.error('Fallo en fallback de cache issues', err); }
    }
}




async function fetchMonthlyIssues(month, year) {
    state.monthlyReport.isFetching = true;
    state.monthlyReport.progress = 0;
    renderTab('reports');

    const startDate = new Date(year, month - 1, 1);
    const endDate   = new Date(year, month, 0, 23, 59, 59);
    
    let all = [];
    let keepGoing = true;

    try {
        // 1. Descubrimiento: Obtener total de páginas
        const dJson = await apiFetch('/help_desk/issues?per_page=100&page=1');
        let currentPage = dJson.meta?.pagination?.total_pages || 1;
        const totalPages = currentPage;

        // 2. Bucle Inverso: Desde el final (más recientes) hacia atrás
        let fetchedPages = 0;
        
        while (keepGoing && currentPage >= 1) {
            try {
                const d = await apiFetch(`/help_desk/issues?per_page=100&page=${currentPage}`);
                const items = d.data || [];
                
                if (items.length === 0) break;

                const sortedItems = [...items].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

                for (const item of sortedItems) {
                    const created = new Date(item.created_at);
                    
                    if (created < startDate) {
                        keepGoing = false;
                        break;
                    }
                    if (created <= endDate) {
                        all.push(item);
                    }
                }

                fetchedPages++;
                state.monthlyReport.progress = Math.min(95, Math.round((fetchedPages / Math.min(totalPages, 50)) * 100));
                renderTab('reports');
            } catch (err) {
                console.warn(`Error cargando página ${currentPage}:`, err.message);
            }
            
            currentPage--;
            if (fetchedPages > 100) break; 
            // Pausa para evitar error 429 del proxy 
            await new Promise(r => setTimeout(r, 1200));
        }



        // Análisis de datos
        const stats = { byCategory: {}, total: all.length };
        all.forEach(i => {
            const catName = state.categories[i.category_id] || 'Otras / Sin Categoría';
            stats.byCategory[catName] = (stats.byCategory[catName] || 0) + 1;
        });

        state.monthlyReport.results = {
            month, year,
            issues: all,
            stats: stats
        };

    } catch (e) {
        console.error("Error en reporte mensual:", e);
        alert("Error al descargar datos: " + e.message);
    } finally {
        state.monthlyReport.isFetching = false;
        state.monthlyReport.progress = 100;
        renderTab('reports');
    }
}

