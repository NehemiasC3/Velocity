import React, { useEffect, useState, useMemo } from 'react';
import { 
  Server, RefreshCw, CheckCircle2, AlertCircle, 
  Search, SlidersHorizontal, Layers, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp,
  Wifi, Eye, X, Globe, ArrowUpDown, Filter, ShieldCheck,
  Check, ExternalLink, Hash, MapPin, User, Tag,
  Box, Plus, Trash2, Tv, Video, Router, Copy, AlertTriangle, ArrowRight,
  PackageCheck
} from 'lucide-react';
import { api } from '../services/api';
import { WisproClient, CreateAssignmentPayload } from '../types';

export const WisproModule: React.FC = () => {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMode, setSyncMode] = useState<'delta' | 'full' | null>(null);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // Search, Advanced Filters and Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterState, setFilterState] = useState<'ALL' | 'ENABLED' | 'DISABLED'>('ALL');
  const [filterSerial, setFilterSerial] = useState<'ALL' | 'WITH_SERIAL' | 'WITHOUT_SERIAL'>('ALL');
  const [filterNap, setFilterNap] = useState<'ALL' | 'WITH_NAP' | 'WITHOUT_NAP'>('ALL');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'); // Por defecto: Descendente (más recientes primero)

  // Server-Side Pagination & KPIs State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'ALL'>(25);
  const [serverTotal, setServerTotal] = useState<number>(0);
  const [serverTotalPages, setServerTotalPages] = useState<number>(1);
  const [kpis, setKpis] = useState<{ total: number; withSerial: number; withNap: number; enabled: number }>({
    total: 0,
    withSerial: 0,
    withNap: 0,
    enabled: 0
  });

  // Modal State for Contract Detail
  const [selectedContract, setSelectedContract] = useState<any | null>(null);

  // Equipment Assignment State
  const [assignedEquipment, setAssignedEquipment] = useState<any[]>([]);
  const [loadingEquipment, setLoadingEquipment] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [searchingItems, setSearchingItems] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [itemCategoryFilter, setItemCategoryFilter] = useState<string>('ALL');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Unassign confirmation modal
  const [unassignConfirmItem, setUnassignConfirmItem] = useState<any | null>(null);
  const [unassignStatus, setUnassignStatus] = useState<'EN_BODEGA' | 'RMA_DEFECTUOSO'>('EN_BODEGA');
  const [unassignNotes, setUnassignNotes] = useState('');
  const [isSubmittingUnassign, setIsSubmittingUnassign] = useState(false);

  // Debounce search query to avoid spamming the backend
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Carga 100% Server-Side sobre base de datos PostgreSQL Local Mirror
  const loadData = async (targetPage: number = currentPage) => {
    try {
      setLoading(true);
      const t0 = performance.now();
      const res = await api.getWisproContracts({
        page: targetPage,
        perPage: pageSize === 'ALL' ? 200 : pageSize,
        search: debouncedSearch.trim() || undefined,
        filterState: filterState !== 'ALL' ? filterState : undefined,
        filterSerial: filterSerial !== 'ALL' ? filterSerial : undefined,
        filterNap: filterNap !== 'ALL' ? filterNap : undefined,
        sortOrder: sortOrder
      });
      const t1 = performance.now();
      setResponseTimeMs(Math.max(1, Math.round(t1 - t0)));

      if (res) {
        setContracts(res.contracts || []);
        setServerTotal(res.total ?? (res.contracts || []).length);
        setServerTotalPages(res.totalPages ?? 1);
        if (res.lastSyncedAt) setLastSyncedAt(res.lastSyncedAt);
        if ((res as any).kpis) setKpis((res as any).kpis);
      }
    } catch (err: any) {
      console.error('Error cargando contratos desde PostgreSQL Local Mirror:', err);
      setSyncMessage({ type: 'error', text: 'Error al conectar con la base de datos local' });
    } finally {
      setLoading(false);
    }
  };

  // Recargar al cambiar búsqueda o filtros (reseteando a página 1)
  useEffect(() => {
    setCurrentPage(1);
    loadData(1);
  }, [debouncedSearch, filterState, filterSerial, filterNap, sortOrder, pageSize]);

  const handlePageChange = (newPage: number) => {
    const target = Math.max(1, Math.min(newPage, serverTotalPages));
    setCurrentPage(target);
    loadData(target);
  };

  // Sincronización Manual: Delta Sync o Volcado Completo
  const handleManualSync = async (forceFull = false) => {
    try {
      setSyncing(true);
      setSyncMode(forceFull ? 'full' : 'delta');
      const res = await api.syncWispro({ force: forceFull });
      setSyncMessage({ 
        type: 'success', 
        text: res.message || `${forceFull ? 'Volcado completo' : 'Delta Sync'} finalizado exitosamente.` 
      });
      if (res.lastSyncedAt) setLastSyncedAt(res.lastSyncedAt);
      await loadData(1);
      setTimeout(() => setSyncMessage(null), 6000);
    } catch (err: any) {
      setSyncMessage({ type: 'error', text: `Error sincronizando: ${err.message}` });
      setTimeout(() => setSyncMessage(null), 8000);
    } finally {
      setSyncing(false);
      setSyncMode(null);
    }
  };

  // Cargar equipos asignados físicamente cuando se selecciona un contrato
  useEffect(() => {
    if (selectedContract) {
      loadContractEquipment(selectedContract.contractId || selectedContract.id);
    } else {
      setAssignedEquipment([]);
      setIsAssignModalOpen(false);
      setUnassignConfirmItem(null);
    }
  }, [selectedContract]);

  const loadContractEquipment = async (contractId: string) => {
    try {
      setLoadingEquipment(true);
      const res = await api.getContractAssignment(contractId);
      if (res && res.items) {
        setAssignedEquipment(res.items);
      } else {
        setAssignedEquipment([]);
      }
    } catch (err) {
      console.error('Error cargando equipos del contrato:', err);
      setAssignedEquipment([]);
    } finally {
      setLoadingEquipment(false);
    }
  };

  const openAssignModal = async () => {
    setIsAssignModalOpen(true);
    setSelectedItemIds([]);
    setAssignmentNotes('');
    setItemSearchQuery('');
    setItemCategoryFilter('ALL');
    try {
      let whList = warehouses;
      if (whList.length === 0) {
        const whRes = await api.getWarehouses();
        whList = (whRes as any)?.warehouses || whRes || [];
        setWarehouses(whList);
        if (whList.length > 0 && !selectedWarehouseId) {
          setSelectedWarehouseId(whList[0].id);
        }
      }
      await loadAvailableItems('', whList[0]?.id || selectedWarehouseId, 'ALL');
    } catch (e) {
      console.error('Error inicializando asignación:', e);
    }
  };

  const loadAvailableItems = async (search: string, whId?: string, cat?: string) => {
    try {
      setSearchingItems(true);
      const res = await api.searchAvailableItemsForAssignment({
        search,
        warehouseId: whId || selectedWarehouseId || undefined,
        category: cat && cat !== 'ALL' ? cat : undefined,
        limit: 35
      });
      if (res && res.items) {
        setAvailableItems(res.items);
      } else {
        setAvailableItems([]);
      }
    } catch (e) {
      console.error('Error buscando items disponibles:', e);
    } finally {
      setSearchingItems(false);
    }
  };

  const toggleItemSelection = (id: string) => {
    setSelectedItemIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleConfirmAssignment = async () => {
    if (!selectedContract || selectedItemIds.length === 0) return;
    try {
      setIsSubmittingAssignment(true);
      const contractId = selectedContract.contractId || selectedContract.id;
      const clientName = selectedContract.clientName || selectedContract.name || 'Cliente Wispro';

      const payload: CreateAssignmentPayload = {
        wisproContractId: String(contractId),
        clientName: String(clientName),
        nodeId: selectedWarehouseId,
        notes: assignmentNotes,
        itemIds: selectedItemIds
      };

      const res = await api.createAssignment(payload);
      setSyncMessage({ type: 'success', text: res.message || 'Equipos asignados exitosamente al contrato' });
      setTimeout(() => setSyncMessage(null), 5000);
      setIsAssignModalOpen(false);
      setSelectedItemIds([]);
      await loadContractEquipment(contractId);
      await loadData();
    } catch (err: any) {
      alert(`Error asignando equipos: ${err.message}`);
    } finally {
      setIsSubmittingAssignment(false);
    }
  };

  const handleConfirmUnassign = async () => {
    if (!unassignConfirmItem || !selectedContract) return;
    try {
      setIsSubmittingUnassign(true);
      await api.unassignItem(unassignConfirmItem.id, {
        returnStatus: unassignStatus,
        notes: unassignNotes
      });
      setSyncMessage({ type: 'success', text: `Equipo ${unassignConfirmItem.serialNumber} desvinculado con éxito.` });
      setTimeout(() => setSyncMessage(null), 5000);
      setUnassignConfirmItem(null);
      await loadContractEquipment(selectedContract.contractId || selectedContract.id);
      await loadData();
    } catch (err: any) {
      alert(`Error al desvincular equipo: ${err.message}`);
    } finally {
      setIsSubmittingUnassign(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const getItemCategoryIcon = (category?: string) => {
    switch (category) {
      case 'TV_BOX_OTT':
        return <Tv className="w-4 h-4 text-purple-500" />;
      case 'CAMARA_SEGURIDAD_IOT':
        return <Video className="w-4 h-4 text-emerald-500" />;
      case 'ROUTER_WIFI':
      case 'REPETIDOR_MESH':
        return <Router className="w-4 h-4 text-blue-500" />;
      case 'ONU_ONT':
        return <Wifi className="w-4 h-4 text-sky-500" />;
      default:
        return <Box className="w-4 h-4 text-slate-500" />;
    }
  };

  const getCategoryBadge = (category?: string) => {
    switch (category) {
      case 'ONU_ONT':
        return { label: '📡 ONU / Router', color: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800' };
      case 'REPETIDOR_MESH':
      case 'ROUTER_WIFI':
        return { label: '📶 Extensor / Mesh', color: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800' };
      case 'TV_BOX_OTT':
        return { label: '📺 TV Box', color: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800' };
      case 'CAMARA_SEGURIDAD_IOT':
        return { label: '📷 Cámara de Seguridad', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' };
      default:
        return { label: '📦 Equipo Físico', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700' };
    }
  };

  const handleQuickBindSingleItem = async (itemId: string) => {
    if (!selectedContract) return;
    try {
      setIsSubmittingAssignment(true);
      const contractId = selectedContract.contractId || selectedContract.id;
      const clientName = selectedContract.clientName || selectedContract.name || 'Cliente Wispro';
      await api.createAssignment({
        wisproContractId: String(contractId),
        clientName: String(clientName),
        nodeId: selectedWarehouseId,
        notes: 'Vinculación rápida',
        itemIds: [itemId]
      });
      setSyncMessage({ type: 'success', text: 'Equipo vinculado en 2 segundos exitosamente' });
      setTimeout(() => setSyncMessage(null), 4000);
      setIsAssignModalOpen(false);
      await loadContractEquipment(contractId);
      await loadData();
    } catch (err: any) {
      alert(`Error al vincular: ${err.message}`);
    } finally {
      setIsSubmittingAssignment(false);
    }
  };

  // Helper function to extract NAP name cleanly
  const getContractNap = (c: any): string | null => {
    const rawNap = c.raw?.nap_name || c.napName || c.nap;
    if (rawNap && typeof rawNap === 'string' && rawNap.trim() !== '' && rawNap.trim() !== 'OLT-Central' && rawNap.trim() !== 'Sin NAP' && rawNap.trim() !== 'No tiene NAP') {
      return rawNap.trim();
    }
    const node = c.nodeName || '';
    if (node && node !== 'OLT-Central' && node !== 'Sin NAP' && node !== 'No tiene NAP' && node.trim() !== '') {
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
  };

  // KPIs calculados desde la base de datos PostgreSQL
  const totalContractsCount = kpis.total || serverTotal;
  const withSerialCount = kpis.withSerial;
  const withNapCount = kpis.withNap;
  const enabledCount = kpis.enabled;

  const currentSizeNum = pageSize === 'ALL' ? contracts.length : (typeof pageSize === 'number' ? pageSize : 25);
  const startIndex = (currentPage - 1) * currentSizeNum;
  const endIndex = Math.min(startIndex + contracts.length, serverTotal);

  return (
    <div className="space-y-6">
      
      {/* ── 1. Barra de Estado y Sincronización Wispro (Espejo Local PostgreSQL) ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            🟢 Espejo Local PostgreSQL
          </span>

          {responseTimeMs !== null && (
            <span 
              className="text-[11px] font-mono font-black text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-2.5 py-1 rounded-full border border-sky-200 dark:border-sky-800 flex items-center gap-1"
              title="Tiempo de respuesta de consulta 100% en PostgreSQL local"
            >
              ⚡ {responseTimeMs}ms
            </span>
          )}

          {lastSyncedAt && (
            <span className="text-[11px] text-slate-500 hidden md:inline-flex items-center gap-1">
              <span>Última sincronización:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {new Date(lastSyncedAt).toLocaleString()}
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {/* Botón 1: Delta Sync (Incremental) */}
          <button
            onClick={() => handleManualSync(false)}
            disabled={syncing}
            className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Sincronizar diferencialmente solo contratos nuevos o actualizados (updated_after)"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing && syncMode === 'delta' ? 'animate-spin' : ''}`} />
            <span>{syncing && syncMode === 'delta' ? 'Sincronizando...' : 'Delta Sync'}</span>
          </button>

          {/* Botón 2: Volcado Completo (Force Full Dump) */}
          <button
            onClick={() => handleManualSync(true)}
            disabled={syncing}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Descargar y conciliar todo el padrón completo desde Wispro Cloud"
          >
            <Server className={`w-3.5 h-3.5 text-slate-500 ${syncing && syncMode === 'full' ? 'animate-bounce' : ''}`} />
            <span className="hidden sm:inline">{syncing && syncMode === 'full' ? 'Volcando...' : 'Volcado Completo'}</span>
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
              {loading && totalContractsCount === 0 ? '...' : totalContractsCount.toLocaleString()}
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
              {loading && withSerialCount === 0 ? '...' : withSerialCount.toLocaleString()}
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
              {loading && withNapCount === 0 ? '...' : withNapCount.toLocaleString()}
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
              {loading && enabledCount === 0 ? '...' : enabledCount.toLocaleString()}
            </p>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Habilitados</p>
          </div>
        </div>
      </div>

      {/* ── 3. Suite de Búsqueda y Filtros Avanzados (Server-Side) ── */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        
        {/* Fila Principal: Buscador Global & Control de Páginas */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Buscador Server-side en PostgreSQL */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por cliente, cédula/RUC, # contrato, serial ONU, MAC..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
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
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    pageSize === size
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {size === 'ALL' ? '200' : size}
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
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                  filterState === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterState('ENABLED')}
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                  filterState === 'ENABLED'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-emerald-600'
                }`}
              >
                Habilitados
              </button>
              <button
                onClick={() => setFilterState('DISABLED')}
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
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
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                  filterSerial === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterSerial('WITH_SERIAL')}
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                  filterSerial === 'WITH_SERIAL'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-sky-600'
                }`}
              >
                Con Serial
              </button>
              <button
                onClick={() => setFilterSerial('WITHOUT_SERIAL')}
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
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
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                  filterNap === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterNap('WITH_NAP')}
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                  filterNap === 'WITH_NAP'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-indigo-600'
                }`}
              >
                Con NAP
              </button>
              <button
                onClick={() => setFilterNap('WITHOUT_NAP')}
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
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
            Mostrando <span className="text-slate-900 dark:text-white font-mono">{serverTotal === 0 ? 0 : startIndex + 1} - {endIndex}</span> de{' '}
            <span className="text-slate-900 dark:text-white font-mono">{serverTotal.toLocaleString()}</span> contratos
            {serverTotal !== totalContractsCount && (
              <span className="ml-1 text-[11px] text-sky-600 dark:text-sky-400 font-medium">
                (filtrados de {totalContractsCount.toLocaleString()})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── 4. Tabla de Contratos & Equipos Optimizada (PostgreSQL Local Mirror) ── */}
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
                <th className="py-3.5 px-4 min-w-[200px]">Cliente & Cédula / Dirección</th>
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
                        Consultando contratos desde Espejo Local PostgreSQL...
                      </p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        Respuesta ultrarrápida indexada en base de datos local con conciliación multi-equipo.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : contracts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Server className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                      <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
                        No se encontraron contratos coincidentes en PostgreSQL
                      </p>
                      <p className="text-xs text-slate-400 max-w-md">
                        Intenta ajustar el término de búsqueda o limpia los filtros de Estado, Conciliación o Infraestructura.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                contracts.map((c: any) => {
                  const napValue = getContractNap(c);
                  const isEnabled = (c.status || c.wisproState || c.raw?.state || '').toLowerCase() === 'enabled' || (c.status || '').toLowerCase() === 'activo';

                  return (
                    <tr key={c.id || c.contractId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      
                      {/* Contrato */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-2 py-1 rounded-lg text-[11px] border border-sky-200 dark:border-sky-800 block w-fit">
                          #{c.contractId}
                        </span>
                      </td>

                      {/* Cliente & Cédula / Dirección */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-slate-900 dark:text-white text-xs leading-snug truncate" title={c.clientName || c.name || ''}>
                            {c.clientName || c.name}
                          </p>
                          {c.identification && (
                            <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700" title="Cédula / RUC">
                              🆔 {c.identification}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5" title={c.address || 'Panamá'}>
                          {c.address || 'Panamá'}
                        </p>
                      </td>

                      {/* PLAN / SERVICIO */}
                      <td className="py-3.5 px-4 w-[160px] max-w-[160px]">
                        <span 
                          className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-help"
                          title={c.planName || 'Fibra Óptica'}
                        >
                          {c.planName || 'Fibra Óptica'}
                        </span>
                      </td>

                      {/* NODO OLT / NAP */}
                      <td className="py-3.5 px-4">
                        {napValue ? (
                          <span 
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800 font-mono font-bold truncate max-w-[130px]"
                            title={`NAP: ${napValue}`}
                          >
                            {napValue}
                          </span>
                        ) : (
                          <span 
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-semibold"
                            title="Este cliente no tiene caja NAP asignada"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Sin NAP
                          </span>
                        )}
                      </td>

                      {/* Serial S/N */}
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

                      {/* MAC Address ONU */}
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
                          {c.status || c.wisproState || (isEnabled ? 'ENABLED' : 'DISABLED')}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedContract(c)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 transition shadow-2xs cursor-pointer"
                            title="Ver o asignar equipos físicos a este contrato"
                          >
                            <span>📦 Ver / Asignar Equipos</span>
                          </button>
                          <button
                            onClick={() => setSelectedContract(c)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="Ver detalles del contrato"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── 5. Paginador Server-Side con Controles Anterior / Siguiente ── */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500 font-medium">
            Mostrando <span className="font-bold text-slate-900 dark:text-white">{serverTotal === 0 ? 0 : startIndex + 1}</span> a{' '}
            <span className="font-bold text-slate-900 dark:text-white">{endIndex}</span> de{' '}
            <span className="font-bold text-slate-900 dark:text-white">{serverTotal.toLocaleString()}</span> contratos
          </div>

          {pageSize !== 'ALL' && serverTotalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1 || loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>

              <div className="flex items-center gap-1 px-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                <span>Página</span>
                <span className="px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 font-mono">
                  {currentPage}
                </span>
                <span>de {serverTotalPages}</span>
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= serverTotalPages || loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal de Detalle de Contrato y Gestión Multi-Equipo ── */}
      {selectedContract && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                  <Server className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Contrato #{selectedContract.contractId}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800">
                      Wispro Cloud
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">
                    {selectedContract.clientName || selectedContract.name}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedContract(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Datos Básicos de Wispro */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl space-y-2.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex justify-between sm:justify-start sm:gap-2">
                  <span className="text-slate-400 font-semibold">Dirección:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{selectedContract.address || 'Panamá'}</span>
                </div>
                <div className="flex justify-between sm:justify-start sm:gap-2">
                  <span className="text-slate-400 font-semibold">Plan:</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400">{selectedContract.planName || 'Fibra Óptica'}</span>
                </div>
                <div className="flex justify-between sm:justify-start sm:gap-2 items-center">
                  <span className="text-slate-400 font-semibold">NAP Zonal:</span>
                  {getContractNap(selectedContract) ? (
                    <span className="font-mono font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800 text-xs">
                      {getContractNap(selectedContract)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      ⚠️ No tiene NAP
                    </span>
                  )}
                </div>
                <div className="flex justify-between sm:justify-start sm:gap-2">
                  <span className="text-slate-400 font-semibold">Estado Wispro:</span>
                  <span className="font-bold text-emerald-600 uppercase">{selectedContract.status || 'Habilitado'}</span>
                </div>
              </div>

              {(selectedContract.macAddress || selectedContract.currentOnuMac || selectedContract.serialNumber) && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-wrap items-center gap-4 text-[11px]">
                  {selectedContract.serialNumber && (
                    <div>
                      <span className="text-slate-400 mr-1">S/N Wispro:</span>
                      <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{selectedContract.serialNumber}</span>
                    </div>
                  )}
                  {(selectedContract.macAddress || selectedContract.currentOnuMac) && (
                    <div>
                      <span className="text-slate-400 mr-1">MAC ONT:</span>
                      <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{selectedContract.macAddress || selectedContract.currentOnuMac}</span>
                    </div>
                  )}
                  {selectedContract.ip && (
                    <div>
                      <span className="text-slate-400 mr-1">IP:</span>
                      <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{selectedContract.ip}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sección de Equipos Físicos Vinculados (Multi-Equipo) */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                    <PackageCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Equipos Físicos en Cliente (Multi-Equipo)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      ONUs, TV Boxes OTT, Cámaras Ezviz y Routers asignados a este contrato
                    </p>
                  </div>
                  <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-black bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                    {assignedEquipment.length}
                  </span>
                </div>

                <button
                  onClick={openAssignModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>➕ Vincular Nuevo Equipo</span>
                </button>
              </div>

              {/* Badges Interactivos Clasificados por Categoría */}
              {(() => {
                const onusCount = assignedEquipment.filter((i: any) => (i.product?.category || i.category) === 'ONU_ONT').length;
                const meshCount = assignedEquipment.filter((i: any) => ['ROUTER_WIFI', 'REPETIDOR_MESH'].includes(i.product?.category || i.category)).length;
                const tvBoxCount = assignedEquipment.filter((i: any) => (i.product?.category || i.category) === 'TV_BOX_OTT').length;
                const camCount = assignedEquipment.filter((i: any) => (i.product?.category || i.category) === 'CAMARA_SEGURIDAD_IOT').length;

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className={`p-2.5 rounded-xl border flex items-center justify-between ${onusCount > 0 ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'}`}>
                      <span className="font-bold flex items-center gap-1.5">
                        <Wifi className="w-3.5 h-3.5 text-sky-500" />
                        <span>📡 ONU / Router</span>
                      </span>
                      <span className="font-mono font-black px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-current text-xs">{onusCount}</span>
                    </div>

                    <div className={`p-2.5 rounded-xl border flex items-center justify-between ${meshCount > 0 ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'}`}>
                      <span className="font-bold flex items-center gap-1.5">
                        <Router className="w-3.5 h-3.5 text-blue-500" />
                        <span>📶 Extensor / Mesh</span>
                      </span>
                      <span className="font-mono font-black px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-current text-xs">{meshCount}</span>
                    </div>

                    <div className={`p-2.5 rounded-xl border flex items-center justify-between ${tvBoxCount > 0 ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'}`}>
                      <span className="font-bold flex items-center gap-1.5">
                        <Tv className="w-3.5 h-3.5 text-purple-500" />
                        <span>📺 TV Box</span>
                      </span>
                      <span className="font-mono font-black px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-current text-xs">{tvBoxCount}</span>
                    </div>

                    <div className={`p-2.5 rounded-xl border flex items-center justify-between ${camCount > 0 ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'}`}>
                      <span className="font-bold flex items-center gap-1.5">
                        <Video className="w-3.5 h-3.5 text-emerald-500" />
                        <span>📷 Cámara Seguridad</span>
                      </span>
                      <span className="font-mono font-black px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-current text-xs">{camCount}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Lista o Tabla de Equipos */}
              {loadingEquipment ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
                  <span className="text-xs">Consultando equipos físicos en inventario...</span>
                </div>
              ) : assignedEquipment.length === 0 ? (
                <div className="p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2 bg-slate-50/50 dark:bg-slate-800/20">
                  <Box className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    No hay equipos físicos asignados formalmente a este contrato.
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    Puedes vincular una o varias ONTs, TV Boxes o Cámaras Ezviz desde el inventario disponible en bodega.
                  </p>
                  <button
                    onClick={openAssignModal}
                    className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>➕ Vincular Nuevo Equipo</span>
                  </button>
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {assignedEquipment.map((eq: any) => {
                    const badge = getCategoryBadge(eq.product?.category || eq.category);
                    return (
                      <div key={eq.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 mt-0.5">
                            {getItemCategoryIcon(eq.product?.category || eq.category)}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-900 dark:text-white">
                                {eq.product?.name || eq.productName || 'Equipo Serializado'}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${badge.color}`}>
                                {badge.label}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-[11px]">
                              {/* Serial Number */}
                              <div className="flex items-center gap-1">
                                <span className="text-slate-400">S/N:</span>
                                <span className="font-mono font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-200 dark:border-sky-800">
                                  {eq.serialNumber}
                                </span>
                                <button
                                  onClick={() => copyToClipboard(eq.serialNumber)}
                                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                                  title="Copiar Serial"
                                >
                                  {copiedText === eq.serialNumber ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>

                              {/* MAC Address */}
                              {eq.macAddress && (
                                <div className="flex items-center gap-1">
                                  <span className="text-slate-400">MAC:</span>
                                  <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                                    {eq.macAddress}
                                  </span>
                                  <button
                                    onClick={() => copyToClipboard(eq.macAddress)}
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                                    title="Copiar MAC"
                                  >
                                    {copiedText === eq.macAddress ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              )}

                              {/* Verification Code (Ezviz / Camara) */}
                              {eq.verificationCode && (
                                <div className="flex items-center gap-1">
                                  <span className="text-slate-400">Cód. Verificación:</span>
                                  <span className="font-mono font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                    {eq.verificationCode}
                                  </span>
                                </div>
                              )}

                              {/* Bodega / Nodo */}
                              {eq.currentWarehouse && (
                                <div className="text-slate-500">
                                  Bodega: <span className="font-medium text-slate-700 dark:text-slate-300">{eq.currentWarehouse.name}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Botón Desvincular */}
                        <div className="flex items-center justify-end sm:justify-start">
                          <button
                            onClick={() => {
                              setUnassignConfirmItem(eq);
                              setUnassignStatus('EN_BODEGA');
                              setUnassignNotes('');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-transparent hover:border-rose-200 dark:hover:border-rose-900 transition cursor-pointer"
                            title="Desvincular o retirar equipo de este cliente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Desvincular</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <span className="text-[11px] text-slate-400">
                Sincronización forense y control de número de serie activo
              </span>
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

      {/* ── Sub-Modal: Asignar Equipos Físicos de Inventario ── */}
      {isAssignModalOpen && selectedContract && (
        <div className="fixed inset-0 z-60 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Box className="w-4 h-4 text-indigo-600" />
                  <span>Vincular Equipos al Contrato #{selectedContract.contractId}</span>
                </h3>
                <span className="text-xs text-slate-500">
                  Cliente: {selectedContract.clientName || selectedContract.name}
                </span>
              </div>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filtros de Selección de Inventario */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              {/* Buscador */}
              <div className="relative sm:col-span-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar S/N o MAC..."
                  value={itemSearchQuery}
                  onChange={(e) => {
                    setItemSearchQuery(e.target.value);
                    loadAvailableItems(e.target.value, selectedWarehouseId, itemCategoryFilter);
                  }}
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 outline-hidden focus:border-indigo-500"
                />
              </div>

              {/* Selector de Bodega / Nodo */}
              <div>
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => {
                    setSelectedWarehouseId(e.target.value);
                    loadAvailableItems(itemSearchQuery, e.target.value, itemCategoryFilter);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-hidden focus:border-indigo-500"
                >
                  <option value="">Todas las Bodegas</option>
                  {warehouses.map((wh: any) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} ({wh.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Selector de Categoría */}
              <div>
                <select
                  value={itemCategoryFilter}
                  onChange={(e) => {
                    setItemCategoryFilter(e.target.value);
                    loadAvailableItems(itemSearchQuery, selectedWarehouseId, e.target.value);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-hidden focus:border-indigo-500"
                >
                  <option value="ALL">Todas las Categorías</option>
                  <option value="ONU_ONT">ONT / ONU</option>
                  <option value="TV_BOX_OTT">TV Box OTT</option>
                  <option value="CAMARA_SEGURIDAD_IOT">Cámara Ezviz / IoT</option>
                  <option value="ROUTER_WIFI">Router WiFi</option>
                  <option value="REPETIDOR_MESH">Repetidor Mesh</option>
                </select>
              </div>
            </div>

            {/* Lista de Equipos Disponibles con Checkbox */}
            <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 min-h-[220px] max-h-[320px]">
              {searchingItems ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
                  <span className="text-xs">Buscando equipos en bodega...</span>
                </div>
              ) : availableItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs space-y-1">
                  <Box className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600" />
                  <p>No se encontraron equipos disponibles con esos criterios.</p>
                  <p className="text-[11px] text-slate-500">Prueba cambiando la bodega o el término de búsqueda.</p>
                </div>
              ) : (
                availableItems.map((item: any) => {
                  const isChecked = selectedItemIds.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className={`p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition ${
                        isChecked ? 'bg-indigo-50/50 dark:bg-indigo-950/30' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleItemSelection(item.id)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                          {getItemCategoryIcon(item.product?.category)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {item.product?.name || 'Equipo'}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase">
                              {item.product?.category}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                            <span>S/N: <b className="text-sky-600 dark:text-sky-400">{item.serialNumber}</b></span>
                            {item.macAddress && <span>• MAC: <b>{item.macAddress}</b></span>}
                            {item.verificationCode && <span>• Cód: <b className="text-amber-500">{item.verificationCode}</b></span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 hidden sm:inline">{item.currentWarehouse?.name || 'Bodega'}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleQuickBindSingleItem(item.id);
                          }}
                          disabled={isSubmittingAssignment}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition cursor-pointer"
                          title="Vincular este equipo inmediatamente al cliente en 2 segundos"
                        >
                          <span>⚡ Vincular en 2s</span>
                        </button>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            {/* Notas opcionales */}
            <div>
              <input
                type="text"
                placeholder="Notas de instalación (opcional)..."
                value={assignmentNotes}
                onChange={(e) => setAssignmentNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-hidden focus:border-indigo-500"
              />
            </div>

            {/* Footer y Confirmación */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="text-xs">
                <span className="font-bold text-slate-900 dark:text-white">{selectedItemIds.length}</span>{' '}
                <span className="text-slate-400">equipo(s) seleccionado(s)</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAssignment}
                  disabled={selectedItemIds.length === 0 || isSubmittingAssignment}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition cursor-pointer"
                >
                  {isSubmittingAssignment ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Asignando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirmar Asignación</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Sub-Modal: Confirmar Desvinculación / Retiro de Equipo ── */}
      {unassignConfirmItem && (
        <div className="fixed inset-0 z-70 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Desvincular Equipo de Cliente
                </h3>
                <span className="text-xs text-slate-500">
                  ¿Retirar o desasociar este equipo del contrato?
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1">
              <div className="font-bold text-slate-800 dark:text-slate-200">
                {unassignConfirmItem.product?.name || 'Equipo'}
              </div>
              <div className="font-mono text-slate-500">
                S/N: <b className="text-sky-600">{unassignConfirmItem.serialNumber}</b>
                {unassignConfirmItem.macAddress && ` • MAC: ${unassignConfirmItem.macAddress}`}
              </div>
            </div>

            {/* Selector de Destino del Equipo */}
            <div className="space-y-1.5 text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                Estado posterior al retiro:
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="unassignStatus"
                    value="EN_BODEGA"
                    checked={unassignStatus === 'EN_BODEGA'}
                    onChange={() => setUnassignStatus('EN_BODEGA')}
                    className="text-indigo-600"
                  />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">Disponible en Bodega</span>
                    <span className="text-[11px] text-slate-400">El equipo está en buen estado y queda disponible para otro cliente</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="unassignStatus"
                    value="RMA_DEFECTUOSO"
                    checked={unassignStatus === 'RMA_DEFECTUOSO'}
                    onChange={() => setUnassignStatus('RMA_DEFECTUOSO')}
                    className="text-rose-600"
                  />
                  <div>
                    <span className="font-bold text-rose-600 block">Dañado / RMA Defectuoso</span>
                    <span className="text-[11px] text-slate-400">Equipo averiado para garantía o reemplazo técnico</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Motivo de desvinculación */}
            <div>
              <input
                type="text"
                placeholder="Motivo del retiro o cambio de equipo..."
                value={unassignNotes}
                onChange={(e) => setUnassignNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-hidden focus:border-rose-500"
              />
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setUnassignConfirmItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmUnassign}
                disabled={isSubmittingUnassign}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer"
              >
                {isSubmittingUnassign ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirmar Retiro</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
