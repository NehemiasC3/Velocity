"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const DbService_1 = require("./DbService");
class AuthService {
    jwtSecret;
    apiSecret;
    constructor() {
        this.jwtSecret = process.env.JWT_SECRET || 'velocity-jwt-secure-secret-key-2026';
        this.apiSecret = process.env.API_SECRET || 'velocidad-secreta-2024';
    }
    login(email, pass) {
        if (!email || !pass) {
            throw new Error('Email y contraseña son obligatorios');
        }
        const db = DbService_1.dbService.getDB();
        const cleanEmail = email.toLowerCase().trim();
        // 1. Buscar en supervisores
        let user = db.supervisors.find((u) => u.email.toLowerCase() === cleanEmail);
        let role = user?.role || 'supervisor';
        // 2. Buscar en técnicos
        if (!user) {
            user = db.technicians.find((u) => u.email.toLowerCase() === cleanEmail);
            role = user?.role || 'technician';
        }
        if (!user || !user.password) {
            throw new Error('Credenciales incorrectas');
        }
        const isMatch = bcryptjs_1.default.compareSync(pass, user.password);
        if (!isMatch) {
            throw new Error('Credenciales incorrectas');
        }
        if (user.disabled) {
            throw new Error('Cuenta desactivada. Contacte a su supervisor.');
        }
        // Registrar último inicio de sesión
        user.lastLogin = new Date().toISOString();
        DbService_1.dbService.persistDB();
        const tokenPayload = {
            userId: user.id,
            role,
            name: user.name,
            email: user.email
        };
        const token = jsonwebtoken_1.default.sign(tokenPayload, this.jwtSecret, { expiresIn: '24h' });
        return {
            success: true,
            token,
            role,
            userId: user.id,
            name: user.name
        };
    }
    updatePassword(identifier, newPass) {
        if (!identifier || !newPass) {
            throw new Error('Identificador y contraseña requeridos');
        }
        if (newPass.length < 6) {
            throw new Error('La contraseña debe tener al menos 6 caracteres');
        }
        const db = DbService_1.dbService.getDB();
        const cleanId = identifier.trim().toLowerCase();
        // 1. Buscar en supervisores por id o email
        let user = db.supervisors.find((u) => u.id === identifier || u.email.toLowerCase() === cleanId);
        // 2. Buscar en técnicos por id o email
        if (!user) {
            user = db.technicians.find((t) => t.id === identifier || t.email.toLowerCase() === cleanId);
        }
        if (!user) {
            throw new Error('Usuario no encontrado');
        }
        user.password = bcryptjs_1.default.hashSync(newPass, 10);
        DbService_1.dbService.persistDB();
        console.log(`[AuthService 🔑] Contraseña actualizada exitosamente para: ${user.email} (${user.id})`);
        return { success: true, message: `Contraseña actualizada para ${user.name || user.email}` };
    }
    verifyToken(token) {
        return jsonwebtoken_1.default.verify(token, this.jwtSecret);
    }
    isMasterSecret(secret) {
        return secret === this.apiSecret;
    }
}
exports.AuthService = AuthService;
exports.authService = new AuthService();
