export interface SupervisorUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'supervisor';
  disabled?: boolean;
}

export interface TechnicianUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'technician';
  disabled?: boolean;
}

export interface NapOverride {
  napId?: string;
  napName?: string;
  status?: string;
  comment?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface TrackedNap {
  id: string;
  napId: string;
  napName: string;
  technicianId: string;
  technicianName: string;
  resolved: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export interface SystemSettings {
  wisproToken?: string;
  wisproBaseUrl?: string;
  googleSheetUrl?: string;
  reportRecipientEmail?: string;
  [key: string]: any;
}

export interface DatabaseState {
  supervisors: SupervisorUser[];
  technicians: TechnicianUser[];
  napOverrides: Record<string, NapOverride>;
  trackedNaps: TrackedNap[];
  settings: SystemSettings;
}
