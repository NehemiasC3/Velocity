import React, { useState, useMemo } from 'react';
import { 
  Truck, Store, Zap, ArrowRight, 
  Search, Filter, CheckCircle2, RefreshCw,
  Box, Disc, Cpu
} from 'lucide-react';
import { CriticalStockAlert } from '../types';

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
  const [filterType, setFilterType] = useState<'ALL' | 'VEHICULO' | 'SUCURSAL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrado y búsqueda interactiva
  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      // Filtro de tipo
      if (filterType === 'VEHICULO' && alert.warehouseType !== 'VEHICULO') return false;
      if (filterType === 'SUCURSAL' && alert.warehouseType !== 'SUCURSAL') return false;

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

  // Si no hay ninguna alerta en todo el sistema
  if (!isLoading && alerts.length === 0) {
    return (
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs transition-all">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Puntos de Reorden Óptimos
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Todos los vehículos técnicos y sucursales operan con stock suficiente para la operación.
              </p>
            </div>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer border border-slate-200 dark:border-slate-700"
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
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden transition-all">
      
      {/* ── HEADER LIMPIO Y CORPORATIVO ── */}
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0">
              <Box className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-heading font-bold text-slate-900 dark:text-white">
                  Sugerencias de Despacho y Reabastecimiento
                </h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {alerts.length} sugerencias
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Control de insumos por vehículo y sucursal según el umbral mínimo operativo.
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
                className="w-full sm:w-64 pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 shadow-2xs font-medium"
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
                title="Actualizar datos"
                className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 transition shrink-0 cursor-pointer shadow-2xs"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-slate-500' : ''}`} />
              </button>
            )}
          </div>

        </div>

        {/* Chips de Filtros Rápidos */}
        <div className="flex items-center gap-1.5 sm:gap-2 mt-3.5 flex-wrap text-xs">
          <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filtrar:
          </span>

          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
              filterType === 'ALL'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-300'
            }`}
          >
            <span>Todos</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterType === 'ALL' ? 'bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
              {alerts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('VEHICULO')}
            className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
              filterType === 'VEHICULO'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-300'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-slate-500" />
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
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-300'
            }`}
          >
            <Store className="w-3.5 h-3.5 text-slate-500" />
            <span>Sucursales</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              {branchesCount}
            </span>
          </button>
        </div>

      </div>

      {/* ── GRID DE TARJETAS LIMPIAS (SIN BADGES, SIN ROJO, SIN DÉFICIT) ── */}
      <div className="p-4 sm:p-5">
        {filteredAlerts.length === 0 ? (
          <div className="p-8 text-center bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              No se encontraron registros para el filtro aplicado.
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
                  className="relative flex flex-col justify-between rounded-xl p-4 transition-all duration-200 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs hover:shadow-sm"
                >
                  {/* Top Bar: Warehouse Identification */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="p-1.5 rounded-lg shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
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

                    {/* Stock Metric - Neutralizado a text-slate-800 */}
                    <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <div className="flex items-baseline justify-between text-xs mb-1.5">
                        <div>
                          <span className="text-[11px] text-slate-500 font-medium">Stock actual: </span>
                          <strong className="font-mono text-sm text-slate-800 dark:text-slate-200 font-bold">
                            {alert.currentQuantity} {alert.unitOfMeasure.toLowerCase()}
                          </strong>
                        </div>
                        <div className="text-right text-[11px] text-slate-400">
                          <span>Mín: </span>
                          <strong className="text-slate-700 dark:text-slate-300 font-mono">{alert.minStockAlert}</strong>
                        </div>
                      </div>

                      {/* Barra de Progreso Neutral */}
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                        <div
                          style={{ width: `${percentOfMin}%` }}
                          className="h-full rounded-full bg-slate-400 dark:bg-slate-500 transition-all duration-300"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ── BOTÓN DE ACCIÓN RÁPIDA: DESPACHAR AHORA (INTACTO) ── */}
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

