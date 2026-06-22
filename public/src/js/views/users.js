Views.users = () => {
    const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    const supervisors = db.supervisors || [];
    const technicians = db.technicians || [];

    const supRows = supervisors.map(s => `
        <div class="flex items-center justify-between p-4 bg-surface-container rounded-xl">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                    <span class="material-symbols-outlined text-secondary text-xl" style="font-variation-settings:'FILL' 1;">admin_panel_settings</span>
                </div>
                <div>
                    <p class="font-bold text-on-surface text-sm">${s.name}</p>
                    <p class="text-xs text-on-surface-variant">${s.email}</p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold px-2 py-1 rounded-full ${s.disabled ? 'bg-error-container text-error' : 'bg-tertiary-fixed-dim/30 text-on-tertiary-container'}">
                    ${s.disabled ? 'Inactivo' : 'Activo'}
                </span>
                <button onclick="window.openEditUser('${s.id}','supervisor')" class="p-2 rounded-lg hover:bg-surface-container-high text-secondary transition-colors" title="Editar">
                    <span class="material-symbols-outlined text-sm">edit</span>
                </button>
                <button onclick="window.toggleUserStatus('${s.id}','supervisor')" class="p-2 rounded-lg hover:bg-surface-container-high transition-colors ${s.disabled ? 'text-on-tertiary-container' : 'text-error'}" title="${s.disabled ? 'Activar' : 'Desactivar'}">
                    <span class="material-symbols-outlined text-sm">${s.disabled ? 'toggle_off' : 'toggle_on'}</span>
                </button>
            </div>
        </div>`).join('');

    const techRows = technicians.map(t => {
        const online = isTechOnline(t.id);
        return `
        <div class="flex items-center justify-between p-4 bg-surface-container rounded-xl">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black" style="background:${techColor(t.name)};">
                    ${techInitials(t.name)}
                </div>
                <div>
                    <div class="flex items-center gap-2">
                        <p class="font-bold text-on-surface text-sm">${t.name}</p>
                        <span class="w-2 h-2 rounded-full ${online ? 'bg-emerald-500 shadow-[0_0_5px_#10b981]' : 'bg-outline-variant'}"></span>
                    </div>
                    <p class="text-xs text-on-surface-variant">${t.email}</p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold px-2 py-1 rounded-full ${t.disabled ? 'bg-error-container text-error' : 'bg-tertiary-fixed-dim/30 text-on-tertiary-container'}">
                    ${t.disabled ? 'Inactivo' : 'Activo'}
                </span>
                <button onclick="window.openEditUser('${t.id}','technician')" class="p-2 rounded-lg hover:bg-surface-container-high text-secondary transition-colors" title="Editar">
                    <span class="material-symbols-outlined text-sm">edit</span>
                </button>
                <button onclick="window.toggleUserStatus('${t.id}','technician')" class="p-2 rounded-lg hover:bg-surface-container-high transition-colors ${t.disabled ? 'text-on-tertiary-container' : 'text-error'}" title="${t.disabled ? 'Activar' : 'Desactivar'}">
                    <span class="material-symbols-outlined text-sm">${t.disabled ? 'toggle_off' : 'toggle_on'}</span>
                </button>
            </div>
        </div>`;
    }).join('');

    return `
    <div class="space-y-6 max-w-2xl">
        <div class="flex items-center justify-between">
            <h2 class="text-2xl font-extrabold text-on-surface">Gestión de Cuentas</h2>
            <div class="flex items-center gap-3">
                <button onclick="window.deleteInactiveUsers()" class="border border-error/50 text-error hover:bg-error/5 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-1.5 active:scale-95 transition-colors">
                    <span class="material-symbols-outlined text-sm">person_remove</span> Eliminar Inactivos
                </button>
                <button onclick="window.autoSyncTechs()" class="border border-outline-variant/50 text-secondary hover:bg-surface-container-low px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-1.5 active:scale-95 transition-colors">
                    <span class="material-symbols-outlined text-sm">cloud_sync</span> Importar Wispro
                </button>
                <button onclick="window.openNewUser()" class="kinetic-gradient text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-1.5 active:scale-95 transition-transform shadow-sm">
                    <span class="material-symbols-outlined text-sm">person_add</span> Nueva Cuenta
                </button>
            </div>
        </div>

        <div class="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 space-y-3">
            <p class="text-[10px] font-bold uppercase tracking-widest text-secondary flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[14px]">admin_panel_settings</span> Supervisores
            </p>
            ${supRows || '<p class="text-sm text-on-surface-variant py-2">Sin supervisores registrados</p>'}
        </div>

        <div class="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 space-y-3">
            <p class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[14px]">engineering</span> Técnicos Operativos
            </p>
            ${techRows || '<p class="text-sm text-on-surface-variant py-2">Sin técnicos registrados</p>'}
        </div>

    </div>`;
};
