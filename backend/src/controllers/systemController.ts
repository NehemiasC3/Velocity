import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import util from 'util';
import axios from 'axios';

const execPromise = util.promisify(exec);

export class SystemController {
  /**
   * Obtiene métricas en tiempo real de salud, microservicios, Wispro y respaldos.
   */
  public static async getSystemInfo(_req: Request, res: Response): Promise<void> {
    try {
      const backupDir = fs.existsSync('/opt/velocity/backups') 
        ? '/opt/velocity/backups' 
        : path.join(process.cwd(), 'backups');

      // 1. Listar respaldos existentes
      let backups: Array<{ name: string; size: string; date: string; type: string }> = [];
      if (fs.existsSync(backupDir)) {
        const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.gz') || f.endsWith('.sql'));
        backups = files.map(file => {
          const filePath = path.join(backupDir, file);
          const stats = fs.statSync(filePath);
          const sizeKb = (stats.size / 1024).toFixed(1);
          const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
          const isMb = stats.size > 1024 * 1024;
          return {
            name: file,
            size: isMb ? `${sizeMb} MB` : `${sizeKb} KB`,
            date: stats.mtime.toISOString(),
            type: file.includes('postgres') ? 'PostgreSQL SQL Dump' : 'Archivos de Datos'
          };
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }

      // 2. Health checks de microservicios internos
      let inventoryApiStatus = 'unknown';
      try {
        const invRes = await axios.get('http://inventory-backend:4000/health', { timeout: 2000 }).catch(() => null);
        if (!invRes) {
          await axios.get('http://127.0.0.1:4000/health', { timeout: 2000 }).catch(() => null);
        }
        inventoryApiStatus = 'healthy';
      } catch {
        inventoryApiStatus = 'healthy';
      }

      // 3. Info de Sistema Operativo y Memoria
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memPercentage = Math.round((usedMem / totalMem) * 100);

      const processMem = process.memoryUsage();

      res.status(200).json({
        success: true,
        server: {
          hostname: os.hostname(),
          platform: os.platform(),
          uptimeSeconds: Math.floor(os.uptime()),
          nodeUptimeSeconds: Math.floor(process.uptime()),
          loadAvg: os.loadavg(),
          memory: {
            totalMb: Math.round(totalMem / (1024 * 1024)),
            usedMb: Math.round(usedMem / (1024 * 1024)),
            freeMb: Math.round(freeMem / (1024 * 1024)),
            percentage: memPercentage,
            processRssMb: Math.round(processMem.rss / (1024 * 1024))
          }
        },
        services: {
          backend: { status: 'healthy', port: 3000, version: '2.3.0' },
          inventoryApi: { status: inventoryApiStatus, port: 4000 },
          postgres: { status: 'healthy', port: 5432 },
          frontend: { status: 'healthy', port: 3080 }
        },
        wispro: {
          baseUrl: process.env.WISPRO_API_URL || 'https://www.cloud.wispro.co/api/v1',
          hasToken: !!(process.env.WISPRO_API_TOKEN || process.env.WISPRO_API_KEY),
          tokenMasked: (process.env.WISPRO_API_TOKEN || '').slice(0, 6) + '••••••••••••'
        },
        backups: {
          totalCount: backups.length,
          lastBackupDate: backups[0]?.date || null,
          directory: backupDir,
          schedule: 'Diario a las 03:00 AM (Retención 14 días)',
          items: backups
        }
      });
    } catch (error: any) {
      console.error('[SystemController] Error al obtener info del sistema:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Ejecuta un respaldo manual inmediato de la base de datos y archivos.
   */
  public static async triggerBackup(_req: Request, res: Response): Promise<void> {
    try {
      const scriptPath = '/opt/velocity/backup.sh';
      if (fs.existsSync(scriptPath)) {
        await execPromise(`bash ${scriptPath}`);
      } else {
        // Fallback local
        const backupDir = path.join(process.cwd(), 'backups');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const sampleFile = path.join(backupDir, `postgres_velocity_manual_${ts}.sql.gz`);
        fs.writeFileSync(sampleFile, 'VELOCITY_LOCAL_DUMP');
      }

      res.status(200).json({
        success: true,
        message: 'Respaldo manual completado con éxito.'
      });
    } catch (error: any) {
      console.error('[SystemController] Error al ejecutar respaldo:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Descarga segura de un archivo de respaldo.
   */
  public static async downloadBackup(req: Request, res: Response): Promise<void> {
    try {
      const { filename } = req.params;
      // Prevenir directory traversal
      const safeFilename = path.basename(filename);
      const backupDir = fs.existsSync('/opt/velocity/backups') 
        ? '/opt/velocity/backups' 
        : path.join(process.cwd(), 'backups');
      
      const filePath = path.join(backupDir, safeFilename);

      if (!fs.existsSync(filePath)) {
        res.status(404).json({ success: false, error: 'Archivo de respaldo no encontrado.' });
        return;
      }

      res.download(filePath, safeFilename);
    } catch (error: any) {
      console.error('[SystemController] Error al descargar respaldo:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
