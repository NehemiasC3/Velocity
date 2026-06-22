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
        <div class="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-4 hover:shadow-md transition-all cursor-pointer" onclick="window.switchTab('orders');window.setOrdersFilter('tech','${nombre}')">
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
