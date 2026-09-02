import axios from 'axios';
import { dbService } from './DbService';

export class ReportService {
  private lastReportDay: string = '';

  constructor() {
    // Programador de reporte nocturno cada 60s a las 23:59
    setInterval(() => {
      const now = new Date();
      const hh = now.getHours();
      const mm = now.getMinutes();
      const todayStr = now.toISOString().split('T')[0];

      if (hh === 23 && mm === 59 && this.lastReportDay !== todayStr) {
        this.lastReportDay = todayStr;
        this.sendDailyReportEmail().catch((e) =>
          console.error('[ReportService] Error en envío automático nocturno:', e.message)
        );
      }
    }, 60000);
  }

  public async sendDailyReportEmail(): Promise<void> {
    const db = dbService.getDB();
    const url = db.settings?.googleSheetUrl;

    if (!url || !url.startsWith('http')) {
      console.log('[ReportService] No se puede enviar reporte diario por correo: Google Apps Script URL no configurada.');
      return;
    }

    const recipient =
      db.settings?.reportRecipientEmail ||
      (db.supervisors && db.supervisors[0] ? db.supervisors[0].email : '');

    if (!recipient) {
      console.log('[ReportService] No se puede enviar reporte diario por correo: Email receptor no configurado.');
      return;
    }

    console.log(`[ReportService] Enviando reporte diario a: ${recipient}...`);

    const payload = {
      action: 'send_daily_report',
      recipientEmail: recipient,
      date: new Date().toLocaleDateString('es-ES'),
      totalTrackedNaps: db.trackedNaps?.length || 0,
      pendingNapsCount: db.trackedNaps?.filter((n) => !n.resolved)?.length || 0
    };

    const response = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });

    if (response.status === 200) {
      console.log('[ReportService] Reporte diario enviado a Google Apps Script con éxito.');
    } else {
      console.warn('[ReportService] Google Apps Script retornó estado HTTP:', response.status);
    }
  }
}

export const reportService = new ReportService();
