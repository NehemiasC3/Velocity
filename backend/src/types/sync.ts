export interface ActiveTrackingEntry {
  status: string;
  startTime: number | string;
  empId: string | number;
}

export interface SyncStateResponse {
  supervisors: any[];
  technicians: any[];
  napOverrides: Record<string, any>;
  trackedNaps: any[];
  settings: Record<string, any>;
  onlineStatus: Record<string, number>;
  activeTracking: Record<string, ActiveTrackingEntry>;
}

export interface HeartbeatPayload {
  techId: string | number;
  tracking?: Record<string, { status: string; startTime: number | string }>;
}
