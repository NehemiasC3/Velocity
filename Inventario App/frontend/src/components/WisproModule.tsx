import React, { useEffect, useState, useMemo } from 'react';
import { 
  Server, RefreshCw, CheckCircle2, AlertCircle, 
  Search, SlidersHorizontal, Layers, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp,
  Wifi, Eye, X, Globe, ArrowUpDown, Filter, ShieldCheck,
  Check, ExternalLink, Hash, MapPin, User, Tag
} from 'lucide-react';
import { api } from '../services/api';
import { WisproClient } from '../types';

export const WisproModule: React.FC = () => {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Search, Advanced Filters and Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [filterState, setFilterState] = useState<'ALL' | 'ENABLED' | 'DISABLED'>('ALL');
  const [filterSerial, setFilterSerial] = useState<'ALL' | 'WITH_SERIAL' | 'WITHOUT_SERIAL'>('ALL');
  const [filterNap, setFilterNap] = useState<'ALL' | 'WITH_NAP' | 'WITHOUT_NAP'>('ALL');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'); // Por defecto: Descendente (más recientes primero)

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'ALL'>(25);

  // Modal State for Contract Detail
  const [selectedContract, setSelectedContract] = useState<any | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      // Solicitar todos los contratos activos a través de la API acumulativa optimizada
      const res = await api.getWisproContracts({ loadAll: true });
      if (res && res.contracts) {
        setContracts(res.contracts);
      }
    } catch (err: any) {
      console.error('Error cargando contratos de Wispro:', err);
      setSyncMessage({ type: 'error', text: 'Error al conectar con la API de Wispro' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleManualSync = async () => {
    try {
      setSyncing(true);
      const res = await api.syncWispro();
      setSyncMessage({ type: 'success', text: res.message || 'Sincronización completada con éxito.' });
      await loadData();
      setTimeout(() => setSyncMessage(null), 6000);
    } catch (err: any) {
      setSyncMessage({ type: 'error', text: `Error sincronizando: ${err.message}` });
      setTimeout(() => setSyncMessage(null), 8000);
    } finally {
      setSyncing(false);
    }
  };

  // Helper function to extract NAP name cleanly
  const getContractNap = (c: any): string | null => {
    const rawNap = c.raw?.nap_name || c.napName || c.nap;
    if (rawNap && typeof rawNap === 'string' && rawNap.trim() !== '') {
      return rawNap.trim();
    }
    const node = c.nodeName || '';
    if (node && node !== 'OLT-Central' && node !== 'Sin NAP' && node.trim() !== '') {
      return node.trim();
    }
    return null;
  };

  // Filtered and Sorted Contracts
  const filteredContracts = useMemo(() => {
    const filtered = contracts.filter((c: any) => {
      // 1. Buscador global: Serial S/N, Nombre de cliente, # Contrato, Dirección, Plan, MAC
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const serial = (c.serialNumber || '').toLowerCase();
        const clientName = (c.clientName || c.name || '').toLowerCase();
        const contractId = (c.contractId || c.id || '').toLowerCase();
        const address = (c.address || '').toLowerCase();
        const plan = (c.planName || '').toLowerCase();
        const mac = (c.macAddress || c.currentOnuMac || '').toLowerCase();
        const nap = (getContractNap(c) || '').toLowerCase();

        const matches = 
          serial.includes(q) ||
          clientName.includes(q) ||
          contractId.includes(q) ||
          address.includes(q) ||
          plan.includes(q) ||
          mac.includes(q) ||
          nap.includes(q);

        if (!matches) return false;
      }

      // 2. Filtro Estado Wispro: Todos / Habilitados (ENABLED) / Deshabilitados
      if (filterState !== 'ALL') {
        const st = (c.status || c.raw?.state || '').toLowerCase();
        const isEnabled = st === 'enabled' || st === 'activo' || st === 'active';
        if (filterState === 'ENABLED' && !isEnabled) return false;
        if (filterState === 'DISABLED' && isEnabled) return false;
      }

      // 3. Filtro Conciliación por Serial: Todos / Con Serial / Sin Serial asignado
      if (filterSerial !== 'ALL') {
        const hasSerial = Boolean((c.serialNumber && c.serialNumber.trim() !== '') || (c.macAddress && c.macAddress.trim() !== ''));
        if (filterSerial === 'WITH_SERIAL' && !hasSerial) return false;
        if (filterSerial === 'WITHOUT_SERIAL' && hasSerial) return false;
      }

      // 4. Filtro Infraestructura: Todos / Con NAP / Sin NAP
      if (filterNap !== 'ALL') {
        const napVal = getContractNap(c);
        const hasNap = Boolean(napVal);
        if (filterNap === 'WITH_NAP' && !hasNap) return false;
        if (filterNap === 'WITHOUT_NAP' && hasNap) return false;
      }

      return true;
    });

    // Ordenamiento: Por defecto Descendente (números más altos / recientes primero)
    filtered.sort((a: any, b: any) => {
      const numA = Number(a.raw?.public_id) || parseInt(String(a.contractId || a.id).replace(/\D/g, ''), 10) || 0;
      const numB = Number(b.raw?.public_id) || parseInt(String(b.contractId || b.id).replace(/\D/g, ''), 10) || 0;
      if (numA !== numB) {
        return sortOrder === 'desc' ? numB - numA : numA - numB;
      }
      const dateA = a.raw?.created_at ? new Date(a.raw.created_at).getTime() : 0;
      const dateB = b.raw?.created_at ? new Date(b.raw.created_at).getTime() : 0;
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  }, [contracts, searchQuery, filterState, filterSerial, filterNap, sortOrder]);

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    setCurrentPage(1);
  };

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterState, filterSerial, filterNap, pageSize, sortOrder]);

  // Pagination calculation
  const totalItems = filteredContracts.length;
  const totalPages = pageSize === 'ALL' ? 1 : Math.ceil(totalItems / pageSize) || 1;
  const validCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);

  const paginatedContracts = useMemo(() => {
    if (pageSize === 'ALL') return filteredContracts;
    const start = (validCurrentPage - 1) * pageSize;
    return filteredContracts.slice(start, start + pageSize);
  }, [filteredContracts, validCurrentPage, pageSize]);

  // KPIs con prioridad de Seriales
  const totalContractsCount = contracts.length;
  const withSerialCount = useMemo(() => contracts.filter(c => (c.serialNumber && c.serialNumber.trim() !== '') || (c.macAddress && c.macAddress.trim() !== '')).length, [contracts]);
  const withNapCount = useMemo(() => contracts.filter(c => getContractNap(c) !== null).length, [contracts]);
  const enabledCount = useMemo(() => contracts.filter(c => {
    const st = (c.status || c.raw?.state || '').toLowerCase();
    return st === 'enabled' || st === 'activo' || st === 'active';
  }).length, [contracts]);

  const startIndex = pageSize === 'ALL' ? 0 : (validCurrentPage - 1) * pageSize;
  const endIndex = pageSize === 'ALL' ? totalItems : Math.min(startIndex + pageSize, totalItems);

  return (
    <div className="space-y-6">
      
      {/* ── 1. Barra de Estado y Sincronización Wispro (Sin título redundante) ── */}
      <div className="flex items-center justify-between gap-4 bg-white dark:bg-slate-900 px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Wispro Cloud Sincronizado
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleManualSync}
            disabled={syncing}
            className="px-4 py-2 bg-slate-900 dark:bg-sky-600 text-white text-xs font-bold rounded-xl shadow-md hover:opacity-90 active:scale-95 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            title="Ejecutar conciliación REST con Wispro Cloud"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Sincronizando...' : 'Sincronizar Wispro'}</span>
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {syncMessage && (
        <div className={`p-4 rounded-2xl text-xs flex items-center gap-2.5 shadow-sm border ${
          syncMessage.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
            : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
        }`}>
          {syncMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          )}
          <span className="font-semibold">{syncMessage.text}</span>
        </div>
      )}

      {/* ── 2. KPIs de Contratos y Conciliación ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400 border border-sky-200 dark:border-sky-800 flex items-center justify-center shrink-0">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">
              {loading ? '...' : totalContractsCount.toLocaleString()}
            </p>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Contratos</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {loading ? '...' : withSerialCount.toLocaleString()}
            </p>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Equipos con Serial (S/N)</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {loading ? '...' : withNapCount.toLocaleString()}
            </p>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Con NAP</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400 border border-purple-200 dark:border-purple-800 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-purple-600 dark:text-purple-400">
              {loading ? '...' : enabledCount.toLocaleString()}
            </p>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Habilitados</p>
          </div>
        </div>
      </div>

      {/* ── 3. Suite de Búsqueda y Filtros Avanzados ── */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        
        {/* Fila Principal: Buscador Global & Control de Páginas */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Buscador Global en tiempo real con prioridad a Serial S/N */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por Serial (S/N), cliente, contrato, plan, MAC..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                title="Limpiar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Selector de Registros por Página */}
          <div className="flex items-center gap-2 text-xs self-end lg:self-auto shrink-0">
            <span className="text-slate-500 font-semibold text-[11px]">Por página:</span>
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              {[25, 50, 100, 'ALL'].map((size) => (
                <button
                  key={size}
                  onClick={() => setPageSize(size as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    pageSize === size
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {size === 'ALL' ? 'Todos' : size}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Fila de Filtros Avanzados (Pills / Selects) */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-4 text-xs">
          
          {/* Filtro 1: Estado Wispro */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3" /> Estado:
            </span>
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px]">
              <button
                onClick={() => setFilterState('ALL')}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  filterState === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterState('ENABLED')}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  filterState === 'ENABLED'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-emerald-600'
                }`}
              >
                Habilitados
              </button>
              <button
                onClick={() => setFilterState('DISABLED')}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  filterState === 'DISABLED'
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Deshabilitados
              </button>
            </div>
          </div>

          {/* Filtro 2: Conciliación (Serial) */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Wifi className="w-3 h-3" /> Conciliación:
            </span>
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px]">
              <button
                onClick={() => setFilterSerial('ALL')}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  filterSerial === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterSerial('WITH_SERIAL')}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  filterSerial === 'WITH_SERIAL'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-sky-600'
                }`}
              >
                Con Serial
              </button>
              <button
                onClick={() => setFilterSerial('WITHOUT_SERIAL')}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  filterSerial === 'WITHOUT_SERIAL'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-amber-600'
                }`}
              >
                Sin Serial
              </button>
            </div>
          </div>

          {/* Filtro 3: Infraestructura (NAP) */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3 h-3" /> Infraestructura:
            </span>
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px]">
              <button
                onClick={() => setFilterNap('ALL')}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  filterNap === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterNap('WITH_NAP')}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  filterNap === 'WITH_NAP'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-indigo-600'
                }`}
              >
                Con NAP
              </button>
              <button
                onClick={() => setFilterNap('WITHOUT_NAP')}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  filterNap === 'WITHOUT_NAP'
                    ? 'bg-slate-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Sin NAP
              </button>
            </div>
          </div>

          {/* Conteo Informativo Actualizado */}
          <div className="ml-auto text-xs font-bold text-slate-500 dark:text-slate-400">
            Mostrando <span className="text-slate-900 dark:text-white font-mono">{totalItems === 0 ? 0 : startIndex + 1} - {endIndex}</span> de{' '}
            <span className="text-slate-900 dark:text-white font-mono">{totalContractsCount.toLocaleString()}</span> contratos
            {totalItems !== totalContractsCount && (
              <span className="ml-1 text-[11px] text-sky-600 dark:text-sky-400 font-medium">
                ({totalItems.toLocaleString()} filtrados)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── 4. Tabla de Contratos & Equipos Optimizada ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs table-fixed">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th 
                  onClick={toggleSortOrder}
                  className="py-3.5 px-4 w-32 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                  title={`Ordenar por Contrato (${sortOrder === 'desc' ? 'Descendente: más recientes primero' : 'Ascendente: más antiguos primero'})`}
                >
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-bold">
                    <span>Contrato</span>
                    {sortOrder === 'desc' ? (
                      <ChevronDown className="w-3.5 h-3.5 text-sky-500 transition-transform group-hover:scale-110" />
                    ) : (
                      <ChevronUp className="w-3.5 h-3.5 text-sky-500 transition-transform group-hover:scale-110" />
                    )}
                  </div>
                </th>
                <th className="py-3.5 px-4 min-w-[200px]">Cliente & Dirección</th>
                <th className="py-3.5 px-4 w-[160px] max-w-[160px]">Plan / Servicio</th>
                <th className="py-3.5 px-4 w-36">NAP</th>
                <th className="py-3.5 px-4 w-44">Serial / S/N</th>
                <th className="py-3.5 px-4 w-36">MAC Address</th>
                <th className="py-3.5 px-4 w-28 text-center">Estado Wispro</th>
                <th className="py-3.5 px-4 w-20 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="w-8 h-8 text-sky-500 animate-spin" />
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
                        Consultando contratos activos desde Wispro Cloud API...
                      </p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        Conectando con la API REST y resolviendo clientes, equipos, seriales y estados en tiempo real.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : paginatedContracts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Server className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                      <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
                        No se encontraron contratos coincidentes
                      </p>
                      <p className="text-xs text-slate-400 max-w-md">
                        Intenta ajustar el término de búsqueda o limpia los filtros de Estado, Conciliación o Infraestructura.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedContracts.map((c: any) => {
                  const napValue = getContractNap(c);
                  const isEnabled = (c.status || c.raw?.state || '').toLowerCase() === 'enabled' || (c.status || '').toLowerCase() === 'activo';

                  return (
                    <tr key={c.id || c.contractId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      
                      {/* Contrato */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-2 py-1 rounded-lg text-[11px] border border-sky-200 dark:border-sky-800 block w-fit">
                          #{c.contractId}
                        </span>
                      </td>

                      {/* Cliente & Dirección */}
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900 dark:text-white text-xs leading-snug truncate" title={c.clientName || c.name || ''}>
                          {c.clientName || c.name}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5" title={c.address || 'Panamá'}>
                          {c.address || 'Panamá'}
                        </p>
                      </td>

                      {/* PLAN / SERVICIO (Limitado estrictamente a max-w-[160px] con tooltip hover) */}
                      <td className="py-3.5 px-4 w-[160px] max-w-[160px]">
                        <span 
                          className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-help"
                          title={c.planName || 'Fibra Óptica'}
                        >
                          {c.planName || 'Fibra Óptica'}
                        </span>
                      </td>

                      {/* NODO OLT / NAP (Con badge Sin NAP neutral si es nulo) */}
                      <td className="py-3.5 px-4">
                        {napValue ? (
                          <span 
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800 font-mono font-bold truncate max-w-[130px]"
                            title={`NAP: ${napValue}`}
                          >
                            {napValue}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-400 dark:bg-slate-800 font-mono">
                            Sin NAP
                          </span>
                        )}
                      </td>

                      {/* Serial S/N (Prioridad Visual Alta) */}
                      <td className="py-3.5 px-4">
                        {c.serialNumber ? (
                          <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 block w-fit truncate max-w-[150px]" title={c.serialNumber}>
                            {c.serialNumber}
                          </span>
                        ) : (
                          <span className="text-amber-500 text-[11px] italic font-medium">
                            Sin Serial
                          </span>
                        )}
                      </td>

                      {/* MAC Address ONU (Secundario) */}
                      <td className="py-3.5 px-4 font-mono">
                        {c.macAddress || c.currentOnuMac ? (
                          <span className="text-xs text-slate-600 dark:text-slate-400 block truncate" title={c.macAddress || c.currentOnuMac}>
                            {c.macAddress || c.currentOnuMac}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">
                            —
                          </span>
                        )}
                      </td>

                      {/* Estado Wispro */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          isEnabled
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}>
                          {c.status || (isEnabled ? 'ENABLED' : 'DISABLED')}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedContract(c)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          title="Ver detalles del contrato"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── 5. Paginador en UI con Controles Anterior / Siguiente ── */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500 font-medium">
            Mostrando <span className="font-bold text-slate-900 dark:text-white">{totalItems === 0 ? 0 : startIndex + 1}</span> a{' '}
            <span className="font-bold text-slate-900 dark:text-white">{endIndex}</span> de{' '}
            <span className="font-bold text-slate-900 dark:text-white">{totalContractsCount.toLocaleString()}</span> contratos
          </div>

          {pageSize !== 'ALL' && totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={validCurrentPage <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>

              <div className="flex items-center gap-1 px-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                <span>Página</span>
                <span className="px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 font-mono">
                  {validCurrentPage}
                </span>
                <span>de {totalPages}</span>
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={validCurrentPage >= totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal de Detalle de Contrato ── */}
      {selectedContract && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Detalle de Contrato #{selectedContract.contractId}
                  </h3>
                  <span className="text-xs text-slate-400">Wispro Cloud ISP ID: {selectedContract.id}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedContract(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-700 dark:text-slate-300">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Cliente:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedContract.clientName || selectedContract.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Dirección:</span>
                  <span className="font-medium text-right max-w-xs">{selectedContract.address || 'Panamá'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Plan / Servicio:</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400 text-right max-w-xs">{selectedContract.planName || 'Fibra Óptica'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                  <span className="text-slate-400 block text-[11px] mb-1">NAP</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {getContractNap(selectedContract) || 'Sin NAP'}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                  <span className="text-slate-400 block text-[11px] mb-1">Estado Servicio</span>
                  <span className="font-bold text-emerald-600 uppercase">
                    {selectedContract.status || 'Habilitado'}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                  <span className="text-slate-400 block text-[11px] mb-1">Serial S/N</span>
                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                    {selectedContract.serialNumber || '—'}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                  <span className="text-slate-400 block text-[11px] mb-1">MAC Address ONU</span>
                  <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                    {selectedContract.macAddress || selectedContract.currentOnuMac || 'Sin registrar'}
                  </span>
                </div>
              </div>

              {selectedContract.ip && (
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl flex justify-between items-center">
                  <span className="text-slate-400 font-semibold">Dirección IP:</span>
                  <span className="font-mono font-bold text-sky-600">{selectedContract.ip}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedContract(null)}
                className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs px-5 py-2.5 rounded-xl hover:opacity-90 transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
