"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const wisproProxyController_1 = require("../controllers/wisproProxyController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
// Proxy transparente para llamadas directas a Wispro API
router.all('/wispro/*', authMiddleware_1.validateToken, wisproProxyController_1.WisproProxyController.handleProxy);
exports.default = router;
