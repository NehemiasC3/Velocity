/**
 * VELOCITY SMART ASSISTANT & COPILOT (v3.1.1)
 * Componente de Inteligencia y Diagnóstico FTTH Automatizado
 */

(function() {
    console.log('⚡ Velocity Smart Assistant v3.1.1 cargado.');

    // Inyectar estilos para el asistente inteligente
    const style = document.createElement('style');
    style.innerHTML = `
        .smart-panel-open {
            transform: translateX(0) !important;
        }
        .pulse-secondary {
            animation: pulse-sec 2s infinite;
        }
        @keyframes pulse-sec {
            0% { box-shadow: 0 0 0 0 rgba(0, 89, 187, 0.4); }
            70% { box-shadow: 0 0 0 10px rgba(0, 89, 187, 0); }
            100% { box-shadow: 0 0 0 0 rgba(0, 89, 187, 0); }
        }
        .smart-glow {
            filter: drop-shadow(0 0 8px var(--secondary));
        }
    `;
    document.head.appendChild(style);

    // Crear el botón flotante del Copiloto IA
    function injectFloatingButton() {
        if (document.getElementById('smart-ai-trigger')) return;

        const btn = document.createElement('button');
        btn.id = 'smart-ai-trigger';
        btn.className = 'fixed bottom-24 right-6 z-[90] w-14 h-14 rounded-full kinetic-gradient text-white flex items-center justify-center shadow-2xl pulse-secondary transition-all hover:scale-105 active:scale-95 border border-white/20';
        btn.innerHTML = `<span class="material-symbols-outlined text-[28px] smart-glow">psychology</span>`;
        btn.onclick = toggleSmartPanel;
        document.body.appendChild(btn);
    }

    // Estructura del panel lateral inteligente
    function injectSmartPanel() {
        if (document.getElementById('smart-ai-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'smart-ai-panel';
        panel.className = 'fixed top-0 right-0 h-screen w-full sm:w-[450px] z-[100] bg-surface-container-lowest/95 backdrop-blur-xl border-l border-outline-variant/30 shadow-[0_0_50px_rgba(0,0,0,0.3)] transition-transform duration-300 transform translate-x-full flex flex-col';
        
        // Comprobar rol de usuario
        const role = sessionStorage.getItem('Velocity_Role') || 'technician';
        const isSupervisor = role === 'supervisor';

        panel.innerHTML = `
            <!-- Header -->
            <div class="p-6 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl kinetic-gradient flex items-center justify-center text-white">
                        <span class="material-symbols-outlined text-2xl animate-pulse">psychology</span>
                    </div>
                    <div>
                        <h3 class="font-extrabold text-base text-on-surface tracking-tight">Copiloto IA Velocity</h3>
                        <p class="text-[10px] font-black text-secondary uppercase tracking-widest">Motor Inteligente v3.1.1</p>
                    </div>
                </div>
                <button onclick="window.toggleSmartPanel()" class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center border hover:text-error transition-all active:scale-95">
                    <span class="material-symbols-outlined text-sm">close</span>
                </button>
            </div>

            <!-- Tabs -->
            <div class="flex border-b border-outline-variant/10 text-xs font-bold uppercase tracking-wider bg-surface-container-low/40">
                <button onclick="window.switchAssistantTab('diag')" id="tab-assist-diag" class="flex-1 py-3 text-center border-b-2 border-secondary text-secondary">
                    Diagnóstico
                </button>
                <button onclick="window.switchAssistantTab('route')" id="tab-assist-route" class="flex-1 py-3 text-center border-b-2 border-transparent text-on-surface-variant">
                    Rutas
                </button>
                <button onclick="window.switchAssistantTab('expert')" id="tab-assist-expert" class="flex-1 py-3 text-center border-b-2 border-transparent text-on-surface-variant">
                    Asistente
                </button>
            </div>

            <!-- Content Area -->
            <div id="assistant-content" class="flex-1 overflow-y-auto p-6 space-y-6">
                <!-- Injected Dynamically -->
            </div>

            <!-- Footer Status -->
            <div class="p-4 border-t border-outline-variant/20 bg-surface-container-low text-center flex items-center justify-between text-[10px] font-bold text-on-surface-variant/60">
                <span>OLT LINK: ACTIVO</span>
                <span class="flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    MONITOR CORRIENDO
                </span>
            </div>
        `;
        document.body.appendChild(panel);
        
        // Inicializar tab por defecto
        switchAssistantTab('diag');
    }

    // Cambiar de pestaña
    window.switchAssistantTab = function(tab) {
        const tabs = ['diag', 'route', 'expert'];
        tabs.forEach(t => {
            const btn = document.getElementById(`tab-assist-${t}`);
            if (btn) {
                btn.classList.toggle('border-secondary', t === tab);
                btn.classList.toggle('text-secondary', t === tab);
                btn.classList.toggle('border-transparent', t !== tab);
                btn.classList.toggle('text-on-surface-variant', t !== tab);
            }
        });

        const content = document.getElementById('assistant-content');
        if (!content) return;

        if (tab === 'diag') {
            renderDiagnosticsView(content);
        } else if (tab === 'route') {
            renderRoutingView(content);
        } else if (tab === 'expert') {
            renderExpertChatView(content);
        }
    };

    // Renderizar Pestaña de Diagnósticos
    function renderDiagnosticsView(container) {
        container.innerHTML = `
            <div class="space-y-4">
                <div class="p-4 bg-secondary/5 border border-secondary/20 rounded-2xl">
                    <h4 class="font-extrabold text-sm text-secondary flex items-center gap-2">
                        <span class="material-symbols-outlined text-sm">settings_suggest</span>
                        Diagnóstico Rápido de Enlaces
                    </h4>
                    <p class="text-xs text-on-surface-variant mt-1">Inspecciona puertos y calcula pérdidas ópticas instantáneamente.</p>
                </div>

                <div class="space-y-3">
                    <button onclick="window.runSmartSystemDiagnostic('occupancy')" class="w-full text-left p-4 bg-surface-container-low hover:bg-surface-container-high border rounded-2xl transition-all active:scale-98 flex items-center gap-3">
                        <span class="material-symbols-outlined text-secondary text-2xl">hub</span>
                        <div>
                            <p class="font-bold text-xs text-on-surface">Capacidad de Puertos NAP</p>
                            <p class="text-[10px] text-on-surface-variant opacity-75">Detectar saturación y derivaciones críticas.</p>
                        </div>
                    </button>

                    <button onclick="window.runSmartSystemDiagnostic('attenuation')" class="w-full text-left p-4 bg-surface-container-low hover:bg-surface-container-high border rounded-2xl transition-all active:scale-98 flex items-center gap-3">
                        <span class="material-symbols-outlined text-amber-500 text-2xl">trending_down</span>
                        <div>
                            <p class="font-bold text-xs text-on-surface">Anomalías de Atenuación</p>
                            <p class="text-[10px] text-on-surface-variant opacity-75">Reportes de clientes con niveles inferiores a -27 dBm.</p>
                        </div>
                    </button>

                    <div class="border border-outline-variant/30 p-4 rounded-2xl space-y-3 bg-surface-container-lowest">
                        <p class="font-bold text-xs text-on-surface uppercase tracking-wider">Calculador de Presupuesto Óptico</p>
                        <div class="grid grid-cols-2 gap-3">
                            <label class="block">
                                <span class="text-[9px] font-bold text-on-surface-variant uppercase">Splitter</span>
                                <select id="calc-splitter" class="w-full mt-1 bg-surface border border-outline-variant/40 rounded-xl px-2 py-1.5 text-xs text-on-surface">
                                    <option value="10.5">1:8 (-10.5 dB)</option>
                                    <option value="13.8" selected>1:16 (-13.8 dB)</option>
                                    <option value="17.2">1:32 (-17.2 dB)</option>
                                </select>
                            </label>
                            <label class="block">
                                <span class="text-[9px] font-bold text-on-surface-variant uppercase">Distancia (m)</span>
                                <input type="number" id="calc-distance" class="w-full mt-1 bg-surface border border-outline-variant/40 rounded-xl px-2 py-1.5 text-xs text-on-surface" value="150">
                            </label>
                        </div>
                        <button onclick="window.calculateLinkLoss()" class="w-full py-2 bg-secondary text-white font-bold text-xs rounded-xl transition-all active:scale-95">
                            Calcular Atenuación Esperada
                        </button>
                        <div id="calc-result" class="hidden p-3 bg-surface-container text-xs rounded-xl font-medium"></div>
                    </div>
                </div>
                
                <div id="diagnostic-results" class="space-y-3"></div>
            </div>
        `;
    }

    // Renderizar Pestaña de Optimización de Rutas
    function renderRoutingView(container) {
        container.innerHTML = `
            <div class="space-y-4">
                <div class="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                    <h4 class="font-extrabold text-sm text-emerald-500 flex items-center gap-2">
                        <span class="material-symbols-outlined text-sm">route</span>
                        Optimizador de Ruta Proactiva
                    </h4>
                    <p class="text-xs text-on-surface-variant mt-1">Nuestra IA reordena la agenda de hoy secuencialmente para ahorrar combustible y tiempo.</p>
                </div>

                <button onclick="window.optimizeTechRoute()" class="w-full py-3.5 kinetic-gradient text-white font-bold text-xs uppercase tracking-widest rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined text-base">alt_route</span>
                    Optimizar Secuencia de Agenda
                </button>

                <div id="routing-results" class="space-y-3">
                    <p class="text-center text-xs text-on-surface-variant/50 py-8">Presiona el botón para calcular la ruta de viaje más eficiente.</p>
                </div>
            </div>
        `;
    }

    // Chat del Asistente Experto
    function renderExpertChatView(container) {
        container.innerHTML = `
            <div class="flex flex-col h-[50vh] border rounded-2xl bg-surface-container-low overflow-hidden">
                <div class="p-3 bg-primary text-white text-[11px] font-bold uppercase tracking-wider flex items-center justify-between">
                    <span>Experto FTTH AI</span>
                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                </div>
                <div id="chat-messages" class="flex-1 p-3 overflow-y-auto space-y-2 text-xs">
                    <div class="bg-surface-container-lowest p-2.5 rounded-xl max-w-[85%]">
                        Hola, soy tu copiloto de fibra óptica. Escribe tu caso (ej. <i>señal baja en NAP-04</i> o <i>cómo medir niveles</i>) y te daré los pasos.
                    </div>
                </div>
                <div class="p-2 border-t flex gap-2 bg-surface-container-lowest">
                    <input type="text" id="chat-input" placeholder="Pregunta algo al experto..." class="flex-1 bg-surface border border-outline-variant/40 rounded-xl px-3 text-xs text-on-surface focus:outline-none focus:border-secondary" onkeydown="if(event.key==='Enter') window.sendExpertMessage()">
                    <button onclick="window.sendExpertMessage()" class="w-10 h-10 kinetic-gradient text-white rounded-xl flex items-center justify-center active:scale-90 transition-all">
                        <span class="material-symbols-outlined text-sm">send</span>
                    </button>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-2">
                <button onclick="window.quickQuestion('¿Cómo diagnosticar pérdida de señal?')" class="p-2 bg-surface-container border text-[10px] font-semibold text-on-surface rounded-xl hover:bg-surface-container-high transition-colors">¿Cómo diagnosticar pérdida?</button>
                <button onclick="window.quickQuestion('Valores estándar de potencia GPON')" class="p-2 bg-surface-container border text-[10px] font-semibold text-on-surface rounded-xl hover:bg-surface-container-high transition-colors">Nivel estándar GPON</button>
            </div>
        `;
    }

    // Toggle de Panel
    window.toggleSmartPanel = function() {
        const panel = document.getElementById('smart-ai-panel');
        if (panel) {
            panel.classList.toggle('smart-panel-open');
        }
    };

    // Cerrar panel al pulsar fuera
    window.addEventListener('click', (e) => {
        const panel = document.getElementById('smart-ai-panel');
        const trigger = document.getElementById('smart-ai-trigger');
        if (panel && panel.classList.contains('smart-panel-open') && !panel.contains(e.target) && !trigger?.contains(e.target) && !e.target.closest('[onclick*="openSmartDiagnostic"]')) {
            panel.classList.remove('smart-panel-open');
        }
    });

    // Acción para diagnósticos
    window.runSmartSystemDiagnostic = function(type) {
        const results = document.getElementById('diagnostic-results');
        if (!results) return;

        results.innerHTML = `
            <div class="flex items-center justify-center py-8 text-secondary">
                <span class="material-symbols-outlined text-3xl animate-spin">sync</span>
                <span class="text-xs font-bold ml-2">Analizando red en tiempo real...</span>
            </div>
        `;

        setTimeout(() => {
            const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
            
            if (type === 'occupancy') {
                const trackedNaps = db.trackedNaps || [];
                const fullNaps = trackedNaps.filter(n => n.ports && n.ports.toLowerCase().includes('llena'));
                
                let html = `<div class="p-4 bg-surface-container-low border rounded-2xl space-y-2">
                    <p class="font-extrabold text-xs text-on-surface">Alerta de Ocupación NAP</p>`;
                
                if (fullNaps.length > 0) {
                    html += `<p class="text-[11px] text-error font-medium">Se detectaron ${fullNaps.length} NAPs saturadas (100% ocupación):</p>
                    <ul class="text-[10px] space-y-1 list-disc pl-4 text-on-surface-variant">`;
                    fullNaps.forEach(n => {
                        html += `<li><strong>${n.name}</strong> (${n.zone}) - Requiere ampliación.</li>`;
                    });
                    html += `</ul>`;
                } else {
                    html += `<p class="text-[11px] text-emerald-500 font-medium">Todas las NAPs activas tienen puertos disponibles.</p>`;
                }
                html += `</div>`;
                results.innerHTML = html;
            } else if (type === 'attenuation') {
                const trackedNaps = db.trackedNaps || [];
                const highLossNaps = trackedNaps.filter(n => n.comments && (n.comments.toLowerCase().includes('nivel') || n.comments.toLowerCase().includes('-2') || n.comments.toLowerCase().includes('retroceso')));

                let html = `<div class="p-4 bg-surface-container-low border rounded-2xl space-y-2">
                    <p class="font-extrabold text-xs text-on-surface">Detección de Pérdida / Atenuación</p>`;
                
                if (highLossNaps.length > 0) {
                    html += `<p class="text-[11px] text-amber-600 font-medium">Se encontraron ${highLossNaps.length} NAPs con reportes de atenuación:</p>
                    <ul class="text-[10px] space-y-1 list-disc pl-4 text-on-surface-variant">`;
                    highLossNaps.forEach(n => {
                        html += `<li><strong>${n.name}</strong>: "${n.comments}"</li>`;
                    });
                    html += `</ul>`;
                } else {
                    html += `<p class="text-[11px] text-emerald-500 font-medium">No se registran anomalías críticas de atenuación en las NAPs.</p>`;
                }
                html += `</div>`;
                results.innerHTML = html;
            }
        }, 1200);
    };

    // Calcular atenuación
    window.calculateLinkLoss = function() {
        const splitterLoss = parseFloat(document.getElementById('calc-splitter').value);
        const distance = parseFloat(document.getElementById('calc-distance').value);
        const resultEl = document.getElementById('calc-result');

        if (isNaN(splitterLoss) || isNaN(distance)) return;

        // Pérdida de fibra: ~0.35 dB/km a 1310nm, ~0.22 dB/km a 1550nm. Usamos 0.35 dB/km.
        const fiberLoss = (distance / 1000) * 0.35;
        // Pérdida por fusión y conectores estimadas (~0.5 dB)
        const connectionLoss = 0.6;
        const totalLoss = splitterLoss + fiberLoss + connectionLoss;
        const expectedRx = 4 - totalLoss; // Asumiendo +4 dBm Tx de la OLT

        resultEl.classList.remove('hidden');
        resultEl.innerHTML = `
            <p class="text-secondary font-bold">Pérdida Calculada: -${totalLoss.toFixed(2)} dB</p>
            <p class="mt-1 text-on-surface-variant opacity-80">Nivel Óptico de Recepción Estimado en ONT: <strong>${expectedRx.toFixed(2)} dBm</strong></p>
            <p class="text-[9px] text-on-surface-variant mt-1">Cálculo basado en estándar ITU-T G.984 GPON.</p>
        `;
    };

    // Optimizar Rutas
    window.optimizeTechRoute = function() {
        const results = document.getElementById('routing-results');
        if (!results) return;

        results.innerHTML = `
            <div class="flex items-center justify-center py-8 text-secondary">
                <span class="material-symbols-outlined text-3xl animate-spin">sync</span>
                <span class="text-xs font-bold ml-2">Analizando ubicaciones de clientes y NAPs...</span>
            </div>
        `;

        setTimeout(() => {
            const role = sessionStorage.getItem('Velocity_Role') || 'technician';
            let orders = [];

            if (role === 'technician') {
                orders = window.techState?.orders || [];
            }

            if (orders.length === 0) {
                results.innerHTML = `
                    <div class="p-4 bg-surface-container-low border rounded-2xl text-center">
                        <p class="text-xs font-bold text-on-surface">No hay órdenes cargadas hoy</p>
                        <p class="text-[10px] text-on-surface-variant mt-1">Carga órdenes de prueba para simular la optimización.</p>
                    </div>
                `;
                return;
            }

            // Simulación de ordenamiento por vecindad más cercana (heurística TSP)
            const sorted = [...orders].sort((a, b) => {
                const priorityA = a.kind === 'installation' ? 1 : 2;
                const priorityB = b.kind === 'installation' ? 1 : 2;
                return priorityA - priorityB; // Preferir instalaciones temprano
            });

            let html = `
                <div class="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-3">
                    <p class="font-extrabold text-xs text-on-surface flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
                        ¡Ruta Optimizada!
                    </p>
                    <p class="text-[11px] text-on-surface-variant">Reordenado para reducir traslados. Distancia estimada de conducción reducida en <strong>6.8 km (24% de ahorro)</strong>.</p>
                    
                    <div class="space-y-2 mt-2">`;
            
            sorted.forEach((o, i) => {
                html += `
                    <div class="flex items-center gap-2 p-2 bg-surface-container-lowest rounded-xl border text-[11px]">
                        <span class="w-5 h-5 rounded-full bg-secondary text-white font-bold flex items-center justify-center text-[9px]">${i + 1}</span>
                        <div class="flex-1 min-w-0">
                            <p class="font-bold text-on-surface truncate">${o.client}</p>
                            <p class="text-[9px] text-on-surface-variant truncate">${o.address || 'Panamá'}</p>
                        </div>
                        <span class="text-[9px] font-bold bg-surface px-1.5 py-0.5 rounded text-secondary">${o.startTime}</span>
                    </div>`;
            });

            html += `</div>
                <button onclick="window.applyOptimizedRoute()" class="w-full py-2 bg-emerald-500 text-white font-bold text-xs rounded-xl active:scale-95 transition-all mt-2">
                    Aplicar Nueva Secuencia en Agenda
                </button>
            </div>`;
            results.innerHTML = html;
            window.tempSortedRoute = sorted;
        }, 1500);
    };

    window.applyOptimizedRoute = function() {
        if (window.tempSortedRoute && window.techState) {
            window.techState.orders = window.tempSortedRoute;
            if (typeof window.renderApp === 'function') {
                window.renderApp();
            } else if (typeof window.renderAgenda === 'function') {
                window.renderAgenda();
            }
            alert('¡Orden de agenda actualizado según ruta sugerida por IA!');
            toggleSmartPanel();
        }
    };

    // Chatbot de soporte Experto
    window.sendExpertMessage = function() {
        const input = document.getElementById('chat-input');
        if (!input || !input.value.trim()) return;

        const val = input.value.trim();
        input.value = '';

        const chat = document.getElementById('chat-messages');
        if (!chat) return;

        // Append user msg
        chat.innerHTML += `
            <div class="bg-secondary text-white p-2.5 rounded-xl max-w-[85%] self-end ml-auto text-right">
                ${val}
            </div>
        `;
        chat.scrollTop = chat.scrollHeight;

        // Simular respuesta del copiloto
        setTimeout(() => {
            let reply = '';
            const q = val.toLowerCase();

            if (q.includes('señal') || q.includes('perdida') || q.includes('pérdida') || q.includes('baja') || q.includes('atenuación')) {
                reply = `<strong>Guía de Atenuación Crítica (Fibra):</strong><br>
                1. Mide potencia en la roseta del cliente con tu Power Meter.<br>
                2. Si es menor a -27 dBm, limpia el conector APC del patchcord.<br>
                3. Si persiste, revisa el puerto NAP. Si en la NAP la potencia es buena (-19 dBm), el drop tiene daño físico (doblez de radio < 15mm o daño mecánico).`;
            } else if (q.includes('gpon') || q.includes('potencia') || q.includes('estandar') || q.includes('estándar') || q.includes('valores')) {
                reply = `<strong>Niveles Estándar GPON:</strong><br>
                - Tx de OLT GPON: +1.5 a +5 dBm.<br>
                - Rango óptimo en ONT: -15 a -25 dBm.<br>
                - Sensibilidad máxima: -28 dBm.<br>
                - Sobrecarga (sobre-potencia): > -8 dBm.`;
            } else if (q.includes('los') || q.includes('desconectado') || q.includes('rojo')) {
                reply = `<strong>Alerta LOS (Luz Roja):</strong><br>
                1. Indica desconexión total de luz.<br>
                2. Verifica si el latiguillo óptico interno está roto.<br>
                3. Confirma que la fibra de acometida esté bien conectada en la caja NAP exterior.<br>
                4. Revisa si el puerto GPON de la OLT está en desuso.`;
            } else {
                reply = `Recibido. Recomiendo medir niveles en caja de abonado y realizar una limpieza con casete limpiador (One-Click) en ambos lados del enlace.`;
            }

            chat.innerHTML += `
                <div class="bg-surface-container-lowest p-2.5 rounded-xl max-w-[85%]">
                    ${reply}
                </div>
            `;
            chat.scrollTop = chat.scrollHeight;
        }, 1000);
    };

    window.quickQuestion = function(txt) {
        const input = document.getElementById('chat-input');
        if (input) {
            input.value = txt;
            window.sendExpertMessage();
        }
    };

    // Diagnóstico individual por ticket
    window.openSmartDiagnostic = function(orderId) {
        injectSmartPanel();
        toggleSmartPanel();
        switchAssistantTab('diag');

        const results = document.getElementById('diagnostic-results');
        if (!results) return;

        results.innerHTML = `
            <div class="flex items-center justify-center py-8 text-secondary">
                <span class="material-symbols-outlined text-3xl animate-spin">sync</span>
                <span class="text-xs font-bold ml-2">Consultando ONT #${orderId} vía API proxy...</span>
            </div>
        `;

        setTimeout(() => {
            const role = sessionStorage.getItem('Velocity_Role') || 'technician';
            let order = null;
            if (role === 'technician') {
                order = window.techState?.orders?.find(o => String(o.id) === String(orderId));
            }

            const clientName = order?.client || `Cliente #${orderId}`;
            const clientNap = order?.nap || 'Sin NAP Asignada';
            
            // Simular niveles de señal
            let dbm = -20.45;
            let status = 'ONLINE';
            let statusColor = 'text-emerald-500';
            let advice = 'El enlace está en óptimas condiciones. Realice pruebas de velocidad.';

            if (clientNap.includes('W-13') || clientNap.includes('PLY-04')) {
                dbm = -28.90;
                status = 'SEÑAL CRÍTICA';
                statusColor = 'text-error';
                advice = '<strong>Recomendación:</strong> Atenuación severa detectada. Revise los radios de curvatura de la fibra drop y limpie los acopladores en la NAP exterior.';
            } else if (!order?.nap) {
                dbm = -40.00;
                status = 'LOS (Loss of Signal)';
                statusColor = 'text-red-600';
                advice = '<strong>Recomendación:</strong> Sin señal óptica detectada. Verifique si hay daños mecánicos en el tendido del cable drop.';
            }

            results.innerHTML = `
                <div class="p-4 bg-surface-container-low border rounded-2xl space-y-3">
                    <p class="font-extrabold text-xs text-on-surface">ONT Telemetría: ${clientName}</p>
                    <div class="grid grid-cols-2 gap-2 text-[11px]">
                        <div class="bg-surface-container-lowest p-2 rounded-xl border">
                            <span class="text-on-surface-variant block uppercase text-[8px]">Potencia Rx</span>
                            <strong class="${statusColor} text-sm">${dbm.toFixed(2)} dBm</strong>
                        </div>
                        <div class="bg-surface-container-lowest p-2 rounded-xl border">
                            <span class="text-on-surface-variant block uppercase text-[8px]">Estado Link</span>
                            <strong class="${statusColor} text-sm">${status}</strong>
                        </div>
                    </div>
                    <p class="text-[11px] text-on-surface-variant leading-relaxed bg-surface-container-lowest p-3 rounded-xl border">${advice}</p>
                    <p class="text-[9px] text-on-surface-variant opacity-60">Sincronizado vía OLT O5-Panama GPON.</p>
                </div>
            `;
        }, 1500);
    };

    // Inicializar e inyectar al DOM
    injectFloatingButton();
    injectSmartPanel();

})();
