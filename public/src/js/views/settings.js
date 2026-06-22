Views.settings = () => {
    const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    const s  = db.settings || {};

    return `
    <div class="space-y-6 max-w-2xl">
        <h2 class="text-2xl font-extrabold text-on-surface">Ajustes del Sistema</h2>

        <!-- Apariencia -->
        <div class="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 space-y-4">
            <div class="flex items-center gap-2 mb-2">
                <span class="material-symbols-outlined text-secondary">palette</span>
                <h3 class="font-bold text-on-surface">Apariencia y Tema</h3>
            </div>
            <div class="grid grid-cols-3 gap-3">
                <button onclick="window.setVisualMode('kinetic')" class="flex flex-col items-center gap-2 p-4 rounded-xl border-2 ${db.settings?.visualMode === 'kinetic' || !db.settings?.visualMode ? 'border-secondary bg-secondary/5' : 'border-outline-variant/20 hover:bg-surface-container'} transition-all group">
                    <div class="w-10 h-10 rounded-lg bg-[#0059bb] shadow-lg group-active:scale-95 transition-transform"></div>
                    <span class="text-[10px] font-black uppercase tracking-widest text-on-surface">Kinetic</span>
                </button>
                <button onclick="window.setVisualMode('nocturno')" class="flex flex-col items-center gap-2 p-4 rounded-xl border-2 ${db.settings?.visualMode === 'nocturno' ? 'border-secondary bg-secondary/5' : 'border-outline-variant/20 hover:bg-surface-container'} transition-all group">
                    <div class="w-10 h-10 rounded-lg bg-[#081b38] border border-white/10 shadow-lg group-active:scale-95 transition-transform"></div>
                    <span class="text-[10px] font-black uppercase tracking-widest text-on-surface">Nocturno</span>
                </button>
                <button onclick="window.setVisualMode('operativo')" class="flex flex-col items-center gap-2 p-4 rounded-xl border-2 ${db.settings?.visualMode === 'operativo' ? 'border-secondary bg-secondary/5' : 'border-outline-variant/20 hover:bg-surface-container'} transition-all group">
                    <div class="w-10 h-10 rounded-lg bg-black shadow-lg group-active:scale-95 transition-transform"></div>
                    <span class="text-[10px] font-black uppercase tracking-widest text-on-surface">Operativo</span>
                </button>
            </div>
        </div>

        <!-- API Wispro -->
        <div class="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 space-y-4">
            <div class="flex items-center gap-2 mb-2">
                <span class="material-symbols-outlined text-secondary">api</span>
                <h3 class="font-bold text-on-surface">Integración Wispro</h3>
            </div>
            <div>
                <label class="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant ml-1">API Token</label>
                <input type="password" id="set-token" value="${s.wisproToken || ''}" class="w-full mt-1 bg-surface-container border border-outline-variant/30 focus:border-secondary focus:ring-1 focus:ring-secondary rounded-xl px-4 py-2.5 text-sm text-on-surface transition-colors" placeholder="Pega tu token aquí...">
            </div>
            <div class="flex items-center justify-between p-3 rounded-xl bg-surface-container/50 border border-outline-variant/20">
                <div>
                    <p class="text-[10px] font-black uppercase tracking-widest text-on-surface">Modo Live</p>
                    <p class="text-[9px] text-on-surface-variant mt-0.5">Conectar con API real de Wispro</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="set-live" ${s.isLiveMode ? 'checked' : ''} class="sr-only peer">
                    <div class="w-11 h-6 bg-outline-variant/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary"></div>
                </label>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <button onclick="window.saveSettings()" class="kinetic-gradient text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95">
                    <span class="material-symbols-outlined text-sm">save</span> Guardar
                </button>
                <button onclick="window.testConnection()" class="border border-secondary text-secondary py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-secondary/5 active:scale-95">
                    <span class="material-symbols-outlined text-sm">wifi_find</span> Probar
                </button>
            </div>
            <div id="conn-result" class="hidden text-xs font-bold p-3 rounded-xl"></div>
        </div>

        <!-- Almacenamiento Cloud (Google Drive) -->
        <div class="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 space-y-4">
            <div class="flex items-center gap-2 mb-2">
                <span class="material-symbols-outlined text-secondary">cloud</span>
                <h3 class="font-bold text-on-surface">Almacenamiento en la Nube</h3>
            </div>
            <p class="text-xs text-on-surface-variant leading-relaxed">Vincule su cuenta de Google Drive / Sheets mediante una URL de Google Apps Script. Esto permite almacenar la base de datos de manera persistente en la nube y evitar pérdida de datos al desplegar en servidores stateless como Railway.</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant ml-1">URL de Web App (Google Apps Script)</label>
                    <input type="text" id="set-gdrive-url" value="${s.googleSheetUrl || ''}" class="w-full mt-1 bg-surface-container border border-outline-variant/30 focus:border-secondary focus:ring-1 focus:ring-secondary rounded-xl px-4 py-2.5 text-sm text-on-surface transition-colors" placeholder="https://script.google.com/macros/s/.../exec">
                </div>
                <div>
                    <label class="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant ml-1">Email del Receptor de Reportes</label>
                    <input type="email" id="set-report-email" value="${s.reportRecipientEmail || ''}" class="w-full mt-1 bg-surface-container border border-outline-variant/30 focus:border-secondary focus:ring-1 focus:ring-secondary rounded-xl px-4 py-2.5 text-sm text-on-surface transition-colors" placeholder="correo@empresa.com">
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button onclick="window.saveGoogleDriveUrl()" class="kinetic-gradient text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95">
                    <span class="material-symbols-outlined text-sm">cloud_sync</span> Guardar Ajustes
                </button>
                <button onclick="window.testGoogleDriveConnection()" class="border border-secondary text-secondary py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-secondary/5 active:scale-95">
                    <span class="material-symbols-outlined text-sm">wifi_tethering</span> Probar Conexión
                </button>
                <button onclick="window.testReportEmail()" class="border border-purple-600 text-purple-600 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-purple-500/5 active:scale-95">
                    <span class="material-symbols-outlined text-sm">mail</span> Reporte de Prueba
                </button>
            </div>
            <div id="gdrive-conn-result" class="hidden text-xs font-bold p-3 rounded-xl"></div>
        </div>

        <!-- Cache -->
        <div class="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20">
            <div class="flex items-center gap-2 mb-4">
                <span class="material-symbols-outlined text-secondary">storage</span>
                <h3 class="font-bold text-on-surface">Cache de Datos</h3>
            </div>
            <p class="text-sm text-on-surface-variant mb-4">Los datos estáticos (clientes, técnicos) se guardan 24h. Las órdenes se actualizan cada 5 min.</p>
            <button onclick="window.clearAllCache()" class="border border-error/40 text-error py-2.5 px-5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-error-container/20 active:scale-95">
                <span class="material-symbols-outlined text-sm">delete_sweep</span> Limpiar todo el cache
            </button>
        </div>

        <!-- Migración y Respaldo -->
        <div class="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 space-y-4">
            <div class="flex items-center gap-2 mb-2">
                <span class="material-symbols-outlined text-secondary">send_to_mobile</span>
                <div>
                    <h3 class="font-bold text-on-surface">Migración y Respaldo</h3>
                    <p class="text-xs text-on-surface-variant mt-0.5">Usa esto para pasar tus datos a otro celular o PC rápidamente.</p>
                </div>
            </div>
            <div class="space-y-3">
                <textarea id="migration-code" readonly placeholder="El código de migración aparecerá aquí..." 
                    class="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-[10px] font-mono text-on-surface h-24 resize-none outline-none focus:border-secondary"></textarea>
                <div class="grid grid-cols-2 gap-3">
                    <button onclick="window.exportDatabase()" class="border border-secondary text-secondary py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-secondary/5 active:scale-95">
                        <span class="material-symbols-outlined text-sm">content_copy</span> Exportar
                    </button>
                    <button onclick="window.importDatabasePrompt()" class="kinetic-gradient text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95">
                        <span class="material-symbols-outlined text-sm">download</span> Importar
                    </button>
                </div>
            </div>
        </div>

        <!-- Diagnóstico de Red (QA) -->
        <div class="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 space-y-4">
            <div class="flex items-center gap-2 mb-2">
                <span class="material-symbols-outlined text-error">bug_report</span>
                <div>
                    <h3 class="font-bold text-on-surface">Diagnóstico de Red</h3>
                    <p class="text-xs text-on-surface-variant mt-0.5">Ver errores técnicos si no carga la información.</p>
                </div>
            </div>
            <button onclick="window.viewErrorLog()" class="w-full bg-error/10 text-error py-3 rounded-xl font-bold text-xs uppercase tracking-widest border border-error/20 hover:bg-error/20 transition-all">
                Ver Log de Errores (${VELOCITY_CONFIG.errorLog?.length || 0})
            </button>
        </div>

        <!-- Modo Simulación Global (QA) -->
        <div class="bg-secondary/10 p-6 rounded-2xl border border-secondary/20 space-y-4">
            <div class="flex items-center gap-2 mb-2">
                <span class="material-symbols-outlined text-secondary">rocket_launch</span>
                <div>
                    <h3 class="font-bold text-secondary">Modo Simulación Global</h3>
                    <p class="text-xs text-on-surface-variant mt-0.5">Inyecta datos ficticios para probar el Dashboard y KPIs.</p>
                </div>
            </div>
            <button onclick="window.loadSupervisorDemo()" class="kinetic-gradient text-white w-full py-4 rounded-xl font-bold text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all">
                Activar Simulación Maestro
            </button>
        </div>

        <!-- Cerrar sesión -->
        <div class="bg-error-container/20 border border-error/20 p-5 rounded-2xl mb-4">
            <button onclick="window.logout()" class="text-error font-bold text-sm uppercase tracking-widest flex items-center justify-center w-full gap-2 active:scale-95">
                <span class="material-symbols-outlined text-[18px]">logout</span> Cerrar Sesión
            </button>
        </div>

        <!-- Versión del Sistema -->
        <div class="text-center py-4 opacity-40 text-xs font-semibold select-none">
            Velocity Ecosistema v${VELOCITY_CONFIG.version || '2.0.1-PRO-FIXED'}
        </div>
    </div>`;
};

window.setVisualMode = function(mode) {
    const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    if (!db.settings) db.settings = {};
    db.settings.visualMode = mode;
    localStorage.setItem('Velocity_Sync_State', JSON.stringify(db));
    serverPush(db);
    document.documentElement.className = mode;
    renderTab('settings');
    showNotification('Tema Actualizado', `Modo ${mode} aplicado con éxito.`, 'success');
};
