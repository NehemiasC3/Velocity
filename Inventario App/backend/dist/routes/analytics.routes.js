"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analytics_controller_1 = require("../controllers/analytics.controller");
const router = (0, express_1.Router)();
// KPIs y métricas gerenciales
router.get('/kpis', analytics_controller_1.AnalyticsController.getKPIs);
// Historial y búsqueda forense de auditoría
router.get('/audit-log', analytics_controller_1.AnalyticsController.getAuditLogs);
exports.default = router;
