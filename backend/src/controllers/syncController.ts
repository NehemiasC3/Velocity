import { Request, Response } from 'express';
import { dbService } from '../services/DbService';
import { syncService } from '../services/SyncService';

export class SyncController {
  public static getSyncState(_req: Request, res: Response): void {
    try {
      const state = syncService.getSanitizedSyncState();
      res.status(200).json(state);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error al obtener estado' });
    }
  }

  public static updateSyncState(req: Request, res: Response): void {
    try {
      dbService.updateDB(req.body);
      res.status(200).json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error al guardar estado' });
    }
  }

  public static heartbeat(req: Request, res: Response): void {
    const userId = req.body.userId || req.body.techId || (req as any).user?.userId;
    const { tracking } = req.body;
    if (!userId) {
      res.status(400).json({ error: 'userId o techId es requerido' });
      return;
    }

    const timestamp = syncService.recordHeartbeat(userId, tracking);
    res.status(200).json({ success: true, timestamp });
  }
}
