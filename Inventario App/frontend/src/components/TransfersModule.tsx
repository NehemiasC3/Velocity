import React, { useEffect, useState } from 'react';
import { 
  Truck, Plus, ArrowRight, CheckCircle2, Clock, 
  AlertCircle, Package, Layers, CheckSquare, Search,
  QrCode, RefreshCw, X, Disc, Cpu, Boxes, FileText,
  Building2, Store, Sparkles, Check, ChevronDown
} from 'lucide-react';
import { api } from '../services/api';
import { TransferOrder, Warehouse, SerializedItem, BulkStock, BatchItem } from '../types';
import { useAuth } from '../context/AuthContext';

export const TransfersModule: React.FC = () => {
  const { currentUser } = useAuth();
  const [transfers, setTransfers] = useState<TransferOrder[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Create Transfer State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('');
  const [directReceive, setDirectReceive] = useState(true);
  const [notes, setNotes] = useState('');

  // Stock available in selected origin warehouse
  const [loadingOriginStock, setLoadingOriginStock] = useState(false);
  const [originStock, setOriginStock] = useState<{
    bulkStocks: any[];
    batchItems: any[];
    serializedItems: any[];
  }>({
    bulkStocks: [],
    batchItems: [],
    serializedItems: []
  });

  // Selected Items to Transfer (The Cart)
  const [selectedSerializedIds, setSelectedSerializedIds] = useState<string[]>([]);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [selectedBulkQuantities, setSelectedBulkQuantities] = useState<{ [productId: string]: number }>({});

  // Fast scanner input in modal
  const [scanMacInput, setScanMacInput] = useState('');
  const [activeTabMaterial, setActiveTabMaterial] = useState<'serialized' | 'batched' | 'bulk'>('serialized');

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [trfRes, whRes] = await Promise.all([
        api.getTransfers(),
        api.getWarehouses()
      ]);

      setTransfers(trfRes.transfers || []);
      const whList = whRes.warehouses || [];
      setWarehouses(whList);

      if (whList.length >= 2 && !sourceWarehouseId) {
        setSourceWarehouseId(whList[0].id);
        setDestinationWarehouseId(whList[1].id);
      }
    } catch (err: any) {
      console.error('Error cargando traslados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Cargar inventario físico del origen cuando cambia la bodega origen
  useEffect(() => {
    if (!sourceWarehouseId) return;

    const fetchOriginStock = async () => {
      try {
        setLoadingOriginStock(true);
        const res = await api.getWarehouseStock(sourceWarehouseId);
        if (res && res.stock) {
          setOriginStock({
            bulkStocks: res.stock.bulkStocks || [],
            batchItems: res.stock.batchItems || [],
            serializedItems: res.stock.serializedItems || []
          });
        }
        // Limpiar selecciones al cambiar origen
        setSelectedSerializedIds([]);
        setSelectedBatchIds([]);
        setSelectedBulkQuantities({});
      } catch (err) {
        console.error('Error cargando stock de origen:', err);
      } finally {
        setLoadingOriginStock(false);
      }
    };

    fetchOriginStock();
  }, [sourceWarehouseId]);

  // Habilitar cierre con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showCreateModal) {
        setShowCreateModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCreateModal]);

  // Escanear MAC rápido para marcar checkbox automáticamente
  const handleFastScanMac = (e: React.FormEvent) => {
    e.preventDefault();
    const query = scanMacInput.trim().toUpperCase();
    if (!query) return;

    const found = originStock.serializedItems.find(i => 
      i.macAddress.toUpperCase() === query || 
      i.serialNumber.toUpperCase() === query
    );

    if (found) {
      if (!selectedSerializedIds.includes(found.id)) {
        setSelectedSerializedIds(prev => [...prev, found.id]);
        setToastMessage({ type: 'success', text: `Equipo MAC ${found.macAddress} añadido a la orden` });
      } else {
        setToastMessage({ type: 'error', text: `La MAC ${found.macAddress} ya estaba seleccionada` });
      }
    } else {
      setToastMessage({ type: 'error', text: `No se encontró el equipo "${query}" en la bodega de origen` });
    }

    setScanMacInput('');
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Enviar Traslado Transaccional
  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sourceWarehouseId || !destinationWarehouseId) {
      alert('Debe seleccionar bodega de origen y destino');
      return;
    }

    if (sourceWarehouseId === destinationWarehouseId) {
      alert('La bodega de origen y destino no pueden ser iguales');
      return;
    }

    const bulkPayload = Object.entries(selectedBulkQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));

    if (selectedSerializedIds.length === 0 && selectedBatchIds.length === 0 && bulkPayload.length === 0) {
      alert('Debes incluir al menos un material (equipo, bobina o granel) en la orden de traslado');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.createTransfer({
        sourceWarehouseId,
        destinationWarehouseId,
        notes: notes.trim() || undefined,
        serializedIds: selectedSerializedIds,
        batchIds: selectedBatchIds,
        bulkItems: bulkPayload,
        directReceive
      });

      setToastMessage({ type: 'success', text: res.message });
      setShowCreateModal(false);
      setSelectedSerializedIds([]);
      setSelectedBatchIds([]);
      setSelectedBulkQuantities({});
      setNotes('');
      await loadData();
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      alert(`Error al procesar traslado: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceiveTransfer = async (orderId: string) => {
    try {
      await api.receiveTransfer(orderId);
      await loadData();
    } catch (err: any) {
      alert(`Error recibiendo orden: ${err.message}`);
    }
  };

  const filteredTransfers = transfers.filter(t => {
    const q = searchQuery.toLowerCase();
    return !q || 
      t.orderNumber.toLowerCase().includes(q) ||
      (t.sourceWarehouse?.name && t.sourceWarehouse.name.toLowerCase().includes(q)) ||
      (t.destinationWarehouse?.name && t.destinationWarehouse.name.toLowerCase().includes(q)) ||
      (t.notes && t.notes.toLowerCase().includes(q));
  });

  const totalCartCount = 
    selectedSerializedIds.length + 
    selectedBatchIds.length + 
    Object.values(selectedBulkQuantities).filter(q => q > 0).length;

  return (
    <div className="space-y-6">

      {/* ── Top Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-heading font-bold text-slate-900 dark:text-white">
                Órdenes de Traslado & Distribución
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 font-bold">
                Hub & Spoke
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Control transaccional y custodia de remisiones (Hub Central &rarr; Sucursal &rarr; Cuadrilla Móvil)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nuevo Traslado</span>
          </button>

          <button
            onClick={loadData}
            title="Refrescar lista"
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {toastMessage && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 text-xs font-semibold shadow-sm transition-all ${
          toastMessage.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
            : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
        }`}>
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* ── Buscador de Órdenes ── */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por número de orden, origen, destino u observaciones..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <span className="text-xs text-slate-400 font-medium">
          {filteredTransfers.length} orden(es) registrada(s)
        </span>
      </div>

      {/* ── Listado de Órdenes de Traslado ── */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-36 bg-slate-100 dark:bg-slate-800/40 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredTransfers.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400">
            <Truck className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
            <p className="font-semibold text-slate-600 dark:text-slate-400">No hay órdenes de traslado registradas</p>
            <p className="text-xs text-slate-400 mt-0.5">Haz clic en "+ Nuevo Traslado" para despachar material entre bodegas.</p>
          </div>
        ) : (
          filteredTransfers.map(order => {
            const isEnTransito = order.status === 'EN_TRANSITO';
            const isRecibido = order.status === 'RECIBIDO';
            const serCount = order.serializedItems?.length || 0;
            const batchCount = order.batchItems?.length || 0;
            const bulkCount = order.items?.length || 0;

            return (
              <div
                key={order.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition"
              >
                {/* Header de la Tarjeta de Traslado */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${
                      isEnTransito
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                    }`}>
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                          {order.orderNumber}
                        </span>
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                          isEnTransito
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Creado por {order.createdByUser?.name || 'Sistema'} &bull; {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  {isEnTransito && (
                    <button
                      onClick={() => handleReceiveTransfer(order.id)}
                      className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-md active:scale-95"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmar Recepción</span>
                    </button>
                  )}
                </div>

                {/* Ruta de Origen a Destino */}
                <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                    <span className="text-slate-400 font-semibold">Origen:</span>
                    <strong className="text-slate-900 dark:text-white">
                      {order.sourceWarehouse?.name || order.originWarehouseName || 'Origen'}
                    </strong>
                  </div>

                  <ArrowRight className="w-4 h-4 text-sky-500 hidden sm:block shrink-0" />

                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                    <span className="text-slate-400 font-semibold">Destino:</span>
                    <strong className="text-sky-600 dark:text-sky-400">
                      {order.destinationWarehouse?.name || order.destinationWarehouseName || 'Destino'}
                    </strong>
                  </div>

                  {order.notes && (
                    <span className="sm:ml-auto text-slate-500 italic text-[11px] truncate max-w-xs">
                      "{order.notes}"
                    </span>
                  )}
                </div>

                {/* Contenido Trasladado (Seriados, Bobinas, Granel) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  
                  {/* Equipos Seriados */}
                  <div className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold uppercase">
                      <span className="flex items-center gap-1">
                        <Cpu className="w-3.5 h-3.5 text-blue-500" /> Seriados ({serCount})
                      </span>
                    </div>
                    {serCount === 0 ? (
                      <p className="text-slate-400 italic text-[11px]">Sin equipos seriados</p>
                    ) : (
                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1">
                        {order.serializedItems?.map(item => (
                          <span
                            key={item.id}
                            className="bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 font-mono text-[10px] px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900/60"
                          >
                            {item.macAddress}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Bobinas / Lotes */}
                  <div className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold uppercase">
                      <span className="flex items-center gap-1">
                        <Disc className="w-3.5 h-3.5 text-amber-500" /> Bobinas ({batchCount})
                      </span>
                    </div>
                    {batchCount === 0 ? (
                      <p className="text-slate-400 italic text-[11px]">Sin bobinas</p>
                    ) : (
                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1">
                        {order.batchItems?.map(batch => (
                          <span
                            key={batch.id}
                            className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-mono text-[10px] px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900/60"
                          >
                            {batch.batchNumber} ({batch.currentQuantity}m)
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Material a Granel */}
                  <div className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold uppercase">
                      <span className="flex items-center gap-1">
                        <Boxes className="w-3.5 h-3.5 text-slate-500" /> Granel ({bulkCount})
                      </span>
                    </div>
                    {bulkCount === 0 ? (
                      <p className="text-slate-400 italic text-[11px]">Sin material a granel</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
                        {order.items?.map(item => (
                          <span
                            key={item.id}
                            className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[11px] font-medium px-2 py-0.5 rounded"
                          >
                            <strong>{item.product?.name || 'Item'}:</strong> {item.quantity} {item.unitOfMeasure}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── MODAL: NUEVO TRASLADO TRANSACCIONAL ── */}
      {showCreateModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-2 sm:p-4 overflow-hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false);
          }}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl max-w-4xl w-full shadow-2xl ring-1 ring-slate-900/10 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Header del Modal (Fijo arriba) */}
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 border border-sky-200/50 dark:border-sky-800/50">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-base sm:text-lg text-slate-900 dark:text-white leading-tight">
                    Crear Orden de Despacho & Traslado
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Transfiere existencias físicas entre bodegas y cuadrillas de técnicos
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Cerrar modal (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTransfer} className="flex-1 flex flex-col overflow-hidden min-h-0">
              
              {/* Cuerpo del Formulario (Scrolleable en caso de pantallas pequeñas) */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-xs">

                {/* ── PASO 1: SELECCIÓN DE RUTA (ORIGEN Y DESTINO) ── */}
                <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        1. Bodega Origen (Salida de Material) *
                      </label>
                      <div className="relative">
                        <select
                          value={sourceWarehouseId}
                          onChange={(e) => setSourceWarehouseId(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-semibold outline-none focus:ring-2 focus:ring-sky-500 shadow-xs appearance-none pr-8 cursor-pointer truncate"
                        >
                          {warehouses.map(w => (
                            <option key={w.id} value={w.id}>
                              {w.type === 'PRINCIPAL' || w.type === 'HUB' ? '🏢' : w.type === 'SUCURSAL' ? '🏪' : '🚚'} {w.name} ({w.code})
                            </option>
                          ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                        <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                        2. Bodega Destino (Recepción) *
                      </label>
                      <div className="relative">
                        <select
                          value={destinationWarehouseId}
                          onChange={(e) => setDestinationWarehouseId(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-semibold outline-none focus:ring-2 focus:ring-sky-500 shadow-xs appearance-none pr-8 cursor-pointer truncate"
                        >
                          {warehouses.filter(w => w.id !== sourceWarehouseId).map(w => (
                            <option key={w.id} value={w.id}>
                              {w.type === 'PRINCIPAL' || w.type === 'HUB' ? '🏢' : w.type === 'SUCURSAL' ? '🏪' : '🚚'} {w.name} ({w.code})
                            </option>
                          ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── PASO 2: SELECCIÓN DE MATERIAL DEL ORIGEN ── */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        Materiales Disponibles en Origen
                      </span>
                      {loadingOriginStock && <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-500" />}
                    </div>

                    <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950 px-2.5 py-1 rounded-lg border border-sky-200 dark:border-sky-800">
                      {totalCartCount} ítem(s) en orden
                    </span>
                  </div>

                  {/* Subpestañas por naturaleza */}
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/70 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setActiveTabMaterial('serialized')}
                      className={`flex-1 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        activeTabMaterial === 'serialized'
                          ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <Cpu className="w-3.5 h-3.5" />
                      <span>Equipos Seriados ({originStock.serializedItems.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTabMaterial('batched')}
                      className={`flex-1 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        activeTabMaterial === 'batched'
                          ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <Disc className="w-3.5 h-3.5" />
                      <span>Bobinas / Cable ({originStock.batchItems.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTabMaterial('bulk')}
                      className={`flex-1 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        activeTabMaterial === 'bulk'
                          ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <Boxes className="w-3.5 h-3.5" />
                      <span>Granel ({originStock.bulkStocks.length})</span>
                    </button>
                  </div>

                  {/* TAB 1: EQUIPOS SERIADOS */}
                  {activeTabMaterial === 'serialized' && (
                    <div className="space-y-2.5">
                      {/* Escaneo Rápido con Pistola */}
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <QrCode className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                          <input
                            type="text"
                            placeholder="Escanear MAC o Serial para auto-seleccionar..."
                            value={scanMacInput}
                            onChange={(e) => setScanMacInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleFastScanMac(e);
                              }
                            }}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white font-mono uppercase outline-none focus:ring-2 focus:ring-sky-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleFastScanMac}
                          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 text-white font-bold text-xs transition cursor-pointer shadow-xs"
                        >
                          Marcar
                        </button>
                      </div>

                      {originStock.serializedItems.length === 0 ? (
                        <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-400">
                          <Package className="w-8 h-8 mx-auto mb-1.5 opacity-40" />
                          <p className="font-semibold">No hay equipos seriados disponibles en la bodega de origen.</p>
                        </div>
                      ) : (
                        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
                          {/* Encabezado de Columnas */}
                          <div className="grid grid-cols-12 gap-2 px-3.5 py-2 bg-slate-100/90 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider items-center">
                            <div className="col-span-1 flex items-center">
                              <input
                                type="checkbox"
                                checked={selectedSerializedIds.length === originStock.serializedItems.length && originStock.serializedItems.length > 0}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSerializedIds(originStock.serializedItems.map(i => i.id));
                                  } else {
                                    setSelectedSerializedIds([]);
                                  }
                                }}
                                className="w-3.5 h-3.5 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                                title="Seleccionar todos"
                              />
                            </div>
                            <div className="col-span-4">Equipo / Modelo</div>
                            <div className="col-span-3">Dirección MAC</div>
                            <div className="col-span-3">Número de Serie (S/N)</div>
                            <div className="col-span-1 text-right">Estado</div>
                          </div>

                          {/* Lista scrolleable con altura máxima controlada */}
                          <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
                            {originStock.serializedItems.map(item => {
                              const isChecked = selectedSerializedIds.includes(item.id);
                              const hasValidMac = item.macAddress && item.macAddress.trim().length > 3;
                              const productName = item.product?.name || item.model || 'Equipo ISP';
                              const brand = item.brand || item.product?.brand || '';

                              return (
                                <label
                                  key={item.id}
                                  className={`grid grid-cols-12 gap-2 items-center px-3.5 py-2.5 cursor-pointer transition text-xs select-none ${
                                    isChecked
                                      ? 'bg-sky-50/90 dark:bg-sky-950/60 text-sky-950 dark:text-sky-100'
                                      : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-300'
                                  }`}
                                >
                                  <div className="col-span-1 flex items-center">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedSerializedIds(prev => [...prev, item.id]);
                                        } else {
                                          setSelectedSerializedIds(prev => prev.filter(id => id !== item.id));
                                        }
                                      }}
                                      className="w-3.5 h-3.5 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                                    />
                                  </div>

                                  <div className="col-span-4 flex items-center gap-2 min-w-0">
                                    <div className={`p-1.5 rounded-lg shrink-0 ${isChecked ? 'bg-sky-200/70 text-sky-800 dark:bg-sky-900 dark:text-sky-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                                      <Cpu className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-bold truncate text-slate-900 dark:text-white leading-tight">
                                        {productName}
                                      </p>
                                      {brand && (
                                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                                          {brand}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="col-span-3 min-w-0">
                                    {hasValidMac ? (
                                      <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 inline-block truncate max-w-full">
                                        {item.macAddress}
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-slate-400 italic">
                                        Sin MAC
                                      </span>
                                    )}
                                  </div>

                                  <div className="col-span-3 min-w-0">
                                    <span className="font-mono font-bold text-[11px] text-sky-700 dark:text-sky-400 truncate block">
                                      {item.serialNumber || 'S/N N/A'}
                                    </span>
                                  </div>

                                  <div className="col-span-1 text-right">
                                    <span className="inline-block text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/60">
                                      Stock
                                    </span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: BOBINAS / CABLE */}
                  {activeTabMaterial === 'batched' && (
                    <div>
                      {originStock.batchItems.length === 0 ? (
                        <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-400">
                          <Disc className="w-8 h-8 mx-auto mb-1.5 opacity-40" />
                          <p className="font-semibold">No hay bobinas de cable drop disponibles en la bodega de origen.</p>
                        </div>
                      ) : (
                        <div className="max-h-52 overflow-y-auto space-y-1.5 p-1 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-xl">
                          {originStock.batchItems.map(batch => {
                            const isChecked = selectedBatchIds.includes(batch.id);
                            return (
                              <label
                                key={batch.id}
                                className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition text-xs select-none ${
                                  isChecked
                                    ? 'bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100 font-medium'
                                    : 'hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-300 border border-transparent'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedBatchIds(prev => [...prev, batch.id]);
                                      } else {
                                        setSelectedBatchIds(prev => prev.filter(id => id !== batch.id));
                                      }
                                    }}
                                    className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                                  />
                                  <div className="p-1.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                                    <Disc className="w-3.5 h-3.5" />
                                  </div>
                                  <div>
                                    <span className="font-mono font-bold">{batch.batchNumber}</span>
                                    <span className="text-slate-500 dark:text-slate-400 ml-1.5">({batch.product?.name || 'Cable Drop'})</span>
                                  </div>
                                </div>
                                <span className="font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950 px-2.5 py-1 rounded-md border border-amber-200 dark:border-amber-800">
                                  {batch.currentQuantity} {batch.unitOfMeasure}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: MATERIAL A GRANEL */}
                  {activeTabMaterial === 'bulk' && (
                    <div>
                      {originStock.bulkStocks.length === 0 ? (
                        <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-400">
                          <Boxes className="w-8 h-8 mx-auto mb-1.5 opacity-40" />
                          <p className="font-semibold">No hay materiales a granel disponibles en esta bodega.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                          {originStock.bulkStocks.map(stock => {
                            const maxQty = stock.quantity;
                            const currentVal = selectedBulkQuantities[stock.productId] || '';

                            return (
                              <div
                                key={stock.id}
                                className="p-3 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-2 text-xs shadow-xs"
                              >
                                <div className="truncate flex items-center gap-2">
                                  <div className="p-1.5 rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 shrink-0">
                                    <Boxes className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="truncate">
                                    <p className="font-bold text-slate-900 dark:text-white truncate">{stock.product?.name}</p>
                                    <p className="text-[11px] text-slate-400">
                                      Disp: <strong className="text-slate-700 dark:text-slate-300">{maxQty} {stock.product?.unitOfMeasure}</strong>
                                    </p>
                                  </div>
                                </div>

                                <input
                                  type="number"
                                  min="0"
                                  max={maxQty}
                                  placeholder="0"
                                  value={currentVal}
                                  onChange={(e) => {
                                    const val = Math.min(maxQty, Math.max(0, Number(e.target.value)));
                                    setSelectedBulkQuantities(prev => ({
                                      ...prev,
                                      [stock.productId]: val
                                    }));
                                  }}
                                  className="w-20 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-right font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                </div>

                {/* Observaciones y Entrega Inmediata */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                      Observaciones / No. de Guía
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Carga de reposición para cuadrilla #2 de David"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-1 text-slate-700 dark:text-slate-300 font-medium">
                    <input
                      type="checkbox"
                      checked={directReceive}
                      onChange={(e) => setDirectReceive(e.target.checked)}
                      className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                    />
                    <span>Recepción Inmediata (Marcar como RECIBIDO automáticamente en el destino)</span>
                  </label>
                </div>

              </div>

              {/* Footer Fijo con Acciones */}
              <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    Total a trasladar:
                  </span>
                  <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                    {totalCartCount} ítem(s)
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 font-semibold text-xs transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || totalCartCount === 0}
                    className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Procesar Traslado ({totalCartCount} ítems)</span>
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
