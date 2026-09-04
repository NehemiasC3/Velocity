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
    if (!text || text === 'No asignada' || text === 'No registrada' || text.startsWith('S/N no')) return;
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Activo
          </span>
        );
      case 'disabled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            Deshabilitado
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            Pendiente
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
            <AlertCircle className="w-3.5 h-3.5" />
            Suspendido
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <HelpCircle className="w-3.5 h-3.5" />
            {status || 'Desconocido'}
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header & Title Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl shadow-md shadow-blue-500/20 text-white">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
                Inventario & Búsqueda Instantánea
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  Wispro Cloud
                </span>
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Búsqueda ultra-rápida en catálogo completo de contratos, ONUs y clientes Wispro.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Cache State */}
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <div className="hidden sm:flex flex-col items-end text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                {(isSyncing as boolean) ? (
                  <span className="text-amber-600 font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                    Sincronizando con Wispro...
                  </span>
                ) : isCached ? (
                  <span className="text-blue-600 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    Caché en Memoria (SWR)
                  </span>
                ) : (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    En Vivo
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
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm rounded-xl border border-slate-300 transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading || (isSyncing as boolean) ? 'animate-spin text-blue-600' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards (Pure White & Clean Borders) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Equipos</span>
            <Server className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {loading && totalRecords === 0 ? '...' : totalRecords.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">Catálogo Wispro</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Coincidencias</span>
            <Search className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-sky-600 mt-1">
            {loading && results.length === 0 ? '...' : filteredResults.length.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 mt-0.5 truncate">
            {searchTerm ? `Filtro: "${searchTerm}"` : 'Sin filtro de texto'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Activos</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {loading && totalRecords === 0 ? '...' : activeCount.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">En servicio</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Inactivos / Pend.</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-600 mt-1">
            {loading && totalRecords === 0 ? '...' : (disabledCount + pendingCount).toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">{disabledCount} desc. | {pendingCount} pend.</div>
        </div>
      </div>

      {/* Main Search Bar & Quick Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {/* Input de Búsqueda Instantánea */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-5 h-5 text-blue-600" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por cliente, IP, MAC, serial o modelo (ej. Huawei, 10.20..., 00:1A...)..."
              className="w-full pl-11 pr-24 py-3 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-inner font-sans"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-12 pr-2 flex items-center text-xs text-slate-400 hover:text-slate-700 font-medium"
              >
                Limpiar
              </button>
            )}
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
              <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-500 bg-slate-100 border border-slate-300 rounded shadow-xs">
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
              className="bg-white border border-slate-300 text-slate-700 text-sm rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-medium shadow-xs"
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
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-bold text-rose-800">Error de Sincronización</p>
            <p className="mt-0.5 text-rose-600">{error}</p>
          </div>
          <button
            onClick={() => refresh()}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Table & Content Container (Clean White Wispro Table) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {loading && totalRecords === 0 ? (
          /* Estado de Carga Inicial */
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="relative flex items-center justify-center mb-4">
              <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-600 rounded-full animate-spin"></div>
              <Radio className="w-5 h-5 text-blue-600 absolute animate-pulse" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Sincronizando inventario de Wispro Cloud</h3>
            <p className="text-xs text-slate-500 max-w-md mt-1">
              Descargando catálogo completo de contratos, clientes y ONUs para indexación instantánea...
            </p>
          </div>
        ) : filteredResults.length === 0 ? (
          /* Estado Vacío sin Coincidencias */
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No se encontraron equipos</h3>
            <p className="text-xs text-slate-500 mt-1">
              No hay coincidencias para el término <span className="text-blue-600 font-semibold">"{searchTerm}"</span> con los filtros actuales.
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition shadow-xs"
              >
                Limpiar búsqueda
              </button>
            )}
          </div>
        ) : (
          /* Tabla Receptiva de Resultados */
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50/90 text-slate-500 uppercase text-[11px] font-bold tracking-wider border-b border-slate-200">
                  <tr>
                    <th scope="col" className="py-3.5 px-4">Cliente / Titular</th>
                    <th scope="col" className="py-3.5 px-4">IP Asignada</th>
                    <th scope="col" className="py-3.5 px-4">Dirección MAC</th>
                    <th scope="col" className="py-3.5 px-4">Nº de Serie</th>
                    <th scope="col" className="py-3.5 px-4">Modelo Hardware</th>
                    <th scope="col" className="py-3.5 px-4">Estado</th>
                    <th scope="col" className="py-3.5 px-4">Dirección</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedItems.map((item: InventoryItem) => (
                    <tr
                      key={item.id}
                      className="hover:bg-blue-50/40 transition-colors group"
                    >
                      {/* Cliente */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center font-bold text-xs shrink-0">
                            {item.client_name ? item.client_name.charAt(0).toUpperCase() : 'C'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 group-hover:text-blue-600 transition">
                              {item.client_name}
                            </p>
                            <p className="text-[11px] text-slate-400 font-mono">ID: {item.id}</p>
                          </div>
                        </div>
                      </td>

                      {/* IP Asignada */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            {item.ip}
                          </span>
                          {item.ip !== 'No asignada' && (
                            <button
                              onClick={() => handleCopy(item.ip, `ip-${item.id}`)}
                              title="Copiar IP"
                              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 transition"
                            >
                              {copiedId === `ip-${item.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* MAC Address */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold">{item.mac}</span>
                          {item.mac !== 'No registrada' && (
                            <button
                              onClick={() => handleCopy(item.mac, `mac-${item.id}`)}
                              title="Copiar MAC"
                              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 transition"
                            >
                              {copiedId === `mac-${item.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Serial Number */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {item.serial_number}
                          </span>
                          {item.serial_number !== 'S/N no disponible' && (
                            <button
                              onClick={() => handleCopy(item.serial_number, `sn-${item.id}`)}
                              title="Copiar Serial"
                              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 transition"
                            >
                              {copiedId === `sn-${item.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Modelo */}
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <Wifi className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium">{item.model}</span>
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getStatusBadge(item.status)}
                      </td>

                      {/* Dirección */}
                      <td className="py-3 px-4 text-xs text-slate-600 max-w-xs truncate" title={item.address}>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate">{item.address}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls Footer */}
            <div className="p-4 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
              <div>
                Mostrando{' '}
                <span className="font-bold text-slate-900">
                  {Math.min((currentPage - 1) * itemsPerPage + 1, filteredResults.length)}
                </span>{' '}
                a{' '}
                <span className="font-bold text-slate-900">
                  {Math.min(currentPage * itemsPerPage, filteredResults.length)}
                </span>{' '}
                de <span className="font-bold text-slate-900">{filteredResults.length}</span> registros filtrados
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium shadow-xs"
                  >
                    Anterior
                  </button>
                  <span className="px-2 font-semibold text-slate-700">
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium shadow-xs"
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
