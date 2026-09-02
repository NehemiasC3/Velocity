"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbService = exports.DbService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const write_file_atomic_1 = __importDefault(require("write-file-atomic"));
const axios_1 = __importDefault(require("axios"));
class DbService {
    dataDir;
    dbPath;
    dbCache = null;
    constructor() {
        this.dataDir = process.env.DATA_DIR || path_1.default.join(__dirname, '../../../data');
        this.dbPath = path_1.default.join(this.dataDir, 'db.json');
        if (!fs_1.default.existsSync(this.dataDir)) {
            console.log(`[DbService] Creando directorio de datos en: ${this.dataDir}`);
            fs_1.default.mkdirSync(this.dataDir, { recursive: true });
        }
    }
    getDB() {
        if (this.dbCache)
            return this.dbCache;
        if (!fs_1.default.existsSync(this.dbPath)) {
            const initialState = {
                supervisors: [
                    {
                        id: 'S-ROOT-1',
                        name: 'Nehemias',
                        email: 'nehemias@atg-rappido.com',
                        password: bcryptjs_1.default.hashSync('Rappido2024', 10),
                        role: 'supervisor',
                        disabled: false
                    },
                    {
                        id: 'S-ROOT-2',
                        name: 'E. Vasquez',
                        email: 'evasquez@atg-rappido.com',
                        password: bcryptjs_1.default.hashSync('Rappido2024', 10),
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
            fs_1.default.writeFileSync(this.dbPath, JSON.stringify(initialState, null, 2));
            this.dbCache = initialState;
            return initialState;
        }
        try {
            const data = fs_1.default.readFileSync(this.dbPath, 'utf8');
            this.dbCache = JSON.parse(data);
            // Auto-migración: Hashear contraseñas en texto plano si existen
            let updated = false;
            if (this.dbCache.supervisors) {
                this.dbCache.supervisors.forEach((u) => {
                    if (u.password && !u.password.startsWith('$2a$') && !u.password.startsWith('$2b$')) {
                        u.password = bcryptjs_1.default.hashSync(u.password, 10);
                        updated = true;
                    }
                });
            }
            if (this.dbCache.technicians) {
                this.dbCache.technicians.forEach((u) => {
                    if (u.password && !u.password.startsWith('$2a$') && !u.password.startsWith('$2b$')) {
                        u.password = bcryptjs_1.default.hashSync(u.password, 10);
                        updated = true;
                    }
                });
            }
            if (updated) {
                this.persistDB();
            }
            return this.dbCache;
        }
        catch (e) {
            console.error('[DbService] Error crítico leyendo db.json:', e.message);
            throw e;
        }
    }
    persistDB() {
        if (!this.dbCache)
            return;
        try {
            write_file_atomic_1.default.sync(this.dbPath, JSON.stringify(this.dbCache, null, 2));
            this.syncToGoogleDrive();
        }
        catch (e) {
            console.error('[DbService] Error al persistir DB local:', e.message);
        }
    }
    updateDB(newData) {
        const db = this.getDB();
        if (newData.technicians) {
            newData.technicians.forEach((nt) => {
                const ext = db.technicians.find((t) => t.id === nt.id);
                if (ext && !nt.password)
                    nt.password = ext.password;
                if (nt.password && !nt.password.startsWith('$2a$') && !nt.password.startsWith('$2b$')) {
                    nt.password = bcryptjs_1.default.hashSync(nt.password, 10);
                }
            });
            db.technicians = newData.technicians;
        }
        if (newData.supervisors) {
            newData.supervisors.forEach((ns) => {
                const exs = db.supervisors.find((s) => s.id === ns.id);
                if (exs && !ns.password)
                    ns.password = exs.password;
                if (ns.password && !ns.password.startsWith('$2a$') && !ns.password.startsWith('$2b$')) {
                    ns.password = bcryptjs_1.default.hashSync(ns.password, 10);
                }
            });
            db.supervisors = newData.supervisors;
        }
        if (newData.napOverrides)
            db.napOverrides = newData.napOverrides;
        if (newData.trackedNaps)
            db.trackedNaps = newData.trackedNaps;
        if (newData.settings)
            db.settings = { ...db.settings, ...newData.settings };
        this.persistDB();
    }
    async syncFromGoogleDrive() {
        const db = this.getDB();
        const url = db.settings?.googleSheetUrl;
        if (!url || !url.startsWith('http'))
            return;
        try {
            console.log('[DbService] Sincronizando respaldo con Google Drive...');
            const res = await axios_1.default.get(url, { timeout: 10000 });
            if (res.status === 200 && res.data) {
                const cloudData = res.data;
                if (cloudData && (cloudData.supervisors || cloudData.technicians)) {
                    this.dbCache = cloudData;
                    this.persistDB();
                    console.log('[DbService] Sincronización con Google Drive completada exitosamente.');
                }
            }
        }
        catch (e) {
            console.warn('[DbService] Error al sincronizar con Google Drive:', e.message);
        }
    }
    async syncToGoogleDrive() {
        const db = this.getDB();
        const url = db.settings?.googleSheetUrl;
        if (!url || !url.startsWith('http'))
            return;
        try {
            await axios_1.default.post(url, db, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            });
        }
        catch (e) {
            console.warn('[DbService] Error al respaldar en Google Drive:', e.message);
        }
    }
}
exports.DbService = DbService;
exports.dbService = new DbService();
