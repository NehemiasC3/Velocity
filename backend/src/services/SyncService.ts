import { dbService } from './DbService';
import { ActiveTrackingEntry, SyncStateResponse } from '../types/sync';

export class SyncService {
  private onlineStatus: Record<string, number> = {};
  private activeTracking: Record<string, ActiveTrackingEntry> = {};

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

  public getSanitizedSyncState(): SyncStateResponse {
    const db = dbService.getDB();
    const sanitizedDB = JSON.parse(JSON.stringify(db));

    if (sanitizedDB.supervisors) {
      sanitizedDB.supervisors.forEach((s: any) => delete s.password);
    }
    if (sanitizedDB.technicians) {
      sanitizedDB.technicians.forEach((t: any) => delete t.password);
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

  public recordHeartbeat(
    techId: string | number,
    tracking?: Record<string, { status: string; startTime: number | string }>
  ): number {
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

export const syncService = new SyncService();
