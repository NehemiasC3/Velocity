import React, { useEffect, useState } from 'react';
import { 
  CheckCircle2, X, AlertTriangle, Truck, User, 
  MapPin, Cpu, Disc, Boxes, Plus, Minus, QrCode, 
  RefreshCw, Check, Sparkles, FileText, Camera
} from 'lucide-react';
import { api } from '../services/api';
import { Warehouse, InstallationTicket, InstallationTicketType } from '../types';

interface LiquidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: {
    vehicleWarehouseId?: string;
    technicianId?: string;
    technicianName?: string;
    ticketNumber?: string;
    clientName?: string;
    contractId?: string;
    clientAddress?: string;
    wisproClientId?: string;
    wisproNode?: string;
    ticketType?: InstallationTicketType;
  };
  onSuccess?: (ticket: InstallationTicket) => void;
}

export const LiquidationModal: React.FC<LiquidationModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSuccess
}) => {
  // Vehicle selection & Stock
  const [vehicles, setVehicles] = useState<Warehouse[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [loadingStock, setLoadingStock] = useState(false);
  const [vehicleStock, setVehicleStock] = useState<{
    bulkStocks: any[];
    batchItems: any[];
    serializedItems: any[];
  }>({
    bulkStocks: [],
    batchItems: [],
    serializedItems: []
  });

  // Client and Ticket Info
  const [ticketNumber, setTicketNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [contractId, setContractId] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [ticketType, setTicketType] = useState<InstallationTicketType>('INSTALACION_NUEVA');

  // Material Consumption State
  // 1. Serialized ONU
  const [scannedMac, setScannedMac] = useState('');
  const [selectedOnuId, setSelectedOnuId] = useState('');
  
  // 2. Batched Spool
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [metersUsed, setMetersUsed] = useState<number>(0);

  // 3. Bulk (Counters)
  const [connectorsUsed, setConnectorsUsed] = useState<number>(2);
  const [tensorsUsed, setTensorsUsed] = useState<number>(2);
  const [bulkQuantities, setBulkQuantities] = useState<{ [productId: string]: number }>({});

  // Additional details
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load Vehicles
  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const res = await api.getWarehouses();
        const vList = (res.warehouses || []).filter(w => w.type === 'VEHICULO' || w.type === 'SUCURSAL');
        setVehicles(vList);

        if (initialData?.vehicleWarehouseId) {
          setSelectedVehicleId(initialData.vehicleWarehouseId);
        } else if (vList.length > 0) {
          setSelectedVehicleId(vList[0].id);
        }
      } catch (err) {
        console.error('Error cargando vehículos:', err);
      }
    };

    if (isOpen) {
      fetchVehicles();
      if (initialData) {
        setTicketNumber(initialData.ticketNumber || `TCK-${Date.now().toString().slice(-6)}`);
        setClientName(initialData.clientName || '');
        setContractId(initialData.contractId || '');
        setClientAddress(initialData.clientAddress || '');
        setTicketType(initialData.ticketType || 'INSTALACION_NUEVA');
      }
    }
  }, [isOpen, initialData]);

  // Load stock of the selected vehicle
  useEffect(() => {
    if (!selectedVehicleId) return;

    const fetchVehicleStock = async () => {
      try {
        setLoadingStock(true);
        const res = await api.getWarehouseStock(selectedVehicleId);
        if (res && res.stock) {
          setVehicleStock({
            bulkStocks: res.stock.bulkStocks || [],
            batchItems: res.stock.batchItems || [],
            serializedItems: res.stock.serializedItems || []
          });

          // Preseleccionar primera bobina disponible si existe
          if (res.stock.batchItems && res.stock.batchItems.length > 0) {
            setSelectedBatchId(res.stock.batchItems[0].id);
          }
        }
      } catch (err) {
        console.error('Error cargando stock del vehículo:', err);
      } finally {
        setLoadingStock(false);
      }
    };

    fetchVehicleStock();
  }, [selectedVehicleId]);

  if (!isOpen) return null;

  // Validation: Check if typed/scanned MAC belongs to vehicle
  const cleanScannedMac = scannedMac.trim().toUpperCase();
  const matchedOnu = vehicleStock.serializedItems.find(i => 
    i.macAddress.toUpperCase() === cleanScannedMac || 
    i.serialNumber.toUpperCase() === cleanScannedMac ||
    i.id === selectedOnuId
  );

  const selectedBatch = vehicleStock.batchItems.find(b => b.id === selectedBatchId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId) {
      setFeedback({ type: 'error', text: 'Seleccione el vehículo que realizó la instalación' });
      return;
    }

    try {
      setIsSubmitting(true);
      setFeedback(null);

      // Preparamos payload
      const bulkPayload = Object.entries(bulkQuantities)
        .filter(([_, qty]) => qty > 0)
        .map(([productId, quantity]) => ({ productId, quantity }));

      const payload = {
        vehicleWarehouseId: selectedVehicleId,
        ticketNumber: ticketNumber.trim() || `TCK-${Date.now().toString().slice(-6)}`,
        ticketType,
        clientName: clientName.trim() || 'Cliente Residencial',
        contractId: contractId.trim() || undefined,
        clientAddress: clientAddress.trim() || undefined,
        installedOnuMac: matchedOnu?.macAddress || (cleanScannedMac || undefined),
        batchedUsage: selectedBatch && metersUsed > 0 ? {
          batchId: selectedBatch.id,
          batchNumber: selectedBatch.batchNumber,
          metersUsed
        } : undefined,
        bulkUsage: bulkPayload,
        connectorsUsed,
        tensorsUsed,
        notes: notes.trim() || undefined
      };

      const res = await api.consumeLiquidation(payload);

      setFeedback({ type: 'success', text: res.message });
      if (onSuccess) onSuccess(res.ticket);

      setTimeout(() => {
        onClose();
        setFeedback(null);
      }, 1500);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Error al procesar la liquidación' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white">
                Liquidación de Materiales en Campo
              </h3>
              <p className="text-xs text-slate-500">
                Descuenta automáticamente el stock físico consumido del vehículo del técnico
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}>
            {feedback.type === 'success' ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
            <span>{feedback.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* ── SECCIÓN 1: VEHÍCULO Y DATOS DEL TRABAJO ── */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Vehículo / Cuadrilla del Técnico *
                </label>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      🚚 {v.name} {v.vehiclePlate ? `(${v.vehiclePlate})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Tipo de Actividad *
                </label>
                <select
                  value={ticketType}
                  onChange={(e) => setTicketType(e.target.value as InstallationTicketType)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="INSTALACION_NUEVA">🟢 Instalación Nueva</option>
                  <option value="CAMBIO_EQUIPO">🟡 Cambio de Equipo / ONU</option>
                  <option value="REPARACION_DROP">🔵 Reparación / Empalme de Drop</option>
                  <option value="MIGRACION">🟣 Migración Tecnológica</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Nombre del Cliente *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Juan Pérez / Res. Las Lajas"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  No. de Ticket / Contrato (Wispro)
                </label>
                <input
                  type="text"
                  placeholder="Ej. TCK-90214 / CTR-1002"
                  value={ticketNumber}
                  onChange={(e) => setTicketNumber(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* ── SECCIÓN 2: DECLARACIÓN DE MATERIAL CONSUMIDO ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                Materiales Físicos Gastados en el Cliente
              </span>
              {loadingStock && <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-500" />}
            </div>

            {/* A. ONU / ROUTER SERIADO */}
            <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/60 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5 text-xs">
                  <Cpu className="w-4 h-4" /> 1. Equipo Seriado Instalado (ONU / ONT)
                </span>
                <span className="text-[11px] text-blue-600 dark:text-blue-400 font-mono">
                  {vehicleStock.serializedItems.length} en vehículo
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <QrCode className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Escanear o escribir MAC (Ej. F4:8E:38:AA:BB:CC)..."
                    value={scannedMac}
                    onChange={(e) => {
                      setScannedMac(e.target.value);
                      setSelectedOnuId('');
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs font-mono uppercase text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <select
                  value={selectedOnuId}
                  onChange={(e) => {
                    setSelectedOnuId(e.target.value);
                    const found = vehicleStock.serializedItems.find(i => i.id === e.target.value);
                    if (found) setScannedMac(found.macAddress);
                  }}
                  className="w-48 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-700 dark:text-slate-300 outline-none"
                >
                  <option value="">-- O seleccionar de lista --</option>
                  {vehicleStock.serializedItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.macAddress} ({item.product?.name || item.brand})
                    </option>
                  ))}
                </select>
              </div>

              {/* Live MAC feedback badge */}
              {cleanScannedMac && (
                <div>
                  {matchedOnu ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg">
                      <Check className="w-3.5 h-3.5" />
                      <span>Validada en Vehículo: {matchedOnu.product?.name || matchedOnu.brand} ({matchedOnu.serialNumber})</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/60 px-2.5 py-1 rounded-lg">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Atención: Esta MAC no se encuentra registrada en el stock del vehículo</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* B. BOBINA DE CABLE DROP */}
            <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5 text-xs">
                  <Disc className="w-4 h-4" /> 2. Cable Drop (Metraje Consumido)
                </span>
                <span className="text-[11px] text-amber-700 dark:text-amber-400 font-mono">
                  {vehicleStock.batchItems.length} bobina(s) en carro
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 font-bold mb-1">
                    Bobina Utilizada
                  </label>
                  <select
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">-- Sin consumo de cable --</option>
                    {vehicleStock.batchItems.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.batchNumber} &bull; Disp: {b.currentQuantity}m ({b.product?.name || 'Drop'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 font-bold mb-1">
                    Metros Instalados *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max={selectedBatch?.currentQuantity || 5000}
                      placeholder="0"
                      value={metersUsed || ''}
                      onChange={(e) => setMetersUsed(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-slate-400 font-bold text-xs">metros</span>
                  </div>
                </div>
              </div>

              {/* Botones de metraje rápido */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-400 font-bold mr-1">Rápido:</span>
                {[30, 50, 75, 100, 150].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMetersUsed(m)}
                    className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 text-[10px] font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition"
                  >
                    +{m}m
                  </button>
                ))}
              </div>
            </div>

            {/* C. MATERIAL A GRANEL (CONECTORES, TENSORES) */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                <Boxes className="w-4 h-4 text-slate-500" /> 3. Material a Granel (Conectores & Herrajes)
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                
                {/* Conectores */}
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Conectores SC</span>
                  <div className="flex items-center justify-between mt-2">
                    <button
                      type="button"
                      onClick={() => setConnectorsUsed(Math.max(0, connectorsUsed - 1))}
                      className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">{connectorsUsed}</span>
                    <button
                      type="button"
                      onClick={() => setConnectorsUsed(connectorsUsed + 1)}
                      className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Tensores */}
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Tensores Drop</span>
                  <div className="flex items-center justify-between mt-2">
                    <button
                      type="button"
                      onClick={() => setTensorsUsed(Math.max(0, tensorsUsed - 1))}
                      className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">{tensorsUsed}</span>
                    <button
                      type="button"
                      onClick={() => setTensorsUsed(tensorsUsed + 1)}
                      className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Otros materiales dinámicos del stock del carro */}
                {vehicleStock.bulkStocks.slice(0, 2).map(bulk => {
                  const currentVal = bulkQuantities[bulk.productId] || 0;
                  return (
                    <div key={bulk.id} className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">
                        {bulk.product?.name || 'Material'}
                      </span>
                      <div className="flex items-center justify-between mt-2">
                        <button
                          type="button"
                          onClick={() => setBulkQuantities({ ...bulkQuantities, [bulk.productId]: Math.max(0, currentVal - 1) })}
                          className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">{currentVal}</span>
                        <button
                          type="button"
                          onClick={() => setBulkQuantities({ ...bulkQuantities, [bulk.productId]: Math.min(bulk.quantity, currentVal + 1) })}
                          className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}

              </div>
            </div>

          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
              Observaciones Técnicas (Potencia Óptica, NAP, etc.)
            </label>
            <input
              type="text"
              placeholder="Ej. Potencia -19.4 dBm en NAP-04 Puerto 3. Instalación conforme."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedVehicleId || !clientName.trim()}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold shadow-md active:scale-95 transition-all flex items-center gap-2"
            >
              {isSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span>⚡ Registrar Consumo y Cerrar Ticket</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
