import React, { useEffect, useState } from 'react';
import { 
  Search, ShieldCheck, Clock, User, Building2, 
  Truck, CheckCircle, ExternalLink, Package, Wifi,
  AlertTriangle, Radio, Calendar, Filter, RefreshCw,
  FileText, ArrowRight, Layers, Eye
} from 'lucide-react';
import { api } from '../services/api';
import { SerializedItem, AuditLog, WisproClient } from '../types';

interface ForensicAuditModuleProps {
  initialSearch?: string;
}

export const ForensicAuditModule: React.FC<ForensicAuditModuleProps> = ({ initialSearch }) => {
  const [activeView, setActiveView] = useState<'table' | 'timeline'>(initialSearch ? 'timeline' : 'table');

  // Estado para la tabla de Auditoría General
  const [logs, setLogs] = useState<any[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [tableLoading, setTableLoading] = useState(false);
  const [eventTypeFilter, setEventTypeFilter] = useState('TODOS');
  const [freeTextSearch, setFreeTextSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Estado para la Trazabilidad Forense (MAC Timeline)
  const [query, setQuery] = useState(initialSearch || 'F4:8E:38:00:AA:11');
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [result, setResult] = useState<{
    found: boolean;
    item?: SerializedItem;
    clientData?: WisproClient;
    timeline: AuditLog[];
  } | null>(null);

  const demoSuggestions = [
    { label: 'ONU Instalada en Cliente (Wispro OK)', mac: 'F4:8E:38:00:AA:11' },
    { label: 'ONU en Camioneta 01 (Carlos)', mac: 'F4:8E:38:1A:4C:90' },
    { label: 'ONU en Bodega Central', mac: 'F4:8E:38:3C:99:01' },
    { label: 'ONU en Garantía RMA', mac: '78:D6:F0:11:22:33' }
  ];

  // Cargar logs de auditoría para la Data Table
  const fetchAuditLogs = async () => {
    try {
      setTableLoading(true);
      const res = await api.getAnalyticsAuditLogs({
        eventType: eventTypeFilter !== 'TODOS' ? eventTypeFilter : undefined,
        search: freeTextSearch.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: 100
      });
      setLogs(res.logs || []);
      setTotalLogs(res.total || 0);
    } catch (err) {
      console.error('Error cargando logs de auditoría:', err);
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [eventTypeFilter, dateFrom, dateTo]);

  // Búsqueda de MAC individual para la línea de tiempo
  const handleTimelineSearch = async (targetQuery?: string) => {
    const q = (targetQuery || query).trim();
    if (!q) return;

    try {
      setTimelineLoading(true);
      setSearched(true);
      const res = await api.searchForensicMAC(q);
      setResult(res);
      setActiveView('timeline');
    } catch (err) {
      console.error('Error buscando MAC:', err);
    } finally {
      setTimelineLoading(false);
    }
  };

  useEffect(() => {
    if (initialSearch) {
      setQuery(initialSearch);
      handleTimelineSearch(initialSearch);
    }
  }, [initialSearch]);

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'ALTA_INVENTARIO':
        return 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'DESPACHO_TRASLADO':
      case 'RECEPCION_TRASLADO':
      case 'CARGA_VEHICULO':
        return 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800';
      case 'INSTALACION_CLIENTE':
        return 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'RETIRO_CLIENTE':
      case 'REPORTE_RMA':
        return 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      case 'AJUSTE_STOCK':
      case 'CONSUMO_BOBINA':
        return 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'ALTA_INVENTARIO':
        return <Package className="w-4 h-4 text-purple-500" />;
      case 'DESPACHO_TRASLADO':
      case 'RECEPCION_TRASLADO':
        return <Truck className="w-4 h-4 text-sky-500" />;
      case 'INSTALACION_CLIENTE':
        return <Wifi className="w-4 h-4 text-emerald-500" />;
      case 'REPORTE_RMA':
      case 'RETIRO_CLIENTE':
        return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-heading font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-sky-500" />
            <span>Módulo de Auditoría Forense & Trazabilidad</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Registro inmutable de movimientos, despachos, liquidaciones y custodia de materiales de Rappido Panamá.
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
          <button
            onClick={() => setActiveView('table')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeView === 'table'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Data Table General ({totalLogs})</span>
          </button>

          <button
            onClick={() => setActiveView('timeline')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeView === 'timeline'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Línea de Tiempo MAC</span>
          </button>
        </div>
      </div>

      {/* VISTA 1: DATA TABLE GENERAL DE AUDITORÍA */}
      {activeView === 'table' && (
        <div className="space-y-4">
          
          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              
              {/* Free text search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Buscar MAC, Serial, Detalle..."
                  value={freeTextSearch}
                  onChange={(e) => setFreeTextSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchAuditLogs()}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                />
              </div>

              {/* Event Type Filter */}
              <div>
                <select
                  value={eventTypeFilter}
                  onChange={(e) => setEventTypeFilter(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="TODOS">Todos los Eventos</option>
                  <option value="ALTA_INVENTARIO">Alta de Inventario</option>
                  <option value="DESPACHO_TRASLADO">Despacho de Traslado</option>
                  <option value="RECEPCION_TRASLADO">Recepción de Traslado</option>
                  <option value="CARGA_VEHICULO">Carga a Vehículo</option>
                  <option value="INSTALACION_CLIENTE">Instalación en Cliente</option>
                  <option value="RETIRO_CLIENTE">Retiro de Cliente</option>
                  <option value="REPORTE_RMA">Reporte RMA / Cuarentena</option>
                  <option value="CONSUMO_BOBINA">Consumo de Bobina</option>
                  <option value="AJUSTE_STOCK">Ajuste de Stock</option>
                </select>
              </div>

              {/* Date From */}
              <div>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Actions button */}
              <div className="flex gap-2">
                <button
                  onClick={fetchAuditLogs}
                  className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs py-2 px-4 rounded-xl transition shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Filtrar</span>
                </button>
                <button
                  onClick={() => {
                    setEventTypeFilter('TODOS');
                    setFreeTextSearch('');
                    setDateFrom('');
                    setDateTo('');
                  }}
                  className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition"
                  title="Limpiar filtros"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Fecha & Hora</th>
                    <th className="py-3 px-4">Evento</th>
                    <th className="py-3 px-4">MAC / Serial / Bobina</th>
                    <th className="py-3 px-4">Usuario Responsable</th>
                    <th className="py-3 px-4">Origen &rarr; Destino</th>
                    <th className="py-3 px-4">Detalles Técnicos</th>
                    <th className="py-3 px-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tableLoading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-500" />
                        <span>Cargando registros de auditoría forense...</span>
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 italic">
                        No se encontraron registros de auditoría con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        
                        {/* Fecha */}
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString([], {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>

                        {/* Evento */}
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 font-mono font-bold text-[10px] px-2 py-0.5 rounded-md border ${getEventBadge(log.eventType)}`}>
                            {log.eventType}
                          </span>
                        </td>

                        {/* Hardware Target */}
                        <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {log.macAddress || log.serialNumber || log.batchNumber || '—'}
                        </td>

                        {/* Usuario */}
                        <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                          {log.user?.name || log.userName || 'Sistema'}
                        </td>

                        {/* Bodegas */}
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {log.fromWarehouse?.name || log.fromWarehouseName ? (
                            <span>{log.fromWarehouse?.name || log.fromWarehouseName} &rarr; </span>
                          ) : null}
                          <strong>{log.toWarehouse?.name || log.toWarehouseName || '—'}</strong>
                        </td>

                        {/* Detalles */}
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={log.details}>
                          {log.details}
                        </td>

                        {/* Botón Ver Forense */}
                        <td className="py-3 px-4 text-center">
                          {log.macAddress ? (
                            <button
                              onClick={() => {
                                setQuery(log.macAddress);
                                handleTimelineSearch(log.macAddress);
                              }}
                              className="inline-flex items-center gap-1 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-900/60 text-sky-600 dark:text-sky-400 font-bold px-2 py-1 rounded-md text-[11px] transition"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Timeline</span>
                            </button>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* VISTA 2: TRAZABILIDAD FORENSE POR MAC (TIMELINE) */}
      {activeView === 'timeline' && (
        <div className="space-y-6">
          
          {/* Search Input Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <form onSubmit={(e) => { e.preventDefault(); handleTimelineSearch(); }} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-5 h-5 text-sky-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  placeholder="Ingresa la MAC Address (ej. F4:8E:38:00:AA:11) o Número de Serie..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={timelineLoading}
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-xl transition shadow-md shadow-sky-900/20 flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                <span>{timelineLoading ? 'Consultando...' : 'Auditar MAC'}</span>
              </button>
            </form>

            {/* Demo Quick Chips */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 font-semibold">Ejemplos para probar:</span>
              {demoSuggestions.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setQuery(s.mac);
                    handleTimelineSearch(s.mac);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-sky-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-mono border border-slate-200 dark:border-slate-700 transition"
                >
                  <strong>{s.label}:</strong> {s.mac}
                </button>
              ))}
            </div>
          </div>

          {/* Results Section */}
          {searched && result && (
            <div className="space-y-6">
              {!result.found ? (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-6 text-center text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <h4 className="font-bold text-base">Equipo no encontrado</h4>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    No existe ningún registro de hardware con MAC o Serial <strong>{query}</strong> en la base de datos.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Column: Equipment & Wispro Specs */}
                  <div className="lg:col-span-1 space-y-4">
                    
                    {/* Equipment Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ficha Técnica</span>
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                          {result.item?.status}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-lg font-heading font-bold text-slate-900 dark:text-white">
                          {result.item?.brand} {result.item?.model}
                        </h3>
                        <p className="text-xs text-slate-500">Categoría: {result.item?.category}</p>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">MAC Address:</span>
                          <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{result.item?.macAddress}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Número de Serie:</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{result.item?.serialNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Tipo de Hardware:</span>
                          <span className="font-semibold text-sky-600 dark:text-sky-400">{result.item?.category}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Ubicación Actual:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{result.item?.currentWarehouseName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Wispro Client Card if installed */}
                    {result.clientData && (
                      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl p-5 text-white border border-indigo-900/60 shadow-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Contrato Wispro Activo</span>
                          </span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            {result.clientData.status}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-heading font-bold text-base text-white">
                            {result.clientData.name}
                          </h4>
                          <p className="text-xs text-indigo-200">{result.clientData.address}</p>
                        </div>

                        <div className="space-y-1.5 pt-2 border-t border-indigo-800/60 text-xs text-indigo-200">
                          <div className="flex justify-between">
                            <span className="text-indigo-400">Contrato:</span>
                            <span className="font-mono font-bold text-white">{result.clientData.contractId}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-indigo-400">Plan:</span>
                            <span className="font-semibold text-white">{result.clientData.planName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-indigo-400">Nodo OLT:</span>
                            <span className="font-medium text-white">{result.clientData.nodeName}</span>
                          </div>
                        </div>

                        <div className="pt-2">
                          <a 
                            href={`https://cloud.wispro.co/contracts/${result.clientData.contractId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-bold text-sky-400 hover:text-sky-300 hover:underline"
                          >
                            <span>Abrir contrato en Wispro Cloud</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Right Column: Complete Life Cycle Timeline */}
                  <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
                    <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                      <Clock className="w-5 h-5 text-sky-500" />
                      <span>Línea de Tiempo del Equipo (Auditoría Forense)</span>
                    </h3>

                    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                      {result.timeline.length === 0 ? (
                        <p className="text-slate-400 italic text-xs">No hay eventos de auditoría registrados para este serial.</p>
                      ) : (
                        result.timeline.map((event, idx) => (
                          <div key={event.id || idx} className="relative group">
                            
                            {/* Dot */}
                            <div className="absolute -left-[30px] top-0.5 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border-2 border-sky-500 flex items-center justify-center shadow-xs">
                              {getEventIcon(event.eventType)}
                            </div>

                            {/* Event Content */}
                            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/80 rounded-xl p-4 space-y-1.5 transition hover:border-sky-400">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                <span className="font-bold text-xs text-sky-600 dark:text-sky-400 font-mono">
                                  {event.eventType}
                                </span>
                                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(event.timestamp).toLocaleString()}
                                </span>
                              </div>

                              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                                {event.details}
                              </p>

                              <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-500">
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3 text-slate-400" />
                                  Responsable: <strong className="text-slate-700 dark:text-slate-300">{event.userName}</strong>
                                </span>
                                {event.fromWarehouseName && (
                                  <span className="flex items-center gap-1">
                                    De: <strong className="text-slate-700 dark:text-slate-300">{event.fromWarehouseName}</strong>
                                  </span>
                                )}
                                {event.toWarehouseName && (
                                  <span className="flex items-center gap-1">
                                    A: <strong className="text-slate-700 dark:text-slate-300">{event.toWarehouseName}</strong>
                                  </span>
                                )}
                              </div>
                            </div>

                          </div>
                        ))
                      )}
                    </div>

                  </div>

                </div>
              )}
            </div>
          )}

        </div>
      )}

    </div>
  );
};
