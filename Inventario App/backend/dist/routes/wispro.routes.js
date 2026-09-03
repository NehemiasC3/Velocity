"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const wispro_controller_1 = require("../controllers/wispro.controller");
const router = (0, express_1.Router)();
router.get('/tickets/open', wispro_controller_1.WisproController.getOpenTickets);
router.get('/installations/pending', wispro_controller_1.WisproController.getPendingInstallations);
router.put('/assign', wispro_controller_1.WisproController.assignTicket);
exports.default = router;
