"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportController = void 0;
const axios_1 = __importDefault(require("axios"));
const ReportService_1 = require("../services/ReportService");
class ReportController {
    static async testReportEmail(_req, res) {
        try {
            console.log('[ReportController] Solicitud de envío de reporte manual recibida');
            await ReportService_1.reportService.sendDailyReportEmail();
            res.status(200).json({
                success: true,
                message: 'Reporte de prueba enviado. Revisa tu correo y logs del servidor.'
            });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    }
    static async testGDrive(req, res) {
        const { url } = req.body;
        if (!url || !url.startsWith('http')) {
            res.status(400).json({ error: 'URL de Web App inválida. Debe comenzar con http:// o https://' });
            return;
        }
        try {
            const response = await axios_1.default.get(url, { timeout: 10000 });
            if (response.status === 200) {
                const data = response.data;
                if (data && (data.supervisors || data.technicians)) {
                    res.status(200).json({
                        success: true,
                        info: `¡Conexión OK! Base de datos de Google Drive validada. Contiene ${data.supervisors?.length || 0} supervisores y ${data.technicians?.length || 0} técnicos.`
                    });
                }
                else {
                    res.status(200).json({
                        success: true,
                        info: '¡Conexión OK! La URL responde correctamente, pero el archivo velocity_db.json está vacío. Se inicializará con tu base de datos actual al guardar.'
                    });
                }
            }
            else {
                res.status(response.status).json({ error: `Google retornó estado HTTP ${response.status}` });
            }
        }
        catch (e) {
            res.status(500).json({ error: `Error de conexión: ${e.message}` });
        }
    }
}
exports.ReportController = ReportController;
