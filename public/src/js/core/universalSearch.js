/**
 * Velocity Universal Search Engine (Command Palette & Motor de Búsqueda de Alto Rendimiento)
 * Compatible con la suite principal de Velocity (Panel de Supervisor, Técnico, Bodega)
 */
(function () {
    let isOpen = false;
    let currentCategory = 'ALL';
    let searchDebounceTimer = null;
    let videoStream = null;
    let isScannerActive = false;

    // Normalizar dirección MAC
    function normalizeMac(str) {
        if (!str) return '';
        const clean = str.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
        return clean;
    }

    // Formatear MAC con dos puntos
    function formatMacWithColons(cleanMac) {
        if (!cleanMac || cleanMac.length < 2) return cleanMac;
        return cleanMac.match(/.{1,2}/g)?.join(':') || cleanMac;
    }

    // Generar Modal HTML en el DOM si no existe
    function ensureModalDOMElements() {
        if (document.getElementById('velocity-universal-search-modal')) return;

        const modalHTML = `
        <div id="velocity-universal-search-modal" class="fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-xs flex items-start justify-center p-3 sm:p-6 md:p-10 hidden transition-opacity duration-200">
            <div id="universal-search-card" class="relative w-full max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[88vh] animate-scale-up" onclick="event.stopPropagation()">
                
                <!-- Barra Superior de Entrada de Búsqueda -->
                <div class="relative flex items-center px-4 py-3.5 border-b border-slate-200 bg-white">
                    <span class="material-symbols-outlined text-blue-600 text-[22px] shrink-0 mr-3">search</span>
                    <input 
                        type="text" 
                        id="univ-search-input" 
                        placeholder="Buscar por MAC (ej: E067B3 o con dos puntos), Serial, Cliente Wispro, SKU, Remisión..." 
                        class="flex-1 bg-transparent text-sm md:text-base text-slate-900 placeholder-slate-400 focus:outline-none font-sans font-medium"
                        autocomplete="off"
                        spellcheck="false"
                    >
                    
                    <!-- Botón Limpiar -->
                    <button type="button" id="univ-search-clear-btn" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition mr-2 hidden" title="Limpiar búsqueda">
                        <span class="material-symbols-outlined text-base">close</span>
                    </button>

                    <!-- Botón Escáner de Cámara -->
                    <button type="button" id="univ-scanner-toggle-btn" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition shrink-0 mr-2 cursor-pointer shadow-2xs" title="Escanear Código de Barras o QR con la cámara">
                        <span class="material-symbols-outlined text-[16px]">photo_camera</span>
                        <span class="hidden sm:inline">Escanear</span>
                    </button>

                    <!-- Botón Cerrar (ESC) -->
                    <button type="button" onclick="window.closeUniversalSearch()" class="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition flex items-center justify-center cursor-pointer" title="Cerrar (Esc)">
                        <kbd class="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-100 border border-slate-200 rounded text-slate-600 shadow-2xs">ESC</kbd>
                        <span class="material-symbols-outlined sm:hidden text-lg">close</span>
                    </button>
                </div>

                <!-- Visor de Escáner de Cámara (Oculto por defecto) -->
                <div id="univ-scanner-container" class="hidden relative bg-slate-950 p-4 border-b border-slate-200 flex flex-col items-center justify-center text-white">
                    <video id="univ-scanner-video" class="w-full max-w-sm rounded-xl overflow-hidden shadow-md max-h-48 object-cover border border-slate-700" playsinline></video>
                    <div class="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div class="w-48 h-24 border-2 border-dashed border-emerald-400 rounded-lg animate-pulse"></div>
                    </div>
                    <div class="flex items-center justify-between w-full max-w-sm mt-2 text-xs">
                        <span class="text-slate-300">Apunta el código de barras o MAC</span>
                        <button type="button" onclick="window.stopUniversalScanner()" class="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition">Detener Cámara</button>
                    </div>
                </div>

                <!-- Chips de Categoría -->
                <div class="flex items-center gap-1.5 px-4 py-2 bg-slate-50 border-b border-slate-200 overflow-x-auto scrollbar-none">
                    <button type="button" onclick="window.setUnivSearchCategory('ALL')" class="univ-cat-btn px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap bg-blue-600 text-white shadow-2xs" data-category="ALL">⚡ Todos</button>
                    <button type="button" onclick="window.setUnivSearchCategory('SERIALIZED')" class="univ-cat-btn px-3 py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200" data-category="SERIALIZED">📦 Equipos / ONUs</button>
                    <button type="button" onclick="window.setUnivSearchCategory('CLIENTS')" class="univ-cat-btn px-3 py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200" data-category="CLIENTS">👤 Clientes Wispro</button>
                    <button type="button" onclick="window.setUnivSearchCategory('BULK')" class="univ-cat-btn px-3 py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200" data-category="BULK">🧵 Materiales & Bobinas</button>
                    <button type="button" onclick="window.setUnivSearchCategory('TRANSFERS')" class="univ-cat-btn px-3 py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200" data-category="TRANSFERS">🚚 Traslados</button>
                    <button type="button" onclick="window.setUnivSearchCategory('AUDIT')" class="univ-cat-btn px-3 py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200" data-category="AUDIT">🛡️ Trazabilidad</button>
                </div>

                <!-- Contenedor de Resultados -->
                <div id="univ-search-results" class="flex-1 overflow-y-auto p-4 space-y-4 max-h-[60vh] scrollbar-thin scrollbar-thumb-slate-300">
                    <!-- Estado Inicial -->
                    <div id="univ-search-idle" class="py-10 px-4 text-center">
                        <div class="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center mx-auto mb-3">
                            <span class="material-symbols-outlined text-2xl">search_spark</span>
                        </div>
                        <h4 class="text-sm font-bold text-slate-900">Motor de Búsqueda Universal Velocity</h4>
                        <p class="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                            Escribe al menos 2 caracteres o usa el escáner de cámara. Las direcciones MAC se normalizan automáticamente con o sin dos puntos (ej: <code class="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-mono border border-blue-200 font-bold">E067B3</code>).
                        </p>
                        
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-6 max-w-lg mx-auto text-left">
                            <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                                <span class="font-bold text-blue-700 block mb-0.5">📦 Seriados & ONUs</span>
                                <span class="text-slate-500 text-[11px]">MAC, serial, marca, modelo, ubicación física.</span>
                            </div>
                            <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                                <span class="font-bold text-emerald-700 block mb-0.5">👤 Wispro Cloud</span>
                                <span class="text-slate-500 text-[11px]">Clientes, DNI, dirección, contrato y nodo OLT.</span>
                            </div>
                            <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                                <span class="font-bold text-indigo-700 block mb-0.5">🛡️ Trazabilidad</span>
                                <span class="text-slate-500 text-[11px]">Historial de movimientos e instalaciones.</span>
                            </div>
                        </div>
                    </div>

                    <!-- Loader (Oculto) -->
                    <div id="univ-search-loading" class="py-12 flex flex-col items-center justify-center gap-2 text-slate-500 hidden">
                        <span class="material-symbols-outlined animate-spin text-blue-600 text-3xl">sync</span>
                        <p class="text-xs font-semibold">Buscando en PostgreSQL e indexación Wispro...</p>
                    </div>

                    <!-- Estado Vacío (Oculto) -->
                    <div id="univ-search-empty" class="py-10 text-center text-slate-500 hidden">
                        <span class="material-symbols-outlined text-amber-500 text-4xl mb-2">info</span>
                        <h4 class="text-sm font-bold text-slate-900">No se encontraron resultados</h4>
                        <p class="text-xs text-slate-500 mt-1" id="univ-search-empty-text">No hay registros coincidentes para esta búsqueda.</p>
                    </div>

                    <!-- Listas de Resultados Inyectadas Dinámicamente -->
                    <div id="univ-results-content" class="space-y-4 hidden"></div>
                </div>

                <!-- Barra Inferior de Información y Atajos -->
                <div class="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                    <div class="flex items-center gap-3">
                        <span class="flex items-center gap-1">
                            <kbd class="px-1.5 py-0.5 font-mono bg-white rounded border border-slate-200 text-slate-700 shadow-2xs">Ctrl</kbd>
                            <span>+</span>
                            <kbd class="px-1.5 py-0.5 font-mono bg-white rounded border border-slate-200 text-slate-700 shadow-2xs">K</kbd>
                            <span class="ml-1 hidden sm:inline">abrir / cerrar</span>
                        </span>
                        <span class="hidden md:inline text-slate-300">•</span>
                        <span class="hidden md:flex items-center gap-1">
                            <span class="material-symbols-outlined text-blue-600 text-sm">photo_camera</span>
                            <span>Escáner de código de barras para cámara y móvil</span>
                        </span>
                    </div>

                    <div id="univ-results-count" class="font-bold text-blue-600 hidden">0 coincidencias</div>
                </div>

            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Event Listeners del Modal
        const modal = document.getElementById('velocity-universal-search-modal');
        const input = document.getElementById('univ-search-input');
        const clearBtn = document.getElementById('univ-search-clear-btn');
        const scannerBtn = document.getElementById('univ-scanner-toggle-btn');

        modal.addEventListener('click', (e) => {
            if (e.target === modal) window.closeUniversalSearch();
        });

        input.addEventListener('input', (e) => {
            const val = e.target.value;
            if (val) {
                clearBtn.classList.remove('hidden');
            } else {
                clearBtn.classList.add('hidden');
            }

            if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                window.executeUniversalSearch(val, currentCategory);
            }, 180);
        });

        clearBtn.addEventListener('click', () => {
            input.value = '';
            clearBtn.classList.add('hidden');
            window.executeUniversalSearch('', currentCategory);
            input.focus();
        });

        scannerBtn.addEventListener('click', () => {
            if (isScannerActive) {
                window.stopUniversalScanner();
            } else {
                window.startUniversalScanner();
            }
        });
    }

    // Abrir Modal
    window.openUniversalSearch = function (initialQuery = '') {
        ensureModalDOMElements();
        const modal = document.getElementById('velocity-universal-search-modal');
        const input = document.getElementById('univ-search-input');
        
        modal.classList.remove('hidden');
        isOpen = true;

        if (initialQuery) {
            input.value = initialQuery;
            document.getElementById('univ-search-clear-btn').classList.remove('hidden');
            window.executeUniversalSearch(initialQuery, currentCategory);
        }

        setTimeout(() => {
            input.focus();
            input.select();
        }, 50);
    };

    // Cerrar Modal
    window.closeUniversalSearch = function () {
        const modal = document.getElementById('velocity-universal-search-modal');
        if (modal) modal.classList.add('hidden');
        isOpen = false;
        window.stopUniversalScanner();
    };

    // Cambiar Categoría
    window.setUnivSearchCategory = function (cat) {
        currentCategory = cat;
        document.querySelectorAll('.univ-cat-btn').forEach(btn => {
            if (btn.getAttribute('data-category') === cat) {
                btn.className = 'univ-cat-btn px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap bg-blue-600 text-white shadow-2xs';
            } else {
                btn.className = 'univ-cat-btn px-3 py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200';
            }
        });

        const input = document.getElementById('univ-search-input');
        if (input) {
            window.executeUniversalSearch(input.value, currentCategory);
        }
    };

    // Copiar al Portapapeles con Feedback Visual
    window.copyMacAddress = function (mac, btnElement) {
        if (!mac) return;
        navigator.clipboard.writeText(mac).then(() => {
            if (btnElement) {
                const originalHtml = btnElement.innerHTML;
                btnElement.innerHTML = `<span class="material-symbols-outlined text-emerald-600 text-xs">check</span><span class="text-emerald-700 font-bold">Copiado</span>`;
                setTimeout(() => {
                    btnElement.innerHTML = originalHtml;
                }, 2000);
            }
        });
    };

    // Ejecutar Búsqueda en API
    window.executeUniversalSearch = async function (rawQuery, category = 'ALL') {
        const query = (rawQuery || '').trim();
        const idleEl = document.getElementById('univ-search-idle');
        const loadingEl = document.getElementById('univ-search-loading');
        const emptyEl = document.getElementById('univ-search-empty');
        const contentEl = document.getElementById('univ-results-content');
        const countEl = document.getElementById('univ-results-count');

        if (!query || query.length < 2) {
            idleEl.classList.remove('hidden');
            loadingEl.classList.add('hidden');
            emptyEl.classList.add('hidden');
            contentEl.classList.add('hidden');
            countEl.classList.add('hidden');
            return;
        }

        idleEl.classList.add('hidden');
        emptyEl.classList.add('hidden');
        contentEl.classList.add('hidden');
        loadingEl.classList.remove('hidden');

        try {
            const token = sessionStorage.getItem('Velocity_Token') || localStorage.getItem('Velocity_Token') || localStorage.getItem('token') || '';
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = token;

            // Búsqueda en paralelo: 1. PostgreSQL (Inventario Hub & Spoke) y 2. Wispro Direct Cache
            const [invRes, wisproRes] = await Promise.allSettled([
                fetch(`/inventory-api/search/universal?q=${encodeURIComponent(query)}&category=${category}`, { headers }).then(r => r.json()),
                fetch(`/api/wispro/inventory?search=${encodeURIComponent(query)}&limit=10`, { headers }).then(r => r.json())
            ]);

            let serialized = [];
            let bulk = [];
            let clients = [];
            let transfers = [];
            let audit = [];

            if (invRes.status === 'fulfilled' && invRes.value) {
                serialized = invRes.value.serialized || [];
                bulk = invRes.value.bulk || [];
                clients = invRes.value.clients || [];
                transfers = invRes.value.transfers || [];
                audit = invRes.value.audit || [];
            }

            // Complementar con Wispro Live Cache si hay datos
            if (wisproRes.status === 'fulfilled' && wisproRes.value && Array.isArray(wisproRes.value.data)) {
                const wisproItems = wisproRes.value.data;
                
                // Si la categoría es ALL o SERIALIZED, agregar equipos de Wispro no duplicados
                if (category === 'ALL' || category === 'SERIALIZED') {
                    const existingMacs = new Set(serialized.map(s => normalizeMac(s.macAddress)));
                    wisproItems.forEach(w => {
                        const mac = normalizeMac(w.mac);
                        if (mac && !existingMacs.has(mac)) {
                            existingMacs.add(mac);
                            serialized.push({
                                id: 'w_' + (w.contract_id || mac),
                                macAddress: formatMacWithColons(mac),
                                serialNumber: w.ont_serial_number || w.sn || 'S/N Wispro',
                                status: w.state === 'active' ? 'INSTALADO_CLIENTE' : (w.state || 'EN_SERVICIO'),
                                installedClientName: w.client_name || w.name,
                                installedContractId: w.contract_id,
                                product: {
                                    name: w.model || w.hardware_type || 'ONU / Router GPON',
                                    brand: w.vendor || (mac.startsWith('XPON') ? 'ZTE/XPON' : 'C-Data'),
                                    model: w.ip_address || ''
                                }
                            });
                        }
                    });
                }

                // Si la categoría es ALL o CLIENTS, agregar clientes de Wispro
                if (category === 'ALL' || category === 'CLIENTS') {
                    const existingClients = new Set(clients.map(c => String(c.contractId || c.name)));
                    wisproItems.forEach(w => {
                        const key = String(w.contract_id || w.client_name);
                        if (key && !existingClients.has(key)) {
                            existingClients.add(key);
                            clients.push({
                                id: 'wc_' + key,
                                name: w.client_name || w.name || 'Cliente Wispro',
                                contractId: w.contract_id,
                                status: w.state || 'Activo',
                                address: w.address || w.zone_name || '',
                                currentOnuMac: formatMacWithColons(normalizeMac(w.mac)),
                                nodeName: w.node_name || w.zone_name || 'Nodo Principal'
                            });
                        }
                    });
                }
            }

            const totalResults = serialized.length + bulk.length + clients.length + transfers.length + audit.length;

            loadingEl.classList.add('hidden');

            if (totalResults === 0) {
                document.getElementById('univ-search-empty-text').innerHTML = `No hay registros coincidentes para "<span class="text-slate-900 font-bold">${query}</span>" en la categoría seleccionada.`;
                emptyEl.classList.remove('hidden');
                countEl.classList.add('hidden');
                return;
            }

            countEl.textContent = `${totalResults} coincidencias`;
            countEl.classList.remove('hidden');

            // Renderizar HTML de Resultados
            let html = '';

            // 1. SECCIÓN: EQUIPOS SERIADOS & ONUS
            if (serialized.length > 0) {
                html += `
                <div>
                    <div class="flex items-center justify-between pb-1.5 border-b border-slate-200 text-xs font-bold text-blue-700 uppercase tracking-wider">
                        <span class="flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-[18px]">inventory_2</span>
                            Equipos Seriados & ONUs (${serialized.length})
                        </span>
                    </div>
                    <div class="mt-2 space-y-2">
                        ${serialized.map(item => `
                            <div class="p-3 rounded-xl bg-white hover:bg-blue-50/40 border border-slate-200 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group shadow-2xs">
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 flex-wrap mb-1">
                                        <span class="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition">
                                            ${item.product?.name || 'Equipo GPON / Router'}
                                        </span>
                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${getBadgeStyle(item.status)}">
                                            ${formatStatusText(item.status)}
                                        </span>
                                        ${item.product?.brand ? `
                                            <span class="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                                ${item.product.brand} ${item.product.model || ''}
                                            </span>
                                        ` : ''}
                                    </div>
                                    <div class="flex items-center gap-3 text-xs text-slate-600 font-mono flex-wrap">
                                        <span class="flex items-center gap-1">
                                            <span class="text-slate-400 font-sans">MAC:</span>
                                            <strong class="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 font-bold">${item.macAddress}</strong>
                                        </span>
                                        ${item.serialNumber ? `
                                            <span class="flex items-center gap-1">
                                                <span class="text-slate-400 font-sans">S/N:</span>
                                                <strong class="text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">${item.serialNumber}</strong>
                                            </span>
                                        ` : ''}
                                        ${item.currentWarehouse ? `
                                            <span class="text-slate-500 font-sans">📍 ${item.currentWarehouse.name}</span>
                                        ` : ''}
                                        ${item.installedClientName ? `
                                            <span class="text-emerald-700 font-sans font-semibold">👤 ${item.installedClientName}</span>
                                        ` : ''}
                                    </div>
                                </div>
                                <div class="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                    <button type="button" onclick="window.copyMacAddress('${item.macAddress}', this)" class="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200 transition inline-flex items-center gap-1 cursor-pointer" title="Copiar MAC Address">
                                        <span class="material-symbols-outlined text-xs">content_copy</span>
                                        <span>Copiar MAC</span>
                                    </button>
                                    <button type="button" onclick="window.closeUniversalSearch(); if(typeof window.switchTab === 'function'){ window.switchTab('inventory', 'audit', '${item.macAddress}'); }" class="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition inline-flex items-center gap-1 shadow-2xs cursor-pointer" title="Ver Trazabilidad Forense">
                                        <span class="material-symbols-outlined text-xs">verified_user</span>
                                        <span>Trazabilidad</span>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                `;
            }

            // 2. SECCIÓN: CLIENTES WISPRO
            if (clients.length > 0) {
                html += `
                <div>
                    <div class="flex items-center justify-between pb-1.5 border-b border-slate-200 text-xs font-bold text-emerald-700 uppercase tracking-wider">
                        <span class="flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-[18px]">person_pin_circle</span>
                            Clientes Wispro Cloud (${clients.length})
                        </span>
                    </div>
                    <div class="mt-2 space-y-2">
                        ${clients.map(c => `
                            <div class="p-3 rounded-xl bg-white hover:bg-emerald-50/30 border border-slate-200 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group shadow-2xs">
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 flex-wrap mb-1">
                                        <span class="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition">${c.name}</span>
                                        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">${c.status || 'Activo'}</span>
                                        ${c.contractId ? `<span class="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">Contrato #${c.contractId}</span>` : ''}
                                    </div>
                                    <div class="text-xs text-slate-600 space-y-0.5">
                                        ${c.address ? `<p class="text-slate-500 truncate">📍 ${c.address}</p>` : ''}
                                        <div class="flex items-center gap-3 font-mono text-[11px] text-slate-500 flex-wrap">
                                            ${c.currentOnuMac ? `<span class="text-blue-700 font-bold">ONU MAC: ${c.currentOnuMac}</span>` : ''}
                                            ${c.nodeName ? `<span>Nodo: ${c.nodeName}</span>` : ''}
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                    ${c.currentOnuMac ? `
                                        <button type="button" onclick="window.copyMacAddress('${c.currentOnuMac}', this)" class="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-blue-700 text-[11px] font-medium border border-slate-200 transition inline-flex items-center gap-1 cursor-pointer">
                                            <span class="material-symbols-outlined text-xs">content_copy</span>
                                            <span>Copiar MAC</span>
                                        </button>
                                    ` : ''}
                                    <button type="button" onclick="window.closeUniversalSearch(); if(typeof window.openWisproClientModal === 'function'){ window.openWisproClientModal('${c.contractId || c.name}'); }" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition inline-flex items-center gap-1 shadow-2xs cursor-pointer">
                                        <span class="material-symbols-outlined text-xs">open_in_new</span>
                                        <span>Ver Ficha</span>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                `;
            }

            // 3. SECCIÓN: MATERIALES & BOBINAS
            if (bulk.length > 0) {
                html += `
                <div>
                    <div class="flex items-center justify-between pb-1.5 border-b border-slate-200 text-xs font-bold text-amber-700 uppercase tracking-wider">
                        <span class="flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-[18px]">layers</span>
                            Materiales & Bobinas (${bulk.length})
                        </span>
                    </div>
                    <div class="mt-2 space-y-2">
                        ${bulk.map(b => `
                            <div class="p-3 rounded-xl bg-white hover:bg-amber-50/30 border border-slate-200 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                                <div>
                                    <div class="flex items-center gap-2 mb-1">
                                        <span class="text-sm font-bold text-slate-900">${b.product?.name || 'Material'}</span>
                                        ${b.product?.sku ? `<span class="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">SKU: ${b.product.sku}</span>` : ''}
                                    </div>
                                    <p class="text-xs text-slate-500">Bodega: <strong class="text-slate-800">${b.warehouse?.name || 'Principal'}</strong></p>
                                </div>
                                <div class="text-right">
                                    <span class="text-sm font-bold font-mono text-amber-700">${b.quantity || 0} ${b.product?.unitOfMeasure || 'uds'}</span>
                                    <span class="block text-[10px] text-slate-400">Stock Actual</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                `;
            }

            // 4. SECCIÓN: TRASLADOS
            if (transfers.length > 0) {
                html += `
                <div>
                    <div class="flex items-center justify-between pb-1.5 border-b border-slate-200 text-xs font-bold text-indigo-700 uppercase tracking-wider">
                        <span class="flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-[18px]">local_shipping</span>
                            Órdenes de Traslado (${transfers.length})
                        </span>
                    </div>
                    <div class="mt-2 space-y-2">
                        ${transfers.map(t => `
                            <div class="p-3 rounded-xl bg-white hover:bg-indigo-50/30 border border-slate-200 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                                <div>
                                    <div class="flex items-center gap-2 mb-1">
                                        <span class="text-xs font-mono font-bold text-indigo-700">${t.orderNumber}</span>
                                        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">${t.status}</span>
                                    </div>
                                    <div class="text-xs text-slate-600 flex items-center gap-1.5">
                                        <span>${t.sourceWarehouse?.name || 'Origen'}</span>
                                        <span class="material-symbols-outlined text-xs text-slate-400">arrow_forward</span>
                                        <strong class="text-slate-900">${t.destinationWarehouse?.name || 'Destino'}</strong>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                `;
            }

            // 5. SECCIÓN: TRAZABILIDAD FORENSE
            if (audit.length > 0) {
                html += `
                <div>
                    <div class="flex items-center justify-between pb-1.5 border-b border-slate-200 text-xs font-bold text-rose-700 uppercase tracking-wider">
                        <span class="flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-[18px]">verified_user</span>
                            Trazabilidad Forense (${audit.length})
                        </span>
                    </div>
                    <div class="mt-2 space-y-2">
                        ${audit.map(log => `
                            <div class="p-3 rounded-xl bg-white hover:bg-rose-50/30 border border-slate-200 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 mb-1">
                                        <span class="text-[11px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">${log.eventType || log.action || 'EVENTO'}</span>
                                        ${log.macAddress ? `<span class="text-xs font-mono text-blue-700 font-bold">${log.macAddress}</span>` : ''}
                                        <span class="text-[11px] text-slate-400 ml-auto sm:ml-0">${new Date(log.timestamp).toLocaleString()}</span>
                                    </div>
                                    <p class="text-xs text-slate-600 truncate">${log.details || 'Movimiento de inventario registrado'}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                `;
            }

            contentEl.innerHTML = html;
            contentEl.classList.remove('hidden');

        } catch (err) {
            console.error('[UniversalSearch] Error ejecutando búsqueda:', err);
            loadingEl.classList.add('hidden');
            emptyEl.classList.remove('hidden');
            document.getElementById('univ-search-empty-text').textContent = 'Error de conexión al consultar la base de datos.';
        }
    };

    function getBadgeStyle(status) {
        const s = String(status || '').toUpperCase();
        if (s.includes('BODEGA')) return 'bg-blue-50 text-blue-700 border border-blue-200';
        if (s.includes('CLIENTE') || s.includes('INSTALADO') || s.includes('ACTIVO')) return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
        if (s.includes('VEHICULO') || s.includes('TRANSITO')) return 'bg-amber-50 text-amber-700 border border-amber-200';
        if (s.includes('RMA') || s.includes('DEFECT') || s.includes('BAJA')) return 'bg-rose-50 text-rose-700 border border-rose-200';
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }

    function formatStatusText(status) {
        const s = String(status || '').toUpperCase();
        if (s.includes('BODEGA')) return 'EN BODEGA';
        if (s.includes('CLIENTE') || s.includes('INSTALADO')) return 'INSTALADO CLIENTE';
        if (s.includes('VEHICULO') || s.includes('TRANSITO')) return 'EN VEHÍCULO';
        if (s.includes('RMA') || s.includes('DEFECT')) return 'RMA / DEFECTO';
        return status || 'DISPONIBLE';
    }

    // Escáner de Código de Barras con Cámara
    window.startUniversalScanner = async function () {
        const container = document.getElementById('univ-scanner-container');
        const video = document.getElementById('univ-scanner-video');
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Tu navegador no soporta acceso directo a la cámara para escaneo de código de barras.');
            return;
        }

        try {
            videoStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            video.srcObject = videoStream;
            video.play();
            container.classList.remove('hidden');
            isScannerActive = true;

            // Detección nativa con BarcodeDetector si está disponible en Chrome/Edge móvil
            if ('BarcodeDetector' in window) {
                const detector = new window.BarcodeDetector({ formats: ['code_128', 'qr_code', 'ean_13', 'code_39', 'data_matrix'] });
                const scanInterval = setInterval(async () => {
                    if (!isScannerActive) {
                        clearInterval(scanInterval);
                        return;
                    }
                    try {
                        const barcodes = await detector.detect(video);
                        if (barcodes.length > 0) {
                            const raw = barcodes[0].rawValue;
                            clearInterval(scanInterval);
                            window.stopUniversalScanner();
                            const input = document.getElementById('univ-search-input');
                            if (input) {
                                input.value = raw;
                                document.getElementById('univ-search-clear-btn').classList.remove('hidden');
                                window.executeUniversalSearch(raw, currentCategory);
                            }
                        }
                    } catch (e) {}
                }, 300);
            }
        } catch (err) {
            console.warn('[UniversalSearch] No se pudo acceder a la cámara:', err);
            alert('No se pudo acceder a la cámara. Revisa los permisos de tu navegador.');
        }
    };

    window.stopUniversalScanner = function () {
        const container = document.getElementById('univ-scanner-container');
        if (container) container.classList.add('hidden');
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
            videoStream = null;
        }
        isScannerActive = false;
    };

    // Atajo Global Ctrl+K / Cmd+K y Escape
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (isOpen) {
                window.closeUniversalSearch();
            } else {
                window.openUniversalSearch();
            }
        } else if (e.key === 'Escape' && isOpen) {
            window.closeUniversalSearch();
        }
    });

    // Inicializar al cargar el DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureModalDOMElements);
    } else {
        ensureModalDOMElements();
    }
})();
