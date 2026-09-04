import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import writeFileAtomic from 'write-file-atomic';
import axios from 'axios';
import { DatabaseState, SupervisorUser, TechnicianUser } from '../types/db';

export class DbService {
  private readonly dataDir: string;
  private readonly dbPath: string;
  private dbCache: DatabaseState | null = null;

  constructor() {
    this.dataDir = process.env.DATA_DIR || path.join(__dirname, '../../../data');
    this.dbPath = path.join(this.dataDir, 'db.json');

    if (!fs.existsSync(this.dataDir)) {
      console.log(`[DbService] Creando directorio de datos en: ${this.dataDir}`);
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  public getDB(): DatabaseState {
    if (this.dbCache) return this.dbCache;

    if (!fs.existsSync(this.dbPath)) {
      const initialState: DatabaseState = {
        supervisors: [
          {
            id: 'S-ROOT-1',
            name: 'Nehemias',
            email: 'nehemias@atg-rappido.com',
            password: bcrypt.hashSync('Rappido2024', 10),
            role: 'supervisor',
            disabled: false
          },
          {
            id: 'S-ROOT-2',
            name: 'E. Vasquez',
            email: 'evasquez@atg-rappido.com',
            password: bcrypt.hashSync('Rappido2024', 10),
            role: 'supervisor',
            disabled: false
          }
        ],
        technicians: [],
        napOverrides: {},
        trackedNaps: [],
        settings: {
          wisproToken: process.env.WISPRO_API_KEY || process.env.WISPRO_API_TOKEN || '',
          wisproBaseUrl: process.env.WISPRO_BASE_URL || process.env.WISPRO_API_URL || 'https://www.cloud.wispro.co/api/v1'
        }
      };

      fs.writeFileSync(this.dbPath, JSON.stringify(initialState, null, 2));
      this.dbCache = initialState;
      return initialState;
    }

    try {
      const data = fs.readFileSync(this.dbPath, 'utf8');
      this.dbCache = JSON.parse(data) as DatabaseState;

      // Auto-migración: Hashear contraseñas en texto plano si existen
      let updated = false;
      if (this.dbCache.supervisors) {
        this.dbCache.supervisors.forEach((u) => {
          if (u.password && !u.password.startsWith('$2a$') && !u.password.startsWith('$2b$')) {
            u.password = bcrypt.hashSync(u.password, 10);
            updated = true;
          }
        });
      }
      if (this.dbCache.technicians) {
        this.dbCache.technicians.forEach((u) => {
          if (u.password && !u.password.startsWith('$2a$') && !u.password.startsWith('$2b$')) {
            u.password = bcrypt.hashSync(u.password, 10);
            updated = true;
          }
        });
      }

      if (updated) {
        this.persistDB();
      }

      return this.dbCache;
    } catch (e: any) {
      console.error('[DbService] Error crítico leyendo db.json:', e.message);
      throw e;
    }
  }

  public persistDB(): void {
    if (!this.dbCache) return;
    try {
      writeFileAtomic.sync(this.dbPath, JSON.stringify(this.dbCache, null, 2));
      this.syncToGoogleDrive();
    } catch (e: any) {
      console.error('[DbService] Error al persistir DB local:', e.message);
    }
  }

  public updateDB(newData: Partial<DatabaseState>): void {
    const db = this.getDB();

    if (newData.technicians) {
      newData.technicians.forEach((nt) => {
        const ext = db.technicians.find((t) => t.id === nt.id || (t.email && nt.email && t.email.toLowerCase() === nt.email.toLowerCase()));
        if (ext && !nt.password) nt.password = ext.password;
        if (nt.password && !nt.password.startsWith('$2a$') && !nt.password.startsWith('$2b$')) {
          nt.password = bcrypt.hashSync(nt.password, 10);
        }
      });
      db.technicians = newData.technicians as TechnicianUser[];
    }

    if (newData.supervisors) {
      newData.supervisors.forEach((ns) => {
        const exs = db.supervisors.find((s) => s.id === ns.id || (s.email && ns.email && s.email.toLowerCase() === ns.email.toLowerCase()));
        if (exs && !ns.password) ns.password = exs.password;
        if (ns.password && !ns.password.startsWith('$2a$') && !ns.password.startsWith('$2b$')) {
          ns.password = bcrypt.hashSync(ns.password, 10);
        }
      });
      db.supervisors = newData.supervisors as SupervisorUser[];
    }

    if (newData.napOverrides) db.napOverrides = newData.napOverrides;
    if (newData.trackedNaps) db.trackedNaps = newData.trackedNaps;
    if (newData.settings) db.settings = { ...db.settings, ...newData.settings };

    this.persistDB();
  }

  public async syncFromGoogleDrive(): Promise<void> {
    const db = this.getDB();
    const url = db.settings?.googleSheetUrl;
    if (!url || !url.startsWith('http')) return;

    try {
      console.log('[DbService] Sincronizando respaldo con Google Drive...');
      const res = await axios.get(url, { timeout: 10000 });
      if (res.status === 200 && res.data) {
        const cloudData = res.data;
        if (cloudData && (cloudData.supervisors || cloudData.technicians)) {
          this.dbCache = cloudData;
          this.persistDB();
          console.log('[DbService] Sincronización con Google Drive completada exitosamente.');
        }
      }
    } catch (e: any) {
      console.warn('[DbService] Error al sincronizar con Google Drive:', e.message);
    }
  }

  public async syncToGoogleDrive(): Promise<void> {
    const db = this.getDB();
    const url = db.settings?.googleSheetUrl;
    if (!url || !url.startsWith('http')) return;

    try {
      await axios.post(url, db, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
    } catch (e: any) {
      console.warn('[DbService] Error al respaldar en Google Drive:', e.message);
    }
  }
}

export const dbService = new DbService();
