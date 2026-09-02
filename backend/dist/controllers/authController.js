"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const AuthService_1 = require("../services/AuthService");
class AuthController {
    static login(req, res) {
        const { email, password } = req.body;
        try {
            const response = AuthService_1.authService.login(email, password);
            res.status(200).json(response);
        }
        catch (error) {
            res.status(401).json({ error: error.message || 'Error en inicio de sesión' });
        }
    }
    static verifySession(req, res) {
        if (req.user) {
            res.status(200).json({ valid: true, user: req.user });
        }
        else {
            res.status(401).json({ valid: false, error: 'No autorizado' });
        }
    }
}
exports.AuthController = AuthController;
