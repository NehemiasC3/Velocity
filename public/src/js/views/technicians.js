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
