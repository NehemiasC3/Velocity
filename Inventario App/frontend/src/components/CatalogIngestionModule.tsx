import React, { useEffect, useState } from 'react';
import { 
  PackagePlus, Layers, QrCode, Plus, CheckCircle2, 
  Building2, Sparkles, FileText, ArrowRight, HelpCircle,
  Truck, Check, ShieldCheck, Box, RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import { Warehouse, BulkItem } from '../types';
import { useAuth } from '../context/AuthContext';
import confetti from 'canvas-confetti';

export const CatalogIngestionModule: React.FC = () => {
  const { currentUser } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([]);
  const [activeTab, setActiveTab] = useState<'batch_onus' | 'receive_bulk' | 'new_bulk_item' | 'logic_guide'>('batch_onus');
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Form: Batch ONUs Ingestion
  const [batchWarehouseId, setBatchWarehouseId] = useState('');
  const [batchBrand, setBatchBrand] = useState('Huawei');
  const [batchModel, setBatchModel] = useState('EG8145V5 Dual Band AC');
  const [batchCategory, setBatchCategory] = useState<'ONU_GPON' | 'ONU_EPON' | 'ROUTER'>('ONU_GPON');
  const [batchMacsText, setBatchMacsText] = useState(
    'F4:8E:38:99:01:A1\nF4:8E:38:99:01:A2\nF4:8E:38:99:01:A3\nF4:8E:38:99:01:A4\nF4:8E:38:99:01:A5'
  );
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);

  // Form: Receive Bulk Stock
  const [receiveWhId, setReceiveWhId] = useState('');
  const [receiveBulkId, setReceiveBulkId] = useState('');
  const [receiveQty, setReceiveQty] = useState<number>(3000);
  const [receiveNotes, setReceiveNotes] = useState('Recepción de compra lote #PO-2026-102 a distribuidor');

  // Form: Create New Catalog Item
  const [newCatName, setNewCatName] = useState('');
  const [newCatCode, setNewCatCode] = useState('');
  const [newCatCategory, setNewCatCategory] = useState('SPLITTER');
  const [newCatUnit, setNewCatUnit] = useState('UNIDADES');
  const [newCatMinAlert, setNewCatMinAlert] = useState(50);
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatInitialWh, setNewCatInitialWh] = useState('');
  const [newCatInitialQty, setNewCatInitialQty] = useState(100);

  const loadData = async () => {
    try {
      setLoading(true);
      const [whRes, bulkRes] = await Promise.all([
        api.getWarehouses(),
        api.getBulkInventory()
      ]);
      setWarehouses(whRes.warehouses);
      setBulkItems(bulkRes.items);

      if (whRes.warehouses.length > 0) {
        setBatchWarehouseId(whRes.warehouses[0].id); // Central Hub by default
        setReceiveWhId(whRes.warehouses[0].id);
        setNewCatInitialWh(whRes.warehouses[0].id);
      }
      if (bulkRes.items.length > 0) {
        setReceiveBulkId(bulkRes.items[0].id);
      }
    } catch (err) {
      console.error('Error cargando catálogo:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handler: Batch Ingestion of ONUs
  const handleBatchIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = batchMacsText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length === 0) {
      alert('Debes ingresar al menos una MAC Address.');
      return;
    }

    const items = lines.map(line => {
      // Si la línea tiene MAC y Serial separados por coma o espacio
      const parts = line.split(/[,\t\s]+/);
      const macAddress = parts[0].toUpperCase();
      const serialNumber = parts.length > 1 ? parts[1].toUpperCase() : `SN-${macAddress.replace(/[^A-Z0-9]/g, '')}`;
      return { macAddress, serialNumber };
    });

    try {
      setIsSubmittingBatch(true);
      const res = await api.createSerializedBatch({
        items,
        brand: batchBrand,
        model: batchModel,
        category: batchCategory,
        targetWarehouseId: batchWarehouseId
      });

      confetti({ particleCount: 70, spread: 60 });
      setStatusMessage(`¡Éxito! Se ingresaron ${res.totalCreated} equipos (${batchBrand} ${batchModel}) a la bodega seleccionada.`);
      setBatchMacsText('');
      loadData();
      setTimeout(() => setStatusMessage(null), 6000);
    } catch (err: any) {
      alert(`Error al procesar lote: ${err.message}`);
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  // Handler: Receive Bulk Stock
  const handleReceiveBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveWhId || !receiveBulkId || receiveQty <= 0) {
      alert('Completa la bodega, material y cantidad positiva.');
      return;
    }

    try {
      await api.adjustBulkStock({
        warehouseId: receiveWhId,
        bulkItemId: receiveBulkId,
        deltaQuantity: receiveQty,
        reason: receiveNotes
      });

      confetti({ particleCount: 50, spread: 50 });
      setStatusMessage(`¡Stock actualizado con éxito! +${receiveQty.toLocaleString()} ingresados a la bodega.`);
      loadData();
      setTimeout(() => setStatusMessage(null), 6000);
    } catch (err: any) {
      alert(`Error al ingresar stock: ${err.message}`);
    }
  };

  // Handler: Create New Catalog Item
  const handleCreateCatalogItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName || !newCatCode) {
      alert('Nombre y código del artículo son obligatorios.');
      return;
    }

    try {
      await api.createBulkCatalogItem({
        name: newCatName,
        code: newCatCode,
        category: newCatCategory,
        unitOfMeasure: newCatUnit,
        minStockAlert: newCatMinAlert,
        description: newCatDesc,
        initialWarehouseId: newCatInitialWh,
        initialQuantity: newCatInitialQty
      });

      confetti({ particleCount: 60, spread: 50 });
      setStatusMessage(`¡Nuevo artículo '${newCatName}' creado e incorporado al catálogo del ISP!`);
      setNewCatName('');
      setNewCatCode('');
      setNewCatDesc('');
      loadData();
      setTimeout(() => setStatusMessage(null), 6000);
    } catch (err: any) {
      alert(`Error creando artículo: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1.5">
              <PackagePlus className="w-3.5 h-3.5" /> Catálogo & Compras
            </span>
            <span className="text-xs text-slate-400">Ingreso de Mercancía a Bodega Central</span>
          </div>
          <h2 className="text-2xl font-heading font-bold text-white">
            Catálogo Maestro & Altas de Artículos
          </h2>
          <p className="text-xs text-slate-300">
            Aquí das de alta nuevas ONUs/Routers (por lote o escáner), ingresas bobinas y conectores, o defines nuevos materiales para el ISP.
          </p>
        </div>

        <button
          onClick={() => setActiveTab('logic_guide')}
          className="bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-2 self-start md:self-auto"
        >
          <HelpCircle className="w-4 h-4" />
          <span>¿Cómo es la Lógica del Inventario?</span>
        </button>
      </div>

      {statusMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-2xl text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Module Navigation Subtabs */}
      <div className="flex flex-wrap gap-2 bg-slate-200 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-300 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('batch_onus')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'batch_onus'
              ? 'bg-sky-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>1. Alta de ONUs / Routers (Por Lote o Escáner)</span>
        </button>

        <button
          onClick={() => setActiveTab('receive_bulk')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'receive_bulk'
              ? 'bg-sky-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>2. Ingreso de Bobinas & Conectores a Granel</span>
        </button>

        <button
          onClick={() => setActiveTab('new_bulk_item')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'new_bulk_item'
              ? 'bg-sky-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>3. Definir Nuevo Tipo de Artículo en Catálogo</span>
        </button>

        <button
          onClick={() => setActiveTab('logic_guide')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ml-auto ${
            activeTab === 'logic_guide'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>Explicación del Flujo</span>
        </button>
      </div>

      {/* Tab 1: Batch ONUs Ingestion */}
      {activeTab === 'batch_onus' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <div>
            <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <QrCode className="w-5 h-5 text-sky-500" />
              <span>Ingreso de Lote de ONUs / Routers a Bodega Central</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ideal para cuando llega una caja de 10, 20 o 50 ONUs del proveedor. Pega las MACs leídas con la pistola de códigos o escríbelas una por línea.
            </p>
          </div>

          <form onSubmit={handleBatchIngest} className="space-y-4 text-xs">
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Marca del Equipo *</label>
                <select
                  value={batchBrand}
                  onChange={(e) => setBatchBrand(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                >
                  <option value="Huawei">Huawei</option>
                  <option value="ZTE">ZTE</option>
                  <option value="VSOL">VSOL</option>
                  <option value="FiberHome">FiberHome</option>
                  <option value="Mikrotik">Mikrotik</option>
                  <option value="TP-Link">TP-Link</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Modelo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. EG8145V5 Dual Band AC"
                  value={batchModel}
                  onChange={(e) => setBatchModel(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Bodega de Recepción *</label>
                <select
                  value={batchWarehouseId}
                  onChange={(e) => setBatchWarehouseId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.type})</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 dark:text-slate-300 font-semibold">
                  Lista de MACs (Una por línea, con o sin serial) *
                </label>
                <span className="text-[11px] text-slate-400">
                  {batchMacsText.split('\n').filter(l => l.trim()).length} equipos listos para ingresar
                </span>
              </div>
              <textarea
                required
                rows={6}
                value={batchMacsText}
                onChange={(e) => setBatchMacsText(e.target.value)}
                placeholder="F4:8E:38:AA:01:01&#10;F4:8E:38:AA:01:02&#10;F4:8E:38:AA:01:03, HWTC10293847"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs font-mono text-sky-600 dark:text-sky-400 focus:ring-2 focus:ring-sky-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Puedes pegar directamente desde Excel o el escáner de códigos de barra. Si no incluyes serial, se generará uno automáticamente basado en la MAC.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmittingBatch}
              className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs px-6 py-3 rounded-xl transition shadow-md shadow-sky-900/20 flex items-center gap-2"
            >
              <PackagePlus className="w-4 h-4" />
              <span>{isSubmittingBatch ? 'Ingresando lote...' : 'Ingresar Lote a Inventario'}</span>
            </button>

          </form>
        </div>
      )}

      {/* Tab 2: Receive Bulk Stock (Drop cable, connectors) */}
      {activeTab === 'receive_bulk' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <div>
            <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-sky-500" />
              <span>Ingreso de Stock a Granel (Bobinas Drop, Conectores, Tensores)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Suma metros de cable o unidades recibidas por compras o proveedores a la bodega principal o sucursal.
            </p>
          </div>

          <form onSubmit={handleReceiveBulk} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Bodega Receptora *</label>
                <select
                  value={receiveWhId}
                  onChange={(e) => setReceiveWhId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Material / Artículo *</label>
                <select
                  value={receiveBulkId}
                  onChange={(e) => setReceiveBulkId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                >
                  {bulkItems.map(item => (
                    <option key={item.id} value={item.id}>{item.name} ({item.unitOfMeasure})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Cantidad a Ingresar *</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="Ej. 3000 metros o 500 conectores"
                  value={receiveQty}
                  onChange={(e) => setReceiveQty(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Guía de Compra / Proveedor / Notas</label>
              <input
                type="text"
                value={receiveNotes}
                onChange={(e) => setReceiveNotes(e.target.value)}
                placeholder="Ej. Factura #4492 Distribuidor Fibra Óptica"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs px-6 py-3 rounded-xl transition shadow-md shadow-sky-900/20 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Ingreso de Stock</span>
            </button>
          </form>
        </div>
      )}

      {/* Tab 3: Define New Catalog Item */}
      {activeTab === 'new_bulk_item' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <div>
            <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <Box className="w-5 h-5 text-sky-500" />
              <span>Definir Nuevo Tipo de Artículo en el Catálogo Maestro</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Crea una nueva referencia que tu ISP maneje (ej. Splitters PLC, Rosetas 2 puertos, Cable Drop 4 Hilos, Patchcords especiales).
            </p>
          </div>

          <form onSubmit={handleCreateCatalogItem} className="space-y-4 text-xs">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Nombre del Material *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Splitter Óptico PLC 1x8 Conectorizado SC/APC"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Código Único (SKU) *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. SPL-1X8-SCAPC"
                  value={newCatCode}
                  onChange={(e) => setNewCatCode(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Categoría *</label>
                <select
                  value={newCatCategory}
                  onChange={(e) => setNewCatCategory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                >
                  <option value="SPLITTER">Splitter Óptico</option>
                  <option value="CABLE_DROP">Cable Drop Fibra</option>
                  <option value="CONECTOR_MECANICO">Conector Mecánico</option>
                  <option value="TENSOR_DROP">Tensor / Herraje</option>
                  <option value="ROSETA">Roseta / Caja Abonado</option>
                  <option value="PATCHCORD">Patchcord</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Unidad de Medida *</label>
                <select
                  value={newCatUnit}
                  onChange={(e) => setNewCatUnit(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                >
                  <option value="UNIDADES">UNIDADES</option>
                  <option value="METROS">METROS</option>
                  <option value="ROLLOS">ROLLOS</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Alerta Stock Crítico (&lt;)</label>
                <input
                  type="number"
                  value={newCatMinAlert}
                  onChange={(e) => setNewCatMinAlert(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Bodega para Carga Inicial</label>
                <select
                  value={newCatInitialWh}
                  onChange={(e) => setNewCatInitialWh(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Cantidad Inicial en Bodega</label>
                <input
                  type="number"
                  min="0"
                  value={newCatInitialQty}
                  onChange={(e) => setNewCatInitialQty(parseInt(e.target.value) || 0)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Descripción / Especificación Técnica</label>
              <input
                type="text"
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                placeholder="Ej. Splitter balanceado para cajas NAP de 8 puertos"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs px-6 py-3 rounded-xl transition shadow-md shadow-sky-900/20 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Guardar en Catálogo Maestro</span>
            </button>

          </form>
        </div>
      )}

      {/* Tab 4: Hub-and-Spoke Logic Guide */}
      {activeTab === 'logic_guide' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white">
                ¿Cómo funciona la Lógica de Inventario Hub-and-Spoke en un ISP?
              </h3>
              <p className="text-xs text-slate-500">
                Flujo paso a paso desde que llega la mercancía del proveedor hasta que se instala en el cliente con Wispro.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            
            <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">1</div>
              <h4 className="font-bold text-sm text-purple-900 dark:text-purple-200">Alta en Bodega Central (Hub)</h4>
              <p className="text-slate-600 dark:text-slate-300">
                La empresa recibe compras grandes (cajas de 50 ONUs, bobinas de 1Km de Drop). Se ingresan en esta pestaña a la <strong>Bodega Central Matriz</strong>.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">2</div>
              <h4 className="font-bold text-sm text-blue-900 dark:text-blue-200">Traslados a Sucursales (Spokes)</h4>
              <p className="text-slate-600 dark:text-slate-300">
                Desde el módulo de <strong>Traslados</strong>, el Admin despacha órdenes de tránsito (ej. 15 ONUs y 3000m de drop a la Sucursal Norte). Quedan en tránsito hasta que la sucursal confirma la recepción física.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">3</div>
              <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-200">Dotación a Camioneta (Móvil)</h4>
              <p className="text-slate-600 dark:text-slate-300">
                Cada técnico tiene una sub-bodega vehicular (ej. Camioneta 01). Solo puede instalar equipos y gastar metros de cable que tenga cargados físicamente en su vehículo.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 space-y-2">
              <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold">4</div>
              <h4 className="font-bold text-sm text-sky-900 dark:text-sky-200">Instalación & Wispro</h4>
              <p className="text-slate-600 dark:text-slate-300">
                El técnico abre la <strong>App de Campo</strong>, selecciona el cliente traído de Wispro, escanea la ONU y digita los metros usados. El sistema descuenta el stock y llama a Wispro para inyectar la MAC y activar el servicio.
              </p>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
