import React, { useEffect, useState } from 'react';
import { 
  Building2, Truck, Plus, Filter, Search, ShieldAlert, 
  Package, CheckCircle, Clock, Check, AlertCircle, RefreshCw,
  Layers, ArrowRightLeft, Radio, DollarSign
} from 'lucide-react';
import { api } from '../services/api';
import { Warehouse, SerializedItem, BulkItem, BulkStock } from '../types';
import { useAuth } from '../context/AuthContext';

export const WarehousesModule: React.FC = () => {
  const { currentUser } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('all');
  const [activeSubTab, setActiveSubTab] = useState<'serialized' | 'bulk'>('serialized');
  
  const [serializedItems, setSerializedItems] = useState<SerializedItem[]>([]);
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([]);
  const [bulkStocks, setBulkStocks] = useState<BulkStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showAddOnuModal, setShowAddOnuModal] = useState(false);
  const [showAdjustBulkModal, setShowAdjustBulkModal] = useState(false);
  const [showRmaModal, setShowRmaModal] = useState(false);
  const [selectedItemForRma, setSelectedItemForRma] = useState<SerializedItem | null>(null);
  const [rmaReason, setRmaReason] = useState('');

  // Form states
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
        api.getSerializedItems(),
        api.getBulkInventory()
      ]);
      setWarehouses(whRes.warehouses);
      setSerializedItems(serRes.items);
      setBulkItems(bulkRes.items);
      setBulkStocks(bulkRes.stocks);
      
      if (!newOnu.currentWarehouseId && whRes.warehouses.length > 0) {
        setNewOnu(prev => ({ ...prev, currentWarehouseId: whRes.warehouses[0].id }));
        setBulkAdjust(prev => ({ 
          ...prev, 
          warehouseId: whRes.warehouses[0].id,
          bulkItemId: bulkRes.items[0]?.id || ''
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

  // Filtered items
  const filteredSerialized = serializedItems.filter(item => {
    const matchesWh = selectedWarehouseId === 'all' || item.currentWarehouseId === selectedWarehouseId;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || 
      item.macAddress.toLowerCase().includes(q) ||
      item.serialNumber.toLowerCase().includes(q) ||
      item.model.toLowerCase().includes(q) ||
      item.brand.toLowerCase().includes(q);
    return matchesWh && matchesSearch;
  });

  const filteredBulkStocks = bulkStocks.filter(stock => {
    const matchesWh = selectedWarehouseId === 'all' || stock.warehouseId === selectedWarehouseId;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || stock.bulkItemName.toLowerCase().includes(q);
    return matchesWh && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'EN_BODEGA':
        return <span className="bg-sky-100 text-sky-800 text-xs font-semibold px-2.5 py-0.5 rounded-full dark:bg-sky-950 dark:text-sky-300">En Bodega</span>;
      case 'EN_VEHICULO':
        return <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full dark:bg-emerald-950 dark:text-emerald-300">En Camioneta</span>;
      case 'EN_TRANSITO':
        return <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full dark:bg-amber-950 dark:text-amber-300 animate-pulse">En Tránsito</span>;
      case 'INSTALADO_CLIENTE':
        return <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-0.5 rounded-full dark:bg-indigo-950 dark:text-indigo-300">Instalado (Wispro)</span>;
      case 'RMA_DEFECTUOSO':
        return <span className="bg-rose-100 text-rose-800 text-xs font-semibold px-2.5 py-0.5 rounded-full dark:bg-rose-950 dark:text-rose-300 font-bold">RMA / Garantía</span>;
      default:
        return <span className="bg-slate-100 text-slate-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-heading font-bold text-slate-900 dark:text-white">
            Modelo de Bodegas Hub-and-Spoke
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Jerarquía y stock en tiempo real: Bodega Principal &rarr; Sucursales Zonales &rarr; Bodegas Móviles (Camionetas)
          </p>
        </div>

        {/* Action buttons (RBAC check for Admin) */}
        {currentUser?.role === 'ADMIN_BODEGA' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddOnuModal(true)}
              className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Alta ONU / Router</span>
            </button>
            <button
              onClick={() => setShowAdjustBulkModal(true)}
              className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3.5 py-2 rounded-xl transition border border-slate-700"
            >
              <Plus className="w-4 h-4" />
              <span>Ajustar Drop / Granel</span>
            </button>
          </div>
        )}
      </div>

      {/* Warehouse Selection Cards (Hub, Spokes, Vehicles) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <button
          onClick={() => setSelectedWarehouseId('all')}
          className={`p-4 rounded-xl border text-left transition-all ${
            selectedWarehouseId === 'all'
              ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-500 ring-2 ring-sky-500/20 text-slate-900 dark:text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <Layers className="w-5 h-5 text-sky-500" />
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
              Total
            </span>
          </div>
          <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white mt-2">Todas las Bodegas</h4>
          <p className="text-xs text-slate-500 mt-0.5">{serializedItems.length} Equipos Seriados</p>
        </button>

        {warehouses.map((wh) => {
          const isSelected = selectedWarehouseId === wh.id;
          const countSer = serializedItems.filter(i => i.currentWarehouseId === wh.id).length;

          return (
            <button
              key={wh.id}
              onClick={() => setSelectedWarehouseId(wh.id)}
              className={`p-4 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-500 ring-2 ring-sky-500/20 text-slate-900 dark:text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                {wh.type === 'HUB' && <Building2 className="w-5 h-5 text-purple-500" />}
                {wh.type === 'SPOKE' && <Building2 className="w-5 h-5 text-blue-500" />}
                {wh.type === 'VEHICLE' && <Truck className="w-5 h-5 text-emerald-500" />}
                
                <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                  wh.type === 'HUB' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' :
                  wh.type === 'SPOKE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' :
                  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                }`}>
                  {wh.type}
                </span>
              </div>

              <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white mt-2 line-clamp-1">
                {wh.name}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {wh.vehiclePlate ? `Placa: ${wh.vehiclePlate}` : wh.code} • {countSer} ONUs
              </p>
            </button>
          );
        })}
      </div>

      {/* Main Stock Table with Subtabs */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        
        {/* Subtabs & Search Header */}
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
              placeholder={activeSubTab === 'serialized' ? "Filtrar por MAC, Serial, Modelo..." : "Filtrar por nombre de material..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

        </div>

        {/* Tab 1: Serialized Hardware Table */}
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

        {/* Tab 2: Bulk Inventory Table (Drop Cable, Tensors, Connectors) */}
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
                          {new Date(stock.updatedAt).toLocaleDateString()}
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
                  placeholder="Ej. Recepción de compras / Ajuste por conteo físico"
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
                  placeholder="Ej. Puerto PON quemado por descarga eléctrica, no sincroniza láser OLT."
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
