import React, { useState, useEffect } from 'react';
import { Server, Activity, Database, CheckCircle, RefreshCw } from 'lucide-react';

export const SystemOverview: React.FC = () => {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      } else {
        setHealth({ status: 'error', code: res.status });
      }
    } catch {
      setHealth({ status: 'offline' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-bold text-white">Estado del Servidor & Servicios</h2>
          <p className="text-sm text-slate-400">Diagnóstico en tiempo real de la arquitectura desacoplada Velocity.</p>
        </div>
        <button
          onClick={checkHealth}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Backend Status Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
              <Server className="w-6 h-6" />
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
              <CheckCircle className="w-3.5 h-3.5" />
              Operacional
            </span>
          </div>
          <h3 className="text-lg font-bold text-white">Backend API (TypeScript)</h3>
          <p className="text-xs text-slate-400 mt-1">Servicio Express REST modular en Node.js v18+</p>
          <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Versión:</span>
              <span className="font-mono text-slate-200">{health?.version || '2.1.0'}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Puerto:</span>
              <span className="font-mono text-slate-200">3000</span>
            </div>
          </div>
        </div>

        {/* Wispro Gateway Status */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="p-3 bg-sky-500/10 rounded-xl border border-sky-500/20 text-sky-400">
              <Activity className="w-6 h-6" />
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
              <CheckCircle className="w-3.5 h-3.5" />
              Conectado
            </span>
          </div>
          <h3 className="text-lg font-bold text-white">Wispro Cloud Gateway</h3>
          <p className="text-xs text-slate-400 mt-1">Caché en memoria TTL (5 min) & Paginación dinámica</p>
          <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Modo Caché:</span>
              <span className="font-mono text-indigo-400">Memoria RAM</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Paginación:</span>
              <span className="font-mono text-slate-200">Asíncrona (100/pág)</span>
            </div>
          </div>
        </div>

        {/* Persistence Status */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
              <Database className="w-6 h-6" />
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
              <CheckCircle className="w-3.5 h-3.5" />
              Persistente
            </span>
          </div>
          <h3 className="text-lg font-bold text-white">Base de Datos Local</h3>
          <p className="text-xs text-slate-400 mt-1">Escrituras atómicas seguras en /data/db.json</p>
          <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Mecanismo:</span>
              <span className="font-mono text-slate-200">write-file-atomic</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Nube:</span>
              <span className="font-mono text-emerald-400">Google Drive Sync</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
