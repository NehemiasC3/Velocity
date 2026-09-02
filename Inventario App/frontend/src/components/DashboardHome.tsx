import React, { useEffect, useState } from 'react';
import { 
  DollarSign, Package, AlertTriangle, Truck, ShieldAlert, 
  Search, ArrowRight, CheckCircle2, TrendingUp, RefreshCw,
  Building2, Radio, CheckSquare, Zap
} from 'lucide-react';
import { api } from '../services/api';
import { DashboardKPIs, AuditLog } from '../types';

interface DashboardHomeProps {
  onNavigateTab: (tab: string, param?: string) => void;
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({ onNavigateTab }) => {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [quickMacSearch, setQuickMacSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [kpiRes, logsRes] = await Promise.all([
        api.getDashboardKPIs(),
        api.getAuditLogs()
      ]);
      setKpis(kpiRes);
      setRecentLogs(logsRes.logs.slice(0, 5));
    } catch (err) {
      console.error('Error cargando KPIs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickMacSearch.trim()) {
      onNavigateTab('audit', quickMacSearch.trim());
    }
  };

  if (loading || !kpis) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <RefreshCw className="w-8 h-8 animate-spin text-sky-500" />
          <p className="text-sm font-medium">Cargando métricas de inventario y Wispro...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Top Welcome & Quick Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 rounded-2xl p-6 text-white border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Radio className="w-3 h-3 animate-pulse" /> Sistema Operativo
              </span>
              <span className="text-xs text-slate-400">Hub-and-Spoke + Wispro Sync</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-white">
              Gestión Integral de Inventario & Operaciones ISP
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Controla el flujo de hardware desde la Bodega Principal hasta la camioneta del instalador con inyección directa de MACs en Wispro.
            </p>
          </div>

          {/* Quick MAC Lookup Search Box */}
          <form onSubmit={handleSearchSubmit} className="w-full md:w-80 bg-slate-800/90 border border-slate-700/80 rounded-xl p-2 flex items-center shadow-lg">
            <Search className="w-4 h-4 text-sky-400 ml-2 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Buscar MAC o Serial..."
              value={quickMacSearch}
              onChange={(e) => setQuickMacSearch(e.target.value)}
              className="bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none w-full"
            />
            <button
              type="submit"
              className="bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition shrink-0"
            >
              Auditar
            </button>
          </form>
        </div>
      </div>

      {/* Critical Stock Alert Banner if any */}
      {kpis.criticalStockAlerts.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500 text-white rounded-xl shadow-md shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  ¡Atención! {kpis.criticalStockAlerts.length} alertas de Stock Crítico en Sucursales
                </h4>
                <p className="text-xs text-amber-800 dark:text-amber-300/90 mt-0.5">
                  El inventario está por debajo del umbral mínimo de seguridad en las siguientes bodegas:
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {kpis.criticalStockAlerts.map((alert, idx) => (
                    <span 
                      key={idx}
                      className="inline-flex items-center gap-1.5 text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 text-slate-800 dark:text-slate-200 px-2.5 py-1 rounded-lg font-medium shadow-2xs"
                    >
                      <strong className="text-amber-700 dark:text-amber-400">{alert.warehouseName}:</strong> {alert.bulkItemName} ({alert.currentQuantity} {alert.unitOfMeasure} disponibles &lt; mín {alert.minStockAlert})
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('transfers')}
              className="shrink-0 inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition shadow-sm"
            >
              <span>Generar Traslado</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 4 Main KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Equipos Activos */}
        <div className="glass-panel bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Equipos en Sistema</span>
            <div className="p-2 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-heading font-extrabold text-slate-900 dark:text-white">
              {kpis.totalSerializedActive}
            </h3>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-purple-500" />
              <span>ONUs & Routers en Bodegas, Móviles y Clientes</span>
            </p>
          </div>
        </div>

        {/* Card 2: ONUs en Operación */}
        <div className="glass-panel bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ONUs & Routers</span>
            <div className="p-2 rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl sm:text-3xl font-heading font-extrabold text-slate-900 dark:text-white">
                {kpis.onusByStatus.enBodega + kpis.onusByStatus.enVehiculo + kpis.onusByStatus.enTransito}
              </h3>
              <span className="text-xs text-slate-500 font-medium">disponibles</span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-600 dark:text-slate-400">
              <span className="text-sky-600 dark:text-sky-400 font-semibold">{kpis.onusByStatus.enBodega} en Bodegas</span>
              <span>•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{kpis.onusByStatus.enVehiculo} en Vehículos</span>
            </div>
          </div>
        </div>

        {/* Card 3: Órdenes en Tránsito */}
        <div className="glass-panel bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">En Tránsito (Spokes)</span>
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-heading font-extrabold text-slate-900 dark:text-white">
              {kpis.pendingTransfersCount}
            </h3>
            <p className="text-xs text-slate-500 mt-1 flex items-center justify-between">
              <span>Órdenes pendientes de recepción</span>
              <button 
                onClick={() => onNavigateTab('transfers')}
                className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
              >
                Ver &rarr;
              </button>
            </p>
          </div>
        </div>

        {/* Card 4: Garantías RMA */}
        <div className="glass-panel bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Equipos en RMA</span>
            <div className="p-2 rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl sm:text-3xl font-heading font-extrabold text-rose-600 dark:text-rose-400">
              {kpis.rmaCount}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Equipos defectuosos en trámite de garantía con proveedor
            </p>
          </div>
        </div>

      </div>

      {/* Grid: Estados de Inventario y Actividad Reciente */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Hardware Status Breakdown */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Package className="w-4 h-4 text-sky-500" />
            <span>Distribución de ONUs & Routers</span>
          </h3>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-600 dark:text-slate-400">En Bodega Central / Sucursales</span>
                <span className="font-bold text-slate-900 dark:text-white">{kpis.onusByStatus.enBodega}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                <div className="bg-sky-500 h-2 rounded-full" style={{ width: `${(kpis.onusByStatus.enBodega / 15) * 100}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-600 dark:text-slate-400">En Camionetas de Técnicos</span>
                <span className="font-bold text-slate-900 dark:text-white">{kpis.onusByStatus.enVehiculo}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${(kpis.onusByStatus.enVehiculo / 15) * 100}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-600 dark:text-slate-400">Instaladas en Clientes (Wispro)</span>
                <span className="font-bold text-slate-900 dark:text-white">{kpis.onusByStatus.instaladoCliente}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${(kpis.onusByStatus.instaladoCliente / 15) * 100}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-600 dark:text-slate-400">En Tránsito / Despacho</span>
                <span className="font-bold text-slate-900 dark:text-white">{kpis.onusByStatus.enTransito}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${(kpis.onusByStatus.enTransito / 15) * 100}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-600 dark:text-slate-400">Garantías RMA</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">{kpis.onusByStatus.rmaDefectuoso}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                <div className="bg-rose-500 h-2 rounded-full" style={{ width: `${(kpis.onusByStatus.rmaDefectuoso / 15) * 100}%` }}></div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => onNavigateTab('warehouses')}
              className="w-full text-center text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline py-1"
            >
              Explorar inventario completo por bodega &rarr;
            </button>
          </div>
        </div>

        {/* Recent Audit Timeline Activity */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Registro de Movimientos & Auditoría en Vivo</span>
            </h3>
            <button
              onClick={() => onNavigateTab('audit')}
              className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
            >
              Ver todas las trazas
            </button>
          </div>

          <div className="space-y-3">
            {recentLogs.map((log) => (
              <div 
                key={log.id} 
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-start justify-between gap-3 text-xs transition hover:border-slate-300 dark:hover:border-slate-600"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 font-mono text-[11px]">
                      {log.eventType}
                    </span>
                    {log.macAddress && (
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        MAC: {log.macAddress}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">{log.details}</p>
                  <p className="text-[11px] text-slate-400">Por: {log.userName}</p>
                </div>

                <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
