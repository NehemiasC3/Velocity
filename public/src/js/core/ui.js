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
    const key = TECNICOS_ACTIVOS.find(n => n && name.toLowerCase().includes(n.split(' ')[0].toLowerCase()));
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
    return TECNICOS_ACTIVOS.some(n => n && n.split(' ')[0].toLowerCase() === firstWord);
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
        db.technicians = db.technicians.filter(t => t.name && TECNICOS_ACTIVOS.some(n => n && t.name.toLowerCase().includes(n.toLowerCase().split(' ')[0])));
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

window.showLoadingOverlay = function(message = 'Cargando...', isUpdate = false) {
    // Si estamos en el panel de Técnico y NO es una actualización, no mostramos el loader.
    const isTechPage = window.location.pathname.includes('technician.html');
    if (isTechPage && !isUpdate) {
        return; 
    }

    const overlay = document.getElementById('loading-overlay');
    const textEl = document.getElementById('loading-overlay-text');
    const graphicEl = document.getElementById('loader-graphic');
    if (overlay) {
        if (textEl) {
            textEl.textContent = message;
            if (isUpdate) {
                textEl.className = "text-sm font-black text-[#0059bb] tracking-widest uppercase mt-6 animate-pulse";
            } else {
                textEl.className = "text-sm font-extrabold text-secondary tracking-widest uppercase mt-4 animate-pulse";
            }
        }
        
        if (graphicEl) {
            if (isUpdate) {
                // PREMIUM VECTOR SVG RUNNING HAMSTER (Much more cute, smooth and professional than blocky HTML divs)
                graphicEl.innerHTML = `
                    <style>
                        @keyframes spin-wheel-svg {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                        .spinning-wheel-svg {
                            transform-origin: 75px 75px;
                            animation: spin-wheel-svg 1.2s linear infinite;
                        }
                        @keyframes run-legs-svg {
                            0%, 100% { transform: scaleY(1) translateY(0); }
                            50% { transform: scaleY(0.5) translateY(4px); }
                        }
                        .front-foot-svg {
                            transform-origin: 42px 40px;
                            animation: run-legs-svg 0.15s linear infinite;
                        }
                        .back-foot-svg {
                            transform-origin: 15px 40px;
                            animation: run-legs-svg 0.15s linear infinite;
                            animation-delay: 0.075s;
                        }
                        @keyframes hamster-run-svg {
                            0%, 100% { transform: translate(45px, 52px) rotate(-1deg); }
                            50% { transform: translate(45px, 55px) rotate(2deg); }
                        }
                        .running-hamster-svg {
                            animation: hamster-run-svg 0.3s ease-in-out infinite;
                        }
                    </style>
                    <svg viewBox="0 0 150 150" width="160" height="160">
                        <defs>
                            <linearGradient id="wheel-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#0059bb" />
                                <stop offset="100%" stop-color="#38bdf8" />
                            </linearGradient>
                            <linearGradient id="hamster-body-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#fbbf24" />
                                <stop offset="100%" stop-color="#d97706" />
                            </linearGradient>
                            <linearGradient id="ear-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#fda4af" />
                                <stop offset="100%" stop-color="#f43f5e" />
                            </linearGradient>
                        </defs>
                        
                        <!-- Outer Wheel (spinning) -->
                        <g class="spinning-wheel-svg">
                            <circle cx="75" cy="75" r="60" fill="none" stroke="url(#wheel-grad)" stroke-width="6" stroke-dasharray="320 60" />
                            <!-- Wheel Spokes -->
                            <line x1="75" y1="15" x2="75" y2="135" stroke="url(#wheel-grad)" stroke-width="1.5" opacity="0.25" />
                            <line x1="15" y1="75" x2="135" y2="75" stroke="url(#wheel-grad)" stroke-width="1.5" opacity="0.25" />
                        </g>
                        
                        <!-- Hamster (bouncing/running) -->
                        <g class="running-hamster-svg">
                            <!-- Back Foot -->
                            <ellipse class="back-foot-svg" cx="15" cy="40" rx="5" ry="4" fill="#b45309" />
                            <!-- Tail -->
                            <circle cx="5" cy="25" r="4.5" fill="#fda4af" />
                            <!-- Hamster Body -->
                            <path d="M 12 15 C 8 20, 5 30, 10 38 C 15 42, 38 42, 45 35 C 50 30, 52 20, 48 15 C 44 10, 16 10, 12 15 Z" fill="url(#hamster-body-grad)" />
                            <!-- Blushing Cheek -->
                            <circle cx="41" cy="24" r="3.5" fill="#f87171" opacity="0.75" />
                            <!-- Eye -->
                            <circle cx="43" cy="18" r="3" fill="#1e293b" />
                            <circle cx="44.2" cy="16.8" r="1" fill="#FFFFFF" />
                            <!-- Ear -->
                            <ellipse cx="32" cy="8" rx="5" ry="7" fill="url(#ear-grad)" transform="rotate(-15 32 8)" />
                            <ellipse cx="32" cy="8" rx="2.5" ry="4" fill="#ffffff" opacity="0.4" transform="rotate(-15 32 8)" />
                            <!-- Front Foot -->
                            <ellipse class="front-foot-svg" cx="42" cy="40" rx="5" ry="4" fill="#d97706" />
                            <!-- Nose -->
                            <polygon points="49,19 52,21 49,23" fill="#f43f5e" />
                        </g>
                    </svg>
`;
            } else {
                // Cargador clásico: Logo latiendo con tres puntos
                graphicEl.innerHTML = `
                    <div class="relative w-20 h-20 rounded-2xl bg-white p-3 shadow-[0_12px_40px_rgba(0,89,187,0.15)] flex items-center justify-center overflow-hidden border border-outline-variant/30">
                        <img src="../logo-velocity.svg" class="w-full h-full object-contain animate-pulse" alt="Velocity Logo">
                        <div class="shimmer-bar animate-shimmer"></div>
                    </div>
                    <div class="flex items-center gap-2 mt-4">
                        <span class="w-2.5 h-2.5 rounded-full bg-secondary animate-bounce" style="animation-delay: 0s;"></span>
                        <span class="w-2.5 h-2.5 rounded-full bg-secondary animate-bounce" style="animation-delay: 0.15s;"></span>
                        <span class="w-2.5 h-2.5 rounded-full bg-secondary animate-bounce" style="animation-delay: 0.3s;"></span>
                    </div>
`;
            }
        }
        
        // Ajustamos las clases de fondo del overlay según sea actualización (blanco) o carga clásica
        if (isUpdate) {
            overlay.className = "hidden fixed inset-0 bg-[#f8fafd]/95 backdrop-blur-sm z-[500] flex flex-col items-center justify-center transition-all duration-300 opacity-0 pointer-events-none";
        } else {
            const isSupervisor = window.location.pathname.includes('supervisor.html');
            if (isSupervisor) {
                overlay.className = "hidden fixed top-0 md:top-0 right-0 bottom-20 md:bottom-0 left-0 md:left-20 bg-background/90 backdrop-blur-md z-[45] flex flex-col items-center justify-center transition-all duration-300 opacity-0 pointer-events-none";
            } else {
                overlay.className = "hidden fixed inset-0 bg-background/90 backdrop-blur-md z-[500] flex flex-col items-center justify-center transition-all duration-300 opacity-0 pointer-events-none";
            }
        }
        
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

/**
 * Alterna el estado del acordeón de navegación.
 * Cierra automáticamente otros acordeones abiertos para mantener la barra limpia.
 * @param {string} accordionId - ID del contenedor acordeón (ej: 'accordion-inventory')
 */
window.toggleNavAccordion = function(accordionId) {
    const targetItem = document.getElementById(accordionId);
    if (!targetItem) return;

    const content = targetItem.querySelector('.accordion-content');
    const chevron = targetItem.querySelector('.chevron-icon');
    const isExpanded = content && content.classList.contains('expanded');

    // Comportamiento Acordeón: Cerrar otros acordeones
    document.querySelectorAll('.accordion-item').forEach(item => {
        if (item.id !== accordionId) {
            const otherContent = item.querySelector('.accordion-content');
            const otherChevron = item.querySelector('.chevron-icon');
            if (otherContent) otherContent.classList.remove('expanded');
            if (otherChevron) otherChevron.classList.remove('rotated');
        }
    });

    // Alternar el actual
    if (content && chevron) {
        if (isExpanded) {
            content.classList.remove('expanded');
            chevron.classList.remove('rotated');
        } else {
            content.classList.add('expanded');
            chevron.classList.add('rotated');
        }
    }
};

window.switchTab = function(tab, subTab = 'dashboard') {
    state.tab = tab;
    state.inventorySubTab = subTab;
    sessionStorage.setItem('V_Tab', tab);
    if (subTab) sessionStorage.setItem('V_SubTab', subTab);

    // 1. Actualizar botones directos
    document.querySelectorAll('.nav-btn').forEach(btn => {
        const isActive = btn.id === `nav-${tab}`;
        btn.classList.toggle('bg-primary-container', isActive);
        btn.classList.toggle('text-white', isActive);
        btn.classList.toggle('shadow-sm', isActive);
        btn.classList.toggle('text-on-surface-variant', !isActive);
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) icon.style.fontVariationSettings = isActive ? "'FILL' 1" : "'FILL' 0";
    });

    // 2. Resaltar Contenedor Padre de Inventario
    const invParentBtn = document.getElementById('nav-inventory-parent');
    const invContent = document.getElementById('content-inventory');
    const invChevron = document.getElementById('chevron-inventory');

    if (invParentBtn) {
        const isInvActive = tab === 'inventory';
        invParentBtn.classList.toggle('bg-secondary/15', isInvActive);
        invParentBtn.classList.toggle('text-secondary', isInvActive);
        invParentBtn.classList.toggle('font-bold', isInvActive);

        // Auto expandir el acordeón si estamos navegando a inventario
        if (isInvActive && invContent && !invContent.classList.contains('expanded')) {
            invContent.classList.add('expanded');
            if (invChevron) invChevron.classList.add('rotated');
        }
    }

    // 3. Resaltar Sub-Ítems del Acordeón
    document.querySelectorAll('.subnav-btn').forEach(subBtn => {
        const isSubActive = subBtn.id === `nav-sub-${tab}-${subTab}`;
        subBtn.classList.toggle('bg-secondary', isSubActive);
        subBtn.classList.toggle('text-white', isSubActive);
        subBtn.classList.toggle('font-semibold', isSubActive);
        subBtn.classList.toggle('shadow-sm', isSubActive);
        subBtn.classList.toggle('text-on-surface-variant', !isSubActive);
    });

    // 4. Título Dinámico
    const subTabTitles = {
        dashboard: 'Dashboard',
        bodegas: 'Bodegas',
        catalog: 'Catálogo',
        inbound: 'Ingreso Inbound',
        traslados: 'Envíos / Traslados',
        rma: 'Devoluciones RMA',
        auditorias: 'Auditorías'
    };
    const titles = { 
        dashboard: 'Resumen', 
        technicians: 'Técnicos', 
        naps: 'NAPs', 
        users: 'Cuentas', 
        settings: 'Ajustes', 
        prueba: 'Mesa de Órdenes', 
        inventory: `Inventario › ${subTabTitles[subTab] || 'Dashboard'}` 
    };
    const titleEl = document.getElementById('header-title');
    if (titleEl) titleEl.textContent = titles[tab] || tab;

    // 5. Section loader overlay
    window.showLoadingOverlay('Abriendo sección...');
    setTimeout(() => {
        renderTab(tab, subTab);
        window.hideLoadingOverlay();
    }, 150);
}

/**
 * Alterna el modo del sidebar entre expandido (texto + iconos) y colapsado (solo iconos estilo Wispro).
 */
window.toggleSidebarCollapse = function() {
    const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('V_Sidebar_Collapsed', isCollapsed ? 'true' : 'false');
};

// Restaurar estado del sidebar al cargar
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        if (localStorage.getItem('V_Sidebar_Collapsed') === 'true') {
            document.body.classList.add('sidebar-collapsed');
        }
    });
}

function renderTab(tab, subTab) {
    const el = document.getElementById('main-content');
    if (!el) return;

    // ── INTEGRACIÓN DINÁMICA DE REACT (PUERTO 5173) PARA INVENTARIO ──
    if (tab === 'inventory') {
        const sub = subTab || 'dashboard';
        const tabMap = {
            'dashboard': 'dashboard',
            'bodegas': 'warehouses',
            'warehouses': 'warehouses',
            'catalog': 'catalog',
            'catalogo': 'catalog',
            'inbound': 'inbound',
            'ingreso': 'inbound',
            'traslados': 'transfers',
            'transfers': 'transfers',
            'rma': 'rma',
            'devoluciones': 'rma',
            'auditorias': 'audit',
            'audit': 'audit'
        };
        const canonicalTab = tabMap[sub] || sub;
        const timestamp = Date.now();
        const iframeSrc = `http://localhost:5173/?tab=${encodeURIComponent(canonicalTab)}&embedded=true&t=${timestamp}`;
        
        let iframeContainer = document.getElementById('inventory-iframe-wrapper');
        if (!iframeContainer) {
            el.innerHTML = `
                <div id="inventory-iframe-wrapper" class="w-full h-[calc(100vh-3.5rem)] m-0 p-0 overflow-hidden border-none bg-white">
                    <iframe 
                        id="inventory-react-iframe" 
                        src="${iframeSrc}" 
                        class="w-full h-full border-none m-0 p-0 bg-white" 
                        allow="clipboard-read; clipboard-write;"
                        title="Velocity ISP Inventory App"
                    ></iframe>
                </div>
            `;
        } else {
            const iframe = document.getElementById('inventory-react-iframe');
            if (iframe) {
                try {
                    // Envío postMessage para cambio de tab instantáneo (< 5ms) sin recargar la página entera
                    iframe.contentWindow.postMessage({ type: 'NAVIGATE_TAB', tab: canonicalTab }, '*');
                } catch (e) {}
            }
        }
        return;
    }

    // Persistencia de foco y cursor
    const activeEl = document.activeElement;
    const activeId = activeEl ? activeEl.id : null;
    const hasSelection = activeEl && ('selectionStart' in activeEl || typeof activeEl.selectionStart === 'number');
    const start = hasSelection ? activeEl.selectionStart : null;
    const end = hasSelection ? activeEl.selectionEnd : null;

    const renderedHtml = Views[tab] ? Views[tab]() : '<p class="p-8 text-on-surface-variant">Vista no encontrada</p>';
    el.innerHTML = `<div class="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-4">${renderedHtml}</div>`;

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

// ── PWA ACTUALIZACIÓN DETECTADA & HÁMSTER ANIMATION ─────────────────────────
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(reg => {
        reg.addEventListener('updatefound', () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
                installingWorker.addEventListener('statechange', () => {
                    if (installingWorker.state === 'installing' || installingWorker.state === 'installed') {
                        if (window.showLoadingOverlay) {
                            window.showLoadingOverlay('Instalando Actualización (v3.1.2)...', true);
                        }
                    }
                });
            }
        });
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        if (window.showLoadingOverlay) {
            window.showLoadingOverlay('Aplicando cambios...', true);
        }
        setTimeout(() => {
            window.location.reload();
        }, 1200);
    });
}
