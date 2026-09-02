import React, { useState, useRef, useEffect } from 'react';
import { useInventorySearch } from '../hooks/useInventorySearch';
import { InventoryItem } from '../types/inventory';
import {
  Search,
  RefreshCw,
  Server,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  Copy,
  Check,
  Radio,
  SlidersHorizontal,
  Wifi,
  MapPin,
  HelpCircle
} from 'lucide-react';

export const InventorySearch: React.FC = () => {
  const {
    loading,
    error,
    searchTerm,
    setSearchTerm,
    results,
    totalRecords,
    refresh,
    isCached,
    lastUpdated,
    isSyncing
  } = useInventorySearch();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 50;

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Shortcut de teclado: Presionar '/' o 'Cmd+K' para enfocar búsqueda
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && document.activeElement !== searchInputRef.current)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reiniciar a la primera página cuando cambie la búsqueda o el filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Copiar al portapapeles con feedback visual
  const handleCopy = (text: string, id: string) => {
    if (!text || text === 'No asignada' || text === 'No registrada') return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Filtrado adicional por status si el usuario lo selecciona
  const filteredResults = results.filter((item) => {
    if (statusFilter === 'all') return true;
    return item.status.toLowerCase() === statusFilter.toLowerCase();
  });

  // Métricas rápidas
  const activeCount = results.filter((r) => r.status === 'active').length;
  const disabledCount = results.filter((r) => r.status === 'disabled').length;
  const pendingCount = results.filter((r) => r.status === 'pending').length;

  // Paginación visual en cliente para mantener el DOM ultra-rápido con miles de registros
  const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
  const paginatedItems = filteredResults.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 shadow-sm shadow-emerald-950/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Activo
          </span>
        );
      case 'disabled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-950/80 text-rose-400 border border-rose-800/60">
            <XCircle className="w-3.5 h-3.5" />
            Deshabilitado
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950/80 text-amber-400 border border-amber-800/60">
            <Clock className="w-3.5 h-3.5" />
            Pendiente
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-950/80 text-orange-400 border border-orange-800/60">
            <AlertCircle className="w-3.5 h-3.5" />
            Suspendido
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
            <HelpCircle className="w-3.5 h-3.5" />
            {status || 'Desconocido'}
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header & Title Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl shadow-lg shadow-indigo-500/20">
              <Server className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
                Inventario & Búsqueda Instantánea
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800/60">
                  ISP Wispro
                </span>
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Búsqueda difusa (fuzzy search) en tiempo real con 0ms de latencia en catálogo completo.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Cache State */}
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <div className="hidden sm:flex flex-col items-end text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                {(isSyncing as boolean) ? (
                  <span className="text-amber-400 font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                    Sincronizando de fondo...
                  </span>
                ) : isCached ? (
                  <span className="text-indigo-400 font-medium flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    Caché Instantánea (SWR)
                  </span>
                ) : (
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Sincronizado en vivo
                  </span>
                )}
              </span>
              <span>{new Date(lastUpdated).toLocaleTimeString()}</span>
            </div>
          )}

          <button
            onClick={() => refresh()}
            disabled={loading || (isSyncing as boolean)}
            title="Forzar actualización desde la API de Wispro"
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-sm rounded-lg border border-slate-700 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading || (isSyncing as boolean) ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Equipos</span>
            <Server className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {loading && totalRecords === 0 ? '...' : totalRecords.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">Catálogo cargado</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Coincidencias</span>
            <Search className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-sky-400 mt-1">
            {loading && results.length === 0 ? '...' : filteredResults.length.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {searchTerm ? `Filtro: "${searchTerm}"` : 'Sin filtro de texto'}
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Activos</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {loading && totalRecords === 0 ? '...' : activeCount.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">En servicio</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Inactivos / Pend.</span>
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 mt-1">
            {loading && totalRecords === 0 ? '...' : (disabledCount + pendingCount).toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">{disabledCount} desc. | {pendingCount} pend.</div>
        </div>
      </div>

      {/* Main Search Bar & Quick Filters */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 mb-6 backdrop-blur shadow-lg">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {/* Input de Búsqueda Instantánea */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-5 h-5 text-indigo-400" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por cliente, IP, MAC, serial o modelo (ej. Huawei, 10.20..., 00:1A...)..."
              className="w-full pl-11 pr-24 py-3 bg-slate-950/90 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition shadow-inner"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-10 pr-2 flex items-center text-xs text-slate-400 hover:text-white"
              >
                Limpiar
              </button>
            )}
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
              <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-400 bg-slate-800 border border-slate-700 rounded shadow">
                Ctrl+K
              </kbd>
            </div>
          </div>

          {/* Selector de Estado */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-slate-400 hidden sm:inline" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrar por estado"
              className="bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            >
              <option value="all">Todos los Estados</option>
              <option value="active">Activos</option>
              <option value="disabled">Deshabilitados</option>
              <option value="pending">Pendientes</option>
              <option value="suspended">Suspendidos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Message Box */}
      {error && (
        <div className="mb-6 p-4 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-rose-200">Error de Sincronización</p>
            <p className="mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => refresh()}
            className="px-3 py-1 bg-rose-900 hover:bg-rose-800 text-white rounded text-xs font-medium transition"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Table & Content Container */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl shadow-xl overflow-hidden backdrop-blur">
        {loading && totalRecords === 0 ? (
          /* Estado de Carga Inicial (Skeleton Loader) */
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="relative flex items-center justify-center mb-4">
              <div className="w-14 h-14 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
              <Radio className="w-6 h-6 text-indigo-400 absolute animate-pulse" />
            </div>
            <h3 className="text-lg font-semibold text-white">Sincronizando inventario de Wispro</h3>
            <p className="text-sm text-slate-400 max-w-md mt-1">
              Descargando catálogo completo de equipos y clientes para indexación en memoria Fuse.js...
            </p>
          </div>
        ) : filteredResults.length === 0 ? (
          /* Estado Vacío sin Coincidencias */
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white">No se encontraron equipos</h3>
            <p className="text-sm text-slate-400 mt-1">
              No hay coincidencias para el término <span className="text-indigo-400">"{searchTerm}"</span> con los filtros actuales.
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition"
              >
                Limpiar búsqueda
              </button>
            )}
          </div>
        ) : (
          /* Tabla Receptiva de Resultados */
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/70 text-slate-400 uppercase text-[11px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th scope="col" className="py-3.5 px-4 font-semibold">Cliente / Titular</th>
                    <th scope="col" className="py-3.5 px-4 font-semibold">IP Asignada</th>
                    <th scope="col" className="py-3.5 px-4 font-semibold">Dirección MAC</th>
                    <th scope="col" className="py-3.5 px-4 font-semibold">Nº de Serie</th>
                    <th scope="col" className="py-3.5 px-4 font-semibold">Modelo Hardware</th>
                    <th scope="col" className="py-3.5 px-4 font-semibold">Estado</th>
                    <th scope="col" className="py-3.5 px-4 font-semibold">Dirección</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {paginatedItems.map((item: InventoryItem) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Cliente */}
                      <td className="py-3 px-4 font-medium text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-500/70 group-hover:bg-indigo-400"></span>
                          <div>
                            <p className="font-semibold text-slate-100">{item.client_name}</p>
                            <p className="text-[11px] text-slate-500 font-mono">ID: {item.id}</p>
                          </div>
                        </div>
                      </td>

                      {/* IP Asignada */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-sky-400">
                        <div className="flex items-center gap-1.5">
                          <span>{item.ip}</span>
                          {item.ip !== 'No asignada' && (
                            <button
                              onClick={() => handleCopy(item.ip, `ip-${item.id}`)}
                              title="Copiar IP"
                              className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-sky-300 transition"
                            >
                              {copiedId === `ip-${item.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* MAC Address */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-indigo-300">
                        <div className="flex items-center gap-1.5">
                          <span>{item.mac}</span>
                          {item.mac !== 'No registrada' && (
                            <button
                              onClick={() => handleCopy(item.mac, `mac-${item.id}`)}
                              title="Copiar MAC"
                              className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-indigo-300 transition"
                            >
                              {copiedId === `mac-${item.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Serial Number */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-amber-300/90">
                        <div className="flex items-center gap-1.5">
                          <span>{item.serial_number}</span>
                          {item.serial_number !== 'S/N no disponible' && (
                            <button
                              onClick={() => handleCopy(item.serial_number, `sn-${item.id}`)}
                              title="Copiar Serial"
                              className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-amber-300 transition"
                            >
                              {copiedId === `sn-${item.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Modelo */}
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Wifi className="w-3.5 h-3.5 text-slate-500" />
                          <span className="font-medium">{item.model}</span>
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getStatusBadge(item.status)}
                      </td>

                      {/* Dirección */}
                      <td className="py-3 px-4 text-xs text-slate-400 max-w-xs truncate" title={item.address}>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500 flex-shrink-0" />
                          <span className="truncate">{item.address}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls Footer */}
            <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
              <div>
                Mostrando{' '}
                <span className="font-semibold text-white">
                  {Math.min((currentPage - 1) * itemsPerPage + 1, filteredResults.length)}
                </span>{' '}
                a{' '}
                <span className="font-semibold text-white">
                  {Math.min(currentPage * itemsPerPage, filteredResults.length)}
                </span>{' '}
                de <span className="font-semibold text-white">{filteredResults.length}</span> registros filtrados
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    Anterior
                  </button>
                  <span className="px-2 font-medium text-slate-300">
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
