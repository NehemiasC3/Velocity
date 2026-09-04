export type UserRole = 'admin' | 'supervisor' | 'bodeguero' | 'technician';

export interface BaseUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  phone?: string;
  warehouseId?: string;
  warehouseName?: string;
  wisproId?: string;
  lastLogin?: string;
  disabled?: boolean;
}

export interface SupervisorUser extends BaseUser {
  role: 'admin' | 'supervisor';
}

export interface TechnicianUser extends BaseUser {
  role: 'technician' | 'bodeguero';
  status?: string;
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
