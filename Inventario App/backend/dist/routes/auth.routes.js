"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Rutas Públicas
router.post('/login', auth_controller_1.AuthController.login);
// Rutas Protegidas
router.get('/me', auth_middleware_1.verifyToken, auth_controller_1.AuthController.me);
router.get('/users', auth_middleware_1.verifyToken, auth_controller_1.AuthController.getUsers);
exports.default = router;
