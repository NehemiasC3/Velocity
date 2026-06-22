Views.orders = () => {
    const { date, search, type } = state.ordersFilter;
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

    // Helper function to check if an issue passes the given date filter
    const passIssueFilter = (issue, dateFilter) => {
        let techName = state.techs[issue.assignable_id];
        if (!techName && issue.assignable_id) {
            const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
            const found = (db.technicians || []).find(t =>
                String(t.wisproId) === String(issue.assignable_id) || String(t.id) === String(issue.assignable_id)
            );
            techName = found?.name;
        }
        if (!techName) techName = 'Sin asignar';

        if (dateFilter === 'sin_asignar') {
            return techName === 'Sin asignar';
        }
        if (techName === 'Sin asignar') return false;

        const esActivo = TECNICOS_ACTIVOS.some(n =>
            techName.toLowerCase().includes(n.split(' ')[0].toLowerCase())
        );
        if (!esActivo) return false;

        const issueDateStr = issue.expires_at ? new Date(issue.expires_at).toLocaleDateString('en-CA') : '';
        if (!issueDateStr) return false;

        const todayStr = new Date().toLocaleDateString('en-CA');
        const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomorrowStr = tomorrowDate.toLocaleDateString('en-CA');

        const isToday = issueDateStr === todayStr;
        const isTomorrow = issueDateStr === tomorrowStr;

        if (!isToday && !isTomorrow) return false; // Excluye vencidos u otras fechas

        if (dateFilter === 'all') return true;
        if (dateFilter === 'hoy') return isToday;
        if (dateFilter === 'manana') return isTomorrow;

        return false;
    };

    // Helper function to check if an order passes the given date filter
    const passOrderFilter = (o, dateFilter) => {
        if (o.kind !== 'installation') return false;

        const techName = o.techName || 'Sin asignar';
        if (techName === 'Sin asignar') return false;

        const esActivo = TECNICOS_ACTIVOS.some(n =>
            techName.toLowerCase().includes(n.split(' ')[0].toLowerCase())
        );
        if (!esActivo) return false;

        const orderDateStr = o.start_at ? new Date(o.start_at).toLocaleDateString('en-CA') : '';
        if (!orderDateStr) return false;

        const todayStr = new Date().toLocaleDateString('en-CA');
        const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomorrowStr = tomorrowDate.toLocaleDateString('en-CA');

        const isToday = orderDateStr === todayStr;
        const isTomorrow = orderDateStr === tomorrowStr;

        if (!isToday && !isTomorrow) return false; // Excluye instalaciones vencidas o de otras fechas

        if (dateFilter === 'all') return true;
        if (dateFilter === 'hoy') return isToday;
        if (dateFilter === 'manana') return isTomorrow;

        return false;
    };

    // 1. Filtrar Activas
    let activeIssues = state.issues.filter(issue => passIssueFilter(issue, date));
    let activeOrders = state.orders.filter(o => passOrderFilter(o, date));

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

            return `<div style="border-bottom:1px solid #f3f4f6; padding:4px 0;">
                <div onclick="window.openZoneModal('${safeTechName}', '${safeZoneName}', '${encodedIssues}', '${encodedOrders}')" style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;cursor:pointer;user-select:none;transition:background 0.2s;border-radius:6px;" class="hover:bg-surface-container-low/50 px-2">
                    <div style="display:flex;align-items:center;gap:6px;">
                        <span class="material-symbols-outlined" style="font-size:14px;color:#6b7280;">location_on</span>
                        <span style="font-size:14px;font-weight:700;color:#374151;">${zone}</span>
                    </div>
                    ${badgesHtml}
                </div>
            </div>`;
        }).join('');

        const safeId = techName.replace(/\s+/g,'-').replace(/[^a-zA-Z0-9-]/g,'');
        const totalItems = issuesList.length + ordersList.length;

        return `<div style="background:white;border:1px solid #f0f0f0;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #f3f4f6;">
                <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:38px;height:38px;border-radius:12px;background:${color};display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:800;flex-shrink:0;">${initials}</div>
                    <div>
                        <p style="font-weight:800;color:#111827;font-size:17px;margin:0;line-height:1.2;">${techName}</p>
                        <div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap;">
                            <span style="font-size:13px;font-weight:700;color:#4b5563;">${totalItems} tarea${totalItems!==1?'s':''}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div style="padding:10px 16px;">${zoneRows||'<p style="font-size:13px;color:#9ca3af;text-align:center;padding:8px;">Sin zonas</p>'}</div>
        </div>`;
    };

    // Calculate filter button counts precisely, respecting the active type filter
    const counts = { all: 0, hoy: 0, manana: 0, vencido: 0, sin_fecha: 0, sin_asignar: 0 };
    const checkIssues = activeType === 'all' || activeType === 'issues';
    const checkOrders = activeType === 'all' || activeType === 'orders';
    const filterKeys = ['all', 'hoy', 'manana', 'vencido', 'sin_fecha', 'sin_asignar'];

    if (checkIssues) {
        state.issues.forEach(i => {
            filterKeys.forEach(k => {
                if (passIssueFilter(i, k)) counts[k]++;
            });
        });
    }
    if (checkOrders) {
        state.orders.forEach(o => {
            filterKeys.forEach(k => {
                if (passOrderFilter(o, k)) counts[k]++;
            });
        });
    }

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
        {v:'sin_asignar',l:'Sin asignar',c:counts.sin_asignar}
    ].map(f => {
        const active = date === f.v;
        const bg = active ? '#111827' : '#f3f4f6';
        const color = active ? 'white' : '#374151';
        const badgeBg = active ? 'rgba(255,255,255,0.2)' : '#e5e7eb';
        return `<button onclick="window.setOrdersFilter('date','${f.v}')" style="display:flex;align-items:center;gap:6px;padding:6px 14px;border-radius:999px;font-size:13px;font-weight:700;border:none;cursor:pointer;background:${bg};color:${color};transition:all 0.2s;">
            ${f.l} <span style="font-size:11px;font-weight:800;padding:2px 6px;border-radius:999px;background:${badgeBg};">${f.c}</span>
        </button>`;
    }).join('');

    // Append Ver Mapa button next to Sin asignar button
    dateFilters += `
    <button onclick="window.openOrdersMapModal()" style="display:flex;align-items:center;gap:6px;padding:6px 14px;border-radius:999px;font-size:13px;font-weight:700;border:none;cursor:pointer;background:#e8eeff;color:#0059bb;transition:all 0.2s;box-shadow:0 1px 2px rgba(0,0,0,0.05);" class="hover:bg-primary/10 hover:shadow active:scale-95">
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
                    <td class="py-3 px-4 text-right">
                        <span class="text-xs font-bold text-on-surface-variant">
                            ${timeStr}
                        </span>
                    </td>
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
                    <td class="py-3 px-4 text-right">
                        <span class="text-xs font-bold text-on-surface-variant">
                            ${timeStr}
                        </span>
                    </td>
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

    const typeButtons = [
        { v: 'all', l: `Todos (${totalCombinedCount})` },
        { v: 'issues', l: `Reportes (${totalIssuesCount})` },
        { v: 'orders', l: `Instalaciones (${totalOrdersCount})` }
    ].map(item => {
        const active = activeType === item.v;
        const bg = active ? 'var(--secondary)' : 'var(--surface-container-high)';
        const color = active ? 'var(--on-secondary)' : 'var(--on-surface-variant)';
        return `<button onclick="window.setOrdersFilter('type','${item.v}')" style="padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;border:none;cursor:pointer;background:${bg};color:${color};transition:all 0.2s;display:inline-flex;align-items:center;gap:4px;">
            ${item.l}
        </button>`;
    }).join('');

    return `<div>
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
                <h2 class="text-2xl font-extrabold text-on-surface">Órdenes (Mesa de Ayuda + Instalaciones)</h2>
                <p class="text-sm text-on-surface-variant mt-1">Reportes y órdenes activos agrupados por técnico</p>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:6px 12px;display:flex;align-items:center;gap:5px;">
                    <span style="width:7px;height:7px;background:#f97316;border-radius:50%;display:inline-block;"></span>
                    <span style="font-size:14px;font-weight:700;color:#c2410c;">Pendientes ${totalActiveTasks}</span>
                </div>
                <div style="display:flex;gap:4px;background:var(--surface-container-low);padding:4px;border-radius:10px;border:1px solid rgba(0,0,0,0.08);align-items:center;">
                    ${typeButtons}
                </div>
                <button onclick="window.refreshOrders()" style="width:34px;height:34px;border:1px solid #e5e7eb;border-radius:8px;background:white;cursor:pointer;display:flex;align-items:center;justify-content:center;">
                    <span class="material-symbols-outlined inline-block ${state.isSyncing ? 'animate-spin' : ''}" style="font-size:17px;color:#6b7280;">sync</span>
                </button>
            </div>
        </div>

        <div class="relative group mb-4 max-w-md">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-secondary transition-colors text-lg">search</span>
            <input type="text" 
                id="orders-search-input"
                placeholder="Buscar por zona, cliente, técnico, ID... (Enter)" 
                value="${search || ''}"
                onkeydown="if(event.key === 'Enter') { window.setOrdersSearch(this.value); }"
                class="w-full bg-surface-container-lowest border border-outline-variant/25 focus:border-secondary focus:ring-2 focus:ring-secondary/5 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold outline-none transition-all shadow-sm placeholder:text-on-surface-variant/40"
            >
            ${search ? `
                <button onclick="window.setOrdersSearch('');" class="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant/60">
                    <span class="material-symbols-outlined text-sm">close</span>
                </button>
            ` : ''}
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">${dateFilters}</div>
        ${totalActiveTasks === 0
            ? `<div style="text-align:center;padding:60px;color:#9ca3af;"><span class="material-symbols-outlined" style="font-size:48px;display:block;margin-bottom:8px;">search_off</span><p style="font-weight:700;font-size:14px;text-transform:uppercase;">Sin tareas pendientes</p></div>`
            : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px;align-items:start;">${techCards}</div>`
        }

        ${finishedSectionHtml}
    </div>`;
};

window.refreshOrders = async function() {
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
        if (typeof renderTab === 'function') renderTab('orders');
    } catch(e) { console.error(e); }
    
    icons.forEach(i => i.classList.remove('animate-spin'));
    if (window.hideLoadingOverlay) window.hideLoadingOverlay();
};

window.setOrdersFilter = function(key, value) {
    state.ordersFilter[key] = value;
    renderTab('orders');
};

window.setOrdersSearch = function(q) {
    state.ordersFilter.search = q;
    renderTab('orders');
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
                
                const title = i.title || i.description || '';
                const zm = title.match(/\(([^)]+)\)/);
                const clientZone = (zm ? zm[1] : (client.zone || '')) || zoneName || 'Sin zona';
                
                const desc = i.description || i.title || '';
                const napVal = getNapForIssue(i);
                const isNapUnassigned = !napVal || napVal.toLowerCase().includes('sin asignar') || napVal.toLowerCase().includes('n/a') || napVal === 'Sin colocar';
                const napText = isNapUnassigned ? 'Sin colocar' : napVal;
                
                const dateStr = i.expires_at ? new Date(i.expires_at).toLocaleDateString('es-ES') : 'Sin fecha';

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
    const contentBox = modal.querySelector('div');
    if (contentBox) {
        setTimeout(() => {
            contentBox.classList.remove('scale-95');
            contentBox.classList.add('scale-100');
        }, 10);
    }
};

window.openOrdersMapModal = function() {
    document.getElementById('orders-map-modal')?.remove();

    const html = `
    <div id="orders-map-modal" class="fixed inset-0 z-[250] bg-black/40 backdrop-blur-sm flex items-center justify-center p-2" onclick="if(event.target === this) window.closeOrdersMapModal()">
        <div class="bg-surface-container-lowest w-[98vw] max-w-none rounded-[1.5rem] shadow-2xl overflow-hidden flex flex-col h-[96vh]" onclick="event.stopPropagation()">
            <div class="flex justify-between items-center px-6 py-4 border-b border-surface-container-highest">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-secondary">map</span>
                    <h3 class="font-bold text-on-surface text-base Inter">Mapa de Clientes (Filtro Activo)</h3>
                </div>
                <button onclick="window.closeOrdersMapModal()" class="text-on-surface-variant hover:text-error transition-colors p-2 rounded-full hover:bg-error-container/30 flex items-center justify-center active:scale-95">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="flex-1 w-full bg-surface-container-high relative">
                <div id="leaflet-orders-fullscreen-map" style="height: 100%; width: 100%;"></div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);

    setTimeout(() => {
        const map = L.map('leaflet-orders-fullscreen-map').setView([8.9833, -79.5167], 8);
        L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
            attribution: '&copy; Google Maps'
        }).addTo(map);

        const bounds = [];
        const { date, search, type } = state.ordersFilter;

        const parseCoord = (val) => {
            if (val === undefined || val === null) return NaN;
            const str = String(val).replace(/,/g, '.').trim();
            return parseFloat(str);
        };

        let activeIssues = state.issues.filter(issue => passIssueFilter(issue, date));
        let activeOrders = state.orders.filter(o => passOrderFilter(o, date));

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
            const color = isIssue ? '#ef4444' : '#0059bb';
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

        window.ordersMapInstance = map;
    }, 100);
};

window.closeOrdersMapModal = function() {
    const modal = document.getElementById('orders-map-modal');
    if (modal) {
        modal.remove();
    }
    if (window.ordersMapInstance) {
        window.ordersMapInstance.remove();
        window.ordersMapInstance = null;
    }
};
