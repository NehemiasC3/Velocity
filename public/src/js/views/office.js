Views.office = () => {
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
    const counts = { all: 0, hoy: 0, manana: 0, semana: 0, vencido: 0, sin_fecha: 0, sin_asignar: 0 };
    const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    
    searchFilteredIssues.forEach(i => {
        if (!i.assignable_id) { counts.sin_asignar++; counts.all++; return; }
        
        let tName = state.techs[i.assignable_id];
        if (!tName) {
            const f = (db.technicians || []).find(t => String(t.wisproId) === String(i.assignable_id) || String(t.id) === String(i.assignable_id));
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

    // 3. Filtrar por fecha o estado de asignación sobre la lista filtrada por búsqueda
    let allIssues = searchFilteredIssues.filter(issue => {
        if (date === 'sin_asignar') {
            return !issue.assignable_id;
        }

        // Si es 'all', queremos incluir los sin asignar y los asignados a tecnicos activos
        if (date === 'all') {
            if (!issue.assignable_id) return true;
            
            const techName = state.techs[issue.assignable_id] || '';
            const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
            const foundInDB = (db.technicians || []).find(t => String(t.wisproId) === String(issue.assignable_id) || String(t.id) === String(issue.assignable_id));
            const resolvedName = techName || foundInDB?.name || '';
            const esActivo = resolvedName && TECNICOS_ACTIVOS.some(n =>
                resolvedName.toLowerCase().includes(n.split(' ')[0].toLowerCase())
            );
            return esActivo;
        }

        // Excluir los sin asignar si no estamos en ese filtro
        if (!issue.assignable_id) return false;

        // Verificar que el técnico sea uno de los activos
        const techName = state.techs[issue.assignable_id] || '';
        const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
        const foundInDB = (db.technicians || []).find(t => String(t.wisproId) === String(issue.assignable_id) || String(t.id) === String(issue.assignable_id));
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

    // Agrupar por tecnico
    const byTech = {};
    allIssues.forEach(issue => {
        let techName = state.techs[issue.assignable_id];

        if (!techName && issue.assignable_id) {
            const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
            const found = (db.technicians || []).find(t =>
                String(t.wisproId) === String(issue.assignable_id) || String(t.id) === String(issue.assignable_id)
            );
            techName = found?.name;
        }

        if (!techName) techName = 'Sin asignar';

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

        const byZone = {};
        issues.forEach(issue => {
            const client = state.clients[issue.client_id] || {};
            const title  = issue.title || issue.description || '';
            const zm = title.match(/\(([^)]+)\)/);
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

        return `<div style="background:white;border:1px solid #f0f0f0;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #f3f4f6;">
                <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:38px;height:38px;border-radius:12px;background:${color};display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:800;flex-shrink:0;">${initials}</div>
                    <div>
                        <p style="font-weight:800;color:#111827;font-size:17px;margin:0;line-height:1.2;">${techName}</p>
                        <p style="font-size:14.5px;font-weight:700;color:#4b5563;margin-top:4px;">${issues.length} reporte${issues.length!==1?'s':''}</p>
                    </div>
                </div>
            </div>
            <div style="padding:10px 16px;">${zoneRows||'<p style="font-size:13px;color:#9ca3af;text-align:center;padding:8px;">Sin zonas</p>'}</div>
        </div>`;
    };

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
                <h2 class="text-2xl font-extrabold text-on-surface">Reportes Oficina</h2>
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
