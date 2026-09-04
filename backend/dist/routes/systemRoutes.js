"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const systemController_1 = require("../controllers/systemController");
const router = (0, express_1.Router)();
router.get('/system/info', systemController_1.SystemController.getSystemInfo);
router.post('/system/backup', systemController_1.SystemController.triggerBackup);
router.get('/system/backups/download/:filename', systemController_1.SystemController.downloadBackup);
exports.default = router;
