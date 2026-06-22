Views.inventory = () => {
    // 1. Obtener clientes combinados (clientes reales + simulados)
    const dbSync = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    const clientsCache = dbSync.clients_cache || [];
    
    // Obtener contratos y órdenes para extraer clientes si no están en caché
    const allOrders = [...(state.orders || []), ...(state.finishedOrders || [])];
    const clientMap = new Map();

    // Poblar mapa de clientes
    clientsCache.forEach(c => {
        if (c.id) {
            clientMap.set(String(c.id), {
                id: c.id,
                name: c.name || 'Cliente sin nombre',
                zone: c.zone_name || c.address_city || 'Sin Zona',
                phone: c.phone_mobile || c.phone || '—',
                onn: false,
                playtv: false,
                camara: false,
                extensor: false
            });
        }
    });

    // Si dbSync.clients_cache está vacío, poblar desde state.clients
    if (clientMap.size === 0 && state.clients) {
        Object.entries(state.clients).forEach(([id, c]) => {
            if (id && c.name) {
                clientMap.set(String(id), {
                    id: id,
                    name: c.name,
                    zone: c.zone || 'Sin Zona',
                    phone: c.phone || '—',
                    onn: false,
                    playtv: false,
                    camara: false,
                    extensor: false
                });
            }
        });
    }

    // Agregar de órdenes del día si no existen en el mapa
    allOrders.forEach(o => {
        const cid = o.clientId || o.client_id;
        if (cid && !clientMap.has(String(cid))) {
            clientMap.set(String(cid), {
                id: cid,
                name: o.client || 'Cliente sin nombre',
                zone: o.zone || 'Sin Zona',
                phone: o.phone || '—',
                onn: false,
                playtv: false,
                camara: false,
                extensor: false
            });
        }
    });

    // Inicializar o cargar inventario guardado por cliente desde dbSync
    if (!dbSync.client_inventory) {
        dbSync.client_inventory = {};
    }

    // Lógica para auto-detectar desde notas técnicas de Wispro si la orden finalizada contiene texto descriptivo
    allOrders.forEach(o => {
        const cid = o.clientId || o.client_id;
        if (cid) {
            const clientInv = dbSync.client_inventory[cid] || { onn: false, playtv: false, camara: false, extensor: false };
            const desc = (o.description || '').toLowerCase();
            const comment = (o.comments || '').toLowerCase();
            const textToInspect = desc + ' ' + comment;

            if (textToInspect.includes('onn')) clientInv.onn = true;
            if (textToInspect.includes('playtv') || textToInspect.includes('play tv')) clientInv.playtv = true;
            if (textToInspect.includes('camara') || textToInspect.includes('cámara')) clientInv.camara = true;
            if (textToInspect.includes('extensor') || textToInspect.includes('repetidor')) clientInv.extensor = true;

            dbSync.client_inventory[cid] = clientInv;
        }
    });

    // Aplicar valores guardados a la lista en memoria
    const clientList = Array.from(clientMap.values()).map(c => {
        const saved = dbSync.client_inventory[c.id] || { onn: false, playtv: false, camara: false, extensor: false };
        return {
            ...c,
            onn: saved.onn,
            playtv: saved.playtv,
            camara: saved.camara,
            extensor: saved.extensor
        };
    });

    // 2. Calcular Totales para KPIs
    let totalOnn = 0;
    let totalPlaytv = 0;
    let totalCamara = 0;
    let totalExtensor = 0;

    clientList.forEach(c => {
        if (c.onn) totalOnn++;
        if (c.playtv) totalPlaytv++;
        if (c.camara) totalCamara++;
        if (c.extensor) totalExtensor++;
    });

    // 3. Aplicar Filtro y Búsqueda
    let filtered = [...clientList];
    const search = (state.orderSearch || '').toLowerCase().trim();
    if (search) {
        filtered = filtered.filter(c => 
            c.name.toLowerCase().includes(search) ||
            c.zone.toLowerCase().includes(search) ||
            String(c.id).includes(search)
        );
    }

    // 4. Renderizado de filas
    const rows = filtered.map(c => {
        return `
        <tr class="border-b border-surface-container-high/50 hover:bg-surface-container-low/30 transition-colors">
            <td class="p-4">
                <div class="font-bold text-on-surface text-sm">${c.name}</div>
                <div class="text-[10px] font-semibold text-on-surface-variant/60">ID: ${c.id.slice(0, 8)}...</div>
            </td>
            <td class="p-4 text-xs font-bold text-on-surface-variant">${c.zone}</td>
            <td class="p-4 text-xs text-on-surface-variant">${c.phone}</td>
            <td class="p-4 text-center">
                <input type="checkbox" ${c.onn ? 'checked' : ''} 
                    onchange="window.toggleClientEquipment('${c.id}', 'onn', this.checked)"
                    class="w-5 h-5 accent-secondary cursor-pointer rounded">
            </td>
            <td class="p-4 text-center">
                <input type="checkbox" ${c.playtv ? 'checked' : ''} 
                    onchange="window.toggleClientEquipment('${c.id}', 'playtv', this.checked)"
                    class="w-5 h-5 accent-secondary cursor-pointer rounded">
            </td>
            <td class="p-4 text-center">
                <input type="checkbox" ${c.camara ? 'checked' : ''} 
                    onchange="window.toggleClientEquipment('${c.id}', 'camara', this.checked)"
                    class="w-5 h-5 accent-secondary cursor-pointer rounded">
            </td>
            <td class="p-4 text-center">
                <input type="checkbox" ${c.extensor ? 'checked' : ''} 
                    onchange="window.toggleClientEquipment('${c.id}', 'extensor', this.checked)"
                    class="w-5 h-5 accent-secondary cursor-pointer rounded">
            </td>
        </tr>`;
    }).join('');

    state.lastFilteredInventory = filtered;

    return `
    <div class="space-y-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h2 class="text-2xl font-black text-on-surface tracking-tight">Control de Equipamiento</h2>
                <p class="text-xs text-on-surface-variant font-semibold mt-1">Gestión de dispositivos ONN, PlayTV+, Cámaras y Extensores por cliente</p>
            </div>
            <div class="flex items-center gap-3">
                <button onclick="window.exportInventoryToCSV()" class="flex items-center gap-2 border border-outline-variant/30 text-on-surface-variant px-4 py-2 rounded-2xl text-xs font-bold hover:bg-surface-container transition-all active:scale-95">
                    <span class="material-symbols-outlined text-[18px]">download</span> Exportar CSV
                </button>
                <button onclick="window.exportInventoryToPDF()" class="bg-primary text-white hover:opacity-90 px-4 py-2 rounded-2xl text-xs font-black flex items-center gap-2 active:scale-95 transition-all shadow-md">
                    <span class="material-symbols-outlined text-[18px]">print</span> Exportar PDF
                </button>
            </div>
        </div>

        <!-- KPIs Cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-surface-container-lowest border border-outline-variant/20 p-5 rounded-3xl flex items-center gap-4 relative overflow-hidden">
                <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                    <span class="material-symbols-outlined text-2xl font-bold">tv</span>
                </div>
                <div>
                    <p class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Dispositivos ONN</p>
                    <h4 class="text-2xl font-black text-primary">${totalOnn}</h4>
                    <p class="text-[10px] text-on-surface-variant/60 font-bold">Entregados en campo</p>
                </div>
            </div>
            <div class="bg-surface-container-lowest border border-outline-variant/20 p-5 rounded-3xl flex items-center gap-4 relative overflow-hidden">
                <div class="w-12 h-12 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center shadow-inner">
                    <span class="material-symbols-outlined text-2xl font-bold">smart_display</span>
                </div>
                <div>
                    <p class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">App PlayTV+</p>
                    <h4 class="text-2xl font-black text-secondary">${totalPlaytv}</h4>
                    <p class="text-[10px] text-on-surface-variant/60 font-bold">Cuentas activas</p>
                </div>
            </div>
            <div class="bg-surface-container-lowest border border-outline-variant/20 p-5 rounded-3xl flex items-center gap-4 relative overflow-hidden">
                <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shadow-inner">
                    <span class="material-symbols-outlined text-2xl font-bold">videocam</span>
                </div>
                <div>
                    <p class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Cámaras</p>
                    <h4 class="text-2xl font-black text-emerald-600">${totalCamara}</h4>
                    <p class="text-[10px] text-on-surface-variant/60 font-bold">Instaladas</p>
                </div>
            </div>
            <div class="bg-surface-container-lowest border border-outline-variant/20 p-5 rounded-3xl flex items-center gap-4 relative overflow-hidden">
                <div class="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shadow-inner">
                    <span class="material-symbols-outlined text-2xl font-bold">router</span>
                </div>
                <div>
                    <p class="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Extensores</p>
                    <h4 class="text-2xl font-black text-amber-600">${totalExtensor}</h4>
                    <p class="text-[10px] text-on-surface-variant/60 font-bold">Repetidores provistos</p>
                </div>
            </div>
        </div>

        <!-- Filtros y Búsqueda -->
        <div class="relative group max-w-md">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-secondary transition-colors text-lg">search</span>
            <input type="text" 
                id="inventory-search-input"
                placeholder="Buscar por cliente, zona... (Enter)" 
                value="${state.orderSearch || ''}"
                onkeydown="if(event.key === 'Enter') { window.setOrderSearch(this.value); }"
                class="w-full bg-surface-container-lowest border border-outline-variant/25 focus:border-secondary focus:ring-2 focus:ring-secondary/5 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold outline-none transition-all shadow-sm placeholder:text-on-surface-variant/40"
            >
            ${state.orderSearch ? `
                <button onclick="window.setOrderSearch('');" class="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant/60">
                    <span class="material-symbols-outlined text-sm">close</span>
                </button>
            ` : ''}
        </div>

        <!-- Tabla de Equipos -->
        <div class="bg-surface-container-lowest border border-outline-variant/15 rounded-3xl overflow-hidden">
            <table class="w-full border-collapse">
                <thead>
                    <tr class="bg-surface-container-low/50 text-left border-b border-outline-variant/10">
                        <th class="p-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Cliente</th>
                        <th class="p-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Zona</th>
                        <th class="p-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Teléfono</th>
                        <th class="p-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest text-center">ONN</th>
                        <th class="p-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest text-center">PlayTV+</th>
                        <th class="p-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest text-center">Cámara</th>
                        <th class="p-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest text-center">Extensor</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-surface-container-high/30">
                    ${rows || `<tr><td colspan="7" class="p-12 text-center text-on-surface-variant/40"><span class="material-symbols-outlined text-4xl mb-2">inbox</span><p class="font-bold text-sm uppercase">Sin clientes encontrados</p></td></tr>`}
                </tbody>
            </table>
        </div>
    </div>`;
};

window.toggleClientEquipment = function(clientId, equipmentKey, isChecked) {
    const dbSync = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    if (!dbSync.client_inventory) {
        dbSync.client_inventory = {};
    }
    if (!dbSync.client_inventory[clientId]) {
        dbSync.client_inventory[clientId] = { onn: false, playtv: false, camara: false, extensor: false };
    }
    
    dbSync.client_inventory[clientId][equipmentKey] = isChecked;
    localStorage.setItem('Velocity_Sync_State', JSON.stringify(dbSync));
    serverPush(dbSync);
    
    renderTab('inventory');
};

window.exportInventoryToCSV = function() {
    const list = state.lastFilteredInventory || [];
    if (!list.length) {
        alert('No hay datos para exportar.');
        return;
    }
    const headers = ['Cliente', 'Zona', 'Telefono', 'ONN', 'PlayTV+', 'Camara', 'Extensor'];
    const rows = list.map(c => [
        c.name || '',
        c.zone || '',
        c.phone || '',
        c.onn ? 'SI' : 'NO',
        c.playtv ? 'SI' : 'NO',
        c.camara ? 'SI' : 'NO',
        c.extensor ? 'SI' : 'NO'
    ]);
    
    let csvContent = '\uFEFF';
    csvContent += [headers.join(','), ...rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `reporte_equipamiento_${new Date().toLocaleDateString('en-CA')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.exportInventoryToPDF = async function() {
    const list = state.lastFilteredInventory || [];
    if (!list.length) {
        alert('No hay datos para exportar.');
        return;
    }

    if (window.showLoadingOverlay) window.showLoadingOverlay('Generando PDF...');

    try {
        const { PDFDocument, rgb, StandardFonts } = PDFLib;
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

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
            
            currentPage.drawText("Reporte de Equipamiento Entregado", { x: 30, y: 560, size: 20, font: fontBold, color: rgb(0, 0.35, 0.73) });
            currentPage.drawText("Velocity Dashboard - Auditoría de Equipos y Aplicaciones", { x: 30, y: 540, size: 10, font: font, color: rgb(0.4, 0.4, 0.4) });
            
            const dateStr = new Date().toLocaleString();
            currentPage.drawText(`Fecha de Emisión: ${dateStr}`, { x: 500, y: 560, size: 9, font: font, color: rgb(0.4, 0.4, 0.4) });
            currentPage.drawText(`Total Registros: ${list.length}`, { x: 500, y: 545, size: 9, font: font, color: rgb(0.4, 0.4, 0.4) });

            currentY = 500;
            drawHeaderRow();
        };

        const drawHeaderRow = () => {
            const headers = [
                { text: 'Cliente', x: 30, w: 220 },
                { text: 'Zona', x: 260, w: 120 },
                { text: 'Teléfono', x: 390, w: 100 },
                { text: 'ONN', x: 500, w: 50 },
                { text: 'PlayTV+', x: 560, w: 50 },
                { text: 'Cámara', x: 620, w: 50 },
                { text: 'Extensor', x: 680, w: 50 }
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

        for (const c of list) {
            const rowHeight = 25;

            if (currentY - rowHeight < 40) {
                createNewPage();
            }

            currentPage.drawRectangle({
                x: 30,
                y: currentY - rowHeight + 5,
                width: 730,
                height: rowHeight,
                color: rgb(1, 1, 1)
            });

            currentPage.drawLine({
                start: { x: 30, y: currentY - rowHeight + 5 },
                end: { x: 760, y: currentY - rowHeight + 5 },
                thickness: 0.5,
                color: rgb(0.9, 0.9, 0.9)
            });

            const nameText = cleanText(c.name || '—');
            const nameLines = wrapText(nameText, 210, 8);
            nameLines.forEach((line, idx) => {
                currentPage.drawText(line, { x: 35, y: currentY - 5 - (idx * 9), size: 8, font: fontBold });
            });

            currentPage.drawText(cleanText(c.zone || '—'), { x: 265, y: currentY - 5, size: 8, font: font });
            currentPage.drawText(cleanText(c.phone || '—'), { x: 395, y: currentY - 5, size: 8, font: font });

            currentPage.drawText(c.onn ? 'SI' : 'NO', { x: 505, y: currentY - 5, size: 8, font: fontBold, color: c.onn ? rgb(0, 0.5, 0) : rgb(0.7, 0.7, 0.7) });
            currentPage.drawText(c.playtv ? 'SI' : 'NO', { x: 565, y: currentY - 5, size: 8, font: fontBold, color: c.playtv ? rgb(0, 0.5, 0) : rgb(0.7, 0.7, 0.7) });
            currentPage.drawText(c.camara ? 'SI' : 'NO', { x: 625, y: currentY - 5, size: 8, font: fontBold, color: c.camara ? rgb(0, 0.5, 0) : rgb(0.7, 0.7, 0.7) });
            currentPage.drawText(c.extensor ? 'SI' : 'NO', { x: 685, y: currentY - 5, size: 8, font: fontBold, color: c.extensor ? rgb(0, 0.5, 0) : rgb(0.7, 0.7, 0.7) });

            currentY -= rowHeight;
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `reporte_equipamiento_${new Date().toLocaleDateString('en-CA')}.pdf`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error("Error generating Equipment PDF:", error);
        alert("Ocurrió un error al generar el PDF.");
    } finally {
        if (window.hideLoadingOverlay) window.hideLoadingOverlay();
    }
};
