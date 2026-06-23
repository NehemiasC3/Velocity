// Velocity API Module

async function apiFetch(path, opts = {}, silent = false) {
    if (!SESSION_TOKEN) return null;

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
                    'Authorization': SESSION_TOKEN,
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
            // Network error retries
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
    } catch (e) {
        // Corrupted cache entry — remove it to prevent persistent parse errors
        console.warn(`[Velocity] Caché corrupta detectada para '${key}'. Limpiando...`, e.message);
        try { localStorage.removeItem('V_' + key); } catch (_) {}
        return null;
    }
}



function cacheSet(key, data, ttl) {
    try {
        localStorage.setItem('V_' + key, JSON.stringify({ ts: Date.now(), data, ttl }));
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
            console.warn(`[Velocity] localStorage lleno al escribir '${key}'. Intentando liberar espacio...`);
            // Try removing stale caches to free space
            try {
                localStorage.removeItem('V_clients_dynamic');
                localStorage.setItem('V_' + key, JSON.stringify({ ts: Date.now(), data, ttl }));
            } catch (_) {
                console.error('[Velocity] No se pudo escribir en localStorage incluso tras limpiar espacio.');
            }
        }
    }
}



function cacheClear() {
    ['static','orders','issues','clients_dynamic'].forEach(k => localStorage.removeItem('V_' + k));
}



function loadDynamicClients() {
    const cached = cacheGet('clients_dynamic');
    state.dynamicClients = cached || {};
    if (cached) {
        for (const [id, clientData] of Object.entries(cached)) {
            state.clients[id] = {
                ...(state.clients[id] || {}),
                ...clientData
            };
        }
    }
}



function saveDynamicClients() {
    // Solo guardamos los que se resolvieron dinámicamente y no están duplicados en V_static
    if (state.dynamicClients) {
        try {
            cacheSet('clients_dynamic', state.dynamicClients, 1000 * 60 * 60 * 24); // 24 horas
        } catch (e) {
            // localStorage QuotaExceededError protection
            if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
                console.warn('[Velocity] localStorage lleno. Limpiando caché dinámica antigua...');
                try {
                    // Prune: keep only the latest 200 dynamic clients
                    const entries = Object.entries(state.dynamicClients);
                    if (entries.length > 200) {
                        state.dynamicClients = Object.fromEntries(entries.slice(-200));
                    }
                    cacheSet('clients_dynamic', state.dynamicClients, 1000 * 60 * 60 * 24);
                } catch (innerErr) {
                    console.error('[Velocity] No se pudo guardar caché dinámica tras limpieza:', innerErr);
                }
            } else {
                console.error('[Velocity] Error inesperado al guardar caché dinámica:', e);
            }
        }
    }
}



async function loadStaticData(force = false) {
    const cached = !force && cacheGet('static');
    if (cached) {
        Object.assign(state.clients, cached.clients || {});
        Object.assign(state.techs, cached.techs || {});
        Object.assign(state.techEmails || {}, cached.techEmails || {});
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
            state.techEmails[t.id] = t.email || '';
        });

        (Array.isArray(rawCats.data) ? rawCats.data : []).forEach(c => {
            state.categories[c.id] = c.name;
        });

        cacheSet('static', {
            clients:    state.clients,
            techs:      state.techs,
            techEmails: state.techEmails,
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

        state.orders = todayOrders.map(mapOrder).sort((a, b) => (a.start_at || '').localeCompare(b.start_at || ''));
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

    // INTELIGENTE: Si tenemos que resolver más de 2 clientes, es mucho más rápido traerlos en lote (bulk)
    if (ids.length > 2) {
        try {
            console.log(`[Velocity] Pre-cargando clientes en lote para acelerar la carga...`);
            const bulkData = await apiFetch('/clients?per_page=1000', {}, true);
            if (bulkData && bulkData.data) {
                bulkData.data.forEach(c => {
                    if (c && c.id) {
                        state.clients[c.id] = {
                            name:    c.name || 'Cliente sin nombre',
                            zone:    c.zone_name || c.address_city || c.city || '',
                            address: [c.address_street, c.address_number].filter(Boolean).join(' ') || c.address || c.street || '',
                            phone:   c.phone_mobile || c.phone || '',
                            nap:     c.nap_name || null,
                            client_id: c.id,
                            latitude:  c.latitude ? String(c.latitude).replace(/,/g, '.').trim() : '',
                            longitude: c.longitude ? String(c.longitude).replace(/,/g, '.').trim() : ''
                        };
                    }
                });
                console.log(`[Velocity] Pre-carga completada. Clientes en caché: ${Object.keys(state.clients).length}`);
            }
        } catch(e) {
            console.warn('[Velocity] Error en pre-carga de clientes:', e);
        }
    }

    // Volver a filtrar después de la carga en lote
    const remainingIds = Object.keys(idMap).filter(id => force || !state.clients[id] || !state.clients[id].name);
    if (remainingIds.length === 0) return;

    if (!state.resolvingPromises) state.resolvingPromises = {};

    // Filtrar ids que ya se están resolviendo en paralelo actualmente
    const uniqueRemainingIds = remainingIds.filter(id => !state.resolvingPromises[id]);
    const alreadyResolvingPromises = remainingIds
        .filter(id => state.resolvingPromises[id])
        .map(id => state.resolvingPromises[id]);

    if (uniqueRemainingIds.length > 0) {
        console.log(`[Velocity] Resolviendo de forma individual ${uniqueRemainingIds.length} entidades de Wispro...`);
        const BATCH_SIZE = 3;
        for (let i = 0; i < uniqueRemainingIds.length; i += BATCH_SIZE) {
            const batch = uniqueRemainingIds.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map((cid) => {
                const promise = (async () => {
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
                                        // Si ya tenemos el nombre, no seguimos buscando
                                        if (data.name) break;
                                    }
                                }
                            } catch (e) {}
                        }

                        if (data) {
                            let name = data.name || '';
                            let realClientId = data.client_id || data.id;

                            // Si no tenemos nombre pero sí client_id, intentamos traer el cliente
                            if (!name && data.client_id) {
                                try {
                                    const cl = await apiFetch(`/clients/${data.client_id}`, {}, true);
                                    if (cl) {
                                        const cld = cl.data || cl;
                                        name = cld.name || '';
                                    }
                                } catch (e) {}
                            }

                            // Si tenemos nap_id pero no el nombre de la nap, intentamos traerlo con caché persistente
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

                            const clientRecord = {
                                name:    name,
                                zone:    data.zone_name || data.address_city || data.city || '',
                                address: [data.address_street, data.address_number].filter(Boolean).join(' ') || data.address || data.street || '',
                                phone:   data.phone_mobile || data.phone || '',
                                nap:     napName,
                                client_id: realClientId,
                                latitude:  data.latitude ? String(data.latitude).replace(/,/g, '.').trim() : '',
                                longitude: data.longitude ? String(data.longitude).replace(/,/g, '.').trim() : ''
                            };

                            state.clients[cid] = clientRecord;
                            if (!state.dynamicClients) state.dynamicClients = {};
                            state.dynamicClients[cid] = clientRecord;

                            if (realClientId) {
                                state.clients[realClientId] = clientRecord;
                                state.dynamicClients[realClientId] = clientRecord;
                            }
                        }
                    } catch (e) {
                        console.error(`[Velocity] Error resolviendo individualmente ID ${cid}:`, e);
                    } finally {
                        delete state.resolvingPromises[cid];
                    }
                })();

                state.resolvingPromises[cid] = promise;
                return promise;
            });

            await Promise.all(batchPromises);
            if (i + BATCH_SIZE < uniqueRemainingIds.length) await new Promise(r => setTimeout(r, 1000));
        }
    }

    // Esperar a que terminen las peticiones en curso (tanto las nuevas como las anteriores concurrentes)
    if (alreadyResolvingPromises.length > 0) {
        await Promise.all(alreadyResolvingPromises);
    }

    saveDynamicClients();
}



let _loadIssuesRunning = false;
async function loadIssues(force = false, maxPages = 30, fastPendingOnly = false) {
    // Concurrency guard: prevent overlapping full loads
    if (_loadIssuesRunning && !fastPendingOnly) {
        console.log('[Velocity] loadIssues ya en ejecución, omitiendo llamada duplicada.');
        return;
    }
    if (!fastPendingOnly) _loadIssuesRunning = true;
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
    } finally {
        if (!fastPendingOnly) _loadIssuesRunning = false;
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

