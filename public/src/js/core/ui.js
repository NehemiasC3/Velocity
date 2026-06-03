// Velocity UI Module

function updateSystemStatus(online) {
    const text = document.getElementById('status-text');
    const icon = document.getElementById('status-icon');
    const container = document.getElementById('system-status-container');
    if (!text || !icon || !container) return;

    if (online) {
        text.textContent = 'Conectado';
        icon.textContent = 'verified_user';
        container.classList.remove('bg-error-container/30', 'text-error');
        container.classList.add('bg-tertiary-fixed-dim/30');
    } else {
        text.textContent = 'Desconectado';
        icon.textContent = 'error';
        container.classList.remove('bg-tertiary-fixed-dim/30');
        container.classList.add('bg-error-container/30', 'text-error');
    }
}

function debounce(fn, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), wait);
    };
}

function showNotification(title, message, type = 'info') {
    const containerId = 'velocity-notifications';
    let container = document.getElementById(containerId);
    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.className = 'fixed top-6 right-6 z-[200] flex flex-col gap-3 min-w-[320px] pointer-events-none';
        document.body.appendChild(container);

        // Estilos para las animaciones
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes slideIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(120%); opacity: 0; } }
            .toast-enter { animation: slideIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
            .toast-exit { animation: slideOut 0.3s ease-in forwards; }
        `;
        document.head.appendChild(style);
    }

    const toast = document.createElement('div');
    const color = type === 'success' ? 'bg-emerald-500' : type === 'issue' ? 'bg-amber-500' : 'bg-secondary';
    const icon = type === 'success' ? 'check_circle' : type === 'issue' ? 'notification_important' : 'info';

    toast.className = `toast-enter pointer-events-auto bg-surface-container-lowest border-l-4 ${color.replace('bg-', 'border-')} p-4 rounded-2xl shadow-2xl flex items-start gap-4 border border-outline-variant/10`;
    toast.innerHTML = `
        <div class="w-10 h-10 rounded-xl ${color} flex-shrink-0 flex items-center justify-center text-white shadow-lg">
            <span class="material-symbols-outlined text-2xl">${icon}</span>
        </div>
        <div class="flex-1 min-w-0 pr-2">
            <p class="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-widest mb-0.5">Velocity System</p>
            <h4 class="font-black text-on-surface text-sm leading-tight mb-1 truncate">${title}</h4>
            <p class="text-xs text-on-surface-variant font-medium leading-relaxed">${message}</p>
        </div>
        <button class="w-7 h-7 rounded-full hover:bg-surface-container-high flex items-center justify-center transition-colors" onclick="this.parentElement.classList.add('toast-exit'); setTimeout(() => this.parentElement.remove(), 300)">
            <span class="material-symbols-outlined text-base">close</span>
        </button>
    `;

    container.appendChild(toast);

    // Sonido
    try {
        // Sonido de notificación de campana doble premium
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2857/2857-preview.mp3');
        audio.volume = 0.45;
        audio.play().catch(() => console.warn('Autoplay blocked: user must interact first'));
    } catch(e) {}

    // Auto-remove
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 300);
        }
    }, 6000);
}

function getRelativeTime(timestamp) {
    if (!timestamp) return 'Nunca';
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'Hace un momento';
    const mins = Math.floor(diff / 60);
    return `Hace ${mins} ${mins === 1 ? 'min' : 'min'}`;
}

function techColor(name) {
    if (!name) return '#6b7280';
    const key = TECNICOS_ACTIVOS.find(n => name.toLowerCase().includes(n.split(' ')[0].toLowerCase()));
    if (key && TECH_PALETTE[key]) return TECH_PALETTE[key];
    
    // Hash para generar un color HSL único pero consistente y elegante
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    return `hsl(${h}, 60%, 45%)`;
}

function techInitials(name) {
    return (name || '??').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function isActiveTech(name) {
    if (!name) return false;
    const firstWord = name.split(' ')[0].toLowerCase();
    return TECNICOS_ACTIVOS.some(n => n.split(' ')[0].toLowerCase() === firstWord);
}

function sinceBadge(iso) {
    if (!iso) return '';
    const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
    if (days === 0) return '<span style="color:#059669;font-weight:700;font-size:16px;">Hoy</span>';
    if (days === 1) return '<span style="color:#0059bb;font-weight:700;font-size:16px;">Ayer</span>';
    return `<span style="color:#dc2626;font-weight:700;font-size:16px;">Hace ${days}d</span>`;
}

function statusBadge(s) {
    const map = {
        pending:      { bg: '#fff7ed', color: '#c2410c', text: 'Pendiente' },
        finalized:    { bg: '#f0fdf4', color: '#059669', text: 'Finalizado' },
        closed:       { bg: '#f3f4f6', color: '#6b7280', text: 'Cerrado' },
        to_reschedule:{ bg: '#fef3c7', color: '#d97706', text: 'Reagendar' }
    };
    const m = map[s] || { bg: '#f3f4f6', color: '#6b7280', text: s || '?' };
    return `<span style="background:${m.bg};color:${m.color};font-size:16px;font-weight:700;padding:3px 10px;border-radius:999px;white-space:nowrap;">${m.text}</span>`;
}

window.deleteInactiveUsers = function() {
    if(!confirm('¿Deseas limpiar las cuentas inactivas y técnicos que no están en la sincronización principal?')) return;
    
    const db = JSON.parse(localStorage.getItem('Velocity_Sync_State') || '{}');
    if(db.technicians) {
        db.technicians = db.technicians.filter(t => TECNICOS_ACTIVOS.some(n => t.name.toLowerCase().includes(n.toLowerCase().split(' ')[0])));
    }
    localStorage.setItem('Velocity_Sync_State', JSON.stringify(db));
    if (typeof window.updateActiveTechs === 'function') window.updateActiveTechs();
    showNotification('Limpieza', 'Cuentas inactivas eliminadas', 'success');
    renderTab('users');
}

function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `${d.getDate()} ${months[d.getMonth()]}.`;
}

window.showLoadingOverlay = function(message = 'Cargando...') {
    const overlay = document.getElementById('loading-overlay');
    const textEl = document.getElementById('loading-overlay-text');
    if (overlay) {
        if (textEl) textEl.textContent = message;
        overlay.classList.remove('hidden');
        // Force reflow
        overlay.offsetWidth;
        overlay.classList.remove('opacity-0', 'pointer-events-none');
        overlay.classList.add('opacity-100');
    }
};

window.hideLoadingOverlay = function() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('opacity-100');
        overlay.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => {
            if (overlay.classList.contains('opacity-0')) {
                overlay.classList.add('hidden');
            }
        }, 300);
    }
};

window.switchTab = function(tab) {
    state.tab = tab;
    sessionStorage.setItem('V_Tab', tab);

    // Actualizar nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
        const isActive = btn.id === `nav-${tab}`;
        btn.classList.toggle('bg-primary-container', isActive);
        btn.classList.toggle('text-white', isActive);
        btn.classList.toggle('shadow-lg', isActive);
        btn.classList.toggle('text-on-surface-variant', !isActive);
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) icon.style.fontVariationSettings = isActive ? "'FILL' 1" : "'FILL' 0";
    });

    // Título
    const titles = { dashboard: 'Resumen', orders: 'Órdenes', technicians: 'Técnicos', reports: 'Reportes', naps: 'NAPs', users: 'Cuentas', settings: 'Ajustes', prueba: 'Prueba' };
    const titleEl = document.getElementById('header-title');
    if (titleEl) titleEl.textContent = titles[tab] || tab;

    // Elegant section loader overlay
    window.showLoadingOverlay('Abriendo sección...');
    setTimeout(() => {
        renderTab(tab);
        window.hideLoadingOverlay();
    }, 180);
}

function renderTab(tab) {
    const el = document.getElementById('main-content');
    if (!el) return;

    // Persistencia de foco y cursor
    const activeEl = document.activeElement;
    const activeId = activeEl ? activeEl.id : null;
    const hasSelection = activeEl && ('selectionStart' in activeEl || typeof activeEl.selectionStart === 'number');
    const start = hasSelection ? activeEl.selectionStart : null;
    const end = hasSelection ? activeEl.selectionEnd : null;

    el.innerHTML = Views[tab] ? Views[tab]() : '<p class="p-8 text-on-surface-variant">Vista no encontrada</p>';

    // Restaurar foco
    if (activeId) {
        const target = document.getElementById(activeId);
        if (target) {
            target.focus();
            if (typeof start === 'number') {
                target.setSelectionRange(start, end);
            }
        }
    }
    
    if (tab === 'naps' && typeof window.initNapsMap === 'function') {
        setTimeout(window.initNapsMap, 100);
    }
    
    if (tab === 'technicians' && typeof window.initTechsMap === 'function') {
        setTimeout(window.initTechsMap, 100);
    }

    if ((tab === 'orders' || tab === 'reports' || tab === 'prueba') && typeof window.loadLastCommentsForPlaceholders === 'function') {
        setTimeout(window.loadLastCommentsForPlaceholders, 150);
    }

    if (tab === 'reports' && typeof window.loadRecentCommentsAudit === 'function') {
        setTimeout(window.loadRecentCommentsAudit, 150);
    }
}
