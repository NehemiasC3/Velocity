import React from 'react';
import { Users, UserPlus, Search, Filter, ShieldCheck, MapPin, Phone, Mail } from 'lucide-react';

export const ClientsPage: React.FC = () => {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gestión de Clientes</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Padrón general de abonados de fibra óptica, contratos activos y geolocalización.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer">
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Cliente</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Abonados</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">--</p>
          <span className="text-xs text-blue-600 font-medium">Sincronizado con Wispro</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Activos en Red</p>
          <p className="text-2xl font-bold text-emerald-600 mt-2">--</p>
          <span className="text-xs text-emerald-600 font-medium">Conectividad OK</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Suspendidos / Mora</p>
          <p className="text-2xl font-bold text-amber-600 mt-2">--</p>
          <span className="text-xs text-amber-600 font-medium">Corte administrativo</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Equipos Asignados</p>
          <p className="text-2xl font-bold text-indigo-600 mt-2">--</p>
          <span className="text-xs text-indigo-600 font-medium">ONUs + Routers vinculados</span>
        </div>
      </div>

      {/* Filter / Search & Placeholder Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por Nombre, DNI/Pasaporte, IP o MAC..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl transition-colors">
              <Filter className="w-4 h-4" />
              <span>Filtros</span>
            </button>
          </div>
        </div>

        {/* Empty State / Shell notice */}
        <div className="p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Módulo BSS/OSS: Gestión de Clientes</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mt-1">
            La vista está conectada con el esquema Prisma (<code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">Client</code>). La integración completa con sincronización en tiempo real se habilitará en la siguiente fase.
          </p>
        </div>
      </div>
    </div>
  );
};
