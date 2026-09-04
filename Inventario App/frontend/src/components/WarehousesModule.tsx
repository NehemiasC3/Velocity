import React, { useEffect, useState } from 'react';
import { 
  Building2, Store, Truck, Plus, Search, ShieldAlert, 
  Package, AlertCircle, RefreshCw, Layers, ArrowRight,
  MapPin, Check, GitFork, X, ChevronRight, Info,
  Edit2, Trash2
} from 'lucide-react';
import { api } from '../services/api';
import { Warehouse, SerializedItem, BulkItem, BulkStock, WarehouseType } from '../types';
import { useAuth } from '../context/AuthContext';

export const WarehousesModule: React.FC = () => {
  const { currentUser } = useAuth();
  
  // Verificación de Rol Administrador / Supervisor
  const userRole = String(currentUser?.role || sessionStorage?.getItem('Velocity_Role') || localStorage?.getItem('Velocity_Role') || 'SUPERADMIN').toUpperCase();
  const isAdmin = ['SUPERADMIN', 'ADMIN_BODEGA', 'ADMIN', 'SUPERVISOR', 'SUPERVISOR_MESA'].includes(userRole) || userRole === '';

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('all');
  const [activeSubTab, setActiveSubTab] = useState<'serialized' | 'bulk'>('serialized');
  
  const [serializedItems, setSerializedItems] = useState<SerializedItem[]>([]);
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([]);
  const [bulkStocks, setBulkStocks] = useState<BulkStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmittingWh, setIsSubmittingWh] = useState(false);

  // Modales
  const [showNewWarehouseModal, setShowNewWarehouseModal] = useState(false);
  const [showEditWarehouseModal, setShowEditWarehouseModal] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [isDeletingWhId, setIsDeletingWhId] = useState<string | null>(null);

  const [showAddOnuModal, setShowAddOnuModal] = useState(false);
  const [showAdjustBulkModal, setShowAdjustBulkModal] = useState(false);
  const [showRmaModal, setShowRmaModal] = useState(false);
  const [selectedItemForRma, setSelectedItemForRma] = useState<SerializedItem | null>(null);
  const [rmaReason, setRmaReason] = useState('');

  // Form states
  const [newWhForm, setNewWhForm] = useState({
    name: '',
    code: '',
    type: 'SUCURSAL' as WarehouseType,
    parentId: '',
    address: '',
    vehiclePlate: ''
  });

  const [editWhForm, setEditWhForm] = useState({
    name: '',
    code: '',
    type: 'SUCURSAL' as WarehouseType,
    parentId: '',
    address: '',
    vehiclePlate: ''
  });

  const [newOnu, setNewOnu] = useState({
    macAddress: '',
    serialNumber: '',
    brand: 'Huawei',
    model: 'EG8145V5 Dual Band AC',
    category: 'ONU_GPON',
    currentWarehouseId: ''
  });

  const [bulkAdjust, setBulkAdjust] = useState({
    warehouseId: '',
    bulkItemId: '',
    deltaQuantity: 0,
    reason: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [whRes, serRes, bulkRes] = await Promise.all([
        api.getWarehouses(),
        api.getSerializedItems().catch(() => ({ items: [] })),
        api.getBulkInventory().catch(() => ({ items: [], stocks: [] }))
      ]);

      const loadedWarehouses = whRes.warehouses || [];
      setWarehouses(loadedWarehouses);
      setSerializedItems(serRes.items || []);
      setBulkItems(bulkRes.items || []);
      setBulkStocks(bulkRes.stocks || []);
      
      if (!newOnu.currentWarehouseId && loadedWarehouses.length > 0) {
        setNewOnu(prev => ({ ...prev, currentWarehouseId: loadedWarehouses[0].id }));
        setBulkAdjust(prev => ({ 
          ...prev, 
          warehouseId: loadedWarehouses[0].id,
          bulkItemId: bulkRes.items?.[0]?.id || ''
        }));
      }
    } catch (err) {
      console.error('Error cargando bodegas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Crear nueva Bodega
  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWhForm.name.trim()) return;

    try {
      setIsSubmittingWh(true);
      await api.createWarehouse({
        name: newWhForm.name.trim(),
        code: newWhForm.code.trim() || undefined,
        type: newWhForm.type,
        parentId: newWhForm.parentId || undefined,
        address: newWhForm.address.trim() || undefined,
        vehiclePlate: newWhForm.type === 'VEHICULO' ? newWhForm.vehiclePlate.trim() : undefined
      });

      setShowNewWarehouseModal(false);
      setNewWhForm({
        name: '',
        code: '',
        type: 'SUCURSAL',
        parentId: '',
        address: '',
        vehiclePlate: ''
      });
      await loadData();
    } catch (err: any) {
      alert(`Error al crear la bodega: ${err.message}`);
    } finally {
      setIsSubmittingWh(false);
    }
  };

  // Abrir Modal de Edición
  const handleOpenEditModal = (wh: Warehouse, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingWarehouse(wh);
    setEditWhForm({
      name: wh.name || '',
      code: wh.code || '',
      type: wh.type || 'SUCURSAL',
      parentId: wh.parentId || wh.parent_id || '',
      address: wh.address || wh.location || '',
      vehiclePlate: wh.vehiclePlate || ''
    });
    setShowEditWarehouseModal(true);
  };

  // Actualizar Bodega Existente
  const handleUpdateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWarehouse || !editWhForm.name.trim()) return;

    try {
      setIsSubmittingWh(true);
      await api.updateWarehouse(editingWarehouse.id, {
        name: editWhForm.name.trim(),
        code: editWhForm.code.trim() || undefined,
        type: editWhForm.type,
        parentId: editWhForm.parentId || (null as any),
        address: editWhForm.address.trim() || undefined,
        vehiclePlate: editWhForm.type === 'VEHICULO' ? editWhForm.vehiclePlate.trim() : undefined
      });

      setShowEditWarehouseModal(false);
      setEditingWarehouse(null);
      await loadData();
    } catch (err: any) {
      alert(`Error al actualizar la bodega: ${err.message}`);
    } finally {
      setIsSubmittingWh(false);
    }
  };

  // Eliminar Bodega
  const handleDeleteWarehouse = async (wh: Warehouse, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`¿Estás seguro de eliminar la bodega "${wh.name}"?\nEsta acción no se puede deshacer.`)) {
      return;
    }

    try {
      setIsDeletingWhId(wh.id);
      await api.deleteWarehouse(wh.id);
      if (selectedWarehouseId === wh.id) {
        setSelectedWarehouseId('all');
      }
      await loadData();
    } catch (err: any) {
      alert(`Error al eliminar la bodega: ${err.message}`);
    } finally {
      setIsDeletingWhId(null);
    }
  };

  const handleCreateOnu = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createSerializedItem(newOnu);
      setShowAddOnuModal(false);
      setNewOnu({
        macAddress: '',
        serialNumber: '',
        brand: 'Huawei',
        model: 'EG8145V5 Dual Band AC',
        category: 'ONU_GPON',
        currentWarehouseId: warehouses[0]?.id || ''
      });
      loadData();
    } catch (err: any) {
      alert(`Error creando ONU: ${err.message}`);
    }
  };

  const handleAdjustBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.adjustBulkStock(bulkAdjust);
      setShowAdjustBulkModal(false);
      loadData();
    } catch (err: any) {
      alert(`Error ajustando stock: ${err.message}`);
    }
  };

  const handleReportRMA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForRma) return;
    try {
      await api.reportRMA(selectedItemForRma.id, rmaReason);
      setShowRmaModal(false);
      setSelectedItemForRma(null);
      setRmaReason('');
      loadData();
    } catch (err: any) {
      alert(`Error reportando RMA: ${err.message}`);
    }
  };

  // Helper de ícono y estilo por tipo de bodega
  const getWarehouseTypeBadge = (type: WarehouseType | string) => {
    switch (type) {
      case 'PRINCIPAL':
      case 'HUB':
        return {
          icon: <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />,
          label: 'Hub Principal',
          color: 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300'
        };
      case 'SUCURSAL':
      case 'SPOKE':
        return {
          icon: <Store className="w-4 h-4 text-sky-600 dark:text-sky-400" />,
          label: 'Sucursal Regional',
          color: 'bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300'
        };
      case 'VEHICULO':
        return {
          icon: <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
          label: 'Móvil / Vehículo',
          color: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
        };
      case 'CUARENTENA_RMA':
        return {
          icon: <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />,
          label: 'Cuarentena RMA',
          color: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
        };
      default:
        return {
          icon: <Layers className="w-4 h-4 text-slate-600" />,
          label: type,
          color: 'bg-slate-100 text-slate-700'
        };
    }
  };

  // Filtrado de tablas
  const filteredSerialized = serializedItems.filter(item => {
    const matchesWh = selectedWarehouseId === 'all' || item.currentWarehouseId === selectedWarehouseId;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || 
      item.macAddress?.toLowerCase().includes(q) ||
      item.serialNumber?.toLowerCase().includes(q) ||
      item.model?.toLowerCase().includes(q) ||
      item.brand?.toLowerCase().includes(q);
    return matchesWh && matchesSearch;
  });

  const filteredBulkStocks = bulkStocks.filter(stock => {
    const matchesWh = selectedWarehouseId === 'all' || stock.warehouseId === selectedWarehouseId;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || stock.bulkItemName?.toLowerCase().includes(q);
    return matchesWh && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'EN_BODEGA':
        return <span className="bg-sky-100 text-sky-800 text-xs font-semibold px-2.5 py-0.5 rounded-full dark:bg-sky-950 dark:text-sky-300">En Bodega</span>;
      case 'EN_VEHICULO':
        return <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full dark:bg-emerald-950 dark:text-emerald-300">En Móvil</span>;
      case 'EN_TRANSITO':
        return <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full dark:bg-amber-950 dark:text-amber-300 animate-pulse">En Tránsito</span>;
      case 'INSTALADO_CLIENTE':
        return <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-0.5 rounded-full dark:bg-indigo-950 dark:text-indigo-300">Instalado</span>;
      case 'RMA_DEFECTUOSO':
        return <span className="bg-rose-100 text-rose-800 text-xs font-semibold px-2.5 py-0.5 rounded-full dark:bg-rose-950 dark:text-rose-300 font-bold">RMA / Dañado</span>;
      default:
        return <span className="bg-slate-100 text-slate-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* ── Top Header con Botón de Creación ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-slate-900 dark:text-white">
              Gestión de Bodegas y Cadena Logística
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 font-bold">
              Hub & Spoke
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Estructura jerárquica: Central (Hub) &rarr; Sucursales Zonales &rarr; Vehículos / Cuadrillas (Spokes móviles)
          </p>
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowNewWarehouseModal(true)}
            className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nueva Bodega</span>
          </button>

          {currentUser?.role === 'ADMIN_BODEGA' && (
            <>
              <button
                onClick={() => setShowAddOnuModal(true)}
                className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold px-3 py-2.5 rounded-xl transition"
              >
                <Package className="w-4 h-4 text-sky-500" />
                <span>+ Alta ONU</span>
              </button>
              <button
                onClick={() => setShowAdjustBulkModal(true)}
                className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold px-3 py-2.5 rounded-xl transition"
              >
                <Layers className="w-4 h-4 text-emerald-500" />
                <span>Ajustar Granel</span>
              </button>
            </>
          )}

          <button
            onClick={loadData}
            title="Refrescar lista"
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Grid de Tarjetas de Bodegas (Jerarquía Visual) ── */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Red de Bodegas ({warehouses.length})
          </h3>
          <span className="text-xs text-slate-500">
            Haz clic en una bodega para filtrar su stock
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-44 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            
            {/* Tarjeta General (Todas) */}
            <div
              onClick={() => setSelectedWarehouseId('all')}
              className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                selectedWarehouseId === 'all'
                  ? 'bg-sky-50/80 dark:bg-sky-950/40 border-sky-500 ring-2 ring-sky-500/20 shadow-md'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-300 hover:shadow-sm'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
                    <Layers className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    Vista General
                  </span>
                </div>
                <h4 className="font-heading font-bold text-base text-slate-900 dark:text-white">
                  Todas las Bodegas
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Inventario consolidado de toda la red
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-500">Total Seriados:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                  {serializedItems.length}
                </span>
              </div>
            </div>

            {/* Listado dinámico de Bodegas */}
            {warehouses.map(wh => {
              const badge = getWarehouseTypeBadge(wh.type);
              const isSelected = selectedWarehouseId === wh.id;
              const countSer = serializedItems.filter(i => i.currentWarehouseId === wh.id).length;
              const childCount = wh.childWarehouses?.length || 0;

              return (
                <div
                  key={wh.id}
                  onClick={() => setSelectedWarehouseId(wh.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-sky-50/80 dark:bg-sky-950/40 border-sky-500 ring-2 ring-sky-500/20 shadow-md'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-300 hover:shadow-sm'
                  }`}
                >
                  <div>
                    {/* Header de la tarjeta */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                          {badge.icon}
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {wh.code}
                        </span>
                        <div className="flex items-center gap-1 ml-1 border-l border-slate-200 dark:border-slate-700 pl-1.5">
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditModal(wh, e)}
                            title="Editar bodega (Nombre, tipo, ubicación)"
                            className="p-1.5 rounded-lg text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/70 dark:hover:bg-sky-900/80 transition-colors border border-sky-200 dark:border-sky-800 shadow-2xs"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteWarehouse(wh, e)}
                            disabled={isDeletingWhId === wh.id}
                            title="Eliminar bodega"
                            className="p-1.5 rounded-lg text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/70 dark:hover:bg-rose-900/80 transition-colors border border-rose-200 dark:border-rose-800 shadow-2xs disabled:opacity-50"
                          >
                            {isDeletingWhId === wh.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-500" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Nombre y Ubicación */}
                    <h4 className="font-heading font-bold text-base text-slate-900 dark:text-white line-clamp-1">
                      {wh.name}
                    </h4>
                    
                    {wh.address && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-1 line-clamp-1">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{wh.address}</span>
                      </p>
                    )}

                    {wh.vehiclePlate && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-1">
                        <Truck className="w-3 h-3" />
                        <span>Placa: {wh.vehiclePlate}</span>
                      </p>
                    )}

                    {/* Datos de Jerarquía (Abastecida por / Abastece a) */}
                    <div className="mt-2.5 space-y-1 text-[11px]">
                      {wh.parentWarehouse ? (
                        <div className="flex items-center gap-1 text-slate-500">
                          <span className="text-slate-400">Abastece:</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                            {wh.parentWarehouse.name}
                          </span>
                        </div>
                      ) : (
                        <div className="text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1">
                          <GitFork className="w-3 h-3" />
                          <span>Hub Raíz (Centro de Distribución)</span>
                        </div>
                      )}

                      {childCount > 0 && (
                        <div className="text-sky-600 dark:text-sky-400 font-medium">
                          &bull; Abastece a {childCount} sub-bodega(s) / vehículo(s)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer con conteos y botón de edición */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Equipos Asignados:</span>
                      <span className="font-mono font-bold text-sky-600 dark:text-sky-400 text-sm">
                        {countSer} {countSer === 1 ? 'equipo' : 'equipos'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleOpenEditModal(wh, e)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-700 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/80 px-3 py-1.5 rounded-xl border border-sky-200 dark:border-sky-800 transition active:scale-95 shadow-2xs"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Tabla Principal de Existencias Físicas ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        
        {/* Header de Pestañas y Buscador */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setActiveSubTab('serialized')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeSubTab === 'serialized'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Artículos Seriados ({filteredSerialized.length} ONUs/Routers)
            </button>
            <button
              onClick={() => setActiveSubTab('bulk')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeSubTab === 'bulk'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Artículos a Granel ({filteredBulkStocks.length} Registros)
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={activeSubTab === 'serialized' ? "Buscar por MAC, Serial, Modelo..." : "Buscar material a granel..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

        </div>

        {/* Tab 1: Seriados */}
        {activeSubTab === 'serialized' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">MAC Address</th>
                  <th className="py-3 px-4">Serial (S/N)</th>
                  <th className="py-3 px-4">Marca & Modelo</th>
                  <th className="py-3 px-4">Bodega Actual</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredSerialized.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      No se encontraron equipos seriados en esta bodega con el filtro actual.
                    </td>
                  </tr>
                ) : (
                  filteredSerialized.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-sky-600 dark:text-sky-400">
                        {item.macAddress}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-800 dark:text-slate-200">
                        {item.serialNumber}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900 dark:text-white">{item.brand}</span> {item.model}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {item.currentWarehouseName || item.currentWarehouseId}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {item.status !== 'RMA_DEFECTUOSO' && item.status !== 'INSTALADO_CLIENTE' && (
                          <button
                            onClick={() => {
                              setSelectedItemForRma(item);
                              setShowRmaModal(true);
                            }}
                            className="text-rose-600 hover:text-rose-700 dark:text-rose-400 text-xs font-semibold px-2 py-1 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 transition"
                          >
                            Reportar RMA
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Granel */}
        {activeSubTab === 'bulk' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Material / Artículo</th>
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Bodega Asignada</th>
                  <th className="py-3 px-4">Cantidad Disponible</th>
                  <th className="py-3 px-4">Unidad</th>
                  <th className="py-3 px-4">Estado Stock</th>
                  <th className="py-3 px-4 text-right">Última Actualización</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredBulkStocks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      No hay registros a granel en esta bodega.
                    </td>
                  </tr>
                ) : (
                  filteredBulkStocks.map((stock) => {
                    const itemDef = bulkItems.find(b => b.id === stock.bulkItemId);
                    const isCritical = itemDef && stock.quantity < itemDef.minStockAlert;

                    return (
                      <tr key={stock.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                          {stock.bulkItemName}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {stock.bulkItemCode}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {stock.warehouseName}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-sm font-bold font-mono ${
                            isCritical ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
                          }`}>
                            {stock.quantity.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-semibold">
                          {stock.unitOfMeasure}
                        </td>
                        <td className="py-3 px-4">
                          {isCritical ? (
                            <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 text-xs font-bold px-2 py-0.5 rounded-full dark:bg-rose-950 dark:text-rose-300">
                              <AlertCircle className="w-3 h-3" /> Stock Crítico (&lt; {itemDef?.minStockAlert})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs font-medium px-2 py-0.5 rounded-full dark:bg-emerald-950 dark:text-emerald-300">
                              <Check className="w-3 h-3" /> Óptimo
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400 text-[11px]">
                          {stock.updatedAt ? new Date(stock.updatedAt).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* ── MODAL: NUEVA BODEGA (Hub & Spoke Form) ── */}
      {showNewWarehouseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white">
                    Crear Nueva Bodega
                  </h3>
                  <p className="text-xs text-slate-500">
                    Integra un nuevo nodo a la red logística de Rappido Panamá
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowNewWarehouseModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWarehouse} className="space-y-4 text-xs">
              
              {/* Nombre de la bodega */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Nombre de la Bodega *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Sucursal Metetí, Cuadrilla Móvil #3, Hub Central"
                  value={newWhForm.name}
                  onChange={(e) => setNewWhForm({ ...newWhForm, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              {/* Tipo de Bodega y Código */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Tipo de Bodega *
                  </label>
                  <select
                    value={newWhForm.type}
                    onChange={(e) => setNewWhForm({ ...newWhForm, type: e.target.value as WarehouseType })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-sky-500 outline-none"
                  >
                    <option value="PRINCIPAL">🏢 Hub Central (Principal)</option>
                    <option value="SUCURSAL">🏪 Sucursal Regional (Sub-Hub)</option>
                    <option value="VEHICULO">🚚 Móvil / Cuadrilla (Vehículo)</option>
                    <option value="CUARENTENA_RMA">⚠️ Cuarentena RMA (Dañados)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Código Identificador (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. HUB-TOC, SUC-MET, MOV-04"
                    value={newWhForm.code}
                    onChange={(e) => setNewWhForm({ ...newWhForm, code: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white font-mono uppercase focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>
              </div>

              {/* Bodega Padre (Depende de / Abastecida por) */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1 flex items-center justify-between">
                  <span>Bodega Padre (Abastecida por)</span>
                  <span className="text-[11px] text-slate-400 font-normal">Define la jerarquía Hub-and-Spoke</span>
                </label>
                <select
                  value={newWhForm.parentId}
                  onChange={(e) => setNewWhForm({ ...newWhForm, parentId: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-sky-500 outline-none"
                >
                  <option value="">-- Ninguna (Es un Hub Principal Raíz) --</option>
                  {warehouses
                    .filter(w => w.type === 'PRINCIPAL' || w.type === 'SUCURSAL' || w.type === 'HUB' || w.type === 'SPOKE')
                    .map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code}) &bull; Tipo: {w.type}
                      </option>
                    ))}
                </select>
              </div>

              {/* Ubicación / Dirección */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Ubicación Física / Dirección
                </label>
                <input
                  type="text"
                  placeholder="Ej. Tocumen, Vía Panamericana Km 140, Metetí"
                  value={newWhForm.address}
                  onChange={(e) => setNewWhForm({ ...newWhForm, address: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              {/* Placa (si es vehículo) */}
              {newWhForm.type === 'VEHICULO' && (
                <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                  <label className="block text-emerald-800 dark:text-emerald-300 font-bold mb-1">
                    Placa del Vehículo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. AB-1234, 894321"
                    value={newWhForm.vehiclePlate}
                    onChange={(e) => setNewWhForm({ ...newWhForm, vehiclePlate: e.target.value })}
                    className="w-full bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono uppercase focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              )}

              {/* Acciones del Modal */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewWarehouseModal(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingWh}
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-md active:scale-95 transition-all flex items-center gap-2"
                >
                  {isSubmittingWh && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>Guardar Bodega</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: EDITAR BODEGA (Administrador) ── */}
      {showEditWarehouseModal && editingWarehouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white">
                    Editar Bodega / Punto de Red
                  </h3>
                  <p className="text-xs text-slate-500">
                    Modifica los datos de la bodega <span className="font-bold text-slate-700 dark:text-slate-300">"{editingWarehouse.name}"</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowEditWarehouseModal(false);
                  setEditingWarehouse(null);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateWarehouse} className="space-y-4 text-xs">
              
              {/* Nombre de la bodega */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Nombre de la Bodega *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Sucursal Metetí, Cuadrilla Móvil #3, Hub Central"
                  value={editWhForm.name}
                  onChange={(e) => setEditWhForm({ ...editWhForm, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              {/* Tipo de Bodega y Código */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Tipo de Bodega *
                  </label>
                  <select
                    value={editWhForm.type}
                    onChange={(e) => setEditWhForm({ ...editWhForm, type: e.target.value as WarehouseType })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-sky-500 outline-none"
                  >
                    <option value="PRINCIPAL">🏢 Hub Central (Principal)</option>
                    <option value="SUCURSAL">🏪 Sucursal Regional (Sub-Hub)</option>
                    <option value="VEHICULO">🚚 Móvil / Cuadrilla (Vehículo)</option>
                    <option value="CUARENTENA_RMA">⚠️ Cuarentena RMA (Dañados)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Código Identificador
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. HUB-TOC, SUC-MET, MOV-04"
                    value={editWhForm.code}
                    onChange={(e) => setEditWhForm({ ...editWhForm, code: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white font-mono uppercase focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>
              </div>

              {/* Bodega Padre (Depende de / Abastecida por) */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1 flex items-center justify-between">
                  <span>Bodega Padre (Abastecida por)</span>
                  <span className="text-[11px] text-slate-400 font-normal">Jerarquía Hub-and-Spoke</span>
                </label>
                <select
                  value={editWhForm.parentId}
                  onChange={(e) => setEditWhForm({ ...editWhForm, parentId: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-sky-500 outline-none"
                >
                  <option value="">-- Ninguna (Es un Hub Principal Raíz) --</option>
                  {warehouses
                    .filter(w => w.id !== editingWarehouse.id && (w.type === 'PRINCIPAL' || w.type === 'SUCURSAL' || w.type === 'HUB' || w.type === 'SPOKE'))
                    .map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code}) &bull; Tipo: {w.type}
                      </option>
                    ))}
                </select>
              </div>

              {/* Ubicación / Dirección */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Ubicación Física / Dirección
                </label>
                <input
                  type="text"
                  placeholder="Ej. Tocumen, Vía Panamericana Km 140, Metetí"
                  value={editWhForm.address}
                  onChange={(e) => setEditWhForm({ ...editWhForm, address: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              {/* Placa (si es vehículo) */}
              {editWhForm.type === 'VEHICULO' && (
                <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                  <label className="block text-emerald-800 dark:text-emerald-300 font-bold mb-1">
                    Placa del Vehículo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. AB-1234, 894321"
                    value={editWhForm.vehiclePlate}
                    onChange={(e) => setEditWhForm({ ...editWhForm, vehiclePlate: e.target.value })}
                    className="w-full bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono uppercase focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              )}

              {/* Acciones del Modal */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditWarehouseModal(false);
                    setEditingWarehouse(null);
                  }}
                  className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingWh}
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-md active:scale-95 transition-all flex items-center gap-2"
                >
                  {isSubmittingWh && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>Actualizar Bodega</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Modal: Alta de ONU */}
      {showAddOnuModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-sky-500" />
              <span>Alta de Equipo Seriado (ONU / Router)</span>
            </h3>

            <form onSubmit={handleCreateOnu} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">MAC Address *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. F4:8E:38:AA:BB:CC"
                    value={newOnu.macAddress}
                    onChange={(e) => setNewOnu({ ...newOnu, macAddress: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">Serial (S/N) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. HWTC12345678"
                    value={newOnu.serialNumber}
                    onChange={(e) => setNewOnu({ ...newOnu, serialNumber: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">Marca *</label>
                  <select
                    value={newOnu.brand}
                    onChange={(e) => setNewOnu({ ...newOnu, brand: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  >
                    <option value="Huawei">Huawei</option>
                    <option value="ZTE">ZTE</option>
                    <option value="VSOL">VSOL</option>
                    <option value="FiberHome">FiberHome</option>
                    <option value="Mikrotik">Mikrotik</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">Modelo *</label>
                  <input
                    type="text"
                    required
                    value={newOnu.model}
                    onChange={(e) => setNewOnu({ ...newOnu, model: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">Ingresar a Bodega *</label>
                <select
                  value={newOnu.currentWarehouseId}
                  onChange={(e) => setNewOnu({ ...newOnu, currentWarehouseId: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.type})</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddOnuModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold shadow-sm"
                >
                  Guardar en Inventario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Ajustar Stock Granel */}
      {showAdjustBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-sky-500" />
              <span>Ajuste Manual de Material a Granel</span>
            </h3>

            <form onSubmit={handleAdjustBulk} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">Bodega Objetivo</label>
                <select
                  value={bulkAdjust.warehouseId}
                  onChange={(e) => setBulkAdjust({ ...bulkAdjust, warehouseId: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">Material</label>
                <select
                  value={bulkAdjust.bulkItemId}
                  onChange={(e) => setBulkAdjust({ ...bulkAdjust, bulkItemId: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                >
                  {bulkItems.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.unitOfMeasure})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  Cantidad a Incrementar o Disminuir (ej. +500 o -200)
                </label>
                <input
                  type="number"
                  required
                  placeholder="Ej. 1000"
                  value={bulkAdjust.deltaQuantity}
                  onChange={(e) => setBulkAdjust({ ...bulkAdjust, deltaQuantity: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">Motivo del Ajuste</label>
                <input
                  type="text"
                  placeholder="Ej. Recepción de compras / Conteo físico"
                  value={bulkAdjust.reason}
                  onChange={(e) => setBulkAdjust({ ...bulkAdjust, reason: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAdjustBulkModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold shadow-sm"
                >
                  Aplicar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reportar RMA */}
      {showRmaModal && selectedItemForRma && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-heading font-bold text-lg text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" />
              <span>Reportar Equipo en Garantía (RMA)</span>
            </h3>

            <p className="text-xs text-slate-500">
              Equipo: <strong className="text-slate-800 dark:text-slate-200">{selectedItemForRma.brand} {selectedItemForRma.model}</strong><br />
              MAC: <span className="font-mono font-bold text-sky-600">{selectedItemForRma.macAddress}</span>
            </p>

            <form onSubmit={handleReportRMA} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">Motivo / Falla Técnica *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ej. Puerto PON quemado, láser no sincroniza."
                  value={rmaReason}
                  onChange={(e) => setRmaReason(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRmaModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-sm"
                >
                  Marcar como RMA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
