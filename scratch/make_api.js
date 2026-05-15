const fs = require('fs');
const path = require('path');

const apiContent = `// Velocity API Module

async function apiFetch(path, opts = {}, silent = false) {
    if (!SESSION_TOKEN) return null;

    const isLocalApi = !path.includes(CFG.proxy) && (path.startsWith('/api/') || path.startsWith('api/'));
    
    const executeFetch = async () => {
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
                body: opts.body || (['POST', 'PUT', 'PATCH'].includes(opts.method) ? JSON.stringify(opts.data) : undefined)
            });

            if (res.ok) return await res.json();
            if (silent && res.status === 404) return null;
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || \`HTTP \${res.status}\`);
        } catch (e) {
            if (!silent) console.warn('[Velocity] Fetch Error:', e.message, path);
            throw e;
        }
    };

    // Ejecutamos siempre en paralelo para máxima velocidad sin usar colas
    return executeFetch();
}

async function serverSync() {
    try {
        updateSystemStatus(true);
        // 1. Descargar estado actual del servidor
        const remoteState = await apiFetch('/api/sync', { method: 'GET' }, true);
        if (remoteState) {
            localStorage.setItem('Velocity_Sync_State', JSON.stringify(remoteState));
            console.log('[Velocity] Estado sincronizado desde el servidor');
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
    } catch (e) { console.error('[Velocity] Falló el guardado en servidor'); }
}

async function apiPages(endpoint, maxPages = 10) {
    let all = [], page = 1;
    while (page <= maxPages) {
        const d = await apiFetch(\`/\${endpoint}?per_page=1000&page=\${page}\`);
        const items = Array.isArray(d.data) ? d.data : [];
        all = all.concat(items);
        if (items.length < 1000) break;
        page++;
    }
    return all;
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
        Object.assign(state.clients, cached);
    }
}

function saveDynamicClients() {
    cacheSet('clients_dynamic', state.clients, 1000 * 60 * 60 * 24); // 24 horas
}

async function loadStaticData(force = false) {
    const cached = !force && cacheGet('static');
    if (cached) {
        state.clients    = cached.clients;
        state.techs      = cached.techs;
        state.categories = cached.categories;
        return;
    }

    try {
        const [rawClients, rawTechs, rawCats] = await Promise.all([
            apiPages('clients').catch(() => []),
            apiFetch('/employees?per_page=1000').catch(() => ({ data: [] })),
            apiFetch('/help_desk/categories?per_page=200').catch(() => ({ data: [] }))
        ]);

        rawClients.forEach(c => {
            state.clients[c.id] = {
                name:    c.name || '',
                zone:    c.zone_name || '',
                address: c.address || c.street || '',
                phone:   c.phone_mobile || c.phone || '',
                lat:     c.latitude || c.gps_point?.latitude || null,
                lng:     c.longitude || c.gps_point?.longitude || null
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
    } catch (e) {
        console.warn('[Velocity] Error cargando datos estáticos:', e.message);
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
            const day   = (o.start_at || '').slice(0, 10);
            const st    = (o.state || '').toLowerCase();
            const isActive = ['pending', 'started', 'in_progress', 'to_reschedule', 'abierta', 'open'].includes(st);
            return day === todayStr && isActive;
        });

        const finishedOrdersRaw = items.filter(o => {
            const st = (o.state || '').toLowerCase();
            const isFinished = ['finalizada', 'finalizado', 'finalized', 'closed'].includes(st);
            if (isFinished && !!o.employee_id) {
                return (o.end_at || o.updated_at || '').slice(0, 10) === todayStr;
            }
            return false;
        });

        const toResolve = {};
        [...todayOrders, ...finishedOrdersRaw].forEach(o => {
            if (o.orderable_id && !state.clients[o.orderable_id]) {
                toResolve[o.orderable_id] = o.kind;
            }
        });

        // Ejecutar resolución unificada
        await resolveUnified(toResolve);

        // Función mapeadora local
        const mapOrder = (o) => {
            const resolved  = state.clients[o.orderable_id] || {};
            const techName  = state.techs[o.employee_id] || 'Sin asignar';
            const typeCfg   = TYPE_CFG[o.kind] || { color: '#6b7280', label: o.kind || '?', icon: 'task' };
            const nameFromDesc = o.description?.match(/\\(([^)]+)\\)/)?.[1] || '';
            const startDate = o.start_at ? new Date(o.start_at) : null;
            
            const endDate   = o.end_at ? new Date(o.end_at) : (o.state === 'finalized' && o.updated_at ? new Date(o.updated_at) : null);
            
            return {
                ...o,
                id:           o.sequential_id || o.id?.slice(0, 8),
                rawId:        o.id,
                typeLabel:    typeCfg.label,
                typeColor:    typeCfg.color,
                typeIcon:     typeCfg.icon,
                client:       resolved.name || nameFromDesc || \`#\${o.sequential_id || o.id} \${o.orderable_id ? '' : '(Sin Asignar)'}\`,
                address:      resolved.address || '',
                zone:         resolved.zone || '',
                phone:        resolved.phone || '',
                techName:     techName,
                startTime:    startDate ? startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
                endTime:      endDate ? endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
                feedbacksCount: o.feedbacks_count || 0
            };
        };

        state.orders = todayOrders.map(mapOrder).sort((a, b) => (a.start_at || '').localeCompare(b.start_at || ''));
        state.finishedOrders = finishedOrdersRaw.map(mapOrder);

        // Notificaciones
        if (state.knownOrderIds.size > 0) {
            state.finishedOrders.forEach(o => {
                if (!state.knownOrderIds.has(o.id)) {
                    showNotification(\`¡Orden #\${o.id} Finalizada!\`, \`Cliente: \${o.client}\\nTécnico: \${o.techName}\`, 'success');
                    state.knownOrderIds.add(o.id);
                }
            });
        } else {
            [...state.orders, ...state.finishedOrders].forEach(o => state.knownOrderIds.add(o.id));
        }

        cacheSet('orders', { orders: state.orders, finishedOrders: state.finishedOrders }, CFG.cacheTTL.orders);

    } catch (e) {
        console.error("Error al cargar órdenes:", e);
    }
}

async function resolveUnified(idMap) {
    const ids = Object.keys(idMap).filter(id => !state.clients[id]);
    if (ids.length === 0) return;

    console.log(\`[Velocity] Resolviendo \${ids.length} entidades de Wispro...\`);
    const BATCH_SIZE = 3;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (cid) => {
            try {
                const kind = idMap[cid];
                let endpointsToTry = [\`/contracts/\${cid}\`, \`/clients/\${cid}\`];
                if (kind === 'installation') {
                    endpointsToTry = [\`/installation_orders/\${cid}\`, \`/sale_desk/prospects/\${cid}\`, \`/prospects/\${cid}\`, \`/clients/\${cid}\`, \`/contracts/\${cid}\`];
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
                            const cl = await apiFetch(\`/clients/\${data.client_id}\`, {}, true);
                            if (cl) {
                                const cld = cl.data || cl;
                                name = cld.name || '';
                            }
                        } catch (e) {}
                    }

                    let napName = data.nap_name || null;
                    if (!napName && data.nap_id) {
                        try {
                            const napRes = await apiFetch(\`/naps/\${data.nap_id}\`, {}, true);
                            if (napRes) {
                                const napD = napRes.data || napRes;
                                napName = napD.name || null;
                            }
                        } catch (e) {}
                    }

                    state.clients[cid] = {
                        name:    name,
                        zone:    data.zone_name || data.address_city || data.city || '',
                        address: [data.address_street, data.address_number].filter(Boolean).join(' ') || data.address || data.street || '',
                        phone:   data.phone_mobile || data.phone || '',
                        nap:     napName,
                        client_id: realClientId
                    };
                }
            } catch (e) {}
        }));
        if (i + BATCH_SIZE < ids.length) await new Promise(r => setTimeout(r, 1000));
    }
    saveDynamicClients();
}

async function loadIssues(force = false) {
    try {
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
        const d = await apiFetch(\`/help_desk/issues?per_page=1000&page=\${page}&q%5Bs%5D=id+desc\`);
        const items = d.data || [];
        if (!items.length) break;
        
        allPending = allPending.concat(items.filter(i => ['pending', 'open', 'abierta'].includes((i.state || '').toLowerCase())));
        
        allFinished = allFinished.concat(items.filter(i => {
            const st = (i.state || '').toLowerCase();
            if (['finalizada', 'finalizado', 'closed', 'finalized'].includes(st)) {
                const dDate = i.updated_at || '';
                const day = dDate.slice(0, 10);
                return day === todayStr;
            }
            return false;
        }));

        if (items.length < 1000) break;
        page++;
        await new Promise(r => setTimeout(r, 1200));
    }

    const newIssues = allPending;
    const newFinished = allFinished;

    if (state.knownIssueIds.size > 0) {
        newIssues.forEach(i => {
            if (!state.knownIssueIds.has(i.id)) {
                const client = state.clients[i.client_id]?.name || 'Nuevo Reporte';
                showNotification(\`Nuevo Reporte Detectado\`, \`Cliente: \${client}\\nAsunto: \${i.title || 'Sin asunto'}\`, 'issue');
                state.knownIssueIds.add(i.id);
            }
        });
    } else {
        newIssues.forEach(i => state.knownIssueIds.add(i.id));
    }

    state.issues = newIssues;
    state.finishedIssues = newFinished;
    cacheSet('issues', { pending: newIssues, finished: newFinished }, CFG.cacheTTL.issues);
    } catch (e) {
        console.error("Error al cargar reportes:", e);
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
        const dJson = await apiFetch('/help_desk/issues?per_page=100&page=1');
        let currentPage = dJson.meta?.pagination?.total_pages || 1;
        const totalPages = currentPage;

        let fetchedPages = 0;
        
        while (keepGoing && currentPage >= 1) {
            try {
                const d = await apiFetch(\`/help_desk/issues?per_page=100&page=\${currentPage}\`);
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
                console.warn(\`Error cargando página \${currentPage}:\`, err.message);
            }
            
            currentPage--;
            if (fetchedPages > 100) break; 
            await new Promise(r => setTimeout(r, 1200));
        }

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
\`;

fs.writeFileSync(path.join(__dirname, '../public/src/js/core/api.js'), apiContent);
console.log("api.js perfectly rebuilt");
