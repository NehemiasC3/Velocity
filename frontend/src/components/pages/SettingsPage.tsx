import React from 'react';
import { Settings, Shield, Globe } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ajustes del Sistema</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Parámetros de conexión, tokens de API, observabilidad en Sentry y preferencias operativas.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-lg">
              <Globe className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">Conexión Wispro Cloud</h3>
          </div>
          <div className="pt-2 text-xs font-mono text-slate-400 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            Endpoint: https://www.cloud.wispro.co/api/v1
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/30 text-purple-600 rounded-lg">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">Observabilidad & Sentry</h3>
          </div>
          <div className="pt-2 text-xs font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
            Sentry DSN Configurado y Activo
          </div>
        </div>
      </div>
    </div>
  );
};
