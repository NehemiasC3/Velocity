"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncService = exports.SyncService = void 0;
const DbService_1 = require("./DbService");
class SyncService {
    onlineStatus = {};
    activeTracking = {};
    constructor() {
        // Limpieza periódica de estados online inactivos cada 60s
        setInterval(() => {
            const now = Date.now();
            Object.keys(this.onlineStatus).forEach((id) => {
                if (now - this.onlineStatus[id] > 120000) {
                    delete this.onlineStatus[id];
                }
            });
        }, 60000);
    }
    getSanitizedSyncState() {
        const db = DbService_1.dbService.getDB();
        const sanitizedDB = JSON.parse(JSON.stringify(db));
        if (sanitizedDB.supervisors) {
            sanitizedDB.supervisors.forEach((s) => delete s.password);
        }
        if (sanitizedDB.technicians) {
            sanitizedDB.technicians.forEach((t) => delete t.password);
        }
        if (sanitizedDB.settings) {
            delete sanitizedDB.settings.wisproToken;
        }
        return {
            ...sanitizedDB,
            onlineStatus: this.onlineStatus,
            activeTracking: this.activeTracking
        };
    }
    recordHeartbeat(techId, tracking) {
        const strTechId = String(techId);
        this.onlineStatus[strTechId] = Date.now();
        if (tracking) {
            // Eliminar órdenes previas pertenecientes a este técnico
            Object.keys(this.activeTracking).forEach((orderId) => {
                if (String(this.activeTracking[orderId].empId) === strTechId) {
                    delete this.activeTracking[orderId];
                }
            });
            // Agregar las órdenes activas en curso
            Object.entries(tracking).forEach(([orderId, entry]) => {
                if (entry.status === 'started') {
                    this.activeTracking[orderId] = {
                        status: 'started',
                        startTime: entry.startTime,
                        empId: strTechId
                    };
                }
            });
        }
        return this.onlineStatus[strTechId];
    }
}
exports.SyncService = SyncService;
exports.syncService = new SyncService();
