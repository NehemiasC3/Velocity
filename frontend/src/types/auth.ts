export type UserRole = 'supervisor' | 'technician';

export interface UserSession {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  token: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  role: UserRole;
  userId: string;
  name: string;
  error?: string;
}
