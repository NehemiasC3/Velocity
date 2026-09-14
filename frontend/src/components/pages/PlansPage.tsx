import React from 'react';
import { Zap, Plus } from 'lucide-react';

export const PlansPage: React.FC = () => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 rounded-xl">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Planes de Velocidad & Tarifas</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Configuración de anchos de banda simétricos/asimétricos y perfiles de cola MikroTik.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer">
            <Plus className="w-4 h-4" />
            <span>Crear Nuevo Plan</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full">Residencial</span>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-3">Fibra 100 Mbps</h3>
          <p className="text-3xl font-extrabold text-blue-600 mt-2">$25<span className="text-sm font-normal text-slate-500">/mes</span></p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border-2 border-blue-500 shadow-md">
          <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 bg-blue-600 text-white rounded-full">Más Popular</span>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-3">Fibra 300 Mbps</h3>
          <p className="text-3xl font-extrabold text-blue-600 mt-2">$35<span className="text-sm font-normal text-slate-500">/mes</span></p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 bg-purple-50 text-purple-600 rounded-full">Corporativo</span>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-3">Giga Pro 1 Gbps</h3>
          <p className="text-3xl font-extrabold text-purple-600 mt-2">$60<span className="text-sm font-normal text-slate-500">/mes</span></p>
        </div>
      </div>
    </div>
  );
};
