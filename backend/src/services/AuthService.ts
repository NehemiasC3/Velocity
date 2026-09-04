import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbService } from './DbService';
import { LoginResponse, TokenPayload } from '../types/auth';

export class AuthService {
  private readonly jwtSecret: string;
  private readonly apiSecret: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'velocity-jwt-secure-secret-key-2026';
    this.apiSecret = process.env.API_SECRET || 'velocidad-secreta-2024';
  }

  public login(email: string, pass: string): LoginResponse {
    if (!email || !pass) {
      throw new Error('Email y contraseña son obligatorios');
    }

    const db = dbService.getDB();
    const cleanEmail = email.toLowerCase().trim();

    // 1. Buscar en supervisores
    let user: any = db.supervisors.find((u) => u.email.toLowerCase() === cleanEmail);
    let role: any = user?.role || 'supervisor';

    // 2. Buscar en técnicos
    if (!user) {
      user = db.technicians.find((u) => u.email.toLowerCase() === cleanEmail);
      role = user?.role || 'technician';
    }

    if (!user || !user.password) {
      throw new Error('Credenciales incorrectas');
    }

    const isMatch = bcrypt.compareSync(pass, user.password);
    if (!isMatch) {
      throw new Error('Credenciales incorrectas');
    }

    if (user.disabled) {
      throw new Error('Cuenta desactivada. Contacte a su supervisor.');
    }

    // Registrar último inicio de sesión
    user.lastLogin = new Date().toISOString();
    dbService.persistDB();

    const tokenPayload: TokenPayload = {
      userId: user.id,
      role,
      name: user.name,
      email: user.email
    };

    const token = jwt.sign(tokenPayload, this.jwtSecret, { expiresIn: '24h' });

    return {
      success: true,
      token,
      role,
      userId: user.id,
      name: user.name
    };
  }

  public verifyToken(token: string): TokenPayload {
    return jwt.verify(token, this.jwtSecret) as TokenPayload;
  }

  public isMasterSecret(secret: string): boolean {
    return secret === this.apiSecret;
  }
}

export const authService = new AuthService();
