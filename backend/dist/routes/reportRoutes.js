"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reportController_1 = require("../controllers/reportController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
router.post('/test-report-email', authMiddleware_1.validateToken, reportController_1.ReportController.testReportEmail);
router.post('/test-gdrive', authMiddleware_1.validateToken, reportController_1.ReportController.testGDrive);
exports.default = router;
