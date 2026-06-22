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
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
            <div>
                <h2 class="text-2xl font-extrabold text-on-surface">Reportes de NAPs</h2>
                <p class="text-sm text-on-surface-variant mt-1">Control de niveles altos y saturación de puertos detectados en campo</p>
            </div>
            <div class="flex flex-wrap items-center gap-3">
                <input type="file" id="nap-import-file" accept=".csv" class="hidden" onchange="window.importNapsFromCSV(event)">
                <input type="file" id="nap-import-pdf-file" accept=".pdf" class="hidden" onchange="window.importNapsFromPDF(event)">
                <button onclick="document.getElementById('nap-import-file').click()" class="border border-outline-variant text-on-surface hover:bg-surface-container/40 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 active:scale-95 transition-all">
                    <span class="material-symbols-outlined text-[16px]">publish</span> Importar CSV
                </button>
                <button onclick="document.getElementById('nap-import-pdf-file').click()" class="border border-outline-variant text-on-surface hover:bg-surface-container/40 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 active:scale-95 transition-all">
                    <span class="material-symbols-outlined text-[16px]">upload_file</span> Importar PDF de Campo
                </button>
                <button onclick="window.exportNapsToCSV()" class="border border-outline-variant text-on-surface hover:bg-surface-container/40 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 active:scale-95 transition-all">
                    <span class="material-symbols-outlined text-[16px]">download</span> Exportar CSV
                </button>
                <button onclick="window.exportNapsToPDF()" class="bg-on-surface text-white hover:opacity-90 px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 active:scale-95 transition-all shadow-md">
                    <span class="material-symbols-outlined text-[16px]">print</span> Exportar PDF
                </button>
            </div>
        </div>

        <div class="relative group mb-4 max-w-md">
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

window.openNapTrackerModal = (id = null) => {
    document.getElementById('nap-tracker-form').reset();
    document.getElementById('nt-id').value = id || Date.now().toString();
    document.getElementById('nt-id-wispro').value = '';
    document.getElementById('nt-validation-result').innerHTML = '';
    
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
    
    let csvContent = '\uFEFF';
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
                { text: 'Fecha', x: 30, w: 70 },
                { text: 'Nombre NAP', x: 100, w: 85 },
                { text: 'Zona', x: 185, w: 85 },
                { text: 'Técnico', x: 270, w: 95 },
                { text: 'Coordenadas', x: 365, w: 100 },
                { text: 'Puertos', x: 465, w: 50 },
                { text: 'Niveles', x: 515, w: 50 },
                { text: 'Acción / Comentario', x: 565, w: 145 },
                { text: 'Revisada', x: 710, w: 50 }
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
            const techLines = wrapText(techName, 85, 8);

            const name = cleanText(n.name || '—');
            const nameLines = wrapText(name, 75, 8);

            const zone = cleanText(n.zone || '—');
            const zoneLines = wrapText(zone, 75, 8);

            const maxLines = Math.max(actionLines.length, techLines.length, nameLines.length, zoneLines.length, 1);
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
                currentPage.drawText(line, { x: 105, y: currentY - 5 - (idx * 10), size: 8, font: fontBold });
            });

            zoneLines.forEach((line, idx) => {
                currentPage.drawText(line, { x: 190, y: currentY - 5 - (idx * 10), size: 8, font: font });
            });

            techLines.forEach((line, idx) => {
                currentPage.drawText(line, { x: 275, y: currentY - 5 - (idx * 10), size: 8, font: font });
            });

            const coordsStr = cleanText(n.coords || '—');
            currentPage.drawText(coordsStr, { x: 370, y: currentY - 5, size: 8, font: font, color: rgb(0, 0.35, 0.73) });
            
            if (n.coords && n.coords.match(/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/)) {
                const query = encodeURIComponent(n.coords.replace(/\s/g, ''));
                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
                
                const x1 = 370;
                const y1 = currentY - rowHeight + 10;
                const x2 = 370 + 80;
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

            currentPage.drawText(cleanText(n.ports || '—'), { x: 470, y: currentY - 5, size: 8, font: font });

            currentPage.drawText(cleanText(n.levels || '—'), { x: 520, y: currentY - 5, size: 8, font: fontBold, color: rgb(0.85, 0.1, 0.1) });

            actionLines.forEach((line, idx) => {
                currentPage.drawText(line, { x: 570, y: currentY - 5 - (idx * 10), size: 7.5, font: font });
            });

            const checkBox = form.createCheckBox(`nap_resolved_${n.id}`);
            if (n.resolved) {
                checkBox.check();
            }
            
            checkBox.addToPage(currentPage, {
                x: 725,
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
    const item = state.trackedNaps.find(n => String(n.id) === String(localId));
    let wisproId = item?.wisproId;

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
        const [contracts, installations] = await Promise.all([
            apiFetch(`/contracts?per_page=1000`, {}, true),
            apiFetch(`/installation_orders?per_page=1000`, {}, true)
        ]);

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
