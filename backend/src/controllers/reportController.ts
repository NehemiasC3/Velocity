import { Request, Response } from 'express';
import axios from 'axios';
import { reportService } from '../services/ReportService';

export class ReportController {
  public static async testReportEmail(_req: Request, res: Response): Promise<void> {
    try {
      console.log('[ReportController] Solicitud de envío de reporte manual recibida');
      await reportService.sendDailyReportEmail();
      res.status(200).json({
        success: true,
        message: 'Reporte de prueba enviado. Revisa tu correo y logs del servidor.'
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  public static async testGDrive(req: Request, res: Response): Promise<void> {
    const { url } = req.body;
    if (!url || !url.startsWith('http')) {
      res.status(400).json({ error: 'URL de Web App inválida. Debe comenzar con http:// o https://' });
      return;
    }

    try {
      const response = await axios.get(url, { timeout: 10000 });
      if (response.status === 200) {
        const data = response.data;
        if (data && (data.supervisors || data.technicians)) {
          res.status(200).json({
            success: true,
            info: `¡Conexión OK! Base de datos de Google Drive validada. Contiene ${data.supervisors?.length || 0} supervisores y ${data.technicians?.length || 0} técnicos.`
          });
        } else {
          res.status(200).json({
            success: true,
            info: '¡Conexión OK! La URL responde correctamente, pero el archivo velocity_db.json está vacío. Se inicializará con tu base de datos actual al guardar.'
          });
        }
      } else {
        res.status(response.status).json({ error: `Google retornó estado HTTP ${response.status}` });
      }
    } catch (e: any) {
      res.status(500).json({ error: `Error de conexión: ${e.message}` });
    }
  }
}
