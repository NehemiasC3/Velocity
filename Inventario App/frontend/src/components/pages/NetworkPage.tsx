import React from 'react';
import { Network, Server, HardDrive, Activity, Plus, Shield, CheckCircle2, RefreshCw } from 'lucide-react';

export const NetworkPage: React.FC = () => {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl">
            <Network className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Red & Infraestructura</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Control de Routers MikroTik (RouterOS v7), Cabeceras OLT (Huawei/ZTE/VSOL) y monitoreo de enlaces.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl transition-all cursor-pointer">
            <RefreshCw className="w-4 h-4" />
            <span>Sondear Red</span>
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-indigo-500/20 active:scale-95 cursor-pointer">
            <Plus className="w-4 h-4" />
            <span>Añadir Router / OLT</span>
          </button>
        </div>
      </div>

      {/* Network Equipment Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* MikroTik Section */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-lg">
                <Server className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white">Routers MikroTik (RouterOS v7)</h3>
            </div>
            <span className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full font-semibold">RouterServer</span>
          </div>
          <p className="text-sm text-slate-500">
            Administración de pools PPPoE, colas simples / queues de ancho de banda y API Port (8728).
          </p>
          <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center">
            <Activity className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Sin servidores registrados aún</p>
            <span className="text-xs text-slate-400">Configurable desde el modelo Prisma RouterServer</span>
          </div>
        </div>

        {/* OLT Devices Section */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 rounded-lg">
                <HardDrive className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white">Cabeceras Ópticas OLT</h3>
            </div>
            <span className="text-xs px-2.5 py-1 bg-cyan-50 text-cyan-600 rounded-full font-semibold">OltDevice</span>
          </div>
          <p className="text-sm text-slate-500">
            Gestión de puertos PON, perfiles GPON/EPON (Huawei, ZTE, VSOL) y aprovisionamiento automático.
          </p>
          <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center">
            <Activity className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Sin dispositivos OLT registrados aún</p>
            <span className="text-xs text-slate-400">Configurable desde el modelo Prisma OltDevice</span>
          </div>
        </div>
      </div>
    </div>
  );
};
