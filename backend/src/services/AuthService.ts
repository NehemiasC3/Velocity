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

  public updatePassword(identifier: string, newPass: string): { success: boolean; message: string } {
    if (!identifier || !newPass) {
      throw new Error('Identificador y contraseña requeridos');
    }
    if (newPass.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    }

    const db = dbService.getDB();
    const cleanId = identifier.trim().toLowerCase();

    // 1. Buscar en supervisores por id o email
    let user: any = db.supervisors.find((u) => u.id === identifier || u.email.toLowerCase() === cleanId);
    
    // 2. Buscar en técnicos por id o email
    if (!user) {
      user = db.technicians.find((t) => t.id === identifier || t.email.toLowerCase() === cleanId);
    }

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    user.password = bcrypt.hashSync(newPass, 10);
    dbService.persistDB();

    console.log(`[AuthService 🔑] Contraseña actualizada exitosamente para: ${user.email} (${user.id})`);
    return { success: true, message: `Contraseña actualizada para ${user.name || user.email}` };
  }

  public verifyToken(token: string): TokenPayload {
    return jwt.verify(token, this.jwtSecret) as TokenPayload;
  }

  public isMasterSecret(secret: string): boolean {
    return secret === this.apiSecret;
  }
}

export const authService = new AuthService();
