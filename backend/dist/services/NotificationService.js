"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.NotificationService = void 0;
const web_push_1 = __importDefault(require("web-push"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const write_file_atomic_1 = __importDefault(require("write-file-atomic"));
class NotificationService {
    publicKey;
    privateKey;
    subject;
    subsFilePath;
    subscriptions = new Map();
    constructor() {
        this.publicKey = (process.env.VAPID_PUBLIC_KEY ||
            'BBH906nqp8-eqavWd95D9OJABc6VGbTkw2Ssm7FqNV00_oq2EMCLgijvbK7uiV8ystP0C78Q61cF3zn_1G2T9cE').trim();
        this.privateKey = (process.env.VAPID_PRIVATE_KEY ||
            'K_JfhcRAEP4IlIuDsKEJDrHueePyCJLDUGfAojRoU1A').trim();
        this.subject = (process.env.VAPID_SUBJECT || 'mailto:soporte@atg-rappido.com').trim();
        if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
            console.warn('[NotificationService ⚠️] Variables VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no definidas en .env. Usando claves por defecto para desarrollo. Configúralas en producción.');
        }
        const dataDir = process.env.DATA_DIR || path_1.default.join(__dirname, '../../../data');
        if (!fs_1.default.existsSync(dataDir)) {
            try {
                fs_1.default.mkdirSync(dataDir, { recursive: true });
            }
            catch { }
        }
        this.subsFilePath = path_1.default.join(dataDir, 'push_subscriptions.json');
        try {
            web_push_1.default.setVapidDetails(this.subject, this.publicKey, this.privateKey);
            console.log('[NotificationService 🔔] Web Push VAPID inicializado correctamente.');
        }
        catch (e) {
            console.error('[NotificationService ❌] Error configurando VAPID:', e.message);
        }
        this.loadSubscriptions();
    }
    getPublicKey() {
        return this.publicKey;
    }
    loadSubscriptions() {
        try {
            if (fs_1.default.existsSync(this.subsFilePath)) {
                const raw = fs_1.default.readFileSync(this.subsFilePath, 'utf8');
                const list = JSON.parse(raw);
                list.forEach((sub) => {
                    if (sub?.subscription?.endpoint) {
                        this.subscriptions.set(sub.subscription.endpoint, sub);
                    }
                });
                console.log(`[NotificationService] ${this.subscriptions.size} suscripciones Push cargadas desde disco.`);
            }
        }
        catch (e) {
            console.warn('[NotificationService] No se pudieron cargar suscripciones push:', e.message);
        }
    }
    persistSubscriptions() {
        try {
            const list = Array.from(this.subscriptions.values());
            write_file_atomic_1.default.sync(this.subsFilePath, JSON.stringify(list, null, 2));
        }
        catch (e) {
            console.error('[NotificationService] Error persistiendo suscripciones push:', e.message);
        }
    }
    saveSubscription(subscription, userId, role, userAgent, preferences) {
        const endpoint = subscription.endpoint;
        const now = new Date().toISOString();
        const existing = this.subscriptions.get(endpoint);
        const defaultPreferences = {
            zones: ['Todas'],
            priorities: ['Alta', 'Normal'],
            events: ['orders', 'issues', 'audits']
        };
        const stored = {
            id: existing?.id || Math.random().toString(36).slice(2, 10),
            userId: userId || existing?.userId,
            role: role || existing?.role || 'all',
            subscription,
            preferences: preferences || existing?.preferences || defaultPreferences,
            userAgent: userAgent || existing?.userAgent,
            createdAt: existing?.createdAt || now,
            updatedAt: now
        };
        this.subscriptions.set(endpoint, stored);
        this.persistSubscriptions();
        console.log(`[NotificationService 🔔] Suscripción Push guardada (${this.subscriptions.size} activas).`);
        return stored;
    }
    updatePreferences(endpoint, preferences) {
        const sub = this.subscriptions.get(endpoint);
        if (!sub)
            return null;
        sub.preferences = preferences;
        sub.updatedAt = new Date().toISOString();
        this.subscriptions.set(endpoint, sub);
        this.persistSubscriptions();
        console.log(`[NotificationService ⚙️] Preferencias actualizadas para: ${endpoint.slice(0, 30)}...`);
        return sub;
    }
    getPreferences(endpoint) {
        const sub = this.subscriptions.get(endpoint);
        return sub?.preferences || null;
    }
    removeSubscription(endpoint) {
        const deleted = this.subscriptions.delete(endpoint);
        if (deleted) {
            this.persistSubscriptions();
            console.log(`[NotificationService] Suscripción removida: ${endpoint.slice(0, 30)}...`);
        }
        return deleted;
    }
    getSubscriptionsCount() {
        return this.subscriptions.size;
    }
    /**
     * Determina si una suscripción coincide con los filtros de una alerta
     */
    matchesPreferences(sub, payload) {
        const prefs = sub.preferences;
        if (!prefs)
            return true; // Si no tiene preferencias personalizadas, recibe todo
        // 1. Filtrado por Zona
        if (payload.zone && prefs.zones && prefs.zones.length > 0) {
            const hasAllZones = prefs.zones.some((z) => z.toLowerCase() === 'todas');
            if (!hasAllZones) {
                const matchesZone = prefs.zones.some((z) => z.toLowerCase().trim() === payload.zone.toLowerCase().trim());
                if (!matchesZone) {
                    return false;
                }
            }
        }
        // 2. Filtrado por Nivel de Prioridad
        if (payload.priority && prefs.priorities && prefs.priorities.length > 0) {
            const matchesPriority = prefs.priorities.some((p) => p.toLowerCase().trim() === payload.priority.toLowerCase().trim());
            if (!matchesPriority) {
                return false;
            }
        }
        // 3. Filtrado por Tipo de Evento
        if (payload.event && prefs.events && prefs.events.length > 0) {
            const matchesEvent = prefs.events.some((e) => e.toLowerCase().trim() === payload.event.toLowerCase().trim());
            if (!matchesEvent) {
                return false;
            }
        }
        return true;
    }
    /**
     * Envía una notificación Push filtrada inteligentemente según zonas, prioridades y eventos
     */
    async broadcastNotification(payload, targetRole) {
        let sent = 0;
        let failed = 0;
        let skipped = 0;
        const invalidEndpoints = [];
        const stringifiedPayload = JSON.stringify({
            title: payload.title,
            body: payload.body,
            icon: payload.icon || '/logo-velocity.svg',
            badge: payload.badge || '/icon-192.png',
            tag: payload.tag || `velocity-${Date.now()}`,
            data: {
                url: payload.data?.url || '/',
                zone: payload.zone,
                priority: payload.priority,
                event: payload.event,
                timestamp: Date.now(),
                ...(payload.data || {})
            },
            vibrate: payload.vibrate || [200, 100, 200, 100, 200],
            requireInteraction: payload.requireInteraction !== false
        });
        const promises = [];
        for (const [endpoint, stored] of this.subscriptions.entries()) {
            // Filtrar por rol
            if (targetRole && targetRole !== 'all' && stored.role !== 'all' && stored.role !== targetRole) {
                skipped++;
                continue;
            }
            // Filtrar según preferencias personalizadas de zona, prioridad y evento
            if (!this.matchesPreferences(stored, payload)) {
                skipped++;
                continue;
            }
            const p = web_push_1.default
                .sendNotification(stored.subscription, stringifiedPayload)
                .then(() => {
                sent++;
            })
                .catch((err) => {
                failed++;
                console.warn(`[NotificationService] Error enviando Push a ${endpoint.slice(0, 30)}...:`, err.statusCode || err.message);
                if (err.statusCode === 404 || err.statusCode === 410) {
                    invalidEndpoints.push(endpoint);
                }
            });
            promises.push(p);
        }
        await Promise.allSettled(promises);
        // Limpiar suscripciones inválidas
        if (invalidEndpoints.length > 0) {
            invalidEndpoints.forEach((ep) => this.subscriptions.delete(ep));
            this.persistSubscriptions();
        }
        console.log(`[NotificationService] Broadcast Push: ${sent} enviados, ${skipped} filtrados/omitidos, ${failed} fallidos.`);
        return { sent, failed, skipped };
    }
}
exports.NotificationService = NotificationService;
exports.notificationService = new NotificationService();
