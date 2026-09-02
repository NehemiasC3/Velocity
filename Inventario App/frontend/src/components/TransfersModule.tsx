import React, { useEffect, useState } from 'react';
import { 
  Truck, Plus, ArrowRight, CheckCircle2, Clock, 
  AlertCircle, Package, Layers, CheckSquare, Search,
  QrCode, RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import { TransferOrder, Warehouse, SerializedItem, BulkItem, BulkStock } from '../types';
import { useAuth } from '../context/AuthContext';

export const TransfersModule: React.FC = () => {
  const { currentUser } = useAuth();
  const [transfers, setTransfers] = useState<TransferOrder[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [availableSerialized, setAvailableSerialized] = useState<SerializedItem[]>([]);
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([]);
  const [bulkStocks, setBulkStocks] = useState<BulkStock[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal create
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [originWarehouseId, setOriginWarehouseId] = useState('');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('');
  const [selectedOnuIds, setSelectedOnuIds] = useState<string[]>([]);
  const [selectedBulkQuantities, setSelectedBulkQuantities] = useState<{ [itemId: string]: number }>({});
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [trfRes, whRes, serRes, bulkRes] = await Promise.all([
        api.getTransfers(),
        api.getWarehouses(),
        api.getSerializedItems(),
        api.getBulkInventory()
      ]);
      setTransfers(trfRes.transfers);
      setWarehouses(whRes.warehouses);
      setAvailableSerialized(serRes.items);
      setBulkItems(bulkRes.items);
      setBulkStocks(bulkRes.stocks);

      if (whRes.warehouses.length >= 2) {
        setOriginWarehouseId(whRes.warehouses[0].id); // Hub Central
        setDestinationWarehouseId(whRes.warehouses[1].id); // Spoke Norte
      }
    } catch (err) {
      console.error('Error cargando traslados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originWarehouseId || !destinationWarehouseId) {
      alert('Debes seleccionar bodega de origen y destino');
      return;
    }
    if (originWarehouseId === destinationWarehouseId) {
      alert('La bodega de origen y destino no pueden ser iguales');
      return;
    }

    const bulkPayload = Object.entries(selectedBulkQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([bulkItemId, quantity]) => ({ bulkItemId, quantity }));

    if (selectedOnuIds.length === 0 && bulkPayload.length === 0) {
      alert('Debes incluir al menos una ONU o material a granel en el traslado');
      return;
    }

    try {
      await api.createTransfer({
        originWarehouseId,
        destinationWarehouseId,
        notes,
        serializedItemIds: selectedOnuIds,
        bulkItems: bulkPayload
      });

      setShowCreateModal(false);
      setSelectedOnuIds([]);
      setSelectedBulkQuantities({});
      setNotes('');
      loadData();
    } catch (err: any) {
      alert(`Error creando orden de traslado: ${err.message}`);
    }
  };

  const handleReceiveTransfer = async (orderId: string) => {
    try {
      await api.receiveTransfer(orderId);
      loadData();
    } catch (err: any) {
      alert(`Error recibiendo orden: ${err.message}`);
    }
  };

  // Items available in selected origin warehouse
  const originOnus = availableSerialized.filter(i => 
    i.currentWarehouseId === originWarehouseId && 
    (i.status === 'EN_BODEGA' || i.status === 'EN_VEHICULO')
  );

  const originBulkStocks = bulkStocks.filter(s => s.warehouseId === originWarehouseId);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-heading font-bold text-slate-900 dark:text-white">
            Módulo de Traslados & Órdenes en Tránsito
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Control de remisiones y transferencias de material (Hub &rarr; Sucursal, Sucursal &rarr; Camioneta)
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Orden de Tránsito</span>
        </button>
      </div>

      {/* List of Transfer Orders */}
      <div className="grid grid-cols-1 gap-4">
        {transfers.map((order) => {
          const isEnTransito = order.status === 'EN_TRANSITO';

          return (
            <div 
              key={order.id} 
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4 transition hover:border-slate-300 dark:hover:border-slate-700"
            >
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
                      <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                        {order.orderNumber}
                      </h4>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        isEnTransito
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Creado por {order.createdByName} • {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                {/* Confirm Receive Button for Destination Manager or Admin */}
                {isEnTransito && (
                  <button
                    onClick={() => handleReceiveTransfer(order.id)}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-md shadow-emerald-900/30"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar Recepción en {order.destinationWarehouseName}</span>
                  </button>
                )}
              </div>

              {/* Route indicator */}
              <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                  <span className="text-slate-400 font-semibold">Origen:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{order.originWarehouseName}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-sky-500 hidden sm:block shrink-0" />
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                  <span className="text-slate-400 font-semibold">Destino:</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400">{order.destinationWarehouseName}</span>
                </div>
                {order.notes && (
                  <span className="sm:ml-auto text-slate-500 italic text-[11px]">
                    "{order.notes}"
                  </span>
                )}
              </div>

              {/* Items in Order */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                
                {/* Serialized Items */}
                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl space-y-1.5">
                  <span className="font-semibold text-slate-500 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-sky-500" />
                    <span>Equipos Seriados ({order.serializedItemIds.length})</span>
                  </span>
                  {order.serializedItemIds.length === 0 ? (
                    <p className="text-slate-400 italic">Sin equipos seriados en esta orden</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {order.serializedItemIds.map((itemId) => {
                        const item = availableSerialized.find(i => i.id === itemId);
                        return (
                          <span 
                            key={itemId}
                            className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded font-mono text-[11px] border border-slate-200 dark:border-slate-700"
                          >
                            {item?.macAddress || itemId}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Bulk Items */}
                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl space-y-1.5">
                  <span className="font-semibold text-slate-500 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-sky-500" />
                    <span>Material a Granel ({order.bulkItems.length})</span>
                  </span>
                  {order.bulkItems.length === 0 ? (
                    <p className="text-slate-400 italic">Sin material a granel en esta orden</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {order.bulkItems.map((b, idx) => (
                        <span 
                          key={idx}
                          className="bg-sky-50 dark:bg-sky-950/60 text-sky-900 dark:text-sky-300 px-2.5 py-0.5 rounded-lg text-[11px] font-medium border border-sky-200 dark:border-sky-800"
                        >
                          <strong>{b.bulkItemName}:</strong> {b.quantity.toLocaleString()} {b.unitOfMeasure}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Reception detail */}
              {order.status === 'RECIBIDO' && order.receivedByName && (
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Recibido y verificado físicamente por {order.receivedByName} ({new Date(order.receivedAt || '').toLocaleString()})</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal: Create Transfer Order */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8">
            <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-sky-500" />
              <span>Crear Orden de Despacho & Tránsito</span>
            </h3>

            <form onSubmit={handleCreateTransfer} className="space-y-4 text-xs">
              
              {/* Origin & Destination Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">Bodega Origen *</label>
                  <select
                    value={originWarehouseId}
                    onChange={(e) => {
                      setOriginWarehouseId(e.target.value);
                      setSelectedOnuIds([]);
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.type})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">Bodega Destino *</label>
                  <select
                    value={destinationWarehouseId}
                    onChange={(e) => setDestinationWarehouseId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  >
                    {warehouses.filter(w => w.id !== originWarehouseId).map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.type})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Select ONUs available in origin */}
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  Seleccionar ONUs Disponibles en Origen ({originOnus.length} disponibles)
                </label>
                {originOnus.length === 0 ? (
                  <p className="text-slate-400 italic p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    No hay ONUs disponibles en la bodega de origen seleccionada.
                  </p>
                ) : (
                  <div className="max-h-40 overflow-y-auto p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1.5">
                    {originOnus.map(onu => (
                      <label 
                        key={onu.id} 
                        className="flex items-center gap-2.5 p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-lg cursor-pointer transition text-slate-800 dark:text-slate-200"
                      >
                        <input
                          type="checkbox"
                          checked={selectedOnuIds.includes(onu.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOnuIds([...selectedOnuIds, onu.id]);
                            } else {
                              setSelectedOnuIds(selectedOnuIds.filter(id => id !== onu.id));
                            }
                          }}
                          className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                        />
                        <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{onu.macAddress}</span>
                        <span className="text-slate-500">({onu.brand} {onu.model})</span>
                        <span className="font-mono text-slate-400 ml-auto">{onu.serialNumber}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Bulk Items Quantities */}
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  Material a Granel (Cable Drop, Tensores, Conectores)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {bulkItems.map(item => {
                    const originStock = originBulkStocks.find(s => s.bulkItemId === item.id)?.quantity || 0;

                    return (
                      <div key={item.id} className="p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white line-clamp-1">{item.name}</p>
                          <p className="text-[11px] text-slate-400">Disp: {originStock.toLocaleString()} {item.unitOfMeasure}</p>
                        </div>
                        <input
                          type="number"
                          min="0"
                          max={originStock}
                          placeholder="0"
                          value={selectedBulkQuantities[item.id] || ''}
                          onChange={(e) => setSelectedBulkQuantities({
                            ...selectedBulkQuantities,
                            [item.id]: parseFloat(e.target.value) || 0
                          })}
                          className="w-20 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-900 dark:text-white text-right font-mono font-bold"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">Observaciones / Guía de Remisión</label>
                <input
                  type="text"
                  placeholder="Ej. Despacho semanal de reposición cuadrilla #1"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-sm flex items-center gap-1.5"
                >
                  <Truck className="w-4 h-4" />
                  <span>Despachar Orden en Tránsito</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
