import React, { useState } from 'react';
import { Search, History, Package, User, MapPin, HardDrive, Server, FileText } from 'lucide-react';
import { api } from '../services/api';
import { SerializedItem, AuditLog, WisproClient } from '../types';

interface ForensicResult {
  found: boolean;
  item?: SerializedItem;
  clientData?: WisproClient;
  timeline: AuditLog[];
}

export const ForensicSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<ForensicResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await api.searchForensicHistory(query.trim());
      setResult(data);
    } catch (err: any) {
      setError(`Error al buscar: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case 'ALTA_INVENTARIO': return 'bg-green-500';
      case 'INSTALACION_CLIENTE': return 'bg-sky-500';
      case 'DESPACHO_TRASLADO': return 'bg-yellow-500';
      case 'RECEPCION_TRASLADO': return 'bg-blue-500';
      case 'BAJA': return 'bg-red-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div className="space-y-6 bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
      <h2 className="text-xl font-bold font-heading text-white flex items-center gap-2">
        <Search className="w-6 h-6 text-sky-400" />
        Auditoría Forense de Equipos
      </h2>
      
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por MAC, Serial o ID de equipo..."
          className="flex-grow bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 outline-none transition"
        />
        <button type="submit" disabled={isLoading} className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-4 py-2 rounded-xl transition disabled:bg-slate-600">
          {isLoading ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {result && (
        <div className="space-y-4 animate-in fade-in">
          {!result.found ? (
            <p className="text-yellow-400 text-center py-4">No se encontró ningún equipo con el identificador "{query}".</p>
          ) : (
            <>
              {result.item && (
                <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-700 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div><strong className="block text-slate-400">Equipo</strong>{result.item.brand} {result.item.model}</div>
                  <div><strong className="block text-slate-400">MAC</strong><span className="font-mono">{result.item.macAddress}</span></div>
                  <div><strong className="block text-slate-400">Serial</strong><span className="font-mono">{result.item.serialNumber}</span></div>
                  <div><strong className="block text-slate-400">Estado Actual</strong><span className={`font-bold ${result.item.status === 'INSTALADO_CLIENTE' ? 'text-green-400' : 'text-yellow-400'}`}>{result.item.status.replace(/_/g, ' ')}</span></div>
                  {result.item.installedClientName && (
                     <div className="col-span-full"><strong className="block text-slate-400">Ubicación Actual</strong>{result.item.currentWarehouseName}</div>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-lg font-bold font-heading flex items-center gap-2"><History className="w-5 h-5 text-sky-400"/> Línea de Tiempo del Equipo</h3>
                <div className="relative pl-6 border-l-2 border-slate-700 space-y-6">
                  {result.timeline.map(log => (
                    <div key={log.id} className="relative">
                      <div className={`absolute -left-[29px] top-1 w-4 h-4 rounded-full ${getEventTypeColor(log.eventType)} border-4 border-slate-800`}></div>
                      <p className="font-bold text-sky-300">{log.eventType.replace(/_/g, ' ')}</p>
                      <p className="text-slate-300 text-xs">{log.details}</p>
                      <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-4">
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                        {log.userName && <span><User className="w-3 h-3 inline -mt-0.5 mr-1"/>{log.userName}</span>}
                      </div>
                    </div>
                  ))}
                   {result.timeline.length === 0 && <p className="text-slate-400">No hay historial de eventos para este equipo.</p>}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};