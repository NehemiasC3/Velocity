"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncController = void 0;
const DbService_1 = require("../services/DbService");
const SyncService_1 = require("../services/SyncService");
class SyncController {
    static getSyncState(_req, res) {
        try {
            const state = SyncService_1.syncService.getSanitizedSyncState();
            res.status(200).json(state);
        }
        catch (error) {
            res.status(500).json({ error: error.message || 'Error al obtener estado' });
        }
    }
    static updateSyncState(req, res) {
        try {
            DbService_1.dbService.updateDB(req.body);
            res.status(200).json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message || 'Error al guardar estado' });
        }
    }
    static heartbeat(req, res) {
        const userId = req.body.userId || req.body.techId || req.user?.userId;
        const { tracking } = req.body;
        if (!userId) {
            res.status(400).json({ error: 'userId o techId es requerido' });
            return;
        }
        const timestamp = SyncService_1.syncService.recordHeartbeat(userId, tracking);
        res.status(200).json({ success: true, timestamp });
    }
}
exports.SyncController = SyncController;
