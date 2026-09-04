import React, { useEffect, useState } from 'react';
import { 
  Package, AlertTriangle, Truck, ShieldAlert, 
  Search, ArrowRight, CheckCircle2, TrendingUp, RefreshCw,
  Building2, Radio, CheckSquare, Zap, PlusCircle, Award,
  Flame, BarChart3, Clock, User, ShieldCheck, Camera
} from 'lucide-react';
import { api } from '../services/api';
import { DashboardKPIs, AuditLog, AnalyticsKPIs } from '../types';
import { LiquidationModal } from './LiquidationModal';

interface DashboardHomeProps {
  onNavigateTab: (tab: string, param?: string) => void;
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({ onNavigateTab }) => {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsKPIs | null>(null);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [quickMacSearch, setQuickMacSearch] = useState('');
  const [showLiquidationModal, setShowLiquidationModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [kpiRes, logsRes, analyticsRes] = await Promise.all([
        api.getDashboardKPIs().catch(() => null),
        api.getAuditLogs().catch(() => ({ logs: [] })),
        api.getAnalyticsKPIs().catch(() => ({ success: false, kpis: null }))
      ]);

      if (kpiRes) setKpis(kpiRes);
      if (analyticsRes?.kpis) setAnalytics(analyticsRes.kpis);
      setRecentLogs(logsRes?.logs?.slice(0, 6) || []);
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

  // Calcular valor máximo para escalar las barras de los últimos 7 días
  const maxMeters = analytics?.daily_cable_consumption_7d?.length
    ? Math.max(...analytics.daily_cable_consumption_7d.map(d => d.meters), 100)
    : 500;

  if (loading && !kpis && !analytics) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <RefreshCw className="w-8 h-8 animate-spin text-sky-500" />
          <p className="text-sm font-medium">Cargando métricas de inventario y analítica...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Top Welcome & Quick Actions (Clean Corporate Light Mode) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <Radio className="w-3 h-3 animate-pulse text-emerald-600 dark:text-emerald-400" /> Sistema Operativo
            </span>
            <span className="text-xs text-slate-400">Hub & Spoke • Wispro Sync • Auditoría Forense</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-heading font-bold text-slate-900 dark:text-white">
            Panel Gerencial & Mesa de Control ISP
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500 leading-relaxed">
            Control de hardware en bodegas, cuadrillas móviles y consumo de materiales de fibra óptica en tiempo real.
          </p>
        </div>

        {/* Quick Actions & Search Box */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => setShowLiquidationModal(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
          >
            <Zap className="w-4 h-4" />
            <span>+ Liquidar Material</span>
          </button>

          <button
            onClick={() => onNavigateTab('rma')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
          >
            <span>🔄 Retiro RMA</span>
          </button>

          <form 
            onSubmit={handleSearchSubmit} 
            className="w-full sm:w-80 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 flex items-center shadow-xs transition-all focus-within:border-sky-500"
          >
            <Search className="w-4 h-4 text-sky-500 ml-2 mr-1.5 shrink-0" />
            <input
              type="text"
              placeholder="Buscar MAC, ONU, Cliente..."
              value={quickMacSearch}
              onChange={(e) => setQuickMacSearch(e.target.value)}
              onClick={() => {
                if (!quickMacSearch) {
                  window.dispatchEvent(new CustomEvent('open-command-palette'));
                }
              }}
              className="bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none w-full font-mono"
            />
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
              className="p-1.5 rounded-lg text-slate-400 hover:text-sky-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition mr-1"
              title="Abrir Escáner de Cámara / Búsqueda Global (Ctrl+K)"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <button
              type="submit"
              className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shrink-0 shadow-xs"
            >
              Buscar
            </button>
          </form>
        </div>
      </div>

      {/* 4 Tarjetas de Resumen Gerencial (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: ONUs Activas en Operación (Verde) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-950 p-5 shadow-xs relative overflow-hidden group hover:border-emerald-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              ONUs Activas
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white font-heading">
              {analytics?.total_active_onus ?? kpis?.totalSerializedActive ?? 0}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>En Bodegas y Camionetas</span>
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>Instaladas en Clientes:</span>
            <strong className="text-slate-800 dark:text-slate-200 font-mono">
              {analytics?.total_installed_onus ?? kpis?.onusByStatus.instaladoCliente ?? 0}
            </strong>
          </div>
        </div>

        {/* KPI 2: Equipos en Cuarentena / RMA (Rojo) */}
        <div 
          onClick={() => onNavigateTab('rma')}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-950 p-5 shadow-xs relative overflow-hidden group hover:border-rose-400 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              Cuarentena / RMA
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white font-heading">
              {analytics?.total_quarantine_onus ?? kpis?.rmaCount ?? 0}
            </h3>
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1 font-medium">
              Equipos defectuosos o dañados
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-rose-600 dark:text-rose-400">
            <span>Gestionar Garantías</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* KPI 3: Consumo Mensual de Cable Drop (Azul / Cian) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-sky-200 dark:border-sky-950 p-5 shadow-xs relative overflow-hidden group hover:border-sky-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-sky-500" />
              Consumo de Cable
            </span>
            <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Flame className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white font-heading font-mono">
                {analytics?.monthly_cable_consumption ?? 0}
              </h3>
              <span className="text-sm font-bold text-slate-400">metros</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Descontados en liquidaciones este mes
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>Tickets Cerrados:</span>
            <strong className="text-slate-800 dark:text-slate-200 font-mono">
              {analytics?.total_tickets_month ?? 0}
            </strong>
          </div>
        </div>

        {/* KPI 4: Top Técnicos / Cuadrillas (Dorado / Índigo) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-950 p-5 shadow-xs relative overflow-hidden group hover:border-amber-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-500" />
              Líderes de Campo
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 space-y-1.5">
            {analytics?.top_technicians && analytics.top_technicians.length > 0 ? (
              analytics.top_technicians.slice(0, 3).map((t, idx) => (
                <div key={t.technicianId || idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{t.technicianName}</span>
                  </div>
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 shrink-0 font-mono">
                    {t.closedTickets} {t.closedTickets === 1 ? 'ord.' : 'ords.'}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 italic py-2">Sin liquidaciones registradas este mes</p>
            )}
          </div>
        </div>

      </div>

      {/* Gráfico de Barras: Consumo de Cable de los Últimos 7 Días */}
      {analytics?.daily_cable_consumption_7d && analytics.daily_cable_consumption_7d.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <h3 className="text-base font-heading font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-sky-500" />
                <span>Tendencia de Consumo de Cable Drop (Últimos 7 Días)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Metros lineales de fibra óptica instalados diariamente por el equipo técnico
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-sky-500" />
                <span>Metros instalados</span>
              </span>
            </div>
          </div>

          {/* Gráfico con barras estilizadas */}
          <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-48 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800">
            {analytics.daily_cable_consumption_7d.map((day, idx) => {
              const heightPercent = maxMeters > 0 ? Math.max((day.meters / maxMeters) * 100, 4) : 4;
              const isToday = idx === analytics.daily_cable_consumption_7d.length - 1;

              return (
                <div key={day.date} className="flex flex-col items-center gap-2 h-full justify-end group relative">
                  {/* Tooltip con el valor exacto */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-slate-900 text-white text-[10px] font-bold py-1 px-2 rounded-md shadow-lg pointer-events-none whitespace-nowrap z-20">
                    {day.meters} metros
                  </div>

                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 font-mono">
                    {day.meters > 0 ? `${day.meters}m` : '0m'}
                  </span>

                  <div className="w-full max-w-[48px] bg-slate-100 dark:bg-slate-800 rounded-t-lg overflow-hidden flex items-end h-32">
                    <div 
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t-lg transition-all duration-500 ${
                        isToday 
                          ? 'bg-gradient-to-t from-sky-600 to-sky-400 shadow-md shadow-sky-500/20' 
                          : 'bg-gradient-to-t from-slate-600 to-sky-500 group-hover:from-sky-500 group-hover:to-sky-400'
                      }`}
                    />
                  </div>

                  <span className={`text-[11px] font-bold ${isToday ? 'text-sky-600 dark:text-sky-400 font-extrabold' : 'text-slate-500'}`}>
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Critical Stock Alert Banner if any */}
      {kpis?.criticalStockAlerts && kpis.criticalStockAlerts.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 rounded-2xl p-4 shadow-xs">
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
              className="shrink-0 inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition shadow-xs"
            >
              <span>Despachar Stock</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Grid: Estado de Equipos & Actividad Reciente de Auditoría */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Estado Global del Hardware */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-heading font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-sky-500" />
              <span>Distribución de ONUs</span>
            </h3>
            <span className="text-xs font-bold text-slate-400 font-mono">
              {kpis?.totalWarehouses ?? analytics?.total_warehouses ?? 0} Bodegas
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">En Bodegas Hub/Sucursal</span>
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                {kpis?.onusByStatus?.enBodega ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">En Camionetas de Técnicos</span>
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                {kpis?.onusByStatus?.enVehiculo ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Instaladas en Clientes</span>
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                {analytics?.total_installed_onus ?? kpis?.onusByStatus?.instaladoCliente ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-rose-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">En Cuarentena / RMA</span>
              </div>
              <span className="text-sm font-bold text-rose-600 dark:text-rose-400 font-mono">
                {analytics?.total_quarantine_onus ?? kpis?.onusByStatus?.rmaDefectuoso ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* Últimos Movimientos Forenses */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-heading font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sky-500" />
                <span>Últimos Movimientos de Auditoría</span>
              </h3>
              <p className="text-xs text-slate-500">Trazabilidad inmutable de traslados, liquidaciones y altas</p>
            </div>
            <button
              onClick={() => onNavigateTab('audit')}
              className="text-xs font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400 flex items-center gap-1"
            >
              <span>Ver Auditoría Completa</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {recentLogs.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">No hay registros de auditoría recientes.</p>
            ) : (
              recentLogs.map((log, idx) => (
                <div 
                  key={log.id || idx}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                        {log.eventType}
                      </span>
                      {log.macAddress && (
                        <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                          {log.macAddress}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 text-xs truncate">
                      {log.details}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>Por: <strong className="text-slate-600 dark:text-slate-300">{log.userName || 'Usuario'}</strong></span>
                      {log.toWarehouseName && (
                        <span>Destino: <strong className="text-slate-600 dark:text-slate-300">{log.toWarehouseName}</strong></span>
                      )}
                    </div>
                  </div>

                  <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Modal de Liquidación Rápida */}
      <LiquidationModal
        isOpen={showLiquidationModal}
        onClose={() => setShowLiquidationModal(false)}
        onSuccess={() => {
          setShowLiquidationModal(false);
          loadData();
        }}
      />

    </div>
  );
};
