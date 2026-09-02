export interface TokenPayload {
  userId: string;
  role: 'supervisor' | 'technician';
  name: string;
  email: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  role: 'supervisor' | 'technician';
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
