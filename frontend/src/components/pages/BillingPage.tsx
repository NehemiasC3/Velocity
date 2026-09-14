import React from 'react';
import { CreditCard, DollarSign, Download } from 'lucide-react';

export const BillingPage: React.FC = () => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-50 dark:bg-violet-900/30 text-violet-600 rounded-xl">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Facturación & Cobros</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Integración de pagos en línea, pasarelas locales (Yappy Comercial) y conciliación automática.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl transition-all cursor-pointer">
            <Download className="w-4 h-4" />
            <span>Exportar Informe</span>
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-violet-500/20 active:scale-95 cursor-pointer">
            <DollarSign className="w-4 h-4" />
            <span>Registrar Cobro</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recaudación del Mes</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">$0.00</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cuentas por Cobrar</p>
          <p className="text-2xl font-bold text-amber-600 mt-2">$0.00</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pagos Vía Yappy</p>
          <p className="text-2xl font-bold text-blue-600 mt-2">0</p>
        </div>
      </div>
    </div>
  );
};
