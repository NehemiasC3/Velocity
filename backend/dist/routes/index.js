"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authRoutes_1 = __importDefault(require("./authRoutes"));
const syncRoutes_1 = __importDefault(require("./syncRoutes"));
const wisproRoutes_1 = __importDefault(require("./wisproRoutes"));
const inventoryRoutes_1 = __importDefault(require("./inventoryRoutes"));
const reportRoutes_1 = __importDefault(require("./reportRoutes"));
const apiRouter = (0, express_1.Router)();
apiRouter.use(authRoutes_1.default);
apiRouter.use(syncRoutes_1.default);
apiRouter.use(wisproRoutes_1.default);
apiRouter.use(reportRoutes_1.default);
apiRouter.use('/v1', inventoryRoutes_1.default);
exports.default = apiRouter;
