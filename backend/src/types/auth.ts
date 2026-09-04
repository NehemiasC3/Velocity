export type AuthRole = 'admin' | 'supervisor' | 'bodeguero' | 'technician';

export interface TokenPayload {
  userId: string;
  role: AuthRole;
  name: string;
  email: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  role: AuthRole;
  userId: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}
