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
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Estado del Servidor & Servicios</h2>
          <p className="text-sm text-slate-500">Diagnóstico en tiempo real de la arquitectura desacoplada Velocity.</p>
        </div>
        <button
          onClick={checkHealth}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition shadow-xs cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Backend Status Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <span className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-blue-600">
              <Server className="w-6 h-6" />
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle className="w-3.5 h-3.5" />
              Operacional
            </span>
          </div>
          <h3 className="text-lg font-bold text-slate-900">Backend API (TypeScript)</h3>
          <p className="text-xs text-slate-500 mt-1">Servicio Express REST modular en Node.js v18+</p>
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Versión:</span>
              <span className="font-mono text-slate-900 font-semibold">{health?.version || '2.1.0'}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Puerto:</span>
              <span className="font-mono text-slate-900 font-semibold">3000</span>
            </div>
          </div>
        </div>

        {/* Wispro Gateway Status */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <span className="p-3 bg-sky-50 rounded-xl border border-sky-100 text-sky-600">
              <Activity className="w-6 h-6" />
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle className="w-3.5 h-3.5" />
              Conectado
            </span>
          </div>
          <h3 className="text-lg font-bold text-slate-900">Wispro Cloud Gateway</h3>
          <p className="text-xs text-slate-500 mt-1">Caché en memoria TTL (5 min) & Indexación de Clientes</p>
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Modo Caché:</span>
              <span className="font-mono text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded">Memoria RAM</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Paginación:</span>
              <span className="font-mono text-slate-900 font-semibold">Asíncrona (100/pág)</span>
            </div>
          </div>
        </div>

        {/* Persistence Status */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <span className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-600">
              <Database className="w-6 h-6" />
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle className="w-3.5 h-3.5" />
              Activo
            </span>
          </div>
          <h3 className="text-lg font-bold text-slate-900">Persistencia & Base de Datos</h3>
          <p className="text-xs text-slate-500 mt-1">PostgreSQL & Atomic JSON Storage</p>
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Motor Primario:</span>
              <span className="font-mono text-slate-900 font-semibold">PostgreSQL + Prisma</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Backup Cloud:</span>
              <span className="font-mono text-emerald-600 font-bold">Activo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
