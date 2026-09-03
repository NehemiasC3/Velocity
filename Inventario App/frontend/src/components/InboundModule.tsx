import React, { useEffect, useState } from 'react';
import { 
  ArrowDownToLine, Building2, Store, Truck, ShieldAlert, 
  Package, Cpu, Disc, Boxes, Search, Plus, Trash2, 
  CheckCircle2, AlertTriangle, RefreshCw, Sparkles, 
  FileText, Clipboard, QrCode, ArrowRight, Layers
} from 'lucide-react';
import { api } from '../services/api';
import { Warehouse, ProductCatalog, TrackingType } from '../types';
import { useAuth } from '../context/AuthContext';

export const InboundModule: React.FC = () => {
  const { currentUser } = useAuth();
  
  // Data lists
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [catalog, setCatalog] = useState<ProductCatalog[]>([]);
  const [loading, setLoading] = useState(true);

  // Form selections
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [notes, setNotes] = useState('');

  // 1. Bulk State
  const [bulkQuantity, setBulkQuantity] = useState<number | ''>('');

  // 2. Batched State (Bobinas)
  const [batchItems, setBatchItems] = useState<Array<{ id: string; batchNumber: string; initialQuantity: number; notes: string }>>([
    { id: '1', batchNumber: '', initialQuantity: 1000, notes: '' }
  ]);

  // 3. Serialized State (ONUs / Routers)
  const [scanMode, setScanMode] = useState<'interactive' | 'paste'>('interactive');
  const [quickMac, setQuickMac] = useState('');
  const [quickSerial, setQuickSerial] = useState('');
  const [serializedList, setSerializedList] = useState<Array<{ id: string; macAddress: string; serialNumber: string; notes?: string }>>([]);
  const [pasteText, setPasteText] = useState('');

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Cargar Bodegas y Catálogo
  const loadData = async () => {
    try {
      setLoading(true);
      const [whRes, catRes] = await Promise.all([
        api.getWarehouses(),
        api.getCatalog({ isActive: true })
      ]);

      const whList = whRes.warehouses || [];
      const catList = catRes.products || [];

      setWarehouses(whList);
      setCatalog(catList);

      // Preseleccionar bodega Principal/Hub si existe
      if (whList.length > 0) {
        const principalWh = whList.find(w => w.type === 'PRINCIPAL' || w.type === 'HUB') || whList[0];
        setSelectedWarehouseId(principalWh.id);
      }

      if (catList.length > 0 && !selectedProductId) {
        setSelectedProductId(catList[0].id);
      }
    } catch (err: any) {
      console.error('Error cargando datos para Inbound:', err);
      setToastMessage({ type: 'error', text: 'Error cargando bodegas o catálogo' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedProduct = catalog.find(p => p.id === selectedProductId);
  const selectedWarehouse = warehouses.find(w => w.id === selectedWarehouseId);

  // Generar ID de Bobina sugerido
  const generateBatchNumber = (index: number) => {
    const year = new Date().getFullYear();
    const rand = Math.floor(100 + Math.random() * 900);
    return `BOB-${year}-${rand}`;
  };

  // Manejo de Agregar / Remover Bobinas
  const addBatchRow = () => {
    setBatchItems(prev => [
      ...prev,
      {
        id: String(Date.now()),
        batchNumber: generateBatchNumber(prev.length + 1),
        initialQuantity: 1000,
        notes: ''
      }
    ]);
  };

  const removeBatchRow = (id: string) => {
    if (batchItems.length > 1) {
      setBatchItems(prev => prev.filter(b => b.id !== id));
    }
  };

  // Manejo de Equipos Seriados Interactivos
  const handleAddQuickSerial = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMac = quickMac.trim().toUpperCase();
    const cleanSerial = quickSerial.trim().toUpperCase();

    if (!cleanMac || !cleanSerial) return;

    // Validar duplicados en la lista temporal
    if (serializedList.some(s => s.macAddress === cleanMac)) {
      alert(`La MAC "${cleanMac}" ya fue agregada en esta lista.`);
      return;
    }
    if (serializedList.some(s => s.serialNumber === cleanSerial)) {
      alert(`El Serial "${cleanSerial}" ya fue agregado en esta lista.`);
      return;
    }

    setSerializedList(prev => [
      ...prev,
      { id: String(Date.now()), macAddress: cleanMac, serialNumber: cleanSerial }
    ]);

    setQuickMac('');
    setQuickSerial('');
  };

  const removeSerialItem = (id: string) => {
    setSerializedList(prev => prev.filter(s => s.id !== id));
  };

  // Procesar Pegado Masivo (Ej: "MAC,SERIAL" o "MAC TAB SERIAL" o "MAC SERIAL")
  const handleProcessBulkPaste = () => {
    if (!pasteText.trim()) return;

    const lines = pasteText.split('\n');
    const newItems: Array<{ id: string; macAddress: string; serialNumber: string }> = [];
    const seenMacs = new Set(serializedList.map(s => s.macAddress));
    const seenSerials = new Set(serializedList.map(s => s.serialNumber));
    let duplicatesCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Separadores admitidos: coma, punto y coma, tabulador, o espacios
      const parts = trimmed.split(/[\t,;]+/).map(p => p.trim());

      let mac = '';
      let serial = '';

      if (parts.length >= 2) {
        mac = parts[0].toUpperCase();
        serial = parts[1].toUpperCase();
      } else {
        // Separación por espacio simple
        const spaceParts = trimmed.split(/\s+/);
        if (spaceParts.length >= 2) {
          mac = spaceParts[0].toUpperCase();
          serial = spaceParts[1].toUpperCase();
        }
      }

      if (mac && serial) {
        if (seenMacs.has(mac) || seenSerials.has(serial)) {
          duplicatesCount++;
        } else {
          seenMacs.add(mac);
          seenSerials.add(serial);
          newItems.push({
            id: String(Date.now() + Math.random()),
            macAddress: mac,
            serialNumber: serial
          });
        }
      }
    }

    if (newItems.length > 0) {
      setSerializedList(prev => [...prev, ...newItems]);
      setPasteText('');
      setScanMode('interactive');
      setToastMessage({
        type: 'success',
        text: `Se procesaron ${newItems.length} equipos seriados.${duplicatesCount > 0 ? ` (${duplicatesCount} duplicados omitidos)` : ''}`
      });
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      alert('No se pudieron extraer pares válidos de MAC y Serial del texto pegado.');
    }
  };

  // Submit Inbound Form
  const handleSubmitInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouseId || !selectedProductId || !selectedProduct) return;

    try {
      setIsSubmitting(true);
      setToastMessage(null);

      const trackingType = selectedProduct.trackingType;

      if (trackingType === 'BULK') {
        const qty = Number(bulkQuantity);
        if (!qty || qty <= 0) {
          throw new Error('Ingrese una cantidad válida mayor a cero.');
        }

        const res = await api.inboundInventory({
          warehouseId: selectedWarehouseId,
          productId: selectedProductId,
          trackingType: 'BULK',
          quantity: qty,
          notes: notes.trim() || undefined
        });

        setToastMessage({ type: 'success', text: res.message });
        setBulkQuantity('');
        setNotes('');
      } else if (trackingType === 'BATCHED') {
        const validBatches = batchItems.filter(b => b.batchNumber.trim() && b.initialQuantity > 0);
        if (validBatches.length === 0) {
          throw new Error('Ingrese al menos una bobina con metraje válido.');
        }

        const res = await api.inboundInventory({
          warehouseId: selectedWarehouseId,
          productId: selectedProductId,
          trackingType: 'BATCHED',
          batches: validBatches.map(b => ({
            batchNumber: b.batchNumber.trim().toUpperCase(),
            initialQuantity: Number(b.initialQuantity),
            notes: b.notes?.trim() || undefined
          })),
          notes: notes.trim() || undefined
        });

        setToastMessage({ type: 'success', text: res.message });
        setBatchItems([{ id: '1', batchNumber: '', initialQuantity: 1000, notes: '' }]);
        setNotes('');
      } else if (trackingType === 'SERIALIZED') {
        if (serializedList.length === 0) {
          throw new Error('Debe escanear o agregar al menos un equipo seriado.');
        }

        const res = await api.inboundInventory({
          warehouseId: selectedWarehouseId,
          productId: selectedProductId,
          trackingType: 'SERIALIZED',
          items: serializedList.map(s => ({
            macAddress: s.macAddress,
            serialNumber: s.serialNumber
          })),
          notes: notes.trim() || undefined
        });

        setToastMessage({ type: 'success', text: res.message });
        setSerializedList([]);
        setNotes('');
      }

      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message || 'Error al registrar el ingreso' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtrado de productos para el buscador
  const filteredCatalog = catalog.filter(p => {
    const q = productSearchQuery.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.brand && p.brand.toLowerCase().includes(q));
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── Top Header ── */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            <ArrowDownToLine className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-heading font-bold text-slate-900 dark:text-white">
                Ingreso de Mercancía (Inbound)
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                Alta de Stock Físico
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Recepción y alta física en bodegas respetando la naturaleza de control (Granel, Bobinas o Equipos Seriados)
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition self-end sm:self-auto"
          title="Recargar catálogo y bodegas"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Toasts Feedback */}
      {toastMessage && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 text-xs font-semibold shadow-sm transition-all ${
          toastMessage.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
            : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
        }`}>
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* ── Formulario de Ingreso en 3 Pasos ── */}
      <form onSubmit={handleSubmitInbound} className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── COLUMNA IZQUIERDA: Paso 1 (Bodega) & Paso 2 (Producto) ── */}
        <div className="space-y-6">

          {/* PASO 1: Bodega de Destino */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-heading font-bold text-sm">
              <span className="w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center text-xs font-bold">1</span>
              <span>Bodega de Destino</span>
            </div>

            <p className="text-xs text-slate-500">
              Selecciona el nodo logístico donde se descargará el material
            </p>

            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-sky-500"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>
                  {w.type === 'PRINCIPAL' || w.type === 'HUB' ? '🏢' : w.type === 'SUCURSAL' ? '🏪' : '🚚'} {w.name} ({w.code})
                </option>
              ))}
            </select>

            {selectedWarehouse && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-[11px] space-y-1">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Tipo de Nodo:</span>
                  <strong className="text-slate-900 dark:text-white uppercase">{selectedWarehouse.type}</strong>
                </div>
                {selectedWarehouse.address && (
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Ubicación:</span>
                    <span className="text-slate-800 dark:text-slate-200 truncate">{selectedWarehouse.address}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PASO 2: Selección de Producto del Catálogo */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-heading font-bold text-sm">
              <span className="w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center text-xs font-bold">2</span>
              <span>Producto del Catálogo</span>
            </div>

            <p className="text-xs text-slate-500">
              Busca y selecciona el material que estás recibiendo
            </p>

            {/* Buscador de Producto */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filtrar por SKU o nombre..."
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 border border-slate-100 dark:border-slate-800 rounded-xl p-1.5">
              {filteredCatalog.length === 0 ? (
                <p className="text-center py-4 text-xs text-slate-400">No se encontraron productos en el catálogo</p>
              ) : (
                filteredCatalog.map(p => {
                  const isSelected = selectedProductId === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedProductId(p.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between text-xs ${
                        isSelected
                          ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-500 text-slate-900 dark:text-white ring-1 ring-sky-500 shadow-xs'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-0.5 truncate pr-2">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {p.name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {p.sku} {p.brand ? `• ${p.brand}` : ''}
                        </div>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        p.trackingType === 'SERIALIZED' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                        p.trackingType === 'BATCHED' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {p.trackingType === 'SERIALIZED' ? 'Seriado' : p.trackingType === 'BATCHED' ? 'Bobinas' : 'Granel'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Observaciones generales de recepción */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1 text-xs">
                Nota / No. de Factura o Guía (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej. Factura #4092 / Importación Contenedor 12"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

          </div>

        </div>

        {/* ── COLUMNA CENTRAL Y DERECHA: Paso 3 (Formulario Dinámico) ── */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            
            {/* Cabecera del Paso 3 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center text-xs font-bold">3</span>
                <div>
                  <h3 className="text-slate-900 dark:text-white font-heading font-bold text-base">
                    Especificación de Existencias Físicas
                  </h3>
                  <p className="text-xs text-slate-500">
                    Formulario adaptado para: <strong className="text-slate-800 dark:text-slate-200">{selectedProduct?.name || 'Seleccione producto'}</strong>
                  </p>
                </div>
              </div>

              {selectedProduct && (
                <div className="flex items-center gap-1.5">
                  {selectedProduct.trackingType === 'SERIALIZED' && (
                    <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-xs font-bold">
                      <Cpu className="w-3.5 h-3.5" />
                      <span>Control Individual Seriado</span>
                    </span>
                  )}
                  {selectedProduct.trackingType === 'BATCHED' && (
                    <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 px-3 py-1 rounded-full text-xs font-bold">
                      <Disc className="w-3.5 h-3.5" />
                      <span>Control de Bobinas / Metraje</span>
                    </span>
                  )}
                  {selectedProduct.trackingType === 'BULK' && (
                    <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-bold">
                      <Boxes className="w-3.5 h-3.5" />
                      <span>Control a Granel (Unidades)</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* ── CASO A: BULK (GRANEL / UNIDADES) ── */}
            {selectedProduct?.trackingType === 'BULK' && (
              <div className="space-y-4 py-3">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <label className="block text-slate-800 dark:text-slate-200 font-bold text-sm">
                    Cantidad Física a Ingresar *
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="Ej. 500"
                      value={bulkQuantity}
                      onChange={(e) => setBulkQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 text-lg font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                    />
                    <span className="px-4 py-3 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold text-slate-700 dark:text-slate-300 uppercase text-xs">
                      {selectedProduct.unitOfMeasure}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Esta cantidad se sumará automáticamente al stock disponible en la bodega elegida.
                  </p>
                </div>
              </div>
            )}

            {/* ── CASO B: BATCHED (LOTES / BOBINAS DE CABLE) ── */}
            {selectedProduct?.trackingType === 'BATCHED' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Bobinas a Ingresar ({batchItems.length})
                  </h4>
                  <button
                    type="button"
                    onClick={addBatchRow}
                    className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Agregar Otra Bobina</span>
                  </button>
                </div>

                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {batchItems.map((batch, index) => (
                    <div key={batch.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col sm:flex-row items-center gap-3">
                      
                      <div className="w-full sm:w-1/2">
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          No. de Lote / ID Bobina *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ej. BOB-4001"
                          value={batch.batchNumber}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setBatchItems(prev => prev.map(item => item.id === batch.id ? { ...item, batchNumber: val } : item));
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white uppercase outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>

                      <div className="w-full sm:w-1/3">
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          Metraje Inicial ({selectedProduct.unitOfMeasure}) *
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          placeholder="1000"
                          value={batch.initialQuantity}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setBatchItems(prev => prev.map(item => item.id === batch.id ? { ...item, initialQuantity: val } : item));
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>

                      {batchItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeBatchRow(batch.id)}
                          className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition self-end sm:self-center mt-2 sm:mt-4"
                          title="Eliminar fila"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── CASO C: SERIALIZED (EQUIPOS SERIADOS ONUS / ROUTERS) ── */}
            {selectedProduct?.trackingType === 'SERIALIZED' && (
              <div className="space-y-4">
                
                {/* Switch de modo de escaneo */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
                    <button
                      type="button"
                      onClick={() => setScanMode('interactive')}
                      className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                        scanMode === 'interactive'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Modo Pistola / Escáner</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setScanMode('paste')}
                      className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                        scanMode === 'paste'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <Clipboard className="w-3.5 h-3.5" />
                      <span>Pegado Masivo (Excel)</span>
                    </button>
                  </div>

                  <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 rounded-lg border border-sky-200 dark:border-sky-800">
                    {serializedList.length} equipos listos
                  </span>
                </div>

                {/* Submodo 1: Escáner Interactivo */}
                {scanMode === 'interactive' && (
                  <div className="p-4 bg-sky-50/50 dark:bg-sky-950/20 rounded-2xl border border-sky-200 dark:border-sky-900/60 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-bold text-xs mb-1">
                          Escanear MAC Address *
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. F4:8E:38:11:22:33"
                          value={quickMac}
                          onChange={(e) => setQuickMac(e.target.value.toUpperCase())}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-bold text-xs mb-1">
                          Escanear Serial (S/N) *
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. HWTC45091238"
                          value={quickSerial}
                          onChange={(e) => setQuickSerial(e.target.value.toUpperCase())}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddQuickSerial}
                      disabled={!quickMac.trim() || !quickSerial.trim()}
                      className="w-full py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Agregar Equipo a la Lista</span>
                    </button>
                  </div>
                )}

                {/* Submodo 2: Pegado Masivo */}
                {scanMode === 'paste' && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">
                      Pega aquí múltiples líneas copiadas de Excel o un archivo de texto en formato: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-sky-600 font-mono">MAC, SERIAL</code>
                    </p>
                    <textarea
                      rows={5}
                      placeholder={`F4:8E:38:AA:01:01, HWTC10001\nF4:8E:38:AA:01:02, HWTC10002\nF4:8E:38:AA:01:03, HWTC10003`}
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <button
                      type="button"
                      onClick={handleProcessBulkPaste}
                      disabled={!pasteText.trim()}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 text-white font-bold rounded-xl text-xs transition"
                    >
                      Procesar y Agregar Líneas
                    </button>
                  </div>
                )}

                {/* Tabla de Equipos Escaneados */}
                {serializedList.length > 0 && (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800 text-[11px]">
                        <tr>
                          <th className="py-2 px-3">#</th>
                          <th className="py-2 px-3">MAC Address</th>
                          <th className="py-2 px-3">Serial (S/N)</th>
                          <th className="py-2 px-3 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                        {serializedList.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-2 px-3 text-slate-400 text-[10px]">{idx + 1}</td>
                            <td className="py-2 px-3 font-bold text-sky-600 dark:text-sky-400">{item.macAddress}</td>
                            <td className="py-2 px-3 text-slate-800 dark:text-slate-200">{item.serialNumber}</td>
                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => removeSerialItem(item.id)}
                                className="text-rose-500 hover:text-rose-700 font-sans text-xs"
                              >
                                &times;
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            )}

            {/* ── BOTÓN DE CONFIRMACIÓN ── */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={isSubmitting || !selectedWarehouseId || !selectedProductId}
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm shadow-md active:scale-95 transition-all flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Registrando en Base de Datos...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar Ingreso a Bodega</span>
                  </>
                )}
              </button>
            </div>

          </div>

        </div>

      </form>

    </div>
  );
};
