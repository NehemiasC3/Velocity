import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, Truck, Store, Zap, ShieldAlert, ArrowRight, 
  Package, Search, Filter, CheckCircle2, ChevronRight, RefreshCw,
  Sparkles, Layers, Box, Disc, Cpu, Info
} from 'lucide-react';
import { CriticalStockAlert, WarehouseType } from '../types';

interface CriticalStockAlertsWidgetProps {
  alerts: CriticalStockAlert[];
  isLoading?: boolean;
  onDispatch: (alert: CriticalStockAlert) => void;
  onRefresh?: () => void;
}

export const CriticalStockAlertsWidget: React.FC<CriticalStockAlertsWidgetProps> = ({
  alerts,
  isLoading = false,
  onDispatch,
  onRefresh
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'VEHICULO' | 'SUCURSAL' | 'EXHAUSTED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrado y búsqueda interactiva
  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      // Filtro de tipo
      if (filterType === 'VEHICULO' && alert.warehouseType !== 'VEHICULO') return false;
      if (filterType === 'SUCURSAL' && alert.warehouseType !== 'SUCURSAL') return false;
      if (filterType === 'EXHAUSTED' && !alert.isExhausted) return false;

      // Filtro de texto
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = alert.warehouseName.toLowerCase().includes(query);
        const matchesPlate = (alert.vehiclePlate || '').toLowerCase().includes(query);
        const matchesProduct = alert.productName.toLowerCase().includes(query);
        const matchesSku = alert.sku.toLowerCase().includes(query);
        const matchesCategory = alert.productCategory.toLowerCase().includes(query);
        return matchesName || matchesPlate || matchesProduct || matchesSku || matchesCategory;
      }

      return true;
    });
  }, [alerts, filterType, searchTerm]);

  const vehiclesCount = useMemo(() => alerts.filter(a => a.warehouseType === 'VEHICULO').length, [alerts]);
  const branchesCount = useMemo(() => alerts.filter(a => a.warehouseType === 'SUCURSAL').length, [alerts]);
  const exhaustedCount = useMemo(() => alerts.filter(a => a.isExhausted).length, [alerts]);

  // Si no hay ninguna alerta en todo el sistema
  if (!isLoading && alerts.length === 0) {
    return (
      <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-5 shadow-xs transition-all">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                  Puntos de Reorden Óptimos
                </h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  Stock Seguro
                </span>
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-300/80 mt-0.5">
                Todos los vehículos técnicos y sucursales operan por encima del umbral mínimo de seguridad (<code className="font-mono font-bold">alerta_min</code>).
              </p>
            </div>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition cursor-pointer border border-emerald-300 dark:border-emerald-800"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Verificar Stock</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-white via-white to-amber-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/10 border-2 border-amber-300/80 dark:border-amber-700/60 rounded-2xl shadow-sm overflow-hidden transition-all">
      
      {/* ── HEADER DESTACADO DE ALERTA TEMPRANA ── */}
      <div className="p-4 sm:p-5 border-b border-amber-200/80 dark:border-amber-800/40 bg-gradient-to-r from-amber-500/10 via-rose-500/5 to-transparent">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          <div className="flex items-start gap-3.5">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                <AlertTriangle className="w-6 h-6 animate-bounce" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-600 text-[9px] font-bold text-white items-center justify-center">
                  {alerts.length}
                </span>
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-heading font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Vehículos/Sucursales con Stock Crítico</span>
                </h2>
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
                  Punto de Reorden Requerido
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Monitoreo continuo de stock frente a <code className="font-mono font-semibold text-amber-700 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">alerta_min</code> de catálogo. Abastece a los técnicos antes de que se queden sin insumos para instalaciones.
              </p>
            </div>
          </div>

          {/* Acciones y Filtros Rápidos */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar por técnico, placa, material..."
                className="w-full sm:w-64 pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs font-medium"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[10px] font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isLoading}
                title="Actualizar alertas"
                className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-amber-600 hover:border-amber-300 transition shrink-0 cursor-pointer shadow-2xs"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
              </button>
            )}
          </div>

        </div>

        {/* Chips de Filtros Rápidos */}
        <div className="flex items-center gap-1.5 sm:gap-2 mt-4 flex-wrap text-xs">
          <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filtrar:
          </span>

          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
              filterType === 'ALL'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-amber-300'
            }`}
          >
            <span>Todas las Alertas</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterType === 'ALL' ? 'bg-amber-700 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
              {alerts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('EXHAUSTED')}
            className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
              filterType === 'EXHAUSTED'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 hover:bg-rose-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            <span>Agotados (0)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterType === 'EXHAUSTED' ? 'bg-rose-700 text-white' : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'}`}>
              {exhaustedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('VEHICULO')}
            className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
              filterType === 'VEHICULO'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-400'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-amber-500" />
            <span>Vehículos / Cuadrillas</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              {vehiclesCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('SUCURSAL')}
            className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
              filterType === 'SUCURSAL'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-400'
            }`}
          >
            <Store className="w-3.5 h-3.5 text-sky-500" />
            <span>Sucursales</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              {branchesCount}
            </span>
          </button>
        </div>

      </div>

      {/* ── GRID DE TARJETAS DE ALERTA DE REORDEN ── */}
      <div className="p-4 sm:p-5">
        {filteredAlerts.length === 0 ? (
          <div className="p-8 text-center bg-white/60 dark:bg-slate-900/60 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              No se encontraron alertas para el filtro aplicado.
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Intenta cambiar la búsqueda o seleccionar otra categoría de bodega.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {filteredAlerts.map((alert, idx) => {
              const isVehicle = alert.warehouseType === 'VEHICULO';
              const percentOfMin = alert.minStockAlert > 0
                ? Math.min(100, Math.max(0, (alert.currentQuantity / alert.minStockAlert) * 100))
                : 0;

              return (
                <div
                  key={`${alert.warehouseId}-${alert.productId}-${idx}`}
                  className={`relative flex flex-col justify-between rounded-xl p-4 transition-all duration-200 border bg-white dark:bg-slate-900 shadow-2xs hover:shadow-md ${
                    alert.isExhausted
                      ? 'border-rose-300 dark:border-rose-800/80 hover:border-rose-500'
                      : 'border-amber-200 dark:border-amber-800/60 hover:border-amber-400'
                  }`}
                >
                  {/* Top Bar: Warehouse Identification */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`p-1.5 rounded-lg shrink-0 ${
                          isVehicle 
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' 
                            : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                        }`}>
                          {isVehicle ? <Truck className="w-4 h-4" /> : <Store className="w-4 h-4" />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate" title={alert.warehouseName}>
                            {alert.warehouseName}
                          </p>
                          {alert.vehiclePlate && (
                            <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 inline-block mt-0.5">
                              {alert.vehiclePlate}
                            </span>
                          )}
                        </div>
                      </div>

                      {alert.isExhausted ? (
                        <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-500 text-white uppercase tracking-wider shadow-xs animate-pulse">
                          Agotado
                        </span>
                      ) : (
                        <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800 uppercase tracking-wider">
                          Crítico
                        </span>
                      )}
                    </div>

                    {/* Product & Tracking Details */}
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px]">
                          {alert.trackingType === 'SERIALIZED' && <Cpu className="w-3 h-3" />}
                          {alert.trackingType === 'BULK' && <Box className="w-3 h-3" />}
                          {alert.trackingType === 'BATCHED' && <Disc className="w-3 h-3" />}
                        </span>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug truncate" title={alert.productName}>
                          {alert.productName}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                        <span className="font-mono">SKU: {alert.sku}</span>
                        <span>•</span>
                        <span>{alert.productCategory}</span>
                      </div>
                    </div>

                    {/* Visual Progress & Stock Metric */}
                    <div className="mt-3.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <div className="flex items-baseline justify-between text-xs mb-1.5">
                        <div>
                          <span className="text-[11px] text-slate-500 font-medium">Stock actual: </span>
                          <strong className={`font-mono text-sm ${alert.isExhausted ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-amber-700 dark:text-amber-400 font-bold'}`}>
                            {alert.currentQuantity} {alert.unitOfMeasure.toLowerCase()}
                          </strong>
                        </div>
                        <div className="text-right text-[11px] text-slate-400">
                          <span>Mín: </span>
                          <strong className="text-slate-700 dark:text-slate-300 font-mono">{alert.minStockAlert}</strong>
                        </div>
                      </div>

                      {/* Barra de Progreso */}
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                        <div
                          style={{ width: `${percentOfMin}%` }}
                          className={`h-full rounded-full transition-all duration-300 ${
                            alert.isExhausted
                              ? 'bg-rose-500'
                              : percentOfMin <= 25
                              ? 'bg-rose-500'
                              : 'bg-amber-500'
                          }`}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] mt-1.5 text-slate-500">
                        <span className="font-medium text-rose-600 dark:text-rose-400">
                          Déficit: -{alert.deficit} {alert.unitOfMeasure.toLowerCase()}
                        </span>
                        <span>
                          {alert.isExhausted ? '0% del mínimo' : `${Math.round(percentOfMin)}% del stock requerido`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── BOTÓN DE ACCIÓN RÁPIDA: DESPACHAR AHORA ── */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => onDispatch(alert)}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-bold transition-all shadow-xs hover:shadow active:scale-98 cursor-pointer group"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-200 group-hover:scale-110 transition-transform" />
                      <span>Despachar ahora</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                    {alert.hubWarehouseName && (
                      <p className="text-[10px] text-center text-slate-400 mt-1 truncate">
                        Origen: <span className="font-medium text-slate-600 dark:text-slate-300">{alert.hubWarehouseName}</span>
                      </p>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
