import React, { useEffect, useState } from 'react';
import { 
  Search, ShieldCheck, Clock, User, Building2, 
  Truck, CheckCircle, ExternalLink, Package, Wifi,
  AlertTriangle, Radio, Calendar
} from 'lucide-react';
import { api } from '../services/api';
import { SerializedItem, AuditLog, WisproClient } from '../types';

interface ForensicAuditModuleProps {
  initialSearch?: string;
}

export const ForensicAuditModule: React.FC<ForensicAuditModuleProps> = ({ initialSearch }) => {
  const [query, setQuery] = useState(initialSearch || 'F4:8E:38:00:AA:11');
  const [loading, setLoading] = useState(false);
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

  const handleSearch = async (targetQuery?: string) => {
    const q = (targetQuery || query).trim();
    if (!q) return;

    try {
      setLoading(true);
      setSearched(true);
      const res = await api.searchForensicMAC(q);
      setResult(res);
    } catch (err) {
      console.error('Error buscando MAC:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialSearch) {
      setQuery(initialSearch);
      handleSearch(initialSearch);
    } else {
      handleSearch('F4:8E:38:00:AA:11');
    }
  }, [initialSearch]);

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
        return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-heading font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-sky-500" />
          <span>Auditoría Forense & Trazabilidad de ONUs</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          Rastreo de ciclo de vida completo: Cuándo se compró &rarr; A qué sucursal fue &rarr; Qué técnico la tuvo &rarr; A qué cliente se le instaló (Wispro).
        </p>
      </div>

      {/* Search Input Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex flex-col sm:flex-row gap-3">
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
            disabled={loading}
            className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-xl transition shadow-md shadow-sky-900/20 flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4" />
            <span>{loading ? 'Consultando...' : 'Auditar MAC'}</span>
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
                handleSearch(s.mac);
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
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3">
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
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
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
  );
};
